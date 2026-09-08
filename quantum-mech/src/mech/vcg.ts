/**
 * VCG for the assignment problem (n agents x n tasks), plus the approximate-
 * allocator hazard: if the mechanism computes allocations with ANY solver
 * other than the exact argmax (a heuristic, an approximate QAOA, a sampled
 * annealer), Groves payments lose DSIC. The search functions find concrete
 * profitable misreports — Theorem T5, the incentive wall behind the
 * platform's "provably exact solver" positioning.
 */

import type { Rng } from '../core/rng.js';

export type ValueMatrix = number[][]; // v[agent][task]

/** All permutations of n tasks via Heap's algorithm. */
export function permutations(n: number): number[][] {
  const out: number[][] = [];
  const arr = Array.from({ length: n }, (_, i) => i);
  const c = new Array<number>(n).fill(0);
  out.push([...arr]);
  let i = 0;
  while (i < n) {
    if (c[i]! < i) {
      if (i % 2 === 0) {
        [arr[0], arr[i]] = [arr[i]!, arr[0]!];
      } else {
        [arr[c[i]!], arr[i]] = [arr[i]!, arr[c[i]!]!];
      }
      out.push([...arr]);
      c[i] = c[i]! + 1;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
  return out;
}

export function welfare(v: ValueMatrix, alloc: readonly number[]): number {
  let s = 0;
  // alloc is a permutation of task indices, one per agent row
  for (let a = 0; a < v.length; a++) s += v[a]![alloc[a]!]!;
  return s;
}

/** Exact max-welfare allocation (brute force over permutations). */
export function optimalAllocation(v: ValueMatrix): { alloc: number[]; value: number } {
  if (v.length === 0) {
    throw new Error('VCG01-empty-matrix: optimalAllocation needs a nonempty value matrix');
  }
  const T = v[0]!.length;
  if (T === 0 || v.some((row) => row.length !== T)) {
    throw new Error(`VCG02-bad-shape: optimalAllocation needs a rectangular value matrix, got ${v.length}x${v.map((r) => r.length).join('/')}`);
  }
  const perms = permutations(v.length);
  // permutations() always returns at least the identity permutation
  let best = perms[0]!;
  let bestW = -Infinity;
  for (const p of perms) {
    const w = welfare(v, p);
    if (w > bestW) {
      bestW = w;
      best = p;
    }
  }
  return { alloc: [...best], value: bestW };
}

/** Max total welfare of the agents EXCLUDING agent i (they may take any
 * distinct tasks among themselves; unused tasks are dropped). */
function othersMaxWelfare(v: ValueMatrix, i: number): number {
  const others = v.map((row, a) => (a === i ? null : row)).filter((r): r is number[] => r !== null);
  const n = others.length; // agents
  const T = v.length; // tasks
  // dp over subsets of tasks: too big for T > ~12? here n,T <= 4 — brute force perms of size min(n,T)
  if (n === 0) return 0;
  let best = -Infinity;
  const rec = (agent: number, usedMask: number, acc: number): void => {
    if (agent === n) {
      best = Math.max(best, acc);
      return;
    }
    for (let t = 0; t < T; t++) {
      if (usedMask & (1 << t)) continue;
      rec(agent + 1, usedMask | (1 << t), acc + others[agent]![t]!);
    }
  };
  rec(0, 0, 0);
  return best;
}

/** Groves/VCG payments: p_i = h_i(v_-i) - sum_{j != i} v_j(a*). */
export function vcgPayments(v: ValueMatrix, alloc: readonly number[]): number[] {
  const n = v.length;
  const p: number[] = [];
  for (let i = 0; i < n; i++) {
    let othersWelfareAtAlloc = 0;
    for (let j = 0; j < n; j++) {
      if (j !== i) othersWelfareAtAlloc += v[j]![alloc[j]!]!;
    }
    p.push(othersMaxWelfare(v, i) - othersWelfareAtAlloc);
  }
  return p;
}

export function vcgUtilities(v: ValueMatrix, alloc: readonly number[]): number[] {
  const p = vcgPayments(v, alloc);
  // p has one payment per agent (length matches v)
  return v.map((row, i) => row[alloc[i]!]! - p[i]!);
}

/** Allocator interface: any function from reports to an allocation. */
export type Allocator = (reports: ValueMatrix) => number[];

/** Exact argmax allocator. */
export const exactAllocator: Allocator = (r) => optimalAllocation(r).alloc;

/** Perturbed allocator: optimal allocation composed with `d` random
 * transpositions — a stand-in for approximate/heuristic/quantum-annealer
 * solvers whose output quality degrades. */
export function perturbedAllocator(d: number, rng: Rng): Allocator {
  return (r) => {
    const { alloc } = optimalAllocation(r);
    const out = [...alloc];
    for (let t = 0; t < d; t++) {
      const i = rng.int(out.length);
      const j = rng.int(out.length);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
}

/** Greedy allocator: agents in index order, each takes their highest-valued
 * remaining task (lowest index on ties). A SECOND solver family for the T5
 * census — not "optimum + noise" but the plain heuristic an approximate
 * classical or quantum solver would output on its own. */
export const greedyAllocator: Allocator = (r) => {
  const T = r[0]!.length;
  if (r.some((row) => row.length !== T)) throw new Error('VCG03-nonsquare: greedyAllocator: square value matrix required');
  const used = new Array<boolean>(T).fill(false);
  const alloc: number[] = [];
  for (const row of r) {
    let best = -1;
    let bestV = -Infinity;
    for (let t = 0; t < T; t++) {
      if (used[t]!) continue;
      if (row[t]! > bestV) {
        bestV = row[t]!;
        best = t;
      }
    }
    if (best < 0) throw new Error('VCG04-more-agents: greedyAllocator: more agents than tasks');
    alloc.push(best);
    used[best] = true;
  }
  return alloc;
};

export interface GainWitness {
  agent: number;
  truthfulReport: number[];
  misreport: number[];
  gain: number;
}

/** Search for a profitable misreport under a given allocator with Groves
 * payments computed FROM the allocator's output (the "computationally
 * feasible VCG" trap). Reports come from a value grid. */
export function searchDsicViolation(
  v: ValueMatrix,
  allocator: Allocator,
  grid: readonly number[],
): GainWitness | null {
  const n = v.length;
  if (n === 0) throw new Error('VCG05-empty-matrix: searchDsicViolation: value matrix must not be empty');
  const T = v[0]!.length;
  const truthfulAlloc = allocator(v);
  const truthfulPay = vcgPayments(v, truthfulAlloc);
  const found: { w: GainWitness | null } = { w: null };
  const hasWin = (): boolean => found.w !== null && found.w.gain > 1e-9;
  // check single-agent deviations (sufficient to break DSIC)
  for (let i = 0; i < n; i++) {
    const truthfulUtil = v[i]![truthfulAlloc[i]!]! - truthfulPay[i]!;
    const enumerate = (task: number, current: number[]): void => {
      if (hasWin()) return;
      if (task === T) {
        if (current.every((x, idx) => x === v[i]![idx]!)) return; // skip truthful
        const reports = v.map((row, a) => (a === i ? [...current] : [...row]));
        const alloc = allocator(reports);
        const pay = vcgPayments(reports, alloc);
        const util = v[i]![alloc[i]!]! - pay[i]!;
        const gain = util - truthfulUtil;
        if (gain > 1e-9 && (found.w === null || gain > found.w.gain)) {
          found.w = { agent: i, truthfulReport: [...v[i]!], misreport: [...current], gain };
        }
        return;
      }
      for (const g of grid) {
        current.push(g);
        enumerate(task + 1, current);
        current.pop();
      }
    };
    enumerate(0, []);
    if (hasWin()) return found.w;
  }
  return found.w;
}
