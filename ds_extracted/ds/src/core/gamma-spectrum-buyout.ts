/**
 * gamma-spectrum-buyout —— γ 段谱差三角多项式买断（R18-D）
 *
 * ============ 动机（本仓最后一块「域外冻结」的角度段） ============
 *
 * 平台优化器精确族的三块既有面全部止步于混合角 β：
 * - parameter-shift（R14-D）：两值谱生成元的精确移位梯度；
 * - natural-gradient（R14-J）：两值谱面的 Fubini–Study 度规移位估计；
 * - ECCM / exact-cosine-coordinate（R16）：两值谱面的单余弦定理 +
 *   三点闭式全局极小。
 * 三者共享同一条诚实边界：**γ 段（代价角，对角生成元 C 的多值谱）域外
 * 冻结——精修中 γ 保持种子值不动**。本模块把该边界的可证部分补上：
 * 代价角的多值谱虽然不能两点移位、也不能单余弦刻画，但它是**有限频率
 * 的三角多项式**——频率集合（谱差集）在构建期完全已知，可被一次性
 * **买断**：2M+1 次电路评估精确恢复 f(γ) 的全部 Fourier 系数，此后
 * 该 γ 坐标的任意点求值、梯度、全局最小化（带证书）全部闭式完成，
 * 不再消耗任何电路评估。
 *
 * ============ 定理（先证后码） ============
 *
 * 【T1 · 有限三角多项式结构】设电路 |ψ(γ)⟩ = W·e^{−iγC}·V|φ⟩：除 γ 外
 * 全部角度固定（V = γ 门之前的全部电路，W = 之后的全部电路），C 为
 * 对角厄米（计算基能量表 E_1..E_dim），O 为与 γ 无关的厄米（期望目标，
 * 平台口径 O = C）。则期望目标是实三角多项式
 *
 *   f(γ) = ⟨ψ(γ)|O|ψ(γ)⟩ = c₀ + Σ_{r=1}^{R} [a_r·cos(d_r·γ) + b_r·sin(d_r·γ)]
 *
 * 其中 {d_r}_{r=1..R} 是谱差集 D = {|E_i − E_j| : i ≠ j} 的全部互异正
 * 值，R ≤ dim·(dim−1)/2。证明：e^{−iγC} = Σ_i e^{−iγE_i}P_i（P_i 计算
 * 基投影），f(γ) = Σ_{i,j} e^{i(E_i−E_j)γ}·⟨WP_iVφ|O|WP_jVφ⟩；i=j 项
 * 与 γ 无关（合并为 c₀）；i≠j 与 j=i 交叉项共轭配对，e^{idγ}·z +
 * e^{−idγ}·z̄ = 2Re(z)·cos(dγ) − 2Im(z)·sin(dγ)。∎
 * （ECCM 的单余弦定理即本定理 R=1 的特例：两值谱 ⟹ 差集单点。）
 *
 * 【T2 · 均匀网格可解性】若全部 d_r 是某基频 g>0 的整数倍
 * （d_r = m_r·g，m_r ∈ {1..M}，M = max m_r——「可公度」），则 f 以
 * T = 2π/g 为周期。在 γ_j = j·T/N（j = 0..N−1，N = 2M+1）均匀采样
 * N 点，系数经离散 Fourier 变换精确恢复：
 *   F_m = (1/N)·Σ_j f(γ_j)·e^{−2πimj/N}，c₀ = F_0，
 *   a_r = 2Re F_{m_r}，b_r = −2Im F_{m_r}。
 * 正交性：Σ_j e^{2πi(m−m')j/N} = N·δ_{m≡m' (mod N)}；谐波 m_r ≤ M <
 * N/2 无混叠，不同 m_r 互异 ⇒ 基函数线性无关 ⇒ 恢复唯一。∎
 *
 * 【T3 · 网格极小的 Lipschitz 证书】f 每项导数 |a_r·d_r·sin − b_r·d_r·cos|
 * ≤ d_r·√(a_r²+b_r²)，故 L₁ := Σ_r d_r·√(a_r²+b_r²) ≥ sup|f′|。在
 * [0,bound] 上取 N_g 个等距格点（间距 h），任意 γ ∈ [0,bound] 距最近
 * 格点 ≤ h/2 ⇒ f(γ) ≥ gridMin − L₁·h/2。于是**真全局极小值被夹逼**：
 *
 *   gridMin − L₁·h/2 ≤ min_{[0,bound]} f ≤ gridMin，
 *
 * 区间宽度 gap = L₁·h/2 = L₁·bound/(2(N_g−1)) 随 N_g 收缩到任意目标
 * ε（可证收缩——证书不含任何未经验证的假设）。∎
 *
 * 【T4 · 免费精确梯度】买断后 f′(γ) = Σ_r d_r·[−a_r·sin(d_rγ) +
 * b_r·cos(d_rγ)] 同频闭式——γ 段的精确解析梯度（多值谱生成元上的
 * 「广义移位」替代面：不求和移位评估，直接买断整条曲线）。
 *
 * ============ 诚实边界（全部可查证，不冒充） ============
 *
 * - **谱过密即拒**：差集基频谐波数 M 超过采样预算（2M+1 > maxSamples，
 *   缺省 257）时 analyze 返回 'spectrum-too-dense'——连续量化权重
 *   （如三位小数）的能量谱差集 ~10³ 谐波，买断成本超过坐标下降，本
 *   模块诚实拒绝而不是加噪声近似冒充。适用域是**粗量化 / 整数 /
 *   低维小谱**的问题（机制设计分值、整数福利、小批量调度）。
 * - **不可公度即拒**：差集无公度基频（如 {1, √2} 型）时返回
 *   'incommensurable'——均匀网格的混叠定理前提（T2）失效，本模块不
 *   提供非均匀贪心采样的病态拟合（设计候选，见报告）。
 * - **定理前提走私自检**：T1 要求该角度单独参数化一个对角门且目标为
 *   双线性期望。调用方把非电路目标（或 CVaR 等非线性目标闭包）接进
 *   evaluate 时，买断自带确定性 outlier 探针（probeSamples 个黄金比
 *   错位点）与杂散谐波审计（maxSpuriousAmplitude）：|闭式值 − 真实
 *   评估| 或杂散幅度超容差 ⇒ 具名抛出（residual mismatch），不用
 *   病态拟合冒充精确。CVaR_α 目标（分段非线性）明确域外。
 * - **证书是拟合多项式的证书**：T3 的夹逼对**已买断的三角多项式**
 *   精确成立；拟合系数与真实电路的偏差由探针审计兜底（1e-6 级），
 *   精修入口的支配性由真实评估确认兜底（T3 证书不进入支配性主张）。
 * - **买断是逐坐标、逐轮的**：其余角度（含其他 γ）变动后该 γ 曲线
 *   随之改变，每轮 Gauss-Seidel 扫描需重新买断（每坐标 2M+1+probes
 *   次评估，诚实记账）。谱差分析（T1/T2 的结构部分）对同一能量表只
 *   做一次。
 * - **不宣称普适更优**：与坐标下降的对比按实例族双轴（质量 × 评估
 *   成本）如实分账（tests 对拍），赢要证据、输要如实。
 *
 * ============ 文献接地（形状级；〔待双源〕不凭记忆写编号） ============
 *
 * 变分电路期望目标的有限 Fourier 级数结构：Schuld-Sweke-Meyer 2021，
 * "Effect of data encoding on the expressive power of variational
 * quantum machine learning models"〔待双源〕。两值谱单频率闭式极小的
 * Rotosolve 面（本模块 R=1 特例的先行工作）：Ostaszewski-Grant-
 * Benedetti 2021, "Structure optimization for parameterized quantum
 * circuits"（R15 台账已双源）。多值谱生成元的广义参数移位规则族：
 * Wierichs-Baum-Izaac-Schuld-Cerf 2022, "General parameter-shift
 * rules for quantum gradients"〔待双源〕。等距节点三角插值的 DFT
 * 精确可逆性（Nyquist/正交性）为经典结果，见任一标准离散信号处理
 * 文本（如 Oppenheim-Schafer 离散时间信号处理教材）〔待双源〕。
 *
 * ============ 形制 ============
 *
 * 零外部依赖（仓内 import：errors/constants）；顶层零副作用；opt-in
 * 新面：不被任何既有文件 import（编排者收口统一接线）；纯确定（无
 * RNG、无时钟——同输入同输出，探针位置由黄金比常数确定性生成）。
 */

