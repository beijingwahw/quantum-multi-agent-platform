/**
 * engine-orchestrator —— 量子引擎编排器（01#24 拆分）。
 *
 * QuantumScheduler 此前是 ~2000 行的 god class，本模块把其中的量子引擎
 * 路径整块迁出：单任务真量子决策（QAOA/绝热退火）与三种批量联合演化
 * 载体（约束子空间精确 / 全空间态矢量分块 / QPU 后端）及各自的异步
 * 孪生、哈密顿量构建、坍缩解套用与量子引擎统计。迁移是纯委托——方法体
 * 逐字保留（调度器侧的亲和度/候选匹配/决策应用经 ctx 回调），事件名、
 * 错误消息、日志行、种子化随机数抽取序不变；可观测行为除两处**同波次
 * 修复**外不变：01#4 scheduleBatchQuantumQpu 在 await 后按实时并发余量
 * 封顶套用（不再 maxAssign: Infinity 超订），Q6 getBackend 改经 qpu 桶
 * 导入（默认后端注册面的变化，见导入处注释）。
 */

import type { Agent, Task, SchedulingDecision, TaskPriority } from '../types/quantum-types.js';
import { logInfo, logWarn } from '../utils/logger.js';
import {
  BRUTE_FORCE_QUBIT_LIMIT,
  FULLSPACE_QUBIT_LIMIT,
  SCHEDULER_QUBIT_CAP,
  SCHEDULER_SUBSPACE_CAP,
  SUBSPACE_QAOA_DIMENSION_LIMIT,
} from './constants.js';
import type { AssignmentProblem, QuantumSolverOptions } from './quantum-optimizer.js';
import {
  qaoaSolve,
  annealSolve,
  bruteForceOptimum,
  defaultPenalties,
  couplingKey,
  isValidAssignment,
} from './quantum-optimizer.js';
import {
  buildSubspaceModel,
  qaoaSolveSubspace,
  annealSolveSubspace,
  annealSolveSubspaceAsync,
} from './subspace-optimizer.js';
import type { SubspaceModel, SubspaceSolution } from './subspace-optimizer.js';
import type { QuantumBackend } from './qpu/quantum-backend.js';
// Q6：getBackend 经 qpu 桶导入——桶是默认后端的唯一注册点（见
// qpu/index.ts）；直接从 quantum-backend.js 取值导入不再隐式注册。
import { getBackend } from './qpu/index.js';
import type { ExecutionTierRouting } from './qpu/execution-tier.js';
import { solveAssignmentOnBackend } from './qpu/solve.js';
// 01#24：仅类型依赖调度器模块（配置切片/批量报告/算法口径）——无运行时环依赖
import type {
  QuantumAlgorithm,
  QuantumBatchReport,
  QuantumSchedulerConfig,
} from './quantum-scheduler.js';

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** 决策附带的次优候选数（01#24：单任务决策留在调度器侧，共用此口径） */
export const ALTERNATIVES_COUNT = 2;

/**
 * 01#24：引擎编排器所需的调度器上下文（窄接口，构造注入）。引擎不拥有
 * 注册表/亲和度/任务索引——空闲池快照、能力匹配、亲和度入哈密顿量与
 * 调度决策应用（历史/事件）都经此回调，行为与拆分前的调度器内联调用
 * 逐位一致。
 */
export interface QuantumEngineContext {
  readonly config: QuantumSchedulerConfig;
  /** 空闲池快照的 agent 全集来源 */
  getAgents(): Agent[];
  /** 显式任务 ID 批量的任务查找 */
  getTask(taskId: string): Task | undefined;
  /** 当前占用中的agent数（assigned/running），并发上限背压的读数 */
  activeAssignments(): number;
  /** 前置依赖是否全部完成 */
  dependenciesMet(task: Task): boolean;
  /** 按优先级桶顺序收集依赖已满足的全部挂起任务 */
  collectPendingCandidates(): Task[];
  /** 能力匹配（候选过滤与哈密顿量不合格位共用） */
  checkCapabilityMatch(agent: Agent, task: Task): boolean;
  /** agent-任务亲和度（经典评分四要素的加权和，进入哈密顿量） */
  agentAffinity(agent: Agent, task: Task): number;
  /** 应用一次已生成的调度决策（占用agent、入历史、广播事件） */
  applyAssignmentDecision(task: Task, decision: SchedulingDecision): SchedulingDecision;
}

/** 量子引擎编排器：批量联合量子调度（subspace/fullspace/qpu）与单任务真量子决策 */
export class QuantumEngineOrchestrator {
  // 量子引擎统计：真实量子路径的运行计数与Born概率累积
  private quantumSingleDecisions = 0;
  private quantumBatchRuns = 0;
  private quantumBatchAssigned = 0;
  private quantumProbabilitySum = 0;
  private lastOptimalityRatio: number | null = null;

  // 04 P2-11（erasableSyntaxOnly）：参数属性改为显式字段 + 构造器赋值
  private readonly ctx: QuantumEngineContext;

  constructor(ctx: QuantumEngineContext) {
    this.ctx = ctx;
  }

