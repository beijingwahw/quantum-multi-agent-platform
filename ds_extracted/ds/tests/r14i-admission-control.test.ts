/**
 * R14-I 测试：影子价格准入控制（admission-control）。
 *
 * 钉板内容：
 * ① 手算位势锚点 + 互补松弛对拍：三个小 WDP 实例的终态位势逐位钉死
 *    （手算 = BF 零初值最短路 + SSP 增广不改动位势的口算复演），影子
 *    价格读数与 LP 对偶一致；**对拍主体**：拒绝/放行判定与「把任务
 *    真的并入重解」的原始福利增量一致（margin > 0 ⟺ 改进 > 0，且
 *    margin 数值 = 改进数值——对偶证书与原始重解互相认证）；
 * ② 过载节流 vs 欠载放行：同一任务在容量吃满（ρ=4）时被拒、在容量
 *    空闲（ρ=0）时放行——方向性钉死；空图（无任务）证书位 dual-certified；
 * ③ EWMA 平滑语义：α=1 当批即值；α=0.5 半衰；首批直通（无合成先验）；
 *    过载租金逐步衰减 → 先拒后放（缓解放行）；缺报 agent 保留旧值；
 * ④ BudgetPacer 乘子组合口径：真实 BudgetPacer 驱动 μ（1→2→4），
 *    同一影子价格下 score = v − μ·b 随 μ 收缩、判定翻转——采购 markup
 *    与容量租金在同一对偶尺度上扣减；
 * ⑤ 诚实边界钉板：文档化的 over-rejection 反例（空闲替补 agent 对终态
 *    位势不可见）：margin = −2 拒绝，而增广重解改进 +3——模块头注
 *    P2 边界的代码实锤（certificate = 'conservative'）。**R17-B 翻转**：
 *    本访起 verify 缺省 'exact'——同一反例在 exact 模式＋反事实回调下
 *    **放行**（admitWelfare 8 > rejectWelfare 5，certificate='exact'），
 *    代价面按设计移除；dual 模式的原钉板保留（兼容模式的披露面仍在）；
 * ⑥ 确定性重放：同一 (updates, candidates) 序列两次执行逐字段一致；
 * ⑦ 冷启动与结构化拒绝理由：no-history 证书、未知 agent 按 0 计价、
 *    below-reserve-price / no-candidate-agents 理由与明细字段；
 * ⑧ 负对照：非法配置/非法报告/非法候选/非法位势逐条具名拒绝（8 组）。
 *
 * R17-B 注记：verify 现有 'dual' | 'exact' 两模式（缺省 exact）。本文件
 * 的 R14-I 历史钉板经 freshController 显式钉 **dual 模式**（它们钉的是
 * R14-I 交付的对偶判定语义）；exact 模式的完整账（拒绝零错分划、成本
 * 账、回调契约负对照）在 tests/r17b-admission-exact-verify.test.ts，
 * 本文件只保留 ⑤ 里的翻转用例作为两代语义的交接锚。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinCostFlowPotentials } from '../src/core/min-cost-flow-potentials.js';
import type { FlowEdgeRef } from '../src/core/min-cost-flow.js';
import {
  ShadowPriceAdmissionController,
  extractCapacityDuals,
  type AdmissionControlConfig,
  type AgentCapacityUsage,
  type CapacityDualReport,
} from '../src/core/admission-control.js';
import { BudgetPacer } from '../src/core/batch-vcg-scheduler.js';
import { MechanismError } from '../src/utils/errors.js';

// ---------------------------------------------------------------------------
// WDP 脚手架：S=0 → agent[1..A]（容量边，费用 0）→ task[A+1..A+T]（费用
// −score，容量 1）→ sink（容量 1，费用 0）——与 batch-vcg-scheduler.solveWDP
// 同形状；跑完直接抽取对偶。welfare = −cost（自由处置口径）。
// ---------------------------------------------------------------------------

interface WdpAgent {
  readonly id: string;
  readonly capacity: number;
}

interface WdpTask {
  readonly id: string;
  readonly score: number;
  readonly eligible: readonly string[];
}

interface WdpSolved {
  readonly potentials: readonly number[];
  readonly duals: CapacityDualReport;
  readonly welfare: number;
}

function solveWdp(agents: readonly WdpAgent[], tasks: readonly WdpTask[]): WdpSolved {
  const A = agents.length;
  const T = tasks.length;
  const sink = 1 + A + T;
  const mcf = new MinCostFlowPotentials(sink + 1);
  const sourceRefs: FlowEdgeRef[] = agents.map((a, i) => mcf.addEdge(0, 1 + i, a.capacity, 0));
  tasks.forEach((t, j) => {
    for (const agentId of t.eligible) {
      const i = agents.findIndex((a) => a.id === agentId);
      if (i < 0) throw new Error(`test fixture bug: unknown agent ${agentId}`);
      mcf.addEdge(1 + i, 1 + A + j, 1, -t.score);
    }
    mcf.addEdge(1 + A + j, sink, 1, 0);
  });
  const { cost } = mcf.run(0, sink);
  const potentials = mcf.getPotentials()!;
  const usage: AgentCapacityUsage[] = agents.map((a, i) => ({
    agentId: a.id,
    node: 1 + i,
    used: a.capacity - sourceRefs[i]!.cap, // 前向边剩余容量 → 已用量
    capacity: a.capacity,
  }));
  return {
    potentials,
    duals: extractCapacityDuals(potentials, { sourceNode: 0, sinkNode: sink, agents: usage }),
    welfare: -cost,
  };
}

/** 实例 A：单 agent 容量 1 + 单任务 score 5（最小拥堵实例） */
const INSTANCE_A = () =>
  solveWdp([{ id: 'a', capacity: 1 }], [{ id: 't1', score: 5, eligible: ['a'] }]);

