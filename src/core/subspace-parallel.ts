/**
 * subspace-parallel —— 子空间绝热退火的多线程确定性并行内核。
 *
 * ============ 设计陈述 ============
 *
 * 退火演化的两个算符天然可并行：
 * 1. 纤维混合：纤维之间无共享元素 ⇒ 按纤维区间划分给各 Worker；
 * 2. 代价相位递推：元素之间独立 ⇒ 按元素区间划分。
 *
 * **确定性并行**：任何单纤维/单元素的计算由且仅由一个线程完成，串行与
 * 并行路径调用同一份内核源码（fiber-kernel 的函数经 toString 序列化进
 * Worker），浮点结果与线程调度无关、与串行路径**逐位一致**——这不是
 * 近似并行，而是精确同一条数值轨迹。
 *
 * 协议（Atomics 售票 + 屏障，全程同步无事件循环依赖）：
 * - 主线程把 op/组号/β 写入共享 header，递增票据 seq 并 notify；
 * - Worker 在 seq 上 Atomics.wait 醒来，计算自己划分的区间，Atomics.add
 *   完成计数；
 * - 主线程在完成计数上等待全体，进入下一算符。同步退火循环里主线程
 *   Atomics.wait 合法（Node 允许主线程等待；Worker 各自有独立事件循环）。
 *
 * 内存：态矢量/相位递推/纤维 order-runs 全部落在 SharedArrayBuffer 上，
 * 各 Worker 以视图零拷贝共享（order/runs 共 58MB @ 8×10，逐 Worker 复制
 * 不可行）。Worker 按次求解创建、用后即终，无跨调用状态。
 *
 * 失败语义：任何环节（创建/握手/分发超时）失败即终止全部 Worker 并返回
 * null，调用方回退串行路径——功能永不中断，只是变慢。
 */

import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { applyFiberRunsKernel, advanceCostKernel, buildFiberGroupKernel } from './fiber-kernel';
import type { SubspaceModel } from './subspace-optimizer';

/** 并行启用的最小维度（低于此值每步 9 次屏障的延迟支配收益，串行更快） */
const PARALLEL_MIN_DIM = 1 << 19;
/** Worker 数上限（浮点内核按物理核扩展，超线程与 E 核收益递减） */
const MAX_WORKERS = 16;

/** header（SharedArrayBuffer，64 字节）的字段布局 */
const OP = 0; // 1=纤维混合 2=代价相位 3=关闭
const GROUP = 1;
const SEQ = 2;
const DONE = 3;
const READY = 4;
/**
 * 入栏计数：Worker 先捕获 seq 基线再自增本计数，主线程等到全体入栏才首次
 * 分发——否则主线程可能在 Worker 捕获基线之前递增 seq，该 Worker 会把
 * 进行中的票据当作基线而错过一次分发（Atomics.wait 的入队检查是原子的，
 * 基线捕获与入栏声明的先后次序消除整类竞态）。
 */
const WAITING = 5;
/**
 * Worker 侧致命错误标志：主线程阻塞在 Atomics.wait 期间事件循环不转，
 * 'error' 事件无法送达——错误经共享内存直报（细节随后补发消息供日志）。
 */
const POISON = 6;
/**
 * Float64 通道：字节偏移 32 起（i32 槽 8+），与控制字段完全不重叠。
 * 曾把 Float64 视图建在偏移 0——写混合角 b 时 double 位模式直接覆写
 * OP/GROUP 两个控制字，Worker 全体错乱（教训：同 SAB 多视图必须显式错开）。
 */
const F64_BYTE_OFFSET = 32;
const F64_B = 0; // Float64 视图：混合角 b

function parallelEnabled(): boolean {
  return typeof Worker === 'function' && process.env.QUANTUM_DISABLE_PARALLEL !== '1';
}

function workerCount(dim: number, fibers: number): number {
  if (process.env.QUANTUM_WORKERS) return Math.max(1, +process.env.QUANTUM_WORKERS);
  const usable = Math.max(1, cpus().length - 1);
  return Math.max(2, Math.min(usable, MAX_WORKERS, dim, fibers));
}

/**
 * Worker 源码：内核函数从 fiber-kernel 序列化注入（同一份源码 = 逐位一致）。
 * 注意：Node 的 eval Worker 无 self 全局，消息入口用 parentPort
 * （此字符串在 Worker 内以 CommonJS 运行，require 可用）。
 */
