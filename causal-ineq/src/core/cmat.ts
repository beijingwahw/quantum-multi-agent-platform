/**
 * Minimal complex-matrix kernels for the process-matrix layer.
 * Matrices are small (the game lives on 4 qubits, dim 16), so clarity beats
 * speed everywhere. Complex numbers are held as separate re/im row-major
 * number[][] grids.
 */

export interface CMat {
  readonly dim: number;
  readonly re: number[][];
  readonly im: number[][];
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

export function cmatScale(a: CMat, s: number): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      out.re[i]![j] = (a.re[i]![j] as number) * s;
      out.im[i]![j] = (a.im[i]![j] as number) * s;
    }
  }
  return out;
}

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

export function cmatKron4(a: CMat, b: CMat, c: CMat, d: CMat): CMat {
  return cmatKron(cmatKron(a, b), cmatKron(c, d));
}

/** Trace of a product Tr[a·b] (complex result; used with Hermitian factors). */
export function cmatTraceProd(a: CMat, b: CMat): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const ar = a.re[i]![j] as number;
      const ai = a.im[i]![j] as number;
      const br = b.re[j]![i] as number;
      const bi = b.im[j]![i] as number;
      re += ar * br - ai * bi;
      im += ar * bi + ai * br;
    }
  }
  return { re, im };
}

export function cmatTrace(a: CMat): number {
  let t = 0;
  for (let i = 0; i < a.dim; i++) t += a.re[i]![i] as number;
  return t;
}

/** Partial trace over the SECOND factor of a tensor product (a.dim must be even). */
export function cmatPartialTraceSecond(a: CMat): CMat {
  if (a.dim % 2 !== 0) throw new Error(`cmatPartialTraceSecond: dim ${a.dim} not even`);
  const h = a.dim / 2;
  const out = cmatZero(h);
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < h; j++) {
      for (let k = 0; k < 2; k++) {
        out.re[i]![j] = (out.re[i]![j] as number) + (a.re[2 * i + k]![2 * j + k] as number);
        out.im[i]![j] = (out.im[i]![j] as number) + (a.im[2 * i + k]![2 * j + k] as number);
      }
    }
  }
  return out;
}

/** Max |a - b| over all entries (modulus); the elementwise certificate metric. */
export function cmatMaxAbsDiff(a: CMat, b: CMat): number {
  if (a.dim !== b.dim) throw new Error(`cmatMaxAbsDiff: dims ${a.dim} vs ${b.dim}`);
  let d = 0;
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const dr = (a.re[i]![j] as number) - (b.re[i]![j] as number);
      const di = (a.im[i]![j] as number) - (b.im[i]![j] as number);
      d = Math.max(d, Math.hypot(dr, di));
    }
  }
  return d;
}

/** Hermiticity deviation: max |a - a^dagger| over all entries (modulus). */
export function hermiticityDeviation(a: CMat): number {
  let d = 0;
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const dr = (a.re[i]![j] as number) - (a.re[j]![i] as number);
      const di = (a.im[i]![j] as number) + (a.im[j]![i] as number);
      d = Math.max(d, Math.hypot(dr, di));
    }
  }
  return d;
}

/**
 * Extreme eigenvalues of a Hermitian matrix. The Hermitian n x n matrix is
 * embedded into the real symmetric 2n x 2n matrix [[Re, -Im], [Im, Re]]
 * (whose eigenvalues are those of A, each twice), then diagonalized by the
 * textbook cyclic real Jacobi rotation sweep. Returns {min, max}.
 */
export function hermitianExtremeEig(a: CMat): { min: number; max: number } {
  const n = a.dim;
  const m = 2 * n;
  const s: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const re = a.re[i]![j] as number;
      const im = a.im[i]![j] as number;
      s[i]![j] = re;
      s[i]![j + n] = -im;
      s[i + n]![j] = im;
      s[i + n]![j + n] = re;
    }
  }
  let fro = 0;
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) fro += s[i]![j]! ** 2;
  const tol = 1e-13 * Math.sqrt(fro + 1e-300);
  for (let sweep = 0; sweep < 200; sweep++) {
    let off = 0;
    for (let p = 0; p < m; p++) for (let q = p + 1; q < m; q++) off += s[p]![q]! ** 2;
    if (Math.sqrt(off) < tol) break;
    for (let p = 0; p < m; p++) {
      for (let q = p + 1; q < m; q++) {
        const z = s[p]![q]!;
        if (Math.abs(z) < 1e-300) continue;
        // rotation angle that zeroes the (p,q) off-diagonal, |theta| <= pi/4
        const theta = 0.5 * Math.atan2(2 * z, s[q]![q]! - s[p]![p]!);
        const t = Math.tan(theta);
        const c = 1 / Math.sqrt(1 + t * t);
        const si = c * t;
        for (let k = 0; k < m; k++) {
          const pk = s[p]![k]!;
          const qk = s[q]![k]!;
          s[p]![k] = c * pk - si * qk;
          s[q]![k] = si * pk + c * qk;
        }
        for (let k = 0; k < m; k++) {
          const kp = s[k]![p]!;
          const kq = s[k]![q]!;
          s[k]![p] = c * kp - si * kq;
          s[k]![q] = si * kp + c * kq;
        }
      }
    }
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < m; i++) {
    const v = s[i]![i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}
