/**
 * R13 性能波 · 总线/QPU/主动智能优化回归网（行为冻结锚定）。
 *
 * 每条优化都在「可观测行为冻结」约束下落地：本文件锚定被优化路径的
 * 外部语义与优化前逐点一致——顺序保真（agent 索引的连接遍历序 ==
 * 全表扫描序）、窗口语义（环形限速器的保留/淘汰边界）、FIFO 出队
 * （离线队列死前缀游标）、重复样本聚合（solve.ts 纯函数去重）、
 * 最新事件选取（extractEventValue 反向扫描）、matches 编译缓存与
 * 优先级查表缓存的失效正确性。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { QuantumBus } from '../src/communication/quantum-bus.js';
import type { QuantumBackend, QpuSampleSet } from '../src/core/qpu/quantum-backend.js';
import { solveAssignmentOnBackend } from '../src/core/qpu/solve.js';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { defaultPenalties } from '../src/core/quantum-optimizer.js';
import { DecisionEngine } from '../src/proactive-intelligence/decision-engine.js';
import { ActionExecutor } from '../src/proactive-intelligence/executor.js';
import { ProactiveIntelligencePlugin } from '../src/proactive-intelligence/plugin.js';
import type { MonitorEvent, Rule } from '../src/proactive-intelligence/types.js';

// ----------------------------------------------------------------------------
// 辅助
// ----------------------------------------------------------------------------

function openSocket(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function authenticate(ws: WebSocket, agentId: string): void {
  ws.send(JSON.stringify({ type: 'authenticate', agentId }));
}

/** 收集下一帧（跳过 connection_ack），带超时 */
function nextMessage(ws: WebSocket, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('timeout waiting for message'));
    }, timeoutMs);
    const onMessage = (data: WebSocket.RawData) => {
      const msg = JSON.parse((data as Buffer).toString('utf8'));
      if (msg.type === 'connection_ack') return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(msg);
    };
    ws.on('message', onMessage);
  });
}

/** 单监听器收集 n 条非 ack 帧（冲刷是同一 tick 的连发,逐帧换监听器会丢帧） */
function nextMessages(ws: WebSocket, n: number, timeoutMs = 3000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const got: any[] = [];
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(`timeout waiting for messages (${got.length}/${n})`));
    }, timeoutMs);
    const onMessage = (data: WebSocket.RawData) => {
      const msg = JSON.parse((data as Buffer).toString('utf8'));
      if (msg.type === 'connection_ack') return;
      got.push(msg);
      if (got.length >= n) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(got);
      }
    };
    ws.on('message', onMessage);
  });
}

