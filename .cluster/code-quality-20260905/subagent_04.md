# 2025-2026 前沿工程实践对标基准

> 调研时间：2026-09-05 | 调研员：subagent_04（工程效能）
> 方法：web_search 多轮检索 + 交叉验证，优先官方文档（Microsoft TypeScript Blog、ESLint Blog、Node.js 官网、npm Docs、Vitest/GitHub 官方博客），辅以 InfoQ / 权威工程博客。
> 对标对象仓库技术栈：TypeScript 5 (ESM) + Node≥20 + ESLint 9 flat config + node:test + c8 + knip。

---

## 逐主题结论（含来源与置信度）

### 主题 1：TypeScript 严格模式与 5.x 新特性

**1.1 `strict` 已是绝对基线，且官方正在把它变成默认值**

- **结论**：`strict: true` 已从"最佳实践"升级为"官方默认"——TypeScript 6.0（2026-03）起 `tsc` 默认开启 strict，为 7.0 铺路；任何 2025-2026 年新建/升级的仓库不开 strict 视为落后于业界。
- **对标基准**：tsconfig `strict: true`（最低要求）；TypeScript 5.x 系列终点为 5.9（2025-08），6.0（2026-03）为对齐 7.0 的过渡版本，7.0（2026-08，Go 原生编译器，构建提速 8-12x）已发布。
- **来源**：
  - https://devblogs.microsoft.com/typescript/announcing-typescript-6-0
  - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
  - https://github.com/microsoft/TypeScript/issues/62333
  - https://devblogs.microsoft.com/typescript/announcing-typescript-5-9
  - https://www.infoq.com/news/2026/08/typescript-7-released
- **置信度**：高（官方博客 + 官方 release notes + 官方 issue 三重印证）

**1.2 `noUncheckedIndexedAccess`：强推荐位但未进默认，属"前沿主流"**

- **结论**：业界专家层（Total TypeScript 等）已把 `noUncheckedIndexedAccess` 列为"每个严肃项目都该开"的选项，社区多年要求默认开启，但官方至今未纳入 strict；实际采纳呈"头部项目开、长尾项目不开"分布。
- **对标基准**：tsconfig `"noUncheckedIndexedAccess": true`；不开则视为低于 2025-2026 前沿基线。
- **来源**：
  - https://www.totaltypescript.com/tsconfig-cheat-sheet
  - https://whatislove.dev/articles/the-strictest-typescript-config
  - https://www.typescriptlang.org/tsconfig
- **置信度**：高（官方文档确认语义 + 多个权威工程师来源确认推荐位；"未默认"由 TSConfig 官方参考佐证）

**1.3 `exactOptionalPropertyTypes`：正确性收益明确，采纳仍属少数派**

- **结论**：官方文档承认其更严格的可选属性语义，多个类型安全指南称其"极其重要但使用不广"；因其迫使显式区分 `undefined` 赋值，迁移成本高，业界态度是"库代码/新项目开，存量代码权衡"。
- **对标基准**：tsconfig `"exactOptionalPropertyTypes": true`（前沿加分项，非人人必开）。
- **来源**：
  - https://www.typescriptlang.org/tsconfig
  - https://typesaurus.com/type-safety/tsconfig
- **置信度**：中（官方文档 + 工程指南，缺大规模采纳率统计）

**1.4 TS 5.x 关键新特性基准**

- **结论**：const type parameters（5.0）、`--noCheck`（5.6）、`isolatedDeclarations`（5.5）、`--erasableSyntaxOnly`（5.8）构成 5.x 时代的特性基线；其中 `--noCheck` 用于"编译不卡类型检查"的增量构建，`isolatedDeclarations` 面向库的声明文件并行生成（配合 Oxc 等工具可完全绕过 tsc 做声明发射），`erasableSyntaxOnly` 是与 Node 原生 type stripping 对齐的关键开关。
- **对标基准**：TypeScript ≥5.6（`--noCheck`）、≥5.8（`erasableSyntaxOnly` + build 模式下 `--noCheck`）；库项目可评估 `isolatedDeclarations`。
- **来源**：
  - https://devblogs.microsoft.com/typescript/announcing-typescript-5-6 （`--noCheck`）
  - https://devblogs.microsoft.com/typescript/announcing-typescript-5-5 / https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html （isolatedDeclarations）
  - https://devblogs.microsoft.com/typescript/announcing-typescript-5-8 / https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html （erasableSyntaxOnly、noCheck in --build）
  - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html （const type parameters）
  - https://effectivetypescript.com/2024/07/02/ts-55 、https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-10 （isolatedDeclarations 的动机与生态影响）
