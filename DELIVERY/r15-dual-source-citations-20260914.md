# R15 文献双源核实台账（九十访，2026-09-14）

令牌：R14 总册「命名未来候选」之「全部设计稿的文献双源核实」。核实人：代理 C1（平台半区 18 条）、代理 C2（研究仓半区 19 条）、编排者（代码注释补核 7 条）。规程：每条两独立源（Crossref/arXiv abs/期刊官网/DOI 解析 × Semantic Scholar/zbMATH/DBLP/AMS/MIT CSAIL/出版社页），标识符级数据（卷页/DOI/arXiv 号/作者序/年份）**只从源抄录**。判定汇总：**CONFIRMED 29 ｜ CORRECTED 14 ｜ NOT-FOUND 2（另半条）**。

## 甲、平台半区（C1，18 条）

| # | 原形状 | 判定 | 双源要点 | 更正后形状 |
|---|---|---|---|---|
| 1 | Kernighan-Lin 1970 partitioning heuristic | CONFIRMED | Crossref DOI 10.1002/j.1538-7305.1970.tb01770.x（BSTJ 49(2):291-307）＋Semantic Scholar 同 DOI | B.W. Kernighan, S. Lin, Bell Syst. Tech. J. 49(2):291-307 (1970) |
| 2 | Kruskal 1956 最小生成树 | CONFIRMED | Crossref DOI 10.1090/S0002-9939-1956-0078686-7＋AMS 官方页＋S2 | J.B. Kruskal, Proc. AMS 7(1):48-50 (1956) |
| 3 | Klein cycle-canceling（年代待核） | CONFIRMED＝1967 | Crossref DOI 10.1287/mnsc.14.3.205＋Cambridge 参考页（S2 标 1966 为源间分歧，以 DOI 注册库为准） | M. Klein, Management Science 14(3):205-220 (1967) |
| 4a | Tomizawa 1971 位势法 | CONFIRMED | Crossref DOI 10.1002/net.3230010206＋S2＋Cambridge | N. Tomizawa, Networks 1(2):173-194 (1971) |
| 4b | Iri 1960 位势法 | CONFIRMED | S2＋arXiv:2208.11325 参考文献行（无 Crossref DOI——1960 旧卷未注册） | M. Iri, JORSJ 3:27-87 (1960) |
| 5 | Johnson 1977 | CONFIRMED（＝Johnson 算法原文） | Crossref DOI 10.1145/321992.321993＋MIT CSAIL JACM 书目 | D.B. Johnson, JACM 24(1):1-13 (1977) |
| 6 | 「Haji-Newell 型」集聚调度 | CONFIRMED（真实锚存在） | Crossref DOI 10.1137/0120028＋S2 | R. Haji, G.F. Newell, SIAM J. Appl. Math. 20(2):224-240 (1971)；后续锚 Van Mieghem 1995（广义 cμ） |
| 7 | 网络对偶定价（Schweppe 1988?） | CONFIRMED | Crossref DOI 10.1007/978-1-4613-1683-1＋zbMATH 1038748 | F.C. Schweppe, M.C. Caramanis, R.D. Tabors, R.E. Bohn, Spot Pricing of Electricity, Kluwer (1988) |
| 8 | Thompson 1933 | CONFIRMED | Crossref DOI 10.1093/biomet/25.3-4.285＋S2 | W.R. Thompson, Biometrika 25(3-4):285-294 (1933) |
| 9 | Auer-Cesa-Bianchi-Fischer 2002 | CONFIRMED | Crossref DOI 10.1023/A:1013689704352＋Springer 官方页 | Machine Learning 47(2-3):235-256 (2002) |
| 10 | Russo 等 2018 tutorial（JMLR?） | **CORRECTED（刊物）** | Crossref DOI 10.1561/2200000070＋arXiv:1707.02038 journal-ref | D.J. Russo, B. Van Roy, A. Kazerouni, I. Osband, Z. Wen, Foundations and Trends in ML 11(1):1-96 (2018)——**非 JMLR** |
| 11 | Floyd-Jacobson 1993 RED | CONFIRMED | Crossref DOI 10.1109/90.251892＋S2 | IEEE/ACM ToN 1(4):397-413 (1993) |
| 12 | Cowtan-Duncan 2020（TQC?） | **CORRECTED（载体＋作者序）** | arXiv:1906.01734 journal-ref＋Crossref DOI 10.4204/EPTCS.318.13 | A. Cowtan, S. Dilkes, R. Duncan, W. Simmons, S. Sivarajah, EPTCS 318:213-228 (2020)（QPL 2019 论文集）——**非 TQC** |
| 13 | Wald 1945 | CONFIRMED | Crossref DOI 10.1214/aoms/1177731118＋zbMATH | Ann. Math. Statist. 16(2):117-186 (1945) |
| 14 | Scott-Berger 2010 | CONFIRMED | Crossref DOI 10.1214/10-AOS792＋arXiv:1011.2333 | J.G. Scott, J.O. Berger, Annals of Statistics 38(5):2587-2619 (2010) |
| 15 | Liu-Jaeger 2009 PMAC | **NOT-FOUND** | 多渠道（含 Jaeger 组全出版页逐条核查）无此文 | 建议替换：Rueda-Vijayakumar-Jaeger, SACMAT 2009（同年同组同主题唯一真实文献）；或 IBM PMAC 平台（Jacob et al., IBM Redbooks 2004） |
| 16 | Stokes-Guasco-Barthe 2020 QNG | **CORRECTED（作者序幻觉）** | Quantum 期刊官方页＋arXiv:1909.02108 | J. Stokes, J. Izaac, N. Killoran, G. Carleo, Quantum 4, 269 (2020)——**Guasco/Barthe 非作者** |
| 17 | Egger 等 7 人 2021 warm-start | **CORRECTED（作者序幻觉）** | Quantum 官方页＋arXiv:2009.10095 | D.J. Egger, J. Mareček, S. Woerner, Quantum 5, 479 (2021)——**仅三人** |
| 18 | Neely 2010 专著 | CONFIRMED | Crossref DOI 10.2200/S00271ED1V01Y201006CNT007＋zbMATH＋USC 官方页 | Morgan & Claypool Synthesis Lect. Commun. Netw. (2010) |

