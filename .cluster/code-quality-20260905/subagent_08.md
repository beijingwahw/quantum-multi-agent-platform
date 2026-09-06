# core 优化器与平台入口审计

> 审计对象：quantum-multi-agent-platform v1.10.0（TypeScript ESM）
> 专属范围：compound-brain.ts / quantum-optimizer.ts / subspace-optimizer.ts / subspace-parallel.ts / agent-manager.ts / index.ts
> 审计时间：2026-09-05 | 审计员：subagent_08（core 优化器与平台半区）

## 模块概览

（待补：各文件职责、行数、相互依赖关系）

## 发现清单

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|--------|------|------|--------------|----------|
| 1 | P2 | compound-brain.ts:~660 (allocateBatch 尾部 `this.emit('allocated', ...)`) | 事件监听器异常会吞掉返回值：emit 在 pending 台账已写入之后执行，监听器抛错则 allocateBatch 向上抛出，调用方拿不到 assignments/taskId，但 pending 条目已永久登记——这些任务永远无法 settle，学习状态被静默歪曲（正是代码自己在 backlog 注释里警告的病根） | Node EventEmitter.emit 同步传播监听器异常；"state committed, result lost" 是典型的事务性缺陷 | emit 包 try/catch 并 logWarn，或将事件投递挪到返回值安全点/改为异步 microtask 投递 | |
| 2 | P2 | compound-brain.ts:~880 (settle) | `this.pending.delete(taskId)` 先于 agent/caps 有效性检查执行：若 `!a || !cs` 分支命中，条目已被删除却返回 false，结算记录既没入账也没法重试（再调 settle 返回 false）——静默丢结算 | 资源释放与校验顺序：先校验后提交（validate-then-mutate） | 将 delete 移到校验之后 | |
| 3 | P2 | compound-brain.ts (fitGrid + calibrate) | 每次 settle 触发全网格重拟合：51×41 网格 × 最多 2000 观测 ≈ 每次结算 4.18M 次对数求值 + 2091 元素数组分配；架构目标吞吐 10k tasks/s 时这是数量级级的 CPU 瓶颈。代码自己注释承认"经常性 CPU 税"但无增量拟合/退避策略 | 2026 前沿：流式/增量统计推断（在线 Bernoulli MLE 可增量更新似然），或至少按观测数变化>阈值才重拟合 | 增量维护每网格点对数似然（新观测只需 O(网格点) 更新），或 dirty-flag + 最小重拟合间隔 | |
| 4 | P3 | compound-brain.ts:~530 (solveWDP) | `agentIdx.get(a.spec.id) ?? 0`：静默回退到索引 0——若不变量被打破，成本会记到错误 agent 头上且无任何报错。防御性编码反模式 | 不变量违反应 fail-fast；`?? 0` 掩蔽 bug | 改为非空断言+注释，或显式 throw | |
| 5 | P3 | compound-brain.ts (allocateBatch `allocatedAt: Date.now()`、oldestPendingAgeMs) | 时钟硬编码 `Date.now()`，不可注入——测试无法确定性断言 oldestAgeMs/迟滞行为 | 可测试性：时钟注入（now: () => number 构造参数） | 构造器注入 clock，默认 Date.now | |
| 6 | P3 | compound-brain.ts (allocateBatch EWMA 更新) | 价值 EWMA 系数 0.8/0.2 硬编码，而份额 EWMA 有 shareAlpha 配置——同一文件两套口径，配置面不一致 | 配置一致性 | 提为 config.valueAlpha | |
| 7 | P3 | compound-brain.ts (settle OBS_CAP=2000) | 观测窗口上限硬编码且不可配置；长记忆场景与高吞吐场景无法各自调优 | 可配置性 | 移入 CompoundConfig | |
| 8 | P3 | compound-brain.ts (advise) | `learnable: alphaHat > 0.15 && r2 > 0.15` 魔法阈值在 calibrations() 与 advise() 两处重复 | DRY / 单一事实源 | 提取为共享函数或常量 | |
| 9 | P3 | compound-brain.ts (geometricSum) | beta∈(1e-12, 1e-8) 区间存在灾难性消去：1−exp(−x) 在 x 极小时相对误差可达 1e-4 量级；未用 expm1 | 数值稳健性：Math.expm1 是标准做法 | `(Math.expm1(-beta*T)) / (Math.expm1(-beta))` | |
| 10 | P3 | compound-brain.ts (整体) | EventEmitter 子类无 dispose/ removeAllListeners 生命周期收口；'allocated'/'settled'/'backlog_warning' 监听器若由上层长期注册而 brain 被丢弃，引用链阻止 GC | 优雅停机/资源生命周期管理 | 提供 dispose()：removeAllListeners + 可选冻结 | |
| 11 | P3 | compound-brain.ts (simulateBatch / misreport / simAlpha/simBeta) | 实验专用 API（misreport、simulateBatch、simAlpha/simBeta 配置）与生产机制同文件同类——实验关注点渗入核心 | 关注点分离：core 不携带 test double | 拆出 simulator 包装类；CompoundConfig 纯化为机制参数 | |
| 12 | P3 | compound-brain.ts (getState) | `agents: Array<Record<string, unknown>>` 弱类型公开 API，插件方拿到无类型对象 | 类型安全公开契约 | 定义 AgentPublicState 接口 | |

