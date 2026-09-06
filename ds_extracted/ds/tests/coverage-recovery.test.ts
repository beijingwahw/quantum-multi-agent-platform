/**
 * coverage-recovery —— 修复/创新升级引入的新分支的定向行为测试。
 *
 * 这些路径此前的验证散落在「主流程恰好路过」的间接覆盖里，跨环境
 * （CI 慢机、不同 Node 补丁版本）的时序差异会使部分分支不被执行，
 * 分支覆盖率在 82% 门禁上的余量被击穿（CI 实证：ubuntu-22 与双
 * Windows 失败、ubuntu-24 通过）。本文件把每个新分支钉成确定性的
 * 直接断言——不再依赖环境运气。
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import WebSocket from 'ws';

import { ActionExecutor } from '../src/proactive-intelligence/executor.js';
import { DecisionEngine } from '../src/proactive-intelligence/decision-engine.js';
import { StateMonitor } from '../src/proactive-intelligence/monitor.js';
import { QuantumBus } from '../src/communication/quantum-bus.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { ToolError } from '../src/utils/errors.js';
import type { Rule, ActionExecution } from '../src/proactive-intelligence/types.js';

// ----------------------------------------------------------------------------
// executor：三态分离与重试分类的全部新分支
// ----------------------------------------------------------------------------
describe('分支钉板 · executor 三态与重试分类', () => {
  it('禁用执行器 → rejected 终态 + 独立事件 + 不抛错', async () => {
    const executor = new ActionExecutor({ enabled: false });
    const rejected: ActionExecution[] = [];
    executor.on('action_rejected', (e: ActionExecution) => rejected.push(e));

    const exec = await executor.executeAction('r', {
      type: 'notification',
      name: 'n',
      parameters: { title: 't', message: 'm' },
    });
    assert.equal(exec.status, 'rejected');
    assert.match(exec.error?.message ?? '', /disabled/i);
    assert.equal(rejected.length, 1, 'action_rejected 独立事件必须发出');
  });

  it('策略阻止的动作 → rejected（非 failed）', async () => {
    const executor = new ActionExecutor({ blockedActions: ['notification'] });
    const exec = await executor.executeAction('r', {
      type: 'notification',
      name: 'n',
      parameters: { title: 't', message: 'm' },
    });
    assert.equal(exec.status, 'rejected');
    assert.match(exec.error?.message ?? '', /blocked/i);
  });

  it('safeMode → skipped 终态 + action_skipped 事件', async () => {
    const executor = new ActionExecutor({ safeMode: true });
    let skipped = 0;
    executor.on('action_skipped', () => skipped++);
    const exec = await executor.executeAction('r', {
      type: 'notification',
      name: 'n',
      parameters: { title: 't', message: 'm' },
    });
    assert.equal(exec.status, 'skipped');
    assert.deepEqual(exec.result, { safeMode: true, skipped: true });
    assert.equal(skipped, 1);
  });

  it('确定性失败（ToolError）不重试：maxRetries=3 也只执行一次', async () => {
    let calls = 0;
    const executor = new ActionExecutor({});
    await assert.rejects(
      executor.executeAction('r', {
        type: 'custom',
        name: 'deterministic',
        parameters: {
          handler: () => {
            calls++;
            throw new ToolError('policy says no');
          },
        },
        retryPolicy: { maxRetries: 3, backoffMs: 1 },
      }),
      /policy says no/,
    );
    assert.equal(calls, 1, 'ToolError 是确定性失败：重试必然同结果，不得重试');
  });

  it('瞬态失败（普通 Error）按策略重试后成功', async () => {
    let calls = 0;
    const executor = new ActionExecutor({});
    const exec = await executor.executeAction('r', {
      type: 'custom',
      name: 'transient',
      parameters: {
        handler: () => {
          calls++;
          if (calls < 3) throw new Error('ECONNRESET: transient');
          return 'ok';
        },
      },
      retryPolicy: { maxRetries: 3, backoffMs: 1 },
    });
    assert.equal(exec.status, 'completed');
    assert.equal(calls, 3, '瞬态错误重试至成功');
  });
});

// ----------------------------------------------------------------------------
// decision-engine：缺失值守卫与规则所有权契约的新分支
// ----------------------------------------------------------------------------
describe('分支钉板 · decision-engine 守卫', () => {
  function engineWith(rule: Rule): DecisionEngine {
    const engine = new DecisionEngine();
    engine.addRule(rule);
    return engine;
  }

  async function triggers(engine: DecisionEngine, state: unknown): Promise<boolean> {
    const actions = await engine.makeDecision({
      events: [],
      currentState: state,
      history: [],
      rules: engine.getAllRules(),
    });
    return actions.has('r');
  }

  it('contains/notContains：对象值（默认字符串化 [object Object]）不参与子串比较', async () => {
    const engine = engineWith({
      id: 'r',
      name: 'r',
      description: '',
      enabled: true,
      priority: 50,
      cooldown: 0,
      conditions: [{ type: 'state', operator: 'contains', field: 'payload', value: 'Object' }],
      actions: [],
    });
    assert.equal(
      await triggers(engine, { payload: { a: 1 } }),
      false,
      '对象值不得经默认字符串化误命中',
    );
  });

  it('matches：对象值不参与正则匹配；非法正则按不成立处理', async () => {
    const engineObj = engineWith({
      id: 'r',
      name: 'r',
      description: '',
      enabled: true,
      priority: 50,
      cooldown: 0,
      conditions: [{ type: 'state', operator: 'matches', field: 'x', value: 'obj' }],
      actions: [],
    });
    assert.equal(await triggers(engineObj, { x: { b: 2 } }), false);

    const engineBadRe = engineWith({
      id: 'r',
      name: 'r',
      description: '',
      enabled: true,
      priority: 50,
      cooldown: 0,
      conditions: [{ type: 'state', operator: 'matches', field: 'x', value: '[' }],
      actions: [],
    });
    assert.equal(
      await triggers(engineBadRe, { x: 'anything' }),
      false,
      '非法正则 → 条件不成立而非抛错',
    );
  });

  it('数值比较：null/undefined/空串/非数字不参与（Number(null)=0 陷阱封印）', async () => {
    for (const bad of [null, undefined, '', '12abc']) {
      const engine = engineWith({
        id: 'r',
        name: 'r',
        description: '',
        enabled: true,
        priority: 50,
        cooldown: 0,
        conditions: [{ type: 'state', operator: 'lessThan', field: 'v', value: 5 }],
        actions: [],
      });
      assert.equal(
        await triggers(engine, { v: bad }),
        false,
        `缺失值 ${String(bad)} 不得按 0 参与比较`,
      );
    }
  });

  it('between：端点缺失（null）时条件不成立（JSON 配置边界输入）', async () => {
    // 判别联合在静态层已排除 null 端点——本守卫面向 JSON.parse 的运行时
    // 配置输入，经真实边界构造（toNumber(null) === null → 条件不成立）
    const rule = JSON.parse(
      JSON.stringify({
        id: 'r',
        name: 'r',
        description: '',
        enabled: true,
        priority: 50,
        cooldown: 0,
        conditions: [{ type: 'state', operator: 'between', field: 'lo', value: [null, 10] }],
        actions: [],
      }),
    ) as unknown as Rule;
    const engine = engineWith(rule);
    assert.equal(await triggers(engine, { lo: 3 }), false);
  });

  it('规则所有权：调用方在 addRule 后改写对象不影响引擎决策', async () => {
    const rule: Rule = {
      id: 'r',
      name: 'r',
      description: '',
      enabled: true,
      priority: 50,
      cooldown: 0,
      conditions: [{ type: 'state', operator: 'equals', field: 'v', value: 1 }],
      actions: [{ type: 'notification', name: 'n', parameters: { title: 't', message: 'm' } }],
    };
    const engine = new DecisionEngine();
    engine.addRule(rule);
    // 调用方侧的「外部改写」：绕过引擎禁用规则/篡改条件
    rule.enabled = false;
    rule.conditions[0]!.value = 999;
    const actions = await engine.makeDecision({
      events: [],
      currentState: { v: 1 },
      history: [],
      rules: engine.getAllRules(),
    });
    assert.ok(actions.has('r'), '外部改写不得影响引擎内部规则（深拷贝入库）');

    // 出库快照同样零别名：改快照不影响引擎
    const snapshot = engine.getRule('r')!;
    snapshot.enabled = false;
    const actions2 = await engine.makeDecision({
      events: [],
      currentState: { v: 1 },
      history: [],
      rules: engine.getAllRules(),
    });
    assert.ok(actions2.has('r'), '改出库快照不得影响引擎');
  });
});

// ----------------------------------------------------------------------------
// monitor：O(1) 最新事件索引的边界分支
// ----------------------------------------------------------------------------
describe('分支钉板 · monitor 最新事件索引', () => {
  it('getLatestEventByType：不存在的类型返回 null；clear 后重置', () => {
    const monitor = new StateMonitor();
    assert.equal(monitor.getLatestEventByType('nope'), null);
    monitor.observe({ type: 'a', source: 's', data: { i: 1 }, severity: 'info' });
    monitor.observe({ type: 'a', source: 's', data: { i: 2 }, severity: 'info' });
    assert.equal((monitor.getLatestEventByType('a')?.data as { i: number }).i, 2);
    monitor.clear();
    assert.equal(monitor.getLatestEventByType('a'), null);
    assert.equal(monitor.getStatistics().total, 0, 'clear 重置累计总数');
  });
});

// ----------------------------------------------------------------------------
// task-lifecycle：断言模式的非法转移抛错分支
// ----------------------------------------------------------------------------
describe('分支钉板 · 转移表断言模式', () => {
  it('QUANTUM_ASSERT_INVARIANTS=1 时非法转移显式抛错（生产默认静默拒绝）', () => {
    const scheduler = new QuantumScheduler({});
    const agent = {
      id: 'a1',
      name: 'a1',
      type: 'developer' as const,
      capabilities: ['js'],
      state: 'idle' as const,
      load: 0,
      position: { x: 0, y: 0, z: 0 },
      quantumEntanglement: [],
      lastHeartbeat: new Date(),
    };
    scheduler.registerAgent(agent);
    const task = scheduler.submitTask({
      name: 'T',
      type: 'test',
      priority: 'medium' as const,
      requirements: [{ type: 'capability' as const, name: 'js', value: null, weight: 1 }],
      dependencies: [],
      estimatedDuration: 1,
      actualDuration: 0,
      status: 'pending' as const,
    });
    assert.equal(task.status, 'assigned');

    const prev = process.env.QUANTUM_ASSERT_INVARIANTS;
    process.env.QUANTUM_ASSERT_INVARIANTS = '1';
    try {
      // assigned → pending：非法回退——断言模式下必须显式抛错
      assert.throws(
        () => scheduler.updateTaskStatus(task.id, 'pending'),
        /Illegal task state transition/,
      );
    } finally {
      if (prev === undefined) delete process.env.QUANTUM_ASSERT_INVARIANTS;
      else process.env.QUANTUM_ASSERT_INVARIANTS = prev;
    }
    // 断言关闭（默认）：同一请求静默拒绝，状态不变
    scheduler.updateTaskStatus(task.id, 'pending');
    assert.equal(task.status, 'assigned');
    scheduler.shutdown();
  });
});

// ----------------------------------------------------------------------------
// 总线安全可观测：分类拒绝计数的全部新分支（真实 WS 往返，事件驱动等待）
// ----------------------------------------------------------------------------
describe('分支钉板 · 总线安全拒绝分类计数', () => {
  function openSocket(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  function waitForEvent<T>(
    bus: QuantumBus,
    name: string,
    predicate: (e: T) => boolean,
    timeoutMs = 3000,
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
        reject(new Error(`timeout waiting for '${name}'`));
      }, timeoutMs);
      bus.on(name, listener);
    });
  }

  it('非法频道（非字符串/超长）被拒并计入 invalidChannelRejections', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 't0k3n' } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      ws.send(JSON.stringify({ type: 'authenticate', agentId: 'ag1', token: 't0k3n' }));
      await waitForEvent<{ agentId: string }>(
        bus,
        'agent_authenticated',
        (e) => e.agentId === 'ag1',
      );

      // 非字符串频道（JSON 数字）
      ws.send(JSON.stringify({ type: 'subscribe', channel: 42 }));
      await waitForEvent<Record<string, unknown>>(bus, 'agent_subscribed', () => false).catch(
        () => undefined,
      );
      // 超长频道（>128）
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'x'.repeat(200) }));
      await new Promise((r) => setTimeout(r, 100));

      assert.equal(bus.getMetrics().security.invalidChannelRejections, 2, '两次非法频道各计一次');
      ws.close();
    } finally {
      bus.shutdown();
    }
  });

  it('已认证连接改绑身份 → 4001 断开 + identityRebindRejections', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 't0k3n' } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      ws.send(JSON.stringify({ type: 'authenticate', agentId: 'ag1', token: 't0k3n' }));
      await waitForEvent<{ agentId: string }>(
        bus,
        'agent_authenticated',
        (e) => e.agentId === 'ag1',
      );

      const closed = new Promise<number | undefined>((resolve) => {
        ws.once('close', (code: number) => resolve(code));
      });
      ws.send(JSON.stringify({ type: 'authenticate', agentId: 'ag2', token: 't0k3n' }));
      assert.equal(await closed, 4001, '身份重绑必须以 4001 断开');
      assert.equal(bus.getMetrics().security.identityRebindRejections, 1);
    } finally {
      bus.shutdown();
    }
  });

  it('畸形消息熔断：32 次不可解析帧后以 1008 断开', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      const closed = new Promise<number | undefined>((resolve) => {
        ws.once('close', (code: number) => resolve(code));
      });
      for (let i = 0; i < 32; i++) {
        ws.send('this-is-not-json-{{{{');
      }
      assert.equal(await closed, 1008, '熔断阈值到达后必须断开');
      assert.equal(bus.getMetrics().security.malformedDisconnects, 1);
    } finally {
      bus.shutdown();
    }
  });
});

// ----------------------------------------------------------------------------
// 平台层：dispose / 控制台命令类型透传 / deepMerge 深度上限
// ----------------------------------------------------------------------------
describe('分支钉板 · 平台生命周期与配置边界', () => {
  it('dispose() 解除全部跨组件监听（stop 只收尾运行态）', async () => {
    const { QuantumMultiAgentPlatform } = await import('../src/index.js');
    const platform = new QuantumMultiAgentPlatform({ communication: { port: 0 } });
    await platform.start();
    platform.stop();
    // stop 后组件仍有跨组件监听（设计如此——dispose 才解除）
    const afterStop =
      platform.agentManager.listenerCount('agent_registered') +
      platform.scheduler.listenerCount('task_assigned') +
      platform.quantumBus.listenerCount('console_query');
    assert.ok(afterStop > 0, 'stop 不解除监听（dispose 的存在理由）');
    platform.dispose();
    const afterDispose =
      platform.agentManager.listenerCount('agent_registered') +
      platform.scheduler.listenerCount('task_assigned') +
      platform.quantumBus.listenerCount('console_query') +
      platform.listenerCount('started');
    assert.equal(afterDispose, 0, 'dispose 后跨组件监听必须全部解除');
  });

  it('console_command submit_task 支持自定义 type（协议与 SDK 能力对齐）', async () => {
    const { QuantumMultiAgentPlatform } = await import('../src/index.js');
    const platform = new QuantumMultiAgentPlatform({ communication: { port: 0 } });
    platform.registerAgent({
      name: 'runner',
      type: 'custom',
      capabilities: ['data_pipeline'],
    });
    platform.quantumBus.emit('console_command', {
      connectionId: 'test',
      agentId: 'test',
      action: 'submit_task',
      payload: { name: 'Pipeline Task', type: 'data_pipeline' },
    });
    const task = platform.getTasks().find((t) => t.name === 'Pipeline Task');
    assert.ok(task, '任务已创建');
    assert.equal(task.type, 'data_pipeline', 'type 从载荷透传，不再硬编码 console');
    platform.dispose();
  });
});

// ----------------------------------------------------------------------------
// D-Wave 客户端：限流退避与 qp 解码推断的新分支
// ----------------------------------------------------------------------------
describe('分支钉板 · DWave 限流/重试/qp 解码', () => {
  it('429 携带 Retry-After：退避尊重服务端窗口后成功', async () => {
    const { DWaveBackend } = await import('../src/core/qpu/dwave-backend.js');
    let gets = 0;
    let retryAfterHonored = 0;
    let firstGetAt = 0;
    const { fetchImpl } = (() => {
      const fake = async (_input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === 'POST') {
          // 提交成功 → 进入轮询
          return new Response(JSON.stringify({ id: 'p1', status: 'PENDING' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        gets++;
        if (gets === 1) {
          firstGetAt = Date.now();
          return new Response('rate limited', {
            status: 429,
            headers: { 'Retry-After': '1' },
          });
        }
        retryAfterHonored = Date.now() - firstGetAt;
        return new Response(
          JSON.stringify({
            id: 'p1',
            status: 'COMPLETED',
            answer: { solutions: [], energies: [], num_occurrences: [] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      };
      return { fetchImpl: fake };
    })();

    const backend = new DWaveBackend({
      token: 't',
      endpoint: 'https://cloud.dwavesys.com/sapi/v2',
      solver: 'hybrid_x',
      fetch: fetchImpl,
    });
    const result = await backend.solveIsing([0, 0], new Map(), 2, {
      numReads: 1,
      timeoutMs: 30_000,
    });
    assert.ok(
      retryAfterHonored >= 900,
      `退避必须尊重 Retry-After≈1s（实际等待 ${retryAfterHonored}ms）`,
    );
    assert.equal(result.spins.length, 0);
  });

  it('轮询瞬态 5xx：单次退避重试后恢复', async () => {
    const { DWaveBackend } = await import('../src/core/qpu/dwave-backend.js');
    let polls = 0;
    const fake = async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'p2', status: 'PENDING' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      polls++;
      if (polls === 1) {
        return new Response('gateway hiccup', { status: 502 });
      }
      return new Response(
        JSON.stringify({
          id: 'p2',
          status: 'COMPLETED',
          answer: { solutions: [[1, -1]], energies: [-1], num_occurrences: [3] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const backend = new DWaveBackend({
      token: 't',
      endpoint: 'https://cloud.dwavesys.com/sapi/v2',
      fetch: fake,
    });
    const result = await backend.solveIsing([0, 0], new Map(), 2, {
      numReads: 3,
      timeoutMs: 60_000,
    });
    assert.deepEqual(result.spins, [[1, -1]]);
    assert.equal(polls, 2, '首次 502 退避重试一次后成功');
  });

  it('qp 压缩格式缺 num_solutions：按 energies 长度推断解数（幻影样本封印）', async () => {
    const { DWaveBackend } = await import('../src/core/qpu/dwave-backend.js');
    // 4 量子比特：bits=16，maxSolutions=4；energies 只报 1 条 → 只解 1 条
    const word = 0b0001; // q0 = -1
    const fake = async () =>
      new Response(
        JSON.stringify({
          id: 'p3',
          status: 'COMPLETED',
          answer: {
            format: 'qp',
            data: { vector: [word, 0] },
            energies: [-1],
            num_occurrences: [5],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const backend = new DWaveBackend({
      token: 't',
      endpoint: 'https://cloud.dwavesys.com/sapi/v2',
      fetch: fake,
    });
    const result = await backend.solveIsing([0, 0, 0, 0], new Map(), 4, { numReads: 5 });
    assert.equal(result.spins.length, 1, '解数按 energies 长度推断，不得全长解码出幻影样本');
    assert.deepEqual(result.spins[0], [-1, 1, 1, 1]);
  });
});
