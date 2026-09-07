/**
 * The checker — the board laws, and the witnesses that re-derive every EXACT
 * number from the matrices themselves.
 *
 * Laws enforced:
 *   SW1. every row names its dynamics (law / engineered / perturbed / tariff
 *        / escape) — a stability claim without its dynamics is marketing;
 *   SW2. the exactness tag is EXACT, DATA or QUOTED, and every row cites a
 *        witness that exists — unwitnessed exactness is hearsay;
 *   SW3. a QUOTED row must anchor the repo that verified the schedule it
 *        quotes (route-price holds the kT·ln2 book) — a quoted rate names
 *        its central bank;
 *   SW4. anchor repos exist on disk;
 *   SW5. ids unique;
 *   SW6. a row with dynamics "tariff" anchors route-price whatever its tag —
 *        the tax man names his central bank, EXACT rows included.
 *
 * Witnesses:
 *   W-A the law itself (CPTP, quiet-on-world, sector update, coherence decay);
 *   W-B global attraction (leakage closed form, diagonal-block collapse,
 *       path-dependence of contents);
 *   W-C the charge as Lyapunov function (increment identity + conservation
 *       under engineered programs, with a real random-program violation);
 *   W-D the perturbation census (attractor survives law-error, bounded);
 *   W-E the tariff arithmetic (h2 anchors + quoted schedule constants);
 *   W-F the escape ledger (monotonicity + two-rate chain closed form);
 *   W-G the coherent face priced (incoherence of the law, C_rel arithmetic,
 *       free-energy engine, monotone erasure census, the 2x rate);
 *   W-H the thermal reading shipped (detailed-balance identity, escape
 *       readings, design rule, exact-SI physical anchors);
 *   W-I the microscopic bath (collision model: detailed balance emerges,
 *       populations = the two-rate chain, stationarity = Gibbs x cargo,
 *       the law IS the T=0 collision, coherence factor temperature-free);
 *   W-J the coherent shortcut (one-step collapse, full-basis coherence
 *       conserved exactly, the weight ledger, the straddler's banked bit);
 *   W-K the continuum limit executed (finite-coupling exactness, the block
 *       closed form, the composition scaling, the Davies rate restored);
 *   W-L the audit ledger (three-term decomposition, the exact reversal,
 *       the straddler tightness, the banked-fraction census);
 *   W-M the generator's Lindblad form (the extraction converges to the
 *       Lindblad operator with the Davies rates, uniformly over states);
 *   W-N the phase-alignment bank (the l1-optimal one-shot incoherent
 *       banking, the boost census, the residual correlation gap).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CMat, basisVec, identity, kron, mAdd, mScale, mat, matEq, mDagger, mMul, vAdd, vKron, vScale, vec } from "../core/cmat.js";
import { applyUnitary } from "../core/channels.js";
import { makeRng, type Rng } from "../core/rng.js";
import { maximallyMixed, randomStateVec, vecToRho } from "../core/states.js";
import { traceDistance, traceReal, vonNeumannEntropy } from "../core/measures.js";
import { BOARD, type BoardRow, type Dynamics } from "./board.js";
import {
  GAMMA,
  H_PLANCK,
  K_B,
  applyCollision,
  applyLaw,
  applyPerturbed,
  authoredHamiltonian,
  bathGibbs,
  betaGapOfFrequency,
  boltzmannOccupancy,
  coherenceBits,
  coherenceDecayRate,
  coherentShortcut,
  collisionBlockMixing,
  collapseIntoWorld,
  collisionRates,
  columnBasisSupport,
  diagonalExpectation,
  escapeAtHorizon,
  escapeDesignRuleBeta,
  alignedBank,
  exchangeUnitary,
  extractedGenerator,
  lindbladRhs,
  h2,
  inWorldState,
  iterateLaw,
  lawKraus,
  leakage,
  membershipCharge,
  outOfWorldState,
  populationDecayRate,
  perturbedLeakageBound,
  randomBranchUnitary,
  randomCptpKraus,
  randomUnitary,
  sectorCoherence,
  sectorDephase,
  stationaryInWorld,
  thermalUpRate,
  totalCoherenceBits,
  twoRateInWorld,
  twoRateRecursion,
} from "./law.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-G", "W-H", "W-I", "W-J", "W-K", "W-L", "W-M", "W-N"];
const LEGAL_DYNAMICS: readonly Dynamics[] = ["law", "engineered", "perturbed", "tariff", "escape"];

/**
 * A BoardRow as it crosses the untrusted boundary into the checker: the
 * compile-time `Exactness` union proves nothing at runtime (rows can arrive
 * parsed or mutated), so the tag is an unvalidated string until SW2 has run.
 * `BoardRow` remains assignable (Exactness ⊂ string).
 */
export type UntrustedBoardRow = Omit<BoardRow, "exactness"> & { readonly exactness: string };

export function checkBoard(rows: readonly UntrustedBoardRow[] = BOARD): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "SW5", detail: "duplicate board row id" });
    seen.add(r.id);
    if (!(LEGAL_DYNAMICS as readonly string[]).includes(r.dynamics)) {
      violations.push({
        row: r.id,
        law: "SW1",
        detail: `unnamed dynamics "${String(r.dynamics)}" — a stability claim without its dynamics is marketing`,
      });
    }
    if (r.exactness !== "EXACT" && r.exactness !== "DATA" && r.exactness !== "QUOTED") {
      violations.push({ row: r.id, law: "SW2", detail: `illegal tag "${r.exactness}"` });
    }
    if (!WITNESS_IDS.includes(r.witness)) {
      violations.push({ row: r.id, law: "SW2", detail: `cites unknown witness "${r.witness}" — unwitnessed exactness is hearsay` });
    }
    if (r.exactness === "QUOTED" && !r.anchors.includes("route-price")) {
      violations.push({ row: r.id, law: "SW3", detail: "quotes a rate without anchoring the schedule's repo (route-price)" });
    }
    if (r.dynamics === "tariff" && !r.anchors.includes("route-price")) {
      violations.push({
        row: r.id,
        law: "SW6",
        detail: "a tariff row without its central bank — dynamics 'tariff' anchors route-price whatever the tag",
      });
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        violations.push({ row: r.id, law: "SW4", detail: `anchor repo missing on disk: ${a}` });
      }
    }
  }
  return violations;
}

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** A random cargo state (2x2 density matrix). */
function randomCargo(rng: Rng): CMat {
  return vecToRho(randomStateVec(rng, 2));
}

