/**
 * R16 创新：exact-cosine-coordinate（ECCM / Rotosolve 面）的行为钉。
 *
 * 六类断言：
 * 1. 定理钉——真实子空间实例（均匀 k 纤维，Δ=k）与全空间 ma 布局（逐比特
 *    X，Δ=2）上，逐 mixer 坐标 512 点稠密扫描 vs 三点拟合余弦：最大偏差
 *    ≤1e-12（单余弦结构的机器证明）；掩码实例的多值谱组被 subspaceMixerGap
 *    诚实排除出 specs（排除面钉）；
 * 2. 精确性——单坐标 ECCM 终点与「稠密扫描 + 三分搜索」的独立数值 argmin
 *    一致（≤1e-9）且单调 ≤ 起点；多坐标收敛点满足 Gauss-Seidel 不动点
 *    （任一 β 坐标 512 点扫描无改进）；解析单余弦上界内闭式极小（1e-9）
 *    与界外端点回退逐点钉死；
 * 3. 双轴对拍（本使命的验收）——r14j 同实例族同种子（4×5×layers2×K8，
 *    种子 = layer-CD(mulberry32(42),r2) 最优角展开，CD 臂 = 种子化 CD
 *    r1/mulberry32(1)，ECCM 臂镜像 r1/seed=1）：支配族 8 实例双轴
 *    （终值 ≤ CD+1e-12 且评估数 <）**逐实例全占优**；对照族 4 实例中
 *    3 实例全占优，inst 207 如实入账帕累托点（扫描轮阶梯 s12 成本占优
 *    /质量差 1.55e-6，s24 质量占优/成本 483>381，ECCM→CD warm-start
 *    混合质量占优/成本 484>381——帕累托前沿机器钉死，不松断言说谎）；
 * 4. 支配性——ECCM 返回值 ≤ 种子（构造性，全实例收集断言）；
 * 5. 确定性——同输入双跑 deepEqual（restarts=2 触及 RNG 流）；γ 冻结
 *    （精修后 γ 与种子逐位相同）；
 * 6. 负对照——空 specs/NaN 谱隙/越界下标/非法 sweeps/非法 restarts/
 *    NaN 种子角/NaN rng 种子/bounds 形状/非有限评估值被指名拒绝；平坦
 *    坐标（恒值目标）零移动零确认评估；纯函数原语的域校验。
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
import { subspaceMixerGap, type MixerAngleSpec } from '../src/core/parameter-shift.js';
import {
  cosineMinimumInBounds,
  cosineSampleBetas,
  cosineValueAt,
  fitCosine,
  refineAnglesByExactCosine,
} from '../src/core/exact-cosine-coordinate.js';
import { BETA_BOUND, GAMMA_BOUND } from '../src/core/constants.js';

const NAIL_EPS = 1e-12;
const ARGMIN_EPS = 1e-9;
const SCAN_POINTS = 512;

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

/** 子空间 multi 布局评估闭包：angles = [γ_1..γ_p, β_{p,g}（层主序 × 组）]（r14j 同构造） */
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

/** 子空间 layer 布局评估闭包（种子的 CD 通道，r14j 同构造） */
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

/** 全空间 multi 布局评估闭包：angles = [γ_1..γ_p, β_{p,q}（层主序 × 比特）]（r14j 同构造） */
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

