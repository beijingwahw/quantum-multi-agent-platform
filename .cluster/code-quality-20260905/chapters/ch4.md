# 第 4 章 P2/P3 精选与模式归纳

P2/P3 合计约 170 条，占全部发现的近九成。逐条罗列无助于行动，本章先按五簇反模式聚类——每簇给模式说明、代表条目表格、一句修复方向——再以附表 4.A 给出 P2/P3 全量清单（同模式条目合并行，已归入五簇的条目在附表中标注簇号）。聚类揭示了贯穿全仓的一个事实：**五簇反模式里有四簇都能在仓库自己的「优点段落」找到镜像**——solver-common 头部位级一致契约、numeric.ts 集中舍入、EdgeMemo 生命周期声明、纤维闭式解——纪律是有的，但没有覆盖到全部代码面。P2/P3 多数不是能力问题，是纪律覆盖面的欠账。证据行号 ±10，路径省略 `src/` 前缀。

## 4.1 簇一：validate-then-mutate 违例

**模式**：带副作用的接口先变更状态、后校验（或校验后仍留下半提交残局），异常路径上调用方无法推断正确的恢复姿势——补齐重调报错、原样重试丢数据。修复方向一句话：**先全景校验、后统一变更；emit 与初始化链条要么挪到安全点、要么带回滚栈，异常时状态零残留**。

| 编号 | 严重度 | 位置 | 形态 |
|---|---|---|---|
| 08#2 | P2 | compound-brain.ts:~880（settle） | `pending.delete(taskId)` 先于 agent/caps 有效性校验：校验失败时条目已删、结算既未入账也无法重试（再调 settle 恒 false），静默丢结算 |
| 01#13 | P3 | batch-vcg-scheduler.ts:~640（settleBatch） | 先逐条 recordSettlement / 更新声誉，循环后才查完整性并 throw：抛出时履历半更新；补齐缺失任务重调可成功，带上已结算任务则触发 settled-twice——恢复语义不对称 |
| 08#1 | P2 | compound-brain.ts:~660（allocateBatch） | emit 紧随 pending 台账写入：监听器异常同步上抛，调用方拿不到 assignments/taskId，但台账已登记——任务永不可 settle，学习状态被歪曲（正是 backlog 注释自己警告的病根） |
| 08#48 | P2 | index.ts（start） | 初始化链无逆序回滚栈：dshIntegration/registerSystemAgents 中途抛错只回滚 bus，DSH 半初始化、系统 agents 残留 |

## 4.2 簇二：双实现漂移

**模式**：同一语义在仓内存在两份以上手写实现或两套口径，写法各异、无共享函数、无等价性测试锚定。仓库在物理内核上以「位级一致」为硬契约（fiber-kernel 为此放弃增量评估、localSearch 为此放弃增量计分），但外围至少七处双实现正在各自漂移。修复方向一句话：**抽共享函数（denormalizeExpectation / affinityScore / topKByProbability / mulberry32）+ 等价性或黄金值快照测试锁定**。

| 编号 | 严重度 | 位置 | 漂移对 |
|---|---|---|---|
| 01#10 | P3 | quantum-scheduler.ts:~725 vs ~805 | 亲和度两套求和序（distance-first vs capability-first），浮点加法不满足结合律 → ~1e-17 ULP 分歧，近平局可选出不同 agent，未声明的口径分歧 |
| 08#15 + 08#24 | P2/P1 | quantum-optimizer / subspace-optimizer | 归一化能量还原三处三写、退火路径「碰巧对」（修复为四处统一调用）；P1 侧已见 3.4，`denormalizeExpectation()` 缺席是共同根因 |
| 08#30 | P3 | subspace-optimizer（top-K） | 手写 splice 插入 vs 全空间 sort-slice，候选择取双实现，等价性只有注释承诺、无测试锚定 |
| 05#22 + 06#8 | P3/P2 | tests ×3 + examples ×1 | mulberry32 四份拷贝（qpu-backend / batch-vcg / compound-brain / benchmark 示例），且示例版种子处理不同（>>> 0） |
| Q5 | P3 | core/qpu/qiskit-export.ts:76-97 | 生成的 Python `decode()` 与 solve.ts 的 TS 解码是手工同步的跨语言双实现，无交叉引用注释、无 CI 自检向量 |
| 08#40 | P3 | subspace-parallel.ts | 构建路径 W（max(2,min(cpus-1,…))）与演化路径 W（读 env、受 dim 约束）两套 Worker 数决策逻辑 |
| Q2 | P2 | core/qpu/solve.ts:151 | 浮点容差 1e-12 硬编码，与 utils/numeric.ts 的集中口径哲学自相矛盾（同仓两套精度治理） |

