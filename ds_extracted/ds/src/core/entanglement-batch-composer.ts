/**
 * entanglement-batch-composer —— 纠缠感知的批组成（R14-A 创新 1，opt-in）。
 *
 * ============ 缺口（读完 engine-orchestrator 后确认的真实问题） ============
 *
 * 批量联合量子调度把纠缠耦合项写进哈密顿量的前提是**两个任务落在同一轮/
 * 同一分块内**（buildBatchProblem 只对 chunk 内的任务对建耦合边）。当前
 * 的轮切片规则是 `feasible.slice(0, k)`（prepareSubspaceRound）与全空间
 * 的顺序分块（runFullspaceChunks）——纯优先级/提交序，对纠缠结构零感知。
 * 任务多于单轮容量（k < 挂起数）时，被切到不同轮的纠缠任务对的耦合加成
 * **永远进不了任何哈密顿量**：联合最优里本可实现的协作福利在批组成阶段
 * 就被静默丢弃——这不是求解器的近似误差，是组合层面的结构性损失。
 *
 * ============ 本模块（纯函数，零副作用，不被任何既有文件 import） ============
 *
 * 给定任务（优先级权重 + 资格集合）与 agent 纠缠对集合，计算任务对的
 * **耦合势** c(t1,t2) = entanglementBonus · min(pw₁,pw₂)（当且仅当存在
 * 纠缠 agent 对 (x,y)、x≠y、t1 可上 x 且 t2 可上 y（或对称方向）——与
 * buildBatchProblem 的耦合项数值完全同口径，即 min 优先级权重的较小者乘
 * 纠缠加成）。然后把任务划分成 ≤ maxBatchSize 的批，最大化**批内耦合势
 * 总和**（captured mass = 跨批耦合势的严格上界意义的可捕获量）。
 *
 * 算法 = 基线切片 + 首改进单任务移动局部搜索：
 * 1. 基线 = 引擎现行语义：按输入序（调用方传引擎的优先级桶序）连续切
 *    maxBatchSize 大小的批——本模块的零回归锚点；
 * 2. 局部搜索只在**严格改进**（> eps）时接受单任务移动，故
 *    capturedMass(结果) ≥ capturedMass(基线) 恒成立（零遗憾性质）；
 * 3. 终止性：每次接受的质量严格增加且取值来自有限格，无环；防御性
 *    移动次数上限（不可达，计数超限抛错）兜底未来改动引入的退化。
 *
 * 与既有能力不重复：engine-orchestrator 无任何批组成策略；本模块不触碰
 * 求解（哈密顿量构建/演化/坍缩全部沿用既有引擎），只决定「谁与谁同批」。
 * 接线（编排者收口）：prepareSubspaceRound/runFullspaceChunks 的切片处
 * 改调 composeBatches 即可，任务出批后的其余语义不变。
 *
 * 诚实边界：
 * - capturedMass 是**可实现耦合福利的上界**（批内任务还须在分配时真的
 *   落在纠缠对上且不与容量冲突），不是 welfare 承诺；
 * - 划分问题（size-constrained graph partitioning）本身 NP-hard
 *   （Kernighan-Lin 型启发式的标准领地〔Kernighan-Lin 1970, partition
 *   heuristic〔待双源〕〕），局部搜索不保证全局最优——测试只钉
 *   「≥ 基线 + 构造实例上的真实福利增益」，不宣称最优性。
 */

import { MechanismError } from '../utils/errors.js';

/** 纠缠 agent 对（无序，a ≠ b；镜像 couplingKey 的对角拒绝语义） */
export interface EntangledAgentPair {
  readonly a: number;
  readonly b: number;
}

/** 参与组批的任务（引擎口径：priorityWeight = PRIORITY_WEIGHT/4 ∈ (0,1]） */
export interface ComposerTask {
  readonly id: string;
  readonly priorityWeight: number;
  /** 资格集合：该任务可被指派的 agent 下标（能力过滤后的候选） */
  readonly eligibleAgents: readonly number[];
}

export interface BatchComposition {
  /** 批序列（保持稳定的批间次序；串联 = 输入任务的一个排列） */
  readonly batches: string[][];
  /** 批内耦合势总和（基线口径的可捕获量） */
  readonly capturedMass: number;
  /** 全部任务对耦合势总和（批组成的天花板） */
  readonly totalMass: number;
  /** 局部搜索实际接受的单任务移动数 */
  readonly movesApplied: number;
  /** baseline = 纯切片；improved = 切片 + 局部搜索 */
  readonly strategy: 'baseline' | 'improved';
}

