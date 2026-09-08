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
import { SchedError } from "../core/errors.js";
import { type BellVec, werner } from "../physics/bell.js";
import { agePair, keyFraction, purify2to1, swapBell } from "../physics/ops.js";
import { type SensorPlan, triangularNoise } from "./sensors.js";
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
  /**
   * Bell vector of a pair at `round` as the SCHEDULER may know it: the exact
   * physical vector in oracle mode, the belief mirror under a SensorPlan.
   */
  currentVec(pair: Pair, round: number): BellVec;
  /** Believed fidelity of a fresh pair on `linkId` (true f0 in oracle mode). */
  believedF0(linkId: string): number;
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
    /** Pairs destructively measured for estimator calibration (sensor mode). */
    readonly calibrated: number;
    /** Last round with ≥ 1 attempt; ≪ rounds ⇒ the run froze (deadlock census). */
    readonly lastAttemptRound: number;
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
  /**
   * Sensor plan (v0.2): when present, policies see a BELIEF MIRROR instead of
   * physical truth, calibration tomography feeds the estimator bank, and (if
   * `ledger` is given) every delivery is appended for QoS audit. Oracle mode
   * (undefined) is bit-identical to v0.1 — all v0.1 reports reproduce.
   */
  readonly sensors?: SensorPlan;
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

/**
 * Named rejection of configs whose failures would otherwise be silent:
 * rounds=0 or warmup ≥ rounds divide by zero into NaN aggregates; unknown
 * request nodes produce a request that can never complete; duplicate request
 * ids collapse the per-request accounting maps.
 */
function validateSimConfig(cfg: SimConfig): void {
  if (!Number.isInteger(cfg.rounds) || cfg.rounds < 1)
    throw new SchedError("SIM_CONFIG_ROUNDS", `rounds=${cfg.rounds} is not an integer ≥ 1 (goodput would divide by zero)`);
  const warmup = cfg.warmupRounds ?? Math.floor(cfg.rounds * 0.1);
  if (!Number.isInteger(warmup) || warmup < 0 || warmup >= cfg.rounds)
    throw new SchedError("SIM_CONFIG_WARMUP", `warmupRounds=${cfg.warmupRounds} (effective ${warmup}) is not an integer in [0, rounds=${cfg.rounds}) (effective throughput would divide by zero)`);
  const nodes = new Set(cfg.net.nodes);
  const ids = new Set<string>();
  for (const r of cfg.requests) {
    if (r.id.length === 0) throw new SchedError("SIM_CONFIG_REQUEST", "request id must be non-empty");
    if (ids.has(r.id))
      throw new SchedError("SIM_CONFIG_REQUEST", `duplicate request id '${r.id}' (per-request accounting would silently merge)`);
    ids.add(r.id);
    if (!nodes.has(r.src) || !nodes.has(r.dst))
      throw new SchedError("SIM_CONFIG_REQUEST", `request '${r.id}': endpoint '${nodes.has(r.src) ? r.dst : r.src}' is not a network node — the request can never complete`);
    if (!Number.isFinite(r.fMin) || r.fMin < 0 || r.fMin > 1)
      throw new SchedError("SIM_CONFIG_REQUEST", `request '${r.id}': fMin=${r.fMin} outside [0,1]`);
  }
  if (typeof cfg.policy.name !== "string" || cfg.policy.name.length === 0)
    throw new SchedError("SIM_CONFIG_POLICY", "policy.name must be a non-empty string");
  if (typeof cfg.policy.allocateAttempts !== "function" || typeof cfg.policy.decideOps !== "function")
    throw new SchedError("SIM_CONFIG_POLICY", "policy must implement allocateAttempts and decideOps");
  const s = cfg.sensors;
  if (s) {
    if (!Number.isFinite(s.calibRate) || s.calibRate < 0 || s.calibRate > 1)
      throw new SchedError("SIM_CONFIG_SENSORS", `calibRate=${s.calibRate} outside [0,1]`);
    if (!Number.isFinite(s.tomoSigma) || s.tomoSigma < 0)
      throw new SchedError("SIM_CONFIG_SENSORS", `tomoSigma=${s.tomoSigma} is negative or not finite`);
    if (s.t2Belief !== undefined && !(s.t2Belief > 0))
      throw new SchedError("SIM_CONFIG_SENSORS", `t2Belief=${s.t2Belief} must be > 0`);
  }
}