## 4.3 簇三：配置探测散在热路径

**模式**：环境探测与全量重算嵌进高频路径——env 每次调用重读、状态快照每 batch 全量重建、能量矩阵每次求解全量重算。单看每处都是「小开销」，合起来是吞吐天花板与测试不可注入的双重债；全局副作用开关（QUANTUM_NO_SAB）还会污染并行测试。修复方向一句话：**模块级一次解析 + 构造注入（可测试性）；memo/增量/脏标记替代全量重算**。

| 编号 | 严重度 | 位置 | 形态 |
|---|---|---|---|
| 08#26 | P2 | subspace-optimizer（allocI32/allocBytes/allocF64） | SAB 可用性探测每次分配重读 `process.env.QUANTUM_NO_SAB`：热路径 env 查询开销 + 探测结果不可注入，测试无法模拟无 SAB 环境 |
| 08#36 | P2 | subspace-parallel（workerCount） | 每次求解重读 `QUANTUM_WORKERS`：运行中改 env 可让同进程前后调用用不同 W |
| 02#23 | P1 | proactive-intelligence/plugin.ts:237-261 | 每 batch 全量重建状态快照：getEvents 拷贝 + getStatistics 双 reduce + getDecisionHistory，万级缓冲下 O(n) 起（已见 3.6 归位，簇三同源：快照应缓存/增量维护） |
| 08#14 | P1 | quantum-optimizer（computeEnergies） | O(2^nq·m·n) 能量预计算每次求解全量重算无 memo，同一 problem 重复求解照付全价（已见 3.6 归位） |
| 08#3 | P2 | compound-brain（fitGrid + calibrate） | 每次 settle 触发全网格重拟合：51×41 × 2000 观测 ≈ 4.18M 次对数求值/次结算，10k tasks/s 架构目标下数量级级 CPU 税，代码注释自认「经常性 CPU 税」但无增量拟合/退避 |

## 4.4 簇四：类型谎言

**模式**：类型声明与运行时事实不符——Date 在 JSON 边界退化为 string、公开接口返回 `object`/`unknown` 放弃契约、`as any` 绕过检查。本仓 tsconfig 严格度是第一梯队，但公开契约面四处漏风：编译器挡不住的地方，运行时也无人挡。修复方向一句话：**边界 DTO 用 ISO string + 入站 revive；多态载荷用判别联合；`object`/`unknown` 逐出公开签名；测试用类型化工厂替代 as any**。

| 编号 | 严重度 | 位置 | 谎言 |
|---|---|---|---|
| Q4 | P2 | types/quantum-types.ts:9,19 | `lastHeartbeat/createdAt: Date` 经 WS/JSON 序列化后退化为 string，反序列化后 `instanceof Date` 永假 |
| 02#1 + 02#24 | P2/P1 | brain.ts:52 / plugin.ts:243 | `getState(): object`、`CurrentSystemState.brain: object`——装配层明明知道具体形状却用 object 把信息丢弃（02#11 `Condition.value: unknown` 已见 3.6 归位本簇） |
| 02#2 + 02#12 | P2 | brain.ts:54 / types.ts:16-24 | `registerAgent?(spec: unknown): unknown` 无信息量签名；`currentState: unknown` + 规则按 `'a.b'` 动态路径取值，字段名写错编译期无感、运行时静默 null |
| 05#19 + 05#29 | P2 | tests/qpu-backend.ts:213 / subspace-optimizer.test.ts:209 | 两处 `submitTask({...} as any)` 绕类型（类型漂移在重构时静默通过）；makeAgent 工厂四文件重复、字段各异 |
| 08#51 | P3 | index.ts（deepMerge） | 双 `as` 断言 + DeepPartial 对数组元素类型不生效 + 递归合并无深度上限 |
| 08#32 | P3 | SubspaceSolution / QuantumSolution | 两套解类型字段大量重叠，无共同基接口或判别联合，门面层被迫双分支处理 |
| 06#7 | P2 | examples/basic-usage.js:24 | `find(...).id` 无 undefined 防护——.js 示例零类型检查的直接代价（与 I5 的 checkJS 缺口同源） |

