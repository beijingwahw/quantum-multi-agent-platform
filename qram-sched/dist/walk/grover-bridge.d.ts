/**
 * G5-b (v0.5.0) — the exact Szegedy↔Grover reduction on the two-state flip
 * family, as a machine anchor between the walk module and the amplitude-
 * estimation module.
 *
 * Honest note on the spec: the R18-G candidate asserted the two-state
 * detection sequence is "exactly sin²((2k+1)θ)". Machine verification
 * (R20, before any code landed) refuted that literal form on this repo's
 * flip-flop Szegedy engine: the sequence is a *two-phase* object. The
 * theorem below is what actually holds — every clause is closed-form and
 * cross-checked against the engine to machine precision in
 * test/grover-bridge.test.ts.
 *
 * SG1 (spectrum, closed form). For the non-lazy two-state flip chain
 *       P = [[1−q, q], [1−q, q]]  (each step flips to state 1 with prob q),
 * the walk operator U = C·S·R on the 4-edge space has the palindromic
 * characteristic polynomial
 *       λ⁴ − (2−4q)·λ³ + ((2−4q)²/2)·λ² − (2−4q)·λ + 1,
 * i.e. tr U = 2−4q, tr U² = 0, det U = 1, identically in q. Its eigenphases
 * w₁ ≥ w₂ are given by the root expressions
 *       cos w± = (1 − 2q ± √(1 + 4q(1−q)))/2,
 * and they always satisfy the phase-lock identity
 *       w₁ − w₂ ≡ π/2 (mod π)   ⟺   cos 2w₁ = −cos 2w₂,
 * with cos w₁·cos w₂ = −2q(1−q) and sin w₁·sin w₂ = 2q(1−q).
 *
 * SG2 (detection-sequence closed form). Starting from φ₀ (start state 0,
 * marked vertex 1), the first-coordinate detection sequence is
 *       p_k = 1/2 + [k odd: D_o, k even: D_e]·cos(2w₁k) + [k even] C·(−1)^{k/2},
 *       D_o = (q − 1/2)/cos 2w₁,
 *       D_e = (4q(1−q) − 1/2 + C)/cos 4w₁,
 *       C   = −2q(1−q)/(1 + 4q(1−q)),
 * matching the engine's detectionCurve to ≤1e-13 (all q ∈ (0,1), including
 * the degenerate point below).
 *
 * SG3 (Grover degenerate point). At q = 1/2 the two frequencies coincide
 * (2w₁ = π/2 = the parity-modulation frequency) and the sequence collapses
 * to the pure equally-spaced-phase (Grover-form) sequence
 *       p_k = sin²(kπ/4) = (1 − cos(πk/2))/2.
 * At general q the ODD subsequence p_{2m+1} = A·sin²((2m+1)w₁) + B is an
 * exact affine Grover sequence (ampest's groverSuccessClosedForm family at
 * angle w₁); the even subsequence splits per half-parity into the same
 * family with phase offset — the walk↔ampest bridge: one arithmetic-phase
 * family across both modules, the walk advancing phase at half the Grover
 * rate per step.
 *
 * SG4 (lazy spectrum and the √ speedup). Under lazyChain (P' = (P+I)/2) the
 * operator has tr U' = 1−2q, tr U'² = 1, with the leading eigenphase w₁'
 * obeying the same invariant-based quadratic and w₁' ~ √(2q/3) for small q:
 * detection in Θ(√(1/q)) steps. The non-lazy family has w₁ ~ c·q, i.e.
 * Θ(1/q) detection — lazification is where the quadratic speedup enters on
 * this family (the closed-form source of exp2-B's measured const/√q).
 *
 * Scope: the two-state flip family (this module builds both variants);
 * general chains/graphs remain numerical laws of the walk module.
 *
 * References: Szegedy-2004 "Quantum speed-up of Markov chain Monte Carlo
 * methods" (walk spectrum / detection); Magniez–Nayak–Roland–Santha-2006
 * "Search via quantum walk" (detection framework); both in-repo anchors of
 * src/walk/szegedy.ts; BHMT-2000 amplitude amplification (ampest module).
 * The phase-lock identity SG1 and the SG2 coefficients are derived and
 * machine-verified in-repo; no external claim is made for their novelty
 * 〔待双源〕.
 */
