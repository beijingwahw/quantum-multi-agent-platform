/**
 * R14-J 创新：natural-gradient（Fubini–Study 度规预条件的量子自然梯度）的行为钉。
 *
 * 六类断言：
 * 1. 解析对拍——小实例单/双参数门**手推** g_ii/g_ij 的精确值（单比特
 *    e^{−iβX}e^{−iγZ}|+⟩ 的 g=sin²2γ、积代价的对角度规、ZZ 纠缠的秩 1
 *    块 g=½[[1,1],[1,1]]）与移位估计逐项一致到数值地板；含纯规范参数
 *    （X 本征态输入）度规恒 0 的锚——它专门检验投影项（⟨Ω|ψ⟩⟨ψ|Ω⟩）
 *    与相位锚（λ₋）的正确性；
 * 2. dampedNaturalDirection 的解析解（单位/耦合 2×2 手算）+ PD 定理
 *    （预条件方向与梯度正同向）+ 秩亏块靠阻尼可解；
 * 3. 度规正半定——平台实例（子空间/全空间 multi 布局）上对称性（精确）、
 *    对角非负、PSD 证书（微小阻尼下 Cholesky 成功）；
 * 4. 支配性——种子化自然梯度精修返回值 ≤ 种子（坐标下降最优角展开），
 *    多实例收集断言；记账恒等式（每轮恰 2K+1 态制备）；
 * 5. 收敛对照——坐标下降（种子化单重启）vs 移位梯度精修 vs 自然梯度
 *    精修：同种子同实例的评估数-质量分账，如实打印（赢要证据、输要
 *    如实），断言只钉定理性结论（三者支配种子）；
 * 6. 负对照——非法输入（非正谱隙/NaN 谱下端/越界下标/空 specs/非法
 *    阻尼/退化旋钮/bounds 形状/非有限评估与非有限振幅/非归一态/
 *    非对称与不定度规）被指名拒绝，不走静默兜底。
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
  optimizeAnglesByCoordinateDescentSeeded,
} from '../src/core/solver-common.js';
import { mulberry32 } from '../src/utils/rng.js';
import { QuantumEngineError } from '../src/utils/errors.js';
import { refineAnglesByExactGradient, twoEigenvalueShift } from '../src/core/parameter-shift.js';
import {
  DEFAULT_NATURAL_DAMPING,
  type NaturalMixerSpec,
  type StateAmplitudes,
  dampedNaturalDirection,
  fubiniStudyMetric,
  refineAnglesByNaturalGradient,
} from '../src/core/natural-gradient.js';
import { subspaceMixerGap } from '../src/core/parameter-shift.js';
import { BETA_BOUND, GAMMA_BOUND } from '../src/core/constants.js';

const ANALYTIC_EPS = 1e-12;
const PSD_EPS = 1e-12;

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

/**
 * 子空间 multi 布局态闭包（度规用）：内部复用同一寄存器，返回同一
 * re/im——natural-gradient 的快照契约保证 2K+1 个移位态互不串扰
 * （这是对快照机制的直接行为测试）。
 */
function subspaceMultiStateAt(
  model: SubspaceModel,
  energies: Float64Array,
  layers: number,
): (angles: number[]) => StateAmplitudes {
  const st = new SubspaceState(model.dimension);
  const G = model.mixers.length;
  return (angles: number[]): StateAmplitudes => {
    st.setUniform();
    for (let p = 0; p < layers; p++) {
      st.applyCostPhase(angles[p]!, energies);
      for (let g = 0; g < G; g++) {
        st.applyFiberMixer(model.mixers[g]!, angles[layers + p * G + g]!);
      }
    }
    return { re: st.re, im: st.im };
  };
}

/** 子空间 layer 布局评估闭包（坐标下降的种子通道） */
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

/** 全空间 multi 布局态闭包（度规用，同样复用内部寄存器） */
function fullspaceMultiStateAt(
  nqubits: number,
  energies: Float64Array,
  layers: number,
): (angles: number[]) => StateAmplitudes {
  const st = new QuantumStateVector(nqubits);
  const betas = new Array<number>(nqubits);
  return (angles: number[]): StateAmplitudes => {
    st.setUniformSuperposition();
    for (let p = 0; p < layers; p++) {
      st.applyCostPhase(angles[p]!, energies);
      for (let q = 0; q < nqubits; q++) betas[q] = angles[layers + p * nqubits + q]!;
      st.applyMixerAngles(betas);
    }
    return { re: st.re, im: st.im };
  };
}

