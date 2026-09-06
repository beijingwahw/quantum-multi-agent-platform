/**
 * Circuit representation: a list of placed gates, each already embedded in
 * the full 2^n space (the compiler consumes embedded unitaries), plus the
 * bookkeeping needed for reports and for the input/output checks.
 */
import { type CMat, type CVec, cmatApply, cmatEye, cmatMul, cmatUnitaryDev, cvecZero } from "../core/cmat.js";
import { GATES, cnot4, embedSingle, embedTwoAdjacent } from "./gates.js";
import type { Rng } from "./rng.js";

export interface PlacedGate {
  readonly name: string;
  readonly matrix: CMat; // full 2^n x 2^n unitary
}

export interface Circuit {
  readonly nQubits: number;
  readonly steps: readonly PlacedGate[]; // steps[t-1] is applied going clock t-1 -> t
}

export interface CompiledProgram {
  readonly circuit: Circuit;
  /** qubits required to be |0> at clock 0 (the input convention) */
  readonly checkedQubits: readonly number[];
  /** per-qubit target pattern at clock T defining the accept projector (qubit -> bit) */
  readonly acceptPattern: ReadonlyMap<number, 0 | 1>;
}

export function unitaryDeviation(c: Circuit): number {
  let d = 0;
  for (const s of c.steps) d = Math.max(d, cmatUnitaryDev(s.matrix));
  return d;
}

/** U_t ... U_1 as a single 2^n matrix (for conditional-readout targets). */
export function circuitUnitary(c: Circuit): CMat {
  let u = cmatEye(2 ** c.nQubits);
  for (const s of c.steps) u = cmatMul(s.matrix, u);
  return u;
}

/** Apply U_t ... U_1 to a data-space state. */
export function runCircuit(c: Circuit, input: CVec): CVec {
  let psi = input;
  for (const s of c.steps) psi = cmatApply(s.matrix, psi);
  return psi;
}

export function dataBasisState(nQubits: number, pattern: readonly number[]): CVec {
  const dim = 2 ** nQubits;
  if (pattern.length !== nQubits) throw new Error("dataBasisState: pattern length mismatch");
  let idx = 0;
  for (let q = 0; q < nQubits; q++) {
    if (pattern[q] === 1) idx += 2 ** (nQubits - 1 - q);
  }
  const v = cvecZero(dim);
  v.re[idx] = 1;
  return v;
}

/** Random circuit over the gate menu; every step is unitary-verified. */
export function randomCircuit(nQubits: number, depth: number, rng: Rng): Circuit {
  const steps: PlacedGate[] = [];
  for (let t = 0; t < depth; t++) {
    if (nQubits >= 2 && rng.next() < 0.3) {
      const a = rng.int(nQubits - 1);
      steps.push({ name: `CNOT@${a}`, matrix: embedTwoAdjacent(cnot4(), a, nQubits) });
    } else {
      const factors: CMat[] = [];
      const names: string[] = [];
      for (let q = 0; q < nQubits; q++) {
        const gate = GATES[rng.int(GATES.length)] as { name: string; m: CMat };
        factors.push(gate.m);
        names.push(gate.name);
      }
      steps.push({ name: names.join(""), matrix: embedSingle(factors, nQubits) });
    }
  }
  const c: Circuit = { nQubits, steps };
  const dev = unitaryDeviation(c);
  if (dev > 1e-13) throw new Error(`randomCircuit: unitarity dev ${dev}`);
  return c;
}

/** A program whose valid inputs are exactly the checked qubits in |0>. */
export function program(
  circuit: Circuit,
  checkedQubits: readonly number[],
  acceptPattern: ReadonlyMap<number, 0 | 1>,
): CompiledProgram {
  for (const q of checkedQubits) {
    if (q < 0 || q >= circuit.nQubits) throw new Error("program: checked qubit out of range");
  }
  for (const q of acceptPattern.keys()) {
    if (q < 0 || q >= circuit.nQubits) throw new Error("program: accept qubit out of range");
  }
  return { circuit, checkedQubits, acceptPattern };
}

/** Deterministic demo program with a closed-form answer: X on q0 then CNOT
 * q0->q1, so |00> -> |11> and the accept projector on q1 = |1> is satisfied
 * by the unique valid input. */
export function demoProgram(): CompiledProgram {
  const x = GATES[1]!.m;
  const i2 = GATES[0]!.m;
  // step 1: X on qubit 0
  const s1 = embedSingle([x, i2], 2);
  // step 2: CNOT q0 -> q1
  const s2 = embedTwoAdjacent(cnot4(), 0, 2);
  const c: Circuit = { nQubits: 2, steps: [
    { name: "X@0", matrix: s1 },
    { name: "CNOT@0", matrix: s2 },
  ] };
  return program(c, [0, 1], new Map([[1, 1]]));
}
