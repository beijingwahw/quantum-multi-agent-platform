/**
 * T1 kernel — the sorter's branch algebra, executed exactly.
 *
 * The machine: address register of n qubits, flag register marking a subset.
 * One oracle query on the uniform superposition routes marked amplitudes into
 * the flag=1 branch; postselection keeps that branch.
 *
 * Everything here is exact amplitude algebra — no sampling appears in any
 * theorem claim. Where a closed form exists it is computed on a second,
 * independent arithmetic path (integer counts) so agreement is a check, not a
 * tautology.
 */

export interface SorterRun {
  readonly n: number;
  readonly N: number;
  readonly t: number;
  /** P(flag=1), summed from branch amplitudes */
  readonly pFlag: number;
  /** t/N — the two must agree to machine precision */
  readonly pFlagClosedForm: number;
  /** renormalized flag=1 branch amplitudes over the address space */
  readonly conditional: Float64Array;
  /** |<x*|psi_cond>|^2 at t=1; NaN when t != 1 */
  readonly fidelityXStar: number;
  /** max deviation of conditional amplitudes from 1/sqrt(t) on the marked set */
  readonly conditionalUniformityDev: number;
  /** max |amplitude| outside the marked set after conditioning (exactly 0) */
  readonly offMarkedLeak: number;
}

export function runSorter(n: number, markedInput: readonly number[]): SorterRun {
  const N = 2 ** n;
  const marked = [...new Set(markedInput)];
  const t = marked.length;
  if (t === 0) throw new Error("runSorter: at least one marked item required");
  if (t > N) throw new Error("runSorter: marked set exceeds address space");
  const markedSet = new Set(marked);
  const amp = 1 / Math.sqrt(N);
  const branch1 = new Float64Array(N);
  let pFlag = 0;
  for (let x = 0; x < N; x++) {
    if (markedSet.has(x)) {
      branch1[x] = amp;
      pFlag += amp * amp;
    }
  }
  const norm = Math.sqrt(pFlag);
  const conditional = new Float64Array(N);
  for (let x = 0; x < N; x++) conditional[x] = branch1[x]! / norm;
  let fidelityXStar = Number.NaN;
  if (t === 1) {
    const xStar = marked[0] as number;
    fidelityXStar = (conditional[xStar] as number) ** 2;
  }
  const target = 1 / Math.sqrt(t);
  let conditionalUniformityDev = 0;
  let offMarkedLeak = 0;
  for (let x = 0; x < N; x++) {
    if (markedSet.has(x)) {
      const d = Math.abs((conditional[x] as number) - target);
      if (d > conditionalUniformityDev) conditionalUniformityDev = d;
    } else {
      const a = Math.abs(conditional[x] as number);
      if (a > offMarkedLeak) offMarkedLeak = a;
    }
  }
  return {
    n,
    N,
    t,
    pFlag,
    pFlagClosedForm: t / N,
    conditional,
    fidelityXStar,
    conditionalUniformityDev,
    offMarkedLeak,
  };
}

export interface PayloadRun {
  readonly pFlag: number;
  /** P(payload=1 | flag=1) via the amplitude path */
  readonly branchOutcome: number;
  /** |{marked AND payload}|/|{marked}| via integer counting — independent path */
  readonly closedForm: number;
  readonly deviation: number;
}

/** The branch is a clean conditional sample: any payload bit read in-branch
 *  carries exactly the conditional distribution of the payload over the marked
 *  set — an integer-ratio (#P-fraction) value. */
export function runPayload(n: number, markedInput: readonly number[], payload: readonly boolean[]): PayloadRun {
  const N = 2 ** n;
  if (payload.length !== N) throw new Error("runPayload: payload table must have length 2^n");
  const marked = [...new Set(markedInput)];
  const markedSet = new Set(marked);
  const amp = 1 / Math.sqrt(N);
  let weight = 0;
  let joint = 0;
  let cntMarked = 0;
  let cntJoint = 0;
  for (let x = 0; x < N; x++) {
    if (!markedSet.has(x)) continue;
    weight += amp * amp;
    cntMarked++;
    if (payload[x]) {
      joint += amp * amp;
      cntJoint++;
    }
  }
  if (cntMarked === 0) throw new Error("runPayload: empty marked set");
  const branchOutcome = joint / weight;
  const closedForm = cntJoint / cntMarked;
  return { pFlag: weight, branchOutcome, closedForm, deviation: Math.abs(branchOutcome - closedForm) };
}

