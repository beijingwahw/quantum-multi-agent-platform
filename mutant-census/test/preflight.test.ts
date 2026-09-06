/**
 * THE PRE-FLIGHT GATE — G5's coverage law and the witness-letter guard,
 * both live.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRiskCard, checkPreflightCoverage } from "../src/experiments/preflight.js";
import { assertUniqueWitnessLetters } from "../src/experiments/render.js";
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
  const cards = [buildRiskCard("burial-record", registry.errors)]; // every other repo's card missing
  const problems = checkPreflightCoverage(cards, registry.errors, registry.batchCount);
  assert.ok(problems.some((p) => /no card at all/.test(p)), problems.join("; "));
  // and a card with a hole: strip one recent family from dtc-clock's card
  const dtc = buildRiskCard("dtc-clock", registry.errors);
  const holed = { repo: "dtc-clock", rows: dtc.rows.filter((r) => r.family !== "cat:wrong-object") };
  const all = [holed, ...cards.filter((c) => c.repo !== "dtc-clock")];
  const holes = checkPreflightCoverage(all, registry.errors, registry.batchCount);
  assert.ok(holes.some((p) => /omits/.test(p)), holes.join("; "));
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
