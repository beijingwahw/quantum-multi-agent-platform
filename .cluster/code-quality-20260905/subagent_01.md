# core 调度算法审计

> 审计范围：`src/core/` 调度与经典算法半区（quantum-scheduler / batch-vcg-scheduler / growth-market-scheduler / min-cost-flow / classical-baselines / market-estimation / fiber-kernel / solver-common / constants），参考 `src/types/quantum-types.ts` 类型契约。
> 审计人：subagent_01 | 日期：2026-09-05 | 全部证据经全文精读，行号为近似值（±10 行），均可按函数名回查。

## 模块概览

| 模块 | 行数级 | 职责 |
|---|---|---|
| quantum-scheduler.ts | ~1540 | `QuantumScheduler`：agent/task 注册表 + 事件驱动单任务调度（hybrid 波函数评分 / quantum-qaoa / quantum-annealing）+ 批量联合量子调度（约束子空间精确引擎 → 全空间态矢量分块 → QPU 后端三级路径）+ 周期巡检（超时回收/保留清理）+ 计数器化指标 |
| batch-vcg-scheduler.ts | ~800 | `BatchVCGScheduler`：容量约束批量 VCG 拍卖（MinCostFlow 求 WDP + bundle 级 Clarke pivot 支付）、预算紧时 λ-拉格朗日二分、仿射 μ-VCG（公开乘子精确 DSIC）、`BudgetPacer` 在线乘子校准；附短视基线与谎报收益实证测量 |
| growth-market-scheduler.ts | ~430 | `GrowthMarketScheduler`：单任务市场（market/greedy/round-robin 三策略），学习曲线 + UCB 探索 + 切换成本 + 声誉 EWMA |
| min-cost-flow.ts | ~130 | SPFA 连续最短增广最小费用流，自由处置变体（仅沿负费用路增广，允许最优弃标） |
| classical-baselines.ts | ~190 | 匈牙利算法（Jonker-Volgenant 风格 O(n³)）+ 最陡上升局部搜索（成对交换+单点移动，QAP 标准基线） |
| market-estimation.ts | ~185 | 双调度器共享估值层：贝叶斯质量、UCB 探索、切换成本、有效质量、声誉、结算历史环形窗口 |
| fiber-kernel.ts | ~230 | 子空间演化零依赖纯函数内核（纤维混合闭式旋转 / 代价相位递推 / DFS2 纤维组构建），主线程与 Worker 双路径位级一致 |
| solver-common.ts | ~330 | 双引擎共享机制：复振幅寄存器、CVaR 目标、选项缺省解析、坐标下降角度优化、Born 采样 |
| constants.ts | ~60 | 量子引擎命名常量（层数/维度上限/退火参数/角度优化旋钮） |

整体架构水准显著高于常见业务代码：机制设计有定理级注释（DSIC 证明梗概、Green-Laffmont 不可能性边界）、物理内核有不变量契约、性能索引有复杂度注释、随机性全链路种子化。主要风险集中在 **QuantumScheduler 的状态机完整性**与若干边界条件。

---

## 发现清单

### P1（状态机完整性缺陷，静默损坏）

**1 | P1 | quantum-scheduler.ts:~468（scheduleTask）| 公开调度入口无任务状态守卫**
`scheduleTask(taskId)` 只校验任务存在与依赖满足，不校验 `task.status === 'pending'`。对已 `assigned`/`running` 的任务再次调用（外部重试是最自然的调用场景）：`assignTaskToAgent` 同样无守卫，会覆盖 `assignedAgentId`、旧 agent 的 `load` 不回减、`activeAssignments` 重复递增；对已 `completed` 的任务调用则将其改回 `assigned`，随后 `completeTask` 的幂等守卫判定非终态会把它最终标成 `failed`（经超时巡检）——完成任务被静默改判为失败。
- 前沿标准依据：公开状态转移 API 必须自带前置条件守卫（state machine precondition），不能依赖调用方自律；"guard clauses at public boundaries" 是 2026 年类型化状态机审计的基线要求。
- 修复建议：`scheduleTask` 与 `assignTaskToAgent` 开头加 `if (task.status !== 'pending') return null / return;`，与 `reschedulePendingTasks` 内部已有的惰性状态检查对齐。

