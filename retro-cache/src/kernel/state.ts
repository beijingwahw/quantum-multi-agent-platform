/**
 * Kernel — exact complex algebra for two-qubit Bell-correlation audits.
 *
 * Structure follows the workspace convention (bqp-map src/genealogy/nosignal.ts):
 * complex matrices as separate real/imaginary parts, Stinespring dilation for
 * CPTP maps, every theorem number read off the matrix path and checked against
 * a closed form on a second path.
 */

export interface CMat {
  readonly dim: number;
  readonly re: number[][];
  readonly im: number[][];
}

export function cmatZero(d: number): CMat {
  return { dim: d, re: Array.from({ length: d }, () => new Array<number>(d).fill(0)), im: Array.from({ length: d }, () => new Array<number>(d).fill(0)) };
}

export function cmatAdd(a: CMat, b: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++)
    for (let j = 0; j < a.dim; j++) {
      out.re[i]![j] = a.re[i]![j]! + b.re[i]![j]!;
      out.im[i]![j] = a.im[i]![j]! + b.im[i]![j]!;
    }
  return out;
}

export function cmatScale(a: CMat, s: number): CMat {
  return { dim: a.dim, re: a.re.map((r) => r.map((x) => x * s)), im: a.im.map((r) => r.map((x) => x * s)) };
}

export function cmatMul(a: CMat, b: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++)
    for (let j = 0; j < a.dim; j++) {
      let re = 0;
      let im = 0;
      for (let k = 0; k < a.dim; k++) {
        // (ar + i ai)(br + i bi) with standard complex multiplication
        const ar = a.re[i]![k]!;
        const ai = a.im[i]![k]!;
        const br = b.re[k]![j]!;
        const bi = b.im[k]![j]!;
        re += ar * br - ai * bi;
        im += ar * bi + ai * br;
      }
      out.re[i]![j] = re;
      out.im[i]![j] = im;
    }
  return out;
}

export function trace(a: CMat): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.dim; i++) {
    re += a.re[i]![i]!;
    im += a.im[i]![i]!;
  }
  return { re, im };
}

/** 2x2 kron of complex matrices (used to build 4x4 two-qubit operators) */
export function kron2(a: CMat, b: CMat): CMat {
  const out = cmatZero(a.dim * b.dim);
  for (let i = 0; i < a.dim; i++)
    for (let j = 0; j < a.dim; j++)
      for (let u = 0; u < b.dim; u++)
        for (let v = 0; v < b.dim; v++) {
          const ar = a.re[i]![j]!;
          const ai = a.im[i]![j]!;
          const br = b.re[u]![v]!;
          const bi = b.im[u]![v]!;
          out.re[i * b.dim + u]![j * b.dim + v] = ar * br - ai * bi;
          out.im[i * b.dim + u]![j * b.dim + v] = ar * bi + ai * br;
        }
  return out;
}

export const I2: CMat = (() => {
  const m = cmatZero(2);
  m.re[0]![0] = 1;
  m.re[1]![1] = 1;
  return m;
})();

/** Pauli matrices */
export const PX: CMat = (() => {
  const m = cmatZero(2);
  m.re[0]![1] = 1;
  m.re[1]![0] = 1;
  return m;
})();
export const PY: CMat = (() => {
  const m = cmatZero(2);
  m.im[0]![1] = -1;
  m.im[1]![0] = 1;
  return m;
})();
export const PZ: CMat = (() => {
  const m = cmatZero(2);
  m.re[0]![0] = 1;
  m.re[1]![1] = -1;
  return m;
})();
export const PAULI = [PX, PY, PZ] as const;

/** projector onto the +/-1 eigenoutcome of sigma . a */
export function projector(axis: readonly number[], sign: 1 | -1): CMat {
  // guard at the boundary: a short axis would otherwise index past its end and
  // silently seed NaN into the matrix (the old `as number` hid exactly that)
  if (axis.length !== 3) throw new Error(`projector: axis must be a 3-vector, got length ${axis.length}`);
  const m = cmatZero(2);
  for (let i = 0; i < 2; i++) m.re[i]![i]! += 0.5;
  for (let p = 0; p < 3; p++) {
    const pauli = PAULI[p]!;
    const s = 0.5 * sign * axis[p]!;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        m.re[i]![j]! += s * pauli.re[i]![j]!;
        m.im[i]![j]! += s * pauli.im[i]![j]!;
      }
  }
  return m;
}

