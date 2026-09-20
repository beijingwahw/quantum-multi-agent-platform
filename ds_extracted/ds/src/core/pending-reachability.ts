/**
 * pending-reachability —— 挂起任务可达性的三分类刻画（R18-A 创新 2，opt-in）。
 *
 * ============ 动机（遍历 quantum-scheduler / task-lifecycle-manager 后确认） ============
 *
 * 挂起任务的缺省命运是**盲 TTL**（pendingTimeoutMs，缺省 600s）：任务
 * 在挂起桶里等满十分钟才以 pending_timeout 失败——无论它有没有任何
 * 等出来的希望。挂起的原因在调度器里从未被区分：
 *   (a) 空闲池里已有能力匹配的 agent（并发上限/依赖门控暂时压住）；
 *   (b) 池中无匹配，但**已注册**的某个 working/overloaded agent 具备该
 *       能力——它会随任务完成/超时回收回到 idle；
 *   (c) 全注册表没有任何 agent 具备该任务要求的能力——等待在结构上
 *       注定无效，十分钟的驻留只推迟下游依赖的级联失败。
 * 现行 sweep 的 pending TTL 对三者一视同仁。
 *
 * ============ 本模块（纯函数，零时钟，不被任何既有文件 import） ============
 *
 * 给定任务的能力需求与**全注册表**快照（idle/working/overloaded 全部
 * 状态），输出三分类判定：
 *
 *   'schedulable-now'     空闲池内已有能力匹配（等待原因是并发/依赖，
 *                         调度器既有机制可在状态变化后消化）；
 *   'awaiting-release'    无空闲匹配但注册表内有匹配——等待有结构根据
 *                         （匹配 agent 终将释放，见 T2）；
 *   'unsatisfiable'       全注册表无匹配——等待注定无效（见 T1）。
 *
 * ============ 精确主张（可证伪） ============
 *
 * 定理 T1（unsatisfiable 的零错杀刻画）：设注册表无增删。则
 *   classification = 'unsatisfiable'（∀a ∈ 注册表: ¬match(a, x)）
 * ⟺ 任务 x 在调度器的任何执行路径下永不离开 pending（直到 TTL/外部
 * 强制失败）。证明：所有调度入口的候选集——resolveCandidates（能力
 * 索引求交）、reschedulePendingTasks 的池内匹配、批量路径
 * collectBatchContext/prepareSubspaceRound 的 checkCapabilityMatch——
 * 都是 注册表 ∩ 能力匹配 的子集；该交集为空时无任何写点能把 x 推入
 * assigned。∎（逆否即得零错杀：被判 unsatisfiable 的任务不存在
 * 「本可被调度」的调度器执行。）
 *
 * 推论 T1'（提前失败严格支配等满 TTL）：unsatisfiable 任务在判定时刻
 * 直接失败 vs 等满 pendingTimeoutMs 失败——终态同为 failed，级联下游
 * 依赖的失败时间各提前至多 TTL；不存在任何调度器执行使两者终态不同。
 * （前提：注册表无增删——新 agent 注册是唯一的「复活」通道，判定是
 * 时点陈述、不对此做未来承诺，见边界。）
 *
 * 定理 T2（awaiting-release 的等待根据）：classification =
 * 'awaiting-release' ⟹ 存在已注册匹配 agent a，且调度器的超时回收
 * （sweep：assigned/running 最迟 taskTimeout 后失败并释放 agent）保证
 * a 所在的每个在役分配最迟有限时间后释放。等待「有机会」被消化——
 * 但**不主张必然调度**：更高优先级任务持续到达时 a 可被持续重派，
 * x 可能饥饿（可达 ≠ 必然调度，这是与 T1 刻意不对称的诚实面）。
 *
 * ============ 诚实边界（不主张什么） ============
 *
 * - 判定是**时点**陈述：注册表后续的增（新 agent 带来能力）删（匹配
 *   agent 注销）都会改变真值；「提前失败」决策的错杀窗口 = 判定到失败
 *   生效之间发生能力供给增加的窗口。同步执行（判定与失败同一事件循环
 *   任务）下该窗口为空集——JS 单线程语义的平台事实，非概率论证。
 * - match 的口径是**能力硬约束全部可满足**（checkCapabilityMatch 的
 *   纯需求侧投影）；不覆盖并发余量、依赖门控、亲和度质量——那些是
 *   'schedulable-now' 内部的次级原因，判定不细分。
 * - overloaded 与 working 同为「在役可释放」闭包成员——排除 overloaded
 *   的窄判定是错杀（负对照钉板：load 归零的 overloaded agent 随即回
 *   idle 的既有语义下，它对等待任务与 working 同样可达）。
 * - 设计稿「报童型阈值规则」（R14 总册 A 域库存）的概率形态需要任务/
 *   注册到达率分布——平台无此模型，任何阈值参数都将是无锚假设；本
 *   实施以确定性时点刻画替代（更强可证伪、零分布假设），偏离及理由
 *   如实记录于 R18-A 详册。
 *
 * 文献接地（只给形状，〔待双源〕）：
 * - 可达性/不变式刻画：某系统验证文献的「入口集不变量」论证传统
 *   〔待双源〕；
 * - 挂起队列的失效快进（fail-fast）与级联重路由：分布式系统熔断/超时
 *   传播文献族 〔待双源〕；
 * - 报童型临界比（newsvendor critical ratio）的原始形态：19 世纪末
 *   银行储备/库存论文献族（常被归属的作者-年份记忆未经核实，不具名）
 *   〔待双源〕。
 */

