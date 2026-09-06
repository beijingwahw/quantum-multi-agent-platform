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
  echoFloquet,
  flipIdentityDeviation,
  heatingRelaxation,
  isolatedEchoLifetime,
  maxAbs,
  pairingDeviations,
  siteZ,
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
  absorptionRadius,
  armorFireRule,
  delocalizedFlipCensus,
  localizedDepolCensus,
  localizedFlipCensus,
  popcountShadow,
  radiusCensus,
  repairCensus,
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
    assert.equal(tt.rows.length, 5);
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

describe("v0.2.0 — the lifetime law", () => {
  it("TC18: the isolated closed form === direct simulation", () => {
    for (const d of [0.1, 0.2, 0.3]) {
      const tau = isolatedEchoLifetime(d, 0.5);
      const c = Math.abs(Math.cos(2 * d));
      let k = 0;
      let m = 1;
      while (m >= 0.5 && k < 100000) {
        k++;
        m *= c;
      }
      assert.equal(tau, k, `delta ${d}`);
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
    assert.equal(tt.rows.length, 5);
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

describe("the board and the witnesses", () => {
  it("board is legal (L1-L5)", () => {
    assert.deepEqual(checkBoard(), []);
  });

  it("all witnesses re-derive and pass", () => {
    const results = runWitnesses();
    for (const w of results) assert.ok(w.ok, `${w.witness}: ${w.detail}`);
    assert.equal(results.length, 10);
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
    const v = checkBoard([forged({ id: "SM2", exactness: "EXACT", witness: "W-Z" })]);
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
