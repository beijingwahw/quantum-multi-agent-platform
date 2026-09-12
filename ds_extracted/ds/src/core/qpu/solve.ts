/**
 * solve —— QPU 采样 → 调度分配的桥接层
 *
 * 真实量子硬件有噪声与读出误差：任何 QPU 采样结果在进入调度器之前
 * 必须过三道闸门：
 *   1. 合法性校验（one-hot / 容量 / 资格）——非法样本**直接丢弃**并计入
 *      invalidSamples（不做修复：修复产物不是测量结果）；
 *   2. 福利聚合排名——合法样本按福利（并列取出现次数）选出最优分配，
 *      后端上报的 energies 仅随样本记录、**不参与校验**（刻意的信任
 *      姿态：对后端数值的不信任由下一道闸门兜底）；
 *   3. 本地精确最优对照（子空间枚举在 ≤2²¹ 维时给出精确最优，
 *      QPU 解的 optimalityRatio 因此是可验证的观测量——采样值或解码
 *      的退化在这里暴露，而不是被静默接受）。
 */

import type { AssignmentProblem } from '../quantum-optimizer.js';
import { toIsing, isValidAssignment, welfareOf, bruteForceOptimum } from '../quantum-optimizer.js';
import { buildSubspaceModel } from '../subspace-optimizer.js';
import type { QuantumBackend, QpuSolveOptions } from './quantum-backend.js';
import { LocalQuantumBackend, DEFAULT_NUM_READS_LOCAL_EXACT } from './quantum-backend.js';
import { decideExecutionTier } from './execution-tier.js';
import type { ExecutionTierDecision } from './execution-tier.js';
import { BackendError, FtqcDeferredError } from '../../utils/errors.js';
import { WELFARE_COMPARISON_EPSILON } from '../../utils/numeric.js';
import { BRUTE_FORCE_QUBIT_LIMIT, SUBSPACE_DIMENSION_CAP } from '../constants.js';

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
  /** 提交前的执行层级判定（仅当传入 routing 时存在） */
  executionTier?: ExecutionTierDecision;
}

/**
 * 在指定后端上求解调度问题。真实硬件路径：Ising 编码 → QPU 采样 →
 * 解码校验 → 最优对照；本地路径：约束子空间精确演化。
 * 传入 options.routing 时先做执行层级判定：NISQ 直发 / FTQC 排队
 * （抛 FtqcDeferredError，不执行）/ 经典回退（转本地精确引擎）。
 */