/** 子空间 multi 布局的两值谱 specs（掩码截断的多值谱组被 subspaceMixerGap 诚实排除） */
function subspaceNaturalSpecs(model: SubspaceModel, layers: number): NaturalMixerSpec[] {
  const specs: NaturalMixerSpec[] = [];
  const G = model.mixers.length;
  for (let p = 0; p < layers; p++) {
    for (let g = 0; g < G; g++) {
      const gap = subspaceMixerGap(model, g);
      if (gap !== null) specs.push({ index: layers + p * G + g, gap });
    }
  }
  return specs;
}

function randomAngles(rng: () => number, layers: number, mixerCount: number): number[] {
  const angles: number[] = [];
  for (let p = 0; p < layers; p++) angles.push(rng() * Math.PI);
  for (let i = 0; i < layers * mixerCount; i++) angles.push(rng() * (Math.PI / 2));
  return angles;
}

// ----------------------------------------------------------------------------
// 解析锚：手推小电路的度规（与引擎无关的独立实现）
// ----------------------------------------------------------------------------

/** 对振幅施加 e^{−iβX_q}（与 QuantumStateVector.applyMixer 同逐对比特运算） */
function applyXRotation(re: Float64Array, im: Float64Array, qubit: number, beta: number): void {
  const c = Math.cos(beta);
  const s = Math.sin(beta);
  const mask = 1 << qubit;
  for (let k = 0; k < re.length; k++) {
    if (k & mask) continue;
    const p = k | mask;
    const re0 = re[k]!,
      im0 = im[k]!,
      re1 = re[p]!,
      im1 = im[p]!;
    re[k] = c * re0 + s * im1;
    im[k] = c * im0 - s * re1;
    re[p] = c * re1 + s * im0;
    im[p] = c * im1 - s * re0;
  }
}

/** 1 比特：|ψ(β)⟩ = e^{−iβX}·e^{−iγZ}|+⟩（解析锚 A：g_ββ = sin²(2γ)） */
function oneQubitStateAt(gamma: number): (angles: number[]) => StateAmplitudes {
  return (angles: number[]): StateAmplitudes => {
    const re = new Float64Array([Math.cos(gamma) / Math.SQRT2, Math.cos(gamma) / Math.SQRT2]);
    const im = new Float64Array([-Math.sin(gamma) / Math.SQRT2, Math.sin(gamma) / Math.SQRT2]);
    applyXRotation(re, im, 0, angles[0]!);
    return { re, im };
  };
}

/**
 * 2 比特积代价：|ψ⟩ = e^{−iβ₂X₂}e^{−iβ₁X₁}·e^{−iγ₁Z₁}e^{−iγ₂Z₂}|++⟩
 * （解析锚 B：g = diag(sin²2γ₁, sin²2γ₂)，g₁₂ = 0）
 */
function productCostStateAt(gamma1: number, gamma2: number): (angles: number[]) => StateAmplitudes {
  return (angles: number[]): StateAmplitudes => {
    const re = new Float64Array(4);
    const im = new Float64Array(4);
    for (let k = 0; k < 4; k++) {
      const z0 = 1 - 2 * (k & 1);
      const z1 = 1 - 2 * ((k >> 1) & 1);
      const phase = gamma1 * z0 + gamma2 * z1;
      re[k] = Math.cos(phase) / 2;
      im[k] = -Math.sin(phase) / 2;
    }
    applyXRotation(re, im, 0, angles[0]!);
    applyXRotation(re, im, 1, angles[1]!);
    return { re, im };
  };
}

/**
 * 2 比特 ZZ 纠缠：|ψ⟩ = e^{−iβ₂X₂}e^{−iβ₁X₁}·e^{−iγZ₁Z₂}|++⟩
 * （解析锚 C：g = sin²(2γ)·[[1,1],[1,1]]，β 无关——秩 1 块）
 */
