/**
 * The checker — the board laws, and the witnesses that re-derive every
 * EXACT number from the clearing machinery itself.
 *
 * Laws enforced:
 *   H1. every trade carries BOTH columns (give and get) — a single-sided
 *       quote does not ship;
 *   H2. every row must cite a witness that exists — an unwitnessed rate is
 *       marketing (a QUOTED row cites the cross-anchor witness W-F);
 *   H3. anchor repos exist on disk;
 *   H4. tags are EXACT / DATA / QUOTED — the vocabulary is closed;
 *   H5. ids unique.
 *   H6. yield-table provenance: an EXECUTED row's numbers must recompute
 *       from the purification machinery at its finite scale (the BBPS96
 *       asymptotic hashing line does not launder as finite-n data); a QUOTED
 *       row must cite BBPS96 and quote the line exactly;
 *   H7. ledger honesty: every conservation row's claim must match the
 *       machine-recomputed delta — a fake conservation identity is rejected
 *       by recomputation;
 *   H8. GHZ-bank claims: HOLDS/REFUTED/CENSUS tags must match the machine's
 *       recomputed verdict — a refuted wall claimed as holding is contraband.
 *
 * Witnesses:
 *   W-A redemption: teleport = identity channel, coin burned, goods frozen
 *        until the classical leg settles;
 *   W-B reverse quote: 2 cbits at probability 1, coin returned as a known
 *        Bell; the no-coin floor chi(tetrahedron) = 1 exactly;
 *   W-C netting: Procrustean success = exactly |Phi+> at p = 2*l_min,
 *        failure a product state, p <= C throughout;
 *   W-D the mint wall: local rounds never raise E_F (census), products
 *        stay products locally, one CNOT mints C 0 -> 1;
 *   W-E the two-path arithmetic: h2 on both routes, E_F formula anchored;
 *   W-F the cross-anchors resolve (packages and rendered reports on disk);
 *   W-G the purification desk: the BBPSSW round matches its closed forms
 *        (Werner and general Bell-diagonal), the Clifford twirl is exact,
 *        expected E_F never rises, bounded schemes never mint a standard
 *        coin, and the yield table recomputes row by row;
 *   W-H the conservation ledger: every identity exact, every counterexample
 *        real, every never-rises holding;
 *   W-I the GHZ bank: pairwise zero and cuts 1/2 exactly, the withdrawal's
 *        exact identities, the local-channel census, and the claims table.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CMat } from "../core/cmat.js";
import { isUnitary, kron, matEq } from "../core/cmat.js";
import { makeRng } from "../core/rng.js";
import { traceDistance } from "../core/measures.js";
import { maximallyMixed, randomStateVec, vecToRho } from "../core/states.js";
import {
  bellBasis,
  concurrence,
  denseCode,
  eF,
  entropyOfMixedQubit,
  h2,
  h2ViaLn,
  mintByGate,
  netWeakCoin,
  pureFidelity,
  randomLocalRound,
  randomMixedPair,
  randomMixedQubit,
  redeem,
  tetrahedronChi,
} from "./clearing.js";
import {
  bellDiagonal,
  bellFidelity,
  bellRoundClosedForm,
  bellTwirl,
  bellWeights,
  cliffords,
  depolCoin,
  familyCoin,
  hashingLineWerner,
  purifyRound,
  schemePurify,
  wernerCoin,
  wernerFOfFamily,
  wernerRoundClosedForm,
  YIELD_TABLE,
  type YieldRow,
} from "./purify.js";
import { computeLedger, LEDGER_SPECS, type LedgerSpec } from "./ledger.js";
import {
  GHZ_CLAIMS,
  ghzCoin,
  ghzCutNegativities,
  ghzLocalCensus,
  ghzPairwiseConcurrences,
  withdrawToAB,
  type GhzClaimRow,
} from "./ghz.js";
import { BOARD, type BoardRow } from "./board.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = [
  "W-A",
  "W-B",
  "W-C",
  "W-D",
  "W-E",
  "W-F",
  "W-G",
  "W-H",
  "W-I",
];

/**
 * A BoardRow as it crosses the untrusted boundary into the checker: the
 * compile-time `Exactness` union proves nothing at runtime (rows can arrive
 * parsed or mutated), so the tag is an unvalidated string until H4 has run.
 * `BoardRow` remains assignable (Exactness ⊂ string).
 */
