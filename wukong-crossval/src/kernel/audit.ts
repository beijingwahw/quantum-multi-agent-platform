/**
 * The checker + witnesses for the cross-validation package.
 * Laws: X1 price nonempty; X2 tag/witness legal; X3 anchors on disk; X4 ids unique; renderer refuses.
 * X6: every allocation-table row is recomputed from the exact kernel — a
 *     counterfeit budget (a claimed N whose power the binomial arithmetic
 *     does not deliver, an invented effect size) is named and rejected.
 * X7: every robustness-census row is recomputed — a fake curvature or
 *     perturbation response is named and rejected.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  costTable,
  expectation,
  exportCircuit,
  instanceSet,
  makeRng,
  optimizeOffline,
  runQaoa,
  sampleWithReadoutNoise,
  uniformState,
  type Instance,
} from "./crossval.js";
import { QUOTED_COUPLED, QUOTED_INSTANCES, QUOTED_LINEAR, QUOTED_P0_TOL, XVAL, type XvalRow } from "./ledger.js";
import { budgetRowFromMasses, BUDGET_CAP, type BudgetRow } from "./budget.js";
import { perturbCensus, type PerturbRow } from "./robust.js";
import { exactProbe } from "./probe.js";
import { powerAt } from "./power.js";
import { discriminatorRow, mcShellDemo } from "./discriminate.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-G", "W-H"];

/** The instance set is pure and deterministic (seeded); the n=20 universe
 * costs ~1M states per instance, so the audit memoizes it per process —
 * the witnesses and checkers below all share the one enumeration. */
let instMemo: Instance[] | undefined;
function instances(): Instance[] {
  instMemo ??= instanceSet();
  return instMemo;
}

/** What reaches the audit boundary: rows as they arrive at runtime. The
 * `XvalRow` type promises exactness in {EXACT, DATA}, but X2 exists precisely
 * to reject tags that lie about that — so the checker's input widens the tag
 * to plain string and the guard stays. */
export type XvalRowInput = Omit<XvalRow, "exactness"> & { readonly exactness: string };

export function checkXval(rows: readonly XvalRowInput[] = XVAL): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "X4", detail: "duplicate xval row id" });
    seen.add(r.id);
    if (r.price.trim().length === 0) violations.push({ row: r.id, law: "X1", detail: "an unpriced claim — the package does not ship" });
    if (r.exactness !== "EXACT" && r.exactness !== "DATA") violations.push({ row: r.id, law: "X2", detail: `illegal tag "${String(r.exactness)}"` });
    if (!WITNESS_IDS.includes(r.witness)) violations.push({ row: r.id, law: "X2", detail: `cites unknown witness "${r.witness}"` });
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) violations.push({ row: r.id, law: "X3", detail: `anchor repo missing on disk: ${a}` });
    }
  }
  return violations;
}

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

function witnessInstances(): WitnessResult {
  const inst = instances();
  const lin = inst.filter((i) => i.kind === "linear");
  let sep = true;
  for (const i of lin) {
    let v = 0;
    for (let k = 0; k < i.n; k++) if ((i.linear[k] as number) > 0) v += i.linear[k] as number;
    if (Math.abs(i.optValue - v) > 1e-12) sep = false;
  }
  const ok = inst.length === QUOTED_INSTANCES && lin.length === QUOTED_LINEAR && inst.length - lin.length === QUOTED_COUPLED && sep;
  return { name: "W-A instance set + separable second path", pass: ok, detail: `${inst.length} instances (${lin.length} linear second-path exact, ${inst.length - lin.length} coupled enumerated)` };
}

function witnessOffline(): WitnessResult {
  const instAll = instances();
  const target = instAll.find((i) => i.n === 8 && i.kind === "coupled") as (typeof instAll)[number];
  // p=0 anchor: uniform expectation = mean cost
  const costs = costTable(target);
  const psi0 = uniformState(target.n);
  const e0 = expectation(psi0, costs);
  const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
  // optimization runs offline and improves the expectation
  const params = optimizeOffline(target, 1);
  const e1 = expectation(runQaoa(target, params), costs);
  // normalization at p=1
  let psum = 0;
  const psi1 = runQaoa(target, params);
  const dim = psi1.length >> 1;
  for (let k = 0; k < dim; k++) psum += psi1[k]! * psi1[k]! + (psi1[dim + k] as number) * (psi1[dim + k] as number);
  const ok = Math.abs(e0 - mean) < QUOTED_P0_TOL && e1 < e0 && Math.abs(psum - 1) < 1e-9;
  return { name: "W-B offline optimization anchors", pass: ok, detail: `p=0: E = mean cost (${e0.toFixed(6)} vs ${mean.toFixed(6)}); p=1 improves to ${e1.toFixed(4)}; norm 1 at ${psum.toFixed(12)}` };
}

