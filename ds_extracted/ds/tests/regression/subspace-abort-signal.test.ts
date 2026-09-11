/**
 * 子空间求解器协作中止契约回归（08#19）：
 * QuantumSolverOptions.signal 的文档契约是「中止请求在协作点被观察，
 * 触发即抛 name='AbortError'」。同步孪生 annealSolveSubspace 在演化
 * 分发前后各有 throwIfAborted，但异步孪生 annealSolveSubspaceAsync
 * 此前整个丢弃 signal——已中止的请求会静默跑完整次求解（对长驻服务的
 * 取消语义是契约违约）。本文件锚定：
 *
 * ① 已中止 signal：异步退火入口按契约抛 AbortError（修复前：静默求解）；
 * ② 双孪生口径一致：同步退火/QAOA 子空间入口同场景同抛（锁定不回归）；
 * ③ 未中止 signal 不干扰求解：在场但不触发的 signal 下异步入口正常
 *    完成，且与同步解逐字段一致（happy path 位级不变的守卫）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubspaceModel,
  annealSolveSubspace,
  annealSolveSubspaceAsync,
  qaoaSolveSubspace,
} from '../../src/core/subspace-optimizer.js';
import type { AssignmentProblem } from '../../src/core/quantum-optimizer.js';

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function makeProblem(): AssignmentProblem {
  return {
    taskIds: ['t0', 't1'],
    agentIds: ['a0', 'a1', 'a2'],
    weights: [
      [1.0, 0.8, 0.5],
      [0.6, 0.9, 0.7],
    ],
    ineligible: [
      [false, false, false],
      [false, false, false],
    ],
    couplings: new Map<number, number>(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
}

describe('子空间求解器 · 协作中止契约（08#19）', () => {
  it('① 已中止 signal：异步退火入口抛 AbortError 而非静默求解', async () => {
    const model = buildSubspaceModel(makeProblem());
    assert.ok(model);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => annealSolveSubspaceAsync(model, { signal: controller.signal }),
      isAbortError,
    );
  });

  it('② 同步退火与 QAOA 子空间入口同场景同抛（双孪生口径一致）', () => {
    const model = buildSubspaceModel(makeProblem());
    assert.ok(model);
    const controller = new AbortController();
    controller.abort();
    assert.throws(() => annealSolveSubspace(model, { signal: controller.signal }), isAbortError);
    assert.throws(() => qaoaSolveSubspace(model, { signal: controller.signal }), isAbortError);
  });

  it('③ 未中止 signal 不干扰：异步完成且与同步解逐字段一致', async () => {
    const modelSync = buildSubspaceModel(makeProblem());
    const modelAsync = buildSubspaceModel(makeProblem());
    assert.ok(modelSync && modelAsync);
    const live = new AbortController(); // 在场但不触发
    const options = { seed: 42, signal: live.signal };
    const asyncSolution = await annealSolveSubspaceAsync(modelAsync, options);
    const syncSolution = annealSolveSubspace(modelSync, options);
    // angles 为 null（退火无角度）；两孪生共享 finishAnnealSolution 单源，
    // 逐字段一致即位级一致
    assert.deepStrictEqual(asyncSolution, syncSolution);
    assert.ok(Number.isFinite(syncSolution.welfare));
  });
});
