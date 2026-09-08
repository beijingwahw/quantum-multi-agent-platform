import type { Rng } from "../core/rng.js";
import { requireThat } from "../core/errors.js";

/**
 * Real-time decoder scheduling: the syndrome stream of each code block arrives
 * at one round per cycle period; decoder units consume it in windows. This is
 * a work-conserving discrete-event simulation of that pipeline plus its
 * steady-state analysis — the "scheduling" half of fault-tolerant deep QAOA.
 */

export interface DecoderUnitSpec {
  /** Fixed per-window processing overhead (pipeline latency) in microseconds. */
  readonly latencyUs: number;
  /** Rounds per second one unit can decode (one block's full syndrome round). */
  readonly roundsPerSecond: number;
}

export interface DecoderScenario {
  readonly id: string;
  readonly unit: DecoderUnitSpec;
  /** Total decoder units in the fleet, spread across code blocks. */
  readonly units: number;
  /** Rounds per decoding window. */
  readonly windowRounds: number;
  readonly note: string;
}

export interface ScheduleResult {
  readonly scenarioId: string;
  readonly utilization: number;
  readonly maxBacklogRounds: number;
  readonly p95BacklogRounds: number;
  readonly maxEndToEndDelayUs: number;
  readonly verdict: "realtime" | "backlog-grows";
  readonly extrapolatedDrainUs: number | null;
  readonly simulatedWindows: number;
  readonly totalWindows: number;
  readonly unitsPerBlock: number;
  readonly servicePerWindowUs: number;
  readonly arrivalPerWindowUs: number;
}

export interface ScheduleSimOptions {
  readonly maxSimulatedWindows?: number;
  /** Utilization headroom required to call the pipeline real-time. */
  readonly realtimeUtilizationCeiling?: number;
}

/** Deterministic arrivals, seeded jittered service, work-conserving server pool. */
export function analyzeDecoderSchedule(
  totalRounds: number,
  cycleTimeUs: number,
  blocks: number,
  scenario: DecoderScenario,
  rng: Rng,
  options: ScheduleSimOptions = {},
): ScheduleResult {
  requireThat(
    Number.isInteger(totalRounds) && totalRounds >= 1,
    "TOTAL_ROUNDS_INVALID",
    `totalRounds must be an integer >= 1, got ${totalRounds}`,
  );
  requireThat(cycleTimeUs > 0, "CYCLE_TIME_INVALID", `cycle time must be > 0 us, got ${cycleTimeUs}`);
  requireThat(
    Number.isInteger(blocks) && blocks >= 1,
    "BLOCK_COUNT_INVALID",
    `code block count must be an integer >= 1, got ${blocks}`,
  );
  requireThat(
    Number.isInteger(scenario.units) && scenario.units >= 1,
    "FLEET_SIZE_INVALID",
    `decoder fleet size must be an integer >= 1, got ${scenario.units}`,
  );
  requireThat(
    Number.isInteger(scenario.windowRounds) && scenario.windowRounds >= 1,
    "WINDOW_ROUNDS_INVALID",
    `window size must be an integer >= 1 rounds, got ${scenario.windowRounds}`,
  );
  requireThat(
    scenario.unit.roundsPerSecond > 0 && scenario.unit.latencyUs >= 0,
    "DECODER_UNIT_SPEC_INVALID",
    `decoder unit needs roundsPerSecond > 0 and latencyUs >= 0, got ${scenario.unit.roundsPerSecond}/s and ${scenario.unit.latencyUs}us`,
  );
  const maxWindows = options.maxSimulatedWindows ?? 20000;
  const ceiling = options.realtimeUtilizationCeiling ?? 0.95;

  const unitsPerBlock = Math.max(1, Math.floor(scenario.units / blocks));
  const W = scenario.windowRounds;
  const arrivalPerWindowUs = W * cycleTimeUs;
  // One unit decodes one window: W rounds at unit throughput, plus fixed latency.
  const baseServiceUs = (W / scenario.unit.roundsPerSecond) * 1e6 + scenario.unit.latencyUs;
  const utilization = baseServiceUs / arrivalPerWindowUs / unitsPerBlock;

  const totalWindows = Math.ceil(totalRounds / W);
  const simWindows = Math.min(totalWindows, maxWindows);

  // Event simulation for a single representative block stream. `waiting` holds
  // arrival times of queued windows (FIFO); each idle unit starts the oldest.
  const servers = new Float64Array(unitsPerBlock); // completion time of each busy unit
  const waiting: number[] = [];
  let maxQueued = 0;
  const queueSamples: number[] = [];
  const delaysUs: number[] = [];

  for (let w = 0; w < simWindows; w++) {
    const arrivalUs = w * arrivalPerWindowUs;
    waiting.push(arrivalUs);
    let idleIdx = indexOfIdle(servers, arrivalUs);
    while (idleIdx !== -1 && waiting.length > 0) {
      const oldestArrivalUs = waiting.shift()!;
      const jitter = 1 + rng.range(-0.2, 0.2);
      const completion = arrivalUs + baseServiceUs * jitter;
      servers[idleIdx] = completion;
      delaysUs.push(completion - oldestArrivalUs);
      idleIdx = indexOfIdle(servers, arrivalUs);
    }
    if (waiting.length > maxQueued) maxQueued = waiting.length;
    if (w % Math.max(1, Math.floor(simWindows / 200)) === 0) queueSamples.push(waiting.length);
  }

  const sorted = [...queueSamples].sort((a, b) => a - b);
  const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)]! : 0;
  const maxDelay = delaysUs.length > 0 ? Math.max(...delaysUs) : 0;

  let drainUs: number | null = null;
  if (utilization <= 1) {
    // M/D/c-like steady state: backlog stays bounded; drain from observed peak.
    drainUs = maxQueued * W * cycleTimeUs + baseServiceUs;
  }

  return {
    scenarioId: scenario.id,
    utilization,
    maxBacklogRounds: maxQueued * W,
    p95BacklogRounds: p95 * W,
    maxEndToEndDelayUs: maxDelay,
    verdict: utilization <= ceiling ? "realtime" : "backlog-grows",
    extrapolatedDrainUs: drainUs,
    simulatedWindows: simWindows,
    totalWindows,
    unitsPerBlock,
    servicePerWindowUs: baseServiceUs,
    arrivalPerWindowUs,
  };
}

