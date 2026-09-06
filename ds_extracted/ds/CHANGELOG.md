# Changelog

本仓库遵循语义化版本。每轮变更前先全量回归（245 用例含位级数值基准），
覆盖率与死代码门禁随质量收益同步棘轮上调。

## v1.10.0 — ma-QAOA 构造性支配 + 基准诚实校正（2026-09）

### ma-QAOA：逐算子变分角（Chandarana et al. 2020 落地）

`angleMode: 'multi'`（默认 'layer' 位级不变）：每个混合算子持有独立
变分角——全空间逐量子比特（`applyMixerAngles`）、子空间逐纤维组
（移动/换位混合器），代价角仍逐层。与 `cvarAlpha` 正交可组合。

- **支配性是构造性定理**：multi 以 layer 最优角的展开为种子（展开态与
  layer 电路末态逐位相同——有单元测试钉住该位级等价），种子化坐标下降
  只接受严格改进 ⇒ 同一变分目标下 ⟨E⟩_ma ≤ ⟨E⟩_layer 恒成立。定理在
  目标层面逐实例断言（`tests/ma-qaoa.test.ts`）。
- 新增 `optimizeAnglesByCoordinateDescentSeeded`（任意角度布局 + 逐角
  上界 + 种子）；原坐标下降函数逐字未动。
- **实测（诚实结论）**：子空间变分 regime 为真实增益区——6×6 命中率
  17→29/40（p=1）、27→35/40（p=2），平均差距约减半，配对 19:5 / 13:5；
  全空间坍缩读数已饱和，welfare 增益边际（配对近全平）——不宣称。
- 12 项测试：定理、展开位级等价、默认位级一致、确定性、角度布局、
  非法值拒绝、子空间支配与合法、CVaR 组合、全空间不劣性、子空间增益。

### 基准诚实校正（影响 v1.9 的数字）

复审发现 CVaR/ma 基准的随机实例生成器未保证可行域：约 1% 实例无可行
分配，此时 `bruteForceOptimum` 的返回值 0 是占位符而非上界，系统性
夸大"差距改善"。生成器已改为清除恒等匹配保证可行，全部公开数字重测：

- CVaR p=1 增益修正为温和而稳定：3×3 0.4490→0.4309（配对 17:10）、
  3×4 0.4202→0.4169（配对 41:32）——方向不变、幅度下修；
- 文档（QUANTUM-SCHEDULING 七¾）附校正说明，历史不抹除。

测试 269 → 281。

## v1.9.0 — CVaR-QAOA + 零依赖属性测试（2026-09）

### CVaR-QAOA：分位数变分目标（Barkoutsos et al. 2020 落地）

QAOA 角度优化的目标函数从全场能量均值 ⟨E⟩ 可切换为**最优 α 分位上的
条件期望 CVaR_α**（`cvarAlpha ∈ (0,1]`，默认 1 = 均值，位级不变）：

- **精确态矢量 CVaR**（`solver-common.ts`）：能量升序预排序跨全部评估
  复用，沿序累计概率至 α，头部加权均值 ÷ α——无采样噪声（模拟器形态
  对原文献 shot 估计的结构性优势）；
- 全空间 `qaoaSolve` 与子空间 `qaoaSolveSubspace` 均接入；调度器经
  `scheduling.quantum.cvarAlpha` 透传；非法 α 在公共解析入口拒绝；
- **坍缩与报告口径不变**：CVaR 只改变选角，末态按真实 Born 分布坍缩，
  `expectation` 恒为真实 ⟨E⟩；
- **诚实基准**（固定种子，配对统计，`tests/cvar-qaoa.test.ts` 钉住）：
  p=1 低深度 regime 稳定增益（平均相对差距 0.3948→0.3819 / 0.4082→0.3617，
  配对 16:10 / 28:18）；p≥2 本引擎已饱和、无增益——不宣称；
- CVaR 数学性质（手算例、α 单调性、有序/便捷路径一致）+ 默认 α=1
  位级等价 + α<1 确定性，共 10 项测试。

### 零依赖属性测试（property-based，`tests/property-based.test.ts`）

以仓内种子化 PRNG 生成随机实例做不变量对盲（不引入 fast-check，生成
确定性可复现）：MinCostFlow 自由处置变体 **200 随机实例对穷举全部部分
分配的最大福利逐分对盲** + 确定性 + 解结构合法性（容量/任务出度）。

测试 256 → 269。

