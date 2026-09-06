/**
 * 性能域回归（08#34 调度器事件循环活性）：
 * scheduleBatchQuantum 的同步契约是「子空间退火演化期间主线程阻塞在
 * Atomics.wait 上，事件循环停摆」——steps=150 时可达分钟级，WS/HTTP
 * 服务进程在此期间心跳冻结。异步孪生 scheduleBatchQuantumAsync 走
 * waitAsync 非阻塞驱动，本文件锚定三条契约：
 *
 * ① 等价性：同一问题实例、同一种子下，async 与 sync 版的
 *    QuantumBatchReport 逐字段一致（含 welfare/probability/solutions）——
 *    两孪生共享同一收集段与轮循环骨架，唯一分叉是演化驱动方式，
 *    数值逐位一致由结构保证，此处以实测锚定；
 * ② 活性：async 求解期间 setInterval 心跳持续触发（事件循环未冻结）；
 *    同步版在同场景下心跳为零（冻结对照——这正是异步孪生存在的理由）；
 * ③ 门面：index.ts 出口的调度器与平台实例均提供该异步入口。
 * ④ 串行回退契约（文末 describe）：并行不可用环境（QUANTUM_DISABLE_PARALLEL=1）
 *    下异步入口回退 serialAnnealEvolveAsync——位级一致 + 忙时预算让出保活。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { QuantumScheduler, QuantumMultiAgentPlatform } from '../../src/index.js';
import {
  serialAnnealEvolve,
  serialAnnealEvolveAsync,
  buildSubspaceModel,
} from '../../src/core/subspace-optimizer.js';
import { couplingKey, type AssignmentProblem } from '../../src/core/quantum-optimizer.js';
import { mulberry32 } from '../../src/utils/rng.js';
import type { QuantumBatchReport } from '../../src/core/quantum-scheduler.js';
import type { Agent, TaskPriority } from '../../src/types/quantum-types.js';

function makeAgent(id: string, capabilities: string[], entanglement: string[] = []): Agent {
  return {
    id,
    name: id,
    type: 'developer',
    capabilities,
    state: 'idle',
    load: 0,
    position: { x: 0, y: 0, z: 0 },
    quantumEntanglement: entanglement,
    lastHeartbeat: new Date(),
  };
}

function makeTask(name: string, priority: TaskPriority = 'medium') {
  return {
    name,
    type: 'test',
    priority,
    requirements: [{ type: 'capability' as const, name: 'js', value: null, weight: 1.0 }],
    dependencies: [],
    estimatedDuration: 1000,
    actualDuration: 0,
    status: 'pending' as const,
  };
}

interface TwinScenario {
  agentCount: number;
  taskCount: number;
  algorithm: 'quantum-qaoa' | 'quantum-annealing';
  quantum?: {
    entanglementBonus?: number;
    subspaceCap?: number;
    anneal?: { tau?: number; steps?: number };
  };
}

/** 构建双子调度器：同种子、同注册序、同提交序——位级一致性的输入前提 */
function buildTwinSchedulers(scenario: TwinScenario): [QuantumScheduler, QuantumScheduler] {
  const mk = (): QuantumScheduler => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: false,
        quantumAlgorithm: scenario.algorithm,
        quantum: { seed: 20260906, ...scenario.quantum },
      },
    });
    for (let i = 0; i < scenario.agentCount; i++) {
      const id = `a${i + 1}`;
      // 纠缠环 a1→a2→…→an→a1：保证耦合项进入哈密顿量（等价性覆盖耦合路径）
      const next = `a${((i + 1) % scenario.agentCount) + 1}`;
      scheduler.registerAgent(makeAgent(id, ['js'], i + 1 < scenario.agentCount ? [next] : []));
    }
    for (let t = 0; t < scenario.taskCount; t++) {
      scheduler.submitTask(makeTask(`T${t + 1}`));
    }
    return scheduler;
  };
  return [mk(), mk()];
}

/**
 * 规范化报告：taskId 是随机 UUID（不入数值），按各自调度器的 id→name
 * 映射替换为确定性的任务名；其余字段（全部数值与结构）原样保留，
 * deepStrictEqual 对 ±0 与 NaN 均按位敏感。
 */
