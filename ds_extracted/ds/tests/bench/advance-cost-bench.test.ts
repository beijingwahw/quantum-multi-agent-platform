/**
 * advanceCostKernel 4× ILP 展开的位级等价锚定 + A/B 基准。
 *
 * 展开的合法性前提：元素间零数据依赖（相位递推逐元素独立、振幅复乘
 * 逐元素独立），展开只交错执行顺序、不改任何元素的表达式——本文件
 * ① 用标量参考实现逐位锚定该性质（含尾部/偏移/退化区间形态）；
 * ② 用 bench-kit（伪影对消测量器）实测展开收益，A/A 控制当次效度。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { advanceCostKernel } from '../../src/core/fiber-kernel.js';
import { mulberry32 } from '../../src/utils/rng.js';
import { comparePaired } from './bench-kit.js';

/** 标量参考实现：展开前的逐元素形态（就地复刻，防漂移） */
function advanceCostKernelScalar(
  re: Float64Array,
  im: Float64Array,
  phRe: Float64Array,
  phIm: Float64Array,
  zRe: Float64Array,
  zIm: Float64Array,
  lo: number,
  hi: number,
): void {
  for (let k = lo; k < hi; k++) {
    const pr = phRe[k]!;
    const pi = phIm[k]!;
    const zr = zRe[k]!;
    const zi = zIm[k]!;
    const nr = pr * zr - pi * zi;
    const ni = pr * zi + pi * zr;
    phRe[k] = nr;
    phIm[k] = ni;
    const r = re[k]!;
    const iv = im[k]!;
    re[k] = r * nr - iv * ni;
    im[k] = r * ni + iv * nr;
  }
}

interface KernelState {
  re: Float64Array;
  im: Float64Array;
  phRe: Float64Array;
  phIm: Float64Array;
  zRe: Float64Array;
  zIm: Float64Array;
}

function seededState(dim: number, seed: number): KernelState {
  const rng = mulberry32(seed);
  const uniformPhase = (): number => rng() * 2 - 1;
  const state = {
    re: new Float64Array(dim),
    im: new Float64Array(dim),
    phRe: new Float64Array(dim),
    phIm: new Float64Array(dim),
    zRe: new Float64Array(dim),
    zIm: new Float64Array(dim),
  };
  for (let k = 0; k < dim; k++) {
    state.re[k] = uniformPhase();
    state.im[k] = uniformPhase();
    state.phRe[k] = uniformPhase();
    state.phIm[k] = uniformPhase();
    // z 为单位相位因子（与退火用法一致）：|z|=1 保持幺正
    const theta = rng() * 0.01;
    state.zRe[k] = Math.cos(theta);
    state.zIm[k] = Math.sin(theta);
  }
  return state;
}

function cloneState(s: KernelState): KernelState {
  return {
    re: new Float64Array(s.re),
    im: new Float64Array(s.im),
    phRe: new Float64Array(s.phRe),
    phIm: new Float64Array(s.phIm),
    zRe: new Float64Array(s.zRe),
    zIm: new Float64Array(s.zIm),
  };
}

