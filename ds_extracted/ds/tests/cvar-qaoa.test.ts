/**
 * CVaR-QAOA（Barkoutsos et al. 2020）· 数学性质 + 诚实基准
 *
 * 基准结论（可行域保证的生成器，固定种子，配对统计消除实例间方差）：
 * - p=1（低深度，QAOA 真正困难的 regime）：CVaR_0.1 温和而稳定地优于
 *   均值目标（差距 0.4490→0.4309 / 0.4202→0.4169；配对 17:10 与 41:32）；
 *   v1.9 记录的更大数字出自含 ~1% 不可行实例的旧生成器（穷举最优 0
 *   是占位符而非上界），已在 v1.10 校正；
 * - p≥2：本引擎的坐标下降 + argmax-valid 坍缩已近饱和，CVaR 无可测差异
 *   （不宣称收益）；
 * - 默认 α=1 与不传该选项位级一致（均值原路径逐字未动）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ComplexAmplitudes,
  cvarExpectationValue,
  cvarExpectationOrdered,
  cvarOrder,
} from '../src/core/solver-common.js';
import {
  qaoaSolve,
  bruteForceOptimum,
  computeEnergies,
  type AssignmentProblem,
} from '../src/core/quantum-optimizer.js';
import { qaoaSolveSubspace, buildSubspaceModel } from '../src/core/subspace-optimizer.js';
import { mulberry32 } from '../src/utils/rng.js';

// ----------------------------------------------------------------------------
// CVaR 数学性质
// ----------------------------------------------------------------------------

function stateOf(probs: number[]): ComplexAmplitudes {
  const st = new ComplexAmplitudes(probs.length);
  for (let k = 0; k < probs.length; k++) st.re[k] = Math.sqrt(probs[k]!);
  return st;
}

describe('CVaR 内核 · 数学性质', () => {
  it('手算例：最低能量态按分位截断加权', () => {
    // 能量 [0,1,2,3]，概率 [0.5,0.25,0.125,0.125]
    const st = stateOf([0.5, 0.25, 0.125, 0.125]);
    const energies = new Float64Array([0, 1, 2, 3]);
    // α=0.5：头部只有 e=0（p=0.5 ≥ α）→ CVaR = 0
    assert.ok(Math.abs(cvarExpectationValue(st, energies, 0.5)) < 1e-12);
    // α=0.75：e=0 全取（0.5）+ e=1 取 0.25 → (0.5·0 + 0.25·1)/0.75 = 1/3
    assert.ok(Math.abs(cvarExpectationValue(st, energies, 0.75) - 1 / 3) < 1e-12);
    // α=1：全域均值 = 0·0.5+1·0.25+2·0.125+3·0.125 = 0.875
    assert.ok(Math.abs(cvarExpectationValue(st, energies, 1) - 0.875) < 1e-12);
  });

  it('单调性：α 越小 CVaR 越低（聚焦更优尾部），且 CVaR_α ≤ ⟨E⟩', () => {
    const rng = mulberry32(7);
    for (let trial = 0; trial < 50; trial++) {
      const dim = 8 + Math.floor(rng() * 24);
      const raw = Array.from({ length: dim }, () => rng() + 0.01);
      const total = raw.reduce((a, b) => a + b, 0);
      const probs = raw.map((x) => x / total);
      const energies = new Float64Array(dim);
      for (let k = 0; k < dim; k++) energies[k] = rng() * 4 - 2;
      const st = stateOf(probs);
      let prev = Infinity;
      for (const alpha of [1, 0.5, 0.25, 0.1, 0.05]) {
        const v = cvarExpectationValue(st, energies, alpha);
        assert.ok(v <= prev + 1e-12, `α 递减时 CVaR 必须非增（trial ${trial}）`);
        prev = v;
      }
    }
  });

  it('有序快速路径与便捷入口一致；预排序复用不改变结果', () => {
    const rng = mulberry32(11);
    const dim = 32;
    const raw = Array.from({ length: dim }, () => rng() + 0.01);
    const total = raw.reduce((a, b) => a + b, 0);
    const st = stateOf(raw.map((x) => x / total));
    const energies = new Float64Array(dim);
    for (let k = 0; k < dim; k++) energies[k] = rng() * 6 - 3;
    const order = cvarOrder(energies);
    for (const alpha of [0.05, 0.2, 0.5, 1]) {
      assert.equal(
        cvarExpectationOrdered(st.probabilities(), energies, order, alpha),
        cvarExpectationValue(st, energies, alpha),
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 求解器接入：默认位级不变 + 校验 + 确定性
// ----------------------------------------------------------------------------

function coupledProblem(
  rng: () => number,
  m: number,
  n: number,
  density: number,
): AssignmentProblem {
  const weights = Array.from({ length: m }, () => Array.from({ length: n }, () => rng() * 2 - 0.4));
  const ineligible = Array.from({ length: m }, () => Array.from({ length: n }, () => rng() < 0.15));
  // 恒可行保证：清除恒等匹配上的格（否则 ~1% 实例无可行分配，
  // bruteForceOptimum 的 0 值是占位符而非上界，福利比较失去意义）
  for (let t = 0; t < Math.min(m, n); t++) ineligible[t]![t] = false;
  const nq = m * n;
  const couplings = new Map<number, number>();
  for (let t1 = 0; t1 < m; t1++) {
    for (let t2 = t1 + 1; t2 < m; t2++) {
      for (let a1 = 0; a1 < n; a1++) {
        for (let a2 = 0; a2 < n; a2++) {
          if (a1 === a2) continue;
          if (rng() < density) couplings.set((t1 * n + a1) * nq + (t2 * n + a2), rng() * 1.6 - 0.8);
        }
      }
    }
  }
  return {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible,
    couplings,
    penaltyOneHot: 10,
    penaltyCapacity: 10,
  };
}

describe('CVaR-QAOA · 求解器接入', () => {
  it('默认与 cvarAlpha=1 位级一致（均值原路径未动）', () => {
    const rng = mulberry32(123);
    const problem = coupledProblem(rng, 3, 3, 0.15);
    const a = qaoaSolve(problem, { layers: 2, seed: 42 });
    const b = qaoaSolve(problem, { layers: 2, seed: 42, cvarAlpha: 1 });
    assert.deepEqual(a, b);
  });

  it('α<1 确定性：同种子两次调用结果完全一致', () => {
    const rng = mulberry32(321);
    const problem = coupledProblem(rng, 3, 3, 0.15);
    const a = qaoaSolve(problem, { layers: 1, seed: 42, cvarAlpha: 0.1 });
    const b = qaoaSolve(problem, { layers: 1, seed: 42, cvarAlpha: 0.1 });
    assert.deepEqual(a, b);
  });

  it('非法 α 被入口拒绝', () => {
    const problem = coupledProblem(mulberry32(1), 2, 2, 0);
    assert.throws(() => qaoaSolve(problem, { cvarAlpha: 0 }), /cvarAlpha/);
    assert.throws(() => qaoaSolve(problem, { cvarAlpha: 1.5 }), /cvarAlpha/);
    assert.throws(() => qaoaSolve(problem, { cvarAlpha: Number.NaN }), /cvarAlpha/);
  });

  it('报告口径：expectation 恒为真实 ⟨E⟩（CVaR 只改变选角）', () => {
    const rng = mulberry32(77);
    const problem = coupledProblem(rng, 3, 3, 0.15);
    const sol = qaoaSolve(problem, { layers: 1, seed: 42, cvarAlpha: 0.1 });
    // ⟨E⟩ 必落在能量谱 [min, max] 内：CVaR 原始值（归一化尺度）未经
    // 尺度还原时的典型症状是越界或恒为 [0,1] 区间
    const info = computeEnergies(problem);
    assert.ok(
      sol.expectation >= info.min - 1e-6 && sol.expectation <= info.max + 1e-6,
      `expectation ${sol.expectation} 应在能量谱 [${info.min}, ${info.max}] 内`,
    );
  });

  it('子空间引擎：α=1 默认位级一致；α<1 仍命中合法分配', () => {
    const rng = mulberry32(55);
    const problem = coupledProblem(rng, 3, 3, 0.1);
    const model = buildSubspaceModel(problem);
    assert.ok(model, '3×3 问题必有子空间模型');
    const a = qaoaSolveSubspace(model, { seed: 42 });
    const b = qaoaSolveSubspace(model, { seed: 42, cvarAlpha: 1 });
    assert.deepEqual(a, b);
    const c = qaoaSolveSubspace(model, { seed: 42, cvarAlpha: 0.15, layers: 1 });
    assert.ok(
      c.assignment.every((x) => x >= 0),
      '子空间全部基态合法',
    );
    assert.ok(c.welfare <= model.optimalWelfare + 1e-9);
  });
});

// ----------------------------------------------------------------------------
// 诚实基准：p=1 低深度 regime（固定种子，配对统计）
// ----------------------------------------------------------------------------

describe('CVaR-QAOA · 低深度基准（配对）', () => {
  function battery(m: number, n: number, seeds: number) {
    const instances: AssignmentProblem[] = [];
    for (let s = 0; s < seeds; s++) {
      const rng = mulberry32(9000 + s * 17);
      instances.push(coupledProblem(rng, m, n, 0.15));
    }
    let meanGap = 0;
    let cvarGap = 0;
    let cvarWins = 0;
    let meanWins = 0;
    for (const problem of instances) {
      const optimal = bruteForceOptimum(problem).welfare;
      const gapOf = (alpha: number): number => {
        const sol = qaoaSolve(problem, { layers: 1, seed: 42, cvarAlpha: alpha });
        return Math.max(0, (optimal - sol.welfare) / (Math.abs(optimal) + 1e-9));
      };
      const gMean = gapOf(1);
      const gCvar = gapOf(0.1);
      meanGap += gMean;
      cvarGap += gCvar;
      if (gCvar < gMean - 1e-12) cvarWins++;
      else if (gCvar > gMean + 1e-12) meanWins++;
    }
    return { meanGap: meanGap / seeds, cvarGap: cvarGap / seeds, cvarWins, meanWins, seeds };
  }

  // 修正后的诚实数字（可行域保证的生成器，100 种子实测）：
  // 3×3: 0.4490 → 0.4309（配对 17:10）；3×4: 0.4202 → 0.4169（配对 41:32）。
  // v1.9 文档中更大的数字来自含不可行实例的旧生成器，已在 v1.10 校正。
  it('p=1：CVaR_0.1 平均相对差距严格更小，配对胜负占优（3×3 ×100）', () => {
    const r = battery(3, 3, 100);
    assert.ok(
      r.cvarGap < r.meanGap,
      `平均差距应改善：CVaR ${r.cvarGap.toFixed(4)} vs 均值 ${r.meanGap.toFixed(4)}`,
    );
    assert.ok(r.cvarWins > r.meanWins, `配对胜负应占优：CVaR ${r.cvarWins} vs 均值 ${r.meanWins}`);
  });

  it('p=1：非方阵 3×4 ×100 同向（方向稳健性，增益温和）', () => {
    const r = battery(3, 4, 100);
    assert.ok(
      r.cvarGap < r.meanGap,
      `CVaR ${r.cvarGap.toFixed(4)} vs 均值 ${r.meanGap.toFixed(4)}`,
    );
    assert.ok(r.cvarWins > r.meanWins, `配对 CVaR ${r.cvarWins} vs 均值 ${r.meanWins}`);
  });
});
