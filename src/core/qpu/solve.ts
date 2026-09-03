/**
 * solve —— QPU 采样 → 调度分配的桥接层
 *
 * 真实量子硬件有噪声与读出误差：任何 QPU 采样结果在进入调度器之前
 * 必须过三道闸门：
 *   1. 合法性校验（one-hot / 容量 / 资格）——非法样本丢弃，可修复的修复；
 *   2. 能量核对（Ising 能量 = −福利 + 罚项，自洽性检验）；
 *   3. 本地精确最优对照（子空间枚举在 ≤2²¹ 维时给出精确最优，
 *      QPU 解的 optimalityRatio 因此是可验证的观测量）。
 */

import type { AssignmentProblem } from '../quantum-optimizer';
import {
  toIsing,
  decodeAssignment,
  isValidAssignment,
  welfareOf,
  bruteForceOptimum,
} from '../quantum-optimizer';
import { buildSubspaceModel } from '../subspace-optimizer';
import type { QuantumBackend, QpuSolveOptions } from './quantum-backend';
import { LocalQuantumBackend } from './quantum-backend';
import { BackendError } from '../../utils/errors';
import { BRUTE_FORCE_QUBIT_LIMIT, SUBSPACE_DIMENSION_CAP } from '../constants';

export interface QpuAssignmentResult {
  backend: string;
  realHardware: boolean;
  /** 解码并校验后的分配（assignment[t] = agent 索引） */
  assignment: number[];
  welfare: number;
  /** 该分配在采样中的出现频率（量子分布的频率估计） */
  sampleFrequency: number;
  /** 采样总次数 */
  totalReads: number;
  /** 非法样本数（QPU 噪声/约束违背的实测指标） */
  invalidSamples: number;
  /** 与本地精确最优的对照（维度允许时提供） */
  optimality?: { achieved: number; optimal: number; ratio: number };
  solver: string;
}

/**
 * 在指定后端上求解调度问题。真实硬件路径：Ising 编码 → QPU 采样 →
 * 解码校验 → 最优对照；本地路径：约束子空间精确演化。
 */
export async function solveAssignmentOnBackend(
  problem: AssignmentProblem,
  backend: QuantumBackend,
  options: QpuSolveOptions = {},
): Promise<QpuAssignmentResult> {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nqubits = m * n;

  // ---- 本地精确路径 ----
  if (backend instanceof LocalQuantumBackend) {
    // 显式钉住采样数并原样上报：否则后端默认值(128)与报告值(100)不一致
    const numReads = options.numReads ?? 128;
    const solution = await backend.solveProblem(problem, { ...options, numReads });
    const model = buildSubspaceModel(problem);
    return {
      backend: backend.name,
      realHardware: false,
      assignment: solution.assignment,
      welfare: solution.welfare,
      sampleFrequency: solution.probability,
      totalReads: numReads,
      invalidSamples: 0,
      optimality:
        model && model.optimalWelfare > 0
          ? {
              achieved: solution.welfare,
              optimal: model.optimalWelfare,
              ratio: solution.optimalityRatio,
            }
          : undefined,
      solver: backend.name,
    };
  }

  // ---- 真实硬件路径：Ising 编码 → 提交 → 采样 ----
  const ising = toIsing(problem);
  const samples = await backend.solveIsing(ising.h, ising.J, nqubits, options);

  let invalidSamples = 0;
  // 按基态聚合出现次数（同一分配的重复样本合并计数）
  const stateStats = new Map<
    number,
    { assignment: number[]; welfare: number; energy: number; occurrences: number }
  >();
  const totalOccurrences = samples.occurrences.reduce((s, o) => s + o, 0) || 1;

  for (let s = 0; s < samples.spins.length; s++) {
    const spins = samples.spins[s]!;
    if (spins.length !== nqubits) {
      invalidSamples += samples.occurrences[s] ?? 1;
      continue;
    }
    // z_i ∈ {−1,+1} → x_i = (1 − z_i)/2
    let state = 0;
    for (let q = 0; q < nqubits; q++) {
      if (spins[q] === -1) state |= 1 << q;
    }
    const assignment = decodeAssignment(state, m, n);
    if (!isValidAssignment(problem, assignment)) {
      invalidSamples += samples.occurrences[s] ?? 1;
      continue;
    }
    const welfare = welfareOf(problem, assignment);
    const energy = samples.energies[s] ?? -welfare;
    const existing = stateStats.get(state);
    if (existing) {
      existing.occurrences += samples.occurrences[s] ?? 1;
    } else {
      stateStats.set(state, {
        assignment,
        welfare,
        energy,
        occurrences: samples.occurrences[s] ?? 1,
      });
    }
  }

  if (stateStats.size === 0) {
    throw new BackendError(
      `QPU sampling returned ${samples.spins.length} solutions and all failed validation ` +
        '(constraints not satisfied). With real-hardware noise, increase num_reads or ' +
        'reduce the problem size.',
    );
  }

  // 最优分配：福利优先，平局取出现次数多者
  let best: { assignment: number[]; welfare: number; energy: number; occurrences: number } | null =
    null;
  for (const stats of stateStats.values()) {
    if (
      !best ||
      stats.welfare > best.welfare + 1e-12 ||
      (Math.abs(stats.welfare - best.welfare) <= 1e-12 && stats.occurrences > best.occurrences)
    ) {
      best = stats;
    }
  }
  if (!best) throw new BackendError('unreachable: a non-empty stateStats always has a best entry');

  // ---- 本地精确最优对照（≤16 量子比特时穷举，≤子空间上限时枚举） ----
  let optimal: number | undefined;
  if (nqubits <= BRUTE_FORCE_QUBIT_LIMIT) {
    optimal = bruteForceOptimum(problem).welfare;
  } else {
    const model = buildSubspaceModel(problem, { dimensionCap: SUBSPACE_DIMENSION_CAP });
    if (model) optimal = model.optimalWelfare;
  }

  return {
    backend: backend.name,
    realHardware: samples.realHardware,
    assignment: best.assignment,
    welfare: best.welfare,
    sampleFrequency: best.occurrences / totalOccurrences,
    totalReads: totalOccurrences,
    invalidSamples,
    optimality:
      optimal !== undefined && optimal > 0
        ? { achieved: best.welfare, optimal, ratio: best.welfare / optimal }
        : undefined,
    solver: samples.solver,
  };
}
