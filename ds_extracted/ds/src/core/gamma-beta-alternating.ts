/**
 * gamma-beta-alternating —— γβ 联合交替精修器（R19-Q，批 3 候选①实施）
 *
 * ============ 动机（两段精确极小化面的统一入口） ============
 *
 * 平台的两段精确坐标极小化面各自独立、互不触达：
 * - ECCM / exact-cosine-coordinate（R16）：β 坐标（两值谱混合角）三点
 *   定弦闭式全局极小，**γ 段域外冻结**；
 * - gamma-spectrum-buyout（R18-D）：γ 坐标（对角多值谱代价角）谱差买断
 *   + 证书化网格极小，**β 段不参与**。
 * 实际 QAOA 角度向量两类坐标混排（angles = [γ_1..γ_p, β_1..β_p]），调用
 * 方须手工串接两次单面精修。本模块提供统一入口：一次 Gauss-Seidel 扫描
 * 内，β 坐标走 ECCM 三点闭式、γ 坐标走谱差买断证书极小，逐坐标交替至
 * 收敛——「每个坐标每次移动都取该坐标的精确（或证书化）条件极小」。
 *
 * ============ 定理（先证后码，可证伪） ============
 *
 * 【A1 · 单调不增（构造性）】每坐标的候选移动经**真实 evaluate 确认**，
 * 仅当 value < current − ANGLE_IMPROVEMENT_EPS 时接受；未接受的移动不
 * 改变 (angles, value)。因此交替过程产生的值轨迹 (v_t) 单调不增，且
 * 终值 ≤ evaluate(seedAngles)。证明：归纳——每步或严格下降超过 eps、或
 * 不动。∎ 该支配性不依赖两段拟合的浮点精度（确认评估兜底），与
 * ECCM / parameter-shift / γ 买断三面的支配性构造同形。
 *
 * 【A2 · 有限终止】f 有下界（任意实值目标）且每接受步严格下降超过
 * ANGLE_IMPROVEMENT_EPS ⇒ 接受步数 ≤ (v_seed − inf f)/eps；外层 sweeps
 * 上限再截断一轮数。过程恒有限终止（早停条件：一整轮 β 块 + γ 块零
 * 接受）。∎
 *
 * 【A3 · 值轨迹收敛 + ε-联合坐标不动点（诚实形状）】单调不增且有下界
 * 的实数列必有极限（实分析基本定理）——值轨迹收敛；但对**角度序列的
 * 收敛不做任何主张**（可构造在并列极小间振荡的实例，本文不声称排除）。
 * 早停终止时，每个 β 坐标处于其闭式条件极小（或具名跳过：三点不可
 * 放置 / 拟合退化 / 确认未过阈），每个 γ 坐标处于其证书化买断极小
 * （或具名跳过）——即「单坐标精确极小化 oracle 的 ε-不动点」。**明确
 * 不主张**：这是联合局部极小或全局极小——坐标块耦合方向仍可能下降
 * （坐标下降法的经典边界）；不动点的强度恰是「无单坐标精确极小化能
 * 改进超过 eps」，不多一分。
 *
 * 【A4 · γ 块结构前提独立（优雅降级）】β 块的定理前提（两值谱混合角）
 * 与 γ 块的谱差可买断性相互独立。谱分析失败（过密 / 不可公度于
 * maxSamples 预算内）时，本入口**只冻结 γ 块**（γ 角度逐位不动、
 * gammaAccepts=0、失败原因在 spectrum 具名携带），β 块照常执行——不
 * 整体跳过（与 refineGammaByTrigBuyout 的整体 skipped 语义不同：统一
 * 入口的价值恰在两块前提独立时仍能走通可证的那一半）。
 *
 * ============ 块序规格（确定性选择） ============
 *
 * 每轮 sweep 先 β 块（specs 声明序）后 γ 块（gammaIndices 声明序）。
 * A1–A3 对任意块序成立（单调性证明不依赖顺序）；固定块序是为确定性
 * 与可复现审计（同输入同输出，无 RNG、无时钟）。
 *
 * ============ 诚实边界 ============
 *
 * - γ 块继承 gamma-spectrum-buyout 的全部边界：谱过密 / 不可公度 ⇒
 *   冻结（A4）；CVaR 等非线性目标域外（探针具名拦截）；证书是买断
 *   多项式的证书（真实电路偏差由探针 + 确认评估兜底）。
 * - β 块继承 ECCM 的全部边界：掩码截断的多值谱组不得进入 specs
 *   （subspaceMixerGap 判定，调用方过滤）；三点退化跳过。
 * - 逐轮逐坐标重买断：每轮每个 γ 坐标 2M+1+probes 次评估（诚实记账，
 *   evaluations 字段如实累计）。
 * - 不宣称普适更优：与单面精修 / 坐标下降的对比按实例族双轴（质量 ×
 *   评估成本）如实分账（tests 对拍），赢要证据、输要如实。
 *
 * ============ 形制 ============
 *
 * 零外部依赖（仓内 import：errors/constants + ECCM 与 γ 买断的纯函数
 * 面）；顶层零副作用；opt-in 新面：不被任何既有文件 import（编排者
 * 收口接线）；纯确定（无 RNG、无时钟）。
 */