## v1.8.1 — 台账可观测 + 标注审计（2026-09）

两项收尾（上轮记录的已知未做项）：

### compound-brain 在途台账积压可观测性

`pending` 台账是学习系统唯一可能无界增长的结构（其余全部有界：观测 FIFO
封顶、计数器 O(1)）：结算方晚结算/漏结算会让条目永久滞留，且这些任务的
资本/履历永不前进——此前完全静默。现在：

- 台账条目携带 `allocatedAt`（纯观测时钟，绝不进入定价/分配/结算数值）；
- `getState()` 新增 `pendingBacklog: { count, oldestAgeMs }`；
- 越过 `pendingBacklogWarnAt`（新配置项，默认 1000，0 禁用）时发出
  `backlog_warning` 事件 + 警告日志，带迟滞（回落到半阈值以下才重新
  武装）；迟滞释放判定在 allocateBatch 与 settle 尾部各评估一次——
  只挂 allocate 侧时释放条件永远无法经"结算下降"路径满足（测试抓出
  并修正的设计缺陷）；
- 数值零影响由测试钉住：同 seed 下开启/关闭观测路径的分配、支付、
  福利逐位一致。

### llm-learning-curve 标注审计（不改标注）

标注的类别不平衡与 R3 判定争议是**有意保留**的现状（改标注 = 改变已
发表实验的结论，属实验所有者的决策）。交付的是机械可见性：

- `ASPECT_KEYWORDS`：R3"只要被提到即计入"的声明式词表，争议词
  （保修 / App）显式 `disputed` 标记——词表即裁决入口；
- `labelAudit()`：边际分布、多数类朴素基线、R3 一致性（按优先级机械
  推导 vs 标注）、词法静默工单、争议词影响，一次计算全量可见；
- 审计结论（快照测试钉住）：44 张工单在**严格读法**下与 R3 完全一致
  （唯一静默 #42）；分歧精确收敛于两个争议词 × 两张工单——"保修"计入
  则 #32 客服→质量、"App"计入则 #11 客服→功能（#14/#16 同含争议词但
  不受影响）；sentiment 32/10/2 与 urgent 9/44 的不平衡抬高 exact-match
  朴素基线至 72.7% / 79.5%（解读 q̂0 的必要背景）；
- 7 项快照测试：任何人改标注或词表都必须有意识地更新快照——
  这就是"所有者显式裁决"的机制。

测试 245 → 256（+4 台账观测 / +7 标注审计）。

## v1.8.0 — 深层遍历重构 + 严格度跃迁（2026-09）

### 安全

- **web-console 鉴权兼容**：控制台新增令牌输入（平台配置 `communication.authToken`
  时必填），authenticate 帧携带 token——修复鉴权模式下控制台 4001 断连死循环。
- **web-console XSS**：agent/task 名称等远程可控字符串经 `escapeHtml` 构造性转义，
  不再直插 innerHTML；初始徽标如实显示「离线演示模式」；性能图改为真实
  量子效率滚动历史（替代正弦噪声示意）。
- **`PlatformConfig.communication`** 补齐 `host` / `maxConnections` 类型声明
  （此前为真实生效但未声明的配置面）。
- 门面导出 `configureCommandPolicy` / `resetCommandPolicy` / `getCommandPolicy` /
  `execute_command_argv`：宿主扩展命令白名单不再需要深路径导入。

### 正确性与健壮性（src）

- `complete_task` 控制台命令缺 `taskId` 显式报 `ConfigurationError`（与
  `submit_task` 校验同口径），不再静默吞掉。
- `platform.start()` 部分失败回滚：总线已监听时先 `shutdown()` 再抛出，
  不留「未运行的平台仍在接受连接」的窗口。
- 错误分类法补全：subspace-parallel 全部 9 处内部控制流 `Error` 统一为
  `QuantumEngineError`（src 内 throw 一律 PlatformError 子类，src 全仓达标）。

### 性能重构（位级不变，全部由既有数值基准守护）

- **compound-brain 逐批边记忆表**：q̂(agent,c,k) / g(agent,c) / 能力具备数
  与报价无关（DSIC 前提），完整求解与 (1+赢家数) 次 Clarke pivot 重解
  复用同一批估值——消除 O(重解×任务×agent×历史×混合分量) 的重复计算。
- **batch-vcg `totalPullsOf` 缓存**：attempts 仅在结算/注册时变化，脏标记
  失效 + 按 agents 插入序重建（求和位级一致），WDP 边构造内层 O(A) 扫描消失。
