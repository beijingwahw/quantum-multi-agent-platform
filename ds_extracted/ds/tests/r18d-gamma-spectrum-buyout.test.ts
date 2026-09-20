/**
 * R18-D 创新：gamma-spectrum-buyout（γ 段谱差三角多项式买断）的行为钉。
 *
 * 六类断言：
 * 1. 谱分析——公度谱（谐波/基频/N 逐字段）、不可公度谱（'incommensurable'
 *    具名拒绝）、谱过密（'spectrum-too-dense'——连续量化谱的常态，诚实
 *    拒绝而不是加噪声近似冒充）、简并谱/维度上限/NaN 逐条具名；
 * 2. 定理钉（解析黑盒）——频率集 {2,4} 的解析三角多项式被 N=5 点买断
 *    精确恢复：任意点求值与导数 vs 解析 ≤1e-12；杂散谐波 ~舍入级；
 * 3. 定理钉（真实电路）——整数权重子空间（3×5，dim=60）与全空间
 *    （2×3，dim=64）的真 QAOA 电路：买断闭式值 vs 真实 evaluate 30 点
 *    对拍 ≤1e-9；闭式精确梯度 vs 中心差分 ≤1e-7；
 * 4. 证书钉（T3 夹逼）——20001 点密扫极小被 [lowerBound, upperBound]
 *    夹住，gap ≤ targetEps（网格未截断时）；
 * 5. 支配性——layer-CD 收敛角为种子，γ 买断精修（γ 段 [0,1]）返回值
 *    ≤ 种子（构造性）；β 段逐位不变（γ 买断不动混合角）；skipped 路径
 *    （三位小数量化谱过密）angles 原样 + 结构原因具名；评估记账下界；
 * 6. 负对照（走私审判）——非三角目标（γ²，定理域外）被 outlier 探针
 *    具名拦截；probeSamples=0 显式关闭时不拦（防线位置对照）；非法
 *    输入（空 gammaIndices/越界/NaN energies/偶数 maxSamples/非法
 *    sweeps/非有限评估/bounds 形状/失败谱走私）逐条具名拒绝。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { QuantumStateVector, computeEnergies, couplingKey } from '../src/core/quantum-optimizer.js';
import {
  buildSubspaceModel,
  SubspaceState,
  type SubspaceModel,
} from '../src/core/subspace-optimizer.js';
import {
  expectationValueInto,
  minMaxOf,
  normalizedEnergies as normalizedEnergiesOf,
  optimizeAnglesByCoordinateDescent,
  optimizeAnglesByCoordinateDescentSeeded,
} from '../src/core/solver-common.js';
import { mulberry32 } from '../src/utils/rng.js';
import { QuantumEngineError } from '../src/utils/errors.js';
import { GAMMA_BOUND, BETA_BOUND } from '../src/core/constants.js';
import {
  analyzeGammaSpectrum,
  buyoutGammaCurve,
  gammaCurveDerivativeAt,
  gammaCurveValueAt,
  minimizeGammaCurve,
  refineGammaByTrigBuyout,
  type GammaSpectrum,
  type GammaSpectrumResult,
} from '../src/core/gamma-spectrum-buyout.js';

const NAIL_EPS = 1e-12;
const CIRCUIT_EPS = 1e-9;
const DERIV_EPS = 1e-7;

function rngOf(seed: number): () => number {
  return mulberry32(seed);
}

/** 显式窄化 helper（assert.ok 不窄化联合类型的属性表达式） */
function expectSpectrum(s: GammaSpectrumResult): GammaSpectrum {
  if (!s.ok) throw new Error(`spectrum analysis failed: ${JSON.stringify(s)}`);
  return s;
}

/** 整数权重问题（谱差公度：W 全整数 ⇒ 差 = 整数格，g = 1/span） */
function integerProblem(
  m: number,
  n: number,
  seed: number,
  opts: { penalty?: number } = {},
): AssignmentProblem {
  const r = rngOf(seed);
  const weights = Array.from(
    { length: m },
    () => Array.from({ length: n }, () => 1 + Math.floor(r() * 5)), // 1..5 整数
  );
  const p: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  const nq = m * n;
  for (let t1 = 0; t1 + 1 < m; t1 += 2) {
    p.couplings.set(couplingKey(t1 * n, (t1 + 1) * n + 1, nq), 1); // J=1 整数
  }
  const penalty = opts.penalty ?? 0;
  p.penaltyOneHot = penalty;
  p.penaltyCapacity = penalty;
  return p;
}

