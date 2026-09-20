/**
 * E13 — the biased causal game's exact double-cone phase diagram (the silver
 * ratio cone), executed.
 *
 * THE CLAIM ON TRIAL: bias the OCB12 branch mix to ℐ(c1,c2) = c1·P(x=b) +
 * c2·P(y=a) with c1, c2 > 0 (the uniform game of T2/T3 is c1 = c2 = 1/2).
 * Three layers, each exact:
 *
 * (a) CLASSICAL CAP: cap(c1,c2) = max(c1 + c2/2, c1/2 + c2) — piecewise
 *     linear with the kink on the diagonal r = c2/c1 = 1. Each definite order
 *     saturates one branch and leaves the other at chance: A≺B carries a
 *     forward so P(y=a) = 1 while x blind-guesses b (P(x=b) = 1/2); B≺A the
 *     mirror. Shared randomness is a convex mixture and cannot move a linear
 *     cap. Machine face: the SAME 8,192 deterministic strategies classical.ts
 *     exhausts, re-weighted strategy by strategy.
 *
 * (b) W* CONE (the OCB point process W*(1/√2), fixed): the certificate's
 *     per-branch bounds P_A ≤ ½(1+c2), P_B ≤ ½(1+c1) (certificate.ts, lemmas
 *     L1–L4) hold for EVERY nonnegative weight pair, and the OCB z/x protocol
 *     attains both at once — so the F_q-optimal biased payoff on W* is exactly
 *     (c1+c2)·cos²(π/8), not merely the OCB protocol's number. Against the
 *     cap, branch r ≤ 1 compares (1+r)cos²(π/8) with 1 + r/2: the sign flips
 *     where r*(cos²(π/8) − ½) = 1 − cos²(π/8), i.e. r*·(√2/4) = (2−√2)/4,
 *     so r* = √2 − 1 — the SILVER RATIO. Branch r ≥ 1 is the mirror with
 *     breakpoint 1/r* = √2 + 1. W* therefore violates the causal cap exactly
 *     inside the double cone r ∈ (√2−1, √2+1), ties at both endpoints, and
 *     loses outside; the uniform game (r = 1) sits at the cone's centre.
 *
 * (c) LC25 OPTIMAL ICO (cited, executed; optimality NOT re-proven here): the
 *     exact ICO bound of the biased functional ℐ_α = P_A + α·P_B over all
 *     processes and operations is (1+α+√(1+α²))/2, attained by S_OCB,α —
 *     ocb12.ts's wBiased(α), with attainment and literature equivalence
 *     machine-checked by T4/T5. In symmetric weight form
 *         sup_ICO(c1,c2) = (c1 + c2 + √(c1²+c2²)) / 2,
 *     which exceeds the cap on the WHOLE open positive quadrant, gap
 *     (√(c1²+c2²) − max(c1,c2))/2 > 0, vanishing only toward the two axes —
 *     the axis limits asymptotically re-touch the classical cap, while W*'s
 *     cone keeps a fixed finite width about the diagonal. At c1 = c2 the LC25
 *     value collapses to 1 + 1/√2 = 2cos²(π/8): the unbiased game sits where
 *     all three faces meet.
 *
 * Honest boundaries: two-lab two-bit ICO process class (the repo's domain);
 * layer (c)'s optimality rides on the LC25 citation (executed here only on
 * the attaining family); the W*-cone optimality is proven within family F_q
 * (the certificate's per-branch bounds), same as T4.
 */
import { NamedError } from "../core/cmat.js";
import { wStar } from "../process/construct.js";
import { wBiased } from "../process/ocb12.js";
import { COS2_PI_8, runProtocol } from "./quantum.js";
import { ocbStrategy, strategyPayoff } from "./strategy.js";

/** r* = √2 − 1 — the silver ratio, W*'s cone endpoint on the r = c2/c1 ≤ 1 branch. */
export const SILVER_RATIO = Math.SQRT2 - 1;
/** 1/r* = √2 + 1 — the conjugate endpoint on the r ≥ 1 branch. */
export const SILVER_RATIO_CONJUGATE = Math.SQRT2 + 1;