## 4.5 簇五：指标口径混淆

**模式**：指标字段的语义与载荷不符——取消计入失败、字段挪用、缺省值伪造事实。这类问题不炸不崩，但系统性毒化监控与实验结论：所有下游统计（成功率、SLA、quantumProbabilitySum、穷举达成率）都在失真数据上展开，且失真是静默的。修复方向一句话：**一字段一语义；无数据返回 null 而非编造；新增状态/字段而非复用旧壳**。

| 编号 | 严重度 | 位置 | 混淆 |
|---|---|---|---|
| 01#15 | P3 | quantum-scheduler.ts:~283 | cancelled 走 `completeTask(taskId, false)`：failedCount++ 取消与失败在 `failedTasks` 里不可区分 |
| 02#16 | P1 | executor.ts:100-119 | 预检拒绝计入执行历史、safeMode 跳过标 completed——被拒≠失败≠跳过三态混同（已见 3.1 表，归本簇展开为状态机扩展） |
| 01#20 | P3 | quantum-scheduler.ts:~1360 | QPU 路径 `solutions[0].layers = result.totalReads`、`evaluations: 1`：layers 文档语义（QAOA 层数 p）与实际载荷（读取次数）不符 |
| 02#9 | P3 | brain.ts:92-96 | settled=0 时 successRate 缺省 1（100%）：「无数据」被报告为「全成功」，冷启动期 `< 0.5` 类规则永不触发 |
| 02#14 | P2 | monitor.ts:47-64 | `getStatistics().total` 实为「未过期事件数」而非累计总数，字段名误导（且每次全量 reduce ×4） |
| 01#16 | P3 | quantum-scheduler.ts:~345 | actualDuration 从 createdAt 起算含排队等待，SLA/超时归因系统性偏大 |
| 01#23 | P3 | growth-market-scheduler.ts:~250,~270 | `submitTask` 即 `wins++`：未结算任务永久虚增战绩（rrCursor 漂移同条） |
| 01#8 | P2 | quantum-scheduler.ts:~856 | 求解失败静默回退 `agents[0]` 仍照报 Born 概率/validMass 置信度——上报指标与实际决策脱钩，quantumProbabilitySum 被污染 |
| 08#54 | P3 | index.ts（getSystemMetrics） | 五组件同一 tick 顺序拉取无事务性快照，高并发下同一报告内数字可互相矛盾 |

五簇之外的大量 P2/P3（边界安全细节、测试断言强度、工程基建、文档漂移）不构成跨模块模式，全量收录于附表。

## 4.6 附表 4.A：P2/P3 完整清单

以下为九路审计的全部 P2/P3 条目（约 150 行，同模式条目合并行；编号含〔簇N〕者为 4.1–4.5 五簇代表条目，此处保留以便对账；P1 条目除五簇引用外不重复收录，见第 3 章）。

### A1 core 调度（subagent_01）

