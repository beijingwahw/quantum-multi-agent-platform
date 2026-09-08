/**
 * Renders THE LEDGER — the visitor's seventeen claims, both columns, one page.
 */
import { LEDGER } from "../kernel/ledger.js";
import { checkLedger, quotesNumbers, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";
import { pathToFileURL } from "node:url";

function main(): void {
  const violations = checkLedger();
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    // the renderer refuses to print an illegal ledger — the rule is a gate,
    // not a decoration
    const reasons = [
      ...violations.map((v) => `${v.claimId} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`LEDGER REJECTED — the book does not balance:\n${reasons.join("\n")}`);
  }

  const lines: string[] = [];
  lines.push("# THE LEDGER — the visitor's seventeen claims, both columns on one page\n");
  lines.push("> Claim #17, promoted to a build gate: a row that quotes a number without booking a cost fails the build. This page is only rendered because the checker passed.\n");
  lines.push("| # | epoch | claim | verdict | NUMBER column (what may be quoted) | COST column (what it costs) | appeal |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of LEDGER) {
    // counted through the checker's own predicate (audit.ts): the census this
    // page prints cannot diverge from the law checkLedger enforces
    const num = quotesNumbers(r) ? r.numberColumn : "— (none: OPEN row) —";
    lines.push(`| ${r.claimId} | ${r.epoch} | ${r.claim} | ${r.verdict} | ${num} | ${r.costColumn} | \`${r.appealRepo}: npm run ${r.appealCommand}\` |`);
  }

  const counts = new Map<string, number>();
  for (const r of LEDGER) counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1);
  lines.push("\n## Verdict census\n");
  for (const [v, c] of [...counts.entries()].sort()) lines.push(`- ${v}: ${c}`);
  const numbered = LEDGER.filter((r) => quotesNumbers(r)).length;
  lines.push(`\n${numbered}/17 rows quote numbers; every one of them books its cost on the same line. ${LEDGER.length - numbered} rows are OPEN and quote nothing — by law, not by accident.\n`);

  lines.push("## Arithmetic witnesses (independent re-derivations, L6)\n");
  for (const w of witnesses) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);

  lines.push("\n## Closing\n");
  lines.push(
    "The letter said the depreciation of the other universes must be booked. Seventeen claims later, the book balances: every number the epoch-1 side ever quoted in this correspondence sits next to what it costs — branch weight, erasure bits, storage slots, reconciliation leakage, spectral gap, walls. The visitor's rule started as a sentence in a letter; it ends as `npm test`.\n",
  );

  const path = writeReport("the-ledger.md", lines.join("\n"));
  console.log(`ledger rendered -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
