# Web Console v2 架构设计（只设计，不实施）

> 状态：设计稿（R14 创新波产出）。本文档不含任何已实施的代码变更；所有
> 「v2 将…」均为设计意图。现状锚点全部给出 file:line，读者可对照核实。
>
> 现状基线：`web-console/index.html`（单文件，1031 行，下称 **v1**）。
> 平台侧协议基线：`src/communication/quantum-bus.ts`（PROTOCOL_VERSION = 1，
> quantum-bus.ts:107）、`src/index.ts` 的控制台协议段（index.ts:328-459）。

---

## 0. 为什么是 v2

v1 是一份合格的最小监控面板：单文件、零外部资源、CSP 收紧、XSS 消毒、
R13 性能手法（元素缓存 / innerHTML 批量 / Map 索引）都做了。但它有三个
结构性天花板：

1. **单文件不可分工**：样式 383 行 + 标记 118 行 + 脚本 526 行挤在一个
   文件里，任何两人同时改都会冲突；脚本无法被测试（没有模块边界，函数
   互相踩全局）。
2. **数据面只有「整快照」一种粒度**：平台侧每 100ms 合并广播一次完整
   `ConsoleSnapshot`（index.ts:368-386），前端每帧整段 innerHTML 重建
   agents/tasks 列表（index.html:814-851）。agent 到 50、任务到 200 上限
   （index.ts:340）时，浪费的是 O(全量) 的序列化 + 解析 + DOM 重建。
3. **平台最核心的调度过程完全不可见**：量子批调度、纠缠耦合、λ-bisection
   影子价格、VCG 支付、保留价准入——这些平台真正的机制面在 v1 里只剩
   `entanglementCount` 一个数字（index.ts:160）和一条装饰性的粒子动画
   （index.html:754-764）。

v2 的目标：**模块化的、可测试的、差分流的、能把调度机制画出来的控制台**，
同时修复一个真实的数据语义缺陷（§1.2-L1）。

---

## 1. 现状盘点（v1 逐段通读结论）

### 1.1 能力清单（保留项——v2 必须全数继承）

| # | 能力 | 现状锚点 |
|---|------|----------|
| C1 | WebSocket 连接 + 可选令牌鉴权（`authenticate`，4001 断开不进重连死循环） | index.html:601-659 |
| C2 | 双数据通道：`console_query` 轮询兜底（5s）+ `status_update` 推送 | index.html:626,1005-1016 |
| C3 | 远程命令 `console_command`：`submit_task` / `add_agent` / `complete_task`（平台侧 index.ts:333-450，含 priority/requirements 校验） | index.html:709-715,922-975 |
| C4 | 离线演示模式（未连接时的模拟数据演化） | index.html:509-582,977-1002 |
| C5 | 五指标卡 + agents 列表（状态点/能力/负载条）+ tasks 列表（最近 20 条倒序）+ 效率历史 canvas 折线（40 点） | index.html:395-451,800-903 |
| C6 | CSP 最小充分（`object-src 'none'`、`base-uri 'self'`、connect-src 放行 ws/wss） | index.html:6-17 |
| C7 | XSS 三层消毒：`escapeHtml`（文本）/ `classToken`（class 注入）/ `priorityToken`（优先级白名单） | index.html:768-791 |
| C8 | R13 性能手法：`$id` 元素缓存、innerHTML 单次拼接、agentId→name Map、canvas/ctx 缓存、图表容器自适应 | index.html:793-798,811-851,860-919 |

### 1.2 限制与债务（v2 的立项理由）

- **L1（语义缺陷，必须修）— 离线降级静默吞掉「已连接但空平台」**：
  `currentData()`（index.html:718-751）以 `connected && snapshot.agents.length > 0`
  作为使用实时数据的条件。后果：用户连上了一个刚启动、还没有注册任何
  agent 的平台时，**屏幕显示的是 4 个虚构 agent 与 4 个虚构任务的演示
  数据**，而状态条却亮着绿色的「已连接实时平台」（setConnected(true)，
  index.html:686-689）。演示与真实不可区分，这在监控工具里是最恶劣的
  谎言形态：不是没有数据，而是**用假数据冒充真数据**。