/** 三位小数量化权重问题（谱差 ~10³ 谐波：买断预算外的常态实例） */
function quantizedProblem(m: number, n: number, seed: number): AssignmentProblem {
  const r = rngOf(seed);
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => +(0.15 + 0.7 * r()).toFixed(3)),
  );
  const p: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  const nq = m * n;
  for (let t1 = 0; t1 + 1 < m; t1 += 2) {
    p.couplings.set(couplingKey(t1 * n, (t1 + 1) * n + 1, nq), 0.3);
  }
  const span = 2 * (5 * m + m / 2 + 1); // defaultPenalties 同思路的量级
  p.penaltyOneHot = span;
  p.penaltyCapacity = span;
  return p;
}

function subspaceEnergies(model: SubspaceModel): Float64Array {
  const { min, max } = minMaxOf(model.energies);
  return normalizedEnergiesOf(model.energies, min, max, 1);
}

/** 子空间 layer 布局评估闭包：angles = [γ_1..γ_p, β_1..β_p] */
function subspaceLayerEvaluate(
  model: SubspaceModel,
  energies: Float64Array,
  layers: number,
): (angles: number[]) => number {
  const st = new SubspaceState(model.dimension);
  return (angles: number[]): number => {
    st.setUniform();
    for (let p = 0; p < layers; p++) {
      st.applyCostPhase(angles[p]!, energies);
      for (const group of model.mixers) {
        st.applyFiberMixer(group, angles[layers + p]!);
      }
    }
    return expectationValueInto(st, energies);
  };
}

function randomLayerAngles(rng: () => number, layers: number): number[] {
  const angles: number[] = [];
  for (let p = 0; p < layers; p++) angles.push(rng() * Math.PI);
  for (let p = 0; p < layers; p++) angles.push(rng() * (Math.PI / 2));
  return angles;
}

function withAngle(angles: readonly number[], index: number, value: number): number[] {
  const out = angles.slice();
  out[index] = value;
  return out;
}

// ----------------------------------------------------------------------------
// 1. 谱分析（结构面：公度/不可公度/过密/简并/上限/负对照）
// ----------------------------------------------------------------------------