/** 子空间 multi 布局的两值谱 specs（subspaceMixerGap 的 null 排除面诚实生效） */
function eccmSpecs(model: SubspaceModel, layers: number): MixerAngleSpec[] {
  const specs: MixerAngleSpec[] = [];
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

function withAngle(angles: readonly number[], index: number, value: number): number[] {
  const out = angles.slice();
  out[index] = value;
  return out;
}

/** 单峰区间上的三分搜索（独立数值 argmin：不假设余弦结构） */
function ternaryArgmin(
  f: (x: number) => number,
  lo: number,
  hi: number,
  iterations: number,
): { x: number; fx: number } {
  let a = lo;
  let b = hi;
  for (let i = 0; i < iterations; i++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    if (f(m1) <= f(m2)) b = m2;
    else a = m1;
  }
  const x = (a + b) / 2;
  return { x, fx: f(x) };
}

/**
 * 定理钉的主体：给定评估闭包与角度向量，对每个 spec 用生产采样放置拟合
 * 单余弦，再在一个完整周期 [0, 2π/gap) 上 512 点稠密扫描对拍。返回最大
 * 偏差（全部实例/specs 收集断言）。
 */
function nailSingleCosine(
  evaluate: (angles: number[]) => number,
  angles: readonly number[],
  specs: readonly MixerAngleSpec[],
): number {
  const v0 = evaluate(angles.slice());
  let maxDev = 0;
  for (const spec of specs) {
    const bound = BETA_BOUND;
    const placement = cosineSampleBetas(angles[spec.index]!, spec.gap, bound);
    assert.ok(placement !== null, '宽盒（BETA_BOUND ≥ 2π/(2Δ)）内采样放置必须成功');
    assert.ok(placement.beta1 >= 0 && placement.beta1 <= bound);
    assert.ok(placement.beta2 >= 0 && placement.beta2 <= bound);
    const v1 = evaluate(withAngle(angles, spec.index, placement.beta1));
    const v2 = evaluate(withAngle(angles, spec.index, placement.beta2));
    const fit = fitCosine(
      [angles[spec.index]!, placement.beta1, placement.beta2],
      [v0, v1, v2],
      spec.gap,
    );
    assert.ok(!fit.degenerate, '良置三点的拟合系统必须非退化');
    const period = (2 * Math.PI) / spec.gap;
    for (let j = 0; j < SCAN_POINTS; j++) {
      const beta = (j / SCAN_POINTS) * period;
      const scanned = evaluate(withAngle(angles, spec.index, beta));
      const fitted = cosineValueAt(fit, spec.gap, beta);
      const dev = Math.abs(scanned - fitted);
      if (dev > maxDev) maxDev = dev;
    }
  }
  return maxDev;
}

// ----------------------------------------------------------------------------
// 1. 定理钉：单余弦结构（机器证明）
// ----------------------------------------------------------------------------

describe('R16-ECCM · 定理钉（单余弦结构）', () => {
  it('子空间均匀 k 纤维（3×5，Δ=3；4×5，Δ=2）：三点拟合 vs 512 点稠密扫描 ≤1e-12', () => {
    const cases = [
      { m: 3, n: 5, seed: 11 },
      { m: 4, n: 5, seed: 200 },
    ];
    for (const c of cases) {
      const model = buildSubspaceModel(makeProblem(c.m, c.n, c.seed))!;
      const energies = subspaceEnergies(model);
      const layers = 2;
      const evaluate = subspaceMultiEvaluate(model, energies, layers);
      const specs = eccmSpecs(model, layers);
      assert.ok(specs.length > 0);
      const angles = randomAngles(rngOf(c.seed), layers, model.mixers.length);
      const maxDev = nailSingleCosine(evaluate, angles, specs);
      assert.ok(
        maxDev <= NAIL_EPS,
        `${c.m}×${c.n} seed ${c.seed}: 单余弦最大偏差 ${maxDev.toExponential(3)} 超 ${NAIL_EPS}`,
      );
    }
  });

  it('全空间 ma 布局（逐比特 X，Δ=2）：同钉 ≤1e-12', () => {
    const nqubits = 9;
    const rng = rngOf(41);
    const energies = new Float64Array(1 << nqubits);
    for (let k = 0; k < energies.length; k++) energies[k] = rng() * 2;
    const layers = 1;
    const evaluate = fullspaceMultiEvaluate(nqubits, energies, layers);
    const specs: MixerAngleSpec[] = [];
    for (let q = 0; q < nqubits; q++) specs.push({ index: layers + q, gap: 2 });
    const angles = randomAngles(rngOf(5), layers, nqubits);
    const maxDev = nailSingleCosine(evaluate, angles, specs);
    assert.ok(
      maxDev <= NAIL_EPS,
      `全空间逐比特 X 混合器的单余弦最大偏差 ${maxDev.toExponential(3)} 超 ${NAIL_EPS}`,
    );
  });

  it('掩码实例：多值谱组被 subspaceMixerGap 诚实排除出 specs（排除面钉）', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 23, { mask: true }))!;
    const layers = 2;
    const gaps = model.mixers.map((_, g) => subspaceMixerGap(model, g));
    const excluded = gaps.filter((g) => g === null).length;
    assert.ok(excluded >= 1, `掩码截断应产生 ≥1 个多值谱组，got ${JSON.stringify(gaps)}`);
    const specs = eccmSpecs(model, layers);
    assert.equal(specs.length, layers * (model.mixers.length - excluded));
    // 排除组的 β 下标不出现在任何 spec 中（ECCM 不对域外坐标动刀）
    const specIndices = new Set(specs.map((s) => s.index));
    for (let p = 0; p < layers; p++) {
      for (let g = 0; g < model.mixers.length; g++) {
        if (gaps[g] === null) {
          assert.ok(
            !specIndices.has(layers + p * model.mixers.length + g),
            `多值谱组 (p=${p},g=${g}) 的坐标必须被排除`,
          );
        }
      }
    }
  });
});

