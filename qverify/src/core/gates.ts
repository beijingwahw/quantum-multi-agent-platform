/**
 * Gates, register operations and circuit sampling utilities:
 * single-qubit rotations, entanglers, local application on state vectors
 * and density matrices (stride-based, no full-register matrices), random
 * circuits for mirror/XEB experiments, and sampling from exact distributions.
 */

import { type CMat, type CVec, mat, mMul, mDagger, identity } from './cmat.js';
import type { Rng } from './rng.js';
import { PAULI_X, PAULI_Y, PAULI_Z } from './states.js';

/** Ry(θ) = [[cos θ/2, −sin θ/2], [sin θ/2, cos θ/2]] (real). */
export function rotY(theta: number): CMat {
  const m = mat(2, 2);
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  m.re[0] = c;
  m.re[1] = -s;
  m.re[2] = s;
  m.re[3] = c;
  return m;
}

/** Rz(θ) = diag(e^{−iθ/2}, e^{iθ/2}). */
export function rotZ(theta: number): CMat {
  const m = mat(2, 2);
  m.re[0] = Math.cos(theta / 2);
  m.im[0] = -Math.sin(theta / 2);
  m.re[3] = Math.cos(theta / 2);
  m.im[3] = Math.sin(theta / 2);
  return m;
}

/** Controlled-Z (full 4×4). */
export const CZ: CMat = (() => {
  const m = identity(4);
  m.re[3 * 4 + 3] = -1;
  return m;
})();

/**
 * Apply a 2×2 unitary to qubit `q` (0 = most significant) of an n-qubit
 * state vector, returning a new vector. Stride-based: no 2^n × 2^n matrix.
 */
export function applyLocalVec(state: CVec, n: number, q: number, u: CMat): CVec {
  const stride = 1 << (n - 1 - q);
  const dim = state.n;
  const out: CVec = { n: dim, re: state.re.slice(), im: state.im.slice() };
  for (let base = 0; base < dim; base += 2 * stride) {
    for (let off = 0; off < stride; off++) {
      const i0 = base + off;
      const i1 = i0 + stride;
      const aRe = state.re[i0]!;
      const aIm = state.im[i0]!;
      const bRe = state.re[i1]!;
      const bIm = state.im[i1]!;
      out.re[i0] = u.re[0]! * aRe - u.im[0]! * aIm + u.re[1]! * bRe - u.im[1]! * bIm;
      out.im[i0] = u.re[0]! * aIm + u.im[0]! * aRe + u.re[1]! * bIm + u.im[1]! * bRe;
      out.re[i1] = u.re[2]! * aRe - u.im[2]! * aIm + u.re[3]! * bRe - u.im[3]! * bIm;
      out.im[i1] = u.re[2]! * aIm + u.im[2]! * aRe + u.re[3]! * bIm + u.im[3]! * bRe;
    }
  }
  return out;
}

/** Apply a 2×2 unitary to qubit `q` of an n-qubit density matrix. */
export function applyLocalRho(rho: CMat, n: number, q: number, u: CMat): CMat {
  const d = rho.rows;
  const stride = 1 << (n - 1 - q);
  const out: CMat = { rows: d, cols: d, re: rho.re.slice(), im: rho.im.slice() };
  const ud = mDagger(u);
  // U ρ: transform columns pairwise, then ρ U†: transform rows pairwise.
  // Column pass: newCol(i0) = u00 col(i0) + u01 col(i1) etc.
  for (let c = 0; c < d; c++) {
    for (let base = 0; base < d; base += 2 * stride) {
      for (let off = 0; off < stride; off++) {
        const r0 = base + off;
        const r1 = r0 + stride;
        const aRe = out.re[r0 * d + c]!;
        const aIm = out.im[r0 * d + c]!;
        const bRe = out.re[r1 * d + c]!;
        const bIm = out.im[r1 * d + c]!;
        out.re[r0 * d + c] = u.re[0]! * aRe - u.im[0]! * aIm + u.re[1]! * bRe - u.im[1]! * bIm;
        out.im[r0 * d + c] = u.re[0]! * aIm + u.im[0]! * aRe + u.re[1]! * bIm + u.im[1]! * bRe;
        out.re[r1 * d + c] = u.re[2]! * aRe - u.im[2]! * aIm + u.re[3]! * bRe - u.im[3]! * bIm;
        out.im[r1 * d + c] = u.re[2]! * aIm + u.im[2]! * aRe + u.re[3]! * bIm + u.im[3]! * bRe;
      }
    }
  }
  // Row pass with U†: newRow(...) = row * U† — equivalently columns of (ρ U†)ᵀ.
  for (let r = 0; r < d; r++) {
    for (let base = 0; base < d; base += 2 * stride) {
      for (let off = 0; off < stride; off++) {
        const c0 = base + off;
        const c1 = c0 + stride;
        const aRe = out.re[r * d + c0]!;
        const aIm = out.im[r * d + c0]!;
        const bRe = out.re[r * d + c1]!;
        const bIm = out.im[r * d + c1]!;
        // ⟨row| U† |i0⟩: (U†)_{0,·} = conj(U)_{·,0}
        out.re[r * d + c0] = aRe * ud.re[0]! - aIm * ud.im[0]! + bRe * ud.re[2]! - bIm * ud.im[2]!;
        out.im[r * d + c0] = aRe * ud.im[0]! + aIm * ud.re[0]! + bRe * ud.im[2]! + bIm * ud.re[2]!;
        out.re[r * d + c1] = aRe * ud.re[1]! - aIm * ud.im[1]! + bRe * ud.re[3]! - bIm * ud.im[3]!;
        out.im[r * d + c1] = aRe * ud.im[1]! + aIm * ud.re[1]! + bRe * ud.im[3]! + bIm * ud.re[3]!;
      }
    }
  }
  return out;
}

