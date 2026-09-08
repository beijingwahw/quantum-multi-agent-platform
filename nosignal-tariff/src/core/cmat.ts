/**
 * Dense complex matrix algebra for density-matrix simulation.
 *
 * Small dimensions only (<= a few hundred): everything is O(d^3) or worse.
 * Hermitian eigenvalues are computed through the real-symmetric embedding
 * [[Re, -Im], [Im, Re]] whose spectrum doubles every eigenvalue of H; a
 * classical Jacobi rotation sweep diagonalizes the embedding. This avoids a
 * complex-eigensolver implementation entirely.
 */

import { refuse } from "./errors.js";

export interface CMat {
  readonly rows: number;
  readonly cols: number;
  readonly re: Float64Array;
  readonly im: Float64Array;
}

export function mat(rows: number, cols: number): CMat {
  return { rows, cols, re: new Float64Array(rows * cols), im: new Float64Array(rows * cols) };
}

export function identity(d: number): CMat {
  const m = mat(d, d);
  for (let i = 0; i < d; i++) m.re[i * d + i] = 1;
  return m;
}

export function mAdd(a: CMat, b: CMat): CMat {
  const m = mat(a.rows, a.cols);
  for (let k = 0; k < a.re.length; k++) {
    m.re[k] = a.re[k]! + b.re[k]!;
    m.im[k] = a.im[k]! + b.im[k]!;
  }
  return m;
}

export function mScale(a: CMat, s: number): CMat {
  const m = mat(a.rows, a.cols);
  for (let k = 0; k < a.re.length; k++) {
    m.re[k] = a.re[k]! * s;
    m.im[k] = a.im[k]! * s;
  }
  return m;
}

export function mMul(a: CMat, b: CMat): CMat {
  if (a.cols !== b.rows) {
    refuse("MMUL_SHAPE_MISMATCH", `shape mismatch ${a.rows}x${a.cols} * ${b.rows}x${b.cols}`);
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

export function matEq(a: CMat, b: CMat, tol = 1e-12): boolean {
  if (a.rows !== b.rows || a.cols !== b.cols) return false;
  for (let k = 0; k < a.re.length; k++) {
    if (Math.abs(a.re[k]! - b.re[k]!) > tol || Math.abs(a.im[k]! - b.im[k]!) > tol) return false;
  }
  return true;
}

/** Jacobi eigenvalue algorithm for a real symmetric matrix (row-major).
 * Only the diagonal (eigenvalues) is consumed. */
function jacobiRealSymmetric(a: Float64Array, n: number): Float64Array {
  const m = a.slice();
  const offDiag = (): number => {
    let s = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += m[i * n + j]! * m[i * n + j]!;
    return Math.sqrt(2 * s);
  };
  const scale = Math.sqrt(m.reduce((s, x) => s + x * x, 0)) || 1;
  for (let sweep = 0; sweep < 100 && offDiag() > 1e-15 * scale; sweep++) {
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = m[p * n + q]!;
        if (Math.abs(apq) < 1e-18 * scale) continue;
        const theta = (m[q * n + q]! - m[p * n + p]!) / (2 * apq);
        const t =
          (Math.sign(theta) || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // rotate columns p,q then rows p,q — always from copies of the
        // pre-rotation values so the two steps compose exactly as Jᵀ A J
        const colP = new Float64Array(n);
        const colQ = new Float64Array(n);
        for (let k = 0; k < n; k++) {
          colP[k] = m[k * n + p]!;
          colQ[k] = m[k * n + q]!;
        }
        for (let k = 0; k < n; k++) {
          m[k * n + p] = c * colP[k]! - s * colQ[k]!;
          m[k * n + q] = s * colP[k]! + c * colQ[k]!;
        }
        const rowP = new Float64Array(n);
        const rowQ = new Float64Array(n);
        for (let k = 0; k < n; k++) {
          rowP[k] = m[p * n + k]!;
          rowQ[k] = m[q * n + k]!;
        }
        for (let k = 0; k < n; k++) {
          m[p * n + k] = c * rowP[k]! - s * rowQ[k]!;
          m[q * n + k] = s * rowP[k]! + c * rowQ[k]!;
        }
      }
    }
  }
  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) values[i] = m[i * n + i]!;
  return values;
}

/**
 * Eigenvalues of a complex Hermitian matrix, ascending order, length n.
 * Uses the 2n x 2n real embedding whose eigenvalues come in exact pairs.
 */
export function eigenvaluesHermitian(h: CMat): Float64Array {
  if (h.rows !== h.cols) refuse("EIGENVALUES_NOT_SQUARE", "eigenvalues require square Hermitian");
  const n = h.rows;
  const N = 2 * n;
  const emb = buildEmbedding(h, n, N);
  const raw = jacobiRealSymmetric(emb, N);
  const sorted = Array.from(raw).sort((x, y) => x - y);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (sorted[2 * i]! + sorted[2 * i + 1]!) / 2;
  return out;
}

function buildEmbedding(h: CMat, n: number, N: number): Float64Array {
  const emb = new Float64Array(N * N);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const re = h.re[i * n + j]!;
      const im = h.im[i * n + j]!;
      emb[i * N + j] = re;
      emb[(i + n) * N + (j + n)] = re;
      emb[i * N + (j + n)] = -im;
      emb[(i + n) * N + j] = im;
    }
  }
  return emb;
}