| 编号 | 严重度 | 位置 | 一句话 |
|---|---|---|---|
| 01#3 | P2 | quantum-scheduler.ts:~940 | qubitCap 不变量对「单任务×大空闲池」失效，首任务永不分块，超限配置引擎中段抛错 |
| 01#4 | P2 | quantum-scheduler.ts:~1330 | QPU 路径 await 后不复查并发额度，maxConcurrent 可被突破（快照式背压） |
| 01#5 | P2 | quantum-scheduler.ts:~648 | pending 无 TTL 且巡检定时器首分配后才启动，不可满足任务永久驻留 |
| 01#6 | P2 | quantum-scheduler.ts:~290 | 依赖不检测环，A↔B 双永久 pending，叠加 #5 成永久泄漏 |
| 01#7 | P2 | quantum-scheduler.ts:~1490 | resource/location/quantum 需求被静默忽略（四类契约只实现一类） |
| 01#8 | P2 | quantum-scheduler.ts:~856 | 求解失败静默回退 agents[0] 仍照报 Born 概率，污染概率指标〔簇五〕 |
| 01#9 | P2 | solver-common.ts:~150 | 校验入口漏验 restarts/topK，restarts=0 产出空角度 + Infinity「最优」 |
| 01#10 | P3 | quantum-scheduler.ts:~725/805 | 亲和度两套求和序 ULP 级分歧，违「位级一致」契约〔簇二〕 |
| 01#11 | P3 | solver-common.ts:~300 | `r <= cum` 边界可采到零概率态（r=0 且 probs[0]=0） |
| 01#12 | P3 | market-estimation.ts:~170 | 满员后每次 splice(0,1) O(cap) 搬移，同仓 min-cost-flow 注释批评过同型 |
| 01#13 | P3 | batch-vcg-scheduler.ts:~640 | settleBatch 先变更后抛错，状态半更新、恢复姿势不对称〔簇一〕 |
| 01#14 | P3 | quantum-scheduler.ts:~218 | 重复注册静默覆盖（另两调度器 throw）+ 悬空纠缠引用不清理 |
| 01#15/16/20/23 | P3 | scheduler 两文件 | 指标口径四连：cancelled 计入 failed、actualDuration 含排队、layers 字段挪用、wins 未结算虚增〔簇五〕 |
| 01#17 | P3 | batch-vcg-scheduler.ts:~600 | myopic payments 逐项未 round9，与 VCG 路径舍入口径不一 |
| 01#18 | P3 | solver-common.ts 多处 | 热路径分配噪音：每评估新建 Float64Array、数组字面量、for..of 遍历 TypedArray |
| 01#19 | P3 | solver-common.ts:~105 | cvarOrder 确定性隐式依赖 sort 稳定性，无索引决胜 |
| 01#21 | P3 | min-cost-flow.ts:~85 | 松弛 ε=1e-9 与终止 ε=-1e-12 差三个数量级，量纲耦合未文档化 |
| 01#22 | P3 | classical-baselines.ts:~18 | BIG=1e9 与权重尺度隐式耦合，大尺度权重下不可行实例静默伪最优 |
| 01#24 | P3 | quantum-scheduler.ts 全文 | 1540 行上帝类四职责混合，P1 状态机缺陷的温床 |
| 01#25 | P3 | batch-vcg-scheduler.ts:~715 | 实验侵入未还原 taskSeq，对照实验后生产 ID 漂移 |

### A2 core 优化器与平台（subagent_08）

