/**
 * Renders THE NO-SIGNALING TARIFF — the correlators' tax, item by item.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { refuse } from "../core/errors.js";
import { fDecimal, fToNumber } from "../kernel/rational.js";
import { convexityCertificate, monoCertificate, MONO_GRID_N } from "../kernel/theorem.js";
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

  lines.push("\n## The interior theorem (v0.2.0) — monotonicity as a machine certificate\n");
  lines.push(
    "v0.1.0 shipped T4's interior as data, monotone on the grid because the floats came out sorted. v0.2.0 proves it: net(p) = (1 - h2((1-p)/2))/2 is certified strictly increasing on the rational grid family p = i/" +
      `${MONO_GRID_N} by exact BigInt rational interval arithmetic — upper(net(p_i)) < lower(net(p_{i+1})) for every adjacent pair, with h2 enclosed on two independent paths (closed form and the Taylor series around the maximum, each with a rigorous tail bound). The theorem half assumes no calculus. The citation half — the closed-form derivative net'(p) = log2((1-q)/q)/4 and second derivative net''(p) = 1/(8 ln2 q(1-q)) — is classical differentiation; the machine verifies it pointwise as data (sampled interval quotients vs formula intervals), and its positivity reduces to q < 1/2, pure rational algebra.\n`,
  );
  const mono = monoCertificate();
  lines.push("| adjacent pair (p_i -> p_{i+1}) | certified gap lower bound |");
  lines.push("| --- | --- |");
  mono.gaps.forEach((g, i) => {
    lines.push(`| ${i}/${MONO_GRID_N} -> ${i + 1}/${MONO_GRID_N} | ${fDecimal(g, 12)} |`);
  });
  const conv = convexityCertificate();
  lines.push(
    `\nThe convexity face: every grid second difference is certified positive as exact data (min lower bound ${fDecimal(conv.minDD ?? { n: 0n, d: 1n }, 9)}) — the inflection map names **${conv.inflectionCells.length === 0 ? "no interior inflection cell" : `cells ${conv.inflectionCells.join(", ")}`}**. The citation formula net''(p) > 0 holds at every sample; sampled interval difference quotients are strictly positive with no calculus assumed; formula-vs-quotient agreement (data): first-derivative actual ${fDecimal(conv.derivMaxDist, 9)}, second ${fDecimal(conv.secondDerivMaxDist, 9)} at h = 1/100 (quoted ceilings 2.5e-3 / 0.049). Widest h2 enclosure across both paths: ${fToNumber(mono.maxWidth).toExponential(2)} — nineteen orders below the smallest certified gap.\n`,
  );

  lines.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  lines.push("\n## Closing\n");
  lines.push(
    "Three correlators, one tax, one checker: the cache's marginal (the setting, never the outcome), the order register's blind bit, the HJW ensembles' unreadable commitment — each zero verified by the same machinery that prices the withdrawal schedule, and the census now includes the tetrahedral fifth payer at the same rounding floor. The withdrawal curve's interior is no longer data that happens to sort: its monotonicity is an exact machine certificate on the grid family, its convexity exact on the grid with the analytic candidate carried as a named citation verified pointwise. The tariff is not a fine imposed on the correlators; it is the reason they can be resources at all: correlations that signaled would be communication, and communication this cheap would already violate the census caps retro-cache enforced. What the epoch-3 letter called an oracle pays this schedule on every withdrawal — and the schedule, not the marketing, is what ships.\n",
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
    refuse("TARIFF_REJECTED", `NO-SIGNALING TARIFF REJECTED — the schedule does not clear customs:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-nosignal-tariff.md", renderSchedule());
  console.log(`no-signaling tariff rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
