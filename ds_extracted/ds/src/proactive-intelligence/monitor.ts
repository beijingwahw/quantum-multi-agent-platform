/**
 * 状态监控器 (Observer)：事件缓冲、保留清理与聚合统计。
 * 拆分自 index.ts——职责单一的感知层组件。
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import type { MonitorEvent } from './types.js';

/** 状态监控器配置 */
export interface StateMonitorConfig {
  maxBufferSize?: number;
  retentionMs?: number;
}

/** 状态监控聚合统计 */
export interface MonitorStatistics {
  /** 累计观察事件总数（自构造/清空起单调递增，不受过期/容量淘汰影响） */
  total: number;
  /** 当前未过期事件数（受 retentionMs 与容量淘汰影响） */
  live: number;
  /** 按事件类型计数（活跃窗口口径 = live，不含已过期/已淘汰事件） */
  byType: Record<string, number>;
  /** 按严重度计数（活跃窗口口径 = live） */
  bySeverity: Record<string, number>;
  /** 最近 1 分钟事件数（活跃窗口内 timestamp > now-60s 的时间片计数） */
  recent: number;
  /** critical 严重度事件数（活跃窗口口径 = live） */
  critical: number;
}

export class StateMonitor extends EventEmitter {
  private eventBuffer: MonitorEvent[] = [];
  private maxBufferSize = 10000;
  private retentionMs = 3600000; // 1小时
  /**
   * 已淘汰事件的惰性前缀游标（过期与容量超限共用——两者都只影响
   * 前缀，语义统一为「逻辑上已不可见」）。事件按时间单调入列，
   * 过期项必然是前缀。读取路径跳过 [0, prefix)，物理压缩推迟到
   * 前缀过半——每事件均摊 O(1)，事件风暴下不再逐事件全量 filter
   * （曾为 O(n²)）。
   */
  private expiredPrefix = 0;
  /** 累计观察计数（total 的单一事实源，observe 时 O(1) 递增） */
  private totalObserved = 0;
  /** 各类型最新事件索引（observe 时 O(1) 维护，供规则/快照免扫描取用） */
  private latestByType = new Map<string, MonitorEvent>();
  /**
   * 活跃窗口（未过期）增量计数表：observe 入窗 +1，惰性前缀游标
   * 推进出窗 -1，clear 清零——getStatistics 不再逐调用全量扫描缓冲区
   * （万级缓冲 + 高频批次决策下，每批 O(n) 聚合是决策热路径的固定税）。
   * 事件离开缓冲区只有「前缀游标推进」一条路径，计数与游标同步即不漂移。
   */
  private liveByType = new Map<string, number>();
  private liveBySeverity = new Map<string, number>();
  private liveCritical = 0;

  constructor(private config: StateMonitorConfig = {}) {
    super();
    // 显式 undefined 判断：falsy 判断会把 maxBufferSize=0 /
    // retentionMs=0（「立即淘汰/不限量」的合法语义）静默反转回默认值
    if (config.maxBufferSize !== undefined) {
      this.maxBufferSize = config.maxBufferSize;
    }
    if (config.retentionMs !== undefined) {
      this.retentionMs = config.retentionMs;
    }
  }

  /** 监控事件 */
  observe(event: Omit<MonitorEvent, 'id' | 'timestamp'>): MonitorEvent {
    const monitorEvent: MonitorEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    this.eventBuffer.push(monitorEvent);
    this.totalObserved++;
    this.latestByType.set(monitorEvent.type, monitorEvent);
    // 活跃窗口计数：入窗 +1（出窗减法见 cleanup 的游标推进）
    this.liveByType.set(monitorEvent.type, (this.liveByType.get(monitorEvent.type) ?? 0) + 1);
    this.liveBySeverity.set(
      monitorEvent.severity,
      (this.liveBySeverity.get(monitorEvent.severity) ?? 0) + 1,
    );
    if (monitorEvent.severity === 'critical') this.liveCritical++;

    // 清理过期事件
    this.cleanup();

    // 触发决策引擎
    this.emit('event', monitorEvent);

    return monitorEvent;
  }

  /** 获取事件历史 */
  getEvents(filter?: {
    type?: string;
    source?: string;
    severity?: string;
    since?: Date;
  }): MonitorEvent[] {
    let events = this.eventBuffer.slice(this.expiredPrefix);

    if (filter) {
      if (filter.type) {
        events = events.filter((e) => e.type === filter.type);
      }
      if (filter.source) {
        events = events.filter((e) => e.source === filter.source);
      }
      if (filter.severity) {
        events = events.filter((e) => e.severity === filter.severity);
      }
      const since = filter.since;
      if (since !== undefined) {
        events = events.filter((e) => e.timestamp >= since);
      }
    }

    return events;
  }

