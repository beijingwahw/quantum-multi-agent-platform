import { Agent, AgentState, AgentType, QuantumEntanglement, Vector3D } from '../types/quantum-types';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logInfo } from '../utils/logger';

// AgentManager所需配置切片：平台配置的可选子集（心跳间隔）
export interface AgentManagerConfig {
  communication?: {
    heartbeatInterval?: number;
  };
}

// agent统计指标快照（getAgentMetrics返回结构）
export interface AgentManagerMetrics {
  totalAgents: number;
  agentsByState: Record<string, number>;
  agentsByType: Record<string, number>;
  averageLoad: number;
  entanglementCount: number;
}

// 系统健康检查报告（checkSystemHealth返回结构）
export interface SystemHealthReport {
  totalAgents: number;
  healthyAgents: number;
  offlineAgents: number;
  overloadedAgents: number;
  systemHealth: number;
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private entanglements: Map<string, QuantumEntanglement> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: AgentManagerConfig;

  constructor(config: AgentManagerConfig) {
    super();
    this.config = config;
  }

  // Agent注册和管理
  registerAgent(agentConfig: {
    name: string;
    type: AgentType;
    capabilities: string[];
    position?: Vector3D;
    entanglementTargets?: string[];
  }): Agent {
    const agent: Agent = {
      id: uuidv4(),
      name: agentConfig.name,
      type: agentConfig.type,
      capabilities: agentConfig.capabilities,
      state: 'idle',
      load: 0,
      position: agentConfig.position || { x: 0, y: 0, z: 0 },
      quantumEntanglement: agentConfig.entanglementTargets || [],
      lastHeartbeat: new Date()
    };

    this.agents.set(agent.id, agent);
    
    // 设置心跳检测
    this.startHeartbeat(agent.id);
    
    // 创建量子纠缠
    if (agentConfig.entanglementTargets) {
      agentConfig.entanglementTargets.forEach(targetId => {
        this.createEntanglement(agent.id, targetId);
      });
    }

    this.emit('agent_registered', agent);
    logInfo('AgentManager', `Agent registered: ${agent.name} (${agent.id})`);
    
    return agent;
  }

  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // 停止心跳检测
    this.stopHeartbeat(agentId);
    
    // 移除所有量子纠缠
    this.removeEntanglements(agentId);
    
    this.agents.delete(agentId);
    this.emit('agent_unregistered', agent);
    logInfo('AgentManager', `Agent unregistered: ${agent.name} (${agentId})`);
    