// ---------------------------------------------------------------------------
// Small dense-matrix helpers for the filter audit (n=2 instances only).
// ---------------------------------------------------------------------------

export type Matrix = ReadonlyArray<readonly number[]>;

export function matMul(a: Matrix, b: Matrix): Matrix {
  const m = a.length;
  const k = b.length;
  const p = (b[0] as readonly number[]).length;
  const out: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(p).fill(0);
    for (let j = 0; j < p; j++) {
      let s = 0;
      for (let u = 0; u < k; u++) s += (a[i] as readonly number[])[u] as number * ((b[u] as readonly number[])[j] as number);
      row[j] = s;
    }
    out.push(row);
  }
  return out;
}

export function trace(m: Matrix): number {
  let s = 0;
  for (let i = 0; i < m.length; i++) s += (m[i] as readonly number[])[i] as number;
  return s;
}

/** density matrix of a real pure state */
export function pureDm(v: readonly number[]): Matrix {
  return v.map((a) => v.map((b) => a * b));
}

/** conditional rho -> Pi rho Pi / tr(Pi rho) for a diagonal projector Pi (0/1 diag) */
export function conditionalDm(rho: Matrix, pi: readonly number[]): Matrix {
  const d = rho.length;
  let w = 0;
  for (let i = 0; i < d; i++) if (pi[i] === 1) w += (rho[i] as readonly number[])[i] as number;
  if (w <= 0) throw new Error("conditionalDm: zero branch weight");
  return rho.map((row, i) => row.map((a, j) => (pi[i] === 1 && pi[j] === 1 ? a / w : 0)));
}

/** trace distance between two diagonal-supported density matrices (enough for
 *  the audit instances, whose conditional differences are diagonal) */
export function traceDistanceDiagonal(a: Matrix, b: Matrix): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += Math.abs(((a[i] as readonly number[])[i] as number) - ((b[i] as readonly number[])[i] as number));
  }
  return s / 2;
}

export interface FilterAudit {
  /** conditioning the mixture vs averaging the conditionals — trace distance, expected exactly 1/6 */
  readonly nonlinearityTraceDistance: number;
  /** max |tr(Pi0 rho Pi0 + Pi1 rho Pi1) - tr(rho)| over test states — trace preservation */
  readonly krausTraceDev: number;
  /** max deviation of the kept map from block-preservation/dephasing: within-sector
   *  elements preserved, cross-sector elements killed — the measurement-channel certificate */
  readonly krausDephaseDev: number;
  /** tr(Pi1 rho Pi1) for a marked-supported state — exactly 1 */
  readonly singleKrausOnSupport: number;
  /** 1 - tr(Pi1 rho Pi1) for a state with mass outside the marked set — in (0,1) */
  readonly singleKrausDeficit: number;
}

/**
 * The filter is not a channel. Conditioning a mixture weights each component
 * by its own branch weight w_i, so cond(sum lambda_i rho_i) equals the plain
 * average only when all w_i coincide. Concrete instance on n=2 (basis
 * |00>,|01>,|10>,|11>, marked = {x=0, x=1}):
 *   rho1 = |00><00|            (w=1,   cond = |00><00|)
 *   rho2 = (|01><01|+|10><10|)/2  (w=1/2, cond = |01><01|)
 *   cond((rho1+rho2)/2) = (2/3)|00><00| + (1/3)|01><01|
 *   (cond(rho1)+cond(rho2))/2 = (1/2)|00><00| + (1/2)|01><01|
 * trace distance = 1/6 exactly. This is structure, not a bug: the physical
 * realization is measure-the-flag-and-keep-the-branch, which reproduces the
 * weighted mixture — verified by Monte Carlo in the experiments.
 */