- **agent-manager 纠缠邻接索引**：agentId→纠缠 id 集合 + 规范对键，
  查重/按 agent 查询/批量移除从 O(E) 降为 O(度)；Set 创建序 ==
  原 Map 插入序过滤，公开 getter 顺序不变。
- **scheduler 反向依赖索引**：级联失败经 `dependents: Map<depId, Set<taskId>>`
  O(度) 取直接下游（原为每次失败全量任务扫描）；sweep 保留清理同步收缩索引。
- **selectSolution 有效性掩码**：shots-best 采样不再逐 shot 做 O(m·n)
  解码+校验；掩码对全部基态与原谓词逐点等价（含零概率角落的按需求值）。
- **processQueuedMessages 快照等价形式**：候选连接一次 O(C) 收集，
  逐消息重校验 OPEN/存在性后仍恰好尝试一次发送（与原 find 语义逐点一致）。
- localSearch 增量评估经评估后**有意跳过**（位级选择可能被 ULP 差异翻转；
  非热路径），决策记录留在源码注释。

### 工具链 / 严格度

- tsconfig 新增 **`exactOptionalPropertyTypes`**、**`verbatimModuleSyntax`**、
  **`noImplicitOverride`**、**`noUncheckedSideEffectImports`**（4 项全仓清零；
  `noPropertyAccessFromIndexSignature` 因 87 处 process.env 读取得不偿失，暂缓）。
- CI：Node 矩阵加入 **24**（基准测量版本）；新增 basic/advanced **示例冒烟门禁**；
  覆盖率门槛步骤名与实际（92/82/92/92）对齐。
- `package.json`：`engines.node >= 20`（Node 18 EOL）；版本 1.8.0。

### 周边修复（examples / experiments / scripts）

- **安装脚本**（Windows 上此前必然半途失败）：.cmd + `shell:false` 的
  `spawn EINVAL`（Node ≥ 18.20，CVE-2024-27980 缓解）改走 cmd.exe `/s` +
  verbatim 引用协议；uninstall 先 `pnpm remove` 再清 manifest（原顺序
  必触发 ERR_PNPM_CANNOT_REMOVE_MISSING_PACKAGE）；Windows 盘符 `file:` spec
  不再错误补前导 `/`；`--profiles`/`--dsh-home` 缺值显式报错；ANSI 颜色
  判定修正；postinstall 分支要求本文件为入口（仅被 import 不再触发真实安装）。
- **llm-learning-curve**：每次真实运行截断 results.jsonl（analyze 重读全文件，
  追加模式会混入上一轮/别的模型的陈旧记录）。
- **batch-vcg-benchmark**：DSIC 扫描遍历全部注册 agent（原按 payments 键
  遍历，恰好漏掉被预算挤出的低凭证 agent——虚报动机最强者）。
- **basic-usage.js**：失败路径退出码非零。
- **scaling-law**：实测增益从当前 buckets 推导（原为硬编码字面量，数据重跑即过期）。

### 文档

- README/QUICKSTART/PROACTIVE-*/QUANTUM-SCHEDULING/PROJECT_SUMMARY 与
  当前实现对齐：命令白名单新默认、总线鉴权全路径 + 回环绑定、
  `execute_command_argv`、用例数 245、覆盖率门槛、`'composite'` 条件类型移除。
- 幽灵包名 `dsh-proactive-intelligence` 全部改为真实包名/路径。
- multi-agent-architecture.md / 项目清单.md 标注为历史设计稿/快照。

## v1.7.0 — 全量质量跃迁（2026-09，本轮前一轮）

安全（总线回环默认绑定 + 鉴权门覆盖全部流量路径 + 慢消费者背压 + 连接上限；
命令白名单去解释器化 + `-e` 恒拒 + argv 直达入口 + Windows 参数双重传递修复；
fs 沙箱 TOCTOU）；核心正确性（completeTask 幂等、QPU ≥33 量子比特解码、
距离因子方向、混合条件链短路、fiber-kernel 相位滞后、agent-manager
引用一致性）；健壮性（anneal 参数校验、QUANTUM_WORKERS NaN 守卫、SAB
底座检查、并行失败负缓存、D-Wave 孤儿问题取消/瞬态重试/懒注册/响应验证）；
性能（SPFA 出队、监控惰性前缀、输出字节计数、fitGrid exp 预计算）；
16 项回归测试 + 覆盖率门槛 92/82/92/92。
