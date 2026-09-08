import { Rng } from "../core/rng.js";
import { FtQaoaError } from "../core/errors.js";
import { randomIsing } from "../core/ising.js";
import type { IsingModel } from "../core/ising.js";
import { DEFAULT_FT_ASSUMPTIONS, estimateDeepQaoa, selectCodes } from "../ft/estimate.js";
import type { DeepQaoaEstimate, FtAssumptions, TFactoryAssumptions } from "../ft/estimate.js";
import { grossCode } from "../ft/codes.js";
import { CONSTANTS_AUDIT, renderConstantsAudit, validateConstantsAudit } from "../ft/constants.js";
import { fmt, fmtInt, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

const SEED = 20260905;

const T_FACTORY_SCENARIOS: ReadonlyArray<{ id: string; factory: TFactoryAssumptions }> = [
  { id: "optimistic-100ns", factory: { physicalQubits: 5000, nsPerT: 100, epsilonPerT: 1e-12, source: "assumption (100 ns / T, 5k qubits per chain)" } },
  { id: "moderate-10us", factory: { physicalQubits: 5000, nsPerT: 10000, epsilonPerT: 1e-12, source: "assumption (10 us / T, 5k qubits per chain)" } },
  { id: "conservative-60us", factory: { physicalQubits: 12000, nsPerT: 60000, epsilonPerT: 1e-12, source: "assumption (60 us / T, 12k qubits per chain)" } },
];

function modelFor(logicalQubits: number): IsingModel {
  return randomIsing(new Rng(SEED + logicalQubits), logicalQubits, { fieldRange: [0, 0] });
}

interface Row {
  readonly L: number;
  readonly p: number;
  readonly codeId: string;
  readonly d: number;
  readonly blocks: number;
  readonly totalQubits: number;
  readonly wallTime: string;
  readonly tGates: number;
  readonly factories: number;
  readonly factoryScenario: string;
  readonly epsilonTotal: number;
  readonly meetsBudget: boolean;
}

function rowOf(L: number, p: number, est: DeepQaoaEstimate, factoryId: string): Row {
  return {
    L,
    p,
    codeId: est.code.id,
    d: est.code.d,
    blocks: est.blocks,
    totalQubits: est.totalPhysicalQubits,
    wallTime: est.wallTimeHuman,
    tGates: est.tGatesTotal,
    factories: est.factoriesNeeded,
    factoryScenario: factoryId,
    epsilonTotal: est.epsilonTotal,
    meetsBudget: est.meetsBudget,
  };
}

export function main(): void {
  const sizes = [12, 54, 80, 100];
  const depths = [8, 100, 128, 256];
  const rows: Row[] = [];

  for (const L of sizes) {
    const model = modelFor(L);
    for (const p of depths) {
      const { surface, gross } = selectCodes(model, p);
      const chosen = surface.totalPhysicalQubits <= gross.totalPhysicalQubits || !gross.meetsBudget ? surface : gross;
      for (const scenario of T_FACTORY_SCENARIOS) {
        const assumptions: Partial<FtAssumptions> = { tFactory: scenario.factory };
        const est = estimateDeepQaoa({ model, code: chosen.code, qaoaDepth: p, assumptions });
        rows.push(rowOf(L, p, est, scenario.id));
      }
    }
  }

  // Physical-error sensitivity of the fixed-distance gross code (d=12).
  const model80 = modelFor(80);
  const sensitivity: Array<{ pPhys: number; epsilonTotal: number; meetsBudget: boolean }> = [];
  for (const pPhys of [1e-3, 3e-4, 1e-4]) {
    const est = estimateDeepQaoa({
      model: model80,
      code: grossCode(),
      qaoaDepth: 128,
      assumptions: { pPhys },
    });
    sensitivity.push({ pPhys, epsilonTotal: est.epsilonTotal, meetsBudget: est.meetsBudget });
  }

  // Assumption-constants audit: every estimator constant with provenance, gated.
  const auditResult = validateConstantsAudit(CONSTANTS_AUDIT);
  if (!auditResult.valid) {
    throw new FtQaoaError(
      "CONSTANTS_AUDIT_REJECTED",
      `exp2: constants audit rejected rows — ${auditResult.rejected.map((r) => `[${r.id}] ${r.reason}`).join("; ")}`,
    );
  }
  const auditLines = renderConstantsAudit(CONSTANTS_AUDIT, auditResult);

  const payload = {
    experiment: "exp2-resources",
    seed: SEED,
    defaults: DEFAULT_FT_ASSUMPTIONS,
    factoryScenarios: T_FACTORY_SCENARIOS,
    rows,
    grossSensitivityP128L80: sensitivity,
    constantsAudit: auditResult,
  };

  const lines: string[] = [
    "# Experiment 2 — Fault-tolerance resource estimates for deep QAOA",
    "",
    "Heuristic estimator; every constant lives in `FtAssumptions` and is swept here,",
    "nothing is hidden. Regenerate with `npm run exp:resources`.",
    "",
    "## Code selection (smallest-qubit feasible choice: surface d-search vs gross [[144,12,12]])",
    "",
    "| L | p | code | d | blocks | total phys qubits | wall time | T gates | factory scenario | factories | eps_total | budget |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.L} | ${r.p} | ${r.codeId} | ${r.d} | ${r.blocks} | ${fmtInt(r.totalQubits)} | ${r.wallTime} | ${fmtInt(r.tGates)} | ${r.factoryScenario} | ${r.factories} | ${fmt(r.epsilonTotal, 3)} | ${r.meetsBudget ? "OK" : "FAIL"} |`,
    ),
    "",
    "## Gross-code (fixed d=12) physical-error sensitivity, L=80, p=128",
    "",
    "| p_phys | eps_total | budget |",
    "|---|---|---|",
    ...sensitivity.map((s) => `| ${s.pPhys.toExponential(0)} | ${fmt(s.epsilonTotal, 3)} | ${s.meetsBudget ? "OK" : "FAIL"} |`),
    "",
    "## Assumption-constants audit (provenance gate)",
    "",
    ...auditLines,
  ];

  writeReport("exp2-resources", payload, lines.join("\n"));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
