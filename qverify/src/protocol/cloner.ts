/**
 * T5c — The optimal universal "keep a copy" attack on trap qubits, exact.
 *
 * The server's best individual attack that passes a qubit onward while
 * retaining maximal information is the universal cloning bound in action:
 * no CPTP map keeps F(ρ, Λ(ρ)) > 5/6 for all ρ (Bužek–Hillery / Gisin–Massar),
 * and the shrink-(2/3) channel attains it. Everything here is exact — no
 * numerical construction, no optimization:
 *
 *  (1) Shrink channel Λ(ρ) = (3/4)ρ + (1/12)Σ_σ σρσ has Kraus
 *      {√(3/4) I, √(1/12) X, √(1/12) Y, √(1/12) Z}; its trap acceptance is
 *      ⟨+θ|Λ(|+θ⟩⟨+θ|)|+θ⟩ = 5/6 at EVERY secret angle — the price of
 *      keeping an optimal copy is a constant 1/6 detection risk per trap.
 *  (2) Stinespring isometry V₀: C² → C²_A ⊗ C⁴_env,
 *      V₀|ψ⟩ = √(3/4)|ψ⟩|0⟩ + √(1/12)(X|ψ⟩|1⟩ + Y|ψ⟩|2⟩ + Z|ψ⟩|3⟩),
 *      verified to machine precision (V₀†V₀ = I).
 *  (3) The kept information is the complementary (environment) state
 *      ρ_env(θ) = Tr_A[V₀|+_θ⟩⟨+_θ|V₀†]; the deferred Helstrom discrimination
 *      of θ vs θ+π/4 on ρ_env is computed exactly — the exchange rate between
 *      detection risk (1/6) and learning advantage over the no-attack baseline.
 *
 * Honest boundary: the SYMMETRIC two-clone Bužek–Hillery machine (both clones
 * at exactly 5/6) is cited, not reconstructed — the attack analysis needs
 * only the optimal individual-clone channel, which is exact.
 */

import { type CMat, mat, identity, vInner, mMul, mDagger, mScale } from '../core/cmat.js';
import { equatorial, fromVec, PAULI_X, PAULI_Y, PAULI_Z } from '../core/states.js';
import { TRAP_ANGLES, trapAcceptanceDirect } from './traps.js';
import { helstromTwo } from './attacks.js';
import { mulVec } from '../core/gates.js';

/** Kraus operators of the shrink-(2/3) channel. */
export function shrinkChannelKraus(): CMat[] {
  return [
    mScale(identity(2), Math.sqrt(3 / 4)),
    mScale(PAULI_X, Math.sqrt(1 / 12)),
    mScale(PAULI_Y, Math.sqrt(1 / 12)),
    mScale(PAULI_Z, Math.sqrt(1 / 12)),
  ];
}

/** Per-angle trap acceptance of the shrink attack: exactly 5/6 for every θ. */
export function shrinkAcceptanceCurve(): Array<{ theta: number; acceptance: number }> {
  const kraus = shrinkChannelKraus();
  return TRAP_ANGLES.map((theta) => {
    const rho = fromVec(equatorial(theta));
    const out = mat(2, 2);
    for (const k of kraus) {
      const t = mMul(mMul(k, rho), mDagger(k));
      for (let i = 0; i < 4; i++) {
        out.re[i] = out.re[i]! + t.re[i]!;
        out.im[i] = out.im[i]! + t.im[i]!;
      }
    }
    const psi = equatorial(theta);
    return { theta, acceptance: vInner(psi, mulVec(out, psi)).re };
  });
}

/** Stinespring isometry V₀ as an 8×2 matrix (A qubit ⊗ 4-dim environment, layout a·4+j). */
export function shrinkStinespring(): CMat {
  const v = mat(8, 2);
  const kraus = shrinkChannelKraus();
  for (let j = 0; j < 4; j++) {
    for (let a = 0; a < 2; a++) {
      for (let c = 0; c < 2; c++) {
        v.re[(a * 4 + j) * 2 + c] = kraus[j]!.re[a * 2 + c]!;
        v.im[(a * 4 + j) * 2 + c] = kraus[j]!.im[a * 2 + c]!;
      }
    }
  }
  return v;
}

/** Isometry check: ‖V₀†V₀ − I₂‖₁. */
export function shrinkIsometryError(): number {
  const v = shrinkStinespring();
  const gram = mMul(mDagger(v), v);
  const eye = identity(2);
  let err = 0;
  for (let k = 0; k < 4; k++) err += Math.abs(gram.re[k]! - eye.re[k]!) + Math.abs(gram.im[k]!);
  return err;
}

/** Environment (complementary) state the server keeps after the attack. */
export function environmentState(theta: number): CMat {
  const v = shrinkStinespring();
  const psi = equatorial(theta);
  const out = mulVec(v, psi); // V₀|+_θ⟩ ∈ C⁸ with index a·4 + j
  const rho = mat(4, 4);
  for (let j = 0; j < 4; j++) {
    for (let k = 0; k < 4; k++) {
      let re = 0;
      let im = 0;
      for (let a = 0; a < 2; a++) {
        const cj = out.re[a * 4 + j]!;
        const sj = out.im[a * 4 + j]!;
        const ck = out.re[a * 4 + k]!;
        const sk = out.im[a * 4 + k]!;
        re += cj * ck + sj * sk;
        im += sj * ck - cj * sk;
      }
      rho.re[j * 4 + k] = re;
      rho.im[j * 4 + k] = im;
    }
  }
  return rho;
}

/**
 * Deferred attack value: Helstrom discrimination of θ vs θ+π/4 on the kept
 * environment, plus the no-attack baseline (1+sin π/8)/2.
 */
export function shrinkDeferredGuess(): { helstrom: number; baseline: number } {
  return {
    helstrom: helstromTwo(environmentState(0), environmentState(Math.PI / 4)),
    baseline: (1 + Math.sin(Math.PI / 8)) / 2,
  };
}

/** The trap calculus cross-check: acceptance from T2's referee on the shrink Kraus. */
export function shrinkTrapAcceptanceAveraged(): number {
  return trapAcceptanceDirect(shrinkChannelKraus());
}

