# qram-sched — qRAM-accelerated online scheduling: the theorem layer, machine-verified

未来技术版图 #6。在线任务流的振幅编码 + 量子行走搜索,把"动态调度的后悔界"从经典下界中撕开缺口——
这是原命题。本仓库把它改写成**可执行、可证伪的三层分离定理**,并逐层机器验证:

1. **随机流 + 量子重放(replay)模型**:探索从后悔账本移入查询账本;量子以 Θ(1/ε) 查询完成经典 Θ(1/ε²) 的估计——**缺口在这里被撕开,条件是 qRAM 前提**(可量子访问的可重放环境)。
2. **对抗流**:"后悔"是信息论量,不是计算量。量子加速内层搜索后**决策逐比特相同、后悔逐比特相同**——Ω(√(kT)) 墙(Auer et al. 2002)不倒。
3. **在线匹配竞争比层**:1/2 与 1−1/e 是信息论帽。量子把每次到达的决策查询从 O(n) 降到 O(√n·log n),**匹配质量分毫不动**。

先行工作如实划界:量子 bandit 的查询复杂度定理已存在(Wang et al. AAAI 2021 best-arm 二次加速;
Wan-Zhang et al. AAAI 2023 [arXiv:2205.14988](https://arxiv.org/abs/2205.14988) 量子奖励预言机下 O(polylog T) 后悔,
自称首个可证量子后悔加速;2025 年已有 channel-oracle 变体与下界后续)——全部是纸笔复杂度界。
**没人做的**(本仓库的定位):后悔/查询账本分离的可执行实验、对抗流等决策墙、qRAM 流式语义与误差暴露定律的机器验证、
以及调度搜索链上 Szegedy 行走二次检测的精确对拍(含 barbell 上的诚实负结果)。

## 运行

```bash
npm install          # dev deps only (tsx, typescript); runtime is zero-dependency
npm test             # 42/42 referee tests
npm run repro        # rebuild all five experiment reports (~70s) into out/reports/
```

TypeScript 严格模式(`strict` + `exactOptionalPropertyTypes` + NodeNext),零运行时依赖,全随机性来自 seeded RNG——
每个数字可由种子逐位重建。

## 五组实验(全部精确裁判对拍)

| # | 主题 | 旗舰数字 |
|---|---|---|
| EXP1 | bucket-brigade qRAM 寻址/流式/误差暴露 | 等距性残差 0.0(1e-15 级);写入 6 次激活 vs 全重写 64;暴露节点 n vs 2ⁿ−1(枚举互证) |
| EXP2 | Szegedy 行走二次检测 | K_n:LU=闭式 2(n−1) 精确,QT √n 标度;2 态族 QT·√q→常数;**指派格**(6×3=729 态)CT/QT²≈2.6-2.9;barbell 诚实负结果(包络峰比经典慢一个量级) |
| EXP3 | 精确 QPE 振幅估计 ε 定律 | 全空间 Grover vs 闭式差 2.2e-16;斜率 −1.070(量子)/−0.483(MC);匹配精度 0.2% 时 32× 查询差 |
| EXP4 | 后悔/查询账本分离 | ETC-live 烧毁 135=N·ΣΔ 精确;量子重放零后悔、查询比经典重放少 2.2×→12.3×(Δ↓);对抗流 10/10 种子决策逐比特相同 |
| EXP5 | 在线匹配:帽不动、查询撕裂 | 级联 greedy-lowest 恰 0.5000;Dürr-Høyer 内层搜索读取比 1.28×→2.71×(n=16→64,随 √n 增长) |

## 诚实边界

- **qRAM 是硬件假设。** 本仓的"量子层"全部条件于"可量子访问的可重放环境"(qRAM + 振幅编码 + 精确 AE)。
  今天不存在这样的硬件;bucket-brigade 的噪声硬化(Arunachalam et al. 2015)在效应级模型之外。
- **重放模型是强前提。** 活体交互式拉动不可叠加查询——那种场景回到第一层账本(Lai-Robbins),
  没有任何量子绕行。经典算法若有同样的模拟器访问权,同样零后悔——量子赢的是查询数的二次方,不是后悔本身。
- **行走加速是结构性的,非普适。** barbell 瓶颈图上本算子类输给经典一个量级(已如实报告);
  调度链(指派格)是 K_n 型结构,二次定律成立。
- **KVV 紧实例未复现。** 1−1/e 的紧性是引用定理;本仓机器验证级联 1/2、3/4 族、地板与排序观察。
- **Dürr-Høyer 是有界误差搜索。** 一致率按银行实测报告,不假设 100%。

## 引用(全部 web 核实,见 docs/citations.md)

qRAM: Giovannetti-Lloyd-Maccone PRL 100,160501 (2008) / PRA 78,052310 (2008)。
行走: Szegedy quant-ph/0401053;MNRS quant-ph/0608026。振幅估计: BHMT quant-ph/0005055;
Montanaro arXiv:1504.06987。经典下界: Lai-Robbins 1985;Auer et al. SICOMP 32(1) 2002;KVV STOC 1990。
量子 bandit 先行: arXiv:2205.14988 (AAAI 2023) 等。检索:Dürr-Høyer 1996。

## 目录

```
src/core/     seeded RNG, LU, Jacobi            src/walk/    Szegedy 行走 + 经典命中裁判
src/qram/     bucket-brigade 模型 + 振幅编码流   src/bandit/  UCB1/ETC/Exp3 + 量子重放调度器
src/ae/       精确 QPE 振幅估计 + 全空间 Grover  src/online/  Dürr-Høyer 搜索 + 在线匹配
src/experiments/  exp1..exp5 + run-all          test/        42 项裁判测试
```

MIT。