function normalize(report: QuantumBatchReport, scheduler: QuantumScheduler) {
  const nameById = new Map(scheduler.getTasks().map((t) => [t.id, t.name]));
  return {
    ...report,
    assignments: report.assignments.map((a) => ({ ...a, taskId: nameById.get(a.taskId) })),
    solutions: report.solutions.map((s) => ({
      ...s,
      taskIds: s.taskIds.map((id) => nameById.get(id)),
    })),
  };
}

describe('性能域回归（08#34 调度器事件循环活性）', () => {
  it('等价性·退火/子空间（串行演化维度）：async 与 sync 报告逐字段一致', async () => {
    // 4任务×5agent：dim=P(5,4)=120 < 并行阈值 → 串行演化，快
    const [sync, asyncTwins] = buildTwinSchedulers({
      agentCount: 5,
      taskCount: 4,
      algorithm: 'quantum-annealing',
      quantum: { entanglementBonus: 0.2 },
    });
    const reportSync = sync.scheduleBatchQuantum();
    const reportAsync = await asyncTwins.scheduleBatchQuantumAsync();
    sync.shutdown();
    asyncTwins.shutdown();

    assert.equal(reportSync.representation, 'subspace');
    assert.ok(reportSync.assigned > 0, '对照场景应完成分配（否则等价性断言空转）');
    assert.deepEqual(normalize(reportAsync, asyncTwins), normalize(reportSync, sync));
  });

  it('等价性·QAOA/子空间：async 与 sync 报告逐字段一致（QAOA 分支两版同走同步求解）', async () => {
    // 3任务×5agent：dim=P(5,3)=60 ≤ SUBSPACE_QAOA_DIMENSION_LIMIT → QAOA 变分训练分支
    const [sync, asyncTwins] = buildTwinSchedulers({
      agentCount: 5,
      taskCount: 3,
      algorithm: 'quantum-qaoa',
      quantum: { entanglementBonus: 0.2 },
    });
    const reportSync = sync.scheduleBatchQuantum();
    const reportAsync = await asyncTwins.scheduleBatchQuantumAsync();
    sync.shutdown();
    asyncTwins.shutdown();

    assert.equal(reportSync.engine, 'qaoa');
    assert.equal(reportSync.representation, 'subspace');
    assert.deepEqual(normalize(reportAsync, asyncTwins), normalize(reportSync, sync));
  });

  it('等价性·子空间超维回退全空间：async 与 sync 报告逐字段一致', async () => {
    // subspaceCap=2：子空间模型构建必然超维 → runSubspaceRounds 返回 null
    // → 回退全空间分块路径（两孪生共享同一同步实现）
    const [sync, asyncTwins] = buildTwinSchedulers({
      agentCount: 4,
      taskCount: 2,
      algorithm: 'quantum-annealing',
      quantum: { subspaceCap: 2, entanglementBonus: 0.2 },
    });
    const reportSync = sync.scheduleBatchQuantum();
    const reportAsync = await asyncTwins.scheduleBatchQuantumAsync();
    sync.shutdown();
    asyncTwins.shutdown();

    assert.equal(reportSync.representation, 'fullspace');
    assert.ok(reportSync.assigned > 0);
    assert.deepEqual(normalize(reportAsync, asyncTwins), normalize(reportSync, sync));
  });

  it('活性·大维度退火：async 求解期间心跳存活，sync 同场景冻结（对照），报告逐位一致', async () => {
    // 7任务×10agent：dim=P(10,7)=604800 ≥ 并行阈值 2^19 → 异步孪生真正
    // 走 waitAsync 多 Worker 驱动。steps=40 与 tests/subspace-parallel 同款
    // 短退火——求解时长数百毫秒以上，对 5ms 心跳间隔给足余量（CI 慢机
    // 只会更慢、心跳更多，不存在「太快导致心跳未触发」的方向性风险）
    const [sync, asyncTwins] = buildTwinSchedulers({
      agentCount: 10,
      taskCount: 7,
      algorithm: 'quantum-annealing',
      quantum: { entanglementBonus: 0.2, anneal: { tau: 20, steps: 40 } },
    });

    // 对照：同步求解是全程无 await 的同步调用——事件循环不可能运转，
    // 心跳必须为零（这就是异步孪生要消灭的「分钟级停摆」的缩影）
    let ticksDuringSync = 0;
    const syncTicker = setInterval(() => {
      ticksDuringSync++;
    }, 5);
    const reportSync = sync.scheduleBatchQuantum();
    clearInterval(syncTicker);
    sync.shutdown();

    let ticksDuringAsync = 0;
    const asyncTicker = setInterval(() => {
      ticksDuringAsync++;
    }, 5);
    const reportAsync = await asyncTwins.scheduleBatchQuantumAsync();
    clearInterval(asyncTicker);
    asyncTwins.shutdown();

    assert.equal(reportSync.representation, 'subspace');
    assert.equal(reportSync.assigned, 7, '7 任务应全部联合分配');
    assert.ok(
      reportSync.subspace && reportSync.subspace.dimension >= 1 << 19,
      '对照场景必须达到并行演化维度阈值，否则活性断言未覆盖并行路径',
    );
    assert.equal(ticksDuringSync, 0, '同步求解期间事件循环停摆（冻结对照）');
    assert.ok(ticksDuringAsync > 0, '异步求解期间事件循环必须存活（waitAsync 契约）');
    assert.deepEqual(normalize(reportAsync, asyncTwins), normalize(reportSync, sync));
  });

  it('门面导出：调度器原型与平台实例均提供 scheduleBatchQuantumAsync', async () => {
    assert.equal(typeof QuantumScheduler.prototype.scheduleBatchQuantumAsync, 'function');

    const platform = new QuantumMultiAgentPlatform({
      logLevel: 'warn',
      scheduling: {
        autoSchedule: false,
        quantumAlgorithm: 'quantum-annealing',
        quantum: { seed: 777 },
      },
    });
    try {
      assert.equal(typeof platform.scheduleBatchQuantumAsync, 'function');
      platform.registerAgent({ name: 'A1', type: 'developer', capabilities: ['js'] });
      platform.registerAgent({ name: 'A2', type: 'developer', capabilities: ['js'] });
      platform.registerAgent({ name: 'A3', type: 'developer', capabilities: ['js'] });
      platform.submitTask({ name: 'F1', type: 'test', priority: 'medium' });
      platform.submitTask({ name: 'F2', type: 'test', priority: 'medium' });

      const report = await platform.scheduleBatchQuantumAsync();
      assert.equal(report.assigned, 2, '平台门面应把调用委托到调度器异步入口');
    } finally {
      platform.dispose();
    }
  });
});

