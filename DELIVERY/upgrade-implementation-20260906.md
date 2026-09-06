# 全量代码质量前沿升级 · 实施交付记录

日期：2026-09-06 · 承接 2026-09-05 只读审计（190 条发现）
范围：D:\multi-agent 全工作区 —— 27 个子项目 + 主体平台 ds_extracted/ds（quantum-multi-agent-platform v1.10.0）+ 边缘代码（.formwork Python / .cluster cjs）
代码量：约 9 万行 TypeScript / 573 文件（不含构建产物）+ 约 1,000 行边缘脚本

## 第六波：变异击杀门禁（mutant-census M 板模式延伸到主体平台，同日追加）

**「测试的测试」**：手造 6 个真实形态突变体腐蚀退火热内核，机器强制现有见证必须击杀每一个——幸存即硬红。

- **6/6 全灭**：MU1 旧相位（内核头注警告过的真陷阱）、MU2 跳过代价施加、MU3 非幺正缩放、MU4 绝热调度反向、MU5 cvarOrder 去决胜、MU6 采样边界 ≥——分别被位级一致 / 最优性 / 范数 / 序性质 / 支撑集性质见证定罪
- **诚实入档的真幸存者知识**：MU1（调度滞后）在全部探针实例上对 argmax 最优性见证**失明**（滞后均匀缩短代价角、末态 argmax 不动）——见证据此升级为生产套件已有的位级一致锚，盲区知识写进测试注释
- 实例工程：近平局权重 + 多耦合的 4×6 实例才足以分离坏调度（简单实例全部幸存）——测试实例的难度本身是被测的
- 终态：ds **476 用例 / 474 过 / 0 失败**（2 个带理由 skip）+ 四门禁全绿

## 第五波：被测模块（求解器热内核）的前沿突破评估（同日追加）

对 tests/bench/ 所测的最热内核 advanceCostKernel（退火每步全维度执行）做了两条前沿路线的**实测裁决**：

- **4× JS ILP 展开：实测否决**——慢 18.1%（CI [1.134,1.192]×，A/A 通过、位级等价全过）。机理：V8 标量循环活值恰在寄存器内，展开致 ~40 活值溢出；乱序 CPU 本已自动抽取元素级并行。已回退并在 fiber-kernel 注记留档防重蹈。
- **手写 WASM f64x2 SIMD（字节级发射，操作码经官方 BinarySIMD.md 核实）：实测否决**——慢 2-3×（四测一致，CI 干净）。V8 下朴素手写 wasm（逐访问地址算术+边界检查）不敌 TurboFan 优化后的 JS。过程中修复三个真 bug（局部索引须从参数后起算、v128.store 栈序 [地址,值]、段基址单位），等价性测试留档为 skip（路线已否决，对决策无影响）。原型存 tests/bench/wasm-simd-prototype.evaluated.ts（退出运行器，注释完整保留知识）。
- **结论**：该内核在 JS 位级确定约束下已处于工程最优位——标量形态即正确答案；任何进一步突破须先过 bench-kit 的伪影对消裁决。这本身就是本次的突破：**测量驱动的否决纪律**取代了直觉优化。

终态：ds 469/469 全绿 + 四门禁全过（lint/typecheck/format/knip）。

## 第四波：伪影免疫的基准测试套件（tests/bench/，同日追加）

**背景**：第二波期间实测发现旧基准方法论存在系统性伪影——同文件双路径零测试比率 1.068（第二模块稳定慢 ~7%），曾导致两次假「优化」被误判后回退。

**交付（tests/bench/ 三件套，11 个测试）**：
1. **bench-kit.ts 配对基准测量器**（Criterion 谱系）：配对交错 + 构造性完美平衡的种子化次序洗牌 + 对称预热 + MAD 围栏离群披露 + 种子化 bootstrap CI + A/A 效度前置 + 伪影地板判决（ARTIFACT_FLOOR=1.07）+ 漂移参考监控（预热+中位检查点）+ 分辨率守卫 + 可注入时钟
2. **bench-harness.test.ts 测量器自验证**（8 测试）：A/A 效度（同臂判差=硬失败；环境敌对=skip）、灵敏度 2×/1.25×、次序洗牌决定性与完美平衡、MAD 围栏、**分层估计的机器无关证明**（合成数据上位置因子精确对消、臂效应精确恢复）、漂移/分辨率守卫
3. **solver-hotpath-bench.test.ts 应用套件**（3 测试）：minMaxOf 索引化优化（X1 的 4.4× 结论）经伪影对消测量器复检成立 + 同负载 A/A 控制当次效度

