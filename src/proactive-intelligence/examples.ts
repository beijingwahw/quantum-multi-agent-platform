/**
 * 主动智能插件 - 使用示例
 *
 * 演示如何使用主动智能插件的各种功能
 */

import {
  ProactiveIntelligencePlugin,
  Rule,
  Condition,
  Action
} from './index';
import {
  allPresetRules,
  getRulesByScenario
} from './rules';

// ============================================================================
// 基础使用示例
// ============================================================================

/**
 * 示例1: 基础启动和监控
 */
async function basicExample() {
  console.log('=== 基础使用示例 ===\n');

  // 创建插件实例
  const plugin = new ProactiveIntelligencePlugin({
    monitor: {
      maxBufferSize: 1000,
      retentionMs: 3600000 // 1小时
    },
    executor: {
      enabled: true,
      safeMode: false, // 设置为true可以只记录不执行
      maxConcurrentActions: 5
    }
  });

  // 添加预设规则
  for (const rule of allPresetRules) {
    plugin.addRule(rule);
  }

  // 启动插件
  await plugin.start();
  console.log('✓ 插件已启动\n');

  // 监听事件
  plugin.on('action_completed', (execution) => {
    console.log(`✓ 动作完成: ${execution.action.type}.${execution.action.name}`);
  });

  plugin.on('action_failed', (execution) => {
    console.log(`✗ 动作失败: ${execution.action.type}.${execution.action.name}`);
    console.log(`  错误: ${execution.error?.message}\n`);
  });

  plugin.on('rule_triggered', (rule) => {
    console.log(`🎯 规则触发: ${rule.name} (${rule.id})\n`);
  });

  // 模拟系统指标事件
  console.log('--- 模拟事件 ---');

  // 正常状态
  plugin.observe({
    type: 'system_metrics',
    source: 'system_monitor',
    severity: 'info',
    data: {
      cpu: 45,
      memory: {
        total: 8192,
        used: 4096,
        available: 4096
      },
      disk: {
        total: 500000,
        used: 200000,
        usage: 40
      },
      systemLoad: 0.5
    }
  });

  await sleep(100);

  // CPU使用率上升
  plugin.observe({
    type: 'system_metrics',
    source: 'system_monitor',
    severity: 'warning',
    data: {
      cpu: 85,
      memory: {
        total: 8192,
        used: 6144,
        available: 2048
      },
      disk: {
        total: 500000,
        used: 250000,
        usage: 50
      },
      systemLoad: 0.85
    }
  });

  await sleep(100);

  // 连续几次高CPU
  for (let i = 0; i < 6; i++) {
    plugin.observe({
      type: 'system_metrics',
      source: 'system_monitor',
      severity: 'warning',
      data: {
        cpu: 90,
        memory: {
          total: 8192,
          used: 7000,
          available: 1192
        },
        disk: {
          total: 500000,
          used: 300000,
          usage: 60
        },
        systemLoad: 0.9
      }
    });
    await sleep(100);
  }

  // 查看统计信息
  await sleep(500);
  console.log('\n--- 统计信息 ---');
  console.log(JSON.stringify(plugin.getStatistics(), null, 2));

  // 停止插件
  await plugin.stop();
  console.log('\n✓ 插件已停止');
}

// ============================================================================
// 自定义规则示例
// ============================================================================

/**
 * 示例2: 创建自定义规则
 */
async function customRuleExample() {
  console.log('=== 自定义规则示例 ===\n');

  const plugin = new ProactiveIntelligencePlugin();

  // 自定义规则：检测错误率过高
  const errorRateRule: Rule = {
    id: 'error-rate-high',
    name: '错误率过高',
    description: '当错误率超过5%时触发告警',
    enabled: true,
    priority: 90,
    cooldown: 60000,
    conditions: [
      {
        type: 'event',
        operator: 'greaterThan',
        field: 'application_metrics.errorRate',
        value: 0.05
      }
    ],
    actions: [
      {
        type: 'notification',
        name: 'send_alert',
        parameters: {
          title: '🚨 错误率过高',
          message: '错误率超过5%，请立即检查应用日志',
          level: 'critical'
        }
      },
      {
        type: 'workflow',
        name: 'collect_logs',
        parameters: {
          workflowId: 'log-collection',
          parameters: {
            timeRange: '15m',
            level: 'error'
          }
        }
      }
    ]
  };

  plugin.addRule(errorRateRule);
  await plugin.start();
  console.log('✓ 自定义规则已添加\n');

  // 监听规则触发
  plugin.on('rule_triggered', (rule) => {
    console.log(`🎯 规则触发: ${rule.name}`);
  });

  // 模拟错误率升高
  console.log('--- 模拟错误率升高 ---');
  plugin.observe({
    type: 'application_metrics',
    source: 'app_monitor',
    severity: 'critical',
    data: {
      requestCount: 1000,
      errorCount: 60,
      errorRate: 0.06,
      latency: {
        p50: 100,
        p95: 500,
        p99: 1000
      }
    }
  });

  await sleep(500);

  // 查看规则状态
  console.log('\n--- 规则状态 ---');
  const rules = plugin.getEngine().getAllRules();
  rules.forEach(rule => {
    console.log(`- ${rule.name} (${rule.id})`);
    console.log(`  状态: ${rule.enabled ? '启用' : '禁用'}`);
    console.log(`  优先级: ${rule.priority}`);
    console.log(`  最后执行: ${rule.lastExecuted || '从未'}`);
  });

  await plugin.stop();
}