function workerSource(): string {
  return (
    "'use strict';\n" +
    // esbuild(tsx)会给含嵌套函数的内核注入模块级 __name 辅助调用；函数体
    // 经 toString 序列化进 Worker 后该标识符不存在会 ReferenceError——
    // 前奏中提供与 esbuild 逐字同义的实现（tsc 构建路径无注入，纯冗余）。
    "const __name = (target, value) => Object.defineProperty(target, 'name', " +
    '{ value: value, configurable: true });\n' +
    "const parentPort = require('node:worker_threads').parentPort;\n" +
    `const applyFiberRunsKernel = ${applyFiberRunsKernel.toString()};\n` +
    `const advanceCostKernel = ${advanceCostKernel.toString()};\n` +
    `
let H = null, F = null, re = null, im = null, phRe = null, phIm = null, zRe = null, zIm = null;
let dim = 0, W = 0, rank = 0, groups = null;
parentPort.on('message', function (m) {
  if (m.type !== 'init') return;
  H = new Int32Array(m.header);
  F = new Float64Array(m.header, ${F64_BYTE_OFFSET}, 4);
  re = new Float64Array(m.re);
  im = new Float64Array(m.im);
  phRe = new Float64Array(m.phRe);
  phIm = new Float64Array(m.phIm);
  zRe = new Float64Array(m.zRe);
  zIm = new Float64Array(m.zIm);
  dim = m.dim;
  W = m.workers;
  rank = m.rank;
  groups = [];
  for (let i = 0; i < m.groups.length; i++) {
    groups.push({
      order: new Int32Array(m.groups[i].order.buf, m.groups[i].order.off, m.groups[i].order.len),
      runs: new Int32Array(m.groups[i].runs.buf, m.groups[i].runs.off, m.groups[i].runs.len),
    });
  }
  Atomics.add(H, ${READY}, 1);
  let last = Atomics.load(H, ${SEQ});
  Atomics.add(H, ${WAITING}, 1);
  try {
    for (;;) {
      Atomics.wait(H, ${SEQ}, last);
      last = Atomics.load(H, ${SEQ});
      const op = Atomics.load(H, ${OP});
      if (op === 3) break;
      if (op === 1) {
        const g = groups[Atomics.load(H, ${GROUP})];
        const b = F[${F64_B}];
        const fibers = g.runs.length >> 1;
        const lo = Math.floor((fibers * rank) / W) * 2;
        const hi = Math.floor((fibers * (rank + 1)) / W) * 2;
        applyFiberRunsKernel(re, im, g.order, g.runs, lo, hi, b);
      } else if (op === 2) {
        const lo = Math.floor((dim * rank) / W);
        const hi = Math.floor((dim * (rank + 1)) / W);
        advanceCostKernel(re, im, phRe, phIm, zRe, zIm, lo, hi);
      }
      Atomics.add(H, ${DONE}, 1);
      // Atomics.add 不唤醒等待者：显式 notify 让主线程立即出栏
      // （否则主线程只能等 50ms 超时轮询——1350 次分发 ≈ 67s 纯协议税）
      Atomics.notify(H, ${DONE}, 1);
    }
  } catch (e) {
    Atomics.store(H, ${POISON}, 1);
    parentPort.postMessage({
      type: 'worker-fatal',
      rank: rank,
      message: String((e && e.message) || e),
    });
    return;
  }
  process.exit(0);
});
`
  );
}

/**
 * 多线程绝热退火：返回末态振幅（SharedArrayBuffer 底座），失败返回 null
 * （调用方回退串行）。数值与串行路径逐位一致。
 */