  private buildSolverOptions(): QuantumSolverOptions {
    const q = this.ctx.config.scheduling?.quantum ?? {};
    // exactOptionalPropertyTypes：未配置的旋钮以属性缺省表达，
    // 由求解器缺省解析填充（显式 undefined 不得进入可选属性）
    return {
      ...(q.layers !== undefined ? { layers: q.layers } : {}),
      ...(q.shots !== undefined ? { shots: q.shots } : {}),
      ...(q.select !== undefined ? { select: q.select } : {}),
      ...(q.seed !== undefined ? { seed: q.seed } : {}),
      ...(q.cvarAlpha !== undefined ? { cvarAlpha: q.cvarAlpha } : {}),
      ...(q.angleMode !== undefined ? { angleMode: q.angleMode } : {}),
      ...(q.anneal !== undefined ? { anneal: q.anneal } : {}),
    };
  }

  // ============ 真正的量子调度路径（单任务） ============

  makeTrueQuantumDecision(
    task: Task,
    agents: Agent[],
    algorithm: 'quantum-qaoa' | 'quantum-annealing',
  ): SchedulingDecision {
    // 单候选：平凡坍缩，无需演化
    if (agents.length === 1) {
      this.quantumSingleDecisions++;
      return {
        taskId: task.id,
        agentId: agents[0]!.id,
        probability: 1,
        confidence: 1,
        reasoning: 'trivial collapse: single candidate',
        alternatives: [],
      };
    }

    const priorityWeight = PRIORITY_WEIGHT[task.priority] / 4; // 0.25..1
    const problem: AssignmentProblem = {
      taskIds: [task.id],
      agentIds: agents.map((a) => a.id),
      weights: [agents.map((a) => priorityWeight * this.ctx.agentAffinity(a, task))],
      ineligible: [agents.map(() => false)],
      couplings: new Map(),
      penaltyOneHot: 0,
      penaltyCapacity: 0,
    };
    const penalties = defaultPenalties(problem);
    problem.penaltyOneHot = penalties.oneHot;
    problem.penaltyCapacity = penalties.capacity;

    const solution =
      algorithm === 'quantum-qaoa'
        ? qaoaSolve(problem, this.buildSolverOptions())
        : annealSolve(problem, this.buildSolverOptions());

    const agentIndex = solution.assignment[0] ?? -1;
    const degraded = agentIndex < 0 || !isValidAssignment(problem, solution.assignment);
    const chosen = agentIndex >= 0 ? agents[agentIndex]! : agents[0]!;
    this.quantumSingleDecisions++;
    // 退化回退（agents[0] 兜底）不得上报 Born 概率/置信度（01#8）：
    // 上报指标必须与实际决策同源——回退不是测量结果，把它计入
    // quantumProbabilitySum 会毒化概率口径
    if (!degraded) {
      this.quantumProbabilitySum += solution.probability;
    }

    return {
      taskId: task.id,
      agentId: chosen.id,
      probability: degraded ? 0 : solution.probability,
      confidence: degraded ? 0 : solution.validMass,
      reasoning: degraded
        ? `${solution.engine}: degenerate solve fell back to first candidate ` +
          `(reported metrics zeroed — decision is not a measurement)`
        : `${solution.engine}: superposition over ${agents.length} agents, ` +
          `evolution (${solution.layers} ${solution.engine === 'qaoa' ? 'layers' : 'steps'}), ` +
          `Born collapse p=${solution.probability.toFixed(3)}`,
      alternatives: solution.candidates.slice(1, 1 + ALTERNATIVES_COUNT).map((c) => ({
        agentId: agents[c.assignment[0] ?? -1]?.id ?? chosen.id,
        probability: c.probability,
      })),
    };
  }

  // ============ 批量联合量子调度（subspace / fullspace / qpu） ============

  /**
   * 批量联合量子调度（量子态调度的完整形态）：
   * 把一批挂起任务与空闲agent的**联合分配问题**编码为哈密顿量——
   * 所有分配组合同时存在于叠加态中，纠缠的agent对以耦合项进入能量，
   * 演化后测量坍缩得到联合分配。这是逐任务贪心无法表达的联合最优。
   *
   * 同步契约（08#34）：子空间退火演化经 Atomics.wait 阻塞式驱动，求解
   * 期间主线程事件循环停摆（HTTP/WS 心跳、GC 冻结）——脚本与简单确定性
   * 场景可用；长驻服务进程（WS/HTTP）请优先使用异步孪生
   * {@link QuantumEngineOrchestrator.scheduleBatchQuantumAsync}（数值逐位一致）。
   *
   * @param taskIds 指定任务（缺省取全部挂起任务，按优先级）
   */
  scheduleBatchQuantum(taskIds?: string[]): QuantumBatchReport {
    const ctx = this.collectBatchContext(taskIds);
    if (ctx.candidates.length === 0 || ctx.idlePool.length === 0 || ctx.slots === 0) {
      return this.emptyBatchReport(ctx.engineKind);
    }

    // 4) 首选：约束子空间精确引擎（多轮）—— 每轮把至多 min(空闲数, 维度
    //    上限允许的任务数) 个任务联合编码进子空间精确求解。任务多于空闲
    //    agent（m > n）时自动分轮，联合窗口保持最大，不再退化到全空间小分块。
    //    可联合调度的批量远超全空间态矢量（例：8任务×10agent = 181万维
    //    子空间，等效全空间 2^80 维）。
    if (ctx.schedulable.length > 0 && ctx.idlePool.length >= 2) {
      const subspaceReport = this.runSubspaceRounds(
        ctx.schedulable,
        ctx.algorithm,
        ctx.subspaceCap,
        ctx.maxConcurrent,
      );
      if (subspaceReport) return subspaceReport;
    }

    // 5-6) 回退：全空间态矢量分块路径（子空间超维或不定时使用）
    return this.runFullspaceChunks(ctx);
  }

