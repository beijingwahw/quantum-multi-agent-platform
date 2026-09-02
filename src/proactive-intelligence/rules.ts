/**
 * 主动智能插件 - 预设规则库
 *
 * 提供常见场景的预定义规则，可以直接使用或作为模板
 */

import { Rule } from './index';

// ============================================================================
// 系统健康监控规则
// ============================================================================

/**
 * CPU使用率过高警告
 */
export const highCpuUsageRule: Rule = {
  id: 'cpu-high-usage',
  name: 'CPU使用率过高',
  description: '当CPU使用率持续超过阈值时发送警告',
  enabled: true,
  priority: 100,
  cooldown: 60000, // 1分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'greaterThan',
      field: 'system_metrics.cpu',
      value: 80,
      logicalOperator: 'AND'
    },
    {
      // 至少 5 个事件（修复：此前用 equals 5，只有恰好第 5 个事件时才触发）
      type: 'state',
      operator: 'between',
      field: 'monitorStats.byType.system_metrics',
      value: [5, Infinity]
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '⚠️ CPU使用率警告',
        message: 'CPU使用率超过80%，请检查系统负载',
        level: 'warning'
      },
      timeout: 5000
    },
    {
      type: 'workflow',
      name: 'collect_diagnostics',
      parameters: {
        workflowId: 'system-diagnostics',
        parameters: {
          focus: 'cpu'
        }
      }
    }
  ]
};

/**
 * 内存不足警告
 */
export const lowMemoryWarningRule: Rule = {
  id: 'memory-low',
  name: '内存不足',
  description: '当可用内存低于阈值时触发清理',
  enabled: true,
  priority: 90,
  cooldown: 120000, // 2分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'lessThan',
      field: 'system_metrics.memory.available',
      value: 512, // MB
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '💾 内存不足警告',
        message: '可用内存低于512MB，正在执行清理...',
        level: 'warning'
      }
    },
    {
      type: 'workflow',
      name: 'cleanup_cache',
      parameters: {
        workflowId: 'cache-cleanup',
        parameters: {
          aggressive: true
        }
      }
    }
  ]
};

/**
 * 磁盘空间不足警告
 */
export const lowDiskSpaceRule: Rule = {
  id: 'disk-low-space',
  name: '磁盘空间不足',
  description: '当磁盘使用率超过阈值时警告',
  enabled: true,
  priority: 95,
  cooldown: 300000, // 5分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'greaterThan',
      field: 'system_metrics.disk.usage',
      value: 85
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '💿 磁盘空间不足',
        message: '磁盘使用率超过85%，请及时清理',
        level: 'warning'
      }
    },
    {
      type: 'command',
      name: 'analyze_disk',
      parameters: {
        command: 'du',
        args: ['-sh', '/data/*']
      }
    }
  ]
};

// ============================================================================
// Agent管理规则
// ============================================================================

/**
 * Agent离线检测
 */
export const agentOfflineRule: Rule = {
  id: 'agent-offline',
  name: 'Agent离线',
  description: '检测Agent长时间无心跳',
  enabled: true,
  priority: 80,
  cooldown: 180000, // 3分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'contains',
      field: 'agent_status.state',
      value: 'offline'
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '🔌 Agent离线',
        message: '检测到Agent离线，正在尝试重连...',
        level: 'error'
      }
    },
    {
      type: 'workflow',
      name: 'restart_agent',
      parameters: {
        workflowId: 'agent-restart',
        parameters: {
          maxRetries: 3
        }
      }
    }
  ]
};

/**
 * Agent过载检测
 */
export const agentOverloadedRule: Rule = {
  id: 'agent-overloaded',
  name: 'Agent过载',
  description: '检测Agent负载过高',
  enabled: true,
  priority: 85,
  cooldown: 60000, // 1分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'greaterThan',
      field: 'agent_status.load',
      value: 90
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '📊 Agent过载',
        message: 'Agent负载超过90%，正在调整任务分配...',
        level: 'warning'
      }
    },
    {
      type: 'workflow',
      name: 'rebalance_tasks',
      parameters: {
        workflowId: 'task-rebalancing',
        parameters: {
          strategy: 'least-loaded'
        }
      }
    }
  ]
};

// ============================================================================
// 任务调度规则
// ============================================================================

/**
 * 任务超时检测
 */
