/**
 * admission-control —— 影子价格准入控制（R14-I 创新，opt-in）。
 *
 * ============ 动机（读完 batch-vcg-scheduler.ts / min-cost-flow-potentials.ts 后确认） ============
 *
 * 平台过载时唯一的背压是 maxConcurrentTasks 计数器（engine-orchestrator
 * 对可调度集的截断）：一个纯整数的「满了」信号——不区分「满在谁身上」，
 * 也不给「再放一个任务的边际福利损失是多少」的度量。min-cost-flow-
 * potentials 已把 WDP 流（S→agent[cap]→task[1]→sink，边费用 = −score，
 * score = v − λ − μ·b）的节点位势导出为公开面——LP 对偶的互补松弛让
 * 「agent 容量的边际租金」可以从位势读出。本模块把该对偶面消费成
 * **准入判定**：过载期容量租金抬升自然节流，欠载期租金归零放行，
 * 平台侧保留价（reserve price）再统一扣一道。
 *
 * ============ 数学骨架（WDP 流位势 → 容量影子价格） ============
 *
 * 最优流位势 π 满足：所有残量边归约费用 c_π(u,v) = c(u,v) + π_u − π_v ≥ 0
 * （求解器不变量，容差 RELAX_EPS）。对 WDP 形状的图：
 *
 * - agent a 饱和（S→a 边 f = cap）时，其容量租金取
 *   ρ_a := max(0, π_a − π_sink)。例：单 agent 容量 1、任务 score 5，
 *   终态 π = [0, 0, −5, −5]（源/agent/任务/汇），ρ = 0 − (−5) = 5
 *   ——正是「挤掉这个 score-5 任务才能腾出的容量」的边际值。
 * - agent 未饱和时 ρ_a := 0（互补松弛：松弛容量不承担机会成本）。
 *   这不是风格选择：残量 S→a 前向边存在 ⟹ π_a ≤ π_S，与 π_sink 无
 *   固定大小关系，直接读 π_a − π_sink 会给空闲 agent 报出正租金
 *   （实证：2 agent/1 任务实例 π = [0,0,0,−5,−5]，空闲 a2 的
 *   π_a2 − π_sink = 5——不夹紧会拒绝一切 score ≤ 5 的新任务）。
 *
 * 准入判据：候选任务的仿射口径边际分 s_a（= v − λ − μ·b，与
 * allocateAffineBatch 的 solveWDP 同一语言）对每个资格 agent 求
 *   margin(t) = max_a (s_a − ρ̄_a)，admit ⟺ margin(t) > reservePrice。
 * ρ̄ 是 EWMA 平滑后的影子价格（见下）。μ 与 ρ 在同一尺度上扣减：
 * 采购 markup（BudgetPacer 的 μ）与容量租金（本模块的 ρ）是同一个
 * 对偶框架里的两个乘子/价格——「统一语言」是结构性的，不是类比。
 *
 * ============ 被证明的与未被证明的（诚实边界，全部可查证） ============
 *
 * 【P1 已证明·放行侧】若 margin 经由仍有剩余容量的 agent（ρ̄_a = 0）
 *   为正（此时 margin = s_a > 0），则把该任务并入重解，福利改进 ≥ s_a：
 *   S→a→t_new→sink 全程残量前向边，实费用 = −s_a < 0 是合法增广。
 * 【P2 已证明·拒绝侧·有条件】设当批终态位势满足「返回边条件」
 *   π_sink ≥ π_source（自由处置 LP 的对偶可行性；报告为 dualCertified）。
 *   若 reservePrice = 0 且全部资格 agent 满足 s_a ≤ ρ_a（饱和且
 *   s_a ≤ π_a − π_sink），则令 π_{t_new} := π_sink 即把位势可行地扩展到
 *   增广图：新边归约费用 (π_a − π_sink) − s_a ≥ 0 与 0 ≥ 0，旧边不动，
 *   返回边不动 ⟹ 当前流在增广图上仍最优——拒绝零福利损失（LP 证书）。
 * 【P2 的边界】SSP 提前停机常留下 π_sink < π_source（证书条件不满足，
 *   报告为 certificate = 'conservative'）：此时 ρ 是「当前流值下的」拥堵
 *   租金，拒绝可能错失**依赖换道**的正改进。最小反例（测试钉住）：
 *   2 agent 容量各 1，任务 t1（score 5，双资格）被平手裁决分给 a1，
 *   a2 空闲；新任务 t2（score 3，仅 a1 资格）：ρ_{a1} = 5 ⟹ 拒绝，
 *   而增广图最优是 t1→a2 + t2→a1（福利 8 > 5，改进 3）。租金读数
 *   是对偶的一个极端端点（容量侧吃全部剩余），换道空间在终态位势里
 *   不可见——这是启发式边界的实锤，不是理论缺陷的遮掩。（R17-B 起，
 *   verify='exact' ＋反事实回调把该反例从「披露的代价」变成「被测量
 *   的放行」——见下节。）
 * 【未被证明】准入策略整体的最优性/福利定理。EWMA 跨批平滑是**设计
 *   选择**：影子价格是「当前流值下」的边际，批结构变化后未必延续，
 *   α 越小越保守（惯性大）、α=1 退化为当批即值。不主张任何跨批定理。
 *
 * ============ R17-B 升级：精确拒绝（verify: 'dual' | 'exact'，缺省 exact） ============
 *
 * R14-I 的已披露代价面在拒绝侧：conservative 证书可 over-reject（上面的
 * 最小反例——仅饱和 a1 资格的 score-3 任务被拒，而增广重解最优 8 > 5、
 * 真实改进 3）。本升级把「条件性正向」升格为**严格正向**：verify='exact'
 * （缺省）下，凡边际测试想拒且对偶证书条件不成立（borderline）的判定，
 * 若调用方接入了反事实求解回调，决策即交给测量：
 *   admitWelfare（把候选并入当前批重解的最优福利）> rejectWelfare
 *   （拒绝现状的福利）⟹ 放行；否则拒绝。两者都带 certificate='exact'。
 *
 * 拒绝的完备分划（接了回调 ⟹ 构造上零错拒）：
 *   ① no-candidate-agents——结构拒绝：无资格 = 任何重解都装不下该任务
 *      （admitWelfare 与 rejectWelfare 只能相等），零错；
 *   ② dual-certified（P2 证书条件成立）——LP 对偶证书证明拒绝零福利
 *      损失（见 P2），不必花钱测——回调不触发；
 *   ③ exact（borderline ＋回调）——测得 admitWelfare ≤ rejectWelfare，
 *      并入重解的真实改进非正；
 *   ④ unverified-conservative（borderline ＋无回调）——**不在零错保证
 *      内**：保持 conservative 语义，但 reason 具名披露
 *      'unverified-conservative'（不冒充已验证）。
 *   no-history 的拒绝不触发回调：无对偶历史时价格恒 0，边际 = score −
 *   reserve ≤ 0 意味着唯一动过的闸是调用方自己的保留价——那是政策
 *   拒绝，不是影子价格 over-rejection（证书 'no-history' 已如实分型）。
 *
 * 回调契约（counterfactual?: (candidate) => { admitWelfare, rejectWelfare }，
 * config 级接线，闭包持有调用方的当前批状态）：
 *   - 只在 verify='exact' 且 borderline（边际测试想拒 ＋证书条件不成立）
 *     时触发——放行判定与对偶强拒零成本（成本账见 getMetrics()）；
 *   - 返回的两个福利值必须是有限数，垃圾返回（NaN/缺字段/非对象）
 *     具名 MechanismError 拒绝；
 *   - 回调自身抛错**原样透传**（不包装——错误语义归求解器所有）；
 *     控制器状态（EWMA/证书位）零残留；
 *   - 测量只与回调同样诚实：回调解错 ⟹ 决策跟着错——本升级把「对偶
 *     端点的盲区」换成「调用方求解器的正确性」，不宣称免除；
 *   - admitWelfare < rejectWelfare 不设守卫：WDP 自由处置口径下数学上
 *     不可能（增广可行域 ⊇ 现状），但调用方福利口径可含切换成本等
 *     其他分量——测量说了算。
 * verify='dual' 逐字保留 R14-I 语义（兼容模式：历史披露面的钉板模式）。
 * 放行侧证明不变：margin > 0 的放行仍走 P1 路径，不触发回调、不换证书。
 *
 * ============ 形制 ============
 *
 * 纯确定：无 RNG、无时钟、无环境读数——同一输入序列恒产同一决策
 * （IEEE-754 双精度运算，逐位可重放）。零副作用、零新依赖、不被任何
 * 既有文件 import（opt-in：调度编排者显式接线）。拒绝理由结构化：
 * 逐 agent 给出 score / 平滑租金 / 边际，缺哪个边际条件一目了然。
 *
 * 文献接地（R15 双源核实，台账 DELIVERY/r15-dual-source-citations-20260914.md）：
 * LP 对偶证书与互补松弛（G.B. Dantzig, D.R. Fulkerson, S.M. Johnson,
 * "Solution of a Large-Scale Traveling-Salesman Problem", Operations
 * Research 2:393, 1954——LP 对偶作最优性证书的奠基用法；网络对偶的
 * 最大流形态见 Ford-Fulkerson 1956）；
 * 影子价格术语（T.C. Koopmans, "Analysis of Production as an Efficient
 * Combination of Activities", 收于 Activity Analysis of Production and
 * Allocation, Cowles Commission Monograph 13, Wiley 1951, Ch. III）；
 * EWMA 平滑（S.W. Roberts, "Control Chart Tests Based on Geometric Moving
 * Averages", Technometrics 1(3):239-250, 1959, DOI 10.1080/00401706.1959.10489860）；
 * 预算 pacing 对偶（Balseiro-Besbes, "Budget-Management Strategies in
 * Repeated Auctions", Operations Research 69(3):859-876, 2021；pacing-对偶
 * 专文 Balseiro-Gur, Management Science, DOI 10.1287/mnsc.2018.3174）。
 */

