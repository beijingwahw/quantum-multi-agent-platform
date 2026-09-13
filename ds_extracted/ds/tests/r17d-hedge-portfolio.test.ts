/**
 * R17-D 创新：portfolio 策略——对 {greedy, thompson, ucb1} 跑 Hedge
 * （乘性权重、全信息反馈），把「条件性正向」升格为处处近最优。
 *
 * 验收面（与 src/proactive-intelligence/bayesian-hire-brain.ts 类头
 * R17-D 节的声明一一对应）：
 *   ① 三条对抗流（受控结算函数分别让 greedy/thompson/ucb1 事后最优）：
 *      portfolio ≥ 最优单策略 − (ln K/η + ηT/2)·taskValue；
 *   ② 展演流（quantum-innovation-showcase 演示 5 的同款构造）：
 *      portfolio ≥ greedy − 界；
 *   ③ 确定性重跑逐位一致（分配序列 + Hedge 遥测）；
 *   ④ 负对照（η 域 / 空成员集 / 重复成员 / 走私成员名）；
 *   ⑤ 机制单元：权重更新算术独立复算、thompson 流未选中不消耗、
 *      K=1 退化为单策略、选择流与单策略流独立。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BayesianHireBrain,
  DEFAULT_BAYESIAN_HIRE_CONFIG,
  type HedgeMember,
  type HireAgentSpec,
  type PortfolioTelemetry,
} from '../src/proactive-intelligence/bayesian-hire-brain.js';
import { ConfigurationError } from '../src/utils/errors.js';

// ----------------------------------------------------------------------------
// 测试脚手架：对抗流 = 受控结算函数（确定性 (agentId, round) → 成败）
// ----------------------------------------------------------------------------

interface StreamSpec {
  label: string;
  taskValue: number;
  priorWeight: number;
  ucbExploration: number;
  agents: HireAgentSpec[];
  settles: (id: string, round: number) => boolean;
}

function spec(
  id: string,
  trueCost: number,
  credential: number,
  capabilities: string[] = ['X'],
): HireAgentSpec {
  return { id, capabilities, trueCost, credentialQuality: { X: credential } };
}

/** 单策略基线（与展演的并行模拟口径一致：独立 brain 各自分配并结算） */
function runSingle(stream: StreamSpec, policy: HedgeMember, rounds: number, seed: number): number {
  const brain = new BayesianHireBrain({
    taskValue: stream.taskValue,
    priorWeight: stream.priorWeight,
    ucbExploration: stream.ucbExploration,
    policy,
    seed,
  });
  for (const a of stream.agents) brain.registerAgent(a);
  for (let r = 0; r < rounds; r++) {
    const asg = brain.submitTask('X');
    if (asg === null) continue;
    brain.settleTask(asg.taskId, stream.settles(asg.winnerId!, r));
  }
  return brain.getState().netWelfare;
}

interface PortfolioRun {
  welfare: number;
  settled: number;
  telemetry: PortfolioTelemetry;
  /** 逐轮机器账：轮次/赢家/成败（确定性重跑与独立复算的数据源） */
  trace: string[];
}

function runPortfolio(
  stream: StreamSpec,
  rounds: number,
  seed: number,
  hedgeEta: number,
): PortfolioRun {
  const brain = new BayesianHireBrain({
    taskValue: stream.taskValue,
    priorWeight: stream.priorWeight,
    ucbExploration: stream.ucbExploration,
    policy: 'portfolio',
    seed,
    hedgeEta,
  });
  for (const a of stream.agents) brain.registerAgent(a);
  const trace: string[] = [];
  let settled = 0;
  for (let r = 0; r < rounds; r++) {
    const asg = brain.submitTask('X');
    if (asg === null) {
      trace.push(`${r}:decline`);
      continue;
    }
    const ok = stream.settles(asg.winnerId!, r);
    brain.settleTask(asg.taskId, ok);
    trace.push(`${r}:${asg.winnerId}:${ok ? 1 : 0}`);
    settled++;
  }
  const state = brain.getState();
  return {
    welfare: state.netWelfare,
    settled,
    telemetry: state.portfolio!,
    trace,
  };
}

