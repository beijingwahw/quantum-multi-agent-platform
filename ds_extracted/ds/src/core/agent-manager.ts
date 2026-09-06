import type {
  Agent,
  AgentState,
  AgentType,
  QuantumEntanglement,
  Vector3D,
} from '../types/quantum-types.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { logError, logInfo, logWarn } from '../utils/logger.js';

/** agent 负载超过该阈值判定为 overloaded（agent 状态语义的唯一权威定义） */
export const AGENT_OVERLOAD_THRESHOLD = 80;

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
  private agents = new Map<string, Agent>();
  private entanglements = new Map<string, QuantumEntanglement>();
  /**
   * 纠缠邻接索引（agentId → 其纠缠 id 集合，按创建序）：查重与按 agent
   * 查询从 O(E) 全表扫描降为 O(度)。Set 按 id 插入序遍历 == 全表 Map 的
   * 创建序过滤结果，公开 getter 的返回顺序不变。
   */
  private entanglementsByAgent = new Map<string, Set<string>>();
  /** 规范对键（无序对 → 纠缠 id）：O(1) 查重替代 O(E) 线性找重 */
  private entanglementPairs = new Map<string, string>();
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  /**
   * 心跳的单调时钟旁账（08#45）：lastHeartbeat 是公开 Date 字段（Q4 有意
   * 保留），但失联判定不能吃墙钟——NTP 跳变/手动改时会凭空制造或掩盖
   * offline。performance.now() 单调且不受系统时钟调整影响；两条账在
   * 同一处刷新，消费方（checkSystemHealth）只读旁账。
   */
  private lastBeatMonotonic = new Map<string, number>();
  private config: AgentManagerConfig;

  constructor(config: AgentManagerConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * 监听器异常隔离（08#41）：emit 是同步调用栈——一个坏监听器会把异常
   * 上抛进管理器本体，让 registerAgent/createEntanglement 等核心操作
   * 「半提交」（agent 已入表、调用方却拿到异常）。与 compound-brain
   * 08#1 的修法同款：事件分发失败记日志，绝不动摇状态变更。
   */
  private guardedEmit(event: string, payload: unknown): void {
    try {
      this.emit(event, payload);
    } catch (err) {
      logError('AgentManager', `'${event}' listener failed (state change kept):`, err);
    }
  }

  /** 心跳时戳双账同刷：公开 Date + 内部单调毫秒 */
  private touchHeartbeat(agent: Agent): void {
    agent.lastHeartbeat = new Date();
    this.lastBeatMonotonic.set(agent.id, performance.now());
  }

  // Agent注册和管理
  registerAgent(agentConfig: {
    name: string;
    type: AgentType;
    capabilities: string[];
    position?: Vector3D;
    entanglementTargets?: string[];
  }): Agent {
    // 重名告警（08#44）：不拒绝（重名是合法配置），但日志/快照按名
    // 区分 agent 的消费方需要知道存在歧义
    for (const existing of this.agents.values()) {
      if (existing.name === agentConfig.name) {
        logWarn(
          'AgentManager',
          `Duplicate agent name '${agentConfig.name}' — logs/snapshots by name will be ambiguous`,
        );
        break;
      }
    }
    const agent: Agent = {
      id: randomUUID(),
      name: agentConfig.name,
      type: agentConfig.type,
      capabilities: agentConfig.capabilities,
      state: 'idle',
      load: 0,
      position: agentConfig.position ?? { x: 0, y: 0, z: 0 },
      quantumEntanglement: agentConfig.entanglementTargets ?? [],
      lastHeartbeat: new Date(),
    };

    this.agents.set(agent.id, agent);

    // 设置心跳检测
    this.startHeartbeat(agent.id);

    // 创建量子纠缠
    if (agentConfig.entanglementTargets) {
      agentConfig.entanglementTargets.forEach((targetId) => {
        this.createEntanglement(agent.id, targetId);
      });
    }

    this.guardedEmit('agent_registered', agent);
    logInfo('AgentManager', `Agent registered: ${agent.name} (${agent.id})`);

    return agent;
  }

  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // 停止心跳检测
    this.stopHeartbeat(agentId);
    this.lastBeatMonotonic.delete(agentId);

    // 移除所有量子纠缠
    this.removeEntanglements(agentId);

    this.agents.delete(agentId);
    this.guardedEmit('agent_unregistered', agent);
    logInfo('AgentManager', `Agent unregistered: ${agent.name} (${agentId})`);

    return true;
  }

  /** 允许外部更新的字段不含 id——改 id 会造成 Map 键与对象自指不同步 */
  updateAgent(agentId: string, updates: Partial<Omit<Agent, 'id'>>): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // 原地合并：其余变更路径（setAgentState/increaseLoad/…）都原地变更，
    // 若此处替换为新对象，外部持有的 Agent 引用将永久冻结（分裂脑）
    Object.assign(agent, updates);

    // 不变量收口（08#42）：Object.assign 此前可绕过 load/state 的全部
    // 约束——写 load=95 留 state='idle'、写 state='idle' 留 load=95 都
    // 会让 getAvailableAgents 与三处负载入口口径分裂。凡触及 load 或
    // state 的更新，合并后统一重导出过载不变量：
    //   非 offline 状态 ⇒ state === 'overloaded' ⟺ load > 阈值
    // （offline 是显式失联语义，不由负载推导，heartbeat 恢复时另行收敛）
    if (updates.load !== undefined) {
      agent.load = Math.min(Math.max(agent.load, 0), 100);
    }
    if ((updates.load !== undefined || updates.state !== undefined) && agent.state !== 'offline') {
      const shouldOverload = agent.load > AGENT_OVERLOAD_THRESHOLD;
      if (shouldOverload && agent.state !== 'overloaded') {
        agent.state = 'overloaded';
      } else if (!shouldOverload && agent.state === 'overloaded') {
        agent.state = 'idle';
      }
    }
    this.touchHeartbeat(agent);

    this.guardedEmit('agent_updated', agent);
    return true;
  }

  // 状态管理
  setAgentState(agentId: string, state: AgentState): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const previousState = agent.state;
    agent.state = state;
    this.touchHeartbeat(agent);
    this.agents.set(agentId, agent);

    this.guardedEmit('agent_state_changed', { agentId, previousState, newState: state });
    return true;
  }

  increaseLoad(agentId: string, increment = 1): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.load = Math.min(agent.load + increment, 100); // 最大负载100
    this.touchHeartbeat(agent);
    this.agents.set(agentId, agent);

    // 如果负载过高，可能需要调整状态
    if (agent.load > AGENT_OVERLOAD_THRESHOLD) {
      this.setAgentState(agentId, 'overloaded');
    }

    this.guardedEmit('agent_load_changed', agent);
    return true;
  }

  decreaseLoad(agentId: string, decrement = 1): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.load = Math.max(agent.load - decrement, 0);
    this.touchHeartbeat(agent);
    this.agents.set(agentId, agent);

    // 如果负载降低，可以恢复正常状态
    if (agent.load <= AGENT_OVERLOAD_THRESHOLD && agent.state === 'overloaded') {
      this.setAgentState(agentId, 'idle');
    }

    this.guardedEmit('agent_load_changed', agent);
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
        this.touchHeartbeat(agent);
      }
    }, this.config.communication?.heartbeatInterval ?? 5000);

    // 定时器不阻止进程退出（仅构造未启动的平台不应挂住事件循环）
    interval.unref();

    this.heartbeatIntervals.set(agentId, interval);
  }

  // 远端agent显式心跳：刷新存活时间戳
  heartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    this.touchHeartbeat(agent);
    if (agent.state === 'offline') {
      // 恢复存活但不得违反过载不变量：load > 阈值的 agent 是 overloaded
      // 而非 idle（否则 getAvailableAgents 会把过载 agent 当可用放行）
      this.setAgentState(agentId, agent.load > AGENT_OVERLOAD_THRESHOLD ? 'overloaded' : 'idle');
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
  /** 规范对键：无序 agent 对的唯一字符串（id 不含 NUL 分隔符） */
  private static pairKey(a: string, b: string): string {
    return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
  }

  createEntanglement(agentId1: string, agentId2: string): boolean {
    const agent1 = this.agents.get(agentId1);
    const agent2 = this.agents.get(agentId2);

    // 静默 false 是排障黑洞（08#41）：调用方拿不到「为何纠缠没建立」
    // 的任何信号。保留 false 返回值（既有契约），补告警使失效可见。
    if (!agent1 || !agent2) {
      const missing = agent1 ? agentId2 : agent2 ? agentId1 : `${agentId1}&${agentId2}`;
      logWarn('AgentManager', `createEntanglement: unknown agent '${missing}' — returning false`);
      return false;
    }

    // 检查是否已经存在纠缠（O(1) 对键查重）
    const pairKey = AgentManager.pairKey(agentId1, agentId2);
    const existingId = this.entanglementPairs.get(pairKey);
    const existingEntanglement = existingId ? this.entanglements.get(existingId) : undefined;

    if (existingEntanglement) {
      // 更新现有纠缠
      existingEntanglement.lastInteraction = new Date();
      existingEntanglement.strength = Math.min(existingEntanglement.strength + 0.1, 1);
      return true;
    }

    const entanglement: QuantumEntanglement = {
      id: randomUUID(),
      agentId1,
      agentId2,
      strength: 0.1,
      lastInteraction: new Date(),
      correlation: 0,
      sharedResources: [],
    };

    this.entanglements.set(entanglement.id, entanglement);
    this.entanglementPairs.set(pairKey, entanglement.id);
    for (const id of [agentId1, agentId2]) {
      let ids = this.entanglementsByAgent.get(id);
      if (!ids) {
        ids = new Set<string>();
        this.entanglementsByAgent.set(id, ids);
      }
      ids.add(entanglement.id);
    }

    // 更新agent的纠缠列表
    if (!agent1.quantumEntanglement.includes(agentId2)) {
      agent1.quantumEntanglement.push(agentId2);
    }
    if (!agent2.quantumEntanglement.includes(agentId1)) {
      agent2.quantumEntanglement.push(agentId1);
    }

    this.guardedEmit('entanglement_created', entanglement);
    logInfo('AgentManager', `Entanglement created between ${agent1.name} and ${agent2.name}`);
    return true;
  }

  removeEntanglements(agentId: string): void {
    // 找到所有与该agent相关的纠缠（O(度)，遍历序 == 创建序）
    const ids = this.entanglementsByAgent.get(agentId);
    if (ids) {
      for (const entanglementId of [...ids]) {
        const entanglement = this.entanglements.get(entanglementId);
        if (!entanglement) continue;
        this.entanglements.delete(entanglementId);
        this.entanglementPairs.delete(
          AgentManager.pairKey(entanglement.agentId1, entanglement.agentId2),
        );
        // 双端邻接集同步收缩
        ids.delete(entanglementId);
        const otherId =
          entanglement.agentId1 === agentId ? entanglement.agentId2 : entanglement.agentId1;
        this.entanglementsByAgent.get(otherId)?.delete(entanglementId);

        // 对端引用清理（08#46）：按「对端」而非按 1/2 分支书写——两分支
        // 代码逐字相同只是主语不同，N-way 纠缠若引入会在此静默漏清一半
        const other = this.agents.get(otherId);
        if (other) {
          other.quantumEntanglement = other.quantumEntanglement.filter((id) => id !== agentId);
        }
      }
      this.entanglementsByAgent.delete(agentId);
    }

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
    return Array.from(this.agents.values()).filter((agent) => agent.type === type);
  }

  getAgentsByCapability(capability: string): Agent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.capabilities.includes(capability) && agent.state === 'idle',
    );
  }

  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.state === 'idle' && agent.load < AGENT_OVERLOAD_THRESHOLD,
    );
  }

  getEntanglements(agentId?: string): QuantumEntanglement[] {
    if (agentId) {
      // 邻接集按创建序遍历 == 原全表插入序过滤结果
      const ids = this.entanglementsByAgent.get(agentId);
      if (!ids) return [];
      const out: QuantumEntanglement[] = [];
      for (const id of ids) {
        const e = this.entanglements.get(id);
        if (e) out.push(e);
      }
      return out;
    }
    return Array.from(this.entanglements.values());
  }

  // 统计和监控
  getAgentMetrics(): AgentManagerMetrics {
    const totalAgents = this.agents.size;
    const agentsByState = Array.from(this.agents.values()).reduce<Record<string, number>>(
      (acc, agent) => {
        acc[agent.state] = (acc[agent.state] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const agentsByType = Array.from(this.agents.values()).reduce<Record<string, number>>(
      (acc, agent) => {
        acc[agent.type] = (acc[agent.type] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const averageLoad =
      totalAgents > 0
        ? Array.from(this.agents.values()).reduce((sum, agent) => sum + agent.load, 0) / totalAgents
        : 0;

    return {
      totalAgents,
      agentsByState,
      agentsByType,
      averageLoad,
      entanglementCount: this.entanglements.size,
    };
  }

  // 健康检查
  checkSystemHealth(): SystemHealthReport {
    // 失联判定走单调旁账（08#45，见 lastBeatMonotonic 字段注释）：墙钟
    // 在 NTP 跳变/手动调整时会凭空制造或掩盖 offline。单调毫秒对
    // 「多久没心跳」才是忠实的度量。无旁账的 agent（理论上只有旁账
    // 尚未初始化的窗口期）退回墙钟判定，保持行为连续。
    const nowMono = performance.now();
    const nowWall = Date.now();
    const agentsArray = Array.from(this.agents.values());

    // 失联阈值跟随心跳间隔（至少3个周期，下限30s）：配置了更长心跳间隔的
    // 健康agent不应在两次跳变之间被误判离线
    const heartbeatInterval = this.config.communication?.heartbeatInterval ?? 5000;
    const staleThresholdMs = Math.max(30000, 3 * heartbeatInterval);

    // 同一个agent可能同时离线且过载，只计一次异常，避免健康度为负
    const offlineIds = new Set(
      agentsArray
        .filter((agent) => {
          const mono = this.lastBeatMonotonic.get(agent.id);
          const ageMs =
            mono !== undefined ? nowMono - mono : nowWall - agent.lastHeartbeat.getTime();
          return ageMs > staleThresholdMs;
        })
        .map((agent) => agent.id),
    );
    const overloadedIds = new Set(
      agentsArray.filter((agent) => agent.state === 'overloaded').map((agent) => agent.id),
    );

    const unhealthyIds = new Set([...offlineIds, ...overloadedIds]);
    const healthyAgents = agentsArray.length - unhealthyIds.size;

    return {
      totalAgents: agentsArray.length,
      healthyAgents,
      offlineAgents: offlineIds.size,
      overloadedAgents: overloadedIds.size,
      systemHealth: agentsArray.length > 0 ? healthyAgents / agentsArray.length : 1,
    };
  }

  // 停止全部心跳定时器，供平台关闭时调用
  shutdown(): void {
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();
    this.lastBeatMonotonic.clear();
  }
}