export async function solveAssignmentOnBackend(
  problem: AssignmentProblem,
  backend: QuantumBackend,
  options: QpuSolveOptions = {},
): Promise<QpuAssignmentResult> {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nqubits = m * n;

  // ---- 执行层级路由（可选）：估算器决定 NISQ / FTQC 排队 / 经典回退 ----
  let decision: ExecutionTierDecision | undefined;
  let engine: QuantumBackend = backend;
  if (options.routing) {
    // 耦合数取自真实 Ising 编码（含罚项折叠），不是估算值
    const ising = toIsing(problem);
    decision = decideExecutionTier({
      logicalQubits: nqubits,
      couplings: ising.J.size,
      ...(options.routing.circuitDepth !== undefined
        ? { circuitDepth: options.routing.circuitDepth }
        : {}),
      ...(options.routing.nisq !== undefined ? { nisq: options.routing.nisq } : {}),
      ...(options.routing.ft !== undefined ? { ft: options.routing.ft } : {}),
    });
    if (decision.tier === 'ftqc-queue') {
      // 不执行：调用方捕获后进 FTQC 等待队列，decision.ftqc 是资源画像
      throw new FtqcDeferredError(
        `assignment problem (${m} tasks x ${n} agents = ${nqubits} qubits) routed to FTQC queue: ${decision.reason}`,
        decision,
      );
    }
    if (decision.tier === 'classical') {
      engine = new LocalQuantumBackend();
    }
  }

  // ---- 本地精确路径 ----
  if (engine instanceof LocalQuantumBackend) {
    // 显式钉住采样数并原样上报：否则后端默认值(128)与报告值(100)不一致。
    // Q8：缺省值引用 quantum-backend.ts 的命名常量（差异理由见其注释）
    const numReads = options.numReads ?? DEFAULT_NUM_READS_LOCAL_EXACT;
    const solution = await engine.solveProblem(problem, { ...options, numReads });
    const model = buildSubspaceModel(problem);
    return {
      backend: engine.name,
      realHardware: false,
      assignment: solution.assignment,
      welfare: solution.welfare,
      sampleFrequency: solution.probability,
      totalReads: numReads,
      invalidSamples: 0,
      // exactOptionalPropertyTypes：optimality 仅在可对照时存在。
      // Q10：optimalWelfare === 0（全零福利问题）此前被 `> 0` 守卫静默
      // 丢弃——现在纳入。ratio 由子空间引擎的 safeOptimalityRatio 给出
      // （optimal ≤ 0 退化为二值命中判定：精确引擎命中自身模型最优 → 1）
      ...(model && model.optimalWelfare >= 0
        ? {
            optimality: {
              achieved: solution.welfare,
              optimal: model.optimalWelfare,
              ratio: solution.optimalityRatio,
            },
          }
        : {}),
      solver: engine.name,
      ...(decision !== undefined ? { executionTier: decision } : {}),
    };
  }

  // ---- 真实硬件路径：Ising 编码 → 提交 → 采样 ----
  const ising = toIsing(problem);
  const samples = await engine.solveIsing(ising.h, ising.J, nqubits, options);

  let invalidSamples = 0;
  // 按分配聚合出现次数（同一分配的重复样本合并计数）。
  // 键为分配的字符串形式：QPU 路径不受 30 量子比特限制（一轮可吃满空闲池），
  // nqubits ≥ 33 时位掩码 `1 << q` 以 int32 回绕（qubit 32 混叠 qubit 0），
  // 因此不经中间整数态、直接由 spins 解码 one-hot。
  const stateStats = new Map<
    string,
    { assignment: number[]; welfare: number; energy: number; occurrences: number }
  >();
  const totalOccurrences = samples.occurrences.reduce((s, o) => s + o, 0) || 1;

  for (let s = 0; s < samples.spins.length; s++) {
    const spins = samples.spins[s]!;
    if (spins.length !== nqubits) {
      invalidSamples += samples.occurrences[s] ?? 1;
      continue;
    }
    // z_i ∈ {−1,+1} → x_i = 1 当且仅当 z_i = −1；逐任务 one-hot 解码
    const assignment = new Array<number>(m).fill(-1);
    for (let t = 0; t < m; t++) {
      let chosen = -1;
      for (let a = 0; a < n; a++) {
        if (spins[t * n + a] === -1) {
          if (chosen >= 0) {
            chosen = -1; // one-hot 违约
            break;
          }
          chosen = a;
        }
      }
      assignment[t] = chosen;
    }
    if (!isValidAssignment(problem, assignment)) {
      invalidSamples += samples.occurrences[s] ?? 1;
      continue;
    }
    const welfare = welfareOf(problem, assignment);
    // 后端能量是**信息性**字段（缺省时以 −福利 占位）：不参与闸门校验，
    // 退化由最优率对照兜底——见文件头「三道闸门」第 2 条的信任姿态说明
    const energy = samples.energies[s] ?? -welfare;
    const key = assignment.join(',');
    const existing = stateStats.get(key);
    if (existing) {
      existing.occurrences += samples.occurrences[s] ?? 1;
    } else {
      stateStats.set(key, {
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
      stats.welfare > best.welfare + WELFARE_COMPARISON_EPSILON ||
      (Math.abs(stats.welfare - best.welfare) <= WELFARE_COMPARISON_EPSILON &&
        stats.occurrences > best.occurrences)
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
    backend: engine.name,
    realHardware: samples.realHardware,
    assignment: best.assignment,
    welfare: best.welfare,
    sampleFrequency: best.occurrences / totalOccurrences,
    totalReads: totalOccurrences,
    invalidSamples,
    // Q10：optimal === 0（全零福利问题）此前被 `> 0` 守卫静默丢弃，
    // 最优对照整段缺失。现在纳入；ratio 语义见 optimalityRatioOf。
    ...(optimal !== undefined && optimal >= 0
      ? {
          optimality: {
            achieved: best.welfare,
            optimal,
            ratio: optimalityRatioOf(best.welfare, optimal),
          },
        }
      : {}),
    solver: samples.solver,
    ...(decision !== undefined ? { executionTier: decision } : {}),
  };
}

/**
 * Q10：optimal === 0 时的最优率语义：
 * - achieved ≤ 0 → ratio 1：采样命中零最优（全零福利问题的常态），
 *   与正常域 ratio=achieved/optimal 的极限一致，无病态；
 * - achieved > 0 → ratio = +Infinity：采样器「超过」零最优只可能意味着
 *   本地参照不完整/不一致（穷举或子空间枚举漏解）——诚实上报发散值，
 *   让对照闸门红出来，而不是伪造 1 掩盖参照缺陷。
 * 下游审计（2026-09）：optimality ratio 仅被单值快照存储与日志格式化
 * （quantum-scheduler.lastOptimalityRatio / reasoning 模板），不存在对
 * ratio 求均值的聚合点，Infinity 不会污染任何统计口径。
 */
function optimalityRatioOf(achieved: number, optimal: number): number {
  if (optimal > 0) return achieved / optimal;
  return achieved <= 0 ? 1 : Number.POSITIVE_INFINITY;
}
