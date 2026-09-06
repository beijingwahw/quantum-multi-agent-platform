/**
 * execution-tier —— 执行层级路由器：NISQ 直发 / FTQC 排队 / 经典回退（v1.11 引入）
 *
 * ============ 定位 ============
 *
 * 调度任务提交量子引擎前先过这里：估算器（ft-estimate.ts）出数字，
 * 路由器出决策。
 *
 *   nisq        —— 装得下 NISQ 档位（比特数与电路深度都在轮廓内）：直发；
 *   ftqc-queue  —— NISQ 装不下，但容错资源估算在错误预算内：转 FTQC 等待
 *                  队列（solve 层抛 FtqcDeferredError，画像随行）；
 *   classical   —— NISQ 装不下且容错估算超预算：回退本地精确引擎
 *                  （约束子空间绝热演化——本仓库最强的经典精确求解路径）。
 *
 * ============ 决策规则（显式、可测） ============
 *   1. qubitsOk = 逻辑比特数 ≤ NISQ 轮廓 maxQubits；
 *      depthOk = 电路深度 ≤ maxCircuitDepth（退火型提交无层数概念，
 *      circuitDepth 省略时只查比特装载）；
 *   2. 两者皆过 → nisq；
 *   3. 否则跑码选择估算（surface 距离扫描 vs gross [[144,12,12]]）：
 *      预算内可行 → ftqc-queue；不可行 → classical。
 *
 * ============ 诚实的边界 ============
 * - NISQ 轮廓默认值（133 比特 / p≤10）是可配置的档位示意：门型 NISQ
 *   单芯片物理比特量级与相干深度共识，估算器只看数字不看机器名。
 * - 估算假设全部显式（FtEstimateAssumptions），改假设即改决策。
 * - 路由器不隐藏失败：classical 的 reason 带出超预算的具体 eps 值。
 */

import { selectFtCode, DEFAULT_FT_ASSUMPTIONS } from './ft-estimate.js';
import type { FtEstimate, FtEstimateAssumptions } from './ft-estimate.js';

/** solve 层路由入参：规模（比特/耦合）由调度问题自动导出，这里只给档位与深度 */
export interface ExecutionTierRouting {
  /** 电路深度（QAOA 层数 p）；退火型提交可省略（只查比特装载） */
  readonly circuitDepth?: number;
  /** 覆盖默认 NISQ 轮廓 */
  readonly nisq?: Partial<NisqProfile>;
  /** 覆盖默认容错假设（含错误预算） */
  readonly ft?: Partial<FtEstimateAssumptions>;
}

/** NISQ 档位轮廓：比特装载上限 + 相干电路深度上限 */
export interface NisqProfile {
  readonly maxQubits: number;
  readonly maxCircuitDepth: number;
}

/**
 * 默认 NISQ 轮廓：133 物理/逻辑比特量级、QAOA 深度 p ≤ 10
 * （NISQ 相干深度共识——容错深度 QAOA 路线正是把 p 推到 >100）。
 */
export const DEFAULT_NISQ_PROFILE: NisqProfile = { maxQubits: 133, maxCircuitDepth: 10 };

export type ExecutionTier = 'nisq' | 'ftqc-queue' | 'classical';

export interface ExecutionTierRequest {
  /** 逻辑量子比特数（调度问题：任务数 × agent 数） */
  readonly logicalQubits: number;
  /** Ising 耦合项数 */
  readonly couplings: number;
  /** 电路深度（QAOA 层数 p）；退火型提交可省略（只查比特装载） */
  readonly circuitDepth?: number;
  /** 覆盖默认 NISQ 轮廓 */
  readonly nisq?: Partial<NisqProfile>;
  /** 覆盖默认容错假设（含错误预算） */
  readonly ft?: Partial<FtEstimateAssumptions>;
}

export interface ExecutionTierDecision {
  readonly tier: ExecutionTier;
  readonly reason: string;
  /** NISQ 装载检查明细 */
  readonly nisqFit: {
    readonly qubitsOk: boolean;
    readonly depthOk: boolean;
    readonly checkedDepth: boolean;
  };
  /** FTQC 画像（tier = ftqc-queue / classical 时必有） */
  readonly ftqc?: FtEstimate;
}

function resolveProfile(request: ExecutionTierRequest): NisqProfile {
  return {
    maxQubits: request.nisq?.maxQubits ?? DEFAULT_NISQ_PROFILE.maxQubits,
    maxCircuitDepth: request.nisq?.maxCircuitDepth ?? DEFAULT_NISQ_PROFILE.maxCircuitDepth,
  };
}

/** 三态决策：估算器决定该任务发 NISQ、等 FTQC、还是回退经典。 */
export function decideExecutionTier(request: ExecutionTierRequest): ExecutionTierDecision {
  const profile = resolveProfile(request);
  const qubitsOk = request.logicalQubits <= profile.maxQubits;
  const checkedDepth = request.circuitDepth !== undefined;
  const depthOk = !checkedDepth || request.circuitDepth <= profile.maxCircuitDepth;

  if (qubitsOk && depthOk) {
    return {
      tier: 'nisq',
      reason:
        `fits NISQ profile: ${request.logicalQubits} qubits <= ${profile.maxQubits}` +
        (checkedDepth
          ? `, depth ${request.circuitDepth} <= ${profile.maxCircuitDepth}`
          : ' (annealer-style, depth unchecked)'),
      nisqFit: { qubitsOk, depthOk, checkedDepth },
    };
  }

  // NISQ 装不下 → 容错画像（退火型提交无层数概念，按单层 Ising 测量计，
  // 是保守下界：真正上 FTQC 的门型电路只多不少）
  const depth = request.circuitDepth ?? 1;
  const { chosen } = selectFtCode(
    { logicalQubits: request.logicalQubits, couplings: request.couplings, depth },
    request.ft,
  );

  if (chosen.meetsBudget) {
    return {
      tier: 'ftqc-queue',
      reason:
        `exceeds NISQ profile (qubitsOk=${qubitsOk}, depthOk=${depthOk}); ` +
        `FTQC estimate within budget: ${chosen.code.id}, ` +
        `${chosen.totalPhysicalQubits} qubits, ${chosen.wallTimeMs.toFixed(1)} ms, ` +
        `eps=${chosen.epsilonTotal.toExponential(2)}`,
      nisqFit: { qubitsOk, depthOk, checkedDepth },
      ftqc: chosen,
    };
  }
  return {
    tier: 'classical',
    reason:
      `exceeds NISQ profile (qubitsOk=${qubitsOk}, depthOk=${depthOk}) and FTQC estimate ` +
      `fails error budget (eps=${chosen.epsilonTotal.toExponential(2)} > ` +
      `${(request.ft?.targetCircuitError ?? DEFAULT_FT_ASSUMPTIONS.targetCircuitError).toExponential(2)}); ` +
      `falling back to local exact engine`,
    nisqFit: { qubitsOk, depthOk, checkedDepth },
    ftqc: chosen,
  };
}