    return true;
  }

  updateAgent(agentId: string, updates: Partial<Agent>): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const updatedAgent = { ...agent, ...updates };
    updatedAgent.lastHeartbeat = new Date();
    this.agents.set(agentId, updatedAgent);
    
    this.emit('agent_updated', updatedAgent);
    return true;
  }

  // 状态管理
  setAgentState(agentId: string, state: AgentState): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const previousState = agent.state;
    agent.state = state;
    agent.lastHeartbeat = new Date();
    this.agents.set(agentId, agent);
    
    this.emit('agent_state_changed', { agentId, previousState, newState: state });
    return true;
  }

  increaseLoad(agentId: string, increment: number = 1): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.load = Math.min(agent.load + increment, 100); // 最大负载100
    agent.lastHeartbeat = new Date();
    this.agents.set(agentId, agent);
    
    // 如果负载过高，可能需要调整状态
    if (agent.load > 80) {
      this.setAgentState(agentId, 'overloaded');
    }
    
    this.emit('agent_load_changed', agent);
    return true;
  }

  decreaseLoad(agentId: string, decrement: number = 1): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.load = Math.max(agent.load - decrement, 0);
    agent.lastHeartbeat = new Date();
    this.agents.set(agentId, agent);
    
    // 如果负载降低，可以恢复正常状态
    if (agent.load <= 80 && agent.state === 'overloaded') {
      this.setAgentState(agentId, 'idle');
    }
    
    this.emit('agent_load_changed', agent);
    return true;
  }

  // 心跳管理
  // 进程内agent随进程存活：定时刷新心跳以维持存活状态。
  // 'offline'只能通过显式调用setAgentState设置（例如远端agent失联）。
  private startHeartbeat(agentId: string): void {
    const interval = setInterval(() => {
      const agent = this.agents.get(agentId);
      if (!agent) {
        this.stopHeartbeat(agentId);
        return;
      }
      if (agent.state !== 'offline') {
        agent.lastHeartbeat = new Date();
      }
    }, this.config.communication?.heartbeatInterval || 5000);

    this.heartbeatIntervals.set(agentId, interval);
  }

  // 远端agent显式心跳：刷新存活时间戳
  heartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.lastHeartbeat = new Date();
    if (agent.state === 'offline') {
      this.setAgentState(agentId, 'idle');
    }
    return true;
  }

  private stopHeartbeat(agentId: string): void {
    const interval = this.heartbeatIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(agentId);
    }
  }

  // 量子纠缠管理
  createEntanglement(agentId1: string, agentId2: string): boolean {
    const agent1 = this.agents.get(agentId1);
    const agent2 = this.agents.get(agentId2);
    
    if (!agent1 || !agent2) return false;

    // 检查是否已经存在纠缠
    const existingEntanglement = Array.from(this.entanglements.values()).find(
      e => (e.agentId1 === agentId1 && e.agentId2 === agentId2) ||
           (e.agentId1 === agentId2 && e.agentId2 === agentId1)
    );

    if (existingEntanglement) {
      // 更新现有纠缠
      existingEntanglement.lastInteraction = new Date();
      existingEntanglement.strength = Math.min(existingEntanglement.strength + 0.1, 1);
      return true;
    }

    const entanglement: QuantumEntanglement = {
      id: uuidv4(),
      agentId1,
      agentId2,
      strength: 0.1,
      lastInteraction: new Date(),
      correlation: 0,
      sharedResources: []
    };

    this.entanglements.set(entanglement.id, entanglement);
    
    // 更新agent的纠缠列表
    if (!agent1.quantumEntanglement.includes(agentId2)) {
      agent1.quantumEntanglement.push(agentId2);
    }
    if (!agent2.quantumEntanglement.includes(agentId1)) {
      agent2.quantumEntanglement.push(agentId1);
    }

    this.emit('entanglement_created', entanglement);
    logInfo('AgentManager', `Entanglement created between ${agent1.name} and ${agent2.name}`);
    return true;
  }

  removeEntanglements(agentId: string): void {
    // 找到所有与该agent相关的纠缠
    const entanglementsToRemove = Array.from(this.entanglements.values())
      .filter(e => e.agentId1 === agentId || e.agentId2 === agentId);

    // 移除纠缠
    entanglementsToRemove.forEach(entanglement => {
      this.entanglements.delete(entanglement.id);
      
      // 更新相关agent的纠缠列表
      if (entanglement.agentId1 === agentId) {
        const agent2 = this.agents.get(entanglement.agentId2);
        if (agent2) {
          agent2.quantumEntanglement = agent2.quantumEntanglement.filter(id => id !== agentId);
        }
      } else {
        const agent1 = this.agents.get(entanglement.agentId1);
        if (agent1) {
          agent1.quantumEntanglement = agent1.quantumEntanglement.filter(id => id !== agentId);
        }
      }
    });

    // 清除agent的纠缠列表
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.quantumEntanglement = [];
    }
  }

  // 查询和搜索
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByType(type: AgentType): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.type === type);
  }

  getAgentsByCapability(capability: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.capabilities.includes(capability) && agent.state === 'idle'
    );
  }

  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.state === 'idle' && agent.load < 80
    );
  }

  getEntanglements(agentId?: string): QuantumEntanglement[] {
    if (agentId) {
      return Array.from(this.entanglements.values()).filter(
        e => e.agentId1 === agentId || e.agentId2 === agentId
      );
    }
    return Array.from(this.entanglements.values());
  }

  // 统计和监控
  getAgentMetrics(): AgentManagerMetrics {
    const totalAgents = this.agents.size;
    const agentsByState = Array.from(this.agents.values()).reduce((acc, agent) => {
      acc[agent.state] = (acc[agent.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const agentsByType = Array.from(this.agents.values()).reduce((acc, agent) => {
      acc[agent.type] = (acc[agent.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageLoad = totalAgents > 0
      ? Array.from(this.agents.values()).reduce((sum, agent) => sum + agent.load, 0) / totalAgents
      : 0;

    return {
      totalAgents,
      agentsByState,
      agentsByType,
      averageLoad,
      entanglementCount: this.entanglements.size
    };
  }

  // 健康检查
  checkSystemHealth(): SystemHealthReport {
    const now = new Date();
    const agentsArray = Array.from(this.agents.values());

    // 同一个agent可能同时离线且过载，只计一次异常，避免健康度为负
    const offlineIds = new Set(
      agentsArray
        .filter(agent => now.getTime() - agent.lastHeartbeat.getTime() > 30000)
        .map(agent => agent.id)
    );
    const overloadedIds = new Set(
      agentsArray.filter(agent => agent.state === 'overloaded').map(agent => agent.id)
    );

    const unhealthyIds = new Set([...offlineIds, ...overloadedIds]);
    const healthyAgents = agentsArray.length - unhealthyIds.size;

    return {
      totalAgents: agentsArray.length,
      healthyAgents,
      offlineAgents: offlineIds.size,
      overloadedAgents: overloadedIds.size,
      systemHealth: agentsArray.length > 0 ? healthyAgents / agentsArray.length : 1
    };
  }

  // 清理工作
  cleanup(): void {
    // 清理离线agent
    const now = new Date();
    const offlineAgents = Array.from(this.agents.values()).filter(agent => {
      const timeSinceLastHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();
      return timeSinceLastHeartbeat > 60000; // 1分钟
    });

    offlineAgents.forEach(agent => {
      logInfo('AgentManager', `Cleaning up offline agent: ${agent.name}`);
      this.unregisterAgent(agent.id);
    });
  }

  // 停止全部心跳定时器，供平台关闭时调用
  shutdown(): void {
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();
  }
}