function witnessDryRun(): WitnessResult {
  const instAll = instances();
  const target = instAll.find((i) => i.n === 8 && i.kind === "coupled") as (typeof instAll)[number];
  const params = optimizeOffline(target, 1);
  const psi = runQaoa(target, params);
  const zero = sampleWithReadoutNoise(psi, target.n, target.optBits, 6000, 0, makeRng(7));
  const noisy = sampleWithReadoutNoise(psi, target.n, target.optBits, 6000, 0.02, makeRng(42));
  const stay = (1 - 0.02) ** target.n;
  const calibOk = Math.abs(noisy.calibratedHitRate - noisy.observedHitRate / stay) < 1e-9 || noisy.calibratedHitRate === 1;
  const mcOk = Math.abs(zero.rawHitRate - zero.observedHitRate) < 0.02;
  const ok = zero.observedHitRate > 0 && mcOk && calibOk;
  return {
    name: "W-C dry-run QPU",
    pass: ok,
    detail: `zero-noise raw ${zero.rawHitRate.toFixed(4)} vs observed ${zero.observedHitRate.toFixed(4)}; noisy observed ${noisy.observedHitRate.toFixed(4)} -> calibrated ${noisy.calibratedHitRate.toFixed(4)} (stay ${(stay).toFixed(4)})`,
  };
}

function witnessExport(): WitnessResult {
  const instAll = instances();
  const target = instAll.find((i) => i.n === 8 && i.kind === "coupled") as (typeof instAll)[number];
  const params = optimizeOffline(target, 1);
  const e1 = exportCircuit(target, params, 1000);
  const e2 = exportCircuit(target, params, 1000);
  const roundTrip = e1.layers.length === 1 && (e1.layers[0] as { beta: number }).beta === (params.betas[0] as number) && JSON.stringify(e1) === JSON.stringify(e2) && e1.cost.linear.length === target.n;
  return { name: "W-D export round-trip", pass: roundTrip, detail: `deterministic JSON, ${e1.layers.length} layer(s), cost fields complete (${e1.cost.linear.length} linear)` };
}

function witnessFalsifierCensus(): WitnessResult {
  const inst = instances();
  const bySize = new Map<number, number>();
  for (const i of inst) bySize.set(i.n, (bySize.get(i.n) ?? 0) + 1);
  const total = [...bySize.values()].reduce((a, b) => a + b, 0);
  const ok = total === QUOTED_INSTANCES && [...bySize.keys()].every((k) => [8, 12, 16, 20].includes(k));
  return { name: "W-E falsifier census", pass: ok, detail: `${[...bySize.entries()].map(([k, v]) => `n=${k}:${v}`).join(" ")} — every instance will be reported, hit rate as found` };
}

// ---------------------------------------------------------------------------
// Laws X6/X7 — the recomputation checkers for the two offline-arm tables.
// The input types are the row types themselves: the smuggling vector is the
// VALUES (a claimed N the arithmetic does not deliver, an invented
// curvature), and the checker recomputes every field from the exact kernel.
// ---------------------------------------------------------------------------