import { MechanismError } from '../utils/errors.js';

/** 饱和判定的容差：used ≥ capacity − 1e-9 视为容量吃满（整数容量下无损） */
const SATURATION_EPS = 1e-9;
/** 返回边证书的容差：π_sink ≥ π_source − 1e-9 视为对偶可行 */
const CERTIFICATE_EPS = 1e-9;

// ---------------------------------------------------------------------------
// 第一层：WDP 流位势 → 逐 agent 容量影子价格（纯函数抽取）
// ---------------------------------------------------------------------------

/** 抽取输入：一个 agent 在 WDP 流图中的节点位相与容量占用 */
export interface AgentCapacityUsage {
  readonly agentId: string;
  /** agent 在流图中的节点编号（S→a→t→sink 拓扑中的 a 层） */
  readonly node: number;
  /** S→a 边已占用的流量 */
  readonly used: number;
  /** S→a 边容量 */
  readonly capacity: number;
}

/** 抽取输出：单 agent 的容量影子价格 */
export interface AgentShadowPrice {
  readonly agentId: string;
  /** 饱和 = max(0, π_a − π_sink)；未饱和 = 0（互补松弛） */
  readonly shadowPrice: number;
  readonly saturated: boolean;
}

/** 一批对偶读数（喂给控制器 update） */
export interface CapacityDualReport {
  readonly agents: readonly AgentShadowPrice[];
  /**
   * 终态位势是否满足返回边条件 π_sink ≥ π_source（P2 拒绝证书的
   * 充分条件）。false 时决策的 certificate = 'conservative'。
   */
  readonly dualCertified: boolean;
}

