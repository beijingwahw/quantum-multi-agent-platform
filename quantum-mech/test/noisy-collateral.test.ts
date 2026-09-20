import test from "node:test";
import assert from "node:assert/strict";
import {
  balancedMargin,
  bondNoisyFamilyState,
  budgetSumClosed,
  collateralFamilyState,
  collateralRow,
  ckwSlackCensus,
  concurrenceDecayFactor,
  epsilonBudget,
  exclusiveThreshold,
  f1Closed,
  familyMaxSumClosed,
  familyMaxSumScan,
  verifyCollateralBudgetClaim,
} from "../src/contract/noisy-collateral.js";

const DAMP_GAMMAS = [0, 0.2, 0.5, 0.8, 1];
const DEPHASE_GAMMAS = [0, 0.15, 0.3, 0.5];

test("CB-a: closed forms for F1 and F1+F2 match the density-matrix path to 1e-12 on the whole grid", () => {
  for (const gamma of DAMP_GAMMAS) {
    const scan = familyMaxSumScan("damp", gamma, 200);
    assert.ok(
      scan.worstDeviation <= 1e-12,
      `damp/gamma=${gamma}: worst ${scan.worstDeviation.toExponential(2)}`,
    );
  }
  for (const gamma of DEPHASE_GAMMAS) {
    const scan = familyMaxSumScan("dephase", gamma, 200);
    assert.ok(
      scan.worstDeviation <= 1e-12,
      `dephase/gamma=${gamma}: worst ${scan.worstDeviation.toExponential(2)}`,
    );
  }
  // per-x spot anchors (both F1 and the sum, both noise families)
  for (const [noise, gamma, x] of [
    ["damp", 0.3, 0.5],
    ["damp", 0.9, 0.2],
    ["dephase", 0.25, 0.7],
  ] as const) {
    const row = collateralRow(noise, gamma, x);
    assert.ok(Math.abs(row.f1 - f1Closed(noise, gamma, x)) <= 1e-12);
    assert.ok(Math.abs(row.sum - budgetSumClosed(noise, gamma, x)) <= 1e-12);
  }
});

test("CB-b: the budget SURVIVES — max_x (F1+F2) = max(1/2, gamma) <= 1, epsilon(gamma) = 0 everywhere", () => {
  for (const gamma of DAMP_GAMMAS) {
    const scan = familyMaxSumScan("damp", gamma, 200);
    assert.ok(
      Math.abs(scan.maxSum - familyMaxSumClosed("damp", gamma)) <= 1e-12,
      `damp/gamma=${gamma}: scan ${scan.maxSum} vs closed ${familyMaxSumClosed("damp", gamma)}`,
    );
    assert.ok(
      scan.maxSum <= 1 + 1e-12,
      `the budget must not exceed 1, got ${scan.maxSum}`,
    );
    assert.ok(
      epsilonBudget("damp", gamma) === 0,
      `epsilon(damp, ${gamma}) must be exactly 0`,
    );
  }
  for (const gamma of DEPHASE_GAMMAS) {
    const scan = familyMaxSumScan("dephase", gamma, 200);
    assert.ok(
      Math.abs(scan.maxSum - 0.5) <= 1e-12,
      "dephasing leaves the family max exactly 1/2",
    );
    assert.ok(epsilonBudget("dephase", gamma) === 0);
  }
});

test("CB-b endpoints pinned: gamma=0 recovers the noise-free family; damp gamma=1 x=1 hits sum exactly 1", () => {
  const zero = collateralRow("damp", 0, 0.25);
  assert.ok(
    Math.abs(zero.sum - budgetSumClosed("dephase", 0, 0.25)) <= 1e-15,
    "gamma=0 rows coincide",
  );
  const full = collateralRow("damp", 1, 1);
  assert.ok(
    Math.abs(full.sum - 1) <= 1e-12,
    `full damping endpoint: sum ${full.sum}`,
  );
  assert.ok(
    Math.abs(full.f1 - 0.5) <= 1e-12 && Math.abs(full.f2 - 0.5) <= 1e-12,
    "each escrow sees a perfect |00> correlation",
  );
  // x = 0 is the noise-free anchor: F1 + F2 = 1/2 at every gamma (the bond
  // |0> is a fixed point of both channels)
  for (const gamma of DAMP_GAMMAS) {
    const row = collateralRow("damp", gamma, 0);
    assert.ok(
      Math.abs(row.sum - 0.5) <= 1e-12,
      `x=0 fixed point at gamma=${gamma}: ${row.sum}`,
    );
  }
});

