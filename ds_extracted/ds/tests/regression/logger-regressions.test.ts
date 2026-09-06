/**
 * 日志器域回归网（Q7/Wave4.5，2026-09-06）：
 * 锁定结构化日志的三层契约——级别过滤、人类可读前缀（ISO-8601 UTC
 * 时间戳 + 级别 + 标签）、QUANTUM_LOG_JSON=1 单行 JSON 模式。
 *
 * ① 级别门控：silent 压制 info/debug/warn；warn 只放行 warn；
 *    logError 永不被 silent 吞掉（故障信号不得静默）。
 * ② 人类可读格式：首参为 `[ts] [level] [tag]`，ts 为合法 ISO-8601 UTC
 *    毫秒精度且单调不减；余参原样透传（回归锁定：前缀化重构曾让
 *    包装闭包吞掉余参，消息体整体丢失）。
 * ③ JSON 模式（setLogJsonMode / QUANTUM_LOG_JSON=1）：输出单行可解析
 *    JSON，形状 { ts, level, tag, msg, ...fields }——末位纯对象作
 *    结构化字段；保留字段（ts/level/tag/msg）不可被字段对象伪造；
 *    级别放行前零序列化（silent 下无输出）；不可序列化负载（循环
 *    引用/BigInt）退回人类可读行而非抛错/吞日志。
 */
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  logDebug,
  logError,
  logInfo,
  logWarn,
  setLogJsonMode,
  setLogLevel,
  isLogJsonMode,
} from '../../src/utils/logger.js';