  /**
   * 批量联合量子调度的异步孪生（08#34 调度器侧收口）。
   *
   * 与 {@link QuantumEngineOrchestrator.scheduleBatchQuantum} 完全同一语义、同一
   * dispatch 序列——**数值逐位一致**（同一问题实例、同一种子时两版的
   * QuantumBatchReport 逐字段相同，由回归测试锚定）。唯一区别：子空间
   * 退火演化走 waitAsync 非阻塞驱动（annealSolveSubspaceAsync），求解
   * 期间主线程事件循环全程存活——WS/HTTP 心跳、GC、immediate 队列照常
   * 运转。长驻服务进程应优先使用本入口；同步版保留给脚本/简单确定性场景。
   *
   * 已知不对称（有意为之）：QAOA 分支（qaoaSolveSubspace）没有异步变体，
   * 两版均同步执行——但调度器仅在子空间维度 ≤ SUBSPACE_QAOA_DIMENSION_LIMIT
   * 时选择 QAOA，其变分训练的阻塞时长有界；真正可达分钟级的退火路径
   * （大维度）已全部 async 化。
   *
   * @param taskIds 指定任务（缺省取全部挂起任务，按优先级）
   */
  async scheduleBatchQuantumAsync(taskIds?: string[]): Promise<QuantumBatchReport> {
    const ctx = this.collectBatchContext(taskIds);
    if (ctx.candidates.length === 0 || ctx.idlePool.length === 0 || ctx.slots === 0) {
      return this.emptyBatchReport(ctx.engineKind);
    }

    if (ctx.schedulable.length > 0 && ctx.idlePool.length >= 2) {
      const subspaceReport = await this.runSubspaceRoundsAsync(
        ctx.schedulable,
        ctx.algorithm,
        ctx.subspaceCap,
        ctx.maxConcurrent,
      );
      if (subspaceReport) return subspaceReport;
    }

    return this.runFullspaceChunks(ctx);
  }

  /**
   * 批量路径的公共收集段（sync/async 孪生单源）：算法裁决、候选任务、
   * 空闲池、并发余量、能力过滤与子空间上限。两孪生从同一状态快照出发，
   * 位级一致性由结构保证（收集段无副作用）。
   */
  private collectBatchContext(taskIds?: string[]): {
    algorithm: 'quantum-qaoa' | 'quantum-annealing';
    engineKind: 'qaoa' | 'annealing';
    candidates: Task[];
    schedulable: Task[];
    idlePool: Agent[];
    slots: number;
    maxConcurrent: number | null;
    subspaceCap: number;
  } {
    const algorithm: 'quantum-qaoa' | 'quantum-annealing' =
      this.ctx.config.scheduling?.quantumAlgorithm === 'quantum-annealing'
        ? 'quantum-annealing'
        : 'quantum-qaoa';
    const engineKind = algorithm === 'quantum-qaoa' ? ('qaoa' as const) : ('annealing' as const);

    // 1) 收集可调度任务：显式ID或按优先级桶顺序的全部挂起任务
    let candidates: Task[];
    if (taskIds) {
      candidates = taskIds
        .map((id) => this.ctx.getTask(id))
        .filter((t): t is Task => !!t && t.status === 'pending' && this.ctx.dependenciesMet(t));
    } else {
      candidates = this.ctx.collectPendingCandidates();
    }

    // 2) 空闲agent池与并发余量
    const idlePool = this.ctx.getAgents().filter((a) => a.state === 'idle');
    const maxConcurrent = this.ctx.config.scheduling?.maxConcurrentTasks;
    const slots =
      maxConcurrent != null ? Math.max(0, maxConcurrent - this.ctx.activeAssignments()) : Infinity;

    // 3) 能力过滤：无可匹配agent的任务出局
    const schedulable = candidates.filter((task) =>
      idlePool.some((agent) => this.ctx.checkCapabilityMatch(agent, task)),
    );

    const subspaceCap = this.ctx.config.scheduling?.quantum?.subspaceCap ?? SCHEDULER_SUBSPACE_CAP;
    return {
      algorithm,
      engineKind,
      candidates,
      schedulable,
      idlePool,
      slots,
      maxConcurrent: maxConcurrent ?? null,
      subspaceCap,
    };
  }

  /** 早退空报告（无可调度任务/空闲池空/并发余量为零；不计入运行统计） */
  private emptyBatchReport(engineKind: 'qaoa' | 'annealing'): QuantumBatchReport {
    return {
      engine: engineKind,
      representation: 'fullspace',
      chunks: 0,
      assigned: 0,
      assignments: [],
      validMass: 0,
      meanProbability: 0,
      entanglementCouplings: 0,
      solutions: [],
    };
  }

