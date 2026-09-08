import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { makeRng } from "../src/core/rng.js";
import { isUnitary, mAdd, mMul, mDagger } from "../src/core/cmat.js";
import {
  alternationDeviation,
  chainLifetimeCensus,
  cliffBisect,
  coherentEchoLawDeviation,
  convictedLawDeviation,
  dephasedEchoExpectationExact,
  dephasedEchoMean,
  dephasedLifetimeCrossing,
  echoFloquet,
  flipIdentityDeviation,
  heatingRelaxation,
  isolatedEchoLifetime,
  isolatedRotorParts,
  maxAbs,
  pairingDeviations,
  rotorEchoLawDeviation,
  siteZ,
  tautologicalIsoAgreement,
  type EchoParams,
} from "../src/kernel/beat.js";
import {
  applyGate,
  classicalAfter,
  fredkinConservesWeight,
  multiplierCircuit,
  multiplierVerdict,
  permToCMat,
  runnerPermutation,
} from "../src/kernel/compile.js";
import { bitFlipReadCensus, orbitRun, t1ReadCensus, yFlipReadCensus } from "../src/kernel/clock.js";
import { detunedCensus } from "../src/kernel/clock.js";
import {
  kappaFace,
  transferResidual,
  kappaFromSigma,
  arcClosureRelative,
  edgeDiff,
  edgeMassRational,
  edgeNextOrder,
  edgeSeriesAccelerated,
  fFunctionFace,
  checkPhi1Bracket,
  kappaRoadCrossDeviation,
  phi1Face,
  phi1GridStructure,
  zetaEM,
} from "../src/kernel/assembly.js";
import { shareFloatIncremental } from "../src/kernel/armor.js";
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
  repairedStationary,
  repairCensus,
  decayRateConstant,
  decayEigenpairResidual,
  amputatedSpectrumClosed,
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
  binomialBig,
  centralBinomialStepResidue,
  centralBinomialSumRational,
  rationalResidue,
  shadowQ,
  spectralArmor,
  stationaryBreach,
  stationaryTie,
  tieResetBits,
} from "../src/kernel/armor.js";
import {
  K_BOLTZMANN,
  landauerJoules,
  ln2ByQuadrature,
  TARIFF_CRITERION,
  tariffTable,
} from "../src/kernel/thermo.js";
import { jacobiEigen, realSymmetricPack, tiHamiltonian, tombstoneCensus } from "../src/kernel/tombstone.js";
import { BOARD, type BoardRow } from "../src/kernel/board.js";
import { checkBoard, DEMO_CIRCUIT, runWitnesses } from "../src/kernel/audit.js";

const rng = makeRng(20260906);

describe("B1 the beat", () => {
  it("flip identity F+ Z F = -Z at theta=pi/2, h=0, random J", () => {
    const dev = flipIdentityDeviation(rng, 4, 3);
    assert.ok(dev <= 5e-15, `deviation ${dev}`);
  });

  it("negative control: detuned echo FAILS the flip identity (the witness bites)", () => {
    const p: EchoParams = {
      n: 4,
      theta: Math.PI / 2 + 0.1,
      fields: Array<number>(4).fill(0),
      couplings: [1.1, 0.9, 1.3],
    };
    const f = echoFloquet(p);
    const conj = mMul(mMul(mDagger(f), siteZ(4, 0)), f);
    const dev = maxAbs(mAdd(conj, siteZ(4, 0)));
    assert.ok(dev > 0.1, `detuned deviation ${dev} — the checker must convict`);
  });

  it("alternation m(k) = (-1)^k at the summation floor; pairing odd zero / even identity", () => {
    assert.ok(alternationDeviation(makeRng(7), 4, 3, 6) <= 1e-15);
    const pair = pairingDeviations(makeRng(11), 4, 3, 3);
    assert.ok(pair.odd <= 1e-25, `odd ${pair.odd}`);
    assert.ok(pair.even <= 1e-13, `even ${pair.even}`);
  });
});

describe("B3 the compiler", () => {
  it("multiplier: 16/16 correct, integer-exact cargo, self-resetting wrap", () => {
    const v = multiplierVerdict();
    assert.equal(v.wrong, 0);
    assert.equal(v.worstDeviation, 0);
  });

  it("independent classical spec agrees on every input", () => {
    const gates = multiplierCircuit();
    for (let x = 0; x < 16; x++) {
      const a = (((x >> 0) & 1) << 1) | ((x >> 1) & 1);
      const b = (((x >> 2) & 1) << 1) | ((x >> 3) & 1);
      const fin = classicalAfter(gates, x, gates.length);
      const product =
        (((fin >> 4) & 1) << 3) | (((fin >> 5) & 1) << 2) | (((fin >> 6) & 1) << 1) | ((fin >> 7) & 1);
      assert.equal(product, a * b, `x=${x}`);
    }
  });

  it("FREDKIN conserves Hamming weight; runner is a bijective unitary permutation", () => {
    assert.ok(fredkinConservesWeight(6, 0, 1, 2));
    const perm = runnerPermutation(DEMO_CIRCUIT, 3);
    assert.equal(new Set(perm).size, perm.length);
    assert.ok(isUnitary(permToCMat(perm)));
  });

  it("NOT/CNOT/TOFFOLI are involutions (the wrap replay undoes the program)", () => {
    const g = multiplierCircuit();
    for (let x = 0; x < 16; x++) {
      let y = x;
      for (const gate of g) y = applyGate(gate, y);
      let z = y;
      for (let i = g.length - 1; i >= 0; i--) z = applyGate(g[i]!, z);
      assert.equal(z, x, `round trip from x=${x}`);
    }
  });
});

describe("B2/B5 the clock register", () => {
  it("orbit: exact advance, zero back-action, exact cargo (n=4)", () => {
    const o = orbitRun(rng, 4, DEMO_CIRCUIT, 3, 2);
    assert.ok(o.advanceWorst <= 5e-15, `advance ${o.advanceWorst}`);
    assert.ok(o.backActionWorst <= 5e-15, `backAction ${o.backActionWorst}`);
    assert.ok(o.cargoWorst <= 5e-15, `cargo ${o.cargoWorst}`);
  });

  it("negative control: detuned advance fidelity decays (the frontier bites)", () => {
    const rows = detunedCensus(4, 0.3, DEMO_CIRCUIT, 3);
    const last = rows[rows.length - 1]!;
    assert.ok(last.advanceFidelity < 0.99, `fidelity ${last.advanceFidelity}`);
  });

  it("token probability on a clean run is a point mass (0 or 1 machine precision)", () => {
    const o = orbitRun(rng, 4, DEMO_CIRCUIT, 3, 1);
    assert.ok(o.advanceWorst <= 5e-15);
  });
});

describe("B4 the thermodynamic ledger", () => {
  it("ln2 quadrature vs library; k exact; temperature ratio exact", () => {
    assert.ok(Math.abs(ln2ByQuadrature() - Math.LN2) <= 1e-12);
    assert.equal(K_BOLTZMANN, 1.380649e-23);
    const ratio = landauerJoules(300) / landauerJoules(0.01);
    assert.ok(Math.abs(ratio - 30000) <= 1e-6, `ratio ${ratio}`);
  });

  it("tariff: units [0,5,9,43.02] + the v0.5.0 maintenance row, Bennett wins, criterion is fixed law", () => {
    const tt = tariffTable();
    assert.deepEqual(
      tt.rows.slice(0, 4).map((r) => r.units),
      [0, 5, 9, 43.02],
    );
    assert.equal(tt.rows.length, 6);
    assert.ok(tt.winner.includes("Bennett"));
    assert.ok(TARIFF_CRITERION.includes("fewest units wins"));
  });
});

