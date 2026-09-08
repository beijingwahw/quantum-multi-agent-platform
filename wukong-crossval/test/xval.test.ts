import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkBudgetTable, checkRobustTable, checkXval, requireInstance, runWitnesses } from "../src/kernel/audit.js";
import { XVAL, type XvalRow } from "../src/kernel/ledger.js";
import { applyCost, applyRX, costTable, dimOf, enumerateOptimum, expectation, exportCircuit, instanceSet, makeRng, optimizeOffline, probOf, quboValue, runQaoa, sampleWithReadoutNoise, uniformState, type Instance } from "../src/kernel/crossval.js";
import { binomCdf, chernoffShots, klBern, logBinomCdf, minShots, powerAt } from "../src/kernel/power.js";
import { choose, distanceMasses, exactObservedHitRate, exactShellMass, flipKernel, perturbCensus, popcount, CENSUS_DELTAS } from "../src/kernel/robust.js";
import { exactProbe } from "../src/kernel/probe.js";
import { budgetRowsForDepth, BUDGET_CAP } from "../src/kernel/budget.js";
import { depolShellMass, discriminatorRow, fitDepolarizing, fitReadoutFlip, MC_SHELL_DEMO, mcShellDemo } from "../src/kernel/discriminate.js";
import { XvalError } from "../src/kernel/error.js";

function smuggle(mutate: (rows: XvalRow[]) => void): XvalRow[] {
  const copy = JSON.parse(JSON.stringify(XVAL)) as XvalRow[];
  mutate(copy);
  return copy;
}

let probe8Memo: Instance | undefined;
function probe8(): Instance {
  // the seeded set is pure; enumerating all 20 instances (2^20 states at the
  // top size) once per process is a memo, not a behavior change
  probe8Memo ??= instanceSet().find((i) => i.id === "np-n8-0");
  assert.ok(probe8Memo, "np-n8-0 exists");
  return probe8Memo;
}

