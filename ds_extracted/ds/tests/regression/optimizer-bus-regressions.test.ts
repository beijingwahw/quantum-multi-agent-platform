/**
 * 优化器 + 机制大脑 + 通信总线 + 平台入口域的审计回归网（A3，2026-09-06 重派）。
 *
 * 逐条先回读源码验证修复状态后的收口锚定：
 *
 * ① A3#1 子空间 shots-best 回退（P1，已修于 HEAD）：collapseSubspace 在
 *    chosen < 0 时不再回退第 0 号基态，改走与全空间引擎一致的 argmax
 *    扫描。子空间坍缩无资格过滤、shots ≥ 1 时该分支对有限输入是防御性
 *    死支（sampleBestIndexByShots 首发采样必置 chosen），可观测契约是
 *    「回退语义 == argmax 语义」——这里锚定两模式在集中分布下同解，
 *    并锚定全空间同族回退（shots-best 全采样非法 → argmax-valid 兜底）。
 * ② A3#2 归一化期望还原（P1，已修于 HEAD 08#24）：denormalizeExpectation
 *    单一实现在 solver-common.ts，四个调用点（全空间 QAOA/退火 × 子空间
 *    QAOA/退火）统一。黄金值/往返性质见 golden-contracts.test.ts；此处补
 *    端到端锚：四条求解路径的 expectation 都落在原始能量谱 [min, max] 内
 *    （还原公式错一处就会越界）。
 * ③ A3#3 computeEnergies 记忆表（P1·性能，已修于 HEAD 08#14）：按 problem
 *    身份 WeakMap memo + 轻量指纹强制（weights/ineligible/couplings/罚项）。
 * ④ A3#4 对角耦合疑点验证（P1，验证结论=不一致）：raw 对角键
 *    （q1 === q2）在四条能量路径语义分裂——bruteForceOptimum 的 extra
 *    循环只查 t2 < t 永不命中、computeEnergies 的 q1 < q2 过滤直接排除、
 *    welfareOf 计入一次、toIsing 并入线性项。故构造点（couplingKey）
 *    拒绝对角键（抛域错误）是正确收口；本测试把分裂钉成证据锚——
 *    若四路径未来被统一，须同步重审该禁令。
 * ⑤ A3#5 订阅频道运行时校验（P1，已修于 HEAD F01）：非字符串/空串/超长
 *    （>128）一律忽略并计入 invalidChannelRejections。
 * ⑥ A3#6 离线队列桶基数上界（P1，已修于 HEAD F02）：MAX_QUEUED_AGENTS
 *    （4096）封顶 per-agent 建桶数，超限新桶拒建并计入 droppedMessages，
 *    既有桶继续正常服务。
 * ⑦ A3#7 跨组件监听器解除（P1，HEAD 以 dispose() 收口）：setupEventHandlers
 *    注册的 8 个跨组件监听器经 dispose() 统一解除；stop() 刻意保留
 *    （stop→start 重启语义），锚定两者的边界。
 * ⑧ A3#8 start() 逆序回滚栈（P2，已修于 HEAD）：中途失败按 LIFO 回滚
 *    已初始化组件——总线拆除、系统 agents 不残留、失败后可重新启动。
 * ⑨ A3#10 Date 字段 DTO 语义（P2，本次修复）：类型层 Date 经 JSON 退化
 *    string；新增 reviveDate/reviveDateRequired 入站复活帮助函数 +
 *    字段级文档（quantum-types.ts 文件头）。
 *
 * （A3#9 compound-brain settle 校验次序/emit 隔离已修于 HEAD 08#1/08#2，
 *  回归锚已在 tests/audit-p2p3-hardening.test.ts，不在此重复。）
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import {
  annealSolve,
  bruteForceOptimum,
  computeEnergies,
  couplingKey,
  isValidAssignment,
  qaoaSolve,
  toIsing,
  welfareOf,
} from '../../src/core/quantum-optimizer.js';
import type { AssignmentProblem, IsingModel } from '../../src/core/quantum-optimizer.js';
import {
  annealSolveSubspace,
  buildSubspaceModel,
  qaoaSolveSubspace,
} from '../../src/core/subspace-optimizer.js';
import { QuantumBus } from '../../src/communication/quantum-bus.js';
import QuantumMultiAgentPlatform from '../../src/index.js';
import { reviveDate, reviveDateRequired } from '../../src/types/quantum-types.js';
import type { QuantumMessage } from '../../src/types/quantum-types.js';

// ----------------------------------------------------------------------------
// 工厂
// ----------------------------------------------------------------------------

function makeProblem(m: number, n: number): AssignmentProblem {
  return {
    taskIds: Array.from({ length: m }, (_, t) => `t${t}`),
    agentIds: Array.from({ length: n }, (_, a) => `a${a}`),
    weights: Array.from({ length: m }, (_, t) =>
      Array.from({ length: n }, (_, a) => ((t + a) % 3) * 4 + 2),
    ),
    ineligible: Array.from({ length: m }, () => new Array<boolean>(n).fill(false)),
    couplings: new Map(),
    penaltyOneHot: 100,
    penaltyCapacity: 100,
  };
}

function openSocket(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function waitForEvent<T>(
  bus: QuantumBus,
  name: string,
  predicate: (e: T) => boolean,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const listener = (e: T) => {
      if (!predicate(e)) return;
      clearTimeout(timer);
      bus.off(name, listener);
      resolve(e);
    };
    const timer = setTimeout(() => {
      bus.off(name, listener);
      reject(new Error(`timeout waiting for '${name}'`));
    }, timeoutMs);
    bus.on(name, listener);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ising 能量求值（z 基）：E = offset + Σh_i z_i + ΣJ_ij z_i z_j */
