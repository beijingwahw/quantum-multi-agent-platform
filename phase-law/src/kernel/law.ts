/**
 * PHASE-LAW — the coupled track's phase law, exact layer.
 *
 * The family (the bench's record family generalized over coupling strength):
 * m tasks × n agents (m ≤ n), weights w[t][a] = 0.15 + 0.7·r(seed) rounded,
 * ONE entangled agent pair (a0, a1): an assignment that uses BOTH gets a
 * bonus λ (every task pair (i,j) with i→a0, j→a1 carries λ — but capacity 1
 * means exactly one such pair fires, so):
 *
 *      W_λ(c) = W_0(c) + λ · I(c),   I(c) = 1 iff both a0 and a1 are used.
 *
 * THE ENVELOPE (the optimal-structure threshold, closed form):
 *      opt(λ) = max( U, C + λ ),  U = max uncoupled W_0,  C = max coupled W_0
 *      λ_opt* = max(0, U − C)   — above it the optimum itself is coupled.
 * Every claim below is machine-verified against complete enumeration;
 * the referee is always the enumeration, never a solver.
 */
import { makeRng } from "../core/rng.js";

export interface CoupledInstance {
  readonly m: number;
  readonly n: number;
  readonly seed: number;
  readonly lambda: number;
  readonly weights: readonly number[][];
}

// ---------------------------------------------------------------------------
// The family's weights — THE single source (v0.6.0). Every constructor
// (coupled v0.1, k-pair v0.4, non-uniform v0.5, staircase integers) draws
// this one matrix for a given (m, n, seed); the k=1-compatibility witnesses
// assert the bit-identity, so a second literal copy of the formula is
// forbidden — import it.
// ---------------------------------------------------------------------------

/** The weight law's constants: w = WEIGHT_MIN + WEIGHT_SPAN·r(seed), 3 decimals. */
export const WEIGHT_MIN = 0.15;
export const WEIGHT_SPAN = 0.7;

/** The shared 3-decimal weight matrix (the float face of the family). */
export function makeWeights(m: number, n: number, seed: number): number[][] {
  const r = makeRng(seed);
  return Array.from({ length: m }, () =>
    Array.from({ length: n }, () => Math.round((WEIGHT_MIN + WEIGHT_SPAN * r()) * 1000) / 1000),
  );
}

/** The SAME weights before the /1000 division — integer thousandths, exact
 * under summation (the staircase's referee arithmetic). */
export function makeIntegerWeights(m: number, n: number, seed: number): number[][] {
  const r = makeRng(seed);
  return Array.from({ length: m }, () =>
    Array.from({ length: n }, () => Math.round((WEIGHT_MIN + WEIGHT_SPAN * r()) * 1000)),
  );
}

export function makeInstance(m: number, n: number, seed: number, lambda: number): CoupledInstance {
  return { m, n, seed, lambda, weights: makeWeights(m, n, seed) };
}

export interface Assignment {
  readonly assignment: readonly number[]; // task -> agent, -1 impossible here (m ≤ n, all eligible)
  readonly usesBoth: boolean;
  readonly w0: number;
  readonly welfare: number; // w0 + lambda * usesBoth
}

/** Enumerate ALL P(n,m) assignments with welfares — the referee. */
export function enumerateAll(inst: CoupledInstance): Assignment[] {
  const out: Assignment[] = [];
  const current = new Array<number>(inst.m).fill(-1);
  const used = new Array<boolean>(inst.n).fill(false);
  const rec = (t: number, w0: number, used0: boolean, used1: boolean): void => {
    if (t === inst.m) {
      const usesBoth = used0 && used1;
      out.push({
        assignment: current.slice(),
        usesBoth,
        w0,
        welfare: w0 + (usesBoth ? inst.lambda : 0),
      });
      return;
    }
    for (let a = 0; a < inst.n; a++) {
      if (used[a]!) continue;
      used[a] = true;
      current[t] = a;
      rec(t + 1, w0 + inst.weights[t]![a]!, used0 || a === 0, used1 || a === 1);
      used[a] = false;
      current[t] = -1;
    }
  };
  rec(0, 0, false, false);
  return out;
}

export function optimumOf(inst: CoupledInstance): Assignment {
  let best: Assignment | undefined;
  for (const a of enumerateAll(inst)) {
    if (best === undefined || a.welfare > best.welfare) best = a;
  }
  if (best === undefined) throw new Error("empty assignment space");
  return best;
}

