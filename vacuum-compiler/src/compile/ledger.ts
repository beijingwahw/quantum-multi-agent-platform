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
import { type CMat, type CVec, cmatApply, cvecInner } from "../core/cmat.js";
import { spectralEvolve } from "./history.js";

/** Shannon entropy of a uniform distribution on N outcomes, in bits. */
export function uniformEntropyBits(n: number): number {
  return Math.log2(n);
}

/** Expected number of attempts to hit "success" with probability p per try
 * (geometric), plus a seeded Monte-Carlo cross-check. */
export function geometricAttempts(p: number, rng: Rng, trials = 10000): { mean: number; mc: number } {
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
 * probability p (fueled / walk modes): (1/p)·log2(T+1) bits. */
export function expectedErasureBits(probSuccess: number, clockStates: number): number {
  return expectedErasureBitsRaw(probSuccess, uniformEntropyBits(clockStates));
}

function expectedErasureBitsRaw(p: number, entropyBits: number): number {
  return entropyBits / p;
}

/** Direct comparison baseline: running the circuit costs T unitary gates and
 * ZERO erasure — unitary evolution is reversible. This is the wall the README
 * states plainly: the vacuum never beats running the program. */
export function directExecutionErasureBits(): number {
  return 0;
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
  const hp = cmatApply(h, psi);
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
