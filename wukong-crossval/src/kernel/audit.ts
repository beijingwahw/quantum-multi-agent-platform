/**
 * The checker + witnesses for the cross-validation package.
 * Laws: X1 price nonempty; X2 tag/witness legal; X3 anchors on disk; X4 ids unique; renderer refuses.
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
} from "./crossval.js";
import { QUOTED_COUPLED, QUOTED_INSTANCES, QUOTED_LINEAR, QUOTED_P0_TOL, XVAL, type XvalRow } from "./ledger.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E"];

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
  const inst = instanceSet();
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
  const instAll = instanceSet();
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
  const instAll = instanceSet();
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
  const instAll = instanceSet();
  const target = instAll.find((i) => i.n === 8 && i.kind === "coupled") as (typeof instAll)[number];
  const params = optimizeOffline(target, 1);
  const e1 = exportCircuit(target, params, 1000);
  const e2 = exportCircuit(target, params, 1000);
  const roundTrip = e1.layers.length === 1 && (e1.layers[0] as { beta: number }).beta === (params.betas[0] as number) && JSON.stringify(e1) === JSON.stringify(e2) && e1.cost.linear.length === target.n;
  return { name: "W-D export round-trip", pass: roundTrip, detail: `deterministic JSON, ${e1.layers.length} layer(s), cost fields complete (${e1.cost.linear.length} linear)` };
}

function witnessFalsifierCensus(): WitnessResult {
  const inst = instanceSet();
  const bySize = new Map<number, number>();
  for (const i of inst) bySize.set(i.n, (bySize.get(i.n) ?? 0) + 1);
  const total = [...bySize.values()].reduce((a, b) => a + b, 0);
  const ok = total === QUOTED_INSTANCES && [...bySize.keys()].every((k) => [8, 12, 16, 20].includes(k));
  return { name: "W-E falsifier census", pass: ok, detail: `${[...bySize.entries()].map(([k, v]) => `n=${k}:${v}`).join(" ")} — every instance will be reported, hit rate as found` };
}

export function runWitnesses(): WitnessResult[] {
  return [witnessInstances(), witnessOffline(), witnessDryRun(), witnessExport(), witnessFalsifierCensus()];
}
