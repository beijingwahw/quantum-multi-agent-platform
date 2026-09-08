# docs/theory.md — 定理、度量与诚实边界

> 已实现的给数字，未实现的给路线。每个声称给验证协议。

## 1. Stoquasticity 与 Perron-Frobenius

### 1.1 定义

实对称哈密顿量 H 在计算基下 **stoquastic** ⟺ 所有非对角元 ≤ 0
（Bravyi-DiVincenzo-Oliveira-Terhal, quant-ph/0606140 (2006)）。

本原型的驱动器：

```
H_D = −Γ·Σ_i σ^x_i + Σ_{(i,j)} κ_ij·σ^x_i σ^x_j
```

非对角元（Z 基）：单比特翻转 → −Γ ≤ 0（Γ ≥ 0 时）；双比特翻转 {i,j} → +κ_ij。
**κ_ij > 0 即 non-stoquastic**（验证器 `checkStoquasticity` 逐项判定）。

### 1.2 定理（Perron-Frobenius 推论）

**H stoquastic ⟹ 其基态可取为逐分量非负。** 证明：H 的非对角 ≤ 0 ⟹
−H 是 Metzler 矩阵 ⟹ e^{−β(−H)} 逐分量非负（正半群）；|+⟩^n 型非负向量
在 e^{−βH} 下的主导分量极限保持非负。∎

**度量**：P = Σψ/Σ|ψ| ∈ [−1,1]。全局符号约定（最大 |幅值| 取正）后：

- stoquastic 基态：**P = 1**（定理保证，实测 1.000000，4/4 尺寸收敛）；
- non-stoquastic 基态：P < 1，符号结构真实存在。

### 1.3 签名壁垒的精确内核与它的边界

世界线/QMC 采样器对基态重构的期望符号 ⟨sign⟩ 受同一符号结构支配：
采样权重携带 ψ 的符号 ⟹ P 随体系尺寸坍缩 ⇒ 符号样本量指数爆炸
（经典采样壁垒）。本原型给出的是**精确态矢量层面的内核证据**
（exp1：κ=1.0 时 P 每增 2~3 比特降一个数量级），⟨sign⟩ 的指数衰减
本身是文献共识，不在小 n 上直接重演。

**边界（诚实）**：Crosson-Deng (Quantum 4, 334 (2020)) 证明部分
non-stoquastic 绝热路径可经规范（基）变换映射回 stoquastic——签名
壁垒是否"物理真实"逐实例可变。本原型度量固定在计算基（退火机的
自然读出基），并把可 de-sign 性列为开放问题。

### 1.4 解析锚点（可证伪验证）

n=2 纯驱动器谱在 X 基显式：

```
E_x(t) = κ·x_1x_2 − Γ·(x_1+x_2),  x_i = ±1
```

- κ < 2Γ：基态 = |++⟩_x（Z 基全非负）→ P = 1；
- κ > 2Γ：基态空间 {x_1x_2 = −1}，其中每个向量的 Σψ ≡ 0
  （span{H|01⟩, H|10⟩} 的求和望远镜抵消）→ **P = 0 精确**。

测试 `anneal.test.ts` 机器验证此相变（κ_c = 2Γ）。

### 1.5 平均符号的直接测量（SSE 世界线采样，exp3）

**恒等式**：⟨sign⟩ = Z(κ)/Z(−κ)。−H 的矩阵元逐项取绝对值恰为 −H̄
（κ→−κ 的 stoquastic 影子）的矩阵元，故 |W| 系综 = 影子系综；采样器
在 |W| 上跑，符号估计量 = (−1)^{N_xx}——σx 单翻转（+Γ）与平移后的
对角元恒正，只有 XX 双翻转带负号。

**β→∞ 渐近**：⟨sign⟩ ≈ e^{−β·ΔE0}·(简并度比)，ΔE₀ = E₀(κ) − E₀(影子)，
两侧基态能量由虚时投影精确给出。小 β 处渐近线严重失真（非基态主导），
一切以矩阵 Trotter 迹的精确 Z 比为锚。

**裁判链**：SSE 全枚举（无截断，n≤3）↔ 矩阵 Trotter 迹 Z 比（无 MC
误差，n≤8）↔ n=2 Taylor 级数（机器精度）——三方一致到第 7 位；MC 在
快混合区全部落棒内。

**采样器正确性的三个可证伪要点**（均有测试）：
1. 平稳权重必须含 **1/C(M,n) 槽位组合因子**（同一有序算符序列可放入
   C(M,n) 种槽位）→ 对角更新接受率 A_ins = min(1, B·β·a/(M−n))，
   A_rem = min(1, (M−n+1)/(B·β·a))；缺失该因子实测 ⟨n⟩ 偏 6 倍；
