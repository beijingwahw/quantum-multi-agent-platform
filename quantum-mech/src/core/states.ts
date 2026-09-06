/**
 * Named states and gates used as numeric anchors throughout the project.
 * Every formula here has a closed-form value a test can assert against.
 */

import { type CMat, type CVec, basisVec, identity, mat, vec, vNormalize } from './cmat.js';
import type { Rng } from './rng.js';

export const KET0: CVec = basisVec(2, 0);
export const KET1: CVec = basisVec(2, 1);

export const PLUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, 1]), im: new Float64Array(2) });
export const MINUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, -1]), im: new Float64Array(2) });

/** Uniform (maximally-mixed generator) vector |v_d⟩ = Σ_i |i⟩ / √d. */
export function uniformVec(d: number): CVec {
  const v = { n: d, re: new Float64Array(d).fill(1 / Math.sqrt(d)), im: new Float64Array(d) };
  return v;
}

/** Uniform vector orthogonal to |v_d⟩ (first two amplitudes ±1/√2, rest 0). */
export function uniformOrthVec(d: number): CVec {
  const v = { n: d, re: new Float64Array(d), im: new Float64Array(d) };
  if (d < 2) throw new Error('uniformOrthVec needs d >= 2');
  v.re[0] = 1 / Math.sqrt(2);
  v.re[1] = -1 / Math.sqrt(2);
  return v;
}

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

export function maximallyMixed(d: number): CMat {
  const m = mat(d, d);
  for (let i = 0; i < d; i++) m.re[i * d + i] = 1 / d;
  return m;
}

/** Random normalized complex vector (Gaussian, then normalize). */
export function randomStateVec(rng: Rng, d: number): CVec {
  const v = { n: d, re: new Float64Array(d), im: new Float64Array(d) };
  for (let k = 0; k < d; k++) {
    // Box-Muller pair
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    v.re[k] = r * Math.cos(2 * Math.PI * u2);
    v.im[k] = r * Math.sin(2 * Math.PI * u2);
  }
  return vNormalize(v);
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

/** Rotation R_y(θ) = [[cos, -sin], [sin, cos]] / convention real. */
export function rotY(theta: number): CMat {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  const m = mat(2, 2);
  m.re[0 * 2 + 0] = c;
  m.re[0 * 2 + 1] = -s;
  m.re[1 * 2 + 0] = s;
  m.re[1 * 2 + 1] = c;
  return m;
}

/**
 * Generalized Pauli (Weyl) operator W_{a,b} = X^a Z^b on dimension d, with
 * X|j⟩ = |(j+1) mod d⟩ and Z|j⟩ = ω^j |j⟩, ω = e^{2πi/d}. The d² operators
 * form a trace-orthogonal unitary basis: Tr W_{ab}† W_{cd} = d δ_{ac}δ_{bd},
 * and the full orbit satisfies Σ_{ab} W ρ W† = d · I · Tr ρ.
 */
export function weyl(d: number, a: number, b: number): CMat {
  const omega = (-2 * Math.PI * b) / d;
  const m = mat(d, d);
  for (let j = 0; j < d; j++) {
    const row = (j + a) % d;
    const ang = omega * j;
    m.re[row * d + j] = Math.cos(ang);
    m.im[row * d + j] = Math.sin(ang);
  }
  return m;
}

export function eye(d: number): CMat {
  return identity(d);
}

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

function vNeg(a: CVec): CVec {
  const v = vec(a.n);
  for (let i = 0; i < a.n; i++) {
    v.re[i] = -a.re[i]!;
    v.im[i] = -a.im[i]!;
  }
  return v;
}

/** |Φ+> = (|00> + |11>)/√2 */
export const BELL_PHI_PLUS: CVec = vNormalize(vAdd2(basisVec(4, 0), basisVec(4, 3)));

export function bellState(kind: 'phi+' | 'phi-' | 'psi+' | 'psi-'): CVec {
  switch (kind) {
    case 'phi+':
      return vNormalize(vAdd2(basisVec(4, 0), basisVec(4, 3)));
    case 'phi-':
      return vNormalize(vAdd2(basisVec(4, 0), vNeg(basisVec(4, 3))));
    case 'psi+':
      return vNormalize(vAdd2(basisVec(4, 1), basisVec(4, 2)));
    case 'psi-':
      return vNormalize(vAdd2(basisVec(4, 1), vNeg(basisVec(4, 2))));
  }
}

/** GHZ_n = (|0...0> + |1...1>)/√2 */
export function ghz(n: number): CVec {
  const dim = 2 ** n;
  return vNormalize(vAdd2(basisVec(dim, 0), basisVec(dim, dim - 1)));
}

/** W_3 = (|001> + |010> + |100>)/√3 */
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
