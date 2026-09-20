/**
 * R19-Q 创新1：gamma-beta-alternating（γβ 联合交替精修器）的行为钉。
 *
 * 六类断言：
 * 1. 解析定理钉（可分目标）——单余弦(β) + 三角多项式(γ) 的可分目标上，
 *    联合交替收敛到两段独立极小之和（可分性使联合不动点 = 全局极小，
 *    诚实注释：不可分目标无此主张）≤1e-9；
 * 2. 真实电路钉——子空间 3×5 整数谱（dim=60，layers=2）：γβ 交替返回值
 *    ≤ 种子（构造性支配）；sweepValues 轨迹单调不增（A1 机器证据）；
 * 3. 联合不动点钉——零接受轮早停后（断言 sweeps < 上限证明确实早停），
 *    对每个参与坐标（β 与 γ）512 点扫描无显著改进（ε-坐标不动点）；
 * 4. 诚实分账账本——同种子四臂对拍（种子 = layer-CD 终角 / ECCM-only
 *    （γ 冻结）/ γ-only（β 冻结）/ γβ 联合）：各臂 ≤ 各自种子（构造性）
 *    断言；臂间胜负如实打印入账，不设硬断言不说谎；
 * 5. 负对照——非三角目标（γ²，定理域外）被 γ 买断探针具名拦截；
 *    空 specs + 空 gammaIndices 的静默 no-op 入口拒绝；谱过密（量化谱）
 *    ⇒ γ 块冻结（角度逐位不动）+ β 块照常工作 + spectrum 原因具名（A4
 *    优雅降级钉）；
 * 6. 确定性——同输入双跑 deepEqual；非法输入（bounds 形状/NaN 种子角/
 *    非有限评估/非法 sweeps）逐条具名拒绝。
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
import { subspaceMixerGap, type MixerAngleSpec } from '../src/core/parameter-shift.js';
import { refineAnglesByExactCosine } from '../src/core/exact-cosine-coordinate.js';
import { refineGammaByTrigBuyout } from '../src/core/gamma-spectrum-buyout.js';
import { refineAnglesByGammaBetaAlternation } from '../src/core/gamma-beta-alternating.js';

const SEPARABLE_EPS = 1e-9;
const SCAN_POINTS = 512;
const FIXED_POINT_EPS = 1e-9;

function rngOf(seed: number): () => number {
  return mulberry32(seed);
}

/** 整数权重问题（谱差公度：W 全整数 ⇒ 差 = 整数格）——r18d 同构造 */
function integerProblem(m: number, n: number, seed: number): AssignmentProblem {
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
  return p;
}

/** 三位小数量化权重问题（谱过密：γ 块冻结路径的实例）——r18d 同构造 */
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
  const span = 2 * (5 * m + m / 2 + 1);
  p.penaltyOneHot = span;
  p.penaltyCapacity = span;
  return p;
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

/** 3×5 子空间实例的 β specs（layers 段；均匀 k=3 纤维 ⇒ gap=3，动态取） */
function layerBetaSpecs(model: SubspaceModel, layers: number): MixerAngleSpec[] {
  const gap = subspaceMixerGap(model, 0);
  assert.ok(gap !== null, '3×5 无掩码实例的混合组必须是两值谱（gap 非空）');
  const specs: MixerAngleSpec[] = [];
  for (let p = 0; p < layers; p++) specs.push({ index: layers + p, gap });
  return specs;
}

// ----------------------------------------------------------------------------
// 1. 解析定理钉（可分目标）：联合不动点 = 两段独立极小之和
// ----------------------------------------------------------------------------

