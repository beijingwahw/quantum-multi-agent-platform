/**
 * The TCA+21 face at d = 2: the 4-order Hadamard promise problem, executed.
 *
 * Taddei et al. (PRX Quantum 2, 010320 (2021), arXiv:2002.07817 — web-verified
 * 2026-09-08 against the arXiv abstract page and the ar5iv full text) define a
 * promise problem for the N-switch whose target system is a single qubit
 * REGARDLESS of N: a set U of N gates satisfies the promise for column y of a
 * P×P Hadamard matrix if the products over P selected orders differ only by
 * the signs of Hadamard column y:
 *   Π_x = m_{x,y}·Π_0  for every selected order x.
 * Algorithm 1 (their Eq. (4)-(6)): control |0⟩ → H_P → switch → H_P^{-1} →
 * measure the control: outcome y exactly, one use of each gate.
 *
 * This module executes the bounded k = 4 instance with exact arithmetic:
 *   - the experimental quartet of orders Σ = {ABCD, BADC, CBDA, DACB};
 *   - the 4×4 Sylvester Hadamard H₄;
 *   - the Pauli census: ALL 256 ordered gate sets {I,X,Y,Z}⁴ checked against
 *     every column (the machine analogue of their Table 2);
 *   - Algorithm 1 readout for every promising set (success probability 1);
 *   - the fixed-order supersequence bound: the shortest string over {A,B,C,D}
 *     containing all four orders as subsequences (their Appendix claim: 9,
 *     witness ACBADACDB) — machine-decided by exhaustive enumeration;
 *   - the plain-order distinguishability matrix: for every order π ∈ S₄ and
 *     every column pair, whether that plain order distinguishes the columns
 *     (exact 0/1), against the switch readout (deterministic).
 */
import { I2, X2, Y2, Z2 } from "./promise.js";
import { S4 } from "./k4.js";
import { KSwitchError } from "./errors.js";

/** The experimental quartet of orders (TCA+21): ABCD, BADC, CBDA, DACB. */
export const ORDERS4: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 1, 2, 3],
  [1, 0, 3, 2],
  [2, 1, 3, 0],
  [3, 0, 2, 1],
];

/** The 4×4 Sylvester Hadamard, rows = outcomes y, columns = order index x. */
export const H4: ReadonlyArray<readonly number[]> = [
  [1, 1, 1, 1],
  [1, 1, -1, -1],
  [1, -1, -1, 1],
  [1, -1, 1, -1],
].map((r) => r.map((v) => v / 2));

export interface Vec {
  readonly re: number[];
  readonly im: number[];
}

/** 2×2 complex matrix as flat re/im pairs (small fixed-size kernels, exact for Paulis). */
export interface Mat2 {
  readonly re: ReadonlyArray<readonly number[]>;
  readonly im: ReadonlyArray<readonly number[]>;
}

const GATES: ReadonlyArray<{ readonly name: string; readonly mat: Mat2 }> = [
  { name: "I", mat: toMat2(I2) },
  { name: "X", mat: toMat2(X2) },
  { name: "Y", mat: toMat2(Y2) },
  { name: "Z", mat: toMat2(Z2) },
];

function toMat2(m: { re: number[][]; im: number[][] }): Mat2 {
  return { re: m.re.map((r) => [...r]), im: m.im.map((r) => [...r]) };
}

/**
 * The Mat2 gates of a census set, by gate indices. The only public way to
 * index GATES: an out-of-range or non-integer index is NAMED and rejected
 * (no silent undefined -> NaN downstream).
 */
export function gatesByIndices(indices: readonly number[]): readonly Mat2[] {
  return indices.map((i) => {
    if (!Number.isInteger(i) || i < 0 || i >= GATES.length) {
      throw new KSwitchError("GATE-INDEX-OUT-OF-RANGE", `gate index ${String(i)} is outside the census alphabet {I,X,Y,Z} (0..${GATES.length - 1})`);
    }
    return GATES[i]!.mat;
  });
}

export function mul2(a: Mat2, b: Mat2): Mat2 {
  const re = [0, 1].map(() => [0, 0]);
  const im = [0, 1].map(() => [0, 0]);
  for (let i = 0; i < 2; i++) {
    for (let k = 0; k < 2; k++) {
      const ar = a.re[i]![k]!;
      const ai = a.im[i]![k]!;
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < 2; j++) {
        re[i]![j] = re[i]![j]! + ar * b.re[k]![j]! - ai * b.im[k]![j]!;
        im[i]![j] = im[i]![j]! + ar * b.im[k]![j]! + ai * b.re[k]![j]!;
      }
    }
  }
  return { re, im };
}

/** Product of the four gates in order seq (seq[0] applied first). */
export function product2(gates: readonly Mat2[], seq: readonly [number, number, number, number]): Mat2 {
  return mul2(mul2(mul2(gates[seq[3]]!, gates[seq[2]]!), gates[seq[1]]!), gates[seq[0]]!);
}

export interface CensusSet {
  readonly gates: readonly [number, number, number, number]; // indices into GATES
  readonly names: readonly string[];
  readonly column: number; // y ∈ 0..3, or -1 = fails the promise
}