  /**
   * 全空间态矢量分块回退路径（sync/async 批量调度共用）：分块受 qubitCap
   * 钳制到 FULLSPACE_QUBIT_LIMIT（态矢量内存上限），单块求解时长有界，
   * 因此在异步孪生中也保持同步执行（阻塞可控，无需 async 化）。
   *    任务数×agent数 ≤ qubitCap（超限配置应在配置期报错，而不是让引擎
   *    在调度中段抛出）
   */
  private runFullspaceChunks(ctx: {
    algorithm: 'quantum-qaoa' | 'quantum-annealing';
    engineKind: 'qaoa' | 'annealing';
    candidates: Task[];
    schedulable: Task[];
    idlePool: Agent[];
    slots: number;
    maxConcurrent: number | null;
  }): QuantumBatchReport {
    const { schedulable, idlePool, slots, maxConcurrent, candidates, engineKind } = ctx;
    const qubitCap = Math.min(
      this.ctx.config.scheduling?.quantum?.qubitCap ?? SCHEDULER_QUBIT_CAP,
      FULLSPACE_QUBIT_LIMIT,
    );
    const chunks: Task[][] = [];
    let current: Task[] = [];
    for (const task of schedulable) {
      if (current.length > 0 && (current.length + 1) * idlePool.length > qubitCap) {
        chunks.push(current);
        current = [];
      }
      current.push(task);
    }
    if (current.length > 0) chunks.push(current);

    // 逐块求解：构建哈密顿量（亲和度+纠缠耦合）→ 演化 → 坍缩
    const report: QuantumBatchReport = {
      engine: engineKind,
      representation: 'fullspace',
      chunks: chunks.length,
      assigned: 0,
      assignments: [],
      validMass: 0,
      meanProbability: 0,
      entanglementCouplings: 0,
      solutions: [],
    };

    let achievedWelfare = 0;
    let optimalWelfare = 0;
    let optimalityKnown = true;

    for (const chunk of chunks) {
      // R12#1：并发上限以 maxConcurrent 为比较基准——slots 已按入口在役数
      // 预扣（= maxConcurrent − A0），再与含 A0 的 activeAssignments() 比较
      // 是对同批在役任务的二次扣减：A0 ≥ slots（利用率过半）时此处立即
      // break，批量调度静默空转。单任务路径（tryAssign）与 01#4 QPU 修复
      // 的规范公式均为实时余量 maxConcurrent − activeAssignments()。
      if (maxConcurrent != null && this.ctx.activeAssignments() >= maxConcurrent) break;
      // 不变量兜底（01#3）：分块条件带 current.length > 0 前缀，
      // 单任务×大空闲池（子空间引擎超维回退到这里的典型场景）产出的
      // 单任务块仍可超 cap——引擎会在调度中段抛 QuantumEngineError。
      // 超限块跳过本轮并告警（任务留 pending 等下一轮），调度循环
      // 的契约是「不抛错的尽力而为」。
      if (chunk.length * idlePool.length > qubitCap) {
        logWarn(
          'QuantumScheduler',
          `Skipping batch chunk of ${chunk.length} task(s) over ${idlePool.length} idle agents: ` +
            `${chunk.length * idlePool.length} qubits exceeds qubitCap=${qubitCap}`,
        );
        continue;
      }
      // R12#1：applyJointSolution 的 maxAssign 与**累计**已派数（report.
      // assigned）比较，是「本批总配额」语义——取入口余量 slots 恒定值。
      // 此前每块重算 slots − activeAssignments() 会随本批自己的派单收缩，
      // 块 1 派过之后块 2 立即断裂（余量被重复扣减）。全空间路径在本方法
      // 内无宏任务 await，入口余量在整批内不失效（异步孪生落到本路径时
      // 前置的子空间轮未执行任何求解 await），无需按事件窗口复查。
      const batchAssignBudget = maxConcurrent != null ? slots : Infinity;

      const { problem, couplingCount, nqubits } = this.buildBatchProblem(chunk, idlePool);
      report.entanglementCouplings += couplingCount;

      const solverOptions = this.buildSolverOptions();
      const solution =
        ctx.algorithm === 'quantum-qaoa'
          ? qaoaSolve(problem, solverOptions)
          : annealSolve(problem, solverOptions);

      // 精确最优对照（问题规模允许时）：量子解 vs 穷举最优的诚实自检
      const brute = nqubits <= BRUTE_FORCE_QUBIT_LIMIT ? bruteForceOptimum(problem) : null;
      achievedWelfare += solution.welfare;
      if (brute) {
        optimalWelfare += brute.welfare;
      } else {
        optimalityKnown = false;
      }

      report.solutions.push({
        taskIds: chunk.map((t) => t.id),
        welfare: solution.welfare,
        probability: solution.probability,
        validMass: solution.validMass,
        layers: solution.layers,
        evaluations: solution.evaluations,
      });
      report.validMass += solution.validMass;

      // 应用坍缩结果：仍受并发上限约束（R12#1：累计配额见 batchAssignBudget）
      this.applyJointSolution(
        chunk,
        idlePool,
        solution.assignment,
        problem,
        {
          maxAssign: batchAssignBudget,
          probability: solution.probability,
          confidence: solution.validMass,
          reasoning: () =>
            `batch ${solution.engine}: joint superposition of ${chunk.length} tasks × ` +
            `${idlePool.length} agents${couplingCount > 0 ? `, ${couplingCount} entanglement couplings` : ''}, ` +
            `Born collapse p=${solution.probability.toFixed(3)}`,
        },
        report,
      );
    }

    if (report.solutions.length > 0) {
      report.validMass /= report.solutions.length;
      report.meanProbability =
        report.solutions.reduce((s, x) => s + x.probability, 0) / report.solutions.length;
    }
    if (optimalityKnown && optimalWelfare > 0) {
      report.optimality = {
        achieved: achievedWelfare,
        optimal: optimalWelfare,
        ratio: achievedWelfare / optimalWelfare,
      };
    }
    this.finalizeBatchReport(report);

    logInfo(
      'QuantumScheduler',
      `Quantum batch (${ctx.algorithm}/fullspace): ${report.assigned}/${candidates.length} tasks assigned ` +
        `in ${report.chunks} chunk(s), meanBornP=${report.meanProbability.toFixed(3)}` +
        (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''),
    );
    return report;
  }

