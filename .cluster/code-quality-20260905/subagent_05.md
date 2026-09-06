# 测试质量审计

**审计对象**：`D:\multi-agent\ds_extracted\ds\tests\`（quantum-multi-agent-platform v1.10.0，node:test + tsx + c8，覆盖率门禁 92/82/92/92）
**审计范围**：仅 tests\ 目录 28 个 .test.ts 文件（不涉及 src/CI/配置）
**审计标准**：2026 前沿测试架构标准（断言强度 / flaky 模式 / 隔离性 / 边界覆盖 / 重复度）

---

## 测试质量画像（强/弱模块分布）

### 强模块（断言扎实、理论驱动、可回查）

| 模块 | 文件 | 质量亮点 |
|---|---|---|
| 机制设计（VCG/相变） | batch-vcg-scheduler.test.ts (21K) | 手工推导闭式值精确断言（p_w=8、take=2、λ=1），DSIC 30 实例×多扰动实证，理论注释完整可回查 |
| 复合学习市场 | compound-brain.test.ts (23K) | 机制定理边界（单批 DSIC 边界声明）、多 seed 统计口径声明、逐位一致性校验（JSON 比对） |
| 相变定律 | train-vs-hire-phase.test.ts (14K) | 闭式↔模拟双向验证、α* 符号翻转点验证、Π 群坍缩普适性检验 |
| 质量回归 | quality-regressions.test.ts (17K) | 每用例锁定一个真实缺陷、含安全回归（原型污染/沙箱逃逸/总线鉴权） |
| 安全加固 | security-hardening.test.ts (12K) | 命令注入/路径穿越/符号链接逃逸全覆盖，平台差异处理（win32 分支） |

### 弱模块（存在浅断言/时序耦合/重复)

| 模块 | 文件 | 主要风险 |
|---|---|---|
| 主动智能插件 | proactive-intelligence.test.ts (11K) | setImmediate tick 等待魔法数、断言回流指标的时序假设 |
| 其余小文件 | 待逐个浏览 | （清单见发现编号） |

---

## 发现清单

| # | 严重度 | file:line | 问题 | 前沿标准依据 | 修复建议 |
|---|---|---|---|---|---|
| 1 | P1 | proactive-intelligence.test.ts:20-27 | `tick()` 用 4 次 setImmediate 等待批处理，次数是经验魔法数；CI 慢机/事件循环拥堵下可能少等一轮导致间歇性失败 | Kent C. Dodds "Avoid arbitrary sleeps"；Google Testing Blog: deterministic async testing | 让 observe() 返回 Promise 或暴露 `flush()`/`whenIdle()` API，断言改为事件驱动等待（如 `decision_made` 事件 Promise 化） |
| 2 | P1 | quality-regressions.test.ts:592-640（QuantumBus 鉴权组） | tick(6) 依赖真实 WebSocket 往返 + 事件循环轮次，网络栈慢时 6 轮 setImmediate 不够；且未认证连接断开时序敏感 | hermetic tests 原则（Google Testing Blog）；杜绝真实网络往返的不确定性 | 用 ws mock server 或 bus 事件（`connection`/`message`）Promise 化替代固定轮次；至少给 tick 加超时+重试谓词 |
| 3 | P2 | security-hardening.test.ts:106-113 | Windows 无开发者模式时 symlink 用例"创建失败则自动跳过"（静默 return）——CI（Windows runner 常无权限）实际从不执行该安全用例，覆盖假象 | coverage honesty：跳过的用例不应计入覆盖；c8 门禁 92% 下这类分支是盲区 | 显式 `t.skip('requires symlink privilege')` 记录跳过原因，或改用 junction（Windows 目录联接无需特权）测试路径穿越 |
| 4 | P2 | security-hardening.test.ts:116-122 | `execute_command 拒绝 shell 元字符`断言 `/metacharacter/i` 只验证拒绝发生，未验证"拒绝的是元字符本身"（错误消息文案变化即脆弱） | 断言行为而非实现细节（伦敦学派）；错误码/错误类型断言优于消息正则 | 引入结构化错误类型（如 `CommandPolicyError.code === 'METACHAR'`）断言 code，而非文案 |
| 4 | P2 | security-hardening.test.ts:116-122 | 同上（见上行说明） | 同上 | 同上 |
| 5 | P2 | quality-regressions.test.ts:556-562（监控器惰性过期） | `retentionMs: 1` + `setTimeout 10ms` 真实时钟等待——时钟分辨率/调度延迟下事件可能恰好在边界过期，断言已用 `<=1` 自适应，但 `getStatistics().total === events.length` 在并发过期下仍脆弱 | 假时钟（fake timers）标准实践；Microsoft: time-dependent code needs clock injection | StateMonitor 接受可注入 clock（`now()`），测试传固定时钟序列，完全去时序化 |
| 6 | P2 | proactive-intelligence.test.ts:57-63（Bug A 用例） | `plugin.getEngine().on('decision_made', cb)` 回调内 assert——若回调未触发该断言静默通过（assert 只在回调执行时生效），主断言依赖 hist.some() 兜底 | "assertion in callback never ran" 是经典假阴性模式（Effective Testing, KoPM） | 回调只收集数据（push 到数组），await tick 后再统一断言数组内容 |
| 7 | P2 | batch-vcg-scheduler.test.ts:40-58（替代效应组） | 手工推导魔数断言（p_w=8、take=2、λ=1）正确但无中间量校验——若实现重构导致 8 恰好由别的错误组合得出（如 8=4+4 双错抵消），断言仍绿 | Oracle 问题：单点魔数无法定位错误来源；property-based testing 前沿实践 | 保留魔数主断言，补充不变量断言（如 p_w = cost·k + externality 分解校验、payments 守恒 Σp+take=Σv） |
| 8 | P3 | compound-brain.test.ts:435-443（可观测性零数值影响） | `JSON.stringify` 逐位比对依赖对象键序稳定（payments 键序由插入序决定）——实现内 Map 迭代序变化会假红 | 结构化断言应使用 deepEqual 而非字符串化 | 改 `assert.deepEqual(结构化对象)`，对数组键序显式 sort |
| 9 | P3 | compound-brain.test.ts:106-126（增长投资行为组） | 每个用例重复 `makeBrain → registerAgent(veteran/trainee) → 50 批 simulateBatch → 累计 welfare` 骨架，4 个用例 4 份复制，仅参数不同 | DRY；测试辅助函数应参数化（Test Harness Pattern, Meszaros） | 抽 `runWelfareSeries(gamma, seed, agentSpecs, batches)` helper，参数化 δ/α/β/K |
| 9 | P3 | compound-brain.test.ts:106-126（增长投资行为组） | 同上 | 同上 | 同上 |
| 10 | P3 | proactive-intelligence.test.ts:180-203（增长调度器 Brain 组） | makePlugin 工厂每次 new 完整插件（含 start/stop 生命周期），单元级断言（winnerId/capital）拖着重插件生命周期跑 | 测试金字塔：单元测试不应启动完整系统集成 | GrowthSchedulerBrain 单元已可独立测（文件尾部有先例），中间层断言拆到 brain 单测 |
| 11 | P2 | batch-vcg-scheduler.test.ts:279-295（BudgetPacer 组） | 80 批模拟 × 2 组（实验+基线）无进度保护，若 simulateBatch 每批 0.5ms 则该用例约 80ms，可接受；但 pacer 收敛断言 `mean ∈ [0.7B, 1.3B]` 容差 30%——相对宽松的收敛带 | 收敛测试应有界且可解释（convergence tolerance 应源自理论bound而非经验） | 注释中给出容差来源（对偶上升步长/学习率推导），或收紧为分段断言（先验证单调趋近再验证收敛带） |
| 12 | P3 | quality-regressions.test.ts:372-394（solver 退化参数组） | `assert.throws(..., /steps/)`、`/tau/` 消息正则——与发现4同类的消息耦合 | 同发现4 | 同发现4：结构化错误码 |
| 13 | P3 | train-vs-hire-phase.test.ts:29-33 | `SEEDS = 100..111` 固定种子 12 个——固定种子保证可复现是优点，但 12 seed 均值断言的统计功效未声明（若 seed 集恰处于相位边界抖动区，回归会假红） | 种子稳定性审计（seed stability audit）：固定随机集应做多次抽样稳定性验证 | 对关键相位断言（如 low<-0.02）补充 24-seed 扩展集的敏感性注释或烟雾验证 |
| 14 | P3 | compound-brain.test.ts:368-372（advice() 结构断言） | `assert.ok(typeof inc.capital === 'number')` 结构存在性断言，未校验语义正确性（capital 是否随 δ 递增）——注释宣称"δ 单调"但断言未兑现 | 断言强度分级：存在性 < 类型 < 语义不变量 | 兑现注释：对 incubations 按 delta 排序后断言 capital 单调不增/对应关系 |
| 15 | P1 | security-hardening.test.ts:126-134（超时终止用例） | `timeoutMs: 1500` + 死循环脚本 `for(;;){}`——真实等待 1.5s 才能验证超时杀进程，单用例 1.5s；且若杀进程失败（Windows 任务树语义）进程泄漏到 CI | 测试速度预算（Google: 单测 <100ms 理想）；进程泄漏会累积拖慢后续套件 | timeoutMs 降到 200ms 量级（若实现支持亚秒超时）；或注入 fake timer 推进；finally 增加兜底 taskkill |
| 16 | P3 | proactive-intelligence.test.ts:205-209（配置透传用例） | 断言 `a?.winnerId === 'solo'` + settleTask 幂等——但未覆盖同 capability 多任务并发提交时的容量边界（capacity 默认未约束？） | 边界覆盖：容量/并发上限是调度器核心边界 | 补充 capacity=1 连续 submitTask 两次的弃标/排队行为断言 |

（发现 4、9 在表中出现两次系原始记录格式，去重后共 **14 条独立发现**）

---

## Top3 升级建议

### 1. 消灭 setImmediate-tick 时序魔法数（对应发现 1/2/6）
受影响面最广的系统性问题：proactive-intelligence、compound-brain（插件集成组）、quality-regressions（总线组）三处共 8+ 用例依赖固定轮次 setImmediate。**方案**：被测系统暴露确定性 flush 原语（`plugin.flush()` 返回内部批处理 Promise），测试统一改事件驱动等待。这是把整个测试套件从"时序耦合"升级到"确定性异步"的最大杠杆，直接消灭 CI 慢机间歇红的主来源。

### 2. 安全测试的消息正则断言升级为结构化错误码（对应发现 4/12）
安全门禁用例（命令注入/路径穿越/元字符）的 `/metacharacter/i`、`/escapes the filesystem sandbox/` 断言与错误文案强耦合——文案重构即批量假红，而真正的安全回归（拒绝行为消失）反而可能因文案巧合仍匹配。**方案**：src 侧引入 `SecurityViolationError` 带 `code` 字段（POLICY_METACHAR / POLICY_PATH_ESCAPE / POLICY_WHITELIST），测试断言 code。安全断言的可靠性优先级高于普通功能断言。

### 3. 抽取机制层测试 Harness 层（对应发现 7/9/10）
compound-brain 与 batch-vcg 的增长/投资用例存在成片的"new Brain → register 双 agent → N 批 simulate → 累计 welfare"复制骨架。**方案**：建 `tests/helpers/market-sim.ts` 提供 `runWelfareSeries(config)` 与 `closedFormCheck(allocation)`（守恒校验：Σp + take = Σv、p_i = b_i·k + externality 分解），既消重复又把"魔数 8"升级为可分解的不变量断言——一处 helper 升级，多处断言强度受益。

---

（发现 4、9 在表中出现两次系原始记录格式，去重后共 **14 条独立发现**）

### 第二批补充（qpu-backend / quantum-optimizer / agent-manager）

| # | 严重度 | file:line | 问题 | 前沿标准依据 | 修复建议 |
|---|---|---|---|---|---|
| 17 | P1 | qpu-backend.test.ts:40-100（stub 服务器） | D-Wave 测试用**真实 HTTP 往返**（127.0.0.1 stub server）——虽是本机回环，但 listen 端口分配、TCP 握手、server.close() 挂起都可能在 CI 容器（无回环/受限网络命名空间）下 flaky；`after` 里 `stub.server.close()` 未等待 close 完成也未处理错误 | hermetic testing：网络依赖测试应可注入 transport；端口资源泄漏会累积 | DWaveBackend 支持注入 fetch/transport 层，测试传 mock fetch；至少 `close()` 包 Promise + 超时兜底 |
| 18 | P2 | qpu-backend.test.ts:233-262（真 QPU 注入用例） | 测试注释自认"此处返回已在测试内静态构造的最优（t0→a2）"——stub 返回硬编码 spins `[1,1,-1]`，与提交问题的实际权重**无关联**：若调度器侧问题构造变化（如 eligibility 排序变化），该用例要么假红要么静默测了个已退化的路径；注释里大段"太复杂"的解释本身就是设计债 | test oracle 有效性：stub 返回值必须从请求侧推导或显式声明为固定契约 | stub 的 respondWith 从 captured request body 解码 h/J 规模后动态构造合法解，或至少断言提交问题的 nqubits 与 stub 响应维度匹配 |
| 19 | P2 | qpu-backend.test.ts:213-231（调度器 QPU 入口） | `submitTask(... as any)` 强制绕过类型检查——`status: 'pending'` 与 requirements 结构是否有类型漂移无从得知，`as any` 掩盖了潜在契约破坏 | type safety in tests：`as any` 是测试债（类型漂移在重构时静默通过） | 补齐 Task 类型的测试工厂函数（如 `makeTask()` 已在 quantum-optimizer.test.ts 存在，跨文件复用） |
| 20 | P2 | qpu-backend.test.ts:264-268（registerBackend 用例） | `registerBackend(custom)` 向**全局单例注册表**写入后无清理——全局 registry 被污染，`getBackend(custom.name)` 在后续其它测试文件的默认后端选择用例中可能读到脏状态（跨文件执行顺序依赖，node:test 默认各文件独立进程则无害，但 tsx/单进程跑法下是隐患） | 测试隔离：全局状态须在 afterEach 恢复（isolate global mutation） | registerBackend 返回反注册句柄或提供 unregisterBackend；测试 after 里清理 |
| 21 | P3 | quantum-optimizer.test.ts:103-110（Born 坍缩用例） | `for seed 1..20` 循环内每次 `assert.ok(s.welfare > 0)`，主断言 `hitTop` 是 20 次中至少 1 次命中前二——概率性通过（若单次命中概率 p≈0.15，20 次全 miss 概率 ≈0.038，即约 1/26 概率假红）；且 seed 固定所以实际是确定性，但统计功效注释缺失，读者无法判断阈值是否安全 | probabilistic test 需声明失效概率（flaky probability budget） | 注释标明理论 miss 概率上界；或改用 chi-square/分布断言（多次坍缩命中频率 ≥ 理论频率的一半）替代"至少一次" |
| 22 | P3 | quantum-optimizer.test.ts:59-101（物理层断言组） | 解析断言（cosβ/sinβ/模长）非常扎实——正面样板；但 `popcountLocal` 在用例之后才定义（函数提升救场），文件内 3 处 mulberry32 定义重复（qpu-backend:17-25、batch-vcg 两处、compound-brain:9-21） | 代码组织：helpers 上提；函数定义先于使用 | 抽 `tests/helpers/rng.ts` 统一 mulberry32 与 popcount |
| 23 | P3 | agent-manager.test.ts:56-58 | `assert.equal(a2.quantumEntanglement.includes(a1.id), true)` —— `assert.ok()` 更直接；且该文件混用 `assert.equal(x, true)` 与 `assert.ok(x)` 两种布尔断言风格 | 断言风格一致性（expect-vs-assert 混用检查项） | 统一为 assert.ok / assert.equal 语义化用法 |
| 24 | P2 | agent-manager.test.ts:66-72（负载阈值用例） | `for i<81 increaseLoad` 循环 81 次以触发 load>80 阈值——**测试与实现耦合的魔数**：阈值 80 是实现配置，测试硬编码 81 次；若阈值改为可配置，该用例应显式传阈值而非靠循环次数 | 显式依赖注入优于隐式耦合（test configuration surface） | 测试构造时显式 `new AgentManager({ overloadThreshold: 80 })`（若支持），断言阈值边界 load=80/81 两侧行为 |
| 25 | P3 | qpu-backend.test.ts:135-137（默认后端选择用例） | `assert.ok(!backend.realHardware || backend.isAvailable())`——双条件断言放行了两种状态（本地或可用真硬件），在**有 DWAVE 凭据的开发机**上测试行为与 CI 不同（环境敏感分支），覆盖不可复现 | environment-dependent test 分支应显式 pin | 测试内强制清除凭据 env（before 钩子里已有 delete，但 getBackend() 可能读构造时快照），显式断言无凭据分支 |

### 第三批补充（ma-qaoa / subspace-optimizer）

| # | 严重度 | file:line | 问题 | 前沿标准依据 | 修复建议 |
|---|---|---|---|---|---|
| 26 | P2 | ma-qaoa.test.ts:158-176（subspaceBattery 诚实基准） | 40-seed 统计断言（multiHits > layerHits、multiGap < layerGap×0.7、multiWins > layerWins）——固定 seed 集是确定性回归，但阈值 0.7/占优比是**经验拟合值**，变分优化器内部任何数值改动（如步长/精度）都可能让边际优势翻转假红；且无单实例失败信息（汇总后丢失了哪个 seed 拉了后腿） | statistical test 需可诊断性：聚合断言应输出分布而非仅均值 | 断言失败时打印逐 seed 配对表（layer gap vs multi gap）；阈值来源写入注释；考虑用配对 Wilcoxon 或至少 median 比较 |
| 27 | P3 | ma-qaoa.test.ts:88-92 | `assert.deepEqual(a, b)` 比较整个解对象（含浮点字段）——深比较对 0.0 vs -0.0 或 NaN 会意外通过/失败；同 seed 确定性断言用整对象 deepEqual 可行但脆弱（对象加字段即改语义） | determinism check 应针对关键字段 | 逐字段断言（assignment/expectation/angles）或序列化后比对 |
| 28 | P3 | ma-qaoa.test.ts:17-52（coupledProblem 生成器） | 正面样板：注释解释了“恒可行保证”（清除恒等匹配格），生成器设计诚实；但 `weights = rng()*2-0.4` 产生负权重实例的意义未注释（负权重是刻意的还是无所谓的？） | test data generation 应有 oracle 声明 | 补一句负权重意图注释（如“含负相关任务，避免全正退化为贪心友好”） |
| 29 | P2 | subspace-optimizer.test.ts:209-240（批量调度集成组） | 两处 `submitTask({...} as any)`——与发现 19 同类的类型绕过；且 makeAgent 工厂在 4 个测试文件中重复定义（quantum-optimizer/subspace-optimizer/qpu-backend/quality-regressions 各一份，字段略有差异） | shared test fixtures 上提（test data builder pattern） | 建 tests/helpers/fixtures.ts 统一 makeAgent/makeTask，类型收窄后删除全部 as any |
| 30 | P3 | subspace-optimizer.test.ts:104-134（纤维混合器用例） | 正面样板：幺正保范数 + β/−β 可逆性断言精确到 1e-12——物理不变量测试写法扎实；唯一改进是 maxDev 循环重复计算（两次取 max），可读性微瑕 | code style | 无需修复，作为物理层断言基准推广 |
| 31 | P3 | ma-qaoa.test.ts:60-77（支配性定理用例） | 正面样板：定理⟔测试双向锁定 + 展开位级等价单元验证；但 25 实例循环内断言失败只报首个失败实例，后续实例不继续诊断 | assert 循环应收集全部失败再汇总报错 | 用 violations 数组收集后统一断言（同 compound-brain DSIC 用例的写法，该文件已有先例） |

---

*审计方法：read-only 逐文件审阅；已深读 9 个文件（compound-brain 23K / batch-vcg-scheduler 21K / quality-regressions 17K / qpu-backend 14.5K / train-vs-hire-phase 14K / quantum-optimizer 13.8K / security-hardening 12K / proactive-intelligence 11K / agent-manager 3.7K），其余文件继续快速浏览中。*