interface CapturedLine {
  kind: 'log' | 'warn' | 'error';
  args: unknown[];
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
let captured: CapturedLine[] = [];

function captureConsole(): void {
  captured = [];
  console.log = (...args: unknown[]) => captured.push({ kind: 'log', args });
  console.warn = (...args: unknown[]) => captured.push({ kind: 'warn', args });
  console.error = (...args: unknown[]) => captured.push({ kind: 'error', args });
}

/** 从 `[ts] [level] [tag]` 首参中抽取时间戳 */
function tsOf(line: CapturedLine): string {
  const first = String(line.args[0]);
  const m = /^\[([^\]]+)\]/.exec(first);
  assert.ok(m, `首参应为 [ts] 前缀格式，got: ${first}`);
  return m[1]!;
}

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('utils/logger 回归（Q7/Wave4.5 结构化日志）', () => {
  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    setLogLevel('info');
    setLogJsonMode(false);
  });

  it('级别门控：silent 压制 info/debug/warn，零输出（零序列化）', () => {
    setLogLevel('silent');
    captureConsole();
    logDebug('T', 'd');
    logInfo('T', 'i');
    logWarn('T', 'w');
    assert.equal(captured.length, 0);
  });

  it('级别门控：warn 只放行 warn；info 放行 info/warn、压制 debug', () => {
    setLogLevel('warn');
    captureConsole();
    logInfo('T', 'i');
    logWarn('T', 'w');
    assert.deepEqual(
      captured.map((c) => c.kind),
      ['warn'],
    );
    setLogLevel('info');
    captureConsole();
    logInfo('T', 'i');
    logWarn('T', 'w');
    logDebug('T', 'd');
    assert.deepEqual(
      captured.map((c) => c.kind),
      ['log', 'warn'],
    );
  });

  it('logError 永不被 silent 吞掉（走 console.error）', () => {
    setLogLevel('silent');
    captureConsole();
    logError('T', 'boom');
    assert.equal(captured.length, 1);
    assert.equal(captured[0]!.kind, 'error');
  });

  it('人类可读格式：首参 `[ISO-8601 UTC 毫秒] [level] [tag]`，余参原样透传', () => {
    setLogLevel('debug');
    captureConsole();
    logInfo('sched', 'hello-msg', { taskId: 't1' });
    assert.equal(captured.length, 1);
    const first = String(captured[0]!.args[0]);
    assert.match(first, /^\[[^\]]+\] \[info\] \[sched\]$/);
    // 回归锁定：前缀化的包装闭包不得吞掉消息体
    assert.equal(captured[0]!.args[1], 'hello-msg');
    assert.deepEqual(captured[0]!.args[2], { taskId: 't1' });
  });

  it('时间戳为合法 ISO-8601 UTC（毫秒精度）且输出序列单调不减', () => {
    setLogLevel('debug');
    captureConsole();
    logInfo('a', '1');
    logWarn('b', '2');
    logDebug('c', '3');
    logError('d', '4');
    assert.equal(captured.length, 4);
    let prev = 0;
    for (const line of captured) {
      const ts = tsOf(line);
      assert.match(ts, ISO_MS, `非法 ISO 时间戳: ${ts}`);
      const t = Date.parse(ts);
      assert.ok(Number.isFinite(t), `Date.parse 失败: ${ts}`);
      assert.ok(t >= prev, '时间戳应单调不减');
      prev = t;
    }
  });

  it('JSON 模式形状：单行可解析 { ts, level, tag, msg }，ts 为合法 ISO', () => {
    setLogJsonMode(true);
    captureConsole();
    logInfo('bus', 'connected');
    assert.equal(captured.length, 1);
    const parsed = JSON.parse(String(captured[0]!.args[0])) as Record<string, unknown>;
    assert.match(String(parsed.ts), ISO_MS);
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.tag, 'bus');
    assert.equal(parsed.msg, 'connected');
    // warn 走 console.warn，JSON 形状一致
    logWarn('bus', 'backpressure');
    const parsedWarn = JSON.parse(String(captured[1]!.args[0])) as Record<string, unknown>;
    assert.equal(parsedWarn.level, 'warn');
    assert.equal(captured[1]!.kind, 'warn');
  });

  it('JSON 模式：末位纯对象作结构化字段；保留字段不可被字段对象伪造', () => {
    setLogJsonMode(true);
    captureConsole();
    logInfo('sched', 'assigned', { taskId: 't9', agentId: 'a1' });
    const parsed = JSON.parse(String(captured[0]!.args[0])) as Record<string, unknown>;
    assert.equal(parsed.msg, 'assigned');
    assert.equal(parsed.taskId, 't9');
    assert.equal(parsed.agentId, 'a1');
    // 伪造尝试：字段对象里的 ts/level/tag/msg 不覆盖保留字段
    logWarn('evil', 'm', { ts: '1970-01-01T00:00:00.000Z', level: 'debug', msg: 'fake' });
    const parsed2 = JSON.parse(String(captured[1]!.args[0])) as Record<string, unknown>;
    assert.notEqual(parsed2.ts, '1970-01-01T00:00:00.000Z');
    assert.equal(parsed2.level, 'warn');
    assert.equal(parsed2.msg, 'm');
  });

  it('JSON 模式：多参消息收敛为数组、单参保持原值；末位非纯对象不作字段', () => {
    setLogJsonMode(true);
    captureConsole();
    logInfo('t', 'a', 'b');
    const multi = JSON.parse(String(captured[0]!.args[0])) as Record<string, unknown>;
    assert.deepEqual(multi.msg, ['a', 'b']);
    // 数组末位：是消息负载而非字段对象
    logInfo('t', 'a', ['x', 'y']);
    const arrTail = JSON.parse(String(captured[1]!.args[0])) as Record<string, unknown>;
    assert.deepEqual(arrTail.msg, ['a', ['x', 'y']]);
    // 单个纯对象：整体即消息（无字段可拆）
    logInfo('t', { k: 1 });
    const solo = JSON.parse(String(captured[2]!.args[0])) as Record<string, unknown>;
    assert.deepEqual(solo.msg, { k: 1 });
  });

  it('JSON 序列化失败（循环引用/BigInt）退回人类可读行，不抛错不吞日志', () => {
    setLogJsonMode(true);
    captureConsole();
    const cyc: Record<string, unknown> = { name: 'cycle' };
    cyc.self = cyc;
    logWarn('probe', 'm', cyc);
    assert.equal(captured.length, 1);
    const first = String(captured[0]!.args[0]);
    assert.match(first, /^\[[^\]]+\] \[warn\] \[probe\]$/);
    assert.equal(captured[0]!.args[1], 'm');
    // BigInt 消息同样触发退回
    logError('probe', 10n);
    assert.match(String(captured[1]!.args[0]), /^\[[^\]]+\] \[error\] \[probe\]$/);
  });

  it('JSON 模式级别门控：silent 下零输出（序列化只发生在级别放行后）', () => {
    setLogJsonMode(true);
    setLogLevel('silent');
    captureConsole();
    logInfo('T', 'i', { a: 1 });
    logWarn('T', 'w');
    assert.equal(captured.length, 0);
  });

  it('setLogJsonMode 运行时切换与 isLogJsonMode 回读', () => {
    assert.equal(isLogJsonMode(), false);
    setLogJsonMode(true);
    assert.equal(isLogJsonMode(), true);
    captureConsole();
    logInfo('t', 'json');
    assert.match(String(captured[0]!.args[0]), /^\{"ts":"/);
    setLogJsonMode(false);
    captureConsole();
    logInfo('t', 'human');
    assert.match(String(captured[0]!.args[0]), /^\[[^\]]+\] \[info\] \[t\]$/);
  });

  it('QUANTUM_LOG_JSON=1 环境变量于模块加载时生效（子进程端到端）', () => {
    // 在父进程（测试文件位置）解析 logger 的绝对 file URL，避免 -e 模块的相对解析歧义
    const loggerUrl = new URL('../../src/utils/logger.js', import.meta.url).href;
    const code = `import { logInfo } from ${JSON.stringify(
      loggerUrl,
    )}; logInfo('bus', 'env-mode', { src: 'child' });`;
    const res = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', code],
      {
        cwd: process.cwd(),
        env: { ...process.env, QUANTUM_LOG_JSON: '1', QUANTUM_LOG_LEVEL: 'info' },
        encoding: 'utf8',
      },
    );
    assert.equal(res.status, 0, `子进程失败: ${res.stderr}`);
    const jsonLine = res.stdout.split('\n').find((l) => l.startsWith('{"ts":'));
    assert.ok(jsonLine, `stdout 应含 JSON 日志行: ${res.stdout}`);
    const parsed = JSON.parse(jsonLine) as Record<string, unknown>;
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.tag, 'bus');
    assert.equal(parsed.msg, 'env-mode');
    assert.equal(parsed.src, 'child');
  });
});
