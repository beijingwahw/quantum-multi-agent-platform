/**
 * natural-gradient —— 量子自然梯度（Fubini–Study 度规预条件的角度精修，R14-J）
 *
 * ============ 动机 ============
 *
 * 一阶方法（坐标下降 / 参数移位梯度）在 QAOA 损失面上收敛慢，主因之一是
 * 参数几何病态：不同角度方向的「真实距离」由量子态空间的度量决定，欧氏
 * 梯度对此视而不见。自然梯度以 Fubini–Study 度规预条件梯度，
 * 沿态空间真实几何走最陡方向（Stokes 等 2020《Quantum natural gradient》
 * 〔待双源〕；Fubini–Study 度量 / 量子几何张量的几何意义见量子几何
 * 相位文献〔待双源〕）：
 *
 *   θ ← θ − η·(g + λI)⁻¹·∇f，
 *   g_ij = Re(⟨∂_iψ|∂_jψ⟩ − ⟨∂_iψ|ψ⟩⟨ψ|∂_jψ⟩)
 *
 * ============ g 的移位估计推导（两值谱面，精确） ============
 *
 * 设电路 |ψ(θ)⟩ = W·e^{−iθ_iG_i}·V|0⟩（除 θ_i 外全部固定），生成元 G_i
 * 谱**恰为两值** {λ₊, λ₋}，谱隙 Δ = λ₊−λ₋，移位量 s = π/(2Δ)。记谱投影
 * A_± := W e^{−iθ_iG_i}P_±V|0⟩，移位态 |ψ_i^±⟩ = |ψ(θ ± s·e_i)⟩。由
 * e^{∓isG} = e^{∓isλ₋}(P₋ + e^{∓isΔ}P₊)（恒等部分按 λ₋ 锚定分解）：
 *
 *   |ψ_i^±⟩ = e^{∓isλ₋}·(e^{∓isΔ}A₊ + A₋)
 *
 * 定义相位锚定态 ω_i^± := e^{±isλ₋}·ψ_i^±，两式相减：
 *
 *   ω_i⁺ − ω_i⁻ = (e^{−isΔ} − e^{isΔ})·A₊ = −2i·sin(π/2)·A₊ = −2i·A₊
 *
 * 而 ∂_iψ = −i(λ₊A₊ + λ₋A₋) = −iλ₋ψ − iΔA₊，于是
 *
 *   ∂_iψ + iλ₋ψ = (Δ/2)·(ω_i⁺ − ω_i⁻)
 *
 * iλ₋ψ 项沿态射线的切向（纯规范），被 FS 度规的投影 (1−|ψ⟩⟨ψ|) 消去。
 * 记 Ω_i := ω_i⁺ − ω_i⁻，得全部由移位态两两复内积表出的**精确**度规：
 *
 *   g_ij = (Δ_iΔ_j/4)·Re[⟨Ω_i|Ω_j⟩ − ⟨Ω_i|ψ⟩⟨ψ|Ω_j⟩]
 *
 * 经典态矢量模拟下内积逐项精确（无统计估计噪声）；手推解析锚（tests
 * 对拍钉死）：单比特 e^{−iβX}e^{−iγZ}|+⟩ 的 g_ββ = 1−|⟨ψ|X|ψ⟩|² =
 * sin²(2γ)（⟨ψ|X|ψ⟩ = cos2γ），β 任意——公式与该方差形式必须一致。
 *
 * **相位锚需要 λ₋ 本身，仅 gap 不够**：移位态的谱分解系数依赖绝对特征值
 * （λ₋ 与 λ₊ 同增时 gap 不变而移位态相位结构变）。平台全部两值谱混合
 * 生成元的下端恰为 −1：全空间逐量子比特 X_q（谱 {+1,−1}）、子空间移动
 * 混合器 ⊕(K_k−I)（谱 {k−1,−1}）、换位混合器 K₂−I（谱 {1,−1}）——
 * NaturalMixerSpec.lowerEigenvalue 缺省 −1 即锚定于此；谱形不同的两值
 * 生成元必须显式给出，本模块不做静默猜测。
 *
 * ============ 诚实边界 ============
 *
 * - γ 段（对角生成元，谱一般远多于两值）无精确移位估计——与
 *   parameter-shift 同一边界：specs 不含 γ 角，精修中 γ 保持种子值不动；
 *   子空间组的两值谱判定复用 subspaceMixerGap（调用方过滤，掩码截断的
 *   多值谱组被诚实排除而非近似冒充）。
 * - 不宣称普适更优：每轮成本 2K 次目标评估（梯度移位，复用
 *   twoEigenvalueShift）+ 2K+1 次态制备 + O(K²) 个 dim 维复内积 + ≥1 次
 *   试探评估——比一阶梯度精修每轮多付 2K+1 态制备与 K² 内积。与坐标
 *   下降/移位梯度的收敛对照按实例族如实分账（tests 收敛对照），赢要
 *   证据、输要如实。
 * - 阻尼 λ 是超参，缺省 1e-3。理由：g_ii = Var(G) ≤ (Δ/2)²（全空间
 *   逐比特混合角 ≤1），1e-3 = 典型对角元的 0.1%——在舍入地板
 *   （~1e-12·scale，Gram 矩阵对角元 ≤1 的双精度下界）之上约 9 个量级
 *   保 Cholesky 数值稳定，又远小于度规谱的非零部分以保留预条件几何；
 *   秩亏块（如解析锚的 g=½·[[1,1],[1,1]]）由 λ 正则出 1/λ 量级的平坦
 *   方向步长，线搜索自然收缩。
 * - PSD 断言：g 是投影后向量的实 Gram 矩阵 ⇒ 构造性正半定；构建处
 *   断言对角元 ≥ −1e-10（浮点违例 = 输入态非归一/非有限的信号），求
 *   解处 Cholesky 失败则指名抛出（g+λI 非正定）。
 *
 * ============ 支配性构造（与 refineAnglesByExactGradient 同形） ============
 *
 * 以现行求解器已收敛的角度为种子；自然梯度步（g+λI 预条件 + 步长回缩
 * 线搜索 + [0,bound] 投影）只在目标**严格改进**（> ANGLE_IMPROVEMENT_EPS）
 * 时接受，最优快照从不回退 ⇒ 返回值 ≤ 种子值是构造性定理。增益可为零
 * （引擎已饱和的 regime），不可能倒退。
 *
 * ============ 形制 ============
 *
 * - 零依赖、顶层零副作用、opt-in 新面：不被任何既有文件 import（编排者
 *   收口接线）；消费方自行构造 stateAt（态振幅闭包，可复用内部寄存器，
 *   本模块对每次返回做快照）与 evaluate（目标闭包）。
 * - 确定性：纯函数，无随机性，不消耗 RNG 流。
 */

