import type { IsingModel } from "../core/ising.js";
import { DensityMatrix } from "../core/density.js";
import type { QaoaParams } from "./engine.js";
import { monotonicityReport } from "./monotonic.js";
import type { DepthPoint } from "./monotonic.js";

/**
 * Bounded-noise face of the monotonicity track. The v0.1 boundary said
 * "logical layer is noiseless"; this module prices that boundary: the same
 * QAOA schedule runs on the exact density matrix with a parameterized
 * per-layer depolarizing channel and a readout bit-flip channel, both applied
 * exactly (no Monte Carlo, no trajectories).
 */

export interface NoiseSpec {
  /**
   * Per-qubit Pauli depolarizing probability applied once after each QAOA
   * layer (after cost + mixer): rho -> (1-e)rho + (e/3)(XrX + YrY + ZrZ)
   * on every qubit. NOT per gate — one channel layer per QAOA layer.
   */
  readonly depolarizingPerLayer: number;
  /** Symmetric readout bit-flip probability per qubit, applied at the end. */
  readonly readoutFlip: number;
}

export const NOISELESS: NoiseSpec = { depolarizingPerLayer: 0, readoutFlip: 0 };

/**
 * Exact symmetric readout errors on a probability vector: per bit j, the
 * observed distribution is the independent bit-flip convolution of the true
 * one. Applied bit-by-bit, O(2^n * n), exact.
 */
export function applyReadoutFlips(probs: Float64Array, n: number, q: number): Float64Array {
  const out = probs.slice();
  if (q === 0) return out;
  const dim = out.length;
  for (let j = 0; j < n; j++) {
    const bit = 1 << j;
    for (let s0 = 0; s0 < dim; s0++) {
      if (s0 & bit) continue;
      const s1 = s0 | bit;
      const a = out[s0]!;
      const b = out[s1]!;
      out[s0] = (1 - q) * a + q * b;
      out[s1] = q * a + (1 - q) * b;
    }
  }
  return out;
}

/**
 * <C> of the noisy circuit: exact density-matrix evolution of the schedule,
 * per-layer depolarizing on all n qubits, then exact readout flips on the
 * Born distribution.
 */
export function noisyExpectation(
  model: IsingModel,
  energyOf: Float64Array,
  params: QaoaParams,
  noise: NoiseSpec,
): number {
  const rho = DensityMatrix.plusState(model.n);
  for (let t = 0; t < params.gammas.length; t++) {
    rho.applyCostPhase(params.gammas[t]!, energyOf);
    rho.applyMixer(params.betas[t]!);
    for (let j = 0; j < model.n; j++) {
      rho.depolarizeQubit(j, noise.depolarizingPerLayer);
    }
  }
  const probs = applyReadoutFlips(rho.probabilities(), model.n, noise.readoutFlip);
  let acc = 0;
  for (let s = 0; s < probs.length; s++) acc += probs[s]! * energyOf[s]!;
  return acc;
}

/** r_p under noise: noisy expectation over the exact optimum. */
export function noisyRatio(
  model: IsingModel,
  energyOf: Float64Array,
  optimum: number,
  params: QaoaParams,
  noise: NoiseSpec,
): number {
  return noisyExpectation(model, energyOf, params, noise) / optimum;
}

export interface NoisySeriesPoint extends DepthPoint {
  readonly noise: NoiseSpec;
}

/**
 * Evaluate one noise level across a depth ladder of pre-optimized schedules
 * (the noiseless ladder from exp1): each depth's angles are the noiseless
 * optimum, priced under noise. This is evaluation pricing, not noisy
 * re-training — a lower bound on what noise-aware training would achieve.
 */
export function noisyDepthSeries(
  model: IsingModel,
  energyOf: Float64Array,
  optimum: number,
  schedules: ReadonlyArray<{ p: number; params: QaoaParams }>,
  noise: NoiseSpec,
): NoisySeriesPoint[] {
  return schedules.map((s) => {
    const best = noisyExpectation(model, energyOf, s.params, noise);
    return { p: s.p, best, ratio: best / optimum, noise };
  });
}

/**
 * Where the noisy r-curve bends. `monotonePrefixLen` counts leading ladder
 * steps that are non-decreasing within tolAbs (the same tolerance the
 * noiseless track uses); `pStar` is the measured optimum depth;
 * `epsilonTimesPStar` is the per-layer error budget consumed at the bend.
 */
export interface NoiseBendReport {
  readonly monotonePrefixLen: number;
  readonly firstDropAt: number | null;
  readonly pStar: number;
  readonly rStar: number;
  readonly epsilonTimesPStar: number;
}

export function noiseBendReport(
  points: readonly DepthPoint[],
  tolAbs: number,
  epsilonPerLayer: number,
): NoiseBendReport {
  const report = monotonicityReport(points, tolAbs);
  let prefix = points.length > 0 ? 1 : 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.best >= points[i - 1]!.best - tolAbs) prefix++;
    else break;
  }
  let star = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.best > points[star]!.best) star = i;
  }
  const pStar = points[star]?.p ?? 0;
  return {
    monotonePrefixLen: prefix,
    firstDropAt: report.violations.length > 0 ? report.violations[0]!.p : null,
    pStar,
    rStar: points[star]?.ratio ?? 0,
    epsilonTimesPStar: epsilonPerLayer * pStar,
  };
}

/**
 * Anti-smuggling gate for the noise face: a claim about a measured noisy
 * series is only accepted if (1) it matches the actually-measured series
 * point by point (a flattened or edited tail is a forged series) and (2) the
 * measured series itself is monotone within tolerance. Rejections name the
 * depth and the offense.
 */
export interface NoiseClaim {
  readonly instanceId: string;
  readonly noise: NoiseSpec;
  readonly claimedMonotone: boolean;
  readonly claimedSeries: readonly DepthPoint[];
}

export interface NoiseClaimVerdict {
  readonly accepted: boolean;
  readonly reasons: string[];
}

export function verifyNoiseClaim(
  claim: NoiseClaim,
  measured: readonly DepthPoint[],
  tolAbs: number,
  maxDivergenceAbs: number,
): NoiseClaimVerdict {
  const reasons: string[] = [];
  if (claim.claimedSeries.length !== measured.length) {
    reasons.push(
      `${claim.instanceId}: claimed series length ${claim.claimedSeries.length} != measured ${measured.length}`,
    );
  }
  for (let i = 0; i < Math.min(claim.claimedSeries.length, measured.length); i++) {
    const c = claim.claimedSeries[i]!;
    const m = measured[i]!;
    if (c.p !== m.p) {
      reasons.push(`${claim.instanceId}: depth grid mismatch at index ${i} (claimed p=${c.p}, measured p=${m.p})`);
      break;
    }
    const div = Math.abs(c.best - m.best);
    if (div > maxDivergenceAbs) {
      reasons.push(
        `${claim.instanceId}: FORGED series at p=${c.p} — claimed ${c.best.toFixed(6)} vs measured ${m.best.toFixed(6)} (divergence ${div.toExponential(2)})`,
      );
      break;
    }
  }
  const report = monotonicityReport(measured, tolAbs);
  if (claim.claimedMonotone && !report.monotone) {
    const v = report.violations[0]!;
    reasons.push(
      `${claim.instanceId}: FALSE monotonicity claim — measured series drops at p=${v.p} by ${v.drop.toExponential(2)} (tol ${tolAbs.toExponential(0)})`,
    );
  }
  if (!claim.claimedMonotone && report.monotone) {
    reasons.push(`${claim.instanceId}: claim understates the data — series is monotone, claim says it is not`);
  }
  return { accepted: reasons.length === 0, reasons };
}
