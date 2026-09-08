import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DSHIntegration } from '../src/dsh/dsh-integration.js';
import { ToolError } from '../src/utils/errors.js';

describe('DSHIntegration', () => {
  it('初始化后注册默认工具与工作流', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    const tools = dsh.getTools();
    const workflows = dsh.getWorkflows();

    assert.ok(tools.length >= 5);
    assert.ok(tools.some((t) => t.name === 'read_file'));
    assert.ok(workflows.length >= 3);
    assert.equal(dsh.getMetrics().isInitialized, true);
  });

  it('read_file读取真实文件内容', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    const content = (await dsh.executeTool('read_file', { path: 'package.json' })) as string;
    assert.ok(content.includes('quantum-multi-agent-platform'));
  });

  it('未知工具与缺失必选参数均抛出错误', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    await assert.rejects(() => dsh.executeTool('not_a_tool', {}), /Tool 'not_a_tool' not found/);
    await assert.rejects(
      () => dsh.executeTool('read_file', {}),
      /Required parameter 'path' missing/,
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
        { id: '2', tool: 'read_file', parameters: { path: 'tsconfig.json' }, dependsOn: ['1'] },
      ],
    });

    const results = await dsh.executeWorkflow(workflow.id);

    // 结果按拓扑顺序而非声明顺序返回
    assert.equal(results.length, 3);
    assert.equal(results[0]![0], '1');
    assert.equal(results[1]![0], '2');
    assert.equal(results[2]![0], '3');
    assert.ok((results[1]![1] as string).includes('compilerOptions'));
  });

  it('循环依赖的工作流被检测并拒绝', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    const workflow = dsh.createWorkflow({
      name: 'circular',
      steps: [
        { id: 'a', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['b'] },
        { id: 'b', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['a'] },
      ],
    });

    await assert.rejects(() => dsh.executeWorkflow(workflow.id), /circular/i);
  });

  it('支持动态注册自定义工具', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    dsh.registerTool({
      name: 'echo_tool',
      description: 'returns input',
      parameters: [{ name: 'text', type: 'string', required: true }],
      returnType: 'string',
      category: 'custom-unknown',
    });

    await assert.rejects(
      () => dsh.executeTool('echo_tool', { text: 'hi' }),
      /Unknown tool category/,
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

  it('负对照：subagent 空 description/prompt 抛 ToolError，不再产出空转 mock 结果', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    await assert.rejects(
      () => dsh.executeTool('subagent', { description: '', prompt: 'p' }),
      (error: unknown) =>
        error instanceof ToolError && /non-empty 'description'/.test(error.message),
    );
    await assert.rejects(
      () => dsh.executeTool('subagent', { description: 'd', prompt: '' }),
      /non-empty 'prompt'/,
    );

    // 边界：合法参数的 mock 结果契约不变（status='mock'）
    const result = (await dsh.executeTool('subagent', {
      description: 'analyze',
      prompt: 'do it',
    })) as { status: string; description: string };
    assert.equal(result.status, 'mock');
    assert.equal(result.description, 'analyze');
  });

  it('负对照：web_search 空/非字符串查询抛 ToolError，不再产出空查询占位', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    await assert.rejects(
      () => dsh.executeTool('web_search', { query: '' }),
      (error: unknown) =>
        error instanceof ToolError && /non-empty query string/.test(error.message),
    );
    await assert.rejects(
      () => dsh.executeTool('web_search', { query: '   ' }),
      /non-empty query string/,
    );

    // 边界：合法查询的占位结果契约不变
    const out = (await dsh.executeTool('web_search', { query: 'quantum scheduling' })) as string;
    assert.match(out, /\[mock\] Search results for "quantum scheduling"/);
  });
});