**2 | P1 | quantum-scheduler.ts:~365（completeTask 释放分支）+ ~1452（assignTaskToAgent）| overloaded 状态在调度器内无恢复路径**
`assignTaskToAgent` 中 `load > AGENT_OVERLOAD_THRESHOLD` 时置 `state = 'overloaded'`；但 `completeTask` 释放 agent 时仅处理 `state === 'working'` 的分支（`working → idle|overloaded`）。一旦 agent 在分配中越过阈值进入 `overloaded`，后续任务全部完成、`load` 归零，状态仍是 `overloaded`；而 `resolveCandidates`/空闲池筛选只接受 `state === 'idle'`——该 agent **永久退出候选池**（除非外部经 `updateAgent` 手工重置；本文件内无任何重置路径）。连带后果：`getSystemMetrics().systemLoad` 只数 `working`，全员 overloaded 时系统显示零负载。
- 前沿标准依据：状态机必须无死锁态（每个可达状态都有出边或显式声明为终态）；"overloaded" 作为可恢复的过载信号而非吸收态，是调度器的基本契约。
- 修复建议：释放分支改为 `if (agent.state === 'working' || agent.state === 'overloaded') { agent.state = agent.load > AGENT_OVERLOAD_THRESHOLD ? 'overloaded' : 'idle'; }`。若 agent-manager（本次范围外）已有外部恢复逻辑，应在注释中显式声明该依赖，避免双头维护。

### P2（边界条件与不变量漏洞）

**3 | P2 | quantum-scheduler.ts:~940（scheduleBatchQuantum 第 5 步分块循环）| qubitCap 不变量对"单任务 × 大空闲池"失效**
注释声明不变量"任务数×agent数 ≤ qubitCap（态矢量内存上限）"，但循环条件 `if (current.length > 0 && (current.length + 1) * idlePool.length > qubitCap)` 的 `current.length > 0` 前置条件使**首个任务永不触发分块**：当 `idlePool.length > qubitCap` 时每个 chunk 都是 1 任务 × N agent = N 量子比特，直接突破上限。可达路径：用户配置 `subspaceCap` 小于 agent 数（如 subspaceCap=100、200 个 agent）→ 子空间路径 `buildSubspaceModel` 返回 null → 回退全空间 → 单任务 chunk 编码 200 量子比特 → 引擎在调度中段抛 RangeError/OOM。代码注释自己也承认"超限配置应在配置期报错，而不是让引擎在调度中段抛出"，但当前既没有配置期校验、也没有运行期兜底。
- 前沿标准依据：内存上限类不变量必须对退化输入（单元素 chunk）成立；配置错误应在配置期 fail-fast。
- 修复建议：分块后加 `if (idlePool.length > qubitCap) throw new SchedulingError(...)`（或对空闲池截断/采样并在报告中声明）；同时在配置读取处校验 `qubitCap ≤ FULLSPACE_QUBIT_LIMIT`、`subspaceCap ≥ agents 上限预期`。

**4 | P2 | quantum-scheduler.ts:~1330-1390（scheduleBatchQuantumQpu）| 异步 QPU 路径并发背压失效**
`round` 与 `slots` 在 `await solveAssignmentOnBackend(...)` **之前**切片计算；await 期间事件循环可运行其它调度（如 `completeTask → reschedulePendingTasks`），消耗并发额度。await 返回后 `applyJointSolution` 以 `maxAssign: Infinity` 应用结果，**不复查** `activeAssignments` 与 `maxConcurrentTasks`——并发上限可被突破。对比：子空间与全空间路径均为同步，`round` 切片即安全；只有 QPU 路径暴露该窗口。值得肯定的是 `agent?.state !== 'idle'` 的逐任务复查挡住了 agent 级冲突，但没挡住总量级冲突。
- 前沿标准依据：async 边界之后的预算/配额类断言必须重新求值（"re-validate after await"），快照式背压检查是并发审计的标准检出项。
- 修复建议：`applyJointSolution` 的 `opts.maxAssign` 传入 `maxConcurrent != null ? Math.max(0, maxConcurrent - this.activeAssignments) : Infinity`（在 await 之后求值）。

