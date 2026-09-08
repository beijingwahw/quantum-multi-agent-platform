# 主动智能插件 - 项目总览

## 📍 插件在项目中的位置

```
quantum-multi-agent-platform/
├── src/
│   ├── core/                          # 核心模块
│   │   ├── agent-manager.ts           # Agent管理器
│   │   ├── quantum-scheduler.ts       # 量子调度器
│   │   └── （quantum/subspace 优化器等，见 README.md 目录结构）

│   ├── tools/                         # 工具集成
│   │   └── agent-tools.ts             # Agent工具
│   │
│   ├── types/                         # 类型定义
│   │   └── quantum-types.ts           # 量子类型
│   │
│   ├── communication/                 # 通信模块
│   │   └── quantum-bus.ts
│   │
│   └── proactive-intelligence/        # 🆕 主动智能插件
│       ├── plugin.ts                  # ProactiveIntelligencePlugin 主类
│       ├── monitor.ts                 # 状态监控器 StateMonitor
│       ├── decision-engine.ts         # 决策引擎 DecisionEngine
│       ├── executor.ts                # 执行器 ActionExecutor
│       ├── rules.ts                   # 预设规则库（13 条预设规则）
│       ├── brain.ts                   # GrowthSchedulerBrain 桥接
│       ├── types.ts                   # 共享类型
│       ├── index.ts                   # 公共 API 导出桶
│       ├── cordis.patch.yml           # Cordis集成
│       ├── README.md                  # 完整文档
│       └── QUICKSTART.md              # 快速入门
│
├── scripts/                           # bench / 性能测试 / DSH 安装脚本
│   └── dsh-proactive-install-to-dsh.mjs
├── deepseek-harness-plugin-guide.md   # DSH插件开发指南
├── PROACTIVE-INTELLIGENCE.md          # 主动智能插件完整文档
├── README.md                          # 项目主文档
└── package.json                       # 项目包配置
```

## 🎯 插件与现有系统的集成

### 1. 与AgentManager集成

```typescript
import { AgentManager } from './core/agent-manager';
import { ProactiveIntelligencePlugin } from './proactive-intelligence';

// 创建Agent管理器
const agentManager = new AgentManager(config);

// 创建主动智能插件
const proactive = new ProactiveIntelligencePlugin();

// 添加Agent监控规则
proactive.addRule({
  id: 'agent-monitor',
  name: 'Agent监控',
  conditions: [{
    type: 'event',
    operator: 'equals',
    field: 'agent.state',
    value: 'offline'
  }],
  actions: [{
    type: 'workflow',
    name: 'restart-agent',
    parameters: {
      workflowId: 'agent-restart',
      parameters: { maxRetries: 3 }
    }
  }]
});

// 监听Agent事件
agentManager.on('agent_state_changed', (event) => {
  proactive.observe({
    type: 'agent',
    source: 'agent_manager',
    severity: 'warning',
    data: event
  });
});
```

### 2. 与QuantumScheduler集成

```typescript
import { QuantumScheduler } from './core/quantum-scheduler';
import { ProactiveIntelligencePlugin } from './proactive-intelligence';

const scheduler = new QuantumScheduler(config);
const proactive = new ProactiveIntelligencePlugin();

// 添加任务监控规则
proactive.addRule({
  id: 'task-monitor',
  name: '任务监控',
  conditions: [{
    type: 'event',
    operator: 'equals',
    field: 'task.status',
    value: 'failed'
  }],
  actions: [{
    type: 'workflow',
    name: 'retry-task',
    parameters: {
      workflowId: 'task-retry',
      parameters: { backoffStrategy: 'exponential' }
    }
  }]
});

// 监听任务事件
scheduler.on('task_completed', (event) => {
  proactive.observe({
    type: 'task',
    source: 'quantum_scheduler',
    severity: event.success ? 'info' : 'error',
    data: event
  });
});
```

### 3. 与DSH工具集成

```typescript
import { ProactiveIntelligencePlugin } from './proactive-intelligence';

const proactive = new ProactiveIntelligencePlugin({
  executor: {
    allowedActions: ['command', 'notification', 'workflow']
  }
});

// 添加DSH工具规则
proactive.addRule({
  id: 'dsh-disk-monitor',
  name: 'DSH磁盘监控',
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
      type: 'workflow',
      name: 'dsh_nuke_clean',
      parameters: {
        workflowId: 'dsh-nuke-clean',
        parameters: { strategy: 'balanced' }
      }
    }
  ]
});

// 监听DSH事件
// (通过事件总线或直接调用)
```

## 🔄 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                     数据流向图                                │
└─────────────────────────────────────────────────────────────┘

