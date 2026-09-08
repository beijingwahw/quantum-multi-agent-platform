/**
 * T4a — Local-Pauli classical shadows (Huang–Kueng–Preskill), exact.
 *
 *  (1) Unbiasedness by exact enumeration: E[ρ̂] = ρ where ρ̂ = R†(⊗_v (3|b_v⟩⟨b_v| − I))R
 *      is the single-snapshot estimator after measuring each qubit in a
 *      uniformly random Pauli basis R = ⊗_v R_{basis_v}. Verified by summing
 *      over all (basis, outcome) events weighted by exact probabilities —
 *      no Monte Carlo, agreement to machine precision.
 *  (2) Linear fidelity estimation: F̂ = ⟨ψ|ρ̂|ψ⟩ has expectation ⟨ψ|ρ|ψ⟩;
 *      for (1−q)|ψ⟩⟨ψ| + q I/2ⁿ this is exactly (1−q) + q/2ⁿ. MC verifies
 *      within statistical bars. The per-shot value ⟨ψ̃|D|ψ̃⟩ is computed as
 *      a full amplitude sum (correct for entangled targets — it does not
 *      factor per qubit).
 */

import { type CMat, type CVec, mat, mDagger, identity } from '../core/cmat.js';
import { applyLocalRho } from '../core/gates.js';
import { HADAMARD } from '../core/states.js';
import type { Rng } from '../core/rng.js';
import { traceDistance } from '../core/measures.js';

export type PauliBasis = 'X' | 'Y' | 'Z';
const BASES: readonly PauliBasis[] = ['X', 'Y', 'Z'];

/** Rotation carrying the computational basis to the requested Pauli basis. */
export function shadowBasisRotation(basis: PauliBasis): CMat {
  if (basis === 'Z') return identity(2);
  if (basis === 'X') return HADAMARD;
  // Y: U|0⟩ = |+y⟩ = (|0⟩+i|1⟩)/√2, U|1⟩ = |−y⟩ = (|0⟩−i|1⟩)/√2
  const m = mat(2, 2);
  const s = 1 / Math.SQRT2;
  m.re[0] = s;
  m.re[1] = s;
  m.im[2] = s;
  m.im[3] = -s;
  return m;
}

function applyRotVec(v: CVec, n: number, q: number, u: CMat): CVec {
  const out: CVec = { n: v.n, re: v.re.slice(), im: v.im.slice() };
  const stride = 1 << (n - 1 - q);
  for (let base = 0; base < v.n; base += 2 * stride) {
    for (let off = 0; off < stride; off++) {
      const i0 = base + off;
      const i1 = i0 + stride;
      const aRe = v.re[i0]!;
      const aIm = v.im[i0]!;
      const bRe = v.re[i1]!;
      const bIm = v.im[i1]!;
      out.re[i0] = u.re[0]! * aRe - u.im[0]! * aIm + u.re[1]! * bRe - u.im[1]! * bIm;
      out.im[i0] = u.re[0]! * aIm + u.im[0]! * aRe + u.re[1]! * bIm + u.im[1]! * bRe;
      out.re[i1] = u.re[2]! * aRe - u.im[2]! * aIm + u.re[3]! * bRe - u.im[3]! * bIm;
      out.im[i1] = u.re[2]! * aIm + u.im[2]! * aRe + u.re[3]! * bIm + u.im[3]! * bRe;
    }
  }
  return out;
}

function rotateRhoAll(rho: CMat, n: number, assignment: readonly PauliBasis[], dagger: boolean): CMat {
  // The measurement rotation R maps basis eigenstates to Z labels: R = U† where
  // U columns are the eigenstates (H is self-adjoint, so only complex bases
  // expose the direction — the rotate-back applies U). Distinct qubits commute.
  let cur = rho;
  for (let v = 0; v < n; v++) {
    const r = shadowBasisRotation(assignment[v]!); // callers build assignment with exactly n entries
    cur = applyLocalRho(cur, n, v, dagger ? r : mDagger(r));
  }
  return cur;
}

/** Exact expected snapshot E[ρ̂] by full enumeration over 3^n bases × 2^n outcomes. */
export function expectedShadow(rho: CMat, n: number): CMat {
  const d = rho.rows;
  const out = mat(d, d);
  const rec = (assignment: PauliBasis[]): void => {
    if (assignment.length === n) {
      const rotated = rotateRhoAll(rho, n, assignment, false);
      for (let outcome = 0; outcome < 1 << n; outcome++) {
        const p = rotated.re[outcome * d + outcome]!; // probability of this joint outcome
        // snapshot in the measurement frame: ⊗_v (3|b_v⟩⟨b_v| − I)
        const snapFrame = mat(1, 1);
        snapFrame.re[0] = 1;
        let snap = snapFrame;
        for (let v = 0; v < n; v++) {
          const bit = (outcome >> (n - 1 - v)) & 1;
          const m = mat(2, 2);
          m.re[0] = bit === 0 ? 2 : -1;
          m.re[3] = bit === 0 ? -1 : 2;
          snap = kron2(snap, m);
        }
        const snapBack = rotateRhoAll(snap, n, assignment, true);
        const w = p / 3 ** n;
        for (let k = 0; k < d * d; k++) {
          out.re[k] = out.re[k]! + w * snapBack.re[k]!;
          out.im[k] = out.im[k]! + w * snapBack.im[k]!;
        }
      }
      return;
    }
    for (const b of BASES) rec([...assignment, b]);
  };
  rec([]);
  return out;
}

