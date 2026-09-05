import { EventEmitter } from 'events';
import { createHash, timingSafeEqual } from 'crypto';
import type {
  QuantumMessage,
  MessagePriority,
  MessageType,
  QuantumState,
} from '../types/quantum-types.js';
import type { RawData } from 'ws';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { logInfo, logWarn } from '../utils/logger.js';

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
     * 且全部流量路径（subscribe/常规消息/console）仅对已认证连接开放，
     * 已认证连接不得冒用他人 agentId；未设置时保持本地开发模式
     * （无鉴权，host 默认强制 127.0.0.1，见下方 host 字段）。
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
    /**
     * 监听地址。未设置时默认 127.0.0.1——无 authToken 的本地开发模式
     * 绝不暴露到网络接口；需要 LAN 部署时显式传入（如 '0.0.0.0'），
     * 并务必同时配置 authToken。
     */
    host?: string;
    /** 最大并发连接数（防连接洪水），超出即以 1013 拒绝新连接 */
    maxConnections?: number;
  };
}

/** 单连接发送缓冲上限：超过即判定为慢消费者并断开（防内存耗尽） */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;
/** 订阅频道名长度上限：近 1MB 的 JSON 字符串值曾可直达订阅表（F01） */
const MAX_CHANNEL_LENGTH = 128;
/**
 * 离线队列桶数上限（F02）：per-agent 队列封顶挡不住「海量伪造
 * targetAgentId」的基数攻击——每个新桶本身就是一条 Map 记录，
 * 已认证对端可借此无限建桶直至 OOM。
 */
const MAX_QUEUED_AGENTS = 4096;
/** 单连接畸形消息熔断阈值（F07）：持续解析失败即断开，防日志洪泛 */
const MAX_MALFORMED_PER_CONNECTION = 32;
/** 单连接消息速率上限（条/秒，F06）：超速即断开 */
const MAX_MESSAGES_PER_SECOND = 1000;
/** 总线协议版本（F09）：随 connection_ack 广播，破坏性变更时递增 */
const PROTOCOL_VERSION = 1;

/**
 * 对端可控字符串的日志消毒（F10）：剥离控制字符（防伪造日志行/终端
 * 转义序列）并截断长度，仅用于进入日志的远端值。
 */
