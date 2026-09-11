/**
 * performance/benchmark 的 units 契约回归：BenchmarkResult.metrics.units
 * 的文档语义是「测量窗口内**完成**的单位数」。旧行为在 Task Submission
 * 与 Scheduler Throughput 两处直接取请求数原值——同步提交失败、从未完成
 * 的单位被计为完成，吞吐与均值响应时间随之虚高（性能评分的错误率分母
 * 同步失真：注入 1 次失败时 errorRate 被压成 2/3 而非 1）。
 *
 * 故障注入走 getPlatform() 暴露的被测实例（测试注入故障的文档化通道，
 * 与 tests/wave3-hardening.test.ts 同一模式）；无错路径的 units 行为
 * 不变（wave3 已钉 units===count===completed 的同源断言）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumBenchmark } from '../../src/performance/benchmark.js';

describe('benchmark units 诚实性（完成单位计数）', () => {
  it('Task Submission：同步提交失败的单位计入 errors、不计入 units', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      const plat = bench.getPlatform();
      const original = plat.submitTask.bind(plat);
      let calls = 0;
      plat.submitTask = (task: Parameters<typeof original>[0]) => {
        if (calls++ === 0) throw new Error('injected submit failure');
        return original(task);
      };

      const result = await bench.benchmarkTaskSubmission(3);

      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0]!, /injected submit failure/);
      assert.equal(result.metrics.tasksCompleted, 2);
      // 旧行为此处为 3：失败单位被计为完成 → 吞吐虚高
      assert.equal(result.metrics.units, 2);
      assert.ok(Number.isFinite(result.metrics.throughput), 'units>0 时吞吐必须是有限数');
    } finally {
      await bench.cleanup();
    }
  });

  it('Scheduler Throughput：提交抛错的单位计入 errors、不计入 units', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      const plat = bench.getPlatform();
      const original = plat.submitTask.bind(plat);
      let calls = 0;
      plat.submitTask = (task: Parameters<typeof original>[0]) => {
        if (calls++ === 1) throw new Error('injected submit failure');
        return original(task);
      };

      const result = await bench.benchmarkSchedulerThroughput(4, 2);

      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0]!, /Submit 1 failed: injected submit failure/);
      // 4 个请求、1 个同步失败 → 完成单位 3（旧代码计 4）
      assert.equal(result.metrics.units, 3);
    } finally {
      await bench.cleanup();
    }
  });
});
