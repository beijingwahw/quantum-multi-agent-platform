/**
 * R17-C 测试：纠缠批组成的无耦合零成本化（快速路径）。
 *
 * 验收钉板：
 * ① 零遗憾性质回归：200 随机实例（与 r14a 同种子同生成器）——
 *    improved.capturedMass ≥ baseline.capturedMass、总质量口径严格一致、
 *    划分不变量（排列、批大小 ≤ 上限）全部保持；
 * ② 构造改进用例不变：fixture（A,B,C）仍走全量路径真实改进；
 * ③ 无耦合计量：无耦合实例族快速路径输出与「手工基线切片」deepEqual，
 *    计数面 massEvaluations ≈ 纯切片成本（0 或批内对数），moves === 0；
 * ④ 有耦合行为不变：独立结构 oracle 判定 fast/全量路径的分派与实现一致，
 *    有跨批耦合（含巨 eps、bonus=0 对抗例）一律全量路径 C(n,2) 求值；
 * ⑤ 负对照保持＋新增：域校验仍在最前，快速路径不吞非法输入。
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

const PAIR_01: EntangledAgentPair[] = [{ a: 0, b: 1 }];

function task(id: string, priorityWeight: number, eligibleAgents: readonly number[]): ComposerTask {
  return { id, priorityWeight, eligibleAgents };
}

/** 手工基线切片：输入序连续切块（不依赖实现的切片代码） */
function manualSlices(ids: readonly string[], k: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += k) out.push(ids.slice(i, i + k));
  return out;
}

/**
 * 独立结构 oracle（不看实现内部）：基线切分下是否存在正质量可达任务对 /
 * 跨批正质量任务对。结构性判定（只看资格与切片），与 bonus 数值无关——
 * 与实现的探测语义同口径，用于交叉核对分派正确性。
 */
function oracle(
  tasks: readonly ComposerTask[],
  pairs: readonly EntangledAgentPair[],
  k: number,
): { positive: boolean; cross: boolean } {
  const batchOf = (i: number): number => Math.floor(i / k);
  const sides = new Map<number, number[]>();
  for (let i = 0; i < tasks.length; i++) {
    for (const a of tasks[i]!.eligibleAgents) {
      const list = sides.get(a) ?? [];
      list.push(i);
      sides.set(a, list);
    }
  }
  let positive = false;
  let cross = false;
  for (const { a, b } of pairs) {
    for (const t1 of sides.get(a) ?? []) {
      for (const t2 of sides.get(b) ?? []) {
        if (t1 === t2) continue;
        positive = true;
        if (batchOf(t1) !== batchOf(t2)) cross = true;
      }
    }
  }
  return { positive, cross };
}

/** 独立质量参考：批内耦合势，按批主序 (x<y) 求和（与实现口径对拍的第二来源） */
function referenceWithinMass(
  tasks: readonly ComposerTask[],
  pairs: readonly EntangledAgentPair[],
  k: number,
  bonus: number,
): number {
  const n = tasks.length;
  let sum = 0;
  for (let start = 0; start < n; start += k) {
    const stop = Math.min(n, start + k);
    for (let i = start; i < stop; i++) {
      for (let j = i + 1; j < stop; j++) {
        let m = 0;
        for (const { a, b } of pairs) {
          const e1 = tasks[i]!.eligibleAgents;
          const e2 = tasks[j]!.eligibleAgents;
          if ((e1.includes(a) && e2.includes(b)) || (e1.includes(b) && e2.includes(a))) {
            m = bonus * Math.min(tasks[i]!.priorityWeight, tasks[j]!.priorityWeight);
            break;
          }
        }
        if (m > 0) sum += m;
      }
    }
  }
  return sum;
}