export function runSim(cfg: SimConfig): SimReport {
  validateSimConfig(cfg);
  const { net, requests, policy, seed, rounds } = cfg;
  const warmup = cfg.warmupRounds ?? Math.floor(rounds * 0.1);
  const rng = new Rng(seed);
  const topo = new Topology(net);
  const byId = new Map<string, (typeof requests)[number]>();
  for (const r of requests) byId.set(r.id, r);

  let nextPairId = 1;
  let pairs: Pair[] = [];
  const sensors = cfg.sensors;
  const t2Belief = sensors
    ? (sensors.t2Belief ?? net.t2 ?? Number.POSITIVE_INFINITY)
    : Number.NaN;
  // Belief mirror: per-pair Bell vector propagated from ESTIMATES. The physics
  // keeps truth in `pair.vec`; only the sensor layer ever reads this map.
  const beliefs = new Map<number, BellVec>();
  const counters = {
    attempts: 0,
    generated: 0,
    swaps: 0,
    swapFails: 0,
    purifies: 0,
    purifyFails: 0,
    cutoffs: 0,
    discards: 0,
    calibrated: 0,
    lastAttemptRound: -1,
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

  const beliefVec = (pair: Pair, round: number): BellVec => {
    const bv = beliefs.get(pair.id);
    if (bv === undefined) throw new SchedError("SENSOR_BELIEF_MISSING", `sensor layer: no belief vector for pair ${pair.id}`);
    return agePair(bv, round - pair.tA - pair.sA, round - pair.tB - pair.sB, t2Belief);
  };

  /** What policies may read: physical truth in oracle mode, belief otherwise. */
  const viewVec = sensors ? beliefVec : currentVec;

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
      currentVec: viewVec,
      believedF0(linkId: string): number {
        if (!sensors) return topo.linkById.get(linkId)?.f0 ?? 1;
        return sensors.bank.estimate(linkId).hatF;
      },
      deliveredCount(owner: string): number {
        return delivered.get(owner) ?? 0;
      },
    };
  };

  const removePairs = (ids: Set<number>): void => {
    pairs = pairs.filter((p) => !ids.has(p.id));
    if (sensors) for (const id of ids) beliefs.delete(id);
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
        throw new SchedError("SWAP_ORIENTATION_INVARIANT", `pair ${p.id} (${from}→${to}) does not sit on the merge boundary — engine bookkeeping bug`);
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
      // belief mirror: propagate the merge with believed inputs BEFORE the
      // source beliefs are removed alongside their pairs
      const mergedBelief = sensors
        ? swapBell(beliefVec(left, round), beliefVec(right, round))
        : undefined;
      removePairs(new Set([left.id, right.id]));
      pairs.push(merged);
      if (mergedBelief) beliefs.set(merged.id, mergedBelief);
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
      const outBelief = sensors
        ? purify2to1(beliefVec(keep, round), beliefVec(sac, round)).out
        : undefined;
      keep.vec = out;
      keep.sA = round - keep.tA;
      keep.sB = round - keep.tB;
      if (outBelief) beliefs.set(keep.id, outBelief);
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
    if (sensors?.ledger) {
      // release audit: belief at release vs physics truth — the certificate
      // every QoS claim has to survive (auditQosClaims)
      const claimedF = beliefVec(pair, round)[0]!;
      sensors.ledger.push({ owner: r.id, round, claimedF, trueF: f });
    }
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
        counters.lastAttemptRound = round;
        if (rng.bernoulli(l.p)) {
          counters.generated++;
          if (sensors && rng.bernoulli(sensors.calibRate)) {
            // destructive calibration: the pair is measured for the estimator
            // bank and never enters the pool — estimation has a real cost
            counters.calibrated++;
            sensors.bank.recordSample(
              sensors.bank.freshToken(),
              l.id,
              round,
              l.f0 + (sensors.tomoBias ?? 0) + triangularNoise(rng, sensors.tomoSigma)
            );
          } else {
            const id = nextPairId++;
            pairs.push({
              id,
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
            if (sensors) beliefs.set(id, werner(sensors.bank.estimate(l.id).hatF));
          }
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
    // ones are delivered unless the policy asks to hold them (purification).
    // Under a sensor plan the GATE runs on the belief mirror — the physics
    // referee keeps accounting on true fidelity, so belief errors surface as
    // bad deliveries that passed the believed gate (QoS violations).
    const done: Pair[] = [];
    for (const pr of pairs) {
      const r = byId.get(pr.owner);
      if (!r) continue;
      const complete =
        (pr.endA === r.src && pr.endB === r.dst) ||
        (pr.endA === r.dst && pr.endB === r.src);
      if (!complete) continue;
      const gateF = (sensors ? beliefVec(pr, round) : currentVec(pr, round))[0]!;
      if (gateF >= r.fMin) done.push(pr);
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
