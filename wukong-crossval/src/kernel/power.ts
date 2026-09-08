/**
 * The power-analysis kernel (X6) — the calibration stage's arithmetic,
 * computed BEFORE machine time: the minimum shots N that distinguish the
 * model-predicted hit-rate change at the noise boundary from the no-change
 * null at significance alpha with power 1-beta.
 *
 * Test form: one exact binomial tail test.
 *   H0: observed hit rate = p0 (the exact-engine prediction — no change)
 *   H1: observed hit rate = p1 != p0 (the model-predicted rate at this flip)
 * The tail follows the predicted sign — a predicted decay rejects on small
 * counts, a predicted inflow (which the exact kernel does predict at small n
 * and low noise, where background inflow through the Hamming-1 shell beats
 * outflow) rejects on large counts. The critical region is the exact
 * largest/smallest count set with P_{p0} <= alpha. Power at N is the exact
 * P_{p1} of that region. Log-space accumulation throughout; every shipped
 * number is re-verified by the checker (audit, law X6).
 *
 * The Chernoff column is the sufficient KL-form bound with the midpoint
 * threshold t = (p0+p1)/2: P_{p0}(K/N beyond t) <= exp(-N D(t||p0)) and
 * P_{p1}(K/N short of t) <= exp(-N D(t||p1)), so N >= max(ln(1/alpha)/D(t||p0),
 * ln(1/beta)/D(t||p1)) delivers both level and power, in either tail.
 * Because {K/N beyond t} is exactly an integer-count event, the bound's
 * region nests inside the exact critical region — the exact test at the
 * Chernoff N is at least as powerful. Machine-verified on every row.
 */
import { XvalError } from "./error.js";

export interface MinShotsResult {
  /** minimum shots under the scan definition; null = censored beyond cap */
  readonly shots: number | null;
  /** exact power at shots; null when censored */
  readonly power: number | null;
  /** sawtooth dips: count of N' in (shots, shots+64] with power < target */
  readonly dips: number | null;
  /** Chernoff sufficient bound (always computable, also for censored rows) */
  readonly chernoff: number;
}

/** log P(K <= k) for K ~ Binomial(n, p), log-space accumulation. */
export function logBinomCdf(k: number, n: number, p: number): number {
  if (k < 0) return -Infinity;
  if (k >= n) return 0;
  if (p <= 0) return 0; // K === 0 deterministically, and k >= 0 here
  if (p >= 1) return -Infinity; // K === n deterministically, k < n here
  const q = 1 - p;
  let logPmf = n * Math.log(q); // j = 0
  let m = logPmf;
  let s = 1;
  const logRatio = Math.log(p) - Math.log(q);
  for (let j = 0; j < k; j++) {
    logPmf += Math.log((n - j) / (j + 1)) + logRatio;
    if (logPmf > m) {
      s = s * Math.exp(m - logPmf) + 1;
      m = logPmf;
    } else {
      s += Math.exp(logPmf - m);
    }
  }
  return m + Math.log(s);
}

/** Exact binomial CDF (companion of logBinomCdf for readable callers). */
export function binomCdf(k: number, n: number, p: number): number {
  return Math.exp(logBinomCdf(k, n, p));
}

/** Binary relative entropy D(t || p) for t, p in (0,1). */
export function klBern(t: number, p: number): number {
  return t * Math.log(t / p) + (1 - t) * Math.log((1 - t) / (1 - p));
}

/** Chernoff sufficient shot count: midpoint threshold, KL form, either tail. */
export function chernoffShots(p0: number, p1: number, alpha: number, beta: number): number {
  const t = (p0 + p1) / 2;
  return Math.ceil(Math.max(Math.log(1 / alpha) / klBern(t, p0), Math.log(1 / beta) / klBern(t, p1)));
}

/**
 * Exact power of the level-alpha exact binomial test at N shots, tail chosen
 * by the sign of p1 - p0. One walk admits counts into the critical region
 * while accumulating both distributions; the walk visits O(k*) terms, where
 * k* is the critical count — this kernel is built for the hit-rate regime
 * (N * p0 well below ~1e5), which the allocation table's caps enforce.
 */