/** 实例 B：2 agent 容量各 1 + 单任务（双资格）——平手裁决 a1 胜、a2 空闲 */
const INSTANCE_B = () =>
  solveWdp(
    [
      { id: 'a1', capacity: 1 },
      { id: 'a2', capacity: 1 },
    ],
    [{ id: 't1', score: 5, eligible: ['a1', 'a2'] }],
  );

/** 实例 C：2 agent 容量各 1 + 双任务（5/4 双资格）——容量全吃满 */
const INSTANCE_C = () =>
  solveWdp(
    [
      { id: 'a1', capacity: 1 },
      { id: 'a2', capacity: 1 },
    ],
    [
      { id: 't1', score: 5, eligible: ['a1', 'a2'] },
      { id: 't2', score: 4, eligible: ['a1', 'a2'] },
    ],
  );

/**
 * α=1（不平滑）+ 保留价 0 的控制器：判定只反映当批对偶。
 * R17-B 起 verify 缺省 'exact'；本文件的 R14-I 历史钉板显式钉 **dual
 * 模式**（兼容模式），只有 ⑤ 的翻转用例覆写为 exact。
 */
function freshController(
  overrides: Partial<AdmissionControlConfig> = {},
): ShadowPriceAdmissionController {
  return new ShadowPriceAdmissionController({
    ewmaAlpha: 1,
    reservePrice: 0,
    verify: 'dual',
    ...overrides,
  });
}

