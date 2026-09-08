/**
 * PHASE-LAW v0.5.0 — NON-UNIFORM PER-PAIR BONUSES (PL19): each entangled
 * pair i carries its OWN bonus λ_i, so the welfare becomes
 *      W_λ(c) = W_0(c) + Σ_{i realized} λ_i
 * and the k+1-line envelope (PL14) becomes 2^k PLANES:
 *      opt(λ) = max over subsets S ⊆ [k] of ( D_S + Σ_{i∈S} λ_i ),
 *      D_S = max W_0 over assignments realizing EXACTLY S.
 * Identities on trial: (a) the subset-envelope identity (exact);
 * (b) the all-k right face (slots + matching, bonus Σλ_i — exact);
 * (c) the MONOTONE-COUNT staircase: on the uniform ray it is a theorem
 * (PL14); on a general ray λ(t) = t·μ the exchange argument says a count
 * drop A → B (|A| > |B|, t₂ > t₁) forces slope(A) < slope(B) — impossible
 * at k ≤ 2 (every 2-set slope dominates every 1-set), possible from k = 3
 * with a DOMINANT pair (μ₁ > μ₂ + μ₃). The machine decides which side the
 * data lands on; both outcomes are reported as found.
 */
import { makeRng } from "../core/rng.js";
import { hungarianMax } from "./law.js";

export interface NuInstance {
  readonly m: number;
  readonly n: number;
  readonly seed: number;
  /** per-pair bonuses, length k: pair i is (agents 2i, 2i+1) */
  readonly lambdas: readonly number[];
  readonly weights: readonly number[][];
}

/** Same weights as makeKPairInstance/makeInstance for the same (m, n, seed) —
 * the k=1 and uniform cases must reproduce the older families bit-for-bit. */
export function makeNuInstance(m: number, n: number, seed: number, lambdas: readonly number[]): NuInstance {
  const r = makeRng(seed);
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => Math.round((0.15 + 0.7 * r()) * 1000) / 1000),
  );
  return { m, n, seed, lambdas, weights };
}

export interface NuAssignment {
  readonly assignment: readonly number[];
  /** bitmask of realized pairs (bit i = pair i) */
  readonly mask: number;
  readonly w0: number;
  readonly welfare: number;
}

/** Enumerate ALL assignments with realized-pair masks — the referee. */
export function enumerateNu(inst: NuInstance): NuAssignment[] {
  const k = inst.lambdas.length;
  const out: NuAssignment[] = [];
  const current = new Array<number>(inst.m).fill(-1);
  const used = new Array<boolean>(inst.n).fill(false);
  const rec = (t: number, w0: number): void => {
    if (t === inst.m) {
      let mask = 0;
      let bonus = 0;
      for (let i = 0; i < k; i++) {
        if (current.includes(2 * i) && current.includes(2 * i + 1)) {
          mask |= 1 << i;
          bonus += inst.lambdas[i]!;
        }
      }
      out.push({ assignment: current.slice(), mask, w0, welfare: w0 + bonus });
      return;
    }
    for (let a = 0; a < inst.n; a++) {
      if (used[a]!) continue;
      used[a] = true;
      current[t] = a;
      rec(t + 1, w0 + inst.weights[t]![a]!);
      used[a] = false;
      current[t] = -1;
    }
  };
  rec(0, 0);
  return out;
}

export function nuOptimum(inst: NuInstance): NuAssignment {
  let best: NuAssignment | undefined;
  for (const a of enumerateNu(inst)) {
    if (best === undefined || a.welfare > best.welfare) best = a;
  }
  if (best === undefined) throw new Error("empty assignment space");
  return best;
}

/** The subset-envelope data: D[mask] = max W_0 over assignments realizing
 * EXACTLY mask (null = no assignment realizes that mask). */
export function nuSubsetEnvelope(inst: NuInstance): { d: ReadonlyArray<number | null> } {
  const k = inst.lambdas.length;
  const d = new Array<number | null>(1 << k).fill(null);
  for (const a of enumerateNu({ ...inst, lambdas: inst.lambdas.map(() => 0) })) {
    const prev = d[a.mask] ?? null;
    if (prev === null || a.w0 > prev) d[a.mask] = a.w0;
  }
  return { d };
}

/** The envelope value: max over subsets of D_S + Σ_{i∈S} λ_i. */
export function nuEnvelopeValue(lambdas: readonly number[], d: ReadonlyArray<number | null>): number {
  let best = -Infinity;
  for (let mask = 0; mask < d.length; mask++) {
    const w0 = d[mask] ?? null;
    if (w0 === null) continue;
    let bonus = 0;
    for (let i = 0; i < lambdas.length; i++) if (mask & (1 << i)) bonus += lambdas[i]!;
    const v = w0 + bonus;
    if (v > best) best = v;
  }
  return best;
}

/** IDENTITY (a) on trial: the subset envelope === the enumerated optimum. */
export function nuEnvelopeDeviation(inst: NuInstance): number {
  const { d } = nuSubsetEnvelope(inst);
  return Math.abs(nuEnvelopeValue(inst.lambdas, d) - nuOptimum(inst).welfare);
}

// ---------------------------------------------------------------------------
// IDENTITY (c) on trial: the monotone-count staircase on rays λ(t) = t·μ.
// ---------------------------------------------------------------------------

export interface RayPoint {
  readonly t: number;
  readonly count: number; // |argmax_S (D_S + t·μ(S))|, tie-break to the FIRST max
  readonly mask: number;
}

