/**
 * 2026-09 全量代码遍历质量升级 · 回归测试
 *
 * 每个用例锁定一个本次遍历发现并修复的真实缺陷（修复前均失败或被旧断言
 * 掩盖）。分组与修复批次一致：调度器核心 / agent 管理 / 主动智能 /
 * 数值引擎参数 / 机制层 / 总线安全。
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { AgentManager } from '../src/core/agent-manager.js';
import {
  DecisionEngine,
  ActionExecutor,
  StateMonitor,
  ProactiveIntelligencePlugin,
  type Rule,
  type MonitorEvent,
} from '../src/proactive-intelligence/index.js';
import { annealSolve, qaoaSolve } from '../src/core/quantum-optimizer.js';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { buildSubspaceModel, annealSolveSubspace } from '../src/core/subspace-optimizer.js';
import { QuantumEngineError } from '../src/utils/errors.js';
import { estimateQuality, type MarketAgentRecord } from '../src/core/market-estimation.js';
import { QuantumBus } from '../src/communication/quantum-bus.js';
import { DSHIntegration } from '../src/dsh/dsh-integration.js';
import { configureCommandPolicy, resetCommandPolicy } from '../src/tools/system-tools.js';
import type { Action } from '../src/proactive-intelligence/types.js';
import { makeAgent } from './helpers/fixtures.js';
import WebSocket from 'ws';

// ----------------------------------------------------------------------------
// 构造辅助
// ----------------------------------------------------------------------------

function makeTask(name: string, capability: string) {
  return {
    name,
    type: 'test',
    priority: 'medium' as const,
    requirements: [{ type: 'capability' as const, name: capability, value: null, weight: 1.0 }],
    dependencies: [] as string[],
    estimatedDuration: 1000,
    actualDuration: 0,
    status: 'pending' as const,
  };
}

function tinyProblem(): AssignmentProblem {
  return {
    taskIds: ['t0', 't1'],
    agentIds: ['a0', 'a1'],
    weights: [
      [1, 1],
      [1, 1],
    ],
    ineligible: [
      [false, false],
      [false, false],
    ],
    couplings: new Map(),
    penaltyOneHot: 10,
    penaltyCapacity: 10,
  };
}

function stateRule(id: string, conditions: Rule['conditions']): Rule {
  return {
    id,
    name: id,
    description: '',
    enabled: true,
    priority: 50,
    cooldown: 0,
    conditions,
    actions: [{ type: 'notification', name: 'n', parameters: { title: 't', message: 'm' } }],
  };
}

function tick(times = 4): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const step = () => (++n >= times ? resolve() : setImmediate(step));
    setImmediate(step);
  });
}

// ----------------------------------------------------------------------------
// 调度器核心
// ----------------------------------------------------------------------------

describe('调度器 · completeTask 幂等', () => {
  it('重复完成不重复计数、不二次释放 agent 容量', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['js']);
    scheduler.registerAgent(agent);
    const task = scheduler.submitTask(makeTask('T1', 'js'));
    assert.equal(task.status, 'assigned');

    assert.equal(scheduler.completeTask(task.id, true), true);
    const afterFirst = scheduler.getSystemMetrics();
    assert.equal(afterFirst.completedTasks, 1);
    assert.equal(agent.load, 0);

    // 重复完成（updateTaskStatus 与巡检超时竞争到达的等价路径）
    assert.equal(scheduler.completeTask(task.id, true), false);
    assert.equal(scheduler.completeTask(task.id, false), false);
    const afterRepeat = scheduler.getSystemMetrics();
    assert.equal(afterRepeat.completedTasks, 1, '完成数不得重复累计');
    assert.equal(afterRepeat.failedTasks, 0, '已终结任务不得转失败');
    assert.equal(agent.load, 0, 'agent 负载不得二次扣减为负');
  });

  it('getSchedulingHistory 返回防御性拷贝', () => {
    const scheduler = new QuantumScheduler({});
    const task = scheduler.submitTask(makeTask('T1', 'js')); // 无agent → pending
    assert.equal(task.status, 'pending');
    const history = scheduler.getSchedulingHistory();
    const lenBefore = history.length;
    history.push({
      taskId: 'forged',
      agentId: 'ghost',
      probability: 1,
      confidence: 1,
      reasoning: 'forged',
      alternatives: [],
    });
    assert.equal(
      scheduler.getSchedulingHistory().length,
      lenBefore,
      '外部 push 不得污染内部历史（破坏封顶不变量）',
    );
  });
});

// ----------------------------------------------------------------------------
// agent 管理
// ----------------------------------------------------------------------------

describe('AgentManager · 引用一致性与过载不变量', () => {
  it('updateAgent 原地合并：注册返回的引用持续可见后续变更', () => {
    const mgr = new AgentManager({});
    const agent = mgr.registerAgent({
      name: 'A1',
      type: 'developer',
      capabilities: ['js'],
    });
    mgr.updateAgent(agent.id, { load: 50 });
    assert.equal(agent.load, 50);
    mgr.increaseLoad(agent.id, 10);
    // 旧实现替换 Map 条目，此处的旧引用永远停在 50（分裂脑）
    assert.equal(agent.load, 60, '外部持有引用必须与存储保持同一对象');
    assert.equal(mgr.getAgent(agent.id), agent, 'getAgent 返回同一实例');
  });

  it('heartbeat 恢复过载 agent 时保持 overloaded（不静默放行给调度）', () => {
    const mgr = new AgentManager({});
    const agent = mgr.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });
    mgr.updateAgent(agent.id, { load: 95, state: 'offline' });
    mgr.heartbeat(agent.id);
    assert.equal(
      mgr.getAgent(agent.id)!.state,
      'overloaded',
      'load 95 > 阈值 80：心跳只证明存活，不得改写状态语义',
    );
  });
});

// ----------------------------------------------------------------------------
// 主动智能
// ----------------------------------------------------------------------------

describe('决策引擎 · 混合条件链', () => {
  const ctxOf = (state: Record<string, unknown>) => ({
    events: [] as MonitorEvent[],
    currentState: state,
    history: [],
    rules: [],
  });

  it('[A=true, B(OR), C(AND)=false] 求值为 C（旧短路 break 错误返回 true）', async () => {
    const engine = new DecisionEngine();
    engine.addRule(
      stateRule('chain', [
        { type: 'state', operator: 'equals', field: 'a', value: true },
        { type: 'state', operator: 'equals', field: 'b', value: true, logicalOperator: 'OR' },
        { type: 'state', operator: 'equals', field: 'c', value: true, logicalOperator: 'AND' },
      ]),
    );
    // (true OR b=true) AND c=true，其中 c 实际为 false → false
    const decisions = await engine.makeDecision(ctxOf({ a: true, b: false, c: false }));
    assert.equal(decisions.has('chain'), false, '(a OR b) AND c：c=false 必须压垮前面的 OR 短路');
  });

  it('[A=false, B(AND), C(OR)=true] 求值为 C（对称漏触发）', async () => {
    const engine = new DecisionEngine();
    engine.addRule(
      stateRule('chain', [
        { type: 'state', operator: 'equals', field: 'a', value: true },
        { type: 'state', operator: 'equals', field: 'b', value: true, logicalOperator: 'AND' },
        { type: 'state', operator: 'equals', field: 'c', value: true, logicalOperator: 'OR' },
      ]),
    );
    // (false AND b) OR c，c=true → true（旧短路在 i=0 提前退出返回 false）
    const decisions = await engine.makeDecision(ctxOf({ a: false, b: false, c: true }));
    assert.equal(decisions.has('chain'), true, '尾部 OR 条件必须仍被求值');
  });
});

describe('执行器 · 取消竞态单终态', () => {
  it('取消后动作再拒绝：只发 action_cancelled，不重复 action_failed', async () => {
    const executor = new ActionExecutor({ actionTimeoutMs: 5_000 });
    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    executor.on('action_completed', () => completed++);
    executor.on('action_failed', () => failed++);
    executor.on('action_cancelled', () => cancelled++);

    const promise = executor.executeAction('rule-1', {
      type: 'custom',
      name: 'late-reject',
      parameters: {
        handler: () =>
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error('late rejection')), 25);
          }),
      },
    });

    const running = executor.getRunningExecutions();
    assert.equal(running.length, 1);
    executor.cancelExecution(running[0]!.id);
    await assert.rejects(promise, /late rejection/);
    await tick(2);

    assert.equal(cancelled, 1);
    assert.equal(failed, 0, '取消已终态化后到达的拒绝不得再发第二个终态事件（指标双计）');
    assert.equal(completed, 0);
    assert.equal(executor.getExecutionHistory().length, 1, '同一执行恰好入史一次');
  });

  it('并发上限拒绝：rejected 三态分离——入史 + 独立事件，不算失败', async () => {
    const executor = new ActionExecutor({ maxConcurrentActions: 1 });
    let failed = 0;
    let rejected = 0;
    executor.on('action_failed', () => failed++);
    executor.on('action_rejected', () => rejected++);

    const inFlight = executor.executeAction('rule-1', {
      type: 'custom',
      name: 'hold',
      parameters: {
        handler: () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('late'), 120);
          }),
      },
    });
    await tick(2);

    // 预检拒绝不再 throw：被拒动作从未真正发起，按 rejected 状态返回
    const refused = await executor.executeAction('rule-2', {
      type: 'notification',
      name: 'n',
      parameters: { title: 't', message: 'm' },
    });
    assert.equal(refused.status, 'rejected');
    assert.match(refused.error?.message ?? '', /Maximum concurrent/);
    const history = executor.getExecutionHistory();
    assert.ok(
      history.some((e) => e.ruleId === 'rule-2' && e.status === 'rejected'),
      '被并发策略拒绝的尝试必须留下审计痕迹（旧实现无史无事件）',
    );
    assert.equal(rejected, 1, '独立事件名 action_rejected，与真实失败区分');
    assert.equal(failed, 0, '预检拒绝不得计入真实失败口径');

    executor.cancelExecution(executor.getRunningExecutions()[0]!.id);
    // 取消后到达的结果走静默收尾分支：promise 兑现但终态为 failed
    const exec = await inFlight;
    assert.equal(exec.status, 'failed');
    assert.equal(executor.getExecutionHistory().filter((e) => e.ruleId === 'rule-1').length, 1);
  });
});

describe('监控器 · 惰性过期前缀', () => {
  it('过期事件对读取路径不可见（语义与全量 filter 一致）', async () => {
    // 注意 retentionMs=0 是 falsy 会被构造器忽略，用 1ms 表达"立即过期"
    const monitor = new StateMonitor({ retentionMs: 1 });
    monitor.observe({ type: 't1', source: 's', data: {}, severity: 'info' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    monitor.observe({ type: 't2', source: 's', data: {}, severity: 'info' });

    const events = monitor.getEvents();
    assert.ok(!events.some((e) => e.type === 't1'), '过期事件对读取路径必须不可见');
    assert.ok(events.length <= 1, '仅最新事件可能存活（同毫秒竞态下 t2 亦可过期）');
    assert.ok(events.every((e) => e.type === 't2'));
    const stats = monitor.getStatistics();
    assert.equal(stats.live, events.length, 'live 与事件视图一致');
    assert.equal(stats.total, 2, 'total 为累计口径（含已过期事件），与 live 分列');
    monitor.clear();
    assert.equal(monitor.getEvents().length, 0);
  });
});

// ----------------------------------------------------------------------------
// 数值引擎参数验证
// ----------------------------------------------------------------------------

describe('求解器 · 退化参数显式拒绝', () => {
  const problem = tinyProblem();
  const model = buildSubspaceModel(problem);

  /**
   * 05#12：判别式 = 错误类型（QuantumEngineError）+ 消息指名参数——
   * 原裸正则（/steps/ 等）会放行任何含该词的 Error，类型契约未被钉住。
   */
  const isEngineParamError =
    (param: string) =>
    (err: unknown): boolean =>
      err instanceof QuantumEngineError && err.message.includes(param);

  it('annealSolve：steps=0 / tau=0 抛 QuantumEngineError 而非 NaN 静默穿流', () => {
    assert.throws(
      () => annealSolve(problem, { anneal: { tau: 20, steps: 0 } }),
      isEngineParamError('steps'),
    );
    assert.throws(
      () => annealSolve(problem, { anneal: { tau: 0, steps: 10 } }),
      isEngineParamError('tau'),
    );
  });

  it('annealSolveSubspace：同样校验', () => {
    assert.ok(model, '2x2 问题必有子空间模型');
    assert.throws(
      () => annealSolveSubspace(model, { anneal: { tau: 5, steps: 0 } }),
      isEngineParamError('steps'),
    );
    assert.throws(
      () => annealSolveSubspace(model, { anneal: { tau: -1, steps: 10 } }),
      isEngineParamError('tau'),
    );
  });

  it('layers/shots 非正整数拒绝（QAOA 路径）', () => {
    assert.throws(() => qaoaSolve(problem, { layers: 0 }), isEngineParamError('layers'));
    assert.throws(() => qaoaSolve(problem, { shots: 0 }), isEngineParamError('shots'));
  });
});

