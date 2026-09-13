/**
 * R15-P2 · 缺陷 2 红测：benchmark 的随机选择偏离全仓种子化 RNG 纪律。
 *
 * 现状（被定罪）：benchmarkAgentRegistration / benchmarkCommunication /
 * benchmarkSchedulerThroughput 三处用 Math.random() 取随机位置与消息
 * 源/目——同机逐次不可复现，偏离「所有随机性必须经由 utils/rng.ts
 * 的 mulberry32」的全仓纪律。
 *
 * 修复后契约：QuantumBenchmark 构造器接受可注入 seed（缺省 DEFAULT_SEED），
 * 三处随机选择改走同一 Mulberry32 实例（语句序 = 抽取序）：
 * - 注册/吞吐基准：每个 agent 连抽 x,y,z 三次；
 * - 通信基准：每条消息先抽 source 再抽 target。
 * 同 seed 两次运行的选择序列逐位一致（本测试钉板）；不同 seed 序列不同
 * （证明 seed 确实流入抽取路径而非被忽略）。
 *
 * 可观察面：agent.position 原样存入 Agent（agent-manager 无变换）；
 * 消息源/目经包装 quantumBus.createMessage 记录（wave3-hardening 的
 * 注入式包装同款手法）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumBenchmark } from '../src/performance/benchmark.js';

const SEED_A = 20250914;
const SEED_B = 777;

/** 取指定名字前缀的 agent 位置三元组序列（选择序列的可观察投影） */
function positionsOf(bench: QuantumBenchmark, prefix: string): number[][] {
  return bench
    .getPlatform()
    .getAgents()
    .filter((a) => a.name.startsWith(prefix))
    .map((a) => [a.position.x, a.position.y, a.position.z]);
}

/** 包装 createMessage 记录 (sourceIndex, targetIndex) 选择序列（UUID 跨实例必然不同，取序数投影） */
function recordMessagePairs(bench: QuantumBenchmark): number[][] {
  const bus = bench.getPlatform().quantumBus;
  const original = bus.createMessage.bind(bus);
  const pairs: number[][] = [];
  const indexOf = (id: string): number =>
    bench
      .getPlatform()
      .getAgents()
      .findIndex((a) => a.id === id);
  bus.createMessage = (sourceAgentId, type, content, targetAgentId, targetAgentIds, priority) => {
    pairs.push([indexOf(sourceAgentId), indexOf(targetAgentId ?? sourceAgentId)]);
    return original(sourceAgentId, type, content, targetAgentId, targetAgentIds, priority);
  };
  return pairs;
}

describe('R15-P2 · benchmark 随机选择种子化可复现', () => {
  it('benchmarkAgentRegistration：同 seed 两次运行的 agent 位置序列逐位一致（:131 定罪点）', async () => {
    const runA = new QuantumBenchmark({ communication: { port: 0 } }, SEED_A);
    const runB = new QuantumBenchmark({ communication: { port: 0 } }, SEED_A);
    await runA.initialize();
    await runB.initialize();
    try {
      await runA.benchmarkAgentRegistration(8);
      await runB.benchmarkAgentRegistration(8);
      const posA = positionsOf(runA, 'Test Agent ');
      const posB = positionsOf(runB, 'Test Agent ');
      assert.equal(posA.length, 8);
      assert.ok(
        posA.some(([x, y, z]) => x !== 0 || y !== 0 || z !== 0),
        'RNG 确实在抽取（非全零默认位置）',
      );
      // 修复前：Math.random 逐次不同 → 红；修复后：同 seed 逐位一致
      assert.deepEqual(posA, posB, '同 seed 的位置序列必须逐位一致');
    } finally {
      await runA.cleanup();
      await runB.cleanup();
    }
  });

  it('benchmarkCommunication：同 seed 两次运行的消息源/目序列逐位一致（:253-254 定罪点）', async () => {
    const runA = new QuantumBenchmark({ communication: { port: 0 } }, SEED_A);
    const runB = new QuantumBenchmark({ communication: { port: 0 } }, SEED_A);
    await runA.initialize();
    await runB.initialize();
    const pairsA = recordMessagePairs(runA);
    const pairsB = recordMessagePairs(runB);
    try {
      const resA = await runA.benchmarkCommunication(50);
      const resB = await runB.benchmarkCommunication(50);
      assert.equal(resA.errors.length, 0);
      assert.equal(resB.errors.length, 0);
      assert.equal(pairsA.length, 50);
      // 修复前：Math.random 的源/目选择逐次不同 → 红
      assert.deepEqual(pairsA, pairsB, '同 seed 的源/目选择序列必须逐位一致');
    } finally {
      await runA.cleanup();
      await runB.cleanup();
    }
  });

  it('benchmarkSchedulerThroughput：同 seed 两次运行的 bench agent 位置序列逐位一致（:344 定罪点）', () => {
    const runA = new QuantumBenchmark({ communication: { port: 0 } }, SEED_A);
    const runB = new QuantumBenchmark({ communication: { port: 0 } }, SEED_A);
    runA.benchmarkSchedulerThroughput(6, 4);
    runB.benchmarkSchedulerThroughput(6, 4);
    const posA = positionsOf(runA, 'Bench Agent ');
    const posB = positionsOf(runB, 'Bench Agent ');
    assert.equal(posA.length, 4);
    // 修复前：Math.random → 红
    assert.deepEqual(posA, posB);
  });

  it('seed 注入真实生效：不同 seed 的位置序列不同', async () => {
    const runA = new QuantumBenchmark({ communication: { port: 0 } }, SEED_A);
    const runB = new QuantumBenchmark({ communication: { port: 0 } }, SEED_B);
    await runA.initialize();
    await runB.initialize();
    try {
      await runA.benchmarkAgentRegistration(8);
      await runB.benchmarkAgentRegistration(8);
      assert.notDeepEqual(positionsOf(runA, 'Test Agent '), positionsOf(runB, 'Test Agent '));
    } finally {
      await runA.cleanup();
      await runB.cleanup();
    }
  });
});