- **置信度**：高（全部官方发布公告直接佐证）

**1.5 TS 7（Go 原生）时间线**

- **结论**：原生移植自 2025-03 公布、2025-05 发预览、2026-08 发布 7.0；对 CI 的意义是类型检查瓶颈将消失，"tsc 慢"不再构成跳过全量类型检查的理由。
- **来源**：https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews 、https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025 、https://www.infoq.com/news/2026/08/typescript-7-released
- **置信度**：高

---

### 主题 2：ESLint 9 / typescript-eslint 8 与 oxlint / Rust 工具链

**2.1 ESLint 9 flat config 已完成历史使命——注意：ESLint 9 已 EOL**

- **结论**：flat config 自 ESLint 9（2024-04）成为默认，2025-03 官方补充 `defineConfig`/`extends`/全局 ignores 大幅降低配置成本；但**关键时效信息：ESLint v10 已于 2026-02-06 发布，ESLint v9.x 于 2026-08-06 EOL**——对标仓库停在 ESLint 9 在 2026-09 已属于"过期栈"，应规划升 10。
- **对标基准**：ESLint 10.x（npm 最新 10.10.0）；flat config + `defineConfig` + `extends` 写法。
- **来源**：
  - https://eslint.org/blog/2024/04/eslint-v9.0.0-released
  - https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores
  - https://eslint.org/blog/2026/02/eslint-v10.0.0-released （含 "v9.x reached end-of-life on 2026-08-06"）
  - https://www.npmjs.com/package/eslint
- **置信度**：高（官方博客直接佐证，EOL 日期明确）

**2.2 typescript-eslint 8：`recommended-type-checked` 是官方推荐起点，`strictTypeChecked` 是自愿加码**

- **结论**：typescript-eslint v8（2024-07）稳定 project service（typed linting 配置更简单、运行更快），当前最新 8.69.0，官方声明的 ESLint 支持范围为 `^8.57.0 || ^9.0.0 || ^10.0.0`（即已支持 ESLint 10）；官方文档明确建议"启用 typed linting 的项目从 `recommended-type-checked` + `stylistic-type-checked` 起步"，`strict-type-checked` 属于更激进的自愿档位——**"strictTypeChecked 全量推荐位"这一说法不成立**，它是争议项而非主流默认。
- **对标基准**：`@typescript-eslint/eslint-plugin` 8.x（≥8.40，最好 8.69+）；`recommended-type-checked` 为基线，`strict-type-checked` 按团队口味加减；性能上 typed linting 明显慢于纯语法 lint（官方 performance 文档承认），大仓库常用"oxlint 跑量 + ESLint typed 跑质"的分层策略。
- **来源**：
  - https://typescript-eslint.io/blog/announcing-typescript-eslint-v8
  - https://typescript-eslint.io/users/configs （"suggest enabling recommended-type-checked and stylistic-type-checked to start"）
  - https://typescript-eslint.io/users/dependency-versions （ESLint 支持范围含 ^10）
  - https://www.npmjs.com/package/@typescript-eslint/eslint-plugin （8.69.0）
  - https://typescript-eslint.io/troubleshooting/typed-linting/performance （typed 规则是性能瓶颈主因）
- **置信度**：高（官方文档直接佐证）

**2.3 oxlint 1.0（2025-06 发布）与 Rust 工具链趋势**

