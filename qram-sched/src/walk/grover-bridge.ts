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

import { lazyChain, type Chain } from "./szegedy.js";
import { reject } from "../core/errors.js";

/** The two-state flip chain of exp2-B: from either state, jump to 1 with prob q. */
export function twoStateFlipChain(q: number): Chain {
  requireQ(q, "twoStateFlipChain");
  return {
    n: 2,
    neighbors: [
      [0, 1],
      [1, 0],
    ],
    probs: [
      [1 - q, q],
      [q, 1 - q],
    ],
  };
}

/** Its lazy version (P' = (P+I)/2) — the family exp2 actually runs. */
export function twoStateFlipChainLazy(q: number): Chain {
  return lazyChain(twoStateFlipChain(q));
}

// Domain guards reuse the closed code union (the payback precedent of
// semantic-width reuse): the flip probability is a chain-construction
// parameter (WALK_CHAIN_SHAPE) and the step caps are k-range faces
// (AE_K_RANGE) — the anonymous-throw surface stays retired.
function requireQ(q: number, what: string): void {
  if (!(Number.isFinite(q) && q > 0 && q < 1)) {
    reject(
      "WALK_CHAIN_SHAPE",
      `${what}: flip probability q must lie in (0, 1) (got ${q})`,
    );
  }
}

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
export function flipWalkCharPoly(q: number): FlipCharPoly {
  requireQ(q, "flipWalkCharPoly");
  const c1 = 2 - 4 * q;
  return { tr: c1, tr2: 0, c1, c2: (c1 * c1) / 2, c3: c1, det: 1 };
}

/**
 * The dense 4×4 walk operator U = C·S·R on the edge basis (e00, e01, e10,
 * e11) — the independent numerical road for every spectral claim (used by
 * tests; exported so the referee lives next to the theorem).
 */
export function numericFlipWalkOperator(q: number): number[][] {
  requireQ(q, "numericFlipWalkOperator");
  const sq = Math.sqrt(q);
  const sc = Math.sqrt(1 - q);
  const phi0 = [sc, sq, 0, 0];
  const phi1 = [0, 0, sc, sq]; // row 1 neighbor order [1,0]: e11 weight √q, e10 weight √(1−q)
  const dot = (a: readonly number[], b: readonly number[]): number =>
    a.reduce((t, x, i) => t + x * b[i]!, 0);
  const R = (v: readonly number[]): number[] => {
    const p0 = dot(phi0, v);
    const p1 = dot(phi1, v);
    return v.map((x, i) => 2 * p0 * phi0[i]! + 2 * p1 * phi1[i]! - x);
  };
  const S = (v: readonly number[]): number[] => [v[0]!, v[2]!, v[1]!, v[3]!];
  const C = (v: readonly number[]): number[] => [v[0]!, -v[1]!, -v[2]!, -v[3]!]; // marked = 1
  return [0, 1, 2, 3].map((i) =>
    C(S(R([0, 1, 2, 3].map((j) => (j === i ? 1 : 0))))),
  );
}

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
export function flipWalkEigenphases(q: number): FlipEigenphases {
  requireQ(q, "flipWalkEigenphases");
  const disc = Math.sqrt(1 + 4 * q * (1 - q));
  const cosW1 = (1 - 2 * q + disc) / 2;
  const cosW2 = (1 - 2 * q - disc) / 2;
  const w1 = Math.acos(cosW1);
  const w2 = Math.acos(cosW2);
  return {
    w1,
    w2,
    cosW1,
    cosW2,
    phaseLockResidual: w1 - w2 + Math.PI / 2,
    doubleAngleResidual: Math.cos(2 * w1) + Math.cos(2 * w2),
    cosProductResidual: cosW1 * cosW2 + 2 * q * (1 - q),
    sinProductResidual: Math.sin(w1) * Math.sin(w2) - 2 * q * (1 - q),
  };
}

