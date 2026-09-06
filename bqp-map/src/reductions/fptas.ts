/**
 * FPTAS for P2||Cmax — the executable half of the weak/strong dichotomy.
 *
 * Weakly NP-hard problems (Partition-like) admit pseudo-polynomial DPs AND
 * polynomial approximation schemes; strongly NP-hard ones admit neither
 * (Garey-Johnson, JACM 1978: strong NP-hardness + FPTAS => P = NP).
 * This module implements the classic scaling FPTAS and exposes its
 * (1+eps)-guarantee to machine verification against the exact DP.
 */
import { minMakespanP2, totalOf } from "./makespan.js";

/**
 * Scaling FPTAS for P2||Cmax: round p_i -> floor(p_i / K) with
 * K = eps * total / (2n), solve the scaled instance exactly by DP, then lift
 * the chosen subset back to original weights.
 * Returns the makespan of the lifted schedule (a real, schedulable value).
 */
export function fptasP2(nums: readonly number[], eps: number): number {
  if (nums.length === 0) return 0;
  const total = totalOf(nums);
  if (eps <= 0) {
    throw new Error("eps must be positive (exact solving is minMakespanP2's job)");
  }
  const n = nums.length;
  const K = (eps * total) / (2 * n);
  if (K <= 0) return minMakespanP2(nums); // degenerate tiny instance: exact is fine
  const scaled = nums.map((p) => Math.max(1, Math.floor(p / K)));
  const scaledTotal = totalOf(scaled);

  // exact DP on scaled weights, tracking an actual subset (for lifting)
  const reach = new Uint8Array(scaledTotal + 1);
  const take = new Uint8Array(n * (scaledTotal + 1));
  reach[0] = 1;
  for (let i = 0; i < n; i++) {
    const a = scaled[i] as number;
    for (let s = scaledTotal; s >= a; s--) {
      if (reach[s - a] === 1 && reach[s] === 0) {
        reach[s] = 1;
        take[i * (scaledTotal + 1) + s] = 1;
      }
    }
  }
  const half = Math.ceil(scaledTotal / 2);
  let sBest = scaledTotal;
  for (let s = half; s <= scaledTotal; s++) {
    if (reach[s] === 1) {
      sBest = s;
      break;
    }
  }
  // walk back the subset
  const chosen = new Array<boolean>(n).fill(false);
  let s = sBest;
  for (let i = n - 1; i >= 0; i--) {
    if (take[i * (scaledTotal + 1) + s] === 1) {
      chosen[i] = true;
      s -= scaled[i] as number;
    }
  }
  let load = 0;
  for (let i = 0; i < n; i++) if (chosen[i]) load += nums[i] as number;
  return Math.max(load, total - load);
}

/** Approximation ratio of the FPTAS output against the exact optimum. */
export function fptasRatio(nums: readonly number[], eps: number): number {
  return fptasP2(nums, eps) / minMakespanP2(nums);
}
