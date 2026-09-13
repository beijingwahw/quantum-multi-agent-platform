/**
 * R14-C 创新 1b：BayesianHireBrain（Beta-Bernoulli 技能追踪 + Thompson/
 * UCB/贪心多臂雇佣 + LCB 雇佣阈值）的行为钉死与负对照。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BayesianHireBrain,
  DEFAULT_BAYESIAN_HIRE_CONFIG,
  type HireAgentSpec,
} from '../src/proactive-intelligence/bayesian-hire-brain.js';
import { mulberry32 } from '../src/utils/rng.js';
import { ConfigurationError, MechanismError } from '../src/utils/errors.js';
import { betaQuantile } from '../src/proactive-intelligence/beta-distribution.js';

function spec(
  id: string,
  capabilities: string[],
  trueCost: number,
  credentialQuality: Record<string, number>,
  bid?: number,
): HireAgentSpec {
  return { id, capabilities, trueCost, credentialQuality, ...(bid !== undefined ? { bid } : {}) };
}

describe('BayesianHireBrain · 后验与指派基础', () => {
  it('贪心策略下低成本高凭证者中标；后验均值 = 凭证先验的 Beta 收缩（与 baseEstimate 同口径）', () => {
    const brain = new BayesianHireBrain({ policy: 'greedy' });
    brain.registerAgent(spec('good', ['X'], 1, { X: 0.8 }));
    brain.registerAgent(spec('bad', ['X'], 1, { X: 0.4 }));
    const a = brain.submitTask('X')!;
    assert.equal(a.winnerId, 'good');
    // 单调契约：缺省 Beta(1.5,1.5) 后验均值 0.5/0.8 → q̂_good
    // socialValue = V·q̂（贪心=后验均值）
    assert.ok(Math.abs(a.socialValue! - 10 * 0.8) < 1e-12, `socialValue=${a.socialValue}`);
    // 支付 = clamp(V·q̂_w − s₂, 0, V·q̂_w)：s₂ = 10·0.4 − 1 = 3
    const expectedPayment = Math.min(Math.max(10 * 0.8 - (10 * 0.4 - 1), 0), 10 * 0.8);
    assert.ok(Math.abs(a.payment - expectedPayment) < 1e-12, `payment=${a.payment}`);
    assert.ok(a.payment >= 1, 'IR（该配置下）：支付 ≥ 赢家报价 1');
  });

  it('结算驱动后验：成功抬高 α/均值/LCB，getState 暴露区间与履历', () => {
    const brain = new BayesianHireBrain({ policy: 'greedy' });
    brain.registerAgent(spec('solo', ['X'], 1, { X: 0.5 }));
    for (let i = 0; i < 8; i++) {
      const a = brain.submitTask('X')!;
      assert.equal(brain.settleTask(a.taskId, true), true);
    }
    const skill = brain.getState().agents[0]!.skills[0]!;
    assert.equal(skill.attempts, 8);
    assert.equal(skill.successes, 8);
    // 先验 Beta(1.5,1.5) + 8 成功 → α=9.5, β=1.5，均值 9.5/11
    assert.ok(Math.abs(skill.alpha - 9.5) < 1e-12 && Math.abs(skill.beta - 1.5) < 1e-12);
    assert.ok(Math.abs(skill.mean - 9.5 / 11) < 1e-12);
    // 8 连胜后 LCB(0.9) 应显著高于冷启动的先验 LCB（Beta(1.5,1.5) 的
    // 0.9 分位 ≈ 0.844 → 8 连胜后 ≈ 0.970）
    const priorLcb = betaQuantile(0.9, 1.5, 1.5);
    assert.ok(skill.lcb > priorLcb + 0.1, `LCB 应显著上移：${skill.lcb} vs ${priorLcb}`);
    // 95% CI 覆盖均值且下界 < LCB(0.9) < 上界（分位数的单调序）
    assert.ok(skill.ci95[0] < skill.mean && skill.mean < skill.ci95[1]);
    assert.ok(skill.ci95[0] < skill.lcb && skill.lcb < skill.ci95[1]);
    assert.equal(brain.getState().successRate, 1);
  });

  it('Thompson 确定性：同 seed 同注册序同任务流 → 分配/支付序列逐位相同', () => {
    const run = (): string[] => {
      const brain = new BayesianHireBrain({ policy: 'thompson', seed: 7 });
      brain.registerAgent(spec('a', ['X'], 1, { X: 0.7 }));
      brain.registerAgent(spec('b', ['X'], 1.2, { X: 0.6 }));
      const out: string[] = [];
      for (let i = 0; i < 30; i++) {
        const asg = brain.submitTask('X')!;
        out.push(`${asg.winnerId}:${asg.payment.toPrecision(12)}`);
        assert.equal(brain.settleTask(asg.taskId, i % 3 !== 0), true); // 确定性成败流
      }
      return out;
    };
    const first = run();
    const second = run();
    assert.deepEqual(first, second, '同 seed 下 Thompson 序列必须逐位可复现');
    assert.ok(first.length === 30);
  });

  it('Thompson 学习收敛：真实质量差距下高质量 agent 收敛拿到多数任务（对照 statistical 行为）', () => {
    // 真实动力学由测试侧独立 RNG 驱动：q_good=0.8、q_bad=0.4
    const truth = mulberry32(123);
    const brain = new BayesianHireBrain({ policy: 'thompson', seed: 42 });
    brain.registerAgent(spec('good', ['X'], 1, { X: 0.5 })); // 凭证不可信，靠后验学
    brain.registerAgent(spec('bad', ['X'], 1, { X: 0.5 }));
    let goodWins = 0;
    for (let i = 0; i < 300; i++) {
      const asg = brain.submitTask('X');
      assert.ok(asg, '同价两人必有人中标');
      const q = asg.winnerId === 'good' ? 0.8 : 0.4;
      brain.settleTask(asg.taskId, truth() < q);
      if (asg.winnerId === 'good') goodWins++;
    }
    assert.ok(goodWins > 200, `300 任务后 good 应拿下多数（regret 收敛），实际 ${goodWins}/300`);
    const state = brain.getState();
    const goodSkill = state.agents[0]!.skills[0]!;
    const badSkill = state.agents[1]!.skills[0]!;
    assert.ok(goodSkill.mean > badSkill.mean, '后验均值应区分出真实质量差');
  });

  it('UCB1 对照臂：零随机性（同输入同输出），且未探索 agent 的 UCB 加成高于已探索者', () => {
    const mk = (): BayesianHireBrain => {
      const brain = new BayesianHireBrain({ policy: 'ucb1', ucbExploration: 1 });
      brain.registerAgent(spec('vet', ['X'], 1, { X: 0.7 }));
      brain.registerAgent(spec('novice', ['X'], 1, { X: 0.7 })); // 同凭证同报价
      return brain;
    };
    const a = mk();
    const b = mk();
    const seqOf = (brain: BayesianHireBrain): string[] => {
      const out: string[] = [];
      for (let i = 0; i < 6; i++) {
        const asg = brain.submitTask('X')!;
        out.push(asg.winnerId!); // 两 agent 同价市场必有赢家（submitTask 契约）
        brain.settleTask(asg.taskId, true);
      }
      return out;
    };
    assert.deepEqual(seqOf(a), seqOf(b), 'UCB1 无随机源，序列确定');

    // 冷启动后 vet 连胜 5 次 → novice 的 n 更小 → UCB 加成更大 → 下一单归 novice
    const brain = mk();
    for (let i = 0; i < 5; i++) {
      const asg = brain.submitTask('X')!;
      brain.settleTask(asg.taskId, true);
    }
    const next = brain.submitTask('X')!;
    assert.equal(next.winnerId, 'novice', '探索加成应把任务推向尝试不足的 arm');
  });
});

describe('BayesianHireBrain · 遗忘因子（非平稳质量）', () => {
  it('ρ<1 产生时序敏感性：同计数不同顺序的后验不同（近期观测权重高）；ρ=1 顺序无关', () => {
    const settle = (brain: BayesianHireBrain, outcomes: boolean[]): void => {
      for (const success of outcomes) {
        const asg = brain.submitTask('X')!;
        assert.ok(asg, 'solo agent 必有分配');
        brain.settleTask(asg.taskId, success);
      }
    };
    const meanOf = (brain: BayesianHireBrain): number =>
      brain.getState().agents[0]!.skills[0]!.mean;
    const mk = (forgetting: number): BayesianHireBrain => {
      const brain = new BayesianHireBrain({ policy: 'greedy', forgetting });
      brain.registerAgent(spec('solo', ['X'], 1, { X: 0.5 }));
      return brain;
    };
    // 静态：4 成功→4 失败 与 4 失败→4 成功 的后验逐位相同
    const s1 = mk(1);
    settle(s1, [true, true, true, true, false, false, false, false]);
    const s2 = mk(1);
    settle(s2, [false, false, false, false, true, true, true, true]);
    assert.equal(meanOf(s1), meanOf(s2), 'ρ=1（静态）后验必须顺序无关');

    // 遗忘：近期成功（后 4 成功）的后验均值 > 近期失败
    const f1 = mk(0.5);
    settle(f1, [true, true, true, true, false, false, false, false]);
    const f2 = mk(0.5);
    settle(f2, [false, false, false, false, true, true, true, true]);
    assert.ok(
      meanOf(f2) > meanOf(f1),
      `ρ=0.5 近期成功 (${meanOf(f2).toFixed(4)}) 应高于近期失败 (${meanOf(f1).toFixed(4)})`,
    );
    // 遗忘后终身计数不受影响（履历口径）
    assert.equal(f1.getState().agents[0]!.skills[0]!.attempts, 8);
    assert.equal(f1.getState().agents[0]!.skills[0]!.successes, 4);
  });
});

describe('BayesianHireBrain · LCB 雇佣阈值与免费处置', () => {
  it('hireFloor 拦截低置信 agent：实习通道放行前 probationTrials 次，此后 LCB 不足即弃标', () => {
    // 凭证 0.5 → 先验 Beta(1.5,1.5)，其 LCB(0.9) ≈ 0.844 < 0.9：
    // 门槛高过冷启动置信度，只有实习通道能放行
    const brain = new BayesianHireBrain({
      policy: 'greedy',
      hireFloor: 0.9,
      probationTrials: 2,
      lcbConfidence: 0.9,
    });
    brain.registerAgent(spec('solo', ['X'], 1, { X: 0.5 }));

    // 实习通道：前 2 单放行（分配成功），结算全部失败
    for (let i = 0; i < 2; i++) {
      const asg = brain.submitTask('X');
      assert.ok(asg, `第 ${i + 1} 单应经实习通道放行`);
      brain.settleTask(asg.taskId, false);
    }
    // 2 次失败后 LCB 更低且试用已用尽 → 门槛拦截 → null（宁缺毋滥）
    assert.equal(brain.submitTask('X'), null, 'LCB 不足且试用用尽应弃标');

    // 对照：无实习通道（probationTrials=0）时同一门槛直接弃标——
    // 证明上例的前 2 单确实经实习通道而非门槛自身放行
    const strict = new BayesianHireBrain({
      policy: 'greedy',
      hireFloor: 0.9,
      probationTrials: 0,
      lcbConfidence: 0.9,
    });
    strict.registerAgent(spec('solo', ['X'], 1, { X: 0.5 }));
    assert.equal(strict.submitTask('X'), null, '门槛高于冷启动 LCB 且无实习通道 → 立即弃标');
  });

  it('hireFloor=0（缺省）时门槛关闭：LCB 极低也不拦截', () => {
    const brain = new BayesianHireBrain({ policy: 'greedy' });
    brain.registerAgent(spec('solo', ['X'], 1, { X: 0.5 }));
    for (let i = 0; i < 5; i++) {
      const asg = brain.submitTask('X');
      assert.ok(asg);
      brain.settleTask(asg.taskId, false);
    }
    assert.equal(DEFAULT_BAYESIAN_HIRE_CONFIG.hireFloor, 0, '缺省配置确认门槛关闭');
  });

  it('免费处置：唯一 agent 报价远超任务价值 → null（与 GrowthSchedulerBrain 同契约）', () => {
    const brain = new BayesianHireBrain({ policy: 'greedy', taskValue: 1 });
    brain.registerAgent(spec('dear', ['X'], 1, { X: 0.9 }, 1e9));
    assert.equal(brain.submitTask('X'), null);
    // 无人具备能力同样 null
    assert.equal(brain.submitTask('UNHEARD-OF'), null);
  });
});

describe('BayesianHireBrain · 插件集成（opt-in 接线零改动验证）', () => {
  it('作为 config.brain 实例接入 ProactiveIntelligencePlugin：task_request → 分配动作 → 结算闭环', async () => {
    const { ProactiveIntelligencePlugin } = await import('../src/proactive-intelligence/index.js');
    const brain = new BayesianHireBrain({ policy: 'greedy', taskValue: 10 });
    brain.registerAgent(spec('a1', ['summarize'], 0.5, { summarize: 0.7 }));

    const plugin = new ProactiveIntelligencePlugin({ brain });
    await plugin.start();
    plugin.observe({
      type: 'task_request',
      source: 'test',
      data: { capability: 'summarize' },
      severity: 'info',
    });
    await plugin.flush();

    const hist = plugin.getExecutor().getExecutionHistory();
    const alloc = hist.find((e) => e.status === 'completed' && e.action?.type === 'assignment');
    assert.ok(alloc, 'task_request 应经 BayesianHireBrain 产出 market_allocate 执行记录');
    const taskId = (alloc.result as { taskId: string }).taskId;
    assert.equal(plugin.settleTask(taskId, true), true, '结算命中在途任务');
    assert.equal((plugin.getBrain()!.getState() as { openTasks: number }).openTasks, 0);
    assert.equal(plugin.settleTask(taskId, true), false, '重复结算幂等拒绝');
    await plugin.stop();
  });
});

describe('BayesianHireBrain · 负对照（走私审判）', () => {
  it('重复注册指名拒绝（防后验静默清空）', () => {
    const brain = new BayesianHireBrain();
    brain.registerAgent(spec('a', ['X'], 1, { X: 0.5 }));
    assert.throws(
      () => brain.registerAgent(spec('a', ['Y'], 1, { Y: 0.5 })),
      (error: unknown) =>
        error instanceof MechanismError && error.message.includes("'a' is already registered"),
    );
  });

  it('非法 spec：空 id / 负 trueCost / 越界凭证 / 负报价指名拒绝', () => {
    const brain = new BayesianHireBrain();
    assert.throws(
      () => brain.registerAgent(spec('', ['X'], 1, {})),
      /id must be a non-empty string/,
    );
    assert.throws(
      () => brain.registerAgent(spec('neg', ['X'], -1, {})),
      /trueCost must be a finite non-negative number, got -1/,
    );
    assert.throws(
      () => brain.registerAgent(spec('cred', ['X'], 1, { X: 1.5 })),
      /credentialQuality\['X'\] must be within \[0, 1\], got 1.5/,
    );
    assert.throws(
      () => brain.registerAgent(spec('bid', ['X'], 1, { X: 0.5 }, -3)),
      /bid must be a finite non-negative number, got -3/,
    );
  });

  it('非法配置：forgetting=0 / lcbConfidence≥1 / hireFloor≥1 / 非整数 probation / 未知 policy 指名拒绝', () => {
    assert.throws(
      () => new BayesianHireBrain({ forgetting: 0 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('forgetting'),
    );
    assert.throws(
      () => new BayesianHireBrain({ lcbConfidence: 1 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('lcbConfidence'),
    );
    assert.throws(
      () => new BayesianHireBrain({ hireFloor: 1 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('hireFloor'),
    );
    assert.throws(
      () => new BayesianHireBrain({ probationTrials: 1.5 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('probationTrials'),
    );
    assert.throws(
      () => new BayesianHireBrain({ policy: 'epsilon-greedy' as never }),
      /policy must be one of: thompson, greedy, ucb1/,
    );
    assert.throws(
      () => new BayesianHireBrain({ ucbExploration: -0.1 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('ucbExploration'),
    );
    // 非法 seed 由 Mulberry32 构造守卫（平台既有契约）
    assert.throws(() => new BayesianHireBrain({ seed: Number.NaN }), /finite number/);
  });

  it('未知 taskId 结算幂等拒绝（false，不抛错不记账）', () => {
    const brain = new BayesianHireBrain();
    brain.registerAgent(spec('a', ['X'], 1, { X: 0.5 }));
    assert.equal(brain.settleTask('nope', true), false);
    assert.equal(brain.getState().settledCount, 0);
    assert.equal(brain.getState().netWelfare, 0);
  });
});
