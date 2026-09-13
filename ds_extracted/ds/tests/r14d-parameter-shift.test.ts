/**
 * R14-D 创新 1：parameter-shift（QAOA 角度精确参数移位梯度）的行为钉。
 *
 * 三类断言：
 * 1. 精确性对拍——两值谱移位梯度 vs 中心差分（无截断误差主张的机器验证：
 *    一致到差分自身的噪声量级 ~1e-7，若移位公式错误会偏离 O(1)）；
 * 2. 支配性——种子化梯度精修的返回值 ≤ 种子（坐标下降最优角的展开），
 *    与 ma-QAOA 支配定理同一构造形态，多种子收集违规一次断言（05#31）；
 * 3. 负对照——非法输入（非正谱隙 / 空 specs / 退化旋钮 / 非有限评估 /
 *    bounds 形状）被指名拒绝，不走静默兜底。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import {
  QuantumStateVector,
  couplingKey,
  defaultPenalties,
} from '../src/core/quantum-optimizer.js';
import {
  buildSubspaceModel,
  SubspaceState,
  type SubspaceModel,
} from '../src/core/subspace-optimizer.js';
import {
  expectationValueInto,
  expandLayerAnglesToMulti,
  minMaxOf,
  normalizedEnergies as normalizedEnergiesOf,
  optimizeAnglesByCoordinateDescent,
} from '../src/core/solver-common.js';
import { mulberry32 } from '../src/utils/rng.js';
import { QuantumEngineError } from '../src/utils/errors.js';
import {
  type MixerAngleSpec,
  fullspaceLayerMixerGradient,
  perQubitShiftedBetas,
  refineAnglesByExactGradient,
  subspaceMixerGap,
  twoEigenvalueShift,
} from '../src/core/parameter-shift.js';
import { BETA_BOUND, GAMMA_BOUND } from '../src/core/constants.js';

const EXACTNESS_EPS = 1e-7;

function rngOf(seed: number): () => number {
  return mulberry32(seed);
}

function makeProblem(
  m: number,
  n: number,
  seed: number,
  opts: { mask?: boolean } = {},
): AssignmentProblem {
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
  if (opts.mask) {
    p.ineligible[0]![0] = true;
    p.ineligible[m - 1]![n - 1] = true;
  }
  const nq = m * n;
  for (let t1 = 0; t1 + 1 < m; t1 += 2) {
    p.couplings.set(couplingKey(t1 * n, (t1 + 1) * n + 1, nq), 0.3);
  }
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

function subspaceEnergies(model: SubspaceModel): Float64Array {
  const { min, max } = minMaxOf(model.energies);
  return normalizedEnergiesOf(model.energies, min, max, 1);
}

/** 子空间 multi 布局评估闭包：angles = [γ_1..γ_p, β_{p,g}（层主序 × 组）] */
function subspaceMultiEvaluate(
  model: SubspaceModel,
  energies: Float64Array,
  layers: number,
): (angles: number[]) => number {
  const st = new SubspaceState(model.dimension);
  const G = model.mixers.length;
  return (angles: number[]): number => {
    st.setUniform();
    for (let p = 0; p < layers; p++) {
      st.applyCostPhase(angles[p]!, energies);
      for (let g = 0; g < G; g++) {
        st.applyFiberMixer(model.mixers[g]!, angles[layers + p * G + g]!);
      }
    }
    return expectationValueInto(st, energies);
  };
}

/** 子空间 layer 布局评估闭包：angles = [γ_1..γ_p, β_1..β_p]（坐标下降的种子通道） */
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

/** 全空间 multi 布局评估闭包：angles = [γ_1..γ_p, β_{p,q}（层主序 × 比特）] */
function fullspaceMultiEvaluate(
  nqubits: number,
  energies: Float64Array,
  layers: number,
): (angles: number[]) => number {
  const st = new QuantumStateVector(nqubits);
  const betas = new Array<number>(nqubits);
  return (angles: number[]): number => {
    st.setUniformSuperposition();
    for (let p = 0; p < layers; p++) {
      st.applyCostPhase(angles[p]!, energies);
      for (let q = 0; q < nqubits; q++) betas[q] = angles[layers + p * nqubits + q]!;
      st.applyMixerAngles(betas);
    }
    return expectationValueInto(st, energies);
  };
}

/** 全空间 layer 布局评估闭包：angles = [γ_1..γ_p, β_1..β_p]（坐标下降的种子通道） */
function fullspaceLayerEvaluate(
  nqubits: number,
  energies: Float64Array,
  layers: number,
): (angles: number[]) => number {
  const st = new QuantumStateVector(nqubits);
  return (angles: number[]): number => {
    st.setUniformSuperposition();
    for (let p = 0; p < layers; p++) {
      st.applyCostPhase(angles[p]!, energies);
      st.applyMixer(angles[layers + p]!);
    }
    return expectationValueInto(st, energies);
  };
}

