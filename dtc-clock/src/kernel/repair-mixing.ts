/**
 * THE REPAIRED CHAIN'S DOBRUSHIN CERTIFICATE — the R21 zero-ripple addition
 * (no version bump; the registration face is this header and the tests).
 *
 * THE CHAIN (v0.6.0/v0.8.0's tie-reset repair, stated as a kernel): one
 * period is NOISE THEN REPAIR — from popcount w each of the n bits flips
 * independently with probability p (the delocalized fire), then the majority
 * repair folds the result,
 *     fold(v) = v           if v < n/2,
 *             = 0           if v = n/2 (the even-n tie reset),
 *             = n - v       if v > n/2,
 * so the repaired chain lives on the folded states {0..floor((n-1)/2)} for
 * odd n and {0..n/2-1} for even n, with kernel
 *     K(x,y) = sum_{v: fold(v)=y} C(n-x,a) C(x,b) p^(a+b) (1-p)^(n-a-b)
 *            [a - b = v - x].
 *
 * THE THEOREM (four machine-executed claims, as the machine adjudicated
 * them — the R18 spec's adjacent-pair form is REFUTED, see M1):
 *   (M1) THE DOBRUSHIN COEFFICIENT IS THE PAIRWISE MAXIMUM of exact
 *        finite binomial sums, beta = max_{x != x'} TV(K(x,.), K(x',.)) —
 *        NOT the adjacent-pair maximum the spec proposed: the fold is not
 *        monotone, and on the whole probed grid the worst pair is the
 *        EXTREME pair (0 vs the top state), adjacent max strictly below.
 *        The binomial tail road — max over y of the folded-CDF difference,
 *        F_x(y) = P(v <= y) + P(v >= n-y) + [even n] P(v = n/2), a finite
 *        sum of binomial tails — EQUALS the direct road for every pair at
 *        odd n (the PMF difference single-crosses there), while at even n
 *        the tie fold breaks single-crossing at interior p: the tail road
 *        is then a strict lower bound, the deviation named on the grid.
 *   (M2) STRICT UNIFORM ERGODICITY: beta < 1 for EVERY noise rate in (0,1)
 *        — analytically, every pair of rows shares mass: K(x, x) >= (1-p)^n
 *        (the zero-flip path folds x to itself) and every entry is at least
 *        min(p,1-p)^n, so TV(K(x,.),K(x',.)) <= 1 - min(p,1-p)^n < 1; the
 *        machine pins the minimum pairwise common mass positive and equal
 *        to 1 - beta on the grid (the worst pair is the common-mass
 *        minimizer — TV = 1 - sum_y min is exact). AT THE SYMMETRIC POINT
 *        p = 1/2 the coefficient degenerates to beta = 0 EXACTLY — each
 *        period is a fresh fair draw, every row IS the folded Bin(n,1/2),
 *        and the chain is stationary after ONE step (the instant-mixing
 *        face, machine-pinned, not an approximation).
 *   (M3) THE MIXING BOUND at the PAIRWISE beta: ||mu_0 K^t - pi||_TV <=
 *        beta^t (the Dobrushin contraction applies to the signed difference
 *        mu_0 - pi as well), so t_mix(eps) <= ceil(ln(1/eps)/ln(1/beta));
 *        the DP from delta_0 is pinned against the bound step by step —
 *        every per-period ratio <= beta (at the float floor), and the TV at
 *        the bound's own step count is <= eps.
 *   (M4) THE NEGATIVE CONTROL: the UNREPAIRED strict-armor block kernel is
 *        substochastic (mass leaks to the absorbing set every period), so
 *        the same certificate machinery must REFUSE it — a named E/DOMAIN
 *        refusal, not a silent certificate over a chain with no stationary
 *        distribution.
 *
 * Honest boundaries: the mixing count is an upper bound, not the exact
 * spectral mixing time; beta is the Dobrushin coefficient, known to be
 * conservative — the DP's measured per-step ratios are reported alongside
 * (the conservatism factor is DATA, not claimed tight). The tail road's
 * equality with the direct road is a single-crossing claim verified on the
 * probed grid (exact at odd n, deviating at even n), not proven for all
 * (n,p); the adjacent form's refutation is likewise grid-verified.
 *
 * Literature shape (both pending dual sourcing): Dobrushin-1956, "On the
 * central limit theorem for Markov chains" / the coupling-coefficient
 * tradition (the coefficient and the contraction lemma) [dual-source
 * pending]; Levin-Peres-2017, "Markov Chains and Mixing Times" (the
 * t_mix <= ln(1/eps)/ln(1/beta) skeleton) [dual-source pending].
 */
