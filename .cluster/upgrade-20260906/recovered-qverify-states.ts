/**
 * Named quantum states used as numeric anchors throughout the project.
 * Every formula here has a closed-form value a test can assert against.
 */

import { CMat, CVec, basisVec, mat, vec, vNormalize } from './cmat.js';
import type { Rng } from './rng.js';

export const KET0: CVec = basisVec(2, 0);
export const KET1: CVec = basisVec(2, 1);

export const PLUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, 1]), im: new Float64Array(2) });
export const MINUS: CVec = vNormalize({ n: 2, re: Float64Array.from([1, -1]), im: new Float64Array(2) });
export const RPLUS: CVec = vNormalize({
  n: 2,
  re: Float64Array.from([1, 0]),
  im: Float64Array.from([0, 1]),
});
export const LPLUS: CVec = vNormalize({
  n: 2,
  re: Float64Array.from([1, 0]),
  im: Float64Array.from([0, -1]),
});

/** |+_θ⟩ = (|0⟩ + e^{iθ}|1⟩)/√2 — the equatorial states of UBQC / trap calculus. */
export function equatorial(theta: number): CVec {
  const v = vec(2);
  v.re[0] = 1 / Math.SQRT2;
  v.re[1] = Math.cos(theta) / Math.SQRT2;
  v.im[1] = Math.sin(theta) / Math.SQRT2;
  return v;
}

/** |+_θ⟩⟨+_θ| as a 2×2 density matrix. */
export function equatorialRho(theta: number): CMat {
  return fromVec(equatorial(theta));
}

/** Bloch vector of |+_θ⟩: (cos θ, sin θ, 0). */
export function equatorialBloch(theta: number): [number, number, number] {
  return [Math.cos(theta), Math.sin(theta), 0];
}

export type BellKind = 'phi+' | 'phi-' | 'psi+' | 'psi-';

/** Four Bell states in the kets' natural ordering. */
export function bellState(kind: BellKind): CVec {
  const add = (a: CVec, b: CVec, sgn: number): CVec => {
    const v = vec(a.n);
    for (let i = 0; i < a.n; i++) {
      v.re[i] = a.re[i] + sgn * b.re[i];
      v.im[i] = a.im[i] + sgn * b.im[i];
    }
    return v;
  };
  switch (kind) {
    case 'phi+':
      return vNormalize(add(basisVec(4, 0), basisVec(4, 3), 1));
    case 'phi-':
      return vNormalize(add(basisVec(4, 0), basisVec(4, 3), -1));
    case 'psi+':
      return vNormalize(add(basisVec(4, 1), basisVec(4, 2), 1));
    case 'psi-':
      return vNormalize(add(basisVec(4, 1), basisVec(4, 2), -1));
  }
}

/** Pure two-qubit state cos γ|00⟩ + sin γ|11⟩ (Schmidt coefficients). */
export function schmidtState(gamma: number): CVec {
  const v = vec(4);
  v.re[0] = Math.cos(gamma);
  v.re[3] = Math.sin(gamma);
  return vNormalize(v);
}

/** Concurrence of |schmidtState(γ)⟩ = sin 2γ (for tests / anchors). */
export function schmidtConcurrence(gamma: number): number {
  return Math.sin(2 * gamma);
}

export function maximallyMixed(d: number): CMat {
  const m = mat(d, d);
  for (let i = 0; i < d; i++) m.re[i * d + i] = 1 / d;
  return m;
}

/**
 * Two-qubit isotropic state in the fidelity convention:
 * ρ(F) = F|Φ+⟩⟨Φ+| + (1−F) I/4.
 * T-matrix = F·diag(1,−1,1) exactly, so the Horodecki value is S_max = 2√2·F;
 * CHSH violation iff F > 1/√2; PPT-entangled iff F > 1/2.
 */
export function wernerFidelity(f: number): CMat {
  const pure = fromVec(bellState('phi+'));
  const out = mat(4, 4);
  for (let k = 0; k < 16; k++) {
    const eye = k % 5 === 0 ? 1 : 0; // I/4 on the diagonal
    out.re[k] = f * pure.re[k] + (1 - f) * (eye / 4);
    out.im[k] = f * pure.im[k];
  }
  return out;
}

/** |ψ⟩⟨ψ| from a state vector. */
export function fromVec(v: CVec): CMat {
  const m = mat(v.n, v.n);
  for (let i = 0; i < v.n; i++) {
    for (let j = 0; j < v.n; j++) {
      m.re[i * v.n + j] = v.re[i] * v.re[j] + v.im[i] * v.im[j];
      m.im[i * v.n + j] = v.im[i] * v.re[j] - v.re[i] * v.im[j];
    }
  }
  return m;
}

/** Random pure state (complex Gaussian, normalized), seeded. */
export function randomPureState(dim: number, rng: Rng): CVec {
  const v = vec(dim);
  for (let i = 0; i < dim; i++) {
    v.re[i] = rng.normal();
    v.im[i] = rng.normal();
  }
  return vNormalize(v);
}

/** Random two-qubit mixed state: random pure state on 2 qubits + one noise partner. */
export function randomTwoQubitMixed(rng: Rng, mixing: number): CMat {
  const a = fromVec(randomPureState(4, rng));
  const b = fromVec(randomPureState(4, rng));
  const out = mat(4, 4);
  for (let k = 0; k < 16; k++) {
    out.re[k] = (1 - mixing) * a.re[k] + mixing * b.re[k];
    out.im[k] = (1 - mixing) * a.im[k] + mixing * b.im[k];
  }
  return out;
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

export const PAULIS: readonly CMat[] = [PAULI_X, PAULI_Y, PAULI_Z];

export const HADAMARD: CMat = (() => {
  const m = mat(2, 2);
  m.re[0] = 1 / Math.SQRT2;
  m.re[1] = 1 / Math.SQRT2;
  m.re[2] = 1 / Math.SQRT2;
  m.re[3] = -1 / Math.SQRT2;
  return m;
})();

/** Tensor a list of CVec into a joint state vector. */
export function vKronAll(vs: readonly CVec[]): CVec {
  if (vs.length === 0) throw new Error('vKronAll needs >=1 vector');
  return vs.reduce((acc, v) => {
    const out = vec(acc.n * v.n);
    for (let i = 0; i < acc.n; i++) {
      for (let j = 0; j < v.n; j++) {
        out.re[i * v.n + j] = acc.re[i] * v.re[j] - acc.im[i] * v.im[j];
        out.im[i * v.n + j] = acc.re[i] * v.im[j] + acc.im[i] * v.re[j];
      }
    }
    return out;
  });
}