/** Hedge 后悔界（福利单位）：(ln K/η + η·T/2)·taskValue，η ∈ (0,1] 的经典常数 */
function hedgeBound(K: number, eta: number, T: number, taskValue: number): number {
  return (Math.log(K) / eta + (eta * T) / 2) * taskValue;
}

const ETA = 0.1;

// ----------------------------------------------------------------------------
// 三条对抗流（机器账：每流断言 事后最优成员 + portfolio ≥ 最优 − 界）
// ----------------------------------------------------------------------------

/** 流 G：greedy 事后最优——凭证排序即真值排序，任何探索都是纯损耗 */
const STREAM_G: StreamSpec = {
  label: 'G（greedy 最优：hi 恒胜，探索即损耗）',
  taskValue: 10,
  priorWeight: 3,
  ucbExploration: 1,
  agents: [spec('hi', 2, 0.85), spec('mid', 2, 0.68), spec('lo', 2, 0.5)],
  settles: (id) => id === 'hi',
};

/** 流 T：thompson 事后最优——高凭证诱饵的真值平庸（60%），低凭证真金恒胜，
 * 比例抽样快于均值爬坡发现真金；greedy 永远信凭证，ucb1 被对数日程慢性征税 */
const STREAM_T: StreamSpec = {
  label: 'T（thompson 最优：凭证陷阱 60% vs 低凭证真金）',
  taskValue: 10,
  priorWeight: 3,
  ucbExploration: 1,
  agents: [spec('decoy', 2, 0.85), spec('gold', 2, 0.45), spec('noise', 2, 0.6)],
  settles: (id, r) => (id === 'decoy' ? r % 5 < 3 : id === 'gold'),
};

/** 流 U：ucb1 事后最优——极低凭证真金只有确定性探索加成够得着：
 * greedy 卡死在海妖上（均值爬坡 ~57 轮），thompson 的抽样概率被
 * L 形先验压到近零，唯 ucb1 的加成在第 ~3 轮就把真金拉进来 */
const STREAM_U: StreamSpec = {
  label: 'U（ucb1 最优：极低凭证真金，唯探索可达）',
  taskValue: 10,
  priorWeight: 3,
  ucbExploration: 1,
  agents: [spec('siren', 2, 0.99), spec('gem', 2, 0.05), spec('noise', 2, 0.9)],
  settles: (id) => id === 'gem',
};

function adversarialLedger(
  stream: StreamSpec,
  rounds: number,
  best: HedgeMember,
  runnerUp: HedgeMember,
): void {
  const greedy = runSingle(stream, 'greedy', rounds, 42);
  const thompson = runSingle(stream, 'thompson', rounds, 42);
  const ucb1 = runSingle(stream, 'ucb1', rounds, 42);
  const pf = runPortfolio(stream, rounds, 42, ETA);
  const bestW = { greedy, thompson, ucb1 }[best];
  const runnerUpW = { greedy, thompson, ucb1 }[runnerUp];
  const bound = hedgeBound(3, ETA, pf.telemetry.hedgeRounds, stream.taskValue);
  console.log(
    `[R17-D 流 ${stream.label}] greedy=${greedy} thompson=${thompson} ucb1=${ucb1} ` +
      `| portfolio=${pf.welfare}（结算 ${pf.settled}/${rounds}）` +
      `| 最优 ${best}=${bestW} 差距=${bestW - pf.welfare} vs 界=${bound.toFixed(1)} ` +
      `| 权重终值=[${pf.telemetry.weights.map((w) => w.toFixed(3)).join(', ')}]`,
  );
  assert.ok(
    bestW > runnerUpW,
    `流 ${stream.label}：${best} 应严格优于 ${runnerUp}（${bestW} vs ${runnerUpW}）`,
  );
  assert.ok(
    pf.welfare >= bestW - bound - 1e-9,
    `流 ${stream.label}：portfolio(${pf.welfare}) ≥ ${best}(${bestW}) − 界(${bound.toFixed(2)})`,
  );
}

