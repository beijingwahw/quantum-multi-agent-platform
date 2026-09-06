/**
 * Gate library and n-qubit embedding. A placed gate is a full 2^n x 2^n
 * unitary together with the qubits it touches (for reporting only — the
 * compiler consumes the embedded matrix directly).
 */
import { type CMat, cmatKron, cmatUnitaryDev } from "../core/cmat.js";

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
  if (factors.length !== nQubits) throw new Error("embedSingle: factor count mismatch");
  let out = factors[0] as CMat;
  for (let k = 1; k < nQubits; k++) out = cmatKron(out, factors[k] as CMat);
  return out;
}

/** Two-qubit gate on ADJACENT qubits (a, a+1): the only two-qubit placement
 * this prototype needs; keeps the embedding a clean kron chain. */
export function embedTwoAdjacent(gate4: CMat, a: number, nQubits: number): CMat {
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
    throw new Error(`embedTwoAdjacent: bad chain dim ${out?.dim} for ${nQubits} qubits`);
  }
  return out;
}

/** All gates used by the generator, pre-checked for unitarity once. */
export function assertGateLibrary(): void {
  for (const gate of GATES) {
    const dev = cmatUnitaryDev(gate.m);
    if (dev > 1e-15) throw new Error(`gate ${gate.name} not unitary: ${dev}`);
  }
  const dev = cmatUnitaryDev(cnot4());
  if (dev > 1e-15) throw new Error(`CNOT not unitary: ${dev}`);
}
