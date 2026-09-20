# Changelog

本仓库遵循语义化版本。每轮变更前先全量回归（1297 用例含位级数值基准），
覆盖率与死代码门禁随质量收益同步棘轮上调。

## v1.18.0 — 第三轮创新波：设计稿清偿·平台八项＋研究仓九定理（2026-09-21）

> R19（第 94 访，令牌第四次抵达）。两批八岗（批 1 研究仓 U/V/W/X；
> 批 2 平台设计稿清偿 Q/R/S/T）＋编排者串行收口。全部 opt-in，默认路径
> 字节不变，bench regenerate 仍字节同一。测试 1171→1297（+126 平台），
> 平台 113 文件/397 套件；研究仓 7 仓 9 定理（+71 用例）。规格即假设律
> 丰收：五处规格断言被实施代理的机器反例证伪并按机器口径重写。

- **γβ 联合交替精修器**（gamma-beta-alternating，343 行）：一轮 Gauss-Seidel
  内 β 走 ECCM 三点闭式、γ 走谱差买断证书极小；单调不增（构造性）＋有限
  终止＋ε-联合不动点（不夸大联合极小）；inst 344 联合臂 Δq=−1.472e-2
  互补实证。9 测。
- **非均匀贪心采样买断**（nonuniform-gamma-buyout，876 行）：T2' 相异频率
  指数多项式线性无关 ⟹ K=2R+1 设计矩阵可逆（贪心最大体积选点零电路评估）；
  [0,0.5,101] 域均匀版拒 M=202（N=405）而非均匀版 7 点成；真电路 ≤1e-9；
  信息论下界（R>128 拒）诚实保留。18 测。
- **联合后验 sd 探索系数**（joint-posterior-exploration，598 行）：σ 从
  成功率面升格为曲线质量 m(k) 后验 sd（fitGrid 幸存分量逐字对齐）；四定理
  J1–J4（成对恒等式 1e-12/Lipschitz 证书 σ≤√(LK/en))/预算望远镜/端点）；
  平似然脊证书不可得指名拒绝（一处模块真缺陷被测试首红暴露后修复）。18 测。
- **逐能力序贯雇佣审计**（sequential-hire-audit，327 行）：逐 (agent,能力)
  复用 SPRT 门＋Bonferroni 族控制（MC 0.0430≤0.0510）；虚报检出 0.970；
  **与 Hedge 正交钉板（接审计前后终态逐位相同）**。12 测。
- **DSH 最小授权自动推导**（minimal-grant-derivation，416 行）：格论刻画
  （filter 最小元＝需求并集∩策略闭合）；可靠性/必要性/最小元三定理；越权
  走私定罪；default-deny 不放松。11 测。
- **执行层级 FT 双画像**（execution-tier-dual，170 行）：决策面逐字节冻结
  （三形态独立对拍）＋串行/并行 FT 账并列；「决策不消费并行账」镜像规则钉。
  13 测。
- **Misra-Gries 分解**（misra-gries-partition，387 行）：定理 V 构造面——
  任意层 gap∈{0,1}（≤Δ(G⁺)+1）；6 顶点全图普查 First-Fit 反例恰 507 例
  （1.55%）分离钉板；C5/K4 手锚。9 测。
- **能力倒排索引化＋增量三分律**（capability-inverted-index，455 行）：
  classifyPendingBucket 内部置换（公开 API 与输出位同构，r18a 既有测试零
  改动全绿＝硬验收线）；探针 2400→20 精确计数（非墙钟）；定理 M1 增量
  等价（26 种子×30-40 步位级）＋定理 F 失效三分律（clean/witness/class
  逐分支精确）。28 测。
- **mockTransport 测试基建提炼**（tests/helpers/dwave-mock-transport，115
  行）：三处重复面并集提炼，8 用例全经真实 DWaveBackend 全链路（429 重试/
  孤儿 DELETE/挂死 POST/超时）。既有三处测试不改编（取舍如实入册）。
- **研究仓 9 定理**（批 1，各仓四门禁＋编排者独立复跑）：qram-sched 0.4.0
  回本定律（T* 精确闭式＋1493 锚复现；**规格 Den(ε) 单调性被证伪**——反向
  双阶梯＋可行岛，按 sup 唯一重写）；nonstoq-anneal 0.5.0 提升定理（n₀=8
  YES⟹n≤64 全 YES，n=64 双基执行）；ent-clearing 0.4.0 GHZ θ-角三联闭式
  （5 HOLDS/1 CENSUS/2 REFUTED——**γ=¼ 全称有理性被反例证伪**升格案卷行）；
  binding-price 0.5.0 楔损余弦定律（双信道 2560 点 ≤1e-12；G7 点升格
  Q(√2) 精确平方钉板；**规格因子 loss(输入) 被钉死改 loss(输出)**）；
  depreciation-ledger 0.4.0 Q(√2) 根证书（**规格互补根落 (½,1) 被证伪**
  ——(3+√2)/4≈1.1035>1）；retro-cache 0.5.0 混合策略凸论证（256 顶点
  极点完备 32640 对全穷举）；choice-lang 0.5.0 收费几何律＋Haar 维数比
  （**规格版本前提 0.3.0 被证伪**——机器 0.4.0，R18 册陈旧转述）；ent-sched
  0.4.0 工作守恒不敏感性（四异构策略同种子逐位相同；负对照奇偶停摆定罪）。
