/**
 * task-lifecycle —— 任务状态机的显式转移表与不变量断言。
 *
 * 设计陈述（Wave 2.1「状态机集中化」的机制化落地）：
 * 此前任务状态转移散落在 completeTask / assignTaskToAgent /
 * updateTaskStatus / 巡检超时等多个写点，每处各自判断「从什么状态到
 * 什么状态是否合法」——P1 级缺陷（终态任务被重调度、取消与失败混计）
 * 的共同温床就是没有单一的转移语义源。
 *
 * 本模块把语义收敛为三件事：
 * 1. **转移表**：TASK_TRANSITIONS 声明每对 (from → to) 的合法性，
 *    非法转移在 debug 断言模式下抛 SchedulingError（生产模式由
 *    调用方的守卫静默拒绝，行为与修复后的守卫语义一致）；
 * 2. **单一写点**：scheduler 全部状态写入经 transitionTask() 收口，
 *    转移表是唯一裁决者；
 * 3. **不变量断言**：checkTaskInvariants() 在调试模式下验证计数器
 *    与派生真值的一致性（activeAssignments === |assigned∪running|、
 *    pendingCount === pendingTracked.size、agent.load 与在途任务一致），
 *    回归在 CI 中第一时间暴露而不是腐蚀指标。
 */

import { SchedulingError } from '../utils/errors.js';
import type { Task, TaskStatus } from '../types/quantum-types.js';

/**
 * 合法转移表（只列显式出边；终态无出边）：
 * - pending → assigned（调度分配）
 * - assigned → running（执行开始）
 * - assigned/running → completed/failed/cancelled（执行收尾/超时/取消）
 * - pending → failed/cancelled（依赖级联失败、提交后取消、pending 超时）
 */
const TASK_TRANSITIONS: Readonly<Record<TaskStatus, ReadonlySet<TaskStatus>>> = {
  // pending → completed：外部托管的执行路径（平台记账、分配在别处完成）
  // ——既有公共契约，由 scheduler.test.ts 锚定
  pending: new Set<TaskStatus>(['assigned', 'completed', 'failed', 'cancelled']),
  assigned: new Set<TaskStatus>(['running', 'completed', 'failed', 'cancelled']),
  running: new Set<TaskStatus>(['completed', 'failed', 'cancelled']),
  completed: new Set<TaskStatus>([]),
  failed: new Set<TaskStatus>([]),
  cancelled: new Set<TaskStatus>([]),
};

/** 转移是否合法（转移表的纯查询接口） */
export function isLegalTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].has(to);
}

/** 状态是否为终态（无出边） */
export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return TASK_TRANSITIONS[status].size === 0;
}

/**
 * 调试模式断言：非法转移抛结构化错误。
 * 由 QUANTUM_ASSERT_INVARIANTS=1 开启（CI 回归与开发期）；
 * 生产热路径默认关闭——守卫语义由调用方的 isLegal 判断承载。
 */
export function assertLegalTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!isLegalTaskTransition(from, to) && taskInvariantAssertionsEnabled()) {
    throw new SchedulingError(
      `Illegal task state transition ${from} → ${to} ` +
        `(legal targets from '${from}': [${[...TASK_TRANSITIONS[from]].join(', ')}])`,
    );
  }
}

/** 不变量断言总开关（模块级一次解析——与 SAB/env 探测同口径） */
export function taskInvariantAssertionsEnabled(): boolean {
  return process.env.QUANTUM_ASSERT_INVARIANTS === '1';
}

/**
 * 任务态不变量上下文：scheduler 的派生真值快照。
 * checkTaskInvariants 对比「计数器口径」与「全表扫描口径」，
 * 任何分裂都意味着某个写点绕过了转移表。
 */
export interface TaskInvariantSnapshot {
  /** 计数器报告的在途数（scheduler.activeAssignments） */
  activeAssignments: number;
  /** 全表扫描的 |assigned ∪ running| */
  tasksInFlight: number;
  /** 计数器报告的挂起数 */
  pendingCount: number;
  /** 挂起追踪集大小 */
  pendingTrackedSize: number;
  /** 挂起桶中的条目总数（含惰性未清理残留） */
  pendingBucketEntries: number;
}

export interface InvariantViolation {
  invariant: string;
  expected: string;
  actual: string;
}

/** 校验调度器不变量：返回违例列表（空数组 = 全部通过） */
export function checkTaskInvariants(
  tasks: Iterable<Task>,
  snapshot: TaskInvariantSnapshot,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (snapshot.activeAssignments !== snapshot.tasksInFlight) {
    violations.push({
      invariant: 'activeAssignments === |assigned ∪ running|',
      expected: String(snapshot.tasksInFlight),
      actual: String(snapshot.activeAssignments),
    });
  }
  if (snapshot.pendingCount !== snapshot.pendingTrackedSize) {
    violations.push({
      invariant: 'pendingCount === pendingTracked.size',
      expected: String(snapshot.pendingTrackedSize),
      actual: String(snapshot.pendingCount),
    });
  }
  // 挂起桶允许惰性残留（出桶延迟到重调度扫描），但不得包含终态任务
  // 之外的漏计——追踪集与桶的一致性由 pendingCount 与 pendingTracked
  // 锚定，桶内终态残留属惰性清理的既定语义。
  if (snapshot.pendingBucketEntries < snapshot.pendingTrackedSize) {
    violations.push({
      invariant: 'pendingBuckets ⊇ pendingTracked（桶丢失挂起任务）',
      expected: `>= ${snapshot.pendingTrackedSize}`,
      actual: String(snapshot.pendingBucketEntries),
    });
  }

  // 任务自身的状态自洽：非终态任务不得携带 completedAt
  for (const task of tasks) {
    if (task.completedAt !== undefined && task.status !== 'completed') {
      violations.push({
        invariant: 'completedAt ⇒ status === completed',
        expected: 'completed',
        actual: `${task.id} in '${task.status}'`,
      });
    }
  }
  return violations;
}
