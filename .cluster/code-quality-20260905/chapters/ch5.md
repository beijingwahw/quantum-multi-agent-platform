# 第 5 章 升级路线图

前四章给出的是「哪里有问题」；本章回答「按什么顺序修」。路线图分四个波次，遵循两条原则：**先止损、再还账、后升级**（风险递减排序），以及**每个波次独立可验收**（不合入未达验收标准的下一波）。波次周期为估计值（人日口径），对应发现编号见各素材附录。

## 5.1 总览

| 波次 | 主题 | 周期 | 核心目标 | 主要输入 |
|---|---|---|---|---|
| Wave 1 | 止损 | 1-2 天 | 三条已验证 P0/P1 最小补丁 + EOL 栈清理 + CI 硬化 | subagent_01/02、subagent_07、review.md |
| Wave 2 | 补状态机 | 1 周 | 状态机集中化单写点、生命周期漏洞结构化修复、plugin 并发池化 | subagent_01/02/08 |
| Wave 3 | 一致性还账 | 2-4 周 | 数值口径统一固化、共享函数抽取、测试确定性改造、覆盖缺口补审 | subagent_01/05/08/09、review.md |
| Wave 4 | 面向 2027 | 1-2 月 | 工具链现代化（TS 7 评估、exports、worker 文件化、结构化日志） | subagent_03/04/07/08 |

## 5.2 Wave 1「止损」（1-2 天）

**目标**：消除已验证的吞吐塌陷与状态机静默损坏风险，清掉三处踩线 EOL 的过期栈，把 CI 从「跑得全」升级到「跑得安全」。全部改动为最小补丁，可随下个 patch 版本发布。

| # | 条目 | 证据 | 内容 | 成本 |
|---|---|---|---|---|
| 1.1 | plugin 动作串行执行（P0，已验证） | plugin.ts:140-186 | batch 内动作由双层 `for...await` 串行改为并行执行（`Promise.allSettled` + 简单信号量），先保证并发上限真实生效 | 0.5 天 |
| 1.2 | scheduleTask 无状态守卫（P1，已验证） | quantum-scheduler.ts:~460 | 入口加 `status === 'pending'` 前置检查，非 pending 拒绝 | 0.5 天 |
| 1.3 | overloaded 吸收态（P1，已验证） | quantum-scheduler.ts:402-406 | 释放分支最小补丁：`working || overloaded` 均按当前 load 重判状态 | 0.5 天 |
| 1.4 | Node 20 EOL 清理 | package.json engines | engines `>=20` → `>=22.11`（或 `>=24`），CI 矩阵去掉 20 | 0.5 天 |
| 1.5 | ESLint 9 → 10 | package.json devDeps | ESLint 9 已于 2026-08-06 EOL；tseslint 8.69+ 已支持 ^10，flat config 平移，主要是规则移名清理 | 0.5 天 |
| 1.6 | CI 硬化 | ci.yml 全文 | 加 `timeout-minutes`（如 15）、`concurrency` 取消同分支旧跑、`permissions: contents: read`、供应链扫描一步（osv-scanner 或 `npm audit --omit=dev`） | 0.5 天 |

**验收标准**：① 三条修复各带新增回归测试（重复调度已终态任务、overloaded agent 负载归零后回到候选池、多动作规则的真实并发 ≥2）；② CI 在 2 OS × Node {22,24} 矩阵全绿，现有 c8 门禁 92/82/92/92 与 knip 门禁不回退；③ ESLint 10 下 lint 零 error；④ CI 配置含 timeout/concurrency/permissions 三项。

**风险**：动作并行化改变执行顺序，可能触碰依赖顺序语义的现有断言（保留规则间优先级顺序可缓解）；Node 下限提升对仍用 Node 20 的下游是破坏性变更，需在 CHANGELOG 标注 major 语义；ESLint 10 规则移名可能产生批量 lint 改动，应与功能改动分 PR。

## 5.3 Wave 2「补状态机」（1 周）