describe('R17-C · ① 200 随机实例零遗憾钉板不变（＋分派/数值交叉核对）', () => {
  it('零遗憾、总质量口径、划分不变量保持；oracle 分派与数值逐位核对', () => {
    const rng = mulberry32(20260914);
    let fastNo = 0;
    let fastWithin = 0;
    let fullSearch = 0;
    let fullNoSearch = 0; // 无跨批但单批/小输入 → 全量路径（策略不变）
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
      const k = oracle(tasks, pairs, maxBatchSize);

      // 零遗憾钉板（r14a 原口径，一字不改）
      assert.ok(
        improved.capturedMass >= baseline.capturedMass - 1e-12,
        `实例${inst}：improved(${improved.capturedMass}) < baseline(${baseline.capturedMass})——零遗憾破裂`,
      );
      assert.equal(improved.totalMass, baseline.totalMass, '总质量口径必须一致');
      const flat = improved.batches.flat().sort();
      assert.deepEqual(flat, tasks.map((t) => t.id).sort(), `实例${inst}：划分不是排列`);
      for (const b of improved.batches) {
        assert.ok(b.length >= 1 && b.length <= maxBatchSize, `实例${inst}：批大小越界`);
      }
      assert.ok(improved.movesApplied >= 0);
      assert.equal(baseline.strategy, 'baseline');

      // R17-C 分派交叉核对：oracle 与实现的 strategy 选择必须一致
      const n = tasks.length;
      const batchCount = manualSlices(
        tasks.map((t) => t.id),
        maxBatchSize,
      ).length;
      if (k.cross) {
        fullSearch++;
        assert.equal(improved.strategy, 'improved', `实例${inst}：有跨批耦合必须走全量搜索路径`);
        assert.equal(improved.massEvaluations, (n * (n - 1)) / 2);
      } else if (n >= 2 && batchCount >= 2) {
        const expected = k.positive ? 'no-cross-batch-coupling' : 'no-coupling';
        assert.equal(improved.strategy, expected, `实例${inst}：oracle=${JSON.stringify(k)}`);
        if (k.positive) fastWithin++;
        else fastNo++;
        assert.equal(improved.movesApplied, 0, `实例${inst}：快速路径零移动`);
        assert.equal(improved.capturedMass, improved.totalMass, `实例${inst}：全同批两和必相等`);
        // 手工基线切片逐位一致
        assert.deepEqual(
          improved.batches,
          manualSlices(
            tasks.map((t) => t.id),
            maxBatchSize,
          ),
        );
        // 计数面公式：no-coupling=0；no-cross=批内对数 Σ C(|β|,2)
        let withinPairs = 0;
        for (let s = 0; s < n; s += maxBatchSize) {
          const sz = Math.min(maxBatchSize, n - s);
          withinPairs += (sz * (sz - 1)) / 2;
        }
        assert.equal(
          improved.massEvaluations,
          k.positive ? withinPairs : 0,
          `实例${inst}：计数面公式`,
        );
        // 独立参考：批内耦合势（仅对有正质量对的实例核对数值）
        if (k.positive) {
          assert.equal(
            improved.capturedMass,
            referenceWithinMass(tasks, pairs, maxBatchSize, bonus),
          );
        }
      } else {
        fullNoSearch++;
        assert.equal(improved.strategy, 'improved', '单批/小输入：既有口径不变');
      }
    }
    // 语料覆盖面自检：四种分派都必须被 200 实例真实命中（否则钉板空转）
    assert.ok(fullSearch >= 100, `全量搜索路径实例数 ${fullSearch} 过少`);
    assert.ok(fastNo >= 1, 'no-coupling 未被命中');
    assert.ok(fastWithin >= 1, 'no-cross-batch-coupling 未被 200 族命中——需构造族补');
    assert.ok(fullNoSearch >= 1, '无跨批但单批/小输入的全量口径实例未被命中');
  });
});

