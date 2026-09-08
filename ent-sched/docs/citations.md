# citations.md — v0.2 新增文献锚点（全部原文核实，2026-09-08）

核实规程：每条标识符（arXiv ID、作者、年份、标题）经两个独立来源交叉
确认（arXiv abs 页 + INSPIRE 或 Semantic Scholar API），绝不凭记忆。
经典锚点（Briegel-Dür-Cirac-Zoller、BBPSSW、DEJMPS、Żukowski、Pant、
Q-CAST、Vardoyan、Even-Itai-Shamir）见 README 引用锚点一节，此处不重复。

## 纠缠新鲜度 / Age of Entanglement（估计器+鲁棒性面的最近邻）

- Elif Tugce Ceran, "Age of Entanglement in Satellite Repeater Chains with
  Intermittent Availability", IEEE INFOCOM 2026. arXiv:2602.23985.
  https://arxiv.org/abs/2602.23985
  （把经典 AoI 推广为含退相干/存储/概率生成的 AoE 指标，MDP 相对值迭代
  求最优控制。与 exp6 的 T₂ 误信轴同一问题意识：新鲜性必须在退相干下
  定义。锚点：其 MDP 方法未在本仓库复现。核实：arXiv + INSPIRE 3179264。）
- Ozgur Ercetin, Zafer Gedik, "Fidelity-Age-Aware Scheduling in Quantum
  Repeater Networks", arXiv:2602.09562 (2026).
  https://arxiv.org/abs/2602.09562
  （Fidelity-Age：自上次交付保真度达标 Bell 对起的时间；Lyapunov 漂移
  型调度器。与本仓库 fMin 门 + 截止释放同族；锚点，未复现。核实：
  arXiv + Semantic Scholar。）
- Stavros Mitrolaris, Subhankar Banerjee, Sennur Ulukus, "Age-Based
  Scheduling for a Memory-Constrained Quantum Switch", IEEE INFOCOM 2026.
  arXiv:2601.11698. https://arxiv.org/abs/2601.11698
  （有限存储量子开关上的年龄度量 AoEE 闭式与调度族；与本仓库 slots
  占用记账同问题维度。锚点，未复现。核实：arXiv + INSPIRE 3110672。）

## 保真度保证路由 / 纯化规划

- Anthony Gatti, Anoosha Fayyaz, Prashant Krishnamurthy, Kaushik P.
  Seshadreesan, Amy Babay, "Fidelity-Guaranteed Entanglement Routing with
  Distributed Purification Planning" (Q-GUARD), arXiv:2605.00246 (2026).
  https://arxiv.org/abs/2605.00246
  （k-hop 局部链路态下的逐请求保真度阈值路由 + 分布式纯化成本表；与
  ERS 纯化阶梯 + 严格 fMin QoS 同族。其"Werner 态均分逐跳目标"规则未
  在本仓库采纳——我们的阶梯按等保真度配对（theory §6 三定律）。
  锚点，未复现。核实：arXiv + INSPIRE 3150916。）

## 采纳状态（诚实声明）

四条均为**引用锚点**，非复现方法：其 MDP / Lyapunov 漂移机件不在本零依
赖仓库的复现范围。本仓库采纳的是问题框架——保真度-新鲜
度联合度量、记忆约束下的年龄调度、逐请求保真度门——它们在 v0.2 里的
对应物（信念镜像、释放审计账本、T₂ 误信轴）全部由本仓库自己的机器
执行（out/exp6-robustness.md）。前沿定理是锚，不是本仓库的声称。
