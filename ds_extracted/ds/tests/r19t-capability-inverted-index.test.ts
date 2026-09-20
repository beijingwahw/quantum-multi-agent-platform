/**
 * R19-T 验收 · capability-inverted-index（挂起可达性判定的倒排索引化＋
 * 单点变异的增量维护与选择性失效律；R18-A 批 3 候选③的实施）。
 *
 * 钉板结构（定理级主张 + 走私审判式负对照）：
 * ① 位同构主钉：classifyPendingBucket（置换后的索引路径）≡ 逐任务
 *    classifyPendingTask（零触碰的 R18 单任务原路径＝spec）——手工＋
 *    种子化随机实例跨全字段 deepStrictEqual；错误面位同构（重复
 *    agent id / 重复需求的 SchedulingError message 逐字节同；空任务表
 *    ×损坏快照 → 返回 [] 不抛＝既有可观察行为保持）；
 * ② 探针计数（性能主张的确定性度量，零墙钟）：原版扫描的 agent 访问
 *    数＝恰 T·A（循环形状定理的机器复刻）；索引路径的候选探针
 *    ＝Σ|最短 posting|——稀疏实例严格改进（精确计数断言）、随机实例
 *    恒 ≤ T·A（|L_min|≤A）、稠密实例恰等（不主张稠密下访问数更优）；
 * ③ M1 增量等价定理：随机变异序列（register/unregister/state/
 *    capabilities 四类混合）每步之后，增量索引判定 ≡ 生产
 *    classifyPendingBucket(快照)（生产函数为 spec，位级比对）；
 * ④ 失效三分律 F：随机序列每步每任务，mutationDirtiness 的三级
 *    （clean/witness/class）与实际变化的双向互斥完备机检——
 *    clean ⟺ 逐位不变；witness ⟺ 证人组变而分类不变；class ⟺ 分类翻；
 *    ＋六向边界翻转实例＋负对照走私审判（四条走私律定罪）；
 * ⑤ 变异面错误契约与快照序律：重复注册/未知 id 族具名拒绝；
 *    snapshot 序＝注册序（注销保序、再注册移末位）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCapabilityInvertedIndex,
  classifyBucketIndexed,
  classifyTaskIndexed,
  registerIndexedAgent,
  unregisterIndexedAgent,
  setIndexedAgentState,
  setIndexedAgentCapabilities,
  snapshotIndexedAgents,
  readIndexStats,
  resetIndexStats,
  mutationDirtiness,
  type IndexedAgentView,
  type IndexedReachabilityVerdict,
} from '../src/core/capability-inverted-index.js';
import {
  classifyPendingTask,
  classifyPendingBucket,
  type ReachabilityAgentView,
  type ReachabilityTaskView,
} from '../src/core/pending-reachability.js';
import { SchedulingError } from '../src/utils/errors.js';

/** 种子化 PRNG（mulberry32，与平台 bench 同族；逐位复现） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** 位级等价（全字段；键序由构造固定） */
function sameVerdict(a: IndexedReachabilityVerdict, b: IndexedReachabilityVerdict): boolean {
  return (
    a.task === b.task &&
    a.classification === b.classification &&
    sameStringArray(a.matchingAgents, b.matchingAgents) &&
    sameStringArray(a.idleMatches, b.idleMatches) &&
    sameStringArray(a.busyMatches, b.busyMatches)
  );
}

/** 原版桶判定语义的机器复刻（探针计数：R18 形状——每任务遍历全体 agent） */
function scanReplicaAgentVisits(
  tasks: readonly ReachabilityTaskView[],
  agents: readonly ReachabilityAgentView[],
): number {
  let visits = 0;
  for (const task of tasks) {
    for (const agent of agents) {
      visits++; // 循环形状定理：无条件访问
      task.requiredCapabilities.every((req) => agent.capabilities.includes(req));
    }
  }
  return visits;
}

/** 随机实例：能力池 c0..c9（含重复能力数组的 agent、空能力、四种状态） */
function randomAgents(rng: () => number, count: number): IndexedAgentView[] {
  const states = ['idle', 'working', 'overloaded', 'offline'];
  const agents: IndexedAgentView[] = [];
  for (let i = 0; i < count; i++) {
    const caps: string[] = [];
    const capCount = Math.floor(rng() * 4); // 0..3，可为空
    for (let c = 0; c < capCount; c++) {
      caps.push(`c${Math.floor(rng() * 10)}`);
    }
    if (rng() < 0.15 && caps.length > 0) caps.push(caps[0]!); // 重复能力走私面
    agents.push({
      id: `a${i}`,
      capabilities: caps,
      state: states[Math.floor(rng() * states.length)]!,
    });
  }
  return agents;
}

