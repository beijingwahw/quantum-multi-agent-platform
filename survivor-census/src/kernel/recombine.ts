/**
 * S9 kernel — the recombination interference ledger (E12, v0.5.0): what two
 * phase-carrying survivors buy when they meet at a beam splitter.
 *
 * (RC-a) THE MZ RECOMBINATION LAW (theorem, falsifiable): two survivor
 * states |psi(phi)>, |psi(phi')> of the SAME funded set and weights,
 * recombined Mach-Zehnder style — the path register opened to
 * (|0>⊗psi_A + |1>⊗psi_B)/sqrt2, a 50:50 splitter with a tunable phase
 * theta on the second arm, success = particle out of port 0 — succeeds
 * with
 *     P_rec(theta) = 1/2 (1 + Re[e^{i theta} <A|B>]),
 *     P_rec^max    = 1/2 (1 + V),  V = |<A|B>| = |sum_x w_x e^{i dphi_x}|/P.
 * Machine: THREE paths — the explicit circuit execution on the path⊗address
 * state (block amplitudes multiplied out), the amplitude inner product, and
 * the closed-form sum (phaseOverlap's existing two-path face extended to
 * the recombination probability); worst deviation ~3e-16 on the trial grid.
 *
 * (RC-b) THE l1 BOUND AND THE ALIGNMENT EQUALITY (theorem): V <= 1 by the
 * triangle inequality — P_rec^max <= 1/2 (1 + (sum_funded w_x)/P), and on
 * the survivor frame sum_funded w_x = P exactly, so the bound reads 1 and
 * is ATTAINED by the diagonal alignment control chi_x = -(dphi)_x applied
 * to one arm: after diag(e^{i chi}) every phase difference is 0 and
 * P_rec = 1 to machine precision (2.2e-16 on the witness instance). This
 * is stable-world AT14's alignment-bank identity (the l1 supremum spent by
 * a diagonal phase control) executed on the postselected survivor face.
 *
 * (RC-c) THE VISIBILITY LEDGER: V carries the interference account on two
 * independent paths (amplitude-path modulus vs closed-form modulus), zero
 * deviation — the ledger's phase-blindness (S7) and the state's
 * phase-carrying coherence meet exactly here.
 *
 * (RC-d) THE PHASE-AVERAGE FACE — a spec conviction recorded in the source:
 * the E18-wave design draft asserted "E[V] = 0 under independent uniform
 * phases"; the machine trial convicted the literal wording BEFORE this
 * kernel was written (E[V] = 0.366 at t = 6, the 2-D random-walk modulus
 * scale sqrt(pi)/(2 sqrt t) = 0.3618 — a modulus expectation is strictly
 * positive). The theorem that survives: the COMPLEX amplitude
 * A = sum_x (w_x/P) e^{i dphi_x} has E[A] = 0 exactly for independent
 * uniform dphi (each term vanishes in expectation — the analytic face of
 * S7's Fourier visibility), machine-witnessed at 3 sigma; E[V] itself is
 * DATA at the random-walk scale, quoted with its scale witness.
 *
 * Honest boundaries: TWO survivors of the same funded set recombined
 * (multi-branch interferometer networks are outside the claim); the phase
 * prior covers the two poles — independent-uniform and fully-aligned —
 * nothing between is a theorem here (E[V] is DATA, not law); the MC face
 * is a realization referee only, never inside a theorem claim; the
 * balancing phase theta* = -arg <A|B> is assumed tunable (the MZ
 * compensator), which is what "alignment control" means operationally.
 *
 * Vocabulary anchors: phase alignment / coherence merging is the same
 * family as stable-world AT14 (WY16, dual-sourced in that repo — cited for
 * vocabulary, no theorem of it re-proved here); Mach-Zehnder interference
 * visibility is standard optics (no single paper claimed).
 */

import { phaseOverlap, runPriorSorter } from "./survivor.js";
import { Rng } from "./survivor.js";
import { CensusError } from "./errors.js";