import { QuantumEngineError } from '../utils/errors.js';
import { ANGLE_IMPROVEMENT_EPS } from './constants.js';

// ----------------------------------------------------------------------------
// 常量（缺省值全部在此点名，可发现性优先）
// ----------------------------------------------------------------------------

/** 谱差分析的维度上限：差集计算 O(dim²)，买断只对小谱实例有意义 */
const DEFAULT_MAX_DIMENSION = 4096;

/** 采样预算上限：N = 2M+1 ≤ maxSamples（缺省 257 ⇒ 最高谐波 M ≤ 128） */
const DEFAULT_MAX_SAMPLES = 257;

/**
 * 差值聚类容差（相对谱宽）：量化噪声 / 浮点舍入的吸收带。归一化谱宽
 * ~1 ⇒ 绝对容差 ~1e-9，比能量计算的浮点噪声（~1e-15·dim）高约 6 个
 * 量级，比真实谱结构（不同差值至少差一个基频 g ≥ 1/M ≥ 1/128 ≈ 8e-3）
 * 低约 6 个量级——两端都有裕度。
 */
const CLUSTER_REL_TOL = 1e-9;

/** 基频候选枚举：g = dMin / k 的除数上限（有理调和的常见分母范围） */
const GCD_CANDIDATE_DIVISORS = 12;

/** 谐波闭合容差（相对差值）：|d_r − m_r·g|/d_r 超过即判不可公度 */
const COMMENSURABILITY_REL_TOL = 1e-6;

