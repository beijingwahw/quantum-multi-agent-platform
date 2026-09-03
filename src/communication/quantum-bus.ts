import { EventEmitter } from 'events';
import { createHash, timingSafeEqual } from 'crypto';
import type {
  QuantumMessage,
  MessagePriority,
  MessageType,
  QuantumState,
} from '../types/quantum-types';
import type { RawData } from 'ws';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { logInfo, logWarn } from '../utils/logger';

export interface WebSocketConnection {
  id: string;
  agentId: string;
  ws: WebSocket;
  lastPing: Date;
  subscriptions: string[];
}

// QuantumBus所需配置切片：平台配置的可选子集（端口与离线队列上限）
export interface QuantumBusConfig {
  communication?: {
    port?: number;
    maxQueuedMessages?: number;
    /**
     * 可选共享令牌鉴权。设置后：authenticate 必须携带匹配 token，
     * 且 console_query/console_command 仅对已认证连接开放；
     * 未设置时保持本地开发模式（无鉴权，仅建议监听本机）。
     */
    authToken?: string;
    /** 单连接订阅频道数上限（防恶意客户端无界增长） */
    maxSubscriptions?: number;
    /** 单帧消息大小上限（字节），超出即由 ws 层断开，防内存耗尽 */
    maxMessageSize?: number;
    /** 心跳 ping 间隔（毫秒） */
    heartbeatIntervalMs?: number;
    /** 超过该时长未 pong 即判定连接过期（毫秒） */
    heartbeatTimeoutMs?: number;
  };
}

/**
 * 总线系统消息的坍缩量子态（系统消息不参与量子调度语义，
 * 固定坍缩于原点——三处调用点共用同一构造）。
 */
function collapsedSystemQuantumState(): QuantumState {
  return {
    id: randomUUID(),
    amplitude: 1,
    phase: 0,
    collapsed: true,
    position: { x: 0, y: 0, z: 0 },
  };
}

// 总线运行指标快照（getMetrics返回结构）
export interface QuantumBusMetrics {
  started: boolean;
  port: number | null;
  connections: number;
  activeConnections: number;
  messageQueueSize: number;
  droppedMessages: number;
  agentsOnline: number;
  uptime: number;
}

// 客户端上行消息：控制协议分支与常规消息的判别联合
// （JSON.parse产物，字段存在性按各分支实际消费的最小形状声明）
type IncomingClientMessage =
  | { type: 'authenticate'; agentId: string; token?: string }
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
  | { type: 'console_query' }
  | { type: 'console_command'; action: string; payload?: unknown }
  | QuantumMessage;

export class QuantumBus extends EventEmitter {
  private messageQueue = new Map<string, QuantumMessage[]>();
  private connections = new Map<string, WebSocketConnection>();
  private wsServer: WebSocketServer | null = null;
  private config: QuantumBusConfig;
  private started = false;
  private droppedMessages = 0;
  // 并发start()复用同一次监听Promise，防止创建两个WebSocketServer
  private startPromise: Promise<void> | null = null;
  // 总线自身启动时刻（uptime基准，非进程存活时间）
  private startedAt: number | null = null;

  constructor(config: QuantumBusConfig) {
    super();
    this.config = config;
  }

  // 延迟启动：仅在显式调用start()时占用端口，支持port 0随机分配
  start(): Promise<void> {
    if (this.startPromise) return this.startPromise;

    const port = this.config.communication?.port ?? 8080;
    // ws 层直接拒绝超大帧（默认 1MB），杜绝未认证客户端的内存耗尽攻击
    const maxPayload = this.config.communication?.maxMessageSize ?? 1024 * 1024;

    this.startPromise = new Promise((resolve, reject) => {
      const server = new WebSocketServer({ port, path: '/quantum-bus', maxPayload });
      this.wsServer = server;

      server.on('error', (error: Error) => {
        if (!this.started) {
          this.startPromise = null;
          this.wsServer = null;
          reject(error);
        } else {
          logWarn('QuantumBus', 'Server error:', error);
          this.emit('server_error', error);
        }
      });

      server.on('connection', (ws: WebSocket) => {
        this.handleConnection(ws);
      });

      server.on('listening', () => {
        this.started = true;
        this.startedAt = Date.now();
        const address = server.address();
        const actualPort = typeof address === 'object' && address !== null ? address.port : port;
        logInfo('QuantumBus', `WebSocket server started on port ${actualPort}`);
        this.emit('started', { port: actualPort });
        resolve();
      });
    });
    return this.startPromise;
  }