// ----------------------------------------------------------------------------
// 2. 精确性：闭式极小 = 独立数值极小；Gauss-Seidel 不动点；bounds 行为
// ----------------------------------------------------------------------------

describe('R16-ECCM · 精确性', () => {
  it('单坐标：ECCM 终点 = 稠密扫描+三分搜索的独立 argmin（≤1e-9）且 ≤ 起点', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 11))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const angles = randomAngles(rngOf(17), layers, model.mixers.length);
    const specs = eccmSpecs(model, layers);
    const spec = specs[0]!;
    const single: MixerAngleSpec[] = [{ index: spec.index, gap: spec.gap }];
    const bounds = angles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
    const refined = refineAnglesByExactCosine(evaluate, angles, bounds, single, {
      restarts: 1,
      sweeps: 4,
    });
    // 单调（支配性）
    assert.ok(refined.value <= evaluate(angles) + 1e-12, '终点值应 ≤ 起点');
    // 独立数值 argmin：512 点网格 + 单峰胞元上 90 轮三分搜索 + 抛物线顶点
    // 精修（极小点二阶平坦：三分的角度精度受浮点噪声 ~sqrt(1e-16/f″)≈1e-8
    // 限制，抛物线段把顶点定位推到 ~1e-10）
    const coordEval = (beta: number): number => evaluate(withAngle(angles, spec.index, beta));
    let gridArgmin = 0;
    let gridMin = Infinity;
    for (let j = 0; j < SCAN_POINTS; j++) {
      const beta = (j / SCAN_POINTS) * BETA_BOUND;
      const v = coordEval(beta);
      if (v < gridMin) {
        gridMin = v;
        gridArgmin = j;
      }
    }
    const lo = ((gridArgmin - 1) / SCAN_POINTS) * BETA_BOUND;
    const hi = ((gridArgmin + 1) / SCAN_POINTS) * BETA_BOUND;
    const t = ternaryArgmin(coordEval, lo, hi, 90);
    const h = 1e-6;
    const fm = coordEval(t.x - h);
    const f0 = t.fx;
    const fp = coordEval(t.x + h);
    const denom = fm - 2 * f0 + fp;
    const independentArgmin = Math.abs(denom) > 1e-14 ? t.x + (0.5 * h * (fm - fp)) / denom : t.x;
    assert.ok(
      Math.abs(refined.angles[spec.index]! - independentArgmin) <= ARGMIN_EPS,
      `ECCM 终点 ${refined.angles[spec.index]} vs 独立 argmin ${independentArgmin}（偏差 ${(refined.angles[spec.index]! - independentArgmin).toExponential(2)}）`,
    );
    assert.ok(
      Math.abs(refined.value - coordEval(independentArgmin)) <= ARGMIN_EPS,
      `ECCM 终值 ${refined.value} vs 独立极小值 ${coordEval(independentArgmin)}`,
    );
  });

  it('多坐标收敛点：早停后任一 β 坐标 512 点稠密扫描无改进（Gauss-Seidel 不动点）', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 23))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const specs = eccmSpecs(model, layers);
    const angles = randomAngles(rngOf(29), layers, model.mixers.length);
    const bounds = angles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
    const refined = refineAnglesByExactCosine(evaluate, angles, bounds, specs, {
      restarts: 1,
      sweeps: 16,
    });
    assert.ok(refined.sweeps < 16, `零接受轮应早停（不动点），实际 ${refined.sweeps} 轮跑满上限`);
    // 容差 = ANGLE_IMPROVEMENT_EPS（1e-12）+ 扫描/拟合的浮点地板
    for (const spec of specs) {
      let scanMin = Infinity;
      for (let j = 0; j < SCAN_POINTS; j++) {
        const beta = (j / SCAN_POINTS) * BETA_BOUND;
        const v = evaluate(withAngle(refined.angles, spec.index, beta));
        if (v < scanMin) scanMin = v;
      }
      assert.ok(
        refined.value <= scanMin + 5e-12,
        `不动点上坐标 index=${spec.index} 仍可被扫描改进：${refined.value} vs ${scanMin}`,
      );
    }
  });

  it('解析单余弦：界内闭式极小（1e-9）；无约束极小在界外 ⇒ 精确回退较优端点', () => {
    // f(β) = 0.7 + 0.6·cos(2β) − 0.5·sin(2β)：R=√0.61，δ=atan2(−0.5,0.6)，
    // 无约束极小 β* = (δ+π)/2 ≈ 1.2235（界内）/ 在 [0,0.3] 外
    const f = (a: number[]): number => 0.7 + 0.6 * Math.cos(2 * a[0]!) - 0.5 * Math.sin(2 * a[0]!);
    const spec: MixerAngleSpec[] = [{ index: 0, gap: 2 }];
    const analyticArgmin = (Math.atan2(-0.5, 0.6) + Math.PI) / 2;
    // 界内：bound=2 包住 β*
    const interior = refineAnglesByExactCosine(f, [0.1], [2], spec, { restarts: 1, sweeps: 4 });
    assert.ok(
      Math.abs(interior.angles[0]! - analyticArgmin) <= ARGMIN_EPS,
      `界内闭式极小 ${interior.angles[0]} vs 解析 ${analyticArgmin}`,
    );
    // 界外：bound=0.3 < β*，f 在 [0,0.3] 上单调降 ⇒ 区间极小 = 端点 0.3
    const exterior = refineAnglesByExactCosine(f, [0.1], [0.3], spec, { restarts: 1, sweeps: 4 });
    assert.equal(exterior.angles[0], 0.3, '区间极小应精确落在较优端点 bound 上');
    assert.ok(exterior.value <= f([0.1]), '回退端点后仍应 ≤ 种子');
  });
});

