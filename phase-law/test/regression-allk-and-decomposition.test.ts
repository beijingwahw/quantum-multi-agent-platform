import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coupledRegimeOptimum,
  enumerateAll,
  hungarianMax,
  kPairAllRegimeOptimum,
  kPairOptimum,
  makeInstance,
  makeKPairInstance,
} from "../src/kernel/law.js";
import { makeNuInstance, nuAllKOptimum } from "../src/kernel/nonuniform.js";

/**
 * Regression: the all-k right face beyond m = 2k, and the decomposition's
 * single-task corner.
 *
 * Before the fix, kPairAllRegimeOptimum accepted any m >= 2k but built its
 * slot matrix as m x 2k and fed it to hungarianMax — which requires rows <=
 * columns — so every m > 2k instance DIED inside the solver with the shape
 * error of a matrix the caller never meant ("hungarianMax requires tasks <=
 * agents"), while the documented rest-matching machinery sat unreachable
 * below it. The non-uniform twin (nuAllKOptimum, PL19) had already grown the
 * coverage-forced Hungarian that handles m > 2k in one pass — the uniform
 * twin was stale. And coupledRegimeOptimum at m = 1 returned -Infinity as a
 * confident number (no ordered task pair exists; the λ-guarded sibling entry
 * point could never reach it, the direct caller got the silent -Infinity).
 */
describe("R2 the all-k right face computes its documented quantity at m > 2k", () => {
  it("m > 2k equals the enumerated optimum (was: crash inside hungarianMax's own shape law)", () => {
    // (6,8,k=2) at λ=8: the enumerated optimum realizes both pairs (the all-k regime)
    const inst = makeKPairInstance(6, 8, 800, 8, 2);
    const opt = kPairOptimum(inst);
    assert.equal(opt.pairs, 2, "λ=8 must sit in the all-k regime on this cell");
    assert.ok(Math.abs(kPairAllRegimeOptimum(inst) - opt.welfare) < 1e-9, `${kPairAllRegimeOptimum(inst)} vs ${opt.welfare}`);
    // a second seed, same shape
    const inst2 = makeKPairInstance(6, 8, 1600, 8, 2);
    assert.equal(kPairOptimum(inst2).pairs, 2);
    assert.ok(Math.abs(kPairAllRegimeOptimum(inst2) - kPairOptimum(inst2).welfare) < 1e-9);
  });

  it("the coverage-forced road and the non-uniform twin agree on their shared domain (no twin drift)", () => {
    // uniform λ is the k-fold copy of the non-uniform vector: both roads must
    // return the same optimum for the same weights at m > 2k
    for (const seed of [800, 1600, 500]) {
      const uni = makeKPairInstance(6, 8, seed, 8, 2);
      const nu = makeNuInstance(6, 8, seed, [8, 8]);
      assert.ok(Math.abs(kPairAllRegimeOptimum(uni) - nuAllKOptimum(nu)) < 1e-9, `seed ${seed}`);
    }
  });

  it("the pinned m = 2k road stays integer-exact (frozen expectation, byte-identical)", () => {
    for (const s of [1, 2]) {
      const inst = makeKPairInstance(4, 6, 800 * s, 8, 2);
      assert.equal(kPairOptimum(inst).pairs, 2);
      assert.equal(Math.abs(kPairAllRegimeOptimum(inst) - kPairOptimum(inst).welfare), 0);
    }
  });

  it("m > n is refused in the instance's own name, not the solver's", () => {
    // 7 tasks, 6 agents: hungarianMax would throw ITS shape law from deep
    // inside — the guard names the actual object mismatch first
    assert.throws(() => kPairAllRegimeOptimum(makeKPairInstance(7, 6, 800, 8, 2)), /m <= n/);
  });

  it("the R1 2k guards still fire at their positions (legal-neighbor pin)", () => {
    assert.throws(() => kPairAllRegimeOptimum(makeKPairInstance(6, 4, 500, 8, 3)), /n >= 2k/);
    assert.throws(() => kPairAllRegimeOptimum(makeKPairInstance(3, 6, 800, 8, 2)), /m >= 2k/);
    // hungarianMax itself keeps its raw shape law for direct callers
    assert.throws(() => hungarianMax([[1, 2], [3, 4], [5, 6]]), /tasks <= agents/);
  });
});

describe("R2 the coupled-regime decomposition refuses the single-task corner by name", () => {
  it("m = 1 is refused (was: silent -Infinity from an empty pair loop)", () => {
    assert.throws(() => coupledRegimeOptimum(makeInstance(1, 3, 500, 5)), /m >= 2/);
  });

  it("legal cells still compute: the decomposition matches enumeration above the hinge", () => {
    // 3x5, λ = 10 (above every hinge on this family): the ordered-pair +
    // matching decomposition must equal the enumerated optimum exactly
    const inst = makeInstance(3, 5, 600, 10);
    let best = -Infinity;
    for (const a of enumerateAll(inst)) best = Math.max(best, a.welfare);
    assert.ok(Math.abs(coupledRegimeOptimum(inst) - best) < 1e-12, `${coupledRegimeOptimum(inst)} vs ${best}`);
  });
});