**5 | P2 | quantum-scheduler.ts:~648（sweep）| 挂起任务无 TTL，内存无界增长**
巡检只回收 `assigned/running` 超时任务与已终结任务的保留清理；`pending` 任务永不超时。需求不可满足（无 agent 具备所需能力）或依赖阻塞的任务永久驻留 `tasks` / `pendingBuckets` / `pendingTracked`。长运行平台下是不可回收的内存泄漏，且 `pendingCount` 指标持续虚高。另注：巡检定时器在**首次分配成功**后才启动（`ensureSweepTimer` 仅在 `assignTaskToAgent` 调用），从未分配过任务的实例连保留清理都不会运行。
- 前沿标准依据：所有驻留集合都需有 TTL 或容量上限（bounded queues），这是长时运行服务的资源审计基线；对比同仓 `SettlementHistory`（环形窗口）与 `schedulingHistory`（maxHistory 封顶）都做了有界化，pending 集合是唯一漏网者。
- 修复建议：sweep 增加 pending-TTL（按 `createdAt` 起算，超时标 `failed: {reason: 'pending_timeout'}`）；`ensureSweepTimer` 移到构造函数或 `submitTask`。

**6 | P2 | quantum-scheduler.ts:~290（submitTask）| 依赖校验不检测环**
提交时校验依赖 ID 存在，但不检测环。A↔B 互相依赖的任务双双永久 pending（`dependenciesMet` 永假），叠加发现 5 变成永久泄漏。`cascadeFailure` 的注释表明作者已知环形依赖可能出现（"环形依赖下重复到达的任务在守卫处早退"）——即环被容忍为运行期事实，却在入口不拒绝。
- 前沿标准依据：DAG 依赖图必须在入边处做环检测（提交期 O(V+E) DFS），运行期靠幂等守卫兜底是必要的但不是充分的。
- 修复建议：submitTask 沿 `task.dependencies` 做受限 DFS 检测环，检测到即 `throw new SchedulingError(...)`。

**7 | P2 | quantum-scheduler.ts:~1490（checkCapabilityMatch / calculateCapabilityScore）| resource/location/quantum 类需求被静默忽略**
类型契约 `TaskRequirement.type: 'capability' | 'resource' | 'location' | 'quantum'`（quantum-types.ts）定义了四类需求，但 `checkCapabilityMatch` 对非 capability 类型一律 `return true`，`calculateCapabilityScore` 也只统计 capability——带 GPU 资源需求或位置需求的任务会被调度到任何空闲且能力匹配的 agent，**需求被静默丢弃**，无警告无日志。
- 前沿标准依据：类型系统定义了变体（discriminated union）而实现只覆盖其一，属于"契约-实现偏移"；至少应在调度时对未支持的需求类型发出显式警告或拒绝任务。
- 修复建议：短期在 `submitTask` 对含未支持需求类型的任务打 `logWarn` 或直接拒绝；长期按类型契约实现 resource/location 匹配。

**8 | P2 | quantum-scheduler.ts:~856（makeTrueQuantumDecision）| 求解失败静默回退 agents[0]，且照报 Born 概率**
`const chosen = agentIndex >= 0 ? agents[agentIndex]! : agents[0]!;`——求解器返回 -1（无合法采样且 argmax-valid 失败）时静默选第一个 agent，而 `probability: solution.probability`、`confidence: solution.validMass` 仍按"测量坍缩结果"上报——报告的概率语义与实际选择脱钩（选择了 X，报告的是失败采样的 Born 概率）。下游 `quantumProbabilitySum` 累计的也是这份失真数据，污染 `getQuantumMetrics().meanProbability`。
- 前沿标准依据：测量/概率类指标必须与实际决策一一对应（observability integrity）；降级路径必须显式标注（reasoning 字段应声明 fallback）。
- 修复建议：回退时 `reasoning` 前缀 `'fallback: solver returned no valid sample; '`，`probability` 置 0 且不计入 `quantumProbabilitySum`；或直接抛 `QuantumEngineError`。

