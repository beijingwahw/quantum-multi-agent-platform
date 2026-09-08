/**
 * Distinguishability and information measures: trace distance, von Neumann
 * entropy, Holevo χ of an ensemble, negativity across a cut. All built on the
 * Hermitian eigensolver in cmat.ts. (The Uhlmann fidelity was removed in the
 * v0.3.0 dead-code clearing: zero references — pure references take
 * <psi|rho|psi> and mixed-vs-mixed identity takes trace distance, the
 * metric chosen by the rank of what it touches.)
 */

import { type CMat, eigenvaluesHermitian, mAdd, mScale } from './cmat.js';
import { partialTranspose } from './channels.js';

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
  if (first === undefined) throw new Error('EC_ENSEMBLE_EMPTY: holevo needs a non-empty ensemble');
  const d = first.state.rows;
  const avg = mat0(d);
  let wsum = 0;
  for (const it of items) {
    if (it.state.rows !== d || it.state.cols !== d) {
      throw new Error(`EC_ENSEMBLE_DIM: holevo needs every state ${d}x${d}, saw ${it.state.rows}x${it.state.cols}`);
    }
    wsum += it.weight;
    for (let k = 0; k < d * d; k++) {
      avg.re[k] = avg.re[k]! + it.weight * it.state.re[k]!;
      avg.im[k] = avg.im[k]! + it.weight * it.state.im[k]!;
    }
  }
  if (Math.abs(wsum - 1) > 1e-9) throw new Error(`EC_WEIGHTS: holevo ensemble weights must sum to 1, got ${wsum}`);
  const sAvg = vonNeumannEntropy(avg);
  let sSum = 0;
  for (const it of items) sSum += it.weight * vonNeumannEntropy(it.state);
  if (sSum > sAvg + 1e-9) sSum = Math.min(sSum, sAvg); // numerical guard; χ >= 0 exactly
  return sAvg - sSum;
}

function mat0(d: number): CMat {
  return { rows: d, cols: d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
}

/**
 * Negativity N(ρ) = (||ρ^{T_S}||₁ - 1)/2 across the cut traced by `sys`: a
 * computable entanglement monotone under LOCC (VW02). Zero iff PPT.
 */
export function negativity(rho: CMat, dims: readonly number[], sys: readonly number[]): number {
  const pt = partialTranspose(rho, dims, sys);
  const eig = eigenvaluesHermitian(pt);
  let s = 0;
  for (const l of eig) s += Math.abs(l);
  return (s - 1) / 2;
}

/** Shannon entropy in bits of a probability vector (0 log 0 = 0). */
export function shannonBits(p: readonly number[]): number {
  let sum = 0;
  for (const x of p) sum += x;
  if (Math.abs(sum - 1) > 1e-9) throw new Error(`EC_WEIGHTS: shannonBits needs a distribution summing to 1, got ${sum}`);
  let s = 0;
  for (const x of p) if (x > 1e-15) s -= x * Math.log2(x);
  return s;
}
