/**
 * Renders THE CROSS-VALIDATION PACKAGE — hardware path, executable half.
 *
 * Entry guard (batch 21): rendering fires only when this file is the invoked
 * program. The refusal gate covers the whole package: the ledger laws, the
 * witnesses, AND the recomputation laws for the allocation table (X6) and
 * the robustness census (X7) — a counterfeit number anywhere and nothing
 * renders.
 */
import { pathToFileURL } from "node:url";
import { XVAL } from "../kernel/ledger.js";
import { checkBudgetTable, checkRobustTable, checkXval, runWitnesses } from "../kernel/audit.js";
import { writeReport } from "./report.js";
import { instanceSet, type Instance } from "../kernel/crossval.js";
import { allocationScope, buildBudgetTable, budgetDepths, BUDGET_CAP, type BudgetRow } from "../kernel/budget.js";
import { CENSUS_BAND, CENSUS_DELTAS, perturbCensus, robustSummary, type PerturbRow } from "../kernel/robust.js";
import { exactProbe } from "../kernel/probe.js";
import { discriminatorRow, mcShellDemo } from "../kernel/discriminate.js";

const DISC_PROBES: readonly string[] = ["np-n8-0", "np-n12-4", "np-n16-7", "np-n20-11"];

function fmt(x: number | null): string {
  if (x === null) return "censored";
  return x >= 1000 ? x.toLocaleString("en-US") : String(x);
}

function sci(x: number): string {
  return x.toExponential(3);
}

