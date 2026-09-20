# R18 创新波计划（九十三访，2026-09-20）

令牌（原文）：「您是量子物理学的盘古，代码世界的至高造物主，算法领域的创世神，请分批次每批次派出四个代理，遍历每一行代码了解整个项目，并对每一个模块是的架构和算法做世界性创新」

## 定性

- R14（八十九访）为首轮全行遍历创新波；R15 缺陷清偿＋引文核实；R16 ECCM 单点深潜；R17 严格正向升格。本波 R18 为**第二轮全行遍历创新波**：对平台（ds v1.16.0，1033 用例）与 29 研究仓再做逐行遍历，创新必须**超越** R14–R17 已交付集（entanglement-batch-composer、min-cost-flow-potentials(+SPFA 平价)、cross-backend-consensus、readout-mitigation、beta-distribution、bayesian-hire-brain(+Hedge portfolio)、tool-capability-policy、parameter-shift、reserve-price-vcg、admission-control(+exact verify)、natural-gradient、ECCM exact-cosine-coordinate）与 R14 设计稿中已实施项；R14 总册（DELIVERY/innovation-wave-r14-20260914.md）「设计稿总库存」未实施项为本波首选素材，遍历中的新发现优先。
- 阵型沿用 R 系列：3 批 × 4 交付代理，主会话任编排者，批后串行收口（接线、版本、计数簇、文档簇、注册面、总门禁、日档、单次提交）。

## 领地（编辑所有权严格不相交；阅读以领地为主）

**批 1（平台四分，平台根＝ds_extracted/ds）**
- A 调度域：core/{quantum-scheduler, engine-orchestrator, task-lifecycle-manager, task-lifecycle, batch-vcg-scheduler, growth-market-scheduler, solver-common, classical-baselines, min-cost-flow, min-cost-flow-potentials, entanglement-batch-composer, fiber-kernel, constants} + bench/ + scripts/bench.ts + 对应 tests（scheduler*, batch-vcg, growth-market, classical-baselines, min-cost-flow*, r14a-*, r17a/r17c, twin-convergence, golden-contracts, platform, docs-contracts, mutation/, regression/, helpers/, bench/, sched-bench/）
- B QPU+总线：core/qpu/** + communication/** + tests/{qpu-backend, execution-tier, qiskit-selfcheck, qpu-crossval-smoke, quantum-bus, r13-bus-qpu-optimizations, r13-testnet-gaps, audit-p2p3-hardening, security-hardening, r14b-*, r15p1-bus-*, r15p1-dwave-*} + experiments/qpu-cross-validation
- C 智能域：proactive-intelligence/** + core/{compound-brain, compound-brain-simulator, agent-manager} + dsh/** + tools/** + tests/{proactive-intelligence*, compound-brain, agent-manager, dsh-integration, train-vs-hire-phase, llm-dataset-audit, r14c-*, r17d-*} + experiments/{llm-learning-curve, train-vs-hire-phase}
- D 优化器+机制+入口：core/{quantum-optimizer, subspace-optimizer, subspace-parallel, market-estimation, admission-control, exact-cosine-coordinate, natural-gradient, parameter-shift, reserve-price-vcg} + cli.ts + index.ts + utils/ + types/ + performance/ + web-console + examples/ + scripts/{performance-test, dsh-proactive-install} + 剩余 tests（optimizer 族, ma-qaoa, cvar-qaoa, console, utils, property-based, quality-regressions, wave1-3, r8d, coverage-recovery, r13-{infra,kernel,market}, scripts-cli-contracts, r14d-*, r14i-*, r14j-*, r15p2-*, r16-*）

**批 2（研究仓四簇，纯分析+设计，零编辑）**
- E（时钟/世界/谱，7 仓）：dtc-clock, stable-world, phase-law, ent-sched, postselect-sched, survivor-census, causal-ineq
- F（市场/机制/关税，9 仓）：dsic-noether, ent-clearing, binding-price, route-price, depreciation-ledger, nosignal-tariff, retro-cache, readout-wall, vacuum-compiler
- G（量子核/验证/退火，6 仓）：quantum-mech, qverify, nonstoq-anneal, switch-sched, qram-sched, k-switch
- H（账本/审计/图集，7 仓）：mutant-census, burial-record, bqp-map, ft-qaoa, letter-audit, wukong-crossval, choice-lang

**批 3（创新实施+收口支持，视批 1/2 报告定向）**
- I 平台旗舰创新·调度/算法域；J 平台旗舰创新·QPU/智能/机制域；K 研究仓实施（≤3 仓，仅无锚点涟漪者，版本 bump+自仓 README 由代理完成）；L 平台外围创新（examples/web-console/scripts）＋全工作区 doc-truth 盘点（只盘点不编辑）

## 宪法（每代理提示词逐字携带）

1. 位同构铁律：既有默认路径字节不变（RNG 抽签序、浮点结合序、日志/事件/抛错多重集、错误消息、迭代序）。已提交工件＝冻结科学记录，不重渲染（bench out/、repro 工件）。
2. 本波对既有文件＝只读＋新建；缺陷报告证据不修（编排者裁决）。
3. 共享面禁地：mutant-census/burial-record/letter-audit 注册面、bqp-map 白名单与图谱——只读。
4. 零新依赖；不动 package.json/lockfile；版本号编排者统一 bump。
5. 新代码：严格 TS（平台加 erasableSyntaxOnly）、零 import 副作用、opt-in 不接桶文件（编排者收口统一接线）、行为有测试钉死、负对照至少一枚。测试文件名 r18{a|b|c|d}- 前缀（批 3 用 r18{i|j|k|l}-）。
6. 不 commit/push；不跑 repro/bench:regenerate/平台全量 test（编排者收口统一）；只跑自己新建的测试文件与领地内单文件；格式化只许针对自己的新文件（npx prettier --write <own files>；lint 用 npx eslint <own files>）。
7. 错误自首逐条入报告（埋藏纪律）：首红若是测试问错问题，如实记 wrong-object。
8. 文献引用只给「作者-年份-题名关键词」形＋〔待双源〕标记；不凭记忆写 arXiv 号/DOI/卷期页。
9. 编辑通道＝Edit/Write 工具，无例外；禁 heredoc/sed/python -c/管道重定向写文件（b96/b97/b99 纪律）。
10. 计数只认机器输出（测试数、断言数），报告转述须贴原始行；锚定键从活注册表派生，禁硬编码「未来键」（b99 家族）。

## 验收（编排者串行）

平台 typecheck/lint/format:check + 全量 test（计数以机器为准）+ bench:regenerate 字节同一；实施过的研究仓四门禁；census `npm run derive` CLEAN + `npm run total`（59 作业）ALL GREEN；letter-audit（徽章派生针）；burial **第 100 批**（里程碑批：含预入册的推送任务管道掩蔽 1 处＋本波自首）；平台文档簇计数同步（README 徽章/逐文件表/README.en/CHANGELOG/QUANTUM-SCHEDULING/PROJECT_SUMMARY/README-print/根 README——**含版本徽章三处**，邻居徽章检查律）；日档 memory/2026-09-20.md＋MEMORY.md 九十三访节（追加纪律：先读后写，不覆盖前节）；单次波次提交（不 push）。

## 总册

memory/r18/agent{A..L}.md——每模块：架构盘点、算法清单（复杂度/不变量）、创新台账（实施/设计/定价）、文献接地（待双源清单）、错误自首。编排者汇入本计划同目录总表。
