export async function web_search(query: string): Promise<string> {
  // 这里可以集成真实的搜索引擎API
  // 目前返回模拟结果
  return `Search results for "${query}":\n1. Result 1 about ${query}\n2. Result 2 about ${query}\n3. Result 3 about ${query}`;
}