/** A random state with sector coherence: ((|0> + e^{i phi}|1>)/sqrt2) ⊗ cargo. */
function sectorCoherentState(rng: Rng): CMat {
  const phi = rng() * 2 * Math.PI;
  const w = vec(2);
  w.re[0] = 1 / Math.SQRT2;
  w.re[1] = Math.cos(phi) / Math.SQRT2;
  w.im[1] = Math.sin(phi) / Math.SQRT2;
  return vecToRho(vKron(w, randomStateVec(rng, 2)));
}

/** W-A: the law itself — CPTP, quiet on the world, exact sector book. */
function witnessLaw(): WitnessResult {
  const rng = makeRng(1101);
  // CPTP: Kraus completeness and trace preservation
  const kraus = lawKraus(GAMMA);
  let completeness = mat(4, 4);
  for (const k of kraus) completeness = mAdd(completeness, mMul(mDagger(k), k));
  const completeOk = matEq(completeness, identity(4), 1e-14);
  let worstTrace = 0;
  // quiet on the world: Phi(rho) = rho for every in-world state
  let worstQuiet = 0;
  for (let t = 0; t < 24; t++) {
    const rho = inWorldState(randomCargo(rng));
    const out = applyLaw(rho, GAMMA);
    worstTrace = Math.max(worstTrace, Math.abs(traceReal(out) - 1));
    // k < out.re.length bounds the read; out = applyLaw(rho) keeps rho's 4x4 shape
    for (let k = 0; k < out.re.length; k++) {
      worstQuiet = Math.max(worstQuiet, Math.abs(out.re[k]! - rho.re[k]!), Math.abs(out.im[k]! - rho.im[k]!));
    }
  }
  // sector update p' = p + γ(1−p) for arbitrary states
  let worstUpdate = 0;
  for (let t = 0; t < 60; t++) {
    const rho = vecToRho(randomStateVec(rng, 4));
    const p = membershipCharge(rho);
    const p1 = membershipCharge(applyLaw(rho, GAMMA));
    worstUpdate = Math.max(worstUpdate, Math.abs(p1 - (p + GAMMA * (1 - p))));
  }
  // coherence decay: c(k) = (1−γ)^{k/2} c(0), phase preserved
  let worstCoh = 0;
  for (let t = 0; t < 12; t++) {
    const rho = sectorCoherentState(rng);
    const c0 = sectorCoherence(rho);
    for (const k of [1, 3, 7, 15]) {
      const ck = sectorCoherence(iterateLaw(rho, k, GAMMA));
      const f = Math.pow(1 - GAMMA, k / 2);
      worstCoh = Math.max(worstCoh, Math.abs(ck.re - f * c0.re), Math.abs(ck.im - f * c0.im));
    }
  }
  const ok = completeOk && worstTrace <= 1e-14 && worstQuiet <= 1.5e-15 && worstUpdate <= 1e-15 && worstCoh <= 1e-14;
  return {
    name: "W-A the law",
    pass: ok,
    detail: `Kraus completeness exact; trace drift ${worstTrace.toExponential(2)}; quiet-on-world deviation ${worstQuiet.toExponential(2)}; sector-update identity ${worstUpdate.toExponential(2)}; coherence decay ${worstCoh.toExponential(2)}`,
  };
}

/** W-B: global attraction + path-dependence of contents. */
function witnessAttraction(): WitnessResult {
  const rng = makeRng(2202);
  const starts: CMat[] = [maximallyMixed(4), inWorldState(maximallyMixed(2)), outOfWorldState(maximallyMixed(2))];
  for (let t = 0; t < 20; t++) {
    starts.push(vecToRho(randomStateVec(rng, 4)));
    starts.push(sectorCoherentState(rng));
    starts.push(inWorldState(randomCargo(rng)));
    starts.push(outOfWorldState(randomCargo(rng)));
  }
  let worstLeak = 0;
  for (const rho of starts) {
    const p0 = membershipCharge(rho);
    for (const k of [1, 5, 20, 60]) {
      const leak = leakage(iterateLaw(rho, k, GAMMA));
      worstLeak = Math.max(worstLeak, Math.abs(leak - Math.pow(1 - GAMMA, k) * (1 - p0)));
    }
  }
  // collapse into the world at k=200: contents = the two diagonal blocks summed
  let worstCollapse = 0;
  for (let t = 0; t < 16; t++) {
    const rho = vecToRho(randomStateVec(rng, 4));
    worstCollapse = Math.max(worstCollapse, traceDistance(iterateLaw(rho, 200, GAMMA), collapseIntoWorld(rho)));
  }
  // path-dependence: same diagonal blocks -> same world; different cargo -> different world
  const coherent = sectorCoherentState(rng);
  const sameBlocks = collapseIntoWorld(coherent); // the dephased twin has the same diagonal blocks
  const sameContents = traceDistance(iterateLaw(coherent, 200, GAMMA), iterateLaw(sameBlocks, 200, GAMMA));
  const diffContents = traceDistance(
    iterateLaw(inWorldState(vecToRho(basisVec(2, 0))), 200, GAMMA),
    iterateLaw(inWorldState(vecToRho(basisVec(2, 1))), 200, GAMMA),
  );
  const ok = worstLeak <= 1e-14 && worstCollapse <= 1e-12 && sameContents <= 1e-12 && diffContents > 0.3;
  return {
    name: "W-B global attraction",
    pass: ok,
    detail: `leakage identity ${worstLeak.toExponential(2)} over ${starts.length} starts; k=200 collapse ${worstCollapse.toExponential(2)}; same-blocks tails equal (${sameContents.toExponential(2)}), different-cargo tails apart (${diffContents.toFixed(3)}) — the law selects the world, not the contents`,
  };
}