describe('R17-C · ② 构造改进用例不变（有耦合仍真实改进）', () => {
  const fixture = (): ComposerTask[] => [
    task('A', 1, [0, 1, 2]),
    task('B', 1, [2]),
    task('C', 0.25, [0, 1, 2]),
  ];
  const opts = {
    entangledAgentPairs: PAIR_01,
    agentCount: 3,
    maxBatchSize: 2,
    entanglementBonus: 0.35,
  };

  it('fixture：基线 [A,B],[C] 丢失 mass(A,C)，局部搜索移动 A 使 {A,C} 同批', () => {
    const r = composeBatches(fixture(), opts);
    assert.equal(r.strategy, 'improved', '有跨批耦合：不得被快速路径吞掉');
    assert.ok(r.movesApplied >= 1);
    assert.ok(Math.abs(r.capturedMass - 0.35 * 0.25) < 1e-12);
    assert.ok(r.batches.some((b) => b.includes('A') && b.includes('C')));
    assert.equal(r.massEvaluations, 3, 'C(3,2)=3 次任务对求值');
  });

  it('巨 improvementEps 且结构有跨批：仍走全量路径（探测只证结构，不猜数值）', () => {
    const tasks = [task('a', 1, [0, 1]), task('b', 1, [0, 1]), task('c', 0.25, [0, 1])];
    const r = composeBatches(tasks, {
      entangledAgentPairs: PAIR_01,
      agentCount: 2,
      maxBatchSize: 1,
      entanglementBonus: 0.35,
      improvementEps: 1e9,
    });
    assert.equal(r.strategy, 'improved');
    assert.equal(r.movesApplied, 0, 'eps 巨大：接受判据不会通过，但路径仍是全量');
    assert.equal(r.massEvaluations, 3, 'C(3,2)=3：快速路径不得据 eps 跳过');
  });

  it('bonus=0 且结构有跨批：仍全量路径（structural 判定与 bonus 数值无关）', () => {
    const tasks = [task('a', 1, [0]), task('b', 1, [1]), task('c', 1, [0, 1])];
    const r = composeBatches(tasks, {
      entangledAgentPairs: PAIR_01,
      agentCount: 2,
      maxBatchSize: 1,
      entanglementBonus: 0,
    });
    assert.equal(r.strategy, 'improved');
    assert.equal(r.capturedMass, 0);
    assert.equal(r.totalMass, 0);
    assert.equal(r.massEvaluations, 3);
  });
});

