/**
 * Gate library and n-qubit embedding. A placed gate is a full 2^n x 2^n
 * unitary together with the qubits it touches (for reporting only — the
 * compiler consumes the embedded matrix directly).
 */
import { type CMat, cmatKron, cmatUnitaryDev, requireWellFormed, VacuumError } from "../core/cmat.js";

export interface Gate2 {
  readonly name: string;
  readonly m: CMat; // 2x2
}

const g = (name: string, re: number[][], im?: number[][]): Gate2 => ({
  name,
  m: { dim: 2, re, im: im ?? [[0, 0], [0, 0]] },
});

const invSqrt2 = 1 / Math.sqrt(2);

export const GATES: readonly Gate2[] = [
  g("I", [
    [1, 0],
    [0, 1],
  ]),
  g("X", [
    [0, 1],
    [1, 0],
  ]),
  g("Y", [
    [0, 0],
    [0, 0],
  ], [
    [0, -1],
    [1, 0],
  ]),
  g("Z", [
    [1, 0],
    [0, -1],
  ]),
  g("H", [
    [invSqrt2, invSqrt2],
    [invSqrt2, -invSqrt2],
  ]),
  g("S", [
    [1, 0],
    [0, 0],
  ], [
    [0, 0],
    [0, 1],
  ]),
  g("T", [
    [1, 0],
    [0, invSqrt2],
  ], [
    [0, 0],
    [0, invSqrt2],
  ]),
];

/** Controlled-NOT as a 4x4 on (control, target) with control the first factor. */
export function cnot4(): CMat {
  return {
    dim: 4,
    re: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 1],
      [0, 0, 1, 0],
    ],
    im: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  };
}

/** Embed a list of per-qubit 2x2 factors into the full 2^n space.
 * factors[0] acts on qubit 0 = the most significant tensor factor. */
export function embedSingle(factors: readonly CMat[], nQubits: number): CMat {
  if (factors.length !== nQubits) {
    throw new VacuumError("gate/factor-count-mismatch", `embedSingle: ${factors.length} factors for ${nQubits} qubits`);
  }
  for (let k = 0; k < factors.length; k++) {
    const f = factors[k] as CMat;
    requireWellFormed(f, "embedSingle");
    if (f.dim !== 2) {
      throw new VacuumError("gate/factor-not-qubit", `embedSingle: factor ${k} has dim ${f.dim}, expected 2 (a single-qubit gate)`);
    }
  }
  let out = factors[0] as CMat;
  for (let k = 1; k < nQubits; k++) out = cmatKron(out, factors[k] as CMat);
  return out;
}

/** Two-qubit gate on ADJACENT qubits (a, a+1): the only two-qubit placement
 * this prototype needs; keeps the embedding a clean kron chain.
 * v0.3.0 conviction: a placement outside [0, nQubits-2] used to fall through
 * the loop without ever matching (a silent gate drop — the chain came back
 * pure identities with the right dimension); it is now named and rejected. */
export function embedTwoAdjacent(gate4: CMat, a: number, nQubits: number): CMat {
  requireWellFormed(gate4, "embedTwoAdjacent");
  if (gate4.dim !== 4) {
    throw new VacuumError("gate/gate-not-two-qubit", `embedTwoAdjacent: gate has dim ${gate4.dim}, expected 4 (a two-qubit gate)`);
  }
  if (!Number.isInteger(a) || a < 0 || a > nQubits - 2) {
    throw new VacuumError("gate/placement-out-of-range", `embedTwoAdjacent: placement ${a} outside [0, ${nQubits - 2}] on ${nQubits} qubits (the pair (a, a+1) must fit the register)`);
  }
  const eye = GATES[0]!.m;
  let out: CMat | null = null;
  for (let q = 0; q < nQubits; q++) {
    if (q === a) {
      out = out === null ? gate4 : cmatKron(out, gate4);
      q += 1;
    } else {
      out = out === null ? eye : cmatKron(out, eye);
    }
  }
  if (out?.dim !== 2 ** nQubits) {
    throw new VacuumError("gate/chain-dim-broken", `embedTwoAdjacent: bad chain dim ${out?.dim} for ${nQubits} qubits`);
  }
  return out;
}

/** All gates used by the generator, pre-checked for unitarity once. */
export function assertGateLibrary(): void {
  for (const gate of GATES) {
    const dev = cmatUnitaryDev(gate.m);
    if (dev > 1e-15) throw new VacuumError("gate/not-unitary", `gate ${gate.name} not unitary: ${dev}`);
  }
  const dev = cmatUnitaryDev(cnot4());
  if (dev > 1e-15) throw new VacuumError("gate/not-unitary", `CNOT not unitary: ${dev}`);
}
