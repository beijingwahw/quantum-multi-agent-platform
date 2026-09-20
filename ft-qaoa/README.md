# ft-qaoa — 容错深度 QAOA 路线原型

> 未来技术版图 #1：在逻辑量子比特上运行 p>100 层深 QAOA（NISQ 只能 p<10），
> 配 qLDPC 码与实时解码器调度，优化质量随深度单调可证。
> 本仓库是该方向的**路线级工程原型**：逻辑层精确模拟 + 资源估算 + 解码调度
> \+ 有界噪声面，四层全部种子化、可复现、可证伪。TypeScript 严格模式，零运行时依赖。

## 这是什么 / 这不是什么（诚实边界）

**是：**

- p 到 **128 层**的逻辑层 QAOA 精确态矢量模拟（绝热斜坡 + INTERP 参数转移 + 网格化 T 搜索）；
- **深度单调性定理的机器验证**：参数嵌入恒等式 `F_{p+1}(θ⊗0) = F_p(θ)` 在引擎层精确成立（gap = 0.00e+0），最优值序列 `M_p` 非降（小 p 全量优化验证），实测 `r_p` 序列 7/7 实例单调；
- **有界噪声面（v0.2 新增）**：同一条单调性轨道在精确密度矩阵（2^n×2^n，无抽样）上按层去极化 + 读出翻转定价——单调性在 ε≤1e-4 存活到 p=32，在 ε≥1e-3 弯折（有限最优深度 p*），读出噪声只缩放不弯折（实验 4）；
- **噪声面代数恒等（v0.4 新增）**：实验 4 的数值面之下的精确代数——「按层去极化 ≡ 末端收缩 (1−4ε/3)^p」交换恒等在可判定交换域（非相互作用代价 ∨ p=1 ∨ 尾混合器平凡，斜坡 p=2 天然在内）三路独立代数对拍到浮点地板；交织域恒等**破裂**且机器定价（不掩盖）；⟨C⟩_noisy 是收缩因子的 ≤np 次精确多项式、a⁰ 系数＝mean(E) 角度无关（噪声感知再训练的可判定分解）；读出 Walsh 谱滤波恒等把「只缩放不弯折」升为精确判据；
- **qLDPC / surface 资源估算器**：码目录带公开出处（gross [[144,12,12]]，Bravyi et al., Nature 2024），逻辑错误模型、Clifford+T 合成 T 计数、T 工厂吞吐、比特/时间/错误预算全参数化；**每个常数入机器可查的出处审计表**（citation-anchored 需 ≥2 独立文献；工程假设必须给出理由；无出处行被门禁点名拒绝，实验 2 Part C）；
- **实时解码调度器**：综合征流的离散事件仿真（服务守恒窗口并行），CPU/FPGA/ASIC 场景的利用率与积压判定；**窗口大小策略扫参（v0.2 新增）**把批处理时延/吞吐权衡定价成数据并给出最小纠错时延的可行窗口。

**不是：**

- 不是真容错硬件执行——2026 年不存在 qLDPC 逻辑比特 + 实时解码的 FTQC；
- 主轨道（p=128 单调性）仍是**无噪逻辑层**模拟——但 v0.2 已把该边界**定价**（实验 4）：噪声何时杀死深度收益有了机器数据，不再是空白声明；
- 资源估算中的每个常数都是**显式假设**（citation-anchored 或标注工程假设，见审计表与 `docs/theory.md`），无精度声称。

## 一键复现

```bash
npm install
npm test        # 76/76
npm run repro   # 重生成 out/ 下全部 JSON+MD 报告（约 2 分钟，exp4 密度矩阵占大头）
```

## 核心数字（2026-09-08，`npm run repro` 全量重建）

**实验 1 — 深度单调性**（7 实例 = 5×random-ising n=10 + maxcut-3reg n=12 + random-ising n=14，种子固定）：

- 嵌入恒等式 gap（p=2/8/64/128 随机角度）：全部 **0.00e+0**；
- `r_8 → r_128` 全部单调（容差 2e-3），最差实例（n=14）：**0.798 → 0.991**；
  n=10 系列达 **0.9999**；MaxCut n=12 达 **0.99987**；
