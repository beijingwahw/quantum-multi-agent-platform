/**
 * R17-B 测试：影子价格准入的**精确拒绝**升级（verify: 'dual' | 'exact'，
 * 缺省 exact；borderline 拒绝交反事实测量——拒绝零错）。
 *
 * 钉板内容：
 * ① 模式语义：verify 省缺 = exact；exact 无回调的 borderline 拒绝以
 *    reason='unverified-conservative' 具名披露（决策与 conservative 同，
 *    但不冒充已验证）；verify='dual' 恢复 R14-I 原语义
 *    （reason='below-reserve-price'）；
 * ② 测量治理决策：同一对偶 margin=−2 的两副真面目——增广重解不能换道
 *    （5=5 ⟹ exact 拒绝）vs 能换道（8>5 ⟹ exact 放行，r14i 钉板反例的
 *    镜像）；并列（admitWelfare = rejectWelfare）拒绝——严格大于约定；
 * ③ 拒绝零错分划的机器账：dual-certified 强拒不触发回调（P2 有证书不必
 *    花钱）；无 borderline 的流零回调调用；每个 borderline 恰好一次
 *    （exactVerifications 计数 = spy 调用数）；dual 模式不消费回调；
 * ④ 放行侧证明不变（P1 对拍在 exact 模式下原样成立，证书不换、零回调）；
 * ⑤ metrics 面：decisions = admissions + rejections 恒等、快照冻结、
 *    unverifiedConservativeRejections 可监控（零错保证的缺口面）；
 * ⑥ 确定性重放（exact 模式，counterfactual 测量字段逐字段一致）；
 * ⑦ 负对照（回调契约与配置域）：NaN/缺字段/非对象返回具名拒绝、verify
 *    非法值、回调抛错**原样透传**（Error 与非 Error 双证）、回调抛错后
 *    控制器零残留、counterfactual 非函数。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinCostFlowPotentials } from '../src/core/min-cost-flow-potentials.js';
import type { FlowEdgeRef } from '../src/core/min-cost-flow.js';
import {
  ShadowPriceAdmissionController,
  extractCapacityDuals,
  type AdmissionCandidate,
  type AdmissionControlConfig,
  type AgentCapacityUsage,
  type CapacityDualReport,
  type CounterfactualSolver,
  type CounterfactualWelfare,
  type AdmissionVerifyMode,
} from '../src/core/admission-control.js';
import { MechanismError } from '../src/utils/errors.js';

// ---------------------------------------------------------------------------
// WDP 脚手架（与 r14i-admission-control.test.ts 同形状的独立副本——测试
// 文件自含）：S=0 → agent[1..A]（容量边，费用 0）→ task[A+1..A+T]（费用
// −score，容量 1）→ sink（容量 1，费用 0）。welfare = −cost。
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

function solveWdp(
  agents: readonly WdpAgent[],
  tasks: readonly WdpTask[],
): {
  welfare: number;
  duals: CapacityDualReport;
} {
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
  const usage: AgentCapacityUsage[] = agents.map((a, i) => ({
    agentId: a.id,
    node: 1 + i,
    used: a.capacity - sourceRefs[i]!.cap,
    capacity: a.capacity,
  }));
  return {
    welfare: -cost,
    duals: extractCapacityDuals(mcf.getPotentials()!, {
      sourceNode: 0,
      sinkNode: sink,
      agents: usage,
    }),
  };
}

/** 实例 A：单 agent 容量 1 + 单任务 score 5（ρ=5，π_sink=−5 ⟹ conservative） */
const INSTANCE_A = () =>
  solveWdp([{ id: 'a', capacity: 1 }], [{ id: 't1', score: 5, eligible: ['a'] }]);

/** 实例 B：2 agent 容量各 1 + 单任务（双资格）——平手裁决 a1 胜、a2 空闲（conservative） */
const INSTANCE_B = () =>
  solveWdp(
    [
      { id: 'a1', capacity: 1 },
      { id: 'a2', capacity: 1 },
    ],
    [{ id: 't1', score: 5, eligible: ['a1', 'a2'] }],
  );