import { QuantumEngineError } from '../utils/errors.js';
import { ANGLE_IMPROVEMENT_EPS } from './constants.js';
import type { MixerAngleSpec } from './parameter-shift.js';
import { cosineMinimumInBounds, cosineSampleBetas, fitCosine } from './exact-cosine-coordinate.js';
import {
  analyzeGammaSpectrum,
  buyoutGammaCurve,
  minimizeGammaCurve,
  type GammaSpectrumResult,
} from './gamma-spectrum-buyout.js';

/** 联合交替缺省 Gauss-Seidel 扫描轮数上限（零接受轮早停兜底） */
const DEFAULT_JOINT_SWEEPS = 4;

/** 联合交替的可选旋钮（透传 γ 买断的审计面参数） */
export interface GammaBetaAlternatingOptions {
  /** 参与买断的 γ 角度下标（缺省 []：全部 γ 冻结，仅 β 块执行；与 specs 同空则入口拒绝） */
  gammaIndices?: readonly number[];
  /** Gauss-Seidel 扫描轮数上限（缺省 4；零接受轮早停） */
  sweeps?: number;
  /** outlier 探针个数（透传 γ 买断，缺省 2） */
  probeSamples?: number;
  /** 探针/杂散失配容差（透传 γ 买断，缺省 1e-6） */
  residualTolerance?: number;
  /** 证书 gap 目标（透传 minimizeGammaCurve，缺省 1e-9） */
  targetEps?: number;
  /** 网格点数上限（透传，缺省 65536） */
  maxGrid?: number;
  /** 采样预算上限（透传谱分析，缺省 257） */
  maxSamples?: number;
  /** 能量表维度上限（透传谱分析，缺省 4096） */
  maxDimension?: number;
}

/** 联合交替精修结果：最优角度快照 + 轨迹与块级审计 */
export interface GammaBetaAlternatingResult {
  /** 精修后的角度（从未接受任何劣化步 ⇒ 目标 ≤ 种子；γ 冻结段逐位 = 种子） */
  readonly angles: number[];
  /** evaluate(angles) 的值 */
  readonly value: number;
  /** evaluate 的总调用次数（种子 1 + β 块每坐标 2 采样 + 改进确认 + γ 块每坐标 N+probes 买断 + 1 确认） */
  readonly evaluations: number;
  /** 实际执行的扫描轮数（零接受轮早停） */
  readonly sweeps: number;
  /** 相对种子严格改进（> ANGLE_IMPROVEMENT_EPS） */
  readonly improved: boolean;
  /** 值轨迹：[种子值, 每轮结束后值, ...]（A1 的机器证据面：单调不增） */
  readonly sweepValues: readonly number[];
  /** β 块接受的移动数 */
  readonly betaAccepts: number;
  /** γ 块接受的移动数 */
  readonly gammaAccepts: number;
  /** β 块跳过的坐标极小化次数（不可放置/退化/已在极小/确认未过阈） */
  readonly betaSkips: number;
  /** γ 块跳过的坐标极小化次数（含确认未过阈；冻结块不计数） */
  readonly gammaSkips: number;
  /** 谱分析结果（失败时 ok:false——γ 块冻结的结构原因如实携带） */
  readonly spectrum: GammaSpectrumResult;
  /** 谱分析失败 ⇒ true（γ 块整块冻结，β 块照常——A4 优雅降级） */
  readonly gammaFrozen: boolean;
}