export const taskTimeoutRule: Rule = {
  id: 'task-timeout',
  name: '任务超时',
  description: '检测长时间运行的任务',
  enabled: true,
  priority: 70,
  cooldown: 300000, // 5分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'equals',
      field: 'task.status',
      value: 'running'
    },
    {
      type: 'state',
      operator: 'greaterThan',
      field: 'task.duration',
      value: 3600000 // 1小时
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '⏰ 任务超时',
        message: '检测到任务运行超过1小时',
        level: 'warning'
      }
    },
    {
      type: 'workflow',
      name: 'analyze_task',
      parameters: {
        workflowId: 'task-analysis',
        parameters: {
          collectStackTrace: true
        }
      }
    }
  ]
};

/**
 * 失败任务重试
 */
export const taskRetryRule: Rule = {
  id: 'task-retry',
  name: '失败任务重试',
  description: '自动重试失败的任务',
  enabled: true,
  priority: 60,
  cooldown: 60000, // 1分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'equals',
      field: 'task.status',
      value: 'failed'
    },
    {
      type: 'state',
      operator: 'lessThan',
      field: 'task.retryCount',
      value: 3
    }
  ],
  actions: [
    {
      type: 'workflow',
      name: 'retry_task',
      parameters: {
        workflowId: 'task-retry',
        parameters: {
          backoffStrategy: 'exponential'
        }
      }
    }
  ]
};

// ============================================================================
// 安全监控规则
// ============================================================================

/**
 * 异常登录检测
 */
export const suspiciousLoginRule: Rule = {
  id: 'suspicious-login',
  name: '异常登录',
  description: '检测异常的登录行为',
  enabled: true,
  priority: 100,
  cooldown: 1800000, // 30分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'contains',
      field: 'auth.location',
      value: 'unknown'
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '🔒 安全警告：异常登录',
        message: '检测到来自未知位置的登录尝试',
        level: 'critical'
      }
    },
    {
      type: 'workflow',
      name: 'lock_account',
      parameters: {
        workflowId: 'security-lock',
        parameters: {
          action: 'temporary_lock',
          duration: 1800 // 30分钟
        }
      }
    }
  ]
};

/**
 * 权限提升检测
 */
export const privilegeEscalationRule: Rule = {
  id: 'privilege-escalation',
  name: '权限提升',
  description: '检测异常的权限提升操作',
  enabled: true,
  priority: 100,
  cooldown: 3600000, // 1小时冷却
  conditions: [
    {
      type: 'event',
      operator: 'contains',
      field: 'audit.action',
      value: 'privilege_escalation'
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '🚨 安全警告：权限提升',
        message: '检测到权限提升操作，请立即审查',
        level: 'critical'
      }
    },
    {
      type: 'workflow',
      name: 'security_audit',
      parameters: {
        workflowId: 'security-audit',
        parameters: {
          scope: 'privileges'
        }
      }
    }
  ]
};

// ============================================================================
// 业务逻辑规则
// ============================================================================

/**
 * 自动扩容规则
 */
export const autoScaleUpRule: Rule = {
  id: 'auto-scale-up',
  name: '自动扩容',
  description: '当系统负载高时自动增加资源',
  enabled: true,
  priority: 75,
  cooldown: 300000, // 5分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'greaterThan',
      field: 'system_metrics.systemLoad',
      value: 0.8
    },
    {
      type: 'state',
      operator: 'lessThan',
      field: 'runningExecutions',
      value: 5
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_info',
      parameters: {
        title: '📈 自动扩容',
        message: '系统负载高，正在增加资源...',
        level: 'info'
      }
    },
    {
      type: 'workflow',
      name: 'scale_up',
      parameters: {
        workflowId: 'auto-scaling',
        parameters: {
          direction: 'up',
          instances: 2
        }
      }
    }
  ]
};

/**
 * 自动缩容规则
 */
export const autoScaleDownRule: Rule = {
  id: 'auto-scale-down',
  name: '自动缩容',
  description: '当系统负载低时自动减少资源',
  enabled: true,
  priority: 65,
  cooldown: 600000, // 10分钟冷却
  conditions: [
    {
      type: 'event',
      operator: 'lessThan',
      field: 'system_metrics.systemLoad',
      value: 0.3
    },
    {
      type: 'time',
      operator: 'equals',
      field: 'isBusinessHours',
      value: false
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_info',
      parameters: {
        title: '📉 自动缩容',
        message: '系统负载低，正在减少资源以节省成本...',
        level: 'info'
      }
    },
    {
      type: 'workflow',
      name: 'scale_down',
      parameters: {
        workflowId: 'auto-scaling',
        parameters: {
          direction: 'down',
          instances: 1
        }
      }
    }
  ]
};