/** 买断自检（探针 + 杂散谐波）的统一容差：结构失配 O(1)，舍入 ~1e-13 */
const RESIDUAL_TOLERANCE = 1e-6;

/** 探针缺省个数（黄金比错位确定性布点；0 = 显式关闭，风险自负） */
const DEFAULT_PROBE_SAMPLES = 2;

/** 网格最小化缺省目标精度（T3 证书 gap 上界） */
const DEFAULT_TARGET_EPS = 1e-9;

/** 网格点数上限（闭式求值便宜，但证书打印与审计保持有界） */
const DEFAULT_MAX_GRID = 65_536;

/** 精修缺省 Gauss-Seidel 扫描轮数上限（零接受轮早停） */
const DEFAULT_SWEEPS = 4;

/** 黄金比小数部分：确定性探针布点（与任何有理周期不共振） */
const GOLDEN_FRACTION = 0.6180339887498949;

// ----------------------------------------------------------------------------
// 第一层：谱差分析（T1/T2 的结构面，纯函数）
// ----------------------------------------------------------------------------

/** 谱差分析的可选旋钮 */
export interface GammaSpectrumOptions {
  /** 采样预算上限：N = 2M+1 ≤ maxSamples（缺省 257） */
  maxSamples?: number;
  /** 能量表维度上限（缺省 4096；差集计算 O(dim²)） */
  maxDimension?: number;
}

/** 谱差分析成功：买断所需的全部结构信息 */
export interface GammaSpectrum {
  /** 判别标记（与 GammaSpectrumFailure 的 ok:false 组成可判别联合） */
  readonly ok: true;
  /** 互异正差值（聚类代表，升序），d_r = m_r·g */
  readonly differences: readonly number[];
  /** 公度基频 g > 0（d_r/g 全部为整数） */
  readonly fundamental: number;
  /** 谐波号 m_r = round(d_r/g)（升序互异，与 differences 同序） */
  readonly harmonics: readonly number[];
  /** 最高谐波 M = max m_r */
  readonly maxHarmonic: number;
  /** 买断采样数 N = 2M+1（T2 的无混叠采样） */
  readonly sampleCount: number;
  /** 周期 T = 2π/g */
  readonly period: number;
  /** 能量表的不同取值个数（谱的互异值数，审计面） */
  readonly distinctEnergies: number;
}

/** 谱差分析失败（具名原因——诚实拒绝，不用近似冒充） */
export type GammaSpectrumFailure = {
  readonly ok: false;
  readonly reason:
    | 'degenerate-spectrum' // 谱宽为 0：全部能量相等，γ 曲线恒常数
    | 'dimension-cap' // dim > maxDimension：差集计算超预算
    | 'incommensurable' // 差集无公度基频：T2 混叠定理前提失效
    | 'spectrum-too-dense'; // M 超预算：买断成本超过坐标下降
  /** 诊断明细（原因相关的最小事实，供报告） */
  readonly detail: string;
};

export type GammaSpectrumResult = GammaSpectrum | GammaSpectrumFailure;

/**
 * 分析对角能量表的谱差结构（T1 频率集 + T2 可公度性）。
 *
 * - 差值在 CLUSTER_REL_TOL·谱宽 容差内聚类（量化噪声吸收）；
 * - 基频候选按 dMin/k（k = 1..12）枚举，首个全部整除者胜出；
 * - 成功返回买断结构（differences/fundamental/harmonics/N/period），
 *   失败返回具名原因。energies 必须与 evaluate 电路实际施加的（归一化）
 *   能量表一致——差集就是电路 e^{−iγC} 生成元的谱差。
 */