function entangledZZStateAt(gamma: number): (angles: number[]) => StateAmplitudes {
  return (angles: number[]): StateAmplitudes => {
    const re = new Float64Array(4);
    const im = new Float64Array(4);
    for (let k = 0; k < 4; k++) {
      const zz = (k & 1) === ((k >> 1) & 1) ? 1 : -1;
      const phase = gamma * zz;
      re[k] = Math.cos(phase) / 2;
      im[k] = -Math.sin(phase) / 2;
    }
    applyXRotation(re, im, 0, angles[0]!);
    applyXRotation(re, im, 1, angles[1]!);
    return { re, im };
  };
}

describe('R14-J natural-gradient · 度规解析对拍（手推 g）', () => {
  it('单参数门：g_ββ = sin²(2γ)（γ=π/6 ⇒ 3/4），且 β 无关', () => {
    const specs: NaturalMixerSpec[] = [{ index: 0, gap: 2 }];
    for (const beta of [0.0, 0.4, 1.1]) {
      const { metric, statePreparations } = fubiniStudyMetric(
        oneQubitStateAt(Math.PI / 6),
        [beta],
        specs,
      );
      assert.equal(statePreparations, 3, 'K=1 ⇒ 2K+1 = 3 次态制备');
      assert.ok(
        Math.abs(metric[0]![0]! - 0.75) < ANALYTIC_EPS,
        `β=${beta}: g=${metric[0]![0]!} 应为 sin²(π/3)=3/4`,
      );
    }
  });

  it('纯规范参数（γ=0，X 本征态输入）：度规恒 0（投影项的锚）', () => {
    const { metric } = fubiniStudyMetric(oneQubitStateAt(0), [0.7], [{ index: 0, gap: 2 }]);
    assert.ok(
      Math.abs(metric[0]![0]!) < ANALYTIC_EPS,
      `纯规范方向的度规应为 0，got ${metric[0]![0]!}`,
    );
  });

  it('双参数积代价：对角度规 g = diag(sin²2γ₁, sin²2γ₂)，g₁₂ = 0', () => {
    const gamma1 = Math.PI / 8;
    const gamma2 = Math.PI / 12;
    const specs: NaturalMixerSpec[] = [
      { index: 0, gap: 2 },
      { index: 1, gap: 2 },
    ];
    const { metric, statePreparations } = fubiniStudyMetric(
      productCostStateAt(gamma1, gamma2),
      [0.3, 0.9],
      specs,
    );
    assert.equal(statePreparations, 5, 'K=2 ⇒ 2K+1 = 5 次态制备');
    assert.ok(
      Math.abs(metric[0]![0]! - 0.5) < ANALYTIC_EPS,
      `g₁₁=${metric[0]![0]!} 应为 sin²(π/4)=1/2`,
    );
    assert.ok(
      Math.abs(metric[1]![1]! - 0.25) < ANALYTIC_EPS,
      `g₂₂=${metric[1]![1]!} 应为 sin²(π/6)=1/4`,
    );
    assert.ok(
      Math.abs(metric[0]![1]!) < ANALYTIC_EPS && Math.abs(metric[1]![0]!) < ANALYTIC_EPS,
      `积代价的对角度规应无耦合，got g₁₂=${metric[0]![1]!}`,
    );
  });

  it('双参数 ZZ 纠缠：g = ½·[[1,1],[1,1]]（秩 1 块），β 无关', () => {
    const specs: NaturalMixerSpec[] = [
      { index: 0, gap: 2 },
      { index: 1, gap: 2 },
    ];
    const entryPairs: Array<[number, number]> = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    for (const betas of [
      [0.2, 0.5],
      [0.9, 0.1],
    ]) {
      const { metric } = fubiniStudyMetric(entangledZZStateAt(Math.PI / 8), betas, specs);
      for (const [i, j] of entryPairs) {
        assert.ok(
          Math.abs(metric[i]![j]! - 0.5) < ANALYTIC_EPS,
          `β=[${betas}]: g[${i}][${j}]=${metric[i]![j]!} 应为 sin²(π/4)·1 = 1/2`,
        );
      }
    }
  });
});

// ----------------------------------------------------------------------------
// λI 阻尼 Cholesky 方向
// ----------------------------------------------------------------------------

