/**
 * Privacy referees for the sealed-bid protocol:
 *
 *  - lockedHolevo / lockedTraceDistance: how much bid information the
 *    auctioneer's pre-deadline ensemble carries (Wiesner locking).
 *  - interceptExperiment: the information-disturbance curve — peeking
 *    before the deadline flips payload bits at a measurable rate.
 *  - transcriptLeakage: post-auction, a classical auctioneer must have
 *    received every bid; the coherent protocol's transcript is only
 *    (winner, price) — verified by enumeration over profile pairs.
 */

import type { CMat } from '../core/cmat.js';
import { traceDistance, holevo, type EnsembleItem } from '../core/measures.js';
import { type LockMode, lockedEnsemble } from './locking.js';
import type { Rng } from '../core/rng.js';
import { runSealedBidAuction, secondOf, winnerOf } from './auction.js';

/** Holevo χ (upper bound on accessible information, in bits) of the uniform
 * ensemble over all 2^m payload values as seen by the auctioneer without
 * keys. The hiding quality of the lock family. */
export function lockedHolevo(m: number, nBases: 2 | 3, mode: LockMode = 'wiesner'): number {
  if (!Number.isInteger(m) || m < 1) {
    throw new Error(`PRIV05-bad-m: lockedHolevo needs integer m >= 1 qubit, got ${m}`);
  }
  const items: EnsembleItem[] = [];
  const count = 2 ** m;
  for (let v = 0; v < count; v++) {
    items.push({ key: String(v), state: lockedEnsemble(v, m, nBases, mode), weight: 1 / count });
  }
  return holevo(items);
}

/** Worst-case trace distance between the auctioneer's locked ensembles for
 * two payloads — 0 means the states are literally identical. */
export function lockedTraceDistance(m: number, nBases: 2 | 3, mode: LockMode = 'wiesner'): { worst: number; pair: [number, number] } {
  if (!Number.isInteger(m) || m < 1) {
    throw new Error(`PRIV05-bad-m: lockedTraceDistance needs integer m >= 1 qubit, got ${m}`);
  }
  let worst = 0;
  let pair: [number, number] = [0, 0];
  const states: CMat[] = [];
  for (let v = 0; v < 2 ** m; v++) states.push(lockedEnsemble(v, m, nBases, mode));
  for (let a = 0; a < states.length; a++) {
    for (let b = a + 1; b < states.length; b++) {
      const d = traceDistance(states[a]!, states[b]!);
      if (d > worst) {
        worst = d;
        pair = [a, b];
      }
    }
  }
  return { worst, pair };
}

export interface InterceptStats {
  trials: number;
  /** fraction of runs with at least one payload bit flip */
  detectionRate: number;
  /** per-qubit flip rate */
  flipRate: number;
  analyticFlipRate: number;
  analyticDetectionRate: number;
}

/** Monte Carlo: attacker measures and resends every locked qubit before the
 * deadline. Per-qubit flip rate should match (1 - 1/nBases)/2. */
export function interceptExperiment(
  trials: number,
  m: number,
  nBases: 2 | 3,
  rng: Rng,
  bidders = 2,
): InterceptStats {
  if (!Number.isInteger(trials) || trials < 1) {
    throw new Error(`PRIV03-bad-trials: interceptExperiment needs integer trials >= 1, got ${trials}`);
  }
  if (!Number.isInteger(m) || m < 1) {
    throw new Error(`PRIV04-bad-m: interceptExperiment needs integer m >= 1 payload qubit, got ${m}`);
  }
  const k = 2 ** m; // full payload: every qubit carries a checked bit
  let detections = 0;
  let flips = 0;
  let qubits = 0;
  for (let t = 0; t < trials; t++) {
    const bids = Array.from({ length: bidders }, () => rng.int(k));
    const run = runSealedBidAuction(bids, k, rng, nBases, { intercept: true });
    if (run.detected) detections++;
    flips += run.checkErrors;
    qubits += bidders * m;
  }
  const analyticFlipRate = (1 - 1 / nBases) / 2;
  const qubitsPerRun = bidders * m;
  return {
    trials,
    detectionRate: detections / trials,
    flipRate: flips / qubits,
    analyticFlipRate,
    analyticDetectionRate: 1 - (1 - analyticFlipRate) ** qubitsPerRun,
  };
}

export interface TranscriptLeakage {
  pairs: number;
  /** pairs distinguishable by a CLASSICAL auctioneer (receives all bids) */
  classicalDistinguishable: number;
  /** pairs distinguishable from the coherent protocol's transcript
   * (winner, price) — includes the retention schedule (junk erased) */
  quantumDistinguishable: number;
  /** pairs whose bid profiles differ but transcripts agree (privacy gain) */
  hiddenPairs: number;
}

/** Enumerate all bid profiles for n bidders and k levels; count which pairs
 * of profiles an auctioneer can distinguish post-auction. */
export function transcriptLeakage(n: number, k: number): TranscriptLeakage {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`PRIV01-bad-n: transcriptLeakage needs integer n >= 1 bidder, got ${n}`);
  }
  if (!Number.isInteger(k) || k < 2) {
    throw new Error(`PRIV02-bad-k: transcriptLeakage needs integer k >= 2 bid levels, got ${k}`);
  }
  const profiles: number[] = Array.from({ length: k ** n }, (_, i) => i);
  const decode = (x: number): number[] => {
    const b: number[] = [];
    for (let j = 0; j < n; j++) {
      b.push(x % k);
      x = Math.floor(x / k);
    }
    return b.reverse();
  };
  let pairs = 0;
  let classical = 0;
  let quantum = 0;
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      pairs++;
      const bi = decode(profiles[i]!);
      const bj = decode(profiles[j]!);
      if (bi.some((v, idx) => v !== bj[idx])) classical++;
      const ti = `${winnerOf(bi)},${secondOf(bi)}`;
      const tj = `${winnerOf(bj)},${secondOf(bj)}`;
      if (ti !== tj) quantum++;
    }
  }
  return {
    pairs,
    classicalDistinguishable: classical,
    quantumDistinguishable: quantum,
    hiddenPairs: pairs - quantum,
  };
}
