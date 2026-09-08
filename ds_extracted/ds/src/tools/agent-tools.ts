import { randomUUID } from 'node:crypto';
import { ToolError } from '../utils/errors.js';

/** subagent 调用参数 */
export interface SubagentParams {
  description: string;
  prompt: string;
  run_in_background?: boolean;
  /** 发起调用的 DSH agent id（调用方上下文） */
  requested_by?: string;
}

/** subagent 调用结果（当前为本地模拟实现，status 恒为 mock） */
export interface SubagentResult {
  subagentId: string;
  description: string;
  status: 'mock';
  result: string;
  createdAt: string;
}

export function subagent(params: SubagentParams): Promise<SubagentResult> {
  // 空描述/空提示此前会产出 "Subagent task completed: " 这类空转结果——
  // mock 也必须有输入下界，垃圾参数在入口拒绝。以 unknown 视图校验
  // （类型标注对 JS 调用方不构成约束），非空字符串通过后才放行。
  const raw = params as { description?: unknown; prompt?: unknown } | null | undefined;
  const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
  if (raw === null || raw === undefined || !isNonEmptyString(raw.description)) {
    throw new ToolError("subagent requires a non-empty 'description' parameter");
  }
  if (!isNonEmptyString(raw.prompt)) {
    throw new ToolError("subagent requires a non-empty 'prompt' parameter");
  }
  // 这里可以集成真实的subagent调用
  // 目前返回模拟结果（status='mock' 标记，调用方可据此区分真伪）
  return Promise.resolve({
    subagentId: randomUUID(),
    description: params.description,
    status: 'mock',
    result: `Subagent task completed: ${params.description}`,
    createdAt: new Date().toISOString(),
  });
}
