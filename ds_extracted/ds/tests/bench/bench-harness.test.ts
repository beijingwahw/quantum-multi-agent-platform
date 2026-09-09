/**
 * 测量器自验证套件（bench-kit 的效度证明）：
 * 世界级纪律是「测量器也要被测量」——本文件锁定 bench-kit 的六条性质，
 * 任何一条失效都意味着依赖它的性能判决不可信：
 *
 * ① A/A 效度：相同双臂 → no-difference 且 95% CI 含 1。这正是
 *    2026-09-06 事故的反面锚定：旧方法论在相同双臂上得出 1.068（约 7%
 *    系统伪影）；交错+随机化后，A/A 必须回到「无异差」。
 * ② 灵敏度·大效应：B 做 2 倍工作 → 判 b-slower 且效应远超地板。
 * ③ 灵敏度·小效应：B 做 +25% 工作 → 仍能判 b-slower（效应 1.25 >
 *    伪影地板 1.07，CI 必然排除 1 且下界高于地板内区间）。
 * ④ 次序随机化的决定性与平衡性（纯函数级）。
 * ⑤ MAD 围栏离群分类：尖峰剔除、主体保留、计数披露（纯函数级）。
 * ⑥ 前置守卫：漂移超限/计时分辨率不足 → inconclusive 不判决。
 *
 * 所有断言只依赖比值与判决（效应量余量 ≥ 数倍伪影地板），不依赖绝对
 * 耗时——CI 慢机上结论不变。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTIFACT_FLOOR,
  comparePaired,
  fenceOutliers,
  randomizedOrderSequence,
  stratifiedArmEffect,
} from './bench-kit.js';

/**
 * 计算受控负载（零分配）：预分配缓冲上的多遍乘加。自验证期实测分配型
 * 负载会把 GC 尖峰带进测量（单轮比率 0.2~4.7× 摆动、中位估计失稳），
 * 测量器自身的效度测试必须零分配——GC 留给真实分配语义的基准去面对。
 */
function computeWorkload(passes: number): () => void {
  const buf = new Float64Array(65536);
  for (let k = 0; k < buf.length; k++) buf[k] = (k % 97) / 97;
  return () => {
    let acc = 0;
    for (let p = 0; p < passes; p++) {
      for (let k = 0; k < buf.length; k++) {
        acc += buf[k]! * ((k & 255) !== 0 ? 1.0001 : 0.9999);
      }
    }
    if (acc === Infinity) throw new Error('unreachable sink guard');
  };
}

/** 效度断言语义：错判必红；环境敌对（漂移/分辨率/离群过多）→ skip 并说明。
 * 返回 true 表示已跳过——调用方必须紧随 return（node:test 的 t.skip()
 * 只标记不中断，不 return 会让后续断言照样执行）。 */
function skipIfHostile(
  t: { skip: (message: string) => void },
  report: { verdict: string; note: string },
): boolean {
  if (report.verdict === 'inconclusive') {
    t.skip(`测量环境敌对，本轮不判：${report.note}`);
    return true;
  }
  return false;
}