function isingEnergyOf(model: IsingModel, bits: number[]): number {
  const zOf = (q: number): number => 1 - 2 * (bits[q] ?? 0);
  let e = model.offset;
  for (let q = 0; q < model.nqubits; q++) e += model.h[q]! * zOf(q);
  for (const [key, J] of model.J) {
    const q1 = Math.floor(key / model.nqubits);
    const q2 = key % model.nqubits;
    e += J * zOf(q1) * zOf(q2);
  }
  return e;
}

// ----------------------------------------------------------------------------
// A3#1 子空间 shots-best 回退语义
// ----------------------------------------------------------------------------

describe('A3#1 子空间 shots-best 回退语义（argmax 对齐）', () => {
  it('集中分布下 shots-best 与 argmax 模式同解（回退语义 == argmax 语义）', () => {
    const problem = makeProblem(3, 4);
    // 唯一最优 [2,1,0]（福利 30，次优 ≤ 21）：避免简并最优下两模式
    // 合法地选中不同最优分支而误报
    problem.weights = [
      [2, 3, 10, 4],
      [3, 10, 4, 2],
      [10, 4, 2, 6],
    ];
    problem.couplings.set(couplingKey(0, 4, 12), 2); // (t0,a0)-(t1,a1) 纠缠加成
    const model = buildSubspaceModel(problem);
    assert.ok(model, '3 任务 × 4 agent 必然可建子空间模型');

    const byShots = annealSolveSubspace(model, { select: 'shots-best', shots: 128, seed: 3 });
    const byArgmax = annealSolveSubspace(model, { select: 'argmax-valid', seed: 3 });

    assert.equal(byShots.optimalityRatio, 1, 'shots-best 应命中最优');
    assert.equal(byArgmax.optimalityRatio, 1, 'argmax 应命中最优');
    assert.deepEqual(byShots.assignment, byArgmax.assignment, '两坍缩模式同解');
    assert.equal(byShots.welfare, model.optimalWelfare);
  });

  it('全空间 shots-best 单发采样全落非法态时走 argmax-valid 兜底（种子无关、不经修复路径）', () => {
    // 零罚 + 全任务偏好同一 agent：合法质量 ~1e-21，单发采样几乎必然落非法态
    // → chosen < 0 → argmax-valid 兜底（与子空间回退同语义的族系锚）
    const problem = makeProblem(3, 3);
    problem.weights = [
      [10, 1, 1],
      [10, 1, 1],
      [10, 1, 1],
    ];
    problem.penaltyOneHot = 0;
    problem.penaltyCapacity = 0;

    const results = [3, 7, 11, 29, 97].map((seed) =>
      annealSolve(problem, { select: 'shots-best', shots: 1, seed }),
    );
    for (const r of results) {
      assert.ok(r.validMass < 1e-6, `病态电路合法质量应近零（${r.validMass}）`);
      assert.ok(
        r.assignment.every((a) => a >= 0),
        '兜底路径产出合法分配',
      );
      assert.ok(isValidAssignment(problem, r.assignment), '兜底分配须通过合法性校验');
      assert.equal(r.repaired, false, '兜底是合法基态直读，不得标记 repaired');
      assert.ok(r.probability > 0);
    }
    for (const r of results.slice(1)) {
      assert.deepEqual(
        r.assignment,
        results[0]!.assignment,
        '兜底确定性：与种子无关（采样结果被丢弃）',
      );
    }
  });
});

