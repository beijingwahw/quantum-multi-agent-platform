/**
 * R8-D 第三轮加固回归（communication / proactive-intelligence / tools / dsh）
 *
 * 三个修复的回归钉：
 * 1. between [5, Infinity] 上界此前被 toNumber 的严格有限性拒绝 → 条件恒假，
 *    预设规则 highCpuUsageRule 整体判死（QUICKSTART 的 5 事件演练永不触发）；
 * 2. validateWorkdir 拼硬编码 '/' 分隔符 → win32 上 resolve 产出反斜杠路径，
 *    前缀比对恒假，任何 workdir（含根自身）都被误判越界——沙箱特性整体失效；
 * 3. 总线 validateMessage 不校验目标字段形状 → 数字 targetAgentIds 直达
 *    离线队列建桶（Map<string,…> 键类型破坏，数字桶永不投递的静默垃圾），
 *    非数组目标以裸 TypeError 击穿路由、被误计入「解析失败」桶。
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import {
  DecisionEngine,
  ProactiveIntelligencePlugin,
} from '../src/proactive-intelligence/index.js';
import { highCpuUsageRule } from '../src/proactive-intelligence/rules.js';
import type { MonitorEvent, Rule } from '../src/proactive-intelligence/index.js';
import {
  configureCommandPolicy,
  execute_command_argv,
  getCommandPolicy,
  resetCommandPolicy,
} from '../src/tools/system-tools.js';
import { QuantumBus } from '../src/communication/quantum-bus.js';
import { ToolError, SecurityViolationError } from '../src/utils/errors.js';

// ----------------------------------------------------------------------------
// 修复 1：between 的 ±Infinity 边界是合法规则语义
// ----------------------------------------------------------------------------

describe('R8-D · between 无穷边界（预设规则判死修复）', () => {
  function betweenRule(value: readonly [number, number]): Rule {
    return {
      id: 'between-rule',
      name: 'between',
      description: '',
      enabled: true,
      priority: 50,
      cooldown: 0,
      conditions: [{ type: 'state', operator: 'between', field: 'n', value }],
      actions: [{ type: 'notification', name: 'n', parameters: { title: 't', message: 'm' } }],
    };
  }

  async function decide(engine: DecisionEngine, n: unknown): Promise<boolean> {
    const actions = await engine.makeDecision({
      events: [] as MonitorEvent[],
      currentState: { n },
      history: [],
      rules: [],
    });
    return actions.has('between-rule');
  }

  it('[5, Infinity] 上界：≥5 命中、<4 不命中（含边界 5）', async () => {
    const engine = new DecisionEngine();
    engine.addRule(betweenRule([5, Infinity]));
    assert.equal(await decide(engine, 5), true, '边界下限 5 含端点');
    assert.equal(await decide(engine, 7), true, 'Infinity 上界不再使条件恒假');
    assert.equal(await decide(engine, 4), false, '下界之下仍不命中');
    assert.equal(await decide(engine, undefined), false, '缺失值不参与比较（口径不变）');
  });

  it('[-Infinity, 5] 下界与有限区间 [5, 10] 的合法邻居语义不变', async () => {
    const lower = new DecisionEngine();
    lower.addRule(betweenRule([-Infinity, 5]));
    assert.equal(await decide(lower, -100), true, '-Infinity 下界放行负值');
    assert.equal(await decide(lower, 6), false);

    const finite = new DecisionEngine();
    finite.addRule(betweenRule([5, 10]));
    assert.equal(await decide(finite, 5), true, '有限区间含端点');
    assert.equal(await decide(finite, 10), true);
    assert.equal(await decide(finite, 11), false);
  });

  it('预设规则 highCpuUsageRule 端到端：第 5 个 system_metrics 事件触发告警', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    plugin.addRule(highCpuUsageRule);
    await plugin.start();

    const observeCpu = (): void => {
      plugin.observe({
        type: 'system_metrics',
        source: 'monitor',
        severity: 'warning',
        data: { cpu: 85, memory: { total: 8192, used: 6000, available: 2192 } },
      });
    };

    // 4 个事件：byType.system_metrics = 4 < 5 → 不触发
    for (let i = 0; i < 4; i++) observeCpu();
    await plugin.flush();
    assert.equal(
      plugin.getEngine().getMetrics().rulesTriggered['cpu-high-usage'],
      undefined,
      '事件数不足 5 不应触发',
    );

    // 第 5 个事件：cpu=85 > 80 且 byType 计数达 5 → 触发（QUICKSTART 演练路径）
    observeCpu();
    await plugin.flush();
    assert.equal(plugin.getEngine().getMetrics().rulesTriggered['cpu-high-usage'], 1);
    assert.ok(
      plugin
        .getExecutor()
        .getExecutionHistory()
        .some(
          (e) =>
            e.ruleId === 'cpu-high-usage' &&
            e.status === 'completed' &&
            e.action.type === 'notification',
        ),
      '告警通知动作应真实执行完成',
    );

    await plugin.stop();
  });
});

// ----------------------------------------------------------------------------
// 修复 2：workdir 沙箱在 win32 上整体失效（硬编码 '/' 分隔符）
// ----------------------------------------------------------------------------

describe('R8-D · workdir 沙箱跨平台前缀比对', () => {
  afterEach(() => {
    resetCommandPolicy();
  });

  it('根目录等值与根内子目录放行，根外拒绝且指名被拒值', async () => {
    const root = await mkdtemp(join(tmpdir(), 'r8d-workdir-'));
    const sub = join(root, 'sub');
    await mkdir(sub);

    configureCommandPolicy({ workdirRoot: root });

    // 根自身等值放行（此前连根都被误判越界）
    const atRoot = await execute_command_argv('echo', ['root-ok'], root);
    assert.equal(atRoot.trim(), 'root-ok');
    // 根内子目录放行（win32 上反斜杠前缀比对此前恒假）
    const atSub = await execute_command_argv('echo', ['sub-ok'], sub);
    assert.equal(atSub.trim(), 'sub-ok');

    // 根外拒绝：错误指名被拒的 workdir 与允许根（错误分类 Taxonomy）
    await assert.rejects(
      () => execute_command_argv('echo', ['escape'], tmpdir()),
      (error: unknown) =>
        error instanceof ToolError &&
        error.message.includes('outside the allowed root') &&
        error.message.includes(tmpdir()) &&
        error.message.includes(root),
    );
  });
});

// ----------------------------------------------------------------------------
// R12：getCommandPolicy「只读视图」不得是活引用
// ----------------------------------------------------------------------------

describe('R12 · getCommandPolicy 只读快照（防写穿）', () => {
  afterEach(() => {
    resetCommandPolicy();
  });

  it('视图上的白名单 push / 字段改写必须被冻结挡下，不得写穿策略闸门', async () => {
    const view = getCommandPolicy();

    // 旧实现返回内部 policy 引用：push 静默把 'node' 写进白名单，
    // 命令安全闸门被绕过（Readonly<CommandPolicy> 的类型承诺是谎言）
    assert.throws(
      () => (view.allowedPrograms as string[]).push('node'),
      TypeError,
      '冻结视图上的数组变异必须抛错',
    );
    assert.throws(
      () => {
        (view as { timeoutMs: number }).timeoutMs = 1;
      },
      TypeError,
      '冻结视图上的字段赋值必须抛错',
    );

    // 策略状态未被写穿：node 仍在白名单外，执行闸门照常拒绝
    // （程序白名单拒绝是 SecurityViolationError，不进 ToolError 包装层）
    assert.ok(!getCommandPolicy().allowedPrograms.includes('node'));
    await assert.rejects(
      () => execute_command_argv('node', ['--version']),
      (error: unknown) =>
        error instanceof SecurityViolationError &&
        error.message.includes('not in the allowed list'),
    );

    // 合法邻位：视图仍如实反映当前策略（只读消费方零影响）
    assert.ok(getCommandPolicy().allowedPrograms.includes('echo'));
  });
});

// ----------------------------------------------------------------------------
// 修复 3：总线消息目标字段形状校验（数字建桶 / 非数组 TypeError 误分类）
// ----------------------------------------------------------------------------

describe('R8-D · QuantumBus 消息目标形状边界', () => {
  const buses: QuantumBus[] = [];

  function openSocket(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

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

  afterEach(() => {
    for (const bus of buses) bus.shutdown();
  });

  it('数字/非数组 targetAgentIds 被无效格式丢弃：不建桶、不击穿路由', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 'secret' } });
    buses.push(bus);
    await bus.start();

    const queued: unknown[] = [];
    bus.on('message_queued', (e: { agentId: unknown }) => queued.push(e.agentId));

    const ws = await openSocket(bus.getPort()!);
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-1', token: 'secret' }));
    await waitForBusEvent(
      bus,
      'agent_authenticated',
      (e: { agentId: string }) => e.agentId === 'agent-1',
    );

    const wireMessage = (overrides: Record<string, unknown>): string =>
      JSON.stringify({
        id: `m-${Math.random().toString(36).slice(2)}`,
        type: 'status_update',
        sourceAgentId: 'agent-1',
        content: {},
        timestamp: new Date().toISOString(),
        priority: 'medium',
        quantumState: {
          id: 'q',
          amplitude: 1,
          phase: 0,
          collapsed: true,
          position: { x: 0, y: 0, z: 0 },
        },
        ...overrides,
      });

    // 攻击载荷 1：数字目标的组播——此前为 42 建永不投递的数字键桶
    ws.send(wireMessage({ targetAgentIds: [42] }));
    // 同连接有序：紧随的合法单播排队事件到达时，前一帧必然已被处理
    ws.send(wireMessage({ targetAgentId: 'agent-9' }));
    await waitForBusEvent(
      bus,
      'message_queued',
      (e: { agentId: unknown }) => e.agentId === 'agent-9',
    );

    assert.deepEqual(queued, ['agent-9'], '数字目标不得建桶/发排队事件');
    assert.equal(bus.getMetrics().security.queuedAgentBuckets, 1, '仅合法单播占用一个桶');

    // 攻击载荷 2：非数组 targetAgentIds——此前 forEach 以裸 TypeError
    // 击穿 processMessage，被误计入「消息解析失败」桶；修复后按无效
    // 格式丢弃，且连接与后续流量不受影响
    ws.send(wireMessage({ targetAgentIds: 'not-an-array' }));
    ws.send(wireMessage({ targetAgentId: 'agent-10' }));
    await waitForBusEvent(
      bus,
      'message_queued',
      (e: { agentId: unknown }) => e.agentId === 'agent-10',
    );

    assert.deepEqual(queued, ['agent-9', 'agent-10'], '畸形目标帧不产生排队副作用');
    assert.equal(bus.getMetrics().security.queuedAgentBuckets, 2);
    assert.equal(bus.getConnectionCount(), 1, '畸形目标帧不得断开或击穿连接处理');

    ws.close();
  });

  it('合法组播的合法邻居语义不变（多目标离线各入队）', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    // 出站路径同口径：合法字符串数组目标照常建桶（与 quantum-bus.test 的
    // createMessage 契约一致），形状校验只拦垃圾不拦合法流量
    bus.createMessage('src', 'request', {}, undefined, ['g1', 'g2']);
    assert.equal(bus.getMetrics().security.queuedAgentBuckets, 2);
    assert.equal(bus.getMessageQueueSize(), 2);
  });
});
