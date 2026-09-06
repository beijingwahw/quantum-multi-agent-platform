/**
 * PARTITION -> P2||Cmax : the weak NP-hardness carrier.
 *
 * Source problem (Karp 1972 / Garey-Johnson): given a_1..a_n, does some subset
 * S satisfy sum(S) = sum(complement) = total/2?
 *
 * Reduction (identity map): n jobs with p_i = a_i on 2 machines, target B = total/2.
 * Soundness: every schedule has C_max >= total/2 (total load bound).
 * Completeness: a partition yields a schedule with C_max = total/2.
 * Hence  P2decision(<= B)  <=>  PARTITION is YES  (for even totals).
 *
 * Everything below is executable so the equivalence is machine-checked rather
 * than cited: partitionYes runs the subset-sum DP, minMakespanP2 is the exact
 * solver of the target problem, and the referee asserts equality on random and
 * exhaustively enumerated instances.
 */
import { minMakespanP2, totalOf } from "./makespan.js";

export function partitionYes(nums: readonly number[]): boolean {
  const total = totalOf(nums);
  if (total % 2 !== 0) return false;
  const half = total / 2;
  const reach = new Uint8Array(half + 1);
  reach[0] = 1;
  for (const a of nums) {
    for (let s = half; s >= a; s--) {
      if (reach[s - a] === 1) reach[s] = 1;
    }
  }
  return reach[half] === 1;
}

/** The reduction itself: PARTITION instance -> P2||Cmax decision instance. */
export function reducePartitionToP2(nums: readonly number[]): { p: readonly number[]; B: number } {
  const total = totalOf(nums);
  if (total % 2 !== 0) {
    throw new Error("reduction source must have even total (odd totals are trivially NO)");
  }
  return { p: nums, B: total / 2 };
}

/** Machine-checkable equivalence predicate for one instance. */
export function partitionEquivHolds(nums: readonly number[]): boolean {
  const total = totalOf(nums);
  if (total % 2 !== 0) return true; // excluded by the reduction's precondition
  const { B } = reducePartitionToP2(nums);
  return partitionYes(nums) === (minMakespanP2(nums) <= B);
}
