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
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  /** 最近 1 分钟事件数 */
  recent: number;
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

  /** 获取聚合统计（单遍聚合：原为 4 次独立 reduce，每批决策 ×4 全量扫描） */
  getStatistics(): MonitorStatistics {
    const events = this.liveEvents();
    const now = Date.now();
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let recent = 0;
    let critical = 0;

    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
      if (now - e.timestamp.getTime() < 60000) recent++;
      if (e.severity === 'critical') critical++;
    }

    return {
      total: this.totalObserved,
      live: events.length,
      byType,
      bySeverity,
      recent,
      critical,
    };
  }

  /**
   * 取指定类型的最新事件（O(1) 索引读取，淘汰事件同样可查——
   * 「最新一条」的保留期独立于缓冲区窗口）。
   */
  getLatestEventByType(type: string): MonitorEvent | null {
    return this.latestByType.get(type) ?? null;
  }

  /** 未过期事件视图（跳过惰性前缀的浅拷贝，仅供只读遍历） */
  private liveEvents(): MonitorEvent[] {
    return this.eventBuffer.slice(this.expiredPrefix);
  }

  /** 清理过期事件 */
  private cleanup(): void {
    const cutoff = Date.now() - this.retentionMs;

    // 过期项是前缀（时间单调），游标惰性推进
    while (
      this.expiredPrefix < this.eventBuffer.length &&
      this.eventBuffer[this.expiredPrefix]!.timestamp.getTime() <= cutoff
    ) {
      this.expiredPrefix++;
    }
    // 容量超限：最旧的同样计入前缀
    const overflow = this.eventBuffer.length - this.maxBufferSize;
    if (overflow > 0) {
      this.expiredPrefix = Math.min(this.eventBuffer.length, this.expiredPrefix + overflow);
    }
    // 前缀过半才物理压缩（splice 搬移一次覆盖多个事件，均摊 O(1)/事件）
    if (this.expiredPrefix * 2 >= this.eventBuffer.length) {
      this.eventBuffer.splice(0, this.expiredPrefix);
      this.expiredPrefix = 0;
    }
  }

  /** 清空事件缓冲区 */
  clear(): void {
    this.eventBuffer = [];
    this.expiredPrefix = 0;
    this.latestByType.clear();
    this.totalObserved = 0;
  }
}