function assertFiniteNonNegative(x: number, what: string): void {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) {
    throw new MechanismError(
      `${what} must be a finite number ≥ 0, got ${String(x)} (typeof ${typeof x})`,
    );
  }
}

function assertAgentId(id: string, what: string): void {
  if (typeof id !== 'string' || id.length === 0) {
    throw new MechanismError(`${what} must be a non-empty string, got ${String(id)}`);
  }
}

/**
 * 反事实回调返回值的域校验（R17-B）：必须是有 admitWelfare/rejectWelfare
 * 两个有限数的对象。垃圾返回具名拒绝（字段名 + taskId 指名来源）。
 */
function assertCounterfactualResult(
  result: CounterfactualWelfare,
  taskId: string,
): CounterfactualWelfare {
  // 声明类型是对象——null/数组/标量等垃圾形状只能从运行时侧进来；先落
  // unknown 再判形（字面量/类型收窄会把「声明类型的恒真检查」报成恒假）。
  const shape: unknown = result;
  if (typeof shape !== 'object' || shape === null || Array.isArray(shape)) {
    throw new MechanismError(
      `counterfactual result for task ${taskId} must be an object { admitWelfare, rejectWelfare }, got ${typeof shape}`,
    );
  }
  const rec = shape as Record<string, unknown>;
  for (const field of ['admitWelfare', 'rejectWelfare'] as const) {
    const v = rec[field];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new MechanismError(
        `counterfactual result for task ${taskId}: ${field} must be a finite number, got ${String(v)} (typeof ${typeof v})`,
      );
    }
  }
  return result;
}

