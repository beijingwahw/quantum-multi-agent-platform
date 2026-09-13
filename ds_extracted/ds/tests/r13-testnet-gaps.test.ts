/**
 * R13 测试网缺口补齐（代理 K · 平台测试象限）。
 *
 * 本波位级同一优化里的缓存/索引/环形结构，四份钉测试（r13-kernel /
 * r13-market / r13-bus-qpu / r13-infra）钉住了「优化不改数值」，但部分
 * **失效/失步路径**（缓存该失效时不失效 → 陈旧值；环形指针跨界回绕 →
 * 错误驱逐或漏判）没有覆盖。本文件只补缺口、只加测试：
 *
 * - G1 限速环形窗口的**滑动**语义：部分重叠的两批（每批各自 ≤1000、
 *      合计 >1000、且先发批次未整体过期）必须断开。既有钉只覆盖
 *      「同步连发 1001 条」与「整窗过期后两批不误判」——一个过期
 *      时间戳永不逐条驱逐（窗口计数只按批重置）的陈旧实现两者都过。
 * - G2 环形指针回绕：head 推进到 900 后第二批从下标 900 写到 999 再
 *      回绕到 0——写指针跨界后窗口语义不得漂移（零误判）。
 * - G3 agent 路由索引「全拆 → 离线建桶 → 重连重建 → 冲刷」链路：
 *      既有钉只测「双连接拆一留一」；索引条目全部拆除后离线桶仍要
 *      正确建桶、新连接认证后经重建索引收到冲刷帧。
 * - G4 组播共享序列化的**在线**路径：两个在线目标收到字节相同的一帧
 *      （惰性序列化盒共享一份 JSON 字符串；既有钉只覆盖离线建桶面）。
 * - G5 computeEnergies 记忆化的**求解器级**失效：weights 变更后
 *      qaoaSolve/annealSolve 必须重算且与新鲜实例逐位一致；改回原值
 *      后与首次解逐位一致（指纹往返、无跨态污染）。既有失效钉在
 *      computeEnergies 层（A3#3 / 第二遍 C2），记忆化与求解级 scratch
 *      复用的互操作无钉。
 * - G6 fs-tools 沙箱前缀缓存的 win32 大小写形态：驱动器字母大小写
 *      翻转的沙箱内路径照常放行（前缀缓存的双形态声明；非 win32 跳过）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

import { QuantumBus } from '../src/communication/quantum-bus.js';
import {
  annealSolve,
  defaultPenalties,
  qaoaSolve,
  type AssignmentProblem,
} from '../src/core/quantum-optimizer.js';
import { read_file, setFsSandboxRoot } from '../src/tools/fs-tools.js';

// ----------------------------------------------------------------------------
// 总线测试原语（与 r13-bus-qpu 同款的最小本地副本——钉文件不跨文件共享 fixture）
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

/** 等待总线事件（谓词命中即收），超时拒绝 */
function waitForBusEvent<T>(
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
      reject(new Error(`timeout waiting for bus event '${name}'`));
    }, timeoutMs);
    bus.on(name, listener);
  });
}

/** 收集下一帧原始字符串（跳过 connection_ack）——字节级比对用 */
function nextRawFrame(ws: WebSocket, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('timeout waiting for frame'));
    }, timeoutMs);
    const onMessage = (data: WebSocket.RawData) => {
      const text = (data as Buffer).toString('utf8');
      if (text.includes('"connection_ack"')) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(text);
    };
    ws.on('message', onMessage);
  });
}

/** 心跳帧（发往离线 agent → 合法入队路径，不产生在线投递噪声） */
function heartbeatFrame(targetAgentId: string): string {
  return JSON.stringify({
    id: 'm',
    type: 'heartbeat',
    sourceAgentId: 'gaps-cli',
    targetAgentId,
    content: {},
    timestamp: new Date().toISOString(),
    priority: 'medium',
    quantumState: { id: 'q', amplitude: 1, phase: 0, collapsed: true },
  });
}

/** 轮询直到离线队列大小稳定（burst 全部被服务端处理完） */
async function waitQueueSettled(bus: QuantumBus, timeoutMs = 5000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let prev = -1;
  for (;;) {
    const size = bus.getMessageQueueSize();
    if (size === prev && size > 0) return size;
    if (Date.now() > deadline) return size;
    prev = size;
    await new Promise((r) => setTimeout(r, 30));
  }
}

