import { Rng } from "../core/rng.js";
import { FtQaoaError } from "../core/errors.js";
import { bruteForce, energies, maxcut3Reg, randomIsing } from "../core/ising.js";
import type { IsingModel } from "../core/ising.js";
import { qaoaExpectation } from "../qaoa/engine.js";
import { depthLadder } from "../qaoa/optimize.js";
import type { DepthLadderPoint } from "../qaoa/optimize.js";
import { monotonicityReport } from "../qaoa/monotonic.js";
import type { DepthPoint } from "../qaoa/monotonic.js";
import { noiseBendReport, noisyExpectation, verifyNoiseClaim } from "../qaoa/noise.js";
import type { NoiseSpec } from "../qaoa/noise.js";
import { fmt, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

/**
 * Experiment 4 — bounded-noise face of the depth-monotonicity track.
 *
 * The v0.1 boundary said "logical layer is noiseless". This experiment prices
 * that boundary honestly: the SAME noiseless-optimal schedules (ramp + INTERP,
 * exactly the exp1 methodology) are evaluated on the exact density matrix with
 * a per-layer depolarizing channel on every qubit and a terminal readout
 * bit-flip channel — both applied exactly, no Monte Carlo, at bounded depth
 * (p <= 32) and small sizes (density matrices are 2^n x 2^n; n <= 10 keeps a
 * full grid inside the memory/time budget).
 *
 * Evaluation pricing, not noisy re-training: each depth's angles are the
 * noiseless optimum, so the measured series lower-bounds what noise-aware
 * training would achieve. The noise grid is calibrated against real
 * logical-layer error scales (Willow d=7: 1.43e-3 per cycle — see the
 * constants audit row d7-logical-error-per-cycle).
 */

const SEED = 20260905; // same base seed as exp1: instance family continuity
const P0 = 2;
const DEPTHS = [4, 8, 12, 16, 24, 32]; // ladder targets; with base p0=2 the full grid is {2,4,8,12,16,24,32}
const EPS_GRID = [0, 1e-4, 1e-3, 3e-3, 1e-2]; // per-layer per-qubit depolarizing
const READOUT_GRID = [0.01, 0.05]; // terminal symmetric readout flip, at eps=0
const TOL_ABS = 2e-3; // same optimizer-noise tolerance as the noiseless track
const NOISE_SPEC_ZERO: NoiseSpec = { depolarizingPerLayer: 0, readoutFlip: 0 };

interface InstanceSpec {
  readonly id: string;
  readonly model: IsingModel;
  readonly kind: "random-ising" | "maxcut-3reg";
}

interface NoisySeries {
  readonly label: string;
  readonly points: DepthPoint[];
  readonly monotone: boolean;
  readonly bend: ReturnType<typeof noiseBendReport>;
  readonly claimAccepted: boolean;
  readonly claimReasons: readonly string[];
}

function seriesFor(
  instanceId: string,
  model: IsingModel,
  energyOf: Float64Array,
  optimum: number,
  ladder: readonly DepthLadderPoint[],
  noise: NoiseSpec,
  label: string,
): NoisySeries {
  const points: DepthPoint[] = ladder.map((pt) => {
    const best = noisyExpectation(model, energyOf, pt.params, noise);
    return { p: pt.p, best, ratio: best / optimum };
  });
  const monotone = monotonicityReport(points, TOL_ABS).monotone;
  // Anti-smuggling gate: the report only carries series the claim verifier
  // accepts against the very data being printed.
  const verdict = verifyNoiseClaim(
    { instanceId, noise, claimedMonotone: monotone, claimedSeries: points },
    points,
    TOL_ABS,
    1e-12,
  );
  return {
    label,
    points,
    monotone,
    bend: noiseBendReport(points, TOL_ABS, noise.depolarizingPerLayer),
    claimAccepted: verdict.accepted,
    claimReasons: verdict.reasons,
  };
}

function buildInstances(): InstanceSpec[] {
  return [
    { id: `random-n10-s${SEED}`, model: randomIsing(new Rng(SEED), 10), kind: "random-ising" },
    { id: `maxcut-n10-s${SEED + 100}`, model: maxcut3Reg(new Rng(SEED + 100), 10), kind: "maxcut-3reg" },
    { id: `random-n8-s${SEED + 200}`, model: randomIsing(new Rng(SEED + 200), 8), kind: "random-ising" },
  ];
}

interface InstanceReport {
  readonly instanceId: string;
  readonly kind: string;
  readonly n: number;
  readonly optimum: number;
  readonly depthGrid: number[];
  readonly series: NoisySeries[];
  readonly engineParityMaxGap: number;
}

function runInstance(inst: InstanceSpec): InstanceReport {
  const E = energies(inst.model);
  const optimum = bruteForce(E).optimum;
  const ladder = depthLadder(inst.model, E, P0, DEPTHS);

  const series: NoisySeries[] = [];
  for (const eps of EPS_GRID) {
    series.push(seriesFor(inst.id, inst.model, E, optimum, ladder, { depolarizingPerLayer: eps, readoutFlip: 0 }, `eps=${eps.toExponential(0)}`));
  }
  for (const q of READOUT_GRID) {
    series.push(seriesFor(inst.id, inst.model, E, optimum, ladder, { depolarizingPerLayer: 0, readoutFlip: q }, `readout q=${q}`));
  }

  // Engine parity: the eps=0 density series must reproduce the statevector engine.
  let parity = 0;
  for (const pt of ladder) {
    parity = Math.max(parity, Math.abs(noisyExpectation(inst.model, E, pt.params, NOISE_SPEC_ZERO) - qaoaExpectation(inst.model, E, pt.params)));
  }
  return { instanceId: inst.id, kind: inst.kind, n: inst.model.n, optimum, depthGrid: ladder.map((pt) => pt.p), series, engineParityMaxGap: parity };
}

export function main(): void {
  const reports = buildInstances().map(runInstance);
  const offender = reports.flatMap((r) => r.series).find((s) => !s.claimAccepted);
  if (offender !== undefined) {
    throw new FtQaoaError(
      "NOISE_CLAIM_REJECTED",
      `exp4: honest claim rejected by the gate — ${offender.claimReasons.join("; ")}`,
    );
  }

  const payload = {
    experiment: "exp4-bounded-noise",
    seed: SEED,
    depthGrid: [P0, ...DEPTHS],
    epsGrid: EPS_GRID,
    readoutGrid: READOUT_GRID,
    toleranceAbs: TOL_ABS,
    pricing: "noiseless-optimal schedules evaluated under noise (lower bound on noise-aware training)",
    instances: reports.map((r) => ({
      instanceId: r.instanceId,
      kind: r.kind,
      n: r.n,
      optimum: r.optimum,
      engineParityMaxGap: r.engineParityMaxGap,
      series: r.series.map((s) => ({
        label: s.label,
        points: s.points.map((pt) => ({ p: pt.p, best: pt.best, ratio: pt.ratio })),
        monotone: s.monotone,
        bend: s.bend,
      })),
    })),
  };

  const lines: string[] = [
    "# Experiment 4 — Bounded-noise face: does depth monotonicity survive noise?",
    "",
    "Exact density-matrix evaluation (no sampling) of noiseless-optimal ramp+INTERP schedules,",
    "per-layer per-qubit depolarizing + terminal readout flips, bounded depth p <= 32.",
    "Evaluation pricing, not noisy re-training. Regenerate with `npm run exp:noise`.",
    "",
  ];

  for (const r of reports) {
    lines.push(`## ${r.instanceId} (optimum ${fmt(r.optimum)})`);
    lines.push("");
    lines.push(`Engine parity (density vs statevector at eps=0): max gap ${r.engineParityMaxGap.toExponential(1)}`);
    lines.push("");
    lines.push("### Depolarizing grid");
    lines.push("");
    lines.push(`| p | ${EPS_GRID.map((e) => `r(eps=${e.toExponential(0)})`).join(" | ")} |`);
    lines.push(`|---|${EPS_GRID.map(() => "---").join("|")}|`);
    const depolSeries = r.series.filter((s) => s.label.startsWith("eps="));
    for (const p of r.depthGrid) {
      const cells = depolSeries.map((s) => s.points.find((pt) => pt.p === p)!.ratio);
      lines.push(`| ${p} | ${cells.map((c) => fmt(c, 6)).join(" | ")} |`);
    }
    lines.push("");
    lines.push("### Readout-only grid (eps=0)");
    lines.push("");
    lines.push(`| p | r(q=0) | ${READOUT_GRID.map((q) => `r(q=${q})`).join(" | ")} |`);
    lines.push(`|---|---|${READOUT_GRID.map(() => "---").join("|")}|`);
    const readoutSeries = [depolSeries[0]!, ...r.series.filter((s) => s.label.startsWith("readout"))];
    for (const p of r.depthGrid) {
      const cells = readoutSeries.map((s) => s.points.find((pt) => pt.p === p)!.ratio);
      lines.push(`| ${p} | ${cells.map((c) => fmt(c, 6)).join(" | ")} |`);
    }
    lines.push("");
    lines.push("### Bend summary");
    lines.push("");
    lines.push("| noise | monotone (tol 2e-3) | first drop at | p* | r* | eps*p* |");
    lines.push("|---|---|---|---|---|---|");
    for (const s of r.series) {
      lines.push(
        `| ${s.label} | ${s.monotone ? "YES" : "NO"} | ${s.bend.firstDropAt ?? "—"} | ${s.bend.pStar} | ${fmt(s.bend.rStar, 6)} | ${fmt(s.bend.epsilonTimesPStar, 3)} |`,
      );
    }
    lines.push("");
  }

  writeReport("exp4-noise", payload, lines.join("\n"));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
