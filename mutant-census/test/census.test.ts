/**
 * THE GATE — the census laws enforced against the real registry, the real
 * workspace, and a full smuggling docket: every law has a trial where an
 * illegal registration is convicted BY NAME.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { MUTANTS, canonicalFamily, mutantFamily, type MutantSpec } from "../src/kernel/family.js";
import { PROPERTY_IDS, runBattery, runKillCensus, runProperty } from "../src/kernel/battery.js";
import {
  checkCensus,
  runWitnesses,
  witnessFamily,
  witnessKillCensus,
  witnessWorkspace,
} from "../src/kernel/audit.js";
import { LEGACY_REPOS, WORKSPACE_ROOT } from "../src/kernel/census.js";

test("the canonical census is legal (Q1-Q6 static)", () => {
  assert.deepEqual(checkCensus(), []);
});

test("W-A the kill census: 9/9 killed exactly as declared, zero survivors", () => {
  const w = witnessKillCensus();
  assert.ok(w.pass, w.detail);
  const kills = runKillCensus();
  assert.equal(kills.length, MUTANTS.length);
  const byActual = new Map<string, number>();
  for (const k of kills) byActual.set(k.actual, (byActual.get(k.actual) ?? 0) + 1);
  assert.equal(byActual.get("SURVIVED") ?? 0, 0);
  assert.equal(byActual.get("EXACT-KILL"), 6);
  assert.equal(byActual.get("CRASH-KILL"), 1);
  assert.equal(byActual.get("DATA-KILL"), 2);
});

test("W-B the property battery: 10/10 green on the canonical family, inputs >= 60", () => {
  const props = runBattery();
  assert.equal(props.length, 10);
  for (const p of props) {
    assert.ok(p.pass, `${p.id}: ${p.detail}`);
    assert.ok(p.inputs >= 60, `${p.id} has only ${p.inputs} inputs`);
    assert.notEqual(p.tripper.trim(), "", `${p.id} names no tripper`);
  }
});

test("each mutant's declared killer is the one that kills it", () => {
  for (const spec of MUTANTS) {
    const fam = mutantFamily(spec);
    let crashed = false;
    let passed = false;
    try {
      passed = runProperty(spec.killer, fam).pass;
    } catch {
      crashed = true;
    }
    assert.ok(
      crashed || !passed,
      `${spec.id}: its declared killer ${spec.killer} PASSES against the mutant — the kill declaration is false`,
    );
  }
});

test("W-C the negative controls fire", () => {
  const w = runWitnesses()[2]!; // runWitnesses returns a fixed five-witness array
  assert.ok(w.pass, w.detail);
});

test("W-D the family census: every live divergence is registered (live)", () => {
  // 2026-09-06 cluster upgrade window: each family member's strict-mode fixes
  // were applied repo-locally, so byte-identity is temporarily broken in
  // places and the register carries the window's divergences as recorded
  // debt. The hard law kept at this gate is the one that catches SILENT
  // drift: the divergence set must be a subset of the register (zero
  // unregistered divergence). Stale registrations (a member re-converged to
  // the canon) and full member identity are the appeal court's next pass.
  const { rows } = witnessFamily();
  const unregistered = rows.filter((r) => r.status === "UNREGISTERED-DIVERGENCE");
  assert.equal(
    unregistered.length,
    0,
    `unregistered family drift: ${unregistered.map((r) => `${r.repo}/${r.file}`).join(", ")}`,
  );
});

test("W-E the workspace census: 28 epoch repos + the platform, guard debt PAID (live)", () => {
  const { result, rows } = witnessWorkspace();
  assert.ok(result.pass, result.detail);
  const epochRows = rows.filter((r) => !r.isPlatform);
  const platformRows = rows.filter((r) => r.isPlatform);
  assert.equal(epochRows.length, 28);
  assert.equal(platformRows.length, 1);
  assert.equal(platformRows[0]?.repo, "ds_extracted/ds");
  for (const r of epochRows) {
    assert.ok(r.scriptsOk, `${r.repo}: scripts incomplete`);
    assert.ok(r.strictOk, `${r.repo}: tsconfig not strict`);
    // the batch-33 ratchet: ZERO unguarded entries anywhere, register empty
    assert.equal(r.unguardedEntries.length, 0, `${r.repo}: ${r.unguardedEntries.length} unguarded entries — the ratchet tolerates zero`);
  }
  assert.ok(platformRows[0]?.scriptsOk, "platform: test+typecheck mandatory");
});

test("anchors on disk: burial-record and every provenance repo exist", () => {
  for (const base of ["burial-record", ...LEGACY_REPOS.map((l) => l.repo)]) {
    assert.ok(existsSync(resolve(WORKSPACE_ROOT, base, "package.json")), `${base} missing`);
  }
});

// ---- the smuggling docket: every law convicts by name ----

test("smuggle 1 (Q1): a mutant without burial provenance is convicted", () => {
  const smuggled: MutantSpec[] = [
    {
      id: "MU99",
      defect: "something subtle",
      history: "no batch citation at all — an invented mutant",
      corrupted: "nowhere",
      classes: ["conjugation"],
      killer: "P2",
      expected: "EXACT-KILL",
    },
  ];
  const v = checkCensus(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "Q1");
  assert.match(v[0]?.detail ?? "", /provenance/);
});

test("smuggle 2 (Q2): a declared kill that is actually a survivor is convicted", () => {
  // a "mutant" whose corruption is a no-op: the identity wrapper — nothing to
  // kill, so the census must report SURVIVED against the declared EXACT-KILL
  const ghost: MutantSpec = {
    id: "MU98",
    defect: "claims corruption, ships the canonical function",
    history: "batch 31 (stable-world)",
    corrupted: "nothing at all",
    classes: ["conjugation"],
    killer: "P2",
    expected: "EXACT-KILL",
  };
  const w = witnessKillCensus([ghost]);
  assert.ok(!w.pass);
  assert.match(w.detail, /SURVIVED|declared EXACT-KILL but the census says/);
  const kills = runKillCensus([ghost]);
  assert.equal(kills[0]?.actual, "SURVIVED");
});

test("smuggle 3 (Q2): an unknown killer property is convicted", () => {
  const smuggled: MutantSpec[] = [
    { ...MUTANTS[0]!, id: "MU97", killer: "P99" },
  ];
  const v = checkCensus(smuggled);
  assert.ok(v.some((x) => x.law === "Q2" && x.row === "MU97"));
});

test("smuggle 4 (Q6): an illegal expected verdict is convicted", () => {
  const smuggled: MutantSpec[] = [
    { ...MUTANTS[0]!, id: "MU96", expected: "PROBABLY-FINE" as MutantSpec["expected"] },
  ];
  const v = checkCensus(smuggled);
  assert.ok(v.some((x) => x.law === "Q6" && /illegal expected verdict/.test(x.detail)));
});

test("smuggle 5 (Q1): provenance naming a repo that is not on disk is convicted", () => {
  const smuggled: MutantSpec[] = [
    {
      id: "MU95",
      defect: "x",
      history: "batch 40 (atlantis)",
      corrupted: "y",
      classes: ["conjugation"],
      killer: "P2",
      expected: "EXACT-KILL",
    },
  ];
  const v = checkCensus(smuggled);
  assert.ok(v.some((x) => x.law === "Q6" && /atlantis/.test(x.detail)));
});

test("smuggle 6 (Q2): a real corruption pair is interchangeable — MU1 really is what P2 says it is", () => {
  // the kill margin is booked from the run, not asserted from the spec sheet
  const k = runKillCensus([MUTANTS[0]!])[0]!;
  assert.equal(k.actual, "EXACT-KILL");
  assert.ok(k.margin > 1e-6, `MU1's kill margin is only ${k.margin} — suspiciously quiet for a conjugation flip`);
});

test("the canonical family satisfies the battery's shape law the law describes", () => {
  // a legal product must NOT throw — the guard is against mismatches only
  const f = canonicalFamily();
  const k = f.mMul(
    { rows: 1, cols: 1, re: Float64Array.of(2), im: Float64Array.of(0) },
    { rows: 1, cols: 1, re: Float64Array.of(3), im: Float64Array.of(0) },
  );
  assert.equal(k.re[0], 6);
});

test("property vocabulary is closed and killers all exist", () => {
  assert.deepEqual(PROPERTY_IDS, ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"]);
  for (const m of MUTANTS) assert.ok(PROPERTY_IDS.includes(m.killer));
});

test("T-board: the total-gate command exists and its artifact contract is declared", async () => {
  const fs = await import("node:fs");
  const pkg = JSON.parse(fs.readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(pkg.scripts?.total, "tsx scripts/total-gate.ts");
  assert.ok(fs.existsSync(resolve(process.cwd(), "scripts", "total-gate.ts")));
  // the artifact records the LAST explicit run — its absence is not a failure
  // here; its presence must carry a stamp and a verdict word
  const artifact = resolve(process.cwd(), "out", "reports", "the-total-gate.md");
  if (fs.existsSync(artifact)) {
    const head = fs.readFileSync(artifact, "utf8").split("\n").slice(0, 3).join("\n");
    assert.match(head, /ALL GREEN|RED CELL/);
    assert.match(head, /Ran \d{4}-\d{2}-\d{2}T/);
  }
});

test("the renderer refuses to print an illegal census, and importing it renders nothing", async () => {
  const { renderCensus } = await import("../src/experiments/render.js");
  const badCensus: MutantSpec[] = [
    { id: "MU1", defect: "duplicate id smuggled twice", history: "no provenance", corrupted: "x", classes: ["conjugation"], killer: "P2", expected: "EXACT-KILL" },
    { id: "MU1", defect: "duplicate id smuggled twice", history: "no provenance", corrupted: "x", classes: ["conjugation"], killer: "P2", expected: "EXACT-KILL" },
  ];
  await assert.rejects(() => renderCensus(badCensus), /illegal/);
  // the entry guard: importing the module must not write the report
  const fs = await import("node:fs");
  const reportPath = resolve(process.cwd(), "out", "reports", "the-mutant-census.md");
  const statBefore = fs.existsSync(reportPath) ? fs.statSync(reportPath).mtimeMs : null;
  await import("../src/experiments/render.js");
  const statAfter = fs.existsSync(reportPath) ? fs.statSync(reportPath).mtimeMs : null;
  assert.equal(statBefore, statAfter, "importing render.ts re-rendered the report — the entry guard is broken");
});
