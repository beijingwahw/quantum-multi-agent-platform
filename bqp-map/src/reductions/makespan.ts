/**
 * Exact solvers for makespan minimization on identical parallel machines.
 *
 * P2||Cmax  : subset-sum reachability DP, pseudo-polynomial in the total
 *             processing time — the algorithm that exists *because* the
 *             NP-hardness of P2||Cmax is only weak (Garey-Johnson 1975).
 * Pm||Cmax  : branch-and-bound with sorted-load symmetry breaking and a
 *             best-known incumbent; exact, exponential in the worst case —
 *             the honest face of strong NP-hardness (no pseudo-polynomial
 *             escape unless P=NP).
 */

export function totalOf(nums: readonly number[]): number {
  let s = 0;
  for (const x of nums) s += x;
  return s;
}

/** Exact optimal makespan for 2 identical machines (subset-sum DP). */
export function minMakespanP2(nums: readonly number[]): number {
  const total = totalOf(nums);
  const reach = new Uint8Array(total + 1);
  reach[0] = 1;
  for (const a of nums) {
    for (let s = total; s >= a; s--) {
      if (reach[s - a] === 1) reach[s] = 1;
    }
  }
  const half = Math.ceil(total / 2);
  for (let s = half; s <= total; s++) {
    if (reach[s] === 1) return s; // load0 = s >= total/2 => makespan = s
  }
  return total; // unreachable for non-empty inputs; defensive
}

export interface PmSolution {
  makespan: number;
  assignment: readonly number[]; // job -> machine
  nodes: number; // B&B nodes explored (reported as the exponential-tuition meter)
}

/**
 * Exact optimal makespan for m identical machines (branch-and-bound).
 * Jobs are assigned largest-first; equal-load branches are deduplicated.
 */
export function minMakespanPm(nums: readonly number[], m: number): PmSolution {
  const order = nums.map((p, i) => ({ p, i })).sort((x, y) => y.p - x.p);
  const loads = new Array<number>(m).fill(0);
  const assignment = new Array<number>(nums.length).fill(0); // by sorted position
  const bestAssignment = new Array<number>(nums.length).fill(0);
  const state = { best: Infinity, nodes: 0 };
  const seen = new Set<string>();

  const key = (i: number): string => {
    const tail = loads.slice();
    tail.sort((a, b) => b - a);
    return `${i}|${tail.join(",")}`;
  };

  const dfs = (i: number, runningMax: number): void => {
    if (runningMax >= state.best) return;
    if (i === order.length) {
      state.best = runningMax;
      for (let j = 0; j < assignment.length; j++) bestAssignment[j] = assignment[j] as number;
      return;
    }
    const k = key(i);
    if (seen.has(k)) return;
    seen.add(k);
    state.nodes++;
    const p = (order[i] as { p: number; i: number }).p;
    const tried = new Set<number>();
    for (let mach = 0; mach < m; mach++) {
      const l = loads[mach] as number;
      if (tried.has(l)) continue; // symmetric branch: same load, same subtree
      tried.add(l);
      loads[mach] = l + p;
      assignment[i] = mach;
      dfs(i + 1, Math.max(runningMax, l + p));
      loads[mach] = l;
    }
  };

  dfs(0, 0);
  const restored = new Array<number>(nums.length).fill(0);
  for (let i = 0; i < order.length; i++) {
    restored[(order[i] as { p: number; i: number }).i] = bestAssignment[i] as number;
  }
  return { makespan: state.best, assignment: restored, nodes: state.nodes };
}

/** Brute-force Pm||Cmax over all m^n assignments — the exhaustive referee for tiny instances. */
export function bruteForceMakespanPm(nums: readonly number[], m: number): number {
  const n = nums.length;
  let best = Infinity;
  const total = m ** n;
  for (let code = 0; code < total; code++) {
    const loads = new Array<number>(m).fill(0);
    let c = code;
    for (let i = 0; i < n; i++) {
      loads[c % m] = loads[c % m]! + (nums[i] as number);
      c = Math.floor(c / m);
    }
    let mx = 0;
    for (const l of loads) mx = Math.max(mx, l);
    if (mx < best) best = mx;
  }
  return best;
}
