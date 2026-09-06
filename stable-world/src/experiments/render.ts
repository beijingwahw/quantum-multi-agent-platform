/**
 * Renders THE STABLE WORLD — the epoch-5 open core executed, one page.
 *
 * Entry guard (house law since batch 21): rendering fires only when this
 * file is the invoked program, so a test's import never executes the render.
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
  out.push("# THE STABLE WORLD — the desired world as the stable solution of the law, one page\n");
  out.push(
    "> The letter's epoch-5 sentence: 'make Choice a language primitive, and the desired world a stable solution.' The language half shipped as choice-lang (choose compiles; the world is stable BY CONSTRUCTION — engineered programs). Ledger row #15's cost column kept the physics half open: stability as PHYSICS, not compilation. This page is that half: a FIXED dissipative law whose absorbing class is the marked world — reached from anywhere, held forever, robust under law-error, and PAID FOR on the epoch-4 tariff schedule. It renders only because the checker passed.\n",
  );
  out.push("| id | claim | dynamics | price | tag | witness |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of BOARD) {
    out.push(`| ${r.id} | ${r.claim} | ${r.dynamics} | ${r.price} | ${r.exactness} | ${r.witness} |`);
  }
  out.push("\n## One functional, two regimes — the bridge to the Noether layer\n");
  out.push(
    "The membership charge Tr[Pi_W rho] is the same functional choice-lang conserved (R6) and this law drives home. Under an engineered branch program (a symmetry of the world split) the charge is conserved exactly for every input — invariance implies a conserved charge, the discrete-Noether implication shape. Under the dissipative law the same charge is strictly increasing off the world with increment exactly gamma(1-V): the symmetry's charge becomes the law's Lyapunov function (LYAP92, cited). Conservation guards a world you already hold; monotonicity buys you one you do not. Nothing more is claimed — the continuum Green-Laffont derivation stays excluded exactly as ledger rows #14/#16 wrote it.\n",
  );
  out.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) out.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  out.push("\n## Boundaries\n");
  out.push(
    "- The law is AUTHORED: the engineer writes the channel (damping into the marked world). Nature instantiating such a law is not claimed here — this is the machine layer, the same boundary vacuum-compiler ships under.\n" +
      "- The law selects the WORLD, never the CONTENTS: the within-world state is the initial diagonal blocks (path-dependent). A law that chose the contents would be a different, stronger object.\n" +
      "- Stability is PURCHASED: the sector-erasure tariff (AT5) pays the settled #11 schedule on the classical face; the coherent face (dephasing's thermodynamic price) is model-dependent and deliberately unpriced.\n" +
      "- Escape is unpriced by the law (it is impossible under the law); the two-rate chain is parametric — the thermal reading r = e^{-dE/kT} needs a thermal model and is not shipped.\n" +
      "- The perturbation census is DATA supporting an exact algebra bound; no theorem about the worst random channel is claimed beyond the bound itself.\n",
  );
  out.push("\n## Closing\n");
  out.push(
    "The ledger said: what stays open is stability as physics, not as compilation. Compilation keeps a world you already hold (the charge conserved); physics HANDS you the world (the charge monotone, the world absorbing, the attractor robust at epsilon law-error). The epoch-5 dream keeps its invoice: h2(q-bar) kT ln2 per run on the classical face, and the contents you must bring yourself. Scheduling as a physical law is now a mechanism with a bank account — settled at the machine layer, with nature's instantiation left where hardware questions live.\n",
  );
  return out.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = writeReport("the-stable-world.md", renderBoard());
  console.log(`rendered -> ${path}`);
}