import { QuantumEngineError } from '../utils/errors.js';
import {
  ANGLE_IMPROVEMENT_EPS,
  ANGLE_STEP_INITIAL,
  ANGLE_STEP_MIN,
  ANGLE_STEP_SHRINK,
} from './constants.js';
import { twoEigenvalueShift, type MixerAngleSpec } from './parameter-shift.js';

/** 自然梯度精修默认迭代轮数（每轮含 2K+1 次态制备，较一阶精修贵，从 20 起） */
const DEFAULT_NATURAL_ITERATIONS = 20;

/** 度规阻尼缺省（理由见文件头） */
export const DEFAULT_NATURAL_DAMPING = 1e-3;

/** stateAt 返回态的归一化容差：|Σ|amp|² − 1| 超过即拒绝（度规前提是单位范数） */
const STATE_NORM_TOLERANCE = 1e-6;

/** 度规对角元的 PSD 下界容差（构造性 PSD 的浮点违例检测） */
const METRIC_PSD_DIAG_TOLERANCE = 1e-10;

/** dampedNaturalDirection 入口的对称性容差（构建处保证精确对称，外部输入防走私） */
const SYMMETRY_TOLERANCE = 1e-9;

// ----------------------------------------------------------------------------
// 公共类型
// ----------------------------------------------------------------------------