export type UntrustedBoardRow = Omit<BoardRow, "exactness"> & { readonly exactness: string };

export function checkBoard(rows: readonly UntrustedBoardRow[] = BOARD): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "H5", detail: "duplicate board row id" });
    seen.add(r.id);
    if (r.give.trim().length === 0 || r.get.trim().length === 0) {
      violations.push({ row: r.id, law: "H1", detail: "a single-sided quote — the board does not ship it" });
    }
    if (!WITNESS_IDS.includes(r.witness)) {
      violations.push({ row: r.id, law: "H2", detail: `cites unknown witness "${String(r.witness)}" — an unwitnessed rate is marketing` });
    }
    if (r.exactness !== "EXACT" && r.exactness !== "DATA" && r.exactness !== "QUOTED") {
      violations.push({ row: r.id, law: "H4", detail: `illegal tag "${r.exactness}"` });
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        violations.push({ row: r.id, law: "H3", detail: `anchor repo missing on disk: ${a}` });
      }
    }
  }
  return violations;
}

/**
 * A YieldRow as it crosses the untrusted boundary: the tag is an
 * unvalidated string until H6 has run.
 */
export type UntrustedYieldRow = Omit<YieldRow, "tag"> & { readonly tag: string };

/** The hashing line of a row's family, for laundering detection. */
function rowHashingLine(family: string, param: number): number {
  return hashingLineWerner(wernerFOfFamily(family === "WERNER" ? "WERNER" : "DEPOL", param));
}

/** H6 — yield-table provenance: executed numbers must recompute, quoted lines must be quoted. */
export function checkYieldTable(rows: readonly UntrustedYieldRow[] = YIELD_TABLE): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "H6", detail: "duplicate yield row id" });
    seen.add(r.id);
    if (r.tag !== "EXECUTED" && r.tag !== "QUOTED") {
      violations.push({ row: r.id, law: "H6", detail: `illegal yield tag "${r.tag}" — the vocabulary is {EXECUTED, QUOTED}` });
      continue;
    }
    if (r.tag === "EXECUTED") {
      if (r.scale !== 2 && r.scale !== 3 && r.scale !== 4) {
        violations.push({ row: r.id, law: "H6", detail: `executed scale must be 2, 3, or 4 — got ${r.scale}` });
        continue;
      }
      const s = schemePurify(r.scale, familyCoin(r.family, r.param));
      const worst = Math.max(
        Math.abs(s.pSucc - r.pSucc),
        Math.abs(s.fidelityOut - r.fidelityOut),
        Math.abs(s.coinYield - r.coinYield),
        Math.abs(s.efYield - r.efYield),
        Math.abs(s.cOut - r.cOut),
        Math.abs(s.efOut - r.efOut),
      );
      if (worst > 1e-12) {
        const asymptotic = Math.abs(r.coinYield - rowHashingLine(r.family, r.param)) <= 1e-9;
        violations.push({
          row: r.id,
          law: "H6",
          detail: asymptotic
            ? `counterfeit yield — the claimed rate ${r.coinYield.toFixed(9)} is the BBPS96 asymptotic hashing line, not the executed scale-${r.scale} yield ${s.coinYield.toFixed(9)}: the asymptotic line does not launder as finite-n data`
            : `claimed numbers do not recompute at scale ${r.scale} (worst dev ${worst.toExponential(3)})`,
        });
      }
      if (r.fidelityOut >= 1 - 1e-9) {
        violations.push({
          row: r.id,
          law: "H6",
          detail: `counterfeit mint — bounded-scale netting never delivers a standard coin (F_out < 1 exactly at n <= 4), claimed ${r.fidelityOut}`,
        });
      }
    } else {
      if (r.citation !== "BBPS96") {
        violations.push({ row: r.id, law: "H6", detail: `a quoted rate must cite BBPS96 — an unwitnessed rate is marketing` });
      }
      if (Number.isFinite(r.scale)) {
        violations.push({ row: r.id, law: "H6", detail: `a quoted row carries the asymptotic scale, not ${r.scale} — quoting at a finite scale launders the line` });
      }
      const R = rowHashingLine(r.family, r.param);
      if (Math.abs(r.coinYield - R) > 1e-12) {
        violations.push({ row: r.id, law: "H6", detail: `misquoted line — BBPS96 hashing at this grade gives ${R.toFixed(12)}, claimed ${r.coinYield}` });
      }
    }
  }
  return violations;
}

