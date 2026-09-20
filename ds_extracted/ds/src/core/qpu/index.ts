// QPU 后端层桶导出：真实量子硬件（D-Wave Leap）+ 本地精确引擎 + 桥接与导出
// + 执行层级路由（FTQC 估算器决定 NISQ / FTQC 排队 / 经典回退）
import { registerLocalDefaults } from './quantum-backend.js';
import { registerDWaveDefaults } from './dwave-backend.js';

// Q6：本桶是默认后端的**唯一刻意注册点**。后端模块自身导入零副作用
//（与仓库文档的注册哲学一致）；导入本桶 = 显式选择加入默认注册。
registerLocalDefaults();
registerDWaveDefaults();

export * from './quantum-backend.js';
export * from './dwave-backend.js';
export * from './solve.js';
export * from './qiskit-export.js';
export * from './ft-estimate.js';
export * from './execution-tier.js';
// R14 创新波 opt-in：跨后端共识统计与读出误差缓解解码（未接入默认管线）
export * from './cross-backend-consensus.js';
export * from './readout-mitigation.js';
// R18 创新波 opt-in：噪声感知后端选择器与对易性感知 FT 并行画像（未接入默认管线）
export * from './noise-aware-backend-selector.js';
export * from './commutation-ft.js';