- **结论**：oxlint 1.0 于 2025 年正式稳定（voidzero 2025-06-09 宣布，InfoQ 2025-08 报道），宣称比 ESLint 快 50-100 倍、发布时已有 5,200+ 早期采用项目、当前 865+ 规则并内置 React/Jest/Vitest/Import 等主流插件规则集；2026-03 JS 插件支持进入 alpha（官方称 80% ESLint 用户可"直接切换"）。Rust 工具链（oxc/swc）在生产采用处于**快速上升期**，主流模式是"CI 里 oxlint 先跑 + ESLint/typescript-eslint 做类型感知深检"，而非全面替换。
- **对标基准**：oxlint ≥1.0（2.x 生态位继续演进）；CI 分层：oxlint（秒级、每 commit）+ typescript-eslint typed 配置（PR 级/夜间）。
- **来源**：
  - https://voidzero.dev/posts/announcing-oxlint-1-stable
  - https://www.infoq.com/news/2025/08/oxlint-v1-released
  - https://oxc.rs/docs/guide/usage/linter
  - https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html
- **置信度**：高（官方公告 + InfoQ 双源；"生产采用规模"部分为中——除官方自述 5,200 early adopters 外缺独立第三方统计）

---

### 主题 3：测试栈演进（node:test vs Vitest；fast-check）

**3.1 node:test 与 Vitest 的 2025-2026 分工**

- **结论**：node:test 自 Node 20 起稳定、零依赖，是"够用的默认"，处于稳步上升通道；但 Vitest 是 2025-2026 的**事实赢家**——State of JS 2025 显示 Vitest 与 Playwright 以 +14 个百分点并列最大增幅、Jest 持续下滑、node:test 上升；Vitest 4.0（2025-10）将 Browser Mode 转正并支持视觉回归测试。业界共识：轻量 Node 库/CLI 用 node:test 合理，中大型项目/需要 mock、watch、browser、in-source testing 的项目选 Vitest。
- **对标基准**：node:test（Node 20+ stable，Node 24 的 runner 比 20 快约 40%）；Vitest 4.x（4.0 2025-10 / 4.1 2026-03，Test Tags 等特性）。
- **来源**：
  - https://nodejs.org/api/test.html
  - https://2025.stateofjs.com/en-US/libraries/testing
  - https://2025.stateofjs.com/so-SO/libraries （Vitest/Playwright +14pp，Jest 下降）
  - https://vitest.dev/blog/vitest-4 、https://voidzero.dev/posts/announcing-vitest-4 、https://www.infoq.com/news/2025/12/vitest-4-browser-mode
  - https://vitest.dev/guide/comparisons
  - https://www.pkgpulse.com/guides/node-test-vs-vitest-vs-jest-native-test-runner-2026
- **置信度**：高（官方文档 + 大规模开发者调查 + 三方独立报道交叉验证）

**3.2 Property-Based Testing（fast-check）：主流化进行中，尚非默认配置**

- **结论**：fast-check 4.0（2025-03）完成 API 现代化；官方已提供 `@fast-check/vitest` 深度集成包（含 Vitest 原生 `test.prop` 支持，2025-03 官方博客宣布与 Vitest 团队合作）；PBT 在 2025-2026 从"学界玩具"进入工程主流视野（尤其用于解析器、序列化、纯函数与 AI 生成代码的回归防护），但**"默认全员使用"仍未发生**——属于上升期实践，而非标配。
- **对标基准**：fast-check ^4.x（2026 年中至 4.8+）；Vitest 项目装 `@fast-check/vitest`；node:test 项目直接用 fast-check 核心 API。
- **来源**：
  - https://fast-check.dev/blog/2025/03/10/whats-new-in-fast-check-4-0-0
  - https://fast-check.dev/blog/2025/03/28/beyond-flaky-tests-bringing-controlled-randomness-to-vitest
  - https://www.npmjs.com/package/@fast-check/vitest
  - https://github.com/dubzzz/fast-check
- **置信度**：中-高（官方来源齐备；"主流化程度"判断基于生态位而非采纳率统计，**缺口：未找到 fast-check 的权威下载量/使用率统计**）

---

### 主题 4：Node 22/24 LTS、engines 约束与 type stripping 转正

**4.1 LTS 格局：Node 20 已 EOL——对标仓库的 engines 已低于基线**

