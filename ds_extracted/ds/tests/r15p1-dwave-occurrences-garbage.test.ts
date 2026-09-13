/**
 * R15-P1 缺陷4红测：DWave 经典/qp 格式 num_occurrences 垃圾静默回退。
 *
 * 旧实现：`asNumberArray(answer.num_occurrences) ?? solutions.map(() => 1)`
 * ——num_occurrences 为垃圾（非数组/含非有限数/长度失配）时静默把频率
 * 分母改写为逐样本 1（频率统计被无痕歪曲）。定罪机制：三类垃圾均断言
 * BackendError 具名拒绝（消息点名垃圾形态），而不是静默成功。
 * 同时锁定约定：「完全缺席（undefined）」保留逐样本 1 的既有回退
 * （缺席≠垃圾：qp 分支 Q9 已把「缺席信号」与「显式零值」区分对待，
 * 逐样本 1 是不伪造数据的中性默认；经典分支无长度推断信号，不采推断）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DWaveBackend } from '../src/core/qpu/dwave-backend.js';
import { BackendError } from '../src/utils/errors.js';

const ENDPOINT = 'https://cloud.dwavesys.com/sapi/v2';

function backendWith(answer: unknown): DWaveBackend {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ id: 'prob-o', status: 'COMPLETED', answer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
  return new DWaveBackend({ token: 't', endpoint: ENDPOINT, fetch: fetchImpl });
}

describe('R15-P1 · DWave num_occurrences 垃圾具名拒绝', () => {
  it('经典格式 · 非数组（字符串）：BackendError 点名形态，而非静默逐样本 1', async () => {
    const backend = backendWith({
      solutions: [
        [1, -1],
        [-1, 1],
      ],
      energies: [-1, -2],
      num_occurrences: '100',
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 3 }),
      (err: unknown) =>
        err instanceof BackendError &&
        err.message.includes('malformed num_occurrences') &&
        err.message.includes('array'),
    );
  });

  it('经典格式 · 含非有限值（null）：BackendError 点名非有限值', async () => {
    const backend = backendWith({
      solutions: [
        [1, -1],
        [-1, 1],
      ],
      energies: [-1, -2],
      num_occurrences: [2, null],
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 3 }),
      (err: unknown) =>
        err instanceof BackendError &&
        err.message.includes('num_occurrences') &&
        err.message.includes('non-finite'),
    );
  });

  it('经典格式 · 长度失配（2 解 × 1 频次）：BackendError 点名失配', async () => {
    const backend = backendWith({
      solutions: [
        [1, -1],
        [-1, 1],
      ],
      energies: [-1, -2],
      num_occurrences: [3],
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 4 }),
      (err: unknown) =>
        err instanceof BackendError &&
        err.message.includes('num_occurrences') &&
        err.message.includes('length'),
    );
  });

  it('qp 格式 · 非数组垃圾：以垃圾形态具名拒绝（不得被 Q9「缺信号」口径吞掉）', async () => {
    // num_solutions/energies 均缺席＋num_occurrences 为垃圾：旧实现把垃圾
    // 当「无可用长度」处理（Q9 拒绝但形态失真）；修复后必须点名垃圾本身
    const backend = backendWith({
      format: 'qp',
      data: { vector: [0b0000000000000101] }, // 2 量子比特 × ≥2 解的位流
      num_occurrences: { bad: true },
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 3 }),
      (err: unknown) =>
        err instanceof BackendError &&
        err.message.includes('malformed num_occurrences') &&
        !err.message.includes('missing num_solutions'),
    );
  });

  it('qp 格式 · 含非有限值垃圾：同样具名拒绝', async () => {
    const backend = backendWith({
      format: 'qp',
      num_solutions: 1,
      data: { vector: [0b0000000000000101] },
      energies: [-1],
      num_occurrences: [Number.NaN],
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 3 }),
      (err: unknown) => err instanceof BackendError && err.message.includes('non-finite'),
    );
  });

  it('完全缺席（undefined）：保留逐样本 1 的既有约定（经典与 qp 同口径）', async () => {
    const classic = backendWith({
      solutions: [
        [1, -1],
        [-1, 1],
      ],
      energies: [-1, -2],
    });
    const classicResult = await classic.solveIsing([0, 0], new Map(), 2, { numReads: 2 });
    assert.deepEqual(classicResult.occurrences, [1, 1], '经典格式缺席 → 逐样本 1');

    const qp = backendWith({
      format: 'qp',
      num_solutions: 2,
      data: { vector: [0b0000000000000101] }, // bit0=1,bit2=1 → 解[-1,1],[-1,1]
      energies: [-1, -1],
    });
    const qpResult = await qp.solveIsing([0, 0], new Map(), 2, { numReads: 2 });
    assert.equal(qpResult.occurrences.length, 2);
    assert.deepEqual(qpResult.occurrences, [1, 1], 'qp 格式缺席 → 逐样本 1');
  });

  it('合法 num_occurrences（形状与长度均匹配）：原样透传', async () => {
    const backend = backendWith({
      solutions: [
        [1, -1],
        [-1, 1],
      ],
      energies: [-1, -2],
      num_occurrences: [7, 3],
    });
    const result = await backend.solveIsing([0, 0], new Map(), 2, { numReads: 10 });
    assert.deepEqual(result.occurrences, [7, 3]);
  });
});
