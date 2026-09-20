/**
 * SequentialHiringAudit —— 逐 (agent, 能力) 序贯雇佣审计（R19-R 创新 2，opt-in）
 *
 * ============ 定位（与既有雇佣面的分工，诚实边界） ============
 *
 * BayesianHireBrain（R14-C + R17-D）对每个 (agent, capability) 维护 Beta
 * 后验并按策略（thompson/greedy/ucb1/portfolio-Hedge）分配任务，但它的
 * 全部判定都是**无限期持续**的：凭证是否校准、后验是否与结算流一致，
 * 没有停止规则，也没有逐次误差控制。Hedge（R17-D）解决的是「选哪个
 * 策略」，对「每个格子的凭证-观测校准是否已被证伪」不置一词。
 *
 * 本模块补这一层：对每个格子 (agentId, capability) 独立挂一台
 * SprtCalibrationGate（R18-C 创新 1 的复用，零改动）——
 *
 *   零假设 H0：结算流 ~ Bernoulli(base)（base = 注册时申报的凭证质量：
 *               「该 agent 该能力的成功率就是凭证所说的值」）；
 *   备择 H1：   学习曲线混合 p(k) = base + m̄(k)·(1−base)（与 CompoundBrain
 *               fitGrid 同一似然族——格子审计的是「静态凭证模型 vs 学习
 *               曲线模型」哪个更好地解释结算流）。
 *
 * 它是**纯审计面**：不分配任务、不改支付、不动后验、不碰策略选择——
 * 宿主把结算观测 (k, success) 喂进来（k 取结算前已知经验水平：可料
 * 序列，定理 1 的入口条件），读出逐格子的停止时刻与四态判决
 * （rejectNull = 凭证被证伪/检出学习；acceptNull = 混合备择被拒；
 * truncated = 不决；continue = 运行中）。
 *
 * ============ 精确主张（全部继承 SprtCalibrationGate，零新定理） ============
 *
 * - **逐格第一类误差** ≤ α/(1−β)，α = α_family/m（Bonferroni 等分，
 *   m = plannedCells）：门自身的定理 1（截断门、无近似）。
 * - **族误差面（定理 4）**：m 个格子观测流互不相交（每次结算恰属一个
 *   格子——宿主接线保证），真实零假设族中任一格判 rejectNull 的概率
 *   ≤ Σ_{i∈I₀} α_i/(1−β) ≤ α_family/(1−β_max)（等分时精确 union bound）。
 *   **超编拒绝**：注册第 m+1 格指名报错——族界的分母是申报的 m，
 *   静默超编会让 union bound 失效。
 * - **逐格第二类/停时界**：见 sprt-calibration-gate 模块头定理 2/3
 *   （本模块不改任何统计量，只做路由与快照）。
 *
 * ============ 诚实边界（不主张什么） ============
 *
 * - **只审计校准，不做雇佣决策**：判决不触发 hire/fire/策略切换——
 *   「审计判 rejectNull 之后怎么办」是宿主的策略选择（与 Hedge 正交：
 *   那是选择层，这是校准层；接线示例见测试的正交性钉板：接入审计
 *   前后 BayesianHireBrain 终态逐位相同）。
 * - **base 是宿主申报值**：凭证虚高时 H0 不真，第一类界不成立——
 *   此时高拒绝率是审计**检出**校准失效（测试的虚报凭证定罪），
 *   不是缺陷。
 * - **k 的口径由宿主定义**：本模块只要求 k ≥ 0 有限且可料（结算前
 *   已知）；用 attempts、资本或任何宿主经验量都可以，语义随宿主。
 * - truncated 是不决非错误；不决格子宿主可续跑（换新审计）或接受
 *   不可判定。
 * - 观测流不相交性由接线保证：同一结算喂给两个格子会让 union bound
 *   失效（模块无法检测，如实声明）。
 *
 * ============ 确定性契约 ============
 *
 * 纯决策内核：无随机源、无时钟、无 IO。同一注册序＋同一观测序列 ⟹
 * 同一 λ 轨迹与判决，逐位可复现。格子按注册序在 cells() 中稳定排列。
 */

import {
  SprtCalibrationGate,
  DEFAULT_SPRT_COMPONENTS,
  sprtTypeOneUpperBound,
  type SprtComponent,
  type SprtDecision,
} from './sprt-calibration-gate.js';
import {
  ConfigurationError,
  MechanismError,
  NumericDomainError,
  StateError,
} from '../utils/errors.js';

// ----------------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------------

export interface HiringAuditConfig {
  /** 族第一类误差目标 α_family ∈ (0,1)（m 格 Bonferroni 等分） */
  familyLevel: number;
  /** 逐格第二类误差目标 β ∈ (0,1)（门的名义水平） */
  typeTwo: number;
  /** 逐格截断上界 N ≥ 1（到达判 truncated：不决） */
  maxObservations: number;
  /** 备择分量集（缺省 = SPRT 门的 16 分量网格） */
  components: readonly SprtComponent[];
  /** 族规模 m（Bonferroni 分母；注册第 m+1 格指名拒绝） */
  plannedCells: number;
}

