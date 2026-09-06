# citations — 双源核实入册

> 纪律：每条引用两个独立来源；先 grep 原文再入册，从不凭记忆（批 22 教训）。
> 引用支撑的是方法的地基；本仓的可执行主张（错误史→算子→门禁的耦合）不需要
> 文献背书——它需要的是 `npm test`。

## DEM78 — mutation testing 的奠基

- R. A. DeMillo, R. J. Lipton, F. G. Sayward, "Hints on Test Data Selection: Help
  for the Practicing Programmer", *Computer* 11(4):34–41, April 1978.
- 来源 1（题录）：DBLP, https://dblp.org/pid/10/3823 （确认刊名/卷期/页码）
- 来源 2（全文）：Saarland 大学托管 PDF,
  https://www.st.cs.uni-saarland.de/edu/recommendation-systems/papers/Hints_on_Test_Data_Selection-1.pdf
  （另有 PUCRS 镜像 https://www.inf.pucrs.br/~zorzo/cs/demillo-mutants.pdf）
- 备注：标题常被误引为 "...Pessimistic Programmer"（悲观程序员是论文内部的修辞，
  标题写的是 **Practicing**）——本册按找到的原文记录，不按记忆。

## JIA11 — 领域综述（30 年脉络）

- Yue Jia, Mark Harman, "An Analysis and Survey of the Development of Mutation
  Testing", *IEEE Transactions on Software Engineering* 37(5):649–678, 2011.
- doi: 10.1109/TSE.2010.62
- 来源 1：https://doi.org/10.1109/TSE.2010.62 （IEEE）
- 来源 2：https://dl.acm.org/doi/10.1109/TSE.2010.62 （ACM DL 交叉题录）
- 用途锚：等价突变问题是领域公开问题（本仓边界一节的出处）。

## CLA00 — property-based testing 的奠基

- Koen Claessen, John Hughes, "QuickCheck: A Lightweight Tool for Random Testing
  of Haskell Programs", *ICFP 2000*, pp. 268–279.
- doi: 10.1145/351240.351266
- 来源 1：https://dl.acm.org/doi/10.1145/351240.351266 （ACM DL 官方页）
- 来源 2：https://en.wikipedia.org/wiki/QuickCheck （工具条目交叉锚）
- 用途锚：性质 ≠ 例子——"对全体生成输入成立"的方法论出处。

## 内部锚（本册的另一半出处）

- 埋藏记录（错误史来源）：`burial-record/out/reports/the-burial-record.md`，
  31 批 187 错，每错两列——本仓 M 板每行的 provenance 均可在该册按批次号查到原文。
- 家系形制：`stable-world/src/core/*`（本仓 src/core 为其字节级拷贝，K 板在案）。
- 上游法律形制：depreciation-ledger（L 系法律）、stable-world（SW 系法律）——
  Q 系法律的体例先例。
