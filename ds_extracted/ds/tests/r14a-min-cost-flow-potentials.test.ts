/**
 * R14-A 创新 2 测试：位势驱动的最小费用流（min-cost-flow-potentials）。
 *
 * 钉板内容：
 * ① 语义镜像：与 MinCostFlow 同款单元场景（单负费用路 / 自由处置 /
 *    多路排序 / 容量竞争 / 幂等重跑 / 越界拒绝）；
 * ② 对照认证：与 SPFA 实现在随机 DAG 上 {flow, cost} 一致（150 实例，
 *    整数费用逐位相等、浮点费用容差一致）——两个独立实现算出同一最优；
 * ③ 同实例增量重解（构造性省功）：单调递减分数的任务到达序列，
 *    增量代数和 = 冷重建，零环取消，确定性松弛计数 ~4.8× 下降；
 * ④ 同实例增量·置换：高分到达诱发负环 → 环消除兜底，代数和 = 冷重建
 *    （正确性），计数如实记录（不设省功断言——实测更贵，见模块头注）；
 * ⑤ 最小置换案例 + 原版语义对照：SPFA 版「run→加边→run」静默停在
 *    次优（代数和 −1 ≠ 冷解 −5），本实现兑现改进（−5）——
 *    既有 MinCostFlow 重复 run 增量语义的陷阱证据（报告项，不修既有文件）；
 * ⑥ 跨实例位势迁移（λ 变化 / pivot 删边）：启发式热启动——正确性与
 *    冷解/SPFA 三方一致（迁移可行性无构造性保证，只锚定正确性）；
 * ⑦ 负环具名拒绝（全新图）；⑧ 确定性重跑；⑨ 负对照具名拒绝；
 * ⑩ 可选 bench-kit A/B：墙钟判决只记录不预设（已实测 SSP+堆在 140×160
 *    WDP 上慢于 SPFA——诚实边界，见模块头注）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinCostFlow } from '../src/core/min-cost-flow.js';
import { MinCostFlowPotentials } from '../src/core/min-cost-flow-potentials.js';
import { MechanismError } from '../src/utils/errors.js';
import { mulberry32 } from '../src/utils/rng.js';
import { comparePaired } from './bench/bench-kit.js';

describe('R14-A · 语义镜像（与 min-cost-flow.test.ts 同款场景）', () => {
  it('单条负费用路径：满流推进，费用 = 流×单位费用', () => {
    const f = new MinCostFlowPotentials(4);
    f.addEdge(0, 1, 1, -2);
    f.addEdge(1, 3, 1, -1);
    const { flow, cost } = f.run(0, 3);
    assert.equal(flow, 1);
    assert.equal(cost, -3);
  });

  it('自由处置：边际费用非负的路径不推进', () => {
    const f = new MinCostFlowPotentials(4);
    f.addEdge(0, 1, 1, -2);
    f.addEdge(1, 3, 1, 5);
    const { flow, cost } = f.run(0, 3);
    assert.equal(flow, 0);
    assert.equal(cost, 0);
  });

  it('多条路径按费用升序推进至无利可图（手算对照）', () => {
    const f = new MinCostFlowPotentials(6);
    f.addEdge(0, 1, 1, -1);
    f.addEdge(1, 3, 1, -2);
    f.addEdge(0, 2, 1, 0);
    f.addEdge(2, 4, 1, -1);
    f.addEdge(3, 5, 2, 0);
    f.addEdge(4, 5, 2, 0);
    const { flow, cost } = f.run(0, 5);
    assert.equal(flow, 2);
    assert.equal(cost, -4);
  });

  it('容量竞争：费用更低的路径吃满容量，便宜边 edgeOccupied=true', () => {
    const f = new MinCostFlowPotentials(4);
    const cheap = f.addEdge(0, 1, 1, -5);
    f.addEdge(0, 2, 2, -1);
    f.addEdge(1, 3, 1, 0);
    f.addEdge(2, 3, 2, 0);
    const { flow, cost } = f.run(0, 3);
    assert.equal(flow, 3);
    assert.equal(cost, -7);
    assert.equal(f.edgeOccupied(cheap), true);
  });

  it('重复 run 幂等（已最优，无新增强路）；位势在求解间保留', () => {
    const f = new MinCostFlowPotentials(3);
    f.addEdge(0, 1, 1, -1);
    f.addEdge(1, 2, 1, -1);
    const first = f.run(0, 2);
    const second = f.run(0, 2);
    assert.deepEqual(first, { flow: 1, cost: -2 });
    assert.deepEqual(second, { flow: 0, cost: 0 });
    assert.ok(f.getPotentials() !== null);
  });

  it('求解前 getPotentials 为 null；越界节点拒绝', () => {
    const f = new MinCostFlowPotentials(2);
    assert.equal(f.getPotentials(), null);
    assert.throws(
      () => f.addEdge(5, 1, 1, 1),
      (err: unknown) => err instanceof MechanismError && err.message.includes('out of range'),
    );
    assert.throws(() => f.run(0, 9), /out of range/);
  });
});

describe('R14-A · 对照认证：与 SPFA 实现的随机对拍', () => {
  interface DagSpec {
    readonly n: number;
    readonly edges: ReadonlyArray<readonly [number, number, number, number]>;
    readonly s: number;
    readonly t: number;
  }

  /** u<v 的 DAG（初始无有向环 → 残量网络经 SSP 不产生负环，两家都可终止） */
  function randomDag(rng: () => number, floatCosts: boolean): DagSpec {
    const n = 5 + Math.floor(rng() * 18);
    const edgeCount = 3 * n + Math.floor(rng() * 3 * n);
    const edges: Array<[number, number, number, number]> = [];
    const seen = new Set<string>();
    for (let e = 0; e < edgeCount; e++) {
      let u = Math.floor(rng() * (n - 1));
      let v = 1 + Math.floor(rng() * (n - 1));
      if (u === v) v = Math.min(n - 1, v + 1);
      if (u === v) continue;
      if (u > v) [u, v] = [v, u];
      const key = `${u}:${v}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cap = 1 + Math.floor(rng() * 4);
      const cost = floatCosts ? +(rng() * 10 - 5).toFixed(3) : Math.floor(rng() * 11) - 5;
      edges.push([u, v, cap, cost]);
    }
    return { n, edges, s: 0, t: n - 1 };
  }

  function runBoth(spec: DagSpec): {
    a: { flow: number; cost: number };
    b: { flow: number; cost: number };
  } {
    const spfa = new MinCostFlow(spec.n);
    const ssp = new MinCostFlowPotentials(spec.n);
    for (const [u, v, cap, cost] of spec.edges) {
      spfa.addEdge(u, v, cap, cost);
      ssp.addEdge(u, v, cap, cost);
    }
    return { a: spfa.run(spec.s, spec.t), b: ssp.run(spec.s, spec.t) };
  }

  it('整数费用：{flow, cost} 逐位相等（80 实例）', () => {
    const rng = mulberry32(20260914);
    for (let inst = 0; inst < 80; inst++) {
      const { a, b } = runBoth(randomDag(rng, false));
      assert.deepEqual(b, a, `实例${inst}：SSP ${JSON.stringify(b)} ≠ SPFA ${JSON.stringify(a)}`);
    }
  });

  it('浮点费用：flow 相等、cost 容差一致（70 实例）', () => {
    const rng = mulberry32(20260915);
    for (let inst = 0; inst < 70; inst++) {
      const { a, b } = runBoth(randomDag(rng, true));
      assert.equal(b.flow, a.flow, `实例${inst}`);
      assert.ok(
        Math.abs(b.cost - a.cost) <= 1e-9 * Math.max(1, Math.abs(a.cost)),
        `实例${inst}：cost ${b.cost} vs ${a.cost}`,
      );
    }
  });

  it('确定性：同输入重跑，SSP 结果与操作计数逐字段一致', () => {
    const rng = mulberry32(99);
    const spec = randomDag(rng, false);
    const runOnce = (): unknown => {
      const ssp = new MinCostFlowPotentials(spec.n);
      for (const [u, v, cap, cost] of spec.edges) ssp.addEdge(u, v, cap, cost);
      return { result: ssp.run(spec.s, spec.t), metrics: ssp.metrics() };
    };
    assert.deepEqual(runOnce(), runOnce());
  });
});

// ----------------------------------------------------------------------------
// WDP 形态图（镜像 batch-vcg-scheduler.solveWDP 的建图）：
// S=0 → agents(容量) → tasks(单位) → sink，费用 = −score（score>0 才建边）
// ----------------------------------------------------------------------------

const AGENTS = 24;
const BASE_TASKS = 30;
const TOTAL_TASKS = 36;
const SINK = 1 + AGENTS + TOTAL_TASKS; // 汇固定：预留全部任务节点（增量场景）

function vOf(a: number, t: number): number {
  return 3 + (((a * 7 + t * 13) % 17) / 10) * 2;
}
function bOf(a: number): number {
  return 1 + (a % 5) / 2;
}
/** 基础任务集（λ=0.4、μ=1 的得分结构） */
function baseEdges(): Array<[number, number, number, number]> {
  const edges: Array<[number, number, number, number]> = [];
  for (let a = 0; a < AGENTS; a++) edges.push([0, 1 + a, 2, 0]);
  for (let a = 0; a < AGENTS; a++) {
    for (let t = 0; t < BASE_TASKS; t++) {
      if ((a * 7 + t * 13) % 3 === 0) continue; // 能力资格
      const score = vOf(a, t) - 0.4 - bOf(a);
      if (score <= 0) continue; // 免费处置
      edges.push([1 + a, 1 + AGENTS + t, 1, -score]);
    }
  }
  for (let t = 0; t < BASE_TASKS; t++) edges.push([1 + AGENTS + t, SINK, 1, 0]);
  return edges;
}
/** 到达任务 t（t ≥ BASE_TASKS）：全 agent 资格、指定分数 */
function arrivalEdges(t: number, score: number): Array<[number, number, number, number]> {
  const edges: Array<[number, number, number, number]> = [];
  for (let a = 0; a < AGENTS; a++) edges.push([1 + a, 1 + AGENTS + t, 1, -score]);
  edges.push([1 + AGENTS + t, SINK, 1, 0]);
  return edges;
}
/** k 任务全量冷解（与增量同一固定汇） */
function coldSolve(
  arrived: number,
  arrivalScore: (t: number) => number,
): { flow: number; cost: number } {
  const f = new MinCostFlow(2 + AGENTS + TOTAL_TASKS);
  for (const e of baseEdges()) f.addEdge(e[0], e[1], e[2], e[3]);
  for (let t = BASE_TASKS; t < arrived; t++) {
    for (const e of arrivalEdges(t, arrivalScore(t))) f.addEdge(e[0], e[1], e[2], e[3]);
  }
  return f.run(0, SINK);
}

describe('R14-A · 同实例增量重解：单调递减到达（构造性省功）', () => {
  it('增量代数和 = 冷解终态；零环取消；确定性松弛计数 ~4.8× 下降', () => {
    const decreasing = (t: number): number => 0.09 - (t - BASE_TASKS) * 0.01; // 0.09→0.04

    const inc = new MinCostFlowPotentials(2 + AGENTS + TOTAL_TASKS);
    for (const e of baseEdges()) inc.addEdge(e[0], e[1], e[2], e[3]);
    let incFlow = 0;
    let incCost = 0;
    let r = inc.run(0, SINK);
    incFlow += r.flow;
    incCost += r.cost;
    for (let t = BASE_TASKS; t < TOTAL_TASKS; t++) {
      for (const e of arrivalEdges(t, decreasing(t))) inc.addEdge(e[0], e[1], e[2], e[3]);
      r = inc.run(0, SINK);
      incFlow += r.flow;
      incCost += r.cost;
    }
    const m = inc.metrics();

    // 正确性：终态 = 冷解（flow 与 cost）
    const coldFinal = coldSolve(TOTAL_TASKS, decreasing);
    assert.equal(incFlow, coldFinal.flow);
    assert.ok(Math.abs(incCost - coldFinal.cost) <= 1e-9 * Math.max(1, Math.abs(coldFinal.cost)));

    // 构造性性质：递减分数不可能置换任何已分配对 → 零环取消
    assert.equal(m.cycleCancellations, 0, '递减到达不应触发负环');
    assert.ok(m.potentialRepairs >= TOTAL_TASKS - BASE_TASKS, '每次到达至少一次可行化修复');

    // 省功（确定性计数）：冷系列（每步全量重解）总松弛 vs 增量总松弛
    let coldRelaxations = 0;
    for (let k = BASE_TASKS; k <= TOTAL_TASKS; k++) {
      const f = new MinCostFlowPotentials(2 + AGENTS + TOTAL_TASKS);
      for (const e of baseEdges()) f.addEdge(e[0], e[1], e[2], e[3]);
      for (let t = BASE_TASKS; t < k; t++) {
        for (const e of arrivalEdges(t, decreasing(t))) f.addEdge(e[0], e[1], e[2], e[3]);
      }
      f.run(0, SINK);
      coldRelaxations += f.metrics().edgeRelaxations;
    }
    assert.ok(
      m.edgeRelaxations < coldRelaxations / 2,
      `增量松弛 ${m.edgeRelaxations} 应 < 冷系列 ${coldRelaxations} 的一半`,
    );
    console.log(
      `[r14a incremental] relaxations: incremental=${m.edgeRelaxations} cold-series=${coldRelaxations}`,
    );
  });
});

describe('R14-A · 同实例增量重解：置换到达（环消除兜底，正确性）', () => {
  it('高分到达诱发负环 → 环消除后增量代数和 = 冷解；计数如实记录（不设省功断言）', () => {
    const displacing = (t: number): number => vOf(0, t) + 5; // 高分：必然置换边际旧对

    const inc = new MinCostFlowPotentials(2 + AGENTS + TOTAL_TASKS);
    for (const e of baseEdges()) inc.addEdge(e[0], e[1], e[2], e[3]);
    let incFlow = 0;
    let incCost = 0;
    let r = inc.run(0, SINK);
    incFlow += r.flow;
    incCost += r.cost;
    for (let t = BASE_TASKS; t < TOTAL_TASKS; t++) {
      for (const e of arrivalEdges(t, displacing(t))) inc.addEdge(e[0], e[1], e[2], e[3]);
      r = inc.run(0, SINK);
      incFlow += r.flow;
      incCost += r.cost;
    }
    const m = inc.metrics();

    const coldFinal = coldSolve(TOTAL_TASKS, displacing);
    assert.equal(incFlow, coldFinal.flow);
    assert.ok(Math.abs(incCost - coldFinal.cost) <= 1e-9 * Math.max(1, Math.abs(coldFinal.cost)));

    // 置换确实发生且被环消除处理（Klein 兜底在工作）
    assert.ok(m.cycleCancellations >= 1, '高分到达应至少消除一个负环');
    // 计数如实记录：实测置换路径的环消除比冷重建更贵（伪多项式兜底），
    // 模块头注与报告均已如实声明——此处不设省功断言
    console.log(
      `[r14a displacing] cycleCancellations=${m.cycleCancellations} relaxations=${m.edgeRelaxations}`,
    );
  });

  it('最小置换案例 + 原版语义对照：SPFA 版加边重跑静默停在次优，本实现兑现改进', () => {
    // 图：S→A(容量1)；A→T0(−1)；到达 A→T1(−5)。扩图最优 = 弃 T0 上 T1（−5）。
    const addArrival = (f: MinCostFlow | MinCostFlowPotentials): void => {
      f.addEdge(1, 4, 1, -5);
      f.addEdge(4, 5, 1, 0);
    };

    // 本实现：r1 + r2 代数和 = 冷解 −5（r2 经负环消除兑现置换改进）
    const ssp = new MinCostFlowPotentials(6);
    ssp.addEdge(0, 1, 1, 0);
    ssp.addEdge(1, 3, 1, -1);
    ssp.addEdge(3, 5, 1, 0);
    const r1 = ssp.run(0, 5);
    addArrival(ssp);
    const r2 = ssp.run(0, 5);
    assert.deepEqual(r1, { flow: 1, cost: -1 });
    assert.deepEqual(r2, { flow: 0, cost: -4 }, '置换改进是环成本增量：流不变、成本下降');
    assert.equal(r1.cost + r2.cost, -5);
    assert.equal(ssp.metrics().cycleCancellations, 1);

    // 原版（既有 MinCostFlow）同一场景：加边重跑返回 {0,0}，代数和 −1 ≠ 冷解 −5
    // ——SPFA 只找 s-t 增广路，看不见改进环；增量复用语义的陷阱证据（报告项）
    const spfaInc = new MinCostFlow(6);
    spfaInc.addEdge(0, 1, 1, 0);
    spfaInc.addEdge(1, 3, 1, -1);
    spfaInc.addEdge(3, 5, 1, 0);
    const s1 = spfaInc.run(0, 5);
    addArrival(spfaInc);
    const s2 = spfaInc.run(0, 5);
    assert.deepEqual(s1, { flow: 1, cost: -1 });
    assert.deepEqual(s2, { flow: 0, cost: 0 }, 'SPFA 版错过置换改进（已定罪的现状语义）');

    const spfaCold = new MinCostFlow(6);
    spfaCold.addEdge(0, 1, 1, 0);
    spfaCold.addEdge(1, 3, 1, -1);
    spfaCold.addEdge(3, 5, 1, 0);
    spfaCold.addEdge(1, 4, 1, -5);
    spfaCold.addEdge(4, 5, 1, 0);
    assert.deepEqual(spfaCold.run(0, 5), { flow: 1, cost: -5 });
    // 定罪钉板：原版增量代数和 ≠ 冷解
    assert.notEqual(s1.cost + s2.cost, -5);
  });
});

describe('R14-A · 跨实例位势迁移（启发式热启动）', () => {
  it('VCG pivot（删边）迁移：结果与冷解/SPFA 一致（可行性无保证，只锚定正确性）', () => {
    // 基础解位势 → 迁移到「排除 agent 3」的 pivot 图（fresh 零流）
    const base = new MinCostFlowPotentials(2 + AGENTS + TOTAL_TASKS);
    for (const e of baseEdges()) base.addEdge(e[0], e[1], e[2], e[3]);
    const baseResult = base.run(0, SINK);
    assert.ok(baseResult.flow > 0);
    const pi = base.getPotentials()!;

    const pivotEdges = (): Array<[number, number, number, number]> => {
      const excluded = 3;
      const edges: Array<[number, number, number, number]> = [];
      for (let a = 0; a < AGENTS; a++) {
        if (a === excluded) continue;
        edges.push([0, 1 + a, 2, 0]);
      }
      for (let a = 0; a < AGENTS; a++) {
        if (a === excluded) continue;
        for (let t = 0; t < BASE_TASKS; t++) {
          if ((a * 7 + t * 13) % 3 === 0) continue;
          const score = vOf(a, t) - 0.4 - bOf(a);
          if (score <= 0) continue;
          edges.push([1 + a, 1 + AGENTS + t, 1, -score]);
        }
      }
      for (let t = 0; t < BASE_TASKS; t++) edges.push([1 + AGENTS + t, SINK, 1, 0]);
      return edges;
    };

    const cold = new MinCostFlowPotentials(2 + AGENTS + TOTAL_TASKS);
    for (const e of pivotEdges()) cold.addEdge(e[0], e[1], e[2], e[3]);
    const coldResult = cold.run(0, SINK);

    const warm = new MinCostFlowPotentials(2 + AGENTS + TOTAL_TASKS);
    for (const e of pivotEdges()) warm.addEdge(e[0], e[1], e[2], e[3]);
    warm.injectPotentials(pi); // 启发式：终态残量网络中 cap=0 的边不受位势约束，迁移可违规
    const warmResult = warm.run(0, SINK);

    const referee = new MinCostFlow(2 + AGENTS + TOTAL_TASKS);
    for (const e of pivotEdges()) referee.addEdge(e[0], e[1], e[2], e[3]);
    const refereeResult = referee.run(0, SINK);

    assert.equal(warmResult.flow, coldResult.flow);
    assert.equal(warmResult.flow, refereeResult.flow);
    assert.ok(
      Math.abs(warmResult.cost - refereeResult.cost) <=
        1e-9 * Math.max(1, Math.abs(refereeResult.cost)),
    );
    console.log(
      `[r14a pivot-transfer] warm repairs=${warm.metrics().potentialRepairs} ` +
        `cancels=${warm.metrics().cycleCancellations} ` +
        `(heuristic warm start: correctness anchored, savings not claimed)`,
    );
  });

  it('λ-sweep（费用平移）迁移：SSP 冷/热与 SPFA 三方 {flow,cost} 逐点一致（21 步）', () => {
    let prevPi: number[] | null = null;
    let coldRelaxations = 0;
    let warmRelaxations = 0;
    let warmRepairs = 0;
    for (let step = 0; step <= 20; step++) {
      const lambda = step * 0.2;
      const edges: Array<[number, number, number, number]> = [];
      for (let a = 0; a < AGENTS; a++) edges.push([0, 1 + a, 2, 0]);
      for (let a = 0; a < AGENTS; a++) {
        for (let t = 0; t < BASE_TASKS; t++) {
          if ((a * 7 + t * 13) % 3 === 0) continue;
          const score = vOf(a, t) - lambda - bOf(a);
          if (score <= 0) continue;
          edges.push([1 + a, 1 + AGENTS + t, 1, -score]);
        }
      }
      for (let t = 0; t < BASE_TASKS; t++) edges.push([1 + AGENTS + t, SINK, 1, 0]);

      const cold = new MinCostFlowPotentials(2 + AGENTS + TOTAL_TASKS);
      const warm = new MinCostFlowPotentials(2 + AGENTS + TOTAL_TASKS);
      const referee = new MinCostFlow(2 + AGENTS + TOTAL_TASKS);
      for (const [u, v, cap, cost] of edges) {
        cold.addEdge(u, v, cap, cost);
        warm.addEdge(u, v, cap, cost);
        referee.addEdge(u, v, cap, cost);
      }
      if (prevPi) warm.injectPotentials(prevPi);

      const coldResult = cold.run(0, SINK);
      const warmResult = warm.run(0, SINK);
      const refereeResult = referee.run(0, SINK);

      assert.equal(warmResult.flow, coldResult.flow, `λ=${lambda}`);
      assert.equal(coldResult.flow, refereeResult.flow, `λ=${lambda}`);
      assert.ok(
        Math.abs(warmResult.cost - refereeResult.cost) <=
          1e-9 * Math.max(1, Math.abs(refereeResult.cost)),
        `λ=${lambda}：热 ${warmResult.cost} vs SPFA ${refereeResult.cost}`,
      );
      assert.ok(
        Math.abs(coldResult.cost - refereeResult.cost) <=
          1e-9 * Math.max(1, Math.abs(refereeResult.cost)),
        `λ=${lambda}：冷 ${coldResult.cost} vs SPFA ${refereeResult.cost}`,
      );

      coldRelaxations += cold.metrics().edgeRelaxations;
      warmRelaxations += warm.metrics().edgeRelaxations;
      warmRepairs += warm.metrics().potentialRepairs;
      prevPi = warm.getPotentials();
    }
    console.log(
      `[r14a λ-sweep] relaxations: cold=${coldRelaxations} warm=${warmRelaxations} ` +
        `(warm repairs=${warmRepairs}/21 — counts recorded, direction not asserted)`,
    );
  });
});

describe('R14-A · 负环与负对照', () => {
  it('全新图含负环：具名拒绝而非无界循环', () => {
    const f = new MinCostFlowPotentials(3);
    f.addEdge(0, 1, 5, 0);
    f.addEdge(1, 2, 5, -1);
    f.addEdge(2, 1, 5, -1); // 1↔2 负费用环（−2）
    assert.throws(
      () => f.run(0, 2),
      (err: unknown) => err instanceof MechanismError && err.message.includes('negative cycle'),
    );
  });

  it('构造期与建边域校验：节点数、cap、cost、源汇', () => {
    for (const bad of [-1, 2.5]) {
      assert.throws(
        () => new MinCostFlowPotentials(bad),
        (err: unknown) => err instanceof MechanismError && err.message.includes('node count'),
        `n=${String(bad)}`,
      );
    }
    const f = new MinCostFlowPotentials(2);
    assert.throws(
      () => f.addEdge(0, 1, -1, -2),
      (err: unknown) => err instanceof MechanismError && err.message.includes('cap must be'),
    );
    assert.throws(
      () => f.addEdge(0, 1, 1, Number.NaN),
      (err: unknown) => err instanceof MechanismError && err.message.includes('cost must be'),
    );
    assert.throws(
      () => f.run(0.5, 1),
      (err: unknown) => err instanceof MechanismError && err.message.includes('source must be'),
    );
  });

  it('injectPotentials：长度不符 / 非有限值 / strict 违规：具名拒绝', () => {
    const f = new MinCostFlowPotentials(3);
    f.addEdge(0, 1, 2, -5);
    f.addEdge(1, 2, 2, 0);
    assert.throws(
      () => f.injectPotentials([0, 0]),
      (err: unknown) =>
        err instanceof MechanismError && err.message.includes('must equal node count 3'),
    );
    assert.throws(
      () => f.injectPotentials([0, Number.NaN, 0]),
      (err: unknown) =>
        err instanceof MechanismError && err.message.includes('potentials[1] must be'),
    );
    // 全零位势对 0→1 的 −5 边不可行：strict 模式点名该残边
    assert.throws(
      () => f.injectPotentials([0, 0, 0], { strict: true }),
      (err: unknown) =>
        err instanceof MechanismError &&
        err.message.includes('0→1') &&
        err.message.includes('feasibility'),
    );
    // 可行位势（π=[5,0,0]：归约费用 −5+5−0=0）strict 接受且求解正确
    f.injectPotentials([5, 0, 0], { strict: true });
    assert.deepEqual(f.run(0, 2), { flow: 2, cost: -10 });
  });
});

describe('R14-A · 可选墙钟 A/B（bench-kit，判决只记录不预设）', () => {
  it('大 WDP 单解：SSP(位势) vs SPFA——A/A 效度守卫不满足则 skip', (t) => {
    const buildOnce = (Impl: typeof MinCostFlow | typeof MinCostFlowPotentials): (() => void) => {
      return () => {
        const agents = 140;
        const tasks = 160;
        const sink = 1 + agents + tasks;
        const f = new (Impl as new (n: number) => InstanceType<typeof Impl>)(2 + agents + tasks);
        for (let a = 0; a < agents; a++) f.addEdge(0, 1 + a, 2, 0);
        for (let a = 0; a < agents; a++) {
          for (let task = 0; task < tasks; task++) {
            if ((a * 7 + task * 13) % 3 === 0) continue;
            const v = 3 + (((a * 7 + task * 13) % 17) / 10) * 2;
            const b = 1 + (a % 5) / 2;
            const score = v - 0.5 - b;
            if (score <= 0) continue;
            f.addEdge(1 + a, 1 + agents + task, 1, -score);
          }
        }
        for (let task = 0; task < tasks; task++) f.addEdge(1 + agents + task, sink, 1, 0);
        f.run(0, sink);
      };
    };

    const aa = comparePaired(
      { name: 'ssp-1', run: buildOnce(MinCostFlowPotentials) },
      { name: 'ssp-2', run: buildOnce(MinCostFlowPotentials) },
      { rounds: 12, warmupRounds: 4, seed: 4141 },
    );
    if (aa.verdict === 'inconclusive') {
      t.skip(`A/A 控制遇敌对环境：${aa.note}`);
      return;
    }
    assert.equal(aa.verdict, 'no-difference', aa.note);

    const report = comparePaired(
      { name: 'spfa', run: buildOnce(MinCostFlow) },
      { name: 'ssp-potentials', run: buildOnce(MinCostFlowPotentials) },
      { rounds: 12, warmupRounds: 4, seed: 4242 },
    );
    if (report.verdict === 'inconclusive') {
      t.skip(`测量环境敌对，本轮不判：${report.note}`);
      return;
    }
    // 墙钟判决如实入档（实测本机 140×160 WDP 上 SSP+堆慢于 SPFA——不预设方向）
    assert.ok(
      report.verdict === 'b-faster' ||
        report.verdict === 'b-slower' ||
        report.verdict === 'no-difference',
    );
    console.log(`[r14a mcf wallclock] ${report.note}`);
  });
});