import { DtcError } from "../core/errors.js";

/** The majority fold: v -> min(v, n-v) with the even-n tie reset to 0. */
export function foldIndex(n: number, v: number): number {
  if (v < 0 || v > n)
    throw new DtcError("E/DOMAIN", `foldIndex: v in 0..n required, got ${v}`);
  return v === n / 2 ? 0 : Math.min(v, n - v);
}

/** The repaired chain's state count: n/2 (even n), (n+1)/2 (odd n). */
export function repairedStateCount(n: number): number {
  if (n < 2)
    throw new DtcError(
      "E/DOMAIN",
      `repairedStateCount: n >= 2 required, got ${n}`,
    );
  return n % 2 === 0 ? n / 2 : (n + 1) / 2;
}

/** The one-period noise law from popcount w, over destinations v = 0..n
 * (exact closed form: products of binomial rows and pow tables). */
export function noiseRowFull(n: number, p: number, w: number): Float64Array {
  const bin: number[][] = Array.from({ length: n + 1 }, (_, m) => {
    const row: number[] = [1];
    for (let i = 1; i <= m; i++) row[i] = (row[i - 1]! * (m - i + 1)) / i;
    return row;
  });
  const powP = new Float64Array(n + 1);
  const powQ = new Float64Array(n + 1);
  for (let e = 0; e <= n; e++) {
    powP[e] = Math.pow(p, e);
    powQ[e] = Math.pow(1 - p, e);
  }
  const out = new Float64Array(n + 1);
  for (let a = 0; a <= n - w; a++) {
    for (let b = 0; b <= w; b++) {
      out[w + a - b]! +=
        bin[n - w]![a]! * bin[w]![b]! * powP[a + b]! * powQ[n - a - b]!;
    }
  }
  return out;
}

/** The repaired chain's kernel rows on the folded states (each row sums to 1). */
export function repairedKernelRows(n: number, p: number): Float64Array[] {
  const s = repairedStateCount(n);
  const rows: Float64Array[] = [];
  for (let x = 0; x < s; x++) {
    const noise = noiseRowFull(n, p, x);
    const row = new Float64Array(s);
    for (let v = 0; v <= n; v++) row[foldIndex(n, v)]! += noise[v]!;
    rows.push(row);
  }
  return rows;
}

/** The UNREPAIRED strict-armor block kernel (even n): the same noise
 * truncated at the absorbing boundary instead of folded — substochastic. */
export function unrepairedBlockRows(n: number, p: number): Float64Array[] {
  if (n < 4 || n % 2 !== 0) {
    throw new DtcError(
      "E/DOMAIN",
      `unrepairedBlockRows: even n >= 4 required (the strict armor's block), got ${n}`,
    );
  }
  const s = n / 2;
  const rows: Float64Array[] = [];
  for (let x = 0; x < s; x++) {
    const noise = noiseRowFull(n, p, x);
    const row = new Float64Array(s);
    for (let v = 0; v < s; v++) row[v] = noise[v]!;
    rows.push(row);
  }
  return rows;
}

/** The worst |row sum - 1| over the kernel (0 for stochastic rows). */
export function stochasticDeficit(rows: readonly Float64Array[]): number {
  let worst = 0;
  for (const row of rows) {
    let sum = 0;
    for (const v of row) sum += v;
    worst = Math.max(worst, Math.abs(sum - 1));
  }
  return worst;
}