describe('R14-J natural-gradient · dampedNaturalDirection', () => {
  it('单位度规 + 阻尼 1：d = ∇f/2（手算解）', () => {
    const d = dampedNaturalDirection(
      [
        [1, 0],
        [0, 1],
      ],
      [3, 1],
      1,
    );
    assert.ok(
      Math.abs(d[0]! - 1.5) < ANALYTIC_EPS && Math.abs(d[1]! - 0.5) < ANALYTIC_EPS,
      `got ${d}`,
    );
  });

  it('耦合度规 [[2,1],[1,2]] + 阻尼 0.5：d = [6.5, −0.5]/5.25（手算解）', () => {
    const d = dampedNaturalDirection(
      [
        [2, 1],
        [1, 2],
      ],
      [3, 1],
      0.5,
    );
    assert.ok(Math.abs(d[0]! - 6.5 / 5.25) < ANALYTIC_EPS, `d₀=${d[0]!}`);
    assert.ok(Math.abs(d[1]! + 0.5 / 5.25) < ANALYTIC_EPS, `d₁=${d[1]!}`);
  });

  it('秩亏度规 ½[[1,1],[1,1]]：微小阻尼即可解（阻尼存在的意义）', () => {
    const d = dampedNaturalDirection(
      [
        [0.5, 0.5],
        [0.5, 0.5],
      ],
      [2, 2],
      1e-3,
    );
    for (const v of d) assert.ok(Number.isFinite(v), `方向须有限，got ${d}`);
    const dot = d[0]! * 2 + d[1]! * 2;
    assert.ok(dot > 0, `预条件方向与梯度须正同向，got ${dot}`);
  });

  it('PD 定理：平台实例上 ∇fᵀ·(g+λI)⁻¹·∇f > 0（下降方向）', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 11))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const stateAt = subspaceMultiStateAt(model, energies, layers);
    const specs = subspaceNaturalSpecs(model, layers);
    const angles = randomAngles(rngOf(13), layers, model.mixers.length);
    const gradient = specs.map((spec) => twoEigenvalueShift(evaluate, angles, spec));
    const { metric } = fubiniStudyMetric(stateAt, angles, specs);
    const d = dampedNaturalDirection(metric, gradient, DEFAULT_NATURAL_DAMPING);
    const dot = d.reduce((acc, v, i) => acc + v * gradient[i]!, 0);
    assert.ok(dot > 0, `g+λI 正定 ⇒ ∇fᵀd = ∇fᵀ(g+λI)⁻¹∇f > 0，got ${dot}`);
  });
});

// ----------------------------------------------------------------------------
// 度规正半定（平台实例）
// ----------------------------------------------------------------------------

describe('R14-J natural-gradient · 度规正半定与对称性（平台实例）', () => {
  it('子空间 multi 布局：对称精确、对角非负、PSD 证书（3 实例全收集断言）', () => {
    for (const seed of [11, 23, 77]) {
      const model = buildSubspaceModel(makeProblem(3, 5, seed))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const stateAt = subspaceMultiStateAt(model, energies, layers);
      const specs = subspaceNaturalSpecs(model, layers);
      const angles = randomAngles(rngOf(seed), layers, model.mixers.length);
      const { metric, statePreparations } = fubiniStudyMetric(stateAt, angles, specs);
      assert.equal(statePreparations, 2 * specs.length + 1);
      for (let i = 0; i < metric.length; i++) {
        assert.ok(
          metric[i]![i]! >= -PSD_EPS,
          `seed ${seed}: g[${i}][${i}]=${metric[i]![i]!} 对角元非负（PSD 必要条件）`,
        );
        for (let j = 0; j < metric.length; j++) {
          assert.equal(
            metric[i]![j],
            metric[j]![i],
            `seed ${seed}: 度规构造性精确对称 g[${i}][${j}]`,
          );
        }
      }
      // PSD 证书：g + 1e-9·I 可 Cholesky ⇒ g 的最小特征值 > −1e-9
      const e0 = new Array<number>(specs.length).fill(0);
      e0[0] = 1;
      assert.doesNotThrow(
        () => dampedNaturalDirection(metric, e0, 1e-9),
        `seed ${seed}: PSD 度规加微小阻尼必须可解`,
      );
    }
  });

  it('全空间 multi 布局（逐比特 gap=2 specs）：对角非负 + PSD 证书', () => {
    const nqubits = 9;
    const rng = rngOf(41);
    const energies = new Float64Array(1 << nqubits);
    for (let k = 0; k < energies.length; k++) energies[k] = rng() * 2;
    const layers = 1;
    const stateAt = fullspaceMultiStateAt(nqubits, energies, layers);
    const specs: NaturalMixerSpec[] = [];
    for (let q = 0; q < nqubits; q++) specs.push({ index: layers + q, gap: 2 });
    const angles = randomAngles(rngOf(5), layers, nqubits);
    const { metric, statePreparations } = fubiniStudyMetric(stateAt, angles, specs);
    assert.equal(statePreparations, 2 * nqubits + 1);
    for (let i = 0; i < nqubits; i++) {
      assert.ok(metric[i]![i]! >= -PSD_EPS, `g[${i}][${i}]=${metric[i]![i]!} 非负`);
    }
    const e0 = new Array<number>(nqubits).fill(0);
    e0[0] = 1;
    assert.doesNotThrow(() => dampedNaturalDirection(metric, e0, 1e-9));
  });
});

