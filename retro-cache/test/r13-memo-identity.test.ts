/**
 * R13 (agent J) — the pure-function memoization contract. The W5 hot paths
 * (paMeasure, bscBlockInfo, collisionCensus, inverseCensus, the gfMul lookup
 * table) now cache their exact enumerations per process; the caches must be
 * invisible: a repeat call returns the very value the uncached path computed
 * (bit-identical, and in fact the same object), and every named rejection
 * keeps its code and its order.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cmatZero, jointTable, mutualInfoBits } from "../src/kernel/state.js";
import { bscBlockInfo, collisionCensus, gfMul, inverseCensus, paMeasure } from "../src/kernel/amplify.js";
import { RcError } from "../src/kernel/state.js";

test("r13 memoization is invisible: repeat calls return the identical result", () => {
  // paMeasure: same object back, fields untouched
  const a1 = paMeasure(4, 2, 0.25);
  const a2 = paMeasure(4, 2, 0.25);
  assert.equal(a2.afterMean, a1.afterMean);
  assert.equal(a2.tvFamilyMixed, a1.tvFamilyMixed);
  assert.equal(a2.beforeTable, a1.beforeTable);
  // bscBlockInfo: two-path values reproduce
  const b1 = bscBlockInfo(4, 0.25);
  const b2 = bscBlockInfo(4, 0.25);
  assert.equal(b2.closed, b1.closed);
  assert.equal(b2.table, b1.table);
  // census faces
  assert.deepEqual(collisionCensus(8, 4), collisionCensus(8, 4));
  assert.deepEqual(inverseCensus(8), inverseCensus(8));
  // the gfMul anchor rides the same arithmetic the lookup table was built from
  assert.equal(gfMul(0x57, 0x83, 8), 0xc1);
});

test("r13 mutualInfoBits keeps its named refusals in the documented order", () => {
  // empty -> ragged-positive (total check passes) -> zero -> negative weight
  assert.throws(() => mutualInfoBits([]), (e: unknown) => e instanceof RcError && e.code === "RC_EMPTY_TABLE");
  assert.throws(
    () => mutualInfoBits([[0.5, 0.5], [0.5, 0.5, 0.5]]),
    (e: unknown) => e instanceof RcError && e.code === "RC_RAGGED_TABLE",
  );
  assert.throws(() => mutualInfoBits([[0, 0], [0, 0]]), (e: unknown) => e instanceof RcError && e.code === "RC_ZERO_TABLE");
  assert.throws(
    () => mutualInfoBits([[0.75, 0.25], [0.25, -0.25]]),
    (e: unknown) => e instanceof RcError && e.code === "RC_NEG_PROB",
  );
  // and the value path still matches the direct definition on a known table
  // (uniform joint = independent: MI exactly 0)
  assert.equal(mutualInfoBits([[0.25, 0.25], [0.25, 0.25]]), 0);
});

test("r13 jointTable keeps its dimension refusal after the projector hoist", () => {
  assert.throws(() => jointTable(cmatZero(2), [0, 0, 1], [0, 0, 1]), (e: unknown) => e instanceof RcError && e.code === "RC_DIM");
});