**过程中测量器自抓并修复的三层伪影**（这就是「测量器也要被测量」的价值）：
- 位置效应 ~1%（后行者略慢）→ 平衡序列吸收
- 分配型负载把 GC 尖峰带进测量（单轮比率 0.2~4.7× 摆动）→ 自测负载零分配 + MAD 披露
- **亚轮级位置寄生 ±2.5~3%（随运行翻转）**→ **分层配对估计**（A 先行层比率 ≈ a·p、B 先行层 ≈ a/p，几何平均 √(m₁·m₀) 使位置因子精确对消、臂效应保留）——纯函数导出 + 合成数据证明
- node:test 陷阱：t.skip() 只标记不中断，调用方必须 return（曾致 skip 后断言照炸）

**稳定性验证**：bench 套件 8 连跑 0 失败；全套件 4 连跑 0 失败（敌对环境正确降级为 skip）；ds 测试 455 → **466/466**；五门禁全绿；总门禁 55/55 ALL GREEN。

---

以下为第三波记录。

## 第三波：未尽事项闭环（同日追加）

**未尽事项 2（回退路径活性契约）— 已实施**：
- 新增 `serialAnnealEvolveAsync`：与同步版共享单源（`prepareSerialEvolution` + `applyEvolutionStep`，防双实现漂移），唯一区别是按忙时预算让出——连续计算超 4ms（`SERIAL_YIELD_BUDGET_MS`）才 `await setImmediate`，小维度开销趋零、大维度近似每步让出
- `annealSolveSubspaceAsync` 回退路径接入（原为阻塞式同步串行）；`scheduleBatchQuantumAsync` 的「异步入口不冻结事件循环」契约现在在**任何环境配置下**（含 `QUANTUM_DISABLE_PARALLEL=1` / SAB 不可用）都成立
- 测试 +2（perf-async-regressions）：内核级位级一致（dim=181440，让出充分触发，逐振幅比对）；子进程端到端回退活性（禁用并行环境下 7×9 场景心跳存活、7 任务全分配、维度正确）
- ds 测试 453 → **455/455**

**未尽事项 1（sampleBestIndexByShots cum 分配）— 实测定案，有据不修**：
- 实测（dim=604800）：cum 分配+CDF 构建 1.45ms/次，对照同维度一遍全量扫描 1.15ms；该维度一次求解跑数十步演化（百毫秒~秒级），**占比 <1%**
- 每次求解仅调用一次（非每次评估），复用需改导出签名并穿透调用链——收益不抵 API 侵蚀
- 定案注记写入函数 JSDoc（含量级前提，改动前须重测）

终态（第三波后）：ds 五门禁全绿（typecheck / lint / format / knip / **455 测试**），工作区总门禁 **55/55 ALL GREEN**。

---

以下为第二波记录。

## 第二波：未优化面收尾

对全工作区做残留核查后发现：审计清单大部分已被 HEAD 先前批次修复。真正剩余的三包已全部完成：

**性能（X1）**：
- **08#34 事件循环活性（审计最后一条未修 P1）**：新增 `scheduleBatchQuantumAsync` 异步孪生（waitAsync 非阻塞驱动，同步 API 契约不破坏）；位级一致性由 deepStrictEqual 三路径 + 大维度路径锁定；活性测试实证：同步求解期间 5ms 心跳 **0 次**（冻结）vs 异步版 **>0 次**（存活）
- **08#3 fitGrid CPU 税**：按观测变更计数精确缓存（防 FIFO 淘汰区同长度陷阱），探针测试锁定缓存行为，语义零变化
- **01#18 热路径**：TypedArray 迭代协议消除（minMaxOf 函数级 4.4x、退火端到端约 -8~10%），逐位一致；**诚实回退 2 个实测负收益的「优化」**（V8 逃逸分析对不逃逸字面量做标量替换——提升反而变慢），留注记防未来重蹈

