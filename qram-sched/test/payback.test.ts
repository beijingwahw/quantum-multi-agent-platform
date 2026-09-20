import test from "node:test";
import assert from "node:assert/strict";
import {
  OFF_GRID_P_BANK,
  FAILURE_BUDGET,
  minimalPhaseQubits,
  hoeffdingSamples,
  paybackModel,
  paybackThreshold,
  totalQuantumCost,
  totalClassicalCost,
  bruteForceThreshold,
  criticalAddressBits,
  epsilonStar,
  auditPaybackClaim,
} from "../src/qram/payback.js";
import { qaeQueries, qaeMedianError } from "../src/ae/ampest.js";
import { activeNodes } from "../src/qram/bucket.js";
import { QramError } from "../src/core/errors.js";

test("payback: the EXP1-D anchor reproduces bit-for-bit (nb=20, eps=0.01 -> T*=1493)", () => {
  const model = paybackModel(20, 0.01);
  // every field against EXP1-D's own census row (exp1-qram.ts section D)
  assert.equal(model.m, 8);
  assert.equal(model.queries, 255);
  assert.equal(model.samples, 18445);
  assert.equal(model.loadQuantum, 2 ** 20 * 20);
  assert.equal(model.perTaskQuantum, 5100);
  assert.equal(model.perTaskClassical, 18445);
  assert.equal(model.loadNet, 2 ** 20 * 19);
  const threshold = paybackThreshold(model);
  assert.ok(threshold.feasible);
  assert.equal(threshold.denominator, 13345);
  assert.equal(threshold.Tstar, 1493);
  // the ledger identity at the threshold itself: caught up exactly at T*
  assert.ok(
    totalQuantumCost(model, threshold.Tstar) <=
      totalClassicalCost(model, threshold.Tstar),
  );
  // ...and one task earlier it has NOT caught up (T* is minimal)
  assert.ok(
    totalQuantumCost(model, threshold.Tstar - 1) >
      totalClassicalCost(model, threshold.Tstar - 1),
  );
});

test("payback: closed form equals the task-by-task ledger brute force on the parameter grid", () => {
  for (const nb of [6, 10, 16, 20]) {
    for (const eps of [0.05, 0.02, 0.01, 0.005]) {
      const model = paybackModel(nb, eps);
      const threshold = paybackThreshold(model);
      const brute = bruteForceThreshold(model, 200000);
      if (threshold.feasible) {
        assert.ok(
          threshold.Tstar <= 200000,
          `grid point nb=${nb} eps=${eps}: T* ${threshold.Tstar} inside the scan cap`,
        );
        assert.equal(
          brute.Tstar,
          threshold.Tstar,
          `nb=${nb} eps=${eps}: brute force vs closed form`,
        );
      } else {
        assert.equal(
          brute.Tstar,
          null,
          `nb=${nb} eps=${eps}: no crossover inside the cap (PB-b)`,
        );
      }
    }
  }
});

test("payback: the infeasible domain is exactly { samples <= queries * nb } (PB-b)", () => {
  for (const eps of [0.05, 0.02, 0.01]) {
    const { thresholdNb, samples, queries } = criticalAddressBits(eps);
    // the closed-form boundary inequality, both sides, exact integers
    assert.ok(queries * thresholdNb >= samples);
    assert.ok(queries * (thresholdNb - 1) < samples);
    if (thresholdNb <= 30) {
      // boundary inside the implementation domain: re-verify both sides
      const atBoundary = paybackModel(thresholdNb, eps);
      assert.ok(
        !paybackThreshold(atBoundary).feasible,
        `eps=${eps}: nb=${thresholdNb} sits in the infeasible domain`,
      );
      const belowBoundary = paybackModel(thresholdNb - 1, eps);
      assert.ok(paybackThreshold(belowBoundary).feasible);
      // the two non-negative terms of PB-b: Q(T)-C(T) grows linearly forever
      const gap1 =
        totalQuantumCost(atBoundary, 1) - totalClassicalCost(atBoundary, 1);
      const gap1000 =
        totalQuantumCost(atBoundary, 1000) -
        totalClassicalCost(atBoundary, 1000);
      assert.ok(gap1 > 0 && gap1000 > gap1);
      assert.ok(atBoundary.loadNet > 0); // the first term N*(n_b-1) > 0 for n_b >= 2
    } else {
      // boundary beyond n_b = 30: EVERY implementable memory is feasible
      for (let nb = 1; nb <= 30; nb++) {
        assert.ok(
          paybackThreshold(paybackModel(nb, eps)).feasible,
          `eps=${eps}: nb=${nb} feasible (boundary at ${thresholdNb} is outside the domain)`,
        );
      }
    }
  }
});

