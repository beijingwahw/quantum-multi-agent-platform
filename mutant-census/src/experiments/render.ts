/**
 * Renders THE MUTANT CENSUS — the workspace's quality layer on one page.
 *
 * Entry guard (house law since batch 21): rendering fires only when this file
 * is the invoked program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MUTANTS, type MutantSpec } from "../kernel/family.js";
import { runBattery, runKillCensus, runNegativeControls } from "../kernel/battery.js";
import { checkCensus, checkEnrollment, checkStatedCounts, runWitnesses, witnessEnrollment, witnessFamily, witnessWorkspace } from "../kernel/audit.js";
import { REGISTERED_DIVERGENCES, EPOCH_REPOS, FAMILY_FILES } from "../kernel/census.js";
import { ENROLLMENT, type EnrollmentRow } from "../kernel/enrollment.js";
import { loadLiveRegistry } from "../kernel/bridge.js";
import { ANCHOR_REGISTRY, checkAnchors, type AnchorRegistration } from "../kernel/anchors.js";
import { witnessGenealogy, catchAgentOf } from "../kernel/genealogy.js";
import { PER_ERROR, PILOT_CLASSES, witnessEquivalence, type PerErrorSpec } from "../kernel/equiv.js";
import { REPAIR_AUDIT, checkRepairAudit, witnessRepairAudit, type RepairRow } from "../kernel/repair.js";
import { assertUniqueWitnessLetters, writeReport } from "./report.js";
import { checkSelfReport, claimCensus, deriveProseReconciliation } from "../kernel/selfreport.js";

/** Renders the census; exported so the gate can prove the renderer REFUSES
 * an illegal registry (it throws before printing a single row). */
