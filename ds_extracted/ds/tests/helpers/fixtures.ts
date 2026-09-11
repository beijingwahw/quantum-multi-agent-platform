/**
 * 共享测试夹具 —— 各测试文件中逐字重复的 builder 收敛于此。
 *
 * 只收敛「字节级同体」的副本（仅第三可选参语义不同：name/load/entanglement）；
 * 语义有分歧的夹具（如 audit-p2p3 的 overrides 形态、makeTask 的能力/
 * 优先级差异）保留在原文件——统一它们会悄悄改变夹具语义，得不偿失。
 */
import type { Agent } from '../../src/types/quantum-types.js';

export interface MakeAgentOptions {
  /** 展示名（默认同 id） */
  name?: string;
  /** 初始负载（默认 0；设 80 之类的阈值用于过载边界用例） */
  load?: number;
  /** 量子纠缠对端 agent id 列表（默认无纠缠） */
  entanglement?: string[];
}

/** 标准空闲 developer agent 夹具（各调度器/回归测试的公共底座） */
export function makeAgent(id: string, capabilities: string[], opts: MakeAgentOptions = {}): Agent {
  return {
    id,
    name: opts.name ?? id,
    type: 'developer',
    capabilities,
    state: 'idle',
    load: opts.load ?? 0,
    position: { x: 0, y: 0, z: 0 },
    quantumEntanglement: opts.entanglement ?? [],
    lastHeartbeat: new Date(),
  };
}

/** 等待指定毫秒（黑盒定时器路径的等待原语——宽度须吸收 CI 负载与时钟粒度） */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
