/**
 * parameter-shift —— QAOA 角度的精确参数移位梯度与种子化梯度精修（R14-D）
 *
 * ============ 数学陈述 ============
 *
 * 两值谱参数移位规则：设目标 f(θ) = ⟨ψ(θ)|Ô|ψ(θ)⟩，电路含单参数幺正门
 * U(θ) = e^{−iθG}，生成元 G 的谱**恰为两值** {λ₊, λ₋}（谱隙 Δ = λ₊ − λ₋ > 0），
 * 则梯度有精确的两点表达式：
 *
 *   ∂f/∂θ = (Δ/2)·[ f(θ + π/(2Δ)) − f(θ − π/(2Δ)) ]
 *
 * （参数移位规则；M. Schuld, V. Bergholm, C. Gogolin, J. Izaac,
 * N. Killoran, "Evaluating analytic gradients on quantum hardware",
 * Phys. Rev. A 99, 032331 (2019), arXiv:1811.11184 的一般谱隙形式
 * ——R15 双源核实；单比特旋转的原始形式见 K. Mitarai, M. Negoro,
 * M. Kitagawa, K. Fujii, "Quantum Circuit Learning", Phys. Rev. A 98,
 * 032309 (2018), arXiv:1803.00745。）
 * 关键性质：**精确**——不是有限差分的 O(h²) 截断近似，浮点上只有求值
 * 本身的舍入；与中心差分对拍可在 ~1e-8 内一致（测试钉死）。
 *
 * ============ 本平台两引擎的适用面 ============
 *
 * 1. 全空间 ma-QAOA 逐量子比特混合角：每个 β_{p,q} 单独参数化一个
 *    e^{−iβX_q}（applyMixerAngles 的第 q 分量），X_q 谱 {+1,−1}，Δ=2
 *    ⇒ 梯度 = f(β+π/4) − f(β−π/4)，每次梯度恰 2 次电路评估。
 * 2. 全空间 layer 模式：单一 β 参数化 Π_q e^{−iβX_q}，整体生成元 ΣX_q 的
 *    谱为 {−nq, −nq+2, …, nq}，**不是两值**——但按对易的逐比特门分解 +
 *    链式法则，梯度 = Σ_q [f_q(π/4) − f_q(−π/4)]（f_q(δ) 只移第 q 比特的
 *    角，经 applyMixerAngles 施加）。仍精确，代价 2·nq 次评估。
 * 3. 子空间纤维组混合角：组生成元 A_g = ⊕_fiber (K_{k_f} − I)。
 *    - 无掩码移动混合器：每纤维恰 n−m+1 元 ⇒ 谱 {k−1, −1} 两值，Δ=k；
 *    - 换位混合器（n==m）：纤维 K_2 ⇒ 谱 {1,−1}，Δ=2。
 *    掩码截断会产生异尺寸纤维，或把部分基态留在 ≤1 元纤维（恒等块，
 *    特征值 0 混入谱）——谱多于两值，两点移位不再精确。subspaceMixerGap
 *    对此类组返回 null（诚实边界：不用近似冒充精确，该角度不参与梯度）。
 * 4. 代价角 γ：对角生成元谱一般远多于两值且差集随维度增长，无廉价精确
 *    移位——本模块**不提供**其梯度；精修中 γ 段保持种子值不动（广义
 *    移位/自然梯度的定价见波次设计文档，不实施）。
 *
 * ============ 支配性构造（与 ma-QAOA 同一论证形态） ============
 *
 * refineAnglesByExactGradient 以「现行求解器已收敛的角度」为种子：
 * 梯度步（带步长回缩与 [0,bound] 投影）只在目标**严格改进**
 * （> ANGLE_IMPROVEMENT_EPS）时接受，且最优快照从不回退 ⇒ 返回值
 * ≤ 种子值是构造性定理：精修后的变分目标永不劣于种子——增益可为零
 * （引擎已饱和的 regime），但不可能倒退。
 *
 * ============ 复杂度与边界 ============
 * - 每轮迭代：2·|specs| 次梯度评估 + ≥1 次试探评估；无随机性（纯函数，
 *   同输入同输出），不消耗 RNG 流。
 * - 与既有能力的比较：现行角度优化是导数_free_ 的坐标下降
 *   （optimizeAnglesByCoordinateDescent，模式搜索族）；本模块提供的是
 *   **精确解析梯度通道**（零差分噪声）+ 支配性精修，二者正交可组合
 *   （种子来自坐标下降，精修只在其上改进）。
 * - 本模块是 opt-in 新面：不被任何既有文件 import（编排者收口接线）；
 *   消费方经公共 API（QuantumStateVector / SubspaceState /
 *   expectationValueInto 等）自行构造评估闭包。
 */

