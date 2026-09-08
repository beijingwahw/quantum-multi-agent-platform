/**
 * T3 extension — The rigidity-vs-noise window census (v0.2), exact arithmetic.
 *
 * The boundary this module executes: "entangled ≠ verifiable-by-CHSH". For
 * the two-qubit isotropic (Werner) family ρ(v) = v|Φ+⟩⟨Φ+| + (1−v)I/4 at
 * visibility v, the CHSH value is S = 2√2·v and the |Φ+⟩ fidelity is exactly
 * (1+3v)/4. Self-testing theory (adopted as anchors, methods reproducible
 * here) then pins down three regimes:
 *
 *  - v ≤ 1/3: separable (PPT ≥ 0) — nothing to certify.
 *  - 1/3 < v ≤ 1/√2: THE WINDOW — PPT-entangled but CHSH-local (S ≤ 2):
 *    a genuinely quantum noisy-honest device fails the rigidity check.
 *  - 1/√2 < v ≤ v*: violation but the best proven analytic bound is still the
 *    trivial floor 1/2 — the "rigidity gap". v* = (7+4√2)/17 is the
 *    Kaniewski threshold: the visibility at which S = β* = (16+14√2)/17 ≈ 2.108.
 *  - v* < v ≤ 1: Kaniewski's extractability bound
 *      Q(β) ≥ 1/2 + ½·(β−β*)/(2√2−β*)          [PRL 117, 070402 (2016), Eq. (10)]
 *    exceeds the trivial floor — rigidity survives with a certified margin.
 *
 *  Barriers carried as data (exact arithmetic over the closed forms):
 *  - Trivial upper bound (mixing construction, same paper, Eq. (4)):
 *      Q(β) ≤ 1/√2 + (1−1/√2)·(β−2)/(2√2−2)    for β ∈ [2, 2√2]
 *  - Isotropic barrier: any PLAIN-fidelity bound valid for all states must
 *    satisfy f(β) ≤ (1+3β/(2√2))/4 = 1/4 + 3β/(8√2), because the isotropic
 *    state itself achieves β with exactly that fidelity (machine-checked
 *    below: fidelity(ρ(v)) = (1+3v)/4 to fp).
 *
 *  Numerically-not-reproducible-in-repo anchor (cited only): Bancal et al.,
 *  PRA 91, 022115 (2015) obtain non-trivial plain fidelity above a numerical
 *  threshold ≈ 2.37 (swap trick + see-saw); Kaniewski's analytic bound at
 *  β ≈ 2.37 already guarantees extractability ≈ 0.68.
 */

import { type CMat } from '../core/cmat.js';
import { bellState, fromVec, wernerFidelity } from '../core/states.js';
import { fidelity } from '../core/measures.js';
import { horodeckiSMax, pptMinEigenvalue } from './chsh.js';

/** Kaniewski's threshold violation β* = (16+14√2)/17 ≈ 2.1078 (bound leaves the trivial floor). */
export const BETA_STAR: number = (16 + 14 * Math.SQRT2) / 17;
/** Visibility v* = β* over 2√2 = (7+4√2)/17 ≈ 0.7445 — the census rigidity threshold. */
export const V_STAR: number = (7 + 4 * Math.SQRT2) / 17;
export const BETA_LOCAL = 2;
export const BETA_QUANTUM = 2 * Math.SQRT2;
/** Largest Schmidt coefficient of |Φ+⟩: the always-achievable (trivial) fidelity 1/√2. */
export const LAMBDA_MAX_SINGLET = 1 / Math.SQRT2;
/** Trivial floor for extractability of the singlet: λmax² = 1/2. */
export const TRIVIAL_FLOOR = 0.5;

/**
 * Kaniewski's linear extractability lower bound (PRL 117, 070402 (2016),
 * Eq. (10)): Q(β) ≥ 1/2 + ½(β−β*)/(2√2−β*), clamped at the trivial floor 1/2.
 */
export function kaniewskiLowerBound(beta: number): number {
  return Math.max(TRIVIAL_FLOOR, 0.5 + 0.5 * ((beta - BETA_STAR) / (BETA_QUANTUM - BETA_STAR)));
}

/** Trivial upper bound on extractability (mixing construction, Eq. (4)), β ∈ [2, 2√2]. */
export function trivialUpperBound(beta: number): number {
  return LAMBDA_MAX_SINGLET + (1 - LAMBDA_MAX_SINGLET) * ((beta - BETA_LOCAL) / (BETA_QUANTUM - BETA_LOCAL));
}

/** Exact isotropic closed forms: S(v) = 2√2·v and F_Φ(v) = (1+3v)/4. */
export function isotropicBeta(v: number): number {
  return BETA_QUANTUM * v;
}
export function isotropicFidelity(v: number): number {
  return (1 + 3 * v) / 4;
}

/** The isotropic barrier in the (β, plain-fidelity) plane: 1/4 + 3β/(8√2). */
export function isotropicBarrier(beta: number): number {
  return isotropicFidelity(beta / BETA_QUANTUM);
}

export type RigidityRegime =
  | 'separable'
  | 'window: entangled, CHSH-local'
  | 'violation, proven bound trivial (rigidity gap)'
  | 'certified: extractability bound > 1/2';

/** Regime classification at visibility v (boundaries by exact closed forms). */
export function rigidityRegime(v: number): RigidityRegime {
  if (v <= 1 / 3) return 'separable';
  if (v <= 1 / Math.SQRT2) return 'window: entangled, CHSH-local';
  if (v <= V_STAR) return 'violation, proven bound trivial (rigidity gap)';
  return 'certified: extractability bound > 1/2';
}

