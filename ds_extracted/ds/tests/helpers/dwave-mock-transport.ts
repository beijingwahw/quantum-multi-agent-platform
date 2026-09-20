/**
 * DWave SAPI mock 传输共享夹具 —— 三处测试的重复面提炼（R19，纯新增）。
 *
 * 提炼源（既有文件只读、不改编——重接线是收口批的裁决面）：
 * - tests/qpu-backend.test.ts 的 mockTransport（请求捕获＋responder 全功能版）；
 * - tests/r15p1-dwave-occurrences-garbage.test.ts 的 backendWith（单份已完成
 *   问题：POST 直接回 COMPLETED，无轮询）；
 * - tests/r15p1-dwave-timeout-budget.test.ts 的内联 fetch（POST 延迟／
 *   GET 永远 PENDING／DELETE 404／POST 挂死到 AbortSignal）。
 *
 * 本工具是三者的并集：捕获（method/url/token/body）＋ responder 协议
 * （按请求分支）＋回复信封（HTTP 状态／JSON 或原始体／额外头／前置延迟／
 * 挂死到中止）。行为差异留给各测试的 responder——那是测试语义，不是夹具。
 *
 * 无 RNG、无真实网络；导入零副作用（两个工厂函数）。
 */

/** 捕获到的 SAPI 请求（body 为已解析的 JSON；非字符串体记 null） */
export interface CapturedDWaveRequest {
  readonly method: string;
  readonly url: string;
  readonly token: string | undefined;
  readonly body: unknown;
}

/**
 * 回复信封：缺省 HTTP 200 + JSON 体。注意信封的 HTTP 状态字段名是
 * **httpStatus**——刻意不叫 status：SAPI 问题对象自身携带字符串字段
 * status（'PENDING'/'COMPLETED'），两者同名会在扁平书写时静默错位
 * （首红实证：Responder 把 {status:'COMPLETED'} 当 HTTP 状态传入
 * Response 构造器直接 RangeError）。httpStatus≠200 / 原始体 / 额外头
 * （如 429 的 retry-after）／前置延迟／挂死到 AbortSignal 中止——按需
 * 组合即可表达三处提炼源的全部形态。
 */
export interface DWaveMockReply {
  /** HTTP 状态码（缺省 200） */
  readonly httpStatus?: number;
  /** JSON 体（存在时自动带 Content-Type: application/json） */
  readonly json?: unknown;
  /** 原始体（与 json 互斥；两者都缺省时体为 null，如 404 DELETE） */
  readonly raw?: string;
  /** 额外响应头（覆盖同名缺省头） */
  readonly headers?: Record<string, string>;
  /** 响应前置延迟毫秒（慢 POST 类场景） */
  readonly delayMs?: number;
  /** 永不 resolve；init.signal 中止时以 Error 拒绝（挂死 POST 类场景） */
  readonly hangUntilAbort?: boolean;
}

function toUrl(input: string | URL | Request): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

function buildResponse(reply: DWaveMockReply): Response {
  const httpStatus = reply.httpStatus ?? 200;
  const hasJson = reply.json !== undefined;
  const headers: Record<string, string> = {
    ...(hasJson ? { 'Content-Type': 'application/json' } : {}),
    ...reply.headers,
  };
  const body = reply.raw !== undefined ? reply.raw : hasJson ? JSON.stringify(reply.json) : null;
  return new Response(body, { status: httpStatus, headers });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 通用 DWave mock 传输：每个请求先入捕获列表，再交 responder 决定回复。
 * responder 可按 method/url 分支（提交→轮询→取消的全链路形态）。
 */
export function dwaveMockTransport(responder: (req: CapturedDWaveRequest) => DWaveMockReply): {
  fetchImpl: typeof fetch;
  requests: CapturedDWaveRequest[];
} {
  const requests: CapturedDWaveRequest[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const captured: CapturedDWaveRequest = {
      method: init?.method ?? 'GET',
      url: toUrl(input),
      token: headers['X-Auth-Token'],
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    };
    requests.push(captured);
    const reply = responder(captured);
    if (reply.delayMs !== undefined) await sleep(reply.delayMs);
    if (reply.hangUntilAbort === true) {
      // 挂死面：仅在调用方注入 signal 时可被中止（DWave 客户端恒带
      // AbortSignal.timeout）；无 signal 则永不 settle——与被测挂死路径一致
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new Error('This operation was aborted')),
        );
      });
    }
    return buildResponse(reply);
  };
  return { fetchImpl, requests };
}
/**
 * 单份已完成问题的便捷传输（r15p1-occurrences 的 backendWith 形态）：
 * 每个请求（POST 即终态，无轮询）返回 { id, status: 'COMPLETED', answer }。
 */
export function dwaveCompletedProblemTransport(
  answer: unknown,
  opts: { id?: string } = {},
): typeof fetch {
  const id = opts.id ?? 'prob-mock';
  const body = JSON.stringify({ id, status: 'COMPLETED', answer });
  return async () =>
    new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
}
