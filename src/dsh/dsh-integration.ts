import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { logInfo, logError } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';

// DSH工具参数描述
interface DSHToolParameter {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
}

export interface DSHTool {
  name: string;
  description: string;
  parameters: DSHToolParameter[];
  returnType: string;
  category: string;
}

export interface DSHWorkflow {
  id: string;
  name: string;
  steps: Array<{
    id: string;
    tool: string;
    parameters: Record<string, unknown>;
    dependsOn?: string[];
  }>;
}

/** DSH 工具调用参数：按工具定义校验后的自由键值对 */
export type DSHToolParams = Record<string, unknown>;

// DSH集成运行指标
interface DSHIntegrationMetrics {
  toolsCount: number;
  workflowsCount: number;
  agentMappingsCount: number;
  isInitialized: boolean;
}

export class DSHIntegration extends EventEmitter {
  private tools = new Map<string, DSHTool>();
  private workflows = new Map<string, DSHWorkflow>();
  private agentMapping = new Map<string, string>(); // quantum agent -> dsh agent
  private config: unknown;
  private isInitialized = false;

  constructor(config?: unknown) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logInfo('DSHIntegration', 'Initializing DeepSeek Harness integration...');

      // 初始化DSH工具映射
      await this.initializeTools();

      // 初始化工作流模板
      await this.initializeWorkflows();

