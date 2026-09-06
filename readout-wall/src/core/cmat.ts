/**
 * Dense complex linear algebra for density-matrix simulation.
 *
 * Small dimensions only (<= a few hundred): everything is O(d^3) or worse.
 * Hermitian eigenvalues are computed through the real-symmetric embedding
 * [[Re, -Im], [Im, Re]] whose spectrum doubles every eigenvalue of H; a
 * classical Jacobi rotation sweep diagonalizes the embedding. This avoids a
 * complex-eigensolver implementation entirely.
 */

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

export function vec(n: number, fill = 0): CVec {
  return { n, re: new Float64Array(n).fill(fill), im: new Float64Array(n) };
}

export function mat(rows: number, cols: number): CMat {
  return { rows, cols, re: new Float64Array(rows * cols), im: new Float64Array(rows * cols) };
}

export function basisVec(n: number, i: number): CVec {
  const v = vec(n);
  v.re[i] = 1;
  return v;
}

export function identity(d: number): CMat {
  const m = mat(d, d);
  for (let i = 0; i < d; i++) m.re[i * d + i] = 1;
  return m;
}

export function vAdd(a: CVec, b: CVec): CVec {
  if (a.n !== b.n) throw new Error(`vAdd: length mismatch ${a.n} vs ${b.n}`);
  const r = vec(a.n);
  for (let i = 0; i < a.n; i++) {
    r.re[i] = a.re[i]! + b.re[i]!;
    r.im[i] = a.im[i]! + b.im[i]!;
  }
  return r;
}

export function vScale(a: CVec, s: number): CVec {
  const r = vec(a.n);
  for (let i = 0; i < a.n; i++) {
    r.re[i] = a.re[i]! * s;
    r.im[i] = a.im[i]! * s;
  }
  return r;
}

export function vInner(a: CVec, b: CVec): { re: number; im: number } {
  if (a.n !== b.n) throw new Error(`vInner: length mismatch ${a.n} vs ${b.n}`);
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.n; i++) {
    // conj(a) * b
    re += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;
    im += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
  }
  return { re, im };
}

export function vNorm(a: CVec): number {
  return Math.sqrt(vInner(a, a).re);
}

export function vNormalize(a: CVec): CVec {
  const nrm = vNorm(a);
  return nrm === 0 ? a : vScale(a, 1 / nrm);
}

/** |a><b| */
export function outer(a: CVec, b: CVec): CMat {
  const m = mat(a.n, b.n);
  for (let i = 0; i < a.n; i++) {
    for (let j = 0; j < b.n; j++) {
      m.re[i * b.n + j] = a.re[i]! * b.re[j]! + a.im[i]! * b.im[j]!;
      m.im[i * b.n + j] = a.im[i]! * b.re[j]! - a.re[i]! * b.im[j]!;
    }
  }
  return m;
}

export function mAdd(a: CMat, b: CMat): CMat {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new Error(`mAdd: shape mismatch ${a.rows}x${a.cols} vs ${b.rows}x${b.cols}`);
  }
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
  if (a.cols !== b.rows) throw new Error(`shape mismatch ${a.rows}x${a.cols} * ${b.rows}x${b.cols}`);
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

export function mTrace(a: CMat): { re: number; im: number } {
  if (a.rows !== a.cols) throw new Error('trace requires square');
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.rows; i++) {
    re += a.re[i * a.cols + i]!;
    im += a.im[i * a.cols + i]!;
  }
  return { re, im };
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

/** Kronecker product of column vectors. */
export function vKron(a: CVec, b: CVec): CVec {
  const v = vec(a.n * b.n);
  for (let i = 0; i < a.n; i++) {
    for (let j = 0; j < b.n; j++) {
      v.re[i * b.n + j] = a.re[i]! * b.re[j]! - a.im[i]! * b.im[j]!;
      v.im[i * b.n + j] = a.re[i]! * b.im[j]! + a.im[i]! * b.re[j]!;
    }
  }
  return v;
}

export function kronAll(mats: CMat[]): CMat {
  if (mats.length === 0) throw new Error('kronAll needs >=1 matrix');
  return mats.reduce((acc, m) => kron(acc, m));
}

export function vecToMat(v: CVec): CMat {
  const m = mat(v.n, 1);
  m.re.set(v.re);
  m.im.set(v.im);
  return m;
}