test("CB-b: the acceptance threshold does not move — both forms stay at (or below) the noise-free 1/2", () => {
  for (const gamma of DAMP_GAMMAS) {
    const t = exclusiveThreshold("damp", gamma);
    assert.ok(
      t.noShiftNeeded,
      `damp/gamma=${gamma}: familyTight ${t.familyTight} specForm ${t.specForm}`,
    );
    assert.ok(
      Math.abs(t.specForm - 0.5) <= 1e-15,
      "epsilon-form threshold is exactly 1/2",
    );
    assert.ok(t.familyTight <= 0.5 + 1e-15);
  }
  for (const gamma of DEPHASE_GAMMAS) {
    const t = exclusiveThreshold("dephase", gamma);
    assert.ok(
      Math.abs(t.familyTight - 0.25) <= 1e-15 || t.familyTight <= 0.25 + 1e-15,
    );
    assert.ok(t.noShiftNeeded);
  }
});

test("CB-c: concurrence decay — factor(gamma)*sqrt(2x(1-x)) for both channels; the balanced margin melts", () => {
  for (const gamma of DEPHASE_GAMMAS) {
    for (const x of [0.2, 0.5, 0.8]) {
      const row = collateralRow("dephase", gamma, x);
      const closed =
        concurrenceDecayFactor("dephase", gamma) * Math.sqrt(2 * x * (1 - x));
      assert.ok(
        Math.abs(row.cBE1 - closed) <= 1e-12 &&
          Math.abs(row.cBE2 - closed) <= 1e-12,
        `dephase/gamma=${gamma}/x=${x}: ${row.cBE1} vs ${closed}`,
      );
    }
  }
  for (const gamma of DAMP_GAMMAS) {
    for (const x of [0.2, 0.5, 0.8]) {
      const row = collateralRow("damp", gamma, x);
      const closed =
        concurrenceDecayFactor("damp", gamma) * Math.sqrt(2 * x * (1 - x));
      assert.ok(
        Math.abs(row.cBE1 - closed) <= 1e-12 &&
          Math.abs(row.cBE2 - closed) <= 1e-12,
        `damp/gamma=${gamma}/x=${x}: ${row.cBE1} vs ${closed}`,
      );
    }
  }
  // the balanced optimum x=1/2 rides the CKW ceiling 1/sqrt(2) times factor
  const noiseless = collateralRow("damp", 0, 0.5);
  assert.ok(
    Math.abs(noiseless.cBE1 - Math.SQRT1_2) <= 1e-12,
    "x=1/2 at gamma=0 hits the ceiling",
  );
  assert.ok(Math.abs(balancedMargin("damp", 0) - Math.SQRT1_2) <= 1e-15);
  assert.ok(
    Math.abs(balancedMargin("damp", 1)) <= 1e-15,
    "full damping melts the margin to 0",
  );
  assert.ok(
    Math.abs(balancedMargin("dephase", 0.5)) <= 1e-15,
    "full dephasing melts the margin to 0",
  );
});

test("CB-d: CKW slack stays <= 0 under bond noise on the family (machine echo, mixed states)", () => {
  for (const gamma of DAMP_GAMMAS) {
    const worst = ckwSlackCensus("damp", gamma, 100);
    assert.ok(
      worst <= 1e-9,
      `damp/gamma=${gamma}: max slack ${worst.toExponential(2)}`,
    );
  }
  for (const gamma of DEPHASE_GAMMAS) {
    const worst = ckwSlackCensus("dephase", gamma, 100);
    assert.ok(
      worst <= 1e-9,
      `dephase/gamma=${gamma}: max slack ${worst.toExponential(2)}`,
    );
  }
});

