# 全量代码逐行审查 — 2026-09-27

目标：git 全部受控代码（~1488 文件 / ~25.8 万行 TS/JS/Py/YML）逐行过一遍，不放过错误。

## 方法与分工（诚实披露）
- **本人亲自逐行读**：平台 `ds_extracted/ds/src` 全部 78 文件（~3.3 万行）——utils/types/constants、core 全部 33 文件（求解器、子空间引擎、并行内核、调度器、全部市场机制）、qpu 全部 13 文件、quantum-bus、proactive-intelligence 全部 14 文件、dsh、bench、tools、index/cli。
- **20 个并行审查代理逐行读**（全部源码/测试/实验/配置；锁文件与生成 JSON 仅结构校验；每条 P1/P2 及 P3 抽样 5/5 均已由本人对原文逐条复核确认）：29 个研究仓全部代码、平台 tests 全部 117 文件、_x1_bench、examples、experiments、scripts、tmp、.cluster、.github CI、DELIVERY、docs py、.formwork。
- 覆盖率：**全部手写代码 100% 逐行过**（代理 UNREAD 清单仅含 package-lock.json、生成 JSON dump、mutant-census 的 25 个同源渲染卡片——其生成器已全文审计）。

## 总体结论
平台（ds_extracted/ds）src 层质量极高：78 文件逐行审查仅 1 条边界缺陷。全部 P1 集中在研究仓的实验/机制代码。以下为经复核确认的发现清单。

---

## [P1] 可达路径错误结果/崩溃（3 条，本人已复核原文）

1. **nonstoq-anneal/src/experiments/exp5-scale.ts:56** — `bits |= 1 << i`（n=48/64 时 int32 回绕，site≥32 混叠到低位）；mpsAmplitude 的 `(bits >>> i) & 1` 同样回绕。**已发布的 n=48/64 共 6 行 signP/negativeFraction 数据被污染**（n=48/κ=1 行 signP=1、negFrac=1——~50/50 符号结构上不可能）；README.md:173 与 docs/hardware-spec.md:36 引用的 "46-52% @ n=64" 出自坏采样器。仓内已有正确的 64 位例程 amplitude64（designed-basis.ts:285）未被使用。

2. **dsic-noether/src/continuum/quartic.ts:103** — `w = pAdd(w, pSub(oj3, pScale(xj4, rat(1, 4))))`：文档（:96）要求 Σ(o³·x − o⁴/4)，立方项缺 `×xj` 因子（姊妹函数 qKappaWMinusI:294 写法正确）。**qGrovesPayment 返回的不是所记家族的 Groves 支付**（偏差 Σ(o⁴−o³)/other）；W₋ᵢ 与 s 无关故残差全部抵消——现有测试与 exp6 同义反复地通过。

3. **k-switch/src/kswitch/promise.ts:157** — `g.im[q][p] = s * Math.sin(phi)`：复 Givens 非共轭配对，**G 非幺正**（实测单层 max|U†U−I|=1.0，randomUnitary 组合 2.318；正确实现此行应为负号）。interleavedDistinguishability 输出非物理数（范数漂移 0.12–0.9），已发布 exp1/exp3 报告的 "max distinguishability 1.000000/0.999773" 及 test/k4.test.ts:145 断言均基于坏探针。

## [P2] 边界路径错误结果 / 误导性输出（11 条，本人已复核原文）

