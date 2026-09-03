import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Mulberry32, mulberry32, shuffled, DEFAULT_SEED } from '../src/utils/rng.js';
import { setLogLevel, getLogLevel, logDebug, logInfo, logWarn } from '../src/utils/logger.js';
import { round2, round3, round9 } from '../src/utils/numeric.js';
import {
  PlatformError,
  ConfigurationError,
  SchedulingError,
  StateError,
  MechanismError,
  InfeasibleProblemError,
  QuantumEngineError,
  BackendError,
  ToolError,
} from '../src/utils/errors.js';

describe('utils/rng（全平台唯一 PRNG）', () => {
  it('同种子完全可复现，异种子序列不同', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    for (let i = 0; i < 100; i++) {
      const x = a();
      assert.equal(x, b());
      assert.notEqual(x, c());
    }
  });

  it('输出落在 [0,1)，大样本均值趋近 0.5（分布健全性）', () => {
    const rng = mulberry32(DEFAULT_SEED);
    let sum = 0;
    const n = 100_000;
    let min = 1;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const x = rng();
      assert.ok(x >= 0 && x < 1);
      sum += x;
      if (x < min) min = x;
      if (x > max) max = x;
    }
    assert.ok(Math.abs(sum / n - 0.5) < 0.01);
    assert.ok(min < 0.01 && max > 0.99);
  });

  it('Mulberry32：reseed 重置序列且保持对象身份', () => {
    const m1 = new Mulberry32(7);
    const first = [m1.next(), m1.next(), m1.next()];
    m1.reseed(7);
    const second = [m1.next(), m1.next(), m1.next()];
    assert.deepEqual(second, first);
  });

  it('shuffled：保持元素多重集合且确定性可复现', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = shuffled(items, mulberry32(11));
    const s2 = shuffled(items, mulberry32(11));
    assert.deepEqual(s2, s1);
    assert.deepEqual(
      [...s1].sort((x, y) => x - y),
      items,
    );
    assert.notDeepEqual(shuffled(items, mulberry32(12)), s1);
  });
});

describe('utils/logger（分级日志）', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  let logCalls: number;
  let warnCalls: number;

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    setLogLevel('info');
  });

  function instrumentConsole(): void {
    logCalls = 0;
    warnCalls = 0;
    console.log = () => {
      logCalls++;
    };
    console.warn = () => {
      warnCalls++;
    };
  }

  it('级别门控：silent 压制 info/debug/warn 输出', () => {
    setLogLevel('silent');
    instrumentConsole();
    logDebug('T', 'x');
    logInfo('T', 'x');
    logWarn('T', 'x');
    assert.equal(logCalls, 0);
    assert.equal(warnCalls, 0);
  });

  it('级别门控：info 放行 info/warn、压制 debug；warn 只放行 warn', () => {
    setLogLevel('info');
    instrumentConsole();
    logInfo('T', 'x');
    logDebug('T', 'x'); // debug 高于 info，被压制
    assert.equal(logCalls, 1);
    assert.equal(warnCalls, 0);
    setLogLevel('warn');
    instrumentConsole();
    logInfo('T', 'x');
    logWarn('T', 'x');
    assert.equal(logCalls, 0);
    assert.equal(warnCalls, 1);
  });

  it('getLogLevel 回读当前级别', () => {
    setLogLevel('debug');
    assert.equal(getLogLevel(), 'debug');
    setLogLevel('warn');
    assert.equal(getLogLevel(), 'warn');
  });
});

describe('utils/numeric（舍入约定）', () => {
  it('round2/3/9：各自精度正确（基于 Math.round 的既定行为锁定）', () => {
    assert.equal(round2(3.14159), 3.14);
    assert.equal(round3(3.14159), 3.142);
    assert.equal(round9(0.123456789123), 0.123456789);
    assert.equal(round2(2.675), 2.68);
    assert.equal(round2(-2.675), -2.67); // -2.675×100 的浮点表示是 -267.49999…，向 +∞ 取整
  });
});

describe('utils/errors（领域错误层级）', () => {
  it('所有子类 instanceof PlatformError 与 Error，且 name 正确', () => {
    const cases: Array<[Error, string]> = [
      [new ConfigurationError('c'), 'ConfigurationError'],
      [new StateError('s'), 'StateError'],
      [new SchedulingError('s'), 'SchedulingError'],
      [new MechanismError('m'), 'MechanismError'],
      [new InfeasibleProblemError('i'), 'InfeasibleProblemError'],
      [new QuantumEngineError('q'), 'QuantumEngineError'],
      [new BackendError('b'), 'BackendError'],
      [new ToolError('t'), 'ToolError'],
    ];
    for (const [err, name] of cases) {
      assert.ok(err instanceof PlatformError, `${name} 应是 PlatformError`);
      assert.ok(err instanceof Error, `${name} 应是 Error`);
      assert.equal(err.name, name);
      assert.ok(err.message.length > 0);
    }
  });

  it('调用方可按类别选择性捕获（迁移 throw 的目的所在）', () => {
    const throwIt = (): never => {
      throw new ConfigurationError("key '__proto__' is not allowed");
    };
    let caught: string | null = null;
    try {
      throwIt();
    } catch (error) {
      if (error instanceof SchedulingError) caught = 'scheduling';
      else if (error instanceof ConfigurationError) caught = 'configuration';
    }
    assert.equal(caught, 'configuration');
  });

  it('cause 选项透传（Error cause 链）', () => {
    const root = new Error('root cause');
    const wrapped = new BackendError('poll failed', { cause: root });
    assert.equal(wrapped.cause, root);
  });
});
