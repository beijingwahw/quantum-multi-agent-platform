/**
 * ma-QAOA（多角度 QAOA，Chandarana et al. 2020）· 支配性定理 + 诚实基准
 *
 * 定理（构造性）：multi 模式以 layer 最优角的展开为种子，展开态与
 * layer 电路的末态逐位相同，坐标下降只接受严格改进 ⇒ 同一变分目标下
 * ma-QAOA 的 ⟨E⟩ ≤ layer-QAOA 的 ⟨E⟩。本套件在目标层面钉住该定理。
 *
 * 诚实结论（可行域保证的生成器，见 QUANTUM-SCHEDULING.md 七⅞）：
 * - 定理作用在变分目标 ⟨E⟩ 上；全空间坍缩读数已饱和，welfare 增益边际
 *   （配对近全平）——全空间不宣称收益；
 * - 子空间变分 regime（逐任务移动混合角 = 恰当表达力）增益大而稳健：
 *   6×6 命中率 +19~30 个百分点、差距约减半（配对 19:5 / 13:5）；
 * - CVaR 在 p≥2 有害（引擎已饱和）；组合优势温和且依实例分布，不宣称。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  qaoaSolve,
  bruteForceOptimum,
  computeEnergies,
  QuantumStateVector,
  type AssignmentProblem,
} from '../src/core/quantum-optimizer.js';
import { qaoaSolveSubspace, buildSubspaceModel } from '../src/core/subspace-optimizer.js';
import { mulberry32 } from '../src/utils/rng.js';

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

describe('ma-QAOA · 支配性定理（目标层面）', () => {
  it('同实例同种子：multi 的末态 ⟨E⟩ ≤ layer 的 ⟨E⟩（p=1/p=2 各 25 实例）', () => {
    for (const layers of [1, 2]) {
      for (let s = 0; s < 25; s++) {
        const rng = mulberry32(9000 + s * 17);
        const problem = coupledProblem(rng, 3, 3, 0.15);
        const layerSol = qaoaSolve(problem, { layers, seed: 42, angleMode: 'layer' });
        const multiSol = qaoaSolve(problem, { layers, seed: 42, angleMode: 'multi' });
        assert.ok(
          multiSol.expectation <= layerSol.expectation + 1e-9,
          `p=${layers} seed=${s}: ma ⟨E⟩ ${multiSol.expectation} 不得超过 layer ${layerSol.expectation}`,
        );
      }
    }
  });

  it('展开位级等价（单元）：全等 β 的逐 qubit 混合 == 全局混合', () => {
    const nqubits = 6;
    const rng = mulberry32(5);
    const energies = new Float64Array(1 << nqubits);
    for (let k = 0; k < energies.length; k++) energies[k] = rng() * 3;
    const beta = 0.37;
    const a = new QuantumStateVector(nqubits);
    a.setUniformSuperposition();
    a.applyCostPhase(0.5, energies);
    a.applyMixer(beta);
    const b = new QuantumStateVector(nqubits);
    b.setUniformSuperposition();
    b.applyCostPhase(0.5, energies);
    b.applyMixerAngles(new Array<number>(nqubits).fill(beta));
    assert.deepEqual(Array.from(b.re), Array.from(a.re));
    assert.deepEqual(Array.from(b.im), Array.from(a.im));
  });
});

describe('ma-QAOA · 接入与不变量', () => {
  it('默认与 angleMode:"layer" 位级一致', () => {
    const problem = coupledProblem(mulberry32(11), 3, 3, 0.15);
    const a = qaoaSolve(problem, { layers: 2, seed: 42 });
    const b = qaoaSolve(problem, { layers: 2, seed: 42, angleMode: 'layer' });
    assert.deepEqual(a, b);
  });

  it('multi 确定性：同种子两次调用逐位一致', () => {
    const problem = coupledProblem(mulberry32(22), 3, 3, 0.15);
    const a = qaoaSolve(problem, { layers: 1, seed: 42, angleMode: 'multi' });
    const b = qaoaSolve(problem, { layers: 1, seed: 42, angleMode: 'multi' });
    assert.deepEqual(a, b);
  });

  it('multi 角度布局：长度 = p + p·nqubits，γ 段在界内', () => {
    const problem = coupledProblem(mulberry32(33), 3, 4, 0.15);
    const sol = qaoaSolve(problem, { layers: 2, seed: 42, angleMode: 'multi' });
    const nqubits = 12;
    assert.equal(sol.angles!.length, 2 + 2 * nqubits);
    assert.ok(sol.angles!.every((x) => x >= 0 && x <= Math.PI + 1e-12));
  });

  it('非法 angleMode 被拒绝', () => {
    const problem = coupledProblem(mulberry32(1), 2, 2, 0);
    assert.throws(() => qaoaSolve(problem, { angleMode: 'per-task' as never }), /angleMode/);
  });

  it('子空间：默认位级一致；multi 期望支配 + 分配合法', () => {
    const problem = coupledProblem(mulberry32(55), 3, 4, 0.1);
    const model = buildSubspaceModel(problem);
    assert.ok(model);
    const a = qaoaSolveSubspace(model, { seed: 42 });
    const b = qaoaSolveSubspace(model, { seed: 42, angleMode: 'layer' });
    assert.deepEqual(a, b);
    const layerSol = qaoaSolveSubspace(model, { seed: 42, layers: 2 });
    const multiSol = qaoaSolveSubspace(model, { seed: 42, layers: 2, angleMode: 'multi' });
    assert.ok(
      multiSol.expectation <= layerSol.expectation + 1e-9,
      `子空间 ma ⟨E⟩ ${multiSol.expectation} ≤ layer ${layerSol.expectation}`,
    );
    assert.ok(multiSol.assignment.every((x) => x >= 0));
  });

  it('multi + CVaR 组合：确定性 + 分配合法 + 期望在能量谱内', () => {
    const problem = coupledProblem(mulberry32(77), 3, 3, 0.15);
    const opts = { layers: 1, seed: 42, angleMode: 'multi' as const, cvarAlpha: 0.1 };
    const a = qaoaSolve(problem, opts);
    const b = qaoaSolve(problem, opts);
    assert.deepEqual(a, b);
    const info = computeEnergies(problem);
    assert.ok(a.expectation >= info.min - 1e-6 && a.expectation <= info.max + 1e-6);
    assert.ok(a.welfare <= bruteForceOptimum(problem).welfare + 1e-9);
  });
});

describe('ma-QAOA · 诚实基准', () => {
  /** 子空间变分 regime 是 ma 的真实增益区：逐任务混合角正是约束子空间
   * 需要的表达力（实测 6×6：p=1 命中 17→29/40、p=2 命中 27→35/40，
   * 差距约减半，配对 19:5 / 13:5）。全空间坍缩读数已饱和，增益边际
   * ——见文件头注释与 QUANTUM-SCHEDULING.md 七⅞。 */
  function subspaceBattery(m: number, n: number, layers: number, seeds: number) {
    let layerGap = 0;
    let multiGap = 0;
    let layerHits = 0;
    let multiHits = 0;
    let multiWins = 0;
    let layerWins = 0;
    for (let i = 0; i < seeds; i++) {
      const rng = mulberry32(7000 + i * 13);
      const problem = coupledProblem(rng, m, n, 0.15);
      const model = buildSubspaceModel(problem);
      assert.ok(model, `${m}×${n} 实例应有子空间模型`);
      const optimal = model.optimalWelfare;
      const gapOf = (mode: 'layer' | 'multi'): number => {
        const sol = qaoaSolveSubspace(model, {
          layers,
          seed: 42,
          angleMode: mode,
          select: 'shots-best',
          shots: 256,
        });
        return Math.max(0, (optimal - sol.welfare) / (Math.abs(optimal) + 1e-9));
      };
      const gl = gapOf('layer');
      const gm = gapOf('multi');
      layerGap += gl;
      multiGap += gm;
      if (gl < 1e-9) layerHits++;
      if (gm < 1e-9) multiHits++;
      if (gm < gl - 1e-12) multiWins++;
      else if (gm > gl + 1e-12) layerWins++;
    }
    return {
      layerGap: layerGap / seeds,
      multiGap: multiGap / seeds,
      layerHits,
      multiHits,
      multiWins,
      layerWins,
    };
  }

  it('子空间 6×6 p=1：命中率与平均差距大幅改善，配对占优', () => {
    const r = subspaceBattery(6, 6, 1, 40);
    assert.ok(r.multiHits > r.layerHits, `命中 ${r.multiHits} 应 > ${r.layerHits}`);
    assert.ok(
      r.multiGap < r.layerGap * 0.7,
      `差距应降 ≥30%：${r.multiGap.toFixed(4)} vs ${r.layerGap.toFixed(4)}`,
    );
    assert.ok(r.multiWins > r.layerWins, `配对 ${r.multiWins}:${r.layerWins} 应占优`);
  });

  it('子空间 6×6 p=2：同向（增益随结构稳健）', () => {
    const r = subspaceBattery(6, 6, 2, 40);
    assert.ok(r.multiHits > r.layerHits, `命中 ${r.multiHits} 应 > ${r.layerHits}`);
    assert.ok(r.multiGap < r.layerGap, `差距 ${r.multiGap.toFixed(4)} < ${r.layerGap.toFixed(4)}`);
  });

  it('全空间 p=1：standalone multi 对 welfare 无退步（坍缩不继承单调性，实测整体不劣）', () => {
    let worse = 0;
    for (let i = 0; i < 40; i++) {
      const rng = mulberry32(9000 + i * 17);
      const problem = coupledProblem(rng, 3, 4, 0.15);
      const optimal = bruteForceOptimum(problem).welfare;
      const gapOf = (mode: 'layer' | 'multi'): number => {
        const sol = qaoaSolve(problem, { layers: 1, seed: 42, angleMode: mode });
        return Math.max(0, (optimal - sol.welfare) / (Math.abs(optimal) + 1e-9));
      };
      if (gapOf('multi') > gapOf('layer') + 1e-12) worse++;
    }
    assert.ok(worse <= 6, `整体不劣：40 实例中劣化 ${worse} 个（应 ≤6）`);
  });

  it('全空间 p=1：multi+CVaR 组合相对 layer 不劣（优势温和且依实例分布，不宣称大幅增益）', () => {
    let layerGap = 0;
    let comboGap = 0;
    for (let i = 0; i < 60; i++) {
      const rng = mulberry32(9000 + i * 17);
      const problem = coupledProblem(rng, 3, 4, 0.15);
      const optimal = bruteForceOptimum(problem).welfare;
      const gapOf = (opts: Record<string, unknown>): number => {
        const sol = qaoaSolve(problem, { layers: 1, seed: 42, ...opts });
        return Math.max(0, (optimal - sol.welfare) / (Math.abs(optimal) + 1e-9));
      };
      layerGap += gapOf({ angleMode: 'layer' });
      comboGap += gapOf({ angleMode: 'multi', cvarAlpha: 0.1 });
    }
    assert.ok(
      comboGap <= layerGap * 1.05,
      `组合不应显著劣于 layer：${(comboGap / 60).toFixed(4)} vs ${(layerGap / 60).toFixed(4)}`,
    );
  });
});