**9 | P2 | solver-common.ts:~150-190（resolveCommonSolverOptions）| 漏验 restarts / topK，退化参数静默产出空解**
入口对 `layers/shots/cvarAlpha/angleMode` 做了严格校验（注释明确动机："退化参数在此入口拒绝而非让 NaN 静默流穿整个态矢量"），但 `restarts` 与 `topK` 直接 `?? DEFAULT` 不校验。`restarts: 0`（或负数）传入后，`optimizeAnglesByCoordinateDescent` 的重启循环零次执行，返回 `{ angles: [], expectation: Infinity }`——空角度数组 + Infinity "最优期望"作为正常返回值流向引擎，正是该校验函数想防住的那类静默垃圾。
- 前沿标准依据：参数校验入口的覆盖必须完备（all-or-nothing），部分校验造成的虚假安全感比不校验更危险。
- 修复建议：补 `Number.isInteger(restarts) && restarts >= 1`、`Number.isInteger(topK) && topK >= 1` 校验；同时让坐标下降对 `restarts < 1` 抛 `QuantumEngineError` 作深度防御。

### P3（数值一致性 / 健壮性 / 可维护性）

**10 | P3 | quantum-scheduler.ts:~725（makeQuantumDecision）vs ~805（agentAffinity）| 同一亲和度两种求和顺序，ULP 级分歧**
两套权重常量数值相同（0.3/0.4/0.2/0.1），但单任务路径按 `distance+capability+load+correlation` 求和、批量路径按 `capability+load+correlation+distance` 求和。浮点加法不满足结合律，同一 (agent, task) 对在两条路径产生 ~1e-17 级差异，近平局时可能选出不同 agent。本仓在 solver-common 头部、fiber-kernel、localSearchAssignment 注释中反复以"位级一致"为契约标准（甚至为此放弃局部搜索的增量评估），此处却存在未被声明的口径分歧。
- 修复建议：抽一个 `affinityScore(c: AffinityComponents, w)` 唯一实现固定求和序，两处调用。

**11 | P3 | solver-common.ts:~300（sampleIndexByProbabilities）| `r <= cum` 边界可采到零概率态**
`if (r <= cum) return k;`——当 `rng()` 恰好返回 0 且 `probs[0] === 0` 时（Mulberry32 可产生精确 0），返回 0 号基态，采样到概率为 0 的态，违背 Born 规则忠实性。概率 1/2³²，但该函数的文档定位就是"Born 规则的忠实实现"。
- 修复建议：改为 `if (r < cum) return k;`（与 `sampleBestIndexByShots` 的 `cum[mid]! < r` 二分语义对齐）。

**12 | P3 | market-estimation.ts:~170（SettlementHistory.push）| 满员后每次 splice(0,1) 为 O(cap)**
`this.entries.splice(0, this.entries.length - this.cap)` 在环形窗口满后每次 push 都从头部搬移 ~10000 元素。同仓 min-cost-flow.ts 的注释专门批评过同型模式（"shift() 每次搬移整个数组（O(n)）……head 前移语义等价、均摊 O(1)"）——仓库自身的性能标准没有贯彻到这里。
- 修复建议：改为头指针环形缓冲（`head` 前移 + 覆写），`successRate` 按环形序读取；或至少 amortize（满后一次性砍半）。