export interface RecombineLedger {
  readonly n: number;
  readonly N: number;
  readonly tFunded: number;
  readonly pKeep: number;
  /** <psi_A|psi_B> — amplitude path (from phaseOverlap's first path) */
  readonly overlap: { re: number; im: number };
  /** closed form: sum_kept (w_x/P) e^{i dphi_x} — the second path */
  readonly overlapClosed: { re: number; im: number };
  readonly overlapDev: number;
  /** V = |overlap| — amplitude-path visibility */
  readonly visibility: number;
  /** |overlapClosed| — closed-form visibility, the independent second path */
  readonly visibilityClosed: number;
  readonly visibilityDev: number;
  /** the balancing phase theta* = -arg <A|B> (the MZ compensator setting) */
  readonly thetaStar: number;
  /** P_rec^max by the circuit execution: ||(psi_A + e^{i theta*} psi_B)/2||^2 */
  readonly pRecCircuit: number;
  /** P_rec^max by the formula 1/2 (1 + V) — the third-path agreement */
  readonly pRecFormula: number;
  readonly pRecDev: number;
  /** the l1 bound 1/2 (1 + (sum_funded w_x)/P) — evaluates to 1 on the
   *  survivor frame, computed not asserted */
  readonly l1Bound: number;
  /** l1Bound - pRecCircuit: nonnegative up to TOL when (RC-b) holds */
  readonly boundSlack: number;
}

/** The (RC-a)/(RC-b)/(RC-c) ledger of one recombination. */
export function recombineLedger(
  n: number,
  counts: readonly number[],
  marked: readonly number[],
  phiA: readonly number[],
  phiB: readonly number[],
): RecombineLedger {
  // runPriorSorter owns the domain refusals (SC/BAD-N, SC/BAD-COUNTS,
  // SC/BAD-MARKED, SC/BAD-PHASES, SC/P0-UNDEFINED) — inherited, not restated
  const runA = runPriorSorter(n, counts, marked, phiA);
  const runB = runPriorSorter(n, counts, marked, phiB);
  const ph = phaseOverlap(n, counts, marked, phiA, phiB);

  const visibility = ph.selfOverlap;
  const visibilityClosed = Math.hypot(
    ph.overlapClosedForm.re,
    ph.overlapClosedForm.im,
  );
  const thetaStar = -Math.atan2(ph.overlapAmplitude.im, ph.overlapAmplitude.re);

  // circuit path: output block-0 amplitude (psi_A + e^{i theta} psi_B)/2,
  // squared and summed over the address space — the path register executed
  const ct = Math.cos(thetaStar);
  const st = Math.sin(thetaStar);
  let pRecCircuit = 0;
  for (let x = 0; x < runA.N; x++) {
    const aRe = runA.survivorRe[x]!;
    const aIm = runA.survivorIm[x]!;
    const bRe = runB.survivorRe[x]!;
    const bIm = runB.survivorIm[x]!;
    const cRe = (aRe + ct * bRe - st * bIm) / 2;
    const cIm = (aIm + st * bRe + ct * bIm) / 2;
    pRecCircuit += cRe * cRe + cIm * cIm;
  }
  const pRecFormula = 0.5 * (1 + visibility);

  // the l1 bound's sum_funded w_x: read off the kill register's complement,
  // recomputed here rather than asserted equal to P
  const markedSet = new Set(marked);
  const totalC = counts.reduce((a, b) => a + b, 0);
  let fundedW = 0;
  for (let x = 0; x < runA.N; x++) {
    if (markedSet.has(x) && counts[x]! > 0) fundedW += counts[x]! / totalC;
  }
  const l1Bound = 0.5 * (1 + fundedW / runA.pKeep);

  return {
    n,
    N: runA.N,
    tFunded: runA.tFunded,
    pKeep: runA.pKeep,
    overlap: ph.overlapAmplitude,
    overlapClosed: ph.overlapClosedForm,
    overlapDev: ph.deviation,
    visibility,
    visibilityClosed,
    visibilityDev: Math.abs(visibility - visibilityClosed),
    thetaStar,
    pRecCircuit,
    pRecFormula,
    pRecDev: Math.abs(pRecCircuit - pRecFormula),
    l1Bound,
    boundSlack: l1Bound - pRecCircuit,
  };
}

