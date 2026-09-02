import QuantumMultiAgentPlatform from '../src/index.js';

async function advancedWorkflowExample() {
  console.log('=== Quantum Multi-Agent Platform Advanced Workflow Example ===\n');

  // 配置平台
  const platform = new QuantumMultiAgentPlatform({
    scheduling: {
      maxConcurrentTasks: 100
    },
    communication: {
      port: 8083
    },
    dsh: {
      toolIntegration: true,
      workflowEngine: true
    }
  });

  try {
    await platform.start();
    console.log('✓ Platform started\n');

    // 注册多个specialized agents
    const agents = {
      frontend: platform.registerAgent({
        name: 'Frontend Master',
        type: 'developer',
        capabilities: ['react', 'vue', 'css', 'typescript', 'webpack'],
        position: { x: 0, y: 0, z: 0 }
      }),

      backend: platform.registerAgent({
        name: 'Backend Expert',
        type: 'developer',
        capabilities: ['nodejs', 'python', 'database', 'api', 'docker'],
        position: { x: 1, y: 0, z: 0 }
      }),

      tester: platform.registerAgent({
        name: 'QA Specialist',
        type: 'tester',
        capabilities: ['e2e_testing', 'unit_testing', 'performance', 'security'],
        position: { x: 0.5, y: 1, z: 0 }
      }),

      devops: platform.registerAgent({
        name: 'DevOps Engineer',
        type: 'devops',
        capabilities: ['deployment', 'monitoring', 'ci_cd', 'infrastructure'],
        position: { x: 0.5, y: 0.5, z: 1 }
      })
    };

    console.log('✓ All agents registered');

    // 创建量子纠缠网络
    platform.agentManager.createEntanglement(agents.frontend.id, agents.backend.id);
    platform.agentManager.createEntanglement(agents.backend.id, agents.tester.id);
    platform.agentManager.createEntanglement(agents.tester.id, agents.devops.id);
    platform.agentManager.createEntanglement(agents.devops.id, agents.frontend.id);
    
    console.log('✓ Quantum entanglement network created\n');

    // 创建复杂工作流（演示用安全命令）
    console.log('=== Creating Complex Development Workflow ===');
    
    const devWorkflow = platform.dshIntegration.createWorkflow({
      name: 'Full Stack Development Workflow',
      steps: [
        {
          id: 'setup',
          tool: 'execute_command',
          parameters: { command: 'echo setup complete' }
        },
        {
          id: 'lint',
          tool: 'execute_command',
          parameters: { command: 'echo lint passed' },
          dependsOn: ['setup']
        },
        {
          id: 'test',
          tool: 'execute_command',
          parameters: { command: 'echo tests passed' },
          dependsOn: ['setup']
        },
        {
          id: 'build',
          tool: 'execute_command',
          parameters: { command: 'echo build succeeded' },
          dependsOn: ['lint', 'test']
        }
      ]
    });

    console.log('✓ Workflow created:', devWorkflow.name, `(${devWorkflow.id})`);

    // 并行提交多个任务
    console.log('\n=== Submitting Parallel Tasks ===');
    
    const tasks = [
      {
        name: 'Frontend Development',
        type: 'frontend_development',
        priority: 'high',
        requirements: [
          { type: 'capability', name: 'react', weight: 1.0 },
          { type: 'capability', name: 'typescript', weight: 0.8 }
        ]
      },
      {
        name: 'Backend API Development',
        type: 'backend_development',
        priority: 'high',
        requirements: [
          { type: 'capability', name: 'nodejs', weight: 1.0 },
          { type: 'capability', name: 'database', weight: 0.9 }
        ]
      },
      {
        name: 'Security Testing',
        type: 'security_testing',
        priority: 'critical',
        requirements: [
          { type: 'capability', name: 'security', weight: 1.0 }
        ]
      },
      {
        name: 'Performance Optimization',
        type: 'performance_optimization',
        priority: 'medium',
        requirements: [
          { type: 'capability', name: 'performance', weight: 1.0 }
        ]
      }
    ];

    const submittedTasks = tasks.map(task => platform.submitTask(task));
    submittedTasks.forEach(task => {
      console.log(`  ${task.name}: ${task.status}${task.assignedAgentId ? ' → agent ' + task.assignedAgentId.slice(0, 8) : ''}`);
    });

    // 执行工作流（使用创建时返回的工作流ID）
    console.log('\n=== Executing Development Workflow ===');
    try {
      const workflowResult = await platform.executeDSHWorkflow(devWorkflow.id, agents.backend.id);
      console.log('✓ Workflow execution completed');
      console.log('  Steps executed:', workflowResult.length);
    } catch (error) {
      console.log('✗ Workflow execution failed:', error.message);
    }

    // 模拟任务完成，通过统一入口释放agent
    setTimeout(() => {
      submittedTasks.forEach(task => {
        platform.completeTask(task.id, true);
        console.log(`✓ Task ${task.name} completed`);
      });

      // 最终报告
      const finalMetrics = platform.getSystemMetrics();
      console.log('\n=== Final Performance Report ===');
      console.log('Total tasks submitted:', finalMetrics.scheduler.totalTasks);
      console.log('Tasks completed:', finalMetrics.scheduler.completedTasks);
      console.log('Tasks failed:', finalMetrics.scheduler.failedTasks);
      console.log('Success rate:', 
        finalMetrics.scheduler.totalTasks > 0 ? 
        Math.round((finalMetrics.scheduler.completedTasks / finalMetrics.scheduler.totalTasks) * 100) + '%' : '0%'
      );
      console.log('Average load:', Math.round(finalMetrics.agents.averageLoad) + '%');
      console.log('Quantum efficiency:', Math.round(finalMetrics.scheduler.quantumEfficiency * 100) + '%');

      platform.stop();
      console.log('\n✓ Platform stopped');
      process.exit(0);
    }, 4000);

  } catch (error) {
    console.error('Error in advanced workflow example:', error);
    platform.stop();
    process.exit(1);
  }
}

// 运行高级示例
advancedWorkflowExample();
