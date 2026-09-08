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
  resolutionSkeleton,
  skeletonDrift,
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

test("the derivation skeleton (v0.31.0): statuses and G2 agree — the pre-write tool cannot lie", async () => {
  const registry = await loadLiveRegistry();
  const census = genealogyCensus(registry.errors, ENROLLMENT);
  const skeleton = resolutionSkeleton(census);
  // the live registry is wired: every derived row lands MATCH or NO-ROW-NEEDED
  assert.ok(
    skeleton.every((r) => r.status === "MATCH" || r.status === "NO-ROW-NEEDED"),
    `the live skeleton carries drift: ${skeletonDrift(skeleton).map((r) => `${r.family}:${r.status}`).join(", ")}`,
  );
  // the agreement law, both directions: every G2 conviction names a drift row,
  // and every drift row's family is convicted by G2 — the tool and the law are one
  const g2 = new Set(checkGenealogy(census).filter((v) => v.law === "G2").map((v) => v.family));
  const drift = new Set(skeletonDrift(skeleton).map((r) => r.family));
  assert.deepEqual([...drift].sort(), [...g2].sort());
  // a MATCH row's derived tier really is its latest sighting's enrollment tier
  for (const r of skeleton.filter((x) => x.status === "MATCH")) {
    assert.equal(r.statedHolds, r.derivedHolds, `${r.family}: a MATCH row must state the derived tier`);
    assert.ok(r.sightings >= 1);
  }
});

test("the derivation skeleton bites: the b84#21 shape is named TIER-DRIFT before the pen", async () => {
  const registry = await loadLiveRegistry();
  const census = genealogyCensus(registry.errors, ENROLLMENT);
  // the b84#21/b85#35 shape exactly: a resolution row drafted from the
  // INTENDED filing while the machine's familyOf files the row elsewhere —
  // here simulated as a tier written ahead of the machine's derivation
  const forged: FamilyResolution[] = FAMILY_RESOLUTIONS.map((r) =>
    r.family === "count-drift" ? { ...r, holds: "MUTANT-KILLED" as const } : r,
  );
  const skeleton = resolutionSkeleton(census, forged);
  const hit = skeletonDrift(skeleton).find((r) => r.family === "count-drift");
  assert.ok(hit, "the drifted row was NOT named by the skeleton");
  assert.equal(hit.status, "TIER-DRIFT");
  assert.equal(hit.derivedHolds, "GATE-ENFORCED");
  assert.equal(hit.statedHolds, "MUTANT-KILLED");
  // and the missing-row face: dropping a recurring family's row is ROW-MISSING
  const dropped: FamilyResolution[] = FAMILY_RESOLUTIONS.filter((r) => r.family !== "count-drift");
  const skeleton2 = resolutionSkeleton(census, dropped);
  const hit2 = skeletonDrift(skeleton2).find((r) => r.family === "count-drift");
  assert.ok(hit2, "the missing row was NOT named");
  assert.equal(hit2.status, "ROW-MISSING");
  assert.equal(hit2.statedHolds, null);
});

test("the derive command is wired and single-sourced (the b37#7 pattern): the script imports the kernel, no second rule table", async () => {
  const fs = await import("node:fs");
  const { resolve } = await import("node:path");
  const pkg = JSON.parse(fs.readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts.derive, "tsx scripts/derive-resolutions.ts", "the derive command must stay wired in package.json — the b84#21/b85#35 guard is a command, not a habit");
  const script = fs.readFileSync(resolve(process.cwd(), "scripts", "derive-resolutions.ts"), "utf8");
  // single-sourced: the script imports the kernel's derivation (and the
  // census it runs on), never a second family-rule table of its own
  assert.match(script, /import\s*\{[^}]*resolutionSkeleton[^}]*\}\s*from\s*["']\.\.\/src\/kernel\/genealogy\.js["']/, "derive-resolutions.ts must import resolutionSkeleton from the kernel — a local re-derivation is the dual-list drift shape");
  assert.match(script, /import\s*\{[^}]*genealogyCensus[^}]*\}\s*from\s*["']\.\.\/src\/kernel\/genealogy\.js["']/);
  assert.ok(!/FAMILY_RULES\s*=/.test(script), "a second literal family-rule table lives in the script — the filing must follow familyOf, single-sourced");
  // and the kernel really exports what the script imports (not a phantom)
  const mod = await import("../src/kernel/genealogy.js");
  assert.equal(typeof mod.resolutionSkeleton, "function");
  assert.equal(typeof mod.skeletonDrift, "function");
});