export const DEFAULT_HIRING_AUDIT_CONFIG: HiringAuditConfig = {
  familyLevel: 0.05,
  typeTwo: 0.02,
  maxObservations: 600,
  components: DEFAULT_SPRT_COMPONENTS,
  plannedCells: 8,
};

/** 逐格子审计快照（SprtGateSnapshot 的审计路由面；口径一致） */
export interface HireAuditCellSnapshot {
  agentId: string;
  capability: string;
  /** 注册时申报的凭证基准（H0 的 Bernoulli 参数） */
  base: number;
  decision: SprtDecision;
  /** 已消费观测数 */
  observations: number;
  /** 终判时刻（终判 = 恰好停在这里；运行中 = null） */
  stoppedAtObservations: number | null;
  /** 运行对数似然比 λ_n */
  logLikelihoodRatio: number;
  logUpperBoundary: number;
  logLowerBoundary: number;
  /** 已实现最大单步 |增量|（停时界的过冲常数） */
  maxAbsIncrement: number;
  /** 逐分量第二类误差上界（分量序 = 构造序） */
  componentTypeTwoUpperBounds: readonly number[];
  /** 本格的 Bonferroni 等分 typeOne = α_family/m */
  perCellTypeOne: number;
  /** 本格第一类误差上界 α/(1−β) */
  perCellTypeOneUpperBound: number;
}

/** 格子的运行时状态（门 + 身份） */
interface CellRuntime {
  agentId: string;
  capability: string;
  base: number;
  gate: SprtCalibrationGate;
}

const BASE_MIN = 1e-6;
const BASE_MAX = 1 - 1e-6;

function cellKey(agentId: string, capability: string): string {
  return `${agentId}/${capability}`;
}

// ----------------------------------------------------------------------------
// SequentialHiringAudit
// ----------------------------------------------------------------------------

export class SequentialHiringAudit {
  private readonly config: HiringAuditConfig;
  /** 注册序保持稳定（cells() 的排列口径） */
  private readonly cellsInOrder: CellRuntime[] = [];
  private readonly byKey = new Map<string, CellRuntime>();
  private readonly perCellTypeOne: number;

  constructor(config: Partial<HiringAuditConfig> = {}) {
    const merged: HiringAuditConfig = { ...DEFAULT_HIRING_AUDIT_CONFIG, ...config };
    if (
      typeof merged.familyLevel !== 'number' ||
      !Number.isFinite(merged.familyLevel) ||
      merged.familyLevel <= 0 ||
      merged.familyLevel >= 1
    ) {
      throw new ConfigurationError(
        `HiringAuditConfig.familyLevel must be within open interval (0, 1), got ${String(merged.familyLevel)}`,
      );
    }
    if (
      typeof merged.typeTwo !== 'number' ||
      !Number.isFinite(merged.typeTwo) ||
      merged.typeTwo <= 0 ||
      merged.typeTwo >= 1
    ) {
      throw new ConfigurationError(
        `HiringAuditConfig.typeTwo must be within open interval (0, 1), got ${String(merged.typeTwo)}`,
      );
    }
    if (
      typeof merged.maxObservations !== 'number' ||
      !Number.isInteger(merged.maxObservations) ||
      merged.maxObservations < 1
    ) {
      throw new ConfigurationError(
        `HiringAuditConfig.maxObservations must be an integer ≥ 1, got ${String(merged.maxObservations)}`,
      );
    }
    if (
      typeof merged.plannedCells !== 'number' ||
      !Number.isInteger(merged.plannedCells) ||
      merged.plannedCells < 1
    ) {
      throw new ConfigurationError(
        `HiringAuditConfig.plannedCells must be an integer ≥ 1, got ${String(merged.plannedCells)}`,
      );
    }
    // 分量表先经一次门构造校验（域错误在构造期暴露，不在首格注册期）
    new SprtCalibrationGate({
      typeOne: 0.5,
      typeTwo: merged.typeTwo,
      maxObservations: merged.maxObservations,
      components: merged.components,
    });
    this.config = merged;
    this.perCellTypeOne = merged.familyLevel / merged.plannedCells;
  }

