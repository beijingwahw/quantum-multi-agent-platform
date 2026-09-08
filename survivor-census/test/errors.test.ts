import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runPriorSorter } from "../src/kernel/survivor.js";
import { mcWaiting, schedule, tailAt, waitingPrice } from "../src/kernel/waitprice.js";
import { composeStages } from "../src/kernel/compose.js";
import { buildStagePairs } from "../src/experiments/instances.js";
import { CensusError, ERROR_CODES, expectFound } from "../src/kernel/errors.js";

/**
 * The error face (v0.3.0): every public entry's illegal input is NAMED and
 * rejected, and every refusal carries a machine-readable CensusError code.
 * These are the smuggling trials for contraband INPUT — the complement of
 * the census-law trials, which convict contraband CLAIMS.
 */

/** run the callable, demand a CensusError, return it for code inspection */
function refusal(fn: () => unknown): CensusError {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof CensusError, `expected CensusError, got ${String(e)}`);
    return e;
  }
  assert.fail("expected a refusal, the call succeeded");
}

function rejectsCode(fn: () => unknown, code: (typeof ERROR_CODES)[number]): void {
  const e = refusal(fn);
  assert.equal(e.code, code, `message was: ${e.message}`);
  assert.ok(e instanceof Error);
  assert.equal(e.name, "CensusError");
}

