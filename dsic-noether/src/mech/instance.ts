/**
 * Assignment instances: n agents, n items, integer valuations. The efficient
 * allocation is computed by full permutation enumeration (n <= 4), so all
 * welfare arithmetic is integer-exact — every Groves identity below is then
 * bitwise exact, which is the point of this prototype.
 */
import type { Rng } from "../core/rng.js";
import { KernelError } from "../core/errors.js";

export interface Instance {
  readonly n: number;
  /** values[agent][item], integers */
  readonly values: ReadonlyArray<readonly number[]>;
}

/** All permutations of {0..n-1} (allocations: agent i gets item perm[i]). */
export function permutations(n: number): number[][] {
  const out: number[][] = [];
  const arr = Array.from({ length: n }, (_, i) => i);
  const recurse = (k: number): void => {
    if (k === n) {
      out.push([...arr]);
      return;
    }
    for (let i = k; i < n; i++) {
      const tmp = arr[k] as number;
      arr[k] = arr[i] as number;
      arr[i] = tmp;
      recurse(k + 1);
      const tmp2 = arr[k];
      arr[k] = arr[i] as number;
      arr[i] = tmp2;
    }
  };
  recurse(0);
  return out;
}

/** All injective assignments of k agents into nItems items (k <= nItems):
 * agent j (local index) receives items[j]. Order matters — this enumerates
 * all P(nItems, k) k-permutations of items. */
export function injections(k: number, nItems: number): number[][] {
  const out: number[][] = [];
  const items = new Array<number>(k).fill(-1);
  const used = new Array<boolean>(nItems).fill(false);
  const recurse = (j: number): void => {
    if (j === k) {
      out.push([...items]);
      return;
    }
    for (let it = 0; it < nItems; it++) {
      if (used[it]) continue;
      used[it] = true;
      items[j] = it;
      recurse(j + 1);
      used[it] = false;
    }
  };
  recurse(0);
  return out;
}

export interface AllocResult {
  readonly alloc: readonly number[]; // alloc[localAgent] = item; length = agents.length
  readonly welfare: number;
  /** welfare of the runner-up — tie detection for the generator guard */
  readonly runnerUp: number;
  /** the runner-up assignment itself (for the second-best rule) */
  readonly allocRunnerUp: readonly number[];
}

/** Best assignment of the given agents (LOCAL indices into values rows) to
 * distinct items, maximizing total value. Ties broken by first enumeration
 * order; runnerUp reported for the guard. */
export function bestAllocation(values: ReadonlyArray<readonly number[]>, agents: readonly number[]): AllocResult {
  // degenerate shapes used to surface as silent -Infinity "results" (more
  // agents than items enumerates nothing) or opaque TypeErrors (empty values,
  // agent index off the rows) — refused by name, one code for the site
  if (values.length === 0) throw new KernelError("instance/alloc-shape", "bestAllocation: values must have at least one row");
  const nItems = (values[0] as readonly number[]).length;
  for (const row of values) {
    if (row.length !== nItems) throw new KernelError("instance/alloc-shape", `bestAllocation: value rows must share length ${nItems}, got ${row.length}`);
  }
  for (const a of agents) {
    if (!Number.isInteger(a) || a < 0 || a >= values.length) {
      throw new KernelError("instance/alloc-shape", `bestAllocation: agent index ${a} out of range for ${values.length} value rows`);
    }
  }
  const k = agents.length;
  if (k > nItems) throw new KernelError("instance/alloc-shape", `bestAllocation: ${k} agents cannot be injectively assigned to ${nItems} items`);
  const options = k === nItems ? permutations(k) : injections(k, nItems);
  let bestWelfare = -Infinity;
  let runnerUp = -Infinity;
  let best: number[] = [];
  let second: number[] = [];
  for (const p of options) {
    let w = 0;
    for (let j = 0; j < k; j++) {
      const agent = agents[j] as number;
      w += (values[agent]![p[j] as number] as number);
    }
    if (w > bestWelfare) {
      runnerUp = bestWelfare;
      second = best;
      bestWelfare = w;
      best = p;
    } else if (w > runnerUp) {
      runnerUp = w;
      second = p;
    }
  }
  return { alloc: best, welfare: bestWelfare, runnerUp, allocRunnerUp: second };
}

/** Random integer instance, guarded against welfare ties at the optimum
 * (tie-breaking is a known DSIC subtlety — this prototype studies exact
 * identities, so instances where the argmax is unique by construction). */
export function randomInstance(n: number, rng: Rng): Instance {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const values: number[][] = [];
    for (let a = 0; a < n; a++) {
      values.push(Array.from({ length: n }, () => rng.intInclusive(1, 60)));
    }
    const agents = Array.from({ length: n }, (_, i) => i);
    const res = bestAllocation(values, agents);
    if (res.welfare > res.runnerUp) return { n, values };
  }
  throw new KernelError("instance/tie-guard", "randomInstance: could not avoid welfare ties");
}
