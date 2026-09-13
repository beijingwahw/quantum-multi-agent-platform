/**
 * exact-cosine-coordinate —— 精确余弦坐标极小化（ECCM，Rotosolve 面，R16）
 *
 * ============ 定理（单余弦结构，先证后码） ============
 *
 * 设电路 |ψ(β)⟩ = W·e^{−iβG}·V|φ⟩：除 β 外全部角度固定（W/V 为其余
 * 电路），G 厄米且谱**恰为两值** {λ₊, λ₋}，谱隙 Δ = λ₊−λ₋ ≠ 0，E 为与
 * β 无关的厄米算符。则期望目标恰为单余弦（只有一个频率）：
 *
 *   f(β) = ⟨ψ(β)|E|ψ(β)⟩ = c₀ + a·cos(Δβ) + b·sin(Δβ)
 *
 * 证明梗概：谱投影 P_±，分解 V|φ⟩ = χ₊ + χ₋（χ_± := P_±V|φ⟩，与 β
 * 无关），则 e^{−iβG}(χ₊+χ₋) = e^{−iβλ₋}·(χ₋ + e^{−iΔβ}χ₊)。记
 * u := Wχ₋、v := Wχ₊（均与 β 无关），全局相位 e^{−iβλ₋} 被期望消去：
 *
 *   f(β) = ⟨u + e^{−iΔβ}v|E|u + e^{−iΔβ}v⟩
 *        = ⟨u|E|u⟩ + ⟨v|E|v⟩ + 2·Re(e^{−iΔβ}·⟨u|E|v⟩)
 *
 * 交叉项只携带 e^{±iΔβ} 一个频率，实部展开即 c₀ + a·cos(Δβ) + b·sin(Δβ)
 * （c₀ = ⟨u|E|u⟩+⟨v|E|v⟩，a = 2Re⟨u|E|v⟩，b = −2Im⟨u|E|v⟩）。∎
 *
 * 推论（三点定弦 + 闭式全局极小）：f 由 (c₀, a, b) 三参数决定；任意三个
 * 按 Δ 位置可分辨的采样点 β₀, β₁, β₂ 给出 3×3 线性系统
 * f(βⱼ) = c₀ + a·cos(Δβⱼ) + b·sin(Δβⱼ)（系数由已知 Δ 算出，Cramer
 * 闭式求解）。随后 a·cos x + b·sin x = R·cos(x−δ)，R = √(a²+b²)，
 * δ = atan2(b, a)，全局极小在 Δβ = δ+π (mod 2π)，即
 * β*_k = (δ+π+2πk)/Δ；区间 [0,B] 上的精确极小 = 落入区间的某个 β*_k
 * （周期重复值相同，取离当前 β₀ 最近者），否则较优端点。
 * ⟹ 每坐标 2 次新采样（β₀ 处的值复用当前态）+ 1 次确认评估，**每步是
 * 该坐标的真全局极小**（Gauss-Seidel 精确坐标极小化）；零步长超参。
 * R≈0（平坦坐标）⇒ 全部候选值并列，距离并列判据选出 β₀ 本身 ⇒ 跳过。
 *
 * ============ 文献锚（R15 台账双源核实；不凭记忆新增引文） ============
 *
 * 本法族为 Rotosolve：M. Ostaszewski, E. Grant, M. Benedetti,
 * "Structure optimization for parameterized quantum circuits",
 * Quantum 5, 391 (2021), arXiv:1905.09692。变分电路期望目标的傅里叶
 * 结构背景：M. Schuld, R. F. Sweke, J. R. Meyer, Phys. Rev. A 103,
 * 032430 (2021)。
 *
 * 本仓增量：① 平台两值谱面的精确 Δ 接线——全空间 ma 布局逐量子比特
 * e^{−iβ_q X_q}（谱 {+1,−1}，Δ=2）、子空间均匀 k 纤维 A_g = ⊕(K_k−I)
 * （谱 {k−1,−1}，Δ=k），复用 parameter-shift.subspaceMixerGap 的诚实
 * 排除面（掩码截断的多值谱组不参与）；② 与仓内种子化支配性构造的整合
 * （确认接受 ⇒ 构造性返回值 ≤ 种子）；③ 双轴（质量 × 评估成本）对拍的
 * 机器账本（tests/r16-eccm-*）。
 *
 * ============ 支配性构造（与 refineAnglesByExactGradient 同形） ============
 *
 * 以任意种子出发；每个坐标的闭式极小候选经**真实 evaluate 确认**，只在
 * 严格改进（> ANGLE_IMPROVEMENT_EPS）时接受，最优快照从不回退 ⇒ 返回值
 * ≤ evaluate(seedAngles) 是构造性定理（拟合系数的浮点噪声由确认评估兜
 * 底，支配性不依赖拟合精度）。
 *
 * ============ 诚实边界 ============
 *
 * - **γ 段域外**：代价角参数化 e^{−iγC}，C 对角多值谱——两值谱定理不
 *   成立，本模块不为其构造 spec；精修中 γ 保持种子值不动（与
 *   parameter-shift / natural-gradient 同一边界处置）。
 * - **期望目标域内、CVaR 域外**：定理用到 ⟨ψ|E|ψ⟩ 的双线性结构；
 *   CVaR_α 角度目标（solver-common 的 cvarAlpha < 1 路径）对概率分布
 *   取最优分位均值——非线性且分段（能量排序序可随 β 换位），单余弦
 *   结构不成立，调用方不得在 CVaR 目标闭包上使用本模块。
 * - **三点退化**：bound 过窄等使采样点按 Δ 不可分 ⇒ 线性系统行列式≈0
 *   ⇒ 该坐标跳过（degenerate 标记），不用病态解冒充精确。
 * - 不宣称普适更优：与坐标下降（CD）的双轴比较按实例族如实分账
 * （tests 对拍），赢要证据、输要如实。
 *
 * ============ 形制 ============
 *
 * 零外部依赖（仓内 import：constants/errors/rng + parameter-shift 类型）、
 * 顶层零副作用、opt-in 新面：不被任何既有文件 import（编排者收口接线）。
 * restarts=1 时纯确定（不消耗 RNG）；restarts>1 的重启初值镜像
 * optimizeAnglesByCoordinateDescentSeeded 的冷启动公式与逐角 rng 消耗
 * 次序（同 seed ⇒ 与 CD 逐位相同的重启起点——公平对拍的前提）。
 */

