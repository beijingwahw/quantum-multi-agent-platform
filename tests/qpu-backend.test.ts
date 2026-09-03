import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { defaultPenalties, bruteForceOptimum } from '../src/core/quantum-optimizer.js';
import {
  LocalQuantumBackend,
  getBackend,
  listBackends,
  registerBackend,
} from '../src/core/qpu/quantum-backend.js';
import { DWaveBackend } from '../src/core/qpu/dwave-backend.js';
import { solveAssignmentOnBackend } from '../src/core/qpu/solve.js';
import { BackendError } from '../src/utils/errors.js';
import { toQiskitProgram } from '../src/core/qpu/qiskit-export.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';

const EPS = 1e-9;

function makeProblem(m: number, n: number, seed: number): AssignmentProblem {
  let a = seed >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => +(0.15 + 0.7 * rng()).toFixed(3)),
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
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

/** 最优分配 → 自旋向量（z = 1 − 2x） */
function spinsOf(assignment: number[], m: number, n: number): number[] {
  const spins = new Array<number>(m * n).fill(1);
  for (let t = 0; t < m; t++) spins[t * n + assignment[t]!] = -1;
  return spins;
}

// ----------------------------------------------------------------------------
// D-Wave SAPI stub 服务器：真实 HTTP 往返（无凭据离线验证客户端接线）
// ----------------------------------------------------------------------------

interface CapturedRequest {
  method: string;
  url: string;
  token: string | undefined;
  body: any;
}

function startStub(): Promise<{
  server: http.Server;
  url: string;
  requests: CapturedRequest[];
  respondWith: (fn: (req: CapturedRequest) => any) => void;
}> {
  const requests: CapturedRequest[] = [];
  let responder: (req: CapturedRequest) => any = () => ({
    status: 'COMPLETED',
    answer: { solutions: [], energies: [], num_occurrences: [] },
  });

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const captured: CapturedRequest = {
        method: req.method ?? '',
        url: req.url ?? '/',
        token: req.headers['x-auth-token'] as string | undefined,
        body: raw ? JSON.parse(raw) : null,
      };
      requests.push(captured);
      const payload = responder(captured);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        requests,
        respondWith: (fn) => {
          responder = fn;
        },
      });
    });
  });
}

