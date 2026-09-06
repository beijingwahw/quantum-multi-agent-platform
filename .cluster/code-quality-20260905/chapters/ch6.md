# 第 6 章 值得保留的世界级优点

前四章用了大量篇幅谈问题；本章必须把另一半事实讲清楚：**这个仓库的底子显著高于平均水位，多处实践达到研究级或教科书级**。升级路线图的隐含前提是「升级而非重写」——本章列出的资产正是理由：它们是护城河，任何重构都应原样保留并继续投资。

## 6.1 算法与机制设计层

| # | 优点 | 证据 | 出处 |
|---|---|---|---|
| 1 | **机制设计注释达到定理级**：WDP 精确求解、bundle 级 Clarke pivot 与「短视 VCG」替代效应反例、Green-Laffmont 不可能性边界、μ-VCG 的 DSIC 定理证明梗概、BudgetPacer 与广告预算 pacing 的同构映射——每条机制声明都附可检验的经济学依据 | batch-vcg-scheduler.ts 头部及各机制段 | subagent_01 |
| 2 | **诚实的自我审计文化**：`optimality` 字段对照穷举最优报告达成率；λ-二分处显式声明「Σp(λ) 的单调性未被证明」并做终局复核兜底；「突破声明必须面对最强经典对手」——匈牙利算法与子空间引擎独立互验对照认证 | classical-baselines、batch-vcg-scheduler、调度器编排层 | subagent_01 |
| 3 | **纤维混合闭式解（真正的数学功底）**：K_k = J−I 的指数闭式，无 Trotter 误差、O(dim) 精确施加混合器，比全空间逐位旋转更优雅 | fiber-kernel.ts / subspace-optimizer.ts | subagent_08 |
| 4 | **三道 QPU 校验闸门**：QPU 采样进调度器前过合法性检查、能量核对、本地最优对照——对噪声硬件的零信任姿态是教科书级 | core/qpu/solve.ts 头注 | subagent_03 |

## 6.2 确定性与数值工程

| # | 优点 | 证据 | 出处 |
|---|---|---|---|
| 5 | **确定性工程全链路贯彻**：Mulberry32 种子化贯穿调度器量子态、模拟结算、角度优化重启，注释明确「给定 seed 的调度行为完全可复现」；fiber-kernel 为 Worker 并行专门设计零闭包纯函数，保证串行/并行**位级一致**——多数并行实现只保证统计一致 | fiber-kernel.ts、solver-common.ts、各调度器 | subagent_01/08 |
| 6 | **性能索引有复杂度注释且经论证**：capabilityIndex 求交、pendingBuckets 免排序、dependents 反向索引（论证 Set 插入序 == 全表扫描序、位级行为一致）、pullsCache 脏标记缓存（附原 O(迭代×重解×A²·T) 推导）、SPFA 队列 head 前移替代 shift、纤维旋转系数按 k 查表（附 29 亿次三角函数的热点归因） | quantum-scheduler.ts、min-cost-flow.ts 等 | subagent_01 |
| 7 | **深位数值素养的坑位注释**：`1 << q` 在 q≥32 回绕的坑位注释 + QPU 路径不经中间整数态直接解码；FULLSPACE_QUBIT_LIMIT=30 恰卡安全边界且注释带警告 | core/qpu/solve.ts:85、constants.ts | subagent_03 |
| 8 | **集中舍入纪律**：round9/round2/round3 收敛于 utils/numeric.ts 单点，禁止业务代码散写；错误层级统一（`new.target.name` 修正 + 9 个域分类 + 英文消息/中文注释约定） | utils/numeric.ts、utils/errors.ts | subagent_03 |

## 6.3 安全与边界防御