describe('R19-Q gamma-beta-alternating · 解析定理钉（可分目标）', () => {
  it('单余弦(β;gap=2) + 三角多项式(γ;差{2,4})：终值 vs 解析联合极小 ≤1e-9；轨迹单调不增', () => {
    // energies [0,2,4] ⇒ 差 {2,4}；β 段 gap=2 的单余弦（ECCM 定理域内）
    const betaPart = (beta: number): number =>
      0.5 + 0.4 * Math.cos(2 * beta) + 0.3 * Math.sin(2 * beta);
    const gammaPart = (gamma: number): number =>
      0.7 +
      0.5 * Math.cos(2 * gamma) -
      0.3 * Math.sin(2 * gamma) +
      0.2 * Math.cos(4 * gamma) +
      0.15 * Math.sin(4 * gamma);
    const evaluate = (angles: number[]): number => betaPart(angles[1]!) + gammaPart(angles[0]!);
    // 解析独立极小（界内！）：β* 取端点与界内周期极小 (δ+π+2πk)/2 的最小者
    // （δ = atan2(0.3,0.4)；(δ+π)/2 ≈ 1.893 > π/2，k=−1 为负 ⇒ 界内极小在
    // 端点 β=π/2——ECCM 的 cosineMinimumInBounds 本就处理界，参照必须同口径）
    const delta = Math.atan2(0.3, 0.4);
    let betaStar = 0;
    let betaMin = betaPart(0);
    if (betaPart(BETA_BOUND) < betaMin) {
      betaStar = BETA_BOUND;
      betaMin = betaPart(BETA_BOUND);
    }
    for (let k = -1; k <= 0; k++) {
      const cand = (delta + Math.PI + 2 * Math.PI * k) / 2;
      if (cand >= 0 && cand <= BETA_BOUND && betaPart(cand) < betaMin) {
        betaStar = cand;
        betaMin = betaPart(cand);
      }
    }
    let denseArgmin = 0;
    let denseMin = Infinity;
    for (let j = 0; j <= 200000; j++) {
      const g = (j * GAMMA_BOUND) / 200000;
      const v = gammaPart(g);
      if (v < denseMin) {
        denseMin = v;
        denseArgmin = g;
      }
    }
    let lo = Math.max(0, denseArgmin - GAMMA_BOUND / 200000);
    let hi = Math.min(GAMMA_BOUND, denseArgmin + GAMMA_BOUND / 200000);
    for (let it = 0; it < 100 && hi - lo > 1e-15; it++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (gammaPart(m1) <= gammaPart(m2)) hi = m2;
      else lo = m1;
    }
    const jointMinimum = betaPart(betaStar) + gammaPart((lo + hi) / 2);
    const energies = new Float64Array([0, 2, 4]);
    const specs: MixerAngleSpec[] = [{ index: 1, gap: 2 }];
    const result = refineAnglesByGammaBetaAlternation(
      evaluate,
      [0.3, 0.2],
      [GAMMA_BOUND, BETA_BOUND],
      specs,
      energies,
      { gammaIndices: [0], sweeps: 12 },
    );
    assert.ok(!result.gammaFrozen, '公度小谱不应冻结 γ 块');
    assert.ok(
      Math.abs(result.value - jointMinimum) <= SEPARABLE_EPS,
      `终值 ${result.value} vs 解析联合极小 ${jointMinimum}`,
    );
    for (let t = 1; t < result.sweepValues.length; t++) {
      assert.ok(
        result.sweepValues[t]! <= result.sweepValues[t - 1]! + 1e-15,
        `轨迹必须单调不增：[${result.sweepValues.join(', ')}]`,
      );
    }
    assert.ok(result.sweeps < 12, `应零接受早停（实际 ${result.sweeps} 轮）`);
    assert.ok(result.gammaAccepts >= 1 && result.betaAccepts >= 1, '两块都应有接受步');
  });
});

// ----------------------------------------------------------------------------
// 2. 真实电路钉：构造性支配 + 轨迹单调 + γ 块冻结路径（谱过密）
// ----------------------------------------------------------------------------

describe('R19-Q gamma-beta-alternating · 真实电路钉', () => {
  it('子空间 3×5（dim=60，整数谱）：γβ 交替 ≤ 种子；轨迹单调不增；早停', () => {
    const model = buildSubspaceModel(integerProblem(3, 5, 11))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const layer = optimizeAnglesByCoordinateDescent(evaluate, layers, 2, mulberry32(42));
    const specs = layerBetaSpecs(model, layers);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    const result = refineAnglesByGammaBetaAlternation(
      evaluate,
      layer.angles,
      bounds,
      specs,
      energies,
      { gammaIndices: [0, 1], sweeps: 12 },
    );
    assert.ok(!result.gammaFrozen, '整数谱实例不应冻结 γ 块');
    assert.ok(
      result.value <= layer.expectation + 1e-12,
      `γβ ${result.value} 应 ≤ CD 种子 ${layer.expectation}`,
    );
    assert.equal(result.sweepValues[0], layer.expectation, '轨迹首项 = 种子值');
    for (let t = 1; t < result.sweepValues.length; t++) {
      assert.ok(result.sweepValues[t]! <= result.sweepValues[t - 1]! + 1e-15, '轨迹单调不增');
    }
    assert.ok(result.sweeps < 12, `应零接受早停（实际 ${result.sweeps}）`);
    assert.ok(result.evaluations >= 1, '评估记账非零');
  });

  it('谱过密（量化谱）⇒ γ 块冻结（γ 逐位不动）+ β 块照常 + spectrum 原因具名', () => {
    const model = buildSubspaceModel(quantizedProblem(3, 5, 55))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const angles = randomLayerAngles(rngOf(5), layers);
    const specs = layerBetaSpecs(model, layers);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    const result = refineAnglesByGammaBetaAlternation(evaluate, angles, bounds, specs, energies, {
      gammaIndices: [0, 1],
      sweeps: 6,
    });
    assert.ok(result.gammaFrozen, '量化谱（谱过密）应冻结 γ 块');
    assert.ok(!result.spectrum.ok);
    assert.equal(result.spectrum.reason, 'spectrum-too-dense');
    for (let p = 0; p < layers; p++) {
      assert.equal(result.angles[p], angles[p], `γ_${p} 必须逐位保持种子值（冻结）`);
    }
    assert.ok(result.gammaAccepts === 0, '冻结块的接受计数必须为 0');
    assert.ok(result.value <= evaluate(angles) + 1e-12, 'γ 冻结时 β 块照常工作，支配性不破坏');
  });
});

