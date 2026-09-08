/**
 * 单源化孪生收敛的位同构对拍（FACE C）
 *
 * 四组孪生（src/core 内重复实现的同一数学约定）收敛到单一导出：
 *   G1 ma-QAOA 角度展开   expandToMultiAngles（quantum-optimizer）
 *                         ≡ expandToMultiAnglesSubspace（subspace-optimizer）
 *                         → solver-common.expandLayerAnglesToMulti
 *   G2 耦合键解码         Math.floor(key/nq)/key%nq 五处内联
 *                         → quantum-optimizer.decodeCouplingKey
 *   G3 贪心填充           repairAssignment 兜底阶段（quantum-optimizer）
 *                         ≡ greedyStart（classical-baselines）
 *                         → quantum-optimizer.greedyAssignRemaining
 *   G4 概率 argmax        collapseSubspace 的 shots-best 回退与
 *                         argmax-valid 两份相同循环
 *                         → solver-common.argmaxProbabilityIndex
 *
 * 对拍纪律：每组的「单源导出 vs 字面构造见证」用独立重写的循环对拍
 * （见证保留在测试里，永不收敛）；引擎级对拍用导出原语重建整条
 * multi 求解管线，与引擎私有路径的输出逐位比对。收敛前先落地并跑绿
 * （证明单源 ≡ 原内联副本），收敛后保留（防回归）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  couplingKey,
  decodeCouplingKey,
  computeEnergies,
  decodeAssignment,
  isValidAssignment,
  welfareOf,
  greedyAssignRemaining,
  QuantumStateVector,
  qaoaSolve,
  type AssignmentProblem,
} from '../src/core/quantum-optimizer.js';
import {
  argmaxProbabilityIndex,
  denormalizeExpectation,
  expandLayerAnglesToMulti,
  expectationValueInto,
  minMaxOf,
  normalizedEnergies,
  optimizeAnglesByCoordinateDescent,
  optimizeAnglesByCoordinateDescentSeeded,
} from '../src/core/solver-common.js';
import { BETA_BOUND, GAMMA_BOUND } from '../src/core/constants.js';
import { hungarianAssignment, localSearchAssignment } from '../src/core/classical-baselines.js';
import {
  buildSubspaceModel,
  qaoaSolveSubspace,
  SubspaceState,
} from '../src/core/subspace-optimizer.js';
import { mulberry32 } from '../src/utils/rng.js';

// ----------------------------------------------------------------------------
// 随机问题生成（确定性种子；耦合密度与资格掩码覆盖收敛面的分支）
// ----------------------------------------------------------------------------

function coupledProblem(
  rng: () => number,
  m: number,
  n: number,
  density: number,
): AssignmentProblem {
  const weights = Array.from({ length: m }, () => Array.from({ length: n }, () => rng() * 2 - 0.4));
  const ineligible = Array.from({ length: m }, () => Array.from({ length: n }, () => rng() < 0.1));
  // 恒可行保证：清除恒等匹配上的资格掩码
  for (let t = 0; t < Math.min(m, n); t++) ineligible[t]![t] = false;
  const nq = m * n;
  const couplings = new Map<number, number>();
  for (let t1 = 0; t1 < m; t1++) {
    for (let t2 = t1 + 1; t2 < m; t2++) {
      for (let a1 = 0; a1 < n; a1++) {
        for (let a2 = 0; a2 < n; a2++) {
          if (a1 === a2) continue;
          if (rng() < density)
            couplings.set(couplingKey(t1 * n + a1, t2 * n + a2, nq), rng() * 1.6 - 0.8);
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

// ----------------------------------------------------------------------------
// G1 · ma-QAOA 角度展开
// ----------------------------------------------------------------------------

describe('G1 角度展开单源 · expandLayerAnglesToMulti', () => {
  it('公式对拍：单源导出 ≡ 字面构造见证（随机化，含边界 layers=1/目标=1）', () => {
    const rng = mulberry32(7001);
    for (let trial = 0; trial < 200; trial++) {
      const layers = 1 + Math.floor(rng() * 4);
      const targets = trial % 7 === 0 ? 1 : 1 + Math.floor(rng() * 12);
      const layerAngles: number[] = [];
      for (let p = 0; p < layers; p++) layerAngles.push(rng() * Math.PI);
      for (let p = 0; p < layers; p++) layerAngles.push(rng() * Math.PI * 0.5);
      // 字面见证：两引擎原内联副本的逐语句重写（此处是独立见证，永不收敛）
      const witness: number[] = layerAngles.slice(0, layers);
      for (let p = 0; p < layers; p++) {
        const beta = layerAngles[layers + p]!;
        for (let q = 0; q < targets; q++) witness.push(beta);
      }
      assert.deepEqual(
        expandLayerAnglesToMulti(layerAngles, layers, targets),
        witness,
        `trial=${trial} layers=${layers} targets=${targets}`,
      );
    }
  });

  it('布局契约：长度 = layers + layers·targets，γ 段原样、β 段按层复制', () => {
    const out = expandLayerAnglesToMulti([0.1, 0.2, 0.3, 0.4], 2, 3);
    assert.deepEqual(out, [0.1, 0.2, 0.3, 0.3, 0.3, 0.4, 0.4, 0.4]);
  });

  it('物理锚：展开角喂 multi 电路 ≡ layer 角喂 layer 电路（末态逐位相等）', () => {
    const nqubits = 6;
    const rng = mulberry32(5);
    const energies = new Float64Array(1 << nqubits);
    for (let k = 0; k < energies.length; k++) energies[k] = rng() * 3;
    const layerAngles = [0.4, 0.9, 0.21, 0.17];
    const a = new QuantumStateVector(nqubits);
    a.setUniformSuperposition();
    for (let p = 0; p < 2; p++) {
      a.applyCostPhase(layerAngles[p]!, energies);
      a.applyMixer(layerAngles[2 + p]!);
    }
    const b = new QuantumStateVector(nqubits);
    b.setUniformSuperposition();
    const multi = expandLayerAnglesToMulti(layerAngles, 2, nqubits);
    for (let p = 0; p < 2; p++) {
      b.applyCostPhase(multi[p]!, energies);
      b.applyMixerAngles(multi.slice(2 + p * nqubits, 2 + (p + 1) * nqubits));
    }
    // Object.is 区分 ±0：严格的位级相等
    for (let k = 0; k < a.dim; k++) {
      assert.ok(Object.is(a.re[k], b.re[k]), `re[${k}]`);
      assert.ok(Object.is(a.im[k], b.im[k]), `im[${k}]`);
    }
  });
});

// ----------------------------------------------------------------------------
// G1 · 引擎级对拍：用导出原语独立重建 multi 求解管线，与引擎输出逐位比对
// ----------------------------------------------------------------------------

describe('G1 引擎级对拍 · 全空间 multi 路径', () => {
  it('qaoaSolve(angleMode:"multi") ≡ 测试重建管线（角度/评估数/期望逐位一致）', () => {
    const layers = 2;
    const restarts = 2;
    const seed = 1234;
    const problem = coupledProblem(mulberry32(99), 3, 3, 0.2);
    const solution = qaoaSolve(problem, {
      layers,
      restarts,
      seed,
      angleMode: 'multi',
      select: 'argmax-valid',
      shots: 16,
      topK: 3,
    });

    // ---- 测试侧重建（全部使用导出原语 + 字面展开见证）----
    const rng = mulberry32(seed);
    const info = computeEnergies(problem);
    const normalized = normalizedEnergies(info.energies, info.min, info.max, 1);
    const nq = info.nqubits;

    const layer = optimizeAnglesByCoordinateDescent(
      (angles) => {
        const state = new QuantumStateVector(nq);
        state.setUniformSuperposition();
        for (let p = 0; p < layers; p++) {
          state.applyCostPhase(angles[p]!, normalized);
          state.applyMixer(angles[layers + p]!);
        }
        return expectationValueInto(state, normalized);
      },
      layers,
      restarts,
      rng,
    );

    const seedAngles = expandLayerAnglesToMulti(layer.angles, layers, nq);
    const angleCount = layers + layers * nq;
    const bounds: number[] = Array.from({ length: angleCount }, (_, i) =>
      i < layers ? GAMMA_BOUND : BETA_BOUND,
    );
    const refined = optimizeAnglesByCoordinateDescentSeeded(
      (angles) => {
        const state = new QuantumStateVector(nq);
        state.setUniformSuperposition();
        for (let p = 0; p < layers; p++) {
          state.applyCostPhase(angles[p]!, normalized);
          const betas: number[] = new Array<number>(nq);
          for (let q = 0; q < nq; q++) betas[q] = angles[layers + p * nq + q]!;
          state.applyMixerAngles(betas);
        }
        return expectationValueInto(state, normalized);
      },
      angleCount,
      bounds,
      restarts,
      rng,
      seedAngles,
    );

    const finalState = new QuantumStateVector(nq);
    finalState.setUniformSuperposition();
    for (let p = 0; p < layers; p++) {
      finalState.applyCostPhase(refined.angles[p]!, normalized);
      const betas: number[] = new Array<number>(nq);
      for (let q = 0; q < nq; q++) betas[q] = refined.angles[layers + p * nq + q]!;
      finalState.applyMixerAngles(betas);
    }
    const rawExpectation = denormalizeExpectation(
      expectationValueInto(finalState, normalized),
      1,
      info.min,
      info.max,
    );

    assert.deepEqual(solution.angles, refined.angles);
    assert.equal(solution.evaluations, refined.evaluations + layer.evaluations);
    assert.ok(Object.is(solution.expectation, rawExpectation));
  });
});

describe('G1 引擎级对拍 · 子空间 multi 路径', () => {
  it('qaoaSolveSubspace(angleMode:"multi") ≡ 测试重建管线（角度/评估数/期望逐位一致）', () => {
    const layers = 2;
    const restarts = 2;
    const seed = 4321;
    const problem = coupledProblem(mulberry32(77), 3, 4, 0.15);
    const model = buildSubspaceModel(problem)!;
    assert.ok(model, 'm ≤ n 的恒可行问题必能建模');
    const solution = qaoaSolveSubspace(model, {
      layers,
      restarts,
      seed,
      angleMode: 'multi',
      select: 'argmax-valid',
      shots: 16,
      topK: 3,
    });

    // ---- 测试侧重建 ----
    const rng = mulberry32(seed);
    const { min, max } = minMaxOf(model.energies);
    const energies = normalizedEnergies(model.energies, min, max, 1);
    const G = model.mixers.length;

    const runCircuitMulti = (angles: number[]): SubspaceState => {
      const state = new SubspaceState(model.dimension);
      state.setUniform();
      for (let p = 0; p < layers; p++) {
        state.applyCostPhase(angles[p]!, energies);
        for (let g = 0; g < G; g++) {
          state.applyFiberMixer(model.mixers[g]!, angles[layers + p * G + g]!);
        }
      }
      return state;
    };

    const layer = optimizeAnglesByCoordinateDescent(
      (angles) => {
        const state = new SubspaceState(model.dimension);
        state.setUniform();
        for (let p = 0; p < layers; p++) {
          state.applyCostPhase(angles[p]!, energies);
          for (const group of model.mixers) {
            state.applyFiberMixer(group, angles[layers + p]!);
          }
        }
        return expectationValueInto(state, energies);
      },
      layers,
      restarts,
      rng,
    );

    const seedAngles = expandLayerAnglesToMulti(layer.angles, layers, G);
    const angleCount = layers + layers * G;
    const bounds: number[] = Array.from({ length: angleCount }, (_, i) =>
      i < layers ? GAMMA_BOUND : BETA_BOUND,
    );
    const refined = optimizeAnglesByCoordinateDescentSeeded(
      (angles) => expectationValueInto(runCircuitMulti(angles), energies),
      angleCount,
      bounds,
      restarts,
      rng,
      seedAngles,
    );

    const rawExpectation = denormalizeExpectation(
      expectationValueInto(runCircuitMulti(refined.angles), energies),
      1,
      min,
      max,
    );

    assert.deepEqual(solution.angles, refined.angles);
    assert.equal(solution.evaluations, refined.evaluations + layer.evaluations);
    assert.ok(Object.is(solution.expectation, rawExpectation));
  });
});

// ----------------------------------------------------------------------------
// G2 · 耦合键解码
// ----------------------------------------------------------------------------

describe('G2 耦合键解码单源 · decodeCouplingKey', () => {
  it('编码-解码往返 + 公式对拍：decode(couplingKey) ≡ 归一化 (lo, hi) ≡ 字面公式', () => {
    const rng = mulberry32(7002);
    for (let trial = 0; trial < 500; trial++) {
      const nqubits = 2 + Math.floor(rng() * 20);
      const q1 = Math.floor(rng() * nqubits);
      let q2 = Math.floor(rng() * nqubits);
      if (q1 === q2) q2 = (q2 + 1) % nqubits;
      const key = couplingKey(q1, q2, nqubits);
      const decoded = decodeCouplingKey(key, nqubits);
      // 编码侧契约：归一化 lo < hi
      assert.deepEqual(decoded, { q1: Math.min(q1, q2), q2: Math.max(q1, q2) });
      // 字面公式见证（原五处内联副本的重写）
      assert.equal(decoded.q1, Math.floor(key / nqubits));
      assert.equal(decoded.q2, key % nqubits);
    }
  });

  it('双路径位同构：computeEnergies（解码点A）× welfareOf（解码点B）合法基态逐位一致', () => {
    for (let s = 0; s < 5; s++) {
      const problem = coupledProblem(mulberry32(8000 + s), 3, 4, 0.25);
      const m = problem.taskIds.length;
      const n = problem.agentIds.length;
      const { energies, dim } = computeEnergies(problem);
      let checked = 0;
      for (let k = 0; k < dim; k++) {
        const assignment = decodeAssignment(k, m, n);
        if (!isValidAssignment(problem, assignment)) continue;
        // 合法基态罚项为 0：energy === -welfare，且两条路径的加法序一致 → 逐位相等
        assert.ok(
          Object.is(energies[k], -welfareOf(problem, assignment)),
          `seed=${s} state=${k}: energies ${energies[k]} !== -welfareOf ${-welfareOf(problem, assignment)}`,
        );
        checked++;
      }
      assert.ok(checked > 0, '恒可行生成器应存在合法基态');
    }
  });

  it('第三路径位同构：buildSubspaceModel（解码点E）能量表 × welfareOf 逐位一致', () => {
    for (let s = 0; s < 5; s++) {
      const problem = coupledProblem(mulberry32(9000 + s), 3, 4, 0.25);
      const model = buildSubspaceModel(problem)!;
      const m = problem.taskIds.length;
      for (let st = 0; st < model.dimension; st++) {
        const assignment: number[] = [];
        for (let t = 0; t < m; t++) assignment.push(model.assignmentAt[st * m + t]!);
        assert.ok(
          Object.is(model.energies[st], -welfareOf(problem, assignment)),
          `seed=${s} state=${st}`,
        );
      }
    }
  });
});

// ----------------------------------------------------------------------------
// G3 · 贪心填充
// ----------------------------------------------------------------------------

describe('G3 贪心填充单源 · greedyAssignRemaining', () => {
  it('公式对拍：单源导出 ≡ 字面贪心循环见证（随机化，含并列与资格掩码）', () => {
    const rng = mulberry32(7003);
    for (let trial = 0; trial < 200; trial++) {
      const m = 1 + Math.floor(rng() * 5);
      const n = m + Math.floor(rng() * 4);
      const problem = coupledProblem(mulberry32(10_000 + trial), m, n, rng() < 0.5 ? 0.3 : 0);
      // 字面见证：greedyStart 原循环的逐语句重写
      const witnessUsed = new Set<number>();
      const witness = new Array<number>(m).fill(-1);
      for (let t = 0; t < m; t++) {
        let best = -1;
        let bestW = -Infinity;
        for (let a = 0; a < n; a++) {
          if (problem.ineligible[t]![a]! || witnessUsed.has(a)) continue;
          if (problem.weights[t]![a]! > bestW) {
            bestW = problem.weights[t]![a]!;
            best = a;
          }
        }
        if (best >= 0) {
          witness[t] = best;
          witnessUsed.add(best);
        }
      }
      const got = new Array<number>(m).fill(-1);
      const gotUsed = new Set<number>();
      greedyAssignRemaining(problem, got, gotUsed);
      assert.deepEqual(got, witness, `trial=${trial}`);
      assert.deepEqual(
        [...gotUsed].sort((x, y) => x - y),
        [...witnessUsed].sort((x, y) => x - y),
      );
    }
  });

  it('保留语义：已分配槽位（≥0）不被覆盖，used 中的 agent 不被抢占', () => {
    const problem = coupledProblem(mulberry32(7004), 4, 5, 0.2);
    const assignment = [2, -1, 4, -1];
    const used = new Set<number>([2, 4]);
    greedyAssignRemaining(problem, assignment, used);
    assert.equal(assignment[0], 2);
    assert.equal(assignment[2], 4);
    assert.ok(used.has(2) && used.has(4));
    for (let t = 1; t < 4; t += 2) {
      if (assignment[t]! >= 0) assert.ok(!problem.ineligible[t]![assignment[t]!]!);
    }
  });

  it('独立算法互证：贪心可证最优的对角占优实例上 ≡ 匈牙利精确解', () => {
    for (let s = 0; s < 5; s++) {
      const m = 4;
      const n = 5;
      const weights = Array.from({ length: m }, (_, t) =>
        Array.from({ length: n }, (_, a) => (a === t ? 10 : 1)),
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
      const greedy = new Array<number>(m).fill(-1);
      greedyAssignRemaining(problem, greedy, new Set<number>());
      assert.deepEqual(greedy, hungarianAssignment(problem.weights, problem.ineligible));
    }
  });

  it('收敛后回归锚：局部搜索（贪心种子驱动）仍合法且不劣于贪心', () => {
    for (let s = 0; s < 5; s++) {
      const problem = coupledProblem(mulberry32(11_000 + s), 4, 6, 0.3);
      const greedy = new Array<number>(problem.taskIds.length).fill(-1);
      greedyAssignRemaining(problem, greedy, new Set<number>());
      const greedyW = welfareOf(problem, greedy);
      const ls = localSearchAssignment(problem);
      assert.ok(ls.every((a, t) => a < 0 || !problem.ineligible[t]![a]!));
      assert.ok(welfareOf(problem, ls) >= greedyW - 1e-12);
    }
  });
});

// ----------------------------------------------------------------------------
// G4 · 概率 argmax
// ----------------------------------------------------------------------------

describe('G4 概率 argmax 单源 · argmaxProbabilityIndex', () => {
  it('公式对拍：单源导出 ≡ 字面循环见证（含并列/零/全零/空数组）', () => {
    const rng = mulberry32(7005);
    for (let trial = 0; trial < 300; trial++) {
      const len = trial % 50 === 0 ? 0 : trial % 50 === 1 ? 1 : 1 + Math.floor(rng() * 64);
      const probs = new Float64Array(len);
      for (let k = 0; k < len; k++) probs[k] = rng() < 0.2 ? 0 : rng();
      // 字面见证：collapseSubspace 原两份循环的逐语句重写
      let witness = -1;
      let bestProb = -1;
      for (let s = 0; s < probs.length; s++) {
        if (probs[s]! > bestProb) {
          bestProb = probs[s]!;
          witness = s;
        }
      }
      assert.equal(argmaxProbabilityIndex(probs), witness, `trial=${trial} len=${len}`);
    }
    // 并列取最小索引（严格大于才替换）
    assert.equal(argmaxProbabilityIndex(Float64Array.from([0.5, 0.9, 0.9, 0.2])), 1);
    // 全零分布：0 > -1 成立 → 返回 0（零概率态可被选中的契约）
    assert.equal(argmaxProbabilityIndex(new Float64Array(4)), 0);
    // 空数组：-1（下游兜底）
    assert.equal(argmaxProbabilityIndex(new Float64Array(0)), -1);
  });
});
