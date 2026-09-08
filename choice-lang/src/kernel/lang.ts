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
 * Register discipline: each step PREPENDS its fresh control, so the controls
 * accumulate NEWEST-FIRST — the register reads (c_k, ..., c_1, data), the
 * OLDEST control sitting directly in front of the data register. Each step's
 * operator is a pure Kronecker expression — |0><0| (x) I_{2^{k-1}} (x) U0 +
 * |1><1| (x) I_{2^{k-1}} (x) U1 — because kron is associative, the
 * accumulated controls act as one grouped factor and no per-step reshuffling
 * ever happens. Patterns are named in REGISTER order; registerPattern (in
 * compose.ts) reverses a step-order pattern per program part.
 *
 * The DESIRED WORLD is a marked subspace W of data. A program is ENGINEERED
 * for W when every branch unitary is block-diagonal in the W (+) W-perp
 * basis — then data-in-W stays in W exactly, for any length: stability as
 * compilation. Random programs do not preserve W: stability as physics is a
 * different question and stays OPEN.
 */
import { type CMat, identity, kron, mAdd, mat, mDagger, mMul } from "../core/cmat.js";
import { ChoiceLangError } from "../core/errors.js";

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

/**
 * THE execution fold (single-sourced, wave 4): run a program on a register
 * that ALREADY carries controls (from an earlier program, a loop iteration,
 * or another player) — every step prepends its fresh control and applies its
 * branch unitary to the data digits only. The flat runner (runProgram), the
 * layered loop runner (iterate.ts) and the two-player census (game.ts) are
 * all this one fold; before wave 4 the flat and layered bodies were
 * line-identical twins, and the bit-identity anchor test pins the unification.
 * Returns the register and the new control count.
 */
export function runOnRegister(
  p: Program,
  reg: CMat,
  controlsSoFar: number,
): { reg: CMat; controls: number } {
  if (!Number.isInteger(controlsSoFar) || controlsSoFar < 0) {
    throw new ChoiceLangError(
      "REGISTER_ARITY",
      `runOnRegister: controlsSoFar must be a non-negative integer, got ${controlsSoFar}`,
    );
  }
  if (reg.rows !== reg.cols) {
    throw new ChoiceLangError("DATA_SHAPE", `runOnRegister: the register must be square, got ${reg.rows}x${reg.cols}`);
  }
  let out = reg;
  let controls = controlsSoFar;
  for (const [i, step] of p.entries()) {
    if (!Number.isFinite(step.theta)) {
      throw new ChoiceLangError(
        "STEP_THETA",
        `runOnRegister: step ${i + 1} has a non-finite control angle (${step.theta}) — cos/sin of it would route NaN through every later branch`,
      );
    }
    if (step.u0.rows !== step.u0.cols || step.u1.rows !== step.u1.cols) {
      throw new ChoiceLangError(
        "BRANCH_SHAPE",
        `runOnRegister: step ${i + 1} branches must be square, got u0 ${step.u0.rows}x${step.u0.cols}, u1 ${step.u1.rows}x${step.u1.cols}`,
      );
    }
    // the register-so-far is (prior controls, data) of dim 2^controls * d:
    // the branch unitaries carry the DATA dimension d, never the joint dim
    const dataDim = out.rows / 2 ** controls;
    if (!Number.isInteger(dataDim) || step.u0.rows !== dataDim || step.u1.rows !== dataDim) {
      throw new ChoiceLangError(
        "BRANCH_SHAPE",
        `runOnRegister: step ${i + 1} branches are ${step.u0.rows}x${step.u0.rows}/${step.u1.rows}x${step.u1.rows} but the register-so-far is ${out.rows}-dimensional over ${controls} prior controls, so the branches must carry the data dimension ${out.rows / 2 ** controls} — the step operator kron(control, I_{2^controls}, U_i) demands it`,
      );
    }
    const op = stepOperator(step, controls);
    const withControl = kron(controlState(step.theta), out);
    out = mMul(mMul(op, withControl), mDagger(op));
    controls += 1;
  }
  return { reg: out, controls };
}