      this.isInitialized = true;
      this.emit('initialized');
      logInfo('DSHIntegration', 'DeepSeek Harness integration initialized successfully');
    } catch (error) {
      logError('DSHIntegration', 'Failed to initialize:', error);
      throw error;
    }
  }

  private initializeTools(): Promise<void> {
    // 这里可以从DSH API获取工具列表
    const defaultTools: DSHTool[] = [
      {
        name: 'read_file',
        description: 'Read a file from the filesystem',
        parameters: [{ name: 'path', type: 'string', required: true }],
        returnType: 'string',
        category: 'filesystem',
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: [
          { name: 'path', type: 'string', required: true },
          { name: 'content', type: 'string', required: true },
        ],
        returnType: 'boolean',
        category: 'filesystem',
      },
      {
        name: 'execute_command',
        description: 'Execute a system command',
        parameters: [
          { name: 'command', type: 'string', required: true },
          { name: 'workdir', type: 'string', required: false },
        ],
        returnType: 'string',
        category: 'system',
      },
      {
        name: 'web_search',
        description: 'Search the web for information',
        parameters: [{ name: 'query', type: 'string', required: true }],
        returnType: 'string',
        category: 'web',
      },
      {
        name: 'subagent',
        description: 'Delegate task to a subagent',
        parameters: [
          { name: 'description', type: 'string', required: true },
          { name: 'prompt', type: 'string', required: true },
          { name: 'run_in_background', type: 'boolean', required: false, default: false },
        ],
        returnType: 'object',
        category: 'agent',
      },
    ];

    defaultTools.forEach((tool) => {
      this.tools.set(tool.name, tool);
    });

    logInfo('DSHIntegration', `Initialized ${defaultTools.length} DSH tools`);
    return Promise.resolve();
  }

  private initializeWorkflows(): Promise<void> {
    const defaultWorkflows: DSHWorkflow[] = [
      {
        id: 'code_analysis_workflow',
        name: 'Code Analysis Workflow',
        steps: [
          {
            id: '1',
            tool: 'read_file',
            parameters: { path: 'package.json' },
            dependsOn: [],
          },
          {
            id: '2',
            tool: 'execute_command',
            parameters: { command: 'npm run lint' },
            dependsOn: ['1'],
          },
        ],
      },
      {
        id: 'testing_workflow',
        name: 'Testing Workflow',
        steps: [
          {
            id: '1',
            tool: 'execute_command',
            parameters: { command: 'npm test' },
            dependsOn: [],
          },
          {
            id: '2',
            tool: 'execute_command',
            parameters: { command: 'npm run build' },
            dependsOn: ['1'],
          },
        ],
      },
      {
        id: 'deployment_workflow',
        name: 'Deployment Workflow',
        steps: [
          {
            id: '1',
            tool: 'execute_command',
            parameters: { command: 'npm run build' },
            dependsOn: [],
          },
          {
            id: '2',
            tool: 'execute_command',
            parameters: { command: 'npm run deploy' },
            dependsOn: ['1'],
          },
        ],
      },
    ];

    defaultWorkflows.forEach((workflow) => {
      this.workflows.set(workflow.id, workflow);
    });

    logInfo('DSHIntegration', `Initialized ${defaultWorkflows.length} DSH workflows`);
    return Promise.resolve();
  }

  // Agent映射管理
  mapAgent(quantumAgentId: string, dshAgentId: string): void {
    this.agentMapping.set(quantumAgentId, dshAgentId);
    this.emit('agent_mapped', { quantumAgentId, dshAgentId });
  }

  unmapAgent(quantumAgentId: string): void {
    const dshAgentId = this.agentMapping.get(quantumAgentId);
    this.agentMapping.delete(quantumAgentId);
    if (dshAgentId) {
      this.emit('agent_unmapped', { quantumAgentId, dshAgentId });
    }
  }

  getMappedAgent(quantumAgentId: string): string | undefined {
    return this.agentMapping.get(quantumAgentId);
  }

  // 工具调用
  async executeTool(
    toolName: string,
    parameters: DSHToolParams,
    quantumAgentId?: string,
  ): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolError(`Tool '${toolName}' not found`);
    }

    // 验证参数并规范化（校验声明类型、补默认值、丢弃未声明键）
    const normalizedParams = this.validateAndNormalizeParameters(tool, parameters);

    try {
      // quantum agent → DSH agent 映射只在 agent 类工具上有意义
      const mappedAgentId = quantumAgentId
        ? (this.agentMapping.get(quantumAgentId) ?? quantumAgentId)
        : undefined;

      // 根据工具类型执行不同的调用方式
      switch (tool.category) {
        case 'filesystem':
          return await this.executeFileSystemTool(tool, normalizedParams);
        case 'system':
          return await this.executeSystemTool(tool, normalizedParams);
        case 'web':
          return await this.executeWebTool(tool, normalizedParams);
        case 'agent':
          return await this.executeAgentTool(tool, normalizedParams, mappedAgentId);
        default:
          throw new ToolError(`Unknown tool category: ${tool.category}`);
      }
    } catch (error) {
      logError('DSHIntegration', `Error executing tool ${toolName}:`, error);
      throw error;
    }
  }

  // 参数按运行时真实形态（JSON 反序列化产物）以 unknown 接收并收窄——
  // 类型标注不构成对 JS 调用方的约束。返回规范化新对象，不改写调用方输入：
  // - 显式 undefined 与缺省同义（旧实现仅查键存在性，{path: undefined} 穿透
  //   校验后 String(undefined) 造出字面量 "undefined" 文件名，属静默损坏）；
  // - 声明 default 的可选参数在此补齐（default 字段此前是死元数据）；
  // - 未声明键一律丢弃：执行器只读声明过的参数，多余键不允许夹带。
  private validateAndNormalizeParameters(tool: DSHTool, parameters: unknown): DSHToolParams {
    if (typeof parameters !== 'object' || parameters === null) {
      throw new ToolError(`Parameters for tool '${tool.name}' must be an object`);
    }
    const source = parameters as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const param of tool.parameters) {
      const value = source[param.name];
      if (value === undefined) {
        if (param.required) {
          throw new ToolError(`Required parameter '${param.name}' missing for tool '${tool.name}'`);
        }
        if (param.default !== undefined) {
          normalized[param.name] = param.default;
        }
        continue;
      }
      // 存在即校验声明类型：String(obj) 会把任意对象变成 "[object Object]"，
      // 与其在工具内部才失败，不如边界处干净拒绝并指名参数
      if (param.type === 'string' && typeof value !== 'string') {
        throw new ToolError(
          `Parameter '${param.name}' of tool '${tool.name}' must be a string, ` +
            `got ${typeof value}`,
        );
      }
      if (param.type === 'boolean' && typeof value !== 'boolean') {
        throw new ToolError(
          `Parameter '${param.name}' of tool '${tool.name}' must be a boolean, ` +
            `got ${typeof value}`,
        );
      }
      normalized[param.name] = value;
    }
    return normalized;
  }

  private async executeFileSystemTool(tool: DSHTool, parameters: DSHToolParams): Promise<unknown> {
    const { read_file, write_file } = await import('../tools/fs-tools.js');

    switch (tool.name) {
      case 'read_file':
        return await read_file(String(parameters.path));
      case 'write_file':
        return await write_file(String(parameters.path), String(parameters.content));
      default:
        throw new ToolError(`Unknown filesystem tool: ${tool.name}`);
    }
  }

  private async executeSystemTool(tool: DSHTool, parameters: DSHToolParams): Promise<unknown> {
    const { execute_command } = await import('../tools/system-tools.js');
    const workdir = parameters.workdir;
    return await execute_command(
      String(parameters.command),
      typeof workdir === 'string' ? workdir : undefined,
    );
  }

  private async executeWebTool(tool: DSHTool, parameters: DSHToolParams): Promise<unknown> {
    const { web_search } = await import('../tools/web-tools.js');
    return await web_search(String(parameters.query));
  }

  private async executeAgentTool(
    tool: DSHTool,
    parameters: DSHToolParams,
    dshAgentId?: string,
  ): Promise<unknown> {
    const { subagent } = await import('../tools/agent-tools.js');

    // 构造subagent调用参数（dshAgentId 提供调用方上下文，缺省由子代理自选）
    const subagentParams = {
      description: String(parameters.description),
      prompt: String(parameters.prompt),
      run_in_background: parameters.run_in_background === true,
      ...(dshAgentId !== undefined ? { requested_by: dshAgentId } : {}),
    };

    return await subagent(subagentParams);
  }

  // 工作流执行
  async executeWorkflow(
    workflowId: string,
    quantumAgentId?: string,
  ): Promise<Array<[string, unknown]>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new ToolError(`Workflow '${workflowId}' not found`);
    }

    const results = new Map<string, unknown>();
    const executedSteps = new Set<string>();

    // 按依赖关系排序执行步骤
    const sortedSteps = this.topologicalSort(workflow.steps);

    for (const step of sortedSteps) {
      try {
        // 检查依赖是否完成
        if (step.dependsOn) {
          for (const depId of step.dependsOn) {
            if (!executedSteps.has(depId)) {
              throw new ToolError(`Step ${step.id} depends on uncompleted step ${depId}`);
            }
          }
        }

        // 执行步骤
        const result = await this.executeTool(step.tool, step.parameters, quantumAgentId);

        results.set(step.id, result);
        executedSteps.add(step.id);

        this.emit('workflow_step_completed', {
          workflowId,
          stepId: step.id,
          result,
        });
      } catch (error) {
        logError('DSHIntegration', `Error executing workflow step ${step.id}:`, error);
        throw error;
      }
    }

    return Array.from(results.entries());
  }

  private topologicalSort<T extends { id: string; dependsOn?: string[] }>(steps: T[]): T[] {
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: T[] = [];

    // 构建图和入度
    steps.forEach((step) => {
      graph.set(step.id, new Set());
      inDegree.set(step.id, 0);
    });

    steps.forEach((step) => {
      if (step.dependsOn) {
        step.dependsOn.forEach((depId) => {
          const deps = graph.get(depId);
          if (!deps) {
            throw new ToolError(`Workflow step '${step.id}' depends on unknown step '${depId}'`);
          }
          deps.add(step.id);
          inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
        });
      }
    });

    // 找到所有入度为0的节点
    inDegree.forEach((degree, stepId) => {
      if (degree === 0) {
        queue.push(stepId);
      }
    });

    // 拓扑排序
    const stepById = new Map(steps.map((s) => [s.id, s]));
    while (queue.length > 0) {
      const stepId = queue.shift()!;
      const step = stepById.get(stepId);
      if (!step) throw new ToolError(`Workflow references unknown step '${stepId}'`);
      result.push(step);

      graph.get(stepId)!.forEach((neighborId) => {
        inDegree.set(neighborId, inDegree.get(neighborId)! - 1);
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId);
        }
      });
    }

    if (result.length !== steps.length) {
      throw new ToolError('Workflow has circular dependencies');
    }

    return result;
  }

  // 动态工具注册
  registerTool(tool: DSHTool): void {
    // 重名静默覆盖与 agent 重复注册同罪（审计 01#14）：覆盖会撤掉运行中
    // 工作流引用的工具语义。替换须显式 unregisterTool 后再注册。
    if (this.tools.has(tool.name)) {
      throw new ToolError(
        `Tool '${tool.name}' is already registered (unregister it first to replace)`,
      );
    }
    this.tools.set(tool.name, tool);
    this.emit('tool_registered', tool);
  }

  unregisterTool(toolName: string): boolean {
    const deleted = this.tools.delete(toolName);
    if (deleted) {
      this.emit('tool_unregistered', toolName);
    }
    return deleted;
  }

  // 工作流管理
  /** 创建/更新时的结构校验：步骤非空、id 唯一、依赖指向存在的步骤、工具名非空。
   *  环检测留在执行期（topologicalSort）——依赖成环是合法的存储态，
   *  只是不允许执行（既有契约：创建成功、executeWorkflow 拒绝）。 */
  private static validateWorkflowSteps(steps: DSHWorkflow['steps']): void {
    if (steps.length === 0) {
      throw new ToolError('Workflow must contain at least one step');
    }
    const ids = new Set<string>();
    for (const step of steps) {
      if (typeof step.id !== 'string' || step.id.length === 0) {
        throw new ToolError('Workflow step id must be a non-empty string');
      }
      if (ids.has(step.id)) {
        throw new ToolError(`Duplicate workflow step id '${step.id}'`);
      }
      ids.add(step.id);
      if (typeof step.tool !== 'string' || step.tool.length === 0) {
        throw new ToolError(`Step '${step.id}' must reference a non-empty tool name`);
      }
    }
    for (const step of steps) {
      for (const depId of step.dependsOn ?? []) {
        if (!ids.has(depId)) {
          throw new ToolError(`Workflow step '${step.id}' depends on unknown step '${depId}'`);
        }
      }
    }
  }

  createWorkflow(workflow: Omit<DSHWorkflow, 'id'>): DSHWorkflow {
    DSHIntegration.validateWorkflowSteps(workflow.steps);
    const id = randomUUID();
    const fullWorkflow: DSHWorkflow = { ...workflow, id };
    this.workflows.set(id, fullWorkflow);
    this.emit('workflow_created', fullWorkflow);
    return fullWorkflow;
  }

  updateWorkflow(id: string, updates: Partial<DSHWorkflow>): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow) return false;

    // id 不可经 updates 变更：否则 Map 键与对象自指脱钩（getWorkflow 双失配、
    // deleteWorkflow 发出错误的事件载荷）
    const { id: _ignored, ...rest } = updates;
    if (rest.steps !== undefined) {
      DSHIntegration.validateWorkflowSteps(rest.steps);
    }
    const updatedWorkflow = { ...workflow, ...rest };
    this.workflows.set(id, updatedWorkflow);
    this.emit('workflow_updated', updatedWorkflow);
    return true;
  }

  deleteWorkflow(id: string): boolean {
    const deleted = this.workflows.delete(id);
    if (deleted) {
      this.emit('workflow_deleted', id);
    }
    return deleted;
  }

  // 查询和监控
  getTools(): DSHTool[] {
    return Array.from(this.tools.values());
  }

  getWorkflows(): DSHWorkflow[] {
    return Array.from(this.workflows.values());
  }

  getTool(toolName: string): DSHTool | undefined {
    return this.tools.get(toolName);
  }

  getWorkflow(id: string): DSHWorkflow | undefined {
    return this.workflows.get(id);
  }

  getMetrics(): DSHIntegrationMetrics {
    return {
      toolsCount: this.tools.size,
      workflowsCount: this.workflows.size,
      agentMappingsCount: this.agentMapping.size,
      isInitialized: this.isInitialized,
    };
  }

  /** 释放资源并清理事件监听（平台 stop() 时调用） */
  shutdown(): void {
    this.tools.clear();
    this.workflows.clear();
    this.agentMapping.clear();
    this.isInitialized = false;
    this.removeAllListeners();
  }
}