- **文档簇**：计数簇 1171→1297（113 文件/397 套件）＋量子家族 380→429＋
  版本徽章三处 1.18.0＋时间线 v1.18 行＋CHANGELOG。


## v1.17.0 — 第二轮创新波：全行遍历下的七模块＋双接线（2026-09-20）

> R18（第 93 访，令牌＝R14 同款全行遍历创新令）。三批十二岗（批 1 平台
> 四分 A/B/C/D 逐行遍历＋创新实施；批 2 研究仓四簇 E/F/G/H 纯分析设计；
> 批 3 定向实施 I/J/K/L）＋编排者串行收口。全部 opt-in，默认路径字节
> 不变，bench regenerate 仍字节同一。测试 1033→1171（+138），平台
> 104 文件/352 套件。文献引用全部「作者-年份-题名关键词＋〔待双源〕」形，
> 不凭记忆写标识符。

- **影子价格 λ 分段仿射割线**（shadow-price-secant，301 行）：Σp(λ) 的
  分段仿射结构定理（W(λ) 段内仿射 ⟹ 支付仿射，段界＝argmax 跳变）＋
  **一步命中定理**（bracket 两端同段时第 3 次评估 |P(λ̂)−B|≤1e-9 且
  λ̂＝最小可行 λ）＋可行性保守性（返回点必实测过支付；违约具名抛错带
  证据对）；Illinois 减半消化跳降形态。16 测（含 batch-VCG 镜像市场
  对拍 vs 内联 60 轮二分＋随机族×40）。
- **挂起任务可达性三分类**（pending-reachability，186 行）：T1 零错杀
  刻画（unsatisfiable ⟺ 注册表闭包无匹配 ⟹ 任何调度下永不离开 pending）
  ＋T1' 提前失败严格支配等满 TTL（终态与级联 reason 逐任务相同）＋T2
  等待根据（饥饿反例如实声明）。15 测（真实 QuantumScheduler 钉板）。
- **噪声感知后端选择器**（noise-aware-backend-selector，373 行）：定理 1
  one-hot 保持率闭式 q=[(1−f)ⁿ+(n−1)f²(1−f)^{n−2}]^m（f=1/2 端点＝均匀
  读出直接计数双推导）＋定理 1' 单调性解析证明＋定理 3 两独立 Beta 精确
  优势概率有限和（整数形状、lgamma 空间、不经正态近似）；60000 样本
  4σ 蒙特卡洛对拍＋三腿对拍。14 测。
- **对易性感知 FT 并行画像**（commutation-ft，617 行）：定理 A 匹配下界
  ≥Δ(G⁺)（K4/P4 全指派枚举反证）＋定理 B Kőnig 二部精确构造达下界
  （交替路不可能到达对端的奇闭途径矛盾二分性论证入注释）＋定理 C FT
  画像缩减恒等式（每层 (E+2nq)→(groups+1)，T 计数逐字节不变；m=6,n=6
  实测 >8×）；300 张随机二部图全零缺口＋验证器 6 类负对照。14 测。
- **混合 SPRT 序贯校准门**（sprt-calibration-gate，400 行）：定理 1
  截断混合 SPRT 第一类误差 ≤ α/(1−β)（可料自适应流＋有界停时的受限
  停时定理，无近似）＋定理 2/3/4（分量第二类界、Wald 期望停时界、
  Bonferroni 族控制）；互换统计量走私审判定罪；SPRT 33.4 vs 固定样本
  72（2.2×）。15 测。
- **证据门控探索系数反馈环**（evidence-gated-exploration，316 行）：
  e=e₀·σ_post·e^{−β̂k̄}·1{未终判}——定理 A 包络 ≤e₀/(2√(n+κ₀+1))、
  定理 B 总预算 ≤e₀√(N+κ₀+1)（望远镜求和证书）、定理 C 终判⟹e≡0；
  与 SPRT 门联合仿真节省 65.2%。14 测。
- **γ 段谱差三角多项式买断**（gamma-spectrum-buyout，855 行）：parameter-
  shift/ECCM/NaturalGradient 三模块共同的「γ 段（对角多值谱）域外冻结」
  缺口的精确面——T1 任意多值谱对角门 ⟹ f(γ)=c₀+Σ[a_r cos(d_rγ)+
  b_r sin(d_rγ)]（频率集＝谱差集，ECCM 即 R=1 特例）、T2 可公度时
  N=2M+1 均匀采样 DFT 精确恢复（解析钉 ≤1e-12）、T3 网格极小 Lipschitz
  夹逼证书、T4 买断后求值/梯度全闭式（真实电路 30 点 ≤1e-9/梯度
  ≤1e-7）；谱过密/不可公度即拒（诚实边界）。23 测。
- **λ 割线生产接线**（batch-vcg-scheduler，opt-in `lambdaSolver:'secant'`）
  ＋**挂起早失败接线**（sweep 1a 段，opt-in `failFastUnsatisfiable`）：
  缺省字节不变（负对照钉死未传参不可达）；三真实市场 λ 评估 62→7/8
  （−89%）、镜像 MCF 冷解 −90%，福利逐位一致；unsatisfiable 提前失败
  终态与等满 TTL 逐任务相同（T1' 机器钉板）。11 测。