/**
 * γβ 联合交替精修（统一入口）：Gauss-Seidel 扫描，每轮先 β 块
 * （specs 序：三点定弦拟合单余弦 + 闭式 [0,bound] 极小 + 真实评估确认）
 * 后 γ 块（gammaIndices 序：整曲线买断 + 证书化网格极小 + 真实评估确认），
 * 只接受严格改进步；零接受轮早停。
 *
 * - specs 列出参与精修的混合角（两值谱生成元，gap 见 MixerAngleSpec）；
 *   gammaIndices 列出参与买断的代价角；两者同空 = 静默 no-op，入口拒绝；
 * - 未列出的角度（其余 γ 与 β）保持种子值不动；
 * - 谱分析失败（过密/不可公度）⇒ γ 块冻结（A4），β 块照常；
 * - 确定性：无 RNG、无时钟，同输入同输出。
 */
export function refineAnglesByGammaBetaAlternation(
  evaluate: (angles: number[]) => number,
  seedAngles: readonly number[],
  bounds: readonly number[],
  specs: readonly MixerAngleSpec[],
  energies: Readonly<Float64Array> | readonly number[],
  options: GammaBetaAlternatingOptions = {},
): GammaBetaAlternatingResult {
  const gammaIndices = options.gammaIndices ?? [];
  if (specs.length === 0 && gammaIndices.length === 0) {
    throw new QuantumEngineError(
      'joint refinement needs at least one mixer spec or gamma index (silent no-op is rejected)',
    );
  }
  for (let i = 0; i < seedAngles.length; i++) {
    const a = seedAngles[i]!;
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new QuantumEngineError(`seedAngles[${i}] must be a finite number, got ${String(a)}`);
    }
  }
  for (const spec of specs) {
    if (!Number.isInteger(spec.index) || spec.index < 0 || spec.index >= seedAngles.length) {
      throw new QuantumEngineError(
        `MixerAngleSpec.index must be an integer in [0, ${seedAngles.length}), got ${spec.index}`,
      );
    }
    if (typeof spec.gap !== 'number' || !Number.isFinite(spec.gap) || spec.gap <= 0) {
      throw new QuantumEngineError(
        `MixerAngleSpec.gap must be a positive finite generator spectral gap, got ${spec.gap}`,
      );
    }
  }
  const distinctGammas = new Set(gammaIndices);
  for (const idx of gammaIndices) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= seedAngles.length) {
      throw new QuantumEngineError(
        `gammaIndices entries must be integers in [0, ${seedAngles.length}), got ${String(idx)}`,
      );
    }
  }
  if (distinctGammas.size !== gammaIndices.length) {
    throw new QuantumEngineError('gammaIndices must not contain duplicates');
  }
  for (const spec of specs) {
    if (distinctGammas.has(spec.index)) {
      throw new QuantumEngineError(
        `angle index ${spec.index} appears in both specs (beta block) and gammaIndices (gamma block) — an angle parameterizes either a mixer or a cost phase, never both`,
      );
    }
  }
  if (bounds.length !== seedAngles.length) {
    throw new QuantumEngineError(
      `bounds length (${bounds.length}) must equal angle count (${seedAngles.length})`,
    );
  }
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i]!;
    if (typeof b !== 'number' || !Number.isFinite(b) || b < 0) {
      throw new QuantumEngineError(`bounds[${i}] must be a finite number >= 0, got ${String(b)}`);
    }
  }
  const sweeps = options.sweeps ?? DEFAULT_JOINT_SWEEPS;
  if (!Number.isInteger(sweeps) || sweeps < 1) {
    throw new QuantumEngineError(
      `sweeps must be a positive integer, got ${String(options.sweeps)}`,
    );
  }

  let evaluations = 0;
  const evaluateChecked = (a: number[]): number => {
    const v = evaluate(a);
    evaluations++;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new QuantumEngineError(
        `evaluate() must return a finite number, got ${String(v)} at evaluations=${evaluations}`,
      );
    }
    return v;
  };

  let angles = seedAngles.slice();
  let value = evaluateChecked(angles);
  const seedValue = value;

  // γ 块结构面：谱分析一次（失败 ⇒ γ 块整块冻结，β 块照常——A4）
  const spectrum = analyzeGammaSpectrum(energies, {
    ...(options.maxSamples !== undefined ? { maxSamples: options.maxSamples } : {}),
    ...(options.maxDimension !== undefined ? { maxDimension: options.maxDimension } : {}),
  });
  const gammaFrozen = !spectrum.ok;

  const buyoutOptions = {
    ...(options.probeSamples !== undefined ? { probeSamples: options.probeSamples } : {}),
    ...(options.residualTolerance !== undefined
      ? { residualTolerance: options.residualTolerance }
      : {}),
  };
  const minimizeOptions = {
    ...(options.targetEps !== undefined ? { targetEps: options.targetEps } : {}),
    ...(options.maxGrid !== undefined ? { maxGrid: options.maxGrid } : {}),
  };

  const sweepValues: number[] = [seedValue];
  let betaAccepts = 0;
  let gammaAccepts = 0;
  let betaSkips = 0;
  let gammaSkips = 0;
  let sweepsUsed = 0;

  for (let sweep = 0; sweep < sweeps; sweep++) {
    let accepted = false;

    // ---- β 块（specs 序）：ECCM 三点闭式条件极小（R16 定理面） ----
    for (const spec of specs) {
      const i = spec.index;
      const bound = bounds[i]!;
      const beta0 = angles[i]!;
      const placement = cosineSampleBetas(beta0, spec.gap, bound);
      if (placement === null) {
        betaSkips++;
        continue;
      }
      const probe1 = angles.slice();
      probe1[i] = placement.beta1;
      const v1 = evaluateChecked(probe1);
      const probe2 = angles.slice();
      probe2[i] = placement.beta2;
      const v2 = evaluateChecked(probe2);
      const fit = fitCosine([beta0, placement.beta1, placement.beta2], [value, v1, v2], spec.gap);
      if (fit.degenerate) {
        betaSkips++;
        continue;
      }
      const betaStar = cosineMinimumInBounds(fit, spec.gap, beta0, bound);
      if (betaStar === beta0) {
        betaSkips++; // 平坦坐标 / 已在精确条件极小
        continue;
      }
      const trial = angles.slice();
      trial[i] = betaStar;
      const trialValue = evaluateChecked(trial); // 真实确认（支配性兜底）
      if (trialValue < value - ANGLE_IMPROVEMENT_EPS) {
        angles = trial;
        value = trialValue;
        accepted = true;
        betaAccepts++;
      } else {
        betaSkips++; // 拟合噪声地板上的并列：保持不动
      }
    }

    // ---- γ 块（gammaIndices 序）：谱差买断 + 证书化网格极小（R18-D 定理面） ----
    if (!gammaFrozen) {
      for (const idx of gammaIndices) {
        const bound = bounds[idx]!;
        const buyout = buyoutGammaCurve(
          evaluateChecked,
          angles,
          idx,
          spectrum,
          bound,
          buyoutOptions,
        );
        const cert = minimizeGammaCurve(buyout, bound, minimizeOptions);
        const trial = angles.slice();
        trial[idx] = cert.gamma;
        const trialValue = evaluateChecked(trial); // 真实确认（支配性兜底）
        if (trialValue < value - ANGLE_IMPROVEMENT_EPS) {
          angles = trial;
          value = trialValue;
          accepted = true;
          gammaAccepts++;
        } else {
          gammaSkips++; // 证书 gap 地板上的并列：保持不动
        }
      }
    }

    sweepsUsed++;
    sweepValues.push(value);
    if (!accepted) break; // ε-联合坐标不动点（A3）：两块均无严格改进
  }

  return {
    angles,
    value,
    evaluations,
    sweeps: sweepsUsed,
    improved: value < seedValue - ANGLE_IMPROVEMENT_EPS,
    sweepValues,
    betaAccepts,
    gammaAccepts,
    betaSkips,
    gammaSkips,
    spectrum,
    gammaFrozen,
  };
}