/**
 * 从 MinCostFlowPotentials 的终态位势抽取逐 agent 容量影子价格。
 *
 * 饱和 agent 的租金 = max(0, π_node − π_sink)；未饱和恒 0（理由见模块
 * 头注——不夹紧会让空闲 agent 报出正租金）。dualCertified 独立汇报，
 * 不影响价格读数本身。
 */
export function extractCapacityDuals(
  potentials: readonly number[],
  opts: {
    readonly sourceNode: number;
    readonly sinkNode: number;
    readonly agents: readonly AgentCapacityUsage[];
  },
): CapacityDualReport {
  if (!Array.isArray(potentials)) {
    throw new MechanismError(
      `extractCapacityDuals: expected a potentials array, got ${typeof potentials}`,
    );
  }
  const pi = potentials as readonly number[]; // Array.isArray 把类型收窄成 any[]——回到声明口径
  for (let i = 0; i < pi.length; i++) {
    const v = pi[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new MechanismError(
        `extractCapacityDuals: potentials[${i}] must be a finite number, got ${String(v)}`,
      );
    }
  }
  const { sourceNode, sinkNode } = opts;
  for (const name of ['sourceNode', 'sinkNode'] as const) {
    const v = name === 'sourceNode' ? sourceNode : sinkNode;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= pi.length) {
      throw new MechanismError(
        `extractCapacityDuals: ${name} must be an integer in [0, ${pi.length}), got ${String(v)}`,
      );
    }
  }
  if (sourceNode === sinkNode) {
    throw new MechanismError(
      `extractCapacityDuals: sourceNode and sinkNode must differ, both are ${String(sourceNode)}`,
    );
  }
  if (!Array.isArray(opts.agents)) {
    throw new MechanismError(
      `extractCapacityDuals: agents must be an array, got ${typeof opts.agents}`,
    );
  }
  const agentSpecs = opts.agents as readonly AgentCapacityUsage[]; // 同上：回到声明口径
  const seen = new Set<string>();
  const out: AgentShadowPrice[] = [];
  for (const agent of agentSpecs) {
    assertAgentId(agent.agentId, 'extractCapacityDuals: agent agentId');
    if (seen.has(agent.agentId)) {
      throw new MechanismError(
        `extractCapacityDuals: duplicate agentId in report: ${agent.agentId}`,
      );
    }
    seen.add(agent.agentId);
    if (typeof agent.node !== 'number' || !Number.isInteger(agent.node) || agent.node < 0) {
      throw new MechanismError(
        `extractCapacityDuals: agent ${agent.agentId} node must be a non-negative integer, got ${String(agent.node)}`,
      );
    }
    if (agent.node >= pi.length) {
      throw new MechanismError(
        `extractCapacityDuals: agent ${agent.agentId} node ${agent.node} out of range (n=${pi.length})`,
      );
    }
    assertFiniteNonNegative(agent.used, `extractCapacityDuals: agent ${agent.agentId} used`);
    assertFiniteNonNegative(
      agent.capacity,
      `extractCapacityDuals: agent ${agent.agentId} capacity`,
    );
    if (agent.used > agent.capacity + SATURATION_EPS) {
      throw new MechanismError(
        `extractCapacityDuals: agent ${agent.agentId} used ${agent.used} exceeds capacity ${agent.capacity}`,
      );
    }
    const saturated = agent.used >= agent.capacity - SATURATION_EPS;
    const shadowPrice = saturated ? Math.max(0, pi[agent.node]! - pi[sinkNode]!) : 0;
    out.push({ agentId: agent.agentId, shadowPrice, saturated });
  }
  return {
    agents: out,
    dualCertified: pi[sinkNode]! >= pi[sourceNode]! - CERTIFICATE_EPS,
  };
}

// ---------------------------------------------------------------------------
// 第二层：影子价格准入控制器（EWMA 平滑 + 保留价判定）
// ---------------------------------------------------------------------------

/** 验证模式：'dual' = R14-I 对偶判定（兼容模式）；'exact'（缺省）= borderline 拒绝交反事实测量 */
export type AdmissionVerifyMode = 'dual' | 'exact';