export function matToVec(m: CMat): CVec {
  if (m.cols !== 1) throw new Error('matToVec requires column');
  return { n: m.rows, re: m.re.slice(), im: m.im.slice() };
}

export function isHermitian(a: CMat, tol = 1e-12): boolean {
  if (a.rows !== a.cols) return false;
  for (let i = 0; i < a.rows; i++) {
    for (let j = i; j < a.cols; j++) {
      const dr = a.re[i * a.cols + j]! - a.re[j * a.cols + i]!;
      const di = a.im[i * a.cols + j]! + a.im[j * a.cols + i]!;
      if (Math.abs(dr) > tol || Math.abs(di) > tol) return false;
    }
  }
  return true;
}

export function matEq(a: CMat, b: CMat, tol = 1e-12): boolean {
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

/** Jacobi eigenvalue algorithm for a real symmetric matrix (row-major).
 * Only the diagonal (eigenvalues) is consumed; eigenvectors are obtained by
 * block inverse iteration in eigVecsFromValues — hand-tuning rotation
 * accumulation conventions proved too error-prone. */
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

/** Solve A x = b for real A (row-major, destroyed) by Gaussian elimination
 * with partial pivoting. Returns null when numerically singular. */
function solveLinear(a: Float64Array, n: number, b: Float64Array): Float64Array | null {
  const x = b.slice();
  for (let col = 0; col < n; col++) {
    let best = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r * n + col]!) > Math.abs(a[best * n + col]!)) best = r;
    }
    if (Math.abs(a[best * n + col]!) < 1e-300) return null;
    if (best !== col) {
      for (let j = 0; j < n; j++) {
        const t = a[col * n + j]!;
        a[col * n + j] = a[best * n + j]!;
        a[best * n + j] = t;
      }
      const t = x[col]!;
      x[col] = x[best]!;
      x[best] = t;
    }
    const piv = a[col * n + col]!;
    for (let r = col + 1; r < n; r++) {
      const f = a[r * n + col]! / piv;
      if (f === 0) continue;
      for (let j = col; j < n; j++) a[r * n + j] = a[r * n + j]! - f * a[col * n + j]!;
      x[r] = x[r]! - f * x[col]!;
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r]!;
    for (let j = r + 1; j < n; j++) s -= a[r * n + j]! * x[j]!;
    x[r] = s / a[r * n + r]!;
  }
  return x;
}

/** Orthonormalize the columns of X (n×m, column-major array of columns). */
function orthonormalize(cols: Float64Array[], n: number): Float64Array[] {
  const out: Float64Array[] = [];
  for (const col of cols) {
    const v = col.slice();
    for (let pass = 0; pass < 2; pass++) {
      for (const u of out) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += u[i]! * v[i]!;
        for (let i = 0; i < n; i++) v[i] = v[i]! - dot * u[i]!;
      }
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (norm < 1e-12) return out; // rank exhausted
    for (let i = 0; i < n; i++) v[i] = v[i]! / norm;
    out.push(v);
  }
  return out;
}

/**
 * Eigenvectors of a real symmetric matrix from its (trusted) eigenvalues by
 * block inverse iteration: for each degenerate cluster, iterate (A - (λ+ε)I)⁻¹
 * on a random block, re-orthonormalizing. ε is half the distance to the
 * nearest eigenvalue outside the cluster.
 */