describe("B6 the tombstone", () => {
  it("solver deed: V diag V^T reconstructs H", () => {
    const h = tiHamiltonian(4, 1.0, 0.7);
    const eig = jacobiEigen(realSymmetricPack(h), 16);
    let worst = 0;
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        let s = 0;
        for (let k = 0; k < 16; k++) s += eig.vectors[k * 16 + r]! * eig.values[k]! * eig.vectors[k * 16 + c]!;
        worst = Math.max(worst, Math.abs(s - h.re[r * 16 + c]!));
      }
    }
    assert.ok(worst <= 1e-12, `reconstruction ${worst}`);
  });

  it("full census at n=5: stationarity, battery, two-road agreement", () => {
    const t = tombstoneCensus(5, 1.0, 0.7, 7);
    assert.ok(t.groundWorst <= 1e-14);
    assert.ok(t.thermalWorst <= 1e-14);
    assert.ok(t.batteryAmplitude > 0.1);
    assert.ok(t.batteryPeriodError <= 1e-14);
    assert.ok(t.crossValidationError <= 1e-14);
  });
});

describe("v0.2.0 — the lifetime law (the isolated face re-verified at v0.20.0)", () => {
  it("TC18: the dephased law EXACT — exhaustive over ALL 2^k sign sequences, E[m~(k)] = (cos 2δ)^k", () => {
    for (const [d, k] of [
      [0.1, 8],
      [0.1, 12],
      [0.2, 8],
      [0.2, 12],
    ] as const) {
      const e = dephasedEchoExpectationExact(d, k);
      assert.ok(Math.abs(e - Math.cos(2 * d) ** k) <= 1e-12, `d=${d} k=${k}: ${e} vs ${Math.cos(2 * d) ** k}`);
    }
    assert.throws(() => dephasedEchoExpectationExact(0.1, 17), /exponential/);
  });

  it("TC18: the tau* crossing, MC-witnessed — E[m~] above theta at tau*-1, below at tau*", () => {
    for (const d of [0.2, 0.3]) {
      const c = dephasedLifetimeCrossing(makeRng(0x5eed47), d, 0.5, 40000);
      assert.equal(c.tau, isolatedEchoLifetime(d, 0.5));
      assert.ok(c.below > 0.5, `d=${d}: E[m~] at tau*-1 is ${c.below}`);
      assert.ok(c.at < 0.5, `d=${d}: E[m~] at tau* is ${c.at}`);
    }
    const rng = makeRng(0x5eed46);
    for (const [d, k] of [
      [0.2, 9],
      [0.1, 35],
    ] as const) {
      const r = dephasedEchoMean(rng, d, k, 40000);
      assert.ok(
        Math.abs(r.mean - Math.cos(2 * d) ** k) <= 4 * r.se,
        `d=${d} k=${k}: ${r.mean} vs ${Math.cos(2 * d) ** k} (se ${r.se})`,
      );
    }
  });

  it("TC19: the protection cliff (compact rerun) — strong at 0.3, collapsed at 0.4", () => {
    const rows = chainLifetimeCensus(6, [0.3, 0.4], 800, 0.5);
    assert.ok(rows[0]!.tauChain > 10 * rows[0]!.tauIso, "protection present at delta 0.3");
    assert.ok(rows[1]!.tauChain <= rows[1]!.tauIso + 1, "protection collapsed at delta 0.4");
  });

  it("TC20: heating is front-loaded (tau_heat within the first strobes)", () => {
    const r = heatingRelaxation(6, 0.2, 400);
    assert.ok(r.tauHeat >= 1 && r.tauHeat <= 4, `tau_heat ${r.tauHeat}`);
    assert.ok(r.totalDrift > 0.1, `drift ${r.totalDrift}`);
  });
});

describe("v0.20.0 — TC46: the isolated echo laws, independently re-verified", () => {
  it("TC46: the COHERENT law m(k) = (-1)^k cos 2kδ at the float floor — the kernel trajectory vs the rotation closed form", () => {
    for (const d of [0.05, 0.1, 0.2, 0.3]) {
      const dev = coherentEchoLawDeviation(d, 40);
      assert.ok(dev <= 1e-14, `d=${d}: ${dev}`);
    }
  });

  it("TC46: the v0.2.0 geometric law CONVICTED on the coherent path (it never held — the rotor recurs)", () => {
    for (const d of [0.1, 0.2, 0.3]) {
      const dev = convictedLawDeviation(d, 40);
      assert.ok(dev > 0.5, `d=${d}: ${dev}`);
    }
  });

  it("TC46: the B1 census arm (h = 0.05) — the SU(2) rotor law, two independent roads to the quasi-period", () => {
    assert.ok(rotorEchoLawDeviation(0.1, 0.05, 60) <= 1e-13);
    assert.ok(isolatedRotorParts(0.1, 0.05).normDev <= 1e-12, "the axis reconstruction is unitary");
  });

  it("SMUGGLING TRIAL: the v0.2.0 TAUTOLOGY itself — a formula-times-itself witness certifies the WRONG law |cos 3δ|^k", () => {
    const wrongC = Math.abs(Math.cos(3 * 0.2)); // the smuggled object: a wrong decay constant
    assert.equal(
      tautologicalIsoAgreement(wrongC, 0.5),
      true,
      "the tautology is blind — it verifies any constant handed to it (THE v0.2.0 defect, reproduced)",
    );
    assert.ok(convictedLawDeviation(0.2, 40) > 0.5, "the independent kernel path convicts the wrong law");
    assert.ok(coherentEchoLawDeviation(0.2, 40) <= 1e-14, "the honest law is verified against the kernel, not itself");
  });
});

