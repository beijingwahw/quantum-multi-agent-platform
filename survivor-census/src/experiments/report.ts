/**
 * report — formats the census. Throws on an illegal census (the violations
 * are named in the error, never averaged away).
 */

import { auditCensus } from "../kernel/audit.js";
import type { Census } from "../kernel/audit.js";
import { schedule, waitingPrice } from "../kernel/waitprice.js";
import { CensusError } from "../kernel/errors.js";
import type { AllOutcomes } from "./run-all.js";

export function renderReport(o: AllOutcomes, census: Census, workspaceRoot: string): string {
  const violations = auditCensus(census, workspaceRoot);
  if (violations.length > 0) {
    throw new CensusError(
      "ILLEGAL-CENSUS",
      `ILLEGAL CENSUS — refusing to print:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
    );
  }

  const lines: string[] = [];
  lines.push("# The Survivor Census — who the many-worlds sorter actually keeps");
  lines.push("");
  lines.push("> The visitor's sentence: 'postselection lets the optimal branch stay, complexity");
  lines.push("> O(1) — the cost is the depreciation of the other universes, and I booked it in");
  lines.push("> my report.' The restart accounting, the counting power and the scheduling surface");
  lines.push("> all lived on the uniform prior (postselect-sched T1-T5). The survivor himself was");
  lines.push("> never audited. This is that audit: the survivor is the POSTERIOR over optima");
  lines.push("> weighted by the prior you brought (BAY63's inverse step, executed on branch");
  lines.push("> amplitudes); the kill register is itemized per universe and sums to 1-P exactly;");
  lines.push("> the waiting price is geometric with an exact schedule; and the boundaries are");
  lines.push("> executable — no funded optimum, no census. v0.2.0 adds two faces: stacked");
  lines.push("> ledgers compose by the chain rule with additive amortized odds (Table E), and");
  lines.push("> the phase-encoding census — the ledger is phase-blind, the state is");
  lines.push("> phase-carrying (Table F).");
  lines.push("");

  lines.push("## Table A — the instance family (n=4, integer priors)");
  lines.push("");
  lines.push("| instance | t (raw/funded) | P (amp path) | P (integer) | posterior 2-path dev | off-marked leak | killed (register) | killed (1-P) | odds/survivor |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const { instance, run } of o.outcomes) {
    lines.push(
      `| ${instance.name} | ${run.tRaw}/${run.tFunded} | ${run.pKeep.toPrecision(12)} | ${run.pKeepInteger.toPrecision(12)} | ${run.posteriorDev.toExponential(2)} | ${run.offMarkedLeak} | ${run.killedTotal.toPrecision(12)} | ${run.killedComplement.toPrecision(12)} | ${run.oddsPerSurvivor.toPrecision(10)} |`,
    );
  }
  lines.push("");
  lines.push(`Max posterior two-path deviation: **${o.posteriorMaxDev.toExponential(3)}**; max kill-complement deviation: **${o.killedMaxDev.toExponential(3)}**; max odds-identity deviation: **${o.oddsMaxDev.toExponential(3)}**.`);
  lines.push("");

  const light = o.outcomes.find((x) => x.instance.name === "light-optima");
  if (light) {
    lines.push("## Table B — the kill register, itemized (light-optima: the optimum is the least-funded branch)");
    lines.push("");
    lines.push("| killed universe x | prior mass w_x |");
    lines.push("| --- | --- |");
    for (const row of light.run.killRegister) {
      lines.push(`| ${row.x} | ${row.count}/${row.totalC} (${row.mass.toPrecision(10)}) |`);
    }
    lines.push(`| **total** | **${light.run.killedTotal.toPrecision(12)}** (register) = **${light.run.killedComplement.toPrecision(12)}** (1-P) |`);
    lines.push("");
    lines.push(`Uniform-prior cross-check: the flat register degenerates to 1/N per kill and the ledger to N/t — postselect-sched's home ground (deviation ${o.uniformFlatRegisterDev.toExponential(3)}).`);
    lines.push("");
  }

  lines.push("## Table C — the waiting price (exact schedule vs the conservative bound)");
  lines.push("");
  lines.push("| P | E[T] = 1/P | partial-sum path | dev | k(1e-6) exact | k(1e-6) bound | overcharge |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const p of [0.5, 0.25, 0.1, 2 ** -10, 2 ** -20]) {
    const w = waitingPrice(p);
    const s = schedule(p, 1e-6);
    lines.push(
      `| ${p.toPrecision(6)} | ${w.meanClosedForm.toPrecision(12)} | ${w.meanPartial.toPrecision(12)} | ${w.meanDev.toExponential(2)} | ${s.kExact} | ${s.kBound} | +${(s.overcharge * 100).toFixed(1)}% |`,
    );
  }
  lines.push("");
  lines.push(`All schedules minimal on the grid: **${o.scheduleAllMinimal}**; the bound never undercharges (min overcharge ${(o.scheduleMinOvercharge * 100).toFixed(2)}%). MC realization referee: waiting ${o.mcWaitingSigma.toFixed(2)} sigma, survivor posterior ${o.mcSurvivorSigma.toFixed(2)} sigma (DATA, not theorem).`);
  lines.push("");

  lines.push("## Table D — the census (every rate carries both faces)");
  lines.push("");
  lines.push("| id | claim | label | conditional face | unconditional face | witness/anchor |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of census.rows) {
    const anchor = row.witnessId ?? (row.quote !== undefined ? `${row.quote.repo}/${row.quote.report}` : "—");
    lines.push(`| ${row.id} | ${row.claim} | ${row.label} | ${row.conditionalFace} | ${row.unconditionalFace} | ${anchor} |`);
  }
  lines.push("");

  lines.push("## Table E — stacked ledgers: sequential postselection (S6, v0.2.0)");
  lines.push("");
  lines.push("| pair | P_A | P_2 (in A-frame) | P_AB direct | chain dev | register dev | sum dev | E[T] renewal dev | odds dev | order dev |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const { pair, run } of o.compositions) {
    lines.push(
      `| ${pair.name} | ${run.p1.toPrecision(10)} | ${run.p2.toPrecision(10)} | ${run.runAB.pKeep.toPrecision(10)} | ${run.chainDev.toExponential(2)} | ${run.registerComposeDev.toExponential(2)} | ${run.registerSumDev.toExponential(2)} | ${run.waitingRenewalDev.toExponential(2)} | ${run.oddsComposeDev.toExponential(2)} | ${run.orderDev.toExponential(2)} |`,
    );
  }
  lines.push("");
  lines.push(`Chain rule P_AB = P_A*P_2 max dev **${o.compositionChainMaxDev.toExponential(3)}**; posterior composition **${o.compositionPosteriorMaxDev.toExponential(3)}**; sequential-projection amplitude path **${o.compositionSurvivorMaxDev.toExponential(3)}**; amortized odds ADD with max dev **${o.compositionOddsMaxDev.toExponential(3)}**; identity stage exact: **${o.compositionIdentityHolds}**; idempotent: **${o.compositionIdempotentHolds}**; starved intersection refuses: **${o.starvedIntersectionRefused}**; the stacked ledgers' own audit (C1-C5) violations: **${o.compositionAuditViolations.length}**.`);
  lines.push("");

  lines.push("## Table F — the phase-encoding census: the ledger is phase-blind, the state is phase-carrying (S7, v0.2.0)");
  lines.push("");
  lines.push("| encoding family | P | P dev vs flat | register dev | E[T] dev | dephased reading dev | |<survivor\\|flat survivor>| |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of o.phaseCensus.rows) {
    lines.push(
      `| ${row.family} (${row.note}) | ${row.pKeep.toPrecision(10)} | ${row.pDev} | ${row.registerDev} | ${row.waitingDev} | ${row.dephasedReadingDev.toExponential(2)} | ${row.visibilityFlat.toPrecision(12)} |`,
    );
  }
  lines.push("");
  lines.push(`Ledger phase-blindness (max over families of P/register/E[T] deviation): **${o.phaseCensus.ledgerPhaseBlindnessDev}** — exactly zero, no encoding moves a mass in the bill; dephased reading = posterior under every encoding (max dev **${o.phaseCensus.dephasedReadingMaxDev.toExponential(3)}**). Self-overlap dev **${o.phaseCensus.selfOverlapMaxDev.toExponential(3)}**. Equality case (constant phase difference on the funded set — fourier-b3 vs ramp3+const, and sign-alt on this all-even marked set, detected per instance): |overlap| = 1 within **${o.phaseCensus.equalityCaseDev.toExponential(3)}**. Strictness margin on the censused non-constant families: **${o.phaseCensus.strictMargin.toExponential(3)}** (DATA over the enumerated families — a bounded census, not a theorem over all encodings).`);
  lines.push("");

  lines.push("## Witnesses");
  lines.push("");
  for (const w of census.witnesses) {
    lines.push(`- ${w.passed ? "PASS" : "FAIL"} — ${w.id}: ${w.description} (${w.detail})`);
  }
  lines.push("");

  lines.push("## The grammar failures (executable)");
  lines.push("");
  lines.push(`- **P=0**: the kernel refuses zero-branch conditioning (thrown error: 'undefined') — refusal witnessed: ${o.p0Refused}.`);
  lines.push(`- **P=1**: empty register, nothing sorted — witnessed: ${o.p1EmptyRegister}.`);
  lines.push(`- **unfunded optimum**: marked but zero prior weight — never returns, posterior exactly 0 there — witnessed: ${o.unfundedNeverReturn}.`);
  lines.push(`- **t=1**: the posterior is a point mass — the only regime where the singular 'the optimal branch' is honest — witnessed: ${o.t1PointMass}.`);
  lines.push("");

  return lines.join("\n") + "\n";
}