/** The envelope threshold λ_opt* = max(0, U − C), closed form. */
export function envelopeThreshold(inst: CoupledInstance): { lambdaStar: number; U: number; C: number } {
  let U = -Infinity;
  let C = -Infinity;
  for (const a of enumerateAll(inst)) {
    if (a.usesBoth) {
      if (a.w0 > C) C = a.w0;
    } else if (a.w0 > U) U = a.w0;
  }
  return { lambdaStar: Math.max(0, U - C), U, C };
}

// ---------------------------------------------------------------------------
// The heuristics (independent compact implementations; 对拍 vs enumeration
// in the test suite — the house rule: never trust a solver, test it).
// ---------------------------------------------------------------------------

/** Greedy: tasks in order, best free agent by WEIGHTS ONLY (coupling-blind). */
export function greedy(inst: CoupledInstance): number[] {
  const used = new Set<number>();
  const out = new Array<number>(inst.m).fill(-1);
  for (let t = 0; t < inst.m; t++) {
    let best = -1;
    let bestW = -Infinity;
    for (let a = 0; a < inst.n; a++) {
      if (used.has(a)) continue;
      if (inst.weights[t]![a]! > bestW) {
        bestW = inst.weights[t]![a]!;
        best = a;
      }
    }
    out[t] = best;
    used.add(best);
  }
  return out;
}

export function welfareOf(inst: CoupledInstance, assignment: readonly number[]): number {
  let w = 0;
  let used0 = false;
  let used1 = false;
  for (let t = 0; t < inst.m; t++) {
    const a = assignment[t]!;
    w += inst.weights[t]![a]!;
    if (a === 0) used0 = true;
    if (a === 1) used1 = true;
  }
  return w + (used0 && used1 ? inst.lambda : 0);
}

/** 1-exchange local search on the FULL λ-aware welfare, from a given start. */
export function localSearch(inst: CoupledInstance, start: readonly number[]): number[] {
  const current = start.slice();
  for (;;) {
    let bestGain = 0;
    let bestT = -1;
    let bestA = -1;
    for (let t = 0; t < inst.m; t++) {
      for (let a = 0; a < inst.n; a++) {
        if (a === current[t] || current.includes(a)) continue;
        const cand = current.slice();
        cand[t] = a;
        const gain = welfareOf(inst, cand) - welfareOf(inst, current);
        if (gain > bestGain + 1e-12) {
          bestGain = gain;
          bestT = t;
          bestA = a;
        }
      }
    }
    if (bestT < 0) return current;
    current[bestT] = bestA;
  }
}