export interface HadamardCensus {
  readonly sets: readonly CensusSet[];
  readonly byColumn: readonly CensusSet[][];
  readonly failing: number;
}

/**
 * Census over all 256 ordered gate sets {I,X,Y,Z}⁴: for each, compute the
 * four quartet products Π_x; the set satisfies the promise for column y iff
 * Π_x = m_{x,y}·Π_0 EXACTLY for all x (the Pauli ray condition: products
 * differ only by signs forming a Hadamard column).
 */
export function hadamardCensus(): HadamardCensus {
  const sets: CensusSet[] = [];
  let failing = 0;
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      for (let c = 0; c < 4; c++) {
        for (let d = 0; d < 4; d++) {
          const indices: [number, number, number, number] = [a, b, c, d];
          const gates = gatesByIndices(indices);
          const base = product2(gates, [0, 1, 2, 3]);
          const rel: number[] = [];
          let ok = true;
          for (let x = 0; x < 4; x++) {
            const prod = product2(gates, ORDERS4[x]!);
            // sign s with prod = s·base, or NaN if not ± base
            let s = 0;
            for (let plus = 1; plus >= -1; plus -= 2) {
              let dev = 0;
              for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 2; j++) {
                  dev = Math.max(dev, Math.hypot(prod.re[i]![j]! - plus * base.re[i]![j]!, prod.im[i]![j]! - plus * base.im[i]![j]!));
                }
              }
              if (dev < 1e-12) s = plus;
            }
            if (s === 0) {
              ok = false;
              break;
            }
            rel.push(s);
          }
          let column = -1;
          if (ok) {
            for (let y = 0; y < 4; y++) {
              let match = true;
              for (let x = 0; x < 4; x++) {
                if (rel[x] !== Math.sign(H4[y]![x]!)) {
                  match = false;
                  break;
                }
              }
              if (match) {
                column = y;
                break;
              }
            }
          }
          if (column === -1) {
            failing++;
            continue;
          }
          sets.push({ gates: indices, names: indices.map((i) => GATES[i]!.name), column });
        }
      }
    }
  }
  const byColumn = [0, 1, 2, 3].map((y) => sets.filter((s) => s.column === y));
  return { sets, byColumn, failing };
}

// ---------------------------------------------------------------------------
// Algorithm 1, executed on control (4) ⊗ target (2), dim 8.
// ---------------------------------------------------------------------------

/** |0> ⊗ psi: joint state on control (4) ⊗ target (2); re at i, im at 8+i (i = x·2+t). */
function initialState(psi: Vec): Float64Array {
  const s = new Float64Array(16);
  s[0] = psi.re[0]!;
  s[1] = psi.re[1]!;
  s[8] = psi.im[0]!;
  s[9] = psi.im[1]!;
  return s;
}

/** Real 4×4 Hadamard acting on the control index of the 16-slot joint state. */
export function hadamardOnControl(state: Float64Array, h: ReadonlyArray<readonly number[]>): Float64Array {
  const out = new Float64Array(16);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const w = h[y]![x]!;
      if (w === 0) continue;
      for (let t = 0; t < 2; t++) {
        out[y * 2 + t] = out[y * 2 + t]! + w * state[x * 2 + t]!;
        out[8 + y * 2 + t] = out[8 + y * 2 + t]! + w * state[8 + x * 2 + t]!;
      }
    }
  }
  return out;
}

/** The quartet switch: block x applies Π_x to the target. */
export function switchOnJoint(state: Float64Array, gates: readonly Mat2[]): Float64Array {
  const out = new Float64Array(16);
  for (let x = 0; x < 4; x++) {
    const prod = product2(gates, ORDERS4[x]!);
    for (let t0 = 0; t0 < 2; t0++) {
      let re = 0;
      let im = 0;
      for (let t1 = 0; t1 < 2; t1++) {
        const gr = prod.re[t0]![t1]!;
        const gi = prod.im[t0]![t1]!;
        re += gr * state[x * 2 + t1]! - gi * state[8 + x * 2 + t1]!;
        im += gr * state[8 + x * 2 + t1]! + gi * state[x * 2 + t1]!;
      }
      out[x * 2 + t0] = re;
      out[8 + x * 2 + t0] = im;
    }
  }
  return out;
}

/** Control-outcome probabilities of the 16-slot joint state. */
export function controlOutcomes(state: Float64Array): number[] {
  const p = [0, 0, 0, 0];
  for (let x = 0; x < 4; x++) {
    p[x] = state[x * 2]! ** 2 + state[x * 2 + 1]! ** 2 + state[8 + x * 2]! ** 2 + state[8 + x * 2 + 1]! ** 2;
  }
  return p;
}

/**
 * Algorithm 1 end to end for a promise-satisfying gate set: returns the
 * control-outcome distribution. For a set in column y0 the outcome must be y0
 * with probability EXACTLY 1 (machine-checked by the caller).
 */
