/**
 * Named states and gates used as numeric anchors throughout the project.
 * Every formula here has a closed-form value a test can assert against.
 */

import { type CMat, type CVec, basisVec, mat, vec, vNormalize } from './cmat.js';
import type { Rng } from './rng.js';

/** Computational basis anchor |0⟩. */
export const KET0: CVec = basisVec(2, 0);
/** Computational basis anchor |1⟩. */
export const KET1: CVec = basisVec(2, 1);

/** |+⟩ = (|0⟩ + |1⟩)/√2. */
export const PLUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, 1]), im: new Float64Array(2) });
/** |−⟩ = (|0⟩ − |1⟩)/√2. */
export const MINUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, -1]), im: new Float64Array(2) });

/** |ψ⟩⟨ψ| density matrix of a pure state vector. */
export function vecToRho(v: CVec): CMat {
  const m = mat(v.n, v.n);
  for (let i = 0; i < v.n; i++) {
    for (let j = 0; j < v.n; j++) {
      m.re[i * v.n + j] = v.re[i]! * v.re[j]! + v.im[i]! * v.im[j]!;
      m.im[i * v.n + j] = v.im[i]! * v.re[j]! - v.re[i]! * v.im[j]!;
    }
  }
  return m;
}

/** Maximally mixed state I/d. */
export function maximallyMixed(d: number): CMat {
  const m = mat(d, d);
  for (let i = 0; i < d; i++) m.re[i * d + i] = 1 / d;
  return m;
}

/** Pauli matrices. */
export const PAULI_X: CMat = (() => {
  const m = mat(2, 2);
  m.re[0 * 2 + 1] = 1;
  m.re[1 * 2 + 0] = 1;
  return m;
})();

export const PAULI_Y: CMat = (() => {
  const m = mat(2, 2);
  m.im[0 * 2 + 1] = -1;
  m.im[1 * 2 + 0] = 1;
  return m;
})();

export const PAULI_Z: CMat = (() => {
  const m = mat(2, 2);
  m.re[0 * 2 + 0] = 1;
  m.re[1 * 2 + 1] = -1;
  return m;
})();

// ---------------------------------------------------------------------------
// Named anchor states used by the protocol/contract layers and the test
// suite (Bell, GHZ, W, Werner, Hadamard) plus the seeded Gaussian sampler.
// Same closed-form math as the original implementations.
// ---------------------------------------------------------------------------

/** |ψ><ψ| from a state vector — legacy name of vecToRho. */
export { vecToRho as fromVec };

/** |R> = (|0> + i|1>)/√2 */
export const RPLUS: CVec = vNormalize({
  n: 2,
  re: Float64Array.from([1, 0]),
  im: Float64Array.from([0, 1]),
});

/** |L> = (|0> - i|1>)/√2 */
export const LPLUS: CVec = vNormalize({
  n: 2,
  re: Float64Array.from([1, 0]),
  im: Float64Array.from([0, -1]),
});

function vAdd2(a: CVec, b: CVec): CVec {
  const v = vec(a.n);
  for (let i = 0; i < a.n; i++) {
    v.re[i] = a.re[i]! + b.re[i]!;
    v.im[i] = a.im[i]! + b.im[i]!;
  }
  return v;
}

/** |Φ+> = (|00> + |11>)/√2 */
export const BELL_PHI_PLUS: CVec = vNormalize(vAdd2(basisVec(4, 0), basisVec(4, 3)));

/** GHZ_n = (|0...0> + |1...1>)/√2 */
/** GHZ state on n qubits. */
export function ghz(n: number): CVec {
  const dim = 2 ** n;
  return vNormalize(vAdd2(basisVec(dim, 0), basisVec(dim, dim - 1)));
}

/** W_3 = (|001> + |010> + |100>)/√3 */
/** W state on 3 qubits. */
export function w3(): CVec {
  return vNormalize(vAdd2(vAdd2(basisVec(8, 1), basisVec(8, 2)), basisVec(8, 4)));
}

/** Werner state F|Φ+><Φ+| + (1-F)(I - |Φ+><Φ+|)/3 on two qubits. */
export function werner(f: number): CMat {
  const pure = vecToRho(BELL_PHI_PLUS);
  const ident = mat(4, 4);
  for (let i = 0; i < 4; i++) ident.re[i * 4 + i] = 1;
  const anti = mSub(ident, pure);
  const out = mat(4, 4);
  for (let k = 0; k < 16; k++) {
    out.re[k] = f * pure.re[k]! + ((1 - f) / 3) * anti.re[k]!;
    out.im[k] = f * pure.im[k]! + ((1 - f) / 3) * anti.im[k]!;
  }
  return out;
}

function mSub(a: CMat, b: CMat): CMat {
  const m = mat(a.rows, a.cols);
  for (let k = 0; k < a.re.length; k++) {
    m.re[k] = a.re[k]! - b.re[k]!;
    m.im[k] = a.im[k]! - b.im[k]!;
  }
  return m;
}

/** Hadamard gate. */
export const HADAMARD: CMat = (() => {
  const m = mat(2, 2);
  m.re[0] = 1 / Math.SQRT2;
  m.re[1] = 1 / Math.SQRT2;
  m.re[2] = 1 / Math.SQRT2;
  m.re[3] = -1 / Math.SQRT2;
  return m;
})();

/** Random pure state (complex Gaussian, normalized), seeded. */
export function randomPureState(dim: number, rng: Rng): CVec {
  const v = vec(dim);
  for (let i = 0; i < dim; i++) {
    v.re[i] = rng.normal();
    v.im[i] = rng.normal();
  }
  return vNormalize(v);
}

/** Embed a classical value v in a d-dimensional computational basis vector. */
export function valueKet(d: number, v: number): CVec {
  return basisVec(d, v);
}
