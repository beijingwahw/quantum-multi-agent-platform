/**
 * nonuniform-gamma-buyout —— 非均匀贪心采样 γ 买断（R19-Q，批 3 候选②实施）
 *
 * ============ 动机（收窄 gamma-spectrum-buyout 的两个拒绝域） ============
 *
 * R18-D 的均匀买断在谱差分析处拒绝两类差集：
 * - 'incommensurable'：差集无公度基频（如 {1, √2} 型）——均匀 DFT 的
 *   混叠定理前提（可公度 ⇒ 谐波整数格）失效；
 * - 'spectrum-too-dense'：最高谐波 M 超预算（2M+1 > maxSamples）。
 * 两个拒绝域都有**可证的非均匀出路**：系数恢复只需要「2R+1 个采样点
 * 上的设计矩阵可逆」（R = 互异频率数），既不需要公度性，也只需要 R 而
 * 非 M 个频率。本模块以贪心最大体积选点（D-最优设计贪心）在黄金比
 * 候选池上确定性选点、GEPP 解方阵、探针审计，把上述两个域收窄到
 * 真正病态的残余：R > 128 的真过密（信息论下界）与条件数病态。
 *
 * ============ 定理（先证后码，可证伪） ============
 *
 * 【T1 · 结构继承】f(γ) = c₀ + Σ_{r=1}^{R}[a_r·cos(d_r·γ) + b_r·sin(d_r·γ)]
 * 对**任意**（不必公度）差集成立——R18-D 的 T1 本就不使用公度性
 * （e^{−iγC} = Σ_i e^{−iγE_i}P_i 的交叉项配对），本模块直接继承，
 * 不重证。
 *
 * 【T2' · 非均匀可解性】2R+1 个函数 {1, cos(d_r·), sin(d_r·)} 在 ℝ 上
 * 线性无关（相异频率的指数多项式无关性——标准结果：若在任一正长度
 * 区间上恒为零，解析延拓至全直线，与 e^{iωγ}（ω ∈ {0, ±d_r} 相异）的
 * 无关性矛盾）。因此对 Lebesgue 几乎处处的 2R+1 个互异采样点，K×K
 * 设计矩阵 A（行 = [1, cos(d_r·γ_j), sin(d_r·γ_j)]，K = 2R+1）可逆，
 * 线性系统 A·c = y 的解唯一等于真系数（解析恢复）。∎
 * 【采样成本】K = 2R+1 ≤ 2M+1 = N（互异谐波数 ≤ 最高谐波——R18-D 的
 * 均匀网格为带宽付账，本面只为频率数付账）：稀疏高谐波谱（R ≪ M）
 * 上采样数严格更少；不可公度谱（均匀版整域拒绝）上有限可行。∎
 * 【信息论下界保留】恢复 2R+1 个未知数至少 2R+1 个采样——真过密
 * （2R+1 > maxSamples）仍诚实拒绝，不是可收窄的域。∎
 *
 * 【T3' · 贪心确定性 + 零评估选点】选点只依赖已知频率 {d_r}（差集聚类
 * 的输出），不消耗任何电路评估：黄金比候选池上按 Gram–Schmidt 残差
 * 范数贪心（= 逐行体积最大化，D-最优设计贪心）。**不主张**贪心达到
 * 最优条件数（D-最优设计的贪心近似界不在本文主张内）；主张：确定性
 * （同谱同选点）、有限终止、以及审计面（pivotRatio 如实报告 + 超阈
 * 具名拒绝）。黄金比与任何有理频率不共振（无理数的连分数性质——
 * 形状级引用〔待双源〕），候选池近似均匀覆盖采样跨度。
 *
 * 【T4' · 证书继承】网格极小的 Lipschitz 夹逼（gridMin − L₁h/2 ≤
 * min f ≤ 返回值，L₁ = Σ d_r·√(a_r²+b_r²)）只依赖系数本身、不依赖
 * 系数的恢复方式——R18-D 的 T3 原样适用于本面恢复的系数。∎
 *
 * ============ 数值诚实边界（全部可查证） ============
 *
 * - **条件数**：GEPP（部分主元高斯消元）后向稳定，前向误差 ≤
 *   κ(A)·O(u)·‖c‖（经典结果，Golub–Van Loan 形状级〔待双源〕）。
 *   pivotRatio（最大/最小主元）是 κ 的**下界代理**——可低估 κ，故
 *   pivotRatio < 1e8 的接受不是精确性证明；真正的防线是 outlier 探针
 *   （闭式值 vs 真实评估，超容差具名抛出）与精修入口的真实确认评估。
 *   实测水平：可行性验证（tmp/r19q-feasibility-nonuniform.mjs）中
 *   pivotRatio 2–5、系数恢复 ~1e-16；拒绝阈 1e8 距实测 6+ 个量级。
 * - **采样跨度**S = 2π/d_min（最慢频率整周期；与 R18-D「完整周期采样
 *   不钳入 bound」同构）。S ≫ bound 时采样区间远超最小化域——系数
 *   恢复是全域的，无损；S 由谱确定性给出，非超参。
 * - **贪心秩亏**：残差范数全线低于 1e-12 ⇒ 具名拒绝（候选池上无法
 *   张满）——诚实拒绝，不用病态解冒充。
 * - **真过密即拒**：R > 128 ⇒ 2R+1 > 257 拒 'spectrum-too-dense'
 *   （信息论下界，与均匀版同预算口径）。
 * - 探针/走私自检、CVaR 域外、逐坐标逐轮重买断、不宣称普适更优——
 *   全部继承 R18-D 的同款边界与措辞。
 * - 均匀版在公度小谱上有 DFT 正交性的完美条件数；本面是**扩张面**，
 *   不替换均匀版（既有文件只读），两域重叠时调用方择一。
 *
 * ============ 形制 ============
 *
 * 零外部依赖（仓内 import：errors/constants）；顶层零副作用；opt-in
 * 新面：不被任何既有文件 import（编排者收口接线）；纯确定（无 RNG、
 * 无时钟——池与探针位置由黄金比常数确定性生成）。
 */

