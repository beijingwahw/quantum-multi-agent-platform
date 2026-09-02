import { EventEmitter } from 'events';
import { QuantumMessage, MessagePriority, MessageType } from '../types/quantum-types';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
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
  | { type: 'authenticate'; agentId: string }
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
  | { type: 'console_query' }
  | { type: 'console_command'; action: string; payload?: unknown }
  | QuantumMessage;

export class QuantumBus extends EventEmitter {
  private messageQueue: Map<string, QuantumMessage[]> = new Map();
  private connections: Map<string, WebSocketConnection> = new Map();
  private wsServer: WebSocketServer | null = null;
  private config: QuantumBusConfig;
  private started: boolean = false;
  private droppedMessages: number = 0;

  constructor(config: QuantumBusConfig) {
    super();
    this.config = config;
  }

  // 延迟启动：仅在显式调用start()时占用端口，支持port 0随机分配
  start(): Promise<void> {
    if (this.started) return Promise.resolve();

    const port = this.config.communication?.port ?? 8080;

    return new Promise((resolve, reject) => {
      this.wsServer = new WebSocketServer({ port, path: '/quantum-bus' });

      this.wsServer.on('error', (error: Error) => {
        if (!this.started) {
          reject(error);
        } else {
          logWarn('QuantumBus', 'Server error:', error);
          this.emit('server_error', error);
        }
      });

      this.wsServer.on('connection', (ws: WebSocket) => {
        this.handleConnection(ws);
      });

      this.wsServer.on('listening', () => {
        this.started = true;
        const address = this.wsServer!.address();
        const actualPort = typeof address === 'object' && address !== null ? address.port : port;
        logInfo('QuantumBus', `WebSocket server started on port ${actualPort}`);
        this.emit('started', { port: actualPort });
        resolve();
      });
    });
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
    const connectionId = uuidv4();

    const connection: WebSocketConnection = {
      id: connectionId,
      agentId: '',
      ws,
      lastPing: new Date(),
      subscriptions: []
    };

    this.connections.set(connectionId, connection);

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data.toString());
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
      id: uuidv4(),
      type: 'connection_ack' as MessageType,
      sourceAgentId: 'quantum-bus',
      content: {
        connectionId,
        message: 'Connection established to Quantum Bus'
      },
      timestamp: new Date(),
      priority: 'medium' as MessagePriority,
      quantumState: {
        id: uuidv4(),
        amplitude: 1,
        phase: 0,
        collapsed: true,
        position: { x: 0, y: 0, z: 0 }
      }
    });

    // 启动心跳检测
    this.startHeartbeat(connectionId);
  }

  private startHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const interval = setInterval(() => {
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        const now = new Date();
        const timeSinceLastPing = now.getTime() - connection.lastPing.getTime();

        if (timeSinceLastPing > 30000) { // 30秒
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
    }, 10000);

    // 确保连接关闭后定时器最终被回收
    connection.ws.on('close', () => clearInterval(interval));
  }
  private handleIncomingMessage(connectionId: string, message: IncomingClientMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (message.type === 'authenticate') {
      connection.agentId = message.agentId;
      this.emit('agent_authenticated', { connectionId, agentId: message.agentId });
      // 身份确认后立即投递该agent的离线消息
      this.processQueuedMessages(message.agentId);
    } else if (message.type === 'subscribe') {
      connection.subscriptions.push(message.channel);
      this.emit('agent_subscribed', { connectionId, agentId: connection.agentId, channel: message.channel });
    } else if (message.type === 'unsubscribe') {
      connection.subscriptions = connection.subscriptions.filter(ch => ch !== message.channel);
      this.emit('agent_unsubscribed', { connectionId, agentId: connection.agentId, channel: message.channel });
    } else if (message.type === 'console_query') {
      // 控制台快照查询：无论是否认证都直接回发到该连接
      const respond = (content: unknown) => {
        this.sendToConnection(connectionId, {
          id: uuidv4(),
          type: 'status_update',
          sourceAgentId: 'quantum-bus',
          content,
          timestamp: new Date(),
          priority: 'medium',
          quantumState: {
            id: uuidv4(),
            amplitude: 1,
            phase: 0,
            collapsed: true,
            position: { x: 0, y: 0, z: 0 }
          }
        });
      };
      this.emit('console_query', { connectionId, agentId: connection.agentId, respond });
    } else if (message.type === 'console_command') {
      // 控制台远程命令（submit_task / add_agent / complete_task）
      this.emit('console_command', {
        connectionId,
        agentId: connection.agentId,
        action: message.action,
        payload: message.payload
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
      message.targetAgentIds.forEach(agentId => {
        this.sendToAgent(agentId, message);
      });
    } else {
      // 广播消息
      this.broadcastMessage(message);
    }
  }

  private validateMessage(message: QuantumMessage): boolean {
    return Boolean(
      message &&
      message.id &&
      message.type &&
      message.sourceAgentId &&
      message.timestamp &&
      message.quantumState
    );
  }

  // 消息发送方法
  sendToAgent(agentId: string, message: QuantumMessage): boolean {
    let sent = false;

    // 序列化一次，供该agent的全部连接复用
    let payload: string | null = null;

    // 查找所有连接到该agent的连接
    for (const connection of this.connections.values()) {
      if (connection.agentId === agentId && connection.ws.readyState === WebSocket.OPEN) {
        if (payload === null) payload = JSON.stringify(message);
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

  private sendToConnection(connectionId: string, message: QuantumMessage, preSerialized?: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(preSerialized ?? JSON.stringify(message));
      } catch (error) {
        logWarn('QuantumBus', `Error sending message to ${connectionId}:`, error);
      }
    }
  }

  private queueMessageForAgent(agentId: string, message: QuantumMessage): void {
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(agentId, []);
    }
    const queue = this.messageQueue.get(agentId)!;
    queue.push(message);

    // 队列封顶：丢弃最旧消息，防止离线agent导致内存无限增长
    const cap = this.config?.communication?.maxQueuedMessages ?? 1000;
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
        // 检查连接是否订阅了相关频道
        if (message.targetAgentIds || connection.subscriptions.length === 0 ||
            this.isRelevantForConnection(message, connection)) {
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

  private isRelevantForConnection(message: QuantumMessage, connection: WebSocketConnection): boolean {
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
    priority: MessagePriority = 'medium'
  ): QuantumMessage {
    const message: QuantumMessage = {
      id: uuidv4(),
      type,
      sourceAgentId,
      targetAgentId,
      targetAgentIds,
      content,
      timestamp: new Date(),
      priority,
      quantumState: {
        id: uuidv4(),
        amplitude: 1,
        phase: 0,
        collapsed: true,
        position: { x: 0, y: 0, z: 0 }
      }
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
      const connection = Array.from(this.connections.values())
        .find(conn => conn.agentId === agentId && conn.ws.readyState === WebSocket.OPEN);
      
      if (connection) {
        this.sendToConnection(connection.id, message);
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
    return Array.from(this.connections.values())
      .filter(conn => conn.ws.readyState === WebSocket.OPEN);
  }

  getMessageQueueSize(): number {
    return Array.from(this.messageQueue.values())
      .reduce((total, messages) => total + messages.length, 0);
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

  // 量子特殊消息类型
  createQuantumEntanglementMessage(
    sourceAgentId: string,
    targetAgentId: string,
    entanglementData: unknown
  ): QuantumMessage {
    return this.createMessage(
      sourceAgentId,
      'quantum_entanglement',
      entanglementData,
      targetAgentId,
      undefined,
      'high'
    );
  }

  createBroadcastMessage(
    sourceAgentId: string,
    type: MessageType,
    content: unknown,
    priority: MessagePriority = 'medium'
  ): QuantumMessage {
    return this.createMessage(
      sourceAgentId,
      type,
      content,
      undefined,
      undefined,
      priority
    );
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
      uptime: process.uptime()
    };
  }
}
