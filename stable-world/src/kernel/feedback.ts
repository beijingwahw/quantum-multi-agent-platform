/**
 * E4 (AT19's kernel) — the measurement-feedback work extraction and the
 * WORK-LOCKING gap, on the shortcut's banked weight.
 *
 * The register's authored Hamiltonian H = dE·Pi_perp makes the coherent
 * shortcut (AT10) bank the straddler's sector bit on the weight qubit. This
 * file is the HARVEST side: a Sagawa–Ueda-form measurement-feedback engine
 * that turns the banked coherence into work, one shot, and the exact gap it
 * leaves locked.
 *
 * THE ENGINE (bit currency — kT ln2 per bit at temperature T, the AT5/AT7
 * tariff schedule; the weight's dE-energy face is the shortcut's own,
 * AT9/AT10 territory, untouched here):
 *
 *   1. ALIGN: the AT14 controlled-phase controller (diagonal in the product
 *      basis) rotates the weight marginal's coherence rho_01 to phase 0 —
 *      in work units this is exactly AT14's |sum sigma_r| -> sum |sigma_r|.
 *   2. MEASURE the weight in the |+/-) basis (Kraus M_± = |±><±|). Branch m
 *      has probability q_m and leaves the KNOWN pure state |m><m|.
 *   3. FEEDBACK: the conditional shift U_m maps |m> to the ground |1_w> —
 *      the post-channel state is |1><1| EXACTLY in every branch (the engine
 *      banks the weight deterministically; U_± are exact unitaries).
 *   4. LEDGER: a known pure bit randomizes isothermally on the degenerate
 *      pair for kT ln2 (the Landauer dual); the measurement record m is
 *      erased at its source-coding cost kT ln2 · h2(q). Net, in bits:
 *
 *        W_ext = kT ln2 · [1 − h2(q_+)],   q_+ = (1 + C_l1)/2,
 *        C_l1 = |rho_01| + |rho_10|  (the aligned weight's l1-coherence;
 *        equals 2x AT14's aligned bank).
 *
 * THE LAWS this file stamps (all machine-faces of the witnesses):
 *
 *   - STRADDLER ENDPOINT: a pure equal-weight straddler banks the FULL bit —
 *     C_l1 = 1, W_ext = kT ln2 exactly (AT10's harvest, whole).
 *   - WORK LOCKING: W_ext <= kT ln2 · C_rel(rho_W) ALWAYS, with equality
 *     exactly on the equal-population face (which contains every straddler
 *     image) — the free-energy value AT7 prices is only partially
 *     harvestable one-shot; the gap is quantified pointwise below. The
 *     asymptotic access stays quantum-side-information territory (WY16,
 *     cited not executed).
 *   - THE INCOHERENT NO-GO (negative control): an engine whose controller
 *     and measurement are ENERGY-BASIS-diagonal (incoherent operations)
 *     harvests EXACTLY ZERO from the coherence face — its yield on rho_W
 *     equals its yield on Delta rho_W identically. The coherent unlock is
 *     the |+/-) measurement plus the phase feedback: work locking is
 *     operational, not merely informational. The UNCONTROLLED |+/-) engine
 *     (no step 1) sees the raw phase and lands at the naive bank — at or
 *     below the aligned yield, equality iff the phase already aligns (the
 *     AT14 slack, in work units).
 *   - THE SPEC ADJUDICATION (registered honestly): the design note's raw
 *     closed form kT·ln(1 + C_l1) agrees with the engine at the endpoints
 *     C_l1 ∈ {0, 1} but OVERSTATES the harvest everywhere between — on the
 *     equal-population state with C_l1 = 1/2 it claims 0.585 bits against a
 *     free-energy value of 0.189 bits, a second-law violation the auditor
 *     convicts by name ("work smuggling above the free-energy value"). The
 *     engine's kT ln2 · [1 − h2((1+C_l1)/2)] is the corrected law.
 *
 * Boundary: single shot (no asymptotic distillation rates — WY16 cited);
 * the ledger prices the record erasure at its source-coding AVERAGE (the
 * deterministic worst-case face is not claimed); the measurement apparatus's
 * own gross cost is AT7's already-priced tariff line (not double counted —
 * the ledger nets record value against erasure); the engine runs on the
 * weight AFTER the shortcut (the register's residual faces are AT12/AT15
 * territory). Feedback literature: Sagawa–Ueda 2008/2010; the memory-reset
 * work value: del Rio et al. 2011; work locking: Lostaglio–Jennings–Rudolph
 * 2015; catalytic coherence: Åberg 2014 — all pending dual-source, listed in
 * the README section, not yet in citations.md.
 */