**13 | P3 | batch-vcg-scheduler.ts:~640（settleBatch）| 部分结算先变更后抛错，状态半更新**
结算循环先对已提交结果逐条 `recordSettlement` / 更新声誉 / 累计利润，循环后才检查完整性并 throw。抛出时履历已半更新、`lastAllocation` 仍保留——恢复语义不对称：补齐缺失任务重调可成功，但带上已结算任务则触发 "settled twice" 二次报错，调用方很难推断正确恢复姿势。
- 前沿标准依据：validate-then-mutate 顺序（先全景校验再变更）是带副作用的批处理接口的标准形态。
- 修复建议：先收集并校验全部结果（存在性、去重、完整性），校验通过后再进入变更循环。

**14 | P3 | quantum-scheduler.ts:~218（registerAgent）| 重复注册静默覆盖，且不清扫悬空纠缠引用**
`registerAgent` 对已存在 id 直接覆盖（重置 quantumState 与 agentStats），而同仓 `BatchVCGScheduler.register` / `GrowthMarketScheduler.register` 对重复 id 均 `throw MechanismError`——三个调度器两种契约。另外 `unregisterAgent` 不清理**其他 agent** 的 `quantumEntanglement` 数组中指向被注销者的引用，`buildBatchProblem` 的耦合扫描会遇到悬空 id（仅导致耦合静默不生效，无崩溃）。
- 修复建议：registerAgent 对重复 id 抛 `SchedulingError`；unregister 时遍历清理纠缠引用（或在耦合扫描处容忍并 logDebug）。

**15 | P3 | quantum-scheduler.ts:~283（updateTaskStatus）| cancelled 计入 failedCount，指标口径混淆**
`status === 'cancelled'` 走 `completeTask(taskId, false, ...)`，`failedCount++`——取消与失败在指标上不可区分，`getSystemMetrics().failedTasks` 语义被稀释。任务对象上也没有 cancelled 独立终态字段可供对账（status 虽为 'cancelled'，但计数器合一）。
- 修复建议：completeTask 增加取消分支独立计数（`cancelledCount`），或在 metrics 中区分。

**16 | P3 | quantum-scheduler.ts:~345（completeTask）| actualDuration 从 createdAt 起算**
`task.actualDuration = now - task.createdAt`——含排队等待时间。对"执行耗时"语义（应从 `assignedAt` 起算）失真，依赖该字段做超时归因/SLA 统计会系统性偏大。
- 修复建议：`assignedAt ? now - assignedAt : now - createdAt`，或同时记录 `queueDuration` 与 `execDuration`。

**17 | P3 | batch-vcg-scheduler.ts:~600（allocateMyopic）| payments 逐项未 round9，与 VCG 路径舍入口径不一**
`solveWithPayments` / `allocateAffineBatch` 对每个 `payments[agentId]` 逐项 `round9`，`allocateMyopic` 累加的是裸浮点值（仅 totalPayment 与 welfare 汇总时舍入）。跨路径的支付数值在 1e-9 位不一致，对照实验（myopic vs VCG 支付差）会引入舍入噪声。
- 修复建议：myopic 的每次 `payments[...] += pay` 后同样 `round9`。

**18 | P3 | solver-common.ts:~60 / ~235 / ~120；fiber-kernel.ts:~30 | 求解器热路径的分配噪音**
(a) `expectationValue` 每次角度评估都 `probabilities()` 新建 Float64Array(dim)——坐标下降每轮几百次评估 × dim 元素，GC 压力可观；(b) `optimizeAnglesByCoordinateDescent` 内层 `for (const sign of [1, -1])` 每角度每步长分配数组字面量；(c) `cvarExpectationOrdered` 用 `for..of` 遍历 Int32Array（迭代器协议开销，约为索引循环 2 倍），而它恰是 CVaR 模式下每次评估的热点；(d) `applyFiberRunsKernel` 每次调用分配两个 Float64Array(64) 缓存——但注释已声明这是 Worker 可序列化性的刻意权衡（零闭包捕获），(d) 可接受，(a)(b)(c) 无此约束。
- 修复建议：(a) 由调用方传入可复用 buffer；(b) 提为模块级常量元组（只读）；(c) 改索引循环。

