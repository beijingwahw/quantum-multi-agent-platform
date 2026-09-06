import type { IsingModel } from "../core/ising.js";
import { qaoaExpectation, makeParams } from "./engine.js";
import type { QaoaParams } from "./engine.js";
import { linearRamp, interp } from "./params.js";

export interface GoldenResult {
  readonly x: number;
  readonly fx: number;
}

/** Golden-section maximization of a unimodal-ish objective on [a, b]. */
export function goldenMax(f: (x: number) => number, a: number, b: number, iters: number): GoldenResult {
  const invPhi = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let c = hi - invPhi * (hi - lo);
  let d = lo + invPhi * (hi - lo);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < iters; i++) {
    if (fc > fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - invPhi * (hi - lo);
      fc = f(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + invPhi * (hi - lo);
      fd = f(d);
    }
  }
  const x = (lo + hi) / 2;
  return { x, fx: f(x) };
}

export interface RampTuning {
  readonly params: QaoaParams;
  readonly expectation: number;
  readonly totalTime: number;
}

export interface RampSearchOptions {
  readonly tMin?: number;
  readonly tMax?: number;
  /** Coarse log-spaced grid points scanned before golden refinement. */
  readonly gridSize?: number;
  readonly iters?: number;
}

/**
 * Optimize the single ramp parameter T for depth p.
 *
 * The QAOA landscape in T oscillates, so plain golden section locks onto local
 * peaks near zero contribution; we scan a coarse log-spaced grid first, then
 * golden-refine the bracket around the best grid point.
 */
export function optimizeRampT(
  model: IsingModel,
  energyOf: Float64Array,
  p: number,
  options: RampSearchOptions = {},
): RampTuning {
  const tMin = options.tMin ?? 0.05;
  const tMax = options.tMax ?? 60;
  const gridSize = options.gridSize ?? 24;
  const iters = options.iters ?? 18;
  const objective = (T: number): number => qaoaExpectation(model, energyOf, linearRamp(p, T));

  const logMin = Math.log(tMin);
  const logMax = Math.log(tMax);
  let bestIdx = 0;
  let bestValue = objective(tMin);
  const grid: number[] = [tMin];
  for (let i = 1; i < gridSize; i++) {
    const T = Math.exp(logMin + ((logMax - logMin) * i) / (gridSize - 1));
    grid.push(T);
    const value = objective(T);
    if (value > bestValue) {
      bestValue = value;
      bestIdx = i;
    }
  }
  const lo = grid[Math.max(0, bestIdx - 1)]!;
  const hi = grid[Math.min(gridSize - 1, bestIdx + 1)]!;
  const refined = goldenMax(objective, lo, hi, iters);
  const best = refined.fx >= bestValue ? refined : { x: grid[bestIdx]!, fx: bestValue };
  return { params: linearRamp(p, best.x), expectation: best.fx, totalTime: best.x };
}

export interface CoordinateDescentOptions {
  readonly passes?: number;
  readonly initialBracket?: number;
  readonly bracketShrink?: number;
  readonly evalsPerCoordinate?: number;
}

/**
 * Cyclic coordinate ascent over all angles: per coordinate a local golden search
 * in [theta - delta, theta + delta], delta shrinking each pass. Only tractable
 * for small p; used to establish optimizer-quality bounds for the theorem checks.
 */
export function coordinateDescent(
  objective: (params: QaoaParams) => number,
  initial: QaoaParams,
  options: CoordinateDescentOptions = {},
): QaoaParams {
  const passes = options.passes ?? 4;
  const delta0 = options.initialBracket ?? 0.35;
  const shrink = options.bracketShrink ?? 0.5;
  const evals = options.evalsPerCoordinate ?? 14;
  const gammas = [...initial.gammas];
  const betas = [...initial.betas];
  let delta = delta0;
  for (let pass = 0; pass < passes; pass++) {
    for (let t = 0; t < gammas.length; t++) {
      const g = gammas[t]!;
      const rGamma = goldenMax(
        (x) => {
          gammas[t] = x;
          return objective(makeParams(gammas, betas));
        },
        g - delta,
        g + delta,
        evals,
      );
      gammas[t] = rGamma.x;
      const b = betas[t]!;
      const rBeta = goldenMax(
        (x) => {
          betas[t] = x;
          return objective(makeParams(gammas, betas));
        },
        b - delta,
        b + delta,
        evals,
      );
      betas[t] = rBeta.x;
    }
    delta *= shrink;
  }
  return makeParams(gammas, betas);
}

export interface DepthLadderPoint {
  readonly p: number;
  readonly expectation: number;
  readonly params: QaoaParams;
}

/**
 * Deep-circuit ladder. At every target depth two candidates compete:
 *  (1) a directly optimized linear ramp (coarse grid + golden refine), and
 *  (2) the INTERP transfer (Zhou et al., PRL 120, 060507 (2018)) of the p0
 *      schedule with a local time rescale.
 * Taking the max keeps found values monotone up to optimizer noise — the only
 * way p > 100 stays classically tractable (a handful of forward passes/step).
 */
export function depthLadder(
  model: IsingModel,
  energyOf: Float64Array,
  p0: number,
  targets: readonly number[],
  options: { retuneEvalBudget?: number } = {},
): DepthLadderPoint[] {
  const retunes = options.retuneEvalBudget ?? 3;
  const base = optimizeRampT(model, energyOf, p0);
  const points: DepthLadderPoint[] = [{ p: p0, expectation: base.expectation, params: base.params }];

  for (const p of targets) {
    if (p === p0) continue;
    let best: DepthLadderPoint = { p, expectation: -Infinity, params: base.params };

    const direct = optimizeRampT(model, energyOf, p);
    if (direct.expectation > best.expectation) {
      best = { p, expectation: direct.expectation, params: direct.params };
    }

    const transferred = interp(base.params, p);
    const objective = (scale: number): number =>
      qaoaExpectation(
        model,
        energyOf,
        makeParams(transferred.gammas.map((g) => g * scale), transferred.betas.map((b) => b * scale)),
      );
    const rescale = goldenMax(objective, 0.5, 2.0, retunes);
    const scaled = makeParams(
      transferred.gammas.map((g) => g * rescale.x),
      transferred.betas.map((b) => b * rescale.x),
    );
    const scaledValue = qaoaExpectation(model, energyOf, scaled);
    if (scaledValue > best.expectation) {
      best = { p, expectation: scaledValue, params: scaled };
    }
    points.push(best);
  }
  points.sort((a, b) => a.p - b.p);
  return points;
}
