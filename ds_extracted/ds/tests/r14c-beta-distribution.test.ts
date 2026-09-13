/**
 * R14-C 创新 1a：Beta 分布数值内核的正确性锚点 + 负对照
 *
 * 锚点全部取解析已知的值（lgamma 的整数/半整数点、Beta(1,1)/Beta(1,3)/
 * Beta(2,2) 的闭式 CDF 与分位数、对偶恒等式、逆-正往返），不依赖外部
 * 统计库——本仓零依赖约束下的自证式验收。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lgamma,
  logBeta,
  betaCdf,
  betaQuantile,
} from '../src/proactive-intelligence/beta-distribution.js';
import { NumericDomainError } from '../src/utils/errors.js';

describe('beta-distribution · lgamma / logBeta', () => {
  it('lgamma 解析点：Γ(1)=Γ(2)=1、Γ(0.5)=√π、Γ(6)=120', () => {
    assert.ok(Math.abs(lgamma(1)) < 1e-12, `lgamma(1)=${lgamma(1)}`);
    assert.ok(Math.abs(lgamma(2)) < 1e-12, `lgamma(2)=${lgamma(2)}`);
    assert.ok(
      Math.abs(lgamma(0.5) - 0.5 * Math.log(Math.PI)) < 1e-13,
      `lgamma(0.5)=${lgamma(0.5)}`,
    );
    assert.ok(Math.abs(lgamma(6) - Math.log(120)) < 1e-12, `lgamma(6)=${lgamma(6)}`);
    // 反射路径的相对点：lgamma(0.25) 无初等闭式，但与 lgamma(0.75) 由
    // 反射公式锁定：lgamma(x)+lgamma(1−x) = ln(π/sin(πx))，x=0.25
    const lhs = lgamma(0.25) + lgamma(0.75);
    const rhs = Math.log(Math.PI / Math.sin(Math.PI * 0.25));
    assert.ok(Math.abs(lhs - rhs) < 1e-12, `反射恒等式：${lhs} vs ${rhs}`);
  });

  it('logBeta：B(2,3)=1/12、B(1,1)=1、对称性（a,b 交换逐位相等）', () => {
    assert.ok(Math.abs(logBeta(2, 3) + Math.log(12)) < 1e-12, `logBeta(2,3)=${logBeta(2, 3)}`);
    assert.ok(Math.abs(logBeta(1, 1)) < 1e-12, `logBeta(1,1)=${logBeta(1, 1)}`);
    for (const [a, b] of [
      [0.5, 0.5],
      [1.5, 3],
      [7, 0.3],
      [100, 80],
    ] as Array<[number, number]>) {
      assert.ok(
        Object.is(logBeta(a, b), logBeta(b, a)),
        `logBeta(${a},${b}) 与交换形应逐位相等（加法交换）`,
      );
    }
  });

  it('负对照：非正/NaN 形状参数指名拒绝（NumericDomainError）', () => {
    for (const bad of [0, -1, Number.NaN, Infinity, -Infinity]) {
      assert.throws(
        () => lgamma(bad),
        (error: unknown) =>
          error instanceof NumericDomainError && error.message.includes(`got ${String(bad)}`),
        `lgamma(${String(bad)}) 应指名拒绝`,
      );
    }
    assert.throws(() => logBeta(0, 1), /shape parameter 'a'.*got 0/);
    assert.throws(() => logBeta(1, -2), /shape parameter 'b'.*got -2/);
  });
});

describe('beta-distribution · betaCdf', () => {
  it('解析 CDF：Beta(1,1)=均匀、Beta(1,3) 的 1−(1−x)³、Beta(2,2) 在 1/2 处为 1/2', () => {
    for (const x of [0.1, 0.25, 0.5, 0.77, 0.99]) {
      assert.ok(Math.abs(betaCdf(x, 1, 1) - x) < 1e-13, `Beta(1,1) CDF(${x})`);
      const closed = 1 - (1 - x) ** 3;
      assert.ok(Math.abs(betaCdf(x, 1, 3) - closed) < 1e-12, `Beta(1,3) CDF(${x})`);
    }
    assert.ok(Math.abs(betaCdf(0.5, 2, 2) - 0.5) < 1e-13, '对称分布在 1/2 处 CDF=1/2');
  });

  it('边界与对偶：x∈{0,1} 精确；I_x(a,b)+I_{1−x}(b,a)=1', () => {
    assert.equal(betaCdf(0, 2, 5), 0);
    assert.equal(betaCdf(1, 2, 5), 1);
    for (const [a, b, x] of [
      [0.5, 0.5, 0.3],
      [1.5, 4.5, 0.62],
      [100, 80, 0.45],
      [0.3, 7, 0.05],
    ] as Array<[number, number, number]>) {
      const s = betaCdf(x, a, b) + betaCdf(1 - x, b, a);
      assert.ok(Math.abs(s - 1) < 1e-11, `对偶恒等式 (a=${a},b=${b},x=${x})：${s}`);
    }
  });

  it('负对照：x 越界/NaN 指名拒绝', () => {
    assert.throws(() => betaCdf(-0.01, 1, 1), /must be within \[0, 1\], got -0.01/);
    assert.throws(() => betaCdf(1.01, 2, 2), /got 1.01/);
    assert.throws(() => betaCdf(Number.NaN, 2, 2), /got NaN/);
  });
});

describe('beta-distribution · betaQuantile', () => {
  it('解析分位数：Beta(1,1) 恒等映射、Beta(2,2) 中位数 1/2、Beta(1,3) 的 0.875 分位', () => {
    for (const p of [0.05, 0.3, 0.5, 0.8]) {
      assert.ok(Math.abs(betaQuantile(p, 1, 1) - p) < 1e-12, `Beta(1,1) 分位(${p})`);
    }
    assert.ok(Math.abs(betaQuantile(0.5, 2, 2) - 0.5) < 1e-9, 'Beta(2,2) 中位数');
    // F(x)=1−(1−x)³=0.875 ⟺ x=0.5
    assert.ok(Math.abs(betaQuantile(0.875, 1, 3) - 0.5) < 1e-9, 'Beta(1,3) 0.875 分位');
  });

  it('逆-正往返：F(quantile(p)) = p 在 (a,b)×p 网格上 < 1e-9', () => {
    for (const [a, b] of [
      [0.5, 0.5],
      [1.5, 1.5],
      [5, 2],
      [100, 80],
      [0.3, 7],
      [1, 3],
    ] as Array<[number, number]>) {
      for (const p of [0.01, 0.1, 0.5, 0.9, 0.99]) {
        const q = betaQuantile(p, a, b);
        const roundTrip = betaCdf(q, a, b);
        assert.ok(
          Math.abs(roundTrip - p) < 1e-9,
          `(a=${a},b=${b},p=${p})：F(${q.toPrecision(10)})=${roundTrip} 偏离 ${p}`,
        );
      }
    }
  });

  it('单调性与边界：分位数对 p 单调不减；p∈{0,1} 为精确端点', () => {
    assert.equal(betaQuantile(0, 3, 3), 0);
    assert.equal(betaQuantile(1, 3, 3), 1);
    let prev = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const q = betaQuantile(Math.min(p, 1), 2.5, 4);
      assert.ok(q >= prev - 1e-15, `p=${p.toFixed(2)} 分位数 ${q} 破坏单调性`);
      prev = q;
    }
  });

  it('负对照：p 越界/NaN 指名拒绝', () => {
    assert.throws(() => betaQuantile(-0.1, 1, 1), /must be within \[0, 1\], got -0.1/);
    assert.throws(() => betaQuantile(1.2, 1, 1), /got 1.2/);
    assert.throws(() => betaQuantile(Number.NaN, 1, 1), /got NaN/);
    assert.throws(() => betaQuantile(0.5, 0, 1), /shape parameter 'a'.*got 0/);
  });
});
