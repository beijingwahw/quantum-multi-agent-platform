import { EventEmitter } from 'events';
import { createHash, timingSafeEqual } from 'crypto';
import {
  reviveDate,
  type QuantumMessage,
  type MessagePriority,
  type MessageType,
  type QuantumState,
} from '../types/quantum-types.js';
import type { RawData } from 'ws';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { logInfo, logWarn } from '../utils/logger.js';
import { ConfigurationError, MessageValidationError, StateError } from '../utils/errors.js';

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
    /**
     * 可选 token→agentId 绑定（09#F04 remainder）。仅在鉴权开启
     * （authToken 已配置）时生效：authenticate 通过 token 校验后，
     * 若呈现的 token 在本表中有绑定项，则其声称的 agentId 必须落在
     * 该 token 的允许清单内——共享 token 泄露后也只能冒领被绑定的
     * 身份，而非任意 agent。注意：本表不引入新的可接受 token（token
     * 仍须与 authToken 常数时间匹配）；呈现 token 不在表中时不施加
     * 绑定约束（与未配置时行为一致）。
     */
    tokenAgents?: ReadonlyMap<string, readonly string[]> | Record<string, readonly string[]>;
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
    /**
     * 可选慢消费者分级降质背压（R18-J，opt-in）。未设置（缺省）时发送
     * 路径字节不变：仅有既有的 MAX_BUFFERED_BYTES(4MiB) 单阈值断开，
     * 0..4MiB 区间无条件缓冲。设置后按 ws.bufferedAmount 水位对每条
     * 连接维护一个滞回分级状态机（上行用 thresholdBytes、下行用
     * recoverBytes，缺省 floor(thresholdBytes/2)），每级绑定一个降质
     * 动作，每次 tier 变化必发 slow_consumer_tier_changed 事件 +
     * tierEntries/tierExits 计数 + 日志行（降级永不静默）：
     * - 'warn'：仅观测（事件/计数/日志），消息照发；
     * - 'shed-low-priority'：拒发 priority==='low' 的消息（计数
     *   shedDroppedMessages；单播按既有回退语义入离线队列，水位恢复
     *   时重投递——降质不丢数据；广播 fire-and-forget 真丢）；
     * - 'quarantine'：拒发全部消息（单播同样入离线队列，受
     *   maxQueuedMessages 既有封顶约束），水位回落到恢复线以下时
     *   解除并自动冲刷该连接 agent 的离线队列。
     * 分级不替代也不削弱内置 4MiB 硬顶——硬顶仍是配置路径的最后防线。
     * tiers 必须：非空数组、thresholdBytes 为严格递增正整数、
     * recoverBytes 为非负整数且落在 [前级 thresholdBytes, 自身
     * thresholdBytes)（滞回带划分良定义：恢复线随级非降且不越过上级
     * 进入线，tier 计算的判定线序列单调无带间空洞），否则构造期具名
     * 拒绝（ConfigurationError）。
     * 诚实边界：水位探测是消息驱动的惰性探测（无独立定时器）；降级
     * 对客户端透明（不发新下行帧，不 bump PROTOCOL_VERSION）——客户
     * 端只会观察到低优先级消息不再到达/投递暂停，观测出口是服务端
     * 事件面与 getSlowConsumerDegradationMetrics()。
     */
    slowConsumerDegradation?: {
      tiers: ReadonlyArray<{
        /** 进入该级的水位（字节，>= 即进入；上行判定线） */
        thresholdBytes: number;
        /** 该级生效期间的降质动作 */
        action: 'warn' | 'shed-low-priority' | 'quarantine';
        /** 退出该级的水位（字节，< 即降级；缺省 floor(thresholdBytes/2)） */
        recoverBytes?: number;
      }>;
    };
  };
}

/** 单连接发送缓冲上限：超过即判定为慢消费者并断开（防内存耗尽） */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;
/** 订阅频道名长度上限：近 1MB 的 JSON 字符串值曾可直达订阅表（F01） */
const MAX_CHANNEL_LENGTH = 128;
/**
 * agentId 长度上限（09#F04 remainder）：与频道名同量级——身份串会进入
 * 连接表/离线队列键/agentsOnline/日志与按值比较路径，超长值在
 * authenticate 边界即拒绝（4001 断开 + 计数），而非流入之后各路径。
 */
const MAX_AGENT_ID_LENGTH = 128;
/**
 * 可路由消息类型全集（09#F09 remainder）：与 quantum-types.ts 的
 * MessageType 联合一一对应（类型联合演化时同步维护此表）。控制协议
 * 分支（authenticate/subscribe/unsubscribe/console_*）在 dispatch 上方
 * 已单独处理；不在本表内的帧类型是未知类型——显式回错误帧并计数，
 * 不再落入常规消息分支被静默丢弃/路由。
 */
const KNOWN_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  'task_assignment',
  'task_completed',
  'task_failed',
  'agent_status',
  'status_update',
  'quantum_entanglement',
  'heartbeat',
  'connection_ack',
  'request',
  'response',
  'broadcast',
  'error',
]);
/**
 * 离线队列桶数上限（F02）：per-agent 队列封顶挡不住「海量伪造
 * targetAgentId」的基数攻击——每个新桶本身就是一条 Map 记录，
 * 已认证对端可借此无限建桶直至 OOM。
 */
const MAX_QUEUED_AGENTS = 4096;
/** 单连接畸形消息熔断阈值（F07）：持续解析失败即断开，防日志洪泛 */
const MAX_MALFORMED_PER_CONNECTION = 32;
/**
 * 单连接未知帧类型熔断阈值（R15，F09 姊妹）：与 F07 同一阈值语义——
 * 未知帧的错误回帧+logWarn 在限速窗内可无限持续（1000/s 的帧/日志
 * 放大面），偶发未知类型仍是协议协商问题（回错误帧、连接保持），
 * 持续洪泛才升级为 1008 断开。
 */