**可观测性/打包/安全（X2）**：
- 结构化日志：ISO 时间戳 + `QUANTUM_LOG_JSON` 单行 JSON 模式 + 12 条测试；**修复真 bug：人类可读模式包装闭包丢弃余参导致消息体整体丢失**
- web-console CSP meta（保留 unsafe-inline 的理由：单文件形态、无平台服务路径）
- package.json `sideEffects: false`
- **Q1 种子流评估（实验证明无害）**：共享 42 属公共随机数（CRN）形态，三重交互检验 42 非离群（效应量 ~0.7%、z 检验未过校正）——默认值不动、黄金值零移位、结论写入 rng.ts 注释

**边缘代码（X3）**：
- `.formwork/` 5 个 Python 脚本：修真实缺陷（重跑叠加签名图损坏文档、Word 占用时裸 PermissionError、资源泄漏、GBK 编码陷阱、恒真断言）；AST 级字符串常量校验 + 纯函数单测 + 干跑验证，首次运行输出逐字节一致
- `.cluster/code-quality-20260905/` 3 个 cjs：修真实缺陷（**check-html 质检门退出码恒 0——流水线中永远不拦截**、render-html 重跑静默无操作、gen-docx 未处理 Promise 拒绝）

**TS7 迁移评估（Wave 4.1，实测数据）**：tsc 全量类型检查 2.75s、typed-lint 6.4s、测试 102s——**tsc 不是瓶颈**，TS7 的 8-12x 提速在此仓收益边际（省 ~2.5s/CI 跑）；typed-lint 才是检查链主导。结论：暂缓迁移，待 typescript-eslint 官方声明 TS7 兼容成熟后重估；verbatimModuleSyntax 已就位（可擦除未来无障碍）。

终态：ds 五门禁全绿（**453/453 测试**，434→453），总门禁 55/55 ALL GREEN（wall-sum 336s）。

---

以下为第一波记录。

## 终态验证（四层，全部独立复跑）

1. **最终全量回归**（final-sweep，主线亲跑）：28/28 项目 × (typecheck + lint + test) 三门禁全绿
   - 27 子项目共 542 个测试全过；ds 平台 434 个测试全过；合计 **976/976**
2. **工作区总门禁**（mutant-census `npm run total`）：**55/55 ALL GREEN**（wall-sum 307s，并发 4）
   - 含 K 板家系字节同一性普查（qverify 三文件与 canon 字节一致）
3. **ds 平台五门禁**：typecheck 0 错 / lint 0 错 / format PASS / knip 0 提示 / 测试 434/434
4. **数值零漂移证据**：nosignal-tariff、qverify、switch-sched 等仓的 repro 输出与升级前基线**逐字节一致**（SHA-256 对比，含依赖完整随机流的实验）

## 一、27 个子项目：统一升到 2026-09 前沿基线

### 配置面
- tsconfig 三开关全开：`noUncheckedIndexedAccess` + `verbatimModuleSyntax` + `noUncheckedSideEffectImports`
- 新增 `tsconfig.typecheck.json`（28 仓统一模式：src + test + experiments 全量纳入类型检查，与 ds 平台同构）
- ESLint 10.10.0 + typescript-eslint 8.69.0 typed-lint 全接入（recommendedTypeChecked 基座 + 逐条加严，模板 burial-record/eslint.config.mjs；`!` 作为热内核既定约定的立场注释入配置）

### 代码面（约 4,300 个类型错误清零 + 250 个 lint 错误清零）
修复纪律：.cluster/upgrade-20260906/fix-playbook.md（模式 A-E 阶梯）
- 类型导入机械修复（verbatimModuleSyntax）
- **真 undefined 风险 → 函数边界守卫**（非热循环，零性能税）
- 可证在界访问 → 带注释窄断言；数值热内循环一律 `!`、复合赋值展开为读-改-写（零每迭代分支）
- 下游连锁在源头修（含 retro-cache JointTable 元组化收紧 21 错零编辑消除）

