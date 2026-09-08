# ent-sched — 分布式纠缠调度原型（未来技术版图 #3）

**把"多智能体"变成"多量子处理器"：调度器直接调度纠缠资源。**

跨 QPU 量子网络的任务分配原型：量子中继 + 纠缠分发世界里，链路尝试带宽、
量子存储器占用、交换时机与纯化阶梯全部由调度器仲裁。TypeScript 严格模式、
零运行时依赖、NodeNext、node:test；`npm run repro` 一条命令全量重建本
README 引用的所有数字。

## 核心结果（全部可由 `npm run repro` 重建）

1. **物理层裁判互证**：交换（Bell 标签 XOR 卷积）、BBPSSW 纯化（twirl 协议，
   含成功概率）、存储退极化（替换信道）全部与独立 4 量子比特密度矩阵电路
   模拟逐点一致（随机网格，最大偏差 ~1e-15；`out/exp1-physics.md`）。
   两个机器锁定的常数：纯化改进阈值 **恰为纠缠阈值 F = 1/2**（1e-10），
   Werner 单向密钥分数阈值 **F\* = 0.810710**。
2. **引擎 vs 精确 DTMC**：2 链路中继链（非对称 p，M=1）在无噪声 4 态与
   T₂/截止 49 态年龄链两种配置下，交付率与平均保真度均与精确平稳分布吻合
   （`out/exp2-chain.md` A 表）。
3. **截止策略**：4 跳链 T₂=300、截止=6 使坏交付占比 0.436 → 0.086，
   且好交付反升 ~14%（截止释放的槽位让新鲜对更快积累）。
   另一实测发现：**无释放机制的 swap-asap 会冻结死锁**（6 跳 T₂=400，
   陈旧重叠段占满锚点后 attempts 永久停止；低 qSwap 时交换失败反而充
   当清道夫）——释放/丢弃是一等调度原语，不是可选装饰。v0.2 普查
   （exp2-D）：冻结家族在 **hops=6 ∧ slots=2 ∧ qSwap≥0.8** 精确出现
   （3/3 种子），加释放原语（截止=10）后全部解冻、goodput 恢复
   0.24–0.42/轮——机器验证的普适解冻。
4. **多 QPU 调度（六节点梯形网，三路并发 EPR 需求）**：
   - 良性区间（T₂=∞）：swap-asap 吞吐最高（1.358/轮）——急切合并在该
     区间免费，如实报告。
   - **严格 QoS 区间（F₀=0.97, fMin=0.975）：ERS 0.666/轮（F̄=0.979），
     三个基线全部为 0**——纯化调度把其他策略结构性无法交付的 QoS 变成
     可交付（`out/exp3-network.md` C 表）。
5. **纯化阶梯的硬件下限**：F₀=0.85 → fMin=0.95 的 2⁴ 阶梯需要 **≥4
   存储槽/链路**；slots=3 时混合阶梯饱和于 0.9497 < 0.95，交付为零——
   硬件需求，不是调度器可绕的参数（`out/exp4-purify.md` A 表）。
   v0.2 相位边界（exp4-D，(F₀, slots) 平面）：F₀ ≤ 0.84 需 slots ≥ 4，
   F₀ ≥ 0.86 时 slots=3 即可，slots=2 在 F₀ ∈ [0.80, 0.90] 全网格
   交付恰为零——三条硬壁作为数据。
6. **规模 × 存储寿命相位图**：密钥率坍缩边界在 n·(1/p) ≈ T₂ 处接管
   （4 跳在 T₂=200 保留率 0.011；6 跳 T₂=∞ 仍有 0.082 比特/轮，
   T₂=400 归零；`out/exp5-scaling.md`）。
7. **估计器 + 鲁棒性（v0.2 主交付）**：oracle 换成传感器层——每链路
   Welford 估计器银行由**破坏性校准层析**喂养（5% 牺牲率，三角噪声 σ，
   系统偏差 δ），策略只看**信念镜像**，物理裁判按真值记账（exp6，
   `out/exp6-robustness.md`）：
   - 完美信念保持率 0.90–1.09×——校准传感器的全部代价就这么大；
   - **系统性偏差 δ=+0.02 撕毁 QoS**：违约 655.9/千交付（最差真 F
     0.9395 < 0.95）；**LCB z=2 救不了**（777.7/千）——统计裕度按 1/√n
     收缩，吸收不了系统偏差；δ=−0.02 方向安全但保持率掉到 0.55–0.72×；
   - **T₂ 误信不对称**：乐观 ×2 违约 90.0/千；悲观 ÷2 零违约但吞吐
     坍缩到 0.114×；不校准则先验 0.90 卡死（违约 1000/千，交付为零）。
   走私审判守卫（test/sensors.test.ts）：伪造样本来源/伪造层析读数被
   银行点名拒收；声称达标而真值不达标的释放被审计账本点名（QOS_CLAIM_
   VIOLATION）。

## 调度的是什么资源