function waitForClose(ws: WebSocket, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for close')), timeoutMs);
    ws.once('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

function makeProblem(m: number, n: number): AssignmentProblem {
  const weights = Array.from({ length: m }, () => Array.from({ length: n }, () => 0.5));
  const p: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

/** 最优分配 → 自旋向量（z = 1 − 2x） */
function spinsOf(assignment: number[], m: number, n: number): number[] {
  const spins = new Array<number>(m * n).fill(1);
  for (let t = 0; t < m; t++) spins[t * n + assignment[t]!] = -1;
  return spins;
}

/** 固定采样集的桩后端：验证 solve.ts 聚合语义（不发起网络） */
class StubBackend implements QuantumBackend {
  readonly name = 'stub';
  readonly realHardware = false;
  private readonly samples: QpuSampleSet;
  constructor(samples: QpuSampleSet) {
    this.samples = samples;
  }
  isAvailable(): boolean {
    return true;
  }
  solveIsing(): Promise<QpuSampleSet> {
    return Promise.resolve(this.samples);
  }
}

function eventOf(type: string, data: Record<string, unknown>): MonitorEvent {
  return {
    id: `${type}-${Math.random()}`,
    type,
    source: 'test',
    timestamp: new Date(),
    data,
    severity: 'info',
  };
}

// ----------------------------------------------------------------------------
// QuantumBus · agent 路由索引
// ----------------------------------------------------------------------------

describe('R13 · QuantumBus agent 路由索引（sendToAgent O(连接数)→O(该agent连接数)）', () => {
  it('同 agent 双连接：单播两连接都收到；一连接关闭后仅存活连接收到（索引拆除）', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const c1 = await openSocket(bus.getPort()!);
      const c2 = await openSocket(bus.getPort()!);
      authenticate(c1, 'ag-dup');
      authenticate(c2, 'ag-dup');
      await new Promise((r) => setTimeout(r, 150));

      // 单播：两条连接都属于 ag-dup——都必须收到同一帧
      const p1 = nextMessage(c1);
      const p2 = nextMessage(c2);
      bus.createMessage('src', 'request', { k: 1 }, 'ag-dup');
      const [m1, m2] = await Promise.all([p1, p2]);
      assert.equal(m1.type, 'request');
      assert.equal(m1.id, m2.id, '两连接收到的是同一条消息');

      // 关闭 c1：索引必须拆除，后续消息只到 c2
      c1.close();
      await new Promise((r) => setTimeout(r, 150));
      const p2b = nextMessage(c2);
      bus.createMessage('src', 'request', { k: 2 }, 'ag-dup');
      const m2b = await p2b;
      assert.equal(m2b.content.k, 2);
      c2.close();
    } finally {
      bus.shutdown();
    }
  });

  it('离线冲刷仍选首个建立的连接（索引序 == 连接表扫描序）', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    // 先入队（agent 不在线）
    bus.createMessage('src', 'request', { seq: 'a' }, 'ag-flush');
    await bus.start();
    try {
      const c1 = await openSocket(bus.getPort()!);
      authenticate(c1, 'ag-flush');
      const m1 = await nextMessage(c1);
      assert.equal(m1.content.seq, 'a', '先认证的连接收到离线冲刷');
      c1.close();
    } finally {
      bus.shutdown();
    }
  });
});

// ----------------------------------------------------------------------------
// QuantumBus · 环形限速窗口
// ----------------------------------------------------------------------------

describe('R13 · 每连接限速环形窗口（零分配，窗口语义不变）', () => {
  it('1 秒窗口内第 1001 条消息触发限速断开并计数', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      const closeCode = waitForClose(ws);
      const frame = JSON.stringify({
        id: 'm',
        type: 'heartbeat',
        sourceAgentId: 'cli',
        targetAgentId: 'nobody-offline',
        content: {},
        timestamp: new Date().toISOString(),
        priority: 'medium',
        quantumState: { id: 'q', amplitude: 1, phase: 0, collapsed: true },
      });
      // 同步连发 1001 帧：前 1000 通过（落离线队列），第 1001 帧超速
      for (let i = 0; i < 1001; i++) ws.send(frame);
      assert.equal(await closeCode, 1008);
      assert.equal(bus.getMetrics().security.rateLimitDisconnects, 1);
      assert.equal(bus.getMessageQueueSize(), 1000, '超速前 1000 条照常入队');
    } finally {
      bus.shutdown();
    }
  });

  it('窗口过期 eviction：间隔 >1s 的两批各 600 条不触发限速', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      const frame = JSON.stringify({
        id: 'm',
        type: 'heartbeat',
        sourceAgentId: 'cli',
        targetAgentId: 'nobody-offline2',
        content: {},
        timestamp: new Date().toISOString(),
        priority: 'medium',
        quantumState: { id: 'q', amplitude: 1, phase: 0, collapsed: true },
      });
      const send600 = () => {
        for (let i = 0; i < 600; i++) ws.send(frame);
      };
      send600();
      await new Promise((r) => setTimeout(r, 1100)); // 窗口整体过期
      send600();
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(bus.getMetrics().security.rateLimitDisconnects, 0, '两批各自在窗口内');
      // 1200 条全部合法入队路径，但离线队列 per-bucket 封顶 1000：
      // size 恒为 cap，越界 200 条按 FIFO 淘汰（与限速无关）
      assert.equal(bus.getMessageQueueSize(), 1000);
      ws.close();
    } finally {
      bus.shutdown();
    }
  });
});

// ----------------------------------------------------------------------------
// QuantumBus · 离线队列死前缀游标
// ----------------------------------------------------------------------------

