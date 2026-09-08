/**
 * dwave-backend —— D-Wave Leap 真 QPU 后端（REST 客户端）
 *
 * 提交路径：AssignmentProblem → toIsing() → (h, J) → SAPI /problems/
 * 求解器选择：
 *   - Leap 混合求解器（默认）：接受任意 BQM（自动分解，内部以真 QPU
 *     求解难核）——无需手工拓扑嵌入，调度问题开箱即用。
 *   - 结构化 QPU 求解器（Advantage 等）：要求问题嵌入 Chimera/Pegasus
 *     拓扑，建议经 Ocean EmbeddingComposite（文档说明）；本客户端按
 *     原始 ising 格式提交，适用于已嵌入的 h/J。
 *
 * 凭据：DWAVE_API_TOKEN（或 D_WAVE_API_TOKEN）环境变量，或构造器显式
 * 传入。endpoint 默认 https://cloud.dwavesys.com/sapi/v2。
 * 响应兼容两种格式：经典 solutions 数组与 qp 压缩格式。
 */

import type { QuantumBackend, QpuSampleSet, QpuSolveOptions } from './quantum-backend.js';
import { registerBackend } from './quantum-backend.js';
import { decodeCouplingKey } from '../quantum-optimizer.js';
import { BackendError } from '../../utils/errors.js';

export interface DWaveConfig {
  token?: string;
  endpoint?: string;
  /** Leap 混合求解器名（默认）或结构化 QPU 求解器名 */
  solver?: string;
  /**
   * 可注入传输函数（默认全局 fetch）。测试注入 mock 可去除真实
   * TCP 握手/端口分配/关闭挂起等网络时序（受限网络 CI 间歇红的主因），
   * 生产路径不受影响。
   */
  fetch?: typeof fetch;
}

const DEFAULT_ENDPOINT = 'https://cloud.dwavesys.com/sapi/v2';
const DEFAULT_SOLVER = 'hybrid_binary_quadratic_model_version2p';

/** SAPI 问题对象的最小形状（轮询与答案提取实际消费的字段） */
interface DWaveProblemResponse {
  id?: string;
  status?: string;
  answer?: unknown;
  error_message?: unknown;
  num_occurrences_sum?: number;
}

/** 可继续轮询的进行中状态；其余未知状态（EXCEPTION 等）立即失败 */
const PENDING_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'SUBMITTED']);

/** 解析后的答案（内部统一格式） */
interface DWaveAnswer {
  solutions: number[][];
  energies: number[];
  occurrences: number[];
}

export class DWaveBackend implements QuantumBackend {
  readonly name: string;
  readonly realHardware = true;

  private readonly token: string;
  private readonly endpoint: string;
  private readonly solverName: string;
  private readonly transport: typeof fetch;

  constructor(config: DWaveConfig = {}) {
    this.token = config.token ?? process.env.DWAVE_API_TOKEN ?? process.env.D_WAVE_API_TOKEN ?? '';
    const endpoint = (
      config.endpoint ??
      process.env.DWAVE_API_ENDPOINT ??
      DEFAULT_ENDPOINT
    ).replace(/\/$/, '');
    // 凭据随每个请求发往该endpoint：只允许 https（或本机调试的http），
    // 防止被注入的明文endpoint把token外带到任意主机
    if (!endpoint.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(endpoint)) {
      throw new BackendError(`DWaveBackend: endpoint must be https (got ${endpoint})`);
    }
    this.endpoint = endpoint;
    this.solverName = config.solver ?? process.env.DWAVE_SOLVER ?? DEFAULT_SOLVER;
    this.transport = config.fetch ?? ((input, init) => fetch(input, init));
    this.name = `dwave:${this.solverName}`;
  }

  isAvailable(): boolean {
    return this.token.length > 0;
  }

