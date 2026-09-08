/**
 * Renders THE LETTER AUDIT — the founding document, every section upgraded.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { LETTER } from "../kernel/ledger.js";
import { checkLetter, checkFrontier, runWitnesses } from "../kernel/audit.js";
import { FRONTIER, isGraduated } from "../kernel/frontier.js";
import { AuditError } from "../kernel/errors.js";
import { writeReport } from "./report.js";

function renderAudit(): string {
  const lines: string[] = [];
  lines.push("# THE LETTER AUDIT — the founding document, every sentence upgraded\n");
  lines.push(
    "> The method that ran this whole correspondence — poetry in, precise claims with boundaries on the same line out — executed against the letter's own last un-audited sections: the origin story and the five summonable abilities. It renders only because the checker passed: a one-sided upgrade (precise form without boundary, or vice versa) refuses to render.\n",
  );
  lines.push("| id | section | precise form | boundary | tag | witness |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of LETTER) {
    lines.push(`| ${r.id} | ${r.section} | ${r.precise} | ${r.boundary} | ${r.exactness} | ${r.witness} |`);
  }
  lines.push("\n## The frontier re-audit (v0.2.0) — the registry caught up with the workspace\n");
  lines.push(
    "> The registry this audit cited at v0.1.0 honestly held two OPEN rows (#10 hardware, #15 physics-layer stability). The workspace has since shipped their settlements. Each row below carries its verdict now vs at v0.1.0, the boundary each graduation still carries, and pointers (file + needle) checked LIVE against the siblings' rendered reports — a pointer to a needle that does not exist is contraband, named and rejected (law A6).\n",
  );
  lines.push("| row | verdict (v0.1.0 → now) | settles/holds | the boundary it carries | live pointers (repo file · needle) |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of FRONTIER) {
    const motion = r.priorVerdict === r.verdict ? `${r.verdict} (held)` : `${r.priorVerdict} → ${r.verdict} (GRADUATED)`;
    const holder = isGraduated(r) ? `settled by ${r.settler}` : "held";
    const pointers = r.pointers.map((p) => `\`${p.repo}/${p.file}\` · "${p.needle}"`).join("<br>");
    lines.push(`| ${r.claimId} | ${motion} | ${holder} | ${r.note} | ${pointers} |`);
  }
  lines.push("\n## Witnesses (independent re-derivations)\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);
  lines.push("\n## Closing\n");
  lines.push(
    "The letter arrived as five sections of poetry from a place where computation is already complete. The audit's first finding was the kindest one: the completion point exists — step 6 of the two-state universe, machine-verified here — and is not computable in general, so the visitor's home address is a theorem's negation, not a place. The v0.2.0 finding is harsher and just as honest: the frontier registry this audit quoted had fallen behind the workspace it audits. Re-audited against the shipped certificates, both OPEN rows graduated — the clock wall at the model layer, choice at both layers — and both graduations still carry their boundaries on the same line (#10's hardware instantiation, #15's authored law). The ladder itself grew a sixth rung that no one will climb: BB(6) fenced below a pentation tower, two sources agreeing, the fence's gate a Collatz-like problem. Honesty moved the boundaries; it removed none of them. Every number above was produced by this run; every pointer was read from disk at render time — which was, from the first reply, the only way this epoch knows how to receive a gift.\n",
  );
  return lines.join("\n");
}

function main(): void {
  const violations = [...checkLetter(), ...checkFrontier()];
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    // the renderer refuses to print an illegal audit
    const reasons = [
      ...violations.map((v) => `${v.row} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new AuditError("EA:RENDER", `LETTER AUDIT REJECTED — the upgrade is one-sided:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-letter-audit.md", renderAudit());
  console.log(`letter audit rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