- **L2 — 快照无差分、渲染无增量**：见 §0 第 2 点。且 `status_update`
  推送与 5s 轮询可能同帧双触发，`updateDashboard` 无脏检查。
- **L3 — 命令无应答**：`sendCommand` 只知道「ws 开着」，不知道平台是否
  执行、为何失败（平台侧校验失败只写日志，index.ts:452-458）。用户提交
  一个非法 priority 的任务，UI 无任何反馈。
- **L4 — 协议版本未被消费**：总线在 `connection_ack` 里已携带
  `protocolVersion: 1`（quantum-bus.ts:485-498），v1 收到后直接丢弃。
  未来任何字段变更都没有协商面。
- **L5 — 单文件不可测试/不可分工**：全部状态是模块级全局变量（ws、
  connected、snapshot、simulation…index.html:504-582），无法单测，无法
  tree-shake，无法两人并行开发。
- **L6 — 调度机制不可见**：ConsoleSnapshot 只有聚合结果（metrics.scheduler
  的 pendingTasks/completedTasks/quantumEfficiency 等），批组成、纠缠对、
  定价过程零暴露。`entanglementCount`（index.ts:160）是唯一机制痕迹且
  v1 前端根本没渲染它。
- **L7 — 演示数据不可复现**：离线模拟与 `refreshData` 用未种子的
  `Math.random()`（index.html:987-999），同一会话两次刷新结果不同，无法
  做视觉回归对拍。
- **L8 — 自动完成任务（auto-complete 定时器）混在监控端**：监控工具代
  执行业务动作（complete_task，index.html:1018-1027）是角色越界，且与
  真实执行者可能竞争同一任务。

---

## 2. v2 目标与非目标

**目标**

- G1 模块化：可测试、可分工；发布形态仍满足「打开一个文件就能用」。
- G2 快照差分流：增量更新 + 严格回退路径；50 agent / 200 任务下的帧成本
  与变更规模成正比，而不是与总量成正比。
- G3 调度过程可视化：纠缠批组成、影子价格/准入（λ/μ/保留价）两类面板。
- G4 命令面板（Ctrl+K）＋命令应答（ack）闭环。
- G5 修复 L1：数据来源三态化（live / demo / stale），provenance 永远可见。
- G6 协议版本协商消费化（建立在既有 connection_ack 之上，不新开信道）。

**非目标（明确不做）**

- 不引入前端框架 / 构建链依赖（React/Vue/打包器）：平台宪法「零新依赖」，
  v2 用原生 ES Modules + 一个零依赖的发布期拼装脚本。
- 不改变 v1 的部署承诺：`web-console/index.html` 继续可用直至 v2 收口。
- 不在本设计里实施任何平台侧代码（差分协议、遥测事件都是平台侧的
  **提案**，标注为「待平台侧采纳」）。
- 不做鉴权模型升级（继续单令牌；多角色/只读令牌留给 v3）。

---

## 3. 总体架构

### 3.1 模块分解（dev 形态）

```
web-console-v2/
  src/
    main.ts                 # 组装点：依赖注入，唯一的全局副作用入口
    bus/
      connection.ts         # ws 生命周期 + 重连状态机（§3.3-S）
      protocol.ts           # 消息编解码 + 版本协商（§4.1）+ ack 关联（§4.3）
      snapshot-store.ts     # 快照状态 + 差分应用 + 新鲜度状态机（§3.3-D）
    data/
      demo-source.ts        # 演示数据源（种子化，可复现；修复 L7）
      selectors.ts          # 纯函数：snapshot → 视图模型（可单测）
      diff.ts               # 快照 diff 算法（与平台侧共享同一规格）
    views/
      metrics-card.ts       # 五指标卡
      agent-list.ts         # 增量渲染的 agent 列表（key-based）
      task-list.ts          # 增量渲染的任务列表
      efficiency-chart.ts   # 多序列折线（效率/健康/队列深度）
      entanglement-panel.ts # 纠缠批面板（§5.1）
      pricing-panel.ts      # 影子价格/准入面板（§5.2）
      provenance-bar.ts     # 三态数据来源条（§6）
      command-palette.ts    # 命令面板（§5.3）
    security/
      sanitize.ts           # escapeHtml/classToken/priorityToken（C7 下沉为模块）
  release/
    build-single-file.mjs   # 零依赖拼装脚本：内联全部模块 → dist/index.html
  tests/                    # node:test，模块级单测（selectors/diff/protocol）
```