describe("v0.20.0 — TC47: the zetaEM sign fix and the Phi1 machine bracket", () => {
  it("TC47: the zetaEM SIGN FIX — N=60/120/240 agree at 1e-10 where the v0.19.0 road erred at exactly N^{-s}", () => {
    assert.ok(Math.abs(zetaEM(1.5, 60) - zetaEM(1.5, 240)) <= 1e-9);
    assert.ok(Math.abs(zetaEM(2.5, 60) - zetaEM(2.5, 240)) <= 1e-10);
    assert.ok(Math.abs(zetaEM(1.5, 120) - zetaEM(1.5, 240)) <= 1e-10);
  });

  it("TC47: the new roads cross-validated — share roads at n<=2^16, kappa roads at D<=2^16", () => {
    for (const n of [4096, 16384, 65536]) {
      assert.ok(Math.abs(shareFloatIncremental(n) / shareFloat(n) - 1) <= 1e-8, `n=${n}`);
    }
    for (const d of [4096, 16384, 65536]) {
      assert.ok(kappaRoadCrossDeviation(d) <= 2e-6, `D=${d}: ${kappaRoadCrossDeviation(d)}`);
    }
  });

  it("TC47: Phi1 bracketed with ZERO INSIDE — TC45's '-4.547e-4 nonzero' RETIRED as the sign bug's artifact", () => {
    const f = phi1Face();
    assert.ok(f.lo <= 0 && 0 <= f.hi, `bracket [${f.lo}, ${f.hi}] must contain zero`);
    assert.ok(Math.max(Math.abs(f.lo), Math.abs(f.hi)) <= 6e-7, "the certified |Phi1| bound");
    assert.ok(f.epsKappa > 1e-7, "the kappa-transfer spread is the load-bearing error piece");
    assert.ok(f.epsZeta < 1e-9, "the fixed series is far tighter than the transfer road");
    assert.ok(Math.abs(f.sigma1 - -0.4896661401) <= 1e-9, `sigma1 point ${f.sigma1}`);
    assert.ok(f.kappaRoadDeviation <= 1e-5, `independent D-road confirms to ${f.kappaRoadDeviation}`);
  });

  it("TC47: the D-grid structure — sign-stable, monotone rising, the 1/sqrt(D) increment face", () => {
    const st = phi1GridStructure();
    assert.ok(st.monotone, "Phi1(D) monotone rising on D=2^12..2^20");
    assert.ok(st.signStable, "Phi1(D) < 0 on the whole grid");
    for (const r of st.incrementRatios) assert.ok(r > 0.4 && r < 0.6, `ratio ${r}`);
  });

  it("SMUGGLING TRIAL: fake Phi1 brackets rejected BY NAME — over-narrow (over-precision fraud), misdirected, provenance-free", () => {
    const f = phi1Face();
    const pieces = ["kappa transfer spread", "zeta series tail"];
    assert.deepEqual(checkPhi1Bracket({ lo: f.lo, hi: f.hi, pieces }, f), []);
    const narrow = checkPhi1Bracket({ lo: f.point - 1e-9, hi: f.point + 1e-9, pieces }, f);
    assert.ok(narrow.some((v) => v.includes("below the certified error floor")), narrow.join("; "));
    const off = checkPhi1Bracket({ lo: f.point - 1e-3, hi: f.point - 8e-4, pieces }, f);
    assert.ok(off.some((v) => v.includes("does not contain the machine point")), off.join("; "));
    const bare = checkPhi1Bracket({ lo: f.lo, hi: f.hi, pieces: [] }, f);
    assert.ok(bare.some((v) => v.includes("names no error piece")), bare.join("; "));
    const empty = checkPhi1Bracket({ lo: 1, hi: 0, pieces }, f);
    assert.ok(empty.some((v) => v.includes("empty interval")), empty.join("; "));
  });
});

describe("v0.3.0 — the cliff line and the self-synchronizing clock", () => {
  it("TC21: the cliff bracket resolves at both J ends (the line exists; its J-trend does not, at this scale)", () => {
    // compact: both ends must yield a bracket — the honest negative (no clean
    // J-trend) lives in the board text, the test pins the existence claim
    const lo = (() => {
      const c = cliffBisect(6, 0.6, 400, 0.5, 0.05, 0.6, 3);
      return c.deltaC;
    })();
    const hi = (() => {
      const c = cliffBisect(6, 2.4, 400, 0.5, 0.05, 0.6, 3);
      return c.deltaC;
    })();
    assert.ok(lo > 0.05 && lo < 0.6);
    assert.ok(hi > 0.05 && hi < 0.6);
  });

  it("TC22: the token self-synchronizes under bit-flip reads — fidelity exactly 1, cost in entropy", () => {
    for (const q of [0.05, 0.2]) {
      const rows = bitFlipReadCensus(4, q, DEMO_CIRCUIT, 3);
      for (const r of rows) {
        assert.ok(Math.abs(r.advanceFidelity - 1) < 1e-12, `q=${q} beat=${r.beat}: ${r.advanceFidelity}`);
      }
      const last = rows[rows.length - 1]!;
      assert.ok(last.clockEntropyBits > 0.3, `q=${q}: the cost appears as entanglement (entropy ${last.clockEntropyBits})`);
    }
  });
});

describe("v0.4.0 — the Pauli wall and the Hamming armor", () => {
  it("TC23: Y-flip reads absorbed — fidelity exactly 1, cost in entropy", () => {
    for (const q of [0.1, 0.2]) {
      const rows = yFlipReadCensus(4, q, DEMO_CIRCUIT, 3);
      for (const r of rows) assert.ok(Math.abs(r.advanceFidelity - 1) < 1e-12, `q=${q}: ${r.advanceFidelity}`);
    }
  });

  it("TC24: T1 amplitude damping absorbed — the Hamming armor holds", () => {
    for (const gamma of [0.05, 0.1]) {
      const rows = t1ReadCensus(4, gamma, DEMO_CIRCUIT, 3);
      for (const r of rows) assert.ok(Math.abs(r.advanceFidelity - 1) < 1e-12, `gamma=${gamma}: ${r.advanceFidelity}`);
    }
  });
});