/** W-C: the charge as Lyapunov function; conservation under engineered programs. */
function witnessLyapunov(): WitnessResult {
  const rng = makeRng(3303);
  // the increment identity, and strictness off the world
  let worstInc = 0;
  let strictOk = true;
  let checked = 0;
  for (let t = 0; t < 200; t++) {
    const rho = t % 2 === 0 ? vecToRho(randomStateVec(rng, 4)) : sectorCoherentState(rng);
    const v = membershipCharge(rho);
    const dv = membershipCharge(applyLaw(rho, GAMMA)) - v;
    worstInc = Math.max(worstInc, Math.abs(dv - GAMMA * (1 - v)));
    if (1 - v > 1e-12) {
      checked++;
      if (dv <= 1e-14) strictOk = false;
    }
  }
  // conservation under engineered branch programs
  let worstConserved = 0;
  for (let t = 0; t < 40; t++) {
    const u = randomBranchUnitary(rng);
    const inputs = [inWorldState(randomCargo(rng)), outOfWorldState(randomCargo(rng)), vecToRho(randomStateVec(rng, 4)), maximallyMixed(4)];
    for (const rho of inputs) {
      const before = membershipCharge(rho);
      const after = membershipCharge(applyUnitary(rho, u));
      worstConserved = Math.max(worstConserved, Math.abs(after - before));
    }
  }
  // and the violation is REAL: generic unitaries move the charge
  let moved = 0;
  for (let t = 0; t < 20; t++) {
    const u = randomUnitary(rng, 4);
    const rho = vecToRho(randomStateVec(rng, 4));
    moved = Math.max(moved, Math.abs(membershipCharge(applyUnitary(rho, u)) - membershipCharge(rho)));
  }
  const ok = worstInc <= 1.5e-15 && strictOk && checked > 50 && worstConserved <= 1.5e-15 && moved > 0.3;
  return {
    name: "W-C Lyapunov certificate",
    pass: ok,
    detail: `increment identity ${worstInc.toExponential(2)} over 200 states, strict off-world (${checked} checked); engineered conservation drift ${worstConserved.toExponential(2)} over 40 programs x 4 inputs; random unitaries move the charge by up to ${moved.toFixed(3)} (the split is real)`,
  };
}

/** W-D: the perturbation census — the attractor survives law-error. */
function witnessPerturbation(): WitnessResult {
  const rng = makeRng(4404);
  const grid = [0.002, 0.01, 0.05, 0.1];
  const lines: string[] = [];
  let ok = true;
  for (const eps of grid) {
    let worst = 0;
    for (let t = 0; t < 24; t++) {
      const nKraus = randomCptpKraus(rng, 4, 2);
      const starts = [outOfWorldState(vecToRho(randomStateVec(rng, 2))), maximallyMixed(4), vecToRho(randomStateVec(rng, 4))];
      for (const rho0 of starts) {
        let cur = rho0;
        for (let k = 0; k < 500; k++) cur = applyPerturbed(cur, nKraus, eps, GAMMA);
        worst = Math.max(worst, leakage(cur));
      }
    }
    const bound = perturbedLeakageBound(eps, GAMMA);
    if (worst > bound + 1e-12) ok = false;
    lines.push(`eps=${eps}: worst asymptotic leakage ${worst.toFixed(6)} <= bound ${bound.toFixed(6)}`);
  }
  return { name: "W-D perturbation census", pass: ok, detail: lines.join("; ") };
}

/** W-E: the tariff arithmetic on the quoted schedule. */
function witnessTariff(): WitnessResult {
  const okParts: boolean[] = [];
  // h2 anchors, two routes
  okParts.push(Math.abs(h2(0.5) - 1) <= 1e-15);
  okParts.push(Math.abs(h2(0.025) - 0.168660931) <= 1e-9);
  let worstDual = 0;
  for (let i = 1; i <= 99; i++) {
    const q = i / 100;
    const lnRoute = (-q * Math.log(q) - (1 - q) * Math.log(1 - q)) / Math.LN2;
    worstDual = Math.max(worstDual, Math.abs(h2(q) - lnRoute));
  }
  okParts.push(worstDual <= 1e-12);
  // the quoted schedule (route-price D1-P1): kT ln2 per bit at two temperatures
  const E300 = 2.87098e-21;
  const E10mK = 9.56993e-26;
  const ratio = E300 / E10mK;
  okParts.push(Math.abs(ratio / 30000 - 1) <= 1e-3);
  const rows: string[] = [];
  for (const q of [0.1, 0.25, 0.5, 0.75]) {
    const bits = h2(q);
    rows.push(`q̄=${q}: ${bits.toFixed(6)} bits -> ${(bits * E300).toExponential(4)} J @300K, ${(bits * E10mK).toExponential(4)} J @10mK`);
  }
  const ok = okParts.every(Boolean);
  return {
    name: "W-E stabilization tariff",
    pass: ok,
    detail: `h2 anchors exact (0.168660931 @0.025 matches the depreciation ledger's W-E); dual-route deviation ${worstDual.toExponential(2)}; schedule ratio ${ratio.toFixed(1)} (temperature ratio 30000 within quoted rounding); ${rows.join("; ")}`,
  };
}

/** W-F: the escape ledger — monotone charge, exact two-rate chain. */
function witnessEscape(): WitnessResult {
  const rng = makeRng(5505);
  // quantum monotonicity
  let worstDrop = 0;
  let onWorldDelta: number;
  for (let t = 0; t < 200; t++) {
    const rho = vecToRho(randomStateVec(rng, 4));
    let cur = rho;
    for (let k = 0; k < 10; k++) {
      const pBefore = membershipCharge(cur);
      cur = applyLaw(cur, GAMMA);
      worstDrop = Math.min(worstDrop, membershipCharge(cur) - pBefore);
    }
  }
  {
    let cur = inWorldState(maximallyMixed(2));
    const pBefore = membershipCharge(cur);
    cur = applyLaw(cur, GAMMA);
    onWorldDelta = membershipCharge(cur) - pBefore;
  }
  // two-rate chain: recursion vs closed form vs union bound
  let worstClosed = 0;
  let boundOk = true;
  for (const r of [0.01, 0.05, 0.2, 0.5]) {
    for (const k of [1, 2, 5, 10, 40, 200]) {
      const closed = twoRateInWorld(k, r, GAMMA);
      worstClosed = Math.max(worstClosed, Math.abs(closed - twoRateRecursion(k, r, GAMMA)));
      if (1 - closed > k * r + 1e-12) boundOk = false;
    }
  }
  // MC census of the SAME event (out-of-world at step K), full chain with return
  const r = 0.01;
  const K = 40;
  const exact = 1 - twoRateInWorld(K, r, GAMMA);
  let escaped = 0;
  const N = 200000;
  for (let t = 0; t < N; t++) {
    let inWorld = true;
    for (let k = 0; k < K; k++) inWorld = inWorld ? rng() >= r : rng() < GAMMA;
    if (!inWorld) escaped++;
  }
  const mc = escaped / N;
  const sigma = Math.sqrt((exact * (1 - exact)) / N);
  const mcOk = Math.abs(mc - exact) <= 5 * sigma;
  const ok = worstDrop >= -1.5e-15 && Math.abs(onWorldDelta) <= 1e-15 && worstClosed <= 1e-13 && boundOk && mcOk;
  return {
    name: "W-F escape ledger",
    pass: ok,
    detail: `worst charge drop ${worstDrop.toExponential(2)} (monotone), on-world delta ${onWorldDelta.toExponential(2)} (exactly 0); two-rate closed form ${worstClosed.toExponential(2)} vs recursion, union bound holds; MC out-of-world at step K ${mc.toFixed(6)} vs exact ${exact.toFixed(6)} at ${(Math.abs(mc - exact) / sigma).toFixed(2)}σ`,
  };
}