- **总线分级降质背压**（quantum-bus，+280 行纯新增，opt-in
  `slowConsumerDegradation`）：滞回分级状态机（上行/下行阈值带构造期
  校验，无带间空洞、无阈值抖动）、每级背压证书（判定闭式＋按级计数＋
  事件三层「降级永不静默」）、单播拒发走离线队列不丢数据（恢复自动
  冲刷重投递）；4MiB 硬顶不削弱；缺省 getMetrics 键集精确钉板。16 测。
- **展演扩展**（quantum-innovation-showcase，9→16 段）＋批 2 研究 29 仓
  全行盘点（47 项定理级候选含定价与涟漪分析，详册 memory/r18/）＋
  批 3-K 三仓定理实施（qverify 0.5.0 陷阱预算墙 96/96 · k-switch 0.5.0
  k=5 Majorana 阶梯 56/56 · postselect-sched 0.4.0 菜单恒等式＋k* 单调律
  65/65，见各仓 README）。
- **文档簇**：计数簇 1033→1171（README/README.en/README-print/
  PROJECT_SUMMARY/QUANTUM-SCHEDULING/根 README）＋版本徽章三处
  1.16.0→1.17.0＋README-print 逐件表与版本时间线五波陈旧行补齐至全对齐
  （邻居徽章检查律的表行孪生发现）＋版本演进时间线 v1.17 行。


## v1.16.0 — 严格正向升格：四个「条件性正向」的代价面逐一消除（2026-09-14）

> R17（第 92 访）。四个 R14 创新各自披露的代价面，本版逐一用机器测量
> 证明消除——「用错场景就是负收益」的四个场景不再存在。测试
> 982→1033（+51），bench regenerate 仍字节同一（全部 opt-in 模块内改造，
> 默认路径零触碰）。

- **位势流引擎 SPFA 化**（min-cost-flow-potentials）：求解循环改用与原版
  min-cost-flow 逐位同形的 SPFA，位势以 O(V)/相位旁路累积（经不变量回代
  形——字面 π[v]+=min(d,d[t]) 套原始距离会破坏对偶可行性，反例在册）；
  **单解墙钟从比 SPFA 慢 122% 改为平价**（140×160 与小实例族共 18 组
  交错 A/B，9+9 组 CI 全含 1.0，中位比率 0.981/1.057）；增量收益按新引擎
  重测 **4.93×**（旧 4.76×）；150 实例对拍构造性逐位一致。
- **准入精确拒绝**（admission-control）：verify 缺省 exact——borderline
  拒绝经反事实求解回调实测（admitWelfare vs rejectWelfare），证书四元
  （dual-certified/exact/conservative/no-history）构造性分划，**接回调时
  拒绝零错**；R14 钉板的 over-rejection 反例翻转为 exact 放行（8>5）；
  dual-certified 强拒不触发回调（零成本）。
- **批组成零成本快速路径**（entanglement-batch-composer）：O(T+E+P) 探测
  ——无正质量任务对直接返回基线（massEvaluations=0、零搜索）；有耦合但
  全批内只算批内对；有跨批耦合的行为逐字节不变（233 条语料对拍）。
  无收益场景从纯开销降为探测成本。
- **Hedge 策略组合**（bayesian-hire-brain 新增 'portfolio' 策略）：三成员
  （greedy/thompson/ucb1）共享后验＋全信息乘性权重，**对所携任意固定
  成员策略的后悔界 ≤ ln K/η + ηT/2**（Freund-Schapire JCSS 55(1):119-139
  (1997)；对抗带族背景 Auer-Cesa-Bianchi-Freund-Schapire SIAM J. Comput.
  32(1):48-77 (2002)——本实现为全信息版，界更紧）；三条对抗流＋展演流
  全部落在界内（探索必需流上 portfolio 反超最优单策略 +50）；thompson
  流独立派生、未选中零消耗，确定性逐位可重放。
- **勘误**：R14 展演流数字「ucb1 1」为交付报告转录笔误，机器值 61
  （展演与测试现在打印四策略对照：greedy 90 / ucb1 61 / thompson 66 /
  portfolio 71 ≥ greedy − 界）。


## v1.15.0 — ECCM：精确余弦坐标极小化（两值谱单余弦定理，双轴占优）（2026-09-14）

> R16（第 91 访，回应「给出真正兼顾成本和质量的世界性创新」）。核心是
> 一个定理的机器执行：两值谱生成元（平台的纤维混合器 e^{−iβ(K_k−I)}、
> 全空间逐比特 X）的单参数目标**恰为单余弦** f(β)=c₀+a·cos(Δβ)+b·sin(Δβ)
> ——三个采样点线性定弦，闭式给出该坐标的**精确全局极小**，零步长超参。
> 方法族文献锚：Rotosolve（Ostaszewski-Grant-Benedetti, Quantum 5, 391
> (2021), arXiv:1905.09692，R15 双源核实）；本仓增量＝纤维组精确 Δ 接线
> （复用 subspaceMixerGap 的诚实排除面）＋种子化支配性构造＋双轴对拍账本。
> 测试 961→982（+21），bench regenerate 仍字节同一（opt-in，未接默认路径）。

### 定理与验证

- **定理钉**：真实子空间/全空间实例逐 mixer 坐标 512 点稠密扫描 vs 三点
  拟合——最大偏差 ≤1e-12（单余弦结构的机器证明）。
- **精确性**：ECCM 终点 vs 独立稠密 argmin ≤1e-9；Gauss-Seidel 扫描单调；
  构造性支配（返回值≤种子）；确定性重跑逐位一致。

