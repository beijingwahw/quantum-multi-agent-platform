/**
 * Renders THE BINDING PRICE — #13's market, one page.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { MARKET } from "../kernel/ledger.js";
import { checkMarket, runWitnesses } from "../kernel/audit.js";
import { MarketError } from "../kernel/errors.js";
import { writeReport } from "./report.js";

function renderMarket(): string {
  const lines: string[] = [];
  lines.push("# THE BINDING PRICE — privacy is bought, binding is not, and here is the coin\n");
  lines.push(
    "> The ledger's #13 said it as a verdict: as notary exact, as binding no. This page executes the market underneath: one identity makes the two goods a single coin, one witnessed flat supply makes the unpriceable good exactly that, and the sellable goods keep their public price list. It renders only because the checker passed.\n",
  );
  lines.push("| id | good | price | exactness | witness |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of MARKET) {
    lines.push(`| ${r.id} | ${r.good} | ${r.price} | ${r.exactness} | ${r.witness} |`);
  }
  lines.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  lines.push("\n## Closing\n");
  lines.push(
    "The letter's poetry — 'no-cloning underwrites every contract for free' — was already downgraded to notary-exact / binding-vetoed. The market layer adds the WHY as an equation: the verifier's marginal is one object, and it prices both goods at once. Push it to I/2 and you have bought perfect privacy — and pinned your reveal at exactly 1/2, whatever you announce, whatever decomposition you steer, at any offer. Polarize it and every unit of binding you gain is a unit of concealment you lose, one-for-one, linearly — the classical cheater's 0.853553 is just the point r = 1/sqrt(2) on that line. Privacy is bought; binding is not sold; and they were never two goods to begin with.\n",
  );
  lines.push(
    "v0.2.0's census deepens the same page: the flat supply is witnessed over a continuous family swept exhaustively (2141 parameterized ensembles, the reveal pinned at 1/2 to floating floor); under noisy commit channels the coin survives as an equation of the output marginal while the input-to-output one-to-one bends (dephasing rotates oblique polarizations away from the announcement) and breaks (damping confiscates gamma/2 of concealment from a perfectly concealed input — and mints the matching slack along its own axis); and at two coins the per-coin supply stays flat while the JOINT good acquires a movable supply among perfectly concealing promisors — the boundary of the flat theorem, reported as found.\n",
  );
  return lines.join("\n");
}

function main(): void {
  const violations = checkMarket();
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    // the renderer refuses to print an illegal market
    const reasons = [
      ...violations.map((v) => `${v.row} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new MarketError(
      "MARKET-REJECTED",
      `BINDING PRICE REJECTED — the market does not clear:\n${reasons.join("\n")}`,
    );
  }
  const path = writeReport("the-binding-price.md", renderMarket());
  console.log(`binding price rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
