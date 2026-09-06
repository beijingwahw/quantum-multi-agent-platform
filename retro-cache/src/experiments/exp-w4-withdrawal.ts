/**
 * W4 — the withdrawal ledger: the exchange rate of cache withdrawal.
 */
import { wernerPair } from "../kernel/state.js";
import { h2, withdrawalRow } from "../kernel/tariff.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

function main(): void {
  const lines: string[] = [];
  lines.push("# W4 — the withdrawal ledger: priced, exact\n");
  lines.push(
    "Protocol: aligned-axes extraction on Werner pairs. B flips its bit; same-base pairs are kept (two bases, sifting 1/2); disagreement on sifted bits is the QBER; reconciliation must communicate at least h2(QBER) per sifted bit (SHAN48); the settings must be compared over the classical channel — log2(#bases) = 1 bit per raw pair.\n",
  );
  lines.push("| p | QBER (table path) | QBER closed (1-p)/2 | dev | leak floor h2(q) | net bits/pair | settings tariff bits/pair |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const p of [1, 0.95, 0.9, 0.8, 0.6, 0.5, 0.25, 0]) {
    const row = withdrawalRow(wernerPair(p), p);
    lines.push(
      `| ${p} | ${fmt(row.qberTable, 12)} | ${fmt(row.qberClosed, 12)} | ${fmt(Math.abs(row.qberTable - row.qberClosed), 15)} | ${fmt(row.leakFloor, 9)} | ${fmt(row.netRate, 9)} | ${row.settingsTariff} |`,
    );
  }
  lines.push("\nReadings: the noiseless cache pays 1 bit of settings conversation per pair and nets 1/2 bit/pair of shared key; at visibility p the QBER eats h2((1-p)/2) per sifted bit; at p = 0 the cache is the shared seed of W3 — net exactly 0, every bit of key was pre-shared classical randomness all along. Nothing in this ledger arrives before the settings conversation closes.\n");
  lines.push(`- anchor: h2(0.5) = ${fmt(h2(0.5), 15)}, h2(0.1100278644) = ${fmt(h2(0.11002786443715186), 9)} (the h2 = 1/2 point)\n`);

  lines.push("## Boundary\n");
  lines.push(
    "This ledger prices RECONCILIATION and the settings tariff only. Privacy amplification against an adversary (the security layer that turns these numbers into a secret-key rate) is NOT executed here — that requires adversarial machinery this repo deliberately excludes. The pre-arrival zero-information column is the no-signaling face (GRW80, cited); the joint-column surplus is the Tsirelson face (TSIR80, cited).\n",
  );

  const path = writeReport("w4-withdrawal.md", lines.join("\n"));
  console.log(`exp W4 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