export interface WindowCensusRow {
  visibility: number;
  /** Horodecki S_max of ρ(v) — must equal 2√2·v */
  beta: number;
  /** numeric ⟨Φ+|ρ(v)|Φ+⟩ — must equal (1+3v)/4 */
  fidelityNumeric: number;
  fidelityClosed: number;
  pptMin: number;
  /** Kaniewski extractability lower bound at β (≥ 1/2) */
  lowerBound: number;
  /** trivial upper barrier at β */
  upperBarrier: number;
  regime: RigidityRegime;
}

/** One census row at visibility v: every quantity recomputed from the state. */
export function windowCensusRow(v: number): WindowCensusRow {
  const rho = wernerFidelity(v);
  const beta = horodeckiSMax(rho);
  return {
    visibility: v,
    beta,
    fidelityNumeric: fidelity(rho, phiPlus()),
    fidelityClosed: isotropicFidelity(v),
    pptMin: pptMinEigenvalue(rho),
    lowerBound: kaniewskiLowerBound(beta),
    upperBarrier: trivialUpperBound(Math.max(BETA_LOCAL, Math.min(BETA_QUANTUM, beta))),
    regime: rigidityRegime(v),
  };
}

/**
 * Fine sweep: worst deviations of the exact isotropic identities and worst
 * violations of the bound-shape inequalities (lower ≤ iso plain-fidelity on
 * [v*, 1]; lower ≤ upper on [2, 2√2]; both = 1 at 2√2).
 */
export function windowSweep(steps: number): {
  worstBetaGap: number;
  worstFidelityGap: number;
  worstLowerAboveIso: number;
  worstLowerAboveUpper: number;
  worstUpperAboveOne: number;
} {
  const out = {
    worstBetaGap: 0,
    worstFidelityGap: 0,
    worstLowerAboveIso: 0,
    worstLowerAboveUpper: 0,
    worstUpperAboveOne: 0,
  };
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const rho = wernerFidelity(v);
    const beta = horodeckiSMax(rho);
    const fs = fidelity(rho, phiPlus());
    out.worstBetaGap = Math.max(out.worstBetaGap, Math.abs(beta - isotropicBeta(v)));
    out.worstFidelityGap = Math.max(out.worstFidelityGap, Math.abs(fs - isotropicFidelity(v)));
    if (v >= V_STAR) {
      // proven extractability bound must not exceed the honest device's actual fidelity
      out.worstLowerAboveIso = Math.max(out.worstLowerAboveIso, kaniewskiLowerBound(beta) - fs);
    }
    const b = Math.max(BETA_LOCAL, Math.min(BETA_QUANTUM, beta));
    if (b >= BETA_LOCAL) {
      out.worstLowerAboveUpper = Math.max(out.worstLowerAboveUpper, kaniewskiLowerBound(b) - trivialUpperBound(b));
      out.worstUpperAboveOne = Math.max(out.worstUpperAboveOne, trivialUpperBound(b) - 1);
    }
  }
  return out;
}

export interface CertificateVerdict {
  ok: boolean;
  /** name of the fraud when rejected, 'clean' otherwise */
  name: string;
  detail: string;
}

export interface RigidityCertificate {
  visibility: number;
  /** the S the certificate claims was observed */
  claimedBeta: number;
  /** the |Φ+⟩ fidelity the certificate claims was extracted */
  claimedFidelity: number;
  /** the certificate asserts "rigidity certified" (vs merely reporting data) */
  claimsCertified: boolean;
}

/**
 * Smuggling trial referee: a third party hands us a rigidity certificate for
 * a Werner-visibility device; every claimed number is recomputed from the
 * state. The checker NAMES the specific fraud it rejects.
 */
export function checkRigidityCertificate(cert: RigidityCertificate): CertificateVerdict {
  const actual = windowCensusRow(cert.visibility);
  if (Math.abs(cert.claimedBeta - actual.beta) > 1e-9) {
    return {
      ok: false,
      name: 'claimed-beta-not-reproduced',
      detail: `certificate claims S=${cert.claimedBeta} but the state at v=${cert.visibility} gives S=${actual.beta}`,
    };
  }
  if (cert.claimedFidelity > actual.fidelityClosed + 1e-12) {
    return {
      ok: false,
      name: 'fidelity-above-isotropic-barrier',
      detail: `certificate claims F=${cert.claimedFidelity} but the isotropic device at v=${cert.visibility} has exactly F=${actual.fidelityClosed} — no device at this visibility can do better`,
    };
  }
  if (cert.claimsCertified) {
    if (actual.beta <= BETA_LOCAL) {
      return {
        ok: false,
        name: 'certified-without-violation',
        detail: `certificate asserts rigidity at S=${actual.beta} ≤ 2 (the Werner window: entangled, PPT min ${actual.pptMin}, but CHSH-local)`,
      };
    }
    if (actual.beta <= BETA_STAR) {
      return {
        ok: false,
        name: 'certified-inside-rigidity-gap',
        detail: `S=${actual.beta} exceeds the local bound but stays below the Kaniewski threshold β*=${BETA_STAR}: every proven analytic bound is still the trivial 1/2`,
      };
    }
    if (cert.claimedFidelity > kaniewskiLowerBound(actual.beta) + 1e-12) {
      return {
        ok: false,
        name: 'claimed-fidelity-exceeds-proven-bound',
        detail: `at S=${actual.beta} the proven extractability bound is ${kaniewskiLowerBound(actual.beta)}; the certificate claims ${cert.claimedFidelity} without additional evidence`,
      };
    }
  }
  return { ok: true, name: 'clean', detail: 'all claimed numbers recomputed and consistent' };
}

function phiPlus(): CMat {
  // fromVec is deterministic — a fresh projector per call keeps this kernel
  // free of shared mutable module state
  return fromVec(bellState('phi+'));
}
