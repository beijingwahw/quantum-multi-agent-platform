/**
 * Rochet cyclical monotonicity as the closedness/exactness face of
 * implementability (ROC87): an allocation rule x is implementable by SOME
 * payment iff the allocation 1-form omega(a -> b) = a(x(b)) - a(x(a)) has no
 * positive cycle. With a Groves payment fixed, the utility 1-form adds the
 * payment difference, and every pair sum is <= 0 for the efficient rule.
 *
 * Negative controls: the anti-efficient rule and the greedy rule (agent order
 * 0, 1, ... each takes their favorite remaining item) — both break
 * exactness/monotonicity in machine-exhibitable ways.
 */
import { cycleScan } from "../core/cycles.js";
import { permutations } from "./instance.js";
import type { GrovesWorld } from "./groves.js";
import { allocationAt, wMinusI } from "./groves.js";

export type RuleKind = "efficient" | "anti-efficient" | "greedy" | "second-best";

export interface RuledWorld extends GrovesWorld {
  readonly rule: RuleKind;
}

function greedyAlloc(w: GrovesWorld, report: readonly number[]): number[] {
  const profile: number[][] = [];
  let next = 0;
  for (let a = 0; a < w.n; a++) {
    if (a === w.i) profile.push([...report]);
    else {
      profile.push([...w.othersBids[next] as readonly number[]]);
      next++;
    }
  }
  const taken = new Array<boolean>(w.n).fill(false);
  const alloc = new Array<number>(w.n).fill(-1);
  for (let a = 0; a < w.n; a++) {
    let bestItem = -1;
    let bestVal = -Infinity;
    for (let it = 0; it < w.n; it++) {
      if (taken[it]) continue;
      const v = (profile[a] as number[])[it] as number;
      if (v > bestVal) {
        bestVal = v;
        bestItem = it;
      }
    }
    alloc[a] = bestItem;
    taken[bestItem] = true;
  }
  return alloc;
}

/** Allocation of the rule at report k (deterministic tie-breaks).
 * "second-best" = the runner-up assignment: the approximate solver that is
 * one step from optimal — the quantum-mech T5 villain, cast as a rule. */
export function ruleAllocation(w: RuledWorld, k: number): readonly number[] {
  if (w.rule === "greedy") return greedyAlloc(w, w.reports[k] as readonly number[]);
  if (w.rule === "second-best") return allocationAt(w, k).allocRunnerUp;
  const eff = allocationAt(w, k);
  if (w.rule === "efficient") return eff.alloc;
  // anti-efficient: worst permutation by reported welfare
  const profile: number[][] = [];
  let next = 0;
  for (let a = 0; a < w.n; a++) {
    if (a === w.i) profile.push([...(w.reports[k] as readonly number[])]);
    else {
      profile.push([...w.othersBids[next] as readonly number[]]);
      next++;
    }
  }
  let worst: number[] = [];
  let worstW = Infinity;
  for (const p of permutations(w.n)) {
    let s = 0;
    for (let a = 0; a < w.n; a++) s += (profile[a] as number[])[p[a] as number] as number;
    if (s < worstW) {
      worstW = s;
      worst = p;
    }
  }
  return worst;
}

/** The allocation 1-form omega(a -> b) = a(x(b)) - a(x(a)) (no payments yet):
 * Rochet implementability <=> no positive simple cycle. */
export function allocationOneForm(w: RuledWorld): (a: number, b: number) => number {
  const allocs: number[][] = [];
  const valuesAt: number[][] = [];
  for (let k = 0; k < w.reports.length; k++) {
    allocs.push([...ruleAllocation(w, k)]);
    valuesAt.push([...(w.reports[k] as readonly number[])]);
  }
  return (a: number, b: number): number => {
    const allocB = allocs[b] as number[];
    const allocA = allocs[a] as number[];
    const typeA = valuesAt[a] as number[];
    return (typeA[allocB[w.i] as number] as number) - (typeA[allocA[w.i] as number] as number);
  };
}

export interface RochetScan {
  readonly maxCycle: number;
  readonly worstCycle: number[];
  readonly implementable: boolean;
  readonly cycleCount: number;
}

export function rochetScan(w: RuledWorld): RochetScan {
  const omega = allocationOneForm(w);
  const scan = cycleScan(w.reports.length, omega);
  return {
    maxCycle: scan.max,
    worstCycle: scan.worst,
    implementable: scan.max <= 0,
    cycleCount: scan.count,
  };
}

/** With a Groves payment fixed (any gauge), the utility 1-form
 * u(a -> b) = a(x(b)) - a(x(a)) - (p(b) - p(a)) — its max cycle is the
 * strongest statement of "no chain of lies pays". For the efficient rule this
 * is <= 0 with equality attained; for the broken rules it is not. */
export function utilityOneForm(w: RuledWorld, h: number): (a: number, b: number) => number {
  const omega = allocationOneForm(w);
  const pays: number[] = [];
  for (let k = 0; k < w.reports.length; k++) {
    const alloc = ruleAllocation(w, k);
    pays.push(h - wMinusI(w, alloc));
  }
  return (a: number, b: number): number => omega(a, b) - ((pays[b] as number) - (pays[a] as number));
}

/** Direct deviation scan with the Groves payment of the ruled world:
 * max over reports k of U(k) - U(0) — the certificate a specific mechanism
 * (rule + Groves-form payment) fails or passes DSIC. */
export function directDeviationMax(w: RuledWorld, h: number): number {
  const pays: number[] = [];
  const values: number[] = [];
  const v = w.reports[0] as readonly number[];
  for (let k = 0; k < w.reports.length; k++) {
    const alloc = ruleAllocation(w, k);
    pays.push(h - wMinusI(w, alloc));
    values.push(v[alloc[w.i] as number] as number);
  }
  let best = 0;
  for (let k = 1; k < w.reports.length; k++) {
    best = Math.max(best, (values[k] as number) - (pays[k] as number) - ((values[0] as number) - (pays[0] as number)));
  }
  return best;
}