// ----------------------------------------------------------------------------
// 机制层
// ----------------------------------------------------------------------------

describe('市场估值 · 退化先验权重', () => {
  it('priorWeight=0 且无历史：返回先验而非 0/0=NaN', () => {
    const record: MarketAgentRecord = {
      spec: { trueCost: 1 },
      attempts: new Map(),
      successes: new Map(),
      capital: new Map(),
    };
    const q = estimateQuality(record, 'js', {
      priorQuality: 0.6,
      priorWeight: 0,
      exploreCoefficient: 1,
      switchCostRate: 0.1,
      successValue: 10,
    });
    assert.ok(Number.isFinite(q), 'NaN 会以 NaN 流价穿透最小费用流并静默产出乱分配');
    assert.equal(q, 0.6);
  });
});

// ----------------------------------------------------------------------------
// 总线安全
// ----------------------------------------------------------------------------

describe('QuantumBus · 鉴权门覆盖全部流量路径', () => {
  const buses: QuantumBus[] = [];

  function openSocket(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  /** 事件驱动等待总线事件（带谓词与超时）——替代固定轮次的时序估计 */
  function waitForBusEvent<T>(
    bus: QuantumBus,
    name: string,
    predicate: (e: T) => boolean,
    timeoutMs = 3_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const listener = (e: T) => {
        if (!predicate(e)) return;
        clearTimeout(timer);
        bus.off(name, listener);
        resolve(e);
      };
      const timer = setTimeout(() => {
        bus.off(name, listener);
        reject(new Error(`timeout waiting for bus event '${name}'`));
      }, timeoutMs);
      bus.on(name, listener);
    });
  }

  after(async () => {
    for (const bus of buses) bus.shutdown();
  });

  it('未认证连接不得订阅频道（旧实现全量广播直达）', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 'secret' } });
    buses.push(bus);
    await bus.start();
    const subscribed: string[] = [];
    bus.on('agent_subscribed', (e: { agentId: string }) => subscribed.push(e.agentId));

    const ws = await openSocket(bus.getPort()!);
    // 05#2 确定性改造：同连接消息严格有序——先发应被拒的 subscribe，
    // 再发会产生正向事件的 authenticate；一旦 agent_authenticated 到达，
    // 前一条 subscribe 必然已被处理，此刻的「零订阅」即为定论，
    // 不再依赖 6 轮 setImmediate 估计真实网络往返。
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'status_update' }));
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-1', token: 'secret' }));
    await waitForBusEvent(
      bus,
      'agent_authenticated',
      (e: { agentId: string }) => e.agentId === 'agent-1',
    );
    assert.equal(subscribed.length, 0, '未认证订阅必须被拒');

    ws.send(JSON.stringify({ type: 'subscribe', channel: 'status_update' }));
    await waitForBusEvent(
      bus,
      'agent_subscribed',
      (e: { agentId: string }) => e.agentId === 'agent-1',
    );
    assert.equal(subscribed.length, 1, '认证后订阅正常放行');
    ws.close();
  });

  it('已认证连接不得冒用他人 agentId 发消息', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 'secret' } });
    buses.push(bus);
    await bus.start();
    const queued: string[] = [];
    bus.on('message_queued', (e: { agentId: string }) => queued.push(e.agentId));

    const ws = await openSocket(bus.getPort()!);
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-1', token: 'secret' }));
    await waitForBusEvent(
      bus,
      'agent_authenticated',
      (e: { agentId: string }) => e.agentId === 'agent-1',
    );

    // 冒充 agent-2 发往 agent-2：若被放行，agent-2 离线会触发 message_queued。
    // 同连接有序：m2（真实身份，必然排队）的 message_queued 事件到达时，
    // m1 必然已被处理——queued 只含 agent-3 即证明 m1 被丢弃。
    ws.send(
      JSON.stringify({
        id: 'm1',
        type: 'status_update',
        sourceAgentId: 'agent-2',
        targetAgentId: 'agent-2',
        content: {},
        timestamp: new Date().toISOString(),
        priority: 'medium',
        quantumState: {
          id: 'q1',
          amplitude: 1,
          phase: 0,
          collapsed: true,
          position: { x: 0, y: 0, z: 0 },
        },
      }),
    );
    // 以真实身份发给离线 agent-3：正常排队
    ws.send(
      JSON.stringify({
        id: 'm2',
        type: 'status_update',
        sourceAgentId: 'agent-1',
        targetAgentId: 'agent-3',
        content: {},
        timestamp: new Date().toISOString(),
        priority: 'medium',
        quantumState: {
          id: 'q2',
          amplitude: 1,
          phase: 0,
          collapsed: true,
          position: { x: 0, y: 0, z: 0 },
        },
      }),
    );
    await waitForBusEvent(
      bus,
      'message_queued',
      (e: { agentId: string }) => e.agentId === 'agent-3',
    );
    assert.deepEqual(queued, ['agent-3'], '冒用消息被丢弃，真实身份正常排队');
    ws.close();
  });

  it('连接数上限：超限连接被 1013 拒绝', async () => {
    const bus = new QuantumBus({ communication: { port: 0, maxConnections: 1 } });
    buses.push(bus);
    await bus.start();

    const first = await openSocket(bus.getPort()!);
    const second = new WebSocket(`ws://127.0.0.1:${bus.getPort()}/quantum-bus`);
    const closed = new Promise<number | undefined>((resolve) => {
      second.once('close', (code: number) => resolve(code));
    });
    assert.equal(await closed, 1013, '超限连接以 1013 拒绝');
    assert.equal(bus.getConnectionCount(), 1);
    first.close();
  });
});