describe('R17-C · ③ 无耦合计量：快速路径输出 = 手工基线切片（deepEqual）', () => {
  it('空对集族：任意规模/切片宽度，输出与手工对象逐位一致，零求值', () => {
    for (const n of [2, 3, 5, 13]) {
      for (const k of [1, 2, 4]) {
        const tasks: ComposerTask[] = [];
        for (let i = 0; i < n; i++) tasks.push(task(`t${i}`, 1, [i % 3]));
        const r = composeBatches(tasks, {
          entangledAgentPairs: [],
          agentCount: 3,
          maxBatchSize: k,
        });
        if (Math.ceil(n / k) >= 2) {
          // ≥2 批：命中快速路径，零求值零搜索
          assert.deepEqual(r, {
            batches: manualSlices(
              tasks.map((t) => t.id),
              k,
            ),
            capturedMass: 0,
            totalMass: 0,
            movesApplied: 0,
            massEvaluations: 0,
            strategy: 'no-coupling',
          });
        } else {
          // 单批：既有口径（全量求值、策略 improved），快速路径不适用
          assert.deepEqual(r, {
            batches: manualSlices(
              tasks.map((t) => t.id),
              k,
            ),
            capturedMass: 0,
            totalMass: 0,
            movesApplied: 0,
            massEvaluations: (n * (n - 1)) / 2,
            strategy: 'improved',
          });
        }
      }
    }
  });

  it('纠缠对一侧无资格任务族：同上逐位一致，零求值', () => {
    const tasks = [
      task('a', 1, [0]),
      task('b', 0.75, [0]),
      task('c', 0.5, [2]),
      task('d', 0.25, [2]),
    ];
    const r = composeBatches(tasks, {
      entangledAgentPairs: [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
      ],
      agentCount: 3,
      maxBatchSize: 2,
      entanglementBonus: 0.35,
    });
    assert.deepEqual(r, {
      batches: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      capturedMass: 0,
      totalMass: 0,
      movesApplied: 0,
      massEvaluations: 0,
      strategy: 'no-coupling',
    });
  });

  it('正质量对全部批内族：captured=total=独立参考，计数=批内对数', () => {
    // 前半可上 (a0,a1)（批 0），后半只上 a2（批 1）；批 1 内含一对同 agent 任务
    const tasks = [
      task('p0', 1, [0, 1]),
      task('p1', 0.75, [0, 1]),
      task('p2', 0.5, [0, 1]),
      task('q0', 0.25, [2]),
      task('q1', 1, [2]),
    ];
    const k = 3;
    const pairs: EntangledAgentPair[] = PAIR_01;
    const bonus = 0.35;
    const r = composeBatches(tasks, {
      entangledAgentPairs: pairs,
      agentCount: 3,
      maxBatchSize: k,
      entanglementBonus: bonus,
    });
    assert.deepEqual(
      r.batches,
      manualSlices(
        tasks.map((t) => t.id),
        k,
      ),
    );
    assert.equal(r.strategy, 'no-cross-batch-coupling');
    assert.equal(r.movesApplied, 0);
    assert.equal(r.capturedMass, referenceWithinMass(tasks, pairs, k, bonus), '独立参考逐位一致');
    assert.equal(r.totalMass, r.capturedMass);
    assert.equal(r.massEvaluations, 3 + 1, 'Σ C(|β|,2) = C(3,2)+C(2,2)=3+1');
    // 对照：同形状 k=2 → S_0 跨批，必须走全量搜索
    const coupled = composeBatches(tasks, {
      entangledAgentPairs: pairs,
      agentCount: 3,
      maxBatchSize: 2,
      entanglementBonus: bonus,
    });
    assert.equal(coupled.strategy, 'improved');
    assert.equal(coupled.massEvaluations, (5 * 4) / 2);
  });

  it('improve:false 命中快速路径：数值同上、strategy 保持 baseline', () => {
    // x,y 都可上 (a0,a1) 且同批；z 只上 a2（纠缠对不可达）→ 正质量对全批内
    const tasks = [task('x', 1, [0, 1]), task('y', 1, [0, 1]), task('z', 1, [2])];
    const r = composeBatches(tasks, {
      entangledAgentPairs: PAIR_01,
      agentCount: 3,
      maxBatchSize: 2,
      improve: false,
    });
    assert.deepEqual(r, {
      batches: [['x', 'y'], ['z']],
      capturedMass: 0.15, // (x,y) 同批且都可达 (a0,a1)：bonus·min(1,1)
      totalMass: 0.15,
      movesApplied: 0,
      massEvaluations: 1,
      strategy: 'baseline',
    });
  });
});

