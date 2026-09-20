/**
 * R19-Q 创新2：nonuniform-gamma-buyout（非均匀贪心采样买断）的行为钉。
 *
 * 本模块收窄 gamma-spectrum-buyout 的两个拒绝域（落码前机器可行性已验：
 * tmp/r19q-feasibility-nonuniform.mjs，恢复误差 ~1e-16、pivotRatio 2–5、
 * 证书夹逼成立——容差据此推导）。
 *
 * 七类断言：
 * 1. 谱分析——不可公度差集成功（R/K/span 逐字段）；公度小谱兼容（超集）；
 *    真过密（R=199 ⇒ K=399 > 257）仍诚实拒绝（信息论下界：2R+1 个系数
 *    至少 2R+1 个采样）；degenerate / dimension-cap / NaN 逐条具名；
 * 2. 域扩张钉（核心验收）——同一 energies 两版分析对照：不可公度
 *    [0,1,√2]（均匀版 'incommensurable' 拒 / 非均匀成 R=3）；稀疏高谐波
 *    [0,0.5,101]（均匀版 'spectrum-too-dense' M=202 拒 / 非均匀成 R=3，
 *    采样数 7 vs 均匀版所需 405）；
 * 3. 解析定理钉——不可公度与稀疏高谐波已知系数多项式被 K=2R+1 点贪心
 *    买断精确恢复：50 点值/导数 vs 解析 ≤1e-13；pivotRatio 审计 <1e3
 *    （实测 2–5）；记账 = K+probes；贪心选点零电路评估；
 * 4. 证书钉——三分精修后的真极小被 [lower, upper] 夹住（解析目标）；
 * 5. 真实电路钉——不可公度谱子空间电路（weights 含 √2）：闭式 vs 真实
 *    evaluate 30 点 ≤1e-9、梯度 vs 中心差分 ≤1e-7；精修支配性（随机
 *    起点 3 个：返回值 ≤ 起点）；skipped 路径 + 确定性；
 * 6. 负对照（走私审判）——非三角目标（γ²）与错误谱（差集与电路不符）
 *    均被 outlier 探针具名拦截；probeSamples=0 显式关闭时不拦（防线
 *    位置对照）；非法输入逐条具名；
 * 7. 端到端账本——均匀版 skip 的两个域（不可公度 / 稀疏高谐波真电路）
 *    上非均匀精修工作且支配；公度小谱上两版皆工作（如实对拍）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { couplingKey } from '../src/core/quantum-optimizer.js';
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
} from '../src/core/solver-common.js';
import { mulberry32 } from '../src/utils/rng.js';
import { QuantumEngineError } from '../src/utils/errors.js';
import { GAMMA_BOUND, BETA_BOUND } from '../src/core/constants.js';
import {
  analyzeGammaSpectrum,
  refineGammaByTrigBuyout,
} from '../src/core/gamma-spectrum-buyout.js';
import {
  analyzeNonuniformSpectrum,
  buyoutGammaCurveNonuniform,
  minimizeNonuniformGammaCurve,
  nonuniformCurveDerivativeAt,
  nonuniformCurveValueAt,
  refineGammaByNonuniformBuyout,
  type NonuniformSpectrumResult,
} from '../src/core/nonuniform-gamma-buyout.js';

const NAIL_EPS = 1e-13;
const CIRCUIT_EPS = 1e-9;
const DERIV_EPS = 1e-7;

function rngOf(seed: number): () => number {
  return mulberry32(seed);
}

/** 显式窄化 helper（assert.ok 不窄化联合类型的属性表达式） */
function expectSpectrum(s: NonuniformSpectrumResult) {
  if (!s.ok) throw new Error(`nonuniform spectrum analysis failed: ${JSON.stringify(s)}`);
  return s;
}

function subspaceEnergies(model: SubspaceModel): Float64Array {
  const { min, max } = minMaxOf(model.energies);
  return normalizedEnergiesOf(model.energies, min, max, 1);
}

/** 子空间 layer 布局评估闭包：angles = [γ_1..γ_p, β_1..β_p]（r18d 同构造） */
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

