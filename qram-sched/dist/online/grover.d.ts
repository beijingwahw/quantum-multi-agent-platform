/**
 * Quantum search harness for online decision loops (Grover 1996;
 * Durr-Hoyer minimum finding, 1996; Boyyer-Brassard-Hoyer-Tapp variable
 * iterations). Bounded-error, exact same decision RULE as the linear scan;
 * the deliverable is the oracle-read ledger: O(N) vs O(sqrt(N) log N).
 *
 * Grover sampling is exact: with t marked of N and k iterations the success
 * probability is sin^2((2k+1) theta) with sin theta = sqrt(t/N), and a
 * successful measurement returns a uniformly random marked element. Both
 * facts are cross-checked against full-space Grover simulation in the tests.
 */
import type { Rng } from "../core/rng.js";
export interface SearchResult {
    index: number;
    reads: number;
}
/** Linear scan for the minimum under a strict-less comparator; reads = N. */
export declare function linearFindBest<T>(scores: ArrayLike<T>, less: (x: T, y: T) => boolean): SearchResult;
/**
 * Durr-Hoyer style search for a strictly-better element than the threshold
 * value, with retry schedule uniform k in [0, ceil(sqrt(N))]. Returns the
 * index of the new threshold holder, or -1 if no better element was found
 * (bounded error: a better element may exist but was missed).
 */
export declare function groverFindBetter<T>(n: number, thresholdValue: T, value: (i: number) => T, less: (x: T, y: T) => boolean, rng: Rng): {
    index: number;
    reads: number;
};
/**
 * Durr-Hoyer minimum finding: repeatedly Grover-search for a strictly better
 * element than the current threshold. Returns {best, reads, correct}.
 * 'correct' compares against the true argmin (the harness knows it; the
 * algorithm does not). The linear scan is always correct; the quantum search
 * is bounded-error — agreement rates are reported, not assumed.
 */
export declare function durHoyerFindBest<T>(scores: ArrayLike<T>, less: (x: T, y: T) => boolean, rng: Rng): {
    best: number;
    reads: number;
    correct: boolean;
};
/** Linear scan for any marked element; reads = N. Used per-arrival in matching. */
export declare function linearFindMarked(n: number, isMarked: (i: number) => boolean): SearchResult;
/** Grover search for any marked element (bounded error, exact sampling); reads ledger. */
export declare function groverFindMarked(n: number, isMarked: (i: number) => boolean, rng: Rng): SearchResult;