function randomTasks(rng: () => number, count: number): ReachabilityTaskView[] {
  const tasks: ReachabilityTaskView[] = [];
  for (let i = 0; i < count; i++) {
    const reqCount = Math.floor(rng() * 4); // 0..3，空需求边界在册
    const reqs = new Set<string>();
    for (let r = 0; r < reqCount; r++) {
      const cap = rng() < 0.12 ? `x${Math.floor(rng() * 4)}` : `c${Math.floor(rng() * 10)}`; // 12% 域外能力
      reqs.add(cap); // 去重（生产契约拒绝重复需求）
    }
    tasks.push({ id: `t${i}`, requiredCapabilities: [...reqs] });
  }
  return tasks;
}

describe('R19-T · ① 位同构主钉（索引路径 ≡ R18 单任务原路径）', () => {
  const handAgents: ReachabilityAgentView[] = [
    { id: 'a1', capabilities: ['js'], state: 'idle' },
    { id: 'a2', capabilities: ['js', 'ml'], state: 'working' },
    { id: 'a3', capabilities: ['ops'], state: 'overloaded' },
    { id: 'a4', capabilities: [], state: 'idle' },
    { id: 'a5', capabilities: ['js', 'js'], state: 'offline' }, // 重复能力：posting 必须 dedup
  ];

  it('手工实例：classifyPendingBucket ≡ 逐任务 classifyPendingTask（全字段）', () => {
    const tasks: ReachabilityTaskView[] = [
      { id: 't-js', requiredCapabilities: ['js'] },
      { id: 't-ml', requiredCapabilities: ['ml'] },
      { id: 't-ops', requiredCapabilities: ['ops'] },
      { id: 't-jml', requiredCapabilities: ['js', 'ml'] },
      { id: 't-none', requiredCapabilities: [] },
      { id: 't-rust', requiredCapabilities: ['rust'] },
    ];
    const bucket = classifyPendingBucket(tasks, handAgents);
    const oracle = tasks.map((t) => classifyPendingTask(t, handAgents));
    assert.deepEqual(bucket, oracle);
    // 重复能力 agent（a5: js,js）在 matchingAgents 中恰出现一次
    const js = bucket.find((v) => v.task === 't-js');
    assert.deepEqual(js?.matchingAgents, ['a1', 'a2', 'a5']);
  });

  it('随机实例 ×60：桶判定与单任务判定逐位一致（种子化复现）', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed * 7919);
      const agents = randomAgents(rng, Math.floor(rng() * 26)); // 0..25，含空注册表
      const tasks = randomTasks(rng, Math.floor(rng() * 21)); // 0..20，含空桶
      const bucket = classifyPendingBucket(tasks, agents);
      const oracle = tasks.map((t) => classifyPendingTask(t, agents));
      assert.deepEqual(bucket, oracle, `seed=${seed} 位同构破裂`);
    }
  });

  it('classifyTaskIndexed ≡ classifyPendingTask（单任务路径两实现逐位一致）', () => {
    for (let seed = 100; seed <= 130; seed++) {
      const rng = mulberry32(seed * 104729);
      const agents = randomAgents(rng, 12);
      const index = buildCapabilityInvertedIndex(agents);
      for (const task of randomTasks(rng, 8)) {
        assert.deepEqual(
          classifyTaskIndexed(task, index),
          classifyPendingTask(task, agents),
          `seed=${seed} task=${task.id}`,
        );
      }
    }
  });

  it('错误面位同构：重复 agent id 的 message 与原路径逐字节相同', () => {
    const corrupt: ReachabilityAgentView[] = [
      { id: 'dup', capabilities: ['js'], state: 'idle' },
      { id: 'dup', capabilities: ['ml'], state: 'idle' },
    ];
    const tasks: ReachabilityTaskView[] = [{ id: 't', requiredCapabilities: ['js'] }];
    let singlePathMessage = '';
    assert.throws(
      () => classifyPendingTask(tasks[0]!, corrupt),
      (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        singlePathMessage = err.message;
        return true;
      },
    );
    assert.throws(
      () => classifyPendingBucket(tasks, corrupt),
      (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        assert.equal(err.message, singlePathMessage); // 逐字节
        return true;
      },
    );
    assert.throws(
      () => buildCapabilityInvertedIndex(corrupt),
      (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        assert.equal(err.message, singlePathMessage);
        return true;
      },
    );
  });

  it('错误面位同构：任务重复需求的 message 与原路径逐字节相同（第 2 任务处抛）', () => {
    const agents: ReachabilityAgentView[] = [{ id: 'a1', capabilities: ['js'], state: 'idle' }];
    const tasks: ReachabilityTaskView[] = [
      { id: 'ok', requiredCapabilities: ['js'] },
      { id: 'bad', requiredCapabilities: ['ml', 'ml'] },
    ];
    let singlePathMessage = '';
    assert.throws(
      () => classifyPendingTask(tasks[1]!, agents),
      (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        singlePathMessage = err.message;
        return true;
      },
    );
    assert.throws(
      () => classifyPendingBucket(tasks, agents),
      (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        assert.equal(err.message, singlePathMessage);
        return true;
      },
    );
  });

  it('空任务表 × 损坏快照 → 返回 [] 不抛（既有可观察行为保持）', () => {
    const corrupt: ReachabilityAgentView[] = [
      { id: 'dup', capabilities: [], state: 'idle' },
      { id: 'dup', capabilities: [], state: 'idle' },
    ];
    assert.deepEqual(classifyPendingBucket([], corrupt), []);
  });
});