| 编号 | 严重度 | 位置 | 一句话 |
|---|---|---|---|
| 08#1 | P2 | compound-brain.ts:~660 | emit 在台账写入后执行，监听器异常致「state committed, result lost」〔簇一〕 |
| 08#2 | P2 | compound-brain.ts:~880 | settle 先 delete 后校验，校验失败静默丢结算且不可重试〔簇一〕 |
| 08#3 | P2 | compound-brain.ts | 每次 settle 全网格重拟合 ≈4.18M 对数求值，10k/s 目标下数量级 CPU 税〔簇三〕 |
| 08#4 | P3 | compound-brain.ts:~530 | `agentIdx.get(...) ?? 0` 静默回退，不变量违例记错账无报错 |
| 08#5 | P3 | compound-brain.ts | Date.now 硬编码不可注入，时序行为无法确定性测试 |
| 08#6/7/8 | P3 | compound-brain.ts | 配置面三连：EWMA 系数硬编码、OBS_CAP 不可配、魔法阈值两处重复 |
| 08#9 | P3 | compound-brain.ts | geometricSum 未用 expm1，β 极小时灾难性消去 |
| 08#10 | P3 | compound-brain.ts | EventEmitter 无 dispose，监听器引用链阻止 GC |
| 08#11 | P3 | compound-brain.ts | 实验 API（misreport/simulateBatch）与生产机制同类混居 |
| 08#12 | P3 | compound-brain.ts | getState 公开弱类型，插件方拿无类型对象〔簇四〕 |
| 08#15 | P2 | quantum-optimizer.ts | 期望计算手写循环 + scale 还原分散，等价性靠注释维持〔簇二〕 |
| 08#16 | P2 | quantum-optimizer.ts | toIsing 罚 2λ 与内置能量不加罚，跨后端能量语义不一致 |
| 08#17 | P2 | quantum-optimizer.ts | 一阶 Trotter 固定步长无收敛判据/误差预算 |
| 08#18 | P2 | quantum-optimizer.ts | born 模式无 shots 下限与 validMass 护栏 |
| 08#19 | P3 | quantum-optimizer.ts | 同步阻塞不可取消，无 AbortSignal |
| 08#20 | P3 | quantum-optimizer.ts | 随机重启无 warm-start，浪费已找到的好角度 |
| 08#21 | P3 | quantum-optimizer.ts | 位运算 nqubits=30 零余量，constants 放宽到 31 即静默错 |
| 08#22 | P3 | quantum-optimizer.ts | 容量恒 1 与 MinCostFlow capacity>1 契约不对齐 |
| 08#25 | P2 | subspace-optimizer.ts | 构建内存无预算（dimensionCap 不控内存），峰值数百 MB 且不可取消 |
| 08#26 | P2 | subspace-optimizer.ts | SAB 探测每次分配重读 env，不可注入〔簇三〕 |
| 08#27 | P2 | subspace-optimizer.ts | 子空间 born 模式无质量护栏，validMass 未暴露 |
| 08#28 | P2 | subspace-optimizer.ts | 谱宽用上界估计而非实际 fiber 结构，退火不充分 |
| 08#29 | P3 | subspace-optimizer.ts | 三处 console.error 绕过统一 logger |
| 08#30 | P3 | subspace-optimizer.ts | top-K 手写插入 vs sort-slice 双实现，无等价性测试〔簇二〕 |
| 08#31 | P3 | subspace-optimizer.ts | DFS cap 叶子触发 + 全量预分配，可读性备注（无需修复） |
| 08#32 | P3 | 两解类型 | SubspaceSolution/QuantumSolution 无共同基接口〔簇四〕 |
| 08#35 | P2 | subspace-parallel.ts | Worker 泄漏窗口：unref 定时器竞争 + terminate Promise 被吞 |
| 08#36 | P2 | subspace-parallel.ts | workerCount 每次求解重读 env〔簇三〕 |
| 08#37 | P2 | subspace-parallel.ts | dispatch 超时后共享内存所有权未隔离，靠「每次新建」隐式约定 |
| 08#38 | P3 | subspace-parallel.ts | header 布局魔法数无命名常量/偏移断言 |
| 08#39 | P3 | subspace-parallel.ts | poisoned 跨闭包标志靠 eslint-disable 压制而非类型化 |
| 08#40 | P3 | subspace-parallel.ts | 构建与演化两套 W 决策逻辑〔簇二〕 |
| 08#41 | P2 | agent-manager.ts | createEntanglement 静默 false 无警告 + index 监听器无异常隔离 |
| 08#42 | P2 | agent-manager.ts | 负载/状态不变量五处入口各自维护，updateAgent 绕过全部不变量 |
| 08#43 | P2 | agent-manager.ts | heartbeat 恢复 offline 不 emit，远端无法感知复活 |
| 08#44 | P3 | agent-manager.ts | 重名 agent 不查重，日志/快照不可区分 |
| 08#45 | P3 | agent-manager.ts | 健康检查依赖被监控线程自身时钟，阻塞时误判 offline |
| 08#46 | P3 | agent-manager.ts | removeEntanglements 双分支重复，N-way 纠缠会踩坑 |
| 08#48 | P2 | index.ts | start() 初始化链无逆序回滚栈，半初始化残留〔簇一〕 |
| 08#49 | P2 | index.ts | submit_task 硬编码 type:'console'，命令协议与 SDK 能力不对齐 |
| 08#50 | P2 | index.ts | SIGINT 不捕获异常、start 失败不显式退出，进程可能挂住 |
| 08#51 | P3 | index.ts | deepMerge 双 as 断言 + DeepPartial 数组不生效 + 递归无深度上限〔簇四〕 |
| 08#52 | P3 | index.ts | 60+ 符号纯重导出聚合，无子路径分桶 |
| 08#53 | P3 | index.ts | CLI 副作用块内嵌库入口文件 |
| 08#54 | P3 | index.ts | getSystemMetrics 五组件无事务性快照，同报告数字可矛盾〔簇五〕 |

