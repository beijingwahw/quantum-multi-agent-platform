import { SchedError } from "./errors.js";

/**
 * Minimal dense complex-matrix kernel for the physics referee.
 *
 * Everything the referee needs to simulate the real 4-qubit (16×16) circuits
 * behind swapping / purification / decoherence: tensor products, matrix
 * products, daggers, projective measurement with postselection, and partial
 * traces. Deliberately independent of the analytic Bell-vector algebra in
 * src/physics — this file knows nothing about Werner states.
 */

/** Dense complex matrix, row-major, n×n. */
export interface CxMat {
  readonly n: number;
  readonly re: Float64Array;
  readonly im: Float64Array;
}

export function zeros(n: number): CxMat {
  return { n, re: new Float64Array(n * n), im: new Float64Array(n * n) };
}

export function eye(n: number): CxMat {
  const m = zeros(n);
  for (let i = 0; i < n; i++) m.re[i * n + i] = 1;
  return m;
}

export function fromReal(n: number, entries: readonly number[][]): CxMat {
  // boundary guard (numeric kernel: no per-iteration checks inside)
  if (entries.length !== n || entries.some((row) => row.length !== n))
    throw new SchedError(
      "KERNEL_SHAPE_MISMATCH",
      `fromReal: entries must be an n×n matrix (got ${entries.length}×${entries.length ? entries[0]!.length : 0} for n=${n})`
    );
  const m = zeros(n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) m.re[i * n + j] = entries[i]![j]!;
  return m;
}

export function kron(a: CxMat, b: CxMat): CxMat {
  const n = a.n * b.n;
  const out = zeros(n);
  for (let i = 0; i < a.n; i++)
    for (let j = 0; j < a.n; j++) {
      if (a.re[i * a.n + j] === 0 && a.im[i * a.n + j] === 0) continue;
      for (let k = 0; k < b.n; k++)
        for (let l = 0; l < b.n; l++) {
          const ro = (i * b.n + k) * n + (j * b.n + l);
          const ar = a.re[i * a.n + j]!;
          const ai = a.im[i * a.n + j]!;
          const br = b.re[k * b.n + l]!;
          const bi = b.im[k * b.n + l]!;
          out.re[ro] = out.re[ro]! + ar * br - ai * bi;
          out.im[ro] = out.im[ro]! + ar * bi + ai * br;
        }
    }
  return out;
}

export function mul(a: CxMat, b: CxMat): CxMat {
  if (a.n !== b.n) throw new SchedError("KERNEL_SIZE_MISMATCH", `mul: size mismatch (${a.n} vs ${b.n})`);
  const n = a.n;
  const out = zeros(n);
  for (let i = 0; i < n; i++)
    for (let k = 0; k < n; k++) {
      const ar = a.re[i * n + k]!;
      const ai = a.im[i * n + k]!;
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < n; j++) {
        const dst = i * n + j;
        const br = b.re[k * n + j]!;
        const bi = b.im[k * n + j]!;
        out.re[dst] = out.re[dst]! + ar * br - ai * bi;
        out.im[dst] = out.im[dst]! + ar * bi + ai * br;
      }
    }
  return out;
}

export function dagger(a: CxMat): CxMat {
  const n = a.n;
  const out = zeros(n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      out.re[j * n + i] = a.re[i * n + j]!;
      out.im[j * n + i] = -a.im[i * n + j]!;
    }
  return out;
}

/** Conjugation ρ → U ρ U†. */
export function conjugate(rho: CxMat, u: CxMat): CxMat {
  return mul(mul(u, rho), dagger(u));
}

export function trace(a: CxMat): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.n; i++) {
    re += a.re[i * a.n + i]!;
    im += a.im[i * a.n + i]!;
  }
  return { re, im };
}

export function scale(a: CxMat, c: number): CxMat {
  const out = zeros(a.n);
  for (let i = 0; i < a.n * a.n; i++) {
    out.re[i] = a.re[i]! * c;
    out.im[i] = a.im[i]! * c;
  }
  return out;
}

export function add(a: CxMat, b: CxMat): CxMat {
  const out = zeros(a.n);
  for (let i = 0; i < a.n * a.n; i++) {
    out.re[i] = a.re[i]! + b.re[i]!;
    out.im[i] = a.im[i]! + b.im[i]!;
  }
  return out;
}

