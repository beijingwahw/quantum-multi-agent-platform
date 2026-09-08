/**
 * State constructors for the numeric anchors: pure states as density
 * matrices, the maximally mixed state, and seeded random pure states. Every
 * formula here has a closed-form value a test can assert against.
 */

import { type CMat, type CVec, mat, vNormalize } from './cmat.js';
import type { Rng } from './rng.js';

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
