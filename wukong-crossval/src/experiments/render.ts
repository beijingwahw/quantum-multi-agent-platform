/**
 * Renders THE CROSS-VALIDATION PACKAGE — hardware path, executable half.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program.
 */
import { pathToFileURL } from "node:url";
import { XVAL } from "../kernel/ledger.js";
import { checkXval, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";

function renderPackage(): string {
  const lines: string[] = [];
  lines.push("# THE CROSS-VALIDATION PACKAGE — the hardware path's executable half\n");
  lines.push(
    "> The machine-time application's sole purpose: local exact engine vs real QPU, parameters offline, verification sampling only. This package is that experiment, built to the application's own specification and dry-run green — the granted hours plug into a running pipeline, not a plan.\n",
  );
  lines.push("| id | claim | price | exactness | witness |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of XVAL) {
    lines.push(`| ${r.id} | ${r.claim} | ${r.price} | ${r.exactness} | ${r.witness} |`);
  }
  lines.push("\n## Witnesses\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  lines.push("\n## Closing\n");
  lines.push(
    "What remains outside this repo is exactly what the application names: the granted hours, the Sinan toolchain session, and the real readout confusion matrices. Everything else — instances with enumerated optima, offline parameters, export format, dry-run statistics, falsifier — runs today. When the hours arrive, the pipeline runs the same day; and if the hit rate decays at the noise boundary, the package is built to report the decay as the finding, which is what the application promised the reviewers.\n",
  );
  return lines.join("\n");
}

function main(): void {
  const violations = checkXval();
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    const reasons = [
      ...violations.map((v) => `${v.row} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`CROSS-VALIDATION REJECTED — the package is not ready:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-xval-package.md", renderPackage());
  console.log(`cross-validation package rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