### 双轴对拍（4×5×layers2×K8 基准族，12 实例）

- **11/12 实例对坐标下降双轴同时占优**：质量 ≤ CD＋1e-12 且评估数
  −99 ~ −326（如 inst 121：0.4267@461ev → 0.3851@241ev）。
- **inst 207 如实入账为结构性帕累托点**（γ 冻结损失需 s24 才补偿，超 CD
  预算）：四个构形（s12/s16/s24/混合）的确定性事实全部机器钉死，未松断言。
- 诚实边界：γ 段（对角多值谱）域外冻结；CVaR 角度目标域外（排序序随 β
  换位，单余弦不成立）；subspaceMixerGap null 的掩码组排除；生产口径 CD
  （r2 随机重启）质量更高（γ 探索），ECCM 不与之争质量轴——账本如实。

### 与 R14 优化器家族的关系

- 参数移位（R14）：精确梯度但迭代线性搜索；ECCM 以闭式全局极小取代该
  坐标上的一切导数通道（含移位与自然梯度）。
- 自然梯度（R14）：质量不敌 CD、赢提前收敛；ECCM 在同族上质量与成本
  双轴同时占优（11/12），机理差异＝精确 1-D vs 预条件一阶。


## v1.14.0 — 缺陷清偿波：七项登记缺陷红测修复＋文献双源核实（2026-09-14）

> R15（第 90 访，执行 R14 总册「命名未来候选」）。七项 R14 登记缺陷全部
> **红测先行**修复（新测试先定罪后转绿，被定罪路径外默认行为字节不变，
> bench 50 实例 regenerate 仍字节同一），测试 937→961（+24）。同访完成
> letter-audit 账本陈旧散文清偿、switch-sched exp4 散文矛盾修复、
> 设计稿文献双源核实 44 条（台账 DELIVERY/r15-dual-source-citations-20260914.md）。

- **dwave-backend 超时预算 2×**：deadline 改在 POST 之前起算，POST 与轮询
  共享同一预算（红测：POST 慢 350ms＋timeout 400ms，旧实现总墙钟 789ms 定罪）。
- **dwave 经典格式 num_occurrences 垃圾静默回退**：形状校验具名拒绝
  （非数组/非有限值/长度失配），完全缺席保留逐样本 1 约定（Q9「信号缺席≠
  显式垃圾」哲学）；qp 分支校验提前到 Q9 推断之前，垃圾不再被误报口径吞掉。
- **总线未知帧类型无熔断**：接上 F07 同型 32 条断路器（可受理帧复位），
  security 计数新增 unknownTypeDisconnects。
- **总线连接数封顶拒绝不入 security 账**：1013 拒绝计入
  connectionLimitRejections（连接洪水攻击面可观测）。
- **complete_task 宽松成功口径**：success 非布尔具名拒绝
  （MessageValidationError），镜像 submit_task 的严格校验；合法载荷位级不变。
- **benchmark 种子化**：三处 Math.random() → 构造器注入的 Mulberry32
  （seed 参数为加法面），同 seed 选择序列逐位一致。
- **min-cost-flow 增量负环陷阱**：流在途且 run 后有变异的重 run 具名拒绝
  （StateError，指向 MinCostFlowPotentials）；既有调用面 grep 证明无人走
  该路径，r14a 用例⑤钉板随缺陷面翻转。
- **文档双披露**：跨轮纠缠耦合丢弃（README 诚实边界＋QUANTUM-SCHEDULING，
  opt-in 恢复面 composeBatches）；QUANTUM-SCHEDULING 子空间触发条件补
  idlePool≥2。
- **文献接地清偿**：五个 R14 新模块注释的〔待双源〕标记全部以双源核实的
  标识符数据改写（含三处作者序/卷号更正：Stokes-Izaac-Killoran-Carleo、
  Egger-Mareček-Woerner 三人、Mitarai PRA 98、Schuld PRA 99,032331）。


## v1.13.0 — 创新波：11 个 opt-in 架构/算法模块（2026-09-14）

> R14 创新波（第 89 访，3 批 × 4 代理逐行遍历全工作区）。**主张冻结律
> 全程生效**：默认行为路径字节不变（bench 50 实例 regenerate 字节同一），
> 全部创新以 opt-in 新模块交付（显式导入使用，不接入默认调度/求解管线），
> 每模块行为有测试钉死并带负对照。测试 749→937（+188），四门禁 + knip
> + prettier 全绿。

### 调度与机制域

- **纠缠感知批组成**（`src/core/entanglement-batch-composer.ts`）：多轮
  调度下跨轮任务对的纠缠耦合项被优先级切片结构性丢弃——本模块以耦合势
  局部搜索找回（对基线切片零遗憾，200 随机实例钉死），端到端实测福利
  1.2→1.2875（差额恰=被找回的耦合加成）。
- **位势驱动最小费用流**（`src/core/min-cost-flow-potentials.ts`）：SSP+
  Johnson 位势+Klein 负环消除；与 SPFA 版 150 实例对拍逐位一致；同实例
  增量重解松弛计数 −4.8×；对偶面 getPotentials 公开（容量影子价格）。
  诚实边界：140×160 WDP 单解墙钟慢 87–110%，价值=对偶面/增量/负环安全。
