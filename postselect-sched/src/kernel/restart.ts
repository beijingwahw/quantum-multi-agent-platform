/**
 * T2 kernel — restart algebra (Luby-Sinclair-Zuckerman layer).
 *
 * The visitor's many-worlds sorter is, at k=0, a Las Vegas machine: each
 * attempt costs one oracle query and succeeds with probability t/N. LSZ93
 * proved — pen and paper — that for such machines (a) the optimal strategy
 * restarts at a FIXED cutoff, (b) no probabilistic or mixed strategy beats it,
 * and (c) the universal doubling sequence stays within (19/2) lambda* (log2
 * lambda* + 5). This kernel executes that theory: every identity is computed
 * on two independent arithmetic paths and must agree to machine precision.
 *
 * Two cost models, kept explicit and separate:
 *   EARLY-STOP  (LSZ model): a run that would have stopped at time u < t only
 *               charges u — partial progress is credited. lambda(t) is the
 *               expected cost of the fixed-cutoff-t strategy.
 *   ALWAYS-PAY  (coherent rounds): an amplified round is mid-circuit and
 *               cannot be inspected without destroying the amplification, so
 *               the full cutoff price is paid every round. The fixed-cutoff
 *               objective is L(t) = t/q(t) (LSZ's L-function).
 * At cutoff 1 the two models coincide — which is exactly the pure sorter.
 */

/** p[u] = Pr[T = u] for u = 1..H; p[0] is padding. Finite support. */
export type Dist = readonly number[];

export function qOf(p: Dist, t: number): number {
  let s = 0;
  const hi = Math.min(t, p.length - 1);
  for (let u = 1; u <= hi; u++) s += p[u] as number;
  return s;
}

/** LSZ lambda(t): expected cost of the fixed-cutoff-t strategy with
 *  early-stop credit = E[min(T,t)]/q(t), written in the deficit form
 *  (t - sum_{u<t} (t-u) p(u))/q(t). This is a SECOND arithmetic path relative
 *  to expectMin's accumulation form — the two must agree to machine
 *  precision. NOTE: the author-preprint PDF's formula for lambda(t) came
 *  through our OCR sign-garbled (it violated the paper's own lambda <= L
 *  lemma on a two-point example); the executed definition below is the direct
 *  renewal semantics, hand-verified on that example and machine-verified
 *  against the renewal sum. */
export function lambdaClosed(p: Dist, t: number): number {
  const q = qOf(p, t);
  if (q <= 0) return Number.POSITIVE_INFINITY;
  let deficit = 0;
  for (let u = 1; u < t; u++) deficit += (t - u) * (p[u] as number);
  return (t - deficit) / q;
}

/** LSZ L(t) = t/q(t) — the always-pay fixed-cutoff objective */
export function payClosed(p: Dist, t: number): number {
  const q = qOf(p, t);
  if (q <= 0) return Number.POSITIVE_INFINITY;
  return t / q;
}

export interface StarResult {
  readonly value: number;
  readonly t: number;
}

export function lambdaStar(p: Dist): StarResult {
  let best = Number.POSITIVE_INFINITY;
  let bestT = 1;
  for (let t = 1; t < p.length; t++) {
    const v = lambdaClosed(p, t);
    if (v < best) {
      best = v;
      bestT = t;
    }
  }
  return { value: best, t: bestT };
}

export function payStar(p: Dist): StarResult {
  let best = Number.POSITIVE_INFINITY;
  let bestT = 1;
  for (let t = 1; t < p.length; t++) {
    const v = payClosed(p, t);
    if (v < best) {
      best = v;
      bestT = t;
    }
  }
  return { value: best, t: bestT };
}

/** E[min(T, t)] under p */
function expectMin(p: Dist, t: number): number {
  let e = 0;
  const hi = Math.min(t, p.length - 1);
  for (let u = 1; u <= hi; u++) e += u * (p[u] as number);
  let tail = 0;
  for (let u = t + 1; u < p.length; u++) tail += p[u] as number;
  return e + t * tail;
}