/**
 * 态的复振幅对（结构类型：ComplexAmplitudes 及其子类 QuantumStateVector /
 * SubspaceState 天然满足）。stateAt 可复用内部寄存器——本模块对每次返回
 * 做快照，调用方无需为并发存活的 2K+1 个态各留一份。
 */
export interface StateAmplitudes {
  readonly re: Readonly<Float64Array>;
  readonly im: Readonly<Float64Array>;
}

/** 自然梯度规格：在 MixerAngleSpec（index + gap）之上增加谱下端相位锚 */
export interface NaturalMixerSpec extends MixerAngleSpec {
  /**
   * 生成元谱下端 λ₋（移位态相位锚，见文件头推导）。缺省 −1 = 平台全部
   * 两值谱混合生成元（X_q / ⊕(K_k−I) / K₂ 换位）的下端取值；谱形
   * {λ₊, λ₋} 非「上端 − 下端 = gap 且下端 = −1」的生成元须显式给出。
   */
  lowerEigenvalue?: number;
}

/** 度规估计结果 */
export interface FubiniStudyMetricResult {
  /** K×K 度规矩阵（构造性对称、正半定；g[i][j] 与 g[j][i] 为同一计算结果） */
  readonly metric: number[][];
  /** stateAt 调用次数（2K+1：基态 + 每参数 ±s_i 移位态） */
  readonly statePreparations: number;
}

/** 自然梯度精修的可选旋钮（前四个与 GradientRefineOptions 同名同义） */
export interface NaturalGradientOptions {
  /** 自然梯度步初始步长（默认 ANGLE_STEP_INITIAL = 0.3，与坐标下降同量级） */
  stepInitial?: number;
  /** 最小步长：回缩到低于该值即终止（默认 ANGLE_STEP_MIN） */
  stepMin?: number;
  /** 步长回缩因子，∈ (0,1)（默认 ANGLE_STEP_SHRINK） */
  shrink?: number;
  /** 最大迭代轮数（默认 20） */
  iterations?: number;
  /** 度规阻尼 λ（g+λI 的 λ，默认 1e-3，理由见文件头） */
  damping?: number;
}

/** 精修结果：最优角度快照 + 目标值与评估/态制备记账 */
export interface NaturalGradientResult {
  /** 精修后的角度（从未接受任何劣化步 ⇒ 目标 ≤ 种子） */
  readonly angles: number[];
  /** evaluate(angles) 的值 */
  readonly value: number;
  /** evaluate 的总调用次数（种子 1 + 每轮 2·|specs| 梯度移位 + 线搜索试探） */
  readonly evaluations: number;
  /** stateAt 的总调用次数（每轮恰 2·|specs|+1：度规的基态与移位态） */
  readonly statePreparations: number;
  /** 实际执行的迭代轮数（提前收敛时 < iterations） */
  readonly iterations: number;
  /** 是否相对种子严格改进（> ANGLE_IMPROVEMENT_EPS） */
  readonly improved: boolean;
}

// ----------------------------------------------------------------------------
// 规格校验与态快照（内部）
// ----------------------------------------------------------------------------

/** 校验后的自然梯度规格：谱隙、移位量与相位锚的展开形式 */
interface ValidatedSpec {
  readonly index: number;
  readonly gap: number;
  /** 移位量 s = π/(2·gap) */
  readonly shift: number;
  /** 谱下端 λ₋ */
  readonly lower: number;
}

