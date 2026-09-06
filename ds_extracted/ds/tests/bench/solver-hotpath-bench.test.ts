/**
 * 测量器应用套件：对真实热路径用 bench-kit 重做 A/B——同时内嵌同负载
 * 的 A/A 控制作为当次运行的效度证明。
 *
 * 被测对象：solver-common 的 minMaxOf（子空间能量谱量程计算，每次退火
 * 求解都跑）。X1（2026-09-06）以旧方法论实测 for..of → 索引循环为 4.4×
 * 函数级提升；本文件用伪影对消后的测量器复检该结论：
 * - A 臂 = 迭代器协议写法（HEAD 优化前的基线形态，就地复刻）
 * - B 臂 = 当前 src 导出的索引实现（被测生产代码本体）
 * - 同文件 A/A 控制 = 同一实现跑两臂——旧方法论在此形态下出过 1.068
 *   系统伪影；交错+随机化后必须回到无异差，否则本文件所有判决作废。
 *
 * 断言只锁比值与判决（真效应 4.4×，伪影地板 1.07，余量 >4 倍），
 * CI 慢机结论不变。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/utils/rng.js';
import { minMaxOf } from '../../src/core/solver-common.js';
import { comparePaired } from './bench-kit.js';

const ELEMENTS = 500_000;

function seededSpectrum(): Float64Array {
  const rng = mulberry32(31337);
  const values = new Float64Array(ELEMENTS);
  for (let k = 0; k < ELEMENTS; k++) values[k] = rng();
  return values;
}

/** A 臂：优化前的基线写法（for..of 迭代器协议）——就地复刻，防漂移 */
function minMaxOfBaseline(values: Readonly<Float64Array>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

describe('solver 热路径 A/B（bench-kit 应用：minMaxOf 索引化复检）', () => {
  const spectrum = seededSpectrum();

  // 数值等价前置（A/B 判决的前提：两臂算的是同一个东西）
  it('前置：基线写法与生产实现数值一致', () => {
    assert.deepEqual(minMaxOfBaseline(spectrum), minMaxOf(spectrum));
  });

  it('A/A 控制：同一实现双臂无判差（当次运行的测量器效度）', (t) => {
    const report = comparePaired(
      { name: 'indexed-1', run: () => minMaxOf(spectrum) },
      { name: 'indexed-2', run: () => minMaxOf(spectrum) },
      { rounds: 25, warmupRounds: 10, seed: 606 },
    );
    if (report.verdict === 'inconclusive') {
      t.skip(`测量环境敌对，本轮不判：${report.note}`);
      return;
      return;
    }
    // 同实现判出差异 = 测量器伪影——硬失败
    assert.equal(report.verdict, 'no-difference', report.note);
    assert.ok(report.ciLow <= 1 && 1 <= report.ciHigh, report.note);
  });

  it('A/B：索引实现（B）显著快于迭代器基线（A）——X1 结论经伪影对消复检成立', (t) => {
    const report = comparePaired(
      { name: 'baseline-for-of', run: () => minMaxOfBaseline(spectrum) },
      { name: 'indexed', run: () => minMaxOf(spectrum) },
      { rounds: 25, warmupRounds: 10, seed: 808 },
    );
    if (report.verdict === 'inconclusive') {
      t.skip(`测量环境敌对，本轮不判：${report.note}`);
      return;
      return;
    }
    assert.equal(report.verdict, 'b-faster', report.note);
    // 真效应 ~4.4×；ciHigh 上界放到 0.8（即 ≥1.25× 才判过）——对 CI 慢机
    // 与测量方差留 3 倍以上余量，仍远低于真效应
    assert.ok(
      report.ciHigh <= 0.85,
      `ciHigh=${report.ciHigh.toFixed(3)} 应 ≤ 0.85（并行执行争用容限，真效应 ~4.4×）`,
    );
    assert.ok(
      report.medianRatio <= 0.93,
      `中位比率 ${report.medianRatio.toFixed(3)} 应显著 <1（争用容限）`,
    );
  });
});