describe("v0.5.0 — the armor dynamics", () => {
  it("TC25: the absorption radius r = floor((n-1)/2) — absorbed at every rate, entropy bounded at |S| bits", () => {
    assert.equal(absorptionRadius(4), 1);
    assert.equal(absorptionRadius(5), 2);
    assert.equal(absorptionRadius(6), 2);
    const r4a = radiusCensus(4, 1, 0.5, DEMO_CIRCUIT, 3);
    const r4d = radiusCensus(4, 1, 1.0, DEMO_CIRCUIT, 3);
    assert.equal(r4a.subsets, 4);
    assert.ok(r4a.worstFidelity >= 1 - 1e-12, `q=0.5 worst ${r4a.worstFidelity}`);
    assert.ok(r4d.worstFidelity >= 1 - 1e-12, `q=1.0 worst ${r4d.worstFidelity}`);
    assert.ok(Math.abs(r4a.worstEntropyBits - 1) <= 1e-9, `entropy ${r4a.worstEntropyBits} = |S| bits`);
    const depol = localizedDepolCensus(4, [0], 0.75, DEMO_CIRCUIT, 3);
    for (const r of depol) assert.ok(Math.abs(r.advanceFidelity - 1) < 1e-12, `depol beat ${r.beat}: ${r.advanceFidelity}`);
  });

  it("TC25 negative control: |S| = r+1 misfires — the wall is real (the census convicts)", () => {
    const wall = localizedFlipCensus(4, [0, 1], 1.0, DEMO_CIRCUIT, 3);
    assert.ok(wall[wall.length - 1]!.advanceFidelity <= 1e-12, `deterministic wall ${wall[wall.length - 1]!.advanceFidelity}`);
    const wallR = localizedFlipCensus(4, [0, 1], 0.5, DEMO_CIRCUIT, 3);
    assert.ok(wallR[wallR.length - 1]!.advanceFidelity < 0.99, `random wall ${wallR[wallR.length - 1]!.advanceFidelity}`);
  });

  it("TC26: the classical shadow === the quantum census at the rounding floor", () => {
    for (const [n, p] of [
      [4, 0.05],
      [4, 0.2],
    ] as const) {
      const q = delocalizedFlipCensus(n, p, DEMO_CIRCUIT, 3);
      const dp = popcountShadow(n, p, DEMO_CIRCUIT.length * 2);
      for (const row of q) {
        assert.ok(
          Math.abs(dp.fidelity[row.beat * 2 - 1]! - row.advanceFidelity) <= 1e-12,
          `n=${n} p=${p} beat=${row.beat}: ${dp.fidelity[row.beat * 2 - 1]} vs ${row.advanceFidelity}`,
        );
      }
    }
  });

  it("TC26 negative control: a forged fire rule DIVERGES (the equivalence witness bites)", () => {
    const forged = popcountShadow(4, 0.2, 8, (_w, t) => t % 2 === 0);
    const honest = popcountShadow(4, 0.2, 8, armorFireRule(4));
    assert.ok(
      Math.abs(forged.fidelity[7]! - honest.fidelity[7]!) > 0.1,
      `forged ${forged.fidelity[7]} honest ${honest.fidelity[7]}`,
    );
  });

  it("TC26: the armor self-heals — fidelity strictly above strict sector survival", () => {
    const dp = popcountShadow(4, 0.2, 8);
    assert.ok(dp.fidelity[7]! > dp.survival[7]! + 0.05, `F ${dp.fidelity[7]} vs survival ${dp.survival[7]}`);
  });

  it("TC27: majority repair is exact at odd n under sustained fire; metered; the passive twin erodes", () => {
    const v = repairCensus(5, 0.2, DEMO_CIRCUIT, 3);
    for (const r of v.rows) assert.ok(Math.abs(r.advanceFidelity - 1) <= 1e-12, `beat ${r.beat}: ${r.advanceFidelity}`);
    assert.ok(v.unrepairedWorstFidelity < 0.6, `passive twin ${v.unrepairedWorstFidelity}`);
    assert.ok(v.meanSyndromeBits > 0.1 && v.meanSyndromeBits < 1, `meter ${v.meanSyndromeBits}`);
  });

  it("TC27: the tariff's maintenance row carries the live meter reading and does not dethrone the ideal", () => {
    const tt = tariffTable();
    assert.equal(tt.rows.length, 6);
    assert.ok(tt.rows[4]!.units > 0 && tt.rows[4]!.units < 1);
    assert.ok(tt.winner.includes("Bennett"));
    const v = repairCensus(5, 0.1, DEMO_CIRCUIT, 3);
    assert.ok(Math.abs(tt.rows[4]!.units - v.meanSyndromeBits) <= 1e-3, `row ${tt.rows[4]!.units} vs live ${v.meanSyndromeBits}`);
  });

  it("TC27: at even n the tie dead zone bites, and at long horizons the passive refund beats the decoder", () => {
    const v = repairCensus(4, 0.1, DEMO_CIRCUIT, 3);
    const worst = Math.min(...v.rows.map((r) => r.advanceFidelity));
    assert.ok(worst < 1 - 1e-3, `tie dead zone at n=4: ${worst}`);
    const passive = popcountShadow(6, 0.2, 64);
    const repaired = popcountShadow(6, 0.2, 64, undefined, true);
    assert.ok(passive.fidelity[63]! > 5 * repaired.fidelity[63]!, `passive ${passive.fidelity[63]} vs repaired ${repaired.fidelity[63]}`);
  });
});

describe("v0.6.0 — the tie reset", () => {
  it("TC28: the full repair is exact at EVEN n — the dead zone is cured", () => {
    const v = fullRepairCensus(4, 0.1, DEMO_CIRCUIT, 3);
    for (const r of v.rows) assert.ok(Math.abs(r.advanceFidelity - 1) <= 1e-12, `beat ${r.beat}: ${r.advanceFidelity}`);
    assert.ok(v.unrepairedWorstFidelity < 0.5, `passive twin ${v.unrepairedWorstFidelity}`);
  });

  it("TC28: the DP twin agrees on the fidelity AND the tie meter", () => {
    const v = fullRepairCensus(4, 0.2, DEMO_CIRCUIT, 3);
    const dp = popcountShadow(4, 0.2, DEMO_CIRCUIT.length * 2, undefined, true, true);
    for (const r of v.rows) {
      assert.ok(Math.abs(dp.fidelity[r.beat * 2 - 1]! - r.advanceFidelity) <= 1e-12);
    }
    assert.ok(Math.abs(dp.meanTieBits - v.meanTieBits) <= 1e-12, `${dp.meanTieBits} vs ${v.meanTieBits}`);
  });

  it("TC28: the erasure constant is exact — log2 C(n,n/2), integer binomials, zero at odd n", () => {
    assert.ok(Math.abs(tieResetBits(4) - Math.log2(6)) <= 1e-12);
    assert.ok(Math.abs(tieResetBits(6) - Math.log2(20)) <= 1e-12);
    assert.equal(tieResetBits(5), 0);
  });

  it("TC28: at odd n the reset is a no-op (the tie set is empty)", () => {
    const v = fullRepairCensus(5, 0.1, DEMO_CIRCUIT, 3);
    assert.equal(v.tieTariffBits, 0);
    assert.ok(v.meanTieBits <= 1e-12, `tie meter ${v.meanTieBits}`);
    for (const r of v.rows) assert.ok(Math.abs(r.advanceFidelity - 1) <= 1e-12);
  });

  it("TC28: the long-horizon cure — sector-only 10x-worse becomes exactly 1 with the reset", () => {
    for (const n of [6, 8]) {
      const sectorOnly = popcountShadow(n, 0.2, 64, undefined, true, false);
      const full = popcountShadow(n, 0.2, 64, undefined, true, true);
      assert.ok(sectorOnly.fidelity[63]! < 1e-3, `n=${n} sector-only ${sectorOnly.fidelity[63]}`);
      assert.ok(Math.abs(full.fidelity[63]! - 1) <= 1e-12, `n=${n} full ${full.fidelity[63]}`);
    }
  });

  it("TC28: the B4 full-repair row carries the double meter and does not dethrone the ideal", () => {
    const tt = tariffTable();
    assert.equal(tt.rows.length, 6);
    assert.ok(tt.rows[5]!.units > 1 && tt.rows[5]!.units < 1.2);
    assert.ok(tt.winner.includes("Bennett"));
    const v = fullRepairCensus(6, 0.1, DEMO_CIRCUIT, 3);
    const live = v.meanSyndromeBits + v.meanTieBits;
    assert.ok(Math.abs(tt.rows[5]!.units - live) <= 1e-3, `${tt.rows[5]!.units} vs ${live}`);
  });
});

describe("v0.7.0 — the binomial shadow law and the scale census", () => {
  it("TC29: the passive popcount is EXACTLY Bin(n, q_t) with q_t = (1-(1-2p)^t)/2", () => {
    for (const [n, p, tt] of [
      [4, 0.2, 12],
      [6, 0.05, 9],
      [8, 0.1, 7],
    ] as const) {
      const machine = maskPopcountMarginal(n, p, tt);
      const closed = binomialPmfClosed(n, shadowQ(p, tt));
      for (let k = 0; k <= n; k++) {
        assert.ok(Math.abs(machine[k]! - closed[k]!) <= 1e-14, `n=${n} p=${p} t=${tt} k=${k}`);
      }
    }
  });

  it("TC29 negative control: the naive relaxation (flips as absorbing) is WRONG — the law is contentful", () => {
    const machine = maskPopcountMarginal(6, 0.2, 8);
    const wrong = binomialPmfClosed(6, 1 - Math.pow(1 - 0.2, 8));
    let dev = 0;
    for (let k = 0; k <= 6; k++) dev = Math.max(dev, Math.abs(machine[k]! - wrong[k]!));
    assert.ok(dev > 0.1, `deviation ${dev}`);
  });

  it("TC29: the stationary faces — breach = 1/2 + C/2^(n+1), tie = C/2^n — exact at long times", () => {
    for (const n of [4, 6, 8]) {
      const m = maskPopcountMarginal(n, 0.2, 400);
      const breach = Array.from(m.slice(n / 2)).reduce((s, v) => s + v, 0);
      assert.ok(Math.abs(breach - stationaryBreach(n)) <= 1e-12, `n=${n} breach ${breach}`);
      assert.ok(Math.abs(m[n / 2]! - stationaryTie(n)) <= 1e-12, `n=${n} tie ${m[n / 2]}`);
    }
  });

  it("TC30: the scale census — the full repair is exactly 1 at n=10/12/16, the passive fidelity rises with n", () => {
    const fids: number[] = [];
    for (const n of [10, 12, 16]) {
      const passive = popcountShadow(n, 0.2, 64);
      const full = popcountShadow(n, 0.2, 64, undefined, true, true);
      assert.ok(Math.abs(full.fidelity[63]! - 1) <= 1e-12, `n=${n} full ${full.fidelity[63]}`);
      fids.push(passive.fidelity[63]!);
    }
    assert.ok(fids[0]! < fids[1]! && fids[1]! < fids[2]!, `passive F rises with n: ${fids.join(",")}`);
  });
});