/** A strategy: run cutoffs prefix[0], prefix[1], ... then CYCLE the prefix
 *  forever (LSZ strategies are infinite periodic sequences; a length-1
 *  prefix is the fixed-cutoff strategy). */
export interface Strategy {
  readonly prefix: readonly number[];
}

/** Renewal-sum path for T(S) in the early-stop model:
 *  T = sum_i R_i E[min(T, t_i)], R_i = prod_{j<i} (1 - q(t_j)), t_i cycling.
 *  Truncated once R < 1e-18; the omitted remainder is at most
 *  R * max(lambda) and stays below 1e-12 for every distribution used. */
export function renewalEarlyStop(p: Dist, s: Strategy): number {
  if (s.prefix.length === 0) throw new Error("renewalEarlyStop: empty prefix");
  let T = 0;
  let R = 1;
  let i = 0;
  let guard = 0;
  while (R > 1e-18) {
    const t = s.prefix[i % s.prefix.length] as number;
    T += R * expectMin(p, t);
    R *= 1 - qOf(p, t);
    i++;
    if (++guard > 1_000_000) throw new Error("renewalEarlyStop: cycle never succeeds");
  }
  return T;
}

export interface ConvexDecomposition {
  readonly T: number;
  /** sum_i g_i — telescopes to 1 - lim R, so 1 - sum g certifies the tail */
  readonly gSum: number;
  /** sum_i g_i lambda(t_i) — must equal T (LSZ93 eq. (7) identity) */
  readonly weightedLambdas: number;
  readonly deviation: number;
}

/** LSZ93 identity (7): T(S) = sum_i g_i lambda(t_i) with g_i = R_i q(t_i) >= 0,
 *  sum g_i = 1 — every strategy is a convex combination of fixed-cutoff
 *  expectations. This is the algebraic root of "no strategy beats the best
 *  fixed cutoff", here verified on a third arithmetic path. */
export function convexDecomposition(p: Dist, s: Strategy): ConvexDecomposition {
  if (s.prefix.length === 0) throw new Error("convexDecomposition: empty prefix");
  let R = 1;
  let gSum = 0;
  let weighted = 0;
  let i = 0;
  let guard = 0;
  while (R > 1e-18) {
    const t = s.prefix[i % s.prefix.length] as number;
    const g = R * qOf(p, t);
    gSum += g;
    weighted += g * lambdaClosed(p, t);
    R *= 1 - qOf(p, t);
    i++;
    if (++guard > 1_000_000) throw new Error("convexDecomposition: cycle never succeeds");
  }
  const T = renewalEarlyStop(p, s);
  return { T, gSum, weightedLambdas: weighted, deviation: Math.abs(weighted - T) };
}

/**
 * Memoized fast evaluator: precomputes q(t) and E[min(T,t)] per distinct
 * cutoff, then evaluates strategies in O(1) per round. Must agree with the
 * plain paths to 1e-12 (asserted in tests) — it is a speedup, not a second
 * model.
 */
export interface FastRenewal {
  readonly T: (s: Strategy) => number;
  readonly convexDev: (s: Strategy) => number;
  readonly gSum: (s: Strategy) => number;
}

export function makeFastRenewal(p: Dist, cutoffs: readonly number[]): FastRenewal {
  const qTab = new Map<number, number>();
  const eTab = new Map<number, number>();
  for (const t of cutoffs) {
    qTab.set(t, qOf(p, t));
    eTab.set(t, expectMin(p, t));
  }
  const evaluate = (s: Strategy): { T: number; gSum: number; weighted: number } => {
    if (s.prefix.length === 0) throw new Error("makeFastRenewal: empty prefix");
    let T = 0;
    let R = 1;
    let gSum = 0;
    let weighted = 0;
    let i = 0;
    let guard = 0;
    while (R > 1e-18) {
      const t = s.prefix[i % s.prefix.length] as number;
      const q = qTab.get(t);
      const e = eTab.get(t);
      if (q === undefined || e === undefined) throw new Error(`makeFastRenewal: cutoff ${t} not precomputed`);
      T += R * e;
      const g = R * q;
      gSum += g;
      weighted += g * lambdaClosed(p, t);
      R *= 1 - q;
      i++;
      if (++guard > 1_000_000) throw new Error("makeFastRenewal: cycle never succeeds");
    }
    return { T, gSum, weighted };
  };
  return {
    T: (s) => evaluate(s).T,
    convexDev: (s) => {
      const r = evaluate(s);
      return Math.abs(r.weighted - r.T);
    },
    gSum: (s) => evaluate(s).gSum,
  };
}