describe('R17-D · Hedge 组合（portfolio）：三条对抗流 + 展演流', () => {
  it('流 G（300 轮）：greedy 事后最优；portfolio ≥ greedy − 界', () => {
    adversarialLedger(STREAM_G, 300, 'greedy', 'thompson');
  });

  it('流 T（200 轮）：thompson 事后最优；portfolio ≥ thompson − 界', () => {
    adversarialLedger(STREAM_T, 200, 'thompson', 'ucb1');
  });

  it('流 U（300 轮）：ucb1 事后最优；portfolio ≥ ucb1 − 界', () => {
    adversarialLedger(STREAM_U, 300, 'ucb1', 'greedy');
  });

  it('展演流（演示 5 同款构造，20 轮）：portfolio ≥ greedy − 界', () => {
    const ROUNDS = 20;
    const stream: StreamSpec = {
      label: '展演（alice 75% / bob 50% / carol 25%，成本 3/2/1）',
      taskValue: 10,
      priorWeight: 3,
      ucbExploration: 1,
      agents: [
        { id: 'alice', capabilities: ['X'], trueCost: 3, credentialQuality: { X: 0.85 } },
        { id: 'bob', capabilities: ['X'], trueCost: 2, credentialQuality: { X: 0.6 } },
        { id: 'carol', capabilities: ['X'], trueCost: 1, credentialQuality: { X: 0.4 } },
      ],
      settles: (id, r) => (id === 'alice' ? r % 4 !== 3 : id === 'bob' ? r % 2 === 0 : r % 4 === 0),
    };
    const greedy = runSingle(stream, 'greedy', ROUNDS, 42);
    const thompson = runSingle(stream, 'thompson', ROUNDS, 42);
    const ucb1 = runSingle(stream, 'ucb1', ROUNDS, 42);
    const pf = runPortfolio(stream, ROUNDS, 42, ETA);
    const bound = hedgeBound(3, ETA, pf.telemetry.hedgeRounds, stream.taskValue);
    console.log(
      `[R17-D 展演流] greedy=${greedy} thompson=${thompson} ucb1=${ucb1} ` +
        `| portfolio=${pf.welfare} 差距=${greedy - pf.welfare} vs 界=${bound.toFixed(1)}`,
    );
    assert.ok(greedy > thompson && greedy > ucb1, '展演流 greedy 应为事后最优（既有披露）');
    assert.ok(
      pf.welfare >= greedy - bound - 1e-9,
      `展演流：portfolio(${pf.welfare}) ≥ greedy(${greedy}) − 界(${bound.toFixed(2)})`,
    );
  });
});

// ----------------------------------------------------------------------------
// 机制单元与确定性
// ----------------------------------------------------------------------------