### quantum-optimizer.ts 发现

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|--------|------|------|--------------|----------|
| 13 | P1 | quantum-optimizer.ts (bruteForceOptimum dfs) | **耦合键不一致 → 精确最优解错误**：dfs 中查询用 `problem.couplings.get(lo * (m*n) + hi)`，但建键方 couplingKey 与 computeEnergies/welfareOf 解码用 `q * nqubits + q2`，nqubits = m·n，数值相同——但注意 dfs 的 `lo/hi` 计算用的是 `t2*n + a2` 与 `t*n + a` 的 min/max，编码一致。**真正的问题**：当 `n=1`（单 agent）时 lo=hi=同 qubit，`addQ` 会把它并入线性 c[q]；而 dfs 用 `lo*(m*n)+hi` 查询与 computeEnergies 的 `q1<q2` 过滤都排除 q1==q2——**同一耦合在 bruteForce/其他路径被丢弃，而 toIsing 却通过 addQ(q1===q2) 转成线性项保留**。三条路径对同一输入给出不同能量语义 | 同一 QUBO 编码必须在所有求解路径上语义一致（含对角项处理），否则“精确参照”不可信 | 统一：要么在 AssignmentProblem 构造处禁止 q1==q2 的键，要么 computeEnergies/welfareOf/bruteForce 全部把对角耦合并入线性福利 |
| 14 | P1 | quantum-optimizer.ts (computeEnergies) | **O(2^nq · m·n) 能量预计算在每次求解时重算**，且 QAOA 角度优化每次坐标下降评估都要 runQaoaCircuit 重建态并全量演化：一次求解 = 评估次数 × (O(2^nq·nq) 演化 + O(2^nq) 概率)。在 qubitCap 接近 FULLSPACE_QUBIT_LIMIT (约 20+ qubits, 2^20=1M 维) 时单次评估即百万级浮点运算，几十次评估即秒级。**没有缓存 energiesInfo**（同一 problem 重复求解时全量重算） | QAOA 变分循环的评估次数应可控（evaluation budget）并暴露给调用方；态矢量模拟的常量因子优化（如稀疏/分块）是 2026 前沿方向 | 为 AssignmentProblem 引入 memoized energies（WeakMap 缓存）；evaluate budget 显式化 |
| 15 | P2 | quantum-optimizer.ts (annealSolve expectation 计算) | 末态期望 `for k: expectation += probs[k]*normalized[k]` 手写循环——与 QAOA 路径的 expectationOf 共享函数不一致；两处 scale 还原逻辑分散（qaoaSolve 用 `meanExpectation*span+min`，annealSolve 用 `(expectation/scale)*span+min`——后者多除一次 scale 是因为 normalized 的 scale 参数不同，但读者难以确认两处等价） | 期望计算应单一实现；QAOA 路径 scale=1 所以乘 span，退火路径 scale=2·nq 需要先除 scale——注释虽有但易碎 | 抽取 `denormalizeExpectation(value, scale, span, min)` 单一函数，两路径共用 |
| 16 | P2 | quantum-optimizer.ts (toIsing) | `if (problem.ineligible[t][a]) c[q] += 2 * penaltyOneHot`——**Ising 导出对不合格格子的罚是 2λ(one-hot)，但 computeEnergies 中 ineligible 只通过资格掩码在 decode/isValid 判定，不进入能量**。导出模型与内置能量模型不一致：真 QPU 上 ineligible 罚不足（一个任务只配 ineligible agent 时，导出能量反而可能比留空更“优”——漏斗/悬空格惩罚语义漂移） | 跨后端（模拟/真 QPU）能量语义必须一致，否则跨后端对比实验不可信 | computeEnergies 中对 ineligible 格子显式加罚（或在文档中明确导出模型的额外罚语义并统一） |
| 17 | P2 | quantum-optimizer.ts (runAnnealingCircuit) | 退火演化 `applyMixer((1-s)*dt)` + `applyCostPhase(s*dt)` 是一阶 Trotter，且 `dt = tau/steps` 固定步长；没有能量谱收敛判据、没有局部误差估计，收敛质量全靠默认 tau=120/steps=1200 经验值。**steps=150（子空间默认）时步长 dt=tau/150=0.13，横场强度 (1-s)·dt 与代价强度 s·dt 在 s=0.5 处各 0.065——Trotter 误差累积无界增长警告缺失** | 续热路径应有谱范数/收敛判据与可配置的 error budget；一阶 Trotter 误差 O(dt²) 需在文档中量化 | 引入能量守恒偏差监控或二阶 Trotter 选项；暴露误差指标 |
| 18 | P2 | quantum-optimizer.ts (selectSolution) | **born 模式 chosenState 可能为 0**（基态 0 采样中）——代码用 `chosenState = -1; if (mode==='born') chosenState = sampleIndexByProbabilities(...)`，sampleIndex 若返回 0 是合法值，随后 `if (chosenState < 0)` 兜底不会触发，没问题。**但 born 模式没有 shots 次数下限**：单次采样在高维空间中大概率落在非法解上，repaired=true 概率极高——born 模式的实用性依赖 validMass 接近 1，而这个前提没有任何运行时检查或告警 | 随机坍缩模式应监控 validMass 并在低质量时告警/降级 | born 模式下若 validMass < 阈值（如 0.5）logWarn 或自动回退 argmax-valid |
| 19 | P3 | quantum-optimizer.ts (qaoaSolve/annealSolve) | 同步阻塞 API：全部计算在调用线程执行，无 AbortSignal / 超时支持；坐标下降 restarts×rounds 次评估在大问题上无法取消 | 2026 前沿：长计算必须可取消（AbortController 集成是 Node/TS 生态标准） | 求解入口接受可选 AbortSignal，评估循环检查 signal.aborted |
| 20 | P3 | quantum-worker.ts 引用 (qaoaSolve 内 `restarts` 默认 2) | restarts=2 的随机重启坐标下降，每次重启独立 rng——但 `mulberry32(seed)` 只创建一次，多次 restart 之间 rng 状态共享（这本身可复现），**但 restart 间无 warm-start（重启完全从随机点开始）**，浪费 layer 优化已找到的好角度 | 变分优化 warm-start 与重启策略（INTERP/FOURIER 等角度初始化技巧是 QAOA 前沿） | 重启时以当前最优角为中心的小扰动，而非完全随机 |
| 21 | P3 | quantum-optimizer.ts (decodeAssignment) | `if (state & (1 << (t*n+a)))`——当 nqubits ≥ 31 时 `1 << 30` 溢出为负数（JS 位运算 32 位有符号），t*n+a ≥ 31 的位掩码计算错误。FULLSPACE_QUBIT_LIMIT 在 constants 中定义，需确认其是否 ≤ 30；若 cap 是 20 则安全，但 decode/computeEnergies 的位运算对 nqubits>30 没有独立防线（computeEnergies 有 nqubits > FULLSPACE_QUBIT_LIMIT throw，需确认常量值） | JS 位运算的 32 位限制是经典陷阱；防御需在类型/运行时双重设防 | 显式断言 nqubits ≤ 30，或用 `> 0` 的 Math.pow(2, q) 替代位移 |
| 22 | P3 | quantum-optimizer.ts (isValidAssignment) | 容量校验用 `used.has(a)`——**每个 agent 容量固定为 1**，而 AssignmentProblem 没有任何容量字段；compound-brain 侧 MinCostFlow 支持 capacity>1。两端能力不对齐且无文档说明 | 接口契约一致性 | AssignmentProblem 增加 capacities?: number[] 字段或文档说明容量恒为 1 的设计边界 |