/** A ledger row as it crosses the untrusted boundary. */
export type UntrustedLedgerRow = Omit<LedgerSpec, "claim"> & { readonly claim: string };

/** H7 — ledger honesty: every claim must survive recomputation of its delta. */
export function checkLedger(rows: readonly UntrustedLedgerRow[] = LEDGER_SPECS): Violation[] {
  const computed = new Map<string, { before: number; after: number; resource: string }>();
  for (const e of computeLedger()) computed.set(e.id, { before: e.before, after: e.after, resource: e.resource });
  const violations: Violation[] = [];
  for (const r of rows) {
    const c = computed.get(r.id);
    if (c === undefined) {
      violations.push({ row: r.id, law: "H7", detail: "unknown ledger row — the machinery recomputes no such op" });
      continue;
    }
    if (r.claim !== "CONSERVED" && r.claim !== "NOT-CONSERVED" && r.claim !== "NEVER-RISES") {
      violations.push({ row: r.id, law: "H7", detail: `illegal ledger claim "${r.claim}" — the vocabulary is {CONSERVED, NOT-CONSERVED, NEVER-RISES}` });
      continue;
    }
    const delta = c.after - c.before;
    if (r.claim === "CONSERVED" && Math.abs(delta) > 1e-12) {
      violations.push({
        row: r.id,
        law: "H7",
        detail: `fake conservation identity — the machinery recomputes ${c.resource} ${c.before.toFixed(12)} -> ${c.after.toFixed(12)} (delta ${delta.toExponential(3)}): conserved it is not`,
      });
    }
    if (r.claim === "NOT-CONSERVED" && Math.abs(delta) <= 1e-9) {
      violations.push({
        row: r.id,
        law: "H7",
        detail: `claimed change but the machinery conserves ${c.resource} (delta ${delta.toExponential(3)}) — a fake counterexample`,
      });
    }
    if (r.claim === "NEVER-RISES" && delta > 1e-12) {
      violations.push({
        row: r.id,
        law: "H7",
        detail: `claimed never-rises but the machinery recomputes a rise of ${delta.toExponential(3)} in ${c.resource}`,
      });
    }
  }
  return violations;
}

/** A GHZ claim row as it crosses the untrusted boundary. */
export type UntrustedGhzClaimRow = Omit<GhzClaimRow, "tag"> & { readonly tag: string };

