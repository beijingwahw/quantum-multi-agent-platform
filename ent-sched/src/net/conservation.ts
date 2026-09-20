/**
 * E8 — the work-conservation insensitivity theorem (v0.4.0), on the
 * canonical saturated two-link chain (one request, one slot per link).
 *
 * THE THEOREM (falsifiable, and falsified-shaped where it should be):
 *
 *  (a) INVARIANCE. Any policy that is work-conserving on this chain —
 *      WC-1: requests attempts on every free slot every round, and
 *      WC-2: fires every merge the moment both segments exist —
 *      induces one and the same embedded stochastic process. The attempt
 *      requests, the heralded draws, and the swap consumptions are then all
 *      forced by the chain's own round order (cutoff -> attempts -> ops),
 *      so structurally different code paths land on identical counter
 *      vectors for the same seed (pinned bit-exactly below over four
 *      policies), and every one of them sits within MC noise of the exact
 *      DTMC value (markov.ts) AND of the renewal closed form
 *
 *          r* = qSwap / E[max(G1, G2)],   G_i ~ Geometric(p_i),
 *
 *          E[max] = sum_{t>=0} [ (1-p1)^t + (1-p2)^t - ((1-p1)(1-p2))^t ],
 *
 *      itself an exact identity against the 4-state chain (<= 6e-17 over the
 *      probed grid). The stationary delivery rate is a property of the
 *      PHYSICS, not of the policy; also verified on the 49-state age chain
 *      with cutoff and T2.
 *
 *  (b) THE IDENTITY AT THE BOUNDARY. For every work-conserving policy the
 *      rate loss against r* is exactly 0 and the machine-measured idle
 *      share (free attempt slots left unrequested) is exactly 0 —
 *      loss = idleShare holds on the class, tdm included (a single request
 *      makes tdm own every link).
 *
 *  (c) THE CONVICTION (negative control). A non-work-conserving policy that
 *      STALLS ready swaps (no swaps on even rounds) keeps idleShare = 0 —
 *      it never wastes an attempt slot — yet loses ~10% of the rate. Its
 *      exact rate is the 8-state parity-augmented chain solved here, the
 *      engine matches it within MC noise, and the identity "loss = idle
 *      share" dies off the work-conserving class: idling is not the only
 *      way to lose throughput.
 *
 * Boundaries: the theorem domain is the two-link single-request chain with
 * slots = 1 and no purification (the DTMC referee's own domain — 4/49
 * states). The multi-request face is DATA only: on the six-node chain ERS's
 * deficit arbitration holds Jain >= the round-robin pointer across the seed
 * grid (jainFaceoff), paid for in aggregate goodput (disclosed, not
 * claimed); general topologies and multi-link chains are out of domain.
 */

import { SchedError } from "../core/errors.js";
import {
  runSim,
  type EngineView,
  type NetSpec,
  type Policy,
  type PurifyAction,
  type RequestSpec,
  type SimReport,
  type SwapAction,
} from "./engine.js";
import {
  ersPolicy,
  swapAsapPolicy,
  swapLatePolicy,
  tdmPolicy,
} from "./policies.js";
import { Topology } from "./topology.js";

export interface ChainFace {
  readonly net: NetSpec;
  readonly request: RequestSpec;
}

/** Named parameter validation shared by every chain face in this file. */
function validateChainProbs(p1: number, p2: number, qSwap: number): void {
  const prob = (name: string, v: number): void => {
    if (!Number.isFinite(v) || v < 0 || v > 1)
      throw new SchedError("CONSERVATION_PARAM", `${name}=${v} outside [0,1]`);
  };
  prob("p1", p1);
  prob("p2", p2);
  prob("qSwap", qSwap);
}

/** The canonical saturated chain: n0 -l0-> n1 -l1-> n2, one slot per link. */
export function canonicalChain(
  p1: number,
  p2: number,
  qSwap: number,
  f0 = 0.99,
): ChainFace {
  validateChainProbs(p1, p2, qSwap);
  return {
    net: {
      nodes: ["n0", "n1", "n2"],
      links: [
        { id: "l0", a: "n0", b: "n1", p: p1, slots: 1, f0 },
        { id: "l1", a: "n1", b: "n2", p: p2, slots: 1, f0 },
      ],
      qSwap,
    },
    request: { id: "r", src: "n0", dst: "n2", fMin: 0 },
  };
}

