# 第 2 章 前沿对标：2026-09 的世界基线

本章回答一个问题：**把本仓放进 2026 年 9 月的世界工程实践坐标系，各维度站在什么位置？**基准素材来自 subagent_04 的 8 主题调研（多轮 web_search + 交叉验证，优先官方文档），本章只收录与本仓直接相关的结论。

## 2.1 三条时间线警报——本仓三处踩线

| 警报 | 生效时间 | 本仓现状 | 素材依据 |
|---|---|---|---|
| Node 20 EOL | **2026-04-30（已过 4 个月）** | engines.node ">=20"——允许的最低版本不再收安全补丁；CI 矩阵仍在测 Node 20 | subagent_07 I1；subagent_04 主题 4 |
| ESLint 9 EOL | **2026-08-06（已过 1 个月）** | devDeps eslint ^9.39.5 / @eslint/js ^9.39.5——9 系不再收任何修复 | subagent_07 I2；subagent_04 主题 2 |
| TS 7.0（Go 原生）发布 | **2026-08** | typescript 下限 ^5.1.6：低于 5.8 基线（erasableSyntaxOnly / build 模式 --noCheck），且是「假下限」——tsconfig 已用 noUncheckedSideEffectImports（TS 5.6+ 才有），真装 5.1 会直接配置报错 | subagent_07 I10；subagent_04 主题 1 |

三点澄清：

1. **前两条是「已经过期」，不是「将要过期」。**「支持 EOL 运行时」本身就是质量负债（I1 原话）。
2. **第三条性质不同**：TS 5.x 未 EOL，TS 7 只是已发布而非强制；但它改变了一个工程前提——Go 原生编译器把类型检查提速 8-12x，「tsc 慢」从此不再构成跳过全量类型检查的理由。本仓并未跳过类型检查，故此条不紧急，列入 Wave 4 迁移评估即可。
3. 三处的共同点：**都是小时级工作量的机械修复**（engines 改一行、ESLint 升级 + 规则移名清理、typescript 下限改 ^5.6.0），却决定了仓库「一开门」的第一印象——归入第 5 章 Wave 1「止损」。

## 2.2 八主题基线表

| # | 主题 | 2026-09 结论 | 对标基准 | 代表来源 | 置信度 |
|---|---|---|---|---|---|
| 1 | TS 严格模式与 5.x→7.0 | strict 已是绝对基线且 TS 6.0（2026-03）起官方默认；noUncheckedIndexedAccess 为前沿主流推荐位（官方未纳默认）；exactOptionalPropertyTypes 仍属少数派加分项；TS 7.0（2026-08，Go 原生）已发布 | strict:true + noUncheckedIndexedAccess（最低要求）；TS ≥5.8 | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0 | 高 |
| 2 | Lint 生态 | ESLint 9 已 EOL、10.x 为当前线（npm 已至 10.10.0）；typescript-eslint 官方推荐起点是 recommended-type-checked，strict-type-checked 属自愿加码；oxlint 1.0 已稳定（宣称快 50-100x），「oxlint 跑量 + typed lint 跑质」分层策略快速主流化 | ESLint 10 + tseslint 8.69+；CI 分层 lint | https://eslint.org/blog/2026/02/eslint-v10.0.0-released | 高 |
| 3 | 测试栈 | Vitest 4 是事实赢家（State of JS 2025 增幅 +14pp 第一梯队，Jest 下滑）；node:test 在轻量 Node 库场景合理且稳步主流化；fast-check PBT 处上升期、尚非默认 | 轻量库 node:test；中大型 / 需 mock/browser 选 Vitest 4 | https://2025.stateofjs.com/en-US/libraries/testing | 高 |
| 4 | Node LTS 与 type stripping | Node 20 已 EOL、22 为 Maintenance LTS（EOL 2027-04-30）、24 为 Active LTS（EOL 2028-04-30）；type stripping 于 24.12.0 正式 stable；tsx 在 watch/.tsx 场景仍不可替代 | engines >=22（理想 >=24；strip 稳定形态 24.12+） | https://nodejs.org/en/about/previous-releases | 高 |
| 5 | 供应链安全 | npm provenance + trusted publishing（OIDC）已成标配位——classic token 已于 2025-12-09 宣布废弃（90 天迁移期）；OSV-Scanner 进 CI 成开源默认补充；pnpm 10 默认不信任 lifecycle scripts，生态防线下沉 | GitHub Actions + OIDC + --provenance；osv-scanner-action 定时扫描 | https://docs.npmjs.com/trusted-publishers | 高 |
| 6 | AI code review 与门禁 | AI 首轮 review 已平台级标配（Copilot code review 2025-04 GA）；成熟做法 = 确定性门禁 → AI 过滤（advisory 不阻塞合并）→ 人工终审；AI 代码常配「变更行覆盖 ≥80%」类确定性闸门 | claude-code-action / Copilot review（advisory 模式） | https://github.blog/changelog/2025-04-04-copilot-code-review-now-generally-available | 高（误报率数据低置信） |
| 7 | 覆盖率实践 | 行覆盖仍是第一 KPI（Test Coverage 以 56.4% 位居团队 KPI 第一）但正被削弱；分支覆盖 + PR 变更行覆盖上升（AI 代码门禁驱动）；共识：「覆盖率是卫生指标而非质量证明」 | lines + branches 双阈值；可选 patch coverage ≥80% | https://about.codecov.io/blog/line-or-branch-coverage-which-type-is-right-for-you | 中-高 |
| 8 | Dead code 与构建链 | Knip 是该赛道事实标准（官网自述 40M 下载/月、150+ 插件）；ts-blank-space / Node 原生 strip 属「纯擦除」上升期；swc 主导需转换场景；monorepo 工具对本仓单包形态**不适用** | knip 6.x 入 CI；可擦除子集 + erasableSyntaxOnly | https://knip.dev/ | 高 |