/** 反事实求解回调的返回：两个口径下的最优福利（都须有限） */
export interface CounterfactualWelfare {
  /** 把候选并入当前批重解后的最优福利 */
  readonly admitWelfare: number;
  /** 拒绝候选（维持现状）的福利 */
  readonly rejectWelfare: number;
}

/** exact 验证的测量明细（certificate = 'exact' 的决策非 null） */
export interface CounterfactualMeasurement {
  readonly admitWelfare: number;
  readonly rejectWelfare: number;
  /** admitWelfare − rejectWelfare（决策依据：admitWelfare > rejectWelfare ⟹ 放行） */
  readonly welfareDelta: number;
}

/**
 * 反事实求解回调（config 级接线）：调用方用自己的批状态把候选并入重解
 * vs 拒绝现状，测两个福利值。仅在 verify='exact' 的 borderline（边际
 * 测试想拒 ＋对偶证书条件不成立）触发；抛错原样透传，垃圾返回具名拒绝。
 */
export type CounterfactualSolver = (candidate: AdmissionCandidate) => CounterfactualWelfare;

/** 观测指标（成本账快照，getMetrics() 返回冻结副本） */
export interface AdmissionMetrics {
  /** decide() 产出的决策总数（抛错的调用不产决策、不计） */
  readonly decisions: number;
  readonly admissions: number;
  readonly rejections: number;
  /**
   * 反事实求解调用次数——每个 borderline 恰好一次（对偶强拒与放行
   * 零成本）。含抛错/结果被具名拒绝的尝试：求解成本已付，如实计数。
   */
  readonly exactVerifications: number;
  /** reason = 'unverified-conservative' 的拒绝数（零错保证的缺口面，可监控） */
  readonly unverifiedConservativeRejections: number;
}

/** 控制器配置（ewmaAlpha/reservePrice 必填；verify/counterfactual 可选，显式 opt-in） */
export interface AdmissionControlConfig {
  /**
   * EWMA 平滑系数 α ∈ (0,1]：ρ̄ ← ρ̄ + α·(ρ − ρ̄)。α=1 = 不平滑
   * （当批读数即值）；α 越小跨批惯性越大（影子价格是「当前流值下」
   * 的边际，跨批延用本身是设计选择，见模块头注）。
   */
  readonly ewmaAlpha: number;
  /** 平台保留价 r（有限，≥ 0）：margin > r 才准入；并列（= r）拒绝 */
  readonly reservePrice: number;
  /**
   * 验证模式（R17-B）：'exact'（缺省）= borderline 拒绝交反事实测量
   * （接了回调即「拒绝零错」；未接则保守拒绝以 reason =
   * 'unverified-conservative' 具名披露）；'dual' = R14-I 对偶判定
   * 逐字保留（兼容模式）。
   */
  readonly verify?: AdmissionVerifyMode;
  /**
   * 反事实求解回调（仅 verify='exact' 的 borderline 触发）。返回
   * { admitWelfare, rejectWelfare }（两个有限数）；垃圾返回具名
   * MechanismError，回调抛错原样透传。契约详见模块头注 R17-B 节。
   */
  readonly counterfactual?: CounterfactualSolver;
}

/** 候选任务的逐 agent 边际分（score 语言 = allocateAffineBatch：v − λ − μ·b） */
export interface CandidateScore {
  readonly agentId: string;
  readonly score: number;
}

/** 一个待判定的准入请求 */
export interface AdmissionCandidate {
  readonly taskId: string;
  /** 资格 (agent, score) 对；空数组 = 无资格（reason: no-candidate-agents） */
  readonly scores: readonly CandidateScore[];
}

/** 单 agent 的判定明细（拒绝时点出缺哪个边际条件） */
export interface AdmissionEvaluation {
  readonly agentId: string;
  readonly score: number;
  /** 决策所用（平滑后）影子价格；该 agent 无历史报告时为 0 */
  readonly shadowPrice: number;
  /** score − shadowPrice */
  readonly marginal: number;
  /** false = 该 agent 从未出现在任何 update 里（冷启动，价格按 0 计） */
  readonly hasHistory: boolean;
}

/**
 * 决策证书（R17-B 四元）：'dual-certified' = P2 证书条件成立（拒绝带
 * LP 证书）；'exact' = borderline 交反事实测量裁决（放行/拒绝都带测量）；
 * 'conservative' = 证书条件不成立（exact 模式未接回调时的退化语义，
 * 拒绝以 reason='unverified-conservative' 具名披露）；'no-history' = 冷启动。
 */