describe('R14-I · 手算位势锚点 + 互补松弛对拍（对偶判定 vs 原始重解）', () => {
  it('实例 A：终态位势手算锚点 [0,0,−5,−5]，饱和租金 ρ = π_a − π_sink = 5', () => {
    const a = INSTANCE_A();
    // 手算：BF 零初值 ⟹ π_S=0（无入边）、π_a=0（0 费边）、π_t=−5、π_sink=−5；
    // SSP 唯一一轮增广 d≡0 ⟹ 位势不动
    assert.deepEqual(a.potentials, [0, 0, -5, -5]);
    assert.deepEqual(a.duals.agents, [{ agentId: 'a', shadowPrice: 5, saturated: true }]);
    // π_sink=−5 < π_S=0：返回边证书不成立（P2 只有保守侧语义）
    assert.equal(a.duals.dualCertified, false);
  });

  it('实例 A 对拍：margin ≤ 0 拒绝 ⟺ 并入重解福利不变（LP 证书方向）', () => {
    const a = INSTANCE_A();
    const ctl = freshController();
    ctl.update(a.duals);
    const d = ctl.decide({ taskId: 'new', scores: [{ agentId: 'a', score: 3 }] });
    assert.equal(d.admitted, false);
    assert.equal(d.reason, 'below-reserve-price');
    // 原始对拍：把 score-3 任务并入 WDP 重解，最优福利仍是 5（自由处置丢弃）
    const augmented = solveWdp(
      [{ id: 'a', capacity: 1 }],
      [
        { id: 't1', score: 5, eligible: ['a'] },
        { id: 'new', score: 3, eligible: ['a'] },
      ],
    );
    assert.equal(augmented.welfare, 5);
    assert.equal(augmented.welfare - a.welfare, 0);
  });

  it('实例 A 对拍：margin = 2 放行 ⟺ 并入重解改进恰为 2（对偶数值 = 原始增量）', () => {
    const a = INSTANCE_A();
    const ctl = freshController();
    ctl.update(a.duals);
    const d = ctl.decide({ taskId: 'new', scores: [{ agentId: 'a', score: 7 }] });
    assert.equal(d.admitted, true);
    assert.equal(d.effectiveMargin, 2);
    const augmented = solveWdp(
      [{ id: 'a', capacity: 1 }],
      [
        { id: 't1', score: 5, eligible: ['a'] },
        { id: 'new', score: 7, eligible: ['a'] },
      ],
    );
    assert.equal(augmented.welfare, 7);
    assert.equal(augmented.welfare - a.welfare, 2); // margin 与真实改进同值
  });

  it('实例 B：互补松弛读数——空闲 agent 的原始 π_a − π_sink = 5 但租金夹为 0', () => {
    const b = INSTANCE_B();
    // 手算：平手裁决 t1→a1；π = [0,0,0,−5,−5]；a2 空闲（残量 S→a2 前向边）
    assert.deepEqual(b.potentials, [0, 0, 0, -5, -5]);
    assert.deepEqual(b.duals.agents, [
      { agentId: 'a1', shadowPrice: 5, saturated: true },
      { agentId: 'a2', shadowPrice: 0, saturated: false }, // 不夹紧会读出 5
    ]);
  });

  it('实例 C：手算位势 [0,0,0,−5,−4,−4]，双 agent 饱和租金 = 4（边际任务分）', () => {
    const c = INSTANCE_C();
    // 手算：两轮增广（5→a1、4→a2），末轮 dT=1 只抬 π_sink；a1 经反向边
    // t1→a1 可达（d=0）故 π_a1 不动
    assert.deepEqual(c.potentials, [0, 0, 0, -5, -4, -4]);
    assert.deepEqual(
      c.duals.agents.map((x) => [x.agentId, x.shadowPrice, x.saturated]),
      [
        ['a1', 4, true],
        ['a2', 4, true],
      ],
    );
  });

  it('实例 C 对拍：s=4.5 放行 margin 0.5 = 真实改进 0.5；s=3.5 拒绝 = 零改进', () => {
    const c = INSTANCE_C();
    const ctl = freshController();
    ctl.update(c.duals);
    const admit = ctl.decide({
      taskId: 'hi',
      scores: [
        { agentId: 'a1', score: 4.5 },
        { agentId: 'a2', score: 4.5 },
      ],
    });
    assert.equal(admit.admitted, true);
    assert.equal(admit.effectiveMargin, 0.5);
    const reject = ctl.decide({
      taskId: 'lo',
      scores: [
        { agentId: 'a1', score: 3.5 },
        { agentId: 'a2', score: 3.5 },
      ],
    });
    assert.equal(reject.admitted, false);
    // 原始对拍：4.5 挤掉 4（福利 9→9.5）；3.5 被自由处置丢弃（福利 9 不变）
    const augHi = solveWdp(
      [
        { id: 'a1', capacity: 1 },
        { id: 'a2', capacity: 1 },
      ],
      [
        { id: 't1', score: 5, eligible: ['a1', 'a2'] },
        { id: 't2', score: 4, eligible: ['a1', 'a2'] },
        { id: 'hi', score: 4.5, eligible: ['a1', 'a2'] },
      ],
    );
    const augLo = solveWdp(
      [
        { id: 'a1', capacity: 1 },
        { id: 'a2', capacity: 1 },
      ],
      [
        { id: 't1', score: 5, eligible: ['a1', 'a2'] },
        { id: 't2', score: 4, eligible: ['a1', 'a2'] },
        { id: 'lo', score: 3.5, eligible: ['a1', 'a2'] },
      ],
    );
    assert.equal(augHi.welfare - c.welfare, 0.5);
    assert.equal(augLo.welfare - c.welfare, 0);
  });
});

