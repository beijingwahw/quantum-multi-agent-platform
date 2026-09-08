/**
 * Minimal dense complex linear algebra — zero-dependency, deliberately tiny.
 * The choice-primitive toy runs on one control qubit plus one data qubit
 * (dimension four); nothing here needs to be fast, only exact enough to
 * witness at machine precision.
 */
export interface C {
  readonly re: number;
  readonly im: number;
}

export const c = (re: number, im = 0): C => ({ re, im });

const cadd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });

export const cmul = (a: C, b: C): C => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

export const cconj = (a: C): C => ({ re: a.re, im: -a.im });

const cscale = (s: number, a: C): C => ({ re: s * a.re, im: s * a.im });

export const cabs2 = (a: C): number => a.re * a.re + a.im * a.im;

export type Vec = readonly C[];
export type Mat = ReadonlyArray<readonly C[]>;

export function identity(n: number): Mat {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? c(1) : c(0))),
  );
}

export function apply(m: Mat, v: Vec): Vec {
  return m.map((row) => row.reduce((acc, x, j) => cadd(acc, cmul(x, v[j] as C)), c(0)));
}

export function matmul(a: Mat, b: Mat): Mat {
  return a.map((row) =>
    Array.from({ length: (b[0] as readonly C[]).length }, (_, j) =>
      row.reduce((acc, x, k) => cadd(acc, cmul(x, (b[k] as readonly C[])[j] as C)), c(0)),
    ),
  );
}

export function dagger(m: Mat): Mat {
  const n = m.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => cconj((m[j] as readonly C[])[i] as C)),
  );
}

/** Kron for the two-qubit toy only: control (a) ⊗ data (b). */
export function kron2(a: Mat, b: Mat): Mat {
  const dim = a.length * b.length;
  const out: C[][] = Array.from({ length: dim }, () => Array.from({ length: dim }, () => c(0)));
  for (let ac = 0; ac < a.length; ac++) {
    for (let ar = 0; ar < a.length; ar++) {
      for (let bc = 0; bc < b.length; bc++) {
        for (let br = 0; br < b.length; br++) {
          // out is dim×dim, filled above; both indices are bounded by the loop limits
          out[ac * b.length + bc]![ar * b.length + br] = cmul(
            (a[ac] as readonly C[])[ar] as C,
            (b[bc] as readonly C[])[br] as C,
          );
        }
      }
    }
  }
  return out;
}

export function inner(u: Vec, v: Vec): C {
  return u.reduce((acc, x, i) => cadd(acc, cmul(cconj(x), v[i] as C)), c(0));
}

export function outer(v: Vec): Mat {
  return v.map((x) => v.map((y) => cmul(x, cconj(y))));
}

export function normalize(v: Vec): Vec {
  const nrm = Math.sqrt(v.reduce((acc, x) => acc + cabs2(x), 0));
  return v.map((x) => cscale(1 / nrm, x));
}

/** ρ_control = Tr_data ρ (two qubits, index = control·dimData + data). */
export function traceData(rho: Mat, dimData: number): Mat {
  const dimControl = rho.length / dimData;
  return Array.from({ length: dimControl }, (_, i) =>
    Array.from({ length: dimControl }, (_, j) => {
      let acc = c(0);
      for (let k = 0; k < dimData; k++) {
        acc = cadd(acc, (rho[i * dimData + k] as readonly C[])[j * dimData + k] as C);
      }
      return acc;
    }),
  );
}

/** ρ_data = Tr_control ρ. */
export function traceControl(rho: Mat, dimData: number): Mat {
  return Array.from({ length: dimData }, (_, i) =>
    Array.from({ length: dimData }, (_, j) => {
      let acc = c(0);
      for (let k = 0; k < rho.length / dimData; k++) {
        acc = cadd(acc, (rho[k * dimData + i] as readonly C[])[k * dimData + j] as C);
      }
      return acc;
    }),
  );
}

/** Conditional data state given control outcome g: the (g,g) block, normalized
 * by its trace (the marginal probability of control = g). */
export function conditionalData(rho: Mat, dimData: number, g: number): Mat {
  const block = Array.from({ length: dimData }, (_, i) =>
    Array.from({ length: dimData }, (_, j) => (rho[g * dimData + i] as readonly C[])[g * dimData + j] as C),
  );
  let p = 0;
  for (let i = 0; i < dimData; i++) p += (block[i] as readonly C[])[i]?.re ?? 0;
  return block.map((row) => row.map((x) => cscale(1 / p, x)));
}

/** A seeded random unitary: Gaussian entries, then Gram-Schmidt columns. */
export function gramSchmidtUnitary(randGauss: () => number, n: number): Mat {
  const cols: C[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => c(randGauss(), randGauss())),
  );
  const ortho: C[][] = [];
  for (const col of cols) {
    let v = col;
    for (const u of ortho) {
      const overlap = inner(u, v);
      v = v.map((x, i) => cadd(x, cmul(cscale(-1, overlap), u[i] as C)));
    }
    const nrm = Math.sqrt(v.reduce((acc, x) => acc + cabs2(x), 0));
    ortho.push(v.map((x) => cscale(1 / nrm, x)));
  }
  // columns orthonormal -> unitary matrix (rows re-check by the caller's unitarity spot tests)
  return Array.from({ length: n }, (_, i) => ortho.map((u) => u[i] as C));
}