// ----------------------------------------------------------------------------
// 种子化自然梯度精修：支配性 + 记账 + γ 冻结 + 确定性
// ----------------------------------------------------------------------------

describe('R14-J natural-gradient · 种子化精修（支配性构造）', () => {
  it('子空间 multi 布局：精修值 ≤ 坐标下降种子（8 实例全收集断言）+ 记账恒等式', () => {
    const violations: string[] = [];
    for (let s = 0; s < 8; s++) {
      const model = buildSubspaceModel(makeProblem(4, 5, 100 + s * 7))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const evaluateLayer = subspaceLayerEvaluate(model, energies, layers);
      const evaluate = subspaceMultiEvaluate(model, energies, layers);
      const stateAt = subspaceMultiStateAt(model, energies, layers);
      const G = model.mixers.length;
      const layer = optimizeAnglesByCoordinateDescent(evaluateLayer, layers, 2, mulberry32(42));
      const seedAngles = expandLayerAnglesToMulti(layer.angles, layers, G);
      // 展开种子在 multi 电路下的评估值与 layer 最优逐位相同（支配性前提）
      assert.equal(evaluate(seedAngles), layer.expectation);

      const specs = subspaceNaturalSpecs(model, layers);
      const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
      const refined = refineAnglesByNaturalGradient(stateAt, evaluate, seedAngles, bounds, specs, {
        iterations: 8,
      });
      if (refined.value > layer.expectation + 1e-12) {
        violations.push(`seed ${s}: refined ${refined.value} > seed ${layer.expectation}`);
      }
      // 记账恒等式：每轮恰 2K+1 次态制备；评估 ≥ 1 + 每轮(2K 梯度 + 1 试探)
      const K = specs.length;
      assert.equal(
        refined.statePreparations,
        refined.iterations * (2 * K + 1),
        `seed ${s}: statePreparations ${refined.statePreparations} 应恰为 轮数×(2K+1)`,
      );
      assert.ok(
        refined.evaluations >= 1 + refined.iterations * (2 * K + 1),
        `seed ${s}: evaluations ${refined.evaluations} 过小`,
      );
    }
    assert.ok(violations.length === 0, `支配性违规:\n${violations.join('\n')}`);
  });

  it('全空间 multi 布局：精修值 ≤ 种子（逐比特 gap=2 specs）', () => {
    const nqubits = 9;
    const rng = rngOf(41);
    const energies = new Float64Array(1 << nqubits);
    for (let k = 0; k < energies.length; k++) energies[k] = rng() * 2;
    const layers = 1;
    const evaluate = fullspaceMultiEvaluate(nqubits, energies, layers);
    const stateAt = fullspaceMultiStateAt(nqubits, energies, layers);
    // 种子：均匀角（无坐标下降前置——直接检验对任意种子的支配性）
    const seedAngles = randomAngles(rngOf(9), layers, nqubits);
    const specs: NaturalMixerSpec[] = [];
    for (let q = 0; q < nqubits; q++) specs.push({ index: layers + q, gap: 2 });
    const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
    const refined = refineAnglesByNaturalGradient(stateAt, evaluate, seedAngles, bounds, specs, {
      iterations: 5,
    });
    assert.ok(
      refined.value <= evaluate(seedAngles) + 1e-12,
      `refined ${refined.value} 应 ≤ 种子 ${evaluate(seedAngles)}`,
    );
    assert.equal(refined.statePreparations, refined.iterations * (2 * nqubits + 1));
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
    const stateAt = subspaceMultiStateAt(model, energies, layers);
    const specs = subspaceNaturalSpecs(model, layers);
    const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
    const refined = refineAnglesByNaturalGradient(stateAt, evaluate, seedAngles, bounds, specs);
    for (let p = 0; p < layers; p++) {
      assert.equal(refined.angles[p], seedAngles[p], `γ_${p} 必须保持种子值`);
    }
  });

  it('确定性：同输入两次调用结果逐字段一致（无 RNG 消耗）', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 77))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const stateAt = subspaceMultiStateAt(model, energies, layers);
    const G = model.mixers.length;
    const seedAngles = randomAngles(rngOf(3), layers, G);
    const specs = subspaceNaturalSpecs(model, layers);
    const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
    const a = refineAnglesByNaturalGradient(stateAt, evaluate, seedAngles, bounds, specs, {
      iterations: 3,
    });
    const b = refineAnglesByNaturalGradient(stateAt, evaluate, seedAngles, bounds, specs, {
      iterations: 3,
    });
    assert.deepEqual(b, a);
  });
});