describe("v0.8.0 — the spectral survival law and the stationary repair", () => {
  it("TC31: the eigen-expansion reconstructs the DP survival exactly", () => {
    for (const [n, p] of [
      [4, 0.2],
      [6, 0.1],
    ] as const) {
      const series = spectralArmor(n, p).survivalSeries(40);
      const dp = popcountShadow(n, p, 40);
      for (let tt = 0; tt < 40; tt++) {
        assert.ok(Math.abs(series[tt]! - dp.survival[tt]!) <= 1e-13, `n=${n} p=${p} T=${tt + 1}`);
      }
    }
  });

  it("TC31: survival(T+1)/survival(T) converges to lambda_1 (the decay constant)", () => {
    const spec = spectralArmor(6, 0.2);
    const dp = popcountShadow(6, 0.2, 61);
    const ratio = dp.survival[60]! / dp.survival[59]!;
    assert.ok(Math.abs(ratio - spec.lambda1) <= 1e-10, `${ratio} vs ${spec.lambda1}`);
    assert.ok(spec.lambda1 > 0.66 && spec.lambda1 < 0.67, `lambda1 ${spec.lambda1}`);
  });

  it("TC31: lambda_1 rises with n at fixed p (the grid face)", () => {
    for (const p of [0.05, 0.1, 0.2]) {
      const lams = [4, 8, 16].map((n) => spectralArmor(n, p).lambda1);
      assert.ok(lams[0]! < lams[1]! && lams[1]! < lams[2]!, `p=${p}: ${lams.join(",")}`);
    }
  });

  it("TC32: the repaired stationary faces, and the DP mean converges from below", () => {
    const stat = repairedStationary(6, 0.2);
    assert.ok(Math.abs(stat.pTie - 0.201389) <= 1e-5, `p_tie ${stat.pTie}`);
    const dpLong = popcountShadow(6, 0.2, 400, undefined, true, true);
    assert.ok(dpLong.meanTieBits < stat.tieMeter, "the transient mean is below the stationary value");
    assert.ok(Math.abs(stat.tieMeter - dpLong.meanTieBits) < 0.01, `stationary ${stat.tieMeter} vs mean ${dpLong.meanTieBits}`);
  });
});

describe("v0.9.0 — the universal decay rate", () => {
  it("TC33: gamma = 2 EXACTLY at every n probed, and the algebraic eigenpair residual is the rounding floor", () => {
    for (const n of [4, 6, 8, 10, 12, 16, 20, 24, 32, 40]) {
      assert.ok(Math.abs(decayRateConstant(n) - 2) <= 1e-9, `n=${n}: ${decayRateConstant(n)}`);
      assert.ok(decayEigenpairResidual(n) <= 1e-12, `n=${n}: ${decayEigenpairResidual(n)}`);
    }
  });

  it("TC33: the fit face — (1-lambda_1(p))/p converges to 2 with the residual halving in p (clean O(p))", () => {
    const r1 = (1 - spectralArmor(6, 0.02).lambda1) / 0.02;
    const r2 = (1 - spectralArmor(6, 0.01).lambda1) / 0.01;
    assert.ok(r2 > r1 && r2 < 2, `monotone toward 2: ${r1} -> ${r2}`);
    const ratio = (2 - r1) / (2 - r2);
    assert.ok(Math.abs(ratio - 2) <= 0.05, `residual ratio ${ratio}`);
  });

  it("TC33 negative control: a WRONG eigenvector claim fails the solver-free residual check", () => {
    // u_w = n - w (the naive linear candidate) is NOT the eigenpair — the check must bite
    const n = 6;
    const dim = n / 2;
    const b: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
    for (let w = 0; w < dim; w++) {
      if (w + 1 < dim) b[w]![w + 1] = n - w;
      if (w - 1 >= 0) b[w]![w - 1] = w;
    }
    let worst = 0;
    for (let w = 0; w < dim; w++) {
      let bu = 0;
      for (let j = 0; j < dim; j++) bu += b[w]![j]! * (n - j);
      worst = Math.max(worst, Math.abs(bu - (n - 2) * (n - w)));
    }
    assert.ok(worst > 0.1, `the naive candidate must fail: ${worst}`);
  });
});

describe("v0.10.0 — the Krawtchouk spectrum and the second-order face", () => {
  it("TC34: every odd Krawtchouk mode is an exact eigenpair of the amputated chain (solver-free)", () => {
    for (const n of [6, 8, 10, 12, 16, 24]) {
      for (let k = 1; k <= n / 2; k++) {
        const j = 2 * k - 1;
        assert.ok(krawtchoukResidual(n, j) <= 1e-9, `n=${n} j=${j}: ${krawtchoukResidual(n, j)}`);
      }
    }
  });

  it("TC34: the spectrum is the integer arithmetic progression with gap exactly 4", () => {
    for (const n of [6, 8, 10, 12]) {
      const spec = amputatedSpectrumClosed(n);
      assert.equal(spec.length, n / 2);
      assert.equal(spec[0], n - 2);
      for (let i = 1; i < spec.length; i++) assert.equal(spec[i]! - spec[i - 1]!, -4);
    }
  });

  it("TC34 negative control: the even mode K_2 is NOT an eigenpair of the amputated chain", () => {
    assert.ok(krawtchoukResidual(8, 2) > 0.1, `K_2 residual ${krawtchoukResidual(8, 2)}`);
  });

  it("TC35: the Richardson c_2 values match the rationals 3/2 and 15/8", () => {
    assert.ok(Math.abs(secondOrderCoefficient(4) - 1.5) <= 1e-4, `${secondOrderCoefficient(4)}`);
    assert.ok(Math.abs(secondOrderCoefficient(6) - 1.875) <= 1e-4, `${secondOrderCoefficient(6)}`);
  });
});

