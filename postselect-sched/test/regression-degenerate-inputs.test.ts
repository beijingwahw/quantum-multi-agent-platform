import test from "node:test";
import assert from "node:assert/strict";
import { isKernelError } from "../src/kernel/errors.js";
import { modelsOf, repetitionsFor } from "../src/kernel/ppledger.js";
import { eStarGrover, payStarMenu, zeroOptimal } from "../src/kernel/restart.js";
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

test("eStarGrover and zeroOptimal refuse t outside 1..N (t=0 used to hang the k-scan FOREVER)", () => {
  // before the guard, theta = asin(sqrt(0/N)) = 0 made the scan bound
  // hi = ceil(pi/(4*0)) = Infinity — the sweep loop never exits and blocks
  // the event loop (the bqp-map grover conviction's twin in this repo);
  // t > N made theta NaN and silently shipped {queries: Infinity}
  rejects(() => eStarGrover(256, 0), "BAD-MARKED-COUNT");
  rejects(() => zeroOptimal(256, 0), "BAD-MARKED-COUNT");
  rejects(() => eStarGrover(256, 257), "BAD-MARKED-COUNT");
  rejects(() => zeroOptimal(256, 256.5), "BAD-MARKED-COUNT");
  rejects(() => eStarGrover(256, -1), "BAD-MARKED-COUNT");
  // negative controls: the legal neighbors still quote — the t=1 endpoint is
  // the pure sorter's own ledger, and t=N is the fully marked space
  const e1 = eStarGrover(256, 1);
  assert.ok(e1.queries > 0 && Number.isFinite(e1.queries));
  assert.equal(zeroOptimal(256, 1), false, "at t=1 amplification must win");
  assert.ok(zeroOptimal(256, 256));
});

test("payStarMenu refuses unvalidated round menus (payExpected's discipline, was: silent Infinity optimum)", () => {
  // before the guard: no round with a valid probability shipped
  // {value: Infinity, t: 0} as a plausible optimum; p > 1 was accepted; a
  // short probs table silently ignored the rounds it did not cover
  rejects(() => payStarMenu([1, 2], [0, 0]), "BAD-ROUND-PROBABILITY");
  rejects(() => payStarMenu([1, 2], [0.5, 1.5]), "BAD-ROUND-PROBABILITY");
  rejects(() => payStarMenu([1, 2], [0.5]), "BAD-ROUND-PROBABILITY");
  rejects(() => payStarMenu([1, 2], [0.5, Number.NaN]), "BAD-ROUND-PROBABILITY");
  // negative controls: the legal menu still prices — the cheapest c/p wins
  // (1/0.5 = 2 vs 2/0.25 = 8), and p = 1 is the legal endpoint
  const star = payStarMenu([1, 2], [0.5, 0.25]);
  assert.equal(star.value, 2);
  assert.equal(star.t, 0);
  assert.equal(payStarMenu([3], [1]).value, 3);
});