/** The machine's verdict on one GHZ claim: does the tagged outcome hold? */
function ghzClaimOutcome(id: string, censusRounds: number): { holds: boolean; refuted: boolean; detail: string } {
  const g = ghzCoin();
  switch (id) {
    case "G1": {
      const cs = ghzPairwiseConcurrences(g);
      const worst = Math.max(...cs);
      return { holds: worst <= 1e-12, refuted: false, detail: `worst pairwise concurrence ${worst.toExponential(3)}` };
    }
    case "G2": {
      const ns = ghzCutNegativities(g);
      const worst = Math.max(...ns.map((n) => Math.abs(n - 0.5)));
      return { holds: worst <= 1e-12, refuted: false, detail: `worst |N - 1/2| ${worst.toExponential(3)}` };
    }
    case "G3": {
      const wd = withdrawToAB();
      const worst = Math.max(
        Math.abs(wd.pPlus - 0.5),
        Math.abs(wd.pMinus - 0.5),
        1 - pureFidelity(wd.abPlus, bellBasis()[0]),
        1 - pureFidelity(wd.abMinus, bellBasis()[1]),
        Math.abs(concurrence(wd.abPlus) - 1),
        Math.abs(concurrence(wd.abMinus) - 1),
        wd.cbits - 1,
      );
      return { holds: worst <= 1e-12, refuted: false, detail: `worst deviation ${worst.toExponential(3)} across probabilities, fidelities, concurrences, cost` };
    }
    case "G4": {
      const wd = withdrawToAB();
      const worst = Math.max(
        ...ghzCutNegativities(wd.jointPlus).map((n, i) => Math.abs(n - [0, 0.5, 0.5][i]!)),
        ...ghzCutNegativities(wd.jointMinus).map((n, i) => Math.abs(n - [0, 0.5, 0.5][i]!)),
      );
      return { holds: worst <= 1e-12, refuted: false, detail: `worst cut deviation ${worst.toExponential(3)} on both branches` };
    }
    case "G5": {
      // the pairwise wall is REFUTED iff the withdrawal raises pairwise concurrence
      const wd = withdrawToAB();
      const raised = wd.pPlus * concurrence(wd.abPlus) + wd.pMinus * concurrence(wd.abMinus);
      return { holds: false, refuted: raised > 1 - 1e-9, detail: `C_AB rises 0 -> ${raised.toFixed(12)} under one LOCC withdrawal` };
    }
    case "G6": {
      const census = ghzLocalCensus(makeRng(203), censusRounds);
      return { holds: census.worstCutRise <= 1e-12, refuted: false, detail: `worst cut rise ${census.worstCutRise.toExponential(3)} over ${censusRounds} rounds` };
    }
    case "G7": {
      const census = ghzLocalCensus(makeRng(203), censusRounds);
      return { holds: census.worstPairwiseC <= 1e-12, refuted: false, detail: `worst pairwise concurrence ${census.worstPairwiseC.toExponential(3)} over ${censusRounds} rounds` };
    }
    default:
      return { holds: false, refuted: false, detail: "unknown claim id" };
  }
}

/** H8 — GHZ-bank claims: the tag must match the machine's recomputed verdict. */
export function checkGhzClaims(rows: readonly UntrustedGhzClaimRow[] = GHZ_CLAIMS, censusRounds = 150): Violation[] {
  const violations: Violation[] = [];
  for (const r of rows) {
    if (r.tag !== "HOLDS" && r.tag !== "REFUTED" && r.tag !== "CENSUS") {
      violations.push({ row: r.id, law: "H8", detail: `illegal claim tag "${r.tag}" — the vocabulary is {HOLDS, REFUTED, CENSUS}` });
      continue;
    }
    const v = ghzClaimOutcome(r.id, censusRounds);
    if (r.tag === "HOLDS" && !v.holds) {
      violations.push({ row: r.id, law: "H8", detail: `claimed HOLDS but the machine says otherwise (${v.detail})` });
    }
    if (r.tag === "REFUTED" && !v.refuted) {
      violations.push({ row: r.id, law: "H8", detail: `claimed REFUTED but no counterexample recomputes (${v.detail})` });
    }
    if (r.tag === "CENSUS" && !v.holds) {
      violations.push({ row: r.id, law: "H8", detail: `census claim fails its own census (${v.detail})` });
    }
  }
  return violations;
}

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