import { QuantumEngineError } from '../utils/errors.js';
import { ANGLE_IMPROVEMENT_EPS } from './constants.js';

// ----------------------------------------------------------------------------
// 常量（缺省值全部在此点名，可发现性优先）
// ----------------------------------------------------------------------------

/** 谱差分析的维度上限：差集计算 O(dim²)（与 R18-D 同预算口径） */
const DEFAULT_MAX_DIMENSION = 4096;

/** 采样预算上限：K = 2R+1 ≤ maxSamples（缺省 257 ⇒ R ≤ 128，信息论下界口径） */
const DEFAULT_MAX_SAMPLES = 257;

/** 差值聚类容差（相对谱宽）：与 R18-D 同纪律（量化噪声吸收带，两端 6 个量级裕度） */
const CLUSTER_REL_TOL = 1e-9;

/** 买断自检（探针）统一容差：结构失配 O(1)，舍入 ~1e-13 */
const RESIDUAL_TOLERANCE = 1e-6;

/** 探针缺省个数（黄金比错位确定性布点；0 = 显式关闭，风险自负） */
const DEFAULT_PROBE_SAMPLES = 2;

/** GEPP 主元比率拒绝阈（κ 下界代理；实测 2–5，6+ 个量级裕度） */
const MAX_PIVOT_RATIO = 1e8;

/** 贪心残差全线低于此值 ⇒ 候选池秩亏，具名拒绝 */
const GREEDY_RANK_EPS = 1e-12;

/** 贪心候选池规模：clamp(8K, 64, 2048)（确定性黄金比序列） */
const POOL_FACTOR = 8;
const POOL_MIN = 64;
const POOL_MAX = 2048;