describe("T1 the package is ready", () => {
  it("the checker passes on the real package", () => {
    assert.deepEqual(checkXval(), []);
  });

  it("all eight witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the kernel machinery", () => {
  it("enumeration finds a planted optimum", () => {
    const base = { id: "planted", n: 6, kind: "coupled" as const, linear: [1, 2, 3, 4, 5, 6], coupling: [[1, 1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1], [1, 1], [1]] };
    const { optBits, optValue } = enumerateOptimum(base);
    assert.equal(optValue, quboValue(base, 0b111111));
    assert.equal(optBits, 0b111111);
  });

  it("the uniform state is normalized and p=0 expectation equals the mean cost", () => {
    const inst = instanceSet().find((i) => i.id === "np-n8-0");
    assert.ok(inst);
    const psi = uniformState(inst.n);
    const dim = psi.length >> 1;
    let s = 0;
    for (let k = 0; k < dim; k++) s += psi[k]! * psi[k]!;
    assert.ok(Math.abs(s - 1) < 1e-12);
    const costs = costTable(inst);
    const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
    assert.ok(Math.abs(expectation(psi, costs) - mean) < 1e-12);
  });

  it("empty coupling rows cannot poison the value (the NaN guard)", () => {
    const inst = instanceSet().find((i) => i.kind === "linear");
    assert.ok(inst);
    for (let bits = 0; bits < 1 << inst.n; bits += 97) {
      assert.ok(Number.isFinite(quboValue(inst, bits)));
    }
  });

  it("zero-noise dry run reports observed === raw within MC error", () => {
    const inst = instanceSet().find((i) => i.id === "np-n8-0");
    assert.ok(inst);
    const psi = runQaoa(inst, { betas: [0.3], gammas: [0.7] });
    const r = sampleWithReadoutNoise(psi, inst.n, inst.optBits, 5000, 0, makeRng(3));
    assert.ok(Math.abs(r.rawHitRate - r.observedHitRate) < 0.02);
  });
});

describe("T5 the power engine (X6's arithmetic)", () => {
  it("the binomial CDF matches independent direct-product arithmetic", () => {
    // computed by a different path: explicit log-choose + exponent sums
    const direct = (k: number, n: number, p: number): number => {
      let s = 0;
      for (let j = 0; j <= k; j++) {
        let lchoose = 0;
        for (let i = 0; i < j; i++) lchoose += Math.log((n - i) / (i + 1));
        s += Math.exp(lchoose + j * Math.log(p) + (n - j) * Math.log(1 - p));
      }
      return s;
    };
    assert.ok(Math.abs(binomCdf(2, 20, 0.25) - direct(2, 20, 0.25)) < 1e-14);
    assert.ok(Math.abs(binomCdf(3, 20, 0.25) - direct(3, 20, 0.25)) < 1e-14);
    assert.ok(Math.abs(binomCdf(41, 100, 0.5) - direct(41, 100, 0.5)) < 1e-13);
    assert.equal(binomCdf(20, 20, 0.25), 1); // full support
  });

  it("minShots is two-sided verified in BOTH tails and the Chernoff bound suffices", () => {
    for (const [p0, p1] of [
      [0.5, 0.2],
      [0.3, 0.5],
    ] as const) {
      const r = minShots(p0, p1, 0.05, 0.8, 1e6);
      assert.ok(r.shots !== null && r.power !== null);
      assert.ok(r.power >= 0.8, "power at N* meets target");
      assert.ok(powerAt(r.shots - 1, p0, p1, 0.05) < 0.8, "N*-1 fails: local minimality");
      const ch = chernoffShots(p0, p1, 0.05, 0.2);
      assert.ok(ch >= r.shots, "the sufficient bound is looser than the exact minimum");
      assert.ok(powerAt(ch, p0, p1, 0.05) >= 0.8, "the bound delivers level AND power (machine-verified)");
    }
  });

  it("the exact readout convolution anchors at f=0 and f=1/2 and matches the MC sampler", () => {
    const inst = probe8();
    const probe = exactProbe(inst, 1);
    const masses = probe.masses;
    let msum = 0;
    for (const m of masses) msum += m;
    assert.ok(Math.abs(msum - 1) < 1e-9, "shell masses partition unity");
    assert.ok(Math.abs(exactObservedHitRate(masses, 0) - (masses[0] as number)) < 1e-15, "f=0 is the exact |psi_opt|^2");
    assert.ok(Math.abs(exactObservedHitRate(masses, 0.5) - 1 / 2 ** inst.n) < 1e-15, "f=1/2 is exactly uniform");
    const exact002 = exactObservedHitRate(masses, 0.02);
    const mc = sampleWithReadoutNoise(probe.psi, inst.n, inst.optBits, 40000, 0.02, makeRng(11));
    const sigma = Math.sqrt((exact002 * (1 - exact002)) / 40000);
    assert.ok(Math.abs(mc.observedHitRate - exact002) < 4 * sigma, "the MC sampler agrees with the exact kernel within 4 sigma");
  });

  it("the flip kernel is stochastic and hand-checkable at n=2", () => {
    const T = flipKernel(2, 0.1);
    for (const row of T) {
      let s = 0;
      for (const v of row) s += v;
      assert.ok(Math.abs(s - 1) < 1e-12, "rows sum to 1");
    }
    assert.ok(Math.abs((T[0] as Float64Array)[1]! - 2 * 0.1 * 0.9) < 1e-12, "T[0][1] = 2f(1-f)");
    assert.ok(Math.abs((T[1] as Float64Array)[0]! - 0.1 * 0.9) < 1e-12, "T[1][0] = f(1-f): flip the differing bit, keep the matching one");
    assert.equal(choose(5, 2), 10);
    assert.equal(popcount(0b1011), 3);
  });
});

describe("T6 the tables pass their own laws", () => {
  it("a real (small) allocation table passes law X6's recomputation", () => {
    const inst = probe8();
    const rows = budgetRowsForDepth(inst, 1, [0.02], [1, 0.5], [0.2], 0.05, BUDGET_CAP);
    assert.ok(rows.length === 2);
    assert.deepEqual(checkBudgetTable(rows), []);
  });

  it("a real (small) robustness census passes law X7's recomputation", () => {
    const inst = probe8();
    const census = perturbCensus(exactProbe(inst, 1), [0.05, 0.25]);
    assert.deepEqual(checkRobustTable(census.rows), []);
  });

  it("the census reports optimizer slack honestly (as found, seeded probe)", () => {
    const inst = probe8();
    const c1 = perturbCensus(exactProbe(inst, 1), CENSUS_DELTAS);
    let worstFine = 0;
    for (const r of c1.rows) {
      assert.ok(Number.isFinite(r.dEminus) && Number.isFinite(r.dEplus) && Number.isFinite(r.curvature));
      if (r.delta <= 0.05) worstFine = Math.min(worstFine, r.dEminus, r.dEplus);
      else assert.ok(r.dEminus >= -1e-9 && r.dEplus >= -1e-9, `p=1 delta ${String(r.delta)} (a refine-probed move size) beats the shipped optimum`);
    }
    // the fine-delta slack is the coarse optimizer's residue — small on the probe, reported as data
    assert.ok(worstFine > -0.01 * Math.abs(c1.eStar), "fine-delta slack stays under 1% of |E*| on the probe");
    // and at p>=2 the slack is REAL (the refine scales moves by 1/p, so raw ±0.1 was never probed) —
    // locked here so nobody silently "fixes" the reporting later
    const c2 = perturbCensus(exactProbe(inst, 2), [0.1]);
    assert.ok(c2.rows.some((r) => Math.min(r.dEminus, r.dEplus) < -1e-9), "p=2 census must keep reporting the optimizer slack it finds");
  });
});

describe("T7 smuggling trials — the package rejects contraband by name", () => {
  it("X1: an unpriced claim is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const hit = checkXval(contraband).find((v) => v.law === "X1");
    assert.ok(hit, "expected an X1 violation");
    assert.equal(hit.row, "X1");
  });

  it("X2: an unknown witness is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { witness: string }).witness = "W-TRUST";
    });
    const hit = checkXval(contraband).find((v) => v.law === "X2");
    assert.ok(hit, "expected an X2 violation");
  });

  it("X3: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[2] as { anchors: readonly string[] }).anchors = ["ghost-repo"];
    });
    const hit = checkXval(contraband).find((v) => v.law === "X3");
    assert.ok(hit, "expected an X3 violation");
  });

  it("X4: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { id: string }).id = "X1";
    });
    const hit = checkXval(contraband).find((v) => v.law === "X4");
    assert.ok(hit, "expected an X4 violation");
  });

  it("X6: a counterfeit budget row (power that was never computed) is named and rejected", () => {
    const inst = probe8();
    const real = budgetRowsForDepth(inst, 1, [0.02], [1], [0.2], 0.05, BUDGET_CAP);
    const contraband = real.map((r) => ({ ...r, shots: 5, power: 0.9 }));
    const hit = checkBudgetTable(contraband).find((v) => v.law === "X6");
    assert.ok(hit, "expected an X6 violation");
    assert.ok(hit.row.includes("np-n8-0"), "the violation names the counterfeit row");
    assert.match(hit.detail, /counterfeit budget/);
  });

  it("X6: a counterfeit effect size (invented p1) is named and rejected", () => {
    const inst = probe8();
    const real = budgetRowsForDepth(inst, 1, [0.02], [1], [0.2], 0.05, BUDGET_CAP);
    const contraband = real.map((r) => {
      const p1 = (r.p0 + r.p1) / 2 / 1000; // a 1000x inflated effect
      return { ...r, p1 };
    });
    const hit = checkBudgetTable(contraband).find((v) => v.law === "X6");
    assert.ok(hit, "expected an X6 violation");
    assert.match(hit.detail, /counterfeit effect/);
  });

  it("X7: a fake robustness row (invented curvature) is named and rejected", () => {
    const inst = probe8();
    const census = perturbCensus(exactProbe(inst, 1), [0.05]);
    const contraband = census.rows.map((r) => ({ ...r, curvature: 0, dEplus: 0, dEminus: 0 }));
    const hit = checkRobustTable(contraband).find((v) => v.law === "X7");
    assert.ok(hit, "expected an X7 violation");
    assert.ok(hit.row.includes("np-n8-0"), "the violation names the fake row");
    assert.match(hit.detail, /fake robustness row/);
  });

  it("X7: a robustness row for a point the census never evaluated is rejected", () => {
    const inst = probe8();
    const census = perturbCensus(exactProbe(inst, 1), [0.05]);
    const contraband = [...census.rows, { ...census.rows[0]!, angle: "beta7", delta: 0.123 }];
    const hit = checkRobustTable(contraband).find((v) => v.law === "X7" && v.detail.includes("does not exist"));
    assert.ok(hit, "expected an X7 not-in-census violation");
  });
});

