/**
 * R19 · DWave mock 传输共享夹具自证（代理 S · QPU 域，纯新增）
 *
 * 三处提炼源的形态回放钉板：
 * - 捕获面（qpu-backend 的 mockTransport 形态）：method/url/token/body；
 * - 单份已完成问题（r15p1-occurrences 的 backendWith 形态）；
 * - 慢 POST／GET 永远 PENDING／DELETE 404／429 Retry-After／挂死 POST
 *   （r15p1-timeout 的内联 fetch 形态）——全部经真实 DWaveBackend 全链路。
 * 既有三处测试文件只读未改编；本文件证明夹具可表达它们的全部语义。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dwaveMockTransport,
  dwaveCompletedProblemTransport,
} from './helpers/dwave-mock-transport.js';
import { DWaveBackend } from '../src/core/qpu/dwave-backend.js';
import { BackendError } from '../src/utils/errors.js';

const ENDPOINT = 'https://cloud.dwavesys.com/sapi/v2';

function backendWithTransport(fetchImpl: typeof fetch): DWaveBackend {
  return new DWaveBackend({ token: 'unit-test-token', endpoint: ENDPOINT, fetch: fetchImpl });
}

describe('R19S · mock 传输夹具：捕获面', () => {
  it('POST 即终态：method/url/token/已解析 body 全捕获', async () => {
    const answer = {
      solutions: [
        [1, -1],
        [-1, 1],
      ],
      energies: [-1, -2],
    };
    const { fetchImpl, requests } = dwaveMockTransport(() => ({
      json: { id: 'prob-cap', status: 'COMPLETED', answer },
    }));
    const backend = backendWithTransport(fetchImpl);
    const result = await backend.solveIsing([0, 0], new Map(), 2, { numReads: 2 });

    assert.equal(requests.length, 1, 'POST 即终态，无轮询');
    const post = requests[0]!;
    assert.equal(post.method, 'POST');
    assert.ok(post.url.endsWith('/problems/'), `URL 应指向提交路径，实际 ${post.url}`);
    assert.equal(post.token, 'unit-test-token');
    assert.equal((post.body as { type: string }).type, 'bqm');
    assert.ok(Array.isArray((post.body as { data: { linear: unknown } }).data.linear));
    assert.deepEqual(result.spins, answer.solutions);
    assert.deepEqual(result.occurrences, [1, 1], 'num_occurrences 缺席 → 逐样本 1');
  });

  it('responder 按请求分支：POST PENDING → GET COMPLETED（全链路轮询形态）', async () => {
    const { fetchImpl, requests } = dwaveMockTransport((req) => {
      if (req.method === 'POST') return { json: { id: 'prob-poll', status: 'PENDING' } };
      return {
        json: {
          id: 'prob-poll',
          status: 'COMPLETED',
          answer: { solutions: [[1, 1]], energies: [0] },
        },
      };
    });
    const backend = backendWithTransport(fetchImpl);
    const result = await backend.solveIsing([0, 0], new Map(), 2, { numReads: 1 });

    assert.equal(requests.length, 2, '一次提交 + 一次轮询');
    assert.equal(requests[0]!.method, 'POST');
    assert.equal(requests[1]!.method, 'GET');
    assert.ok(requests[1]!.url.includes('prob-poll'), '轮询应指向已提交问题');
    assert.equal(requests[1]!.body, null, 'GET 无请求体');
    assert.deepEqual(result.spins, [[1, 1]]);
  });
});

describe('R19S · mock 传输夹具：便捷形态（backendWith 回放）', () => {
  it('dwaveCompletedProblemTransport：每请求返回单份已完成问题', async () => {
    const backend = backendWithTransport(
      dwaveCompletedProblemTransport({
        solutions: [
          [1, -1],
          [-1, 1],
        ],
        energies: [-1, -2],
        num_occurrences: [7, 3],
      }),
    );
    const result = await backend.solveIsing([0, 0], new Map(), 2, { numReads: 10 });
    assert.deepEqual(result.occurrences, [7, 3], '合法 num_occurrences 原样透传');
  });
});

describe('R19S · mock 传输夹具：r15p1-timeout 形态回放', () => {
  it('GET 永远 PENDING＋timeoutMs：超时具名拒绝，孤儿问题触发 DELETE（回 404）', async () => {
    const { fetchImpl, requests } = dwaveMockTransport((req) => {
      if (req.method === 'DELETE') return { httpStatus: 404 };
      return { json: { id: 'prob-t', status: 'PENDING' } };
    });
    const backend = backendWithTransport(fetchImpl);
    const start = Date.now();
    await assert.rejects(
      () => backend.solveIsing([0, 0], new Map(), 2, { numReads: 1, timeoutMs: 300 }),
      (err: unknown) => err instanceof BackendError && err.message.includes('timed out'),
    );
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 900, `超时路径应贴住预算（实际 ${elapsed}ms）`);
    const methods = requests.map((r) => r.method);
    assert.ok(methods.includes('DELETE'), '孤儿兜底取消必须发出 DELETE');
    assert.equal(methods[0], 'POST');
    assert.ok(methods.filter((m) => m === 'GET').length >= 1, '至少轮询一次');
  });

  it('挂死 POST：hangUntilAbort 经 AbortSignal 中止', async () => {
    const { fetchImpl } = dwaveMockTransport(() => ({ hangUntilAbort: true }));
    await assert.rejects(
      () => fetchImpl(`${ENDPOINT}/problems/`, { signal: AbortSignal.timeout(40) }),
      /aborted/,
    );
  });
});

describe('R19S · mock 传输夹具：信封面（429/延迟/非 JSON）', () => {
  it('429＋Retry-After：瞬态重试一次后终态（真重试机械对拍）', async () => {
    // 轮询计数器（而非读捕获列表：捕获先于 responder 分派，自指计数
    // 会差一——首个 GET 已入列，429 分支永不触发，重试路径空转）
    let pollCount = 0;
    const { fetchImpl, requests } = dwaveMockTransport((req) => {
      if (req.method === 'POST') return { json: { id: 'prob-r', status: 'PENDING' } };
      pollCount += 1;
      if (pollCount === 1) {
        return { httpStatus: 429, json: {}, headers: { 'retry-after': '0.05' } };
      }
      return {
        json: {
          id: 'prob-r',
          status: 'COMPLETED',
          answer: { solutions: [[-1, 1]], energies: [-1] },
        },
      };
    });
    const backend = backendWithTransport(fetchImpl);
    const result = await backend.solveIsing([0, 0], new Map(), 2, { numReads: 1 });

    assert.deepEqual(result.spins, [[-1, 1]]);
    assert.equal(requests.length, 3, 'POST + GET(429) + GET(COMPLETED)');
    assert.equal(requests[1]!.method, 'GET');
    assert.equal(requests[2]!.method, 'GET');
  });

  it('delayMs 前置延迟生效（慢 POST 形态）', async () => {
    const { fetchImpl } = dwaveMockTransport(() => ({ delayMs: 30, json: { ok: true } }));
    const start = Date.now();
    const response = await fetchImpl(`${ENDPOINT}/problems/`, { method: 'POST' });
    const elapsed = Date.now() - start;
    assert.equal(response.status, 200);
    assert.ok(elapsed >= 20, `延迟应生效（实际 ${elapsed}ms）`);
  });

  it('raw 体＋非 200 状态：原样送达（信封底层）', async () => {
    const { fetchImpl } = dwaveMockTransport(() => ({ httpStatus: 503, raw: 'gateway down' }));
    const response = await fetchImpl(`${ENDPOINT}/problems/`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.equal(await response.text(), 'gateway down');
  });
});