### A3 主动智能（subagent_02）

| 编号 | 严重度 | 位置 | 一句话 |
|---|---|---|---|
| 02#1 | P2 | brain.ts:52 | `getState(): object` 放弃类型契约〔簇四〕 |
| 02#2 | P2 | brain.ts:54 | unknown 进/unknown 出的鸭子类型签名〔簇四〕 |
| 02#4 | P2 | decision-engine.ts:315 | getMetrics 浅拷贝泄漏 rulesTriggered 内部引用 |
| 02#5 | P2 | decision-engine.ts:169 | 缺失值 Number(null)=0 可使比较条件误命中 |
| 02#6 | P2 | decision-engine.ts:180 | contains 用 String() 万能转换，"undefined" 子串误命中 |
| 02#7 | P3 | decision-engine.ts:47 | _config 参数未使用，承诺了不存在的可配置性 |
| 02#8 | P3 | decision-engine.ts:100 | 全同步逻辑包 Promise.resolve，半异步 API |
| 02#9 | P3 | brain.ts:92 | settled=0 时 successRate 缺省 1，「无数据=全成功」〔簇五〕 |
| 02#10 | P3 | brain.ts:63 | openTasks 无上限无过期，漏 settle 即永久虚高 |
| 02#12 | P2 | types.ts:16 | currentState: unknown + 动态路径取值，字段名错静默 null〔簇四〕 |
| 02#13 | P2 | monitor.ts:33 | maxBufferSize=0 被 falsy 判断静默反转语义 |
| 02#14 | P2 | monitor.ts:47 | total 实为「未过期数」且每调用全量 reduce ×4〔簇五〕 |
| 02#15 | P3 | monitor.ts:106 | 容量淘汰与过期淘汰混用同一游标，expiredPrefix 名不副实 |
| 02#18 | P2 | executor.ts:152 | Promise.race 超时不取消底层操作，子进程/句柄泄漏 |
| 02#19 | P2 | executor.ts:282 | custom handler 返回 Promise 未 await，thenable 当 result 存储 |
| 02#20 | P3 | executor.ts:52 | 并发预检依赖单线程时序假设，无注释固化 |
| 02#25 | P2 | plugin.ts:113 | 13 个转发监听器无 destroy()，已达 MaxListeners 阈值 |

### A4 通信与工具边界（subagent_09）

| 编号 | 严重度 | 位置 | 一句话 |
|---|---|---|---|
| F03 | P2 | quantum-bus.ts:404 | sent 无条件置位不查返回值，慢消费者场景静默丢消息 |
| F04 | P2 | quantum-bus.ts:292 | 可反复 authenticate 冒领任意 agentId，共享 token 不构成身份 |
| F05 | P2 | quantum-bus.ts:305 | validateMessage 仅查 3 个 truthy 字段，类型混淆透传下游 |
| F06 | P2 | quantum-bus.ts:449 | 无 per-connection 速率限制，广播 O(连接数) 发送放大 |
| F07 | P3 | quantum-bus.ts:137 | 畸形 JSON 无熔断计数，可持续日志洪泛 |
| F08 | P3 | quantum-bus.ts:376 | 心跳定时器无集中 registry，shutdown 无法确定性回收 |
| F09 | P3 | quantum-bus.ts 协议 | 无协议版本协商字段，不兼容变更只能 magic 试错 |
| F10 | P3 | quantum-bus.ts 日志 | 对端可控字符串未消毒入日志，可伪造日志行 |

### A5 测试质量（subagent_05）