function witnessRedemption(): WitnessResult {
  const rng = makeRng(201);
  // Pure payloads: the exact <psi|rho|psi> route (the Uhlmann route carries
  // eigenvector noise ~1e-8 on rank-deficient states — the wrong metric for
  // an identity claim).
  let worstPure = 0;
  for (let t = 0; t < 18; t++) {
    const psi = randomStateVec(rng, 2);
    const r = redeem(vecToRho(psi));
    worstPure = Math.max(worstPure, 1 - pureFidelity(r.delivered, psi));
  }
  // Mixed payloads: identity verified by trace distance (eigenvalues only).
  const mixed: CMat[] = [maximallyMixed(2)];
  for (let t = 0; t < 6; t++) mixed.push(randomMixedQubit(rng));
  let worstMixed = 0;
  let worstFrozen = 0;
  let worstBurn = 0;
  for (const p of mixed) {
    const r = redeem(p);
    worstMixed = Math.max(worstMixed, traceDistance(r.delivered, p));
    worstFrozen = Math.max(worstFrozen, traceDistance(r.bobPreBits, maximallyMixed(2)));
    worstBurn = Math.max(worstBurn, concurrence(r.coinAfter));
  }
  for (let t = 0; t < 6; t++) {
    const psi = randomStateVec(rng, 2);
    const r = redeem(vecToRho(psi));
    worstFrozen = Math.max(worstFrozen, traceDistance(r.bobPreBits, maximallyMixed(2)));
    worstBurn = Math.max(worstBurn, concurrence(r.coinAfter));
  }
  const ok = worstPure <= 1e-12 && worstMixed <= 1e-12 && worstFrozen <= 1e-12 && worstBurn <= 1e-12;
  return {
    name: "W-A redemption",
    pass: ok,
    detail: `24 payloads (18 pure via <psi|rho|psi>, 6 mixed + I/2 via trace distance): worst pure infidelity ${worstPure.toExponential(3)}, worst mixed TD ${worstMixed.toExponential(3)}, worst pre-bits marginal TV ${worstFrozen.toExponential(3)}, worst post-trade coin concurrence ${worstBurn.toExponential(3)}`,
  };
}

function witnessReverseQuote(): WitnessResult {
  const d = denseCode();
  let worstDiag = 0;
  let worstOff = 0;
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 4; j++) {
      const p = d.decode[k]?.[j] ?? 0;
      if (j === k) worstDiag = Math.max(worstDiag, Math.abs(1 - p));
      else worstOff = Math.max(worstOff, Math.abs(p));
    }
  }
  const returned = concurrence(d.coinReturned);
  const chi = tetrahedronChi();
  const ok =
    worstDiag <= 1e-12 &&
    worstOff <= 1e-12 &&
    Math.abs(d.mutualInformation - 2) <= 1e-12 &&
    Math.abs(returned - 1) <= 1e-12 &&
    Math.abs(chi.chi - 1) <= 1e-12 &&
    chi.avgIsMixed <= 1e-12;
  return {
    name: "W-B reverse quote and the no-coin floor",
    pass: ok,
    detail: `decode diag ${worstDiag.toExponential(3)} / off-diag ${worstOff.toExponential(3)}, MI ${d.mutualInformation.toFixed(12)} bits, returned coin concurrence ${returned.toFixed(12)}, tetrahedron chi ${chi.chi.toFixed(12)} (avg eig worst dev ${chi.avgIsMixed.toExponential(3)})`,
  };
}

function witnessNetting(): WitnessResult {
  const coin = bellBasis()[0];
  let worstP = 0;
  let worstFid = 0;
  let worstFail = 0;
  let worstBound = 0;
  let n = 0;
  for (let i = 1; i <= 10; i++) {
    const lmin = 0.05 * i; // 0.05 .. 0.50
    const nt = netWeakCoin(lmin);
    worstP = Math.max(worstP, Math.abs(nt.pSucc - 2 * lmin));
    worstFid = Math.max(worstFid, 1 - pureFidelity(nt.successState, coin));
    // at l_min = 1/2 the coin is already standard: pFail is exactly 0 and
    // the fail branch is a probability-zero non-state — guarded, not divided
    if (nt.pFail > 1e-12) worstFail = Math.max(worstFail, concurrence(nt.failState));
    worstBound = Math.max(worstBound, nt.pSucc - nt.weakConcurrence);
    n++;
  }
  const ok = worstP <= 1e-12 && worstFid <= 1e-12 && worstFail <= 1e-12 && worstBound <= 1e-12;
  return {
    name: "W-C Procrustean netting",
    pass: ok,
    detail: `${n} grades (l_min 0.05..0.50): worst |p - 2 l_min| ${worstP.toExponential(3)}, worst success infidelity ${worstFid.toExponential(3)}, worst fail concurrence ${worstFail.toExponential(3)}, worst p - C ${worstBound.toExponential(3)}`,
  };
}

