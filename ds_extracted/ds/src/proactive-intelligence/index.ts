/**
 * 主动智能插件核心模块
 *
 * 提供自主感知、智能决策、主动干预的能力。
 * v1.5 质量跃迁：原 1323 行单文件按职责拆分为
 *   types.ts          共享类型
 *   monitor.ts        状态监控器（Observer）
 *   decision-engine.ts 决策引擎（Brain：规则/条件求值）
 *   executor.ts       动作执行器（策略/超时/重试/取消）
 *   plugin.ts         主插件（装配与事件编排）
 * 本文件仅作公共 API 桶——对外导入路径与导出面保持不变。
 *
 * @module proactive-intelligence
 */

export { GrowthSchedulerBrain } from './brain.js';
export type { MarketBrain, BrainAssignment, BrainState, GrowthAgentSpec } from './brain.js';

export type {
  MonitorEvent,
  DecisionContext,
  DecisionRecord,
  Rule,
  Condition,
  Action,
  ActionExecution,
  PolicyConfig,
  Metrics,
} from './types.js';
export { StateMonitor } from './monitor.js';
export type { StateMonitorConfig, MonitorStatistics } from './monitor.js';
export { DecisionEngine } from './decision-engine.js';
export { ActionExecutor } from './executor.js';
export { ProactiveIntelligencePlugin } from './plugin.js';
export type { ProactiveIntelligencePluginConfig, PluginStatistics } from './plugin.js';

// R14 创新波 opt-in：贝叶斯雇佣大脑（Thompson/greedy/UCB1 + LCB 雇佣阈值）
// 与 Beta 数值内核——不接入默认装配，宿主显式传入 brain 使用
export { BayesianHireBrain, DEFAULT_BAYESIAN_HIRE_CONFIG } from './bayesian-hire-brain.js';
export type {
  HireAgentSpec,
  HirePolicy,
  BayesianHireConfig,
  HireSkillSnapshot,
  HireAgentSnapshot,
  BayesianHireState,
} from './bayesian-hire-brain.js';
export { lgamma, logBeta, betaCdf, betaQuantile } from './beta-distribution.js';