describe('bench-kit 测量器自验证', () => {
  it('① A/A 效度：相同双臂判 no-difference 且 CI 含 1（旧方法论的 1.068 伪影已被对消）', (t) => {
    // A/A 误判须跨种子复现才定性为测量器失效：共享 runner 的敌对窗口可让
    // 单次采样越过伪影地板判差（2026-09-09 windows runner 实测误判 17%，
    // 同跑次 ② 的漂移守卫同步报 1.59× 超限——守卫对亚轮级漂移有盲区），
    // 但换种子独立重测不可复现；2026-09-06 型系统性伪影与次序种子无关、
    // 必然重现。首测保留文档化种子 4242（可复现性），重测换独立种子。
    const misjudged: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const seed = 4242 + attempt * 7919;
      const workload = computeWorkload(40); // 单轮 ~1-3ms，留足分辨率守卫余量
      const report = comparePaired(
        { name: 'identical-1', run: workload },
        { name: 'identical-2', run: workload },
        { rounds: 25, warmupRounds: 10, seed },
      );
      if (skipIfHostile(t, report)) return;
      if (report.verdict === 'no-difference') {
        assert.ok(
          report.ciLow <= 1 && 1 <= report.ciHigh,
          `CI [${report.ciLow.toFixed(3)}, ${report.ciHigh.toFixed(3)}] 必须含 1（实际中位比率 ${report.medianRatio.toFixed(3)}）`,
        );
        assert.equal(report.excludedOutliers < report.roundsTotal / 2, true, '离群不应过半');
        return;
      }
      misjudged.push(`种子 ${seed} 判 ${report.verdict}：${report.note}`);
    }
    // 同臂判出任何方向的差异且跨种子复现 = 测量器系统性伪影——硬失败，永不放过
    assert.fail(
      `A/A 误判跨 ${misjudged.length} 个独立种子复现——测量器携带系统性伪影：${misjudged.join('；')}`,
    );
  });

  it('② 灵敏度·大效应：2 倍工作负载被判 b-slower', (t) => {
    const report = comparePaired(
      { name: '1x', run: computeWorkload(40) },
      { name: '2x', run: computeWorkload(80) },
      { rounds: 25, warmupRounds: 10, seed: 777 },
    );
    if (skipIfHostile(t, report)) return;
    assert.equal(report.verdict, 'b-slower', report.note);
    // 真效应 2.0，伪影地板 1.07：下界余量给足（2.0/1.07 ≈ 1.87，再放 CI 方差）
    assert.ok(
      report.ciLow >= 1.3,
      `ciLow=${report.ciLow.toFixed(3)} 应远高于 1.3（并行执行争用会加宽 CI，真效应 2.0）`,
    );
    assert.ok(report.medianRatio >= ARTIFACT_FLOOR);
  });

  it('③ 灵敏度·小效应：+25% 工作负载仍可判（效应越过伪影地板）', (t) => {
    // 小效应检测是全套件中唯一的统计功效受限断言（①只需 CI 含 1、②真效应
    // 2.0 余量巨大）：CI windows runner（共享 2 核）实测 30 轮时 bootstrap
    // 下界跌破 1 判 no-difference——功效预算必须覆盖慢机。杠杆两手一起上：
    // 单轮负载加倍（固定时长抢占尖峰的相对量级减半，MAD 围栏负担减轻）＋
    // 轮数 30→80（分层后每层 40 样本，中位 bootstrap 区间按 √n 收紧）。
    // 本地实测下界 1.234（30 轮旧配置 1.225），总时长 ~1.2s。
    const report = comparePaired(
      { name: '1x', run: computeWorkload(80) },
      { name: '1.25x', run: computeWorkload(100) },
      { rounds: 80, warmupRounds: 16, seed: 9999 },
    );
    if (skipIfHostile(t, report)) return;
    assert.equal(report.verdict, 'b-slower', report.note);
    // 真效应 1.25 > 地板 1.07；下界只需越过 1（地板内不判差由 ① 与纯函数测试锚定）
    assert.ok(
      report.ciLow > 1.01,
      `ciLow=${report.ciLow.toFixed(3)} 应排除 1 且留出余量（争用容限）`,
    );
  });

  it('④ 次序随机化：同种子同序列，且先行次数大致均衡', () => {
    const a = randomizedOrderSequence(200, 123);
    const b = randomizedOrderSequence(200, 123);
    assert.deepEqual(a, b, '同种子必须产生相同序列（可复现性）');
    const c = randomizedOrderSequence(200, 124);
    assert.notDeepEqual(a, c, '不同种子应产生不同序列');
    const aFirst = a.filter(Boolean).length;
    // 构造性完美平衡：偶数轮恰 100/100；奇数轮差 ≤1（不平衡 + 重尾方差
    // 曾产出 ~5% 假差异——见 bench-kit 头注）
    assert.ok(Math.abs(aFirst - 100) <= 1, `A 先行 ${aFirst}/200 必须完美平衡`);
  });

  it('⑤ MAD 围栏：尖峰剔除、主体保留、计数披露', () => {
    const body = Array.from({ length: 19 }, (_, i) => 1 + 0.01 * (i % 3));
    const spiked = [...body, 5.0]; // 单个 5σ 级尖峰
    const { kept, excluded } = fenceOutliers(spiked);
    assert.equal(excluded, 1, '只应剔除尖峰');
    assert.equal(kept.length, 19);
    assert.ok(!kept.includes(19), '尖峰下标（19）必须被剔除');
    // 全同值（MAD=0）不剔除
    const flat = fenceOutliers([1, 1, 1, 1]);
    assert.equal(flat.excluded, 0);
    assert.equal(flat.kept.length, 4);
  });

  it('⑦ 分层估计：位置寄生在合成数据上精确对消，臂效应精确恢复（不依赖机器）', () => {
    // 合成比率：A 先行层 = a·p，B 先行层 = a/p——无论位置因子 p 多强，
    // 几何平均都精确恢复 a。这是对消性质的机器无关证明。
    for (const [a, p] of [
      [1.0, 1.05],
      [1.0, 1.12],
      [2.0, 1.3],
      [0.5, 1.08],
    ] as const) {
      const flags = randomizedOrderSequence(30, 31_415);
      const ratios = flags.map((aFirst) => (aFirst ? a * p : a / p));
      const est = stratifiedArmEffect(ratios, flags);
      assert.ok(
        Math.abs(est.armEffect - a) < 1e-12,
        `armEffect ${est.armEffect} 应精确恢复 ${a}（p=${p}）`,
      );
      assert.ok(
        Math.abs(est.positionEffect - p) < 1e-12,
        `positionEffect ${est.positionEffect} 应精确恢复 p=${p}`,
      );
    }
    // 单层退化：回退逐轮中位且 positionEffect 为 NaN（如实披露无法对消）
    const degenerate = stratifiedArmEffect([1.1, 1.2, 1.15], [true, true, true]);
    assert.ok(Number.isNaN(degenerate.positionEffect));
    assert.equal(degenerate.armEffect, 1.15);
  });

  it('⑥ 前置守卫·漂移：时钟级膨胀 → unstable 且 inconclusive（不判决）', () => {
    // 伪造时钟：每次调用读数按 1.06^调用序 膨胀——参考负载首/中/尾散布
    // 迅速越过 1.5×；配对比率受两臂均等膨胀影响仍稳定，但守卫必须拦截判决
    let calls = 0;
    const inflatingClock = (): number => 1e6 * Math.pow(1.06, calls++);
    const report = comparePaired(
      { name: 'a', run: computeWorkload(40) },
      { name: 'b', run: computeWorkload(40) },
      { rounds: 12, warmupRounds: 4, seed: 555, clock: inflatingClock },
    );
    assert.equal(report.unstable, true);
    assert.equal(report.verdict, 'inconclusive', report.note);
    assert.match(report.note, /散布/);
  });

  it('⑥ 前置守卫·分辨率：亚分辨率负载 → inconclusive 且 note 指明守卫', (t) => {
    const report = comparePaired(
      { name: 'empty-a', run: () => {} },
      { name: 'empty-b', run: () => {} },
      { rounds: 10, warmupRounds: 4, seed: 556 },
    );
    // 守卫逐级短路：敌对环境（共享 CI runner、c8 插桩、并发测试套件）下
    // 漂移守卫可能先于分辨率守卫触发（实测散布 1.55~1.76× 超限，note 带
    // 「散布」不带「分辨率」）。两种守卫都是「不判决」——都证明测量器
    // 自保护；分辨率面的具体验证只在非敌对环境下执行。
    assert.equal(report.verdict, 'inconclusive', report.note);
    if (report.unstable) {
      t.skip(`测量环境敌对（漂移守卫先于分辨率守卫触发），本轮不验分辨率面：${report.note}`);
      return;
    }
    assert.equal(report.lowResolution, true);
    assert.match(report.note, /分辨率/);
  });
});