  /**
   * 应用联合坍缩解的公共骨架：逐任务校验（并发余量/pending/资格/空闲）
   * → 构建决策 → 应用 → 记入报告。资格校验对子空间/QPU 路径是冗余的
   * 防御（其解构造上已合法），保留统一校验以挡住求解器实现缺陷。
   */
  private applyJointSolution(
    chunk: Task[],
    pool: Agent[],
    assignment: readonly number[],
    problem: AssignmentProblem,
    opts: {
      maxAssign: number;
      probability: number;
      confidence: number;
      reasoning: () => string;
    },
    report: QuantumBatchReport,
  ): void {
    for (let t = 0; t < chunk.length; t++) {
      if (report.assigned >= opts.maxAssign) break;
      const task = chunk[t];
      if (task?.status !== 'pending') continue; // 并发块内前序已占用
      const agentIndex = assignment[t];
      if (agentIndex == null || agentIndex < 0) continue;
      if (problem.ineligible[t]?.[agentIndex]) continue;
      const agent = pool[agentIndex];
      if (agent?.state !== 'idle') continue; // 同块内被占用

      this.ctx.applyAssignmentDecision(task, {
        taskId: task.id,
        agentId: agent.id,
        probability: opts.probability, // 联合分配的Born概率
        confidence: opts.confidence,
        reasoning: opts.reasoning(),
        alternatives: [],
      });
      report.assigned++;
      report.assignments.push({
        taskId: task.id,
        taskName: task.name,
        agentId: agent.id,
        probability: opts.probability,
      });
      this.quantumProbabilitySum += opts.probability;
    }
  }

  /** 批量路径的公共收尾：运行计数与最优率快照 */
  private finalizeBatchReport(report: QuantumBatchReport): void {
    this.quantumBatchRuns++;
    this.quantumBatchAssigned += report.assigned;
    if (report.optimality) {
      this.lastOptimalityRatio = report.optimality.ratio;
    }
  }

  /**
   * 子空间多轮求解（同步驱动）：每轮取至多 P(空闲数, k) ≤ subspaceCap 的
   * 最大 k 个挂起任务，与当前空闲池联合编码进约束子空间精确求解，应用
   * 坍缩结果后进入下一轮（前轮占用的agent自动出池）。任何一轮都不可行
   * 时返回 null 交由调用方回退全空间路径。
   *
   * 轮循环的三个阶段（准备/记录/收尾）与异步孪生 {@link runSubspaceRoundsAsync}
   * 单源共享——两驱动仅在「求解调用」一处分叉（同步阻塞 vs await 异步
   * 演化），位级一致性由结构保证。
   */
  private runSubspaceRounds(
    tasks: Task[],
    algorithm: 'quantum-qaoa' | 'quantum-annealing',
    subspaceCap: number,
    maxConcurrent: number | null,
  ): QuantumBatchReport | null {
    const report = this.initSubspaceReport(algorithm);
    const acc = { achieved: 0, optimal: 0, maxDim: 0, maxQubits: 0 };
    let pending = tasks.filter((t) => t.status === 'pending');
    let anyRound = false;

    while (pending.length > 0) {
      const round = this.prepareSubspaceRound(pending, algorithm, subspaceCap, maxConcurrent);
      if (!round) break;
      const solution = round.useQaoa
        ? qaoaSolveSubspace(round.model, this.buildSolverOptions())
        : annealSolveSubspace(round.model, this.buildSolverOptions());
      const progressed = this.recordSubspaceRound(report, round, solution, acc, maxConcurrent);
      anyRound = true;
      if (!progressed) break; // 防御：无进展即退出
      pending = pending.filter((t) => t.status === 'pending');
    }

    if (!anyRound) return null;
    return this.finalizeSubspaceReport(report, acc);
  }

  /**
   * 子空间多轮求解的异步孪生（08#34）：轮结构与同步版逐字相同，唯一
   * 区别是退火求解走 annealSolveSubspaceAsync（waitAsync 非阻塞驱动），
   * 演化期间主线程事件循环存活。QAOA 分支保持同步——调度器仅在
   * dimension ≤ SUBSPACE_QAOA_DIMENSION_LIMIT 时选择 QAOA，变分训练的
   * 阻塞时长有界（真正可达分钟级的是大维度退火路径，已 async 化）。
   */
  private async runSubspaceRoundsAsync(
    tasks: Task[],
    algorithm: 'quantum-qaoa' | 'quantum-annealing',
    subspaceCap: number,
    maxConcurrent: number | null,
  ): Promise<QuantumBatchReport | null> {
    const report = this.initSubspaceReport(algorithm);
    const acc = { achieved: 0, optimal: 0, maxDim: 0, maxQubits: 0 };
    let pending = tasks.filter((t) => t.status === 'pending');
    let anyRound = false;

    while (pending.length > 0) {
      const round = this.prepareSubspaceRound(pending, algorithm, subspaceCap, maxConcurrent);
      if (!round) break;
      const solution = round.useQaoa
        ? qaoaSolveSubspace(round.model, this.buildSolverOptions())
        : await annealSolveSubspaceAsync(round.model, this.buildSolverOptions());
      const progressed = this.recordSubspaceRound(report, round, solution, acc, maxConcurrent);
      anyRound = true;
      if (!progressed) break; // 防御：无进展即退出
      pending = pending.filter((t) => t.status === 'pending');
    }

    if (!anyRound) return null;
    return this.finalizeSubspaceReport(report, acc);
  }

