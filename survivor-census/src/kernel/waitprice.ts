/**
 * S3 kernel — the waiting price of one confirmed survivor, exact.
 *
 * The sorter's "O(1)" is true inside the survived frame. Outside it, each
 * postselection trial keeps the branch with probability P and the waiting
 * time until the first survivor is geometric: Pr[T > k] = (1-P)^k exactly.
 * postselect-sched T5 priced a different object (the Hoeffding vote-error
 * schedule of a PP readout); the survival-wait face needs no inequality at
 * all — the exact schedule is computable in closed form, and the exponential
 * bound ln(1/delta)/P is its conservative overcharge. This kernel executes
 * both and reports the difference honestly.
 */

import { CensusError } from "./errors.js";

export interface WaitingPrice {
  readonly p: number;
  /** E[T] = 1/P, closed form */
  readonly meanClosedForm: number;
  /** E[T] via the closed-form partial sum to K, analytic tail below 1e-12 of the mean — independent algebra path */
  readonly meanPartial: number;
  readonly meanDev: number;
  /** loop referee (only meaningful at moderate P where K is small; NaN when not run) */
  readonly meanLoop: number;
}

export function waitingPrice(p: number): WaitingPrice {
  if (!(p > 0 && p <= 1)) {
    throw new CensusError("SC/P-DOMAIN", "waitingPrice: p must be in (0, 1]");
  }
  const q = 1 - p;
  // K with analytic tail ((K+1) q^K)/p below 1e-12 of the mean 1/p,
  // i.e. (K+1) q^K <= 1e-12 — pK = 60 gives K e^{-pK} ~ (60/p) e^{-60}, safe for all p >= 2^-20
  const K = p === 1 ? 1 : Math.max(1, Math.ceil(60 / p));
  const qK = q ** K;
  const qK1 = q ** (K + 1);
  const meanPartial = (1 - (K + 1) * qK + K * qK1) / p;
  let meanLoop = Number.NaN;
  if (p >= 0.1) {
    // loop path only where the summation length is modest — plain accumulation
    // error is then below the comparison tolerance (batch 29 lesson: the loop
    // at P=2^-20 needs ~4e7 adds and drifts ~4e-5)
    let s = 0;
    for (let k = 1; k <= K; k++) s += k * p * q ** (k - 1);
    meanLoop = s;
  }
  return {
    p,
    meanClosedForm: 1 / p,
    meanPartial,
    meanDev: Math.abs(meanPartial - 1 / p),
    meanLoop,
  };
}

/** exact geometric tail: Pr[T > k] = (1-P)^k, via exp-log (independent of the Math.pow path in schedule()) */
export function tailAt(p: number, k: number): number {
  if (!(p > 0 && p < 1)) {
    throw new CensusError("SC/P-DOMAIN", "tailAt: p must be in (0,1) — the tail is a survival probability");
  }
  if (!Number.isInteger(k) || k < 0) {
    throw new CensusError("SC/MC-BAD-INPUTS", "tailAt: k must be a non-negative integer trial count");
  }
  return Math.exp(k * Math.log(1 - p));
}

export interface SchedulePair {
  readonly p: number;
  readonly delta: number;
  /** smallest k with (1-P)^k <= delta — the exact schedule */
  readonly kExact: number;
  /** minimality verified: (1-P)^kExact <= delta < (1-P)^(kExact-1) */
  readonly minimal: boolean;
  /** ln(1/delta)/P ceiling — the conservative exponential bound's schedule */
  readonly kBound: number;
  /** (kBound - kExact) / kExact — the bound's overcharge, never negative */
  readonly overcharge: number;
}

export function schedule(p: number, delta: number): SchedulePair {
  if (!(p > 0 && p < 1)) {
    throw new CensusError("SC/P-DOMAIN", "schedule: p must be in (0,1)");
  }
  if (!(delta > 0 && delta < 1)) {
    throw new CensusError("SC/DELTA-DOMAIN", "schedule: delta must be in (0,1)");
  }
  // smallest k with k * ln(1-P) <= ln(delta)  (ln(1-P) < 0, so divide flips)
  const kExact = Math.max(1, Math.ceil(Math.log(delta) / Math.log(1 - p)));
  const atK = (1 - p) ** kExact;
  const belowK = kExact > 1 ? (1 - p) ** (kExact - 1) : Number.POSITIVE_INFINITY;
  const minimal = atK <= delta && belowK > delta;
  const kBound = Math.max(1, Math.ceil(Math.log(1 / delta) / p));
  return {
    p,
    delta,
    kExact,
    minimal,
    kBound,
    overcharge: (kBound - kExact) / kExact,
  };
}

export interface McWaiting {
  readonly runs: number;
  readonly mean: number;
  /** |mean - 1/P| in sigma units — realization referee only */
  readonly sigmaUnits: number;
}

/** Monte Carlo referee for the geometric waiting law — never a theorem claim. */
export function mcWaiting(p: number, runs: number, rngNext: () => number): McWaiting {
  if (!(p > 0 && p <= 1)) {
    throw new CensusError("SC/P-DOMAIN", "mcWaiting: p must be in (0, 1]");
  }
  if (!Number.isInteger(runs) || runs <= 0) {
    // runs=0 divides by zero and yields silent NaN — named refusal instead
    throw new CensusError("SC/MC-BAD-INPUTS", "mcWaiting: runs must be a positive integer");
  }
  let s = 0;
  for (let r = 0; r < runs; r++) {
    let k = 0;
    for (;;) {
      k++;
      if (rngNext() < p) break;
    }
    s += k;
  }
  const mean = s / runs;
  const sigma = Math.sqrt((1 - p) / (p * p)) / Math.sqrt(runs);
  return { runs, mean, sigmaUnits: Math.abs(mean - 1 / p) / sigma };
}
