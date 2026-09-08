/**
 * The falsifier sharpened (X8) — one more discriminating statistic, as data.
 *
 * A hit-rate decay at the noise boundary has (at least) two competing
 * explanations: symmetric per-qubit READOUT flips, or GLOBAL DEPOLARIZING
 * drift toward uniform. Both can be parameterized to reproduce the same
 * observed hit rate exactly — so the hit rate alone cannot tell them apart.
 * They disagree on the Hamming shells: readout flips move mass from the
 * optimum into its Hamming-1 neighbors, depolarizing drags every shell
 * toward its uniform weight. This kernel fits both models to the same decay,
 * computes each one's predicted Hamming-1 shell mass exactly, and reports
 * whether the gap clears 2 sigma at the shots the budget table plans —
 * separable or not, as found. A Monte Carlo demonstration under the readout
 * truth connects the exact prediction to the existing sampling kernel.
 */
import type { Instance } from "./crossval.js";
import { makeRng, sampleWithReadoutNoise } from "./crossval.js";
import { choose, exactObservedHitRate, exactShellMass, popcount } from "./robust.js";
import { exactProbe } from "./probe.js";

export interface DiscriminatorRow {
  readonly instanceId: string;
  readonly n: number;
  readonly depth: number;
  /** the flip level whose predicted change is the operating point */
  readonly flip: number;
  /** the operating point: the readout model's predicted observed hit rate */
  readonly r: number;
  /** readout fit on the local bracket (residual stated); equals flip by construction here */
  readonly fitFlip: number;
  readonly fitFlipResidual: number;
  /** depolarizing fit: lambda with lambda*p0 + (1-lambda)/2^n = r.
   * lambda > 1 is UNPHYSICAL — it means no depolarizing drift can produce
   * an inflated hit rate, so the sign of the change alone separates the
   * models at this operating point. Reported as found. */
  readonly fitLambda: number;
  readonly depolPhysical: boolean;
  /** Hamming-1 shell mass predicted by the readout model at the fit */
  readonly shell1Readout: number;
  /** Hamming-1 shell mass predicted by the equally-changing depolarizing model */
  readonly shell1Depol: number;
  readonly gap: number;
  /** the shots the allocation table plans at this operating point */
  readonly plannedShots: number;
  /** worst-case one-sigma of the shell-1 estimator at the planned shots */
  readonly sigma: number;
  /** gap >= 2 sigma at a physical operating point, or sign-separated outright */
  readonly separable: boolean;
}

/** Fit the symmetric flip probability to a target observed hit rate, by
 * bisection on the LOCAL bracket [flip/2, min(2 flip, 1/2)] around the
 * stated operating point. The exact rate is NOT monotone in f globally —
 * at low noise and small n it first rises (background inflow through the
 * Hamming-1 shell) and later falls to uniform, so a global bisection finds
 * a spurious second root (measured: fitting r(0.02) on [0, 1/2] returns
 * f = 0.368 with residual 1e-18). The local bracket plus the stated
 * residual is the honest fit; the non-uniqueness itself is reported as a
 * boundary of the statistic, not hidden. */
export function fitReadoutFlip(masses: Float64Array, target: number, flip: number): { fit: number; residual: number } {
  let a = Math.max(0, flip / 2);
  let b = Math.min(0.5, flip * 2);
  let ga = exactObservedHitRate(masses, a) - target;
  for (let it = 0; it < 80; it++) {
    const mid = (a + b) / 2;
    const gm = exactObservedHitRate(masses, mid) - target;
    if (Math.sign(gm) === Math.sign(ga)) {
      a = mid;
      ga = gm;
    } else {
      b = mid;
    }
  }
  const fit = (a + b) / 2;
  return { fit, residual: Math.abs(exactObservedHitRate(masses, fit) - target) };
}

/** The depolarizing mixing parameter that reproduces the same hit rate. */
export function fitDepolarizing(p0: number, n: number, r: number): number {
  const u0 = 1 / 2 ** n;
  return (r - u0) / (p0 - u0);
}

/** Shell mass under global depolarizing at mixing lambda: lambda * ideal + (1 - lambda) * uniform. */
export function depolShellMass(masses: Float64Array, n: number, lambda: number, shell: number): number {
  const u = choose(n, shell) / 2 ** n;
  const ideal = masses[shell] as number;
  return lambda * ideal + (1 - lambda) * u;
}

/** One discriminator row at one operating point. */
export function discriminatorRow(
  masses: Float64Array,
  meta: { instanceId: string; n: number; depth: number },
  flip: number,
  plannedShots: number,
): DiscriminatorRow {
  const p0 = masses[0] as number;
  const r = exactObservedHitRate(masses, flip);
  const { fit, residual } = fitReadoutFlip(masses, r, flip);
  const lam = fitDepolarizing(p0, meta.n, r);
  const depolPhysical = lam >= 0 && lam <= 1;
  const shell1Readout = exactShellMass(masses, fit, 1);
  const shell1Depol = depolShellMass(masses, meta.n, lam, 1);
  const gap = Math.abs(shell1Readout - shell1Depol);
  const worst = Math.max(shell1Readout, shell1Depol);
  const sigma = Math.sqrt((worst * (1 - worst)) / plannedShots);
  return {
    instanceId: meta.instanceId,
    n: meta.n,
    depth: meta.depth,
    flip,
    r,
    fitFlip: fit,
    fitFlipResidual: residual,
    fitLambda: lam,
    depolPhysical,
    shell1Readout,
    shell1Depol,
    gap,
    plannedShots,
    sigma,
    separable: !depolPhysical ? true : gap >= 2 * sigma,
  };
}

/** Monte Carlo under the readout truth: does the sampled shell-1 mass sit
 * where the readout model says and away from the depolarizing prediction?
 * Connects the exact kernel to the existing dry-run sampler (provenance: X3). */
export function mcShellDemo(
  inst: Instance,
  depth: number,
  flip: number,
  shots: number,
  seed: number,
): { shell1Estimate: number; readoutPrediction: number; depolPrediction: number } {
  const probe = exactProbe(inst, depth);
  const res = sampleWithReadoutNoise(probe.psi, inst.n, inst.optBits, shots, flip, makeRng(seed));
  let shell1 = 0;
  for (const [bits, c] of res.counts) if (popcount(bits ^ inst.optBits) === 1) shell1 += c;
  const masses = probe.masses;
  const readout = exactShellMass(masses, flip, 1);
  const lam = fitDepolarizing(masses[0] as number, inst.n, exactObservedHitRate(masses, flip));
  return { shell1Estimate: shell1 / shots, readoutPrediction: readout, depolPrediction: depolShellMass(masses, inst.n, lam, 1) };
}
