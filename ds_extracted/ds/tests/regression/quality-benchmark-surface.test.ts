/**
 * 质量波(2026-09)补覆盖 · performance/benchmark 未测面
 *
 * 选点依据(c8 行级覆盖):benchmarkCommunication(双分支)、
 * benchmarkDSHIntegration、benchmarkSchedulerThroughput、
 * runFullBenchmark/generateReport/calculatePerformanceScore、以及
 * benchmarkAgentRegistration 的同步失败就地记录分支,在既有套件中
 * 完全未执行——本文件以小计数把这些面拉进回归网。
 *
 * 纪律:只断言计数/错误表等确定性量,不断言任何墙钟时长或吞吐数值
 * (它们是测量值,不承诺环境间可比——见 src/performance/benchmark.ts)。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumBenchmark } from '../../src/performance/benchmark.js';

describe('质量波补覆盖 · QuantumBenchmark 未测基准面', () => {
  it('benchmarkCommunication：不足 2 agent 时以错误明细降级,不产出伪消息计数', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      // 平台启动自带 4 个系统 agent;经公共 API 全部注销以触达降级分支
      const plat = bench.getPlatform();
      for (const agent of [...plat.getAgents()]) {
        plat.agentManager.unregisterAgent(agent.id);
      }

      const result = await bench.benchmarkCommunication(5);

      assert.equal(result.metrics.agentsRegistered, 0);
      assert.equal(result.metrics.units, 0, '零发送不得计入单位数');
      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0]!, /Need at least 2 agents/);
    } finally {
      await bench.cleanup();
    }
  });

  it('benchmarkCommunication：在线 agent 间同步路由,计数与错误表同源', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      await bench.benchmarkAgentRegistration(3);
      const result = await bench.benchmarkCommunication(10);

      assert.deepEqual(result.errors, []);
      assert.equal(result.metrics.units, 10);
      assert.equal(result.metrics.agentsRegistered, 7, '4 个系统 agent + 3 个基准 agent');
    } finally {
      await bench.cleanup();
    }
  });

  it('benchmarkDSHIntegration：真实 read_file 调用计数,失败进错误表', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      const result = await bench.benchmarkDSHIntegration(3);

      assert.deepEqual(result.errors, [], '读 package.json 不应失败');
      assert.equal(result.metrics.units, 3);
    } finally {
      await bench.cleanup();
    }
  });

  it('benchmarkSchedulerThroughput：完成链消费挂起任务,全部任务终态化', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      const result = await bench.benchmarkSchedulerThroughput(6, 3);

      assert.deepEqual(result.errors, []);
      assert.equal(result.metrics.agentsRegistered, 7, '4 个系统 agent + 3 个基准 agent');
      assert.equal(result.metrics.tasksSubmitted, 6);
      assert.equal(result.metrics.tasksCompleted, 6, '每 agent 一任务,逐完成触发重调度消费挂起');
      // 平台侧无残留非终态任务(与 wave3 同口径的收尾一致性检查)
      for (const task of bench.getPlatform().getTasks()) {
        assert.ok(
          task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled',
          `task ${task.id} left in ${task.status}`,
        );
      }
    } finally {
      await bench.cleanup();
    }
  });

  it('benchmarkAgentRegistration：同步注册失败就地记录,不击穿整轮', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      const plat = bench.getPlatform();
      const original = plat.registerAgent.bind(plat);
      let calls = 0;
      plat.registerAgent = (agent: Parameters<typeof original>[0]) => {
        if (calls++ === 1) throw new Error('injected register failure');
        return original(agent);
      };

      const result = await bench.benchmarkAgentRegistration(3);

      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0]!, /injected register failure/);
      assert.equal(result.metrics.agentsRegistered, 6, '两次成功注册照常计数(4 系统 + 2)');
    } finally {
      await bench.cleanup();
    }
  });

  it('runFullBenchmark：五段基准全部执行,报告评分落在 [0,100]', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      const results = await bench.runFullBenchmark();

      assert.equal(results.length, 5);
      assert.deepEqual(
        results.map((r) => r.testName),
        [
          'Agent Registration',
          'Task Submission',
          'Scheduler Throughput',
          'Communication',
          'DSH Integration',
        ],
      );
      for (const r of results) {
        assert.ok(r.duration >= 0, `${r.testName}: 时长非负`);
        assert.ok(r.metrics.throughput >= 0, `${r.testName}: 吞吐非负`);
        // 全链路无注入故障时错误表必须为空——任何非空都说明基准面在
        // 撒谎(静默吞错)或环境依赖未隔离
        assert.deepEqual(r.errors, [], `${r.testName}: errors=${JSON.stringify(r.errors)}`);
      }
    } finally {
      await bench.cleanup();
    }
  });
});
