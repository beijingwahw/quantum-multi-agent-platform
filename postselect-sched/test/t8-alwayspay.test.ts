import test from "node:test";
import assert from "node:assert/strict";
import {
  payConvexLedger,
  noBeatingRow,
  noBeatingScan,
  modelSplitRow,
  checkPayQuoteClaim,
  syntheticMenus,
} from "../src/kernel/alwayspay.js";
import {
  geometricDist,
  powerLawDist,
  bimodalDist,
  firstMarkDist,
  qOf,
  payExpected,
} from "../src/kernel/restart.js";
import { isKernelError } from "../src/kernel/errors.js";

/** distribution-induced menus: rounds are cutoffs (cost = t, prob = q(t)) */
function distMenus(): Array<{ costs: number[]; probs: number[] }> {
  const dists = [
    geometricDist(50, 0.1),
    geometricDist(50, 0.3),
    powerLawDist(100, 1.5),
    bimodalDist(),
    firstMarkDist(256, 4),
    firstMarkDist(64, 8),
  ];
  const cutoffSets = [
    [1, 2, 3, 5],
    [1, 10, 50],
    [2, 30, 100],
    [1, 5, 20, 100],
  ];
  const out: Array<{ costs: number[]; probs: number[] }> = [];
  for (const p of dists) {
    for (const set of cutoffSets) {
      if (set.some((t) => t >= p.length)) continue;
      out.push({ costs: [...set], probs: set.map((t) => qOf(p, t)) });
    }
  }
  return out;
}

test("T8.A always-pay no-beating: convex identity, no schedule beats the best round, equality iff support in argmin — tens of thousands of schedules", () => {
  const menus = [...syntheticMenus(12345, 550), ...distMenus()];
  const scan = noBeatingScan(menus, 3);
  // 550 seeded synthetic menus (1..4 rounds) + 22 distribution menus, all
  // cyclic prefixes of length <= 3 — the enumeration witness of AP-a/AP-b/AP-c
  assert.ok(
    scan.schedules > 20000,
    `enumeration must be tens of thousands (got ${scan.schedules})`,
  );
  assert.equal(scan.violations, 0, "AP-b: no schedule beat the menu minimum");
  assert.equal(
    scan.equalityMismatches,
    0,
    "AP-c: equality characterization failed nowhere",
  );
  assert.ok(
    scan.worstIdentityDev < 1e-12,
    `AP-a: worst relative identity deviation ${scan.worstIdentityDev}`,
  );
  assert.ok(
    scan.worstGSumDev < 1e-12,
    `AP-a: worst |sum g - 1| ${scan.worstGSumDev}`,
  );
  assert.ok(scan.minG >= 0, "AP-a: every emitted g_k is nonnegative");
});

test("T8.A the equality characterization, both directions on tied menus", () => {
  // two rounds TIED at the minimum: cycling between them attains equality —
  // the E10 spec's literal "iff single-round cycle" was convicted here first
  const tied = noBeatingRow([2, 4], [0.25, 0.5], [0, 1]);
  assert.ok(tied.atEquality, "cycling tied argmin rounds attains the minimum");
  assert.ok(tied.supportInsideArgmin);
  assert.ok(tied.characterizationHolds);
  // one suboptimal round in the support: strictly above the minimum
  // (menu {(2,0.25),(4,0.4)}: ratios 8 and 10, the argmin is round 0 alone)
  const mixed = noBeatingRow([2, 4], [0.25, 0.4], [0, 1, 1]);
  assert.ok(
    !mixed.atEquality,
    "a suboptimal round in the support loses strictly",
  );
  assert.ok(!mixed.supportInsideArgmin);
  assert.ok(mixed.slack > 1e-9, `strict slack ${mixed.slack}`);
  // the best single-round cycle itself: equality, trivially
  const single = noBeatingRow([2, 4], [0.25, 0.4], [0]);
  assert.ok(single.atEquality && single.supportInsideArgmin);
});

