/**
 * THE GENEALOGY GATE — the G-board's laws bite, and the catch ledger's
 * trend is the optimization metric the token demanded.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catchAgentOf,
  checkGenealogy,
  FAMILY_RESOLUTIONS,
  familyOf,
  genealogyCensus,
  witnessGenealogy,
  type FamilyResolution,
} from "../src/kernel/genealogy.js";
import { ENROLLMENT } from "../src/kernel/enrollment.js";
import { loadLiveRegistry } from "../src/kernel/bridge.js";

test("W-H: the genealogy census is legal over the live registry, and the gate fraction is rising", async () => {
  const { result, census } = await witnessGenealogy();
  assert.ok(result.pass, result.detail);
  assert.ok(census.families.length >= 15, `families ${census.families.length}`);
  assert.equal(census.catch.total, census.catch.gate + census.catch.author + census.catch.numbers + census.catch.visitor);
  // the optimization metric: the late era catches more by machine than the early era
  assert.ok(
    census.catch.lateGateFraction > census.catch.earlyGateFraction,
    `gate fraction must rise: early ${(census.catch.earlyGateFraction * 100).toFixed(0)}% vs late ${(census.catch.lateGateFraction * 100).toFixed(0)}%`,
  );
  // the visitor catch is exactly the b45#9 class — one, and now gate-held
  assert.equal(census.catch.visitor, 1);
  const cd = census.families.find((f) => f.family === "count-drift");
  assert.ok(cd, "the count-drift family exists");
  assert.equal(cd.latestTier, "GATE-ENFORCED");
});

test("G1: a resolution naming a family the registry does not carry is convicted", async () => {
  const registry = await loadLiveRegistry();
  const census = genealogyCensus(registry.errors, ENROLLMENT);
  const forged: FamilyResolution[] = [
    ...FAMILY_RESOLUTIONS,
    { family: "cat:mermaid-logic", holds: "GATE-ENFORCED", note: "a family that never was" },
  ];
  const v = checkGenealogy(census, forged);
  assert.ok(v.some((x) => x.law === "G1" && x.family === "cat:mermaid-logic"));
});

test("G2: a recurring family with no resolution row is convicted (a repeat offender held by nothing)", async () => {
  const registry = await loadLiveRegistry();
  const census = genealogyCensus(registry.errors, ENROLLMENT);
  const forged = FAMILY_RESOLUTIONS.filter((r) => r.family !== "shell-template-heredoc");
  const v = checkGenealogy(census, forged);
  assert.ok(v.some((x) => x.law === "G2" && x.family === "shell-template-heredoc" && /no resolution row/.test(x.detail)));
});

test("G2: a resolution whose tier drifted from the latest sighting's enrollment is convicted", async () => {
  const registry = await loadLiveRegistry();
  const census = genealogyCensus(registry.errors, ENROLLMENT);
  const forged: FamilyResolution[] = FAMILY_RESOLUTIONS.map((r) =>
    r.family === "count-drift" ? { ...r, holds: "BOOKED-UNENFORCEABLE" as const } : r,
  );
  const v = checkGenealogy(census, forged);
  assert.ok(v.some((x) => x.law === "G2" && x.family === "count-drift" && /drifted/.test(x.detail)));
});

test("G4: the count-drift family must be gate-held at its latest sighting — a downgrade is convicted", async () => {
  const registry = await loadLiveRegistry();
  const census = genealogyCensus(registry.errors, ENROLLMENT);
  const forged: FamilyResolution[] = FAMILY_RESOLUTIONS.map((r) =>
    r.family === "count-drift" ? { ...r, holds: "BOOKED-UNENFORCEABLE" as const } : r,
  );
  const v = checkGenealogy(census, forged);
  assert.ok(v.some((x) => x.law === "G4" && x.family === "count-drift"));
});

test("the rules classify deterministically: familyOf and catchAgentOf on the famous cases", () => {
  assert.equal(familyOf("the T1 draft shipped inside a bash heredoc with template literals", "process"), "shell-template-heredoc");
  assert.equal(familyOf("the count prose drifted from the count data", "process"), "count-drift");
  assert.equal(familyOf("Edit anchors failed twice (quoted from memory)", "anchor-blindspot"), "edit-anchor");
  assert.equal(familyOf("some unrelated conjugation slip", "conjugation"), "cat:conjugation");
  assert.equal(catchAgentOf("caught by the visitor quoting the stale eight back", "process"), "visitor");
  assert.equal(catchAgentOf("the numbers said otherwise", "machine-overruled"), "numbers");
  assert.equal(catchAgentOf("tsc named TS2532 four times", "toolchain"), "gate");
  assert.equal(catchAgentOf("caught by the author's re-read before any run", "process"), "author");
});