2. **跨扇区遍历**：单键整串翻转在 GF(2) 上保持每比特奇偶、永不改变
   N_xx 奇偶（扇区冻结）——"边 + 两端站点算符"三元组翻转使每比特
   奇偶变化 1+1≡0 且 N_xx 变 ±1，合法跨扇区；
3. **零权重瞬态只出不进**：从 w=0 的瞬态出发 0/0 接受会放行闭合破坏
   的目标构型；接受条件必须是 wNew > 0。

**诚实统计**：自适应块平均（块宽 10→1000 取最大标准误）+ 每点 3 种子
散布取 max。同一点不同种子曾给出互差 7σ 的点估计——扇区自相关超出
任何块宽，这是符号问题在局部更新下的**第一层代价**；1/⟨sign⟩² 样本
地板是**第二层**（Part D：exact ⟨sign⟩=0.028，SNR≈1 朴素下界即需
1.3×10³ sweep，真实代价还要乘自相关时间）。两层都量在自己的采样器上。

### 1.6 催化剂试验台（exp4）：收益面的诚实测量

**模型**（Nishimori & Takada, Frontiers in ICT 4, 2 (2017) 归一化）：
H(s,λ) = s(1−λ)·N·m_x² − s·N·m_z^p − (1−s)·N·m_x，p=5；+N·m_x² 即
反铁磁 XX 催化剂（正非对角元 → 非 stoquastic）。两参数路径：s: 0→1 保持
λ=λ₀，再于 s=1 抬 λ 至 1。

**谱仪**：矩阵无关 Lanczos（H·v 用双基机制，O(n·dim)/乘积；全重正交；
k×k Jacobi）。裁判：H·v 对稠密矩阵逐元素（n=3）；s=0 谱 = sorted E_x；
s=1 谱 = sorted −C；全空间 k=dim 对稠密 Jacobi 精确（n=4）。**简并语义**：
单向量 Krylov 对简并本征空间只贡献一个方向 → λ₁ 是基态流形外的第一
能级——恰是退火 gap 的正确语义（简并流形内部劈裂不伤绝热性）。
一级避免交叉的谷宽 ~ gap 本身 → 粗扫 + 三候选邻域黄金分割细化。

**实测结论**：谱学正面趋势（每个 n gap ×1.2-1.3、硬点前移）；
操作度负结果（两参数路径成功率全面 0.24-0.53× 基线，含变体扫描）。
原文的指数增强属 p≥4 热力学极限区——超出精确对角化，且该区间已被
我们 exp1/exp3 证明对经典采样封闭（符号壁垒）。两面结论：**壁垒证据硬，
收益在可验证尺度是方向性趋势 + 如实负结果**。

### 1.7 元素级 de-signing 可判定性（0.2.0：决策层）

**决策问题**（README 0.1.x 开放问题的精确化）。给定

```
H = Σ_i g_i·X_i + Σ_i p_i·Z_i + Σ_{(u,v)} (κ_uv·X_uX_v + w_uv·Z_uZ_v)
```

是否存在单比特实正交基变换 U = ⊗_i U_i（U_i ∈ O(2)），使 U†HU 的
**每一个**非对角矩阵元 ≤ 0？`designing.ts` 的对角规范（ψ ∈ {0,π}，
即轴对齐 π 旋转层）是本问题在测量受挫环意义上的子集；元素级允许
求和抵消与连续角度。单比特共轭表（X_i → a_iX_i + b_iZ_i，
Z_i → d_i(a_iZ_i − b_iX_i)，(a_i,b_i) 单位圆、d_i ∈ {±1}；与稠密
Kronecker 共轭随机化互证）给出非对角元的闭式：

```
A_i(z) = g_i·a_i − d_i·p_i·b_i + Σ_{邻居 o} z_o·(κ_io·a_i·b_o − d_i·d_o·w_io·b_i·a_o)
D_uv   = κ_uv·a_u·a_v + d_u·d_v·w_uv·b_u·b_v        （z = 构型位 ±1）
```

max_z A_i(z) = 基项 + Σ_o |每邻居贡献|（**同邻居的多重边先按 (κ,w)
求和**——共享同一 z_o；逐边取 |·| 会高估，2026-09-08 由公式 vs 稠密
裁判的随机化对照抓获并修复）。判定 = O(n+|E|) 精确扫描 + 多起点坐标
下降搜索 + 两侧证书。

**定理（两比特均匀横场族的封闭二分法）**。H = −Γ(X_u+X_v) + κ·X_uX_v
（κ, Γ > 0，w = p = 0）：存在**非平凡**（非 vacuous，至少一条活的
非对角通道）de-signing ⟺ κ ≤ Γ；且 κ > Γ 时任何 de-signing 必有
a_u = a_v = 0（全部非对角元恰为零 = 驱动器被断开的 vacuous 逃逸）。

