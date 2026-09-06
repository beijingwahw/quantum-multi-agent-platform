# citations.md — 引用核实记录（2026-09-05 检索原文/官方页）

按本项目惯例：进入文档的每条引用都经过 web 检索核实（题目、作者、
出处、关键声称）。标注 [full] = 拉到摘要/全文核实；[ref] = 官方
收录页核实（DOI/期刊信息）。

## 机制设计（经典锚点）

1. **Myerson, "Optimal Auction Design", Mathematics of Operations Research
   6(1):58–73 (1981).** [ref] DOI 10.1287/moor.6.1.58（INFORMS/JSTOR/ACM
   三方收录一致）。最优拍卖理论、揭示原理、收入等价——DSIC 概念源头。
2. **Vickrey (1961), Clarke (1971), Groves (1973).** VCG 家族出处，教科书
   级，不再单独检索。
3. **Nisan & Ronen, "Algorithmic Mechanism Design", STOC 1999 /
   Games and Economic Behavior 35:166–196 (2001).** [ref] 真实机制下
   VCG 近似性能与下界——T5 的经典地基。
4. **Nisan, "Computationally Feasible VCG Mechanisms" (2007),
   JAIR 29:19–47 / arXiv:1104.0056系列.** [ref] 点名"用近似分配器 +
   Groves 支付"的陷阱。T5 引语。

## 量子拍卖与量子机制设计（先行工作，定位用）

5. **Naseri, "Secure quantum sealed-bid auction", Optics Communications
   282:1623 (2009).** [ref] GHZ 态密封竞价首篇（ScienceDirect 摘要核实：
   "experimentally feasible... quantum secure direct communication"）。
   后续系（Xu & Li 2021 同时升价拍卖、2021 量子秘密分享版、2023
   Photonics 局域算子版、2023 EPJ Plus 相位编码版、2025 QF 多方安全
   计算版）均经检索确认存在——全是密码协议，无激励相容定理。
6. **Hogg, Harsha, Chen, "Quantum Auctions", Int. J. Quantum Information
   5:751–780 (2007), arXiv:0704.0800.** [full] 摘要原文核实："superposition
   bids... distributed search... measurement gives the outcome while
   destroying the superposition, so non-winning bids are never revealed"
   + 博弈分析节 + "incentive rather than computational constraints affect
   quantum algorithm choices"。本仓库 T2c 把其输家隐私想法做成可执行
   协议 + 裁判。
7. **Wu, "Quantum mechanism helps agents combat 'bad' social choice
   rules" (2010), arXiv:1002.4294；"Quantum Bayesian Implementation and
   Revelation Principle" (2011), SSRN 1831964.** [ref] 量子策略进机制
   设计 + 贝叶斯设定下揭示原理失效。T1 边界讨论中如实区分。
8. **Rubinstein, Wolitzky et al., "Quantum Communication Complexity of
   Classical Auctions", ITCS 2025 / arXiv:2311.12444.** [ref] 通信复杂度
   视角，非激励视角。

## 量子信息（物理锚点）

9. **Wiesner, "Conjugate Coding", SIGACT News 15:78–88 (1983)**（构思于
   1960s 末）。[ref] 量子货币/共轭编码源头——T2 锁定与 T3 抵押代币。
10. **Wootters & Zurek, "A single quantum cannot be cloned", Nature
    299:802 (1982)**（与 Dieks 独立）。[ref] no-cloning。
11. **Mayers, "Unconditionally Secure Quantum Bit Commitment is
    Impossible", PRL 78:3414 (1997)；Lo & Chau, PRL 78:3410 (1997).**
    [ref]（APS 官方 DOI 页 + Brassard 综述 arXiv:9712023 交叉确认）
    承诺 no-go——T4 墙。
12. **Hughston, Jozsa & Wootters, Phys. Lett. A 183:14 (1993).** HJW
    系综分解/steering 定理——T4 引擎（教科书级，未单独检索）。
13. **Coffman, Kundu & Wootters, "Distributed Entanglement", Phys. Rev. A
    61:052306 (2000).** [ref] CKW 单配性不等式（Wikipedia/Quantiki/
    Osborne-Verstraete PRL 96:220503 (2006) 推广一起核实）——T3。
14. **Wootters, "Entanglement of Formation of an Arbitrary State of Two
    Qubits", PRL 80:2245 (1998).** concurrence 公式——T3 数值（教科书级）。
15. **Holevo (1973).** χ 界——T2a 上界语言（教科书级）。
16. **BB84 / 6-state QKD 家族。** 基猜测攻击模型与扰动率的对照来源
    （教科书级）。
17. **Bužek & Hillary (1996) / Bruß 等最优克隆界：** BB84 族 1→2 克隆
    保真度 (1+1/√2)/2 ≈ 0.854——T2b/T3 引用的上界（教科书级，未模拟）。
18. **Aaronson & Christiano, "Quantum Money from Hidden Subspaces",
    STOC 2012**（及 Farhi et al. 2007）。[ref] 公钥量子货币现状——T3
    诚实边界。

## 检索工具记录

- arXiv abs 页 ×2（0704.0800 全摘要；2311.12444 摘要）；
- APS/INFORMS/JSTOR/ScienceDirect/Semantic Scholar 收录页若干；
- 检索日期 2026-09-05；无一条引用是凭记忆写入的。

## 与先行工作的差异声明（诚实定位）

- 量子拍卖协议文献（Naseri 系、Hogg et al.）解决**保密性/隐私**，
  不证明激励定理；本仓库补的层是 DSIC 守恒（T1）与求解器激励危险
  （T5）的机器验证。
- Hogg et al. 已提出"输家竞价永不揭示"与初步博弈分析；本仓库将其
  做成带独立裁判的可执行协议并量化（transcript 枚举、扰动率、锁定 χ）。
- Wu 的揭示原理失效发生在贝叶斯-算法机制；本仓库 T1 是主导策略-
  无计算约束侧的守恒律，两不冲突，边界在 theory.md 写明。
