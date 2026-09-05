/**
 * 平台 CLI 入口（08#53）：此前的 `if (import.meta.url === …argv[1])`
 * 副作用块内嵌在库入口 src/index.ts——库与可执行程序的边界混在一
 * 个文件里，消费者 import 平台库会被动携带进程信号监听的导入面。
 * 抽离为独立入口后 index.ts 是纯库（零进程副作用），本文件是唯一
 * 的可执行装配点（bin / npm start）。
 */

import { QuantumMultiAgentPlatform } from './index.js';

const platform = new QuantumMultiAgentPlatform();

// 启动平台（失败必须反映到退出码：脚本/CI 依赖非零退出感知启动失败）
platform.start().catch((err: unknown) => {
  console.error('[QuantumPlatform]', err);
  process.exitCode = 1;
});

// 监听中断信号：让事件循环自然排空（异步日志/关闭握手不被截断），
// 定时器已全部 unref/clear，进程会自行退出
const shutdown = (signal: string): void => {
  console.log(`\n[QuantumPlatform] Received ${signal}, shutting down...`);
  try {
    platform.stop();
  } catch (err) {
    // 信号处理里的异常无人接盘会以未捕获异常杀进程——收尾失败
    // 显式反映到退出码而非静默
    console.error('[QuantumPlatform] Shutdown failed:', err);
    process.exitCode = 1;
  }
};
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