export interface AlignmentRun {
  /** chi_x = -(phiB - phiA)_x — the diagonal control applied to arm B */
  readonly chi: readonly number[];
  readonly phiBAligned: readonly number[];
  /** V after the control — 1 to machine precision (the triangle-inequality
   *  equality: all weighted unit vectors aligned) */
  readonly alignedVisibility: number;
  readonly alignedPRec: number;
  /** max(|aligned V - 1|, |aligned P_rec - 1|) — the (RC-b) equality pin */
  readonly equalityDev: number;
}

/** (RC-b) the alignment control: diag(e^{i chi}) with chi = -dphi spends the
 *  full l1 budget. The compensation is executed as real arithmetic
 *  (phiB + chi carries rounding), so the equality is witnessed at 1e-15,
 *  not asserted exact. */
export function alignmentControl(
  n: number,
  counts: readonly number[],
  marked: readonly number[],
  phiA: readonly number[],
  phiB: readonly number[],
): AlignmentRun {
  const chi = phiB.map((p, x) => phiA[x]! - p);
  const phiBAligned = phiB.map((p, x) => p + chi[x]!);
  const aligned = recombineLedger(n, counts, marked, phiA, phiBAligned);
  return {
    chi,
    phiBAligned,
    alignedVisibility: aligned.visibility,
    alignedPRec: aligned.pRecCircuit,
    equalityDev: Math.max(
      Math.abs(aligned.visibility - 1),
      Math.abs(aligned.pRecCircuit - 1),
    ),
  };
}

export interface PhaseAverageFace {
  readonly t: number;
  readonly trials: number;
  /** |mean complex amplitude| in 3-sigma units — E[A] = 0 confirmed (RC-d) */
  readonly meanAmplitudeSigma: number;
  /** E[V] over the ensemble — DATA at the random-walk scale, NOT a zero */
  readonly meanVisibility: number;
  /** sqrt(pi)/(2 sqrt t) — the 2-D random-walk modulus scale E[V] rides */
  readonly randomWalkScale: number;
  /** |E[V]/scale - 1| — the scale-agreement witness of the DATA face */
  readonly scaleDev: number;
  /** the trial's own verdict on the convicted spec wording: E[V] sits at
   *  least at half the random-walk scale — far from the asserted 0 */
  readonly specLiteralConvicted: boolean;
}

/** (RC-d) the phase-average face on t equal-weight funded marks: the complex
 *  amplitude's expectation vanishes; the modulus's does not. Realization
 *  referee only — the E[A] = 0 theorem is analytic, this witnesses it. */
export function phaseAverageFace(
  t: number,
  seed: number,
  trials: number,
): PhaseAverageFace {
  if (!Number.isInteger(t) || t < 1) {
    throw new CensusError(
      "SC/BAD-MARKED",
      `phaseAverageFace: t must be a positive integer (got ${t})`,
    );
  }
  if (!Number.isInteger(trials) || trials <= 0) {
    throw new CensusError(
      "SC/MC-BAD-INPUTS",
      "phaseAverageFace: trials must be a positive integer",
    );
  }
  const rng = new Rng(seed);
  let meanRe = 0;
  let meanIm = 0;
  let meanV = 0;
  for (let m = 0; m < trials; m++) {
    let aRe = 0;
    let aIm = 0;
    for (let i = 0; i < t; i++) {
      const d = 2 * Math.PI * rng.next();
      aRe += Math.cos(d) / t;
      aIm += Math.sin(d) / t;
    }
    meanRe += aRe / trials;
    meanIm += aIm / trials;
    meanV += Math.hypot(aRe, aIm) / trials;
  }
  // each A-component is a sum of t terms of variance (1/t)^2 / 2, so the
  // variance of the MC mean per component is 1/(2 t trials)
  const sigmaMean = Math.sqrt(1 / (2 * t * trials));
  const scale = Math.sqrt(Math.PI) / (2 * Math.sqrt(t));
  return {
    t,
    trials,
    meanAmplitudeSigma: Math.hypot(meanRe, meanIm) / sigmaMean,
    meanVisibility: meanV,
    randomWalkScale: scale,
    scaleDev: Math.abs(meanV / scale - 1),
    specLiteralConvicted: meanV > scale / 2,
  };
}