describe('R14-I · 过载节流 vs 欠载放行（方向性）', () => {
  it('过载（容量全吃满，ρ=4）：score-3 任务被节流，证书 = conservative', () => {
    const ctl = freshController();
    ctl.update(INSTANCE_C().duals);
    const d = ctl.decide({
      taskId: 't3',
      scores: [
        { agentId: 'a1', score: 3 },
        { agentId: 'a2', score: 3 },
      ],
    });
    assert.equal(d.admitted, false);
    assert.equal(d.certificate, 'conservative'); // π_sink=−4 < π_S=0
    assert.equal(d.best!.marginal, -1); // 3 − 4
  });

  it('欠载（同拓扑但容量空闲，ρ=0）：同一 score-3 任务经空闲 agent 放行', () => {
    const ctl = freshController();
    ctl.update(INSTANCE_B().duals); // a1 饱和（ρ=5）、a2 空闲（ρ=0）
    const d = ctl.decide({
      taskId: 't2',
      scores: [
        { agentId: 'a1', score: 3 },
        { agentId: 'a2', score: 3 },
      ],
    });
    assert.equal(d.admitted, true);
    assert.equal(d.best!.agentId, 'a2'); // 放行证据 = 空闲侧边际（P1 路径）
    assert.equal(d.best!.marginal, 3);
  });

  it('空图（无任务无占用）：位势全零 → dualCertified=true，正分放行', () => {
    const empty = new MinCostFlowPotentials(4); // S=0, a=1, t=2, sink=3，零边
    empty.run(0, 3);
    assert.deepEqual(empty.getPotentials(), [0, 0, 0, 0]);
    const duals = extractCapacityDuals(empty.getPotentials()!, {
      sourceNode: 0,
      sinkNode: 3,
      agents: [{ agentId: 'a', node: 1, used: 0, capacity: 1 }],
    });
    assert.equal(duals.dualCertified, true); // π_sink = π_S = 0
    assert.deepEqual(duals.agents, [{ agentId: 'a', shadowPrice: 0, saturated: false }]);
    const ctl = freshController();
    ctl.update(duals);
    const d = ctl.decide({ taskId: 'any', scores: [{ agentId: 'a', score: 0.1 }] });
    assert.equal(d.admitted, true);
    assert.equal(d.certificate, 'dual-certified');
  });
});

describe('R14-I · EWMA 平滑语义', () => {
  it('α=1：当批即值——读数 10 后读数 0，平滑价精确跟随最新批', () => {
    const ctl = freshController(); // ewmaAlpha=1
    ctl.update({
      agents: [{ agentId: 'a', shadowPrice: 10, saturated: true }],
      dualCertified: false,
    });
    assert.equal(ctl.getSmoothedPrice('a'), 10);
    ctl.update({
      agents: [{ agentId: 'a', shadowPrice: 0, saturated: false }],
      dualCertified: false,
    });
    assert.equal(ctl.getSmoothedPrice('a'), 0);
  });

  it('α=0.5：读数 [0, 10] ⟹ 平滑价 5（半衰），判定边界在 5 处翻转', () => {
    const ctl = freshController({ ewmaAlpha: 0.5, reservePrice: 0 });
    ctl.update({
      agents: [{ agentId: 'a', shadowPrice: 0, saturated: false }],
      dualCertified: false,
    });
    ctl.update({
      agents: [{ agentId: 'a', shadowPrice: 10, saturated: true }],
      dualCertified: false,
    });
    assert.equal(ctl.getSmoothedPrice('a'), 5);
    // margin = score − 5：4.9 拒、5 并列拒（严格大于）、5.1 放
    assert.equal(
      ctl.decide({ taskId: 'x', scores: [{ agentId: 'a', score: 4.9 }] }).admitted,
      false,
    );
    assert.equal(ctl.decide({ taskId: 'y', scores: [{ agentId: 'a', score: 5 }] }).admitted, false);
    assert.equal(
      ctl.decide({ taskId: 'z', scores: [{ agentId: 'a', score: 5.1 }] }).admitted,
      true,
    );
  });

  it('首批直通（无合成先验）：α=0.5 首报 10 ⟹ 平滑价 = 10 而非 5', () => {
    const ctl = freshController({ ewmaAlpha: 0.5 });
    ctl.update({
      agents: [{ agentId: 'a', shadowPrice: 10, saturated: true }],
      dualCertified: false,
    });
    assert.equal(ctl.getSmoothedPrice('a'), 10);
  });

  it('过载缓解逐步放行：租金读数 [10, 0, 0, 0] ⟹ 平滑价 10→5→2.5→1.25，score-3 先拒后放', () => {
    const ctl = freshController({ ewmaAlpha: 0.5 });
    const report = (price: number): CapacityDualReport => ({
      agents: [{ agentId: 'a', shadowPrice: price, saturated: price > 0 }],
      dualCertified: false,
    });
    const decide = (): boolean =>
      ctl.decide({ taskId: 't', scores: [{ agentId: 'a', score: 3 }] }).admitted;
    ctl.update(report(10));
    assert.equal(decide(), false); // margin 3 − 10
    ctl.update(report(0));
    assert.equal(decide(), false); // margin 3 − 5
    ctl.update(report(0));
    assert.equal(decide(), true); // margin 3 − 2.5
    ctl.update(report(0));
    assert.equal(decide(), true); // margin 3 − 1.25
    assert.equal(ctl.getSmoothedPrice('a'), 1.25);
  });

  it('缺报 agent 保留旧值；逐 agent 独立平滑', () => {
    const ctl = freshController({ ewmaAlpha: 0.5 });
    ctl.update({
      agents: [
        { agentId: 'a1', shadowPrice: 10, saturated: true },
        { agentId: 'a2', shadowPrice: 10, saturated: true },
      ],
      dualCertified: false,
    });
    // 第二批只有 a1 的读数：a1 平滑、a2 原地
    ctl.update({
      agents: [{ agentId: 'a1', shadowPrice: 0, saturated: false }],
      dualCertified: false,
    });
    assert.equal(ctl.getSmoothedPrice('a1'), 5);
    assert.equal(ctl.getSmoothedPrice('a2'), 10);
  });
});

