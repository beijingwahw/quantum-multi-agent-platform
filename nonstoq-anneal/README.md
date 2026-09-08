# nonstoq-anneal — 非 stoquastic 退火路线原型

> 未来技术版图 #2：引入正 κ 耦合的 XX 驱动器打破符号问题，制造经典
> 采样的签名壁垒——退火机专属优势的钥匙。本仓库是该方向的**路线级
> 工程原型**：可编程 XX 驱动器引擎（实时退火 + 虚时投影基态）、
> stoquasticity 矩阵级验证器、符号结构度量 P = Σψ/Σ|ψ| 的定量扫描，
> 以及 0.2.0 新增的**元素级 de-signing 判定器**（证书化 YES/NO/
> UNRESOLVED，含两比特封闭二分法）。TypeScript 严格模式，零运行时
> 依赖，种子化可复现。

## 这是什么 / 这不是什么（诚实边界）

**是：**

- **X 基对角演化引擎**：σ^x 多项式驱动器在 X 基下完全对角，基变换是
  原位 Walsh-Hadamard——每个 Trotter 片 = 两次对角扫 + 两次变换，
  stoq 与 non-stoq 驱动器走同一引擎（符号问题不惩罚态矢量模拟，
  惩罚的是多项式级经典采样器——这正是壁垒的要点）；
- **矩阵级 stoquasticity 验证器**：H_D 非对角元 = 单翻转 −Γ、
  双翻转 +κ_jk；任何 κ>0 即破坏 Perron-Frobenius；
- **符号结构度量**：虚时投影求 H(s) 基态，P = Σψ/Σ|ψ|（全局符号约定：
  最大幅值取正）。stoquastic 基态 P=1 是定理（Perron-Frobenius），
  non-stoquastic P<1 且随 n 坍缩是可复现实测；
- **物理正确的退火协议**：初态 = 驱动器基态（虚时投影制备）。
  κ > 2Γ 后 XX 驱动器基态不再是 |+⟩^n——从均匀态起跳违背绝热前提，
  这是非 stoq 路线被低估的一条真实工程约束：**退火机必须能制备
  自身驱动的（含符号结构的）基态**。

**不是：**

- 不是真退火机执行。**文献现状（2026-09 核实）**：实验室 2 比特
  non-stoquastic 耦合演示已存在（Ozfidan et al., Phys. Rev. Applied 13,
  034037 (2020)，D-Wave 团队，磁通量子比特容性+感性双耦合）；**生产
  退火机上的多比特可编程 non-stoq 驱动器不存在**——这是路线瞄准的硬件缺口；
- 不声称 non-stoq 驱动器逐实例占优：实测混合（见 exp2），文献中
  催化收益出现在有结构的一级相变实例（Hormozi et al. 2017），随机
  实例上正 κ 常常有害——如实报告；
- Crosson-Deng (Quantum 4, 334 (2020)) 的 de-signing 变换表明部分
  non-stoquastic 路径可规范变换回 stoquastic——签名壁垒的物理真实性
  逐实例成立与否是开放问题，本原型给出的是**在计算基下的定量度量**。

## 一键复现

```bash
npm install
npm test        # 51/51
npm run repro   # 重生成 out/ 下全部报告（约 10 分钟）
```

## 核心数字（2026-09-08，`npm run repro` 全量重建）

**实验 1 — 签名壁垒**（4 尺寸 × 4 个 κ，s=0.5 基态，κ 加在问题耦合边上，Γ=1）：

| n | κ=0 | κ=0.1 | κ=0.3 | κ=1.0 |
|---|---|---|---|---|
| 6 | **1.000000** | 0.999933 | 0.543668 | 0.078400 |
| 8 | **1.000000** | 0.974148 | 0.411775 | 0.020413 |
| 10 | **1.000000** | 0.970388 | 0.352080 | 0.002293 |
| 12 | **1.000000** | 0.958395 | 0.239132 | 0.001026 |

- κ=0：P = 1 精确成立（Perron-Frobenius 基线，4/4 收敛）——引擎与定理互证；
- κ=1.0：P 随 n 近乎指数坍缩（每 +2~3 比特一个数量级）——世界线/QMC
  采样器的平均符号代价随之指数增长的**精确内核证据**；
- 解析锚点（测试内）：n=2 XX 驱动器在 κ_c = 2Γ 处相变，κ>κ_c 时基态
  张成空间内 Σψ ≡ 0 → P 精确为 0——机器验证的解析对照。

**实验 2 — 退火成功率**（6 实例 × 4 κ × 4 时长，驱动器基态起跳）：

- stoq 基线：T=32 时 6/6 实例 success ≥ 0.81（随机 Ising）/ 1.000（MaxCut）；
- κ=0.05：几乎免费（最差 0.986 vs 0.994）；
- κ=0.2/0.5：随机实例上明确有害，MaxCut 上 κ=0.2 仍达 0.995——
  **催化剂效应是实例依赖的，如实报告，不挑选**。