/** Random 2×2 unitary: exp(−i (r·σ)) with random Bloch vector r, seeded. */
export function randomUnitary2(rng: Rng): CMat {
  const r: [number, number, number] = [rng.normal(), rng.normal(), rng.normal()];
  const norm = Math.hypot(r[0], r[1], r[2]);
  // normalize to a random rotation angle in (0, π)
  const angle = rng() * Math.PI;
  const s = norm > 0 ? (angle / norm) : 0;
  return expPauli([r[0] * s, r[1] * s, r[2] * s]);
}

/** exp(−i (x·X + y·Y + z·Z)) in closed form. */
export function expPauli(v: readonly [number, number, number]): CMat {
  const norm = Math.hypot(v[0], v[1], v[2]);
  const m = mat(2, 2);
  const c = Math.cos(norm);
  const s = norm > 0 ? Math.sin(norm) / norm : 0;
  // −i(xX+yY+zZ) = [[−iz, −y−ix], [y−ix, +iz]]
  m.re[0] = c;
  m.im[0] = -v[2] * s;
  m.re[1] = -v[1] * s;
  m.im[1] = -v[0] * s;
  m.re[2] = v[1] * s;
  m.im[2] = -v[0] * s;
  m.re[3] = c;
  m.im[3] = v[2] * s;
  return m;
}

export interface CircuitOp {
  kind: 'u1' | 'cz';
  /** qubits touched (u1: one entry; cz: two entries), 0 = most significant */
  qubits: readonly number[];
  /** for u1: the 2×2 unitary */
  u?: CMat;
}

/** A circuit as an explicit list of layers — noise insertion points are unambiguous. */
export interface RandomCircuit {
  n: number;
  layers: CircuitOp[][];
  /** flat op list in execution order (convenience) */
  ops: CircuitOp[];
}

/** Brickwork random circuit: per layer, random 1q rotations on all qubits + alternating CZ pairs. */
export function randomCircuit(rng: Rng, n: number, layerCount: number): RandomCircuit {
  const layers: CircuitOp[][] = [];
  const ops: CircuitOp[] = [];
  for (let layer = 0; layer < layerCount; layer++) {
    const cur: CircuitOp[] = [];
    for (let q = 0; q < n; q++) {
      const op: CircuitOp = { kind: 'u1', qubits: [q], u: randomUnitary2(rng) };
      cur.push(op);
      ops.push(op);
    }
    const offset = layer % 2;
    for (let q = offset; q + 1 < n; q += 2) {
      const op: CircuitOp = { kind: 'cz', qubits: [q, q + 1] };
      cur.push(op);
      ops.push(op);
    }
    layers.push(cur);
  }
  return { n, layers, ops };
}

/** Run a circuit on |0…0⟩ as a state vector (n ≤ ~16 practical). */
export function runCircuitVec(circuit: RandomCircuit): CVec {
  const dim = 1 << circuit.n;
  let cur: CVec = { n: dim, re: new Float64Array(dim), im: new Float64Array(dim) };
  cur.re[0] = 1;
  for (const op of circuit.ops) {
    if (op.kind === 'u1') {
      if (!op.u) throw new Error('u1 op without unitary');
      cur = applyLocalVec(cur, circuit.n, op.qubits[0]!, op.u);
    } else {
      // cz ops always carry two qubits (CircuitOp contract)
      const qa = op.qubits[0]!;
      const qb = op.qubits[1]!;
      for (let index = 0; index < dim; index++) {
        if (((index >> (circuit.n - 1 - qa)) & 1) === 1 && ((index >> (circuit.n - 1 - qb)) & 1) === 1) {
          cur.re[index] = -cur.re[index]!;
          cur.im[index] = -cur.im[index]!;
        }
      }
    }
  }
  return cur;
}

/** Exact outcome probabilities of a circuit on |0…0⟩. */
export function circuitProbs(circuit: RandomCircuit): Float64Array {
  const state = runCircuitVec(circuit);
  const probs = new Float64Array(state.n);
  for (let i = 0; i < state.n; i++) {
    probs[i] = state.re[i]! * state.re[i]! + state.im[i]! * state.im[i]!;
  }
  return probs;
}

/** Sample an index from an exact distribution (linear CDF scan, deterministic). */
export function sampleIndex(probs: Float64Array, rng: Rng): number {
  const x = rng();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i]!;
    if (x < acc) return i;
  }
  return probs.length - 1;
}