const MAX_UNKNOWN_TYPE_PER_CONNECTION = MAX_MALFORMED_PER_CONNECTION;
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

/**
 * 消息字段校验谓词（R13 提升为模块级：原为 validateMessage 内的逐消息
 * 闭包分配——入口最热面上的纯函数搅动）。语义逐点不变。
 */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** timestamp 形状校验（09#F05 remainder，语义见 validateMessage 内注释） */
function isValidTimestamp(v: unknown): boolean {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return reviveDate(v) !== undefined;
  return false;
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
    /** authenticate 声称的 agentId 形状/长度非法的拒绝次数（09#F04） */
    invalidAgentIdRejections: number;
    /** 未知帧类型的拒绝次数（09#F09：错误帧回发且连接保持） */
    unknownTypeRejections: number;
    /** 同连接改绑身份的拒绝次数 */
    identityRebindRejections: number;
    /** 不合法订阅频道（非字符串/超长）的拒绝次数 */
    invalidChannelRejections: number;
    /** 限速断开次数 */
    rateLimitDisconnects: number;
    /** 畸形消息熔断断开次数 */
    malformedDisconnects: number;
    /** 未知帧类型熔断断开次数（R15：与畸形熔断同型阈值语义） */
    unknownTypeDisconnects: number;
    /** 连接数封顶（1013）拒绝次数（R15：连接洪水攻击面可观测） */
    connectionLimitRejections: number;
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

/**
 * 构造期限额校验：这些配置键的垃圾值不是「行为退化」而是「静默损坏」——
 * maxQueuedMessages<0 会让丢最旧消息的 while 循环在空队列上无限空转
 * （挂死整个事件循环）；maxSubscriptions<0 使容量判断恒 false、上限被
 * 静默绕过；maxConnections<1 / maxMessageSize<1 / 心跳间隔≤0 让总线
 * 构造上就不可用。全部在构造时显式拒绝（非法配置不是运行时才暴露的
 * 事故，而是调用方的编程错误）。
 */
function validateBusLimits(config: QuantumBusConfig): void {
  const c = config.communication;
  if (!c) return;
  const integer = (value: number): boolean => Number.isInteger(value);
  if (
    c.maxQueuedMessages !== undefined &&
    (!integer(c.maxQueuedMessages) || c.maxQueuedMessages < 0)
  ) {
    throw new ConfigurationError(
      `communication.maxQueuedMessages must be a non-negative integer, got ${String(c.maxQueuedMessages)}`,
    );
  }
  if (
    c.maxSubscriptions !== undefined &&
    (!integer(c.maxSubscriptions) || c.maxSubscriptions < 0)
  ) {
    throw new ConfigurationError(
      `communication.maxSubscriptions must be a non-negative integer, got ${String(c.maxSubscriptions)}`,
    );
  }
  if (c.maxConnections !== undefined && (!integer(c.maxConnections) || c.maxConnections < 1)) {
    throw new ConfigurationError(
      `communication.maxConnections must be a positive integer, got ${String(c.maxConnections)}`,
    );
  }
  if (c.maxMessageSize !== undefined && (!integer(c.maxMessageSize) || c.maxMessageSize < 1)) {
    throw new ConfigurationError(
      `communication.maxMessageSize must be a positive integer, got ${String(c.maxMessageSize)}`,
    );
  }
  if (
    c.heartbeatIntervalMs !== undefined &&
    (!integer(c.heartbeatIntervalMs) || c.heartbeatIntervalMs < 1)
  ) {
    throw new ConfigurationError(
      `communication.heartbeatIntervalMs must be a positive integer, got ${String(c.heartbeatIntervalMs)}`,
    );
  }
  if (
    c.heartbeatTimeoutMs !== undefined &&
    (!integer(c.heartbeatTimeoutMs) || c.heartbeatTimeoutMs < 1)
  ) {
    throw new ConfigurationError(
      `communication.heartbeatTimeoutMs must be a positive integer, got ${String(c.heartbeatTimeoutMs)}`,
    );
  }
}

/**
 * 慢消费者分级降质的内部归一形态（R18-J）：构造期校验完成后的冻结
 * 策略——recoverBytes 已填充缺省值，tiers 全序良定义。
 */
interface SlowConsumerTier {
  thresholdBytes: number;
  action: 'warn' | 'shed-low-priority' | 'quarantine';
  recoverBytes: number;
}

/**
 * 构造期解析+校验慢消费者分级降质配置（R18-J，缺省 undefined → null，
 * 全部新路径不可达）。走私值具名拒绝（ConfigurationError）——分级阈值
 * 是安全策略配置：乱序/越界的恢复线会破坏滞回带划分的良定义性
 * （tier 计算的判定线序列必须相对当前级单调非降，否则 max 语义在带间
 * 空洞处行为不可预言）。带划分约束：thresholdBytes 严格递增，且每级
 * recoverBytes ∈ [前级 thresholdBytes, 自身 thresholdBytes)。
 */
function parseSlowConsumerPolicy(c: QuantumBusConfig['communication']): SlowConsumerTier[] | null {
  // 配置值按 unknown 逐字段 narrow（Array.isArray 会把元素收窄成 any[]，
  // 逐字段防御必须绕开该收窄直接以 unknown 视图处理）
  const raw: unknown = c?.slowConsumerDegradation;
  if (raw === undefined) return null;
  if (typeof raw !== 'object' || raw === null) {
    throw new ConfigurationError(
      'communication.slowConsumerDegradation must be an object with a tiers array',
    );
  }
  const tiersField: unknown = (raw as Record<string, unknown>).tiers;
  if (!Array.isArray(tiersField) || tiersField.length === 0) {
    throw new ConfigurationError(
      'communication.slowConsumerDegradation.tiers must be a non-empty array of tier objects',
    );
  }
  const tiers: SlowConsumerTier[] = [];
  let prevThreshold = 0;
  for (const [index, tier] of (tiersField as unknown[]).entries()) {
    if (typeof tier !== 'object' || tier === null) {
      throw new ConfigurationError(
        `communication.slowConsumerDegradation.tiers[${index}] must be an object`,
      );
    }
    const { thresholdBytes, action, recoverBytes } = tier as Record<string, unknown>;
    if (
      typeof thresholdBytes !== 'number' ||
      !Number.isInteger(thresholdBytes) ||
      thresholdBytes < 1
    ) {
      throw new ConfigurationError(
        `communication.slowConsumerDegradation.tiers[${index}].thresholdBytes must be a positive integer, got ${String(thresholdBytes)}`,
      );
    }
    if (thresholdBytes <= prevThreshold) {
      throw new ConfigurationError(
        `communication.slowConsumerDegradation.tiers[${index}].thresholdBytes (${String(thresholdBytes)}) must be strictly greater than the previous tier threshold (${String(prevThreshold)})`,
      );
    }
    const actionValue: unknown = action;
    if (
      actionValue !== 'warn' &&
      actionValue !== 'shed-low-priority' &&
      actionValue !== 'quarantine'
    ) {
      throw new ConfigurationError(
        `communication.slowConsumerDegradation.tiers[${index}].action must be one of 'warn' | 'shed-low-priority' | 'quarantine', got ${String(actionValue)}`,
      );
    }
    const recoverBytesValue: unknown =
      recoverBytes === undefined ? Math.floor(thresholdBytes / 2) : recoverBytes;
    if (
      typeof recoverBytesValue !== 'number' ||
      !Number.isInteger(recoverBytesValue) ||
      recoverBytesValue < 0 ||
      recoverBytesValue >= thresholdBytes ||
      recoverBytesValue < prevThreshold
    ) {
      throw new ConfigurationError(
        `communication.slowConsumerDegradation.tiers[${index}].recoverBytes (${String(recoverBytesValue)}) must be a non-negative integer in [previous threshold ${String(prevThreshold)}, own threshold ${String(thresholdBytes)}) — set it explicitly when the default floor(threshold/2) breaks the hysteresis band partition`,
      );
    }
    tiers.push({ thresholdBytes, action: actionValue, recoverBytes: recoverBytesValue });
    prevThreshold = thresholdBytes;
  }
  return tiers;
}

export class QuantumBus extends EventEmitter {
  private messageQueue = new Map<string, QuantumMessage[]>();
  private connections = new Map<string, WebSocketConnection>();
  /**
   * agentId → 该身份的全部连接（R13 性能：sendToAgent/离线冲刷原为每消息
   * 全表 O(连接数) 扫描——组播消息 ×T 目标即 O(T·C)。索引在 authenticate
   * 建档、close/error/心跳过期/shutdown 统一拆除。数组按连接创建序排列，
   * 与 connections 全表扫描的过滤序逐点一致（帧序/日志序/投递首选连接
   * 均为可观测行为，顺序保真是位级同一的前提）。
   */
  private connectionsByAgent = new Map<string, WebSocketConnection[]>();
  /** 连接创建序号（WeakMap 承载：不进入连接对象的公开形状），索引数组按此插入排序 */
  private connectionSeq = new WeakMap<WebSocketConnection, number>();
  private nextConnectionSeq = 0;
  /**
   * 离线队列死前缀游标（R13 性能）：满桶出队原为 shift() 的 O(cap) 元素
   * 搬移——伪造目标洪泛下每消息一次千元素 memmove。游标惰性推进 + 过半
   * 物理压缩（与 monitor.ts 的 deadPrefix 同策略，均摊 O(1)/消息），
   * live 视图 [head, length) 的内容/顺序与逐条 shift 完全一致。
   */
  private queueHeads = new Map<string, number>();
  private wsServer: WebSocketServer | null = null;
  private config: QuantumBusConfig;
  private started = false;
  private droppedMessages = 0;
  /** 攻击面分类计数（拒绝路径从日志升级为指标——可告警、可绘图） */
  private securityCounters = {
    unauthenticatedRejections: 0,
    identitySpoofRejections: 0,
    invalidAgentIdRejections: 0,
    unknownTypeRejections: 0,
    identityRebindRejections: 0,
    invalidChannelRejections: 0,
    rateLimitDisconnects: 0,
    malformedDisconnects: 0,
    unknownTypeDisconnects: 0,
    connectionLimitRejections: 0,
  };
  // 并发start()复用同一次监听Promise，防止创建两个WebSocketServer
  private startPromise: Promise<void> | null = null;
  // start()在途时的reject句柄：shutdown()与启动竞争的确定性收尾依据
  private startReject: ((error: Error) => void) | null = null;
  // 总线自身启动时刻（uptime基准，非进程存活时间）
  private startedAt: number | null = null;
  /** tokenAgents 的统一只读视图（构造期把 Record/Map 归一为 Map；见配置项 JSDoc） */
  private readonly tokenAgentMap: ReadonlyMap<string, readonly string[]>;
  /** 心跳定时器集中登记（F08）：shutdown 时确定性回收，不依赖连接
   * close 事件的终极到达 */
  private heartbeatTimers = new Set<NodeJS.Timeout>();
  /**
   * 单连接未知帧类型熔断计数（R15，F09 姊妹）：与 F07 的 malformedCount
   * 同位语义（连续违规计数，可受理帧复位）——该计数跨 handleIncomingMessage
   * 多次调用，以 connectionId 为键挂在总线上；连接移除时一并拆除。
   */
  private unknownTypeCounts = new Map<string, number>();
  /**
   * 慢消费者分级降质策略（R18-J，opt-in）：null = 未配置，全部新路径
   * 不可达——发送行为与既有逐字节一致（仅有 4MiB 硬顶断开）。
   */
  private readonly slowConsumerTiers: SlowConsumerTier[] | null;
  /**
   * connectionId → 当前滞回 tier 索引（1-based；0/缺席 = 正常级）。
   * 连接移除时一并拆除（与 unknownTypeCounts 同位语义）。
   */
  private slowConsumerTierState = new Map<string, number>();
  /** 分级降质观测账（独立于 droppedMessages/securityCounters：缺省路径零触碰） */
  private slowConsumerStats = {
    tierEntries: [] as number[],
    tierExits: [] as number[],
    shedDroppedMessages: 0,
    quarantineDeferredMessages: 0,
  };

  constructor(config: QuantumBusConfig) {
    super();
    validateBusLimits(config);
    this.config = config;
    // R18-J opt-in 分级降质：构造期解析+校验（缺省 undefined → null，
    // 新路径整体不可达）；观测账按级分配
    this.slowConsumerTiers = parseSlowConsumerPolicy(config.communication);
    if (this.slowConsumerTiers !== null) {
      this.slowConsumerStats = {
        tierEntries: this.slowConsumerTiers.map(() => 0),
        tierExits: this.slowConsumerTiers.map(() => 0),
        shedDroppedMessages: 0,
        quarantineDeferredMessages: 0,
      };
    }
    // tokenAgents 归一 + 形状校验（09#F04 remainder）：绑定表是安全配置，
    // 垃圾形状（空 token 键 / 非字符串数组的允许清单）必须在构造期拒绝——
    // 运行期才暴露会让绑定「看似配置、实则恒不生效或恒全拒」。
    const tokenAgents = config.communication?.tokenAgents;
    if (tokenAgents === undefined) {
      this.tokenAgentMap = new Map();
    } else {
      const entries: Array<[string, readonly string[]]> =
        tokenAgents instanceof Map
          ? [...(tokenAgents as ReadonlyMap<string, readonly string[]>).entries()]
          : Object.entries(tokenAgents as Record<string, readonly string[]>);
      for (const [token, agents] of entries) {
        if (typeof token !== 'string' || token.length === 0) {
          throw new ConfigurationError(
            `communication.tokenAgents keys must be non-empty strings, got ${String(token)}`,
          );
        }
        if (
          !Array.isArray(agents) ||
          !agents.every((id) => typeof id === 'string' && id.length > 0)
        ) {
          throw new ConfigurationError(
            `communication.tokenAgents['${sanitizeForLog(token)}'] must be an array of non-empty agent ids`,
          );
        }
      }
      this.tokenAgentMap = new Map(entries);
    }
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
      this.startReject = reject;

      server.on('error', (error: Error) => {
        // 实例守卫：shutdown 竞争后重启的场景里，旧 server 的迟到 error
        //（如 bind 失败与 shutdown 同拍）不得清掉新 server 的句柄/状态
        if (this.wsServer !== server) return;
        this.startReject = null;
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
        this.startReject = null;
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
      // R15：封顶拒绝计入 security 计数面——「攻击面可观测」的设计注记
      // 覆盖此路径（连接洪水是可告警的直接信号，仅 logWarn 不可绘图）
      this.securityCounters.connectionLimitRejections++;
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
    this.connectionSeq.set(connection, this.nextConnectionSeq++);

    // 每连接限速与畸形熔断的状态（F06/F07）
    // R13：环形时间窗（Float64Array 定容）替代「每消息 filter 新数组 + push」
    // ——限速检查是入口最热面，逐消息数组分配在合法高速客户端下纯属搅动。
    // 语义逐点保持：保留条件 now-t<1000、阈值 MAX_MESSAGES_PER_SECOND、
    // 超速判定与断开路径不变（环内时间戳按入窗顺序，出窗即推进 head）。
    const rateWindow = new Float64Array(MAX_MESSAGES_PER_SECOND);
    let rateHead = 0;
    let rateSize = 0;
    let malformedCount = 0;

    ws.on('message', (data: RawData) => {
      // 限速（令牌窗口）：正常客户端远达不到该速率，超速即断开——
      // 广播路径的发送成本是 O(连接数)，入口不限速会被单一连接放大
      const now = Date.now();
      while (rateSize > 0 && now - rateWindow[rateHead]! >= 1000) {
        rateHead = (rateHead + 1) % MAX_MESSAGES_PER_SECOND;
        rateSize--;
      }
      if (rateSize >= MAX_MESSAGES_PER_SECOND) {
        logWarn('QuantumBus', `Rate limit exceeded on ${connectionId}, closing`);
        this.securityCounters.rateLimitDisconnects++;
        ws.close(1008, 'rate limit exceeded');
        return;
      }
      rateWindow[(rateHead + rateSize) % MAX_MESSAGES_PER_SECOND] = now;
      rateSize++;

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
      this.removeConnection(connectionId);
      this.emit('connection_closed', connectionId);
    });

    ws.on('error', (error) => {
      logWarn('QuantumBus', `Error from connection ${connectionId}:`, error);
      this.removeConnection(connectionId);
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
      const current = this.connections.get(connectionId);
      if (current?.ws.readyState === WebSocket.OPEN) {
        const now = new Date();
        const timeSinceLastPing = now.getTime() - current.lastPing.getTime();

        if (timeSinceLastPing > timeoutMs) {
          logInfo('QuantumBus', `Closing stale connection ${connectionId}`);
          current.ws.terminate();
          this.removeConnection(connectionId);
          this.heartbeatTimers.delete(interval);
          clearInterval(interval);
        } else {
          current.ws.ping();
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

  /**
   * 连接加入 agent 路由索引（幂等：同 id 重复认证不重复入列）。插入位置
   * 按连接创建序号排序——保证索引遍历序 == connections 全表扫描的过滤序，
   * 投递顺序逐点保真。每 agent 连接数是个位数，插入扫描成本可忽略。
   */
  private indexConnection(connection: WebSocketConnection): void {
    if (connection.agentId === '') return;
    let conns = this.connectionsByAgent.get(connection.agentId);
    if (conns === undefined) {
      conns = [];
      this.connectionsByAgent.set(connection.agentId, conns);
    }
    if (conns.includes(connection)) return;
    const seq = this.connectionSeq.get(connection) ?? 0;
    let i = conns.length;
    while (i > 0 && (this.connectionSeq.get(conns[i - 1]!) ?? 0) > seq) i--;
    conns.splice(i, 0, connection);
  }

  /** 连接从连接表与 agent 索引移除（幂等）：close/error/心跳过期统一出口 */
  private removeConnection(connectionId: string): void {
    this.unknownTypeCounts.delete(connectionId);
    this.slowConsumerTierState.delete(connectionId);
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    this.connections.delete(connectionId);
    if (connection.agentId !== '') {
      const conns = this.connectionsByAgent.get(connection.agentId);
      if (conns !== undefined) {
        const idx = conns.indexOf(connection);
        if (idx >= 0) conns.splice(idx, 1);
        if (conns.length === 0) this.connectionsByAgent.delete(connection.agentId);
      }
    }
  }

  /** 鉴权开启时是否允许该连接使用常规消息/订阅路径（须已完成 authenticate） */
  private authenticated(connection: WebSocketConnection): boolean {
    return this.config.communication?.authToken === undefined || connection.agentId !== '';
  }

  private handleIncomingMessage(connectionId: string, message: IncomingClientMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // R15：可受理帧（控制协议分支或已知消息类型）复位未知类型熔断——
    // 与 F07「可解析即复位 malformedCount」同位语义：熔断计的是连续违规，
    // 协议协商后转正的客户端不因历史未知帧累积被逐
    if (
      message.type === 'authenticate' ||
      message.type === 'subscribe' ||
      message.type === 'unsubscribe' ||
      message.type === 'console_query' ||
      message.type === 'console_command' ||
      (typeof message.type === 'string' && KNOWN_MESSAGE_TYPES.has(message.type))
    ) {
      this.unknownTypeCounts.delete(connectionId);
    }

    if (message.type === 'authenticate') {
      // 身份形状校验（F05 同口径）：agentId 是对端可控的任意 JSON 值——
      // 非字符串（数字/对象）此前可直接绑定为连接身份，混进
      // getAgentsOnline 的 string[] 与订阅/投递的按值比较；空串恰好撞上
      // 「未认证」哨兵（''===未认证），绑定后事件已发、权限却仍被拒。
      // 身份绑定边界必须逐字段断言形状，与 token 校验同判定（拒绝+断开）
      if (typeof message.agentId !== 'string' || message.agentId.length === 0) {
        logWarn(
          'QuantumBus',
          `Authentication with invalid agentId shape from ${connectionId} rejected`,
        );
        this.securityCounters.invalidAgentIdRejections++;
        this.emit('authentication_failed', { connectionId, agentId: message.agentId });
        connection.ws.close(4001, 'invalid agentId');
        return;
      }
      // 身份长度上限（09#F04 remainder）：超长身份串与非法形状同判定
      // （4001 断开），且计入 dedicated 计数——身份串会流入连接表/
      // 离线队列键/agentsOnline，近 1MB 的值不该在这些路径里被「事后」发现
      if (message.agentId.length > MAX_AGENT_ID_LENGTH) {
        logWarn(
          'QuantumBus',
          `Authentication with oversized agentId (${message.agentId.length} > ` +
            `${MAX_AGENT_ID_LENGTH}) from ${connectionId} rejected`,
        );
        this.securityCounters.invalidAgentIdRejections++;
        this.emit('authentication_failed', { connectionId, agentId: message.agentId });
        connection.ws.close(4001, 'agentId too long');
        return;
      }
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
      // token→身份绑定（09#F04 remainder）：token 校验已通过，若该 token
      // 配置了允许清单，则声称的 agentId 必须在清单内。越界声称按
      // 「共享 token 下的身份冒用」计入 identitySpoofRejections（与消息
      // 路径的 sourceAgentId 冒用同口径），拒绝 + 断开 + 不绑定身份。
      const allowedAgents =
        message.token !== undefined ? this.tokenAgentMap.get(message.token) : undefined;
      if (allowedAgents !== undefined && !allowedAgents.includes(message.agentId)) {
        logWarn(
          'QuantumBus',
          `Agent '${sanitizeForLog(message.agentId)}' not in token binding set ` +
            `(${allowedAgents.length} allowed) on ${connectionId} — rejected`,
        );
        this.securityCounters.identitySpoofRejections++;
        this.emit('authentication_failed', { connectionId, agentId: message.agentId });
        connection.ws.close(4001, 'agentId not permitted for token');
        return;
      }
      const isNewIdentity = connection.agentId !== message.agentId;
      connection.agentId = message.agentId;
      // agent 路由索引建档（重复认证幂等，见 indexConnection）
      if (isNewIdentity) this.indexConnection(connection);
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
        this.securityCounters.unauthenticatedRejections++;
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
        this.securityCounters.unauthenticatedRejections++;
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
        this.securityCounters.identitySpoofRejections++;
        return;
      }
      // 未知帧类型（09#F09 remainder）：此前的兜底分支不区分「MessageType
      // 域内的未知值」与合法消息——未知类型要么凑巧通过形状校验被照常
      // 路由（垃圾类型混入广播/离线队列），要么因其余字段不全被静默丢弃，
      // 客户端无从得知协议不匹配。现在对该连接显式回错误帧（偶发未知
      // 类型是协议协商问题，不是必须断连的安全判定——连接保持打开）并
      // 计数。R15：持续未知帧洪泛接上与 F07 同型的逐连接熔断（同一阈值
      // 语义）——限速窗内 1000/s 的错误回帧+logWarn 仍是可无限持续的
      // 帧/日志放大面。
      if (typeof message.type !== 'string' || !KNOWN_MESSAGE_TYPES.has(message.type)) {
        logWarn(
          'QuantumBus',
          `Unknown message type '${sanitizeForLog(message.type)}' from ${connectionId} rejected`,
        );
        this.securityCounters.unknownTypeRejections++;
        const unknownCount = (this.unknownTypeCounts.get(connectionId) ?? 0) + 1;
        this.unknownTypeCounts.set(connectionId, unknownCount);
        if (unknownCount >= MAX_UNKNOWN_TYPE_PER_CONNECTION) {
          logWarn(
            'QuantumBus',
            `Unknown message type circuit breaker tripped on ${connectionId}, closing`,
          );
          this.securityCounters.unknownTypeDisconnects++;
          this.unknownTypeCounts.delete(connectionId);
          connection.ws.close(1008, 'unknown message type flood');
          return;
        }
        this.sendErrorFrame(
          connectionId,
          'unknown_message_type',
          `Unknown message type '${sanitizeForLog(message.type)}' ` +
            `(protocol version ${PROTOCOL_VERSION})`,
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
      // 组播共享一次序列化（R13 性能）：原每目标各调 sendToAgent，同一
      // 消息被 JSON.stringify 至多 T 次——box 惰性求值首个 OPEN 连接触发，
      // 之后 T-1 个目标复用同一字符串（帧字节完全相同）
      const payloadBox = { payload: null as string | null };
      message.targetAgentIds.forEach((agentId) => {
        this.sendToAgentShared(agentId, message, payloadBox);
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
   *
   * 目标字段同口径校验（F05 姊妹缺口）：targetAgentId/targetAgentIds 是
   * 对端可控的任意 JSON 值——数字目标可直达离线队列建桶（Map<string,…>
   * 键类型被打破，且数字键永不投递：authenticate 只接受非空字符串，
   * 桶成为只进不出的静默垃圾并挤占 MAX_QUEUED_AGENTS 基数预算）；
   * 非数组 targetAgentIds 此前以裸 TypeError 击穿 processMessage，被
   * ws 处理器误计入「消息解析失败」桶（错误分类失真）。与 createMessage
   * 出站契约同判定：非空字符串 / 非空字符串数组，不合法按无效格式丢弃。
   */
  private validateMessage(message: QuantumMessage): boolean {
    const raw = message as {
      id?: unknown;
      sourceAgentId?: unknown;
      type?: unknown;
      quantumState?: unknown;
      targetAgentId?: unknown;
      targetAgentIds?: unknown;
      timestamp?: unknown;
    };
    // timestamp 形状校验（09#F05 remainder）：按 quantum-types.ts 文件头
    // 的 DTO 契约，合法形态是 Date 实例（进程内 createMessage 构造）或
    // 线上 JSON 的 ISO 8601 字符串 / epoch 毫秒数（DateLike；对端测试
    // 与真实客户端发送的正是 ISO 字符串——总线是透传/再序列化层，
    // 文档明确无需复活）。对象/数组/布尔/不可解析垃圾按无效格式丢弃；
    // 字段缺失同样无效（timestamp 是必填字段）。
    // （谓词本体已提升为模块级 isNonEmptyString / isValidTimestamp）
    return (
      isNonEmptyString(raw.id) &&
      isNonEmptyString(raw.sourceAgentId) &&
      isNonEmptyString(raw.type) &&
      isValidTimestamp(raw.timestamp) &&
      typeof raw.quantumState === 'object' &&
      raw.quantumState !== null &&
      (raw.targetAgentId === undefined || isNonEmptyString(raw.targetAgentId)) &&
      (raw.targetAgentIds === undefined ||
        (Array.isArray(raw.targetAgentIds) &&
          raw.targetAgentIds.length > 0 &&
          raw.targetAgentIds.every(isNonEmptyString)))
    );
  }

  // 消息发送方法
  sendToAgent(agentId: string, message: QuantumMessage): boolean {
    return this.sendToAgentShared(agentId, message, { payload: null });
  }

  /**
   * sendToAgent 的内部实现：payloadBox 为跨目标共享的惰性序列化盒
   * （组播路径复用同一份 JSON 字符串）。连接查找走 agent 路由索引
   * （R13 性能：原为全表 O(连接数) 扫描）；索引序 == 连接表扫描序，
   * 逐连接的帧序与日志序逐点保真。
   */
  private sendToAgentShared(
    agentId: string,
    message: QuantumMessage,
    payloadBox: { payload: string | null },
  ): boolean {
    let sent = false;

    const conns = this.connectionsByAgent.get(agentId);
    if (conns !== undefined) {
      for (const connection of conns) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          payloadBox.payload ??= JSON.stringify(message);
          // 以真实送达结果累计（F03）：sendToConnection 可能因发送异常/
          // 慢消费者背压返回 false——无条件置 true 会让失败发送被计入
          // 「已投递」，消息即不进离线队列（静默丢失）
          sent = this.sendToConnection(connection.id, message, payloadBox.payload) || sent;
        }
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
      // R18-J opt-in 分级降质：未配置（null）时本分支不可达，下方既有
      // 路径字节不变
      if (this.slowConsumerTiers !== null && !this.applySlowConsumerTier(connection, message)) {
        return false;
      }
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

  /**
   * R18-J opt-in 慢消费者分级降质：按当前 bufferedAmount 更新该连接的
   * 滞回 tier 状态机并应用当前级动作。返回 false = 该消息被降质动作
   * 拒发（shed 拒 low / quarantine 全拒）——单播由 sendToAgentShared 的
   * 既有回退语义转入离线队列（有界缓冲替换无界 ws 缓冲）。
   *
   * tier 计算：line(j) = j > last ? tiers[j-1].thresholdBytes（上行
   * 进入线）: tiers[j-1].recoverBytes（下行保持线），tier = 满足
   * amount >= line(j) 的最深 j。构造期校验保证 line 序列相对 last
   * 单调非降（恢复线随级严格递增且被上级进入线压制：recover[k] <
   * threshold[k] ≤ recover[k+1]），首个失守的 j 之后全部失守——带间
   * 无空洞、阈值附近无抖动循环。水位探测是消息驱动的惰性探测（无独立
   * 定时器）。降级永不静默：每次 tier 变化必发
   * slow_consumer_tier_changed 事件 + tierEntries/tierExits 计数 +
   * 日志行（升级 logWarn、恢复 logInfo）。
   */
  private applySlowConsumerTier(connection: WebSocketConnection, message: QuantumMessage): boolean {
    const tiers = this.slowConsumerTiers;
    if (tiers === null) return true; // 类型收窄守卫（调用点已保证非 null）
    const amount = connection.ws.bufferedAmount;
    const last = this.slowConsumerTierState.get(connection.id) ?? 0;
    let tier = 0;
    for (let j = 1; j <= tiers.length; j++) {
      const spec = tiers[j - 1]!;
      const line = j > last ? spec.thresholdBytes : spec.recoverBytes;
      if (amount >= line) tier = j;
      else break;
    }
    if (tier !== last) {
      this.slowConsumerTierState.set(connection.id, tier);
      const action = tier > 0 ? tiers[tier - 1]!.action : null;
      const previousAction = last > 0 ? tiers[last - 1]!.action : null;
      if (tier > last) {
        this.slowConsumerStats.tierEntries[tier - 1]!++;
        logWarn(
          'QuantumBus',
          `Slow consumer ${connection.id} degraded to tier ${tier}/${tiers.length} ` +
            `(action '${action}', bufferedAmount ${amount})`,
        );
      } else {
        this.slowConsumerStats.tierExits[last - 1]!++;
        logInfo(
          'QuantumBus',
          `Slow consumer ${connection.id} recovered from tier ${last} to ${tier} ` +
            `(bufferedAmount ${amount})`,
        );
      }
      this.emit('slow_consumer_tier_changed', {
        connectionId: connection.id,
        agentId: connection.agentId,
        from: last,
        to: tier,
        action,
        previousAction,
        bufferedAmount: amount,
      });
      // 恢复冲刷：降级时该连接 agent 的离线队列（降质期间按既有回退
      // 语义积压）立即尝试冲刷。水位若在冲刷中回升，后续消息按状态机
      // 重新升级，未投递消息保留在队列（不丢）
      if (tier < last && connection.agentId !== '') {
        this.processQueuedMessages(connection.agentId);
      }
    }
    if (tier === 0) return true;
    const currentAction = tiers[tier - 1]!.action;
    if (currentAction === 'warn') return true;
    if (currentAction === 'shed-low-priority') {
      // 只拒显式 'low'：JSON 透传消息的 priority 未经入站校验，
      // 缺省/垃圾值不等于 'low'——降质只作用于确定的低优先级
      if (message.priority === 'low') {
        this.slowConsumerStats.shedDroppedMessages++;
        return false;
      }
      return true;
    }
    this.slowConsumerStats.quarantineDeferredMessages++;
    return false;
  }

  /**
   * 协议级错误帧（09#F09 remainder）：未知帧类型等「回发显式错误但不断连」
   * 的统一出口。与 connection_ack 同一构造约定（总线为源、系统消息坍缩
   * 量子态），content 携带稳定 code（客户端可编程判定）+ 人类可读 message。
   */
  private sendErrorFrame(connectionId: string, code: string, message: string): void {
    this.sendToConnection(connectionId, {
      id: randomUUID(),
      type: 'error',
      sourceAgentId: 'quantum-bus',
      content: { code, message },
      timestamp: new Date(),
      priority: 'medium',
      quantumState: collapsedSystemQuantumState(),
    });
  }

  private queueMessageForAgent(agentId: string, message: QuantumMessage): void {
    let queue = this.messageQueue.get(agentId);
    let head: number;
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
      head = 0;
    } else {
      head = this.queueHeads.get(agentId) ?? 0;
    }
    queue.push(message);

    // 队列封顶：丢弃最旧消息，防止离线agent导致内存无限增长。
    // R13：死前缀游标替代 shift()——满桶时每次 shift 是 O(cap) 的整段
    // 元素搬移（伪造目标洪泛下的确定性放大面），游标推进 O(1)，live
    // 视图 [head, length) 的内容与逐条 shift 完全一致
    const cap = this.config.communication?.maxQueuedMessages ?? 1000;
    while (queue.length - head > cap) {
      head++;
      this.droppedMessages++;
    }
    this.queueHeads.set(agentId, head);
    // 死前缀过半才物理压缩（均摊 O(1)/消息；压缩只移除已出窗元素）
    if (head * 2 >= queue.length) {
      queue.splice(0, head);
      this.queueHeads.set(agentId, 0);
    }

    this.emit('message_queued', { agentId, message });
  }

  private broadcastMessage(message: QuantumMessage): void {
    // 收集开放连接后序列化一次，零连接时完全跳过序列化
    const openConnections: string[] = [];
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        // 广播接收面与注入面同口径（鉴权开启时）：未认证连接不得收到
        // 广播载荷——空订阅「默认收全部」曾使 authToken 只挡注入不挡
        // 接收，任何能建立 TCP 连接的对端可被动收听全部广播内容
        // （与 authToken 配置 JSDoc「全部流量路径仅对已认证连接开放」
        // 的主张矛盾）。connection_ack/error 帧经专用出口直发，不受影响
        if (!this.authenticated(connection)) continue;
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

  /**
   * 订阅相关性：只在 subscriptions.length > 0 时被 broadcastMessage 调用
   * （「无订阅=接收全部广播」在调用点判定，曾在此重复一份恒假回退分支，
   * 已按死代码清偿删除）。
   */
  private isRelevantForConnection(
    message: QuantumMessage,
    connection: WebSocketConnection,
  ): boolean {
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
    // 出站构造 fail-fast（负对照契约）：入站 socket 畸形消息按 F05/F10
    // warn+丢弃，但进程内调用方传垃圾参数是编程错误——
    // - 空 source 此前构造出的消息会在 validateMessage 被静默丢弃，
    //   调用方却拿到「已创建」的消息对象；
    // - 单播/组播目标并存时 targetAgentIds 此后被静默忽略；
    // - 空目标数组此前走 forEach 零投递，静默无人收到。
    if (typeof sourceAgentId !== 'string' || sourceAgentId.length === 0) {
      throw new MessageValidationError('createMessage(): sourceAgentId must be a non-empty string');
    }
    if (targetAgentId !== undefined && targetAgentIds !== undefined) {
      throw new MessageValidationError(
        'createMessage(): targetAgentId and targetAgentIds are mutually exclusive',
      );
    }
    if (targetAgentIds !== undefined) {
      if (!Array.isArray(targetAgentIds) || targetAgentIds.length === 0) {
        throw new MessageValidationError(
          'createMessage(): targetAgentIds must be a non-empty array of agent ids',
        );
      }
      for (const id of targetAgentIds) {
        if (typeof id !== 'string' || id.length === 0) {
          throw new MessageValidationError(
            'createMessage(): targetAgentIds entries must be non-empty strings',
          );
        }
      }
    }
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
    // 空桶防御检查已删除（死代码清偿）：恒假分支——桶经
    // queueMessageForAgent 创建（maxQueuedMessages=0 时会残留空桶），
    // 但空桶进入下方循环天然零投递、零剩余、删桶返回 0，与原检查逐点
    // 同义，删除断言零行为差异。
    const queuedMessages = this.messageQueue.get(agentId);
    if (!queuedMessages) return 0;
    // live 视图：死前缀游标之前的消息已按容量/淘汰语义出队（见
    // queueMessageForAgent），head=0 时即原数组本身
    const head = this.queueHeads.get(agentId) ?? 0;
    const liveMessages = head > 0 ? queuedMessages.slice(head) : queuedMessages;

    // 该 agent 的候选连接快照（R13：agent 路由索引直取，替代每冲刷一次的
    // 全表 O(连接数) 扫描；索引序 == 连接表插入序 == 原扫描序，首个 OPEN
    // 连接的选择逐点一致）。逐消息仍重新校验 OPEN 与存在性（背压断连会使
    // readyState 离开 OPEN），语义与原 find 谓词逐点一致，且每条消息仍
    // 恰好尝试一次发送
    const indexed = this.connectionsByAgent.get(agentId);
    const candidates: WebSocketConnection[] = indexed === undefined ? [] : indexed.slice();

    let deliveredCount = 0;
    const remainingMessages: QuantumMessage[] = [];

    for (const message of liveMessages) {
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
      this.queueHeads.set(agentId, 0);
    } else {
      this.messageQueue.delete(agentId);
      this.queueHeads.delete(agentId);
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
    // R13：免分配求和（原 Array.from+reduce 每次调用拷贝整个桶值数组）；
    // 计数扣除死前缀游标——live 消息数与逐条 shift 的数组长度逐点一致
    let total = 0;
    for (const [agentId, messages] of this.messageQueue) {
      total += messages.length - (this.queueHeads.get(agentId) ?? 0);
    }
    return total;
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

    // start()/shutdown()竞争收尾：bind 被关闭打断后 'listening' 与 'error'
    // 都不再到来，在途的 start() Promise 将永久悬挂（等待方无限 await）。
    // 以确定性拒绝收尾，调用方能立即感知并清理，而非无声挂死。
    const pendingStartReject = this.startReject;
    this.startReject = null;
    if (this.startPromise !== null && pendingStartReject !== null) {
      pendingStartReject(
        new StateError('QuantumBus.shutdown() called before start() finished listening'),
      );
    }

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
    this.connectionsByAgent.clear();
    this.messageQueue.clear();
    this.queueHeads.clear();
    this.slowConsumerTierState.clear();

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

  /**
   * R18-J 分级降质观测面快照：未配置时返回 null（该面不存在，与缺省
   * 字节不变一致）。tierEntries/tierExits 按配置级序（1-based 级的
   * 计数在数组下标 k-1）；degradedConnections 是当前处于非零级的连接
   * 快照（连接移除时其 tier 状态一并拆除，不残留）。
   */
  getSlowConsumerDegradationMetrics(): {
    tierEntries: number[];
    tierExits: number[];
    shedDroppedMessages: number;
    quarantineDeferredMessages: number;
    degradedConnections: Array<{
      connectionId: string;
      agentId: string;
      tier: number;
      action: 'warn' | 'shed-low-priority' | 'quarantine';
    }>;
  } | null {
    if (this.slowConsumerTiers === null) return null;
    const degradedConnections: Array<{
      connectionId: string;
      agentId: string;
      tier: number;
      action: 'warn' | 'shed-low-priority' | 'quarantine';
    }> = [];
    for (const [connectionId, tier] of this.slowConsumerTierState) {
      if (tier > 0) {
        degradedConnections.push({
          connectionId,
          agentId: this.connections.get(connectionId)?.agentId ?? '',
          tier,
          action: this.slowConsumerTiers[tier - 1]!.action,
        });
      }
    }
    return {
      tierEntries: [...this.slowConsumerStats.tierEntries],
      tierExits: [...this.slowConsumerStats.tierExits],
      shedDroppedMessages: this.slowConsumerStats.shedDroppedMessages,
      quarantineDeferredMessages: this.slowConsumerStats.quarantineDeferredMessages,
      degradedConnections,
    };
  }
}