export function parallelAnnealEvolve(
  model: SubspaceModel,
  energies: Float64Array,
  tau: number,
  steps: number,
): { re: Float64Array; im: Float64Array } | null {
  if (!parallelEnabled()) return null;
  const dim = model.dimension;
  const totalFibers = model.mixers.reduce((acc, g) => acc + (g.runs.length >> 1), 0);
  if (dim < PARALLEL_MIN_DIM || totalFibers === 0) return null;

  const W = workerCount(dim, totalFibers);
  const header = new SharedArrayBuffer(64);
  const H = new Int32Array(header);
  const F = new Float64Array(header, F64_BYTE_OFFSET, 4);

  const reBuf = new SharedArrayBuffer(dim * 8);
  const imBuf = new SharedArrayBuffer(dim * 8);
  const phReBuf = new SharedArrayBuffer(dim * 8);
  const phImBuf = new SharedArrayBuffer(dim * 8);
  const zReBuf = new SharedArrayBuffer(dim * 8);
  const zImBuf = new SharedArrayBuffer(dim * 8);
  const re = new Float64Array(reBuf);
  const im = new Float64Array(imBuf);
  // phRe 初值 1 / phIm 初值 0（SAB 零初始化）：仅填充，主线程无需保留视图
  new Float64Array(phReBuf).fill(1);
  const zRe = new Float64Array(zReBuf);
  const zIm = new Float64Array(zImBuf);

  // 均匀初态与代价相位步进因子 z = e^{−i·e·dt/steps}（主线程一次性写入）
  const amp = 1 / Math.sqrt(dim);
  const dtPerStep = tau / steps / steps;
  for (let k = 0; k < dim; k++) {
    re[k] = amp;
    const theta = energies[k]! * dtPerStep;
    zRe[k] = Math.cos(theta);
    zIm[k] = -Math.sin(theta);
  }

  const workers: Worker[] = [];
  let seq = 0;
  let poisoned = false;

  const terminateAll = (): void => {
    for (const w of workers) w.terminate().catch(() => undefined);
  };

  try {
    const src = workerSource();
    if (process.env.QUANTUM_PARALLEL_DEBUG) {
      console.error('[parallel] worker source bytes:', src.length);
    }
    for (let rank = 0; rank < W; rank++) {
      const w = new Worker(src, { eval: true });
      w.unref();
      w.on('error', (err) => {
        poisoned = true;
        if (process.env.QUANTUM_PARALLEL_DEBUG) {
          console.error(`[parallel] worker ${rank} error:`, err.message);
        }
      });
      w.on('exit', (code) => {
        if (process.env.QUANTUM_PARALLEL_DEBUG) {
          console.error(`[parallel] worker ${rank} exit code=${code}`);
        }
      });
      w.on('message', (msg: { type?: string; rank?: number; message?: string }) => {
        if (msg.type === 'worker-fatal') {
          poisoned = true;
          if (process.env.QUANTUM_PARALLEL_DEBUG) {
            console.error(`[parallel] worker ${msg.rank} fatal: ${msg.message}`);
          }
        }
      });
      workers.push(w);
      w.postMessage({
        type: 'init',
        header,
        re: reBuf,
        im: imBuf,
        phRe: phReBuf,
        phIm: phImBuf,
        zRe: zReBuf,
        zIm: zImBuf,
        dim,
        workers: W,
        rank,
        groups: model.mixers.map((g) => ({
          // 子视图必须显式传 byteOffset/length：runs 底座按上界分配，尾部未填充
          order: { buf: g.order.buffer, off: g.order.byteOffset, len: g.order.length },
          runs: { buf: g.runs.buffer, off: g.runs.byteOffset, len: g.runs.length },
        })),
      });
    }

    // 同步握手：等待全体 Worker 就绪并入栏（Worker 各自的事件循环独立运转）
    const readyDeadline = Date.now() + 10_000;
    while (Atomics.load(H, WAITING) < W) {
      // poisoned 由 error/worker-fatal 回调闭包改写——流分析看不见闭包赋值，
      // 此处的"恒假"是误报（见模块注释：阻塞等待期间事件无法送达恰恰依赖它兜底）
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (poisoned || Date.now() > readyDeadline) throw new Error('worker handshake timeout');
      Atomics.wait(H, WAITING, Atomics.load(H, WAITING), 50);
    }

    const dispatch = (op: number, group: number, b: number, budgetMs: number): boolean => {
      Atomics.store(H, DONE, 0);
      Atomics.store(H, GROUP, group);
      F[F64_B] = b;
      Atomics.store(H, OP, op);
      Atomics.store(H, SEQ, ++seq);
      Atomics.notify(H, SEQ, Infinity);
      const deadline = Date.now() + budgetMs;
      while (Atomics.load(H, DONE) < W) {
        if (Atomics.load(H, POISON) === 1) poisoned = true;
        if (poisoned || Date.now() > deadline) {
          if (process.env.QUANTUM_PARALLEL_DEBUG) {
            console.error(
              `[parallel] dispatch fail op=${op} group=${group} seq=${seq} done=${Atomics.load(H, DONE)}/${W} poisoned=${poisoned}`,
            );
          }
          return false;
        }
        Atomics.wait(H, DONE, Atomics.load(H, DONE), 50);
      }
      return true;
    };

    // 与串行路径完全一致的演化循环（H(s) = −(1−s)ΣA + sC，−A 方向支路）
    const dt = tau / steps;
    const stepBudget = Math.max(2_000, 30_000 / steps);
    for (let t = 1; t <= steps; t++) {
      const s = t / steps;
      for (let g = 0; g < model.mixers.length; g++) {
        if (!dispatch(1, g, -(1 - s) * dt, stepBudget)) throw new Error('mixer dispatch failed');
      }
      if (!dispatch(2, 0, 0, stepBudget)) throw new Error('cost dispatch failed');
    }

    Atomics.store(H, OP, 3);
    Atomics.store(H, SEQ, ++seq);
    Atomics.notify(H, SEQ, Infinity);
    return { re, im };
  } catch {
    terminateAll();
    return null;
  } finally {
    // Worker 已 unref：正常路径由 close() 自行退出，兜底强杀防止滞留
    setTimeout(() => {
      terminateAll();
    }, 1_000).unref();
  }
}