// ============================================================================
// 复杂条件示例
// ============================================================================

/**
 * 示例3: 复杂条件组合
 */
async function complexConditionsExample() {
  console.log('=== 复杂条件示例 ===\n');

  const plugin = new ProactiveIntelligencePlugin();

  // 复杂规则：在工作时间、CPU高、内存低时触发
  const complexRule: Rule = {
    id: 'complex-condition',
    name: '工作时间系统过载',
    description: '工作时间CPU和内存同时过高',
    enabled: true,
    priority: 95,
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
    actions: [
      {
        type: 'notification',
        name: 'send_alert',
        parameters: {
          title: '⚠️ 工作时间系统过载',
          message: '工作时间CPU和内存同时过高，请立即处理',
          level: 'critical'
        }
      },
      {
        type: 'workflow',
        name: 'emergency_scale',
        parameters: {
          workflowId: 'auto-scaling',
          parameters: {
            direction: 'up',
            instances: 3,
            priority: 'urgent'
          }
        }
      }
    ]
  };

  plugin.addRule(complexRule);
  await plugin.start();

  plugin.on('rule_triggered', (rule) => {
    console.log(`🎯 触发复杂规则: ${rule.name}`);
  });

  // 模拟在工作时间的系统过载
  console.log('--- 模拟工作时间系统过载 ---');
  plugin.observe({
    type: 'system_metrics',
    source: 'system_monitor',
    severity: 'critical',
    data: {
      cpu: 85,
      memory: {
        total: 8192,
        used: 7500,
        available: 692
      },
      disk: {
        total: 500000,
        used: 300000,
        usage: 60
      },
      systemLoad: 0.9
    }
  });

  await sleep(500);
  await plugin.stop();
}

// ============================================================================
// 安全模式示例
// ============================================================================

/**
 * 示例4: 安全模式（只记录不执行）
 */
async function safeModeExample() {
  console.log('=== 安全模式示例 ===\n');

  const plugin = new ProactiveIntelligencePlugin({
    executor: {
      enabled: true,
      safeMode: true, // 安全模式：只记录不执行
      maxConcurrentActions: 10
    }
  });

  plugin.addRule(getRulesByScenario('system')[0]); // 添加CPU高使用率规则
  await plugin.start();
  console.log('✓ 插件已启动（安全模式）\n');

  // 监听所有动作事件
  plugin.on('action_started', (execution) => {
    console.log(`📝 动作已记录（安全模式）: ${execution.action.type}.${execution.action.name}`);
  });

  plugin.on('action_completed', (execution) => {
    console.log(`✓ 动作已完成（模拟）: ${execution.result}`);
  });

  // 触发规则
  console.log('--- 触发规则 ---');
  for (let i = 0; i < 6; i++) {
    plugin.observe({
      type: 'system_metrics',
      source: 'system_monitor',
      severity: 'warning',
      data: {
        cpu: 90,
        memory: { total: 8192, used: 7000, available: 1192 },
        disk: { total: 500000, used: 300000, usage: 60 },
        systemLoad: 0.9
      }
    });
    await sleep(100);
  }

  await sleep(500);

  // 查看执行历史
  console.log('\n--- 执行历史 ---');
  const history = plugin.getExecutor().getExecutionHistory();
  history.slice(-3).forEach(exec => {
    console.log(`- ${exec.action.type}.${exec.action.name}: ${exec.status}`);
    // result 形状随动作类型变化（安全模式下为 { safeMode, skipped }），此处按记录读取
    const result = exec.result as Record<string, unknown> | undefined;
    if (result?.safeMode) {
      console.log(`  (安全模式跳过实际执行)`);
    }
  });

  await plugin.stop();
}

// ============================================================================
// 动态规则管理示例
// ============================================================================

/**
 * 示例5: 动态规则管理
 */
