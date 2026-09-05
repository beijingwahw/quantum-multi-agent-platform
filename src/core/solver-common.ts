/**
 * solver-common —— 全空间引擎（quantum-optimizer）与约束子空间引擎
 * （subspace-optimizer）的共享求解机制。
 *
 * 此前两引擎各持一份逐字相同的坐标下降、Born 采样与复振幅寄存器实现
 * （~120 行）：在其中一个引擎修复数值 bug 会静默地在另一个引擎残留。
 * 收敛于此处的实现保持与原副本逐位一致（含 rng 消耗次序与短路求值顺序），
 * 替换不改变任何数值输出——由 tests/ 的物理不变量与最优性基准守护。
 */

import { DEFAULT_SEED } from '../utils/rng.js';
import type { CollapseMode, QuantumSolverOptions } from './quantum-optimizer.js';
import { QuantumEngineError } from '../utils/errors.js';
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
} from './constants.js';

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
    this.probabilitiesInto(probs);
    return probs;
  }

  /**
   * Born 概率写入调用方提供的缓冲（01#18）：坐标下降每次评估都调
   * probabilities()——每次求解数百次评估 × dim 维，逐次 new
   * Float64Array 是纯分配噪音（GC 压力 + 缓存驱逐）。目标闭包持有一块
   * scratch 反复覆写，运算与逐位结果与 probabilities() 完全一致。
   */
  probabilitiesInto(target: Float64Array): Float64Array {
    const { re, im, dim } = this;
    for (let k = 0; k < dim; k++) {
      target[k] = re[k]! * re[k]! + im[k]! * im[k]!;
    }
    return target;
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

/**
 * 零分配期望（01#18）：不物化概率数组，|ψ|² 逐位内联进累加——运算
 * 次序与 expectationValue 逐位一致（先 re²+im² 再乘 E、同基态序累加），
 * 坐标下降热路径的每次评估省一次 dim 维 Float64Array 分配。
 */
export function expectationValueInto(state: ComplexAmplitudes, energies: Float64Array): number {
  const { re, im, dim } = state;
  let sum = 0;
  for (let k = 0; k < dim; k++) {
    sum += (re[k]! * re[k]! + im[k]! * im[k]!) * energies[k]!;
  }
  return sum;
}

// ----------------------------------------------------------------------------
// CVaR 目标（CVaR-QAOA，Barkoutsos et al. 2020）
// ----------------------------------------------------------------------------

/**
 * 能量升序的基态索引（CVaR 的预排序：一次求解内 energies 不变，排序
 * 结果跨全部评估复用——每次评估只剩 O(dim) 累加）。
 */
export function cvarOrder(energies: Readonly<Float64Array>): Int32Array {
  const order = new Int32Array(energies.length);
  for (let k = 0; k < order.length; k++) order[k] = k;
  // 索引决胜显式化（01#19）：相等能量按索引升序——不再依赖 ES2019
  // 的 sort 稳定性承诺，等价语义由比较器自身承载（可移植、可断言）
  order.sort((a, b) => energies[a]! - energies[b]! || a - b);
  return order;
}

/**
 * CVaR_α 能量：概率质量最优（能量最低）α 分位上的期望——把变分目标
 * 从"全场均值"换成"最优尾部的均值"。低层数下组合优化景观的实证收敛
 * 显著更优（原文献在 MaxCut/组合实例上报告了命中率的大幅提升），
 * 机理：允许 optimizer 牺牲"差区间的质量"换取好区间的集中度，
 * 均值目标会为抬高尾部能量而稀释最优分支。
 *
 * 精确计算：沿能量升序累计概率至 α（边界态按剩余质量比例计入），
 * 头部的概率加权均值 ÷ α。注意：α=1 时数学上等于 ⟨E⟩，但累加序
 * （能量序）与 expectationValue（基态序）不同、浮点结果有 ULP 级差异
 * ——α≥1 的调用方应走 expectationValue 原路径（位级不变的默认）。
 */
export function cvarExpectationOrdered(
  probs: Readonly<Float64Array>,
  energies: Readonly<Float64Array>,
  order: Readonly<Int32Array>,
  alpha: number,
): number {
  let mass = 0;
  let acc = 0;
  // 索引循环遍历 TypedArray（01#18）：for..of 走迭代器协议，每次取值
  // 一次协议调用——热路径（每次评估）的纯开销，索引循环语义严格相同
  // eslint-disable-next-line @typescript-eslint/prefer-for-of -- k 是三数组共用下标，for..of 需额外取 i
  for (let i = 0; i < order.length; i++) {
    if (mass >= alpha) break;
    const k = order[i]!;
    const w = Math.min(probs[k]!, alpha - mass);
    acc += w * energies[k]!;
    mass += w;
  }
  return acc / alpha;
}

/** 便捷入口（测试/一次性计算用；热路径请用 cvarOrder + cvarExpectationOrdered） */
export function cvarExpectationValue(
  state: ComplexAmplitudes,
  energies: Float64Array,
  alpha: number,
): number {
  return cvarExpectationOrdered(state.probabilities(), energies, cvarOrder(energies), alpha);
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

/**
 * 归一化期望还原为原始能量尺度（normalizedEnergies 的精确逆，08#24 单点收口）。
 * 此前同一还原在四处三写（全空间 QAOA/退火 ×2 + 子空间 QAOA/退火 ×2）：
 * QAOA 路径（scale=1）写作 x·span+min，退火路径写作 (x/scale)·span+min——
 * 代数等价但无共享函数，改动任一处都会引入跨引擎期望口径漂移。
 * scale=1 时 x/1 === x（IEEE 754 精确），与既有 QAOA 写法逐位一致。
 */
export function denormalizeExpectation(
  normalizedExpectation: number,
  scale: number,
  min: number,
  max: number,
): number {
  return (normalizedExpectation / scale) * (max - min) + min;
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
  /** CVaR 分位系数（默认 1 = 均值目标；<1 启用 CVaR-QAOA 变分目标） */
  cvarAlpha: number;
  /** 角度参数化：'layer'（默认，位级不变）| 'multi'（ma-QAOA） */
  angleMode: 'layer' | 'multi';
  /** 热启动重启（08#20，缺省 false） */
  warmStart: boolean;
  /** 协作式中止信号（08#19，缺省无） */
  signal: AbortSignal | undefined;
}

/**
 * 解析公共求解器缺省。注意坍缩模式缺省的引擎差异是有意为之：
 * 全空间在含罚项的完整希尔伯特空间上演化，argmax-valid 直接读取合法
 * 子空间上的 Born 峰值；子空间全部基态合法，shots-best 以多次测量
 * 换取能量更低分支（两种缺省均为各引擎实测最优读取方式）。
 *
 * 退化参数在此入口拒绝而非让 NaN 静默流穿整个态矢量（steps=0 ⇒
 * dt=Infinity ⇒ cos(∞)=NaN ⇒ 全振幅 NaN ⇒ validMass=0 一路无声）。
 */
export function resolveCommonSolverOptions(
  options: QuantumSolverOptions,
  defaultSelect: CollapseMode,
): ResolvedCommonOptions {
  const layers = options.layers ?? DEFAULT_QAOA_LAYERS;
  const shots = options.shots ?? DEFAULT_SHOTS;
  if (!Number.isInteger(layers) || layers < 1) {
    throw new QuantumEngineError(`layers must be a positive integer, got ${options.layers}`);
  }
  if (!Number.isInteger(shots) || shots < 1) {
    throw new QuantumEngineError(`shots must be a positive integer, got ${options.shots}`);
  }
  const cvarAlpha = options.cvarAlpha ?? 1;
  if (!Number.isFinite(cvarAlpha) || cvarAlpha <= 0 || cvarAlpha > 1) {
    throw new QuantumEngineError(`cvarAlpha must be in (0, 1], got ${options.cvarAlpha}`);
  }
  // 运行时守卫：JS 调用方可传任意字符串（类型层不可见），经 unknown
  // 收宽后类型流分析不再判定比较恒假
  const rawAngleMode: unknown = options.angleMode;
  if (rawAngleMode !== undefined && rawAngleMode !== 'layer' && rawAngleMode !== 'multi') {
    throw new QuantumEngineError(
      `angleMode must be 'layer' or 'multi', got ${typeof rawAngleMode}`,
    );
  }
  const angleMode = rawAngleMode ?? 'layer';
  // restarts/topK 同入口校验（01#9）：restarts=0 产出空角度数组 +
  // Infinity「最优」、topK=0 产出空结果集——两者都是静默劣化解而非
  // 合法配置，与 layers/shots 同一入口拒绝
  const restarts = options.restarts ?? DEFAULT_RESTARTS;
  if (!Number.isInteger(restarts) || restarts < 1) {
    throw new QuantumEngineError(`restarts must be a positive integer, got ${options.restarts}`);
  }
  const topK = options.topK ?? DEFAULT_TOP_K;
  if (!Number.isInteger(topK) || topK < 1) {
    throw new QuantumEngineError(`topK must be a positive integer, got ${options.topK}`);
  }
  // 协作式中止信号（08#19）：运行时形状校验（JS 调用方可能传入任意值）
  const rawSignal: unknown = options.signal;
  if (
    rawSignal !== undefined &&
    (typeof rawSignal !== 'object' ||
      rawSignal === null ||
      typeof (rawSignal as { aborted?: unknown }).aborted !== 'boolean')
  ) {
    throw new QuantumEngineError(`signal must be an AbortSignal, got ${typeof rawSignal}`);
  }
  return {
    layers,
    shots,
    restarts,
    select: options.select ?? defaultSelect,
    seed: options.seed ?? DEFAULT_SEED,
    topK,
    cvarAlpha,
    angleMode,
    warmStart: options.warmStart ?? false,
    signal: rawSignal as AbortSignal | undefined,
  };
}

/** 退火参数校验：tau>0 且 steps 为正整数（dt = tau/steps 不得为 0/∞/NaN） */
export function validateAnnealOptions(tau: number, steps: number): void {
  if (!(tau > 0) || !Number.isFinite(tau)) {
    throw new QuantumEngineError(`anneal.tau must be a positive finite number, got ${tau}`);
  }
  if (!Number.isInteger(steps) || steps < 1) {
    throw new QuantumEngineError(`anneal.steps must be a positive integer, got ${steps}`);
  }
}

// ----------------------------------------------------------------------------
// QAOA 角度的坐标下降优化（经典侧变分循环，QAOA 的本义）
// ----------------------------------------------------------------------------

/** 坐标下降的可选中止/热启动旋钮（08#19/08#20） */
export interface DescentOptions {
  /** 协作式中止：每次评估边界检查，触发即抛（name='AbortError'） */
  signal?: AbortSignal;
  /** 热启动：重启初值锚定当前最优角度 + 受限扰动（默认纯随机） */
  warmStart?: boolean;
}

/** 中止请求的统一抛出形态（08#19）：调用方按 name === 'AbortError' 判别 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new QuantumEngineError('optimization aborted by caller signal');
    err.name = 'AbortError';
    throw err;
  }
}

/**
 * 坐标下降角度优化。evaluate 给出给定角度下的 ⟨E⟩（越小越优）；
 * 首轮重启用绝热路径启发的线性斜坡初值，后续重启随机扰动
 * （warmStart 开启时改为最优角度 + 受限扰动，见 DescentOptions）。
 */
export function optimizeAnglesByCoordinateDescent(
  evaluate: (angles: number[]) => number,
  layers: number,
  restarts: number,
  rng: () => number,
  opts: DescentOptions = {},
): { angles: number[]; expectation: number; evaluations: number } {
  let bestAngles: number[] = [];
  let bestExpectation = Infinity;
  let evaluations = 0;

  for (let r = 0; r < restarts; r++) {
    throwIfAborted(opts.signal);
    // 初值：绝热路径启发的线性斜坡（首轮）+ 随机扰动（后续重启）；
    // 热启动（08#20）：后续重启锚定当前最优角度，扰动幅度 ±0.35π ——
    // 足以跳出局部盆地、不至于把前轮信息抖没。rng 消耗次数与冷启动
    // 严格相同（每角度一次），仅取值方式不同
    const anchor = opts.warmStart && r > 0 && bestAngles.length === layers * 2 ? bestAngles : null;
    const angles: number[] = [];
    for (let p = 0; p < layers; p++) {
      if (anchor) {
        angles.push(Math.min(GAMMA_BOUND, Math.max(0, anchor[p]! + (rng() - 0.5) * 0.7 * Math.PI)));
      } else {
        angles.push(r === 0 ? ((p + 1) / layers) * Math.PI * 0.5 : rng() * Math.PI);
      }
    }
    for (let p = 0; p < layers; p++) {
      if (anchor) {
        angles.push(
          Math.min(BETA_BOUND, Math.max(0, anchor[layers + p]! + (rng() - 0.5) * 0.35 * Math.PI)),
        );
      } else {
        angles.push(
          r === 0 ? (1 - (p + 1) / (layers + 1)) * Math.PI * 0.25 : rng() * Math.PI * 0.5,
        );
      }
    }

    const evaluationsOf = (a: number[]): number => {
      throwIfAborted(opts.signal);
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

/**
 * 种子化坐标下降（ma-QAOA 用）：任意角度布局（逐角上界）+ 可选种子。
 *
 * 支配性保证的机理：restart 0 从 seedAngles 出发，坐标下降只接受严格
 * 改进（ANGLE_IMPROVEMENT_EPS 阈值），故最终 bestExpectation ≤
 * evaluate(seedAngles)。配合"layer 最优角展开成的 multi 角在 multi
 * 电路下产生逐位相同的态"这一事实，ma-QAOA ≥ QAOA 成为构造性定理
 * 而非经验观察。
 *
 * seedAngles 缺省时用 0.5·π/8 均匀初值（仅完整性；主用法必给种子）。
 */
export function optimizeAnglesByCoordinateDescentSeeded(
  evaluate: (angles: number[]) => number,
  angleCount: number,
  bounds: readonly number[],
  restarts: number,
  rng: () => number,
  seedAngles?: readonly number[],
  opts: DescentOptions = {},
): { angles: number[]; expectation: number; evaluations: number } {
  if (bounds.length !== angleCount) {
    throw new QuantumEngineError(
      `bounds length (${bounds.length}) must equal angle count (${angleCount})`,
    );
  }
  let bestAngles: number[] = [];
  let bestExpectation = Infinity;
  let evaluations = 0;

  for (let r = 0; r < restarts; r++) {
    throwIfAborted(opts.signal);
    let angles: number[];
    if (r === 0 && seedAngles !== undefined) {
      angles = seedAngles.slice();
    } else if (opts.warmStart && r > 0 && bestAngles.length === angleCount) {
      // 热启动（08#20）：同层版实现——最优角度 + ±min(bound, π/2)/2 扰动，
      // rng 消耗次数与冷启动相同
      angles = Array.from({ length: angleCount }, (_, i) => {
        const bound = Math.min(bounds[i]!, Math.PI / 2);
        return Math.min(bounds[i]!, Math.max(0, bestAngles[i]! + (rng() - 0.5) * bound));
      });
    } else {
      angles = Array.from(
        { length: angleCount },
        (_, i) => rng() * Math.min(bounds[i]!, Math.PI / 2),
      );
    }

    const evaluationsOf = (a: number[]): number => {
      throwIfAborted(opts.signal);
      evaluations++;
      return evaluate(a);
    };

    let current = evaluationsOf(angles);
    let delta = ANGLE_STEP_INITIAL;

    while (delta > ANGLE_STEP_MIN) {
      let improved = false;
      for (let i = 0; i < angles.length; i++) {
        const bound = bounds[i]!;
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

/**
 * 单次 Born 采样：按 |ψ|² 采一个基态索引（累积和线性扫描）。
 * 边界用严格不等式（01#11）：r <= cum 在 r=0（mulberry32 可精确产生）
 * 且首段为零概率态时会返回零概率基态——Born 采样的支撑集必须是
 * 正概率态。概率和略小于 1 时落末态（数值兜底）。
 */
export function sampleIndexByProbabilities(probs: Float64Array, rng: () => number): number {
  const r = rng();
  let cum = 0;
  for (let k = 0; k < probs.length; k++) {
    cum += probs[k]!;
    if (r < cum) return k;
  }
  return probs.length - 1; // 数值兜底：概率和略小于 1 时落在末态
}

/**
 * shots-best 采样：按 |ψ|² 采样 shots 次（CDF + 二分查找），
 * 在合格基态中保留能量最低的一次。isEligible 缺省时全部基态合格
 * （子空间引擎）；全空间引擎传入合法性谓词以丢弃违约样本。
 * 无任何合格采样时返回 -1（调用方回退 argmax-valid）。
 * 边界与 sampleIndexByProbabilities 同契约（01#11）：首个 cum > r
 * 的基态——严格不等式，零概率态不进支撑集（r 落在零质量段的
 * 累积边界上时不被采中）。
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
      if (cum[mid]! <= r) lo = mid + 1;
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
