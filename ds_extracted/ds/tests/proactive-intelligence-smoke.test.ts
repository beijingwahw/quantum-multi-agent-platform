/**
 * 主动智能插件 - 冒烟测试
 *
 * 覆盖插件基础生命周期与配置面（深度回归见 proactive-intelligence.test.ts）
 */

import { it } from 'node:test';
import type { Rule } from '../src/proactive-intelligence/index.js';
import { ProactiveIntelligencePlugin } from '../src/proactive-intelligence/index.js';
// ============================================================================

// 测试1: 创建插件实例
it('创建插件实例', async () => {
  const plugin = new ProactiveIntelligencePlugin();
  if (!plugin) {
    throw new Error('插件创建失败');
  }
});

// 测试2: 启动和停止插件
it('启动和停止插件', async () => {
  const plugin = new ProactiveIntelligencePlugin();
  await plugin.start();

  const stats = plugin.getStatistics();
  if (!stats.running) {
    throw new Error('插件未启动');
  }

  await plugin.stop();
});

// 测试3: 添加规则
it('添加规则', async () => {
  const plugin = new ProactiveIntelligencePlugin();

  const rule: Rule = {
    id: 'test-rule',
    name: '测试规则',
    description: '测试规则描述',
    enabled: true,
    priority: 50,
    cooldown: 1000,
    conditions: [
      {
        type: 'event',
        operator: 'equals',
        field: 'test.value',
        value: 'trigger',
      },
    ],
    actions: [
      {
        type: 'notification',
        name: 'test-notification',
        parameters: {
          title: '测试',
          message: '测试消息',
          level: 'info',
        },
      },
    ],
  };

  plugin.addRule(rule);

  const rules = plugin.getEngine().getAllRules();
  if (rules.length !== 1) {
    throw new Error('规则数量不正确');
  }
});

// 测试4: 删除规则
it('删除规则', async () => {
  const plugin = new ProactiveIntelligencePlugin();

  const rule: Rule = {
    id: 'test-rule-2',
    name: '测试规则2',
    description: '测试规则描述2',
    enabled: true,
    priority: 50,
    cooldown: 1000,
    conditions: [
      {
        type: 'event',
        operator: 'equals',
        field: 'test.value',
        value: 'trigger',
      },
    ],
    actions: [
      {
        type: 'notification',
        name: 'test-notification',
        parameters: {
          title: '测试',
          message: '测试消息',
          level: 'info',
        },
      },
    ],
  };

  plugin.addRule(rule);
  const deleted = plugin.removeRule('test-rule-2');

  if (!deleted) {
    throw new Error('规则删除失败');
  }

  const rules = plugin.getEngine().getAllRules();
  if (rules.length !== 0) {
    throw new Error('规则未删除');
  }
});

// 测试5: 观察事件
it('观察事件', async () => {
  const plugin = new ProactiveIntelligencePlugin();

  const event = plugin.observe({
    type: 'test',
    source: 'test-source',
    severity: 'info',
    data: { value: 'test' },
  });

  if (!event.id) {
    throw new Error('事件没有ID');
  }

  if (!event.timestamp) {
    throw new Error('事件没有时间戳');
  }
});

// 测试6: 获取事件历史
it('获取事件历史', async () => {
  const plugin = new ProactiveIntelligencePlugin();

  plugin.observe({
    type: 'test',
    source: 'test-source',
    severity: 'info',
    data: { value: 'test1' },
  });

  plugin.observe({
    type: 'test',
    source: 'test-source',
    severity: 'warning',
    data: { value: 'test2' },
  });

  const events = plugin.getMonitor().getEvents();
  if (events.length !== 2) {
    throw new Error('事件数量不正确');
  }
});

// 测试7: 获取统计信息
it('获取统计信息', async () => {
  const plugin = new ProactiveIntelligencePlugin();

  plugin.observe({
    type: 'test',
    source: 'test-source',
    severity: 'info',
    data: { value: 'test' },
  });

  const stats = plugin.getStatistics();

  if (!stats.monitor) {
    throw new Error('统计信息缺少monitor');
  }

  if (!stats.engine) {
    throw new Error('统计信息缺少engine');
  }

  if (!stats.executor) {
    throw new Error('统计信息缺少executor');
  }
});