function validateNaturalSpecs(
  specs: readonly NaturalMixerSpec[],
  angleCount: number,
): ValidatedSpec[] {
  if (specs.length === 0) {
    throw new QuantumEngineError(
      'specs must contain at least one mixer angle (empty metric/refinement is a silent no-op)',
    );
  }
  const out: ValidatedSpec[] = [];
  for (const spec of specs) {
    if (!Number.isInteger(spec.index) || spec.index < 0 || spec.index >= angleCount) {
      throw new QuantumEngineError(
        `NaturalMixerSpec.index must be an integer in [0, ${angleCount}), got ${spec.index}`,
      );
    }
    if (typeof spec.gap !== 'number' || !Number.isFinite(spec.gap) || spec.gap <= 0) {
      throw new QuantumEngineError(
        `NaturalMixerSpec.gap must be a positive finite generator spectral gap, got ${spec.gap}`,
      );
    }
    const lower = spec.lowerEigenvalue ?? -1;
    if (typeof lower !== 'number' || !Number.isFinite(lower)) {
      throw new QuantumEngineError(
        `NaturalMixerSpec.lowerEigenvalue must be a finite number, got ${spec.lowerEigenvalue}`,
      );
    }
    out.push({ index: spec.index, gap: spec.gap, shift: Math.PI / (2 * spec.gap), lower });
  }
  return out;
}

function validateFiniteAngles(angles: readonly number[], name: string): void {
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i]!;
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new QuantumEngineError(`${name}[${i}] must be a finite number, got ${a}`);
    }
  }
}

/** 校验后的态快照：有限振幅 + 单位范数，独立于调用方寄存器 */
interface StateSnapshot {
  readonly re: Float64Array;
  readonly im: Float64Array;
}

function snapshotStateAt(
  stateAt: (angles: number[]) => StateAmplitudes,
  angles: number[],
): StateSnapshot {
  // 运行时形状守卫（JS 调用方可能返回任意值）：经 unknown 收宽后窄化
  const raw: unknown = stateAt(angles);
  const candidate =
    typeof raw === 'object' && raw !== null ? (raw as { re?: unknown; im?: unknown }) : null;
  if (candidate === null) {
    throw new QuantumEngineError(`stateAt() must return {re, im} Float64Arrays, got ${typeof raw}`);
  }
  const re = candidate.re;
  const im = candidate.im;
  if (!(re instanceof Float64Array) || !(im instanceof Float64Array) || re.length !== im.length) {
    throw new QuantumEngineError(
      `stateAt() must return {re, im} Float64Arrays of equal length, got re=${typeof re}, im=${typeof im}`,
    );
  }
  const dim = re.length;
  if (dim === 0) {
    throw new QuantumEngineError('stateAt() must return a non-empty amplitude pair');
  }
  const outRe = new Float64Array(dim);
  const outIm = new Float64Array(dim);
  let normSq = 0;
  for (let k = 0; k < dim; k++) {
    const r = re[k]!;
    const i = im[k]!;
    if (!Number.isFinite(r) || !Number.isFinite(i)) {
      throw new QuantumEngineError(
        `stateAt() must return finite amplitudes, got re[${k}]=${r}, im[${k}]=${i}`,
      );
    }
    outRe[k] = r;
    outIm[k] = i;
    normSq += r * r + i * i;
  }
  if (Math.abs(normSq - 1) > STATE_NORM_TOLERANCE) {
    throw new QuantumEngineError(
      `stateAt() must return normalized states, got norm²=${normSq} (tolerance ${STATE_NORM_TOLERANCE})`,
    );
  }
  return { re: outRe, im: outIm };
}

// ----------------------------------------------------------------------------
// 度规估计：移位态 Gram 内积 → Fubini–Study 矩阵
// ----------------------------------------------------------------------------

/**
 * 由 2K+1 个态快照（states[0] = 基态 ψ，states[1+2i] = ψ_i⁺，
 * states[2+2i] = ψ_i⁻）组装 Fubini–Study 度规。推导见文件头：
 * g_ij = (Δ_iΔ_j/4)·Re[⟨Ω_i|Ω_j⟩ − ⟨Ω_i|ψ⟩⟨ψ|Ω_j⟩]，Ω_i = ω_i⁺ − ω_i⁻，
 * ω_i^± = e^{±is_iλ₋,i}·ψ_i^±。
 */