/**
 * Exact per-shot value of the local-Pauli shadow fidelity estimator at a
 * given (basis assignment, outcome): ⟨ψ̃| D_pattern |ψ̃⟩ with D diagonal and
 * |ψ̃⟩ = R|ψ⟩ (R = U† per qubit). Pure function, shared by the MC estimator
 * and the exact moment enumeration below.
 */
export function fidelityShotValue(target: CVec, n: number, assignment: readonly PauliBasis[], outcome: number): number {
  const d = 1 << n;
  let psiTilde = target;
  for (let v = 0; v < n; v++) psiTilde = applyRotVec(psiTilde, n, v, mDagger(shadowBasisRotation(assignment[v]!)));
  let est = 0;
  for (let idx = 0; idx < d; idx++) {
    let factor = 1;
    for (let v = 0; v < n; v++) {
      const bit = (idx >> (n - 1 - v)) & 1;
      const want = (outcome >> (n - 1 - v)) & 1;
      factor *= bit === want ? 2 : -1;
    }
    est += factor * (psiTilde.re[idx]! * psiTilde.re[idx]! + psiTilde.im[idx]! * psiTilde.im[idx]!);
  }
  return est;
}

/**
 * Exact per-shot distribution moments of the fidelity estimator by full
 * enumeration (3ⁿ bases × 2ⁿ outcomes, exact probabilities): mean, variance,
 * min and max per-shot value. The sample-complexity census consumes these.
 */
export function shadowFidelityExact(
  rho: CMat,
  target: CVec,
  n: number,
): { mean: number; variance: number; min: number; max: number } {
  const d = rho.rows;
  let mean = 0;
  let second = 0;
  let min = Infinity;
  let max = -Infinity;
  const rec = (assignment: PauliBasis[]): void => {
    if (assignment.length === n) {
      const rotated = rotateRhoAll(rho, n, assignment, false);
      for (let outcome = 0; outcome < 1 << n; outcome++) {
        const p = rotated.re[outcome * d + outcome]!;
        const value = fidelityShotValue(target, n, assignment, outcome);
        const w = p / 3 ** n;
        mean += w * value;
        second += w * value * value;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      return;
    }
    for (const b of BASES) rec([...assignment, b]);
  };
  rec([]);
  return { mean, variance: second - mean * mean, min, max };
}

/** Unbiasedness check: trace distance between E[ρ̂] and ρ. */
export function shadowBias(rho: CMat, n: number): number {
  return traceDistance(expectedShadow(rho, n), rho);
}

/** Monte-Carlo fidelity estimation with exact per-shot snapshot values. */
export function fidelityShadowMC(
  rho: CMat,
  target: CVec,
  n: number,
  shots: number,
  rng: Rng,
): { mean: number; stdErr: number } {
  const d = rho.rows;
  const estimates: number[] = [];
  for (let shot = 0; shot < shots; shot++) {
    const assignment: PauliBasis[] = [];
    for (let v = 0; v < n; v++) assignment.push(BASES[rng.int(3)]!); // rng.int(3) ∈ [0,3) indexes the 3 bases
    const rotated = rotateRhoAll(rho, n, assignment, false);
    const cum = new Float64Array(d);
    let acc = 0;
    for (let idx = 0; idx < d; idx++) {
      acc += rotated.re[idx * d + idx]!;
      cum[idx] = acc;
    }
    const x = rng() * acc;
    let outcome = 0;
    while (outcome < d - 1 && cum[outcome]! < x) outcome++;
    // per-shot value ⟨ψ̃| D_pattern |ψ̃⟩ — shared with the exact enumeration
    estimates.push(fidelityShotValue(target, n, assignment, outcome));
  }
  const mean = estimates.reduce((a, b) => a + b, 0) / shots;
  const varr = estimates.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, shots - 1);
  return { mean, stdErr: Math.sqrt(varr / shots) };
}

function kron2(a: CMat, b: CMat): CMat {
  const out = mat(a.rows * b.rows, a.cols * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const ar = a.re[i * a.cols + j]!;
      const ai = a.im[i * a.cols + j]!;
      for (let p = 0; p < b.rows; p++) {
        for (let q = 0; q < b.cols; q++) {
          const ri = i * b.rows + p;
          const ci = j * b.cols + q;
          out.re[ri * out.cols + ci] = out.re[ri * out.cols + ci]! + (ar * b.re[p * b.cols + q]! - ai * b.im[p * b.cols + q]!);
          out.im[ri * out.cols + ci] = out.im[ri * out.cols + ci]! + (ar * b.im[p * b.cols + q]! + ai * b.re[p * b.cols + q]!);
        }
      }
    }
  }
  return out;
}