// ----------------------------------------------------------------------------
// 收敛对照：坐标下降 vs 移位梯度 vs 自然梯度（如实分账）
// ----------------------------------------------------------------------------

describe('R14-J natural-gradient · 收敛对照（同种子同实例）', () => {
  it('三方法均支配种子；评估数-质量分账如实打印', () => {
    const rows: string[] = [];
    for (let s = 0; s < 4; s++) {
      const model = buildSubspaceModel(makeProblem(4, 5, 200 + s * 7))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const G = model.mixers.length;
      const evaluateLayer = subspaceLayerEvaluate(model, energies, layers);
      const evaluate = subspaceMultiEvaluate(model, energies, layers);
      const stateAt = subspaceMultiStateAt(model, energies, layers);
      const layer = optimizeAnglesByCoordinateDescent(evaluateLayer, layers, 2, mulberry32(42));
      const seedAngles = expandLayerAnglesToMulti(layer.angles, layers, G);
      assert.equal(evaluate(seedAngles), layer.expectation);
      const specs = subspaceNaturalSpecs(model, layers);
      const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));

      const cd = optimizeAnglesByCoordinateDescentSeeded(
        evaluate,
        seedAngles.length,
        bounds,
        1,
        mulberry32(1),
        seedAngles,
      );
      const shift = refineAnglesByExactGradient(evaluate, seedAngles, bounds, specs, {
        iterations: 8,
      });
      const shift2x = refineAnglesByExactGradient(evaluate, seedAngles, bounds, specs, {
        iterations: 16,
      });
      const nat = refineAnglesByNaturalGradient(stateAt, evaluate, seedAngles, bounds, specs, {
        iterations: 8,
      });
      // 阻尼敏感性变体（缺省 1e-3 在病态度规下偏保守；0.1 更稳健——如实入账）
      const natDamped = refineAnglesByNaturalGradient(
        stateAt,
        evaluate,
        seedAngles,
        bounds,
        specs,
        {
          iterations: 8,
          damping: 0.1,
        },
      );

      // 定理性断言：三者均构造性支配种子（经验名次不作硬断言，如实打印）
      assert.ok(
        cd.expectation <= layer.expectation + 1e-12,
        `instance ${s}: 坐标下降 ${cd.expectation} 应 ≤ 种子 ${layer.expectation}`,
      );
      assert.ok(
        shift.value <= layer.expectation + 1e-12,
        `instance ${s}: 移位梯度 ${shift.value} 应 ≤ 种子`,
      );
      assert.ok(
        shift2x.value <= layer.expectation + 1e-12,
        `instance ${s}: 移位梯度 2x 预算应 ≤ 种子`,
      );
      assert.ok(
        nat.value <= layer.expectation + 1e-12,
        `instance ${s}: 自然梯度 ${nat.value} 应 ≤ 种子`,
      );
      assert.ok(
        natDamped.value <= layer.expectation + 1e-12,
        `instance ${s}: 阻尼 0.1 变体应 ≤ 种子`,
      );
      assert.equal(nat.statePreparations, nat.iterations * (2 * specs.length + 1));
      assert.equal(natDamped.statePreparations, natDamped.iterations * (2 * specs.length + 1));

      rows.push(
        `instance ${s}: seed=${layer.expectation.toFixed(6)} | ` +
          `cd=${cd.expectation.toFixed(6)}@${cd.evaluations}ev | ` +
          `shift8=${shift.value.toFixed(6)}@${shift.evaluations}ev | ` +
          `shift16=${shift2x.value.toFixed(6)}@${shift2x.evaluations}ev | ` +
          `nat8=${nat.value.toFixed(6)}@${nat.evaluations}ev+${nat.statePreparations}prep | ` +
          `nat8(λ=0.1)=${natDamped.value.toFixed(6)}@${natDamped.evaluations}ev+${natDamped.statePreparations}prep`,
      );
    }
    console.log(`[r14j 收敛对照 · 子空间 4×5, layers=2, K=${2 * 4}]\n${rows.join('\n')}`);
  });
});

