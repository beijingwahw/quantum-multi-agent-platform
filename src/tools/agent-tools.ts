import { v4 as uuidv4 } from 'uuid';

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

export async function subagent(params: SubagentParams): Promise<SubagentResult> {
  // 这里可以集成真实的subagent调用
  // 目前返回模拟结果（status='mock' 标记，调用方可据此区分真伪）
  return {
    subagentId: uuidv4(),
    description: params.description,
    status: 'mock',
    result: `Subagent task completed: ${params.description}`,
    createdAt: new Date().toISOString(),
  };
}
