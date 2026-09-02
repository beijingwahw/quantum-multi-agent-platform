import { Agent, Task, QuantumMessage, MessageType } from '../types/quantum-types';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logWarn } from '../utils/logger';

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
  private config: any;
  private isInitialized: boolean = false;

  constructor(config: any) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[DSHIntegration] Initializing DeepSeek Harness integration...');
      
      // 初始化DSH工具映射
      await this.initializeTools();
      
      // 初始化工作流模板
      await this.initializeWorkflows();
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log('[DSHIntegration] DeepSeek Harness integration initialized successfully');
    } catch (error) {
      console.error('[DSHIntegration] Failed to initialize:', error);
      throw error;
    }
  }

  private async initializeTools(): Promise<void> {
    // 这里可以从DSH API获取工具列表
    const defaultTools: DSHTool[] = [
      {
        name: 'read_file',
        description: 'Read a file from the filesystem',
        parameters: [
          { name: 'path', type: 'string', required: true }
        ],
        returnType: 'string',
        category: 'filesystem'
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: [
          { name: 'path', type: 'string', required: true },
          { name: 'content', type: 'string', required: true }
        ],
        returnType: 'boolean',
        category: 'filesystem'
      },
      {
        name: 'execute_command',
        description: 'Execute a system command',
        parameters: [
          { name: 'command', type: 'string', required: true },
          { name: 'workdir', type: 'string', required: false }
        ],
        returnType: 'string',
        category: 'system'
      },
      {
        name: 'web_search',
        description: 'Search the web for information',
        parameters: [
          { name: 'query', type: 'string', required: true }
        ],
        returnType: 'string',
        category: 'web'
      },
      {
        name: 'subagent',
        description: 'Delegate task to a subagent',
        parameters: [
          { name: 'description', type: 'string', required: true },
          { name: 'prompt', type: 'string', required: true },
          { name: 'run_in_background', type: 'boolean', required: false, default: false }
        ],
        returnType: 'object',
        category: 'agent'
      }
    ];

    defaultTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    console.log(`[DSHIntegration] Initialized ${defaultTools.length} DSH tools`);
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
            parameters: { path: 'src/**/*.ts' },
            dependsOn: []
          },
          {
            id: '2',
            tool: 'execute_command',
            parameters: { command: 'npm run lint' },
            dependsOn: ['1']
          }
        ]
      },
      {
        id: 'testing_workflow',
        name: 'Testing Workflow',
        steps: [
          {
            id: '1',
            tool: 'execute_command',
            parameters: { command: 'npm test' },
            dependsOn: []
          },
          {
            id: '2',
            tool: 'execute_command',
            parameters: { command: 'npm run build' },
            dependsOn: ['1']
          }
        ]
      },
      {
        id: 'deployment_workflow',
        name: 'Deployment Workflow',
        steps: [
          {
            id: '1',
            tool: 'execute_command',
            parameters: { command: 'npm run build' },
            dependsOn: []
          },
          {
            id: '2',
            tool: 'execute_command',
            parameters: { command: 'npm run deploy' },
            dependsOn: ['1']
          }
        ]
      }
    ];

    defaultWorkflows.forEach(workflow => {
      this.workflows.set(workflow.id, workflow);
    });

    console.log(`[DSHIntegration] Initialized ${defaultWorkflows.length} DSH workflows`);
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
    parameters: any,
    quantumAgentId?: string
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // 验证参数
    this.validateToolParameters(tool, parameters);

    try {
      let agentId = quantumAgentId;
      
      // 如果有映射，使用映射的DSH agent
      if (quantumAgentId && this.agentMapping.has(quantumAgentId)) {
        agentId = this.agentMapping.get(quantumAgentId)!;
      }

      // 根据工具类型执行不同的调用方式
      switch (tool.category) {
        case 'filesystem':
          return await this.executeFileSystemTool(tool, parameters);
        case 'system':
          return await this.executeSystemTool(tool, parameters);
        case 'web':
          return await this.executeWebTool(tool, parameters);
        case 'agent':
          return await this.executeAgentTool(tool, parameters, agentId);
        default:
          throw new Error(`Unknown tool category: ${tool.category}`);
      }
    } catch (error) {
      console.error(`[DSHIntegration] Error executing tool ${toolName}:`, error);
      throw error;
    }
  }

  private validateToolParameters(tool: DSHTool, parameters: any): void {
    tool.parameters.forEach(param => {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Required parameter '${param.name}' missing for tool '${tool.name}'`);
      }
    });
  }

  private async executeFileSystemTool(tool: DSHTool, parameters: any): Promise<any> {
    const { read_file, write_file } = await import('../tools/fs-tools');
    
    switch (tool.name) {
      case 'read_file':
        return await read_file(parameters.path);
      case 'write_file':
        return await write_file(parameters.path, parameters.content);
      default:
        throw new Error(`Unknown filesystem tool: ${tool.name}`);
    }
  }

  private async executeSystemTool(tool: DSHTool, parameters: any): Promise<any> {
    const { execute_command } = await import('../tools/system-tools');
    return await execute_command(parameters.command, parameters.workdir);
  }

  private async executeWebTool(tool: DSHTool, parameters: any): Promise<any> {
    const { web_search } = await import('../tools/web-tools');
    return await web_search(parameters.query);
  }

  private async executeAgentTool(tool: DSHTool, parameters: any, agentId?: string): Promise<any> {
    const { subagent } = await import('../tools/agent-tools');
    
    // 构造subagent调用参数
    const subagentParams = {
      description: parameters.description,
      prompt: parameters.prompt,
      run_in_background: parameters.run_in_background || false
    };

    return await subagent(subagentParams);
  }

  // 工作流执行
  async executeWorkflow(
    workflowId: string,
    quantumAgentId?: string
  ): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    const results: Map<string, any> = new Map();
    const executedSteps = new Set<string>();

    // 按依赖关系排序执行步骤
    const sortedSteps = this.topologicalSort(workflow.steps);

    for (const step of sortedSteps) {
      try {
        // 检查依赖是否完成
        if (step.dependsOn) {
          for (const depId of step.dependsOn) {
            if (!executedSteps.has(depId)) {
              throw new Error(`Step ${step.id} depends on uncompleted step ${depId}`);
            }
          }
        }

        // 执行步骤
        const result = await this.executeTool(
          step.tool,
          step.parameters,
          quantumAgentId
        );

        results.set(step.id, result);
        executedSteps.add(step.id);
        
        this.emit('workflow_step_completed', { 
          workflowId, 
          stepId: step.id, 
          result 
        });
      } catch (error) {
        console.error(`[DSHIntegration] Error executing workflow step ${step.id}:`, error);
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
    steps.forEach(step => {
      graph.set(step.id, new Set());
      inDegree.set(step.id, 0);
    });

    steps.forEach(step => {
      if (step.dependsOn) {
        step.dependsOn.forEach(depId => {
          graph.get(depId)!.add(step.id);
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
    while (queue.length > 0) {
      const stepId = queue.shift()!;
      const step = steps.find(s => s.id === stepId)!;
      result.push(step);

      graph.get(stepId)!.forEach(neighborId => {
        inDegree.set(neighborId, inDegree.get(neighborId)! - 1);
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId);
        }
      });
    }

    if (result.length !== steps.length) {
      throw new Error('Workflow has circular dependencies');
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

  getMetrics(): any {
    return {
      toolsCount: this.tools.size,
      workflowsCount: this.workflows.size,
      agentMappingsCount: this.agentMapping.size,
      isInitialized: this.isInitialized
    };
  }
}

// 工具模块导出
export * from '../tools/fs-tools';
export * from '../tools/system-tools';
export * from '../tools/web-tools';
export * from '../tools/agent-tools';