# ft-qaoa — 容错深度 QAOA 路线原型

> 未来技术版图 #1：在逻辑量子比特上运行 p>100 层深 QAOA（NISQ 只能 p<10），
> 配 qLDPC 码与实时解码器调度，优化质量随深度单调可证。
> 本仓库是该方向的**路线级工程原型**：逻辑层精确模拟 + 资源估算 + 解码调度，
> 三层全部种子化、可复现、可证伪。TypeScript 严格模式，零运行时依赖。

## 这是什么 / 这不是什么（诚实边界）

**是：**

- p 到 **128 层**的逻辑层 QAOA 精确态矢量模拟（绝热斜坡 + INTERP 参数转移 + 网格化 T 搜索）；
- **深度单调性定理的机器验证**：参数嵌入恒等式 `F_{p+1}(θ⊗0) = F_p(θ)` 在引擎层精确成立（gap = 0.00e+0），最优值序列 `M_p` 非降（小 p 全量优化验证），实测 `r_p` 序列 7/7 实例单调；
- **qLDPC / surface 资源估算器**：码目录带公开出处（gross [[144,12,12]]，Bravyi et al., Nature 2024），逻辑错误模型、Clifford+T 合成 T 计数、T 工厂吞吐、比特/时间/错误预算全参数化；
- **实时解码调度器**：综合征流的离散事件仿真（服务守恒窗口并行），CPU/FPGA/ASIC 场景的利用率与积压判定。

**不是：**

- 不是真容错硬件执行——2026 年不存在 qLDPC 逻辑比特 + 实时解码的 FTQC；
- 不是含噪声模拟——逻辑层是**无噪**的（这正是容错的意义：纠错换无噪逻辑比特）；
- 资源估算中的每个常数都是**显式假设**（有文献量级锚点，无精度声称），见 `docs/theory.md`。

## 一键复现

```bash
npm install
npm test        # 21/21
npm run repro   # 重生成 out/ 下全部 JSON+MD 报告（约 1-2 分钟）
```

## 核心数字（2026-09-05，`npm run repro` 全量重建）

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
| ASIC 10µs ×32 | 4 | 1.56 | backlog-grows |
| ASIC 1µs ×16 | 2 | 0.313 | **realtime** |

结论：实时 qLDPC 解码需要 ~µs/轮量级硬件 + 窗口并行机队；CPU BP+OSD 差三个数量级——与社区共识一致，这是路线上的真瓶颈，不是演示装饰。

## 模块结构

```
src/
  core/     rng.ts(种子确定性) ising.ts(实例+暴力最优) statevector.ts(Float64 态矢量)
  qaoa/     engine.ts(前向+嵌入恒等式) params.ts(斜坡+INTERP)
            optimize.ts(网格+黄金 T 搜索、坐标下降、深度阶梯) monotonic.ts(单调性检验)
  ft/       codes.ts(码目录+出处) synthesis.ts(T 计数) estimate.ts(资源估算)
            decoder-scheduler.ts(离散事件解码调度)
  experiments/  exp1-monotonic / exp2-resources / exp3-decoder / run-all
test/       21 项：每个数学声称配独立实现对照（对拍）
docs/       theory.md — 定理、证明、模型假设、边界、文献
```

## 定理与模型

见 `docs/theory.md`：单调性定理及证明草案、嵌入恒等式的可证伪验证协议、
逻辑错误幂律、T 合成缩放、解码调度的利用率定律，全部假设显式列表。

## 引用锚点

- Farhi, Goldstone, Gutmann, _A Quantum Approximate Optimization Algorithm_ (2014)
- Zhou, Wang, Park, Goldstein, _Quantum Approximate Optimization Algorithm: Performance, Mechanism, and Implementation on Near-Term Devices_, PRL 120, 060507 (2018) — INTERP 参数转移
- Bravyi et al., _High-threshold and low-overhead fault-tolerant quantum memory_, Nature 627, 778-783 (2024); arXiv:2308.07915 — gross 码 [[144,12,12]]
- Fowler et al., Phys. Rev. A 86, 032324 (2012) — surface code
- Gidney & Ekerå, Quantum 5, 433 (2021) — T 工厂量级
- Kliuchnikov, Maslov, Mosca (2013) — Clifford+T 合成缩放

## English summary

Route-level prototype for fault-tolerant deep QAOA (roadmap item 1): noiseless
logical-layer simulation to p=128 with a machine-verified depth-monotonicity
theorem (embedding identity exact to 0.0; r_p non-decreasing on all 7 seeded
instances; worst-case r_128 = 0.991 at n=14), a qLDPC/surface resource
estimator with cited code catalog and fully explicit assumptions, and a
discrete-event real-time decoder scheduler quantifying the known bottleneck
(CPU BP+OSD is three orders of magnitude short; µs-class ASIC or ~500-unit FPGA
fleets pass). Not a real-FTQC execution — every constant is a labeled,
literature-anchored assumption. Reproduce everything with `npm run repro`.
