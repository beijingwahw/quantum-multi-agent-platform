/**
 * THE COMPILER — board B3, the tick-to-gate compiler, integer-exact layer.
 *
 * A reversible circuit is a permutation of the computational basis; the
 * runner is the Feynman-clock propagation with the GATE SEQUENCE keyed on a
 * one-hot token (the construction vacuum-compiler certified spectrally —
 * here the token is advanced BY THE BEAT, board B2; the quantum composite
 * lives in clock.ts). Because every gate is a permutation, this layer's
 * checks are INTEGER-EXACT: deviation is 0, not 1e-15.
 *
 * Universal set shipped: NOT, CNOT, TOFFOLI (universality for reversible
 * computation: BEN73/FT82, cited) + FREDKIN (conservative logic, FT82 — its
 * Hamming-weight conservation is machine-checked on the full basis). The
 * demonstrated program is a 2x2-bit reversible multiplier at depth 11 on 13
 * wires; functional correctness is verified on all 16 input combinations.
 */
import { type CMat, mat } from "../core/cmat.js";

export type GateKind = "NOT" | "CNOT" | "TOFFOLI" | "FREDKIN";

export interface RevGate {
  readonly kind: GateKind;
  readonly wires: readonly number[]; // NOT:[t] CNOT:[c,t] TOFFOLI:[c1,c2,t] FREDKIN:[c,s1,s2]
}

export function applyGate(g: RevGate, x: number): number {
  switch (g.kind) {
    case "NOT":
      return x ^ (1 << g.wires[0]!);
    case "CNOT":
      return (x >> g.wires[0]!) & 1 ? x ^ (1 << g.wires[1]!) : x;
    case "TOFFOLI":
      return (x >> g.wires[0]!) & 1 && (x >> g.wires[1]!) & 1 ? x ^ (1 << g.wires[2]!) : x;
    case "FREDKIN": {
      if (!((x >> g.wires[0]!) & 1)) return x;
      const b1 = (x >> g.wires[1]!) & 1;
      const b2 = (x >> g.wires[2]!) & 1;
      if (b1 === b2) return x;
      return x ^ (1 << g.wires[1]!) ^ (1 << g.wires[2]!);
    }
  }
}

/** A permutation array as a CMat (U|x> = |perm[x]>). */
export function permToCMat(perm: ArrayLike<number>): CMat {
  const d = perm.length;
  const u = mat(d, d);
  for (let x = 0; x < d; x++) u.re[perm[x]! * d + x] = 1;
  return u;
}

/**
 * The runner on token (T+1 sites) x data (2^m): a CYCLIC self-resetting
 * machine — one beat advances the token and fires the gate it lands on;
 * the wrap beat applies V = (U_T ... U_1)+ and returns the token to 0
 * (every gate here is an involution, so V is the reverse-order replay).
 * The eternal beat thus computes the same program every cycle; HALT is a
 * reading at the cycle top, not a stop. (An absorbing halt is NOT unitary:
 * |T-1,x> and |T,U_T x> would collide — batch 36, caught by the bijection
 * probe.) Index layout: idx = token * 2^m + data.
 */
export function runnerPermutation(gates: readonly RevGate[], m: number): Int32Array {
  const t = gates.length;
  const dataDim = 1 << m;
  const perm = new Int32Array((t + 1) * dataDim);
  for (let token = 0; token <= t; token++) {
    for (let x = 0; x < dataDim; x++) {
      const idx = token * dataDim + x;
      if (token < t) {
        perm[idx] = (token + 1) * dataDim + applyGate(gates[token]!, x);
      } else {
        // wrap: undo the whole program (reverse order; involutions), restart
        let y = x;
        for (let i = t - 1; i >= 0; i--) y = applyGate(gates[i]!, y);
        perm[idx] = y;
      }
    }
  }
  return perm;
}

/** The classical stepwise spec: state of the data wires after k gates from x. */
export function classicalAfter(gates: readonly RevGate[], x: number, k: number): number {
  let s = x;
  for (let i = 0; i < Math.min(k, gates.length); i++) s = applyGate(gates[i]!, s);
  return s;
}