  async solveIsing(
    h: number[],
    j: Map<number, number>,
    nqubits: number,
    options: QpuSolveOptions = {},
  ): Promise<QpuSampleSet> {
    if (!this.isAvailable()) {
      throw new BackendError(
        'DWaveBackend: missing credentials. Set the DWAVE_API_TOKEN environment ' +
          'variable or pass a token to the constructor.',
      );
    }
    const numReads = options.numReads ?? 100;
    const timeoutMs = options.timeoutMs ?? 60_000;

    // 混合求解器 → bqm 三元组格式；结构化求解器 → 经典 ising 字典格式
    const isHybrid = this.solverName.startsWith('hybrid');
    const body: Record<string, unknown> = isHybrid
      ? {
          solver: this.solverName,
          type: 'bqm',
          data: {
            linear: denseLinear(h),
            quadratic: sparseQuadratic(j, nqubits),
          },
          params: { num_reads: numReads, label: 'quantum-multi-agent-scheduler' },
        }
      : {
          solver: this.solverName,
          type: 'ising',
          data: {
            h: Object.fromEntries(h.map((value, q) => [String(q), value])),
            J: Object.fromEntries(
              [...j.entries()].map(([key, value]) => [couplingLabel(key, nqubits), value]),
            ),
          },
          params: { num_reads: numReads, label: 'quantum-multi-agent-scheduler' },
        };

    // 提交（异步任务可能返回 PENDING → 轮询直到 COMPLETED）。
    // 提交成功后的任何失败路径都会触发已付费问题的孤儿化——finally 兜底
    // best-effort 取消，不让它继续烧 QPU 配额。
    const submitted = await this.post<DWaveProblemResponse>('problems/', body, timeoutMs);
    let problem = submitted;
    try {
      const deadline = Date.now() + timeoutMs;
      while (problem.status !== 'COMPLETED') {
        if (problem.status === 'FAILED' || problem.status === 'CANCELLED') {
          throw new BackendError(
            `DWave problem ${problem.status}: ${JSON.stringify(problem.error_message ?? {})}`,
          );
        }
        // 未知状态（EXCEPTION 等）不可重试：立即失败而不是空转到超时
        if (problem.status === undefined || !PENDING_STATUSES.has(problem.status)) {
          throw new BackendError(
            `DWave problem entered unknown status '${problem.status}' (id=${problem.id ?? 'none'})`,
          );
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new BackendError(
            `DWave polling timed out (${timeoutMs}ms), problem id ${problem.id}`,
          );
        }
        await sleep(Math.min(500, remaining));
        if (!problem.id) {
          throw new BackendError('DWave submit response is missing the problem id; cannot poll');
        }
        // 每次请求只消耗剩余预算，总墙钟时间不超过 timeoutMs。
        // 瞬态轮询失败（网络抖动/5xx）重试一次而不是抛弃已提交的问题。
        problem = await this.pollWithRetry(problem.id, remaining);
      }
    } catch (error) {
      if (problem.id) await this.cancelQuietly(problem.id);
      throw error;
    }

    const answer = parseAnswer(problem.answer, nqubits);
    return {
      spins: answer.solutions,
      energies: answer.energies,
      occurrences: answer.occurrences,
      solver: this.solverName,
      realHardware: true,
    };
  }

  /** 轮询 + 瞬态重试：单次 GET 失败在剩余预算内退避重试一次，再失败才抛出 */
  private async pollWithRetry(
    problemId: string,
    remainingMs: number,
  ): Promise<DWaveProblemResponse> {
    let retried = false;
    for (;;) {
      try {
        return await this.get<DWaveProblemResponse>(
          `problems/${encodeURIComponent(problemId)}`,
          Math.max(1, remainingMs),
        );
      } catch (error) {
        // 已提交问题的轮询失败多半是瞬态（连接重置/网关 5xx/429 限流）：
        // 429 是服务端显式限流信号，固定 500ms 退避在限流窗口内重试
        // 只会再吃一次 429——优先尊重 Retry-After（存在时），否则退避
        // 加倍。重试一次，连续失败才升级为错误。
        if (!retried && remainingMs > 500) {
          retried = true;
          const retryAfterMs = (error as { retryAfterMs?: number }).retryAfterMs;
          const backoff = retryAfterMs ?? (String(error).includes('429') ? 1000 : 500);
          await sleep(Math.min(backoff, Math.max(1, remainingMs)));
          continue;
        }
        throw error;
      }
    }
  }

