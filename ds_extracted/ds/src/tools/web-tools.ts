import { ToolError } from '../utils/errors.js';

/**
 * ⚠️ 本地模拟实现：web_search 不发起任何网络请求，返回构造的占位结果。
 * 接入真实搜索 API 时必须校验目标主机（SSRF 防护）。
 */
export function web_search(query: string): Promise<string> {
  // mock 也有输入下界：空/非字符串查询此前产出 "[mock] Search results for """
  // 的空转占位，垃圾参数在入口拒绝
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new ToolError('web_search requires a non-empty query string');
  }
  return Promise.resolve(
    `[mock] Search results for "${query}":\n1. Result 1 about ${query}\n2. Result 2 about ${query}\n3. Result 3 about ${query}`,
  );
}
