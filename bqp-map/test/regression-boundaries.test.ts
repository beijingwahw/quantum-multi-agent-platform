/**
 * Regression tests for boundary defects fixed in this upgrade — one block per
 * provable defect, each pinning the NEW enforced contract (and, where cheap,
 * the nearest still-valid boundary so the guards cannot over-reject):
 *
 *  1. optimalK / groverRun with zero marked items used to be a SYNCHRONOUS
 *     INFINITE LOOP (theta = 0 => sweep bound ceil(pi/(4*theta)) = Infinity);
 *     it blocked the event loop so hard even a timer escape could not fire.
 *  2. genYesInstance with a B where no triple in [lo, hi] sums to B
 *     (B = 4, 5, 8, ...) used to spin forever in its rejection loop.
 *  3. median/fitSlope on empty (and mismatched) inputs used to return silent
 *     NaN out of undefined-arithmetic casts.
 *  4. hoeffdingShots with eps <= 0 or delta outside (0, 1) used to return
 *     NaN/Infinity shot counts downstream.
 *  5. Rng.pick([]) used to return `undefined as T` — silent, type-unsafe.
 *  6. minMakespanPm/bruteForceMakespanPm with m < 1 used to return
 *     Infinity/0 silently (the m^n referee degenerated to NaN indexing).
 *  7. dhMin on an empty valuation used to return a NaN-valued result marked
 *     non-optimal instead of rejecting the input.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../src/core/rng.js";
import { fitSlope, hoeffdingShots, median } from "../src/core/stats.js";
import { bruteForceMakespanPm, minMakespanP2, minMakespanPm } from "../src/reductions/makespan.js";
import { genYesInstance, isThreePartitionSolution, solveAndDecode } from "../src/reductions/threepartition.js";
import { groverRun, optimalK } from "../src/upper/grover.js";
import { arrayValuation, dhMin } from "../src/upper/dhmin.js";

describe("regression: degenerate search densities no longer hang", () => {
  it("optimalK rejects t < 1 and t > N (t = 0 used to loop forever)", () => {
    assert.throws(() => optimalK(16, 0), /need 1 <= t <= N/);
    assert.throws(() => optimalK(16, 17), /need 1 <= t <= N/);
    // the tight boundary stays callable
    assert.equal(optimalK(16, 16), 0); // everything marked: k* = 0 is already optimal
  });

  it("groverRun rejects an empty marked set (used to loop forever via optimalK)", () => {
    assert.throws(() => groverRun(256, []), /at least one marked item/);
  });
});

describe("regression: genYesInstance rejects impossible B instead of spinning", () => {
  it("B in {4, 5, 8}: no triple in [lo, hi] sums to B — now a throw", () => {
    for (const B of [4, 5, 8]) {
      assert.throws(() => genYesInstance(new Rng(1), 2, B), new RegExp(`no triple in \\[\\d+, \\d+\\] sums to B=${B}`));
    }
  });

  it("feasible boundary B values (6, 7, 9) still generate genuine YES instances", () => {
    for (const B of [6, 7, 9]) {
      const inst = genYesInstance(new Rng(B), 2, B);
      const d = solveAndDecode(inst);
      assert.ok(d.solution.makespan <= B);
      assert.ok(isThreePartitionSolution(inst, d.groups));
    }
  });
});

describe("regression: stats helpers reject empty/mismatched inputs instead of NaN", () => {
  it("median throws on empty (used to return NaN via undefined casts)", () => {
    assert.throws(() => median([]), /empty input/);
    assert.equal(median([5]), 5);
  });

  it("fitSlope throws on empty and on length mismatch (used to be silent NaN / truncated fit)", () => {
    assert.throws(() => fitSlope([], []), /empty input/);
    assert.throws(() => fitSlope([1, 2, 3], [1, 2]), /length mismatch/);
    assert.equal(fitSlope([1, 2], [2, 4]), 2);
  });

  it("hoeffdingShots throws on eps <= 0 and delta outside (0, 1)", () => {
    assert.throws(() => hoeffdingShots(0, 0.1, 2), /eps must be positive/);
    assert.throws(() => hoeffdingShots(1, 0, 2), /delta must be in \(0, 1\)/);
    assert.throws(() => hoeffdingShots(1, 1, 2), /delta must be in \(0, 1\)/);
    assert.equal(hoeffdingShots(1, 0.1, 2), 6); // pinned anchor unchanged
  });
});

describe("regression: rng and solver boundary contracts enforced", () => {
  it("Rng.pick throws on empty (used to return undefined as T)", () => {
    assert.throws(() => new Rng(1).pick([]), /items must be non-empty/);
    assert.equal(new Rng(1).pick([42]), 42);
  });

  it("minMakespanPm and bruteForceMakespanPm reject m < 1 (used to return Infinity/0 silently)", () => {
    assert.throws(() => minMakespanPm([3, 1], 0), /at least one machine/);
    assert.throws(() => bruteForceMakespanPm([3, 1], 0), /at least one machine/);
    // degenerate-but-valid boundaries unchanged
    assert.equal(minMakespanP2([]), 0);
    assert.equal(minMakespanPm([], 3).makespan, 0);
    assert.equal(bruteForceMakespanPm([], 3), 0);
    assert.equal(minMakespanPm([5], 2).makespan, 5);
  });

  it("dhMin rejects an empty valuation (used to return NaN garbage marked non-optimal)", () => {
    assert.throws(() => dhMin(arrayValuation([]), new Rng(3)), /valuation must be non-empty/);
  });
});