test("T8.A hand example: the convex ledger against a hand-summed geometric series", () => {
  // menu {(1, 1/2), (3, 1/2)}; schedule [0,1] cycles rounds with equal halves.
  // R_0 = 1, R_1 = 1/2, R_2 = 1/4, ... each full cycle keeps prob 1/4.
  // T = sum_k R_k c_k = (1*1 + (1/2)*3)/(1 - 1/4) = 2.5/0.75 = 10/3.
  const conv = payConvexLedger([1, 3], [0.5, 0.5], [0, 1]);
  const T = payExpected([1, 3], [0.5, 0.5], [0, 1]);
  assert.ok(Math.abs(T - 10 / 3) < 1e-12, `renewal path ${T} vs hand 10/3`);
  assert.ok(
    Math.abs(conv.weighted - 10 / 3) < 1e-12,
    `convex path ${conv.weighted} vs hand 10/3`,
  );
  assert.deepEqual(conv.usedRounds, [0, 1]);
});

test("T8.D negative control, the model split: the early-stop winner is always-pay-convicted", () => {
  const row = modelSplitRow(geometricDist(50, 0.1));
  assert.ok(
    row.splitHolds,
    "the truncated geometric run-on regime must split the models",
  );
  assert.ok(
    row.earlyStopStar.t > 1,
    `early-stop optimum is a deep cutoff (t=${row.earlyStopStar.t})`,
  );
  assert.ok(
    row.earlyStopStar.value < row.earlyStopLambda1 - 1e-9,
    "early-stop: the deep cutoff beats cutoff 1",
  );
  assert.ok(
    row.earlyStopWinnerPays > row.alwaysPayStar.value * 1.1,
    `always-pay: winner pays ${row.earlyStopWinnerPays} vs best round ${row.alwaysPayStar.value}`,
  );
  assert.ok(
    row.splitFactor > 5,
    `the split factor ${row.splitFactor} is sharp`,
  );
  // two more split witnesses on the scan families (machine-prechecked: the
  // run-on regime is where partial-progress credit pays)
  assert.ok(
    modelSplitRow(firstMarkDist(256, 4)).splitHolds,
    "the uniform first-mark scan splits the models",
  );
  assert.ok(modelSplitRow(firstMarkDist(64, 8)).splitHolds);
  // the honest converse, machine-witnessed: when the early-stop optimum IS
  // cutoff 1, the two models meet at the same best round — split=false is a
  // legal state, not a theorem failure (powerLaw(100,1.5), bimodal: es.t=1)
  for (const p of [powerLawDist(100, 1.5), bimodalDist()]) {
    const meet = modelSplitRow(p);
    assert.equal(meet.earlyStopStar.t, 1);
    assert.equal(meet.splitHolds, false);
    assert.ok(
      Math.abs(meet.earlyStopWinnerPays - meet.alwaysPayStar.value) < 1e-9,
    );
  }
});

test("T8.E audit face: a pay quote below the menu minimum is named and rejected", () => {
  const bad = checkPayQuoteClaim({
    costs: [1, 3],
    probs: [0.25, 0.5],
    claimedExpectedPay: 3.9,
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.name, "PAY-QUOTE-COUNTERFEIT");
  const good = checkPayQuoteClaim({
    costs: [1, 3],
    probs: [0.25, 0.5],
    claimedExpectedPay: 6.1,
  });
  assert.equal(good.ok, true); // min c/p = 4 < 6.1 <= every real schedule's pay
});

test("T8.F error face: the named refusals", () => {
  assert.throws(
    () => payConvexLedger([1], [0.5], []),
    (e) => isKernelError(e) && e.code === "EMPTY-SCHEDULE",
  );
  assert.throws(
    () => payConvexLedger([1, 1], [0.5], [0]),
    (e) => isKernelError(e) && e.code === "BAD-ROUND-PROBABILITY",
  );
  assert.throws(
    () => payConvexLedger([1], [0.5], [7]),
    (e) => isKernelError(e) && e.code === "CUTOFF-NOT-PRECOMPUTED",
  );
  assert.throws(
    () => payConvexLedger([0], [0.5], [0]),
    (e) => isKernelError(e) && e.code === "BAD-ROUND-PROBABILITY",
  );
  assert.throws(
    () => noBeatingScan([], 0),
    (e) => isKernelError(e) && e.code === "BAD-HORIZON",
  );
  assert.throws(
    () => syntheticMenus(1, 0),
    (e) => isKernelError(e) && e.code === "BAD-HORIZON",
  );
});
