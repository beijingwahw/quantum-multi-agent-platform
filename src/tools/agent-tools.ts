export async function subagent(params: {
  description: string;
  prompt: string;
  run_in_background?: boolean;
}): Promise<any> {
  // 这里可以集成真实的subagent调用
  // 目前返回模拟结果
  return {
    subagentId: Math.random().toString(36).substr(2, 9),
    description: params.description,
    status: 'completed',
    result: `Subagent task completed: ${params.description}`,
    createdAt: new Date().toISOString()
  };
}