import { QuantumEngineError } from '../utils/errors.js';
import {
  ANGLE_IMPROVEMENT_EPS,
  ANGLE_STEP_INITIAL,
  ANGLE_STEP_MIN,
  ANGLE_STEP_SHRINK,
} from './constants.js';
import type { SubspaceModel } from './subspace-optimizer.js';

/** 精修默认迭代轮数 */
const DEFAULT_GRADIENT_ITERATIONS = 20;

/** X 生成元（谱 {+1,−1}）的移位量：π/(2Δ) = π/4 */
const SHIFT_DELTA_GAP_2 = Math.PI / 4;

// ----------------------------------------------------------------------------
// 两值谱移位原语
// ----------------------------------------------------------------------------

/** 单个混合角的移位梯度规格：角度下标 + 生成元谱隙 */
export interface MixerAngleSpec {
  /** 该混合角在 angles 数组中的下标 */
  index: number;
  /** 生成元两谱隙 Δ = λ₊ − λ₋ > 0（全空间逐比特 X：2；子空间均匀 k 纤维：k） */
  gap: number;
}

/**
 * 两值谱移位梯度：∂f/∂angles[index] = (Δ/2)·[f(+π/(2Δ)) − f(−π/(2Δ))]。
 * evaluate 是任意的确定性目标（越小越优）；返回精确梯度（对两值谱生成元）。
 * 调用方负责保证该角度参数化的门生成元恰为两值谱（见文件头适用面）。
 */
export function twoEigenvalueShift(
  evaluate: (angles: number[]) => number,
  angles: readonly number[],
  spec: MixerAngleSpec,
): number {
  validateSpec(spec, angles.length);
  const s = Math.PI / (2 * spec.gap);
  const plus = angles.slice();
  plus[spec.index] = angles[spec.index]! + s;
  const minus = angles.slice();
  minus[spec.index] = angles[spec.index]! - s;
  return (spec.gap / 2) * (evaluate(plus) - evaluate(minus));
}

function validateSpec(spec: MixerAngleSpec, angleCount: number): void {
  if (!Number.isInteger(spec.index) || spec.index < 0 || spec.index >= angleCount) {
    throw new QuantumEngineError(
      `MixerAngleSpec.index must be an integer in [0, ${angleCount}), got ${spec.index}`,
    );
  }
  if (typeof spec.gap !== 'number' || !Number.isFinite(spec.gap) || spec.gap <= 0) {
    throw new QuantumEngineError(
      `MixerAngleSpec.gap must be a positive finite generator spectral gap, got ${spec.gap}`,
    );
  }
}

// ----------------------------------------------------------------------------
// 全空间 layer 模式的逐比特求和梯度
// ----------------------------------------------------------------------------

/**
 * 构造「第 qubit 个混合角移位 δ、其余不动」的 betas 副本
 * （配合 QuantumStateVector.applyMixerAngles 使用）。
 */
export function perQubitShiftedBetas(
  betas: readonly number[],
  qubit: number,
  delta: number,
): number[] {
  if (!Number.isInteger(qubit) || qubit < 0 || qubit >= betas.length) {
    throw new QuantumEngineError(`qubit must be an integer in [0, ${betas.length}), got ${qubit}`);
  }
  const out = betas.slice();
  out[qubit] = betas[qubit]! + delta;
  return out;
}

