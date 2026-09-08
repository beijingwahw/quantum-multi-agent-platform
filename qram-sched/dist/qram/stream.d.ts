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
export declare function encodeUniformStream(qram: BucketBrigadeQram): StreamState;
/** Exact mean of the stored stream values. */
export declare function streamMean(qram: BucketBrigadeQram): number;
/** Classical Monte Carlo estimate of the stream mean: draws = number of bus samples (query count). */
export declare function monteCarloMean(qram: BucketBrigadeQram, draws: number, rand: () => number): {
    estimate: number;
    queries: number;
};