**19 | P3 | solver-common.ts:~105（cvarOrder）| 确定性隐式依赖 TypedArray.sort 稳定性**
`order.sort((a, b) => energies[a]! - energies[b]!)`——能量相等时基态顺序由排序稳定性决定（稳定 ⇒ 索引序 ⇒ 确定）。ES2019 起规范保证稳定，但这是隐式依赖，且注释通篇强调位级可复现。差值比较器对 ±Infinity/NaN 也有未定义行为（上游已保证 energies 有限，但无断言）。
- 修复建议：比较器加索引决胜（`a - b || a - b_index`）显式化确定性；或注释声明对 sort stability 的依赖。

**20 | P3 | quantum-scheduler.ts:~1360（scheduleBatchQuantumQpu）| 报表字段语义挪用**
`solutions[0].layers = result.totalReads`、`evaluations: 1`——`layers` 字段在 QPU 路径被复用为读取次数，`QuantumBatchReport.solutions` 的类型文档（"QAOA 层数 p"）与实际载荷不符，消费方按文档解读会得到错误结论。
- 修复建议：报告结构增加可选 `reads` 字段，或至少在 `QuantumBatchReport` 注释中声明 QPU 路径的字段复用。

**21 | P3 | min-cost-flow.ts:~85-100（run）| 松弛 ε=1e-9 与终止 ε=-1e-12 不对称且未文档化**
松弛条件 `distU + e.cost < dist[e.to]! - 1e-9` 与停止条件 `dist[t]! >= -1e-12` 使用两个相差三个数量级的容差且无注释说明选择依据。当前成本量级（|score| ≲ 1e2）下安全，但量纲耦合未声明——若上游估值 scale 放大（如 successValue 配置为 1e6），两个 ε 都会失效。
- 修复建议：ε 常量化并注释相对量纲（如 ε ∝ max|cost|），或改用对偶位势（Johnson 归约）消除负权比较的 ε 依赖。

**22 | P3 | classical-baselines.ts:~18,~45（hungarianAssignment）| BIG=1e9 与权重尺度的隐式耦合**
不可行检测依赖 `m·max|w| < BIG` 才能让 BIG 格子在最优解中暴露。当前调用方权重 ≤ ~1.1（priority×affinity），安全余量充足；但该前提是隐式的——若复用者传入大尺度权重（≥1e8），不可行实例将不再被检出，静默返回伪最优。
- 修复建议：入口加 `Math.max(...)` 尺度断言或 `BIG = 1 + m·maxAbs(w)` 动态定价。

**23 | P3 | growth-market-scheduler.ts:~250,~270 | 基线口径的两处小漂移**
(a) round-robin 的 `rrCursor` 是跨任务持久计数器，对不同 capability 的异构 eligible 集合取模——"轮流"语义在任务流上漂移（基线用途可接受，但与直觉的轮转不符）；(b) `submitTask` 即 `wins++`，TTL 过期未结算的任务也永久计入 wins，指标含未发生结算的虚增。
- 修复建议：(a) 注释声明口径；(b) wins 移到 completeTask/simulateTask 结算后累计。

**24 | P3 | quantum-scheduler.ts 全文 | QuantumScheduler 是 1540 行上帝类**
单一类揉合四类职责：agent/task 注册表与索引、任务生命周期状态机、三条量子引擎编排（subspace/fullspace/QPU）、指标与巡检。对比之下 batch-vcg / growth-market / market-estimation 的职责切分（共享内核抽出、机制与估值分层）是教科书级的。调度状态机的全部 P1 缺陷（发现 1/2）都滋长在"谁都能改 task.status"的大类里。
- 修复建议：至少拆出 `TaskLifecycleManager`（状态机+计数器）与 `QuantumEngineOrchestrator`（批量路径），scheduler 保留注册表与门面。

**25 | P3 | batch-vcg-scheduler.ts:~715（measureMisreportGain）| 实验侵入未完全还原：taskSeq 单调漂移**
finally 块正确还原了 `bidMarkup` 与 `lastAllocation`（且注释显式处理 exactOptionalPropertyTypes 的缺省语义，值得表扬），但每次 run() 都会消耗 `taskSeq`——对照实验后生产 taskId 序号被实验批次顶走。无功能性后果，仅审计口径的 ID 漂移。
- 修复建议：记录并还原 taskSeq，或实验路径使用独立 ID 前缀。

