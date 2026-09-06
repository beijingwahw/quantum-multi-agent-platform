# 工程基建与 CI 审计（主线亲审）

> 审计人：主线（原派外两轮均因网关重启失败；本半区配置文件不大，主线全读完成）
> 范围：package.json、tsconfig.json、tsconfig.typecheck.json、eslint.config.mjs、.prettierrc.json、knip.json、.github\workflows\ci.yml、.gitignore、.editorconfig
> 交叉引用：subagent_04.md（2025-2026 前沿对标基准，含来源 URL）

## 现状盘点（配置矩阵）

| 维度 | 现状 | 2026 基准 | 差距 |
|---|---|---|---|
| TS 严格度 | strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + verbatimModuleSyntax + noUncheckedSideEffectImports | 同左 | ✅ 已达标（头部水平） |
| Lint | ESLint 9 flat + tseslint 8 recommendedTypeChecked + 15 条加严 | ESLint 10（9 已 EOL） | ⚠️ 版本过期 |
| Node 引擎 | engines >=20；CI 矩阵 20/22/24 | >=22（Node 20 已于 2026-04-30 EOL） | ⚠️ 下限踩 EOL 版本 |
| 测试 | node:test + tsx + c8 阈值 92/82/92/92 | 同左（node:test 已主流化） | ✅ |
| 死代码 | knip 门禁入 CI | 同左 | ✅（细节见 K2） |
| 格式 | prettier 3 + format:check 入 CI | 同左 | ✅ |
| CI 矩阵 | 2 OS × 3 Node = 6 单元格 | 同左 | ✅ 广度好 |
| 供应链 | 仅 npm ci（lockfile 锁定） | OSV/audit/provenance 至少一项 | ❌ 缺失 |
| 依赖更新自动化 | 无 dependabot/renovate 配置 | 至少 dependabot.yml | ❌ 缺失 |

## 发现清单

| # | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|---|---|---|---|---|
| I1 | P1 | package.json engines.node ">=20" | Node 20 已于 2026-04-30 EOL，允许的最低版本不再收安全补丁；「支持 EOL 运行时」本身就是质量负债 | subagent_04 主题 4（Node 22/24 LTS 时间线） | engines 升为 ">=22.11"（或 ">=24"），CI 矩阵去掉 20、加 24（已有）；README 徽章同步 |
| I2 | P1 | package.json devDeps eslint "^9.39.5"、@eslint/js "^9.39.5" | ESLint 9 已于 2026-08-06 EOL；9 系不再收修复。typescript-eslint 8.69 已声明支持 ^10，升级无生态阻塞 | subagent_04 主题 2（ESLint 10 发布与 9 EOL，官方博客） | 升 ESLint 10 + @eslint/js 10；flat config 语法兼容，主要是规则移名清理；tseslint 8.69 可原地保留 |
| I3 | P1 | .github\workflows\ci.yml 全文 | CI 缺四类 2026 基线动作：① job 级 timeout-minutes（除示例外均无，挂起测试可烧满 6×360 分钟）② concurrency 取消同分支旧跑 ③ permissions: 最小化 GITHUB_TOKEN ④ 供应链扫描步骤（OSV-Scanner 或 npm audit --omit=dev 门禁）| subagent_04 主题 5；GitHub Actions 官方安全硬化指南 | 加 timeout-minutes: 15、concurrency 组、permissions: contents: read、加一步 osv-scanner 或 audit-ci |
| I4 | P2 | package.json description | 乱码（UTF-8 被按 GBK 解码的典型样貌）；prepublishOnly 存在意味着会原样发布到 npm | npm 元数据卫生 | 以 UTF-8 重写 description；顺带在 CI 加 `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` 已有 format:check 不覆盖此问题，建议加 npm pkg 检查或 encoding 门禁 |
| I5 | P2 | tsconfig.json compilerOptions | 三处可再进：① moduleResolution: "node"（node10 解析已过时，纯 ESM 包应 nodenext）② 无 isolatedDeclarations（库发 declaration，开了可并行/绕过 tsc 出 .d.ts）③ allowJs: true 但无 checkJs，且 tsconfig.typecheck.json include 了 examples/**/* —— .js 示例实际处于零类型检查状态 | subagent_04 主题 1（isolatedDeclarations、erasableSyntaxOnly 基准） | moduleResolution → nodenext（配 verbatimModuleSyntax 已就绪）；评估 isolatedDeclarations 迁移成本；examples 迁 .ts 或开 checkJs |
| I6 | P2 | ci.yml 步骤编排 | build 产物（dist/）构建后无任何冒烟验证——test 走 tsx 源码运行，prepUBLISH 的 dist 从未被测试执行；「绿色 CI ≠ 发布物可用」 | 构建产物验证实践 | build 后加 `node --test dist-smoke`（或最少 node -e "import('./dist/index.js')"）；示例冒烟改跑 dist 版一次 |
| I7 | P2 | .github\ 无 dependabot.yml / renovate.json | 依赖更新全靠手工；ws/typescript-eslint 这类安全修复无法自动跟进 | 2026 仓库默认件 | 加 dependabot.yml（npm 周更 + actions 周更）或 renovate.json |
| I8 | P3 | package.json 无 "exports"、"files"、"sideEffects" | main: dist/index.js 是 2015 式单入口发布；无 exports map（子路径不可控）、无 files 白名单（npm pack 可能带上 tests/experiments）、无 sideEffects 声明（消费方 tree-shaking 受损）| 现代 npm 包规范 | 加 exports（"." + types）、files: ["dist"]、sideEffects: false（需验证 qpu/index.ts 顶层 registerBackend 副作用——有则该文件标 sideEffects: true）|
| I9 | P3 | knip.json entry 数组 | 未列 src/index.ts（包主入口）。knip 的可达性经 examples 间接成立所以 CI 不报错，但「npm 公共 API 面」没有作为 entry 显式锚定：将来删掉某个 example，对应的公共导出会被误报/或反之漏报 | knip 官方 entry 语义 | entry 加 "src/index.ts"；本地复跑 knip 验证无新报（本条建议先验证再合入） |
| I10 | P3 | package.json devDeps typescript "^5.1.6" | 版本下限允许 5.1，但 tsconfig 用了 noUncheckedSideEffectImports（TS 5.6+ 引入）——若真装到 5.1 会直接配置报错。实际 npm 装最新 5.x 所以没炸，下限是假的 | 语义化版本诚实性 | typescript 下限提到 ^5.6.0 |
| I11 | P3 | ci.yml Coverage 步骤 | 覆盖率只有总量阈值门禁，无 PR 变更行覆盖（changed-lines coverage）；无 coverage artifact 上传（失败时无法看明细）| subagent_04 主题 7 | 保留总量门禁；加 coverage artifact upload +（可选）diff-cover 类工具做变更行覆盖 |
| I12 | P3 | .gitignore | 基本齐整（qaoa_schedule.py 生成物也盖住了）；小缺口：无 .nyc_output/、无 .DS_Store（macOS 协作者）。.editorconfig 对 *.ps1 的 crlf 例外处理得很细，值得表扬 | 通用卫生 | 补两行 |

## 配置面优点（保留）

1. **tsconfig 严格度第一梯队**：noUncheckedIndexedAccess + exactOptionalPropertyTypes + verbatimModuleSyntax + noUncheckedSideEffectImports 全开，超过绝大多数开源 TS 仓
2. **覆盖率+死代码双门禁进 CI**：c8 阈值 92/82/92/92 与 knip 都是硬门禁，且双 OS 验证——门禁文化成熟
3. **eslint.config.mjs 的分区策略**：src 全纪律、tests/examples/experiments 定向豁免并逐条写理由注释——工程判断而非一刀切
4. **示例冒烟进 CI 且钉超时**：basic+advanced 全链路跑一次，5 分钟超时保护
5. **.editorconfig 的 ps1/crlf 例外**：Windows 协作细节到位

## Top3 升级建议（本半区）

1. **EOL 栈清理**（I1+I2+I4）：Node 引擎下限、ESLint 9→10、description 乱码——三件都是小时级工作量、直接消除「一开门就是过期栈」的第一印象
2. **CI 硬化**（I3+I6+I7）：timeout/concurrency/permissions/供应链扫描 + dist 冒烟 + dependabot——把 CI 从「跑得全」升级到「跑得安全且验证发布物」
3. **包元数据现代化**（I8+I10）：exports/files/sideEffects + 真实的 typescript 下限——发布质量与消费方体验