export function analyzeGammaSpectrum(
  energies: Readonly<Float64Array> | readonly number[],
  options: GammaSpectrumOptions = {},
): GammaSpectrumResult {
  const maxSamples = options.maxSamples ?? DEFAULT_MAX_SAMPLES;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  if (!Number.isInteger(maxSamples) || maxSamples < 5 || maxSamples % 2 === 0) {
    throw new QuantumEngineError(
      `maxSamples must be an odd integer >= 5 (N = 2M+1), got ${String(options.maxSamples)}`,
    );
  }
  if (!Number.isInteger(maxDimension) || maxDimension < 2) {
    throw new QuantumEngineError(
      `maxDimension must be an integer >= 2, got ${String(options.maxDimension)}`,
    );
  }
  if (energies.length < 2) {
    throw new QuantumEngineError(
      `energies must contain at least 2 entries (single-state spectrum has no differences), got ${energies.length}`,
    );
  }
  if (energies.length > maxDimension) {
    return {
      ok: false,
      reason: 'dimension-cap',
      detail: `dimension ${energies.length} exceeds cap ${maxDimension} (pairwise difference set is O(dim^2))`,
    };
  }
  // 能量值域与聚类容差
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < energies.length; k++) {
    const e = energies[k]!;
    if (typeof e !== 'number' || !Number.isFinite(e)) {
      throw new QuantumEngineError(
        `energies[${k}] must be a finite number, got ${String(e)} (non-finite spectrum corrupts the difference set)`,
      );
    }
    if (e < min) min = e;
    if (e > max) max = e;
  }
  const span = max - min;
  if (span <= 0) {
    return {
      ok: false,
      reason: 'degenerate-spectrum',
      detail: 'all energies equal: f(gamma) is constant in gamma (no phase structure to buy out)',
    };
  }
  const clusterTol = Math.max(span * CLUSTER_REL_TOL, 1e-15);
  // 互异能量聚类（供审计面 distinctEnergies）
  const energyClusters = new Map<number, { sum: number; count: number }>();
  for (const e of energies) {
    const key = Math.round((e - min) / clusterTol);
    const c = energyClusters.get(key);
    if (c) {
      c.sum += e - min;
      c.count++;
    } else {
      energyClusters.set(key, { sum: e - min, count: 1 });
    }
  }
  // 差集聚类：O(n²) 对全部有序对，key = round(|d|/clusterTol)
  const diffClusters = new Map<number, { sum: number; count: number }>();
  for (let i = 0; i < energies.length; i++) {
    for (let j = i + 1; j < energies.length; j++) {
      const d = Math.abs(energies[i]! - energies[j]!);
      if (d <= clusterTol) continue; // 同簇能量对的零差
      const key = Math.round(d / clusterTol);
      const c = diffClusters.get(key);
      if (c) {
        c.sum += d;
        c.count++;
      } else {
        diffClusters.set(key, { sum: d, count: 1 });
      }
    }
  }
  const differences = [...diffClusters.values()].map((c) => c.sum / c.count).sort((a, b) => a - b);
  if (differences.length === 0) {
    return {
      ok: false,
      reason: 'degenerate-spectrum',
      detail: 'no positive differences above cluster tolerance (spectrum collapsed to one value)',
    };
  }
  // 基频候选枚举：g = dMin / k，首个全部整除者胜出
  const dMin = differences[0]!;
  let fundamental: number | null = null;
  for (let k = 1; k <= GCD_CANDIDATE_DIVISORS && fundamental === null; k++) {
    const g = dMin / k;
    if (!(g > 0) || !Number.isFinite(g)) continue;
    let allIntegral = true;
    for (const d of differences) {
      const m = Math.round(d / g);
      if (m < 1 || Math.abs(d - m * g) > Math.max(2 * clusterTol, COMMENSURABILITY_REL_TOL * d)) {
        allIntegral = false;
        break;
      }
    }
    if (allIntegral) fundamental = g;
  }
  if (fundamental === null) {
    return {
      ok: false,
      reason: 'incommensurable',
      detail: `difference set (min=${dMin.toExponential(3)}, ${differences.length} distinct values) admits no common fundamental among divisors dMin/1..dMin/${GCD_CANDIDATE_DIVISORS}`,
    };
  }
  const g = fundamental;
  const harmonics = differences.map((d) => Math.round(d / g));
  const M = harmonics[harmonics.length - 1]!;
  const N = 2 * M + 1;
  if (N > maxSamples) {
    return {
      ok: false,
      reason: 'spectrum-too-dense',
      detail: `max harmonic M=${M} needs N=${N} samples > budget ${maxSamples} (${differences.length} distinct differences; buyout would cost more than coordinate descent)`,
    };
  }
  return {
    ok: true,
    differences,
    fundamental: g,
    harmonics,
    maxHarmonic: M,
    sampleCount: N,
    period: (2 * Math.PI) / g,
    distinctEnergies: energyClusters.size,
  };
}

// ----------------------------------------------------------------------------
// 第二层：γ 曲线买断（T2 的采样面 + 自检，纯函数）
// ----------------------------------------------------------------------------

/** 买断的可选旋钮 */
export interface BuyoutOptions {
  /** outlier 探针个数（缺省 2；0 = 显式关闭走私自检，风险自负） */
  probeSamples?: number;
  /** 探针与杂散谐波的失配容差（缺省 1e-6；结构失配 O(1)，舍入 ~1e-13） */
  residualTolerance?: number;
}

/** 一次成功买断：全部 Fourier 系数 + 闭式求值/梯度 + 审计面 */
export interface GammaCurveBuyout {
  readonly spectrum: GammaSpectrum;
  /** 常数项 c₀ */
  readonly c0: number;
  /** 余弦系数 a_r（与 spectrum.differences 同序） */
  readonly cosCoefficients: readonly number[];
  /** 正弦系数 b_r（与 spectrum.differences 同序） */
  readonly sinCoefficients: readonly number[];
  /** 杂散谐波幅度（非谐波号上的最大 |F_m|·2，真实电路应 ~1e-13） */
  readonly maxSpuriousAmplitude: number;
  /** 探针实测的最大 |闭式值 − 真实评估|（0 个探针时为 0） */
  readonly maxProbeResidual: number;
  /** 本买断消耗的 evaluate 次数（N 采样 + probes 探针） */
  readonly evaluations: number;
}