### compound-brain.ts 优点补充

- EdgeMemo 记忆表设计精准：明确生命周期约束（严禁跨 allocateBatch），并在注释中论证 DSIC 位级不变性——这是机制正确性与性能优化的罕见结合
- fitGrid 的 β 预计算列（exp 调用缩减 51 倍）体现对热路径的真实优化意识
- 迟滞告警（backlog warning）设计成熟：进入/退出双阈值 + 在 allocate 与 settle 尾部双侧评估，避免告警风暴

### subspace-optimizer.ts 发现

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|--------|------|------|--------------|----------|
| 23 | P1 | subspace-optimizer.ts (collapseSubspace shots-best) | `chosen = sampleBestIndexByShots(...); if (chosen < 0) chosen = 0;`——shots 全部采到 0 概率态时回退 **chosen=0（第 0 号基态）而非概率最大基态**。第 0 号基态是 DFS 字典序最小解（任务 0 → agent 0...），没有任何“最优”语义；与之对照，全空间引擎 selectSolution 的同场景回退是 argmax-valid（概率最大合法态）。两引擎同语义场景不同回退策略，且子空间回退质量明显更差 | 回退策略应统一且取后验最优（argmax）；全空间引擎已示范正确做法 | `if (chosen < 0)` 后走 argmax 循环（与 else 分支同样的扫描） |
| 24 | P1 | subspace-optimizer.ts (annealSolveSubspace rawExpectation) | **能量还原双重除法错误候选**：`rawExpectation = (expectation / (2*spectralWidth)) * (rawMax-rawMin) + rawMin`，而 QAOA 子空间路径是 `meanExpectation * (rawMax-rawMin) + rawMin`（无除 scale）。两处不一致的原因是 anneal 的 energies 用了 scale=2·spectralWidth 归一化——但 normalizedEnergiesOf(info.energies, min, max, scale) 若定义为“归一化到 [0,scale]”，则还原需除 scale， anneal 写法对；QAOA scale=1 不除也对。**问题在于两处公式不同且无共享函数**，与全空间 #15 同源——三个文件里同一还原逻辑写了三遍，每遍写法都不同，极易在改动时引入不一致 | 同一物理量（归一化能量的还原）必须单一实现 | 抽取 `denormalizeExpectation()` 共享函数，四处（全空间×2 + 子空间×2）统一调用 |
| 25 | P2 | subspace-optimizer.ts (buildSubspaceModel) | **构建成本无预算控制且无进度反馈**：dim=2^21 时 assignmentAt 4·2^21·m 字节 + energies 16MB + keys 16MB + 每混合器 order/runs 各 16MB —— m=8,n=10 时 mixers=8 组，仅 order/runs 即 8×(8+8)MB=128MB，加上 SAB 双份（并行构建临时）峰值可达数百 MB。dimensionCap 只限维度不控内存，且同步阻塞构建不可取消（与 #19 同病） | 大内存分配应有预算/进度回调；cap 应换算为内存预算而非裸维度 | dimensionCap 改为 memoryBudgetBytes，内部按 m、mixer 组数换算 |
| 26 | P2 | subspace-optimizer.ts (allocI32/allocBytes/allocF64) | SharedArrayBuffer 可用性探测每次调用都重新读 `process.env.QUANTUM_NO_SAB`——热路径（构建、演化）中每次分配都有 env 查询开销；且 SAB 探测结果不可注入，测试无法模拟无 SAB 环境（QUANTUM_NO_SAB 是全局副作用开关，并行测试相互污染） | 环境探测应模块级一次判定 + 依赖注入 | 模块级 `const SAB_AVAILABLE = ...` + 构建选项注入 |
| 27 | P2 | subspace-optimizer.ts (collapseSubspace born 模式) | born 模式 `chosen = sampleIndexByProbabilities(probs, rng)` 后直接 `assignmentAt[chosen*m+t]`——**子空间中所有基态合法所以无 repair 问题，但 born 采样大概率落到低福利解**（均匀初态+短退火时概率质量分散），作为坍缩模式对外暴露时无质量护栏（与 #18 同源，但子空间里连 validMass 指标都没有暴露） | 坍缩模式质量指标应透明 | SubspaceSolution 增加 expectation/optimalityRatio 已有——建议增加 collapseMode 诊断字段 |
| 28 | P2 | subspace-optimizer.ts (serialAnnealEvolve) | 退火谱宽估计 `spectralWidth = m·max(1, n−m)`（n>m）或 `m(m−1)/2`（n==m）——是**上界估计而非实际谱半径**（fiber 大小 k 因 ineligible 掩码可能远小于 n−m）。上界偏大 → 能量归一化过重 → 代价项相对横场过弱 → 退火不充分。没有用实际 fiber 结构估计谱宽 | 退火调度应基于实际算符谱（或至少实测 fiber 直方图） | 用 buildFiberGroupKernel 已知 runs 统计实际 k 分布，取 Σ(k_max−1) |
| 29 | P3 | subspace-optimizer.ts (buildSubspaceModel console.error 调试) | `process.env.QUANTUM_PARALLEL_DEBUG` 三处 console.error 直写 stderr，绕过统一 logger（compound-brain 用 logWarn）——日志口径不一致且 console.error 在库代码中不可接受 | 统一日志门面 | 改用 utils/logger 的 logDebug |
| 30 | P3 | subspace-optimizer.ts (collapseSubspace top-K 插入) | 手写插入排序 top-K 槽：`top.splice(i, 0, {s, p})` + `top.pop()`——splice 在 K 很小时代价可忽略，但代码复杂度高且与全空间引擎的 sort-slice 写法完全不同，正确性靠注释承诺（“与 V8 稳定排序语义一致”）——两引擎候选择取逻辑双实现，无共享测试锚定等价性 | 同一语义双实现必须等价性测试锁定 | 提取共享 topKByProbability() 并加属性测试 |
| 31 | P3 | subspace-optimizer.ts (buildSubspaceModel dfs) | DFS 递归深度 = m（任务数）——m 极大时（如 100 任务×100 agent，P(100,100) 超 cap 会提前 return null，但 cap 检查在**叶子处**：`if (dimCount >= cap) return false`——这意味着 cap 只在叶子计数时触发，若前缀部分合法解很多，递归仍可能深入很多层才触发中止。实际中止靠 `dfs(t+1) 返回 false` 逐层短路，逻辑正确但**cap 触发前已分配 assignmentAt(capacity·m) 全量内存**（capacity = min(P(n,m), cap) 预算是精确的，内存浪费有限）——仅作可读性备注 | 递归 + 预分配模式的内存预算应在入口校验 | 无需修复，备注可读性 |
| 32 | P3 | subspace-optimizer.ts (整体) | SubspaceSolution 与 QuantumSolution 两套解类型字段大量重叠（engine/assignment/welfare/energy/probability/expectation/layers/angles/evaluations/candidates），但无共同基接口或判别联合——上层（index.ts 门面）需要分别处理两套类型 | 判别联合/共享接口是 TS 前沿标准 | 提取 QuantumSolutionBase 接口，两解类型 extends |

