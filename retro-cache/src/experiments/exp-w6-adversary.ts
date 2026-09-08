/**
 * W6 — the adversary census: a bounded family of active toy strategies
 * against the withdrawal, every member priced in the tariff ledger on exact
 * joint tables. The classical adversary is CHSH-2-limited (W3's census); the
 * question is what each mutation of the channel costs and buys.
 */
import {
  censusCrossingTap,
  chshUnderAttack,
  eveInfoNoisyStorage,
  interceptResendRow,
  qberUnderAttack,
  settingsMutationRow,
} from "../kernel/adversary.js";
import { sparseAdversaryInfo } from "../kernel/amplify.js";
import { h2 } from "../kernel/tariff.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

function main(): void {
  const lines: string[] = [];
  lines.push("# W6 — the adversary census: active taps on the withdrawal, priced\n");

  // A. intercept-resend ledger
  lines.push("## A. the intercept-resend ledger IR(eta)\n");
  lines.push(
    "Eve taps a fraction eta of pairs, measures her half in a random basis, resends. Right-basis taps relay the underlying table faithfully and hand her that sifted bit exactly (a known eta/2 fraction); wrong-basis taps depolarize the cell. Two-path QBER and CHSH on exact tables.\n",
  );
  lines.push("| p | eta | QBER (two-path) | S attacked | census cap | below cap | I_E sparse bits/sifted | net pre-PA 1-h2(q)-I_E | verdict |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  let worstQDev = 0;
  let worstSDev = 0;
  for (const p of [1, 0.9, 0.75, 0.5]) {
    for (const eta of [0, 0.25, 0.5, 0.75, 1]) {
      const q = qberUnderAttack(p, eta);
      const s = chshUnderAttack(p, eta);
      worstQDev = Math.max(worstQDev, Math.abs(q.table - q.closed));
      worstSDev = Math.max(worstSDev, Math.abs(s.table - s.closed));
      const row = interceptResendRow(p, eta);
      lines.push(
        `| ${p} | ${eta} | ${fmt(q.closed, 9)} | ${fmt(s.closed, 9)} | 2 | ${row.belowCensusCap ? "yes" : "no"} | ${fmt(row.eveInfo, 3)} | ${fmt(row.netPrePA, 9)} | ${row.verdict} |`,
      );
    }
  }
  lines.push(
    `\nWorst two-path deviation across the grid: QBER ${worstQDev.toExponential(1)}, CHSH ${worstSDev.toExponential(1)}. Readings: the full tap (eta = 1) stamps q = 1/4 + (1-p)/4 >= 1/4 on every visibility (exactly the intercept-resend signature 1/4 on the noiseless cache) and confiscates the withdrawal — net = -0.311278 at p = 1 — the ledger reads ABORT. Verdicts flip from proceed to abort between eta = 0.5 and 0.75 at p = 1 (the tariff, not a security theorem, is the decision maker here).\n`,
  );

  // B. the census depreciation line
  lines.push("## B. the census depreciation line: taps push the surplus under the classical cap\n");
  lines.push("S_attacked = (1 - eta/2) * 2*sqrt(2)*p sinks below the census cap 2 at eta* = 2 - sqrt(2)/p (defined for p > 1/sqrt(2)); past that tap rate the joint column is worth less than a shared seed's classical ceiling.\n");
  lines.push("| p | 2*sqrt(2)*p | eta* (crossing) | S at eta = 1 |");
  lines.push("| --- | --- | --- | --- |");
  for (const p of [1, 0.9, 0.8, 0.7072]) {
    const cross = censusCrossingTap(p);
    lines.push(`| ${p} | ${fmt(2 * Math.SQRT2 * p, 9)} | ${cross === null ? "never" : fmt(cross, 9)} | ${fmt(-(1 - 1 / 2) * 2 * Math.SQRT2 * p, 9)} |`);
  }
  lines.push(
    "\nAt eta = 1 every signal is mediated by Eve's classical data: the attacked channel IS a shared-randomness column, and its |S| = sqrt(2)*p <= 2 sits inside W3's 256-strategy census (CHSH69's line behind it — the cap is cited, the attacked values are computed). The adversary cannot relay the entangled surplus: tapping depreciates the cache toward the seed she could have pre-shared for free.\n",
  );

  // C. noisy storage
  lines.push("## C. noisy storage NS(nu): the retro price of holding data across the conversation\n");
  lines.push("The settings conversation closes AFTER the quantum exchange (W2's order), so Eve must carry her tapped bits across it. Storage modeled as a BSC(nu) memory on each known bit.\n");
  lines.push("| nu | I_E after storage (eta = 1) |");
  lines.push("| --- | --- |");
  for (const nu of [0, 0.05, 0.11, 0.25, 0.5]) {
    lines.push(`| ${nu} | ${fmt(eveInfoNoisyStorage(1, nu), 9)} |`);
  }
  lines.push(
    "\nEndpoints exact: nu = 0 full retention (0.5 bits/sifted bit), nu = 1/2 storage wiped (exactly 0 — a fair-coin memory carries nothing). At the h2 = 1/2 point nu = 0.11 half her take evaporates: the cache forces the adversary to fund a memory, and the memory is priced.\n",
  );

  // D. classical-channel mutation
  lines.push("## D. classical-channel mutation CM(mu): priced dead loss\n");
  lines.push("Flipping transported settings bits at rate mu keeps cross-basis rounds as if sifted — a fair-coin cell — inflating the observed QBER. The mutator learns nothing about key bits: the settings column is W2's certified zero-information face (the question never carries the answer).\n");
  lines.push("| p | mu | q_eff (two-path) | extra reconciliation tax | adversary gain |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const mu of [0.05, 0.1, 0.25]) {
    const r = settingsMutationRow(1, mu);
    lines.push(`| 1 | ${mu} | ${fmt(r.qberClosed, 9)} (dev ${Math.abs(r.qberTable - r.qberClosed).toExponential(1)}) | ${fmt(r.extraTax, 9)} | 0 |`);
  }
  lines.push(
    "\nEvery mutation rate strictly RAISES the tariff (extra tax > 0 for mu > 0 at p = 1) and returns exactly zero: on this channel, vandalism is not an attack, it is a donation to the QBER estimate. The zero-gain column is W2.A's theorem, executed there.\n",
  );

  // E. the full tap through the amplifier
  lines.push("## E. the full tap through the amplifier: the floor confiscates first\n");
  lines.push("| k | sparse surviving I(K;Z) bits/block | net = (k - I)/8 - h2(1/4) | verdict |");
  lines.push("| --- | --- | --- | --- |");
  for (const k of [4, 3, 2]) {
    const sp = sparseAdversaryInfo(8, k, 4);
    const net = (k - sp.infoMean) / 8 - h2(0.25);
    lines.push(`| ${k} | ${fmt(sp.infoMean, 6)} | ${fmt(net, 9)} | ${net > 0 ? "proceed" : "abort"} |`);
  }
  lines.push(
    "\nAmplification does collapse her information (0.745 surviving bits of a 4-bit key at k = 4, 0.167 at k = 2 — W5.C), but the h2(1/4) = 0.811278 reconciliation floor keeps the net negative at every k: at toy scale the tariff ledger's binding constraint is the floor, not the amplifier. Privacy amplification buys security margin; it cannot refund confiscated rate.\n",
  );

  lines.push("## Boundary\n");
  lines.push(
    "The census is a bounded toy family (intercept-resend taps at quartile rates, BSC memories, settings flips) — not the attack space of a security proof, and no composable statement is made. Eve's census information counts only what her tap hands her; the worst-case attribution of ALL channel noise to the adversary (which would add 1 - h2(p/2) bits at eta = 0) is W5's smoothed profile — the two accountings are printed side by side, never mixed. The eta = 1 census-cap statement executes on exact tables; the all-strategies cap behind it is W3's 256-census (CHSH69), carried not re-proved.\n",
  );

  const path = writeReport("w6-adversary.md", lines.join("\n"));
  console.log(`exp W6 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
