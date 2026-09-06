/**
 * Coherent sealed-bid second-price auction (the Hogg-Harsha-Chen 2007 idea,
 * made executable): winner determination runs as a reversible permutation
 * unitary on the bid registers plus ancillae; the ONLY measured registers
 * are the winner index W and the second-price value S. Third-and-lower bids
 * are never read out — the bid registers are returned/erased after the
 * auction (retention schedule), so an honest-but-curious auctioneer's
 * transcript is exactly (winner, price).
 *
 * Registers: B_1..B_n (dim k each) ⊗ W (dim n) ⊗ S (dim k).
 * The comparator maps |b>|0,0> -> |b>|w(b), s(b)> by swapping, inside each
 * b-slice of the (W,S) space, the slot (0,0) with the slot (w(b), s(b)).
 */

import { type CMat, mat } from '../core/cmat.js';
import type { Rng } from '../core/rng.js';
import { type Lock, type LockMode, interceptMeasureResend, lockValue, unlockValue } from './locking.js';

/** Canonical winner: argmax with lowest-index tie-break. */
export function winnerOf(bids: readonly number[]): number {
  let w = 0;
  for (let i = 1; i < bids.length; i++) {
    if (bids[i]! > bids[w]!) w = i;
  }
  return w;
}

/** Second-highest bid value (highest among non-winner bids). */
export function secondOf(bids: readonly number[]): number {
  const w = winnerOf(bids);
  let s = 0;
  for (let i = 0; i < bids.length; i++) {
    if (i === w) continue;
    s = Math.max(s, bids[i]!);
  }
  return s;
}

/** The comparator as an explicit permutation matrix (small n,k only). */
export function comparatorUnitary(n: number, k: number): CMat {
  const dim = k ** n * n * k;
  const u = mat(dim, dim);
  const rowUsed = new Uint8Array(dim);
  const b: number[] = new Array<number>(n).fill(0);
  for (let flat = 0; flat < k ** n; flat++) {
    let x = flat;
    for (let i = n - 1; i >= 0; i--) {
      b[i] = x % k;
      x = Math.floor(x / k);
    }
    const w = winnerOf(b);
    const s = secondOf(b);
    const from = flat * (n * k); // slot (w'=0, s'=0)
    const to = flat * (n * k) + w * k + s;
    u.re[to * dim + from] = 1;
    rowUsed[to] = 1;
    if (from !== to) {
      u.re[from * dim + to] = 1;
      rowUsed[from] = 1;
    }
  }
  for (let i = 0; i < dim; i++) {
    if (!rowUsed[i]) u.re[i * dim + i] = 1;
  }
  return u;
}

/** Outcome distribution when bidder `agentSlot` submits an arbitrary
 * density matrix sigma (dim k) and the others submit basis bids: p(w,s)
 * depends only on the DIAGONAL of sigma — the T1b affine reduction. */
export function outcomeDistribution(
  sigma: CMat,
  others: readonly number[],
  agentSlot: number,
  k: number,
): Map<string, number> {
  const dist = new Map<string, number>();
  for (let r = 0; r < k; r++) {
    const p = sigma.re[r * k + r]!;
    if (p <= 0) continue;
    const bids = [...others];
    bids.splice(agentSlot, 0, r);
    const key = `${winnerOf(bids)},${secondOf(bids)}`;
    dist.set(key, (dist.get(key) ?? 0) + p);
  }
  return dist;
}

/** Expected quasi-linear utility of the agent under the coherent
 * second-price comparator with sigma on their register. */
export function coherentSecondPriceUtility(
  trueValue: number,
  sigma: CMat,
  others: readonly number[],
  agentSlot: number,
  k: number,
): number {
  let u = 0;
  for (const [key, p] of outcomeDistribution(sigma, others, agentSlot, k)) {
    const [w, s] = key.split(',').map(Number);
    if (w === agentSlot) u += p * (trueValue - s!); // keys are self-encoded "w,s" pairs
  }
  return u;
}

// ---------------------------------------------------------------------------
// Full sealed-bid protocol run: lock -> (deadline) -> unlock -> compare ->
// read out (w, s) -> payload checks -> erase junk.
// ---------------------------------------------------------------------------

export interface ProtocolRun {
  winner: number;
  price: number;
  /** payload bit flips introduced by an interceptor (0 on an honest run);
   * every payload qubit doubles as its own check — real deployments would
   * add sacrificial check qubits with the same per-qubit statistics */
  checkErrors: number;
  /** whether the interceptor was detected (any check error) */
  detected: boolean;
  locks: Lock[];
}

/** Full run. Set `intercept: true` to have an adversary measure-and-resend
 * every locked qubit before the deadline. */
export function runSealedBidAuction(
  bids: readonly number[],
  k: number,
  rng: Rng,
  nBases: 2 | 3,
  opts?: { intercept?: boolean; mode?: LockMode },
): ProtocolRun {
  const m = Math.ceil(Math.log2(k));
  const mode: LockMode = opts?.mode ?? 'wiesner';
  const locks: Lock[] = bids.map((b) => lockValue(b, m, rng, nBases, mode));
  if (opts?.intercept) {
    for (const lock of locks) interceptMeasureResend(lock, rng, nBases);
  }
  let checkErrors = 0;
  const payloads: number[] = locks.map((lock, i) => {
    const v = unlockValue(lock);
    if (v !== bids[i]) checkErrors += popcount(v ^ bids[i]!);
    return v;
  });
  return {
    winner: winnerOf(payloads),
    price: secondOf(payloads),
    checkErrors,
    detected: checkErrors > 0,
    locks,
  };
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>= 1;
  }
  return c;
}

export { lockValue, unlockValue, interceptMeasureResend };