  /** 子空间报告的公共初态（两驱动单源） */
  private initSubspaceReport(algorithm: 'quantum-qaoa' | 'quantum-annealing'): QuantumBatchReport {
    return {
      engine: algorithm === 'quantum-qaoa' ? 'qaoa' : 'annealing',
      representation: 'subspace',
      chunks: 0,
      assigned: 0,
      assignments: [],
      validMass: 1, // 子空间全部基态合法：概率质量恒为1
      meanProbability: 0,
      entanglementCouplings: 0,
      solutions: [],
    };
  }

  /**
   * 子空间单轮的准备段（两驱动单源）：空闲池快照、可行性过滤、维度上限
   * 允许的最大联合任务数 k、哈密顿量构建与子空间模型构建。
   * 返回 null 表示本轮不可行（调用方循环退出）。
   */
  private prepareSubspaceRound(
    pending: Task[],
    algorithm: 'quantum-qaoa' | 'quantum-annealing',
    subspaceCap: number,
    maxConcurrent: number | null,
  ): {
    round: Task[];
    pool: Agent[];
    built: { problem: AssignmentProblem; couplingCount: number; nqubits: number };
    model: SubspaceModel;
    useQaoa: boolean;
  } | null {
    // R12#1：与全空间分块同修——slots 已按入口在役数预扣，此处与含 A0 的
    // activeAssignments() 比较是二次扣减。规范公式：实时余量
    // maxConcurrent − activeAssignments()（tryAssign 与 01#4 同款）。
    if (maxConcurrent != null && this.ctx.activeAssignments() >= maxConcurrent) return null;
    const pool = this.ctx.getAgents().filter((a) => a.state === 'idle');
    if (pool.length < 1) return null;

    // 本轮可行任务：当前空闲池中至少一个能力匹配的agent
    const feasible = pending.filter((t) => pool.some((a) => this.ctx.checkCapabilityMatch(a, t)));
    if (feasible.length === 0) return null;

    // 维度上限允许的最大联合任务数 k：P(n,k) ≤ subspaceCap
    let k = 0;
    let d = 1;
    while (k < pool.length) {
      const next = d * (pool.length - k);
      if (next > subspaceCap) break;
      d = next;
      k++;
    }
    k = Math.max(1, k);

    // R12#1：实时余量（不再对入口在役数二次扣减）
    const remainingSlots =
      maxConcurrent != null ? Math.max(0, maxConcurrent - this.ctx.activeAssignments()) : Infinity;
    const round = feasible.slice(0, Math.min(k, pool.length, remainingSlots));
    if (round.length === 0) return null;

    const built = this.buildBatchProblem(round, pool);
    const model = buildSubspaceModel(built.problem, { dimensionCap: subspaceCap });
    if (!model || model.dimension === 0) return null;

    // QAOA 变分训练成本随维度线性放大，大子空间自动改用退火（一次演化）
    const useQaoa =
      algorithm === 'quantum-qaoa' && model.dimension <= SUBSPACE_QAOA_DIMENSION_LIMIT;
    return { round, pool, built, model, useQaoa };
  }

  /**
   * 子空间单轮的记录与应用段（两驱动单源）：解入报告、记账、应用联合
   * 坍缩结果。返回本轮是否有分配进展（false = 调用方循环退出）。
   */
  private recordSubspaceRound(
    report: QuantumBatchReport,
    round: {
      round: Task[];
      pool: Agent[];
      built: { problem: AssignmentProblem; couplingCount: number; nqubits: number };
      model: SubspaceModel;
    },
    solution: SubspaceSolution,
    acc: { achieved: number; optimal: number; maxDim: number; maxQubits: number },
    maxConcurrent: number | null,
  ): boolean {
    const { round: roundTasks, pool, built, model } = round;
    report.engine = solution.engine;
    report.chunks++;
    report.entanglementCouplings += built.couplingCount;
    acc.achieved += solution.welfare;
    acc.optimal += model.optimalWelfare;
    acc.maxDim = Math.max(acc.maxDim, model.dimension);
    acc.maxQubits = Math.max(acc.maxQubits, roundTasks.length * pool.length);
    report.solutions.push({
      taskIds: roundTasks.map((t) => t.id),
      welfare: solution.welfare,
      probability: solution.probability,
      validMass: 1,
      layers: solution.layers,
      evaluations: solution.evaluations,
    });

    // R12#2（01#4 同族的 await 窗口复查）：异步孪生的演化 await
    // （serialAnnealEvolveAsync 的 setImmediate 让出 / waitAsync）期间，
    // 事件路径（completeTask→重调度、并发 scheduleTask）可能已消耗并发位
    // ——此前 maxAssign: Infinity 全量套用会超订 maxConcurrentTasks。
    // 求解后按实时余量封顶；applyJointSolution 的 maxAssign 与**累计**
    // 已派数（report.assigned，本批口径）比较，故配额 = 实时余量 + 本批
    // 已派数。同步驱动无 await 窗口（Δ=0），该值恒等于入口余量上限、
    // 不小于本轮规模（轮切片已按同一实时余量截断）——对同步路径零漂移。
    const assignedBefore = report.assigned;
    const maxAssign =
      maxConcurrent != null
        ? Math.max(0, maxConcurrent - this.ctx.activeAssignments() + report.assigned)
        : Infinity;
    this.applyJointSolution(
      roundTasks,
      pool,
      solution.assignment,
      built.problem,
      {
        maxAssign,
        probability: solution.probability,
        confidence: 1,
        reasoning: () =>
          `subspace ${solution.engine}: exact evolution over P(${pool.length},${roundTasks.length})` +
          `=${model.dimension} valid assignments (equiv. ${roundTasks.length * pool.length} qubits full space)` +
          `${built.couplingCount > 0 ? `, ${built.couplingCount} entanglement couplings` : ''}, ` +
          `Born collapse p=${solution.probability.toExponential(2)}`,
      },
      report,
    );
    return report.assigned > assignedBefore;
  }