/** Simulated annealing (compact; greedy start, reassignment neighbors, best-ever). */
export function anneal(inst: CoupledInstance, seed: number, iterations = 4000): number[] {
  const m = inst.m;
  const n = inst.n;
  const rng = makeRng(seed);
  const current = greedy(inst);
  const used = new Set<number>(current);
  let best = current.slice();
  let bestW = welfareOf(inst, best);
  let curW = bestW;
  const T0 = 0.3;
  const cooling = Math.pow(0.001 / T0, 1 / Math.max(1, iterations));
  for (let it = 0; it < iterations; it++) {
    const T = T0 * Math.pow(cooling, it);
    const t = Math.floor(rng() * m);
    const from = current[t]!;
    const to = Math.floor(rng() * n);
    if (used.has(to)) continue;
    current[t] = to;
    used.delete(from);
    used.add(to);
    const w = welfareOf(inst, current);
    const dW = w - curW;
    if (dW >= 0 || rng() < Math.exp(dW / Math.max(T, 1e-12))) {
      curW = w;
      if (w > bestW) {
        bestW = w;
        best = current.slice();
      }
    } else {
      current[t] = from;
      used.delete(to);
      used.add(from);
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The 2×n LS-threshold theorem (v0.2.0): the exact λ at which local search
// from greedy first misses the optimum, as a CLOSED FORM. At m = 2 every
// welfare difference between assignments is linear in λ with a breakpoint
// at −a/b — so LS's entire trajectory is piecewise-constant across finitely
// many λ-intervals, and the threshold is the leftmost interval where the
// LS endpoint ≠ the optimum. Computed exactly from the breakpoints; verified
// against a fine grid sweep (deviation must be 0).
// ---------------------------------------------------------------------------

/** All λ breakpoints of pairwise welfare differences (finite, exact for m=2). */
export function breakpoints2xn(inst: CoupledInstance): number[] {
  if (inst.m !== 2) throw new Error("breakpoints2xn is a 2-task theorem — wrong object");
  const zero = makeInstance(inst.m, inst.n, inst.seed, 0);
  const all = enumerateAll(zero);
  const out = new Set<number>();
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!;
      const b = all[j]!;
      // W_a(λ) − W_b(λ) = (a.w0 − b.w0) + λ(a.I − b.I)
      const da = a.w0 - b.w0;
      const db = (a.usesBoth ? 1 : 0) - (b.usesBoth ? 1 : 0);
      if (db !== 0) {
        const x = -da / db;
        if (x > 1e-12) out.add(x);
      }
    }
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * The closed-form LS threshold for a 2×n instance: the smallest λ ≥ 0 at
 * which local-search-from-greedy misses the enumerated optimum, computed on
 * the breakpoint partition (evaluate each open interval at its midpoint —
 * the trajectory is constant there by construction); Infinity if LS never
 * misses. Returns the threshold and the witness interval count.
 */
export function lsThreshold2xn(inst: CoupledInstance): { lambdaStar: number; intervals: number } {
  const bps = [0, ...breakpoints2xn(inst)];
  const intervals: Array<[number, number]> = [];
  for (let i = 0; i < bps.length; i++) {
    const lo = bps[i]!;
    const hi = i + 1 < bps.length ? bps[i + 1]! : Number.POSITIVE_INFINITY;
    intervals.push([lo, hi]);
  }
  for (const [lo, hi] of intervals) {
    const probe = hi === Number.POSITIVE_INFINITY ? lo + 1 : (lo + hi) / 2;
    const probeInst = makeInstance(inst.m, inst.n, inst.seed, probe);
    const opt = optimumOf(probeInst).welfare;
    const lsW = welfareOf(probeInst, localSearch(probeInst, greedy(probeInst)));
    if (Math.abs(lsW - opt) > 1e-9) {
      // the miss begins at this interval's left edge (or 0)
      return { lambdaStar: lo, intervals: intervals.length };
    }
  }
  return { lambdaStar: Number.POSITIVE_INFINITY, intervals: intervals.length };
}

// ---------------------------------------------------------------------------
// v0.3.0 — the coupled-regime DECOMPOSITION (the island's right face):
// for λ > λ_opt* (the envelope hinge) every optimal assignment uses BOTH
// entangled agents, so the optimum decomposes:
//   opt(λ) = max over ordered pairs (i→a0, j→a1) of  w_i(a0) + w_j(a1) + λ
//            + maxWeightMatching(remaining tasks × remaining agents)
// — n² candidate pairs, each matched in O(m³): a POLYNOMIAL algorithm for
// the entire coupled regime. Theorem machine-verified against enumeration.
// ---------------------------------------------------------------------------

/** Max-weight bipartite matching by plain Hungarian (m ≤ n), compact. */
export function hungarianMax(weights: readonly number[][]): number[] {
  const m = weights.length;
  const n = weights[0]?.length ?? 0;
  if (m === 0) return [];
  if (m > n) throw new Error("hungarianMax requires tasks <= agents");
  // min-cost on −w; classic O(m²n) potentials form
  const cost = weights.map((row) => row.map((w) => -w));
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array<number>(m + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(INF);
    const used = new Array<boolean>(n + 1).fill(false);
    for (;;) {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (used[j]!) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]!) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }
      j0 = j1;
      if (p[j0]! === 0) break;
    }
    for (;;) {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
      if (j0 === 0) break;
    }
  }
  const assignment = new Array<number>(m).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j]! > 0) assignment[p[j]! - 1] = j - 1;
  }
  return assignment;
}

/** The decomposition optimum for the coupled regime (λ > λ_opt*). */
export function coupledRegimeOptimum(inst: CoupledInstance): number {
  const { m, n, weights, lambda } = inst;
  let best = -Infinity;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      if (i === j) continue;
      // tasks i→a0, j→a1; match the rest over the remaining agents
      const restTasks: number[] = [];
      for (let t = 0; t < m; t++) if (t !== i && t !== j) restTasks.push(t);
      const restAgents: number[] = [];
      for (let a = 0; a < n; a++) if (a !== 0 && a !== 1) restAgents.push(a);
      const sub: number[][] = restTasks.map((t) => restAgents.map((a) => weights[t]![a]!));
      const match = hungarianMax(sub);
      let w = weights[i]![0]! + weights[j]![1]! + lambda;
      restTasks.forEach((_t, idx) => {
        const a = match[idx]!;
        w += sub[idx]![a]!;
      });
      if (w > best) best = w;
    }
  }
  return best;
}