/** 黄金比小数部分：确定性池与探针布点（与任何有理周期不共振） */
const GOLDEN_FRACTION = 0.6180339887498949;

/** 网格最小化缺省目标精度（T4' 证书 gap 上界） */
const DEFAULT_TARGET_EPS = 1e-9;

/** 网格点数上限（闭式求值便宜，审计保持有界） */
const DEFAULT_MAX_GRID = 65_536;

/** 精修缺省 Gauss-Seidel 扫描轮数上限（零接受轮早停） */
const DEFAULT_SWEEPS = 4;

// ----------------------------------------------------------------------------
// 第一层：谱差分析（无公度性要求——不可公度是本面的常态入口）
// ----------------------------------------------------------------------------

/** 谱差分析的可选旋钮 */
export interface NonuniformSpectrumOptions {
  /** 采样预算上限：K = 2R+1 ≤ maxSamples（缺省 257） */
  maxSamples?: number;
  /** 能量表维度上限（缺省 4096；差集计算 O(dim²)） */
  maxDimension?: number;
}

/** 谱差分析成功：非均匀买断所需的全部结构信息 */
export interface NonuniformSpectrum {
  /** 判别标记（与 NonuniformSpectrumFailure 的 ok:false 组成可判别联合） */
  readonly ok: true;
  /** 互异正差值（聚类代表，升序）——不必可公度 */
  readonly differences: readonly number[];
  /** 互异频率数 R */
  readonly frequencyCount: number;
  /** 买断采样数 K = 2R+1（T2' 的方阵阶） */
  readonly sampleCount: number;
  /** 采样跨度 S = 2π/d_min（最慢频率整周期，可分辨性的确定性保证） */
  readonly samplingSpan: number;
  /** 能量表的不同取值个数（审计面） */
  readonly distinctEnergies: number;
}

/** 谱差分析失败（具名原因——诚实拒绝，不用近似冒充） */
export type NonuniformSpectrumFailure = {
  readonly ok: false;
  readonly reason:
    | 'degenerate-spectrum' // 谱宽为 0：f(γ) 恒常数
    | 'dimension-cap' // dim > maxDimension：差集计算超预算
    | 'spectrum-too-dense'; // R 超预算：信息论下界（2R+1 个系数至少 2R+1 个采样）
  readonly detail: string;
};

export type NonuniformSpectrumResult = NonuniformSpectrum | NonuniformSpectrumFailure;

/**
 * 分析对角能量表的谱差结构（T1 频率集；无公度性要求）。
 * 差值在 CLUSTER_REL_TOL·谱宽 容差内聚类（量化噪声吸收，与 R18-D 同
 * 纪律）；R 超预算 ⇒ 'spectrum-too-dense'（信息论下界）。energies 必须
 * 与 evaluate 电路实际施加的（归一化）能量表一致。
 */
