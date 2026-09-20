/**
 * execution-tier-dual —— 执行层级双画像（R19 创新，opt-in）
 *
 * ============ 定位 ============
 *
 * execution-tier.ts 的三态决策（nisq / ftqc-queue / classical）以 ft-estimate
 * 的**串行** FT 画像为预算依据。commutation-ft.ts（R18）证明了同假设下
 * 把每层旋转按「不共享逻辑比特」分组可精确/近似缩减综合征轮数（定理 C：
 * T 计数逐字节不变）。本模块在**不改任何既有决策面**的前提下，把这两份
 * FT 资源账并列交给调用方：决策原样（串行口径），并行画像随行（对读）。
 *
 * 与 R18 候选设计（「ftqc-queue 的 reason 带缩减因子，~60 行，改
 * execution-tier.ts」）的差异是刻意的：本波先验纪律冻结既有文件，双画像
 * 落在新函数/新文件，reason 不动——缩减因子走本模块的 note 字段。
 *
 * ============ 精确主张（可证伪） ============
 *
 * 命题 1（决策面零变化）：对任意输入，
 *   decideExecutionTierDual(req).decision ≡ decideExecutionTier(计数口径 req')
 * 逐字节相同。构造保证：单一委托调用（couplingEdges.length 作 couplings），
 * 不向既有输出并列任何新字段；测试以 deepEqual 钉死。
 *
 * 命题 2（串行账逐字节继承）：ftDual.serial ≡ decision.ftqc。构造保证：
 * 并行画像以 decision.ftqc.code（selectFtCode 的**串行**选码结果）与同一
 * profile、同一 assumptions 假设集调用 estimateFtCircuit——两条路径唯一可
 * 分歧的自由度（码/深度/耦合计数/假设）被构造消零；测试以 deepEqual 钉死。
 *
 * 命题 3（定理 C 在决策缝上的继承）：ftDual.parallel.tGatesTotal、
 * epsilonDistillation、physicalQubits、blocks 与 serial **逐字节相同**；
 * syndromeRoundsTotal、epsilonChannel、wallTimeMs 按
 *   (groups + 1) / (E + 2·nq)
 * 线性缩减。全部数值路径来自 commutation-ft 的 parallelEstimateFtCircuit
 * （其内部自带定理 C 恒等式的测试钉板），本缝不引入任何新的数值计算。
 *
 * ============ 诚实的边界 ============
 *
 * - **tier 决策冻结在串行口径**：并行画像不回写决策。classical 回退下
 *   并行账达标只是对读信息（测试构造了「串行全距离超预算、并行账达标、
 *   tier 仍 classical」的情形钉死不回写）。深层原因：码选择
 *   （selectFtCode）按串行可行性扫描，若按并行口径重选码，决策面就
 *   变成并行性依赖——那是对既有面的改写，不是 opt-in。
 * - 并行画像继承 commutation-ft 的全部诚实边界：逻辑层综合征轮抽象
 *   （面码格点手术的几何形状/路由开销不建模，乐观下界方向）、门级
 *   Trotter 编译器串行化时不兑现该并行性。本模块不重复声明细节，
 *   见 commutation-ft.ts 文件头。
 * - couplingEdges 仅在 FT 双画像路径被消费与校验（nisq 判定只读计数——
 *   与既有决策面完全同构）：越界/重边/未归一化边由 parallelizeLayer
 *   具名拒绝，本层不拦截、不吞错。
 * - 退火型提交（circuitDepth 省略）继承既有口径：深度按 1 测（保守
 *   下界），双画像同口径对读。
 * - 分组算法继承 parallelizeLayer 缺省 'auto'（二部走 Kőnig 精确、一般
 *   图走 First-Fit，gap 如实上报）；无 RNG、无 IO、无 import 副作用，
 *   输出确定。
 *
 * ============ 文献接地（形状级，〔待双源〕） ============
 *
 * - Vizing 1964/1965 边着色上下界 χ′ ∈ {Δ, Δ+1}〔待双源〕
 * - Kőnig 1916 前后「二部图边色数 = 最大度」〔待双源〕
 * - Litinski 2019 前后 "game of surface codes" 族（格点手术并行 Pauli
 *   测量）〔待双源〕
 */

import { decideExecutionTier } from './execution-tier.js';
import type { ExecutionTierDecision, NisqProfile } from './execution-tier.js';
import { parallelizeLayer, parallelEstimateFtCircuit } from './commutation-ft.js';
import type { LayerPartition } from './commutation-ft.js';
import type { CouplingEdge } from './commutation-ft.js';
import type { FtEstimate, FtEstimateAssumptions } from './ft-estimate.js';