**实验 3 — QMC 平均符号的直接测量**（SSE 世界线采样器 + 双精确裁判）：

- **恒等式**：⟨sign⟩ = Z(κ)/Z(−κ)（stoquastic 影子）；采样器在 |W| 系综上
  跑，符号估计量 = (−1)^{N_xx}（每个 XX 双翻转算符一个负号）；
- **双裁判**：SSE 全枚举（无截断）与矩阵 Trotter 迹 Z 比（无 MC 误差）
  互相印证并与 Taylor 级数三方一致到第 7 位；MC 在 n=2/3/6 全部落在
  误差棒内（快混合区验证正确性）；
- **β 扫描（n=8, κ=1）**：MC 全程贴住精确 Z 比（≤2.2σ）；e^{−βΔE0} 渐近线
  只在基态主导区成立，小 β 处严重高估衰减——精确值才是锚；
- **墙的两层代价**：β=0.6 行信号沉入 3σ 地板（BURIED）；同一点不同种子
  曾给出互差 7σ 的点估计——**扇区自相关先于 1/⟨sign⟩² 地板到来**
  （Part D：exact ⟨sign⟩=0.028，恢复 SNR≈1 的朴素下界就要 1.3×10³ sweep，
  真实代价还要乘上自相关时间）——符号问题在自己的采样器上量出来，
  不再是引文献。

**工程上的三个真实发现**（都有测试钉死）：SSE 平稳权重必须含 1/C(M,n)
槽位组合因子（否则 ⟨n⟩ 偏 6 倍）；跨奇偶扇区遍历需要"边+两端站点算符"
三元组翻转（GF(2) 奇偶论证：单键整串翻转永远冻结 N_xx 奇偶）；零权重
瞬态必须"只出不进"（0/0 接受会放行闭合破坏的目标构型）。

**实验 4 — 催化剂试验台**（p-spin 一级相变族 + Nishimori-Takada 反铁磁 XX
项 s(1−λ)·N·m_x²，两参数路径；Lanczos 谱学带稠密 Jacobi/解析极限双裁判）：

- **谱学正面趋势**：催化剂在每个 n 展宽最小 gap（n=12: ×1.26）并把硬点
  前移（s\* 0.347→0.258）——与文献机制方向一致；
- **操作度负结果（红线：不粉饰）**：两参数路径退火成功率全面低于化学
  计量基线（12 组配置全部 0.24–0.53×，含剂量与路径变体扫描）——原文的
  指数增强属热力学极限区，超出精确对角化范围；
- **两面夹击的联合结论**：催化剂收益的渐近区恰好是精确法算不动、且我们
  exp1/exp3 已证经典采样被符号壁垒封锁的区间——复现它需要张量网络
  扩规模（缺口 #2）或真硬件。壁垒证据（exp1/3）硬，收益证据（exp4）
  在可验证尺度为方向性趋势 + 如实负结果。

**实验 5 — 张量网络扩规模**（两位点 DMRG，χ≤48，MPO 稀疏自动机；裁判：
n=8/10/12 能量与虚时投影一致 ≤2e-3，n=20 PF 单符号、κ=0.5 符号结构）：

- **n = 64（精确对角化上限的 5 倍）**：κ=0 基态振幅采样单符号（PF 在
  大尺度成立）；**κ=1.0 计算基负分量占比 46-52%**——符号壁垒在 64 比特
  依然成立；
- κ=0.5 链单符号——与 de-signing 判定器一致（链是路径图、逐项可去）；
  κ=1.0 链在计算基仍有符号结构（规范只换基，不换硬件测量基）。

**de-signing 判定器（定理级加固）**：对角规范下 X→εX、XX→εεXX
（σzσxσz=−σx）；**均匀横场 + 任一 κ>0 XX 边 ⟹ 规范不可去**（exp1/exp3
家族全属此类）；可去性 = 约束图无受挫环 + 分支内 X 约束一致（并查集
闭式判定，证书经稠密矩阵裁判验证）。

**元素级 de-signing 判定器（0.2.0 新面，原开放问题）**：决策问题 =
"是否存在单比特实正交基变换使**每个**非对角矩阵元 ≤ 0"（含求和抵消，
严格强于对角规范层）。三层输出，全部带证书：YES = 显式角度过精确元素
公式复核（小 n 另过稠密 2^n 裁判）；NO = 孤立对松弛 + Lipschitz 边际
（松弛不可行 ⟹ 整体不可行，定理级）；UNRESOLVED = 如实报告判定间隙。
机器验证的封闭二分法：两比特均匀横场族 −Γ(X_u+X_v)+κX_uX_v 的非平凡
de-signing 存在 ⟺ κ ≤ Γ（κ>Γ 时唯一逃逸是断开驱动器的 vacuous 角落）；
w≠0 且无 Z 场时任意 κ 单边可去（ZZ 通道 + 反射规范）——**单边符号壁垒
是 w=0、p=0 切片的伪影**；认证 NO 需要 Z 场钉与 ZZ 规范受挫
（exp6 Part A：40 胞相图，27 YES 非平凡 / 5 仅 vacuous / 6 认证 NO /
2 UNRESOLVED）。图族判例（Part B）：链 n=8 元素级 YES 而对角规范 NO
（层间严格分离），P(rotated)=0.9967 vs P(comp)=0.3652——de-signing
把符号结构挪出读出基而非消除；奇环/K4/exp1 随机族 UNRESOLVED（与
NP-完全/coNP-难文献锚一致）。规模：n=64 链公式路径 4.1 s 判 YES。
文献锚（双源核验）：Marvian-Lidar-Hen Nat. Commun. 10, 1571 (2019)
（治愈判定 NP-完全）；Klassen-Terhal Quantum 3, 139 (2019)；
Ioannou et al. arXiv:2007.11964（全局 stoquasticity 判定 coNP-难）；
Karakashian-Hen arXiv:2607.18596 (2026)（VGP 提议，锚不作声称）。
详见 `docs/theory.md` §1.7。

