/**
 * THE PRE-FLIGHT GATE — G5's coverage law and the witness-letter guard,
 * both live.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRiskCard, checkPreflightCoverage, hotFamilies } from "../src/experiments/preflight.js";
import { assertUniqueWitnessLetters } from "../src/experiments/report.js";
import { loadLiveRegistry } from "../src/kernel/bridge.js";

test("G5: the pre-flight card covers every family sighted in the last ten batches (live)", async () => {
  const registry = await loadLiveRegistry();
  const repos = [...new Set(registry.errors.map((e) => e.repo))];
  const cards = repos.map((r) => buildRiskCard(r, registry.errors));
  assert.deepEqual(checkPreflightCoverage(cards, registry.errors, registry.batchCount), []);
  // the card carries the rules: the dtc-clock card's rows quote the right column
  const dtc = cards.find((c) => c.repo === "dtc-clock");
  assert.ok(dtc, "dtc-clock has a card");
  assert.ok(dtc.rows.length >= 3, `dtc-clock card rows ${dtc.rows.length}`);
  assert.ok(dtc.rows.every((r) => r.rule.length > 0), "every row carries its rule");
});

test("G5 bites: a card that omits a recent family is convicted by name", async () => {
  const registry = await loadLiveRegistry();
  // the fixture follows the DATA: the repo that owns the LATEST batch can
  // never age out of the ten-batch window, and burial-record owns it every
  // wiring batch (the b50#4 lesson's shape — the dtc-clock fixture this
  // replaced aged out at batch 83, its last sighting b73 falling below the
  // moved horizon with nothing in-window left to omit)
  const latestBatch = Math.max(...registry.errors.map((e) => e.batch));
  const fixtureRepo = registry.errors.find((e) => e.batch === latestBatch)!.repo;
  const cards = [buildRiskCard(fixtureRepo, registry.errors)]; // every other repo's card missing
  const problems = checkPreflightCoverage(cards, registry.errors, registry.batchCount);
  assert.ok(problems.some((p) => /no card at all/.test(p)), problems.join("; "));
  // and a card with a hole: strip the card's FIRST family — the most-recently
  // sighted, so the fixture follows the live data instead of hardcoding a
  // family (or a repo) that ages out of the ten-batch window
  const wired = buildRiskCard(fixtureRepo, registry.errors);
  const victim = wired.rows[0]!.family;
  const holed = { repo: fixtureRepo, rows: wired.rows.filter((r) => r.family !== victim) };
  const holes = checkPreflightCoverage([holed], registry.errors, registry.batchCount);
  assert.ok(holes.some((p) => new RegExp(`omits[^;]*${victim}`).test(p)), holes.join("; "));
});

test("the witness-letter guard: a forged report headlining two censuses under one letter is refused", () => {
  const forged = [
    "# forged",
    "- PASS — W-G anchor census (fine)",
    "- PASS — W-G genealogy census (the b46#5 collision, replayed)",
  ].join("\n");
  assert.throws(() => { assertUniqueWitnessLetters(forged); }, /witness letters must be unique/);
  // the honest roster passes
  assert.doesNotThrow(() => { assertUniqueWitnessLetters("- PASS — W-G anchor census (x)\n- PASS — W-H genealogy census (y)"); },
  );
});

test("the hot-family summary: sighted within the last three batches, and the single-repo card runs step 0", async () => {
  const registry = await loadLiveRegistry();
  // the assertion follows the DATA: whichever repo owns the latest batch is hot
  const latestBatch = Math.max(...registry.errors.map((e) => e.batch));
  const latestRepo = registry.errors.find((e) => e.batch === latestBatch)!.repo;
  const card = buildRiskCard(latestRepo, registry.errors);
  const hot = hotFamilies(card.rows, registry.batchCount);
  assert.ok(hot.length >= 1, `${latestRepo} owns batch ${latestBatch} and must be hot`);
  assert.ok(hot.every((r) => r.latestBatch > registry.batchCount - 3));
  const cold = card.rows.filter((r) => !hot.includes(r));
  assert.ok(cold.every((r) => r.latestBatch <= registry.batchCount - 3));
});

test("the reports-freshness verdict: sources moved after the last render are convicted as STALE (the repro-no-op face)", async () => {
  const { freshnessVerdict, reportsFreshness } = await import("../src/experiments/preflight.js");
  // the pure trials: every shape of the signal, convicted by name
  assert.equal(freshnessVerdict(2000, 1000), "STALE", "src newer than the newest report is the repro-no-op shape");
  assert.equal(freshnessVerdict(1000, 2000), "FRESH", "a render that postdates every source is fresh");
  assert.equal(freshnessVerdict(1000, 1000), "FRESH", "equal mtimes: the render reflects the sources");
  assert.equal(freshnessVerdict(1000, null), "NO-REPORTS", "sources with no render at all");
  assert.equal(freshnessVerdict(null, 1000), "NO-SRC", "a report with no src tree to answer to");
  // the live smoke: the census itself carries reports and a src tree, and the
  // gatherer's fields agree with the verdict (whatever it is — the signal
  // predicts, it does not gate; the gated face is S2's artifact check)
  const f = reportsFreshness("mutant-census");
  assert.ok(f.reportCount >= 1, "the census renders reports");
  assert.ok(f.newestSrcMs !== null, "the census has a src tree");
  assert.equal(f.verdict, freshnessVerdict(f.newestSrcMs, f.newestReportMs));
});