/** Werner-pair state: rho_p = (I(x)I - p sum_i sigma_i (x) sigma_i)/4 — the
 *  singlet at p = 1 (correlations -p a.b), fully depolarized at p = 0. */
export function wernerPair(p: number): CMat {
  const out = cmatZero(4);
  for (let i = 0; i < 4; i++) out.re[i]![i] = 0.25;
  for (const s of PAULI) {
    const kron = kron2(s, s);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        out.re[i]![j]! -= 0.25 * p * kron.re[i]![j]!;
        out.im[i]![j]! -= 0.25 * p * kron.im[i]![j]!;
      }
  }
  return out;
}

/** |Phi_theta> = (|00> + e^{i theta}|11>)/sqrt(2) — the complex-anchor family.
 *  rho_03 = psi_0 conj(psi_3) = e^{-i theta}/2 (imag part -sin(theta)/2: the
 *  conj is what an earlier draft dropped, flipping the state to |Phi_-theta>
 *  and the sin(theta) correlation terms with it — the referee caught it). */
export function phasePair(theta: number): CMat {
  const c11r = Math.cos(theta) * Math.SQRT1_2;
  const c11i = Math.sin(theta) * Math.SQRT1_2;
  const out = cmatZero(4);
  out.re[0]![0] = 0.5;
  out.re[3]![3] = 0.5;
  out.re[0]![3] = c11r * Math.SQRT1_2;
  out.im[0]![3] = -(c11i * Math.SQRT1_2);
  out.re[3]![0] = out.re[0]![3]!;
  out.im[3]![0] = -out.im[0]![3];
  return out;
}

/** a joint outcome table P(x, y) — 2x2 by construction (binary outcomes),
 *  indexed [x][y] with x, y in {0, 1}. Typed as a tuple so every element
 *  access is exact, with no undefined in the type. */
export type JointTable = [[number, number], [number, number]];

/** joint outcome table p(x, y) for projective measurements along a (A) and b (B) */
export function jointTable(rho: CMat, a: readonly number[], b: readonly number[]): JointTable {
  const out: JointTable = [
    [0, 0],
    [0, 0],
  ];
  const signs: Array<[1 | -1, 1 | -1]> = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const [xs, ys] of signs) {
    const m = cmatMul(cmatMul(kron2(projector(a, xs), projector(b, ys)), rho), kron2(projector(a, xs), projector(b, ys)));
    const tr = trace(m);
    out[xs === 1 ? 0 : 1][ys === 1 ? 0 : 1] = tr.re;
  }
  return out;
}

/** correlation E(a,b) = sum xy p(x,y) from the table */
export function correlationFromTable(t: JointTable): number {
  return t[0][0] - t[0][1] - t[1][0] + t[1][1];
}

/** closed-form Werner correlation: -p (a . b) */
export function wernerCorrelation(p: number, a: readonly number[], b: readonly number[]): number {
  // guard at the boundary: a short axis would index past its end (undefined
  // operands) and silently turn the closed form into NaN
  if (a.length !== 3 || b.length !== 3) throw new Error(`wernerCorrelation: axes must be 3-vectors (got ${a.length}, ${b.length})`);
  return -p * (a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!);
}

/** CHSH value at the standard axes */
export function chshStandard(rho: CMat): number {
  const a0 = [1, 0, 0];
  const a1 = [0, 1, 0];
  const b0 = [Math.SQRT1_2, Math.SQRT1_2, 0];
  const b1 = [Math.SQRT1_2, -Math.SQRT1_2, 0];
  const e = (a: readonly number[], b: readonly number[]): number => correlationFromTable(jointTable(rho, a, b));
  return e(a0, b0) + e(a0, b1) + e(a1, b0) - e(a1, b1);
}