- **结论**：Node.js 20（Iron）已于 **2026-04-30 EOL**；Node 22 处于 Maintenance LTS（EOL 2027-04-30）；**Node 24（Krypton）自 2025-10 起为 Active LTS**（EOL 2028-04-30），是 2026 年新项目推荐运行时。另：Node 官方已宣布自 2026-10 起改为每年一个大版本。
- **对标基准**：`engines.node` 应至少 `>=22`（若要求 type stripping 稳定则 `>=22.12` 无警告场景为 24.12+，理想 `"node": ">=24"`）；Node 25（2025-10）/26（2026-05，Temporal/V8 14.6）为 Current 线，不建议进 engines。
- **来源**：
  - https://nodejs.org/en/about/previous-releases
  - https://www.herodevs.com/blog-posts/node-js-end-of-life-dates-you-should-be-aware-of （Node 20 EOL 2026-04-30、Node 22 Maintenance、Node 24 Active LTS）
  - http://nodesource.com/blog/nodejs-24-becomes-lts
  - https://endoflife.date/nodejs
  - https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule
  - https://docs.npmjs.com/cli/v12/configuring-npm/package-json （engines 字段官方语义）
  - https://docs.renovatebot.com/node （用 engines 控制机器人安装版本）
- **置信度**：高（官方发布表 + 多个独立 EOL 跟踪源一致）

**4.2 type stripping 转正与构建链影响**

- **结论**：Node 原生 type stripping 的时间线为：22.6 实验（2024-08）→ 23.6 默认开启（2025-01）→ **24.12.0（2025-12）正式 stable**；影响是"运行时不再需要 tsx/ts-node 即可跑可擦除语法的 .ts"。但边界同样明确：不支持 .tsx/enum/namespace/参数属性等需转换语法（TS 5.8 的 `--erasableSyntaxOnly` 正是为把代码锁死在可擦除子集）、无 watch、无类型检查；**tsx 在 2026 年仍是事实默认**（watch 模式、.tsx、兼容性），tsc 的角色收缩为"纯类型检查器"（配合 `--noCheck` 的 emit 分离），"无构建"路径适合库与脚本，不适合所有场景。
- **对标基准**：Node 24.12+ 可直接 `node file.ts`；tsconfig 加 `"erasableSyntaxOnly": true` 保证可擦除性；CI 中类型检查独立为 `tsc --noEmit`；tsx 保留用于 watch/.tsx。
- **来源**：
  - https://nodejs.org/api/typescript.html （"v24.12.0 Type stripping is now stable"）
  - https://github.com/nodejs/typescript/issues/24 （stable 路线图：目标 2025-10 随 v24 LTS）
  - https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html
  - https://nodejs.org/learn/typescript/run-natively
  - https://blog.logrocket.com/running-typescript-node-js-tsx-vs-ts-node-vs-native
  - https://www.pkgpulse.com/guides/tsx-vs-ts-node-vs-bun-running-typescript-directly-2026
- **置信度**：高（Node 官方 API 文档直接佐证 stable 版本号；tsx 定位判断为中-高，基于多方一致但无官方数据）

---

### 主题 5：供应链安全（audit / OSV-Scanner / lockfile / provenance / SBOM）

**5.1 Provenance 与 Trusted Publishing 已从"加分项"变"标配位"**

- **结论**：npm provenance（Sigstore 签名的构建来源证明）2023 年 GA 后，2025-07 **Trusted Publishing（基于 OIDC 的免 token 发布）正式 GA**；且 npm 已于 **2025-12-09 废弃 classic token 并给 90 天迁移期**——对发包项目而言，"GitHub Actions + OIDC trusted publishing + `npm publish --provenance`"已是 2026 年的默认姿势。
- **对标基准**：发布流：GitHub Actions + `id-token: write` + trusted publishing 配置 + `--provenance`；JSR 发布同样自动生成 SLSA/Sigstore attestation。
- **来源**：
  - https://docs.npmjs.com/generating-provenance-statements
  - https://docs.npmjs.com/trusted-publishers
  - https://github.com/orgs/community/discussions/127011 （"Trusted publishing with OIDC is now generally available"）
  - https://blog.sigstore.dev/npm-provenance-ga
  - https://github.blog/security/supply-chain-security/introducing-npm-package-provenance
  - https://discuss.circleci.com/t/circleci-and-npm-trusted-publishing/54261 （classic token 废弃与 2025-12-09 生效）
  - https://jsr.io/docs/trust
- **置信度**：高（npm 官方文档 + GitHub 官方讨论 + Sigstore 官方博客）

**5.2 漏洞扫描：npm audit 单打独斗被普遍认为不够，OSV-Scanner 成为开源默认补充**

