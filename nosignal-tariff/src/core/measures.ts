/**
 * Distinguishability and information measures: trace distance, Uhlmann
 * fidelity, von Neumann entropy, Holevo χ of an ensemble. All built on the
 * Hermitian eigensolver in cmat.ts.
 */

import { type CMat, eigenvaluesHermitian, mAdd, mMul, mScale, sqrtPSD } from './cmat.js';

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

/** Uhlmann fidelity F(ρ,σ) = (Tr √(√ρ σ √ρ))², in [0,1]. */
export function fidelity(rho: CMat, sigma: CMat): number {
  const sq = sqrtPSD(rho);
  const inner = sqrtPSD(mMul(mMul(sq, sigma), sq));
  const t = traceReal(inner);
  return t * t;
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

export interface EnsembleItem {
  /** classical label of the ensemble member */
  key: string;
  state: CMat;
  weight: number;
}

/**
 * Holevo quantity χ = S(Σ w ρ) - Σ w S(ρ) of an ensemble: an upper bound on
 * the accessible information about `key` carried by the states.
 */
export function holevo(items: readonly EnsembleItem[]): number {
  const first = items[0];
  if (first === undefined) throw new Error('holevo: empty ensemble');
  const d = first.state.rows;
  const avg = mat0(d);
  let wsum = 0;
  for (const it of items) {
    if (it.state.rows !== d || it.state.cols !== d) {
      throw new Error('holevo: every ensemble state must share one dimension');
    }
    wsum += it.weight;
    for (let k = 0; k < d * d; k++) {
      avg.re[k] = avg.re[k]! + it.weight * it.state.re[k]!;
      avg.im[k] = avg.im[k]! + it.weight * it.state.im[k]!;
    }
  }
  if (Math.abs(wsum - 1) > 1e-9) throw new Error('ensemble weights must sum to 1');
  const sAvg = vonNeumannEntropy(avg);
  let sSum = 0;
  for (const it of items) sSum += it.weight * vonNeumannEntropy(it.state);
  if (sSum > sAvg + 1e-9) sSum = Math.min(sSum, sAvg); // numerical guard; χ >= 0 exactly
  return sAvg - sSum;
}

function mat0(d: number): CMat {
  return { rows: d, cols: d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
}