// ----------------------------------------------------------------------------
// ④ 串行回退契约（08#34 补完）：并行不可用（QUANTUM_DISABLE_PARALLEL=1 /
//    SAB 缺失）时 annealSolveSubspaceAsync 回退 serialAnnealEvolveAsync——
//    按忙时预算让出事件循环，异步入口在任何环境配置下都不冻结。
// ----------------------------------------------------------------------------

/** 紧凑问题构造：与 subsspace-parallel.test 同型（含纠缠耦合项） */
function compactProblem(m: number, n: number, seed: number): AssignmentProblem {
  const rng = mulberry32(seed);
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => +(0.15 + 0.7 * rng()).toFixed(3)),
  );
  const problem: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  for (let t1 = 0; t1 + 1 < m; t1 += 2) {
    problem.couplings.set(couplingKey(t1 * n, (t1 + 1) * n + 1, m * n), 0.35);
  }
  return problem;
}

describe('串行回退活性（08#34 补完：无 Worker 环境的异步契约）', () => {
  it('位级一致：serialAnnealEvolveAsync 与 serialAnnealEvolve 逐位相同（让出必然触发的规模）', async () => {
    // 7任务×9agent：dim=P(9,7)=181440——串行演化秒级，4ms 让出预算下
    // 让出充分触发；两驱动的算符序列共享单源（prepare + applyEvolutionStep）
    const model = buildSubspaceModel(compactProblem(7, 9, 11));
    assert.ok(model, '7×9 模型应构建成功');
    const spectral =
      model.n > model.m ? model.m * (model.n - model.m) : (model.m * (model.m - 1)) / 2;
    let min = Infinity;
    let max = -Infinity;
    for (const e of model.energies) {
      if (e < min) min = e;
      if (e > max) max = e;
    }
    const span = max - min;
    const energies = new Float64Array(model.energies.length);
    for (let k = 0; k < energies.length; k++) {
      energies[k] = ((model.energies[k]! - min) / span) * 2 * spectral;
    }

    const syncRun = serialAnnealEvolve(model, energies, 20, 20);
    const asyncRun = await serialAnnealEvolveAsync(model, energies, 20, 20);
    assert.equal(asyncRun.re.length, syncRun.re.length);
    for (let k = 0; k < syncRun.re.length; k++) {
      assert.ok(
        asyncRun.re[k] === syncRun.re[k] && asyncRun.im[k] === syncRun.im[k],
        `第 ${k} 个振幅同步/异步串行应逐位一致（让出只交错事件循环，不改算术）`,
      );
    }
  });

  it('回退活性：QUANTUM_DISABLE_PARALLEL=1 下 scheduleBatchQuantumAsync 心跳存活（子进程端到端）', () => {
    // 在父进程解析子进程要 import 的模块 URL，避免 -e 模块的相对解析歧义
    const schedulerUrl = new URL('../../src/core/quantum-scheduler.js', import.meta.url).href;
    const code = `
      import { QuantumScheduler } from ${JSON.stringify(schedulerUrl)};
      const scheduler = new QuantumScheduler({
        scheduling: {
          autoSchedule: false,
          quantumAlgorithm: 'quantum-annealing',
          quantum: { seed: 20260906, entanglementBonus: 0.2, anneal: { tau: 20, steps: 20 } },
        },
      });
      const agent = (id, ent) => ({
        id, name: id, type: 'developer', capabilities: ['js'], state: 'idle', load: 0,
        position: { x: 0, y: 0, z: 0 }, quantumEntanglement: ent, lastHeartbeat: new Date(),
      });
      for (let i = 0; i < 9; i++) {
        scheduler.registerAgent(agent('a' + (i + 1), i + 1 < 9 ? ['a' + (i + 2)] : []));
      }
      for (let t = 0; t < 7; t++) {
        scheduler.submitTask({
          name: 'T' + (t + 1), type: 'test', priority: 'medium',
          requirements: [{ type: 'capability', name: 'js', value: null, weight: 1.0 }],
          dependencies: [], estimatedDuration: 1000, actualDuration: 0, status: 'pending',
        });
      }
      let ticks = 0;
      const ticker = setInterval(() => { ticks++; }, 5);
      const report = await scheduler.scheduleBatchQuantumAsync();
      clearInterval(ticker);
      scheduler.shutdown();
      console.log(JSON.stringify({
        ticks, assigned: report.assigned,
        dimension: report.subspace ? report.subspace.dimension : 0,
      }));
    `;
    const res = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', code],
      {
        cwd: process.cwd(),
        // QUANTUM_DISABLE_PARALLEL=1：并行路径返回 null → 异步入口回退串行演化
        env: { ...process.env, QUANTUM_DISABLE_PARALLEL: '1' },
        encoding: 'utf8',
        timeout: 120_000,
      },
    );
    assert.equal(res.status, 0, `子进程应正常退出（stderr: ${res.stderr}`);
    const line = res.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('{'))
      .pop();
    assert.ok(line, '子进程应打印结果 JSON');
    const { ticks, assigned, dimension } = JSON.parse(line) as {
      ticks: number;
      assigned: number;
      dimension: number;
    };
    assert.equal(assigned, 7, '串行回退下 7 任务应全部联合分配');
    assert.equal(dimension, 181440, '7×9 场景的子空间维度（串行回退不影响模型构建）');
    assert.ok(ticks > 0, '串行回退的异步入口必须保持事件循环存活（忙时预算让出契约）');
  });
});