// ---------------------------------------------------------------------------
// The demonstrated program: a 2x2-bit reversible multiplier.
// wires: 0=a1 1=a0 2=b1 3=b0 | 4=p3 5=p2 6=p1 7=p0 | 8=t 9=u 10=v 11=c1 12=c2
// p = a*b via partial products: p0=a0b0, p1=a0b1^a1b0, c1=(a0b1)(a1b0),
// p2=a1b1^c1, c2=(a1b1)c1, p3=c2. Garbage t,u,v,c1,c2 stays (the tariff
// table books it; the Bennett variant is priced, not built).
// ---------------------------------------------------------------------------

export const MUL_WIRES = 13;

export function multiplierCircuit(): RevGate[] {
  const a1 = 0;
  const a0 = 1;
  const b1 = 2;
  const b0 = 3;
  const p3 = 4;
  const p2 = 5;
  const p1 = 6;
  const p0 = 7;
  const t = 8;
  const u = 9;
  const v = 10;
  const c1 = 11;
  const c2 = 12;
  return [
    { kind: "TOFFOLI", wires: [a0, b0, p0] },
    { kind: "TOFFOLI", wires: [a0, b1, t] },
    { kind: "TOFFOLI", wires: [a1, b0, u] },
    { kind: "CNOT", wires: [t, p1] },
    { kind: "CNOT", wires: [u, p1] },
    { kind: "TOFFOLI", wires: [t, u, c1] },
    { kind: "TOFFOLI", wires: [a1, b1, v] },
    { kind: "CNOT", wires: [v, p2] },
    { kind: "CNOT", wires: [c1, p2] },
    { kind: "TOFFOLI", wires: [v, c1, c2] },
    { kind: "CNOT", wires: [c2, p3] },
  ];
}

export interface MultiplierVerdict {
  readonly inputs: number; // 16
  readonly wrong: number; // must be 0: (p3..p0) == a*b for every input
  readonly worstDeviation: number; // integer cargo check worst deviation (0 by construction)
}

/** The product p3..p0 sits at wires 4..7 with p3 at wire 4 — MSB first. */
export function productNibble(state: number): number {
  return (
    (((state >> 4) & 1) << 3) |
    (((state >> 5) & 1) << 2) |
    (((state >> 6) & 1) << 1) |
    ((state >> 7) & 1)
  );
}

/** Functional correctness on all 16 inputs + integer-exact cargo vs the runner. */
export function multiplierVerdict(): MultiplierVerdict {
  const gates = multiplierCircuit();
  const perm = runnerPermutation(gates, MUL_WIRES);
  const dataDim = 1 << MUL_WIRES;
  let wrong = 0;
  let worst = 0;
  for (let x = 0; x < 16; x++) {
    const a = (((x >> 0) & 1) << 1) | ((x >> 1) & 1); // wire0=a1 (MSB), wire1=a0
    const b = (((x >> 2) & 1) << 1) | ((x >> 3) & 1); // wire2=b1 (MSB), wire3=b0
    const final = classicalAfter(gates, x, gates.length);
    if (productNibble(final) !== a * b) wrong++;
    // cargo: k beats from token 0 lands exactly on the stepwise classical state
    let idx = x; // token 0, data x
    for (let k = 0; k <= gates.length; k++) {
      const token = Math.floor(idx / dataDim);
      const data = idx % dataDim;
      const expectToken = Math.min(k, gates.length);
      const expectData = classicalAfter(gates, x, k);
      if (token !== expectToken || data !== expectData) worst++;
      if (k < gates.length) idx = perm[idx]!;
    }
    // the wrap beat returns the data to the input (the self-reset deed)
    const wrapped = perm[idx];
    if (wrapped !== x) worst++;
  }
  return { inputs: 16, wrong, worstDeviation: worst };
}

/** FREDKIN conserves Hamming weight on the full basis — the conservative-logic deed. */
export function fredkinConservesWeight(m: number, c: number, s1: number, s2: number): boolean {
  const g: RevGate = { kind: "FREDKIN", wires: [c, s1, s2] };
  for (let x = 0; x < 1 << m; x++) {
    if (popcount(x) !== popcount(applyGate(g, x))) return false;
  }
  return true;
}

export function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}