import { type Chain } from "./szegedy.js";
/** The two-state flip chain of exp2-B: from either state, jump to 1 with prob q. */
export declare function twoStateFlipChain(q: number): Chain;
/** Its lazy version (P' = (P+I)/2) — the family exp2 actually runs. */
export declare function twoStateFlipChainLazy(q: number): Chain;
/** Palindromic characteristic-polynomial data of the non-lazy flip walk (SG1). */
export interface FlipCharPoly {
    readonly tr: number;
    readonly tr2: number;
    readonly c1: number;
    readonly c2: number;
    readonly c3: number;
    readonly det: number;
}
/** Closed-form coefficients: λ⁴ − c₁λ³ + c₂λ² − c₃λ + 1 with c₁ = c₃ = 2−4q, c₂ = (2−4q)²/2. */
export declare function flipWalkCharPoly(q: number): FlipCharPoly;
/**
 * The dense 4×4 walk operator U = C·S·R on the edge basis (e00, e01, e10,
 * e11) — the independent numerical road for every spectral claim (used by
 * tests; exported so the referee lives next to the theorem).
 */
export declare function numericFlipWalkOperator(q: number): number[][];
/** Eigenphase data of the non-lazy flip walk (SG1), with the phase-lock identity. */
export interface FlipEigenphases {
    readonly w1: number;
    readonly w2: number;
    readonly cosW1: number;
    readonly cosW2: number;
    /** w₁ − w₂ + π/2 (machine zero ⟺ the phase lock w₁ − w₂ ≡ −π/2). */
    readonly phaseLockResidual: number;
    /** cos 2w₁ + cos 2w₂ (machine zero ⟺ same identity, doubled angle). */
    readonly doubleAngleResidual: number;
    /** cos w₁ cos w₂ + 2q(1−q) (machine zero). */
    readonly cosProductResidual: number;
    /** sin w₁ sin w₂ − 2q(1−q) (machine zero). */
    readonly sinProductResidual: number;
}
/** Root-expression eigenphases cos w± = (1 − 2q ± √(1+4q(1−q)))/2 plus identity residuals. */
export declare function flipWalkEigenphases(q: number): FlipEigenphases;
/** Closed-form coefficients of the detection sequence (SG2). */
export interface DetectionCoefficients {
    readonly oddStep: number;
    readonly evenStep: number;
    readonly parityModulation: number;
    readonly w1: number;
}
/** D_o, D_e, C — the three constants of SG2 (q = 1/2 is returned by the degenerate branch). */
export declare function detectionCoefficients(q: number): DetectionCoefficients;
/** The closed-form detection value p_k (SG2); q = 1/2 collapses to sin²(kπ/4) (SG3). */
export declare function detectionClosedForm(q: number, k: number): number;
/** The whole closed-form curve p_1..p_steps (against SzegedyWalk.detectionCurve). */
export declare function detectionCurveClosedForm(q: number, steps: number): Float64Array;
/** First step at which the closed-form curve crosses threshold (−1 when never). */
export declare function closedFormDetectionTime(q: number, threshold: number, maxSteps: number): number;
/**
 * The Grover-form bridge (SG3): the ODD subsequence p_{2m+1} reparametrized
 * exactly as A·sin²((2m+1)·θ) + B with θ = w₁ (the walk's eigenangle) —
 * ampest's groverSuccessClosedForm family at half the per-step phase
 * advance. The even subsequence carries the extra (−1)^m modulation and is
 * pinned per half-parity in the tests instead (honest scope).
 */
export declare function affineGroverForm(q: number): {
    A: number;
    theta: number;
    B: number;
};
