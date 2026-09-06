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
 *       tariff — v0.5.0).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeRng } from "../core/rng.js";
import { BOARD, type BoardRow, type Family } from "./board.js";
import {
  alternationDeviation,
  chainLifetimeCensus,
  cliffBisect,
  flipIdentityDeviation,
  heatingRelaxation,
  isolatedEchoLifetime,
  pairingDeviations,
  rigidityCensus,
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
  delocalizedFlipCensus,
  localizedDepolCensus,
  localizedFlipCensus,
  popcountShadow,
  radiusCensus,
  repairCensus,
} from "./armor.js";

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
const WITNESSES = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-H", "W-I", "W-J", "W-K"] as const;

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

  // W-H — the lifetime law (v0.2.0)
  {
    let isoAgree = true;
    for (const d of [0.1, 0.2, 0.3]) {
      const tau = isolatedEchoLifetime(d, 0.5);
      const c = Math.abs(Math.cos(2 * d));
      let k = 0;
      let m = 1;
      while (m >= 0.5 && k < 100000) {
        k++;
        m *= c;
      }
      isoAgree = isoAgree && tau === k;
    }
    const rows = chainLifetimeCensus(6, [0.3, 0.4], 800, 0.5);
    const cliff = rows[0]!.tauChain > 10 * rows[0]!.tauIso && rows[1]!.tauChain <= rows[1]!.tauIso + 1;
    const heat = heatingRelaxation(6, 0.2, 400);
    const frontLoaded = heat.tauHeat >= 1 && heat.tauHeat <= 4;
    out.push({
      witness: "W-H",
      ok: isoAgree && cliff && frontLoaded,
      detail:
        "iso closed form === simulation (3 deltas); protection cliff at 800-horizon rerun: delta0.3 tau " +
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
      } catch {
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
    const tariffRow = tt2.rows[tt2.rows.length - 1]!;
    const tariffOk =
      tt2.rows.length === 5 &&
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

  return out;
}
