/**
 * 文档-代码契约钉板（R8-C DOC TRUTH 镜头的可测面）：
 * README/package.json/examples 中"可被机器验证"的声明与代码的逐条对齐。
 * 每条断言都对应一次已定罪的文档失真——防止同类漂移再次发生。
 *
 * 已定罪并修复的失真（本文件的回归对象）：
 * 1. `npm run dev` 指向 src/index.ts——08#53 把 CLI 抽离为 src/cli.ts 后
 *    index.ts 是纯库（直跑即刻退出、零副作用），dev watch 一个什么都不
 *    启动的入口，README "启动平台（WS :8080）" 的声明死掉。
 * 2. README 声称 "示例刻意错开（basic=8081、advanced=8083）"——两个
 *    示例实际早已改为 port: 0（系统分配临时端口）。
 * 3. advanced-workflow.js 演示 dsh: { toolIntegration, workflowEngine }
 *    配置——这些键从未被组件消费、已从 PlatformConfig 删除（deepMerge
 *    静默忽略未知键），示例在教用户配置一个不存在的开关。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const PLATFORM_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

function readRepoFile(rel: string): string {
  return readFileSync(resolve(PLATFORM_ROOT, rel), 'utf8');
}

describe('package.json 脚本契约（npm run dev 必须启动平台）', () => {
  const pkg = JSON.parse(readRepoFile('package.json')) as {
    scripts: Record<string, string>;
  };

  it('dev/start 都指向可执行装配点 src/cli.ts（index.ts 是纯库，直跑零副作用）', () => {
    // 08#53 之后 index.ts 无进程副作用：watch 它 = watch 一个空入口
    assert.match(pkg.scripts.start!, /src\/cli\.ts$/, 'start 必须以 src/cli.ts 为入口');
    assert.match(pkg.scripts.dev!, /src\/cli\.ts$/, 'dev 必须以 src/cli.ts 为 watch 目标');
    assert.ok(
      !pkg.scripts.dev!.includes('src/index.ts'),
      'dev 不得再指向纯库入口 src/index.ts（启动不了平台）',
    );
  });

  it('README 快速开始保留 dev 启动声明（修复后该声明重新为真）', () => {
    const readme = readRepoFile('README.md');
    assert.match(readme, /npm run dev\s+#\s*启动平台（WS :8080/, 'dev 行必须如实声明启动平台');
  });
});

describe('README 端口口径与示例代码对齐', () => {
  it('陈旧的 8081/8083 错开声明不再出现（示例实际用 port: 0）', () => {
    const readme = readRepoFile('README.md');
    assert.ok(!readme.includes('basic=8081'), 'README 不得再声称 basic=8081');
    assert.ok(!readme.includes('advanced=8083'), 'README 不得再声称 advanced=8083');
    assert.match(readme, /port: 0/, 'README 应说明示例用临时端口口径');
  });

  it('basic/advanced 示例确实以 port: 0 运行（声明与代码互证）', () => {
    for (const rel of ['examples/basic-usage.js', 'examples/advanced-workflow.js']) {
      const src = readRepoFile(rel);
      assert.match(src, /port:\s*0/, `${rel} 应配置 communication.port = 0`);
    }
  });

  it('example:basic 的能力描述与示例实际内容一致（无控制台协议环节）', () => {
    const readme = readRepoFile('README.md');
    assert.match(
      readme,
      /npm run example:basic\s+#\s*基础用法全链路（平台启停\/调度\/DSH 工具调用）/,
      'example:basic 行应描述示例真实覆盖的环节',
    );
    const src = readRepoFile('examples/basic-usage.js');
    assert.ok(!src.includes('console_query'), 'basic 示例本身不含控制台协议');
  });
});

describe('示例配置面契约（不演示死配置键）', () => {
  it('advanced-workflow.js 不再包含已删除的 dsh.* 配置块', () => {
    const src = readRepoFile('examples/advanced-workflow.js');
    assert.ok(
      !/dsh:\s*\{/.test(src),
      '示例不得配置从未被消费、已从 PlatformConfig 删除的 dsh.* 键',
    );
    assert.ok(!src.includes('toolIntegration'), 'toolIntegration 是死配置键');
    assert.ok(!src.includes('workflowEngine'), 'workflowEngine 是死配置键');
  });
});

describe('示例退出码纪律', () => {
  it('proactive-intelligence-demo 失败必须反映到退出码（与 basic-usage 同口径）', () => {
    const src = readRepoFile('examples/proactive-intelligence-demo.ts');
    const failMarker = src.indexOf('✗ 示例运行失败');
    assert.ok(failMarker >= 0, '示例应有失败 catch 分支');
    const exitCodeIdx = src.indexOf('process.exitCode = 1');
    assert.ok(
      exitCodeIdx > failMarker,
      '失败分支内必须设置 process.exitCode = 1（静默吞掉让 CI 感知不到失败）',
    );
  });
});
