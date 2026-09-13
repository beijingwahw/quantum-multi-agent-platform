/**
 * R14-A 创新 1 测试：纠缠感知批组成（entanglement-batch-composer）。
 *
 * 钉板内容：
 * ① 基线切片 = 引擎现行语义（输入序连续切块，零移动）；
 * ② 耦合势口径与 buildBatchProblem 耦合项同值（手算对拍）；
 * ③ 零遗憾性质：局部搜索结果 capturedMass ≥ 基线（200 随机实例），
 *    且划分不变量（全任务恰出现一次、批大小 ≤ 上限）恒成立；
 * ④ 确定性：同输入重跑逐字段一致；
 * ⑤ 构造实例上找到基线丢失的跨批耦合（局部搜索真实改进）；
 * ⑥ 端到端：用真实子空间引擎按批求解，组批后的福利和 > 切片切片的
 *    福利和，差额恰为被找回的耦合加成——缺口在求解层面可兑现；
 * ⑦ 负对照：非法输入逐项具名拒绝。
 * R17-C 追加：无耦合快速路径基础钉板（strategy/massEvaluations/零搜索），
 * 完整验收套件（含 200 实例零遗憾钉板与独立 oracle 交叉核对）见
 * tests/r17c-entanglement-batch-composer-fast-path.test.ts。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeBatches,
  type ComposerTask,
  type EntangledAgentPair,
} from '../src/core/entanglement-batch-composer.js';
import { MechanismError } from '../src/utils/errors.js';
import { mulberry32 } from '../src/utils/rng.js';
import {
  couplingKey,
  defaultPenalties,
  type AssignmentProblem,
} from '../src/core/quantum-optimizer.js';
import { annealSolveSubspace, buildSubspaceModel } from '../src/core/subspace-optimizer.js';

const PAIR_01: EntangledAgentPair[] = [{ a: 0, b: 1 }];

function task(id: string, priorityWeight: number, eligibleAgents: readonly number[]): ComposerTask {
  return { id, priorityWeight, eligibleAgents };
}

describe('R14-A · 批组成基线与耦合势口径', () => {
  it('improve:false = 引擎现行切片：输入序连续切块、零移动', () => {
    const tasks = [
      task('t1', 1, [0, 1]),
      task('t2', 1, [0, 1]),
      task('t3', 0.25, [2]),
      task('t4', 0.5, [0, 1, 2]),
      task('t5', 0.25, [0, 1]),
    ];
    const r = composeBatches(tasks, {
      entangledAgentPairs: PAIR_01,
      agentCount: 3,
      maxBatchSize: 2,
      improve: false,
    });
    assert.deepEqual(r.batches, [['t1', 't2'], ['t3', 't4'], ['t5']]);
    assert.equal(r.movesApplied, 0);
    assert.equal(r.strategy, 'baseline');
    // 手算（缺省 bonus=0.15）：批内对只有 (t1,t2)=0.15·min(1,1)；
    // (t3,t4)=0（t3 只能上 agent2，纠缠对不可达）；其余对全部跨批
    assert.ok(Math.abs(r.capturedMass - 0.15) < 1e-12, `captured=${r.capturedMass}`);
  });

  it('耦合势手算：跨优先级对 = bonus·min(pw)，资格方向对称成立', () => {
    // t1 只能上 a0、t2 只能上 a1，纠缠对 (0,1) → 势存在（方向 t1→0,t2→1）
    const one = composeBatches([task('x', 1, [0]), task('y', 1, [1])], {
      entangledAgentPairs: PAIR_01,
      agentCount: 3,
      maxBatchSize: 2,
      improve: false,
    });
    assert.ok(Math.abs(one.capturedMass - 0.15) < 1e-12);

    // 反方向资格（x→1、y→0）同样成立
    const flipped = composeBatches([task('x', 1, [1]), task('y', 0.25, [0])], {
      entangledAgentPairs: PAIR_01,
      agentCount: 3,
      maxBatchSize: 2,
      improve: false,
    });
    assert.ok(Math.abs(flipped.capturedMass - 0.15 * 0.25) < 1e-12);

    // 无共同纠缠可达性（第三任务只上 agent2）→ 势为 0
    const none = composeBatches([task('x', 1, [0, 1]), task('y', 1, [2])], {
      entangledAgentPairs: PAIR_01,
      agentCount: 3,
      maxBatchSize: 2,
      improve: false,
    });
    assert.equal(none.capturedMass, 0);
    assert.equal(none.totalMass, 0);
  });

  it('无纠缠对时 improved 与 baseline 完全一致（零改进空间）', () => {
    const tasks = [task('a', 1, [0]), task('b', 0.5, [1]), task('c', 0.25, [0, 1])];
    const base = composeBatches(tasks, {
      entangledAgentPairs: [],
      agentCount: 2,
      maxBatchSize: 2,
      improve: false,
    });
    const improved = composeBatches(tasks, {
      entangledAgentPairs: [],
      agentCount: 2,
      maxBatchSize: 2,
    });
    assert.deepEqual(improved.batches, base.batches);
    assert.equal(improved.capturedMass, 0);
    assert.equal(improved.movesApplied, 0);
  });
});

describe('R14-A · 零遗憾性质与确定性（随机实例）', () => {
  it('improved.capturedMass ≥ baseline.capturedMass，划分不变量恒成立（200 实例）', () => {
    const rng = mulberry32(20260914);
    for (let inst = 0; inst < 200; inst++) {
      const taskCount = 3 + Math.floor(rng() * 10);
      const agentCount = 2 + Math.floor(rng() * 5);
      const tasks: ComposerTask[] = [];
      for (let t = 0; t < taskCount; t++) {
        const eligible: number[] = [];
        for (let a = 0; a < agentCount; a++) if (rng() < 0.6) eligible.push(a);
        if (eligible.length === 0) eligible.push(Math.floor(rng() * agentCount));
        const pw = [1, 0.75, 0.5, 0.25][Math.floor(rng() * 4)]!;
        tasks.push(task(`t${t}`, pw, eligible));
      }
      const pairs: EntangledAgentPair[] = [];
      for (let a = 0; a < agentCount; a++) {
        for (let b = a + 1; b < agentCount; b++) if (rng() < 0.5) pairs.push({ a, b });
      }
      const maxBatchSize = 1 + Math.floor(rng() * 4);
      const bonus = rng() < 0.5 ? 0.15 : 0.35;
      const opts = {
        entangledAgentPairs: pairs,
        agentCount,
        maxBatchSize,
        entanglementBonus: bonus,
      };
      const baseline = composeBatches(tasks, { ...opts, improve: false });
      const improved = composeBatches(tasks, opts);

      assert.ok(
        improved.capturedMass >= baseline.capturedMass - 1e-12,
        `实例${inst}：improved(${improved.capturedMass}) < baseline(${baseline.capturedMass})——零遗憾破裂`,
      );
      assert.equal(improved.totalMass, baseline.totalMass, '总质量口径必须一致');
      // 划分不变量：全任务恰出现一次，批大小不超上限
      const flat = improved.batches.flat().sort();
      assert.deepEqual(flat, tasks.map((t) => t.id).sort(), `实例${inst}：划分不是排列`);
      for (const b of improved.batches) {
        assert.ok(
          b.length >= 1 && b.length <= maxBatchSize,
          `实例${inst}：批大小 ${b.length} 越界`,
        );
      }
      assert.ok(improved.movesApplied >= 0);
    }
  });

  it('确定性：同输入重跑逐字段一致（含 movesApplied）', () => {
    const tasks = [task('a', 1, [0, 1]), task('b', 1, [0, 1]), task('c', 0.25, [0, 1])];
    const opts = {
      entangledAgentPairs: PAIR_01,
      agentCount: 3,
      maxBatchSize: 2,
      entanglementBonus: 0.35,
    };
    assert.deepEqual(composeBatches(tasks, opts), composeBatches(tasks, opts));
  });
});

describe('R14-A · 构造实例：找回基线丢弃的跨批耦合', () => {
  /** A/B 关键任务可上纠缠对 (a0,a1)；C 只能上 a2 → 优先级切片把 A,C 切开 */
  function fixtureTasks(): ComposerTask[] {
    return [task('A', 1, [0, 1, 2]), task('B', 1, [2]), task('C', 0.25, [0, 1, 2])];
  }
  const opts = {
    entangledAgentPairs: PAIR_01,
    agentCount: 3,
    maxBatchSize: 2,
    entanglementBonus: 0.35,
  };

  it('基线 [A,B],[C] 丢失 mass(A,C)；局部搜索移动 A 使 {A,C} 同批', () => {
    const baseline = composeBatches(fixtureTasks(), { ...opts, improve: false });
    assert.equal(baseline.capturedMass, 0, '基线把 A,C 切到不同批：耦合势全丢');
    assert.equal(baseline.totalMass > 0, true);

    const improved = composeBatches(fixtureTasks(), opts);
    assert.ok(improved.capturedMass > 1e-12, '改进后必须捕获正耦合势');
    assert.ok(Math.abs(improved.capturedMass - 0.35 * 0.25) < 1e-12);
    assert.ok(improved.movesApplied >= 1);
    const together = improved.batches.find((b) => b.includes('A') && b.includes('C'));
    assert.ok(together, `A 与 C 必须同批（实际 ${JSON.stringify(improved.batches)}）`);
  });

  it('端到端：真实子空间引擎按批求解，组批福利和 > 切片福利和，差额=被找回的耦合加成', () => {
    // 与 buildBatchProblem 同口径构造每批的 AssignmentProblem：
    // 耦合项 = bonus·min(pw)，方向 (a1=0,a2=1) 与 (1,0) 都入表
    const weights: Record<string, number[]> = {
      A: [0.5, 0.5, 0.1],
      B: [0.01, 0.01, 0.4],
      C: [0.3, 0.3, 0.2],
    };
    const ineligible: Record<string, boolean[]> = {
      A: [false, false, false],
      B: [true, true, false], // B 只能上 a2
      C: [false, false, false],
    };
    const pw: Record<string, number> = { A: 1, B: 1, C: 0.25 };

    const solveBatches = (batches: string[][]): number => {
      let total = 0;
      for (const batch of batches) {
        const m = batch.length;
        const n = 3;
        const problem: AssignmentProblem = {
          taskIds: batch,
          agentIds: ['a0', 'a1', 'a2'],
          weights: batch.map((id) => weights[id]!),
          ineligible: batch.map((id) => ineligible[id]!),
          couplings: new Map<number, number>(),
          penaltyOneHot: 0,
          penaltyCapacity: 0,
        };
        const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
          [0, 1],
          [1, 0],
        ];
        for (let i = 0; i < m; i++) {
          for (let j = i + 1; j < m; j++) {
            const pwMin = Math.min(pw[batch[i]!]!, pw[batch[j]!]!);
            for (const [a1, a2] of DIRECTIONS) {
              if (!ineligible[batch[i]!]![a1] && !ineligible[batch[j]!]![a2]) {
                problem.couplings.set(couplingKey(i * n + a1, j * n + a2, m * n), 0.35 * pwMin);
              }
            }
          }
        }
        const pen = defaultPenalties(problem);
        problem.penaltyOneHot = pen.oneHot;
        problem.penaltyCapacity = pen.capacity;

        const model = buildSubspaceModel(problem);
        assert.ok(model, `批 ${batch.join('+')} 必须可建模（m ≤ n）`);
        const sol = annealSolveSubspace(model, { seed: 42 });
        // 小维度（≤P(3,2)=6）：每批都必须精确命中该批最优
        assert.ok(
          Math.abs(sol.welfare - model.optimalWelfare) < 1e-12,
          `批 ${batch.join('+')}：${sol.welfare} ≠ 批内最优 ${model.optimalWelfare}`,
        );
        total += sol.welfare;
      }
      return total;
    };

    const sliced = composeBatches(fixtureTasks(), { ...opts, improve: false });
    const composed = composeBatches(fixtureTasks(), opts);

    const welfareSliced = solveBatches(sliced.batches);
    const welfareComposed = solveBatches(composed.batches);

    // 切片：[A,B]=0.5+0.4（无耦合可达）、[C]=0.3 → 1.2
    assert.ok(Math.abs(welfareSliced - 1.2) < 1e-9, `切片福利和=${welfareSliced}`);
    // 组批：[B]=0.4、[A,C]=0.5+0.3+0.35·0.25 → 1.2875
    assert.ok(Math.abs(welfareComposed - 1.2875) < 1e-9, `组批福利和=${welfareComposed}`);
    assert.ok(
      Math.abs(welfareComposed - welfareSliced - 0.35 * 0.25) < 1e-9,
      '福利差额必须恰为被找回的耦合加成',
    );
  });
});

