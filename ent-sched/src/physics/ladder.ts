/**
 * E7 (v0.5.0) — the purification-ladder phase boundary as a closed-form
 * iterated-function-system (IFS) supremum.
 *
 * The engine's ERS "mixed ladder" (see src/net/policies.ts) purifies a
 * champion Werner pair against a stream of fresh pairs at link fidelity F₀
 * and mixes at the fresh-fixed point ≈0.909 (policies.ts's own no-op
 * threshold). This module turns that empirical wall into algebra:
 *
 *  L1 (composite). Werner 2→1 purification g(f₁,f₂) is a strictly increasing
 *     rational function of both arms on (1/2, 1]. The equal-arm map g(f,f)
 *     has exactly the fixed points {1/4, 1/2, 1} — the BBPSSW improvement
 *     threshold F > 1/2 in closed form.
 *
 *  L2 (fresh-mix fixed point). The upper fixed point μ(F) of f ↦ g(f, F) is
 *     the positive root of the explicit quadratic
 *         2(4F−1)μ² + 6(1−2F)μ + (F−1) = 0,
 *     a root-expression in F; μ(F) > F ⟺ F > 1/2, and the chain ladder
 *     f_{k+1} = g(f_k, F₀) increases monotonically to μ(F₀).
 *
 *  L3 (nested IFS saturation / phase boundary). With s memory slots the
 *     steady-state saturation fidelity the mixed ladder can hold satisfies
 *     the nested-fixed-point recurrence
 *         S₁ = F₀,   S_{s+1} = μ(S_s)
 *     (one champion slot + the (s−1)-slot subsystem as its fresh supply).
 *     S_s is strictly increasing in both s and F₀, so the phase boundary
 *         F₀*(s, fMin) = min{ F₀ ∈ (1/2, 1) : S_s(F₀) ≥ fMin }
 *     exists, is unique, and is bracketable to arbitrary precision: the
 *     exp4-D empirical walls become special points of this closed form.
 *
 *  L4 (batch ladder). A one-shot batch of 2^k fresh pairs fused bottom-up
 *     (equal-rung composition, the "2^k ladder" of exp4-A) reaches
 *     B_k(F₀) with B_{k+1} = g(B_k, B_k) — the transient ceiling above the
 *     steady wall; the batch-leaf requirement to reach fMin follows.
 *
 * Scope (honest boundary): Werner/twirled family only, value-range (no
 * success-probability or timing dynamics — those stay with the engine), and
 * the ERS "fresh pair as the low arm / lowest rungs fuse first" shapes.
 *
 * References: BBPSSW-1996 (purification recurrence; in-repo dual-sourced in
 * docs/citations.md); Hutchinson-1981 "Fractals and self-similarity"
 * (iterated function systems with a unique attractor) 〔待双源〕.
 */

import { werner } from "./bell.js";
import { purify2to1 } from "./ops.js";
import { SchedError } from "../core/errors.js";

/** Werner composition g(f₁, f₂) — output fidelity of purify2to1 on two Werner inputs. */
export function wernerComposite(f1: number, f2: number): number {
  const { out } = purify2to1(werner(f1), werner(f2));
  return out[0]!; // purify2to1 returns a length-4 Werner vector
}

/**
 * The equal-arm fixed-point set of g(f, f) (L1): exactly {1/4, 1/2, 1}.
 * 1/4 is the maximally-mixed attractor (F < 1/2 basin), 1/2 the separating
 * fixed point, 1 the pure attractor (F > 1/2 basin).
 */
export const EQUAL_ARM_FIXED_POINTS: readonly number[] = [0.25, 0.5, 1];

/**
 * Residual of the fixed-point polynomial for the equal-arm map: at each root
 * r the BBPSSW numerator satisfies 8r³ − 14r² + 7r − 1 = (2r−1)(4r−1)(r−1) = 0.
 */
export function equalArmPolynomial(f: number): number {
  return (2 * f - 1) * (4 * f - 1) * (f - 1);
}

function requireFreshDomain(F: number, what: string): void {
  if (!(Number.isFinite(F) && F > 0.5 && F < 1)) {
    throw new SchedError(
      "LADDER_F_RANGE",
      `${what}: fresh fidelity F must lie in (1/2, 1) (got ${F})`,
    );
  }
}

/** Coefficients of the fresh-mix fixed-point quadratic (L2), exposed for tests. */
export interface FreshMixQuadratic {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly discriminant: number;
}

/** The quadratic 2(4F−1)μ² + 6(1−2F)μ + (F−1) = 0 whose positive root is μ(F). */
export function freshMixQuadratic(F: number): FreshMixQuadratic {
  requireFreshDomain(F, "freshMixQuadratic");
  const a = 2 * (4 * F - 1);
  const b = 6 * (1 - 2 * F);
  const c = F - 1;
  return { a, b, c, discriminant: b * b - 4 * a * c };
}

/**
 * μ(F): the upper fixed point of f ↦ g(f, F) — the exact closed form behind
 * policies.ts's "mixing at the fresh-fixed point ≈0.909" (F = 0.85 gives
 * μ = 0.9093646522…). Monotone increasing in F; μ(F) > F ⟺ F > 1/2.
 */