/** W-G: the coherent face priced — incoherence, C_rel arithmetic, the
 * free-energy engine, the monotone erasure census, the 2x rate. */
function witnessCoherentTariff(): WitnessResult {
  const rng = makeRng(6606);
  // the law is an incoherent operation in the sector basis; random unitaries are not
  let lawSupport = 0;
  for (const g of [0.1, GAMMA, 0.6]) for (const k of lawKraus(g)) lawSupport = Math.max(lawSupport, columnBasisSupport(k));
  let unitarySupport = 0;
  for (let t = 0; t < 10; t++) unitarySupport = Math.max(unitarySupport, columnBasisSupport(randomUnitary(rng, 4)));
  // pure equal-weight straddlers pay the full bit, whatever the cargo and phase
  let worstFull = 0;
  for (let t = 0; t < 24; t++) {
    const rho = sectorCoherentState(rng); // (|0> + e^{i phi}|1>)/sqrt2 (x) cargo
    worstFull = Math.max(worstFull, Math.abs(coherenceBits(rho) - 1));
  }
  // pure unequal-weight straddlers pay h2(|alpha|^2) exactly — the two faces meet on pure inputs
  let worstH2 = 0;
  for (const a2 of [0.05, 0.25, 0.5, 0.8]) {
    for (let t = 0; t < 8; t++) {
      const psi = vAdd(
        vScale(vKron(basisVec(2, 0), randomStateVec(rng, 2)), Math.sqrt(a2)),
        vScale(vKron(basisVec(2, 1), randomStateVec(rng, 2)), Math.sqrt(1 - a2)),
      );
      worstH2 = Math.max(worstH2, Math.abs(coherenceBits(vecToRho(psi)) - h2(a2)));
    }
  }
  // sector-diagonal states pay 0 exactly
  let worstDiag = 0;
  for (let t = 0; t < 20; t++) {
    const rho = sectorDephase(vecToRho(randomStateVec(rng, 4)));
    worstDiag = Math.max(worstDiag, Math.abs(coherenceBits(rho)));
  }
  // the free-energy engine: dephasing preserves <H> for the authored diagonal Hamiltonian
  let worstHam = 0;
  const h = authoredHamiltonian(3.7);
  for (let t = 0; t < 40; t++) {
    const rho = vecToRho(randomStateVec(rng, 4));
    worstHam = Math.max(worstHam, Math.abs(diagonalExpectation(sectorDephase(rho), h) - diagonalExpectation(rho, h)));
  }
  // monotone erasure along trajectories; complete at the k=200 collapse
  let worstRise = 0;
  let worstGone = 0;
  for (let t = 0; t < 40; t++) {
    const rho0 = vecToRho(randomStateVec(rng, 4));
    let prev = coherenceBits(rho0);
    let cur = rho0;
    for (let k = 0; k < 30; k++) {
      cur = applyLaw(cur, GAMMA);
      const now = coherenceBits(cur);
      worstRise = Math.max(worstRise, now - prev);
      prev = now;
    }
    worstGone = Math.max(worstGone, Math.abs(coherenceBits(iterateLaw(rho0, 200, GAMMA))));
  }
  // the coherent face settles exactly twice as fast as the classical face
  const ratio = populationDecayRate(GAMMA) / coherenceDecayRate(GAMMA);
  const ok =
    lawSupport <= 1 &&
    unitarySupport >= 3 &&
    worstFull <= 1e-12 &&
    worstH2 <= 1e-12 &&
    worstDiag <= 1e-15 &&
    worstHam <= 1e-15 &&
    worstRise <= 1e-12 &&
    worstGone <= 1e-12 &&
    Math.abs(ratio - 2) <= 1e-15;
  return {
    name: "W-G coherent tariff",
    pass: ok,
    detail: `law Kraus max column support ${lawSupport} vs random unitaries ${unitarySupport} (the probe separates); pure straddler C_rel = 1 to ${worstFull.toExponential(2)}, unequal-weight C_rel = h2(|alpha|^2) to ${worstH2.toExponential(2)}, sector-diagonal 0 to ${worstDiag.toExponential(2)}; dephasing preserves <H> to ${worstHam.toExponential(2)} (the F-identity engine: F(rho)-F(Delta rho) = kT ln2 * C_rel); erasure monotone (worst rise ${worstRise.toExponential(2)}) and complete at k=200 (${worstGone.toExponential(2)}); coherent/classical decay-rate ratio ${ratio.toFixed(15)} (exactly 2)`,
  };
}

/** W-H: the thermal reading shipped — detailed balance, escape readings,
 * the design rule, exact-SI physical anchors. */
