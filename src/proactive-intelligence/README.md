# 主动智能插件 (Proactive Intelligence Plugin)

## 📖 概述

主动智能插件是一个强大的自主感知、智能决策、主动干预系统，能够：

- **自主感知**：自动监控系统状态和用户行为
- **智能决策**：基于规则引擎和上下文自动判断何时执行操作
- **主动干预**：无需用户显式触发，在合适时机自动行动
- **安全可控**：明确的权限边界、审计日志和安全模式

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────┐
│              主动智能插件架构                              │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  状态监控器   │  │  决策引擎     │  │  执行器      │  │
│  │ (Observer)   │  │ (Brain)      │  │ (Executor)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                 │           │
│         ▼                 ▼                 ▼           │
│  ┌──────────────────────────────────────────────┐     │
│  │         规则引擎 + 机器学习模型               │     │
│  └──────────────────────────────────────────────┘     │
│         │                 │                 │           │
│         ▼                 ▼                 ▼           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  事件总线     │  │  审计日志     │  │  策略配置    │  │
│  │ (Event Bus)  │  │ (Audit Log)  │  │ (Policy)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 1. 安装

```bash
npm install proactive-intelligence
```

### 2. 基础使用

```typescript
import {
  ProactiveIntelligencePlugin,
  Rule
} from 'proactive-intelligence';

// 创建插件实例
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    enabled: true,
    safeMode: false, // 安全模式：只记录不执行
    maxConcurrentActions: 5
  }
});

// 添加规则
const rule: Rule = {
  id: 'cpu-high',
  name: 'CPU使用率过高',
  description: 'CPU超过80%时警告',
  enabled: true,
  priority: 100,
  cooldown: 60000,
  conditions: [
    {
      type: 'event',
      operator: 'greaterThan',
      field: 'system_metrics.cpu',
      value: 80
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: 'CPU警告',
        message: 'CPU使用率超过80%',
        level: 'warning'
      }
    }
  ]
};

plugin.addRule(rule);

// 启动插件
await plugin.start();

// 观察事件
plugin.observe({
  type: 'system_metrics',
  source: 'monitor',
  severity: 'warning',
  data: {
    cpu: 85,
    memory: { total: 8192, used: 6000, available: 2192 }
  }
});
```

### 3. 使用预设规则

```typescript
import {
  ProactiveIntelligencePlugin
} from 'proactive-intelligence';
import {
  allPresetRules,
  getRulesByScenario
} from 'proactive-intelligence/rules';

const plugin = new ProactiveIntelligencePlugin();

// 添加所有预设规则
for (const rule of allPresetRules) {
  plugin.addRule(rule);
}

// 或按场景添加
const systemRules = getRulesByScenario('system');
for (const rule of systemRules) {
  plugin.addRule(rule);
}

await plugin.start();
```

## 📚 核心概念

### 1. 事件 (Event)

事件是系统的基本输入单位，包含：

```typescript
interface MonitorEvent {
  id: string;              // 唯一标识
  type: string;            // 事件类型
  source: string;          // 事件源
  timestamp: Date;         // 时间戳
  data: any;               // 事件数据
  severity: 'info' | 'warning' | 'error' | 'critical';
}
```

### 2. 规则 (Rule)

规则定义了何时触发以及执行什么动作：

```typescript
interface Rule {
  id: string;              // 唯一标识
  name: string;            // 规则名称
  description: string;     // 规则描述
  enabled: boolean;        // 是否启用
  priority: number;        // 优先级（越大越高）
  cooldown: number;        // 冷却时间（毫秒）
  conditions: Condition[]; // 条件列表
  actions: Action[];       // 动作列表
  lastExecuted?: Date;     // 最后执行时间
}
```

### 3. 条件 (Condition)

条件用于评估是否满足触发条件：

```typescript
interface Condition {
  type: 'event' | 'state' | 'time';
  operator: 'equals' | 'notEquals' | 'contains' |
            'notContains' | 'greaterThan' | 'lessThan' |
            'between' | 'matches';
  field: string;           // 字段路径
  value: any;              // 比较值
  logicalOperator?: 'AND' | 'OR';
}
```

**条件类型说明：**

- **event**: 从事件数据中提取值
- **state**: 从当前系统状态中提取值
- **time**: 时间相关条件（小时、星期、工作时间等）
- （组合语义由 `conditions[]` + `logicalOperator` 链式表达，无独立条件类型）