// ----------------------------------------------------------------------------
// 3. 双轴对拍（质量 × 评估成本，r14j 同实例族同种子）
// ----------------------------------------------------------------------------

/** r14j 收敛对照的完整协议：实例 → layer-CD 种子 → multi 展开种子 + specs + bounds */
function buildDualAxisCase(instanceSeed: number): {
  evaluate: (angles: number[]) => number;
  seedAngles: number[];
  specs: MixerAngleSpec[];
  bounds: number[];
  seedValue: number;
} {
  const model = buildSubspaceModel(makeProblem(4, 5, instanceSeed))!;
  const energies = subspaceEnergies(model);
  const layers = 2;
  const G = model.mixers.length;
  const evaluateLayer = subspaceLayerEvaluate(model, energies, layers);
  const evaluate = subspaceMultiEvaluate(model, energies, layers);
  const layer = optimizeAnglesByCoordinateDescent(evaluateLayer, layers, 2, mulberry32(42));
  const seedAngles = expandLayerAnglesToMulti(layer.angles, layers, G);
  const specs = eccmSpecs(model, layers);
  const bounds = seedAngles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
  // 展开种子在 multi 电路下的评估值与 layer 最优逐位相同（r14j 支配性前提）
  assert.equal(evaluate(seedAngles), layer.expectation);
  return { evaluate, seedAngles, specs, bounds, seedValue: layer.expectation };
}

