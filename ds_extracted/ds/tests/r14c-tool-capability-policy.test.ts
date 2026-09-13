/**
 * R14-C 创新 2：工具能力声明与最小权限决策（ToolCapabilityPolicy）的
 * 行为钉死与负对照。
 *
 * 全部为词法/纯函数断言：不触盘、不联网、不 spawn——跨平台路径用
 * path.join/resolve 构造，win32 大小写不敏感语义按 process.platform 分叉。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'path';
import {
  ToolCapabilityPolicy,
  type ToolCapabilityDeclaration,
} from '../src/tools/tool-capability-policy.js';
import { ConfigurationError, ToolError } from '../src/utils/errors.js';

const WIN = process.platform === 'win32';

function workspace(): string {
  return resolve('tests');
}

function policy(): ToolCapabilityPolicy {
  return new ToolCapabilityPolicy([
    `fs.read:${workspace()}`,
    `fs.write:${join(workspace(), 'tmp')}`,
    'cmd:git',
    'cmd:ls',
    'net:internal.example.com',
    'subagent',
  ]);
}

const READ_TOOL: ToolCapabilityDeclaration = {
  toolName: 'read_file',
  capabilities: [{ kind: 'fs.read', param: 'path' }],
};

const WRITE_TOOL: ToolCapabilityDeclaration = {
  toolName: 'write_file',
  capabilities: [{ kind: 'fs.write', param: 'path' }],
};

const CMD_TOOL: ToolCapabilityDeclaration = {
  toolName: 'execute_command',
  capabilities: [{ kind: 'cmd', param: 'program' }],
};

const NET_TOOL: ToolCapabilityDeclaration = {
  toolName: 'http_fetch',
  capabilities: [{ kind: 'net', param: 'host' }],
};

const SUBAGENT_TOOL: ToolCapabilityDeclaration = {
  toolName: 'subagent',
  capabilities: [{ kind: 'subagent' }],
};

describe('ToolCapabilityPolicy · 授权匹配语义', () => {
  it('fs 根内允许、根外拒绝、越界写拒绝且 reason 指名缺失能力', () => {
    const p = policy();
    p.registerTool(READ_TOOL);
    p.registerTool(WRITE_TOOL);

    const inside = p.checkCall('read_file', {
      path: join(workspace(), 'r14c-tool-capability-policy.test.ts'),
    });
    assert.equal(inside.allowed, true);
    assert.deepEqual(inside.matched, [`fs.read:${workspace()}`]);

    const outside = p.checkCall('read_file', { path: resolve('../outside.txt') });
    assert.equal(outside.allowed, false);
    assert.ok(
      outside.reason!.includes('Missing capability grants') && outside.reason!.includes('fs.read:'),
      `reason 应指名缺失能力：${outside.reason}`,
    );

    // 读授权不等于写授权：写根更窄
    const writeInside = p.checkCall('write_file', { path: join(workspace(), 'tmp', 'a.txt') });
    assert.equal(writeInside.allowed, true);
    const writeOutside = p.checkCall('write_file', { path: join(workspace(), 'src-file.ts') });
    assert.equal(writeOutside.allowed, false, '只授予 tmp 子目录的写，父目录其余部分应拒绝');
  });

  it('fs 路径词法归一：分隔符混用、根等值、`..` 逃逸出根均正确裁决', () => {
    const p = new ToolCapabilityPolicy([`fs.read:${join(workspace(), 'data')}`]);
    p.registerTool(READ_TOOL);
    const root = join(workspace(), 'data');
    // 混合分隔符（win32 上正斜杠是合法分隔符）与内部 .. 归一后仍在根内
    const mixed = root.replaceAll('\\', '/') + '/sub/../file.txt';
    assert.equal(p.checkCall('read_file', { path: mixed }).allowed, true, '词法归一后仍在根内');
    assert.equal(p.checkCall('read_file', { path: root }).allowed, true, '根等值合法');
    // .. 逃逸出根：归一后落在根之外
    const escape = join(root, 'sub', '..', '..', 'escape.txt');
    assert.equal(p.checkCall('read_file', { path: escape }).allowed, false, '词法逃逸应拒绝');
  });

  it('cmd 大小写不敏感精确匹配：git/GIT 放行，未授权程序指名拒绝', () => {
    const p = policy();
    p.registerTool(CMD_TOOL);
    assert.equal(p.checkCall('execute_command', { program: 'git' }).allowed, true);
    if (WIN) {
      assert.equal(p.checkCall('execute_command', { program: 'GIT' }).allowed, true);
    }
    const denied = p.checkCall('execute_command', { program: 'npm' });
    assert.equal(denied.allowed, false);
    assert.ok(denied.reason!.includes('cmd:npm'), `reason 应指名：${denied.reason}`);
  });

  it('net 点锚后缀匹配：子域放行、外观相似域拒绝（防伪后缀）', () => {
    const p = policy();
    p.registerTool(NET_TOOL);
    assert.equal(p.checkCall('http_fetch', { host: 'internal.example.com' }).allowed, true);
    assert.equal(p.checkCall('http_fetch', { host: 'api.internal.example.com' }).allowed, true);
    // 无点锚的字符串后缀不得匹配：evil-internal.example.com 不是子域
    const spoof = p.checkCall('http_fetch', { host: 'evilinternal.example.com' });
    assert.equal(spoof.allowed, false, '字符串后缀（无点锚）不得当作子域放行');
    const foreign = p.checkCall('http_fetch', { host: 'example.org' });
    assert.equal(foreign.allowed, false);
  });

  it('subagent 静态授权；多能力工具一次裁决全部能力', () => {
    const p = policy();
    p.registerTool(SUBAGENT_TOOL);
    p.registerTool({
      toolName: 'fetch_and_log',
      capabilities: [
        { kind: 'net', param: 'host' },
        { kind: 'fs.write', param: 'logPath' },
      ],
    });
    assert.deepEqual(p.checkCall('subagent', {}).matched, ['subagent']);

    const both = p.checkCall('fetch_and_log', {
      host: 'internal.example.com',
      logPath: join(workspace(), 'tmp', 'log.txt'),
    });
    assert.equal(both.allowed, true);
    assert.equal(both.matched.length, 2);

    // 一项能力不足即拒绝，reason 只列缺失项
    const partial = p.checkCall('fetch_and_log', {
      host: 'example.org',
      logPath: join(workspace(), 'tmp', 'log.txt'),
    });
    assert.equal(partial.allowed, false);
    assert.ok(partial.reason!.includes('net:example.org'));
    assert.ok(!partial.reason!.includes('fs.write'), '已满足能力不得列入缺失');
  });
});

describe('ToolCapabilityPolicy · default-deny 与注册面', () => {
  it('未声明工具一律拒绝（default-deny）', () => {
    const p = policy();
    const d = p.checkCall('not_declared', {});
    assert.equal(d.allowed, false);
    assert.ok(d.reason!.includes('no capability declaration'));
    assert.deepEqual(d.matched, []);
  });

  it('声明可注销；注销后回到 default-deny', () => {
    const p = policy();
    p.registerTool(CMD_TOOL);
    assert.equal(p.checkCall('execute_command', { program: 'git' }).allowed, true);
    assert.equal(p.unregisterTool('execute_command'), true);
    assert.equal(p.checkCall('execute_command', { program: 'git' }).allowed, false);
    assert.equal(p.unregisterTool('execute_command'), false, '重复注销返回 false');
  });

  it('declaredTools 按注册序返回', () => {
    const p = policy();
    p.registerTool(READ_TOOL);
    p.registerTool(NET_TOOL);
    assert.deepEqual(p.declaredTools(), ['read_file', 'http_fetch']);
  });
});

describe('ToolCapabilityPolicy · 负对照（走私审判）', () => {
  it('非法 grant 串逐条指名拒绝：未知类别/空值/相对路径/带分隔符 cmd/带 scheme 的 net', () => {
    const cases: Array<[string, RegExp]> = [
      ['kernel.read:/tmp', /unknown kind 'kernel.read'/],
      ['fs.read:', /requires a non-empty value/],
      ['fs.read:relative/dir', /requires an absolute directory path/],
      ['cmd:node -e', /bare program name/],
      ['cmd:C:\\Windows\\node.exe', /bare program name/],
      ['net:https://example.com', /plain lowercase domain suffix/],
      ['net:Example.COM ', /plain lowercase domain suffix/],
    ];
    for (const [grant, pattern] of cases) {
      assert.throws(
        () => new ToolCapabilityPolicy([grant]),
        (error: unknown) => error instanceof ConfigurationError && pattern.test(error.message),
        `grant '${grant}' 应指名拒绝`,
      );
    }
    assert.throws(() => new ToolCapabilityPolicy(['']), /must be a non-empty string/);
  });

  it('非法声明逐条指名拒绝：空名/重复注册/空能力/未知类别/缺参数名/subagent 带参数', () => {
    const p = policy();
    assert.throws(
      () => p.registerTool({ toolName: '', capabilities: [{ kind: 'subagent' }] }),
      /toolName must be a non-empty string/,
    );
    p.registerTool(READ_TOOL);
    assert.throws(
      () => p.registerTool(READ_TOOL),
      (e: unknown) =>
        e instanceof ToolError && e.message.includes("'read_file' is already registered"),
    );
    assert.throws(
      () => p.registerTool({ toolName: 'empty', capabilities: [] }),
      /at least one capability/,
    );
    assert.throws(
      () =>
        p.registerTool({
          toolName: 'bad',
          capabilities: [{ kind: 'teleport' as never, param: 'x' }],
        }),
      /unknown kind/,
    );
    assert.throws(
      () => p.registerTool({ toolName: 'noparam', capabilities: [{ kind: 'fs.read' }] }),
      /'fs.read' requires a non-empty param name/,
    );
    assert.throws(
      () =>
        p.registerTool({ toolName: 'subparam', capabilities: [{ kind: 'subagent', param: 'x' }] }),
      /'subagent' takes no param/,
    );
  });

  it('调用点缺参数/参数非字符串/params 非对象指名拒绝（ToolError）', () => {
    const p = policy();
    p.registerTool(READ_TOOL);
    assert.throws(
      () => p.checkCall('read_file', {}),
      /requires a non-empty string parameter 'path'/,
    );
    assert.throws(
      () => p.checkCall('read_file', { path: 42 }),
      /requires a non-empty string parameter 'path'/,
    );
    assert.throws(() => p.checkCall('read_file', null), /params must be an object/);
  });
});
