import type { PlatformConfig } from '../index.js';
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
    /** 测量窗口内进程消耗的 CPU 时间（user+system，毫秒） */
    cpuUsage: number;
  };
  errors: string[];
}

/** 测量窗口的起止采样（墙上时间 + CPU 时间 + 堆内存） */
interface WindowStart {
  wall: number;
  cpu: NodeJS.CpuUsage;
}

function startWindow(): WindowStart {
  return { wall: performance.now(), cpu: process.cpuUsage() };
}

export class QuantumBenchmark {
  private platform: QuantumMultiAgentPlatform;
  private results: BenchmarkResult[] = [];

  constructor(config: Partial<PlatformConfig> = {}) {
    // 基准测试默认压制热路径日志，排除日志I/O对吞吐测量的干扰
    this.platform = new QuantumMultiAgentPlatform({ logLevel: 'warn', ...config });
  }

  /**
   * 基准工具自身的信息通道。刻意用 console 而非分级 logger：
   * 构造器把平台日志压到 warn 以保证测量保真，进度/报告输出是本工具
   * 的交付物，不应随之被压制。集中于此便于统一识别与重定向。
   */
  private out(...args: unknown[]): void {
    console.log('[Benchmark]', ...args);
  }

  /** 启动平台（端口/系统agent/监控） */
  async initialize(): Promise<void> {
    await this.platform.start();
    this.out('Platform initialized');
  }

  /** 停止平台并清理定时器 */
  async cleanup(): Promise<void> {
    this.platform.stop();
    this.out('Platform cleaned up');
  }

  /**
   * 唯一的结果构造器：各基准方法只报告「完成了多少单位、计数快照、错误」，
   * 派生指标（均值响应/吞吐/内存/CPU）统一在此计算。
   */
  private buildResult(
    testName: string,
    started: WindowStart,
    units: number,
    counts: Pick<
      BenchmarkResult['metrics'],
      'agentsRegistered' | 'tasksSubmitted' | 'tasksCompleted'
    >,
    errors: string[],
  ): BenchmarkResult {
    const duration = performance.now() - started.wall;
    const cpuDelta = process.cpuUsage(started.cpu);
    return {
      testName,
      duration,
      metrics: {
        ...counts,
        averageResponseTime: duration / Math.max(units, 1),
        throughput: units / (duration / 1000),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: (cpuDelta.user + cpuDelta.system) / 1000,
      },
      errors,
    };
  }

  private record(result: BenchmarkResult): BenchmarkResult {
    this.results.push(result);
    return result;
  }

