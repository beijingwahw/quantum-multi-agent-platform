/**
 * Minimal dense linear algebra used by the classical referees:
 *  - luSolve: Gaussian elimination with partial pivoting, for expected hitting
 *    times of Markov chains via the fundamental matrix (I - Q) tau = 1.
 *  - jacobiEigenvalues: cyclic Jacobi for real symmetric matrices, for the
 *    spectral referee on discriminant matrices of reversible chains.
 * Zero dependencies; everything double precision.
 */
import { reject } from "./errors.js";

/** Solve A x = b for a square nonsingular A. A is consumed (factored in place); b is copied. */
export function luSolve(n: number, a: Float64Array, b: Float64Array): Float64Array {
  // v0.3.0: dimension mismatch used to read out of bounds and return a silent
  // NaN solution; it is now a named rejection.
  if (a.length !== n * n || b.length !== n) {
    reject("LINALG_SHAPE", `luSolve: a must be n*n and b must be n (got ${a.length}, ${b.length} for n=${n})`);
  }
  const x = Float64Array.from(b);
  const piv = new Int32Array(n);
  for (let i = 0; i < n; i++) piv[i] = i;

  // LU factorization with partial pivoting, row-major n x n.
  for (let k = 0; k < n; k++) {
    let best = k;
    let bestAbs = Math.abs(a[k * n + k] as number);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(a[i * n + k] as number);
      if (v > bestAbs) {
        bestAbs = v;
        best = i;
      }
    }
    if (bestAbs === 0) reject("LINALG_SINGULAR", "luSolve: singular matrix");
    if (best !== k) {
      for (let j = 0; j < n; j++) {
        const t = a[k * n + j] as number;
        a[k * n + j] = a[best * n + j] as number;
        a[best * n + j] = t;
      }
      const tp = piv[k] as number;
      piv[k] = piv[best] as number;
      piv[best] = tp;
      const tb = x[k] as number;
      x[k] = x[best] as number;
      x[best] = tb;
    }
    const akk = a[k * n + k] as number;
    for (let i = k + 1; i < n; i++) {
      const f = (a[i * n + k] as number) / akk;
      if (f === 0) continue;
      a[i * n + k] = f;
      for (let j = k + 1; j < n; j++) {
        a[i * n + j] = (a[i * n + j] as number) - f * (a[k * n + j] as number);
      }
      x[i] = (x[i] as number) - f * (x[k] as number);
    }
  }

  const sol = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i] as number;
    for (let j = i + 1; j < n; j++) s -= (a[i * n + j] as number) * (sol[j] as number);
    sol[i] = s / (a[i * n + i] as number);
  }
  return sol;
}

/** Expected hitting time of a Markov chain to an absorbing target SET, from a start distribution.
 *
 * The chain is given as a row-stochastic matrix P (row-major n x n) over states
 * 0..n-1; target states are absorbing. Solves the standard fundamental-matrix
 * system over transient states; returns the expected number of steps weighted
 * by startMu (mass on targets contributes 0: already absorbed).
 */
export function hittingTime(n: number, p: Float64Array, targets: ReadonlySet<number>, startMu: Float64Array): number {
  if (p.length !== n * n || startMu.length !== n) {
    reject("LINALG_SHAPE", `hittingTime: p must be n*n and startMu must be n (got ${p.length}, ${startMu.length} for n=${n})`);
  }
  for (const t of targets) {
    if (!Number.isInteger(t) || t < 0 || t >= n) {
      reject("LINALG_SHAPE", `hittingTime: target ${t} outside states [0, n=${n})`);
    }
  }
  const transient: number[] = [];
  for (let i = 0; i < n; i++) if (!targets.has(i)) transient.push(i);
  const m = transient.length;
  if (m === 0) return 0;
  const q = new Float64Array(m * m);
  const ones = new Float64Array(m).fill(1);
  for (let i = 0; i < m; i++) {
    const si = transient[i] as number;
    for (let j = 0; j < m; j++) {
      const sj = transient[j] as number;
      q[i * m + j] = (i === j ? 1 : 0) - (p[si * n + sj] as number);
    }
  }
  const tau = luSolve(m, q, ones);
  let ht = 0;
  for (let i = 0; i < m; i++) ht += (startMu[transient[i] as number] as number) * (tau[i] as number);
  return ht;
}

/** Eigenvalues (ascending) of a real symmetric n x n matrix via cyclic Jacobi. Consumes a copy. */
export function jacobiEigenvalues(n: number, matrixIn: Float64Array, sweeps = 100): Float64Array {
  if (matrixIn.length !== n * n) {
    reject("LINALG_SHAPE", `jacobiEigenvalues: matrix must be n*n (got ${matrixIn.length} for n=${n})`);
  }
  const a = Float64Array.from(matrixIn);
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) off += ((a[i * n + j] as number) ** 2);
    }
    if (off <= 1e-30 * (1 + n)) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q] as number;
        if (Math.abs(apq) < 1e-300) continue;
        const app = a[p * n + p] as number;
        const aqq = a[q * n + q] as number;
        const theta = (aqq - app) / (2 * apq);
        // Choose the smaller-rotation root of t^2 + 2 t theta - 1 = 0.
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p] as number;
          const akq = a[k * n + q] as number;
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k] as number;
          const aqk = a[q * n + k] as number;
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
      }
    }
  }
  const eig = new Float64Array(n);
  for (let i = 0; i < n; i++) eig[i] = a[i * n + i] as number;
  return Float64Array.from(eig.sort((x, y) => x - y));
}
