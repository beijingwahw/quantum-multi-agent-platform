# 实验、示例与文档一致性审计

> 审计对象：`D:\multi-agent\ds_extracted\ds`（quantum-multi-agent-platform v1.10.0，TypeScript ESM）
> 审计人：subagent_06（实验/示例/文档维度）| 时间：2026-09-05
> 范围：experiments\、examples\、scripts\、web-console\index.html、根目录文档、.gitignore

## 现状盘点

### experiments\（2 个实验、4 个 TS 文件 + 结果数据）
- `llm-learning-curve/`：dataset.ts（44 张工单 + 声明式词表审计 labelAudit）、run.ts（真实 glm-4-flash 调用，treatment/control 双臂，RUNS×44 任务，并发信号量 + 指数退避重试，JSONL 增量落盘 + JSON 汇总）；含 results.json / results-implicit.json / results.jsonl 等结果文件。
- `train-vs-hire-phase/`：run.ts（(α,β) 网格扫描，模拟臂 + 闭式理论 + ASCII 相图，固定 SEEDS=100..111）、scaling-law.ts（L1-L4 闭式定律 + Buckingham π 标度 + 读 LLM 结果文件拟合标定）。
- 实验代码质量整体较高：种子显式（mulberry32(1000+run) / 9000+run）、数据代码分离（dataset.ts 独立）、控制臂设计（corrupt 破坏标签保持提示形状）、注释把争议决策写进文件头。

### examples\（8 个示例）
- basic-usage.js、advanced-workflow.js（.js，经 tsx 运行）；quantum-breakthrough-benchmark.ts (20K)、qpu-real-hardware.ts (8K)、proactive-intelligence-demo.ts (16K) 及其余基准（待逐一盘点）。

### scripts\
- dsh-proactive-install-to-dsh.mjs (22K)（安装脚本）、performance-test.mjs (0.7K)。

### 文档与配置
- README.md（双语、mermaid 图、含测试/覆盖率/knip 数据）；CHANGELOG.md、PROJECT_SUMMARY.md、项目清单.md；package.json v1.10.0；.gitignore。

## 发现清单（初步，持续追加）