/** 轮询直到限速计数器达到期望值（或超时返回当前值） */
async function waitRateDisconnects(
  bus: QuantumBus,
  expected: number,
  timeoutMs = 3000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (bus.getMetrics().security.rateLimitDisconnects < expected && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 20));
  }
  return bus.getMetrics().security.rateLimitDisconnects;
}

// ----------------------------------------------------------------------------
// G1/G2 · 每连接限速环形窗口
// ----------------------------------------------------------------------------

describe('R13 缺口 · 限速环形窗口的滑动语义与指针回绕', () => {
  it('G1 部分重叠两批（900 + 101，间隔 500ms < 窗口）合计超限 → 1008 断开', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      const frame = heartbeatFrame('gaps-rate-overlap');

      // 第一批 900 条（< 1000，全部合法入队）
      for (let i = 0; i < 900; i++) ws.send(frame);
      await waitQueueSettled(bus);
      assert.equal(bus.getMessageQueueSize(), 900, '前置：第一批全部入队');

      // 间隔 500ms：第一批时间戳全部仍在 1s 滑动窗内（未整体过期）。
      // 若实现把窗口当「按批重置」而非逐条驱逐过期时间戳，这里会漏判
      await new Promise((r) => setTimeout(r, 500));

      // 第二批 101 条：窗内合计 900+101=1001 > 1000 → 第 1001 条触发
      for (let i = 0; i < 101; i++) ws.send(frame);
      assert.equal(
        await waitRateDisconnects(bus, 1),
        1,
        '滑动窗内合计超限必须断开（窗口按逐条时间戳滑动，不按批重置）',
      );
      assert.equal(bus.getMessageQueueSize(), 1000, '超速前 1000 条照常入队');
      ws.close();
    } finally {
      bus.shutdown();
    }
  });

  it('G1 对照：900 + 50（间隔 500ms）合计 950 ≤ 1000 → 不断开', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      const frame = heartbeatFrame('gaps-rate-control');

      for (let i = 0; i < 900; i++) ws.send(frame);
      await waitQueueSettled(bus);
      await new Promise((r) => setTimeout(r, 500));
      for (let i = 0; i < 50; i++) ws.send(frame);
      await waitQueueSettled(bus);

      assert.equal(bus.getMetrics().security.rateLimitDisconnects, 0, '窗内合计未超限不得断开');
      assert.equal(bus.getMessageQueueSize(), 950);
      assert.equal(ws.readyState, WebSocket.OPEN, '连接保持打开');
      ws.close();
    } finally {
      bus.shutdown();
    }
  });

  it('G2 环形写指针回绕：两轮 900 条 × >1s 间隔（下标 900→999→0）零误判', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      const frame = heartbeatFrame('gaps-rate-wrap');

      for (let round = 0; round < 2; round++) {
        for (let i = 0; i < 900; i++) ws.send(frame);
        await waitQueueSettled(bus);
        // 全部时间戳整体过期（第二轮首条消息将 head 推进 900 → 写指针
        // 从 900 写到 999 后回绕到 0——跨 MAX_MESSAGES_PER_SECOND 边界）
        await new Promise((r) => setTimeout(r, 1050));
      }

      assert.equal(
        bus.getMetrics().security.rateLimitDisconnects,
        0,
        '指针回绕后窗口语义不得漂移（每轮 900 ≤ 1000，全程无超速）',
      );
      assert.equal(ws.readyState, WebSocket.OPEN);
      ws.close();
    } finally {
      bus.shutdown();
    }
  });
});

// ----------------------------------------------------------------------------
// G3 · agent 路由索引拆除 → 离线建桶 → 重连重建 → 冲刷
// ----------------------------------------------------------------------------

