/**
 * Renders THE BURIAL RECORD — twenty-three batches, every error in two columns.
 *
 * Entry guard (batch 21's own lesson): rendering fires only when this file is
 * the invoked program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { BURIAL_RECORD, CATEGORIES } from "../kernel/registry.js";
import { censusByCategory, censusByRepo, checkBurial, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";

export function renderRegistry(): string {
  const lines: string[] = [];
  lines.push("# THE BURIAL RECORD — the capsule's true contents, exhumed and audited\n");
  lines.push(
    "> The letter says the real time capsule is the burial record: the error logs. This page renders it as a registry — every batch anchored to the repo it happened in and the memory file that records it, every error in two columns (wrong | right). It is only rendered because the checker passed: a vanished repo, a one-column error, a gap in the numbering, or a dead source anchor all fail the build.",
  );

  const totalErrors = BURIAL_RECORD.reduce((a, b) => a + b.errors.length, 0);
  lines.push("\n## Census\n");
  lines.push(`- batches: ${BURIAL_RECORD.length}`);
  lines.push(`- errors: ${totalErrors}`);
  lines.push(`- repos involved: ${censusByRepo().size}`);
  lines.push(`- categories in use: ${censusByCategory().size}/${CATEGORIES.length}\n`);
  lines.push("| repo | batches | errors |");
  lines.push("| --- | --- | --- |");
  const repoBatch = new Map<string, number>();
  for (const b of BURIAL_RECORD) repoBatch.set(b.repo, (repoBatch.get(b.repo) ?? 0) + 1);
  for (const [repo, errs] of [...censusByRepo().entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${repo} | ${repoBatch.get(repo) ?? 0} | ${errs} |`);
  }
  lines.push("");
  lines.push("| category | errors |");
  lines.push("| --- | --- |");
  for (const [cat, n] of [...censusByCategory().entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${n} |`);
  }

  lines.push("\n## The batches\n");
  for (const b of BURIAL_RECORD) {
    lines.push(`### Batch ${b.batch} — ${b.repo} (${b.date})\n`);
    lines.push(`- context: ${b.context}`);
    lines.push(`- source: \`${b.source.file}\` @ "${b.source.heading}"\n`);
    lines.push("| wrong (as it stood) | right (as recorded) | category |");
    lines.push("| --- | --- | --- |");
    for (const e of b.errors) {
      lines.push(`| ${e.wrong} | ${e.right} | ${e.category} |`);
    }
    lines.push("");
  }

  lines.push("## Census witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);

  lines.push("\n## Closing\n");
  lines.push(
    `The ledger's cost column once said "burial record: 20 batches" while the truth was 21 — prose drifts, and that drift is why this repo exists. The count now lives in exactly one place, and the numbering law makes silent drift a build failure. What the visitor left here was never the capsule's numbers; it was the ${totalErrors} ways this epoch's engineers were wrong on the way to them, each with its correction on the same line. The appeal court for every entry remains the repo it happened in — this registry transcribes, the repos re-prove.\n`,
  );
  return lines.join("\n");
}

function main(): void {
  const violations = checkBurial();
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    // the renderer refuses to print an illegal registry — the bookkeeping is
    // a gate, not a decoration
    const reasons = [
      ...violations.map((v) => `batch ${v.batch} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`BURIAL RECORD REJECTED — the record does not bury cleanly:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-burial-record.md", renderRegistry());
  console.log(`burial record rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