export function eigVecsFromValues(
  emb: Float64Array,
  n: number,
  values: Float64Array,
  seed: number,
): Float64Array[] {
  // fewer eigenvalues than dimensions would read undefined in the cluster sort
  if (values.length < n) throw new Error('eigVecsFromValues: fewer eigenvalues than dimensions');
  const scale = Math.max(...Array.from(values).map(Math.abs), 1e-30);
  const tol = 1e-9 * scale;
  // cluster eigenvalues (they arrive unsorted from jacobi)
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a]! - values[b]!);
  const clusters: number[][] = [];
  for (const i of idx) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(values[i]! - values[last[0]!]!) <= tol) last.push(i);
    else clusters.push([i]);
  }
  let rngState = seed >>> 0;
  const rand = (): number => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  };
  const out: Array<Float64Array | null> = new Array<Float64Array | null>(n).fill(null);
  for (let ci = 0; ci < clusters.length; ci++) {
    const cluster = clusters[ci]!;
    const lam = values[cluster[0]!]!;
    // distance to nearest eigenvalue outside this cluster
    let gap = Infinity;
    for (let cj = 0; cj < clusters.length; cj++) {
      if (cj === ci) continue;
      gap = Math.min(gap, Math.abs(lam - values[clusters[cj]![0]!]!));
    }
    const eps = Math.min(gap / 16, Math.max(scale * 1e-9, 1e-13));
    const m = cluster.length;
    // random block
    let block: Float64Array[] = Array.from({ length: m }, () => {
      const v = new Float64Array(n);
      for (let i = 0; i < n; i++) v[i] = rand() * 2 - 1;
      return v;
    });
    block = orthonormalize(block, n);
    if (block.length < m) {
      // degenerate random draws — retry once deterministically
      block = Array.from({ length: m }, (_, j) => {
        const v = new Float64Array(n);
        v[cluster[j]! % n] = 1;
        for (let i = 0; i < n; i++) v[i] = v[i]! + rand() * 1e-3;
        return v;
      });
      block = orthonormalize(block, n);
    }
    for (let iter = 0; iter < 12; iter++) {
      const shifted = emb.slice();
      for (let i = 0; i < n; i++) shifted[i * n + i] = shifted[i * n + i]! - (lam + eps);
      const next: Float64Array[] = [];
      for (const col of block) {
        const lu = shifted.slice();
        const sol = solveLinear(lu, n, col);
        next.push(sol ?? col);
      }
      const orth = orthonormalize(next, n);
      if (orth.length === m) block = orth;
      else break;
    }
    for (let j = 0; j < cluster.length && j < block.length; j++) {
      out[cluster[j]!] = block[j]!;
    }
  }
  if (out.some((v) => v === null)) throw new Error('eigVecsFromValues: incomplete eigenspace');
  return out as Float64Array[];
}

/**
 * Eigenvalues of a complex Hermitian matrix, ascending order, length n.
 * Uses the 2n x 2n real embedding whose eigenvalues come in exact pairs.
 */
export function eigenvaluesHermitian(h: CMat): Float64Array {
  if (h.rows !== h.cols) throw new Error('eigenvalues require square Hermitian');
  const n = h.rows;
  const N = 2 * n;
  const emb = buildEmbedding(h, n, N);
  const raw = jacobiRealSymmetric(emb, N);
  const sorted = Array.from(raw).sort((x, y) => x - y);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (sorted[2 * i]! + sorted[2 * i + 1]!) / 2;
  return out;
}

/**
 * Spectral decomposition of a Hermitian matrix: eigenvalues ascending with
 * matching complex eigenvectors (n x 1 matrices). The decomposition is
 * accepted only if it reconstructs H: Σ λ v v† = H to 1e-8.
 */
export function eigHermitian(h: CMat): { values: Float64Array; vectors: CMat[] } {
  if (h.rows !== h.cols) throw new Error('eig requires square Hermitian');
  const n = h.rows;
  const N = 2 * n;
  const emb = buildEmbedding(h, n, N);
  const raw = jacobiRealSymmetric(emb, N);
  const rawVecs = eigVecsFromValues(emb, N, raw, 0x5eed1234);

  const scale = Math.max(...Array.from(raw).map(Math.abs), 1e-30);
  const tol = 1e-9 * scale;
  const idx = Array.from({ length: N }, (_, i) => i).sort((a, b) => raw[a]! - raw[b]!);
  const clusters: number[][] = [];
  for (const i of idx) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(raw[i]! - raw[last[0]!]!) <= tol) last.push(i);
    else clusters.push([i]);
  }

  interface CArr {
    re: number[];
    im: number[];
  }
  const decode = (e: Float64Array): CArr => ({
    re: Array.from(e.slice(0, n)),
    im: Array.from(e.slice(n, N)),
  });
  const cInner = (u: CArr, v: CArr): { re: number; im: number } => {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += u.re[i]! * v.re[i]! + u.im[i]! * v.im[i]!;
      im += u.re[i]! * v.im[i]! - u.im[i]! * v.re[i]!;
    }
    return { re, im };
  };

  const outValues: number[] = [];
  const outVectors: CMat[] = [];
  for (const cluster of clusters) {
    const lam = raw[cluster[0]!]!;
    const m = cluster.length / 2; // complex multiplicity
    const basis: CArr[] = [];
    for (const i of cluster) {
      if (basis.length >= m) break;
      let v = decode(rawVecs[i]!);
      for (const u of basis) {
        const d = cInner(u, v);
        for (let k = 0; k < n; k++) {
          v.re[k] = v.re[k]! - (d.re * u.re[k]! - d.im * u.im[k]!);
          v.im[k] = v.im[k]! - (d.re * u.im[k]! + d.im * u.re[k]!);
        }
      }
      let nrm = cInner(v, v).re;
      if (nrm < 1e-14) continue;
      nrm = Math.sqrt(nrm);
      v = { re: v.re.map((x) => x / nrm), im: v.im.map((x) => x / nrm) };
      basis.push(v);
    }
    if (basis.length < m) throw new Error('eigHermitian: complex basis extraction failed');
    for (const v of basis) {
      outValues.push(lam);
      outVectors.push(colFrom(v.re, v.im));
    }
  }

  const orderOut = outValues.map((_, i) => i).sort((a, b) => outValues[a]! - outValues[b]!);
  const values = new Float64Array(n);
  const vectors: CMat[] = [];
  for (let k = 0; k < n; k++) {
    values[k] = outValues[orderOut[k]!]!;
    vectors.push(outVectors[orderOut[k]!]!);
  }
  const recon = reconstruct(h, values, vectors);
  let err = 0;
  for (let k = 0; k < h.re.length; k++) {
    err += Math.abs(recon.re[k]! - h.re[k]!) + Math.abs(recon.im[k]! - h.im[k]!);
  }
  if (err > 1e-8) throw new Error(`eigHermitian: reconstruction failed (err=${err.toExponential(2)})`);
  return { values, vectors };
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

