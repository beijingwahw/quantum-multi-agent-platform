/**
 * Wave 3 深审收尾回归：审计声明的覆盖缺口（review.md 第五节——
 * dsh-integration / tools 三件套 / performance/benchmark 从未被深审）
 * 本轮补审后确认的缺陷修复锚点。
 *
 * - system-tools：`--eval=<code>` 等号形式绕过内联代码闸门（与裸 -e 等价）；
 *   git -c/--config 可经 alias.`!<命令>` 提权为任意执行，一并入闸
 * - fs-tools：read_file 无大小上限（与 system-tools 的 10MB 输出闸门不对齐）
 * - dsh-integration：显式 undefined 穿透必填校验（String(undefined)="undefined"
 *   文件名）；default 声明是死元数据；registerTool 重名静默覆盖（对齐 01#14）；
 *   工作流结构缺陷（空步骤/重复 id/悬空依赖）推迟到执行期才暴露
 * - benchmark：同步提交失败在 Promise 执行器里逃逸 reject 整个 Promise.all；
 *   「模拟完成」假计数与平台状态脱节；错误率分母挪用 tasksSubmitted
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  execute_command,
  configureCommandPolicy,
  resetCommandPolicy,
} from '../src/tools/system-tools.js';
import { read_file, setFsSandboxRoot } from '../src/tools/fs-tools.js';
import { DSHIntegration } from '../src/dsh/dsh-integration.js';
import { QuantumBenchmark } from '../src/performance/benchmark.js';
import { ToolError } from '../src/utils/errors.js';

describe('Wave 3 收尾 · 命令闸门等号形式与 git -c 提权', () => {
  it('--eval=<code> 等号形式与裸旗标同样被拒绝', async () => {
    configureCommandPolicy({ allowedPrograms: ['node'] });
    try {
      await assert.rejects(
        () => execute_command('node --eval=console.log file.js'),
        (error: unknown) => {
          assert.ok(error instanceof ToolError);
          assert.match(error.message, /Inline-code flag '--eval=console\.log'/);
          return true;
        },
      );
    } finally {
      resetCommandPolicy();
    }
  });

  it('git -c 经 alias 提权被拒绝（默认白名单含 git）', async () => {
    await assert.rejects(
      () => execute_command('git -c alias.pwn=status status'),
      /Inline-code flag '-c'.*git/,
    );
  });

  it('合法命令仍正常执行且 stdin 关闭不悬挂', async () => {
    const out = await execute_command('echo wave3');
    assert.match(out, /wave3/);
  });
});

describe('Wave 3 收尾 · read_file 大小上限', () => {
  it('超过 10MB 的沙箱内文件被干净拒绝', async () => {
    const sandbox = await mkdtemp(join(tmpdir(), 'wave3-fs-'));
    try {
      await setFsSandboxRoot(sandbox);
      await writeFile(join(sandbox, 'big.bin'), Buffer.alloc(10 * 1024 * 1024 + 1));
      await assert.rejects(() => read_file('big.bin'), /exceeds the .* read limit/);
      // 不存在的文件仍走统一 ToolError 路径（大小预检不吞掉原语义）
      await assert.rejects(() => read_file('missing.txt'), /Failed to read file/);
    } finally {
      await setFsSandboxRoot(process.cwd());
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe('Wave 3 收尾 · DSH 参数规范化', () => {
  it('显式 undefined 与缺省同义：必填校验不再被穿透', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    await assert.rejects(
      () => dsh.executeTool('read_file', { path: undefined }),
      /Required parameter 'path' missing/,
    );
  });

  it('声明类型错误仍在边界处指名拒绝', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    await assert.rejects(
      () => dsh.executeTool('read_file', { path: 42 }),
      /Parameter 'path'.*must be a string, got number/,
    );
    await assert.rejects(
      () =>
        dsh.executeTool('subagent', {
          description: 'd',
          prompt: 'p',
          run_in_background: 'yes',
        }),
      /Parameter 'run_in_background'.*must be a boolean/,
    );
  });

  it('default 声明生效：可选参数缺省取默认值', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    dsh.unregisterTool('read_file');
    dsh.registerTool({
      name: 'read_file',
      description: 'read with default path',
      parameters: [{ name: 'path', type: 'string', required: false, default: 'package.json' }],
      returnType: 'string',
      category: 'filesystem',
    });

    const content = (await dsh.executeTool('read_file', {})) as string;
    assert.match(content, /quantum-multi-agent-platform/);

    // 未声明键被丢弃，不夹带进执行器
    const explicit = (await dsh.executeTool('read_file', {
      path: 'package.json',
      sneaky: 'x',
    })) as string;
    assert.match(explicit, /quantum-multi-agent-platform/);
  });

  it('registerTool 重名显式拒绝（对齐 agent 注册 01#14）', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    assert.throws(
      () =>
        dsh.registerTool({
          name: 'web_search',
          description: 'dup',
          parameters: [],
          returnType: 'string',
          category: 'web',
        }),
      /Tool 'web_search' is already registered/,
    );
  });
});

describe('Wave 3 收尾 · 工作流结构校验前移到创建/更新期', () => {
  it('空步骤、重复 id、空工具名在创建时被拒绝', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    assert.throws(() => dsh.createWorkflow({ name: 'empty', steps: [] }), /at least one step/);
    assert.throws(
      () =>
        dsh.createWorkflow({
          name: 'dup',
          steps: [
            { id: '1', tool: 'read_file', parameters: {} },
            { id: '1', tool: 'read_file', parameters: {} },
          ],
        }),
      /Duplicate workflow step id '1'/,
    );
    assert.throws(
      () =>
        dsh.createWorkflow({
          name: 'blank-tool',
          steps: [{ id: '1', tool: '', parameters: {} }],
        }),
      /non-empty tool name/,
    );
  });

  it('悬空依赖在创建时被拒绝（不再等到执行期）', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    assert.throws(
      () =>
        dsh.createWorkflow({
          name: 'dangling',
          steps: [{ id: '1', tool: 'read_file', parameters: {}, dependsOn: ['9'] }],
        }),
      /depends on unknown step '9'/,
    );
  });

  it('updateWorkflow 换入非法步骤同样被拒绝；纯元数据更新不受影响', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    const wf = dsh.createWorkflow({
      name: 'valid',
      steps: [{ id: 'a', tool: 'read_file', parameters: { path: 'package.json' } }],
    });

    assert.throws(
      () =>
        dsh.updateWorkflow(wf.id, {
          steps: [
            { id: 'a', tool: 'read_file', parameters: {} },
            { id: 'b', tool: 'read_file', parameters: {}, dependsOn: ['zz'] },
          ],
        }),
      /unknown step 'zz'/,
    );
    assert.equal(dsh.updateWorkflow(wf.id, { name: 'renamed' }), true);
    assert.equal(dsh.getWorkflow(wf.id)?.name, 'renamed');
  });

  it('依赖成环仍是「创建合法、执行拒绝」的既有契约', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    const wf = dsh.createWorkflow({
      name: 'circular',
      steps: [
        { id: 'a', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['b'] },
        { id: 'b', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['a'] },
      ],
    });
    await assert.rejects(() => dsh.executeWorkflow(wf.id), /circular/i);
  });
});

describe('Wave 3 收尾 · benchmark 指标诚实性', () => {
  it('任务完成走平台真实收尾路径，计数与平台同源', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      await bench.benchmarkAgentRegistration(3);
      const result = await bench.benchmarkTaskSubmission(3);

      assert.deepEqual(result.errors, []);
      assert.equal(result.metrics.tasksSubmitted, 3);
      assert.equal(result.metrics.tasksCompleted, 3);
      assert.equal(result.metrics.units, 3);
      // 平台侧无残留非终态任务
      for (const task of bench.getPlatform().getTasks()) {
        assert.ok(
          task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled',
          `task ${task.id} left in ${task.status}`,
        );
      }
    } finally {
      await bench.cleanup();
    }
  });

  it('同步提交失败被就地记录，不再击穿整轮基准', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      const plat = bench.getPlatform();
      const original = plat.submitTask.bind(plat);
      let calls = 0;
      plat.submitTask = (task: Parameters<typeof original>[0]) => {
        if (calls++ === 1) throw new Error('injected submit failure');
        return original(task);
      };

      const result = await bench.benchmarkTaskSubmission(3);

      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0]!, /injected submit failure/);
      assert.equal(result.metrics.tasksCompleted, 2);
    } finally {
      await bench.cleanup();
    }
  });

  it('收尾失败（幂等守卫拒绝）计入 errors 而非静默丢弃', async () => {
    const bench = new QuantumBenchmark({ communication: { port: 0 } });
    await bench.initialize();
    try {
      const plat = bench.getPlatform();
      const originalComplete = plat.completeTask.bind(plat);
      let completed = 0;
      plat.completeTask = (taskId: string, success?: boolean, result?: unknown) => {
        if (completed++ === 0) return false; // 模拟任务已被 TTL/巡检抢先收尾
        return originalComplete(taskId, success, result);
      };

      const res = await bench.benchmarkTaskSubmission(2);

      assert.equal(res.errors.length, 1);
      assert.match(res.errors[0]!, /could not be completed/);
      assert.equal(res.metrics.tasksCompleted, 1);
    } finally {
      await bench.cleanup();
    }
  });
});
