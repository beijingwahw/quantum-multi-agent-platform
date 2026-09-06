/**
 * PHASE-LAW — the census: hit-rate curves in λ, thresholds, scaling.
 * Every optimum by enumeration; every hit an honest count.
 */
import { anneal, enumerateAll, greedy, localSearch, makeInstance, optimumOf, welfareOf, type CoupledInstance } from "./law.js";

export type SolverId = "greedy" | "local-search" | "anneal";

export interface CensusPoint {
  readonly m: number;
  readonly n: number;
  readonly lambda: number;
  readonly solver: SolverId;
  readonly seeds: number;
  readonly hits: number;
  readonly hitRate: number;
}

export interface ThresholdCell {
  readonly m: number;
  readonly n: number;
  readonly solver: SolverId;
  /** smallest grid λ whose hit rate is < 0.5 (the crossing), or -1 if never */
  readonly lambdaCross: number;
  readonly hitRateAtZero: number;
  readonly hitRateAtMax: number;
}

export const SIZES: ReadonlyArray<readonly [number, number]> = [
  [2, 3],
  [3, 4],
  [3, 5],
  [4, 6],
  [5, 7],
  [6, 8],
];
export const LAMBDA_GRID: readonly number[] = [0, 0.1, 0.2, 0.3, 0.35, 0.5, 0.7, 1.0, 1.5];
export const SEEDS = 5;

function solveWith(solver: SolverId, inst: CoupledInstance): number[] {
  switch (solver) {
    case "greedy":
      return greedy(inst);
    case "local-search":
      return localSearch(inst, greedy(inst));
    case "anneal":
      return anneal(inst, 42);
  }
}

export function census(
  sizes: ReadonlyArray<readonly [number, number]> = SIZES,
  lambdas: readonly number[] = LAMBDA_GRID,
  seeds = SEEDS,
): CensusPoint[] {
  const points: CensusPoint[] = [];
  for (const [m, n] of sizes) {
    for (const lambda of lambdas) {
      for (const solver of ["greedy", "local-search", "anneal"] as const) {
        let hits = 0;
        for (let k = 1; k <= seeds; k++) {
          const inst = makeInstance(m, n, 500 * k, lambda);
          const opt = optimumOf(inst).welfare;
          const w = welfareOf(inst, solveWith(solver, inst));
          if (Math.abs(w - opt) < 1e-9) hits++;
        }
        points.push({ m, n, lambda, solver, seeds, hits, hitRate: hits / seeds });
      }
    }
  }
  return points;
}

/** The 50%-crossing extraction (linear interpolation on the grid). */
export function thresholds(points: readonly CensusPoint[]): ThresholdCell[] {
  const cells: ThresholdCell[] = [];
  const keys = new Set(points.map((p) => `${p.m}x${p.n}::${p.solver}`));
  for (const key of keys) {
    const [mn, solver] = key.split("::");
    const [m, n] = mn!.split("x").map(Number) as [number, number];
    const curve = points
      .filter((p) => p.m === m && p.n === n && p.solver === solver)
      .sort((a, b) => a.lambda - b.lambda);
    const atZero = curve.find((p) => p.lambda === 0)?.hitRate ?? Number.NaN;
    const atMax = curve[curve.length - 1]?.hitRate ?? Number.NaN;
    let cross = -1;
    for (let i = 0; i < curve.length; i++) {
      if (curve[i]!.hitRate < 0.5) {
        const prev = i > 0 ? curve[i - 1]! : undefined;
        cross = prev !== undefined && prev.hitRate >= 0.5 ? (prev.lambda + curve[i]!.lambda) / 2 : curve[i]!.lambda;
        break;
      }
    }
    cells.push({ m, n, solver: solver as SolverId, lambdaCross: cross, hitRateAtZero: atZero, hitRateAtMax: atMax });
  }
  return cells.sort((a, b) =>
    a.m === b.m ? a.solver.localeCompare(b.solver) : a.m - b.m || a.n - b.n,
  );
}

/**
 * The SCALING CAMPAIGN (v0.2.0 — the priced next step of the pilot census):
 * finer λ grid, more seeds, the SA threshold curve λ*(m,n) with enough
 * resolution to test scaling hypotheses honestly.
 */
export const FINE_LAMBDA_GRID: readonly number[] = Array.from({ length: 31 }, (_, i) => i * 0.05);

export interface CampaignCell {
  readonly m: number;
  readonly n: number;
  readonly solver: SolverId;
  readonly seeds: number;
  /** first fine-grid λ with hit rate < 0.5 (linear interpolation), -1 = never */
  readonly lambdaCross: number;
  readonly hitRates: readonly number[]; // parallel to the fine grid
}

