import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { realizationCheck, runPriorSorter, Rng } from "../src/kernel/survivor.js";
import { mcWaiting, waitingPrice } from "../src/kernel/waitprice.js";
import { composeStages } from "../src/kernel/compose.js";
import { runPhaseCensus } from "../src/kernel/phasecensus.js";
import { buildInstances } from "../src/experiments/instances.js";
import { CensusError } from "../src/kernel/errors.js";
import { TOL } from "../src/kernel/tol.js";

/** run the callable, demand a CensusError, return it for code inspection */
function refusal(fn: () => unknown): CensusError {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof CensusError, `expected CensusError, got ${String(e)}`);
    return e;
  }
  assert.fail("expected a refusal, the call succeeded");
}

describe("regression: named refusals on degenerate and out-of-domain input (no silent NaN/garbage)", () => {
  it("a fractional or NaN marked address is refused by name — never a silent P=0 census", () => {
    // convicted: marked=[0.5] slipped the bare range check (both comparisons
    // false), counts[0.5] read undefined, and the run RETURNED pKeep=0 with a
    // zero survivor and odds=Infinity — the exact face the kernel refuses by
    // name for integer P=0 inputs
    const e = refusal(() => runPriorSorter(2, [1, 1, 1, 1], [0.5]));
    assert.equal(e.code, "SC/BAD-MARKED");
    assert.equal(refusal(() => runPriorSorter(2, [1, 1, 1, 1], [Number.NaN])).code, "SC/BAD-MARKED");
    assert.equal(refusal(() => composeStages(2, [1, 1, 1, 1], [0.5], [0, 1])).code, "SC/BAD-MARKED");
    assert.equal(refusal(() => composeStages(2, [1, 1, 1, 1], [0, 1], [1.5])).code, "SC/BAD-MARKED");
    // the legal integer neighbor is unchanged: the uniform half keeps its
    // posterior and kill register (amplitude-path squares are float — TOL)
    const legal = runPriorSorter(2, [1, 1, 1, 1], [0, 1]);
    assert.equal(legal.pKeep, 0.5);
    assert.ok(Math.abs(legal.posterior[0]! - 0.5) < TOL);
    assert.ok(Math.abs(legal.posterior[1]! - 0.5) < TOL);
    assert.equal(legal.killRegister.length, 2);
    assert.ok(Math.abs(legal.oddsPerSurvivor - 1) < TOL);
  });

  it("waitingPrice refuses p below the float64 resolution of 1-p — the false-zero floor", () => {
    // convicted: at p=1e-17 the partial-sum path printed meanPartial = 0 (the
    // truth is 1e17 — a false zero below the 2.2e-16 floor), and at p=1e-320
    // it printed NaN (60/p overflowed the exponent)
    const e = refusal(() => waitingPrice(1e-17));
    assert.equal(e.code, "SC/P-DOMAIN");
    assert.match(e.message, /false zero/);
    assert.equal(refusal(() => waitingPrice(1e-320)).code, "SC/P-DOMAIN");
    // the legal neighbors keep their exact values: the grid anchor 2^-20 and
    // the first representable grade above the floor, 2^-52
    const anchor = waitingPrice(2 ** -20);
    assert.equal(anchor.meanClosedForm, 2 ** 20);
    assert.ok(anchor.meanDev < 1e-10, `2^-20 meanDev ${anchor.meanDev}`);
    const floor = waitingPrice(2 ** -52);
    assert.ok(floor.meanPartial > 0.999 * floor.meanClosedForm, `2^-52 partial ${floor.meanPartial} vs ${floor.meanClosedForm}`);
    assert.ok(floor.meanDev < 1e-6 * floor.meanClosedForm, `2^-52 relative dev ${(floor.meanDev / floor.meanClosedForm).toExponential(2)}`);
  });

  it("mcWaiting at the legal endpoint p=1 reports sigmaUnits = 0, never NaN (0/0)", () => {
    // convicted: sigma = sqrt((1-p)/p^2)/sqrt(runs) is exactly 0 at p=1 and
    // |mean - 1/p|/0 printed NaN as the referee verdict
    const rng = new Rng(1203);
    const mc = mcWaiting(1, 100, () => rng.next());
    assert.equal(mc.mean, 1);
    assert.equal(mc.sigmaUnits, 0);
    // the interior neighbor still referees normally
    const rng2 = new Rng(1204);
    const interior = mcWaiting(0.5, 2000, () => rng2.next());
    assert.ok(Number.isFinite(interior.sigmaUnits));
    assert.ok(Math.abs(interior.mean - 2) < 0.1, `mean ${interior.mean}`);
  });

  it("realizationCheck refuses trials=0 by name and reports an honest 0 on the t=1 posterior", () => {
    // convicted: trials=0 divided by zero into a NaN waiting referee while
    // its sibling mcWaiting already refused runs=0 by name
    const e = refusal(() => realizationCheck(2, [1, 1, 1, 1], [0], 11, 0));
    assert.equal(e.code, "SC/MC-BAD-INPUTS");
    assert.equal(refusal(() => realizationCheck(2, [1, 1, 1, 1], [0], 11, 10.5)).code, "SC/MC-BAD-INPUTS");
    // the t=1 posterior (p=1) used to hit 0/0, and the NaN silently lost the
    // max-fold — reporting a perfect 0 it never measured; now it measures it
    const t1 = buildInstances().find((i) => i.name === "t1-fund");
    assert.ok(t1);
    const rc = realizationCheck(t1.n, t1.counts, t1.marked, 11, 500);
    assert.ok(Number.isFinite(rc.worstSurvivorSigma));
    assert.ok(Number.isFinite(rc.waitingSigma));
    assert.ok(rc.waitingSigma < 5, `waiting ${rc.waitingSigma} sigma`);
  });

  it("runPhaseCensus and composeStages name a bad n by name (SC/BAD-N), not a RangeError or a misnamed code", () => {
    // convicted: runPhaseCensus(1.5, ...) died as an opaque RangeError from
    // new Array(2**1.5), and composeStages(1.5, ...) misnamed the same input
    // SC/BAD-COUNTS — runPriorSorter names SC/BAD-N for both
    assert.equal(refusal(() => runPhaseCensus(1.5, [1, 1, 1, 1], [0])).code, "SC/BAD-N");
    assert.equal(refusal(() => runPhaseCensus(-1, [1], [0])).code, "SC/BAD-N");
    assert.equal(refusal(() => composeStages(1.5, [1, 2, 3], [0], [1])).code, "SC/BAD-N");
    assert.equal(refusal(() => composeStages(-1, [1, 2, 3, 4], [0], [1])).code, "SC/BAD-N");
    // the legal small neighbor runs the full census unhindered
    const census = runPhaseCensus(2, [1, 2, 3, 4], [0, 2]);
    assert.ok(census.rows.length >= 7, "eight families censused");
    assert.equal(census.ledgerPhaseBlindnessDev, 0);
    // and the legal composition neighbor keeps its exact chain book
    const run = composeStages(2, [1, 1, 1, 1], [0, 1], [1]);
    assert.equal(run.p1, 0.5);
    assert.ok(Math.abs(run.p2 - 0.5) < TOL);
    assert.ok(Math.abs(run.runAB.pKeep - 0.25) < TOL);
    assert.ok(run.chainDev < TOL);
    assert.ok(run.orderDev < TOL);
  });
});
