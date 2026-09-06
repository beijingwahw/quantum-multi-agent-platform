/**
 * qiskit-export —— IBM 门型 QPU 的 QAOA 程序导出
 *
 * ⚠ 跨语言双实现契约（Q5）：生成的 Python decode() 与本仓
 * quantum-optimizer.ts 的 decodeAssignment + isValidAssignment 是同一
 * 语义的两份手写实现——位串（小端）→ 分配或 None。两处已知且显式声明
 * 的分歧：TS 侧 isValidAssignment 还检查 ineligible 资格掩码，Python
 * decode 只查 one-hot + agent 不复用（资格判定留在 TS 侧，导出程序
 * 的 valid-subspace mass 是该近似口径）。生成物内嵌 SELF_CHECK 自检
 * 向量（由 TS 侧真值计算），tests/qpu-backend.test.ts 在 CI 中锚定
 * 向量与 TS 实现逐条一致——两边任何一边漂移即红。
 *
 * 生成可直接运行的 Qiskit Python 程序：调度问题的全空间 QAOA 电路
 * （含本仓库角度优化得到的 (γ, β)），提交本地 Aer 模拟或 IBM 真机
 * （替换为 qiskit_ibm_runtime 后端即可）。
 *
 * 电路构成（与 src/core/quantum-optimizer.ts 的 QAOA 完全一致）：
 *   |0⟩^nq → H^⊗nq → [ 距相位层 exp(-iγC) : RZ(2γh_i) 与
 *   RZZ(2γJ_ij)（cx-rz-cx） | 混合层 exp(-iβΣX) : RX(2β) ]×p → 测量
 *
 * Ising 能量 E = Σh_i z_i + ΣJ_ij z_i z_j + offset（z=+1 ↔ x=0）；
 * Qiskit RZ(θ)=exp(-iθZ/2)，故代价项 RZ(2γh_i)、RZZ(2γJ_ij)。
 */

import type { AssignmentProblem } from '../quantum-optimizer.js';
import { toIsing, computeEnergies, decodeAssignment } from '../quantum-optimizer.js';
import { QuantumEngineError } from '../../utils/errors.js';

export interface QiskitExportOptions {
  /** QAOA 角度 [γ1..γp, β1..βp]（来自 qaoaSolve().angles） */
  angles?: number[];
  /** 任务数与 agent 数（缺省从 problem 推断） */
  numTasks?: number;
  numAgents?: number;
  /** 运行后端：aer（本地模拟）或 ibm（留 TODO 注释） */
  runtime?: 'aer' | 'ibm';
}