| # | 优点 | 证据 | 出处 |
|---|---|---|---|
| 9 | **secure by default**：总线默认绑定 127.0.0.1——无鉴权模式绝不暴露网络接口；maxPayload 交由 ws 层帧级拒绝超大消息 | quantum-bus.ts 构造缺省 | subagent_09 |
| 10 | **多层背压上界意识**：连接数封顶（256）、单连接订阅数封顶（64）、每 agent 离线队列封顶（1000，丢最旧并计数）；慢消费者防护（bufferedAmount > 4MB 断连）正确处理了 ws「对端停读但保持连接」的无界缓冲问题——这是很多实现遗漏的点 | quantum-bus.ts 多处 | subagent_09 |
| 11 | **timingSafeEqual 防时序侧信道**：token 先 SHA-256 再常数时间比较，做法标准；鉴权开启后五条路径全部闭环，sourceAgentId 与连接身份一致性校验 | quantum-bus.ts 鉴权分支 | subagent_09 |
| 12 | **投递语义诚实**：processQueuedMessages 用连接快照 + 真实送达结果保序，杜绝「计为已投递但实际丢失」，注释把语义讲透；shutdown 处理了「start 已发起但未 listening」的罕见窗口；单次序列化复用避免同消息对多连接重复 JSON.stringify | quantum-bus.ts | subagent_09 |
| 13 | **云 API 边界的成本与注入意识**：端点 https 强制（防明文外带 token 的 SSRF 面）、孤儿问题 best-effort 取消（不烧 QPU 配额）、qp 压缩格式的幻影样本防护 | dwave-backend.ts | subagent_03 |

## 6.4 测试与工程文化

| # | 优点 | 证据 | 出处 |
|---|---|---|---|
| 14 | **机制测试以手工推导闭式值为 oracle**：p_w=8、take=2、λ=1 精确断言；DSIC 30 实例×多扰动实证；相变定律闭式↔模拟双向验证 + Π 群坍缩普适性检验——理论驱动而非快照驱动 | batch-vcg-scheduler.test.ts、train-vs-hire-phase.test.ts、compound-brain.test.ts | subagent_05 |
| 15 | **质量回归与安全加固的测试形态成熟**：每用例锁定一个真实缺陷（含原型污染/沙箱逃逸/总线鉴权回归）；命令注入/路径穿越/符号链接逃逸全覆盖并处理平台差异（win32 分支） | quality-regressions.test.ts、security-hardening.test.ts | subagent_05 |
| 16 | **tsconfig 严格度第一梯队**：noUncheckedIndexedAccess + exactOptionalPropertyTypes + verbatimModuleSyntax + noUncheckedSideEffectImports 全开，超过绝大多数开源 TS 仓（2025-2026 前沿基线中前两项均为「严肃项目标配」位） | tsconfig.json | subagent_07/04 |
| 17 | **CI 门禁文化成熟**：覆盖率（92/82/92/92）+ 死代码双硬门禁，且经 2 OS × 3 Node 矩阵验证；eslint 分区豁免策略——src 全纪律、tests/examples/experiments 定向豁免并逐条写理由注释，是工程判断而非一刀切；示例冒烟进 CI 且钉 5 分钟超时 | ci.yml、eslint.config.mjs | subagent_07 |
| 18 | **防御性编程与类型纪律的日常密度**：completeTask 幂等守卫（注释推演重复收尾的三重危害）、getSchedulingHistory 防御性拷贝、退化参数在入口拒绝（「不让 NaN 静默流穿整个态矢量」）；零 bare catch、零 `any`，`!` 断言几乎都有紧邻前置守卫，exactOptionalPropertyTypes 的条件展开写法是正确范本 | core 全半区 | subagent_01 |
| 19 | **实验代码的可复现性自觉**：种子显式（mulberry32(1000+run)）、数据代码分离、treatment/control 双臂设计、corrupt 破坏标签保持提示形状的控制臂、争议决策写进文件头注释 | experiments/ 两实验 | subagent_06 |

## 6.5 一句话总结

这 19 条优点集中呈现一个模式：**作者对「正确性可以证明、复现可以位级、边界可以枚举」有近乎执念的追求**——机制注释写定理、并行求位级一致、性能优化附复杂度推导、测试用闭式解做 oracle。本报告第 3、4 章的全部问题，恰好都是这一哲学**尚未贯彻到的地方**（状态机、异步纪律、外围工具链），而不是哲学本身的失败。Wave 2/3 的所有改造——单写点状态机、数值口径快照、确定性测试原语——本质上是把这套已有的严谨标准延伸到欠账区域。**这些资产是护城河，不是技术债。**