// ----------------------------------------------------------------------------
// 负对照（走私审判风格：非法输入被点名拒绝）
// ----------------------------------------------------------------------------

describe('R14-J natural-gradient · 负对照', () => {
  /** 2 维归一态：形状/范数合法，足够走到各校验分支 */
  const dummyStateAt = (angles: number[]): StateAmplitudes => {
    const re = new Float64Array([Math.cos(angles[0]!), Math.sin(angles[0]!)]);
    return { re, im: new Float64Array(2) };
  };
  const dummyEvaluate = (angles: number[]): number => angles[0]! * angles[0]!;
  const dummySpecs: NaturalMixerSpec[] = [{ index: 0, gap: 2 }];
  const throwsWith = (fn: () => unknown, fragment: string): void => {
    assert.throws(
      fn,
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes(fragment),
      `应抛含 "${fragment}" 的 QuantumEngineError`,
    );
  };

  it('非正/NaN 谱隙被拒绝且指名 gap', () => {
    throwsWith(() => fubiniStudyMetric(dummyStateAt, [0.3], [{ index: 0, gap: 0 }]), 'gap');
    throwsWith(
      () => fubiniStudyMetric(dummyStateAt, [0.3], [{ index: 0, gap: Number.NaN }]),
      'gap',
    );
  });

  it('NaN 谱下端（相位锚）被拒绝且指名 lowerEigenvalue', () => {
    throwsWith(
      () =>
        fubiniStudyMetric(dummyStateAt, [0.3], [{ index: 0, gap: 2, lowerEigenvalue: Number.NaN }]),
      'lowerEigenvalue',
    );
  });

  it('角度下标越界被拒绝且指名 index', () => {
    throwsWith(() => fubiniStudyMetric(dummyStateAt, [0.3], [{ index: 5, gap: 2 }]), 'index');
  });

  it('空 specs（静默 no-op）被拒绝：fubiniStudyMetric 与 refine 双入口', () => {
    throwsWith(() => fubiniStudyMetric(dummyStateAt, [0.3], []), 'no-op');
    throwsWith(
      () => refineAnglesByNaturalGradient(dummyStateAt, dummyEvaluate, [0.4], [Math.PI / 2], []),
      'no-op',
    );
  });

  it('非法阻尼被拒绝且指名 damping：0 / 负 / NaN', () => {
    for (const damping of [0, -1e-3, Number.NaN]) {
      throwsWith(
        () =>
          refineAnglesByNaturalGradient(
            dummyStateAt,
            dummyEvaluate,
            [0.4],
            [Math.PI / 2],
            dummySpecs,
            { damping },
          ),
        'damping',
      );
    }
    throwsWith(() => dampedNaturalDirection([[1]], [1], 0), 'damping');
  });

  it('退化旋钮被拒绝：iterations=0 / stepInitial=NaN / shrink=1', () => {
    throwsWith(
      () =>
        refineAnglesByNaturalGradient(
          dummyStateAt,
          dummyEvaluate,
          [0.4],
          [Math.PI / 2],
          dummySpecs,
          {
            iterations: 0,
          },
        ),
      'iterations',
    );
    throwsWith(
      () =>
        refineAnglesByNaturalGradient(
          dummyStateAt,
          dummyEvaluate,
          [0.4],
          [Math.PI / 2],
          dummySpecs,
          {
            stepInitial: Number.NaN,
          },
        ),
      'stepInitial',
    );
    throwsWith(
      () =>
        refineAnglesByNaturalGradient(
          dummyStateAt,
          dummyEvaluate,
          [0.4],
          [Math.PI / 2],
          dummySpecs,
          {
            shrink: 1,
          },
        ),
      'shrink',
    );
  });

  it('bounds 长度不匹配被拒绝且指名 bounds', () => {
    throwsWith(
      () =>
        refineAnglesByNaturalGradient(
          dummyStateAt,
          dummyEvaluate,
          [0.4, 0.4],
          [Math.PI / 2],
          dummySpecs,
        ),
      'bounds',
    );
  });

  it('种子角非有限被拒绝且指名 seedAngles', () => {
    throwsWith(
      () =>
        refineAnglesByNaturalGradient(
          dummyStateAt,
          dummyEvaluate,
          [Number.NaN],
          [Math.PI / 2],
          dummySpecs,
        ),
      'seedAngles',
    );
  });

  it('非有限评估值被具名拒绝（NaN 不静默流穿）', () => {
    const bad = (angles: number[]): number => (angles[0]! > 0.5 ? Number.NaN : 1);
    throwsWith(
      () =>
        refineAnglesByNaturalGradient(dummyStateAt, bad, [0.9], [Math.PI / 2], dummySpecs, {
          iterations: 1,
        }),
      'evaluate',
    );
  });

  it('stateAt 非有限振幅被具名拒绝', () => {
    const bad = (angles: number[]): StateAmplitudes => {
      const re = new Float64Array([Math.cos(angles[0]!), Math.sin(angles[0]!)]);
      re[1] = Number.NaN;
      return { re, im: new Float64Array(2) };
    };
    throwsWith(() => fubiniStudyMetric(bad, [0.3], dummySpecs), 'finite');
  });

  it('stateAt 非归一态被具名拒绝（度规前提是单位范数）', () => {
    const bad = (angles: number[]): StateAmplitudes => {
      const re = new Float64Array([0.5 * Math.cos(angles[0]!), 0]);
      return { re, im: new Float64Array(2) };
    };
    throwsWith(() => fubiniStudyMetric(bad, [0.3], dummySpecs), 'normalized');
  });

  it('dampedNaturalDirection：非对称矩阵被拒绝且指名 symmetric', () => {
    throwsWith(
      () =>
        dampedNaturalDirection(
          [
            [1, 0],
            [0.5, 1],
          ],
          [1, 1],
          0.1,
        ),
      'symmetric',
    );
  });

  it('dampedNaturalDirection：不定矩阵（阻尼不足）被拒绝且指名 positive definite', () => {
    throwsWith(
      () =>
        dampedNaturalDirection(
          [
            [1, 2],
            [2, 1],
          ],
          [1, 1],
          0.1,
        ),
      'positive definite',
    );
  });

  it('dampedNaturalDirection：梯度长度/非有限/空矩阵被指名拒绝', () => {
    throwsWith(
      () =>
        dampedNaturalDirection(
          [
            [1, 0],
            [0, 1],
          ],
          [1],
          0.1,
        ),
      'gradient length',
    );
    throwsWith(
      () =>
        dampedNaturalDirection(
          [
            [1, 0],
            [0, 1],
          ],
          [1, Number.NaN],
          0.1,
        ),
      'gradient',
    );
    throwsWith(() => dampedNaturalDirection([], [], 0.1), 'metric');
    throwsWith(() => dampedNaturalDirection([[1, 2]], [1], 0.1), 'square');
  });

  it('缺省阻尼常量被钉死（超参缺省值的可发现性）', () => {
    assert.equal(DEFAULT_NATURAL_DAMPING, 1e-3);
  });
});
