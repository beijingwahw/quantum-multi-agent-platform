import QuantumMultiAgentPlatform from '../src/index.js';

async function basicExample() {
  console.log('=== Quantum Multi-Agent Platform Basic Usage Example ===\n');

  // 创建平台实例
  const platform = new QuantumMultiAgentPlatform({
    scheduling: {
      maxConcurrentTasks: 50
    },
    communication: {
      port: 8081
    }
  });

  try {
    // 启动平台
    await platform.start();
    console.log('✓ Platform started successfully\n');

    // 注册自定义agent
    const codingAgent = platform.registerAgent({
      name: 'AI Coder',
      type: 'developer',
      capabilities: ['javascript', 'python', 'typescript', 'react'],
      position: { x: 0.5, y: 0.5, z: 0.5 }
    });

    console.log('✓ Agent registered:', codingAgent.name);

    // 创建量子纠缠（需要使用目标agent的ID）
    const quantumDev = platform.getAgents().find(a => a.name === 'Quantum Developer');
    platform.agentManager.createEntanglement(codingAgent.id, quantumDev.id);
    console.log('✓ Quantum entanglement created\n');

    // 提交任务（要求的能力须由同一个agent全部具备才会被分配）
    const task = platform.submitTask({
      name: 'Analyze code performance',
      type: 'code_analysis',
      priority: 'high',
      requirements: [
        { type: 'capability', name: 'javascript', weight: 0.8 },
        { type: 'capability', name: 'react', weight: 0.6 }
      ],
      estimatedDuration: 30000
    });

    console.log('✓ Task submitted:', task.id);
    console.log('✓ Task status after scheduling:', task.status);

    // 查看系统状态
    const metrics = platform.getSystemMetrics();
    console.log('\n=== System Metrics ===');
    console.log('Active agents:', metrics.agents.agentsByState.working || 0);
    console.log('Total tasks:', metrics.scheduler.totalTasks);
    console.log('System health:', Math.round(metrics.health.systemHealth * 100) + '%\n');

    // 执行DSH工具
    console.log('=== DSH Tool Execution ===');
    try {
      const result = await platform.executeDSHTool('read_file', { 
        path: 'examples/basic-usage.js' 
      });
      console.log('✓ File read successfully, length:', result.length);
    } catch (error) {
      console.log('✗ File read failed:', error.message);
    }

    // 模拟任务执行完成后，通过统一入口关闭任务并释放agent
    setTimeout(() => {
      platform.completeTask(task.id, true, { linesAnalyzed: 42 });
      console.log('\n✓ Task completed:', task.id);
      
      // 最终状态
      const finalMetrics = platform.getSystemMetrics();
      console.log('\n=== Final Metrics ===');
      console.log('Completed tasks:', finalMetrics.scheduler.completedTasks);
      console.log('Failed tasks:', finalMetrics.scheduler.failedTasks);
    }, 2000);

  } catch (error) {
    console.error('Error in basic example:', error);
  } finally {
    // 清理
    setTimeout(() => {
      platform.stop();
      console.log('\n✓ Platform stopped');
      process.exit(0);
    }, 4000);
  }
}

// 运行示例
basicExample();
