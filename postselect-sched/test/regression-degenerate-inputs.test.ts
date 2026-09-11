import test from "node:test";
import assert from "node:assert/strict";
import { isKernelError } from "../src/kernel/errors.js";
import { modelsOf, repetitionsFor } from "../src/kernel/ppledger.js";
import { Rng } from "../src/kernel/sorter.js";
import { geometricRounds } from "../src/experiments/exp-t4-contact.js";

/** the smuggling-trial form: a refusal must be a NAMED KernelError code */
function rejects(fn: () => unknown, code: string): void {
  assert.throws(fn, (e: unknown) => {
    assert.ok(isKernelError(e), `threw ${String(e)} — not a KernelError`);
    assert.equal(e.code, code);
    return true;
  });
}

test("geometricRounds refuses degenerate q (q <= 0 used to spin FOREVER, q > 1 to skip the draw)", () => {
  // before the guard, q = 0 looped endlessly (`rng.next() < 0` never fires)
  // and q = 1.5 "succeeded" on round 1 without a draw — the same conviction
  // class as the v0.3.0 randomSat hang
  const rng = new Rng(1);
  rejects(() => geometricRounds(rng, 0), "BAD-ROUND-PROBABILITY");
  rejects(() => geometricRounds(rng, -0.5), "BAD-ROUND-PROBABILITY");
  rejects(() => geometricRounds(rng, 1.5), "BAD-ROUND-PROBABILITY");
  // negative controls: q = 1 succeeds on the first round; q = 1/2 terminates
  assert.equal(geometricRounds(new Rng(5), 1), 1);
  assert.ok(geometricRounds(new Rng(5), 0.5) >= 1);
});

test("modelsOf refuses malformed literals (were silently mis-evaluated bits)", () => {
  // before the guard: literal 0 shifted by -1 and read bit 31 (clause
  // silently became just "x_0"); |lit| > n read a bit no assignment ever
  // sets — a permanently-false ghost literal corrupting model counts
  rejects(() => modelsOf({ n: 2, clauses: [[0, 1, 1]] }), "BAD-LITERAL");
  rejects(() => modelsOf({ n: 1, clauses: [[2, 1, 1]] }), "BAD-LITERAL");
  rejects(() => modelsOf({ n: 2, clauses: [[1.5, 1, 1]] }), "BAD-LITERAL");
  // negative controls: the boundary literals +/-n are legal
  assert.deepEqual(modelsOf({ n: 1, clauses: [[1, 1, 1]] }), [1]);
  assert.deepEqual(modelsOf({ n: 1, clauses: [[-1, -1, -1]] }), [0]);
});

test("repetitionsFor refuses gap > 1/2 (a distance from 1/2 cannot exceed 1/2)", () => {
  // before the guard, repetitionsFor(0.7, 0.1) returned 3 silently — an
  // impossible gap whose vote-error input 1/2 + gap > 1 is nonsense
  rejects(() => repetitionsFor(0.7, 0.1), "BAD-GAP");
  rejects(() => repetitionsFor(1.5, 0.1), "BAD-GAP");
  // negative control: gap = 1/2 (deterministic readout) is the legal boundary
  assert.ok(repetitionsFor(0.5, 0.1) >= 1);
});
