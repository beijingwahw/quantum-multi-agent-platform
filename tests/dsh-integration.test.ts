import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DSHIntegration } from '../src/dsh/dsh-integration.js';

describe('DSHIntegration', () => {
  it('初始化后注册默认工具与工作流', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    const tools = dsh.getTools();
    const workflows = dsh.getWorkflows();

    assert.ok(tools.length >= 5);
    assert.ok(tools.some(t => t.name === 'read_file'));
    assert.ok(workflows.length >= 3);
    assert.equal(dsh.getMetrics().isInitialized, true);
  });

  it('read_file读取真实文件内容', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    const content = await dsh.executeTool('read_file', { path: 'package.json' });
    assert.ok(content.includes('quantum-multi-agent-platform'));
  });

  it('未知工具与缺失必选参数均抛出错误', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    await assert.rejects(
      () => dsh.executeTool('not_a_tool', {}),
      /Tool 'not_a_tool' not found/
    );
    await assert.rejects(
      () => dsh.executeTool('read_file', {}),
      /Required parameter 'path' missing/
    );
  });

  it('工作流按拓扑依赖顺序执行', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    const workflow = dsh.createWorkflow({
      name: 'chain',
      steps: [
        { id: '3', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['2'] },
        { id: '1', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: [] },
        { id: '2', tool: 'read_file', parameters: { path: 'tsconfig.json' }, dependsOn: ['1'] }
      ]
    });

    const results = await dsh.executeWorkflow(workflow.id);

    // 结果按拓扑顺序而非声明顺序返回
    assert.equal(results.length, 3);
    assert.equal(results[0][0], '1');
    assert.equal(results[1][0], '2');
    assert.equal(results[2][0], '3');
    assert.ok(results[1][1].includes('compilerOptions'));
  });

  it('循环依赖的工作流被检测并拒绝', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    const workflow = dsh.createWorkflow({
      name: 'circular',
      steps: [
        { id: 'a', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['b'] },
        { id: 'b', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['a'] }
      ]
    });

    await assert.rejects(
      () => dsh.executeWorkflow(workflow.id),
      /circular/i
    );
  });

  it('支持动态注册自定义工具', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    dsh.registerTool({
      name: 'echo_tool',
      description: 'returns input',
      parameters: [{ name: 'text', type: 'string', required: true }],
      returnType: 'string',
      category: 'custom-unknown'
    });

    await assert.rejects(
      () => dsh.executeTool('echo_tool', { text: 'hi' }),
      /Unknown tool category/
    );

    dsh.unregisterTool('echo_tool');
    assert.equal(dsh.getTool('echo_tool'), undefined);
  });

  it('agent映射的建立与解除', async () => {
    const dsh = new DSHIntegration({});

    dsh.mapAgent('quantum-1', 'dsh-1');
    assert.equal(dsh.getMappedAgent('quantum-1'), 'dsh-1');

    dsh.unmapAgent('quantum-1');
    assert.equal(dsh.getMappedAgent('quantum-1'), undefined);
  });
});