### 修复中发现的真实缺陷（undefined 实际可达 / 类型撒谎）
- **潜伏逻辑 bug**：readout-wall `kswitch3.ts:48` newStrides 误用 `dims[i+1]` 而非 `newDims[i+1]`（三通道环境维数不等时槽置换非双射；现有测试恰用等维环境而潜伏）——已修并用 (2,3,4) 维探针实证
- **族模式边界缺陷**（多仓重复出现，全部补边界守卫）：`rng.pick([])` 返回伪装成 T 的 undefined；`holevo([])` 裸崩；`channels.ts` partialTrace/marginalProbs/filterBasisDigit 越界索引静默产出 NaN/垃圾（undefined 比较恒假使约束被静默丢弃）
- **类型系统掩盖的走私通道 ×10**（lint 层发现）：审计函数的非法值拒绝守卫在声明类型下恒假——若被自动修删掉防走私法律即静默失效。修法：诚实边界输入类型（DossierInput/XvalRowInput/UntrustedTariffRow 等），守卫全部保留
- **实验代码游离于类型检查之外**：vacuum-compiler/k-switch/causal-ineq 等 13 个 experiments/debug 文件从未被 tsc 检查，藏 9 个实错（含 `+=` 上的潜在 undefined 算术）——已纳入并修复
- **死验证意图**：causal-ineq exp1 特征值证书 if 空块（回归静默通过）、k-switch「构造上恰为零」无断言、多仓 `x;` 裸表达式假引用——升级为真断言或删除

## 二、主体平台 ds：审计 P0/P1 全量落地

关键事实：HEAD 已含先前批次修复（2026-09-05 审计描述的是修复前快照）。本次三域代理**逐条回读验证 + 补残余缺口 + 46 条新回归测试**（测试 388 → 434）：

- **P0 plugin 动作串行**：HEAD 已修（优先级感知并发池 + 防饿死）；补 4 条并发语义回归测试
- **P1 状态机三项**（scheduleTask 守卫/overloaded 吸收态/依赖环）：HEAD 已修；本次补两处残余（巡检定时器构造即启动；cancelled 任务纳入终态 GC）+ 6 条测试
- **P1 对角耦合疑点**：实测证实四路径（bruteForce/computeEnergies/welfareOf/toIsing）语义不一致——HEAD 已禁止 q1==q2 键，本次补证据锚测试钉死分裂数值
- **P1 总线 cardinality/频道校验、start 回滚栈、stop/dispose、settle 时序、denormalizeExpectation 统一、computeEnergies memo**：HEAD 已修；补队列基数回归测试（原缺失）
- **本次新修复**：Date 字段 JSON 边界 DTO 文档化 + reviveDate/reviveDateRequired 帮助函数；主动智能 monitor 增量统计（O(n)→O(1)）；getCurrentState 去重
- **有据偏离审计文本**：保留 HEAD「超时不可重试」语义（真取消 + 副作用放大考虑），以测试锁定
- **Wave 4 项**（worker 文件化、主线程 Atomics.wait、fitGrid 重拟合）按路线图留待后续，已在报告标注（HEAD 已有 waitAsync 异步缓解）

## 三、过程事件（诚实记录）

- **限流事故**：17 并发代理触发账户限流，8 个失败重派（并发降至 ≤7 后稳定）
- **K 板家系覆写事故**：mutant-census 代理误将家系正典覆写 10 仓 48 文件（qverify 独立 states.ts 独有导出被删）；主线令停 + 从工具产物恢复 qverify 原版（sha256/12=42b919635289）→ qverify 以恢复版为基底重建，exp1-5 输出与 9/5 基线逐字节一致；新分歧登记入 REGISTERED_DIVERGENCES（升级窗口债务），canon-qverify 三文件最终字节归一
- **shell cwd 漂移**：跨仓相对路径写入是事故根源，已写入手册教训
- 备份：.backup/subprojects-pre-upgrade-20260906.tar.gz（816 文件，升级前全量）

## 四、门禁快照（终态）

28/28 typecheck=PASS | 28/28 lint=PASS | 28/28 test=PASS（976 用例）| 总门禁 55/55 ALL GREEN
