# 八十一访：代码质量世界性升级波——波次计划（visit 81）

访客令牌：「请按顺序每次分别派出四个代理，对整个项目的代码质量做世界性升级」

## 波形（复用七十九访工程律，升级面从数学面改为代码质量面）

- 主会话任编排者。每批 4 个交付代理并行、各领一独立仓（互不触碰共享注册表）；批后 1 枚接线代理串行收口共享面（埋藏批次＋census E7/S 板同步＋版本钉复验）；主会话跑总门禁（心跳）、提交、派下批。
- 交付代理只做**代码质量**升级：类型硬化、错误面、单源化、死代码清偿、测试增韧、文档-代码对账。数学/物理主张、常数、判决**冻结**（result-preserving）。
- 批间总门禁 `mutant-census: npm run total`（59 作业，约 11–15 分钟，后台跑）＝波次心跳。红格三步处置：单跑涉案仓→定性→修复或注记。
- 埋藏批次：波 N 交付错＋接线错 → 第 82+(N−1) 批，接线代理注册（出生即双侧）。

## 批次表（按目录 mtime 最旧优先；共享仓最后批）

| 波 | 仓 | 接线 |
|---|---|---|
| 1 | phase-law, ent-sched, nonstoq-anneal, postselect-sched | 批 82 |
| 2 | k-switch, causal-ineq, nosignal-tariff, qram-sched | 批 83 |
| 3 | retro-cache, quantum-mech, survivor-census, readout-wall | 批 84 |
| 4 | binding-price, ent-clearing, choice-lang, ft-qaoa | 批 85 |
| 5 | qverify, stable-world, dsic-noether, dtc-clock | 批 86 |
| 6 | vacuum-compiler, letter-audit, switch-sched, wukong-crossval | 批 87 |
| 7 | bqp-map, depreciation-ledger, route-price, burial-record（各自质量面，**不动注册表数据**） | — |
| 8 | mutant-census（质量面＋批 88 注册＋计数终同步） | 批 88 |
| 终 | 主会话：终门禁＋日档＋MEMORY.md＋提交＋推送 | — |

边界（如实）：本体仓 ds_extracted/ds 不入交付波——受 GENESIS-PHASE1 治理轨道与 PR #9（TS 6.0.3 人工评审待复跑）约束，总门禁每波全量行使其 487 测试；其质量面留待专门访。

## 交付代理质量协议（每仓执行）

1. 第 0 步：`cd D:/multi-agent/mutant-census && npm run preflight -- <仓>` 读卡（只读）。
2. 体检：typecheck 先行（中断遗留排查）→ test/lint/repro 基线全绿才动工。
3. 锚冻结：`grep -rn "<仓名>" ../mutant-census/src ../burial-record/src` —— 被活锚引用的文件/导出符号不改名不挪位（改内部不改签名）。
4. 债务清点（grep 证据 file:line）：any/as/!/@ts-ignore、静默 catch、未类型化 throw、死导出、重复常量、README 计数漂移、脚本管道、入口守卫缺失。
5. 执行 2–4 个最高价值面（每面带测试）：A 类型硬化（品牌类型/可辨识联合/穷尽 switch/readonly）B 错误面（具名错误码＋走私审判）C 单源化（重复公式→单一导出）D 测试增韧（精确值断言＋负对照）E 死代码清偿 F 文档对账。
   - **吸收律（访客中途立法，波 2 起生效）**：E 面删除任何死代码前，必须读它并对取代它的活路径做能力对照，四分支处置：(a) 板行/散文声称其输出＝staircase 型——**接入＋定罪＋锚，不删**；(b) 含优于活路径的工程优点（更强见证/更优数值技巧/更完整错误处理）＝**折进活路径**（带位同构/精确值锚证明数值不劣化）再删；(c) 数学能力差异（新目标族/新实例族/新搜索面）＝**不折**，进 BOUNDARIES 定价（仓名＋能力一句话）；(d) 零残余优点（模板逐字节拷贝/镜像草稿/被超越初稿）＝纯删除。
   - 波 1 定价遗存（吸收律 c 类，留待数学升级访）：postselect-sched 的 always-pay 固定截止目标族（payClosed/payStar，L(t)=t/q(t) 及其最优）；nonstoq-anneal 的受挫环实例族（isFrustratedRing）；phase-law 的非均匀面下降见证搜索（nuFindDescent，含 mask 双点见证结构）。
6. 门禁全绿；src 变则 minor 版本 bump；仓内散文计数同刻改（E7/S2 纪律）。
7. 汇报固定骨架：VERSION / FACE（file:line 证据）/ TESTS / GATES / DEFECTS-CONVICTED（潜伏错定罪）/ MY-ERRORS（交付错，入埋藏批）/ BOUNDARIES。

## 硬规则（族谱教训，无一例外）

- 禁 git（含只读）；门禁命令永不接管道（退出码第 12 见后）；代码文件永走 Write/Edit 工具不走 bash echo/heredoc（第 17 见后）；含反斜杠内容不过 Bash 通道。
- 零新运行时依赖；TS 严格/NodeNext 不变；主张面冻结——改既有断言＝定罪报告（带证据），不是静默修。
- 并行只在工作仓之间成立；共享注册表永远串行（接线代理）；同波版本钉死每批复验。

## 状态

- [x] 波 1 … [ ] 波 8（逐批勾）