export type AdmissionCertificate = 'dual-certified' | 'exact' | 'conservative' | 'no-history';

export type AdmissionReason =
  'admitted' | 'below-reserve-price' | 'no-candidate-agents' | 'unverified-conservative';

export interface AdmissionDecision {
  readonly taskId: string;
  readonly admitted: boolean;
  readonly reason: AdmissionReason;
  readonly certificate: AdmissionCertificate;
  /** max_a marginal − reservePrice；无候选 agent 时为 null */
  readonly effectiveMargin: number | null;
  readonly reservePrice: number;
  /** 边际最高的 agent（并列取输入序首个——确定性） */
  readonly best: AdmissionEvaluation | null;
  /** 全部评估明细（按输入序） */
  readonly evaluated: readonly AdmissionEvaluation[];
  /**
   * exact 验证的测量明细（certificate = 'exact' 的决策非 null；其余
   * 决策 null）。effectiveMargin 仍是对偶侧读数（结构面），本字段是
   * 真正治理决策的原始测量值。
   */
  readonly counterfactual: CounterfactualMeasurement | null;
}

interface EwmaState {
  value: number;
}

/**
 * 影子价格准入控制器。
 *
 * 用法：每批 WDP 求解后用 extractCapacityDuals 读出对偶并 update()；
 * 新任务到达时用（λ, μ 仿射口径的）边际分 decide()。纯确定、无内部
 * 时钟——重放同一 (updates, candidates) 序列恒产同一决策序列。
 */
export class ShadowPriceAdmissionController {
  private readonly ewmaAlpha: number;
  private readonly reservePrice: number;
  private readonly verifyMode: AdmissionVerifyMode;
  private readonly counterfactualSolver: CounterfactualSolver | undefined;
  private readonly ewma = new Map<string, EwmaState>();
  private lastDualCertified: boolean | null = null;
  private readonly metrics = {
    decisions: 0,
    admissions: 0,
    rejections: 0,
    exactVerifications: 0,
    unverifiedConservativeRejections: 0,
  };

  constructor(config: AdmissionControlConfig) {
    // 入口只校验值域；类型外垃圾（null/字符串等）由下方字段级 typeof 检查
    // 具名拒绝（对 null 解构直接 TypeError——typed 契约外的输入不做面子工程）
    const { ewmaAlpha, reservePrice, verify, counterfactual } = config;
    // NaN/越界 α 会把 EWMA 状态一次性打成不可逆 NaN（NaN 比较恒 false
    // 击穿一切惰性守卫），下游只能看到不指名来源的垃圾决策——入口点名。
    if (
      typeof ewmaAlpha !== 'number' ||
      !Number.isFinite(ewmaAlpha) ||
      ewmaAlpha <= 0 ||
      ewmaAlpha > 1
    ) {
      throw new MechanismError(
        `ShadowPriceAdmissionController: ewmaAlpha must be a finite number in (0, 1], got ${String(ewmaAlpha)}`,
      );
    }
    if (typeof reservePrice !== 'number' || !Number.isFinite(reservePrice) || reservePrice < 0) {
      throw new MechanismError(
        `ShadowPriceAdmissionController: reservePrice must be a finite number ≥ 0, got ${String(reservePrice)}`,
      );
    }
    // verify 域（R17-B）：省缺 = 'exact'（严格正向缺省）；非法值点名。
    // 先落 unknown 再集合判定——直接对声明类型比字面量会被流分析收窄成
    // 「恒假」（与 assertCounterfactualResult 同一手法）。
    const verifyRaw: unknown = verify;
    if (verifyRaw !== undefined && verifyRaw !== 'dual' && verifyRaw !== 'exact') {
      // 只对安全可字符串化的原语走 String()；object/function 退化成
      // '[object Object]'——点名 typeof
      const shown: string =
        typeof verifyRaw === 'string' ||
        typeof verifyRaw === 'number' ||
        typeof verifyRaw === 'bigint' ||
        typeof verifyRaw === 'boolean' ||
        typeof verifyRaw === 'symbol'
          ? String(verifyRaw)
          : `[${typeof verifyRaw}]`;
      throw new MechanismError(
        `ShadowPriceAdmissionController: verify must be 'dual' or 'exact', got ${shown} (typeof ${typeof verifyRaw})`,
      );
    }
    if (counterfactual !== undefined && typeof counterfactual !== 'function') {
      throw new MechanismError(
        `ShadowPriceAdmissionController: counterfactual must be a function, got ${typeof counterfactual}`,
      );
    }
    this.ewmaAlpha = ewmaAlpha;
    this.reservePrice = reservePrice;
    this.verifyMode = verify ?? 'exact';
    this.counterfactualSolver = counterfactual;
  }

