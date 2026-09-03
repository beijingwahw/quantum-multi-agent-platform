/**
 * solver-common —— 全空间引擎（quantum-optimizer）与约束子空间引擎
 * （subspace-optimizer）的共享求解机制。
 *
 * 此前两引擎各持一份逐字相同的坐标下降、Born 采样与复振幅寄存器实现
 * （~120 行）：在其中一个引擎修复数值 bug 会静默地在另一个引擎残留。
 * 收敛于此处的实现保持与原副本逐位一致（含 rng 消耗次序与短路求值顺序），
 * 替换不改变任何数值输出——由 tests/ 的物理不变量与最优性基准守护。
 */

import { DEFAULT_SEED } from '../utils/rng';
import type { CollapseMode, QuantumSolverOptions } from './quantum-optimizer';
import {
  ANGLE_IMPROVEMENT_EPS,
  ANGLE_STEP_INITIAL,
  ANGLE_STEP_MIN,
  ANGLE_STEP_SHRINK,
  BETA_BOUND,
  DEFAULT_QAOA_LAYERS,
  DEFAULT_RESTARTS,
  DEFAULT_SHOTS,
  DEFAULT_TOP_K,
  GAMMA_BOUND,
} from './constants';

// ----------------------------------------------------------------------------
// 复振幅寄存器：两个引擎的态矢量公共基座
// ----------------------------------------------------------------------------

/** 复振幅寄存器：薛定谔演化的载体（全空间与子空间态矢量的公共基类） */
export class ComplexAmplitudes {
  readonly dim: number;
  readonly re: Float64Array;
  readonly im: Float64Array;

  constructor(dim: number) {
    this.dim = dim;
    this.re = new Float64Array(dim);
    this.im = new Float64Array(dim);
  }

  /** 均匀叠加：所有基态等权（两引擎的 QAOA 初态 / 子空间退火初态） */
  setUniform(): void {
    const amp = 1 / Math.sqrt(this.dim);
    this.re.fill(amp);
    this.im.fill(0);
  }

  /**
   * 代价哈密顿量演化 e^{-iγC}。C 在计算基下对角 → 每个基态获得
   * 相位 e^{-iγE(x)}。这是精确的（无 Trotter 误差）。
   */
  applyCostPhase(gamma: number, energies: Float64Array): void {
    const { re, im, dim } = this;
    for (let k = 0; k < dim; k++) {
      const e = energies[k]!;
      if (e === 0 && gamma === 0) continue;
      const c = Math.cos(gamma * e);
      const s = Math.sin(gamma * e);
      const r = re[k]!;
      const i = im[k]!;
      re[k] = r * c + i * s;
      im[k] = i * c - r * s;
    }
  }

  /** 各基态的 Born 概率 |amp|² */
  probabilities(): Float64Array {
    const probs = new Float64Array(this.dim);
    for (let k = 0; k < this.dim; k++) {
      probs[k] = this.re[k]! * this.re[k]! + this.im[k]! * this.im[k]!;
    }
    return probs;
  }

  /** 态矢量范数（检验幺正性保持） */
  norm(): number {
    let sum = 0;
    for (let k = 0; k < this.dim; k++) {
      sum += this.re[k]! * this.re[k]! + this.im[k]! * this.im[k]!;
    }
    return Math.sqrt(sum);
  }
}

/** 能量期望 ⟨E⟩ = Σ |ψ(x)|²·E(x)（两引擎共用） */
export function expectationValue(state: ComplexAmplitudes, energies: Float64Array): number {
  const probs = state.probabilities();
  let sum = 0;
  for (let k = 0; k < state.dim; k++) sum += probs[k]! * energies[k]!;
  return sum;
}

