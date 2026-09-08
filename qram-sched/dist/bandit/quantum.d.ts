/**
 * Quantum replay scheduler for stochastic task streams.
 *
 * Premise (the qRAM layer of this repository): the environment that generates
 * the stream is replayable and quantum-accessible — a qRAM holds the reward
 * source, and amplitude estimation reads arm means to precision eps with
 * O(1/eps) oracle queries (Brassard-Hoyer-Mosca-Tapp; Montanaro for general
 * Monte Carlo). Exploration then costs ORACLE QUERIES, not live plays, so it
 * never enters the regret ledger.
 *
 * The scheduler runs staged estimation with growing phase registers
 * m_1 < m_2 < ... and commits once the empirical best is separated from the
 * runner-up by the QAE resolution scale 2*pi/2^m. Quantum measurement
 * outcomes are drawn from the EXACT QAE distribution (qaeDistribution), so the
 * scheduler's randomness is the physical measurement randomness, seeded for
 * reproducibility.
 *
 * Honest accounting: a CLASSICAL scheduler with simulator access (replay ETC)
 * also achieves near-zero regret — with quadratically more queries
 * (Theta(1/eps^2) vs Theta(1/eps)). The regret frontier moves because the
 * information model changes (live -> replayable); the quantum advantage is
 * the quadratic query law inside the replay model.
 */
import { Rng } from "../core/rng.js";
export interface QuantumRun {
    readonly regret: number;
    readonly plays: number;
    readonly queries: number;
    readonly committedArm: number;
    readonly rounds: number;
}
/** Draw one amplitude-estimation outcome for true amplitude p with m phase qubits, from the exact distribution. */
export declare function sampleQae(p: number, m: number, rng: Rng): number;
/**
 * Staged QAE explore-then-commit on k Bernoulli arms, horizon T live plays after commit.
 * Phase-register schedule: m in [mStart, mStart + mStep, ...] up to mMax.
 * Separation margin: 3*pi/2^m (1.5 QAE resolution cells) — tight enough to stay
 * O(1/Delta), loose enough to keep the wrong-commit rate near zero.
 */
export declare function quantumReplayRun(means: readonly number[], horizon: number, seed: number, mStart?: number, mMax?: number, mStep?: number): QuantumRun;
/**
 * Classical replay counterpart: N simulator samples per arm (each costs one
 * query, no regret), then commit. This is the fair classical baseline inside
 * the replay model.
 */
export declare function classicalReplayQueries(delta: number, k: number, failureProb: number): number;
