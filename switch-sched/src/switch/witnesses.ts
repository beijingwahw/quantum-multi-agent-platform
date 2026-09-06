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

import { type CMat, eigenvaluesHermitian, mat, mAdd, mScale } from '../core/cmat.js';
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

/** Kronecker product of density matrices. */
export function kronRho(a: CMat, b: CMat): CMat {
  const out = mat(a.rows * b.rows, a.cols * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      for (let p = 0; p < b.rows; p++) {
        for (let q = 0; q < b.cols; q++) {
          const re = a.re[i * a.cols + j]! * b.re[p * b.cols + q]! - a.im[i * a.cols + j]! * b.im[p * b.cols + q]!;
          const im = a.re[i * a.cols + j]! * b.im[p * b.cols + q]! + a.im[i * a.cols + j]! * b.re[p * b.cols + q]!;
          const ri = i * b.rows + p;
          const ci = j * b.cols + q;
          out.re[ri * out.cols + ci] = out.re[ri * out.cols + ci]! + re;
          out.im[ri * out.cols + ci] = out.im[ri * out.cols + ci]! + im;
        }
      }
    }
  }
  return out;
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

/** Trace norm ½·Tr|ρ − ρ_A⊗ρ_B|: distance from being product across [dA, dB]. */
export function productDeviation(rho: CMat, dA: number, dB: number): number {
  const rhoA = partialTrace(rho, [dA, dB], [1]);
  const rhoB = partialTrace(rho, [dA, dB], [0]);
  const diff = mAdd(rho, mScale(kronRho(rhoA, rhoB), -1));
  const eig = eigenvaluesHermitian(diff);
  let s = 0;
  for (const l of eig) s += Math.abs(l);
  return s / 2;
}
