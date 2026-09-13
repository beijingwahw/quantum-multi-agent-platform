/**
 * R13 基建优化回归网（agent D 领地：入口/工具/bench 基建/示例与控制台象限）。
 *
 * 本轮性能编辑全部承诺「可观测行为位级同一」——本文件锁定各编辑点的
 * 契约不变量，使任何语义漂移（哪怕快了）都会在这里变红：
 *
 * - dsh-integration：topologicalSort 改迭代消费（替代 shift）后，乱序
 *   声明的菱形依赖图仍按 Kahn 出队序执行；工具模块惰性单例后连续调用
 *   语义不变（第二次调用走缓存命名空间，同样返回真实结果）。
 * - system-tools：分词空白探测外提为常量正则后，多/前/后置空白命令的
 *   token 边界不变；eval 旗标的等号前缀形态（预派生常量表）仍被拒绝
 *   且指名原始 token。
 * - fs-tools：沙箱前缀串（含 win32 小写形态）随 setFsSandboxRoot 刷新——
 *   根目录切换后旧根内文件立即越界、新根内文件放行（缓存失步即逃逸
 *   或误拒，两方向都钉）。
 * - logger：输出流适配器外提为模块常量后，console.* 仍在调用时解析
 *   （后置 monkey-patch 生效）、余参透传不丢。
 * - index：控制台优先级 Set 化后四值放行、畸形值拒绝且不产生任务。
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DSHIntegration } from '../src/dsh/dsh-integration.js';
import { read_file, setFsSandboxRoot } from '../src/tools/fs-tools.js';
import {
  execute_command,
  configureCommandPolicy,
  resetCommandPolicy,
} from '../src/tools/system-tools.js';
import { logInfo } from '../src/utils/logger.js';
import QuantumMultiAgentPlatform from '../src/index.js';

describe('R13 · dsh-integration 拓扑排序（迭代消费替代 shift）', () => {
  it('乱序声明的菱形依赖仍按依赖序执行（Kahn 出队次序不变）', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();

    // 声明顺序故意打乱：d 依赖 b/c，b/c 各依赖 a——合法拓扑序唯一为
    // a → (b,c 按入度归零次序) → d；shift 与迭代消费必须给出同一序列
    const workflow = dsh.createWorkflow({
      name: 'diamond',
      steps: [
        { id: 'd', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['b', 'c'] },
        { id: 'b', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['a'] },
        { id: 'c', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: ['a'] },
        { id: 'a', tool: 'read_file', parameters: { path: 'package.json' }, dependsOn: [] },
      ],
    });

    const results = await dsh.executeWorkflow(workflow.id);
    assert.deepEqual(
      results.map(([id]) => id),
      ['a', 'b', 'c', 'd'],
      '拓扑序必须与 shift 实现逐点一致（a 先行、b/c 按入度归零次序、d 收尾）',
    );
  });

  it('宽工作流（并行链扇入）按稳定次序完成且计数完整', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    // 12 个无依赖步骤 + 1 个汇点：大队列是对 shift O(n²) 搬移的敏感面，
    // 迭代消费必须一次不差地访问每个节点
    const steps = Array.from({ length: 12 }, (_, i) => ({
      id: `leaf-${i}`,
      tool: 'read_file',
      parameters: { path: 'package.json' },
      dependsOn: [] as string[],
    }));
    steps.push({
      id: 'sink',
      tool: 'read_file',
      parameters: { path: 'package.json' },
      dependsOn: steps.map((s) => s.id),
    });
    const workflow = dsh.createWorkflow({ name: 'wide-fan-in', steps });

    const results = await dsh.executeWorkflow(workflow.id);
    assert.equal(results.length, 13);
    assert.equal(results[12]![0], 'sink', '汇点必须在全部叶子之后');
  });

  it('工具模块惰性单例：连续两次 executeTool 都返回真实结果', async () => {
    const dsh = new DSHIntegration({});
    await dsh.initialize();
    // 第二次调用走缓存的模块命名空间——若缓存失效（null 卡死/错误模块）
    // 会在此暴露
    const first = (await dsh.executeTool('read_file', { path: 'package.json' })) as string;
    const second = (await dsh.executeTool('read_file', { path: 'package.json' })) as string;
    assert.ok(first.includes('quantum-multi-agent-platform'));
    assert.equal(second, first, '同一文件的两次读取应逐字节一致');
  });
});

describe('R13 · system-tools 校验路径（常量外提后语义不变）', () => {
  afterEach(() => {
    resetCommandPolicy();
  });

  it('多/前/后置空白的分词边界与单空白一致（WHITESPACE 常量正则）', async () => {
    const out = await execute_command('echo    spaced     tokens  ');
    assert.equal(out.trim(), 'spaced tokens', '多余空白不得进入 token 值');
  });

  it('eval 旗标的等号前缀形态仍被拒绝且指名原始 token（预派生前缀表）', async () => {
    configureCommandPolicy({ allowedPrograms: ['node'] });
    await assert.rejects(
      () => execute_command('node --eval=process.exit(2)'),
      (err: unknown) =>
        err instanceof Error && err.message.includes("Inline-code flag '--eval=process.exit(2)'"),
      '等号形式与裸旗标同语义，必须以原始 token 指名拒绝',
    );
  });
});

describe('R13 · fs-tools 沙箱前缀缓存（随根切换刷新）', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await setFsSandboxRoot(process.cwd());
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('根目录切换后：旧根内文件立即越界，新根内文件放行', async () => {
    const rootA = mkdtempSync(join(tmpdir(), 'r13-sandbox-a-'));
    const rootB = mkdtempSync(join(tmpdir(), 'r13-sandbox-b-'));
    dirs.push(rootA, rootB);
    writeFileSync(join(rootA, 'inside-a.txt'), 'A', 'utf8');
    writeFileSync(join(rootB, 'inside-b.txt'), 'B', 'utf8');

    await setFsSandboxRoot(rootA);
    assert.equal(await read_file('inside-a.txt'), 'A');

    await setFsSandboxRoot(rootB);
    await assert.rejects(
      () => read_file(join(rootA, 'inside-a.txt')),
      /escapes the filesystem sandbox/,
      '切根后旧根文件必须立即被判越界（前缀缓存失步=安全击穿）',
    );
    assert.equal(await read_file('inside-b.txt'), 'B');
  });
});

describe('R13 · logger 输出流适配器（模块常量后 console 仍调用时解析）', () => {
  const originalLog = console.log;
  afterEach(() => {
    console.log = originalLog;
  });

  it('后置 monkey-patch console.log 生效且余参透传不丢', () => {
    const seen: unknown[][] = [];
    console.log = (...args: unknown[]) => {
      seen.push(args);
    };
    logInfo('r13-tag', 'msg-body', { k: 1 }, 'tail');
    assert.equal(seen.length, 1);
    const first = seen[0]!;
    assert.match(String(first[0]), /^\[[^\]]+\] \[info\] \[r13-tag\]$/);
    assert.equal(first[1], 'msg-body');
    assert.deepEqual(first[2], { k: 1 });
    assert.equal(first[3], 'tail');
  });
});

describe('R13 · 控制台优先级 Set 化（成员语义不变）', () => {
  it('畸形优先级拒绝且不产生任务；合法四值放行', () => {
    const platform = new QuantumMultiAgentPlatform({
      communication: { port: 0 },
      performance: { metricsInterval: 60000 },
    });
    try {
      // 拒绝面：错误被 handleConsoleCommand 消化（不沿事件链上抛），
      // 任务表保持空
      assert.doesNotThrow(() =>
        platform.handleConsoleCommand('submit_task', { name: 'bad', priority: 'ridiculous' }),
      );
      assert.equal(platform.getTasks().length, 0, '畸形优先级不得产生任务');

      for (const p of ['low', 'medium', 'high', 'critical'] as const) {
        platform.handleConsoleCommand('submit_task', { name: `ok-${p}`, priority: p });
      }
      assert.equal(platform.getTasks().length, 4, '四个合法优先级全部放行');
    } finally {
      platform.dispose();
    }
  });
});