import { QuantumEngineError } from '../utils/errors.js';
import { ANGLE_IMPROVEMENT_EPS } from './constants.js';
import type { MixerAngleSpec } from './parameter-shift.js';
import { DEFAULT_SEED, mulberry32 } from '../utils/rng.js';

/**
 * 每 restart 的缺省 Gauss-Seidel 扫描轮数上限。经验区间（4×5×layers2×K8
 * 子空间族，tests/r16-eccm-* 对拍账本）：不动点在 2–18 轮到达，质量要紧的
 * 硬骨实例（γ 冻结损失由 β 精确度补偿）可磨到 ~39 轮——缺省 8 取不动点
 * 分布的中段；成本要紧用 2–3，质量要紧给 12–24（早停兜底：零接受轮即止）。
 */
const DEFAULT_ECCM_SWEEPS = 8;

/** 三点线性系统行列式的退化阈值（矩阵元 O(1)，良态展开的 det ~0.1–1 量级） */
const COSINE_FIT_DEGENERATE_DET = 1e-9;

/** 采样点可分性判据：|Δβ|·Δ 折算到 [0,2π) 后离 0/2π 的最小距离 */
const SAMPLE_DISTINCT_EPS = 1e-9;

/** 周期性极小点 k 枚举的越界松弛（收进边界上的极小点） */
const K_RANGE_EPS = 1e-12;

// ----------------------------------------------------------------------------
// 单余弦拟合原语（纯函数，导出供定理钉直接对拍）
// ----------------------------------------------------------------------------