function witnessThermalReading(): WitnessResult {
  // detailed balance: gamma/(gamma + gamma e^{-beta dE}) = 1/(1+e^{-beta dE}) exactly
  let worstDB = 0;
  for (const beta of [0, 1, 2, 5, 10, 20, 40]) {
    for (const g of [0.1, GAMMA, 0.6]) {
      worstDB = Math.max(worstDB, Math.abs(stationaryInWorld(thermalUpRate(beta, g), g) - boltzmannOccupancy(beta)));
    }
  }
  // readings: escape at horizons over the beta-dE grid, under the union bound
  const horizons = [1e2, 1e4, 1e6];
  const grid = [5, 10, 20, 40].map((beta) => {
    const r = thermalUpRate(beta, GAMMA);
    return { beta, r, escapes: horizons.map((K) => escapeAtHorizon(K, r, GAMMA)) };
  });
  let boundOk = true;
  for (const row of grid) {
    for (let i = 0; i < horizons.length; i++) {
      if (row.escapes[i]! > horizons[i]! * row.r * (1 + 1e-12)) boundOk = false;
    }
  }
  const readings = grid.map(
    (row) =>
      `beta-dE=${row.beta}: w*=${boltzmannOccupancy(row.beta).toFixed(12)}, escape ${row.escapes
        .map((esc, i) => `${esc.toExponential(3)} @K=${horizons[i]!.toExponential(0)}`)
        .join(", ")}`,
  );
  // the design rule: beta dE >= ln(K gamma/delta) holds escape <= delta
  let worstRule = 0;
  for (const [K, delta] of [
    [1e2, 1e-6],
    [1e4, 1e-9],
    [1e6, 1e-9],
  ] as const) {
    const betaMin = escapeDesignRuleBeta(K, delta, GAMMA);
    worstRule = Math.max(worstRule, escapeAtHorizon(K, thermalUpRate(betaMin, GAMMA), GAMMA) - delta);
  }
  // physical anchors: exact SI arithmetic (k and h are exact by definition)
  const gap = H_PLANCK * 5e9;
  const anchors = [0.01, 0.1, 1, 300].map((T) => {
    const beta = betaGapOfFrequency(5e9, T);
    const wStar = boltzmannOccupancy(beta);
    return `T=${T} K: kT=${(K_B * T).toExponential(6)} J, beta-dE=${beta.toFixed(4)}, w*=${wStar.toFixed(12)} (escape-share ${(1 - wStar).toExponential(4)})`;
  });
  const ok = worstDB <= 1e-15 && boundOk && worstRule <= 1e-15 && Math.abs(boltzmannOccupancy(0) - 0.5) <= 1e-16;
  return {
    name: "W-H thermal reading",
    pass: ok,
    detail: `detailed-balance identity exact to ${worstDB.toExponential(2)} (w* = 1/(1+e^{-beta-dE})); union-bound readings: ${readings.join("; ")}; design rule holds escape <= delta at beta-dE = ln(K gamma/delta) (worst excess ${worstRule.toExponential(2)}; e.g. K=1e6, gamma=0.25, delta=1e-9 needs beta-dE >= ${escapeDesignRuleBeta(1e6, 1e-9, GAMMA).toFixed(1)}); 5 GHz anchors (h = ${H_PLANCK.toExponential(6)}, k = ${K_B.toExponential(6)}, gap = ${gap.toExponential(6)} J): ${anchors.join("; ")}`,
  };
}

/** W-I: the microscopic bath — the collision model. Detailed balance is no
 * longer authored: it emerges, exactly, for every angle and temperature. */
function witnessCollisionBath(): WitnessResult {
  const rng = makeRng(7707);
  // unitary + energy conservation: [U, H_S x I + I x H_B] = 0 exactly
  const u = exchangeUnitary(0.7);
  let commNorm = 0;
  {
    const dE = 3.3;
    const hS = mat(4, 4);
    hS.re[0] = dE;
    hS.re[5] = dE;
    const hB = mat(2, 2);
    hB.re[0] = dE;
    const hTot = mAdd(kron(hS, identity(2)), kron(identity(4), hB));
    const comm = mAdd(mMul(hTot, u), mScale(mMul(u, hTot), -1));
    for (let i = 0; i < 64; i++) commNorm = Math.max(commNorm, Math.abs(comm.re[i]!), Math.abs(comm.im[i]!));
  }
  // detailed balance emerges: r~/g~ = e^{-beta dE} exactly; populations = the two-rate chain per collision
  let worstRatio = 0;
  let worstPop = 0;
  for (const beta of [0, 1, 3, 10, 30]) {
    for (const th of [0.3, Math.asin(Math.sqrt(GAMMA)), 1.0, Math.PI / 2]) {
      const rates = collisionRates(th, beta);
      worstRatio = Math.max(worstRatio, Math.abs(rates.outOf / rates.into - Math.exp(-beta)));
      for (let t = 0; t < 10; t++) {
        const rho = vecToRho(randomStateVec(rng, 4));
        const p = membershipCharge(rho);
        const pAfter = membershipCharge(applyCollision(rho, th, beta));
        worstPop = Math.max(worstPop, Math.abs(pAfter - (p * (1 - rates.outOf) + (1 - p) * rates.into)));
      }
    }
  }
  // stationarity: the register thermalizes to Gibbs-world x cargo (diagonal starts)
  let worstStat = 0;
  let worstGibbs = 0;
  for (const beta of [1, 3, 10]) {
    const th = Math.asin(Math.sqrt(GAMMA));
    for (let t = 0; t < 8; t++) {
      const cargo = vecToRho(randomStateVec(rng, 2));
      const comp = mat(2, 2);
      comp.re[0] = 1;
      let rho = kron(comp, cargo);
      for (let k = 0; k < 400; k++) rho = applyCollision(rho, th, beta);
      worstStat = Math.max(worstStat, Math.abs(membershipCharge(rho) - boltzmannOccupancy(beta)));
      const gibbs = bathGibbs(beta); // same Gibbs form on the world bit (|1> ground-majority)
      worstGibbs = Math.max(worstGibbs, traceDistance(rho, kron(gibbs, cargo)));
    }
  }
  // the law IS the T=0 collision: deviation decays as e^{-beta dE}
  const th = Math.asin(Math.sqrt(GAMMA));
  let dev30 = 0;
  let dev40 = 0;
  for (let t = 0; t < 12; t++) {
    const rho = vecToRho(randomStateVec(rng, 4));
    dev30 = Math.max(dev30, traceDistance(applyCollision(rho, th, 30), applyLaw(rho, GAMMA)));
    dev40 = Math.max(dev40, traceDistance(applyCollision(rho, th, 40), applyLaw(rho, GAMMA)));
  }
  // the coherence factor is temperature-FREE: sector coherence decays at cos(theta)
  let worstCoh = 0;
  for (const beta of [0, 1, 3, 10, 30]) {
    for (const angle of [0.4, 0.9]) {
      const phi = rng() * 2 * Math.PI;
      const w = vec(2);
      w.re[0] = 1 / Math.SQRT2;
      w.re[1] = Math.cos(phi) / Math.SQRT2;
      w.im[1] = Math.sin(phi) / Math.SQRT2;
      const rho = vecToRho(vKron(w, randomStateVec(rng, 2)));
      const c0 = sectorCoherence(rho);
      const c1 = sectorCoherence(applyCollision(rho, angle, beta));
      const f = Math.hypot(c1.re, c1.im) / Math.hypot(c0.re, c0.im);
      worstCoh = Math.max(worstCoh, Math.abs(f - Math.cos(angle)));
    }
  }
  const ok =
    commNorm <= 1e-15 &&
    worstRatio <= 1e-15 &&
    worstPop <= 1e-15 &&
    worstStat <= 1e-12 &&
    worstGibbs <= 1e-12 &&
    dev30 <= 1e-13 &&
    dev40 <= dev30 / 100 &&
    worstCoh <= 1e-14;
  return {
    name: "W-I microscopic bath",
    pass: ok,
    detail: `[U, H_tot] = 0 exactly (${commNorm.toExponential(2)}); detailed balance EMERGES: r~/g~ = e^{-beta-dE} to ${worstRatio.toExponential(2)} over the theta x beta grid; world-bit populations follow the two-rate chain per collision (${worstPop.toExponential(2)}); stationary register = Gibbs-world x cargo (${worstGibbs.toExponential(2)}, occupancy = the Boltzmann logistic to ${worstStat.toExponential(2)}); the law IS the T=0 collision: TD ${dev30.toExponential(2)} @ beta-dE=30, ${dev40.toExponential(2)} @40 (decays as e^{-beta-dE}); sector coherence decays at cos(theta) whatever the temperature (${worstCoh.toExponential(2)}) — the bath thermalizes populations and never touches the coherence rate`,
  };
}

