import { makeParams } from "./engine.js";
import type { QaoaParams } from "./engine.js";

/**
 * Adiabatically inspired linear ramp: discretized schedule s(t) = t/p over total
 * time T gives gamma_t = dt * s(t), beta_t = dt * (1 - s(t)) with dt = T / p.
 * Near-optimal for large p without any per-layer optimization.
 */
export function linearRamp(p: number, totalTime: number): QaoaParams {
  const dt = totalTime / p;
  const gammas: number[] = [];
  const betas: number[] = [];
  for (let t = 1; t <= p; t++) {
    const s = t / p;
    gammas.push(dt * s);
    betas.push(dt * (1 - s));
  }
  return makeParams(gammas, betas);
}

function piecewiseLinear(xs: readonly number[], ys: readonly number[], x: number): number {
  if (x <= xs[0]!) return ys[0]!;
  const last = xs.length - 1;
  if (x >= xs[last]!) return ys[last]!;
  for (let i = 1; i <= last; i++) {
    if (x <= xs[i]!) {
      const t = (x - xs[i - 1]!) / (xs[i]! - xs[i - 1]!);
      return ys[i - 1]! + t * (ys[i]! - ys[i - 1]!);
    }
  }
  return ys[last]!;
}

/**
 * INTERP transfer (Zhou et al., PRL 120, 060507 (2018)): resample a p-layer
 * schedule onto pTarget layers by treating the angles as piecewise-linear
 * functions of normalized time. Lets us optimize at small p and evaluate deep.
 */
export function interp(params: QaoaParams, pTarget: number): QaoaParams {
  const p = params.gammas.length;
  if (pTarget === p) return params;
  const xs = Array.from({ length: p }, (_, i) => (i + 1) / p);
  const gammas: number[] = [];
  const betas: number[] = [];
  for (let u = 1; u <= pTarget; u++) {
    const x = u / pTarget;
    gammas.push(piecewiseLinear(xs, params.gammas, x));
    betas.push(piecewiseLinear(xs, params.betas, x));
  }
  return makeParams(gammas, betas);
}
