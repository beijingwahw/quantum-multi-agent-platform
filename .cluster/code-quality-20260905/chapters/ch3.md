# 第 3 章 P0/P1 发现详解

P0/P1 是本仓必修清单的主体：P0 = 事件风暴下吞吐塌陷/安全边界失效，P1 = 静默数据损坏/状态机死锁/精确最优解可疑。本章按四组代码缺陷主题详解——状态机完整性 4 条、并发与异步纪律 5 条、边界安全 3 条、算法正确性 3 条——另收测试有效性 P1 4 条；工具链与文档维度 P1 以 3.6 归位表收尾，保证 P0/P1 全量在册。验证状态口径依 review.md：**已验证** = 复核回读源码确认（行号以复核为准）；**疑点** = 原始表述自相矛盾、降级待验证；其余为中置信（单源 + 行号自洽）。证据行号 ±10，路径省略 `src/` 前缀。

## 3.1 状态机完整性（4 条）

### 3.1.1 【P1 · 已验证】调度入口无状态守卫：完成任务可被静默改判为失败

- **证据**：`core/quantum-scheduler.ts:460` 起 `scheduleTask`（复核确认；原报 ~468）。
- **问题**：`scheduleTask(taskId)` 只校验任务存在与依赖满足，不校验 `task.status === 'pending'`；下游 `assignTaskToAgent` 同样无守卫。
- **影响**：对已 `assigned`/`running` 的任务重调（外部重试是最自然的调用场景）：`assignedAgentId` 被覆盖、旧 agent 的 `load` 不回减、`activeAssignments` 重复递增；对已 `completed` 的任务调用则被改回 `assigned`，随后 `completeTask` 幂等守卫按非终态处理，最终经超时巡检标成 `failed`——**已完成的任务被静默改判为失败**，属典型静默数据损坏。
- **修复**：`scheduleTask` 与 `assignTaskToAgent` 开头加 `if (task.status !== 'pending') return` 守卫，与 `reschedulePendingTasks` 内部已有的惰性状态检查对齐。公开状态转移 API 必须自带前置条件守卫，不能依赖调用方自律。

### 3.1.2 【P1 · 已验证】overloaded 吸收态：agent 永久退出候选池

- **证据**：`core/quantum-scheduler.ts:402-406`（`completeTask` 释放分支，复核确认）+ `~1452`（`assignTaskToAgent` 置态处）。
- **问题**：`assignTaskToAgent` 在 `load > AGENT_OVERLOAD_THRESHOLD` 时置 `state = 'overloaded'`；但释放分支只处理 `state === 'working'`——overloaded 没有任何出边。
- **影响**：任务全部完成、`load` 归零后状态仍是 `overloaded`，而 `resolveCandidates`/空闲池筛选只收 `idle`——该 agent **永久退出调度**（文件内无重置路径）。连带 `getSystemMetrics().systemLoad` 只统计 `working`，全员 overloaded 时系统显示零负载。复核评价：本仓最典型的状态机死锁。
- **修复**：释放分支改为 `if (agent.state === 'working' || agent.state === 'overloaded')`，按 `load` 与阈值重判 idle/overloaded；若 agent-manager 侧存在外部恢复逻辑，应以注释显式声明该依赖，避免双头维护。

| 编号 | 严重度 | 证据 | 问题与影响 | 修复方向 |
|---|---|---|---|---|
| 02#16 | P1 | proactive-intelligence/executor.ts:100-119 | 预检拒绝（disabled/blocked/并发超限）与真实失败共用「入史 + emit + throw」路径：被拒动作计入执行历史统计；safeMode 跳过标 `completed` 与真实成功混同——被拒绝≠失败≠跳过三态不可区分 | types.ts 状态机扩展 `rejected`/`skipped` 独立状态与计数；预检失败不 throw 或换独立事件名 |
| 08#47 | P1 | index.ts（stop） | stop() 清理定时器/总线/管理器，但 setupEventHandlers 注册的约 8 个跨组件监听器不解除：组件引用滞留、平台不支持重启复用；Platform 自身无 dispose/shutdown 契约 | 提供 dispose()（removeAllListeners + 各组件 dispose），或监听器统一由 AbortController signal 管理 |

## 3.2 并发与异步纪律（5 条）

### 3.2.1 【P0 · 已验证】plugin 动作串行执行：事件风暴下吞吐塌陷