/**
 * 定期备份提醒
 */
export const backupReminderRule: Rule = {
  id: 'backup-reminder',
  name: '定期备份提醒',
  description: '在工作日结束时提醒进行备份',
  enabled: true,
  priority: 50,
  cooldown: 86400000, // 24小时冷却
  conditions: [
    {
      type: 'time',
      operator: 'equals',
      field: 'hour',
      value: 17
    },
    {
      type: 'time',
      operator: 'notEquals',
      field: 'isWeekend',
      value: true
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_reminder',
      parameters: {
        title: '💾 备份提醒',
        message: '工作日即将结束，建议进行数据备份',
        level: 'info'
      }
    },
    {
      type: 'workflow',
      name: 'create_backup',
      parameters: {
        workflowId: 'backup',
        parameters: {
          type: 'incremental'
        }
      }
    }
  ]
};

// ============================================================================
// 增长市场规则（Brain 联动：条件字段读取 currentState.brain.*）
// ============================================================================

/**
 * 市场表现退化检测
 * 条件字段来自 GrowthSchedulerBrain.getState()：
 * 已结算任务 ≥ 20 且全窗口成功率 < 40% 时告警并触发诊断工作流。
 */
export const marketUnderperformingRule: Rule = {
  id: 'market-underperforming',
  name: '市场表现退化',
  description: '增长市场的任务成功率跌破阈值时告警',
  enabled: true,
  priority: 88,
  cooldown: 300000, // 5分钟冷却
  conditions: [
    {
      type: 'state',
      operator: 'greaterThan',
      field: 'brain.settledCount',
      value: 20
    },
    {
      type: 'state',
      operator: 'lessThan',
      field: 'brain.successRate',
      value: 0.4,
      logicalOperator: 'AND'
    }
  ],
  actions: [
    {
      type: 'notification',
      name: 'send_alert',
      parameters: {
        title: '📉 市场表现退化',
        message: '任务成功率跌破40%，请检查agent质量与市场配置',
        level: 'warning'
      }
    },
    {
      type: 'workflow',
      name: 'market_diagnostics',
      parameters: {
        workflowId: 'market-diagnostics',
        parameters: {
          scope: 'agent-quality'
        }
      }
    }
  ]
};

// ============================================================================
// 规则集合
// ============================================================================

/**
 * 系统监控规则集合
 */
export const systemMonitoringRules: Rule[] = [
  highCpuUsageRule,
  lowMemoryWarningRule,
  lowDiskSpaceRule
];

/**
 * Agent管理规则集合
 */
export const agentManagementRules: Rule[] = [
  agentOfflineRule,
  agentOverloadedRule
];

/**
 * 任务调度规则集合
 */
export const taskSchedulingRules: Rule[] = [
  taskTimeoutRule,
  taskRetryRule
];

/**
 * 安全监控规则集合
 */
export const securityMonitoringRules: Rule[] = [
  suspiciousLoginRule,
  privilegeEscalationRule
];

/**
 * 业务逻辑规则集合
 */
export const businessLogicRules: Rule[] = [
  autoScaleUpRule,
  autoScaleDownRule,
  backupReminderRule
];

/**
 * 增长市场规则集合（Brain 联动）
 */
export const growthMarketRules: Rule[] = [
  marketUnderperformingRule
];

/**
 * 所有预设规则
 */
export const allPresetRules: Rule[] = [
  ...systemMonitoringRules,
  ...agentManagementRules,
  ...taskSchedulingRules,
  ...securityMonitoringRules,
  ...businessLogicRules,
  ...growthMarketRules
];

/**
 * 按场景获取规则
 */
export function getRulesByScenario(scenario: string): Rule[] {
  switch (scenario) {
    case 'system':
      return systemMonitoringRules;
    case 'agent':
      return agentManagementRules;
    case 'task':
      return taskSchedulingRules;
    case 'security':
      return securityMonitoringRules;
    case 'business':
      return businessLogicRules;
    case 'market':
      return growthMarketRules;
    case 'all':
    default:
      return allPresetRules;
  }
}