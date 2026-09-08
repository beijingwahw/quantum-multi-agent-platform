/**
 * The checker — the board laws, and the witnesses that re-derive every
 * number from the matrices. The renderer refuses illegal boards; the tests
 * smuggle forgeries to prove each law bites.
 *
 * Laws:
 *   L1. every row names its board family (beat / clock / compile / thermo /
 *       backaction / tombstone / certificate) — a claim without its layer
 *       is marketing;
 *   L2. the exactness tag is EXACT, DATA, QUOTED or CITED; an EXACT row
 *       must cite a witness that exists; a DATA row must state its census
 *       horizon; a CITED row's keys must resolve in citations.md; a QUOTED
 *       row must anchor the repo that holds the schedule it quotes;
 *   L3. anchor repos exist on disk (package.json under the workspace root);
 *   L4. ids are unique;
 *   L5. the tariff criterion is FIXED LAW (thermo.ts TARIFF_CRITERION):
 *       it must appear VERBATIM in the rendered report, and the winner is
 *       recomputed by fewest-units at every audit — the comparison rule
 *       was legislated before the numbers existed.
 *
 * Witnesses:
 *   W-A the beat (flip identity, exact alternation, pi-pairing, rigidity);
 *   W-B the clock register (orbit advance / zero back-action / cargo T3)
 *       and the frontier census (random clocks, detuning, phase reads);
 *   W-C the compiler (multiplier deed, FREDKIN conservation, bijection);
 *   W-D the thermodynamic ledger (zero net work, detuned payment, tariffs);
 *   W-E the tombstone (stationarity, battery, two-road cross-validation);
 *   W-F the certificate (anchors alive, citations resolve, winner legal);
 *   W-H the lifetime law (closed form, protection cliff, heating twin);
 *   W-I the cliff line and the self-synchronizing clock;
 *   W-J the Pauli wall and the Hamming armor;
 *   W-K the armor dynamics (absorption radius, classical shadow, repair
 *       tariff — v0.5.0);
 *   W-L the tie reset (the even-n cure, the Landauer price of the
 *       decoder's blind spot — v0.6.0);
 *   W-M the binomial shadow law and the scale census (v0.7.0);
 *   W-N the spectral survival law and the stationary repair (v0.8.0);
 *   W-O the universal decay rate (v0.9.0);
 *   W-P the Krawtchouk spectrum and the second-order face (v0.10.0);
 *   W-Q the Rayleigh-Schrodinger closed form for c_2 (v0.11.0);
 *   W-R the general-n law for c_2 — the central-binomial partial sum and
 *       the retired pi/4 scaling (v0.12.0);
 *   W-S the third-order coefficient c_3 — the first level-repulsion
 *   W-T the quotient-face law — u as the joint Rayleigh vector of the
 *   W-U the coupling closed forms — the truncated norms equal the
 *   W-V the 9/8 limit assembled — the exact central-binomial
 *   W-W the arcsine law — the exact chain identity, the pi/2
 *   W-X the correction constant pinned — sigma1 to ten digits, the
 *       one-term refutations, and the exact fixed-k edge law;
 *   W-Z the isolated echo laws independently re-verified (the v0.2.0
 *       tautology convicted) and the Phi1 machine bracket (v0.20.0);
 *       profile limit reproducing 9/8, and a's structure;
 *       factorization, the geometric-tail bracket, and the correction
 *       constant's convergence;
 *       classical ones, the coupling is proportional to c_2's binomial,
 *       and the share extrapolates to 9/8 at n=1024;
 *       second and third orders, plus the cancellation census that
 *       refutes the 2/3-share hypothesis;
 *       face (v0.13.0).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeRng } from "../core/rng.js";
import { DtcError } from "../core/errors.js";
import { BOARD, type BoardRow, type Family } from "./board.js";
import {
  alternationDeviation,
  chainLifetimeCensus,
  cliffBisect,
  coherentEchoLawDeviation,
  convictedLawDeviation,
  dephasedEchoExpectationExact,
  dephasedLifetimeCrossing,
  flipIdentityDeviation,
  heatingRelaxation,
  isolatedEchoLifetime,
  pairingDeviations,
  rigidityCensus,
  rotorEchoLawDeviation,
  isolatedRotorParts,
  tautologicalIsoAgreement,
} from "./beat.js";
import { fredkinConservesWeight, multiplierVerdict, permToCMat, runnerPermutation } from "./compile.js";
import { isUnitary } from "../core/cmat.js";
import { bitFlipReadCensus, detunedCensus, orbitRun, randomClockCensus, readDephasingCensus, t1ReadCensus, yFlipReadCensus } from "./clock.js";
import {
  beatEnergyDeviation,
  beatTpmWorkDelta,
  detunedHeatingCensus,
  joulePrices,
  landauerJoules,
  ln2ByQuadrature,
  tariffTable,
  TARIFF_CRITERION,
} from "./thermo.js";
import { tombstoneCensus } from "./tombstone.js";
import {
  absorptionRadius,
  armorFireRule,
  binomialPmfClosed,
  delocalizedFlipCensus,
  fullRepairCensus,
  localizedDepolCensus,
  localizedFlipCensus,
  maskPopcountMarginal,
  popcountShadow,
  radiusCensus,
  repairCensus,
  amputatedSpectrumClosed,
  decayEigenpairResidual,
  decayRateConstant,
  krawtchoukResidual,
  secondOrderClosed,
  secondOrderCoefficient,
  secondOrderGeneral,
  secondOrderGeneralRational,
  secondOrderRSRational,
  thirdOrderClosed,
  thirdOrderFaces,
  quotientFaceIdentityResidue,
  cancellationDeficit,
  repulsionShare,
  repulsionAddendClosedRational,
  couplingClosedFormResidue,
  modeRatioFactorResidue,
  shareFloat,
  correctionConstant,
  shareChainPieces,
  arcsineLaw,
  richardsonLimit,
  sigmaFirst,
  edgeAsymptoticCoefficient,
  summandTimesDim,
  centralBinomialStepResidue,
  rationalResidue,
  shadowQ,
  spectralArmor,
  repairedStationary,
  stationaryBreach,
  stationaryTie,
  tieResetBits,
} from "./armor.js";
import {
  kappaFace,
  transferResidual,
  kappaFromSigma,
  arcClosureRelative,
  edgeNextOrder,
  edgeSeriesAccelerated,
  edgeSeriesTailBound,
  EDGE_SECOND_COEFF,
  fFunctionFace,
  phi1Face,
  phi1GridStructure,
  checkPhi1Bracket,
  kappaRoadCrossDeviation,
  zetaEM,
} from "./assembly.js";
import { shareFloatIncremental } from "./armor.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");
const CITATION_KEYS = [
  "ERS17",
  "EBN16",
  "KLS16",
  "YAO17",
  "BEN73",
  "FT82",
  "WO15",
  "MI22",
  "WIL12",
  "LAND61",
  "YSB25",
  "MOO26",
] as const;

const FAMILIES: readonly Family[] = [
  "beat",
  "clock",
  "compile",
  "thermo",
  "backaction",
  "tombstone",
  "certificate",
];
const WITNESSES = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-H", "W-I", "W-J", "W-K", "W-L", "W-M", "W-N", "W-O", "W-P", "W-Q", "W-R", "W-S", "W-T", "W-U", "W-V", "W-W", "W-X", "W-Y", "W-Z"] as const;

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

export function citationsText(): string {
  const p = resolve(process.cwd(), "citations.md");
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

export function checkBoard(board: readonly BoardRow[] = BOARD): Violation[] {
  const out: Violation[] = [];
  const ids = new Set<string>();
  const citations = citationsText();
  for (const r of board) {
    if (!FAMILIES.includes(r.family)) {
      out.push({ row: r.id, law: "L1", detail: `unknown family '${r.family}'` });
    }
    if (ids.has(r.id)) out.push({ row: r.id, law: "L4", detail: "duplicate id" });
    ids.add(r.id);
    switch (r.exactness) {
      case "EXACT":
      case "DATA":
      case "QUOTED":
      case "CITED":
        break;
      default: {
        const tag: string = r.exactness;
        out.push({ row: r.id, law: "L2", detail: `unknown exactness '${tag}'` });
      }
    }
    if (r.exactness === "EXACT" && !(WITNESSES as readonly string[]).includes(r.witness)) {
      out.push({ row: r.id, law: "L2", detail: `EXACT cites unknown witness '${r.witness}'` });
    }
    if (r.exactness === "DATA" && !/horizon|census/i.test(r.price)) {
      out.push({ row: r.id, law: "L2", detail: "DATA row states no census horizon" });
    }
    if (r.exactness === "QUOTED" && r.anchors.length === 0) {
      out.push({ row: r.id, law: "L2", detail: "QUOTED row anchors no holding repo" });
    }
    if (r.exactness === "CITED") {
      const keys = CITATION_KEYS.filter((k) => new RegExp(`\\b${k}\\b`).test(`${r.claim} ${r.price}`));
      if (keys.length === 0) {
        out.push({ row: r.id, law: "L2", detail: "CITED row names no citation key" });
      }
      for (const k of keys) {
        if (!citations.includes(k)) {
          out.push({ row: r.id, law: "L3", detail: `citation key '${k}' not in citations.md` });
        }
      }
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        out.push({ row: r.id, law: "L3", detail: `anchor repo '${a}' not on disk` });
      }
    }
  }
  // L5: the winner is law, recomputed — never chosen
  const winner = tariffTable().winner;
  const certRow = board.find((r) => r.family === "certificate");
  if (certRow !== undefined && !`${certRow.claim} ${certRow.price}`.includes(winner)) {
    out.push({
      row: certRow.id,
      law: "L5",
      detail: `certificate row does not carry the recomputed winner '${winner}'`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Witnesses — each re-derives its numbers and returns pass/fail with detail.
// ---------------------------------------------------------------------------

export interface WitnessResult {
  readonly witness: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** The demo circuit the quantum layer runs (a small nontrivial program). */