- **证据**：`proactive-intelligence/plugin.ts:140-186` `processEventBatch`（复核确认 `for [ruleId] → for action → await executeAction` 双层串行循环属实；原报 200-233，偏差在 subagent 自注 ±10 内）。
- **问题**：动作执行循环 `for...await` 串行——上一动作完成（含 30s 超时 + 重试退避）才执行下一个；配置的 `maxConcurrentActions=10` 并发上限形同虚设，**实际并发恒为 1**。
- **影响**：多动作规则与高优先级规则链在事件风暴下排队无界堆积。全仓唯一 P0；复核按「影响面 × 修复成本」重审后保留 P0 定级（事件风暴下堆积无界）。
- **修复**：动作展开后改有限并发池执行（p-limit 语义），保留规则间优先级顺序语义。

| 编号 | 严重度 | 证据 | 问题与影响 | 修复方向 |
|---|---|---|---|---|
| 08#34 | P1 | core/subspace-parallel.ts（parallelAnnealEvolve dispatch） | 主线程同步 Atomics.wait 自旋等待（50ms 超时轮询）：steps=150 时每步 m+1 次 dispatch、单 dispatch 最坏 20s（steps<15 时 stepBudget 上限）、总阻塞可达分钟级——演化期间 HTTP/WS 心跳、GC、immediate 队列全部停摆；被 ws 平台主循环调用时即全平台假死 | 主控循环移入 worker（主线程只 await Promise），或每 dispatch 间 `await setImmediate` 分片让出 |
| 08#33 | P1 | core/subspace-parallel.ts（workerSource/buildWorkerSource） | Function.toString 序列化注入 Worker 是脆弱的自制打包器：esbuild `__name` 兼容补丁已证明对打包器改写敏感；kernel 自包含纯靠约定、无机制保证，未来打包器再破坏只能以 10s 握手超时 + 回退串行显现 | fiber-kernel 提为独立 worker 入口文件，`new Worker(new URL(...))` 原生引用，打包器支持且类型可检查 |
| 02#17 | P1 | executor.ts:158-167（performAction 重试） | 重试不区分错误类型：ToolError 策略拒绝、参数校验等确定性失败也按 backoff 重试 maxRetries 次——确定性失败重试纯属浪费且放大副作用 | 引入 `isRetryable(error)`：仅瞬态错误（网络/5xx/资源忙）重试，策略/参数错误立即失败 |
| 02#3 | P1 | decision-engine.ts:56-60（addRule） | 规则对象按引用入库，`toggleRule`/`makeDecision` 直接改写 `rule.enabled`/`rule.lastExecuted`——调用方对象被引擎内部状态机污染，外部也能改 conditions 绕过冷却；EventEmitter 再把同一引用 emit 出去放大别名风险 | 入库深拷贝/冻结 + `lastExecuted` 旁路 Map；事件负载只发只读快照 |

## 3.3 边界安全（3 条）

| 编号 | 严重度 | 证据 | 问题与影响 | 修复方向 |
|---|---|---|---|---|
| F01 | P1 | communication/quantum-bus.ts:169-187（subscribe 分支） | `message.channel` 零运行时校验：任意 JSON 值可入 `subscriptions`；近 1MB 字符串 × 64 次订阅可占内存；后续 `subscriptions.includes` 比较语义被破坏 | 边界加 `typeof === 'string' && length ≤ 128` 守卫，不合法忽略或断连 |
| F02 | P1 | quantum-bus.ts:437-455（queueMessageForAgent/sendToAgent） | 离线队列每桶封顶 1000 但 Map key 数量无上界：已认证对端向海量伪造 targetAgentId 发消息即可无限建桶直至 OOM——per-agent 上限挡不住 cardinality 攻击 | 加 maxQueuedAgents 或全局 maxTotalQueuedMessages；超限丢弃新桶并计入 droppedMessages |
| 02#22 | P1 | plugin.ts:90-93（config.brain 探测） | 鸭子类型探测 `typeof (config.brain).submitTask === 'function'`：配置对象恰有该键即被误判为 Brain 实例；缺 submitTask 的部分实现静默退化为新建默认市场 | `instanceof` 判别，或配置改 `{ brain: { instance } / { config } }` 显式判别字段 |

## 3.4 算法正确性（3 条）

### 3.4.1 【P1 · 疑点，建议验证】bruteForceOptimum 耦合键语义：精确参照的可信度存疑