describe('R14-I · BudgetPacer 乘子组合口径（μ 与 ρ 同尺度扣减）', () => {
  it('真实 BudgetPacer 驱动 μ：1→2→4，同一影子价下判定随之翻转', () => {
    // v=8、b=1、λ=0、ρ̄=5（实例 A 的对偶），score = v − λ − μ·b
    // （与 allocateAffineBatch.solveWDP 的 score 同语言）
    const pacer = new BudgetPacer(10, 0.5); // 预算 10、κ=0.5
    const ctl = freshController(); // α=1、reserve 0
    ctl.update(INSTANCE_A().duals); // ρ̄_a = 5
    const decide = (): boolean =>
      ctl.decide({
        taskId: 'new',
        scores: [{ agentId: 'a', score: 8 - pacer.getMu() * 1 }],
      }).admitted;
    assert.equal(pacer.getMu(), 1);
    assert.equal(decide(), true); // 8 − 1 − 5 = 2 > 0
    pacer.update(40); // ratio 4、κ=0.5 ⟹ μ = 1·√4 = 2
    assert.equal(pacer.getMu(), 2);
    assert.equal(decide(), true); // 8 − 2 − 5 = 1 > 0
    pacer.update(40); // μ = 2·√4 = 4
    assert.equal(pacer.getMu(), 4);
    assert.equal(decide(), false); // 8 − 4 − 5 = −1 ≤ 0：采购 markup 收紧节流
  });

  it('保留价与 μ 的独立性：reserve=2 时 μ=2（margin 1）也拒——两道闸分开扣', () => {
    const ctl = freshController({ reservePrice: 2 });
    ctl.update(INSTANCE_A().duals);
    const d = ctl.decide({
      taskId: 'new',
      scores: [{ agentId: 'a', score: 8 - 2 * 1 }], // μ=2 口径
    });
    assert.equal(d.admitted, false);
    assert.equal(d.effectiveMargin, -1); // (8−2−5) − 2
    assert.equal(d.reason, 'below-reserve-price');
    assert.equal(d.best!.marginal, 1); // 缺的是保留价这道边际（μ/ρ 侧已过）
  });
});