describe('R13 缺口 · 路由索引全拆后的离线建桶与重连冲刷', () => {
  it('G3 双连接全部关闭后：单播落离线桶，新连接认证后经重建索引收到冲刷帧', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const c1 = await openSocket(bus.getPort()!);
      authenticate(c1, 'ag-idx');
      await waitForBusEvent<{ agentId: string }>(
        bus,
        'agent_authenticated',
        (e) => e.agentId === 'ag-idx',
      );
      const c2 = await openSocket(bus.getPort()!);
      authenticate(c2, 'ag-idx');
      await waitForBusEvent<{ connectionId: string }>(
        bus,
        'agent_authenticated',
        (e) => e.connectionId !== '',
      );

      // 索引条目全部拆除：等连接数归零（close 由服务端异步处理）
      c1.close();
      c2.close();
      const deadline = Date.now() + 3000;
      while (bus.getConnectionCount() > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.equal(bus.getConnectionCount(), 0, '前置：两条连接均已拆除');
      assert.deepEqual(bus.getAgentsOnline(), []);

      // 拆除后单播 → 离线建桶（索引不残留已拆除条目导致的假投递）
      bus.createMessage('src', 'request', { seq: 7 }, 'ag-idx');
      assert.equal(bus.getMessageQueueSize(), 1, '离线桶正确建立');

      // 重连：索引重建 + 死前缀游标冲刷
      const c3 = await openSocket(bus.getPort()!);
      const flushed = nextRawFrame(c3);
      authenticate(c3, 'ag-idx');
      const raw = await flushed;
      const msg = JSON.parse(raw) as { type: string; content: { seq: number } };
      assert.equal(msg.type, 'request');
      assert.equal(msg.content.seq, 7, '冲刷帧必须是拆除期间入队的最新消息');
      assert.deepEqual(bus.getAgentsOnline(), ['ag-idx'], '索引按新连接重建');
      assert.equal(bus.getMessageQueueSize(), 0, '冲刷后桶出清');
      c3.close();
    } finally {
      bus.shutdown();
    }
  });
});

// ----------------------------------------------------------------------------
// G4 · 组播共享序列化的在线路径
// ----------------------------------------------------------------------------

describe('R13 缺口 · 组播共享序列化的在线投递', () => {
  it('G4 两个在线目标收到字节相同的一帧（惰性序列化盒只求值一次）', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const g1 = await openSocket(bus.getPort()!);
      authenticate(g1, 'mg-1');
      await waitForBusEvent<{ agentId: string }>(
        bus,
        'agent_authenticated',
        (e) => e.agentId === 'mg-1',
      );
      const g2 = await openSocket(bus.getPort()!);
      authenticate(g2, 'mg-2');
      await waitForBusEvent<{ agentId: string }>(
        bus,
        'agent_authenticated',
        (e) => e.agentId === 'mg-2',
      );

      const p1 = nextRawFrame(g1);
      const p2 = nextRawFrame(g2);
      bus.createMessage('src', 'request', { k: 'shared' }, undefined, ['mg-1', 'mg-2']);
      const [raw1, raw2] = await Promise.all([p1, p2]);

      // 字节级同一：共享一份 JSON 字符串；任一目标独享的改写（如按目标
      // 重排键序/改写内容）都会在此暴露
      assert.equal(raw1, raw2, '两个目标收到的必须是同一份序列化字节');
      assert.ok(raw1.includes('"shared"'));
      // 在线路径不产生离线残留
      assert.equal(bus.getMessageQueueSize(), 0);
      g1.close();
      g2.close();
    } finally {
      bus.shutdown();
    }
  });
});

// ----------------------------------------------------------------------------
// G5 · computeEnergies 记忆化的求解器级失效（指纹往返）
// ----------------------------------------------------------------------------