  /** 子空间报告的公共收尾（两驱动单源）：均值/最优率/子空间信息/统计/日志 */
  private finalizeSubspaceReport(
    report: QuantumBatchReport,
    acc: { achieved: number; optimal: number; maxDim: number; maxQubits: number },
  ): QuantumBatchReport {
    if (report.solutions.length > 0) {
      report.meanProbability =
        report.solutions.reduce((s, x) => s + x.probability, 0) / report.solutions.length;
    }
    if (acc.optimal > 0) {
      report.optimality = {
        achieved: acc.achieved,
        optimal: acc.optimal,
        ratio: acc.achieved / acc.optimal,
      };
    }
    report.subspace = { dimension: acc.maxDim, equivalentQubits: acc.maxQubits };

    this.finalizeBatchReport(report);

    logInfo(
      'QuantumScheduler',
      `Quantum batch (${report.engine}/subspace, ${report.chunks} round(s)): ` +
        `${report.assigned} tasks, maxDim=${acc.maxDim} (equiv ${acc.maxQubits} qubits)` +
        (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''),
    );
    return report;
  }

  /**
   * 批量哈密顿量构建（子空间与全空间两条路径共用）：
   * 福利权重 = 优先级 × 亲和度；能力不符 → 不合格；
   * 纠缠agent对 → 二次耦合福利加成（物理意义上的哈密顿量耦合项）。
   */
  private buildBatchProblem(
    chunk: Task[],
    idlePool: Agent[],
  ): {
    problem: AssignmentProblem;
    couplingCount: number;
    nqubits: number;
  } {
    const entanglementBonus = this.ctx.config.scheduling?.quantum?.entanglementBonus ?? 0.15;
    const problem: AssignmentProblem = {
      taskIds: chunk.map((t) => t.id),
      agentIds: idlePool.map((a) => a.id),
      weights: [],
      ineligible: [],
      couplings: new Map(),
      penaltyOneHot: 0,
      penaltyCapacity: 0,
    };
    const nqubits = chunk.length * idlePool.length;

    // 福利权重：优先级 × 亲和度；能力不符 → 不合格
    for (const task of chunk) {
      const pw = PRIORITY_WEIGHT[task.priority] / 4;
      problem.weights.push(idlePool.map((agent) => pw * this.ctx.agentAffinity(agent, task)));
      problem.ineligible.push(idlePool.map((agent) => !this.ctx.checkCapabilityMatch(agent, task)));
    }

    // 纠缠耦合：任意两任务落在纠缠agent对上 → 福利加成（哈密顿量的物理耦合项）
    let couplingCount = 0;
    for (let t1 = 0; t1 < chunk.length; t1++) {
      for (let t2 = t1 + 1; t2 < chunk.length; t2++) {
        const pwMin =
          Math.min(PRIORITY_WEIGHT[chunk[t1]!.priority], PRIORITY_WEIGHT[chunk[t2]!.priority]) / 4;
        for (let a1 = 0; a1 < idlePool.length; a1++) {
          for (let a2 = 0; a2 < idlePool.length; a2++) {
            if (a1 === a2) continue;
            if (
              idlePool[a1]!.quantumEntanglement.includes(idlePool[a2]!.id) &&
              !problem.ineligible[t1]![a1]! &&
              !problem.ineligible[t2]![a2]!
            ) {
              problem.couplings.set(
                couplingKey(t1 * idlePool.length + a1, t2 * idlePool.length + a2, nqubits),
                entanglementBonus * pwMin,
              );
              couplingCount++;
            }
          }
        }
      }
    }

    // 全空间路径需要罚项（子空间路径忽略罚项——约束内建于子空间本身）
    const penalties = defaultPenalties(problem);
    problem.penaltyOneHot = penalties.oneHot;
    problem.penaltyCapacity = penalties.capacity;

    return { problem, couplingCount, nqubits };
  }

