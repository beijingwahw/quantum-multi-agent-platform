/**
 * Minimal complex kernels for the ground-state compilation layer.
 * Dimensions stay small (data <= 3 qubits, clock <= 13 steps => dim <= 104,
 * real embedding <= 208), so dense clarity beats speed everywhere.
 * Complex matrices: separate re/im row-major number[][] grids.
 * Complex vectors: separate re/im Float64Array.
 */

export interface CMat {
  readonly dim: number;
  readonly re: number[][];
  readonly im: number[][];
}

export interface CVec {
  readonly dim: number;
  readonly re: Float64Array;
  readonly im: Float64Array;
}

export function cmatZero(dim: number): CMat {
  return {
    dim,
    re: Array.from({ length: dim }, () => new Array<number>(dim).fill(0)),
    im: Array.from({ length: dim }, () => new Array<number>(dim).fill(0)),
  };
}

export function cmatEye(dim: number, scale = 1): CMat {
  const m = cmatZero(dim);
  for (let i = 0; i < dim; i++) m.re[i]![i] = scale;
  return m;
}

export function cmatAdd(a: CMat, b: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      out.re[i]![j] = (a.re[i]![j] as number) + (b.re[i]![j] as number);
      out.im[i]![j] = (a.im[i]![j] as number) + (b.im[i]![j] as number);
    }
  }
  return out;
}

/** Entrywise maximum |a - b| (complex modulus), the house distance metric. */
export function cmatMaxDiff(a: CMat, b: CMat): number {
  let d = 0;
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      d = Math.max(
        d,
        Math.hypot((a.re[i]![j] as number) - (b.re[i]![j] as number), (a.im[i]![j] as number) - (b.im[i]![j] as number)),
      );
    }
  }
  return d;
}

/** Hermiticity deviation max |H - H^dagger| (should be ~1e-16 for our builders). */
export function cmatHermDev(h: CMat): number {
  let d = 0;
  for (let i = 0; i < h.dim; i++) {
    for (let j = 0; j < h.dim; j++) {
      const rij = h.re[i]![j] as number;
      const iij = h.im[i]![j] as number;
      const rji = h.re[j]![i] as number;
      const iji = h.im[j]![i] as number;
      d = Math.max(d, Math.hypot(rij - rji, iij + iji));
    }
  }
  return d;
}

export function cvecZero(dim: number): CVec {
  return { dim, re: new Float64Array(dim), im: new Float64Array(dim) };
}

export function cvecBasis(dim: number, index: number): CVec {
  const v = cvecZero(dim);
  v.re[index] = 1;
  return v;
}

export function cvecAddScaled(v: CVec, w: CVec, sr: number, si: number): void {
  for (let k = 0; k < v.dim; k++) {
    v.re[k] = (v.re[k] as number) + sr * (w.re[k] as number) - si * (w.im[k] as number);
    v.im[k] = (v.im[k] as number) + sr * (w.im[k] as number) + si * (w.re[k] as number);
  }
}

export function cvecNorm(v: CVec): number {
  let s = 0;
  for (let k = 0; k < v.dim; k++) s += (v.re[k] as number) ** 2 + (v.im[k] as number) ** 2;
  return Math.sqrt(s);
}

/** <v|w> (v^dagger w), complex result. */
export function cvecInner(v: CVec, w: CVec): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let k = 0; k < v.dim; k++) {
    const vr = v.re[k] as number;
    const vi = v.im[k] as number;
    const wr = w.re[k] as number;
    const wi = w.im[k] as number;
    re += vr * wr + vi * wi;
    im += vr * wi - vi * wr;
  }
  return { re, im };
}

/** |<v|w>| for normalized vectors. */
export function cvecFidelity(v: CVec, w: CVec): number {
  const z = cvecInner(v, w);
  return Math.hypot(z.re, z.im);
}

/** y = A x. */
export function cmatApply(a: CMat, x: CVec): CVec {
  if (a.dim !== x.dim) throw new Error(`cmatApply: dim mismatch ${a.dim} vs ${x.dim}`);
  const out = cvecZero(a.dim);
  for (let i = 0; i < a.dim; i++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < a.dim; j++) {
      const ar = a.re[i]![j] as number;
      const ai = a.im[i]![j] as number;
      const xr = x.re[j] as number;
      const xi = x.im[j] as number;
      re += ar * xr - ai * xi;
      im += ar * xi + ai * xr;
    }
    out.re[i] = re;
    out.im[i] = im;
  }
  return out;
}

/** Max |Ax| entrywise modulus — used for the H|psi> = 0 certificates. */
export function cmatApplyMaxNorm(a: CMat, x: CVec): number {
  const y = cmatApply(a, x);
  let d = 0;
  for (let k = 0; k < y.dim; k++) d = Math.max(d, Math.hypot(y.re[k] as number, y.im[k] as number));
  return d;
}