/** The realized-count staircase along a ray, from the subset envelope. */
export function nuRay(m: number, n: number, seed: number, mus: readonly number[], ts: readonly number[]): RayPoint[] {
  const base = makeNuInstance(m, n, seed, mus.map(() => 0));
  const { d } = nuSubsetEnvelope(base);
  return ts.map((t) => {
    let bestMask = 0;
    let bestV = -Infinity;
    let bestCount = 0;
    for (let mask = 0; mask < d.length; mask++) {
      const w0 = d[mask] ?? null;
      if (w0 === null) continue;
      let slope = 0;
      let count = 0;
      for (let i = 0; i < mus.length; i++) {
        if (mask & (1 << i)) {
          slope += mus[i]!;
          count++;
        }
      }
      const v = w0 + t * slope;
      if (v > bestV) {
        bestV = v;
        bestMask = mask;
        bestCount = count;
      }
    }
    return { t, count: bestCount, mask: bestMask };
  });
}

export interface DescentWitness {
  readonly m: number;
  readonly n: number;
  readonly seed: number;
  readonly mus: readonly number[];
  readonly t1: number;
  readonly t2: number;
  readonly count1: number;
  readonly count2: number;
  readonly mask1: number;
  readonly mask2: number;
}

/**
 * Hunt a count DESCENT on non-uniform rays: the smallest t-grid descent where
 * the argmax realized count drops. Scans μ patterns × seeds; returns the first
 * witness found (exact coordinates) or null — both outcomes are the answer.
 */
export function nuFindDescent(
  m: number,
  n: number,
  k: number,
  muPatterns: ReadonlyArray<readonly number[]>,
  seedFrom: number,
  seedTo: number,
  ts: readonly number[],
): DescentWitness | null {
  for (const mus of muPatterns) {
    if (mus.length !== k) throw new Error(`nuFindDescent: μ pattern length ${mus.length} ≠ k ${k}`);
    for (let seed = seedFrom; seed <= seedTo; seed++) {
      const ray = nuRay(m, n, seed, mus, ts);
      for (let i = 1; i < ray.length; i++) {
        if (ray[i]!.count < ray[i - 1]!.count) {
          return {
            m,
            n,
            seed,
            mus,
            t1: ray[i - 1]!.t,
            t2: ray[i]!.t,
            count1: ray[i - 1]!.count,
            count2: ray[i]!.count,
            mask1: ray[i - 1]!.mask,
            mask2: ray[i]!.mask,
          };
        }
      }
    }
  }
  return null;
}

/** The exchange-argument control: every 2-set slope dominates every 1-set at
 * k ≤ 2, so descents are IMPOSSIBLE there — the machine must find zero. */
export function nuRayDescentCount(
  m: number,
  n: number,
  k: number,
  muPatterns: ReadonlyArray<readonly number[]>,
  seedFrom: number,
  seedTo: number,
  ts: readonly number[],
): number {
  let descents = 0;
  for (const mus of muPatterns) {
    if (mus.length !== k) throw new Error(`nuRayDescentCount: μ pattern length ${mus.length} ≠ k ${k}`);
    for (let seed = seedFrom; seed <= seedTo; seed++) {
      const ray = nuRay(m, n, seed, mus, ts);
      for (let i = 1; i < ray.length; i++) {
        if (ray[i]!.count < ray[i - 1]!.count) descents++;
      }
    }
  }
  return descents;
}

// ---------------------------------------------------------------------------
// IDENTITY (b) on trial: the ALL-k right face under non-uniform bonuses —
// when the optimum realizes every pair, it is slots + matching with bonus
// Σλ_i (PL15's twin). Guards on the regime via the subset envelope.
// ---------------------------------------------------------------------------

export function nuAllKOptimum(inst: NuInstance): number {
  const { m, weights, lambdas } = inst;
  const k = lambdas.length;
  if (2 * k > m) throw new Error("nuAllKOptimum: all-k regime requires m ≥ 2k — wrong object");
  // every pair agent (0..2k−1) must be USED: force coverage by augmenting
  // every slot edge by M = m + 1 (> any welfare difference, weights < 1) —
  // the max-weight matching then fills all 2k slots first (PL15's two-stage
  // slots+matching is the m = 2k case; this handles m > 2k with ONE pass).
  const M = m + 1;
  const augmented = weights.map((row) => row.map((w, a) => (a < 2 * k ? w + M : w)));
  const assign = hungarianMax(augmented);
  let total = 0;
  let slotsUsed = 0;
  for (let t = 0; t < m; t++) {
    const a = assign[t]!;
    if (a < 2 * k) slotsUsed++;
    total += inst.weights[t]![a]!;
  }
  if (slotsUsed !== 2 * k) {
    throw new Error("nuAllKOptimum: coverage trick failed to fill the slots — wrong object");
  }
  let w = total;
  for (const lambda of lambdas) w += lambda;
  return w;
}

/** Is the optimum in the all-k regime? (subset envelope: full mask must win
 * or tie against every other mask). */
export function nuInAllKRegime(inst: NuInstance): boolean {
  const { d } = nuSubsetEnvelope(inst);
  const full = (1 << inst.lambdas.length) - 1;
  if (d[full] === null) return false;
  const val = (mask: number): number | null => {
    const w0 = d[mask] ?? null;
    if (w0 === null) return null;
    let bonus = 0;
    for (let i = 0; i < inst.lambdas.length; i++) if (mask & (1 << i)) bonus += inst.lambdas[i]!;
    return w0 + bonus;
  };
  const fullV = val(full)!;
  for (let mask = 0; mask < d.length; mask++) {
    if (mask === full) continue;
    const v = val(mask);
    if (v !== null && v > fullV + 1e-12) return false;
  }
  return true;
}

export function nuAllKDeviation(inst: NuInstance): number {
  if (!nuInAllKRegime(inst)) {
    throw new Error("nuAllKDeviation: not in the all-k regime — wrong object");
  }
  return Math.abs(nuAllKOptimum(inst) - nuOptimum(inst).welfare);
}