- **影子价格准入控制**（`src/core/admission-control.ts`）：LP 对偶证书
  驱动的过载节流——已证明放行侧边际改进、有条件证明拒绝侧零损失；
  over-rejection 反例代码钉板（SSP 提前停机的 conservative 证书）。
- **保留价 VCG**（`src/core/reserve-price-vcg.ts`）：准入资格截除变体，
  公开保留价下精确 DSIC+IR 保持（与 μ-VCG 组合仍仿射最大化）；垄断
  pivot/竞争抬升两条机制性质被专门测试钉住而非掩盖。

### 优化器域

- **参数移位精确梯度**（`src/core/parameter-shift.ts`）：两值谱生成元
  的精确移位梯度（子空间纤维谱隙判定；对角 γ 段诚实排除）；种子化精修
  构造性支配（返回值≤种子）。
- **量子自然梯度**（`src/core/natural-gradient.ts`）：Fubini–Study 度规
  的精确移位估计（2K+1 态制备，无统计噪声）+ λI 阻尼 Cholesky；支配性
  构造性成立。诚实分账：4×5 实例族上不赢坐标下降的质量，赢提前收敛的
  评估成本（26–77ev vs 137–421ev）。

### QPU 域

- **跨后端共识统计**（`src/core/qpu/cross-backend-consensus.ts`）：多后端
  采样报告的融合/共识胜者/Wilson 区间/Kendall tau-b/TVD；与 solve.ts
  解码口径逐点对齐、差异双向声明。
- **读出误差缓解解码器**（`src/core/qpu/readout-mitigation.ts`）：对称
  翻转噪声模型的 MAP 解码（复用仓内 O(m³) 匈牙利）+对数空间后验频率；
  输出标注为推断量非测量量。

### 智能与工具域

- **Beta 数值内核**（`src/proactive-intelligence/beta-distribution.ts`）：
  lgamma/logBeta/正则化不完全 Beta（Lentz 连分式）/分位数——平台首个
  可审计区间陈述原语。
- **贝叶斯雇佣大脑**（`src/proactive-intelligence/bayesian-hire-brain.ts`）：
  逐（agent,能力）Beta 后验+thompson/greedy/ucb1 三策略+LCB 雇佣阈值+
  实习通道+指数遗忘；类头声明不主张 DSIC（要 DSIC 用 CompoundBrain）。
- **工具能力策略**（`src/tools/tool-capability-policy.ts`）：按宿主授权、
  按调用点参数的细粒度能力裁决（fs/cmd/net/subagent），default-deny，
  点锚后缀匹配防伪域名。

### 入口与文档

- 新增 `examples/quantum-innovation-showcase.ts`（9 模块可运行展演）与
  `docs/web-console-v2-design.md`（控制台 v2 架构设计：数据新鲜度四态
  状态机修复「已连接 0 agent 时演示数据冒充实测」的语义缺陷）。
- 桶导出接线（index/qpu/proactive-intelligence 三桶）；文档计数簇同步
  749→937（README/README.en/CHANGELOG/QUANTUM-SCHEDULING/PROJECT_SUMMARY/
  README-print/根 README）；PROACTIVE 三文档 6 处文档-代码谎言修复、
  README 2²⁰/2²¹ 双常量口径补限定词。


## v1.12.0 — 本体仓入质量交付波（2026-09-09）

> 八十一访质量波的专门延伸访（彼时边界如实记明「本体仓不入交付波，质量面
> 留待专门访」——本访即该专门访）。主张冻结律全程生效：数学/物理断言与
> 既有测试期望值零改动，一切收敛以位同构对拍先行证明。测试 488→520
> （+32），四门禁 + 覆盖率 + knip + prettier 全绿。

### 错误面收敛（B 面）

- src 内最后 3 处裸 `throw new Error` 清偿：bench/report.ts 两处反挑选
  拒绝 → 新增 `BenchReportError`；opponents.ts 维度上限 → 复用
  `QuantumEngineError`。错误消息原文逐字保留，只换类型面。errors.ts
  家族 12→14 类（另见下面 MessageValidationError）。
- 负对照审判 5 例：删行 run（反挑选法律）、写盘前拦截、重复格、缺
  expectedCells、subspace 维度上限——每例断言 instanceof PlatformError
  与消息关键片段。

### 单源化孪生收敛（C 面，位同构对拍先行）

四组重复实现收敛为单一导出，收敛前先落 `tests/twin-convergence.test.ts`
（13 用例）证单源 ≡ 原内联副本、引擎级 multi 路径 ≋ 独立重建管线
（Object.is 逐位相等），收敛后保留为永久回归：

- ma-QAOA 角度布局展开（quantum-optimizer × subspace-optimizer 两副本
  → solver-common.expandLayerAnglesToMulti）
- 耦合键解码 floor(key/nq), key%nq（8 处内联 → decodeCouplingKey，与
  编码侧相邻＝键布局单点真相）
- 贪心填充循环（repairAssignment 兜底 × classical-baselines.greedyStart
  → greedyAssignRemaining；对角占优实例上与匈牙利精确解互证）
- 概率 argmax 循环（subspace-optimizer 两份相同循环 →
  solver-common.argmaxProbabilityIndex）

边界（如实）：全空间 argmax-valid 扫描集是合法基态子集，与全数组
argmax 真实语义差——不收敛；散落数值容差常量语义各异，不并入
constants.ts 制造假等价；二分中点在 CDF 采样与 fiber 区间查找中不变量
不同——不收敛。