function requirePositiveWeights(c1: number, c2: number, fn: string): void {
  if (!Number.isFinite(c1) || !Number.isFinite(c2) || !(c1 > 0) || !(c2 > 0)) {
    throw new NamedError(
      "phase/nonpositive-weight",
      `${fn}: weights must be finite and strictly positive (got c1=${c1}, c2=${c2}) — the phase diagram lives on the open positive quadrant`,
    );
  }
}

// ---------------------------------------------------------------------------
// (a) the classical cap, closed form + the re-weighted 8,192-strategy sweep
// ---------------------------------------------------------------------------

/** cap(c1,c2) = max(c1 + c2/2, c1/2 + c2) — each order saturates one branch. */
export function classicalCapBiased(c1: number, c2: number): number {
  requirePositiveWeights(c1, c2, "classicalCapBiased");
  return Math.max(c1 + c2 / 2, c1 / 2 + c2);
}

export interface BiasedSweepResult {
  readonly maxPayoff: number;
  readonly strategiesSwept: number;
  readonly argmaxCount: number;
  readonly orders: { readonly aFirst: number; readonly bFirst: number };
}

/** Weighted payoff of one A≺B deterministic run: ℐ = (c1·wins0 + c2·wins1)/4. */
function payoffAB(
  f: (a: number) => number,
  g: (a: number) => number,
  h: (m: number, b: number, bp: number) => number,
  c1: number,
  c2: number,
): number {
  let w0 = 0; // wins on the b'=0 branch (Alice guesses b)
  let w1 = 0; // wins on the b'=1 branch (Bob guesses a)
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      const m = f(a);
      if (g(a) === b) w0++;
      if (h(m, b, 1) === a) w1++;
    }
  }
  return (c1 * w0 + c2 * w1) / 4;
}

/**
 * All 8,192 deterministic causal strategies (both orders, every message and
 * guess function — the classical.ts enumeration, re-weighted): the maximum of
 * ℐ(c1,c2) over causal strategies. Shared randomness is a convex mixture of
 * these, so this IS the classical value.
 */
export function sweepDeterministicBiased(
  c1: number,
  c2: number,
): BiasedSweepResult {
  requirePositiveWeights(c1, c2, "sweepDeterministicBiased");
  const funcs1 = [() => 0, () => 1, (x: number) => x, (x: number) => 1 - x];
  const allFns = (n: number): Array<(...xs: number[]) => number> => {
    const out: Array<(...xs: number[]) => number> = [];
    for (let table = 0; table < 2 ** (2 ** n); table++) {
      out.push(
        (...xs: number[]) =>
          (table >> xs.reduce((acc, x) => acc * 2 + x, 0)) & 1,
      );
    }
    return out;
  };

  let max = -Infinity;
  let argmax = 0;
  let aFirstMax = -Infinity;
  let bFirstMax = -Infinity;
  let swept = 0;

  // A ≺ B: f: a -> m (4), g: a -> x (4), h: (m, b, b') -> y (256)
  for (const f of funcs1) {
    for (const g of funcs1) {
      for (const h of allFns(3)) {
        const p = payoffAB(f, g, h, c1, c2);
        swept++;
        if (p > aFirstMax) aFirstMax = p;
        if (p > max + 1e-15) {
          max = p;
          argmax = 1;
        } else if (Math.abs(p - max) < 1e-15) {
          argmax++;
        }
      }
    }
  }

  // B ≺ A: f: (b, b') -> m (16), g: (b, b') -> y (16), h: (m, a) -> x (16)
  const fns2 = allFns(2);
  for (const f of fns2) {
    for (const g of fns2) {
      for (const h of fns2) {
        let w0 = 0;
        let w1 = 0;
        for (let a = 0; a < 2; a++) {
          for (let b = 0; b < 2; b++) {
            // branch b'=0: Alice reads m = f(b, 0); branch b'=1: Bob guesses with g(b, 1)
            const m = f(b, 0);
            if (h(m, a) === b) w0++;
            if (g(b, 1) === a) w1++;
          }
        }
        const p = (c1 * w0 + c2 * w1) / 4;
        swept++;
        if (p > bFirstMax) bFirstMax = p;
        if (p > max + 1e-15) {
          max = p;
          argmax = 1;
        } else if (Math.abs(p - max) < 1e-15) {
          argmax++;
        }
      }
    }
  }

  return {
    maxPayoff: max,
    strategiesSwept: swept,
    argmaxCount: argmax,
    orders: { aFirst: aFirstMax, bFirst: bFirstMax },
  };
}