describe('R16-ECCM · 双轴对拍（本使命的验收）', () => {
  it('支配族（r14j 8 实例，seeds 100+7s）：ECCM(r1,s12) 逐实例双轴全占优 CD(r1)', () => {
    const rows: string[] = [];
    for (let s = 0; s < 8; s++) {
      const instanceSeed = 100 + s * 7;
      const { evaluate, seedAngles, specs, bounds, seedValue } = buildDualAxisCase(instanceSeed);
      const cd = optimizeAnglesByCoordinateDescentSeeded(
        evaluate,
        seedAngles.length,
        bounds,
        1,
        mulberry32(1),
        seedAngles,
      );
      const eccm = refineAnglesByExactCosine(evaluate, seedAngles, bounds, specs, {
        restarts: 1,
        seed: 1,
        sweeps: 12,
      });
      assert.ok(
        eccm.value <= cd.expectation + 1e-12,
        `inst ${instanceSeed}: 质量轴 ECCM ${eccm.value} 应 ≤ CD ${cd.expectation}`,
      );
      assert.ok(
        eccm.evaluations < cd.evaluations,
        `inst ${instanceSeed}: 成本轴 ECCM ${eccm.evaluations}ev 应 < CD ${cd.evaluations}ev`,
      );
      assert.ok(eccm.value <= seedValue + 1e-12, `inst ${instanceSeed}: 支配种子`);
      rows.push(
        `inst ${instanceSeed}: seed=${seedValue.toFixed(9)} | cd=${cd.expectation.toFixed(12)}@${cd.evaluations}ev | ` +
          `eccm(s12)=${eccm.value.toFixed(12)}@${eccm.evaluations}ev(sw${eccm.sweeps}) ` +
          `[Δq=${(eccm.value - cd.expectation).toExponential(2)}, Δc=${eccm.evaluations - cd.evaluations}]`,
      );
    }
    console.log(`[r16 双轴对拍 · 支配族 8 实例，4×5 layers=2 K=8，全占优]\n${rows.join('\n')}`);
  });

  it('对照族（r14j 收敛对照 4 实例，seeds 200+7s）：3/4 双轴全占优；inst 207 帕累托点如实入账', () => {
    const rows: string[] = [];
    for (let s = 0; s < 4; s++) {
      const instanceSeed = 200 + s * 7;
      const { evaluate, seedAngles, specs, bounds, seedValue } = buildDualAxisCase(instanceSeed);
      const cd = optimizeAnglesByCoordinateDescentSeeded(
        evaluate,
        seedAngles.length,
        bounds,
        1,
        mulberry32(1),
        seedAngles,
      );
      const eccm = refineAnglesByExactCosine(evaluate, seedAngles, bounds, specs, {
        restarts: 1,
        seed: 1,
        sweeps: 12,
      });
      assert.ok(eccm.evaluations < cd.evaluations, `inst ${instanceSeed}: 成本轴必占优`);
      assert.ok(eccm.value <= seedValue + 1e-12, `inst ${instanceSeed}: 支配种子`);
      if (instanceSeed === 207) {
        // 帕累托点（γ 冻结的诚实代价，机器钉死确定性事实，不松断言）：
        // s12/s16 成本占优但质量差 1.55e-6 / 1.41e-7；s24 质量占优但 483ev>381ev；
        // 任务书混合形态（ECCM→CD warm-start 收尾）质量占优但 484ev>381ev。
        const eccm16 = refineAnglesByExactCosine(evaluate, seedAngles, bounds, specs, {
          restarts: 1,
          seed: 1,
          sweeps: 16,
        });
        const eccm24 = refineAnglesByExactCosine(evaluate, seedAngles, bounds, specs, {
          restarts: 1,
          seed: 1,
          sweeps: 24,
        });
        const cdWarm = optimizeAnglesByCoordinateDescentSeeded(
          evaluate,
          seedAngles.length,
          bounds,
          1,
          mulberry32(1),
          eccm.angles,
        );
        assert.ok(eccm.value > cd.expectation, 'inst 207@s12 的质量缺口是结构性事实（帕累托）');
        assert.ok(
          eccm.value < cd.expectation + 2e-6,
          'inst 207@s12 的质量缺口应有界（≤2e-6，实测 1.55e-6）',
        );
        assert.ok(eccm16.evaluations < cd.evaluations, 'inst 207@s16 成本仍占优');
        assert.ok(
          eccm24.value <= cd.expectation + 1e-12,
          `inst 207@s24 质量轴应占优（实测 dq=${(eccm24.value - cd.expectation).toExponential(2)}）`,
        );
        assert.ok(
          cdWarm.expectation <= cd.expectation + 1e-12,
          'inst 207 混合形态（ECCM→CD warm-start）质量轴应占优',
        );
        rows.push(
          `inst 207: seed=${seedValue.toFixed(9)} | cd=${cd.expectation.toFixed(12)}@${cd.evaluations}ev | ` +
            `eccm(s12)=${eccm.value.toFixed(12)}@${eccm.evaluations}ev [Δq=+${(eccm.value - cd.expectation).toExponential(2)}, Δc=${eccm.evaluations - cd.evaluations}] | ` +
            `eccm(s16)=${eccm16.value.toFixed(12)}@${eccm16.evaluations}ev [Δq=+${(eccm16.value - cd.expectation).toExponential(2)}] | ` +
            `eccm(s24)=${eccm24.value.toFixed(12)}@${eccm24.evaluations}ev [Δq=${(eccm24.value - cd.expectation).toExponential(2)}, Δc=+${eccm24.evaluations - cd.evaluations}] | ` +
            `hybrid=ECCM(s12)+CDwarm=${cdWarm.expectation.toFixed(12)}@${eccm.evaluations + cdWarm.evaluations}ev [Δq=${(cdWarm.expectation - cd.expectation).toExponential(2)}]`,
        );
      } else {
        assert.ok(
          eccm.value <= cd.expectation + 1e-12,
          `inst ${instanceSeed}: 质量轴 ECCM ${eccm.value} 应 ≤ CD ${cd.expectation}`,
        );
        rows.push(
          `inst ${instanceSeed}: seed=${seedValue.toFixed(9)} | cd=${cd.expectation.toFixed(12)}@${cd.evaluations}ev | ` +
            `eccm(s12)=${eccm.value.toFixed(12)}@${eccm.evaluations}ev(sw${eccm.sweeps}) ` +
            `[Δq=${(eccm.value - cd.expectation).toExponential(2)}, Δc=${eccm.evaluations - cd.evaluations}]`,
        );
      }
    }
    console.log(
      `[r16 双轴对拍 · 对照族 4 实例，4×5 layers=2 K=8 —— 3/4 双轴全占优 + inst 207 帕累托前沿]\n${rows.join('\n')}`,
    );
  });
});