证明：非对角元只剩 A_u(z_v) = a_u(−Γ + z_vκb_v)、A_v(z_u) =
a_v(−Γ + z_uκb_u)、D = κa_ua_v。(i) a_u < 0 时取 z_v = −sign(b_v)
得 A_u = a_u(−Γ − κ|b_v|) > 0，矛盾 ⟹ a_u, a_v ≥ 0；(ii) D ≤ 0
与二者非负 ⟹ a_u = 0 或 a_v = 0；(iii) 设 a_v = 0（|b_v| = 1）：
A_u 在 z_v = sign(b_v) 处 = a_u(−Γ + κ) ≤ 0——若 a_u > 0 则 κ ≤ Γ；
若 a_u = 0 则 A_u ≡ A_v ≡ D ≡ 0（vacuous）。故 κ > Γ 时唯一可行点
全 vacuous。充分性（κ ≤ Γ）：显式证书 ψ_u = 0、ψ_v = π/2——u 行
= −Γ + κ·z_v ≤ −Γ + κ ≤ 0，v 行 ≡ 0，D = 0，u 行在 κ < Γ 时严格
负（活通道）。∎（`uniformPairDichotomy` 给证书，`dichotomyGridCheck`
在 (ψ_u,ψ_v)×d 全网格上机器复核 NO 侧：可行点的 |a| 逃逸 ≤ 1e-3。）

**命题（单边可去性：ZZ 通道）**。w ≠ 0、p = 0 时，任意大的 κ 都可去：
取 ψ_u = ψ_v = π/2、d_ud_v = −sign(w)——旋转后非对角只剩
−|w|·X_uX_v ≤ 0（活），单翻转行 ≡ 0。**+κ 壁垒在单条边上只是
w = 0、p = 0 切片的伪影**；真正的阻碍需要 Z 场钉（d_ub_u 符号被
p_i 钉死）与 ZZ 边规范需求（d_ud_v·sign(w) = −1）形成受挫的带符号
2-染色——这正是相图中认证 NO 区的机制（exp6 Part A：6 个认证 NO
胞全在 p ≠ 0 区，边际 0.024–0.335）。

**松弛可靠性引理（NO 证书的定理级性）**。孤立对子系统是全问题的
松弛：对任意旋转，max_z A_u^全 = 基项 + Σ_o|t_uo| ≥ 基项 + |t_uv| =
max_z A_u^子（每行的 max 恰是绝对值之和，去掉邻居只会变小）⟹
全可行 ⟹ 子可行；逆否即子不可行 ⟹ 全不可行。子问题在二维角度 ×
4 规范号空间上网格化，Lipschitz 余量（|∂/∂ψ| ≤ |g|+|p|+|κ|+|w|）
给出不依赖搜索运气的边际。对偶观察：**星形（单点邻域）松弛永远
可行**——每条邻边贡献 t = α·b_v + β·a_v 对邻居角度线性，邻居圆上
总可取正交方向把 t 归零（除非 (α,β)=(0,0)）——所以 NO 证明至少需要
对级张力（双翻转约束同时钉住两端角度）。NO 证书另由
`verifyNoGoCertificate` 独立重推（防伪造，走私审判 #3）。

**诚实边界**：YES/NO 之间保留 UNRESOLVED（exp6：奇环 n=7、K4 混号、
exp1 随机 3 度族 n=6 在 κ=0.05/0.5、相图 2 个边界胞）。这与复杂度
文献一致：一般情形的治愈判定 NP-完全（Marvian-Lidar-Hen），全局
stoquasticity 判定 coNP-难（Ioannou et al.）——我们只机器执行
证书化了的判定，前沿定理作锚不作声称。Perron-Frobenius 是单向的：
stoquastic ⟹ P = 1，但非 stoquastic 基态仍可非负（exp6 Part A 的
κ=0.5/w=0.3 胞即如此）；P(comp) ≈ 0 才是壁垒读数（exp1 口径）。
de-signing 证书 ⟹ 旋转基内 P = 1（严格负证书精确成立，零边界证书
受简并限制到 0.997+）——把符号结构挪出硬件读出基，不是在原基消除它。


## 2. 引擎模型

### 2.1 X 基对角演化

σ^x 多项式驱动器在 X 基（H^⊗n |t⟩，t 为比特标签）下对角，本征值表
`xBasisEnergies` 显式构造。基变换 = 原位 Walsh-Hadamard（O(n·dim)）。

- **实时退火**：每 Trotter 片 e^{−i·dt·s·H_P}（Z 基相位）→ WH →
  e^{−i·dt·(1−s)·H_D}（X 基相位）→ WH。H_P := −C（最大化 C ⟺ 最小化
  H_P——与 ft-qaoa/平台福利最大化约定一致；绝热定理跟随最低本征值）。