/**
 * The renewal closed form r* = qSwap / E[max(G1, G2)]. The series' terms are
 * geometric; summing until they fall under 1e-18 pins the value to double
 * precision. This is the SECOND path beside markov.ts's stationary solve —
 * their agreement is itself a theorem leg, not an assumption.
 */
export function renewalRate(p1: number, p2: number, qSwap: number): number {
  validateChainProbs(p1, p2, qSwap);
  let e = 0;
  for (let t = 0; t < 4096; t++) {
    const term = (1 - p1) ** t + (1 - p2) ** t - ((1 - p1) * (1 - p2)) ** t;
    e += term;
    if (t > 64 && term < 1e-18) break;
  }
  return qSwap / e;
}

/**
 * A work-conserving policy whose code path is structurally unlike the
 * canonical three: it OVERBOOKS attempts 3x (the engine truncates to the
 * free slots), emits every swap TWICE (the second finds the pairs consumed
 * and no-ops), and discards two bogus pair ids per round (skipped as
 * nonexistent). Same decisions, different machinery — the census's point.
 */
export function wcOversubscribedPolicy(): Policy {
  return {
    name: "wc-oversubscribed",
    allocateAttempts(st: EngineView): Map<string, string[]> {
      const out = new Map<string, string[]>();
      for (const l of st.net.links) {
        const free = st.freeSlots(l.id);
        if (free > 0) out.set(l.id, Array<string>(free * 3).fill("r"));
      }
      return out;
    },
    decideOps(st: EngineView): {
      swaps: SwapAction[];
      purifies: PurifyAction[];
      discards: number[];
    } {
      const swaps: SwapAction[] = [];
      for (const p of st.pairsOf("r")) {
        for (const q of st.pairsOf("r")) {
          if (p.id < q.id && (p.endB === q.endA || p.endA === q.endB)) {
            swaps.push(
              { left: p.id, right: q.id },
              { left: p.id, right: q.id },
            );
          }
        }
      }
      return { swaps, purifies: [], discards: [-5, -7] };
    },
  };
}

/**
 * The negative control: NOT work-conserving on the swap face — a merge that
 * becomes available on an even round is stalled to the next (odd) round.
 * Attempt slots are still always requested (idleShare stays 0), which is
 * exactly what makes the conviction interesting.
 */
export function parityStallPolicy(): Policy {
  const wc = wcOversubscribedPolicy();
  return {
    name: "parity-stall",
    allocateAttempts: (st, round) => wc.allocateAttempts(st, round),
    decideOps(st: EngineView): {
      swaps: SwapAction[];
      purifies: PurifyAction[];
      discards: number[];
    } {
      if (st.round % 2 === 0) return { swaps: [], purifies: [], discards: [] };
      const swaps: SwapAction[] = [];
      for (const p of st.pairsOf("r")) {
        for (const q of st.pairsOf("r")) {
          if (p.id < q.id && (p.endB === q.endA || p.endA === q.endB))
            swaps.push({ left: p.id, right: q.id });
        }
      }
      return { swaps, purifies: [], discards: [] };
    },
  };
}

/**
 * Instrumentation: wrap a policy and count the attempt opportunities the
 * engine offered (free slots at attempt time) versus the ones the policy's
 * allocation actually covered. idleShare = missed / offered — measured, not
 * asserted from the code.
 */
export function idleShareProbe(inner: Policy): {
  policy: Policy;
  idleShare(): number;
  offered(): number;
} {
  let offered = 0;
  let missed = 0;
  const policy: Policy = {
    name: inner.name,
    allocateAttempts(st: EngineView, round: number): Map<string, string[]> {
      const alloc = inner.allocateAttempts(st, round);
      for (const l of st.net.links) {
        const free = st.freeSlots(l.id);
        if (free <= 0) continue;
        offered += free;
        missed += Math.max(
          0,
          free - Math.min(free, alloc.get(l.id)?.length ?? 0),
        );
      }
      return alloc;
    },
    decideOps: (st, round) => inner.decideOps(st, round),
  };
  return {
    policy,
    idleShare: () => (offered === 0 ? Number.NaN : missed / offered),
    offered: () => offered,
  };
}

