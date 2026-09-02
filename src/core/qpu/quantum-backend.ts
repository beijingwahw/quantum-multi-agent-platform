/**
 * quantum-backend —— 真 QPU 后端抽象层（v1.4）
 *
 * ============ 定位 ============
 *
 * 把量子调度核心接到**真实量子硬件**。三条执行路径统一在一个接口下：
 *
 *   1. D-Wave Leap（量子退火机）： AssignmentProblem → toIsing() 的
 *      (h, J) 正是 D-Wave 的原生输入格式——同一调度问题在真 QPU 上
 *      求解，代码零改动（本目录 dwave-backend.ts，REST 客户端）。
 *   2. IBM Qiskit（门型机）：导出含本仓库 QAOA 训练角度的可运行
 *      Qiskit 程序（qiskit-export.ts）。
 *   3. 本地精确引擎（LocalQuantumBackend）：约束子空间绝热演化——
 *      无凭据时的回退，也是真 QPU 结果的**对照基准**（optimality 比对）。
 *
 * ============ 诚实的边界 ============
 * - 真 QPU 调用需要用户自己的云端凭据（DWAVE_API_TOKEN 等 env 或显式
 *   传入）。无凭据时自动回退本地精确引擎，功能不中断。
 * - D-Wave 结构化 QPU 求解器要求问题嵌入其硬件拓扑（Chimera/Pegasus）；
 *   本客户端优先使用 Leap 混合求解器（内部以真 QPU 求解难核），
 *   纯 QPU 求解器建议经 Ocean EmbeddingComposite 提交（文档说明）。
 * - 所有 QPU 采样结果都做合法性校验（one-hot/容量/资格）并与本地
 *   精确最优对照——真实硬件的噪声意味着结果必须被验证后才进调度器。
 */

import type { AssignmentProblem } from '../quantum-optimizer';
import { buildSubspaceModel, annealSolveSubspace } from '../subspace-optimizer';
import type { SubspaceSolution } from '../subspace-optimizer';

/** QPU 采样结果：自旋 z_i ∈ {−1,+1}（z = 1 − 2x） */
export interface QpuSampleSet {
  /** 每次采样一个自旋向量 */
  spins: number[][];
  /** 对应 Ising 能量 */
  energies: number[];
  /** 每个样本的出现次数 */
  occurrences: number[];
  /** 实际使用的求解器名（报告用） */
  solver: string;
  /** 是否来自真实量子硬件 */
  realHardware: boolean;
}

export interface QpuSolveOptions {
  /** 采样次数（默认 100） */
  numReads?: number;
  /** 轮询超时毫秒（异步求解器，默认 60_000） */
  timeoutMs?: number;
}

export interface QuantumBackend {
  /** 后端名（registry 键） */
  readonly name: string;
  /** 是否真实量子硬件 */
  readonly realHardware: boolean;
  /** 凭据/网络是否就绪（不发起网络请求） */
  isAvailable(): boolean;
  /** 求解 Ising 问题：h（稠密数组，索引=逻辑量子比特）、J（键 q1*nq+q2） */
  solveIsing(h: number[], j: Map<number, number>, nqubits: number, options?: QpuSolveOptions): Promise<QpuSampleSet>;
}

// ----------------------------------------------------------------------------
// 本地精确引擎后端（默认/回退/对照基准）
// ----------------------------------------------------------------------------

export class LocalQuantumBackend implements QuantumBackend {
  readonly name = 'local-subspace';
  readonly realHardware = false;

  constructor(private readonly annealParams: { tau?: number; steps?: number } = {}) {}

  isAvailable(): boolean {
    return true; // 纯本地计算，恒可用
  }

  /**
   * 本地后端不从 h/J 反解问题（罚项已折叠进线性项，不可逆）。
   * 调度场景统一走 solveAssignment(problem, backend)——本地路径直接
   * 在约束子空间精确演化，与真 QPU 路径同接口。
   */
  async solveIsing(_h: number[], _j: Map<number, number>, nqubits: number): Promise<QpuSampleSet> {
    throw new Error(
      'LocalQuantumBackend 不支持 h/J 直解（不可逆）。请使用 solveAssignment(problem, backend)。' +
      `(received nqubits=${nqubits})`
    );
  }

  /** 对调度问题做精确子空间退火（采样语义与真 QPU 报告一致） */
  async solveProblem(problem: AssignmentProblem, options?: QpuSolveOptions): Promise<SubspaceSolution> {
    const model = buildSubspaceModel(problem);
    if (!model) {
      throw new Error('LocalQuantumBackend: 子空间超维，请减小批量或提高 dimensionCap');
    }
    return annealSolveSubspace(model, {
      anneal: this.annealParams,
      select: 'shots-best',
      shots: options?.numReads
    });
  }
}

// ----------------------------------------------------------------------------
// 后端注册表
// ----------------------------------------------------------------------------

const registry = new Map<string, QuantumBackend>();

export function registerBackend(backend: QuantumBackend): void {
  registry.set(backend.name, backend);
}

export function getBackend(name?: string): QuantumBackend {
  if (name) {
    const backend = registry.get(name);
    if (!backend) {
      throw new Error(`Unknown quantum backend '${name}'. Registered: [${[...registry.keys()].join(', ')}]`);
    }
    return backend;
  }
  // 默认：优先真实硬件（已注册且凭据就绪），否则本地精确引擎
  for (const backend of registry.values()) {
    if (backend.realHardware && backend.isAvailable()) return backend;
  }
  const local = registry.get('local-subspace');
  if (local) return local;
  throw new Error('No quantum backend registered');
}

export function listBackends(): Array<{ name: string; realHardware: boolean; available: boolean }> {
  return [...registry.values()].map(b => ({ name: b.name, realHardware: b.realHardware, available: b.isAvailable() }));
}

// 注册默认本地后端（D-Wave 后端在 dwave-backend.ts 中按需注册）
registerBackend(new LocalQuantumBackend());
