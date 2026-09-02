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

export interface DWaveConfig {
  token?: string;
  endpoint?: string;
  /** Leap 混合求解器名（默认）或结构化 QPU 求解器名 */
  solver?: string;
}

const DEFAULT_ENDPOINT = 'https://cloud.dwavesys.com/sapi/v2';
const DEFAULT_SOLVER = 'hybrid_binary_quadratic_model_version2p';

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
    this.endpoint = (config.endpoint ?? process.env.DWAVE_API_ENDPOINT ?? DEFAULT_ENDPOINT).replace(/\/$/, '');
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
    options: QpuSolveOptions = {}
  ): Promise<QpuSampleSet> {
    if (!this.isAvailable()) {
      throw new Error('DWaveBackend: 缺少凭据。设置 DWAVE_API_TOKEN 环境变量或构造器传入 token。');
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
            quadratic: sparseQuadratic(j, nqubits)
          },
          params: { num_reads: numReads, label: 'quantum-multi-agent-scheduler' }
        }
      : {
          solver: this.solverName,
          type: 'ising',
          data: {
            h: Object.fromEntries(h.map((value, q) => [String(q), value])),
            J: Object.fromEntries([...j.entries()].map(([key, value]) => [couplingLabel(key, nqubits), value]))
          },
          params: { num_reads: numReads, label: 'quantum-multi-agent-scheduler' }
        };

    // 提交（异步任务可能返回 PENDING → 轮询直到 COMPLETED）
    const submitted = await this.post('problems/', body, timeoutMs);
    let problem = submitted;
    const deadline = Date.now() + timeoutMs;
    while (problem.status !== 'COMPLETED') {
      if (problem.status === 'FAILED' || problem.status === 'CANCELLED') {
        throw new Error(`DWave problem ${problem.status}: ${JSON.stringify(problem.error_message ?? {})}`);
      }
      if (Date.now() > deadline) {
        throw new Error(`DWave 轮询超时（${timeoutMs}ms），问题ID ${problem.id}`);
      }
      await sleep(500);
      problem = await this.get(`problems/${problem.id}`, timeoutMs);
    }

    const answer = parseAnswer(problem.answer, nqubits, problem.num_occurrences_sum);
    return {
      spins: answer.solutions,
      energies: answer.energies,
      occurrences: answer.occurrences,
      solver: this.solverName,
      realHardware: true
    };
  }

  private async post(path: string, body: unknown, timeoutMs: number): Promise<any> {
    const response = await fetch(`${this.endpoint}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.token
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      throw new Error(`DWave POST ${path} → HTTP ${response.status}: ${await safeText(response)}`);
    }
    return response.json();
  }

  private async get(path: string, timeoutMs: number): Promise<any> {
    const response = await fetch(`${this.endpoint}/${path}`, {
      headers: { 'X-Auth-Token': this.token },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      throw new Error(`DWave GET ${path} → HTTP ${response.status}: ${await safeText(response)}`);
    }
    return response.json();
  }
}

// ----------------------------------------------------------------------------
// 编码辅助
// ----------------------------------------------------------------------------

/** 稠密线性项 → [[q, h_q], ...]（bqm 三元组格式，跳过零项） */
function denseLinear(h: number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let q = 0; q < h.length; q++) {
    if (h[q] !== 0) out.push([q, h[q]]);
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

function parseAnswer(answer: any, nqubits: number, _occurrencesSum?: number): DWaveAnswer {
  if (!answer) throw new Error('DWave 响应缺少 answer 字段');

  // 经典格式：solutions 为 ±1 自旋数组
  if (Array.isArray(answer.solutions)) {
    return {
      solutions: answer.solutions,
      energies: answer.energies ?? [],
      occurrences: answer.num_occurrences ?? answer.solutions.map(() => 1)
    };
  }

  // qp 压缩格式：answer.data.vector 为 16 位字流（每字小端 16 位），
  // 位值 0 → 自旋 +1，1 → 自旋 −1；每个解占 nqubits 位
  if (answer.format === 'qp' && answer.data?.vector) {
    const words: number[] = answer.data.vector;
    const bits: number[] = [];
    for (const word of words) {
      for (let b = 0; b < 16; b++) {
        bits.push((word >> b) & 1);
      }
    }
    const numSolutions = (answer.num_solutions as number | undefined)
      ?? Math.floor(bits.length / nqubits);
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
      energies: answer.energies ?? [],
      occurrences: answer.num_occurrences ?? solutions.map(() => 1)
    };
  }

  throw new Error(`DWave 未知响应格式: ${JSON.stringify(Object.keys(answer))}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
