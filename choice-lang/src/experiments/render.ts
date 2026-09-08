/**
 * Renders THE CHOICE MODEL — the language's facts, families named.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { LAW_REGISTRY, MODEL } from "../kernel/ledger.js";
import { checkModel, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";

function renderModel(): string {
  const lines: string[] = [];
  lines.push("# THE CHOICE MODEL — choice as a language primitive, executed\n");
  lines.push(
    "> The ledger's OPEN row said 'no executable model exists'. This page is one: a minimal language whose choose steps compile to controlled branching, a marked world, and the facts that survive machine audit — every claim naming its program family. It renders only because the checker passed.\n",
  );
  lines.push("| id | claim | family | price | exactness | witness |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of MODEL) {
    lines.push(`| ${r.id} | ${r.claim} | ${r.family} | ${r.price} | ${r.exactness} | ${r.witness} |`);
  }
  lines.push("\n## The composition atlas (v0.2.0) — the machine-verified law registry\n");
  lines.push(
    "> Rows R7-R12 cite law ids; the checker's P5 refuses any citation outside this registry, so counterfeit composition identities and fake toll laws are named and rejected before they can ship. Every number below was re-derived by the witnesses at render time.\n",
  );
  lines.push(`registry: ${LAW_REGISTRY.join(" · ")}\n`);
  lines.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  lines.push("\n## Closing — what this does and does not settle\n");
  lines.push(
    "The model executes the route route-price priced: the legal boundary (controlled branching — the register steers, never broadcasts, the clone's double phase rate machine-read), stability as engineered invariance (drift at the rounding floor for any engineered program length; random programs sink toward the dimension ratio), the certification toll (knowing WHICH world costs its branch weight, 1/P reopened at the language layer), and the conserved charge that guards stability — invariance implies conservation for every input, the same implication shape as the discrete Noether layer. v0.2.0 adds the language's own composition laws: choosing after choosing is a homomorphism on weights and conditionings with an associating denotation (S1-S3), choosing inside choosing is context-free but the two nestings PRICE their common leaves differently (N1-N2 — the honest negative), the toll multiplies and compounds (T-MULT, L-TOLL), the charge stays conserved under composition and telescopes over bounded iteration (Q-COMP, L-TELE), and in the two-player census the toll is strategy-proof while the charge is the attack surface (G-TOLL). What it does NOT settle: the epoch-5 question. Stability here is compilation, not physics; the desired world is a fixed point because we built the branches that way, and the row stays OPEN for exactly that reason. The model's gift to the OPEN row is precise: it is now a question about nature, no longer a question about whether the question can be asked.\n",
  );
  return lines.join("\n");
}

function main(): void {
  const violations = checkModel();
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    // the renderer refuses to print an illegal model
    const reasons = [
      ...violations.map((v) => `${v.row} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`CHOICE MODEL REJECTED — the model does not compile:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-choice-model.md", renderModel());
  console.log(`choice model rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
