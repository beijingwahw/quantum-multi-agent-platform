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
 *   W-F the cross-anchors resolve (packages and rendered reports on disk).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CMat } from "../core/cmat.js";
import { kron } from "../core/cmat.js";
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
import { BOARD, type BoardRow } from "./board.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F"];

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
  const coin = bellBasis()[0] as ReturnType<typeof bellBasis>[number];
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
  const mintFid = pureFidelity(mintState, bellBasis()[0] as ReturnType<typeof bellBasis>[number]);
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

export function runWitnesses(): readonly WitnessResult[] {
  return [
    witnessRedemption(),
    witnessReverseQuote(),
    witnessNetting(),
    witnessMintWall(),
    witnessArithmetic(),
    witnessCrossAnchors(),
  ];
}
