/**
 * The exact probe — one (instance, depth) optimized statevector with its
 * cost table, Hamming-distance masses, and optimal expectation, memoized
 * per process. Pure deterministic kernel arithmetic: the memo changes no
 * value, it only pays the 2^n optimization once per (instance, depth) —
 * the n=20 probe costs ~25 exact-statevector evaluations at 2^20 amplitudes.
 * Every claimed field the checkers verify (rates, statistics, census rows)
 * is recomputed FROM the probe; the probe itself is not a claim.
 */
import type { Instance, QaoaParams } from "./crossval.js";
import { costTable, expectation, optimizeOffline, runQaoa } from "./crossval.js";
import { distanceMasses } from "./robust.js";

export interface ExactProbe {
  readonly inst: Instance;
  readonly depth: number;
  readonly params: QaoaParams;
  readonly psi: Float64Array;
  readonly costs: Float64Array;
  /** E at the offline optimum (the minimization objective, X2) */
  readonly eStar: number;
  /** |psi_s|^2 by Hamming distance from the optimum, exact */
  readonly masses: Float64Array;
}

const memo = new Map<string, ExactProbe>();

export function exactProbe(inst: Instance, depth: number): ExactProbe {
  const key = `${inst.id}#${depth}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const params = optimizeOffline(inst, depth);
  const psi = runQaoa(inst, params);
  const costs = costTable(inst);
  const probe: ExactProbe = {
    inst,
    depth,
    params,
    psi,
    costs,
    eStar: expectation(psi, costs),
    masses: distanceMasses(psi, inst.n, inst.optBits),
  };
  memo.set(key, probe);
  return probe;
}
