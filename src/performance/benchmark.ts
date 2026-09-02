import { QuantumMultiAgentPlatform } from '../index.js';
import { performance } from 'perf_hooks';
import { pathToFileURL } from 'url';

export interface BenchmarkResult {
  testName: string;
  duration: number;
  metrics: {
    agentsRegistered: number;
    tasksSubmitted: number;
    tasksCompleted: number;
    averageResponseTime: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  errors: string[];
}

export class QuantumBenchmark {
  private platform: QuantumMultiAgentPlatform;
  private results: BenchmarkResult[] = [];

  constructor(config: any = {}) {
    // 基准测试默认压制热路径日志，排除日志I/O对吞吐测量的干扰
    this.platform = new QuantumMultiAgentPlatform({ logLevel: 'warn', ...config });
  }

  async initialize(): Promise<void> {
    await this.platform.start();
    console.log('[Benchmark] Platform initialized');
  }

  async cleanup(): Promise<void> {
    this.platform.stop();
    console.log('[Benchmark] Platform cleaned up');
  }

  async benchmarkAgentRegistration(count: number = 100): Promise<BenchmarkResult> {
    console.log(`[Benchmark] Testing agent registration with ${count} agents...`);
    
    const startTime = performance.now();
    const errors: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < count; i++) {
        try {
          this.platform.registerAgent({
            name: `Test Agent ${i}`,
            type: 'developer',
            capabilities: ['testing', 'benchmarking'],
            position: { x: Math.random(), y: Math.random(), z: Math.random() }
          });
          successCount++;
        } catch (error) {
          errors.push(`Agent ${i} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const endTime = performance.now();

      const agents = this.platform.getAgents();
      const result: BenchmarkResult = {
        testName: 'Agent Registration',
        duration: endTime - startTime,
        metrics: {
          agentsRegistered: agents.length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
          averageResponseTime: (endTime - startTime) / count,
          throughput: count / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: 0 // 简化实现
        },
        errors
      };
      this.results.push(result);
      return result;
    } catch (error) {
      const endTime = performance.now();
      return {
        testName: 'Agent Registration',
        duration: endTime - startTime,
        metrics: {
          agentsRegistered: successCount,
          tasksSubmitted: 0,
          tasksCompleted: 0,
          averageResponseTime: (endTime - startTime) / Math.max(successCount, 1),
          throughput: successCount / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: 0
        },
        errors: [...errors, `Benchmark failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  async benchmarkTaskSubmission(count: number = 1000): Promise<BenchmarkResult> {
    console.log(`[Benchmark] Testing task submission with ${count} tasks...`);
    
    const startTime = performance.now();
    const errors: string[] = [];
    const completedTasks: number[] = [];

    try {
      const promises = [];
      for (let i = 0; i < count; i++) {
        const promise = new Promise<void>((resolve) => {
          const task = this.platform.submitTask({
            name: `Benchmark Task ${i}`,
            type: 'benchmark',
            priority: i % 10 === 0 ? 'critical' : 'medium',
            requirements: [
              { type: 'capability', name: 'testing', weight: 0.8 },
              { type: 'capability', name: 'benchmarking', weight: 0.6 }
            ]
          });

          // 模拟任务完成
          setTimeout(() => {
            completedTasks.push(i);
            resolve();
          }, Math.random() * 1000 + 100); // 随机执行时间
        });

        promises.push(promise);
      }

      await Promise.all(promises);
      const endTime = performance.now();

      const tasks = this.platform.getTasks();

      const result: BenchmarkResult = {
        testName: 'Task Submission',
        duration: endTime - startTime,
        metrics: {
          agentsRegistered: this.platform.getAgents().length,
          tasksSubmitted: tasks.length,
          tasksCompleted: completedTasks.length,
          averageResponseTime: (endTime - startTime) / count,
          throughput: count / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: 0
        },
        errors
      };
      this.results.push(result);
      return result;
    } catch (error) {
      const endTime = performance.now();
      return {
        testName: 'Task Submission',
        duration: endTime - startTime,
        metrics: {
          agentsRegistered: this.platform.getAgents().length,
          tasksSubmitted: completedTasks.length,
          tasksCompleted: completedTasks.length,
          averageResponseTime: (endTime - startTime) / Math.max(completedTasks.length, 1),
          throughput: completedTasks.length / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: 0
        },
        errors: [...errors, `Benchmark failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  async benchmarkCommunication(count: number = 1000): Promise<BenchmarkResult> {
    console.log(`[Benchmark] Testing communication with ${count} messages...`);
    
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      const agents = this.platform.getAgents();
      if (agents.length < 2) {
        throw new Error('Need at least 2 agents for communication benchmark');
      }

      for (let i = 0; i < count; i++) {
        const sourceAgent = agents[Math.floor(Math.random() * agents.length)];
        const targetAgent = agents[Math.floor(Math.random() * agents.length)];
        
        try {
          // createMessage为同步调用：立即路由，目标不在线则进入离线队列
          this.platform.quantumBus.createMessage(
            sourceAgent.id,
            'request',
            { message: `Test message ${i}`, timestamp: Date.now() },
            targetAgent.id
          );
        } catch (error) {
          errors.push(`Message ${i} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const endTime = performance.now();

      const result: BenchmarkResult = {
        testName: 'Communication',
        duration: endTime - startTime,
        metrics: {
          agentsRegistered: agents.length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
          averageResponseTime: (endTime - startTime) / count,
          throughput: count / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: 0
        },
        errors
      };
      this.results.push(result);
      return result;
    } catch (error) {
      const endTime = performance.now();
      return {
        testName: 'Communication',
        duration: endTime - startTime,
        metrics: {
          agentsRegistered: this.platform.getAgents().length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
          averageResponseTime: (endTime - startTime) / Math.max(1, count - errors.length),
          throughput: (count - errors.length) / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: 0
        },
        errors: [...errors, `Benchmark failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  async benchmarkDSHIntegration(count: number = 100): Promise<BenchmarkResult> {
    console.log(`[Benchmark] Testing DSH integration with ${count} tool calls...`);
    
    const startTime = performance.now();
    const errors: string[] = [];
    let successCount = 0;

    try {
      const promises = [];
      for (let i = 0; i < count; i++) {
        const promise = this.platform.executeDSHTool('read_file', {
          path: 'package.json'
        }).then(() => {
          successCount++;
        }).catch((error) => {
          errors.push(`Tool call ${i} failed: ${error.message}`);
        });

        promises.push(promise);
      }

      await Promise.all(promises);
      const endTime = performance.now();

      const result: BenchmarkResult = {
        testName: 'DSH Integration',
        duration: endTime - startTime,
        metrics: {
          agentsRegistered: this.platform.getAgents().length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
          averageResponseTime: (endTime - startTime) / Math.max(successCount, 1),
          throughput: successCount / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: 0
        },
        errors
      };
      this.results.push(result);
      return result;
    } catch (error) {
      const endTime = performance.now();
      return {
        testName: 'DSH Integration',
        duration: endTime - startTime,
        metrics: {
          agentsRegistered: this.platform.getAgents().length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
          averageResponseTime: (endTime - startTime) / Math.max(successCount, 1),
          throughput: successCount / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: 0
        },
        errors: [...errors, `Benchmark failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  // 调度器纯吞吐：同步提交+分配+完成，无模拟执行等待
  async benchmarkSchedulerThroughput(taskCount: number = 1000, agentCount: number = 200): Promise<BenchmarkResult> {
    console.log(`[Benchmark] Testing scheduler throughput with ${taskCount} tasks / ${agentCount} agents...`);

    const errors: string[] = [];

    // 准备阶段：注册基准agent（不计时）
    for (let i = 0; i < agentCount; i++) {
      this.platform.registerAgent({
        name: `Bench Agent ${i}`,
        type: 'custom',
        capabilities: ['bench'],
        position: { x: Math.random(), y: Math.random(), z: Math.random() }
      });
    }

    const startTime = performance.now();

    // 计时阶段：全部同步提交（每agent一任务，前agentCount个立即分配）
    const submitted = [];
    for (let i = 0; i < taskCount; i++) {
      try {
        submitted.push(this.platform.submitTask({
          name: `Throughput Task ${i}`,
          type: 'bench',
          priority: i % 4 === 0 ? 'critical' : (i % 4 === 1 ? 'high' : (i % 4 === 2 ? 'medium' : 'low')),
          requirements: [{ type: 'capability', name: 'bench', value: null, weight: 1.0 }]
        }));
      } catch (error) {
        errors.push(`Submit ${i} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 逐个完成已分配任务，触发重调度链式消费挂起任务
    for (const task of submitted) {
      if (task.status === 'assigned' || task.status === 'pending') {
        this.platform.completeTask(task.id, true);
      }
    }

    const endTime = performance.now();

    const metrics = this.platform.getSystemMetrics();
    const result: BenchmarkResult = {
      testName: 'Scheduler Throughput',
      duration: endTime - startTime,
      metrics: {
        agentsRegistered: metrics.scheduler.totalAgents,
        tasksSubmitted: taskCount,
        tasksCompleted: metrics.scheduler.completedTasks,
        averageResponseTime: (endTime - startTime) / taskCount,
        throughput: taskCount / ((endTime - startTime) / 1000),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0
      },
      errors
    };
    this.results.push(result);
    return result;
  }

  async runFullBenchmark(): Promise<BenchmarkResult[]> {
    console.log('[Benchmark] Starting full benchmark suite...');
    
    const results: BenchmarkResult[] = [];
    
    try {
      // Agent注册测试
      const agentResult = await this.benchmarkAgentRegistration(100);
      results.push(agentResult);
      console.log(`[Benchmark] Agent Registration: ${agentResult.duration.toFixed(2)}ms`);

      // 任务提交测试
      const taskResult = await this.benchmarkTaskSubmission(1000);
      results.push(taskResult);
      console.log(`[Benchmark] Task Submission: ${taskResult.duration.toFixed(2)}ms`);

      // 调度器纯吞吐测试
      const throughputResult = await this.benchmarkSchedulerThroughput(1000, 200);
      results.push(throughputResult);
      console.log(`[Benchmark] Scheduler Throughput: ${throughputResult.duration.toFixed(2)}ms, ${throughputResult.metrics.throughput.toFixed(0)} ops/sec`);

      // 通信测试
      const commResult = await this.benchmarkCommunication(1000);
      results.push(commResult);
      console.log(`[Benchmark] Communication: ${commResult.duration.toFixed(2)}ms`);

      // DSH集成测试
      const dshResult = await this.benchmarkDSHIntegration(100);
      results.push(dshResult);
      console.log(`[Benchmark] DSH Integration: ${dshResult.duration.toFixed(2)}ms`);

      // 生成报告
      this.generateReport(results);
      
      return results;
    } catch (error) {
      console.error('[Benchmark] Full benchmark failed:', error);
      throw error;
    }
  }

  private generateReport(results: BenchmarkResult[]): void {
    console.log('\n=== BENCHMARK REPORT ===');
    
    const totalDuration = results.reduce((sum, result) => sum + result.duration, 0);
    const totalThroughput = results.reduce((sum, result) => sum + result.metrics.throughput, 0);
    const avgMemoryUsage = results.reduce((sum, result) => sum + result.metrics.memoryUsage, 0) / results.length;
    
    console.log(`\n总体性能:`);
    console.log(`- 总耗时: ${totalDuration.toFixed(2)}ms`);
    console.log(`- 平均吞吐量: ${totalThroughput.toFixed(2)} operations/sec`);
    console.log(`- 平均内存使用: ${avgMemoryUsage.toFixed(2)} MB`);
    
    console.log(`\n详细结果:`);
    results.forEach(result => {
      console.log(`\n${result.testName}:`);
      console.log(`- 耗时: ${result.duration.toFixed(2)}ms`);
      console.log(`- 吞吐量: ${result.metrics.throughput.toFixed(2)} ops/sec`);
      console.log(`- 内存使用: ${result.metrics.memoryUsage.toFixed(2)} MB`);
      console.log(`- 错误数量: ${result.errors.length}`);
      if (result.errors.length > 0) {
        console.log(`- 错误详情:`, result.errors.slice(0, 3));
      }
    });
    
    // 性能评分
    const performanceScore = this.calculatePerformanceScore(results);
    console.log(`\n性能评分: ${performanceScore}/100`);
    
    if (performanceScore >= 90) {
      console.log('🎯 性能优秀');
    } else if (performanceScore >= 70) {
      console.log('✅ 性能良好');
    } else if (performanceScore >= 50) {
      console.log('⚠️ 性能一般');
    } else {
      console.log('❌ 性能需要优化');
    }
  }

  private calculatePerformanceScore(results: BenchmarkResult[]): number {
    if (results.length === 0) return 0;
    
    let totalScore = 0;
    let maxScore = 0;
    
    results.forEach(result => {
      // 吞吐量评分 (40%)
      const throughputScore = Math.min(result.metrics.throughput / 1000, 1) * 40;
      
      // 内存效率评分 (30%)
      const memoryScore = Math.max(0, 1 - (result.metrics.memoryUsage / 100)) * 30;
      
      // 错误率评分 (30%)
      const errorRate = result.errors.length / Math.max(result.metrics.tasksSubmitted, 1);
      const errorScore = Math.max(0, 1 - errorRate) * 30;
      
      const testScore = throughputScore + memoryScore + errorScore;
      totalScore += testScore;
      maxScore += 100;
    });
    
    return Math.round((totalScore / maxScore) * 100);
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }
}

// 导出benchmark运行器
export async function runBenchmark(config?: any): Promise<BenchmarkResult[]> {
  const benchmark = new QuantumBenchmark(config);
  
  try {
    await benchmark.initialize();
    const results = await benchmark.runFullBenchmark();
    await benchmark.cleanup();
    return results;
  } catch (error) {
    await benchmark.cleanup();
    throw error;
  }
}

// 如果直接运行此文件（Windows路径兼容）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBenchmark().then(results => {
    console.log('Benchmark completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
}