4. **ent-sched/src/physics/ladder.ts:147** — `closed[slots - 2]`：slots=1（验证器接受）→ undefined → wernerComposite 产出 NaN，NaN 击穿物理性守卫（NaN 比较恒 false），导出 API 静默返回 NaN。实测 saturationLadderSim(0.85, 1) → NaN。
5. **quantum-mech/src/contract/monogamy.ts:45** — 2×2 厄米行列式漏 Im(ρ01)²：det 高估 → cABC/tangle 虚高（实测 0.950 vs 真值 0.906）；exp3-escrow 的 "worst CKW slack −5.90e-3" 出自膨胀值（不等式方向侥幸安全）。
6. **qverify/src/protocol/cloner.ts:97** — `im += sj * ck - cj * sk` 符号反：environmentState 返回真环境密度矩阵的共轭转置（数值验证：虚部逐项取反）。导出 API；当前唯一消费者（traceDistance）转置不变故被洗白。
7. **qverify/src/protocol/chsh.ts:143** — 只翻 a₁ 方向得 S′=e00+e01−e10+e11 ≠ −S："normalize sign so S>0" 不成立；负 S 输入下 sFromAngles 与 |S| 无关（导出 API；仓内优化器只返回正 S 角度故潜伏）。
8. **dsic-noether/src/continuum/kink.ts:394** — wallGridWitness 对（报告内部、真类型 walled）格点用 interior 公式 Φ(x_int(s))−Φ(x_int(t))，而真值应对照 Φ(0)：**下界充当了 DSIC 证书所需的上界**，该格点类被"认证"而未真评估（s=2,t=1 等格点在 shipped 网格内实际存在）。
9. **vacuum-compiler/experiments/exp4-boundary.ts:85** — route-price 引用钉 0.3.0 而该仓现为 0.4.0：auditBoundaryCitation 实测判 "version drift"，`npm run repro`（run-all 含 exp4）直接失败；已发布报告行 "route-price W-E (v0.3.0) ACCEPTED" 不可复现。
10. **readout-wall/src/kernel/globalwall.ts:410** — 中点二阶差分 D = χ''·(b−a)²/**4**，代码按 /2 缩放对照目标（大 2 倍）；README 引用的 "cross-check max distance 5.6e-6" 全是该伪影（正确缩放下真实一致性 4.5e-11）。数据面（不门控 ok），方向保守。
11. **phase-law/src/kernel/law.ts:631** — `globalIsLocalOptimum: betterNeighbor[globalIdx] === -1` 恒真（全局最优按定义无严格改进邻居）：PL3 "law" 与证人 W-C 是零判别力的同义反复。
12. **ds_extracted/ds/examples/quantum-breakthrough-benchmark.ts:91** — 经典侧福利只记 weights 不含耦合加成，却对照含耦合的 brute.welfare/optimalWelfare：贪心/局部搜索的 gap 系统性虚高（根 README:131 勘误点名的正是此缺陷，本示例未修）。
13. **ds_extracted/ds/tests/bench/wasm-simd-prototype.evaluated.ts:27** — `globalThis as {Module…}` 应为 `globalThis.WebAssembly`：`WA.Module is not a constructor`，两个可执行测试全挂（实测）；knip 保留的 "WASM 裁决证据" 已不可复现（.evaluated.ts 不进 CI glob 故无人发现）。
14. **bqp-map/src/upper/dhmin.ts:49** — 索引循环触发 prefer-for-of：全仓唯一 lint 红（eslint 实测恰 1 错），`npm run lint` 退出码 1——即提交信息中披露的已知遗留。

## [P3] 潜在隐患 / 文档-行为矛盾 / 同义反复测试（45+ 条；P1/P2 之外按仓列出，抽样 5/5 已亲核）

**平台（ds_extracted/ds）**
- src/core/subspace-optimizer.ts:1051 — spectralWidth=0（维度退化 1 的实例）时 denormalizeExpectation(0, scale=0,…) → 0/0=NaN，退火解 expectation 字段为 NaN（本人发现）。
- tests/r18a-shadow-price-secant.test.ts:87 — 测试夹具分段函数在 λ=2 处不连续且向上跳（违反被测模块的单调性契约），当前恰好未踩中；:129 注释声称最小可行 λ=5 而真值是 8，断言只挡了半边。
- tests/r19r-sequential-hire-audit.test.ts:267、r19t:251/271、wave1-regressions:178 — 同义反复断言（两侧来自同一布尔、测试本地复刻件、≥0 恒真）。
- tests/regression/optimizer-bus-regressions.test.ts:146 — couplingKey(0,4,12) 注释说 (t1,a1) 实为同 agent 对 (t1,a0)，容量=1 下结构性惰性（纠缠覆盖从未发生）。
- tests/bench/wasm-simd-prototype.evaluated.ts:177/369 — WASM 递推与标量核不同序（im 用更新后 re）；verdict 断言为四值枚举同义反复。
- tests/execution-tier.test.ts:174 — 析取断言同时接受 ftqc-queue/classical，注释声称的确定性结果未被钉住。

**研究仓（各代理发现，引用均已带 file:line 与证据）**
- dtc-clock：thermo.ts:156 文档符号反；board.ts:189 板行声称 11 时点×含 ZZ 的普查、证人实际 6 时点无 ZZ；scratch-life.ts:25 打印 kMax 3000 实跑 1500；beat.ts:635 delta=0 时 τ−1=∞ → 死循环（无守卫；仓内调用均 δ≥0.2 故潜伏）。
- mutant-census：family.ts:260 与 equiv.ts:317/342/359 — 旗舰变异体的构造索引错（4×4 行主序下取到相干元而非联合概率元）："bit-exact" 仅因与被描述的变异体同一处错；render.ts:315 硬编码 19/19、44/44 等计数无 claim 模式守护；repair.test.ts:36 标题 "nine" 实为 13。
- qram-sched：bandit.test.ts:35 同义反复断言（`|| regret>=0` 恒真）；payback.ts:67 m<30 差一（恰在 m=30 可达的 eps 被拒）；exp1 "exactly 2^n/n" 与自身打印数字矛盾（实为 (2^n−1)/n，theory.md 同错）；exp5 标题 "RANKING ≥ greedy" 被同报告 n=16 行反驳；**dist/ 为过期构建**（缺 src 已有的整数地址守卫与整个 payback/grover-bridge 模块）。
- letter-audit：audit.ts:136 W-D 证人 = `halted + (machines−halted) === machines` 恒等式（同义反复）。
- route-price：witnesses.ts:264 `B/1 !== B` 恒假（IEEE 常量）；covariance.ts:151 仅校验第 0 行长度，锯齿内行越过后以裸 TypeError/NaN 落地。
- wukong-crossval：robust.ts:240 band 元组序与接口文档反（[fHi,fLo] vs [fLo,fHi]），渲染端用列名悄悄补偿。
- choice-lang：ledger.ts:52 拒绝消息把 0.4646（gap）标成 cos²·cos²（=0.1204）的值。
- causal-ineq：polytope.ts:208 q2Sign 在 norm<0 且 a,b 同号象限符号错（q2Sign(1+√2)→−1）；现有调用恰好全落在侥幸正确象限。
- ent-clearing：clearing.ts:246 px 取行和（恒 [1/4]×4）而非列和，H(Y) 被钉死 2 bit（当前 decode 为置换矩阵故 MI 侥幸正确）；channels.ts:204 文档 little-endian 实现为 big-endian（死导出）；ghztheta.ts:263 C=2|ρ03| 契约对一般纯对不成立（|Ψ+⟩ 返 0）；audit.ts:160 H6 把一切非 "WERNER" 族名强制折为 DEPOL（伪造族名永不被点名定罪）。
- retro-cache：tariff.ts:171 注释 1/4 与代码 1/2 矛盾（代码对）。
- ent-sched：policies.ts:420 `fSeg < action.fSeg` 析取允许更大 fHi 胜出（违反 "最小 fHi 先融合" 定律，多段场景可达）；theory.md:52 F*=0.810849 与机器值 0.810710 差 1.4e-4；physics.test.ts:152 "非 Werner 输入"夹具经 purify 后仍是 Werner；markov.test.ts:94 标题 q/2 与断言值矛盾。
- nosignal-tariff：chanlib.ts:96 声称的 isometry 校验在 randomChannelStinespring 路径根本不存在（W-A/W-H 两条证人腿未检）。
- phase-law：census.ts:130 比较器优先级错（n 决胜不可达，排序退化为 solver 主序）；board.ts:29 PL1 声称 6×8 视界、证人只跑 2×3/3×5。
- stable-world：render.ts:43 "banked fraction 0.01–0.95" 与同页 W-L 的 0.00–0.37 自相矛盾。
- vacuum-compiler：spectral.ts:268 开区间根计数在端点为根时多计 1（潜伏）；exp4 见 P2。
- readout-wall：cmat.ts:487 reconstruct 丢弃负本征值（不定厄米输入被拒，契约 "Σλvv†=H" 破）；kswitch3.ts:35/kswitch4.ts:15 注释与实现/数据矛盾（置换方向、3-循环计数 2/3 实为 4/4）。
- ft-qaoa：estimate.ts:100 分钟换算差 16.67×（1min=6e7μs 非 1e9）；decoder-scheduler.ts:87 units<blocks 时夹取违背 "spread across blocks" 契约（utilization/backlog 低估）。
- switch-sched：states.ts:100 Weyl 实现为 Z^{-b} 与文档 Z^b 反（消费者符号不敏感）；channels.ts:105 端序文档反；exp3-sched-contact.ts:82 擦除信道实现为 |0⟩ 文档写 |+⟩；exp1-switch-algebra.ts:96 d=2 却循环 bi<4（一半试验为零态比较）；gyni.ts:210 持有公式注释与 OWNERS 矛盾。
- k-switch：exp5/theory.md 的 "|−⟩⟨−|" 手推错（实为 |+⟩⟨+|，仓内测试已承认 "ray-convention slip" 但三处文案仍发布）；promise.ts:127 max() 首项比较两个不同输入态（≈1 恒主导，k=4 姊妹已修 k=3 未修）；theory.md:140 "d≥8 not executed" 与已交付的 k=5 (d=4) 矛盾；dilution.ts qNum/qDen 未约分与 "lowest terms" 契约矛盾；k4.ts:354 教训注释把 Z⊗Y 写成 I⊗Y。
- **根目录**：.github/workflows/publish.yml:55 — 声称 OIDC trusted-publisher 发布却同时给 NODE_AUTH_TOKEN（token 路径必胜，OIDC 为死配置；或移除 secret 后发布必败）；**.formwork/fill.py:85-87 — 申请人姓名/手机号/邮箱硬编码在被追踪脚本中**（.gitignore 只挡了 work/ 子目录；⚠️ 隐私泄露，历史也在）。

## 覆盖声明
- 平台 src 78/78 文件本人亲读；平台 tests 117/117、_x1_bench、examples、experiments、scripts、tmp、.cluster、CI、DELIVERY、py、根配置由代理全文读并经抽检。
- 29 研究仓 src/tests/experiments/README 全文读（各代理 COVERAGE 逐文件列明）；UNREAD 仅：package-lock.json 类生成文件、out/*.json 数据 dump（结构核验）、mutant-census 25 个同源渲染卡片（生成器已审）。
- 本人不改动任何代码（审查任务）；以上发现均附 file:line 可直接定位。

---

# 整改记录 — 2026-11-01（承接本报告的全量缺陷突破）

方法：P1/P2/敏感项（隐私、CI、平台 src）本人亲改亲验；P3 研究仓集群由 5 个
修复代理并行执行、每条 diff 由本人复核。每仓门禁：test / lint / typecheck /
repro 全绿后方可入账。修复一律带 `2026-11-01 修复/勘误` 日期标注。

## P1×3 — 全部修复
1. **nonstoq exp5**：hi/lo 双字采样替换 `bits |= 1<<i`；复跑后仅 n=64/κ=1 行
   真值改变（signP 0.8531→0.9669，negFrac 0.460→0.744）。⚠️ 诚实修正：独立
   探针（异种子 400 样本 + 全零/全一/单翻转壳）证实 n=48/κ=1 状态**真单号**
   （全局负号），本报告当初"~50/50 结构上不可能"的判断过悲观——该行数值
   碰巧未受回绕影响。README/docs 的 "46-52% @ n=64" 勘误为 ~74%。
2. **dsic quartic.ts**：`×x_j` 恢复，W₋ᵢ = (3/4)Σo⁴；新增直接锚测试（独立构
   造期望多项式，旧代码必挂）。全部残差/报告数值不变（误差只含 o、与 s 无
   关，恰从一切差分中抵消——这正是它当初逃过全部测试的原因）。
3. **k-switch promise.ts**：Givens 共轭（max|U†U−I| 1.0→1.1e-15）+ 连带修
   复审计未单列的两处：①不同随机输入态取 max（≈1 恒主导淹没诚实探针）；
   ②`kron(u2, I2)` 对已是 4×4 的 boxes 双重提升、被 applyUnitaryToState 静默
   截断为非幺正左上块。诚实 k=3 探针 1.000000→0.978871；exp3 (k=4) 0.999773
   →0.999771（仅受益于 Givens 修复）。69 测试全绿。

## P2×11 — 修复 10 条，撤回 1 条
- 4 ladder（slots=1 → S₁=F₀ 恒等元早退+回归测试）、5 monogamy（det 补
  Im(ρ01)²；CKW slack −5.90e-3→−3.12e-4，erratum 永久写入生成器）、7 chsh
  （Alice 双方向同翻，S′=−S；singlet 一性原理回归测试）、8 kink（**新增第四
  块**：报告内部/真类型 walled 的真对照是墙 x=0 而非 interior 外推——旧式给
  出的是该格点增益的下界，DSIC 证书所需上界从未被评估；新块 mn/2−m²/4 严格
  负，worstCross2=−1/64）、9 vacuum exp4（引文钉 0.4.0，repro 全绿）、10
  globalwall（/2→/4，真一致性 4.47e-11，README 勘误+回归测试）、11 phase-law
  PL3（改可证伪形：全局最优+全部邻居经独立 welfareOf 重打分；同仓加修 W-A 补
  6×8 视界、census 比较器 m→n→solver）、12 benchmark 半账（统一 welfareOf；
  复跑独立复现根 README 勘误表 2/5, 2/5, 5/5）、13 wasm-simd（WebAssembly 绑
  定 + 快照序 + 裁决断言三修；位级等价 20 步链首次真实执行并通过）、14 dhmin
  （for-of，bqp-map lint 首次退出 0）。
- ⚠️ **撤回：#6 qverify cloner.ts:97 —— 本审计的假阳性**。原码
  `im += sj*ck − cj*sk` 正是 ρ_E[j][k] = Σ_a Ψ_aj·conj(Ψ_ak)（正确环境密度
  矩阵，Hermitian）。审计当时的"数值验证"把参照系转置了。修复代理以三独立
  裁判（手推 + 独立 partialTrace + 逐元素转置敏感比较，worst 0.00e+0）止步
  并回退，本人重推导确认。**教训：审计自身的裁判也必须被独立审计。**

## P3 — 平台与研究仓
- 平台：denormalizeExpectation 简并谱（max===min）NaN→min（单点收口，四路
  径同享）+ 回归钉；r18a 夹具两处（段 2 真连续 5−0.5λ / 阶梯真边界 λ≥8）；
  r19r 删同义反复计数器断言；r19t 补"索引探针 < 原版扫描"交叉断言；
  wave1 背压夹具改 2 动作规则（peakBacklog 真实测得 >0）；optimizer-bus
  couplingKey(0,4,12)→(0,5,12)（旧键同 agent 对、容量 1 下结构性惰性）；
  execution-tier 钉死确定性 ftqc-queue。
- 研究仓：见下方代理批次记录。

## 隐私 / CI
- `.formwork/fill.py`：姓名/手机号/邮箱/学历/专业/单位（含输出文件名中的姓
  名）移入 gitignored `work/profile.json`，模板 `profile.example.json` 入库；
  脚本功能不变（py_compile + profile 加载验证）。**git 历史中的旧值仍在**，
  彻底清除需重写历史——破坏性操作，留库主决定。
- `.github/workflows/publish.yml`：删 NODE_AUTH_TOKEN（token 必胜使 OIDC 成
  死配置），按文件头声明的 OIDC 基线补 npm≥11.5 步骤。

## 研究仓 P3 集群 — 5 修复代理 × 42 项（每 diff 本人复核）

**D1（dtc-clock / letter-audit / retro-cache / stable-world，7 项）**：thermo 注释
符号、TC15 视界勘误（实跑 X₀/Z₀/Z₁ × 6 时点）、scratch-life 打印对齐、beat δ=0
具名守卫 E/DOMAIN + 回归；letter-audit W-D 改为整表 20736 台机器的独立重数
（旧式恒等套套逻辑，9784+10952=20736 不变）；retro 注释 1/4→1/2（代码对）；
stable-world banked fraction 0.01–0.95→0.00–0.37（按 W-L 重数）。

**D2（mutant-census / qram-sched，8 项）**：旗舰变异体构造索引自第一性原理重推
——联合概率在对角元 (2d,2d)（修正 5 处：MU5、b21#0、b24#2、b15#3、b14#2；
其中 b15#3 为审计未点名的同病第 4 例；判读 9 COLLAPSES/12 ERROR/2 EQUIV/94
UNBUILDABLE 不变，3 个已发布 worst 值诚实更正）；渲染器硬编码计数改数据内插
+ 词语声明（ALL FOUR/nine for nine/TWO SPECIES）不一致即拒印；repair.test 标题
nine→thirteen 并补齐 3 个缺失锚。qram：bandit 同义反复断言删除（连带揪出系数
错 20000→18800）；payback m≤30 双侧边界；exp1 公式 (2ⁿ−1)/n；exp5 标题改为与
数据一致；dist/ 重建（补 payback/grover-bridge 模块与 int 守卫）。

**D3（route-price / wukong-crossval / choice-lang / causal-ineq / vacuum，6 项）**：
witnesses B/1!==B 死检查改可触发的 2 的幂域检查；covariance 逐行长度校验
COVARIANCE_SHAPE；wukong band 元组按契约 [fLo,fHi] 重排并移除渲染端补偿
（37 行双值交换，README/theory 勘误）；choice-lang 拒绝消息按实际打印量命名；
causal-ineq q2Sign 同号象限修复（唯一调用方恒在异号象限故潜伏，4 象限回归钉）；
vacuum spectral 开区间根计数 −rootAtA（下端点为根时不再多计 1）。

**D4（ent-clearing / nosignal-tariff / ft-qaoa，7 项）**：MI 边际改列和（行和恒
[1/4]×4 钉死 H(Y)=2bit；置换信道巧合正确，非置换回归钉 0.811278）；channels 字
节序文档对齐（大端）；ghztheta 纯对并发度一般式 2√(det ρ_A)（|Ψ+⟩ 旧返 0）；
audit H6 未知族名具名拒绝（不再折为 DEPOL）；nosignal 补上文档承诺的
assertStinespring（W-A/W-H 数字不变）；ft-qaoa 分钟换算 16.67×（无已发布数字
受累）；decoder-scheduler units<blocks 按契约铺开（cpu-bposd-1u 利用率
1125→7875 诚实重定价，README/theory 勘误）。

**D5（ent-sched / switch-sched / readout-wall / k-switch，14 项）**：policies 融合
比较器删析取（"最小 fHi 先融合"定律恢复；ers 0.66631→0.66974 合法漂移）；theory
F*=0.810710；物理夹具真非 Werner；markov 标题对齐。switch-sched：Weyl Z^{+b} 对
齐文档；字节序文档；擦除信道 |+⟩ 对齐（报告位同）；exp1 d=2 循环界 bi<2；gyni
持有公式注释重推。readout-wall：reconstruct 负谱具名拒绝
RECONSTRUCT_NEGATIVE_EIGENVALUE（回归钉不定谱）；kswitch3/4 注释对齐机器普查
（4 个 1/8 + 4 个 1/32）。k-switch：exp5/theory 三处 |+⟩⟨+| 勘误（数值不变）；
dilution qNum/qDen 真约分（BigInt gcd，8/24→1/3 回归钉）；k4:354 教训注释——
**此处审计原文方向写反**（文件写 I⊗Y、真值 Z⊗Y），代理经 4 个独立来源机器
定向后按正确方向修复。

## 收尾跨仓事项
- letter-audit 针线重钉：ent-sched 合法漂移 0.66631→0.66974 后在引用树一侧就
  地重钉（该仓 34/37→37/37）。
- causal-ineq 12 条**既有** lint 红（审计未发现）：11 条自动修 + 1 条手工重构
  （stale 三元组改提前分支），lint 首次退出 0。
- switch-sched dist/（gitignored 编译产物）被 eslint 误 lint 常年退出 1：config
  ignores 补 dist/，lint 首次退出 0。
- mutant-census 29 张预检卡自 2026-09-20 起 STALE（既有）：全部重生成至当前
  enrollment。
- ent-sched README 测试计数 94→95（ladder 回归新增后未同步）。
- bqp-map atlas 条目 + stoq 证词 + nonstoq designing 注释：三处对 n=64 负分量
  的跨仓引用同步勘误为 ~74%。
