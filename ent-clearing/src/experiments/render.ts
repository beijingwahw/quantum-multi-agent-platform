/**
 * Renders THE ENT CLEARING — the settlement layer of the entanglement
 * standard, one page.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render. The section
 * builders are exported so the run-all main provably calls them — a silent
 * no-op repro is how desks launder numbers, and this desk does not.
 */
import { pathToFileURL } from "node:url";
import { BOARD } from "../kernel/board.js";
import { checkBoard, checkGhzClaims, checkLedger, checkYieldTable, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";
import { hashingLineWerner, YIELD_TABLE } from "../kernel/purify.js";
import { computeLedger } from "../kernel/ledger.js";
import { ghzLocalCensus, GHZ_CLAIMS } from "../kernel/ghz.js";
import { makeRng } from "../core/rng.js";

function fmt(x: number, digits = 6): string {
  return x.toFixed(digits);
}

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
  return out.join("\n");
}

/** The purification desk — mixed-coin netting at bounded exact scale. */
export function renderPurificationSection(): string {
  const violations = checkYieldTable();
  if (violations.length > 0) {
    const lines = violations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the yield table is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const out: string[] = [];
  out.push("\n## The purification desk — mixed coins netted at bounded exact scale (E7)\n");
  out.push(
    "v0.1.0 quoted the BBPS96 asymptotic and did not execute it. This desk now executes the recurrence round exactly on 16x16 density matrices: a bilateral CNOT between the two coins, the sacrifice pair measured in the computational basis, the source kept when the outcomes agree, the survivor re-Wernerized by the depolarizing step (the exact 24-element local-Clifford twirl — the paper's random bilateral rotations in finite form). Every probability below is a product of exactly-executed round probabilities; the closed forms (p = F² + 2F(1-F)/3 + 5(1-F)²/9, F' = (F²+(1-F)²/9)/p, and the general Bell-diagonal XOR form) recompute to 1e-12.\n",
  );
  out.push("| id | coin | n | tag | p(chain) | F_out | C_out | E_F_out | coin-yield p/n | E_F-yield | hashing line (QUOTED) |");
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of YIELD_TABLE) {
    const F = r.family === "WERNER" ? r.param : 1 - (3 * r.param) / 4;
    const hash = hashingLineWerner(F);
    const grade = r.family === "WERNER" ? `Werner F=${r.param}` : `depol p=${r.param} (F=${fmt(F, 4)})`;
    const scale = Number.isFinite(r.scale) ? String(r.scale) : "inf";
    out.push(
      `| ${r.id} | ${grade} | ${scale} | ${r.tag} | ${fmt(r.pSucc)} | ${fmt(r.fidelityOut)} | ${fmt(r.cOut)} | ${fmt(r.efOut)} | ${fmt(r.coinYield)} | ${fmt(r.efYield)} | ${fmt(hash)} |`,
    );
  }
  out.push("\n### Gap accounting — the executed curve vs the quoted line, honestly\n");
  out.push(
    "- **Grade gap.** Every EXECUTED row delivers a sub-standard coin (F_out < 1 exactly — bounded-scale recurrence never mints a standard coin; the mint wall holds inside the desk too). The hashing line counts coins at F -> 1, so its rate and the executed yields are not like-for-like: the desk trades grade for rate.\n" +
      "- **Protocol gap.** The recurrence is 2 -> 1 per round: its own asymptotic yield is exactly zero, which is BBPS96's reason for inventing hashing. At n = 2, 3, 4 the executed yield falls as n rises while F_out rises — the tradeoff itself, measured.\n" +
      "- **Threshold honesty.** At F = 0.45 the round DEGRADES the coin (0.45 -> 0.440871) — purification improves fidelity only above F = 1/2, and the quoted hashing line is negative below F ~ 0.8107 (the machine brackets the sign change between F = 0.81 and F = 0.82): at those grades there is no asymptotic distillation either, only bounded netting that still returns something.\n" +
      "- **The twirl is load-bearing.** Without the depolarizing step the round's output concentrates its error in the phase slot and the NEXT raw round degrades the coin (0.884146 -> 0.812024 at F = 0.85, machine-measured). The protocol's step is not decoration; it is what makes the recurrence a recurrence.\n" +
      "- **Modern context, cited not executed.** ZANG25 (no-go theorems for universal purification) and LAMI24 (exact distillable entanglement under dually non-entangling operations) bound what any such desk can promise; both are anchors in citations.md, not machine output here.\n",
  );
  return out.join("\n");
}

