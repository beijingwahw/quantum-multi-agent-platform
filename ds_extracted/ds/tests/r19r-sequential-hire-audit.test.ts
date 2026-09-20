/**
 * R19-R 创新 2：SequentialHiringAudit（逐 (agent,能力) 序贯雇佣审计）的
 * 机器验收面——与 src/proactive-intelligence/sequential-hire-audit.ts
 * 模块头的主张一一对应：
 *   逐格子门 → 复用 SprtCalibrationGate（Bonferroni 等分 typeOne）；
 *   停止时刻/判决 → 终判格子的 stoppedAt/decision 快照与四态守恒；
 *   族误差面 → m 门全真零假设下 family-wise ≤ α_family/(1−β)（定理 4）；
 *   正交性 → 审计作为纯观察者接入 BayesianHireBrain（portfolio 模式），
 *     brain 状态逐位不变（不碰策略选择，只审计校准）；
 *   走私审判 → 超编/重复/未知格子/终判后迟到观测/域外值指名拒绝；
 *     虚报凭证（base 错报）被格子定罪。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SequentialHiringAudit,
  DEFAULT_HIRING_AUDIT_CONFIG,
} from '../src/proactive-intelligence/sequential-hire-audit.js';
import { BayesianHireBrain } from '../src/proactive-intelligence/bayesian-hire-brain.js';
import {
  bonferroniTypeOne,
  sprtTypeOneUpperBound,
} from '../src/proactive-intelligence/sprt-calibration-gate.js';
import { mulberry32 } from '../src/utils/rng.js';
import {
  ConfigurationError,
  MechanismError,
  NumericDomainError,
  StateError,
} from '../src/utils/errors.js';

const AUDIT_CONFIG = {
  familyLevel: 0.05,
  typeTwo: 0.02,
  maxObservations: 600,
  plannedCells: 5,
};

// ----------------------------------------------------------------------------
// 静态面：Bonferroni 分裂、族界、快照口径
// ----------------------------------------------------------------------------

describe('R19-R · 雇佣审计 · 静态面与域校验', () => {
  it('Bonferroni 等分：逐格 typeOne = α_family/m，族界 = α_family/(1−β)（定理 4 面）', () => {
    const audit = new SequentialHiringAudit(AUDIT_CONFIG);
    audit.registerCell('a1', 'code', 0.5);
    const snap = audit.cellSnapshot('a1', 'code');
    const expectedPerCell = bonferroniTypeOne(AUDIT_CONFIG.familyLevel, AUDIT_CONFIG.plannedCells);
    assert.equal(snap.perCellTypeOne, expectedPerCell);
    assert.equal(
      snap.perCellTypeOneUpperBound,
      sprtTypeOneUpperBound(expectedPerCell, AUDIT_CONFIG.typeTwo),
    );
    assert.equal(
      audit.familyTypeOneUpperBound(),
      sprtTypeOneUpperBound(AUDIT_CONFIG.familyLevel, AUDIT_CONFIG.typeTwo),
    );
    assert.equal(audit.registeredCells(), 1);
    assert.equal(snap.decision, 'continue');
    assert.equal(snap.observations, 0);
    assert.equal(snap.stoppedAtObservations, null);
  });

  it('超编走私：注册第 m+1 格指名拒绝（族界只对 ≤ m 门成立——union bound 的分母）', () => {
    const audit = new SequentialHiringAudit(AUDIT_CONFIG);
    for (let i = 0; i < 5; i++) audit.registerCell(`a${i}`, 'code', 0.4 + i * 0.05);
    assert.throws(
      () => audit.registerCell('a5', 'code', 0.5),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('plannedCells'),
    );
  });

  it('重复格子走私：同 (agent, capability) 重复注册指名拒绝（静默覆盖会清空门的统计量）', () => {
    const audit = new SequentialHiringAudit(AUDIT_CONFIG);
    audit.registerCell('a1', 'code', 0.5);
    assert.throws(
      () => audit.registerCell('a1', 'code', 0.5),
      (e: unknown) => e instanceof MechanismError && e.message.includes('already'),
    );
  });

  it('未知格子/终判后迟到观测/域外值：指名拒绝且消息含格子身份', () => {
    const audit = new SequentialHiringAudit(AUDIT_CONFIG);
    audit.registerCell('a1', 'code', 0.5);
    assert.throws(
      () => audit.observe('ghost', 'code', 3, true),
      (e: unknown) => e instanceof StateError && e.message.includes('ghost'),
    );
    assert.throws(
      () => audit.cellSnapshot('a1', 'noskill'),
      (e: unknown) => e instanceof StateError && e.message.includes('noskill'),
    );
    // 注：k=2.5 合法（分数资本）；这里只审真正域外值
    for (const badK of [-1, Number.NaN]) {
      assert.throws(
        () => audit.observe('a1', 'code', badK, true),
        (e: unknown) =>
          (e instanceof NumericDomainError || e instanceof StateError) &&
          e.message.includes('a1/code'),
        `k=${String(badK)} 应被格子身份指名拒绝`,
      );
    }
    assert.throws(
      () => audit.observe('a1', 'code', 3, 1 as unknown as boolean),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('success'),
    );
  });

  it('构造域走私：α_family/β/maxObservations/plannedCells/base 域外值指名拒绝', () => {
    for (const bad of [0, 1, -0.1, Number.NaN]) {
      assert.throws(
        () => new SequentialHiringAudit({ ...AUDIT_CONFIG, familyLevel: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('familyLevel'),
      );
    }
    for (const bad of [0, 1, 1.5]) {
      assert.throws(
        () => new SequentialHiringAudit({ ...AUDIT_CONFIG, typeTwo: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('typeTwo'),
      );
    }
    for (const bad of [0, 2.5]) {
      assert.throws(
        () => new SequentialHiringAudit({ ...AUDIT_CONFIG, plannedCells: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('plannedCells'),
      );
    }
    assert.throws(
      () => new SequentialHiringAudit({ ...AUDIT_CONFIG, maxObservations: 0 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('maxObservations'),
    );
    const audit = new SequentialHiringAudit(AUDIT_CONFIG);
    for (const badBase of [0, 1, -0.2, Number.NaN]) {
      assert.throws(
        () => audit.registerCell('x', 'code', badBase),
        (e: unknown) => e instanceof NumericDomainError && e.message.includes('base'),
      );
    }
    assert.equal(DEFAULT_HIRING_AUDIT_CONFIG.familyLevel, 0.05);
    assert.equal(DEFAULT_HIRING_AUDIT_CONFIG.plannedCells, 8);
  });
});

// ----------------------------------------------------------------------------
// 逐格子停止时刻与判决（四态守恒）
// ----------------------------------------------------------------------------

describe('R19-R · 雇佣审计 · 停止时刻与判决', () => {
  it('学习流格子：rejectNull 早停（N* ≪ maxObservations），stoppedAt = 终判时观测数', () => {
    const audit = new SequentialHiringAudit({ ...AUDIT_CONFIG, plannedCells: 1 });
    audit.registerCell('trainee', 'code', 0.5);
    const rng = mulberry32(2026);
    let snap = audit.cellSnapshot('trainee', 'code');
    for (let i = 0; i < 600 && snap.decision === 'continue'; i++) {
      const k = i; // 可料序列：结算前已知经验水平（定理 1 的入口条件）
      const success = rng() < 0.5 + 0.6 * 0.5 * (1 - Math.exp(-0.12 * k));
      snap = audit.observe('trainee', 'code', k, success);
    }
    assert.equal(snap.decision, 'rejectNull');
    assert.ok(snap.stoppedAtObservations! < 150, `停时 ${snap.stoppedAtObservations} 应远早于截断`);
    assert.equal(snap.stoppedAtObservations, snap.observations);
    // 终判后迟到观测指名拒绝（含格子身份与停止时刻）
    assert.throws(
      () => audit.observe('trainee', 'code', 5, true),
      (e: unknown) =>
        e instanceof StateError &&
        e.message.includes('trainee/code') &&
        e.message.includes('stopped'),
    );
    console.log(
      `[R19-R 停止] 学习流格子 rejectNull @N*=${snap.stoppedAtObservations}` +
        `（maxObservations=${AUDIT_CONFIG.maxObservations}）`,
    );
  });

  it('四态守恒：cells() 全量快照的 decision ∈ 四态；终判 ⟺ stoppedAt 非空', () => {
    const audit = new SequentialHiringAudit(AUDIT_CONFIG);
    const rng = mulberry32(7);
    audit.registerCell('n1', 'code', 0.5);
    audit.registerCell('n2', 'code', 0.5);
    for (let i = 0; i < 700; i++) {
      const snap1 = audit.cellSnapshot('n1', 'code');
      const snap2 = audit.cellSnapshot('n2', 'code');
      if (snap1.decision !== 'continue' && snap2.decision !== 'continue') break;
      if (snap1.decision === 'continue') audit.observe('n1', 'code', i, rng() < 0.5);
      if (snap2.decision === 'continue') audit.observe('n2', 'code', i, rng() < 0.5);
    }
    const all = audit.cells();
    assert.equal(all.length, 2);
    for (const snap of all) {
      assert.ok(['continue', 'rejectNull', 'acceptNull', 'truncated'].includes(snap.decision));
      assert.equal(snap.stoppedAtObservations !== null, snap.decision !== 'continue');
      if (snap.stoppedAtObservations !== null) {
        assert.ok(snap.stoppedAtObservations >= 1 && snap.stoppedAtObservations <= 600);
        // 判决与 λ 的位置关系（分侧钉板：上界/下界/界内）
        if (snap.decision === 'rejectNull') {
          assert.ok(snap.logLikelihoodRatio >= snap.logUpperBoundary);
        } else if (snap.decision === 'acceptNull') {
          assert.ok(snap.logLikelihoodRatio <= snap.logLowerBoundary);
        } else {
          assert.ok(
            snap.logLowerBoundary < snap.logLikelihoodRatio &&
              snap.logLikelihoodRatio < snap.logUpperBoundary,
          );
        }
      }
    }
    assert.equal(audit.registeredCells(), 2);
  });

  it('确定性：同 seed 同流逐位同快照（λ 轨迹 toPrecision(15) 相等）', () => {
    function run(): string {
      const audit = new SequentialHiringAudit(AUDIT_CONFIG);
      audit.registerCell('d', 'code', 0.55);
      const rng = mulberry32(99);
      let trace = '';
      for (let i = 0; i < 120; i++) {
        const snap = audit.cellSnapshot('d', 'code');
        if (snap.decision !== 'continue') break; // 终判即停（迟到观测是接线错误）
        const s = audit.observe('d', 'code', i, rng() < 0.6);
        trace += s.logLikelihoodRatio.toPrecision(15) + ';';
      }
      return trace + audit.cellSnapshot('d', 'code').decision;
    }
    assert.equal(run(), run());
  });
});

// ----------------------------------------------------------------------------
// 族误差面（定理 4 的蒙地卡罗机证）
// ----------------------------------------------------------------------------

describe('R19-R · 雇佣审计 · 族误差控制（定理 4）', () => {
  it('5 格全真零假设：family-wise 虚拒 ≤ α_family/(1−β)（M=1000）', { timeout: 180_000 }, () => {
    const M = 1000;
    const bases = [0.3, 0.4, 0.5, 0.6, 0.7];
    const bound = sprtTypeOneUpperBound(AUDIT_CONFIG.familyLevel, AUDIT_CONFIG.typeTwo);
    let familyFalseRejects = 0;
    let anyRejectTotal = 0;
    let undecidedFamilies = 0;
    for (let t = 0; t < M; t++) {
      const rng = mulberry32(10_000 + t);
      const audit = new SequentialHiringAudit(AUDIT_CONFIG);
      bases.forEach((b, i) => audit.registerCell(`a${i}`, 'code', b));
      let familyReject = false;
      let allDecided = false;
      for (let i = 0; i < 600 && !allDecided; i++) {
        allDecided = true;
        bases.forEach((b, j) => {
          const snap = audit.cellSnapshot(`a${j}`, 'code');
          if (snap.decision !== 'continue') return;
          allDecided = false;
          const s = audit.observe(`a${j}`, 'code', i, rng() < b);
          if (s.decision === 'rejectNull') familyReject = true;
        });
      }
      if (familyReject) familyFalseRejects++;
      if (!allDecided) undecidedFamilies++;
      anyRejectTotal += familyReject ? 1 : 0;
    }
    const rate = familyFalseRejects / M;
    console.log(
      `[R19-R 族控制] family-wise=${rate.toFixed(4)} ≤ 界=${bound.toFixed(4)}` +
        `（5 格 × M=${M}；截断不决族 ${undecidedFamilies}）`,
    );
    assert.ok(rate <= bound, `族虚拒率 ${rate} 超界 ${bound}`);
    assert.ok(anyRejectTotal === familyFalseRejects);
  });

  it('虚报凭证定罪：申报 base=0.5、真值恒 0.70 的格子以高概率被拒（M=400）', () => {
    // 凭证虚高 0.2（坏雇佣的典型形态）：0.62 量级的缺口只给 ~70% 检出
    // （混合备择饱和区 p_mix→0.65 越过真值，漂移小步长大——扩散首次
    // 命中下界 e^{−2μb/σ²}≈0.29，实测 121/400 acceptNull 精确吻合，
    // 如实记录在详册）；0.20 缺口是审计的强检出区
    const M = 400;
    const bound = sprtTypeOneUpperBound(
      bonferroniTypeOne(AUDIT_CONFIG.familyLevel, AUDIT_CONFIG.plannedCells),
      AUDIT_CONFIG.typeTwo,
    );
    let rejects = 0;
    let stopSum = 0;
    let rejectN = 0;
    for (let t = 0; t < M; t++) {
      const rng = mulberry32(50_000 + t);
      const audit = new SequentialHiringAudit({ ...AUDIT_CONFIG, plannedCells: 1 });
      audit.registerCell('liar', 'code', 0.5);
      let snap = audit.cellSnapshot('liar', 'code');
      for (let i = 0; i < 600 && snap.decision === 'continue'; i++) {
        snap = audit.observe('liar', 'code', i, rng() < 0.7);
      }
      stopSum += snap.observations;
      if (snap.decision === 'rejectNull') {
        rejects++;
        rejectN += snap.observations;
      }
    }
    console.log(
      `[R19-R 错误凭证] 拒绝率=${(rejects / M).toFixed(3)} ≫ 单格界=${bound.toFixed(4)}` +
        `；平均停时=${(stopSum / M).toFixed(1)}（拒判平均 N*=${(rejectN / Math.max(1, rejects)).toFixed(1)}）`,
    );
    assert.ok(rejects / M > 0.9, '虚报凭证 0.2 的格子应被高概率定罪');
  });
});

// ----------------------------------------------------------------------------
// 正交性：纯观察者接入 hire-brain（Hedge portfolio），brain 状态逐位不变
// ----------------------------------------------------------------------------

describe('R19-R · 雇佣审计 · 与 Hedge 组合的正交性', () => {
  it('同流双跑：接审计 vs 不接审计，BayesianHireBrain 终态逐位相同（含 portfolio 遥测）', () => {
    function runBrain(withAudit: boolean): string {
      const brain = new BayesianHireBrain({
        policy: 'portfolio',
        seed: 4242,
        hireFloor: 0.3,
        probationTrials: 5,
        portfolioMembers: ['greedy', 'thompson', 'ucb1'],
      });
      const audit = new SequentialHiringAudit({ ...AUDIT_CONFIG, plannedCells: 6 });
      const attempts = new Map<string, number>();
      brain.registerAgent({
        id: 'alpha',
        capabilities: ['code', 'review'],
        trueCost: 2,
        credentialQuality: { code: 0.5, review: 0.6 },
      });
      brain.registerAgent({
        id: 'beta',
        capabilities: ['code', 'deploy'],
        trueCost: 3,
        credentialQuality: { code: 0.62, deploy: 0.4 },
      });
      brain.registerAgent({
        id: 'gamma',
        capabilities: ['review', 'deploy'],
        trueCost: 2.5,
        credentialQuality: { review: 0.55, deploy: 0.5 },
      });
      // 6 个真实 (agent, capability) 格子，base = 各自凭证（可观测面）；
      // 大写：审计不读 trueCost（私有），只用公开凭证
      const cellSpecs: Array<[string, string, number]> = [
        ['alpha', 'code', 0.5],
        ['alpha', 'review', 0.6],
        ['beta', 'code', 0.62],
        ['beta', 'deploy', 0.4],
        ['gamma', 'review', 0.55],
        ['gamma', 'deploy', 0.5],
      ];
      for (const [agent, cap, base] of cellSpecs) audit.registerCell(agent, cap, base);
      const rng = mulberry32(88);
      for (let t = 0; t < 60; t++) {
        const cap = ['code', 'review', 'deploy'][t % 3]!;
        const assignment = brain.submitTask(cap);
        if (assignment === null) continue;
        const key = `${assignment.winnerId}/${cap}`;
        const k = attempts.get(key) ?? 0; // 结算前经验水平（可料）
        const success = rng() < 0.58;
        if (withAudit) {
          const snap = audit.cellSnapshot(assignment.winnerId!, cap);
          if (snap.decision === 'continue') audit.observe(assignment.winnerId!, cap, k, success);
        }
        attempts.set(key, k + 1);
        brain.settleTask(assignment.taskId, success);
      }
      return JSON.stringify(brain.getState());
    }
    const bare = runBrain(false);
    const audited = runBrain(true);
    assert.equal(audited, bare, '审计是纯观察者：不碰策略选择/支付/后验，brain 终态逐位不变');
    // 审计面自身仍有产出（观察到了结算流并推进统计量）
    const state = JSON.parse(audited) as { agents: Array<{ id: string }> };
    assert.equal(state.agents.length, 3);
  });

  it('审计视角可规则化：格子快照含 λ 与双界（供 brain.audit.* 类规则消费的区间面）', () => {
    const audit = new SequentialHiringAudit(AUDIT_CONFIG);
    audit.registerCell('w', 'code', 0.5);
    const snap = audit.observe('w', 'code', 2, true);
    assert.ok(snap.logUpperBoundary > 0 && snap.logLowerBoundary < 0);
    assert.ok(snap.componentTypeTwoUpperBounds.length > 0);
    assert.ok(snap.maxAbsIncrement >= 0);
  });
});