describe('R14-A · R17-C 无耦合快速路径（基础钉板）', () => {
  it('空纠缠对集：strategy=no-coupling，零质量求值零移动，批=手工基线切片', () => {
    const tasks = [
      task('a', 1, [0]),
      task('b', 0.5, [1]),
      task('c', 0.25, [0, 1]),
      task('d', 0.75, [1]),
    ];
    const r = composeBatches(tasks, {
      entangledAgentPairs: [],
      agentCount: 2,
      maxBatchSize: 2,
    });
    assert.deepEqual(r.batches, [
      ['a', 'b'],
      ['c', 'd'],
    ]);
    assert.equal(r.strategy, 'no-coupling');
    assert.equal(r.capturedMass, 0);
    assert.equal(r.totalMass, 0);
    assert.equal(r.movesApplied, 0);
    assert.equal(r.massEvaluations, 0, '无耦合：纯切片成本，零任务对质量求值');
  });

  it('纠缠对可达任务全部同批：strategy=no-cross-batch-coupling，只算批内对', () => {
    // 前半任务可上 (a0,a1)（全落批 0），后半只上 a2 → 正质量对全部批内
    const tasks = [
      task('h0', 1, [0, 1]),
      task('h1', 0.75, [0, 1]),
      task('h2', 0.5, [0, 1]),
      task('h3', 0.25, [0, 1]),
      task('h4', 1, [2]),
      task('h5', 1, [2]),
    ];
    const r = composeBatches(tasks, {
      entangledAgentPairs: PAIR_01,
      agentCount: 3,
      maxBatchSize: 4,
      entanglementBonus: 0.35,
    });
    assert.deepEqual(r.batches, [
      ['h0', 'h1', 'h2', 'h3'],
      ['h4', 'h5'],
    ]);
    assert.equal(r.strategy, 'no-cross-batch-coupling');
    assert.equal(r.movesApplied, 0);
    // 手算：批 0 内 C(4,2)=6 对全部有势 0.35·min(pw)，批 1 内无势
    assert.ok(Math.abs(r.capturedMass - 0.35 * (0.75 + 0.5 + 0.25 + 0.5 + 0.25 + 0.25)) < 1e-12);
    assert.equal(r.totalMass, r.capturedMass, '全同批：totalMass ≡ capturedMass');
    assert.equal(r.massEvaluations, 6 + 1, '只求值批内对 Σ C(|β|,2) = 6+1');
  });

  it('improve:false 优先保持 strategy=baseline（即便命中快速路径）', () => {
    const tasks = [task('x', 1, [0]), task('y', 1, [2])];
    const r = composeBatches(tasks, {
      entangledAgentPairs: PAIR_01,
      agentCount: 3,
      maxBatchSize: 1,
      improve: false,
    });
    assert.equal(r.strategy, 'baseline');
    assert.equal(r.capturedMass, 0);
    assert.equal(r.totalMass, 0);
    assert.equal(r.massEvaluations, 0);
  });
});