- **虚时投影**：同结构，相位换衰减 e^{−Δτ·E}，迭代归一化收敛到
  Trotter 化 H(s) 的基态（Δτ→0 时即真基态）。

### 2.2 两个数值上必需的约定

1. **投影初态用种子化一般实向量**：|+⟩^n 在 X 基是单点 t=0，可与目标
   基态空间**零重叠**（κ>2Γ 的 XX 驱动器正是如此）；
2. **全局符号约定**：投影收敛向量乘 ±1 仍是基态，P 的符号无意义——
   固定最大 |幅值| 取正。

### 2.3 退火初态 = 驱动器基态

κ > 2Γ 后驱动器基态不再是 |+⟩^n（带符号结构甚至反关联）。绝热协议
要求初态 = H(0) 基态 ⟹ 退火机必须能**制备自身驱动的基态**——非 stoq
路线的真实硬件前提，写进退火引擎默认行为（'driver-ground'，虚时投影制备；
'plus' 保留作教科书模式）。

## 3. 实验结论（诚实汇总）

- **exp1（符号壁垒）**：κ=0 基线 P=1.000000 精确成立；κ=0.1 P 缓降
  （0.9999→0.958）；κ=0.3 快速坍缩；κ=1.0 近指数坍缩（0.078→0.0010）。
- **exp2（退火成功率）**：stoq 基线 6/6 实例 T=32 收敛（≥0.81）；
  κ=0.05 几乎免费；κ=0.2/0.5 随机实例有害、MaxCut κ=0.2 仍 0.995。
  **不声称逐实例占优**——文献中的催化剂收益（Hormozi et al. 2017）
  出现在有结构的一级相变实例；本原型如实报告混合结果。

## 4. 硬件现状（2026-09 核实）

- **已存在**：2 比特 non-stoquastic 耦合实验演示——Ozfidan et al.,
  Phys. Rev. Applied 13, 034037 (2020)（磁通量子比特，容性+感性双自由度
  耦合，σ^zσ^x+σ^xσ^z 型项）；Vinci & Lidar (npj QI 2017) 几何方案；
  Novo et al. (2019) circuit QED 验证。
- **不存在**：生产退火机上的多比特可编程 non-stoquastic 驱动器。
  路线主张：把它造出来（可编程 κ_ij + 驱动器基态制备），签名壁垒
  （§1.3）是其相对经典模拟的专属护城河候选。

## 5. 文献

- [Bravyi, DiVincenzo, Oliveira, Terhal (2006)](https://arxiv.org/abs/quant-ph/0606140)
- [Hormozi et al., Phys. Rev. B 95, 184416 (2017)](https://arxiv.org/abs/1609.06558)
- [Ozfidan et al., Phys. Rev. Applied 13, 034037 (2020)](https://arxiv.org/abs/1903.06139)
- [Vinci & Lidar, npj QI 3, 38 (2017)](https://www.nature.com/articles/s41534-017-0037-z)
- [Crosson & Deng, Quantum 4, 334 (2020)](https://quantum-journal.org/papers/q-2020-09-24-334/)
- [Novo et al. (2019)](https://arxiv.org/abs/1909.06333)

de-signing 可判定性（2026-09 双源核验：arXiv 摘要页 + 出版方页面/引用方）：

- [Marvian, Lidar, Hen, "On the computational complexity of curing non-stoquastic
  Hamiltonians", Nat. Commun. 10, 1571 (2019)](https://www.nature.com/articles/s41467-019-09501-6)
  （arXiv:1802.03408）——受限乃至任意单比特正交变换下的治愈判定 NP-完全。
- [Klassen, Terhal, "Two-local qubit Hamiltonians: when are they stoquastic?",
  Quantum 3, 139 (2019)](https://quantum-journal.org/papers/q-2019-05-06-139/)
  （arXiv:1806.05405）——两局域项可 stoquastic 化的逐项刻画。
- [Ioannou, Piddock, Marvian, Klassen, Terhal, "Termwise versus globally stoquastic
  local Hamiltonians: questions of complexity and sign-curing",
  arXiv:2007.11964 (2020)](https://arxiv.org/abs/2007.11964)——全局
  stoquasticity 判定 coNP-难；1D XYZ 反例不能被单比特酉治愈。
- [Karakashian, Hen, "Dismantling the Stoquastic Dichotomy",
  arXiv:2607.18596 (2026)](https://arxiv.org/abs/2607.18596)——以消失
  几何相位（VGP）替代 stoquastic 二分的提议；VGP 识别 PSPACE-完全。
  前沿提议，锚不作声称。