/** The conservation ledger — the catalyst census. */
export function renderLedgerSection(): string {
  const violations = checkLedger();
  if (violations.length > 0) {
    const lines = violations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the conservation ledger is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const out: string[] = [];
  out.push("\n## The conservation ledger — what settlement conserves, exactly (E8)\n");
  out.push(
    "Across every settlement op the machine measures the give and the get. The catalyst's E_F is conserved EXACTLY (dense coding returns the coin undiminished); the fuel's E_F is destroyed EXACTLY (teleportation: delta exactly -1); every netting and purification row never rises (the VIDAL00 toll instantiated, branch-averaged); and the GHZ withdrawal conserves two cuts exactly while settling the third. The checker recomputes every delta — a fake conservation identity does not survive.\n",
  );
  out.push("| id | op | resource | before | after | claim | note |");
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const e of computeLedger()) {
    out.push(`| ${e.id} | ${e.op} | ${e.resource} | ${fmt(e.before)} | ${fmt(e.after)} | ${e.claim} | ${e.note} |`);
  }
  out.push(
    "\nThe one-line law the census supports: cbits are created freely where the parity demands them (2 for a redemption, 2 for a quote, 1 for a filter verdict, 2 for a round's comparison), the coin is conserved only when it is a CATALYST, and expected E_F never rises anywhere — the desk moves and spends, it never prints.\n",
  );
  return out.join("\n");
}

/** The GHZ bank — the multi-party desk. */
export function renderGhzSection(): string {
  const violations = checkGhzClaims();
  if (violations.length > 0) {
    const lines = violations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the GHZ bank's claims are illegal — refusing to print them:\n${lines.join("\n")}`);
  }
  const census = ghzLocalCensus(makeRng(203), 150);
  const out: string[] = [];
  out.push("\n## The GHZ bank — does the mint wall survive three parties? (E9)\n");
  out.push(
    "A GHZ coin is held jointly: no two parties share a coin (pairwise concurrences exactly 0) yet every 1-vs-2 cut carries exactly 1/2 negativity. Any two parties can withdraw: C measures X and sends 1 cbit, and AB end holding a KNOWN standard coin (both branches pure Bell, concurrence exactly 1). The wall that survives is PER CUT — the withdrawal conserves the A|BC and B|AC cuts exactly and settles the AB|C cut to zero; a 150-round census of random local channels never raises any cut (worst rise 0). The wall that FAILS is the pairwise ledger — C_AB rises 0 -> 1 under one LOCC withdrawal, an exact counterexample. Entanglement MOVES between ledgers; it is never printed.\n",
  );
  out.push("| id | claim | verdict |");
  out.push("| --- | --- | --- |");
  for (const c of GHZ_CLAIMS) {
    out.push(`| ${c.id} | ${c.claim} | ${c.tag} |`);
  }
  out.push(
    `\n\nCensus backing G6/G7: ${census.rounds} rounds of independent random local channels on all three parties — worst pairwise concurrence ${census.worstPairwiseC.toExponential(3)}, worst cut rise ${census.worstCutRise.toExponential(3)} (cuts start at 1/2 and only fall). The cut monotonicity is VW02, cited; the census is the testimony.\n`,
  );
  return out.join("\n");
}

function renderTail(): string {
  const out: string[] = [];
  out.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) out.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  out.push("\n## Boundaries\n");
  out.push(
    "- Mixed-coin netting is EXECUTED at bounded scale (n = 2, 3, 4, exact kernels): the BBPSSW recurrence with its depolarizing step realized as the exact 24-element local-Clifford twirl. The n -> infinity asymptotics — hashing's positive rate above F ~ 0.8107, and the no-go/exactness results of ZANG25/LAMI24 — remain quoted, never claimed as machine output.\n" +
      "- The bounded schemes never deliver a standard coin (F_out < 1 exactly); the mint wall holds inside the purification desk as everywhere else.\n" +
      "- The mint wall's non-increase is a census (DATA) supporting cited theorems (VIDAL00 for E_F, VW02 for cut negativity); the machine testifies, the court cites.\n" +
      "- The classical leg's thermodynamic tariff (kT ln 2 per bit) is the #11 schedule of the sibling books — cross-anchored (W-F), never re-executed here.\n" +
      "- The GHZ census is bounded (150 local rounds, single-qubit local channels); deeper LOCC strategies and larger banks are not explored.\n" +
      "- Public-key quantum money remains open (quantum-mech's boundary stands); this desk notarizes with private keys the way Wiesner's bank does.\n",
  );
  out.push("\n## Closing\n");
  out.push(
    "The letter said: Bell pairs as money, no-cloning as the free notary. The coin's exclusivity and the notary's rates were already books. What this page adds is the desk: the currency is CONSUMED by spending (teleportation burns it), CATALYZED by quoting (dense coding returns it), GRADED by netting (2*l_min exactly for pure coins, executed recurrence rounds for mixed ones at bounded scale), conserved exactly where it is a catalyst (the ledger), banked jointly where three parties hold it (the GHZ desk), and NEVER printed locally — the mint is a global gate, and its logistics are the sibling ent-sched's book. An entanglement standard is not a metaphor: it is a parity with two asymmetric fates of the coin, a ledger where only the catalyst's row balances to zero, and both columns balance to the last decimal.\n",
  );
  return out.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const page = [
    renderBoard(),
    renderPurificationSection(),
    renderLedgerSection(),
    renderGhzSection(),
    renderTail(),
  ].join("\n");
  const path = writeReport("the-ent-clearing.md", page);
  console.log(`rendered -> ${path}`);
}