// ----------------------------------------------------------------------------
// A3#2 归一化期望还原（denormalizeExpectation 四处统一）
// ----------------------------------------------------------------------------

describe('A3#2 期望还原四处统一', () => {
  it('全空间 QAOA/退火 + 子空间 QAOA/退火的 expectation 均落在原始能量谱 [min, max] 内', () => {
    const problem = makeProblem(3, 3);
    problem.couplings.set(couplingKey(0, 4, 9), 2);

    // 全空间：能量谱含罚项（非法态）
    const info = computeEnergies(problem);
    const fullQaoa = qaoaSolve(problem, { layers: 2, restarts: 2, seed: 5 });
    const fullAnneal = annealSolve(problem, { seed: 5 });
    assert.ok(
      fullQaoa.expectation >= info.min - 1e-9 && fullQaoa.expectation <= info.max + 1e-9,
      `全空间 QAOA 期望越界：${fullQaoa.expectation} ∉ [${info.min}, ${info.max}]`,
    );
    assert.ok(
      fullAnneal.expectation >= info.min - 1e-9 && fullAnneal.expectation <= info.max + 1e-9,
      `全空间退火期望越界：${fullAnneal.expectation} ∉ [${info.min}, ${info.max}]`,
    );

    // 子空间：能量谱 = 合法分配的 -福利
    const model = buildSubspaceModel(problem);
    assert.ok(model);
    let rawMin = Infinity;
    let rawMax = -Infinity;
    for (const e of model.energies) {
      if (e < rawMin) rawMin = e;
      if (e > rawMax) rawMax = e;
    }
    const subQaoa = qaoaSolveSubspace(model, { layers: 2, restarts: 2, seed: 5 });
    const subAnneal = annealSolveSubspace(model, { seed: 5 });
    assert.ok(
      subQaoa.expectation >= rawMin - 1e-9 && subQaoa.expectation <= rawMax + 1e-9,
      `子空间 QAOA 期望越界：${subQaoa.expectation} ∉ [${rawMin}, ${rawMax}]`,
    );
    assert.ok(
      subAnneal.expectation >= rawMin - 1e-9 && subAnneal.expectation <= rawMax + 1e-9,
      `子空间退火期望越界：${subAnneal.expectation} ∉ [${rawMin}, ${rawMax}]`,
    );
  });
});

// ----------------------------------------------------------------------------
// A3#3 computeEnergies 记忆表
// ----------------------------------------------------------------------------