/** 空图对偶（S=0, a=1, t=2, sink=3，零边）：位势全零 ⟹ dualCertified=true */
const EMPTY_DUALS = (): CapacityDualReport => {
  const mcf = new MinCostFlowPotentials(4);
  mcf.run(0, 3);
  return extractCapacityDuals(mcf.getPotentials()!, {
    sourceNode: 0,
    sinkNode: 3,
    agents: [{ agentId: 'a', node: 1, used: 0, capacity: 1 }],
  });
};

/** 计数回调（spy）：固定返回值，记录候选 */
function spyCallback(welfare: CounterfactualWelfare): {
  solver: (c: AdmissionCandidate) => CounterfactualWelfare;
  calls: () => number;
} {
  let n = 0;
  return {
    solver: (c: AdmissionCandidate): CounterfactualWelfare => {
      n += 1;
      assert.ok(c.taskId.length > 0); // 回调收到完整候选（契约面）
      return welfare;
    },
    calls: () => n,
  };
}

/** α=1 + 保留价 0 + 缺省 verify（= exact）＋可选回调 */
function exactController(
  counterfactual?: AdmissionControlConfig['counterfactual'],
  overrides: Partial<AdmissionControlConfig> = {},
): ShadowPriceAdmissionController {
  return new ShadowPriceAdmissionController({
    ewmaAlpha: 1,
    reservePrice: 0,
    ...(counterfactual !== undefined ? { counterfactual } : {}),
    ...overrides,
  });
}

describe('R17-B · 模式语义（verify 省缺 = exact；无回调的退化披露）', () => {
  it('verify 省缺即 exact：无回调时 borderline 拒绝 reason=unverified-conservative（决策保守、披露具名）', () => {
    const ctl = exactController(); // 不写 verify——缺省 exact
    ctl.update(INSTANCE_A().duals); // ρ=5、dualCertified=false ⟹ conservative 态
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] });
    assert.equal(d.admitted, false); // 决策与 R14-I 保守语义相同……
    assert.equal(d.certificate, 'conservative');
    assert.equal(d.effectiveMargin, -2);
    assert.equal(d.reason, 'unverified-conservative'); // ……但理由具名「未验证」
    assert.equal(d.counterfactual, null); // 无测量
    const m = ctl.getMetrics();
    assert.equal(m.unverifiedConservativeRejections, 1); // 缺口面可监控
    assert.equal(m.exactVerifications, 0); // 没花钱
  });

  it('verify=dual：同一实例恢复 R14-I 原语义（below-reserve-price，无披露后缀）', () => {
    const ctl = exactController(undefined, { verify: 'dual' });
    ctl.update(INSTANCE_A().duals);
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] });
    assert.equal(d.admitted, false);
    assert.equal(d.certificate, 'conservative');
    assert.equal(d.reason, 'below-reserve-price');
    assert.equal(ctl.getMetrics().unverifiedConservativeRejections, 0);
  });

  it('verify 省缺 ＋回调：borderline 照常触发测量（exact 是缺省，不是「接了回调才生效」）', () => {
    const spy = spyCallback({ admitWelfare: 6, rejectWelfare: 5 });
    const ctl = exactController(spy.solver); // 不写 verify
    ctl.update(INSTANCE_A().duals);
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] });
    assert.equal(spy.calls(), 1);
    assert.equal(d.certificate, 'exact');
    assert.equal(d.admitted, true); // 6 > 5
    assert.equal(ctl.getMetrics().exactVerifications, 1);
  });
});

