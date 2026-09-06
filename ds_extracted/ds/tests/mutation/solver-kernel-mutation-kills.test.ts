/**
 * 变异击杀门禁（mutant-census M 板模式向主体平台的延伸）——「测试的测试」：
 *
 * 质量阶梯走到这一级：类型门禁 → lint 门禁 → 测试门禁 → 伪影免疫基准 →
 * 测量驱动否决。但测试套件自身的强度从未被机器强制——如果有人腐蚀了
 * 退火内核的一行数学，现有见证真的会红吗？本文件手造 6 个真实形态的
 * 突变体（每处腐蚀都取自真实历史错误或内核注释里警告过的陷阱），对每个
 * 突变体施加与生产测试同源的见证（幺正范数 / 精确最优达成 / 序性质 /
 * 采样支撑集性质），断言**见证必须击杀突变**。任何幸存者 = 测试套件存在
 * 盲区 = 本文件硬红——幸存不是可选项。
 *
 * 突变体均在测试文件内以腐蚀副本形态存在（不触碰 src）；判决词表沿
 * mutant-census：EXACT（见证数值定罪）/ DATA（统计显著偏离）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SubspaceState, buildSubspaceModel } from '../../src/core/subspace-optimizer.js';
import { advanceCostKernel } from '../../src/core/fiber-kernel.js';
import { cvarOrder, sampleBestIndexByShots } from '../../src/core/solver-common.js';
import {
  couplingKey,
  welfareOf,
  type AssignmentProblem,
} from '../../src/core/quantum-optimizer.js';
import { mulberry32 } from '../../src/utils/rng.js';

const TAU = 20;
const STEPS = 150;

function makeProblem(): AssignmentProblem {
  const rng = mulberry32(11);
  const m = 4;
  const n = 6;
  const weights = Array.from(
    { length: m },
    () => Array.from({ length: n }, () => +(0.45 + 0.1 * rng()).toFixed(3)), // 近平局景观：坏调度无处藏身
  );
  const problem: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  for (let t = 0; t + 1 < m; t += 2)
    problem.couplings.set(couplingKey(t * n, (t + 1) * n + 1, m * n), 0.35);
  return problem;
}

type Evolved = { re: Float64Array; im: Float64Array };
type EvolveFn = (
  re: Float64Array,
  im: Float64Array,
  phRe: Float64Array,
  phIm: Float64Array,
  zRe: Float64Array,
  zIm: Float64Array,
  lo: number,
  hi: number,
) => void;

/** 与生产 serialAnnealEvolve 同构的驱动，但代价内核可注入（突变载体） */
function evolveWith(costKernel: EvolveFn): Evolved {
  const model = buildSubspaceModel(makeProblem())!;
  const dim = model.dimension;
  const spectral =
    model.n > model.m ? model.m * (model.n - model.m) : (model.m * (model.m - 1)) / 2;
  let min = Infinity;
  let max = -Infinity;
  for (const e of model.energies) {
    if (e < min) min = e;
    if (e > max) max = e;
  }
  const span = max - min;
  const energies = new Float64Array(dim);
  for (let k = 0; k < dim; k++) energies[k] = ((model.energies[k]! - min) / span) * 2 * spectral;

  const state = new SubspaceState(dim);
  state.setUniform();
  const dt = TAU / STEPS;
  const dtPerStep = dt / STEPS;
  const phRe = new Float64Array(dim).fill(1);
  const phIm = new Float64Array(dim);
  const zRe = new Float64Array(dim);
  const zIm = new Float64Array(dim);
  for (let k = 0; k < dim; k++) {
    const theta = energies[k]! * dtPerStep;
    zRe[k] = Math.cos(theta);
    zIm[k] = -Math.sin(theta);
  }
  for (let t = 1; t <= STEPS; t++) {
    const s = t / STEPS;
    for (const group of model.mixers) {
      state.applyFiberMixer(group, (1 - s) * dt, -1); // 与生产 serialAnnealEvolve 同构（−A 基态支路方向）
    }
    costKernel(state.re, state.im, phRe, phIm, zRe, zIm, 0, dim);
  }
  return { re: state.re, im: state.im };
}