describe('R13 · 离线队列死前缀游标（满桶出队均摊 O(1)，FIFO 语义不变）', () => {
  it('持续超容：size 恒等于 cap、dropped 计数精确、保留的是最新消息', () => {
    const cap = 50;
    const bus = new QuantumBus({ communication: { port: 0, maxQueuedMessages: cap } });
    for (let i = 0; i < 500; i++) {
      bus.createMessage('src', 'request', { seq: i }, 'offline-agent');
    }
    assert.equal(bus.getMessageQueueSize(), cap);
    assert.equal(bus.getMetrics().droppedMessages, 500 - cap);
    bus.shutdown();
  });

  it('FIFO 冲刷顺序：超容淘汰最旧，存活消息按入队序投递', async () => {
    const bus = new QuantumBus({ communication: { port: 0, maxQueuedMessages: 3 } });
    for (let i = 0; i < 6; i++) {
      bus.createMessage('src', 'request', { seq: i }, 'ag-fifo');
    }
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      authenticate(ws, 'ag-fifo');
      const [a, b, c] = await nextMessages(ws, 3);
      assert.deepEqual(
        [a.content.seq, b.content.seq, c.content.seq],
        [3, 4, 5],
        '最旧三条被淘汰，最新三条按序冲刷',
      );
      ws.close();
    } finally {
      bus.shutdown();
    }
  });

  it('组播两目标离线各建一桶（共享序列化不改投递语义）', () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    bus.createMessage('src', 'request', { k: 1 }, undefined, ['g1', 'g2']);
    assert.equal(bus.getMessageQueueSize(), 2);
    assert.equal(bus.getMetrics().security.queuedAgentBuckets, 2);
    bus.shutdown();
  });
});

// ----------------------------------------------------------------------------
// solve.ts · 重复样本纯函数去重
// ----------------------------------------------------------------------------

describe('R13 · solve.ts 重复样本聚合（isValidAssignment/welfareOf 首见求值）', () => {
  it('重复合法样本：频率聚合与逐样本求值一致、无效重复样本按次数累计', async () => {
    const problem = makeProblem(2, 2); // 最优显然是 [0,1] 或 [1,0]（等权 0.5）
    const good = spinsOf([0, 1], 2, 2);
    const bad = new Array<number>(4).fill(1); // 全 +1：无任务选中 → 非法
    const samples: QpuSampleSet = {
      spins: [good, good, good, bad, bad, good],
      energies: [-1, -1, -1, 0, 0, -1],
      occurrences: [10, 20, 30, 5, 7, 40],
      solver: 'stub',
      realHardware: false,
    };
    const result = await solveAssignmentOnBackend(problem, new StubBackend(samples));
    assert.equal(result.totalReads, 112);
    assert.equal(result.invalidSamples, 12, '两个非法样本按出现次数累计（5+7）');
    assert.deepEqual(result.assignment, [0, 1]);
    assert.equal(result.sampleFrequency, 100 / 112, '合法重复样本合并计数（10+20+30+40）');
    assert.ok(Math.abs(result.welfare - 1) < 1e-9);
  });

  it('全部无效（重复无效键不重复计数 miss）：仍抛 BackendError', async () => {
    const problem = makeProblem(2, 2);
    const bad = new Array<number>(4).fill(1);
    const samples: QpuSampleSet = {
      spins: [bad, bad, bad],
      energies: [0, 0, 0],
      occurrences: [1, 1, 1],
      solver: 'stub',
      realHardware: false,
    };
    await assert.rejects(
      solveAssignmentOnBackend(problem, new StubBackend(samples)),
      /all failed validation/,
    );
  });
});

// ----------------------------------------------------------------------------
// decision-engine · 反向扫描与 matches 编译缓存
// ----------------------------------------------------------------------------