/** Layer-reversed, gate-daggered mirror circuit. */
export function mirrorCircuit(circuit: RandomCircuit): RandomCircuit {
  const layers: CircuitOp[][] = [];
  const ops: CircuitOp[] = [];
  for (let l = circuit.layers.length - 1; l >= 0; l--) {
    const cur: CircuitOp[] = [];
    const src = circuit.layers[l]!;
    // reverse op order within the layer: u1's commute with each other but cz pairs
    // do not necessarily commute with them; exact inverse = reverse order + dagger
    for (let i = src.length - 1; i >= 0; i--) {
      const op = src[i]!;
      const inv: CircuitOp =
        op.kind === 'cz' ? { kind: 'cz', qubits: op.qubits } : { kind: 'u1', qubits: op.qubits, u: mDagger(op.u ?? identity(2)) };
      cur.push(inv);
      ops.push(inv);
    }
    layers.push(cur);
  }
  return { n: circuit.n, layers, ops };
}

/** Full-register operator for a single-qubit gate via Kron (small n only). */
export function localOperator(n: number, q: number, u: CMat): CMat {
  let acc = identity(1);
  for (let i = 0; i < n; i++) acc = i === q ? kronM(acc, u) : kronM(acc, identity(2));
  return acc;
}

function kronM(a: CMat, b: CMat): CMat {
  const m = mat(a.rows * b.rows, a.cols * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const ar = a.re[i * a.cols + j]!;
      const ai = a.im[i * a.cols + j]!;
      if (ar === 0 && ai === 0) continue;
      for (let p = 0; p < b.rows; p++) {
        for (let q2 = 0; q2 < b.cols; q2++) {
          const br = b.re[p * b.cols + q2]!;
          const bi = b.im[p * b.cols + q2]!;
          const ri = i * b.rows + p;
          const ci = j * b.cols + q2;
          m.re[ri * m.cols + ci] = m.re[ri * m.cols + ci]! + (ar * br - ai * bi);
          m.im[ri * m.cols + ci] = m.im[ri * m.cols + ci]! + (ar * bi + ai * br);
        }
      }
    }
  }
  return m;
}

/** Partial transpose over subsystem `t` (0-based, qubits only). */
export function partialTransposeQ(rho: CMat, n: number, t: number): CMat {
  const d = rho.rows;
  const stride = 1 << (n - 1 - t);
  const out: CMat = { rows: d, cols: d, re: rho.re.slice(), im: rho.im.slice() };
  for (let row = 0; row < d; row++) {
    for (let col = 0; col < d; col++) {
      // transposed element source: swap the digit of `col` on qubit t with that of `row`
      const tRow = Math.floor(row / stride) % 2;
      const tCol = Math.floor(col / stride) % 2;
      if (tRow === tCol) continue;
      const srcRow = row - tRow * stride + tCol * stride;
      const srcCol = col - tCol * stride + tRow * stride;
      // out[row,col] = rho[srcCol-ish]… process pairs exactly once: only when (row,col) < (srcRow,srcCol)
      if (row * d + col >= srcRow * d + srcCol) continue;
      const aR = rho.re[row * d + col]!;
      const aI = rho.im[row * d + col]!;
      const bR = rho.re[srcRow * d + srcCol]!;
      const bI = rho.im[srcRow * d + srcCol]!;
      out.re[row * d + col] = bR;
      out.im[row * d + col] = bI;
      out.re[srcRow * d + srcCol] = aR;
      out.im[srcRow * d + srcCol] = aI;
    }
  }
  return out;
}

/** Measurement projectors |±_δ⟩⟨±_δ| for equatorial basis δ. */
export function equatorialProjector(delta: number): { plus: CMat; minus: CMat } {
  const v = equatorialState(delta);
  const plus = mat(2, 2);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      plus.re[i * 2 + j] = v.re[i]! * v.re[j]! + v.im[i]! * v.im[j]!;
      plus.im[i * 2 + j] = v.im[i]! * v.re[j]! - v.re[i]! * v.im[j]!;
    }
  }
  const minus = mat(2, 2);
  const mv = equatorialState(delta + Math.PI);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      minus.re[i * 2 + j] = mv.re[i]! * mv.re[j]! + mv.im[i]! * mv.im[j]!;
      minus.im[i * 2 + j] = mv.im[i]! * mv.re[j]! - mv.re[i]! * mv.im[j]!;
    }
  }
  return { plus, minus };
}

function equatorialState(delta: number): CVec {
  const v = { n: 2, re: new Float64Array(2), im: new Float64Array(2) };
  v.re[0] = 1 / Math.SQRT2;
  v.re[1] = Math.cos(delta) / Math.SQRT2;
  v.im[1] = Math.sin(delta) / Math.SQRT2;
  return v;
}

/** Product of a list of 2×2 (or square) matrices in order. */
export function mulAll(ms: readonly CMat[]): CMat {
  if (ms.length === 0) throw new Error('mulAll needs >=1 matrix');
  return ms.reduce((acc, m) => mMul(acc, m));
}

export { PAULI_X, PAULI_Y, PAULI_Z };