function numEq(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function budgetRowKey(r: BudgetRow): string {
  return `${r.instanceId}#p${r.depth} f=${r.flip} eff=${r.effectRel} beta=${r.beta}`;
}

/** Law X6: every allocation row recomputed from the exact kernel. A row is
 * contraband if any field disagrees with the recomputation, if the claimed
 * minimum fails two-sided verification, or if the Chernoff sufficiency
 * machine-check fails on a row that claims it. */
export function checkBudgetTable(rows: readonly BudgetRow[]): Violation[] {
  const violations: Violation[] = [];
  const byGroup = new Map<string, BudgetRow[]>();
  for (const r of rows) {
    const g = `${r.instanceId}#${r.depth}`;
    byGroup.set(g, [...(byGroup.get(g) ?? []), r]);
  }
  for (const [g, group] of byGroup) {
    const head = group[0] as BudgetRow;
    const inst = instances().find((i) => i.id === head.instanceId);
    if (inst === undefined) {
      violations.push({ row: g, law: "X6", detail: `unknown instance "${String(head.instanceId)}" — fabricated row id` });
      continue;
    }
    const probe = exactProbe(inst, head.depth);
    const meta = { instanceId: inst.id, n: inst.n, kind: inst.kind, depth: head.depth };
    for (const r of group) {
      const key = budgetRowKey(r);
      const truth = budgetRowFromMasses(probe.masses, meta, r.flip, r.effectRel, r.alpha, r.beta, BUDGET_CAP);
      if (!numEq(r.p0, truth.p0) || !numEq(r.p1, truth.p1)) {
        violations.push({
          row: key,
          law: "X6",
          detail: `counterfeit effect: claimed p0=${String(r.p0)} p1=${String(r.p1)}, the exact kernel recomputes p0=${String(truth.p0)} p1=${String(truth.p1)}`,
        });
        continue;
      }
      if (r.shots !== truth.shots) {
        violations.push({
          row: key,
          law: "X6",
          detail: `counterfeit budget: claimed N=${String(r.shots)}, the exact binomial minimum is ${String(truth.shots)}`,
        });
        continue;
      }
      if (!numEq(r.power, truth.power)) {
        violations.push({ row: key, law: "X6", detail: `counterfeit power: claimed ${String(r.power)}, recomputed ${String(truth.power)} at the claimed N` });
      }
      if (r.chernoff !== truth.chernoff) {
        violations.push({ row: key, law: "X6", detail: `counterfeit chernoff bound: claimed ${String(r.chernoff)}, recomputed ${String(truth.chernoff)}` });
      }
      if (r.chernoffVerified && !truth.chernoffVerified) {
        violations.push({ row: key, law: "X6", detail: `chernoff sufficiency failed machine verification (exact power at the bound < 1 - beta) — the bound is not honest on this row` });
      }
      if (truth.shots !== null) {
        const target = 1 - r.beta;
        if ((truth.power as number) < target || powerAt(truth.shots - 1, r.p0, r.p1, r.alpha) >= target) {
          violations.push({ row: key, law: "X6", detail: `minimality not two-sided verified: power(N*)=${String(truth.power)} vs target ${target}` });
        }
      }
    }
  }
  return violations;
}

function robustRowKey(r: PerturbRow): string {
  return `${r.instanceId}#p${r.depth} ${r.angle} delta=${r.delta}`;
}

/** Law X7: every robustness-census row recomputed from the exact kernel.
 * A row is contraband if the angle/delta point does not exist in the kernel
 * census or any response field disagrees with the recomputation. */
export function checkRobustTable(rows: readonly PerturbRow[]): Violation[] {
  const violations: Violation[] = [];
  const byGroup = new Map<string, PerturbRow[]>();
  for (const r of rows) {
    const g = `${r.instanceId}#${r.depth}`;
    byGroup.set(g, [...(byGroup.get(g) ?? []), r]);
  }
  for (const [g, group] of byGroup) {
    const head = group[0] as PerturbRow;
    const inst = instances().find((i) => i.id === head.instanceId);
    if (inst === undefined) {
      violations.push({ row: g, law: "X7", detail: `unknown instance "${String(head.instanceId)}" — fabricated row id` });
      continue;
    }
    const deltas = [...new Set(group.map((r) => r.delta))];
    const census = perturbCensus(exactProbe(inst, head.depth), deltas);
    for (const r of group) {
      const key = robustRowKey(r);
      const truth = census.rows.find((t) => t.angle === r.angle && t.delta === r.delta);
      if (truth === undefined) {
        violations.push({ row: key, law: "X7", detail: `fake robustness row: angle "${String(r.angle)}" at delta ${String(r.delta)} does not exist in the kernel census` });
        continue;
      }
      if (!numEq(r.dEminus, truth.dEminus) || !numEq(r.dEplus, truth.dEplus) || !numEq(r.curvature, truth.curvature)) {
        violations.push({
          row: key,
          law: "X7",
          detail: `fake robustness row: claimed dE-/dE+/curv ${String(r.dEminus)}/${String(r.dEplus)}/${String(r.curvature)}, the exact kernel recomputes ${String(truth.dEminus)}/${String(truth.dEplus)}/${String(truth.curvature)}`,
        });
      }
    }
  }
  return violations;
}

function witnessBudgetLaw(): WitnessResult {
  const inst = instances().find((i) => i.id === "np-n8-0");
  if (inst === undefined) return { name: "W-F budget law", pass: false, detail: "probe instance missing" };
  const meta = { instanceId: inst.id, n: inst.n, kind: inst.kind, depth: 1 };
  const probe = exactProbe(inst, 1);
  const clean = [budgetRowFromMasses(probe.masses, meta, 0.02, 1, 0.05, 0.2, BUDGET_CAP)];
  const counterfeit = clean.map((r) => ({ ...r, shots: 5, power: 0.9 }));
  const cleanOk = checkBudgetTable(clean).length === 0;
  const caught = checkBudgetTable(counterfeit).find((v) => v.law === "X6");
  const pass = cleanOk && (caught?.row.includes("np-n8-0") ?? false);
  return {
    name: "W-F budget law (recompute + counterfeit trial)",
    pass,
    detail: caught === undefined
      ? `clean table ${cleanOk ? "clean" : "DIRTY"} — counterfeit NOT caught (law broken)`
      : `clean table ${cleanOk ? "clean" : "DIRTY"}; counterfeit N=5/power=0.9 named and rejected (${caught.row})`,
  };
}

function witnessRobustLaw(): WitnessResult {
  const inst = instances().find((i) => i.id === "np-n8-0");
  if (inst === undefined) return { name: "W-G robustness law", pass: false, detail: "probe instance missing" };
  const census = perturbCensus(exactProbe(inst, 1), [0.05]);
  const cleanOk = checkRobustTable(census.rows).length === 0;
  const counterfeit = census.rows.map((r) => ({ ...r, curvature: 0, dEplus: 0 }));
  const caught = checkRobustTable(counterfeit).find((v) => v.law === "X7");
  const pass = cleanOk && (caught?.row.includes("np-n8-0") ?? false);
  return {
    name: "W-G robustness law (recompute + counterfeit trial)",
    pass,
    detail: caught === undefined
      ? `clean census ${cleanOk ? "clean" : "DIRTY"} — fake curvature NOT caught (law broken)`
      : `clean census ${cleanOk ? "clean" : "DIRTY"}; fake curvature row named and rejected (${caught.row})`,
  };
}

function witnessDiscriminator(): WitnessResult {
  const probes = ["np-n8-0", "np-n12-4", "np-n16-7", "np-n20-11"];
  let fitsOk = true;
  let recomputeOk = true;
  for (const id of probes) {
    const inst = instances().find((i) => i.id === id);
    if (inst === undefined) {
      recomputeOk = false;
      continue;
    }
    const probe = exactProbe(inst, 1);
    const row = discriminatorRow(probe.masses, { instanceId: inst.id, n: inst.n, depth: 1 }, 0.02, 1_000_000);
    if (row.fitFlipResidual > 1e-12) fitsOk = false;
    const again = discriminatorRow(probe.masses, { instanceId: inst.id, n: inst.n, depth: 1 }, 0.02, 1_000_000);
    if (Math.abs(again.gap - row.gap) > 0 || Math.abs(again.sigma - row.sigma) > 0) recomputeOk = false;
  }
  const mc = mcShellDemo(instances().find((i) => i.id === "np-n8-0") as Instance, 1, 0.02, 40000, 5);
  const mcSigma = Math.sqrt((mc.readoutPrediction * (1 - mc.readoutPrediction)) / 40000);
  const mcOk = Math.abs(mc.shell1Estimate - mc.readoutPrediction) <= 4 * mcSigma;
  const pass = fitsOk && recomputeOk && mcOk;
  return {
    name: "W-H discriminator arithmetic",
    pass,
    detail: `local fits residual < 1e-12 on all 4 size probes (${fitsOk ? "yes" : "NO"}); deterministic recompute (${recomputeOk ? "yes" : "NO"}); MC shell-1 within 4 sigma of the readout prediction (${mc.shell1Estimate.toFixed(5)} vs ${mc.readoutPrediction.toFixed(5)}, ${mcOk ? "yes" : "NO"})`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [
    witnessInstances(),
    witnessOffline(),
    witnessDryRun(),
    witnessExport(),
    witnessFalsifierCensus(),
    witnessBudgetLaw(),
    witnessRobustLaw(),
    witnessDiscriminator(),
  ];
}