**边界纪律**：`bus/` 不碰 DOM，`views/` 不碰 WebSocket，`selectors` 是
纯函数。`main.ts` 是唯一允许同时 import 两者的文件。这套边界让
`selectors.ts` / `diff.ts` / `protocol.ts` 可以在 node:test 下直接单测
（v1 的 L5 从根上消除）。

**发布形态**：`build-single-file.mjs` 做三件事——(a) 把各模块按 import 图
拓扑排序内联进一个 `<script type="module">`；(b) 对内联脚本计算 SHA-256，
生成 `script-src 'sha256-…'` 的 CSP（替代 `'unsafe-inline'`，收紧 C6）；
(c) 把样式内联进 `<style>`（同理可用 `style-src 'sha256-…'`）。产物仍是
**一个 html 文件、零外部资源、零网络请求**——v1 的部署承诺不变，
`file://` 直开不变。

### 3.2 数据流图（文字版）

```
┌─ 平台侧（现状 + v2 提案，虚线为提案） ─────────────────────────────┐
│  QuantumPlatform                                                     │
│   ├─ broadcastConsoleSnapshot() 100ms 节流 ──┐                       │
│   ├─ console_query 应答（即时）──────────────┤                      │
│   ├─ handleConsoleCommand ──┐                │                      │
│   │                         │（提案：命令应答）│（提案：差分）         │
│   └─（提案）scheduling telemetry 事件 ────────┤                      │
└─────────────────────────────┼────────────────┼──────────────────────┘
                              ▼                ▼
                       ┌─ QuantumBus（ws）─────────────┐
                       │ connection_ack {protocolVer}  │
                       │ status_update {snapshot|diff} │
                       │ console_response {ackId,…}    │（提案）
                       │ scheduling_telemetry          │（提案）
                       └───────────────┬───────────────┘
                                       ▼
┌─ 控制台 v2 ─────────────────────────────────────────────────────────┐
│ connection.ts ──(open/close/ack)──▶ protocol.ts                     │
│     │                                │  ▲                           │
│     │ (msg)                          ▼  │(send: query/command)      │
│     │                          snapshot-store.ts                    │
│     │                           ├─ apply(diff|full) ─▶ store        │
│     │                           └─ freshness tick（新鲜度状态机）    │
│     │                                │                              │
│     │        ┌── demo-source.ts ─────┤（仅 demo 态注入）             │
│     │        ▼                       ▼                              │
│     │     selectors.ts（纯函数：store → ViewModel）                   │
│     │        │                                                       │
│     │        ▼（单向数据流：ViewModel 进，DOM 出）                    │
│     │     views/*（增量渲染：按 key diff DOM，不整段重建）            │
│     │        ▲                                                       │
│     │     command-palette.ts ──▶ protocol.ts.send(command, ackId)   │
│     │                    ▲── console_response(ackId) 闭环（§4.3）   │
└──────┴───────────────────────────────────────────────────────────────┘
```

要点：store 是唯一可变状态源；views 永不直接读 bus；demo 数据源与实时
数据源在 store 入口处**同构注入**（同一 ViewModel 形状），从架构上保证
「切换数据源不换渲染代码」——这也是 §6 修复 L1 的机制基础。

### 3.3 状态机（三台，各自独立、可组合）

**S：连接状态机（connection.ts）**