function indexOfIdle(servers: Float64Array, nowUs: number): number {
  for (let i = 0; i < servers.length; i++) {
    if (servers[i]! <= nowUs) return i;
  }
  return -1;
}

export interface WindowPolicyPoint {
  readonly windowRounds: number;
  readonly utilization: number;
  readonly verdict: "realtime" | "backlog-grows";
  /** Worst observed queue+service delay for one window (event simulation). */
  readonly maxEndToEndDelayUs: number;
  /** Full correction latency: the window must fill before decoding ends. */
  readonly correctionLatencyUs: number;
}

export interface WindowPolicySweep {
  readonly scenarioId: string;
  readonly points: readonly WindowPolicyPoint[];
  /** Smallest-correction-latency window that still passes the realtime ceiling. */
  readonly minLatencyRealtimeWindow: number | null;
}

/**
 * Window-size scheduling policy: how many syndrome rounds to batch per decode
 * window. Small windows stream corrections with low latency but pay the fixed
 * per-window decode latency on every batch; large windows amortize throughput
 * but delay every correction by the fill time. This sweep prices that tradeoff
 * as data and picks the minimum-latency feasible window per fleet.
 */
export function windowPolicySweep(
  totalRounds: number,
  cycleTimeUs: number,
  blocks: number,
  base: DecoderScenario,
  windows: readonly number[],
  rng: Rng,
  options: ScheduleSimOptions = {},
): WindowPolicySweep {
  const points: WindowPolicyPoint[] = windows.map((w) => {
    const r = analyzeDecoderSchedule(totalRounds, cycleTimeUs, blocks, { ...base, windowRounds: w }, rng, options);
    return {
      windowRounds: w,
      utilization: r.utilization,
      verdict: r.verdict,
      maxEndToEndDelayUs: r.maxEndToEndDelayUs,
      correctionLatencyUs: r.maxEndToEndDelayUs + w * cycleTimeUs,
    };
  });
  let best: number | null = null;
  let bestLatency = Number.POSITIVE_INFINITY;
  for (const pt of points) {
    if (pt.verdict === "realtime" && pt.correctionLatencyUs < bestLatency) {
      best = pt.windowRounds;
      bestLatency = pt.correctionLatencyUs;
    }
  }
  return { scenarioId: base.id, points, minLatencyRealtimeWindow: best };
}

export const DECODER_SCENARIOS: readonly DecoderScenario[] = [
  {
    id: "cpu-bposd-1u",
    unit: { latencyUs: 1000, roundsPerSecond: 1000 },
    units: 1,
    windowRounds: 8,
    note: "CPU BP+OSD, ~1 ms per round, single unit",
  },
  {
    id: "cpu-bposd-64u",
    unit: { latencyUs: 1000, roundsPerSecond: 1000 },
    units: 64,
    windowRounds: 8,
    note: "CPU BP+OSD fleet x64",
  },
  {
    id: "fpga-100us-32u",
    unit: { latencyUs: 100, roundsPerSecond: 20000 },
    units: 32,
    windowRounds: 8,
    note: "FPGA-class decoder, ~100 us/round, 32 units",
  },
  {
    id: "asic-10us-32u",
    unit: { latencyUs: 10, roundsPerSecond: 200000 },
    units: 32,
    windowRounds: 8,
    note: "ASIC-class decoder, ~10 us/round, 32 units",
  },
  {
    id: "asic-1us-16u",
    unit: { latencyUs: 1, roundsPerSecond: 2000000 },
    units: 16,
    windowRounds: 8,
    note: "aggressive ASIC, ~1 us/round, 16 units",
  },
];
