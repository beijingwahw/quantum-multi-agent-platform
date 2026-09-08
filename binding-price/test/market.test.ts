import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  checkMarket,
  runWitnesses,
  verifyNoiseIdentityClaim,
  verifySupplyClaim,
} from "../src/kernel/audit.js";
import {
  MARKET,
  QUOTED_CONT_STRATEGIES,
  QUOTED_JOINT_SPREAD_MIN,
  type MarketRow,
} from "../src/kernel/ledger.js";
import {
  blochState,
  blochOf,
  pureState,
  passProbability,
  marginal,
  revealStats,
  strategyFamilies,
  continuousStrategies,
  twoCoinStrategies,
  jointAverage,
  jointProductReveal,
  coinReveal,
  noisyRevealStats,
  HALF_MIXED,
} from "../src/kernel/market.js";
import {
  ampDampKraus,
  applyNoise,
  dephaseKraus,
  partialTrace,
} from "../src/core/channels.js";
import { identity, mMul, mDagger } from "../src/core/cmat.js";
import { traceDistance, traceReal } from "../src/core/measures.js";

function smuggle(mutate: (rows: MarketRow[]) => void): MarketRow[] {
  const copy = JSON.parse(JSON.stringify(MARKET)) as MarketRow[];
  mutate(copy);
  return copy;
}

describe("T1 the market clears", () => {
  it("the checker passes on the real market", () => {
    assert.deepEqual(checkMarket(), []);
  });

  it("all eight witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the market machinery", () => {
  it("the identity is honest in the complex quadrant (batch 10's guard)", () => {
    // a complex-phase pair: announced at +y, marginal polarized at -y
    const a = pureState([0, 1, 0]);
    const rho = blochState([0, -0.6, 0]);
    const p = passProbability(a, rho);
    const av = blochOf(a);
    const rv = blochOf(rho);
    const dot = (av[1]) * (rv[1]);
    assert.ok(Math.abs(p - 0.5 - dot / 2) < 1e-15);
    assert.ok(p < 0.5); // anti-aligned announcement UNDERPASSES: the identity has a sign face too
  });

  it("blochOf inverts blochState exactly, one at a time (the v0.2.0 sign catch)", () => {
    // v0.1.0's blochOf returned the flipped y — masked because every caller
    // dotted TWO blochOf outputs and the double flip cancelled; the noise
    // census mixes a raw direction tuple with a single blochOf and exposed it
    for (const r of [[0.3, 0.4, 0.5], [0, 0.9, 0], [0, 0, 0], [-0.2, 0.7, 0.4]] as const) {
      const [x, y, z] = blochOf(blochState([...r] as [number, number, number]));
      assert.ok(Math.abs(x - r[0]) < 1e-15 && Math.abs(y - r[1]) < 1e-15 && Math.abs(z - r[2]) < 1e-15, `roundtrip failed for ${r.join(",")}`);
    }
  });

  it("a valid strategy's members average to I/2 (the HJW bookkeeping)", () => {
    for (const fam of strategyFamilies()) {
      const m = marginal(fam.members);
      const w = fam.members.reduce((s, x) => s + x.weight, 0);
      assert.ok(Math.abs(w - 1) < 1e-15);
      assert.ok(traceDistance(m, HALF_MIXED) < 1e-15);
    }
  });

  it("the reveal under a perfectly hiding strategy is a fair coin even in the WORST member", () => {
    for (const fam of strategyFamilies()) {
      const m = marginal(fam.members);
      const { worst } = revealStats(fam.members, m);
      assert.ok(Math.abs(worst - 0.5) < 1e-15);
    }
  });
});

describe("T3 smuggling trials — the market rejects contraband by name", () => {
  it("M1: an unpriced good is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M1");
    assert.ok(hit, "expected an M1 violation");
    assert.equal(hit.row, "G1");
  });

  it("M2: an asserted impossibility without a witness is marketing, rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { witness: string }).witness = "W-TRUST";
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M2");
    assert.ok(hit, "expected an M2 violation");
    assert.match(hit.detail, /marketing/);
  });

  it("M3: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[2] as { anchors: readonly string[] }).anchors = ["ghost-repo"];
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M3");
    assert.ok(hit, "expected an M3 violation");
    assert.match(hit.detail, /ghost-repo/);
  });

  it("M4: an illegal tag is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { exactness: string }).exactness = "SETTLED";
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M4");
    assert.ok(hit, "expected an M4 violation");
  });

  it("M5: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[4] as { id: string }).id = "G1";
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M5");
    assert.ok(hit, "expected an M5 violation");
  });
});