## 乙、研究仓半区（C2，19 条）

| # | 原形状 | 判定 | 双源要点 | 更正后形状 |
|---|---|---|---|---|
| 1 | Krawtchouk 1929 | CONFIRMED（附备注） | arXiv:quant-ph/0702073 参考行＋St Andrews 传记/Seneta 传记 | M. Krawtchouk, C. R. Acad. Sci. Paris 189:620-622 (1929)；乌语全版卷页无双源，**不写标识符** |
| 2 | Sakurai-Napolitano 教材 | CONFIRMED | CUP 官方页＋NASA ADS | Modern Quantum Mechanics, 3rd ed., CUP (2020)（微扰层级＝第 5 章） |
| 3 | Levin-Peres-Wilmer | CONFIRMED（署名备注） | AMS mbk-107＋作者官网二版 PDF | Markov Chains and Mixing Times, AMS（1e 2009 / 2e 2017，2e 扉页 Wilmer 为 with contributions by） |
| 4 | Horodecki-Oppenheim 2002（PRA?） | **CORRECTED（首作者＋刊物）** | APS DOI 页＋arXiv:quant-ph/0112074 | J. Oppenheim, M. Horodecki, P. Horodecki, R. Horodecki, PRL 89, 180402 (2002)——**首作 Oppenheim，PRL 非 PRA** |
| 5 | Sagawa-Ueda 2008/2010 | CONFIRMED（2008 主篇） | APS DOI＋arXiv:0710.0956 | T. Sagawa, M. Ueda, PRL 100, 080403 (2008) |
| 6 | 4.267「定理级锚」 | **CORRECTED（性质误记）** | Wiley DOI 10.1002/rsa.20090＋arXiv:cs/0309020 | 4.267 出自 Mertens-Mézard-Zecchina cavity **推测**（RSA 28(3):340-373, 2006）；严格侧拆引：Friedgut JAMS 12(4) 1999（尖锐性）＋Ding-Sly-Sun Ann. Math. 196(1) 2022（k≥k₀）——**「4.267 定理」不存在** |
| 7 | Neely 2010 | CONFIRMED（与甲-18 互证） | Springer＋ACM/archive.org | 同甲-18 |
| 8 | Fitzsimons-Kashefi 2017 | **CORRECTED（题名）** | APS DOI＋arXiv:1203.5217 | "Unconditionally Verifiable Blind Quantum Computation", PRA 96, 012303 (2017) |
| 9 | GYNI 三体博弈 | **CORRECTED（作者/年份/刊物全换）** | arXiv:1003.3844＋APS DOI | M.L. Almeida, J.-D. Bancal, N. Brunner, A. Acín, N. Gisin, S. Pironio, "Guess Your Neighbor's Input", PRL 104, 230404 (2010) |
| 10 | ARA14 N-switch（NJP?） | **CORRECTED（刊物）** | APS DOI＋arXiv:1401.8127 | M. Araújo, F. Costa, Č. Brukner, PRL 113, 250402 (2014) |
| 11 | Troyer-Wiese 2005 | CONFIRMED | APS DOI＋arXiv:cond-mat/0408370 | PRL 94, 170201 (2005) |
| 12 | Bravyi 2015 去符号（Acta? PRA?） | **CORRECTED（题名/刊物）** | arXiv:1402.2295 journal-ref＋Rinton 官方 DOI 页 | S. Bravyi, "Monte Carlo simulation of stoquastic Hamiltonians", QIC 15(13/14):1122-1140 (2015) |
| 13 | Wang-You-Bhattacharyya AAAI 2021 | **CORRECTED（作者序）** | arXiv:2007.07049＋AAAI OJS DOI 10.1609/aaai.v35i11.17212 | D. Wang, X. You, T. Li, A.M. Childs, AAAI 35(11):10102-10110 (2021)——**无 Bhattacharyya** |
| 14 | Jaques-Rattew 2021 计量回本 | **NOT-FOUND** | 多轮检索无此文 | 建议替换：S. Jaques, A.G. Rattew, "QRAM: A Survey and Critique", Quantum 9, 1922 (2025), arXiv:2305.10310 |
| 15 | Lin-Rado 1965 | CONFIRMED | ACM DOI 10.1145/321264.321270＋S2/mrob 史页 | S. Lin, T. Rado, JACM 12(2):196-212 (1965)（S(3)=21, Σ(3)=6） |
| 16 | Chernoff 1952 | CONFIRMED | NUMDAM/DML＋S2 | Ann. Math. Statist. 23(4):493-507 (1952) |
| 17 | Le Boudec-Thiran 2001 | CONFIRMED | Springer 章节＋DBLP/作者官网 | Network Calculus, LNCS 2050, Springer (2001) |
| 18 | Høyer-Neerbek-Shi 2002（QIC? FOCS?） | **CORRECTED（刊物）** | arXiv:quant-ph/0102078＋Springer DOI 10.1007/s00453-002-0976-3 | Algorithmica 34(4):429-448 (2002)（会议先行 FOCS 2001） |
| 19a | Knuth TAOCP vol.3 | CONFIRMED | ACM DL＋Google Books | 2nd ed., Addison-Wesley (1998), ISBN 0-201-89685-0 |
| 19b | Liu-Jaeger 2009 PMAC（半条） | **NOT-FOUND** | 密码学 ePrint/Scholar 均无 | 若指密码学 PMAC：J. Black, P. Rogaway, EUROCRYPT 2002, LNCS 2332:384-397；与最小权限语境不符——**该设计引用作废**，改用甲-15 替换建议 |

