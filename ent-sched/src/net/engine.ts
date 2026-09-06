/**
 * Round-driven network simulator. One round of physical time:
 *
 *   1. cutoff: pairs whose older end qubit exceeds `cutOff` rounds are dropped
 *   2. the policy allocates per-link attempt slots (entanglement generation
 *      bandwidth is THE scheduled resource)
 *   3. heralded attempts execute (Bernoulli per slot, fresh Werner pairs)
 *   4. the policy decides swaps and purifications on the updated state
 *   5. ops execute (swap merges or destroys; purify keeps or destroys)
 *   6. any pair spanning src→dst of its owner request is delivered
 *
 * This exact order is mirrored by the exact DTMC in src/net/markov.ts, which
 * validates the engine on a canonical 2-link chain — keep them in sync.
 *
 * Decoherence bookkeeping: each pair stores the physical creation rounds of
 * its two end qubits (tA, tB) plus the ages at which its Bell vector is exact
 * (sA, sB). Aging to `now` applies per-qubit depolarization for the extra
 * (now − tX) − sX rounds only — never double-counted across swaps/purifies.
 */

import { Rng } from "../core/rng.js";
import { type BellVec, werner } from "../physics/bell.js";
import { agePair, keyFraction, purify2to1, swapBell } from "../physics/ops.js";
import { Topology, type NetSpec } from "./topology.js";

export type { NetSpec } from "./topology.js";

export interface RequestSpec {
  readonly id: string;
  readonly src: string;
  readonly dst: string;
  readonly fMin: number;
}

export interface Pair {
  readonly id: number;
  readonly owner: string;
  /** Elementary links spanned, in path order. */
  readonly links: string[];
  readonly endA: string;
  readonly endB: string;
  /** Bell vector, exact when end qubits had ages sA / sB. */
  vec: BellVec;
  readonly tA: number;
  readonly tB: number;
  sA: number;
  sB: number;
  readonly bornAt: number;
}

export interface SwapAction {
  /** Pair ending at the merge node (its endB). */
  readonly left: number;
  /** Pair starting at the merge node (its endA). */
  readonly right: number;
}

export interface PurifyAction {
  readonly keep: number;
  readonly sac: number;
}

/** Read-only view handed to policies each round. */
export interface EngineView {
  readonly round: number;
  readonly net: NetSpec;
  readonly topology: Topology;
  readonly requests: readonly RequestSpec[];
  readonly pairs: readonly Pair[];
  /** Free attempt slots on a link = slots − max occupancy over its two ends. */
  freeSlots(linkId: string): number;
  /** Pairs anchored (holding a live qubit) at (link, node). */
  anchoredAt(linkId: string, node: string): Pair[];
  pairsOf(owner: string): Pair[];
  /** Exact Bell vector of a pair at `round` (fresh decoherence evaluation). */
  currentVec(pair: Pair, round: number): BellVec;
  /** Running delivered-pair count (good + below-threshold) per request. */
  deliveredCount(owner: string): number;
}

export interface Policy {
  readonly name: string;
  /** Called before attempts: owner ids per link, ≤ free slots (engine truncates). */
  allocateAttempts(st: EngineView, round: number): Map<string, string[]>;
  /** Called after attempts: swaps/purifications/discards to execute this round. */
  decideOps(st: EngineView, round: number): {
    swaps: SwapAction[];
    purifies: PurifyAction[];
    discards: number[];
  };
  /**
   * Called when a completed src→dst pair is BELOW fMin: "deliver" counts it
   * as a below-threshold delivery; "hold" keeps it in memory (e.g. for
   * purification next round). Defaults to "deliver".
   */
  onComplete?(st: EngineView, pair: Pair): "deliver" | "hold";
}

export interface RequestOutcome {
  readonly good: number;
  readonly bad: number;
  readonly meanFidelity: number;
  readonly goodput: number;
  readonly keyRate: number;
  readonly spanP50: number;
  readonly spanP95: number;
}