describe('R17-C · ④ 确定性与规模压力', () => {
  it('同输入双跑逐字段一致（三种路径各一实例）', () => {
    const coupled: readonly ComposerTask[] = [
      task('A', 1, [0, 1, 2]),
      task('B', 1, [2]),
      task('C', 0.25, [0, 1, 2]),
    ];
    const within: readonly ComposerTask[] = [
      task('p0', 1, [0, 1]),
      task('p1', 0.75, [0, 1]),
      task('q0', 0.25, [2]),
      task('q1', 1, [2]),
    ];
    const none: readonly ComposerTask[] = [task('x', 1, [0]), task('y', 1, [1]), task('z', 1, [2])];
    // 有跨批耦合 → 全量搜索路径
    assert.deepEqual(
      composeBatches(coupled, {
        entangledAgentPairs: PAIR_01,
        agentCount: 3,
        maxBatchSize: 2,
        entanglementBonus: 0.35,
      }),
      composeBatches(coupled, {
        entangledAgentPairs: PAIR_01,
        agentCount: 3,
        maxBatchSize: 2,
        entanglementBonus: 0.35,
      }),
    );
    // 正质量对全批内 → no-cross-batch-coupling 快速路径
    assert.deepEqual(
      composeBatches(within, { entangledAgentPairs: PAIR_01, agentCount: 3, maxBatchSize: 4 }),
      composeBatches(within, { entangledAgentPairs: PAIR_01, agentCount: 3, maxBatchSize: 4 }),
    );
    // 无正质量对 → no-coupling 快速路径
    assert.deepEqual(
      composeBatches(none, { entangledAgentPairs: PAIR_01, agentCount: 3, maxBatchSize: 2 }),
      composeBatches(none, { entangledAgentPairs: PAIR_01, agentCount: 3, maxBatchSize: 2 }),
    );
  });

  it('无耦合大实例：T=400、P=28，快速路径计数面 = 0（纯切片成本）', () => {
    const tasks: ComposerTask[] = [];
    // 任务只上 agent 9——不参与任何纠缠对（对全在 0..7 之间）→ 无正质量任务对
    for (let i = 0; i < 400; i++) tasks.push(task(`t${i}`, 1, [9]));
    const pairs: EntangledAgentPair[] = [];
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) pairs.push({ a, b });
    const r = composeBatches(tasks, {
      entangledAgentPairs: pairs,
      agentCount: 10,
      maxBatchSize: 5,
    });
    assert.equal(r.strategy, 'no-coupling');
    assert.equal(r.massEvaluations, 0);
    assert.equal(r.movesApplied, 0);
    assert.equal(r.batches.length, 80);
  });
});

describe('R17-C · ⑤ 负对照：域校验仍在最前，快速路径不吞非法输入', () => {
  // 这些输入的合法版本都会命中快速路径（无耦合）；非法字段必须照旧具名拒绝
  it('会命中快速路径的形状 × 非法字段：逐项具名拒绝', () => {
    const shape = (): ComposerTask[] => [
      task('x', 1, [0]),
      task('y', 0.5, [2]),
      task('z', 0.25, [2]),
    ];
    const okOpts = {
      entangledAgentPairs: [] as EntangledAgentPair[],
      agentCount: 3,
      maxBatchSize: 2,
    };
    // 合法版本确实命中快速路径（前置自检，否则本负对照空转）
    assert.equal(composeBatches(shape(), okOpts).strategy, 'no-coupling');

    assert.throws(
      () => composeBatches([...shape(), task('x', 1, [0])], okOpts),
      (err: unknown) =>
        err instanceof MechanismError &&
        err.message.includes('Duplicate task id in composer input: x'),
    );
    assert.throws(
      () => composeBatches([task('x', -1, [0]), task('y', 1, [2])], okOpts),
      /priorityWeight must be/,
    );
    assert.throws(
      () => composeBatches([task('x', 1, [5]), task('y', 1, [2])], okOpts),
      /outside \[0, 3\)/,
    );
    assert.throws(
      () =>
        composeBatches(shape(), {
          ...okOpts,
          entangledAgentPairs: [{ a: 1, b: 1 }],
        }),
      /Diagonal/,
    );
    assert.throws(
      () =>
        composeBatches(shape(), {
          ...okOpts,
          entangledAgentPairs: [{ a: 0, b: 9 }],
        }),
      /outside the agent index range/,
    );
    assert.throws(
      () => composeBatches(shape(), { ...okOpts, entanglementBonus: -0.1 }),
      /entanglementBonus must be/,
    );
    assert.throws(
      () => composeBatches(shape(), { ...okOpts, improvementEps: 0 }),
      /improvementEps must be/,
    );
    assert.throws(
      () => composeBatches(shape(), { ...okOpts, maxBatchSize: 1.5 }),
      /maxBatchSize must be an integer/,
    );
    assert.throws(
      () => composeBatches(shape(), { ...okOpts, agentCount: 0 }),
      /agentCount must be an integer/,
    );
  });
});
