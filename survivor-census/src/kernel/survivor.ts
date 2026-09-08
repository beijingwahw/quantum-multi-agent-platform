/**
 * S1/S2/S4 kernel — the survivor of the many-worlds sorter, executed.
 *
 * postselect-sched's sorter (src/kernel/sorter.ts) conditions the UNIFORM
 * superposition: every branch enters with 1/sqrt(N), the survivor is uniform
 * over the marked set, and at t=1 the conditional address is exactly |x*>.
 * That is the whole story only if the sorter is handed a uniform prior.
 *
 * This kernel conditions a WEIGHTED superposition: alpha_x = sqrt(c_x/C) *
 * e^{i phi_x} with integer counts c_x >= 0. What the postselection keeps is
 * then not "the optimum" but the prior-weighted posterior over optima —
 * BAY63's inverse-probability step executed on branch amplitudes:
 *
 *   P(x kept-set member | flag=1) = c_x / sum_{y kept} c_y
 *
 * Everything is exact algebra on two independent paths: the amplitude path
 * (complex state, normalized by the kept norm) and the integer path (counts).
 * Sampling appears only as a realization referee in the experiments, never
 * inside a theorem claim.
 */

import { CensusError } from "./errors.js";

export interface KillRow {
  readonly x: number;
  readonly mass: number;
  /** the exact integer ratio behind the mass: c_x / totalC */
  readonly count: number;
  readonly totalC: number;
}

export interface PriorSorterRun {
  readonly n: number;
  readonly N: number;
  /** raw marked-set size (zero-weight members counted — they are marked but not funded) */
  readonly tRaw: number;
  /** funded marked-set size (positive prior weight — the actual survivors) */
  readonly tFunded: number;
  /** P(flag=1), amplitude path */
  readonly pKeep: number;
  /** integer path: sum of kept counts / total count */
  readonly pKeepInteger: number;
  readonly pKeepDev: number;
  /** survivor amplitudes (re/im over the address space, phases kept) */
  readonly survivorRe: Float64Array;
  readonly survivorIm: Float64Array;
  /** address-basis reading of the survivor — the posterior, amplitude path */
  readonly posterior: Float64Array;
  /** integer path: c_x / sum of kept counts */
  readonly posteriorInteger: Float64Array;
  readonly posteriorDev: number;
  /** max |amplitude| outside the funded marked set after conditioning (exactly 0) */
  readonly offMarkedLeak: number;
  /** marked indices with zero prior weight: optimal on paper, never come back */
  readonly unfundedOptima: readonly number[];
  /** the itemized register of the killed universes */
  readonly killRegister: readonly KillRow[];
  /** sum of kill masses — register path */
  readonly killedTotal: number;
  /** 1 - pKeep — complement path */
  readonly killedComplement: number;
  readonly killedDev: number;
  /** amortized killed mass per confirmed survivor: (1-P)/P — the failure odds */
  readonly oddsPerSurvivor: number;
}

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
}