/** 单余弦拟合结果：f(β) = c0 + a·cos(Δβ) + b·sin(Δβ) = c0 + R·cos(Δβ−δ) */
export interface CosineFit {
  readonly c0: number;
  readonly a: number;
  readonly b: number;
  /** 振幅 R = √(a²+b²)（R≈0 ⇒ 平坦坐标，极小即任意点） */
  readonly amplitude: number;
  /** 相位 δ = atan2(b, a)；全局极小在 Δβ = δ+π (mod 2π) */
  readonly phase: number;
  /** 三点线性系统退化（行列式≈0）：系数不可信，调用方应跳过该坐标 */
  readonly degenerate: boolean;
}

/** 3×3 行列式（Cramer 求解用；全部显式参数避免中间数组分配） */
function det3(
  a00: number,
  a01: number,
  a02: number,
  a10: number,
  a11: number,
  a12: number,
  a20: number,
  a21: number,
  a22: number,
): number {
  return (
    a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20)
  );
}

/** 拟合余弦在 β 处的值 */
export function cosineValueAt(fit: CosineFit, gap: number, beta: number): number {
  return fit.c0 + fit.a * Math.cos(gap * beta) + fit.b * Math.sin(gap * beta);
}

/**
 * 三点定弦：由三个采样点 (betas[j], values[j]) 闭式解出单余弦系数。
 * 系统 f(βⱼ) = c₀ + a·cos(Δβⱼ) + b·sin(Δβⱼ) 的 3×3 Cramer 解；行列式
 * |Δ| < 1e-9（三点按 Δ 不可分）⇒ degenerate: true（调用方跳过，不用
 * 病态解冒充精确）。gap 须为正有限数；values 须有限；长度须为 3。
 */
export function fitCosine(
  betas: readonly number[],
  values: readonly number[],
  gap: number,
): CosineFit {
  if (typeof gap !== 'number' || !Number.isFinite(gap) || gap <= 0) {
    throw new QuantumEngineError(
      `gap must be a positive finite generator spectral gap, got ${gap}`,
    );
  }
  if (betas.length !== 3 || values.length !== 3) {
    throw new QuantumEngineError(
      `cosine fit needs exactly 3 sample points, got ${betas.length} betas / ${values.length} values`,
    );
  }
  for (let j = 0; j < 3; j++) {
    if (typeof betas[j] !== 'number' || !Number.isFinite(betas[j]!)) {
      throw new QuantumEngineError(`betas[${j}] must be a finite number, got ${betas[j]}`);
    }
    if (typeof values[j] !== 'number' || !Number.isFinite(values[j]!)) {
      throw new QuantumEngineError(`values[${j}] must be a finite number, got ${values[j]}`);
    }
  }
  const x0 = gap * betas[0]!;
  const x1 = gap * betas[1]!;
  const x2 = gap * betas[2]!;
  const c0 = Math.cos(x0);
  const s0 = Math.sin(x0);
  const c1 = Math.cos(x1);
  const s1 = Math.sin(x1);
  const c2 = Math.cos(x2);
  const s2 = Math.sin(x2);
  const det = det3(1, c0, s0, 1, c1, s1, 1, c2, s2);
  if (Math.abs(det) < COSINE_FIT_DEGENERATE_DET) {
    return { c0: 0, a: 0, b: 0, amplitude: 0, phase: 0, degenerate: true };
  }
  const v0 = values[0]!;
  const v1 = values[1]!;
  const v2 = values[2]!;
  const fittedC0 = det3(v0, c0, s0, v1, c1, s1, v2, c2, s2) / det;
  const fittedA = det3(1, v0, s0, 1, v1, s1, 1, v2, s2) / det;
  const fittedB = det3(1, c0, v0, 1, c1, v1, 1, c2, v2) / det;
  return {
    c0: fittedC0,
    a: fittedA,
    b: fittedB,
    amplitude: Math.hypot(fittedA, fittedB),
    phase: Math.atan2(fittedB, fittedA),
    degenerate: false,
  };
}

/** 三个采样 β 的放置结果（beta0 = 当前角，beta1/beta2 = 两个移位采样点） */
export interface SamplePlacement {
  readonly beta0: number;
  readonly beta1: number;
  readonly beta2: number;
}

