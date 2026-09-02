# 主动智能插件 - 快速入门指南

## 5分钟快速开始

### 步骤1: 安装

```bash
npm install dsh-proactive-intelligence
```

### 步骤2: 基础代码

```typescript
import { ProactiveIntelligencePlugin } from 'dsh-proactive-intelligence';

// 创建插件
const plugin = new ProactiveIntelligencePlugin();

// 启动
await plugin.start();

// 监控事件
plugin.observe({
  type: 'test',
  source: 'demo',
  severity: 'info',
  data: { message: 'Hello World' }
});
```

### 步骤3: 添加规则

```typescript
plugin.addRule({
  id: 'my-rule',
  name: '我的第一条规则',
  description: '当收到test事件时触发',
  enabled: true,
  priority: 50,
  cooldown: 1000,
  conditions: [{
    type: 'event',
    operator: 'equals',
    field: 'test.message',
    value: 'trigger'
  }],
  actions: [{
    type: 'notification',
    name: 'alert',
    parameters: {
      title: '规则触发！',
      message: '我的规则被触发了',
      level: 'info'
    }
  }]
});
```

### 步骤4: 测试

```typescript
// 触发规则
plugin.observe({
  type: 'test',
  source: 'demo',
  severity: 'info',
  data: { message: 'trigger' }
});

// 监听结果
plugin.on('action_completed', (exec) => {
  console.log('动作完成:', exec.result);
});
```

## 10分钟进阶：使用预设规则

### 加载预设规则

```typescript
import { ProactiveIntelligencePlugin } from 'dsh-proactive-intelligence';
import { allPresetRules } from 'dsh-proactive-intelligence/rules';

const plugin = new ProactiveIntelligencePlugin();

// 添加所有预设规则
allPresetRules.forEach(rule => plugin.addRule(rule));

await plugin.start();
```

### 系统监控示例

```typescript
// 模拟CPU使用率上升
for (let i = 0; i < 6; i++) {
  plugin.observe({
    type: 'system_metrics',
    source: 'monitor',
    severity: 'warning',
    data: {
      cpu: 85 + Math.random() * 10,
      memory: { total: 8192, used: 7000, available: 1192 }
    }
  });
  await sleep(100);
}
```

### 监听所有事件

```typescript
plugin.on('event', (event) => {
  console.log('收到事件:', event.type, event.severity);
});

plugin.on('rule_triggered', (rule) => {
  console.log('规则触发:', rule.name);
});

plugin.on('action_completed', (exec) => {
  console.log('动作完成:', exec.action.name);
});
```

## 15分钟进阶：集成DSH工具

### 配置DSH集成

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    allowedActions: ['command', 'notification', 'workflow']
  }
});

// 创建DSH集成规则
plugin.addRule({
  id: 'dsh-disk-check',
  name: 'DSH磁盘检查',
  description: '使用DSH工具检查磁盘',
  enabled: true,
  priority: 80,
  cooldown: 300000,
  conditions: [{
    type: 'event',
    operator: 'greaterThan',
    field: 'disk.usage',
    value: 85
  }],
  actions: [
    {
      type: 'command',
      name: 'dsh_nuke_scan',
      parameters: {
        command: 'dsh',
        args: ['nuke', 'scan']
      }
    },
    {
      type: 'notification',
      name: 'send_result',
      parameters: {
        title: 'DSH扫描完成',
        message: '已执行磁盘扫描',
        level: 'info'
      }
    }
  ]
});
```

### 触发DSH规则

```typescript
plugin.observe({
  type: 'disk',
  source: 'fs_monitor',
  severity: 'warning',
  data: {
    usage: 88,
    path: '/data'
  }
});
```

## 30分钟进阶：自定义复杂规则

### 多条件组合

```typescript
plugin.addRule({
  id: 'complex-rule',
  name: '复杂条件规则',
  description: '工作时间 + CPU高 + 内存低',
  enabled: true,
  priority: 90,
  cooldown: 120000,
  conditions: [
    {
      type: 'time',
      operator: 'equals',
      field: 'isBusinessHours',
      value: true,
      logicalOperator: 'AND'
    },
    {
      type: 'event',
      operator: 'greaterThan',
      field: 'system_metrics.cpu',
      value: 80,
      logicalOperator: 'AND'
    },
    {
      type: 'event',
      operator: 'lessThan',
      field: 'system_metrics.memory.available',
      value: 1024,
      logicalOperator: 'AND'
    }
  ],
  actions: [{
    type: 'workflow',
    name: 'emergency_response',
    parameters: {
      workflowId: 'emergency-scale',
      parameters: {
        direction: 'up',
        instances: 3
      }
    }
  }]
});
```

### 自定义动作处理器

```typescript
plugin.getExecutor().on('command_executing', (cmd) => {
  console.log('执行命令:', cmd.command, cmd.args);
});

