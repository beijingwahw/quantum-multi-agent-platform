/**
 * 量子引擎命名常量 —— 此前以字面量散落在 optimizer/scheduler 各处。
 *
 * 约定：改这里的值 = 改变引擎数值行为，必须同步跑全量测试
 * （tests/ 中多个基准断言依赖这些默认值的精确结果）。
 * 语义相同但历史上取值不同的旋钮（如全空间 vs 子空间退火长度）
 * 保留各自的命名常量，差异是物理依据的（见各处注释）。
 */

/** 求解器公共默认：QAOA 层数 p */
export const DEFAULT_QAOA_LAYERS = 3;
/** 求解器公共默认：shots-best 模式测量次数 */
export const DEFAULT_SHOTS = 128;
/** 求解器公共默认：QAOA 角度优化随机重启次数 */
export const DEFAULT_RESTARTS = 2;
/** 求解器公共默认：输出 top-K 候选数 */
export const DEFAULT_TOP_K = 3;

/** 全空间绝热退火默认：总时长 tau（罚项景观粗糙，需长退火） */
export const FULLSPACE_ANNEAL_TAU = 120;
/** 全空间绝热退火默认：Trotter 步数 */
export const FULLSPACE_ANNEAL_STEPS = 1200;
/** 子空间绝热退火默认：总时长 tau（零罚项景观干净，短退火即可全命中） */
export const SUBSPACE_ANNEAL_TAU = 20;
/** 子空间绝热退火默认：Trotter 步数 */
export const SUBSPACE_ANNEAL_STEPS = 150;
/**
 * 串行演化异步驱动的让出预算（毫秒）：连续计算超过该时长才 await 一次
 * setImmediate——小维度快演化几乎不触发（开销趋零），大维度（每步毫秒
 * 级）近似每步让出。取 4ms：低于常见心跳/定时器粒度（Node 定时器 1ms
 * 粒度、WS 心跳数十 ms），足够保活且摊薄 setImmediate 开销。
 */
export const SERIAL_YIELD_BUDGET_MS = 4;

/** 全空间态矢量的量子比特硬上限（1<<31 起位掩码回绕；2^30 已需 ~17GB） */
export const FULLSPACE_QUBIT_LIMIT = 30;

/** 子空间引擎默认维度上限（buildSubspaceModel 缺省值） */
export const SUBSPACE_DIMENSION_CAP = 1 << 21;
/**
 * 调度器批量路径的子空间维度上限缺省（较引擎默认收紧一档，
 * 控制调度时延与内存——~150MB），可通过 config.subspaceCap 覆盖。
 */
export const SCHEDULER_SUBSPACE_CAP = 1 << 20;
/** 子空间 QAOA 仍可变分训练的维度上限（超过自动改用退火一次演化） */
export const SUBSPACE_QAOA_DIMENSION_LIMIT = 1 << 16;

/** 坐标下降角度优化：初始步长 / 终止步长 / 改进判定阈值 / 收缩因子 */
export const ANGLE_STEP_INITIAL = 0.3;
export const ANGLE_STEP_MIN = 1e-3;
export const ANGLE_IMPROVEMENT_EPS = 1e-12;
export const ANGLE_STEP_SHRINK = 0.5;

/**
 * born 坍缩的合法质量下限（08#18/08#27）：末态落在合法分配上的 Born
 * 质量低于该值时（罚参数失效/演化发散的病态电路），单次 Born 采样几乎
 * 必然采到非法态、随即被修复逻辑改写成「伪 Born」结果——与其伪造一次
 * 随机坍缩，不如显式走 argmax-valid 兜底并把漂移暴露给日志。
 * 子空间引擎全体基态合法，同一常数充当幺正性漂移的护栏阈值。
 */
export const BORN_VALID_MASS_FLOOR = 1e-6;
/** 坐标下降角度边界：γ ∈ [0, π]，β ∈ [0, π/2] */
export const GAMMA_BOUND = Math.PI;
export const BETA_BOUND = Math.PI / 2;

/** 穷举最优对照的量子比特上限（2^16 基态的能量 DFS 在此范围内瞬时完成） */
export const BRUTE_FORCE_QUBIT_LIMIT = 16;

/** 调度器全空间分块的量子比特上限默认（4096 维希尔伯特空间） */
export const SCHEDULER_QUBIT_CAP = 12;