export async function renderCensus(
  mutants: readonly MutantSpec[] = MUTANTS,
  enrollment: readonly EnrollmentRow[] = ENROLLMENT,
  anchorRegistry: readonly AnchorRegistration[] = ANCHOR_REGISTRY,
  perError: readonly PerErrorSpec[] = PER_ERROR,
  audit: readonly RepairRow[] = REPAIR_AUDIT,
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
  const wj = witnessEquivalence(perError);
  if (wj.violations.length > 0) {
    const lines = wj.violations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the per-error equivalence table is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const rViolations = checkRepairAudit(audit, enrollment, registry);
  if (rViolations.length > 0) {
    const lines = rViolations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the repair audit is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  // E7 — the census's own stated counts (its package.json description) are
  // copies of the enrollment data; the renderer refuses to print a census
  // whose self-description has drifted from its own arithmetic
  const description = (JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { description?: string }).description ?? "";
  const e7 = checkStatedCounts(description, enrollment);
  if (e7.length > 0) {
    const lines = e7.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the census's own stated counts are illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const out: string[] = [];
  out.push("# THE MUTANT CENSUS — the error history replayed and killed, one page\n");
  out.push(
    `> The burial record exhumed the workspace's errors (every one in two columns). This page is the other half of that ledger: the defect classes REPLAYED as nine live mutants against the shared kernel family and its standard compositions, and killed one by one by a ten-property battery that holds for every seeded input — dual-path arithmetic, negative controls, statistical kills labeled DATA. The family's byte-identity across the workspace and the ${EPOCH_REPOS.length} epoch repos' engineering hygiene are censused LIVE on every run: an unregistered drift fails the build. And the loop is closed all the way down: EVERY error the registry carries is enrolled to the guard that kills it now (E-board, live-imported — an error without an enforcement anchor cannot be buried), and the per-error question is measured where it is decidable (J-board: the equivalent-mutant boundary, censused error by error on the pilot classes). Mutation testing and property-based testing are established fields (DEM78, JIA11, CLA00, dual-sourced in citations.md); the executable claim here is the coupling — a machine-audited error registry feeding the operator set, physics invariants as the oracle, zero dependencies. It renders only because the checker passed.\n`,
  );

  out.push("## M-board — the kill register (mutation census)\n");
  out.push("| id | defect (re-enacted) | provenance (the real error) | killer | verdict | margin |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  const kills = new Map(runKillCensus(mutants).map((k) => [k.id, k] as const));
  const killTally = new Map<string, number>();
  for (const k of kills.values()) killTally.set(k.actual, (killTally.get(k.actual) ?? 0) + 1);
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
    `${mutants.length} mutants, ${kills.size - (killTally.get("SURVIVED") ?? 0)} kills as declared, zero survivors: ${killTally.get("EXACT-KILL") ?? 0} exact kills (deviations orders above tolerance), ${killTally.get("CRASH-KILL") ?? 0} crash kill (the family's own shape guard refusing the missing tensor identity — the way batch 24 actually died on the spot), ${killTally.get("DATA-KILL") ?? 0} statistical kills (the same-event and same-denominator disciplines). Every row carries its provenance; nothing here is a toy mutant.\n`,
  );

  out.push("## P-board — the property battery (property-based census)\n");
  out.push("| id | property | grade | inputs | worst | tripper |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  const battery = runBattery();
  for (const p of battery) {
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
  // the closing sentence is GENERATED from the scan (S2, v0.22.0): the shipped
  // prose had drifted to "Ten full members ... share four of five" while the
  // live scan carried 7 / 3-of-5 / 4-of-5 — board numbers are the witness's
  // numbers (b36#16/b57#5), so the sentence is now a copy of the data
  const identicalByRepo = new Map<string, number>();
  const presentByRepo = new Map<string, number>();
  for (const r of fam.rows) {
    if (r.status === "NOT-PRESENT") continue;
    presentByRepo.set(r.repo, (presentByRepo.get(r.repo) ?? 0) + 1);
    if (r.status === "IDENTICAL") identicalByRepo.set(r.repo, (identicalByRepo.get(r.repo) ?? 0) + 1);
  }
  const isFullMember = (repo: string): boolean =>
    (presentByRepo.get(repo) ?? 0) === FAMILY_FILES.length && (identicalByRepo.get(repo) ?? 0) === FAMILY_FILES.length;
  const fullMembers = [...presentByRepo.keys()].filter(isFullMember).sort();
  const partialClauses = [...presentByRepo.keys()]
    .filter((repo) => !isFullMember(repo))
    .map((repo) => `${repo} shares ${identicalByRepo.get(repo) ?? 0} of ${presentByRepo.get(repo) ?? 0}`)
    .sort();
  out.push(
    `${fullMembers.length} epoch members byte-identical in all ${FAMILY_FILES.length} files (${fullMembers.join(", ")} — plus this census itself, the canon); partial members: ${partialClauses.join(", ")}. The law is symmetric: an unregistered drift fails the build, and so does a stale registration — the register must match reality exactly.\n`,
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
    "E3 proves the needle is on disk; the A-board proves the guard can FIRE or is RESOLVED to its machinery — a guard that never convicts is a false guard. The registry is symmetric: an unregistered anchor may not hold errors, and a stale registration is itself a violation. Since v0.11.0 the RESOLVED class goes one layer deeper (A4): the total gate has already fired every repo's suite, and the census harvests that firing from the last recorded artifact — a RESOLVED test/typecheck anchor whose repo cell is red in that run is a violation, evidence upgraded from \"the machinery exists\" to \"the machinery fired green\".\n",
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

  out.push("## J-board — the per-error equivalence census (the JIA11 boundary, measured)\n");
  out.push(
    "The E-board ties an error to its class prototype — honest, and coarse (one mutant guards its whole registered class). The J-board asks the next question, per error: what does a FAITHFUL family-level re-enactment of THIS error's own defect do against the battery? The verdict vocabulary is closed — COLLAPSES (bit-exact battery-indistinguishable from the class prototype: the class tie is already the fixed point of per-error construction), ERROR-LEVEL (a distinct construction the battery kills: the tie refines from category to error), EQUIVALENT (a live survivor — the open problem in person, booked with its reason), UNBUILDABLE (the defect's home composition is not a family member — booked). The exchange that makes this decidable: PROGRAM equivalence is undecidable (the open problem, JIA11); BATTERY-indistinguishability — the (pass, worst) vectors over all ten properties — is a relation the machine decides bit-exactly. The census claims the second and books the first.\n",
  );
  out.push("| key | prototype | construction / booking | verdict | live detail |");
  out.push("| --- | --- | --- | --- | --- |");
  const printOf = (k: string): string => {
    const spec = perError.find((r) => r.key === k)!;
    if (spec.verdict === "UNBUILDABLE" || spec.verdict === "EQUIVALENT") return spec.reason ?? "";
    return spec.built ?? "";
  };
  for (const spec of perError) {
    out.push(`| ${spec.key} | ${spec.prototype} | ${printOf(spec.key)} | ${spec.verdict} | ${wj.rows.find((r) => r.key === spec.key)!.detail} |`);
  }
  out.push("");
  const jTally = new Map<string, number>();
  for (const r of wj.rows) jTally.set(r.computed, (jTally.get(r.computed) ?? 0) + 1);
  const classCount = (cls: string): number => enrollment.filter((r) => r.category === cls && r.tier === "MUTANT-KILLED").length;
  out.push(
    `Pilots: ${PILOT_CLASSES.map((c) => `${c} EXHAUSTIVE (${classCount(c)}/${classCount(c)} of its MUTANT-KILLED rows)`).join("; ")} — the ENTIRE mutation-killed population, censused per error. ${jTally.get("COLLAPSES") ?? 0} collapses — the prototypes' OWN history errors re-enact bit-exactly (b29#0 IS MU1, b20#0 IS MU2, b31#4 IS MU3, b24#0 IS MU4 through the crash face, b21#0 IS MU5, b31#0 IS MU6, b31#3 IS MU7, b31#5 IS MU8, b19#3 IS MU9: ALL ${jTally.get("COLLAPSES") ?? 0} prototypes now have their provenance error as a bit-exact specimen — the class tie is the fixed point of per-error construction, ${jTally.get("COLLAPSES") ?? 0} for ${jTally.get("COLLAPSES") ?? 0}). ${jTally.get("ERROR-LEVEL") ?? 0} error-level kills — the class tie was real but coarse: conjugation gave P3/P4 their first real-error trippers and the b26#0/b28#2 TWINS; wrong-object gave three P5 readout-object kills (joint cells as marginals, the partner's outcome pinned where summing was meant, the axis unitary applied where a measurement was meant); dimension-slot gave the tensor written as a product (b13#2, P2) and the 1x1-scalar mMul scaling (b31#1 — crash face on P5, distinct from MU3's P2 face, so no collapse). ${jTally.get("EQUIVALENT") ?? 0} equivalent survivors, PROVEN not merely un-killed, and of TWO DIFFERENT SPECIES: b30#0's globally-negated ket is invisible at the density layer (representation-blindness, a one-line elementwise proof) and b5#2's unguarded 0/0 ratio lives on a degenerate branch the battery's inputs never reach (P(zero accepted) <= 0.7^60 — input-coverage blindness, a probability bound; on every exercised input the construction is the CORRECT estimator). The JIA11 phenomenon is not one wall but (at least) two. The unbuildable ${jTally.get("UNBUILDABLE") ?? 0} — the defect's home (optimizers, eigensolvers, simulators, protocols, verifiers, index conventions, calibration choices, property-internal constructions) is not a family member; no faithful re-enactment exists at this layer, and the booking says so, row by row.\n`,
  );

  out.push("## R-board — the repair audit (every BOOKED reason, refuted or held)\n");
  const rTally = new Map<string, number>();
  for (const r of audit) rTally.set(r.verdict, (rTally.get(r.verdict) ?? 0) + 1);
  out.push(
    `A BOOKED reason is a universal claim — "no machine can hold this line" — and such claims are not proved, they are REFUTED one witness machine at a time. Visit v0.9.0 audited one batch this way; this board audits the WHOLE booked population with a decidable criterion: does a recurrence of this row's defect die at a scheduled gate? ${rTally.get("UPGRADED") ?? 0} reasons had gone false (the machine convicted the sighting itself, or the gated trees kill the recurrence — b47#1's heredoc damage died at the loader, b56#7's transcription error died at the exact-zero tolerance, b37#7's dual repo list is single-sourced in the same edit) and their rows now sit on live anchors; ${rTally.get("SHARPENED") ?? 0} were coarse and are sharpened to name their FACES (the b54#1 dual-face precedent — which face is booked, which is held); the rest are held with the ungated face stated. The audit is STANDING LAW (R1): a booked row without a verdict fails the build, a later flip without an audit edit fails the build — born-audited, every one.\n`,
  );
  out.push(
    `| verdict | rows | meaning |\n| --- | --- | --- |\n| UPGRADED | ${rTally.get("UPGRADED") ?? 0} | the reason went false — the row is GATE-ENFORCED now and the basis cites the falsifying anchor verbatim (R2) |\n| SHARPENED | ${rTally.get("SHARPENED") ?? 0} | the reason survives but was coarse — rewritten to name the booked face and the gate-held face |\n| HELD | ${rTally.get("HELD") ?? 0} | the reason is true as written; the basis states the ungated face |\n`,
  );
  out.push("**Every verdict, with its basis:**\n");
  for (const r of audit) out.push(`- **${r.verdict}** ${r.key} — ${r.basis}`);
  out.push("");

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
  out.push(`- ${wj.result.pass ? "PASS" : "FAIL"} — ${wj.result.name} (${wj.result.detail})`);
  const wy = await witnessRepairAudit(audit, enrollment);
  out.push(`- ${wy.pass ? "PASS" : "FAIL"} — ${wy.name} (${wy.detail})`);
  // W-S (v0.22.0): the self-report census — S1 the legislated board order,
  // S2 the prose reconciliation against the live arithmetic. The line's own
  // numbers are generated from the reconciliation, never stated; if the check
  // below refuses, this line never prints.
  const recon = deriveProseReconciliation({
    registry,
    enrollment,
    mutantCount: mutants.length,
    batteryCount: battery.length,
    killTally: Object.fromEntries(killTally),
    killCount: kills.size,
    familyRows: fam.rows,
    registeredDivergenceCount: REGISTERED_DIVERGENCES.length,
    epochRepoCount: EPOCH_REPOS.length,
    unguardedTotal: ws.rows.reduce((s, r) => s + (r.isPlatform ? 0 : r.unguardedEntries.length), 0),
    catchCensus: wg.census.catch,
    visitorKeys: registry.errors.filter((e) => catchAgentOf(e.wrong, e.category) === "visitor").map((e) => e.key),
    anchorKindTally: Object.fromEntries(kindTally),
    anchorTotal: anchorRegistry.length,
    repairTally: Object.fromEntries(rTally),
    perErrorTally: Object.fromEntries(jTally),
  });
  const cc = claimCensus(recon);
  out.push(
    `- PASS — W-S self-report census (S1: ${cc.sections} legislated sections in the closed order, M-board rows ascending by id, A-board kinds in evidence order; S2: ${cc.claims} numeric prose claims reconciled against the live arithmetic — the artifact face on disk is re-derived by the suite on every run)`,
  );

  out.push("\n## Boundaries\n");
  out.push(
      "- The mutant set is HISTORICALLY MOTIVATED, not exhaustive: nine defect classes compiled from the burial record, not a proof that no tenth class exists. Equivalent mutants are a known open problem of the field (JIA11); none are claimed away here — and the conjugation class now carries a per-error equivalence census (J-board) with one PROVEN specimen booked.\n" +
      "- The family's mAdd does NOT check shapes — by design, recorded at batch 31 ('the dimension account is always the coder's'). MU3 is killed at the COMPOSITION layer (the embedding's dimension contract), not by an adder that would break ten byte-identical members.\n" +
      "- Statistical kills are DATA-grade: they convict at 5 sigma by design of the property, not by theorem. The exact kills are exact.\n" +
      "- The W-board's unguarded-entry detector is a string-level heuristic (writeReport/writeFileSync without the guard); its misses are surfaced, not enforced — the K-board's hash census is the exact one.\n" +
      "- The registered divergences record THAT bytes differ and why they may; whether they SHOULD is each repo's appeal court (`npm test` there). This census adjudicates identity, not intent.\n" +
      "- The E-board's MUTANT-KILLED tie is CLASS-level; the J-board has now measured the per-error question on ALL FOUR classes EXHAUSTIVELY (conjugation 19/19 at v0.8.0; wrong-object 44/44 and dimension-slot 29/29 and statistics 25/25 at v0.13.0 — the ENTIRE 117-row mutation-killed population): 9 collapses (every prototype's own history error, bit-exact — the class tie is the fixed point of per-error construction, nine for nine), 12 error-level kills (distinct faithful constructions, killed — the tie refines), 2 PROVEN equivalent mutants of TWO SPECIES (b30#0: representation-blindness — global phase unobservable at the density layer; b5#2: input-coverage blindness — the degenerate 0/0 branch lies outside the battery's input distribution, proven by a probability bound), 94 unbuildable (the defect's home is not a family member). The equivalent-mutant open problem (JIA11) is not solved — it is MEASURED on the workspace's entire mutation-killed history, and the decidable exchange is named: program equivalence is undecidable, battery-indistinguishability is decided bit-exactly.\n" +
      "- The tier assignment is judgment recorded as data; the appeal is editing the enrollment table — and E1-E6 hold the edit to the registry, the disk and the arithmetic. BOOKED-UNENFORCEABLE is the honest boundary: lines no machine can hold, each printed with its reason above — and since v0.10.0 each REASON is itself audited data (R-board): refuted rows upgrade on cited anchors, surviving rows name their ungated face, and the audit's judgment layer is the authors' — the machine holds coverage, vocabulary and citation, not the verdicts' wisdom. Visibility is the substitute for enforcement, and it is priced as such.\n" +
      "- 'World-class frontier' priced honestly: mutation testing (DEM78, JIA11) and property-based testing (CLA00) are the field's foundations, cited; per-error regression policy is folklore ('every bug gets a test'). The contribution claimed is the executable CLOSED LOOP — a machine-audited error registry imported live by the quality gate, so no error can be buried without a machine-checkable enforcement anchor — nothing grander.\n",
  );

  out.push("\n## Closing\n");
  out.push(
    "The visitor asked for all the errors given a world-class optimization. The optimization that survives pricing is not a faster kernel but a closed registry: every error ever buried is wired to the guard that kills it now — replayed as a mutant, anchored to a live gate, or booked on the visible boundary with its reason; the burial record is imported live on every run, so the loop cannot be reopened silently. The burial record was the memory of failure — this census is the immune system built from it, and the enrollment is the proof that nothing in that memory is inert. Survivors, when they appear, will be booked as blind spots on this page; that is the difference between quality theatre and a gate.\n",
  );
  const text = out.join("\n");
  // witness letters must be unique: two censuses claiming one letter is the
  // b46#5 class, and the renderer refuses to print it (the guard lives in
  // report.ts since b53#5 — a leaf, so no import cycle can reach the entry)
  assertUniqueWitnessLetters(text);
  // S1/S2 (v0.22.0): the census's own report is law — the renderer refuses to
  // print a section-shuffled board or a number the live arithmetic does not
  // carry, exactly as it refuses an illegal registry (the same refusal shape)
  const selfViolations = checkSelfReport(text, recon);
  if (selfViolations.length > 0) {
    const lines = selfViolations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the census's own report is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  return text;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = writeReport("the-mutant-census.md", await renderCensus());
  console.log(`rendered -> ${path}`);
}