/**
 * 全空间 layer 模式混合角的精确梯度：β 参数化 Π_q e^{−iβX_q}（整体生成元
 * 多值谱），按对易逐比特门分解 + 链式法则求和：
 *   ∂f/∂β = Σ_q [ f_q(+π/4) − f_q(−π/4) ]
 * f 闭包由调用方提供（对给定 (qubit, delta) 返回只移该比特混合角后的目标值，
 * 经 applyMixerAngles 施加）。精确，代价 2·nqubits 次评估。
 */
export function fullspaceLayerMixerGradient(
  evaluateWithQubitShift: (qubit: number, delta: number) => number,
  nqubits: number,
): number {
  if (!Number.isInteger(nqubits) || nqubits < 1) {
    throw new QuantumEngineError(`nqubits must be a positive integer, got ${nqubits}`);
  }
  let g = 0;
  for (let q = 0; q < nqubits; q++) {
    g +=
      evaluateWithQubitShift(q, SHIFT_DELTA_GAP_2) - evaluateWithQubitShift(q, -SHIFT_DELTA_GAP_2);
  }
  return g;
}

// ----------------------------------------------------------------------------
// 子空间纤维组的谱隙判定
// ----------------------------------------------------------------------------

/**
 * 子空间第 groupIndex 个混合器组的两值谱隙（无掩码移动混合器 = n−m+1；
 * 换位混合器 = 2）；谱多于两值（掩码截断致异尺寸纤维 / 存在 ≤1 元纤维的
 * 恒等块）时返回 null——该组角度无精确两点移位，调用方应将其排除出梯度。
 *
 * 判据：order 覆盖全部 dimension 个基态（否则存在 ≤1 元纤维，特征值 0
 * 混入谱）且 runs 上所有纤维等长 k ≥ 2（此时谱恰为 {k−1, −1}）。
 */
export function subspaceMixerGap(model: SubspaceModel, groupIndex: number): number | null {
  if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex >= model.mixers.length) {
    throw new QuantumEngineError(
      `groupIndex must be an integer in [0, ${model.mixers.length}), got ${groupIndex}`,
    );
  }
  const group = model.mixers[groupIndex]!;
  const runs = group.runs;
  if (runs.length < 2) return null; // 无 ≥2 元纤维：组为恒等，无移位可言
  const k = runs[1]! - runs[0]!;
  if (k < 2) return null;
  for (let i = 2; i + 1 < runs.length; i += 2) {
    if (runs[i + 1]! - runs[i]! !== k) return null; // 异尺寸纤维：多值谱
  }
  if (group.order.length !== model.dimension) return null; // 恒等块残留：特征值 0 混入
  return k;
}

// ----------------------------------------------------------------------------
// 种子化梯度精修（支配性构造）
// ----------------------------------------------------------------------------

/** 梯度精修的可选旋钮 */
export interface GradientRefineOptions {
  /** 梯度步初始步长（默认 ANGLE_STEP_INITIAL = 0.3，与坐标下降同量级） */
  stepInitial?: number;
  /** 最小步长：回缩到低于该值即终止（默认 ANGLE_STEP_MIN） */
  stepMin?: number;
  /** 步长回缩因子，∈ (0,1)（默认 ANGLE_STEP_SHRINK） */
  shrink?: number;
  /** 最大迭代轮数（默认 20） */
  iterations?: number;
}

/** 精修结果：最优角度快照 + 达成的目标值与评估记账 */
export interface GradientRefineResult {
  /** 精修后的角度（从未接受任何劣化步 ⇒ 目标 ≤ 种子） */
  angles: number[];
  /** evaluate(angles) 的值 */
  value: number;
  /** evaluate 的总调用次数（种子 1 + 每轮 2·|specs| 梯度 + 试探） */
  evaluations: number;
  /** 实际执行的迭代轮数（提前收敛时 < iterations） */
  iterations: number;
  /** 是否相对种子严格改进（> ANGLE_IMPROVEMENT_EPS） */
  improved: boolean;
}