// ----------------------------------------------------------------------------
// 总线身份边界（second-pass）：authenticate 的 agentId 形状校验
// ----------------------------------------------------------------------------

describe('QuantumBus · authenticate 身份形状校验', () => {
  const buses: QuantumBus[] = [];

  function openSocket(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  function waitClose(ws: WebSocket, timeoutMs = 3_000): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('close timeout')), timeoutMs);
      ws.once('close', (code: number) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
  }

  function waitBusEvent<T>(
    bus: QuantumBus,
    name: string,
    predicate: (e: T) => boolean,
    timeoutMs = 3_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const listener = (e: T) => {
        if (!predicate(e)) return;
        clearTimeout(timer);
        bus.off(name, listener);
        resolve(e);
      };
      const timer = setTimeout(() => {
        bus.off(name, listener);
        reject(new Error(`timeout waiting for bus event '${name}'`));
      }, timeoutMs);
      bus.on(name, listener);
    });
  }

  after(() => {
    for (const bus of buses) bus.shutdown();
  });

  it('非字符串 agentId（数字）被拒绝：不绑定身份、4001 断开、agentsOnline 不受污染', async () => {
    // 无鉴权本地模式同样校验形状：42 此前直接绑定为连接身份，
    // getAgentsOnline() 的 string[] 混入数字、订阅/投递按值比较语义被破坏
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 42 }));
    const failed = await waitBusEvent<{ connectionId: string }>(
      bus,
      'authentication_failed',
      (e) => typeof e.connectionId === 'string',
    );
    assert.ok(failed, '形状非法的 authenticate 必须发 authentication_failed');
    assert.equal(await waitClose(ws), 4001, '与 token 校验失败同判定：4001 断开');
    assert.deepEqual(bus.getAgentsOnline(), [], '数字身份不得混入 agentsOnline');
  });

  it('空串 agentId 被拒绝（即使 token 正确）——不再撞「未认证」哨兵', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 'secret' } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    ws.send(JSON.stringify({ type: 'authenticate', agentId: '', token: 'secret' }));
    await waitBusEvent<{ connectionId: string }>(
      bus,
      'authentication_failed',
      (e) => typeof e.connectionId === 'string',
    );
    assert.equal(await waitClose(ws), 4001);
    assert.deepEqual(bus.getAgentsOnline(), [], '空串不得绑定为身份（曾永久卡在未认证态）');
  });

  it('边界：合法非空字符串 agentId 的认证不受影响（同 id 重复认证幂等）', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-1' }));
    await waitBusEvent<{ agentId: unknown }>(
      bus,
      'agent_authenticated',
      (e) => e.agentId === 'agent-1',
    );
    // 同 id 重复认证保持幂等（F04 契约）
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-1' }));
    await new Promise((r) => setTimeout(r, 100));
    assert.deepEqual(bus.getAgentsOnline(), ['agent-1']);
    assert.equal(bus.getConnectionCount(), 1, '幂等重认证不得断开连接');
    ws.close();
  });
});