- 小 p（1..6）全量坐标下降 + 零层热启动：最优值序列非降。

**实验 2 — 资源估算**（假设默认 pPhys=1e-3、τ=1µs、ε_syn=1e-6、两级蒸馏 ε_T=1e-12）：

- p=8 浅电路：gross [[144,12,12]] 全线胜出（L=80 仅 **7,016** 物理比特、38ms）；
- p≥100 深电路：gross 固定 d=12 在 pPhys=1e-3 下信道预算 FAIL（L=80/p=128：ε=0.075），
  surface d=17 接管：**51,160 比特、870ms、3.28M T 门**；
- gross 码需 pPhys ≤ 3e-4 才能跑深电路（ε 降至 2e-5）。

**实验 3 — 实时解码调度**（gross 码 L=80/p=128：614,400 轮综合征，1008 比特/轮 ≈ **1.0 Gb/s** 持续）：

| 场景 | 每块单元数 | 利用率 | 判定 |
|---|---|---|---|
| CPU BP+OSD ×1 | 1 | 1125 | backlog-grows |
| CPU BP+OSD ×64 | 9 | 125 | backlog-grows |
| FPGA 100µs ×32 | 4 | 15.6 | backlog-grows |
| FPGA 100µs ×512 | 73 | 0.856 | **realtime** |
| FPGA 100µs ×256 | 36 | 1.736 | backlog-grows |
| ASIC 10µs ×32 | 4 | 1.56 | backlog-grows |
| ASIC 1µs ×16 | 2 | 0.313 | **realtime** |

v0.2 窗口大小策略扫参（W ∈ {1,2,4,8,16,32}）：单轮流式（W=1）对 100µs 级 FPGA 定长时延在 1µs 周期下**任何机队都积压**（FPGA×512：ρ=2.05）；最小纠错时延的可行窗口 FPGA×512 为 **W=8**、ASIC 1µs×16 为 **W=1**——批处理策略与机队规模同样是路线变量，已定价成数据。

**实验 4 — 有界噪声面（v0.2 新增）**：同一条噪声最优调度轨道在**精确密度矩阵**上重定价
（3 实例 = random-n10 + maxcut-n10 + random-n8，种子固定；p∈{2,4,8,12,16,24,32}；
每层每比特去极化 ε ∈ {0,1e-4,1e-3,3e-3,1e-2} + 终端读出翻转 q ∈ {1e-2,5e-2}；无蒙特卡洛）：

- **引擎对拍**：ε=0 时密度矩阵 vs 态矢量引擎最大偏差 5.3e-15（三实例）——噪声内核精确；
- **单调性存活**：ε=1e-4 三实例全部单调到 p=32（n10 随机：r_32=0.985）；
- **单调性弯折**：ε=1e-3 起两实例出现首降（p=24–32）；ε=1e-2 峰值深度 p*=8–12、
  r*≈0.64–0.77，p=32 时 r 跌回 0.46–0.53——弯折乘积 ε·p*≈0.016–0.12，首降乘积 ε·p≳2e-2；
- **读出噪声不弯折**：纯读出 q=5% 三实例全部保持单调（只是缩放，r_32≈0.78–0.83）；
- **Willow 标定**：d=7 每周期逻辑错误 1.43e-3（Google, Nature 2025）恰在 ε=1e-3 网格点——
  按今日实测逻辑噪声水平，有用深度 ≈16–24 层；p=128 单调需要每层等效 ε≲2e-4，
  由 Λ=2.14 的压制在 d≈13 达到——与估算器选出的码距（gross d=12 / surface d=17–19）同量级
  （量级桥接，非逐门核算，见 theory.md §4）。

**噪声面代数恒等（v0.4 新增，`src/qaoa/shrink.ts`）**——两个定理、全部可证伪：