诚实标注（源自 subagent_04「缺口」段）：fast-check 采纳率、AI review 误报率（5-15% 出自非权威来源）、c8 最新版本号、patch coverage 普及率四项**缺权威统计，均不作硬基准引用**。

## 2.3 纠偏：strictTypeChecked 不是官方推荐位

一处常见误读需要纠正：**「全量 strict-type-checked 才算 2026 前沿」不成立。**

- typescript-eslint 官方文档的原文建议：启用 typed linting 的项目**从 `recommended-type-checked` + `stylistic-type-checked` 起步**；`strict-type-checked` 定位为更激进的自愿档位。且类型感知规则是 lint 性能瓶颈主因（官方 performance 文档承认），大仓库通行「oxlint 跑量 + ESLint typed 跑质」分层。
- **本仓现状恰好站在正确位置**：eslint.config.mjs 采用 tseslint 8 recommendedTypeChecked + 15 条逐条加严（subagent_07 配置矩阵）——这不是「不够激进」，而是比全量 strictTypeChecked 更健康的姿势：按本仓实际痛点手动选规则，每条豁免 / 加严都有注释理由。
- 因此升级 ESLint 10 时**无需**顺带切 strictTypeChecked；若要加码，正确路径是逐条引入 strict 区规则并配合 oxlint 分层（见第 5 章 Wave 4）。
- 来源：https://typescript-eslint.io/users/configs 、https://typescript-eslint.io/troubleshooting/typed-linting/performance

## 2.4 本仓已达标项：点名表扬

对标不是只找差距——以下各项本仓**已经在 2026-09 基准线上，甚至在线上**：

| 已达标项 | 本仓现状 | 对标位置 |
|---|---|---|
| noUncheckedIndexedAccess + exactOptionalPropertyTypes + verbatimModuleSyntax + noUncheckedSideEffectImports | tsconfig 全开（subagent_07） | 前沿主流推荐位 + 少数派加分项**双双拿下**，超过绝大多数开源 TS 仓 |
| node:test 原生测试栈 | node:test + tsx + c8，覆盖率双 OS 硬门禁 | 轻量 Node 库场景的正确主流选型（主题 3）；c8 正是 node:test 生态默认覆盖方案（主题 7） |
| knip 死代码门禁 | knip 入 CI 硬门禁 | 该赛道事实标准（40M 下载/月）——选型眼光超前（待改进细节见 I9：entry 未锚定 src/index.ts） |
| ESLint flat config | 已用 flat + tseslint 8 recommendedTypeChecked | 9→10 升级时配置语法基本平移，无结构性障碍（主题 2） |
| lockfile 入库 + npm ci | 已具备 | 供应链基础卫生的「已完成一半」——补 OSV-Scanner / audit 门禁即达主流（主题 5） |

**小结**：本仓的工具链眼光是超前的——noUncheckedIndexedAccess、knip、node:test 这套组合在 2024-2025 年属于早鸟选型，如今全部站上主流位。欠的不是眼光，而是**踩住时间线的脚**：三处 EOL 踩线让一套本可标榜前沿的栈在 2026-09 的快照里显出过期相。完成 Wave 1 的三件小时级清理（engines ≥22、ESLint 10、typescript 下限 ^5.6.0）后，本仓基建即回到前沿位。