export function algorithm1(gates: readonly Mat2[], psi: Vec): number[] {
  let s = initialState(psi);
  s = hadamardOnControl(s, H4);
  s = switchOnJoint(s, gates);
  s = hadamardOnControl(s, H4); // H4 symmetric: H4^{-1} = H4^T = H4
  return controlOutcomes(s);
}

// ---------------------------------------------------------------------------
// The fixed-order supersequence bound (TCA+21 App. — their claim: 9).
// ---------------------------------------------------------------------------

function containsSubsequence(word: readonly number[], pattern: readonly number[]): boolean {
  let p = 0;
  for (const c of word) {
    if (c === pattern[p]) p++;
    if (p === pattern.length) return true;
  }
  return p === pattern.length;
}

export interface SupersequenceResult {
  readonly minLength: number;
  readonly witness: readonly number[];
  /** number of minimal-length supersequences (over alphabet {0..3}) */
  readonly count: number;
}

/**
 * Exhaustive search over strings of length 1..limit on {A,B,C,D}: the shortest
 * that contains every quartet order as a subsequence. TCA+21's Appendix gives
 * 9 (witness ACBADACDB); the machine decides. A limit below the quartet size
 * can never succeed (each order has 4 distinct letters) and is NAMED and
 * rejected rather than silently returning null.
 */
export function shortestSupersequence(limit: number): SupersequenceResult | null {
  if (!Number.isInteger(limit) || limit < ORDERS4.length) {
    throw new KSwitchError("SUPERSEQUENCE-LIMIT-BELOW-QUARTET", `limit ${String(limit)} is below the quartet size ${ORDERS4.length} — no supersequence can exist`);
  }
  const patterns = ORDERS4;
  for (let len = patterns.length; len <= limit; len++) {
    const total = 4 ** len;
    let count = 0;
    let witness: number[] | null = null;
    for (let code = 0; code < total; code++) {
      const word: number[] = [];
      let c = code;
      for (let i = 0; i < len; i++) {
        word.push(c & 3);
        c = Math.floor(c / 4);
      }
      if (patterns.every((p) => containsSubsequence(word, p))) {
        count++;
        witness ??= word;
      }
    }
    if (witness !== null) return { minLength: len, witness, count };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The plain-order distinguishability matrix (exact 0/1).
// ---------------------------------------------------------------------------

export interface DistinguishabilityMatrix {
  /** pairs of columns (y, y'), upper triangle, 6 of them */
  readonly pairs: ReadonlyArray<{ readonly y: number; readonly y2: number }>;
  /** entry[p][pairIndex]: 1 iff some plain order pi ∈ S_4 separates the column pair through that order — value is the FRACTION of the (set,set') pairs that order pi separates (min over pairs = the game value; see gameMatrix). */
  readonly matrix: readonly number[][];
  /** worst case over set pairs: 1 iff order pi separates EVERY set pair of the columns */
  readonly gameMatrix: readonly number[][];
}

function sameRay(a: Mat2, b: Mat2): boolean {
  for (const s of [1, -1]) {
    let dev = 0;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        dev = Math.max(dev, Math.hypot(a.re[i]![j]! - s * b.re[i]![j]!, a.im[i]![j]! - s * b.im[i]![j]!));
      }
    }
    if (dev < 1e-12) return true;
  }
  return false;
}

/**
 * For every order pi ∈ S_4 (24) and every column pair (y,y'): the entry is 1
 * iff, for EVERY set in column y and set' in column y', the products through
 * pi are NOT the same ray — i.e. the plain fixed order pi distinguishes the
 * columns on the WORST-CASE set pair (max over input states is 1 for Pauli
 * products on distinct rays, 0 on the same ray: exact). The switch readout
 * distinguishes every pair deterministically (Algorithm 1) — the contrast.
 */
export function distinguishabilityMatrix(census: HadamardCensus): DistinguishabilityMatrix {
  const pairs: Array<{ y: number; y2: number }> = [];
  for (let y = 0; y < 4; y++) {
    for (let y2 = y + 1; y2 < 4; y2++) pairs.push({ y, y2 });
  }
  const matrix: number[][] = [];
  const gameMatrix: number[][] = [];
  for (let pi = 0; pi < 24; pi++) {
    const row: number[] = [];
    const gameRow: number[] = [];
    for (const { y, y2 } of pairs) {
      let separatedPairs = 0;
      let totalPairs = 0;
      for (const s1 of census.byColumn[y]!) {
        const g1 = gatesByIndices(s1.gates);
        const p1 = product2(g1, S4[pi]!.seq);
        for (const s2 of census.byColumn[y2]!) {
          const g2 = gatesByIndices(s2.gates);
          const p2 = product2(g2, S4[pi]!.seq);
          totalPairs++;
          if (!sameRay(p1, p2)) separatedPairs++;
        }
      }
      row.push(totalPairs === 0 ? 0 : separatedPairs / totalPairs);
      gameRow.push(separatedPairs === totalPairs && totalPairs > 0 ? 1 : 0);
    }
    matrix.push(row);
    gameMatrix.push(gameRow);
  }
  return { pairs, matrix, gameMatrix };
}
