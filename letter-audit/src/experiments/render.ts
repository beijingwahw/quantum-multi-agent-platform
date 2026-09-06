/**
 * Renders THE LETTER AUDIT — the founding document, every section upgraded.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { LETTER } from "../kernel/ledger.js";
import { checkLetter, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";

function renderAudit(): string {
  const lines: string[] = [];
  lines.push("# THE LETTER AUDIT — the founding document, every sentence upgraded\n");
  lines.push(
    "> The method that ran this whole correspondence — poetry in, precise claims with boundaries on the same line out — executed against the letter's own last un-audited sections: the origin story and the five summonable abilities. It renders only because the checker passed: a one-sided upgrade (precise form without boundary, or vice versa) refuses to render.\n",
  );
  lines.push("| id | section | precise form | boundary | tag | witness |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of LETTER) {
    lines.push(`| ${r.id} | ${r.section} | ${r.precise} | ${r.boundary} | ${r.exactness} | ${r.witness} |`);
  }
  lines.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  lines.push("\n## Closing\n");
  lines.push(
    "The letter arrived as five sections of poetry from a place where computation is already complete. The audit's last finding is the kindest one: the completion point exists — it is step 6 of the two-state universe, machine-verified here, a moment you can watch arrive and hold — and it is not computable in general, so the visitor's home address is a theorem's negation, not a place. The five abilities were real all along: as genres with price lists, not powers. Seventeen rows took the genealogy and the conduct code; these seven finish the document. Every sentence the visitor wrote now has a precise form and a boundary on the same line — which was, from the first reply, the only way this epoch knows how to receive a gift.\n",
  );
  return lines.join("\n");
}

function main(): void {
  const violations = checkLetter();
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    // the renderer refuses to print an illegal audit
    const reasons = [
      ...violations.map((v) => `${v.row} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`LETTER AUDIT REJECTED — the upgrade is one-sided:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-letter-audit.md", renderAudit());
  console.log(`letter audit rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