**目标**：把 Wave 1 的补丁升级为结构性修复——状态转移收敛到单写点，生命周期漏洞（无界、不检测环、指标口径混淆）一并收口。这是全仓唯一的系统性风险面。

| # | 条目 | 证据 | 内容 |
|---|---|---|---|
| 2.1 | TaskLifecycleManager 集中化 | quantum-scheduler.ts（src 内最大单文件，四类职责混合） | 拆出状态机+计数器单元，status 写入收拢为唯一写点；调试模式不变量断言（`activeAssignments === |assigned∪running|`、`pendingCount === pendingTracked.size`、`agent.load` 与在途任务一致） |
| 2.2 | overloaded 恢复纳入统一转移 | quantum-scheduler.ts:402-406 + agent-manager.ts 状态机 | 修复 scheduler 侧吸收态后，将 agent-manager 的 increase/decrease/setAgentState/updateAgent 多入口不变量收敛为内部单点 `setState`，updateAgent 拒绝绕过校验直写 state/load |
| 2.3 | pending TTL | quantum-scheduler.ts:~648（sweep） | sweep 增加 pending 超时（按 createdAt 起算，超时标 `failed: {reason: 'pending_timeout'}`）；巡检定时器移到构造函数或 submitTask（当前首次分配成功才启动） |
| 2.4 | 依赖环检测 | quantum-scheduler.ts:~290（submitTask） | 提交期沿 dependencies 做受限 DFS，检环即抛 `SchedulingError` |
| 2.5 | plugin 并发池化（结构化版） | plugin.ts + executor.ts:100-119 | 有限并发池（p-limit 语义）+ 保留规则间优先级；配套 executor 预检失败状态区分（rejected/skipped 与 failed 分列，消除「拒绝计入失败、safeMode 跳过计入成功」的口径混淆） |

**验收标准**：① 不变量断言在调试模式下全量通过（可用现有 28 文件测试套件叠加新断言跑一轮）；② 构造 overloaded → 全部任务完成 → 断言 agent 回到 idle 且重新入候选池的集成用例通过；③ 环依赖任务提交被拒且带结构化错误；④ pending 队列在超时后被回收、`pendingCount` 归零；⑤ plugin 并发压测下事件风暴不再无界堆积。

**风险**：状态机重构触及 scheduler 核心，是本路线图回归风险最高的一步——必须以 Wave 1 的回归测试 + 现有 92% 行覆盖门禁做安全网；不变量断言只在调试模式开启，避免生产热路径开销；拆分动作建议分多个 PR（先抽状态机、再拆引擎编排），避免一次大爆炸重构。

## 5.4 Wave 3「一致性还账」（2-4 周）

**目标**：把散落各处的数值口径与双实现收敛为单一事实源，并把「可复现」从注释承诺升级为 CI 强制；同时补齐本次审计的覆盖缺口。

| # | 条目 | 证据 | 内容 |
|---|---|---|---|
| 3.1 | 数值口径清单 + 快照测试 | 亲和度双求和序（quantum-scheduler.ts:~725 vs ~805）、myopic 舍入（batch-vcg-scheduler.ts:~600）、sort 稳定性隐式依赖（solver-common.ts:~105）、MCF 双 ε（min-cost-flow.ts:~85-100） | 建立求和序/舍入点/容差/比较器决胜规则的口径清单，为每项固化黄金值快照测试 |
| 3.2 | 共享函数抽取 | denormalizeExpectation 三处三写（全空间×2 + 子空间×2，subagent_08 #15/#24）；top-K 双实现；affinityScore 双序 | 抽取 `denormalizeExpectation()`、`topKByProbability()`、`affinityScore()` 单一实现，双路径调用点统一 |
| 3.3 | 测试确定性改造 | proactive-intelligence.test.ts:20-27 等 8+ 用例 setImmediate 魔法数；security-hardening.test.ts:116-122 消息正则断言 | 被测系统暴露 `flush()` 原语，测试改事件驱动等待；src 侧引入结构化错误码（如 `SecurityViolationError.code`），安全断言从文案正则改为 code 断言 |
| 3.4 | dsh/tools 深审补课 | dsh-integration.ts（15.4KB）、tools/fs-tools.ts、system-tools.ts、web-tools.ts、performance/benchmark.ts | 按 subagent_09 的 F 系列标准（边界校验/背压/错误分类）补完深审，发现并入附录 |

