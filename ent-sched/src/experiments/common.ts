import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Policy, RequestSpec, SimReport } from "../net/engine.js";
import { runSim } from "../net/engine.js";
import type { NetSpec } from "../net/topology.js";
import { Topology } from "../net/topology.js";

/** Fixed digits for report tables. */
export function fmt(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return String(x);
  if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e7)) {
    return x.toExponential(digits - 1);
  }
  return x.toFixed(digits);
}

export function fmtInt(x: number): string {
  return Math.round(x).toLocaleString("en-US");
}

export function writeReport(name: string, payload: unknown, markdown: string): void {
  const outDir = join(process.cwd(), "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(join(outDir, `${name}.md`), markdown, "utf8");
  console.log(markdown);
}

export const SEEDS = [11, 23, 37, 51, 89];

export interface MultiSeedResult {
  readonly reports: readonly SimReport[];
  readonly goodput: number;
  readonly goodputHalfRange: number;
  readonly meanFidelity: number;
  readonly keyRate: number;
  readonly jain: number;
  readonly spanP50: number;
  readonly spanP95: number;
  readonly good: number;
  readonly bad: number;
}

/** Mean over seeds; spread reported as half the max−min range (honest, not Gaussian). */
export function runMultiSeed(cfg: {
  net: NetSpec;
  requests: readonly RequestSpec[];
  policyFactory: (topo: Topology) => Policy;
  rounds: number;
  seeds?: readonly number[];
}): MultiSeedResult {
  const topo = new Topology(cfg.net);
  const reports = (cfg.seeds ?? SEEDS).map((seed) =>
    runSim({
      net: cfg.net,
      requests: cfg.requests,
      policy: cfg.policyFactory(topo),
      seed,
      rounds: cfg.rounds,
    })
  );
  const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
  const halfRange = (xs: number[]): number => (Math.max(...xs) - Math.min(...xs)) / 2;
  return {
    reports,
    goodput: mean(reports.map((r) => r.aggregate.goodput)),
    goodputHalfRange: halfRange(reports.map((r) => r.aggregate.goodput)),
    meanFidelity: mean(reports.map((r) => r.aggregate.meanFidelity)),
    keyRate: mean(reports.map((r) => r.aggregate.keyRate)),
    jain: mean(reports.map((r) => r.aggregate.jain)),
    spanP50: mean(reports.map((r) => r.aggregate.spanP50)),
    spanP95: mean(reports.map((r) => r.aggregate.spanP95)),
    good: mean(reports.map((r) => r.counters.good)),
    bad: mean(reports.map((r) => r.counters.bad)),
  };
}

export function chainNet(
  links: number,
  opts: {
    p?: number;
    slots?: number;
    f0?: number;
    t2?: number;
    cutOff?: number;
    qSwap?: number;
  } = {}
): NetSpec {
  const nodes = Array.from({ length: links + 1 }, (_, i) => `n${i}`);
  return {
    nodes,
    links: Array.from({ length: links }, (_, i) => ({
      id: `l${i}`,
      a: `n${i}`,
      b: `n${i + 1}`,
      p: opts.p ?? 0.5,
      slots: opts.slots ?? 2,
      f0: opts.f0 ?? 0.99,
    })),
    qSwap: opts.qSwap ?? 0.9,
    ...(opts.t2 !== undefined ? { t2: opts.t2 } : {}),
    ...(opts.cutOff !== undefined ? { cutOff: opts.cutOff } : {}),
  };
}

export function mdTable(header: string[], rows: string[][]): string {
  const head = `| ${header.join(" | ")} |`;
  const sep = `| ${header.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}