/** The coupled-regime theorem check: decomposition === enumeration for λ > λ_opt*. */
export function coupledRegimeDeviation(inst: CoupledInstance): number {
  const { lambdaStar } = envelopeThreshold(makeInstance(inst.m, inst.n, inst.seed, 0));
  if (inst.lambda <= lambdaStar + 1e-12) {
    throw new Error("coupledRegimeDeviation is a theorem for the COUPLED regime — λ above the hinge");
  }
  return Math.abs(coupledRegimeOptimum(inst) - optimumOf(inst).welfare);
}

// ---------------------------------------------------------------------------
// v0.4.0 — the DENSITY AXIS (k entangled pairs): the family generalizes to
// k disjoint pairs (a_{2i}, a_{2i+1}), bonus λ per REALIZED pair, and
// I(c) becomes the realized-pair COUNT in {0..k}:
//      W_λ(c) = W_0(c) + λ · realizedPairs(c)
//   opt(λ) = max_j ( C_j + jλ ),  C_j = max W_0 over assignments realizing j pairs
// — the upper envelope of k+1 lines. THEOREM (machine-proved): the optimum's
// realized count is a NONDECREASING step function of λ; the breakpoints are
// crossings of consecutive envelope lines. k = 1 reproduces the v0.1 family
// exactly (I ∈ {0,1}, the same weights, the same bonuses).
// ---------------------------------------------------------------------------

export interface KPairInstance {
  readonly m: number;
  readonly n: number;
  readonly seed: number;
  readonly lambda: number;
  readonly k: number; // entangled pairs: (a0,a1), (a2,a3), ...
  readonly weights: readonly number[][];
}

export function makeKPairInstance(m: number, n: number, seed: number, lambda: number, k: number): KPairInstance {
  return { m, n, seed, lambda, k, weights: makeWeights(m, n, seed) };
}

export interface KPairAssignment {
  readonly assignment: readonly number[];
  readonly pairs: number; // realized pair count
  readonly w0: number;
  readonly welfare: number;
}

/** Enumerate ALL assignments with realized-pair counts — the k-pair referee.
 * A pair is REALIZED iff BOTH its agents are used (the v0.1 semantics). */
export function enumerateKPair(inst: KPairInstance): KPairAssignment[] {
  const out: KPairAssignment[] = [];
  const current = new Array<number>(inst.m).fill(-1);
  const used = new Array<boolean>(inst.n).fill(false);
  const rec = (t: number, w0: number): void => {
    if (t === inst.m) {
      let pairs = 0;
      for (let i = 0; i < inst.k; i++) {
        if (current.includes(2 * i) && current.includes(2 * i + 1)) pairs++;
      }
      out.push({ assignment: current.slice(), pairs, w0, welfare: w0 + pairs * inst.lambda });
      return;
    }
    for (let a = 0; a < inst.n; a++) {
      if (used[a]!) continue;
      used[a] = true;
      current[t] = a;
      rec(t + 1, w0 + inst.weights[t]![a]!);
      used[a] = false;
      current[t] = -1;
    }
  };
  rec(0, 0);
  return out;
}

export function kPairOptimum(inst: KPairInstance): KPairAssignment {
  let best: KPairAssignment | undefined;
  for (const a of enumerateKPair(inst)) {
    if (best === undefined || a.welfare > best.welfare) best = a;
  }
  if (best === undefined) throw new Error("empty assignment space");
  return best;
}

/** The envelope data: C_j for j = 0..k (exact, by enumeration). */
export function kPairEnvelope(inst: KPairInstance): { c: readonly number[] } {
  const c = new Array<number>(inst.k + 1).fill(-Infinity);
  for (const a of enumerateKPair({ ...inst, lambda: 0 })) {
    if (a.w0 > c[a.pairs]!) c[a.pairs] = a.w0;
  }
  return { c };
}

/**
 * THE MONOTONE-COUNT THEOREM check: the enumerated optimum's realized-pair
 * count must be nondecreasing in λ over a grid — and must equal argmax_j
 * (C_j + jλ) at every point. Returns the worst violation of either.
 */
export function kPairMonotoneDeviation(
  m: number,
  n: number,
  seed: number,
  k: number,
  lambdas: readonly number[],
): { worstMonotoneStep: number; worstArgmaxMismatch: number } {
  const { c } = kPairEnvelope(makeKPairInstance(m, n, seed, 0, k));
  let worstStep = 0;
  let worstMismatch = 0;
  let prevPairs = 0;
  for (const lambda of lambdas) {
    const inst = makeKPairInstance(m, n, seed, lambda, k);
    const opt = kPairOptimum(inst);
    let argmax = 0;
    let bestV = -Infinity;
    for (let j = 0; j <= k; j++) {
      const v = c[j]! + j * lambda;
      if (v > bestV) {
        bestV = v;
        argmax = j;
      }
    }
    worstMismatch = Math.max(worstMismatch, Math.abs(opt.pairs - argmax));
    if (lambda > 0) worstStep = Math.max(worstStep, prevPairs - opt.pairs);
    prevPairs = opt.pairs;
  }
  return { worstMonotoneStep: worstStep, worstArgmaxMismatch: worstMismatch };
}