```
            connect() ok                close(1006/1011 等瞬态)
  DISCONNECTED ───────▶ CONNECTED ─────────────▶ RECONNECT_WAIT
      ▲                    │  │                        │
      │  close(4001)       │  │ authTimeout            │ 指数退避 1s→2s→…→30s
      │  （鉴权失败，       │  │（提案）                │ （上限后停在 30s 周期）
      │   不重连，L1 同款）  │  ▼                        │
      └────────────────────┴ CONNECTING_AUTH           │
                             │  authenticate →          │
                             │  connection_ack(ver) ────┤
                             │  （版本协商 §4.1）        │
      手动 disconnect() ◀────┴──────────────────────────┘
```

与 v1 的差异：v1 的「已连接」在 `ws.onopen` 就置位（index.html:615-628），
把「socket 通了」与「鉴权过了」混为一谈；v2 把 CONNECTING_AUTH 单列，
只有收到 `connection_ack` 才进 CONNECTED。

**D：数据新鲜度状态机（snapshot-store.ts）——L1 修复的核心**

```
                 收到 full/diff 快照（无论 agents 是否为空）
   DEMO ──────────────────────────────▶ LIVE
   （未连接或用户                        │  │
     显式切演示）                        │  │ 超过 2×推送周期(或10s)
                                       │  │ 无任何快照
        用户显式切回演示 / 断线且无缓存  │  ▼
   DEMO ◀──────────────────────────── LIVE ──▶ STALE
                                          ◀──── 收到新快照即回 LIVE
   LIVE_EMPTY：LIVE 的子态（快照应用后 agents==0）——不是 DEMO！
```

- `demo` 与 `live` 是**互斥显式态**，由连接状态与用户选择驱动，**永不因
  「数据看起来是空的」而自动落入 demo**——这正是 v1 L1 的病根
  （`connected && snapshot.agents.length > 0` 的合取，index.html:719）。
- `stale` 表示「显示的是最后一次 live 数据，但已超期」；断线时进入 stale
  而非 demo，恢复后回 live。
- 三态（+LIVE_EMPTY 子态）驱动 `provenance-bar.ts` 的视觉呈现（§6）。

**C：命令事务状态机（protocol.ts，提案依赖平台 §4.3）**

```
  submit → SENT ──▶ ACKED_OK / ACKED_ERR(reason) / TIMEOUT(3s)
  （每命令一个 monotonically increasing ackId；面板显示最近 N 条命令的
    终态；TIMEOUT 不推断失败——只提示「未确认」，与平台侧「命令失败
    消化进日志」的语义 index.ts:452-458 对齐）
```

---

## 4. 协议设计

### 4.1 版本协商（消费既有 connection_ack，零新信道）

总线已在 `connection_ack.content.protocolVersion` 携带版本 = 1
（quantum-bus.ts:107,492）。v2 客户端策略：

1. 收到 `protocolVersion === 1`：走 **v1 兼容模式**——整快照
   `status_update` + `console_query`，功能等同 v1 视图（但渲染层已模块
   化、L1 已修复）。
2. 提案的 v2：平台把 PROTOCOL_VERSION 提到 2，并在 authenticate 载荷里
   加 `clientCaps: ['snapshot-diff', 'cmd-ack', 'scheduling-telemetry']`。
   总线在 connection_ack 里回 `serverCaps`（交集语义：客户端要的、服务
   端这个版本支持的）。**协商规则：能力按名独立开关，未知能力名忽略；
   protocolVersion 不匹配Major 时客户端必须降级到 v1 兼容模式并明示**。

版本纪律（提案，写给平台侧）：

- 字段**只增不删不改义**；枚举值只增；删字段走「先标记 deprecated 一版
  → 下一 major 删」。
- snapshot 结构变更必须同时更新 `docs/web-console-v2-design.md` 附录 A
  的字段映射表（doc-truth 文化：文档与代码同一 PR）。
- 版本 major bump 的唯一合法理由：不兼容变更（语义改动/删字段）。

### 4.2 快照差分流（提案：`status_update` 增量载荷）