describe('R13 缺口 · 求解器级记忆化失效与指纹往返', () => {
  /** 固定罚项的问题：变更 weights 后 fresh 见证必须携带同一组罚项字段 */
  function baseProblem(weights: number[][]): AssignmentProblem {
    const p: AssignmentProblem = {
      taskIds: ['t0', 't1'],
      agentIds: ['a0', 'a1', 'a2'],
      weights,
      ineligible: weights.map((r) => r.map(() => false)),
      couplings: new Map(),
      penaltyOneHot: 0,
      penaltyCapacity: 0,
    };
    const pen = defaultPenalties(p);
    p.penaltyOneHot = pen.oneHot;
    p.penaltyCapacity = pen.capacity;
    return p;
  }

  const W_A = [
    [0.9, 0.1, 0.05],
    [0.8, 0.2, 0.1],
  ];
  const W_B = [
    [0.05, 0.1, 0.9],
    [0.1, 0.2, 0.8],
  ];

  it('G5 qaoaSolve：weights 变更即失效（与新鲜实例逐位一致），改回后与首次解逐位一致', () => {
    const cfg = { layers: 2, restarts: 2, select: 'argmax-valid' as const, seed: 42 };
    // 罚项对两组权重各取一份定值：变更 weights 后 fresh 见证用同一罚项
    const penA = defaultPenalties(baseProblem(W_A));
    const penB = defaultPenalties(baseProblem(W_B));
    const withPenalties = (
      w: number[][],
      pen: { oneHot: number; capacity: number },
    ): AssignmentProblem => {
      const p = baseProblem(w);
      p.penaltyOneHot = pen.oneHot;
      p.penaltyCapacity = pen.capacity;
      return p;
    };

    const mutated = withPenalties(W_A, penA); // 被原地变更的实例
    const solA = qaoaSolve(mutated, cfg);
    // 自对照：同内容新鲜实例与首解逐位一致（前提自证）
    assert.deepEqual(qaoaSolve(withPenalties(W_A, penA), cfg), solA);

    // 原地变更 weights（同一对象 → WeakMap 命中 → 指纹必须判失效）
    mutated.weights = W_B.map((row) => [...row]);
    mutated.penaltyOneHot = penB.oneHot;
    mutated.penaltyCapacity = penB.capacity;
    const solB = qaoaSolve(mutated, cfg);
    const freshB = qaoaSolve(withPenalties(W_B, penB), cfg);
    assert.deepEqual(solB, freshB, '变更后必须重算：与同内容新鲜实例逐位一致（陈旧缓存=旧能量表）');
    assert.notDeepEqual(
      solB.assignment,
      solA.assignment,
      '权重反转后分配必须改变（否则等价断言空转）',
    );

    // 指纹往返：改回原值 → 与首次解逐位一致（无跨态污染）
    mutated.weights = W_A.map((row) => [...row]);
    mutated.penaltyOneHot = penA.oneHot;
    mutated.penaltyCapacity = penA.capacity;
    assert.deepEqual(qaoaSolve(mutated, cfg), solA, '改回原指纹后与首次解逐位一致');
  });

  it('G5 annealSolve：同一失效契约在退火引擎上同样成立', () => {
    const cfg = {
      seed: 42,
      select: 'shots-best' as const,
      shots: 64,
      anneal: { tau: 20, steps: 60 },
    };
    const penA = defaultPenalties(baseProblem(W_A));
    const penB = defaultPenalties(baseProblem(W_B));
    const withPenalties = (
      w: number[][],
      pen: { oneHot: number; capacity: number },
    ): AssignmentProblem => {
      const p = baseProblem(w);
      p.penaltyOneHot = pen.oneHot;
      p.penaltyCapacity = pen.capacity;
      return p;
    };

    const mutated = withPenalties(W_A, penA);
    const solA = annealSolve(mutated, cfg);
    mutated.weights = W_B.map((row) => [...row]);
    mutated.penaltyOneHot = penB.oneHot;
    mutated.penaltyCapacity = penB.capacity;
    const solB = annealSolve(mutated, cfg);
    assert.deepEqual(solB, annealSolve(withPenalties(W_B, penB), cfg), '退火同样必须重算');
    assert.notDeepEqual(solB.assignment, solA.assignment);
    mutated.weights = W_A.map((row) => [...row]);
    mutated.penaltyOneHot = penA.oneHot;
    mutated.penaltyCapacity = penA.capacity;
    assert.deepEqual(annealSolve(mutated, cfg), solA, '退火指纹往返逐位一致');
  });
});

// ----------------------------------------------------------------------------
// G6 · fs-tools 沙箱前缀缓存的 win32 大小写形态
// ----------------------------------------------------------------------------

describe('R13 缺口 · 沙箱前缀缓存的大小写形态（win32）', () => {
  it('G6 驱动器字母大小写翻转的沙箱内路径照常放行', async (t) => {
    if (process.platform !== 'win32') {
      t.skip('drive-letter case forms only exist on win32');
      return;
    }
    const root = mkdtempSync(join(tmpdir(), 'r13-gaps-sandbox-'));
    try {
      writeFileSync(join(root, 'case.txt'), 'CASE', 'utf8');
      await setFsSandboxRoot(root);
      assert.equal(await read_file('case.txt'), 'CASE', '前置：原形态可读');

      // 翻转驱动器字母大小写：win32 下比对两侧都走小写形态——
      // 只缓存单一形态前缀串的实现会误拒（假越界）
      const flipped = root.replace(/^([A-Za-z])/, (m) =>
        m === m.toUpperCase() ? m.toLowerCase() : m.toUpperCase(),
      );
      assert.notEqual(flipped, root, '前置：确实翻转了大小写');
      assert.equal(
        await read_file(join(flipped, 'case.txt')),
        'CASE',
        '大小写翻转的沙箱内路径必须放行（前缀缓存的双形态语义）',
      );
    } finally {
      await setFsSandboxRoot(process.cwd());
      rmSync(root, { recursive: true, force: true });
    }
  });
});