function witnessMintWall(): WitnessResult {
  const rng = makeRng(202);
  let worstRise = 0;
  for (let t = 0; t < 200; t++) {
    const rho = randomMixedPair(rng);
    const after = randomLocalRound(rng, rho);
    worstRise = Math.max(worstRise, eF(after) - eF(rho));
  }
  let worstProduct = 0;
  for (let t = 0; t < 50; t++) {
    const a = vecToRho(randomStateVec(rng, 2));
    const b = vecToRho(randomStateVec(rng, 2));
    const after = randomLocalRound(rng, kron(a, b));
    worstProduct = Math.max(worstProduct, concurrence(after));
  }
  const mintState = mintByGate();
  const minted = concurrence(mintState);
  const mintFid = pureFidelity(mintState, bellBasis()[0]);
  const ok = worstRise <= 1e-12 && worstProduct <= 1e-12 && Math.abs(minted - 1) <= 1e-12 && mintFid >= 1 - 1e-12;
  return {
    name: "W-D the mint wall",
    pass: ok,
    detail: `200 local rounds: worst E_F rise ${worstRise.toExponential(3)}; 50 product states stay products (worst C ${worstProduct.toExponential(3)}); one CNOT mints C = ${minted.toFixed(12)}, fidelity to |Phi+> ${mintFid.toFixed(12)}`,
  };
}

function witnessArithmetic(): WitnessResult {
  let worstH2 = 0;
  for (let i = 1; i <= 99; i++) {
    const x = i / 100;
    worstH2 = Math.max(worstH2, Math.abs(h2(x) - h2ViaLn(x)));
  }
  const efMax = h2((1 + Math.sqrt(1 - 1)) / 2);
  const efZero = h2((1 + Math.sqrt(1 - 0)) / 2);
  const sm = entropyOfMixedQubit();
  const ok = worstH2 <= 1e-12 && Math.abs(efMax - 1) <= 1e-12 && Math.abs(efZero - 0) <= 1e-12 && Math.abs(sm - 1) <= 1e-12;
  return {
    name: "W-E two-path arithmetic",
    pass: ok,
    detail: `h2 both routes on 99 points: maxdev ${worstH2.toExponential(3)}; E_F(C=1) = ${efMax.toFixed(12)}, E_F(C=0) = ${efZero.toFixed(12)}, S(I/2) = ${sm.toFixed(12)}`,
  };
}

function witnessCrossAnchors(): WitnessResult {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const r of BOARD) {
    for (const a of r.anchors) {
      if (seen.has(a)) continue;
      seen.add(a);
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) missing.push(`${a}/package.json`);
    }
  }
  for (const probe of ["readout-wall", "vacuum-compiler", "quantum-mech", "nosignal-tariff", "switch-sched", "ent-sched"]) {
    if (!existsSync(resolve(WORKSPACE_ROOT, probe, "package.json"))) missing.push(`${probe}/package.json`);
  }
  // the quoted tariff's rendered schedule must be on disk (E6's anchor)
  if (!existsSync(resolve(WORKSPACE_ROOT, "readout-wall", "out", "reports", "the-readout-wall.md"))) {
    missing.push("readout-wall/out/reports/the-readout-wall.md");
  }
  if (!existsSync(resolve(WORKSPACE_ROOT, "vacuum-compiler", "out", "reports"))) {
    missing.push("vacuum-compiler/out/reports/");
  }
  return {
    name: "W-F cross-anchors resolve",
    pass: missing.length === 0,
    detail: missing.length === 0 ? "all anchor packages and the quoted tariff's rendered schedule are on disk" : `missing: ${missing.join(", ")}`,
  };
}