// ---------------------------------------------------------------------------
// ALWAYS-PAY model: rounds have (cost c_i, success prob p_i) with no
// early-stop credit. Expected total = sum_i R_i c_i.
// ---------------------------------------------------------------------------

/** Rounds with (cost c_i, success prob p_i), executed in the given order and
 *  then CYCLING forever, no early-stop credit. Expected total = sum_i R_i c_i
 *  over the infinite cyclic schedule, truncated at R < 1e-18. */
export function payExpected(costs: readonly number[], probs: readonly number[], order: readonly number[]): number {
  if (order.length === 0) throw new Error("payExpected: empty order");
  let T = 0;
  let R = 1;
  let i = 0;
  let guard = 0;
  while (R > 1e-18) {
    const idx = order[i % order.length] as number;
    const c = costs[idx] as number;
    const p = probs[idx] as number;
    if (!(p > 0) || !(p <= 1)) throw new Error("payExpected: probs in (0,1]");
    T += R * c;
    R *= 1 - p;
    i++;
    if (++guard > 1_000_000) throw new Error("payExpected: cycle never succeeds");
  }
  return T;
}

export function payStarMenu(costs: readonly number[], probs: readonly number[]): StarResult {
  let best = Number.POSITIVE_INFINITY;
  let idx = 0;
  for (let i = 0; i < costs.length; i++) {
    const p = probs[i] as number;
    if (!(p > 0)) continue;
    const e = (costs[i] as number) / p;
    if (e < best) {
      best = e;
      idx = i;
    }
  }
  return { value: best, t: idx };
}

// ---------------------------------------------------------------------------
// The universal doubling strategy S_univ = 1,1,2,1,1,2,4,...
// built by S_k = S_{k-1} ++ S_{k-1} ++ [2^(k-1)] (LSZ93 sec. 3).
// ---------------------------------------------------------------------------

export function lubyUniversal(depth: number): number[] {
  let s: number[] = [1];
  for (let k = 2; k <= depth; k++) {
    s = [...s, ...s, 2 ** (k - 1)];
  }
  return s;
}

// ---------------------------------------------------------------------------
// Grover curves — closed form vs iterated 2D evolution (two-path referee).
// ---------------------------------------------------------------------------

export function groverTheta(N: number, t: number): number {
  return Math.asin(Math.sqrt(t / N));
}

/** p_k = sin^2((2k+1) theta), sin^2 theta = t/N (DH96 / BBHT98 lineage) */
export function groverPClosed(N: number, t: number, k: number): number {
  const a = (2 * k + 1) * groverTheta(N, t);
  return Math.sin(a) ** 2;
}

/** Independent path: explicit 2x2 matrix iteration. In span{|w>, |r>} the
 *  Grover iterate is the rotation [[cos 2th, sin 2th], [-sin 2th, cos 2th]]
 *  acting on (sin th, cos th); p_k = (w-component)^2 after k steps. */
export function groverPIterated(N: number, t: number, k: number): number {
  const th = groverTheta(N, t);
  const c2 = Math.cos(2 * th);
  const s2 = Math.sin(2 * th);
  let w = Math.sin(th);
  let r = Math.cos(th);
  for (let i = 0; i < k; i++) {
    const w2 = c2 * w + s2 * r;
    const r2 = -s2 * w + c2 * r;
    w = w2;
    r = r2;
  }
  return w * w;
}