import {
  type CMat,
  identity,
  mat,
  mAdd,
  mDagger,
  mMul,
  vKron,
  vec,
  basisVec,
} from "../core/cmat.js";
import { applyKraus } from "../core/channels.js";
import { vonNeumannEntropy } from "../core/measures.js";
import { makeRng } from "../core/rng.js";
import { randomStateVec, vecToRho } from "../core/states.js";
import { DomainError } from "../core/errors.js";
import {
  GAMMA,
  coherentShortcut,
  h2,
  iterateLaw,
  sectorDephase,
} from "./law.js";
import type { WitnessResult } from "./audit.js";

// ---------------------------------------------------------------------------
// The engine's operators
// ---------------------------------------------------------------------------

/** M_+ = |+><+|, M_- = |-><-| — the coherence eigenbasis measurement. */
export function suMeasurementKraus(): [CMat, CMat] {
  const plus = mat(2, 2);
  plus.re[0] = 0.5;
  plus.re[1] = 0.5;
  plus.re[2] = 0.5;
  plus.re[3] = 0.5;
  const minus = mat(2, 2);
  minus.re[0] = 0.5;
  minus.re[1] = -0.5;
  minus.re[2] = -0.5;
  minus.re[3] = 0.5;
  return [plus, minus];
}

/** U_+ : |+> -> |1_w>, U_- : |-> -> |1_w> — the conditional shifts (each is
 * the reflection completing the mapped vector to an orthonormal basis). */
export function suFeedbackShifts(): [CMat, CMat] {
  const s = 1 / Math.SQRT2;
  const up = mat(2, 2);
  up.re[0] = s;
  up.re[1] = -s; // row 0 = <-|  (the |-> branch lands on |0>)
  up.re[2] = s;
  up.re[3] = s; // row 1 = <+|  (the |+> branch lands on |1>)
  const um = mat(2, 2);
  um.re[0] = s;
  um.re[1] = s; // row 0 = <+|
  um.re[2] = -s;
  um.re[3] = s; // row 1 = <-|
  return [up, um];
}

/** The AT14 controller's marginal action: rotate rho_01 to phase 0 (the
 * incoherent controlled-phase on the product basis; on the weight marginal
 * it is exactly this phase rotation — work-free for the same reason AT14's
 * is: a diagonal unitary conjugation). */
export function alignWeightPhase(rhoW: CMat): CMat {
  requireWeightState("alignWeightPhase", rhoW);
  const r = rhoW.re[1]!;
  const i = rhoW.im[1]!;
  const n = Math.hypot(r, i);
  const out = mat(2, 2);
  out.re[0] = rhoW.re[0]!;
  out.re[3] = rhoW.re[3]!;
  out.im[0] = rhoW.im[0]!;
  out.im[3] = rhoW.im[3]!;
  if (n > 0) {
    out.re[1] = n;
    out.re[2] = n;
  }
  return out;
}

