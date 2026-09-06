/**
 * Renders THE ENT CLEARING — the settlement layer of the entanglement
 * standard, one page.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { BOARD } from "../kernel/board.js";
import { checkBoard, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";

function renderBoard(): string {
  const violations = checkBoard();
  if (violations.length > 0) {
    const lines = violations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the board is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const out: string[] = [];
  out.push("# THE ENT CLEARING — the settlement layer of the entanglement standard, one page\n");
  out.push(
    "> Ledger row #12 settled the coin (exclusivity is physics) and #13 the notary (no-cloning notarizes, binding is not sold). What neither book ever executed is the SETTLEMENT itself — how the currency is spent, quoted, and netted. This page is that book. Every trade carries both columns and the coin's fate; it renders only because the checker passed.\n",
  );
  out.push("| id | trade | give | get | coin's fate | tag | witness |");
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of BOARD) {
    out.push(`| ${r.id} | ${r.trade} | ${r.give} | ${r.get} | ${r.coinFate} | ${r.exactness} | ${r.witness} |`);
  }
  out.push("\n## The parity, and why the coin's fate differs by direction\n");
  out.push(
    "E1 and E2 quote the same parity from two sides — 1 ebit = 1 qubit = 2 cbits — but the coin's fate is not symmetric. In redemption the settlement event itself burns the coin: A's Bell measurement destroys the pair (post-trade concurrence exactly 0), and the 2 classical bits merely deliver the correction key — the goods do not move on the quantum leg alone (B's pre-bits marginal is exactly I/2, the no-signaling tariff of the settlement). In the reverse quote the coin is the KEY, not the payment: one transmitted qubit unlocks 2 cbits, and the decode leaves a KNOWN Bell pair — a standard coin in a known frame, spendable in the next trade. Fuel in one direction, catalyst in the other; the parity holds, the accounting does not.\n",
  );
  out.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) out.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  out.push("\n## Boundaries\n");
  out.push(
    "- Mixed-coin netting (weak MIXED pairs to standard coins) is multi-copy and asymptotic — BBPS96 with its 1997 erratum, quoted here, not claimed as machine output. The executed netting is the pure-coin Procrustean grade exactly.\n" +
      "- The mint wall's non-increase census is DATA supporting a cited theorem (VIDAL00: convex-roof monotones do not rise under LOCC on average); the census is the machine's testimony, the theorem is the court's.\n" +
      "- The classical leg's thermodynamic tariff (kT ln 2 per bit) is the #11 schedule of the sibling books — cross-anchored (W-F), never re-executed here.\n" +
      "- Public-key quantum money remains open (quantum-mech's boundary stands); this desk notarizes with private keys the way Wiesner's bank does.\n",
  );
  out.push("\n## Closing\n");
  out.push(
    "The letter said: Bell pairs as money, no-cloning as the free notary. The coin's exclusivity and the notary's rates were already books. What this page adds is the desk: the currency is CONSUMED by spending (teleportation burns it), CATALYZED by quoting (dense coding returns it), GRADED by netting (2*l_min exactly), and NEVER printed locally — the mint is a global gate, and its logistics are the sibling ent-sched's book. An entanglement standard is not a metaphor: it is a parity with two asymmetric fates of the coin, and both columns balance to the last decimal.\n",
  );
  return out.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = writeReport("the-ent-clearing.md", renderBoard());
  console.log(`rendered -> ${path}`);
}
