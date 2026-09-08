import type { IsingModel } from "../core/ising.js";
import { requireThat } from "../core/errors.js";
import {
  blocksFor,
  DEFAULT_LOGICAL_ERROR_MODEL,
  logicalErrorPerRound,
  surfaceCode,
  grossCode,
} from "./codes.js";
import type { CodeSpec, LogicalErrorModel } from "./codes.js";
import { DEFAULT_SYNTHESIS, qaoaLayerProfile } from "./synthesis.js";
import type { RotationSynthesisOptions } from "./synthesis.js";

export interface TFactoryAssumptions {
  /** Physical qubits per distillation chain (placeholder assumption). */
  readonly physicalQubits: number;
  /** Wall nanoseconds to produce one logical T state. */
  readonly nsPerT: number;
  /** Logical error per distilled T state. */
  readonly epsilonPerT: number;
  readonly source: string;
}

export interface FtAssumptions {
  /** Physical qubit error rate. */
  readonly pPhys: number;
  /** Syndrome extraction round period in microseconds. */
  readonly cycleTimeUs: number;
  /**
   * Syndrome rounds consumed per logical operation, as a multiple of code
   * distance (lattice-surgery / injection latency heuristic, default 1).
   */
  readonly roundsPerOpDistanceFactor: number;
  /** Acceptable total logical failure probability for the whole circuit. */
  readonly targetCircuitError: number;
  readonly logicalErrorModel: LogicalErrorModel;
  readonly synthesis: RotationSynthesisOptions;
  readonly tFactory: TFactoryAssumptions;
}

/**
 * Single-source discipline: the logical-error prefactor and the synthesis
 * defaults are declared exactly once (codes.ts / synthesis.ts) and consumed
 * here by reference — the constants audit binds these same objects through
 * LIVE_CONSTANT_VALUES, so a second literal copy would be a drift site the
 * gate only catches post-hoc.
 */
export const DEFAULT_FT_ASSUMPTIONS: FtAssumptions = {
  pPhys: 1e-3,
  cycleTimeUs: 1,
  roundsPerOpDistanceFactor: 1,
  targetCircuitError: 1e-2,
  logicalErrorModel: DEFAULT_LOGICAL_ERROR_MODEL,
  synthesis: DEFAULT_SYNTHESIS,
  tFactory: {
    physicalQubits: 5000,
    nsPerT: 100,
    epsilonPerT: 1e-12,
    source:
      "assumption (scenario-swept in exp2): two-level distillation, Gidney-Ekera 2019 class; a single-level 1e-8 floor fails deep-circuit budgets outright",
  },
};

export interface DeepQaoaEstimateInput {
  readonly model: IsingModel;
  readonly code: CodeSpec;
  readonly qaoaDepth: number;
  readonly assumptions?: Partial<FtAssumptions>;
}

export interface DeepQaoaEstimate {
  readonly code: CodeSpec;
  readonly blocks: number;
  readonly dataQubits: number;
  readonly ancillaQubits: number;
  readonly factoryQubits: number;
  readonly totalPhysicalQubits: number;
  readonly rotationsPerLayer: number;
  readonly logicalOpsTotal: number;
  readonly syndromeRoundsPerOp: number;
  readonly syndromeRoundsTotal: number;
  readonly wallTimeUs: number;
  readonly wallTimeHuman: string;
  readonly tGatesTotal: number;
  readonly tRatePerSec: number;
  readonly factoriesNeeded: number;
  readonly epsilonChannelPerOp: number;
  readonly epsilonChannelTotal: number;
  readonly epsilonDistillationTotal: number;
  readonly epsilonTotal: number;
  readonly meetsBudget: boolean;
  readonly syndromeBitsPerRound: number;
  readonly syndromeDataRateMbps: number;
}

function humanTime(us: number): string {
  if (us < 1e3) return `${us.toFixed(1)} us`;
  if (us < 1e6) return `${(us / 1e3).toFixed(2)} ms`;
  if (us < 1e9) return `${(us / 1e6).toFixed(2)} s`;
  if (us < 1e12) return `${(us / 1e9).toFixed(2)} min`;
  return `${(us / 3.6e9).toFixed(2)} h`;
}

/**
 * Resource estimate for executing a deep QAOA circuit fault-tolerantly.
 *
 * Model (all constants visible in FtAssumptions, none hidden):
 *  - one QAOA layer costs (m + 2n) arbitrary rotations = logical ops;
 *  - each logical op consumes `factor * d` syndrome rounds;
 *  - channel error accrues per syndrome round, distillation error per T state;
 *  - wall time is serial logical execution at the cycle period.
 */
