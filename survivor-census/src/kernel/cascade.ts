/**
 * S8 kernel — the cascade waiting ledger: memory vs no memory, separated.
 * (E11 of the R18 innovation wave.)
 *
 * THE CLAIM ON TRIAL. Stack k postselection levels with per-level keep
 * probabilities P_1..P_k — each the FUNDED PRIOR MASS of its marked set in
 * the incoming survivor frame (on a weighted prior this is not N/t; the
 * chain rule composes the levels, S6). Three architectures, every price in
 * SORTER ATTEMPTS:
 *
 *   sequential (memory)  the S6 stacked ledger: pass level 1, keep its
 *                        survivor, face level 2 from there — a geometric
 *                        wait per level, and they ADD:
 *                        E[T_seq] = sum_i 1/P_i
 *   fused (one sorter)   postselect ONCE on the composed marked set: by the
 *                        chain rule its keep is prod_i P_i, so
 *                        E[T_fused] = 1 / prod_i P_i
 *   restart (no memory)  a fresh cascade every round: each round attempts
 *                        level 1, on pass level 2, ...; a round succeeds
 *                        with probability q = prod P_i. COUNTING ATTEMPTS
 *                        (not rounds), Wald's identity on the extension
 *                        recursion E <- (E + 1)/P' (appending a last level
 *                        re-attempts everything before it) gives the
 *                        suffix-sum law:
 *                        E[T_restart] = sum_i 1/(P_i P_{i+1} ... P_k)
 *
 * THE SEPARATION THEOREMS (exact, each with its exact boundary):
 *   S8.1  restart >= fused, ALWAYS: the fused price is restart's first
 *         suffix term; the remaining suffix terms are the re-attempted
 *         prefixes. Equality iff k = 1 (or a trivial tail P_2..P_k = 1).
 *   S8.2  restart >= sequential, ALWAYS, termwise: 1/(P_i * suffix_i) >=
 *         1/P_i because suffix_i = prod_{j>i} P_j <= 1. Keeping survivors
 *         never loses to re-running from scratch, at any difficulty.
 *   S8.3  fused vs sequential is REGIME-BOUND: fused >= sequential iff
 *         sum_i prod_{j != i} P_j <= 1 — exactly (E_fused - E_seq) * prod P
 *         = 1 - that sum. In the hard regime (every P_i <= 1/2, the
 *         postselection regime: the keeper is the minority) the sum is at
 *         most k / 2^(k-1) <= 1 for k >= 2, so memory pays through FUSION
 *         too; for easy levels it inverts — at P = (0.9, 0.9) one joint
 *         attempt tests both gates at once and the fused sorter is CHEAPER
 *         than the stacked ledger (1.23 vs 2.22 attempts).
 *   S8.4  the separation ratio R_k = (prod 1/P_i)/(sum 1/P_i) (fused over
 *         sequential, the wave's designed ratio) is >= 1 exactly on the
 *         hard side of the S8.3 boundary, with equality at k = 1 (and the
 *         corner k = 2, P_1 = P_2 = 1/2). Appending a level P' to a hard
 *         cascade strictly grows R iff P' < 1 - 1/S_k (S_k = sum 1/P_i);
 *         correspondingly for the restart ratio iff P' < 1 - 1/S_k + 1/N_k.
 *         An EASY appendage dilutes both ratios (each side pays >= +1
 *         attempt, the mediant pull-down): "cascade depth always widens
 *         the memory advantage" is folklore, convicted by machine below.
 *
 * Vocabulary anchors: the renewal / random-sum decomposition is standard
 * machinery (renewal-reward theorem, Ross-1996 shape; Wald identity shape
 * — both [pending double-sourcing]; no theorem of any cited work is
 * re-proved here). Every identity below is elementary algebra on the P_i,
 * executed on two independent paths.
 *
 * Honest boundaries: the P_i are scalar keeps measured in their incoming
 * frames (S6's chain-rule domain — address filters, level-keeps treated as
 * independent scalars); the hard-regime statements are about P_i <= 1/2
 * cascades, with the exact boundary machine-checked per instance; the MC
 * face is a realization referee only and never enters a theorem claim.
 */

import { runPriorSorter } from "./survivor.js";
import type { PriorSorterRun } from "./survivor.js";
import { waitingPrice } from "./waitprice.js";
import { CensusError } from "./errors.js";