## 丙、编排者补核（7 条，代码注释标记清偿）

| # | 原形状 | 判定 | 双源要点 | 更正后形状 |
|---|---|---|---|---|
| 1 | Koopmans 1951 | CONFIRMED | Cowles Yale 官方 PDF＋JSTOR/Internet Archive | T.C. Koopmans, "Analysis of Production as an Efficient Combination of Activities", 收于 Activity Analysis of Production and Allocation（Cowles Monograph 13, Wiley 1951）Ch. III, pp. 33-97 |
| 2 | Roberts 1959 EWMA | CONFIRMED | T&F DOI 10.1080/00401706.1959.10489860＋JSTOR 1266443 | S.W. Roberts, Technometrics 1(3):239-250 (1959) |
| 3 | Balseiro-Besbes 2019 | **CORRECTED（年份/刊物）** | SSRN＋INFORMS/RePEc（OR 69(3) 2021）；2019 的 pacing-对偶专文是另一篇 | Balseiro-Besbes, Operations Research 69(3):859-876 (2021)；Balseiro-Gur, Management Science, DOI 10.1287/mnsc.2018.3174 (2019) |
| 4 | Dijkstra 1959 | CONFIRMED | Springer DOI 10.1007/BF01386390＋CWI/HAL/EuDML | Numerische Mathematik 1:269-271 (1959) |
| 5 | Mitarai 等 2018 | CONFIRMED（编排者自猜卷号被源纠正） | APS DOI＋arXiv:1803.00745＋阪大库 | K. Mitarai, M. Negoro, M. Kitagawa, K. Fujii, PRA **98**, 032309 (2018) |
| 6 | Schuld 等 2019 参数移位 | **CORRECTED（作者序漏 Izaac＋卷号）** | arXiv:1811.11184 作者表＋APS DOI 页 | M. Schuld, V. Bergholm, C. Gogolin, J. Izaac, N. Killoran, "Evaluating analytic gradients on quantum hardware", PRA **99**, 032331 (2019) |
| 7 | Dantzig-Ford-Fulkerson 1956 | **CORRECTED（混记拆分）** | SCIRP 引文行＋Chvátal MoOR 1976 综述＋ResearchGate | LP 对偶证书用法＝Dantzig-Fulkerson-**Johnson** 1954, Operations Research 2:393；网络对偶＝Ford-Fulkerson 1956（最大流，形状级引用） |

## 处置记录

- 平台五模块代码注释的〔待双源〕标记全部清偿（admission-control/min-cost-flow-potentials/entanglement-batch-composer/natural-gradient/parameter-shift）——标识符数据就地写入，注明年份/卷页/DOI/arXiv 均自本台账源抄录。
- R14 总册的设计稿形状维持原文＋本台账为权威更正面（NOT-FOUND 两条的设计引用作废，替换锚已列）。
- 新增教训（入埋藏第 97 批）：编排者在 C1 提示词中凭记忆写的两个作者序（Stokes-Guasco-Barthe、Egger 七人序）都被核实为幻觉——「记忆持有文献的形状、永远不持有数字/作者序」再添正例；编排者自查补核时又错两次（Mitarai 卷号、Schuld PRA 号），皆被第二源纠正。
