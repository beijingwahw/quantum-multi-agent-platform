# 主动智能模块审计

> 审计范围：`src/proactive-intelligence/`（brain.ts / decision-engine.ts / executor.ts / index.ts / monitor.ts / plugin.ts / rules.ts / types.ts）
> 版本：quantum-multi-agent-platform v1.10.0（TypeScript ESM，运行时依赖仅 ws）
> 审计时间：2026-09-05 | 审计人：subagent_02

## 模块概览

（待补全）

## 发现清单

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|--------|------|------|--------------|----------|
| 1 | P2 | brain.ts:52 (`MarketBrain.getState`) | 接口方法返回 `object`，等价于放弃类型契约；调用方（规则引擎注入 `currentState.brain`）只能靠动态路径访问 | TS 官方 style guide 明确 `object` 为「无用类型」；2026 前沿标准要求公共接口返回精确结构 | 定义 `getState(): BrainState`（或泛型 `getState(): S extends object`），让 CompoundBrain 等实现各自声明状态形状 |
| 2 | P2 | brain.ts:54 (`registerAgent?(spec: unknown): unknown`) | 鸭子类型接口用 `unknown` 进/`unknown` 出，签名无信息量；`GrowthSchedulerBrain.registerAgent` 实际收 `GrowthAgentSpec`，接口与实现脱节 | 依赖倒置原则：抽象接口应承载消费方所需的最小类型信息 | `registerAgent?(spec: GrowthAgentSpec \| AgentSpecLike): boolean`，或拆成泛型 `MarketBrain<A, S>` |
| 3 | P1 | decision-engine.ts:56-60 (`addRule`) | 规则对象按引用存入且 `toggleRule` 直接改写 `rule.enabled`、`makeDecision` 改写 `rule.lastExecuted`——调用方持有的同一对象会被引擎内部状态机污染，反之调用方也能外部改 conditions 绕过冷却 | 所有权与别名安全：共享可变状态是并发/回归 bug 温床；EventEmitter 会再把同一引用 `emit` 出去放大风险 | 入库时深拷贝（或冻结 + 内部维护 `lastExecuted` 旁路 Map），事件负载只发只读快照 |
| 4 | P2 | decision-engine.ts:315 (`getMetrics`) | `{ ...this.metrics }` 浅拷贝——`rulesTriggered` 对象仍是内部引用，外部拿到后可直接改写引擎指标 | 封装不可变性：getter 不得泄漏可变内部结构 | `rulesTriggered: { ...this.metrics.rulesTriggered }` 或 `structuredClone` |
| 5 | P2 | decision-engine.ts:169-197 (`evaluateCondition`) | 数值比较对缺失值不设防：`extractEventValue` 查不到返回 `null`，`Number(null)=0` 使 `greaterThan/lessThan/between` 在字段缺失时可能命中（如 `null > -1` → true）；`Number(undefined)=NaN` 则恒 false——同一缺失两种命运 | 失败应显式：缺失字段参与比较需先判空，避免隐式数值化 | 值为 `null/undefined` 时除 `equals/notEquals` 外一律返回 false |
| 6 | P2 | decision-engine.ts:180-186 (`contains`) | `String(value).includes(String(condition.value))`：`value=undefined` 会变成字符串 `"undefined"` 参与包含判断，含 "undefined" 子串的规则会误命中；数值也会被字符串化做子串匹配（`12` contains `1` → true） | 精确类型操作：contains 应限定 string/string[] 或 Array<number> 语义 | 显式分支：string→includes、Array→includes、其余 false；禁止 String() 万能转换 |
| 7 | P3 | decision-engine.ts:47-49 (`constructor`) | `_config` 参数完全未使用，配置被静默吞掉——构造签名承诺了不存在的可配置性 | 死代码/API 诚实性：要么实现要么删除 | 删参数，或真正读取配置（如历史上限、冷却默认值） |
| 8 | P3 | decision-engine.ts:100-103 (`makeDecision` 返回 Promise) | 全同步逻辑包一层 `Promise.resolve`，强制所有调用方 await；配合后续执行器若真异步会造成「半异步」混乱 API | async 一致性：同步决策应同步返回（或明确说明为前向兼容保留） | 直接返回 `Map`，或标注 deprecated 并在 v2 改签名 |
| 9 | P3 | brain.ts:92-96 (`getState`) | `settled=0` 时 `successRate` 缺省为 `1`（100%），下游规则 `brain.successRate < 0.5` 之类在冷启动期永不触发，语义上「无数据≠全成功」 | 统计口径诚实：无样本应返回 null/NaN 并由规则侧显式处理 | 返回 `null` 并在文档标注，或提供 `hasData` 字段 |
| 10 | P3 | brain.ts:63 (`openTasks`) | `openTasks` Set 无上限、无过期清理：执行器若漏调 `settleTask`（异常路径常见），集合只增不减，`getState().openTasks` 永久虚高 | 资源生命周期：每个「登记」必须有对应的回收路径或 TTL | 增加任务 TTL / 最大在途数，settle 与插件 destroy 时清空 |
| 11 | P1 | types.ts:44-46 (`Condition.value`) | 条件值声明为 `unknown`，`between` 需 `[number, number]`、`matches` 需 `string\|RegExp`——契约把类型校验责任全部推给运行时，而求值器对非法形状只静默 return false | 判别联合（discriminated union）是 2026 TS 表达多态载荷的标准做法：`{operator:'between', value:[number,number]}` | 按 operator 建判别联合，或至少收敛为 `string\|number\|boolean\|Array<number>\|RegExp` |
| 12 | P2 | types.ts:16-24 (`DecisionContext.currentState`) | `currentState: unknown` + 规则按 `'a.b'` 动态路径读取——状态形状完全无类型，规则写错字段名不会在编译期暴露，只能靠运行时静默 null | unknown 收窄要有出口：动态访问应有类型守卫或声明 `Record<string, unknown>` 并文档化路径约定 | `currentState: Record<string, unknown>` 起步；或为规则提供泛型 `DecisionEngine<S>` 固定状态形状 |
| 13 | P2 | monitor.ts:33-44 (`StateMonitorConfig`) | `maxBufferSize`/`retentionMs` 无边界校验：传 0 或负数会被 falsy 判断静默忽略（0 反而回退默认值，语义反转）；传负 retentionMs 会让所有事件立刻过期 | 配置边界校验：`if (config.maxBufferSize && config.maxBufferSize > 0)` 之外还需拒绝非法值并告警 | 显式 `typeof === 'number' && > 0` 校验，非法值抛错或 warn |
| 14 | P2 | monitor.ts:47-64 (`observe`) | `getStatistics().total` 返回的是「未过期事件数」而非累计总数（`liveEvents()` 先切掉过期前缀），字段名 `total` 语义误导；且每次调用全量 reduce 4 次，万级缓冲下单次调用 O(4n) | 命名诚实 + 增量聚合：统计应随事件入列增量维护或用词精确 | 改名 `liveCount` 或维护 `totalCount` 计数器；byType/bySeverity 增量累加 |
| 15 | P3 | monitor.ts:106-116 (`cleanup` 容量路径) | 惰性前缀游标设计不错，但 `overflow` 分支把「容量淘汰」与「过期淘汰」混在同一游标：`getEvents()` 返回 `slice(expiredPrefix)` 会把「因容量被挤掉但未过期」的事件也一并藏起来，行为正确但注释/字段名（expiredPrefix）已名不副实 | 语义清晰：容量淘汰与过期淘汰语义不同，混用会让后续维护者误改 | 重命名为 `deadPrefix`/`droppedPrefix` 或拆分两个游标 |
| 16 | P1 | executor.ts:100-119 (`executeAction` 预检拒绝路径) | 三处预检拒绝（disabled / blocked / 并发超限）均为「入史 + emit + throw」：失败未执行的动作被计入 `getExecutionHistory()` 统计口径，且抛错后调用方（plugin）若再 recordExecution 会双计数；更严重的是 `safeMode` 路径 `status='completed'` 会进入 completed 指标，将「安全模式跳过」与真实成功混同 | 审计口径准确性：被拒绝 ≠ 失败 ≠ 跳过，三者应可区分 | 增加独立状态 `rejected`/`skipped`（types.ts 状态机扩展），预检失败不 throw 或使用不同事件名 |
| 17 | P1 | executor.ts:158-167 (`performAction` 重试) | 重试循环对可重试错误不区分错误类型：任何非超时错误（包括 ToolError 策略拒绝、参数校验错误这类确定性失败）都会按 backoff 重试 maxRetries 次——确定性失败重试纯属浪费且放大副作用 | 重试分类：仅对瞬态错误（网络/5xx/资源忙）重试，确定性错误立即失败（标准库 p-retry 语义） | 引入 `isRetryable(error)` 判定；ToolError 类策略/参数错误直接 throw |
| 18 | P2 | executor.ts:152-166 (超时竞态) | `Promise.race` 只拋超时但底层 `executeByType` 的 promise 不会被取消（真脱钩）：命令进程可能仍在跑，定时器虽清理但子进程/句柄泄漏；`cancelledIds` 路径同理，cancel 后 handler 仍在飞 | 2026 前沿标准：异步操作应接受 AbortSignal 实现协作式取消 | performAction 接受 `AbortSignal`，command 动作把信号传给 execute_command_argv 杀进程 |
| 19 | P2 | executor.ts:282-289 (`executeCustom`) | `(handler as (params) => unknown)` 断言后同步调用但包进 Promise.resolve：handler 若抛错会被同步抛出到 executeByType 调用链，能被外层 try 捕获，但 handler 返回 Promise 时返回值直接当结果（未 await）——返回 Promise 的 handler 会把 thenable 当 result 存储 | 类型诚实：custom handler 签名应声明 `unknown \| Promise<unknown>` 并统一 await | `return Promise.resolve(handler(...)).then(r => r)` 或直接 async 包装并 `await handler(...)` |
| 20 | P3 | executor.ts:52-65 (并发预检 TOCTOU) | 并发上限检查在 async 函数入口同步执行，技术上无真正的 TOCTOU（JS 单线程），但若未来有人把预检移到 await 之后就会产生竞态；当前实现依赖隐式时序假设，无注释固化 | 防御性设计：并发不变量应有断言或注释锁定 | 在检查处加注释说明依赖单线程事件循环时序，或改用信号量抽象 |
| 21 | P0 | plugin.ts:200-233 (`processEventBatch` 串行 await) | 动作执行循环 `for...await` 串行：上一动作完成（含 30s 超时 + 重试退避）才执行下一个；一条含多个动作的规则或高优先级规则链在事件风暴下会排队堆积，且 batch 内串行使 `maxConcurrentActions=10` 并发上限形同虚设（实际并发恒为 1） | 并发吞吐：执行器并发策略应真正并行；2026 前沿标准用 `Promise.allSettled` + 信号量并发池 | 动作展开后用有限并发池执行（如 p-limit 语义），保留规则间优先级顺序语义 |
| 22 | P1 | plugin.ts:90-93 (`config.brain` duck typing) | `typeof (config.brain as MarketBrain).submitTask === 'function'`——若用户传入的调度器配置对象恰好有 submitTask 键（或未来 GrowthSchedulerConfig 增加该字段）会被误判为 Brain 实例；反向：缺少 submitTask 的部分实现会静默退化为新建默认市场 | 鸭子类型探测脆弱：配置与实例联合应显式判别（tag/discriminator） | `config.brain instanceof GrowthSchedulerBrain` 或配置改用 `{ brain: { instance } / { config } }` 显式判别字段 |
| 23 | P1 | plugin.ts:237-261 (`getCurrentState` 全量重建) | 每次决策（每个事件 batch）都重建整个状态快照：`getEvents()` 全量拷贝、`getStatistics()` 双重 reduce O(n)、`getDecisionHistory(10)` 拷贝、`getRunningExecutions()` 二次调用——万级事件缓冲下每 batch O(n) 起，与 monitor 的惰性前缀优化意图相悖 | 增量计算与缓存：状态快照应缓存或增量维护，而非每 tick 全量重建 | 状态快照缓存（脏标记失效），statistics 增量维护，runningExecutions 只调一次 |
| 24 | P1 | plugin.ts:243 (`brain: object \| null`) | `CurrentSystemState.brain` 类型为 `object`：规则引擎对 `brain.successRate` 的访问完全依赖运行时动态路径，而 plugin 明明知道具体形状（BrainState 或外部 Brain 的 getState 返回） | 类型流透：装配层是唯一知道具体形状的地方，用 `object` 把信息丢弃最可惜 | `brain: BrainState \| Record<string, unknown> \| null`，为外部 Brain 定义 `getState(): BrainState` 接口 |
| 25 | P2 | plugin.ts:113-118 (事件转发监听器) | 插件持引擎/执行器 13 个事件名的转发监听器，但无 `destroy()`/`dispose()` 方法：插件 stop 后监听器仍在，monitor/engine/executor 内部对象永不可 GC；EventEmitter 默认 maxListeners=10，此处已达 13，Node 会发 MaxListenersExceededWarning | 生命周期管理：可释放资源必须有 dispose；监听器泄漏是 Node 经典反模式 | 增加 `destroy()`：removeListener 全部转发器 + monitor.clear()；或改用组合而非继承 EventEmitter |

（executor / monitor / plugin / rules / types / index 审计中，将追加……）

## 模块级优点

（待补全）

## Top3 升级建议

（待补全）
