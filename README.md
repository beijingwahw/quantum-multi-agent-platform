# quantum-multi-agent-platform

> 把**真实量子算法**（QAOA / 绝热量子退火 / Born 测量坍缩）当作多 Agent 任务调度的**决策引擎**——不是比喻，而是带可复现基准、机器可验门禁与全量测试账本的 TypeScript 工程。本仓库在主平台之外，还承载了一批把论文级命题做成「可执行 + 可证伪 + 带价目表」工件的研究线子项目。

## 主平台

**[`ds_extracted/ds`](./ds_extracted/ds/README.md) — QuantumMultiAgentPlatform（v1.12）**（路径名源于工程史上的解包命名，以仓内 README 为准）

- **约束子空间精确演化**：等效 **80 量子比特**（全空间模拟需约 10¹⁵ TB 内存）——「每任务占一个不同 agent」的约束直接长在希尔伯特空间的基上，罚项为零；
- **战绩**：NP-hard 耦合赛道 **5/5 精确命中最优**；线性赛道与匈牙利 O(n³) 逐点一致（独立算法互证）；8×10 实例退火最优率 100%；
- **QuantumSched-Bench**：50 实例 × 7 求解器的可复现基准（固定种子、公开实例生成器、机器可读报告）；
- **质量门禁**：六道门禁 + 覆盖率棘轮（`npm test` 520 用例），18 张 README 原理图全部脚本化渲染并过三道机器视觉门禁（缺字 / 溢出 / 碰撞零容忍）。

主平台的完整文档、架构图与基准表见 [`ds_extracted/ds/README.md`](./ds_extracted/ds/README.md)。

## 复现入口（主平台）

```bash
cd ds_extracted/ds
npm install
npm test            # 520 用例 · 六道门禁
npm run bench       # QuantumSched-Bench：重建 out/bench/bench-report.json
npm run diagrams    # 18 张原理图重渲染 + 三道机器视觉自检（exit code 执法）
npm run coverage    # c8 覆盖率 vs 防回归门槛棘轮
```

## 研究线子项目索引

每个子项目自带 README、测试与记账，入口见各自目录。

| 目录 | 一句话简介 |
|---|---|
| [`binding-price`](./binding-price/README.md) | 账本第 13 行的市场执行：隐私可以买，绑定买不走 |
| [`bqp-map`](./bqp-map/README.md) | BQP × NP 调度复杂度地图集 |
| [`burial-record`](./burial-record/README.md) | 埋葬档案的出土与机器审计 |
| [`causal-ineq`](./causal-ineq/README.md) | 因果不等式的可执行化 |
| [`choice-lang`](./choice-lang/README.md) | 「选择」作为语言原语的首个可执行模型（里程碑 #15，无需硬件） |
| [`depreciation-ledger`](./depreciation-ledger/README.md) | claim #17 升格为构建门禁的折旧账本 |
| [`dsic-noether`](./dsic-noether/README.md) | 机制设计的对称层：DSIC × Noether 双层执行（roadmap #12） |
| [`dtc-clock`](./dtc-clock/) | 时间晶体时钟墙的模型层执行：驱动节拍、可逆通用门集、热力学价目表（row #10） |
| [`ent-clearing`](./ent-clearing/README.md) | 纠缠标准的结算层 |
| [`ent-sched`](./ent-sched/README.md) | 分布式纠缠调度原型（未来技术版图 #3） |
| [`ft-qaoa`](./ft-qaoa/README.md) | 容错深度 QAOA 路线原型 |
| [`k-switch`](./k-switch/README.md) | k! 个拓扑序上的序叠加，可执行 |
| [`letter-audit`](./letter-audit/README.md) | 「信」的全文审计——升级方法反过来也审计自己的登记处 |
| [`mutant-census`](./mutant-census/README.md) | 突变体名册：错误面登记与族谱审计 |
| [`nonstoq-anneal`](./nonstoq-anneal/README.md) | 非 stoquastic 退火路线原型 |
| [`nosignal-tariff`](./nosignal-tariff/README.md) | 无信号关税的单页明细 |
| [`phase-law`](./phase-law/) | 组合相位律：经典启发式在耦合分配赛道于何处丢失精确最优（λ* 阈值 / 景观机制 / 标度，裁判恒为穷举） |
| [`postselect-sched`](./postselect-sched/README.md) | 后选择调度：多世界分拣器作为可调度原语 |
| [`qram-sched`](./qram-sched/README.md) | qRAM 加速在线调度：定理层，机器验证 |
| [`quantum-mech`](./quantum-mech/README.md) | 量子机制设计原型（未来技术版图 #4） |
| [`qverify`](./qverify/README.md) | 委托计算验证背后的定理层的机器验证 |
| [`readout-wall`](./readout-wall/README.md) | 不定因果序的测量墙，汇率账本化执行 |
| [`retro-cache`](./retro-cache/README.md) | 无信号关税的追溯缓存账本 |
| [`route-price`](./route-price/README.md) | 地图集两条 OPEN 行的路线与定价 |
| [`stable-world`](./stable-world/README.md) | 稳定性作为物理而非编译（row #15 的成本列） |
| [`survivor-census`](./survivor-census/README.md) | 多世界分拣器实际保留了谁 |
| [`switch-sched`](./switch-sched/README.md) | 不定因果序定理层的可执行化 |
| [`vacuum-compiler`](./vacuum-compiler/README.md) | 基态编译器（roadmap #11），带能量账本 |
| [`wukong-crossval`](./wukong-crossval/README.md) | 本地精确引擎 × 真 QPU 交叉验证管线（本源悟空机时申请配套） |

## 仓库导览

| 路径 | 内容 |
|---|---|
| [`DELIVERY/`](./DELIVERY) | 交付物：代码质量审计报告（txt/html/docx）、升级实施与质量波计划 |
| [`.cluster/`](./.cluster) | 多智能体集群工程留痕（代码质量审计、升级工程两次会战） |
| [`.formwork/`](./.formwork) | 仓库元工具：打包 / 补丁 / 元数据脚本 |
| [`.github/`](./.github) | CI（`ci.yml`）与 `publish.yml` workflow、Dependabot |

## 许可

MIT（主平台 `package.json` 声明）。