describe('R19-T · ② 探针计数（性能主张的确定性度量，零墙钟）', () => {
  it('原版扫描复刻：agent 访问数＝恰 T·A（循环形状定理机器钉板）', () => {
    const rng = mulberry32(4242);
    for (let k = 0; k < 20; k++) {
      const agents = randomAgents(rng, 7 + Math.floor(rng() * 14));
      const tasks = randomTasks(rng, 5 + Math.floor(rng() * 10));
      assert.equal(scanReplicaAgentVisits(tasks, agents), tasks.length * agents.length);
    }
  });

  it('稀疏实例：索引候选探针严格少于 T·A（精确计数，非比例断言）', () => {
    // 60 agents 各持 1 个互异能力；40 任务单需求（20 命中 / 20 域外未命中）
    const agents: IndexedAgentView[] = [];
    for (let i = 0; i < 60; i++) {
      agents.push({ id: `a${i}`, capabilities: [`k${i}`], state: 'idle' });
    }
    const tasks: ReachabilityTaskView[] = [];
    for (let i = 0; i < 20; i++) tasks.push({ id: `hit${i}`, requiredCapabilities: [`k${i}`] });
    for (let i = 0; i < 20; i++) tasks.push({ id: `miss${i}`, requiredCapabilities: [`z${i}`] });

    const index = buildCapabilityInvertedIndex(agents);
    resetIndexStats(index);
    const verdicts = classifyBucketIndexed(tasks, index);
    const stats = readIndexStats(index);
    assert.equal(stats.candidateProbes, 20); // 命中任务各 1（最短 posting 长 1），未命中 0
    assert.equal(stats.membershipEvaluations, 0); // R=1 → 0 次附加成员检查
    assert.equal(scanReplicaAgentVisits(tasks, agents), 40 * 60); // 原版恰 2400
    // 全部命中任务判 schedulable-now（证人＝对应 agent）
    for (let i = 0; i < 20; i++) {
      assert.equal(verdicts.find((v) => v.task === `hit${i}`)?.classification, 'schedulable-now');
    }
  });

  it('多需求稀疏实例：membershipEvaluations＝Σ(每候选 R−1)（精确公式）', () => {
    const agents: IndexedAgentView[] = [
      { id: 'a0', capabilities: ['js', 'ml'], state: 'idle' },
      { id: 'a1', capabilities: ['js', 'ml'], state: 'working' },
      { id: 'a2', capabilities: ['js'], state: 'idle' },
      { id: 'a3', capabilities: ['ops'], state: 'idle' },
    ];
    const tasks: ReachabilityTaskView[] = [
      { id: 'both', requiredCapabilities: ['js', 'ml'] }, // 最短 posting=ml(长2: a0,a1) → 2 探针×1 附加检查
      { id: 'ops', requiredCapabilities: ['ops'] }, // posting 长 1 → 1 探针
    ];
    const index = buildCapabilityInvertedIndex(agents);
    resetIndexStats(index);
    classifyBucketIndexed(tasks, index);
    const stats = readIndexStats(index);
    assert.equal(stats.candidateProbes, 3); // 2 + 1
    assert.equal(stats.membershipEvaluations, 2); // 2 候选 × (2−1)
  });

  it('随机实例：索引探针恒 ≤ T·A（|最短 posting| ≤ A 的机器验证）', () => {
    for (let seed = 300; seed <= 340; seed++) {
      const rng = mulberry32(seed * 31337);
      const agents = randomAgents(rng, 15);
      const tasks = randomTasks(rng, 12);
      const index = buildCapabilityInvertedIndex(agents);
      resetIndexStats(index);
      classifyBucketIndexed(tasks, index);
      assert.ok(
        readIndexStats(index).candidateProbes <= tasks.length * agents.length,
        `seed=${seed} 探针超上界`,
      );
    }
  });

  it('稠密实例（全员全能力）：探针恰等 T·A——不主张稠密下访问数更优', () => {
    const agents: IndexedAgentView[] = [];
    for (let i = 0; i < 30; i++) {
      agents.push({ id: `a${i}`, capabilities: ['c0', 'c1', 'c2', 'c3', 'c4'], state: 'idle' });
    }
    const tasks: ReachabilityTaskView[] = [];
    for (let i = 0; i < 20; i++) {
      tasks.push({ id: `t${i}`, requiredCapabilities: [`c${i % 5}`, `c${(i + 1) % 5}`] });
    }
    const index = buildCapabilityInvertedIndex(agents);
    resetIndexStats(index);
    classifyBucketIndexed(tasks, index);
    assert.equal(readIndexStats(index).candidateProbes, 20 * 30);
  });
});

