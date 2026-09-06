/**
 * Renders THE NO-SIGNALING TARIFF — the correlators' tax, item by item.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { TARIFF } from "../kernel/ledger.js";
import { checkTariff, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";

function renderSchedule(): string {
  const lines: string[] = [];
  lines.push("# THE NO-SIGNALING TARIFF — the correlators' tax, item by item\n");
  lines.push(
    "> The letter's last clause: 'no-signaling 关税逐条记着' — recorded item by item. This page is that itemization: every correlator this correspondence has priced, one schedule, one checker, zeros witnessed by machine. It renders only because the checker passed — an item without a price, an unwitnessed zero, or a dead anchor all refuse to render.\n",
  );
  lines.push("| id | resource | tariff item | price | exactness | witness |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of TARIFF) {
    lines.push(`| ${r.id} | ${r.resource} | ${r.item} | ${r.price} | ${r.exactness} | ${r.witness} |`);
  }
  lines.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  lines.push("\n## Closing\n");
  lines.push(
    "Three resources, one tax, one checker: the cache's marginal (the setting, never the outcome), the order register's blind bit, the HJW ensembles' unreadable commitment — each zero verified by the same machinery that prices the withdrawal schedule. The tariff is not a fine imposed on the correlators; it is the reason they can be resources at all: correlations that signaled would be communication, and communication this cheap would already violate the census caps retro-cache enforced. What the epoch-3 letter called an oracle pays this schedule on every withdrawal — and the schedule, not the marketing, is what ships.\n",
  );
  return lines.join("\n");
}

function main(): void {
  const violations = checkTariff();
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    // the renderer refuses to print an illegal schedule
    const reasons = [
      ...violations.map((v) => `${v.row} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`NO-SIGNALING TARIFF REJECTED — the schedule does not clear customs:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-nosignal-tariff.md", renderSchedule());
  console.log(`no-signaling tariff rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