export interface EStarResult {
  /** min_k (k+1)/p_k at the certain-answer standard */
  readonly queries: number;
  readonly k: number;
  /** pure sorter ledger = 1/p_0 = N/t */
  readonly ledger: number;
  readonly ratio: number;
}

export function eStarGrover(N: number, t: number): EStarResult {
  const theta = groverTheta(N, t);
  const hi = Math.ceil(Math.PI / (4 * theta)) + 3;
  let best = Number.POSITIVE_INFINITY;
  let bestK = 0;
  for (let k = 0; k <= hi; k++) {
    const p = groverPClosed(N, t, k);
    if (p <= 0) continue;
    const e = (k + 1) / p;
    if (e < best) {
      best = e;
      bestK = k;
    }
  }
  const ledger = N / t;
  return { queries: best, k: bestK, ledger, ratio: ledger / best };
}

/** Is the pure sorter (k=0) restart-optimal for this (N,t)? True iff
 *  p_k <= (k+1) p_0 for every k — checked numerically over the full k range. */
export function zeroOptimal(N: number, t: number): boolean {
  const theta = groverTheta(N, t);
  const hi = Math.ceil(Math.PI / (4 * theta)) + 3;
  const p0 = groverPClosed(N, t, 0);
  for (let k = 1; k <= hi; k++) {
    const p = groverPClosed(N, t, k);
    if (p > (k + 1) * p0 + 1e-15) return false;
  }
  return true;
}

/** The asymptotic binding constraint comes from k=1: p_1 > 2 p_0 iff
 *  sin^2(3th) > 2 sin^2(th) iff (3 - 4s^2)^2 > 2 iff s^2 < (3-sqrt(2))/4. */
export const ZERO_OPTIMAL_DENSITY_LIMIT = (3 - Math.SQRT2) / 4;

// ---------------------------------------------------------------------------
// Distribution generators for the universal-strategy families.
// ---------------------------------------------------------------------------

/** truncated geometric on {1..H}: Pr[T=u] proportional to (1-r)^(u-1) */
export function geometricDist(H: number, r: number): number[] {
  const p = new Array<number>(H + 1).fill(0);
  let s = 0;
  for (let u = 1; u <= H; u++) {
    p[u] = (1 - r) ** (u - 1) * r;
    s += p[u] as number;
  }
  for (let u = 1; u <= H; u++) p[u] = (p[u] as number) / s;
  return p;
}

/** power-law tail Pr[T=u] proportional to u^(-alpha) on {1..H} */
export function powerLawDist(H: number, alpha: number): number[] {
  const p = new Array<number>(H + 1).fill(0);
  let s = 0;
  for (let u = 1; u <= H; u++) {
    p[u] = u ** -alpha;
    s += p[u] as number;
  }
  for (let u = 1; u <= H; u++) p[u] = (p[u] as number) / s;
  return p;
}

/** bimodal delta mixture at 1 and 100 — the case where restarting helps most */
export function bimodalDist(): number[] {
  const p = new Array<number>(101).fill(0);
  p[1] = 0.8;
  p[100] = 0.2;
  return p;
}

/** classical first-mark position scanning addresses 0..N-1 in order (t marks):
 *  Pr[T=u] = t/N for u <= N-t+1 window handled by hypergeometric exhaustion;
 *  exact form: P(first mark at u) = (N-t choose u-1)/(N choose u-1) * t/(N-u+1) */
export function firstMarkDist(N: number, t: number): number[] {
  const p = new Array<number>(N + 1).fill(0);
  // probability all of the first u-1 addresses are unmarked:
  let noMark = 1;
  for (let u = 1; u <= N - t + 1; u++) {
    const hit = (noMark * t) / (N - u + 1);
    p[u] = hit;
    noMark *= 1 - t / (N - u + 1);
  }
  return p;
}