describe('advanceCostKernel 4× ILP 展开锚定', () => {
  it('位级等价：展开版与标量参考在全部区间形态上逐位一致', () => {
    const shapes: Array<[number, number, number]> = [
      // [dim, lo, hi]：对齐 4 / 三种尾部 / 非零起点偏移 / 退化空区间
      [4096, 0, 4096],
      [4099, 0, 4099], // 尾 3
      [4098, 0, 4098], // 尾 2
      [4097, 0, 4097], // 尾 1
      [8192, 1000, 8192], // 非零 lo（尾部 + 偏移组合）
      [8192, 3, 8189], // 两端偏移
      [64, 7, 7], // 空区间
      [64, 7, 8], // 单元素
    ];
    for (const [dim, lo, hi] of shapes) {
      const a = seededState(dim, dim * 31 + lo * 7 + hi);
      const b = cloneState(a);
      advanceCostKernelScalar(a.re, a.im, a.phRe, a.phIm, a.zRe, a.zIm, lo, hi);
      advanceCostKernel(b.re, b.im, b.phRe, b.phIm, b.zRe, b.zIm, lo, hi);
      assert.deepEqual(
        { re: a.re, im: a.im, phRe: a.phRe, phIm: a.phIm },
        { re: b.re, im: b.im, phRe: b.phRe, phIm: b.phIm },
        `dim=${dim} lo=${lo} hi=${hi} 应逐位一致（z 未被内核写入）`,
      );
      assert.deepEqual(a.zRe, b.zRe);
      assert.deepEqual(a.zIm, b.zIm);
    }
  });

  it('多步退火链路等价：连续 20 步推进后仍逐位一致（递推累积也一致）', () => {
    const dim = 65536;
    const a = seededState(dim, 777);
    const b = cloneState(a);
    for (let step = 0; step < 20; step++) {
      advanceCostKernelScalar(a.re, a.im, a.phRe, a.phIm, a.zRe, a.zIm, 0, dim);
      advanceCostKernel(b.re, b.im, b.phRe, b.phIm, b.zRe, b.zIm, 0, dim);
    }
    assert.deepEqual(
      { re: a.re, im: a.im, phRe: a.phRe, phIm: a.phIm },
      { re: b.re, im: b.im, phRe: b.phRe, phIm: b.phIm },
    );
  });

  it('A/B：标量内核与参考实现无判差（4× ILP 已实测为负收益并回退——见 fiber-kernel 注记）', (t) => {
    const dim = 65536;
    const stateA = seededState(dim, 4242);
    const stateB = cloneState(stateA);
    const runs = 12; // 单臂一轮的工作量：12 次全维度推进（~2-5ms）

    const aa = comparePaired(
      {
        name: 'unrolled-1',
        run: () => {
          for (let s = 0; s < runs; s++) {
            advanceCostKernel(
              stateA.re,
              stateA.im,
              stateA.phRe,
              stateA.phIm,
              stateA.zRe,
              stateA.zIm,
              0,
              dim,
            );
          }
        },
      },
      {
        name: 'unrolled-2',
        run: () => {
          for (let s = 0; s < runs; s++) {
            advanceCostKernel(
              stateA.re,
              stateA.im,
              stateA.phRe,
              stateA.phIm,
              stateA.zRe,
              stateA.zIm,
              0,
              dim,
            );
          }
        },
      },
      { rounds: 25, warmupRounds: 8, seed: 101 },
    );
    if (aa.verdict === 'inconclusive') {
      t.skip(`A/A 控制遇敌对环境：${aa.note}`);
      return;
    }
    assert.equal(aa.verdict, 'no-difference', aa.note);

    const report = comparePaired(
      {
        name: 'scalar-baseline',
        run: () => {
          for (let s = 0; s < runs; s++) {
            advanceCostKernelScalar(
              stateB.re,
              stateB.im,
              stateB.phRe,
              stateB.phIm,
              stateB.zRe,
              stateB.zIm,
              0,
              dim,
            );
          }
        },
      },
      {
        name: 'ilp-unrolled',
        run: () => {
          for (let s = 0; s < runs; s++) {
            advanceCostKernel(
              stateB.re,
              stateB.im,
              stateB.phRe,
              stateB.phIm,
              stateB.zRe,
              stateB.zIm,
              0,
              dim,
            );
          }
        },
      },
      { rounds: 25, warmupRounds: 8, seed: 202 },
    );
    if (report.verdict === 'inconclusive') {
      t.skip(`测量环境敌对，本轮不判：${report.note}`);
      return;
    }
    assert.equal(report.verdict, 'no-difference', report.note);
    // 判决语义已含地板纪律：亚地板效应（区间排除 1 但效应量 < 1.07×）
    // 判 no-difference——c8 插桩对两种代码形状的计数交错可产生 1~3% 的
    // 真实微偏（CI 慢机实测），旧「CI 必含 1」断言比测量器自己的合同
    // 更严。效应 ≥ 地板且区间排除 1 时 verdict 会翻成 b-slower/faster，
    // 由上面的判决断言拦截——本测试只锚定「无判差」。
  });
});