describe('R14-A · 负对照（非法输入具名拒绝）', () => {
  const okTask = task('t1', 1, [0]);
  const okOpts = {
    entangledAgentPairs: PAIR_01,
    agentCount: 3,
    maxBatchSize: 2,
  };

  it('maxBatchSize / agentCount 非法：拒绝并指名', () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      assert.throws(
        () => composeBatches([okTask], { ...okOpts, maxBatchSize: bad }),
        (err: unknown) =>
          err instanceof MechanismError && err.message.includes('maxBatchSize must be an integer'),
        `maxBatchSize=${String(bad)}`,
      );
    }
    assert.throws(
      () => composeBatches([okTask], { ...okOpts, agentCount: 0 }),
      /agentCount must be an integer/,
    );
  });

  it('entanglementBonus / improvementEps 非法：拒绝并指名', () => {
    for (const bad of [-0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => composeBatches([okTask], { ...okOpts, entanglementBonus: bad }),
        (err: unknown) =>
          err instanceof MechanismError && err.message.includes('entanglementBonus must be'),
        `bonus=${String(bad)}`,
      );
    }
    assert.throws(
      () => composeBatches([okTask], { ...okOpts, improvementEps: 0 }),
      /improvementEps must be/,
    );
  });

  it('任务侧：重复 id / 非法权重 / 空·越界·重复资格：拒绝并指名', () => {
    assert.throws(
      () => composeBatches([okTask, okTask], okOpts),
      (err: unknown) =>
        err instanceof MechanismError &&
        err.message.includes('Duplicate task id in composer input: t1'),
    );
    for (const bad of [0, -1, Number.NaN]) {
      assert.throws(
        () => composeBatches([task('t', bad, [0])], okOpts),
        (err: unknown) =>
          err instanceof MechanismError && err.message.includes('priorityWeight must be'),
        `pw=${String(bad)}`,
      );
    }
    assert.throws(() => composeBatches([task('t', 1, [])], okOpts), /empty eligibleAgents/);
    assert.throws(
      () => composeBatches([task('t', 1, [3])], okOpts),
      (err: unknown) => err instanceof MechanismError && err.message.includes('outside [0, 3)'),
    );
    assert.throws(() => composeBatches([task('t', 1, [0, 0])], okOpts), /lists agent 0 twice/);
  });

  it('纠缠对侧：对角拒绝（镜像 couplingKey）、越界：拒绝并指名', () => {
    assert.throws(
      () => composeBatches([okTask], { ...okOpts, entangledAgentPairs: [{ a: 2, b: 2 }] }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('Diagonal'),
    );
    assert.throws(
      () => composeBatches([okTask], { ...okOpts, entangledAgentPairs: [{ a: 0, b: 7 }] }),
      /outside the agent index range/,
    );
  });
});
