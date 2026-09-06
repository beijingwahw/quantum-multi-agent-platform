/**
 * The Groves gauge structure, integer-exact.
 *
 * Setting: agent i, others' bids fixed (dominant-strategy analysis), a finite
 * own-report space reports[0..K-1] with reports[0] = the truthful type v_i.
 * Allocation rule: efficient for the reported profile (unique optimum by the
 * instance guard).
 *
 * Groves payment (h_i a function of others' bids ONLY — a gauge choice):
 *     p_i(b) = h_i - W_-i(x(b))          W_-i(y) = sum_{j != i} b_j(y)
 * Agent utility: U_i(b; v_i) = v_i(x(b)) + W_-i(x(b)) - h_i = Phi_v(x(b)) - h_i
 * with Phi_v(y) = v_i(y) + W_-i(y) the total (reported) welfare at y.
 *
 * The CHARGE: deviation gain D_i(b; v_i) = Phi_v(x(b)) - Phi_v(x(v)) — the
 * WELFARE GAP. It is (a) independent of the gauge h, (b) <= 0 because x(v)
 * maximizes Phi_v, (c) exactly 0 at truthful reporting. This is the
 * conserved/invariant quantity of the gauge symmetry.
 */
import { bestAllocation } from "./instance.js";

export interface GrovesWorld {
  readonly n: number;
  readonly i: number;
  readonly othersBids: ReadonlyArray<readonly number[]>; // in agent order, excluding i
  readonly reports: ReadonlyArray<readonly number[]>; // own-report space; [0] = truthful
}

function profileOf(w: GrovesWorld, report: readonly number[]): number[][] {
  // full bid profile: agent i's row = report, others in order
  const rows: number[][] = [];
  let next = 0;
  for (let a = 0; a < w.n; a++) {
    if (a === w.i) rows.push([...report]);
    else {
      rows.push([...w.othersBids[next] as readonly number[]]);
      next++;
    }
  }
  return rows;
}

/** Efficient allocation + unique-max guard + the runner-up assignment
 * (used by the second-best rule) for the profile induced by report k. */
export function allocationAt(w: GrovesWorld, k: number): { alloc: readonly number[]; allocRunnerUp: readonly number[]; welfare: number; unique: boolean } {
  const agents = Array.from({ length: w.n }, (_, a) => a);
  const res = bestAllocation(profileOf(w, w.reports[k] as readonly number[]), agents);
  return { alloc: res.alloc, allocRunnerUp: res.allocRunnerUp, welfare: res.welfare, unique: res.welfare > res.runnerUp };
}

/** Others' (bid) welfare of an allocation: sum over j != i of bid_j(item of j). */
export function wMinusI(w: GrovesWorld, alloc: readonly number[]): number {
  let s = 0;
  let next = 0;
  for (let a = 0; a < w.n; a++) {
    if (a === w.i) continue;
    s += (w.othersBids[next] as readonly number[])[alloc[a] as number] as number;
    next++;
  }
  return s;
}

/** Clarke pivot gauge: h_i = max_y W_-i(y) (the best others can do alone,
 * over all injective assignments of the n-1 others into the n items). */
export function clarkeH(w: GrovesWorld): number {
  const rows: number[][] = w.othersBids.map((b) => [...b]);
  const agents = rows.map((_, j) => j); // local indices align with rows
  return bestAllocation(rows, agents).welfare;
}

/** Groves payment in gauge h (h depends only on others' bids). */
export function payment(w: GrovesWorld, k: number, h: number): number {
  const { alloc } = allocationAt(w, k);
  return h - wMinusI(w, alloc);
}

/** Agent i's utility of report k under true type reports[0], gauge h. */
export function utility(w: GrovesWorld, k: number, h: number): number {
  const { alloc } = allocationAt(w, k);
  const v = w.reports[0] as readonly number[];
  return (v[alloc[w.i] as number] as number) - payment(w, k, h);
}

/** The charge: deviation gain = welfare gap Phi_v(x(k)) - Phi_v(x(0)). */
export function deviationGain(w: GrovesWorld, k: number, h: number): number {
  return utility(w, k, h) - utility(w, 0, h);
}

/** Welfare-gap form of the charge, computed WITHOUT payments. */
export function welfareGap(w: GrovesWorld, k: number): number {
  const a = allocationAt(w, k);
  const a0 = allocationAt(w, 0);
  const v = w.reports[0] as readonly number[];
  const phi = (alloc: readonly number[]): number =>
    (v[alloc[w.i] as number] as number) + wMinusI(w, alloc);
  return phi(a.alloc) - phi(a0.alloc);
}

/** The exactness identity of Groves payments: dp = -d(W_-i . x) on own-report
 * moves — for every pair (k, k'): p(k') - p(k) + W_-i(x(k')) - W_-i(x(k)) === 0.
 * Integer arithmetic: this is bitwise exact when it holds. */
export function exactnessImbalance(w: GrovesWorld, k: number, kPrime: number, h: number): number {
  return payment(w, kPrime, h) - payment(w, k, h) + wMinusI(w, allocationAt(w, kPrime).alloc) - wMinusI(w, allocationAt(w, k).alloc);
}

/** Potential reconstruction: fixing base 0 and gauge h, the potential
 * P(k) = p(0) + W_-i(x(0)) - W_-i(x(k)) reproduces every Groves payment. */
export function potentialReconstructionError(w: GrovesWorld, k: number, h: number): number {
  const phat = payment(w, 0, h) + wMinusI(w, allocationAt(w, 0).alloc) - wMinusI(w, allocationAt(w, k).alloc);
  return payment(w, k, h) - phat;
}