  async benchmarkAgentRegistration(count: number = 100): Promise<BenchmarkResult> {
    this.out(`Testing agent registration with ${count} agents...`);

    const started = startWindow();
    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < count; i++) {
      try {
        this.platform.registerAgent({
          name: `Test Agent ${i}`,
          type: 'developer',
          capabilities: ['testing', 'benchmarking'],
          position: { x: Math.random(), y: Math.random(), z: Math.random() },
        });
        successCount++;
      } catch (error) {
        errors.push(`Agent ${i} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return this.record(
      this.buildResult(
        'Agent Registration',
        started,
        successCount,
        {
          agentsRegistered: this.platform.getAgents().length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
        },
        errors,
      ),
    );
  }

  async benchmarkTaskSubmission(count: number = 1000): Promise<BenchmarkResult> {
    this.out(`Testing task submission with ${count} tasks...`);

    const started = startWindow();
    const errors: string[] = [];
    const completedTasks: number[] = [];

    const promises = [];
    for (let i = 0; i < count; i++) {
      const promise = new Promise<void>((resolve) => {
        this.platform.submitTask({
          name: `Benchmark Task ${i}`,
          type: 'benchmark',
          priority: i % 10 === 0 ? 'critical' : 'medium',
          requirements: [
            { type: 'capability', name: 'testing', weight: 0.8 },
            { type: 'capability', name: 'benchmarking', weight: 0.6 },
          ],
        });

        // 模拟任务完成
        setTimeout(
          () => {
            completedTasks.push(i);
            resolve();
          },
          Math.random() * 1000 + 100,
        ); // 随机执行时间
      });

      promises.push(promise);
    }

    await Promise.all(promises);

    return this.record(
      this.buildResult(
        'Task Submission',
        started,
        count,
        {
          agentsRegistered: this.platform.getAgents().length,
          tasksSubmitted: this.platform.getTasks().length,
          tasksCompleted: completedTasks.length,
        },
        errors,
      ),
    );
  }

  async benchmarkCommunication(count: number = 1000): Promise<BenchmarkResult> {
    this.out(`Testing communication with ${count} messages...`);

    const started = startWindow();
    const errors: string[] = [];

    const agents = this.platform.getAgents();
    if (agents.length < 2) {
      errors.push('Need at least 2 agents for communication benchmark');
      return this.buildResult(
        'Communication',
        started,
        0,
        {
          agentsRegistered: agents.length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
        },
        errors,
      );
    }

    let sent = 0;
    for (let i = 0; i < count; i++) {
      const sourceAgent = agents[Math.floor(Math.random() * agents.length)]!;
      const targetAgent = agents[Math.floor(Math.random() * agents.length)]!;

      try {
        // createMessage为同步调用：立即路由，目标不在线则进入离线队列
        this.platform.quantumBus.createMessage(
          sourceAgent.id,
          'request',
          { message: `Test message ${i}`, timestamp: Date.now() },
          targetAgent.id,
        );
        sent++;
      } catch (error) {
        errors.push(
          `Message ${i} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return this.record(
      this.buildResult(
        'Communication',
        started,
        sent,
        {
          agentsRegistered: agents.length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
        },
        errors,
      ),
    );
  }

  async benchmarkDSHIntegration(count: number = 100): Promise<BenchmarkResult> {
    this.out(`Testing DSH integration with ${count} tool calls...`);

    const started = startWindow();
    const errors: string[] = [];
    let successCount = 0;

    const promises = [];
    for (let i = 0; i < count; i++) {
      const promise = this.platform
        .executeDSHTool('read_file', {
          path: 'package.json',
        })
        .then(() => {
          successCount++;
        })
        .catch((error: unknown) => {
          errors.push(
            `Tool call ${i} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });

      promises.push(promise);
    }

    await Promise.all(promises);

    return this.record(
      this.buildResult(
        'DSH Integration',
        started,
        successCount,
        {
          agentsRegistered: this.platform.getAgents().length,
          tasksSubmitted: 0,
          tasksCompleted: 0,
        },
        errors,
      ),
    );
  }

  // 调度器纯吞吐：同步提交+分配+完成，无模拟执行等待
  async benchmarkSchedulerThroughput(
    taskCount: number = 1000,
    agentCount: number = 200,
  ): Promise<BenchmarkResult> {
    this.out(`Testing scheduler throughput with ${taskCount} tasks / ${agentCount} agents...`);

    const errors: string[] = [];

    // 准备阶段：注册基准agent（不计时）
    for (let i = 0; i < agentCount; i++) {
      this.platform.registerAgent({
        name: `Bench Agent ${i}`,
        type: 'custom',
        capabilities: ['bench'],
        position: { x: Math.random(), y: Math.random(), z: Math.random() },
      });
    }

    const started = startWindow();

    // 计时阶段：全部同步提交（每agent一任务，前agentCount个立即分配）
    const submitted = [];
    for (let i = 0; i < taskCount; i++) {
      try {
        submitted.push(
          this.platform.submitTask({
            name: `Throughput Task ${i}`,
            type: 'bench',
            priority:
              i % 4 === 0 ? 'critical' : i % 4 === 1 ? 'high' : i % 4 === 2 ? 'medium' : 'low',
            requirements: [{ type: 'capability', name: 'bench', value: null, weight: 1.0 }],
          }),
        );
      } catch (error) {
        errors.push(
          `Submit ${i} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 逐个完成已分配任务，触发重调度链式消费挂起任务
    for (const task of submitted) {
      if (task.status === 'assigned' || task.status === 'pending') {
        this.platform.completeTask(task.id, true);
      }
    }

    const metrics = this.platform.getSystemMetrics();
    return this.record(
      this.buildResult(
        'Scheduler Throughput',
        started,
        taskCount,
        {
          agentsRegistered: metrics.scheduler.totalAgents,
          tasksSubmitted: taskCount,
          tasksCompleted: metrics.scheduler.completedTasks,
        },
        errors,
      ),
    );
  }

  async runFullBenchmark(): Promise<BenchmarkResult[]> {
    this.out('Starting full benchmark suite...');

    const results: BenchmarkResult[] = [];

    // Agent注册测试
    const agentResult = await this.benchmarkAgentRegistration(100);
    results.push(agentResult);
    this.out(`Agent Registration: ${agentResult.duration.toFixed(2)}ms`);

    // 任务提交测试
    const taskResult = await this.benchmarkTaskSubmission(1000);
    results.push(taskResult);
    this.out(`Task Submission: ${taskResult.duration.toFixed(2)}ms`);

    // 调度器纯吞吐测试
    const throughputResult = await this.benchmarkSchedulerThroughput(1000, 200);
    results.push(throughputResult);
    this.out(
      `Scheduler Throughput: ${throughputResult.duration.toFixed(2)}ms, ${throughputResult.metrics.throughput.toFixed(0)} ops/sec`,
    );

    // 通信测试
    const commResult = await this.benchmarkCommunication(1000);
    results.push(commResult);
    this.out(`Communication: ${commResult.duration.toFixed(2)}ms`);

    // DSH集成测试
    const dshResult = await this.benchmarkDSHIntegration(100);
    results.push(dshResult);
    this.out(`DSH Integration: ${dshResult.duration.toFixed(2)}ms`);

    // 生成报告
    this.generateReport(results);

    return results;
  }

  private generateReport(results: BenchmarkResult[]): void {
    this.out('\n=== BENCHMARK REPORT ===');

    const totalDuration = results.reduce((sum, result) => sum + result.duration, 0);
    const totalThroughput = results.reduce((sum, result) => sum + result.metrics.throughput, 0);
    const avgMemoryUsage =
      results.reduce((sum, result) => sum + result.metrics.memoryUsage, 0) / results.length;

    this.out(`\n总体性能:`);
    this.out(`- 总耗时: ${totalDuration.toFixed(2)}ms`);
    this.out(`- 平均吞吐量: ${totalThroughput.toFixed(2)} operations/sec`);
    this.out(`- 平均内存使用: ${avgMemoryUsage.toFixed(2)} MB`);

    this.out(`\n详细结果:`);
    results.forEach((result) => {
      this.out(`\n${result.testName}:`);
      this.out(`- 耗时: ${result.duration.toFixed(2)}ms`);
      this.out(`- 吞吐量: ${result.metrics.throughput.toFixed(2)} ops/sec`);
      this.out(`- 内存使用: ${result.metrics.memoryUsage.toFixed(2)} MB`);
      this.out(`- CPU时间: ${result.metrics.cpuUsage.toFixed(2)}ms`);
      this.out(`- 错误数量: ${result.errors.length}`);
      if (result.errors.length > 0) {
        this.out(`- 错误详情:`, result.errors.slice(0, 3));
      }
    });

    // 性能评分
    const performanceScore = this.calculatePerformanceScore(results);
    this.out(`\n性能评分: ${performanceScore}/100`);

    if (performanceScore >= 90) {
      this.out('🎯 性能优秀');
    } else if (performanceScore >= 70) {
      this.out('✅ 性能良好');
    } else if (performanceScore >= 50) {
      this.out('⚠️ 性能一般');
    } else {
      this.out('❌ 性能需要优化');
    }
  }

  private calculatePerformanceScore(results: BenchmarkResult[]): number {
    if (results.length === 0) return 0;

    let totalScore = 0;
    let maxScore = 0;

    results.forEach((result) => {
      // 吞吐量评分 (40%)
      const throughputScore = Math.min(result.metrics.throughput / 1000, 1) * 40;

      // 内存效率评分 (30%)
      const memoryScore = Math.max(0, 1 - result.metrics.memoryUsage / 100) * 30;

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
export async function runBenchmark(config?: Partial<PlatformConfig>): Promise<BenchmarkResult[]> {
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
  runBenchmark()
    .then((results) => {
      void results;
      console.log('Benchmark completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