- **结论**：`npm audit` 因"dev 依赖告警轰炸、无可达性判断"长期被诟病（Dan Abramov 2021《npm audit: Broken by Design》至今仍被引用）；2025-2026 的主流组合是 **npm audit（保留）+ OSV-Scanner（Google，11+ 生态、19+ lockfile 格式，官方 GitHub Action 支持定时 CI 扫描）+ lockfile 校验**；更激进的栈再加 Socket（行为分析查恶意包）与 SBOM（Syft+Grype，SBOM-first 模式）。
- **对标基准**：CI 挂 `google/osv-scanner-action`（scheduled scan）；`npm audit --production` 区分生产暴露；lockfile 治理：lockfile-lint 校验源完整性 + lockfile 入库 + Renovate/Dependabot 周期更新；如需合规再出 SBOM。
- **来源**：
  - https://overreacted.io/npm-audit-broken-by-design
  - https://www.aikido.dev/blog/npm-audit-guide
  - https://google.github.io/osv-scanner 、https://github.com/google/osv-scanner 、https://github.com/google/osv-scanner-action
  - https://github.com/lirantal/npm-security-best-practices （lockfile-lint）
  - https://openssf.org/blog/2026/05/20/detecting-malicious-packages-using-the-osv-api
  - https://www.endorlabs.com/learn/best-software-supply-chain-security-tools
- **置信度**：高（官方文档 + 权威个人博客 + OpenSSF；SBOM 具体工具选型为中——来源为厂商指南）

**5.3 相关生态信号：包管理器安全默认化**

- **结论**：pnpm 10（2025-01）默认不再信任依赖的 lifecycle scripts（"Security by Default"），代表整个生态把供应链防线下沉到包管理器默认值。
- **来源**：https://pnpm.io/blog/2025/12/29/pnpm-in-2025 、https://github.com/orgs/pnpm/discussions/8945
- **置信度**：高（官方博客）

---

### 6：AI 辅助 Code Review 与质量门禁（2025-2026 业界做法）

**结论**：AI 首轮 review 已从实验走向**平台级标配**：GitHub Copilot code review 2025-04-04 正式 GA；Anthropic 提供两条官方路径——Claude Code GitHub App/Action（`anthropics/claude-code-action`，可在 PR 上触发 `/review` 与 `/security-review`）与本地 `/code-review` 命令（审 diff、报 correctness bug 与简化建议）。行业面：Stack Overflow 2025 调查 84% 开发者在用或计划用 AI、51% 每天使用，但**信任度降至 33-40% 区间**；Sonar State of Code 2025 称 42% 的提交代码含 AI 辅助。业界成熟做法是"AI 当第一道过滤器 + 人类终审 + 确定性门禁（类型检查/lint/测试）兜底"，且大量团队给 AI 生成代码加"变更行覆盖 ≥80%"之类的确定性闸门。噪声/误报（约 5-15% 的 false positive 报道）是主要抱怨点。
- **对标基准**：PR 流水线：确定性门禁（typecheck/lint/test/coverage）→ AI review（Copilot code review 或 claude-code-action，建议只读+评论模式，不给合并权）→ 人工终审；AI 建议不阻塞合并（advisory）为保守稳妥档。
- **来源**：
  - https://github.blog/changelog/2025-04-04-copilot-code-review-now-generally-available
  - https://code.claude.com/docs/en/code-review 、https://code.claude.com/docs/en/github-actions 、https://github.com/anthropics/claude-code-action 、https://github.com/anthropics/claude-code-security-review
  - https://survey.stackoverflow.co/2025/ai （84% 使用/计划、51% 日用）
  - https://shiftmag.dev/state-of-code-2025-7978 （42% 代码 AI 辅助）
  - https://dzone.com/articles/safe-vibe-coding-cursor-guardrails （changed-lines coverage ≥80% 门禁实践）
- **置信度**：高（平台 GA 公告 + 大样本调查）；**误报率 5-15% 一项为低置信**（来源为非权威站点，未见官方基准报告，标注缺口）；AI review 工具间效果对比（如 CodeRabbit vs Copilot recall 数字）各来源口径不一，**标注为争议/未定**。

---

### 主题 7：覆盖率实践（c8 vs Vitest coverage；阈值口径）

