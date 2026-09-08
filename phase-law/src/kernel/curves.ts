/**
 * Hit-rate curve summaries — THE single source (v0.6.0). The down-cross,
 * minimum, and up-cross extraction was five literal copies (thresholds,
 * campaign, islandCampaign, densityCampaign, densityTableViolations — the
 * last one the auditor that re-derives what the producers compute). Every
 * producer and the auditor now call these three pure functions; their exact
 * values are pinned by direct unit tests, and the hit rates themselves stay
 * independently computed, so the audit's bite is preserved.
 *
 * Conventions (shared by all callers since v0.1, now written down once):
 *   - a crossing sits at the MIDPOINT of the grid step it straddles;
 *   - before the first grid point the rate is treated as 1 at λ = 0 (so a
 *     curve already below 1/2 at λ₀ crosses at λ₀/2);
 *   - a minimum tie keeps the LEFTMOST index;
 *   - "never" is -1 (λ is non-negative on every grid this repo runs).
 */

/** First λ where the rate falls below 1/2 (midpoint interpolation; -1 = never). */
export function firstDownCross(lambdas: readonly number[], hitRates: readonly number[]): number {
  for (let i = 0; i < lambdas.length; i++) {
    if (hitRates[i]! < 0.5) {
      const prev = i > 0 ? hitRates[i - 1]! : 1;
      const prevLambda = i > 0 ? lambdas[i - 1]! : 0;
      return prev >= 0.5 ? (prevLambda + lambdas[i]!) / 2 : lambdas[i]!;
    }
  }
  return -1;
}

/** Index of the minimum rate (ties keep the leftmost). */
export function minIndex(hitRates: readonly number[]): number {
  let idx = 0;
  for (let i = 1; i < hitRates.length; i++) if (hitRates[i]! < hitRates[idx]!) idx = i;
  return idx;
}

/** First λ strictly after minIdx where the rate recovers to ≥ 1/2 (midpoint; -1 = never). */
export function firstUpCrossAfter(lambdas: readonly number[], hitRates: readonly number[], minIdx: number): number {
  for (let i = minIdx + 1; i < lambdas.length; i++) {
    if (hitRates[i]! >= 0.5) {
      return (lambdas[i - 1]! + lambdas[i]!) / 2;
    }
  }
  return -1;
}