/** 买断曲线的闭式求值：f(γ) = c₀ + Σ a_r cos(d_r γ) + b_r sin(d_r γ) */
export function gammaCurveValueAt(buyout: GammaCurveBuyout, gamma: number): number {
  const { differences } = buyout.spectrum;
  const { cosCoefficients, sinCoefficients, c0 } = buyout;
  let v = c0;
  for (let r = 0; r < differences.length; r++) {
    const d = differences[r]!;
    v += cosCoefficients[r]! * Math.cos(d * gamma) + sinCoefficients[r]! * Math.sin(d * gamma);
  }
  return v;
}

/** 买断曲线的闭式精确梯度（T4）：f′(γ) = Σ d_r·[−a_r sin + b_r cos] */
export function gammaCurveDerivativeAt(buyout: GammaCurveBuyout, gamma: number): number {
  const { differences } = buyout.spectrum;
  const { cosCoefficients, sinCoefficients } = buyout;
  let v = 0;
  for (let r = 0; r < differences.length; r++) {
    const d = differences[r]!;
    v +=
      d * (sinCoefficients[r]! * Math.cos(d * gamma) - cosCoefficients[r]! * Math.sin(d * gamma));
  }
  return v;
}

/**
 * 买断单个 γ 坐标的目标曲线：在完整周期上均匀采样 N = 2M+1 点、朴素 DFT
 * 精确恢复 Fourier 系数（T2），再经 outlier 探针自检定理前提（T1 的
 * 对角门 + 双线性期望）。evaluate 是「其余角度固定、只改 angles[gammaIndex]」
 * 的确定性目标闭包（与 ECCM/parameter-shift 的 evaluate 契约同形）。
 *
 * - 采样点 γ_j = j·T/N：**不钳入 [0,bound]**——买断在完整周期上恢复
 *   系数，[0,bound] 只是其后最小化的搜索域（T < bound 时周期重叠无损，
 *   T > bound 时补全相位信息）；
 * - 探针（probeSamples 个黄金比错位点，落于 [0,bound]）对比闭式值与
 *   真实评估，超容差 ⇒ 具名抛出（定理前提被走私，不用病态拟合冒充）；
 * - 杂散谐波（非谐波号上的 DFT 幅度）同容差审计。
 */