describe('A3#3 computeEnergies 记忆表（08#14）', () => {
  it('同一 problem 重复调用返回同一缓存快照（引用相等，无重算）', () => {
    const p = makeProblem(3, 3);
    const first = computeEnergies(p);
    const second = computeEnergies(p);
    assert.ok(first === second, '冻结契约命中时应返回同一对象');
  });

  it('轻量指纹强制：weights/couplings/ineligible/罚项任一变更都使缓存失效并重算', () => {
    const p = makeProblem(3, 3); // nqubits = 9
    const i0 = computeEnergies(p);
    assert.ok(computeEnergies(p) === i0, '未变更时持续命中');

    // weights 变更：基态 k=1（仅 qubit0 置位）能量含 w[0][0]
    p.weights[0]![0] = 100;
    const i1 = computeEnergies(p);
    assert.ok(i1 !== i0, 'weights 变更必须失效缓存');
    assert.notEqual(i1.energies[1], i0.energies[1], '能量须反映新权重');
    assert.ok(computeEnergies(p) === i1, '新指纹重新命中');

    // couplings 变更（合法非对角键）：基态 k=9（qubit0 与 qubit3 同置位）
    p.couplings.set(couplingKey(0, 3, 9), 2);
    const i2 = computeEnergies(p);
    assert.ok(i2 !== i1, 'couplings 变更必须失效缓存');
    assert.notEqual(i2.energies[9], i1.energies[9], '两比特同置位的能量须计入耦合');

    // ineligible 变更：不进入能量公式，但指纹仍保守失效（重算）
    p.ineligible[0]![0] = true;
    const i3 = computeEnergies(p);
    assert.ok(i3 !== i2, 'ineligible 变更必须失效缓存（保守指纹）');
    assert.deepEqual([...i3.energies], [...i2.energies], '但 ineligible 不改变任何基态能量');

    // 罚项变更：基态 k=0（全零，one-hot 全违约）能量含罚
    p.penaltyOneHot = 200;
    const i4 = computeEnergies(p);
    assert.ok(i4 !== i3, '罚项变更必须失效缓存');
    assert.notEqual(i4.energies[0], i3.energies[0], '违约基态能量须反映新罚项');
  });
});

// ----------------------------------------------------------------------------
// A3#4 对角耦合：四路径语义分裂（疑点验证的证据锚）
// ----------------------------------------------------------------------------

describe('A3#4 对角耦合疑点验证（结论：不一致 → 构造点禁止）', () => {
  it('raw 对角键被 bruteForce/computeEnergies 忽略、被 welfareOf/toIsing 计入——语义分裂即禁令依据', () => {
    const nq = 6; // 2 任务 × 3 agent
    const J = 7;
    const diagQubit = 1; // (t0, a1)，键 = 1*6+1 = 7（q1 === q2 的对角键）
    const baseline = makeProblem(2, 3);
    baseline.weights = [
      [5, 4, 1],
      [3, 6, 2],
    ];
    const withDiag = makeProblem(2, 3);
    withDiag.weights = [
      [5, 4, 1],
      [3, 6, 2],
    ];
    withDiag.couplings.set(diagQubit * nq + diagQubit, J); // 绕过 couplingKey 的 raw 注入

    // 路径 1：bruteForceOptimum 忽略对角键（extra 循环只查 t2 < t）
    assert.equal(
      bruteForceOptimum(withDiag).welfare,
      bruteForceOptimum(baseline).welfare,
      'bruteForce 不得计入对角键',
    );

    // 路径 2：computeEnergies 忽略对角键（q1 < q2 过滤）
    const e0 = computeEnergies(baseline).energies;
    const e1 = computeEnergies(withDiag).energies;
    assert.deepEqual([...e1], [...e0], '态矢量能量不得计入对角键');

    // 路径 3：welfareOf 计入对角键一次（占据该格子的分配福利 +J）
    const occupies = [1, 0]; // t0→a1（qubit1 置位）
    const avoids = [0, 1];
    assert.equal(welfareOf(withDiag, occupies), welfareOf(baseline, occupies) + J);
    assert.equal(welfareOf(withDiag, avoids), welfareOf(baseline, avoids), '未占据格子不计');

    // 路径 4：toIsing 并入线性项（占据位形的能量 -J）
    const bitsOfOccupies = [0, 1, 0, 1, 0, 0];
    assert.equal(
      isingEnergyOf(toIsing(withDiag), bitsOfOccupies),
      isingEnergyOf(toIsing(baseline), bitsOfOccupies) - J,
      'toIsing 把对角耦合折叠进线性场',
    );

    // 四路径两两分歧 → 「精确最优对照」可信度被腐蚀 → 构造点禁令成立
    assert.throws(() => couplingKey(diagQubit, diagQubit, nq), /Diagonal coupling/);
  });
});

// ----------------------------------------------------------------------------
// A3#5 订阅频道运行时校验
// ----------------------------------------------------------------------------