function metricFromSnapshots(
  specs: readonly ValidatedSpec[],
  states: readonly StateSnapshot[],
): number[][] {
  const K = specs.length;
  const n = states.length; // 2K+1
  // Gram 矩阵（全填充，共轭对称镜像不重算）：G[p][q] = ⟨state_p|state_q⟩
  const gramRe: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const gramIm: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let p = 1; p < n; p++) {
    const ap = states[p]!;
    const { re: ar, im: ai } = ap;
    const rowRe = gramRe[p]!;
    const rowIm = gramIm[p]!;
    // 索引循环遍历 TypedArray：p/q 为三数组共用下标（bra、ket、镜像行）
    for (let q = 0; q <= p; q++) {
      const { re: br, im: bi } = states[q]!;
      let re = 0;
      let im = 0;
      for (let k = 0; k < ar.length; k++) {
        re += ar[k]! * br[k]! + ai[k]! * bi[k]!;
        im += ar[k]! * bi[k]! - ai[k]! * br[k]!;
      }
      if (p === q) {
        rowRe[p] = re;
        // 对角元虚部为 0（舍入级），按实数使用
      } else {
        rowRe[q] = re;
        rowIm[q] = im;
        gramRe[q]![p] = re;
        gramIm[q]![p] = -im; // 共轭镜像：⟨q|p⟩ = conj(⟨p|q⟩)
      }
    }
  }
  // 相位锚系数：a_i^± = e^{±i·s_i·λ₋,i}
  const anchorPlusRe: number[] = [];
  const anchorPlusIm: number[] = [];
  const anchorMinusRe: number[] = [];
  const anchorMinusIm: number[] = [];
  for (let i = 0; i < K; i++) {
    const spec = specs[i]!;
    const phiPlus = spec.shift * spec.lower;
    anchorPlusRe.push(Math.cos(phiPlus));
    anchorPlusIm.push(Math.sin(phiPlus));
    anchorMinusRe.push(Math.cos(-phiPlus));
    anchorMinusIm.push(Math.sin(-phiPlus));
  }
  // b_i = ⟨Ω_i|ψ⟩ = conj(a_i⁺)·G[i⁺][0] − conj(a_i⁻)·G[i⁻][0]
  const bRe: number[] = [];
  const bIm: number[] = [];
  for (let i = 0; i < K; i++) {
    const plus = 1 + 2 * i;
    const minus = 2 + 2 * i;
    // conj(a^±) = e^{∓iφ}：实部不变、虚部取反
    const cReP = anchorPlusRe[i]!;
    const cImP = -anchorPlusIm[i]!;
    const cReM = anchorMinusRe[i]!;
    const cImM = -anchorMinusIm[i]!;
    const reP = cReP * gramRe[plus]![0]! - cImP * gramIm[plus]![0]!;
    const imP = cReP * gramIm[plus]![0]! + cImP * gramRe[plus]![0]!;
    const reM = cReM * gramRe[minus]![0]! - cImM * gramIm[minus]![0]!;
    const imM = cReM * gramIm[minus]![0]! + cImM * gramRe[minus]![0]!;
    bRe.push(reP - reM);
    bIm.push(imP - imM);
  }
  // g_ij = (Δ_iΔ_j/4)·(Re⟨Ω_i|Ω_j⟩ − Re(b_i·conj(b_j)))
  const metric: number[][] = Array.from({ length: K }, () => new Array<number>(K).fill(0));
  for (let i = 0; i < K; i++) {
    const iP = 1 + 2 * i;
    const iM = 2 + 2 * i;
    for (let j = i; j < K; j++) {
      const jP = 1 + 2 * j;
      const jM = 2 + 2 * j;
      // ⟨Ω_i|Ω_j⟩ = Σ_{σ,τ∈{+,−}} σ·τ·conj(a_i^σ)·a_j^τ·G[iσ][jτ]（只需实部）
      let re = 0;
      for (const si of [1, -1]) {
        for (const sj of [1, -1]) {
          const bra = si > 0 ? iP : iM;
          const ket = sj > 0 ? jP : jM;
          // conj(a_i^σ)·a_j^τ = (x − iy)(u + iv) = (xu + yv) + i(xv − yu)
          const x = si > 0 ? anchorPlusRe[i]! : anchorMinusRe[i]!;
          const y = si > 0 ? anchorPlusIm[i]! : anchorMinusIm[i]!;
          const u = sj > 0 ? anchorPlusRe[j]! : anchorMinusRe[j]!;
          const v = sj > 0 ? anchorPlusIm[j]! : anchorMinusIm[j]!;
          const cRe = x * u + y * v;
          const cIm = x * v - y * u;
          re += si * sj * (cRe * gramRe[bra]![ket]! - cIm * gramIm[bra]![ket]!);
        }
      }
      const entry =
        specs[i]!.gap * specs[j]!.gap * 0.25 * (re - (bRe[i]! * bRe[j]! + bIm[i]! * bIm[j]!));
      metric[i]![j] = entry;
      metric[j]![i] = entry; // 同一计算结果镜像：构造性精确对称
    }
  }
  // PSD 断言（构造性 PSD 的浮点违例检测）：对角元是投影向量范数平方，必 ≥ 0
  for (let i = 0; i < K; i++) {
    if (metric[i]![i]! < -METRIC_PSD_DIAG_TOLERANCE) {
      throw new QuantumEngineError(
        `Fubini–Study metric must be positive semidefinite, got g[${i}][${i}]=${metric[i]![i]!} (construction implies ≥ 0; check stateAt normalization)`,
      );
    }
  }
  return metric;
}