/** Single-qubit gates (2×2). */
export const G_H = fromReal(2, [
  [Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
]);
export const G_X = fromReal(2, [
  [0, 1],
  [1, 0],
]);
export const G_Z = fromReal(2, [
  [1, 0],
  [0, -1],
]);
export const G_I = eye(2);

/** CNOT on two explicit qubits (control, target) inside a register of `nQ` qubits. */
export function cnot(nQ: number, control: number, target: number): CxMat {
  const dim = 1 << nQ;
  const out = zeros(dim);
  for (let b = 0; b < dim; b++) {
    const c = (b >> (nQ - 1 - control)) & 1;
    let b2 = b;
    if (c === 1) b2 = b ^ (1 << (nQ - 1 - target));
    out.re[b2 * dim + b] = 1;
  }
  return out;
}

/** Apply a 1-qubit gate `g` to qubit `q` of an nQ-qubit register. */
export function gate1(nQ: number, q: number, g: CxMat): CxMat {
  let u = eye(1);
  for (let k = 0; k < nQ; k++) u = kron(u, k === q ? g : G_I);
  return u;
}

/**
 * Projective measurement of qubit `q` in the computational basis with outcome
 * `bit`, applied to a density matrix: ρ → P ρ P (unnormalized; caller reads
 * off success probability as the trace before renormalizing).
 */
export function projectZ(rho: CxMat, q: number, bit: 0 | 1): CxMat {
  const n = rho.n;
  const nQ = Math.round(Math.log2(n));
  const out = zeros(n);
  for (let i = 0; i < n; i++) {
    if (((i >> (nQ - 1 - q)) & 1) !== bit) continue;
    for (let j = 0; j < n; j++) {
      if (((j >> (nQ - 1 - q)) & 1) !== bit) continue;
      out.re[i * n + j] = rho.re[i * n + j]!;
      out.im[i * n + j] = rho.im[i * n + j]!;
    }
  }
  return out;
}

/**
 * Partial trace over the listed qubits of an nQ-qubit density matrix.
 * `keep` lists qubit indices (0 = most significant) that survive.
 */
export function partialTrace(rho: CxMat, keep: readonly number[]): CxMat {
  const nQ = Math.round(Math.log2(rho.n));
  const kept = [...keep].sort((a, b) => a - b);
  const outN = 1 << kept.length;
  const out = zeros(outN);
  for (let oi = 0; oi < outN; oi++) {
    for (let oj = 0; oj < outN; oj++) {
      let accRe = 0;
      let accIm = 0;
      // enumerate full-register indices consistent with (oi, oj) on kept qubits
      for (let rest = 0; rest < 1 << (nQ - kept.length); rest++) {
        const i = spliceBits(oi, kept, rest, nQ);
        const j = spliceBits(oj, kept, rest, nQ);
        accRe += rho.re[i * rho.n + j]!;
        accIm += rho.im[i * rho.n + j]!;
      }
      out.re[oi * outN + oj] = accRe;
      out.im[oi * outN + oj] = accIm;
    }
  }
  return out;
}

function spliceBits(pattern: number, kept: readonly number[], rest: number, nQ: number): number {
  // interleave: kept qubits take bits from `pattern` (MSB-first order of kept),
  // the remaining qubits take bits from `rest` in ascending qubit order.
  let out = 0;
  let restBit = nQ - kept.length - 1;
  let keptBit = kept.length - 1;
  for (let q = 0; q < nQ; q++) {
    const isKept = kept.includes(q);
    const bit = isKept ? (pattern >> keptBit--) & 1 : (rest >> restBit--) & 1;
    out = (out << 1) | bit;
  }
  return out;
}

/** Expectation value ⟨v|ρ|v⟩ for a real vector v (imaginary part vanishes by Hermiticity). */
export function expectationReal(rho: CxMat, v: Float64Array): number {
  const n = rho.n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    if (v[i] === 0) continue;
    for (let j = 0; j < n; j++) {
      if (v[j] === 0) continue;
      acc += v[i]! * v[j]! * rho.re[i * n + j]!;
    }
  }
  return acc;
}

/** Maximum-magnitude off-diagonal entry (real part check for diagonality tests). */
export function maxOffDiagonal(a: CxMat): number {
  let m = 0;
  for (let i = 0; i < a.n; i++)
    for (let j = 0; j < a.n; j++) {
      if (i === j) continue;
      m = Math.max(m, Math.abs(a.re[i * a.n + j]!), Math.abs(a.im[i * a.n + j]!));
    }
  return m;
}