/** partial trace: B half traced out (keep A) */
export function reduceA(rho: CMat): CMat {
  if (rho.dim !== 4) throw new Error(`reduceA: expected a 4x4 two-qubit matrix, got dim ${rho.dim}`);
  const out = cmatZero(2);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      out.re[i]![j] = rho.re[i * 2]![j * 2]! + rho.re[i * 2 + 1]![j * 2 + 1]!;
      out.im[i]![j] = rho.im[i * 2]![j * 2]! + rho.im[i * 2 + 1]![j * 2 + 1]!;
    }
  return out;
}

/** partial trace: A half traced out (keep B) */
export function reduceB(rho: CMat): CMat {
  if (rho.dim !== 4) throw new Error(`reduceB: expected a 4x4 two-qubit matrix, got dim ${rho.dim}`);
  const out = cmatZero(2);
  out.re[0]![0] = rho.re[0]![0]! + rho.re[2]![2]!;
  out.re[0]![1] = rho.re[0]![1]! + rho.re[2]![3]!;
  out.re[1]![0] = rho.re[1]![0]! + rho.re[3]![2]!;
  out.re[1]![1] = rho.re[1]![1]! + rho.re[3]![3]!;
  out.im[0]![0] = rho.im[0]![0]! + rho.im[2]![2]!;
  out.im[0]![1] = rho.im[0]![1]! + rho.im[2]![3]!;
  out.im[1]![0] = rho.im[1]![0]! + rho.im[3]![2]!;
  out.im[1]![1] = rho.im[1]![1]! + rho.im[3]![3]!;
  return out;
}

/** Hilbert-Schmidt distance between two matrices */
export function hsDistance(a: CMat, b: CMat): number {
  // mismatched dims would read past b's rows and silently yield NaN
  if (a.dim !== b.dim) throw new Error(`hsDistance: dimension mismatch (${a.dim} vs ${b.dim})`);
  let s = 0;
  for (let i = 0; i < a.dim; i++)
    for (let j = 0; j < a.dim; j++) {
      const dr = a.re[i]![j]! - b.re[i]![j]!;
      const di = a.im[i]![j]! - b.im[i]![j]!;
      s += dr * dr + di * di;
    }
  return Math.sqrt(s);
}

/** uniform random 3-vector on the sphere from a seeded xorshift */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
  axis(): number[] {
    const z = 2 * this.next() - 1;
    const phi = 2 * Math.PI * this.next();
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return [r * Math.cos(phi), r * Math.sin(phi), z];
  }
}

// Information measures on finite tables (base-2 logs)

export function entropyBits(probs: readonly number[]): number {
  let h = 0;
  for (const p of probs) if (p > 0) h -= p * Math.log2(p);
  return h;
}

export function mutualInfoBits(table: ReadonlyArray<readonly number[]>): number {
  // guard at the boundary: an empty table would crash on table[0].length
  if (table.length === 0) throw new Error("mutualInfoBits: table must have at least one row");
  const n = table.length;
  const m = table[0]!.length;
  const total = table.flat().reduce((a, b) => a + b, 0);
  const row = new Array<number>(n).fill(0);
  const col = new Array<number>(m).fill(0);
  for (let i = 0; i < n; i++) {
    const rowI = table[i]!;
    // ragged rows would index past their end and silently yield NaN entropy
    if (rowI.length !== m) throw new Error(`mutualInfoBits: ragged table (row ${i} has length ${rowI.length}, expected ${m})`);
    for (let j = 0; j < m; j++) {
      const v = rowI[j]!;
      row[i]! += v;
      col[j]! += v;
    }
  }
  const hx = entropyBits(row.map((x) => x / total));
  const hy = entropyBits(col.map((x) => x / total));
  const hxy = entropyBits(table.flat().map((x) => x / total));
  return hx + hy - hxy;
}

/** total variation distance between two finite distributions */
export function tvDistance(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs((a[i] as number) - (b[i] as number));
  return s / 2;
}