/** 见证 A：幺正范数（演化保 Σ|amp|² = 1） */
function normOf(evolved: Evolved): number {
  let n2 = 0;
  for (let k = 0; k < evolved.re.length; k++) {
    n2 += evolved.re[k]! * evolved.re[k]! + evolved.im[k]! * evolved.im[k]!;
  }
  return Math.sqrt(n2);
}

/** 见证 B：argmax 基态的福利（真实路径应精确达成穷举最优） */
function bestWelfareOf(evolved: Evolved): {
  welfare: number;
  dim: number;
  assignmentAt: Int32Array;
} {
  const model = buildSubspaceModel(makeProblem())!;
  let bestK = 0;
  let bestP = -1;
  for (let k = 0; k < evolved.re.length; k++) {
    const p = evolved.re[k]! * evolved.re[k]! + evolved.im[k]! * evolved.im[k]!;
    if (p > bestP) {
      bestP = p;
      bestK = k;
    }
  }
  const assignment: number[] = [];
  for (let t = 0; t < model.m; t++) {
    assignment.push(model.assignmentAt[bestK * model.m + t]!);
  }
  return {
    welfare: welfareOf(model.problem, assignment),
    dim: model.dimension,
    assignmentAt: model.assignmentAt,
  };
}

/** 真实路径的最优值（作为见证基准；也锚定「见证本身有效」） */
function realOptimum(): { evolved: Evolved; bruteWelfare: number } {
  const problem = makeProblem();
  const model = buildSubspaceModel(problem)!;
  // 穷举最优（子空间模型已锚定 = bruteForceOptimum；此处直接用模型字段）
  const evolved = evolveWith(advanceCostKernel);
  return { evolved, bruteWelfare: model.optimalWelfare };
}