describe('A3#5 订阅频道运行时校验（F01）', () => {
  it('非字符串/空串/超长频道被忽略并计数，合法订阅照常生效', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      ws.send(JSON.stringify({ type: 'subscribe', channel: 42 })); // 数字
      ws.send(JSON.stringify({ type: 'subscribe', channel: '' })); // 空串
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'x'.repeat(200) })); // 超长
      await sleep(150);
      assert.equal(bus.getMetrics().security.invalidChannelRejections, 3, '三次非法频道各计一次');

      const subscribed = waitForEvent<{ channel: string }>(bus, 'agent_subscribed', () => true);
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'status_update' }));
      const ev = await subscribed;
      assert.equal(ev.channel, 'status_update', '合法频道订阅不受影响');
      ws.close();
    } finally {
      bus.shutdown();
    }
  });
});

// ----------------------------------------------------------------------------
// A3#6 离线队列桶基数上界
// ----------------------------------------------------------------------------

describe('A3#6 离线队列桶基数上界（F02）', () => {
  it('桶数达 MAX_QUEUED_AGENTS(4096) 后新桶拒建计入 droppedMessages，既有桶继续服务', () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    // 无连接：全部消息按 targetAgentId 落离线队列，逐 id 建桶
    for (let i = 0; i < 4096; i++) {
      bus.createMessage('src', 'heartbeat', {}, `agent-${i}`);
    }
    let m = bus.getMetrics();
    assert.equal(m.security.queuedAgentBuckets, 4096, '桶数恰为上界');
    assert.equal(m.messageQueueSize, 4096);
    assert.equal(m.droppedMessages, 0, '上界内的建桶不是丢弃');

    bus.createMessage('src', 'heartbeat', {}, 'agent-new'); // 第 4097 个新桶被拒
    m = bus.getMetrics();
    assert.equal(m.security.queuedAgentBuckets, 4096, '新桶不得再建（基数攻击面封顶）');
    assert.equal(m.droppedMessages, 1, '被拒消息计入 droppedMessages');

    bus.createMessage('src', 'heartbeat', {}, 'agent-0'); // 既有桶继续接受
    m = bus.getMetrics();
    assert.equal(m.security.queuedAgentBuckets, 4096);
    assert.equal(m.messageQueueSize, 4097, '既有桶继续服务');
    assert.equal(m.droppedMessages, 1);
    bus.shutdown();
  });
});

// ----------------------------------------------------------------------------
// A3#7 / A3#8 平台生命周期
// ----------------------------------------------------------------------------

describe('A3#7 跨组件监听器解除（stop/dispose 边界）', () => {
  it('stop() 保留跨组件监听（重启语义）；dispose() 解除 setupEventHandlers 的全部监听', async () => {
    const platform = new QuantumMultiAgentPlatform({
      communication: { port: 0 },
      performance: { metricsInterval: 60000 },
    });
    const crossComponentCounts = () => ({
      agentManager:
        platform.agentManager.listenerCount('agent_registered') +
        platform.agentManager.listenerCount('agent_unregistered'),
      scheduler:
        platform.scheduler.listenerCount('task_assigned') +
        platform.scheduler.listenerCount('task_completed') +
        platform.scheduler.listenerCount('task_failed'),
      bus:
        platform.quantumBus.listenerCount('console_query') +
        platform.quantumBus.listenerCount('console_command'),
    });

    platform.on('started', () => undefined); // 外部监听，dispose 须一并解除
    await platform.start();
    const before = crossComponentCounts();
    assert.ok(
      before.agentManager >= 2 && before.scheduler >= 3 && before.bus >= 2,
      'setupEventHandlers 的跨组件监听应在位',
    );

    platform.stop();
    const afterStop = crossComponentCounts();
    assert.equal(afterStop.agentManager, before.agentManager, 'stop 保留监听（可重启）');
    assert.equal(afterStop.scheduler, before.scheduler, 'stop 保留监听（可重启）');
    assert.equal(afterStop.bus, before.bus, 'stop 保留监听（可重启）');

    platform.dispose();
    const zero = crossComponentCounts();
    assert.equal(
      zero.agentManager + zero.scheduler + zero.bus,
      0,
      'dispose 后跨组件监听全部解除（引用链断开，旧实例可被 GC）',
    );
    assert.equal(platform.listenerCount('started'), 0, '平台自身监听同样解除');
  });
});