v1 每次广播完整 ConsoleSnapshot（agents 全量 + tasks 最近 200 全量 +
metrics 全量）。v2 提案在协商出 `snapshot-diff` 能力后启用：

```jsonc
// 平台 → 控制台（full，含 rev；之后 diff 引用同一 rev 序列）
{ "type": "status_update", "v": 2, "mode": "full", "rev": 812,
  "content": { /* ConsoleSnapshot 同构 */ } }
// 平台 → 控制台（diff：只含自上一 rev 的变更）
{ "type": "status_update", "v": 2, "mode": "diff", "rev": 813, "base": 812,
  "content": {
    "agents": { "upsert": [ /* 变更的 agent */ ],
                 "remove": ["agent-7"] },
    "tasks":   { "append": [ /* 新任务（时间序）*/ ],
                 "update": [ /* 状态翻转的任务 */ ],
                 "truncateTo": 200 },
    "metrics": { /* 仅变化的子树，深层 merge */ }
  } }
```

规则（**客户端必须按此实现，平台侧照此产生**）：

- `rev` 平台内单调 +1（每 atomic 快照构建 +1，与 100ms 节流无关——被
  节流合并的中间 rev 可以跳号，但**序必须递增**）。
- 客户端收到 `diff`：若 `base === 本地 rev` → 应用；若 `base !== 本地
  rev`（乱序/丢包/重连）→ **丢弃并发送 `console_query` 强制 full 回填**。
  差分永不猜测：错一格就全量重来（对拍简单性优先于带宽极限优化）。
- `tasks` 是有界日志（平台侧 `slice(-200)`，index.ts:340）：diff 的
  `truncateTo` 表达滑动窗口淘汰，客户端按同规格裁剪。
- 回退保障：任何时刻协商失败/协议异常 → v1 兼容模式（整快照）依旧工作。
  **diff 是加速器，不是依赖项。**

### 4.3 命令应答（提案：`console_response`）

现状：`console_command` 单向发送，平台侧校验失败只进日志
（index.ts:452-458），控制台永远不知道。提案：

```jsonc
// 控制台 → 平台
{ "type": "console_command", "action": "submit_task", "ackId": 41, "payload": {...} }
// 平台 → 控制台（handleConsoleCommand 的 finally 段顺带广播）
{ "type": "console_response", "ackId": 41, "ok": false,
  "error": "Invalid priority '\"urgent\"'" }   // 错误消息必须转义后渲染
```

- ackId 是**连接内**单调整数（重连清零）；平台侧回填同 ackId。
- `ok:false` 的 error 是平台日志同款字符串（错误即文档）。
- 未协商 `cmd-ack` 的 v1 平台：命令面板仍可用，事务状态机直接落
  `UNACKNOWLEDGED`（诚实显示「已发送，未确认」），不伪造成功。

### 4.4 调度遥测通道（提案：`scheduling_telemetry` 事件）

为 §5 两类面板供数据。**平台侧实现形态二选一**（设计留白给实施波）：
(a) 事件粒度——批调度每次求解后 `createBroadcastMessage('scheduler',
'scheduling_telemetry', {...})`，走既有总线；(b) 快照内嵌——
ConsoleSnapshot 加 `scheduling` 子树（diff 流天然增量）。推荐 (a)+(b)
混合：过程事件（每轮求解）走 (a)，当前态（最新影子价格）进 (b)。

载荷规格（字段全部来自平台已有模块的输出面）：

```jsonc
{ "round": 42, "mode": "fullspace" /* | subspace | batch-vcg */,
  "batch": { "taskIds": ["t3","t5","t4"], "size": 3,
             "entangledPairs": [[0,1],[2,3]],
             "capturedMass": 0.285, "totalMass": 0.285 } },   // §5.1
{ "round": 43, "mode": "batch-vcg",
  "pricing": { "winners": ["atlas"], "payments": {"atlas": 8},
               "lambda": 0 /* 预算松弛影子价格，λ-bisection 当前值 */,
               "mu": 1, "reserve": 5,
               "excludedByReserve": 3, "droppedTasks": 1 } }  // §5.2
```