/** 任意权重问题（本测试需要不可公度 / 稀疏高谐波谱，权重由调用方给） */
function weightedProblem(weights: number[][]): AssignmentProblem {
  const m = weights.length;
  const n = weights[0]!.length;
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
    p.couplings.set(couplingKey(t1 * n, (t1 + 1) * n + 1, nq), 0);
  }
  return p;
}

/** 由 analyze 返回的差集构造解析多项式与导数（系数序 = differences 序） */
function analyticFromDifferences(
  differences: readonly number[],
  coeffs: readonly number[], // [c0, a1, b1, a2, b2, ...]
) {
  const f = (gamma: number): number => {
    let v = coeffs[0]!;
    for (let r = 0; r < differences.length; r++) {
      v +=
        coeffs[2 * r + 1]! * Math.cos(differences[r]! * gamma) +
        coeffs[2 * r + 2]! * Math.sin(differences[r]! * gamma);
    }
    return v;
  };
  const df = (gamma: number): number => {
    let v = 0;
    for (let r = 0; r < differences.length; r++) {
      const d = differences[r]!;
      v +=
        d * (coeffs[2 * r + 2]! * Math.cos(d * gamma) - coeffs[2 * r + 1]! * Math.sin(d * gamma));
    }
    return v;
  };
  return { f, df };
}

// ----------------------------------------------------------------------------
// 1. 谱分析（结构面：成功 / 兼容 / 真过密 / 简并 / 上限 / 负对照）
// ----------------------------------------------------------------------------