/** Unitarity deviation max |M^dagger M - I| for square matrices. */
export function cmatUnitaryDev(m: CMat): number {
  const n = m.dim;
  let d = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let re = 0;
      let im = 0;
      for (let k = 0; k < n; k++) {
        // (M^dagger M)_{ij} = sum_k conj(M_ki) M_kj
        const kr = m.re[k]![i] as number;
        const ki = m.im[k]![i] as number;
        const lr = m.re[k]![j] as number;
        const li = m.im[k]![j] as number;
        re += kr * lr + ki * li;
        im += kr * li - ki * lr;
      }
      d = Math.max(d, Math.hypot(re - (i === j ? 1 : 0), im));
    }
  }
  return d;
}

/** Trace, complex result. */
export function cmatTrace(m: CMat): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let i = 0; i < m.dim; i++) {
    re += m.re[i]![i] as number;
    im += m.im[i]![i] as number;
  }
  return { re, im };
}

/** out = A * B for square matrices of equal dim. */
export function cmatMul(a: CMat, b: CMat): CMat {
  const n = a.dim;
  const out = cmatZero(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let re = 0;
      let im = 0;
      for (let k = 0; k < n; k++) {
        const ar = a.re[i]![k] as number;
        const ai = a.im[i]![k] as number;
        const br = b.re[k]![j] as number;
        const bi = b.im[k]![j] as number;
        re += ar * br - ai * bi;
        im += ar * bi + ai * br;
      }
      out.re[i]![j] = re;
      out.im[i]![j] = im;
    }
  }
  return out;
}

/** Tensor product a ⊗ b. */
export function cmatKron(a: CMat, b: CMat): CMat {
  const dim = a.dim * b.dim;
  const out = cmatZero(dim);
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const ar = a.re[i]![j] as number;
      const ai = a.im[i]![j] as number;
      if (ar === 0 && ai === 0) continue;
      for (let k = 0; k < b.dim; k++) {
        for (let l = 0; l < b.dim; l++) {
          const br = b.re[k]![l] as number;
          const bi = b.im[k]![l] as number;
          out.re[i * b.dim + k]![j * b.dim + l] = ar * br - ai * bi;
          out.im[i * b.dim + k]![j * b.dim + l] = ar * bi + ai * br;
        }
      }
    }
  }
  return out;
}

/** Conjugate transpose. */
export function cmatAdjoint(m: CMat): CMat {
  const out = cmatZero(m.dim);
  for (let i = 0; i < m.dim; i++) {
    for (let j = 0; j < m.dim; j++) {
      out.re[i]![j] = m.re[j]![i] as number;
      out.im[i]![j] = -(m.im[j]![i] as number);
    }
  }
  return out;
}

/** Full Hermitian eigendecomposition via the 2n x 2n real embedding
 * [[Re, -Im], [Im, Re]] (eigenvalues in exact pairs) + cyclic Jacobi with
 * separate row and column passes. Self-certifying: the decomposition is
 * accepted only if sum_j lambda_j v_j v_j^dagger reconstructs H.
 */