import { SchedulingError } from '../utils/errors.js';

/** 判定消费的 agent 视图（全注册表快照，含全部状态） */
export interface ReachabilityAgentView {
  readonly id: string;
  readonly capabilities: readonly string[];
  /**
   * 平台 AgentState（idle/working/overloaded/offline）以 string 放宽：
   * 判定只区分 idle 与非 idle——working/overloaded/offline 同为
   * 「已注册、当前不可派」的闭包成员（模块头 T2 与窄闭包负对照）。
   */
  readonly state: string;
}

/** 判定消费的任务视图（能力硬约束名单；空名单 = 无能力约束） */
export interface ReachabilityTaskView {
  readonly id: string;
  readonly requiredCapabilities: readonly string[];
}

/** 三分类：等待的结构原因 */
export type ReachabilityClass =
  /** 空闲池内已有能力匹配（压住它的是并发/依赖，不是能力供给） */
  | 'schedulable-now'
  /** 无空闲匹配但注册表内有（等待有结构根据，见模块头 T2） */
  | 'awaiting-release'
  /** 全注册表无匹配（等待注定无效，见模块头 T1 的零错杀刻画） */
  | 'unsatisfiable';

export interface ReachabilityVerdict {
  readonly task: string;
  readonly classification: ReachabilityClass;
  /** 全注册表内能力匹配的 agent（idle + 非idle 的并集，注册表序） */
  readonly matchingAgents: readonly string[];
  /** matchingAgents 中当前 idle 的子集（'schedulable-now' 的证人集） */
  readonly idleMatches: readonly string[];
  /** 非空闲匹配 agent（'awaiting-release' 的证人集） */
  readonly busyMatches: readonly string[];
}

/**
 * 单任务可达性判定。O(A·R)（A=agent 数、R=需求数，数组 includes 口径）。
 * 错误用法具名拒绝：agent 重复 id、任务携带重复需求（前者是快照损坏，
 * 后者是调用方笔误——两者都会让「能力并集」的证人集失真）。
 */
export function classifyPendingTask(
  task: ReachabilityTaskView,
  agents: readonly ReachabilityAgentView[],
): ReachabilityVerdict {
  const seenAgent = new Set<string>();
  for (const agent of agents) {
    if (seenAgent.has(agent.id)) {
      throw new SchedulingError(
        `classifyPendingTask: duplicate agent id in snapshot: ${agent.id} ` +
          `(the registry closure must be a set — duplicated members would skew the witness sets)`,
      );
    }
    seenAgent.add(agent.id);
  }
  const seenReq = new Set<string>();
  for (const req of task.requiredCapabilities) {
    if (seenReq.has(req)) {
      throw new SchedulingError(
        `classifyPendingTask: task '${task.id}' lists capability '${req}' twice ` +
          `(deduplicate requirements — duplicates do not change the match but corrupt the input contract)`,
      );
    }
    seenReq.add(req);
  }

  const matching: string[] = [];
  const idle: string[] = [];
  const busy: string[] = [];
  for (const agent of agents) {
    // match 口径 = checkCapabilityMatch 的需求侧投影：全部 capability
    // 需求可满足。空需求集对任何 agent（含零能力 agent）都匹配。
    const match = task.requiredCapabilities.every((req) => agent.capabilities.includes(req));
    if (!match) continue;
    matching.push(agent.id);
    if (agent.state === 'idle') idle.push(agent.id);
    else busy.push(agent.id);
  }

  const classification: ReachabilityClass =
    idle.length > 0
      ? 'schedulable-now'
      : matching.length > 0
        ? 'awaiting-release'
        : 'unsatisfiable';

  return {
    task: task.id,
    classification,
    matchingAgents: matching,
    idleMatches: idle,
    busyMatches: busy,
  };
}

/**
 * 挂起桶的批量判定（sweep 集成面：一次快照、逐任务 O(A·R)）。
 * 输出序 = 输入任务序；每项带该任务的判定与证人集。
 */
export function classifyPendingBucket(
  tasks: readonly ReachabilityTaskView[],
  agents: readonly ReachabilityAgentView[],
): readonly ReachabilityVerdict[] {
  return tasks.map((task) => classifyPendingTask(task, agents));
}