function renderPackage(insts: readonly Instance[], budget: readonly BudgetRow[], censusRows: readonly PerturbRow[]): string {
  const lines: string[] = [];
  lines.push("# THE CROSS-VALIDATION PACKAGE — the hardware path's executable half\n");
  lines.push(
    "> The machine-time application's sole purpose: local exact engine vs real QPU, parameters offline, verification sampling only. This package is that experiment, built to the application's own specification and dry-run green — the granted hours plug into a running pipeline, not a plan.\n",
  );
  lines.push("| id | claim | price | exactness | witness |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of XVAL) {
    lines.push(`| ${r.id} | ${r.claim} | ${r.price} | ${r.exactness} | ${r.witness} |`);
  }
  lines.push("\n## Witnesses\n");
  for (const w of runWitnesses()) lines.push(`- ${w.pass ? "PASS" : "FAIL"} — ${w.name} (${w.detail})`);

  // ---- X6: the allocation table ----
  lines.push("\n## The allocation table (X6) — shot budgets before machine time\n");
  const censored = budget.filter((r) => r.shots === null);
  lines.push(
    `- ${budget.length} rows = instance x flip x effect x power target; ${censored.length} censored beyond the ${BUDGET_CAP.toLocaleString("en-US")}-shot cap (the Chernoff sufficient bound still ships on every censored row). Every row is recomputed by law X6; every Chernoff sufficiency claim is machine-verified.\n`,
  );
  lines.push("| instance | n | p | f | eff | 1-beta | p0 | p1 | N* | power | dips | Chernoff |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of budget) {
    lines.push(
      `| ${r.instanceId} | ${r.n} | ${r.depth} | ${r.flip} | ${r.effectRel} | ${(1 - r.beta).toFixed(2)} | ${sci(r.p0)} | ${sci(r.p1)} | ${fmt(r.shots)} | ${r.power?.toFixed(4) ?? "-"} | ${r.dips ?? "-"} | ${fmt(r.chernoff)} |`,
    );
  }
  const { excluded } = allocationScope(insts);
  lines.push(
    `\nExcluded by the effort tier (priced, disclosed): ${excluded.map((e) => e.id).join(", ")} — each n=20 row beyond the boundary probe costs ~25 exact-statevector optimizations at 2^20 amplitudes per pass.\n`,
  );

  // ---- X7: the robustness census ----
  lines.push("\n## The parameter-robustness census (X7) — transfer robustness as data\n");
  lines.push(`Perturbation grid deltas (rad): ${CENSUS_DELTAS.join(", ")}; degradation band across f in [${CENSUS_BAND[0]}, ${CENSUS_BAND[1]}] (exact Hamming-shell convolution, model-conditional).\n`);
  lines.push("| instance | n | p | E* | worst dE on grid | best gain (optimizer slack, as found) | min curvature | max curvature | p0 | band (f=.05 -> .01) |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  const includedInsts = allocationScope(insts).included;
  const summaries: string[] = [];
  for (const inst of includedInsts) {
    for (const depth of budgetDepths(inst.n)) {
      const s = robustSummary(exactProbe(inst, depth), CENSUS_DELTAS, CENSUS_BAND);
      summaries.push(`| ${s.instanceId} | ${s.n} | ${s.depth} | ${s.eStar.toFixed(4)} | ${sci(s.maxdE)} | ${sci(s.maxGain)} | ${sci(s.minCurvature)} | ${sci(s.maxCurvature)} | ${sci(s.p0)} | [${sci(s.band[0])}, ${sci(s.band[1])}] |`);
    }
  }
  lines.push(...summaries);
  lines.push(
    "\nReading note (as found): negative gains are the coarse offline optimizer's residue — the parameters that SHIP are grid+refine bests, not stationary points, and probes finer than the optimizer's own move sizes find slack (0.23% of |E*| at p=1 on the probe; 3-5% at p>=2, where the refine scales moves by 1/p). The census reports the slack; the degradation band and all rates remain exact for the parameters that ship.\n",
  );
  lines.push("\nSpecimen census rows (one probe per size, depth 1, every angle x delta):\n");
  lines.push("| instance | angle | delta | dE- | dE+ | curvature |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const id of DISC_PROBES) {
    const inst = insts.find((i) => i.id === id);
    if (inst === undefined) continue;
    for (const r of perturbCensus(exactProbe(inst, 1), CENSUS_DELTAS).rows) {
      lines.push(`| ${r.instanceId} | ${r.angle} | ${r.delta} | ${sci(r.dEminus)} | ${sci(r.dEplus)} | ${sci(r.curvature)} |`);
    }
  }
  lines.push(`\nAll ${censusRows.length} census rows are recomputed by law X7 (fake curvature is named and rejected); the table above renders the summaries and specimens.\n`);

  // ---- X8: the falsifier sharpened ----
  lines.push("\n## The falsifier sharpened (X8) — readout vs depolarizing, as data\n");
  lines.push("| instance | n | f | r | fit f | lambda | depol physical | shell1 readout | shell1 depol | gap | sigma @ planned | separable |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const id of DISC_PROBES) {
    const inst = insts.find((i) => i.id === id);
    if (inst === undefined) continue;
    const probe = exactProbe(inst, 1);
    for (const flip of [0.01, 0.02, 0.05]) {
      const plan = budget.find((b) => b.instanceId === id && b.depth === 1 && b.flip === flip && b.effectRel === 1 && b.beta === 0.2);
      const plannedShots = plan?.shots ?? BUDGET_CAP;
      const row = discriminatorRow(probe.masses, { instanceId: inst.id, n: inst.n, depth: 1 }, flip, plannedShots);
      lines.push(
        `| ${row.instanceId} | ${row.n} | ${row.flip} | ${sci(row.r)} | ${row.fitFlip.toFixed(4)} | ${row.fitLambda.toFixed(3)} | ${row.depolPhysical ? "yes" : "NO (lambda>1)"} | ${sci(row.shell1Readout)} | ${sci(row.shell1Depol)} | ${sci(row.gap)} | ${sci(row.sigma)} | ${row.separable ? "yes" : "NO"} |`,
      );
    }
  }
  const mc = mcShellDemo(insts.find((i) => i.id === "np-n8-0") as (typeof insts)[number], 1, 0.02, 40000, 5);
  lines.push(
    `\nMC demonstration under readout truth (n=8 probe, f=0.02, 40k shots, X3's own sampler): sampled shell-1 mass ${mc.shell1Estimate.toFixed(5)} vs readout prediction ${mc.readoutPrediction.toFixed(5)} vs depolarizing prediction ${mc.depolPrediction.toFixed(5)} — the data lands on the readout branch. As found: the two models are separated outright wherever the predicted change is an inflation (no physical depolarizing fit exists); at decay operating points separability dies with size — 4.7-10 sigma at n=12, 1.8-4.0 sigma at n=16 (borderline at f=0.01), 0.08-0.20 sigma at n=20 (NOT separable at any planned budget; ~100x the shots or a stronger statistic needed) — and the readout fit is only locally unique (a spurious global root near f=0.37 reproduces the same hit rate).\n`,
  );

  lines.push("\n## Closing\n");
  lines.push(
    "What remains outside this repo is exactly what the application names: the granted hours, the Sinan toolchain session, and the real readout confusion matrices. Everything else — instances with enumerated optima, offline parameters, export format, dry-run statistics, the falsifier, the allocation arithmetic, the robustness census, the discriminator — runs today. The allocation table is the calibration stage's answer before the hours arrive: at the offline p=1 parameters the hit rates barely clear the uniform floor at n=20 (~1.2x), so full-decay detection there is priced at >= 1e9 shots — the arithmetic justification for the application's parameter-candidate x layer x seed arm, which is what 10-20 hours must buy before verification sampling becomes affordable. When the hours arrive, the pipeline runs the same day; and if the hit rate decays at the noise boundary, the package is built to report the decay as the finding, which is what the application promised the reviewers.\n",
  );
  return lines.join("\n");
}

function main(): void {
  const insts = instanceSet();
  const budget = buildBudgetTable(insts);
  const censusRows: PerturbRow[] = [];
  for (const inst of allocationScope(insts).included) {
    for (const depth of budgetDepths(inst.n)) {
      censusRows.push(...perturbCensus(exactProbe(inst, depth), CENSUS_DELTAS).rows);
    }
  }
  const violations = [...checkXval(), ...checkBudgetTable(budget), ...checkRobustTable(censusRows)];
  const witnesses = runWitnesses();
  if (violations.length > 0 || witnesses.some((w) => !w.pass)) {
    const reasons = [
      ...violations.map((v) => `${v.row} [${v.law}]: ${v.detail}`),
      ...witnesses.filter((w) => !w.pass).map((w) => `${w.name}: ${w.detail}`),
    ];
    throw new Error(`CROSS-VALIDATION REJECTED — the package is not ready:\n${reasons.join("\n")}`);
  }
  const path = writeReport("the-xval-package.md", renderPackage(insts, budget, censusRows));
  console.log(`cross-validation package rendered -> ${path}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
