/**
 * The parameter-robustness kernel (X7) — the transfer census.
 * The offline-optimal parameters were found against the exact statevector;
 * this kernel measures, as exact data, how far that optimality survives:
 * a perturbation grid around the optimum (depths already used), the
 * objective's curvature at the grid points, and the predicted on-QPU
 * degradation band under the synthetic readout model — exact, because the
 * symmetric per-qubit flip channel acts on Hamming-distance shells, and the
 * shells are read exactly off the statevector. No Monte Carlo anywhere in
 * this file.
 */
import type { QaoaParams } from "./crossval.js";
import { expectation, runQaoa } from "./crossval.js";
import type { ExactProbe } from "./probe.js";

/** Hamming weight of a 32-bit pattern (Kernighan-free branchless form). */
export function popcount(x: number): number {
  let v = x >>> 0;
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  v = (v + (v >>> 4)) & 0x0f0f0f0f;
  return (Math.imul(v, 0x01010101) >>> 24) & 0x3f;
}

/** Exact |psi_s|^2 mass by Hamming distance d(s, ref) — one statevector pass. */
export function distanceMasses(psi: Float64Array, n: number, ref: number): Float64Array {
  const half = psi.length >> 1;
  const m = new Float64Array(n + 1);
  for (let k = 0; k < half; k++) {
    m[popcount(k ^ ref)]! += psi[k]! * psi[k]! + (psi[half + k] as number) * (psi[half + k] as number);
  }
  return m;
}

/** Exact binomial coefficient C(n, k), n <= 32 (exact in doubles). */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

/**
 * Flip kernel T[d][d']: probability that a state at distance d from the
 * reference lands at distance d' after independent symmetric per-qubit
 * flips. T[d][0] = f^d (1-f)^(n-d); rows sum to 1 (the channel is unital
 * and distance-labeled states form a complete partition).
 */
export function flipKernel(n: number, f: number): Float64Array[] {
  const T: Float64Array[] = [];
  for (let d = 0; d <= n; d++) {
    const row = new Float64Array(n + 1);
    for (let j = 0; j <= d; j++) {
      // j of the d differing bits flip (each fix removes 1 from distance)
      const pDiff = choose(d, j) * f ** j * (1 - f) ** (d - j);
      for (let k = 0; k <= n - d; k++) {
        // k of the n-d matching bits flip (each adds 1 to distance)
        const pMatch = choose(n - d, k) * f ** k * (1 - f) ** (n - d - k);
        const dp = d - j + k;
        row[dp] = row[dp]! + pDiff * pMatch;
      }
    }
    T.push(row);
  }
  return T;
}

/**
 * The exact observed hit rate under the synthetic readout model:
 * sum over shells of mass(d) * P(d -> 0). This is the exact expectation of
 * sampleWithReadoutNoise's Monte Carlo — the dry-run QPU's own anchor.
 * f = 0 returns mass(0) = |psi_opt|^2; f = 1/2 returns 1/2^n exactly.
 */
export function exactObservedHitRate(masses: Float64Array, f: number): number {
  const n = masses.length - 1;
  let r = 0;
  for (let d = 0; d <= n; d++) r += (masses[d] as number) * f ** d * (1 - f) ** (n - d);
  return r;
}

/** Exact probability of landing in the Hamming-1 shell of the optimum. */
export function exactShellMass(masses: Float64Array, f: number, shell: number): number {
  const n = masses.length - 1;
  const T = flipKernel(n, f);
  let m = 0;
  for (let d = 0; d <= n; d++) m += (masses[d] as number) * (T[d] as Float64Array)[shell]!;
  return m;
}

// ---------------------------------------------------------------------------
// The perturbation census — the objective's response around the offline
// optimum, as data. One angle at a time (coordinate probes at the depths the
// pipeline already uses), exact statevector evaluation at every point.
// ---------------------------------------------------------------------------

