/**
 * classical-baselines —— 经典最强基线（量子调度突破的诚实对照）
 *
 * 世界级的突破声明必须面对最强的经典对手，而非只打赢贪心：
 *
 * 1. **匈牙利算法（Kuhn-Munkres, O(n³)）**：线性分配问题的精确多项式解
 *    （1955/1957）。无耦合的调度问题就是线性分配——匈牙利精确求解。
 *    量子子空间引擎在线性实例上必须与它**逐点一致**（这是对照认证：
 *    两个完全独立的算法给出同一最优，互相验证正确性）。
 *    含纠缠耦合后问题变为二次分配（QAP 型，NP-hard）——多项式精确解
 *    不存在，量子联合优化此时才有真正的价值空间。
 *
 * 2. **最陡上升局部搜索（成对交换 + 单点移动）**：QAP 的标准经典启发式
 *    基线。从贪心解出发，反复执行最优改进邻域动作直到局部最优。
 *    量子联合演化应达到 ≥ 局部搜索的质量（且不陷入局部最优盆地）。
 */

import type { AssignmentProblem } from './quantum-optimizer.js';
import { welfareOf } from './quantum-optimizer.js';
import { InfeasibleProblemError, QuantumEngineError } from '../utils/errors.js';

const BIG = 1e9;

/**
 * 匈牙利算法（最大化 Σ w）。基于 Jonker-Volgenant 风格的最小费用增广路：
 * 代价取负转化为最小化，对偶位势 u/v 保证互补松弛，增广路最短路径扩展。
 * 行 = 任务（较小侧，每个任务分配一个agent），列 = agent；要求 m ≤ n。
 * @param weights m×n 福利矩阵（行=任务，列=agent）
 * @param ineligible 资格掩码（true = 不允许）
 * @returns assignment[t] = agent 索引
 */
export function hungarianAssignment(weights: number[][], ineligible: boolean[][]): number[] {
  const m = weights.length; // 任务数（行）
  if (m === 0) return [];
  const n = weights[0]!.length; // agent数（列）
  if (m > n) throw new InfeasibleProblemError('hungarianAssignment requires tasks <= agents');

  const cost: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      cost[i]![j] = ineligible[i - 1]![j - 1]! ? BIG : -weights[i - 1]![j - 1]!;
    }
  }

  const u = new Array<number>(m + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0); // p[j] = 分给agent j 的任务（行号）
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    let guard = 0;
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0]![j]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }
      j0 = j1;
      if (++guard > n + 2)
        throw new QuantumEngineError('hungarian: augmenting path not found (numeric issue)');
    } while (p[j0]! !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = new Array<number>(m).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j]! > 0) assignment[p[j]! - 1] = j - 1;
  }
  // 不可行检测：无完美可行匹配时，算法会把任务压进 BIG 定价的格子。
  // 此时返回的"最优"毫无意义——静默返回会让上层把它当真值对照。
  for (let t = 0; t < m; t++) {
    const agent = assignment[t]!;
    if (agent >= 0 && ineligible[t]![agent]!) {
      throw new InfeasibleProblemError(
        `hungarianAssignment: no feasible assignment exists ` +
          `(task ${t} has no eligible free agent)`,
      );
    }
  }
  return assignment;
}

/** 贪心初始解：按任务序取亲和度最高的空闲agent */
function greedyStart(problem: AssignmentProblem): number[] {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const used = new Set<number>();
  const assignment = new Array<number>(m).fill(-1);
  for (let t = 0; t < m; t++) {
    let best = -1;
    let bestW = -Infinity;
    for (let a = 0; a < n; a++) {
      if (problem.ineligible[t]![a]! || used.has(a)) continue;
      if (problem.weights[t]![a]! > bestW) {
        bestW = problem.weights[t]![a]!;
        best = a;
      }
    }
    if (best >= 0) {
      assignment[t] = best;
      used.add(best);
    }
  }
  return assignment;
}

/**
 * 最陡上升局部搜索：邻域 = 单任务移到空闲agent + 两任务交换agent。
 * 每轮执行福利增益最大的动作，直到局部最优。QAP 的标准经典启发式。
 *
 * 性能备忘：候选动作的福利增益理论上可做 O(1) 增量评估（单移动只触及
 * 1 个线性项 + 相关耦合，交换触及 2+4 类项），但 welfareOf 的累加序
 * （t 序线性项 + Map 插入序耦合）与任何增量形式的结合序不同，ULP 级
 * 差异可能翻转近平局动作的选择——本仓的位级不变性契约下不可接受。
 * 该函数仅被基线对照测试消费（非调度热路径），全量重算的正确性优先。
 * 若未来进入热路径：以增量为筛选、对进入 slack 区间的候选用原全量
 * 累加器复核（slack 需按邻域类型证明为严格低估）。
 */
export function localSearchAssignment(problem: AssignmentProblem): number[] {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const assignment = greedyStart(problem);
  if (assignment.some((a) => a < 0)) return assignment; // 不可行起点

  let current = welfareOf(problem, assignment);
  let improved = true;
  while (improved) {
    improved = false;
    let bestDelta = 1e-12;
    let bestMove: (() => void) | null = null;

    // 单任务移动到空闲agent
    const owner = new Map<number, number>();
    for (let t = 0; t < m; t++) owner.set(assignment[t]!, t);
    for (let t = 0; t < m; t++) {
      for (let a = 0; a < n; a++) {
        if (problem.ineligible[t]![a]! || owner.has(a)) continue;
        const candidate = assignment.slice();
        candidate[t] = a;
        const delta = welfareOf(problem, candidate) - current;
        if (delta > bestDelta) {
          bestDelta = delta;
          const ct = t,
            ca = a;
          bestMove = () => {
            assignment[ct] = ca;
          };
        }
      }
    }
    // 两任务交换agent
    for (let t1 = 0; t1 < m; t1++) {
      for (let t2 = t1 + 1; t2 < m; t2++) {
        const candidate = assignment.slice();
        const tmp = candidate[t1]!;
        candidate[t1] = candidate[t2]!;
        candidate[t2] = tmp;
        if (problem.ineligible[t1]![candidate[t1]!] || problem.ineligible[t2]![candidate[t2]!])
          continue;
        const delta = welfareOf(problem, candidate) - current;
        if (delta > bestDelta) {
          bestDelta = delta;
          const c1 = candidate[t1]!,
            c2 = candidate[t2]!;
          bestMove = () => {
            assignment[t1] = c1;
            assignment[t2] = c2;
          };
        }
      }
    }

    if (bestMove) {
      bestMove();
      current = welfareOf(problem, assignment);
      improved = true;
    }
  }
  return assignment;
}
