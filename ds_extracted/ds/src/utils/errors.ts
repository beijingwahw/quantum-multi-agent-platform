/**
 * 领域错误层级 —— 平台所有 throw 的统一类型面。
 *
 * 此前 73 处 `throw new Error` 无差别使用内置 Error，调用方无法按类别捕获
 * （配置错误、调度状态错误、机制误用、后端故障……只能字符串匹配）。
 * 现约定：src 内所有 throw 一律抛本层级的子类；错误消息统一英文
 * （注释/JSDoc 保持中文），保证可检索与跨语言一致。
 */

// type-only：编译期擦除，与 execution-tier.js 无运行时循环依赖
import type { ExecutionTierDecision } from '../core/qpu/execution-tier.js';

/** 平台错误基类：继承 Error 并自动修正 name（避免子类 name 仍是 "Error"） */
export class PlatformError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * 安全违规：边界拒绝的可结构化判别事件。
 * code 是稳定契约（测试与监控断言 code，不匹配文案——文案可读性
 * 优先、code 稳定性优先，两者分离后文案演化不再破坏断言）。
 */
export class SecurityViolationError extends PlatformError {
  constructor(
    message: string,
    readonly code: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** 配置非法：不允许的配置键、非法枚举值、缺少必填项 */
export class ConfigurationError extends PlatformError {}

/** 组件状态机误用：插件重复启动、Brain 未配置、任务状态非法迁移 */
export class StateError extends PlatformError {}

/** 调度器状态错误：未知任务/依赖、任务状态机误用 */
export class SchedulingError extends PlatformError {}

/** 市场机制误用：重复注册 agent、空批次结算、结算不完整 */
export class MechanismError extends PlatformError {}

/** 问题无可行解（约束互相冲突、任务数超过 agent 数等） */
export class InfeasibleProblemError extends PlatformError {}

/** 量子引擎限制：态矢量规模超限、角度参数形状非法等 */
export class QuantumEngineError extends PlatformError {}

/** QPU 后端故障：HTTP/协议错误、轮询超时、响应格式未知 */
export class BackendError extends PlatformError {}

/** FTQC 资源估算错误：非法码距/非法电路画像 */
export class QuantumEstimateError extends PlatformError {}

/**
 * 任务被路由器判定转入 FTQC 等待队列：不立即执行（NISQ 装不下且
 * 容错预算内可行），decision 携带完整资源画像供排队方使用。
 */
export class FtqcDeferredError extends PlatformError {
  constructor(
    message: string,
    readonly decision: ExecutionTierDecision,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** 工具执行错误：DSH 工具/工作流参数校验失败、沙箱违规、命令非法 */
export class ToolError extends PlatformError {}