describe('R18-D gamma-spectrum-buyout · 谱差分析', () => {
  it('公度谱 [0,2,4]：差 {2,4}、g=2、harmonics [1,2]、N=5 逐字段钉死', () => {
    const s = expectSpectrum(analyzeGammaSpectrum(new Float64Array([0, 2, 4])));
    assert.equal(s.differences.length, 2);
    assert.ok(Math.abs(s.differences[0]! - 2) < NAIL_EPS);
    assert.ok(Math.abs(s.differences[1]! - 4) < NAIL_EPS);
    assert.ok(Math.abs(s.fundamental - 2) < NAIL_EPS);
    assert.deepEqual([...s.harmonics], [1, 2]);
    assert.equal(s.maxHarmonic, 2);
    assert.equal(s.sampleCount, 5);
    assert.ok(Math.abs(s.period - Math.PI) < NAIL_EPS); // 2π/2
    assert.equal(s.distinctEnergies, 3);
  });

  it('公度谱 [0,2,4,8]：差 {2,4,6,8}、harmonics [1,2,3,4]、N=9', () => {
    const s = expectSpectrum(analyzeGammaSpectrum(new Float64Array([0, 2, 4, 8])));
    assert.deepEqual([...s.harmonics], [1, 2, 3, 4]);
    assert.equal(s.sampleCount, 9);
  });

  it('不可公度谱 [0,1,√2]：差 {1, √2, √2−1} 无公度基频 ⇒ 具名拒绝', () => {
    const s = analyzeGammaSpectrum(new Float64Array([0, 1, Math.SQRT2]));
    assert.ok(!s.ok);
    assert.equal(s.reason, 'incommensurable');
    assert.ok(s.detail.includes('fundamental'), `拒绝明细应点名基频搜索：${s.detail}`);
  });

  it('谱过密（200 个 0.001 步长点 ⇒ M=199 ⇒ N=399 > 257）：诚实拒绝而非近似', () => {
    const energies = Float64Array.from({ length: 200 }, (_, i) => i * 0.001);
    const s = analyzeGammaSpectrum(energies);
    assert.ok(!s.ok);
    assert.equal(s.reason, 'spectrum-too-dense');
    assert.ok(s.detail.includes('M=199'), `明细应点名最高谐波：${s.detail}`);
  });

  it('简并谱（全等能量）⇒ degenerate-spectrum；维度超 cap ⇒ dimension-cap', () => {
    const degenerate = analyzeGammaSpectrum(new Float64Array([3, 3, 3]));
    assert.ok(!degenerate.ok);
    assert.equal(degenerate.reason, 'degenerate-spectrum');
    const capped = analyzeGammaSpectrum(new Float64Array(16), { maxDimension: 8 });
    assert.ok(!capped.ok);
    assert.equal(capped.reason, 'dimension-cap');
  });

  it('负对照：NaN 能量 / 偶数 maxSamples / 单点谱逐条具名拒绝', () => {
    assert.throws(
      () => analyzeGammaSpectrum(new Float64Array([0, Number.NaN, 2])),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('finite'),
    );
    assert.throws(
      () => analyzeGammaSpectrum(new Float64Array([0, 1, 2]), { maxSamples: 256 }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('maxSamples'),
    );
    assert.throws(
      () => analyzeGammaSpectrum(new Float64Array([1])),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('at least 2'),
    );
  });
});

// ----------------------------------------------------------------------------
// 2. 定理钉（解析黑盒）：N 点买断精确恢复已知频率多项式
// ----------------------------------------------------------------------------

/** energies [0,2,4] ⇒ 差 {2,4}，g=2，harmonics [1,2]，N=5（两 describe 共用） */
const SPECTRUM_24 = expectSpectrum(analyzeGammaSpectrum(new Float64Array([0, 2, 4])));
const analyticF = (gamma: number): number =>
  0.7 +
  0.5 * Math.cos(2 * gamma) -
  0.3 * Math.sin(2 * gamma) +
  0.2 * Math.cos(4 * gamma) +
  0.15 * Math.sin(4 * gamma);
const analyticDF = (gamma: number): number =>
  -1.0 * Math.sin(2 * gamma) -
  0.6 * Math.cos(2 * gamma) -
  0.8 * Math.sin(4 * gamma) +
  0.6 * Math.cos(4 * gamma);

describe('R18-D gamma-spectrum-buyout · 解析定理钉', () => {
  it('N=5 点买断：任意点求值与导数 vs 解析 ≤1e-12；杂散 ~舍入；记账 = N+probes', () => {
    const evaluate = (angles: number[]): number => analyticF(angles[0]!);
    const buyout = buyoutGammaCurve(evaluate, [0.4], 0, SPECTRUM_24, GAMMA_BOUND);
    assert.equal(buyout.evaluations, 5 + 2); // 采样 5 + 探针 2
    assert.ok(Math.abs(buyout.c0 - 0.7) < NAIL_EPS, `c0=${buyout.c0}`);
    const r = rngOf(11);
    for (let k = 0; k < 50; k++) {
      const gamma = r() * GAMMA_BOUND;
      assert.ok(
        Math.abs(gammaCurveValueAt(buyout, gamma) - analyticF(gamma)) < NAIL_EPS,
        `valueAt(${gamma}) 偏差超阈`,
      );
      assert.ok(
        Math.abs(gammaCurveDerivativeAt(buyout, gamma) - analyticDF(gamma)) < NAIL_EPS,
        `derivativeAt(${gamma}) 偏差超阈`,
      );
    }
    assert.ok(buyout.maxSpuriousAmplitude < NAIL_EPS, '解析目标无杂散谐波');
    assert.ok(buyout.maxProbeResidual < NAIL_EPS, '探针残差 ~舍入级');
  });

  it('证书钉（解析）：20001 点密扫极小被 [lower, upper] 夹住，gap ≤ targetEps', () => {
    const evaluate = (angles: number[]): number => analyticF(angles[0]!);
    const buyout = buyoutGammaCurve(evaluate, [0.4], 0, SPECTRUM_24, GAMMA_BOUND);
    const cert = minimizeGammaCurve(buyout, GAMMA_BOUND, { targetEps: 1e-9 });
    // 独立密扫 + 最优格内三分精修（解析函数直接三分）：逼近真极小到 ~1e-15
    // （纯格点最小是上界，比证书上界松——必须精修后才能与夹逼区间比对）
    let denseArgmin = 0;
    let denseMin = Infinity;
    for (let j = 0; j <= 20000; j++) {
      const gamma = (j * GAMMA_BOUND) / 20000;
      const v = analyticF(gamma);
      if (v < denseMin) {
        denseMin = v;
        denseArgmin = gamma;
      }
    }
    let lo = Math.max(0, denseArgmin - GAMMA_BOUND / 20000);
    let hi = Math.min(GAMMA_BOUND, denseArgmin + GAMMA_BOUND / 20000);
    for (let it = 0; it < 100 && hi - lo > 1e-15; it++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (analyticF(m1) <= analyticF(m2)) hi = m2;
      else lo = m1;
    }
    denseMin = Math.min(denseMin, analyticF((lo + hi) / 2));
    assert.ok(
      cert.lowerBound - 1e-12 <= denseMin,
      `下界 ${cert.lowerBound} 应 ≤ 密扫极小 ${denseMin}`,
    );
    assert.ok(
      denseMin <= cert.upperBound + 1e-12,
      `密扫极小 ${denseMin} 应 ≤ 上界 ${cert.upperBound}`,
    );
    assert.ok(cert.lipschitz > 0);
    // gap 断言按网格是否被 maxGrid 截断分派（诚实口径）：
    // - 通用上界 gap ≤ L₁·bound/(2·(gridPoints−1)) + ε（valueBest ≤ gridMin）；
    // - 未截断（gridPoints < maxGrid）时另钉 gap ≤ targetEps。
    const truncatedGap = (cert.lipschitz * GAMMA_BOUND) / (2 * (cert.gridPoints - 1));
    assert.ok(
      cert.gap <= truncatedGap + 1e-15,
      `gap ${cert.gap} 应 ≤ 截断公式 ${truncatedGap}（gridPoints=${cert.gridPoints}）`,
    );
    // 细目标 1e-9 触发 maxGrid=65536 上限（L₁·bound/(2ε) ≈ 3.4e9）：如实记录
    assert.equal(cert.gridPoints, 65536, '细目标下网格被 maxGrid 截断（诚实放宽，不冒充达成）');
    // targetEps=1e-3 未触上限：证书 gap ≤ 1e-3 直接成立（未截断分支的独立钉）
    const coarse = minimizeGammaCurve(buyout, GAMMA_BOUND, { targetEps: 1e-3 });
    assert.ok(coarse.gap <= 1e-3 + 1e-15, `粗目标下 gap ${coarse.gap} 应 ≤ 1e-3`);
    assert.ok(coarse.gridPoints < 65536, '粗目标不应触及 maxGrid 上限');
  });
});

// ----------------------------------------------------------------------------
// 3. 定理钉（真实电路）：子空间与全空间 QAOA 电路上的买断对拍
// ----------------------------------------------------------------------------

describe('R18-D gamma-spectrum-buyout · 真实电路定理钉', () => {
  it('子空间 3×5（dim=60，整数权重）：闭式值 vs 真实 evaluate 30 点 ≤1e-9；梯度 ≤1e-7', () => {
    const model = buildSubspaceModel(integerProblem(3, 5, 11))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const angles = randomLayerAngles(rngOf(23), layers);
    const spectrum = expectSpectrum(analyzeGammaSpectrum(energies));
    assert.ok(spectrum.sampleCount <= 25, `N=${spectrum.sampleCount} 应小（W_span ≤ 12）`);
    const buyout = buyoutGammaCurve(evaluate, angles, 0, spectrum, GAMMA_BOUND);
    assert.ok(buyout.maxSpuriousAmplitude < CIRCUIT_EPS, `杂散 ${buyout.maxSpuriousAmplitude}`);
    assert.ok(buyout.maxProbeResidual < CIRCUIT_EPS, `探针 ${buyout.maxProbeResidual}`);
    const r = rngOf(31);
    for (let k = 0; k < 30; k++) {
      const gamma = r() * GAMMA_BOUND;
      const real = evaluate(withAngle(angles, 0, gamma));
      assert.ok(
        Math.abs(gammaCurveValueAt(buyout, gamma) - real) < CIRCUIT_EPS,
        `γ=${gamma.toExponential(3)}: 闭式 ${gammaCurveValueAt(buyout, gamma)} vs 真实 ${real}`,
      );
    }
    // 闭式精确梯度 vs 中心差分（h=1e-6：截断 ~h²L₂、噪声 ~ε/h，容差 1e-7 从量级推导）
    for (const gamma of [0.05, 0.7, 1.9, 2.8]) {
      const h = 1e-6;
      const central =
        (evaluate(withAngle(angles, 0, gamma + h)) - evaluate(withAngle(angles, 0, gamma - h))) /
        (2 * h);
      assert.ok(
        Math.abs(gammaCurveDerivativeAt(buyout, gamma) - central) < DERIV_EPS,
        `γ=${gamma}: 闭式梯度 ${gammaCurveDerivativeAt(buyout, gamma)} vs 中心差分 ${central}`,
      );
    }
  });

  it('全空间 2×3（dim=64，整数权重 + 罚 5）：闭式值 vs 真实 evaluate ≤1e-9', () => {
    const problem = integerProblem(2, 3, 17, { penalty: 5 });
    const info = computeEnergies(problem);
    const energies = normalizedEnergiesOf(info.energies, info.min, info.max, 1);
    const layers = 1;
    const evaluate = (angles: number[]): number => {
      const st = new QuantumStateVector(info.nqubits);
      st.setUniformSuperposition();
      for (let p = 0; p < layers; p++) {
        st.applyCostPhase(angles[p]!, energies);
        st.applyMixer(angles[layers + p]!);
      }
      return expectationValueInto(st, energies);
    };
    const angles = randomLayerAngles(rngOf(41), layers);
    const spectrum = expectSpectrum(analyzeGammaSpectrum(energies));
    const buyout = buyoutGammaCurve(evaluate, angles, 0, spectrum, GAMMA_BOUND);
    assert.ok(buyout.maxProbeResidual < CIRCUIT_EPS, `探针 ${buyout.maxProbeResidual}`);
    const r = rngOf(43);
    for (let k = 0; k < 30; k++) {
      const gamma = r() * GAMMA_BOUND;
      assert.ok(
        Math.abs(gammaCurveValueAt(buyout, gamma) - evaluate(withAngle(angles, 0, gamma))) <
          CIRCUIT_EPS,
      );
    }
  });

  it('证书钉（真实电路）：20001 点密扫极小落在夹逼区间内', () => {
    const model = buildSubspaceModel(integerProblem(3, 5, 11))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const angles = randomLayerAngles(rngOf(23), layers);
    const spectrum = expectSpectrum(analyzeGammaSpectrum(energies));
    const buyout = buyoutGammaCurve(evaluate, angles, 0, spectrum, GAMMA_BOUND);
    const cert = minimizeGammaCurve(buyout, GAMMA_BOUND, { targetEps: 1e-3 });
    // 密扫 + 最优格内三分精修（真电路 evaluate）：逼近真极小（纯格点最小是上界）
    let denseArgmin = 0;
    let denseMin = Infinity;
    for (let j = 0; j <= 20000; j++) {
      const gamma = (j * GAMMA_BOUND) / 20000;
      const v = evaluate(withAngle(angles, 0, gamma));
      if (v < denseMin) {
        denseMin = v;
        denseArgmin = gamma;
      }
    }
    let lo = Math.max(0, denseArgmin - GAMMA_BOUND / 20000);
    let hi = Math.min(GAMMA_BOUND, denseArgmin + GAMMA_BOUND / 20000);
    for (let it = 0; it < 100 && hi - lo > 1e-15; it++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (evaluate(withAngle(angles, 0, m1)) <= evaluate(withAngle(angles, 0, m2))) hi = m2;
      else lo = m1;
    }
    denseMin = Math.min(denseMin, evaluate(withAngle(angles, 0, (lo + hi) / 2)));
    assert.ok(
      cert.lowerBound - 1e-9 <= denseMin && denseMin <= cert.upperBound + 1e-9,
      `密扫极小 ${denseMin} 应落在 [${cert.lowerBound}, ${cert.upperBound}]（gap=${cert.gap}）`,
    );
    assert.ok(cert.gap <= 1e-3 + 1e-12, `gap ${cert.gap} 超 targetEps`);
  });
});

// ----------------------------------------------------------------------------
// 4. 支配性精修 + β 冻结 + skipped 路径 + 记账 + 确定性
// ----------------------------------------------------------------------------

describe('R18-D gamma-spectrum-buyout · 种子化精修（支配性构造）', () => {
  it('4 实例：γ 买断精修值 ≤ layer-CD 种子；β 段逐位不变；γ∈[0,π]；记账下界', () => {
    const rows: string[] = [];
    for (let s = 0; s < 4; s++) {
      const model = buildSubspaceModel(integerProblem(3, 5, 100 + s * 7))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const evaluate = subspaceLayerEvaluate(model, energies, layers);
      const layer = optimizeAnglesByCoordinateDescent(evaluate, layers, 2, mulberry32(42));
      const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
      const refined = refineGammaByTrigBuyout(evaluate, layer.angles, bounds, energies, {
        gammaIndices: [0, 1],
        sweeps: 3,
      });
      assert.ok(
        !refined.skipped,
        `整数谱实例 ${s} 不应 skipped：${JSON.stringify(refined.spectrum)}`,
      );
      assert.ok(
        refined.value <= layer.expectation + 1e-12,
        `seed ${s}: refined ${refined.value} > seed ${layer.expectation}`,
      );
      // β 冻结：精修只动 γ 段（γ 买断不触碰混合角）
      for (let p = 0; p < layers; p++) {
        assert.equal(
          refined.angles[layers + p],
          layer.angles[layers + p],
          `seed ${s}: β_${p} 必须保持种子值`,
        );
      }
      for (let p = 0; p < layers; p++) {
        assert.ok(
          refined.angles[p]! >= 0 && refined.angles[p]! <= GAMMA_BOUND + 1e-12,
          `seed ${s}: γ_${p} 应在 [0,π]`,
        );
      }
      // 记账下界：种子 1 + 每行（N 采样 + ≥0 探针 + 1 确认）
      const spectrum = expectSpectrum(refined.spectrum);
      assert.ok(
        refined.evaluations >= 1 + refined.rows.length * (spectrum.sampleCount + 1),
        `seed ${s}: evaluations ${refined.evaluations} 过小（rows=${refined.rows.length}）`,
      );
      rows.push(
        `seed ${100 + s * 7}: seed=${layer.expectation.toFixed(12)} | refined=${refined.value.toFixed(12)} ` +
          `@${refined.evaluations}ev (sw${refined.sweeps}, rows${refined.rows.length}, N=${spectrum.sampleCount}, ` +
          `maxGap=${Math.max(...refined.rows.map((row) => row.certificateGap)).toExponential(2)})`,
      );
    }
    console.log(`[r18d γ 买断精修 · 子空间 3×5 整数谱，layers=2]\n${rows.join('\n')}`);
  });

  it('随机起点上的支配性：返回值 ≤ 起点（3 个非 CD 种子）', () => {
    const model = buildSubspaceModel(integerProblem(3, 5, 77))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    for (const startSeed of [3, 31, 97]) {
      const angles = randomLayerAngles(rngOf(startSeed), layers);
      const refined = refineGammaByTrigBuyout(evaluate, angles, bounds, energies, {
        gammaIndices: [0, 1],
        sweeps: 4,
      });
      assert.ok(!refined.skipped);
      assert.ok(
        refined.value <= evaluate(angles) + 1e-12,
        `start ${startSeed}: ${refined.value} 应 ≤ ${evaluate(angles)}`,
      );
    }
  });

  it('skipped 路径（三位小数量化谱 ⇒ too-dense）：angles 原样、value=种子、原因具名', () => {
    const model = buildSubspaceModel(quantizedProblem(3, 5, 55))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const angles = randomLayerAngles(rngOf(5), layers);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    const refined = refineGammaByTrigBuyout(evaluate, angles, bounds, energies, {
      gammaIndices: [0, 1],
      sweeps: 3,
    });
    assert.ok(refined.skipped, '量化谱应被诚实拒绝（谱过密）');
    assert.ok(!refined.spectrum.ok);
    assert.equal(refined.spectrum.reason, 'spectrum-too-dense');
    assert.deepEqual(refined.angles, angles, 'skipped 时角度必须原样返回');
    assert.equal(refined.value, evaluate(angles));
    assert.equal(refined.evaluations, 1, '只有种子评估被消耗');
    assert.deepEqual(refined.rows, []);
  });

  it('确定性：同输入双跑 deepEqual', () => {
    const model = buildSubspaceModel(integerProblem(3, 5, 200))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const angles = randomLayerAngles(rngOf(9), layers);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    const opts = { gammaIndices: [0, 1], sweeps: 2 } as const;
    const a = refineGammaByTrigBuyout(evaluate, angles, bounds, energies, opts);
    const b = refineGammaByTrigBuyout(evaluate, angles, bounds, energies, opts);
    assert.deepEqual(b, a);
  });
});

// ----------------------------------------------------------------------------
// 5. 双轴对拍账本（γ 买断 vs 坐标下降续磨：质量 × 评估成本，如实分账）
// ----------------------------------------------------------------------------

describe('R18-D gamma-spectrum-buyout · 双轴对拍（诚实分账）', () => {
  it('同种子同实例：γ 买断 vs CD-seeded 续磨——两者支配种子，名次如实打印', () => {
    const rows: string[] = [];
    for (let s = 0; s < 4; s++) {
      const model = buildSubspaceModel(integerProblem(4, 5, 300 + s * 11))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const evaluate = subspaceLayerEvaluate(model, energies, layers);
      const layer = optimizeAnglesByCoordinateDescent(evaluate, layers, 2, mulberry32(42));
      const bounds = [
        ...Array.from({ length: layers }, () => GAMMA_BOUND),
        ...Array.from({ length: layers }, () => BETA_BOUND),
      ];
      const cd = optimizeAnglesByCoordinateDescentSeeded(
        evaluate,
        layer.angles.length,
        bounds,
        1,
        mulberry32(1),
        layer.angles,
      );
      const gammaBuyout = refineGammaByTrigBuyout(evaluate, layer.angles, bounds, energies, {
        gammaIndices: [0, 1],
        sweeps: 3,
      });
      assert.ok(
        cd.expectation <= layer.expectation + 1e-12,
        `inst ${s}: CD 应支配种子（既有定理）`,
      );
      assert.ok(
        gammaBuyout.value <= layer.expectation + 1e-12,
        `inst ${s}: γ 买对应支配种子（构造性定理）`,
      );
      const skippedTag = gammaBuyout.skipped
        ? `skipped:${gammaBuyout.spectrum.ok ? '' : gammaBuyout.spectrum.reason}`
        : 'engaged';
      rows.push(
        `inst ${300 + s * 11}: seed=${layer.expectation.toFixed(12)} | ` +
          `cd=${cd.expectation.toFixed(12)}@${cd.evaluations}ev | ` +
          `γbuyout=${gammaBuyout.value.toFixed(12)}@${gammaBuyout.evaluations}ev (${skippedTag}) ` +
          `[Δq(γb−cd)=${(gammaBuyout.value - cd.expectation).toExponential(2)}]`,
      );
    }
    console.log(
      `[r18d 双轴对拍 · 子空间 4×5 整数谱，layers=2——如实分账，不松断言说谎]\n${rows.join('\n')}`,
    );
  });
});

// ----------------------------------------------------------------------------
// 6. 负对照（走私审判风格：非法输入与定理前提走私被点名拒绝）
// ----------------------------------------------------------------------------

describe('R18-D gamma-spectrum-buyout · 负对照与走私审判', () => {
  const validEvaluate = (angles: number[]): number =>
    0.7 + 0.5 * Math.cos(2 * angles[0]!) - 0.3 * Math.sin(2 * angles[0]!);

  it('非三角目标（γ²，定理域外）被 outlier 探针具名拦截', () => {
    const smuggled = (angles: number[]): number => 1 + 0.1 * angles[0]! * angles[0]!;
    assert.throws(
      () => buyoutGammaCurve(smuggled, [0.4], 0, SPECTRUM_24, GAMMA_BOUND),
      (err: unknown) =>
        err instanceof QuantumEngineError && err.message.includes('residual mismatch'),
      'γ² 目标不是差集 {2,4} 的三角多项式——探针必须拦截（不用病态拟合冒充精确）',
    );
  });

  it('防线位置对照：probeSamples=0 显式关闭自检时同一走私不被拦截（风险自负面如实呈现）', () => {
    const smuggled = (angles: number[]): number => 1 + 0.1 * angles[0]! * angles[0]!;
    const buyout = buyoutGammaCurve(smuggled, [0.4], 0, SPECTRUM_24, GAMMA_BOUND, {
      probeSamples: 0,
    });
    assert.equal(buyout.evaluations, 5, '探针关闭 ⇒ 只有 N 次采样');
    assert.equal(buyout.maxProbeResidual, 0);
    // 采样点上 DFT 恒等重构（插值性质），但域外点已有可见失配——走私面如实暴露
    assert.ok(
      Math.abs(gammaCurveValueAt(buyout, GAMMA_BOUND * 0.618) - smuggled([GAMMA_BOUND * 0.618])) >
        1e-4,
      'γ² 的截断 Fourier 拟合在探针位置应有可见失配（探针存在的理由）',
    );
  });

  it('失败谱走私买断：把 spectrum-too-dense 结果传给 buyout 被拒', () => {
    const dense = analyzeGammaSpectrum(Float64Array.from({ length: 200 }, (_, i) => i * 0.001));
    assert.ok(!dense.ok);
    assert.throws(
      () => buyoutGammaCurve(validEvaluate, [0.4], 0, dense as never, GAMMA_BOUND),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('spectrum'),
    );
  });

  it('空 gammaIndices（静默 no-op）被拒绝；越界/重复下标被点名', () => {
    const energies = new Float64Array([0, 2, 4]);
    const bounds = [GAMMA_BOUND, BETA_BOUND];
    assert.throws(
      () =>
        refineGammaByTrigBuyout(validEvaluate, [0.4, 0.2], bounds, energies, {
          gammaIndices: [],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('no-op'),
    );
    assert.throws(
      () =>
        refineGammaByTrigBuyout(validEvaluate, [0.4, 0.2], bounds, energies, {
          gammaIndices: [5],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('gammaIndices'),
    );
    assert.throws(
      () =>
        refineGammaByTrigBuyout(validEvaluate, [0.4, 0.2], bounds, energies, {
          gammaIndices: [0, 0],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('duplicates'),
    );
  });

  it('非法 sweeps / NaN 种子角 / bounds 形状与负值 / NaN 能量被逐条具名拒绝', () => {
    const energies = new Float64Array([0, 2, 4]);
    const bounds = [GAMMA_BOUND, BETA_BOUND];
    for (const sweeps of [0, -1, 1.5, Number.NaN]) {
      assert.throws(
        () =>
          refineGammaByTrigBuyout(validEvaluate, [0.4, 0.2], bounds, energies, {
            gammaIndices: [0],
            sweeps,
          }),
        (err: unknown) => err instanceof QuantumEngineError && err.message.includes('sweeps'),
      );
    }
    assert.throws(
      () =>
        refineGammaByTrigBuyout(validEvaluate, [Number.NaN, 0.2], bounds, energies, {
          gammaIndices: [0],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('seedAngles'),
    );
    assert.throws(
      () =>
        refineGammaByTrigBuyout(validEvaluate, [0.4, 0.2], [GAMMA_BOUND], energies, {
          gammaIndices: [0],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('bounds'),
    );
    assert.throws(
      () =>
        refineGammaByTrigBuyout(validEvaluate, [0.4, 0.2], [GAMMA_BOUND, -1], energies, {
          gammaIndices: [0],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('bounds'),
    );
    assert.throws(
      () =>
        refineGammaByTrigBuyout(
          validEvaluate,
          [0.4, 0.2],
          bounds,
          new Float64Array([0, Number.NaN]),
          {
            gammaIndices: [0],
          },
        ),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('finite'),
    );
  });

  it('非有限评估值被具名拒绝（NaN 不静默流穿买断）', () => {
    const energies = new Float64Array([0, 2, 4]);
    const bounds = [GAMMA_BOUND, BETA_BOUND];
    const bad = (angles: number[]): number => (angles[0]! > 0.5 ? Number.NaN : 1);
    assert.throws(
      () =>
        refineGammaByTrigBuyout(bad, [0.9, 0.2], bounds, energies, {
          gammaIndices: [0],
          sweeps: 1,
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('evaluate'),
    );
  });

  it('buyout/minimize 纯函数域校验：越界 gammaIndex、负 bound、非法 targetEps/maxGrid', () => {
    assert.throws(
      () => buyoutGammaCurve(validEvaluate, [0.4], 3, SPECTRUM_24, GAMMA_BOUND),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('gammaIndex'),
    );
    assert.throws(
      () => buyoutGammaCurve(validEvaluate, [0.4], 0, SPECTRUM_24, -1),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('bound'),
    );
    const buyout = buyoutGammaCurve(validEvaluate, [0.4], 0, SPECTRUM_24, GAMMA_BOUND);
    assert.throws(
      () => minimizeGammaCurve(buyout, GAMMA_BOUND, { targetEps: 0 }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('targetEps'),
    );
    assert.throws(
      () => minimizeGammaCurve(buyout, GAMMA_BOUND, { maxGrid: 1 }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('maxGrid'),
    );
  });
});