async function dynamicRuleManagementExample() {
  console.log('=== 动态规则管理示例 ===\n');

  const plugin = new ProactiveIntelligencePlugin();

  // 初始添加一些规则
  plugin.addRule(getRulesByScenario('system')[0]);
  plugin.addRule(getRulesByScenario('system')[1]);

  await plugin.start();
  console.log('✓ 插件已启动\n');

  // 查看当前规则
  console.log('--- 初始规则列表 ---');
  let rules = plugin.getEngine().getAllRules();
  console.log(`共 ${rules.length} 条规则:`);
  rules.forEach(r => console.log(`  - ${r.name}`));

  // 动态添加规则
  console.log('\n--- 动态添加规则 ---');
  const newRule: Rule = {
    id: 'dynamic-rule',
    name: '动态添加的规则',
    description: '运行时动态添加的规则',
    enabled: true,
    priority: 50,
    cooldown: 30000,
    conditions: [
      {
        type: 'event',
        operator: 'equals',
        field: 'test.value',
        value: 'trigger'
      }
    ],
    actions: [
      {
        type: 'notification',
        name: 'test_notification',
        parameters: {
          title: '测试通知',
          message: '动态规则触发',
          level: 'info'
        }
      }
    ]
  };
  plugin.addRule(newRule);
  console.log('✓ 已添加动态规则');

  rules = plugin.getEngine().getAllRules();
  console.log(`现在有 ${rules.length} 条规则`);

  // 禁用规则
  console.log('\n--- 禁用规则 ---');
  plugin.getEngine().toggleRule(newRule.id, false);
  console.log(`✓ 已禁用规则: ${newRule.name}`);

  // 启用规则
  plugin.getEngine().toggleRule(newRule.id, true);
  console.log(`✓ 已重新启用规则: ${newRule.name}`);

  // 删除规则
  console.log('\n--- 删除规则 ---');
  const deleted = plugin.removeRule(newRule.id);
  console.log(`✓ ${deleted ? '成功' : '失败'}删除规则: ${newRule.name}`);

  rules = plugin.getEngine().getAllRules();
  console.log(`现在有 ${rules.length} 条规则`);

  await plugin.stop();
}

// ============================================================================
// 集成DSH示例
// ============================================================================

/**
 * 示例6: 集成DSH工具
 */
async function dshIntegrationExample() {
  console.log('=== DSH集成示例 ===\n');

  const plugin = new ProactiveIntelligencePlugin({
    executor: {
      enabled: true,
      safeMode: true,
      allowedActions: ['command', 'notification', 'workflow']
    }
  });

  // 创建使用DSH工具的规则
  const dshRule: Rule = {
    id: 'dsh-integration-rule',
    name: 'DSH工具集成规则',
    description: '使用DSH工具执行操作',
    enabled: true,
    priority: 80,
    cooldown: 60000,
    conditions: [
      {
        type: 'event',
        operator: 'equals',
        field: 'file_system.disk_usage',
        value: 'high'
      }
    ],
    actions: [
      {
        type: 'command',
        name: 'dsh_nuke_scan',
        parameters: {
          command: 'dsh',
          args: ['nuke', 'scan'],
          description: '执行DSH磁盘扫描'
        }
      },
      {
        type: 'notification',
        name: 'send_dsh_result',
        parameters: {
          title: 'DSH扫描完成',
          message: '已执行DSH磁盘扫描，请查看结果',
          level: 'info'
        }
      }
    ]
  };

  plugin.addRule(dshRule);
  await plugin.start();
  console.log('✓ 插件已启动（集成DSH）\n');

  // 监听命令执行
  plugin.on('command_executing', (cmd) => {
    console.log(`🔧 执行DSH命令: ${cmd.command} ${cmd.args.join(' ')}`);
  });

  // 触发规则
  console.log('--- 触发DSH集成规则 ---');
  plugin.observe({
    type: 'file_system',
    source: 'fs_monitor',
    severity: 'warning',
    data: {
      disk_usage: 'high',
      path: '/data',
      usage: 88
    }
  });

  await sleep(500);
  await plugin.stop();
}

// ============================================================================
// 辅助函数
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 运行所有示例
// ============================================================================

export async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        主动智能插件 - 使用示例集                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await basicExample();
    console.log('\n' + '='.repeat(60) + '\n');

    await customRuleExample();
    console.log('\n' + '='.repeat(60) + '\n');

    await complexConditionsExample();
    console.log('\n' + '='.repeat(60) + '\n');

    await safeModeExample();
    console.log('\n' + '='.repeat(60) + '\n');

    await dynamicRuleManagementExample();
    console.log('\n' + '='.repeat(60) + '\n');

    await dshIntegrationExample();

    console.log('\n' + '='.repeat(60));
    console.log('✓ 所有示例运行完成！');
  } catch (error) {
    console.error('✗ 示例运行失败:', error);
  }
}

// 如果直接运行此文件，执行所有示例
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}