/** 两点按周期 2π/gap 是否可分（|Δβ|·Δ 折算到 [0,2π) 离 0/2π 均需超过阈值） */
function distinctModuloPeriod(x: number, y: number, gap: number): boolean {
  const r = Math.abs(x - y) * gap;
  const folded = r % (2 * Math.PI);
  return folded > SAMPLE_DISTINCT_EPS && folded < 2 * Math.PI - SAMPLE_DISTINCT_EPS;
}

/**
 * 采样点放置：优先 ±π/(2Δ) 与 ±π/(4Δ)（钳入 [0, bound]），窄盒退化时
 * 退到区间分数点。返回三点按 Δ 均可分辨的放置；无法放置（如 bound=0
 * 或极端挤压）返回 null——调用方跳过该坐标（诚实退化，不用病态系统）。
 */
export function cosineSampleBetas(
  beta0: number,
  gap: number,
  bound: number,
): SamplePlacement | null {
  if (typeof beta0 !== 'number' || !Number.isFinite(beta0)) {
    throw new QuantumEngineError(`beta0 must be a finite number, got ${beta0}`);
  }
  if (typeof bound !== 'number' || !Number.isFinite(bound) || bound < 0) {
    throw new QuantumEngineError(`bound must be a finite number >= 0, got ${bound}`);
  }
  if (typeof gap !== 'number' || !Number.isFinite(gap) || gap <= 0) {
    throw new QuantumEngineError(
      `gap must be a positive finite generator spectral gap, got ${gap}`,
    );
  }
  if (bound === 0) return null; // 无活动空间
  const clamp = (b: number): number => Math.min(bound, Math.max(0, b));
  const ok = (b1: number, b2: number): boolean =>
    distinctModuloPeriod(beta0, b1, gap) &&
    distinctModuloPeriod(beta0, b2, gap) &&
    distinctModuloPeriod(b1, b2, gap);
  const s = Math.PI / (2 * gap);
  // 1) 主方向（正向放得下或负向必出界则取正，否则镜像取负）
  const dir = beta0 + s <= bound || beta0 - s < 0 ? 1 : -1;
  for (const d of [dir, -dir] as const) {
    const b1 = clamp(beta0 + d * s);
    const b2 = clamp(beta0 + d * s * 0.5);
    if (ok(b1, b2)) return { beta0, beta1: b1, beta2: b2 };
  }
  // 2) 窄盒回退：区间分数点（任取三点均可，分数点与当前角碰撞时换档）
  for (const f1 of [0.25, 1 / 3, 0.1]) {
    for (const f2 of [0.75, 2 / 3, 0.9]) {
      if (f2 <= f1) continue;
      const b1 = clamp(bound * f1);
      const b2 = clamp(bound * f2);
      if (ok(b1, b2)) return { beta0, beta1: b1, beta2: b2 };
    }
  }
  return null;
}

/**
 * 拟合余弦在 [0, bound] 上的精确极小点：候选集 = 当前点 β₀（平坦坐标的
 * 保底，距离并列判据赢家）∪ 区间内全部周期性极小 β*_k = (δ+π+2πk)/Δ ∪
 * 两端点，取拟合值最小者；并列取离 beta0 最近、再并列取先到（确定性）。
 * R≈0（平坦拟合）⇒ 全部候选值并列 ⇒ β₀ 的零距离获胜 ⇒ 原样返回。
 * degenerate 拟合或 bound=0 时原样返回 beta0。
 */
