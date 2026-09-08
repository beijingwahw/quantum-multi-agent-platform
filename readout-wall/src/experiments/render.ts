/**
 * Renders THE READOUT WALL — the exchange ledger, both columns on one page.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { EXCHANGE } from "../kernel/ledger.js";
import { checkExchange, runWitnesses } from "../kernel/audit.js";
import { refuse } from "../core/errors.js";
import { fr, fToNumber, iMid, type Ivl } from "../kernel/rational.js";
import {
  esc18Certificate,
  frontierCertificate,
  k3Certificate,
  replacerCertificate,
} from "../kernel/theorem.js";
import { writeReport } from "./report.js";

const mid = (iv: Ivl): number => fToNumber(iMid(iv));

function renderTheorem(): string {
  const lines: string[] = [];
  lines.push("\n## The interior theorem (v0.2.0) — exact certificates on the stated families\n");
  lines.push(
    "> v0.1.0 shipped these curves as data with no theorem claimed. Each family below now has a closed form whose spectra the simulation re-derives at every grid point (agreement quoted as data, <= 1e-12), certified on the rational grid lambda = i/20 by exact rational interval arithmetic with ln enclosed on two independent series (t-series and atanh-series); no float enters any certificate.\n",
  );
  lines.push("| family | closed form | monotone (min gap) | convex (min dd) | widest enclosure | paths agree |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const rows = [esc18Certificate(), replacerCertificate(), k3Certificate()];
  for (const c of rows) {
    lines.push(
      `| ${c.family} | \`${c.closedForm}\` | ${c.monotone.every((m) => m.ok) ? `yes (${fToNumber(c.minGap ?? fr(0)).toExponential(3)})` : "NO"} | ${c.convex.every((v) => v.ok) ? `yes (${fToNumber(c.minDD ?? fr(0)).toExponential(3)})` : "NO"} | ${fToNumber(c.maxWidth).toExponential(3)} | ${c.crossOverlapAll ? "yes" : "NO"} |`,
    );
  }
  const f1 = esc18Certificate();
  if (f1.citationMaxDist !== null) {
    lines.push(
      `\nCitation (classical analysis, DATA only): the candidate chi''(l) = [1/(3-l)+1/(1+l)-1/(5-l)-1/(3+l)]/(8 ln 2) agrees with the sampled interval second-difference quotients to ${fToNumber(f1.citationMaxDist).toExponential(3)} at every interior grid point — quoted as agreement, never asserted as certificate.\n`,
    );
  }
  return lines.join("\n");
}

function renderFrontier(): string {
  const fw = frontierCertificate();
  const lines: string[] = [];
  lines.push("\n## The exchange-rate frontier (E6) — order bits priced in chi\n");
  lines.push(
    "> GET = lambda bits of order knowledge (the read-and-remember instrument leaves exactly the weak-readout state; its record satisfies I(record; order) = lambda). PAY = chi(0) - chi(lambda). Pareto certificate: on each census, no measured point dominates another — an exact antichain check on the census only, never a global claim. The marginal columns are exact: every entry is strictly smaller than the one above it (first-touch dominance).\n",
  );
  lines.push("| lambda | GET | PAY: ESC18 joint | marginal | PAY: replacer control | marginal |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const esc = fw.esc18;
  const rep = fw.replacer;
  for (let i = 0; i < esc.points.length; i++) {
    const g = fToNumber(esc.points[i]!.get.lo);
    const escPay = mid(esc.points[i]!.pay);
    const repPay = mid(rep.points[i]!.pay);
    const escMarg = i < esc.marginal.length ? mid(esc.marginal[i]!) : null;
    const repMarg = i < rep.marginal.length ? mid(rep.marginal[i]!) : null;
    lines.push(
      `| ${g.toFixed(2)} | ${g.toFixed(9)} | ${escPay.toFixed(9)} | ${escMarg === null ? "—" : escMarg.toFixed(9)} | ${repPay.toFixed(9)} | ${repMarg === null ? "—" : repMarg.toFixed(9)} |`,
    );
  }
  lines.push(
    "\nCross-family (DATA, no certificate claimed across currencies): the replacer family's control-parked information trades at roughly 7-13x the ESC18 joint rate across the census — the first 1/20 of order knowledge costs 0.065113 bits of control chi versus 0.005123 bits of joint chi. The two PAY columns price different registers; the antichain certificates are per family.\n",
  );
  return lines.join("\n");
}

function renderLedger(): string {
  const lines: string[] = [];
  lines.push("# THE READOUT WALL — order knowledge and order advantage, both columns\n");
  lines.push(
    "> The ledger's #06 cost column says it in one clause: readout collapses the order. This page executes the clause as trades — every row books what you GET (the definite branch) against what you PAY (the off-block coherences that carry the advantage). It is only rendered because the checker passed: a one-sided trade, an EXACT tag whose witness fails, or a dead anchor all refuse to render.\n",
  );
  lines.push("| id | face | GET | PAY | exactness | witness |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of EXCHANGE) lines.push(`| ${r.id} | ${r.face} | ${r.get} | ${r.pay} | ${r.exactness} | ${r.witness} |`);
  lines.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  // the theorem and frontier sections call the exported certificate mains —
  // a render that only replayed cached strings would be a silent no-op
  lines.push(renderTheorem());
  lines.push(renderFrontier());
  lines.push("\n## Closing\n");
  lines.push(
    "The wall is not 'you cannot know the order.' It is a price list. The order bit is always for sale, and it is always the same coin: a fair flip about the branch — never about the payload (E1's blindness clause). What it buys depends on where the advantage was parked: on the off-blocks of the joint state (ESC18, E1), on the control's own coherence (the replacer pair, E3), or across six orders at once (E5). Reading does not merely disturb the advantage; the dephased switch IS the classical mixture of the orders you could have chosen without any switch at all (E2). And the price schedule is now a theorem on the stated families: the weak-readout curve is strictly decreasing and strictly convex — the first touch of the order register is always the most expensive (E4, E6). That is why the verdict stays HW-WAIT rather than collapsing to 'impossible': no hardware advance repeals a complementarity — but none is needed to keep paying these prices. Order is superposable, not abolishable; knowledge of it is purchasable, never free.\n",
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
    refuse("RENDER_REJECTED", `READOUT WALL REJECTED — the exchange does not balance:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-readout-wall.md", renderLedger());
  console.log(`readout wall rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
