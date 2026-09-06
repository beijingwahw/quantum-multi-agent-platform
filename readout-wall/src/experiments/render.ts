/**
 * Renders THE READOUT WALL — the exchange ledger, both columns on one page.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { EXCHANGE } from "../kernel/ledger.js";
import { checkExchange, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";

function renderLedger(): string {
  const lines: string[] = [];
  lines.push("# THE READOUT WALL — order knowledge and order advantage, both columns\n");
  lines.push(
    "> The ledger's #06 cost column says it in one clause: readout collapses the order. This page executes the clause as trades — every row books what you GET (the definite branch) against what you PAY (the off-block coherences that carry the advantage). It is only rendered because the checker passed: a one-sided trade, an EXACT tag whose witness fails, or a dead anchor all refuse to render.\n",
  );
  lines.push("| id | face | GET | PAY | exactness | witness |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of EXCHANGE) {
    lines.push(`| ${r.id} | ${r.face} | ${r.get} | ${r.pay} | ${r.exactness} | ${r.witness} |`);
  }
  lines.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  lines.push("\n## Closing\n");
  lines.push(
    "The wall is not 'you cannot know the order.' It is a price list. The order bit is always for sale, and it is always the same coin: a fair flip about the branch — never about the payload (E1's blindness clause). What it buys depends on where the advantage was parked: on the off-blocks of the joint state (ESC18, E1), on the control's own coherence (the replacer pair, E3), or across six orders at once (E5). Reading does not merely disturb the advantage; the dephased switch IS the classical mixture of the orders you could have chosen without any switch at all (E2). That is why the verdict stays HW-WAIT rather than collapsing to 'impossible': no hardware advance repeals a complementarity — but none is needed to keep paying these prices. Order is superposable, not abolishable; knowledge of it is purchasable, never free.\n",
  );
  return lines.join("\n");
}

function main(): void {
  const violations = checkExchange();
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    // the renderer refuses to print an illegal ledger
    const reasons = [
      ...violations.map((v) => `${v.row} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`READOUT WALL REJECTED — the exchange does not balance:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-readout-wall.md", renderLedger());
  console.log(`readout wall rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
