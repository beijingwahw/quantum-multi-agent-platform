/**
 * Exact DTMC referee for the canonical saturated 2-link chain (one request,
 * one memory slot per link, swap-asap, no purification), mirroring the
 * engine's round order exactly:
 *
 *   cutoff (age > K dropped) → attempts (empty link fills w.p. p, age 0)
 *   → swap when both present (success q → delivery) → ages tick.
 *
 * State (a₁, a₂) = pair ages at round start (0 = empty, 1..K live, K+1
 * pending-discard). With T₂ = ∞ and no cutoff, fidelity is age-independent
 * and the chain collapses to the 4-state {empty, full}² chain — the classical
 * textbook repeater-link model. Stationary distribution is solved exactly by
 * Gaussian elimination, so engine-vs-chain agreement is a property of the
 * ENGINE, not of the solver.
 */

import { werner } from "../physics/bell.js";
import { agePair, swapBell } from "../physics/ops.js";

export interface ChainParams {
  readonly p1: number;
  readonly p2: number;
  readonly qSwap: number;
  readonly f01: number;
  readonly f02: number;
  /** Memory depolarization constant (rounds); undefined = perfect memory. */
  readonly t2?: number;
  /** Cutoff in rounds (discard when age > cutOff); required for the age chain. */
  readonly cutOff?: number;
}

export interface ChainResult {
  /** Steady-state delivered pairs per round (all fidelities). */
  readonly deliveryRate: number;
  /** Mean fidelity of delivered pairs. */
  readonly meanFidelity: number;
  readonly stateCount: number;
}

export function twoLinkChain(params: ChainParams): ChainResult {
  const { p1, p2, qSwap, f01, f02 } = params;
  const t2 = params.t2 ?? Number.POSITIVE_INFINITY;
  const cut = params.cutOff;
  if (cut === undefined && Number.isFinite(t2)) {
    throw new Error("twoLinkChain: finite T₂ without cutoff makes the state space infinite");
  }
  const ageless = !Number.isFinite(t2) && cut === undefined;
  const maxAge = ageless ? 1 : (cut as number) + 1; // 0..maxAge inclusive
  const dim = (maxAge + 1) * (maxAge + 1);
  const idx = (a1: number, a2: number): number => a1 * (maxAge + 1) + a2;
  const P: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  const deliveryProb = new Array<number>(dim).fill(0);
  const deliveryF = new Array<number>(dim).fill(0);

  const fidelityOf = (a1: number, a2: number): number => {
    const v1 = agePair(werner(f01), a1, a1, t2);
    const v2 = agePair(werner(f02), a2, a2, t2);
    return swapBell(v1, v2)[0]!; // swapBell returns a length-4 vector
  };

  for (let a1 = 0; a1 <= maxAge; a1++) {
    for (let a2 = 0; a2 <= maxAge; a2++) {
      const s = idx(a1, a2);
      const row = P[s]!; // P has exactly dim rows, s < dim by idx()
      // step 1: cutoff drops pairs older than K (or any pair in the ageless
      // chain is live; ages collapse to 1)
      const live1 = ageless ? a1 >= 1 : a1 >= 1 && a1 <= (cut as number);
      const live2 = ageless ? a2 >= 1 : a2 >= 1 && a2 <= (cut as number);
      const age1 = live1 ? (ageless ? 0 : a1) : -1;
      const age2 = live2 ? (ageless ? 0 : a2) : -1;

      // step 2: attempts fill empty links; new pair has age 0 this round
      const fill1 = [age1]; // stay (if live)
      if (age1 < 0) fill1.push(0);
      const probs1 = age1 < 0 ? [1 - p1, p1] : [1];
      const fill2 = age2 < 0 ? [-1, 0] : [age2];
      const probs2 = age2 < 0 ? [1 - p2, p2] : [1];

      // probs1/probs2 are built parallel to fill1/fill2 (same lengths, same
      // branches), so the loop bounds below prove both index sets in range
      for (let i = 0; i < fill1.length; i++) {
        for (let j = 0; j < fill2.length; j++) {
          const w = probs1[i]! * probs2[j]!;
          const b1 = fill1[i]!;
          const b2 = fill2[j]!;
          if (b1 >= 0 && b2 >= 0) {
            // step 3: swap consumes both regardless of outcome
            deliveryProb[s] = deliveryProb[s]! + w * qSwap;
            deliveryF[s] = deliveryF[s]! + w * qSwap * fidelityOf(b1, b2);
            row[idx(0, 0)] = row[idx(0, 0)]! + w;
          } else {
            // step 4: survivors age one round (may exceed K → dropped next start)
            const n1 = b1 >= 0 ? (ageless ? 1 : b1 + 1) : 0;
            const n2 = b2 >= 0 ? (ageless ? 1 : b2 + 1) : 0;
            const t = idx(Math.min(n1, maxAge), Math.min(n2, maxAge));
            row[t] = row[t]! + w;
          }
        }
      }
    }
  }

  const pi = stationary(P);
  let rate = 0;
  let fSum = 0;
  for (let s = 0; s < dim; s++) {
    rate += pi[s]! * deliveryProb[s]!; // all three arrays have length dim
    fSum += pi[s]! * deliveryF[s]!;
  }
  return {
    deliveryRate: rate,
    meanFidelity: rate > 0 ? fSum / rate : Number.NaN,
    stateCount: dim,
  };
}

/** Stationary distribution of an irreducible finite chain via Gaussian elimination. */
function stationary(P: number[][]): number[] {
  const n = P.length;
  // solve πᵀP = π with Σπ = 1: rows are (Pᵀ − I) except last row = all ones
  const A: number[][] = [];
  for (let c = 0; c < n; c++) {
    const row = new Array<number>(n + 1).fill(0);
    for (let r = 0; r < n; r++) row[r] = P[r]![c]! - (r === c ? 1 : 0); // r, c < n
    A.push(row);
  }
  A[n - 1] = new Array<number>(n + 1).fill(1);
  A[n - 1]![n] = 1;
  // Gaussian elimination with partial pivoting (all indices kept < n by the
  // loop bounds; A has exactly n rows of length n + 1)
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(A[r]![col]!) > Math.abs(A[piv]![col]!)) piv = r;
    [A[col], A[piv]] = [A[piv]!, A[col]!];
    const d = A[col]![col]!;
    if (Math.abs(d) < 1e-14) throw new Error("stationary: singular chain");
    for (let r = col + 1; r < n; r++) {
      const rowR = A[r]!;
      const f = rowR[col]! / d;
      if (f === 0) continue;
      const rowC = A[col]!;
      for (let c = col; c <= n; c++) rowR[c] = rowR[c]! - f * rowC[c]!;
    }
  }
  const pi = new Array<number>(n).fill(0);
  pi[n - 1] = A[n - 1]![n]! / A[n - 1]![n - 1]!;
  for (let r = n - 2; r >= 0; r--) {
    const row = A[r]!;
    let acc = row[n]!;
    for (let c = r + 1; c < n; c++) acc -= row[c]! * pi[c]!;
    pi[r] = acc / row[r]!;
  }
  return pi;
}