**7.1 工具选择**

- **结论**：c8（V8 原生覆盖、免插桩、Istanbul 兼容报告）是 node:test 生态的默认覆盖率方案且仍活跃维护；Vitest 内置 coverage 默认 V8 provider（速度与内存优于 Istanbul，官方称准确率已接近，但对分支覆盖的精度 Istanbul 更可靠——社区持续讨论是否把 Istanbul 设为默认）。node:test 自带 `--experimental-test-coverage`（截至 2026 仍带 experimental 标签）。趋势上 V8 覆盖因 SWC/Server Actions 等无法插桩的场景成为唯一可行项。
- **对标基准**：node:test 项目 → c8（配合 `--check-coverage`/`--100` 可做阈值）；Vitest 项目 → `@vitest/coverage-v8`（默认）或对分支覆盖数字有严格要求时切 `@vitest/coverage-istanbul`。
- **来源**：
  - https://github.com/bcoe/c8
  - https://vitest.dev/guide/coverage （V8 vs Istanbul 对比）
  - https://nodejs.org/api/test.html （--experimental-test-coverage）
  - https://about.codecov.io/blog/line-or-branch-coverage-which-type-is-right-for-you
- **置信度**：高（官方文档）；**缺口：c8 的最新版本号未能从检索结果确证**（仅确认活跃维护，Snyk 显示近期仍有发版）

**7.2 阈值口径：行覆盖仍是主口径，分支/变更覆盖在上升**

- **结论**：全局行覆盖阈值仍是业界最常见 KPI（2026 State of Testing：Test Coverage 仍以 56.4% 位居团队 KPI 第一），但前沿实践明显转向**分支覆盖 + 变更行（patch/diff）覆盖**：Codecov 官方建议行+分支并用；AI 编码普及后，"PR 变更行覆盖 ≥80%"作为防 AI 幻觉代码的门禁成为 2025-2026 的新兴模式。业界的另一共识是"覆盖率是卫生指标而非质量证明"，趋势是只对增量代码设硬门槛、对存量放宽。
- **对标基准**：CI 设 branch 覆盖阈值（而非只看 lines）；有条件则加 diff/patch coverage（如 80% 变更行）；全量阈值不追 100%。
- **来源**：
  - https://about.codecov.io/blog/line-or-branch-coverage-which-type-is-right-for-you
  - https://www.practitest.com/state-of-testing （KPI 分布）
  - https://dzone.com/articles/safe-vibe-coding-cursor-guardrails
- **置信度**：中-高（方向明确、多源一致，但"变更覆盖普及率"缺权威统计——**标注缺口**）

---

### 主题 8：Knip / dead code 治理、ts-blank-space / swc、monorepo

**8.1 Knip：dead code 治理的事实标准**

- **结论**：Knip 已是该赛道事实标准：官网自述 40M 下载/月、150+ 插件、monorepo/workspaces 一级支持；2025 年的对比文章（vs ts-prune）与 2026 年工程实践文章均把 Knip 列为默认选择（查未用文件/导出/依赖/缺依赖，替代了 ts-prune/depcruise 等单功能工具）。对标仓库用 knip 属于**已明确主流**。
- **对标基准**：knip 最新 6.x（npm 6.32.2，2026-08）；CI 可跑 `knip` 作 dead-code 门禁。
- **来源**：
  - https://knip.dev/ 、https://knip.dev/features/monorepos-and-workspaces
  - https://www.npmjs.com/package/knip
  - https://levelup.gitconnected.com/dead-code-detection-in-typescript-projects-why-we-chose-knip-over-ts-prune-8feea827da35
  - https://ona.com/stories/knip-automation （高流量仓库工程实践）
- **置信度**：高

**8.2 ts-blank-space / swc 构建位**