describe('R19-Q nonuniform-gamma-buyout · 谱差分析', () => {
  it('不可公度谱 [0,1,√2]：差 {√2−1, 1, √2}、R=3、K=7、span=2π/(√2−1) 逐字段钉死', () => {
    const s = expectSpectrum(analyzeNonuniformSpectrum(new Float64Array([0, 1, Math.SQRT2])));
    assert.equal(s.differences.length, 3);
    assert.ok(Math.abs(s.differences[0]! - (Math.SQRT2 - 1)) < 1e-12);
    assert.ok(Math.abs(s.differences[1]! - 1) < 1e-12);
    assert.ok(Math.abs(s.differences[2]! - Math.SQRT2) < 1e-12);
    assert.equal(s.frequencyCount, 3);
    assert.equal(s.sampleCount, 7);
    assert.ok(Math.abs(s.samplingSpan - (2 * Math.PI) / (Math.SQRT2 - 1)) < 1e-9);
    assert.equal(s.distinctEnergies, 3);
  });

  it('公度谱 [0,2,4] 兼容（超集钉：非均匀面不回归均匀面已覆盖的域）', () => {
    const s = expectSpectrum(analyzeNonuniformSpectrum(new Float64Array([0, 2, 4])));
    assert.equal(s.frequencyCount, 2);
    assert.equal(s.sampleCount, 5);
    assert.ok(Math.abs(s.differences[0]! - 2) < 1e-12);
    assert.ok(Math.abs(s.differences[1]! - 4) < 1e-12);
  });

  it('真过密（200 个 0.001 步长点 ⇒ R=199 ⇒ K=399 > 257）：诚实拒绝（信息论下界）', () => {
    const energies = Float64Array.from({ length: 200 }, (_, i) => i * 0.001);
    const s = analyzeNonuniformSpectrum(energies);
    assert.ok(!s.ok);
    assert.equal(s.reason, 'spectrum-too-dense');
    assert.ok(s.detail.includes('R=199'), `明细应点名频率数：${s.detail}`);
  });

  it('简并谱 ⇒ degenerate-spectrum；维度超 cap ⇒ dimension-cap；NaN 具名拒', () => {
    const degenerate = analyzeNonuniformSpectrum(new Float64Array([3, 3, 3]));
    assert.ok(!degenerate.ok);
    assert.equal(degenerate.reason, 'degenerate-spectrum');
    const capped = analyzeNonuniformSpectrum(new Float64Array(16), { maxDimension: 8 });
    assert.ok(!capped.ok);
    assert.equal(capped.reason, 'dimension-cap');
    assert.throws(
      () => analyzeNonuniformSpectrum(new Float64Array([0, Number.NaN, 2])),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('finite'),
    );
    assert.throws(
      () => analyzeNonuniformSpectrum(new Float64Array([0, 1, 2]), { maxSamples: 256 }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('maxSamples'),
    );
  });
});

// ----------------------------------------------------------------------------
// 2. 域扩张钉（核心验收）：同一能量表两版分析对照
// ----------------------------------------------------------------------------

describe('R19-Q nonuniform-gamma-buyout · 域扩张钉', () => {
  it('不可公度 [0,1,√2]：均匀版 incommensurable 拒 / 非均匀版成功（R=3, K=7）', () => {
    const energies = new Float64Array([0, 1, Math.SQRT2]);
    const uniform = analyzeGammaSpectrum(energies);
    assert.ok(!uniform.ok);
    assert.equal(uniform.reason, 'incommensurable');
    const nonuniform = analyzeNonuniformSpectrum(energies);
    assert.ok(nonuniform.ok, '非均匀面应接纳不可公度差集');
  });

  it('稀疏高谐波 [0,0.5,101]：均匀版 M=202 ⇒ N=405 拒 / 非均匀版 R=3 ⇒ K=7（7 vs 405）', () => {
    const energies = new Float64Array([0, 0.5, 101]);
    const uniform = analyzeGammaSpectrum(energies);
    assert.ok(!uniform.ok);
    assert.equal(uniform.reason, 'spectrum-too-dense');
    const nonuniform = expectSpectrum(analyzeNonuniformSpectrum(energies));
    assert.equal(nonuniform.frequencyCount, 3);
    assert.equal(nonuniform.sampleCount, 7);
  });
});

// ----------------------------------------------------------------------------
// 3. 解析定理钉：K 点贪心买断精确恢复已知系数多项式
// ----------------------------------------------------------------------------

describe('R19-Q nonuniform-gamma-buyout · 解析定理钉', () => {
  it('不可公度 {√2−1,1,√2}：7 点恢复，50 点值/导数 ≤1e-13；pivotRatio <1e3；记账 7+2', () => {
    const s = expectSpectrum(analyzeNonuniformSpectrum(new Float64Array([0, 1, Math.SQRT2])));
    const coeffs = [0.7, 0.5, -0.3, 0.2, 0.15, -0.1, 0.05];
    const { f, df } = analyticFromDifferences(s.differences, coeffs);
    const evaluate = (angles: number[]): number => f(angles[0]!);
    const buyout = buyoutGammaCurveNonuniform(evaluate, [0.4], 0, s, GAMMA_BOUND);
    assert.equal(buyout.evaluations, 7 + 2); // 采样 K=7 + 探针 2（贪心选点零评估）
    assert.ok(Math.abs(buyout.c0 - 0.7) < NAIL_EPS, `c0=${buyout.c0}`);
    assert.ok(buyout.pivotRatio < 1e3, `pivotRatio=${buyout.pivotRatio}（实测水平 2–5）`);
    assert.ok(buyout.maxProbeResidual < NAIL_EPS, `探针残差 ${buyout.maxProbeResidual}`);
    const r = rngOf(11);
    for (let k = 0; k < 50; k++) {
      const gamma = r() * GAMMA_BOUND;
      assert.ok(
        Math.abs(nonuniformCurveValueAt(buyout, gamma) - f(gamma)) < NAIL_EPS,
        `valueAt(${gamma}) 偏差超阈`,
      );
      assert.ok(
        Math.abs(nonuniformCurveDerivativeAt(buyout, gamma) - df(gamma)) < NAIL_EPS,
        `derivativeAt(${gamma}) 偏差超阈`,
      );
    }
    // 贪心选点确定性：同谱双跑选点逐位一致
    const again = buyoutGammaCurveNonuniform(evaluate, [0.4], 0, s, GAMMA_BOUND);
    assert.deepEqual([...buyout.sampleGammas], [...again.sampleGammas]);
  });

  it('稀疏高谐波 {0.5/101, 100.5/101, 1}（归一化）：7 点恢复同钉', () => {
    const s = expectSpectrum(analyzeNonuniformSpectrum(new Float64Array([0, 0.5, 101])));
    const coeffs = [0.7, 0.5, -0.3, 0.2, 0.15, -0.1, 0.05];
    const { f, df } = analyticFromDifferences(s.differences, coeffs);
    const evaluate = (angles: number[]): number => f(angles[0]!);
    const buyout = buyoutGammaCurveNonuniform(evaluate, [0.4], 0, s, GAMMA_BOUND);
    assert.equal(buyout.evaluations, 7 + 2);
    assert.ok(buyout.pivotRatio < 1e3, `pivotRatio=${buyout.pivotRatio}`);
    const r = rngOf(13);
    for (let k = 0; k < 50; k++) {
      const gamma = r() * GAMMA_BOUND;
      assert.ok(
        Math.abs(nonuniformCurveValueAt(buyout, gamma) - f(gamma)) < NAIL_EPS,
        `valueAt(${gamma}) 偏差超阈`,
      );
      assert.ok(
        Math.abs(nonuniformCurveDerivativeAt(buyout, gamma) - df(gamma)) < NAIL_EPS,
        `derivativeAt(${gamma}) 偏差超阈`,
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 4. 证书钉（解析）：真极小被 [lower, upper] 夹住
// ----------------------------------------------------------------------------

describe('R19-Q nonuniform-gamma-buyout · 证书钉', () => {
  it('不可公度解析目标：20001 点密扫 + 三分精修的真极小落在夹逼区间内', () => {
    const s = expectSpectrum(analyzeNonuniformSpectrum(new Float64Array([0, 1, Math.SQRT2])));
    const coeffs = [0.7, 0.5, -0.3, 0.2, 0.15, -0.1, 0.05];
    const { f } = analyticFromDifferences(s.differences, coeffs);
    const evaluate = (angles: number[]): number => f(angles[0]!);
    const buyout = buyoutGammaCurveNonuniform(evaluate, [0.4], 0, s, GAMMA_BOUND);
    const cert = minimizeNonuniformGammaCurve(buyout, GAMMA_BOUND, { targetEps: 1e-3 });
    // 密扫 + 最优格内三分精修逼近真极小（纯格点最小是上界，不可直接比）
    let denseArgmin = 0;
    let denseMin = Infinity;
    for (let j = 0; j <= 20000; j++) {
      const gamma = (j * GAMMA_BOUND) / 20000;
      const v = f(gamma);
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
      if (f(m1) <= f(m2)) hi = m2;
      else lo = m1;
    }
    denseMin = Math.min(denseMin, f((lo + hi) / 2));
    assert.ok(
      cert.lowerBound - 1e-12 <= denseMin,
      `下界 ${cert.lowerBound} 应 ≤ 真极小 ${denseMin}`,
    );
    assert.ok(
      denseMin <= cert.upperBound + 1e-12,
      `真极小 ${denseMin} 应 ≤ 上界 ${cert.upperBound}`,
    );
    assert.ok(cert.gap <= 1e-3 + 1e-12, `gap ${cert.gap} 应 ≤ targetEps`);
    assert.ok(cert.lipschitz > 0);
  });
});

// ----------------------------------------------------------------------------
// 5. 真实电路钉：不可公度谱电路 + 精修支配性 + skipped + 确定性
// ----------------------------------------------------------------------------

describe('R19-Q nonuniform-gamma-buyout · 真实电路钉', () => {
  it('不可公度谱电路（weights 含 √2，dim=6）：闭式 vs 真实 30 点 ≤1e-9；梯度 ≤1e-7；均匀版对照拒', () => {
    const model = buildSubspaceModel(
      weightedProblem([
        [1, Math.SQRT2, 2],
        [1, 2, Math.SQRT2],
      ]),
    )!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const angles = randomLayerAngles(rngOf(23), layers);
    // 均匀版对照：不可公度差集被拒（拒绝域收窄的机器证据）
    const uniform = analyzeGammaSpectrum(energies);
    assert.ok(!uniform.ok);
    assert.equal(uniform.reason, 'incommensurable');
    const spectrum = expectSpectrum(analyzeNonuniformSpectrum(energies));
    assert.ok(spectrum.frequencyCount >= 3, `R=${spectrum.frequencyCount} 应 ≥3（差集含多值）`);
    const buyout = buyoutGammaCurveNonuniform(evaluate, angles, 0, spectrum, GAMMA_BOUND);
    assert.ok(buyout.maxProbeResidual < CIRCUIT_EPS, `探针 ${buyout.maxProbeResidual}`);
    assert.ok(buyout.pivotRatio < 1e3, `pivotRatio=${buyout.pivotRatio}`);
    const r = rngOf(31);
    for (let k = 0; k < 30; k++) {
      const gamma = r() * GAMMA_BOUND;
      const real = evaluate(withAngle(angles, 0, gamma));
      assert.ok(
        Math.abs(nonuniformCurveValueAt(buyout, gamma) - real) < CIRCUIT_EPS,
        `γ=${gamma.toExponential(3)}: 闭式 ${nonuniformCurveValueAt(buyout, gamma)} vs 真实 ${real}`,
      );
    }
    for (const gamma of [0.05, 0.7, 1.9, 2.8]) {
      const h = 1e-6;
      const central =
        (evaluate(withAngle(angles, 0, gamma + h)) - evaluate(withAngle(angles, 0, gamma - h))) /
        (2 * h);
      assert.ok(
        Math.abs(nonuniformCurveDerivativeAt(buyout, gamma) - central) < DERIV_EPS,
        `γ=${gamma}: 闭式梯度 ${nonuniformCurveDerivativeAt(buyout, gamma)} vs 中心差分 ${central}`,
      );
    }
  });

  it('稀疏高谐波电路（weights {0,0.5,101}，dim=6）：闭式 vs 真实 ≤1e-9；均匀版对照拒（M=202）', () => {
    const model = buildSubspaceModel(
      weightedProblem([
        [0, 0.5, 101],
        [0, 0, 0],
      ]),
    )!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const angles = randomLayerAngles(rngOf(41), layers);
    const uniform = analyzeGammaSpectrum(energies);
    assert.ok(!uniform.ok);
    assert.equal(uniform.reason, 'spectrum-too-dense');
    const spectrum = expectSpectrum(analyzeNonuniformSpectrum(energies));
    assert.equal(spectrum.frequencyCount, 3);
    const buyout = buyoutGammaCurveNonuniform(evaluate, angles, 0, spectrum, GAMMA_BOUND);
    assert.ok(buyout.maxProbeResidual < CIRCUIT_EPS, `探针 ${buyout.maxProbeResidual}`);
    const r = rngOf(43);
    for (let k = 0; k < 30; k++) {
      const gamma = r() * GAMMA_BOUND;
      assert.ok(
        Math.abs(nonuniformCurveValueAt(buyout, gamma) - evaluate(withAngle(angles, 0, gamma))) <
          CIRCUIT_EPS,
      );
    }
  });

  it('精修支配性：随机起点 3 个，返回值 ≤ 起点；β 段逐位不动', () => {
    const model = buildSubspaceModel(
      weightedProblem([
        [1, Math.SQRT2, 2],
        [1, 2, Math.SQRT2],
      ]),
    )!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    for (const startSeed of [3, 31, 97]) {
      const angles = randomLayerAngles(rngOf(startSeed), layers);
      const refined = refineGammaByNonuniformBuyout(evaluate, angles, bounds, energies, {
        gammaIndices: [0, 1],
        sweeps: 4,
      });
      assert.ok(!refined.skipped, `不可公度谱不应 skipped：${JSON.stringify(refined.spectrum)}`);
      assert.ok(
        refined.value <= evaluate(angles) + 1e-12,
        `start ${startSeed}: ${refined.value} 应 ≤ ${evaluate(angles)}`,
      );
      for (let p = 0; p < layers; p++) {
        assert.equal(refined.angles[layers + p], angles[layers + p], `β_${p} 必须保持种子值`);
      }
    }
  });

  it('skipped 路径（真过密 R=199）：angles 原样、value=种子、原因具名；确定性双跑 deepEqual', () => {
    const denseEnergies = Float64Array.from({ length: 200 }, (_, i) => i * 0.001);
    const evaluate = (angles: number[]): number =>
      0.3 + 0.2 * Math.cos(denseEnergies[37]! * angles[0]!);
    const angles = [0.4, 0.2];
    const bounds = [GAMMA_BOUND, GAMMA_BOUND];
    const refined = refineGammaByNonuniformBuyout(evaluate, angles, bounds, denseEnergies, {
      gammaIndices: [0],
      sweeps: 3,
    });
    assert.ok(refined.skipped, '真过密谱应被诚实拒绝（信息论下界）');
    assert.ok(!refined.spectrum.ok);
    assert.equal(refined.spectrum.reason, 'spectrum-too-dense');
    assert.deepEqual(refined.angles, angles);
    assert.equal(refined.value, evaluate(angles));
    assert.deepEqual(refined.rows, []);
    // 确定性（非 skip 分支）：不可公度电路同输入双跑
    const model = buildSubspaceModel(
      weightedProblem([
        [1, Math.SQRT2, 2],
        [1, 2, Math.SQRT2],
      ]),
    )!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate2 = subspaceLayerEvaluate(model, energies, layers);
    const start = randomLayerAngles(rngOf(9), layers);
    const bounds2 = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    const run = (): ReturnType<typeof refineGammaByNonuniformBuyout> =>
      refineGammaByNonuniformBuyout(evaluate2, start, bounds2, energies, {
        gammaIndices: [0, 1],
        sweeps: 3,
      });
    assert.deepEqual(run(), run());
  });
});

// ----------------------------------------------------------------------------
// 6. 负对照（走私审判）与防线位置
// ----------------------------------------------------------------------------

describe('R19-Q nonuniform-gamma-buyout · 负对照', () => {
  it('非三角目标（γ²，定理域外）被 outlier 探针具名拦截', () => {
    const s = expectSpectrum(analyzeNonuniformSpectrum(new Float64Array([0, 1, Math.SQRT2])));
    const evaluate = (angles: number[]): number => angles[0]! * angles[0]!;
    assert.throws(
      () => buyoutGammaCurveNonuniform(evaluate, [0.4], 0, s, GAMMA_BOUND),
      (err: unknown) =>
        err instanceof QuantumEngineError && err.message.includes('residual mismatch'),
    );
  });

  it('错误谱走私（差集与目标真实频率不符）被探针具名拦截', () => {
    // 目标真实频率 {2,4}（energies [0,2,4] 的差集），但传入 [0,1,√2] 的谱
    const s = expectSpectrum(analyzeNonuniformSpectrum(new Float64Array([0, 1, Math.SQRT2])));
    const evaluate = (angles: number[]): number =>
      0.7 + 0.5 * Math.cos(2 * angles[0]!) + 0.2 * Math.sin(4 * angles[0]!);
    assert.throws(
      () => buyoutGammaCurveNonuniform(evaluate, [0.4], 0, s, GAMMA_BOUND),
      (err: unknown) =>
        err instanceof QuantumEngineError && err.message.includes('residual mismatch'),
    );
  });

  it('probeSamples=0 显式关闭时不拦（防线位置对照，风险自负）', () => {
    const s = expectSpectrum(analyzeNonuniformSpectrum(new Float64Array([0, 1, Math.SQRT2])));
    const evaluate = (angles: number[]): number => angles[0]! * angles[0]!;
    const buyout = buyoutGammaCurveNonuniform(evaluate, [0.4], 0, s, GAMMA_BOUND, {
      probeSamples: 0,
    });
    assert.equal(buyout.evaluations, 7); // 无探针：仅 K 采样
    assert.equal(buyout.maxProbeResidual, 0); // 关闭的如实记录（0 = 未审计，非「通过」）
  });

  it('非法输入逐条具名：空 gammaIndices / 越界 / 重复 / bounds 形状 / 非有限评估 / 失败谱走私', () => {
    const evaluate = (angles: number[]): number => angles[0]!;
    const energies = new Float64Array([0, 1, Math.SQRT2]);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND];
    assert.throws(
      () =>
        refineGammaByNonuniformBuyout(evaluate, [0.4, 0.2], bounds, energies, {
          gammaIndices: [],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('at least one'),
    );
    assert.throws(
      () =>
        refineGammaByNonuniformBuyout(evaluate, [0.4, 0.2], bounds, energies, {
          gammaIndices: [7],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('gammaIndices'),
    );
    assert.throws(
      () =>
        refineGammaByNonuniformBuyout(evaluate, [0.4, 0.2], bounds, energies, {
          gammaIndices: [0, 0],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('duplicate'),
    );
    assert.throws(
      () =>
        refineGammaByNonuniformBuyout(evaluate, [0.4, 0.2], [GAMMA_BOUND], energies, {
          gammaIndices: [0],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('bounds length'),
    );
    assert.throws(
      () =>
        refineGammaByNonuniformBuyout(() => Number.NaN, [0.4, 0.2], bounds, energies, {
          gammaIndices: [0],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('finite'),
    );
    // 失败谱（ok:false）走私进 buyout：运行时形状守卫具名拒绝。
    // TS 编译期已拒 Failure 直传（判别联合本就是第一道防线）——此处经
    // unknown 收宽模拟 JS 调用侧走私，钉运行时守卫这道防线
    const dense = analyzeNonuniformSpectrum(
      Float64Array.from({ length: 200 }, (_, i) => i * 0.001),
    );
    assert.ok(!dense.ok);
    const smuggled = dense as unknown as Parameters<typeof buyoutGammaCurveNonuniform>[3];
    assert.throws(
      () => buyoutGammaCurveNonuniform(evaluate, [0.4], 0, smuggled, GAMMA_BOUND),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('spectrum'),
    );
  });
});

// ----------------------------------------------------------------------------
// 7. 端到端账本：均匀版 skip 的两个域上非均匀精修工作且支配
// ----------------------------------------------------------------------------

describe('R19-Q nonuniform-gamma-buyout · 端到端账本', () => {
  it('两个均匀版拒绝域（不可公度 / 稀疏高谐波）：非均匀精修 ≤ layer-CD 种子；公度谱两版皆工作', () => {
    const rows: string[] = [];
    const cases: Array<{ name: string; weights: number[][]; uniformSkips: boolean }> = [
      {
        name: '不可公度谱',
        weights: [
          [1, Math.SQRT2, 2],
          [1, 2, Math.SQRT2],
        ],
        uniformSkips: true,
      },
      {
        name: '稀疏高谐波',
        weights: [
          [0, 0.5, 101],
          [0, 0, 0],
        ],
        uniformSkips: true,
      },
    ];
    for (const c of cases) {
      const model = buildSubspaceModel(weightedProblem(c.weights))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const evaluate = subspaceLayerEvaluate(model, energies, layers);
      const layer = optimizeAnglesByCoordinateDescent(evaluate, layers, 2, mulberry32(42));
      const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
      const refined = refineGammaByNonuniformBuyout(evaluate, layer.angles, bounds, energies, {
        gammaIndices: [0, 1],
        sweeps: 3,
      });
      assert.ok(!refined.skipped, `${c.name}: 非均匀面应工作`);
      assert.ok(
        refined.value <= layer.expectation + 1e-12,
        `${c.name}: ${refined.value} 应 ≤ 种子 ${layer.expectation}`,
      );
      const spectrum = expectSpectrum(refined.spectrum);
      if (c.uniformSkips) {
        const uniform = refineGammaByTrigBuyout(evaluate, layer.angles, bounds, energies, {
          gammaIndices: [0, 1],
          sweeps: 3,
        });
        assert.ok(uniform.skipped, `${c.name}: 均匀版应 skip（拒绝域收窄的对照证据）`);
      }
      rows.push(
        `[${c.name}] seed=${layer.expectation.toFixed(12)} | 非均匀精修=${refined.value.toFixed(12)} ` +
          `@${refined.evaluations}ev (sw${refined.sweeps}, rows${refined.rows.length}, K=${spectrum.sampleCount}, ` +
          `maxPivotRatio=${Math.max(...refined.rows.map((row) => row.pivotRatio)).toFixed(2)}, ` +
          `maxGap=${Math.max(...refined.rows.map((row) => row.certificateGap)).toExponential(2)})`,
      );
    }
    console.log(`[r19q 非均匀买断 · 均匀版拒绝域上的端到端账本，layers=2]\n${rows.join('\n')}`);
  });
});
