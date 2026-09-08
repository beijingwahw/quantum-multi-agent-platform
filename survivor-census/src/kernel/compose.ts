/**
 * S6 kernel — sequential postselection: two stacked ledgers, composed.
 *
 * The letter's sentence priced ONE filter. But the sorter's world stacks
 * them: survive stage A, then face stage B. Does the survivor book keep
 * its laws under composition? Three identities, all exact on integer
 * tables, all executed on two paths:
 *
 *   chain rule      P_AB = P_A * P_2        (P_2 = stage-2 keep measured
 *                                             inside the A-survivor frame)
 *   kill registers  stage-1 kills and stage-2 kills are DISJOINT itemized
 *                   masses whose union is exactly the one-ledger register
 *                   of the composed marked set; totals sum to 1 - P_AB
 *   waiting price   E[T_AB] = 1/(P_A P_2) = 1/P_A + (1-P_2)/(P_A P_2)
 *                   (renewal decomposition: the second ledger's failure
 *                   odds, amortized by the first ledger's success)
 *   odds additivity (1-P_AB)/P_AB = (1-P_A)/P_A + (1-P_2)/(P_A P_2)
 *                   (the amortized kill-odds ADD across stages)
 *
 * The posterior-of-posterior is the posterior over the composed funded
 * set — BAY63's rule telescoped (c_x/keptA * keptA/keptAB = c_x/keptAB),
 * verified on the fraction path AND on the sequential-projection amplitude
 * path. Vocabulary anchors: RLW24 (a postselected test may return
 * inconclusive — refusal is part of the grammar, and the trial accounting
 * counts the refusals). No theorem of theirs is re-proved here; every
 * claim below is elementary algebra on integer tables.
 */

import { runPriorSorter } from "./survivor.js";
import type { KillRow, PriorSorterRun } from "./survivor.js";

export interface CompositionRun {
  readonly n: number;
  readonly N: number;
  readonly markedA: readonly number[];
  readonly markedB: readonly number[];
  /** stage-1 ledger: marked A on the raw prior */
  readonly runA: PriorSorterRun;
  /** composed ledger: marked A∩B on the raw prior */
  readonly runAB: PriorSorterRun;
  /** P_A */
  readonly p1: number;
  /** stage-2 keep measured inside the A-survivor frame: sum of posterior_A over funded(A∩B) */
  readonly p2: number;
  /** chain-rule cross-path: |P_2 - P_AB/P_A| (the two ways of reading stage 2's price) */
  readonly p2Dev: number;
  /** |P_A * P_2 - P_AB| — the chain rule, two independent paths */
  readonly chainDev: number;
  /** posterior composition: apply stage 2 to posterior_A (fraction telescoping) vs posterior_AB */
  readonly posteriorComposeDev: number;
  /** amplitude path: project survivor_A onto funded(A∩B), renormalize, vs survivor_AB */
  readonly survivorComposeDev: number;
  /** itemized: union(stage-1 kills, stage-2 kills) vs the direct A∩B register — same items, same masses */
  readonly registerComposeDev: number;
  /** |sum(stage-1 masses) + sum(stage-2 masses) - (1 - P_AB)| */
  readonly registerSumDev: number;
  /** stage-2 register: universes the FIRST ledger kept and the second killed, itemized */
  readonly killRegister2: readonly KillRow[];
  /** |1/(P_A P_2) - 1/P_AB| — composite waiting, chain path vs direct */
  readonly waitingChainDev: number;
  /** |1/P_A + (1-P_2)/(P_A P_2) - 1/P_AB| — renewal decomposition path */
  readonly waitingRenewalDev: number;
  /** |(1-P1)/P1 + (1-P2)/(P1 P2) - (1-P_AB)/P_AB| — amortized odds additivity */
  readonly oddsComposeDev: number;
  /** order irrelevance: composing (A,B) and (B,A) yields the same composed posterior */
  readonly orderDev: number;
}

