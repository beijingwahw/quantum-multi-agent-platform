/**
 * T5/T2 extension — the attack census at a second noise model (v0.2), exact.
 *
 * The v0.1 attack games are noiseless. Here the trap calculus and the
 * guessing games are re-run under two physical noise channels applied to the
 * trap qubit before the game — the honest-noisy-server census:
 *
 *  - Phase damping Λ(ρ) = (1−γ)ρ + γ ZρZ (Kraus √(1−γ)I, √γ Z) is a PURE-Z
 *    channel, and the T2 Z-tier fires with certainty: Z|+θ⟩ = |+θ+π⟩ is the
 *    orthogonal state, so the trap acceptance is exactly
 *      p̄(γ) = 1 − γ   for every γ
 *    (⟨+θ|Z|+θ⟩ = 0 is exactly WHY every dephasing event is caught).
 *    A physical noise model landing entirely in the perfect-detection tier.
 *  - Amplitude damping E₀ = [[1,0],[0,√(1−γ)]], E₁ = [[0,√γ],[0,0]]:
 *    E₁ = √γ(X+iY)/2 (the half-seen tier), E₀ = c_I I + c_Z Z with
 *    c_I = (1+√(1−γ))/2 (Z invisible), so
 *      p̄(γ) = (1+√(1−γ))²/4 + γ/4   (1 at γ=0, exactly 1/2 at γ=1)
 *    — only half of the decay is ever detected.
 *  Both closed forms are verified against all three T2 referees.
 *
 *  Guessing under noise: the server's one-bit Helstrom game |+₀⟩ vs |+_{π/4}⟩
 *  after the channel. Phase flips are UNITARY: each ensemble member becomes
 *  an antipodal mixture with Bloch shrink |1−2γ| (zero at the incoherent
 *  midpoint γ = 1/2, back to pure — flipped — at γ = 1), giving the exact
 *  closed form
 *      p*(γ) = (1 + |1−2γ|·sin(π/8))/2.
 *  At γ = 1 the trap rejects everything (acceptance 0) while the attacker's
 *  discrimination is fully restored: coherent noise decouples detection from
 *  leakage. Amplitude damping is not isotropic on the equator; the value is
 *  computed numerically (trace-norm) with the POVM optimizer as referee,
 *  endpoints exact: p*(0) = (1+sin π/8)/2, p*(1) = 1/2 (both states decay
 *  to |0⟩ — decay, unlike flipping, destroys the phase bit entirely).
 */

import { type CMat, mat } from '../core/cmat.js';
import { equatorial, fromVec } from '../core/states.js';
import { trapAcceptanceFormula, trapAcceptanceDirect, trapAcceptanceExpansion } from './traps.js';
import { helstromTwo, helstromTwoOptimize } from './attacks.js';
import { applyKraus } from '../core/channels.js';

/** Kraus operators of the amplitude-damping channel at damping γ ∈ [0,1]. */
export function amplitudeDampingKraus(gamma: number): CMat[] {
  const e0 = mat(2, 2);
  e0.re[0] = 1;
  e0.re[3] = Math.sqrt(1 - gamma);
  const e1 = mat(2, 2);
  e1.re[1] = Math.sqrt(gamma);
  return [e0, e1];
}

/** Kraus operators of the phase-damping (pure dephasing) channel: (1−γ)ρ + γ ZρZ. */
export function phaseDampingKraus(gamma: number): CMat[] {
  const eye = mat(2, 2);
  eye.re[0] = Math.sqrt(1 - gamma);
  eye.re[3] = eye.re[0];
  const z = mat(2, 2);
  z.re[0] = Math.sqrt(gamma);
  z.re[3] = -z.re[0];
  return [eye, z];
}

/** Closed form of the trap acceptance under amplitude damping: (1+√(1−γ))²/4 + γ/4. */
export function ampDampAcceptanceClosed(gamma: number): number {
  const s = Math.sqrt(1 - gamma);
  return ((1 + s) * (1 + s)) / 4 + gamma / 4;
}

/** Closed form of the trap acceptance under phase damping: exactly 1 − γ (Z-tier, perfect detection). */
export function phaseDampAcceptanceClosed(gamma: number): number {
  return 1 - gamma;
}

export interface NoiseCensusRow {
  gamma: number;
  /** trap acceptance under amplitude damping: formula / direct / expansion */
  ampDampFormula: number;
  ampDampDirect: number;
  ampDampExpansion: number;
  /** trap acceptance under phase damping: closed form 1−γ vs direct referee */
  phaseDampFormula: number;
  phaseDampDirect: number;
  /** Helstrom |+₀⟩ vs |+_{π/4}⟩ after each channel */
  guessAfterAmpDamp: number;
  guessAfterPhaseDamp: number;
  phaseDampGuessClosed: number;
}

/** One census row at damping γ: every number recomputed from the channels. */
export function noiseCensusRow(gamma: number): NoiseCensusRow {
  const ad = amplitudeDampingKraus(gamma);
  const pd = phaseDampingKraus(gamma);
  const rho0 = fromVec(equatorial(0));
  const rho1 = fromVec(equatorial(Math.PI / 4));
  return {
    gamma,
    ampDampFormula: ampDampAcceptanceClosed(gamma),
    ampDampDirect: trapAcceptanceDirect(ad),
    ampDampExpansion: trapAcceptanceExpansion(ad),
    phaseDampFormula: phaseDampAcceptanceClosed(gamma),
    phaseDampDirect: trapAcceptanceDirect(pd),
    guessAfterAmpDamp: helstromTwo(applyKraus(rho0, ad), applyKraus(rho1, ad)),
    guessAfterPhaseDamp: helstromTwo(applyKraus(rho0, pd), applyKraus(rho1, pd)),
    phaseDampGuessClosed: (1 + Math.abs(1 - 2 * gamma) * Math.sin(Math.PI / 8)) / 2,
  };
}

/** Worst referee disagreements and closed-form gaps over the γ grid. */
export function noiseCensusSweep(gammas: readonly number[]): {
  worstAmpDampRefereeGap: number;
  worstPhaseDampRefereeGap: number;
  worstPhaseGuessGap: number;
} {
  const out = { worstAmpDampRefereeGap: 0, worstPhaseDampRefereeGap: 0, worstPhaseGuessGap: 0 };
  for (const gamma of gammas) {
    const r = noiseCensusRow(gamma);
    out.worstAmpDampRefereeGap = Math.max(
      out.worstAmpDampRefereeGap,
      Math.abs(r.ampDampFormula - r.ampDampDirect),
      Math.abs(r.ampDampFormula - r.ampDampExpansion),
    );
    const pdFormulaCheck = Math.abs(r.phaseDampFormula - trapAcceptanceFormula(phaseDampingKraus(gamma)));
    out.worstPhaseDampRefereeGap = Math.max(out.worstPhaseDampRefereeGap, Math.abs(r.phaseDampFormula - r.phaseDampDirect), pdFormulaCheck);
    out.worstPhaseGuessGap = Math.max(out.worstPhaseGuessGap, Math.abs(r.guessAfterPhaseDamp - r.phaseDampGuessClosed));
  }
  return out;
}

/** POVM-optimizer referee for the damped guessing game (spot check). */
export function dampedGuessOptimized(gamma: number): number {
  const ad = amplitudeDampingKraus(gamma);
  return helstromTwoOptimize(
    applyKraus(fromVec(equatorial(0)), ad),
    applyKraus(fromVec(equatorial(Math.PI / 4)), ad),
  );
}