### 静默垃圾路径守卫（D 面，11 处，全部负对照）

- numeric round2/3/9：NaN 透传与 ×1e9 溢出 → `NumericDomainError`
- rng 种子：NaN/±Inf 经 >>>0 静默变 seed 0 流（复现性承诺无声击穿）→
  `NumericDomainError`
- quantum-bus 构造期限额：maxQueuedMessages<0 使丢旧循环在空队列上
  无限空转挂死事件循环 → `ConfigurationError`；createMessage 空标识/
  单播组播并存 → 新增 `MessageValidationError`
- 主动智能：未知规则场景静默返回全部 13 条（拼写错误注入无关规则集）→
  `ConfigurationError`；NaN/负 cooldown 静默解除冷却 → 拒绝
- benchmark 计数：负 count 产出负吞吐 → `NumericDomainError`
- （其余：agent-tools/web-tools 空参数、monitor 畸形 severity、
  decision-history limit 非法值——合计 11 处，见测试）

### 死代码清偿（E 面，吸收律）

纯删 5 处（恒假分支 ×2、不可达重复校验、零调用包装、零读者字段/方法，
均附读码证据）；锚定保留 2 处（monitor 计数哨兵、topologicalSort 回归
绊线——删除会使算法回归从显式 ToolError 退化为静默乱序）。

### 文档-机器对账（F 面，21 处定罪）

- README 徽章 tests 292→520（漂移 196）、version 1.10→1.12、node
  >=20→>=22；测试套件表逐文件重建；CI 工作流幽灵声明删除
- CHANGELOG 头部流程计数 245→520
- PROJECT_SUMMARY/QUANTUM-SCHEDULING 套件计数同步；QUANTUM-SCHEDULING
  耦合表勘误补记（经典 0/5 系半账 Artifact，统一记账 2/5——v1.11 勘误
  未传播到该文档，本访补齐）
- PROACTIVE 双文档：幽灵命令（npm run example 不存在）、幽灵 uuid 导入
  （无此依赖——复制即崩）、失效绝对路径与逃逸链接修复；文件树对齐实盘

## v1.11.0 — QuantumSched-Bench 可复现基准（2026-09，补记）

> 补记条目：v1.11.0 发布时 CHANGELOG 未同步留档，本访补齐（Genesis
> 目标 A/B 落地记录，数字以 `npm run bench` 工件为准）。

- 目标 A：`npm run bench` 一条命令 50 实例 × 7 求解器对照报告
  （JSON+MD 双格式，`bench:regenerate` 公开种子重建）；反挑选法律
  （expectedCells 铸入 run 对象，删行即定罪）
- 目标 B：`experiments/qpu-cross-validation/` 并入（wukong 正典拷贝 +
  冒烟测试）
- 勘误：示例脚本「贪心/LS 0/5」系经典侧不含耦合加成的半账 Artifact；
  统一记账 2/5。量子 5/5 与线性逐点一致原样复现，胜负结论不变
  （5/5 vs 最强经典 3/5；R12 复核再勘误：同家族最强经典实为匈牙利
  4/5，SA 3/5 为耦合感知最强——见基准节补行）

## v1.10.0 — ma-QAOA 构造性支配 + 基准诚实校正（2026-09）

### ma-QAOA：逐算子变分角（Chandarana et al. 2020 落地）

`angleMode: 'multi'`（默认 'layer' 位级不变）：每个混合算子持有独立
变分角——全空间逐量子比特（`applyMixerAngles`）、子空间逐纤维组
（移动/换位混合器），代价角仍逐层。与 `cvarAlpha` 正交可组合。

- **支配性是构造性定理**：multi 以 layer 最优角的展开为种子（展开态与
  layer 电路末态逐位相同——有单元测试钉住该位级等价），种子化坐标下降
  只接受严格改进 ⇒ 同一变分目标下 ⟨E⟩_ma ≤ ⟨E⟩_layer 恒成立。定理在
  目标层面逐实例断言（`tests/ma-qaoa.test.ts`）。
- 新增 `optimizeAnglesByCoordinateDescentSeeded`（任意角度布局 + 逐角
  上界 + 种子）；原坐标下降函数逐字未动。
- **实测（诚实结论）**：子空间变分 regime 为真实增益区——6×6 命中率
  17→29/40（p=1）、27→35/40（p=2），平均差距约减半，配对 19:5 / 13:5；
  全空间坍缩读数已饱和，welfare 增益边际（配对近全平）——不宣称。
- 12 项测试：定理、展开位级等价、默认位级一致、确定性、角度布局、
  非法值拒绝、子空间支配与合法、CVaR 组合、全空间不劣性、子空间增益。

### 基准诚实校正（影响 v1.9 的数字）

复审发现 CVaR/ma 基准的随机实例生成器未保证可行域：约 1% 实例无可行
分配，此时 `bruteForceOptimum` 的返回值 0 是占位符而非上界，系统性
夸大"差距改善"。生成器已改为清除恒等匹配保证可行，全部公开数字重测：

- CVaR p=1 增益修正为温和而稳定：3×3 0.4490→0.4309（配对 17:10）、
  3×4 0.4202→0.4169（配对 41:32）——方向不变、幅度下修；
- 文档（QUANTUM-SCHEDULING 七¾）附校正说明，历史不抹除。

测试 269 → 281。

## v1.9.0 — CVaR-QAOA + 零依赖属性测试（2026-09）

