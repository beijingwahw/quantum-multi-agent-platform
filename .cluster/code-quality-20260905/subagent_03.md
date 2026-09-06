# QPU 后端 + utils + 类型层审计（主线亲审）

> 审计人：主线（外派两轮因网关重启失败，改为主线执行）
> 范围：src\core\qpu\{quantum-backend,solve,dwave-backend,qiskit-export,index}.ts + src\utils\{errors,rng,numeric,logger}.ts + src\types\quantum-types.ts
> 方法：全部文件全文精读

## 模块概览

QPU 层把调度核心接到真实量子硬件：D-Wave Leap（REST）、IBM Qiskit（程序导出）、本地精确引擎（回退+对照基准）三路径统一在 `QuantumBackend` 接口下。utils 是全平台共享的 PRNG/舍入/日志/错误层级。types 定义 Agent/Task/Message 核心契约。

## 发现清单

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|---|---|---|---|---|
| Q1 | P2 | utils\rng.ts:3 | `DEFAULT_SEED = 42` 全局共享默认种子：两个子系统都用默认种子时随机流完全同序（跨子系统相关性），市场扰动/优化器初始化若共用会引入隐式耦合 | 可复现性最佳实践要求 seed 派生域隔离（seed scoping） | 引入 `deriveSeed(baseSeed, domainSalt)` 按子系统派生；或强制各引擎显式传种子 |
| Q2 | P2 | core\qpu\solve.ts:151 | 浮点容差 `1e-12` 硬编码，与 utils\numeric.ts 的集中口径哲学冲突（同仓两套精度治理） | 单一事实源（numeric.ts 自己声明的约定） | 容差常量并入 numeric.ts（如 `WELFARE_EPS`），solve.ts 引用 |
| Q3 | P2 | core\qpu\dwave-backend.ts:186-207 | 轮询重试策略固定 500ms×1 次，不识别 429/Retry-After，无指数退避；混合求解器长任务下轮询间隔无自适应 | 云 API 客户端标准实践（Retry-After 遵从、jitter 退避） | pollWithRetry 解析 429 的 Retry-After 头；随剩余预算自适应拉长轮询间隔 |
| Q4 | P2 | types\quantum-types.ts:9,19 | `lastHeartbeat/createdAt: Date` 等字段在 WS/JSON 边界会退化为 string（类型谎言），反序列化后 `instanceof Date` 为 false | 边界类型诚实性（Branded ISO string 或 revive 约定） | 边界 DTO 用 `string`（ISO 8601）+ 入站 revive；或文档化序列化契约并加运行时守卫 |
| Q5 | P3 | core\qpu\qiskit-export.ts:76-97 | 生成的 Python `decode()` 与 solve.ts 的 TS 解码逻辑是手工同步的两份实现，跨语言漂移风险（改 TS 不忘 Python 时产生不一致结果） | 单一事实源/代码生成一致性 | 在两处加交叉引用注释 + CI 冒烟（生成程序含自检向量）；或导出测试夹具同时校验两侧 |
| Q6 | P3 | core\qpu\quantum-backend.ts:159 | 模块顶层 `registerBackend(new LocalQuantumBackend())` 是 import 副作用，与 dwave-backend.ts:294 声明的「导入零副作用」哲学不一致（虽无凭据风险，但破坏了自家原则的一致性） | 零副作用模块设计 | 与 LazyDWaveRegistration 统一为显式 `registerDefaults()` 或都在入口注册 |
| Q7 | P3 | utils\logger.ts:23-58 | 无时间戳、无结构化输出（JSON）、无级别标注；热路径性能注释很好，但生产可观测性弱 | 2026 主流：pino 式结构化日志。本仓零运行时依赖约束下可自研轻量版 | logInfo 等加 ISO 时间戳与级别前缀；预留 `QUANTUM_LOG_JSON` 开关 |
| Q8 | P3 | core\qpu\solve.ts:57-59 | 本地路径 `numReads` 缺省钉 128 而硬件路径缺省 100（注释解释了原因），但两个缺省值分叉本身增加认知负担 | 配置单一事实源 | QpuSolveOptions 统一缺省并文档化差异；或抽 `DEFAULT_NUM_READS` 常量对 |
| Q9 | P3 | core\qpu\dwave-backend.ts:151 | qp 压缩格式在 `num_solutions` 缺失时按位流全长解码（`maxSolutions`），字对齐 padding 位若非全零会解码出幻影样本（有 min 保护但依赖上游格式约定） | 防御性解析 | num_solutions 缺失时直接 BackendError（缺字段比幻影数据安全） |
| Q10 | P3 | core\qpu\solve.ts:155 | `optimality` 仅在 `optimal > 0` 时提供：全零福利问题（合法但退化）静默丢失对照信息 | 可观测性完整性 | 退化为 `optimal >= 0` + ratio 守卫（optimal===0 时 ratio 定义为 1 若 achieved 也为 0） |

## 模块级优点（值得保留 / 全仓推广）

1. **三道校验闸门**（solve.ts 头注）：QPU 采样进调度器前过合法性/能量核对/本地最优对照——对噪声硬件的零信任姿态是教科书级
2. **int32 回绕坑位注释**（solve.ts:85）：`1 << q` 在 q≥32 回绕，QPU 路径不经中间整数态直接解码——深位数值素养
3. **角度-span 校准**（qiskit-export.ts:50-63）：归一化能量上训练的角度导出时除以 span，>20 qubits 用 L1 上界近似并明示非严格——诚实标注近似边界
4. **端点 https 强制**（dwave-backend.ts:75-78）：防注入明文 endpoint 外带 token——SSRF 意识
5. **孤儿问题取消**（dwave-backend.ts:101-104）：提交后任何失败 best-effort 取消，不烧 QPU 配额——成本意识
6. **幻影样本防护**（dwave-backend.ts:169-172）：qp 格式解数不越过实际可用位——统计口径保护
7. **懒注册代理**（dwave-backend.ts:287+）：import 零副作用、构造错误推迟到调用点包装为领域错误
8. **错误层级**（errors.ts）：`new.target.name` 修正 + 9 个域分类 + 英文消息/中文注释约定
9. **集中舍入**（numeric.ts）：round9/round2/round3 禁止业务代码散写

## Top3 升级建议（本半区）

1. **种子域隔离**（Q1）：引入 seed 派生，消除跨子系统随机流同序的隐式耦合——影响所有优化/市场引擎的可复现实验有效性
2. **云 API 重试现代化**（Q3）：Retry-After 遵从 + 自适应轮询间隔——真 QPU 路径的韧性短板
3. **边界类型诚实化**（Q4）：Date 字段的序列化契约——通信层（另路审计）若同样裸用 Date，这是一处跨模块 P2
