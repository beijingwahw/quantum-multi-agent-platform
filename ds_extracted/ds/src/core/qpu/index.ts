// QPU 后端层桶导出：真实量子硬件（D-Wave Leap）+ 本地精确引擎 + 桥接与导出
// + 执行层级路由（FTQC 估算器决定 NISQ / FTQC 排队 / 经典回退）
export * from './quantum-backend.js';
export * from './dwave-backend.js';
export * from './solve.js';
export * from './qiskit-export.js';
export * from './ft-estimate.js';
export * from './execution-tier.js';
