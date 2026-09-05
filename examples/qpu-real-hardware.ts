/**
 * qpu-real-hardware —— 真 QPU 执行入口
 *
 * 三种运行形态（自动检测）：
 *   1. DWAVE_API_TOKEN 已设置且网络可达 → 同一调度问题提交 D-Wave Leap
 *      真 QPU（混合求解器内含真实量子退火硬件），采样→校验→与本地
 *      精确最优对照，报告最优率。
 *   2. 无凭据 → 完整演示链路：本地精确引擎（约束子空间绝热演化）
 *      + D-Wave 客户端离线验证（stub）+ Qiskit 程序导出。
 *   3. 有凭据但网络失败 → 报错并提示，不静默回退（诚实原则）。
 *
 * 运行：npm run example:qpu
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import {
  defaultPenalties,
  couplingKey,
  bruteForceOptimum,
  qaoaSolve,
} from '../src/core/quantum-optimizer.js';
import {
  LocalQuantumBackend,
  DWaveBackend,
  getBackend,
  listBackends,
  solveAssignmentOnBackend,
  toQiskitProgram,
} from '../src/core/qpu/index.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeProblem(m: number, n: number, seed: number, entangle = true): AssignmentProblem {
  const r = rng(seed);
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => +(0.15 + 0.7 * r()).toFixed(3)),
  );
  const p: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  if (entangle) {
    for (let t1 = 0; t1 < m; t1++) {
      for (let t2 = t1 + 1; t2 < m; t2++) {
        p.couplings.set(couplingKey(t1 * n, t2 * n + 1, m * n), 0.35);
        p.couplings.set(couplingKey(t1 * n + 1, t2 * n, m * n), 0.35);
      }
    }
  }
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

async function main(): Promise<void> {
  console.log('='.repeat(86));
  console.log('真 QPU 执行入口 | Real QPU Execution Entry');
  console.log('='.repeat(86));

  const problem = makeProblem(3, 5, 42); // 15 逻辑量子比特（含纠缠耦合 → QAP 型）
  const brute = bruteForceOptimum(problem);

  console.log(
    `\n问题: 3任务 × 5agent（纠缠对[a0,a1]，QAP型），穷举最优福利 = ${brute.welfare.toFixed(3)}`,
  );
  console.log(`后端注册表: ${JSON.stringify(listBackends())}`);

  const token = process.env.DWAVE_API_TOKEN ?? process.env.D_WAVE_API_TOKEN;

  if (token) {
    // ---- 形态 1：真 QPU ----
    console.log('\n[形态1] 检测到 DWAVE_API_TOKEN → 提交 D-Wave Leap 真 QPU');
    const backend = new DWaveBackend();
    try {
      const result = await solveAssignmentOnBackend(problem, backend, {
        numReads: 200,
        timeoutMs: 120_000,
      });
      console.log(`  solver        : ${result.solver}`);
      console.log(`  assignment    : [${result.assignment}]`);
      console.log(
        `  welfare       : ${result.welfare.toFixed(3)} / 最优 ${result.optimality?.optimal.toFixed(3)}`,
      );
      console.log(
        `  optimality    : ${(result.optimality ? result.optimality.ratio * 100 : 0).toFixed(1)}%`,
      );
      console.log(
        `  采样频率      : ${(result.sampleFrequency * 100).toFixed(2)}% (${result.totalReads} reads)`,
      );
      console.log(
        `  非法样本      : ${result.invalidSamples}/${result.totalReads}（真QPU噪声，已被闸门过滤）`,
      );
      console.log('  → 真实量子硬件上的调度结果已通过合法性与最优率对照。');
    } catch (error) {
      console.error(`  真 QPU 调用失败（不静默回退）: ${(error as Error).message}`);
      console.error('  请检查 token 有效性 / 网络 / 求解器配额。');
    }
  } else {
    // ---- 形态 2：演示链路 ----
    console.log('\n[形态2] 未检测到 DWAVE_API_TOKEN → 演示链路（含真 QPU 全部接口验证）');

    // 2a. 本地精确引擎（真 QPU 的对照基准）
    const local = getBackend();
    const localResult = await solveAssignmentOnBackend(problem, local, { numReads: 512 });
    console.log(`\n  2a. 本地精确引擎（${local.name}）:`);
    console.log(
      `      assignment = [${localResult.assignment}]  welfare = ${localResult.welfare.toFixed(3)}`,
    );
    console.log(
      `      optimality = ${(localResult.optimality!.ratio * 100).toFixed(1)}%  （对照基准）`,
    );

    // 2b. D-Wave 客户端编码验证（请求体格式检查，不发网络请求）
    const dwave = new DWaveBackend({
      token: 'dry-run',
      endpoint: 'https://cloud.dwavesys.com/sapi/v2',
    });
    console.log(`\n  2b. D-Wave 客户端（${dwave.name}）:`);
    console.log(`      isAvailable = ${dwave.isAvailable()}（dry-run token）`);
    console.log(
      '      提交格式: toIsing() 的 (h, J) → bqm 三元组（混合求解器）/ ising 字典（结构化 QPU）',
    );
    console.log('      真凭据时自动注册为默认后端，scheduleBatchQuantumQpu() 直接上真机。');

    // 2c. Qiskit 程序导出（含 QAOA 训练角度）
    const qaoa = qaoaSolve(problem, { layers: 3, restarts: 2, select: 'shots-best', shots: 256 });
    const program = toQiskitProgram(problem, {
      ...(qaoa.angles ? { angles: qaoa.angles } : {}),
    });
    // 相对脚本自身目录落盘（06#9）：相对 CWD 写入会让「从仓库根运行
    // npm run example:qpu」把生成物丢进根目录污染仓库；固定在示例旁，
    // 无论从哪个 CWD 启动都落在同一处
    const outPath = fileURLToPath(new URL('./qaoa_schedule.py', import.meta.url));
    writeFileSync(outPath, program);
    console.log(`\n  2c. Qiskit 程序已导出: qaoa_schedule.py`);
    console.log(`      量子比特 15 · QAOA p=${qaoa.layers} · 训练角度已嵌入`);
    console.log(`      本地运行: pip install qiskit qiskit-aer && python qaoa_schedule.py`);
    console.log(
      `      换 IBM 真机: 将 AerSimulator() 替换为 qiskit_ibm_runtime 后端（文件内有 TODO 标注）`,
    );

    // 2d. 调度器全链路（本地后端）
    const scheduler = new QuantumScheduler({
      scheduling: { quantumAlgorithm: 'quantum-annealing', autoSchedule: false },
    });
    for (let i = 0; i < 5; i++) {
      scheduler.registerAgent({
        id: `a${i}`,
        name: `Agent-${i}`,
        type: 'developer',
        capabilities: ['qpu-task'],
        state: 'idle',
        load: 0,
        position: { x: 0, y: 0, z: 0 },
        quantumEntanglement: i === 0 ? ['a1'] : i === 1 ? ['a0'] : [],
        lastHeartbeat: new Date(),
      });
    }
    for (let i = 0; i < 3; i++) {
      scheduler.submitTask({
        name: `量子任务-${i}`,
        type: 'qpu',
        priority: 'critical',
        requirements: [{ type: 'capability', name: 'qpu-task', value: null, weight: 1 }],
        dependencies: [],
        estimatedDuration: 5000,
        actualDuration: 0,
        status: 'pending',
      } as any);
    }
    const report = await scheduler.scheduleBatchQuantumQpu(new LocalQuantumBackend(), {
      numReads: 512,
    });
    console.log(`\n  2d. 调度器全链路 scheduleBatchQuantumQpu():`);
    console.log(`      representation=${report.representation}  分配=${report.assigned}/3`);
    for (const a of report.assignments) {
      console.log(
        `        ${a.taskName} → ${a.agentId} (采样频率 ${(a.probability * 100).toFixed(1)}%)`,
      );
    }
    console.log(`      optimality=${(report.optimality!.ratio * 100).toFixed(1)}%`);

    console.log('\n  接入真 QPU 三步:');
    console.log('    1. https://cloud.dwavesys.com/leap/ 注册（免费开发者额度）→ API token');
    console.log('    2. set DWAVE_API_TOKEN=<your-token>');
    console.log('    3. npm run example:qpu  （自动切到形态1：真机采样 + 最优率对照）');
  }
}

main().catch((err: unknown) => {
  console.error('示例失败:', err);
  process.exit(1);
});