- **F1 噪声-电路交换定理**：去极化信道的对角作用恰为经典翻转信道 F_{2ε/3}（Walsh 模每层收缩
  a=1−4ε/3），代价相位不动对角，只有混合器把相干性转移为布居。由此：**交换域**（非相互作用代价
  ∨ p=1 ∨ 尾混合器平凡 β_{t≥2}=0——线性斜坡 p=2 天然满足）内，「p 层交织噪声 ≡ 末端逐比特收缩
  b=(1−4ε/3)^p 的无噪电路」精确成立，闭式 ⟨C⟩_noisy = Σ_S b^{|S|}(1−b)^{n−|S|}⟨C⟩_{S-边缘}
  ＝ Σ_S a^{p|S|}Ĉ(S)⟨χ_S⟩，与密度引擎三路对拍 ≤1e-12（种子实例 × p∈{1,2,4,8} × ε 网格）；
  **交织域**（相互作用 + 层间非平凡混合器）恒等**破裂**——交换律穿不过纠缠代价门，机器定价
  gap ≈1e-3–2e-1（如实入册，负对照：逐门噪声放置同样被定罪）；
- **F1 推论·多项式年级**：任意调度下 ⟨C⟩_noisy(a) 是 a 的 ≤np 次**精确多项式**（Chebyshev 节
  插值 + 节点外残差 ≤1e-9 双路验证），a⁰ 系数＝mean(E) 角度无关——噪声感知再训练问题分解为
  逐年级比较 Σ_k a^k(g_k−g_k′)，逐实例可判定；
- **F2 读出 Walsh 谱滤波恒等**：⟨C⟩_obs(q) = Σ_S (1−2q)^{|S|}Ĉ(S)⟨χ_S⟩ 为 λ=1−2q 的 ≤n 次
  精确多项式（2-local 代价即 ≤2 次），对任意基础分布（含噪声电路输出）成立，对拍 ≤1e-13；
  「读出只缩放不弯折」升为精确判据：分组系数 w_k≥0（种子实例全成立 ⟹ ⟨C⟩_obs 在 q∈[0,1/2]
  单调非增，引擎直验）；
- **F1×F2 复合**：交换域内两滤波按 Walsh 模乘法复合（有效特征值 a^p·(1−2q)），噪声面全代数化；
  ε·p* 弯折乘积机制在交换域成为定理（逐相关器指数收缩 e^{−(4ε/3)p|S|}），交织域为带定价
  间隙的近似。

**假设常数审计（v0.2 新增，实验 2 Part C）**：20 行常数表全量过出处门禁——
7 行 citation-anchored（gross 码参数/码距/伪阈值、T 计数系数、Λ=2.14、d7 逻辑错误、
QAOA 噪声有限深度），每行 ≥2 独立 workId；13 行标注工程假设并给理由；
绑定行与代码实取值逐一核对（无漂移）。伪造出处/无出处/漂移行被门禁**点名拒绝**（走私审判测试覆盖）。

## 模块结构

```
src/
  core/     rng.ts(种子确定性) ising.ts(实例+暴力最优) statevector.ts(Float64 态矢量)
            density.ts(精确密度矩阵: 代价相位/混合器/逐比特去极化/读出卷积)
            errors.ts(具名错误码: 每个 throw 带 code，公共入口非法输入点名驳回)
  qaoa/     engine.ts(前向+嵌入恒等式) params.ts(斜坡+INTERP)
            optimize.ts(网格+黄金 T 搜索、坐标下降、深度阶梯) monotonic.ts(单调性检验)
            noise.ts(噪声面: 噪声期望/深度序列/弯折报告/声称验证门禁)
            shrink.ts(噪声面代数: 交换恒等三路闭式/多项式年级/Walsh 滤波恒等/逐门负对照/声称门禁)
  ft/       codes.ts(码目录+出处) synthesis.ts(T 计数) estimate.ts(资源估算，常数单源引用)
            constants.ts(假设常数审计表+出处门禁) decoder-scheduler.ts(离散事件解码调度+窗口策略)
  experiments/  exp1-monotonic / exp2-resources(+常数审计) / exp3-decoder(+窗口策略) / exp4-noise / run-all
test/       76 项：每个数学声称配独立实现对照（对拍）；走私审判 21 项（伪造噪声单调序列 ×2、
            伪造 shrink 间隙/恒等/定理低估/守卫 ×5、伪造常数出处 ×3、非法输入具名驳回 ×11）；
            单源常数无漂移断言 ×1
docs/       theory.md — 定理、证明、模型假设、边界、文献
```