plugin.on('notification_sent', (notif) => {
  console.log('发送通知:', notif.title);
});

plugin.on('workflow_started', (wf) => {
  console.log('启动工作流:', wf.workflowId);
});
```

## 常见使用场景

### 场景1: 自动清理

```typescript
plugin.addRule({
  id: 'auto-cleanup',
  name: '自动清理',
  conditions: [{
    type: 'event',
    operator: 'greaterThan',
    field: 'disk.usage',
    value: 90
  }],
  actions: [{
    type: 'workflow',
    name: 'cleanup',
    parameters: {
      workflowId: 'nuke-clean',
      parameters: { strategy: 'aggressive' }
    }
  }]
});
```

### 场景2: 自动重启

```typescript
plugin.addRule({
  id: 'auto-restart',
  name: '自动重启',
  conditions: [{
    type: 'event',
    operator: 'equals',
    field: 'agent.state',
    value: 'offline'
  }],
  actions: [{
    type: 'workflow',
    name: 'restart',
    parameters: {
      workflowId: 'agent-restart',
      parameters: { maxRetries: 3 }
    }
  }]
});
```

### 场景3: 定期备份

```typescript
plugin.addRule({
  id: 'daily-backup',
  name: '每日备份',
  conditions: [
    {
      type: 'time',
      operator: 'equals',
      field: 'hour',
      value: 2,
      logicalOperator: 'AND'
    },
    {
      type: 'time',
      operator: 'notEquals',
      field: 'isWeekend',
      value: true
    }
  ],
  actions: [{
    type: 'workflow',
    name: 'backup',
    parameters: {
      workflowId: 'backup',
      parameters: { type: 'full' }
    }
  }]
});
```

## 调试技巧

### 1. 使用安全模式

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: { safeMode: true }  // 只记录不执行
});
```

### 2. 查看统计信息

```typescript
setInterval(() => {
  console.log('统计:', plugin.getStatistics());
}, 5000);
```

### 3. 查看事件历史

```typescript
const events = plugin.getMonitor().getEvents({
  type: 'system_metrics',
  since: new Date(Date.now() - 3600000)
});
console.log('最近1小时的事件:', events);
```

### 4. 查看决策历史

```typescript
const decisions = plugin.getEngine().getDecisionHistory(10);
console.log('最近10次决策:', decisions);
```

### 5. 查看执行历史

```typescript
const history = plugin.getExecutor().getExecutionHistory({
  status: 'failed'
});
console.log('失败的动作:', history);
```

## 性能优化

### 1. 调整缓冲区大小

```typescript
const plugin = new ProactiveIntelligencePlugin({
  monitor: {
    maxBufferSize: 5000,      // 减少内存占用
    retentionMs: 1800000      // 30分钟保留
  }
});
```

### 2. 限制并发动作

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    maxConcurrentActions: 5   // 减少并发
  }
});
```

### 3. 优化规则

```typescript
// 使用精确的条件
conditions: [{
  type: 'event',
  operator: 'equals',
  field: 'system_metrics.cpu',  // 具体路径
  value: 80
}]

// 设置合理的冷却时间
cooldown: 60000  // 避免频繁触发
```

## 安全建议

### 1. 始终从安全模式开始

```typescript
// 测试时
const testPlugin = new ProactiveIntelligencePlugin({
  executor: { safeMode: true }
});

// 生产环境
const prodPlugin = new ProactiveIntelligencePlugin({
  executor: {
    safeMode: false,
    allowedActions: ['notification', 'workflow']
  }
});
```

### 2. 限制危险动作

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    blockedActions: [
      'command:rm',
      'command:delete',
      'command:shutdown'
    ]
  }
});
```

### 3. 启用审计日志

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    auditLogEnabled: true
  }
});

// 定期导出日志
const history = plugin.getExecutor().getExecutionHistory();
saveToDatabase(history);
```

## 下一步

- 📖 阅读[完整文档](./README.md)
- 🎯 查看[更多示例](./examples.ts)
- 🔧 了解[预设规则](./rules.ts)
- 🚀 探索[DSH集成](../deepseek-harness-plugin-guide.md)

## 获取帮助

- 🐛 报告问题: [GitHub Issues](https://github.com/deepseek-ai/deepseek-harness/issues)
- 💬 讨论: [Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)
- 📚 文档: [DSH官方文档](https://github.com/deepseek-ai/deepseek-harness)

---

**开始使用主动智能插件，让系统更智能！** 🚀