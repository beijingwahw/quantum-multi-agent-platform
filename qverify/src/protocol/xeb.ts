/**
 * T4c — XEB (linear cross-entropy) certification: exact expectations, a
 * concrete spoof, and the honest sample wall.
 *
 *  (1) Exact facts, all machine-checked by exact enumeration at n = 8:
 *      - uniform sampler: F_XEB = 0 exactly;
 *      - ideal sampler: F_XEB = 2ⁿ Σp(x)² − 1 (for Porter–Thomas-like
 *        circuits ≈ 2ⁿ·2/(2ⁿ+1) − 1 → close to 1);
 *      - global depolarizing λ: F_XEB = λ·(2ⁿ Σp² − 1) exactly.
 *  (2) Circuit-cut spoof: the product-of-marginals sampler
 *      q(x) = p_A(x_A)·p_B(x_B) (computable with classical cost ~2^{n/2}
 *      via contraction in a real spoof) attains F_XEB > 0 while its total
 *      variation distance from the ideal distribution is large — positive
 *      XEB does not certify the computation. Verified exactly.
 *  (3) Sample wall: XEB verification requires computing p_ideal(x) per
 *      sample — the verifier pays the classical simulation cost. Measured
 *      exact-simulation runtimes across n demonstrate the 2ⁿ scaling.
 */

import { randomCircuit, circuitProbs, sampleIndex, type RandomCircuit } from '../core/gates.js';
import { makeRng, type Rng } from '../core/rng.js';

export interface XebResult {
  name: string;
  fXeb: number;
  /** for MC estimators only; exact computations report null */
  stdErr: number | null;
}

/** 2ⁿ Σ p(x)² − 1 : XEB of sampling from p itself. */
export function xebSelfConsistency(probs: Float64Array): number {
  const n = probs.length;
  let s = 0;
  for (const p of probs) s += p * p;
  return n * s - 1;
}

/** XEB of a fixed alternative distribution q: 2ⁿ Σ_x q(x) p(x) − 1. */
export function xebOfDistribution(q: Float64Array, p: Float64Array): number {
  const dim = p.length;
  let s = 0;
  for (let x = 0; x < dim; x++) s += q[x]! * p[x]!;
  return dim * s - 1;
}

/** Uniform distribution. */
export function uniformDist(dim: number): Float64Array {
  return new Float64Array(dim).fill(1 / dim);
}

/** Global-depolarized distribution λp + (1−λ)uniform. */
export function depolarizedDist(p: Float64Array, lambda: number): Float64Array {
  const q = new Float64Array(p.length);
  const u = 1 / p.length;
  for (let i = 0; i < p.length; i++) q[i] = lambda * p[i]! + (1 - lambda) * u;
  return q;
}

/** Marginals over the first (A) and second (B) half of the qubits; bit order: q0 most significant. */
export function marginals(p: Float64Array, nA: number): { pa: Float64Array; pb: Float64Array } {
  const nB = Math.log2(p.length) - nA;
  const pa = new Float64Array(1 << nA);
  const pb = new Float64Array(1 << nB);
  for (let x = 0; x < p.length; x++) {
    const ai = Math.floor(x / (1 << nB));
    const bi = x % (1 << nB);
    pa[ai] = pa[ai]! + p[x]!;
    pb[bi] = pb[bi]! + p[x]!;
  }
  return { pa, pb };
}

/** Circuit-cut (product-of-marginals) spoof distribution. */
export function cutSpoofDist(p: Float64Array, nA: number): Float64Array {
  const { pa, pb } = marginals(p, nA);
  const q = new Float64Array(p.length);
  const nB = Math.log2(p.length) - nA;
  for (let x = 0; x < p.length; x++) {
    q[x] = pa[Math.floor(x / (1 << nB))]! * pb[x % (1 << nB)]!;
  }
  return q;
}

/** Total variation distance between two distributions. */
export function tvDistance(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!);
  return s / 2;
}

/** MC XEB estimate: 2ⁿ mean(p_ideal(sample)) − 1 for samples drawn from q. */
export function xebMC(q: Float64Array, p: Float64Array, shots: number, rng: Rng): { mean: number; stdErr: number } {
  const dim = p.length;
  const vals: number[] = [];
  for (let s = 0; s < shots; s++) {
    const x = sampleIndex(q, rng);
    vals.push(dim * p[x]! - 1);
  }
  const mean = vals.reduce((a, b) => a + b, 0) / shots;
  const varr = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, shots - 1);
  return { mean, stdErr: Math.sqrt(varr / shots) };
}

/** Sample wall: exact ideal-probability computation cost across sizes (ms per full distribution). */
export function simulationCostCurve(seed: number): Array<{ n: number; layers: number; ms: number }> {
  const out: Array<{ n: number; layers: number; ms: number }> = [];
  for (const n of [8, 10, 12, 14, 16]) {
    const rng = makeRng(seed + n);
    const layers = Math.max(4, n);
    const t0 = process.hrtime.bigint();
    const circuit: RandomCircuit = randomCircuit(rng, n, layers);
    const probs = circuitProbs(circuit);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    let checksum = 0;
    for (const v of probs) checksum += v;
    if (Math.abs(checksum - 1) > 1e-9) throw new Error('probs not normalized');
    out.push({ n, layers, ms });
  }
  return out;
}