export interface ComposerOptions {
  /** agent 纠缠对集合（无纠缠则组批退化为基线切片，零移动） */
  readonly entangledAgentPairs: readonly EntangledAgentPair[];
  /** agent 总数（资格下标的值域上界） */
  readonly agentCount: number;
  /** 单批任务数上限（调用方按 min(维度上限允许的k, 空闲池, 并发余量) 传入） */
  readonly maxBatchSize: number;
  /** 纠缠加成系数（与引擎 entanglementBonus 同语义，缺省 0.15） */
  readonly entanglementBonus?: number;
  /** 是否执行局部搜索（缺省 true；false = 引擎现行切片基线） */
  readonly improve?: boolean;
  /** 严格改进判定阈值（缺省 1e-12；容忍质量求和的浮点噪声） */
  readonly improvementEps?: number;
}

/** 防御性移动上限：终止性有证明（严格增 + 有限格），上限只兜底未来退化 */
const MAX_MOVES_FACTOR = 8;

function validatePositiveInteger(value: number, what: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new MechanismError(
      `${what} must be an integer ≥ 1, got ${String(value)} (typeof ${typeof value})`,
    );
  }
}

/**
 * 任务对耦合势：存在纠缠对 (x,y)、x≠y，且资格允许 t1→x 与 t2→y（或对称）
 * 时为 bonus·min(pw₁,pw₂)，否则 0。与 buildBatchProblem 耦合项同值——
 * 批组成优化的量就是哈密顿量里耦合项的量。
 */
function pairMass(
  elig1: ReadonlySet<number>,
  pw1: number,
  elig2: ReadonlySet<number>,
  pw2: number,
  pairs: readonly EntangledAgentPair[],
  bonus: number,
): number {
  if (bonus <= 0 || pairs.length === 0) return 0;
  for (const { a, b } of pairs) {
    if ((elig1.has(a) && elig2.has(b)) || (elig1.has(b) && elig2.has(a))) {
      return bonus * Math.min(pw1, pw2);
    }
  }
  return 0;
}

/**
 * 纠缠感知组批。输入序 = 调用方（未来接线方）给的引擎候选序
 * （优先级桶 → 提交序）；输出保持批间稳定次序。
 */
