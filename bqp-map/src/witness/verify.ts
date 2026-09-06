/**
 * Witness verification asymmetry: NP witness vs quantum (QMA-style) witness,
 * for the same scheduling instance.
 *
 * Instance: P2||Cmax with target B.
 *  - NP witness: one bitstring z (the schedule). Verification = one exact
 *    evaluation makespan(z) <= B. Deterministic, zero-sample.
 *  - Quantum witness: a state |psi> over the assignment basis. The verifier
 *    estimates <H> (H diagonal, H(z) = makespan(z)) by Born sampling and
 *    accepts iff the estimate clears the threshold. Correctness of the
 *    estimate is governed by Hoeffding: m >= R^2 ln(2/delta) / (2 eps^2)
 *    shots for range width R — a LAW, machine-verified here by Monte Carlo
 *    coverage on both sides:
 *      completeness: honest states with <H> <= B accept with prob >= 1-delta,
 *      soundness:    cheating states with <H> >= B + 2eps reject with prob
 *                    >= 1-delta.
 *
 * The atlas cites this module as the VERIFICATION-GAP certificate: swapping
 * a classical witness for a quantum one buys (sometimes) verifiability of
 * states no NP witness can represent (KKR06), and costs statistical
 * verification — the exact trade measured below.
 */
import { Rng } from "../core/rng.js";
import { hoeffdingShots } from "../core/stats.js";
import { totalOf } from "../reductions/makespan.js";

export function classicalWitnessCheck(nums: readonly number[], z: readonly number[], B: number): boolean {
  let load0 = 0;
  for (let i = 0; i < nums.length; i++) {
    if ((z[i] as number) > 0) load0 += nums[i] as number;
  }
  const total = totalOf(nums);
  return Math.max(load0, total - load0) <= B;
}

function makespanOfCode(nums: readonly number[], code: number): number {
  let load0 = 0;
  for (let i = 0; i < nums.length; i++) {
    if ((code >> i) & 1) load0 += nums[i] as number;
  }
  const total = totalOf(nums);
  return Math.max(load0, total - load0);
}

export interface QuantumWitness {
  amps: readonly number[];
}

/** Exact <H> by linear algebra — the referee for the sampled estimator. */
export function quantumEnergyExact(nums: readonly number[], w: QuantumWitness): number {
  const dim = 2 ** nums.length;
  let e = 0;
  for (let code = 0; code < dim; code++) {
    e += (w.amps[code] as number) ** 2 * makespanOfCode(nums, code);
  }
  return e;
}

/** Born-sampled energy estimate with m shots. */
export function quantumEnergySampled(nums: readonly number[], w: QuantumWitness, shots: number, rng: Rng): number {
  const dim = 2 ** nums.length;
  const cum = new Float64Array(dim);
  let acc = 0;
  for (let code = 0; code < dim; code++) {
    acc += (w.amps[code] as number) ** 2;
    cum[code] = acc;
  }
  let s = 0;
  for (let t = 0; t < shots; t++) {
    const r = rng.next() * acc;
    // binary search
    let lo = 0;
    let hi = dim - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cum[mid] as number) < r) lo = mid + 1;
      else hi = mid;
    }
    s += makespanOfCode(nums, lo);
  }
  return s / shots;
}

export interface CoverageTrial {
  eps: number;
  delta: number;
  shots: number;
  empiricalCoverage: number;
  holds: boolean;
}

/** Completeness-side Hoeffding law: P(|est - exact| <= eps) >= 1 - delta. */
export function hoeffdingCoverage(
  nums: readonly number[],
  w: QuantumWitness,
  grid: ReadonlyArray<{ eps: number; delta: number }>,
  trials: number,
  seed: number,
): CoverageTrial[] {
  const rng = new Rng(seed);
  const total = totalOf(nums);
  const range = total / 2; // makespan in [total/2, total]
  const exact = quantumEnergyExact(nums, w);
  return grid.map(({ eps, delta }) => {
    const shots = hoeffdingShots(eps, delta, range);
    let covered = 0;
    for (let t = 0; t < trials; t++) {
      const est = quantumEnergySampled(nums, w, shots, rng);
      if (Math.abs(est - exact) <= eps) covered++;
    }
    const empiricalCoverage = covered / trials;
    return { eps, delta, shots, empiricalCoverage, holds: empiricalCoverage >= 1 - delta - 0.02 };
  });
}

export interface SoundnessTrial {
  gap: number; // multiples of eps above threshold + eps
  delta: number;
  shots: number;
  rejectionRate: number;
  holds: boolean;
}

/** Soundness: a cheating state with <H> = B + (1+gap)*eps is rejected by the accept-if-est <= B+eps rule. */
export function soundness(
  nums: readonly number[],
  B: number,
  eps: number,
  delta: number,
  gaps: readonly number[],
  trials: number,
  seed: number,
): SoundnessTrial[] {
  const rng = new Rng(seed);
  const total = totalOf(nums);
  const range = total / 2;
  const shots = hoeffdingShots(eps, delta, range);
  const n = nums.length;
  const dim = 2 ** n;
  return gaps.map((gap) => {
    // cheating state: uniform over configurations with makespan >= B + (1+gap)*eps
    const flagged: number[] = [];
    for (let code = 0; code < dim; code++) {
      if (makespanOfCode(nums, code) >= B + (1 + gap) * eps) flagged.push(code);
    }
    if (flagged.length === 0) {
      throw new Error("instance too easy: no cheating configurations above the gap");
    }
    const amp = 1 / Math.sqrt(flagged.length);
    const w: QuantumWitness = { amps: Array.from({ length: dim }, (_, code) => (flagged.includes(code) ? amp : 0)) };
    let rejected = 0;
    for (let t = 0; t < trials; t++) {
      const est = quantumEnergySampled(nums, w, shots, rng);
      if (est > B + eps) rejected++;
    }
    const rejectionRate = rejected / trials;
    return { gap, delta, shots, rejectionRate, holds: rejectionRate >= 1 - delta - 0.02 };
  });
}
