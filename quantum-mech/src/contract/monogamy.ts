/**
 * Monogamy of entanglement as contract exclusivity (CKW inequality,
 * Coffman-Kundu-Wootters 2000; Osborne-Verstraete 2006 for the general
 * qubit case). A "bond" qubit can be near-Bell-entangled with at most ONE
 * escrow: trying to pledge the same qubit to two escrows caps both
 * pairwise entanglements — the physics that makes entanglement usable as
 * collateral.
 */

import { type CMat, kron, mMul } from '../core/cmat.js';
import { PAULI_Y, fromVec, ghz, w3 } from '../core/states.js';
import { partialTrace } from '../core/channels.js';
import { sqrtPSD, eigHermitian } from '../core/cmat.js';
import type { Rng } from '../core/rng.js';
import { randomPureState } from '../core/states.js';

/** Spin-flipped state ρ̃ = (σy⊗σy) ρ* (σy⊗σy). */
function spinFlip(rho: CMat): CMat {
  const d = rho.rows;
  const conj: CMat = { rows: d, cols: d, re: rho.re.slice(), im: rho.im.map((x) => -x) };
  const yy = kron(PAULI_Y, PAULI_Y);
  return mMul(mMul(yy, conj), yy);
}

/** Wootters concurrence of a 2-qubit (possibly mixed) state. */
export function concurrence(rho: CMat): number {
  if (rho.rows !== 4 || rho.cols !== 4) {
    throw new Error(`MONO01-bad-shape: concurrence needs a 4x4 two-qubit density matrix, got ${rho.rows}x${rho.cols}`);
  }
  const sq = sqrtPSD(rho);
  const inner = mMul(mMul(sq, spinFlip(rho)), sq);
  const { values } = eigHermitian(inner);
  const sorted = Array.from(values).sort((a, b) => b - a).map((x) => Math.max(0, x));
  // inner is 4x4, so its spectrum has exactly 4 eigenvalues
  const c = Math.sqrt(sorted[0]!) - Math.sqrt(sorted[1]!) - Math.sqrt(sorted[2]!) - Math.sqrt(sorted[3]!);
  return Math.max(0, c);
}

/** Concurrence of qubit A with the rest (2√det ρ_A) for a pure n-qubit state.
 * Internal machinery of ckw (zero external references — un-exported in the
 * v0.3.0 dead-face sweep; the CKW report is the public surface). */
function concurrenceWithRest(pureRho: CMat, dims: readonly number[], a: number): number {
  const rhoA = partialTrace(pureRho, dims, dims.map((_, i) => i).filter((i) => i !== a));
  // rhoA is a 2x2 reduced density matrix
  const det = rhoA.re[0]! * rhoA.re[3]! - rhoA.re[1]! * rhoA.re[2]!;
  return 2 * Math.sqrt(Math.max(0, det));
}

export interface CkwReport {
  cAB: number;
  cAC: number;
  cABC: number;
  /** three-tangle: C_A(BC)² − C_AB² − C_AC² (≥ 0 by CKW) */
  tangle: number;
}

/** CKW quantities for a pure 3-qubit state. */
export function ckw(pureRho: CMat): CkwReport {
  const dims = [2, 2, 2];
  const rhoAB = partialTrace(pureRho, dims, [2]);
  const rhoAC = partialTrace(pureRho, dims, [1]);
  const cAB = concurrence(rhoAB);
  const cAC = concurrence(rhoAC);
  const cABC = concurrenceWithRest(pureRho, dims, 0);
  return { cAB, cAC, cABC, tangle: cABC ** 2 - cAB ** 2 - cAC ** 2 };
}

/** Anchors: GHZ (tangle = 1, pairwise = 0) and W (tangle = 0, pairwise 2/3). */
export function ckwAnchors(): { ghz: CkwReport; w: CkwReport } {
  return { ghz: ckw(fromVec(ghz(3))), w: ckw(fromVec(w3())) };
}

export interface DoublePledgeSearch {
  /** best min(C_BE1, C_BE2) found */
  bestMin: number;
  /** theoretical ceiling sqrt(1/2) for symmetric double pledges */
  ceiling: number;
  /** witness state amplitudes (8 complex numbers) */
  witness: number[];
  samples: number;
  /** max CKW violation (must be ~0, the inequality is a theorem) */
  maxCkwSlack: number;
}

/** Search the max over pure 3-qubit states of min(C_BE1, C_BE2): a bond
 * qubit B trying to entangle with two escrows at once. CKW caps the
 * symmetric optimum at C = √(1/2) each — versus C = 1 for an exclusive
 * Bell pledge. Random search over pure states + slack monitoring. */
export function searchDoublePledge(rng: Rng, samples = 20000): DoublePledgeSearch {
  let bestMin = 0;
  let witness: number[] = [];
  let maxCkwSlack = -Infinity;
  for (let t = 0; t < samples; t++) {
    const psi = randomPureState(8, rng);
    const rho = fromVec(psi);
    const r = ckw(rho);
    // the INEQUALITY is C_AB² + C_AC² ≤ C_ABC²; record how close we get to
    // violating it (should stay ≤ 0 up to numerical noise)
    maxCkwSlack = Math.max(maxCkwSlack, r.cAB ** 2 + r.cAC ** 2 - r.cABC ** 2);
    const m = Math.min(r.cAB, r.cAC);
    if (m > bestMin) {
      bestMin = m;
      witness = [...psi.re, ...psi.im];
    }
  }
  return {
    bestMin,
    ceiling: Math.sqrt(0.5),
    witness,
    samples,
    maxCkwSlack,
  };
}

/** Constructive family scan: ψ_x = √x|100⟩ + √((1−x)/2)(|010⟩+|001⟩)
 * gives symmetric C_BE1 = C_BE2; the maximum of the minimum sits at the
 * CKW ceiling C = 1/√2 — random search alone converges slowly toward it. */
export function doublePledgeFamilyScan(steps = 400): { x: number; minC: number; cBoth: [number, number] } {
  let best = { x: 0, minC: 0, cBoth: [0, 0] as [number, number] };
  for (let i = 1; i < steps; i++) {
    const x = i / steps;
    const psi = {
      n: 8,
      re: Float64Array.of(0, Math.sqrt((1 - x) / 2), Math.sqrt((1 - x) / 2), 0, Math.sqrt(x), 0, 0, 0),
      im: new Float64Array(8),
    };
    const r = ckw(fromVec(psi));
    const minC = Math.min(r.cAB, r.cAC);
    if (minC > best.minC) best = { x, minC, cBoth: [r.cAB, r.cAC] };
  }
  return best;
}

/** Bell fidelity ⟨Φ+|ρ|Φ+⟩ of a 2-qubit state — the quantity an escrow's
 * verification test estimates with sacrificial pairs. */
export function bellFidelity(rho2q: CMat): number {
  const phi = { n: 4, re: Float64Array.of(Math.SQRT1_2, 0, 0, Math.SQRT1_2), im: new Float64Array(4) };
  const rho = fromVec(phi);
  let f = 0;
  for (let k = 0; k < 16; k++) f += rho.re[k]! * rho2q.re[k]! + rho.im[k]! * rho2q.im[k]!;
  return f;
}