/** 在 angles 处估计度规：准备基态与 2K 个移位态并组装（stateAt 由调用方包装计数/校验） */
function metricAt(
  stateAt: (angles: number[]) => StateSnapshot,
  angles: readonly number[],
  specs: readonly ValidatedSpec[],
): number[][] {
  const states: StateSnapshot[] = [stateAt(angles.slice())];
  for (const spec of specs) {
    const plus = angles.slice();
    plus[spec.index] = plus[spec.index]! + spec.shift;
    states.push(stateAt(plus));
    const minus = angles.slice();
    minus[spec.index] = minus[spec.index]! - spec.shift;
    states.push(stateAt(minus));
  }
  return metricFromSnapshots(specs, states);
}

/**
 * Fubini–Study 度规的精确移位估计（两值谱面）。specs 的每个角度独立参数化
 * 一个 e^{−iθG}（G 谱恰两值，见 NaturalMixerSpec）；γ 段（对角生成元，
 * 多值谱）不在此面——调用方不得为其构造 spec（复用 subspaceMixerGap 判定）。
 *
 * 返回 K×K 对称正半定矩阵与 stateAt 调用记账（恰 2K+1）。stateAt 可复用
 * 内部寄存器（返回值被快照）；态必须归一（|norm²−1| ≤ 1e-6）且振幅有限，
 * 否则指名拒绝——非归一态会让度规静默失真。
 */
export function fubiniStudyMetric(
  stateAt: (angles: number[]) => StateAmplitudes,
  angles: readonly number[],
  specs: readonly NaturalMixerSpec[],
): FubiniStudyMetricResult {
  validateFiniteAngles(angles, 'angles');
  const validated = validateNaturalSpecs(specs, angles.length);
  let statePreparations = 0;
  const countedStateAt = (a: number[]): StateSnapshot => {
    statePreparations++;
    return snapshotStateAt(stateAt, a);
  };
  const metric = metricAt(countedStateAt, angles, validated);
  return { metric, statePreparations };
}

