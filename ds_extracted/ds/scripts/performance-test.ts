#!/usr/bin/env node

import { runBenchmark } from '../src/performance/benchmark.js';

async function main() {
  console.log('🚀 Starting Quantum Multi-Agent Platform Performance Test');
  console.log('==================================================\n');

  try {
    // 运行基准测试
    const config = {
      scheduling: {
        maxConcurrentTasks: 500,
      },
      communication: {
        // 0 = 系统分配临时端口：固定 8082 在并行/重跑时会端口冲突
        port: 0,
      },
    };

    await runBenchmark(config);

    console.log('\n✅ Performance test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  }
}

// 运行性能测试（main 自带 try/catch 与退出码，浮空 Promise 标记为有意）
void main();