**运算符说明：**

- `equals`: 等于
- `notEquals`: 不等于
- `contains`: 包含
- `notContains`: 不包含
- `greaterThan`: 大于
- `lessThan`: 小于
- `between`: 在范围内
- `matches`: 正则匹配

### 4. 动作 (Action)

动作定义了触发后要执行的操作：

```typescript
interface Action {
  type: 'command' | 'notification' | 'workflow' | 'custom';
  name: string;            // 动作名称
  parameters: any;         // 参数
  timeout?: number;        // 超时时间
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}
```

**动作类型说明：**

- **command**: 执行命令
- **notification**: 发送通知
- **workflow**: 执行工作流
- **custom**: 自定义处理器

## 🎯 预设规则库

插件提供了丰富的预设规则，按场景分类：

### 系统监控

- `cpu-high-usage`: CPU使用率过高
- `memory-low`: 内存不足
- `disk-low-space`: 磁盘空间不足

### Agent管理

- `agent-offline`: Agent离线检测
- `agent-overloaded`: Agent过载检测

### 任务调度

- `task-timeout`: 任务超时检测
- `task-retry`: 失败任务重试

### 安全监控

- `suspicious-login`: 异常登录检测
- `privilege-escalation`: 权限提升检测

### 业务逻辑

- `auto-scale-up`: 自动扩容
- `auto-scale-down`: 自动缩容
- `backup-reminder`: 定期备份提醒

使用预设规则：

```typescript
import {
  allPresetRules,
  getRulesByScenario
} from 'proactive-intelligence/rules';

// 获取所有预设规则
const allRules = allPresetRules;

// 按场景获取
const systemRules = getRulesByScenario('system');
const securityRules = getRulesByScenario('security');
```

## 🔧 高级特性

### 1. 安全模式

安全模式只记录动作而不实际执行，适合测试：

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    safeMode: true  // 只记录不执行
  }
});
```

### 2. 权限控制

通过配置限制允许和阻止的动作：

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    allowedActions: ['notification', 'workflow'],
    blockedActions: ['command:*']
  }
});
```

### 3. 并发控制

限制同时执行的动作数量：

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    maxConcurrentActions: 10
  }
});
```

### 4. 动态规则管理

运行时添加、删除、启用/禁用规则：

```typescript
// 添加规则
plugin.addRule(rule);

// 删除规则
plugin.removeRule(ruleId);

// 启用/禁用规则
plugin.getEngine().toggleRule(ruleId, false);
plugin.getEngine().toggleRule(ruleId, true);
```

### 5. 审计日志

所有动作执行都有完整的历史记录：

```typescript
// 获取执行历史
const history = plugin.getExecutor().getExecutionHistory({
  ruleId: 'cpu-high-usage',
  status: 'completed',
  since: new Date(Date.now() - 3600000)
});

// 获取决策历史
const decisions = plugin.getEngine().getDecisionHistory(100);
```

## 📊 监控和指标

插件提供详细的监控指标：

```typescript
// 获取统计信息
const stats = plugin.getStatistics();

console.log(stats);
// {
//   monitor: { total: 100, byType: {...}, ... },
//   engine: {
//     totalEventsProcessed: 100,
//     totalDecisionsMade: 5,
//     totalActionsExecuted: 10,
//     averageDecisionTime: 15.2,
//     rulesTriggered: { 'cpu-high-usage': 3 }
//   },
//   executor: { running: 2, history: 10 },
//   running: true
// }
```

## 🔌 集成DSH

插件可以无缝集成DSH工具：

```typescript
const dshRule: Rule = {
  id: 'dsh-disk-scan',
  name: 'DSH磁盘扫描',
  description: '使用DSH工具扫描磁盘',
  enabled: true,
  priority: 80,
  cooldown: 300000,
  conditions: [
    {
      type: 'event',
      operator: 'greaterThan',
      field: 'disk.usage',
      value: 85
    }
  ],
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
      type: 'workflow',
      name: 'dsh_nuke_clean',
      parameters: {
        workflowId: 'dsh-nuke-clean',
        parameters: {
          strategy: 'balanced'
        }
      }
    }
  ]
};
```

## 🎨 自定义动作处理器

可以注册自定义动作处理器：

```typescript
plugin.getExecutor().on('action_started', (execution) => {
  console.log(`动作开始: ${execution.action.type}.${execution.action.name}`);
});