test("negative controls: forged budget rows are convicted by name", () => {
  const row = collateralRow("damp", 0.2, 0.5);
  // (a) the classic confusion: all-qubit damping inflates max sum to
  // 1/2 + gamma/2 = 0.6 — bond-local noise never does
  const globalNoiseConfusion = verifyCollateralBudgetClaim({
    noise: "damp",
    gamma: 0.2,
    x: 0.5,
    sum: row.sum,
    familyMaxSum: 0.5 + 0.2 / 2,
  });
  assert.ok(!globalNoiseConfusion.ok);
  assert.equal(globalNoiseConfusion.code, "CBX02-fabricated-family-max");
  // (b) a fabricated per-x sum: the gamma = 0 closed form filed on a
  // gamma = 0.8 damp row (forgetting the noise entirely)
  const forgedSum = verifyCollateralBudgetClaim({
    noise: "damp",
    gamma: 0.8,
    x: 0.5,
    sum: budgetSumClosed("damp", 0, 0.5),
    familyMaxSum: familyMaxSumClosed("damp", 0.8),
  });
  assert.ok(!forgedSum.ok);
  assert.equal(forgedSum.code, "CBX01-fabricated-budget-sum");
  // (c) the honest row survives the referee
  assert.ok(
    verifyCollateralBudgetClaim({
      noise: "damp",
      gamma: 0.2,
      x: 0.5,
      sum: row.sum,
      familyMaxSum: familyMaxSumClosed("damp", 0.2),
    }).ok,
  );
});

test("negative control (magnitude face): the 0.6 forgery is judged against the local slope, not a tolerance accident", () => {
  // at gamma = 0.2 the bond-local family max is flat at 1/2 on [0, 1/2] and
  // climbs at slope 1 only PAST the kink (a symmetric window across the kink
  // would read 1/2 — the average of the two one-sided slopes): a claimed 0.6
  // is 0.1 above the plateau, the FULL climb to gamma = 1, orders past any
  // discretization scale
  const plateau = familyMaxSumScan("damp", 0.4, 200).maxSum;
  const past1 = familyMaxSumScan("damp", 0.51, 200).maxSum;
  const past2 = familyMaxSumScan("damp", 0.53, 200).maxSum;
  assert.ok(
    Math.abs(plateau - 0.5) <= 1e-12,
    "the plateau sits at 1/2 below the kink",
  );
  const slope = (past2 - past1) / 0.02;
  assert.ok(
    slope >= 0.99 && slope <= 1.01,
    `one-sided slope past the kink ~1 (measured ${slope.toFixed(3)})`,
  );
  const verdict = verifyCollateralBudgetClaim({
    noise: "damp",
    gamma: 0.2,
    x: 0,
    sum: collateralRow("damp", 0.2, 0).sum,
    familyMaxSum: 0.6,
  });
  assert.ok(!verdict.ok && verdict.code === "CBX02-fabricated-family-max");
});

test("entry guards: bad noise name, gamma ranges, x range, steps are refused by name", () => {
  assert.throws(() => collateralFamilyState(1.5), /CB01-family-x/);
  assert.throws(
    () => bondNoisyFamilyState(0.5, "dephase", 0.75),
    /dephase census lives on gamma/,
  );
  assert.throws(
    () => bondNoisyFamilyState(0.5, "damp", 1.5),
    /CB02-noisy-family/,
  );
  assert.throws(() => ckwSlackCensus("damp", 0.5, 1), /CB09-slack/);
  assert.throws(() => familyMaxSumScan("damp", 0.5, 0), /CB11-scan/);
  assert.throws(
    () =>
      verifyCollateralBudgetClaim({
        noise: "damp",
        gamma: -1,
        x: 0.5,
        sum: 0,
        familyMaxSum: 0,
      }),
    /CB10-claim/,
  );
});
