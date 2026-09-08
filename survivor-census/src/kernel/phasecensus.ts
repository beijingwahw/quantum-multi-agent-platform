/**
 * S7 kernel — the phase-encoding census: what a phase structure buys.
 *
 * Boundary 2 of v0.1.0 honestly said: the coherence face is witnessed on
 * phase families, "no claim about optimal phase encodings or metrology is
 * made". This census makes that boundary executable instead of verbal.
 * The question: when the branch amplitudes carry phases — flat, alternating
 * signs, Fourier ramps, seeded random — what changes?
 *
 *   the LEDGER is phase-blind: P, the itemized kill register, and the
 *   waiting price E[T] = 1/P are invariant across every encoding family,
 *   deviation EXACTLY 0 (they are functions of the masses w_x only);
 *
 *   the STATE is phase-carrying: the survivor under any encoding is one
 *   pure state (self-overlap 1), and its overlap with another encoding's
 *   survivor is the complex sum sum w_x e^{i dphi_x} / P — magnitude
 *   EXACTLY 1 iff the phase difference is constant on the funded set,
 *   and strictly below 1 on every family whose difference is not constant.
 *
 * The equality case is exact algebra (a weighted average of unit vectors
 * has unit norm iff all vectors coincide); whether an encoding's difference
 * is constant depends on the FUNDED SET, so the census detects it per
 * instance rather than trusting a label (the sign-alternating encoding is
 * constant on any single-parity funded set — the quarter-funded instance's
 * marked set is all-even, an accidental equality case the machine catches).
 * The strictness margin below is DATA over the enumerated families — a
 * bounded census, not a theorem over all encodings. Metrology context
 * (ASH20/ASH23: postselected states can carry phase-based advantages,
 * success probability priced into the resource count) is cited for
 * vocabulary only: this census makes NO metrology claim and no optimality
 * claim.
 */

import { phaseOverlap, runPriorSorter } from "./survivor.js";
import { Rng } from "./survivor.js";

export interface PhaseFamily {
  readonly name: string;
  readonly phi: readonly number[];
  readonly note: string;
}

export function buildPhaseFamilies(n: number): PhaseFamily[] {
  const N = 2 ** n;
  const families: PhaseFamily[] = [];
  families.push({
    name: "flat",
    phi: new Array<number>(N).fill(0),
    note: "the reference encoding — no phases",
  });
  const alt = new Array<number>(N);
  for (let x = 0; x < N; x++) alt[x] = Math.PI * (x % 2);
  families.push({
    name: "sign-alt",
    phi: alt,
    note: "alternating signs pi*(x mod 2) — constant on every single-parity funded set",
  });
  for (const b of [1, 3, 5, 7]) {
    const ramp = new Array<number>(N);
    for (let x = 0; x < N; x++) ramp[x] = (2 * Math.PI * b * x) / N;
    families.push({
      name: `fourier-b${b}`,
      phi: ramp,
      note: `full-cycle Fourier ramp 2*pi*${b}*x/N (gcd(${b},${N})=1)`,
    });
  }
  for (const seed of [101, 103]) {
    const rng = new Rng(seed);
    const rand = Array.from({ length: N }, () => 2 * Math.PI * rng.next());
    families.push({
      name: `random-s${seed}`,
      phi: rand,
      note: "seeded uniform phases (reproducible)",
    });
  }
  const ramp3 = families.find((f) => f.name === "fourier-b3") as PhaseFamily;
  const shifted = ramp3.phi.map((p) => p + Math.PI / 9);
  families.push({
    name: "ramp3+const",
    phi: shifted,
    note: "fourier-b3 plus a constant pi/9 — differs from fourier-b3 by a CONSTANT (the equality case)",
  });
  return families;
}

/** is the phase difference phi - phiRef constant (mod 2pi) on the funded set? */
function constantDifferenceOnFunded(
  phi: readonly number[],
  phiRef: readonly number[],
  funded: readonly number[],
  tol: number,
): boolean {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const x of funded) {
    let d = (phi[x] as number) - (phiRef[x] as number);
    d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; // wrap to (-pi, pi]
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return max - min <= tol;
}

export interface PhaseCensusRow {
  readonly family: string;
  readonly note: string;
  readonly pKeep: number;
  /** |P_family - P_flat| — exact 0 expected: P is a function of masses only */
  readonly pDev: number;
  /** max itemized |kill mass - flat kill mass| — exact 0 expected */
  readonly registerDev: number;
  /** |E[T]_family - E[T]_flat| — exact 0 expected */
  readonly waitingDev: number;
  /** max | |amplitude|^2 - integer posterior | — the dephased reading is the posterior under EVERY encoding */
  readonly dephasedReadingDev: number;
  /** |<survivor_family | survivor_flat>| — the visibility against the reference encoding */
  readonly visibilityFlat: number;
  /** the full complex overlap against flat (carries the interference sign) */
  readonly overlapFlat: { re: number; im: number };
  /** computed per instance: is the phase difference vs flat constant on the funded set? */
  readonly constantDifferenceOnFunded: boolean;
}

