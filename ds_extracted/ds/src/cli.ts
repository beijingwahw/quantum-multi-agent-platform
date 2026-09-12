/**
 * 平台 CLI 入口（08#53）：此前的 `if (import.meta.url === …argv[1])`
 * 副作用块内嵌在库入口 src/index.ts——库与可执行程序的边界混在一
 * 个文件里，消费者 import 平台库会被动携带进程信号监听的导入面。
 * 抽离为独立入口后 index.ts 是纯库（零进程副作用），本文件是唯一
 * 的可执行装配点（bin / npm start）。
 */

import { QuantumMultiAgentPlatform } from './index.js';
import { logWarn } from './utils/logger.js';

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
  // 强制退出兜底（08#50 余项）：stop() 已返回但事件循环仍被某组件
  // 滞留（未 unref 的定时器/外来监听）时，5s 后强制退出——退出码取
  // 已记录的 process.exitCode（启动/收尾失败为 1），否则「该退未退」
  // 本身就是异常态，按 1 收口。定时器 unref：不阻塞自然退出路径。
  // backstop 在 try/catch 之后挂载：stop() 抛错也无法跳过它。
  const backstop = setTimeout(() => {
    logWarn(
      'QuantumPlatform',
      'shutdown backstop: event loop still alive 5s after stop(), forcing exit',
    );
    process.exit(process.exitCode ?? 1);
  }, 5_000);
  backstop.unref();
};
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