describe("T8 the discriminator (X8's arithmetic)", () => {
  it("the readout fit round-trips and the depolarizing fit inverts exactly", () => {
    const inst = probe8();
    const masses = exactProbe(inst, 1).masses;
    for (const f of [0.01, 0.02, 0.05]) {
      const r = exactObservedHitRate(masses, f);
      const fit = fitReadoutFlip(masses, r, f);
      assert.ok(Math.abs(fit.fit - f) < 1e-9, `fit recovers f=${f}`);
      assert.ok(fit.residual < 1e-12, "fit residual negligible");
      const lam = fitDepolarizing(masses[0] as number, inst.n, r);
      const back = lam * (masses[0] as number) + (1 - lam) / 2 ** inst.n;
      assert.ok(Math.abs(back - r) < 1e-15, "lambda inverts to the same rate");
    }
  });

  it("shell-1 separability is computed honestly at the planned budgets (as data)", () => {
    const inst = probe8();
    const masses = exactProbe(inst, 1).masses;
    const row = discriminatorRow(masses, { instanceId: inst.id, n: inst.n, depth: 1 }, 0.02, 100000);
    // n=8 at f=0.02 is an INFLATION operating point: no physical depolarizing fit
    assert.ok(!row.depolPhysical && row.fitLambda > 1);
    assert.equal(row.separable, true); // separated outright by sign
    const mc = mcShellDemo(inst, MC_SHELL_DEMO.depth, MC_SHELL_DEMO.flip, MC_SHELL_DEMO.shots, MC_SHELL_DEMO.seed);
    const sigma = Math.sqrt((mc.readoutPrediction * (1 - mc.readoutPrediction)) / 40000);
    assert.ok(Math.abs(mc.shell1Estimate - mc.readoutPrediction) < 4 * sigma, "MC shell-1 lands on the readout branch");
    assert.ok(mc.depolPrediction > mc.readoutPrediction, "the depolarizing branch is visibly apart here");
  });
});

