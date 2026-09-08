/**
 * DSIC checkers over classical deviations and over quantum deviations.
 *
 * The report channel: agent i owns a k-dimensional register whose
 * computational basis codewords |0..k-1> encode the k possible reports. The
 * mechanism reads the register in the codeword basis. A quantum deviation is
 * ANY density matrix sigma on that register (this is exactly the set of
 * states reachable from a codeword by CPTP maps plus shared randomness).
 * Expected utility is affine in sigma:
 *     U(sigma) = sum_r Tr[|r><r| sigma] * u(r),
 * so mixtures cannot beat pure states, and pure codewords realize every
 * classical pure strategy. Hence DSIC against quantum deviations should be
 * equivalent to DSIC against classical mixed strategies — Theorem T1. The
 * functions here machine-check that equivalence on concrete instances.
 */

import { type CMat, mat } from '../core/cmat.js';
import { fromVec, randomPureState, valueKet } from '../core/states.js';
import type { Rng } from '../core/rng.js';
import { type AuctionKind, utilityOf } from './auctions.js';

export interface DeviationResult {
  /** max over checked deviations of U(deviation) - U(truth) */
  bestGain: number;
  /** the report state achieving it */
  bestReport: number;
  bestSigma: CMat;
  /** U(truth) for reference */
  truthUtility: number;
}

/** Expected utility when agent submits density matrix sigma on the k-dim
 * report register (others bid classically): U(sigma) = sum_r p(r|sigma) u(r).
 * Affine in sigma by construction. `agentSlot` is the agent's position in
 * the full bid vector. */
export function makeQuantumUtility(
  kind: AuctionKind,
  trueValue: number,
  others: readonly number[],
  agentSlot: number,
): (sigma: CMat) => number {
  const full = (report: number): number[] => {
    const bids = [...others];
    bids.splice(agentSlot, 0, report);
    return bids;
  };
  return (sigma: CMat): number => {
    const kk = sigma.rows;
    let u = 0;
    for (let r = 0; r < kk; r++) {
      const p = sigma.re[r * kk + r]!;
      if (p <= 0) continue;
      u += p * utilityOf(kind, trueValue, full(r), agentSlot);
    }
    return u;
  };
}

/** Codeword state |r> as a density matrix. */
export function codeword(k: number, r: number): CMat {
  return fromVec(valueKet(k, r));
}

/** Shared entry check for the deviation searchers: the report register has
 * k ≥ 2 levels. */
function requireLevels(k: number): void {
  if (!Number.isInteger(k) || k < 2) {
    throw new Error(`DSIC01-bad-k: need integer k >= 2 report levels, got ${k}`);
  }
}

/** Max gain over classical pure misreports r in [0, k). */
export function classicalBestGain(
  kind: AuctionKind,
  trueValue: number,
  others: readonly number[],
  agentSlot: number,
  k: number,
): { bestGain: number; bestReport: number } {
  requireLevels(k);
  const uTrue = utilityOf(kind, trueValue, withReport(others, agentSlot, level(trueValue)), agentSlot);
  let bestGain = -Infinity;
  let bestReport = -1;
  for (let r = 0; r < k; r++) {
    const u = utilityOf(kind, trueValue, withReport(others, agentSlot, r), agentSlot);
    const gain = u - uTrue;
    if (gain > bestGain) {
      bestGain = gain;
      bestReport = r;
    }
  }
  return { bestGain, bestReport };
}

function level(v: number): number {
  // truth-telling report = value rounded into the grid used by others
  return Math.round(v);
}

function withReport(others: readonly number[], slot: number, report: number): number[] {
  const bids = [...others];
  bids.splice(slot, 0, report);
  return bids;
}

/** Max gain over sampled quantum deviations (random pure states + all
 * codewords + random two-point mixtures). Machine-checks Theorem T1:
 * for DSIC mechanisms no quantum deviation should beat zero. */
export function quantumBestGain(
  kind: AuctionKind,
  trueValue: number,
  others: readonly number[],
  agentSlot: number,
  k: number,
  rng: Rng,
  nRandom: number,
): DeviationResult {
  requireLevels(k);
  const uFun = makeQuantumUtility(kind, trueValue, others, agentSlot);
  const truth = codeword(k, level(trueValue));
  const truthUtility = uFun(truth);
  let bestGain = -Infinity;
  let bestSigma = truth;
  let bestReport = level(trueValue);
  const consider = (sigma: CMat, report: number): void => {
    const u = uFun(sigma);
    if (u - truthUtility > bestGain) {
      bestGain = u - truthUtility;
      bestSigma = sigma;
      bestReport = report;
    }
  };
  for (let r = 0; r < k; r++) consider(codeword(k, r), r);
  for (let t = 0; t < nRandom; t++) {
    consider(fromVec(randomPureState(k, rng)), -1);
  }
  for (let t = 0; t < nRandom; t++) {
    const a = rng.int(k);
    const b = rng.int(k);
    const w = rng();
    const mix = mat(k, k);
    const ca = codeword(k, a);
    const cb = codeword(k, b);
    for (let idx = 0; idx < k * k; idx++) {
      mix.re[idx] = w * ca.re[idx]! + (1 - w) * cb.re[idx]!;
      mix.im[idx] = w * ca.im[idx]! + (1 - w) * cb.im[idx]!;
    }
    consider(mix, a);
  }
  return { bestGain, bestReport, bestSigma, truthUtility };
}

/** Residual of the affine identity U(w*sigma1 + (1-w)*sigma2) =
 * w*U(sigma1) + (1-w)*U(sigma2); must be ~1e-15 for the T1 reduction. */
export function affineResidual(
  kind: AuctionKind,
  trueValue: number,
  others: readonly number[],
  agentSlot: number,
  k: number,
  rng: Rng,
): number {
  requireLevels(k);
  const uFun = makeQuantumUtility(kind, trueValue, others, agentSlot);
  const s1 = fromVec(randomPureState(k, rng));
  const s2 = fromVec(randomPureState(k, rng));
  const w = rng();
  const mix = mat(k, k);
  for (let idx = 0; idx < k * k; idx++) {
    mix.re[idx] = w * s1.re[idx]! + (1 - w) * s2.re[idx]!;
    mix.im[idx] = w * s1.im[idx]! + (1 - w) * s2.im[idx]!;
  }
  return Math.abs(uFun(mix) - (w * uFun(s1) + (1 - w) * uFun(s2)));
}