export function cosineMinimumInBounds(
  fit: CosineFit,
  gap: number,
  beta0: number,
  bound: number,
): number {
  if (fit.degenerate) return beta0;
  if (!(bound > 0)) return beta0;
  let bestBeta = beta0;
  let bestValue = cosineValueAt(fit, gap, beta0);
  let bestDist = 0;
  const consider = (beta: number): void => {
    const value = cosineValueAt(fit, gap, beta);
    const dist = Math.abs(beta - beta0);
    if (value < bestValue || (value === bestValue && dist < bestDist)) {
      bestBeta = beta;
      bestValue = value;
      bestDist = dist;
    }
  };
  consider(0);
  consider(bound);
  const target = fit.phase + Math.PI; // gap·β* ≡ target (mod 2π)
  const kLo = Math.ceil((0 * gap - target) / (2 * Math.PI) - K_RANGE_EPS);
  const kHi = Math.floor((bound * gap - target) / (2 * Math.PI) + K_RANGE_EPS);
  for (let k = kLo; k <= kHi; k++) {
    const beta = (target + k * 2 * Math.PI) / gap;
    if (beta < 0 || beta > bound) continue; // 松弛枚举收进的越界点丢弃
    consider(beta);
  }
  return bestBeta;
}

// ----------------------------------------------------------------------------
// 种子化精确余弦坐标精修（支配性构造）
// ----------------------------------------------------------------------------

/** 精修的可选旋钮（无步长超参——坐标极小是闭式精确的） */
export interface ExactCosineOptions {
  /** 每 restart 的最大扫描轮数（缺省 3；一轮 = 全部 specs 各一次闭式极小化） */
  sweeps?: number;
  /** 重启数（含种子重启，缺省 1 = 仅种子重启；镜像 CD 的 restarts 语义） */
  restarts?: number;
  /** 重启初值 RNG 种子（mulberry32；缺省 DEFAULT_SEED；restarts=1 不消耗 RNG） */
  seed?: number;
}

/** 精修结果：最优角度快照 + 目标值与评估记账 */
export interface ExactCosineResult {
  /** 精修后的角度（从未接受任何劣化步 ⇒ 目标 ≤ 种子） */
  readonly angles: number[];
  /** evaluate(angles) 的值 */
  readonly value: number;
  /** evaluate 的总调用次数（种子 1 + 每冷重启 1 + 每坐标 2 采样 + 改进候选 1 确认） */
  readonly evaluations: number;
  /** 实际执行的总扫描轮数（跨全部 restart；某轮零接受即提前收敛终止） */
  readonly sweeps: number;
  /** 实际执行的重启数（= options.restarts，恒执行满——重启间无收敛判据） */
  readonly restarts: number;
  /** 相对种子严格改进（> ANGLE_IMPROVEMENT_EPS） */
  readonly improved: boolean;
  /** 跳过的坐标极小化次数（三点不可放置/拟合退化/已在精确条件极小/确认未改进） */
  readonly skippedCoordinates: number;
}

/**
 * 种子化精确余弦坐标精修（ECCM / Rotosolve 面）：逐 mixer 坐标
 * Gauss-Seidel 扫描——每坐标 2 个新采样点拟合单余弦（定理见文件头）、
 * 闭式解 [0,bound] 上的精确极小、1 次真实 evaluate 确认，只接受严格
 * 改进步。
 *
 * - specs 列出参与优化的混合角（两值谱生成元，gap 见 MixerAngleSpec）；
 *   其余角度（含全部代价角 γ）保持种子值不动；
 * - 支配性：接受条件 value < current − ANGLE_IMPROVEMENT_EPS，最优快照
 *   从不回退 ⇒ 返回值 ≤ evaluate(seedAngles)（构造性定理）；
 * - 收敛判据：一轮扫描零接受 = 每坐标均在其精确条件极小（Gauss-Seidel
 *   不动点）⇒ 提前终止；
 * - 确定性：restarts=1 无随机性；restarts>1 经 mulberry32(seed) 镜像
 *   optimizeAnglesByCoordinateDescentSeeded 的冷启动公式与逐角消耗次序。
 */