describe("v0.11.0 — the RS closed form for c_2", () => {
  it("TC36: the quotient is exact — 3/2, 15/8, 315/128 at the floating floor", () => {
    assert.ok(Math.abs(secondOrderClosed(4) - 1.5) <= 1e-12, `${secondOrderClosed(4)}`);
    assert.ok(Math.abs(secondOrderClosed(6) - 1.875) <= 1e-12, `${secondOrderClosed(6)}`);
    assert.ok(Math.abs(secondOrderClosed(10) - 2.4609375) <= 1e-12, `${secondOrderClosed(10)}`);
  });

  it("TC36: the quotient agrees with the Richardson extrapolation within ITS error, at every n", () => {
    for (const n of [4, 6, 8, 10, 12]) {
      const closed = secondOrderClosed(n);
      const rich = secondOrderCoefficient(n);
      assert.ok(Math.abs(closed - rich) <= 1e-4, `n=${n}: ${closed} vs ${rich}`);
    }
  });

  it("TC36 negative control: the naive two-flip-only V_2 (missing the (1-p) expansion) is WRONG — the coefficient assembly is content", () => {
    // the first draft's object: two-flip counts only, at n=6 the value 6.875
    const n = 6;
    const naive = 6.875;
    assert.ok(Math.abs(secondOrderClosed(n) - naive) > 4, "the exact assembly must differ from the naive one");
  });
});

describe("v0.12.0 — the general-n law for c_2", () => {
  it("TC37: the law (n-1) C(n-2,(n-2)/2) / 2^(n-2) equals the RS quotient EXACTLY — BigInt residue zero at every n=4..40", () => {
    for (let n = 4; n <= 40; n += 2) {
      const residue = rationalResidue(secondOrderRSRational(n), secondOrderGeneralRational(n));
      assert.equal(residue, 0n, `n=${n}: residue ${residue}`);
    }
  });

  it("TC37: the law IS the central-binomial partial sum — full-sum equality per n, induction-step residue zero per m", () => {
    for (let n = 4; n <= 40; n += 2) {
      const residue = rationalResidue(secondOrderGeneralRational(n), centralBinomialSumRational((n - 2) / 2));
      assert.equal(residue, 0n, `n=${n}: residue ${residue}`);
    }
    for (let m = 1; m <= 19; m++) {
      assert.equal(centralBinomialStepResidue(m), 0n, `m=${m}`);
    }
  });

  it("TC37: the float faces agree — exact spots 3/2, 15/8, 315/128, 693/256; kernel agreement 0.00e+0 (n=4..40)", () => {
    assert.equal(secondOrderGeneral(4), 1.5);
    assert.equal(secondOrderGeneral(6), 1.875);
    assert.equal(secondOrderGeneral(10), 2.4609375);
    assert.equal(secondOrderGeneral(12), 693 / 256);
    for (let n = 4; n <= 40; n += 2) {
      assert.equal(secondOrderClosed(n), secondOrderGeneral(n), `n=${n}`);
    }
  });

  it("TC37 asymptotics (DATA, census horizon n=200): r = c_2 sqrt(pi/2n) rises monotonically to 1, n(1-r) -> 1/4, the 1/(32n^2) face -> 1", () => {
    let prev = 0;
    const grid = [4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 64, 100, 200];
    const r = (n: number): number => secondOrderGeneral(n) * Math.sqrt(Math.PI / (2 * n));
    for (const n of grid) {
      assert.ok(r(n) > prev, `r must increase at n=${n}`);
      prev = r(n);
    }
    assert.ok(Math.abs(200 * (1 - r(200)) - 0.25) <= 5e-3, `n(1-r) at 200: ${200 * (1 - r(200))}`);
    for (const n of [24, 40, 200]) {
      const face = 32 * n * n * (r(n) - 1 + 1 / (4 * n));
      assert.ok(face >= 1 && face <= 1.3, `second face at n=${n}: ${face}`);
    }
  });

  it("TC37: the pi/4 scaling of TC35 is RETIRED — c_2/sqrt(n) -> sqrt(2/pi), and the pi/4 gap is an order larger at the horizon", () => {
    const scale200 = secondOrderGeneral(200) / Math.sqrt(200);
    assert.ok(Math.abs(scale200 - Math.sqrt(2 / Math.PI)) <= 2e-3, `${scale200}`);
    assert.ok(Math.abs(scale200 - Math.PI / 4) > 10 * Math.abs(scale200 - Math.sqrt(2 / Math.PI)));
    // the crossing sits INSIDE TC35's grid: below pi/4 at n=12, above at n=16
    assert.ok(secondOrderGeneral(12) / Math.sqrt(12) < Math.PI / 4);
    assert.ok(secondOrderGeneral(16) / Math.sqrt(16) > Math.PI / 4);
  });

  it("TC37 negative control: the off-by-shift sibling and the one-power-off denominator are convicted at every probe (n=4..12)", () => {
    for (const n of [4, 6, 8, 10, 12]) {
      const rs = secondOrderRSRational(n);
      const shifted = { num: BigInt(n + 1) * binomialBig(n, n / 2), den: 2n ** BigInt(n) };
      const wrongPow = { num: BigInt(n - 1) * binomialBig(n - 2, (n - 2) / 2), den: 2n ** BigInt(n - 1) };
      assert.notEqual(rationalResidue(rs, shifted), 0n, `shifted must fail at n=${n}`);
      assert.notEqual(rationalResidue(rs, wrongPow), 0n, `wrong power must fail at n=${n}`);
    }
    // the domain guard refuses a wrong-object call (odd n) instead of computing nonsense
    assert.throws(() => secondOrderGeneralRational(5));
  });
});

