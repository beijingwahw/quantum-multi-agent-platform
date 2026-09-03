/**
 * 状态监控器 (Observer)：事件缓冲、保留清理与聚合统计。
 * 拆分自 index.ts——职责单一的感知层组件。
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import type { MonitorEvent } from './types';

/** 状态监控器配置 */
export interface StateMonitorConfig {
  maxBufferSize?: number;
  retentionMs?: number;
}

/** 状态监控聚合统计 */
export interface MonitorStatistics {
  total: number;
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

  constructor(private config: StateMonitorConfig = {}) {
    super();
    if (config.maxBufferSize) {
      this.maxBufferSize = config.maxBufferSize;
    }
    if (config.retentionMs) {
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
    let events = [...this.eventBuffer];

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

  /** 获取聚合统计 */
  getStatistics(): MonitorStatistics {
    const events = this.eventBuffer;
    const now = Date.now();

    return {
      total: events.length,
      byType: events.reduce<Record<string, number>>((acc, e) => {
        acc[e.type] = (acc[e.type] ?? 0) + 1;
        return acc;
      }, {}),
      bySeverity: events.reduce<Record<string, number>>((acc, e) => {
        acc[e.severity] = (acc[e.severity] ?? 0) + 1;
        return acc;
      }, {}),
      recent: events.filter((e) => now - e.timestamp.getTime() < 60000).length, // 最近1分钟
      critical: events.filter((e) => e.severity === 'critical').length,
    };
  }

  /** 清理过期事件 */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.retentionMs;

    // 删除过期事件
    this.eventBuffer = this.eventBuffer.filter((e) => e.timestamp.getTime() > cutoff);

    // 如果超过最大缓冲区，删除最旧的
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(this.eventBuffer.length - this.maxBufferSize);
    }
  }

  /** 清空事件缓冲区 */
  clear(): void {
    this.eventBuffer = [];
  }
}