function centralDiff(
  evaluate: (angles: number[]) => number,
  angles: number[],
  index: number,
  h = 1e-6,
): number {
  const plus = angles.slice();
  plus[index] = plus[index]! + h;
  const minus = angles.slice();
  minus[index] = minus[index]! - h;
  return (evaluate(plus) - evaluate(minus)) / (2 * h);
}

function randomAngles(rng: () => number, layers: number, mixerCount: number): number[] {
  const angles: number[] = [];
  for (let p = 0; p < layers; p++) angles.push(rng() * Math.PI);
  for (let i = 0; i < layers * mixerCount; i++) angles.push(rng() * (Math.PI / 2));
  return angles;
}

// ----------------------------------------------------------------------------
// 精确性对拍
// ----------------------------------------------------------------------------

describe('R14-D parameter-shift · 两值谱移位梯度精确性', () => {
  it('全空间逐比特混合角（ma 布局，gap=2）：移位梯度 == 中心差分', () => {
    const problem = makeProblem(3, 4, 7);
    const nqubits = problem.taskIds.length * problem.agentIds.length;
    const rng = rngOf(99);
    const energies = new Float64Array(1 << nqubits);
    for (let k = 0; k < energies.length; k++) energies[k] = rng();
    const layers = 2;
    const evaluate = fullspaceMultiEvaluate(nqubits, energies, layers);
    const angles = randomAngles(rngOf(5), layers, nqubits);
    for (let q = 0; q < nqubits; q++) {
      const index = layers + 0 * nqubits + q; // 第 0 层的逐比特混合角
      const spec: MixerAngleSpec = { index, gap: 2 };
      const shifted = twoEigenvalueShift(evaluate, angles, spec);
      const central = centralDiff(evaluate, angles, index);
      assert.ok(
        Math.abs(shifted - central) < EXACTNESS_EPS,
        `qubit ${q}: shift ${shifted} vs central ${central}`,
      );
    }
  });

  it('全空间 layer 模式（共享 β，逐比特求和）：梯度 == 中心差分', () => {
    const nqubits = 5;
    const rng = rngOf(31);
    const energies = new Float64Array(1 << nqubits);
    for (let k = 0; k < energies.length; k++) energies[k] = rng();
    const beta = 0.6;
    const gamma = 0.8;
    const betas = new Array<number>(nqubits).fill(beta);
    const fOfB = (b: number): number => {
      const st = new QuantumStateVector(nqubits);
      st.setUniformSuperposition();
      st.applyCostPhase(gamma, energies);
      st.applyMixerAngles(new Array<number>(nqubits).fill(b));
      return expectationValueInto(st, energies);
    };
    const evaluateWithQubitShift = (qubit: number, delta: number): number => {
      const st = new QuantumStateVector(nqubits);
      st.setUniformSuperposition();
      st.applyCostPhase(gamma, energies);
      st.applyMixerAngles(perQubitShiftedBetas(betas, qubit, delta));
      return expectationValueInto(st, energies);
    };
    const h = 1e-6;
    const central = (fOfB(beta + h) - fOfB(beta - h)) / (2 * h);
    const summed = fullspaceLayerMixerGradient(evaluateWithQubitShift, nqubits);
    assert.ok(
      Math.abs(summed - central) < EXACTNESS_EPS,
      `layer mixer gradient ${summed} vs central ${central}`,
    );
  });

  it('子空间移动混合角（无掩码，均匀纤维 gap=n−m+1）：移位梯度 == 中心差分', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 11))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const angles = randomAngles(rngOf(13), layers, model.mixers.length);
    const G = model.mixers.length;
    for (let g = 0; g < G; g++) {
      const gap = subspaceMixerGap(model, g);
      assert.equal(gap, 3, `无掩码 3×5 移动混合器组 ${g} 的纤维尺寸应为 n−m+1=3`);
      assert.ok(gap !== null, '谱隙非空由上一断言钉住（类型收窄）');
      const index = layers + 0 * G + g;
      const shifted = twoEigenvalueShift(evaluate, angles, { index, gap });
      const central = centralDiff(evaluate, angles, index);
      assert.ok(
        Math.abs(shifted - central) < EXACTNESS_EPS,
        `group ${g}: shift ${shifted} vs central ${central}`,
      );
    }
  });

  it('子空间换位混合角（n==m，纤维 K_2，gap=2）：移位梯度 == 中心差分', () => {
    const model = buildSubspaceModel(makeProblem(4, 4, 17))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const angles = randomAngles(rngOf(19), layers, model.mixers.length);
    const G = model.mixers.length;
    for (let g = 0; g < G; g++) {
      assert.equal(subspaceMixerGap(model, g), 2, `换位混合器组 ${g} 的谱隙应为 2`);
      const index = layers + 0 * G + g;
      const shifted = twoEigenvalueShift(evaluate, angles, { index, gap: 2 });
      const central = centralDiff(evaluate, angles, index);
      assert.ok(
        Math.abs(shifted - central) < EXACTNESS_EPS,
        `swap group ${g}: shift ${shifted} vs central ${central}`,
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 谱隙判定的诚实性
// ----------------------------------------------------------------------------

describe('R14-D parameter-shift · subspaceMixerGap 谱隙判定', () => {
  it('掩码模型产生异尺寸纤维：受影响组返回 null（不用近似冒充精确）', () => {
    const masked = buildSubspaceModel(makeProblem(3, 5, 11, { mask: true }))!;
    let nullCount = 0;
    let exactCount = 0;
    for (let g = 0; g < masked.mixers.length; g++) {
      if (subspaceMixerGap(masked, g) === null) nullCount++;
      else exactCount++;
    }
    assert.ok(nullCount > 0, '掩码截断应使至少一个混合器组失去两值谱（诚实边界）');
    assert.ok(exactCount > 0, '未受掩码影响的组仍应给出精确谱隙（判定既不放过也不误杀）');
  });

  it('groupIndex 越界被具名拒绝', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 11))!;
    assert.throws(
      () => subspaceMixerGap(model, model.mixers.length),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('groupIndex'),
    );
  });
});

// ----------------------------------------------------------------------------
// 种子化精修：支配性 + 记账 + 确定性
// ----------------------------------------------------------------------------

describe('R14-D parameter-shift · 种子化梯度精修（支配性构造）', () => {
  it('子空间 multi 布局：精修值 ≤ 坐标下降种子（8 实例全收集断言）', () => {
    const violations: string[] = [];
    for (let s = 0; s < 8; s++) {
      const model = buildSubspaceModel(makeProblem(4, 5, 100 + s * 7))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const evaluateLayer = subspaceLayerEvaluate(model, energies, layers);
      const evaluate = subspaceMultiEvaluate(model, energies, layers);
      const G = model.mixers.length;
      const layer = optimizeAnglesByCoordinateDescent(evaluateLayer, layers, 2, mulberry32(42));
      const seedAngles = expandLayerAnglesToMulti(layer.angles, layers, G);
      // 展开种子在 multi 电路下的评估值与 layer 最优逐位相同（支配性前提）
      assert.equal(evaluate(seedAngles), layer.expectation);

      const specs: MixerAngleSpec[] = [];
      for (let p = 0; p < layers; p++) {
        for (let g = 0; g < G; g++) {
          const gap = subspaceMixerGap(model, g);
          if (gap !== null) specs.push({ index: layers + p * G + g, gap });
        }
      }
      const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
      const refined = refineAnglesByExactGradient(evaluate, seedAngles, bounds, specs, {
        iterations: 8,
      });
      if (refined.value > layer.expectation + 1e-12) {
        violations.push(`seed ${s}: refined ${refined.value} > seed ${layer.expectation}`);
      }
      // 记账：种子 1 次 + 每轮每 spec 2 次移位 + 每轮 ≥1 次试探
      assert.ok(
        refined.evaluations >= 1 + refined.iterations * (2 * specs.length + 1),
        `seed ${s}: evaluations ${refined.evaluations} 过小`,
      );
    }
    assert.ok(violations.length === 0, `支配性违规:\n${violations.join('\n')}`);
  });

  it('代价角 γ 在精修中保持种子值不动', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 23))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluateLayer = subspaceLayerEvaluate(model, energies, layers);
    const G = model.mixers.length;
    const layer = optimizeAnglesByCoordinateDescent(evaluateLayer, layers, 1, mulberry32(7));
    const seedAngles = expandLayerAnglesToMulti(layer.angles, layers, G);
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const specs: MixerAngleSpec[] = [];
    for (let p = 0; p < layers; p++) {
      for (let g = 0; g < G; g++) {
        const gap = subspaceMixerGap(model, g);
        if (gap !== null) specs.push({ index: layers + p * G + g, gap });
      }
    }
    const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
    const refined = refineAnglesByExactGradient(evaluate, seedAngles, bounds, specs);
    for (let p = 0; p < layers; p++) {
      assert.equal(refined.angles[p], seedAngles[p], `γ_${p} 必须保持种子值`);
    }
  });

  it('全空间 multi 布局：精修值 ≤ 种子（逐比特 gap=2 specs）', () => {
    const problem = makeProblem(3, 3, 41);
    const nqubits = problem.taskIds.length * problem.agentIds.length;
    const rng = rngOf(41);
    const energies = new Float64Array(1 << nqubits);
    for (let k = 0; k < energies.length; k++) energies[k] = rng() * 2;
    const layers = 1;
    const evaluateLayer = fullspaceLayerEvaluate(nqubits, energies, layers);
    const evaluate = fullspaceMultiEvaluate(nqubits, energies, layers);
    const layer = optimizeAnglesByCoordinateDescent(evaluateLayer, layers, 2, mulberry32(42));
    const seedAngles = expandLayerAnglesToMulti(layer.angles, layers, nqubits);
    const specs: MixerAngleSpec[] = [];
    for (let q = 0; q < nqubits; q++) specs.push({ index: layers + q, gap: 2 });
    const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
    const refined = refineAnglesByExactGradient(evaluate, seedAngles, bounds, specs, {
      iterations: 5,
    });
    assert.ok(
      refined.value <= layer.expectation + 1e-12,
      `refined ${refined.value} 应 ≤ 种子 ${layer.expectation}`,
    );
  });

  it('确定性：同输入两次调用结果逐字段一致（无 RNG 消耗）', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 77))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const G = model.mixers.length;
    const seedAngles = randomAngles(rngOf(3), layers, G);
    const specs: MixerAngleSpec[] = [];
    for (let p = 0; p < layers; p++) {
      for (let g = 0; g < G; g++) {
        const gap = subspaceMixerGap(model, g);
        if (gap !== null) specs.push({ index: layers + p * G + g, gap });
      }
    }
    const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
    const a = refineAnglesByExactGradient(evaluate, seedAngles, bounds, specs, { iterations: 3 });
    const b = refineAnglesByExactGradient(evaluate, seedAngles, bounds, specs, { iterations: 3 });
    assert.deepEqual(b, a);
  });
});