  /**
   * 折入一批对偶读数（EWMA 平滑）。首报 agent 直接初始化（无合成先验）；
   * 未出现在本批的 agent 保留旧值（显式选择：不做缺失衰减，价格只在
   * 有读数时移动）。dualCertified 记为最近一批的证书状态。
   */
  update(report: CapacityDualReport): void {
    if (typeof report.dualCertified !== 'boolean') {
      throw new MechanismError(
        `ShadowPriceAdmissionController.update: dualCertified must be a boolean, got ${String(report.dualCertified)}`,
      );
    }
    if (!Array.isArray(report.agents)) {
      throw new MechanismError(
        `ShadowPriceAdmissionController.update: agents must be an array, got ${typeof report.agents}`,
      );
    }
    const entries = report.agents as readonly AgentShadowPrice[]; // Array.isArray 收窄成 any[]——回到声明口径
    const seen = new Set<string>();
    for (const agent of entries) {
      assertAgentId(agent.agentId, 'ShadowPriceAdmissionController.update: agent agentId');
      if (seen.has(agent.agentId)) {
        throw new MechanismError(
          `ShadowPriceAdmissionController.update: duplicate agentId in report: ${agent.agentId}`,
        );
      }
      seen.add(agent.agentId);
      assertFiniteNonNegative(
        agent.shadowPrice,
        `ShadowPriceAdmissionController.update: agent ${agent.agentId} shadowPrice`,
      );
      if (typeof agent.saturated !== 'boolean') {
        throw new MechanismError(
          `ShadowPriceAdmissionController.update: agent ${agent.agentId} saturated must be a boolean, got ${String(agent.saturated)}`,
        );
      }
    }
    // 校验全部前置（validate-then-mutate）：任何拒绝都零残留
    for (const agent of entries) {
      const state = this.ewma.get(agent.agentId);
      if (state) {
        state.value += this.ewmaAlpha * (agent.shadowPrice - state.value);
      } else {
        this.ewma.set(agent.agentId, { value: agent.shadowPrice });
      }
    }
    this.lastDualCertified = report.dualCertified;
  }