// ----------------------------------------------------------------------------
// λI 阻尼 Cholesky：自然梯度方向 (g + λI)·d = ∇f
// ----------------------------------------------------------------------------

/** Cholesky 分解 A = L·Lᵀ（A 已含阻尼）；非正定返回 null（调用方指名抛出） */
function choleskyDecompose(
  a: ReadonlyArray<readonly number[]>,
  damping: number,
): number[][] | null {
  const n = a.length;
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    const Li = L[i]!;
    const Ai = a[i]!;
    for (let j = 0; j <= i; j++) {
      const Lj = L[j]!;
      let sum = Ai[j]! + (i === j ? damping : 0);
      for (let k = 0; k < j; k++) sum -= Li[k]! * Lj[k]!;
      if (i === j) {
        if (!(sum > 0)) return null; // 含 NaN 防走私：NaN > 0 为假
        Li[i] = Math.sqrt(sum);
      } else {
        Li[j] = sum / Lj[j]!;
      }
    }
  }
  return L;
}

/**
 * λI 阻尼的自然梯度方向：解 (g + λI)·d = ∇f（Cholesky）。
 * g 正半定 + λ>0 ⇒ 系数矩阵正定 ⇒ d 与 ∇f 同向分量恒正（下降方向）：
 * ∇fᵀd = ∇fᵀ(g+λI)⁻¹∇f > 0（∇f ≠ 0 时）。矩阵须方阵、有限、对称
 * （1e-9 容差）；Cholesky 失败（g+λI 非正定——g 病态/负定或 λ 不足）
 * 指名抛出，不走伪逆静默兜底。
 */
export function dampedNaturalDirection(
  metric: ReadonlyArray<readonly number[]>,
  gradient: readonly number[],
  damping: number,
): number[] {
  const n = metric.length;
  if (!Number.isInteger(n) || n < 1) {
    throw new QuantumEngineError(`metric must be a non-empty square matrix, got ${n} rows`);
  }
  for (let i = 0; i < n; i++) {
    const row = metric[i]!;
    if (row.length !== n) {
      throw new QuantumEngineError(`metric must be square, got row ${i} of length ${row.length}`);
    }
    for (let j = 0; j < row.length; j++) {
      const v = row[j]!;
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new QuantumEngineError(`metric[${i}][${j}] must be a finite number, got ${v}`);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const a = metric[i]![j]!;
      const b = metric[j]![i]!;
      if (Math.abs(a - b) > SYMMETRY_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b))) {
        throw new QuantumEngineError(
          `metric must be symmetric, got metric[${i}][${j}]=${a} vs metric[${j}][${i}]=${b}`,
        );
      }
    }
  }
  if (gradient.length !== n) {
    throw new QuantumEngineError(
      `gradient length (${gradient.length}) must match metric dimension (${n})`,
    );
  }
  for (let i = 0; i < gradient.length; i++) {
    const v = gradient[i]!;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new QuantumEngineError(`gradient[${i}] must be a finite number, got ${v}`);
    }
  }
  if (typeof damping !== 'number' || !Number.isFinite(damping) || damping <= 0) {
    throw new QuantumEngineError(`damping must be a positive finite number, got ${damping}`);
  }
  const L = choleskyDecompose(metric, damping);
  if (L === null) {
    throw new QuantumEngineError(
      `damped metric (g + ${damping}·I) is not positive definite (Cholesky failed): metric is indefinite/ill-conditioned and the damping is insufficient`,
    );
  }
  // 前代 L·y = ∇f，回代 Lᵀ·d = y
  const y = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = gradient[i]!;
    const Li = L[i]!;
    for (let k = 0; k < i; k++) sum -= Li[k]! * y[k]!;
    y[i] = sum / Li[i]!;
  }
  const d = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i]!;
    for (let k = i + 1; k < n; k++) sum -= L[k]![i]! * d[k]!;
    d[i] = sum / L[i]![i]!;
  }
  for (const v of d) {
    if (!Number.isFinite(v)) {
      throw new QuantumEngineError(
        `damped natural direction contains non-finite entries (damping=${damping})`,
      );
    }
  }
  return d;
}

