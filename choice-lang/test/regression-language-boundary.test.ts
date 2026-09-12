import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { branchProduct, conditionOnPattern, controlState, membershipExpectation, runProgram, type Program } from "../src/kernel/lang.js";
import { leaf, node, pathSlotPattern, runTerm, termIsometry, termPaths } from "../src/kernel/compose.js";
import { iteratedProgram, loopTrajectory } from "../src/kernel/iterate.js";
import { ChoiceLangError } from "../src/core/errors.js";
import { mAdd, mMul } from "../src/core/cmat.js";
import { engineeredUnitary, worldProjector, worldState, DATA_DIM } from "../src/kernel/fixtures.js";
import { identity, mat } from "../src/core/cmat.js";

/**
 * Regression: the language boundary's degenerate-input holes.
 *
 * The sibling waves' convicted classes, found alive in this package:
 * - a FRACTIONAL loop bound read membership[1.5] off the ledger (undefined)
 *   and reported telescopeResidual NaN; iteratedProgram(1.5) silently
 *   self-composed twice; k = Infinity never left the iteration loop;
 * - the nested runner accepted the non-finite control angle the flat runner
 *   refuses by name (runTerm/termIsometry/termPaths/controlState all routed
 *   NaN silently — guard asymmetry between the two execution folds);
 * - a pattern bit of value 2 (runtime-smuggled past the 0|1 union, the same
 *   doctrine UntrustedModelRow documents) silently routed through u0 in
 *   branchProduct, through the 1-branch in pathSlotPattern, and was
 *   misreported as "probability 0" in conditionOnPattern;
 * - a NaN register weight sailed past `p <= 0` (NaN compares false against
 *   everything) and divided the conditional through by NaN silently.
 */
function assertRejects(fn: () => unknown, code: string, needle: RegExp): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ChoiceLangError, `expected a ChoiceLangError, got ${String(err)}`);
    assert.equal(err.code, code);
    assert.match(err.message, needle);
    return true;
  });
}

describe("R1 the loop bound is a whole number of iterations, refused by name otherwise", () => {
  const body: Program = [{ theta: 0.75, u0: engineeredUnitary(501), u1: engineeredUnitary(502) }];
  const piW = worldProjector();

  it("a fractional k is refused — it used to read membership[1.5] (undefined) and report a NaN residual", () => {
    // pre-fix probe: loopTrajectory(body, worldState(), 1.5, piW).telescopeResidual === NaN
    assertRejects(() => loopTrajectory(body, worldState(), 1.5, piW), "LOOP_BOUND", /whole number/);
    assertRejects(() => iteratedProgram(body, 1.5), "LOOP_BOUND", /whole number/);
  });

  it("a non-finite k is refused — k = Infinity used to spin the iteration loop forever", () => {
    assertRejects(() => loopTrajectory(body, worldState(), Number.POSITIVE_INFINITY, piW), "LOOP_BOUND", /whole number/);
    assertRejects(() => iteratedProgram(body, Number.NaN), "LOOP_BOUND", /whole number/);
  });

  it("legal bounds k = 1 and k = 2 still price exactly as before (ledger bit-identical to the flat run)", () => {
    for (const k of [1, 2]) {
      const traj = loopTrajectory(body, worldState(), k, piW);
      const flat = membershipExpectation(runProgram(iteratedProgram(body, k), worldState()), piW, DATA_DIM);
      assert.equal(traj.membership.length, k + 1);
      assert.equal(traj.membership[k], flat, `k=${k}: the layered ledger must stay bit-identical to the flat program`);
    }
    assert.equal(iteratedProgram(body, 2).length, 2);
  });
});

describe("R2 every control-preparation site refuses a non-finite angle by name (STEP_THETA)", () => {
  const nanTree = node(Number.NaN, leaf(engineeredUnitary(1)), leaf(engineeredUnitary(2)));

  it("the nested runner refuses what the flat runner refuses — runTerm/termIsometry used to route NaN silently", () => {
    // pre-fix probe: runTerm(nanTree, worldState()).re[0] === NaN while
    // runProgram on the same theta threw STEP_THETA
    assertRejects(() => runTerm(nanTree, worldState()), "STEP_THETA", /non-finite control angle/);
    assertRejects(() => termIsometry(nanTree, DATA_DIM), "STEP_THETA", /non-finite control angle/);
    assertRejects(() => termIsometry(node(Number.POSITIVE_INFINITY, leaf(engineeredUnitary(1)), leaf(engineeredUnitary(2))), DATA_DIM), "STEP_THETA", /non-finite/);
  });

  it("termPaths refuses a non-finite angle — its weights used to come back NaN", () => {
    // pre-fix probe: termPaths(nanTree).map(p => p.weight) === [NaN, NaN]
    assertRejects(() => termPaths(nanTree), "STEP_THETA", /non-finite control angle/);
  });

  it("controlState refuses a non-finite angle — the preparation runOnRegister guards", () => {
    // pre-fix probe: controlState(NaN).re[0] === NaN, silently
    assertRejects(() => controlState(Number.NaN), "STEP_THETA", /non-finite control angle/);
  });

  it("legal angles still prepare the exact same control state and path weights", () => {
    const c = controlState(0.9);
    assert.equal(c.re[0], Math.cos(0.9) ** 2);
    assert.equal(c.re[3], Math.sin(0.9) ** 2);
    const tree = node(0.7, leaf(engineeredUnitary(401)), leaf(engineeredUnitary(402)));
    const paths = termPaths(tree);
    assert.equal(paths[0]!.weight, Math.cos(0.7) ** 2);
    assert.equal(paths[1]!.weight, Math.sin(0.7) ** 2);
  });
});

