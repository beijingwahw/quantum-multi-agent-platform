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

import type { QuantumBackend, QpuSampleSet, QpuSolveOptions } from './quantum-backend';
import { registerBackend } from './quantum-backend';
import { BackendError } from '../../utils/errors';

export interface DWaveConfig {
  token?: string;
  endpoint?: string;
  /** Leap 混合求解器名（默认）或结构化 QPU 求解器名 */
  solver?: string;
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

    // 提交（异步任务可能返回 PENDING → 轮询直到 COMPLETED）
    const submitted = await this.post<DWaveProblemResponse>('problems/', body, timeoutMs);
    let problem = submitted;
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
      // 每次请求只消耗剩余预算，总墙钟时间不超过 timeoutMs
      problem = await this.get<DWaveProblemResponse>(
        `problems/${encodeURIComponent(problem.id)}`,
        remaining,
      );
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

  private async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    const response = await fetch(`${this.endpoint}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new BackendError(
        `DWave POST ${path} → HTTP ${response.status}: ${await safeText(response)}`,
      );
    }
    return parseJson<T>(response, path);
  }

  private async get<T>(path: string, timeoutMs: number): Promise<T> {
    const response = await fetch(`${this.endpoint}/${path}`, {
      headers: { 'X-Auth-Token': this.token },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new BackendError(
        `DWave GET ${path} → HTTP ${response.status}: ${await safeText(response)}`,
      );
    }
    return parseJson<T>(response, path);
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
    const q1 = Math.floor(key / nqubits);
    const q2 = key % nqubits;
    out.push([q1, q2, value]);
  }
  return out;
}

/** 耦合 Map 键 → "q1,q2"（经典 ising 字典格式） */
function couplingLabel(key: number, nqubits: number): string {
  return `${Math.floor(key / nqubits)},${key % nqubits}`;
}

// ----------------------------------------------------------------------------
// 响应解析：经典格式 + qp 压缩格式
// ----------------------------------------------------------------------------

function parseAnswer(rawAnswer: unknown, nqubits: number): DWaveAnswer {
  if (typeof rawAnswer !== 'object' || rawAnswer === null) {
    throw new BackendError('DWave response is missing the answer field');
  }
  const answer = rawAnswer as Record<string, unknown>;

  // 经典格式：solutions 为 ±1 自旋数组
  if (Array.isArray(answer.solutions)) {
    return {
      solutions: answer.solutions as number[][],
      energies: asNumberArray(answer.energies) ?? [],
      occurrences:
        asNumberArray(answer.num_occurrences) ?? (answer.solutions as number[][]).map(() => 1),
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
    const numSolutions = asNumber(answer.num_solutions) ?? Math.floor(bits.length / nqubits);
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

// 按需注册：有凭据时成为默认真实硬件后端（无凭据时 isAvailable()=false，
// getBackend() 自动回退本地精确引擎）
const dwave = new DWaveBackend();
if (dwave.isAvailable()) {
  registerBackend(dwave);
}