function requireStochastic(rows: readonly Float64Array[]): void {
  const deficit = stochasticDeficit(rows);
  if (deficit > 1e-9) {
    throw new DtcError(
      "E/DOMAIN",
      `the kernel is substochastic (deficit ${deficit.toExponential(3)}): mass leaks to an absorbing set, no stationary distribution exists — the mixing certificate is refused`,
    );
  }
}

/** Total variation distance between two rows. */
function tvRows(a: Float64Array, b: Float64Array): number {
  let acc = 0;
  for (let y = 0; y < a.length; y++) acc += Math.abs(a[y]! - b[y]!);
  return acc / 2;
}

/** The Dobrushin certificate's raw pieces (both roads over the RIGHT pair
 * family + the strict-contraction witness), pure in (n, p). */
export interface DobrushinCertificate {
  /** max over ALL state pairs of TV(K(x,.),K(x',.)) — THE Dobrushin
   * coefficient (the contraction's true constant). */
  readonly pairwise: number;
  /** max over ALL state pairs of max_y |F_{x}(y) - F_{x'}(y)| — the binomial
   * tail road; equals pairwise iff the pair's PMF difference single-crosses
   * (grid-verified for odd n; the even-n tie fold breaks it at interior p). */
  readonly pairwiseTail: number;
  /** max over ADJACENT pairs only — the R18 spec's form, REFUTED as the
   * coefficient's value (the fold is not monotone; kept for the record). */
  readonly adjacent: number;
  /** the worst pair [x, x'] attaining pairwise */
  readonly worstPair: readonly [number, number];
  /** min over pairs of sum_y min(K(x,y),K(x',y)) — positive ⟹ every pair's
   * TV <= 1 - minCommon < 1, the analytic strict-ergodicity witness. */
  readonly minCommonMass: number;
}

/** The two roads to beta over all pairs plus the strict-contraction witness. */
export function dobrushinCertificate(
  n: number,
  p: number,
): DobrushinCertificate {
  if (n < 2)
    throw new DtcError(
      "E/DOMAIN",
      `dobrushinCertificate: n >= 2 required, got ${n}`,
    );
  if (!(p > 0 && p < 1))
    throw new DtcError(
      "E/DOMAIN",
      `dobrushinCertificate: p in (0,1) required, got ${p}`,
    );
  return dobrushinFromRows(repairedKernelRows(n, p));
}

function dobrushinFromRows(
  rows: readonly Float64Array[],
): DobrushinCertificate {
  const s = rows.length;
  let pairwise = 0;
  let pairwiseTail = 0;
  let adjacent = 0;
  let minCommon = 1;
  let worstPair: readonly [number, number] = [0, 0];
  for (let x = 0; x < s; x++) {
    for (let x2 = x + 1; x2 < s; x2++) {
      const tv = tvRows(rows[x]!, rows[x2]!);
      if (tv > pairwise) {
        pairwise = tv;
        worstPair = [x, x2];
      }
      let common = 0;
      let fa = 0;
      let fb = 0;
      let maxDev = 0;
      for (let y = 0; y < s; y++) {
        common += Math.min(rows[x]![y]!, rows[x2]![y]!);
        fa += rows[x]![y]!;
        fb += rows[x2]![y]!;
        maxDev = Math.max(maxDev, Math.abs(fb - fa));
      }
      minCommon = Math.min(minCommon, common);
      pairwiseTail = Math.max(pairwiseTail, maxDev);
      if (x2 === x + 1) adjacent = Math.max(adjacent, tv);
    }
  }
  return {
    pairwise,
    pairwiseTail,
    adjacent,
    worstPair,
    minCommonMass: minCommon,
  };
}

/** The stationary distribution by deep power iteration from the uniform start. */
export function repairedStationaryDistribution(
  n: number,
  p: number,
  iterations = 4000,
): Float64Array {
  return stationaryFromRows(repairedKernelRows(n, p), iterations);
}