export function composeBatches(
  tasks: readonly ComposerTask[],
  options: ComposerOptions,
): BatchComposition {
  const bonus = options.entanglementBonus ?? 0.15;
  if (typeof bonus !== 'number' || !Number.isFinite(bonus) || bonus < 0) {
    throw new MechanismError(
      `entanglementBonus must be a finite number ≥ 0, got ${String(options.entanglementBonus)}`,
    );
  }
  const eps = options.improvementEps ?? 1e-12;
  if (typeof eps !== 'number' || !Number.isFinite(eps) || eps <= 0) {
    throw new MechanismError(
      `improvementEps must be a finite positive number, got ${String(options.improvementEps)}`,
    );
  }
  validatePositiveInteger(options.agentCount, 'agentCount');
  validatePositiveInteger(options.maxBatchSize, 'maxBatchSize');

  // 任务校验：重复 id / 非法权重 / 非法资格集合一律具名拒绝
  const seen = new Set<string>();
  const ids: string[] = [];
  const pw: number[] = [];
  const eligSets: Array<Set<number>> = [];
  for (const task of tasks) {
    if (seen.has(task.id)) {
      throw new MechanismError(`Duplicate task id in composer input: ${task.id}`);
    }
    seen.add(task.id);
    if (
      typeof task.priorityWeight !== 'number' ||
      !Number.isFinite(task.priorityWeight) ||
      task.priorityWeight <= 0
    ) {
      throw new MechanismError(
        `Task '${task.id}' priorityWeight must be a finite positive number, got ${String(task.priorityWeight)}`,
      );
    }
    if (task.eligibleAgents.length === 0) {
      throw new MechanismError(`Task '${task.id}' has an empty eligibleAgents set`);
    }
    const set = new Set<number>();
    for (const a of task.eligibleAgents) {
      if (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a >= options.agentCount) {
        throw new MechanismError(
          `Task '${task.id}' references agent index ${String(a)}, outside [0, ${options.agentCount})`,
        );
      }
      if (set.has(a)) {
        throw new MechanismError(`Task '${task.id}' lists agent ${a} twice in eligibleAgents`);
      }
      set.add(a);
    }
    ids.push(task.id);
    pw.push(task.priorityWeight);
    eligSets.push(set);
  }

  // 纠缠对校验：对角拒绝（与 couplingKey 同语义）、值域、重复对去重保序
  const pairs: EntangledAgentPair[] = [];
  const pairSeen = new Set<string>();
  for (const { a, b } of options.entangledAgentPairs) {
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a >= options.agentCount ||
      b >= options.agentCount
    ) {
      throw new MechanismError(
        `Entangled pair (${String(a)}, ${String(b)}) is outside the agent index range [0, ${options.agentCount})`,
      );
    }
    if (a === b) {
      throw new MechanismError(
        `Diagonal entangled pair (${a}, ${a}) refused (agent cannot entangle with itself)`,
      );
    }
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!pairSeen.has(key)) {
      pairSeen.add(key);
      pairs.push({ a, b });
    }
  }

  const n = ids.length;

  // 耦合势邻接表（只存正质量边）：mass[i][j] = c(t_i, t_j)，i < j
  const mass = new Map<number, Map<number, number>>();
  const adjacency = (i: number): Map<number, number> => {
    let m = mass.get(i);
    if (!m) {
      m = new Map<number, number>();
      mass.set(i, m);
    }
    return m;
  };
  let totalMass = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const m = pairMass(eligSets[i]!, pw[i]!, eligSets[j]!, pw[j]!, pairs, bonus);
      if (m > 0) {
        adjacency(i).set(j, m);
        adjacency(j).set(i, m);
        totalMass += m;
      }
    }
  }

  // 基线切片：引擎现行语义（输入序连续切块）
  const batches: string[][] = [];
  for (let i = 0; i < n; i += options.maxBatchSize) {
    batches.push(ids.slice(i, i + options.maxBatchSize));
  }

  const index = new Map<string, number>(ids.map((id, i) => [id, i]));

  const capturedOf = (partition: readonly string[][]): number => {
    let sum = 0;
    for (const batch of partition) {
      for (let x = 0; x < batch.length; x++) {
        for (let y = x + 1; y < batch.length; y++) {
          sum += mass.get(index.get(batch[x]!)!)?.get(index.get(batch[y]!)!) ?? 0;
        }
      }
    }
    return sum;
  };

  const capturedMass = capturedOf(batches);

  if (options.improve === false || n === 0 || batches.length < 2) {
    return {
      batches,
      capturedMass,
      totalMass,
      movesApplied: 0,
      strategy: options.improve === false ? 'baseline' : 'improved',
    };
  }

  // ---- 局部搜索：单任务移动，首改进 + 整体重启扫描（确定性） ----
  // 移动 t（批 i → 批 j，|批 j| < maxBatchSize）的质量增量
  //   Δ = Σ_{u∈批j} c(t,u) − Σ_{u∈批i∖{t}} c(t,u)
  // 仅接受 Δ > eps 的移动 ⇒ capturedMass 单调不减（对基线零遗憾）。
  let movesApplied = 0;
  const moveCap = n * n + MAX_MOVES_FACTOR;
  scan: for (;;) {
    for (let i = 0; i < batches.length; i++) {
      const from = batches[i]!;
      for (let x = 0; x < from.length; x++) {
        const t = from[x]!;
        const ti = index.get(t)!;
        const massInFrom = (() => {
          let s = 0;
          for (let y = 0; y < from.length; y++) {
            if (y !== x) s += mass.get(ti)?.get(index.get(from[y]!)!) ?? 0;
          }
          return s;
        })();
        for (let j = 0; j < batches.length; j++) {
          if (j === i || batches[j]!.length >= options.maxBatchSize) continue;
          const to = batches[j]!;
          let massInTo = 0;
          for (const u of to) massInTo += mass.get(ti)?.get(index.get(u)!) ?? 0;
          if (massInTo - massInFrom > eps) {
            from.splice(x, 1);
            to.push(t);
            if (from.length === 0) batches.splice(i, 1);
            movesApplied++;
            if (movesApplied > moveCap) {
              throw new MechanismError(
                `composeBatches: move cap ${moveCap} exceeded (termination invariant broken — this is a bug)`,
              );
            }
            continue scan; // 首改进：从批序头部重启，保持确定性
          }
        }
      }
    }
    break; // 完整扫描无改进：局部最优
  }

  return {
    batches,
    capturedMass: capturedOf(batches),
    totalMass,
    movesApplied,
    strategy: 'improved',
  };
}
