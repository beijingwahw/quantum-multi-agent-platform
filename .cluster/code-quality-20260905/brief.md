# 报告写作 Brief（S5 · 唯一事实源）

报告主题：quantum-multi-agent-platform v1.10.0 全量代码质量审计与世界前沿升级方案
读者：仓库维护者（技术向，懂 TS/Node/量子调度背景）
语言：中文（技术名词、代码、工具名保留英文）
基调：专业审计报告——数据说话、证据带 file:line、不吹不黑；既给问题也给路线图；结尾必须有「值得保留的优点」（这个仓库底子很好，报告必须体现这一点）

## 素材文件（写作前必读，按章节分配）

- `.cluster/code-quality-20260905/subagent_01.md` — core 调度算法审计（25 条：2P1+7P2+16P3）
- `.cluster/code-quality-20260905/subagent_08.md` — core 优化器与平台入口审计（54 条：含多条 P1）
- `.cluster/code-quality-20260905/subagent_02.md` — 主动智能模块审计（25 条：1P0+多P1）
- `.cluster/code-quality-20260905/subagent_09.md` — 通信与工具边界审计（10 条 F 系列）
- `.cluster/code-quality-20260905/subagent_05.md` — 测试质量审计（31 条：5P1）
- `.cluster/code-quality-20260905/subagent_06.md` — 实验/示例/文档漂移审计（27 条）
- `.cluster/code-quality-20260905/subagent_03.md` — 主线亲审 QPU+utils+类型层（10 条）
- `.cluster/code-quality-20260905/subagent_07.md` — 主线亲审工程基建与 CI（12 条）
- `.cluster/code-quality-20260905/subagent_04.md` — 2025-2026 前沿对标基准（8 主题带来源）
- `.cluster/code-quality-20260905/review.md` — 复核结论（P0/P1 验证结果、口径、缺口）

## 统一口径（必须遵守）

- 规模：src 40 文件 11828 LOC（.ts）、tests 28 文件 5822 LOC、examples 8 文件 1796 LOC、experiments 4 文件 1412 LOC、scripts 2 文件 534 LOC；总计约 2.1 万 LOC TS 代码
- 发现总数：约 190 条（去重后），分布：P0×1、P1×约15、P2×约60、P3×约110（以各素材实际条目计）
- 审计方式：9 路并行深审（7 路外派 Agent + 2 路主线亲审）+ 交叉复核抽查回读
- 已验证的 P0/P1（复核回读过源码，标注「已验证」）：plugin 串行动作执行（P0）、scheduleTask 无状态守卫（P1）、overloaded 吸收态（P1）
- 严重度定义：P0=事件风暴下吞吐塌陷/安全边界失效；P1=静默数据损坏/状态机死锁/精确最优解可疑；P2=边界条件与韧性缺陷；P3=可维护性/一致性/性能微瑕

## 章节结构与写作者

### 第 1 章 总览与结论（writer A）
- 仓库画像：量子多 Agent 调度平台（QAOA/子空间退火/VCG 市场/主动智能/WS 总线/QPU 三后端），工程质量基线显著高于平均（tsconfig 严格度第一梯队、CI 双 OS×3 Node 矩阵、覆盖率+死代码双门禁）
- 一句话总评：这是一个「内核严谨、外围欠账」的仓库——算法内核的确定性工程与机制设计注释达到研究级，但状态机完整性、异步并发纪律、EOL 工具链、测试时序确定性四处欠账拉低了综合水位
- 质量记分卡（表格）：类型安全/算法正确性/并发纪律/错误处理/测试质量/工程基建/文档一致性/安全边界 八维，各给 A-D 评级 + 一句依据
- Top10 必修清单（表格：编号/严重度/位置/一句话/修复成本估计）

### 第 2 章 前沿对标：2026-09 的世界基线（writer A）
基于 subagent_04.md，重点：
- 时间线警报：Node 20 EOL（2026-04-30）、ESLint 9 EOL（2026-08-06）、TS 7.0 Go 原生已发布——本仓三处踩线
- 8 主题基线表（每主题：结论/对标基准/来源 URL/置信度）
- 纠偏：strictTypeChecked 非官方推荐位（官方推荐 recommended-type-checked 起步）
- 本仓已达标的项要点名表扬（noUncheckedIndexedAccess/exactOptionalPropertyTypes/node:test 原生栈/knip 门禁）

### 第 3 章 P0/P1 发现详解（writer B）
全部 P0/P1（约 16 条），每条：问题/证据(file:line)/影响/修复建议/验证状态。重点展开三条已验证的 + 优化器耦合键疑点（标注「疑点，建议验证」）。分组：状态机完整性（4条）、并发与异步纪律（5条）、边界安全（3条）、算法正确性（3条）、测试有效性（P1 测试类）。

### 第 4 章 P2/P3 精选与模式归纳（writer B）
不逐条罗列（太长），按反模式聚类归纳：
- 「validate-then-mutate 违例」簇（settle 半更新、settleBatch 先变更后抛错）
- 「双实现漂移」簇（亲和度双求和序、能量还原三处三写、top-K 双实现、mulberry32 三份拷贝）
- 「配置探测散在热路径」簇（env 重复读、SAB 探测）
- 「类型谎言」簇（Date 序列化、object 返回、unknown 条件值）
- 「指标口径混淆」簇（cancelled 计入 failed、rejected 计入 history、报表字段挪用）
- P2/P3 完整清单以附表形式给出（编号/严重度/模块/一句话）

### 第 5 章 升级路线图（writer C）
四个波次的执行计划（表格+说明）：
- Wave 1「止损」（1-2 天）：三条已验证 P0/P1 修复 + Node/ESLint EOL 清理 + CI 硬化（timeout/concurrency/permissions）
- Wave 2「补状态机」（1 周）：状态机集中化改造（TaskLifecycleManager 单写点+不变量断言）、overloaded 恢复、pending TTL、依赖环检测、plugin 并发池化
- Wave 3「一致性还账」（2-4 周）：数值口径清单+快照测试固化、denormalizeExpectation 等共享函数抽取、测试确定性改造（flush 原语+结构化错误码）、dsh/tools 深审补课
- Wave 4「面向 2027」（1-2 月）：TS 7 原生编译器迁移评估、exports 子路径拆分、worker 独立文件化、isolatedDeclarations、结构化日志、覆盖率 artifact+变更行覆盖
每波次给：目标/条目/验收标准/风险

### 第 6 章 值得保留的世界级优点（writer C）
从各素材「优点」段落提炼：三道 QPU 校验闸门、机制设计定理级注释、确定性工程（位级一致）、多层背压上界、timingSafeEqual、CI 门禁文化、eslint 分区豁免策略、纤维混合闭式解等。强调：升级不是重写，这些资产是护城河。

### 第 7 章 已知边界与后续（writer C）
- 覆盖缺口（review.md 第五节）：dsh-integration/tools/benchmark 深审未完成、web-console 仅静态审
- 审计环境限制：静态审读为主，未运行测试套件
- 后续建议：按 Wave 1 清单先修再测，回归 CI 全绿后进入 Wave 2

## 写作规范

- 每章产出自包含 markdown，文件名 chapters/chN.md，开头 `# 第 N 章 章名`
- 表格优先；证据一律 file:line；来源 URL 只用 subagent_04 里真实存在的
- 不得发明新发现——所有问题条目必须能在素材文件中找到对应
- 数字口径以本 brief 为准，与素材冲突时以 brief（review.md 已核对）为准
- 每章 800-2000 字（第 3 章可到 2500），信息密度优先