  /** 注册审计格子：base = 申报凭证质量（H0 的 Bernoulli 参数） */
  registerCell(agentId: string, capability: string, base: number): this {
    if (typeof agentId !== 'string' || agentId.length === 0) {
      throw new ConfigurationError(
        `SequentialHiringAudit.registerCell() agentId must be a non-empty string, got ${String(agentId)}`,
      );
    }
    if (typeof capability !== 'string' || capability.length === 0) {
      throw new ConfigurationError(
        `SequentialHiringAudit.registerCell() capability must be a non-empty string, got ${String(capability)}`,
      );
    }
    if (typeof base !== 'number' || !Number.isFinite(base) || base < BASE_MIN || base > BASE_MAX) {
      throw new NumericDomainError(
        `SequentialHiringAudit.registerCell() base must be within [${BASE_MIN}, ${BASE_MAX}] ` +
          `(the declared credential level), got ${String(base)}`,
      );
    }
    const key = cellKey(agentId, capability);
    if (this.byKey.has(key)) {
      throw new MechanismError(
        `SequentialHiringAudit: cell '${key}' is already registered (re-registration would ` +
          'silently reset its SPRT statistic)',
      );
    }
    if (this.cellsInOrder.length >= this.config.plannedCells) {
      throw new ConfigurationError(
        `SequentialHiringAudit: family is full at plannedCells=${this.config.plannedCells} ` +
          '(the Bonferroni union bound is priced for exactly m gates — enlarge plannedCells ' +
          'in the constructor to audit more cells)',
      );
    }
    const gate = new SprtCalibrationGate({
      typeOne: this.perCellTypeOne,
      typeTwo: this.config.typeTwo,
      maxObservations: this.config.maxObservations,
      components: this.config.components,
    });
    const cell: CellRuntime = { agentId, capability, base, gate };
    this.cellsInOrder.push(cell);
    this.byKey.set(key, cell);
    return this;
  }

  /**
   * 喂入一次结算观测：(结算前经验水平 k, 成败)。k 须可料（由历史决定）——
   * 定理 1 的入口条件；终判后的迟到观测指名拒绝（含格子身份与停止时刻）。
   */
  observe(agentId: string, capability: string, k: number, success: boolean): HireAuditCellSnapshot {
    const key = cellKey(agentId, capability);
    const cell = this.byKey.get(key);
    if (!cell) {
      throw new StateError(`SequentialHiringAudit: no audit cell '${key}' (registerCell it first)`);
    }
    if (typeof k !== 'number' || !Number.isFinite(k) || k < 0) {
      throw new NumericDomainError(
        `SequentialHiringAudit.observe() cell '${key}' k must be a finite non-negative number, ` +
          `got ${String(k)}`,
      );
    }
    if (typeof success !== 'boolean') {
      throw new NumericDomainError(
        `SequentialHiringAudit.observe() cell '${key}' success must be a boolean, ` +
          `got ${typeof success}`,
      );
    }
    const pre = cell.gate.getState();
    if (pre.decision !== 'continue') {
      throw new StateError(
        `SequentialHiringAudit: cell '${key}' is terminal ('${pre.decision}', stopped at ` +
          `${pre.observations} observations) — late observations would silently corrupt the ` +
          'stopped statistic',
      );
    }
    cell.gate.observe(cell.base, k, success);
    return this.snapshotOf(cell);
  }

  /** 单格快照（未注册指名拒绝） */
  cellSnapshot(agentId: string, capability: string): HireAuditCellSnapshot {
    const cell = this.byKey.get(cellKey(agentId, capability));
    if (!cell) {
      throw new StateError(
        `SequentialHiringAudit: no audit cell '${cellKey(agentId, capability)}' (registerCell it first)`,
      );
    }
    return this.snapshotOf(cell);
  }

  /** 全部格子快照（注册序） */
  cells(): HireAuditCellSnapshot[] {
    return this.cellsInOrder.map((cell) => this.snapshotOf(cell));
  }

  /** 已注册格子数（≤ plannedCells） */
  registeredCells(): number {
    return this.cellsInOrder.length;
  }

  /**
   * 族第一类误差上界（定理 4）：m 格等分下的 union bound
   * Σ_i α_i/(1−β) = α_family/(1−β)。
   */
  familyTypeOneUpperBound(): number {
    return sprtTypeOneUpperBound(this.config.familyLevel, this.config.typeTwo);
  }

  private snapshotOf(cell: CellRuntime): HireAuditCellSnapshot {
    const s = cell.gate.getState();
    return {
      agentId: cell.agentId,
      capability: cell.capability,
      base: cell.base,
      decision: s.decision,
      observations: s.observations,
      stoppedAtObservations: s.decision === 'continue' ? null : s.observations,
      logLikelihoodRatio: s.logLikelihoodRatio,
      logUpperBoundary: s.logUpperBoundary,
      logLowerBoundary: s.logLowerBoundary,
      maxAbsIncrement: s.maxAbsIncrement,
      componentTypeTwoUpperBounds: s.componentTypeTwoUpperBounds,
      perCellTypeOne: this.perCellTypeOne,
      perCellTypeOneUpperBound: sprtTypeOneUpperBound(this.perCellTypeOne, this.config.typeTwo),
    };
  }
}