function requireLevels(ps: readonly number[], fn: string): void {
  if (ps.length === 0) {
    throw new CensusError(
      "SC/BAD-MARKED",
      `${fn}: a cascade needs at least one level`,
    );
  }
  for (const p of ps) {
    if (!Number.isFinite(p) || !(p > 0) || !(p <= 1)) {
      throw new CensusError(
        "SC/P-DOMAIN",
        `${fn}: every level keep must be finite in (0, 1] (got ${p})`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// the cascade of stages: level keeps from integer tables, two paths
// ---------------------------------------------------------------------------

export interface CascadeStagesRun {
  readonly n: number;
  readonly N: number;
  readonly markedSets: ReadonlyArray<readonly number[]>;
  /** the composed ledger of the final (deepest) intersection */
  readonly runFinal: PriorSorterRun;
  /** per-level keeps, amplitude path: run_i.pKeep / run_{i-1}.pKeep */
  readonly pLevels: readonly number[];
  /** per-level keeps, integer-ratio path: keptC_i / keptC_{i-1} */
  readonly pLevelsInteger: readonly number[];
  /** max |amplitude - integer| over the levels */
  readonly levelDev: number;
  /** |prod pLevels - runFinal.pKeep| on both paths — the k-fold chain rule */
  readonly chainDev: number;
  readonly ledger: CascadeLedger;
}

/**
 * Run a k-level cascade of address filters on one integer count table:
 * level i conditions on the cumulative intersection M_1 ∩ ... ∩ M_i, and the
 * level keep P_i is measured in the incoming survivor frame (S6's p2 concept,
 * iterated). A depth that starves the incoming survivor refuses by name.
 */
export function cascadeStages(
  n: number,
  counts: readonly number[],
  markedSets: ReadonlyArray<readonly number[]>,
): CascadeStagesRun {
  if (!Number.isInteger(n) || n < 0) {
    throw new CensusError(
      "SC/BAD-N",
      "cascadeStages: n must be a non-negative integer (the address space is 2^n)",
    );
  }
  const N = 2 ** n;
  if (counts.length !== N) {
    throw new CensusError(
      "SC/BAD-COUNTS",
      "cascadeStages: count table must have length 2^n",
    );
  }
  if (counts.some((c) => c < 0 || !Number.isInteger(c))) {
    throw new CensusError(
      "SC/BAD-COUNTS",
      "cascadeStages: counts must be non-negative integers",
    );
  }
  if (counts.reduce((a, b) => a + b, 0) <= 0) {
    throw new CensusError(
      "SC/BAD-COUNTS",
      "cascadeStages: total count must be positive",
    );
  }
  if (markedSets.length === 0) {
    throw new CensusError(
      "SC/BAD-MARKED",
      "cascadeStages: at least one level required",
    );
  }
  // every level's marks validated BEFORE any intersection is taken — the
  // smuggled-address hole composeStages closed, closed here at every depth
  for (const marked of markedSets) {
    if (marked.length === 0) {
      throw new CensusError(
        "SC/BAD-MARKED",
        "cascadeStages: every level must mark at least one item",
      );
    }
    if (marked.some((x) => !Number.isInteger(x) || x < 0 || x >= N)) {
      throw new CensusError(
        "SC/BAD-MARKED",
        "cascadeStages: marked out of range",
      );
    }
  }
  const runs: PriorSorterRun[] = [];
  let cumulative: readonly number[] = [];
  for (const marked of markedSets) {
    const dedup = [...new Set(marked)];
    const next =
      runs.length === 0 ? dedup : cumulative.filter((x) => dedup.includes(x));
    if (next.length === 0) {
      // composeStages's own pre-check, iterated to depth: an emptied
      // intersection starves BEFORE the sorter can name the unfunded face
      throw new CensusError(
        "SC/EMPTY-INTERSECTION",
        `cascadeStages: level ${runs.length + 1} empties the composed marked set — the composed conditioning is undefined at this depth`,
      );
    }
    let run: PriorSorterRun;
    try {
      run = runPriorSorter(n, counts, next);
    } catch (e) {
      if (e instanceof CensusError && e.code === "SC/P0-UNDEFINED") {
        throw new CensusError(
          "SC/EMPTY-INTERSECTION",
          `cascadeStages: level ${runs.length + 1} starves the incoming survivor — the composed conditioning is undefined at this depth`,
          { cause: e },
        );
      }
      throw e;
    }
    runs.push(run);
    cumulative = next;
  }

  const pLevels: number[] = [];
  const pLevelsInteger: number[] = [];
  let levelDev = 0;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i] as PriorSorterRun;
    const prev = i === 0 ? undefined : (runs[i - 1] as PriorSorterRun);
    const amp = run.pKeep / (prev === undefined ? 1 : prev.pKeep);
    const integer =
      run.pKeepInteger / (prev === undefined ? 1 : prev.pKeepInteger);
    pLevels.push(amp);
    pLevelsInteger.push(integer);
    levelDev = Math.max(levelDev, Math.abs(amp - integer));
  }
  let prodAmp = 1;
  let prodInt = 1;
  for (let i = 0; i < pLevels.length; i++) {
    prodAmp *= pLevels[i] as number;
    prodInt *= pLevelsInteger[i] as number;
  }
  const final = runs[runs.length - 1] as PriorSorterRun;
  return {
    n,
    N,
    markedSets,
    runFinal: final,
    pLevels,
    pLevelsInteger,
    levelDev,
    chainDev: Math.max(
      Math.abs(prodAmp - final.pKeep),
      Math.abs(prodInt - final.pKeepInteger),
    ),
    ledger: waitingLedger(pLevels),
  };
}

// ---------------------------------------------------------------------------
// the waiting ledger: three architectures, two paths each, exact boundaries
// ---------------------------------------------------------------------------

export interface CascadeLedger {
  readonly k: number;
  readonly ps: readonly number[];
  /** E[T_seq] = sum 1/P_i, closed form */
  readonly seqMeanClosed: number;
  /** sum of the per-level truncated renewal sums (waitingPrice partial paths) */
  readonly seqMeanPartial: number;
  readonly seqDev: number;
  /** E[T_fused] = 1/prod P_i (the chain rule keep of the composed set) */
  readonly fusedMean: number;
  /** |fusedMean - waitingPrice(prod P).meanPartial| */
  readonly fusedPartialDev: number;
  /** E[T_restart] = sum_i 1/(P_i ... P_k), the suffix-sum path */
  readonly restartMeanSuffix: number;
  /** extension-recursion path: E <- (E + 1)/P' as each level is appended */
  readonly restartMeanWald: number;
  readonly restartDev: number;
  /** the ROUND count of the restart architecture = 1/prod P_i (unit: rounds, not attempts) */
  readonly restartRoundsMean: number;
  /** E[attempts per round] = sum_{a=1}^{k} prod_{j<a} P_j (the survival sum) */
  readonly trialsPerRoundMean: number;
  /** |restartMeanSuffix - restartRoundsMean * trialsPerRoundMean| — the Wald identity itself */
  readonly waldDev: number;
  /** restart / sequential — >= 1 ALWAYS (S8.2), the memory advantage vs re-running */
  readonly separationRestart: number;
  /** fused / sequential — the wave's designed ratio; >= 1 iff boundarySum <= 1 (S8.3) */
  readonly separationFused: number;
  /** sum_i prod_{j != i} P_j — the exact S8.3 boundary quantity */
  readonly boundarySum: number;
  /** every P_i <= 1/2 (the hard regime — postselection's own) */
  readonly hardRegime: boolean;
  /** (E_fused - E_seq) * prod P_i, which equals 1 - boundarySum exactly */
  readonly fusedMinusSeqScaled: number;
}

export function waitingLedger(psInput: readonly number[]): CascadeLedger {
  requireLevels(psInput, "waitingLedger");
  const ps = [...psInput];
  const k = ps.length;

  let seqClosed = 0;
  let seqPartial = 0;
  let prodP = 1;
  for (const p of ps) {
    seqClosed += 1 / p;
    seqPartial += waitingPrice(p).meanPartial;
    prodP *= p;
  }
  const fusedMean = 1 / prodP;

  // restart, suffix-sum path (O(k^2) — k is a cascade depth, not an address space)
  let restartSuffix = 0;
  for (let i = 0; i < k; i++) {
    let s = 1;
    for (let j = i; j < k; j++) s *= ps[j] as number;
    restartSuffix += 1 / s;
  }
  // restart, extension-recursion path: appending a last level P' maps
  // E <- (E + 1)/P' (the fresh level re-attempts everything before it, one
  // attempt at a time) — applied FORWARD, level by level
  let wald = 1 / (ps[0] as number);
  for (let i = 1; i < k; i++) wald = (wald + 1) / (ps[i] as number);

  // attempts per round, survival-sum path: E[c] = sum_a Pr[c >= a]
  let prefix = 1;
  let trialsPerRound = 0;
  for (let a = 0; a < k; a++) {
    trialsPerRound += prefix;
    prefix *= ps[a] as number;
  }

  let boundary = 0;
  for (let i = 0; i < k; i++) {
    let s = 1;
    for (let j = 0; j < k; j++) if (j !== i) s *= ps[j] as number;
    boundary += s;
  }

  return {
    k,
    ps,
    seqMeanClosed: seqClosed,
    seqMeanPartial: seqPartial,
    seqDev: Math.abs(seqClosed - seqPartial),
    fusedMean,
    fusedPartialDev: Math.abs(fusedMean - waitingPrice(prodP).meanPartial),
    restartMeanSuffix: restartSuffix,
    restartMeanWald: wald,
    restartDev: Math.abs(restartSuffix - wald),
    restartRoundsMean: fusedMean,
    trialsPerRoundMean: trialsPerRound,
    waldDev: Math.abs(restartSuffix - fusedMean * trialsPerRound),
    separationRestart: restartSuffix / seqClosed,
    separationFused: fusedMean / seqClosed,
    boundarySum: boundary,
    hardRegime: ps.every((p) => p <= 0.5),
    fusedMinusSeqScaled: (fusedMean - seqClosed) * prodP,
  };
}

export interface AppendThresholds {
  /** appending P' strictly grows fused/sequential iff P' < this */
  readonly growFused: number;
  /** appending P' strictly grows restart/sequential iff P' < this */
  readonly growRestart: number;
}

/**
 * The S8.4 depth thresholds of a cascade: appending level P' to ps grows the
 * separation ratio exactly when P' is below the threshold (hard appends
 * grow; easy appends dilute — the mediant pull-down).
 */
export function appendThresholds(ps: readonly number[]): AppendThresholds {
  requireLevels(ps, "appendThresholds");
  const s = ps.reduce((a, p) => a + 1 / p, 0);
  let suffix = 0;
  for (let i = 0; i < ps.length; i++) {
    let t = 1;
    for (let j = i; j < ps.length; j++) t *= ps[j] as number;
    suffix += 1 / t;
  }
  return { growFused: 1 - 1 / s, growRestart: 1 - 1 / s + 1 / suffix };
}

// ---------------------------------------------------------------------------
// the claim adjudicator (the smuggling trials): a number without its
// identity is NAMED and REJECTED — the honest ledger audits clean
// ---------------------------------------------------------------------------

export interface CascadeClaim {
  readonly label: string;
  readonly ps: readonly number[];
  readonly declaredSeq: number;
  readonly declaredFused: number;
  readonly declaredRestart: number;
  /** the narrative under trial: "one fused sorter beats the stacked ledger" */
  readonly declaredFusedBeatsSeq: boolean;
}

export function claimFromCascade(run: CascadeStagesRun): CascadeClaim {
  const l = run.ledger;
  return {
    label: `${run.markedSets.map((m) => `(${m.join(",")})`).join(" then ")}`,
    ps: l.ps,
    declaredSeq: l.seqMeanClosed,
    declaredFused: l.fusedMean,
    declaredRestart: l.restartMeanSuffix,
    declaredFusedBeatsSeq: l.boundarySum <= 1,
  };
}

/** The cascade laws W1-W5. Returns the violations, each NAMED; the honest ledger returns []. */
export function auditCascade(claim: CascadeClaim, tol: number): string[] {
  const violations: string[] = [];
  const ledger = waitingLedger(claim.ps);

  // W1 — the sequential price is the geometric SUM (the stacked-ledger law)
  if (
    Math.abs(claim.declaredSeq - ledger.seqMeanClosed) >
    tol * Math.max(1, ledger.seqMeanClosed)
  ) {
    violations.push(
      `W1: '${claim.label}' sequential price misrepresented — declared ${claim.declaredSeq.toPrecision(12)} but sum 1/P_i = ${ledger.seqMeanClosed.toPrecision(12)} (with memory the per-level waits ADD)`,
    );
  }

  // W2 — the fused price is the inverse chain-rule product
  if (
    Math.abs(claim.declaredFused - ledger.fusedMean) >
    tol * Math.max(1, ledger.fusedMean)
  ) {
    violations.push(
      `W2: '${claim.label}' fused price misrepresented — declared ${claim.declaredFused.toPrecision(12)} but 1/(P_1...P_k) = ${ledger.fusedMean.toPrecision(12)} (one sorter on the composed set waits the inverse product)`,
    );
  }

  // W3 — the restart price is the SUFFIX SUM (the undercount trial: quoting
  // the fused number for the restart architecture)
  if (
    Math.abs(claim.declaredRestart - ledger.restartMeanSuffix) >
    tol * Math.max(1, ledger.restartMeanSuffix)
  ) {
    violations.push(
      `W3: '${claim.label}' restart price misrepresented — declared ${claim.declaredRestart.toPrecision(12)} but sum_i 1/(P_i...P_k) = ${ledger.restartMeanSuffix.toPrecision(12)} (a fresh cascade pays every suffix of the chain, not just the full product)`,
    );
  }

  // W4 — restart can never undercut the fused sorter (universal ordering, S8.1)
  if (
    claim.declaredRestart <
    claim.declaredFused - tol * Math.max(1, claim.declaredFused)
  ) {
    violations.push(
      `W4: '${claim.label}' declares restart (${claim.declaredRestart.toPrecision(12)}) below fused (${claim.declaredFused.toPrecision(12)}) — restart's price CONTAINS the fused price as its first suffix term`,
    );
  }

  // W5 — the fused-vs-sequential ordering is regime-bound (S8.3), and the
  // claim's narrative must match the machine's boundary computation
  const truth = ledger.boundarySum <= 1 + tol;
  if (claim.declaredFusedBeatsSeq !== truth) {
    violations.push(
      `W5: '${claim.label}' fused-vs-sequential narrative inverted — boundary sum sum_i prod_{j!=i} P_j = ${ledger.boundarySum.toPrecision(12)} (fused >= sequential iff <= 1; here ${truth ? "memory pays through fusion" : "easy levels: one joint attempt is cheaper"})`,
    );
  }

  return violations;
}

// ---------------------------------------------------------------------------
// the realization referee (DATA only — never a theorem claim)
// ---------------------------------------------------------------------------

export interface McCascade {
  readonly runs: number;
  readonly seqMean: number;
  readonly seqSigmaUnits: number;
  readonly restartAttemptsMean: number;
  readonly restartRoundsMean: number;
  readonly roundsSigmaUnits: number;
  readonly attemptsPerRoundMean: number;
  readonly trialsSigmaUnits: number;
}

/**
 * Simulate both architectures on the abstract level keeps (seeded by the
 * caller). Exact sigmas: sequential is a sum of independent geometrics; the
 * round count is exactly geometric with q = prod P_i; attempts-per-round has
 * the exact small law Pr[c = i] = prod_{j<i} P_j (1 - P_i), i < k, and
 * Pr[c = k] = prod_{j<k} P_j (moments by survival sums).
 */
export function mcCascade(
  ps: readonly number[],
  runs: number,
  rngNext: () => number,
): McCascade {
  requireLevels(ps, "mcCascade");
  if (!Number.isInteger(runs) || runs <= 0) {
    throw new CensusError(
      "SC/MC-BAD-INPUTS",
      "mcCascade: runs must be a positive integer",
    );
  }
  // exact moments
  let seqMeanExact = 0;
  let seqVar = 0;
  let q = 1;
  for (const p of ps) {
    seqMeanExact += 1 / p;
    seqVar += (1 - p) / (p * p);
    q *= p;
  }
  let prefix = 1;
  let e1 = 0;
  let e2 = 0;
  for (let a = 1; a <= ps.length; a++) {
    e1 += prefix;
    e2 += (2 * a - 1) * prefix;
    prefix *= ps[a - 1] as number;
  }
  const varC = Math.max(0, e2 - e1 * e1);

  // simulate: one lifecycle of each architecture per run
  let seqSum = 0;
  let totalRounds = 0;
  let roundAttemptsSum = 0;
  for (let r = 0; r < runs; r++) {
    let t = 0;
    for (const p of ps) {
      for (;;) {
        t++;
        if (rngNext() < p) break;
      }
    }
    seqSum += t;
    for (;;) {
      totalRounds++;
      let a = 0;
      let passed = true;
      for (const p of ps) {
        a++;
        if (!(rngNext() < p)) {
          passed = false;
          break;
        }
      }
      roundAttemptsSum += a;
      if (passed) break;
    }
  }

  const seqMean = seqSum / runs;
  const seqSigma = Math.sqrt(seqVar / runs);
  const roundsMean = totalRounds / runs;
  const roundsSigma = Math.sqrt((1 - q) / (q * q) / runs);
  const perRound = roundAttemptsSum / totalRounds;
  const trialsSigma = Math.sqrt(varC / totalRounds);
  const guard = (mean: number, exact: number, sigma: number): number =>
    sigma === 0
      ? mean === exact
        ? 0
        : Number.POSITIVE_INFINITY
      : Math.abs(mean - exact) / sigma;
  return {
    runs,
    seqMean,
    seqSigmaUnits: guard(seqMean, seqMeanExact, seqSigma),
    // total attempts per restart lifecycle = attempts summed over its rounds
    restartAttemptsMean: roundAttemptsSum / runs,
    restartRoundsMean: roundsMean,
    roundsSigmaUnits: guard(roundsMean, 1 / q, roundsSigma),
    attemptsPerRoundMean: perRound,
    trialsSigmaUnits: guard(perRound, e1, trialsSigma),
  };
}