// ---------------------------------------------------------------------------
// (b) the W* cone — endpoint algebra + the executed margin
// ---------------------------------------------------------------------------

export interface ConeEndpointResiduals {
  /** |(1+r)cos²(π/8) − (1 + r/2)| evaluated at r = r* = √2−1 (the branch r ≤ 1 tie) */
  readonly branchLowTie: number;
  /** |(1+r)cos²(π/8) − (1/2+r)| at r = √2+1 (the branch r ≥ 1 tie) */
  readonly branchHighTie: number;
  /** |1/(√2−1) − (√2+1)| (the cone's mirror symmetry) */
  readonly conjugateIdentity: number;
  /** |r*² + 2r* − 1| (r* is the positive root of r² + 2r − 1 — the silver equation) */
  readonly silverQuadratic: number;
}

/** The cone endpoints solve quadratics over ℚ(√2); each identity is checked to float precision here. */
export function coneEndpointResiduals(): ConeEndpointResiduals {
  return {
    branchLowTie: Math.abs(
      (1 + SILVER_RATIO) * COS2_PI_8 - (1 + SILVER_RATIO / 2),
    ),
    branchHighTie: Math.abs(
      (1 + SILVER_RATIO_CONJUGATE) * COS2_PI_8 -
        (1 / 2 + SILVER_RATIO_CONJUGATE),
    ),
    conjugateIdentity: Math.abs(1 / SILVER_RATIO - SILVER_RATIO_CONJUGATE),
    silverQuadratic: Math.abs(
      SILVER_RATIO * SILVER_RATIO + 2 * SILVER_RATIO - 1,
    ),
  };
}

let wstarBranchMemo:
  { readonly pAliceGuesses: number; readonly pBobGuesses: number } | undefined;

/**
 * The OCB z/x protocol's branch probabilities on W*(1/√2), executed once on
 * the process Born rule (runProtocol) and memoized — P(x=b) = P(y=a) =
 * cos²(π/8), the numbers T3 anchors.
 */
export function wstarBranchProbabilities(): {
  readonly pAliceGuesses: number;
  readonly pBobGuesses: number;
} {
  if (wstarBranchMemo === undefined) {
    const p = runProtocol(wStar(Math.SQRT1_2));
    wstarBranchMemo = {
      pAliceGuesses: p.pAliceGuesses,
      pBobGuesses: p.pBobGuesses,
    };
  }
  return wstarBranchMemo;
}

export interface WStarFace {
  /** c1·P(x=b) + c2·P(y=a) from the executed branch probabilities */
  readonly payoffExecuted: number;
  /** (c1+c2)·cos²(π/8) — the closed form the executed number must equal */
  readonly payoffClosedForm: number;
  readonly deviation: number;
  /** payoffExecuted − cap(c1,c2): > 0 inside the cone, 0 at the endpoints, < 0 outside */
  readonly marginVsCap: number;
  readonly violates: boolean;
}

/** The W* face of the diagram at weights (c1,c2): executed, not asserted. */
export function wstarFace(c1: number, c2: number): WStarFace {
  requirePositiveWeights(c1, c2, "wstarFace");
  const br = wstarBranchProbabilities();
  const payoffExecuted = c1 * br.pAliceGuesses + c2 * br.pBobGuesses;
  const payoffClosedForm = (c1 + c2) * COS2_PI_8;
  const marginVsCap = payoffExecuted - classicalCapBiased(c1, c2);
  return {
    payoffExecuted,
    payoffClosedForm,
    deviation: Math.abs(payoffExecuted - payoffClosedForm),
    marginVsCap,
    violates: marginVsCap > 1e-12,
  };
}