  /** best-effort 取消远端问题（失败静默——取消本身不应掩盖原始错误） */
  private async cancelQuietly(problemId: string): Promise<void> {
    try {
      await this.del(`problems/${encodeURIComponent(problemId)}`, 5_000);
    } catch {
      // 忽略：问题可能已结束，或网络已不可用
    }
  }

  private async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    let response: Response;
    try {
      response = await this.transport(`${this.endpoint}/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': this.token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new BackendError(
        `DWave POST ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new BackendError(
        `DWave POST ${path} → HTTP ${response.status}: ${await safeText(response)}`,
      );
    }
    return parseJson<T>(response, path);
  }

  private async get<T>(path: string, timeoutMs: number): Promise<T> {
    let response: Response;
    try {
      response = await this.transport(`${this.endpoint}/${path}`, {
        headers: { 'X-Auth-Token': this.token },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new BackendError(
        `DWave GET ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    if (!response.ok) {
      const error = new BackendError(
        `DWave GET ${path} → HTTP ${response.status}: ${await safeText(response)}`,
      );
      // 429 携带 Retry-After：透传给重试方（Q3），避免限流窗口内盲重试
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          (error as BackendError & { retryAfterMs?: number }).retryAfterMs = retryAfter * 1000;
        }
      }
      throw error;
    }
    return parseJson<T>(response, path);
  }

  private async del(path: string, timeoutMs: number): Promise<void> {
    const response = await this.transport(`${this.endpoint}/${path}`, {
      method: 'DELETE',
      headers: { 'X-Auth-Token': this.token },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok && response.status !== 404) {
      throw new BackendError(`DWave DELETE ${path} → HTTP ${response.status}`);
    }
  }
}

/** 2xx 但非 JSON 的响应体给出带上下文的错误，而不是裸 SyntaxError */
async function parseJson<T>(response: Response, path: string): Promise<T> {
  const text = await response.text().catch(() => '');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BackendError(
      `DWave ${path} returned a non-JSON body: ${text.slice(0, 200) || '<empty>'}`,
    );
  }
}

// ----------------------------------------------------------------------------
// 编码辅助
// ----------------------------------------------------------------------------

/** 稠密线性项 → [[q, h_q], ...]（bqm 三元组格式，跳过零项） */
function denseLinear(h: number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let q = 0; q < h.length; q++) {
    if (h[q] !== 0) out.push([q, h[q]!]);
  }
  return out;
}

/** 耦合 Map（键 q1*nq+q2）→ [[q1, q2, J], ...] */
function sparseQuadratic(j: Map<number, number>, nqubits: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const [key, value] of j) {
    const { q1, q2 } = decodeCouplingKey(key, nqubits);
    out.push([q1, q2, value]);
  }
  return out;
}

/** 耦合 Map 键 → "q1,q2"（经典 ising 字典格式） */
function couplingLabel(key: number, nqubits: number): string {
  const { q1, q2 } = decodeCouplingKey(key, nqubits);
  return `${q1},${q2}`;
}

// ----------------------------------------------------------------------------
// 响应解析：经典格式 + qp 压缩格式
// ----------------------------------------------------------------------------

function parseAnswer(rawAnswer: unknown, nqubits: number): DWaveAnswer {
  if (typeof rawAnswer !== 'object' || rawAnswer === null) {
    throw new BackendError('DWave response is missing the answer field');
  }
  const answer = rawAnswer as Record<string, unknown>;

  // 经典格式：solutions 为 ±1 自旋数组（逐元素验证，不盲信外部 JSON 形状）
  if (Array.isArray(answer.solutions)) {
    const solutions = answer.solutions.map((row) => {
      if (!Array.isArray(row) || row.length !== nqubits || !row.every((v) => v === 1 || v === -1)) {
        throw new BackendError(
          `DWave classic answer contains a malformed solution row (expected ±1 × ${nqubits})`,
        );
      }
      return row as number[];
    });
    return {
      solutions,
      energies: asNumberArray(answer.energies) ?? [],
      occurrences: asNumberArray(answer.num_occurrences) ?? solutions.map(() => 1),
    };
  }

  // qp 压缩格式：answer.data.vector 为 16 位字流（每字小端 16 位），
  // 位值 0 → 自旋 +1，1 → 自旋 −1；每个解占 nqubits 位
  const data = answer.data as Record<string, unknown> | undefined;
  if (answer.format === 'qp' && Array.isArray(data?.vector)) {
    const words = data.vector as number[];
    const bits: number[] = [];
    for (const word of words) {
      for (let b = 0; b < 16; b++) {
        bits.push((word >> b) & 1);
      }
    }
    // 位流按 16 位字对齐填充：解数不得越过实际可用位（否则解码出
    // 幻影样本，歪曲 invalidSamples 与频率统计）
    const maxSolutions = Math.floor(bits.length / nqubits);
    // 缺 num_solutions 时的解数推断（Q9）：优先用 energies/occurrences 的
    // 数组长度做次级信号——直接全长解码会把位对齐 padding 解成幻影样本，
    // 歪曲 invalidSamples 与频率统计
    const energiesLen = (asNumberArray(answer.energies) ?? []).length;
    const occurrencesLen = (asNumberArray(answer.num_occurrences) ?? []).length;
    const fallbackCount =
      energiesLen > 0 ? energiesLen : occurrencesLen > 0 ? occurrencesLen : maxSolutions;
    const numSolutions = Math.min(asNumber(answer.num_solutions) ?? fallbackCount, maxSolutions);
    const solutions: number[][] = [];
    for (let s = 0; s < numSolutions; s++) {
      const sol: number[] = [];
      for (let q = 0; q < nqubits; q++) {
        sol.push(bits[s * nqubits + q] === 1 ? -1 : 1);
      }
      solutions.push(sol);
    }
    return {
      solutions,
      energies: asNumberArray(answer.energies) ?? [],
      occurrences: asNumberArray(answer.num_occurrences) ?? solutions.map(() => 1),
    };
  }

  throw new BackendError(`DWave unknown answer format: ${JSON.stringify(Object.keys(answer))}`);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asNumberArray(value: unknown): number[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === 'number') ? value : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '<no body>';
  }
}

// ----------------------------------------------------------------------------
// 按需注册：导入零副作用，凭据/配置在首次求解时才解析
// ----------------------------------------------------------------------------

/**
 * 懒注册代理：替代旧的模块顶层 `new DWaveBackend()`（import 时抛错可击穿
 * 整个应用；token 在 import 之后才注入的环境变量永远拿不到）。凭据存在
 * 时成为默认真实硬件后端；构造错误推迟到 solveIsing 调用点，包装为
 * BackendError 而不是原生异常。
 */
class LazyDWaveRegistration implements QuantumBackend {
  readonly name = 'dwave';
  readonly realHardware = true;
  private cached: DWaveBackend | null = null;

  private envToken(): string {
    return process.env.DWAVE_API_TOKEN ?? process.env.D_WAVE_API_TOKEN ?? '';
  }

  isAvailable(): boolean {
    return this.envToken().length > 0;
  }

  solveIsing(
    h: number[],
    j: Map<number, number>,
    nqubits: number,
    options?: QpuSolveOptions,
  ): Promise<QpuSampleSet> {
    if (!this.cached) {
      try {
        this.cached = new DWaveBackend();
      } catch (error) {
        return Promise.reject(
          new BackendError(
            `DWave backend construction failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            { cause: error },
          ),
        );
      }
    }
    return this.cached.solveIsing(h, j, nqubits, options);
  }
}

registerBackend(new LazyDWaveRegistration());
