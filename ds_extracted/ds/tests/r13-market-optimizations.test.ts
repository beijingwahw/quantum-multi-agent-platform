/**
 * R13 性能波（市场机制与大脑象限）行为钉:对 min-cost-flow SPFA 缓冲复用、
 * BatchVCG valueOf 入口级记忆、CompoundBrain 能力 Set / EWMA 单遍分组 /
 * advise 预计算、匈牙利内环外提等优化的「数值位级不变」承诺。
 *
 * 全部期望值取自优化前实装的确定性输出（.tmp 捕获脚本经 String 最短
 * 往返表示导出后回填为数值字面量——字面量解析回同一 double，断言
 * strictEqual 即逐位比较）。任何一条漂移 = 优化改变了可观测行为。
 * 场景覆盖:精确/预算紧/仿射/短视四条分配路径、DSIC 虚报证书、
 * 40 轮长程结算（履历→估值反馈环）、大脑 60 批学习+校准+相变顾问、
 * 增长市场三种策略、MCF 占用模式、bench 对手（匈牙利/局部搜索）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { BatchVCGScheduler, BudgetPacer } from '../src/core/batch-vcg-scheduler.js';
import { CompoundBrain } from '../src/core/compound-brain.js';
import { CompoundBrainSimulator } from '../src/core/compound-brain-simulator.js';
import { GrowthMarketScheduler } from '../src/core/growth-market-scheduler.js';
import { MinCostFlow } from '../src/core/min-cost-flow.js';
import { hungarianAssignment, localSearchAssignment } from '../src/core/classical-baselines.js';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { Mulberry32 } from '../src/utils/rng.js';

// ---------- 共享测试装置（与捕获脚本逐字段一致，顺序即语义） ----------

const VCG_AGENTS: Array<{
  id: string;
  capabilities: string[];
  trueCost: number;
  trueQuality: Record<string, number>;
  capacity: number;
  credentialQuality?: Record<string, number>;
  bidMarkup?: number;
}> = [
  {
    id: 'alpha',
    capabilities: ['code', 'review'],
    trueCost: 2.1,
    trueQuality: { code: 0.7, review: 0.6 },
    capacity: 2,
    credentialQuality: { code: 0.65, review: 0.55 },
  },
  {
    id: 'beta',
    capabilities: ['code', 'test'],
    trueCost: 1.4,
    trueQuality: { code: 0.5, test: 0.8 },
    capacity: 1,
    bidMarkup: 0.12,
  },
  {
    id: 'gamma',
    capabilities: ['review', 'test'],
    trueCost: 3.3,
    trueQuality: { review: 0.9, test: 0.4 },
    capacity: 2,
  },
  {
    id: 'delta',
    capabilities: ['code', 'review', 'test'],
    trueCost: 2.9,
    trueQuality: { code: 0.62, review: 0.58, test: 0.71 },
    capacity: 1,
  },
];

const VCG_TASKS = ['code', 'review', 'test', 'code', 'review'];

function mkVcg(): BatchVCGScheduler {
  const s = new BatchVCGScheduler({ exploreCoefficient: 0.25, switchCostRate: 0.04 });
  for (const a of VCG_AGENTS) s.register(a);
  return s;
}

function mkBrain(): CompoundBrain {
  const b = new CompoundBrain({ growthHorizon: 50, exploreCoefficient: 0.4, shareAlpha: 0.15 });
  b.registerAgent({
    id: 'senior',
    capabilities: ['nlp', 'vision'],
    trueCost: 2.5,
    trueQuality: { nlp: 0.75, vision: 0.7 },
    credentialQuality: { nlp: 0.72, vision: 0.68 },
    capacity: 2,
  });
  b.registerAgent({
    id: 'junior',
    capabilities: ['nlp'],
    trueCost: 0.9,
    trueQuality: { nlp: 0.45 },
  });
  b.registerAgent({
    id: 'generalist',
    capabilities: ['nlp', 'vision', 'audio'],
    trueCost: 1.8,
    trueQuality: { nlp: 0.55, vision: 0.5, audio: 0.6 },
    capacity: 3,
  });
  return b;
}

function mkGrowth(): GrowthMarketScheduler {
  const g = new GrowthMarketScheduler({ exploreCoefficient: 0.3, switchCostRate: 0.05 });
  g.register({
    id: 'a1',
    capabilities: ['x', 'y'],
    trueCost: 1.2,
    trueQuality: { x: 0.6, y: 0.5 },
  });
  g.register({
    id: 'a2',
    capabilities: ['x'],
    trueCost: 2.0,
    trueQuality: { x: 0.75 },
    bidMarkup: 0.1,
  });
  g.register({
    id: 'a3',
    capabilities: ['x', 'z'],
    trueCost: 0.8,
    trueQuality: { x: 0.45, z: 0.65 },
  });
  return g;
}

// ---------- 1. BatchVCG: 四条分配路径的位级快照 ----------

test('精确 VCG 路径:分配/支付/福利逐位不变（valueOf 记忆化不动数字）', () => {
  const alloc = mkVcg().allocateBatch([...VCG_TASKS]);
  assert.deepEqual(
    alloc.assignments.map((a) => [a.agentId, a.capability]),
    [
      ['alpha', 'code'],
      ['delta', 'review'],
      ['beta', 'test'],
      ['alpha', 'code'],
      ['gamma', 'review'],
    ],
  );
  // Clarke pivot 支付（round9 后的精确 double）
  assert.strictEqual(alloc.payments.alpha, 11.3);
  assert.strictEqual(alloc.payments.beta, 3.3);
  assert.strictEqual(alloc.payments.gamma, 5);
  assert.strictEqual(alloc.payments.delta, 3.3);
  assert.strictEqual(alloc.totalPayment, 22.9);
  assert.strictEqual(alloc.welfare, 16.032);
  assert.strictEqual(alloc.maxWelfare, 16.032);
  assert.strictEqual(alloc.efficiencyLoss, 0);
  assert.strictEqual(alloc.platformTake, 5.1);
  assert.strictEqual(alloc.droppedTasks, 0);
  assert.strictEqual(alloc.assignments[0]!.paymentShare, 5.65);
  assert.strictEqual(alloc.assignments[3]!.paymentShare, 5.65);
});

test('预算紧路径:λ 二分收敛与支付逐位不变（62 次重解 × 记忆化）', () => {
  const alloc = mkVcg().allocateBatch([...VCG_TASKS], { budget: 3.7 });
  assert.strictEqual(alloc.lambda, 4.4);
  assert.strictEqual(alloc.welfare, 0);
  assert.strictEqual(alloc.totalPayment, 0);
  assert.strictEqual(alloc.platformTake, 0);
  assert.strictEqual(alloc.exactDSIC, false);
  assert.deepEqual(alloc.payments, {});
});

test('仿射 μ-VCG 路径:乘子定价逐位不变', () => {
  const alloc = mkVcg().allocateAffineBatch([...VCG_TASKS], { lambda: 0.3, mu: 1.6 });
  assert.strictEqual(alloc.payments.alpha, 7.75);
  assert.strictEqual(alloc.payments.beta, 2.9375);
  assert.strictEqual(alloc.payments.delta, 2.9375);
  assert.strictEqual(alloc.totalPayment, 13.625);
  assert.strictEqual(alloc.welfare, 14.332);
  assert.strictEqual(alloc.mu, 1.6);
  assert.strictEqual(alloc.exactDSIC, true);
});

test('短视基线:单任务 pivot 支付逐位不变', () => {
  const alloc = mkVcg().allocateMyopic([...VCG_TASKS]);
  assert.strictEqual(alloc.payments.alpha, 6.468);
  assert.strictEqual(alloc.payments.beta, 2.9);
  assert.strictEqual(alloc.payments.delta, 5);
  assert.strictEqual(alloc.payments.gamma, 5);
  assert.strictEqual(alloc.welfare, 15.032);
  assert.strictEqual(alloc.efficiencyLoss, 1);
});

test('DSIC 证书:精确路径虚报收益恒 0（含预算 6 的紧边界）', () => {
  const r = mkVcg().measureMisreportGain([...VCG_TASKS], 'beta', [0, 0.2, 0.5, 1.0], { budget: 6 });
  assert.strictEqual(r.maxGain, 0);
  assert.strictEqual(r.bestMarkup, 0.12); // 原报价（如实+固有 markup）已最优
  assert.strictEqual(r.details.length, 5);
});

test('40 轮长程模拟:履历→估值反馈环的净福利/利润逐位不变', () => {
  const s = mkVcg();
  const caps = ['code', 'review', 'test'] as const;
  const pays: number[] = [];
  for (let i = 0; i < 40; i++) {
    const batch = Array.from({ length: 3 }, (_, k) => caps[(i + k) % 3]!);
    const r = s.simulateBatch(batch, i % 7 === 0 ? { budget: 4.5 } : {});
    pays.push(r.allocation.totalPayment);
  }
  // 末三轮支付（round9 精确值,截获自优化前实装）
  assert.strictEqual(pays[37], 16.279996596);
  assert.strictEqual(pays[38], 16.377346749);
  assert.strictEqual(pays[39], 16.189202902);
  const snap = s.getSnapshot();
  assert.deepStrictEqual(
    snap.map((a) => [a.id, a.profit]),
    [
      ['alpha', 248.31],
      ['beta', 117.14],
      ['gamma', 0],
      ['delta', 0],
    ],
  );
  assert.strictEqual(s.getWindowSuccessRate(10, 60), 0.88);
});

test('BudgetPacer:对偶上升序列逐位不变', () => {
  const pacer = new BudgetPacer(5, 0.5, 50);
  const mus: number[] = [];
  for (const spend of [4.9, 6.1, 2.2, 5.0, 0.3]) {
    pacer.update(spend);
    mus.push(pacer.getMu());
  }
  assert.deepStrictEqual(mus, [1, 1.104536101718726, 1, 1, 1]);
});

// ---------- 2. CompoundBrain: 学习/校准/增长全链路 ----------

test('60 批学习模拟:增广福利/校准报告/相变顾问逐位不变', () => {
  const b = mkBrain();
  const sim = new CompoundBrainSimulator(b, { simAlpha: 0.35, simBeta: 0.12, seed: 42 });
  const capSeq = ['nlp', 'vision', 'nlp', 'audio', 'nlp', 'vision'] as const;
  let last: { wa: number; wc: number; gi: number; rw: number } | null = null;
  for (let i = 0; i < 60; i++) {
    const tasks = Array.from({ length: 3 }, (_, k) => ({
      capability: capSeq[(i * 2 + k) % 6]!,
      value: 8 + ((i * 7 + k * 3) % 9),
    }));
    const r = sim.simulateBatch(tasks);
    last = {
      wa: r.allocation.welfareAugmented,
      wc: r.allocation.welfareCurrent,
      gi: r.allocation.growthInvestment,
      rw: r.realizedWelfare,
    };
  }
  // 末批四元组（全精度未舍入值,优化前实装逐位捕获）
  assert.strictEqual(last!.wa, 29.0028029755872);
  assert.strictEqual(last!.wc, 26.11905073663541);
  assert.strictEqual(last!.gi, 2.883752238951791);
  assert.strictEqual(last!.rw, 3.9000000000000004);
  // 校准报告(在线学习曲线拟合,fitGrid 缓存路径)
  const cal = new Map(b.calibrations().map((c) => [c.capability, c]));
  assert.strictEqual(cal.get('nlp')!.alphaHat, 0.44);
  assert.strictEqual(cal.get('nlp')!.betaHat, 0.23040929760558446);
  assert.strictEqual(cal.get('nlp')!.r2, 0.08869722571883865);
  assert.strictEqual(cal.get('nlp')!.attempts, 120);
  assert.strictEqual(cal.get('nlp')!.learnable, false);
  assert.strictEqual(cal.get('vision')!.alphaHat, 1);
  assert.strictEqual(cal.get('vision')!.betaHat, 0.05688529308438416);
  assert.strictEqual(cal.get('vision')!.r2, 0.1929812446267858);
  assert.strictEqual(cal.get('vision')!.learnable, true);
  assert.strictEqual(cal.get('audio')!.alphaHat, 0);
  assert.strictEqual(cal.get('audio')!.learnable, false);
  // 全局状态
  const st = b.getState();
  assert.strictEqual(st.settledCount, 180);
  assert.strictEqual(st.netWelfare, 1321.1000000000015);
  assert.strictEqual(st.pendingBacklog.count, 0);
  // 相变顾问（advise 预计算路径的 K_min 闭式值）
  const advice = new Map(b.advise().map((a) => [a.capability, a]));
  const nlpInc = new Map(advice.get('nlp')!.incubations.map((i) => [i.agentId, i.kMin]));
  assert.strictEqual(nlpInc.get('senior'), 0);
  assert.strictEqual(nlpInc.get('junior'), null);
  assert.strictEqual(nlpInc.get('generalist'), null);
  const visionInc = new Map(advice.get('vision')!.incubations.map((i) => [i.agentId, i.kMin]));
  assert.strictEqual(visionInc.get('senior'), 0);
  assert.strictEqual(visionInc.get('generalist'), 25.983074163226682);
});

test('批量结算 + 单任务入口:taskId 序列与支付逐位不变', () => {
  const b = mkBrain();
  const alloc = b.allocateBatch([
    { capability: 'nlp', value: 9 },
    { capability: 'vision', value: 7 },
    { capability: 'nlp', value: 6 },
  ]);
  assert.deepStrictEqual(
    alloc.assignments.map((a) => a.taskId),
    ['ct-1', 'ct-2', 'ct-3'],
  );
  assert.strictEqual(alloc.totalPayment, 7.59);
  assert.strictEqual(alloc.payments.senior, 6.389999999999999);
  assert.strictEqual(alloc.payments.junior, 1.2000000000000006);
  for (const a of alloc.assignments) {
    assert.strictEqual(b.settle(a.taskId, true), true);
  }
  const sub = b.submitTask('audio');
  assert.strictEqual(sub!.taskId, 'ct-4');
  assert.strictEqual(sub!.winnerId, 'generalist');
  assert.strictEqual(sub!.payment, 10);
  assert.strictEqual(sub!.socialValue, 6);
});

// ---------- 3. GrowthMarketScheduler: 三策略轨迹 ----------

test('增长市场 market/greedy/round-robin 三策略轨迹逐位不变', () => {
  const seq = ['x', 'y', 'z', 'x', 'x'] as const;
  const expect: Record<
    string,
    { nw: number; win: number; first3: Array<[string, boolean, number, number]> }
  > = {
    market: {
      nw: 330.1,
      win: 0.8,
      first3: [
        ['a3', false, 1.2000000000000002, 0.8],
        ['a1', true, 5, 1.2],
        ['a3', false, 4.95, 0.8400000000000001],
      ],
    },
    greedy: {
      nw: 330.2,
      win: 0.8,
      first3: [
        ['a3', false, 0.8, 0.8],
        ['a1', true, 1.2, 1.2],
        ['a3', false, 0.8, 0.8400000000000001],
      ],
    },
    'round-robin': {
      nw: 294.5,
      win: 0.75,
      first3: [
        ['a1', false, 1.2, 1.2],
        ['a1', true, 1.2, 1.26],
        ['a3', false, 0.8, 0.8],
      ],
    },
  };
  for (const policy of ['market', 'greedy', 'round-robin'] as const) {
    const g = mkGrowth();
    const rows: Array<[string, boolean, number, number]> = [];
    for (let i = 0; i < 50; i++) {
      const r = g.simulateTask(seq[i % 5]!, policy);
      if (r) rows.push([r.winnerId, r.success, r.payment, r.actualCost]);
    }
    const e = expect[policy]!;
    assert.strictEqual(rows.length, 50, policy);
    for (let i = 0; i < 3; i++) {
      assert.deepStrictEqual(rows[i], e.first3[i], `${policy}[${i}]`);
    }
    assert.strictEqual(g.getNetWelfare(), e.nw, policy);
    assert.strictEqual(g.getWindowSuccessRate(5, 45), e.win, policy);
  }
  // market 终局快照（利润/主专业/熵）
  const g = mkGrowth();
  for (let i = 0; i < 50; i++) g.simulateTask(seq[i % 5]!, 'market');
  assert.deepStrictEqual(
    g.getSnapshot().map((a) => [a.id, a.profit, a.dominant, a.entropy]),
    [
      ['a1', 48.76, 'y', 0.439],
      ['a2', 0, null, 0],
      ['a3', 119.49, 'x', 0.821],
    ],
  );
});

// ---------- 4. MinCostFlow: SPFA/增广的占用模式与总费用 ----------

test('MinCostFlow 容量竞争网络:flow/cost/占用模式逐位不变', () => {
  const mcf = new MinCostFlow(7);
  const e01 = mcf.addEdge(0, 1, 2, -5.5);
  const e02 = mcf.addEdge(0, 2, 1, -4.25);
  const e13 = mcf.addEdge(1, 3, 2, -3.1);
  const e14 = mcf.addEdge(1, 4, 1, -2.05);
  const e23 = mcf.addEdge(2, 3, 1, -6.75);
  const e25 = mcf.addEdge(2, 5, 1, -1.5);
  const e36 = mcf.addEdge(3, 6, 3, 0);
  const e46 = mcf.addEdge(4, 6, 1, 0);
  const e56 = mcf.addEdge(5, 6, 1, 0);
  const r = mcf.run(0, 6);
  assert.strictEqual(r.flow, 3);
  assert.strictEqual(r.cost, -28.2);
  assert.deepStrictEqual(
    [e01, e02, e13, e14, e23, e25, e36, e46, e56].map((e) => mcf.edgeOccupied(e)),
    [true, true, true, false, true, false, true, false, false],
  );
});

// ---------- 5. bench 对手: 匈牙利 / 局部搜索（对拍实例逐位钉） ----------

test('匈牙利与局部搜索在同一确定性实例上的解向量逐位不变', () => {
  const rng = new Mulberry32(1234);
  const m = 6;
  const n = 8;
  const weights: number[][] = [];
  const ineligible: boolean[][] = [];
  for (let t = 0; t < m; t++) {
    const row: number[] = [];
    const ir: boolean[] = [];
    for (let a = 0; a < n; a++) {
      row.push(Math.round(rng.next() * 1000) / 100);
      ir.push(rng.next() < 0.15);
    }
    weights.push(row);
    ineligible.push(ir);
  }
  for (let t = 0; t < m; t++) {
    if (ineligible[t]!.every((b) => b)) ineligible[t]![Math.floor(rng.next() * n)] = false;
  }
  const couplings = new Map<number, number>();
  for (let i = 0; i < 14; i++) {
    const q1 = Math.floor(rng.next() * (m * n));
    const q2 = Math.floor(rng.next() * (m * n));
    if (q1 === q2) continue;
    const lo = Math.min(q1, q2);
    const hi = Math.max(q1, q2);
    couplings.set(lo * (m * n) + hi, Math.round(rng.next() * 200) / 100 - 1);
  }
  const problem: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    penaltyOneHot: 10,
    penaltyCapacity: 5,
    couplings,
    ineligible,
  };
  assert.deepStrictEqual(hungarianAssignment(weights, ineligible), [6, 1, 4, 3, 5, 2]);
  assert.deepStrictEqual(localSearchAssignment(problem), [6, 1, 4, 3, 5, 2]);
});

// ---------- 6. 性能回归烟囱（宽松上界:防复杂度回退,不卡计时噪声） ----------

test('性能烟囱:预算紧 λ 二分与 60 批大脑模拟在宽松上界内完成', () => {
  const mkBig = () => {
    const s = new BatchVCGScheduler({ exploreCoefficient: 0.25, switchCostRate: 0.04 });
    const rng = new Mulberry32(7);
    for (let i = 0; i < 12; i++) {
      const caps = ['c1', 'c2', 'c3', 'c4'].filter(() => rng.next() < 0.6);
      if (caps.length === 0) caps.push('c1');
      s.register({
        id: `ag${i}`,
        capabilities: [...new Set([...caps, 'c1'])],
        trueCost: 0.5 + rng.next() * 3,
        trueQuality: Object.fromEntries(
          ['c1', 'c2', 'c3', 'c4'].map((c) => [c, 0.4 + rng.next() * 0.5]),
        ),
        capacity: 1 + Math.floor(rng.next() * 2),
      });
    }
    return s;
  };
  const tasks = Array.from({ length: 16 }, (_, i) => ['c1', 'c2', 'c3', 'c4'][i % 4]!);
  const t0 = performance.now();
  const s = mkBig();
  for (let i = 0; i < 20; i++) s.allocateBatch([...tasks], { budget: 5 + i * 0.25 });
  const vcgMs = performance.now() - t0;

  const t1 = performance.now();
  const b = new CompoundBrain({ growthHorizon: 50, exploreCoefficient: 0.4 });
  b.registerAgent({
    id: 's',
    capabilities: ['nlp', 'vision'],
    trueCost: 2.5,
    trueQuality: { nlp: 0.75, vision: 0.7 },
    capacity: 2,
  });
  b.registerAgent({ id: 'j', capabilities: ['nlp'], trueCost: 0.9, trueQuality: { nlp: 0.45 } });
  b.registerAgent({
    id: 'g',
    capabilities: ['nlp', 'vision', 'audio'],
    trueCost: 1.8,
    trueQuality: { nlp: 0.55, vision: 0.5, audio: 0.6 },
    capacity: 3,
  });
  const sim = new CompoundBrainSimulator(b, { simAlpha: 0.35, simBeta: 0.12, seed: 42 });
  for (let i = 0; i < 60; i++) {
    sim.simulateBatch([
      { capability: 'nlp', value: 8 },
      { capability: 'vision', value: 7 },
      { capability: 'nlp', value: 6 },
    ]);
  }
  b.advise();
  const brainMs = performance.now() - t1;
  // 优化前实测中位约 240ms / 270ms;上界放宽 ~10 倍——只在复杂度回退
  // (如记忆化失效、SPFA 退化回 shift 出队)时才会被击穿
  assert.ok(vcgMs < 2500, `vcg-budget-tight 20 calls took ${vcgMs.toFixed(0)}ms (>2500)`);
  assert.ok(brainMs < 3000, `brain-60batch took ${brainMs.toFixed(0)}ms (>3000)`);
});