// ----------------------------------------------------------------------------
// 执行器取消链路（second-pass）：取消停止重试 + 真中止在飞尝试
// ----------------------------------------------------------------------------

// 取消链路探针脚本：长眠子进程（取消必须立即击杀而非等动作超时兜底）
const cancelSpinScript = 'pireg-cancel-spin.test.tmp.js';
const { writeFile: writeCancelSpin, unlink: unlinkCancelSpin } = await import('node:fs/promises');
await writeCancelSpin(cancelSpinScript, 'setTimeout(() => {}, 60000);\n');

describe('执行器 · 取消是真实制动（second-pass）', () => {
  it('取消后重试循环停止：被取消的执行不再发起后续尝试（副作用不放大）', async () => {
    const executor = new ActionExecutor({ actionTimeoutMs: 5_000 });
    let handlerCalls = 0;
    const started = executor.executeAction('rule-1', {
      type: 'custom',
      name: 'retry-after-cancel',
      parameters: {
        handler: () =>
          new Promise((_resolve, reject) => {
            handlerCalls++;
            setTimeout(() => reject(new Error('transient boom')), 10);
          }),
      },
      retryPolicy: { maxRetries: 3, backoffMs: 15 },
    });

    // 首个尝试在飞时取消（executeAction 同步段保证此刻已入 running 表）
    const running = executor.getRunningExecutions();
    assert.equal(running.length, 1);
    executor.cancelExecution(running[0]!.id);
    await assert.rejects(started, /cancel/i);

    // 取消后的第一次尝试拒绝即收尾：handler 只被调用 1 次（旧实现 4 次
    // ——重试完全无视取消，command 动作即重复执行 3 次子进程）
    assert.equal(handlerCalls, 1, '取消后不得再发起任何重试尝试');
    const history = executor.getExecutionHistory();
    assert.equal(history.length, 1, '同一执行恰好入史一次');
    assert.equal(history[0]!.status, 'failed');
  });

  it('取消即中止在飞子进程：command 动作不等动作超时兜底', async () => {
    configureCommandPolicy({ allowedPrograms: ['node'], timeoutMs: 60_000 });
    try {
      const executor = new ActionExecutor({ actionTimeoutMs: 30_000 });
      const action: Action = {
        type: 'command',
        name: 'spin-until-cancel',
        parameters: { command: 'node', args: [cancelSpinScript] },
      };
      const startedAt = performance.now();
      const promise = executor.executeAction('rule-1', action);

      // 同步段保证已入 running 表；取消应经 AbortSignal 整树击杀子进程
      const running = executor.getRunningExecutions();
      assert.equal(running.length, 1);
      executor.cancelExecution(running[0]!.id);
      await assert.rejects(promise, /cancel/i);
      const elapsed = performance.now() - startedAt;
      assert.ok(
        elapsed < 5_000,
        `取消应立即中止子进程而非等 30s 动作超时（${elapsed.toFixed(0)}ms）`,
      );
    } finally {
      resetCommandPolicy();
      await unlinkCancelSpin(cancelSpinScript).catch(() => {});
    }
  });
});

