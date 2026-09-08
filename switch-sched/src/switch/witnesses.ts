/**
 * Witnesses separating the switched process from every definite-order use.
 *
 * The operational witness used throughout: in any definite-order use the
 * control is a spectator — ρ_c(out) = ρ_c(in) exactly. If the switched
 * output has Tr_S ρ_out ≠ ρ_c(in), information reached the control through
 * the ORDER degree of freedom, which no fixed-order strategy can offer.
 * (Full causal-nonseparability certification via process witnesses is the
 * framework of Oreshkov-Costa-Brukner 2012 and Goswami et al. 2018; the
 * control-displacement witness is the operational slice we verify.)
 */

import { type CMat, kron } from '../core/cmat.js';
import { partialTrace } from '../core/channels.js';
import { traceDistance } from '../core/measures.js';

/**
 * Control displacement Δ_c = T(Tr_S ρ_out, ρ_c(in)).
 * Zero for every definite-order use (control untouched); positive means the
 * order degree of freedom carried information.
 */
export function controlDisplacement(rhoOutCS: CMat, dTarget: number, rhoCIn: CMat): number {
  const controlOut = partialTrace(rhoOutCS, [2, dTarget], [1]);
  return traceDistance(controlOut, rhoCIn);
}

/**
 * Kronecker product of density matrices. Delegates to core kron — the two
 * were byte-identical duplicates (same loop nest, same complex accumulate)
 * and are pinned bit-equal by test/hardening.test.ts.
 */
export function kronRho(a: CMat, b: CMat): CMat {
  return kron(a, b);
}

/** Exact product test ρ == ρ_A ⊗ ρ_B across the cut dims [dA, dB]. */
export function isProductAcross(rho: CMat, dA: number, dB: number, tol = 1e-12): boolean {
  const rhoA = partialTrace(rho, [dA, dB], [1]);
  const rhoB = partialTrace(rho, [dA, dB], [0]);
  const prod = kronRho(rhoA, rhoB);
  let err = 0;
  for (let k = 0; k < rho.re.length; k++) {
    err += Math.abs(rho.re[k]! - prod.re[k]!) + Math.abs(rho.im[k]! - prod.im[k]!);
  }
  return err <= tol;
}

/** Trace norm ½·Tr|ρ − ρ_A⊗ρ_B|: distance from being product across [dA, dB].
 * Delegates to traceDistance — the bodies were byte-identical (eig of
 * ρ − ρ_A⊗ρ_B, ½ Σ|λ|); pinned bit-equal by test/hardening.test.ts. */
export function productDeviation(rho: CMat, dA: number, dB: number): number {
  const rhoA = partialTrace(rho, [dA, dB], [1]);
  const rhoB = partialTrace(rho, [dA, dB], [0]);
  return traceDistance(rho, kronRho(rhoA, rhoB));
}
