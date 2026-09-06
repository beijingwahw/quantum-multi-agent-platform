/**
 * Online bipartite matching: tasks arrive online, workers are the known side
 * (Karp-Vazirani-Vazirani, STOC 1990).
 *
 * - Greedy with uniform tie-breaking: matches each arrival to a uniformly
 *   random available neighbor. Worst case 1/2 (cited).
 * - RANKING (KVV): a uniformly random permutation of workers; each arrival
 *   takes its available neighbor of best (lowest) rank. (1 - 1/e)-competitive
 *   and optimal among randomized algorithms (KVV 1990; Devanur-Jain-Kleinberg
 *   primal-dual proof, SODA 2013). The exact tight recursive instance is a
 *   cited theorem and is NOT reproduced here — we verify no violation on
 *   adversarial banks, the greedy 1/2 cascade exactly, and relative order.
 * - Quantum layer: the per-arrival inner search (best-ranked available
 *   neighbor) served by Durr-Hoyer Grover search instead of a linear scan.
 *   Same decision rule; reads O(n) -> O(sqrt(n) log n); bit-identical
 *   decisions whenever the bounded-error search does not miss (agreement
 *   rates reported). Competitive ratios are information-theoretic caps that
 *   quantum inner search cannot change.
 *
 * Referee: exact maximum matching via Kuhn's augmenting-path algorithm.
 */
import { Rng } from "../core/rng.js";
export interface ObmInstance {
    /** Offline workers 0..n-1. */
    readonly n: number;
    /** Arrivals in order; each is a neighbor list over workers. */
    readonly arrivals: readonly (readonly number[])[];
}
/** Exact maximum matching size of the final graph (Kuhn's algorithm). */
export declare function kuhnMaxMatching(inst: ObmInstance): number;
export interface MatchResult {
    size: number;
    reads: number;
    /** For the quantum variant: number of arrivals where the search disagreed with the exact rule. */
    disagreements: number;
}
/** The cascade adversary: arrivals in pairs (v ~ {u_1, u_2}; w ~ {u_1}); greedy with
 *  lowest-index ties matches exactly half; uniform ties do better; ranking 3/4. */
export declare function cascadeInstance(pairs: number): ObmInstance;
/** Erdos-Renyi arrival bank. */
export declare function randomInstance(n: number, arrivals: number, p: number, rng: Rng): ObmInstance;
/** Greedy matching. tie 'lowest': deterministic first-available (worst case 1/2).
 *  tie 'uniform': uniformly random available neighbor. mode 'grover' serves the
 *  uniform-tie variant via Grover sampling (distribution-identical) or falls
 *  back to the exact rule on bounded-error misses (charged). */
export declare function greedyMatch(inst: ObmInstance, rng: Rng, mode: "linear" | "grover", tie?: "lowest" | "uniform"): MatchResult;
/** RANKING: random permutation of workers, arrivals take best-ranked available neighbor. */
export declare function rankingMatch(inst: ObmInstance, rng: Rng, mode: "linear" | "grover"): MatchResult;
/** Expected reads for one arrival under each mode (for the ledger table). */
export declare function arrivalReadProfile(n: number): {
    linear: number;
};
/** Convenience: run a bank of instances and aggregate mean competitive ratios. */
export declare function ratioBank(makeInstance: (seed: number) => ObmInstance, seeds: number[], algo: (inst: ObmInstance, rng: Rng) => MatchResult): {
    meanRatio: number;
    minRatio: number;
    meanReads: number;
};