  /**
   * 在真实量子硬件上执行批量联合调度（异步——云端 QPU 是网络调用）：
   * 联合分配编码为 Ising → 提交 D-Wave Leap（或其它 QuantumBackend）→
   * 采样 → 合法性校验 → 与本地精确最优对照 → 应用分配。
   * 后端缺省自动选择：有 DWAVE_API_TOKEN 凭据时用真 QPU，否则本地精确引擎。
   * 真实硬件噪声由三道闸门兜底（非法样本丢弃 / 能量核对 / 最优率报告）。
   */
  async scheduleBatchQuantumQpu(
    backend?: QuantumBackend,
    options: { numReads?: number; timeoutMs?: number; routing?: ExecutionTierRouting } = {},
  ): Promise<QuantumBatchReport> {
    const engine = backend ?? getBackend();

    // 收集可调度任务（与 scheduleBatchQuantum 相同语义：优先级桶顺序）
    const candidates = this.ctx.collectPendingCandidates();
    const idlePool = this.ctx.getAgents().filter((a) => a.state === 'idle');
    const maxConcurrent = this.ctx.config.scheduling?.maxConcurrentTasks;
    const slots =
      maxConcurrent != null ? Math.max(0, maxConcurrent - this.ctx.activeAssignments()) : Infinity;

    if (candidates.length === 0 || idlePool.length === 0 || slots === 0) {
      return {
        engine: 'qpu',
        representation: 'qpu',
        chunks: 0,
        assigned: 0,
        assignments: [],
        validMass: 0,
        meanProbability: 0,
        entanglementCouplings: 0,
        solutions: [],
      };
    }

    const feasible = candidates.filter((task) =>
      idlePool.some((agent) => this.ctx.checkCapabilityMatch(agent, task)),
    );
    // 真 QPU 不受本地态矢量内存限制（Ising 变量数即规模），一轮吃满空闲池
    //（slots 为 Infinity 时 Math.min 收敛到池大小）
    const round = feasible.slice(0, Math.min(idlePool.length, slots));

    const built = this.buildBatchProblem(round, idlePool);
    const result = await solveAssignmentOnBackend(built.problem, engine, options);

    const report: QuantumBatchReport = {
      engine: 'qpu',
      representation: 'qpu',
      chunks: 1,
      assigned: 0,
      assignments: [],
      validMass: 1 - result.invalidSamples / Math.max(1, result.totalReads),
      meanProbability: result.sampleFrequency,
      entanglementCouplings: built.couplingCount,
      solutions: [
        {
          taskIds: round.map((t) => t.id),
          welfare: result.welfare,
          probability: result.sampleFrequency,
          validMass: 1 - result.invalidSamples / Math.max(1, result.totalReads),
          // layers 语义是电路层数 p；QPU 采样路径无层数概念，恒 0
          // （读取次数见 reasoning 与 totalReads——此前把 totalReads
          // 塞进 layers 是字段挪用）
          layers: 0,
          evaluations: 1,
        },
      ],
    };
    if (result.optimality) {
      report.optimality = result.optimality;
    }

    // 01#4: await 窗口后的并发重查——slots/预算在 await 前计算，期间
    // completeTask→reschedule 等事件路径可能已消耗预算（activeAssignments
    // 增长），此前以 maxAssign: Infinity 全量套用 QPU 解会超订并发上限。
    // 按 await 后的实时余量封顶（0 = 本轮放弃套用，任务留 pending）；
    // 单 agent 空闲重查（applyJointSolution 内）保持不变。
    const maxAssign =
      maxConcurrent != null ? Math.max(0, maxConcurrent - this.ctx.activeAssignments()) : Infinity;

    this.applyJointSolution(
      round,
      idlePool,
      result.assignment,
      built.problem,
      {
        maxAssign,
        probability: result.sampleFrequency, // 采样频率 = 量子分布的频率估计
        confidence: report.validMass,
        reasoning: () =>
          `${engine.name}${engine.realHardware ? ' (real QPU)' : ''}: solver=${result.solver}, ` +
          `${result.totalReads} reads, sample frequency=${(result.sampleFrequency * 100).toFixed(2)}%` +
          (result.optimality ? `, optimality=${(result.optimality.ratio * 100).toFixed(1)}%` : ''),
      },
      report,
    );

    this.finalizeBatchReport(report);

    logInfo(
      'QuantumScheduler',
      `Quantum batch on ${engine.name}${engine.realHardware ? ' [REAL QPU]' : ' [local exact]'}: ` +
        `${report.assigned} tasks, solver=${result.solver}, ` +
        `invalidSamples=${result.invalidSamples}/${result.totalReads}` +
        (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''),
    );
    return report;
  }

  /** 量子引擎运行统计 */
  getQuantumMetrics(): {
    algorithm: QuantumAlgorithm;
    singleDecisions: number;
    batchRuns: number;
    batchAssigned: number;
    meanProbability: number | null;
    lastOptimalityRatio: number | null;
  } {
    const total = this.quantumSingleDecisions + this.quantumBatchAssigned;
    return {
      algorithm: this.ctx.config.scheduling?.quantumAlgorithm ?? 'hybrid',
      singleDecisions: this.quantumSingleDecisions,
      batchRuns: this.quantumBatchRuns,
      batchAssigned: this.quantumBatchAssigned,
      meanProbability: total > 0 ? this.quantumProbabilitySum / total : null,
      lastOptimalityRatio: this.lastOptimalityRatio,
    };
  }
}