**硬件规格（缺口 #5）**：`docs/hardware-spec.md` + `src/hardware/profile.ts`
（机器可读剖面：耦合器菜单/包络校验/四个片上校准锚点，含 κ_c=2Γ
片上解析锚点与驱动器基态制备需求）。

## 模块结构

```
src/
  core/     rng.ts ising.ts（与 ft-qaoa 同构） statevector.ts（+Walsh-Hadamard +虚时衰减）
  anneal/   driver.ts（DriverSpec + stoquasticity 验证器 + X 基能量表）
            project.ts（虚时投影基态 + 全局符号约定） anneal.ts（实时退火）
            designing.ts（对角规范判定器：π 旋转层，并查集闭式）
            designing-element.ts（元素级判定器：O(2) 共轭精确公式 + 证书化
            YES/NO/UNRESOLVED + 两比特二分法 + 防走私裁决器）
  experiments/  exp1..exp5 + exp6-designability / run-all
test/       13 项文件 51 测试：含 3 项走私审判（伪造证书/伪造 stoq 声明/
            伪造 no-go 必须被点名拒绝）
docs/       theory.md — Perron-Frobenius、符号问题、模型与文献（§1.7 判定层）
```

## 定理与模型

见 `docs/theory.md`。

## 引用锚点

- Bravyi, DiVincenzo, Oliveira, Terhal, quant-ph/0606140 (2006) — stoquastic 复杂度
- Hormozi et al., Phys. Rev. B 95, 184416 (2017) — 反铁磁 XX 催化剂穿一级相变
- Ozfidan et al., Phys. Rev. Applied 13, 034037 (2020) — 2 比特 non-stoq 实验演示
- Vinci & Lidar, npj QI 3, 38 (2017) — 几何 non-stoquasticity
- Crosson & Deng, Quantum 4, 334 (2020) — de-signing 变换与壁垒的规范依赖性
- Marvian, Lidar, Hen, Nat. Commun. 10, 1571 (2019), arXiv:1802.03408 — 治愈判定 NP-完全
- Klassen, Terhal, Quantum 3, 139 (2019), arXiv:1806.05405 — 两局域 stoquastic 化刻画
- Ioannou, Piddock, Marvian, Klassen, Terhal, arXiv:2007.11964 (2020) — 全局
  stoquasticity 判定 coNP-难；1D XYZ 单比特酉不可治愈反例
- Karakashian, Hen, arXiv:2607.18596 (2026) — stoquastic 二分的 VGP 替代提议
  （识别 PSPACE-完全；前沿锚，本仓不声称）

## English summary

Route-level prototype for non-stoquastic annealing (roadmap item 2): an
X-basis-diagonal engine (Walsh-Hadamard basis flips) runs stoquastic and
non-stoquastic XX drivers through identical code, a matrix-level verifier
certifies stoquasticity, and imaginary-time projection measures the exact
ground-state sign ratio P = Σψ/Σ|ψ|. Perron-Frobenius baseline holds exactly
(P = 1.000000 for κ = 0 at every size); P collapses toward zero with system
size for κ > 0 — the exact kernel of the QMC sign penalty. The anneal protocol
initializes from the driver's own ground state (a real engineering constraint
once κ > 2Γ breaks the |+>^n assumption). New in 0.2.0: the element-level
de-signing decider — does ANY single-qubit orthogonal basis change make every
off-diagonal element non-positive? — with certified YES (explicit angles,
exact formulas + dense referee), certified NO (isolated-pair relaxation +
Lipschitz margin, provably sound), and honest UNRESOLVED in between; a closed
machine-verified dichotomy for the two-qubit uniform-field family (non-trivial
de-signing iff κ ≤ Γ), the reflection-gauge construction curing any single edge
once a ZZ channel exists, and anti-smuggling verifiers that name and reject
counterfeit certificates. Lab-scale non-stoquastic couplers exist (2 qubits);
programmable production implementations do not — that is the hardware gap this
route targets. Everything regenerates via `npm run repro`.