export function composeStages(
  n: number,
  counts: readonly number[],
  markedA: readonly number[],
  markedB: readonly number[],
  phases?: readonly number[],
): CompositionRun {
  const N = 2 ** n;
  if (counts.length !== N) throw new Error("composeStages: count table must have length 2^n");
  const totalC = counts.reduce((a, b) => a + b, 0);
  const markedAB = [...markedA].filter((x) => markedB.includes(x));
  if (markedAB.length === 0) {
    throw new Error(
      "composeStages: composed conditioning undefined — the intersection is empty (stage B starves stage A's survivor)",
    );
  }

  const runA = runPriorSorter(n, counts, markedA, phases);
  // an unfunded intersection is the P=0 face inherited through the chain —
  // the second ledger can starve the first's survivor completely: refusal
  let runAB: PriorSorterRun;
  try {
    runAB = runPriorSorter(n, counts, markedAB, phases);
  } catch (e) {
    if (e instanceof Error && e.message.includes("undefined")) {
      throw new Error(
        "composeStages: composed conditioning undefined — the intersection holds no funded optimum (stage B starves stage A's survivor)",
        { cause: e },
      );
    }
    throw e;
  }

  // stage-2 keep, measured INSIDE the A-survivor frame: posterior_A mass on funded(A∩B)
  let p2 = 0;
  for (let x = 0; x < N; x++) {
    if (runAB.posterior[x] as number > 0) p2 += runA.posterior[x] as number;
  }
  const p1 = runA.pKeep;

  // posterior composition on the fraction path: telescope c_x/keptA * keptA/keptAB;
  // a universe the second stage killed has staged reading 0 (the renormalization
  // runs over survivors only) and direct reading 0 — the two 0s agree
  let posteriorComposeDev = 0;
  for (let x = 0; x < N; x++) {
    const keptAB = (runAB.posterior[x] as number) > 0;
    const staged = keptAB ? (runA.posterior[x] as number) / p2 : 0;
    const dev = Math.abs(staged - (runAB.posterior[x] as number));
    if (dev > posteriorComposeDev) posteriorComposeDev = dev;
  }

  // amplitude path: survivor_A projected onto funded(A∩B), renormalized —
  // the projection zeroes exactly what stage B killed
  let projNorm = 0;
  for (let x = 0; x < N; x++) {
    const amp = Math.hypot(runA.survivorRe[x] as number, runA.survivorIm[x] as number);
    if ((runAB.posterior[x] as number) > 0) projNorm += amp * amp;
  }
  const projScale = 1 / Math.sqrt(projNorm);
  let survivorComposeDev = 0;
  for (let x = 0; x < N; x++) {
    const keptAB = (runAB.posterior[x] as number) > 0;
    const aRe = keptAB ? (runA.survivorRe[x] as number) * projScale : 0;
    const aIm = keptAB ? (runA.survivorIm[x] as number) * projScale : 0;
    const bRe = runAB.survivorRe[x] as number;
    const bIm = runAB.survivorIm[x] as number;
    const dev = Math.max(Math.abs(aRe - bRe), Math.abs(aIm - bIm));
    if (dev > survivorComposeDev) survivorComposeDev = dev;
  }

  // register composition: stage 1 kills what A kills; stage 2 kills what A
  // kept but B did not — the items are disjoint and their union is the
  // direct A∩B register, universe by universe, mass by mass
  const directById = new Map<number, KillRow>();
  for (const row of runAB.killRegister) directById.set(row.x, row);
  const killRegister2: KillRow[] = [];
  let registerComposeDev = 0;
  let sum1 = 0;
  for (const row of runA.killRegister) {
    sum1 += row.mass;
    const direct = directById.get(row.x);
    const dev = direct === undefined ? Number.POSITIVE_INFINITY : Math.abs(row.mass - direct.mass);
    if (dev > registerComposeDev) registerComposeDev = dev;
  }
  for (let x = 0; x < N; x++) {
    const keptByA = (runA.posterior[x] as number) > 0;
    const keptByAB = (runAB.posterior[x] as number) > 0;
    if (keptByA && !keptByAB) {
      killRegister2.push({ x, mass: (counts[x] as number) / totalC, count: counts[x] as number, totalC });
    }
  }
  let sum2 = 0;
  for (const row of killRegister2) {
    sum2 += row.mass;
    const direct = directById.get(row.x);
    const dev = direct === undefined ? Number.POSITIVE_INFINITY : Math.abs(row.mass - direct.mass);
    if (dev > registerComposeDev) registerComposeDev = dev;
  }
  // every direct kill must be covered by exactly one stage
  const stagedX = new Set<number>([
    ...runA.killRegister.map((r) => r.x),
    ...killRegister2.map((r) => r.x),
  ]);
  for (const row of runAB.killRegister) {
    if (!stagedX.has(row.x)) registerComposeDev = Number.POSITIVE_INFINITY;
  }

  const pAB = runAB.pKeep;
  const waitingChain = 1 / (p1 * p2);
  const waitingRenewal = 1 / p1 + (1 - p2) / (p1 * p2);
  const oddsComposed = (1 - p1) / p1 + (1 - p2) / (p1 * p2);

  // order irrelevance on address filters: (A,B) and (B,A) compose the same posterior
  const reversed = composeOneSide(n, counts, markedB, markedA, phases);
  let orderDev = 0;
  for (let x = 0; x < N; x++) {
    const dev = Math.abs((runAB.posterior[x] as number) - (reversed.posterior[x] as number));
    if (dev > orderDev) orderDev = dev;
  }

  return {
    n,
    N,
    markedA,
    markedB,
    runA,
    runAB,
    p1,
    p2,
    p2Dev: Math.abs(p2 - pAB / p1),
    chainDev: Math.abs(p1 * p2 - pAB),
    posteriorComposeDev,
    survivorComposeDev,
    registerComposeDev,
    registerSumDev: Math.abs(sum1 + sum2 - (1 - pAB)),
    killRegister2,
    waitingChainDev: Math.abs(waitingChain - 1 / pAB),
    waitingRenewalDev: Math.abs(waitingRenewal - 1 / pAB),
    oddsComposeDev: Math.abs(oddsComposed - (1 - pAB) / pAB),
    orderDev,
  };
}

