/**
 * Named states and gates used as numeric anchors throughout the project.
 * Every formula here has a closed-form value a test can assert against.
 */

import { type CMat, type CVec, basisVec, mat, outer, vNormalize } from './cmat.js';
import type { Rng } from './rng.js';

export const KET0: CVec = basisVec(2, 0);
export const KET1: CVec = basisVec(2, 1);

export const PLUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, 1]), im: new Float64Array(2) });
export const MINUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, -1]), im: new Float64Array(2) });

/** |v><v| — single-sourced on cmat.outer (bit-identical accumulation). */
export function vecToRho(v: CVec): CMat {
  return outer(v, v);
}

export function maximallyMixed(d: number): CMat {
  const m = mat(d, d);
  for (let i = 0; i < d; i++) m.re[i * d + i] = 1 / d;
  return m;
}

/** Random normalized complex vector (Gaussian, then normalize). */
export function randomStateVec(rng: Rng, d: number): CVec {
  const v = { n: d, re: new Float64Array(d), im: new Float64Array(d) };
  for (let k = 0; k < d; k++) {
    // Box-Muller pair
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    v.re[k] = r * Math.cos(2 * Math.PI * u2);
    v.im[k] = r * Math.sin(2 * Math.PI * u2);
  }
  return vNormalize(v);
}

/** Pauli matrices. */
export const PAULI_X: CMat = (() => {
  const m = mat(2, 2);
  m.re[0 * 2 + 1] = 1;
  m.re[1 * 2 + 0] = 1;
  return m;
})();

export const PAULI_Y: CMat = (() => {
  const m = mat(2, 2);
  m.im[0 * 2 + 1] = -1;
  m.im[1 * 2 + 0] = 1;
  return m;
})();

export const PAULI_Z: CMat = (() => {
  const m = mat(2, 2);
  m.re[0 * 2 + 0] = 1;
  m.re[1 * 2 + 1] = -1;
  return m;
})();

/**
 * Generalized Pauli (Weyl) operator W_{a,b} = X^a Z^b on dimension d, with
 * X|j⟩ = |(j+1) mod d⟩ and Z|j⟩ = ω^j |j⟩, ω = e^{2πi/d}. The d² operators
 * form a trace-orthogonal unitary basis: Tr W_{ab}† W_{cd} = d δ_{ac}δ_{bd},
 * and the full orbit satisfies Σ_{ab} W ρ W† = d · I · Tr ρ.
 */