| 资源 | 仲裁者 | 决策 |
| --- | --- | --- |
| 链路尝试槽（生成带宽） | ERS 亏额优先 | 少交付的请求优先拿尝试槽 |
| 量子存储器 | 引擎占用计数 | 每对在其段的两端各占一槽 |
| 交换时机 | late/ERS 保真度门 | 铺贴完成且投影 F ≥ fMin 才级联合并 |
| 纯化阶梯 | ERS 自底向上配对 | 最小 fHi 优先、严格改进 + MIN_GAIN、压力释放 |

## 策略

- `swap-asap`：经典嵌套中继——相邻段即合并（延迟最低，暴露最大）
- `swap-late`：全路径铺贴后级联合并（make-before-break）
- `tdm`：时间分区轮转（无空间复用，下界对照）
- `ers`：本原型交付物——k 路径滞回选择 + 亏额仲裁 + 纯化阶梯 + 严格 QoS

## 快速开始

```bash
npm install
npm test          # 60 项测试：物理裁判、引擎记账、策略、Markov 互证、传感器层、走私审判与具名错误审判
npm run repro     # ~13 分钟重建 out/*.md 全部报告
npm run exp:physics   # 单跑某一实验（exp:chain / exp:network / exp:purify / exp:scaling / exp:robustness）
```

## 诚实的边界

- **经典控制层仿真**：物理层抽象为 heralded Bernoulli 尝试 + Werner/Pauli
  噪声代数；无光子级物理，无谱细节。
- **v0.2 已执行：估计器替代 oracle**（exp6 / theory §10）。剩余边界如实
  列出：估计只覆盖 f₀ 与 T₂（点信念；无全分布/在线贝叶斯）；层析噪声为
  三角分布（非完整读出误差模型）；鲁棒性只扫 σ/δ/T₂ 三轴、每轴一族场
  景；走私审判覆盖银行与审计账本两个可执法接口——策略绕过视图直读
  `pair.vec` 在 JS 层不可机械拦截（spy 测试佐证视图只回信念）。
- 同构轮时长（全网一个时钟）；操作时长以轮为单位。
- 纯化为 BBPSSW-Z 递归 + twirl（Werner 输入下与 DEJMPS 等价）；无 hashing
  批量纯化、无 QEC 存储、无 GHZ/多播。
- Markov 裁判限于 2 链路小链；网络级无解析对照，与 Q-CAST 类基线为定性
  对照（未逐点复现其开源实现）。
- ERS 的价值在 QoS/公平/纯化维度，不在良性区间的裸吞吐——exp3-A 如实
  显示 asap 在 T₂=∞ 时吞吐最高，我们不粉饰。

## 引用锚点（全部原文核实，2026-09-05）

- 中继器架构：Briegel, Dür, Cirac, Zoller, *Phys. Rev. Lett.* **81**, 5932 (1998)
- 纯化：Bennett et al., *Phys. Rev. Lett.* **76**, 722 (1996)（BBPSSW）；
  Deutsch et al., *Phys. Rev. Lett.* **77**, 2818 (1996)（DEJMPS/twirl）
- 交换：Żukowski, Zeilinger, Horne, Ekert, *Phys. Rev. Lett.* **71**, 4287 (1993)
- 多路径纠缠路由：Pant et al., *npj Quantum Inf.* **5**, 25 (2019)
- 并发纠缠路由（Q-CAST）：Shi & Qian, *ACM SIGCOMM* (2020)
- 开关排队论分析：Vardoyan, Guha, Nain, Towsley, *Queueing Systems*（星型
  纠缠分发开关的 Markov 分析传统——本仓库的 DTMC 裁判属于同一方法论）
- 调度复杂度：Even, Itai, Shamir, *SIAM J. Comput.* **5**, 691 (1976)
  （2 商品整流 NP-完全——网络级最优离线仲裁的下界背景）

v0.2 新增前沿锚点（纠缠新鲜度 / 保真度保证路由，2026，双源核实——
arXiv + INSPIRE/Semantic Scholar）见 **docs/citations.md**：Ceran
(AoE, INFOCOM 2026)、Ercetin & Gedik (Fidelity-Age)、Mitrolaris et al.
(记忆受限开关 AoEE, INFOCOM 2026)、Gatti et al. (Q-GUARD)。全部为
引用锚点，非复现方法。

## 目录

```
src/core/rng.ts          确定性 RNG（与 ft-qaoa 同源）
src/core/cx.ts           复数稠密矩阵内核（裁判用）
src/core/errors.ts       具名错误契约（每个 throw 带机器可查 code）
src/physics/             Werner/Bell 代数 + 密度矩阵裁判（twirl 电路）
src/net/topology.ts      图、最短路、k 简单路
src/net/engine.ts        轮次引擎（截止→尝试→操作→交付；oracle/传感器双模式）
src/net/sensors.ts       v0.2 传感器层：估计器银行 + 信念镜像 + 走私守卫
src/net/policies.ts      asap / late / TDM / ERS（估计器无关）
src/net/markov.ts        2 链路精确 DTMC（4 态 / 年龄态）
src/experiments/         exp1..exp6 + run-all
```

同系列：`ft-qaoa`（版图 #1 容错深度 QAOA）、`nonstoq-anneal`（版图 #2
非 stoquastic 退火）——同一套方法论：数值内核 + 独立裁判 + 诚实边界。