export function buyoutGammaCurve(
  evaluate: (angles: number[]) => number,
  angles: readonly number[],
  gammaIndex: number,
  spectrum: GammaSpectrum,
  bound: number,
  options: BuyoutOptions = {},
): GammaCurveBuyout {
  if (!Number.isInteger(gammaIndex) || gammaIndex < 0 || gammaIndex >= angles.length) {
    throw new QuantumEngineError(
      `gammaIndex must be an integer in [0, ${angles.length}), got ${String(gammaIndex)}`,
    );
  }
  if (typeof bound !== 'number' || !Number.isFinite(bound) || bound < 0) {
    throw new QuantumEngineError(`bound must be a finite number >= 0, got ${String(bound)}`);
  }
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i]!;
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new QuantumEngineError(`angles[${i}] must be a finite number, got ${String(a)}`);
    }
  }
  const probeSamples = options.probeSamples ?? DEFAULT_PROBE_SAMPLES;
  if (!Number.isInteger(probeSamples) || probeSamples < 0) {
    throw new QuantumEngineError(
      `probeSamples must be a non-negative integer, got ${String(options.probeSamples)}`,
    );
  }
  const residualTolerance = options.residualTolerance ?? RESIDUAL_TOLERANCE;
  if (
    typeof residualTolerance !== 'number' ||
    !Number.isFinite(residualTolerance) ||
    residualTolerance <= 0
  ) {
    throw new QuantumEngineError(
      `residualTolerance must be a positive finite number, got ${String(options.residualTolerance)}`,
    );
  }
  // 运行时形状守卫：声明类型是成功分支——失败分支只能从 JS 调用侧进来，
  // 经 unknown 收宽后窄化（与仓内 angleMode/verify 守卫同一手法）
  const specShape: unknown = spectrum;
  if (
    typeof specShape !== 'object' ||
    specShape === null ||
    (specShape as { ok?: unknown }).ok === false ||
    (specShape as { harmonics?: unknown }).harmonics === undefined
  ) {
    throw new QuantumEngineError(
      'spectrum must be a successful GammaSpectrum (pass the failure through, do not buy out a rejected spectrum)',
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

  // ---- T2 采样：完整周期上 N 个等距点 ----
  const N = spectrum.sampleCount;
  const T = spectrum.period;
  const samples = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    const probe = angles.slice();
    probe[gammaIndex] = (j * T) / N;
    samples[j] = evaluateChecked(probe);
  }

  // ---- 朴素 DFT：F_m = (1/N)Σ v_j e^{−2πimj/N}（m = 0..⌊N/2⌋，实输入） ----
  const halfN = Math.floor(N / 2); // = M
  const fRe = new Float64Array(halfN + 1);
  const fIm = new Float64Array(halfN + 1);
  for (let m = 0; m <= halfN; m++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < N; j++) {
      const phase = (2 * Math.PI * m * j) / N;
      re += samples[j]! * Math.cos(phase);
      im -= samples[j]! * Math.sin(phase);
    }
    fRe[m] = re / N;
    fIm[m] = im / N;
  }

  // ---- 谐波系数提取 + 杂散审计 ----
  const harmonicSet = new Set<number>(spectrum.harmonics);
  let maxSpurious = 0;
  for (let m = 1; m <= halfN; m++) {
    if (harmonicSet.has(m)) continue;
    const amp = 2 * Math.hypot(fRe[m]!, fIm[m]!);
    if (amp > maxSpurious) maxSpurious = amp;
  }
  const cosCoefficients: number[] = [];
  const sinCoefficients: number[] = [];
  for (const m of spectrum.harmonics) {
    cosCoefficients.push(2 * fRe[m]!);
    sinCoefficients.push(-2 * fIm[m]!);
  }
  const c0 = fRe[0]!;
  const differences = spectrum.differences;
  if (maxSpurious > residualTolerance) {
    throw new QuantumEngineError(
      `trig buyout residual mismatch: max spurious harmonic amplitude ${maxSpurious.toExponential(3)} ` +
        `exceeds tolerance ${residualTolerance.toExponential(3)} — the objective is not the trigonometric ` +
        'polynomial implied by this spectrum (check that the angle parameterizes a single diagonal gate and ' +
        'the objective is a bilinear expectation; CVaR-style objectives are outside the theorem)',
    );
  }

  // ---- outlier 探针：黄金比错位确定性布点（落在 [0,bound] 域内） ----
  const fittedValueAt = (gamma: number): number => {
    let v = c0;
    for (let r = 0; r < differences.length; r++) {
      const d = differences[r]!;
      v += cosCoefficients[r]! * Math.cos(d * gamma) + sinCoefficients[r]! * Math.sin(d * gamma);
    }
    return v;
  };
  let maxProbeResidual = 0;
  for (let p = 1; p <= probeSamples; p++) {
    const probeGamma = bound === 0 ? 0 : bound * ((p * GOLDEN_FRACTION) % 1);
    const probe = angles.slice();
    probe[gammaIndex] = probeGamma;
    const real = evaluateChecked(probe);
    const fitted = fittedValueAt(probeGamma);
    const residual = Math.abs(real - fitted);
    if (residual > maxProbeResidual) maxProbeResidual = residual;
    if (residual > residualTolerance) {
      throw new QuantumEngineError(
        `trig buyout residual mismatch: probe at gamma=${probeGamma.toExponential(6)} gives ` +
          `fitted=${fitted.toExponential(6)} vs evaluated=${real.toExponential(6)} ` +
          `(residual ${residual.toExponential(3)} > tolerance ${residualTolerance.toExponential(3)}) — ` +
          'the evaluate closure does not satisfy the single-diagonal-gate theorem premise',
      );
    }
  }
  return {
    spectrum,
    c0,
    cosCoefficients,
    sinCoefficients,
    maxSpuriousAmplitude: maxSpurious,
    maxProbeResidual,
    evaluations,
  };
}

// ----------------------------------------------------------------------------
// 第三层：证书化网格最小化（T3，纯函数，零电路评估）
// ----------------------------------------------------------------------------

/** 最小化的可选旋钮 */
export interface GammaMinimizeOptions {
  /** 证书 gap 目标（缺省 1e-9；受 maxGrid 截断时如实放宽） */
  targetEps?: number;
  /** 网格点数上限（缺省 65536；闭式求值便宜，审计保持有界） */
  maxGrid?: number;
}

/** 证书化极小：返回点 + 夹逼证书（对已买断多项式精确） */
export interface GammaMinCertificate {
  /** 推荐的 γ（网格最优格点 + 相邻格内三分精修，闭式零评估） */
  readonly gamma: number;
  /** 闭式拟合值 f(gamma)（证书上界：真极小 ≤ 该值） */
  readonly upperBound: number;
  /** 证书下界：gridMin − L₁·h/2（真极小 ≥ 该值） */
  readonly lowerBound: number;
  /** 夹逼区间宽度 = upperBound − lowerBound（≤ targetEps 或截断值） */
  readonly gap: number;
  /** Lipschitz 常数 L₁ = Σ d_r·√(a_r²+b_r²) ≥ sup|f′|（证书来源） */
  readonly lipschitz: number;
  /** 实际网格点数（含端点） */
  readonly gridPoints: number;
}

/**
 * 在 [0, bound] 上极小化已买断的 γ 曲线：网格扫描取最优格点、相邻半格
 * 内三分精修（闭式，零电路评估），按 T3 报告 Lipschitz 夹逼证书——
 * gridMin − L₁·h/2 ≤ min f ≤ 返回值。证书对**买断多项式**精确；多项式
 * 与真实电路的偏差由买断探针审计（见 buyoutGammaCurve）。
 */