// ----------------------------------------------------------------------------
// 种子化自然梯度精修（支配性构造）
// ----------------------------------------------------------------------------

/**
 * 种子化量子自然梯度精修：每轮以 twoEigenvalueShift 精确估计梯度、以移位态
 * Gram 内积精确估计 Fubini–Study 度规，解 (g+λI)·d = ∇f 得预条件方向，
 * 投影自然梯度步 + 步长回缩线搜索，只接受严格改进步。
 *
 * - specs 列出参与优化的混合角（两值谱生成元，gap/lowerEigenvalue 见
 *   NaturalMixerSpec）；其余角度（含全部代价角 γ）保持种子值不动；
 * - 支配性：接受条件 value < current − ANGLE_IMPROVEMENT_EPS，最优快照
 *   从不回退 ⇒ 返回值 ≤ evaluate(seedAngles)（构造性定理）；
 * - 记账：evaluations = 种子 1 + 每轮（2·|specs| 梯度移位 + 线搜索试探 ≥1）；
 *   statePreparations = 每轮恰 2·|specs|+1（度规的基态与移位态）；
 * - 确定性：无随机性，同输入同输出，不消耗任何 RNG 流。
 */
export function refineAnglesByNaturalGradient(
  stateAt: (angles: number[]) => StateAmplitudes,
  evaluate: (angles: number[]) => number,
  seedAngles: readonly number[],
  bounds: readonly number[],
  specs: readonly NaturalMixerSpec[],
  options: NaturalGradientOptions = {},
): NaturalGradientResult {
  validateFiniteAngles(seedAngles, 'seedAngles');
  const validated = validateNaturalSpecs(specs, seedAngles.length);
  const stepInitial = options.stepInitial ?? ANGLE_STEP_INITIAL;
  const stepMin = options.stepMin ?? ANGLE_STEP_MIN;
  const shrink = options.shrink ?? ANGLE_STEP_SHRINK;
  const iterations = options.iterations ?? DEFAULT_NATURAL_ITERATIONS;
  const damping = options.damping ?? DEFAULT_NATURAL_DAMPING;

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
  if (typeof damping !== 'number' || !Number.isFinite(damping) || damping <= 0) {
    throw new QuantumEngineError(
      `damping must be a positive finite number, got ${options.damping}`,
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
  let statePreparations = 0;
  const stateAtChecked = (a: number[]): StateSnapshot => {
    statePreparations++;
    return snapshotStateAt(stateAt, a);
  };

  let angles = seedAngles.slice();
  let value = evaluateChecked(angles);
  const seedValue = value;
  let step = stepInitial;
  let iterationsUsed = 0;

  for (let it = 0; it < iterations; it++) {
    // 梯度：每个混合角两次移位评估（精确，twoEigenvalueShift 复用）
    const gradient = validated.map((spec) => twoEigenvalueShift(evaluateChecked, angles, spec));
    // 度规：2K+1 个态制备 + O(K²) dim 维内积（精确移位估计）
    const metric = metricAt(stateAtChecked, angles, validated);
    // 预条件方向：(g+λI)d = ∇f（正定 ⇒ 下降方向）
    const direction = dampedNaturalDirection(metric, gradient, damping);
    // 投影自然梯度步 + 回缩线搜索：只接受严格改进
    let accepted = false;
    while (step >= stepMin) {
      const trial = angles.slice();
      for (let s = 0; s < validated.length; s++) {
        const index = validated[s]!.index;
        const bound = bounds[index]!;
        trial[index] = Math.min(bound, Math.max(0, trial[index]! - step * direction[s]!));
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
    statePreparations,
    iterations: iterationsUsed,
    improved: value < seedValue - ANGLE_IMPROVEMENT_EPS,
  };
}