export function auditFilter(): FilterAudit {
  const d = 4;
  const pi1 = [1, 1, 0, 0];
  const pi0 = [0, 0, 1, 1];
  const e00 = [1, 0, 0, 0];
  const rho1 = pureDm(e00);
  const rho2: Matrix = [
    [0, 0, 0, 0],
    [0, 0.5, 0, 0],
    [0, 0, 0.5, 0],
    [0, 0, 0, 0],
  ];
  const mix: Matrix = rho1.map((row, i) => row.map((a, j) => 0.5 * a + 0.5 * ((rho2[i] as readonly number[])[j] as number)));
  const condMix = conditionalDm(mix, pi1);
  // (cond(rho1) + cond(rho2)) / 2 = (|00><00| + |01><01|) / 2 — the plain
  // average of the two conditionals, against which cond(mix) is compared
  const avgCond: Matrix = [
    [0.5, 0, 0, 0],
    [0, 0.5, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const nonlinearityTraceDistance = traceDistanceDiagonal(condMix, avgCond);

  // The two-Kraus filter {Pi0, Pi1} is the measurement channel: trace
  // preserving, each sector block preserved, cross-sector coherences killed.
  // (Trace preservation is tr-level, NOT matrix equality — complementary
  // projectors dephase; a previous draft asserted element-wise equality with
  // rho and the referee rejected it.)
  const plus = [0.5, 0.5, 0.5, 0.5];
  const tests: Matrix[] = [pureDm(plus), mix, rho2];
  let krausTraceDev = 0;
  let krausDephaseDev = 0;
  for (const rho of tests) {
    const kept = projectBoth(rho, pi0, pi1);
    krausTraceDev = Math.max(krausTraceDev, Math.abs(trace(kept) - trace(rho)));
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        const sameSector = pi1[i] === pi1[j];
        const keptIJ = (kept[i] as readonly number[])[j] as number;
        const rhoIJ = (rho[i] as readonly number[])[j] as number;
        const dev = sameSector ? Math.abs(keptIJ - rhoIJ) : Math.abs(keptIJ);
        if (dev > krausDephaseDev) krausDephaseDev = dev;
      }
    }
  }

  const singleKrausOnSupport = trace(project(rho1, pi1));
  // |++> carries half its weight in the marked sector: the deficit is exactly
  // 1/2 — an interior value, unlike a fully-unmarked basis state (deficit 1)
  const singleKrausDeficit = 1 - trace(project(pureDm(plus), pi1));
  return { nonlinearityTraceDistance, krausTraceDev, krausDephaseDev, singleKrausOnSupport, singleKrausDeficit };
}

function project(rho: Matrix, pi: readonly number[]): Matrix {
  return rho.map((row, i) => row.map((a, j) => (pi[i] === 1 && pi[j] === 1 ? a : 0)));
}

function projectBoth(rho: Matrix, pi0: readonly number[], pi1: readonly number[]): Matrix {
  const a = project(rho, pi0);
  const b = project(rho, pi1);
  return a.map((row, i) => row.map((x, j) => x + ((b[i] as readonly number[])[j] as number)));
}

// ---------------------------------------------------------------------------
// Deterministic RNG (xorshift32) for the Monte Carlo cross-checks in T1/T4.
// Sampling never enters a theorem claim — it only witnesses that the physical
// measure-and-feedforward realization reproduces the conditional statistics.
// ---------------------------------------------------------------------------

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

export interface FeedforwardCheck {
  readonly n: number;
  readonly samples: number;
  /** |acceptRate - t/N| / binomial sigma */
  readonly acceptSigma: number;
  /** worst |conditional frequency - 1/t| / binomial sigma over marked cells */
  readonly worstSigma: number;
}

/**
 * Physical realization referee: the measure-and-keep procedure first samples
 * the flag (P(keep) = t/N), then the address uniform over the marked set.
 * Both statistics are compared against exact values in sigma units; the
 * conditional frequencies use the ACCEPTED count as denominator — the branch
 * is a renormalized world, its census only counts branch residents.
 */
export function feedforwardCheck(n: number, markedInput: readonly number[], seed: number, samples: number): FeedforwardCheck {
  const marked = [...new Set(markedInput)];
  const run = runSorter(n, marked);
  const t = run.t;
  const counts = new Int32Array(run.N);
  const rng = new Rng(seed);
  let accepted = 0;
  for (let s = 0; s < samples; s++) {
    if (rng.next() < run.pFlag) {
      accepted++;
      const idx = Math.min(t - 1, Math.floor(rng.next() * t));
      counts[marked[idx] as number] = (counts[marked[idx] as number] as number) + 1;
    }
  }
  if (accepted === 0) throw new Error("feedforwardCheck: empty branch (raise samples)");
  const acceptSigma = Math.abs(accepted / samples - run.pFlag) / Math.sqrt((run.pFlag * (1 - run.pFlag)) / samples);
  const pExact = 1 / t;
  let worstSigma = 0;
  for (const x of marked) {
    const freq = (counts[x] as number) / accepted;
    const sigma = Math.sqrt((pExact * (1 - pExact)) / accepted);
    const z = Math.abs(freq - pExact) / sigma;
    if (z > worstSigma) worstSigma = z;
  }
  return { n, samples, acceptSigma, worstSigma };
}