describe('R17-D · 机制单元（权重算术 / RNG 流纪律 / 退化与独立）', () => {
  it('Hedge 权重更新算术独立复算：逐轮对拍 exp(η·r̂) 归一化（误差 < 1e-12）', () => {
    // 独立复算：从逐轮 (winner, 成败) 重建后验均值与成员点视角，重放 Hedge。
    // 奖励口径（类头）：行动成员/同赢家成员 = 已实现 0/1；异见 = 决策时均值；
    // 弃标视角 = 0。成员选择序列取自遥测 selections 的逐轮差分。
    const stream = STREAM_T;
    const rounds = 60;
    const brain = new BayesianHireBrain({
      taskValue: stream.taskValue,
      priorWeight: stream.priorWeight,
      ucbExploration: stream.ucbExploration,
      policy: 'portfolio',
      seed: 42,
      hedgeEta: ETA,
    });
    for (const a of stream.agents) brain.registerAgent(a);

    const K = 3;
    const members: HedgeMember[] = ['greedy', 'thompson', 'ucb1'];
    // 后验均值镜像：succ/fail 伪计数（forgetting=1）
    const succ = new Map<string, number>(stream.agents.map((a) => [a.id, 0]));
    const fail = new Map<string, number>(stream.agents.map((a) => [a.id, 0]));
    let weights = members.map(() => 1 / K);
    let banditRounds = 0;
    const prevSelections = [0, 0, 0];

    for (let r = 0; r < rounds; r++) {
      const asg = brain.submitTask('X');
      const selAfter = brain.getState().portfolio!.selections;
      const selected = selAfter.findIndex((s, k) => s > prevSelections[k]!);
      prevSelections.forEach((s, k) => (prevSelections[k] = selAfter[k]!));
      assert.ok(selected >= 0, `第 ${r} 轮应恰有一名成员被选中`);
      if (asg === null) continue; // 弃标：无结算无更新（选择流已消耗）

      // 决策时均值（结算前）与成员点视角
      const meanAt = (id: string): number => {
        const a0 = stream.agents.find((a) => a.id === id)!.credentialQuality!.X! * 3;
        return (a0 + succ.get(id)!) / (3 + succ.get(id)! + fail.get(id)!);
      };
      const viewOf = (member: HedgeMember): { winner: string | null; mean: number } => {
        let winner: string | null = null;
        let bestScore = -Infinity;
        let bestMean = 0;
        for (const a of stream.agents) {
          const mean = meanAt(a.id);
          const ab = 3 + succ.get(a.id)! + fail.get(a.id)!;
          const q =
            member === 'ucb1'
              ? mean + stream.ucbExploration * Math.sqrt((2 * Math.log(banditRounds + 1)) / ab)
              : mean;
          const score = stream.taskValue * q - a.trueCost; // bid = trueCost
          if (score > bestScore) {
            winner = a.id;
            bestScore = score;
            bestMean = mean;
          }
        }
        return bestScore < 0 ? { winner: null, mean: 0 } : { winner, mean: bestMean };
      };
      const views = members.map((m) => viewOf(m));
      views[selected] = { winner: asg.winnerId!, mean: meanAt(asg.winnerId!) };

      const ok = stream.settles(asg.winnerId!, r);
      assert.equal(brain.settleTask(asg.taskId, ok), true);
      // 重放 Hedge：r̂ → w·e^{η·r̂} → 归一
      let sum = 0;
      const next = weights.map((w, k) => {
        const v = views[k]!;
        const realized = k === selected || v.winner === asg.winnerId;
        const rHat = realized ? (ok ? 1 : 0) : v.winner === null ? 0 : v.mean;
        const nw = w * Math.exp(ETA * rHat);
        sum += nw;
        return nw;
      });
      weights = next.map((w) => w / sum);
      // 后验镜像推进
      const s = succ.get(asg.winnerId!)!;
      succ.set(asg.winnerId!, s + (ok ? 1 : 0));
      fail.set(asg.winnerId!, fail.get(asg.winnerId!)! + (ok ? 0 : 1));
      banditRounds++;

      const got = brain.getState().portfolio!.weights;
      for (let k = 0; k < K; k++) {
        assert.ok(
          Math.abs(got[k]! - weights[k]!) < 1e-12,
          `第 ${r + 1} 轮权重[${k}]：实现 ${got[k]} vs 复算 ${weights[k]}`,
        );
      }
      assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-12, '权重归一不变式');
    }
  });

  it('弃标轮口径：选择流已消耗（selections 计账）但无结算故无 Hedge 更新', () => {
    // 唯一 agent 报价远超任务价值 → 任何成员的点视角都弃标 → null
    const brain = new BayesianHireBrain({
      policy: 'portfolio',
      taskValue: 1,
      seed: 42,
    });
    brain.registerAgent({ ...spec('dear', 1, 0.9), bid: 1e9 });
    for (let i = 0; i < 5; i++) {
      assert.equal(brain.submitTask('X'), null, '全员估值不抵报价 → 免费处置');
    }
    const tel = brain.getState().portfolio!;
    assert.equal(
      tel.selections.reduce((a, b) => a + b, 0),
      5,
      '每次有 admitted 候选的决策恰消耗一次选择流（弃标亦计账）',
    );
    assert.equal(tel.hedgeRounds, 0, '无结算 → 无奖励 → 无权重更新');
    assert.deepEqual([...tel.weights], [1 / 3, 1 / 3, 1 / 3], '权重保持均匀初值');
    assert.equal(brain.getState().netWelfare, 0);
  });

  it('thompson 成员流纪律：未入选成员集时 draws 恒 0；单 agent 时 draws = 其选中轮数', () => {
    // 无 thompson 成员：流永不消耗
    const noThompson = new BayesianHireBrain({
      policy: 'portfolio',
      portfolioMembers: ['greedy', 'ucb1'],
      seed: 42,
    });
    noThompson.registerAgent(spec('a', 1, 0.7));
    noThompson.registerAgent(spec('b', 1, 0.5));
    for (let i = 0; i < 10; i++) {
      const asg = noThompson.submitTask('X')!;
      noThompson.settleTask(asg.taskId, true);
    }
    assert.equal(noThompson.getState().portfolio!.thompsonDraws, 0);

    // 单 agent：admitted 恰 1 → thompson 每被选中一轮恰抽 1 次
    const withThompson = new BayesianHireBrain({
      policy: 'portfolio',
      portfolioMembers: ['greedy', 'thompson'],
      seed: 7,
    });
    withThompson.registerAgent(spec('solo', 1, 0.6));
    for (let i = 0; i < 12; i++) {
      const asg = withThompson.submitTask('X')!;
      withThompson.settleTask(asg.taskId, i % 2 === 0);
    }
    const tel = withThompson.getState().portfolio!;
    assert.equal(tel.members.length, 2);
    const thompsonSel = tel.selections[tel.members.indexOf('thompson')]!;
    assert.ok(thompsonSel > 0, '该 seed 下 thompson 应至少被选中一次（计数才有意义）');
    assert.equal(
      tel.thompsonDraws,
      thompsonSel,
      `单 agent：draws(${tel.thompsonDraws}) = thompson 选中轮数(${thompsonSel})`,
    );
  });

  it('K=1 退化：portfolio 单成员 greedy 与单策略 greedy 在同流上福利逐位相同', () => {
    const rounds = 50;
    const single = runSingle(STREAM_G, 'greedy', rounds, 42);
    const brain = new BayesianHireBrain({
      taskValue: STREAM_G.taskValue,
      priorWeight: STREAM_G.priorWeight,
      ucbExploration: STREAM_G.ucbExploration,
      policy: 'portfolio',
      portfolioMembers: ['greedy'],
      seed: 42,
      hedgeEta: ETA,
    });
    for (const a of STREAM_G.agents) brain.registerAgent(a);
    for (let r = 0; r < rounds; r++) {
      const asg = brain.submitTask('X')!;
      brain.settleTask(asg.taskId, STREAM_G.settles(asg.winnerId!, r));
    }
    assert.equal(brain.getState().netWelfare, single);
    const tel = brain.getState().portfolio!;
    assert.deepEqual([...tel.weights], [1]);
    assert.equal(tel.selections[0], rounds);
  });

  it('选择流与 thompson 成员流独立：portfolio 单成员 ≠ 单策略 thompson（同 seed）', () => {
    const rounds = 25;
    const seqOf = (policy: 'portfolio' | 'thompson'): string[] => {
      const brain = new BayesianHireBrain({
        policy,
        ...(policy === 'portfolio' ? { portfolioMembers: ['thompson'] } : {}),
        seed: 42,
        hedgeEta: ETA,
      });
      brain.registerAgent(spec('a', 1, 0.7));
      brain.registerAgent(spec('b', 1.2, 0.6));
      const out: string[] = [];
      for (let i = 0; i < rounds; i++) {
        const asg = brain.submitTask('X')!;
        out.push(`${asg.winnerId}:${asg.payment.toPrecision(12)}`);
        brain.settleTask(asg.taskId, i % 3 !== 0);
      }
      return out;
    };
    const portfolioRun = seqOf('portfolio');
    const singleRun = seqOf('thompson');
    assert.ok(
      JSON.stringify(portfolioRun) !== JSON.stringify(singleRun),
      '派生 thompson 流（盐 THMP）与直接 Mulberry32(seed) 必须是不同流',
    );
  });

  it('确定性：同 seed 重跑逐位一致（分配序列 + 遥测），异 seed 序列有别', () => {
    const first = runPortfolio(STREAM_T, 120, 42, ETA);
    const second = runPortfolio(STREAM_T, 120, 42, ETA);
    assert.deepEqual(second.trace, first.trace, '分配/结算序列逐位可复现');
    assert.deepEqual(second.telemetry, first.telemetry, 'Hedge 遥测逐位可复现');
    assert.equal(second.welfare, first.welfare);
    const other = runPortfolio(STREAM_T, 120, 4242, ETA);
    assert.ok(
      JSON.stringify(other.trace) !== JSON.stringify(first.trace),
      '不同 seed 应产生不同序列（流的区分度）',
    );
    assert.equal(first.telemetry.hedgeRounds, first.settled, 'T = Hedge 更新轮数 = 结算数');
    const sumSel = first.telemetry.selections.reduce((a, b) => a + b, 0);
    assert.equal(sumSel, 120, '每轮恰有一名成员被选中（selections 计数守恒）');
  });
});