export function estimateDeepQaoa(input: DeepQaoaEstimateInput): DeepQaoaEstimate {
  requireThat(
    Number.isInteger(input.qaoaDepth) && input.qaoaDepth >= 1,
    "QAOA_DEPTH_INVALID",
    `qaoaDepth must be an integer >= 1 (0 depth makes the T-rate infinite and factories NaN), got ${input.qaoaDepth}`,
  );
  const a: FtAssumptions = { ...DEFAULT_FT_ASSUMPTIONS, ...input.assumptions };
  const { model, code, qaoaDepth: p } = input;

  const blocks = blocksFor(model.n, code);
  const layer = qaoaLayerProfile(model, a.synthesis);
  const rotationsPerLayer = layer.twoQubitRotations + layer.singleQubitRotations;
  const logicalOpsTotal = p * rotationsPerLayer;
  const syndromeRoundsPerOp = Math.max(1, Math.round(a.roundsPerOpDistanceFactor * code.d));
  const syndromeRoundsTotal = logicalOpsTotal * syndromeRoundsPerOp;

  const epsRound = logicalErrorPerRound(code, a.pPhys, a.logicalErrorModel);
  const epsilonChannelPerOp = epsRound * syndromeRoundsPerOp;
  const epsilonChannelTotal = logicalOpsTotal * epsilonChannelPerOp;
  const tGatesTotal = p * layer.tCount;
  const epsilonDistillationTotal = tGatesTotal * a.tFactory.epsilonPerT;
  const epsilonTotal = epsilonChannelTotal + epsilonDistillationTotal;

  const wallTimeUs = syndromeRoundsTotal * a.cycleTimeUs;
  const wallSeconds = wallTimeUs / 1e6;
  const tRatePerSec = wallSeconds > 0 ? tGatesTotal / wallSeconds : Number.POSITIVE_INFINITY;
  const factoryRatePerSec = 1e9 / a.tFactory.nsPerT;
  const factoriesNeeded = Math.max(1, Math.ceil(tRatePerSec / factoryRatePerSec));
  const factoryQubits = factoriesNeeded * a.tFactory.physicalQubits;

  const dataQubits = blocks * code.n;
  const ancillaQubits = blocks * code.ancilla;
  const syndromeBitsPerRound = blocks * code.checks;

  return {
    code,
    blocks,
    dataQubits,
    ancillaQubits,
    factoryQubits,
    totalPhysicalQubits: dataQubits + ancillaQubits + factoryQubits,
    rotationsPerLayer,
    logicalOpsTotal,
    syndromeRoundsPerOp,
    syndromeRoundsTotal,
    wallTimeUs,
    wallTimeHuman: humanTime(wallTimeUs),
    tGatesTotal,
    tRatePerSec,
    factoriesNeeded,
    epsilonChannelPerOp,
    epsilonChannelTotal,
    epsilonDistillationTotal,
    epsilonTotal,
    meetsBudget: epsilonTotal <= a.targetCircuitError,
    syndromeBitsPerRound,
    syndromeDataRateMbps: (syndromeBitsPerRound / a.cycleTimeUs) / 1e0, // bits/us == Mb/s
  };
}

/**
 * Pick the rotated-surface-code distance (odd, 3..31) with the smallest
 * qubit footprint that still meets the circuit error budget, and compare
 * against the fixed gross code.
 */
export function selectCodes(
  model: IsingModel,
  qaoaDepth: number,
  assumptions?: Partial<FtAssumptions>,
): { surface: DeepQaoaEstimate; gross: DeepQaoaEstimate; surfaceDistancesTried: number[] } {
  const candidates: DeepQaoaEstimate[] = [];
  const distances: number[] = [];
  for (let d = 3; d <= 31; d += 2) {
    distances.push(d);
    candidates.push(
      estimateDeepQaoa({
        model,
        code: surfaceCode(d),
        qaoaDepth,
        ...(assumptions === undefined ? {} : { assumptions }),
      }),
    );
  }
  const feasible = candidates.filter((c) => c.meetsBudget);
  const surface = (feasible.length > 0 ? feasible : candidates).reduce((best, c) =>
    c.totalPhysicalQubits < best.totalPhysicalQubits ? c : best,
  );
  const gross = estimateDeepQaoa({
    model,
    code: grossCode(),
    qaoaDepth,
    ...(assumptions === undefined ? {} : { assumptions }),
  });
  return { surface, gross, surfaceDistancesTried: distances };
}