describe("R3 a pattern bit outside {0, 1} is refused by name, never silently routed", () => {
  const twoStep: Program = [
    { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
    { theta: 1.0, u0: engineeredUnitary(9), u1: engineeredUnitary(10) },
  ];

  it("branchProduct refuses an illegal bit — bit 2 used to read as 0 and route through u0", () => {
    // pre-fix probe: branchProduct(twoStep, [2, 0]) was silently identical
    // to branchProduct(twoStep, [0, 0]) — `2 === 1` is false, exactly the
    // wave-4 undefined-bit mechanism one layer up
    assertRejects(() => branchProduct(twoStep, [2, 0] as unknown as ReadonlyArray<0 | 1>), "PATTERN_ARITY", /bit 1 is 2, not 0 or 1/);
    assertRejects(() => branchProduct(twoStep, [0, -1] as unknown as ReadonlyArray<0 | 1>), "PATTERN_ARITY", /bit 2 is -1, not 0 or 1/);
  });

  it("conditionOnPattern names the illegal bit — it used to misreport it as probability 0", () => {
    const fin = runProgram(twoStep, worldState());
    // pre-fix probe: the same bit threw ZERO_PROBABILITY, blaming the physics
    // instead of the smuggled bit
    assertRejects(() => conditionOnPattern(fin, 2, [2, 0] as unknown as ReadonlyArray<0 | 1>, DATA_DIM), "PATTERN_ARITY", /bit 1 is 2, not 0 or 1/);
  });

  it("pathSlotPattern refuses an illegal bit — bit 2 used to route through the 1-branch", () => {
    // pre-fix probe: pathSlotPattern(singleNodeTree, [2]) returned [2],
    // having silently taken t1
    const tree = node(0.7, leaf(engineeredUnitary(401)), leaf(engineeredUnitary(402)));
    assertRejects(() => pathSlotPattern(tree, [2] as unknown as ReadonlyArray<0 | 1>), "PATTERN_ARITY", /path bit is 2, not 0 or 1/);
  });

  it("legal bits still denote the exact same products", () => {
    const viaTen = branchProduct(twoStep, [1, 0]);
    const byHand = mMul(twoStep[1]!.u0, twoStep[0]!.u1); // newest step's factor sits leftmost
    assert.deepEqual(viaTen.re, byHand.re);
    assert.deepEqual(viaTen.im, byHand.im);
  });
});

describe("R4 a non-finite pattern weight cannot divide the conditional silently", () => {
  it("a NaN register entry is refused under ZERO_PROBABILITY — `p <= 0` used to compare false against NaN", () => {
    // pre-fix probe: a 16x16 register with re[0] = NaN conditioned to
    // { p: NaN, conditional.re[0]: NaN } with no refusal at all
    const nanRho = { rows: 16, cols: 16, re: new Float64Array(16 * 16), im: new Float64Array(16 * 16) };
    nanRho.re[0] = Number.NaN;
    assertRejects(() => conditionOnPattern(nanRho, 2, [0, 0], DATA_DIM), "ZERO_PROBABILITY", /non-finite/);
  });

  it("legal weights are unchanged: the four patterns still partition unity", () => {
    const twoStep: Program = [
      { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
      { theta: 1.0, u0: engineeredUnitary(9), u1: engineeredUnitary(10) },
    ];
    const fin = runProgram(twoStep, worldState());
    let psum = 0;
    for (const b0 of [0, 1] as const) {
      for (const b1 of [0, 1] as const) psum += conditionOnPattern(fin, 2, [b0, b1], DATA_DIM).p;
    }
    assert.ok(Math.abs(psum - 1) < 1e-14);
  });
});

describe("R5 the core add refuses mismatched shapes by name — mAdd alone used to corrupt silently", () => {
  // the hole: mMul carried the MAT_SHAPE guard, mAdd did not — mAdd(2x2, 4x4)
  // read b's top-left block at a's offsets (a plausible WRONG value, the
  // nosignal-tariff "0.375 quietly" face) and mAdd(4x4, 2x2) laundered NaN
  // into the tail cells, while the suite's own T10 title claims "core shape
  // mismatches are named, not turned into silent NaN"
  it("mAdd refuses both mismatch directions by name (MAT_SHAPE)", () => {
    assertRejects(() => mAdd(mat(2, 2), mat(4, 4)), "MAT_SHAPE", /2x2 \+ 4x4/);
    assertRejects(() => mAdd(mat(4, 4), mat(2, 2)), "MAT_SHAPE", /4x4 \+ 2x2/);
    assertRejects(() => mAdd(mat(2, 3), mat(3, 2)), "MAT_SHAPE", /2x3 \+ 3x2/);
  });

  it("legal same-shape additions keep their exact cells", () => {
    const a = identity(4);
    const b = identity(4);
    const sum = mAdd(a, b);
    assert.equal(sum.re[0], 2);
    assert.equal(sum.re[5], 2);
    assert.equal(sum.re[1], 0);
    assert.equal(sum.im[0], 0);
    // stepOperator's own call shape (the live consumer) still computes: the
    // two branch-routing Kronecker terms of one step add exactly
    const u = engineeredUnitary(501);
    const p0 = mat(4, 4);
    p0.re[0] = 1;
    const p1 = mat(4, 4);
    p1.re[3 * 4 + 3] = 1;
    const viaAdd = mAdd(
      { rows: 4, cols: 4, re: new Float64Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), im: new Float64Array(16) },
      { rows: 4, cols: 4, re: new Float64Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]), im: new Float64Array(16) },
    );
    assert.equal(viaAdd.re[0], 1);
    assert.equal(viaAdd.re[15], 1);
    assert.ok(Number.isFinite(u.re[0]));
  });
});