export interface PhaseCensus {
  readonly rows: readonly PhaseCensusRow[];
  /** max over families of (pDev, registerDev, waitingDev) — exact 0 expected: the ledger reads masses only */
  readonly ledgerPhaseBlindnessDev: number;
  /** max over families of dephasedReadingDev — the standard two-path float dev (|amp|^2 vs integer ratio), < TOL */
  readonly dephasedReadingMaxDev: number;
  /** every family's survivor is pure: overlap of a family with ITSELF is 1 */
  readonly selfOverlapMaxDev: number;
  /** fourier-b3 vs ramp3+const: |overlap| = 1 within tol (constant phase difference) */
  readonly equalityCaseDev: number;
  /** min over NON-constant families of (1 - |overlap vs flat|) — the strictness margin, DATA */
  readonly strictMargin: number;
  /** equality case exact, every flagged-constant family at |overlap| = 1, every non-constant strictly below */
  readonly coherenceLawHolds: boolean;
}

export function runPhaseCensus(n: number, counts: readonly number[], marked: readonly number[]): PhaseCensus {
  const families = buildPhaseFamilies(n);
  const flatPhi = families[0] as PhaseFamily;
  const flatRun = runPriorSorter(n, counts, marked, flatPhi.phi);
  const flatById = new Map<number, number>();
  for (const row of flatRun.killRegister) flatById.set(row.x, row.mass);
  const funded: number[] = [];
  for (let x = 0; x < flatRun.N; x++) {
    if ((flatRun.posterior[x] as number) > 0) funded.push(x);
  }

  const rows: PhaseCensusRow[] = [];
  let ledgerDev = 0;
  let dephasedDev = 0;
  let selfDev = 0;
  for (const family of families) {
    const run = runPriorSorter(n, counts, marked, family.phi);
    let registerDev = 0;
    for (const row of run.killRegister) {
      const flatMass = flatById.get(row.x) as number;
      registerDev = Math.max(registerDev, Math.abs(row.mass - flatMass));
    }
    const ph = phaseOverlap(n, counts, marked, family.phi, flatPhi.phi);
    const phSelf = phaseOverlap(n, counts, marked, family.phi, family.phi);
    selfDev = Math.max(selfDev, Math.abs(phSelf.selfOverlap - 1));
    const isConstant = constantDifferenceOnFunded(family.phi, flatPhi.phi, funded, 1e-12);
    rows.push({
      family: family.name,
      note: family.note,
      pKeep: run.pKeep,
      pDev: Math.abs(run.pKeep - flatRun.pKeep),
      registerDev,
      waitingDev: Math.abs(1 / run.pKeep - 1 / flatRun.pKeep),
      dephasedReadingDev: run.posteriorDev,
      visibilityFlat: ph.selfOverlap,
      overlapFlat: ph.overlapAmplitude,
      constantDifferenceOnFunded: isConstant,
    });
    ledgerDev = Math.max(
      ledgerDev,
      Math.abs(run.pKeep - flatRun.pKeep),
      registerDev,
      Math.abs(1 / run.pKeep - 1 / flatRun.pKeep),
    );
    dephasedDev = Math.max(dephasedDev, run.posteriorDev);
  }

  // the explicit equality case: constant phase difference gives |overlap| = 1
  const b3 = families.find((f) => f.name === "fourier-b3") as PhaseFamily;
  const shifted = families.find((f) => f.name === "ramp3+const") as PhaseFamily;
  const eq = phaseOverlap(n, counts, marked, b3.phi, shifted.phi);
  const equalityCaseDev = Math.abs(eq.selfOverlap - 1);

  // strictness on the census: every family whose phase difference against
  // flat is NON-constant on the funded set lands strictly below 1, and
  // every family flagged constant sits AT 1 (the law, both directions)
  let strictMargin = Number.POSITIVE_INFINITY;
  let equalityMisclassified = false;
  for (const row of rows) {
    if (row.family === "flat") continue;
    if (row.constantDifferenceOnFunded) {
      if (Math.abs(row.visibilityFlat - 1) > 1e-12) equalityMisclassified = true;
    } else {
      strictMargin = Math.min(strictMargin, 1 - row.visibilityFlat);
    }
  }

  return {
    rows,
    ledgerPhaseBlindnessDev: ledgerDev,
    dephasedReadingMaxDev: dephasedDev,
    selfOverlapMaxDev: selfDev,
    equalityCaseDev,
    strictMargin,
    coherenceLawHolds:
      equalityCaseDev < 1e-12 &&
      !equalityMisclassified &&
      Number.isFinite(strictMargin) &&
      strictMargin > 1e-9 &&
      selfDev < 1e-12,
  };
}