export function refineAnglesByExactCosine(
  evaluate: (angles: number[]) => number,
  seedAngles: readonly number[],
  bounds: readonly number[],
  specs: readonly MixerAngleSpec[],
  options: ExactCosineOptions = {},
): ExactCosineResult {
  if (specs.length === 0) {
    throw new QuantumEngineError(
      'specs must contain at least one mixer angle (empty refinement is a silent no-op)',
    );
  }
  for (let i = 0; i < seedAngles.length; i++) {
    const a = seedAngles[i]!;
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new QuantumEngineError(`seedAngles[${i}] must be a finite number, got ${a}`);
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
  if (bounds.length !== seedAngles.length) {
    throw new QuantumEngineError(
      `bounds length (${bounds.length}) must equal angle count (${seedAngles.length})`,
    );
  }
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i]!;
    if (typeof b !== 'number' || !Number.isFinite(b) || b < 0) {
      throw new QuantumEngineError(`bounds[${i}] must be a finite number >= 0, got ${b}`);
    }
  }
  const sweeps = options.sweeps ?? DEFAULT_ECCM_SWEEPS;
  const restarts = options.restarts ?? 1;
  const seed = options.seed ?? DEFAULT_SEED;
  if (!Number.isInteger(sweeps) || sweeps < 1) {
    throw new QuantumEngineError(`sweeps must be a positive integer, got ${options.sweeps}`);
  }
  if (!Number.isInteger(restarts) || restarts < 1) {
    throw new QuantumEngineError(`restarts must be a positive integer, got ${options.restarts}`);
  }
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new QuantumEngineError(`seed must be a finite number, got ${options.seed}`);
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

  const rng = mulberry32(seed);
  let bestAngles = seedAngles.slice();
  let bestValue = evaluateChecked(bestAngles); // 种子值（= restart 0 的初值评估，不重复计费）
  const seedValue = bestValue;
  let totalSweeps = 0;
  let skippedCoordinates = 0;

  for (let r = 0; r < restarts; r++) {
    // 重启初值：restart 0 = 种子；后续冷启动镜像 CD-seeded 的公式与逐角
    // rng 消耗次序（同 seed ⇒ 逐位相同的重启起点）
    let angles: number[];
    let current: number;
    if (r === 0) {
      angles = seedAngles.slice();
      current = seedValue;
    } else {
      angles = Array.from(
        { length: seedAngles.length },
        (_, i) => rng() * Math.min(bounds[i]!, Math.PI / 2),
      );
      current = evaluateChecked(angles);
    }

    for (let sweep = 0; sweep < sweeps; sweep++) {
      let accepted = false;
      for (const spec of specs) {
        const i = spec.index;
        const bound = bounds[i]!;
        const beta0 = angles[i]!;
        const placement = cosineSampleBetas(beta0, spec.gap, bound);
        if (placement === null) {
          skippedCoordinates++;
          continue;
        }
        // 两点新采样（β₀ 处的值 = current，确定性闭包下逐位一致）
        const probe1 = angles.slice();
        probe1[i] = placement.beta1;
        const v1 = evaluateChecked(probe1);
        const probe2 = angles.slice();
        probe2[i] = placement.beta2;
        const v2 = evaluateChecked(probe2);
        const fit = fitCosine(
          [beta0, placement.beta1, placement.beta2],
          [current, v1, v2],
          spec.gap,
        );
        if (fit.degenerate) {
          skippedCoordinates++;
          continue;
        }
        const betaStar = cosineMinimumInBounds(fit, spec.gap, beta0, bound);
        if (betaStar === beta0) {
          skippedCoordinates++; // 平坦坐标 / 已在精确条件极小
          continue;
        }
        const trial = angles.slice();
        trial[i] = betaStar;
        const trialValue = evaluateChecked(trial); // 真实确认（支配性兜底）
        if (trialValue < current - ANGLE_IMPROVEMENT_EPS) {
          angles = trial;
          current = trialValue;
          accepted = true;
        } else {
          skippedCoordinates++; // 拟合噪声地板上的并列：保持不动
        }
      }
      totalSweeps++;
      if (!accepted) break; // Gauss-Seidel 不动点：每坐标均在精确条件极小
    }

    if (current < bestValue) {
      bestValue = current;
      bestAngles = angles.slice();
    }
  }

  return {
    angles: bestAngles,
    value: bestValue,
    evaluations,
    sweeps: totalSweeps,
    restarts,
    improved: bestValue < seedValue - ANGLE_IMPROVEMENT_EPS,
    skippedCoordinates,
  };
}