describe('R17-B · 测量治理决策（同一对偶 margin 的两副真面目）', () => {
  it('exact 拒绝：单 agent 无换道空间——重解 5 = 5（真实改进 0），测量维持拒绝', () => {
    // 实例 A：ρ=5、margin = 3 − 5 = −2（borderline）。增广重解里 t2 无处
    // 可去（唯一 agent 已被 score-5 占据，自由处置丢弃 t2）⟹ 5 = 5。
    const base = INSTANCE_A();
    let calls = 0;
    const ctl = new ShadowPriceAdmissionController({
      ewmaAlpha: 1,
      reservePrice: 0,
      verify: 'exact',
      counterfactual: (candidate) => {
        calls += 1;
        const admit = solveWdp(
          [{ id: 'a', capacity: 1 }],
          [
            { id: 't1', score: 5, eligible: ['a'] },
            { id: candidate.taskId, score: candidate.scores[0]!.score, eligible: ['a'] },
          ],
        );
        return { admitWelfare: admit.welfare, rejectWelfare: base.welfare };
      },
    });
    ctl.update(base.duals);
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] });
    assert.equal(calls, 1);
    assert.equal(d.admitted, false); // 5 ≤ 5：拒绝，且这次是**测出来的**
    assert.equal(d.reason, 'below-reserve-price');
    assert.equal(d.certificate, 'exact');
    assert.deepEqual(d.counterfactual, { admitWelfare: 5, rejectWelfare: 5, welfareDelta: 0 });
    assert.equal(d.effectiveMargin, -2); // 对偶侧读数如实保留
    assert.equal(ctl.getMetrics().exactVerifications, 1);
  });

  it('exact 放行（r14i 钉板反例的镜像）：2 agent 换道可见——重解 8 > 5，margin=−2 的错拒被翻正', () => {
    // 实例 B：a1 饱和 ρ=5、a2 空闲 ρ=0；t2 仅 a1 资格 ⟹ margin = 3 − 5
    // = −2（borderline，与上一用例同形）。但增广重解能换道（t1→a2 +
    // t2→a1）：8 > 5 ⟹ 放行。同一对偶读数、同一 margin，测量分辨出
    // 「真该拒」与「该放」——这就是 dual 模式做不到、exact 模式的卖点。
    const base = INSTANCE_B();
    let calls = 0;
    const ctl = new ShadowPriceAdmissionController({
      ewmaAlpha: 1,
      reservePrice: 0,
      verify: 'exact',
      counterfactual: (candidate) => {
        calls += 1;
        const admit = solveWdp(
          [
            { id: 'a1', capacity: 1 },
            { id: 'a2', capacity: 1 },
          ],
          [
            { id: 't1', score: 5, eligible: ['a1', 'a2'] },
            { id: candidate.taskId, score: candidate.scores[0]!.score, eligible: ['a1'] },
          ],
        );
        return { admitWelfare: admit.welfare, rejectWelfare: base.welfare };
      },
    });
    ctl.update(base.duals);
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a1', score: 3 }] });
    assert.equal(calls, 1);
    assert.equal(d.admitted, true); // 8 > 5
    assert.equal(d.reason, 'admitted');
    assert.equal(d.certificate, 'exact');
    assert.deepEqual(d.counterfactual, { admitWelfare: 8, rejectWelfare: 5, welfareDelta: 3 });
    assert.equal(d.best!.agentId, 'a1'); // 对偶明细仍是逐 agent 语言
    assert.equal(d.best!.marginal, -2);
  });

  it('并列语义：admitWelfare = rejectWelfare 精确相等 ⟹ exact 拒绝（严格大于，与 margin 并列拒一致）', () => {
    const spy = spyCallback({ admitWelfare: 5, rejectWelfare: 5 });
    const ctl = exactController(spy.solver);
    ctl.update(INSTANCE_A().duals);
    const d = ctl.decide({ taskId: 'tie', scores: [{ agentId: 'a', score: 3 }] });
    assert.equal(d.admitted, false); // 真实改进恰为 0：放行无所得 ⟹ 拒
    assert.equal(d.certificate, 'exact');
    assert.equal(d.counterfactual!.welfareDelta, 0);
  });

  it('放行侧证明不变（验收③）：exact 模式下 margin 放行走 P1 路径——零回调、证书不换、改进=margin 对拍', () => {
    const spy = spyCallback({ admitWelfare: 999, rejectWelfare: 0 }); // 若被调用会扭曲结果——用于证明没被调用
    const ctl = exactController(spy.solver);
    const base = INSTANCE_B();
    ctl.update(base.duals); // a2 空闲（ρ=0）
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a2', score: 3 }] });
    assert.equal(d.admitted, true); // margin 3 > 0：P1 放行，不经测量
    assert.equal(d.certificate, 'conservative'); // 基础证书如实（放行侧不换 exact）
    assert.equal(d.counterfactual, null);
    assert.equal(spy.calls(), 0); // 放行零成本
    // P1 原始对拍在 exact 模式下原样成立：并入重解改进 = margin = 3
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
    assert.equal(augmented.welfare - base.welfare, 3);
    assert.equal(d.effectiveMargin, 3);
  });
});

