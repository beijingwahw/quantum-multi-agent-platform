/**
 * run-all — executes every witness and assembles the census.
 *
 * The census rows are the letter's own epoch-3 sentences, upgraded: each rate
 * row carries BOTH faces (G1), every exactness cites a witness (G2), every
 * quoted number anchors to a live repo+report (G3).
 */

import { Rng, phaseOverlap, realizationCheck, runPriorSorter } from "../kernel/survivor.js";
import type { PriorSorterRun } from "../kernel/survivor.js";
import { mcWaiting, schedule, tailAt, waitingPrice } from "../kernel/waitprice.js";
import type { Census, CensusRow, Witness } from "../kernel/audit.js";
import { composeStages } from "../kernel/compose.js";
import type { CompositionRun } from "../kernel/compose.js";
import { auditComposition, claimFromComposition } from "../kernel/compose.js";
import { runPhaseCensus } from "../kernel/phasecensus.js";
import type { PhaseCensus } from "../kernel/phasecensus.js";
import { buildInstances, buildStagePairs, p0Probe } from "./instances.js";
import type { Instance, StagePair } from "./instances.js";
import { CensusError, expectFound } from "../kernel/errors.js";
import { TOL } from "../kernel/tol.js";

export interface InstanceOutcome {
  readonly instance: Instance;
  readonly run: PriorSorterRun;
}

export interface CompositionOutcome {
  readonly pair: StagePair;
  readonly run: CompositionRun;
}

export interface AllOutcomes {
  readonly outcomes: readonly InstanceOutcome[];
  readonly posteriorMaxDev: number;
  readonly offMarkedLeakMax: number;
  readonly killedMaxDev: number;
  readonly uniformFlatRegisterDev: number;
  readonly oddsMaxDev: number;
  readonly phaseDev: number;
  readonly phaseSelfOverlap: number;
  readonly waitingMaxDev: number;
  readonly scheduleAllMinimal: boolean;
  readonly scheduleMinOvercharge: number;
  readonly mcWaitingSigma: number;
  readonly mcSurvivorSigma: number;
  readonly p0Refused: boolean;
  readonly p1EmptyRegister: boolean;
  readonly unfundedNeverReturn: boolean;
  readonly t1PointMass: boolean;
  readonly compositions: readonly CompositionOutcome[];
  readonly compositionChainMaxDev: number;
  readonly compositionPosteriorMaxDev: number;
  readonly compositionSurvivorMaxDev: number;
  readonly compositionRegisterMaxDev: number;
  readonly compositionRegisterSumMaxDev: number;
  readonly compositionWaitingChainMaxDev: number;
  readonly compositionWaitingRenewalMaxDev: number;
  readonly compositionOddsMaxDev: number;
  readonly compositionOrderMaxDev: number;
  readonly compositionIdentityHolds: boolean;
  readonly compositionIdempotentHolds: boolean;
  readonly compositionAuditViolations: readonly string[];
  readonly starvedIntersectionRefused: boolean;
  readonly phaseCensus: PhaseCensus;
}