export function toQiskitProgram(
  problem: AssignmentProblem,
  options: QiskitExportOptions = {},
): string {
  const m = options.numTasks ?? problem.taskIds.length;
  const n = options.numAgents ?? problem.agentIds.length;
  const nqubits = m * n;
  const ising = toIsing(problem);
  const runtime = options.runtime ?? 'aer';

  // 角度：缺省用解析好的单层启发值
  const angles =
    options.angles && options.angles.length >= 2 ? options.angles : [Math.PI / 2, Math.PI / 4];
  if (angles.length % 2 !== 0) {
    // 奇数长度静默截断会丢掉最后一个角度，电路与训练结果不一致
    throw new QuantumEngineError(
      `angles must be an even-length [γ1..γp, β1..βp] array (got ${angles.length})`,
    );
  }
  const layers = angles.length / 2;
  const gammas = angles.slice(0, layers);
  const betas = angles.slice(layers, layers * 2);

  // 角度是在归一化能量 (E−min)/span 上训练的；直接导出原始 Ising 系数
  // 会把有效角度缩放 span 倍。这里把系数除以 span（极小值是全局相位，
  // 不影响测量分布），使导出电路与模拟器严格等价。
  let span: number;
  if (nqubits <= 20) {
    const energies = computeEnergies(problem);
    span = Math.max(energies.max - energies.min, 1e-12);
  } else {
    // 2^nq 不可枚举：以系数 L1 范数上界近似（保持量级可比，非严格等价）
    let l1 = 0;
    for (const h of ising.h) l1 += Math.abs(h);
    for (const v of ising.J.values()) l1 += Math.abs(v);
    span = Math.max(l1, 1e-12);
  }
  const invSpan = 1 / span;

  // 非零耦合项列表（避免生成过长的 Python 源码）
  const couplings: Array<[number, number, number]> = [];
  for (const [key, value] of ising.J) {
    if (value !== 0) {
      couplings.push([Math.floor(key / nqubits), key % nqubits, +(value * invSpan).toFixed(6)]);
    }
  }
  const linear = ising.h
    .map((h, q) => [q, +(h * invSpan).toFixed(6)] as [number, number])
    .filter(([, h]) => h !== 0);

  // 自检向量（Q5）：由 TS 真值（decodeAssignment + one-hot/不复用判定）
  // 计算，嵌入生成物——Python 侧启动即断言，CI 侧由 qpu-backend 测试
  // 回读锚定。覆盖四类形态：合法分配、one-hot 违约、空任务、agent 复用。
  const selfCheck: Array<[number, number[] | null]> = [];
  const bitsOf = (assignment: number[]): number =>
    assignment.reduce((acc, a, t) => acc | (1 << (t * n + a)), 0);
  const pythonDecodeSemantics = (bits: number): number[] | null => {
    const decoded = decodeAssignment(bits, m, n);
    const used = new Set<number>();
    for (const a of decoded) {
      if (a < 0 || used.has(a)) return null;
      used.add(a);
    }
    return decoded;
  };
  const seen = new Set<number>();
  const pushCase = (bits: number) => {
    if (seen.has(bits)) return;
    seen.add(bits);
    selfCheck.push([bits, pythonDecodeSemantics(bits)]);
  };
  if (m >= 2 && n >= 2) {
    pushCase(bitsOf([0, 1])); // 合法：错开分配
    pushCase(bitsOf([0, 0])); // agent 复用
    pushCase(0); // 空任务
    pushCase((1 << 0) | (1 << 1)); // 任务 0 双置位（one-hot 违约）
    if (n >= 3 && m >= 2) pushCase(bitsOf([2, 0])); // 合法：另一组错开
  }

  return `# ============================================================
# Quantum Multi-Agent Scheduler → Qiskit QAOA 程序（自动生成）
# 问题: ${m} 任务 × ${n} agent，${nqubits} 量子比特（one-hot + 罚项编码）
# 角度: 来自本仓库 QAOA 变分训练 (${gammas.map((g) => g.toFixed(4)).join(', ')} | ${betas.map((b) => b.toFixed(4)).join(', ')})
# 运行: python qaoa_schedule.py   （需 pip install qiskit qiskit-aer）
# 后端: ${runtime}（换真机: 将 AerSimulator() 替换为 qiskit_ibm_runtime 的 QPU 后端）
# ============================================================
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import SparsePauliOp
from qiskit_aer import AerSimulator

NQ = ${nqubits}
M, N = ${m}, ${n}
GAMMAS = [${gammas.map((g) => +g.toFixed(6)).join(', ')}]
BETAS  = [${betas.map((b) => +b.toFixed(6)).join(', ')}]
LINEAR     = ${JSON.stringify(linear)}     # [[qubit, h_q], ...]
QUADRATIC  = ${JSON.stringify(couplings)}  # [[q1, q2, J_q1q2], ...]

def build_circuit():
    qc = QuantumCircuit(NQ, NQ)
    qc.h(range(NQ))                       # |+>^nq：均匀叠加
    for gamma, beta in zip(GAMMAS, BETAS):
        # ---- 代价层 exp(-i γ C) ----
        for q, h in LINEAR:
            qc.rz(2 * gamma * h, q)
        for q1, q2, j in QUADRATIC:
            qc.cx(q1, q2)
            qc.rz(2 * gamma * j, q2)
            qc.cx(q1, q2)
        # ---- 混合层 exp(-i β ΣX) ----
        for q in range(NQ):
            qc.rx(2 * beta, q)
    qc.measure(range(NQ), range(NQ))
    return qc

def decode(bits):
    # 跨语言双实现（Q5）：与 quantum-optimizer.ts 的 decodeAssignment +
    # isValidAssignment（one-hot/不复用部分）语义一致——SELF_CHECK 向量
    # 双侧锚定，改任意一边都必须同步另一边并重跑向量。
    """测量位串（小端）→ 分配；非法（违约罚）返回 None"""
    x = [(bits >> q) & 1 for q in range(NQ)]
    assignment, used = [], set()
    for t in range(M):
        chosen, count = -1, 0
        for a in range(N):
            if x[t * N + a]:
                chosen, count = a, count + 1
        if count != 1 or chosen in used:
            return None
        assignment.append(chosen)
        used.add(chosen)
    return assignment

# TS 侧真值生成的自检向量：[bits, expected_assignment_or_None]
SELF_CHECK = ${JSON.stringify(selfCheck)}

def _run_self_check():
    for bits, expected in SELF_CHECK:
        got = decode(bits)
        assert got == expected, (
            f"decode({bits}) = {got}, expected {expected} -- "
            "cross-language contract broken vs quantum-optimizer.ts"
        )

def main():
    _run_self_check()
    qc = build_circuit()
    backend = AerSimulator()  # TODO(真机): qiskit_ibm_runtime QPU 后端
    shots = 2048
    counts = backend.run(transpile(qc, backend), shots=shots).result().get_counts()
    valid = 0
    for bitstr, count in counts.items():
        assignment = decode(int(bitstr.replace(' ', ''), 2))
        if assignment is not None:
            valid += count
            if count >= 5:
                print(f"p={count/shots:.3f}  assignment={assignment}")
    print(f"valid-subspace mass: {valid/shots:.3f}")

if __name__ == "__main__":
    main()
`;
}