function witnessPurificationDesk(): WitnessResult {
  // (a) the round vs its closed forms on 11 Werner grades
  let worstWernerP = 0;
  let worstWernerF = 0;
  for (let i = 0; i <= 10; i++) {
    const F = 0.45 + 0.05 * i;
    const W = wernerCoin(F);
    const r = purifyRound(W, W);
    const cf = wernerRoundClosedForm(F);
    worstWernerP = Math.max(worstWernerP, Math.abs(r.pSucc - cf.pSucc));
    worstWernerF = Math.max(worstWernerF, Math.abs(bellFidelity(r.successState) - cf.fidelityOut));
  }
  // (b) the round vs the general Bell-diagonal XOR closed form on random pairs
  const rng = makeRng(207);
  let worstBell = 0;
  for (let t = 0; t < 8; t++) {
    const rand4 = (): number[] => {
      let s = 0;
      const v = Array.from({ length: 4 }, () => {
        const x = rng();
        s += x;
        return x;
      });
      return v.map((x) => x / s);
    };
    const lam = rand4();
    const mu = rand4();
    const r = purifyRound(bellDiagonal(lam), bellDiagonal(mu));
    const ref = bellRoundClosedForm(lam, mu);
    worstBell = Math.max(worstBell, Math.abs(r.pSucc - ref.pSucc));
    for (let k = 0; k < 4; k++) worstBell = Math.max(worstBell, Math.abs(bellWeights(r.successState)[k]! - ref.out[k]!));
  }
  // (c) the twirl: 24 unitaries, exact fixed points, lambda1 preserved
  const group = cliffords();
  const twirlOk = group.length === 24 && group.every((u) => isUnitary(u));
  let worstTwirl = 0;
  for (const F of [0.55, 0.85]) {
    const t = bellTwirl(wernerCoin(F));
    worstTwirl = Math.max(worstTwirl, matEq(t, wernerCoin(F), 1e-12) ? 0 : 1);
  }
  const r85 = purifyRound(wernerCoin(0.85), wernerCoin(0.85));
  const t85 = bellTwirl(r85.successState);
  worstTwirl = Math.max(worstTwirl, Math.abs(bellWeights(t85)[0]! - bellWeights(r85.successState)[0]!));
  worstTwirl = Math.max(worstTwirl, matEq(t85, wernerCoin(bellFidelity(r85.successState)), 1e-12) ? 0 : 1);
  // (d) the honest negative: the raw nested round DEGRADES without the twirl
  const rawNested = purifyRound(r85.successState, r85.successState);
  const rawDegrades = bellFidelity(rawNested.successState) < bellFidelity(r85.successState) - 1e-9;
  // (e) expected E_F never rises through a round
  let worstRise = 0;
  for (let i = 0; i <= 10; i++) {
    const F = 0.45 + 0.05 * i;
    const W = wernerCoin(F);
    const r = purifyRound(W, W);
    worstRise = Math.max(worstRise, r.pSucc * eF(r.successState) + r.pFail * eF(r.failState) - 2 * eF(W));
  }
  // (f) the threshold: F <= 1/2 degrades, F > 1/2 improves
  const sub = wernerRoundClosedForm(0.45).fidelityOut < 0.45;
  const above = wernerRoundClosedForm(0.55).fidelityOut > 0.55;
  // (g) bounded schemes: chain probabilities, Bell-diagonal finals, no minted standard coin, E_F monotone
  let worstChain = 0;
  let worstEf = 0;
  let minted = false;
  for (const F of [0.55, 0.85, 0.95]) {
    const W = wernerCoin(F);
    const r1 = purifyRound(W, W);
    const t1 = bellTwirl(r1.successState);
    const chains: number[] = [r1.pSucc];
    const r3 = purifyRound(t1, W);
    chains.push(r1.pSucc * r3.pSucc);
    const r4 = purifyRound(t1, t1);
    chains.push(r1.pSucc * r1.pSucc * r4.pSucc);
    for (const n of [2, 3, 4] as const) {
      const s = schemePurify(n, W);
      worstChain = Math.max(worstChain, Math.abs(s.pSucc - (chains[n - 2] as number)));
      minted = minted || s.fidelityOut >= 1 - 1e-9;
      worstEf = Math.max(worstEf, s.pSucc * eF(s.finalState) - n * eF(W));
    }
  }
  // (h) family identity: a depolarized standard coin IS a Werner coin
  const familyOk = [0.1, 0.2, 0.3].every((p) => matEq(depolCoin(p), wernerCoin(1 - (3 * p) / 4), 1e-12));
  // (i) the yield table and the hashing bracket
  const yieldViolations = checkYieldTable();
  const hashBracket = hashingLineWerner(0.81) < 0 && hashingLineWerner(0.82) > 0;
  const ok =
    worstWernerP <= 1e-12 &&
    worstWernerF <= 1e-12 &&
    worstBell <= 1e-12 &&
    twirlOk &&
    worstTwirl <= 1e-12 &&
    rawDegrades &&
    worstRise <= 1e-12 &&
    sub &&
    above &&
    worstChain <= 1e-12 &&
    !minted &&
    worstEf <= 1e-12 &&
    familyOk &&
    yieldViolations.length === 0 &&
    hashBracket;
  return {
    name: "W-G the purification desk",
    pass: ok,
    detail: `11 Werner grades: worst |p-cf| ${worstWernerP.toExponential(3)}, |F'-cf| ${worstWernerF.toExponential(3)}; 8 random Bell pairs vs XOR form: ${worstBell.toExponential(3)}; Clifford twirl ${group.length} unitaries, fixed-point dev ${worstTwirl.toExponential(3)}; raw nested round degrades 0.884146 -> ${bellFidelity(rawNested.successState).toFixed(6)} without it; worst expected-E_F rise ${worstRise.toExponential(3)}; F=0.45 degrades and F=0.55 improves as claimed; n=2,3,4 chains recompute to ${worstChain.toExponential(3)}, no minted standard coin, worst E_F excess ${worstEf.toExponential(3)}; depol family == Werner family; yield table clean (${yieldViolations.length} violations); hashing line brackets 0 between F=0.81 and F=0.82`,
  };
}