export function runAll(): AllOutcomes {
  const instances = buildInstances();
  const outcomes: InstanceOutcome[] = instances.map((instance) => ({
    instance,
    run: runPriorSorter(instance.n, instance.counts, instance.marked),
  }));

  let posteriorMaxDev = 0;
  let offMarkedLeakMax = 0;
  let killedMaxDev = 0;
  let oddsMaxDev = 0;
  for (const { run } of outcomes) {
    posteriorMaxDev = Math.max(posteriorMaxDev, run.posteriorDev);
    offMarkedLeakMax = Math.max(offMarkedLeakMax, run.offMarkedLeak);
    killedMaxDev = Math.max(killedMaxDev, run.killedDev);
    const oddsSecondPath = 1 / run.pKeep - 1;
    oddsMaxDev = Math.max(oddsMaxDev, Math.abs(run.oddsPerSurvivor - oddsSecondPath));
  }

  // the uniform prior degenerates to postselect-sched's flat ground
  const uniform = expectFound("uniform-prior outcome", outcomes.find((o) => o.instance.name === "uniform-prior"));
  const { N, tFunded } = uniform.run;
  let flatDev = 0;
  for (const row of uniform.run.killRegister) flatDev = Math.max(flatDev, Math.abs(row.mass - 1 / N));
  const uniformFlatRegisterDev = Math.max(
    flatDev,
    Math.abs((uniform.run.killedTotal * N) / (N - tFunded) - 1),
  );

  // coherence face: two phase assignments on the quarter-funded instance
  const rng = new Rng(307);
  const quarter = expectFound("quarter-funded instance", instances.find((i) => i.name === "quarter-funded"));
  const phiA = Array.from({ length: N }, () => 2 * Math.PI * rng.next());
  const phiB = phiA.map((p, x) => p + (x % 2 === 0 ? Math.PI / 5 : -Math.PI / 7));
  const ph = phaseOverlap(quarter.n, quarter.counts, quarter.marked, phiA, phiB);

  // waiting price on the instances' P values plus anchor grid (the degenerate
  // P=1 instance is excluded — its wait is trivially one trial; float pKeep
  // there is 1+eps and outside the kernel's domain)
  const pGrid = [0.5, 2 ** -10, 2 ** -20, ...outcomes.map((o) => o.run.pKeep).filter((p) => p < 1)];
  let waitingMaxDev = 0;
  for (const p of pGrid) waitingMaxDev = Math.max(waitingMaxDev, waitingPrice(p).meanDev);

  // schedule grid: minimality + the bound's overcharge
  const deltas = [1e-3, 1e-6, 1e-12];
  const schedP = [0.5, 0.1, 2 ** -10, 2 ** -20];
  let scheduleAllMinimal = true;
  let scheduleMinOvercharge = Number.POSITIVE_INFINITY;
  for (const p of schedP) {
    for (const delta of deltas) {
      const s = schedule(p, delta);
      scheduleAllMinimal = scheduleAllMinimal && s.minimal;
      scheduleMinOvercharge = Math.min(scheduleMinOvercharge, s.overcharge);
      // tail cross-path: exp-log vs Math.pow agree
      if (Math.abs(tailAt(p, s.kExact) - (1 - p) ** s.kExact) > TOL) {
        scheduleAllMinimal = false;
      }
    }
  }

  // Monte Carlo realization referee (never a theorem claim)
  const mc = realizationCheck(quarter.n, quarter.counts, quarter.marked, 409, 40000);
  const mcw = mcWaitingLocal(0.25, 419, 200000);

  // boundaries
  const probe = p0Probe();
  let p0Refused = false;
  try {
    runPriorSorter(probe.n, probe.counts, probe.marked);
  } catch (e) {
    // the refusal is discriminated by error code, not message text
    p0Refused = e instanceof CensusError && e.code === "SC/P0-UNDEFINED";
  }
  const full = expectFound("full-funding outcome", outcomes.find((o) => o.instance.name === "full-funding"));
  const p1EmptyRegister = full.run.killRegister.length === 0 && Math.abs(full.run.killedTotal) < 1e-15;
  const unfunded = expectFound("unfunded-optimum outcome", outcomes.find((o) => o.instance.name === "unfunded-optimum"));
  const unfundedX = expectFound("unfunded optimum index", unfunded.run.unfundedOptima[0]);
  const unfundedNeverReturn =
    unfunded.run.unfundedOptima.length === 1 &&
    unfunded.run.posterior[unfundedX] === 0 &&
    unfunded.run.tFunded === unfunded.run.tRaw - 1;
  const t1 = expectFound("t1-fund outcome", outcomes.find((o) => o.instance.name === "t1-fund"));
  const t1X = expectFound("t1 marked item", t1.instance.marked[0]);
  const t1PointMass = Math.abs(t1.run.posterior[t1X]! - 1) < TOL && t1.run.tFunded === 1;

  // S6 — sequential postselection: the stacked ledgers (the starved pair refuses)
  const starved = expectFound("starved-intersection pair", buildStagePairs().find((p) => p.name === "starved-intersection"));
  let starvedIntersectionRefused = false;
  try {
    composeStages(starved.n, starved.counts, starved.markedA, starved.markedB);
  } catch (e) {
    starvedIntersectionRefused = e instanceof CensusError && e.code === "SC/EMPTY-INTERSECTION";
  }
  const compositions: CompositionOutcome[] = [];
  for (const pair of buildStagePairs()) {
    if (pair.name === "starved-intersection") continue;
    compositions.push({ pair, run: composeStages(pair.n, pair.counts, pair.markedA, pair.markedB) });
  }
  let compositionChainMaxDev = 0;
  let compositionPosteriorMaxDev = 0;
  let compositionSurvivorMaxDev = 0;
  let compositionRegisterMaxDev = 0;
  let compositionRegisterSumMaxDev = 0;
  let compositionWaitingChainMaxDev = 0;
  let compositionWaitingRenewalMaxDev = 0;
  let compositionOddsMaxDev = 0;
  let compositionOrderMaxDev = 0;
  for (const { run } of compositions) {
    compositionChainMaxDev = Math.max(compositionChainMaxDev, run.chainDev, run.p2Dev);
    compositionPosteriorMaxDev = Math.max(compositionPosteriorMaxDev, run.posteriorComposeDev);
    compositionSurvivorMaxDev = Math.max(compositionSurvivorMaxDev, run.survivorComposeDev);
    compositionRegisterMaxDev = Math.max(compositionRegisterMaxDev, run.registerComposeDev);
    compositionRegisterSumMaxDev = Math.max(compositionRegisterSumMaxDev, run.registerSumDev);
    compositionWaitingChainMaxDev = Math.max(compositionWaitingChainMaxDev, run.waitingChainDev);
    compositionWaitingRenewalMaxDev = Math.max(compositionWaitingRenewalMaxDev, run.waitingRenewalDev);
    compositionOddsMaxDev = Math.max(compositionOddsMaxDev, run.oddsComposeDev);
    compositionOrderMaxDev = Math.max(compositionOrderMaxDev, run.orderDev);
  }
  // structural referees: the identity stage composes to stage A alone; A twice is A
  const identityCo = expectFound("identity-stage composition", compositions.find((c) => c.pair.name === "identity-stage"));
  const compositionIdentityHolds =
    identityCo.run.killRegister2.length === 0 &&
    Math.abs(identityCo.run.p2 - 1) < TOL &&
    Math.abs(identityCo.run.runAB.pKeep - identityCo.run.runA.pKeep) < TOL;
  const idemCo = expectFound("idempotent composition", compositions.find((c) => c.pair.name === "idempotent"));
  const compositionIdempotentHolds =
    idemCo.run.killRegister2.length === 0 &&
    Math.abs(idemCo.run.p2 - 1) < TOL &&
    Math.abs(idemCo.run.runAB.pKeep - idemCo.run.runA.pKeep) < TOL;
  const compositionAuditViolations = compositions.flatMap((c) =>
    auditComposition(claimFromComposition(c.run), TOL),
  );

  // S7 — the phase-encoding census on the quarter-funded instance
  const phaseCensus = runPhaseCensus(quarter.n, quarter.counts, quarter.marked);

  return {
    outcomes,
    posteriorMaxDev,
    offMarkedLeakMax,
    killedMaxDev,
    uniformFlatRegisterDev,
    oddsMaxDev,
    phaseDev: ph.deviation,
    phaseSelfOverlap: ph.selfOverlap,
    waitingMaxDev,
    scheduleAllMinimal,
    scheduleMinOvercharge,
    mcWaitingSigma: mcw.sigmaUnits,
    mcSurvivorSigma: mc.worstSurvivorSigma,
    p0Refused,
    p1EmptyRegister,
    unfundedNeverReturn,
    t1PointMass,
    compositions,
    compositionChainMaxDev,
    compositionPosteriorMaxDev,
    compositionSurvivorMaxDev,
    compositionRegisterMaxDev,
    compositionRegisterSumMaxDev,
    compositionWaitingChainMaxDev,
    compositionWaitingRenewalMaxDev,
    compositionOddsMaxDev,
    compositionOrderMaxDev,
    compositionIdentityHolds,
    compositionIdempotentHolds,
    compositionAuditViolations,
    starvedIntersectionRefused,
    phaseCensus,
  };
}

