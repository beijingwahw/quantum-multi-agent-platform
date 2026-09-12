/**
 * R12 调度器并发上限回归（engine-orchestrator 批量路径）：
 *
 * ① R12#1 批量路径的并发余量双扣：slots 在 collectBatchContext 已按
 *    「maxConcurrent − 入口时在役数」预扣，全空间分块与子空间轮准备又用
 *    `activeAssignments() >= slots` / `slots − activeAssignments()` 二次扣减
 *    同一批在役任务——A0 ≥ slots（利用率过半）时批量调度静默空转，
 *    A0 < slots 时系统性少派。与单任务路径（tryAssign 的
 *    `activeAssignmentCount >= maxConcurrent`）和 01#4 QPU 修复的规范公式
 *    （实时余量 = maxConcurrent − activeAssignments()）矛盾。
 * ② R12#2 子空间异步轮的 await 窗口无并发复查：recordSubspaceRound 以
 *    maxAssign: Infinity 套用坍缩解，演化 await（serialAnnealEvolveAsync 的
 *    setImmediate 让出 / waitAsync）期间事件路径（completeTask→重调度、
 *    并发 scheduleTask）消耗的并发位不被感知——01#4 同族的 check-then-act
 *    残余，可超订 maxConcurrentTasks。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumScheduler } from '../../src/core/quantum-scheduler.js';
import { makeAgent, makeTask } from '../helpers/fixtures.js';

describe('R12 批量量子调度并发上限', () => {
  it('R12#1a 利用率过半时批量调度不得静默空转：仍须吃满剩余并发位', () => {
    const scheduler = new QuantumScheduler({
      scheduling: { autoSchedule: false, maxConcurrentTasks: 4 },
    });
    // 8 个 agent：3 个被单任务路径占用（A0=3），5 个空闲
    for (let i = 1; i <= 8; i++) scheduler.registerAgent(makeAgent(`a${i}`, ['js']));

    for (let i = 1; i <= 3; i++) {
      const t = scheduler.submitTask(makeTask(`busy-${i}`, 'js'));
      scheduler.scheduleTask(t.id);
    }
    const inFlightBefore = scheduler.getTasks().filter((t) => t.status === 'assigned').length;
    assert.equal(inFlightBefore, 3, '前置：3 个在役任务（余量 4−3=1）');

    // 3 个待派任务：批量联合调度应吃满剩余 1 个并发位
    for (let i = 1; i <= 3; i++) scheduler.submitTask(makeTask(`batch-${i}`, 'js'));

    const report = scheduler.scheduleBatchQuantum();

    const inFlight = scheduler.getTasks().filter((t) => t.status === 'assigned').length;
    assert.equal(report.assigned, 1, '批量调度必须用掉最后一个并发位（4−3=1）');
    assert.equal(inFlight, 4, '在役数恰好到达上限');
    assert.ok(inFlight <= 4, '在役任务不得超过 maxConcurrentTasks');
    assert.deepEqual(scheduler.checkInvariants(), [], '计数器口径与全表扫描一致');
    scheduler.shutdown();
  });

  it('R12#1b 多分块批量不得因余量重复扣减而漏派：入口余量内逐块吃满', () => {
    // A0=0、maxConcurrent=4、5 任务分 3 块（qubitCap=12 ⇒ 2 任务 × 5 agent/块）：
    // 旧代码块 1 派 2 后，块 2 的余量被「slots−active」二次扣成 2、与累计
    // 已派数(2)比较即刻断裂——5 任务只派 2。正确行为：入口余量 4 内吃满。
    const scheduler = new QuantumScheduler({
      scheduling: { autoSchedule: false, maxConcurrentTasks: 4 },
    });
    for (let i = 1; i <= 5; i++) scheduler.registerAgent(makeAgent(`a${i}`, ['js']));
    for (let i = 1; i <= 5; i++) scheduler.submitTask(makeTask(`t${i}`, 'js'));

    const report = scheduler.scheduleBatchQuantum();

    const inFlight = scheduler.getTasks().filter((t) => t.status === 'assigned').length;
    assert.equal(report.assigned, 4, '入口余量 4 内逐块吃满（而非首块后即断）');
    assert.equal(inFlight, 4);
    assert.ok(inFlight <= 4, '在役任务不得超过 maxConcurrentTasks');
    assert.deepEqual(scheduler.checkInvariants(), [], '计数器口径与全表扫描一致');
    scheduler.shutdown();
  });

  it('R12#2 子空间异步轮的 await 窗口并发复查：事件路径占位后不得超订', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: false,
        maxConcurrentTasks: 4,
        quantumAlgorithm: 'quantum-annealing',
        // 步数放大使 serialAnnealEvolveAsync 的忙时预算（4ms）必然触发
        // setImmediate 让出——await 窗口真实存在，窗口内注入并发位消耗
        quantum: { anneal: { tau: 20, steps: 1500 } },
      },
    });
    // 8 个 js agent（联合窗口 P(8,4)=1680 维）+ 1 个独立 reserve agent
    for (let i = 1; i <= 8; i++) scheduler.registerAgent(makeAgent(`a${i}`, ['js']));
    scheduler.registerAgent(makeAgent(`r9`, ['reserve']));

    for (let i = 1; i <= 4; i++) scheduler.submitTask(makeTask(`T${i}`, 'js'));

    // await 窗口内的事件路径：经典调度路径接走 reserve → activeAssignments 0→1
    const reportPromise = scheduler.scheduleBatchQuantumAsync();
    setImmediate(() => {
      const reserve = scheduler.submitTask(makeTask('R', 'reserve'));
      scheduler.scheduleTask(reserve.id);
    });
    const report = await reportPromise;

    const inFlight = scheduler.getTasks().filter((t) => t.status === 'assigned').length;
    assert.equal(
      scheduler.getTasks().filter((t) => t.name === 'R')[0]!.status,
      'assigned',
      'await 窗口内的事件路径已占用 1 个并发位',
    );
    assert.equal(report.assigned, 3, '子空间解只可套用剩余余量（4−1=3），不得超订');
    assert.ok(inFlight <= 4, '总在役任务不得超过 maxConcurrentTasks');
    assert.deepEqual(scheduler.checkInvariants(), [], '计数器口径与全表扫描一致');
    scheduler.shutdown();
  });
});