describe("the error face — every refusal is named by code", () => {
  it("the code vocabulary is closed (a snapshot — accidental renames break the discrimination contract)", () => {
    assert.deepEqual([...ERROR_CODES], [
      "SC/BAD-N",
      "SC/BAD-COUNTS",
      "SC/BAD-MARKED",
      "SC/BAD-PHASES",
      "SC/P0-UNDEFINED",
      "SC/EMPTY-INTERSECTION",
      "SC/P-DOMAIN",
      "SC/DELTA-DOMAIN",
      "SC/MC-BAD-INPUTS",
      "SC/INTERNAL",
      "ILLEGAL-CENSUS",
    ]);
  });

  it("runPriorSorter rejects illegal n, counts, marked and phases by name", () => {
    rejectsCode(() => runPriorSorter(-1, [], [0]), "SC/BAD-N");
    rejectsCode(() => runPriorSorter(1.5, [], [0]), "SC/BAD-N");
    rejectsCode(() => runPriorSorter(2, [1, 2, 3], [0]), "SC/BAD-COUNTS");
    rejectsCode(() => runPriorSorter(2, [1, -1, 1, 1], [0]), "SC/BAD-COUNTS");
    rejectsCode(() => runPriorSorter(2, [1, 0.5, 1, 1], [0]), "SC/BAD-COUNTS");
    rejectsCode(() => runPriorSorter(2, [0, 0, 0, 0], [0]), "SC/BAD-COUNTS");
    rejectsCode(() => runPriorSorter(2, [1, 1, 1, 1], []), "SC/BAD-MARKED");
    rejectsCode(() => runPriorSorter(2, [1, 1, 1, 1], [4]), "SC/BAD-MARKED");
    rejectsCode(() => runPriorSorter(2, [1, 1, 1, 1], [-1]), "SC/BAD-MARKED");
    rejectsCode(() => runPriorSorter(2, [1, 1, 1, 1], [0], [0, 1, 1]), "SC/BAD-PHASES");
    rejectsCode(() => runPriorSorter(2, [1, 1, 1, 1], [0], [0, Number.NaN, 1, 1]), "SC/BAD-PHASES");
    rejectsCode(() => runPriorSorter(2, [1, 1, 1, 1], [0], [0, 1, Number.POSITIVE_INFINITY, 1]), "SC/BAD-PHASES");
  });

  it("P=0 is SC/P0-UNDEFINED and the message still says 'undefined' (the tested prose contract)", () => {
    const e = refusal(() => runPriorSorter(2, [0, 1, 1, 1], [0]));
    assert.equal(e.code, "SC/P0-UNDEFINED");
    assert.match(e.message, /undefined/);
    assert.match(e.message, /no funded optimum/);
  });

  it("legal inputs at the validation boundary still run (the rejections added no false positives)", () => {
    // n=0 (single universe), counts with zeros but positive total, phases all finite
    const run = runPriorSorter(0, [5], [0], [0.25]);
    assert.equal(run.N, 1);
    assert.equal(run.pKeep, 1);
  });

  it("waitingPrice, schedule, tailAt and mcWaiting reject domain violations by name", () => {
    rejectsCode(() => waitingPrice(0), "SC/P-DOMAIN");
    rejectsCode(() => waitingPrice(-0.5), "SC/P-DOMAIN");
    rejectsCode(() => waitingPrice(1.5), "SC/P-DOMAIN");
    rejectsCode(() => waitingPrice(Number.NaN), "SC/P-DOMAIN");
    rejectsCode(() => schedule(0, 1e-6), "SC/P-DOMAIN");
    rejectsCode(() => schedule(1, 1e-6), "SC/P-DOMAIN");
    rejectsCode(() => schedule(0.5, 0), "SC/DELTA-DOMAIN");
    rejectsCode(() => schedule(0.5, 1), "SC/DELTA-DOMAIN");
    rejectsCode(() => schedule(0.5, -1e-6), "SC/DELTA-DOMAIN");
    rejectsCode(() => tailAt(1, 3), "SC/P-DOMAIN");
    rejectsCode(() => tailAt(0.5, 1.5), "SC/MC-BAD-INPUTS");
    rejectsCode(() => tailAt(0.5, -1), "SC/MC-BAD-INPUTS");
    rejectsCode(() => mcWaiting(0, 10, () => 0.5), "SC/P-DOMAIN");
    // runs=0 used to divide by zero and return a silent NaN — now it is named
    rejectsCode(() => mcWaiting(0.5, 0, () => 0.5), "SC/MC-BAD-INPUTS");
    rejectsCode(() => mcWaiting(0.5, 10.5, () => 0.5), "SC/MC-BAD-INPUTS");
  });

  it("composeStages names the smuggled out-of-range stage-B mark it used to drop silently", () => {
    // v0.2.0 behavior: markedB=[0,99] filtered to [0] and the composition ran,
    // the illegal address vanishing without a name — the conviction case
    rejectsCode(() => composeStages(2, [1, 1, 1, 1], [0, 1], [0, 99]), "SC/BAD-MARKED");
    rejectsCode(() => composeStages(2, [1, 1, 1, 1], [0, 99], [0, 1]), "SC/BAD-MARKED");
    rejectsCode(() => composeStages(2, [1, 1, 1, 1], [], [0]), "SC/BAD-MARKED");
    rejectsCode(() => composeStages(2, [1, 1, 1, 1], [0, 1], []), "SC/BAD-MARKED");
    rejectsCode(() => composeStages(2, [1, 2, 3], [0], [1]), "SC/BAD-COUNTS");
  });

  it("the starved intersection is SC/EMPTY-INTERSECTION on both starvation paths, with the cause preserved", () => {
    const starved = buildStagePairs().find((p) => p.name === "starved-intersection");
    assert.ok(starved);
    const e = refusal(() => composeStages(starved.n, starved.counts, starved.markedA, starved.markedB));
    assert.equal(e.code, "SC/EMPTY-INTERSECTION");
    assert.match(e.message, /undefined/);

    // the second starvation path: the intersection is non-empty but holds no
    // funded optimum — the P=0 face inherited through the chain, cause intact
    const funded = refusal(() => composeStages(2, [0, 1, 1, 1], [0, 1], [0, 2]));
    assert.equal(funded.code, "SC/EMPTY-INTERSECTION");
    assert.ok(funded.cause instanceof CensusError);
    assert.equal(funded.cause.code, "SC/P0-UNDEFINED");
  });

  it("expectFound names a failed lookup instead of leaking undefined into arithmetic", () => {
    const e = refusal(() => expectFound<number>("no such thing", undefined));
    assert.equal(e.code, "SC/INTERNAL");
    assert.match(e.message, /no such thing/);
    assert.equal(expectFound("present", 7), 7);
  });
});
