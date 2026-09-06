import { Rng } from "../core/rng.js";
import { bruteForce, energies, maxcut3Reg, randomIsing, cutSize } from "../core/ising.js";
import type { IsingModel } from "../core/ising.js";
import { qaoaExpectation } from "../qaoa/engine.js";
import { coordinateDescent, depthLadder, optimizeRampT } from "../qaoa/optimize.js";
import { monotonicityReport, verifyEmbedding } from "../qaoa/monotonic.js";
import type { DepthPoint } from "../qaoa/monotonic.js";
import { fmt, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

interface InstanceSpec {
  readonly id: string;
  readonly model: IsingModel;
  readonly kind: "random-ising" | "maxcut-3reg";
}

const BASE_SEED = 20260905;
const P0 = 8;
const TARGETS = [8, 16, 32, 64, 96, 128];
const HERO_N = 14;

function buildInstances(): InstanceSpec[] {
  const specs: InstanceSpec[] = [];
  for (let i = 0; i < 5; i++) {
    specs.push({
      id: `random-n10-s${BASE_SEED + i}`,
      model: randomIsing(new Rng(BASE_SEED + i), 10),
      kind: "random-ising",
    });
  }
  specs.push({
    id: `maxcut-n12-s${BASE_SEED + 100}`,
    model: maxcut3Reg(new Rng(BASE_SEED + 100), 12),
    kind: "maxcut-3reg",
  });
  specs.push({
    id: `random-n${HERO_N}-s${BASE_SEED + 200}`,
    model: randomIsing(new Rng(BASE_SEED + 200), HERO_N),
    kind: "random-ising",
  });
  return specs;
}

interface LadderSummary {
  readonly instanceId: string;
  readonly kind: string;
  readonly n: number;
  readonly optimum: number;
  readonly maxcutOptimum: number | null;
  readonly points: DepthPoint[];
  readonly monotonic: boolean;
  readonly violationCount: number;
}

export function main(): void {
  const instances = buildInstances();

  // --- Part A: embedding identity (theorem mechanics, exact through the engine)
  const hero = instances[instances.length - 1]!;
  const heroEnergies = energies(hero.model);
  const embeddingChecks = [1, 7, 63, 127].map((p) =>
    verifyEmbedding(hero.model, heroEnergies, p, BASE_SEED + 900, 1e-10),
  );

  // --- Part B: optimizer-grade monotonicity at small p (full coordinate descent)
  const small = instances[0]!;
  const smallEnergies = energies(small.model);
  const optimumSmall = bruteForce(smallEnergies).optimum;
  const exactLadder: DepthPoint[] = [];
  let prev: null | { gammas: readonly number[]; betas: readonly number[] } = null;
  for (let p = 1; p <= 6; p++) {
    const ramp = optimizeRampT(small.model, smallEnergies, p);
    const start = prev ?? ramp.params;
    const polished = coordinateDescent(
      (params) => qaoaExpectation(small.model, smallEnergies, params),
      start,
      { passes: 3 },
    );
    const value = qaoaExpectation(small.model, smallEnergies, polished);
    exactLadder.push({ p, best: value, ratio: value / optimumSmall });
    // Warm-start the next depth with the zero-padded previous optimum.
    prev = { gammas: [...polished.gammas, 0], betas: [...polished.betas, 0] };
  }
  const exactReport = monotonicityReport(exactLadder, 0);

  // --- Part C: deep ladder to p=128 via ramp + INTERP transfer
  const ladders: LadderSummary[] = instances.map((inst) => {
    const E = energies(inst.model);
    const optimum = bruteForce(E).optimum;
    const ladder = depthLadder(inst.model, E, P0, TARGETS);
    const points: DepthPoint[] = ladder.map((pt) => ({ p: pt.p, best: pt.expectation, ratio: pt.expectation / optimum }));
    const report = monotonicityReport(points, 2e-3);
    return {
      instanceId: inst.id,
      kind: inst.kind,
      n: inst.model.n,
      optimum,
      maxcutOptimum: inst.kind === "maxcut-3reg" ? cutSize(inst.model, optimum) : null,
      points,
      monotonic: report.monotone,
      violationCount: report.violations.length,
    };
  });

  const payload = {
    experiment: "exp1-monotonicity",
    seedBase: BASE_SEED,
    ladderDepths: TARGETS,
    embeddingTolerance: 1e-10,
    embeddingChecks,
    exactLadder: {
      instance: small.id,
      optimum: optimumSmall,
      points: exactLadder,
      monotone: exactReport.monotone,
      violations: exactReport.violations,
    },
    ladders: ladders.map((l) => ({
      ...l,
      points: l.points.map((pt) => ({ p: pt.p, ratio: pt.ratio })),
    })),
  };

  const lines: string[] = [
    "# Experiment 1 — Depth monotonicity of deep QAOA",
    "",
    "Seeds fixed; regenerate with `npm run exp:monotonic`.",
    "",
    "## A. Embedding identity F_{p+1}(theta|0,0) = F_p(theta) (engine-level, should be ~1e-15)",
    "",
    "| p | gap | pass |",
    "|---|---|---|",
    ...embeddingChecks.map((c) => `| ${c.p + 1} | ${c.gap.toExponential(2)} | ${c.passed ? "YES" : "NO"} |`),
    "",
    `## B. Optimized value ladder, full coordinate descent (${small.id}, p=1..6)`,
    "",
    "| p | best <C> | ratio |",
    "|---|---|---|",
    ...exactLadder.map((pt) => `| ${pt.p} | ${fmt(pt.best)} | ${fmt(pt.ratio, 6)} |`),
    "",
    `monotone (found values): ${exactReport.monotone ? "YES" : "NO"}${exactReport.violations.length ? ` — violations: ${JSON.stringify(exactReport.violations)}` : ""}`,
    "",
    "## C. Deep ladder to p=128 (ramp + INTERP transfer + time re-tune)",
    "",
  ];
  for (const l of ladders) {
    lines.push(`### ${l.instanceId} (optimum ${fmt(l.optimum)}${l.maxcutOptimum !== null ? `, maxcut ${l.maxcutOptimum}` : ""})`);
    lines.push("");
    lines.push("| p | ratio r_p |");
    lines.push("|---|---|");
    lines.push(...l.points.map((pt) => `| ${pt.p} | ${fmt(pt.ratio, 6)} |`));
    lines.push("");
    lines.push(`monotone within 2e-3 tolerance: ${l.monotonic ? "YES" : `NO (${l.violationCount} violations)`}`);
    lines.push("");
  }
  const worst128 = Math.min(...ladders.map((l) => l.points[l.points.length - 1]!.ratio));
  lines.push(`**Worst-case r_128 across ${ladders.length} instances: ${fmt(worst128, 6)}**`);
  lines.push("");

  writeReport("exp1-monotonic", payload, lines.join("\n"));
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) main();
