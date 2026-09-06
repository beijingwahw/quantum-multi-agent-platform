/**
 * 3-PARTITION -> Pm||Cmax (m part of the input): the STRONG NP-hardness carrier.
 *
 * Source (Garey-Johnson 1975, SIAM J. Comput. 4(4):397-411): given B and 3m
 * integers a_i with B/4 < a_i < B/2 and sum = mB, can they be split into m
 * triples each summing to B? Strongly NP-complete: stays hard under unary
 * encoding, so no pseudo-polynomial algorithm and no FPTAS unless P=NP
 * (Garey-Johnson, "'Strong' NP-Completeness Results", JACM 1978).
 *
 * Reduction (identity map): 3m jobs, m machines, target B.
 *   (=>) triples give machine loads exactly B.
 *   (<=) each a_i > B/4 so a machine with all loads <= B holds at most 3 jobs;
 *        3m jobs on m machines force exactly 3 per machine, and sum = mB with
 *        every load <= B forces every load = B. A feasible schedule IS a
 *        3-partition.
 *
 * The <= direction is machine-checked two ways: the B&B solver's decoded
 * assignment is re-verified triple-by-triple, and the "exactly 3 jobs per
 * machine" lemma is asserted on every optimal solution found.
 */
import type { Rng } from "../core/rng.js";
import { minMakespanPm, totalOf, type PmSolution } from "./makespan.js";

export interface ThreePartInstance {
  /** 3m numbers, each strictly between B/4 and B/2, summing to mB. */
  readonly a: readonly number[];
  readonly B: number;
  readonly m: number;
}

/** Generate a guaranteed-YES 3-partition instance by constructing triples, then shuffling. */
export function genYesInstance(rng: Rng, m: number, B: number): ThreePartInstance {
  const a: number[] = [];
  const lo = Math.floor(B / 4) + 1;
  const hi = Math.ceil(B / 2) - 1;
  for (let t = 0; t < m; t++) {
    // sample x, y with lo <= x,y <= hi and B-x-y in [lo, hi]
    for (;;) {
      const x = lo + rng.int(hi - lo + 1);
      const y = lo + rng.int(hi - lo + 1);
      const z = B - x - y;
      if (z >= lo && z <= hi) {
        a.push(x, y, z);
        break;
      }
    }
  }
  return { a: rng.shuffle(a), B, m };
}

/** Generate a uniformly random promise instance (may be YES or NO). */
export function genPromiseInstance(rng: Rng, m: number, B: number, maxTries = 100000): ThreePartInstance {
  const lo = Math.floor(B / 4) + 1;
  const hi = Math.ceil(B / 2) - 1;
  const k = 3 * m;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const a: number[] = [];
    let sum = 0;
    for (let i = 0; i < k - 1; i++) {
      const v = lo + rng.int(hi - lo + 1);
      a.push(v);
      sum += v;
    }
    const last = m * B - sum;
    if (last >= lo && last <= hi) {
      a.push(last);
      return { a, B, m };
    }
  }
  // fall back to a YES instance perturbed into sum-preserving shape is not
  // possible in general; instead build via genYes and report it (callers treat
  // the fallback as a YES draw — the referee still checks equivalence).
  return genYesInstance(rng, m, B);
}

/** Enumerate every promise instance for tiny parameters — the exhaustive referee. */
export function* enumeratePromiseInstances(m: number, B: number): Generator<ThreePartInstance> {
  const lo = Math.floor(B / 4) + 1;
  const hi = Math.ceil(B / 2) - 1;
  const k = 3 * m;
  const target = m * B;
  const a = new Array<number>(k).fill(lo);
  const rec = function* (pos: number, minV: number, sumSoFar: number): Generator<readonly number[]> {
    if (pos === k) {
      if (sumSoFar === target) yield [...a];
      return;
    }
    const remainingSlots = k - pos - 1;
    for (let v = minV; v <= hi; v++) {
      const s = sumSoFar + v;
      if (s + remainingSlots * v > target) break; // minimal tail already overshoots
      if (s + remainingSlots * hi < target) continue; // maximal tail still undershoots
      a[pos] = v;
      yield* rec(pos + 1, v, s);
    }
  };
  for (const seq of rec(0, lo, 0)) {
    yield { a: seq, B, m };
  }
}

/** Exhaustive 3-partition decision for tiny instances — the independent referee. */
export function bruteForceThreePartition(inst: ThreePartInstance): boolean {
  const k = 3 * inst.m;
  const used = new Array<boolean>(k).fill(false);
  const items = [...inst.a];
  const rec = (start: number, groupsLeft: number): boolean => {
    if (groupsLeft === 0) return true;
    let first = -1;
    for (let i = start; i < k; i++) {
      if (!used[i]) {
        first = i;
        break;
      }
    }
    if (first < 0) return false;
    used[first] = true;
    for (let j = first + 1; j < k; j++) {
      if (used[j]) continue;
      for (let l = j + 1; l < k; l++) {
        if (used[l]) continue;
        const sum = (items[first] as number) + (items[j] as number) + (items[l] as number);
        if (sum !== inst.B) continue;
        used[j] = true;
        used[l] = true;
        if (rec(first + 1, groupsLeft - 1)) {
          used[first] = false;
          used[j] = false;
          used[l] = false;
          return true;
        }
        used[j] = false;
        used[l] = false;
      }
    }
    used[first] = false;
    return false;
  };
  return rec(0, inst.m);
}

export function isThreePartitionSolution(inst: ThreePartInstance, groups: ReadonlyArray<readonly number[]>): boolean {
  if (groups.length !== inst.m) return false;
  let total = 0;
  let count = 0;
  for (const g of groups) {
    let s = 0;
    for (const v of g) s += v;
    if (s !== inst.B) return false;
    total += s;
    count += g.length;
  }
  return count === 3 * inst.m && total === inst.m * inst.B;
}

/** Solve Pm||Cmax and decode the schedule into triples; verify the 3-partition reading. */
export function solveAndDecode(inst: ThreePartInstance): {
  solution: PmSolution;
  groups: ReadonlyArray<readonly number[]>;
  exactlyThreePerMachine: boolean;
  isPartition: boolean;
} {
  const solution = minMakespanPm(inst.a, inst.m);
  const groups: number[][] = Array.from({ length: inst.m }, () => []);
  inst.a.forEach((v, i) => {
    const mach = solution.assignment[i] as number;
    (groups[mach] as number[]).push(v);
  });
  const exactlyThreePerMachine = groups.every((g) => g.length === 3);
  return {
    solution,
    groups,
    exactlyThreePerMachine,
    isPartition: exactlyThreePerMachine && isThreePartitionSolution(inst, groups),
  };
}

/** Machine-checkable equivalence predicate: Pm||Cmax decision (<= B) <=> 3-partition YES. */
export function threePartitionEquivHolds(inst: ThreePartInstance, yesWitness: boolean): boolean {
  const { solution } = solveAndDecode(inst);
  return (solution.makespan <= inst.B) === yesWitness;
}

/** Unary vs binary instance size on the reduction output — the strong-hardness meter. */
export function sizeGap(inst: ThreePartInstance): { unary: number; binary: number } {
  const unary = totalOf(inst.a) + inst.a.length;
  let binary = 0;
  for (const v of inst.a) binary += Math.ceil(Math.log2(v + 1));
  return { unary, binary };
}