---

## 5. 可视化设计

### 5.1 纠缠批面板（entanglement-panel.ts）

数据面（§4.4 载荷一）：每轮批组成的任务分批 + 纠缠 agent 对 + 两个质量
数（capturedMass / totalMass——与 `entanglement-batch-composer` 的输出
同口径）。

视觉：两列布局。

- 左列「批时间线」：每轮一行，批内任务为 chip，**纠缠耦合的任务 chip
  之间画弧线**（SVG path，同一纠缠对同色）；跨批的纠缠对（本该同批却
  被切开）用红色虚线弧 + 「welfare leak」标注。
- 右列「捕获率」：`capturedMass / totalMass` 的滚动条形（0-100%），加上
  当前策略标签（baseline 切片 / improved 局部搜索）。

诚实边界（写进面板脚注）：capturedMass 是**可实现耦合福利的上界**，不是
welfare 承诺（与模块文档同义，entanglement-batch-composer.ts:36-39）。

### 5.2 影子价格 / 准入面板（pricing-panel.ts）

数据面（§4.4 载荷二）：VCG/λ/μ/保留价四种机制面各自的当轮定价事实。

- 「准入矩阵」：agent × 能力格点。每格状态 ∈ {中标, 在场未中标, 报价≤0
  边丢弃, **保留价截除**(bid > reserve 标红), 能力不符}——数据全部来自
  `reserve-price-vcg` 的 excludedByReserve 语义扩展。
- 「价格瀑布」：每中标 agent 一行：bid → +Clarke 项 → pivot 支付；预算
  模式下另画 λ（影子价格）随轮次的折线——**λ 的每一步 bisection 区间
  收缩都能看到**（这就是「调度过程可视化」的本体：不只看结果，看求解
  过程本身）。
- 探索模式开关：`metrics.bus`/`metrics.dsh` 等非调度指标默认折叠。

### 5.3 命令面板（command-palette.ts，Ctrl+K）

- 命令注册表：`submit_task`（表单化：name/priority/requirements）、
  `add_agent`、`complete_task`、`console_query`（强制刷新）、
  `toggle demo/live`、`copy snapshot JSON`（调试）、`goto <panel>`。
- 每条命令声明：id、标题、参数 schema、危险级（complete_task 标黄）。
  面板渲染走 command 事务状态机（§3.3-C）——执行后在状态流里显示
  ACKED_OK / ACKED_ERR / UNACKNOWLEDGED。
- v1 的「自动完成任务」定时器（L8）从 v2 移除；等价需求改为命令面板的
  显式命令（危险级：黄），把「监控端代执行」变成「人显式下指令」。

---

## 6. 离线降级语义修复（L1 的完整解法）

三管齐下，缺一不可：

1. **状态机修复**（§3.3-D）：demo 与 live 的切换只由连接状态与用户选择
   驱动；`agents.length === 0` 在 live 态下渲染 **LIVE_EMPTY 视图**
   （「平台已连接 · 暂无注册 agent」+ add_agent 入口），绝不回落 demo。
2. **provenance 条**（provenance-bar.ts，常驻 header）：
   - `LIVE`（绿）：「实时 · 快照 rev 813 · 2s 前」
   - `LIVE_EMPTY`（绿空心）：「实时 · 平台 0 agent」
   - `STALE`（黄）：「实时缓存 · 最后快照 37s 前 · 重连中」
   - `DEMO`（蓝，斜体「演示数据」水印常驻）：「演示 · 种子 42」
   演示态全页面加 45° 斜纹水印——demo 数据在视觉上**不可能**被误认为
   实时数据（双保险：状态条 + 水印）。
3. **演示数据种子化**（demo-source.ts，修复 L7）：Mulberry32(seed)（平台
   utils/rng 已有同款），URL `#demo-seed=42` 可复现同一演化序列，
   视觉回归测试有了确定性锚点。

