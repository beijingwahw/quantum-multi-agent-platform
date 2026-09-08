/**
 * Minimal complex-matrix kernels for the process-matrix layer.
 * Matrices are small (the game lives on 4 qubits, dim 16), so clarity beats
 * speed everywhere. Complex numbers are held as separate re/im row-major
 * number[][] grids.
 *
 * v0.3.0 (quality wave): the unused collateral-lineage surplus (cmatAdd,
 * cmatScale, cmatKron4, cmatTraceProd, cmatTrace, hermiticityDeviation,
 * hermitianExtremeEig — zero references anywhere in the workspace) is
 * deleted; the surviving kernels are the ones this repo's faces execute.
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

export function cmatKron(a: CMat, b: CMat): CMat {
  const dim = a.dim * b.dim;
  const out = cmatZero(dim);
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const ar = a.re[i]![j]!;
      const ai = a.im[i]![j]!;
      if (ar === 0 && ai === 0) continue;
      for (let k = 0; k < b.dim; k++) {
        for (let l = 0; l < b.dim; l++) {
          const br = b.re[k]![l]!;
          const bi = b.im[k]![l]!;
          out.re[i * b.dim + k]![j * b.dim + l] = ar * br - ai * bi;
          out.im[i * b.dim + k]![j * b.dim + l] = ar * bi + ai * br;
        }
      }
    }
  }
  return out;
}

/** Matrix product a·b. */
export function cmatMul(a: CMat, b: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++) {
    for (let k = 0; k < a.dim; k++) {
      const ar = a.re[i]![k]!;
      const ai = a.im[i]![k]!;
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < b.dim; j++) {
        out.re[i]![j]! += ar * b.re[k]![j]! - ai * b.im[k]![j]!;
        out.im[i]![j]! += ar * b.im[k]![j]! + ai * b.re[k]![j]!;
      }
    }
  }
  return out;
}

/** Conjugate transpose. */
export function cmatDagger(a: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      out.re[i]![j] = a.re[j]![i]!;
      out.im[i]![j] = -a.im[j]![i]!;
    }
  }
  return out;
}