| 编号 | 严重度 | 位置 | 一句话 |
|---|---|---|---|
| 05#3 | P2 | security-hardening:106 | Windows symlink 用例静默跳过，CI 覆盖假象 |
| 05#4/12 | P2/P3 | security/quality | 错误消息正则断言与文案强耦合，应断言结构化错误码 |
| 05#5 | P2 | quality-regressions:556 | retentionMs + 真实时钟等待，应注入时钟 |
| 05#6 | P2 | proactive-intelligence:57 | 回调内断言，回调不触发即假阴性 |
| 05#7 | P2 | batch-vcg:40 | 手工魔数断言无双错抵消防护，应补不变量分解 |
| 05#8/27 | P3 | 两文件 | stringify 键序比对/整对象 deepEqual 脆弱 |
| 05#9 | P3 | compound-brain:106 | 增长行为组 4 用例 4 份骨架复制 |
| 05#10 | P3 | proactive-intelligence:180 | 单元断言拖完整插件生命周期 |
| 05#11 | P2 | batch-vcg:279 | BudgetPacer 收敛容差 30% 无理论来源 |
| 05#13 | P3 | train-vs-hire:29 | 12-seed 统计功效未声明，相位边界假红风险 |
| 05#14 | P3 | compound-brain:368 | 注释宣称 δ 单调但断言只查类型存在性 |
| 05#16 | P3 | proactive-intelligence:205 | capacity 并发边界未覆盖 |
| 05#18 | P2 | qpu-backend:233 | stub 返回硬编码 spins 与提交问题无关联，oracle 失效 |
| 05#19/29 | P2 | 两测试文件 | as any 绕类型 + makeAgent 工厂四文件重复各异〔簇四〕 |
| 05#20 | P2 | qpu-backend:264 | 全局注册表写入无清理，跨文件脏状态 |
| 05#21 | P3 | quantum-optimizer:103 | 「至少一次命中」概率断言缺失效概率声明（≈1/26 假红） |
| 05#22+06#8 | P3/P2 | tests×3 + 示例 | mulberry32 四份拷贝，示例版种子处理还不同〔簇二〕 |
| 05#23 | P3 | agent-manager:56 | 布尔断言风格混用 |
| 05#24 | P2 | agent-manager:66 | 81 次循环硬编码耦合阈值 80，应显式注入 |
| 05#25 | P3 | qpu-backend:135 | 环境敏感分支（有凭据开发机 ≠ CI）不可复现 |
| 05#26 | P2 | ma-qaoa:158 | 40-seed 经验阈值断言无可诊断性（失败丢 seed 信息） |
| 05#28 | P3 | ma-qaoa:17 | 负权重生成意图未注释 |
| 05#30 | P3 | subspace-optimizer:104 | 物理断言正面样板，仅 maxDev 微瑕 |
| 05#31 | P3 | ma-qaoa:60 | 25 实例循环断言只报首个失败 |

### A6 实验/示例/文档（subagent_06）

| 编号 | 严重度 | 位置 | 一句话 |
|---|---|---|---|
| 06#3+I4 | P2 | package.json | description 乱码（中文按 GBK 解码样貌），npm 元数据卫生 |
| 06#4 | P2 | package.json | keywords 名不副实（deepseek-harness），缺 quantum 等高频词 |
| 06#5+I8 | P2/P3 | package.json | 无 files 白名单/exports/sideEffects，publish 会带上实验结果 |
| 06#6 | P2 | examples | 示例端口 8081/8083 与 README 架构图 8080 不一致 |
| 06#7 | P2 | basic-usage.js:24 | find().id 无 undefined 防护（.js 零类型检查代价）〔簇四〕 |
| 06#9 | P2 | qpu-real-hardware:149 | writeFileSync 写 CWD，从根目录运行污染仓库 |
| 06#10 | P2 | examples 两文件 | .js 示例无类型检查（与 I5 的 checkJs 缺口同源） |
| 06#12 | P2 | train-vs-hire/run.ts:215 | endsWith 入口判定 + 双重 import 触发网格扫描副作用隐患 |
| 06#13 | P3 | llm/run.ts:76 | Semaphore 恢复窗口并发浮动 1，与「严格上限」声明不符 |
| 06#14 | P2 | llm/run.ts:281 | JSONL 每次覆盖，无法累积样本、crash 丢历史 |
| 06#15 | P2 | llm/run.ts:31 | RUNS/CONCURRENCY 无上限校验，可打爆 API 配额 |
| 06#16 | P2 | train-vs-hire/run.ts:24 | 参数-结果-代码无版本链路（无 git rev 快照） |
| 06#18 | P2 | install 脚本:9 | 开发者个人绝对路径（C:\Users\molly\…）入库 |
| 06#19 | P2 | install 脚本:365 | endsWith 入口判定，改名即静默失效 |
| 06#21 | P2 | install 脚本:206 | pnpm file:D:/ 盘符歧义跨版本不稳 |
| 06#22 | P3 | install 脚本:14 | DEFAULT_PROFILES 硬编码，无匹配空转 |
| 06#23 | P2 | web-console:475 | class 属性拼接未防注入（escapeHtml 不转义空格） |
| 06#24 | P2 | web-console:460 | 鉴权失败 4001 被当普通断线 5s 重连死循环 |
| 06#25 | P3 | web-console | 700 行单文件无 CSP，canvas 固定尺寸 |
| 06#26+I12 | P3 | .gitignore | 缺 .DS_Store/.nyc_output/*.tgz 等噪声项 |
| 06#27 | P3 | performance-test.mjs | .mjs 后缀误导（实际必须 tsx 运行） |

