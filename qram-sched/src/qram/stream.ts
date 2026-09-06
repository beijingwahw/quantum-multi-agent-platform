/**
 * Amplitude encoding of an online task stream.
 *
 * The task stream is a sequence of tasks with per-cell statistics in [0,1]
 * (success rates, utility fractions, fill ratios). Held in a qRAM, a uniform
 * address superposition plus one query prepares
 *     (1/sqrt(N)) sum_a |a> ( sqrt(1-x_a)|0> + sqrt(x_a)|1> ),
 * so the probability of measuring bus = 1 is exactly mean(x). Amplitude
 * estimation turns this into a quadratic-query-count estimator of the stream
 * mean; the classical estimator is Monte Carlo sampling of the same stream.
 */
import type { BucketBrigadeQram } from "./bucket.js";

export interface StreamState {
  re: Float64Array;
  im: Float64Array;
}

/** Prepare |0...0> on address x bus, apply H^{(n)} on the address, then query. */
export function encodeUniformStream(qram: BucketBrigadeQram): StreamState {
  const re = new Float64Array(qram.dim);
  const im = new Float64Array(qram.dim);
  re[0] = 1; // |0...0>|0>
  const amp = 1 / Math.sqrt(qram.numCells);
  for (let a = 0; a < qram.numCells; a++) {
    re[a * 2] = amp; // Hadamard^n on address, bus stays |0>
  }
  qram.applyQuery(re, im);
  return { re, im };
}

/** Exact mean of the stored stream values. */
export function streamMean(qram: BucketBrigadeQram): number {
  let s = 0;
  for (let a = 0; a < qram.numCells; a++) s += qram.cells[a] as number;
  return s / qram.numCells;
}

/** Classical Monte Carlo estimate of the stream mean: draws = number of bus samples (query count). */
export function monteCarloMean(qram: BucketBrigadeQram, draws: number, rand: () => number): { estimate: number; queries: number } {
  let hits = 0;
  for (let i = 0; i < draws; i++) {
    const a = Math.floor(rand() * qram.numCells);
    if (rand() < (qram.cells[a] as number)) hits++;
  }
  return { estimate: hits / draws, queries: draws };
}
