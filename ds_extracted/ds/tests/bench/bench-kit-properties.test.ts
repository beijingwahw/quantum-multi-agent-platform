/**
 * bench-kit 决定性与统计性质钉板（R8-C 镜头②：种子化路径重跑可复现、
 * 统计工具性质缺失处补钉）：
 *
 * ① comparePaired 在注入确定性时钟下完全决定性——同种子同负载两次完整
 *    运行产出逐字段相同的报告（含 bootstrap CI 与 note）。这是"种子化
 *    基准路径的重跑可复现"在测量器本体上的兑现；此前只有纯函数级
 *    （randomizedOrderSequence / stratifiedArmEffect）与单一剧本时钟
 *    （⑧ 单层退化）被钉，完整报告的重跑等价没有测试。
 * ② stratifiedArmEffect 对层内置换不变：中位数只依赖每层多重集合，
 *    层内打乱后估计量必须逐位不变（防止未来把中位数换成对顺序敏感
 *    的估计量时静默漂移）。
 * ③ randomizedOrderSequence 奇数轮平衡：⌈n/2⌉ 个 A-先（bench-harness ④
 *    只钉了偶数 200，头注中"奇数轮差 ≤1"的声明此前无测试）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { comparePaired, randomizedOrderSequence, stratifiedArmEffect } from './bench-kit.js';
import { mulberry32, shuffled } from '../../src/utils/rng.js';

/** 确定性时钟：每次调用推进 3ms ± 0.1 的固定模式——间隔远超分辨率守卫 */
function scriptedClock(): () => number {
  let n = 0;
  return () => 10_000 + n++ * 3 + (n % 5) * 0.1;
}

function runOnce(seed: number): ReturnType<typeof comparePaired> {
  return comparePaired(
    { name: 'a', run: () => {} },
    { name: 'b', run: () => {} },
    {
      rounds: 20,
      warmupRounds: 4,
      seed,
      clock: scriptedClock(),
      reference: () => {},
    },
  );
}

describe('bench-kit 决定性与统计性质', () => {
  it('① comparePaired 重跑可复现：同种子 + 确定性时钟 → 两次完整报告逐字段相同', () => {
    const first = runOnce(20260912);
    // 确定性环境不得落入任何"不判决"守卫（否则决定性就无从谈起）
    assert.notEqual(first.verdict, 'inconclusive', `确定性时钟下不应 inconclusive：${first.note}`);
    const second = runOnce(20260912);
    assert.deepEqual(second, first, '同种子重跑的报告必须逐字段一致（含 CI 与 note）');
    // 报告有血有肉：CI 为有限数、保留轮数完整（离群分类在固定模式下确定）
    assert.ok(Number.isFinite(first.ciLow) && Number.isFinite(first.ciHigh));
    assert.equal(first.roundsKept + first.excludedOutliers, first.roundsTotal);
  });

  it('① 种子敏感性：换种子报告可以不同（证明①钉的是可复现性而非恒等输出）', () => {
    const a = runOnce(20260912);
    const b = runOnce(20260913);
    // 不强制两份不同（统计上可能巧合一致），但次序序列必须不同——
    // 次序随机化是种子进入报告的确定通道
    assert.notDeepEqual(
      randomizedOrderSequence(20, 20260912),
      randomizedOrderSequence(20, 20260913),
      '不同种子必须产生不同的次序随机化序列',
    );
    assert.ok(
      a.roundsTotal === b.roundsTotal && a.verdict === b.verdict,
      '结构字段（轮数/判决类别）与种子无关',
    );
  });

  it('② stratifiedArmEffect 层内置换不变：中位数估计只依赖每层多重集合', () => {
    const flags = randomizedOrderSequence(40, 31415);
    const rng = mulberry32(271828);
    const ratios = flags.map((aFirst) => (aFirst ? 1.1 * 1.05 : 1.1 / 1.05) * (1 + rng() * 0.01));
    const baseline = stratifiedArmEffect(ratios, flags);

    // 层内打乱（保多重集合）：每层独立洗牌后估计量必须逐位不变
    const idx1: number[] = [];
    const idx0: number[] = [];
    ratios.forEach((_, i) => (flags[i] ? idx1 : idx0).push(i));
    const permutedIdx = [...shuffled(idx1, mulberry32(99)), ...shuffled(idx0, mulberry32(98))];
    const permutedRatios = permutedIdx.map((i) => ratios[i]!);
    const permutedFlags = permutedIdx.map((i) => flags[i]!);
    const permuted = stratifiedArmEffect(permutedRatios, permutedFlags);

    assert.equal(permuted.armEffect, baseline.armEffect, 'armEffect 对层内置换必须不变');
    assert.equal(permuted.positionEffect, baseline.positionEffect);
    assert.equal(permuted.stratum1, baseline.stratum1);
    assert.equal(permuted.stratum0, baseline.stratum0);
    // 场景自证：构造确实落在臂效应 a=1.1、位置效应 p=1.05 的邻域
    assert.ok(Math.abs(baseline.armEffect - 1.1) < 0.01);
    assert.ok(Math.abs(baseline.positionEffect - 1.05) < 0.01);
  });

  it('③ 次序随机化奇数轮平衡：⌈n/2⌉ 个 A-先（头注声明"奇数轮差 ≤1"此前无测试）', () => {
    for (const seed of [1, 42, 20260912]) {
      const seq = randomizedOrderSequence(201, seed);
      assert.equal(seq.length, 201);
      const aFirst = seq.filter(Boolean).length;
      assert.equal(aFirst, 101, `seed=${seed}：奇数轮 A-先应恰为 ⌈201/2⌉=101（实际 ${aFirst}）`);
      // 决定性同款：同种子同序列
      assert.deepEqual(randomizedOrderSequence(201, seed), seq);
    }
  });
});
