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
import { qaeDistribution, qaeEstimate, qaeQueries } from "../ae/ampest.js";
/** Draw one amplitude-estimation outcome for true amplitude p with m phase qubits, from the exact distribution. */
export function sampleQae(p, m, rng) {
    const dist = qaeDistribution(p, m);
    const u = rng.next();
    let acc = 0;
    for (let j = 0; j < dist.length; j++) {
        acc += dist[j];
        if (u < acc)
            return qaeEstimate(j, m);
    }
    return qaeEstimate(dist.length - 1, m);
}
/**
 * Staged QAE explore-then-commit on k Bernoulli arms, horizon T live plays after commit.
 * Phase-register schedule: m in [mStart, mStart + mStep, ...] up to mMax.
 * Separation margin: 3*pi/2^m (1.5 QAE resolution cells) — tight enough to stay
 * O(1/Delta), loose enough to keep the wrong-commit rate near zero.
 */
export function quantumReplayRun(means, horizon, seed, mStart = 3, mMax = 13, mStep = 1) {
    const k = means.length;
    const rng = new Rng(seed);
    const best = Math.max(...means);
    let queries = 0;
    let estimates = new Array(k).fill(0.5);
    let committed = 0;
    let rounds = 0;
    for (let m = mStart; m <= mMax; m += mStep) {
        rounds++;
        estimates = means.map((p) => sampleQae(p, m, rng));
        queries += k * qaeQueries(m);
        const sorted = [...estimates].sort((a, b) => b - a);
        const gap = sorted[0] - sorted[1];
        committed = estimates.indexOf(sorted[0]);
        if (gap > (3 * Math.PI) / 2 ** m) {
            break;
        }
    }
    const regret = horizon * (best - means[committed]);
    return { regret, plays: horizon, queries, committedArm: committed, rounds };
}
/**
 * Classical replay counterpart: N simulator samples per arm (each costs one
 * query, no regret), then commit. This is the fair classical baseline inside
 * the replay model.
 */
export function classicalReplayQueries(delta, k, failureProb) {
    // Separating arms with gap delta by binomial concentration:
    // N ~ ln(2k/failure) / (2 * (delta/2)^2) samples per arm (Hoeffding).
    return Math.ceil((Math.log((2 * k) / failureProb)) / (2 * (delta / 2) ** 2)) * k;
}
