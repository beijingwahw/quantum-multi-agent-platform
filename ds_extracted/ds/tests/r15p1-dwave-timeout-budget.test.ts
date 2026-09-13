/**
 * R15-P1 缺陷1红测：DWave 超时预算 2× 口径。
 *
 * 旧实现：deadline 在 POST 完成之后起算（`Date.now() + timeoutMs`），
 * 而 POST 自身又吃满一整份 `AbortSignal.timeout(timeoutMs)`——总墙钟
 * 可逼近 2×timeoutMs，与 Q3 注释「总轮询仍受 timeoutMs 预算钳制」
 * 口径不符。定罪机制：POST 慢 350ms＋timeoutMs=400，轮询永 PENDING：
 * 修复后总墙钟 ≈400ms（POST 与轮询共享同一预算），旧实现 ≈750ms
 * （POST 后重新起算再吃 400ms）。断言上限取中点 560ms 钉死红色。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DWaveBackend } from '../src/core/qpu/dwave-backend.js';
import { BackendError } from '../src/utils/errors.js';

const ENDPOINT = 'https://cloud.dwavesys.com/sapi/v2';

describe('R15-P1 · DWave 超时预算单份口径（POST 与轮询共享）', () => {
  it('POST 慢 350ms＋timeoutMs=400：总墙钟不得超过预算（旧实现 ≈2× 预算被定罪）', async () => {
    const timeoutMs = 400;
    const postDelayMs = 350;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const url = input instanceof Request ? input.url : String(input);
      if (method === 'POST') {
        await sleep(postDelayMs);
        return new Response(JSON.stringify({ id: 'prob-t', status: 'PENDING' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'DELETE') {
        return new Response(null, { status: 404 });
      }
      // GET：轮询永 PENDING（只消耗预算，永不终态）
      assert.ok(url.includes('prob-t'), `轮询应指向已提交问题，实际 URL: ${url}`);
      return new Response(JSON.stringify({ id: 'prob-t', status: 'PENDING' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const backend = new DWaveBackend({ token: 't', endpoint: ENDPOINT, fetch: fetchImpl });
    const start = Date.now();
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 1, timeoutMs }),
      (err: unknown) => err instanceof BackendError && err.message.includes('timed out'),
    );
    const elapsed = Date.now() - start;
    // 修复后 ≈timeoutMs（400ms）；旧实现 ≈postDelay+timeoutMs（750ms）。
    // 中点 560：两侧各留 ~160/190ms 的调度抖动余量。
    assert.ok(
      elapsed < postDelayMs + timeoutMs / 2,
      `总墙钟 ${elapsed}ms 超出单份预算口径（POST ${postDelayMs}ms + timeoutMs ${timeoutMs}ms 的中点 = ` +
        `${postDelayMs + timeoutMs / 2}ms）——POST 与轮询必须共享同一 timeoutMs 预算`,
    );
  });

  it('POST 自身挂死：AbortSignal 在预算内触发，失败消息点名 POST 路径', async () => {
    const timeoutMs = 250;
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      await new Promise<never>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new Error('This operation was aborted')),
        );
      });
    }) as unknown as typeof fetch;

    const backend = new DWaveBackend({ token: 't', endpoint: ENDPOINT, fetch: fetchImpl });
    const start = Date.now();
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 1, timeoutMs }),
      (err: unknown) =>
        err instanceof BackendError && err.message.includes('DWave POST problems/ failed'),
    );
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 2 * timeoutMs, `挂死 POST 必须在预算内被中止（实际 ${elapsed}ms）`);
  });
});