/**
 * 种子化精确梯度精修：投影梯度下降 + 步长回缩线搜索，只接受严格改进步。
 *
 * - specs 列出参与梯度的混合角（两值谱生成元，gap 见 MixerAngleSpec）；
 *   其余角度（含全部代价角 γ）保持种子值不动；
 * - 步长日程单调不增：试探失败回缩 shrink，成功后保持当前步长继续；
 * - 支配性：接受条件 value < current − ANGLE_IMPROVEMENT_EPS，最优快照
 *   从不回退 ⇒ 返回值 ≤ evaluate(seedAngles)（构造性定理）；
 * - 确定性：无随机性，同输入同输出，不消耗任何 RNG 流。
 */
export function refineAnglesByExactGradient(
  evaluate: (angles: number[]) => number,
  seedAngles: readonly number[],
  bounds: readonly number[],
  specs: readonly MixerAngleSpec[],
  options: GradientRefineOptions = {},
): GradientRefineResult {
  const stepInitial = options.stepInitial ?? ANGLE_STEP_INITIAL;
  const stepMin = options.stepMin ?? ANGLE_STEP_MIN;
  const shrink = options.shrink ?? ANGLE_STEP_SHRINK;
  const iterations = options.iterations ?? DEFAULT_GRADIENT_ITERATIONS;

  if (specs.length === 0) {
    throw new QuantumEngineError(
      'specs must contain at least one mixer angle (empty refinement is a silent no-op)',
    );
  }
  for (const spec of specs) validateSpec(spec, seedAngles.length);
  if (bounds.length !== seedAngles.length) {
    throw new QuantumEngineError(
      `bounds length (${bounds.length}) must equal angle count (${seedAngles.length})`,
    );
  }
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i]!;
    if (typeof b !== 'number' || !Number.isFinite(b) || b < 0) {
      throw new QuantumEngineError(`bounds[${i}] must be a finite number ≥ 0, got ${b}`);
    }
  }
  if (typeof stepInitial !== 'number' || !Number.isFinite(stepInitial) || stepInitial <= 0) {
    throw new QuantumEngineError(
      `stepInitial must be a positive finite number, got ${options.stepInitial}`,
    );
  }
  if (typeof stepMin !== 'number' || !Number.isFinite(stepMin) || stepMin <= 0) {
    throw new QuantumEngineError(
      `stepMin must be a positive finite number, got ${options.stepMin}`,
    );
  }
  if (typeof shrink !== 'number' || !Number.isFinite(shrink) || shrink <= 0 || shrink >= 1) {
    throw new QuantumEngineError(`shrink must be in (0, 1), got ${options.shrink}`);
  }
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new QuantumEngineError(
      `iterations must be a positive integer, got ${options.iterations}`,
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
  let step = stepInitial;
  let iterationsUsed = 0;

  for (let it = 0; it < iterations; it++) {
    // 梯度：每个混合角两次移位评估（精确，见 twoEigenvalueShift）
    const gradients = new Array<number>(specs.length);
    for (let s = 0; s < specs.length; s++) {
      gradients[s] = twoEigenvalueShift(evaluateChecked, angles, specs[s]!);
    }
    // 投影梯度步 + 回缩线搜索：只接受严格改进
    let accepted = false;
    while (step >= stepMin) {
      const trial = angles.slice();
      for (let s = 0; s < specs.length; s++) {
        const spec = specs[s]!;
        const bound = bounds[spec.index]!;
        trial[spec.index] = Math.min(bound, Math.max(0, trial[spec.index]! - step * gradients[s]!));
      }
      const trialValue = evaluateChecked(trial);
      if (trialValue < value - ANGLE_IMPROVEMENT_EPS) {
        angles = trial;
        value = trialValue;
        accepted = true;
        break;
      }
      step *= shrink;
    }
    iterationsUsed++;
    if (!accepted) break; // 最小步长下仍无改进：收敛终止
  }

  return {
    angles,
    value,
    evaluations,
    iterations: iterationsUsed,
    improved: value < seedValue - ANGLE_IMPROVEMENT_EPS,
  };
}