// ----------------------------------------------------------------------------
// 3. 联合不动点钉：早停后各坐标 512 点扫描无显著改进
// ----------------------------------------------------------------------------

describe('R19-Q gamma-beta-alternating · 联合不动点钉', () => {
  it('零接受早停后：每个参与坐标（β 与 γ）512 点扫描 ≥ 当前值 − 1e-9', () => {
    const model = buildSubspaceModel(integerProblem(3, 5, 23))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const layer = optimizeAnglesByCoordinateDescent(evaluate, layers, 2, mulberry32(7));
    const specs = layerBetaSpecs(model, layers);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    const result = refineAnglesByGammaBetaAlternation(
      evaluate,
      layer.angles,
      bounds,
      specs,
      energies,
      { gammaIndices: [0, 1], sweeps: 12 },
    );
    assert.ok(result.sweeps < 12, '不动点钉要求零接受早停');
    const indices = [...specs.map((s) => s.index), 0, 1];
    for (const idx of indices) {
      const bound = bounds[idx]!;
      let scanMin = Infinity;
      for (let j = 0; j < SCAN_POINTS; j++) {
        const v = evaluate(withAngle(result.angles, idx, (j * bound) / (SCAN_POINTS - 1)));
        if (v < scanMin) scanMin = v;
      }
      assert.ok(
        scanMin >= result.value - FIXED_POINT_EPS,
        `坐标 ${idx} 扫描极小 ${scanMin} 显著低于不动点值 ${result.value}（差 ${result.value - scanMin}）`,
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 4. 诚实分账账本：四臂对拍（种子 / ECCM-only / γ-only / γβ 联合）
// ----------------------------------------------------------------------------

describe('R19-Q gamma-beta-alternating · 诚实分账账本', () => {
  it('6 实例四臂双轴对拍：各臂 ≤ 种子（构造性断言）；臂间胜负如实入账', () => {
    const rows: string[] = [];
    for (let s = 0; s < 6; s++) {
      const model = buildSubspaceModel(integerProblem(3, 5, 300 + s * 11))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const evaluate = subspaceLayerEvaluate(model, energies, layers);
      const layer = optimizeAnglesByCoordinateDescent(evaluate, layers, 2, mulberry32(42));
      const specs = layerBetaSpecs(model, layers);
      const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
      const eccm = refineAnglesByExactCosine(evaluate, layer.angles, bounds, specs, {
        sweeps: 8,
      });
      const gammaOnly = refineGammaByTrigBuyout(evaluate, layer.angles, bounds, energies, {
        gammaIndices: [0, 1],
        sweeps: 4,
      });
      const joint = refineAnglesByGammaBetaAlternation(
        evaluate,
        layer.angles,
        bounds,
        specs,
        energies,
        { gammaIndices: [0, 1], sweeps: 8 },
      );
      // 构造性支配：每臂 ≤ 种子（确认评估兜底，不依赖拟合精度）
      assert.ok(eccm.value <= layer.expectation + 1e-12, `inst ${s}: ECCM-only 支配`);
      assert.ok(gammaOnly.value <= layer.expectation + 1e-12, `inst ${s}: γ-only 支配`);
      assert.ok(joint.value <= layer.expectation + 1e-12, `inst ${s}: γβ 支配`);
      assert.ok(!gammaOnly.skipped && !joint.gammaFrozen, `inst ${s}: 整数谱不 skip`);
      rows.push(
        `inst ${300 + s * 11}: seed=${layer.expectation.toFixed(12)} | ` +
          `eccm=${eccm.value.toFixed(12)}@${eccm.evaluations}ev | ` +
          `γonly=${gammaOnly.value.toFixed(12)}@${gammaOnly.evaluations}ev | ` +
          `γβ=${joint.value.toFixed(12)}@${joint.evaluations}ev ` +
          `(sw${joint.sweeps}, βacc${joint.betaAccepts}, γacc${joint.gammaAccepts}) ` +
          `[Δq(γβ−best-single)=${Math.min(joint.value - eccm.value, joint.value - gammaOnly.value).toExponential(3)}]`,
      );
    }
    console.log(
      `[r19q γβ 联合交替 · 子空间 3×5 整数谱四臂对拍，layers=2——如实分账]\n${rows.join('\n')}`,
    );
  });
});

// ----------------------------------------------------------------------------
// 5. 负对照与防线
// ----------------------------------------------------------------------------

describe('R19-Q gamma-beta-alternating · 负对照', () => {
  it('非三角目标（γ²，定理域外）被 γ 买断探针具名拦截', () => {
    const evaluate = (angles: number[]): number =>
      angles[0]! * angles[0]! + Math.cos(2 * angles[1]!);
    assert.throws(
      () =>
        refineAnglesByGammaBetaAlternation(
          evaluate,
          [0.3, 0.2],
          [GAMMA_BOUND, BETA_BOUND],
          [{ index: 1, gap: 2 }],
          new Float64Array([0, 2, 4]),
          { gammaIndices: [0], sweeps: 2 },
        ),
      (err: unknown) =>
        err instanceof QuantumEngineError && err.message.includes('residual mismatch'),
    );
  });

  it('空 specs + 空 gammaIndices 的静默 no-op 入口拒绝', () => {
    const evaluate = (angles: number[]): number => angles[0]! + angles[1]!;
    assert.throws(
      () =>
        refineAnglesByGammaBetaAlternation(
          evaluate,
          [0.3, 0.2],
          [GAMMA_BOUND, BETA_BOUND],
          [],
          new Float64Array([0, 2, 4]),
          { gammaIndices: [] },
        ),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('at least one'),
    );
  });

  it('非法输入逐条具名：bounds 形状 / NaN 种子角 / 非有限评估 / 非法 sweeps / 越界 gammaIndex', () => {
    const evaluate = (angles: number[]): number => angles[0]! + angles[1]!;
    const specs: MixerAngleSpec[] = [{ index: 1, gap: 2 }];
    const energies = new Float64Array([0, 2, 4]);
    assert.throws(
      () =>
        refineAnglesByGammaBetaAlternation(evaluate, [0.3, 0.2], [GAMMA_BOUND], specs, energies, {
          gammaIndices: [0],
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('bounds length'),
    );
    assert.throws(
      () =>
        refineAnglesByGammaBetaAlternation(
          evaluate,
          [0.3, Number.NaN],
          [GAMMA_BOUND, BETA_BOUND],
          specs,
          energies,
          {
            gammaIndices: [0],
          },
        ),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('finite'),
    );
    assert.throws(
      () =>
        refineAnglesByGammaBetaAlternation(
          () => Number.POSITIVE_INFINITY,
          [0.3, 0.2],
          [GAMMA_BOUND, BETA_BOUND],
          specs,
          energies,
          { gammaIndices: [0] },
        ),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('finite'),
    );
    assert.throws(
      () =>
        refineAnglesByGammaBetaAlternation(
          evaluate,
          [0.3, 0.2],
          [GAMMA_BOUND, BETA_BOUND],
          specs,
          energies,
          {
            gammaIndices: [0],
            sweeps: 0,
          },
        ),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('sweeps'),
    );
    assert.throws(
      () =>
        refineAnglesByGammaBetaAlternation(
          evaluate,
          [0.3, 0.2],
          [GAMMA_BOUND, BETA_BOUND],
          specs,
          energies,
          {
            gammaIndices: [5],
          },
        ),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('gammaIndices'),
    );
  });
});

// ----------------------------------------------------------------------------
// 6. 确定性
// ----------------------------------------------------------------------------

describe('R19-Q gamma-beta-alternating · 确定性', () => {
  it('同输入双跑 deepEqual（含轨迹与审计面）', () => {
    const model = buildSubspaceModel(integerProblem(3, 5, 77))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceLayerEvaluate(model, energies, layers);
    const angles = randomLayerAngles(rngOf(9), layers);
    const specs = layerBetaSpecs(model, layers);
    const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
    const run = (): ReturnType<typeof refineAnglesByGammaBetaAlternation> =>
      refineAnglesByGammaBetaAlternation(evaluate, angles, bounds, specs, energies, {
        gammaIndices: [0, 1],
        sweeps: 6,
      });
    assert.deepEqual(run(), run());
  });
});
