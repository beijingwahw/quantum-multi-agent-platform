/**
 * T4 extension — The statistical-cost wall census (v0.2): exact sample
 * complexity to certify at confidence δ vs noise, as executable numbers.
 *
 *  Setting A (XEB rejection of the uniform device): the verifier draws N
 *  samples x_i, computes the per-sample statistic X = 2ⁿp_ideal(x) − 1 from
 *  its exact classical simulation, and rejects the device as uniform when
 *  the mean exceeds τ = λ₀C/2, where C = 2ⁿΣp² − 1 is the circuit's XEB
 *  self-value and λ₀ the target (surviving) signal. Two exact certificates:
 *   - Hoeffding: X ∈ [−1, 2ⁿp_max − 1] gives
 *       P_uniform[X̄ ≥ τ] ≤ exp(−2Nτ²/R²),  R = 2ⁿp_max
 *     ⟹ N_H = ⌈R² ln(1/δ)/(2τ²)⌉.
 *   - Exact Chernoff (Cramér): the per-sample distribution under the uniform
 *     device is known exactly (value 2ⁿp(x)−1 with probability 2⁻ⁿ), so the
 *     Legendre transform I₀(τ) = sup_{s≥0} [sτ − ln E e^{sX}] is computed to
 *     machine precision and   N_C = ⌈ln(1/δ)/I₀(τ)⌉  — no approximation.
 *  N_C ≤ N_H must hold (Hoeffding is the sub-Gaussian proxy of the same
 *  Chernoff argument). MC cross-check: the measured false-accept rate of the
 *  uniform device at N_C must sit at or below δ.
 *
 *  Setting B (shadow fidelity): the per-shot value of the local-Pauli shadow
 *  fidelity estimator has an exactly-enumerable distribution (3ⁿ bases × 2ⁿ
 *  outcomes); exact mean and variance σ² give the rigorous Chebyshev count
 *  N = ⌈σ²/(δε²)⌉ and the Hoeffding count over the exact per-shot range.
 *  MC cross-check: empirical coverage at the Chebyshev count ≥ 1 − δ.
 *
 *  Literature anchors (verified, cited in docs/citations.md): Huang–Kueng–
 *  Preskill log(M/δ) shadow scaling; Fu arXiv:2412.03381 (median-of-means
 *  constants); Lowe–Moshkovitz–Parekh–Segev single-copy lower bounds
 *  (arXiv:2207.14438); XEB pitfalls PRX Quantum 5, 010334 (2024) and the
 *  classical spoof arXiv:2405.00789.
 */

import { type Rng } from '../core/rng.js';
import { xebSelfConsistency } from './xeb.js';

/** Hoeffding sample count for a bounded statistic: N = ⌈R² ln(1/δ)/(2τ²)⌉. */
export function hoeffdingN(range: number, delta: number, margin: number): number {
  if (margin <= 0) throw new Error('hoeffdingN: margin must be positive');
  if (!(delta > 0 && delta < 1)) throw new Error('hoeffdingN: delta must be in (0,1)');
  return Math.ceil((range * range * Math.log(1 / delta)) / (2 * margin * margin));
}

/**
 * Exact Cramér rate function of the upper tail at threshold τ for a finite
 * exact value distribution: I(τ) = sup_{s≥0} [sτ − ln Σ q_i e^{s v_i}].
 * Deterministic golden-section maximization (the objective is concave in s).
 */
export function cramerRate(values: readonly number[], probs: readonly number[], tau: number): number {
  const vmax = Math.max(...values);
  const logM = (s: number): number => {
    // stable log-sum-exp: shift by s·v_max so no term overflows for large s
    let m = 0;
    for (let i = 0; i < values.length; i++) m += probs[i]! * Math.exp(s * (values[i]! - vmax));
    return s * vmax + Math.log(m);
  };
  const obj = (s: number): number => s * tau - logM(s);
  const lo = 0;
  let hi = 1;
  while (obj(hi) > obj(lo) + 1e-15 && hi < 1e4) hi *= 2; // bracket the maximizer
  const gr = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - gr * (b - a);
  let d = a + gr * (b - a);
  let fc = obj(c);
  let fd = obj(d);
  while (b - a > 1e-12 * Math.max(1, b)) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - gr * (b - a);
      fc = obj(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + gr * (b - a);
      fd = obj(d);
    }
  }
  return Math.max(0, obj((a + b) / 2));
}

export interface XebWallRow {
  lambdaTarget: number;
  delta: number;
  /** decision threshold τ = λ₀C/2 */
  threshold: number;
  /** exact Cramér rate I₀(τ) under the uniform device */
  rate: number;
  nHoeffding: number;
  nChernoff: number;
}

