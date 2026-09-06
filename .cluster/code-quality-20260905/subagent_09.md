# 通信与工具边界审计

审计对象：quantum-multi-agent-platform v1.10.0（TypeScript ESM，运行时依赖仅 ws）
审计范围：`src/communication/quantum-bus.ts`、`src/dsh/dsh-integration.ts`、`src/tools/{agent-tools,fs-tools,system-tools,web-tools}.ts`、`src/performance/benchmark.ts`
审计标准：2026 边界安全前沿实践（运行时输入校验、最小信任对端、背压与内存上界、错误分类、测量质量）

## 模块概览

- **quantum-bus.ts**（22.5K）：基于 ws 的消息总线。WebSocketServer 监听（默认 127.0.0.1:8080，path=/quantum-bus，maxPayload 1MB），支持可选 token 鉴权、订阅/退订、控制台查询/命令通道、离线消息队列（按 agentId 分桶、每桶封顶）、心跳检测、慢消费者断连（bufferedAmount 4MB 阈值）、连接数封顶。
- **dsh-integration.ts**（15.4K）：待审。
- **tools/**（agent-tools 0.9K / fs-tools 3.4K / system-tools 14.2K / web-tools 0.4K）：待审。
- **benchmark.ts**（14.7K）：待审。

## 发现清单

| 编号 | 严重度 | 位置 | 问题 | 前沿标准依据 | 修复建议 |
|---|---|---|---|---|---|
| F01 | P1 | quantum-bus.ts:169-187 `handleIncomingMessage` subscribe 分支 | `message.channel` 未做任何运行时校验（非字符串、超长均可入列）。恶意对端可发送 `{"type":"subscribe","channel":{...}}` 把任意 JSON 值塞进 `subscriptions`，或用近 1MB 字符串 × 64 次订阅占内存；后续 `subscriptions.includes(message.type)` 比较语义也被破坏 | 边界输入必须按 schema 收敛（2026 共识：消息边界处 runtime validation，如 zod/手写 guard），不能只靠 TS 类型断言 | subscribe 分支加 `typeof message.channel === 'string' && message.channel.length <= 128` 守卫，不合法直接忽略或断连 |
| F02 | P1 | quantum-bus.ts:437-455 `queueMessageForAgent` + `sendToAgent` | 离线队列按 agentId 分桶且仅每桶封顶（maxQueuedMessages=1000），但 Map 的 **key 数量无上界**。已认证恶意对端可持续向海量随机伪造 targetAgentId 发消息，每个 agentId 都建一个桶，messageQueue 无限增长直至 OOM——per-agent 上限挡不住 cardinality 攻击 | 背压/内存上界必须覆盖"实体数量"维度而非仅"每实体容量"（bounded queue 设计原则） | 增加 `maxQueuedAgents`（如 10k）或全局 `maxTotalQueuedMessages`，超限丢弃新桶并计数 droppedMessages |
| F03 | P2 | quantum-bus.ts:404-416 `sendToAgent` | `sent = true` 在调用 `sendToConnection` 后无条件置位，未检查其返回值。若目标 agent 唯一 OPEN 连接恰为慢消费者被 1013 断开（返回 false），消息既未送达也不入离线队列——静默丢失 | 可靠投递语义：send 失败必须回退到持久化路径；"至少一次"或明确丢弃需显式声明 | 改为 `sent = this.sendToConnection(...) \|\| sent`，全部连接失败时落入 queueMessageForAgent |
| F04 | P2 | quantum-bus.ts:292-303 authenticate 分支 | 鉴权开启时 token 校验后，`connection.agentId = message.agentId` 接受任意字符串且**可反复重新 authenticate 切换身份**；agentId 无长度上限、无格式约束，token 是全局共享的——任一持 token 者可在 authenticate 时冒领任意 agentId，绕过"不得冒用他人 agentId"的 sourceAgentId 一致性检查（该检查只对齐"自己声称的身份"） | 身份归属应由服务端绑定（token→允许的 agentId 集合），而非客户端自报；共享秘密不构成身份 | 支持 token→agentId 白名单映射；限制单连接仅可 authenticate 一次；agentId 加长度/字符集校验 |
| F05 | P2 | quantum-bus.ts:305-352 常规消息分支 + `validateMessage` | 除 5 个控制分支外的任意 JSON 都按 QuantumMessage 处理，`validateMessage` 仅检查 id/sourceAgentId/quantumState 三个 truthy 字段：timestamp 可为任意类型、quantumState 可为字符串、targetAgentIds 可为非数组（forEach 抛错被外层 catch 吞掉）、content 无大小约束——协议类型混淆（type confusion）直接透传给下游消费者 | 消息 schema 校验应在边界一次完成并 fail-closed；下游不应承担对端可伪造字段的信任 | 用轻量运行时 guard 校验 timestamp(Date/number)、targetAgentIds 为 string[]、quantumState 形状，不合法计次并断连 |
| F06 | P2 | quantum-bus.ts:449-470 `broadcastMessage`/`processMessage` | 无消息速率限制：已认证连接可持续触发广播路径，服务端对每条消息做 O(连接数) 的发送放大（N 连接场景放大 N 倍写出流量），配合 1MB maxPayload 可打满出口带宽与 CPU（JSON.stringify 每广播一次全量序列化） | 恶意/失陷对端防护需含 per-connection 速率限制与公平调度（fairness under adversarial load） | 引入 per-connection token bucket（如 100 msg/s），超限先警告后断连 |
| F07 | P3 | quantum-bus.ts:137-149 message handler | `JSON.parse(text)` 异常被捕获仅 logWarn，连接保持；攻击者可持续发送畸形 JSON 制造日志洪泛（每条带完整 error 对象序列化），无熔断计数 | 异常应分类：协议违规类错误需累计并触发断连，而非无限容忍 | 对 parse 失败计数，阈值内 logWarn、超阈值 close(4002 'protocol violations') |
| F08 | P3 | quantum-bus.ts:376-393 `startHeartbeat` | 每个连接注册了两个 close 监听（外层 handleConnection 一个、心跳清理一个）+ pong + message + error，监听器随连接生命周期回收尚可；但 `startHeartbeat` 在 interval 内 `connections.get` 失败才 clear，若 shutdown() 先 terminate 再 clear connections，靠 close 事件兜底——路径正确但依赖事件顺序，`setInterval` 句柄未集中登记，shutdown 无法确定性回收 | 定时器属可泄漏资源，应有集中 registry 且 shutdown 幂等强回收 | 维护 `Map<connectionId, NodeJS.Timeout>`，shutdown 时统一 clearInterval |
| F09 | P3 | quantum-bus.ts:整个协议 | 无协议版本协商字段：客户端消息与 connection_ack 均不含 version，未来不兼容变更只能靠 magic 字段试错，跨版本对端会以难调试的方式失败 | 2026 服务边界惯例：握手即带协议版本，服务端显式拒绝不兼容版本（fail-fast） | connection_ack 附带 `protocolVersion: 1`，服务端拒绝未知 type 时回明确错误码 |
| F10 | P3 | quantum-bus.ts:多处置信 log | `logWarn('QuantumBus', ... agent '${message.agentId}' ...)`、channel 等对端可控字符串未消毒直接进日志，含换行/ANSI 控制符可伪造日志行（log forging），干扰审计溯源 | 日志注入属 OWASP 已知类别；对端输入入日志需转义控制字符 | 打日志前 strip \r\n\t 及不可打印字符，或 JSON.stringify 包裹 |

（dsh-integration / tools / benchmark 部分发现待补）

## 模块级优点

- quantum-bus.ts 默认 `host: '127.0.0.1'`——无鉴权模式绝不暴露网络接口，默认安全（secure by default）取向正确
- `maxPayload` 交由 ws 层在帧级别拒绝超大消息（默认 1MB），未认证连接无法用大帧耗内存
- 连接数封顶（默认 256，1013 拒绝）、单连接订阅数封顶（64）、每 agent 离线队列封顶（1000，丢最旧并计数 droppedMessages）——多层上界意识明确
- 慢消费者防护：`bufferedAmount > 4MB` 即断连，正确处理了 ws 库"对端停读但保持连接"的服务端无界缓冲问题，这是很多实现遗漏的点
- token 比较用 SHA-256 后 `timingSafeEqual`，常数时间比较防时序侧信道，做法标准
- 鉴权开启后 subscribe/unsubscribe/console_query/console_command/常规消息五条路径全部闭环检查，且 sourceAgentId 与连接身份做了一致性校验
- `processQueuedMessages` 用连接快照 + sendToConnection 真实送达结果保序，杜绝"计为已投递但实际丢失"，注释把语义讲透了
- shutdown 处理了"start 已发起但未 listening"的窗口（拆除 startPromise 防服务器随后上线），罕见但正确的边界
- 单次序列化复用（sendToAgent/broadcastMessage 的 payload ??= 模式），避免同消息对多连接重复 JSON.stringify

## Top3 升级建议

（待全部文件审完后给出）