外部事件源
    │
    ├─→ 系统监控 (CPU, 内存, 磁盘)
    ├─→ Agent状态 (在线, 离线, 负载)
    ├─→ 任务事件 (创建, 完成, 失败)
    ├─→ 安全事件 (登录, 权限)
    └─→ DSH工具 (nuke, agent-tools)
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│              主动智能插件 (ProactiveIntelligence)             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐                                           │
│  │ StateMonitor │ ← 接收所有事件                            │
│  └──────────────┘                                           │
│         │                                                   │
│         ↓ observe(event)                                    │
│  ┌──────────────┐                                           │
│  │DecisionEngine│ ← 评估规则，做出决策                      │
│  └──────────────┘                                           │
│         │                                                   │
│         ↓ makeDecision()                                    │
│  ┌──────────────┐                                           │
│  │ActionExecutor│ ← 执行动作                               │
│  └──────────────┘                                           │
│         │                                                   │
│         ↓ executeAction()                                   │
└─────────────────────────────────────────────────────────────┘
         │
         ├─→ 通知 (Notification)
         ├─→ 命令 (Command)
         ├─→ 工作流 (Workflow)
         └─→ 自定义 (Custom)
                │
                ▼
        ┌──────────────────┐
        │   外部系统响应    │
        │  - DSH工具       │
        │  - Agent管理器   │
        │  - 调度器        │
        │  - 通知服务      │
        └──────────────────┘
```

## 📊 架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                   应用层 (Application Layer)                  │
│  - 用户界面                                                  │
│  - API接口                                                   │
│  - 外部集成                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   业务层 (Business Layer)                    │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ AgentManager     │  │ QuantumScheduler │                 │
│  │ - Agent生命周期   │  │ - 任务调度       │                 │
│  │ - 状态管理       │  │ - 资源分配       │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │    ProactiveIntelligencePlugin 🆕                  │       │
│  │    - 事件监控                                     │       │
│  │    - 规则评估                                     │       │
│  │    - 自动执行                                     │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   核心层 (Core Layer)                        │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ QuantumBus       │  │ DSHIntegration   │                 │
│  │ - 消息路由       │  │ - 工具执行       │                 │
│  │ - 事件广播       │  │ - 工作流运行     │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   工具层 (Tool Layer)                        │
│  - nuke工具 (磁盘清理)                                       │
│  - agent-tools (Agent操作)                                   │
│  - workflow工具 (工作流引擎)                                 │
│  - 其他DSH工具                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   基础设施层 (Infrastructure Layer)            │
│  - 文件系统                                                  │
│  - 网络通信                                                  │
│  - 进程管理                                                  │
│  - 日志系统                                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🔗 关键依赖关系

### 依赖的模块

```typescript
// 核心模块
import { AgentManager } from './core/agent-manager';
import { QuantumScheduler } from './core/quantum-scheduler';
import { QuantumBus } from './core/quantum-bus';

// 类型定义
import {
  Agent,
  AgentType,
  AgentState,
  Task,
  TaskStatus,
  QuantumMessage
} from './types/quantum-types';

// 工具
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'events';
```

### 被依赖的模块

```typescript
// 其他模块可以使用主动智能插件
import { ProactiveIntelligencePlugin } from './proactive-intelligence';

// 在AgentManager中使用
class AgentManager {
  constructor(config: any) {
    // 可选地集成主动智能
    if (config.proactiveEnabled) {
      this.proactive = new ProactiveIntelligencePlugin(config.proactive);
    }
  }
}

// 在主应用中使用
class QuantumMultiAgentPlatform {
  constructor(config: any) {
    this.agentManager = new AgentManager(config);
    this.scheduler = new QuantumScheduler(config);
    this.proactive = new ProactiveIntelligencePlugin(config.proactive);
  }
}
```

## 📦 发布和安装

### 作为独立包发布

```bash
# 构建包
npm run build

# 发布到npm
npm publish

# 或发布到私有注册表
npm publish --registry https://your-registry.com
```

### 作为DSH插件安装

```bash
# 方式1: npm安装
dsh plugin add dsh-proactive --profile web  # 本地插件名（scripts/dsh-proactive-install-to-dsh.mjs 一键装入）

# 方式2: GitHub安装
dsh plugin add github:your-org/dsh-proactive --profile web

