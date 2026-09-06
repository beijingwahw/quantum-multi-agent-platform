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
 *   SW5. ids unique.
 *
 * Witnesses:
 *   W-A the law itself (CPTP, quiet-on-world, sector update, coherence decay);
 *   W-B global attraction (leakage closed form, diagonal-block collapse,
 *       path-dependence of contents);
 *   W-C the charge as Lyapunov function (increment identity + conservation
 *       under engineered programs, with a real random-program violation);
 *   W-D the perturbation census (attractor survives law-error, bounded);
 *   W-E the tariff arithmetic (h2 anchors + quoted schedule constants);
 *   W-F the escape ledger (monotonicity + two-rate chain closed form).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CMat, basisVec, identity, mAdd, mat, matEq, mDagger, mMul, vKron, vec } from "../core/cmat.js";
import { applyUnitary } from "../core/channels.js";
import { makeRng, type Rng } from "../core/rng.js";
import { maximallyMixed, randomStateVec, vecToRho } from "../core/states.js";
import { traceDistance, traceReal } from "../core/measures.js";
import { BOARD, type BoardRow, type Dynamics } from "./board.js";
import {
  GAMMA,
  applyLaw,
  applyPerturbed,
  collapseIntoWorld,
  h2,
  inWorldState,
  iterateLaw,
  lawKraus,
  leakage,
  membershipCharge,
  outOfWorldState,
  perturbedLeakageBound,
  randomBranchUnitary,
  randomCptpKraus,
  randomUnitary,
  sectorCoherence,
  twoRateInWorld,
  twoRateRecursion,
} from "./law.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F"];
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

export function runWitnesses(): WitnessResult[] {
  return [witnessLaw(), witnessAttraction(), witnessLyapunov(), witnessPerturbation(), witnessTariff(), witnessEscape()];
}