test("payback: eps crossover — unique sup-eps* with machine-enumerated holes (PB-c, machine form)", () => {
  // The R18 spec's monotone reading is REFUTED here, on the record: holes
  // exist AND a feasible island sits above the last hole (the two staircase
  // functions cross twice). What holds: sup-uniqueness of eps*, feasibility
  // from below up to the first hole, and the complete hole table inside
  // (0, eps*].
  const cross20 = epsilonStar(20);
  assert.ok(
    cross20.epsStar > 0.07 && cross20.epsStar < 0.08,
    `eps*(20) ~ 0.0775, got ${cross20.epsStar}`,
  );
  assert.ok(
    cross20.holes.length > 0,
    "the refutation witness: the feasible set is NOT an interval",
  );
  assert.ok(
    (cross20.holes[cross20.holes.length - 1] as number) < cross20.epsStar,
    "a feasible island lives above the last hole (the double crossing)",
  );
  assert.ok(
    cross20.feasibleFromBelow,
    "every grid point left of the first hole is feasible",
  );
  for (const hole of cross20.holes) {
    const model = paybackModel(20, hole);
    assert.ok(
      !paybackThreshold(model).feasible,
      `hole at eps=${hole} re-verified infeasible`,
    );
  }
  // the sup property: eps* itself feasible, one grid step past it infeasible
  assert.ok(paybackThreshold(paybackModel(20, cross20.epsStar)).feasible);
  // one grid step past eps*: infeasible (sup property)
  assert.ok(
    !paybackThreshold(paybackModel(20, cross20.epsStar + cross20.gridStep))
      .feasible,
  );
  // smaller memories cross later in eps (the tear survives coarser precision)
  const cross10 = epsilonStar(10);
  assert.ok(cross10.epsStar > cross20.epsStar);
});

test("payback audit: a below-threshold payback claim dies with the named ledger gap (PB-d)", () => {
  // the anchor's own counterfeit twin: claim T = 1492 (one task short of 1493)
  const verdict = auditPaybackClaim({
    nb: 20,
    eps: 0.01,
    breakEvenTasks: 1492,
  });
  assert.ok(!verdict.accepted);
  assert.equal(verdict.violations.length, 1);
  assert.equal(verdict.violations[0]!.name, "below-threshold-payback");
  assert.match(verdict.violations[0]!.detail, /T\* = 1493/);
  // the honest row passes
  assert.ok(
    auditPaybackClaim({ nb: 20, eps: 0.01, breakEvenTasks: 1493 }).accepted,
  );
});

test("payback audit: a payback claim inside the infeasible domain dies by name (PB-d)", () => {
  // eps = 0.1 at nb = 20: samples 185 < per-task quantum 300 -> never
  const model = paybackModel(20, 0.1);
  assert.ok(!paybackThreshold(model).feasible);
  const verdict = auditPaybackClaim({
    nb: 20,
    eps: 0.1,
    breakEvenTasks: 10 ** 6,
  });
  assert.ok(!verdict.accepted);
  assert.equal(verdict.violations[0]!.name, "infeasible-domain-payback");
  // the honest never-pay-back row on the same point passes
  assert.ok(
    auditPaybackClaim({ nb: 20, eps: 0.1, breakEvenTasks: null }).accepted,
  );
});