// 测试8: 规则触发（安全模式）
it('规则触发（安全模式）', async () => {
  const plugin = new ProactiveIntelligencePlugin({
    executor: {
      safeMode: true, // 只记录不执行
    },
  });

  const rule: Rule = {
    id: 'test-rule-3',
    name: '测试规则3',
    description: '测试规则描述3',
    enabled: true,
    priority: 50,
    cooldown: 1000,
    conditions: [
      {
        type: 'event',
        operator: 'equals',
        field: 'test.value',
        value: 'trigger',
      },
    ],
    actions: [
      {
        type: 'notification',
        name: 'test-notification',
        parameters: {
          title: '测试',
          message: '测试消息',
          level: 'info',
        },
      },
    ],
  };

  plugin.addRule(rule);
  await plugin.start();

  let ruleTriggered = false;
  plugin.on('rule_triggered', () => {
    ruleTriggered = true;
  });

  plugin.observe({
    type: 'test',
    source: 'test-source',
    severity: 'info',
    data: { value: 'trigger' },
  });

  await sleep(200);

  if (!ruleTriggered) {
    throw new Error('规则未触发');
  }

  await plugin.stop();
});

// 测试9: 启用/禁用规则
it('启用/禁用规则', async () => {
  const plugin = new ProactiveIntelligencePlugin();

  const rule: Rule = {
    id: 'test-rule-4',
    name: '测试规则4',
    description: '测试规则描述4',
    enabled: true,
    priority: 50,
    cooldown: 1000,
    conditions: [
      {
        type: 'event',
        operator: 'equals',
        field: 'test.value',
        value: 'trigger',
      },
    ],
    actions: [
      {
        type: 'notification',
        name: 'test-notification',
        parameters: {
          title: '测试',
          message: '测试消息',
          level: 'info',
        },
      },
    ],
  };

  plugin.addRule(rule);

  // 禁用规则
  plugin.getEngine().toggleRule('test-rule-4', false);
  let rules = plugin.getEngine().getAllRules();
  if (rules[0]!.enabled) {
    throw new Error('规则未禁用');
  }

  // 启用规则
  plugin.getEngine().toggleRule('test-rule-4', true);
  rules = plugin.getEngine().getAllRules();
  if (!rules[0]!.enabled) {
    throw new Error('规则未启用');
  }
});

// 测试10: 事件过滤
it('事件过滤', async () => {
  const plugin = new ProactiveIntelligencePlugin();

  plugin.observe({
    type: 'type1',
    source: 'source1',
    severity: 'info',
    data: { value: 'test1' },
  });

  plugin.observe({
    type: 'type2',
    source: 'source1',
    severity: 'warning',
    data: { value: 'test2' },
  });

  plugin.observe({
    type: 'type1',
    source: 'source2',
    severity: 'error',
    data: { value: 'test3' },
  });

  // 按类型过滤
  const type1Events = plugin.getMonitor().getEvents({ type: 'type1' });
  if (type1Events.length !== 2) {
    throw new Error('类型过滤失败');
  }

  // 按严重性过滤
  const warningEvents = plugin.getMonitor().getEvents({ severity: 'warning' });
  if (warningEvents.length !== 1) {
    throw new Error('严重性过滤失败');
  }
});

// 测试11: 决策指标
it('决策指标', async () => {
  const plugin = new ProactiveIntelligencePlugin();

  const metrics = plugin.getEngine().getMetrics();

  if (typeof metrics.totalEventsProcessed !== 'number') {
    throw new Error('指标类型不正确');
  }

  if (typeof metrics.totalDecisionsMade !== 'number') {
    throw new Error('指标类型不正确');
  }
});

// 测试12: 执行器配置
it('执行器配置', async () => {
  const plugin = new ProactiveIntelligencePlugin({
    executor: {
      enabled: true,
      safeMode: true,
      maxConcurrentActions: 5,
      allowedActions: ['notification'],
      blockedActions: ['command'],
    },
  });

  const config = plugin.getExecutor().getConfig();

  if (config.maxConcurrentActions !== 5) {
    throw new Error('并发配置不正确');
  }

  if (!config.safeMode) {
    throw new Error('安全模式配置不正确');
  }
});

// 辅助函数
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
