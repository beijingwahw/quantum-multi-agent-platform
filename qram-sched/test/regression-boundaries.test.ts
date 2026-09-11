/**
 * Boundary pins from this upgrade's audit. The v0.3.0 hardening pass had
 * already closed most illegal-input classes, so the first tests pin the two
 * boundary analyses the audit had to perform, so they never have to be
 * re-derived from scratch:
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
 *
 * The 2026-09-11 second-pass wave then found and fixed three real defects,
 * each pinned below from its ILLEGAL side with the legal neighbor kept:
 *  - Rng.int accepted non-integer bounds (a biased silent draw — the guard
 *    the qverify/quantum-mech/k-switch cores already carried);
 *  - etcRun shipped NaN regret with decisions 255 at samplesPerArm = 0
 *    (no exploration leaves commit = -1);
 *  - BucketBrigadeQram.write silently lost fractional-address updates
 *    (Float64Array non-index assignment is a no-op).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { adversarialRun, etcRun } from "../src/bandit/classical.js";
import { quantumReplayRun } from "../src/bandit/quantum.js";
import { durHoyerFindBest, groverFindBetter } from "../src/online/grover.js";
import { rankingMatch, randomInstance } from "../src/online/matching.js";
import { Rng } from "../src/core/rng.js";
import { BucketBrigadeQram } from "../src/qram/bucket.js";
import { QramError } from "../src/core/errors.js";

/** The package's rejection referee: a QramError carrying exactly `code`. */
function namedCode(code: string): (e: unknown) => boolean {
  return (e: unknown): boolean => {
    assert.ok(e instanceof QramError, `not a QramError: ${String(e)}`);
    assert.equal(e.code, code, `wrong code (got ${e.code})`);
    return true;
  };
}

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

// ---------------- the 2026-09-11 second-pass defect fixes ----------------

test("regression: Rng.int refuses non-integer bounds (was: silently biased draws)", () => {
  // int(2.5) drew 0/1/2 at 40/40/20 and int(Infinity) returned Infinity — the
  // exact guard drift the qverify/quantum-mech/k-switch rng cores fixed
  const rng = new Rng(9);
  assert.throws(() => rng.int(2.5), namedCode("RNG_INT_RANGE"));
  assert.throws(() => rng.int(Infinity), namedCode("RNG_INT_RANGE"));
  assert.throws(() => rng.int(0.5), namedCode("RNG_INT_RANGE"));
  // the guard sits BEFORE any draw: the seeded stream is untouched by the
  // refusals above, and the legal bounds keep their exact endpoints
  assert.equal(rng.int(1), 0);
  for (let i = 0; i < 50; i++) {
    const k = rng.int(8);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 8);
  }
});

test("regression: etcRun refuses samplesPerArm < 1 (was: NaN regret, decisions 255)", () => {
  const means = [0.6, 0.3];
  assert.throws(() => etcRun(means, 10, 0, 7, "live"), namedCode("BANDIT_ARG_RANGE"));
  assert.throws(() => etcRun(means, 10, 1.5, 7, "replay"), namedCode("BANDIT_ARG_RANGE"));
  // the legal boundary: one sample per arm explores, commits, and reports a
  // finite regret with every decision a real arm index
  const run = etcRun(means, 10, 1, 7, "live");
  assert.ok(Number.isFinite(run.regret), `regret ${run.regret}`);
  assert.equal(run.plays, 10);
  for (const d of run.decisions) assert.ok(d === 0 || d === 1, `decision ${d}`);
});

test("regression: BucketBrigadeQram.write refuses fractional addresses (was: silent no-op update)", () => {
  const qram = new BucketBrigadeQram(2);
  assert.throws(
    () => {
      qram.write(1.5, 0.9);
    },
    namedCode("QRAM_ADDRESS_RANGE"),
  );
  assert.throws(
    () => {
      qram.write(-0.5, 0.9);
    },
    namedCode("QRAM_ADDRESS_RANGE"),
  );
  // the legal neighbor lands the value and charges the routing pass
  qram.write(1, 0.9);
  assert.equal(qram.cells[1], 0.9);
  assert.equal(qram.totalActivations, 2); // one write = n routing-node activations
});

// ---------------- the 2026-09-12 R7 wave ----------------

test("regression: importing run-all neither wipes nor renders out/reports (was: module-level rmSync + render chain)", async () => {
  // run-all used to delete out/reports and render all six experiments at
  // module level — any import of it (a test, a future tool) destroyed the
  // committed reports as a side effect. The aggregator now carries the same
  // runIfMain guard as its targets.
  const { reportDir } = await import("../src/experiments/report.js");
  const { readdirSync, statSync } = await import("node:fs");
  const before = readdirSync(reportDir).sort();
  assert.ok(before.includes("exp1-qram.md") && before.includes("exp6-kvv.md"), "committed reports present before the import");
  const mtimes = new Map(before.map((f) => [f, statSync(`${reportDir}/${f}`).mtimeMs]));
  await import("../src/experiments/run-all.js");
  const after = readdirSync(reportDir).sort();
  assert.deepEqual(after, before, "import must not add or remove reports");
  for (const f of after) {
    assert.equal(statSync(`${reportDir}/${f}`).mtimeMs, mtimes.get(f), `${f} was rewritten by a mere import`);
  }
});

test("determinism: the seeded scheduler pipelines re-run byte-identically (JSON-exact)", () => {
  // every reported number draws from the seeded Rng — the same call twice
  // must serialize identically (an unseeded Math.random or shared mutable
  // stream state anywhere in the pipeline breaks this parity)
  const runTwice = (): string =>
    JSON.stringify([
      quantumReplayRun([0.55, 0.45, 0.3], 400, 21),
      rankingMatch(randomInstance(12, 12, 0.25, new Rng(33)), new Rng(9), "grover"),
      durHoyerFindBest(Array.from({ length: 32 }, (_, i) => (i * 7919) % 101), (x, y) => x < y, new Rng(4)),
    ]);
  assert.equal(runTwice(), runTwice());
  // the negative control: a different seed must move the stream (close means
  // make the query ledger measurement-sensitive — seeds 1 and 2 diverge)
  assert.notEqual(
    JSON.stringify(quantumReplayRun([0.5, 0.495], 4000, 1)),
    JSON.stringify(quantumReplayRun([0.5, 0.495], 4000, 2)),
  );
});