export function freshMixFixedPoint(F: number): number {
  const { a, b, discriminant } = freshMixQuadratic(F);
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

/** Independent road: fixed-point iteration of f ↦ g(f, F) (cross-check for the quadratic). */
export function freshMixFixedPointSim(F: number, iterations = 5000): number {
  requireFreshDomain(F, "freshMixFixedPointSim");
  let f = F;
  for (let i = 0; i < iterations; i++) f = wernerComposite(f, F);
  return f;
}

/** One rung of the nested saturation ladder: the champion-vs-supply steady state. */
function supplyFixedPoint(F: number): number {
  return freshMixFixedPoint(F);
}

/**
 * S₁..S_slots (L3): the steady-state saturation fidelity the mixed ladder
 * holds with s slots, S₁ = F₀, S_{s+1} = μ(S_s). Strictly increasing in s.
 */
export function saturationLadder(F0: number, slots: number): Float64Array {
  requireFreshDomain(F0, "saturationLadder");
  if (!Number.isInteger(slots) || slots < 1 || slots > 64) {
    throw new SchedError(
      "LADDER_SLOTS_RANGE",
      `slots must be an integer in [1, 64] (got ${slots})`,
    );
  }
  const s = new Float64Array(slots);
  s[0] = F0;
  for (let i = 1; i < slots; i++) s[i] = supplyFixedPoint(s[i - 1]!);
  return s;
}

/**
 * Independent road for L3: the s-slot steady state simulated as the limit of
 * the champion iterating against a frozen (s−1)-slot supply level.
 */
export function saturationLadderSim(
  F0: number,
  slots: number,
  iterations = 5000,
): number {
  const closed = saturationLadder(F0, slots); // validates the arguments too
  const supply = closed[slots - 2] as number;
  let champ = supply;
  for (let i = 0; i < iterations; i++) champ = wernerComposite(champ, supply);
  return champ;
}

/**
 * B₀..B_levels (L4): the one-shot balanced ("2^k") batch ladder,
 * B_{k+1} = g(B_k, B_k) over 2^{k+1} fresh leaves.
 */
export function balancedLadder(F0: number, levels: number): Float64Array {
  requireFreshDomain(F0, "balancedLadder");
  if (!Number.isInteger(levels) || levels < 0 || levels > 24) {
    throw new SchedError(
      "LADDER_LEVELS_RANGE",
      `levels must be an integer in [0, 24] (got ${levels})`,
    );
  }
  const b = new Float64Array(levels + 1);
  b[0] = F0;
  for (let i = 1; i <= levels; i++)
    b[i] = wernerComposite(b[i - 1]!, b[i - 1]!);
  return b;
}

/** Smallest number of 2^k-batch leaves needed for a one-shot batch to reach fMin. */
export function batchLeavesToReach(
  F0: number,
  fMin: number,
  maxLevels = 24,
): number {
  const b = balancedLadder(F0, maxLevels);
  for (let i = 0; i <= maxLevels; i++) {
    if ((b[i] as number) >= fMin) return 2 ** i;
  }
  throw new SchedError(
    "LADDER_FMIN_UNREACHABLE",
    `fMin=${fMin} exceeds B_${maxLevels}=${b[maxLevels]} for F₀=${F0}`,
  );
}

/** Smallest slot count s with S_s(F₀) ≥ fMin (the exp4-D "下限 slots" column, closed form). */
export function minSlotsForFmin(
  F0: number,
  fMin: number,
  maxSlots = 64,
): number {
  const sat = saturationLadder(F0, maxSlots);
  for (let s = 1; s <= maxSlots; s++) {
    if ((sat[s - 1] as number) >= fMin) return s;
  }
  throw new SchedError(
    "LADDER_FMIN_UNREACHABLE",
    `fMin=${fMin} exceeds S_${maxSlots}=${sat[maxSlots - 1]} for F₀=${F0}`,
  );
}

/**
 * The phase boundary F₀*(slots, fMin) (L3): the unique root of the nested
 * algebraic equation S_slots(F₀) = fMin, bracketed to absolute tolerance.
 * Sign-flip evidence is returned so callers (tests) can pin both sides.
 */
export function phaseBoundary(
  slots: number,
  fMin: number,
  tol = 1e-12,
): { f0Star: number; below: number; above: number; iterations: number } {
  if (!Number.isInteger(slots) || slots < 1 || slots > 64) {
    throw new SchedError(
      "LADDER_SLOTS_RANGE",
      `slots must be an integer in [1, 64] (got ${slots})`,
    );
  }
  if (!(Number.isFinite(fMin) && fMin > 0.5 && fMin < 1)) {
    throw new SchedError(
      "LADDER_FMIN_RANGE",
      `fMin must lie in (1/2, 1) (got ${fMin})`,
    );
  }
  // saturation is monotone in F₀, so bisect on the sign of S_slots(F₀) − fMin
  let lo = 0.5 + 1e-12;
  let hi = 1 - 1e-12;
  const deficit = (F: number): number => {
    const sat = saturationLadder(F, slots);
    return (sat[slots - 1] as number) - fMin;
  };
  const dLo = deficit(lo);
  const dHi = deficit(hi);
  if (dLo > 0 || dHi < 0) {
    // S is continuous and strictly increasing in F₀; a miss here means fMin
    // outside the reachable band even at the extremes
    throw new SchedError(
      "LADDER_FMIN_UNREACHABLE",
      `fMin=${fMin} is not bracketed by S_${slots} on (1/2,1): S(1/2⁺)−fMin=${dLo}, S(1⁻)−fMin=${dHi}`,
    );
  }
  let iterations = 0;
  while (hi - lo > tol && iterations < 200) {
    const mid = (lo + hi) / 2;
    if (deficit(mid) < 0) lo = mid;
    else hi = mid;
    iterations++;
  }
  const f0Star = (lo + hi) / 2;
  return {
    f0Star,
    below: deficit(f0Star - 4 * tol),
    above: deficit(f0Star + 4 * tol),
    iterations,
  };
}
