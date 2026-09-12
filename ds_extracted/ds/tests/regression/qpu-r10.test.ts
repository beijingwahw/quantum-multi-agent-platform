/**
 * R10 质量波 QPU 层回归网：
 * - Q3：D-Wave 轮询自适应节流（mock 时钟断言调用数，不依赖墙钟）
 * - Q6：后端模块导入零副作用；registerDefaults 显式注册
 * - Q9：qp 缺 num_solutions 且无可推断信号时拒绝全长解码（幻影样本封印）
 * - Q10：全零福利问题（optimal=0）的最优对照不再被 `> 0` 守卫丢弃
 *
 * 注意：本文件刻意不导入 qpu/index.js（及其传递导入者 quantum-scheduler）
 * ——Q6 的零副作用断言要求进程内注册表仅由显式 registerDefaults 改变。
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../../src/core/quantum-optimizer.js';
import { defaultPenalties } from '../../src/core/quantum-optimizer.js';
import {
  LocalQuantumBackend,
  getBackend,
  listBackends,
  registerLocalDefaults,
} from '../../src/core/qpu/quantum-backend.js';
import { DWaveBackend, registerDWaveDefaults } from '../../src/core/qpu/dwave-backend.js';
import { solveAssignmentOnBackend } from '../../src/core/qpu/solve.js';
import { BackendError } from '../../src/utils/errors.js';

/** 注入式 mock 传输（与 tests/qpu-backend.test.ts 同款，捕获请求体） */
interface CapturedRequest {
  method: string;
  url: string;
  body: unknown;
}

function mockTransport(responder: (req: CapturedRequest) => unknown): {
  fetchImpl: typeof fetch;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const captured: CapturedRequest = {
      method: init?.method ?? 'GET',
      url,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    };
    requests.push(captured);
    const payload = responder(captured);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

function dwaveWith(fetchImpl: typeof fetch): DWaveBackend {
  return new DWaveBackend({
    token: 't',
    endpoint: 'https://cloud.dwavesys.com/sapi/v2',
    fetch: fetchImpl,
  });
}

/** 全零福利问题：任何合法分配的福利都是 0（穷举最优 = 0） */
function zeroWelfareProblem(): AssignmentProblem {
  const p: AssignmentProblem = {
    taskIds: ['t0'],
    agentIds: ['a0', 'a1'],
    weights: [[0, 0]],
    ineligible: [[false, false]],
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

describe('Q6 · 后端模块导入零副作用', () => {
  before(() => {
    delete process.env.DWAVE_API_TOKEN;
    delete process.env.D_WAVE_API_TOKEN;
  });

  it('直接导入 quantum-backend/dwave-backend 不注册任何后端', () => {
    // 顶层 registerBackend(new ...) 曾随 import 执行——与「导入零副作用」
    // 的文档哲学矛盾（注册表污染 + import 顺序敏感）
    assert.deepEqual(listBackends(), []);
    assert.throws(
      () => getBackend(),
      (err: unknown) =>
        err instanceof BackendError && err.message.includes('No quantum backend registered'),
    );
  });

  it('registerLocalDefaults/registerDWaveDefaults 显式注册默认后端', () => {
    registerLocalDefaults();
    registerDWaveDefaults();
    const names = listBackends().map((b) => b.name);
    assert.ok(names.includes('local-subspace'), `应含本地精确引擎，实际 [${names}]`);
    assert.ok(names.includes('dwave'), `应含 D-Wave 懒代理，实际 [${names}]`);
    // 无凭据时默认后端回退本地精确引擎（realHardware 优先但须 isAvailable）
    assert.equal(getBackend().name, 'local-subspace');
  });
});

describe('Q3 · D-Wave 轮询自适应节流', () => {
  before(() => {
    delete process.env.DWAVE_API_TOKEN;
    delete process.env.D_WAVE_API_TOKEN;
  });

  it('间隔自 500ms 几何翻倍至 5000ms 封顶（mock 时钟，断言轮询数）', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let polls = 0;
    const { fetchImpl } = mockTransport((req) => {
      if (req.method === 'POST') return { id: 'p1', status: 'PENDING' };
      polls++;
      return { id: 'p1', status: 'PENDING' }; // 永不完成：观测退避日程本身
    });
    const backend = dwaveWith(fetchImpl);
    // 悬置（不 await）：问题永不完成，测试只推进 mock 时钟观测轮询节奏
    void backend.solveIsing([0, 0], new Map(), 2, { numReads: 1, timeoutMs: 60_000 });
    const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
    await settle(); // 提交完成，进入首个 sleep(500)

    // 首轮：500ms 基础间隔（与旧行为一致）
    assert.equal(polls, 0);
    t.mock.timers.tick(499);
    await settle();
    assert.equal(polls, 0, '500ms 内不应轮询');
    t.mock.timers.tick(1); // t=500
    await settle();
    assert.equal(polls, 1, 't=500 首轮轮询');

    // 第二轮：间隔翻倍为 1000ms
    t.mock.timers.tick(999);
    await settle();
    assert.equal(polls, 1, '第二轮间隔应翻倍为 1000ms');
    t.mock.timers.tick(1); // t=1500
    await settle();
    assert.equal(polls, 2);

    // 第三轮：2000ms
    t.mock.timers.tick(1999);
    await settle();
    assert.equal(polls, 2, '第三轮间隔应翻倍为 2000ms');
    t.mock.timers.tick(1); // t=3500
    await settle();
    assert.equal(polls, 3);

    // 第四轮：4000ms
    t.mock.timers.tick(3999);
    await settle();
    assert.equal(polls, 3, '第四轮间隔应翻倍为 4000ms');
    t.mock.timers.tick(1); // t=7500
    await settle();
    assert.equal(polls, 4);

    // 第五轮：8000ms 被封顶为 5000ms
    t.mock.timers.tick(4999);
    await settle();
    assert.equal(polls, 4, '8000ms 应被封顶为 5000ms');
    t.mock.timers.tick(1); // t=12500
    await settle();
    assert.equal(polls, 5);

    // 封顶后稳态：每 5000ms 一轮
    t.mock.timers.tick(5000); // t=17500
    await settle();
    assert.equal(polls, 6, '封顶后按 5000ms 稳态轮询');
  });

  it('总轮询受 timeoutMs 预算钳制：sleep 前取剩余预算', async (t) => {
    // Date 与 setTimeout 一并 mock：deadline 用 Date.now() 计算，只有
    // 两个时钟同步推进才能确定性断言预算钳制
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    let polls = 0;
    const { fetchImpl } = mockTransport((req) => {
      if (req.method === 'POST') return { id: 'p2', status: 'PENDING' };
      if (req.method === 'GET') {
        polls++;
        return { id: 'p2', status: 'PENDING' };
      }
      return {}; // DELETE（超时后的 best-effort 取消）
    });
    const backend = dwaveWith(fetchImpl);
    // timeoutMs=1250：t=500 首轮后剩余 750 → 第二轮 sleep=min(1000, 750)=750，
    // 第三轮判定的 remaining≤0 → 超时
    const pending = backend.solveIsing([0, 0], new Map(), 2, {
      numReads: 1,
      timeoutMs: 1_250,
    });
    // 断言句柄先挂上：rejection 发生在 mock tick 的微任务里，若等
    // tick 之后再 assert.rejects，中间隔一个 setImmediate 宏任务回合，
    // 进程级 unhandledRejection 会先行红掉本测试
    const expectTimeout = assert.rejects(
      () => pending,
      (err: unknown) => err instanceof BackendError && err.message.includes('timed out'),
    );
    const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
    await settle(); // POST 完成
    t.mock.timers.tick(500); // 首轮
    await settle();
    assert.equal(polls, 1);
    t.mock.timers.tick(750); // 剩余预算用尽（不睡满翻倍后的 1000ms）
    await settle();
    assert.equal(polls, 2, '第二轮应以剩余预算 750ms 为准');
    await expectTimeout;
  });
});

describe('Q9 · qp 缺解数信号时的幻影解码拒绝', () => {
  it('缺 num_solutions 且 energies/occurrences 均不可用：显式拒绝', async () => {
    // 4 量子比特 × 2 个 16 位字 → maxSolutions=4：全长解码会解出
    // 位对齐 padding 构成的幻影样本
    const { fetchImpl } = mockTransport(() => ({
      id: 'q9',
      status: 'COMPLETED',
      answer: { format: 'qp', data: { vector: [0b0001, 0] } },
    }));
    const backend = dwaveWith(fetchImpl);
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 3 }),
      (err: unknown) =>
        err instanceof BackendError && err.message.includes('missing num_solutions'),
    );
  });

  it('缺 num_solutions 但 energies 可用：按长度推断（保留既有行为）', async () => {
    const { fetchImpl } = mockTransport(() => ({
      id: 'q9',
      status: 'COMPLETED',
      answer: {
        format: 'qp',
        data: { vector: [0b0001, 0] },
        energies: [-1],
        num_occurrences: [5],
      },
    }));
    const backend = dwaveWith(fetchImpl);
    const result = await backend.solveIsing([0, 0], new Map(), 2, { numReads: 5 });
    assert.equal(result.spins.length, 1, 'energies 长度 1 → 只解 1 条');
    assert.deepEqual(result.spins[0], [-1, 1]);
  });

  it('显式 num_solutions: 0 仍然合法（零个解 ≠ 未知解数）', async () => {
    const { fetchImpl } = mockTransport(() => ({
      id: 'q9',
      status: 'COMPLETED',
      answer: { format: 'qp', num_solutions: 0, data: { vector: [0] } },
    }));
    const backend = dwaveWith(fetchImpl);
    const result = await backend.solveIsing([0, 0], new Map(), 2, { numReads: 3 });
    assert.equal(result.spins.length, 0);
  });
});