function sanitizeForLog(value: unknown): string {
  return (
    String(value)
      // u 转义书写控制字符区间（消毒目的本身需要匹配控制字符）
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .slice(0, 64)
  );
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
  /** 攻击面可观测：被边界拒绝的流量分类计数（监控/告警的直接信号） */
  security: {
    /** 未认证即尝试订阅/发消息/控制台命令的次数 */
    unauthenticatedRejections: number;
    /** 已认证连接冒用他人 agentId 的次数 */
    identitySpoofRejections: number;
    /** 同连接改绑身份的拒绝次数 */
    identityRebindRejections: number;
    /** 不合法订阅频道（非字符串/超长）的拒绝次数 */
    invalidChannelRejections: number;
    /** 限速断开次数 */
    rateLimitDisconnects: number;
    /** 畸形消息熔断断开次数 */
    malformedDisconnects: number;
    /** 离线队列桶数（基数攻击面的实时暴露面） */
    queuedAgentBuckets: number;
  };
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
  /** 攻击面分类计数（拒绝路径从日志升级为指标——可告警、可绘图） */
  private securityCounters = {
    unauthenticatedRejections: 0,
    identitySpoofRejections: 0,
    identityRebindRejections: 0,
    invalidChannelRejections: 0,
    rateLimitDisconnects: 0,
    malformedDisconnects: 0,
  };
  // 并发start()复用同一次监听Promise，防止创建两个WebSocketServer
  private startPromise: Promise<void> | null = null;
  // 总线自身启动时刻（uptime基准，非进程存活时间）
  private startedAt: number | null = null;
  /** 心跳定时器集中登记（F08）：shutdown 时确定性回收，不依赖连接
   * close 事件的终极到达 */
  private heartbeatTimers = new Set<NodeJS.Timeout>();

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
    // 默认只监听回环地址：无鉴权时控制台协议不得暴露到网络接口
    const host = this.config.communication?.host ?? '127.0.0.1';

    this.startPromise = new Promise((resolve, reject) => {
      const server = new WebSocketServer({ port, host, path: '/quantum-bus', maxPayload });
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
    // 连接数封顶：无差别接受连接允许对端以_socket数量耗尽内存/FD
    const cap = this.config.communication?.maxConnections ?? 256;
    if (this.connections.size >= cap) {
      logWarn('QuantumBus', `Connection limit ${cap} reached, rejecting new connection`);
      ws.close(1013, 'connection limit reached');
      return;
    }

    const connectionId = randomUUID();

    const connection: WebSocketConnection = {
      id: connectionId,
      agentId: '',
      ws,
      lastPing: new Date(),
      subscriptions: [],
    };

    this.connections.set(connectionId, connection);

    // 每连接限速与畸形熔断的状态（F06/F07）
    let messageTimestamps: number[] = [];
    let malformedCount = 0;

    ws.on('message', (data: RawData) => {
      // 限速（令牌窗口）：正常客户端远达不到该速率，超速即断开——
      // 广播路径的发送成本是 O(连接数)，入口不限速会被单一连接放大
      const now = Date.now();
      messageTimestamps = messageTimestamps.filter((t) => now - t < 1000);
      if (messageTimestamps.length >= MAX_MESSAGES_PER_SECOND) {
        logWarn('QuantumBus', `Rate limit exceeded on ${connectionId}, closing`);
        this.securityCounters.rateLimitDisconnects++;
        ws.close(1008, 'rate limit exceeded');
        return;
      }
      messageTimestamps.push(now);

      try {
        const text = Buffer.isBuffer(data)
          ? data.toString('utf8')
          : Array.isArray(data)
            ? Buffer.concat(data).toString('utf8')
            : Buffer.from(data).toString('utf8');
        const message = JSON.parse(text) as IncomingClientMessage;
        malformedCount = 0;
        this.handleIncomingMessage(connectionId, message);
      } catch (error) {
        // 畸形消息熔断（F07）：持续发送不可解析载荷即断开——
        // 否则对端可持续触发日志洪泛（每条 Warn 一行）
        malformedCount++;
        if (malformedCount >= MAX_MALFORMED_PER_CONNECTION) {
          logWarn(
            'QuantumBus',
            `Malformed message circuit breaker tripped on ${connectionId}, closing`,
          );
          this.securityCounters.malformedDisconnects++;
          ws.close(1008, 'malformed message flood');
          return;
        }
        logWarn(
          'QuantumBus',
          `Error parsing message from ${connectionId} (${malformedCount}/${MAX_MALFORMED_PER_CONNECTION}):`,
          error,
        );
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

    // 发送连接确认（携带协议版本，F09：客户端可据此协商/拒绝不兼容变更）
    this.sendToConnection(connectionId, {
      id: randomUUID(),
      type: 'connection_ack',
      sourceAgentId: 'quantum-bus',
      content: {
        connectionId,
        protocolVersion: PROTOCOL_VERSION,
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
          this.heartbeatTimers.delete(interval);
          clearInterval(interval);
        } else {
          connection.ws.ping();
        }
      } else {
        this.heartbeatTimers.delete(interval);
        clearInterval(interval);
      }
    }, intervalMs);
    this.heartbeatTimers.add(interval);

    // 确保连接关闭后定时器最终被回收
    connection.ws.on('close', () => {
      this.heartbeatTimers.delete(interval);
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

  /** 鉴权开启时是否允许该连接使用常规消息/订阅路径（须已完成 authenticate） */
  private authenticated(connection: WebSocketConnection): boolean {
    return this.config.communication?.authToken === undefined || connection.agentId !== '';
  }

  private handleIncomingMessage(connectionId: string, message: IncomingClientMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (message.type === 'authenticate') {
      // 身份重绑防护（F04）：已认证连接再 authenticate 即可冒领任意
      // agentId（共享 token 不构成连接级身份）——同连接改绑不同身份
      // 一律拒绝并断开；同 id 重复认证保持幂等
      if (connection.agentId !== '' && connection.agentId !== message.agentId) {
        logWarn(
          'QuantumBus',
          `Connection ${connectionId} (agent '${sanitizeForLog(connection.agentId)}') ` +
            `attempted identity rebind to '${sanitizeForLog(message.agentId)}' — rejected`,
        );
        this.securityCounters.identityRebindRejections++;
        this.emit('authentication_failed', { connectionId, agentId: message.agentId });
        connection.ws.close(4001, 'identity rebind not allowed');
        return;
      }
      const expectedToken = this.config.communication?.authToken;
      if (expectedToken !== undefined && !this.tokenMatches(message.token, expectedToken)) {
        // 鉴权失败：断开连接，且不绑定身份（防止任意客户端冒认agentId）
        logWarn(
          'QuantumBus',
          `Authentication failed for agent '${sanitizeForLog(message.agentId)}' on ${connectionId}`,
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
      // 订阅即流量：鉴权开启时未认证连接不得订阅广播
      if (!this.authenticated(connection)) {
        logWarn('QuantumBus', `Unauthenticated subscribe from ${connectionId} rejected`);
        this.securityCounters.unauthenticatedRejections++;
        return;
      }
      // 频道名边界校验（F01）：channel 是对端可控的任意 JSON 值——
      // 非字符串或超长值曾可直达订阅表（内存占用 + includes 比较
      // 语义被破坏），不合法一律忽略
      if (typeof message.channel !== 'string' || message.channel.length === 0) {
        logWarn(
          'QuantumBus',
          `Invalid subscribe channel (non-string) from ${connectionId} ignored`,
        );
        this.securityCounters.invalidChannelRejections++;
        return;
      }
      if (message.channel.length > MAX_CHANNEL_LENGTH) {
        logWarn(
          'QuantumBus',
          `Oversized subscribe channel (${message.channel.length} > ${MAX_CHANNEL_LENGTH}) ` +
            `from ${connectionId} ignored`,
        );
        this.securityCounters.invalidChannelRejections++;
        return;
      }
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
      if (!this.authenticated(connection)) return;
      // 与 subscribe 同口径的频道名校验：不合法的退订请求静默无效
      if (typeof message.channel !== 'string') return;
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
      // 处理常规消息：鉴权开启时，消息路径与控制台同等对待——
      // 未认证连接不得注入/转发消息，已认证连接不得冒用他人 agentId
      if (!this.authenticated(connection)) {
        logWarn('QuantumBus', `Unauthenticated message from ${connectionId} rejected`);
        this.securityCounters.unauthenticatedRejections++;
        return;
      }
      if (
        this.config.communication?.authToken !== undefined &&
        message.sourceAgentId !== connection.agentId
      ) {
        logWarn(
          'QuantumBus',
          `Connection ${connectionId} (agent '${sanitizeForLog(connection.agentId)}') spoofed ` +
            `sourceAgentId '${sanitizeForLog(message.sourceAgentId)}' — rejected`,
        );
        return;
      }
      this.processMessage(message);
    }
  }

  private processMessage(message: QuantumMessage): void {
    // 验证消息格式
    if (!this.validateMessage(message)) {
      // 结构化消毒（F10）：畸形消息体逐字段进日志会放大攻击面——
      // 对端可控字段经 sanitizeForLog，且不整体倾倒原始对象
      logWarn(
        'QuantumBus',
        `Invalid message format (id=${sanitizeForLog(message.id)} ` +
          `source=${sanitizeForLog(message.sourceAgentId)} ` +
          `type=${sanitizeForLog(message.type)})`,
      );
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

  /**
   * 消息格式校验（F05 强化）：此前只查 3 个 truthy 字段——类型混淆的
   * 载荷（数字 id、数组 sourceAgentId）可透传进路由/日志/订阅比较。
   * 以 unknown 视图逐字段断言运行时形状（声明类型来自 JSON.parse 断言，
   * 边界处不可信任）。
   */
  private validateMessage(message: QuantumMessage): boolean {
    const raw = message as {
      id?: unknown;
      sourceAgentId?: unknown;
      type?: unknown;
      quantumState?: unknown;
    };
    return (
      typeof raw.id === 'string' &&
      raw.id !== '' &&
      typeof raw.sourceAgentId === 'string' &&
      raw.sourceAgentId !== '' &&
      typeof raw.type === 'string' &&
      raw.type !== '' &&
      typeof raw.quantumState === 'object' &&
      raw.quantumState !== null
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
        payload ??= JSON.stringify(message);
        // 以真实送达结果累计（F03）：sendToConnection 可能因发送异常/
        // 慢消费者背压返回 false——无条件置 true 会让失败发送被计入
        // 「已投递」，消息即不进离线队列（静默丢失）
        sent = this.sendToConnection(connection.id, message, payload) || sent;
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
      // 发送背压：对端停止读取但仍保持 TCP/WS 存活时，ws 库会在服务端
      // 无限缓冲待发数据——超过阈值即判定慢消费者并断开，防内存耗尽
      if (connection.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        logWarn('QuantumBus', `Slow consumer ${connectionId}: closing (bufferedAmount overflow)`);
        this.droppedMessages++;
        connection.ws.close(1013, 'slow consumer');
        return false;
      }
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
      // 桶数基数上界（F02）：per-agent 队列封顶挡不住海量伪造
      // targetAgentId 的建桶攻击——新桶拒建并计入 droppedMessages，
      // 既有桶继续正常服务
      if (this.messageQueue.size >= MAX_QUEUED_AGENTS) {
        this.droppedMessages++;
        if (process.env.QUANTUM_BUS_DEBUG) {
          logWarn(
            'QuantumBus',
            `Offline queue bucket cap ${MAX_QUEUED_AGENTS} reached, dropping message for ` +
              `'${sanitizeForLog(agentId)}'`,
          );
        }
        return;
      }
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
      // exactOptionalPropertyTypes：显式 undefined 不得写入可选属性
      ...(targetAgentId !== undefined ? { targetAgentId } : {}),
      ...(targetAgentIds !== undefined ? { targetAgentIds } : {}),
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

    // 该 agent 的候选连接快照（一次 O(C)，替代每消息一次的全表扫描）。
    // 快照按 connections 插入序 == 原 find 的扫描序；逐消息仍重新校验
    // OPEN 与存在性（背压断连会使 readyState 离开 OPEN），语义与原
    // find 谓词逐点一致，且每条消息仍恰好尝试一次发送
    const candidates: WebSocketConnection[] = [];
    for (const conn of this.connections.values()) {
      if (conn.agentId === agentId) candidates.push(conn);
    }

    let deliveredCount = 0;
    const remainingMessages: QuantumMessage[] = [];

    for (const message of queuedMessages) {
      const connection = candidates.find(
        (c) => c.ws.readyState === WebSocket.OPEN && this.connections.get(c.id) === c,
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
    // start()已发起但尚未listening时同样必须拆除服务器，否则shutdown
    // 空转而服务器随后照常上线（stop-as-紧急制动失效）
    if (!this.wsServer && !this.startPromise) return;

    logInfo('QuantumBus', 'Shutting down...');

    // 心跳定时器集中回收（F08）：不依赖各连接 close 事件的到达顺序
    for (const interval of this.heartbeatTimers) {
      clearInterval(interval);
    }
    this.heartbeatTimers.clear();

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
      security: { ...this.securityCounters, queuedAgentBuckets: this.messageQueue.size },
      uptime: this.startedAt !== null ? (Date.now() - this.startedAt) / 1000 : 0,
    };
  }
}