// ----------------------------------------------------------------------------
// 4/5. 确定性 / γ 冻结 / 支配性补钉
// ----------------------------------------------------------------------------

describe('R16-ECCM · 确定性与 γ 冻结', () => {
  it('同输入双跑 deepEqual（restarts=2 触及 RNG 流，镜像 CD 冷启动）', () => {
    const { evaluate, seedAngles, specs, bounds } = buildDualAxisCase(200);
    const a = refineAnglesByExactCosine(evaluate, seedAngles, bounds, specs, {
      restarts: 2,
      seed: 1,
      sweeps: 3,
    });
    const b = refineAnglesByExactCosine(evaluate, seedAngles, bounds, specs, {
      restarts: 2,
      seed: 1,
      sweeps: 3,
    });
    assert.deepEqual(b, a);
    assert.notEqual(a.evaluations, 0);
  });

  it('γ 冻结：精修后全部代价角与种子逐位相同', () => {
    const { evaluate, seedAngles, specs, bounds } = buildDualAxisCase(214);
    const refined = refineAnglesByExactCosine(evaluate, seedAngles, bounds, specs, {
      restarts: 1,
      sweeps: 4,
    });
    for (let p = 0; p < 2; p++) {
      assert.equal(refined.angles[p], seedAngles[p], `γ_${p} 必须保持种子值（定理域外冻结）`);
    }
  });

  it('随机起点（非 CD 种子）上的支配性：返回值 ≤ 起点', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 77))!;
    const energies = subspaceEnergies(model);
    const layers = 2;
    const evaluate = subspaceMultiEvaluate(model, energies, layers);
    const specs = eccmSpecs(model, layers);
    for (const startSeed of [3, 31, 97]) {
      const angles = randomAngles(rngOf(startSeed), layers, model.mixers.length);
      const bounds = angles.map((_, i) => (i < layers ? GAMMA_BOUND : BETA_BOUND));
      const refined = refineAnglesByExactCosine(evaluate, angles, bounds, specs, {
        restarts: 1,
        sweeps: 8,
      });
      assert.ok(
        refined.value <= evaluate(angles) + 1e-12,
        `随机起点 seed ${startSeed}: ${refined.value} 应 ≤ ${evaluate(angles)}`,
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 6. 负对照与平坦坐标（走私审判风格：非法输入被点名拒绝）
// ----------------------------------------------------------------------------

describe('R16-ECCM · 负对照与平坦坐标', () => {
  const dummyEvaluate = (angles: number[]): number => angles[0]! * angles[0]! + 1;
  const dummySpecs: MixerAngleSpec[] = [{ index: 0, gap: 2 }];
  const throwsWith = (fn: () => unknown, fragment: string): void => {
    assert.throws(
      fn,
      (err: unknown) => err instanceof QuantumEngineError && err.message.includes(fragment),
      `应抛含 "${fragment}" 的 QuantumEngineError`,
    );
  };

  it('空 specs（静默 no-op）被拒绝', () => {
    throwsWith(() => refineAnglesByExactCosine(dummyEvaluate, [0.4], [Math.PI / 2], []), 'no-op');
  });

  it('非正/NaN 谱隙被拒绝且指名 gap（refine 与 fitCosine 双入口）', () => {
    for (const gap of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      throwsWith(
        () => refineAnglesByExactCosine(dummyEvaluate, [0.4], [Math.PI / 2], [{ index: 0, gap }]),
        'gap',
      );
    }
    throwsWith(() => fitCosine([0, 0.5, 0.25], [1, 2, 3], 0), 'gap');
    throwsWith(() => cosineSampleBetas(0.4, Number.NaN, Math.PI / 2), 'gap');
  });

  it('角度下标越界被拒绝且指名 index', () => {
    throwsWith(
      () => refineAnglesByExactCosine(dummyEvaluate, [0.4], [Math.PI / 2], [{ index: 5, gap: 2 }]),
      'index',
    );
  });

  it('非法 sweeps / restarts / rng seed 被指名拒绝', () => {
    for (const sweeps of [0, -1, 1.5, Number.NaN]) {
      throwsWith(
        () =>
          refineAnglesByExactCosine(dummyEvaluate, [0.4], [Math.PI / 2], dummySpecs, { sweeps }),
        'sweeps',
      );
    }
    for (const restarts of [0, 2.5, Number.NaN]) {
      throwsWith(
        () =>
          refineAnglesByExactCosine(dummyEvaluate, [0.4], [Math.PI / 2], dummySpecs, { restarts }),
        'restarts',
      );
    }
    throwsWith(
      () =>
        refineAnglesByExactCosine(dummyEvaluate, [0.4], [Math.PI / 2], dummySpecs, {
          seed: Number.NaN,
        }),
      'seed',
    );
  });

  it('种子角 NaN / bounds 形状与负值被指名拒绝', () => {
    throwsWith(
      () => refineAnglesByExactCosine(dummyEvaluate, [Number.NaN], [Math.PI / 2], dummySpecs),
      'seedAngles',
    );
    throwsWith(
      () => refineAnglesByExactCosine(dummyEvaluate, [0.4, 0.4], [Math.PI / 2], dummySpecs),
      'bounds',
    );
    throwsWith(() => refineAnglesByExactCosine(dummyEvaluate, [0.4], [-0.1], dummySpecs), 'bounds');
  });

  it('非有限评估值被具名拒绝（NaN 不静默流穿）', () => {
    const bad = (angles: number[]): number => (angles[0]! > 0.5 ? Number.NaN : 1);
    throwsWith(
      () =>
        refineAnglesByExactCosine(bad, [0.9], [Math.PI / 2], dummySpecs, {
          restarts: 1,
          sweeps: 1,
        }),
      'evaluate',
    );
  });

  it('纯函数原语的域校验：fitCosine 样本数/NaN 值；cosineSampleBetas 负 bound', () => {
    throwsWith(() => fitCosine([0, 0.5], [1, 2], 2), '3 sample points');
    throwsWith(() => fitCosine([0, 0.5, 0.25], [1, Number.NaN, 3], 2), 'values');
    throwsWith(() => fitCosine([0, Number.NaN, 0.25], [1, 2, 3], 2), 'betas');
    throwsWith(() => cosineSampleBetas(0.4, 2, -1), 'bound');
    throwsWith(() => cosineSampleBetas(Number.NaN, 2, 1), 'beta0');
    // bound=0：无活动空间，放置返回 null（调用方跳过坐标，诚实退化）
    assert.equal(cosineSampleBetas(0.4, 2, 0), null);
  });

  it('三点退化：Δ·bound 内任何两点按周期不可分 ⇒ 返回 null（不用病态系统冒充精确）', () => {
    // gap=2、bound=1e-10：盒内任意 |Δβ|·Δ ≤ 2e-10 < 可分阈值 1e-9
    assert.equal(cosineSampleBetas(5e-11, 2, 1e-10), null);
  });

  it('平坦坐标（恒值目标）：零移动、零确认评估、返回种子角与种子值', () => {
    const flat = (): number => 0.5;
    const refined = refineAnglesByExactCosine(flat, [0.7], [Math.PI / 2], dummySpecs, {
      restarts: 1,
      sweeps: 2,
    });
    assert.equal(refined.angles[0], 0.7, '平坦坐标必须保持种子角');
    assert.equal(refined.value, 0.5);
    assert.equal(refined.improved, false);
    assert.ok(refined.skippedCoordinates >= 1, '扫描轮至少跳过平坦坐标一次');
    // 记账：种子 1 次评估 + 首轮（零接受即早停）2 次采样（β₀ 值复用，无确认评估）
    assert.equal(refined.evaluations, 1 + 2);
    assert.equal(refined.sweeps, 1, '零接受轮后即早停');
  });

  it('degenerate 拟合的极小原语原样返回 β₀（不产生病态步）', () => {
    const degenerate = fitCosine([0, 0.5, 1], [1, 2, 3], 2); // 位置可分，非退化
    assert.ok(!degenerate.degenerate);
    // 手工构造退化：三点值完全一致在可分位置上仍是可解系统（c0=v, a=b=0），
    // 退化只来自位置不可分——由 cosineSampleBetas 前置拦截（上一测），
    // 此处直接验证 degenerate 标记的下游行为
    const asDegenerate = { ...degenerate, degenerate: true };
    assert.equal(cosineMinimumInBounds(asDegenerate, 2, 0.7, Math.PI / 2), 0.7);
  });
});