### CVaR-QAOA：分位数变分目标（Barkoutsos et al. 2020 落地）

QAOA 角度优化的目标函数从全场能量均值 ⟨E⟩ 可切换为**最优 α 分位上的
条件期望 CVaR_α**（`cvarAlpha ∈ (0,1]`，默认 1 = 均值，位级不变）：

- **精确态矢量 CVaR**（`solver-common.ts`）：能量升序预排序跨全部评估
  复用，沿序累计概率至 α，头部加权均值 ÷ α——无采样噪声（模拟器形态
  对原文献 shot 估计的结构性优势）；
- 全空间 `qaoaSolve` 与子空间 `qaoaSolveSubspace` 均接入；调度器经
  `scheduling.quantum.cvarAlpha` 透传；非法 α 在公共解析入口拒绝；
- **坍缩与报告口径不变**：CVaR 只改变选角，末态按真实 Born 分布坍缩，
  `expectation` 恒为真实 ⟨E⟩；
- **诚实基准**（固定种子，配对统计，`tests/cvar-qaoa.test.ts` 钉住）：
  p=1 低深度 regime 稳定增益（平均相对差距 0.3948→0.3819 / 0.4082→0.3617，
  配对 16:10 / 28:18）；p≥2 本引擎已饱和、无增益——不宣称；
- CVaR 数学性质（手算例、α 单调性、有序/便捷路径一致）+ 默认 α=1
  位级等价 + α<1 确定性，共 10 项测试。

### 零依赖属性测试（property-based，`tests/property-based.test.ts`）

以仓内种子化 PRNG 生成随机实例做不变量对盲（不引入 fast-check，生成
确定性可复现）：MinCostFlow 自由处置变体 **200 随机实例对穷举全部部分
分配的最大福利逐分对盲** + 确定性 + 解结构合法性（容量/任务出度）。

测试 256 → 269。

## v1.8.1 — 台账可观测 + 标注审计（2026-09）

两项收尾（上轮记录的已知未做项）：

### compound-brain 在途台账积压可观测性

`pending` 台账是学习系统唯一可能无界增长的结构（其余全部有界：观测 FIFO
封顶、计数器 O(1)）：结算方晚结算/漏结算会让条目永久滞留，且这些任务的
资本/履历永不前进——此前完全静默。现在：

- 台账条目携带 `allocatedAt`（纯观测时钟，绝不进入定价/分配/结算数值）；
- `getState()` 新增 `pendingBacklog: { count, oldestAgeMs }`；
- 越过 `pendingBacklogWarnAt`（新配置项，默认 1000，0 禁用）时发出
  `backlog_warning` 事件 + 警告日志，带迟滞（回落到半阈值以下才重新
  武装）；迟滞释放判定在 allocateBatch 与 settle 尾部各评估一次——
  只挂 allocate 侧时释放条件永远无法经"结算下降"路径满足（测试抓出
  并修正的设计缺陷）；
- 数值零影响由测试钉住：同 seed 下开启/关闭观测路径的分配、支付、
  福利逐位一致。

### llm-learning-curve 标注审计（不改标注）

标注的类别不平衡与 R3 判定争议是**有意保留**的现状（改标注 = 改变已
发表实验的结论，属实验所有者的决策）。交付的是机械可见性：

- `ASPECT_KEYWORDS`：R3"只要被提到即计入"的声明式词表，争议词
  （保修 / App）显式 `disputed` 标记——词表即裁决入口；
- `labelAudit()`：边际分布、多数类朴素基线、R3 一致性（按优先级机械
  推导 vs 标注）、词法静默工单、争议词影响，一次计算全量可见；
- 审计结论（快照测试钉住）：44 张工单在**严格读法**下与 R3 完全一致
  （唯一静默 #42）；分歧精确收敛于两个争议词 × 两张工单——"保修"计入
  则 #32 客服→质量、"App"计入则 #11 客服→功能（#14/#16 同含争议词但
  不受影响）；sentiment 32/10/2 与 urgent 9/44 的不平衡抬高 exact-match
  朴素基线至 72.7% / 79.5%（解读 q̂0 的必要背景）；
- 7 项快照测试：任何人改标注或词表都必须有意识地更新快照——
  这就是"所有者显式裁决"的机制。

测试 245 → 256（+4 台账观测 / +7 标注审计）。

## v1.8.0 — 深层遍历重构 + 严格度跃迁（2026-09）

### 安全

- **web-console 鉴权兼容**：控制台新增令牌输入（平台配置 `communication.authToken`
  时必填），authenticate 帧携带 token——修复鉴权模式下控制台 4001 断连死循环。
- **web-console XSS**：agent/task 名称等远程可控字符串经 `escapeHtml` 构造性转义，
  不再直插 innerHTML；初始徽标如实显示「离线演示模式」；性能图改为真实
  量子效率滚动历史（替代正弦噪声示意）。
- **`PlatformConfig.communication`** 补齐 `host` / `maxConnections` 类型声明
  （此前为真实生效但未声明的配置面）。
- 门面导出 `configureCommandPolicy` / `resetCommandPolicy` / `getCommandPolicy` /
  `execute_command_argv`：宿主扩展命令白名单不再需要深路径导入。

### 正确性与健壮性（src）

- `complete_task` 控制台命令缺 `taskId` 显式报 `ConfigurationError`（与
  `submit_task` 校验同口径），不再静默吞掉。