/** Closed-form coefficients of the detection sequence (SG2). */
export interface DetectionCoefficients {
  readonly oddStep: number;
  readonly evenStep: number;
  readonly parityModulation: number;
  readonly w1: number;
}

/** D_o, D_e, C — the three constants of SG2 (q = 1/2 is returned by the degenerate branch). */
export function detectionCoefficients(q: number): DetectionCoefficients {
  requireQ(q, "detectionCoefficients");
  if (Math.abs(q - 0.5) < 1e-15) {
    // degenerate point: cos 2w₁ = 0, D_o limit = (q−1/2)/cos 2w₁ → 0; sequence is sin²(kπ/4)
    return { oddStep: 0, evenStep: 0, parityModulation: -0.5, w1: Math.PI / 4 };
  }
  const { w1 } = flipWalkEigenphases(q);
  const x = q * (1 - q);
  const c = (-2 * x) / (1 + 4 * x);
  const oddStep = (q - 0.5) / Math.cos(2 * w1);
  const evenStep = (4 * x - 0.5 + c) / Math.cos(4 * w1);
  return { oddStep, evenStep, parityModulation: c, w1 };
}

/** The closed-form detection value p_k (SG2); q = 1/2 collapses to sin²(kπ/4) (SG3). */
export function detectionClosedForm(q: number, k: number): number {
  requireQ(q, "detectionClosedForm");
  if (!Number.isInteger(k) || k < 1)
    reject("AE_K_RANGE", `k ≥ 1 steps required (got ${k})`);
  if (Math.abs(q - 0.5) < 1e-15) return Math.sin((k * Math.PI) / 4) ** 2;
  const { oddStep, evenStep, parityModulation, w1 } = detectionCoefficients(q);
  const d = k % 2 === 1 ? oddStep : evenStep;
  const parity = k % 2 === 0 ? parityModulation * (k % 4 === 0 ? 1 : -1) : 0;
  return 0.5 + d * Math.cos(2 * w1 * k) + parity;
}

/** The whole closed-form curve p_1..p_steps (against SzegedyWalk.detectionCurve). */
export function detectionCurveClosedForm(
  q: number,
  steps: number,
): Float64Array {
  if (!Number.isInteger(steps) || steps < 1 || steps > 100000) {
    reject(
      "AE_M_RANGE",
      `steps must be an integer in [1, 100000] (got ${steps})`,
    );
  }
  const out = new Float64Array(steps);
  for (let k = 1; k <= steps; k++) out[k - 1] = detectionClosedForm(q, k);
  return out;
}

/** First step at which the closed-form curve crosses threshold (−1 when never). */
export function closedFormDetectionTime(
  q: number,
  threshold: number,
  maxSteps: number,
): number {
  const curve = detectionCurveClosedForm(q, maxSteps);
  for (let k = 0; k < maxSteps; k++) {
    if ((curve[k] as number) >= threshold) return k + 1;
  }
  return -1;
}

/**
 * The Grover-form bridge (SG3): the ODD subsequence p_{2m+1} reparametrized
 * exactly as A·sin²((2m+1)·θ) + B with θ = w₁ (the walk's eigenangle) —
 * ampest's groverSuccessClosedForm family at half the per-step phase
 * advance. The even subsequence carries the extra (−1)^m modulation and is
 * pinned per half-parity in the tests instead (honest scope).
 */
export function affineGroverForm(q: number): {
  A: number;
  theta: number;
  B: number;
} {
  requireQ(q, "affineGroverForm");
  if (Math.abs(q - 0.5) < 1e-15) {
    // sin²(kπ/4) with k odd = sin²(π/4) or sin²(3π/4): the degenerate Grover point
    return { A: 1, theta: Math.PI / 4, B: 0 };
  }
  const { oddStep, w1 } = detectionCoefficients(q);
  // 1/2 + D_o·cos(2w₁(2m+1)) = (1/2 + D_o) − 2·D_o·sin²((2m+1)·w₁)
  return { A: -2 * oddStep, theta: w1, B: 0.5 + oddStep };
}
