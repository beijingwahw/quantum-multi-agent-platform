# 全量代码遍历 · 世界前沿代码质量升级 — 派单计划

taskId: code-quality-20260905
目标仓库: D:\multi-agent\ds_extracted\ds（quantum-multi-agent-platform v1.10.0）
技术栈: TypeScript 5.x / ESM / Node≥20 / ws / node:test + tsx + c8 / eslint 9 flat / prettier / knip

用户意图: 全量代码遍历，给出世界最前沿的代码质量升级方案。
交付形态: 分级（P0-P3）审计 + 前沿对标 + 可执行升级路线图，HTML + DOCX 成品落 DELIVERY/。

## 并行轴（模块 × 攻击面）

| 编号 | 子任务 | 范围 | 产物 | 状态 |
|---|---|---|---|---|
| A | core 调度引擎审计 | src/core(14) + src/types + src/index.ts | subagent_01.md | 轮1 |
| B | 主动智能与集成层审计 | src/proactive-intelligence(11) + dsh + communication + tools + performance | subagent_02.md | 轮1 |
| C | QPU/量子算法审计 | src/qpu(5) + src/utils(4) | subagent_03.md | 轮1 |
| E | 2026 前沿工程实践对标调研 | web search（tsc strict / eslint9 / vitest / oxlint / 供应链安全 / AI code review 等） | subagent_04.md | 轮1 |
| D | 测试与工程基建审计 | tests(28) + ci.yml + tsconfig + eslint.config + knip + package.json | subagent_05.md | 轮2 |
| F | 实验/示例/控制台审计 | experiments + examples + scripts + web-console + 文档漂移 | subagent_06.md | 轮2 |
| G | 交叉复核 + 优先级裁决 | 汇总 A-F，核验 file:line 证据、去重、排优先级 | review.md | 轮3 |

## 依赖图
- 轮1: A, B, C, E 并行（互不依赖）
- 轮2: D, F 并行（与轮1无数据依赖，错峰派发）
- 轮3: G 依赖 A-F 全部回齐
- S5: 主线综合 G 的 review.md → 章节写作 subagent → delivery-artifact 出 HTML → docx 出 Word → DELIVERY/

## 复核项（G 的校验清单）
1. 每条 P0/P1 发现必须能对上真实 file:line（抽查回读源码）
2. 前沿对标结论必须有可点 URL 来源
3. 数字口径统一（文件数、LOC、覆盖率阈值以 package.json 为准）
4. 升级建议按 影响面×成本 排序，标注风险
5. 保留分歧：各 agent 评价不一致处进分歧表

## 硬约束
- 所有 subagent 只读仓库，禁止 npm install / build / 改仓库文件
- 产物统一写 D:\multi-agent\.cluster\code-quality-20260905\subagent_NN.md
- 输出语言: 中文