export function minimizeGammaCurve(
  buyout: GammaCurveBuyout,
  bound: number,
  options: GammaMinimizeOptions = {},
): GammaMinCertificate {
  if (typeof bound !== 'number' || !Number.isFinite(bound) || bound < 0) {
    throw new QuantumEngineError(`bound must be a finite number >= 0, got ${String(bound)}`);
  }
  const targetEps = options.targetEps ?? DEFAULT_TARGET_EPS;
  if (typeof targetEps !== 'number' || !Number.isFinite(targetEps) || targetEps <= 0) {
    throw new QuantumEngineError(
      `targetEps must be a positive finite number, got ${String(options.targetEps)}`,
    );
  }
  const maxGrid = options.maxGrid ?? DEFAULT_MAX_GRID;
  if (!Number.isInteger(maxGrid) || maxGrid < 2) {
    throw new QuantumEngineError(`maxGrid must be an integer >= 2, got ${String(options.maxGrid)}`);
  }
  const { differences } = buyout.spectrum;
  const { cosCoefficients, sinCoefficients } = buyout;
  let lipschitz = 0;
  for (let r = 0; r < differences.length; r++) {
    lipschitz += differences[r]! * Math.hypot(cosCoefficients[r]!, sinCoefficients[r]!);
  }
  if (bound === 0 || lipschitz === 0) {
    // 无活动空间 / 恒常曲线：任意点即极小，证书零宽
    const v = gammaCurveValueAt(buyout, bound === 0 ? 0 : 0);
    return { gamma: 0, upperBound: v, lowerBound: v, gap: 0, lipschitz, gridPoints: 1 };
  }
  const gridPoints = Math.min(
    maxGrid,
    Math.max(2, Math.ceil((lipschitz * bound) / (2 * targetEps)) + 1),
  );
  const h = bound / (gridPoints - 1);
  let bestJ = 0;
  let gridMin = Infinity;
  for (let j = 0; j < gridPoints; j++) {
    const v = gammaCurveValueAt(buyout, (j * bound) / (gridPoints - 1));
    if (v < gridMin) {
      gridMin = v;
      bestJ = j;
    }
  }
  // 相邻半格内三分精修（闭式；不进入证书主张，只收紧返回点）
  let lo = Math.max(0, ((bestJ - 0.5) * bound) / (gridPoints - 1));
  let hi = Math.min(bound, ((bestJ + 0.5) * bound) / (gridPoints - 1));
  if (lo > hi) [lo, hi] = [hi, lo];
  let gammaBest = (bestJ * bound) / (gridPoints - 1);
  let valueBest = gridMin;
  for (let it = 0; it < 80 && hi - lo > 1e-15; it++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const v1 = gammaCurveValueAt(buyout, m1);
    const v2 = gammaCurveValueAt(buyout, m2);
    if (v1 <= v2) hi = m2;
    else lo = m1;
    const mid = (lo + hi) / 2;
    const vm = gammaCurveValueAt(buyout, mid);
    if (vm < valueBest) {
      valueBest = vm;
      gammaBest = mid;
    }
  }
  const lowerBound = gridMin - (lipschitz * h) / 2;
  const upperBound = valueBest;
  return {
    gamma: gammaBest,
    upperBound,
    lowerBound,
    gap: upperBound - lowerBound,
    lipschitz,
    gridPoints,
  };
}

// ----------------------------------------------------------------------------
// 第四层：种子化 γ 买断精修（支配性构造，与 ECCM/parameter-shift 同形）
// ----------------------------------------------------------------------------

/** 精修的可选旋钮 */
export interface GammaBuyoutRefineOptions extends GammaSpectrumOptions, BuyoutOptions {
  /** 参与买断的 γ 角度下标（必填语义：空数组 = 静默 no-op，入口拒绝） */
  gammaIndices?: readonly number[];
  /** Gauss-Seidel 扫描轮数上限（缺省 4；零接受轮早停） */
  sweeps?: number;
  /** 证书 gap 目标（透传 minimizeGammaCurve，缺省 1e-9） */
  targetEps?: number;
  /** 网格点数上限（透传，缺省 65536） */
  maxGrid?: number;
}

/** 单个 γ 坐标的买断-精修行（审计面） */
export interface GammaBuyoutRow {
  readonly gammaIndex: number;
  /** 该行买断的 N（= 2M+1） */
  readonly sampleCount: number;
  /** 杂散谐波幅度（应 ~舍入级） */
  readonly maxSpuriousAmplitude: number;
  /** 探针残差（应 ~舍入级） */
  readonly maxProbeResidual: number;
  /** 该行证书 gap（对买断多项式精确） */
  readonly certificateGap: number;
  /** 该行是否被接受（严格改进 > ANGLE_IMPROVEMENT_EPS） */
  readonly accepted: boolean;
}