describe('R19-T · ③ M1 增量等价（增量索引 ≡ 生产函数对快照重判）', () => {
  it('随机变异序列 ×25 种子 ×30 步：每步位级等价（生产 classifyPendingBucket 为 spec）', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = mulberry32(seed * 2654435761);
      const agents = randomAgents(rng, 8);
      const tasks = randomTasks(rng, 10);
      const index = buildCapabilityInvertedIndex(agents);
      let gen = 0;
      for (let step = 0; step < 30; step++) {
        const roll = rng();
        if (roll < 0.3) {
          const fresh = randomAgents(rng, 1)[0]!;
          registerIndexedAgent(index, { ...fresh, id: `g${gen++}` }); // 新 id 空间，避免重复注册拒绝
        } else if (roll < 0.5) {
          const snap = snapshotIndexedAgents(index);
          if (snap.length > 0) {
            unregisterIndexedAgent(index, snap[Math.floor(rng() * snap.length)]!.id);
          }
        } else if (roll < 0.8) {
          const snap = snapshotIndexedAgents(index);
          if (snap.length > 0) {
            const victim = snap[Math.floor(rng() * snap.length)]!;
            const states = ['idle', 'working', 'overloaded', 'offline'];
            setIndexedAgentState(index, victim.id, states[Math.floor(rng() * 4)]!);
          }
        } else {
          const snap = snapshotIndexedAgents(index);
          if (snap.length > 0) {
            const victim = snap[Math.floor(rng() * snap.length)]!;
            const caps: string[] = [];
            const n = Math.floor(rng() * 3);
            for (let c = 0; c < n; c++) caps.push(`c${Math.floor(rng() * 10)}`);
            setIndexedAgentCapabilities(index, victim.id, caps);
          }
        }
        const snapshot = snapshotIndexedAgents(index);
        const incremental = classifyBucketIndexed(tasks, index);
        const fresh = classifyPendingBucket(tasks, snapshot);
        assert.deepEqual(incremental, fresh, `seed=${seed} step=${step} M1 增量等价破裂`);
      }
    }
  });

  it('register 注入新 id（避免与既有 id 冲突）：M1 在 id 空间增长下保持', () => {
    const rng = mulberry32(99991);
    const index = buildCapabilityInvertedIndex([]);
    const tasks: ReachabilityTaskView[] = [
      { id: 't0', requiredCapabilities: ['c1'] },
      { id: 't1', requiredCapabilities: ['c2', 'c3'] },
      { id: 't2', requiredCapabilities: [] },
    ];
    for (let i = 0; i < 40; i++) {
      const fresh = randomAgents(rng, 1)[0]!;
      registerIndexedAgent(index, { ...fresh, id: `g${i}` });
      const snapshot = snapshotIndexedAgents(index);
      assert.deepEqual(classifyBucketIndexed(tasks, index), classifyPendingBucket(tasks, snapshot));
    }
  });
});