/**
 * 双画像入参：与 ExecutionTierRequest 同形，但耦合以**边集**给出——
 * 并行分组需要知道「哪两个比特耦合」，计数（couplings）无法承载。
 * 计数口径由本模块从边集长度导出（命题 1 的构造保证）。
 */
export interface ExecutionTierDualRequest {
  /** 逻辑量子比特数（调度问题：任务数 × agent 数） */
  readonly logicalQubits: number;
  /** Ising 耦合边集（q1 < q2 归一化、简单图）；仅 FT 双画像路径消费 */
  readonly couplingEdges: readonly CouplingEdge[];
  /** 电路深度（QAOA 层数 p）；退火型提交可省略（按 1 测，与既有口径一致） */
  readonly circuitDepth?: number;
  /** 覆盖默认 NISQ 轮廓 */
  readonly nisq?: Partial<NisqProfile>;
  /** 覆盖默认容错假设（含错误预算） */
  readonly ft?: Partial<FtEstimateAssumptions>;
}

/** FT 双画像：commutation-ft 的并行账 + 对读注记（决策缝不产生新数值） */
export interface ExecutionTierFtDual {
  /** 串行画像（≡ decision.ftqc，命题 2） */
  readonly serial: FtEstimate;
  /** 并行画像（同码、同假设；定理 C 恒等式见 commutation-ft） */
  readonly parallel: FtEstimate;
  /** 匹配分解（组数/下界/gap/算法全公开） */
  readonly partition: LayerPartition;
  /** serial.syndromeRoundsTotal / parallel.syndromeRoundsTotal */
  readonly roundsReductionFactor: number;
  /**
   * 对读注记：组数、缩减因子、双侧 meetsBudget（信息性——并行达标
   * 不构成改判，见诚实边界第 1 条）
   */
  readonly note: string;
}

export interface ExecutionTierDualDecision {
  /** 既有三态决策，逐字节零变化（命题 1） */
  readonly decision: ExecutionTierDecision;
  /**
   * FT 双画像：decision.ftqc 存在时（nisq 装不下）必有；nisq 判定时
   * undefined——FT 账不是 nisq 决策的一部分（镜像规则，不补算）
   */
  readonly ftDual?: ExecutionTierFtDual;
}

/**
 * 执行层级双画像：决策照旧（串行口径、逐字节不变），并行 FT 账随行。
 * 对同一线路给出「ft-estimate 串行模型」与「commutation-ft 并行模型」
 * 两份资源账的并列输出。
 */
export function decideExecutionTierDual(
  request: ExecutionTierDualRequest,
): ExecutionTierDualDecision {
  // 命题 1：单一委托，计数口径从边集导出；circuitDepth/nisq/ft 只在
  // 显式给出时转发（exactOptionalPropertyTypes 下 undefined 不可显式赋值）
  const decision = decideExecutionTier({
    logicalQubits: request.logicalQubits,
    couplings: request.couplingEdges.length,
    ...(request.circuitDepth !== undefined ? { circuitDepth: request.circuitDepth } : {}),
    ...(request.nisq !== undefined ? { nisq: request.nisq } : {}),
    ...(request.ft !== undefined ? { ft: request.ft } : {}),
  });
  if (decision.ftqc === undefined) {
    // nisq 判定：FT 账不在决策面内，双画像不补算（镜像规则）
    return { decision };
  }

  // 深度口径与决策完全一致（退火型提交 ?? 1——保守下界）
  const depth = request.circuitDepth ?? 1;
  const nq = request.logicalQubits;
  const edges = request.couplingEdges;
  // 边集校验在 parallelizeLayer 内具名完成（越界/重边/未归一化），
  // 本层不拦截——走私定罪面与 commutation-ft 保持单一
  const partition = parallelizeLayer(nq, edges);
  const dual = parallelEstimateFtCircuit(
    { logicalQubits: nq, couplings: edges.length, depth },
    decision.ftqc.code,
    partition,
    request.ft,
  );

  const serialRotationsPerLayer = edges.length + 2 * nq;
  const note =
    `tier=${decision.tier} stays on the serial basis; ` +
    `parallel account: ${partition.groupCount} matching groups + 1 mixer round per layer ` +
    `vs ${serialRotationsPerLayer} serial rotations ` +
    `(reduction x${dual.roundsReductionFactor.toFixed(2)}); ` +
    `meetsBudget serial=${String(decision.ftqc.meetsBudget)} ` +
    `parallel=${String(dual.parallel.meetsBudget)} (informational, not a re-decision)`;

  return {
    decision,
    ftDual: {
      serial: dual.serial,
      parallel: dual.parallel,
      partition: dual.partition,
      roundsReductionFactor: dual.roundsReductionFactor,
      note,
    },
  };
}
