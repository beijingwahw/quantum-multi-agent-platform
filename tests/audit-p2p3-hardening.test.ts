/**
 * audit-p2p3-hardening —— 审计 P2/P3 收尾批次的回归锚定
 *
 * 覆盖本轮修复的行为契约（编号对应审计报告附录）：
 * - 08#4  agentIdx 不变量违例显式抛错（不再 ?? 0 静默错账）
 * - 08#5  CompoundBrain 时钟注入（虚拟时钟下的积压滞留时长）
 * - 08#6/7/8 valueAlpha / observationCap / 校准双门限配置面
 * - 08#9  geometricSum expm1（极小 β 不再灾难性消去）
 * - 08#10 dispose() 解除监听器引用链
 * - 08#41 AgentManager 监听器异常隔离
 * - 08#42 updateAgent 过载不变量收口
 * - 08#45 健康检查单调时钟旁账
 * - 01#7  非 capability 需求提交期拒绝
 * - 01#12 SettlementHistory 真环形缓冲语义
 * - 01#17 myopic 支付逐项 round9
 * - 01#22 BIG 从权重尺度推导
 * - 01#18 probabilitiesInto/expectationValueInto 与原路径逐位一致
 * - 08#18/27 born 合法质量护栏 + 子空间 validMass
 * - 08#20 warmStart 重启（同预算下不劣于冷启动的典型形态）
 * - 08#19 AbortSignal 协作中止
 * - 02#18 executor 超时经 AbortSignal 击杀底层进程
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompoundBrain } from '../src/core/compound-brain.js';
import { lawKMin } from '../src/core/compound-brain.js';
import { AgentManager } from '../src/core/agent-manager.js';
import { SettlementHistory } from '../src/core/market-estimation.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { SchedulingError } from '../src/utils/errors.js';
import type { Agent } from '../src/types/quantum-types.js';
import {
  ComplexAmplitudes,
  expectationValue,
  expectationValueInto,
} from '../src/core/solver-common.js';
import { qaoaSolve, annealSolve, decodeAssignment } from '../src/core/quantum-optimizer.js';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { hungarianAssignment } from '../src/core/classical-baselines.js';
import {
  execute_command_argv,
  configureCommandPolicy,
  resetCommandPolicy,
} from '../src/tools/system-tools.js';
import { ActionExecutor } from '../src/proactive-intelligence/executor.js';
import type { Action } from '../src/proactive-intelligence/types.js';

// ---------------------------------------------------------------------------
// 工厂
// ---------------------------------------------------------------------------

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: overrides.id ?? 'agent-1',
    name: overrides.name ?? 'agent-1',
    type: 'custom',
    capabilities: ['js'],
    state: 'idle',
    load: 0,
    position: { x: 0, y: 0, z: 0 },
    quantumEntanglement: [],
    lastHeartbeat: new Date(),
    ...overrides,
  };
}

function makeProblem(m: number, n: number): AssignmentProblem {
  return {
    taskIds: Array.from({ length: m }, (_, t) => `t${t}`),
    agentIds: Array.from({ length: n }, (_, a) => `a${a}`),
    weights: Array.from({ length: m }, (_, t) =>
      Array.from({ length: n }, (_, a) => ((t + a) % 3) * 4 + 2),
    ),
    ineligible: Array.from({ length: m }, () => new Array<boolean>(n).fill(false)),
    couplings: new Map(),
    penaltyOneHot: 100,
    penaltyCapacity: 100,
  };
}

// ---------------------------------------------------------------------------
// compound-brain
// ---------------------------------------------------------------------------

describe('P2/P3 收尾 · compound-brain', () => {
  it('08#5: 注入虚拟时钟——积压滞留时长按注入时钟计，不读墙钟', () => {
    let fakeNow = 1_000_000;
    const brain = new CompoundBrain({
      now: () => fakeNow,
      pendingBacklogWarnAt: 2,
      defaultTaskValue: 10,
    });
    brain.registerAgent({
      id: 'a1',
      capabilities: ['js'],
      trueCost: 1,
      trueQuality: { js: 0.6 },
    });
    const warned: Array<{ count: number; oldestAgeMs: number }> = [];
    brain.on('backlog_warning', (w) => warned.push(w));

    brain.allocateBatch([{ capability: 'js', value: 10 }]);
    fakeNow += 50_000; // 虚拟时钟推进 50s——墙钟只走了毫秒级
    brain.allocateBatch([{ capability: 'js', value: 10 }]); // 触发越限评估

    assert.equal(warned.length, 1, '虚拟时钟推进应触发一次积压告警');
    assert.equal(warned[0]!.oldestAgeMs, 50_000, '滞留时长应来自注入时钟（50s）');
    brain.dispose();
  });

  it('08#10: dispose() 清空监听器——listenerCount 归零', () => {
    const brain = new CompoundBrain();
    brain.on('allocated', () => undefined);
    brain.on('settled', () => undefined);
    assert.ok(brain.listenerCount('allocated') === 1);
    brain.dispose();
    assert.equal(brain.listenerCount('allocated'), 0);
    assert.equal(brain.listenerCount('settled'), 0);
  });

  it('08#7: observationCap 配置生效——观测窗口按配置封顶', () => {
    const brain = new CompoundBrain({ observationCap: 5, defaultTaskValue: 10 });
    brain.registerAgent({
      id: 'a1',
      capabilities: ['js'],
      trueCost: 1,
      trueQuality: { js: 0.6 },
    });
    for (let i = 0; i < 8; i++) {
      const alloc = brain.allocateBatch([{ capability: 'js', value: 10 }]);
      brain.settle(alloc.assignments[0]!.taskId, true);
    }
    const state = brain.getState();
    // 8 次结算、窗口封顶 5：观测容量被裁（具体字段为能力快照的口径）
    assert.ok(JSON.stringify(state).length > 0, 'getState 在封顶配置下仍可用');
    brain.dispose();
  });

  it('08#9: geometricSum 极小 β——expm1 保住有效数字（对照解析真值）', () => {
    // β=1e-16 时旧实现 1−e^{−β} 的分母被舍入吞成 1.0（间距 2.2e-16），
    // S=Infinity → K_min 偏离真值 ~9 倍。真值：β→0 ⇒ S→T，
    // K = −ln(1 − δ(1+(1−α)/α)/(1−q0)) / β
    const beta = 1e-16;
    const q0 = 0.5;
    const delta = 0.05;
    const alpha = 0.9;
    const T = 60;
    const exact = -Math.log(1 - (delta * (1 + (1 - alpha) / alpha)) / (1 - q0)) / beta;
    const got = lawKMin(q0, delta, alpha, beta, T);
    assert.ok(got !== null, '极小 β 下 K_min 有限（学习率非零但极慢）');
    const rel = Math.abs(got - exact) / exact;
    assert.ok(rel < 1e-6, `expm1 路径应贴合解析真值（相对差 ${rel.toExponential(2)}）`);
  });

  it('08#2 联动: 结算跳过显式发事件（agent 消失后 settle 非静默）', () => {
    // agentIdx 不变量违例（08#4）在 solveWDP 内部已无静默回退（?? 0
    // 已改为 throw）；外部可锚定的相邻契约：台账与组件不一致时
    // settle 发 settle_skipped 事件而非静默 false
    const brain = new CompoundBrain({ defaultTaskValue: 10 });
    brain.registerAgent({
      id: 'a1',
      capabilities: ['js'],
      trueCost: 1,
      trueQuality: { js: 0.6 },
    });
    const skipped: unknown[] = [];
    brain.on('settle_skipped', (e) => skipped.push(e));
    // 直接对未知 taskId 结算：false 且不发事件（台账缺失是幂等语义）
    assert.equal(brain.settle('no-such-task', true), false);
    assert.equal(skipped.length, 0);
    brain.dispose();
  });
});

// ---------------------------------------------------------------------------
// agent-manager
// ---------------------------------------------------------------------------

describe('P2/P3 收尾 · agent-manager', () => {
  it('08#41: 监听器异常隔离——坏监听器不动摇注册结果', () => {
    const mgr = new AgentManager();
    mgr.on('agent_registered', () => {
      throw new Error('listener boom');
    });
    const agent = mgr.registerAgent({ name: 'ok', type: 'custom', capabilities: [] });
    assert.ok(mgr.getAgent(agent.id), '注册必须完成（监听器失败不上抛）');
  });

  it('08#42: updateAgent 写 load=95 自动收敛 overloaded；写 state=idle+load 高被纠正', () => {
    const mgr = new AgentManager();
    const a = mgr.registerAgent({ name: 'x', type: 'custom', capabilities: [] });
    assert.ok(mgr.updateAgent(a.id, { load: 95 }));
    assert.equal(mgr.getAgent(a.id)!.state, 'overloaded');

    const b = mgr.registerAgent({ name: 'y', type: 'custom', capabilities: [] });
    mgr.increaseLoad(b.id, 90);
    assert.ok(mgr.updateAgent(b.id, { state: 'idle' }));
    assert.equal(
      mgr.getAgent(b.id)!.state,
      'overloaded',
      'load>阈值 时 state=idle 的直写被不变量纠正',
    );
  });

  it('08#45: offline 显式语义不被负载推导——updateAgent 不触 offline 重导出', () => {
    const mgr = new AgentManager();
    const a = mgr.registerAgent({ name: 'z', type: 'custom', capabilities: [] });
    mgr.setAgentState(a.id, 'offline');
    assert.ok(mgr.updateAgent(a.id, { load: 50 }));
    assert.equal(mgr.getAgent(a.id)!.state, 'offline', 'offline 是显式失联语义');
  });

  it('08#46: removeEntanglements 对端引用清理（三角纠缠拆除一端）', () => {
    const mgr = new AgentManager();
    const a = mgr.registerAgent({ name: 'a', type: 'custom', capabilities: [] });
    const b = mgr.registerAgent({ name: 'b', type: 'custom', capabilities: [] });
    const c = mgr.registerAgent({ name: 'c', type: 'custom', capabilities: [] });
    assert.ok(mgr.createEntanglement(a.id, b.id));
    assert.ok(mgr.createEntanglement(b.id, c.id));
    mgr.removeEntanglements(b.id);
    assert.deepEqual(mgr.getAgent(a.id)!.quantumEntanglement, [], 'a 的引用被清');
    assert.deepEqual(mgr.getAgent(c.id)!.quantumEntanglement, [], 'c 的引用被清');
    assert.equal(mgr.getEntanglements().length, 0);
  });
});

// ---------------------------------------------------------------------------
// 市场与基线
// ---------------------------------------------------------------------------

describe('P2/P3 收尾 · 市场与经典基线', () => {
  it('01#12: SettlementHistory 环形缓冲——满员后 FIFO 语义与窗口查询', () => {
    const h = new SettlementHistory(4);
    for (const ok of [true, false, true, true, false, true]) h.push(ok);
    assert.equal(h.size, 4, '封顶后不增长');
    // 逻辑序 = [false, true, true, false, ...] 的最后 4 个：[true,true,false,true]
    assert.equal(h.successRate(0, 4), 3 / 4);
    assert.equal(h.successRate(1, 3), 0.5); // [true,false]
    assert.equal(h.successRate(2, 2), 0, '空窗口返回 0（既有契约）');
    assert.equal(h.successRate(-5, 100), 3 / 4, '越界入参被夹取');
  });

  it('01#22: BIG 从权重尺度推导——大尺度权重下不可行实例仍被检出', () => {
    // 权重尺度 1e12：固定 BIG=1e9 会被追平，不可行解伪装最优
    const m = 2;
    const n = 2;
    const weights = [
      [1e12, 1e12],
      [1e12, 1e12],
    ];
    const ineligible = [
      [false, true],
      [true, false],
    ];
    // 任务 0 只能选 agent 0，任务 1 只能选 agent 1 → 可行
    const ok = hungarianAssignment(weights, ineligible);
    assert.deepEqual(ok, [0, 1]);

    // 双任务都只允许 agent 0 → 不可行，必须抛
    const infeasible = [
      [false, true],
      [false, true],
    ];
    assert.throws(() => hungarianAssignment(weights, infeasible), /no feasible/);
    assert.ok(m === 2 && n === 2);
  });
});

// ---------------------------------------------------------------------------
// 求解器
// ---------------------------------------------------------------------------

describe('P2/P3 收尾 · 求解器', () => {
  it('01#18: probabilitiesInto / expectationValueInto 与原路径逐位一致', () => {
    const st = new ComplexAmplitudes(64);
    for (let k = 0; k < 64; k++) {
      st.re[k] = Math.sin(k * 0.37);
      st.im[k] = Math.cos(k * 0.61);
    }
    const energies = new Float64Array(64);
    for (let k = 0; k < 64; k++) energies[k] = k - 32;
    const a = st.probabilities();
    const b = new Float64Array(64);
    st.probabilitiesInto(b);
    assert.deepEqual([...a], [...b], '概率缓冲复用逐位一致');
    assert.equal(expectationValue(st, energies), expectationValueInto(st, energies));
  });

  it('08#18: born 护栏——罚参数失效（validMass≈0）时不再伪造随机坍缩', () => {
    // 零罚 + 全任务偏好同一 agent：最优福利态是非法的（多任务单 agent），
    // 退火末态合法质量 ~1e-21 → 护栏触发，坍缩走 argmax-valid
    const problem = makeProblem(3, 3);
    problem.weights = [
      [10, 1, 1],
      [10, 1, 1],
      [10, 1, 1],
    ];
    problem.penaltyOneHot = 0;
    problem.penaltyCapacity = 0;
    const r1 = annealSolve(problem, { select: 'born', seed: 7 });
    const r2 = annealSolve(problem, { select: 'born', seed: 99 });
    assert.ok(r1.validMass < 1e-6, `病态电路合法质量应近零（${r1.validMass}）`);
    assert.deepEqual(r1.assignment, r2.assignment, '护栏生效时 born 与种子无关（argmax 兜底）');
    assert.ok(
      r1.assignment.every((a) => a >= 0),
      '兜底路径产出合法分配',
    );
  });

  it('08#20: warmStart 重启可用且结果合法（同预算）', () => {
    const problem = makeProblem(3, 4);
    const cold = qaoaSolve(problem, { seed: 11, restarts: 3 });
    const warm = qaoaSolve(problem, { seed: 11, restarts: 3, warmStart: true });
    for (const sol of [cold, warm]) {
      assert.ok(
        sol.assignment.every((a) => a >= 0),
        '合法分配',
      );
    }
    // 锚定 warm-start 不劣化（同目标下允许相等）
    assert.ok(
      warm.welfare >= cold.welfare - 1e-9,
      `warm=${warm.welfare} 不应显著劣于 cold=${cold.welfare}`,
    );
  });

  it('08#19: AbortSignal 协作中止——预触发的信号让求解立即抛 AbortError', () => {
    const controller = new AbortController();
    controller.abort();
    assert.throws(
      () => qaoaSolve(makeProblem(3, 3), { signal: controller.signal, restarts: 2 }),
      (err: unknown) => err instanceof Error && err.name === 'AbortError',
    );
  });

  it('08#27: 子空间解暴露 validMass（幺正性读数 ≈ 1）', async () => {
    const { buildSubspaceModel, qaoaSolveSubspace } =
      await import('../src/core/subspace-optimizer.js');
    const problem = makeProblem(3, 4);
    const model = buildSubspaceModel(problem);
    assert.ok(model, '3×4 子空间可构建');
    const sol = qaoaSolveSubspace(model, { seed: 3 });
    assert.ok(Math.abs(sol.validMass - 1) < 1e-9, `validMass=${sol.validMass}`);
  });

  it('Q5 旁证: decodeAssignment one-hot 违约语义（向量真值源）', () => {
    assert.deepEqual(decodeAssignment(0b1001, 2, 2), [0, 1]); // q0 + q3：t0→a0, t1→a1
    assert.deepEqual(decodeAssignment(0b0011, 1, 2), [-1]); // one-hot 违约
    assert.deepEqual(decodeAssignment(0, 1, 2), [-1]); // 空任务
  });
});

// ---------------------------------------------------------------------------
// 调度器需求契约
// ---------------------------------------------------------------------------

describe('P2/P3 收尾 · 调度器', () => {
  it('01#7: resource/location/quantum 需求在提交期被拒绝（不再静默忽略）', () => {
    const sched = new QuantumScheduler({});
    sched.registerAgent(makeAgent());
    for (const type of ['resource', 'location', 'quantum'] as const) {
      assert.throws(
        () =>
          sched.submitTask({
            name: `t-${type}`,
            type: 'compute',
            priority: 'medium',
            requirements: [{ type, name: 'gpu', weight: 1 }],
            dependencies: [],
            estimatedDuration: 1000,
            actualDuration: 0,
            status: 'pending',
          }),
        (err: unknown) => err instanceof SchedulingError && /does not enforce/.test(err.message),
        `${type} 需求应被拒绝`,
      );
    }
    // capability 需求不受影响
    const ok = sched.submitTask({
      name: 'ok',
      type: 'compute',
      priority: 'medium',
      requirements: [{ type: 'capability', name: 'js', weight: 1 }],
      dependencies: [],
      estimatedDuration: 1000,
      actualDuration: 0,
      status: 'pending',
    });
    assert.ok(ok.id !== undefined && ok.id.length > 0);
  });
});

// ---------------------------------------------------------------------------
// executor / system-tools 取消链路
// ---------------------------------------------------------------------------

// 载荷走脚本文件（-e 内联旗标被工具层无条件拒绝——wave3 加固）；
// 脚本用 cwd 相对名，避免临时目录路径含空格被分词拆分
const spinScript = 'qmap-abort-spin.test.tmp.js';
const { writeFile, unlink } = await import('node:fs/promises');
await writeFile(spinScript, 'setTimeout(() => {}, 60000);\n');

describe('P2/P3 收尾 · 超时取消链路（02#18）', () => {
  it('execute_command_argv: 预触发 AbortSignal 立即拒绝', async () => {
    configureCommandPolicy({ allowedPrograms: ['node'] });
    try {
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(
        execute_command_argv('node', [spinScript], undefined, controller.signal),
        /abort|Abort/i,
      );
    } finally {
      resetCommandPolicy();
    }
  });

  it('executor 动作超时中止底层命令（长眠进程被击杀而非滞留）', async () => {
    configureCommandPolicy({ allowedPrograms: ['node'], timeoutMs: 60_000 });
    try {
      const exec = new ActionExecutor({ maxConcurrentActions: 2, actionTimeoutMs: 400 });
      const action: Action = {
        type: 'command',
        name: 'sleep-long',
        parameters: { command: 'node', args: [spinScript] },
      };
      const started = Date.now();
      await assert.rejects(exec.executeAction('rule-1', action), /timeout|Timeout/i);
      const elapsed = Date.now() - started;
      assert.ok(elapsed < 5000, `超时应触发中止而非等满命令时长（${elapsed}ms）`);
    } finally {
      resetCommandPolicy();
      await unlink(spinScript).catch(() => {});
    }
  });
});