| # | 严重度 | file:line | 问题 | 前沿标准依据 | 修复建议 |
|---|---|---|---|---|---|
| 1 | P1 | README.md:4 | version badge 写 1.7.0，package.json 实际 v1.10.0，徽章与版本演进 timeline 也只到 v1.7 | 文档-代码漂移是可维护性审计首要指标；npm 包页面以 README 为第一入口 | badge 改为动态 shields 或与 package.json 同步，timeline 补 v1.8–v1.10 |
| 2 | P1 | README.md:220 | “npm test # 281 用例全通过”，但 v1.10 CHANGELOG 若新增测试（需查 src/tests 审计方口径），数字可能过期；另 typecheck/lint/knip/coverage 的描述未标基准版本 | 前沿标准：文档中的量化声明必须可验证、可迫溯（如 CI badge 直接链接） | 测试数改用 CI badge（动态计数）或标注“以 CI 为准” |
| 3 | P2 | package.json:description | description 为中文“宏大多agent开发调度平台…”，对 npm 公共注册表不可检索（英文关键词缺失）；且“宏大”属自吹词汇 | npm 官方 package guidelines：description 面向搜索与展示 | 改英文描述 + 保留中文到 README；去除营销词 |
| 4 | P2 | package.json:keywords | keywords 含 “deepseek-harness”，但仓内主线是量子调度/市场机制，DSH 只是集成层；名不副实目缺少 “quantum-computing”等高频词 | npm 搜索优化最佳实践 | 重写 keywords：quantum / qaoa / multi-agent / scheduling / vcg 等 |
| 5 | P2 | package.json（无 files 字段）| 无 `files` 白名单，`npm publish` 会带上 experiments/results*.json、web-console、脚本等全部仓库内容 | npm files 字段最佳实践：库包应只发布 dist+types | 增加 files: ["dist", "README.md", "LICENSE"] 或确认仅内部使用并文档说明 |
| 6 | P2 | examples/basic-usage.js:5-14 | 示例硬编码端口 8081/8083，与 README 架构图 “WebSocket :8080” 不一致；多示例问时端口冲突无提示 | 可运行示例最佳实践：从 env 读取或冲突时自动避让 | 端口改 process.env.PORT ?? 808x，或在 README 说明 |
| 7 | P2 | examples/basic-usage.js:24 | `platform.getAgents().find((a) => a.name === 'Quantum Developer')` 可能返回 undefined，直接 .id 会抛 TypeError——但整个示例在 try 内且 catch 设 exitCode，可接受但脆弱 | TS strict 下 no-unnecessary-condition 会抓；.js 无类型保护 | 示例迁移 .ts（见 #10）后由编译器强制处理 undefined |
| 8 | P2 | examples/quantum-breakthrough-benchmark.ts:40-60 | 自带一个本地 rng（mulberry32 变体），与 src/utils/rng.ts 的 mulberry32 重复实现且种子处理不同（>>> 0 vs 直接）；experiments 用共享库，examples 却复制 | DRY + 单一真相源；项目自巴 v1.5 就强调“共享内核去重（RNG）” | 统一 import { mulberry32 } from '../src/utils/rng.js' |
| 9 | P2 | examples/qpu-real-hardware.ts:149-150 | `writeFileSync('qaoa_schedule.py', program)` 写到 CWD 而非脚本目录；从仓库根 npm run example:qpu 会污染根目录，且无 .gitignore 覆盖 qaoa_schedule.py | 前沿标准：生成物不污染仓库根；应写 examples/ 下或临时目录 | 改为 path.join(HERE, 'qaoa_schedule.py') 或写入 os.tmpdir()；.gitignore 补充 |
| 10 | P2 | examples\（basic-usage.js、advanced-workflow.js）| 两个 .js 示例无类型检查（typecheck 脚本只覆盖 src+tests+examples 但 eslint 对 .js 也宽松），示例 API 误用只能靠运行时发现 | TypeScript 项目示例迁移 .ts 是主流实践（tsx 无雷运行成本） | 重命名为 .cjs/.ts 并纳入 typecheck；至少补 JSDoc 类型 |
| 11 | P1 | experiments/llm-learning-curve/run.ts:47 | `MODEL = process.env.GLM_MODEL ?? 'glm-4-flash'`，但 results-implicit.json 里记录的 model 字段是否与 README 宣称的实测数据一致待核（README: “真实 glm-4-flash，n=2112”）但 dataset.ts 头注释说 44 工单 × RUNS 默认 12 × 2 conditions = 1056 次评测/组，scaling-law.ts 头注也称 1056；README 与实验代码口径不一致（2112 vs 1056）| 实验可复现性：n 必须与结果文件对得上 | 核对 results.jsonl 行数，统一 README/代码注释口径 |
| 12 | P2 | experiments/train-vs-hire-phase/run.ts:215 | `if (process.argv[1]?.endsWith('run.ts'))` 判定直接执行；但 scaling-law.ts 从 './run.js' import counterfactual 等，若 tsx 直接执行 scaling-law.ts，run.ts 的 main 不会触发（正确），但 run.ts 顶部 import 了 BatchVCGScheduler，scaling-law 间接触发整个网格扫描——双重 import 执行非预期副作用的隐患 | ESM 最佳实践：入口判定用 import.meta.url 检查 process.argv[1] 文件路径 | 改为 fileURLToPath(import.meta.url) === process.argv[1] 模式（run.ts 与 scaling-law.ts 都是） |
| 13 | P3 | experiments/llm-learning-curve/run.ts:76-77 | Semaphore.acquire 实现有细微 bug：await 挂起后 resolve 时 active++ 再执行，但 release() 先 active-- 再唤起下一个——队列唤起的协程会在 release 之后的微任务里才 active++，短时间内 active 计数可能短暂超过 limit+1 并发窗口（逻辑上限浮动 1）；实际影响小但与“严格并发上限”的声明不符 | 并发控制正确性：信号量应保证任意时刻 active ≤ limit | acquire 恢复路径改为在唤起前补计数或用成熟库（p-limit） |
| 14 | P2 | experiments/llm-learning-curve/run.ts:281 | `fs.writeFileSync(JSONL, '')` 每次真实运行覆盖旧 JSONL —— 优点是防陈旧数据混入（注释已说明），但这也意味着多次运行无法累积样本扩大 n；且 crash 中途会留下半截文件，重跑会覆盖，历史丢失 | 实验可复现性：结果文件应版本化（带时间戳/run id）或 append + 运行元数据行 | 每次运行写入 results-<timestamp>.jsonl，或 JSONL 首行写入运行元数据（model/时间/种子）供 analyze 区分 |
| 15 | P2 | experiments/llm-learning-curve/run.ts:31-34 | 环境变量 RUNS/CONCURRENCY/GLM_MODEL 均无上限校验，RUNS=1000 或 CONCURRENCY=100 会直接打爆 API 配额；温度 0.7 硬编码不可配置 | 前沿标准：实验脚本参数应有合理边界与 CLI 参数化（而非仅 env） | 加 clamp + 命令行参数支持 |
| 16 | P2 | experiments/train-vs-hire-phase/run.ts:24-40 | 实验参数（q0/delta/K/T）硬编码在 run.ts 内部（PHASE_DEFAULTS），与结果文件无版本链路——重跑或改参数后旧结论无法追溯对应代码版本 | 可复现性：参数-结果-代码三向链接（如记录 git commit + 参数快照进结果文件） | 输出结果时同时落盘参数快照与 git rev |
| 17 | P1 | examples/qpu-real-hardware.ts:127 | 与 README:219 “接入真机三步：set DWAVE_API_TOKEN=*** → npm run example:qpu” 一致 ✓，但 README 快速开始中只列了 example:quantum / example:qpu，而 package.json 还有 example:basic / example:advanced 未在 README 任何地方提及 | 文档完备性：所有 npm scripts 示例入口应在 README 可发现 | README 快速开始补两个基础示例 |
| 18 | P2 | scripts/dsh-proactive-install-to-dsh.mjs:9 | 文件头写死“落地位置：C:\Users\molly\dsh-proactive\scripts\install-to-dsh.mjs”——开发者个人绝对路径出现在仓库脚本里，且该路径与仓库实际位置（ds/scripts/）不一致 | 可维护性：仓库内不应出现个人机器路径；路径成环境差异应运行时检测 | 删除个人路径注释，改为相对说明 |
| 19 | P2 | scripts/dsh-proactive-install-to-dsh.mjs:365-378 | 入口判定 `process.argv[1].endsWith('dsh-proactive-install-to-dsh.mjs')`：若未来改名（如重命名回 install-to-dsh.mjs，头部注释还在田用旧名）静默失效；且 postinstall 判定依赖 npm_lifecycle_event 存在性，pnpm/yarn 之外的包管理器或直接 node 运行时语义不一致 | 入口判定标准：import.meta.url vs argv[1] 规范化比较 | 统一用 fileURLToPath(import.meta.url) === resolve(argv[1]) |
| 20 | P1 | scripts/dsh-proactive-install-to-dsh.mjs:31-34 | 头注释声称“postinstall：npm/pnpm 在 install 时自动调用（已在 package.json 配）”，但本仓 package.json scripts 里 **没有** postinstall 钩子（当前只有 build/test/lint 等）——安装脚本头注释与 package.json 事实不符，文档-代码漂移 | 注释即契约：声明的行为必须与实际配置一致 | 补 package.json postinstall 或删除该声明 |
| 21 | P2 | scripts/dsh-proactive-install-to-dsh.mjs:206-216 | buildPnpmDepSpec 在 Windows 上把反斜杠替换为正斜杠得到 `file:D:/...`，注释声称符合语义；但 pnpm 官方对 Windows file: 协议要求 `file:file:///D:/...` 或相对路径形式，跨 pnpm 版本行为不稳（v7 vs v9 对 file:D:/ 解析不一致） | pnpm 官方文档：本地路径依赖推荐 file:<relative> 或正确的三斜杠 URL | 用 path.relative(profileDir, pluginRoot) 生成相对 file: spec，避开盘符歧义 |
| 22 | P3 | scripts/dsh-proactive-install-to-dsh.mjs:14-22 | DEFAULT_PROFILES=['web','headless'] 硬编码默认目标；若用户 DSH 安装的 profile 名不同（如 default/main），install 默认空转 skipped | 脚本鲁棒性：默认值应适应真实环境或提示用户 --profiles | 无匹配时列出可用 profiles 并给出命令示例（当前只警告了，还算合格，降 P3） |
| 23 | P2 | web-console/index.html:475-477 | XSS 面：agent.name、agent.capabilities、task.name、task.type、task.status 均经 escapeHtml 后插入 innerHTML ✓，且状态类名拼接也转义 ✓；但 `style="width: ${Number(agent.load) || 0}%"` 用 Number() 强转——若 load 为字符串 "50a" 得 NaN→0 安全；但 agent.state 若为恶意字符串（如含空格的 class 注入）escapeHtml 后 class 属性内仍可逃逸（escapeHtml 不转义空格，class 注入非安全风险但破坏 UI） | OWASP XSS Prevention Cheat Sheet：HTML 转义应覆盖属性上下文 | 状态/优先级用白名单映射（state → fixed class）而非直接拼接 |
| 24 | P2 | web-console/index.html:460-462 | `alert('请输入总线地址')` 等 alert 仍在使用；失败时 ws.onerror 只设状态不提示错误详情；无 token 鉴权失败的区分提示（总线 4001 断开被当成普通断线走 5s 重连死循环） | 现代 Web UX 标准与 WebSocket 鉴权错误处理 | onclose 时检查 code（4001=鉴权失败则停止重连并提示），alert 改 inline 提示 |
| 25 | P3 | web-console/index.html（单文件 28K）| 单文件 700+ 行混合 CSS/HTML/JS，无版本号、无 CSP meta、无构建拆分；对当前体量向可维护，但再增长就会失控；canvas 图表自绘（合理避免依赖）但无 resize 适配（canvas 固定 400×160，窗口缩放变形） | 单文件控制台的可维护性阈值；CSP 是 XSS 纵深防御 | 加 `<meta http-equiv="Content-Security-Policy">`（default-src 'self' + connect-src ws:）；canvas 尺寸响应式 |
| 26 | P3 | .gitignore | 覆盖 node_modules/coverage/dist/.env/*.log/qaoa_schedule.py ✓（qaoa_schedule.py 已覆盖 #9 的生成物），但缺 `*.tsbuildinfo` 已有 ✓；缺常见项：`.DS_Store`、`Thumbs.db`、`*.tgz`（npm pack 产物）、`.idea/`、`.vscode/`（团队共享配置除外） | GitHub 官方 Node.gitignore 模板 | 补齐 OS/IDE 噪声项 |
| 27 | P3 | scripts/performance-test.mjs:19 | 硬编码端口 8082，与 basic(8081)/advanced(8083) 各占一个端口且无 env 覆盖；.mjs 后缀但 import 的是 TS 源码（../src/performance/benchmark.js）——说明该脚本必须经 tsx 运行（package.json performance 脚本也是 tsx）✓ 一致，但扩展名 .mjs 会误导读者以为可直接 node 运行 | 脚本命名应反映运行时要求 | 改名 performance-test.ts 或在文件头注明必须 tsx |

## 文档-代码漂移对照表

（待补）

## Top3 升级建议

（待补）