/** W-J: the coherent shortcut — the law's asymptote in one energy-conserving
 * permutation, with the coherence conserved and banked. */
function witnessCoherentShortcut(): WitnessResult {
  const rng = makeRng(8808);
  // one-step collapse + full-basis coherence conservation
  let worstCollapse = 0;
  let worstConserved = 0;
  for (let t = 0; t < 25; t++) {
    const rho = t % 3 === 0 ? vecToRho(randomStateVec(rng, 4)) : sectorDephase(vecToRho(randomStateVec(rng, 4)));
    const sc = coherentShortcut(rho);
    worstCollapse = Math.max(worstCollapse, traceDistance(sc.register, collapseIntoWorld(rho)));
    worstConserved = Math.max(worstConserved, Math.abs(totalCoherenceBits(sc.total) - totalCoherenceBits(kron(rho, groundWeight()))));
  }
  // the weight ledger: product straddlers bank the full bit (purity + FE excess = kT ln2)
  let worstPurity = 0;
  let worstFE = 0;
  let worstBanked = 0;
  for (let t = 0; t < 15; t++) {
    const phi = rng() * 2 * Math.PI;
    const w = vec(2);
    w.re[0] = 1 / Math.SQRT2;
    w.re[1] = Math.cos(phi) / Math.SQRT2;
    w.im[1] = Math.sin(phi) / Math.SQRT2;
    const rho = vecToRho(vKron(w, randomStateVec(rng, 2)));
    const sc = coherentShortcut(rho);
    worstCollapse = Math.max(worstCollapse, traceDistance(sc.register, collapseIntoWorld(rho)));
    worstPurity = Math.max(worstPurity, vonNeumannEntropy(sc.weight));
    const wBits = totalCoherenceBits(sc.weight);
    worstBanked = Math.max(worstBanked, Math.abs(wBits - 1));
    // the banked bit's free-energy excess on the weight's own diagonal Hamiltonian
    // (dephasing preserves <H> whatever the gap — the AT7 engine, re-run on the weight)
    const dPhi = mat(2, 2);
    dPhi.re[0] = sc.weight.re[0]!;
    dPhi.re[3] = sc.weight.re[3]!;
    worstFE = Math.max(worstFE, Math.abs((vonNeumannEntropy(dPhi) - vonNeumannEntropy(sc.weight)) - 1));
  }
  const ok = worstCollapse <= 1e-14 && worstConserved <= 1e-13 && worstPurity <= 1e-12 && worstBanked <= 1e-12 && worstFE <= 1e-12;
  return {
    name: "W-J coherent shortcut",
    pass: ok,
    detail: `the theta=pi/2 exchange against a ground weight reaches the law's k->infinity state on the register in ONE step (worst TD vs collapseIntoWorld ${worstCollapse.toExponential(2)}); full-basis C_rel conserved exactly (${worstConserved.toExponential(2)} — an incoherent permutation relocates, never destroys); product straddlers bank the FULL sector bit on the weight (purity ${worstPurity.toExponential(2)}, banked bits ${worstBanked.toExponential(2)}, free-energy excess = kT ln2 exactly (${worstFE.toExponential(2)})) — coherent protocols conserve what incoherent laws dissipate`,
  };
}

/** The shortcut's ground weight as a 2x2 state. */
function groundWeight(): ReturnType<typeof mat> {
  const g = mat(2, 2);
  g.re[3] = 1;
  return g;
}

