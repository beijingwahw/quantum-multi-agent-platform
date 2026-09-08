/**
 * The bounded loop face — choose inside a k-iteration loop.
 *
 * The loop body is a program; k iterations are its k-fold self-composition
 * (each iteration prepends its own fresh controls, register discipline
 * unchanged). Two laws probed, both against the flat semantics:
 *
 *   L-TELE  the CHARGE LEDGER TELESCOPES — the per-iteration membership
 *           deltas of an engineered body sit at the rounding floor, the
 *           total drift over k iterations sits at the SAME floor (not k
 *           floors: the ledger does not accumulate rounding), and the float
 *           telescoping sum matches final-minus-initial exactly. The bounded
 *           fixpoint of the charge is a constant of the iterated motion.
 *
 *   L-TOLL  the LOOP TOLL COMPOUNDS — certifying "the world we want" after k
 *           coherent iterations of one choose costs its branch weight to the
 *           k-th power: E[attempts] = 1/w^k = (1/w)^k. The certification toll
 *           of a loop is exponential in its bound — the epoch-3 identity,
 *           compounded by iteration.
 *
 * Random bodies decay (DATA, no theorem) — the loop does not forgive a body
 * that fails to preserve the world.
 */
import { type CMat } from "../core/cmat.js";
import { ChoiceLangError } from "../core/errors.js";
import { membershipExpectation, runOnRegister, type Program } from "./lang.js";

export interface LoopTrajectory {
  /** membership after each iteration: m_0 = the input's charge, m_k final */
  readonly membership: readonly number[];
  /** per-iteration charge deltas: m_i - m_{i-1} for i = 1..k */
  readonly deltas: readonly number[];
  /** |sum(deltas) - (m_k - m_0)| — the telescoping identity's float residual */
  readonly telescopeResidual: number;
}

/**
 * Run the loop body k times, recording the charge ledger trajectory. Each
 * iteration's controls prepend in front of the register-so-far (the layered
 * runner in compose.ts — the flat program and the iterated register are the
 * same fold), so the state after i iterations lives on (2^{i·bodyWidth}·d);
 * the data digit stays at idx % d and membershipExpectation reads it
 * unchanged.
 */
export function loopTrajectory(body: Program, rho: CMat, k: number, piW: CMat): LoopTrajectory {
  if (k < 1) throw new ChoiceLangError("LOOP_BOUND", `loopTrajectory: k must be >= 1, got ${k}`);
  const d = rho.rows;
  const membership: number[] = [membershipExpectation(rho, piW, d)];
  let reg = rho;
  let controls = 0;
  for (let i = 0; i < k; i++) {
    const next = runOnRegister(body, reg, controls);
    reg = next.reg;
    controls = next.controls;
    membership.push(membershipExpectation(reg, piW, d));
  }
  const deltas = membership.slice(1).map((m, i) => m - membership[i]!);
  const residual = Math.abs(deltas.reduce((a, b) => a + b, 0) - (membership[k]! - membership[0]!));
  return { membership, deltas, telescopeResidual: residual };
}

/** The bounded loop as a flat program: the body's k-fold self-composition. */
export function iteratedProgram(body: Program, k: number): Program {
  if (k < 1) throw new ChoiceLangError("LOOP_BOUND", `iteratedProgram: k must be >= 1, got ${k}`);
  const steps = [];
  for (let i = 0; i < k; i++) steps.push(...body);
  return steps;
}