### A7 QPU/utils/类型（主线亲审 subagent_03）

| 编号 | 严重度 | 位置 | 一句话 |
|---|---|---|---|
| Q1 | P2 | utils/rng.ts:3 | DEFAULT_SEED=42 全局共享，跨子系统随机流同序 |
| Q2 | P2 | qpu/solve.ts:151 | 容差 1e-12 硬编码，与 numeric.ts 集中口径矛盾〔簇二〕 |
| Q3 | P2 | dwave-backend.ts:186 | 轮询固定 500ms×1 次不识别 429/Retry-After |
| Q4 | P2 | quantum-types.ts:9 | Date 字段经 JSON 边界退化 string，instanceof 永假〔簇四〕 |
| Q5 | P3 | qiskit-export.ts:76 | Python decode() 与 TS 手工同步双实现，无自检向量〔簇二〕 |
| Q6 | P3 | quantum-backend.ts:159 | 顶层注册副作用与自家「导入零副作用」原则不一致 |
| Q7 | P3 | utils/logger.ts | 无时间戳/级别/结构化输出，生产可观测性弱 |
| Q8 | P3 | qpu/solve.ts:57 | numReads 本地 128 vs 硬件 100 缺省分叉 |
| Q9 | P3 | dwave-backend.ts:151 | qp 解码缺 num_solutions 时全长解码，padding 非零出幻影样本 |
| Q10 | P3 | qpu/solve.ts:155 | optimality 仅 optimal>0 提供，全零福利丢对照信息 |

### A8 工程基建（主线亲审 subagent_07）

| 编号 | 严重度 | 位置 | 一句话 |
|---|---|---|---|
| I5 | P2 | tsconfig.json | moduleResolution node10 过时/无 isolatedDeclarations/allowJs 无 checkJs |
| I6 | P2 | ci.yml | dist 构建后无冒烟验证，绿色 CI ≠ 发布物可用 |
| I7 | P2 | .github/ | 无 dependabot/renovate，依赖更新全手工 |
| I9 | P3 | knip.json | entry 未列 src/index.ts，公共 API 面未显式锚定 |
| I10 | P3 | package.json | typescript 下限 ^5.1 与 5.6+ 特性配置矛盾（下限是假的） |
| I11 | P3 | ci.yml | 覆盖率无 artifact 上传、无变更行覆盖 |

### A9 收口说明

- 附表覆盖素材文件中全部 P2/P3 条目；重复计数（素材自注的 05#4、05#9 双行）已去重。
- 与 06（实验/文档）P1 相关的条目（README badge/测试数/口径 n=2112/快速开始缺入口/postinstall 声明）已在 3.6 归位，此处不重复。
- 工具链 EOL 类（I1/I2/I3）为 P1，已归 3.6，详见第 2 章对标与第 5 章 Wave 1。