/** W-K: the continuum limit, executed as a discrete convergence theorem. */
function witnessContinuumLimit(): WitnessResult {
  const rng = makeRng(9909);
  const s2 = (th: number) => Math.sin(th) ** 2;
  // 1. finite-coupling exactness: populations have NO higher corrections
  let worstPop = 0;
  for (const beta of [0, 1, 3, 10]) {
    const pB = 1 / (1 + Math.exp(-beta));
    for (const th of [0.5, 0.25, 0.125]) {
      for (let t = 0; t < 8; t++) {
        const rho = vecToRho(randomStateVec(rng, 4));
        const p = membershipCharge(rho);
        worstPop = Math.max(worstPop, Math.abs(membershipCharge(applyCollision(rho, th, beta)) - (p + s2(th) * (pB - p))));
      }
    }
  }
  // 2. the finite-n closed form: block mixing 2x2 + sector coherence cos^n
  let worstBlock = 0;
  let worstCoh = 0;
  for (const beta of [1, 5]) {
    for (const th of [0.6, 0.3]) {
      const rho = vecToRho(randomStateVec(rng, 4));
      const ss0 = rho.re[1]!;
      const ww0 = rho.re[2 * 4 + 3]!;
      const c0 = sectorCoherence(rho);
      let cur = rho;
      for (let n = 1; n <= 7; n++) {
        cur = applyCollision(cur, th, beta);
        const exp = collisionBlockMixing(n, th, beta, ss0, ww0);
        worstBlock = Math.max(worstBlock, Math.abs(cur.re[1]! - exp.ss), Math.abs(cur.re[2 * 4 + 3]! - exp.ww));
        const cN = sectorCoherence(cur);
        worstCoh = Math.max(worstCoh, Math.abs(cN.re - Math.cos(th) ** n * c0.re), Math.abs(cN.im - Math.cos(th) ** n * c0.im));
      }
    }
  }
  // 3. the composition limit: error <= C t s^2 (halving theta quarters it)
  const beta = 3;
  const pB = 1 / (1 + Math.exp(-beta));
  const errs: number[] = [];
  for (const th of [0.2, 0.1]) {
    const t = 1;
    const n = Math.round(t / s2(th));
    let worst = 0;
    for (let trial = 0; trial < 6; trial++) {
      const phi = rng() * 2 * Math.PI;
      const w = vec(2);
      w.re[0] = 1 / Math.SQRT2;
      w.re[1] = Math.cos(phi) / Math.SQRT2;
      w.im[1] = Math.sin(phi) / Math.SQRT2;
      const rho = vecToRho(vKron(w, randomStateVec(rng, 2)));
      let cur = rho;
      for (let k = 0; k < n; k++) cur = applyCollision(cur, th, beta);
      const p0 = membershipCharge(rho);
      worst = Math.max(worst, Math.abs(membershipCharge(cur) - (pB + Math.exp(-t) * (p0 - pB))));
      worst = Math.max(worst, Math.abs(sectorCoherence(cur).re - Math.exp(-t / 2) * sectorCoherence(rho).re));
    }
    errs.push(worst);
  }
  const ratio = errs[0]! / errs[1]!;
  // 4. the Davies rate restored: (cos th - 1)/s^2 = -1/(1+cos th) -> -1/2 at O(th^2);
  //    the limiting coherence rate 1/2 = (p_b + q_b)/2 exactly
  let worstRate = 0;
  for (const th of [0.4, 0.2, 0.1, 0.05]) worstRate = Math.max(worstRate, Math.abs((Math.cos(th) - 1) / s2(th) + 0.5) / (th * th));
  const daviesGap = Math.abs(0.5 - (pB + (1 - pB)) / 2);
  const ok = worstPop <= 1e-15 && worstBlock <= 1e-15 && worstCoh <= 1e-15 && ratio >= 3.5 && ratio <= 4.5 && worstRate <= 0.14 && daviesGap === 0;
  return {
    name: "W-K continuum limit",
    pass: ok,
    detail: `finite coupling is EXACT: populations follow p' = p + s²(p_b − p) with no higher corrections (${worstPop.toExponential(2)}), the within-block coherences follow the 2x2 mixing closed form (${worstBlock.toExponential(2)}) and the sector coherence cos^n(theta) (${worstCoh.toExponential(2)}) — the quantum content is exact at every coupling; the limit only replaces geometrics by exponentials with error exactly O(t·s²) (composition ratio on halving theta: ${ratio.toFixed(1)}, expect 4); the generator's coherence rate (cos θ − 1)/s² → −1/2 at O(θ²) (bounded ${worstRate.toFixed(2)}·θ²) — the DAVIES rate (γ↓+γ↑)/2 = 1/2 is restored exactly (gap ${daviesGap.toExponential(2)}) although every finite coupling is temperature-free: the clock n = t/s² absorbs p_b + q_b = 1`,
  };
}

/** W-L: the audit ledger — the exact decomposition, the exact reversal. */
function witnessAuditLedger(): WitnessResult {
  const rng = makeRng(1010);
  const ground = mat(2, 2);
  ground.re[3] = 1;
  const vDagger = mDagger(exchangeUnitary(Math.PI / 2));
  let worstIdentity = 0;
  let worstNeg = 0;
  let worstReverse = 0;
  const splits: number[] = [];
  for (let t = 0; t < 30; t++) {
    const rho = t % 2 === 0 ? vecToRho(randomStateVec(rng, 4)) : sectorDephase(vecToRho(randomStateVec(rng, 4)));
    const sc = coherentShortcut(rho);
    const c8 = totalCoherenceBits(sc.total);
    const c4 = totalCoherenceBits(sc.register);
    const c2 = totalCoherenceBits(sc.weight);
    const d4 = mat(4, 4);
    for (let i = 0; i < 4; i++) d4.re[i * 4 + i] = sc.register.re[i * 4 + i]!;
    const d2 = mat(2, 2);
    d2.re[0] = sc.weight.re[0]!;
    d2.re[3] = sc.weight.re[3]!;
    const d8 = mat(8, 8);
    for (let i = 0; i < 8; i++) d8.re[i * 8 + i] = sc.total.re[i * 8 + i]!;
    const mutual = vonNeumannEntropy(sc.register) + vonNeumannEntropy(sc.weight) - vonNeumannEntropy(sc.total);
    const classical = vonNeumannEntropy(d4) + vonNeumannEntropy(d2) - vonNeumannEntropy(d8);
    worstIdentity = Math.max(worstIdentity, Math.abs(c8 - c4 - c2 - (mutual - classical)));
    worstNeg = Math.max(worstNeg, -(mutual - classical), -c2);
    splits.push(c2 / (c8 || 1));
    worstReverse = Math.max(worstReverse, traceDistance(applyUnitary(sc.total, vDagger), kron(rho, ground)));
  }
  // straddler tightness: the weight banks the SECTOR bit; the correlation term is zero; the cargo artifact stays on the register
  let worstTight = 0;
  for (let t = 0; t < 12; t++) {
    const phi = rng() * 2 * Math.PI;
    const w = vec(2);
    w.re[0] = 1 / Math.SQRT2;
    w.re[1] = Math.cos(phi) / Math.SQRT2;
    w.im[1] = Math.sin(phi) / Math.SQRT2;
    const rho = vecToRho(vKron(w, randomStateVec(rng, 2)));
    const sc = coherentShortcut(rho);
    const c8 = totalCoherenceBits(sc.total);
    const c4 = totalCoherenceBits(sc.register);
    const c2 = totalCoherenceBits(sc.weight);
    const d4 = mat(4, 4);
    for (let i = 0; i < 4; i++) d4.re[i * 4 + i] = sc.register.re[i * 4 + i]!;
    const d2 = mat(2, 2);
    d2.re[0] = sc.weight.re[0]!;
    d2.re[3] = sc.weight.re[3]!;
    const d8 = mat(8, 8);
    for (let i = 0; i < 8; i++) d8.re[i * 8 + i] = sc.total.re[i * 8 + i]!;
    const mutual = vonNeumannEntropy(sc.register) + vonNeumannEntropy(sc.weight) - vonNeumannEntropy(sc.total);
    const classical = vonNeumannEntropy(d4) + vonNeumannEntropy(d2) - vonNeumannEntropy(d8);
    worstTight = Math.max(worstTight, Math.abs(c2 - 1), Math.abs(mutual - classical), Math.abs(c8 - c4 - 1));
  }
  const ok = worstIdentity <= 1e-14 && worstNeg <= 0 && worstReverse <= 1e-14 && worstTight <= 1e-12;
  return {
    name: "W-L audit ledger",
    pass: ok,
    detail: `the three-term ledger holds exactly: C^total = C^register + C^weight + (I − J_c) to ${worstIdentity.toExponential(2)}, every term >= 0 (J_c <= I by data processing); the REVERSAL is exact: V*^dag restores the input to trace distance ${worstReverse.toExponential(2)} — what the law burns is reconstructible from the register+weight records, dissipation is the law's choice, not a necessity of the physics; straddlers: the weight banks the full sector bit, the correlation term is 0, the cargo basis artifact stays on the register (${worstTight.toExponential(2)}); general states split (banked fraction ${Math.min(...splits).toFixed(2)}–${Math.max(...splits).toFixed(2)} over the census) — the correlation term is where the value sits, and its asymptotic access is quantum-side-information territory (WY16, cited)`,
  };
}