---

## 7. 安全模型（继承 + 收紧）

- CSP：发布产物以 `script-src 'sha256-…'` 替代 `'unsafe-inline'`
  （§3.1 发布形态）；dev 形态本地可继续 unsafe-inline（不暴露给用户）。
  `connect-src ws: wss:`、`object-src 'none'`、`base-uri 'self'` 原样保留。
- 消毒不变量下沉：escapeHtml / classToken / priorityToken 收进
  `security/sanitize.ts`，并立模块规矩——**views 层只接受 sanitize 过的
  ViewModel 字段**（selectors 输出前统一消毒，视图代码不再各自判断）。
- 令牌：`bus-token` 继续 `type=password` + `autocomplete=off`；v2 增加
  「会话内不回显、断开即清除」选项（默认开）。
- 命令错误消息（§4.3 error）按不可信远程字符串处理：escape 后渲染。

## 8. 性能预算与测试策略

- 预算（发布产物，50 agent / 200 任务满载）：快照应用 P95 ≤ 8ms；差分
  应用 P95 ≤ 2ms；整包 gzip ≤ 60KB（无框架，天然达标）。
- 增量渲染：agent/task 列表按 id 为 key 做节点级 diff（v1 的整段
  innerHTML 重建仅保留给首帧与全量回填）。
- 测试（node:test，与平台同栈）：
  - `diff.ts`：随机快照序列 → diff(full) 应用结果 === 逐份 full 应用
    结果（**差分正确性 = 与全量对拍**，本仓对照文化的复用）；
  - `protocol.ts`：乱序 diff 必须触发 console_query 回填；ackId 关联
    正确性；版本降级矩阵（server v1 / v2 × client caps）；
  - `selectors.ts` + `demo-source.ts`：黄金 ViewModel 对拍（种子固定）；
  - sanitize：注入用例表（含 v1 修复过的 class 注入、优先级白名单绕过）。

## 9. 分阶段路线图（供编排者排波次）

| 阶段 | 内容 | 依赖 |
|------|------|------|
| P1 | 模块化拆分 + 状态机三台 + L1 修复 + provenance 条 + 演示种子化 | 无平台侧改动 |
| P2 | 命令面板 + 命令事务（UNACKNOWLEDGED 降级态可用） | 无 |
| P3 | 版本协商消费 + 差分流（客户端侧就绪，平台未升版时自动走 v1 兼容） | 无 |
| P4 | 平台侧：PROTOCOL_VERSION 2 + console_response + snapshot diff 产生器 | 本设计 §4.2-4.3 采纳 |
| P5 | 平台侧：scheduling_telemetry 事件 + 两类机制面板 | §4.4 采纳；纠缠批面板另需引擎批组成接线（编排者已规划） |

风险登记：P4 的 rev 单调性依赖平台快照构建路径单线程化假设（现状成立：
buildConsoleSnapshot 同步构建）；P5 的纠缠批数据面依赖
`composeBatches` 接入引擎主路径（当前为 opt-in 模块）。

## 附录 A：v1 → v2 字段/消息映射表

| v1 | v2 | 变更类型 |
|----|----|---------|
| `authenticate {agentId, token?}` | 同 + `clientCaps?` | 增（可选） |
| `connection_ack.content.protocolVersion = 1` | 1 或 2（2 携带 serverCaps） | 增 |
| `console_query` | 同（v2 协商后应答可携带 rev） | 语义兼容 |
| `status_update {整快照}` | v1 兼容不变；v2 增 `mode/rev/base` 差分形态 | 增 |
| `console_command {action, payload}` | 同 + `ackId?`；应答 `console_response` | 增 |
| ConsoleSnapshot.agents[].entanglementCount | 保留（v1 未渲染，v2 面板用） | 不变 |
| close code 4001 = 鉴权失败不重连 | 不变 | 不变 |

*本设计文档为 doc-truth 管辖对象：任何字段/消息变更的 PR 必须同步更新
本文档（§4.1 版本纪律）。*