plugin.on('action_completed', (execution) => {
  console.log(`动作完成: ${execution.action.type}.${execution.action.name}`);
});

plugin.on('action_failed', (execution) => {
  console.error(`动作失败: ${execution.error?.message}`);
});
```

## 📝 最佳实践

### 1. 规则设计

- **优先级合理**: 紧急规则优先级高（90-100），普通规则适中（50-70）
- **冷却时间**: 避免频繁触发，建议60秒以上
- **条件清晰**: 使用明确的字段路径和运算符
- **动作幂等**: 动作应该可以安全重复执行

### 2. 安全考虑

- **使用安全模式**: 测试时先启用安全模式
- **权限限制**: 配置allowedActions和blockedActions
- **审计日志**: 启用审计日志追踪所有操作
- **超时设置**: 为动作设置合理的超时时间

### 3. 性能优化

- **缓冲区大小**: 根据事件量调整maxBufferSize
- **事件保留**: 设置合理的retentionMs避免内存占用过高
- **并发控制**: 根据系统资源调整maxConcurrentActions

### 4. 监控告警

- **规则监控**: 定期检查规则触发频率
- **指标监控**: 监控决策时间、执行时间等指标
- **历史分析**: 定期分析决策历史优化规则

## 🧪 测试和调试

### 1. 运行示例

```bash
npm run example:proactive
```

### 2. 安全模式测试

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: { safeMode: true }
});

// 执行动作，但不会真正执行
plugin.observe({ ... });
```

### 3. 事件追踪

```typescript
plugin.on('event', (event) => {
  console.log('收到事件:', event);
});

plugin.on('rule_triggered', (rule) => {
  console.log('规则触发:', rule.name);
});

plugin.on('action_completed', (execution) => {
  console.log('动作完成:', execution.result);
});
```

## 🚦 常见问题

### Q: 如何防止规则频繁触发？

A: 设置合理的`cooldown`冷却时间，例如：

```typescript
const rule: Rule = {
  // ...
  cooldown: 60000  // 1分钟冷却
};
```

### Q: 如何在测试时不执行真实动作？

A: 启用安全模式：

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: { safeMode: true }
});
```

### Q: 如何限制某些动作的执行？

A: 配置权限策略：

```typescript
const plugin = new ProactiveIntelligencePlugin({
  executor: {
    allowedActions: ['notification', 'workflow'],
    blockedActions: ['command:dangerous']
  }
});
```

### Q: 如何查看规则为什么没有触发？

A: 检查：

1. 规则是否启用
2. 条件是否满足
3. 是否在冷却期内
4. 事件格式是否正确

## 📖 API 文档

### ProactiveIntelligencePlugin

主插件类，提供完整的功能。

#### 方法

- `start()`: 启动插件
- `stop()`: 停止插件
- `addRule(rule)`: 添加规则
- `removeRule(ruleId)`: 删除规则
- `observe(event)`: 观察事件
- `getStatistics()`: 获取统计信息
- `getMonitor()`: 获取监控器
- `getEngine()`: 获取决策引擎
- `getExecutor()`: 获取执行器

### StateMonitor

状态监控器，负责收集和管理事件。

#### 方法

- `observe(event)`: 观察事件
- `getEvents(filter)`: 获取事件历史
- `getStatistics()`: 获取统计信息
- `clear()`: 清空事件缓冲区

### DecisionEngine

决策引擎，负责评估规则和做出决策。

#### 方法

- `addRule(rule)`: 添加规则
- `removeRule(ruleId)`: 删除规则
- `getRule(ruleId)`: 获取规则
- `getAllRules()`: 获取所有规则
- `toggleRule(ruleId, enabled)`: 启用/禁用规则
- `makeDecision(context)`: 做决策
- `getMetrics()`: 获取指标
- `getDecisionHistory(limit)`: 获取决策历史

### ActionExecutor

执行器，负责执行动作。

#### 方法

- `executeAction(ruleId, action)`: 执行动作
- `getRunningExecutions()`: 获取运行中的执行
- `getExecutionHistory(filter)`: 获取执行历史
- `cancelExecution(executionId)`: 取消执行
- `updateConfig(config)`: 更新配置
- `getConfig()`: 获取配置

## 🔗 相关资源

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [量子多Agent平台](./README.md)
- [DSH插件开发指南](./deepseek-harness-plugin-guide.md)

## 📄 许可证

MIT License

---

**主动智能插件 - 让系统更智能，让运维更轻松！** 🚀