describe("v0.13.0 — the third-order coefficient c_3 (the first level-repulsion face)", () => {
  it("TC38: the three-term series reproduces lambda_1 exactly — residual is the c_4 p^4 face (<= 2e-8 at p=1/100)", () => {
    const p = 0.01;
    for (const n of [4, 6, 8, 10, 12, 16]) {
      const series = 1 - 2 * p + secondOrderClosed(n) * p * p + thirdOrderClosed(n) * p ** 3;
      const resid = Math.abs(spectralArmor(n, p).lambda1 - series);
      assert.ok(resid <= 2e-8, `n=${n}: residual ${resid.toExponential(2)}`);
    }
  });

  it("TC38: Richardson on the exact eigenvalue agrees with the exact rational within ITS contamination, at every n", () => {
    for (const n of [4, 6, 8, 10, 12, 16]) {
      const c2 = secondOrderClosed(n);
      const c3At = (q: number): number => (spectralArmor(n, q).lambda1 - 1 + 2 * q - c2 * q * q) / q ** 3;
      const rich = 2 * c3At(0.01) - c3At(0.02);
      assert.ok(Math.abs(rich - thirdOrderClosed(n)) <= 5e-3, `n=${n}: ${rich} vs ${thirdOrderClosed(n)}`);
    }
  });

  it("TC38: the repulsion face is NONZERO at every n >= 4 — the repulsion-free gift ends at second order; exact spots -7/16 and -515/512", () => {
    for (const n of [4, 6, 8, 10, 12]) {
      const { repulsion } = thirdOrderFaces(n);
      assert.notEqual(repulsion.num, 0n, `the repulsion face must be nonzero at n=${n}`);
    }
    assert.equal(thirdOrderClosed(4), -0.4375); // -7/16
    assert.equal(thirdOrderClosed(6), -1.005859375); // -515/512
    const rep4 = thirdOrderFaces(4).repulsion;
    assert.equal(Number(rep4.num) / Number(rep4.den), 0.5625); // 9/16
  });

  it("TC38 negative control: the quotient-only value (the gift assumption carried past its validity) misses the series by the repulsion face", () => {
    const p = 0.01;
    const n = 6;
    const { quotient } = thirdOrderFaces(n);
    const seriesGift = 1 - 2 * p + secondOrderClosed(n) * p * p + (Number(quotient.num) / Number(quotient.den)) * p ** 3;
    const residGift = Math.abs(spectralArmor(n, p).lambda1 - seriesGift);
    const residFull = Math.abs(spectralArmor(n, p).lambda1 - (1 - 2 * p + secondOrderClosed(n) * p * p + thirdOrderClosed(n) * p ** 3));
    assert.ok(residGift > 100 * residFull, `gift ${residGift.toExponential(2)} vs full ${residFull.toExponential(2)} — the repulsion face is content`);
  });

  it("TC38: the domain guard refuses odd n; the rational total equals the two-face sum by construction and evaluates at the float floor", () => {
    assert.throws(() => thirdOrderFaces(5));
    for (const n of [4, 6, 8, 10]) {
      const { quotient, repulsion } = thirdOrderFaces(n);
      const sum = Number(quotient.num) / Number(quotient.den) + Number(repulsion.num) / Number(repulsion.den);
      assert.ok(Math.abs(sum - thirdOrderClosed(n)) <= 1e-12, `n=${n}`);
    }
  });

  it("TC39: the quotient-face identity is exactly zero for every even n — q(n) = -(n-2)c2(n)/3", () => {
    for (let n = 4; n <= 44; n += 2) {
      assert.ok(quotientFaceIdentityResidue(n) === 0n, `n=${n}`);
    }
    for (const [n, num, den] of [
      [4, -1n, 1n],
      [6, -5n, 2n],
      [8, -35n, 8n],
      [12, -1155n, 128n],
    ] as const) {
      const q = thirdOrderFaces(n).quotient;
      assert.ok(q.num * den === num * q.den, `spot n=${n}`);
    }
  });

  it("TC43: sigma1 pinned to ten digits; the zeta-lattice refuted; the fixed-k edge law converges", () => {
    const s1 = richardsonLimit([4096, 16384, 65536, 262144].map((n) => ({ n, v: sigmaFirst(n) })), 1);
    assert.ok(Math.abs(s1 + 0.4896664762) <= 1e-8, `sigma1 = ${s1}`);
    const z12 = -1.4603545088095868;
    for (const r of [(s1 * Math.sqrt(Math.PI)) / z12, s1 / z12, s1 * Math.sqrt(Math.PI)]) {
      assert.ok(Math.abs(r * 64 - Math.round(r * 64)) > 0.02, "one-term zeta candidate refuted");
    }
    for (const k of [1, 2, 3]) {
      const target = edgeAsymptoticCoefficient(k);
      const far = summandTimesDim(262144, k);
      assert.ok(Math.abs(far - target) < 1e-3, `edge law at k=${k}: ${far} vs ${target}`);
    }
  });

  it("TC42: the chain identity is exact; the arcsine law rises toward pi/2; a's one-term basis is refuted", () => {
    for (const n of [24, 64, 256]) {
      const chain = shareChainPieces(n);
      assert.ok(Math.abs(chain.chainShare - shareFloat(n)) <= 1e-12 * shareFloat(n), `chain identity at n=${n}`);
    }
    assert.ok(arcsineLaw(4096) > arcsineLaw(1024), "the arcsine profile limit rises");
    assert.ok(arcsineLaw(16384) < Math.PI / 2, "still below pi/2");
    const aInf = richardsonLimit([16384, 32768, 65536].map((n) => ({ n, v: correctionConstant(n) })), 1);
    assert.ok(Math.abs(aInf - 0.55087) <= 1e-5, `a(inf) = ${aInf}`);
    for (const b of [Math.sqrt(2 / Math.PI), Math.sqrt(Math.PI / 2), Math.sqrt(Math.PI)]) {
      const r = (aInf / b) * 32;
      assert.ok(Math.abs(r - Math.round(r)) > 0.02, `one-term candidate ${b} must be refuted`);
    }
    assert.throws(() => shareChainPieces(5));
  });

  it("TC41: the factorization is exact; the share is monotone and bracketed around 9/8; the correction constant converges", () => {
    for (let n = 4; n <= 20; n += 2) {
      for (let k = 1; k <= n / 2 - 1; k++) {
        assert.ok(modeRatioFactorResidue(n, k) === 0n, `n=${n} k=${k}`);
      }
    }
    assert.throws(() => modeRatioFactorResidue(6, 0));
    assert.throws(() => modeRatioFactorResidue(5, 1));
    const s64 = shareFloat(64);
    const s2048 = shareFloat(2048);
    assert.ok(s2048 > s64, "monotone on the spot grid");
    assert.ok(s2048 > 1.1 && s2048 < 1.125, `share(2048) in (1.1, 9/8): ${s2048}`);
    const a256 = correctionConstant(256);
    const a2048 = correctionConstant(2048);
    assert.ok(Math.abs(a256 - a2048) < 2e-3, `correction constant converges: ${a256} -> ${a2048}`);
  });

  it("TC40: the coupling closed forms hold with zero residue; the closed addend reproduces the face; the 9/8 extrapolation is stable", () => {
    for (let n = 4; n <= 28; n += 2) {
      for (let j = 3; j <= n - 1; j += 2) {
        assert.ok(couplingClosedFormResidue(n, j) === 0n, `n=${n} j=${j}`);
      }
    }
    // the closed addend sums to the kernel's exact repulsion face
    for (const n of [6, 8, 10]) {
      const f = thirdOrderFaces(n);
      let num = 0n;
      let den = 1n;
      for (let k = 1; k <= n / 2 - 1; k++) {
        const a = repulsionAddendClosedRational(n, k);
        num = num * a.den + a.num * den;
        den = den * a.den;
      }
      assert.ok(f.repulsion.num * den === num * f.repulsion.den, `closed sum equals the face at n=${n}`);
    }
    assert.throws(() => repulsionAddendClosedRational(6, 0));
    assert.throws(() => repulsionAddendClosedRational(5, 1));
  });

  it("TC39: the cancellation census — the deficit's sign crossing and the share crossing 1 (2/3-share refuted)", () => {
    const bigToFloat = (num: bigint, den: bigint): number => Number((num * 10n ** 12n) / den) / 1e12;
    let prevShare = 0;
    for (let n = 4; n <= 24; n += 2) {
      const df = cancellationDeficit(n);
      const def = bigToFloat(df.num, df.den);
      const sh = repulsionShare(n);
      const share = bigToFloat(sh.num, sh.den);
      if (n <= 18) assert.ok(def < 0, `deficit negative at n=${n}`);
      if (n >= 20) assert.ok(def > 0, `deficit positive at n=${n}`);
      assert.ok(share > prevShare, `share monotone at n=${n}`);
      prevShare = share;
    }
    const s18 = repulsionShare(18);
    const s20 = repulsionShare(20);
    assert.ok(bigToFloat(s18.num, s18.den) < 1 && bigToFloat(s20.num, s20.den) > 1, "the share crosses 1 between 18 and 20");
  });
});