function stationaryFromRows(
  rows: readonly Float64Array[],
  iterations: number,
): Float64Array {
  requireStochastic(rows);
  const s = rows.length;
  let pi = new Float64Array(s).fill(1 / s);
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(s);
    for (let x = 0; x < s; x++) {
      const w = pi[x]!;
      if (w === 0) continue;
      const row = rows[x]!;
      for (let y = 0; y < s; y++) next[y]! += w * row[y]!;
    }
    pi = next;
  }
  return pi;
}

/** The DP mixing certificate: from delta_0, the TV to the (numerically
 * deep-iterated) stationary distribution is pinned against beta^t step by
 * step, and the bound's own step count is checked to land inside eps. */
export interface MixingRun {
  readonly beta: number;
  /** ceil(ln(1/eps)/ln(1/beta)) — the bound's mixing step count. */
  readonly boundSteps: number;
  /** TV(pi_{boundSteps}, pi_inf) — must be <= eps. */
  readonly tvAtBound: number;
  /** max_t TV(pi_{t+1},pi_inf)/TV(pi_t,pi_inf) — the measured contraction. */
  readonly worstPerStepRatio: number;
  /** the ratio's conservatism factor beta / worstPerStepRatio (DATA). */
  readonly conservatism: number;
  /** the DP TVs at t = 1..boundSteps. */
  readonly tvSeries: readonly number[];
}

export function repairedMixingRun(
  n: number,
  p: number,
  epsilon = 1e-6,
): MixingRun {
  return mixingRunFromRows(repairedKernelRows(n, p), epsilon);
}

/** The mixing certificate over ANY stochastic kernel rows — the entry the
 * negative control reaches: substochastic rows (the unrepaired absorbing
 * block) are REFUSED by name here, before any certificate is issued. */
export function mixingRunFromRows(
  rows: readonly Float64Array[],
  epsilon = 1e-6,
): MixingRun {
  requireStochastic(rows);
  const { pairwise: beta } = dobrushinFromRows(rows);
  if (!(beta >= 0 && beta < 1)) {
    throw new DtcError(
      "E/BRACKET",
      `mixingRunFromRows: beta must lie in [0,1), got ${beta}`,
    );
  }
  const s = rows.length;
  const piInf = stationaryFromRows(rows, 8000);
  let pi = new Float64Array(s);
  pi[0] = 1;
  // beta = 0 is the INSTANT-MIXING degeneracy (p = 1/2: every period is a
  // fresh fair draw, all rows identical — the folded Bin(n,1/2) itself): the
  // chain is stationary after ONE step, and the ln(1/beta) formula divides
  // by infinity — the certificate is issued directly at one step.
  const boundSteps =
    beta === 0 ? 1 : Math.ceil(Math.log(1 / epsilon) / Math.log(1 / beta));
  const tvs: number[] = [];
  let worstRatio = 0;
  let prevTv = -1;
  for (let t = 1; t <= boundSteps + 1; t++) {
    const next = new Float64Array(s);
    for (let x = 0; x < s; x++) {
      const w = pi[x]!;
      if (w === 0) continue;
      const row = rows[x]!;
      for (let y = 0; y < s; y++) next[y]! += w * row[y]!;
    }
    pi = next;
    let acc = 0;
    for (let y = 0; y < s; y++) acc += Math.abs(pi[y]! - piInf[y]!);
    const tv = acc / 2;
    // the per-step ratio is only meaningful ABOVE the numerical floor: once
    // the TV reaches the power-iteration's own accumulation noise (~1e-12),
    // noise-over-noise ratios drift to 1 and say nothing about the
    // contraction — the ABSOLUTE pin tv <= beta^t stays live at every step.
    if (prevTv > 1e-9) worstRatio = Math.max(worstRatio, tv / prevTv);
    prevTv = tv;
    tvs.push(tv);
  }
  return {
    beta,
    boundSteps,
    tvAtBound: tvs[boundSteps - 1]!,
    worstPerStepRatio: worstRatio,
    conservatism:
      worstRatio === 0 ? Number.POSITIVE_INFINITY : beta / worstRatio,
    tvSeries: tvs,
  };
}