# 方式3: 本地安装
dsh plugin add ./dsh-proactive-1.0.0.tgz --profile web
```

### 自动安装

```bash
# 使用安装脚本（本仓 scripts/dsh-proactive-install-to-dsh.mjs，仓根执行）
npm install
node scripts/dsh-proactive-install-to-dsh.mjs
```

## 🎨 扩展点

### 1. 自定义条件类型

```typescript
// 在 DecisionEngine 中添加新的条件类型
private evaluateCondition(condition: Condition, context: DecisionContext): boolean {
  switch (condition.type) {
    case 'custom':  // 新增自定义类型
      return this.evaluateCustomCondition(condition, context);
    // ... 其他类型
  }
}
```

### 2. 自定义动作类型

```typescript
// 在 ActionExecutor 中添加新的动作类型
private async executeByType(action: Action): Promise<any> {
  switch (action.type) {
    case 'custom':  // 新增自定义类型
      return this.executeCustomAction(action);
    // ... 其他类型
  }
}
```

### 3. 自定义事件源

```typescript
// 创建自定义事件监听器
class CustomEventListener {
  constructor(private plugin: ProactiveIntelligencePlugin) {}

  listen() {
    // 监听自定义数据源
    setInterval(() => {
      const data = this.fetchCustomData();
      this.plugin.observe({
        type: 'custom_metrics',
        source: 'custom_listener',
        severity: 'info',
        data
      });
    }, 5000);
  }

  private fetchCustomData() {
    // 获取自定义数据
    return { /* ... */ };
  }
}
```

## 🔧 配置示例

### 完整配置示例

```typescript
import { ProactiveIntelligencePlugin } from 'quantum-multi-agent-platform';

const plugin = new ProactiveIntelligencePlugin({
  // 监控器配置
  monitor: {
    maxBufferSize: 10000,
    retentionMs: 3600000  // 1小时
  },

  // 决策引擎配置
  engine: {
    maxRules: 1000,
    decisionHistoryLimit: 1000
  },

  // 执行器配置
  executor: {
    enabled: true,
    safeMode: false,  // 生产环境设为false
    maxConcurrentActions: 10,
    actionTimeoutMs: 30000,
    auditLogEnabled: true,
    allowedActions: [
      'notification:*',
      'workflow:*',
      'command:nuke:*'
    ],
    blockedActions: [
      'command:rm',
      'command:delete'
    ]
  }
});

// 加载预设规则
import { allPresetRules } from 'quantum-multi-agent-platform/dist/proactive-intelligence/rules.js';
allPresetRules.forEach(rule => plugin.addRule(rule));

// 启动插件
await plugin.start();
```

## 📈 监控和运维

### 健康检查

```typescript
async function healthCheck(plugin: ProactiveIntelligencePlugin) {
  const stats = plugin.getStatistics();

  return {
    status: stats.running ? 'healthy' : 'unhealthy',
    events: stats.monitor.total,
    decisions: stats.engine.totalDecisionsMade,
    actions: stats.engine.totalActionsExecuted,
    errors: stats.engine.actionsFailed
  };
}
```

### 性能监控

```typescript
// 定期收集指标
setInterval(() => {
  const metrics = plugin.getEngine().getMetrics();
  console.log('决策时间:', metrics.averageDecisionTime, 'ms');
  console.log('执行时间:', metrics.averageExecutionTime, 'ms');
  console.log('触发规则:', metrics.rulesTriggered);
}, 60000);
```

### 日志导出

```typescript
// 导出执行历史
function exportAuditLog(plugin: ProactiveIntelligencePlugin) {
  const history = plugin.getExecutor().getExecutionHistory();
  const log = history.map(exec => ({
    timestamp: exec.startTime,
    rule: exec.ruleId,
    action: exec.action.name,
    status: exec.status,
    result: exec.result,
    error: exec.error?.message
  }));

  return JSON.stringify(log, null, 2);
}
```

## 🚀 未来规划

### 短期目标 (1-3个月)

- [ ] 添加机器学习模型支持
- [ ] 实现分布式决策引擎
- [ ] 添加Web UI管理界面
- [ ] 支持更多动作类型（HTTP请求、数据库操作等）

### 中期目标 (3-6个月)

- [ ] 实现规则市场
- [ ] 添加可视化规则编辑器
- [ ] 支持规则版本管理
- [ ] 实现规则A/B测试

### 长期目标 (6-12个月)

- [ ] 构建社区规则库
- [ ] 实现智能规则推荐
- [ ] 支持多租户隔离
- [ ] 构建完整的监控平台

## 📚 相关文档

- [完整文档](./src/proactive-intelligence/README.md)
- [快速入门](./src/proactive-intelligence/QUICKSTART.md)
- [DSH插件开发指南](./deepseek-harness-plugin-guide.md)
- [项目主文档](./README.md)

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 📄 许可证

MIT License

---

**主动智能插件 - 让系统更智能，让运维更轻松！** 🚀