describe("T4 the renderer refuses to print an illegal market", () => {
  it("the smuggled market fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const violations = checkMarket(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[M1\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-binding-price.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});

describe("T5 the commit channels (v0.2.0)", () => {
  it("both Kraus sets are CPTP at every census strength: sum K-dagger K = I", () => {
    for (const gamma of [0, 0.125, 0.25, 0.375, 0.5]) {
      const k0 = dephaseKraus(gamma)[0]!;
      const k1 = dephaseKraus(gamma)[1]!;
      const a0 = mMul(mDagger(k0), k0);
      const a1 = mMul(mDagger(k1), k1);
      for (let k = 0; k < 4; k++) {
        assert.ok(Math.abs(a0.re[k]! + a1.re[k]! - identity(2).re[k]!) < 1e-15);
        assert.ok(Math.abs(a0.im[k]! + a1.im[k]!) < 1e-15);
      }
    }
    for (const gamma of [0, 0.25, 0.5, 0.75, 1]) {
      const k0 = ampDampKraus(gamma)[0]!;
      const k1 = ampDampKraus(gamma)[1]!;
      const a0 = mMul(mDagger(k0), k0);
      const a1 = mMul(mDagger(k1), k1);
      for (let k = 0; k < 4; k++) {
        assert.ok(Math.abs(a0.re[k]! + a1.re[k]! - identity(2).re[k]!) < 1e-15);
        assert.ok(Math.abs(a0.im[k]! + a1.im[k]!) < 1e-15);
      }
    }
  });

  it("dephasing scales the equatorial Bloch components by (1-2gamma) and never touches z", () => {
    const rho = blochState([0.6, -0.3, 0.5]);
    for (const gamma of [0.125, 0.25, 0.375, 0.5]) {
      const out = applyNoise(rho, "dephase", gamma);
      const [x, y, z] = blochOf(out);
      assert.ok(Math.abs(x - 0.6 * (1 - 2 * gamma)) < 1e-15);
      assert.ok(Math.abs(y + 0.3 * (1 - 2 * gamma)) < 1e-15);
      assert.ok(Math.abs(z - 0.5) < 1e-15);
    }
  });

  it("amplitude damping maps the Bloch vector affinely: sqrt(1-gamma) on x,y; gamma + (1-gamma) z on z", () => {
    const rho = blochState([0.6, -0.3, 0.5]);
    for (const gamma of [0.25, 0.5, 0.75, 1]) {
      const out = applyNoise(rho, "ampdamp", gamma);
      const [x, y, z] = blochOf(out);
      assert.ok(Math.abs(x - 0.6 * Math.sqrt(1 - gamma)) < 1e-15);
      assert.ok(Math.abs(y + 0.3 * Math.sqrt(1 - gamma)) < 1e-15);
      assert.ok(Math.abs(z - (gamma + (1 - gamma) * 0.5)) < 1e-15);
    }
  });

  it("out-of-range strengths are refused at the boundary", () => {
    assert.throws(() => dephaseKraus(0.6), /outside \[0, 1\/2\]/);
    assert.throws(() => ampDampKraus(-0.1), /outside \[0, 1\]/);
  });

  it("the damping endpoint is the ground state, the dephasing midpoint is unital on I/2", () => {
    const dead = applyNoise(blochState([0.6, -0.3, 0.5]), "ampdamp", 1);
    assert.ok(Math.abs(dead.re[0]! - 1) < 1e-15 && Math.abs(dead.re[3]!) < 1e-15);
    for (const gamma of [0.125, 0.25, 0.375, 0.5]) {
      assert.ok(traceDistance(applyNoise(HALF_MIXED, "dephase", gamma), HALF_MIXED) < 1e-15);
    }
  });
});

describe("T6 the continuous family (v0.2.0)", () => {
  it("the family is what the ledger says it is: 2141 valid ensembles", () => {
    const strategies = continuousStrategies();
    assert.equal(strategies.length, QUOTED_CONT_STRATEGIES);
    for (const fam of strategies) {
      const w = fam.members.reduce((s, x) => s + x.weight, 0);
      assert.ok(Math.abs(w - 1) < 1e-15, `${fam.name}: weights`);
      for (const m of fam.members) {
        assert.equal(m.state.rows, 2);
        assert.ok(Math.abs(traceReal(m.state) - 1) < 1e-12, `${fam.name}: member trace`);
        const [x, y, z] = blochOf(m.state);
        const norm = Math.hypot(x, y, z);
        // every member is I/2 itself (the refinement axis) or pure
        assert.ok(Math.abs(norm) < 1e-12 || Math.abs(norm - 1) < 1e-12, `${fam.name}: member purity ${norm}`);
      }
    }
  });

  it("the reveal stays exactly 1/2 across the whole parameterized sweep, to floating floor", () => {
    for (const fam of continuousStrategies()) {
      const m = marginal(fam.members);
      assert.ok(traceDistance(m, HALF_MIXED) <= 1e-15, `${fam.name}: TV`);
      const { worst, average } = revealStats(fam.members, m);
      assert.ok(Math.abs(worst - 0.5) <= 1e-15 && Math.abs(average - 0.5) <= 1e-15, `${fam.name}: reveal`);
    }
  });

  it("the geodesic leg really interpolates: the second pair sweeps every relative angle", () => {
    const geo = continuousStrategies().filter((s) => s.name.startsWith("geodesic"));
    assert.equal(geo.length, 91);
    // at alpha = 0 the ensemble degenerates to the basis pair (v = u0): the
    // two positive members coincide; at alpha = pi/2 the pairs are orthogonal
    const first = geo[0]!;
    const last = geo[90]!;
    assert.ok(first.name.includes("alpha=0.000"));
    assert.ok(last.name.includes("alpha=3.142"));
    // spot structural check: four members at 1/4 each, marginal I/2
    for (const fam of [first, last]) {
      assert.equal(fam.members.length, 4);
      for (const m of fam.members) assert.ok(Math.abs(m.weight - 0.25) < 1e-15);
      assert.ok(traceDistance(marginal(fam.members), HALF_MIXED) <= 1e-15);
    }
  });
});

describe("T7 the one-coin identity under noise (v0.2.0)", () => {
  it("survives: the identity holds on the OUTPUT marginal for every channel and strength", () => {
    const channels = [
      { noise: "dephase" as const, grid: [0, 0.125, 0.25, 0.375, 0.5] },
      { noise: "ampdamp" as const, grid: [0, 0.25, 0.5, 0.75, 1] },
    ];
    let worst = 0;
    for (const { noise, grid } of channels) {
      for (const gamma of grid) {
        for (let i = 0; i < 20; i++) {
          const th1 = (i * 0.61) % Math.PI;
          const ph1 = (i * 0.83) % (2 * Math.PI);
          const a: [number, number, number] = [Math.sin(th1) * Math.cos(ph1), Math.sin(th1) * Math.sin(ph1), Math.cos(th1)];
          const rho = blochState([0.7 * a[2], 0.2 * Math.sin(th1), 0.7 * Math.cos(th1)]);
          const out = applyNoise(rho, noise, gamma);
          const p = passProbability(pureState(a), out);
          const rv = blochOf(out);
          const dot = a[0] * rv[0] + a[1] * rv[1] + a[2] * rv[2];
          worst = Math.max(worst, Math.abs(p - 0.5 - dot / 2));
        }
      }
    }
    assert.ok(worst <= 1e-15, `worst ${worst}`);
  });

  it("bends: the input-aligned announcement misses the dephased oblique polarization by the closed-form wedge", () => {
    const q = Math.SQRT1_2;
    const out = applyNoise(blochState([q, 0, q]), "dephase", 0.5);
    const p = passProbability(pureState([q, 0, q]), out);
    const wedge = traceDistance(out, HALF_MIXED) - (p - 0.5);
    // slack = (q*q)/2 = 1/4; loss = |r'|/2 = q/2 -> wedge = q/2 - 1/4
    assert.ok(Math.abs(wedge - (q / 2 - 0.25)) < 1e-12, `wedge ${wedge}`);
    assert.ok(wedge > 0.1);
  });

  it("breaks: damping confiscates gamma/2 of concealment from a perfectly concealed input", () => {
    for (const gamma of [0.25, 0.5, 0.75, 1]) {
      const out = applyNoise(HALF_MIXED, "ampdamp", gamma);
      assert.ok(Math.abs(traceDistance(out, HALF_MIXED) - gamma / 2) < 1e-15);
    }
  });

  it("the flat supply survives the channel as flatness: every decomposition lands on E(I/2)", () => {
    const strategies = [...strategyFamilies(), ...continuousStrategies().filter((_, i) => i % 40 === 0)];
    for (const { noise, grid } of [
      { noise: "dephase" as const, grid: [0.25, 0.5] },
      { noise: "ampdamp" as const, grid: [0.5, 1] },
    ]) {
      for (const gamma of grid) {
        const eHalf = applyNoise(HALF_MIXED, noise, gamma);
        for (const fam of strategies) {
          const m = applyNoise(marginal(fam.members), noise, gamma);
          assert.ok(traceDistance(m, eHalf) <= 1e-15, `${fam.name} under ${noise}(${gamma})`);
        }
        if (noise === "dephase") {
          // unital: the level itself never moves
          for (const fam of strategies) {
            const { worst } = noisyRevealStats(fam.members, noise, gamma);
            assert.ok(Math.abs(worst - 0.5) <= 1e-15);
          }
        }
      }
    }
  });
});

describe("T8 the two-coin bounded census (v0.2.0)", () => {
  it("per-coin flat at every Schmidt coefficient: marginal I/2, reveal 1/2", () => {
    for (const s of twoCoinStrategies()) {
      const joint = jointAverage(s.members);
      for (const coin of [0, 1] as const) {
        const marg = partialTrace(joint, [2, 2], [coin === 0 ? 1 : 0]);
        assert.ok(traceDistance(marg, HALF_MIXED) <= 1e-15, `${s.name}: coin ${coin} marginal`);
        for (const a of [[0, 0, 1], [1, 0, 0], [Math.SQRT1_2, 0, Math.SQRT1_2]] as const) {
          assert.ok(Math.abs(coinReveal(joint, coin, pureState([...a] as [number, number, number])) - 0.5) <= 1e-15, `${s.name}: coin ${coin} reveal`);
        }
      }
    }
  });

  it("the joint good is moved by perfectly concealing strategies: 1/4 vs 1/2 at the fixed (z,z) announcement", () => {
    const zz = pureState([0, 0, 1]);
    let min = 1;
    let max = 0;
    for (const s of twoCoinStrategies()) {
      const p = jointProductReveal(jointAverage(s.members), zz, zz);
      min = Math.min(min, p);
      max = Math.max(max, p);
    }
    assert.ok(Math.abs(min - 0.25) <= 1e-15); // the I/4 decompositions
    assert.ok(Math.abs(max - 0.5) <= 1e-15); // the Schmidt family's classical correlations
    assert.ok(max - min >= QUOTED_JOINT_SPREAD_MIN);
  });
});

describe("T9 smuggling trials II — counterfeit witnesses are named and rejected (v0.2.0)", () => {
  it("a biased 'flat' family (0.75 |0>, 0.25 |1>) is rejected as NOT-A-DECOMPOSITION", () => {
    const verdict = verifySupplyClaim({
      familyName: "totally-legit-flat-family",
      members: [
        { weight: 0.75, state: pureState([0, 0, 1]) },
        { weight: 0.25, state: pureState([0, 0, -1]) },
      ],
      claimedTV: 0,
      claimedRevealDev: 0,
    });
    assert.ok(!verdict.ok);
    assert.equal(verdict.code, "NOT-A-DECOMPOSITION");
    assert.match(verdict.detail, /totally-legit-flat-family/);
    assert.match(verdict.detail, /TV 0\.250/);
  });

  it("a genuine decomposition with forged census numbers is rejected as FORGED-TV", () => {
    const real = continuousStrategies()[100]!;
    const verdict = verifySupplyClaim({
      familyName: real.name,
      members: real.members,
      claimedTV: 0.37,
      claimedRevealDev: 0,
    });
    assert.ok(!verdict.ok);
    assert.equal(verdict.code, "FORGED-TV");
    assert.match(verdict.detail, /0\.37/);
  });

  it("a fake identity row (dephased oblique, input-aligned, 'slack still equals loss') is rejected as WEDGE-DENIED", () => {
    const q = Math.SQRT1_2;
    const verdict = verifyNoiseIdentityClaim({
      noise: "dephase",
      gamma: 0.5,
      inputBloch: [q, 0, q],
      announceBloch: [q, 0, q],
      claimedPass: 0.75, // honest pass, dishonest identity claim
      claimedSlackEqualsLoss: true,
    });
    assert.ok(!verdict.ok);
    assert.equal(verdict.code, "WEDGE-DENIED");
    assert.match(verdict.detail, /0\.103553/); // the named wedge
  });

  it("a forged pass under full damping (the noiseless answer 0.5) is rejected as FORGED-PASS", () => {
    const verdict = verifyNoiseIdentityClaim({
      noise: "ampdamp",
      gamma: 1,
      inputBloch: [0, 0, 0],
      announceBloch: [0, 0, 1],
      claimedPass: 0.5,
      claimedSlackEqualsLoss: false,
    });
    assert.ok(!verdict.ok);
    assert.equal(verdict.code, "FORGED-PASS");
    assert.match(verdict.detail, /1\.0000000000/); // the channel gives certainty
  });

  it("a member that is not a qubit state is rejected as MEMBER-FRAUD", () => {
    const fake3x3 = { rows: 3, cols: 3, re: new Float64Array(9), im: new Float64Array(9) };
    const verdict = verifySupplyClaim({
      familyName: "qutrit-smuggling",
      members: [{ weight: 1, state: fake3x3 }],
      claimedTV: 0,
      claimedRevealDev: 0,
    });
    assert.ok(!verdict.ok);
    assert.equal(verdict.code, "MEMBER-FRAUD");
    assert.match(verdict.detail, /3x3/);
  });

  it("the honest claims verify (positive controls)", () => {
    const real = continuousStrategies()[100]!;
    const good = verifySupplyClaim({ familyName: real.name, members: real.members, claimedTV: 0, claimedRevealDev: 0 });
    assert.ok(good.ok, good.detail);
    assert.equal(good.code, "VERIFIED");
    const q = Math.SQRT1_2;
    const identity = verifyNoiseIdentityClaim({
      noise: "dephase",
      gamma: 0.5,
      inputBloch: [q, 0, q],
      announceBloch: [q, 0, q],
      claimedPass: 0.75,
      claimedSlackEqualsLoss: false,
    });
    assert.ok(identity.ok, identity.detail);
  });
});