  getPort(): number | null {
    if (!this.wsServer) return null;
    const address = this.wsServer.address();
    return typeof address === 'object' && address !== null ? address.port : null;
  }

  isStarted(): boolean {
    return this.started;
  }

  private handleConnection(ws: WebSocket): void {
    const connectionId = randomUUID();

    const connection: WebSocketConnection = {
      id: connectionId,
      agentId: '',
      ws,
      lastPing: new Date(),
      subscriptions: [],
    };

    this.connections.set(connectionId, connection);

    ws.on('message', (data: RawData) => {
      try {
        const text = Buffer.isBuffer(data)
          ? data.toString('utf8')
          : Array.isArray(data)
            ? Buffer.concat(data).toString('utf8')
            : Buffer.from(data).toString('utf8');
        const message = JSON.parse(text) as IncomingClientMessage;
        this.handleIncomingMessage(connectionId, message);
      } catch (error) {
        logWarn('QuantumBus', `Error parsing message from ${connectionId}:`, error);
      }
    });

    ws.on('close', () => {
      this.connections.delete(connectionId);
      this.emit('connection_closed', connectionId);
    });

    ws.on('error', (error) => {
      logWarn('QuantumBus', `Error from connection ${connectionId}:`, error);
      this.connections.delete(connectionId);
    });

    ws.on('pong', () => {
      connection.lastPing = new Date();
    });

    // 发送连接确认
    this.sendToConnection(connectionId, {
      id: randomUUID(),
      type: 'connection_ack',
      sourceAgentId: 'quantum-bus',
      content: {
        connectionId,
        message: 'Connection established to Quantum Bus',
      },
      timestamp: new Date(),
      priority: 'medium',
      quantumState: collapsedSystemQuantumState(),
    });

    // 启动心跳检测
    this.startHeartbeat(connectionId);
  }

  private startHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const intervalMs = this.config.communication?.heartbeatIntervalMs ?? 10_000;
    const timeoutMs = this.config.communication?.heartbeatTimeoutMs ?? 30_000;

    const interval = setInterval(() => {
      const connection = this.connections.get(connectionId);
      if (connection?.ws.readyState === WebSocket.OPEN) {
        const now = new Date();
        const timeSinceLastPing = now.getTime() - connection.lastPing.getTime();

        if (timeSinceLastPing > timeoutMs) {
          logInfo('QuantumBus', `Closing stale connection ${connectionId}`);
          connection.ws.terminate();
          this.connections.delete(connectionId);
          clearInterval(interval);
        } else {
          connection.ws.ping();
        }
      } else {
        clearInterval(interval);
      }
    }, intervalMs);