/**
 * The RIGHT FACE (all-k regime): for λ above the last breakpoint the optimum
 * realizes ALL k pairs — computable in POLYNOMIAL time by assigning tasks to
 * the 2k labeled pair slots (Hungarian over the task×slot matrix) plus a
 * Hungarian matching of the remaining tasks. Exact; verified against
 * enumeration above the hinge.
 */
export function kPairAllRegimeOptimum(inst: KPairInstance): number {
  const { m, n, weights, k, lambda } = inst;
  // slot matrix: task t, slot s (agent index 0..2k-1) → weight w[t][s]
  const slotMatrix = Array.from({ length: m }, (_, t) =>
    Array.from({ length: 2 * k }, (_, s) => weights[t]![s]!),
  );
  const slotAssign = hungarianMax(slotMatrix);
  const chosen: number[] = [];
  let slotW = 0;
  for (let t = 0; t < m; t++) {
    const s = slotAssign[t]!;
    if (s >= 0) {
      chosen.push(t);
      slotW += weights[t]![s]!;
    }
  }
  if (chosen.length !== 2 * k) {
    throw new Error("all-k regime requires m >= 2k — wrong object");
  }
  // the remaining tasks over the remaining agents
  const restAgents: number[] = [];
  for (let a = 2 * k; a < n; a++) restAgents.push(a);
  const restTasks: number[] = [];
  const chosenSet = new Set(chosen);
  for (let t = 0; t < m; t++) if (!chosenSet.has(t)) restTasks.push(t);
  const sub: number[][] = restTasks.map((t) => restAgents.map((a) => weights[t]![a]!));
  const match = hungarianMax(sub);
  let w = slotW + k * lambda;
  restTasks.forEach((_t, idx) => {
    const a = match[idx]!;
    w += sub[idx]![a]!;
  });
  return w;
}

// ---------------------------------------------------------------------------
// The landscape layer (P4): local optima and basin fractions, EXACTLY, on
// the enumerated assignment space with the 1-exchange neighborhood.
// ---------------------------------------------------------------------------

export interface LandscapeStats {
  readonly nodes: number;
  readonly localOptima: number;
  readonly globalIsLocalOptimum: boolean;
  /** fraction of nodes whose steepest 1-exchange descent reaches the GLOBAL */
  readonly globalBasinFraction: number;
}

export function landscapeStats(inst: CoupledInstance): LandscapeStats {
  const all = enumerateAll(inst);
  const index = new Map<string, number>();
  all.forEach((a, i) => index.set(a.assignment.join(","), i));
  let localOptima = 0;
  let globalIdx = 0;
  all.forEach((a, i) => {
    if (a.welfare > all[globalIdx]!.welfare) globalIdx = i;
  });
  const globalKey = all[globalIdx]!.assignment.join(",");
  const betterNeighbor = new Array<number>(all.length).fill(-1); // steepest target or -1
  all.forEach((a, i) => {
    let bestGain = 0;
    let bestTarget = -1;
    for (let t = 0; t < inst.m; t++) {
      for (let a2 = 0; a2 < inst.n; a2++) {
        if (a2 === a.assignment[t] || a.assignment.includes(a2)) continue;
        const cand = a.assignment.slice();
        cand[t] = a2;
        const j = index.get(cand.join(","));
        if (j === undefined) continue;
        const gain = all[j]!.welfare - a.welfare;
        if (gain > bestGain + 1e-12) {
          bestGain = gain;
          bestTarget = j;
        }
      }
    }
    betterNeighbor[i] = bestTarget;
    if (bestTarget === -1) localOptima++;
  });
  // steepest-descent basin of the global optimum
  let basin = 0;
  for (let i = 0; i < all.length; i++) {
    let cur = i;
    for (let guard = 0; guard < all.length + 1; guard++) {
      if (all[cur]!.assignment.join(",") === globalKey) {
        basin++;
        break;
      }
      const next = betterNeighbor[cur]!;
      if (next === -1) break;
      cur = next;
    }
  }
  return {
    nodes: all.length,
    localOptima,
    globalIsLocalOptimum: betterNeighbor[globalIdx] === -1,
    globalBasinFraction: basin / all.length,
  };
}
