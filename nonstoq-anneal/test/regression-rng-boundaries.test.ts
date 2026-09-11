import { strict as assert } from "node:assert";
import { test } from "node:test";
import { NonstoqError } from "../src/core/errors.js";
import { Rng } from "../src/core/rng.js";

function assertCode(code: "RngIntDomain" | "RngRangeDomain", fn: () => unknown): void {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof NonstoqError, `expected NonstoqError [${code}], got: ${String(err)}`);
    assert.equal(err.code, code);
    return;
  }
  assert.fail(`expected NonstoqError [${code}], nothing threw`);
}

/**
 * The 2026-09-11 second-pass conviction: this rng (a byte-twin of
 * ft-qaoa's, both registered own-lineage at the census) was the last
 * unguarded mulberry32 in the workspace — int(2.5) drew a biased 40/40/20
 * index, int(0)/int(-3)/int(Infinity) returned impossible indices, and
 * range(3, 1) drew descending garbage, all silently on the object every
 * seeded repro depends on. The refusals sit BEFORE any draw, so legal
 * seeded streams are bit-identical to the unguarded era.
 */
test("regression: Rng.int refuses non-integer and out-of-domain bounds (was: silently biased or impossible draws)", () => {
  assertCode("RngIntDomain", () => new Rng(1).int(0));
  assertCode("RngIntDomain", () => new Rng(1).int(-3));
  assertCode("RngIntDomain", () => new Rng(1).int(2.5));
  assertCode("RngIntDomain", () => new Rng(1).int(Infinity));
  // the refusal consumes no draw: the stream is untouched by a failed ask
  const r = new Rng(42);
  assert.throws(() => r.int(0));
  assert.equal(r.next(), 0.6011037519201636);
});

test("regression: Rng.range refuses reversed and non-finite intervals (was: descending garbage and NaN draws)", () => {
  assertCode("RngRangeDomain", () => new Rng(1).range(3, 1));
  assertCode("RngRangeDomain", () => new Rng(1).range(NaN, 2));
  assertCode("RngRangeDomain", () => new Rng(1).range(0, Infinity));
  // legal neighbors: the mulberry32 stream is pinned bit-exactly (the shared
  // family fingerprint — the same draw sequence the qram-sched trial pins)
  const a = new Rng(42);
  assert.deepEqual([a.int(7), a.int(7), a.int(7)], [4, 3, 5]);
  const b = new Rng(7);
  assert.equal(b.range(-0.5, 0.5), -0.4882952468469739);
  assert.equal(b.range(-0.5, 0.5), -0.43804174242541194);
  // the degenerate-but-well-defined constant interval stays legal
  assert.equal(new Rng(9).range(5, 5), 5);
});