export function runPriorSorter(
  n: number,
  counts: readonly number[],
  markedInput: readonly number[],
  phases?: readonly number[],
): PriorSorterRun {
  if (!Number.isInteger(n) || n < 0) {
    throw new CensusError("SC/BAD-N", "runPriorSorter: n must be a non-negative integer (the address space is 2^n)");
  }
  const N = 2 ** n;
  if (counts.length !== N) {
    throw new CensusError("SC/BAD-COUNTS", "runPriorSorter: count table must have length 2^n");
  }
  if (counts.some((c) => c < 0 || !Number.isInteger(c))) {
    throw new CensusError("SC/BAD-COUNTS", "runPriorSorter: counts must be non-negative integers");
  }
  const totalC = counts.reduce((a, b) => a + b, 0);
  if (totalC <= 0) throw new CensusError("SC/BAD-COUNTS", "runPriorSorter: total count must be positive");
  const marked = [...new Set(markedInput)];
  if (marked.length === 0) {
    throw new CensusError("SC/BAD-MARKED", "runPriorSorter: at least one marked item required");
  }
  if (marked.some((x) => x < 0 || x >= N)) {
    throw new CensusError("SC/BAD-MARKED", "runPriorSorter: marked out of range");
  }
  const markedSet = new Set(marked);

  const phi = new Float64Array(N);
  if (phases !== undefined) {
    if (phases.length !== N) {
      throw new CensusError("SC/BAD-PHASES", "runPriorSorter: phase table must have length 2^n");
    }
    for (let x = 0; x < N; x++) {
      const p = phases[x]!;
      if (!Number.isFinite(p)) {
        throw new CensusError("SC/BAD-PHASES", `runPriorSorter: phase at x=${x} is not finite (angles are real radians)`);
      }
      phi[x] = p;
    }
  }

  // zero-norm conditioning is undefined — the P=0 face is a thrown error,
  // not a number: the sorter has no output when nothing funds the optimum
  let keptC = 0;
  for (const x of marked) keptC += counts[x]!;
  if (keptC === 0) {
    throw new CensusError(
      "SC/P0-UNDEFINED",
      "runPriorSorter: zero-branch conditioning undefined — no funded optimum (existence presupposition)",
    );
  }

  const weights = new Float64Array(N);
  for (let x = 0; x < N; x++) weights[x] = counts[x]! / totalC;

  // amplitude path: keep = project onto funded marked, renormalize
  let pKeep = 0;
  for (let x = 0; x < N; x++) if (markedSet.has(x)) pKeep += weights[x]!;
  const norm = Math.sqrt(pKeep);
  const survivorRe = new Float64Array(N);
  const survivorIm = new Float64Array(N);
  const posterior = new Float64Array(N);
  const posteriorInteger = new Float64Array(N);
  const unfundedOptima: number[] = [];
  let posteriorDev = 0;
  let offMarkedLeak = 0;
  let tFunded = 0;
  for (let x = 0; x < N; x++) {
    const isMarked = markedSet.has(x);
    if (!isMarked) continue;
    const w = weights[x]!;
    if (w === 0) {
      unfundedOptima.push(x);
      continue;
    }
    tFunded++;
    const amp = Math.sqrt(w) / norm;
    survivorRe[x] = amp * Math.cos(phi[x]!);
    survivorIm[x] = amp * Math.sin(phi[x]!);
    posterior[x] = amp * amp;
    posteriorInteger[x] = counts[x]! / keptC;
    const d = Math.abs(posterior[x]! - posteriorInteger[x]!);
    if (d > posteriorDev) posteriorDev = d;
  }
  for (let x = 0; x < N; x++) {
    const leak = Math.hypot(survivorRe[x]!, survivorIm[x]!);
    if (!markedSet.has(x) || weights[x]! === 0) {
      if (leak > offMarkedLeak) offMarkedLeak = leak;
    }
  }

  // kill register: every universe NOT in the funded marked set, itemized
  const killRegister: KillRow[] = [];
  let killedTotal = 0;
  for (let x = 0; x < N; x++) {
    const isKept = markedSet.has(x) && weights[x]! > 0;
    if (isKept) continue;
    const mass = weights[x]!;
    killRegister.push({ x, mass, count: counts[x]!, totalC });
    killedTotal += mass;
  }
  const killedComplement = 1 - pKeep;

  return {
    n,
    N,
    tRaw: marked.length,
    tFunded,
    pKeep,
    pKeepInteger: keptC / totalC,
    pKeepDev: Math.abs(pKeep - keptC / totalC),
    survivorRe,
    survivorIm,
    posterior,
    posteriorInteger,
    posteriorDev,
    offMarkedLeak,
    unfundedOptima,
    killRegister,
    killedTotal,
    killedComplement,
    killedDev: Math.abs(killedTotal - killedComplement),
    oddsPerSurvivor: killedComplement / pKeep,
  };
}

export interface PhaseRun {
  /** <survivor(phi) | survivor(phi')> on the amplitude path */
  readonly overlapAmplitude: { re: number; im: number };
  /** closed form: sum_{kept} w_x e^{i (phi' - phi)_x} / P */
  readonly overlapClosedForm: { re: number; im: number };
  readonly deviation: number;
  /** |overlap| for phi' = phi (self-overlap — exactly 1, the survivor is one pure state) */
  readonly selfOverlap: number;
}

/**
 * The coherence face: postselection keeps the PHASES, not just the masses.
 * Two prior phase assignments produce two survivor states whose overlap
 * carries interference — impossible for a classical mixture over branches.
 * A posterior-of-masses reading would fix |overlap| = |sum w_x/P| only when
 * the phase difference is constant; the machine shows the full complex sum.
 */