/** 精修结果：最优角度快照 + 目标/评估记账 + 谱报告 + 逐行审计 */
export interface GammaBuyoutRefineResult {
  /** 精修后的角度（从未接受任何劣化步 ⇒ 目标 ≤ 种子；skipped 时原样） */
  readonly angles: number[];
  /** evaluate(angles) 的值 */
  readonly value: number;
  /** evaluate 的总调用次数（种子 1 + 每行 N+probes 买断 + 每行 1 确认） */
  readonly evaluations: number;
  /** 实际执行的扫描轮数（跨全部 γ；零接受轮早停） */
  readonly sweeps: number;
  /** 相对种子严格改进（> ANGLE_IMPROVEMENT_EPS） */
  readonly improved: boolean;
  /** 谱分析结果（失败时 ok:false——skipped 的结构原因如实携带） */
  readonly spectrum: GammaSpectrumResult;
  /** 谱分析失败 ⇒ true（angles 原样、value = 种子值；结构原因见 spectrum） */
  readonly skipped: boolean;
  /** 逐 γ 买断行（skipped 时为空数组） */
  readonly rows: readonly GammaBuyoutRow[];
}

/**
 * 种子化 γ 段三角多项式买断精修：谱差分析一次 → Gauss-Seidel 扫描，每
 * 轮对每个 γ 坐标买断整条曲线（2M+1+probes 次评估）、证书化网格极小
 * （闭式）、1 次真实 evaluate 确认，只接受严格改进步。
 *
 * - 支配性：接受条件 value < current − ANGLE_IMPROVEMENT_EPS，最优快照
 *   从不回退 ⇒ 返回值 ≤ evaluate(seedAngles)（构造性定理；确认评估为
 *   拟合浮点噪声兜底，支配性不依赖拟合精度）；
 * - 谱过密 / 不可公度 ⇒ skipped: true（angles 原样返回，value = 种子
 *   评估，结构原因在 spectrum 里具名）——诚实跳过，不静默降级；
 * - 其余角度（全部混合角 β 与未列出的 γ）保持种子值不动；
 * - 确定性：无 RNG、无时钟，同输入同输出。
 */
export function refineGammaByTrigBuyout(
  evaluate: (angles: number[]) => number,
  seedAngles: readonly number[],
  bounds: readonly number[],
  energies: Readonly<Float64Array> | readonly number[],
  options: GammaBuyoutRefineOptions = {},
): GammaBuyoutRefineResult {
  const gammaIndices = options.gammaIndices;
  if (gammaIndices === undefined || gammaIndices.length === 0) {
    throw new QuantumEngineError(
      'gammaIndices must list at least one cost angle index (empty refinement is a silent no-op)',
    );
  }
  for (const idx of gammaIndices) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= seedAngles.length) {
      throw new QuantumEngineError(
        `gammaIndices entries must be integers in [0, ${seedAngles.length}), got ${String(idx)}`,
      );
    }
  }
  const distinct = new Set(gammaIndices);
  if (distinct.size !== gammaIndices.length) {
    throw new QuantumEngineError('gammaIndices must not contain duplicates');
  }
  for (let i = 0; i < seedAngles.length; i++) {
    const a = seedAngles[i]!;
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new QuantumEngineError(`seedAngles[${i}] must be a finite number, got ${String(a)}`);
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
  const sweeps = options.sweeps ?? DEFAULT_SWEEPS;
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

  const spectrum = analyzeGammaSpectrum(energies, options);
  if (!spectrum.ok) {
    return {
      angles,
      value,
      evaluations,
      sweeps: 0,
      improved: false,
      spectrum,
      skipped: true,
      rows: [],
    };
  }

  const rows: GammaBuyoutRow[] = [];
  let sweepsUsed = 0;
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let accepted = false;
    for (const idx of gammaIndices) {
      const bound = bounds[idx]!;
      const buyout = buyoutGammaCurve(evaluateChecked, angles, idx, spectrum, bound, {
        ...(options.probeSamples !== undefined ? { probeSamples: options.probeSamples } : {}),
        ...(options.residualTolerance !== undefined
          ? { residualTolerance: options.residualTolerance }
          : {}),
      });
      const cert = minimizeGammaCurve(buyout, bound, {
        ...(options.targetEps !== undefined ? { targetEps: options.targetEps } : {}),
        ...(options.maxGrid !== undefined ? { maxGrid: options.maxGrid } : {}),
      });
      const trial = angles.slice();
      trial[idx] = cert.gamma;
      const trialValue = evaluateChecked(trial); // 真实确认（支配性兜底）
      const rowAccepted = trialValue < value - ANGLE_IMPROVEMENT_EPS;
      if (rowAccepted) {
        angles = trial;
        value = trialValue;
        accepted = true;
      }
      rows.push({
        gammaIndex: idx,
        sampleCount: spectrum.sampleCount,
        maxSpuriousAmplitude: buyout.maxSpuriousAmplitude,
        maxProbeResidual: buyout.maxProbeResidual,
        certificateGap: cert.gap,
        accepted: rowAccepted,
      });
    }
    sweepsUsed++;
    if (!accepted) break; // Gauss-Seidel 不动点：全部 γ 均在证书化极小（无严格改进）
  }

  return {
    angles,
    value,
    evaluations,
    sweeps: sweepsUsed,
    improved: value < seedValue - ANGLE_IMPROVEMENT_EPS,
    spectrum,
    skipped: false,
    rows,
  };
}
