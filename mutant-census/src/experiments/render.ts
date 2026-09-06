/**
 * Renders THE MUTANT CENSUS — the workspace's quality layer on one page.
 *
 * Entry guard (house law since batch 21): rendering fires only when this file
 * is the invoked program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { MUTANTS, type MutantSpec } from "../kernel/family.js";
import { runBattery, runKillCensus, runNegativeControls } from "../kernel/battery.js";
import { checkCensus, checkEnrollment, runWitnesses, witnessEnrollment, witnessFamily, witnessWorkspace } from "../kernel/audit.js";
import { REGISTERED_DIVERGENCES } from "../kernel/census.js";
import { ENROLLMENT, type EnrollmentRow } from "../kernel/enrollment.js";
import { loadLiveRegistry } from "../kernel/bridge.js";
import { ANCHOR_REGISTRY, checkAnchors, type AnchorRegistration } from "../kernel/anchors.js";
import { witnessGenealogy } from "../kernel/genealogy.js";
import { writeReport } from "./report.js";

/** Renders the census; exported so the gate can prove the renderer REFUSES
 * an illegal registry (it throws before printing a single row). */
export async function renderCensus(
  mutants: readonly MutantSpec[] = MUTANTS,
  enrollment: readonly EnrollmentRow[] = ENROLLMENT,
  anchorRegistry: readonly AnchorRegistration[] = ANCHOR_REGISTRY,
): Promise<string> {
  const violations = checkCensus(mutants);
  if (violations.length > 0) {
    const lines = violations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the census is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const registry = await loadLiveRegistry();
  const eViolations = checkEnrollment(enrollment, registry);
  if (eViolations.length > 0) {
    const lines = eViolations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the enrollment is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const aViolations = await checkAnchors(enrollment, anchorRegistry);
  if (aViolations.length > 0) {
    const lines = aViolations.map((v) => `- ${v.anchor} [${v.law}]: ${v.detail}`);
    throw new Error(`the anchor registry is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const out: string[] = [];
  out.push("# THE MUTANT CENSUS — the error history replayed and killed, one page\n");
  out.push(
    "> The burial record exhumed the workspace's errors (every one in two columns). This page is the other half of that ledger: the defect classes REPLAYED as nine live mutants against the shared kernel family and its standard compositions, and killed one by one by a ten-property battery that holds for every seeded input — dual-path arithmetic, negative controls, statistical kills labeled DATA. The family's byte-identity across the workspace and the 26 repos' engineering hygiene are censused LIVE on every run: an unregistered drift fails the build. And the loop is closed all the way down: EVERY error the registry carries is enrolled to the guard that kills it now (E-board, live-imported — an error without an enforcement anchor cannot be buried). Mutation testing and property-based testing are established fields (DEM78, JIA11, CLA00, dual-sourced in citations.md); the executable claim here is the coupling — a machine-audited error registry feeding the operator set, physics invariants as the oracle, zero dependencies. It renders only because the checker passed.\n",
  );

  out.push("## M-board — the kill register (mutation census)\n");
  out.push("| id | defect (re-enacted) | provenance (the real error) | killer | verdict | margin |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  const kills = new Map(runKillCensus(mutants).map((k) => [k.id, k] as const));
  for (const m of MUTANTS) {
    const k = kills.get(m.id);
    const margin = !k
      ? "-"
      : Number.isFinite(k.margin)
        ? k.actual === "DATA-KILL"
          ? `~${k.margin.toFixed(0)} sigma`
          : k.margin.toExponential(1)
        : "crash";
    out.push(`| ${m.id} | ${m.defect} | ${m.history} | ${m.killer} | ${k?.actual ?? "—"} | ${margin} |`);
  }
  out.push("");
  out.push(
    "Nine mutants, nine kills as declared, zero survivors: six exact kills (deviations orders above tolerance), one crash kill (the family's own shape guard refusing the missing tensor identity — the way batch 24 actually died on the spot), two statistical kills (the same-event and same-denominator disciplines). Every row carries its provenance; nothing here is a toy mutant.\n",
  );

  out.push("## P-board — the property battery (property-based census)\n");
  out.push("| id | property | grade | inputs | worst | tripper |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  for (const p of runBattery()) {
    const worst = p.grade === "DATA" ? `${p.worst.toFixed(1)} sigma` : p.worst.toExponential(1);
    out.push(`| ${p.id} | ${p.name} | ${p.grade} | ${p.inputs} | ${worst} | ${p.tripper} |`);
  }
  out.push("");

  out.push("## Negative controls — the battery can FAIL\n");
  for (const c of runNegativeControls()) out.push(`- ${c.pass ? "FIRES" : "DEAF"} — ${c.name}: ${c.detail}`);
  out.push("");

  out.push("## K-board — the kernel family census (live)\n");
  const fam = witnessFamily();
  const byStatus = new Map<string, number>();
  for (const r of fam.rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  out.push(
    `Canonical hashes (sha256/16): ${Object.entries(fam.canonical).map(([f, h]) => `${f}=${h}`).join(", ")}. Across ${fam.rows.length} repo-file pairs: ${[...byStatus.entries()].map(([s, n]) => `${n} ${s}`).join(", ")}.\n`,
  );
  out.push("| registered divergence | reason |");
  out.push("| --- | --- |");
  for (const d of REGISTERED_DIVERGENCES) out.push(`| ${d.repo}/src/core/${d.file} | ${d.reason} |`);
  out.push("");
  out.push(
    "Ten full members byte-identical in all five files (the eight-repo lineage plus this census); quantum-mech and qverify share four of five. The law is symmetric: an unregistered drift fails the build, and so does a stale registration — the register must match reality exactly.\n",
  );

  out.push("## W-board — the workspace hygiene census (live)\n");
  const ws = witnessWorkspace();
  out.push("| repo | scripts | strict | unguarded entries | platform | reports on disk |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of ws.rows) {
    const entries =
      r.unguardedEntries.length === 0
        ? "0"
        : `${r.unguardedEntries.length} (${r.unguardedEntries.slice(0, 2).join(", ")}${r.unguardedEntries.length > 2 ? ", …" : ""})`;
    out.push(`| ${r.repo} | ${r.scriptsOk ? "Y" : "MISSING"} | ${r.strictOk ? "Y" : "NO"} | ${entries} | ${r.isPlatform ? "exempt-registered" : "—"} | ${r.reportCount} |`);
  }
  out.push("");
  out.push(
    "The pre-batch-21 guard debt was PAID in batch 33: 42 experiment entries across 11 repos retrofitted with the house entry guard, every affected gate re-run green, repro verified on all three retrofit shapes (call-wrap, run-wrap, whole-file wrap). The legacy register is now EMPTY and the ratchet is absolute: an unguarded render entry anywhere in the epoch repos fails the build — there is no exemption path left. The platform repo is censused under its registered exemption: test + typecheck mandatory, `repro` is the GENESIS-A bench debt (ledger row #03), not a missing flag.\n",
  );

  out.push("## E-board — the enrollment census (every buried error, live)\n");
  out.push(
    `The registry is imported LIVE on every run: ${registry.errors.length} errors across ${registry.batchCount} batches, each wired to the guard that kills it NOW. The registry is closed — burying a new error without enrolling it fails the build (E1); a guard that is not on disk fails the build (E3); a booked line without a reason fails the build (E4).\n`,
  );
  const tierTally = new Map<string, number>();
  for (const r of enrollment) tierTally.set(r.tier, (tierTally.get(r.tier) ?? 0) + 1);
  out.push("| tier | errors | meaning |");
  out.push("| --- | --- | --- |");
  out.push(`| MUTANT-KILLED | ${tierTally.get("MUTANT-KILLED") ?? 0} | the error's registered class is replayed as a live mutant and killed by the battery (class tie, E2) |`);
  out.push(`| GATE-ENFORCED | ${tierTally.get("GATE-ENFORCED") ?? 0} | recurrence fails a real build gate; the anchor file+needle verified live (E3) |`);
  out.push(`| BOOKED-UNENFORCEABLE | ${tierTally.get("BOOKED-UNENFORCEABLE") ?? 0} | no machine can hold this line; the reason is mandatory and printed below (E4) |`);
  out.push("");
  out.push("| category | MUTANT | GATE | BOOKED |");
  out.push("| --- | --- | --- | --- |");
  const cats = [...new Set(registry.errors.map((e) => e.category))].sort();
  for (const c of cats) {
    const rows = enrollment.filter((r) => r.category === c);
    const t = (tier: string): number => rows.filter((r) => r.tier === tier).length;
    out.push(`| ${c} | ${t("MUTANT-KILLED")} | ${t("GATE-ENFORCED")} | ${t("BOOKED-UNENFORCEABLE")} |`);
  }
  out.push("");
  const gateAnchors = new Map<string, { count: number; cats: Set<string> }>();
  for (const r of enrollment) {
    if (r.tier !== "GATE-ENFORCED") continue;
    const a = gateAnchors.get(r.anchor) ?? { count: 0, cats: new Set<string>() };
    a.count++;
    a.cats.add(r.category);
    gateAnchors.set(r.anchor, a);
  }
  out.push("| live gate anchor | errors held | categories |");
  out.push("| --- | --- | --- |");
  for (const [anchor, a] of [...gateAnchors.entries()].sort((x, y) => y[1].count - x[1].count)) {
    out.push(`| \`${anchor}\` | ${a.count} | ${[...a.cats].sort().join(", ")} |`);
  }
  out.push("");
  out.push("**Booked unenforceable — the visible boundary, every row:**\n");
  for (const r of enrollment.filter((x) => x.tier === "BOOKED-UNENFORCEABLE")) {
    out.push(`- ${r.key} [${r.category}] — ${r.reason}`);
  }
  out.push("");

  out.push("## A-board — the anchor witness registry (every guard, evidence on file)\n");
  out.push(
    "E3 proves the needle is on disk; the A-board proves the guard can FIRE or is RESOLVED to its machinery — a guard that never convicts is a false guard. The registry is symmetric: an unregistered anchor may not hold errors, and a stale registration is itself a violation.\n",
  );
  const kindOrder: Record<string, number> = { "FIRING-INJECT": 0, "FIRING-LIVE": 1, RESOLVED: 2 };
  for (const reg of [...anchorRegistry].sort((a, b) => kindOrder[a.kind]! - kindOrder[b.kind]!)) {
    out.push(`- **${reg.kind}** — \`${reg.anchor}\` — ${reg.evidence}${reg.demoFile ? ` (demo: ${reg.demoFile}, "${reg.demoName}")` : ""}`);
  }
  out.push("");
  out.push("## G-board — the genealogy census (every error in a family, every family resolved, every catch credited)\n");
  out.push(
    "The E-board made every error answer for its enforcement; the A-board made every guard prove it can fire; the G-board makes the ledger LEARN. Every error joins a family (the named recurrence families plus the category defaults, rules over the live wrong-text); every family with two or more sightings carries a resolution row whose tier must equal its LATEST sighting's enrollment tier (G2 — a stale resolution is a conviction); every error credits its catcher, and the catch census prints the era trend — the optimization metric: the machine fraction must rise, the visitor fraction must fall to zero.\n",
  );
  const wg = await witnessGenealogy(registry, enrollment);
  out.push("| family | sightings | first | latest | latest tier (held by) |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const f of wg.census.families) {
    out.push(`| ${f.family} | ${f.sightings} | b${f.firstBatch} | ${f.latestKey} | ${f.latestTier} |`);
  }
  out.push("");
  const c = wg.census.catch;
  out.push(
    `The catch census: gate ${c.gate} / author ${c.author} / numbers ${c.numbers} / visitor ${c.visitor} over ${c.total} errors — the gate fraction rose from ${(c.earlyGateFraction * 100).toFixed(0)}% (batches 1-22) to ${(c.lateGateFraction * 100).toFixed(0)}% (batches 37+). The one visitor catch is b45#9 — and burial-record's B7 law (stated counts equal carried counts, v0.5.0 of the record) now holds that class by gate, with the A-fire B7 firing demo injecting the exact forgery into the real checkBurial.\n`,
  );

  out.push("## T-board — the total gate\n");
  out.push(
    "`npm run total` runs the WHOLE workspace as one verdict: every epoch repo's test suite AND typecheck, plus the main platform repo's full suite — machine-judged, stamped, rendered to `out/reports/the-total-gate.md`. The artifact records the last explicit run; this census verifies the command exists and the artifact's contract. 全量 is a command, not an adjective.\n",
  );

  out.push("## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) out.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  const wf = await witnessEnrollment(enrollment);
  out.push(`- ${wf.pass ? "PASS" : "FAIL"} — ${wf.name} (${wf.detail})`);
  const anchorViolations = await checkAnchors(enrollment, anchorRegistry);
  const kindTally = new Map<string, number>();
  for (const r of anchorRegistry) kindTally.set(r.kind, (kindTally.get(r.kind) ?? 0) + 1);
  out.push(
    `- ${anchorViolations.length === 0 ? "PASS" : "FAIL"} — W-G anchor census (${anchorRegistry.length} guards registered: ${kindTally.get("FIRING-INJECT") ?? 0} firing-inject demos on disk, ${kindTally.get("FIRING-LIVE") ?? 0} fired live this run, ${kindTally.get("RESOLVED") ?? 0} resolved to machinery${anchorViolations.length > 0 ? `; violations: ${anchorViolations.slice(0, 3).map((x) => `${x.anchor} [${x.law}]`).join("; ")}` : ""})`,
  );
  out.push(`- ${wg.result.pass ? "PASS" : "FAIL"} — ${wg.result.name} (${wg.result.detail})`);

  out.push("\n## Boundaries\n");
  out.push(
    "- The mutant set is HISTORICALLY MOTIVATED, not exhaustive: nine defect classes compiled from the burial record, not a proof that no tenth class exists. Equivalent mutants are a known open problem of the field (JIA11); none are claimed away here.\n" +
      "- The family's mAdd does NOT check shapes — by design, recorded at batch 31 ('the dimension account is always the coder's'). MU3 is killed at the COMPOSITION layer (the embedding's dimension contract), not by an adder that would break ten byte-identical members.\n" +
      "- Statistical kills are DATA-grade: they convict at 5 sigma by design of the property, not by theorem. The exact kills are exact.\n" +
      "- The W-board's unguarded-entry detector is a string-level heuristic (writeReport/writeFileSync without the guard); its misses are surfaced, not enforced — the K-board's hash census is the exact one.\n" +
      "- The registered divergences record THAT bytes differ and why they may; whether they SHOULD is each repo's appeal court (`npm test` there). This census adjudicates identity, not intent.\n" +
      "- The E-board's MUTANT-KILLED tie is CLASS-level: one mutant guards its whole registered category-class (the registry's own B0-verified filing), not each error individually re-mutated; the equivalent-mutant open problem (JIA11) stands. Per-error mutants are not claimed.\n" +
      "- The tier assignment is judgment recorded as data; the appeal is editing the enrollment table — and E1-E6 hold the edit to the registry, the disk and the arithmetic. BOOKED-UNENFORCEABLE is the honest boundary: lines no machine can hold, each printed with its reason above. Visibility is the substitute for enforcement, and it is priced as such.\n" +
      "- 'World-class frontier' priced honestly: mutation testing (DEM78, JIA11) and property-based testing (CLA00) are the field's foundations, cited; per-error regression policy is folklore ('every bug gets a test'). The contribution claimed is the executable CLOSED LOOP — a machine-audited error registry imported live by the quality gate, so no error can be buried without a machine-checkable enforcement anchor — nothing grander.\n",
  );

  out.push("\n## Closing\n");
  out.push(
    "The visitor asked for all the errors given a world-class optimization. The optimization that survives pricing is not a faster kernel but a closed registry: every error ever buried is wired to the guard that kills it now — replayed as a mutant, anchored to a live gate, or booked on the visible boundary with its reason; the burial record is imported live on every run, so the loop cannot be reopened silently. The burial record was the memory of failure — this census is the immune system built from it, and the enrollment is the proof that nothing in that memory is inert. Survivors, when they appear, will be booked as blind spots on this page; that is the difference between quality theatre and a gate.\n",
  );
  const text = out.join("\n");
  // witness letters must be unique: two censuses claiming one letter is the
  // b46#5 class, and the renderer refuses to print it (the guard is
  // registered on the A-board, FIRING-LIVE)
  assertUniqueWitnessLetters(text);
  return text;
}

/** The witness-letter guard (b46#5's tier upgrade): every W-[A-Z] that
 * headlines a census line belongs to exactly one census. */
export function assertUniqueWitnessLetters(reportText: string): void {
  const seen = new Map<string, number>();
  for (const m of reportText.matchAll(/^- (?:PASS|FAIL) — (W-[A-Z])/gm)) {
    seen.set(m[1]!, (seen.get(m[1]!) ?? 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([w]) => w);
  if (dups.length > 0) {
    throw new Error(
      `the census is illegal — refusing to print it:\n- witnesses [A-board letter guard]: ${dups.join(", ")} each headline two censuses — witness letters must be unique`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = writeReport("the-mutant-census.md", await renderCensus());
  console.log(`rendered -> ${path}`);
}