export function phaseOverlap(
  n: number,
  counts: readonly number[],
  marked: readonly number[],
  phiA: readonly number[],
  phiB: readonly number[],
): PhaseRun {
  const runA = runPriorSorter(n, counts, marked, phiA);
  const runB = runPriorSorter(n, counts, marked, phiB);
  let re = 0;
  let im = 0;
  for (let x = 0; x < runA.N; x++) {
    const aRe = runA.survivorRe[x]!;
    const aIm = runA.survivorIm[x]!;
    const bRe = runB.survivorRe[x]!;
    const bIm = runB.survivorIm[x]!;
    // <A|B> = sum conj(A) B: Re = aRe bRe + aIm bIm, Im = aRe bIm - aIm bRe
    re += aRe * bRe + aIm * bIm;
    im += aRe * bIm - aIm * bRe;
  }
  const totalC = counts.reduce((a, b) => a + b, 0);
  const markedSet = new Set(marked);
  let cRe = 0;
  let cIm = 0;
  let keptC = 0;
  for (let x = 0; x < runA.N; x++) {
    if (!markedSet.has(x)) continue;
    const c = counts[x]!;
    if (c === 0) continue;
    keptC += c;
    const w = c / totalC;
    const d = phiB[x]! - phiA[x]!;
    cRe += (w * Math.cos(d)) / runA.pKeep;
    cIm += (w * Math.sin(d)) / runA.pKeep;
  }
  if (keptC === 0) throw new CensusError("SC/P0-UNDEFINED", "phaseOverlap: no funded optimum");
  const deviation = Math.max(Math.abs(re - cRe), Math.abs(im - cIm));
  return {
    overlapAmplitude: { re, im },
    overlapClosedForm: { re: cRe, im: cIm },
    deviation,
    selfOverlap: Math.hypot(re, im),
  };
}

export interface RealizationCheck {
  readonly trials: number;
  /** |mean waiting - 1/P| in sigma units (sigma = sqrt((1-P)/P^2)/sqrt(trials)) */
  readonly waitingSigma: number;
  /** worst |conditional frequency - posterior| in sigma units over funded survivors */
  readonly worstSurvivorSigma: number;
}

/**
 * Realization referee only (never a theorem claim): the physical procedure is
 * draw x from the prior, keep iff marked — the waiting time is geometric and
 * the kept address is a posterior draw. Both statistics land inside sigma.
 */
export function realizationCheck(
  n: number,
  counts: readonly number[],
  marked: readonly number[],
  seed: number,
  trials: number,
): RealizationCheck {
  const run = runPriorSorter(n, counts, marked);
  const N = run.N;
  const rng = new Rng(seed);
  const countsArr = new Int32Array(N);
  for (let x = 0; x < N; x++) countsArr[x] = counts[x]!;
  const totalC = countsArr.reduce((a, b) => a + b, 0);
  const markedSet = new Set(marked);
  const keptCounts = new Int32Array(N);
  let waitingSum = 0;
  for (let t = 0; t < trials; t++) {
    for (;;) {
      waitingSum++;
      // integer draw from the count table — the prior is discrete by construction
      let pick = Math.floor(rng.next() * totalC);
      let x = 0;
      while (pick >= countsArr[x]!) {
        pick -= countsArr[x]!;
        x++;
      }
      if (markedSet.has(x) && countsArr[x]! > 0) {
        keptCounts[x] = keptCounts[x]! + 1;
        break;
      }
    }
  }
  const meanWaiting = waitingSum / trials;
  const sigma = Math.sqrt((1 - run.pKeep) / (run.pKeep * run.pKeep)) / Math.sqrt(trials);
  const waitingSigma = Math.abs(meanWaiting - 1 / run.pKeep) / sigma;
  let keptDraws = 0;
  for (let x = 0; x < N; x++) keptDraws += keptCounts[x]!;
  let worst = 0;
  for (let x = 0; x < N; x++) {
    const p = run.posterior[x]!;
    if (p === 0) continue;
    const freq = keptCounts[x]! / keptDraws;
    const s = Math.sqrt((p * (1 - p)) / keptDraws);
    const z = Math.abs(freq - p) / s;
    if (z > worst) worst = z;
  }
  return { trials, waitingSigma, worstSurvivorSigma: worst };
}