describe("T4 the renderer refuses to print an illegal package", () => {
  it("the smuggled package fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const violations = checkXval(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[X1\]/);
  });

  it("a counterfeit budget table fails the checker the renderer gates on", () => {
    const inst = probe8();
    const real = budgetRowsForDepth(inst, 1, [0.02], [1], [0.2], 0.05, BUDGET_CAP);
    const contraband = real.map((r) => ({ ...r, shots: 5, power: 0.9 }));
    assert.ok(checkBudgetTable(contraband).length > 0, "the renderer's X6 gate would refuse this package");
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-xval-package.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});

function rejectsByCode(code: string, fn: () => unknown): void {
  assert.throws(fn, (e: unknown) => e instanceof XvalError && e.code === code, `expected a named ${code} rejection`);
}

describe("T9 the named error surface — contraband input is rejected by code, never NaN", () => {
  it("sampleWithReadoutNoise rejects zero shots, illegal flips, mismatched layouts, and out-of-range optBits by name", () => {
    const inst = probe8();
    const psi = runQaoa(inst, { betas: [0.3], gammas: [0.7] });
    rejectsByCode("XVAL_SHOTS_RANGE", () => sampleWithReadoutNoise(psi, inst.n, inst.optBits, 0, 0, makeRng(1)));
    rejectsByCode("XVAL_FLIP_RANGE", () => sampleWithReadoutNoise(psi, inst.n, inst.optBits, 10, -0.01, makeRng(1)));
    rejectsByCode("XVAL_FLIP_RANGE", () => sampleWithReadoutNoise(psi, inst.n, inst.optBits, 10, 1.01, makeRng(1)));
    rejectsByCode("XVAL_LAYOUT_MISMATCH", () => sampleWithReadoutNoise(uniformState(inst.n + 1), inst.n, inst.optBits, 10, 0, makeRng(1)));
    rejectsByCode("XVAL_BITS_RANGE", () => sampleWithReadoutNoise(psi, inst.n, 1 << inst.n, 10, 0, makeRng(1)));
  });

  it("runQaoa and exportCircuit reject unpaired parameter vectors", () => {
    const inst = probe8();
    rejectsByCode("XVAL_PARAMS_LENGTH", () => runQaoa(inst, { betas: [0.3], gammas: [] }));
    rejectsByCode("XVAL_PARAMS_LENGTH", () => exportCircuit(inst, { betas: [0.3, 0.4], gammas: [0.7] }, 100));
  });

  it("the QUBO referee rejects shape contraband and qubit counts that would wrap 1 << n", () => {
    const shortLinear = { id: "short", n: 4, kind: "coupled" as const, linear: [1, 2, 3], coupling: [[], [], [], []] };
    rejectsByCode("XVAL_QUBO_SHAPE", () => quboValue(shortLinear, 0b1010));
    rejectsByCode("XVAL_N_RANGE", () => uniformState(31));
    rejectsByCode("XVAL_N_RANGE", () => enumerateOptimum({ ...shortLinear, linear: [1, 2, 3, 4], n: 31 }));
  });

  it("distanceMasses rejects layout mismatches and out-of-range references", () => {
    const psi = uniformState(4);
    rejectsByCode("XVAL_LAYOUT_MISMATCH", () => distanceMasses(psi, 5, 0));
    rejectsByCode("XVAL_BITS_RANGE", () => distanceMasses(psi, 4, 16));
  });

  it("the shell kernels reject shell indices beyond the mass vector (the silent-NaN hole, wave 6)", () => {
    const masses = exactProbe(probe8(), 1).masses;
    rejectsByCode("XVAL_SHELL_RANGE", () => exactShellMass(masses, 0.02, masses.length));
    rejectsByCode("XVAL_SHELL_RANGE", () => depolShellMass(masses, 8, 0.5, -1));
  });

  it("exactObservedHitRate rejects empty mass vectors and out-of-range flips", () => {
    const masses = exactProbe(probe8(), 1).masses;
    rejectsByCode("XVAL_MASSES_SHAPE", () => exactObservedHitRate(new Float64Array(0), 0.02));
    rejectsByCode("XVAL_FLIP_RANGE", () => exactObservedHitRate(masses, 1.5));
  });

  it("minShots names its three rejection classes", () => {
    rejectsByCode("XVAL_MINSHOTS_NULL_RATE", () => minShots(0, 0.1, 0.05, 0.8, 1e6));
    rejectsByCode("XVAL_MINSHOTS_ALT_RATE", () => minShots(0.3, 0.3, 0.05, 0.8, 1e6));
    rejectsByCode("XVAL_MINSHOTS_LEVEL", () => minShots(0.3, 0.5, 0, 0.8, 1e6));
  });

  it("the seeded-instance lookup names a missing id", () => {
    rejectsByCode("XVAL_INSTANCE_MISSING", () => requireInstance("np-n8-99"));
  });

  it("exactProbe and optimizeOffline reject non-integer depths", () => {
    rejectsByCode("XVAL_DEPTH_RANGE", () => exactProbe(probe8(), 1.5));
    rejectsByCode("XVAL_DEPTH_RANGE", () => optimizeOffline(probe8(), -1));
  });

  it("checkBudgetTable turns an illegal operating point into a named X6 violation, not an anonymous throw", () => {
    const inst = probe8();
    const real = budgetRowsForDepth(inst, 1, [0.02], [1], [0.2], 0.05, BUDGET_CAP);
    const contraband = real.map((r) => ({ ...r, flip: 7 }));
    const hit = checkBudgetTable(contraband).find((v) => v.law === "X6" && v.detail.includes("illegal operating point"));
    assert.ok(hit, "expected the illegal flip level to be named as an X6 violation");
  });
});

describe("T10 hand-checkable anchors — the gates and bounds pinned by hand arithmetic", () => {
  it("applyCost multiplies by e^{-i gamma c} exactly as written by hand", () => {
    // n=1, split layout [re0, re1 | im0, im1]; |0> = 1 + 0i, cost(|0>) = 1, gamma = pi/2:
    // e^{-i pi/2} = -i, so the amplitude becomes -i — re = 0, im = -1
    const psi = new Float64Array([1, 0, 0, 0]);
    applyCost(psi, new Float64Array([1, 0]), Math.PI / 2);
    assert.ok(Math.abs(psi[0]!) < 1e-15, "real part is cos(-pi/2) = 0");
    assert.ok(Math.abs(psi[2]! + 1) < 1e-15, "imaginary part is sin(-pi/2) = -1");
    // the zero-cost state is the identity path (untouched)
    assert.equal(psi[1], 0);
    assert.equal(psi[3], 0);
  });

  it("applyRX's sign convention is pinned by hand: e^{+i (theta/2) X}, the conjugate of textbook RX", () => {
    // |0> = 1 + 0i, theta = pi: the code's hand value is amp(|1>) = +i.
    // Textbook RX(pi) = e^{-i (pi/2) X} would give -i; the offline optimizer's
    // beta axis is the textbook's -beta — frozen, disclosed in applyRX's contract
    const psi = new Float64Array([1, 0, 0, 0]);
    applyRX(psi, 1, 0, Math.PI);
    assert.ok(Math.abs(psi[0]!) < 1e-15 && Math.abs(psi[2]!) < 1e-15, "amp(|0>) = cos(pi/2) = 0");
    assert.ok(Math.abs(psi[1]!) < 1e-15, "amp(|1>) real part is 0");
    assert.ok(Math.abs(psi[3]! - 1) < 1e-15, "amp(|1>) imaginary part is +1, not -1");
  });

  it("klBern is zero on the diagonal and matches the hand value at (1/2, 1/4)", () => {
    assert.equal(klBern(0.3, 0.3), 0);
    // hand: D(1/2 || 1/4) = 1/2 ln 2 + 1/2 ln(2/3) = 1/2 ln(4/3)
    const hand = 0.5 * Math.log(4 / 3);
    assert.ok(Math.abs(klBern(0.5, 0.25) - hand) < 1e-15);
  });

  it("logBinomCdf's first term is exactly n log q, and the layout accessors pin the split", () => {
    assert.equal(logBinomCdf(0, 10, 0.3), 10 * Math.log(0.7));
    const psi = new Float64Array([0.6, 0, 0.8, 0]); // amp(|0>) = 0.6 + 0.8i
    assert.equal(dimOf(psi), 2);
    assert.ok(Math.abs(probOf(psi, 0) - 1) < 1e-15, "0.36 + 0.64 = 1");
  });
});