describe('Q10 · 全零福利问题的最优对照', () => {
  it('本地精确路径：optimal=0 时上报 optimality 且 ratio=1', async () => {
    const result = await solveAssignmentOnBackend(zeroWelfareProblem(), new LocalQuantumBackend());
    assert.equal(result.welfare, 0);
    assert.ok(result.optimality, 'optimal=0 不再被 `> 0` 守卫静默丢弃');
    assert.equal(result.optimality.optimal, 0);
    assert.equal(result.optimality.achieved, 0);
    assert.equal(result.optimality.ratio, 1);
  });

  it('QPU 路径（mock 传输）：optimal=0 且 achieved=0 → ratio=1', async () => {
    const p = zeroWelfareProblem(); // 1 任务 × 2 agent
    // 合法分配 t0→a0（z=[-1,+1] 即 x0=1）——福利为全零
    const { fetchImpl } = mockTransport(() => ({
      id: 'z1',
      status: 'COMPLETED',
      answer: { solutions: [[-1, 1]], energies: [0], num_occurrences: [4] },
    }));
    const backend = dwaveWith(fetchImpl);
    const result = await solveAssignmentOnBackend(p, backend, { numReads: 4 });
    assert.equal(result.welfare, 0);
    assert.ok(result.optimality, 'QPU 路径同样不应丢弃零最优对照');
    assert.equal(result.optimality.optimal, 0);
    assert.equal(result.optimality.achieved, 0);
    assert.equal(result.optimality.ratio, 1);
    // ratio=1 是有限值：下游快照（lastOptimalityRatio）不会被污染
    assert.ok(Number.isFinite(result.optimality.ratio));
  });
});
