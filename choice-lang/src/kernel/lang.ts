/**
 * The language — choice as a primitive, compiled to controlled branching.
 *
 * A program is a finite sequence of choose steps:
 *
 *   choose(theta_i, U0_i, U1_i): a FRESH control qubit is prepared in
 *   cos(th)|0> + sin(th)|1> and routes the data register through U0_i
 *   (control outcome 0) or U1_i (outcome 1) coherently. Controlled unitaries
 *   are the legal boundary: coherent control steers, never broadcasts
 *   (SEL04's classical-control wall is exactly this register split).
 *
 * Register discipline: controls accumulate OLDEST-FIRST in front of the data
 * register, (c_1, ..., c_k, data). Each step's operator is a pure Kronecker
 * expression — |0><0| (x) I_{2^{k-1}} (x) U0 + |1><1| (x) I_{2^{k-1}} (x) U1 —
 * because kron is associative, the accumulated controls act as one grouped
 * factor and no per-step reshuffling ever happens.
 *
 * The DESIRED WORLD is a marked subspace W of data. A program is ENGINEERED
 * for W when every branch unitary is block-diagonal in the W (+) W-perp
 * basis — then data-in-W stays in W exactly, for any length: stability as
 * compilation. Random programs do not preserve W: stability as physics is a
 * different question and stays OPEN.
 */
import { type CMat, identity, kron, mAdd, mat, mDagger, mMul } from "../core/cmat.js";

export interface ChooseStep {
  /** control preparation angle: cos(th)|0> + sin(th)|1> */
  readonly theta: number;
  /** branch unitaries on the data register (d x d) */
  readonly u0: CMat;
  readonly u1: CMat;
}

export type Program = readonly ChooseStep[];

function basisProjector(d: number, i: number): CMat {
  const m = mat(d, d);
  m.re[i * d + i] = 1;
  return m;
}

/** The branch-routing operator of one step on (fresh control, register-so-far). */
export function stepOperator(step: ChooseStep, controlsSoFar: number): CMat {
  const iCtrl = identity(2 ** controlsSoFar); // 1x1 when no controls yet
  return mAdd(
    kron(basisProjector(2, 0), kron(iCtrl, step.u0)),
    kron(basisProjector(2, 1), kron(iCtrl, step.u1)),
  );
}

/** The control state cos(th)|0> + sin(th)|1> as a density matrix. */
export function controlState(theta: number): CMat {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const m = mat(2, 2);
  m.re[0] = c * c;
  m.re[1] = c * s;
  m.re[2] = c * s;
  m.re[3] = s * s;
  return m;
}

/** Run a program: data density matrix -> (controls..., data) density matrix. */
export function runProgram(p: Program, rhoData: CMat): CMat {
  let reg = rhoData;
  let controls = 0;
  for (const step of p) {
    const op = stepOperator(step, controls);
    const withControl = kron(controlState(step.theta), reg);
    reg = mMul(mMul(op, withControl), mDagger(op));
    controls += 1;
  }
  return reg;
}

/** The DENOTATION: the plain unitary product a control pattern compiles to. */
export function branchProduct(p: Program, pattern: ReadonlyArray<0 | 1>): CMat {
  const first = p[0];
  if (!first) throw new Error('branchProduct: empty program has no denotation');
  const d = first.u0.rows;
  let u = identity(d);
  for (const [i, step] of p.entries()) {
    u = mMul(pattern[i] === 1 ? step.u1 : step.u0, u);
  }
  return u;
}

function digitsOf(idx: number, dims: readonly number[]): number[] {
  const out: number[] = [];
  let r = idx;
  for (let i = 0; i < dims.length; i++) {
    let stride = 1;
    for (let j = i + 1; j < dims.length; j++) stride *= dims[j]!;
    out.push(Math.floor(r / stride) % dims[i]!);
    r %= stride;
  }
  return out;
}

/**
 * Measure the controls in their own basis, keep one outcome pattern:
 * returns the pattern probability and the conditional data state.
 */
export function conditionOnPattern(
  rho: CMat,
  nControls: number,
  pattern: ReadonlyArray<0 | 1>,
  d: number,
): { p: number; conditional: CMat } {
  if (pattern.length < nControls) {
    throw new Error(`conditionOnPattern: pattern needs ${nControls} bits, got ${pattern.length}`);
  }
  const dims = [...Array<number>(nControls).fill(2), d];
  const dim = rho.rows;
  const out = mat(d, d);
  let p = 0;
  for (let row = 0; row < dim; row++) {
    const rd = digitsOf(row, dims);
    if (!rd.slice(0, nControls).every((g, i) => g === pattern[i]!)) continue;
    for (let col = 0; col < dim; col++) {
      const cd = digitsOf(col, dims);
      if (!cd.slice(0, nControls).every((g, i) => g === pattern[i]!)) continue;
      const dr = rd[nControls]! * d + cd[nControls]!; // dims has nControls + 1 digits
      out.re[dr] = out.re[dr]! + rho.re[row * dim + col]!;
      out.im[dr] = out.im[dr]! + rho.im[row * dim + col]!;
    }
    p += rho.re[row * dim + row]!;
  }
  if (p > 0) {
    for (let k = 0; k < out.re.length; k++) {
      out.re[k] = out.re[k]! / p;
      out.im[k] = out.im[k]! / p;
    }
  }
  return { p, conditional: out };
}

/** Membership expectation of the marked world: Tr[(I_controls (x) Pi_W) rho]
 * (the data digit is idx % d regardless of how many controls sit in front). */
export function membershipExpectation(rho: CMat, piW: CMat, d: number): number {
  const diag: number[] = [];
  for (let i = 0; i < d; i++) diag.push(piW.re[i * d + i]!);
  let s = 0;
  for (let idx = 0; idx < rho.rows; idx++) {
    const dataDigit = idx % d;
    s += diag[dataDigit]! * rho.re[idx * rho.rows + idx]!;
  }
  return s;
}