export interface PerturbRow {
  readonly instanceId: string;
  readonly depth: number;
  readonly angle: string; // "beta0" | "gamma0" | "beta1" | ...
  readonly delta: number;
  /** E(theta - delta e_i) - E* — exact, never negative at a local optimum */
  readonly dEminus: number;
  /** E(theta + delta e_i) - E* */
  readonly dEplus: number;
  /** discrete curvature (E+ - 2 E* + E-) / delta^2 */
  readonly curvature: number;
}

export interface PerturbCensus {
  readonly instanceId: string;
  readonly depth: number;
  readonly params: QaoaParams;
  readonly eStar: number;
  readonly rows: readonly PerturbRow[];
}

/** The census grid: coordinate deltas in radians around the offline optimum. */
export const CENSUS_DELTAS: readonly number[] = [0.01, 0.05, 0.1, 0.25];
/** The degradation band edges: symmetric flip probability range. */
export const CENSUS_BAND: readonly [number, number] = [0.01, 0.05];

/** Census for one probe (instance, depth): every angle x every delta. */
export function perturbCensus(probe: ExactProbe, deltas: readonly number[]): PerturbCensus {
  const { inst, depth, params, costs, eStar } = probe;
  const rows: PerturbRow[] = [];
  for (let l = 0; l < depth; l++) {
    for (const which of ["beta", "gamma"] as const) {
      const angle = `${which}${l}`;
      for (const delta of deltas) {
        const vals: [number, number] = [0, 0];
        for (const s of [-1, 1] as const) {
          const betas = [...params.betas];
          const gammas = [...params.gammas];
          if (which === "beta") betas[l] = (betas[l] as number) + s * delta;
          else gammas[l] = (gammas[l] as number) + s * delta;
          vals[s < 0 ? 0 : 1] = expectation(runQaoa(inst, { betas, gammas }), costs);
        }
        const [em, ep] = vals;
        rows.push({
          instanceId: inst.id,
          depth,
          angle,
          delta,
          dEminus: em - eStar,
          dEplus: ep - eStar,
          curvature: (ep - 2 * eStar + em) / (delta * delta),
        });
      }
    }
  }
  return { instanceId: inst.id, depth, params, eStar, rows };
}

/** The census's headline numbers for one (instance, depth). */
export interface RobustSummary {
  readonly instanceId: string;
  readonly n: number;
  readonly depth: number;
  readonly eStar: number;
  /** worst objective rise over the whole perturbation grid */
  readonly maxdE: number;
  /** best objective IMPROVEMENT over the grid (negative when the coarse
   * optimizer left slack — as found, reported; not hidden) */
  readonly maxGain: number;
  /** smallest curvature over the grid (the flattest direction) */
  readonly minCurvature: number;
  /** largest curvature over the grid */
  readonly maxCurvature: number;
  /** exact hit rate at f=0 — the no-decay null of the budget table */
  readonly p0: number;
  /** predicted observed hit rate at the band edges [fLo, fHi] */
  readonly band: readonly [number, number];
  /** the offline parameter vector the census probed around */
  readonly params: QaoaParams;
}

/** Summary for one probe: curvature extremes + degradation band. */
export function robustSummary(probe: ExactProbe, deltas: readonly number[], bandEdges: readonly [number, number]): RobustSummary {
  const census = perturbCensus(probe, deltas);
  let maxdE = -Infinity;
  let maxGain = Infinity;
  let minCurv = Infinity;
  let maxCurv = -Infinity;
  for (const r of census.rows) {
    maxdE = Math.max(maxdE, r.dEminus, r.dEplus);
    maxGain = Math.min(maxGain, r.dEminus, r.dEplus);
    minCurv = Math.min(minCurv, r.curvature);
    maxCurv = Math.max(maxCurv, r.curvature);
  }
  const masses = probe.masses;
  const [fLo, fHi] = bandEdges;
  return {
    instanceId: probe.inst.id,
    n: probe.inst.n,
    depth: probe.depth,
    eStar: census.eStar,
    maxdE,
    maxGain,
    minCurvature: minCurv,
    maxCurvature: maxCurv,
    p0: masses[0] as number,
    band: [exactObservedHitRate(masses, fHi), exactObservedHitRate(masses, fLo)],
    params: census.params,
  };
}
