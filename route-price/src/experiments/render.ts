/**
 * Renders THE DOSSIER — the two OPEN rows' route and price, one page each.
 * The renderer refuses to print an illegal dossier: laws first, prose second.
 */
import { DOSSIERS, type Dossier } from "../kernel/dossier.js";
import { checkDossiers } from "../kernel/audit.js";
import { runWitnesses } from "../kernel/witnesses.js";
import { writeReport } from "./report.js";
import { pathToFileURL } from "node:url";

export function renderLines(
  dossiers: readonly Dossier[] = DOSSIERS,
  witnesses: ReturnType<typeof runWitnesses> = runWitnesses(),
): string[] {
  const violations = checkDossiers(dossiers);
  const witnessOk = witnesses.every((w) => w.pass);
  if (violations.length > 0 || !witnessOk) {
    const reasons = [
      ...violations.map((v) => `${v.dossierId} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`DOSSIER REJECTED — the route does not balance:\n${reasons.join("\n")}`);
  }

  const lines: string[] = [];
  lines.push("# THE DOSSIER — route and price for the two OPEN rows\n");
  lines.push("> The atlas's discipline lets OPEN rows quote no numbers; what they owe is a route with falsifiers and prices with derivations. This page is only rendered because the checker passed: every milestone books a price and names its own failure mode, the only verdict expressible here is OPEN-ROUTE, and every quoted figure is re-derived by an executable witness. Since v0.2.0 an executed milestone must also carry its sibling's certificate AND a passing cross-check of this repo (R7) — the invoice learned to read its neighbors' receipts, not to take them on faith.\n");

  for (const d of dossiers) {
    lines.push(`## ${d.id} — ${d.claim}`);
    lines.push(`\n**atlas row:** \`${d.atlasRow}\` (verdict OPEN there, OPEN-ROUTE here — nothing was settled by writing this page)\n`);
    lines.push(`\n${d.scope}\n`);
    lines.push("\n### What a demonstration would have to exhibit\n");
    lines.push("| id | demand | status | anchor |");
    lines.push("| --- | --- | --- | --- |");
    for (const c of d.criteria) {
      lines.push(`| ${c.id} | ${c.demand} | ${c.status} | \`${c.anchor}\` |`);
    }
    lines.push("\n### The route — milestones that name their own failure mode\n");
    lines.push("| id | milestone | anchor | falsifier | price | status |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const m of d.milestones) {
      const status = m.execution === undefined
        ? "OPEN"
        : `CERTIFIED-ELSEWHERE — \`${m.execution.repo}\` ${m.execution.certificate} (cross-check \`${m.execution.crossCheck}\`)`;
      lines.push(`| ${m.id} | ${m.statement} | \`${m.anchor}\` | ${m.falsifier} | ${m.price} | ${status} |`);
    }
    lines.push("\n### The price lines\n");
    lines.push("| id | item | amount | witness |");
    lines.push("| --- | --- | --- | --- |");
    for (const p of d.prices) {
      lines.push(`| ${p.id} | ${p.item} | ${p.amount} | ${p.witness ?? "—"} |`);
    }
    lines.push("");
  }

  lines.push("## Executable witnesses (independent re-derivations, R5)\n");
  for (const w of witnesses) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);

  lines.push("\n## Closing\n");
  lines.push(
    "Two rows entered OPEN and leave OPEN — that is what delivery looks like in a repo that cannot settle. What changed at v0.1.0: the zero-energy wording is closed by the equilibrium no-go, the driven route carries its power cord on the same line as its promise, the choice-primitive's boundary is executed rather than asserted, and every toll on the route is re-derived, not transcribed. What changed at v0.2.0: three of the priced milestones are now EXECUTED by siblings (D1-M3, D1-M4 by dtc-clock; D2-M4 by dsic-noether) and each execution is cross-checked by a witness of this repo at toy scale (W-D, W-E, W-F) — the receipts were read, not trusted. The power cord of D1-P3 remains unquoted with a sharpened boundary: every in-model face is metered, the hardware joules are not computable here, and the language-level charge of D2 stays open. The visitor asked which universe would be paid; these two pages are the invoice, now with three lines receipted.\n",
  );
  return lines;
}

function main(): void {
  const lines = renderLines();
  const path = writeReport("the-dossier.md", lines.join("\n"));
  console.log(`dossier rendered -> ${path}`);
}

// entry guard: importing this module (tests) must not render
const isEntry = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) main();
