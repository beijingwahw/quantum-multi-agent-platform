import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../utils/logger';
import { ToolError } from '../utils/errors';

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
  private tools: Map<string, DSHTool> = new Map();
  private workflows: Map<string, DSHWorkflow> = new Map();
  private agentMapping: Map<string, string> = new Map(); // quantum agent -> dsh agent
  private config: unknown;
  private isInitialized: boolean = false;

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

  private async initializeTools(): Promise<void> {
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
  }

  private async initializeWorkflows(): Promise<void> {
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

    // 验证参数
    this.validateToolParameters(tool, parameters);

    try {
      // quantum agent → DSH agent 映射只在 agent 类工具上有意义
      const mappedAgentId = quantumAgentId
        ? (this.agentMapping.get(quantumAgentId) ?? quantumAgentId)
        : undefined;

      // 根据工具类型执行不同的调用方式
      switch (tool.category) {
        case 'filesystem':
          return await this.executeFileSystemTool(tool, parameters);
        case 'system':
          return await this.executeSystemTool(tool, parameters);
        case 'web':
          return await this.executeWebTool(tool, parameters);
        case 'agent':
          return await this.executeAgentTool(tool, parameters, mappedAgentId);
        default:
          throw new ToolError(`Unknown tool category: ${tool.category}`);
      }
    } catch (error) {
      logError('DSHIntegration', `Error executing tool ${toolName}:`, error);
      throw error;
    }
  }

  private validateToolParameters(tool: DSHTool, parameters: DSHToolParams): void {
    if (parameters === null || typeof parameters !== 'object') {
      throw new ToolError(`Parameters for tool '${tool.name}' must be an object`);
    }
    tool.parameters.forEach((param) => {
      if (param.required && !(param.name in parameters)) {
        throw new ToolError(`Required parameter '${param.name}' missing for tool '${tool.name}'`);
      }
    });
  }

  private async executeFileSystemTool(tool: DSHTool, parameters: DSHToolParams): Promise<unknown> {
    const { read_file, write_file } = await import('../tools/fs-tools');

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
    const { execute_command } = await import('../tools/system-tools');
    const workdir = parameters.workdir;
    return await execute_command(
      String(parameters.command),
      workdir === undefined ? undefined : String(workdir),
    );
  }

  private async executeWebTool(tool: DSHTool, parameters: DSHToolParams): Promise<unknown> {
    const { web_search } = await import('../tools/web-tools');
    return await web_search(String(parameters.query));
  }

  private async executeAgentTool(
    tool: DSHTool,
    parameters: DSHToolParams,
    dshAgentId?: string,
  ): Promise<unknown> {
    const { subagent } = await import('../tools/agent-tools');

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

    const results: Map<string, unknown> = new Map();
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
    const graph: Map<string, Set<string>> = new Map();
    const inDegree: Map<string, number> = new Map();
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
          inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
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
  createWorkflow(workflow: Omit<DSHWorkflow, 'id'>): DSHWorkflow {
    const id = uuidv4();
    const fullWorkflow: DSHWorkflow = { ...workflow, id };
    this.workflows.set(id, fullWorkflow);
    this.emit('workflow_created', fullWorkflow);
    return fullWorkflow;
  }

  updateWorkflow(id: string, updates: Partial<DSHWorkflow>): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow) return false;

    const updatedWorkflow = { ...workflow, ...updates };
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
