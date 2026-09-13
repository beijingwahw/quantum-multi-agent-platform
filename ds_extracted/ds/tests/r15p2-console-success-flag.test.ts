/**
 * R15-P2 · 缺陷 1 红测：complete_task 的宽松成功口径。
 *
 * 现状（被定罪）：handleConsoleCommand 的 complete_task 分支用
 * `p.success !== false` 结算——任何非 false 值（"no"、0）都被当成功，
 * 与同文件 submit_task 分支对 priority 的严格类型校验不对称。
 *
 * 修复后契约（镜像 submit_task 的严格校验）：
 * - success 非 undefined 且非 boolean → 具名 MessageValidationError 拒绝，
 *   消息风格对齐既有控制台协议拒绝消息（"Invalid priority '...'"）；
 * - success 缺省 → 默认成功（既有合法载荷行为位级不变）；
 * - success: true/false → 成功/失败（位级不变）。
 *
 * 协议可见面：handleConsoleCommand 消化远程输入失败并走 logError
 * （logger 的 writeErr 在调用时解析 console.*，monkey-patch 语义与
 * 逐调用闭包一致——R13 注释明示该测试钩子）；错误永远输出，不受
 * logLevel=silent 压制。类别具名性在源头钉板（index.ts 抛
 * MessageValidationError），协议面钉消息文本。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumMultiAgentPlatform } from '../src/index.js';

/** 收集 fn 执行期间的 console.error 行（logger 的 logError 出口） */
function withCapturedConsoleError(fn: () => void): string[] {
  const captured: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    captured.push(args.map((a) => String(a)).join(' '));
  };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return captured;
}

function makePlatform(): QuantumMultiAgentPlatform {
  // 不 start：complete_task 分支不依赖总线在线（broadcastConsoleSnapshot
  // 对未启动总线直接返回），silent 压制运行噪音但错误日志仍出
  return new QuantumMultiAgentPlatform({
    communication: { port: 0 },
    logLevel: 'silent',
  });
}

describe('R15-P2 · complete_task success 严格布尔口径', () => {
  it('success:"no" 不再被当成功结算：具名拒绝入日志，任务保持 pending', () => {
    const platform = makePlatform();
    const task = platform.submitTask({ name: 'r15p2-flag', type: 'console', priority: 'medium' });
    assert.equal(task.status, 'pending');

    const captured = withCapturedConsoleError(() => {
      platform.handleConsoleCommand('complete_task', { taskId: task.id, success: 'no' });
    });

    // 修复前：`"no" !== false` → 按 success=true 结算 → completed（红）
    const after = platform.getTasks().find((t) => t.id === task.id)!;
    assert.equal(after.status, 'pending', '畸形 success 不得结算任务');

    // 协议面：失败经 logError 报告（与畸形 taskId 同通道），消息指名字段
    assert.ok(
      captured.some(
        (line) =>
          line.includes("Console command 'complete_task' failed") &&
          line.includes('Invalid success flag') &&
          line.includes('"no"'),
      ),
      `expected a named rejection log line, got: ${JSON.stringify(captured)}`,
    );
  });

  it('success:0 同口径拒绝（非布尔即拒，不止字符串形态）', () => {
    const platform = makePlatform();
    const task = platform.submitTask({ name: 'r15p2-flag-0', type: 'console', priority: 'medium' });

    const captured = withCapturedConsoleError(() => {
      platform.handleConsoleCommand('complete_task', { taskId: task.id, success: 0 });
    });

    const after = platform.getTasks().find((t) => t.id === task.id)!;
    assert.equal(after.status, 'pending', '0 是 falsy 但不是 false，不得静默结算');
    assert.ok(
      captured.some((line) => line.includes('Invalid success flag')),
      '拒绝必须到达日志通道',
    );
  });

  it('位同构边界：合法载荷行为不变（缺省=成功 / true=成功 / false=失败）', () => {
    const platform = makePlatform();
    const tDefault = platform.submitTask({
      name: 'r15p2-dflt',
      type: 'console',
      priority: 'medium',
    });
    platform.handleConsoleCommand('complete_task', { taskId: tDefault.id });
    assert.equal(
      platform.getTasks().find((t) => t.id === tDefault.id)!.status,
      'completed',
      '缺省 success 仍默认成功',
    );

    const tTrue = platform.submitTask({ name: 'r15p2-true', type: 'console', priority: 'medium' });
    platform.handleConsoleCommand('complete_task', { taskId: tTrue.id, success: true });
    assert.equal(platform.getTasks().find((t) => t.id === tTrue.id)!.status, 'completed');

    const tFalse = platform.submitTask({
      name: 'r15p2-false',
      type: 'console',
      priority: 'medium',
    });
    platform.handleConsoleCommand('complete_task', { taskId: tFalse.id, success: false });
    assert.equal(platform.getTasks().find((t) => t.id === tFalse.id)!.status, 'failed');
  });
});