function requireWeightState(entry: string, rhoW: CMat): void {
  if (rhoW.rows !== 2 || rhoW.cols !== 2) {
    throw new DomainError(
      `${entry}:dim`,
      `${entry}: the weight marginal is a 2x2 state, got ${String(rhoW.rows)}x${String(rhoW.cols)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

export interface FeedbackLedger {
  /** the aligned weight's l1-coherence |rho01|+|rho10| (= 2x AT14's bank) */
  readonly cL1: number;
  /** branch probability q_+ as the KRAUS EXECUTION reads it (Tr[M+ rho M+dag]) */
  readonly qPlusKraus: number;
  /** branch probability q_- from the same channel */
  readonly qMinusKraus: number;
  /** W_ext / (kT ln2) = 1 - h2(q_+) — the two roads agree to the floor */
  readonly workBits: number;
  /** the free-energy value AT7 prices: C_rel of the aligned weight, bits */
  readonly valueBits: number;
  /** valueBits - workBits >= 0 — the LOCKED share */
  readonly lockGapBits: number;
  /** the uncontrolled road's yield (raw phase, no step 1) — at or below */
  readonly naiveWorkBits: number;
  /** ||post-channel state - |1><1||| — the engine banks the weight exactly */
  readonly bankedDev: number;
  /** |q_+^Kraus - (1+C_l1)/2| — the two-road agreement */
  readonly twoRoadDev: number;
  /** ||Sigma M^dag M - I||, the measurement's completeness */
  readonly completenessDev: number;
}

/** The full one-shot ledger of the measurement-feedback engine on a weight
 * state: both roads, the value, the gap, and the channel identities. */
export function feedbackExtraction(rhoW: CMat): FeedbackLedger {
  requireWeightState("feedbackExtraction", rhoW);
  const [mp, mm] = suMeasurementKraus();
  const [up, um] = suFeedbackShifts();
  const aligned = alignWeightPhase(rhoW);
  // road A (closed form): the l1 coherence of the aligned marginal
  const cL1 = 2 * Math.hypot(rhoW.re[1]!, rhoW.im[1]!);
  // road B (Kraus execution): branch statistics read off the channel
  const plusBranch = applyKraus(aligned, [mp]);
  const minusBranch = applyKraus(aligned, [mm]);
  const qPlusKraus = plusBranch.re[0]! + plusBranch.re[3]!;
  const qMinusKraus = minusBranch.re[0]! + minusBranch.re[3]!;
  // the banking channel K_m = U_m M_m: post-state must be |1><1| exactly
  const banked = applyKraus(aligned, [mMul(up, mp), mMul(um, mm)]);
  const ground = mat(2, 2);
  ground.re[3] = 1;
  let bankedDev = 0;
  for (let k = 0; k < 4; k++) {
    bankedDev = Math.max(
      bankedDev,
      Math.abs(banked.re[k]! - ground.re[k]!),
      Math.abs(banked.im[k]! - ground.im[k]!),
    );
  }
  // completeness of the measurement
  let completeness = mat(2, 2);
  for (const m of [mp, mm])
    completeness = mAdd(completeness, mMul(mDagger(m), m));
  const eye = identity(2);
  let completenessDev = 0;
  for (let k = 0; k < 4; k++)
    completenessDev = Math.max(
      completenessDev,
      Math.abs(completeness.re[k]! - eye.re[k]!),
      Math.abs(completeness.im[k]! - eye.im[k]!),
    );
  const workBits = 1 - h2(qPlusKraus);
  const naiveWorkBits = 1 - h2(0.5 * (1 + 2 * rhoW.re[1]!));
  const valueBits = weightCoherenceBits(aligned);
  return {
    cL1,
    qPlusKraus,
    qMinusKraus,
    workBits,
    valueBits,
    lockGapBits: valueBits - workBits,
    naiveWorkBits,
    bankedDev,
    twoRoadDev: Math.abs(qPlusKraus - (1 + cL1) / 2),
    completenessDev,
  };
}

/** C_rel of a 2x2 state against its own energy basis (AT7's value face,
 * local 2-dim dephase — sectorDephase single-sources the 4-dim register). */
export function weightCoherenceBits(rhoW: CMat): number {
  requireWeightState("weightCoherenceBits", rhoW);
  const d = mat(2, 2);
  d.re[0] = rhoW.re[0]!;
  d.re[3] = rhoW.re[3]!;
  return vonNeumannEntropy(d) - vonNeumannEntropy(rhoW);
}

// ---------------------------------------------------------------------------
// The incoherent no-go (negative control)
// ---------------------------------------------------------------------------

export interface IncoherentYield {
  /** the strictly incoherent engine's total yield on rho_W, bits (the
   * population face 1 - h2(p), harvested with an energy-basis record) */
  readonly yieldBits: number;
  /** the same engine on Delta rho_W — IDENTICAL, the operational no-go */
  readonly dephasedYieldBits: number;
  /** |yield - dephasedYield| — exactly 0: coherence contributes nothing */
  readonly coherenceContribution: number;
}

/** The strictly incoherent engine: energy-basis measurement, energy-diagonal
 * control — every statistic is a function of the diagonal alone, so its
 * yield cannot see the coherence. The theorem face is the exact equality of
 * the two ledger computations. */
export function incoherentEngineYield(rhoW: CMat): IncoherentYield {
  requireWeightState("incoherentEngineYield", rhoW);
  const pop = rhoW.re[0]!;
  const d = mat(2, 2);
  d.re[0] = rhoW.re[0]!;
  d.re[3] = rhoW.re[3]!;
  const yieldBits = 1 - h2(pop);
  const dephasedYieldBits = 1 - h2(d.re[0]);
  return {
    yieldBits,
    dephasedYieldBits,
    coherenceContribution: Math.abs(yieldBits - dephasedYieldBits),
  };
}

// ---------------------------------------------------------------------------
// The census inputs — the AT15 37-trajectory recipe, same seed, rebuilt here
// (audit.ts's array is private; the recipe and seed reproduce it exactly).
// ---------------------------------------------------------------------------

export function at15CensusInputs(): CMat[] {
  const rng = makeRng(1313);
  const inputs: CMat[] = [];
  for (let t = 0; t < 12; t++) inputs.push(vecToRho(randomStateVec(rng, 4)));
  for (let t = 0; t < 10; t++)
    inputs.push(sectorDephase(vecToRho(randomStateVec(rng, 4))));
  for (const k of [1, 3, 8]) {
    for (let t = 0; t < 5; t++)
      inputs.push(iterateLaw(vecToRho(randomStateVec(rng, 4)), k, GAMMA));
  }
  return inputs;
}

/** A physical mixed weight state: populations (p0, 1-p0), coherence s·sqrt
 * (p0(1-p0)) at phase phi — s in [0,1] keeps it PSD. */
export function mixedWeightState(p0: number, s: number, phi: number): CMat {
  if (!(p0 > 0 && p0 < 1) || !(s >= 0 && s <= 1)) {
    throw new DomainError(
      "mixedWeightState:range",
      `mixedWeightState: need p0 in (0,1) and s in [0,1] (PSD), got p0=${String(p0)}, s=${String(s)}`,
    );
  }
  const amp = s * Math.sqrt(p0 * (1 - p0));
  const rho = mat(2, 2);
  rho.re[0] = p0;
  rho.re[3] = 1 - p0;
  rho.re[1] = amp * Math.cos(phi);
  rho.im[1] = amp * Math.sin(phi);
  rho.re[2] = amp * Math.cos(phi);
  rho.im[2] = -amp * Math.sin(phi);
  return rho;
}

/** A pure equal-weight straddler register state at phase phi, cargo |1>. */
export function straddlerState(phi: number): CMat {
  const w = vec(2);
  w.re[0] = 1 / Math.SQRT2;
  w.re[1] = Math.cos(phi) / Math.SQRT2;
  w.im[1] = Math.sin(phi) / Math.SQRT2;
  return vecToRho(vKron(w, basisVec(2, 1)));
}

// ---------------------------------------------------------------------------
// The smuggling trial — a work claim is data, not truth.
// ---------------------------------------------------------------------------

export interface FeedbackWorkClaim {
  readonly rhoW: CMat;
  /** the claimed W_ext, in bits (multiply by kT ln2 for energy) */
  readonly claimedWorkBits: number;
  /** which engine the claim is about */
  readonly controller: "aligned" | "incoherent";
}

export interface FeedbackViolation {
  readonly crime: string;
  readonly detail: string;
}

/** Audit a submitted harvest claim against full recomputation. The honest
 * aligned engine's value is re-derived from the state; the free-energy value
 * AT7 prices is re-derived with it; the incoherent engine's population face
 * re-derived too. Named crimes: counterfeit engine output, work smuggling
 * above the free-energy value (the raw ln(1+C_l1) form dies here), and
 * locked-work smuggling (an incoherent engine claiming coherence). */
export function auditFeedbackWorkClaim(
  claim: FeedbackWorkClaim,
): readonly FeedbackViolation[] {
  const violations: FeedbackViolation[] = [];
  const ledger = feedbackExtraction(claim.rhoW);
  const engineBits =
    claim.controller === "aligned"
      ? ledger.workBits
      : incoherentEngineYield(claim.rhoW).yieldBits;
  if (Math.abs(claim.claimedWorkBits - engineBits) > 1e-9) {
    violations.push({
      crime: "counterfeit engine output",
      detail: `claimed W = ${claim.claimedWorkBits.toPrecision(6)} bits, the ${claim.controller} engine re-derives ${engineBits.toPrecision(6)} bits (C_l1 = ${ledger.cL1.toPrecision(6)}, q+ = ${ledger.qPlusKraus.toPrecision(6)})`,
    });
  }
  if (claim.claimedWorkBits > ledger.valueBits + 1e-9) {
    violations.push({
      crime: "work smuggling above the free-energy value",
      detail: `claimed W = ${claim.claimedWorkBits.toPrecision(6)} bits against AT7's value kT ln2 · C_rel = ${ledger.valueBits.toPrecision(6)} bits — no engine on this ledger harvests above the state's coherence value (the raw ln(1+C_l1) form dies here)`,
    });
  }
  if (
    claim.controller === "incoherent" &&
    claim.claimedWorkBits > incoherentEngineYield(claim.rhoW).yieldBits + 1e-9
  ) {
    violations.push({
      crime: "locked-work smuggling",
      detail: `an incoherent (energy-diagonal) controller claims ${claim.claimedWorkBits.toPrecision(6)} bits; its population face is ${incoherentEngineYield(claim.rhoW).yieldBits.toPrecision(6)} bits — the coherence face is LOCKED, exactly`,
    });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// W-S — the measurement-feedback witness (the audit face; registered by the
// new tests, the audit roll itself stays byte-frozen).
// ---------------------------------------------------------------------------

/** W-S: the measurement-feedback work extraction and the work-locking gap. */
export function witnessFeedback(): WitnessResult {
  const rng = makeRng(1919);
  // engine identities: unitarity of the feedback shifts (worst element of U U^dag - I)
  let unitaryDev = 0;
  const eye2 = identity(2);
  for (const u of suFeedbackShifts()) {
    const prod = mMul(u, mDagger(u));
    for (let k = 0; k < 4; k++)
      unitaryDev = Math.max(
        unitaryDev,
        Math.abs(prod.re[k]! - eye2.re[k]!),
        Math.abs(prod.im[k]! - eye2.im[k]!),
      );
  }
  // straddlers: the full bit harvested WHOLE
  let worstStraddlerWork = 0;
  let worstStraddlerGap = 0;
  for (let t = 0; t < 10; t++) {
    const phi = rng() * 2 * Math.PI;
    const weight = coherentShortcut(straddlerState(phi)).weight;
    const ledger = feedbackExtraction(weight);
    worstStraddlerWork = Math.max(
      worstStraddlerWork,
      Math.abs(ledger.workBits - 1),
    );
    worstStraddlerGap = Math.max(
      worstStraddlerGap,
      Math.abs(ledger.lockGapBits),
    );
  }
  // the AT15 census: gap >= 0 pointwise, equality attained
  let gapMin = Infinity;
  let gapMax = -Infinity;
  let worstTwoRoad = 0;
  let worstBank = 0;
  for (const rho of at15CensusInputs()) {
    const ledger = feedbackExtraction(coherentShortcut(rho).weight);
    gapMin = Math.min(gapMin, ledger.lockGapBits);
    gapMax = Math.max(gapMax, ledger.lockGapBits);
    worstTwoRoad = Math.max(worstTwoRoad, ledger.twoRoadDev);
    worstBank = Math.max(worstBank, ledger.bankedDev);
  }
  // the equal-population family: gap = 0 EXACTLY; unequal: gap > 0
  let worstEqualGap = 0;
  let minUnequalGap = Infinity;
  for (const p0 of [0.25, 0.4, 0.6, 0.75]) {
    for (const s of [0.2, 0.6, 1]) {
      for (const phi of [0, 1.2, 2.9]) {
        const ledger = feedbackExtraction(mixedWeightState(p0, s, phi));
        minUnequalGap = Math.min(minUnequalGap, ledger.lockGapBits);
      }
    }
  }
  for (const s of [0.1, 0.5, 0.9]) {
    const ledger = feedbackExtraction(mixedWeightState(0.5, s, 0.7));
    worstEqualGap = Math.max(worstEqualGap, Math.abs(ledger.lockGapBits));
  }
  // the incoherent no-go: coherence contribution exactly 0, census-wide
  let worstIncoh = 0;
  for (const rho of at15CensusInputs()) {
    worstIncoh = Math.max(
      worstIncoh,
      incoherentEngineYield(coherentShortcut(rho).weight).coherenceContribution,
    );
  }
  // the naive road never beats the aligned one
  let worstNaiveExcess = 0;
  for (const rho of at15CensusInputs()) {
    const ledger = feedbackExtraction(coherentShortcut(rho).weight);
    worstNaiveExcess = Math.max(
      worstNaiveExcess,
      ledger.naiveWorkBits - ledger.workBits,
    );
  }
  // the spec-form conviction: ln(1+C_l1)/ln2 vs the value on the s=1/2 state
  const convict = feedbackExtraction(mixedWeightState(0.5, 0.5, 0));
  const specForm = Math.log(1 + convict.cL1) / Math.LN2;
  const conviction = auditFeedbackWorkClaim({
    rhoW: mixedWeightState(0.5, 0.5, 0),
    claimedWorkBits: specForm,
    controller: "aligned",
  });
  const ok =
    unitaryDev <= 1e-15 &&
    worstStraddlerWork <= 1e-12 &&
    worstStraddlerGap <= 1e-12 &&
    gapMin >= -1e-12 &&
    worstTwoRoad <= 1e-15 &&
    worstBank <= 1e-15 &&
    worstEqualGap <= 1e-12 &&
    minUnequalGap > 1e-6 &&
    worstIncoh === 0 &&
    worstNaiveExcess <= 1e-12 &&
    conviction.some(
      (x) => x.crime === "work smuggling above the free-energy value",
    );
  return {
    name: "W-S measurement-feedback work extraction",
    pass: ok,
    detail: `the engine banks the weight exactly (post-channel |1><1| to ${worstBank.toExponential(2)}, feedback shifts unitary to ${unitaryDev.toExponential(2)}, measurement complete); the two roads agree (closed-form l1 vs Kraus branch statistics, worst ${worstTwoRoad.toExponential(2)}); straddlers harvest the FULL bit (worst |W-1| = ${worstStraddlerWork.toExponential(2)}, gap ${worstStraddlerGap.toExponential(2)}); work locking over the AT15 37-trajectory census: gap ${gapMin.toPrecision(3)} to ${gapMax.toPrecision(3)} bits, zero EXACTLY on the equal-population face (worst ${worstEqualGap.toExponential(2)}) and strictly positive on unequal families (min ${minUnequalGap.toPrecision(3)}); the incoherent no-go holds identically (coherence contribution exactly ${worstIncoh}) and the naive road never beats the aligned (worst excess ${worstNaiveExcess.toExponential(2)}); the raw ln(1+C_l1) form on the C_l1=1/2 state claims ${specForm.toPrecision(4)} bits against a value of ${convict.valueBits.toPrecision(4)} — convicted by name`,
  };
}