describe('R17-B · 成本账（对偶强拒零成本；无 borderline 零回调）', () => {
  it('dual-certified 强拒不触发回调（验收②）：P2 有证书，不必花钱测', () => {
    // 双证：(a) 求解器真实产出的证书态——空图（位势全零，π_sink=π_S），
    // 零分候选并列拒；(b) 证书成立＋饱和租金的价格面——手工报告
    // {ρ=4, dualCertified=true}（P2 证书态的规范形状；本仓 SSP 在
    // 正分图上早停常给 conservative，证书态由调用方对偶源如实汇报）。
    const spyA = spyCallback({ admitWelfare: 99, rejectWelfare: 0 });
    const ctlA = exactController(spyA.solver);
    ctlA.update(EMPTY_DUALS()); // dualCertified=true、ρ=0
    const dA = ctlA.decide({ taskId: 'zero', scores: [{ agentId: 'a', score: 0 }] });
    assert.equal(dA.admitted, false); // margin 0 并列拒
    assert.equal(dA.certificate, 'dual-certified');
    assert.equal(spyA.calls(), 0); // 不花钱
    assert.equal(ctlA.getMetrics().exactVerifications, 0);

    const spyB = spyCallback({ admitWelfare: 99, rejectWelfare: 0 });
    const ctlB = exactController(spyB.solver);
    ctlB.update({
      agents: [{ agentId: 'a1', shadowPrice: 4, saturated: true }],
      dualCertified: true,
    });
    const dB = ctlB.decide({ taskId: 't3', scores: [{ agentId: 'a1', score: 3 }] });
    assert.equal(dB.admitted, false); // 3 − 4 = −1：P2 证书拒
    assert.equal(dB.certificate, 'dual-certified');
    assert.equal(dB.reason, 'below-reserve-price');
    assert.equal(spyB.calls(), 0);
    assert.equal(ctlB.getMetrics().exactVerifications, 0);
  });

  it('无 borderline 的流零回调调用（验收④）：放行 + no-candidate + dual-certified 拒混合流', () => {
    const spy = spyCallback({ admitWelfare: 99, rejectWelfare: 0 });
    const ctl = exactController(spy.solver);
    ctl.update(INSTANCE_B().duals); // conservative 态——但流里没有 borderline
    assert.equal(
      ctl.decide({ taskId: 'hi1', scores: [{ agentId: 'a2', score: 3 }] }).admitted,
      true,
    ); // margin 放行（P1）
    assert.equal(
      ctl.decide({ taskId: 'hi2', scores: [{ agentId: 'a1', score: 9 }] }).admitted,
      true,
    ); // margin 放行
    const none = ctl.decide({ taskId: 'none', scores: [] }); // 结构拒绝
    assert.equal(none.reason, 'no-candidate-agents');
    ctl.update(EMPTY_DUALS()); // 换到证书态
    const certified = ctl.decide({ taskId: 'neg', scores: [{ agentId: 'a', score: -1.5 }] });
    assert.equal(certified.certificate, 'dual-certified');
    assert.equal(certified.admitted, false);
    assert.equal(spy.calls(), 0); // 整条流零反事实求解
    const m = ctl.getMetrics();
    assert.equal(m.exactVerifications, 0);
    assert.equal(m.decisions, 4);
    assert.equal(m.admissions, 2);
    assert.equal(m.rejections, 2); // 4 = 2 + 2 恒等式
  });

  it('每个 borderline 恰好一次反事实求解：两次 borderline（一次放行一次拒）＋穿插放行 = 恰 2 次', () => {
    let calls = 0;
    let admitWelfare = 5.5; // 状态化测量：首轮 5.5>5 放行，次轮 4.5≤5 拒绝
    const ctl = exactController((c: AdmissionCandidate) => {
      calls += 1;
      assert.ok(c.taskId.length > 0);
      return { admitWelfare, rejectWelfare: 5 };
    });
    ctl.update(INSTANCE_A().duals); // ρ=5 conservative
    const first = ctl.decide({ taskId: 'b1', scores: [{ agentId: 'a', score: 3 }] });
    assert.equal(first.certificate, 'exact');
    assert.equal(first.admitted, true); // 5.5 > 5
    assert.equal(
      ctl.decide({ taskId: 'mid', scores: [{ agentId: 'a', score: 9 }] }).admitted,
      true,
    ); // margin 放行，不花钱
    admitWelfare = 4.5; // 批状态演进：同一个对偶读数，测出相反结果
    const second = ctl.decide({ taskId: 'b2', scores: [{ agentId: 'a', score: 2 }] });
    assert.equal(second.certificate, 'exact');
    assert.equal(second.admitted, false); // 4.5 ≤ 5：exact 拒绝
    assert.equal(second.counterfactual!.welfareDelta, -0.5);
    assert.equal(calls, 2);
    assert.equal(ctl.getMetrics().exactVerifications, 2);
    assert.equal(ctl.getMetrics().decisions, 3);
  });

  it('verify=dual 不消费回调（模式正交）：borderline 保守拒、零调用', () => {
    const spy = spyCallback({ admitWelfare: 99, rejectWelfare: 0 });
    const ctl = exactController(spy.solver, { verify: 'dual' });
    ctl.update(INSTANCE_A().duals);
    const d = ctl.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] });
    assert.equal(d.admitted, false);
    assert.equal(d.certificate, 'conservative');
    assert.equal(d.reason, 'below-reserve-price');
    assert.equal(spy.calls(), 0); // dual 模式对回调零消费
    assert.equal(ctl.getMetrics().exactVerifications, 0);
  });

  it('metrics 快照冻结 + unverifiedConservativeRejections 只数 exact 无回调的缺口', () => {
    const ctl = exactController();
    ctl.update(INSTANCE_A().duals);
    const m0 = ctl.getMetrics();
    assert.ok(Object.isFrozen(m0)); // 冻结副本——调用方改不动内部账
    ctl.decide({ taskId: 'hi', scores: [{ agentId: 'a', score: 9 }] }); // 放行
    ctl.decide({ taskId: 'gap', scores: [{ agentId: 'a', score: 3 }] }); // unverified
    ctl.decide({ taskId: 'gap2', scores: [{ agentId: 'a', score: 1 }] }); // unverified
    assert.equal(m0.decisions, 0); // 旧快照不被后续调用改写
    const m1 = ctl.getMetrics();
    assert.equal(m1.decisions, 3);
    assert.equal(m1.unverifiedConservativeRejections, 2);
    assert.deepEqual([m1.admissions, m1.rejections], [1, 2]);
  });
});