export function powerAt(shots: number, p0: number, p1: number, alpha: number): number {
  if (shots < 1) return 0;
  if (p1 === p0) return alpha; // no effect: the "power" is the size itself
  const n = shots;
  const decay = p1 < p0;
  const q0 = 1 - p0;
  const q1 = 1 - p1;
  let logPmf0 = n * Math.log(q0);
  let logPmf1 = n * Math.log(q1);
  const logAlpha = Math.log(alpha);
  // running logSumExp states for both CDFs, after admitting term j = 0
  let m0 = logPmf0;
  let s0 = 1;
  let m1 = logPmf1;
  let s1 = 1;
  const lr0 = Math.log(p0) - Math.log(q0);
  const lr1 = Math.log(p1) - Math.log(q1);
  if (decay) {
    // lower tail: reject on K <= k*, k* = largest with CDF_{p0} <= alpha
    if (m0 > logAlpha) return 0; // even K <= 0 exceeds level: nothing rejects
    for (let j = 0; j < n; j++) {
      logPmf0 += Math.log((n - j) / (j + 1)) + lr0;
      if (logPmf0 > m0) {
        s0 = s0 * Math.exp(m0 - logPmf0) + 1;
        m0 = logPmf0;
      } else {
        s0 += Math.exp(logPmf0 - m0);
      }
      if (m0 + Math.log(s0) > logAlpha) break; // next count would exceed level
      logPmf1 += Math.log((n - j) / (j + 1)) + lr1;
      if (logPmf1 > m1) {
        s1 = s1 * Math.exp(m1 - logPmf1) + 1;
        m1 = logPmf1;
      } else {
        s1 += Math.exp(logPmf1 - m1);
      }
      if (j + 1 >= n) return 1; // full support admitted
    }
    return Math.exp(m1 + Math.log(s1));
  }
  // upper tail: reject on K >= k*, k* = smallest with P_{p0}(K >= k*) <= alpha.
  // Survival after admitting terms 0..j is P(K >= j+1) = 1 - CDF(j).
  for (let j = 0; j < n; j++) {
    if (1 - Math.exp(m0 + Math.log(s0)) <= alpha) {
      // k* = j + 1; power = P_{p1}(K >= j+1) = 1 - CDF_{p1}(j)
      return 1 - Math.exp(m1 + Math.log(s1));
    }
    logPmf0 += Math.log((n - j) / (j + 1)) + lr0;
    if (logPmf0 > m0) {
      s0 = s0 * Math.exp(m0 - logPmf0) + 1;
      m0 = logPmf0;
    } else {
      s0 += Math.exp(logPmf0 - m0);
    }
    logPmf1 += Math.log((n - j) / (j + 1)) + lr1;
    if (logPmf1 > m1) {
      s1 = s1 * Math.exp(m1 - logPmf1) + 1;
      m1 = logPmf1;
    } else {
      s1 += Math.exp(logPmf1 - m1);
    }
    if (j + 1 >= n) break;
  }
  return 0; // even K >= n does not reach level alpha at this N
}

/**
 * Minimum shots with power >= target. Scan definition (stated honestly):
 * doubling from 1 to the first N with power >= target, bisection inside the
 * final bracket, then a bounded 64-step walk-down. Local minimality is
 * machine-verified per row by the checker: power(N*) >= target and
 * power(N*-1) < target.
 */
export function minShots(p0: number, p1: number, alpha: number, target: number, cap: number): MinShotsResult {
  if (!(p0 > 0 && p0 < 1)) throw new XvalError("XVAL_MINSHOTS_NULL_RATE", `minShots: null rate p0 must be in (0,1), got ${p0}`);
  if (!(p1 > 0 && p1 < 1 && p1 !== p0)) throw new XvalError("XVAL_MINSHOTS_ALT_RATE", `minShots: alternative p1 must be in (0,1) and differ from p0, got ${p1} vs ${p0}`);
  if (!(0 < alpha && alpha < 1) || !(0 < target && target < 1)) throw new XvalError("XVAL_MINSHOTS_LEVEL", "minShots: alpha and target must be in (0,1)");
  const chernoff = chernoffShots(p0, p1, alpha, 1 - target);
  let hi = 1;
  while (hi < cap && powerAt(hi, p0, p1, alpha) < target) hi *= 2;
  let reached = powerAt(hi, p0, p1, alpha) >= target;
  if (!reached && powerAt(cap, p0, p1, alpha) >= target) {
    hi = cap; // the doubling overshot the cap into a region that works; clamp
    reached = true;
  }
  if (!reached) return { shots: null, power: null, dips: null, chernoff };
  let lo = hi === 1 ? 1 : (hi >> 1) + 1; // the step below hi failed the doubling walk
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (powerAt(mid, p0, p1, alpha) >= target) hi = mid;
    else lo = mid + 1;
  }
  let n = hi;
  for (let w = 0; w < 64 && n > 1 && powerAt(n - 1, p0, p1, alpha) >= target; w++) n -= 1;
  let dips = 0;
  for (let w = 1; w <= 64; w++) if (powerAt(n + w, p0, p1, alpha) < target) dips++;
  return { shots: n, power: powerAt(n, p0, p1, alpha), dips, chernoff };
}