// ----------------------------------------------------------------------------
// 纤维组并行构建（build 阶段的 DFS2）
// ----------------------------------------------------------------------------

/** 构建并行的最小维度（组数少、无逐步屏障，阈值较演化宽松一档） */
const PARALLEL_BUILD_MIN_DIM = 1 << 18;

/** 构建结果：每组 {order 精确视图, runs 精确视图}，与串行内核逐位一致 */
export interface ParallelBuildResult {
  order: Int32Array;
  runs: Int32Array;
}

/** 构建专用 Worker 源码：一次 op=4 出发，各 Worker 按 g % W 领组，单屏障收尾 */
function buildWorkerSource(): string {
  return (
    "'use strict';\n" +
    "const __name = (target, value) => Object.defineProperty(target, 'name', " +
    '{ value: value, configurable: true });\n' +
    "const parentPort = require('node:worker_threads').parentPort;\n" +
    `const buildFiberGroupKernel = ${buildFiberGroupKernel.toString()};\n` +
    `
parentPort.on('message', function (m) {
  if (m.type !== 'init-build') return;
  const H = new Int32Array(m.header);
  const ineligible = new Uint8Array(m.ineligible);
  const sortedKeys = new Float64Array(m.sortedKeys.buf, m.sortedKeys.off, m.sortedKeys.len);
  const mm = m.m, nn = m.n, dim = m.dim;
  const W = m.workers, rank = m.rank;
  const groups = [];
  for (let i = 0; i < m.groups.length; i++) {
    groups.push({
      vary: new Int32Array(m.groups[i].vary),
      order: new Int32Array(m.groups[i].order),
      runs: new Int32Array(m.groups[i].runs),
      lens: new Int32Array(m.lens),
    });
  }
  Atomics.add(H, ${READY}, 1);
  const last = Atomics.load(H, ${SEQ});
  Atomics.add(H, ${WAITING}, 1);
  try {
    Atomics.wait(H, ${SEQ}, last);
    if (Atomics.load(H, ${OP}) === 4) {
      for (let g = rank; g < groups.length; g += W) {
        const grp = groups[g];
        const r = buildFiberGroupKernel(mm, nn, ineligible, sortedKeys, grp.vary, dim, grp.order, grp.runs);
        grp.lens[2 * g] = r.orderLen;
        grp.lens[2 * g + 1] = r.runsLen;
        Atomics.add(H, 7, 1);
      }
    }
    Atomics.add(H, ${DONE}, 1);
    Atomics.notify(H, ${DONE}, 1);
  } catch (e) {
    Atomics.store(H, ${POISON}, 1);
    parentPort.postMessage({
      type: 'worker-fatal',
      rank: rank,
      message: String((e && e.message) || e),
    });
    return;
  }
  process.exit(0);
});
`
  );
}

/**
 * 多线程并行构建纤维组：每组完整归属单一 Worker（g % W === rank），
 * 调用与串行完全相同的 buildFiberGroupKernel ⇒ order/runs 逐位一致。
 * 输入的 ineligible/sortedKeys 须为 SharedArrayBuffer 底座（构建方保证）。
 * 任何失败返回 null，调用方回退串行构建。
 */