export function analyzeNonuniformSpectrum(
  energies: Readonly<Float64Array> | readonly number[],
  options: NonuniformSpectrumOptions = {},
): NonuniformSpectrumResult {
  const maxSamples = options.maxSamples ?? DEFAULT_MAX_SAMPLES;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  if (!Number.isInteger(maxSamples) || maxSamples < 5 || maxSamples % 2 === 0) {
    throw new QuantumEngineError(
      `maxSamples must be an odd integer >= 5 (K = 2R+1), got ${String(options.maxSamples)}`,
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
  const diffClusters = new Map<number, { sum: number; count: number }>();
  for (let i = 0; i < energies.length; i++) {
    for (let j = i + 1; j < energies.length; j++) {
      const d = Math.abs(energies[i]! - energies[j]!);
      if (d <= clusterTol) continue;
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
  const R = differences.length;
  const K = 2 * R + 1;
  if (K > maxSamples) {
    return {
      ok: false,
      reason: 'spectrum-too-dense',
      detail: `frequency count R=${R} needs K=2R+1=${K} samples > budget ${maxSamples} (information-theoretic lower bound: 2R+1 coefficients need 2R+1 samples)`,
    };
  }
  return {
    ok: true,
    differences,
    frequencyCount: R,
    sampleCount: K,
    samplingSpan: (2 * Math.PI) / differences[0]!,
    distinctEnergies: energyClusters.size,
  };
}

// ----------------------------------------------------------------------------
// 第二层：贪心选点（T3'：纯线性代数，零电路评估）
// ----------------------------------------------------------------------------

/**
 * 贪心最大体积选点（确定性）：黄金比候选池上按 Gram–Schmidt 残差范数
 * 逐行选取（D-最优设计贪心）。返回 K 个互异采样点；候选池上无法张满
 * （全线残差 < GREEDY_RANK_EPS）⇒ 具名抛出。不消耗电路评估。
 */
function greedySampleGammas(
  differences: readonly number[],
  spectrum: NonuniformSpectrum,
): number[] {
  const K = spectrum.sampleCount;
  const span = spectrum.samplingSpan;
  const poolSize = Math.min(POOL_MAX, Math.max(POOL_MIN, POOL_FACTOR * K));
  const pool: number[] = [];
  for (let k = 1; k <= poolSize; k++) {
    pool.push(span * ((k * GOLDEN_FRACTION) % 1));
  }
  const rowAt = (gamma: number): number[] => {
    const row = [1];
    for (const d of differences) {
      row.push(Math.cos(d * gamma), Math.sin(d * gamma));
    }
    return row;
  };
  const rows = pool.map((g) => rowAt(g));
  const basis: number[][] = [];
  const chosen: number[] = [];
  const chosenIdx = new Set<number>();
  while (chosen.length < K) {
    let bestIdx = -1;
    let bestNorm = -1;
    let bestResidual: number[] | null = null;
    for (let i = 0; i < rows.length; i++) {
      if (chosenIdx.has(i)) continue;
      const residual = rows[i]!.slice();
      for (const q of basis) {
        let dot = 0;
        for (let j = 0; j < residual.length; j++) dot += residual[j]! * q[j]!;
        for (let j = 0; j < residual.length; j++) residual[j]! -= dot * q[j]!;
      }
      let normSq = 0;
      for (const v of residual) normSq += v * v;
      const norm = Math.sqrt(normSq);
      if (norm > bestNorm) {
        bestNorm = norm;
        bestIdx = i;
        bestResidual = residual;
      }
    }
    if (bestIdx < 0 || bestResidual === null || bestNorm < GREEDY_RANK_EPS) {
      throw new QuantumEngineError(
        `greedy sample selection is rank-deficient on the golden-ratio pool ` +
          `(selected ${chosen.length}/${K}, best residual norm ${bestNorm.toExponential(3)}) — ` +
          'the difference set cannot be resolved by non-uniform sampling within budget',
      );
    }
    chosenIdx.add(bestIdx);
    chosen.push(pool[bestIdx]!);
    basis.push(bestResidual.map((v) => v / bestNorm));
  }
  return chosen;
}

// ----------------------------------------------------------------------------
// 第三层：γ 曲线非均匀买断（T2' 的采样面 + GEPP + 探针自检）
// ----------------------------------------------------------------------------

/** 买断的可选旋钮 */
export interface NonuniformBuyoutOptions {
  /** outlier 探针个数（缺省 2；0 = 显式关闭走私自检，风险自负） */
  probeSamples?: number;
  /** 探针失配容差（缺省 1e-6；结构失配 O(1)，舍入 ~1e-13） */
  residualTolerance?: number;
}

/** 一次成功买断：全部 Fourier 系数 + 闭式求值/梯度 + 审计面 */
export interface NonuniformGammaBuyout {
  readonly spectrum: NonuniformSpectrum;
  /** 常数项 c₀ */
  readonly c0: number;
  /** 余弦系数 a_r（与 spectrum.differences 同序） */
  readonly cosCoefficients: readonly number[];
  /** 正弦系数 b_r（与 spectrum.differences 同序） */
  readonly sinCoefficients: readonly number[];
  /** 贪心选出的 K 个采样点（审计面：确定性，同谱同点） */
  readonly sampleGammas: readonly number[];
  /** GEPP 主元比率 max|pivot|/min|pivot|（κ 下界代理；实测 2–5，阈值 1e8） */
  readonly pivotRatio: number;
  /** 探针实测的最大 |闭式值 − 真实评估|（0 个探针时为 0） */
  readonly maxProbeResidual: number;
  /** 本买断消耗的 evaluate 次数（K 采样 + probes 探针；贪心选点零评估） */
  readonly evaluations: number;
}

/** 买断曲线的闭式求值：f(γ) = c₀ + Σ a_r cos(d_r γ) + b_r sin(d_r γ) */
export function nonuniformCurveValueAt(buyout: NonuniformGammaBuyout, gamma: number): number {
  const { differences } = buyout.spectrum;
  const { cosCoefficients, sinCoefficients, c0 } = buyout;
  let v = c0;
  for (let r = 0; r < differences.length; r++) {
    const d = differences[r]!;
    v += cosCoefficients[r]! * Math.cos(d * gamma) + sinCoefficients[r]! * Math.sin(d * gamma);
  }
  return v;
}

/** 买断曲线的闭式精确梯度（T1/T4'）：f′(γ) = Σ d_r·[−a_r sin + b_r cos] */
export function nonuniformCurveDerivativeAt(buyout: NonuniformGammaBuyout, gamma: number): number {
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
 * 非均匀贪心采样买断单个 γ 坐标的目标曲线：贪心选 K = 2R+1 点（零评估）→
 * K 次电路采样 → GEPP 解方阵恢复系数（T2'）→ outlier 探针自检（黄金比
 * 错位点，落于 [0,bound]）。evaluate 是「其余角度固定、只改
 * angles[gammaIndex]」的确定性目标闭包（与 R18-D 同契约）。
 *
 * - 采样点分布于完整跨度 S = 2π/d_min（不钳入 [0,bound]——系数恢复是
 *   全域的，[0,bound] 只是其后最小化的搜索域）；
 * - pivotRatio > 1e8 ⇒ 具名拒绝（κ 下界代理的超阈信号，诚实拒绝而非
 *   病态解冒充）；探针超容差 ⇒ 具名抛出（定理前提被走私）。
 */
export function buyoutGammaCurveNonuniform(
  evaluate: (angles: number[]) => number,
  angles: readonly number[],
  gammaIndex: number,
  spectrum: NonuniformSpectrum,
  bound: number,
  options: NonuniformBuyoutOptions = {},
): NonuniformGammaBuyout {
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
  // 运行时形状守卫：声明类型是成功分支——失败分支经 unknown 收宽后窄化
  const specShape: unknown = spectrum;
  if (
    typeof specShape !== 'object' ||
    specShape === null ||
    (specShape as { ok?: unknown }).ok === false ||
    (specShape as { differences?: unknown }).differences === undefined
  ) {
    throw new QuantumEngineError(
      'spectrum must be a successful NonuniformSpectrum (pass the failure through, do not buy out a rejected spectrum)',
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

  // ---- T3' 贪心选点（零电路评估）→ T2' 采样 ----
  const sampleGammas = greedySampleGammas(spectrum.differences, spectrum);
  const K = spectrum.sampleCount;
  const samples = new Float64Array(K);
  for (let j = 0; j < K; j++) {
    const probe = angles.slice();
    probe[gammaIndex] = sampleGammas[j]!;
    samples[j] = evaluateChecked(probe);
  }

  // ---- GEPP：解 [1, cos(d_r γ_j), sin(d_r γ_j)]·c = f(γ_j)（K×K 方阵） ----
  const design: Float64Array[] = [];
  for (let j = 0; j < K; j++) {
    const row = new Float64Array(K);
    row[0] = 1;
    for (let r = 0; r < spectrum.frequencyCount; r++) {
      const d = spectrum.differences[r]!;
      row[2 * r + 1] = Math.cos(d * sampleGammas[j]!);
      row[2 * r + 2] = Math.sin(d * sampleGammas[j]!);
    }
    design.push(row);
  }
  const aug = design.map((row, j) => Float64Array.from([...row, samples[j]!]));
  const pivots: number[] = [];
  for (let col = 0; col < K; col++) {
    let piv = col;
    for (let r = col + 1; r < K; r++) {
      if (Math.abs(aug[r]![col]!) > Math.abs(aug[piv]![col]!)) piv = r;
    }
    const pivotVal = Math.abs(aug[piv]![col]!);
    if (!(pivotVal > 0) || !Number.isFinite(pivotVal)) {
      throw new QuantumEngineError(
        'non-uniform buyout encountered a structurally singular design matrix (zero pivot)',
      );
    }
    pivots.push(pivotVal);
    if (piv !== col) {
      const t = aug[piv]!;
      aug[piv] = aug[col]!;
      aug[col] = t;
    }
    for (let r = col + 1; r < K; r++) {
      const f = aug[r]![col]! / aug[col]![col]!;
      for (let c = col; c <= K; c++) {
        aug[r]![c]! -= f * aug[col]![c]!;
      }
    }
  }
  const coeffs = new Float64Array(K);
  for (let r = K - 1; r >= 0; r--) {
    let s = aug[r]![K]!;
    for (let c = r + 1; c < K; c++) {
      s -= aug[r]![c]! * coeffs[c]!;
    }
    coeffs[r] = s / aug[r]![r]!;
  }
  const pivotRatio = Math.max(...pivots) / Math.min(...pivots);
  if (!(pivotRatio < MAX_PIVOT_RATIO)) {
    throw new QuantumEngineError(
      `non-uniform buyout is ill-conditioned: GEPP pivot ratio ${pivotRatio.toExponential(3)} ` +
        `exceeds threshold ${MAX_PIVOT_RATIO.toExponential(1)} — the greedy sampling cannot certify ` +
        'coefficient recovery for this difference set within budget (honest rejection, not a noisy fit)',
    );
  }
  const c0 = coeffs[0]!;
  const cosCoefficients: number[] = [];
  const sinCoefficients: number[] = [];
  for (let r = 0; r < spectrum.frequencyCount; r++) {
    cosCoefficients.push(coeffs[2 * r + 1]!);
    sinCoefficients.push(coeffs[2 * r + 2]!);
  }

  // ---- outlier 探针：黄金比错位确定性布点（落在 [0,bound] 域内） ----
  let maxProbeResidual = 0;
  for (let p = 1; p <= probeSamples; p++) {
    const probeGamma = bound === 0 ? 0 : bound * ((p * GOLDEN_FRACTION) % 1);
    const probe = angles.slice();
    probe[gammaIndex] = probeGamma;
    const real = evaluateChecked(probe);
    const fitted = nonuniformCurveValueAt(
      {
        spectrum,
        c0,
        cosCoefficients,
        sinCoefficients,
        sampleGammas,
        pivotRatio,
        maxProbeResidual: 0,
        evaluations: 0,
      },
      probeGamma,
    );
    const residual = Math.abs(real - fitted);
    if (residual > maxProbeResidual) maxProbeResidual = residual;
    if (residual > residualTolerance) {
      throw new QuantumEngineError(
        `non-uniform buyout residual mismatch: probe at gamma=${probeGamma.toExponential(6)} gives ` +
          `fitted=${fitted.toExponential(6)} vs evaluated=${real.toExponential(6)} ` +
          `(residual ${residual.toExponential(3)} > tolerance ${residualTolerance.toExponential(3)}) — ` +
          'the evaluate closure does not match the difference set supplied (wrong energies, non-trig ' +
          'objective, or CVaR-style objective — all outside the theorem)',
      );
    }
  }
  return {
    spectrum,
    c0,
    cosCoefficients,
    sinCoefficients,
    sampleGammas,
    pivotRatio,
    maxProbeResidual,
    evaluations,
  };
}

// ----------------------------------------------------------------------------
// 第四层：证书化网格最小化（T4'：Lipschitz 夹逼，零电路评估）
// ----------------------------------------------------------------------------

/** 最小化的可选旋钮 */
export interface NonuniformMinimizeOptions {
  /** 证书 gap 目标（缺省 1e-9；受 maxGrid 截断时如实放宽） */
  targetEps?: number;
  /** 网格点数上限（缺省 65536） */
  maxGrid?: number;
}

/** 证书化极小：返回点 + 夹逼证书（对已买断多项式精确） */
export interface NonuniformMinCertificate {
  /** 推荐的 γ（网格最优格点 + 相邻格内三分精修，闭式零评估） */
  readonly gamma: number;
  /** 闭式拟合值 f(gamma)（证书上界：真极小 ≤ 该值） */
  readonly upperBound: number;
  /** 证书下界：gridMin − L₁·h/2（真极小 ≥ 该值） */
  readonly lowerBound: number;
  /** 夹逼区间宽度 = upperBound − lowerBound */
  readonly gap: number;
  /** Lipschitz 常数 L₁ = Σ d_r·√(a_r²+b_r²) ≥ sup|f′|（证书来源） */
  readonly lipschitz: number;
  /** 实际网格点数（含端点） */
  readonly gridPoints: number;
}

/**
 * 在 [0, bound] 上极小化已买断的 γ 曲线：网格扫描取最优格点、相邻半格
 * 内三分精修（闭式，零电路评估），按 T4' 报告 Lipschitz 夹逼证书——
 * gridMin − L₁h/2 ≤ min f ≤ 返回值。证书对**买断多项式**精确；多项式与
 * 真实电路的偏差由买断探针审计（见 buyoutGammaCurveNonuniform）。
 */
export function minimizeNonuniformGammaCurve(
  buyout: NonuniformGammaBuyout,
  bound: number,
  options: NonuniformMinimizeOptions = {},
): NonuniformMinCertificate {
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
    const v = nonuniformCurveValueAt(buyout, 0);
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
    const v = nonuniformCurveValueAt(buyout, (j * bound) / (gridPoints - 1));
    if (v < gridMin) {
      gridMin = v;
      bestJ = j;
    }
  }
  let lo = Math.max(0, ((bestJ - 0.5) * bound) / (gridPoints - 1));
  let hi = Math.min(bound, ((bestJ + 0.5) * bound) / (gridPoints - 1));
  if (lo > hi) [lo, hi] = [hi, lo];
  let gammaBest = (bestJ * bound) / (gridPoints - 1);
  let valueBest = gridMin;
  for (let it = 0; it < 80 && hi - lo > 1e-15; it++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const v1 = nonuniformCurveValueAt(buyout, m1);
    const v2 = nonuniformCurveValueAt(buyout, m2);
    if (v1 <= v2) hi = m2;
    else lo = m1;
    const mid = (lo + hi) / 2;
    const vm = nonuniformCurveValueAt(buyout, mid);
    if (vm < valueBest) {
      valueBest = vm;
      gammaBest = mid;
    }
  }
  return {
    gamma: gammaBest,
    upperBound: valueBest,
    lowerBound: gridMin - (lipschitz * h) / 2,
    gap: valueBest - (gridMin - (lipschitz * h) / 2),
    lipschitz,
    gridPoints,
  };
}

// ----------------------------------------------------------------------------
// 第五层：种子化非均匀买断精修（支配性构造，与 R18-D refine 同形）
// ----------------------------------------------------------------------------

/** 精修的可选旋钮 */
export interface NonuniformBuyoutRefineOptions
  extends NonuniformSpectrumOptions, NonuniformBuyoutOptions {
  /** 参与买断的 γ 角度下标（必填语义：空数组 = 静默 no-op，入口拒绝） */
  gammaIndices?: readonly number[];
  /** Gauss-Seidel 扫描轮数上限（缺省 4；零接受轮早停） */
  sweeps?: number;
  /** 证书 gap 目标（透传 minimizeNonuniformGammaCurve，缺省 1e-9） */
  targetEps?: number;
  /** 网格点数上限（透传，缺省 65536） */
  maxGrid?: number;
}

/** 单个 γ 坐标的买断-精修行（审计面） */
export interface NonuniformBuyoutRow {
  readonly gammaIndex: number;
  /** 该行买断的 K（= 2R+1） */
  readonly sampleCount: number;
  /** 该行 GEPP 主元比率（κ 下界代理） */
  readonly pivotRatio: number;
  /** 探针残差（应 ~舍入级） */
  readonly maxProbeResidual: number;
  /** 该行证书 gap（对买断多项式精确） */
  readonly certificateGap: number;
  /** 该行是否被接受（严格改进 > ANGLE_IMPROVEMENT_EPS） */
  readonly accepted: boolean;
}

/** 精修结果：最优角度快照 + 目标/评估记账 + 谱报告 + 逐行审计 */
export interface NonuniformBuyoutRefineResult {
  readonly angles: number[];
  readonly value: number;
  readonly evaluations: number;
  readonly sweeps: number;
  readonly improved: boolean;
  readonly spectrum: NonuniformSpectrumResult;
  /** 谱分析失败 ⇒ true（angles 原样、value = 种子值；结构原因见 spectrum） */
  readonly skipped: boolean;
  readonly rows: readonly NonuniformBuyoutRow[];
}

/**
 * 种子化 γ 段非均匀买断精修：谱差分析一次 → Gauss-Seidel 扫描，每轮对
 * 每个 γ 坐标贪心选点买断整条曲线（K+probes 次评估）、证书化网格极小
 * （闭式）、1 次真实 evaluate 确认，只接受严格改进步。
 * 支配性与诚实边界同 refineGammaByTrigBuyout（R18-D）；差异仅在采样面：
 * 贪心 K 点（不可公度 / 稀疏高谐波可用）替代均匀 N 点（可公度必需）。
 */
export function refineGammaByNonuniformBuyout(
  evaluate: (angles: number[]) => number,
  seedAngles: readonly number[],
  bounds: readonly number[],
  energies: Readonly<Float64Array> | readonly number[],
  options: NonuniformBuyoutRefineOptions = {},
): NonuniformBuyoutRefineResult {
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

  const spectrum = analyzeNonuniformSpectrum(energies, {
    ...(options.maxSamples !== undefined ? { maxSamples: options.maxSamples } : {}),
    ...(options.maxDimension !== undefined ? { maxDimension: options.maxDimension } : {}),
  });
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

  const rows: NonuniformBuyoutRow[] = [];
  let sweepsUsed = 0;
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let accepted = false;
    for (const idx of gammaIndices) {
      const bound = bounds[idx]!;
      const buyout = buyoutGammaCurveNonuniform(
        evaluateChecked,
        angles,
        idx,
        spectrum,
        bound,
        buyoutOptions,
      );
      const cert = minimizeNonuniformGammaCurve(buyout, bound, minimizeOptions);
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
        pivotRatio: buyout.pivotRatio,
        maxProbeResidual: buyout.maxProbeResidual,
        certificateGap: cert.gap,
        accepted: rowAccepted,
      });
    }
    sweepsUsed++;
    if (!accepted) break; // Gauss-Seidel 不动点：全部 γ 均在证书化极小
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