/** W-M: the generator IS the Lindblad operator with the Davies rates. */
function witnessLindbladForm(): WitnessResult {
  const rng = makeRng(1111);
  const s2 = (th: number) => Math.sin(th) ** 2;
  let worst = 0;
  for (const beta of [0, 1, 3, 10]) {
    const pB = 1 / (1 + Math.exp(-beta));
    for (const th of [0.2, 0.1, 0.05]) {
      for (let t = 0; t < 8; t++) {
        const rho = vecToRho(randomStateVec(rng, 4));
        const ext = extractedGenerator(rho, th, beta);
        const target = lindbladRhs(rho, pB, 1 - pB);
        let dev = 0;
        for (let i = 0; i < 16; i++) {
          dev = Math.max(dev, Math.abs(ext.re[i]! - target.re[i]!), Math.abs(ext.im[i]! - target.im[i]!));
        }
        worst = Math.max(worst, dev / (th * th));
      }
    }
  }
  // uniformity: sup over pure states of the composition error also falls ~4x on halving theta (census)
  const beta = 3;
  const pB = 1 / (1 + Math.exp(-beta));
  const sups: number[] = [];
  for (const th of [0.2, 0.1]) {
    const t = 1;
    const n = Math.round(t / s2(th));
    let worst2 = 0;
    for (let trial = 0; trial < 40; trial++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      let cur = rho;
      for (let k = 0; k < n; k++) cur = applyCollision(cur, th, beta);
      const p0 = membershipCharge(rho);
      let dev = Math.abs(membershipCharge(cur) - (pB + Math.exp(-t) * (p0 - pB)));
      dev = Math.max(dev, Math.abs(sectorCoherence(cur).re - Math.exp(-t / 2) * sectorCoherence(rho).re) / 4);
      worst2 = Math.max(worst2, dev);
    }
    sups.push(worst2);
  }
  const ratio = sups[0]! / sups[1]!;
  const ok = worst <= 0.06 && ratio >= 3 && ratio <= 5;
  return {
    name: "W-M Lindblad form",
    pass: ok,
    detail: `the extraction (Phi_theta - id)/sin^2(theta) converges to the LINDBLAD operator with the Davies rates (jump-down sqrt(p_b)|1><0|(x)I, jump-up sqrt(q_b)|0><1|(x)I, interaction picture) with worst |dev|/theta^2 = ${worst.toExponential(2)} bounded over beta x theta x states; and the composition convergence is UNIFORM over the state space: sup over random pure states falls ${ratio.toFixed(1)}x on halving theta (expect 4, Monte Carlo max over 40 states) — the norm-continuity statement of the functional-analytic theorem (DAV74) holds on this model as a census`,
  };
}

/** W-N: the phase-alignment bank — the one-shot incoherent QSI-free core. */
function witnessPhaseAlignment(): WitnessResult {
  const rng = makeRng(1212);
  let worstAlign = 0;
  let worstMonotone = 0;
  let worstBoost = 0;
  let worstStraddler = 0;
  for (let t = 0; t < 30; t++) {
    const rho = t % 2 === 0 ? vecToRho(randomStateVec(rng, 4)) : sectorDephase(vecToRho(randomStateVec(rng, 4)));
    const sc = coherentShortcut(rho);
    const bank = alignedBank(sc.total);
    worstAlign = Math.max(worstAlign, Math.abs(bank.aligned - bank.l1));
    worstMonotone = Math.max(worstMonotone, bank.naive - bank.l1 - 1e-15);
    if (bank.l1 > 1e-9) worstBoost = Math.max(worstBoost, (bank.l1 - bank.naive) / bank.l1);
  }
  // straddlers: alignment is a no-op (both sigma_r share the input phase + pi/2)
  for (let t = 0; t < 10; t++) {
    const phi = rng() * 2 * Math.PI;
    const w = vec(2);
    w.re[0] = 1 / Math.SQRT2;
    w.re[1] = Math.cos(phi) / Math.SQRT2;
    w.im[1] = Math.sin(phi) / Math.SQRT2;
    const rho = vecToRho(vKron(w, randomStateVec(rng, 2)));
    const bank = alignedBank(coherentShortcut(rho).total);
    worstStraddler = Math.max(worstStraddler, Math.abs(bank.aligned - bank.naive));
  }
  const ok = worstAlign <= 1e-14 && worstMonotone <= 1e-15 && worstStraddler <= 1e-14;
  return {
    name: "W-N phase-alignment bank",
    pass: ok,
    detail: `an INCOHERENT controlled-phase controller (diagonal in the product basis) raises the banked weight coherence from |sum_r sigma_r| to sum_r |sigma_r| EXACTLY (worst deviation ${worstAlign.toExponential(2)} — the triangle inequality attained; naive <= l1 always, worst excess ${worstMonotone.toExponential(2)}); the boost recovers up to ${(worstBoost * 100).toFixed(1)}% of the bank on opposite-phase states — one-shot, QSI-FREE banking; straddlers: alignment is a no-op (${worstStraddler.toExponential(2)} — their sigma_r already share the input phase); the residual gap to C_total is the genuine correlation coherence (asymptotic access = quantum side information, WY16 cited)`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [
    witnessLaw(),
    witnessAttraction(),
    witnessLyapunov(),
    witnessPerturbation(),
    witnessTariff(),
    witnessEscape(),
    witnessCoherentTariff(),
    witnessThermalReading(),
    witnessCollisionBath(),
    witnessCoherentShortcut(),
    witnessContinuumLimit(),
    witnessAuditLedger(),
    witnessLindbladForm(),
    witnessPhaseAlignment(),
  ];
}