test("payback audit: a forged never-pay-back claim inside the feasible domain dies by name (PB-d)", () => {
  const verdict = auditPaybackClaim({ nb: 6, eps: 0.01, breakEvenTasks: null });
  assert.ok(!verdict.accepted);
  assert.equal(verdict.violations[0]!.name, "forged-infeasibility");
  assert.match(verdict.violations[0]!.detail, /T\* = 1/); // small memories amortize instantly
});

test("payback: symmetric billing and the n_b = 1 degenerate point", () => {
  // the classical opponent's one-off load is the full N (symmetric billing
  // declared in the model, not in prose); the quantum surcharge is N*(n_b-1)
  const model = paybackModel(10, 0.01);
  assert.equal(model.loadClassical, model.N);
  assert.equal(model.loadQuantum, model.N * activeNodes("bucket-brigade", 10));
  // n_b = 1: the surcharge vanishes (N*1 = N), so T* = 0 tasks — parity from
  // the first task on; the ledger still charges the per-task difference
  const degenerate = paybackModel(1, 0.01);
  assert.equal(degenerate.loadNet, 0);
  const threshold = paybackThreshold(degenerate);
  assert.ok(threshold.feasible);
  assert.equal(threshold.Tstar, 0);
  assert.ok(
    totalQuantumCost(degenerate, 1) < totalClassicalCost(degenerate, 1),
  );
});

test("payback: illegal inputs are rejected BY ERROR CODE (smuggling trial)", () => {
  // n_b out of domain
  assert.throws(
    () => paybackModel(0, 0.01),
    (e: unknown) => e instanceof QramError && e.code === "QRAM_ARG_RANGE",
  );
  assert.throws(
    () => paybackModel(31, 0.01),
    (e: unknown) => e instanceof QramError && e.code === "QRAM_ARG_RANGE",
  );
  // eps out of domain (0 and 1 excluded: 1 is trivial, 0 is unreachable)
  assert.throws(
    () => minimalPhaseQubits(0),
    (e: unknown) => e instanceof QramError && e.code === "QRAM_ARG_RANGE",
  );
  assert.throws(
    () => hoeffdingSamples(1),
    (e: unknown) => e instanceof QramError && e.code === "QRAM_ARG_RANGE",
  );
  // audit's own domain door (named verdict, not a throw)
  const verdict = auditPaybackClaim({ nb: -3, eps: 0.01, breakEvenTasks: 5 });
  assert.ok(!verdict.accepted);
  assert.equal(verdict.violations[0]!.name, "domain");
  // non-integer break-even rows are refused rather than rounded
  const fractional = auditPaybackClaim({
    nb: 20,
    eps: 0.01,
    breakEvenTasks: 1492.5,
  });
  assert.ok(!fractional.accepted);
  assert.equal(fractional.violations[0]!.name, "domain");
});

test("payback: the QAE requirement uses the off-grid bank, never the degenerate p = 1/2", () => {
  // p = 1/2 sits exactly on every phase grid — the degenerate best case that
  // must not set the register size (exp1-qram.ts's own census guard)
  assert.ok(!OFF_GRID_P_BANK.includes(0.5));
  // the requirement is the WORST bank median error: m* clears eps on every
  // bank point, and one register lower fails somewhere on the bank
  const eps = 0.01;
  const m = minimalPhaseQubits(eps);
  for (const p of OFF_GRID_P_BANK) {
    assert.ok(
      qaeMedianError(p, m) <= eps,
      `bank point p=${p} cleared at m*=${m}`,
    );
  }
  // one register lower fails SOMEWHERE on the bank (m* is minimal)
  assert.ok(OFF_GRID_P_BANK.some((q) => qaeMedianError(q, m - 1) > eps));
  assert.equal(qaeQueries(m), 2 ** m - 1);
  assert.equal(FAILURE_BUDGET, 0.05); // the EXP4-B convention is frozen
});
