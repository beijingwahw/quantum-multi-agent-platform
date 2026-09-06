/**
 * 任务三（01#18）三变量 A/B/C 交错基准：descent 循环的两种改法 vs 基线。
 *   old    = HEAD 基线（slice 副本 + [1,-1] 字面量 + splice 回写）
 *   minimal= 仅提升符号常量（保留 slice/splice 语义）
 *   inplace= 当前实现（原位探针 + 回写恢复）
 * 三者逐位同值；本基准裁决 wall time。交替执行，机器漂移均等。
 */
import * as oldCommon from './baseline/src/core/solver-common.js';
import * as minCommon from './minimal/src/core/solver-common.js';
import * as newCommon from '../ds/src/core/solver-common.js';
import { mulberry32 as oldRng } from './baseline/src/utils/rng.js';

type Common = typeof oldCommon;

function timeMs(fn: () => void): number {
  const t0 = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

function descentMicro(common: Common): { ms: number; evals: number } {
  const evaluate = (a: number[]): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i]! * a[i]! * (i + 1);
    return s;
  };
  let sink = 0;
  const ms = timeMs(() => {
    for (let iter = 0; iter < 2000; iter++) {
      const r = common.optimizeAnglesByCoordinateDescent(evaluate, 4, 3, oldRng(42));
      sink += r.evaluations;
    }
  });
  return { ms, evals: sink };
}

function seededMicro(common: Common): { ms: number; evals: number } {
  const evaluate = (a: number[]): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i]! * a[i]! * (i + 1);
    return s;
  };
  const bounds = Array.from({ length: 12 }, (_, i) => (i < 4 ? Math.PI : Math.PI / 2));
  let sink = 0;
  const ms = timeMs(() => {
    for (let iter = 0; iter < 1500; iter++) {
      const r = common.optimizeAnglesByCoordinateDescentSeeded(
        evaluate,
        12,
        bounds,
        2,
        oldRng(7),
        [0.4, 0.4, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2],
      );
      sink += r.evaluations;
    }
  });
  return { ms, evals: sink };
}

const variants: Array<[string, Common]> = [
  ['old    ', oldCommon],
  ['minimal', minCommon],
  ['inplace', newCommon],
];

console.log('node', process.version);
for (const [bench, fn] of [
  ['descent-micro (2000x)', descentMicro],
  ['seeded-micro (1500x)', seededMicro],
] as Array<[string, (c: Common) => { ms: number; evals: number }]>) {
  for (const [, c] of variants) fn(c); // 预热
  const results = new Map<string, number[]>();
  const evals = new Map<string, number>();
  for (let round = 0; round < 4; round++) {
    for (const [name, c] of variants) {
      const r = fn(c);
      (results.get(name) ?? results.set(name, []).get(name)!).push(r.ms);
      evals.set(name, r.evals);
    }
  }
  const line = variants
    .map(([name]) => {
      const runs = results.get(name)!;
      return `${name}=${Math.min(...runs).toFixed(1)}ms`;
    })
    .join('  ');
  const evalLine = [...evals.entries()].map(([n, e]) => `${n}:${e}`).join(' ');
  console.log(`${bench}  ${line}   evals ${evalLine}`);
}
