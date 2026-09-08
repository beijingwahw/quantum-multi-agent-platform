/**
 * THE ANCHOR GATE — the A-board's firing range: the FIRING-INJECT demos are
 * HERE (injected into the REAL checkers of the sibling repos, convicted by
 * name), plus the A-law smuggling docket.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ANCHOR_REGISTRY, checkAnchors, checkArtifactFiring, fireLive, FIXTURE_REPO, resolveAnchor } from "../src/kernel/anchors.js";
import { unguardedEntryFiles, WORKSPACE_ROOT } from "../src/kernel/census.js";
import { ENROLLMENT } from "../src/kernel/enrollment.js";
import { checkCensus } from "../src/kernel/audit.js";
import { loadLiveRegistry } from "../src/kernel/bridge.js";

const LEDGER_ROOT = resolve(WORKSPACE_ROOT, "depreciation-ledger", "src", "kernel");

test("A1-A3: the anchor registry is legal, symmetric and fully evidenced (live)", async () => {
  const v = await checkAnchors();
  assert.deepEqual(v, []);
  const byKind = new Map<string, number>();
  for (const r of ANCHOR_REGISTRY) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  assert.equal(ANCHOR_REGISTRY.length, 180);
  assert.equal(byKind.get("FIRING-INJECT"), 121);
  assert.equal(byKind.get("FIRING-LIVE"), 9);
  assert.equal(byKind.get("RESOLVED"), 50);
});

test("A-fire B4: a forged batch with a dead source anchor is convicted by burial-record's own checker", async () => {
  const mod = (await import(pathToFileURL(resolve(WORKSPACE_ROOT, "burial-record", "src", "kernel", "audit.ts")).href)) as unknown as {
    checkBurial(batches: unknown[]): Array<{ law: string; detail: string }>;
  };
  const forged = [
    {
      batch: 99,
      repo: "mutant-census",
      date: "2026-09-06",
      context: "forged for the firing range",
      source: { file: "memory/2026-09-06.md", heading: "A HEADING THAT EXISTS NOWHERE" },
      errors: [{ wrong: "w", right: "r", category: "process" }],
    },
  ];
  const hit = mod.checkBurial(forged).find((v) => v.law === "B4");
  assert.ok(hit, "expected a B4 conviction from burial-record's own checker");
  assert.match(hit.detail, /heading/i);
});

test("A-fire B9: forged memory text carrying the repeated-label signature is convicted by burial-record's own structure checker (the b70#3 shape)", async () => {
  const mod = (await import(pathToFileURL(resolve(WORKSPACE_ROOT, "burial-record", "src", "kernel", "audit.ts")).href)) as unknown as {
    memoryStructureViolations(text: string): Array<{ law: string; detail: string }>;
  };
  // the exact b70#3 shape: a visit-entry prefix pasted twice
  const forged = "# 2026-09-08\n\n- **七十六访**：- **七十六访**：令牌「继续」\n";
  const hit = mod.memoryStructureViolations(forged).find((v) => v.law === "B9" && /repeated-label/.test(v.detail));
  assert.ok(hit, "the forged duplication signature was NOT convicted");
  assert.match(hit.detail, /line 3/);
  // and the b68#2 family's aftermath: the orphaned tail a swallowed heading leaves
  const tail = mod.memoryStructureViolations("# day\n\n（访客令牌「被吞的节头」\n").find((v) => /orphaned heading tail/.test(v.detail));
  assert.ok(tail, "the orphaned tail was NOT convicted");
});

test("A-fire B7: a context stating the wrong count is convicted by burial-record's own checker (the b45#9 class)", async () => {
  const mod = (await import(pathToFileURL(resolve(WORKSPACE_ROOT, "burial-record", "src", "kernel", "audit.ts")).href)) as unknown as {
    checkBurial(batches: unknown[]): Array<{ law: string; detail: string; batch: number }>;
  };
  const reg = (await import(pathToFileURL(resolve(WORKSPACE_ROOT, "burial-record", "src", "kernel", "registry.ts")).href)) as unknown as {
    BURIAL_RECORD: Array<Record<string, unknown>>;
  };
  const real45 = reg.BURIAL_RECORD.find((b) => (b as { batch: number }).batch === 45)!;
  // the exact b45#9 forgery: the real ten-error batch, its prose still saying nine
  const forged = JSON.parse(JSON.stringify(real45)) as { context: string };
  forged.context = "the v0.5.0 armor dynamics delivery — nine delivery errors across five classes, born enrolled";
  const hit = mod.checkBurial([forged]).find((v) => v.law === "B7" && v.batch === 45);
  assert.ok(hit, "expected a B7 conviction from burial-record's own checker");
  assert.match(hit.detail, /states 9 error/);
  assert.match(hit.detail, /carries 10/);
  // the hyphen trap stays closed: twenty-two on twenty-two is legal prose
  const clean = JSON.parse(JSON.stringify(real45)) as { context: string; errors: unknown[] };
  clean.context = "the v0.5.0 armor dynamics delivery — ten delivery errors across five classes, born enrolled";
  assert.deepEqual(
    mod.checkBurial([clean]).filter((v) => v.law === "B7"),
    [],
  );
});

test("A-fire L1: a number row with an empty cost column is convicted by the ledger's own checker", async () => {
  const audit = (await import(pathToFileURL(resolve(LEDGER_ROOT, "audit.ts")).href)) as unknown as { checkLedger(rows: unknown[]): Array<{ law: string; row: string }> };
  const ledger = (await import(pathToFileURL(resolve(LEDGER_ROOT, "ledger.ts")).href)) as unknown as { LEDGER: unknown[] };
  const smuggled = (ledger.LEDGER as Array<{ numberColumn?: string; costColumn?: string; id?: string }>).map((r) =>
    r.numberColumn && r.numberColumn.trim() !== "" ? { ...r, costColumn: "" } : r,
  );
  const hits = audit.checkLedger(smuggled);
  assert.ok(hits.length > 0, "the costless rows were not convicted");
  assert.ok(hits.some((v) => v.law === "L1"), `expected L1 among the convictions, got ${hits.map((h) => h.law).join(",")}`);
});

test("A-fire L2: a settled row quoting no numbers is convicted by the ledger's own checker", async () => {
  const audit = (await import(pathToFileURL(resolve(LEDGER_ROOT, "audit.ts")).href)) as unknown as { checkLedger(rows: unknown[]): Array<{ law: string; row: string }> };
  const ledger = (await import(pathToFileURL(resolve(LEDGER_ROOT, "ledger.ts")).href)) as unknown as { LEDGER: unknown[] };
  // L2's real object (read from their audit.ts, not remembered): hasNumbers =
  // numberColumn.trim() nonempty; the law fires on a BLANK number column with
  // a settled verdict — a filler string like "— (none) —" IS a number column
  const rows = (ledger.LEDGER as Array<{ numberColumn?: string; verdict?: string }>).map((r, i) =>
    i === 0 ? { ...r, numberColumn: "   ", verdict: "MECHANISM-SETTLED" } : r,
  );
  const hits = audit.checkLedger(rows);
  assert.ok(hits.some((v) => v.law === "L2"), `expected an L2 conviction, got ${hits.map((h) => h.law).join(",")}`);
});

test("A-fire provenanceRepos: the charset does not swallow commas — a paren note resolves to exactly the repo", () => {
  // b32#6's defect: 'batch 10 (qverify, expPauli)' captured the repo as
  // 'qverify, expPauli'. The tightened charset stops at the comma; a spec
  // whose provenance carries a trailing note must pass clean (no false Q6).
  const spec = {
    id: "MU-FIRE",
    defect: "firing-range fixture",
    history: "batch 10 (qverify, expPauli) — the paren note is part of the citation",
    corrupted: "nothing",
    classes: ["conjugation"],
    killer: "P2",
    expected: "EXACT-KILL" as const,
  };
  assert.deepEqual(checkCensus([spec]), []);
});

test("the fixture repo's unguarded entry is named by the detector (the live-fire target is real)", () => {
  const named = unguardedEntryFiles(FIXTURE_REPO);
  assert.ok(named.includes("leak.ts"), `detector saw ${JSON.stringify(named)}`);
});

test("every FIRING-LIVE anchor fires and every RESOLVED anchor resolves, individually", async () => {
  for (const reg of ANCHOR_REGISTRY) {
    if (reg.kind === "FIRING-LIVE") {
      const r = await fireLive(reg);
      assert.ok(r.ok, `${reg.anchor} did not fire: ${r.detail}`);
    } else if (reg.kind === "RESOLVED") {
      const r = resolveAnchor(reg);
      assert.ok(r.ok, `${reg.anchor} did not resolve: ${r.detail}`);
    }
  }
});

test("smuggle A1a: an enrollment row on an unregistered anchor is convicted", async () => {
  const rows = ENROLLMENT.map((r) => (r.key === "b12#0" ? { ...r, anchor: "mutant-census/package.json :: version" } : r));
  const v = await checkAnchors(rows);
  assert.ok(v.some((x) => x.law === "A1" && /NOT registered/.test(x.detail)));
});

test("smuggle A1b: a stale registration nothing sits on is convicted", async () => {
  const registry = [...ANCHOR_REGISTRY, { anchor: "mutant-census/package.json :: version", kind: "RESOLVED" as const, evidence: "an orphan" }];
  const v = await checkAnchors(ENROLLMENT, registry);
  assert.ok(v.some((x) => x.law === "A1" && /STALE/.test(x.detail)));
});

test("smuggle A2: an inject demo that is not on disk is convicted", async () => {
  const registry = ANCHOR_REGISTRY.map((r) =>
    r.anchor === "burial-record/src/kernel/audit.ts :: B4" ? { ...r, demoFile: "atlantis/test/x.test.ts", demoName: "ghost demo" } : r,
  );
  const v = await checkAnchors(ENROLLMENT, registry);
  assert.ok(v.some((x) => x.law === "A2" && /demo file missing/.test(x.detail)));
});

test("A4 artifact firing: a RESOLVED anchor whose repo cell is RED in the last recorded run is convicted by name", async () => {
  const fs = await import("node:fs");
  const artifactPath = resolve(process.cwd(), "out", "reports", "the-total-gate.md");
  const liveText = fs.existsSync(artifactPath) ? fs.readFileSync(artifactPath, "utf8") : null;
  // positive face: the last recorded run is green for every RESOLVED anchor it covers
  if (liveText !== null) {
    assert.deepEqual(checkArtifactFiring(liveText, ANCHOR_REGISTRY), [], "a RESOLVED anchor's repo is red in the last recorded run");
  }
  // the firing demo: dtc-clock's typecheck cell goes red in the harvested artifact
  const base = liveText ?? "| repo | test | typecheck |\n| --- | --- | --- |\n| dtc-clock | PASS (1.0s) | PASS (1.0s) |\n";
  const forged = base.replace(/\| dtc-clock \| (PASS|FAIL)[^|]*\| (PASS|FAIL)[^|]*\|/, "| dtc-clock | PASS (1.0s) | FAIL (tsc error) |");
  const hit = checkArtifactFiring(forged, ANCHOR_REGISTRY).find((v) => v.law === "A4");
  assert.ok(hit, "the red cell was NOT convicted");
  assert.equal(hit.anchor, "dtc-clock/package.json :: typecheck");
  // and a missing artifact books nothing — the T-board contract stands
  assert.deepEqual(checkArtifactFiring(null, ANCHOR_REGISTRY), []);
});

test("the renderer refuses to print an illegal anchor registry", async () => {
  const { renderCensus } = await import("../src/experiments/render.js");
  const registry = ANCHOR_REGISTRY.map((r) =>
    r.anchor === "mutant-census/src/kernel/audit.ts :: Q2" ? { ...r, kind: "RESOLVED" as const } : r,
  );
  // kind-flipped to RESOLVED: the Q2 anchor has no resolution rule — A3 fires
  await assert.rejects(() => renderCensus(undefined, undefined, registry), /anchor registry is illegal|no resolution rule/);
});

test("the registry census stays live after registry growth (E1 self-check)", async () => {
  // the anchor census and the enrollment census read the SAME live registry:
  // a growth on one side must be visible to the other
  const registry = await loadLiveRegistry();
  assert.ok(registry.errors.length >= 212);
  assert.equal(registry.declaredErrors, registry.errors.length);
});