describe('A3#8 start() 逆序回滚栈', () => {
  it('中途组件失败：总线拆除、系统 agents 不残留、未发 started、回滚后可重新启动', async () => {
    const platform = new QuantumMultiAgentPlatform({
      communication: { port: 0 },
      performance: { metricsInterval: 60000 },
    });
    let startedEmitted = 0;
    platform.on('started', () => startedEmitted++);

    // 注入第 2 步失败（bus 已启动、系统 agents 尚未注册）
    const originalInit = platform.dshIntegration.initialize.bind(platform.dshIntegration);
    platform.dshIntegration.initialize = async () => {
      throw new Error('dsh-init-boom');
    };

    await assert.rejects(platform.start(), /dsh-init-boom/);
    assert.equal(platform.quantumBus.isStarted(), false, '失败后总线必须拆除（端口释放）');
    assert.equal(platform.agentManager.getAgents().length, 0, '系统 agents 不得残留');
    assert.equal(startedEmitted, 0, "'started' 事件不得发出");

    // 回滚零残留：解除注入后同一实例应能正常启动
    platform.dshIntegration.initialize = originalInit;
    await platform.start();
    assert.equal(platform.agentManager.getAgents().length, 4, '重启后系统 agents 就位');
    assert.equal(platform.quantumBus.isStarted(), true);
    assert.equal(startedEmitted, 1);
    platform.dispose();
  });
});

// ----------------------------------------------------------------------------
// A3#10 Date 字段的 DTO 复活
// ----------------------------------------------------------------------------

describe('A3#10 Date 字段 DTO 复活', () => {
  it('reviveDate：Date 直通、ISO/epoch 复活、垃圾与缺失归约 undefined', () => {
    const d = new Date('2026-09-06T12:00:00.000Z');
    assert.ok(reviveDate(d) === d, 'Date 实例幂等直通');

    const iso = reviveDate('2026-09-06T12:00:00.000Z');
    assert.ok(iso instanceof Date);
    assert.equal(iso?.getTime(), d.getTime());

    const epoch = reviveDate(1757169600000);
    assert.ok(epoch instanceof Date);
    assert.equal(epoch?.getTime(), 1757169600000);

    assert.equal(reviveDate('not-a-date'), undefined, '不可解析字符串不得产生 Invalid Date');
    assert.equal(reviveDate(null), undefined);
    assert.equal(reviveDate(undefined), undefined);
  });

  it('reviveDateRequired：坏载荷指名抛 TypeError，合法值返回 Date', () => {
    const ok = reviveDateRequired('2026-09-06T00:00:00.000Z', 'timestamp');
    assert.ok(ok instanceof Date);
    assert.throws(
      () => reviveDateRequired('garbage', 'timestamp'),
      (err: unknown) => err instanceof TypeError && /timestamp/.test(err.message),
    );
  });

  it('QuantumMessage JSON 往返：timestamp 退化为 string（DTO 语义），revive 后恢复 Date 且时刻不变', () => {
    const msg: QuantumMessage = {
      id: 'm-1',
      type: 'heartbeat',
      sourceAgentId: 'a-1',
      content: { hello: 1 },
      timestamp: new Date('2026-09-06T12:00:00.000Z'),
      priority: 'medium',
      quantumState: {
        id: 'q-1',
        amplitude: 1,
        phase: 0,
        collapsed: true,
        position: { x: 0, y: 0, z: 0 },
      },
    };
    const wire = JSON.parse(JSON.stringify(msg)) as { timestamp: unknown };
    assert.equal(typeof wire.timestamp, 'string', 'JSON 边界处 Date 退化为 string');
    const revived = reviveDateRequired(wire.timestamp as string, 'timestamp');
    assert.ok(revived instanceof Date);
    assert.equal(revived.getTime(), msg.timestamp.getTime(), '复活后时刻逐毫秒一致');
  });
});