describe('R14-I→R17-B · over-rejection 反例钉板（dual 披露面 + exact 翻转）', () => {
  it('R17-B 翻转：exact 模式＋反事实回调下，钉板反例从拒绝翻转为放行（8 > 5）', () => {
    // 实例 B：t1(5) 平手裁决给 a1，a2 空闲。新任务 t2(3) 仅 a1 资格：
    // ρ_{a1} = 5 ⟹ margin = 3 − 5 = −2——对偶测试想拒。
    //
    // 【翻转理由（R17-B 任务书）】R14-I 在此钉的是 dual 模式的已披露
    // 代价面：终态位势看不见换道空间（t1 移交 a2），margin=−2 错拒了
    // 真实改进 +3 的任务。R17-B 起缺省 verify='exact'：borderline 拒绝
    // 交给反事实重解测量——本用例的回调**真的重解**增广 WDP（复用本
    // 文件的 solveWdp 脚手架；生产接线中编排者的回调闭包持有当前批
    // 状态与此同构）。admitWelfare 8 > rejectWelfare 5 ⟹ 放行，
    // certificate='exact'。代价面按设计移除：这个曾经的对拍证据
    // （拒绝 ⟺ 零改进）在 exact 模式下升格为决策依据本身。
    const base = INSTANCE_B();
    const baseAgents = [
      { id: 'a1', capacity: 1 },
      { id: 'a2', capacity: 1 },
    ];
    let calls = 0;
    const ctl = new ShadowPriceAdmissionController({
      ewmaAlpha: 1,
      reservePrice: 0,
      verify: 'exact',
      counterfactual: (candidate) => {
        calls += 1;
        // 真实反事实：并入 t2 重解 vs 拒绝现状（t2 的资格结构在编排者
        // 状态里——此处按本反例如实写死「仅 a1 资格」）
        const admit = solveWdp(baseAgents, [
          { id: 't1', score: 5, eligible: ['a1', 'a2'] },
          { id: candidate.taskId, score: candidate.scores[0]!.score, eligible: ['a1'] },
        ]);
        return { admitWelfare: admit.welfare, rejectWelfare: base.welfare };
      },
    });
    ctl.update(base.duals);
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a1', score: 3 }] });
    assert.equal(calls, 1); // borderline 恰好一次反事实求解
    assert.equal(d.admitted, true); // 8 > 5：放行——R14-I 的错拒在此翻正
    assert.equal(d.reason, 'admitted');
    assert.equal(d.certificate, 'exact');
    assert.deepEqual(d.counterfactual, { admitWelfare: 8, rejectWelfare: 5, welfareDelta: 3 });
    assert.equal(d.effectiveMargin, -2); // 对偶侧读数如实保留（结构面）
    assert.equal(d.best!.marginal, -2); // 逐 agent 明细仍是对偶语言
    assert.equal(ctl.getMetrics().exactVerifications, 1); // 成本账：恰一次
  });

  it('dual 模式（R14-I 披露面保留）：margin = −2 拒绝，但增广重解真实改进 +3', () => {
    // 同一反例在 dual 模式下维持 R14-I 钉板行为：conservative 拒绝仍可能
    // 错失换道改进——兼容模式的代价面没有消失，只是 exact 模式不再用它。
    const ctl = freshController(); // verify: 'dual'
    ctl.update(INSTANCE_B().duals);
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a1', score: 3 }] });
    assert.equal(d.admitted, false);
    assert.equal(d.effectiveMargin, -2);
    assert.equal(d.certificate, 'conservative'); // π_sink < π_S：证书不成立
    assert.equal(d.reason, 'below-reserve-price'); // dual 模式原语义（无披露后缀）
    // 但原始对拍：并入 t2 重解，最优 = t1→a2 + t2→a1，福利 8 > 5（改进 3）。
    // 换道机会（t1 移交 a2）对终态位势不可见——这正是模块头注「P2 的边界」
    // 的最小反例：conservative 判定可能错失依赖换道的正改进。
    const augmented = solveWdp(
      [
        { id: 'a1', capacity: 1 },
        { id: 'a2', capacity: 1 },
      ],
      [
        { id: 't1', score: 5, eligible: ['a1', 'a2'] },
        { id: 't2', score: 3, eligible: ['a1'] },
      ],
    );
    assert.equal(augmented.welfare, 8);
    assert.equal(augmented.welfare - INSTANCE_B().welfare, 3);
  });

  it('同一实例若平手裁决落在 a2（t1→a2、a1 空闲）：同任务经空闲 a1 放行——对偶读数依赖终态流', () => {
    // 构造镜像：t1 仅经 a2 资格前的读数无法直接构造（求解器平手裁决固定），
    // 改为直接喂镜像对偶报告钉住「空闲侧 ρ=0 ⟹ 放行」的对偶语义：
    // a1 空闲（ρ=0）+ a2 饱和（ρ=5）时，仅 a1 资格的 score-3 任务放行。
    const ctl = freshController();
    ctl.update({
      agents: [
        { agentId: 'a1', shadowPrice: 0, saturated: false },
        { agentId: 'a2', shadowPrice: 5, saturated: true },
      ],
      dualCertified: false,
    });
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a1', score: 3 }] });
    assert.equal(d.admitted, true); // P1：空闲侧直通增广，改进 ≥ 3
    assert.equal(d.effectiveMargin, 3);
    // P1 的原始侧对拍（真实实例 B + 仅空闲 a2 资格的 score-3 任务）：
    // 放行 margin 3，并入重解福利 5 → 8，改进恰 = 3 = margin（放行侧证书）
    const ctlB = freshController();
    ctlB.update(INSTANCE_B().duals); // a1 饱和 ρ=5、a2 空闲 ρ=0
    const viaSlack = ctlB.decide({ taskId: 't2', scores: [{ agentId: 'a2', score: 3 }] });
    assert.equal(viaSlack.admitted, true);
    assert.equal(viaSlack.best!.agentId, 'a2');
    assert.equal(viaSlack.effectiveMargin, 3);
    const augmented = solveWdp(
      [
        { id: 'a1', capacity: 1 },
        { id: 'a2', capacity: 1 },
      ],
      [
        { id: 't1', score: 5, eligible: ['a1', 'a2'] },
        { id: 't2', score: 3, eligible: ['a2'] },
      ],
    );
    assert.equal(augmented.welfare - INSTANCE_B().welfare, 3);
  });
});