export function colFrom(re: number[], im: number[]): CMat {
  // mismatched parts would read undefined past the shorter array and yield NaN silently
  if (re.length !== im.length) {
    throw new Error(`colFrom: real/imaginary parts must have equal length (${re.length} vs ${im.length})`);
  }
  const m = mat(re.length, 1);
  for (let i = 0; i < re.length; i++) {
    m.re[i] = re[i]!;
    m.im[i] = im[i]!;
  }
  return m;
}

export function reconstruct(h: CMat, values: Float64Array, vectors: CMat[]): CMat {
  const n = h.rows;
  const out = mat(n, n);
  for (let m = 0; m < n; m++) {
    const lam = values[m]!;
    if (lam <= 0) continue;
    const vk = vectors[m]!;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        out.re[i * n + j] = out.re[i * n + j]! + lam * (vk.re[i]! * vk.re[j]! + vk.im[i]! * vk.im[j]!);
        out.im[i * n + j] = out.im[i * n + j]! + lam * (vk.im[i]! * vk.re[j]! - vk.re[i]! * vk.im[j]!);
      }
    }
  }
  return out;
}

/** PSD matrix square root via spectral decomposition (clamps negatives). */
export function sqrtPSD(a: CMat): CMat {
  const { values, vectors } = eigHermitian(a);
  const n = a.rows;
  const out = mat(n, n);
  for (let k = 0; k < n; k++) {
    const lam = Math.max(0, values[k]!);
    if (lam === 0) continue;
    const s = Math.sqrt(lam);
    const vk = vectors[k]!; // n x 1
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // |v><v| * s, v is real-normalized complex column
        out.re[i * n + j] = out.re[i * n + j]! + s * (vk.re[i]! * vk.re[j]! + vk.im[i]! * vk.im[j]!);
        out.im[i * n + j] = out.im[i * n + j]! + s * (vk.im[i]! * vk.re[j]! - vk.re[i]! * vk.im[j]!);
      }
    }
  }
  return out;
}

/** Rebuild a Hermitian matrix from its spectral decomposition. */
export function fromSpectral(values: Float64Array, vectors: CMat[]): CMat {
  const first = vectors[0];
  if (first === undefined) throw new Error('fromSpectral: empty spectral list');
  const n = first.rows;
  // values and vectors are parallel lists, one per eigenpair of the n x n matrix
  if (values.length !== n || vectors.length !== n) {
    throw new Error(`fromSpectral: expected ${n} values and vectors, got ${values.length}/${vectors.length}`);
  }
  const out = mat(n, n);
  for (let k = 0; k < n; k++) {
    const vk = vectors[k]!;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        out.re[i * n + j] = out.re[i * n + j]! + values[k]! * (vk.re[i]! * vk.re[j]! + vk.im[i]! * vk.im[j]!);
        out.im[i * n + j] = out.im[i * n + j]! + values[k]! * (vk.im[i]! * vk.re[j]! - vk.re[i]! * vk.im[j]!);
      }
    }
  }
  return out;
}