describe('QPU 后端层', () => {
  let stub: Awaited<ReturnType<typeof startStub>>;

  before(async () => {
    stub = await startStub();
    // 测试环境确保无真凭据（避免环境串扰）
    delete process.env.DWAVE_API_TOKEN;
    delete process.env.D_WAVE_API_TOKEN;
  });

  after(() => {
    stub.server.close();
  });

  it('本地精确引擎后端：solveAssignment 命中最优', async () => {
    const p = makeProblem(3, 5, 7);
    const result = await solveAssignmentOnBackend(p, new LocalQuantumBackend(), { numReads: 256 });
    assert.equal(result.realHardware, false);
    assert.ok(Math.abs(result.optimality!.ratio - 1) < EPS);
    assert.equal(result.invalidSamples, 0);
  });

  it('默认后端选择：无凭据时回退本地精确引擎', () => {
    const backend = getBackend();
    // 有真实凭据的环境允许选真硬件后端（但必须就绪）；无凭据必为本地
    assert.ok(!backend.realHardware || backend.isAvailable());
    if (!backend.realHardware) {
      assert.equal(backend.name, 'local-subspace');
    }
    const listing = listBackends();
    assert.ok(listing.some((b) => b.name === 'local-subspace' && b.available));
  });

  it('D-Wave 客户端（stub 真实 HTTP 往返）：请求编码 + 响应解码 + 最优对照', async () => {
    const p = makeProblem(2, 3, 42);
    const optimal = bruteForceOptimum(p).assignment;
    const m = 2,
      n = 3;

    // stub 返回：最优解（多次出现）+ 一个非法样本（one-hot 违约）
    const badSpins = new Array<number>(m * n).fill(1); // 全 +1 = 空分配（非法）
    stub.respondWith(() => ({
      id: 'prob-1',
      status: 'COMPLETED',
      answer: {
        solutions: [spinsOf(optimal, m, n), spinsOf(optimal, m, n), badSpins],
        energies: [-1.18, -1.18, 99],
        num_occurrences: [60, 30, 10],
      },
    }));

    const backend = new DWaveBackend({
      token: 'test-token',
      endpoint: stub.url,
      solver: 'hybrid_binary_quadratic_model_version2p',
    });
    assert.equal(backend.isAvailable(), true);

    const result = await solveAssignmentOnBackend(p, backend, { numReads: 100 });
    assert.equal(result.realHardware, true);
    assert.deepEqual(result.assignment, optimal);
    assert.ok(Math.abs(result.welfare - bruteForceOptimum(p).welfare) < EPS);
    // 采样频率 = 最优解出现 90/100
    assert.ok(Math.abs(result.sampleFrequency - 0.9) < EPS);
    assert.equal(result.invalidSamples, 10);
    assert.ok(Math.abs(result.optimality!.ratio - 1) < EPS);

    // 请求编码：混合求解器 → bqm 三元组格式 + X-Auth-Token
    const post = stub.requests.find((r) => r.method === 'POST' && r.url.includes('problems'));
    assert.ok(post, '应发起 POST /problems/');
    assert.equal(post.token, 'test-token');
    assert.equal(post.body.type, 'bqm');
    assert.equal(post.body.solver, 'hybrid_binary_quadratic_model_version2p');
    assert.ok(Array.isArray(post.body.data.linear));
    assert.ok(Array.isArray(post.body.data.quadratic));
    assert.equal(post.body.params.num_reads, 100);
  });

  it('D-Wave 结构化求解器：经典 ising 字典格式编码', async () => {
    const p = makeProblem(2, 3, 43);
    const optimal = bruteForceOptimum(p).assignment;
    stub.respondWith(() => ({
      id: 'prob-2',
      status: 'COMPLETED',
      answer: {
        solutions: [spinsOf(optimal, 2, 3)],
        energies: [-1],
        num_occurrences: [1],
      },
    }));
    const backend = new DWaveBackend({
      token: 't',
      endpoint: stub.url,
      solver: 'Advantage_system4.1',
    });
    const result = await solveAssignmentOnBackend(p, backend, { numReads: 1 });
    assert.deepEqual(result.assignment, optimal);

    const post = stub.requests.filter((r) => r.method === 'POST').at(-1)!;
    assert.equal(post.body.type, 'ising');
    assert.ok(post.body.data.h && typeof post.body.data.h === 'object');
    assert.ok(post.body.data.J && typeof post.body.data.J === 'object');
  });

  it('异步任务轮询：PENDING → GET → COMPLETED', async () => {
    const p = makeProblem(2, 3, 44);
    const optimal = bruteForceOptimum(p).assignment;
    let pollCount = 0;
    stub.respondWith((req) => {
      if (req.method === 'POST') return { id: 'prob-3', status: 'PENDING' };
      pollCount++;
      if (pollCount < 2) return { id: 'prob-3', status: 'PENDING' };
      return {
        id: 'prob-3',
        status: 'COMPLETED',
        answer: { solutions: [spinsOf(optimal, 2, 3)], energies: [-1], num_occurrences: [5] },
      };
    });

    const backend = new DWaveBackend({ token: 't', endpoint: stub.url });
    const result = await solveAssignmentOnBackend(p, backend, { numReads: 5 });
    assert.deepEqual(result.assignment, optimal);
    // 轮询过 GET /problems/prob-3
    assert.ok(stub.requests.some((r) => r.method === 'GET' && r.url.includes('prob-3')));
  });

  it('qp 压缩响应格式解析', async () => {
    const p = makeProblem(2, 2, 45);
    const optimal = bruteForceOptimum(p).assignment; // 2×2
    const spins = spinsOf(optimal, 2, 2);
    // 位打包：bit=1 → 自旋 −1；小端 16 位字
    let word = 0;
    for (let q = 0; q < 4; q++) {
      if (spins[q] === -1) word |= 1 << q;
    }
    stub.respondWith(() => ({
      id: 'prob-4',
      status: 'COMPLETED',
      answer: {
        format: 'qp',
        num_solutions: 1,
        data: { vector: [word] },
        energies: [-1],
        num_occurrences: [7],
      },
    }));
    const backend = new DWaveBackend({ token: 't', endpoint: stub.url });
    const result = await solveAssignmentOnBackend(p, backend, { numReads: 7 });
    assert.deepEqual(result.assignment, optimal);
  });

  it('全部样本非法时抛错（真 QPU 噪声防护）', async () => {
    const p = makeProblem(2, 3, 46);
    stub.respondWith(() => ({
      id: 'prob-5',
      status: 'COMPLETED',
      answer: { solutions: [new Array(6).fill(1)], energies: [99], num_occurrences: [3] },
    }));
    const backend = new DWaveBackend({ token: 't', endpoint: stub.url });
    await assert.rejects(
      () => solveAssignmentOnBackend(p, backend, { numReads: 3 }),
      (err: unknown) => err instanceof BackendError && /all failed validation/.test(err.message),
    );
  });

  it('无凭据时 DWaveBackend.isAvailable()=false', () => {
    assert.equal(new DWaveBackend().isAvailable(), false);
  });

  it('Qiskit 程序导出：结构、角度与解码逻辑齐备', () => {
    const p = makeProblem(2, 3, 47);
    const program = toQiskitProgram(p, { angles: [0.7, 0.5, 0.3, 0.25] });
    assert.match(program, /NQ = 6/);
    // 角度切分契约：angles = [γ1..γp, β1..βp]，layers=2
    assert.match(program, /GAMMAS = \[0\.7, 0\.5\]/);
    assert.match(program, /BETAS\s+= \[0\.3, 0\.25\]/);
    assert.match(program, /qc\.h\(range\(NQ\)\)/);
    assert.match(program, /qc\.rz\(2 \* gamma \* h, q\)/);
    assert.match(program, /qc\.rx\(2 \* beta, q\)/);
    assert.match(program, /def decode\(bits\)/);
    assert.match(program, /AerSimulator/);
  });
});