- `platform.start()` 部分失败回滚：总线已监听时先 `shutdown()` 再抛出，
  不留「未运行的平台仍在接受连接」的窗口。
- 错误分类法补全：subspace-parallel 全部 9 处内部控制流 `Error` 统一为
  `QuantumEngineError`（src 内 throw 一律 PlatformError 子类，src 全仓达标）。

### 性能重构（位级不变，全部由既有数值基准守护）

- **compound-brain 逐批边记忆表**：q̂(agent,c,k) / g(agent,c) / 能力具备数
  与报价无关（DSIC 前提），完整求解与 (1+赢家数) 次 Clarke pivot 重解
  复用同一批估值——消除 O(重解×任务×agent×历史×混合分量) 的重复计算。
- **batch-vcg `totalPullsOf` 缓存**：attempts 仅在结算/注册时变化，脏标记
  失效 + 按 agents 插入序重建（求和位级一致），WDP 边构造内层 O(A) 扫描消失。
- **agent-manager 纠缠邻接索引**：agentId→纠缠 id 集合 + 规范对键，
  查重/按 agent 查询/批量移除从 O(E) 降为 O(度)；Set 创建序 ==
  原 Map 插入序过滤，公开 getter 顺序不变。
- **scheduler 反向依赖索引**：级联失败经 `dependents: Map<depId, Set<taskId>>`
  O(度) 取直接下游（原为每次失败全量任务扫描）；sweep 保留清理同步收缩索引。
- **selectSolution 有效性掩码**：shots-best 采样不再逐 shot 做 O(m·n)
  解码+校验；掩码对全部基态与原谓词逐点等价（含零概率角落的按需求值）。
- **processQueuedMessages 快照等价形式**：候选连接一次 O(C) 收集，
  逐消息重校验 OPEN/存在性后仍恰好尝试一次发送（与原 find 语义逐点一致）。
- localSearch 增量评估经评估后**有意跳过**（位级选择可能被 ULP 差异翻转；
  非热路径），决策记录留在源码注释。

### 工具链 / 严格度

- tsconfig 新增 **`exactOptionalPropertyTypes`**、**`verbatimModuleSyntax`**、
  **`noImplicitOverride`**、**`noUncheckedSideEffectImports`**（4 项全仓清零；
  `noPropertyAccessFromIndexSignature` 因 87 处 process.env 读取得不偿失，暂缓）。
- CI：Node 矩阵加入 **24**（基准测量版本）；新增 basic/advanced **示例冒烟门禁**；
  覆盖率门槛步骤名与实际（92/82/92/92）对齐。
- `package.json`：`engines.node >= 20`（Node 18 EOL）；版本 1.8.0。

### 周边修复（examples / experiments / scripts）

- **安装脚本**（Windows 上此前必然半途失败）：.cmd + `shell:false` 的
  `spawn EINVAL`（Node ≥ 18.20，CVE-2024-27980 缓解）改走 cmd.exe `/s` +
  verbatim 引用协议；uninstall 先 `pnpm remove` 再清 manifest（原顺序
  必触发 ERR_PNPM_CANNOT_REMOVE_MISSING_PACKAGE）；Windows 盘符 `file:` spec
  不再错误补前导 `/`；`--profiles`/`--dsh-home` 缺值显式报错；ANSI 颜色
  判定修正；postinstall 分支要求本文件为入口（仅被 import 不再触发真实安装）。
- **llm-learning-curve**：每次真实运行截断 results.jsonl（analyze 重读全文件，
  追加模式会混入上一轮/别的模型的陈旧记录）。
- **batch-vcg-benchmark**：DSIC 扫描遍历全部注册 agent（原按 payments 键
  遍历，恰好漏掉被预算挤出的低凭证 agent——虚报动机最强者）。
- **basic-usage.js**：失败路径退出码非零。
- **scaling-law**：实测增益从当前 buckets 推导（原为硬编码字面量，数据重跑即过期）。

### 文档

- README/QUICKSTART/PROACTIVE-*/QUANTUM-SCHEDULING/PROJECT_SUMMARY 与
  当前实现对齐：命令白名单新默认、总线鉴权全路径 + 回环绑定、
  `execute_command_argv`、用例数 245、覆盖率门槛、`'composite'` 条件类型移除。
- 幽灵包名 `dsh-proactive-intelligence` 全部改为真实包名/路径。
- multi-agent-architecture.md / 项目清单.md 标注为历史设计稿/快照。

## v1.7.0 — 全量质量跃迁（2026-09，本轮前一轮）

安全（总线回环默认绑定 + 鉴权门覆盖全部流量路径 + 慢消费者背压 + 连接上限；
命令白名单去解释器化 + `-e` 恒拒 + argv 直达入口 + Windows 参数双重传递修复；
fs 沙箱 TOCTOU）；核心正确性（completeTask 幂等、QPU ≥33 量子比特解码、
距离因子方向、混合条件链短路、fiber-kernel 相位滞后、agent-manager
引用一致性）；健壮性（anneal 参数校验、QUANTUM_WORKERS NaN 守卫、SAB
底座检查、并行失败负缓存、D-Wave 孤儿问题取消/瞬态重试/懒注册/响应验证）；
性能（SPFA 出队、监控惰性前缀、输出字节计数、fitGrid exp 预计算）；
16 项回归测试 + 覆盖率门槛 92/82/92/92。
