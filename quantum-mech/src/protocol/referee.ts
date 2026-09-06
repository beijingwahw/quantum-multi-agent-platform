/**
 * Independent density-matrix referee for the coherent comparator: checks
 * unitarity, basis-state correctness against the classical winner/second
 * functions, and validates the diagonal-only outcome-distribution formula
 * against a full density-matrix computation with arbitrary mixed inputs.
 */

import { type CMat, isUnitary, mat, mMul, mDagger, kronAll, basisVec } from '../core/cmat.js';
import { fromVec } from '../core/states.js';
import { marginalProbs, applyUnitary } from '../core/channels.js';
import { comparatorUnitary, outcomeDistribution, secondOf, winnerOf } from './auction.js';

/** Maximum |U†U − I| entry. */
export function comparatorUnitarityError(n: number, k: number): number {
  const u = comparatorUnitary(n, k);
  const prod = mMul(mDagger(u), u);
  const d = u.rows;
  let err = 0;
  for (let idx = 0; idx < d * d; idx++) {
    const want = Math.floor(idx / d) === idx % d ? 1 : 0;
    err = Math.max(err, Math.abs(prod.re[idx]! - want), Math.abs(prod.im[idx]!));
  }
  return err;
}

/** Assert the comparator maps every basis-encoded bid profile to the right
 * (winner, second) slot: max deviation over all profiles. */
export function comparatorBasisError(n: number, k: number): number {
  const u = comparatorUnitary(n, k);
  const dim = u.rows;
  const dims = [...Array<number>(n).fill(k), n, k];
  let err = 0;
  const b: number[] = new Array<number>(n).fill(0)
  for (let flat = 0; flat < k ** n; flat++) {
    let x = flat;
    for (let i = n - 1; i >= 0; i--) {
      b[i] = x % k;
      x = Math.floor(x / k);
    }
    const input = basisVec(dim, flat * (n * k)); // |b>|0,0>
    const rhoIn = fromVec(input);
    const rhoOut = applyUnitary(rhoIn, u);
    const { probs } = marginalProbs(rhoOut, dims, [n, n + 1]);
    const want = winnerOf(b) * k + secondOf(b);
    // probability mass on the correct (w,s) slot
    let mass = 0;
    for (let o = 0; o < probs.length; o++) {
      if (o === want) mass += probs[o]!;
      else if (probs[o]! > 1e-12) err = Math.max(err, probs[o]!);
    }
    err = Math.max(err, Math.abs(1 - mass));
  }
  return err;
}

/** Full density-matrix validation of the T1b diagonal formula: with a
 * mixed sigma on the agent's register, the (w,s) marginal computed by
 * matrix mechanics must equal outcomeDistribution(). */
export function distributionFormulaError(
  sigma: CMat,
  others: readonly number[],
  agentSlot: number,
  k: number,
): number {
  const n = others.length + 1;
  if (!Number.isInteger(agentSlot) || agentSlot < 0 || agentSlot >= n) {
    throw new Error(`distributionFormulaError: agentSlot ${agentSlot} out of range for ${n} agents`);
  }
  const dims = [...Array<number>(n).fill(k), n, k];
  // assemble sigma_i ⊗ (others' basis states) ⊗ |0,0><0,0| on W,S
  const kets = [];
  for (let i = 0; i < n; i++) {
    if (i === agentSlot) kets.push(null);
    // agentSlot validated above, so the others index is always in range
    else kets.push(basisVec(k, others[i < agentSlot ? i : i - 1]!));
  }
  const zeroW = basisVec(n, 0);
  const zeroS = basisVec(k, 0);
  const pieces: CMat[] = [];
  let acc: CMat | null = null;
  for (let i = 0; i < n; i++) {
    const piece = i === agentSlot ? sigma : fromVec(kets[i]!);
    acc = acc === null ? piece : kron2(acc, piece);
  }
  pieces.push(acc!);
  pieces.push(fromVec(zeroW));
  pieces.push(fromVec(zeroS));
  const rhoIn = kronAll(pieces);
  const u = comparatorUnitary(n, k);
  const rhoOut = applyUnitary(rhoIn, u);
  const { probs } = marginalProbs(rhoOut, dims, [n, n + 1]);
  const formula = outcomeDistribution(sigma, others, agentSlot, k);
  let err = 0;
  for (let w = 0; w < n; w++) {
    for (let s = 0; s < k; s++) {
      const pMatrix = probs[w * k + s]!;
      const pFormula = formula.get(`${w},${s}`) ?? 0;
      err = Math.max(err, Math.abs(pMatrix - pFormula));
    }
  }
  return err;
}

function kron2(a: CMat, b: CMat): CMat {
  const m = mat(a.rows * b.rows, a.cols * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const ar = a.re[i * a.cols + j]!;
      const ai = a.im[i * a.cols + j]!;
      for (let p = 0; p < b.rows; p++) {
        for (let q = 0; q < b.cols; q++) {
          const br = b.re[p * b.cols + q]!;
          const bi = b.im[p * b.cols + q]!;
          const ri = i * b.rows + p;
          const ci = j * b.cols + q;
          m.re[ri * m.cols + ci] = m.re[ri * m.cols + ci]! + (ar * br - ai * bi);
          m.im[ri * m.cols + ci] = m.im[ri * m.cols + ci]! + (ar * bi + ai * br);
        }
      }
    }
  }
  return m;
}

export { isUnitary };