// ----------------------------------------------------------------------------
// 负对照（走私审判）
// ----------------------------------------------------------------------------

describe('R17-D · 负对照（η 域 / 成员集走私）', () => {
  it('hedgeEta 非法（0 / 负 / NaN / >1）指名拒绝；∈(0,1] 合法', () => {
    for (const bad of [0, -0.1, Number.NaN, 1.5]) {
      assert.throws(
        () => new BayesianHireBrain({ policy: 'portfolio', hedgeEta: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('hedgeEta'),
        `hedgeEta=${String(bad)} 应被拒绝`,
      );
    }
    new BayesianHireBrain({ policy: 'portfolio', hedgeEta: 0.5 }); // 端点内合法
    new BayesianHireBrain({ policy: 'portfolio', hedgeEta: 1 }); // η=1 含端点
  });

  it('portfolioMembers 空集指名拒绝', () => {
    assert.throws(
      () => new BayesianHireBrain({ policy: 'portfolio', portfolioMembers: [] }),
      (e: unknown) =>
        e instanceof ConfigurationError && e.message.includes('must be a non-empty array'),
    );
  });

  it('portfolioMembers 重复成员指名拒绝（重复会双倍其 Hedge 权重）', () => {
    assert.throws(
      () =>
        new BayesianHireBrain({
          policy: 'portfolio',
          portfolioMembers: ['greedy', 'thompson', 'greedy'],
        }),
      (e: unknown) =>
        e instanceof ConfigurationError && e.message.includes("repeat member 'greedy'"),
    );
  });

  it('portfolioMembers 未知/嵌套成员名指名拒绝（greedy/thompson/ucb1 之外）', () => {
    for (const bad of ['portfolio', 'epsilon-greedy', 'exp3'] as never[]) {
      assert.throws(
        () =>
          new BayesianHireBrain({
            policy: 'portfolio',
            portfolioMembers: ['greedy', bad],
          }),
        (e: unknown) =>
          e instanceof ConfigurationError &&
          e.message.includes('entries must be one of: greedy, thompson, ucb1'),
        `成员 '${String(bad)}' 应被拒绝`,
      );
    }
  });

  it('非 portfolio 策略下非法成员集同样拒绝（配置域校验不随策略休眠）', () => {
    assert.throws(
      () => new BayesianHireBrain({ policy: 'greedy', portfolioMembers: [] }),
      (e: unknown) =>
        e instanceof ConfigurationError && e.message.includes('must be a non-empty array'),
    );
    assert.equal(DEFAULT_BAYESIAN_HIRE_CONFIG.hedgeEta, 0.1, '缺省 η = 0.1');
    assert.deepEqual(DEFAULT_BAYESIAN_HIRE_CONFIG.portfolioMembers, ['greedy', 'thompson', 'ucb1']);
  });
});