## 定理与模型

见 `docs/theory.md`：单调性定理及证明草案、嵌入恒等式的可证伪验证协议、
逻辑错误幂律、T 合成缩放、解码调度的利用率定律，全部假设显式列表。

## 引用锚点

- Farhi, Goldstone, Gutmann, _A Quantum Approximate Optimization Algorithm_ (2014)
- Zhou, Wang, Park, Goldstein, _Quantum Approximate Optimization Algorithm: Performance, Mechanism, and Implementation on Near-Term Devices_, PRL 120, 060507 (2018) — INTERP 参数转移
- Bravyi et al., _High-threshold and low-overhead fault-tolerant quantum memory_, Nature 627, 778-783 (2024); arXiv:2308.07915 — gross 码 [[144,12,12]]（IBM 博客与 EC Zoo 为独立第二源）
- Google Quantum AI (Acharya et al.), _Quantum error correction below the surface code threshold_, Nature 638, 920-926 (2025); arXiv:2408.13687 — Willow：Λ=2.14±0.02、d=7 每周期 0.143%、d=5 实时解码 63µs
- Fowler et al., Phys. Rev. A 86, 032324 (2012) — surface code
- Gidney & Ekerå, Quantum 5, 433 (2021) — T 工厂量级；Gidney (2025), arXiv:2505.15917 — 百万比特以内 RSA-2048
- Ross & Selinger, arXiv:1403.2975 / QIC 16(11-12) — Clifford+T 最优 T 计数 3log₂(1/ε)+O(log log)
- Kliuchnikov, Maslov, Mosca (2013), arXiv:1212.6964 — Clifford+T 合成缩放
- Marshall et al., IOP SciNotes 1, 025208 (2020)（去极化 >2% 时深度收益近零）；Pan et al., Phys. Rev. A 105, 032433 (2022)（有限最优深度）—— 噪声面预期形状
- Nielsen & Chuang, _Quantum Computation and Quantum Information_（去极化信道与单比特酉的协变性——交换域证明的文献族）〔待双源〕；Beauchamp, _Walsh Functions and Their Applications_ (1984)（Walsh 谱/快速 Hadamard 方法）〔待双源〕—— v0.4 噪声面代数
- Bascones et al., EPJ Quantum Technology (2025), 10.1140/epjqt/s40507-025-00446-y — BP+OSD FPGA/ASIC 设计空间；IBM Relay-BP FPGA 实时 gross 解码（arXiv:2510.21600）；Riverlane 实时 QEC 系统时延（16.32µs 均值）

## English summary

Route-level prototype for fault-tolerant deep QAOA (roadmap item 1): noiseless
logical-layer simulation to p=128 with a machine-verified depth-monotonicity
theorem (embedding identity exact to 0.0; r_p non-decreasing on all 7 seeded
instances; worst-case r_128 = 0.991 at n=14), a **bounded-noise face** pricing
the noiseless boundary on the exact density matrix (monotonicity survives
p=32 at eps=1e-4, bends at eps>=1e-3 with finite optimal depth p*=8-12 and
eps*p* ~ 0.02-0.12; Willow d=7 logical error 1.43e-3/cycle sits exactly on
the bending grid point), an **exact noise-face algebra** (v0.4: the
terminal-shrink exchange identity holds in a decidable commuting regime and
is machine-priced where it fails; the noisy objective is an exact polynomial
of degree <= np in the shrink factor with an angle-independent floor; the
readout face is an exact Walsh-filter identity — "readout only rescales" is
now a criterion, not an observation), a qLDPC/surface
resource estimator with a **machine-gated assumption-constants audit** (every
constant citation-anchored with >=2 independent works or labeled engineering
assumption; fake provenance is named and rejected), and a discrete-event
real-time decoder scheduler with a **window-size policy sweep** (single-round
streaming fails for 100us-class FPGA at any fleet; minimum-latency feasible
windows W=8 / W=1 priced). Not a real-FTQC execution — every constant is
labeled and literature-anchored. Reproduce everything with `npm run repro`.