**验收标准**：① 快照测试进入 CI 且锁定当前黄金值；② 双实现统一后现有机制测试（VCG 闭式值断言、DSIC 实证组）全绿；③ CI 慢机压力下（如限时降频）测试套件无间歇红；④ 补审覆盖声明更新——「工具层仅边界扫描」的标注可以移除。

**风险**：统一数值口径可能改变既有输出（如近平局时选出不同 agent）——凡是行为改变的口径项，须在 PR 描述中显式列出并附新旧值对比；快照测试对浮点跨平台差异敏感，容差与确定性（种子化）需先行确认。

## 5.5 Wave 4「面向 2027」（1-2 月）

**目标**：工具链与包结构对齐 2026-09 前沿基线（依据见第 2 章），为 TS 7 时代做铺垫。本波以评估与增量改造为主，不阻塞前三波。

| # | 条目 | 证据 | 内容 |
|---|---|---|---|
| 4.1 | TS 7 原生编译器迁移评估 | TS 7.0（2026-08，Go 原生）已发布，构建提速 8-12x | 评估 CI 类型检查切换 tsgo 的可行性；「tsc 慢」消失后可考虑把全量 typed lint 提频 |
| 4.2 | exports 子路径拆分 | index.ts 单文件重导出 60+ 符号 | package.json 增加 `./mechanism`、`./qpu` 等子路径，index 只留平台主类；补 files/sideEffects 白名单 |
| 4.3 | worker 独立文件化 | subspace-parallel.ts Function.toString 自制打包器 | fiber 内核提为独立 worker 入口文件（`new Worker(new URL(...))`），消除对打包器改写的脆弱依赖 |
| 4.4 | isolatedDeclarations 评估 | tsconfig 现无此项（I5） | 库发 declaration 场景评估迁移成本，配合并行声明发射 |
| 4.5 | 结构化日志 | utils/logger.ts:23-58（无时间戳/级别/结构化） | 加 ISO 时间戳与级别前缀，预留 `QUANTUM_LOG_JSON` 开关，对齐 pino 式可观测性 |
| 4.6 | 覆盖率 artifact + 变更行覆盖 | ci.yml Coverage 步骤（I11） | 覆盖率报告上传 artifact（失败可查明细）；增量加 PR 变更行覆盖 ≥80% 门禁 |

**验收标准**：① TS 7 评估产出结论文档（可迁/不可迁 + 阻塞项清单）；② exports 拆分后消费方可按子路径导入且 tree-shaking 生效；③ worker 文件化后并行/串行位级一致测试仍通过；④ 覆盖率 artifact 在 CI 失败时可下载。

**风险**：TS 7 与 typescript-eslint/Oxc 工具链的兼容成熟度需跟踪（发布仅一个月）；exports 拆分对下游导入路径是 breaking change，建议 major 版本承载；变更行覆盖门禁初期限 advisory（不阻塞），观察误报率后再转硬门禁。

> 可选加菜（非本路线图承诺）：oxlint 分层 lint、fast-check PBT、发包流 trusted publishing——均见第 2 章对标清单，团队按需排期。

## 5.6 执行纪律

- **顺序不可倒置**：Wave 2 依赖 Wave 1 的回归测试安全网；Wave 3 的快照测试依赖 Wave 2 收敛后的稳定行为；Wave 4 独立可并行启动评估类条目。
- **每波一个验收 PR**：附前后对比数据（吞吐、测试稳定性、lint/覆盖率数字），不合入无验收证据的改动。
- **口径以 brief 为准**：涉及规模与发现总数的外部表述（约 190 条：P0×1、P1×约15、P2×约60、P3×约110）统一引用，避免与素材估算混淆。