describe('R17-B · 确定性重放（exact 模式，含 counterfactual 测量字段）', () => {
  it('同一 (updates, candidates, 回调) 序列两次执行产逐字段相同的决策', () => {
    const runScenario = (): string[] => {
      let welfareOracle = 5; // 状态化但确定的回调（模拟编排者批状态演进）
      const ctl = new ShadowPriceAdmissionController({
        ewmaAlpha: 0.5,
        reservePrice: 0,
        verify: 'exact',
        counterfactual: (c: AdmissionCandidate) => {
          const admit = welfareOracle + (c.scores[0]!.score > 2 ? 4 : 0);
          return { admitWelfare: admit, rejectWelfare: welfareOracle };
        },
      });
      ctl.update(INSTANCE_A().duals);
      const out: string[] = [];
      for (const t of ['lo', 'hi', 'mid'] as const) {
        out.push(JSON.stringify(ctl.decide({ taskId: t, scores: [{ agentId: 'a', score: 3 }] })));
        welfareOracle += 1; // 批状态演进（重放从同一初值起——确定性）
      }
      return out;
    };
    assert.deepEqual(runScenario(), runScenario());
  });
});

describe('R17-B · 负对照（回调契约与配置域具名拒绝）', () => {
  it('回调返回 NaN：admitWelfare / rejectWelfare 逐字段点名，成本已付、控制器零残留', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '8' as unknown as number]) {
      const ctl = exactController(() => ({ admitWelfare: bad, rejectWelfare: 5 }));
      ctl.update(INSTANCE_A().duals);
      assert.throws(
        () => ctl.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] }),
        (err: unknown) =>
          err instanceof MechanismError &&
          err.message.includes('admitWelfare must be a finite number'),
      );
      assert.equal(ctl.getMetrics().exactVerifications, 1); // 尝试即成本
      assert.equal(ctl.getMetrics().decisions, 0); // 未产决策
    }
    const ctlN = exactController(() => ({ admitWelfare: 5, rejectWelfare: Number.NaN }));
    ctlN.update(INSTANCE_A().duals);
    assert.throws(
      () => ctlN.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] }),
      (err: unknown) =>
        err instanceof MechanismError &&
        err.message.includes('rejectWelfare must be a finite number'),
    );
    // 零残留：EWMA 价格未被污染，后续合法 decide 照常工作
    assert.equal(ctlN.getSmoothedPrice('a'), 5);
    const ok = exactController(() => ({ admitWelfare: 8, rejectWelfare: 5 }));
    ok.update(INSTANCE_A().duals);
    assert.equal(
      ok.decide({ taskId: 'after', scores: [{ agentId: 'a', score: 3 }] }).admitted,
      true,
    );
  });

  it('回调返回缺字段/非对象：{} / undefined 字段 / null / 数组 / 字符串逐条具名', () => {
    const cases: unknown[] = [
      {},
      { admitWelfare: 8 }, // 缺 rejectWelfare
      { rejectWelfare: 5 }, // 缺 admitWelfare
      null,
      [8, 5],
      '8',
    ];
    for (const garbage of cases) {
      const ctl = exactController(() => garbage as CounterfactualWelfare);
      ctl.update(INSTANCE_A().duals);
      assert.throws(
        () => ctl.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] }),
        (err: unknown) =>
          err instanceof MechanismError &&
          err.message.includes('counterfactual result for task t2'),
        `expected named rejection for garbage ${JSON.stringify(garbage) ?? String(garbage)}`,
      );
    }
  });

  it('verify 非法值：非 dual/exact 逐条点名（字符串/数字/null）', () => {
    for (const bad of ['strict', 'EXACT', 42, null]) {
      assert.throws(
        () =>
          new ShadowPriceAdmissionController({
            ewmaAlpha: 1,
            reservePrice: 0,
            verify: bad as AdmissionVerifyMode,
          }),
        (err: unknown) => err instanceof MechanismError && err.message.includes('verify'),
      );
    }
  });

  it('回调抛错原样透传（不包装）：Error 实例同引用抛出、非 Error（字符串）同值抛出；状态零残留', () => {
    // Error 实例：透传的是**同一个**对象（没有 wrap 成 MechanismError）
    const boom = new Error('solver exploded');
    const ctlE = exactController(() => {
      throw boom;
    });
    ctlE.update(INSTANCE_A().duals);
    assert.throws(
      () => ctlE.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] }),
      (err: unknown) => err === boom,
    );
    assert.equal(ctlE.getMetrics().exactVerifications, 1); // 成本已付（尝试计数）
    assert.equal(ctlE.getMetrics().decisions, 0);
    assert.equal(ctlE.getSmoothedPrice('a'), 5); // EWMA 零残留
    // 非 Error：字符串原样抛出（错误语义归求解器所有）
    const ctlS = exactController(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- 非 Error 透传正是本用例被测的声明语义
      throw 'raw solver failure';
    });
    ctlS.update(INSTANCE_A().duals);
    assert.throws(
      () => ctlS.decide({ taskId: 't2', scores: [{ agentId: 'a', score: 3 }] }),
      (err: unknown) => err === 'raw solver failure',
    );
  });

  it('counterfactual 非函数（config 域）：数字/字符串/null 逐条点名', () => {
    for (const bad of [42, 'solver', null]) {
      assert.throws(
        () =>
          new ShadowPriceAdmissionController({
            ewmaAlpha: 1,
            reservePrice: 0,
            counterfactual: bad as unknown as CounterfactualSolver,
          }),
        (err: unknown) =>
          err instanceof MechanismError &&
          err.message.includes('counterfactual must be a function'),
      );
    }
  });
});