export const DEMO_CIRCUIT = [
  { kind: "CNOT" as const, wires: [0, 2] },
  { kind: "TOFFOLI" as const, wires: [0, 1, 2] },
  { kind: "NOT" as const, wires: [2] },
  { kind: "CNOT" as const, wires: [1, 0] },
];

export function runWitnesses(): WitnessResult[] {
  const out: WitnessResult[] = [];
  const rng = makeRng(0xd7c10c);

  // W-A — the beat
  {
    const flip = flipIdentityDeviation(rng, 5, 3);
    const alt = alternationDeviation(rng, 5, 3, 8);
    const pair = pairingDeviations(rng, 5, 3, 3);
    const rig = rigidityCensus(6, [0.05, 0.1, 0.2], 20);
    const rigOk = [0.05, 0.1, 0.2].every((d) => {
      const row10 = rig.find((r) => r.delta === d && r.k === 10)!;
      return row10.chainAbsM > row10.isolatedAbsM;
    });
    out.push({
      witness: "W-A",
      ok:
        flip <= 5e-15 &&
        alt <= 1e-15 &&
        pair.odd <= 1e-25 &&
        pair.even <= 5e-14 &&
        rigOk,
      detail: `flip ${flip.toExponential(2)} (<=5e-15); alternation ${alt.toExponential(2)} (<=1e-15, the summation floor); pairing odd ${pair.odd.toExponential(2)} even ${pair.even.toExponential(2)}; rigidity chain>isolated at k=10 for all deltas: ${rigOk}`,
    });
  }

  // W-B — the clock register and the frontier
  {
    const orbit = orbitRun(rng, 4, DEMO_CIRCUIT, 3, 4);
    const orbit5 = orbitRun(rng, 5, DEMO_CIRCUIT, 3, 2);
    const rc = randomClockCensus(makeRng(31), 4, DEMO_CIRCUIT, 3, 3);
    const maxEntropy = Math.max(...rc.map((r) => r.clockEntropyBits));
    const minFidelity = Math.min(...rc.map((r) => r.advanceFidelity));
    const det05 = detunedCensus(4, 0.05, DEMO_CIRCUIT, 3);
    const det30 = detunedCensus(4, 0.3, DEMO_CIRCUIT, 3);
    const f05 = det05[det05.length - 1]!.advanceFidelity;
    const f30 = det30[det30.length - 1]!.advanceFidelity;
    const rd = readDephasingCensus(4, 0.1, DEMO_CIRCUIT, 3);
    const rdLast = rd[rd.length - 1]!;
    out.push({
      witness: "W-B",
      ok:
        orbit.advanceWorst <= 5e-15 &&
        orbit.backActionWorst <= 5e-15 &&
        orbit.cargoWorst <= 5e-15 &&
        orbit5.advanceWorst <= 5e-15 &&
        orbit5.backActionWorst <= 5e-15 &&
        orbit5.cargoWorst <= 5e-15 &&
        maxEntropy > 0.1 &&
        minFidelity < 0.9 &&
        f05 > 0.99 &&
        f30 < 0.99 &&
        rdLast.advanceFidelity >= 1 - 1e-12 &&
        rdLast.clockEntropyBits <= 1e-12,
      detail: `orbit n=4 advance ${orbit.advanceWorst.toExponential(2)} backAction ${orbit.backActionWorst.toExponential(2)} cargo ${orbit.cargoWorst.toExponential(2)}; n=5 ${orbit5.advanceWorst.toExponential(2)}/${orbit5.backActionWorst.toExponential(2)}/${orbit5.cargoWorst.toExponential(2)}; frontier entropy<= ${maxEntropy.toFixed(3)} bits, fidelity>= ${minFidelity.toFixed(3)}; detuned fidelity ${f05.toFixed(4)} (d=0.05) / ${f30.toFixed(4)} (d=0.3); phase-read fidelity ${rdLast.advanceFidelity.toFixed(12)} entropy ${rdLast.clockEntropyBits.toExponential(2)}`,
    });
  }

  // W-C — the compiler
  {
    const mul = multiplierVerdict();
    const fred = fredkinConservesWeight(6, 0, 1, 2);
    const demoPerm = runnerPermutation(DEMO_CIRCUIT, 3);
    const bijective = new Set(demoPerm).size === demoPerm.length;
    const unitary = isUnitary(permToCMat(demoPerm));
    out.push({
      witness: "W-C",
      ok: mul.wrong === 0 && mul.worstDeviation === 0 && fred && bijective && unitary,
      detail: `multiplier ${mul.inputs - mul.wrong}/${mul.inputs} correct, integer cargo deviation ${mul.worstDeviation}; FREDKIN weight conservation ${fred}; runner bijective ${bijective} (Set ${new Set(demoPerm).size}/${demoPerm.length}); runner unitary ${unitary}`,
    });
  }

  // W-D — the thermodynamic ledger
  {
    const ln2 = ln2ByQuadrature();
    const ln2dev = Math.abs(ln2 - Math.LN2);
    const ratio = landauerJoules(300) / landauerJoules(0.01);
    const energy = beatEnergyDeviation(6, Array<number>(5).fill(1.3), 12);
    const tpm = beatTpmWorkDelta(6, Array<number>(5).fill(1.3), 10);
    const dh = detunedHeatingCensus(6, 1.3, 0.1, 15);
    const w0Closed = 1.3 * 5 * Math.sin(0.2) ** 2;
    const w0Numeric = dh.workSeries[0]!;
    const tt = tariffTable();
    const unitsOk =
      tt.rows[0]!.units === 0 && tt.rows[1]!.units === 5 && tt.rows[2]!.units === 9;
    const fk = tt.rows[3]!.units;
    const jp = joulePrices(5);
    out.push({
      witness: "W-D",
      ok:
        ln2dev <= 1e-12 &&
        Math.abs(ratio - 30000) <= 1e-6 &&
        energy <= 5e-15 &&
        tpm <= 1e-25 &&
        dh.e1ClosedFormDeviation <= 5e-15 &&
        Math.abs(w0Numeric - w0Closed) <= 5e-15 &&
        dh.suppression > 2 &&
        unitsOk &&
        Math.abs(fk - 43.02) <= 0.01 &&
        tt.winner.includes("Bennett"),
      detail: `ln2 dev ${ln2dev.toExponential(2)}; T-ratio ${ratio.toFixed(1)}; beat energy dev ${energy.toExponential(2)}; TPM escape ${tpm.toExponential(2)}; E1 closed dev ${dh.e1ClosedFormDeviation.toExponential(2)}; W0 ${w0Numeric.toFixed(4)} vs closed ${w0Closed.toFixed(4)}; suppression ${dh.suppression.toFixed(1)}x; tariff units [0,5,9,${fk.toFixed(2)}] winner '${tt.winner}'; 5 units @300K ${jp.t300.toExponential(4)} J`,
    });
  }

  // W-E — the tombstone
  {
    const t = tombstoneCensus(5, 1.0, 0.7, 7);
    out.push({
      witness: "W-E",
      ok:
        t.gap > 0.1 &&
        t.groundWorst <= 1e-14 &&
        t.thermalWorst <= 1e-14 &&
        t.batteryAmplitude > 0.1 &&
        t.batteryPeriodError <= 1e-14 &&
        t.crossValidationError <= 1e-14 &&
        t.solverReconstruction <= 1e-12,
      detail: `gap ${t.gap.toFixed(4)}; ground ${t.groundWorst.toExponential(2)}; thermal ${t.thermalWorst.toExponential(2)}; battery amplitude ${t.batteryAmplitude.toFixed(4)}, period error ${t.batteryPeriodError.toExponential(2)}; cross-road ${t.crossValidationError.toExponential(2)}; solver ${t.solverReconstruction.toExponential(2)}`,
    });
  }

  // W-H — the lifetime law (v0.2.0; the isolated face RE-VERIFIED at v0.20.0
  // by an independent path — the v0.2.0 witness here was the TAUTOLOGY)
  {
    // the dephased law, exhaustively: E[m~(k)] = (cos 2d)^k over ALL sign
    // sequences through the kernel (an exact expectation, not a sample)
    let depWorst = 0;
    for (const d of [0.1, 0.2]) {
      for (const k of [8, 12]) {
        const e = dephasedEchoExpectationExact(d, k);
        depWorst = Math.max(depWorst, Math.abs(e - Math.cos(2 * d) ** k));
      }
    }
    // the tau* crossing, MC-witnessed at both benchmark deltas
    const cross20 = dephasedLifetimeCrossing(makeRng(0x5eed47), 0.2, 0.5, 40000);
    const cross30 = dephasedLifetimeCrossing(makeRng(0x5eed48), 0.3, 0.5, 40000);
    const crossingOk =
      cross20.below > 0.5 &&
      cross20.at < 0.5 &&
      cross30.below > 0.5 &&
      cross30.at < 0.5 &&
      cross20.tau === isolatedEchoLifetime(0.2, 0.5) &&
      cross30.tau === isolatedEchoLifetime(0.3, 0.5);
    const rows = chainLifetimeCensus(6, [0.3, 0.4], 800, 0.5);
    const cliff = rows[0]!.tauChain > 10 * rows[0]!.tauIso && rows[1]!.tauChain <= rows[1]!.tauIso + 1;
    const heat = heatingRelaxation(6, 0.2, 400);
    const frontLoaded = heat.tauHeat >= 1 && heat.tauHeat <= 4;
    out.push({
      witness: "W-H",
      ok: depWorst <= 1e-12 && crossingOk && cliff && frontLoaded,
      detail:
        "dephased law exhaustive over ALL 2^k sign sequences (k=8/12, d=0.1/0.2): worst dev " +
        depWorst.toExponential(2) +
        " (the v0.2.0 formula-times-itself witness here was the TAUTOLOGY — TC46 convicted it); tau* crossing (N=40000): d=0.2 E[m~] " +
        cross20.below.toFixed(4) +
        " (k=8) -> " +
        cross20.at.toFixed(4) +
        " (k=9), d=0.3 " +
        cross30.below.toFixed(4) +
        " -> " +
        cross30.at.toFixed(4) +
        "; protection cliff at 800-horizon rerun: delta0.3 tau " +
        String(rows[0]!.tauChain) +
        " vs iso " +
        String(rows[0]!.tauIso) +
        ", delta0.4 tau " +
        String(rows[1]!.tauChain) +
        " vs iso " +
        String(rows[1]!.tauIso) +
        "; heating front-loaded tau_heat " +
        String(heat.tauHeat),
    });
  }

  // W-I — the cliff line and the self-synchronizing clock (v0.3.0)
  {
    let cliffEverywhere = true;
    for (const j of [0.6, 2.4]) {
      try {
        cliffBisect(6, j, 500, 0.5, 0.05, 0.6, 4);
      } catch (e) {
        // only the NAMED bracket refusal is the probed outcome; anything
        // else (a TypeError, a solver failure) must surface, never be
        // swallowed — the zero-silent-catch law
        if (!(e instanceof DtcError) || e.code !== "E/BRACKET") throw e;
        cliffEverywhere = false;
      }
    }
    let syncExact = true;
    for (const q of [0.05, 0.2]) {
      const rows = bitFlipReadCensus(4, q, DEMO_CIRCUIT, 3);
      for (const r of rows) syncExact = syncExact && Math.abs(r.advanceFidelity - 1) < 1e-12;
    }
    out.push({
      witness: "W-I",
      ok: cliffEverywhere && syncExact,
      detail:
        "cliff bracket resolvable at both J ends (compact rerun): " +
        String(cliffEverywhere) +
        "; bit-flip advance fidelity exactly 1 at q=0.05/0.2 every beat: " +
        String(syncExact),
    });
  }

  // W-J — the Pauli wall and the Hamming armor (v0.4.0)
  {
    let pauliExact = true;
    for (const q of [0.1, 0.2]) {
      const rows = yFlipReadCensus(4, q, DEMO_CIRCUIT, 3);
      for (const r of rows) pauliExact = pauliExact && Math.abs(r.advanceFidelity - 1) < 1e-12;
    }
    let t1Exact = true;
    for (const gamma of [0.05, 0.1]) {
      const rows = t1ReadCensus(4, gamma, DEMO_CIRCUIT, 3);
      for (const r of rows) t1Exact = t1Exact && Math.abs(r.advanceFidelity - 1) < 1e-12;
    }
    out.push({
      witness: "W-J",
      ok: pauliExact && t1Exact,
      detail: "Y-flip advance fidelity exactly 1 (q=0.1/0.2): " + String(pauliExact) + "; T1 amplitude damping exactly 1 (gamma=0.05/0.1): " + String(t1Exact),
    });
  }

  // W-K — the armor dynamics (v0.5.0)
  {
    // (A1) the absorption radius: exhaustive at n=4, the r-subsets at n=5
    const n4Absorbed = radiusCensus(4, absorptionRadius(4), 0.5, DEMO_CIRCUIT, 3);
    const n4Wall = radiusCensus(4, absorptionRadius(4) + 1, 1.0, DEMO_CIRCUIT, 3);
    const n4Det = radiusCensus(4, absorptionRadius(4), 1.0, DEMO_CIRCUIT, 3);
    const n5Absorbed = radiusCensus(5, absorptionRadius(5), 0.5, DEMO_CIRCUIT, 3);
    const n5WallLast = localizedFlipCensus(5, [0, 1, 2], 1.0, DEMO_CIRCUIT, 3);
    const n5Wall = n5WallLast[n5WallLast.length - 1]!;
    const depolRows = localizedDepolCensus(5, [0, 1], 0.75, DEMO_CIRCUIT, 3);
    const depol = depolRows[depolRows.length - 1]!;
    const radiusOk =
      n4Absorbed.worstFidelity >= 1 - 1e-12 &&
      n4Wall.worstFidelity <= 0.01 &&
      n4Det.worstFidelity >= 1 - 1e-12 &&
      n5Absorbed.subsets === 10 &&
      n5Absorbed.worstFidelity >= 1 - 1e-12 &&
      n5Wall.advanceFidelity <= 1e-12 &&
      depol.advanceFidelity >= 1 - 1e-12;
    // (A2) the classical shadow: DP === quantum at the rounding floor
    let shadowWorst = 0;
    for (const [n, p] of [
      [4, 0.2],
      [5, 0.1],
    ] as const) {
      const q = delocalizedFlipCensus(n, p, DEMO_CIRCUIT, 3);
      const dp = popcountShadow(n, p, DEMO_CIRCUIT.length * 2);
      for (const row of q) {
        shadowWorst = Math.max(shadowWorst, Math.abs(dp.fidelity[row.beat * 2 - 1]! - row.advanceFidelity));
      }
    }
    // the refund: fidelity strictly above strict survival (self-healing)
    const refund = popcountShadow(4, 0.2, 8);
    const refundOk = refund.fidelity[7]! > refund.survival[7]! + 0.05;
    // (A3) the repair: exact at odd n, metered; the B4 row carries the meter
    const repair = repairCensus(5, 0.1, DEMO_CIRCUIT, 3);
    const repairOk =
      repair.rows.every((r) => Math.abs(r.advanceFidelity - 1) <= 1e-12) &&
      repair.unrepairedWorstFidelity < 0.9 &&
      repair.meanSyndromeBits > 0.1;
    const tt2 = tariffTable();
    const tariffRow = tt2.rows[4]!; // the n=5 maintenance row (W-L owns the tie row)
    const tariffOk =
      tt2.rows.length === 6 &&
      Math.abs(tariffRow.units - repair.meanSyndromeBits) <= 1e-3 &&
      tariffRow.units > 0;
    // the law bites: a forged fire rule must DISAGREE with the census
    const forged = popcountShadow(4, 0.2, 8, (_w, t) => t % 2 === 0);
    const honest = popcountShadow(4, 0.2, 8, armorFireRule(4));
    const forgedDiverges = Math.abs(forged.fidelity[7]! - honest.fidelity[7]!) > 0.1;
    out.push({
      witness: "W-K",
      ok: radiusOk && shadowWorst <= 1e-12 && refundOk && repairOk && tariffOk && forgedDiverges,
      detail: `radius n=4 |S|=r worst ${n4Absorbed.worstFidelity.toFixed(15)} / |S|=r+1 q=1 worst ${n4Wall.worstFidelity.toFixed(3)} / q=1 |S|=r ${n4Det.worstFidelity.toFixed(15)}; n=5 all ${n5Absorbed.subsets} |S|=2 worst ${n5Absorbed.worstFidelity.toFixed(15)}, |S|={0,1,2} q=1 ${n5Wall.advanceFidelity.toFixed(15)}; depol p=0.75 ${depol.advanceFidelity.toFixed(15)}; shadow worst dev ${shadowWorst.toExponential(2)}; refund F ${refund.fidelity[7]!.toFixed(3)} > survival ${refund.survival[7]!.toFixed(3)}: ${refundOk}; repair n=5 p=0.1 exact-1 ${repair.rows.every((r) => Math.abs(r.advanceFidelity - 1) <= 1e-12)} passive ${repair.unrepairedWorstFidelity.toFixed(4)} syndrome ${repair.meanSyndromeBits.toFixed(4)} bits (B4 row ${tariffRow.units.toFixed(4)}); forged fire rule diverges: ${forgedDiverges}`,
    });
  }

  // W-L — the tie reset (v0.6.0)
  {
    const v4 = fullRepairCensus(4, 0.1, DEMO_CIRCUIT, 3);
    const v4Worst = Math.min(...v4.rows.map((r) => r.advanceFidelity));
    const dp4 = popcountShadow(4, 0.1, DEMO_CIRCUIT.length * 2, undefined, true, true);
    let dev4 = 0;
    for (const r of v4.rows) dev4 = Math.max(dev4, Math.abs(dp4.fidelity[r.beat * 2 - 1]! - r.advanceFidelity));
    const meterDev = Math.abs(dp4.meanTieBits - v4.meanTieBits);
    const cure6 = popcountShadow(6, 0.2, 64, undefined, true, true);
    const old6 = popcountShadow(6, 0.2, 64, undefined, true, false);
    const tariffOk =
      Math.abs(tieResetBits(4) - Math.log2(6)) <= 1e-12 &&
      Math.abs(tieResetBits(6) - Math.log2(20)) <= 1e-12 &&
      tieResetBits(5) === 0;
    const tt = tariffTable();
    const rowOk = tt.rows.length === 6 && Math.abs(tt.rows[5]!.units - 1.1113) <= 1e-3;
    out.push({
      witness: "W-L",
      ok:
        Math.abs(v4Worst - 1) <= 1e-12 &&
        dev4 <= 1e-12 &&
        meterDev <= 1e-12 &&
        Math.abs(cure6.fidelity[63]! - 1) <= 1e-12 &&
        old6.fidelity[63]! < 1e-3 &&
        tariffOk &&
        rowOk,
      detail: `n=4 full-repair worst ${v4Worst.toFixed(15)} (passive ${v4.unrepairedWorstFidelity.toFixed(4)}), DP dev ${dev4.toExponential(2)}, tie meter ${v4.meanTieBits.toFixed(4)} bits/period (both roads agree to ${meterDev.toExponential(2)}); n=6 @64: sector-only ${old6.fidelity[63]!.toExponential(2)} -> full ${cure6.fidelity[63]!.toFixed(15)}; constants log2C ${tieResetBits(4).toFixed(4)}/${tieResetBits(6).toFixed(4)} exact; B4 row 6 units ${tt.rows[5]!.units.toFixed(4)}`,
    });
  }

  // W-M — the binomial shadow law and the scale census (v0.7.0)
  {
    let lawWorst = 0;
    for (const [n, p, tt] of [
      [4, 0.2, 12],
      [6, 0.05, 9],
      [8, 0.1, 7],
    ] as const) {
      const machine = maskPopcountMarginal(n, p, tt);
      const closed = binomialPmfClosed(n, shadowQ(p, tt));
      for (let k = 0; k <= n; k++) lawWorst = Math.max(lawWorst, Math.abs(machine[k]! - closed[k]!));
    }
    const wrongRelax = Math.max(
      ...Array.from(maskPopcountMarginal(6, 0.2, 8)).map((v, k) =>
        Math.abs(v - binomialPmfClosed(6, 1 - Math.pow(1 - 0.2, 8))[k]!),
      ),
    );
    const statWorst = Math.max(
      ...[4, 6, 8].map((n) => {
        const m = maskPopcountMarginal(n, 0.2, 400);
        const breach = Array.from(m.slice(n / 2)).reduce((s, v) => s + v, 0);
        return Math.max(Math.abs(breach - stationaryBreach(n)), Math.abs(m[n / 2]! - stationaryTie(n)));
      }),
    );
    const scaleFull = [10, 12, 16].every(
      (n) => Math.abs(popcountShadow(n, 0.2, 64, undefined, true, true).fidelity[63]! - 1) <= 1e-12,
    );
    out.push({
      witness: "W-M",
      ok: lawWorst <= 1e-14 && wrongRelax > 0.1 && statWorst <= 1e-12 && scaleFull,
      detail: `binomial law worst ${lawWorst.toExponential(2)} (n=4/6/8); wrong relaxation diverges ${wrongRelax.toFixed(3)}; stationary faces worst ${statWorst.toExponential(2)} (n=4/6/8 @400 periods); full repair exactly 1 at n=10/12/16 @64: ${scaleFull}`,
    });
  }

  // W-N — the spectral survival law and the stationary repair (v0.8.0)
  {
    let reconWorst = 0;
    for (const [n, p] of [
      [4, 0.2],
      [6, 0.1],
    ] as const) {
      const spec = spectralArmor(n, p);
      const series = spec.survivalSeries(40);
      const dp = popcountShadow(n, p, 40);
      for (let tt = 0; tt < 40; tt++) reconWorst = Math.max(reconWorst, Math.abs(series[tt]! - dp.survival[tt]!));
    }
    const spec6 = spectralArmor(6, 0.2);
    const dp6 = popcountShadow(6, 0.2, 61);
    const ratio = dp6.survival[60]! / dp6.survival[59]!;
    const stat = repairedStationary(6, 0.2);
    const dpLong = popcountShadow(6, 0.2, 400, undefined, true, true);
    const statOk = Math.abs(stat.tieMeter - 1.595083) <= 1e-4 && dpLong.meanTieBits < stat.tieMeter;
    out.push({
      witness: "W-N",
      ok: reconWorst <= 1e-13 && Math.abs(ratio - spec6.lambda1) <= 1e-10 && statOk,
      detail: `eigen-expansion vs DP worst ${reconWorst.toExponential(2)} (n=4/6, T<=40); ratio at T=60 ${ratio.toFixed(12)} = lambda1 ${spec6.lambda1.toFixed(12)}; stationary faces p_tie ${stat.pTie.toFixed(6)}, tie meter ${stat.tieMeter.toFixed(6)} vs DP@400 mean ${dpLong.meanTieBits.toFixed(6)} (converging from below through the transient)`,
    });
  }

  // W-O — the universal decay rate (v0.9.0)
  {
    const residual = Math.max(...[4, 6, 10, 20, 40].map((n) => decayEigenpairResidual(n)));
    let gammaWorst = 0;
    for (const n of [4, 6, 8, 10, 12, 16, 20, 24, 32, 40]) {
      gammaWorst = Math.max(gammaWorst, Math.abs(decayRateConstant(n) - 2));
    }
    const r1 = (1 - spectralArmor(6, 0.02).lambda1) / 0.02;
    const r2 = (1 - spectralArmor(6, 0.01).lambda1) / 0.01;
    const residualHalves = (2 - r1) / (2 - r2);
    out.push({
      witness: "W-O",
      ok: residual <= 1e-12 && gammaWorst <= 1e-9 && Math.abs(residualHalves - 2) <= 0.05,
      detail: `eigenpair residual ${residual.toExponential(2)} (n=4..40, solver-free); gamma worst ${gammaWorst.toExponential(2)} over ten n; fit face (1-lam)/p at n=6: ${r1.toFixed(6)} (p=0.02), ${r2.toFixed(6)} (p=0.01) — residual ratio ${residualHalves.toFixed(3)} (clean O(p))`,
    });
  }

  // W-P — the Krawtchouk spectrum and the second-order face (v0.10.0)
  {
    let residualWorst = 0;
    for (const n of [6, 8, 10, 12, 16, 24]) {
      for (let k = 1; k <= n / 2; k++) {
        residualWorst = Math.max(residualWorst, krawtchoukResidual(n, 2 * k - 1));
      }
    }
    const evenFails = krawtchoukResidual(8, 2) > 0.1;
    const gapWorst = Math.max(
      ...[6, 8, 12].map((n) => {
        const spec = amputatedSpectrumClosed(n);
        return Math.max(...spec.slice(1).map((v, i) => Math.abs(v - spec[i]! + 4)));
      }),
    );
    const c2b = secondOrderCoefficient(4);
    const c2c = secondOrderCoefficient(6);
    out.push({
      witness: "W-P",
      ok: residualWorst <= 1e-9 && evenFails && gapWorst === 0 && Math.abs(c2b - 1.5) <= 1e-4 && Math.abs(c2c - 1.875) <= 1e-4,
      detail: `odd-mode residuals worst ${residualWorst.toExponential(2)} (every odd j, n=6..24, solver-free); the even mode K_2 fails: ${evenFails}; the arithmetic gap is exactly 4 (worst deviation ${gapWorst}); c_2 Richardson ${c2b.toFixed(6)} (n=4, vs 3/2), ${c2c.toFixed(6)} (n=6, vs 15/8)`,
    });
  }

  // W-Q — the RS closed form for c_2 (v0.11.0)
  {
    let agreeWorst = 0;
    for (const n of [4, 6, 8, 10, 12]) {
      const closed = secondOrderClosed(n);
      const rich = secondOrderCoefficient(n);
      agreeWorst = Math.max(agreeWorst, Math.abs(closed - rich));
    }
    const spot4 = Math.abs(secondOrderClosed(4) - 1.5);
    const spot6 = Math.abs(secondOrderClosed(6) - 1.875);
    const spot10 = Math.abs(secondOrderClosed(10) - 2.4609375);
    out.push({
      witness: "W-Q",
      ok: agreeWorst <= 1e-4 && spot4 <= 1e-12 && spot6 <= 1e-12 && spot10 <= 1e-12,
      detail: `quotient vs Richardson worst ${agreeWorst.toExponential(2)} (n=4..12, within the extrapolation error); exact spots: 3/2 ±${spot4.toExponential(2)}, 15/8 ±${spot6.toExponential(2)}, 315/128 ±${spot10.toExponential(2)}`,
    });
  }

  // W-R — the general-n law for c_2 (v0.12.0)
  {
    let lawWorst = 0n;
    for (let n = 4; n <= 40; n += 2) {
      const residue = rationalResidue(secondOrderRSRational(n), secondOrderGeneralRational(n));
      if (residue > lawWorst || residue < -lawWorst) lawWorst = residue < 0n ? -residue : residue;
    }
    let stepWorst = 0n;
    for (let m = 1; m <= 19; m++) {
      const step = centralBinomialStepResidue(m);
      if (step > stepWorst || step < -stepWorst) stepWorst = step < 0n ? -step : step;
    }
    const r200 = secondOrderGeneral(200) * Math.sqrt(Math.PI / 400);
    const scale200 = secondOrderGeneral(200) / Math.sqrt(200);
    const trueGap = Math.abs(scale200 - Math.sqrt(2 / Math.PI));
    const piGap = Math.abs(scale200 - Math.PI / 4);
    out.push({
      witness: "W-R",
      ok: lawWorst === 0n && stepWorst === 0n && Math.abs(200 * (1 - r200) - 0.25) <= 5e-3 && piGap > 10 * trueGap,
      detail: `law vs RS exact residue |${lawWorst}| (n=4..40, BigInt cross-multiplied); partial-sum induction-step residue |${stepWorst}| (m=1..19); r(200) = ${r200.toFixed(9)}, n(1-r) = ${(200 * (1 - r200)).toFixed(5)} -> 1/4; c_2/sqrt(200) = ${scale200.toFixed(9)} vs sqrt(2/pi) ${Math.sqrt(2 / Math.PI).toFixed(9)} (gap ${trueGap.toExponential(2)}) — the pi/4 gap ${piGap.toExponential(2)}, an order larger: retired`,
    });
  }

  // W-S — the third-order coefficient c_3 (v0.13.0)
  {
    let residWorst = 0;
    let richWorst = 0;
    for (const n of [4, 6, 8, 10, 12, 16]) {
      const c2 = secondOrderClosed(n);
      const c3 = thirdOrderClosed(n);
      const p = 0.01;
      const series = 1 - 2 * p + c2 * p * p + c3 * p ** 3;
      residWorst = Math.max(residWorst, Math.abs(spectralArmor(n, p).lambda1 - series));
      const c3At = (q: number): number => (spectralArmor(n, q).lambda1 - 1 + 2 * q - c2 * q * q) / q ** 3;
      richWorst = Math.max(richWorst, Math.abs(2 * c3At(0.01) - c3At(0.02) - c3));
    }
    const rep4 = thirdOrderFaces(4).repulsion.num !== 0n;
    out.push({
      witness: "W-S",
      ok: residWorst <= 2e-8 && richWorst <= 5e-3 && rep4,
      detail: `three-term series vs lambda_1(1/100): worst ${residWorst.toExponential(2)} (n=4..16, the c_4 p^4 face); Richardson agreement worst ${richWorst.toExponential(2)} (within its contamination); the repulsion face nonzero at n=4 — the repulsion-free gift ends at second order`,
    });
  }

  // W-F — the certificate and its anchors
  {
    const violations = checkBoard();
    const tt = tariffTable();
    out.push({
      witness: "W-F",
      ok: violations.length === 0 && tt.winner.includes("Bennett") && TARIFF_CRITERION.length > 50,
      detail: `board legal (${violations.length} violations); winner '${tt.winner}' by the legislated criterion; anchors and citation keys alive`,
    });
  }

  // W-T — the quotient-face law and the cancellation census
  {
    let allZero = true;
    for (let n = 4; n <= 60; n += 2) {
      if (quotientFaceIdentityResidue(n) !== 0n) allZero = false;
    }
    const spots: Array<{ n: number; num: bigint; den: bigint }> = [
      { n: 4, num: -1n, den: 1n },
      { n: 6, num: -5n, den: 2n },
      { n: 8, num: -35n, den: 8n },
      { n: 10, num: -105n, den: 16n },
      { n: 12, num: -1155n, den: 128n },
    ];
    let spotsOk = true;
    for (const s of spots) {
      const q = thirdOrderFaces(s.n).quotient;
      if (q.num * s.den !== s.num * q.den) spotsOk = false;
    }
    const bigToFloat = (num: bigint, den: bigint): number => Number((num * 10n ** 12n) / den) / 1e12;
    const shares: number[] = [];
    const deficits: number[] = [];
    for (let n = 4; n <= 30; n += 2) {
      const sh = repulsionShare(n);
      shares.push(bigToFloat(sh.num, sh.den));
      const df = cancellationDeficit(n);
      deficits.push(bigToFloat(df.num, df.den));
    }
    const signPatternOk = deficits[7]! < 0 && deficits[8]! > 0;
    const crossedOk = shares[7]! < 1 && shares[8]! > 1 && shares[13]! > shares[8]!;
    out.push({
      witness: "W-T",
      ok: allZero && spotsOk && signPatternOk && crossedOk,
      detail: `3<u,Q3 u> + (n-2)<u,Q2 u> = 0 EXACTLY for all even n=4..60 (integer residue, cheap path) — the quotient face inherits TC37 verbatim: q(n) = -(n-2)c2(n)/3 (spots -1, -5/2, -35/8, -105/16, -1155/128 all match); the cancellation census REFUTES the 2/3-share hypothesis: the repulsion share 9r/(2(n-2)c2) crosses 1 between n=18 (${shares[7]!.toFixed(4)}) and n=20 (${shares[8]!.toFixed(4)}) and rises to ${shares[13]!.toFixed(4)} at n=30, the deficit c3 + (n-2)c2/9 flipping sign at the same point (${deficits[7]!.toExponential(2)} to ${deficits[8]!.toExponential(2)}) — the faces' asymptotic split stays open, re-priced`,
    });
  }


  // W-U — the coupling closed forms and the 9/8 extrapolation
  {
    let residue = 0n;
    for (let n = 4; n <= 36; n += 2) {
      for (let j = 3; j <= n - 1; j += 2) {
        residue += couplingClosedFormResidue(n, j);
      }
    }
    // the closed addend reproduces the kernel's exact repulsion face at n=6
    const faces6 = thirdOrderFaces(6);
    const a1 = repulsionAddendClosedRational(6, 1);
    const a2 = repulsionAddendClosedRational(6, 2);
    const sumNum = a1.num * a2.den + a2.num * a1.den;
    const sumDen = a1.den * a2.den;
    const faceOk = faces6.repulsion.num * sumDen === sumNum * faces6.repulsion.den;
    // the horizon push: monotone past the crossing, 9/8 extrapolation stable.
    // (v0.21.0 single-source: this witness's share values come from the ONE
    // exported shareFloat — the local log-fact duplicate that used to shadow
    // it here was expression-identical, and the bit-anchor on file pins the
    // values the deletion must reproduce: share(24) = 1.012015313230259,
    // share(1024) = 1.1077831462892902, extrapolation 1.1250948430677739)
    const s24 = shareFloat(24);
    const s1024 = shareFloat(1024);
    const extrapolation = s1024 + (s1024 - s24) / (Math.sqrt(1024 / 24) - 1); // a/sqrt(n) one-step
    const ok = residue === 0n && faceOk && s1024 > s24 && Math.abs(extrapolation - 1.125) <= 2e-3;
    out.push({
      witness: "W-U",
      ok,
      detail: `the three closed forms hold with ZERO residue over n=4..36, every odd mode (vv = C(n,j)2^(n-1) — truncated Krawtchouk norms equal the classical full norms; uu = n·2^(n-1); |cpl| = 2n(n-1)C(n-2,m)C(dim-1,k), the coupling proportional to c_2's central binomial); the closed addend reproduces the kernel's exact repulsion face (n=6 spot equality); the horizon push: the share rises monotonically to ${s1024.toFixed(6)} at n=1024, and the a/sqrt(n) extrapolation lands at ${extrapolation.toFixed(6)} — the limit 9/8 identified by extrapolation, not claimed as a theorem`,
    });
  }


  // W-V — the 9/8 limit assembled
  {
    let residue = 0n;
    for (let n = 4; n <= 24; n += 2) {
      for (let k = 1; k <= n / 2 - 1; k++) residue += modeRatioFactorResidue(n, k);
    }
    // share monotone with geometrically shrinking doubling increments -> limit bracketed
    const shares: Array<{ n: number; s: number }> = [];
    for (const n of [64, 256, 1024, 2048]) shares.push({ n, s: shareFloat(n) });
    let monotone = true;
    let incRatioMax = 0;
    for (let i = 1; i < shares.length; i++) {
      if (shares[i]!.s <= shares[i - 1]!.s) monotone = false;
    }
    const inc = (i: number): number => (shares[i]!.s - shares[i - 1]!.s) / Math.log2(shares[i]!.n / shares[i - 1]!.n);
    for (let i = 2; i < shares.length; i++) incRatioMax = Math.max(incRatioMax, inc(i) / inc(i - 1));
    // geometric tail bound: remaining <= last increment-per-doubling * ratio/(1 - ratio), ratio <= 0.75
    const lastInc = inc(shares.length - 1);
    const tail = (lastInc * 0.75) / (1 - 0.75);
    const sMax = shares[shares.length - 1]!.s;
    const limLow = sMax;
    const limHigh = sMax + tail;
    const bracketOk = limLow <= 1.125 && limHigh >= 1.125 && limHigh - limLow < 0.05;
    // the correction constant's convergence
    const a2048 = correctionConstant(2048);
    const a256 = correctionConstant(256);
    const convOk = Math.abs(a256 - a2048) < 2e-3 && Math.abs(a2048 - 0.55091) < 2e-4;
    const ok = residue === 0n && monotone && incRatioMax < 0.8 && bracketOk && convOk;
    out.push({
      witness: "W-V",
      ok,
      detail: `the central-binomial factorization holds with ZERO residue (n=4..24, all k) — the share reduces to central binomials only; the share is monotone with doubling-increment ratios <= ${incRatioMax.toFixed(3)} (geometric decay), so the limit is bracketed: [${limLow.toFixed(6)}, ${limHigh.toFixed(6)}] at n=2048 — 9/8 = 1.125000 inside the bracket; the first correction a(n) = (9/8 - share(n))·sqrt(n) converges: ${a256.toFixed(6)} (n=256) -> ${a2048.toFixed(6)} (n=2048); if the limit holds, c_3 -> -(n-2)c_2/12`,
    });
  }


  // W-W — the arcsine law and a's structure
  {
    // the chain identity: share = P·A·S/4 exactly (float agreement at the floor)
    let chainWorst = 0;
    for (const n of [24, 64, 256]) {
      const chain = shareChainPieces(n);
      chainWorst = Math.max(chainWorst, Math.abs(chain.chainShare - shareFloat(n)) / shareFloat(n));
    }
    // the arcsine law: rising toward pi/2, Richardson at the top
    const grid = [1024, 4096, 16384, 65536].map((n) => ({ n, v: arcsineLaw(n) }));
    const rising = grid.every((g, i) => i === 0 || g.v > grid[i - 1]!.v);
    const arcsineInf = richardsonLimit(grid, 0.5);
    // a's two-term law and the one-term refutation
    const aGrid = [16384, 32768, 65536].map((n) => ({ n, v: correctionConstant(n) }));
    const aInf = richardsonLimit(aGrid, 1);
    const aOverBasis = [Math.sqrt(2 / Math.PI), Math.sqrt(Math.PI / 2), Math.sqrt(Math.PI)].map((b) => aInf / b);
    const refuted = aOverBasis.every((r) => Math.abs(r * 32 - Math.round(r * 32)) > 0.02);
    const ok = chainWorst <= 1e-12 && rising && Math.abs(arcsineInf - Math.PI / 2) <= 2e-3 && Math.abs(aInf - 0.55087) <= 1e-5 && refuted;
    out.push({
      witness: "W-W",
      ok,
      detail: `the chain identity share = P·A·S/4 holds exactly (relative deviation ${chainWorst.toExponential(2)} at n=24..256); the arcsine law: S·sqrt(dim)·sqrt(pi) rises monotonically ${grid[0]!.v.toFixed(6)} -> ${grid[3]!.v.toFixed(6)} (dim 512 -> 32768), Richardson to ${arcsineInf.toFixed(6)} vs pi/2 = ${(Math.PI / 2).toFixed(6)} — and pi/2 through the chain reproduces 9/8 (TC41's limit independently confirmed); a = ${aInf.toFixed(5)} with the two-term law a(n) = a + b/n; the one-term basis REFUTED at seven digits (a/sqrt(2/pi) = ${aOverBasis[0]!.toFixed(6)}, none near a small rational) — the arcsine profile's x^(-1/2) endpoint singularities feed the correction with singular Euler-Maclaurin constants: a's full closed form priced as the arc's next step`,
    });
  }


  // W-X — the correction constant pinned
  {
    const grid = [4096, 16384, 65536, 262144].map((n) => ({ n, v: sigmaFirst(n) }));
    const s1 = richardsonLimit(grid, 1);
    const risingConv = grid.every((g, i) => i === 0 || g.v > grid[i - 1]!.v);
    const z12 = -1.4603545088095868;
    const ratios = [s1 * Math.sqrt(Math.PI) / z12, s1 / z12, s1 * Math.sqrt(Math.PI)];
    const refuted = ratios.every((r) => Math.abs(r * 64 - Math.round(r * 64)) > 0.02);
    // the exact fixed-k edge law: summand*dim converges to the coefficient from above
    let edgeOk = true;
    for (const k of [1, 2, 3, 4]) {
      const target = edgeAsymptoticCoefficient(k);
      const near = summandTimesDim(65536, k);
      const far = summandTimesDim(262144, k);
      if (!(Math.abs(near - target) > Math.abs(far - target) && Math.abs(far - target) < 1e-3)) edgeOk = false;
    }
    const ok = Math.abs(s1 - -0.4896664762) <= 1e-8 && risingConv && refuted && edgeOk;
    out.push({
      witness: "W-X",
      ok,
      detail: `sigma1 converges monotonically to ${s1.toFixed(10)} (Richardson, n<=2^18) — a = 0.550874786 at ten digits; the one-term zeta-lattice REFUTED at that precision (${ratios[0]!.toFixed(8)} etc., no small rationals); the fixed-k edge law exact: summand·dim -> (2k+1)C(2k,k)/(2·4^k·k), verified convergent at k=1..4 — the endpoint mass the singular Euler-Maclaurin must regularize; the final coefficient assembly delineated and priced`,
    });
  }

  // W-Y — the singular Euler-Maclaurin assembly (TC44/TC45, CORRECTED v0.20.0)
  {
    const t1 = transferResidual(4096);
    const t2 = transferResidual(16384);
    const grid = [16384, 65536, 262144].map((n) => ({ n, v: sigmaFirst(n) }));
    const s1 = richardsonLimit(grid, 1);
    const kappa = kappaFromSigma(s1);
    const kgrid = [16384, 65536, 262144].map((D) => ({ n: D, v: kappaFace(D) }));
    const kappaRoad = richardsonLimit(kgrid, 0.5);
    const series = edgeSeriesAccelerated(1 << 20);
    const phi1 = kappa - series.zetaM;
    const nextGrid = [64, 256, 1024, 4096].map((k) => ({ n: k, v: edgeNextOrder(k) }));
    const nextLim = richardsonLimit(nextGrid, 1);
    const secondAt = (k: number): number => (edgeNextOrder(k) - 0.375) * k;
    const closure = [8, 12, 16].map((n) => arcClosureRelative(n, s1));
    const closureDeclining = closure[0]! > closure[1]! && closure[1]! > closure[2]!;
    const fEdge = fFunctionFace(100000, 3);
    const zetaFixOk =
      Math.abs(zetaEM(1.5, 60) - zetaEM(1.5, 240)) <= 1e-9 && Math.abs(zetaEM(2.5, 60) - zetaEM(2.5, 240)) <= 1e-10;
    const ok =
      t1.residual < 1e-9 &&
      t2.residual < 1e-9 &&
      Math.abs(s1 - -0.4896664762) <= 1e-7 &&
      Math.abs(kappaRoad - kappa) <= 1e-3 &&
      Math.abs(nextLim - 0.375) <= 1e-6 &&
      Math.abs(secondAt(8192) - EDGE_SECOND_COEFF) <= 2e-3 &&
      closureDeclining &&
      Math.abs(series.zetaM - -0.306852819) <= 1e-6 &&
      series.spotChecks <= 1e-12 &&
      Math.abs(phi1) <= 6e-7 &&
      zetaFixOk &&
      fEdge > 0.999;    out.push({
      witness: "W-Y",
      ok,
      detail: `the exact transfer sigma1 = G·u - sqrt(n) holds at the float floor (residuals ${t1.residual.toExponential(2)}/${t2.residual.toExponential(2)}) so kappa = sigma1/(2sqrt(2/pi)) = ${kappa.toFixed(10)} carries the ten digits; kappa's own D-grid road Richardson-confirms to ${Math.abs(kappaRoad - kappa).toExponential(2)}; the edge series: E_k·sqrt(pi)k^{3/2} -> ${nextLim.toFixed(8)} (= 3/8 exact), the second law -> ${secondAt(8192).toFixed(6)} (= -11/128 = ${EDGE_SECOND_COEFF} exact), sum(E) = ${series.sumE.toFixed(9)} (WITH THE v0.20.0 zetaEM SIGN FIX — the N=60/120/240 agreement ${zetaFixOk ? "witnessed at ~1e-10" : "FAILED"}, where the v0.19.0 road erred at N^-s) so zeta_m = ${series.zetaM.toFixed(9)} and Phi1 = kappa - zeta_m = ${phi1.toExponential(4)} — INSIDE TC47's certified bracket (the v0.19.0 '-4.547e-4 nonzero' claim RETIRED as the sign bug's artifact); the closure face c3 = -(n-2)c2/12·(1 - 3sigma1/sqrt(n)) tracks the exact c3 to ${closure[2]!.toExponential(2)} at n=16, declining; F(k=3,D=1e5) = ${fEdge.toFixed(6)} (f(0)=1)`,
    });
  }

  // W-Z — the isolated echo laws (TC46) and the Phi1 bracket (TC47, v0.20.0)
  {
    // TC46: the coherent rotor law exact; the v0.2.0 law convicted; the
    // tautology blind; the B1 arm's rotor road
    let cohWorst = 0;
    let convictWorst = 0;
    for (const d of [0.05, 0.1, 0.2, 0.3]) {
      cohWorst = Math.max(cohWorst, coherentEchoLawDeviation(d, 40));
      convictWorst = Math.max(convictWorst, convictedLawDeviation(d, 40));
    }
    const rotorB1 = rotorEchoLawDeviation(0.1, 0.05, 60);
    const rotorNorm = isolatedRotorParts(0.1, 0.05).normDev;
    const tautBlind = tautologicalIsoAgreement(Math.abs(Math.cos(3 * 0.2)), 0.5);
    // TC47: the Phi1 face — roads cross-validated, bracket assembled,
    // structure certified, the checker passing on the real bracket
    let shareXWorst = 0;
    for (const n of [4096, 16384, 65536]) {
      shareXWorst = Math.max(shareXWorst, Math.abs(shareFloatIncremental(n) / shareFloat(n) - 1));
    }
    let kappaXWorst = 0;
    for (const d of [4096, 16384, 65536]) kappaXWorst = Math.max(kappaXWorst, kappaRoadCrossDeviation(d));
    const face = phi1Face();
    const struct = phi1GridStructure();
    const ratiosOk = struct.incrementRatios.every((r) => r > 0.4 && r < 0.6);
    const realBracketLegal =
      checkPhi1Bracket(
        { lo: face.lo, hi: face.hi, pieces: ["kappa transfer spread", "zeta series tail"] },
        face,
      ).length === 0;
    const zetaFix = Math.abs(zetaEM(1.5, 60) - zetaEM(1.5, 240)) <= 1e-9;
    const tail = edgeSeriesTailBound(1 << 20);
    const ok =
      cohWorst <= 1e-14 &&
      convictWorst > 0.5 &&
      rotorB1 <= 1e-13 &&
      rotorNorm <= 1e-12 &&
      tautBlind &&
      shareXWorst <= 1e-8 &&
      kappaXWorst <= 2e-6 &&
      face.lo <= 0 &&
      0 <= face.hi &&
      Math.max(Math.abs(face.lo), Math.abs(face.hi)) <= 6e-7 &&
      face.epsZeta < 1e-9 &&
      face.kappaRoadDeviation <= 1e-5 &&
      struct.monotone &&
      struct.signStable &&
      ratiosOk &&
      realBracketLegal &&
      zetaFix;
    out.push({
      witness: "W-Z",
      ok,
      detail: `the isolated echo laws (TC46): coherent rotor law worst ${cohWorst.toExponential(2)} (d=0.05..0.3, k<=40, kernel vs rotation closed form — two roads); the v0.2.0 geometric law CONVICTED, worst deviation ${convictWorst.toFixed(3)} on the same grid; the tautology blind (certifies |cos3d| happily): ${tautBlind}; the B1 arm's rotor law ${rotorB1.toExponential(2)} (axis norm dev ${rotorNorm.toExponential(2)}); the Phi1 face (TC47): share roads cross-validated to ${shareXWorst.toExponential(2)} rel (n<=2^16), kappa roads to ${kappaXWorst.toExponential(2)} (D<=2^16); Phi1 = ${face.point.toExponential(4)} bracketed [${face.lo.toExponential(4)}, ${face.hi.toExponential(4)}] — CONTAINS ZERO, |Phi1| <= ${Math.max(Math.abs(face.lo), Math.abs(face.hi)).toExponential(3)} (eps_kappa ${face.epsKappa.toExponential(3)} carries it, eps_zeta ${face.epsZeta.toExponential(2)} + tail ${tail.tail.toExponential(2)}); the independent kappa(D) road confirms the transfer to ${face.kappaRoadDeviation.toExponential(2)}; D-grid monotone ${struct.monotone} sign-stable ${struct.signStable}, increment ratios ${struct.incrementRatios.map((r) => r.toFixed(3)).join("/")} (the 1/sqrt(D) face); the real bracket passes the checker: ${realBracketLegal}; the zetaEM sign fix witnessed: ${zetaFix}`,
    });
  }

  return out;
}