export interface CensusRow {
  readonly policy: string;
  readonly rate: number;
  readonly idleShare: number;
  /** standard error of the rate estimate, for the sigma-scaled comparisons */
  readonly rateSe: number;
}

/**
 * The invariance census: run every structurally distinct work-conserving
 * policy on the same chain and seed, measure each rate and idle share, and
 * pairwise bit-compare the counter vectors (same decisions + same rng
 * stream = same process — the theorem's machine form).
 */
export function workConservingCensus(
  face: ChainFace,
  rounds: number,
  seed: number,
): { rows: CensusRow[]; bitIdentical: boolean } {
  if (!Number.isInteger(rounds) || rounds < 1)
    throw new SchedError(
      "CONSERVATION_ROUNDS",
      `rounds=${rounds} is not an integer >= 1`,
    );
  const topo = new Topology(face.net);
  const probes = [
    swapAsapPolicy(topo, [face.request]),
    swapLatePolicy(topo, [face.request]),
    tdmPolicy(topo, [face.request]),
    wcOversubscribedPolicy(),
  ].map((p) => idleShareProbe(p));
  const reports: SimReport[] = probes.map(({ policy }) =>
    runSim({ net: face.net, requests: [face.request], policy, seed, rounds }),
  );
  const first = JSON.stringify(reports[0]!.counters);
  const bitIdentical = reports.every(
    (rep) => JSON.stringify(rep.counters) === first,
  );
  const rows: CensusRow[] = reports.map((rep, i) => {
    const rate = (rep.counters.good + rep.counters.bad) / rounds;
    return {
      policy: probes[i]!.policy.name,
      rate,
      idleShare: probes[i]!.idleShare(),
      rateSe: Math.sqrt(Math.max(rate * (1 - rate), 1e-12) / rounds),
    };
  });
  return { rows, bitIdentical };
}

/**
 * The 8-state parity-augmented chain for the stalling policy: state
 * (a1, a2, round parity) with the engine's round order — attempts fill
 * empty links, the swap fires only on ODD rounds, ages tick. Stationary
 * distribution by Gaussian elimination (the same method markov.ts keeps
 * private; re-derived here because the function never crossed that module's
 * boundary, and the two solvers agreeing is part of the evidence).
 */
export function parityStallChain(
  p1: number,
  p2: number,
  qSwap: number,
): { deliveryRate: number; stateCount: number } {
  validateChainProbs(p1, p2, qSwap);
  const idx = (a1: number, a2: number, j: number): number =>
    (a1 * 2 + a2) * 2 + j;
  const dim = 8;
  const P: number[][] = Array.from({ length: dim }, () =>
    new Array<number>(dim).fill(0),
  );
  const rate = new Array<number>(dim).fill(0);
  for (let a1 = 0; a1 < 2; a1++) {
    for (let a2 = 0; a2 < 2; a2++) {
      for (let j = 0; j < 2; j++) {
        const s = idx(a1, a2, j);
        const nb = (j + 1) % 2;
        const outs: Array<[number, number, number]> = [];
        if (a1 === 0 && a2 === 0)
          outs.push(
            [0, 0, (1 - p1) * (1 - p2)],
            [1, 0, p1 * (1 - p2)],
            [0, 1, (1 - p1) * p2],
            [1, 1, p1 * p2],
          );
        else if (a1 === 1 && a2 === 0) outs.push([1, 0, 1 - p2], [1, 1, p2]);
        else if (a1 === 0 && a2 === 1) outs.push([0, 1, 1 - p1], [1, 1, p1]);
        else outs.push([1, 1, 1]);
        for (const [c1, c2, w] of outs) {
          if (c1 === 1 && c2 === 1) {
            if (j === 1) {
              rate[s] = rate[s]! + w * qSwap; // the stalled swap fires (odd round)
              P[s]![idx(0, 0, nb)] = P[s]![idx(0, 0, nb)]! + w;
            } else {
              P[s]![idx(1, 1, nb)] = P[s]![idx(1, 1, nb)]! + w; // stalled this round
            }
          } else {
            P[s]![idx(c1, c2, nb)] = P[s]![idx(c1, c2, nb)]! + w;
          }
        }
      }
    }
  }
  const pi = stationary(P);
  let r = 0;
  for (let s = 0; s < dim; s++) r += pi[s]! * rate[s]!;
  return { deliveryRate: r, stateCount: dim };
}

