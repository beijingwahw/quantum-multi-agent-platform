/**
 * 动作执行器 (Executor)：执行策略（并发/超时/重试/取消竞态）与
 * 各类型动作分发。拆分自 index.ts——职责单一的执行层组件。
 *
 * command 动作走 src/tools/system-tools 的加固执行管道（程序白名单、
 * 字符黑名单、超时与工作目录沙箱）——此前这里返回 mock 输出，
 * 命令动作静默空转；被策略拒绝的命令现在以 ToolError 失败并显式暴露。
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import type { Action, ActionExecution, PolicyConfig } from './types';
import type { BrainAssignment } from './brain';
import { ToolError } from '../utils/errors';
import { execute_command } from '../tools/system-tools';

export class ActionExecutor extends EventEmitter {
  private runningExecutions = new Map<string, ActionExecution>();
  private executionHistory: ActionExecution[] = [];
  /** 已入史执行ID集合：addToHistory幂等查重O(1)（原some()为O(n²)） */
  private historyIds = new Set<string>();
  /** 已取消的执行ID：在飞的executeAction返回时据此放弃覆盖终态 */
  private cancelledIds = new Set<string>();
  private config: PolicyConfig;

  constructor(config: Partial<PolicyConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      maxConcurrentActions: 10,
      actionTimeoutMs: 30000,
      auditLogEnabled: true,
      safeMode: false,
      allowedActions: ['*'],
      blockedActions: [],
      ...config,
    };
  }

  /** 执行动作 */
  async executeAction(ruleId: string, action: Action): Promise<ActionExecution> {
    const execution: ActionExecution = {
      id: randomUUID(),
      ruleId,
      action,
      status: 'pending',
      startTime: new Date(),
    };

    // 检查是否启用
    if (!this.config.enabled) {
      execution.status = 'failed';
      execution.error = new ToolError('Executor is disabled');
      execution.endTime = new Date();
      this.addToHistory(execution);
      this.emit('action_failed', execution);
      throw execution.error;
    }

    // 检查动作是否被阻止
    if (!this.isActionAllowed(action)) {
      execution.status = 'failed';
      execution.error = new ToolError('Action is blocked by policy');
      execution.endTime = new Date();
      this.addToHistory(execution);
      this.emit('action_failed', execution);
      throw execution.error;
    }

    // 检查并发限制
    if (this.runningExecutions.size >= this.config.maxConcurrentActions) {
      throw new ToolError('Maximum concurrent actions reached');
    }

    // 添加到运行中列表
    this.runningExecutions.set(execution.id, execution);

    this.emit('action_started', execution);

    try {
      // 安全模式：只记录不执行
      if (this.config.safeMode) {
        execution.status = 'completed';
        execution.result = { safeMode: true, skipped: true };
      } else {
        execution.status = 'running';
        execution.result = await this.performAction(action, execution);
        // 取消竞态：cancelExecution已写终态'failed'，在飞结果不得覆盖，
        // 也不得再发action_completed（否则取消被记成完成且指标重复计数）
        if (this.cancelledIds.delete(execution.id)) {
          execution.status = 'failed';
          execution.error = new ToolError('Execution cancelled');
          execution.endTime = new Date();
          return execution;
        }
        execution.status = 'completed';
      }

      execution.endTime = new Date();
      this.emit('action_completed', execution);
    } catch (error) {
      this.cancelledIds.delete(execution.id);
      execution.status = 'failed';
      execution.error = error as Error;
      execution.endTime = new Date();
      this.emit('action_failed', execution);
      throw error;
    } finally {
      // 从运行中列表移除
      this.runningExecutions.delete(execution.id);
      this.addToHistory(execution);
    }

    return execution;
  }

  /** 带超时与重试的动作执行 */
  private async performAction(action: Action, _execution: ActionExecution): Promise<unknown> {
    const timeout = action.timeout ?? this.config.actionTimeoutMs;
    const retryPolicy = action.retryPolicy ?? { maxRetries: 0, backoffMs: 1000 };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        // 创建超时Promise（race 结束后清理定时器，避免泄漏）
        let timeoutHandle: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new ToolError('Action timeout'));
          }, timeout);
        });

        try {
          // 执行动作
          const result = await Promise.race([this.executeByType(action), timeoutPromise]);
          return result;
        } finally {
          clearTimeout(timeoutHandle);
        }
      } catch (error) {
        lastError = error as Error;

        // 超时不是可重试错误：command/workflow等动作有副作用，
        // "只是慢"不构成重跑的理由（重试会放大副作用）
        if (lastError.message === 'Action timeout') {
          throw lastError;
        }

        // 最后一次尝试失败则抛出错误
        if (attempt === retryPolicy.maxRetries) {
          throw lastError;
        }

        // 等待退避时间
        await new Promise((resolve) => setTimeout(resolve, retryPolicy.backoffMs * (attempt + 1)));
      }
    }

    // 循环必然在内部return/throw；此行仅为类型收尾
    throw lastError ?? new ToolError('Action failed');
  }

  /** 根据类型执行动作 */
  private async executeByType(action: Action): Promise<unknown> {
    switch (action.type) {
      case 'command':
        return this.executeCommand(action);
      case 'notification':
        return this.executeNotification(action);
      case 'workflow':
        return this.executeWorkflow(action);
      case 'custom':
        return this.executeCustom(action);
      case 'assignment':
        return this.executeAssignment(action);
      default:
        throw new ToolError(`Unknown action type: ${String(action.type)}`);
    }
  }

  /** 执行市场分配动作（来自增长调度器 Brain 的 VCG 定价分配） */
  private executeAssignment(action: Action): Promise<unknown> {
    const assignment = action.parameters.assignment as BrainAssignment | undefined;

    if (!assignment?.taskId || !assignment.winnerId) {
      throw new ToolError(
        'Assignment action requires "assignment" parameter with taskId and winnerId',
      );
    }

    this.emit('market_allocation', assignment);

    return Promise.resolve({
      type: 'assignment',
      taskId: assignment.taskId,
      winnerId: assignment.winnerId,
      capability: assignment.capability,
      payment: assignment.payment,
      socialValue: assignment.socialValue,
    });
  }

  /**
   * 执行命令：经 system-tools 加固管道（白名单程序、无 shell 元字符、
   * 超时与 workdir 沙箱）。被策略拒绝的命令以 ToolError 显式失败，
   * 而不是返回假输出。
   */
  private async executeCommand(action: Action): Promise<unknown> {
    const { command, args } = action.parameters;

    if (typeof command !== 'string' || !command) {
      throw new ToolError('Command action requires a string "command" parameter');
    }
    const argList = Array.isArray(args) ? args.map(String) : [];

    this.emit('command_executing', { command, args: argList });

    const output = await execute_command([command, ...argList].join(' '));

    return Promise.resolve({
      type: 'command',
      command,
      args: argList,
      output,
      exitCode: 0,
    });
  }

  /** 执行通知 */
  private executeNotification(action: Action): Promise<unknown> {
    const { title, message, level } = action.parameters;

    if (!title || !message) {
      throw new ToolError('Notification action requires "title" and "message" parameters');
    }

    this.emit('notification_sent', { title, message, level });

    return Promise.resolve({
      type: 'notification',
      title,
      message,
      level: level ?? 'info',
    });
  }

  /**
   * 执行工作流：发出 workflow_started 事件交由宿主接入 DSH 工作流引擎
   * （宿主监听该事件调用 platform.executeDSHWorkflow）。
   */
  private executeWorkflow(action: Action): Promise<unknown> {
    const { workflowId, parameters } = action.parameters;

    if (!workflowId) {
      throw new ToolError('Workflow action requires "workflowId" parameter');
    }

    this.emit('workflow_started', { workflowId, parameters });

    return Promise.resolve({
      type: 'workflow',
      workflowId,
      parameters,
      status: 'started',
    });
  }

  /** 执行自定义动作 */
  private executeCustom(action: Action): Promise<unknown> {
    const { handler } = action.parameters;

    if (!handler || typeof handler !== 'function') {
      throw new ToolError('Custom action requires "handler" function parameter');
    }

    return Promise.resolve(
      (handler as (params: Record<string, unknown>) => unknown)(action.parameters),
    );
  }

  /** 检查动作是否允许 */
  private isActionAllowed(action: Action): boolean {
    const actionType = `${action.type}:${action.name}`;

    // 检查阻止列表
    if (
      this.config.blockedActions.includes('*') ||
      this.config.blockedActions.includes(action.type) ||
      this.config.blockedActions.includes(actionType)
    ) {
      return false;
    }

    // 检查允许列表
    if (this.config.allowedActions.includes('*')) {
      return true;
    }

    return (
      this.config.allowedActions.includes(action.type) ||
      this.config.allowedActions.includes(actionType)
    );
  }

  /** 添加到历史记录（按执行 ID 幂等——取消后再超时的执行不重复入列） */
  private addToHistory(execution: ActionExecution): void {
    if (this.historyIds.has(execution.id)) return;
    this.historyIds.add(execution.id);
    this.executionHistory.push(execution);

    // 限制历史记录大小（ID集合与数组同步收缩）
    if (this.executionHistory.length > 10000) {
      const removed = this.executionHistory.splice(0, this.executionHistory.length - 10000);
      for (const e of removed) this.historyIds.delete(e.id);
    }
  }

  /** 获取运行中的执行 */
  getRunningExecutions(): ActionExecution[] {
    return Array.from(this.runningExecutions.values());
  }

  /** 获取执行历史 */
  getExecutionHistory(filter?: {
    ruleId?: string;
    status?: string;
    since?: Date;
  }): ActionExecution[] {
    let history = [...this.executionHistory];

    if (filter) {
      if (filter.ruleId) {
        history = history.filter((e) => e.ruleId === filter.ruleId);
      }
      if (filter.status) {
        history = history.filter((e) => e.status === filter.status);
      }
      const since = filter.since;
      if (since !== undefined) {
        history = history.filter((e) => e.startTime >= since);
      }
    }

    return history;
  }

  /** 取消执行（标记失败并写入历史——修复此前取消的执行不进历史） */
  cancelExecution(executionId: string): boolean {
    const execution = this.runningExecutions.get(executionId);
    if (!execution) return false;

    this.cancelledIds.add(executionId);
    execution.status = 'failed';
    execution.error = new ToolError('Execution cancelled');
    execution.endTime = new Date();

    this.runningExecutions.delete(executionId);
    this.addToHistory(execution);
    this.emit('action_cancelled', execution);

    return true;
  }

  /** 更新配置 */
  updateConfig(config: Partial<PolicyConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  /** 获取配置 */
  getConfig(): PolicyConfig {
    return { ...this.config };
  }
}
