/**
 * The distinguishability measure the tariff prices: trace distance (TV on
 * diagonals), built on the Hermitian eigensolver in cmat.ts.
 */

import { type CMat, eigenvaluesHermitian, mAdd, mScale } from './cmat.js';

/** Trace distance ½ Tr|ρ-σ| = ½ Σ |λ_i(ρ-σ)|. */
export function traceDistance(rho: CMat, sigma: CMat): number {
  const diff = mAdd(rho, mScale(sigma, -1));
  const eig = eigenvaluesHermitian(diff);
  let s = 0;
  for (const l of eig) s += Math.abs(l);
  return s / 2;
}
