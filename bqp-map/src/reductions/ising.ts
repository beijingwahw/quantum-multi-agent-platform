/**
 * P2||Cmax -> Ising: the encoding the platform's quantum backends consume,
 * made machine-checkable.
 *
 * With z_i in {+1,-1} (job i on machine 0 or 1):
 *   sum_i a_i z_i = load0 - load1 = 2*load0 - total
 *   makespan(z) = (total + |sum_i a_i z_i|) / 2
 * so minimizing the makespan IS minimizing the quadratic form
 *   Q(z) = (sum_i a_i z_i)^2 = sum_{i,j} a_i a_j z_i z_j,
 * a diagonal (ZZ + field) Ising Hamiltonian. Identity per configuration:
 *   Q(z) = (2*makespan(z) - total)^2   — exact, integers throughout.
 */
import { minMakespanP2, totalOf } from "./makespan.js";

export interface IsingModel {
  /** J[i][j] with i < j: coupling a_i * a_j (note: no 1/2 — Q = sum_{i<j} 2*J_ij z_i z_j + diag). */
  readonly couplings: ReadonlyArray<{ i: number; j: number; J: number }>;
  /** Linear field h_i = a_i^2 (the diagonal of the quadratic form). */
  readonly fields: readonly number[];
  readonly nums: readonly number[];
}

export function partitionToIsing(nums: readonly number[]): IsingModel {
  const couplings: Array<{ i: number; j: number; J: number }> = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      couplings.push({ i, j, J: (nums[i] as number) * (nums[j] as number) });
    }
  }
  return { couplings, fields: nums.map((a) => a * a), nums };
}

/** Q(z) as the full quadratic form (diagonal counted once). */
export function isingValue(model: IsingModel, z: readonly number[]): number {
  let v = 0;
  for (const { i, j, J } of model.couplings) v += 2 * J * (z[i] as number) * (z[j] as number);
  for (let i = 0; i < z.length; i++) v += (model.fields[i] as number) * (z[i] as number) * (z[i] as number);
  return v;
}

export function sigmaSum(nums: readonly number[], z: readonly number[]): number {
  let v = 0;
  for (let i = 0; i < nums.length; i++) v += (nums[i] as number) * (z[i] as number);
  return v;
}

/** makespan of the schedule encoded by z (z_i = +1 -> machine 0). */
export function makespanOfZ(nums: readonly number[], z: readonly number[]): number {
  const total = totalOf(nums);
  return (total + Math.abs(sigmaSum(nums, z))) / 2;
}

/** Per-configuration identity Q(z) = (2*C(z) - total)^2. */
export function isingIdentityHolds(nums: readonly number[], z: readonly number[]): boolean {
  const model = partitionToIsing(nums);
  const total = totalOf(nums);
  return isingValue(model, z) === (2 * makespanOfZ(nums, z) - total) ** 2;
}

/** Brute-force ground state of Q over all z; cross-checked against the exact DP optimum. */
export function isingGroundState(nums: readonly number[]): { minQ: number; argmin: readonly number[] } {
  const model = partitionToIsing(nums);
  let minQ = Infinity;
  let argmin: number[] = [];
  const n = nums.length;
  for (let code = 0; code < 2 ** n; code++) {
    const z: number[] = [];
    for (let i = 0; i < n; i++) z.push((code >> i) & 1 ? 1 : -1);
    const v = isingValue(model, z);
    if (v < minQ) {
      minQ = v;
      argmin = z;
    }
  }
  return { minQ, argmin };
}

/** Ground-state parity: sqrt(min Q) = 2*OPT - total when a perfect split exists; identity generally. */
export function isingGroundStateParity(nums: readonly number[]): boolean {
  const total = totalOf(nums);
  const { minQ } = isingGroundState(nums);
  const opt = minMakespanP2(nums);
  return Math.sqrt(minQ) === Math.abs(2 * opt - total);
}
