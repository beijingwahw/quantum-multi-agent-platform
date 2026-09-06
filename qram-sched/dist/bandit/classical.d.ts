export interface BanditRun {
    /** Cumulative regret vs the best arm in hindsight (means known to the referee, not the algorithm). */
    regret: number;
    /** Total live plays (each consumes a task; classical exploration burns these). */
    plays: number;
    /** Inner-loop oracle reads of the score table (the compute ledger). */
    oracleReads: number;
    decisions: Uint8Array;
}
/** UCB1 on k Bernoulli arms with true means, horizon T. */
export declare function ucb1Run(means: readonly number[], horizon: number, seed: number): BanditRun;
/** Explore-then-commit. Mode 'live': exploration samples are live plays that pay regret
 *  (the classical online world). Mode 'replay': samples are drawn from a replayable
 *  environment (classical simulator access — no regret, but each sample costs a query). */
export declare function etcRun(means: readonly number[], horizon: number, samplesPerArm: number, seed: number, mode?: "live" | "replay"): BanditRun;
/**
 * Adversarial bandit stream: oblivious i.i.d. uniform binary rewards — the
 * standard minimax construction of Auer et al. (2002) that forces
 * Θ(sqrt(kT)) regret against any algorithm observing only played-arm feedback.
 * The algorithm is an Exp3-style policy; its argmax inner loop can be served
 * either by a linear scan or by a quantum search harness (identical decision
 * rule), demonstrating that compute acceleration leaves adversarial regret
 * untouched — the wall is informational, not computational.
 */
export declare function adversarialRun(k: number, horizon: number, seed: number, gamma: number, search: <T>(scores: readonly T[], less: (x: T, y: T) => boolean) => {
    best: number;
    reads: number;
}): BanditRun;