    // 确保连接关闭后定时器最终被回收
    connection.ws.on('close', () => {
      clearInterval(interval);
    });
  }

  /** 常数时间令牌比较（先哈希再比对，长度差异不泄露时序信息） */
  private tokenMatches(received: string | undefined, expected: string): boolean {
    if (typeof received !== 'string') return false;
    const a = createHash('sha256').update(received).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
  }

  private handleIncomingMessage(connectionId: string, message: IncomingClientMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (message.type === 'authenticate') {
      const expectedToken = this.config.communication?.authToken;
      if (expectedToken !== undefined && !this.tokenMatches(message.token, expectedToken)) {
        // 鉴权失败：断开连接，且不绑定身份（防止任意客户端冒认agentId）
        logWarn(
          'QuantumBus',
          `Authentication failed for agent '${message.agentId}' on ${connectionId}`,
        );
        this.emit('authentication_failed', { connectionId, agentId: message.agentId });
        connection.ws.close(4001, 'authentication failed');
        return;
      }
      connection.agentId = message.agentId;
      this.emit('agent_authenticated', { connectionId, agentId: message.agentId });
      // 身份确认后立即投递该agent的离线消息
      this.processQueuedMessages(message.agentId);
    } else if (message.type === 'subscribe') {
      const cap = this.config.communication?.maxSubscriptions ?? 64;
      if (
        connection.subscriptions.length < cap &&
        !connection.subscriptions.includes(message.channel)
      ) {
        connection.subscriptions.push(message.channel);
      }
      this.emit('agent_subscribed', {
        connectionId,
        agentId: connection.agentId,
        channel: message.channel,
      });
    } else if (message.type === 'unsubscribe') {
      connection.subscriptions = connection.subscriptions.filter((ch) => ch !== message.channel);
      this.emit('agent_unsubscribed', {
        connectionId,
        agentId: connection.agentId,
        channel: message.channel,
      });
    } else if (message.type === 'console_query') {
      // 鉴权开启时，控制台协议仅对已认证连接开放
      if (this.config.communication?.authToken !== undefined && !connection.agentId) {
        logWarn('QuantumBus', `Unauthenticated console_query from ${connectionId} rejected`);
        return;
      }
      // 控制台快照查询：无论是否认证都直接回发到该连接
      const respond = (content: unknown) => {
        this.sendToConnection(connectionId, {
          id: randomUUID(),
          type: 'status_update',
          sourceAgentId: 'quantum-bus',
          content,
          timestamp: new Date(),
          priority: 'medium',
          quantumState: collapsedSystemQuantumState(),
        });
      };
      this.emit('console_query', { connectionId, agentId: connection.agentId, respond });
    } else if (message.type === 'console_command') {
      // 鉴权开启时，控制台远程命令（submit_task / add_agent / complete_task）
      // 仅对已认证连接开放——该通道可变更平台状态，必须先过鉴权
      if (this.config.communication?.authToken !== undefined && !connection.agentId) {
        logWarn('QuantumBus', `Unauthenticated console_command from ${connectionId} rejected`);
        return;
      }
      this.emit('console_command', {
        connectionId,
        agentId: connection.agentId,
        action: message.action,
        payload: message.payload,
      });
    } else {
      // 处理常规消息
      this.processMessage(message);
    }
  }

  private processMessage(message: QuantumMessage): void {
    // 验证消息格式
    if (!this.validateMessage(message)) {
      logWarn('QuantumBus', 'Invalid message format:', message);
      return;
    }

    // 根据目标路由消息
    if (message.targetAgentId) {
      this.sendToAgent(message.targetAgentId, message);
    } else if (message.targetAgentIds) {
      message.targetAgentIds.forEach((agentId) => {
        this.sendToAgent(agentId, message);
      });
    } else {
      // 广播消息
      this.broadcastMessage(message);
    }
  }

  private validateMessage(message: QuantumMessage): boolean {
    return Boolean(message.id && message.sourceAgentId && message.quantumState);
  }

  // 消息发送方法
  sendToAgent(agentId: string, message: QuantumMessage): boolean {
    let sent = false;

    // 序列化一次，供该agent的全部连接复用
    let payload: string | null = null;

    // 查找所有连接到该agent的连接
    for (const connection of this.connections.values()) {
      if (connection.agentId === agentId && connection.ws.readyState === WebSocket.OPEN) {
        payload ??= JSON.stringify(message);
        this.sendToConnection(connection.id, message, payload);
        sent = true;
      }
    }

    if (!sent) {
      // 如果agent不在线，将消息加入队列
      this.queueMessageForAgent(agentId, message);
    }

    return sent;
  }

  /** 底层发送：返回是否真正送达（OPEN且未抛错），供队列逻辑保序 */
  private sendToConnection(
    connectionId: string,
    message: QuantumMessage,
    preSerialized?: string,
  ): boolean {
    const connection = this.connections.get(connectionId);
    if (connection?.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(preSerialized ?? JSON.stringify(message));
        return true;
      } catch (error) {
        logWarn('QuantumBus', `Error sending message to ${connectionId}:`, error);
        return false;
      }
    }
    return false;
  }

  private queueMessageForAgent(agentId: string, message: QuantumMessage): void {
    let queue = this.messageQueue.get(agentId);
    if (!queue) {
      queue = [];
      this.messageQueue.set(agentId, queue);
    }
    queue.push(message);

    // 队列封顶：丢弃最旧消息，防止离线agent导致内存无限增长
    const cap = this.config.communication?.maxQueuedMessages ?? 1000;
    while (queue.length > cap) {
      queue.shift();
      this.droppedMessages++;
    }

    this.emit('message_queued', { agentId, message });
  }

  private broadcastMessage(message: QuantumMessage): void {
    // 收集开放连接后序列化一次，零连接时完全跳过序列化
    const openConnections: string[] = [];
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        // 检查连接是否订阅了相关频道（无订阅=接收全部广播）
        if (
          connection.subscriptions.length === 0 ||
          this.isRelevantForConnection(message, connection)
        ) {
          openConnections.push(connection.id);
        }
      }
    }

    if (openConnections.length === 0) return;

    const payload = JSON.stringify(message);
    for (const connectionId of openConnections) {
      this.sendToConnection(connectionId, message, payload);
    }
  }

  private isRelevantForConnection(
    message: QuantumMessage,
    connection: WebSocketConnection,
  ): boolean {
    // 这里可以根据消息类型和连接的订阅来判断相关性
    // 简化实现：如果连接没有特定订阅，则接收所有消息
    if (connection.subscriptions.length === 0) {
      return true;
    }

    // 检查消息类型是否在订阅列表中
    return connection.subscriptions.includes(message.type);
  }

  // 消息创建和发送
  createMessage(
    sourceAgentId: string,
    type: MessageType,
    content: unknown,
    targetAgentId?: string,
    targetAgentIds?: string[],
    priority: MessagePriority = 'medium',
  ): QuantumMessage {
    const message: QuantumMessage = {
      id: randomUUID(),
      type,
      sourceAgentId,
      targetAgentId,
      targetAgentIds,
      content,
      timestamp: new Date(),
      priority,
      quantumState: collapsedSystemQuantumState(),
    };

    this.processMessage(message);
    return message;
  }

  // 消息重发队列处理
  processQueuedMessages(agentId: string): number {
    const queuedMessages = this.messageQueue.get(agentId);
    if (!queuedMessages || queuedMessages.length === 0) return 0;

    let deliveredCount = 0;
    const remainingMessages: QuantumMessage[] = [];

    for (const message of queuedMessages) {
      const connection = Array.from(this.connections.values()).find(
        (conn) => conn.agentId === agentId && conn.ws.readyState === WebSocket.OPEN,
      );

      // 以sendToConnection的真实送达结果为准：连接在检查与发送之间
      // 掉线时消息保留在队列，杜绝"计为已投递但实际丢失"
      if (connection && this.sendToConnection(connection.id, message)) {
        deliveredCount++;
      } else {
        remainingMessages.push(message);
      }
    }

    if (remainingMessages.length > 0) {
      this.messageQueue.set(agentId, remainingMessages);
    } else {
      this.messageQueue.delete(agentId);
    }

    return deliveredCount;
  }

  // 查询和监控
  getConnectionCount(): number {
    return this.connections.size;
  }

  getActiveConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.ws.readyState === WebSocket.OPEN,
    );
  }

  getMessageQueueSize(): number {
    return Array.from(this.messageQueue.values()).reduce(
      (total, messages) => total + messages.length,
      0,
    );
  }

  getAgentsOnline(): string[] {
    const agentSet = new Set<string>();
    for (const connection of this.connections.values()) {
      if (connection.agentId && connection.ws.readyState === WebSocket.OPEN) {
        agentSet.add(connection.agentId);
      }
    }
    return Array.from(agentSet);
  }

  createBroadcastMessage(
    sourceAgentId: string,
    type: MessageType,
    content: unknown,
    priority: MessagePriority = 'medium',
  ): QuantumMessage {
    return this.createMessage(sourceAgentId, type, content, undefined, undefined, priority);
  }

  // 系统管理
  shutdown(): void {
    if (!this.started) return;

    logInfo('QuantumBus', 'Shutting down...');

    // 关闭所有连接
    for (const connection of this.connections.values()) {
      connection.ws.terminate();
    }
    this.connections.clear();
    this.messageQueue.clear();

    // 关闭WebSocket服务器
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }
    this.started = false;
    this.startPromise = null;
    this.startedAt = null;

    logInfo('QuantumBus', 'Shutdown complete');
  }

  getMetrics(): QuantumBusMetrics {
    return {
      started: this.started,
      port: this.getPort(),
      connections: this.getConnectionCount(),
      activeConnections: this.getActiveConnections().length,
      messageQueueSize: this.getMessageQueueSize(),
      droppedMessages: this.droppedMessages,
      agentsOnline: this.getAgentsOnline().length,
      uptime: this.startedAt !== null ? (Date.now() - this.startedAt) / 1000 : 0,
    };
  }
}
