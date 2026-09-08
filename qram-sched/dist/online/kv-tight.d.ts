/**
 * The KVV tight instances, executed (v0.2.0 face #1).
 *
 * Karp-Vazirani-Vazirani (STOC 1990) separated RANKING (1 - 1/e) from every
 * greedy (1/2) via a hard-input DISTRIBUTION D_n. The construction and the
 * exact finite-n values follow U. Feige, "Tighter bounds for online bipartite
 * matching", arXiv:1812.11774 (2018), Section 1.1 and Theorems 6/14/21:
 *
 *   MonotoneG (the representative of the D_n support): workers v_1..v_n on the
 *   known side; arrival u_j has the nested suffix neighborhood {v_j..v_n}.
 *   D_n = MonotoneG composed with a uniformly random worker relabeling tau.
 *   The unique perfect matching is (u_j, v_j).
 *
 *   E[RANKING on D_n] = a(n)/n!,   a(n) = (n+1)! - d(n+1) - d(n),
 *   with d = derangement numbers; asymptotically (1-1/e)n + 1 - 2/e + O(1/n!)
 *   — the 1 - 1/e cap is met EXACTLY, with the published additive constant.
 *
 *   KVV Lemma 13 (via Feige): every two greedy algorithms have the SAME
 *   expectation on D_n — so greedy (uniform ties) also sits exactly at
 *   a(n)/n! there: on the KV family the greedy and RANKING ledgers coincide,
 *   far above greedy's separate worst-case cap of 1/2.
 *
 *   Deterministic 1/2 (exact, not asymptotic; Feige Section 1 sketch): first
 *   n/2 arrivals over ALL workers, then n/2 arrivals over exactly the matched
 *   set S — any deterministic tie-break matches exactly n/2 while OPT = n.
 *
 * Machine kernels here:
 *   - feigeRankingExpectation(n): the derangement formula (BigInt-exact);
 *   - rankingExpectationExhaustive(n): all n! rank permutations enumerated;
 *   - greedyUniformExpectationExact(n): subset DP over the suffix structure;
 *   - deterministicGreedyHalfInstance(n, rule): the phase adversary, built by
 *     observing the rule's own phase-1 choices (oblivious once the rule is
 *     fixed — the standard derivation of the sketch);
 *   - certificate and ledger verifiers (the smuggling-trial checkers).
 */
import type { ObmInstance } from "./matching.js";
import { Rng } from "../core/rng.js";
/** MonotoneG: arrival j has the suffix neighborhood {v_j, ..., v_{n-1}}. */
export declare function monotoneInstance(n: number): ObmInstance;
/** MonotoneG under a uniformly random worker relabeling tau (a D_n member). */
export declare function sampleDnMember(n: number, rng: Rng): ObmInstance;
/** d(m): derangement numbers, exact (d(0)=1, d(1)=0, d(m)=(m-1)(d(m-1)+d(m-2))). */
export declare function derangement(m: number): bigint;
/** Feige arXiv:1812.11774, Corollary 21: E[RANKING on D_n] = ((n+1)! - d(n+1) - d(n)) / n!. */
export declare function feigeRankingExpectation(n: number): number;
/**
 * Exhaustive RANKING expectation on MonotoneG: run the algorithm under every
 * one of the n! rank permutations. Exact kernel; the permutation enumeration
 * is Heap's algorithm. Limited to n <= 9 (362880 permutations).
 */
export declare function rankingExpectationExhaustive(n: number): number;
/**
 * Exact expectation of greedy with uniformly random tie-breaking on MonotoneG,
 * by subset dynamic programming over the suffix structure. At step j the only
 * relevant state is the set of taken workers inside the live window [j, n)
 * (workers below j are unreachable forever after); the arrival takes a
 * uniformly random available neighbor. Exact in double precision (products of
 * unit fractions; cross-checked against the derangement formula and Monte
 * Carlo in EXP6/tests — the KVV Lemma 13 consequence).
 */
export declare function greedyUniformExpectationExact(n: number): number;
/** Deterministic tie-break rules the phase adversary can observe. */
export type DeterministicTieBreak = "lowest" | "highest";
/**
 * The deterministic 1/2-tight phase adversary (Feige Section 1 sketch): the
 * first n/2 arrivals see ALL workers; the adversary records the set S the
 * (fixed, deterministic) rule matches them to; the last n/2 arrivals see
 * exactly S. Once the rule is fixed this is an oblivious instance; greedy
 * matches exactly n/2 while OPT = n (phase 2 to S, phase 1 to the complement).
 */
export declare function deterministicGreedyHalfInstance(n: number, rule: DeterministicTieBreak): ObmInstance;
export type TightFamily = "kv-monotone" | "greedy-adversary";
export type TightAlgorithm = "ranking" | "greedy-uniform" | "greedy-lowest" | "greedy-highest";
export interface TightClaim {
    readonly family: TightFamily;
    readonly n: number;
    readonly algorithm: TightAlgorithm;
    /** Claimed E[matching size] of the algorithm on the family. */
    readonly claimedExpectedSize: number;
    /** Claimed competitive ratio the family allegedly forces exactly. */
    readonly claimedRatio: number;
}
export interface TightViolation {
    readonly name: string;
    readonly detail: string;
}
export interface TightVerdict {
    readonly accepted: boolean;
    readonly violations: readonly TightViolation[];
    readonly machineExpectedSize: number;
    readonly machineOpt: number;
    readonly machineRatio: number;
}
/**
 * Verify a tightness certificate against the machine kernels. The checker
 * never trusts the claim's numbers: it rebuilds the canonical instance for
 * the family, recomputes OPT (Kuhn) and the exact expectation (derangement
 * formula / subset DP / deterministic replay), and NAMES every deviation.
 */
export declare function verifyTightCertificate(claim: TightClaim): TightVerdict;
export interface LedgerClaim {
    readonly mode: "linear" | "grover";
    readonly claimedReads: number;
    readonly claimedMeanSize: number;
    readonly claimedDisagreements: number;
}
export interface LedgerVerdict {
    readonly accepted: boolean;
    readonly violations: readonly TightViolation[];
    readonly machineMeanReads: number;
    readonly machineMeanSize: number;
    readonly machineMeanDisagreements: number;
}
/**
 * Verify a claimed per-arrival query ledger for RANKING on an instance by
 * replaying it over the given seeds with the exported kernels. Named
 * rejections: an impossibly cheap ledger (below the one-read-per-arrival
 * floor, or linear reads differing from the exact n-per-arrival rule),
 * disagreement laundering (claimed 0 while the replay shows misses), and a
 * claimed mean size deviating beyond the bounded-error miss budget.
 */
export declare function verifyQueryLedger(inst: ObmInstance, claim: LedgerClaim, seeds: number): LedgerVerdict;
