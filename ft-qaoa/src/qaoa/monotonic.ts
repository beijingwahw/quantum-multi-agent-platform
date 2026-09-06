import type { IsingModel } from "../core/ising.js";
import { embeddingGap } from "./engine.js";
import type { QaoaParams } from "./engine.js";
import { Rng } from "../core/rng.js";

export interface DepthPoint {
  readonly p: number;
  readonly best: number;
  readonly ratio: number;
}

export interface MonotonicityReport {
  readonly monotone: boolean;
  readonly violations: Array<{ readonly p: number; readonly drop: number }>;
  readonly maxGain: number;
}

/**
 * Check a measured best-value-in-depth series for non-increase violations.
 * `tolAbs` absorbs optimizer noise: the theorem guarantees monotonicity of the
 * *optimal* value M_p, while the series holds values *found* by a heuristic.
 */
export function monotonicityReport(points: readonly DepthPoint[], tolAbs: number): MonotonicityReport {
  const violations: Array<{ p: number; drop: number }> = [];
  let maxGain = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const diff = curr.best - prev.best;
    if (diff > maxGain) maxGain = diff;
    if (diff < -tolAbs) violations.push({ p: curr.p, drop: diff });
  }
  return { monotone: violations.length === 0, violations, maxGain };
}

export interface EmbeddingCheck {
  readonly p: number;
  readonly gap: number;
  readonly passed: boolean;
}

/**
 * Numerically verify the padding identity F_{p+1}(theta | 0,0) = F_p(theta)
 * through the real engine, on seeded random angles. This is the falsifiable
 * core of the monotonicity theorem: any implementation bug surfaces here.
 */
export function verifyEmbedding(
  model: IsingModel,
  energyOf: Float64Array,
  p: number,
  seed: number,
  tolerance: number,
): EmbeddingCheck {
  const rng = new Rng(seed);
  const gammas = Array.from({ length: p }, () => rng.range(-0.5, 0.5));
  const betas = Array.from({ length: p }, () => rng.range(-0.3, 0.3));
  const params: QaoaParams = { gammas, betas };
  const gap = embeddingGap(model, energyOf, params);
  return { p, gap, passed: gap <= tolerance };
}