---

## 模块级优点

1. **机制设计注释达到研究级**：batch-vcg-scheduler 头部完整陈述 WDP 精确求解、bundle 级 Clarke pivot 与"短视 VCG"的替代效应差异（w 容量 2 / j 容量 1 的反例）、Green-Laffmont 不可能性边界、μ-VCG 的 DSIC 定理证明梗概、BudgetPacer 与广告预算 pacing 的同构映射——每条机制声明都附可检验的经济学依据。
2. **诚实的自我审计文化**：`optimality` 字段对照穷举最优报告达成率；λ-二分处显式声明"Σp(λ) 的单调性未被证明"并做终局复核兜底；classical-baselines 的存在本身（"突破声明必须面对最强经典对手"）与匈牙利-子空间引擎的"独立算法互相验证"对照认证，是罕见的严谨。
3. **确定性工程**：全链路 Mulberry32 种子化（调度器量子态、模拟结算、角度优化重启），注释明确"给定 seed 的调度行为完全可复现"；fiber-kernel 为 Worker 并行专门设计零闭包纯函数保证串行/并行位级一致。
4. **性能索引有复杂度注释且经论证**：capabilityIndex 求交、pendingBuckets 免排序、dependents 反向索引（注释论证 Set 插入序 == 原全表扫描序，位级行为一致）、agentStats O(1) 相关性、pullsCache 脏标记缓存（注释给出原 O(迭代×重解×A²·T) 的推导）、SPFA 队列 head 前移替代 shift、纤维旋转系数按 k 查表（附 29 亿次三角函数的热点归因）。
5. **防御性编程密度高**：completeTask 幂等守卫（注释推演重复收尾的三重危害）、updateTaskStatus 状态机安全化（注释记录修复前的行为陷阱）、getSchedulingHistory 防御性拷贝、estimateQuality 的 0/0=NaN 流穿防护、resolveCommonSolverOptions 的退化参数拒绝、applyJointSolution 对子空间解的冗余资格校验（"挡住求解器实现缺陷"）。
6. **错误处理零裸奔**：范围内无一处 bare catch / 吞错；错误全部类型化（SchedulingError / MechanismError / QuantumEngineError / InfeasibleProblemError），预期内失败走 logDebug 静默。类型纪律同样严格：零 `any`，`!` 断言几乎都有紧邻的前置守卫，exactOptionalPropertyTypes 的条件展开写法（buildSolverOptions / measureMisreportGain finally）是正确范本。

## Top3 升级建议

1. **补全 QuantumScheduler 状态机契约（对应发现 1/2/5/6/7）**：这是全模块唯一的系统性风险面——公开转移入口无守卫、overloaded 吸收态、pending 无界、依赖环不检测、需求类型半实现。建议引入集中式状态转移函数（唯一写点）+ 调试模式不变量断言（`activeAssignments === |assigned∪running|`、`pendingCount === pendingTracked.size`、`agent.load` 与在途任务数一致），把散落在 8 个方法里的 status 写入收拢为一处。
2. **拆分上帝类（对应发现 24）**：以 batch-vcg → market-estimation 的抽取范式为模板，把任务生命周期、引擎编排、注册表拆为三个内聚单元。P1 缺陷的修复在 1540 行大类里只能打补丁，拆分后才能被类型系统与单测完整覆盖。
3. **统一数值口径并固化快照测试（对应发现 10/11/17/19/21/22）**：仓库已有"位级一致"的自觉（solver-common 头部契约、localSearch 放弃增量的论证），但亲和度双求和序、myopic 舍入、sort 稳定性依赖、MCF 双 ε 等处仍是口径盲区。建议建立数值口径清单（求和序、舍入点、ε、比较器决胜规则）并为每项固化黄金值快照测试，使"可复现"从注释承诺升级为 CI 强制。