### subspace-parallel.ts 发现

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|--------|------|------|--------------|----------|
| 33 | P1 | subspace-parallel.ts (workerSource/buildWorkerSource) | **Function.toString 序列化注入 Worker 是脆弱的自制打包器**：esbuild 注入 `__name` 辅助的兼容补丁本身就证明该方案对打包器改写敏感——任何 future 打包器（swc/bun build/terser mangle）都可能再次破坏，且错误只能在运行时以 10s 握手超时+回退的方式显现。函数闭包变量引用（如 kernel 内若引用模块级常量）会在 Worker 里 ReferenceError——当前 kernel 恰好自包含才成立，无任何机制保证 | 代码序列化跨打包器不可维护；标准做法是独立 worker 入口文件或 data URL + bundled worker chunk（esbuild/webpack 均有原生 worker 支持） | 将 fiber-kernel 纯函数提为独立文件，worker 以 `new Worker(new URL('./fiber-worker.cjs', import.meta.url))` 引用——打包器原生支持且类型可检查 |
| 34 | P1 | subspace-parallel.ts (parallelAnnealEvolve dispatch) | **主线程同步 Atomics.wait 长阻塞是事件循环窒息点**：steps=150、每步 mixer+cost 共 m+1 次 dispatch，每次 dispatch 主线程自旋等待（50ms 超时轮询）——演化期间主线程完全冻结，HTTP/WS 心跳、GC、immediate 队列全部停摆。stepBudget=max(2000, 30000/steps) ms，最坏情况单 dispatch 20s（steps<15 时），总阻塞可达分钟级。作为库被 ws 平台主循环调用时，这就是全平台假死 | 2026 前沿：CPU 密集任务必须移出主事件循环（worker 化主控或分片 yield），阻塞主线程同步原语只允许在专用线程 | 主控循环也放入 worker（主线程只 await Promise）；或分步异步化（每 dispatch 间 await setImmediate） |
| 35 | P2 | subspace-parallel.ts (terminateAll + finally setTimeout) | **Worker 泄漏窗口与僵尸风险**：正常路径靠 Worker 自己 `process.exit(0)` 退出，finally 里 setTimeout(terminateAll, 1000).unref() 兜底——但 unref 的定时器在进程退出竞争时可能不触发，而 terminate() 异步返回的 Promise 被 .catch(() => undefined) 吞掉。若 Worker 因 POISON 卡在 Atomics.wait，process.exit(0) 永不到达，只能等 1s 兜底 terminate；dispatch 失败路径 catch{} 后立即 return null，Worker 若还在计算共享内存（读写 re/im），而主线程已回退串行在**同一 model 的 energies 上重建**——此时旧 Worker 仍在写另一套 SAB，不冲突但内存峰值翻倍 | 资源生命周期确定性释放；terminate 应 await | terminateAll 改 async 并在返回前 await 全部 terminate；失败路径先同步 terminate 再 return |
| 36 | P2 | subspace-parallel.ts (workerCount) | `process.env.QUANTUM_WORKERS` 每次求解都重读 env——运行中改 env 可让同一进程内前后调用用不同 W，且 cpus() 每次 cold call（Node 内部有缓存但语义上未保证）；与 #26 同源：运行时配置应一次性解析可注入 | 配置解析应启动时一次 + 依赖注入 | 模块初始化时解析为常量，测试可 override |
| 37 | P2 | subspace-parallel.ts (dispatch 超时后共享内存状态未隔离) | dispatch 超时返回 false → throw → catch → terminateAll + return null——但**已完成的 Worker 可能还在写 re/im**（terminate 是异步的）：串行回退路径重新计算自己的数组不受影响，但若上层未来把并行结果 SAB 复用（如缓存），后果是静默数据竞争。当前实现恰好安全是因为每次调用新建全部 SAB，安全性靠“每次新建”这个隐式约定，无断言防护 | 共享内存所有权转移必须显式 | dispatch 失败时先把 OP=3 写入 header 唤醒 Worker 自杀，再 terminate |
| 38 | P3 | subspace-parallel.ts (header 布局魔法数) | OP/GROUP/SEQ/DONE/READY/WAITING/POISON 与 F64_BYTE_OFFSET=32 的布局约束（i32 槽 8+ 与 Float64 不重叠）仅靠注释维持，还有裸 `Atomics.add(H, 7, 1)`（槽 7 是 lens 计数但未命名常量）——布局改动无编译期防护 | 共享内存布局应有单一常量表 + 偏移断言 | 定义 const LENS_DONE = 7 并集中布局常量；加 offset 重叠断言 |
| 39 | P3 | subspace-parallel.ts (poisoned 闭包标志 + eslint-disable) | 两处 `eslint-disable @typescript-eslint/no-unnecessary-condition` 承认了类型流分析与实际语义的脱节——poisoned 的跨闭包写读正确但类型系统表达不了，靠 disable 注释压制而非类型化（如用 getter 函数或显式 interface { get(): boolean }） | 与其 disable 不如类型化建模 | poisoned 改为 `{ value: boolean } 装箱或 volatile 读取函数，消除 disable |
| 40 | P3 | subspace-parallel.ts (构建路径 W 与演化路径 W 不一致) | parallelBuildFiberGroups 的 W = max(2, min(cpus-1, MAX, G))（不读 QUANTUM_WORKERS、不受 dim/fibers 下限），parallelAnnealEvolve 的 W 经 workerCount()（读 env、受 dim/fibers 约束）——同文件内两套 Worker 数决策逻辑，行为不一致且均无单测锚定 | 同一资源决策应统一策略函数 | 提取 resolveWorkerCount(context) 共用 |

### subspace-parallel.ts 优点补充

- 确定性并行设计（单线程单纤维 + 同一内核源码 + 位级一致）是同类项目的罕见严谨：多数并行实现只保证统计一致
- 入栏计数（WAITING）消除 seq 基线捕获竞态的注释、F64 视图偏移踩坑记录——并发设计文档化极好
- 结构性失败负缓存（parallelStructurallyBroken）避免重复支付 10s 握手超时——降级路径的成熟工程判断
- 失败即回退串行、功能永不中断的降级哲学贯彻到位

### agent-manager.ts 发现

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|--------|------|------|--------------|----------|
| 41 | P2 | agent-manager.ts (registerAgent + setupEventHandlers 联动) | registerAgent 在同步代码里逐个 createEntanglement——若 entanglementTargets 里含不存在的 id（如注册顺序依赖），createEntanglement 静默返回 false（agent1/agent2 查不到），**没有任何警告**。平台入口 index.ts 的 setupEventHandlers 里 scheduler.registerAgent(agent) 事件链中若抛错会向上传播，而 index 侧对 agent_registered 监听器无 try/catch（与 handleConsoleCommand 的防护不一致）——事件监听器异常会沿 emit 向上炸到注册方 | 事件链异常隔离；静默失败需可观测 | createEntanglement 失败时 logWarn；index 侧 setupEventHandlers 各监听器包 try/catch |
| 42 | P2 | agent-manager.ts (increaseLoad / decreaseLoad 状态机) | 负载与状态耦合但不对称：increaseLoad 超 80 自动转 overloaded，但 decreaseLoad 降到 ≤80 时 `agent.load <= AGENT_OVERLOAD_THRESHOLD && agent.state === 'overloaded'` → 强制 idle——**会粗暴覆盖 busy 状态**：一个 load 从 85 降到 78 但仍在执行任务的 agent（state=busy）不受影响（只处理 overloaded），但 load=85 且 state=busy 的 agent 不会被 increaseLoad 转 overloaded（只在 increase 时检查）——状态机有三处入口（setAgentState/increase/decrease/heartbeat/updateAgent）各自维护不变量，且 updateAgent 的 Object.assign 可直接写入任意 state/load 而绕过全部不变量维护 | 状态不变量应单一入口维护 | 收敛为内部 setState(agent, state) 单点；updateAgent 拒绝 state/load 字段或走同一验证 |
| 43 | P2 | agent-manager.ts (heartbeat 恢复逻辑) | `heartbeat()` 恢复 offline 时直接改状态，但不 emit 任何事件也不广播——远端监控端无法感知 agent 复活；与 setAgentState（emit agent_state_changed）不一致 | 状态变更可观测性一致性 | heartbeat 内部改调 setAgentState |
| 44 | P3 | agent-manager.ts (registerAgent 重名不查重) | name 不唯一约束：两个同名 agent 可注册，日志/快照里无法区分——id 是唯一键但可观测性退化 | 可观测性 | logWarn 重名或加 name 唯一性可选项 |
| 45 | P3 | agent-manager.ts (checkSystemHealth staleThresholdMs) | 失联阈值 max(30000, 3×heartbeatInterval) 只跟配置走，但进程内 agent 的心跳由 startHeartbeat 定时刷新——**若事件循环被长时间阻塞（如 #34 的同步退火），定时器不准点，agent 会被误判 offline**；健康检查与事件循环健康度未解耦 | 监控指标不应依赖被监控线程自身时钟 | 健康检查增加事件循环 lag 指标（monitorEventLoopDelay）并文档说明限制 |
| 46 | P3 | agent-manager.ts (removeEntanglements 对端清理分支) | `if (entanglement.agentId1 === agentId)` 分支只清 agent2，else 只清 agent1——逻辑正确，但两分支代码重复度高且依赖对 agentId1/agentId2 位置的判断，若未来加多 agent 纠缠（N-way）会踩坑；另外 getEntanglements(agentId) 返回顺序依赖 Set 插入序 == 创建序的隐含假设，注释已说明但没有测试锚定 | 隐含顺序约定需测试锁定 | 提取 clearPeer(entanglement, removedId) 辅助函数 |

### index.ts（平台入口/门面）发现

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|--------|------|------|--------------|----------|
| 47 | P1 | index.ts (stop() 不清 setupEventHandlers 的监听器) | stop() 清理了定时器/总线/管理器，但 **setupEventHandlers 注册的全部跨组件监听器不解除**：agentManager.on('agent_registered') 等约 8 个监听器在 stop 后仍持有 scheduler/bus 引用。若平台实例被丢弃而组件未销毁，事件链造成内存滞留；更严重的是**平台不支持重启复用**：stop() 后再 start()，quantumBus 重新 start，但旧监听器仍指向同一 bus（还好组件是同实例，只是 isRunning 门面状态切换）——而 QuantumMultiAgentPlatform extends EventEmitter 自身无 shutdown/dispose 契约，监听器泄漏模式与 compound-brain #10 同病 | 生命周期完整的可重启/可释放设计 | 提供 dispose()：removeAllListeners + 各组件 dispose；或监听器用 AbortController signal 管理 |
| 48 | P2 | index.ts (start() 部分失败回滚不彻底) | 回滚只处理 quantumBus：若 dshIntegration.initialize() 抛错（总线已 start、DSH 半初始化），回滚仅 shutdown bus——dshIntegration 内部状态未回滚、已注册的系统 agents 未清理、metricsInterval 未创建（还好）；registerSystemAgents 在 DSH 之后，若 registerSystemAgents 抛错（如 scheduler.registerAgent 失败），DSH 已初始化不回滚 | 前沿标准：初始化链条需逆序回滚（rollback stack 模式） | 用回滚栈记录已成功步骤，失败时逆序 undo |
| 49 | P2 | index.ts (submit_task 命令的 type 硬编码 'console') | handleConsoleCommand 的 submit_task 硬编码 type: 'console'、requirements: []，而 submitTask 公开 API 接受完整 TaskSpec——远程控制台能力面远窄于 SDK 面，且 add_agent 的 type 只能 'custom'——命令协议与平台能力不对齐且无版本化 | 远程命令协议应与核心 API 同构并有版本化/能力协商 | 命令 payload 直通校验后的完整 TaskSpec；协议加版本字段 |
| 50 | P2 | index.ts (CLI 入口信号处理不 await 异步停止) | `process.on('SIGINT', () => { platform.stop(); })`——stop 是同步的尚可；但 platform.start().catch 里只设 exitCode=1 不 process.exit——若 start 失败后事件循环还有残余句柄（WS 未关严、DSH 半开），进程会挂住直到手动杀；另外 SIGINT 后 stop() 若抛错（如 scheduler.shutdown 内部异常）会变成 uncaughtException 直接崩——没有 try/catch | 前沿标准：信号处理内同步异常必须捕获；退出路径需强制超时兑底 | shutdown 包 try/catch + 定时强杀兑底（如 5s 后 process.exit(1)）；start 失败后显式 process.exit(1) |
| 51 | P3 | index.ts (deepMerge 泛型签名弱) | `(result as Record<string, unknown>)[key] = ...` + `return result as T`——两处 as 断言+泛型擦除；DeepPartial<T> 定义对数组元素类型不生效（TaskRequirement[] 会保持原样，用户传错误数组元素类型不报错）；deepMerge 递归无深度限制（恶意深嵌套 JSON 可栈溢出，虽有 DANGEROUS_KEYS 防原型污染但无深度防御） | 类型安全；递归合并需深度上限 | 加 MAX_MERGE_DEPTH；DeepPartial 对数组保留 readonly 校验 |
| 52 | P3 | index.ts (导出面过宽，门面职责稀释) | 单文件导出约 60+ 符号：直接重导出 quantum-optimizer/subspace/growth/batch-vcg/compound-brain/proactive-intelligence/qpu 全部公开 API——门面层变成纯重导出聚合器，没有按使用场景分桶（如 /scheduler、/mechanism、/qpu 子路径导出），消费者无法 tree-shake（ESM 重导出理论上可 shake，但 DeepPartial 与 CLI 副作用块使整个 index 必须加载）| 2026 前沿：package exports 子路径拆分是 ESM 标准实践 | package.json exports 增加 ./mechanism、./qpu 等子路径；index 只留平台主类 |
| 53 | P3 | index.ts (CLI 副作用块在库入口) | `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)` CLI 启动逻辑内嵌在库入口文件——库被任何工具直接 import 时也会执行检测逻辑（虽 argv 检测通常不命中，但 import.meta.url 与 argv 比较在某些打包器/ESM loader 下会误触发）；bin 入口应独立文件 | 库/CLI 分离是包设计基本功 | 拆出 bin/quantum-platform.ts，package.json bin 指向 |
| 54 | P3 | index.ts (getSystemMetrics 同步聚合无采样一致性) | getSystemMetrics 把 scheduler/agents/bus/dsh/health 五个组件指标在同一 tick 内顺序拉取——各组件快照时点不一致（无事务性快照），高并发下同一报告内数字可能互相矛盾（如 scheduler 报 5 个 running task 而 agents 报全部 idle） | 指标聚合的事务性/一致性截面前沿做法 | 各组件暴露带时间戳快照，聚合时标注采集窗口 |

### constants.ts 佐证

- #21 风险确认：FULLSPACE_QUBIT_LIMIT = 30，恰好卡在 `1 << 30` 安全边界（JS 位运算在 1<<31 变负），nqubits=30 时 `1 << 29` 等位移仍是最大正数——**边界安全但零余量**，任何人在 constants.ts 放宽到 31 即静默出错，无运行时断言拦截（好在注释有警告）
- 退化场景：BRUTE_FORCE_QUBIT_LIMIT=16 但 computeEnergies 无对应检查（bruteForceOptimum 本身也无 cap 检查——它不建态矢量故安全，但 2^16 以上任务数的 DFS 组合爆炸无防护，调用方自知）

### subspace-optimizer.ts 优点补充

- 纤维混合闭式解（K_k = J−I 的指数闭式）是真正的数学功底：无 Trotter 误差、O(dim) 精确施加，比全空间逐位旋转更优雅
- 字典序键 + 二分查找取代 Map：对 dim 百万级的构建性能优化有实证（注释给出实测数据）
- top-K 线性选择从 O(dim·log dim) 排序降到 O(dim·K)，注释明确与 V8 稳定排序的逐位等价性——性能优化带正确性论证

## 模块级优点

（待补）

## Top3 升级建议

（待补）