describe('R14-I · 确定性重放（无 RNG/时钟，逐字段一致）', () => {
  it('同一 (updates, candidates) 序列两次执行产逐字段相同的决策', () => {
    const runScenario = (): string[] => {
      const ctl = new ShadowPriceAdmissionController({ ewmaAlpha: 0.5, reservePrice: 1 });
      ctl.update(INSTANCE_C().duals);
      ctl.update(INSTANCE_B().duals);
      const out: string[] = [];
      const tasks = [
        {
          taskId: 'x',
          scores: [
            { agentId: 'a1', score: 4.5 },
            { agentId: 'a2', score: 4.5 },
          ],
        },
        { taskId: 'y', scores: [{ agentId: 'a2', score: 6 }] },
        { taskId: 'z', scores: [] as Array<{ agentId: string; score: number }> },
        { taskId: 'w', scores: [{ agentId: 'ghost', score: 2 }] }, // 从未报告过的 agent
      ];
      for (const t of tasks) out.push(JSON.stringify(ctl.decide(t)));
      return out;
    };
    assert.deepEqual(runScenario(), runScenario());
  });
});

describe('R14-I · 冷启动与结构化拒绝理由', () => {
  it('无任何对偶历史：证书 no-history、未知 agent 按 0 计价、正分放行', () => {
    const ctl = freshController();
    assert.equal(ctl.hasHistory(), false);
    const d = ctl.decide({ taskId: 't', scores: [{ agentId: 'anyone', score: 0.5 }] });
    assert.equal(d.certificate, 'no-history');
    assert.equal(d.admitted, true);
    assert.equal(d.best!.hasHistory, false);
    assert.equal(d.best!.shadowPrice, 0);
    assert.equal(ctl.getSmoothedPrice('anyone'), null);
  });

  it('below-reserve-price 理由点出缺的边际：逐 agent 明细 score/price/marginal', () => {
    const ctl = freshController({ reservePrice: 3 });
    ctl.update(INSTANCE_A().duals); // ρ=5
    // 拒绝侧（单 agent）：marginal 1 < reserve 3，明细指出缺的是保留价这道边际
    const only = ctl.decide({ taskId: 't9b', scores: [{ agentId: 'a', score: 6 }] });
    assert.equal(only.admitted, false); // 6 − 5 = 1 ≤ 3
    assert.equal(only.reason, 'below-reserve-price');
    assert.deepEqual(
      only.evaluated.map((e) => [e.agentId, e.score, e.shadowPrice, e.marginal, e.hasHistory]),
      [['a', 6, 5, 1, true]],
    );
    assert.equal(only.effectiveMargin, -2); // 1 − 3
    // 混合资格（已知 ρ=5 vs 未知 ρ=0）：best 取边际最高者，冷启动标记如实
    const d = ctl.decide({
      taskId: 't9',
      scores: [
        { agentId: 'a', score: 6 }, // marginal 1
        { agentId: 'b', score: 8 }, // 未知 agent，price 0，marginal 8
      ],
    });
    assert.equal(d.admitted, true); // 8 − 0 − 3 = 5 > 0
    assert.equal(d.best!.agentId, 'b');
    assert.deepEqual(
      d.evaluated.map((e) => e.hasHistory),
      [true, false],
    );
  });

  it('并列边界：margin = reserve 精确相等时拒绝（严格大于语义）', () => {
    const ctl = freshController({ reservePrice: 2 });
    ctl.update(INSTANCE_A().duals); // ρ=5
    const d = ctl.decide({ taskId: 'edge', scores: [{ agentId: 'a', score: 7 }] });
    assert.equal(d.effectiveMargin, 0); // 7 − 5 − 2
    assert.equal(d.admitted, false);
  });

  it('无资格 agent：reason = no-candidate-agents、margin = null、空明细', () => {
    const ctl = freshController();
    ctl.update(INSTANCE_A().duals);
    const d = ctl.decide({ taskId: 'none', scores: [] });
    assert.equal(d.admitted, false);
    assert.equal(d.reason, 'no-candidate-agents');
    assert.equal(d.effectiveMargin, null);
    assert.equal(d.best, null);
    assert.deepEqual(d.evaluated, []);
  });
});