export function campaign(
  sizes: ReadonlyArray<readonly [number, number]> = SIZES,
  lambdas: readonly number[] = FINE_LAMBDA_GRID,
  seeds = 60,
  solvers: readonly SolverId[] = ["anneal", "local-search"],
): CampaignCell[] {
  const cells: CampaignCell[] = [];
  for (const [m, n] of sizes) {
    for (const solver of solvers) {
      const hitRates = lambdas.map((lambda) => {
        let hits = 0;
        for (let k = 1; k <= seeds; k++) {
          const inst = makeInstance(m, n, 500 * k, lambda);
          const opt = optimumOf(inst).welfare;
          const w = welfareOf(inst, solveWith(solver, inst));
          if (Math.abs(w - opt) < 1e-9) hits++;
        }
        return hits / seeds;
      });
      let cross = -1;
      for (let i = 0; i < lambdas.length; i++) {
        if (hitRates[i]! < 0.5) {
          const prev = i > 0 ? hitRates[i - 1]! : 1;
          const prevLambda = i > 0 ? lambdas[i - 1]! : 0;
          cross = prev >= 0.5 ? (prevLambda + lambdas[i]!) / 2 : lambdas[i]!;
          break;
        }
      }
      cells.push({ m, n, solver, seeds, lambdaCross: cross, hitRates });
    }
  }
  return cells;
}

/**
 * The ISLAND CAMPAIGN (v0.3.0): the full U-curve — both crossings of the
 * heuristic hit rate, the hardness island's two edges.
 */
export const ISLAND_LAMBDA_GRID: readonly number[] = Array.from({ length: 41 }, (_, i) => i * 0.1);

export interface IslandCell {
  readonly m: number;
  readonly n: number;
  readonly solver: SolverId;
  readonly seeds: number;
  readonly downCross: number; // first λ with hit < 0.5 (left edge), -1 = never
  readonly upCross: number; // first λ AFTER the minimum with hit ≥ 0.5 again, -1 = never
  readonly minRate: number;
  readonly minLambda: number;
  readonly rateAtZero: number;
  readonly rateAtMax: number;
}

export function islandCampaign(
  sizes: ReadonlyArray<readonly [number, number]> = [
    [5, 7],
    [6, 8],
  ],
  lambdas: readonly number[] = ISLAND_LAMBDA_GRID,
  seeds = 40,
  solver: SolverId = "anneal",
): IslandCell[] {
  const cells: IslandCell[] = [];
  for (const [m, n] of sizes) {
    const hitRates = lambdas.map((lambda) => {
      let hits = 0;
      for (let k = 1; k <= seeds; k++) {
        const inst = makeInstance(m, n, 500 * k, lambda);
        const opt = optimumOf(inst).welfare;
        const w = welfareOf(inst, solveWith(solver, inst));
        if (Math.abs(w - opt) < 1e-9) hits++;
      }
      return hits / seeds;
    });
    let down = -1;
    for (let i = 0; i < lambdas.length; i++) {
      if (hitRates[i]! < 0.5) {
        const prev = i > 0 ? hitRates[i - 1]! : 1;
        const prevLambda = i > 0 ? lambdas[i - 1]! : 0;
        down = prev >= 0.5 ? (prevLambda + lambdas[i]!) / 2 : lambdas[i]!;
        break;
      }
    }
    let minIdx = 0;
    for (let i = 1; i < hitRates.length; i++) if (hitRates[i]! < hitRates[minIdx]!) minIdx = i;
    let up = -1;
    for (let i = minIdx + 1; i < lambdas.length; i++) {
      if (hitRates[i]! >= 0.5) {
        const prevLambda = lambdas[i - 1]!;
        up = (prevLambda + lambdas[i]!) / 2;
        break;
      }
    }
    cells.push({
      m,
      n,
      solver,
      seeds,
      downCross: down,
      upCross: up,
      minRate: hitRates[minIdx]!,
      minLambda: lambdas[minIdx]!,
      rateAtZero: hitRates[0]!,
      rateAtMax: hitRates[hitRates.length - 1]!,
    });
  }
  return cells;
}

/**
 * The envelope cross-check (P1's witness): the closed-form λ_opt* must equal
 * the smallest grid λ at which the enumerated optimum itself is coupled.
 */
export function envelopeCheck(
  m: number,
  n: number,
  seed: number,
  lambdas: readonly number[],
): { worstSwitchDeviation: number } {
  const base = makeInstance(m, n, seed, 0);
  let worst = 0;
  const star = (() => {
    let U = -Infinity;
    let C = -Infinity;
    for (const a of enumerateAll(base)) {
      if (a.usesBoth) {
        if (a.w0 > C) C = a.w0;
      } else if (a.w0 > U) U = a.w0;
    }
    return Math.max(0, U - C);
  })();
  let prevCoupled = false;
  for (const lambda of lambdas) {
    const inst = makeInstance(m, n, seed, lambda);
    const opt = optimumOf(inst);
    const coupled = opt.usesBoth;
    const predicted = lambda > star + 1e-12;
    if (coupled !== predicted && !(prevCoupled && coupled)) {
      // the switch must land exactly above λ_opt*
      worst = Math.max(worst, Math.abs(lambda - star));
    }
    prevCoupled = coupled;
  }
  return { worstSwitchDeviation: worst };
}
