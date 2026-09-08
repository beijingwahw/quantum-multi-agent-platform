/**
 * Distinguishability and information measures: trace distance and von
 * Neumann entropy. All built on the Hermitian eigensolver in cmat.ts.
 */

import { type CMat, eigenvaluesHermitian, mAdd, mScale } from './cmat.js';

/** Tr ρ for Hermitian ρ. */
export function traceReal(rho: CMat): number {
  let t = 0;
  for (let i = 0; i < rho.rows; i++) t += rho.re[i * rho.cols + i]!;
  return t;
}

/** Trace distance ½ Tr|ρ-σ| = ½ Σ |λ_i(ρ-σ)|. */
export function traceDistance(rho: CMat, sigma: CMat): number {
  const diff = mAdd(rho, mScale(sigma, -1));
  const eig = eigenvaluesHermitian(diff);
  let s = 0;
  for (const l of eig) s += Math.abs(l);
  return s / 2;
}

/** Von Neumann entropy -Tr ρ log₂ ρ (0 log 0 = 0). */
export function vonNeumannEntropy(rho: CMat): number {
  const eig = eigenvaluesHermitian(rho);
  let s = 0;
  for (const l of eig) {
    if (l > 1e-15) s -= l * Math.log2(l);
  }
  return s;
}