describe('R19-T · ④ 失效三分律 F（clean/witness/class 的双向互斥完备机检）', () => {
  /** 单步机检：level 与实际变化的三分双 implica */
  function assertTrichotomy(
    task: ReachabilityTaskView,
    before: IndexedReachabilityVerdict,
    after: IndexedReachabilityVerdict,
    level: string,
    label: string,
  ): void {
    const classChanged = before.classification !== after.classification;
    const bitwiseChanged = !sameVerdict(before, after);
    if (level === 'clean') {
      assert.ok(!bitwiseChanged, `${label}: clean 但判定变化（soundness 破裂）`);
    } else {
      assert.ok(bitwiseChanged, `${label}: 非 clean 但判定逐位不变（精确性破裂——脏级冗余）`);
    }
    if (level === 'class') {
      assert.ok(classChanged, `${label}: class 但分类未翻（soundness 破裂）`);
    } else {
      assert.ok(!classChanged, `${label}: 非 class 但分类翻转（漏报——clean/witness 走私）`);
    }
    if (level === 'witness') {
      assert.ok(bitwiseChanged && !classChanged, `${label}: witness 语义破裂`);
    }
  }

  it('随机变异序列：每步每任务三分律双向机检（soundness＋精确性）', () => {
    for (let seed = 500; seed <= 525; seed++) {
      const rng = mulberry32(seed * 65537);
      const agents = randomAgents(rng, 7);
      const tasks = randomTasks(rng, 9);
      const index = buildCapabilityInvertedIndex(agents);
      let before = classifyBucketIndexed(tasks, index);
      let gen = 0;
      for (let step = 0; step < 40; step++) {
        const snapshotBefore = snapshotIndexedAgents(index);
        const roll = rng();
        let mutation: Parameters<typeof mutationDirtiness>[2];
        if (roll < 0.3) {
          const fresh = randomAgents(rng, 1)[0]!;
          const agent = { ...fresh, id: `g${gen++}` };
          registerIndexedAgent(index, agent);
          mutation = { kind: 'register', agent };
        } else if (roll < 0.5) {
          if (snapshotBefore.length === 0) continue;
          const victim = snapshotBefore[Math.floor(rng() * snapshotBefore.length)]!;
          mutation = { kind: 'unregister', agentId: victim.id, agentState: victim.state };
          unregisterIndexedAgent(index, victim.id);
        } else if (roll < 0.8) {
          if (snapshotBefore.length === 0) continue;
          const victim = snapshotBefore[Math.floor(rng() * snapshotBefore.length)]!;
          const states = ['idle', 'working', 'overloaded', 'offline'];
          const to = states[Math.floor(rng() * 4)]!;
          mutation = { kind: 'state', agentId: victim.id, fromState: victim.state, toState: to };
          setIndexedAgentState(index, victim.id, to);
        } else {
          if (snapshotBefore.length === 0) continue;
          const victim = snapshotBefore[Math.floor(rng() * snapshotBefore.length)]!;
          const caps: string[] = [];
          const n = Math.floor(rng() * 3);
          for (let c = 0; c < n; c++) caps.push(`c${Math.floor(rng() * 10)}`);
          mutation = {
            kind: 'capabilities',
            agentId: victim.id,
            agentState: victim.state,
            oldCapabilities: [...victim.capabilities],
            newCapabilities: caps,
          };
          setIndexedAgentCapabilities(index, victim.id, caps);
        }
        const after = classifyBucketIndexed(tasks, index);
        for (let i = 0; i < tasks.length; i++) {
          const level = mutationDirtiness(tasks[i]!, before[i]!, mutation);
          assertTrichotomy(
            tasks[i]!,
            before[i]!,
            after[i]!,
            level,
            `seed=${seed} step=${step} task=${tasks[i]!.id} mut=${mutation.kind}`,
          );
        }
        before = after;
      }
    }
  });

  it('边界实例 1：state idle→working 且 idleMatches===[a] → class 翻（schedulable→awaiting）', () => {
    const agents: IndexedAgentView[] = [
      { id: 'solo', capabilities: ['ml'], state: 'idle' },
      { id: 'other', capabilities: ['ml'], state: 'working' },
    ];
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const index = buildCapabilityInvertedIndex(agents);
    const before = classifyTaskIndexed(task, index);
    assert.equal(before.classification, 'schedulable-now');
    assert.deepEqual(before.idleMatches, ['solo']);
    const mutation = {
      kind: 'state',
      agentId: 'solo',
      fromState: 'idle',
      toState: 'working',
    } as const;
    assert.equal(mutationDirtiness(task, before, mutation), 'class');
    setIndexedAgentState(index, 'solo', 'working');
    const after = classifyTaskIndexed(task, index);
    assert.equal(after.classification, 'awaiting-release');
    assert.deepEqual(after.idleMatches, []);
    assert.deepEqual(after.busyMatches, ['solo', 'other']); // 注册表序保持
  });

  it('边界实例 2：state idle→working 且 idleMatches ⊋ [a] → witness（类稳证人变）', () => {
    const agents: IndexedAgentView[] = [
      { id: 'i1', capabilities: ['ml'], state: 'idle' },
      { id: 'i2', capabilities: ['ml'], state: 'idle' },
    ];
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const index = buildCapabilityInvertedIndex(agents);
    const before = classifyTaskIndexed(task, index);
    const mutation = {
      kind: 'state',
      agentId: 'i1',
      fromState: 'idle',
      toState: 'working',
    } as const;
    assert.equal(mutationDirtiness(task, before, mutation), 'witness');
    setIndexedAgentState(index, 'i1', 'working');
    const after = classifyTaskIndexed(task, index);
    assert.equal(after.classification, 'schedulable-now');
    assert.deepEqual(after.idleMatches, ['i2']);
    assert.deepEqual(after.busyMatches, ['i1']);
  });

  it('边界实例 3：state working→overloaded（idle 资格双侧不变）→ clean（L0 钉板：非 idle 状态串不入判定）', () => {
    const agents: IndexedAgentView[] = [
      { id: 'b1', capabilities: ['ml'], state: 'working' },
      { id: 'i1', capabilities: ['ml'], state: 'idle' },
    ];
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const index = buildCapabilityInvertedIndex(agents);
    const before = classifyTaskIndexed(task, index);
    const mutation = {
      kind: 'state',
      agentId: 'b1',
      fromState: 'working',
      toState: 'overloaded',
    } as const;
    assert.equal(mutationDirtiness(task, before, mutation), 'clean');
    setIndexedAgentState(index, 'b1', 'overloaded');
    assert.ok(sameVerdict(before, classifyTaskIndexed(task, index))); // 逐位不变
  });

  it('边界实例 4：state working→idle 且 idleMatches=[] → class 翻（awaiting→schedulable）', () => {
    const agents: IndexedAgentView[] = [{ id: 'b1', capabilities: ['ml'], state: 'working' }];
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const index = buildCapabilityInvertedIndex(agents);
    const before = classifyTaskIndexed(task, index);
    assert.equal(before.classification, 'awaiting-release');
    const mutation = {
      kind: 'state',
      agentId: 'b1',
      fromState: 'working',
      toState: 'idle',
    } as const;
    assert.equal(mutationDirtiness(task, before, mutation), 'class');
    setIndexedAgentState(index, 'b1', 'idle');
    assert.equal(classifyTaskIndexed(task, index).classification, 'schedulable-now');
  });

  it('边界实例 5：register——reqs⊆caps 的 unsatisfiable 翻 class；不相交则 clean', () => {
    const agents: IndexedAgentView[] = [{ id: 'a1', capabilities: ['js'], state: 'idle' }];
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const index = buildCapabilityInvertedIndex(agents);
    const before = classifyTaskIndexed(task, index);
    assert.equal(before.classification, 'unsatisfiable');
    const busyNewcomer: IndexedAgentView = { id: 'n1', capabilities: ['ml'], state: 'working' };
    assert.equal(
      mutationDirtiness(task, before, { kind: 'register', agent: busyNewcomer }),
      'class',
    );
    registerIndexedAgent(index, busyNewcomer);
    const after = classifyTaskIndexed(task, index);
    assert.equal(after.classification, 'awaiting-release');
    assert.deepEqual(after.matchingAgents, ['n1']);
    // 不相交能力注册：clean
    const disjoint: IndexedAgentView = { id: 'n2', capabilities: ['ops'], state: 'idle' };
    assert.equal(mutationDirtiness(task, after, { kind: 'register', agent: disjoint }), 'clean');
  });

  it('边界实例 6：unregister——最后 idle 证人→degrade；唯一 busy 证人→unsatisfiable；多证人→witness', () => {
    // (a) idleMatches===[a]
    let index = buildCapabilityInvertedIndex([
      { id: 'solo', capabilities: ['ml'], state: 'idle' },
      { id: 'busy', capabilities: ['ml'], state: 'working' },
    ]);
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    let before = classifyTaskIndexed(task, index);
    assert.equal(
      mutationDirtiness(task, before, { kind: 'unregister', agentId: 'solo', agentState: 'idle' }),
      'class',
    );
    unregisterIndexedAgent(index, 'solo');
    assert.equal(classifyTaskIndexed(task, index).classification, 'awaiting-release');
    // (b) 唯一 busy 证人 → unsatisfiable
    index = buildCapabilityInvertedIndex([{ id: 'only', capabilities: ['ml'], state: 'working' }]);
    before = classifyTaskIndexed(task, index);
    assert.equal(
      mutationDirtiness(task, before, {
        kind: 'unregister',
        agentId: 'only',
        agentState: 'working',
      }),
      'class',
    );
    unregisterIndexedAgent(index, 'only');
    assert.equal(classifyTaskIndexed(task, index).classification, 'unsatisfiable');
    // (c) 多 busy 证人 → witness（类稳）
    index = buildCapabilityInvertedIndex([
      { id: 'w1', capabilities: ['ml'], state: 'working' },
      { id: 'w2', capabilities: ['ml'], state: 'working' },
    ]);
    before = classifyTaskIndexed(task, index);
    assert.equal(
      mutationDirtiness(task, before, { kind: 'unregister', agentId: 'w1', agentState: 'working' }),
      'witness',
    );
    unregisterIndexedAgent(index, 'w1');
    const after = classifyTaskIndexed(task, index);
    assert.equal(after.classification, 'awaiting-release');
    assert.deepEqual(after.matchingAgents, ['w2']);
  });

  it('capabilities 变异：增益分支与流失分支的三分（XOR 干净律）', () => {
    const index = buildCapabilityInvertedIndex([{ id: 'a1', capabilities: ['js'], state: 'idle' }]);
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const before = classifyTaskIndexed(task, index);
    assert.equal(before.classification, 'unsatisfiable');
    // 增益（busy）：unsatisfiable → awaiting = class
    const gain = {
      kind: 'capabilities',
      agentId: 'a1',
      agentState: 'idle',
      oldCapabilities: ['js'],
      newCapabilities: ['js', 'ml'],
    } as const;
    assert.equal(mutationDirtiness(task, before, gain), 'class');
    setIndexedAgentCapabilities(index, 'a1', ['js', 'ml']);
    assert.equal(classifyTaskIndexed(task, index).classification, 'schedulable-now'); // a1 idle
    // 流失（idle 证人唯一）：schedulable → awaiting = class
    const loss = {
      kind: 'capabilities',
      agentId: 'a1',
      agentState: 'idle',
      oldCapabilities: ['js', 'ml'],
      newCapabilities: ['js'],
    } as const;
    const mid = classifyTaskIndexed(task, index);
    assert.equal(mutationDirtiness(task, mid, loss), 'class');
    setIndexedAgentCapabilities(index, 'a1', ['js']);
    assert.equal(classifyTaskIndexed(task, index).classification, 'unsatisfiable');
    // 双侧皆含/皆不含 → clean
    const neutral = {
      kind: 'capabilities',
      agentId: 'a1',
      agentState: 'idle',
      oldCapabilities: ['js'],
      newCapabilities: ['js', 'ops'],
    } as const;
    const end = classifyTaskIndexed(task, index);
    assert.equal(mutationDirtiness(task, end, neutral), 'clean');
    setIndexedAgentCapabilities(index, 'a1', ['js', 'ops']);
    assert.ok(sameVerdict(end, classifyTaskIndexed(task, index)));
  });

  it('负对照·走私审判 A：「state 变更永不翻分类」——被最后 idle 证人实例定罪', () => {
    // 走私律：state 变更对 classification 永远 clean（只可能动证人组）
    const index = buildCapabilityInvertedIndex([
      { id: 'solo', capabilities: ['ml'], state: 'idle' },
      { id: 'busy', capabilities: ['ml'], state: 'working' },
    ]);
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const before = classifyTaskIndexed(task, index);
    const smuggledSaysClassStable = true; // 走私律的判定
    setIndexedAgentState(index, 'solo', 'working');
    const after = classifyTaskIndexed(task, index);
    // 法庭：机器证明分类翻转 → 走私律错杀漏报，定罪
    assert.ok(
      before.classification !== after.classification && smuggledSaysClassStable,
      '走私律 A 被定罪：state 变更翻转了分类',
    );
  });

  it('负对照·走私审判 B：「state 脏 ⟺ agent∈busyMatches」——被 idle 侧翻转定罪', () => {
    const index = buildCapabilityInvertedIndex([
      { id: 'solo', capabilities: ['ml'], state: 'idle' },
    ]);
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const before = classifyTaskIndexed(task, index);
    // 走私律只看 busyMatches：solo ∈ idleMatches ∉ busyMatches → 走私律说 clean
    const smuggledSaysClean = !before.busyMatches.includes('solo');
    setIndexedAgentState(index, 'solo', 'working');
    const after = classifyTaskIndexed(task, index);
    assert.ok(
      smuggledSaysClean && !sameVerdict(before, after),
      '走私律 B 被定罪：idle 侧证人变化被漏报',
    );
    // 真律：本例 mutationDirtiness 早在实例 1 钉为 class
  });

  it('负对照·走私审判 C：「busy 新人注册永不翻分类」——被 unsatisfiable→awaiting 定罪', () => {
    const index = buildCapabilityInvertedIndex([{ id: 'a1', capabilities: ['js'], state: 'idle' }]);
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const before = classifyTaskIndexed(task, index);
    assert.equal(before.classification, 'unsatisfiable');
    const busyNewcomer: IndexedAgentView = { id: 'n1', capabilities: ['ml'], state: 'working' };
    const smuggledSaysAtMostWitness = busyNewcomer.state !== 'idle'; // 走私律：非 idle 注册最多 witness
    registerIndexedAgent(index, busyNewcomer);
    const after = classifyTaskIndexed(task, index);
    assert.ok(
      smuggledSaysAtMostWitness && before.classification !== after.classification,
      '走私律 C 被定罪：busy 注册把 unsatisfiable 翻成 awaiting-release',
    );
  });

  it('负对照·走私审判 D：「类不变即可跳过重判」（witness 塌缩为 clean）——被证人组位变定罪', () => {
    const index = buildCapabilityInvertedIndex([
      { id: 'i1', capabilities: ['ml'], state: 'idle' },
      { id: 'i2', capabilities: ['ml'], state: 'idle' },
    ]);
    const task: ReachabilityTaskView = { id: 't', requiredCapabilities: ['ml'] };
    const before = classifyTaskIndexed(task, index);
    // 走私律：classification 不变 ⟹ 全部跳过（witness 塌缩）
    setIndexedAgentState(index, 'i1', 'working');
    const after = classifyTaskIndexed(task, index);
    assert.equal(before.classification, after.classification); // 类确实不变
    assert.ok(!sameVerdict(before, after), '走私律 D 被定罪：证人组已变（idle/busy 划分翻转）');
  });
});