describe('R14-I · 负对照（非法输入逐条具名拒绝）', () => {
  it('配置域：ewmaAlpha 非法值逐条点名', () => {
    for (const bad of [Number.NaN, 0, -0.5, 1.5, Number.POSITIVE_INFINITY, '0.5']) {
      assert.throws(
        () => new ShadowPriceAdmissionController({ ewmaAlpha: bad as number, reservePrice: 0 }),
        (err: unknown) => err instanceof MechanismError && err.message.includes('ewmaAlpha'),
      );
    }
  });

  it('配置域：reservePrice 非法值逐条点名', () => {
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => new ShadowPriceAdmissionController({ ewmaAlpha: 1, reservePrice: bad }),
        (err: unknown) => err instanceof MechanismError && err.message.includes('reservePrice'),
      );
    }
  });

  it('update 域：shadowPrice 负/NaN/无限、重复 agentId、非法布尔逐条点名', () => {
    const ctl = freshController();
    const mk = (price: number): CapacityDualReport => ({
      agents: [{ agentId: 'a', shadowPrice: price, saturated: true }],
      dualCertified: false,
    });
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => ctl.update(mk(bad)),
        (err: unknown) => err instanceof MechanismError && err.message.includes('shadowPrice'),
      );
    }
    assert.throws(
      () =>
        ctl.update({
          agents: [
            { agentId: 'a', shadowPrice: 1, saturated: true },
            { agentId: 'a', shadowPrice: 2, saturated: true },
          ],
          dualCertified: false,
        }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('duplicate agentId'),
    );
    assert.throws(
      () =>
        ctl.update({
          agents: [{ agentId: 'a', shadowPrice: 1, saturated: 'yes' as unknown as boolean }],
          dualCertified: false,
        }),
      (err: unknown) =>
        err instanceof MechanismError && err.message.includes('saturated must be a boolean'),
    );
    assert.throws(
      () =>
        ctl.update({
          agents: [{ agentId: 'a', shadowPrice: 1, saturated: true }],
          dualCertified: 1 as unknown as boolean,
        }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('dualCertified'),
    );
    // 拒绝零残留：以上全部失败后控制器状态未被污染
    assert.equal(ctl.hasHistory(), false);
  });

  it('decide 域：score 非有限、空 taskId、重复 agentId 逐条点名', () => {
    const ctl = freshController();
    ctl.update(INSTANCE_A().duals);
    assert.throws(
      () => ctl.decide({ taskId: 't', scores: [{ agentId: 'a', score: Number.NaN }] }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('score for agent a'),
    );
    assert.throws(
      () => ctl.decide({ taskId: '', scores: [] }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('taskId'),
    );
    assert.throws(
      () =>
        ctl.decide({
          taskId: 't',
          scores: [
            { agentId: 'a', score: 1 },
            { agentId: 'a', score: 2 },
          ],
        }),
      (err: unknown) =>
        err instanceof MechanismError && err.message.includes('duplicate agentId in candidate t'),
    );
  });

  it('extractCapacityDuals 域：非有限位势 / 节点越界 / 源汇同点 / used 超容量 / 重复 id 逐条点名', () => {
    const base = { sourceNode: 0, sinkNode: 3 };
    assert.throws(
      () => extractCapacityDuals([0, Number.NaN, 0, 0], { ...base, agents: [] }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('potentials[1]'),
    );
    assert.throws(
      () => extractCapacityDuals([0, 0, 0, 0], { ...base, sinkNode: 4, agents: [] }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('sinkNode'),
    );
    assert.throws(
      () => extractCapacityDuals([0, 0, 0, 0], { ...base, sinkNode: 0, agents: [] }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('must differ'),
    );
    assert.throws(
      () =>
        extractCapacityDuals([0, 0, 0, 0], {
          ...base,
          agents: [{ agentId: 'a', node: 9, used: 0, capacity: 1 }],
        }),
      (err: unknown) =>
        err instanceof MechanismError && err.message.includes('node 9 out of range'),
    );
    assert.throws(
      () =>
        extractCapacityDuals([0, 0, 0, 0], {
          ...base,
          agents: [{ agentId: 'a', node: 1, used: 2, capacity: 1 }],
        }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('exceeds capacity'),
    );
    assert.throws(
      () =>
        extractCapacityDuals([0, 0, 0, 0], {
          ...base,
          agents: [
            { agentId: 'a', node: 1, used: 0, capacity: 1 },
            { agentId: 'a', node: 2, used: 0, capacity: 1 },
          ],
        }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('duplicate agentId'),
    );
  });

  it('update 的 validate-then-mutate：批次含任何非法条目则整批拒绝、零残留', () => {
    const ctl = freshController({ ewmaAlpha: 1 });
    const good = { agentId: 'ok', shadowPrice: 3, saturated: true };
    ctl.update({ agents: [good], dualCertified: false });
    assert.equal(ctl.getSmoothedPrice('ok'), 3);
    // 第二批：合法条目 + 非法条目——整批拒绝，'ok' 不被第二批污染
    assert.throws(() =>
      ctl.update({
        agents: [
          { agentId: 'ok', shadowPrice: 7, saturated: true },
          { agentId: 'bad', shadowPrice: -1, saturated: true },
        ],
        dualCertified: true,
      }),
    );
    assert.equal(ctl.getSmoothedPrice('ok'), 3); // 未被 7 覆盖
    assert.equal(ctl.getSmoothedPrice('bad'), null); // 未被创建
  });
});
