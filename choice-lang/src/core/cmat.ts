/**
 * Dense complex linear algebra for density-matrix simulation.
 *
 * Small dimensions only (<= a few hundred): everything is O(d^3) or worse.
 * Wave 4's dead-code clearing removed the Hermitian eigensolver (Jacobi
 * embedding, inverse iteration, spectral rebuild) this repo never called —
 * the live model needs only the constructors, the products, and the norms;
 * the full capability survives byte-identical in qverify/src/core/cmat.ts.
 */

import { ChoiceLangError } from "./errors.js";

export interface CVec {
  readonly n: number;
  readonly re: Float64Array;
  readonly im: Float64Array;
}

export interface CMat {
  readonly rows: number;
  readonly cols: number;
  readonly re: Float64Array;
  readonly im: Float64Array;
}

function vec(n: number, fill = 0): CVec {
  return { n, re: new Float64Array(n).fill(fill), im: new Float64Array(n) };
}

export function mat(rows: number, cols: number): CMat {
  return { rows, cols, re: new Float64Array(rows * cols), im: new Float64Array(rows * cols) };
}

export function identity(d: number): CMat {
  const m = mat(d, d);
  for (let i = 0; i < d; i++) m.re[i * d + i] = 1;
  return m;
}

function vInner(a: CVec, b: CVec): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.n; i++) {
    // conj(a) * b
    re += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;
    im += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
  }
  return { re, im };
}

function vScale(a: CVec, s: number): CVec {
  const r = vec(a.n);
  for (let i = 0; i < a.n; i++) {
    r.re[i] = a.re[i]! * s;
    r.im[i] = a.im[i]! * s;
  }
  return r;
}

function vNorm(a: CVec): number {
  return Math.sqrt(vInner(a, a).re);
}

export function vNormalize(a: CVec): CVec {
  const nrm = vNorm(a);
  return nrm === 0 ? a : vScale(a, 1 / nrm);
}

export function mAdd(a: CMat, b: CMat): CMat {
  const m = mat(a.rows, a.cols);
  for (let k = 0; k < a.re.length; k++) {
    m.re[k] = a.re[k]! + b.re[k]!;
    m.im[k] = a.im[k]! + b.im[k]!;
  }
  return m;
}

export function mMul(a: CMat, b: CMat): CMat {
  if (a.cols !== b.rows) {
    throw new ChoiceLangError("MAT_SHAPE", `mMul: shape mismatch ${a.rows}x${a.cols} * ${b.rows}x${b.cols}`);
  }
  const m = mat(a.rows, b.cols);
  const bn = b.cols;
  for (let i = 0; i < a.rows; i++) {
    for (let k = 0; k < a.cols; k++) {
      const ar = a.re[i * a.cols + k]!;
      const ai = a.im[i * a.cols + k]!;
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < b.cols; j++) {
        const br = b.re[k * bn + j]!;
        const bi = b.im[k * bn + j]!;
        m.re[i * bn + j] = m.re[i * bn + j]! + (ar * br - ai * bi);
        m.im[i * bn + j] = m.im[i * bn + j]! + (ar * bi + ai * br);
      }
    }
  }
  return m;
}

export function mDagger(a: CMat): CMat {
  const m = mat(a.cols, a.rows);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      m.re[j * a.rows + i] = a.re[i * a.cols + j]!;
      m.im[j * a.rows + i] = -a.im[i * a.cols + j]!;
    }
  }
  return m;
}

/** Kronecker product a ⊗ b. */
export function kron(a: CMat, b: CMat): CMat {
  const m = mat(a.rows * b.rows, a.cols * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const ar = a.re[i * a.cols + j]!;
      const ai = a.im[i * a.cols + j]!;
      if (ar === 0 && ai === 0) continue;
      for (let p = 0; p < b.rows; p++) {
        for (let q = 0; q < b.cols; q++) {
          const br = b.re[p * b.cols + q]!;
          const bi = b.im[p * b.cols + q]!;
          const ri = i * b.rows + p;
          const ci = j * b.cols + q;
          m.re[ri * m.cols + ci] = m.re[ri * m.cols + ci]! + (ar * br - ai * bi);
          m.im[ri * m.cols + ci] = m.im[ri * m.cols + ci]! + (ar * bi + ai * br);
        }
      }
    }
  }
  return m;
}

function matEq(a: CMat, b: CMat, tol = 1e-12): boolean {
  if (a.rows !== b.rows || a.cols !== b.cols) return false;
  for (let k = 0; k < a.re.length; k++) {
    if (Math.abs(a.re[k]! - b.re[k]!) > tol || Math.abs(a.im[k]! - b.im[k]!) > tol) return false;
  }
  return true;
}

/** Unitary check: U†U = I within tol. */
export function isUnitary(u: CMat, tol = 1e-10): boolean {
  if (u.rows !== u.cols) return false;
  return matEq(mMul(mDagger(u), u), identity(u.rows), tol);
}