export function eigHermitian(h: CMat): { values: Float64Array; vectors: CVec[] } {
  if (cmatHermDev(h) > 1e-12 * Math.max(1, Math.abs(cmatTrace(h).re))) {
    throw new Error("eigHermitian: input not Hermitian");
  }
  const n = h.dim;
  const N = 2 * n;
  // real embedding
  const a: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      a[i]![j] = h.re[i]![j] as number;
      a[i + n]![j + n] = h.re[i]![j] as number;
      a[i]![j + n] = -(h.im[i]![j] as number);
      a[i + n]![j] = h.im[i]![j] as number;
    }
  }
  // accumulated rotations: columns of v are real eigenvectors of the embedding
  const v: number[][] = Array.from({ length: N }, (_, i) => {
    const row = new Array<number>(N).fill(0);
    row[i] = 1;
    return row;
  });

  const offDiag = (): number => {
    let s = 0;
    for (let p = 0; p < N; p++) for (let q = p + 1; q < N; q++) s += (a[p]![q] as number) ** 2;
    return Math.sqrt(2 * s);
  };
  let scale = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) scale = Math.max(scale, Math.abs(a[i]![j] as number));
  if (scale === 0) scale = 1;
  const tol = 1e-14 * scale;
  for (let sweep = 0; sweep < 100 && offDiag() > tol; sweep++) {
    for (let p = 0; p < N; p++) {
      for (let q = p + 1; q < N; q++) {
        const apq = a[p]![q] as number;
        if (Math.abs(apq) <= 1e-18 * scale) continue;
        const app = a[p]![p] as number;
        const aqq = a[q]![q] as number;
        const theta = (aqq - app) / (2 * apq);
        const t = (Math.sign(theta) || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // A <- J^T A J with J the (p,q) rotation: row pass then column pass,
        // never in the same k-loop (a diagonalized-house lesson).
        for (let k = 0; k < N; k++) {
          const rp = a[p]![k] as number;
          const rq = a[q]![k] as number;
          a[p]![k] = c * rp - s * rq;
          a[q]![k] = s * rp + c * rq;
        }
        for (let k = 0; k < N; k++) {
          const cp = a[k]![p] as number;
          const cq = a[k]![q] as number;
          a[k]![p] = c * cp - s * cq;
          a[k]![q] = s * cp + c * cq;
        }
        for (let k = 0; k < N; k++) {
          const vp = v[k]![p] as number;
          const vq = v[k]![q] as number;
          v[k]![p] = c * vp - s * vq;
          v[k]![q] = s * vp + c * vq;
        }
      }
    }
  }

  // collect, sort ascending, cluster, decode per cluster with complex
  // Gram-Schmidt. Within a degenerate cluster Jacobi returns an ARBITRARY
  // orthogonal real basis; decoding arbitrary real combos gives complex
  // vectors that may be complex-dependent pairwise, so the basis is rebuilt
  // by complex orthonormalization inside the cluster (complex combinations
  // of same-lambda eigenvectors stay eigenvectors).
  const idx = Array.from({ length: N }, (_, i) => i).sort((x, y) => (a[x]![x] as number) - (a[y]![y] as number));
  const values = new Float64Array(n);
  const vectors: CVec[] = [];
  let clusterStart = 0;
  while (clusterStart < N) {
    let clusterEnd = clusterStart + 1;
    while (
      clusterEnd < N &&
      Math.abs((a[idx[clusterEnd] as number]![idx[clusterEnd] as number] as number) - (a[idx[clusterStart] as number]![idx[clusterStart] as number] as number)) <=
        1e-8 * scale
    ) {
      clusterEnd++;
    }
    const lam = a[idx[clusterStart] as number]![idx[clusterStart] as number] as number;
    const mult = clusterEnd - clusterStart; // real multiplicity = 2 x complex multiplicity
    if (mult % 2 !== 0) throw new Error(`eigHermitian: odd real multiplicity ${mult} at lambda ${lam}`);
    const m = mult / 2;
    const basis: CVec[] = [];
    for (let j = clusterStart; j < clusterEnd && basis.length < m; j++) {
      const i = idx[j] as number;
      const z = cvecZero(n);
      for (let k = 0; k < n; k++) {
        z.re[k] = v[k]![i] as number;
        z.im[k] = v[k + n]![i] as number;
      }
      const norm0 = cvecNorm(z);
      if (norm0 < 1e-8) continue;
      // Gram-Schmidt against already-accepted cluster members
      for (const u of basis) {
        const zc = cvecInner(u, z); // <u|z>
        for (let k = 0; k < n; k++) {
          z.re[k] = (z.re[k] as number) - (zc.re * (u.re[k] as number) - zc.im * (u.im[k] as number));
          z.im[k] = (z.im[k] as number) - (zc.re * (u.im[k] as number) + zc.im * (u.re[k] as number));
        }
      }
      const norm = cvecNorm(z);
      if (norm < 1e-8 * norm0) continue; // complex-dependent, drop
      for (let k = 0; k < n; k++) {
        z.re[k] = (z.re[k] as number) / norm;
        z.im[k] = (z.im[k] as number) / norm;
      }
      basis.push(z);
    }
    if (basis.length !== m) throw new Error(`eigHermitian: cluster at ${lam} rebuilt ${basis.length} of ${m} complex eigenvectors`);
    for (let j = 0; j < m; j++) {
      values[vectors.length] = lam;
      vectors.push(basis[j] as CVec);
    }
    clusterStart = clusterEnd;
  }
  if (vectors.length !== n) throw new Error(`eigHermitian: decoded ${vectors.length} of ${n} eigenvectors`);

  // reconstruction certificate: sum_k lam_k v_k v_k^dagger == H
  const recon = cmatZero(n);
  for (let k = 0; k < n; k++) {
    const vk = vectors[k] as CVec;
    const lam = values[k] as number;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // lam * v_i conj(v_j): (re_i + i im_i)(re_j - i im_j)
        recon.re[i]![j] = (recon.re[i]![j] as number) + lam * ((vk.re[i] as number) * (vk.re[j] as number) + (vk.im[i] as number) * (vk.im[j] as number));
        recon.im[i]![j] = (recon.im[i]![j] as number) + lam * ((vk.im[i] as number) * (vk.re[j] as number) - (vk.re[i] as number) * (vk.im[j] as number));
      }
    }
  }
  if (cmatMaxDiff(recon, h) > 1e-8 * Math.max(1, scale)) {
    throw new Error(`eigHermitian: reconstruction deviation ${cmatMaxDiff(recon, h)}`);
  }
  return { values, vectors };
}

export function eigenvaluesHermitian(h: CMat): Float64Array {
  return eigHermitian(h).values;
}

/** Gap above the (possibly degenerate) ground: the first spectral value
 * separated from values[0] by more than tol. Reading vals[1] as "the gap"
 * silently returns 0 whenever the ground is degenerate (H_prop's always is:
 * every input's history is a ground state). */
export function firstExcited(values: Float64Array, tol = 1e-9): { gap: number; groundDegeneracy: number } {
  const e0 = values[0] as number;
  for (let k = 1; k < values.length; k++) {
    if ((values[k] as number) - e0 > tol) return { gap: (values[k] as number) - e0, groundDegeneracy: k };
  }
  return { gap: 0, groundDegeneracy: values.length };
}