/** one-sided helper for the order-irrelevance referee (posterior of composing B then A) */
function composeOneSide(
  n: number,
  counts: readonly number[],
  markedFirst: readonly number[],
  markedSecond: readonly number[],
  phases?: readonly number[],
): PriorSorterRun {
  const marked = [...markedFirst].filter((x) => markedSecond.includes(x));
  return runPriorSorter(n, counts, marked, phases);
}

/**
 * The composition claim a ledger may file. It exists to be forged: the
 * smuggling trials hand the checker counterfeit registers and fake
 * identities, and the checker NAMES what is wrong. The true claim from
 * claimFromComposition() audits clean.
 */
export interface CompositionClaim {
  readonly label: string;
  readonly p1: number;
  readonly p2: number;
  readonly pAB: number;
  readonly register1: readonly KillRow[];
  readonly register2: readonly KillRow[];
  readonly registerABTotal: number;
  readonly waitingClosed: number;
  readonly waitingRenewal: number;
  readonly oddsAB: number;
}

export function claimFromComposition(run: CompositionRun): CompositionClaim {
  let sum1 = 0;
  for (const row of run.runA.killRegister) sum1 += row.mass;
  let sum2 = 0;
  for (const row of run.killRegister2) sum2 += row.mass;
  return {
    label: `(${run.markedA.join(",")}) then (${run.markedB.join(",")})`,
    p1: run.p1,
    p2: run.p2,
    pAB: run.runAB.pKeep,
    register1: run.runA.killRegister,
    register2: run.killRegister2,
    registerABTotal: sum1 + sum2,
    waitingClosed: 1 / run.runAB.pKeep,
    waitingRenewal: 1 / run.p1 + (1 - run.p2) / (run.p1 * run.p2),
    oddsAB: (1 - run.runAB.pKeep) / run.runAB.pKeep,
  };
}

/**
 * The composition laws C1-C5. Returns the violations, each NAMED; an
 * honest stacked ledger returns []. A forged one boards only if it
 * satisfies every identity it claims — the trials prove otherwise.
 */
export function auditComposition(claim: CompositionClaim, tol: number): string[] {
  const violations: string[] = [];

  // C1 — the chain rule: P_AB = P_A * P_2 (never additive)
  if (Math.abs(claim.p1 * claim.p2 - claim.pAB) > tol) {
    violations.push(
      `C1: '${claim.label}' chain rule violated — P_A*P_2 = ${(claim.p1 * claim.p2).toPrecision(12)} but P_AB = ${claim.pAB.toPrecision(12)} (probabilities do not ADD under composition)`,
    );
  }

  // C2 — the staged registers sum to the composed complement 1 - P_AB
  let sum1 = 0;
  for (const row of claim.register1) sum1 += row.mass;
  let sum2 = 0;
  for (const row of claim.register2) sum2 += row.mass;
  if (Math.abs(sum1 + sum2 - (1 - claim.pAB)) > tol) {
    violations.push(
      `C2: '${claim.label}' kill registers do not compose — staged kills sum to ${(sum1 + sum2).toPrecision(12)} but 1-P_AB = ${(1 - claim.pAB).toPrecision(12)}`,
    );
  }
  if (Math.abs(claim.registerABTotal - (1 - claim.pAB)) > tol) {
    violations.push(
      `C2: '${claim.label}' declared register total ${claim.registerABTotal.toPrecision(12)} is not 1-P_AB = ${(1 - claim.pAB).toPrecision(12)}`,
    );
  }

  // C3 — the stages are disjoint: no universe dies twice
  const seen = new Set<number>();
  for (const row of [...claim.register1, ...claim.register2]) {
    if (seen.has(row.x)) {
      violations.push(`C3: '${claim.label}' registers not disjoint — universe ${row.x} killed in BOTH stages`);
      break;
    }
    seen.add(row.x);
  }

  // C4 — the renewal decomposition of the composite waiting price
  if (Math.abs(claim.waitingRenewal - claim.waitingClosed) > tol * Math.max(1, claim.waitingClosed)) {
    violations.push(
      `C4: '${claim.label}' renewal identity violated — 1/P_A + (1-P_2)/(P_A P_2) = ${claim.waitingRenewal.toPrecision(12)} but 1/P_AB = ${claim.waitingClosed.toPrecision(12)}`,
    );
  }

  // C5 — amortized kill-odds add: (1-P_AB)/P_AB = (1-P_1)/P_1 + (1-P_2)/(P_1 P_2)
  const oddsStaged = (1 - claim.p1) / claim.p1 + (1 - claim.p2) / (claim.p1 * claim.p2);
  if (Math.abs(oddsStaged - claim.oddsAB) > tol * Math.max(1, Math.abs(claim.oddsAB))) {
    violations.push(
      `C5: '${claim.label}' odds additivity violated — staged odds ${oddsStaged.toPrecision(12)} but declared (1-P_AB)/P_AB = ${claim.oddsAB.toPrecision(12)} (stage-2 odds must be amortized by P_A)`,
    );
  }

  return violations;
}