/**
 * XEB certification wall at one (λ₀, δ): the exact sample counts for the
 * uniform-rejection test against the circuit distribution p.
 */
export function xebWallRow(p: Float64Array, lambdaTarget: number, delta: number): XebWallRow {
  const dim = p.length;
  const selfValue = xebSelfConsistency(p); // C = 2ⁿΣp² − 1
  let pMax = 0;
  const values: number[] = [];
  const probs: number[] = [];
  for (let i = 0; i < dim; i++) {
    pMax = Math.max(pMax, p[i]!);
    values.push(dim * p[i]! - 1);
    probs.push(1 / dim);
  }
  const threshold = (lambdaTarget * selfValue) / 2;
  const rate = cramerRate(values, probs, threshold);
  if (rate <= 0) throw new Error('xebWallRow: non-positive rate (threshold unreachable?)');
  return {
    lambdaTarget,
    delta,
    threshold,
    rate,
    nHoeffding: hoeffdingN(pMax * dim, delta, threshold),
    nChernoff: Math.ceil(Math.log(1 / delta) / rate),
  };
}

/** MC cross-check: false-accept rate of the uniform device at threshold τ with N samples. */
export function uniformFalseAcceptMC(
  p: Float64Array,
  threshold: number,
  samples: number,
  trials: number,
  rng: Rng,
): { rate: number; stdErr: number } {
  const dim = p.length;
  const values = new Float64Array(dim);
  for (let i = 0; i < dim; i++) values[i] = dim * p[i]! - 1;
  let passes = 0;
  for (let t = 0; t < trials; t++) {
    let sum = 0;
    for (let s = 0; s < samples; s++) {
      // uniform device: every outcome equally likely — one fair draw
      const idx = Math.min(dim - 1, Math.floor(rng() * dim));
      sum += values[idx]!;
    }
    if (sum / samples >= threshold) passes++;
  }
  const rate = passes / trials;
  return { rate, stdErr: Math.sqrt(Math.max(rate * (1 - rate), 1 / trials) / trials) };
}

export interface ShadowWallRow {
  /** exact per-shot mean = ⟨ψ|ρ|ψ⟩ */
  mean: number;
  /** exact per-shot variance σ² */
  variance: number;
  /** exact per-shot range */
  range: number;
  epsilon: number;
  delta: number;
  nChebyshev: number;
  nHoeffding: number;
}

/** Shadow-fidelity sample wall from the exact per-shot moments. */
export function shadowWallRow(exact: { mean: number; variance: number; min: number; max: number }, epsilon: number, delta: number): ShadowWallRow {
  if (exact.variance <= 0) throw new Error('shadowWallRow: degenerate variance');
  return {
    mean: exact.mean,
    variance: exact.variance,
    range: exact.max - exact.min,
    epsilon,
    delta,
    nChebyshev: Math.ceil(exact.variance / (delta * epsilon * epsilon)),
    nHoeffding: hoeffdingN(exact.max - exact.min, delta, epsilon),
  };
}

export interface SampleRowVerdict {
  ok: boolean;
  /** fraud name when rejected, 'clean' otherwise */
  name: string;
  detail: string;
}

export interface SampleComplexityClaim {
  lambdaTarget: number;
  delta: number;
  /** claimed sufficient sample count for the uniform-rejection test */
  claimedN: number;
}

/**
 * Smuggling trial referee: a third party hands us a row of the sample-wall
 * table. The checker recomputes the exact Chernoff requirement from the
 * circuit distribution and NAMES any too-cheap claim.
 */
export function checkSampleComplexityRow(p: Float64Array, claim: SampleComplexityClaim): SampleRowVerdict {
  const row = xebWallRow(p, claim.lambdaTarget, claim.delta);
  if (claim.claimedN < row.nChernoff) {
    return {
      ok: false,
      name: 'below-exact-chernoff-requirement',
      detail: `claim N=${claim.claimedN} but the exact Cramér rate I₀=${row.rate.toExponential(6)} at τ=${row.threshold.toFixed(6)} requires N ≥ ${row.nChernoff} at δ=${claim.delta}`,
    };
  }
  if (claim.claimedN > row.nHoeffding * 1000) {
    return {
      ok: false,
      name: 'padded-beyond-hoeffding-slop',
      detail: `claim N=${claim.claimedN} exceeds even the Hoeffding count ${row.nHoeffding} by >1000× — the row is not a bound for this circuit`,
    };
  }
  return { ok: true, name: 'clean', detail: 'sample count satisfies the exact Chernoff requirement' };
}
