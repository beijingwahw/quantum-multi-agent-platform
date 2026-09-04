/**
 * 零依赖属性测试（property-based）：以仓内种子化 PRNG 生成随机实例，
 * 对核心机制做不变量对盲——不引入 fast-check 等外部依赖，生成器本身
 * 确定性可复现（与本仓"给定种子完全可复现"的纪律一致）。
 *
 * 属性 1：MinCostFlow 自由处置变体的最优性
 *   随机二部图（agents×tasks，容量 1..3，score 可正可负——负分不建边，
 *   等价于弃标）上，run(S,T) 的 −cost 必须等于穷举全部部分分配的
 *   最大福利。穷举在 ≤4×4 规模精确可行，200 个实例覆盖。
 * 属性 2：确定性——同实例两次求解逐位一致。
 * 属性 3：解的结构合法性——占用边不超任务出度 1、不超 agent 容量。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinCostFlow } from '../src/core/min-cost-flow.js';
import { mulberry32 } from '../src/utils/rng.js';

interface BipartiteInstance {
  agentCaps: number[];
  /** scores[a][t]：agent a 执行任务 t 的福利（负 = 不建边，自由处置） */
  scores: number[][];
}

function randomInstance(rng: () => number): BipartiteInstance {
  const k = 2 + Math.floor(rng() * 3); // agents 2..4
  const n = 2 + Math.floor(rng() * 3); // tasks 2..4
  const agentCaps = Array.from({ length: k }, () => 1 + Math.floor(rng() * 3));
  const scores = Array.from(
    { length: k },
    () => Array.from({ length: n }, () => rng() * 3 - 0.8), // ~24% 为负（弃标压力）
  );
  return { agentCaps, scores };
}

/** 按求解器同构的方式建流网络（S=0，agents，tasks，sink） */
function buildFlow(inst: BipartiteInstance) {
  const k = inst.agentCaps.length;
  const n = inst.scores[0]!.length;
  const S = 0;
  const taskBase = 1 + k;
  const sink = taskBase + n;
  const mcf = new MinCostFlow(sink + 1);
  for (let a = 0; a < k; a++) mcf.addEdge(S, 1 + a, inst.agentCaps[a]!, 0);
  const pairRefs: Array<{ a: number; t: number; ref: ReturnType<MinCostFlow['addEdge']> }> = [];
  for (let a = 0; a < k; a++) {
    for (let t = 0; t < n; t++) {
      const score = inst.scores[a]![t]!;
      if (score <= 0) continue; // 免费处置：负分组合永不入最优解
      pairRefs.push({ a, t, ref: mcf.addEdge(1 + a, taskBase + t, 1, -score) });
    }
  }
  for (let t = 0; t < n; t++) mcf.addEdge(taskBase + t, sink, 1, 0);
  return { mcf, S, sink, k, n, pairRefs };
}

/** 穷举全部部分分配（task → agent 或未分配，容量约束）的最大福利 */
function bruteForceWelfare(inst: BipartiteInstance): number {
  const k = inst.agentCaps.length;
  const n = inst.scores[0]!.length;
  let best = 0; // 全弃标 = 0（免费处置的下界）
  const usage = new Array<number>(k).fill(0);
  const recurse = (t: number, acc: number): void => {
    if (t === n) {
      if (acc > best) best = acc;
      return;
    }
    recurse(t + 1, acc); // 任务 t 弃标
    for (let a = 0; a < k; a++) {
      if (usage[a]! >= inst.agentCaps[a]!) continue;
      usage[a]!++;
      recurse(t + 1, acc + inst.scores[a]![t]!);
      usage[a]!--;
    }
  };
  recurse(0, 0);
  return best;
}

describe('属性测试 · MinCostFlow 自由处置最优性（零依赖）', () => {
  it('200 随机实例：−cost 恒等于穷举最大福利', () => {
    const rng = mulberry32(20260904);
    for (let trial = 0; trial < 200; trial++) {
      const inst = randomInstance(rng);
      const { mcf, S, sink } = buildFlow(inst);
      const { cost } = mcf.run(S, sink);
      const expected = bruteForceWelfare(inst);
      assert.ok(
        Math.abs(-cost - expected) < 1e-9,
        `trial ${trial}: MCF 福利 ${-cost} ≠ 穷举 ${expected}`,
      );
    }
  });

  it('确定性：同实例两次求解 {flow, cost} 逐位一致', () => {
    const rng = mulberry32(777);
    for (let trial = 0; trial < 30; trial++) {
      const inst = randomInstance(rng);
      const r1 = buildFlow(inst);
      const r2 = buildFlow(inst);
      const s1 = r1.mcf.run(r1.S, r1.sink);
      const s2 = r2.mcf.run(r2.S, r2.sink);
      assert.deepEqual(s1, s2);
    }
  });

  it('结构合法性：占用边不超任务出度 1、不超 agent 容量', () => {
    const rng = mulberry32(31337);
    for (let trial = 0; trial < 100; trial++) {
      const inst = randomInstance(rng);
      const { mcf, S, sink, k, pairRefs } = buildFlow(inst);
      mcf.run(S, sink);
      const perAgent = new Array<number>(k).fill(0);
      const perTask = new Map<number, number>();
      for (const { a, t, ref } of pairRefs) {
        if (mcf.edgeOccupied(ref)) {
          perAgent[a]!++;
          perTask.set(t, (perTask.get(t) ?? 0) + 1);
        }
      }
      for (let a = 0; a < k; a++) {
        assert.ok(
          perAgent[a]! <= inst.agentCaps[a]!,
          `trial ${trial}: agent ${a} 超容量（${perAgent[a]!} > ${inst.agentCaps[a]!}）`,
        );
      }
      for (const count of perTask.values()) {
        assert.ok(count <= 1, `trial ${trial}: 任务被占用 ${count} 次`);
      }
    }
  });
});
