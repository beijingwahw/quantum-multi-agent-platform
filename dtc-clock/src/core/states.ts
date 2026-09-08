/**
 * Named states and gates used as numeric anchors throughout the project.
 * Every formula here has a closed-form value a test can assert against.
 * (v0.21.0 dead-code sweep: KET0/KET1/MINUS, uniformVec, maximallyMixed,
 * rotY, weyl and eye were referenced nowhere — workspace-grep-proven — and
 * are gone; their capabilities are the live cmat primitives basisVec /
 * vNormalize / identity, which every survivor uses.)
 */

import { type CMat, type CVec, mat, vNormalize } from './cmat.js';
import type { Rng } from './rng.js';
import { DtcError } from './errors.js';

export const PLUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, 1]), im: new Float64Array(2) });

/** Uniform vector orthogonal to |v_d⟩ (first two amplitudes ±1/√2, rest 0). */
export function uniformOrthVec(d: number): CVec {
  const v = { n: d, re: new Float64Array(d), im: new Float64Array(d) };
  if (d < 2) throw new DtcError("E/DOMAIN", 'uniformOrthVec needs d >= 2');
  v.re[0] = 1 / Math.sqrt(2);
  v.re[1] = -1 / Math.sqrt(2);
  return v;
}

export function vecToRho(v: CVec): CMat {
  const m = mat(v.n, v.n);
  for (let i = 0; i < v.n; i++) {
    for (let j = 0; j < v.n; j++) {
      m.re[i * v.n + j] = v.re[i]! * v.re[j]! + v.im[i]! * v.im[j]!;
      m.im[i * v.n + j] = v.im[i]! * v.re[j]! - v.re[i]! * v.im[j]!;
    }
  }
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