describe("v0.19.0 — the singular Euler–Maclaurin assembly", () => {
  it("the exact transfer sigma1 = G·u − sqrt(n) holds at the float floor", () => {
    for (const n of [4096, 16384]) {
      const t = transferResidual(n);
      assert.ok(t.residual < 1e-9, `residual ${t.residual}`);
      assert.ok(Math.abs(t.lhs - t.rhs) < 1e-9);
    }
  });

  it("kappa from the transfer carries ten digits; the D-grid road confirms", () => {
    const s1 = richardsonLimit([16384, 65536, 262144].map((n) => ({ n, v: sigmaFirst(n) })), 1);
    const kappa = kappaFromSigma(s1);
    assert.ok(Math.abs(kappa - -0.3068529586) < 1e-6, String(kappa));
    const road = richardsonLimit([16384, 65536, 262144].map((D) => ({ n: D, v: kappaFace(D) })), 0.5);
    assert.ok(Math.abs(road - kappa) < 1e-3, `road ${road} vs ${kappa}`);
  });

  it("the edge series' exact laws: 3/8 and −11/128 (monotone from below)", () => {
    const next = richardsonLimit([64, 256, 1024, 4096].map((k) => ({ n: k, v: edgeNextOrder(k) })), 1);
    assert.ok(Math.abs(next - 0.375) < 1e-6, String(next));
    const second = (edgeNextOrder(8192) - 0.375) * 8192;
    assert.ok(Math.abs(second - -11 / 128) < 2e-3, String(second));
    assert.ok(edgeNextOrder(64) < edgeNextOrder(256) && edgeNextOrder(256) < edgeNextOrder(1024));
  });

  it("edge masses are exact rationals (m_1 = 3/4) and E_1 matches its definition", () => {
    const m1 = edgeMassRational(1);
    assert.equal(m1.num, 3n);
    assert.equal(m1.den, 4n);
    const mu1 = (2 / Math.sqrt(Math.PI)) * (Math.sqrt(1.5) - Math.sqrt(0.5));
    assert.ok(Math.abs(edgeDiff(1) - (0.75 - mu1)) < 1e-15);
  });

  it("the decomposition, CORRECTED at v0.20.0: zeta_m machine-set with the zetaEM sign fix, Phi1 inside TC47's bracket", () => {
    const series = edgeSeriesAccelerated(1 << 18);
    assert.ok(series.spotChecks < 1e-12, `spot ${series.spotChecks}`);
    assert.ok(Math.abs(series.zetaM - -0.306852819) < 1e-6, String(series.zetaM));
    const phi1 = kappaFromSigma(-0.4896664762) - series.zetaM;
    assert.ok(Math.abs(phi1) <= 6e-7, String(phi1));
    const face = phi1Face();
    assert.ok(phi1 >= face.lo - 1e-6 && phi1 <= face.hi + 1e-6, "the old-road Phi1 sits inside the certified bracket");
  });

  it("the closure face tracks the exact c3 on its rational domain, declining", () => {
    const s1 = -0.4896664762;
    const c8 = arcClosureRelative(8, s1);
    const c12 = arcClosureRelative(12, s1);
    const c16 = arcClosureRelative(16, s1);
    assert.ok(c8 > c12 && c12 > c16, `${c8} ${c12} ${c16}`);
    assert.ok(Math.abs(c16) < 4e-3);
  });

  it("F(0) = 1: the cutoff function's edge limit", () => {
    assert.ok(fFunctionFace(100000, 3) > 0.999);
  });

  it("SMUGGLING TRIAL: the closure face without the sigma1 correction is convicted — the 1/sqrt(n) term is load-bearing", () => {
    const s1 = -0.4896664762;
    const bare = thirdOrderClosed(16) / ((-(16 - 2) * secondOrderGeneral(16)) / 12) - 1;
    const withFace = arcClosureRelative(16, s1);
    assert.ok(Math.abs(withFace) < Math.abs(bare) / 2, `bare ${bare} vs with ${withFace}`);
  });

  it("SMUGGLING TRIAL: arcClosureRelative refuses n > 16 (the exact c3 path's domain is small-n)", () => {
    assert.throws(() => arcClosureRelative(32, -0.49), /small-n/);
  });
});

describe("the board and the witnesses", () => {
  it("board is legal (L1-L5)", () => {
    assert.deepEqual(checkBoard(), []);
  });

  it("all witnesses re-derive and pass", () => {
    const results = runWitnesses();
    for (const w of results) assert.ok(w.ok, `${w.witness}: ${w.detail}`);
    assert.equal(results.length, 25);
  });
});

describe("smuggling trials — every law bites", () => {
  const base = BOARD[0]!;

  function forged(overrides: Partial<BoardRow>): BoardRow {
    return { ...base, ...overrides };
  }

  it("L1: unknown family is rejected by name", () => {
    const v = checkBoard([forged({ id: "SM1", family: "poetry" as never })]);
    assert.ok(v.some((x) => x.law === "L1" && x.row === "SM1"));
  });

  it("L2: EXACT with unknown witness is rejected", () => {
    const v = checkBoard([forged({ id: "SM2", exactness: "EXACT", witness: "W-AA" })]);
    assert.ok(v.some((x) => x.law === "L2" && x.row === "SM2"));
  });

  it("L2: DATA without a horizon is rejected", () => {
    const v = checkBoard([
      forged({ id: "SM3", exactness: "DATA", price: "some numbers, no scope stated" }),
    ]);
    assert.ok(v.some((x) => x.law === "L2" && x.row === "SM3"));
  });

  it("L2: QUOTED without an anchor repo is rejected", () => {
    const v = checkBoard([forged({ id: "SM4", exactness: "QUOTED", anchors: [] })]);
    assert.ok(v.some((x) => x.law === "L2" && x.row === "SM4"));
  });

  it("L2: CITED naming no key is rejected", () => {
    const v = checkBoard([
      forged({ id: "SM5", exactness: "CITED", claim: "somebody said so", price: "no key here" }),
    ]);
    assert.ok(v.some((x) => x.law === "L2" && x.row === "SM5"));
  });

  it("L3: dead anchor repo is rejected", () => {
    const v = checkBoard([forged({ id: "SM6", anchors: ["atlantis"] })]);
    assert.ok(v.some((x) => x.law === "L3" && x.row === "SM6" && x.detail.includes("atlantis")));
  });

  it("L4: duplicate id is rejected", () => {
    const v = checkBoard([forged({ id: "TC1" }), forged({ id: "TC1" })]);
    assert.ok(v.some((x) => x.law === "L4"));
  });

  it("L5: certificate row dropping the recomputed winner is rejected", () => {
    const cert = BOARD.find((r) => r.family === "certificate")!;
    const impostor: BoardRow = {
      ...cert,
      claim: "the irreversible rival wins because I like it",
      price: "winner chosen after seeing the numbers",
    };
    const v = checkBoard([impostor]);
    assert.ok(v.some((x) => x.law === "L5" && x.row === impostor.id));
  });

  it("the renderer refuses to print an illegal board, naming the law", async () => {
    const { renderBoard } = await import("../src/experiments/render.js");
    assert.throws(
      () => renderBoard([forged({ id: "SM9", family: "poetry" as never })]),
      /SM9 \[L1\]/,
    );
  });
});

describe("entry guard", () => {
  it("importing the renderer writes nothing (batch-21 law)", async () => {
    const dir = resolve(process.cwd(), "out", "reports");
    const before = existsSync(dir) ? readdirSync(dir).join(",") : "";
    await import("../src/experiments/render.js");
    const after = existsSync(dir) ? readdirSync(dir).join(",") : "";
    assert.equal(after, before);
  });
});
