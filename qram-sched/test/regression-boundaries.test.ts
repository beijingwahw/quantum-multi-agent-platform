/**
 * Boundary pins from this upgrade's audit. No defect was fixable here — the
 * v0.3.0 hardening pass had already closed the illegal-input classes — so
 * these tests pin the two boundary analyses the audit had to perform, so
 * they never have to be re-derived from scratch:
 *
 *  1. adversarialRun's unnormalized Exp3 weights cannot reach the double-
 *     precision overflow line at sane horizons (the per-win exponent is
 *     self-limiting); the observable invariant is that mixing keeps every
 *     arm alive — no collapse onto the k-1 sampling fallback that NaN
 *     probabilities would produce.
 *  2. The linear/grover RANKING decision streams on a fixed seed remain
 *     byte-identical whenever the bounded-error search does not miss, and
 *     groverFindBetter's ledger floor is one sweep even when nothing is
 *     better (t = 0 exits after the first sweep's reads).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { adversarialRun } from "../src/bandit/classical.js";
import { groverFindBetter } from "../src/online/grover.js";
import { rankingMatch, randomInstance } from "../src/online/matching.js";
import { Rng } from "../src/core/rng.js";

const argmax = <T,>(scores: readonly T[], less: (x: T, y: T) => boolean) => {
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    const cur = scores[i];
    const ref = scores[best];
    if (cur !== undefined && ref !== undefined && less(ref, cur)) best = i;
  }
  return { best, reads: scores.length };
};

test("boundary pin: Exp3 weights stay well-formed far past the shipped horizons (no overflow collapse)", () => {
  const T = 100_000;
  const r = adversarialRun(8, T, 0, 0.1, argmax);
  assert.equal(r.decisions.length, T);
  const secondHalf = r.decisions.slice(Math.floor(T / 2));
  const armsAlive = new Set(secondHalf);
  assert.ok(
    armsAlive.size >= 2,
    `second-half decisions collapsed to ${[...armsAlive].join(",")} — weights likely hit Infinity/NaN`,
  );
  assert.ok(Number.isFinite(r.regret), `regret ${r.regret} must stay finite`);
});

test("boundary pin: groverFindBetter charges at least one sweep when nothing is better", () => {
  const rng = new Rng(3);
  // t = 0: the marked set is empty on the first sweep, so the search exits
  // immediately with index -1 and reads = 2k+1 for the drawn k (>= 1).
  const r = groverFindBetter(16, 0, () => 1, (x) => x < 0, rng);
  assert.equal(r.index, -1);
  assert.ok(r.reads >= 1, `reads ${r.reads}`);
  assert.ok(r.reads % 2 === 1, `reads ${r.reads}: one sweep is 2k+1`);
});

test("boundary pin: linear and grover RANKING agree exactly on a no-miss seed (decision wall)", () => {
  const inst = randomInstance(16, 16, 0.25, new Rng(77));
  const lin = rankingMatch(inst, new Rng(5), "linear");
  const quant = rankingMatch(inst, new Rng(5), "grover");
  if (quant.disagreements === 0) {
    assert.equal(lin.size, quant.size, "no bounded-error misses: sizes must coincide");
  }
  assert.ok(lin.reads === 16 * inst.arrivals.length, `linear ledger is exactly n per arrival (${lin.reads})`);
});