function mcWaitingLocal(p: number, seed: number, runs: number): { sigmaUnits: number } {
  const rng = new Rng(seed);
  return mcWaiting(p, runs, () => rng.next());
}

export function buildCensus(o: AllOutcomes): Census {
  const witnesses: Witness[] = [
    {
      id: "W-A",
      description: "survivor = posterior: amplitude path vs integer-ratio path (c_x / sum kept c), all instances",
      passed: o.posteriorMaxDev < TOL,
      detail: `max deviation ${o.posteriorMaxDev.toExponential(3)}`,
    },
    {
      id: "W-B",
      description: "zero amplitude outside the funded marked set after conditioning (all instances)",
      passed: o.offMarkedLeakMax === 0,
      detail: `max leak ${o.offMarkedLeakMax}`,
    },
    {
      id: "W-C",
      description: "kill register totals: sum of itemized masses vs 1-P complement (all instances); uniform prior degenerates to the flat 1/N register of postselect-sched's uniform ground",
      passed: o.killedMaxDev < TOL && o.uniformFlatRegisterDev < TOL,
      detail: `complement dev ${o.killedMaxDev.toExponential(3)}, uniform-flat dev ${o.uniformFlatRegisterDev.toExponential(3)}`,
    },
    {
      id: "W-D",
      description: "odds identity: (1-P)/P vs 1/P - 1, all instances",
      passed: o.oddsMaxDev < TOL,
      detail: `max deviation ${o.oddsMaxDev.toExponential(3)}`,
    },
    {
      id: "W-E",
      description: "coherence kept: survivor overlap under two phase assignments, amplitude path vs closed form; self-overlap exactly 1",
      passed: o.phaseDev < TOL && Math.abs(o.phaseSelfOverlap - 1) < TOL,
      detail: `overlap dev ${o.phaseDev.toExponential(3)}, self-overlap ${o.phaseSelfOverlap.toFixed(15)}`,
    },
    {
      id: "W-F",
      description: "waiting price E[T] = 1/P: closed form vs closed-form partial sum (analytic tail < 1e-12 of the mean), instance P-grid plus anchors 1/2, 2^-10, 2^-20; loop referee at moderate P",
      passed: o.waitingMaxDev < 1e-10,
      detail: `max deviation ${o.waitingMaxDev.toExponential(3)}`,
    },
    {
      id: "W-G",
      description: "exact schedule minimality ((1-P)^k <= delta < (1-P)^(k-1)) on the (P, delta) grid, exp-log vs pow cross-path; bound overcharge never negative",
      passed: o.scheduleAllMinimal && o.scheduleMinOvercharge >= 0,
      detail: `all minimal: ${o.scheduleAllMinimal}, min overcharge ${(Number.isFinite(o.scheduleMinOvercharge) ? o.scheduleMinOvercharge : 0).toFixed(4)}`,
    },
    {
      id: "W-H",
      description: "realization referee: physical draw-from-prior procedure lands inside 5 sigma for both the geometric waiting and the survivor posterior (DATA, never a theorem claim)",
      passed: o.mcWaitingSigma < 5 && o.mcSurvivorSigma < 5,
      detail: `waiting ${o.mcWaitingSigma.toFixed(2)} sigma, survivor ${o.mcSurvivorSigma.toFixed(2)} sigma`,
    },
    {
      id: "W-I",
      description: "boundaries executable: P=0 conditioning refuses (thrown error), P=1 register empty, unfunded optimum marked-but-never-returns, t=1 posterior is a point mass",
      passed: o.p0Refused && o.p1EmptyRegister && o.unfundedNeverReturn && o.t1PointMass,
      detail: `p0Refused=${o.p0Refused}, p1Empty=${o.p1EmptyRegister}, unfundedNeverReturn=${o.unfundedNeverReturn}, t1PointMass=${o.t1PointMass}`,
    },
    {
      id: "W-J",
      description: "composition laws, exact: chain rule P_AB = P_A*P_2; posterior-of-posterior = posterior over funded(A∩B) on fraction AND sequential-projection amplitude paths; staged kill registers disjoint, union = direct register, sum = 1-P_AB; E[T_AB] = 1/(P_A P_2) = 1/P_A + (1-P_2)/(P_A P_2); amortized odds ADD; order-irrelevant; identity and idempotent stages; starved intersection refuses; own audit C1-C5 clean",
      passed:
        o.compositionChainMaxDev < TOL &&
        o.compositionPosteriorMaxDev < TOL &&
        o.compositionSurvivorMaxDev < TOL &&
        o.compositionRegisterMaxDev < TOL &&
        o.compositionRegisterSumMaxDev < TOL &&
        o.compositionWaitingChainMaxDev < TOL &&
        o.compositionWaitingRenewalMaxDev < TOL &&
        o.compositionOddsMaxDev < TOL &&
        o.compositionOrderMaxDev < TOL &&
        o.compositionIdentityHolds &&
        o.compositionIdempotentHolds &&
        o.starvedIntersectionRefused &&
        o.compositionAuditViolations.length === 0,
      detail: `chain ${o.compositionChainMaxDev.toExponential(3)}, posterior ${o.compositionPosteriorMaxDev.toExponential(3)}, survivor ${o.compositionSurvivorMaxDev.toExponential(3)}, register ${o.compositionRegisterMaxDev.toExponential(3)}, sum ${o.compositionRegisterSumMaxDev.toExponential(3)}, wait-chain ${o.compositionWaitingChainMaxDev.toExponential(3)}, wait-renewal ${o.compositionWaitingRenewalMaxDev.toExponential(3)}, odds ${o.compositionOddsMaxDev.toExponential(3)}, order ${o.compositionOrderMaxDev.toExponential(3)}, identity=${o.compositionIdentityHolds}, idempotent=${o.compositionIdempotentHolds}, starved-refused=${o.starvedIntersectionRefused}, audit-violations=${o.compositionAuditViolations.length}`,
    },
    {
      id: "W-K",
      description: "phase-encoding census: the LEDGER is phase-blind (P, itemized register, E[T] invariant across flat/sign-alt/fourier/random families, deviation exactly 0; dephased reading = posterior under every encoding on the standard two-path float dev); the STATE is phase-carrying (self-overlap 1 under every encoding; |overlap| = 1 exactly for constant phase differences — detected per funded set — and strictly < 1 on every non-constant family censused)",
      passed: o.phaseCensus.coherenceLawHolds && o.phaseCensus.ledgerPhaseBlindnessDev === 0 && o.phaseCensus.dephasedReadingMaxDev < TOL,
      detail: `ledger phase-blindness dev ${o.phaseCensus.ledgerPhaseBlindnessDev}, dephased reading dev ${o.phaseCensus.dephasedReadingMaxDev.toExponential(3)}, self-overlap dev ${o.phaseCensus.selfOverlapMaxDev.toExponential(3)}, equality-case dev ${o.phaseCensus.equalityCaseDev.toExponential(3)}, strictness margin ${o.phaseCensus.strictMargin.toExponential(3)} (DATA over the enumerated families)`,
    },
  ];

  const rows: CensusRow[] = [
    {
      id: "R1",
      claim: "'postselection lets the optimal branch stay' — the survivor's identity",
      label: "INTEGER-RATIO",
      conditionalFace: "the kept branch is clean: zero amplitude outside the funded marked set, exactly",
      unconditionalFace: "the survivor is the POSTERIOR over optima weighted by the prior you brought (c_x / sum of funded c); 'the' optimum exists only at t=1 — the sorter sorts by the prior, and an unfunded optimum never comes back",
      witnessId: "W-A",
    },
    {
      id: "R2",
      claim: "'complexity O(1)' — the sorter's speed",
      label: "EXACT",
      conditionalFace: "inside the survived frame: one coherent pass, zero repetitions, the readout is deterministic",
      unconditionalFace: "outside the frame: waiting time to first survivor is geometric, E[T] = 1/P exactly; at P = 2^-20 the expected wait is 1,048,576 trials",
      witnessId: "W-F",
    },
    {
      id: "R3",
      claim: "'the cost is the depreciation of the other universes' — the register",
      label: "EXACT",
      conditionalFace: "the register is itemized per universe: each killed branch with its own mass",
      unconditionalFace: "the register sums to 1-P exactly (two paths); amortized killed mass per confirmed survivor is (1-P)/P — the failure odds; the uniform prior degenerates to postselect-sched's flat 1/N ledger",
      witnessId: "W-C",
    },
    {
      id: "R4",
      claim: "the coherence face — branches stay phases, not just masses",
      label: "EXACT",
      conditionalFace: "the survivor is ONE pure state over the funded branches: relative phases survive postselection",
      unconditionalFace: "an address reading dephases it into the posterior — pure state, mixed reading; the interference (phase-overlap vs closed form) is what a classical mixture over branches cannot carry",
      witnessId: "W-E",
    },
    {
      id: "R5",
      claim: "sorter certainty at t=1 (cross-anchor)",
      label: "QUOTED",
      conditionalFace: "postselect-sched T1: conditional address is EXACTLY \\|x*> at t=1, fidelity 1.000000000000 (n=4..14)",
      unconditionalFace: "this repo W-A: the posterior degenerates to a point mass at t=1 — same fact from the prior side; the point-mass regime is the only one where the singular 'the optimal branch' is honest",
      quote: { repo: "postselect-sched", report: "out/reports/t1-sorter.md" },
    },
    {
      id: "R6",
      claim: "the cache's 'hit rate 100%' (cross-anchor)",
      label: "QUOTED",
      conditionalFace: "retro-cache W3: pre-arrival, the cache state is indistinguishable from a shared random seed (TV = 0.000000000000000) — the answer is 'there' only relative to the question that later aligns",
      unconditionalFace: "nosignal-tariff T4: net(p) = (1 - h2((1-p)/2))/2 — 0.5 clean, 0.094360938 at p=0.5, exactly 0 at the seed floor p=0; the unconditional yield per raw pair is the withdrawal schedule",
      quote: { repo: "retro-cache", report: "out/reports/w3-equivalence.md" },
    },
    {
      id: "R7",
      claim: "the wall row — one wall, two audits",
      label: "DATA",
      conditionalFace: "'O(1)' and 'hit rate 100%' are both TRUE in the survived/aligned frame — neither is a lie",
      unconditionalFace: "transported out of its frame each claim pays its yield: the sorter P per trial (E[T] = 1/P), the cache net(p) per raw pair — CONDITIONAL-WALL and INFO-WALL are the same wall audited from two sides",
    },
    {
      id: "R8",
      claim: "the grammar failures — where the sentence has no referent",
      label: "EXACT",
      conditionalFace: "P=0: zero-branch conditioning is UNDEFINED — the sorter has no output face; P=1: the register is empty, nothing was sorted",
      unconditionalFace: "'lets the optimal branch stay' presupposes a FUNDED optimum (existence presupposition, executable as a thrown error); no finite price buys an event of probability zero",
      witnessId: "W-I",
    },
    {
      id: "R9",
      claim: "stacked ledgers — sequential postselection composes by the chain rule, never additively",
      label: "EXACT",
      conditionalFace: "survive stage A, then stage B: the posterior-of-posterior is exactly the posterior over funded(A∩B) (BAY63 telescoped; verified on fraction and sequential-projection paths); address filters commute, identity and idempotent stages are exact",
      unconditionalFace: "the composed price multiplies: P_AB = P_A*P_2, E[T_AB] = 1/(P_A P_2) with the renewal decomposition 1/P_A + (1-P_2)/(P_A P_2); the amortized kill-odds ADD, (1-P_AB)/P_AB = (1-P_A)/P_A + (1-P_2)/(P_A P_2); staged kill registers are disjoint items summing to 1-P_AB; a starved intersection refuses (P=0 inherited through the chain)",
      witnessId: "W-J",
    },
    {
      id: "R10",
      claim: "the phase-encoding census — what a phase structure buys",
      label: "EXACT",
      conditionalFace: "the survivor under ANY encoding (flat, sign-alternating, Fourier ramps, seeded random) is one pure state over the funded branches: self-overlap 1, |overlap| = 1 exactly iff the phase difference is constant on the funded set",
      unconditionalFace: "the LEDGER is phase-blind: P, the itemized kill register, and E[T] = 1/P are invariant across every encoding censused, deviation exactly 0 — no phase encoding moves a single mass in the funeral bill; the interference lives only in the state's coherent overlaps (bounded census, no optimality or metrology claim)",
      witnessId: "W-K",
    },
  ];

  return { rows, witnesses };
}
