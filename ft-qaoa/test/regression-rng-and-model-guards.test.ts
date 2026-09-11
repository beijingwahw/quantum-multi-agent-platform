import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FtQaoaError } from "../src/core/errors.js";
import { Rng } from "../src/core/rng.js";
import { energies } from "../src/core/ising.js";
import type { IsingModel } from "../src/core/ising.js";
import { goldenMax, optimizeRampT } from "../src/qaoa/optimize.js";
import { linearRamp, interp } from "../src/qaoa/params.js";

function assertCode(code: string, fn: () => unknown): void {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof FtQaoaError, `expected FtQaoaError [${code}], got: ${String(err)}`);
    assert.equal(err.code, code);
    return;
  }
  assert.fail(`expected FtQaoaError [${code}], nothing threw`);
}

/**
 * The 2026-09-11 second-pass convictions, plus the missing trials for the
 * R3 model/optimizer guards (they shipped with no tests of their own).
 *
 * The rng pair (this file and the byte-twin in nonstoq-anneal) was the last
 * unguarded mulberry32 lineage in the workspace: int(2.5) drew a biased
 * 40/40/20 index, int(0)/int(-3)/int(Infinity) returned impossible indices,
 * and range(3, 1) drew descending garbage — all silently, on the one object
 * every seeded repro depends on. The refusals sit BEFORE any draw, so legal
 * seeded streams are bit-identical to the unguarded era.
 */
test("regression: Rng.int refuses non-integer and out-of-domain bounds (was: silently biased or impossible draws)", () => {
  assertCode("RNG_INT_RANGE", () => new Rng(1).int(0));
  assertCode("RNG_INT_RANGE", () => new Rng(1).int(-3));
  assertCode("RNG_INT_RANGE", () => new Rng(1).int(2.5));
  assertCode("RNG_INT_RANGE", () => new Rng(1).int(Infinity));
  // the refusal consumes no draw: the stream is untouched by a failed ask
  const r = new Rng(42);
  assert.throws(() => r.int(0), /RNG_INT_RANGE/);
  assert.equal(r.next(), 0.6011037519201636);
});

test("regression: Rng.range refuses reversed and non-finite intervals (was: descending garbage and NaN draws)", () => {
  assertCode("RNG_RANGE", () => new Rng(1).range(3, 1));
  assertCode("RNG_RANGE", () => new Rng(1).range(NaN, 2));
  assertCode("RNG_RANGE", () => new Rng(1).range(0, Infinity));
  // legal neighbors: the mulberry32 stream is pinned bit-exactly
  const a = new Rng(42);
  assert.deepEqual([a.int(7), a.int(7), a.int(7)], [4, 3, 5]);
  const b = new Rng(7);
  assert.equal(b.range(-0.5, 0.5), -0.4882952468469739);
  assert.equal(b.range(-0.5, 0.5), -0.43804174242541194);
  // the degenerate-but-well-defined constant interval stays legal
  assert.equal(new Rng(9).range(5, 5), 5);
});

test("regression: energies refuses a stray fields row (was: silently read as a constant)", () => {
  const stray: IsingModel = { n: 2, fields: [1, 2, 3], couplings: [] };
  assertCode("FIELDS_LENGTH_MISMATCH", () => energies(stray));
});

test("regression: energies refuses malformed coupling indices (was: k >= 32 wrapped the bit shift silently)", () => {
  assertCode("COUPLING_INDEX_INVALID", () => energies({ n: 2, fields: [0, 0], couplings: [{ j: 0, k: 32, w: 1 }] }));
  assertCode("COUPLING_INDEX_INVALID", () => energies({ n: 2, fields: [0, 0], couplings: [{ j: 1, k: 0, w: 1 }] }));
  assertCode("COUPLING_INDEX_INVALID", () => energies({ n: 2, fields: [0, 0], couplings: [{ j: 0.5, k: 1, w: 1 }] }));
  // legal neighbor: the 2-qubit model by hand, z_j = +1 on bit 0, -1 on bit 1
  const legal: IsingModel = { n: 2, fields: [0.5, -0.5], couplings: [{ j: 0, k: 1, w: 1.5 }] };
  assert.deepEqual(Array.from(energies(legal)), [1.5, -2.5, -0.5, 1.5]);
});

test("regression: goldenMax refuses a reversed or non-finite bracket (was: silent garbage extremum)", () => {
  assertCode("GOLDEN_BRACKET_INVALID", () => goldenMax(Math.cos, 1, 0, 30));
  assertCode("GOLDEN_BRACKET_INVALID", () => goldenMax(Math.cos, NaN, 1, 30));
  // legal neighbor: max of cos on [-1, 1] is exactly 1 at x = 0
  const r = goldenMax(Math.cos, -1, 1, 40);
  assert.ok(r.fx > 0.999);
  assert.ok(Math.abs(r.x) < 0.01);
});

test("regression: optimizeRampT refuses a non-positive or reversed time window (was: NaN log grid)", () => {
  const model: IsingModel = { n: 2, fields: [0.5, -0.5], couplings: [{ j: 0, k: 1, w: 1.5 }] };
  const energyOf = energies(model);
  assertCode("RAMP_T_RANGE_INVALID", () => optimizeRampT(model, energyOf, 2, { tMin: 0 }));
  assertCode("RAMP_T_RANGE_INVALID", () => optimizeRampT(model, energyOf, 2, { tMin: 2, tMax: 1 }));
  assertCode("RAMP_T_RANGE_INVALID", () => optimizeRampT(model, energyOf, 0.5, {}));
  // legal neighbor: a tiny search still tunes and returns a finite window
  const tuned = optimizeRampT(model, energyOf, 1, { tMin: 0.05, tMax: 1, gridSize: 4, iters: 6 });
  assert.ok(Number.isFinite(tuned.totalTime) && tuned.totalTime >= 0.05 && tuned.totalTime <= 1);
  assert.ok(Number.isFinite(tuned.expectation));
});

test("regression: interp refuses non-integer or zero depths (was: undefined angles injected into the schedule)", () => {
  assertCode("INTERP_DEPTH_INVALID", () => interp(linearRamp(2, 1), 0));
  assertCode("INTERP_DEPTH_INVALID", () => interp(linearRamp(2, 1), 1.5));
  // legal neighbor: a p=2 ramp resampled onto 4 layers stays 4 long
  const up = interp(linearRamp(2, 1), 4);
  assert.equal(up.gammas.length, 4);
  assert.equal(up.betas.length, 4);
  // and pTarget === p is the identity
  const same = interp(linearRamp(3, 1), 3);
  assert.deepEqual(same.gammas, linearRamp(3, 1).gammas);
});