function witnessLedger(): WitnessResult {
  const violations = checkLedger();
  const entries = computeLedger();
  const burned = entries.find((e) => e.id === "L2");
  const catalyst = entries.find((e) => e.id === "L4");
  const ok = violations.length === 0 && burned !== undefined && catalyst !== undefined;
  const burnDelta = burned === undefined ? Number.NaN : burned.after - burned.before;
  const catalystDelta = catalyst === undefined ? Number.NaN : catalyst.after - catalyst.before;
  return {
    name: "W-H the conservation ledger",
    pass: ok,
    detail:
      violations.length === 0
        ? `${entries.length} rows recomputed: the burn delta ${burnDelta.toFixed(12)}, the catalyst delta ${catalystDelta.toExponential(3)}, every identity exact, every counterexample real, every never-rises holding`
        : violations.map((v) => `${v.row}: ${v.detail}`).join("; "),
  };
}

function witnessGhzBank(): WitnessResult {
  const g = ghzCoin();
  const worstPairwise = Math.max(...ghzPairwiseConcurrences(g));
  const worstCut = Math.max(...ghzCutNegativities(g).map((n) => Math.abs(n - 0.5)));
  const claimViolations = checkGhzClaims();
  const ok = worstPairwise <= 1e-12 && worstCut <= 1e-12 && claimViolations.length === 0;
  return {
    name: "W-I the GHZ bank",
    pass: ok,
    detail:
      claimViolations.length === 0
        ? `pairwise concurrences exactly 0 (worst ${worstPairwise.toExponential(3)}), cuts exactly 1/2 (worst dev ${worstCut.toExponential(3)}), withdrawal/census claims all recompute — the wall survives per cut and fails on the pairwise ledger, exactly as claimed`
        : claimViolations.map((v) => `${v.row}: ${v.detail}`).join("; "),
  };
}

export function runWitnesses(): readonly WitnessResult[] {
  return [
    witnessRedemption(),
    witnessReverseQuote(),
    witnessNetting(),
    witnessMintWall(),
    witnessArithmetic(),
    witnessCrossAnchors(),
    witnessPurificationDesk(),
    witnessLedger(),
    witnessGhzBank(),
  ];
}