  /**
   * 准入判定：admit ⟺ max_a(score_a − ρ̄_a) > reservePrice（严格大于，
   * 并列拒绝——边界确定）。无候选 agent 时拒绝且 margin = null。
   * scores 引用从未报告过的 agent：按冷启动口径价格 0 评估并标记
   * hasHistory = false（新 agent 无拥堵记录，不惩罚）。
   *
   * R17-B（verify='exact'，缺省）：边际测试想拒且证书条件不成立
   * （borderline）时——接了回调：决策交给反事实测量
   * （admitWelfare > rejectWelfare ⟹ 放行），certificate='exact'；
   * 未接回调：保持保守拒绝，reason='unverified-conservative' 具名
   * 披露。放行判定与 dual-certified 拒绝不触发回调（P1/P2 各自有
   * 证明，不必花钱测）。verify='dual'：R14-I 语义逐字保留。
   */
  decide(candidate: AdmissionCandidate): AdmissionDecision {
    assertAgentId(candidate.taskId, 'ShadowPriceAdmissionController.decide: taskId');
    if (!Array.isArray(candidate.scores)) {
      throw new MechanismError(
        `ShadowPriceAdmissionController.decide: scores must be an array, got ${typeof candidate.scores}`,
      );
    }
    const scores = candidate.scores as readonly CandidateScore[]; // Array.isArray 收窄成 any[]——回到声明口径
    const seen = new Set<string>();
    for (const entry of scores) {
      assertAgentId(entry.agentId, 'ShadowPriceAdmissionController.decide: score agentId');
      if (seen.has(entry.agentId)) {
        throw new MechanismError(
          `ShadowPriceAdmissionController.decide: duplicate agentId in candidate ${candidate.taskId}: ${entry.agentId}`,
        );
      }
      seen.add(entry.agentId);
      if (typeof entry.score !== 'number' || !Number.isFinite(entry.score)) {
        throw new MechanismError(
          `ShadowPriceAdmissionController.decide: score for agent ${entry.agentId} must be a finite number, got ${String(entry.score)}`,
        );
      }
    }

    const certificate: AdmissionCertificate =
      this.lastDualCertified === null
        ? 'no-history'
        : this.lastDualCertified
          ? 'dual-certified'
          : 'conservative';

    const evaluated: AdmissionEvaluation[] = scores.map((entry) => {
      const state = this.ewma.get(entry.agentId);
      const shadowPrice = state ? state.value : 0;
      return {
        agentId: entry.agentId,
        score: entry.score,
        shadowPrice,
        marginal: entry.score - shadowPrice,
        hasHistory: state !== undefined,
      };
    });

    let best: AdmissionEvaluation | null = null;
    for (const e of evaluated) {
      if (best === null || e.marginal > best.marginal) best = e;
    }
    if (best === null) {
      return this.finish({
        taskId: candidate.taskId,
        admitted: false,
        reason: 'no-candidate-agents',
        certificate,
        effectiveMargin: null,
        reservePrice: this.reservePrice,
        best: null,
        evaluated,
        counterfactual: null,
      });
    }
    const effectiveMargin = best.marginal - this.reservePrice;
    if (effectiveMargin > 0) {
      // 放行侧（P1 路径）：证明不依赖测量，不触发回调、不换证书。
      return this.finish({
        taskId: candidate.taskId,
        admitted: true,
        reason: 'admitted',
        certificate,
        effectiveMargin,
        reservePrice: this.reservePrice,
        best,
        evaluated,
        counterfactual: null,
      });
    }
    // 边际测试想拒。dual-certified（P2 证书）/no-history（纯保留价政策
    // 拒绝）各自有零错据，不必测量；conservative 是 borderline：
    if (this.verifyMode === 'exact' && certificate === 'conservative') {
      if (this.counterfactualSolver) {
        // 成本账先记（尝试即成本：回调抛错/结果被具名拒绝都已付求解）。
        this.metrics.exactVerifications += 1;
        const measured = this.counterfactualSolver(candidate); // 抛错原样透传
        const { admitWelfare, rejectWelfare } = assertCounterfactualResult(
          measured,
          candidate.taskId,
        );
        const admitted = admitWelfare > rejectWelfare; // 并列拒——与模块严格大于约定一致
        return this.finish({
          taskId: candidate.taskId,
          admitted,
          reason: admitted ? 'admitted' : 'below-reserve-price',
          certificate: 'exact',
          effectiveMargin,
          reservePrice: this.reservePrice,
          best,
          evaluated,
          counterfactual: {
            admitWelfare,
            rejectWelfare,
            welfareDelta: admitWelfare - rejectWelfare,
          },
        });
      }
      // 无回调的退化语义：决策与 conservative 相同，但具名披露未验证。
      return this.finish({
        taskId: candidate.taskId,
        admitted: false,
        reason: 'unverified-conservative',
        certificate: 'conservative',
        effectiveMargin,
        reservePrice: this.reservePrice,
        best,
        evaluated,
        counterfactual: null,
      });
    }
    return this.finish({
      taskId: candidate.taskId,
      admitted: false,
      reason: 'below-reserve-price',
      certificate,
      effectiveMargin,
      reservePrice: this.reservePrice,
      best,
      evaluated,
      counterfactual: null,
    });
  }

  /** 记账后原样返回（decisions = admissions + rejections 恒等式在此成立） */
  private finish(d: AdmissionDecision): AdmissionDecision {
    this.metrics.decisions += 1;
    if (d.admitted) this.metrics.admissions += 1;
    else this.metrics.rejections += 1;
    if (d.reason === 'unverified-conservative') {
      this.metrics.unverifiedConservativeRejections += 1;
    }
    return d;
  }

  /** 观测指标快照（冻结副本——调用方改不动内部账） */
  getMetrics(): AdmissionMetrics {
    return Object.freeze({ ...this.metrics });
  }

  /** 某 agent 当前的平滑影子价格（从未报告过为 null——观测面，判定不依赖它） */
  getSmoothedPrice(agentId: string): number | null {
    const state = this.ewma.get(agentId);
    return state ? state.value : null;
  }

  /** 是否已有任何对偶历史（冷启动探针） */
  hasHistory(): boolean {
    return this.lastDualCertified !== null;
  }
}