export interface ConeClaimVerdict {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  /** the executed margin at r (with c1 = 1) — the only evidence the verdict uses */
  readonly margin: number;
}

/**
 * Cone-claim adjudicator (the smuggling trial's phase face): a claim that W*
 * does / does not violate at ratio r is accepted only in the direction the
 * executed Born-rule margin signs; claims within tolerance of the endpoint
 * are named undecided, and contradicting claims are NAMED and REJECTED.
 */
export function adjudicateConeClaim(
  r: number,
  claimsViolates: boolean,
  tol = 1e-9,
): ConeClaimVerdict {
  if (!Number.isFinite(r) || !(r > 0)) {
    return {
      accepted: false,
      reasons: [
        `REJECT[invalid-ratio]: r = ${r} is not a positive finite ratio`,
      ],
      margin: NaN,
    };
  }
  const margin = wstarFace(1, r).marginVsCap;
  const reasons: string[] = [];
  if (Math.abs(margin) <= tol) {
    reasons.push(
      `REJECT[endpoint-undecided]: r = ${r} sits on the cone boundary (executed margin ${margin.toExponential(2)}) — neither "violates" nor "clean" is claimable there`,
    );
  } else if (claimsViolates !== margin > 0) {
    reasons.push(
      `REJECT[claim-vs-execution]: claimed ${claimsViolates ? "violation" : "no violation"} at r = ${r}, but the executed margin is ${margin.toExponential(2)} (${margin > 0 ? "violates" : "clean"})`,
    );
  }
  return { accepted: reasons.length === 0, reasons, margin };
}

// ---------------------------------------------------------------------------
// (c) the LC25 face — executed on the attaining family, gap formula checked
// ---------------------------------------------------------------------------

export interface LC25Face {
  /** α = c2/c1 (LC25's normalisation of the biased functional) */
  readonly alpha: number;
  /** ℐ_α = P_A + α·P_B executed on S_OCB,α via the process Born rule */
  readonly payoffExecuted: number;
  /** (c1 + c2 + √(c1²+c2²))/2 — the symmetric weight form of (1+α+√(1+α²))/2 */
  readonly closedForm: number;
  readonly deviation: number;
  /** closedForm − cap(c1,c2) = (√(c1²+c2²) − max(c1,c2))/2 > 0 on the open quadrant */
  readonly marginVsCap: number;
  /** (√(c1²+c2²) − max(c1,c2))/2 — the independent gap identity */
  readonly gapFormula: number;
}

/** The optimal-ICO face at weights (c1,c2): executed on wBiased(α), closed form in weights. */
export function lc25Face(c1: number, c2: number): LC25Face {
  requirePositiveWeights(c1, c2, "lc25Face");
  const alpha = c2 / c1;
  const pr = strategyPayoff(wBiased(alpha), ocbStrategy());
  const payoffExecuted = pr.pAliceGuesses + alpha * pr.pBobGuesses; // α-normalised: ℐ_α = P_A + α·P_B
  const closedForm = (c1 + c2 + Math.hypot(c1, c2)) / 2; // = c1·(1+α+√(1+α²))/2, weight units
  return {
    alpha,
    payoffExecuted,
    closedForm,
    deviation: Math.abs(c1 * payoffExecuted - closedForm),
    marginVsCap: closedForm - classicalCapBiased(c1, c2),
    gapFormula: (Math.hypot(c1, c2) - Math.max(c1, c2)) / 2,
  };
}

export interface PhasePoint {
  readonly c1: number;
  readonly c2: number;
  /** r = c2/c1 */
  readonly ratio: number;
  readonly cap: number;
  readonly wstar: WStarFace;
  readonly lc25: LC25Face;
}

/** The full three-layer phase point at weights (c1,c2): cap, W* face, LC25 face. */
export function phasePoint(c1: number, c2: number): PhasePoint {
  requirePositiveWeights(c1, c2, "phasePoint");
  return {
    c1,
    c2,
    ratio: c2 / c1,
    cap: classicalCapBiased(c1, c2),
    wstar: wstarFace(c1, c2),
    lc25: lc25Face(c1, c2),
  };
}
