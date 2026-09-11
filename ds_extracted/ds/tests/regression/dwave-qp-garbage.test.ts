/**
 * D-Wave 响应解析的静默垃圾防护回归网（2026-09 代码质量遍历）：
 *
 * qp 压缩格式的 answer.data.vector 此前以 `as number[]` 盲转——外部
 * JSON 里的非数值字（null/字符串/缺失）经 `(word >> b) & 1` 被静默解成
 * 全 +1 自旋（幻影样本），歪曲 invalidSamples 与频率统计。经典格式的
 * solutions 早已逐元素验证（「不盲信外部 JSON」），qp 侧补齐同款校验。
 * 同时锁定：缺 problem id 的提交响应在轮询前立即失败（不再先睡 500ms）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DWaveBackend } from '../../src/core/qpu/dwave-backend.js';
import { BackendError } from '../../src/utils/errors.js';

function backendWith(answer: unknown, status = 'COMPLETED'): DWaveBackend {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ id: 'prob-g', status, answer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
  return new DWaveBackend({
    token: 't',
    endpoint: 'https://cloud.dwavesys.com/sapi/v2',
    fetch: fetchImpl,
  });
}

describe('DWave qp/轮询响应的静默垃圾防护', () => {
  it('qp vector 含非数值字：显式 BackendError 而非幻影 +1 自旋', async () => {
    // 2 量子比特：word=null → (null>>0)&1 === 0 → 旧实现解出 [+1,+1] 假样本
    const backend = backendWith({
      format: 'qp',
      num_solutions: 1,
      data: { vector: [null] },
      energies: [-1],
      num_occurrences: [3],
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 3 }),
      (err: unknown) =>
        err instanceof BackendError && err.message.includes('non-numeric vector words'),
    );
  });

  it('qp vector 含字符串字：同样显式拒绝', async () => {
    const backend = backendWith({
      format: 'qp',
      num_solutions: 1,
      data: { vector: ['0xffff'] },
      energies: [-1],
      num_occurrences: [3],
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 3 }),
      (err: unknown) =>
        err instanceof BackendError && err.message.includes('non-numeric vector words'),
    );
  });

  it('缺 problem id 的 PENDING 响应：立即失败（不进入轮询退避）', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ status: 'PENDING' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;
    const backend = new DWaveBackend({
      token: 't',
      endpoint: 'https://cloud.dwavesys.com/sapi/v2',
      fetch: fetchImpl,
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 1 }),
      (err: unknown) =>
        err instanceof BackendError && err.message.includes('missing the problem id'),
    );
  });
});