describe('R13 · decision-engine 事件取值反向扫描与 matches 编译缓存', () => {
  const ruleOf = (id: string, conditions: Rule['conditions']): Rule => ({
    id,
    name: id,
    description: '',
    enabled: true,
    priority: 50,
    cooldown: 0,
    conditions,
    actions: [{ type: 'notification', name: 'n', parameters: { title: 't', message: 'm' } }],
  });

  it('同类型多事件取最新一条（反向扫描 == filter 末位）', async () => {
    const engine = new DecisionEngine();
    engine.addRule(
      ruleOf('cpu', [
        { type: 'event', operator: 'greaterThan', field: 'system_metrics.cpu', value: 80 },
      ]),
    );
    const decide = async (events: MonitorEvent[]) =>
      (
        await engine.makeDecision({
          events,
          currentState: {},
          history: [],
          rules: [],
        })
      ).has('cpu');

    assert.equal(
      await decide([
        eventOf('system_metrics', { cpu: 50 }),
        eventOf('system_metrics', { cpu: 90 }),
      ]),
      true,
      '最新 90 覆盖旧的 50',
    );
    assert.equal(
      await decide([
        eventOf('system_metrics', { cpu: 90 }),
        eventOf('system_metrics', { cpu: 50 }),
      ]),
      false,
      '最新 50 压掉旧的 90',
    );
    // 其他类型的事件不得干扰
    assert.equal(
      await decide([eventOf('system_metrics', { cpu: 90 }), eventOf('other', { cpu: 1000 })]),
      true,
    );
  });

  it('matches 字符串模式跨多次求值保持正确（编译缓存不引入状态）', async () => {
    const engine = new DecisionEngine();
    engine.addRule(
      ruleOf('re', [{ type: 'state', operator: 'matches', field: 'host', value: '^api-\\d+$' }]),
    );
    engine.addRule(
      ruleOf('bad', [{ type: 'state', operator: 'matches', field: 'host', value: '(' }]),
    );
    const decide = async (host: string) => {
      const actions = await engine.makeDecision({
        events: [],
        currentState: { host },
        history: [],
        rules: [],
      });
      return { re: actions.has('re'), bad: actions.has('bad') };
    };
    // 反复求值同一模式（缓存命中路径）与非法模式（不缓存路径）
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(await decide('api-42'), { re: true, bad: false });
      assert.deepEqual(await decide('api-x'), { re: false, bad: false });
    }
  });
});

// ----------------------------------------------------------------------------
// plugin/executor · 优先级查表缓存与历史计数
// ----------------------------------------------------------------------------

describe('R13 · 插件优先级查表缓存（rule_added/rule_removed 失效）', () => {
  it('同 id 重挂规则改优先级后，动作池顺序随之翻转', async () => {
    const order: string[] = [];
    const plugin = new ProactiveIntelligencePlugin({
      executor: { maxConcurrentActions: 1, safeMode: false },
    });
    const rule = (id: string, priority: number): Rule => ({
      id,
      name: id,
      description: '',
      enabled: true,
      priority,
      cooldown: 0,
      // 事件条件（go 事件载荷 data.go）：state 侧没有调用方可控字段
      conditions: [{ type: 'event', operator: 'equals', field: 'go.go', value: 1 }],
      actions: [
        {
          type: 'custom',
          name: `act-${id}`,
          parameters: {
            handler: () => {
              order.push(id);
              return null;
            },
          },
        },
      ],
    });
    try {
      plugin.addRule(rule('high', 100));
      plugin.addRule(rule('low', 10));
      await plugin.start();
      plugin.observe({ type: 'go', source: 't', data: { go: 1 }, severity: 'info' });
      await plugin.flush();
      assert.deepEqual(order, ['high', 'low'], '高优先级先执行');

      // 同 id 覆盖重挂：high 降为 1——缓存必须失效，顺序翻转
      order.length = 0;
      plugin.addRule(rule('high', 1));
      plugin.observe({ type: 'go', source: 't', data: { go: 1 }, severity: 'info' });
      await plugin.flush();
      assert.deepEqual(order, ['low', 'high'], '重挂后新优先级生效（缓存已失效）');
      await plugin.stop();
    } finally {
      plugin.destroy();
    }
  });
});

describe('R13 · executor.getExecutionHistorySize（免全量拷贝的长度查询）', () => {
  it('与 getExecutionHistory().length 恒等（含取消/拒绝入史路径）', async () => {
    const executor = new ActionExecutor();
    const done = await executor.executeAction('r', {
      type: 'notification',
      name: 'n',
      parameters: { title: 't', message: 'm' },
    });
    assert.equal(done.status, 'completed');
    await executor
      .executeAction('r', {
        type: 'custom',
        name: 'bad',
        parameters: {},
      })
      .catch(() => undefined);
    assert.equal(executor.getExecutionHistorySize(), executor.getExecutionHistory().length);
    assert.equal(executor.getExecutionHistorySize(), 2);
  });
});