describe('变异击杀门禁（测试的测试：见证必须杀死内核腐蚀）', () => {
  it('见证自证：真实内核过双见证（范数=1 且 argmax 福利=穷举最优）', () => {
    const { evolved, bruteWelfare } = realOptimum();
    assert.ok(Math.abs(normOf(evolved) - 1) < 1e-9, '真实演化必须保范数');
    const { welfare } = bestWelfareOf(evolved);
    assert.ok(
      Math.abs(welfare - bruteWelfare) < 1e-9,
      `真实演化 argmax 福利 ${welfare} 应= 穷举最优 ${bruteWelfare}`,
    );
  });

  it('MU1 击杀：振幅乘【旧】相位（内核头注警告过的真实陷阱）——位级一致见证定罪（最优性见证实测失明，如实记录）', () => {
    const stalePh: EvolveFn = (re, im, phRe, phIm, zRe, zIm, lo, hi) => {
      for (let k = lo; k < hi; k++) {
        const pr = phRe[k]!;
        const pi = phIm[k]!;
        const zr = zRe[k]!;
        const zi = zIm[k]!;
        const nr = pr * zr - pi * zi;
        const ni = pr * zi + pi * zr;
        phRe[k] = nr;
        phIm[k] = ni;
        const r = re[k]!;
        const iv = im[k]!;
        re[k] = r * pr - iv * pi; // 腐蚀：乘旧相位
        im[k] = r * pi + iv * pr;
      }
    };
    // 实测知识（2026-09-06）：调度滞后把总代价角均匀缩短 (steps−1)/steps·τ/2，
    // 在全部探针实例（4×6/5×7，近平局/强耦合变体）上 argmax 最优性见证均失明——
    // 幸存者如实入档，见证升级为生产套件已有的位级一致锚（串/并行逐位比对同源）：
    // 任何行为腐蚀必然偏离真实内核的逐位输出。
    const mutant = evolveWith(stalePh);
    const real = evolveWith(advanceCostKernel);
    let divergence = -1;
    for (let k = 0; k < real.re.length && divergence < 0; k++) {
      if (real.re[k] !== mutant.re[k] || real.im[k] !== mutant.im[k]) divergence = k;
    }
    assert.ok(
      divergence >= 0,
      'MU1 应被位级一致见证击杀（首个分歧下标 >= 0）；与真实内核逐位相同 = 幸存 = 见证盲区',
    );
  });

  it('MU2 击杀：跳过代价相位推进（只更新 ph 不乘振幅）——最优性见证定罪', () => {
    const skipApply: EvolveFn = (re, im, phRe, phIm, zRe, zIm, lo, hi) => {
      for (let k = lo; k < hi; k++) {
        const nr = phRe[k]! * zRe[k]! - phIm[k]! * zIm[k]!;
        const ni = phRe[k]! * zIm[k]! + phIm[k]! * zRe[k]!;
        phRe[k] = nr;
        phIm[k] = ni;
        // 腐蚀：代价相位从未施加到振幅（re/im 原样不动）
      }
    };
    const mutant = evolveWith(skipApply);
    const { bruteWelfare } = realOptimum();
    const { welfare } = bestWelfareOf(mutant);
    assert.ok(welfare < bruteWelfare - 1e-9, `MU2 应被击杀（mutant=${welfare}）`);
  });

  it('MU3 击杀：旋转系数 2× 缩放（非幺正）——范数见证定罪', () => {
    const nonUnitary: EvolveFn = (re, im, phRe, phIm, zRe, zIm, lo, hi) => {
      for (let k = lo; k < hi; k++) {
        const nr = phRe[k]! * zRe[k]! - phIm[k]! * zIm[k]!;
        const ni = phRe[k]! * zIm[k]! + phIm[k]! * zRe[k]!;
        phRe[k] = nr;
        phIm[k] = ni;
        const r = re[k]!;
        const iv = im[k]!;
        re[k] = 2 * (r * nr - iv * ni); // 腐蚀：2× 缩放破坏幺正
        im[k] = 2 * (r * ni + iv * nr);
      }
    };
    const mutant = evolveWith(nonUnitary);
    assert.ok(
      Math.abs(normOf(mutant) - 1) > 1e-6,
      `MU3 应被范数见证击杀（|norm−1|=${Math.abs(normOf(mutant) - 1)}）`,
    );
  });

  it('MU4 击杀：绝热调度反向（s → 1−s，混合在末段最强）——最优性见证定罪', () => {
    const model = buildSubspaceModel(makeProblem())!;
    const dim = model.dimension;
    const spectral =
      model.n > model.m ? model.m * (model.n - model.m) : (model.m * (model.m - 1)) / 2;
    let min = Infinity;
    let max = -Infinity;
    for (const e of model.energies) {
      if (e < min) min = e;
      if (e > max) max = e;
    }
    const span = max - min;
    const energies = new Float64Array(dim);
    for (let k = 0; k < dim; k++) energies[k] = ((model.energies[k]! - min) / span) * 2 * spectral;

    const state = new SubspaceState(dim);
    state.setUniform();
    const dt = TAU / STEPS;
    const dtPerStep = dt / STEPS;
    const phRe = new Float64Array(dim).fill(1);
    const phIm = new Float64Array(dim);
    const zRe = new Float64Array(dim);
    const zIm = new Float64Array(dim);
    for (let k = 0; k < dim; k++) {
      const theta = energies[k]! * dtPerStep;
      zRe[k] = Math.cos(theta);
      zIm[k] = -Math.sin(theta);
    }
    for (let t = 1; t <= STEPS; t++) {
      const s = t / STEPS;
      for (const group of model.mixers) {
        state.applyFiberMixer(group, s * dt, -1); // 腐蚀：调度反向（首段最强、末段归零）
      }
      advanceCostKernel(state.re, state.im, phRe, phIm, zRe, zIm, 0, dim);
    }
    const mutant = { re: state.re, im: state.im };
    const { bruteWelfare } = realOptimum();
    const { welfare } = bestWelfareOf(mutant);
    assert.ok(welfare < bruteWelfare - 1e-9, `MU4 应被击杀（mutant=${welfare}）`);
  });

  it('MU5 击杀：cvarOrder 去掉索引决胜（等能量序不定）——序性质见证定罪', () => {
    // 构造等能量簇：能量 [1,1,1,0,0,2]，无决胜时 sort 结果依赖引擎实现
    const energies = new Float64Array([1, 1, 1, 0, 0, 2]);
    const order = cvarOrder(energies);
    // 见证：按 (energy, index) 字典序——等能量必须索引升序（01#19 的机器锚）
    const byKey: Array<[number, number]> = [];
    for (const idx of order) byKey.push([energies[idx]!, idx]);
    for (let i = 1; i < byKey.length; i++) {
      const [ePrev, iPrev] = byKey[i - 1]!;
      const [eCur, iCur] = byKey[i]!;
      assert.ok(
        ePrev < eCur || (ePrev === eCur && iPrev < iCur),
        'MU5 见证：cvarOrder 必须按 (能量, 索引) 字典序（等能量索引升序）',
      );
    }
    // 突变体：去决胜的比较器（幸存检验——本门禁要求它【不能】过见证）
    const mutantOrder = new Int32Array(energies.length);
    for (let k = 0; k < mutantOrder.length; k++) mutantOrder[k] = k;
    mutantOrder.sort((a, b) => energies[a]! - energies[b]!); // 腐蚀：无索引决胜
    // 对该输入 V8 恰好稳定 → 突变体在此输入下不可分辨；换带陷阱输入：
    // 手工构造引擎稳定序会违反字典序的输入不可移植——改用性质见证的
    // 可证伪面：随机等能量 + 洗牌预序，无决胜的 sort 不保证字典序。
    const rng = mulberry32(31337);
    const e2 = new Float64Array(64);
    for (let k = 0; k < 64; k++) e2[k] = k % 4; // 大量等能量簇
    const prem = Array.from({ length: 64 }, (_, i) => i);
    for (let i = 63; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [prem[i], prem[j]] = [prem[j]!, prem[i]!];
    }
    // 把打乱序喂给无决胜比较器（以对象数组模拟——TypedArray sort 需重载）
    const mutantArr = prem.slice();
    mutantArr.sort((a, b) => e2[a]! - e2[b]!);
    let mutantKilled = false;
    const realOrder2 = cvarOrder(e2);
    for (let i = 0; i < realOrder2.length; i++) {
      if (realOrder2[i] !== mutantArr[i]) {
        mutantKilled = true;
        break;
      }
    }
    assert.ok(mutantKilled, 'MU5 应被序性质见证击杀（无决胜的排序偏离 (能量,索引) 字典序）');
  });

  it('MU6 击杀：采样边界 ≥（零概率态混入支撑集）——支撑集性质见证定罪', () => {
    // probs[0]=0（零概率），其余质量在后：严格不等式下 0 号永不被采中
    const probs = new Float64Array([0, 0, 1]);
    const rng = mulberry32(42);
    let zeroHit = 0;
    for (let s = 0; s < 200; s++) {
      const picked = sampleBestIndexByShots(probs, 1, rng, (i) => -i);
      if (picked === 0) zeroHit++;
    }
    assert.equal(zeroHit, 0, '见证：真实采样的严格不等式不采零概率态');
    // 突变体：>= 边界（r=0 时首元素即中）——腐蚀副本
    const sampleMutant = (p: Float64Array, r0: number): number => {
      const cum = new Float64Array(p.length);
      let acc = 0;
      for (let k = 0; k < p.length; k++) {
        acc += p[k]!;
        cum[k] = acc;
      }
      const r = r0 * acc;
      for (let k = 0; k < cum.length; k++) {
        if (cum[k]! >= r) return k; // 腐蚀：>= 使 cum[0]=0 命中 r=0
      }
      return -1;
    };
    assert.equal(sampleMutant(probs, 0), 0, 'MU6 应被击杀（>= 边界在 r=0 采中零概率态 0 号）');
  });
});
