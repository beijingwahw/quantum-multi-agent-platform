/**
 * The energy ledger — where the "zero-energy" claim is audited, not asserted.
 *
 * Static mode: storage costs nothing (an eigenstate in a closed system does
 * no work), but reading the clock costs erasing the record of a uniform
 * T+1-outcome measurement: log2(T+1) bits per attempt, expected (T+1)
 * attempts to land on step T. The expected clock-record erasure is therefore
 * (T+1)·log2(T+1) bits = (T+1)·log2(T+1)·kT·ln2 in joules at temperature T.
 *
 * Landauer's constant appears symbolically; the ledger unit is BITS —
 * multiply by kT ln2 for energy (LAND61, citation verified in-house).
 */
import type { Rng } from "./rng.js";
import { type CMat, type CVec, cmatApply, cvecInner, requireWellFormed, requireWellFormedVec, VacuumError } from "../core/cmat.js";
import { spectralEvolve } from "./history.js";

/** Shannon entropy of a uniform distribution on N outcomes, in bits. */
export function uniformEntropyBits(n: number): number {
  if (!Number.isInteger(n) || n < 1) {
    throw new VacuumError("ledger/outcomes-out-of-domain", `uniformEntropyBits: ${n} (need >= 1 outcome)`);
  }
  return Math.log2(n);
}

/** Expected number of attempts to hit "success" with probability p per try
 * (geometric), plus a seeded Monte-Carlo cross-check.
 * v0.3.0 conviction: p outside (0, 1] used to hang the caller (p = 0 never
 * succeeds — an infinite draw loop) or return a sub-unit "mean" (p > 1);
 * both are now named rejections. */
export function geometricAttempts(p: number, rng: Rng, trials = 10000): { mean: number; mc: number } {
  if (!(p > 0 && p <= 1)) {
    throw new VacuumError("ledger/probability-out-of-domain", `geometricAttempts: p = ${p}, expected (0, 1]`);
  }
  if (!Number.isInteger(trials) || trials < 1) {
    throw new VacuumError("ledger/trials-out-of-domain", `geometricAttempts: trials = ${trials}, expected a positive integer`);
  }
  const mean = 1 / p;
  let total = 0;
  for (let i = 0; i < trials; i++) {
    let attempts = 1;
    while (!rng.bernoulli(p)) attempts++;
    total += attempts;
  }
  return { mean, mc: total / trials };
}

/** Expected clock-record erasure, static mode, in bits. */
export function staticExpectedErasureBits(clockStates: number): number {
  return clockStates * uniformEntropyBits(clockStates);
}

/** Expected clock-record erasure for an arbitrary per-attempt success
 * probability p (fueled / walk modes): (1/p)·log2(T+1) bits. THE single
 * definition of the erasure-price formula (the tariff's display float and
 * exp3's wall table route through here — the former local copies were
 * bit-identical duplicates, retired v0.3.0). */
export function expectedErasureBits(probSuccess: number, clockStates: number): number {
  if (!(probSuccess > 0 && probSuccess <= 1)) {
    throw new VacuumError("ledger/probability-out-of-domain", `expectedErasureBits: p = ${probSuccess}, expected (0, 1]`);
  }
  return uniformEntropyBits(clockStates) / probSuccess;
}

// ---------------------------------------------------------------------------
// The walk's coherent time-energy price (v0.2.0, priced one step deeper)
// ---------------------------------------------------------------------------

/** Energy spread sigma_E = sqrt(<H^2> - <H>^2) of a state — the COHERENT
 * resource the free-clock walk spends. Under H-evolution sigma_E is exactly
 * conserved (measured, not assumed: the walk table re-checks it at the peak
 * time). Mandelstam–Tamm: any orthogonalizing evolution takes time at least
 * pi/(2 sigma_E), the anchor lower bound for the walk's timescale. */
export function energySpread(h: CMat, psi: CVec): number {
  requireWellFormed(h, "energySpread");
  requireWellFormedVec(psi, "energySpread");
  const hp = cmatApply(h, psi); // also enforces h.dim === psi.dim, by name
  const mean = cvecInner(psi, hp).re;
  const meanSq = cvecInner(hp, hp).re;
  return Math.sqrt(Math.max(meanSq - mean * mean, 0));
}

export interface PricedWalk {
  readonly peak: number;
  readonly tStar: number;
  /** sigma_E at t = 0 and re-measured at t = tStar (conservation check) */
  readonly sigmaE0: number;
  readonly sigmaEStar: number;
  /** t* · sigma_E — the coherent time-energy product actually spent */
  readonly product: number;
  /** Mandelstam–Tamm orthogonalization floor pi/(2 sigma_E) */
  readonly mtFloor: number;
  readonly samples: ReadonlyArray<{ t: number; p: number }>;
}

/** The priced free-clock walk: evolve psi0 under the compiled Hamiltonian's
 * spectral flow, track P(clock = T), and price the delivery — peak
 * probability, the coherent time t* it peaks at, the conserved energy
 * spread, and the time-energy product against the MT floor. */
export function pricedWalk(
  h: CMat,
  eig: { values: Float64Array; vectors: CVec[] },
  psi0: CVec,
  clockStates: number,
  tMax: number,
  step = 0.25,
): PricedWalk {
  if (!(step > 0)) {
    throw new VacuumError("ledger/walk-step-out-of-domain", `pricedWalk: step = ${step}, expected > 0 (a non-positive step never advances the sweep)`);
  }
  if (!(tMax >= 0)) {
    throw new VacuumError("ledger/walk-horizon-out-of-domain", `pricedWalk: tMax = ${tMax}, expected >= 0`);
  }
  if (!Number.isInteger(clockStates) || clockStates < 1 || psi0.dim % clockStates !== 0) {
    throw new VacuumError("readout/clock-not-divisor", `pricedWalk: state dim ${psi0.dim} is not a multiple of clockStates ${clockStates}`);
  }
  const C = clockStates;
  const D = psi0.dim / C;
  const pAtT = (psi: CVec): number => {
    let p = 0;
    for (let d = 0; d < D; d++) {
      const i = d * C + (C - 1);
      p += (psi.re[i] as number) ** 2 + (psi.im[i] as number) ** 2;
    }
    return p;
  };
  const sigmaE0 = energySpread(h, psi0);
  let peak = 0;
  let tStar = 0;
  const samples: Array<{ t: number; p: number }> = [];
  for (let t = 0; t <= tMax + 1e-9; t += step) {
    const p = pAtT(spectralEvolve(eig, psi0, t));
    samples.push({ t: Number(t.toFixed(4)), p });
    if (p > peak) {
      peak = p;
      tStar = t;
    }
  }
  const sigmaEStar = energySpread(h, spectralEvolve(eig, psi0, tStar));
  return { peak, tStar, sigmaE0, sigmaEStar, product: tStar * sigmaE0, mtFloor: Math.PI / (2 * sigmaE0), samples };
}