describe('调度器 QPU 入口', () => {
  it('scheduleBatchQuantumQpu（本地后端）：分配落地 + 报告带最优对照', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        quantumAlgorithm: 'quantum-annealing',
        autoSchedule: false,
      },
    });
    for (let i = 0; i < 5; i++) {
      scheduler.registerAgent({
        id: `a${i}`,
        name: `a${i}`,
        type: 'developer',
        capabilities: ['js'],
        state: 'idle',
        load: 0,
        position: { x: 0, y: 0, z: 0 },
        quantumEntanglement: [],
        lastHeartbeat: new Date(),
      });
    }
    for (let i = 0; i < 3; i++) {
      scheduler.submitTask({
        name: `任务${i}`,
        type: 'qpu',
        priority: 'high',
        requirements: [{ type: 'capability', name: 'js', value: null, weight: 1 }],
        dependencies: [],
        estimatedDuration: 5000,
        actualDuration: 0,
        status: 'pending',
      } as any);
    }

    const report = await scheduler.scheduleBatchQuantumQpu(new LocalQuantumBackend(), {
      numReads: 256,
    });

    assert.equal(report.representation, 'qpu');
    assert.equal(report.assigned, 3);
    assert.ok(report.optimality!);
    assert.ok(Math.abs(report.optimality.ratio - 1) < EPS);
    assert.ok(scheduler.getTasks().every((t) => t.status === 'assigned'));
    // 决策带采样语义的概率与 reasoning
    const decision = scheduler.getSchedulingHistory().at(-1)!;
    assert.ok(decision.probability > 0 && decision.probability <= 1);
    assert.match(decision.reasoning, /local-subspace/);
  });

  it('真 QPU 后端可注入调度器（stub HTTP 全链路）', async () => {
    const stub2 = await startStub();
    try {
      const scheduler = new QuantumScheduler({
        scheduling: { quantumAlgorithm: 'quantum-annealing', autoSchedule: false },
      });
      for (let i = 0; i < 3; i++) {
        scheduler.registerAgent({
          id: `a${i}`,
          name: `a${i}`,
          type: 'developer',
          capabilities: ['js'],
          state: 'idle',
          load: 0,
          position: { x: 0, y: 0, z: 0 },
          quantumEntanglement: [],
          lastHeartbeat: new Date(),
        });
      }
      scheduler.submitTask({
        name: 'Q1',
        type: 'qpu',
        priority: 'critical',
        requirements: [{ type: 'capability', name: 'js', value: null, weight: 1 }],
        dependencies: [],
        estimatedDuration: 5000,
        actualDuration: 0,
        status: 'pending',
      } as any);

      stub2.respondWith((_req) => {
        // 用提交的 h/J 现场求解最优太复杂——直接返回全 +1 外加最优位翻转不可行；
        // 改为从请求侧拿到问题规模，返回一个可行的分配：构造与调度器一致的最优
        // 通过本地下场？此处返回已在测试内静态构造的最优（t0→a2）
        const spins = [1, 1, -1]; // q2 (t0→a2) 置 −1
        return {
          id: 's1',
          status: 'COMPLETED',
          answer: { solutions: [spins], energies: [-1], num_occurrences: [42] },
        };
      });

      const backend = new DWaveBackend({ token: 't', endpoint: stub2.url, solver: 'hybrid_x' });
      const report = await scheduler.scheduleBatchQuantumQpu(backend, { numReads: 42 });
      assert.equal(report.representation, 'qpu');
      assert.equal(report.assigned, 1);
      const task = scheduler.getTasks()[0]!;
      assert.equal(task.assignedAgentId, 'a2');
      assert.match(scheduler.getSchedulingHistory().at(-1)!.reasoning, /real QPU/);
    } finally {
      stub2.server.close();
    }
  });

  it('registerBackend/getBackend 注册表契约', () => {
    const custom = new DWaveBackend({ token: 'x', endpoint: 'http://127.0.0.1:9' });
    registerBackend(custom);
    assert.equal(getBackend(custom.name).name, custom.name);
  });
});