/** 数组的最小/最大值（子空间能量谱的量程计算） */
export function minMaxOf(values: Readonly<Float64Array>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/** 能量谱线性归一化到 [0, scale]（span=0 时全零——简并谱无相位结构可分离） */
export function normalizedEnergies(
  energies: Readonly<Float64Array>,
  min: number,
  max: number,
  scale: number,
): Float64Array {
  const span = max - min;
  const out = new Float64Array(energies.length);
  if (span > 0) {
    for (let k = 0; k < out.length; k++) {
      out[k] = ((energies[k]! - min) / span) * scale;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// 求解器选项缺省解析
// ----------------------------------------------------------------------------

/** QuantumSolverOptions 的公共缺省解析结果（坍缩模式与退火参数由各引擎自定义） */
export interface ResolvedCommonOptions {
  layers: number;
  shots: number;
  restarts: number;
  select: CollapseMode;
  seed: number;
  topK: number;
}

/**
 * 解析公共求解器缺省。注意坍缩模式缺省的引擎差异是有意为之：
 * 全空间在含罚项的完整希尔伯特空间上演化，argmax-valid 直接读取合法
 * 子空间上的 Born 峰值；子空间全部基态合法，shots-best 以多次测量
 * 换取能量更低分支（两种缺省均为各引擎实测最优读取方式）。
 */
export function resolveCommonSolverOptions(
  options: QuantumSolverOptions,
  defaultSelect: CollapseMode,
): ResolvedCommonOptions {
  return {
    layers: options.layers ?? DEFAULT_QAOA_LAYERS,
    shots: options.shots ?? DEFAULT_SHOTS,
    restarts: options.restarts ?? DEFAULT_RESTARTS,
    select: options.select ?? defaultSelect,
    seed: options.seed ?? DEFAULT_SEED,
    topK: options.topK ?? DEFAULT_TOP_K,
  };
}

// ----------------------------------------------------------------------------
// QAOA 角度的坐标下降优化（经典侧变分循环，QAOA 的本义）
// ----------------------------------------------------------------------------

/**
 * 坐标下降角度优化。evaluate 给出给定角度下的 ⟨E⟩（越小越优）；
 * 首轮重启用绝热路径启发的线性斜坡初值，后续重启随机扰动。
 */
export function optimizeAnglesByCoordinateDescent(
  evaluate: (angles: number[]) => number,
  layers: number,
  restarts: number,
  rng: () => number,
): { angles: number[]; expectation: number; evaluations: number } {
  let bestAngles: number[] = [];
  let bestExpectation = Infinity;
  let evaluations = 0;

  for (let r = 0; r < restarts; r++) {
    // 初值：绝热路径启发的线性斜坡（首轮）+ 随机扰动（后续重启）
    const angles: number[] = [];
    for (let p = 0; p < layers; p++) {
      angles.push(r === 0 ? ((p + 1) / layers) * Math.PI * 0.5 : rng() * Math.PI);
    }
    for (let p = 0; p < layers; p++) {
      angles.push(r === 0 ? (1 - (p + 1) / (layers + 1)) * Math.PI * 0.25 : rng() * Math.PI * 0.5);
    }

    const evaluationsOf = (a: number[]): number => {
      evaluations++;
      return evaluate(a);
    };

    let current = evaluationsOf(angles);
    let delta = ANGLE_STEP_INITIAL;

    while (delta > ANGLE_STEP_MIN) {
      let improved = false;
      for (let i = 0; i < angles.length; i++) {
        const bound = i < layers ? GAMMA_BOUND : BETA_BOUND;
        for (const sign of [1, -1]) {
          const candidate = angles.slice();
          candidate[i] = Math.min(bound, Math.max(0, candidate[i]! + sign * delta));
          const value = evaluationsOf(candidate);
          if (value < current - ANGLE_IMPROVEMENT_EPS) {
            angles.splice(0, angles.length, ...candidate);
            current = value;
            improved = true;
          }
        }
      }
      if (!improved) delta *= ANGLE_STEP_SHRINK;
    }

    if (current < bestExpectation) {
      bestExpectation = current;
      bestAngles = angles.slice();
    }
  }
  return { angles: bestAngles, expectation: bestExpectation, evaluations };
}

// ----------------------------------------------------------------------------
// 测量坍缩采样（Born 规则的忠实实现）
// ----------------------------------------------------------------------------

/** 单次 Born 采样：按 |ψ|² 采一个基态索引（累积和线性扫描） */
export function sampleIndexByProbabilities(probs: Float64Array, rng: () => number): number {
  const r = rng();
  let cum = 0;
  for (let k = 0; k < probs.length; k++) {
    cum += probs[k]!;
    if (r <= cum) return k;
  }
  return probs.length - 1; // 数值兜底：概率和略小于 1 时落在末态
}

/**
 * shots-best 采样：按 |ψ|² 采样 shots 次（CDF + 二分查找），
 * 在合格基态中保留能量最低的一次。isEligible 缺省时全部基态合格
 * （子空间引擎）；全空间引擎传入合法性谓词以丢弃违约样本。
 * 无任何合格采样时返回 -1（调用方回退 argmax-valid）。
 */
export function sampleBestIndexByShots(
  probs: Float64Array,
  shots: number,
  rng: () => number,
  energyAt: (index: number) => number,
  isEligible?: (index: number) => boolean,
): number {
  const cum = new Float64Array(probs.length);
  let acc = 0;
  for (let k = 0; k < probs.length; k++) {
    acc += probs[k]!;
    cum[k] = acc;
  }
  let chosen = -1;
  let bestEnergy = Infinity;
  for (let s = 0; s < shots; s++) {
    const r = rng() * acc;
    let lo = 0,
      hi = probs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! < r) lo = mid + 1;
      else hi = mid;
    }
    if (isEligible === undefined || isEligible(lo)) {
      const energy = energyAt(lo);
      if (energy < bestEnergy) {
        bestEnergy = energy;
        chosen = lo;
      }
    }
  }
  return chosen;
}