// ----------------------------------------------------------------------------
// 负对照（走私审判风格：非法输入被点名拒绝）
// ----------------------------------------------------------------------------

describe('R14-D parameter-shift · 负对照', () => {
  const dummyEvaluate = (angles: number[]): number => angles.reduce((s, x) => s + x * x, 0);

  it('非正/NaN 谱隙被拒绝且指名 gap', () => {
    assert.throws(
      () => twoEigenvalueShift(dummyEvaluate, [1, 1], { index: 1, gap: 0 }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('gap'),
    );
    assert.throws(
      () => twoEigenvalueShift(dummyEvaluate, [1, 1], { index: 1, gap: Number.NaN }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('gap'),
    );
  });

  it('角度下标越界被拒绝且指名 index', () => {
    assert.throws(
      () => twoEigenvalueShift(dummyEvaluate, [1, 1], { index: 5, gap: 2 }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('index'),
    );
  });

  it('空 specs（静默 no-op）被拒绝', () => {
    assert.throws(
      () => refineAnglesByExactGradient(dummyEvaluate, [1, 1], [Math.PI, Math.PI], []),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('no-op'),
    );
  });

  it('退化旋钮被拒绝：iterations=0 / stepInitial=NaN / shrink=1', () => {
    const specs: MixerAngleSpec[] = [{ index: 1, gap: 2 }];
    assert.throws(
      () =>
        refineAnglesByExactGradient(dummyEvaluate, [1, 1], [Math.PI, Math.PI], specs, {
          iterations: 0,
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('iterations'),
    );
    assert.throws(
      () =>
        refineAnglesByExactGradient(dummyEvaluate, [1, 1], [Math.PI, Math.PI], specs, {
          stepInitial: Number.NaN,
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('stepInitial'),
    );
    assert.throws(
      () =>
        refineAnglesByExactGradient(dummyEvaluate, [1, 1], [Math.PI, Math.PI], specs, {
          shrink: 1,
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('shrink'),
    );
  });

  it('非有限评估值被具名拒绝（NaN 不静默流穿梯度）', () => {
    const bad = (angles: number[]): number => (angles[0]! > 0.5 ? Number.NaN : 1);
    assert.throws(
      () =>
        refineAnglesByExactGradient(bad, [1, 1], [Math.PI, Math.PI], [{ index: 1, gap: 2 }], {
          iterations: 1,
        }),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('evaluate'),
    );
  });

  it('bounds 长度不匹配被拒绝且指名 bounds', () => {
    assert.throws(
      () => refineAnglesByExactGradient(dummyEvaluate, [1, 1], [Math.PI], [{ index: 1, gap: 2 }]),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('bounds'),
    );
  });

  it('perQubitShiftedBetas：越界 qubit 被拒绝', () => {
    assert.throws(
      () => perQubitShiftedBetas([0.1, 0.2], 7, 0.1),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('qubit'),
    );
  });

  it('fullspaceLayerMixerGradient：nqubits 非正被拒绝', () => {
    assert.throws(
      () => fullspaceLayerMixerGradient(() => 0, 0),
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes('nqubits'),
    );
  });
});