export interface SimReport {
  readonly policy: string;
  readonly rounds: number;
  readonly warmup: number;
  readonly perRequest: Readonly<Record<string, RequestOutcome>>;
  readonly aggregate: {
    readonly goodput: number;
    readonly meanFidelity: number;
    readonly keyRate: number;
    readonly jain: number;
    readonly spanP50: number;
    readonly spanP95: number;
  };
  readonly counters: {
    readonly attempts: number;
    readonly generated: number;
    readonly swaps: number;
    readonly swapFails: number;
    readonly purifies: number;
    readonly purifyFails: number;
    readonly cutoffs: number;
    readonly discards: number;
    readonly good: number;
    readonly bad: number;
  };
}

export interface SimConfig {
  readonly net: NetSpec;
  readonly requests: readonly RequestSpec[];
  readonly policy: Policy;
  readonly seed: number;
  readonly rounds: number;
  readonly warmupRounds?: number;
}

interface Acc {
  good: number;
  bad: number;
  fSum: number;
  keyBits: number;
  spans: number[];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx]!; // 0 ≤ idx ≤ length−1 clamped just above
}

export function runSim(cfg: SimConfig): SimReport {
  const { net, requests, policy, seed, rounds } = cfg;
  const warmup = cfg.warmupRounds ?? Math.floor(rounds * 0.1);
  const rng = new Rng(seed);
  const topo = new Topology(net);
  const byId = new Map<string, (typeof requests)[number]>();
  for (const r of requests) byId.set(r.id, r);

  let nextPairId = 1;
  let pairs: Pair[] = [];
  const counters = {
    attempts: 0,
    generated: 0,
    swaps: 0,
    swapFails: 0,
    purifies: 0,
    purifyFails: 0,
    cutoffs: 0,
    discards: 0,
  };
  const acc = new Map<string, Acc>();
  for (const r of requests) acc.set(r.id, { good: 0, bad: 0, fSum: 0, keyBits: 0, spans: [] });
  const delivered = new Map<string, number>();
  for (const r of requests) delivered.set(r.id, 0);
  // physical event totals over the WHOLE run (warmup included) — needed for
  // exact-chain comparisons; rate metrics stay warmup-filtered
  let totalGood = 0;
  let totalBad = 0;

  const currentVec = (pair: Pair, round: number): BellVec =>
    agePair(pair.vec, round - pair.tA - pair.sA, round - pair.tB - pair.sB, net.t2 ?? Number.POSITIVE_INFINITY);

  const buildView = (round: number): EngineView => {
    const occupancy = new Map<string, Pair[]>();
    for (const pr of pairs) {
      const first = pr.links[0];
      const last = pr.links[pr.links.length - 1];
      const k1 = `${first}|${pr.endA}`;
      const k2 = `${last}|${pr.endB}`;
      (occupancy.get(k1) ?? occupancy.set(k1, []).get(k1)!).push(pr);
      if (k2 !== k1) (occupancy.get(k2) ?? occupancy.set(k2, []).get(k2)!).push(pr);
    }
    return {
      round,
      net,
      topology: topo,
      requests,
      pairs,
      freeSlots(linkId: string): number {
        const l = topo.linkById.get(linkId);
        if (!l) return 0;
        const occA = (occupancy.get(`${linkId}|${l.a}`) ?? []).length;
        const occB = (occupancy.get(`${linkId}|${l.b}`) ?? []).length;
        return Math.max(0, l.slots - Math.max(occA, occB));
      },
      anchoredAt(linkId: string, node: string): Pair[] {
        return occupancy.get(`${linkId}|${node}`) ?? [];
      },
      pairsOf(owner: string): Pair[] {
        return pairs.filter((p) => p.owner === owner);
      },
      currentVec,
      deliveredCount(owner: string): number {
        return delivered.get(owner) ?? 0;
      },
    };
  };

  const removePairs = (ids: Set<number>): void => {
    pairs = pairs.filter((p) => !ids.has(p.id));
  };

  /** Creation round of the qubit sitting at `node` end of the pair. */
  const timeAt = (pair: Pair, node: string): number =>
    node === pair.endA ? pair.tA : pair.tB;

  const executeSwap = (left: Pair | undefined, right: Pair | undefined, round: number): void => {
    if (!left || !right) return;
    // orientation-agnostic merge: find the shared node, keep the outer qubits
    let m: string | null = null;
    for (const x of [left.endA, left.endB])
      for (const y of [right.endA, right.endB]) if (x === y) m = x;
    if (m === null) return;
    const otherL = left.endA === m ? left.endB : left.endA;
    const otherR = right.endA === m ? right.endB : right.endA;
    const linkL = left.endA === m ? left.links[0] : left.links[left.links.length - 1];
    const linkR = right.endA === m ? right.links[0] : right.links[right.links.length - 1];
    if (linkL === linkR || otherL === otherR) return; // same boundary link: not a swap
    counters.swaps++;
    if (rng.bernoulli(net.qSwap)) {
      // orient each segment from its outer end toward the merge node, so that
      // links[0] always touches endA (anchor bookkeeping depends on this)
      const orient = (p: Pair, from: string, to: string): string[] => {
        const fwd = p.endA === from && p.endB === to;
        const rev = p.endB === from && p.endA === to;
        if (fwd) return [...p.links];
        if (rev) return [...p.links].reverse();
        throw new Error("swap orientation invariant violated");
      };
      const merged: Pair = {
        id: nextPairId++,
        owner: left.owner,
        links: [...orient(left, otherL, m), ...orient(right, m, otherR)],
        endA: otherL,
        endB: otherR,
        vec: swapBell(currentVec(left, round), currentVec(right, round)),
        tA: timeAt(left, otherL),
        tB: timeAt(right, otherR),
        sA: round - timeAt(left, otherL),
        sB: round - timeAt(right, otherR),
        bornAt: Math.min(left.bornAt, right.bornAt),
      };
      removePairs(new Set([left.id, right.id]));
      pairs.push(merged);
    } else {
      counters.swapFails++;
      removePairs(new Set([left.id, right.id]));
    }
  };

  const executePurify = (keep: Pair | undefined, sac: Pair | undefined, round: number): void => {
    if (!keep || !sac) return;
    counters.purifies++;
    const { p, out } = purify2to1(currentVec(keep, round), currentVec(sac, round));
    if (rng.bernoulli(p)) {
      keep.vec = out;
      keep.sA = round - keep.tA;
      keep.sB = round - keep.tB;
      removePairs(new Set([sac.id]));
    } else {
      counters.purifyFails++;
      removePairs(new Set([keep.id, sac.id]));
    }
  };

  const deliver = (pair: Pair, round: number): void => {
    const r = byId.get(pair.owner);
    if (!r) return;
    const vec = currentVec(pair, round);
    const f = vec[0]!; // Bell vectors are length 4 by construction
    const a = acc.get(r.id)!;
    delivered.set(r.id, (delivered.get(r.id) ?? 0) + 1);
    if (f >= r.fMin) totalGood++;
    else totalBad++;
    if (round < warmup) return;
    if (f >= r.fMin) {
      a.good++;
      a.fSum += f;
      a.keyBits += keyFraction(vec);
      a.spans.push(round - pair.bornAt);
    } else {
      a.bad++;
    }
  };

  for (let round = 0; round < rounds; round++) {
    // 1. cutoffs (age at round start, strictly greater than cutOff)
    if (net.cutOff !== undefined) {
      const drop = new Set<number>();
      for (const pr of pairs) {
        if (round - pr.tA > net.cutOff || round - pr.tB > net.cutOff) drop.add(pr.id);
      }
      if (drop.size > 0) {
        counters.cutoffs += drop.size;
        removePairs(drop);
      }
    }

    // 2–3. attempt allocation and heralded generation
    const attemptView = buildView(round);
    const allocations = policy.allocateAttempts(attemptView, round);
    for (const l of net.links) {
      // allocation entries each bind one slot; cap by pre-attempt free slots
      const owners = (allocations.get(l.id) ?? []).slice(0, attemptView.freeSlots(l.id));
      for (const owner of owners) {
        counters.attempts++;
        if (rng.bernoulli(l.p)) {
          counters.generated++;
          pairs.push({
            id: nextPairId++,
            owner,
            links: [l.id],
            endA: l.a,
            endB: l.b,
            vec: werner(l.f0),
            tA: round,
            tB: round,
            sA: 0,
            sB: 0,
            bornAt: round,
          });
        }
      }
    }

    // 4–5. swap / purify / discard decisions and execution
    const ops = policy.decideOps(buildView(round), round);
    const live = () => new Map(pairs.map((p) => [p.id, p] as const));
    for (const id of ops.discards) {
      const m = live();
      if (m.has(id)) {
        counters.discards++;
        removePairs(new Set([id]));
      }
    }
    for (const pu of ops.purifies) {
      const m = live();
      const keep = m.get(pu.keep);
      const sac = m.get(pu.sac);
      if (
        keep &&
        keep.owner === sac?.owner &&
        keep.links.length === sac.links.length &&
        keep.links.every((x, i) => x === sac.links[i])
      ) {
        executePurify(keep, sac, round);
      }
    }
    for (const sw of ops.swaps) {
      const m = live();
      const left = m.get(sw.left);
      const right = m.get(sw.right);
      if (left && left.owner === right?.owner) {
        executeSwap(left, right, round); // geometry re-validated inside
      }
    }

    // 6. deliveries: complete pairs above fMin are delivered; below-threshold
    // ones are delivered unless the policy asks to hold them (purification)
    const done: Pair[] = [];
    for (const pr of pairs) {
      const r = byId.get(pr.owner);
      if (!r) continue;
      const complete =
        (pr.endA === r.src && pr.endB === r.dst) ||
        (pr.endA === r.dst && pr.endB === r.src);
      if (!complete) continue;
      if (currentVec(pr, round)[0]! >= r.fMin) done.push(pr);
      else if (policy.onComplete?.(buildView(round), pr) !== "hold") done.push(pr);
    }
    if (done.length > 0) {
      const ids = new Set(done.map((p) => p.id));
      for (const pr of done) deliver(pr, round);
      removePairs(ids);
    }
  }

  const eff = rounds - warmup;
  const perRequest: Record<string, RequestOutcome> = {};
  const goodputs: number[] = [];
  for (const r of requests) {
    const a = acc.get(r.id)!;
    const spans = [...a.spans].sort((x, y) => x - y);
    perRequest[r.id] = {
      good: a.good,
      bad: a.bad,
      meanFidelity: a.good > 0 ? a.fSum / a.good : Number.NaN,
      goodput: a.good / eff,
      keyRate: a.keyBits / eff,
      spanP50: quantile(spans, 0.5),
      spanP95: quantile(spans, 0.95),
    };
    goodputs.push(a.good / eff);
  }
  const goodputSum = goodputs.reduce((s, x) => s + x, 0);
  const totalF = Object.values(perRequest).reduce((s, x) => s + (Number.isFinite(x.meanFidelity) ? x.meanFidelity * x.good : 0), 0);
  const totalGoodCount = Object.values(perRequest).reduce((s, x) => s + x.good, 0);
  const allSpans = requests
    .flatMap((r) => [...acc.get(r.id)!.spans])
    .sort((x, y) => x - y);
  const keyTotal = Object.values(perRequest).reduce((s, x) => s + x.keyRate, 0);

  return {
    policy: policy.name,
    rounds,
    warmup,
    perRequest,
    aggregate: {
      goodput: goodputSum,
      meanFidelity: totalGoodCount > 0 ? totalF / totalGoodCount : Number.NaN,
      keyRate: keyTotal,
      jain:
        goodputs.length === 0 || goodputSum === 0
          ? Number.NaN
          : (goodputSum * goodputSum) / (goodputs.length * goodputs.reduce((s, x) => s + x * x, 0)),
      spanP50: quantile(allSpans, 0.5),
      spanP95: quantile(allSpans, 0.95),
    },
    counters: { ...counters, good: totalGood, bad: totalBad },
  };
}