/** Run a program on bare data: data density matrix -> (controls..., data)
 * density matrix, reading newest-first. Delegates to the one fold. */
export function runProgram(p: Program, rhoData: CMat): CMat {
  return runOnRegister(p, rhoData, 0).reg;
}

/** The DENOTATION: the plain unitary product a control pattern compiles to. */
export function branchProduct(p: Program, pattern: ReadonlyArray<0 | 1>): CMat {
  const first = p[0];
  if (!first) throw new ChoiceLangError("EMPTY_PROGRAM", "branchProduct: empty program has no denotation");
  if (pattern.length !== p.length) {
    throw new ChoiceLangError(
      "PATTERN_ARITY",
      `branchProduct: a ${p.length}-step program needs exactly ${p.length} pattern bits, got ${pattern.length} — an out-of-range bit must be rejected, not silently routed through u0`,
    );
  }
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
  if (pattern.length !== nControls) {
    throw new ChoiceLangError(
      "PATTERN_ARITY",
      `conditionOnPattern: pattern needs exactly ${nControls} bits, got ${pattern.length} — extra bits must be rejected, not silently ignored`,
    );
  }
  if (!Number.isInteger(d) || d < 1) {
    throw new ChoiceLangError("DATA_SHAPE", `conditionOnPattern: the data dimension must be a positive integer, got ${d}`);
  }
  if (rho.rows !== rho.cols) {
    throw new ChoiceLangError("DATA_SHAPE", `conditionOnPattern: rho must be square, got ${rho.rows}x${rho.cols}`);
  }
  if (rho.rows !== d * 2 ** nControls) {
    throw new ChoiceLangError(
      "REGISTER_ARITY",
      `conditionOnPattern: a ${nControls}-control register over ${d}-dim data is ${d * 2 ** nControls}-dimensional, but rho is ${rho.rows}x${rho.rows}`,
    );
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
  if (p <= 0) {
    throw new ChoiceLangError(
      "ZERO_PROBABILITY",
      "conditionOnPattern: the pattern has probability 0 — the conditional state is undefined, refusing to return silent zeros",
    );
  }
  for (let k = 0; k < out.re.length; k++) {
    out.re[k] = out.re[k]! / p;
    out.im[k] = out.im[k]! / p;
  }
  return { p, conditional: out };
}

/** Membership expectation of the marked world: Tr[(I_controls (x) Pi_W) rho]
 * (the data digit is idx % d regardless of how many controls sit in front). */
export function membershipExpectation(rho: CMat, piW: CMat, d: number): number {
  if (!Number.isInteger(d) || d < 1) {
    throw new ChoiceLangError("DATA_SHAPE", `membershipExpectation: the data dimension must be a positive integer, got ${d}`);
  }
  if (piW.rows !== d || piW.cols !== d) {
    throw new ChoiceLangError(
      "PROJECTOR_SHAPE",
      `membershipExpectation: the world projector must be ${d}x${d}, got ${piW.rows}x${piW.cols} — a short diagonal would read undefined and return a silent NaN`,
    );
  }
  if (rho.rows !== rho.cols || rho.rows % d !== 0) {
    throw new ChoiceLangError(
      "DATA_SHAPE",
      `membershipExpectation: rho must be square with dimension a multiple of d=${d}, got ${rho.rows}x${rho.cols}`,
    );
  }
  const diag: number[] = [];
  for (let i = 0; i < d; i++) diag.push(piW.re[i * d + i]!);
  let s = 0;
  for (let idx = 0; idx < rho.rows; idx++) {
    const dataDigit = idx % d;
    s += diag[dataDigit]! * rho.re[idx * rho.rows + idx]!;
  }
  return s;
}