- **证据**：`core/quantum-optimizer.ts`（bruteForceOptimum dfs 与 toIsing addQ；subagent_08 #13）。
- **疑点陈述**：原始发现自相矛盾——先确认 dfs 的 lo/hi 编码（`t*n+a` 与 `t2*n+a2` 取 min/max）与建键方一致；随即指出真正分歧在对角耦合：当 `n=1`（单 agent）时 lo=hi=同一 qubit，`toIsing` 经 `addQ` 把它并入线性项 `c[q]` 保留，而 dfs 查询与 computeEnergies/welfareOf 的 `q1<q2` 过滤都排除 `q1==q2`——**同一输入在 bruteForce / 内置能量 / Ising 导出三条路径给出不同能量语义**。若成立，「精确最优对照」这一机制设计根基（optimality 字段、穷举达成率认证）可信度受损。
- **复核处理**：review.md 将其降级为「疑似」，列入建议验证清单而非结论。
- **建议验证**：构造含对角耦合键（或 n=1）的 AssignmentProblem，分别运行 bruteForceOptimum、computeEnergies、toIsing + 外部求解，比对福利/能量是否一致。**若确认**：在 AssignmentProblem 构造处禁止 `q1==q2` 键，或三条路径统一把对角耦合并入线性福利。

| 编号 | 严重度 | 证据 | 问题与影响 | 修复方向 |
|---|---|---|---|---|
| 08#23 | P1 | core/subspace-optimizer.ts（collapseSubspace shots-best） | shots 全部采到 0 概率态时 `if (chosen < 0) chosen = 0`——回退第 0 号基态（DFS 字典序最小解，无任何最优语义）；全空间引擎同场景回退是 argmax-valid，两引擎同语义场景不同回退策略且子空间质量明显更差 | `chosen < 0` 时改走与全空间引擎一致的 argmax-valid 扫描 |
| 08#24 | P1 | subspace-optimizer.ts（annealSolveSubspace rawExpectation） | 归一化能量还原三处三写：anneal 子空间 `(E/(2·spectralWidth))·span+min`、QAOA 子空间 `E·span+min`、全空间另有写法——退火路径的除法目前「碰巧对」但无共享函数，改动极易引入不一致（与 4.2 双实现簇同源） | 抽 `denormalizeExpectation()` 单一实现，全空间×2 + 子空间×2 四处统一调用 |

## 3.5 测试有效性（4 条 P1）

测试侧 P1 高度同源：**时序非确定性**——用真实时钟、真实网络往返、固定轮次 setImmediate 等待异步完成。这是覆盖率门禁 92% 之下 CI 间歇红与回归掩盖的主通道；修法共同指向「被测系统暴露确定性 flush 原语 + 可注入 transport/clock」。

| 编号 | 证据 | 问题 | 修复方向 |
|---|---|---|---|
| 05#1 | tests/proactive-intelligence.test.ts:20-27 | tick() 用 4 次 setImmediate 经验魔法数等待批处理，CI 慢机少等一轮即间歇失败 | plugin 暴露 flush()/whenIdle() 原语，断言改事件驱动等待 |
| 05#2 | tests/quality-regressions.test.ts:592-640 | 总线鉴权组 tick(6) 依赖真实 WebSocket 往返 + 事件循环轮次 | ws mock server 或总线事件 Promise 化，去真实网络往返 |
| 05#15 | tests/security-hardening.test.ts:126-134 | 超时终止用例真实等 1.5s 死循环脚本；杀进程失败（Windows 任务树语义）即泄漏到 CI | timeoutMs 降 200ms 量级或注入时钟；finally 兜底 taskkill |
| 05#17 | tests/qpu-backend.test.ts:40-100 | D-Wave 用例走真实 HTTP（127.0.0.1 stub server）：端口分配、TCP 握手、close 挂起在受限网络 CI 下 flaky | 后端支持注入 fetch/transport，测试传 mock；close 包 Promise + 超时兜底 |

## 3.6 其余 P1 归位（全量口径）

以下 P1 不属上述四组主题，为口径完整在此归位、不在本章展开：

- **类型契约类**（→ 4.4 簇四）：02#11 `Condition.value: unknown`（types.ts:44-46）；02#24 `CurrentSystemState.brain: object`（plugin.ts:243）。
- **热路径性能类**（→ 4.3 簇三）：02#23 getCurrentState 每 batch 全量重建状态快照、万级事件缓冲下 O(n) 起（plugin.ts:237-261）；08#14 computeEnergies O(2^nq·m·n) 能量预计算每次求解全量重算、无 memo（quantum-optimizer.ts）。
- **工具链类**（→ 第 2 章对标、第 5 章 Wave 1）：I1 engines.node ">=20" 踩 Node 20 EOL（2026-04-30）；I2 ESLint 9 已 EOL（2026-08-06）未升 10；I3 CI 缺 timeout-minutes/concurrency/permissions/供应链扫描四类基线。
- **文档漂移类**（→ 第 7 章边界）：06#1 README badge 1.7.0 ≠ v1.10.0；06#2「281 用例全通过」数字过期；06#11 实验口径 n=2112 与代码注释 1056 不一致；06#17 快速开始缺 example:basic/advanced 入口；06#20 postinstall 声明与 package.json 事实不符。