export function parallelBuildFiberGroups(params: {
  m: number;
  n: number;
  dimension: number;
  ineligible: Uint8Array;
  sortedKeys: Float64Array;
  varies: number[][];
}): ParallelBuildResult[] | null {
  const { m, n, dimension, ineligible, sortedKeys, varies } = params;
  if (!parallelEnabled()) return null;
  if (dimension < PARALLEL_BUILD_MIN_DIM || varies.length < 2) return null;
  if (typeof SharedArrayBuffer !== 'function') return null;
  if (!(ineligible.buffer instanceof SharedArrayBuffer)) return null;
  if (!(sortedKeys.buffer instanceof SharedArrayBuffer)) return null;

  const G = varies.length;
  const W = Math.max(2, Math.min(Math.max(1, cpus().length - 1), MAX_WORKERS, G));

  const header = new SharedArrayBuffer(64);
  const H = new Int32Array(header);
  const orderBufs: SharedArrayBuffer[] = [];
  const runsBufs: SharedArrayBuffer[] = [];
  for (let g = 0; g < G; g++) {
    orderBufs.push(new SharedArrayBuffer(dimension * 4));
    runsBufs.push(new SharedArrayBuffer(dimension * 4));
  }
  const lensBuf = new SharedArrayBuffer(G * 2 * 4);

  const workers: Worker[] = [];
  let poisoned = false;
  const terminateAll = (): void => {
    for (const w of workers) w.terminate().catch(() => undefined);
  };

  try {
    const src = buildWorkerSource();
    for (let rank = 0; rank < W; rank++) {
      const w = new Worker(src, { eval: true });
      w.unref();
      w.on('error', () => {
        poisoned = true;
      });
      w.on('message', (msg: { type?: string; rank?: number; message?: string }) => {
        if (msg.type === 'worker-fatal') {
          poisoned = true;
          if (process.env.QUANTUM_PARALLEL_DEBUG) {
            console.error(`[parallel-build] worker ${msg.rank} fatal: ${msg.message}`);
          }
        }
      });
      workers.push(w);
      w.postMessage({
        type: 'init-build',
        header,
        ineligible: ineligible.buffer,
        sortedKeys: {
          buf: sortedKeys.buffer,
          off: sortedKeys.byteOffset,
          len: sortedKeys.length,
        },
        m,
        n,
        dim: dimension,
        workers: W,
        rank,
        groups: varies.map((vary, g) => ({ vary, order: orderBufs[g]!, runs: runsBufs[g]! })),
        lens: lensBuf,
      });
    }

    // 同步握手
    const readyDeadline = Date.now() + 10_000;
    while (Atomics.load(H, WAITING) < W) {
      // 同上：闭包改写的标志位，流分析误报
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (poisoned || Date.now() > readyDeadline) throw new Error('build handshake timeout');
      Atomics.wait(H, WAITING, Atomics.load(H, WAITING), 50);
    }

    // 单次出发（op=4），全体完成后收 lengths
    Atomics.store(H, DONE, 0);
    Atomics.store(H, OP, 4);
    Atomics.store(H, SEQ, 1);
    Atomics.notify(H, SEQ, Infinity);
    const deadline = Date.now() + 120_000;
    while (Atomics.load(H, DONE) < W) {
      if (Atomics.load(H, POISON) === 1) {
        throw new Error('build worker poisoned');
      }
      if (Date.now() > deadline) {
        throw new Error(
          `build dispatch timeout (done=${Atomics.load(H, DONE)}/${W}, ` +
            `groupsDone=${Atomics.load(H, 7)})`,
        );
      }
      Atomics.wait(H, DONE, Atomics.load(H, DONE), 50);
    }

    // 校验并装配：order 必为 dim 的排列（orderLen === dim），runs 偶数长
    const lens = new Int32Array(lensBuf);
    const results: ParallelBuildResult[] = [];
    for (let g = 0; g < G; g++) {
      const orderLen = lens[2 * g]!;
      const runsLen = lens[2 * g + 1]!;
      if (orderLen !== dimension || runsLen % 2 !== 0 || runsLen > dimension) {
        throw new Error(`build sanity failed g=${g} orderLen=${orderLen} runsLen=${runsLen}`);
      }
      results.push({
        order: new Int32Array(orderBufs[g]!),
        runs: new Int32Array(runsBufs[g]!, 0, runsLen),
      });
    }
    return results;
  } catch (err) {
    if (process.env.QUANTUM_PARALLEL_DEBUG) {
      console.error('[parallel-build] failed:', (err as Error).message);
    }
    terminateAll();
    return null;
  } finally {
    setTimeout(() => {
      terminateAll();
    }, 1_000).unref();
  }
}