/** Stationary distribution of an irreducible finite chain via Gaussian elimination. */
function stationary(P: number[][]): number[] {
  const n = P.length;
  const A: number[][] = [];
  for (let c = 0; c < n; c++) {
    const row = new Array<number>(n + 1).fill(0);
    for (let r = 0; r < n; r++) row[r] = P[r]![c]! - (r === c ? 1 : 0);
    A.push(row);
  }
  A[n - 1] = new Array<number>(n + 1).fill(1);
  A[n - 1]![n] = 1;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(A[r]![col]!) > Math.abs(A[piv]![col]!)) piv = r;
    [A[col], A[piv]] = [A[piv]!, A[col]!];
    const d = A[col]![col]!;
    if (Math.abs(d) < 1e-14)
      throw new SchedError(
        "CONSERVATION_SINGULAR_CHAIN",
        `parityStallChain: not irreducible (pivot ~0 at column ${col})`,
      );
    for (let r = col + 1; r < n; r++) {
      const rowR = A[r]!;
      const f = rowR[col]! / d;
      if (f === 0) continue;
      const rowC = A[col]!;
      for (let c = col; c <= n; c++) rowR[c] = rowR[c]! - f * rowC[c]!;
    }
  }
  const pi = new Array<number>(n).fill(0);
  pi[n - 1] = A[n - 1]![n]! / A[n - 1]![n - 1]!;
  for (let r = n - 2; r >= 0; r--) {
    const row = A[r]!;
    let acc = row[n]!;
    for (let c = r + 1; c < n; c++) acc -= row[c]! * pi[c]!;
    pi[r] = acc / row[r]!;
  }
  return pi;
}

export interface JainFaceoffRow {
  readonly seed: number;
  readonly ersJain: number;
  readonly rrJain: number;
  readonly ersGoodput: number;
  readonly rrGoodput: number;
}

/**
 * The multi-request DATA face: on the six-node chain (5 links, 2 slots,
 * cutoff 6 to stay out of swap-asap's disclosed frozen-deadlock family —
 * hops 5 ∧ slots 2 ∧ qSwap 0.9), ERS's deficit arbitration against the
 * round-robin pointer (swap-asap's allocator), per seed.
 */
export function jainFaceoff(
  seeds: readonly number[],
  rounds: number,
): JainFaceoffRow[] {
  if (seeds.length === 0)
    throw new SchedError(
      "CONSERVATION_SEEDS",
      "jainFaceoff: the seed grid is empty",
    );
  if (!Number.isInteger(rounds) || rounds < 1)
    throw new SchedError(
      "CONSERVATION_ROUNDS",
      `rounds=${rounds} is not an integer >= 1`,
    );
  const nodes = Array.from({ length: 6 }, (_, i) => `n${i}`);
  const net: NetSpec = {
    nodes,
    links: Array.from({ length: 5 }, (_, i) => ({
      id: `l${i}`,
      a: `n${i}`,
      b: `n${i + 1}`,
      p: 0.4,
      slots: 2,
      f0: 0.99,
    })),
    qSwap: 0.9,
    cutOff: 6,
  };
  const requests: RequestSpec[] = [
    { id: "r1", src: "n0", dst: "n3", fMin: 0.8 },
    { id: "r2", src: "n2", dst: "n5", fMin: 0.8 },
    { id: "r3", src: "n0", dst: "n5", fMin: 0.8 },
  ];
  const topo = new Topology(net);
  return seeds.map((seed) => {
    const ers = runSim({
      net,
      requests,
      policy: ersPolicy(topo, requests),
      seed,
      rounds,
    });
    const rr = runSim({
      net,
      requests,
      policy: swapAsapPolicy(topo, requests),
      seed,
      rounds,
    });
    return {
      seed,
      ersJain: ers.aggregate.jain,
      rrJain: rr.aggregate.jain,
      ersGoodput: ers.aggregate.goodput,
      rrGoodput: rr.aggregate.goodput,
    };
  });
}
