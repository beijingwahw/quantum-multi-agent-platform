import { Rng } from "../core/rng.js";
import { randomIsing } from "../core/ising.js";
import { estimateDeepQaoa } from "../ft/estimate.js";
import { grossCode } from "../ft/codes.js";
import { analyzeDecoderSchedule, DECODER_SCENARIOS } from "../ft/decoder-scheduler.js";
import type { DecoderScenario, ScheduleResult } from "../ft/decoder-scheduler.js";
import { fmt, fmtInt, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

const SEED = 20260905;

function withFleet(id: string, base: DecoderScenario, units: number): DecoderScenario {
  return { ...base, id, units, note: `${base.note} (fleet ${units})` };
}

export function main(): void {
  // Same L=80, p=128 gross-code circuit as exp2: feed its syndrome load to the scheduler.
  const model = randomIsing(new Rng(SEED + 80), 80, { fieldRange: [0, 0] });
  const est = estimateDeepQaoa({ model, code: grossCode(), qaoaDepth: 128 });

  const scenarios: DecoderScenario[] = [
    ...DECODER_SCENARIOS,
    withFleet("fpga-256u", DECODER_SCENARIOS[2]!, 256),
    withFleet("fpga-512u", DECODER_SCENARIOS[2]!, 512),
  ];

  const results: ScheduleResult[] = scenarios.map((scenario) =>
    analyzeDecoderSchedule(
      est.syndromeRoundsTotal,
      1, // cycle time in us (matches estimate assumptions)
      est.blocks,
      scenario,
      new Rng(SEED + scenarios.indexOf(scenario)),
    ),
  );

  const payload = {
    experiment: "exp3-decoder-scheduling",
    seed: SEED,
    circuit: {
      code: est.code.id,
      logicalQubits: model.n,
      qaoaDepth: 128,
      blocks: est.blocks,
      syndromeRoundsTotal: est.syndromeRoundsTotal,
      syndromeBitsPerRound: est.syndromeBitsPerRound,
      syndromeDataRateMbps: est.syndromeDataRateMbps,
    },
    scenarios,
    results,
  };

  const lines: string[] = [
    "# Experiment 3 — Real-time decoder scheduling for the deep-QAOA syndrome stream",
    "",
    "Discrete-event simulation, seeded; steady-state utilization from service/arrival.",
    "Regenerate with `npm run exp:decoder`.",
    "",
    `Circuit: gross [[144,12,12]], L=${model.n}, p=128 -> ${fmtInt(est.syndromeRoundsTotal)} syndrome rounds,`,
    `${est.syndromeBitsPerRound} bits/round, sustained ${fmt(est.syndromeDataRateMbps, 1)} Mb/s across ${est.blocks} blocks.`,
    "",
    "| scenario | units/block | utilization | max backlog (rounds) | p95 backlog | verdict |",
    "|---|---|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.scenarioId} | ${r.unitsPerBlock} | ${fmt(r.utilization, 3)} | ${fmtInt(r.maxBacklogRounds)} | ${fmtInt(r.p95BacklogRounds)} | ${r.verdict} |`,
    ),
    "",
  ];

  writeReport("exp3-decoder", payload, lines.join("\n"));
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) main();