- **结论**：ts-blank-space（Bloomberg，用官方 TS 解析器把类型替换为空白、保留行列号从而生成完美 sourcemap）是"纯擦除"构建的代表，且被 TS 官方 5.8 博客点名与 Node 的 Amaro 同属一类；swc（Rust，被 Next.js/Parcel/Deno 采用）则是"需要转换/降级"时的主流编译器。2026 年的选型格局：可擦除语法子集 → Node 原生 strip / ts-blank-space（零转换）；需要 enum/tsx/降级 → swc/tsx；tsc 收缩为类型检查器 + 声明发射。
- **对标基准**：库的"无构建"分发可用 ts-blank-space 或 Node 24.12 原生 strip；应用构建用 swc 系工具链。
- **来源**：
  - https://bloomberg.github.io/ts-blank-space 、https://github.com/bloomberg/ts-blank-space
  - https://devblogs.microsoft.com/typescript/announcing-typescript-5-8 （官方点名 ts-blank-space/Amaro 同类限制）
  - https://swc.rs/ 、https://github.com/swc-project/swc
  - https://www.pkgpulse.com/guides/ts-blank-space-vs-node-strip-types-vs-swc-2026
- **置信度**：高

**8.3 Monorepo 工具（对本仓库：不适用，仅作参考基准）**

- **结论**：JS monorepo 工具 2025-2026 的主轴是 Nx vs Turborepo（任务编排/缓存/affected 检测）+ pnpm workspaces 做底层；单包仓库不需要引入。对标仓库为单包，**标注不适用**；若未来拆包，业界默认起点是 pnpm workspaces（+ 可选 Turborepo/Nx 做缓存）。
- **来源**：https://nx.dev/docs/kb/nx-vs-turborepo 、https://www.aviator.co/blog/monorepo-tools 、https://pnpm.io/blog/2025/12/29/pnpm-in-2025
- **置信度**：中-高（格局判断多源一致，但选型高度依赖团队规模，无唯一答案）

---

## 三档分级表

| # | 实践 | 档位 | 说明 |
|---|------|------|------|
| 1 | tsconfig `strict: true` | **已明确主流** | TS 6.0 起官方默认；不开即落后 |
| 2 | `noUncheckedIndexedAccess: true` | **已明确主流**（前沿位） | 专家共识推荐；官方未默认 |
| 3 | `exactOptionalPropertyTypes: true` | **争议/权衡** | 正确性收益 vs 迁移成本；库/新项目开，存量权衡 |
| 4 | TS ≥5.8 + `erasableSyntaxOnly`（对齐无构建） | **上升期** | Node strip types stable 后价值放大 |
| 5 | `isolatedDeclarations`（库）+ `--noCheck` 分离检查与 emit | **上升期** | 构建链现代化方向；应用仓库可选 |
| 6 | ESLint flat config（9→10） | **已明确主流** | 注意 ESLint 9 已于 2026-08-06 EOL，升 10 是硬性事项 |
| 7 | typescript-eslint 8 `recommended-type-checked` | **已明确主流** | 官方推荐起点 |
| 8 | typescript-eslint 8 `strict-type-checked` 全量 | **争议/权衡** | 官方定位为自愿加码，非推荐默认；类型感知 lint 有性能代价 |
| 9 | oxlint（Rust linter）进 CI | **上升期**（→快速主流化） | 1.0 已稳、速度 50-100x；分层策略（oxlint+ESLint）是当前甜点位 |
| 10 | node:test（内置 runner） | **已明确主流**（特定场景） | Node 库/轻量场景合理；Node 24 性能再提升 |
| 11 | Vitest 4 | **已明确主流** | State of JS 2025 增幅第一梯队；Jest 下滑 |
| 12 | fast-check PBT | **上升期** | 有官方 Vitest 集成；非全员默认 |
| 13 | engines 收紧到 Node ≥22 / ≥24 | **已明确主流** | Node 20 已 EOL（2026-04-30） |
| 14 | 运行时无构建（Node 24.12 type stripping / ts-blank-space） | **上升期** | stable 已至；tsx 在 watch/.tsx 场景仍不可替代 |
| 15 | npm provenance + trusted publishing（OIDC） | **已明确主流** | npm 已废弃 classic token（2025-12） |
| 16 | OSV-Scanner 进 CI | **已明确主流**（开源免费位） | npm audit 补充位已成共识 |
| 17 | lockfile 治理（lockfile 入库 + lint + 机器人更新） | **已明确主流** | 基础卫生 |
| 18 | SBOM（Syft/Grype 等） | **上升期** | 合规驱动；中小仓库非必须 |
| 19 | AI 首轮 code review（Copilot/Claude Code） | **已明确主流**（平台位）/ **争议**（是否阻塞合并） | 平台已 GA；门禁权重仍争议，业界保守做法是 advisory |
| 20 | 覆盖率看行 | **已明确主流**（但正在被削弱） | 仍是第一 KPI |
| 21 | 覆盖率看分支 + 变更行（patch coverage） | **上升期** | AI 代码门禁驱动的新趋势 |
| 22 | Knip dead-code 治理 | **已明确主流** | 40M 下载/月，事实标准 |
| 23 | swc 构建链 | **已明确主流**（框架内）/ 上升期（直接使用） | Next.js/Parcel/Deno 底座 |
| 24 | Monorepo 工具（Nx/Turborepo） | **不适用**（单包仓库） | 未来拆包再评估 pnpm workspaces |

