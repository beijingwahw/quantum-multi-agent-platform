/**
 * T5 — the two-column ledger for counting power, printed in full.
 */
import { KernelError } from "../kernel/errors.js";
import {
  exchangeEntry,
  powerLedgerRow,
  randomSat,
  type PowerLedgerRow,
  type SatInstance,
} from "../kernel/ppledger.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

export function main(): void {
  const lines: string[] = [];
  lines.push("# T5 — the power-depreciation ledger: both columns, on one page\n");
  lines.push(
    "Machine: random 3-SAT instance phi; postselection flag g = 'x satisfies phi'; readout h = 'x_0 = 1'. The branch decides the PP-style threshold question 'among the models of phi, do more than half set x_0 = 1?' — power column = the decision and its confidence, depreciation column = the branch weight paid for it.\n",
  );

  // pick instances with a spread of gaps (scan seeds; keep first per class)
  let moderate: { inst: SatInstance; row: PowerLedgerRow } | null = null;
  let nearTie: { inst: SatInstance; row: PowerLedgerRow } | null = null;
  for (let seed = 1; seed <= 200; seed++) {
    const inst = randomSat(10, 30, seed);
    const row = powerLedgerRow(inst);
    if (row.m === 0) continue;
    if (moderate === null && row.gap >= 0.05) moderate = { inst, row };
    if (nearTie === null && row.gap > 0 && row.gap <= 1.25 / (2 * row.m)) nearTie = { inst, row };
    if (moderate !== null && nearTie !== null) break;
  }
  if (moderate === null || nearTie === null) throw new KernelError("EXP-SCAN-FAILED", "exp T5: instance scan failed");

  lines.push("## A. the power column: threshold decisions on real 3-SAT instances\n");
  lines.push("| instance | n | clauses | m = models | models with x_0=1 | branch ratio | integer referee | deviation | gap to 1/2 | single-shot error | decision |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  const table: Array<[string, SatInstance]> = [
    ["moderate gap", moderate.inst],
    ["near-tie", nearTie.inst],
    ["exact tie (x_0 absent)", randomSat(10, 24, 7, 0)],
  ];
  for (const n of [10, 11, 12] as const) {
    table.push([`random n=${n}`, randomSat(n, Math.floor(3.2 * n), 100 + n)]);
  }
  for (const [name, inst] of table) {
    const row = powerLedgerRow(inst);
    lines.push(
      `| ${name} | ${row.n} | ${inst.clauses.length} | ${row.m} | ${row.both} | ${fmt(row.ratio, 9)} | ${fmt(row.brute, 9)} | ${fmt(row.deviation, 2)} | ${fmt(row.gap, 9)} | ${fmt(row.singleShotError, 9)} | ${row.decision} |`,
    );
  }
  lines.push("\nEvery branch probability is the integer ratio both/m (float-zero deviation); the integer separation |2*both - m| >= 1 pins the gap at >= 1/(2m) off exact ties; the free-variable construction is an EXACT tie — the single-shot error is exactly 1/2 and no amount of repetition buys a decision.\n");

  lines.push("## B. the exchange rate: confidence vs depreciation (moderate-gap instance)\n");
  lines.push("| delta | k (odd) | exact vote-error P[Bin(k,1/2+gap) <= k/2] | Hoeffding bound | total expected queries k * N/m |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const delta of [0.1, 0.01, 0.001]) {
    const e = exchangeEntry(moderate.row, delta);
    lines.push(`| ${delta} | ${e.k} | ${fmt(e.tailExact, 12)} | ${fmt(e.hoeffding, 12)} | ${fmt(e.queries, 1)} |`);
  }
  lines.push("\nThe exact binomial tail never exceeds delta (the Hoeffding design is conservative but sound), and the depreciation grows only as ln(1/delta): each decimal of confidence costs a fixed multiple of m^2 * N/m branch queries.\n");

  lines.push("## C. the price spike: near-tie instances\n");
  const eNear = exchangeEntry(nearTie.row, 0.1);
  lines.push(`| near-tie instance: m = ${nearTie.row.m}, gap = ${fmt(nearTie.row.gap, 9)} (= ${fmt(1 / (2 * nearTie.row.m), 9)} floor) | delta = 0.1 | k = ${eNear.k} | exact tail = ${fmt(eNear.tailExact, 12)} | queries = ${fmt(eNear.queries, 1)} |`);
  const eMod = exchangeEntry(moderate.row, 0.1);
  lines.push(`\nAt the integer-separation floor (gap = 1/(2m)) the same delta=0.1 decision costs ${fmt(eNear.queries / eMod.queries, 1)}x the moderate-gap instance — the sorter's power is priced by how close the count sits to the threshold. The exact-tie row of table A is the limit: gap = 0, k = infinity, the ledger declines to quote — priced and executed as its own face in t6-tieface.md (the refusal there is a typed result, not prose).\n`);

  lines.push("## D. both columns, side by side (the page the report was missing)\n");
  lines.push("| instance | power: decision at 99% confidence | depreciation: expected queries |");
  lines.push("| --- | --- | --- |");
  lines.push(`| moderate gap (gap=${fmt(moderate.row.gap, 4)}) | ${moderate.row.decision} | ${fmt(exchangeEntry(moderate.row, 0.01).queries, 1)} |`);
  lines.push(`| near-tie (gap=${fmt(nearTie.row.gap, 4)}) | ${nearTie.row.decision} | ${fmt(eNear.queries, 1)} (delta=0.1 only) |`);
  lines.push(`| exact tie | no decision at any finite price | infinity |`);
  lines.push(
    "\nPostselected counting power (the PostBQP = PP face, AAR04 cited) is real, exact in-branch — and metered: confidence 1-delta costs k(delta) * N/m queries with k = ln(1/delta)/(2 gap^2). Power and depreciation, one ledger, two columns, printed.\n",
  );

  const path = writeReport("t5-power-ledger.md", lines.join("\n"));
  console.log(`exp T5 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