describe('R19-T · ⑤ 变异面错误契约与快照序律', () => {
  it('register 重复 id：具名拒绝（SchedulingError）', () => {
    const index = buildCapabilityInvertedIndex([{ id: 'a1', capabilities: ['js'], state: 'idle' }]);
    assert.throws(
      () => registerIndexedAgent(index, { id: 'a1', capabilities: ['ml'], state: 'idle' }),
      (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        assert.match(err.message, /duplicate agent id/);
        return true;
      },
    );
  });

  it('unregister / setState / setCapabilities 未知 id：具名拒绝', () => {
    const index = buildCapabilityInvertedIndex([]);
    for (const fn of [
      () => unregisterIndexedAgent(index, 'ghost'),
      () => setIndexedAgentState(index, 'ghost', 'idle'),
      () => setIndexedAgentCapabilities(index, 'ghost', ['js']),
    ]) {
      assert.throws(fn, (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        assert.match(err.message, /unknown agent id/);
        return true;
      });
    }
  });

  it('快照序＝注册序：注销保序、新注册追加、同 id 重注册移末位', () => {
    const index = buildCapabilityInvertedIndex([]);
    for (const id of ['a', 'b', 'c']) {
      registerIndexedAgent(index, { id, capabilities: ['js'], state: 'idle' });
    }
    assert.deepEqual(
      snapshotIndexedAgents(index).map((v) => v.id),
      ['a', 'b', 'c'],
    );
    unregisterIndexedAgent(index, 'b');
    assert.deepEqual(
      snapshotIndexedAgents(index).map((v) => v.id),
      ['a', 'c'],
    );
    registerIndexedAgent(index, { id: 'd', capabilities: ['js'], state: 'idle' });
    assert.deepEqual(
      snapshotIndexedAgents(index).map((v) => v.id),
      ['a', 'c', 'd'],
    );
    unregisterIndexedAgent(index, 'a');
    registerIndexedAgent(index, { id: 'a', capabilities: ['ml'], state: 'idle' });
    assert.deepEqual(
      snapshotIndexedAgents(index).map((v) => v.id),
      ['c', 'd', 'a'],
    );
    // capabilities 变异不移位
    setIndexedAgentCapabilities(index, 'c', ['ops']);
    assert.deepEqual(
      snapshotIndexedAgents(index).map((v) => v.id),
      ['c', 'd', 'a'],
    );
    assert.deepEqual(snapshotIndexedAgents(index).find((v) => v.id === 'c')?.capabilities, ['ops']);
  });
});