// ----------------------------------------------------------------------------
// 插件层（second-pass）：stop() 刹住动作池 + 文档化事件面
// ----------------------------------------------------------------------------

describe('ProactiveIntelligencePlugin · stop() 覆盖动作池与事件面', () => {
  it('stop() 后池内排队动作不再启动（紧急制动不只在批处理调度口生效）', async () => {
    const plugin = new ProactiveIntelligencePlugin({
      executor: { maxConcurrentActions: 1, actionTimeoutMs: 5_000 },
    });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    plugin.addRule({
      id: 'brake',
      name: 'brake',
      description: '',
      enabled: true,
      priority: 50,
      cooldown: 0,
      conditions: [{ type: 'event', operator: 'equals', field: 'go.x', value: 1 }],
      actions: [
        { type: 'custom', name: 'hold', parameters: { handler: () => gate } },
        { type: 'notification', name: 'after-hold', parameters: { title: 't', message: 'm' } },
      ],
    });
    await plugin.start();
    plugin.observe({ type: 'go', source: 's', data: { x: 1 }, severity: 'info' });

    // 等第一个动作进入 running（gate 挂起），第二个动作在池内排队
    let spins = 0;
    while (plugin.getExecutor().getRunningExecutions().length < 1 && spins++ < 500) {
      await new Promise((r) => setImmediate(r));
    }
    assert.equal(plugin.getExecutor().getRunningExecutions().length, 1);

    await plugin.stop(); // 紧急制动：取消在飞 + 刹住排队
    release();
    await plugin.flush(3_000);

    const hist = plugin.getExecutor().getExecutionHistory();
    const names = hist.map((h) => `${h.action.name}:${h.status}`);
    assert.deepEqual(
      names,
      ['hold:failed'],
      `stop 后排队动作不得启动（hold 被 cancel 终态化，after-hold 不得出现），实际 ${names.join(',')}`,
    );
    assert.equal(plugin.getStatistics().executor.backlog, 0, '被放弃的排队条目背压清零');
  });

  it("plugin.on('event') 收到监控事件（README/QUICKSTART 文档化的事件面）", async () => {
    const plugin = new ProactiveIntelligencePlugin();
    const seen: string[] = [];
    plugin.on('event', (event: MonitorEvent) => seen.push(event.type));

    plugin.observe({ type: 'x', source: 's', data: {}, severity: 'info' });
    plugin.observe({ type: 'y', source: 's', data: {}, severity: 'info' });

    assert.deepEqual(seen, ['x', 'y'], '文档承诺的 plugin.on("event") 此前永不触发');
    plugin.destroy();
  });
});

// ----------------------------------------------------------------------------
// DSH 集成（second-pass）：文档契约「initialize 后方可执行工具」
// ----------------------------------------------------------------------------

describe('DSHIntegration · 初始化门', () => {
  it('未 initialize 时 executeTool/executeWorkflow 指名拒绝（而非误报工具缺失）', async () => {
    const dsh = new DSHIntegration({});
    await assert.rejects(
      () => dsh.executeTool('read_file', { path: 'package.json' }),
      /not initialized/,
    );
    await assert.rejects(() => dsh.executeWorkflow('code_analysis_workflow'), /not initialized/);

    // initialize 后同一调用正常放行（门不是永久性的）
    await dsh.initialize();
    const content = (await dsh.executeTool('read_file', { path: 'package.json' })) as string;
    assert.ok(content.includes('quantum-multi-agent-platform'));
    dsh.shutdown();
  });
});