  /**
   * 获取聚合统计（增量维护：byType/bySeverity/critical 由 observe/cleanup
   * O(1) 维护，调用时仅拷贝计数表 O(类型数)；recent 对时间单调的活跃区
   * 二分定位 60s 窗口下界 O(log n)。原实现为每调用 4 次独立 reduce 全量
   * 扫描，后改为单遍扫描，现为零扫描——每批决策的快照成本不再随缓冲区
   * 规模线性增长）。
   */
  getStatistics(): MonitorStatistics {
    const byType: Record<string, number> = {};
    for (const [type, count] of this.liveByType) byType[type] = count;
    const bySeverity: Record<string, number> = {};
    for (const [severity, count] of this.liveBySeverity) bySeverity[severity] = count;

    return {
      total: this.totalObserved,
      live: this.eventBuffer.length - this.expiredPrefix,
      byType,
      bySeverity,
      recent: this.countRecent(),
      critical: this.liveCritical,
    };
  }

  /**
   * 最近 60s 事件数：活跃区按时间戳单调（observe 入列即打点），二分找
   * 第一个 timestamp > now-60000 的下界，右侧长度即窗口计数。
   * 与旧实现的边界语义一致（t > cutoff 计入、t === cutoff 不计入）。
   */
  private countRecent(): number {
    const cutoff = Date.now() - 60000;
    let lo = this.expiredPrefix;
    let hi = this.eventBuffer.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.eventBuffer[mid]!.timestamp.getTime() > cutoff) hi = mid;
      else lo = mid + 1;
    }
    return this.eventBuffer.length - lo;
  }

  /**
   * 取指定类型的最新事件（O(1) 索引读取，淘汰事件同样可查——
   * 「最新一条」的保留期独立于缓冲区窗口）。
   */
  getLatestEventByType(type: string): MonitorEvent | null {
    return this.latestByType.get(type) ?? null;
  }

  /** 清理过期事件（游标推进同步扣减活跃窗口计数——见 liveByType 注释） */
  private cleanup(): void {
    const cutoff = Date.now() - this.retentionMs;

    // 过期项是前缀（时间单调），游标惰性推进
    while (
      this.expiredPrefix < this.eventBuffer.length &&
      this.eventBuffer[this.expiredPrefix]!.timestamp.getTime() <= cutoff
    ) {
      this.uncountExpired(this.eventBuffer[this.expiredPrefix]!);
      this.expiredPrefix++;
    }
    // 容量超限：最旧的同样计入前缀
    const overflow = this.eventBuffer.length - this.maxBufferSize;
    if (overflow > 0) {
      const newPrefix = Math.min(this.eventBuffer.length, this.expiredPrefix + overflow);
      while (this.expiredPrefix < newPrefix) {
        this.uncountExpired(this.eventBuffer[this.expiredPrefix]!);
        this.expiredPrefix++;
      }
    }
    // 前缀过半才物理压缩（splice 搬移一次覆盖多个事件，均摊 O(1)/事件；
    // 压缩移除的均为已出窗事件，计数不在此重复扣减）
    if (this.expiredPrefix * 2 >= this.eventBuffer.length) {
      this.eventBuffer.splice(0, this.expiredPrefix);
      this.expiredPrefix = 0;
    }
  }

  /** 事件出活跃窗口：计数 -1（归零即删键，避免计数表沉淀零值键） */
  private uncountExpired(event: MonitorEvent): void {
    const typeCount = this.liveByType.get(event.type);
    if (typeCount === undefined) return; // 防御：不可达（计数与游标同步维护）
    if (typeCount <= 1) this.liveByType.delete(event.type);
    else this.liveByType.set(event.type, typeCount - 1);

    const severityCount = this.liveBySeverity.get(event.severity);
    if (severityCount !== undefined) {
      if (severityCount <= 1) this.liveBySeverity.delete(event.severity);
      else this.liveBySeverity.set(event.severity, severityCount - 1);
    }
    if (event.severity === 'critical') this.liveCritical--;
  }

  /** 清空事件缓冲区 */
  clear(): void {
    this.eventBuffer = [];
    this.expiredPrefix = 0;
    this.latestByType.clear();
    this.totalObserved = 0;
    this.liveByType.clear();
    this.liveBySeverity.clear();
    this.liveCritical = 0;
  }
}