---

## 对本仓库可直接套用的基准清单

对标对象：TypeScript 5 ESM + Node≥20 + ESLint 9 flat + node:test + c8 + knip。以 2026-09 前沿基准衡量，分「必须修」「应跟进」「可选加分」三档：

### P0 必须修（低于 2026 基线）

1. **engines.node 从 `>=20` 升到 `>=22`（理想 `>=24`）**——Node 20 已于 2026-04-30 EOL，不再收安全补丁。若要用原生 type stripping 的 stable 形态，基准是 24.12+。
2. **ESLint 9 → ESLint 10**——v9.x 已于 2026-08-06 EOL；typescript-eslint 8.69+ 已支持 `^10`，flat config 基本平移，改用 `defineConfig` + `extends` 官方写法。
3. **确认 tsconfig `strict: true` 且补 `noUncheckedIndexedAccess: true`**——后者是 2025-2026 前沿仓库的标配项；TS 版本建议至少 5.8（拿 `erasableSyntaxOnly` 和 build 模式 `--noCheck`），可评估直上 6.0（strict 默认、为 7.0 铺路）。

### P1 应跟进（升到当代主流）

4. **lint 分层**：CI 加 oxlint（秒级，全量每次跑）+ typescript-eslint 8 `recommended-type-checked` + `stylistic-type-checked`（PR 级跑 typed 规则）；`strict-type-checked` 仅按团队口味逐条加，不作为"业界默认"背书。
5. **CI 挂 `google/osv-scanner-action`（定时扫描）+ `npm audit --production`**；lockfile 保持入库并可用 lockfile-lint 校验。
6. **若发包：发布流改 GitHub Actions + npm trusted publishing（OIDC）+ `npm publish --provenance`**（classic token 已废弃）。
7. **覆盖率口径升级**：c8 保留可用（node:test 生态正确选择），但阈值从"只看行"升级为"lines + branches 双阈值"；有能力再加 PR 变更行覆盖 ≥80% 的门禁（AI 代码时代的关键闸门）。
8. **Knip 升级到 6.x 并纳入 CI**（dead-code 门禁；当前栈选型正确，保持更新即可）。

### P2 可选加分（前沿位）

9. **PBT**：对解析器/序列化/纯函数模块引入 fast-check 4 +（若迁移 Vitest）`@fast-check/vitest` 的 `test.prop`。
10. **测试栈去留决策**：node:test 在轻量场景可继续持有（上升期、零依赖）；若项目长出 mock/browser/watch/视觉回归需求，迁移 Vitest 4 是主流方向（State of JS 2025 增幅第一）。
11. **无构建路径**：tsconfig 加 `"erasableSyntaxOnly": true` 锁死可擦除子集；Node 24.12+ 下脚本可 `node file.ts` 直跑；tsx 仅保留给 watch/.tsx；库分发可评估 ts-blank-space。
12. **AI 首轮 review**：接入 Copilot code review 或 `anthropics/claude-code-action`（advisory 模式、不阻塞合并），作为确定性门禁之后的第二道过滤器；人类终审保留。

### 诚实标注的缺口

- **未找到**：fast-check 的权威采纳率统计；AI review 误报率的权威基准（5-15% 来自非权威来源，低置信）；c8 最新版本号（仅确认活跃维护）；变更覆盖（patch coverage）在业界的普及率统计。以上均不作为硬基准引用。

---

*本文件所有 URL 均来自实际检索结果；版本号与日期以来源页面为准。*
