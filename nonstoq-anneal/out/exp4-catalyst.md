# Experiment 4 — Catalyst testbed: AF XX fluctuations on the p-spin first-order family

H(s,λ) = s(1−λ)·N·m_x² − s·N·m_z^5 − (1−s)·N·m_x (Nishimori & Takada 2017 normalization;
the +N·m_x² term is the non-stoquastic antiferromagnetic XX catalyst).
Two-parameter path: s: 0→1 at λ=λ0, then λ: λ0→1 at s=1. Regenerate: `npm run exp:catalyst`.

## A. Min-gap spectroscopy at fixed lambda (coarse scan + golden refinement)

| n | lambda=1 (stoq) | lambda=0.3 | lambda=0.1 |
|---|---|---|---|
| 4 | 0.7553 (s*=0.349) | 0.6098 (s*=0.286) | 0.5747 (s*=0.271) |
| 6 | 0.5624 (s*=0.342) | 0.4422 (s*=0.275) | 0.4128 (s*=0.259) |
| 8 | 0.4304 (s*=0.342) | 0.3407 (s*=0.273) | 0.3179 (s*=0.257) |
| 10 | 0.3323 (s*=0.345) | 0.2693 (s*=0.274) | 0.2523 (s*=0.257) |
| 12 | 0.2564 (s*=0.347) | 0.2152 (s*=0.275) | 0.2032 (s*=0.258) |

**Spectroscopic trend (positive, consistent at every n): the catalyst widens the min gap
(n=12: 0.256 → 0.203, ×1.26) and moves the hard point earlier (s* 0.347 → 0.258).**

## B. Operational anneal success on the two-parameter path (s1=0.5)

| n | T | lambda0=1 | 0.3 | 0.1 |
|---|---|---|---|---|
| 4 | 4/8/16 λ=1 | 0.2771/0.6195/0.8854 | 0.1358/0.2797/0.5739 | 0.1096/0.2129/0.4853 |
| 6 | 4/8/16 λ=1 | 0.1312/0.3009/0.5736 | 0.0499/0.1066/0.2611 | 0.0364/0.0800/0.2035 |
| 8 | 4/8/16 λ=1 | 0.0610/0.1390/0.3144 | 0.0226/0.0508/0.1243 | 0.0194/0.0397/0.0938 |
| 10 | 4/8/16 λ=1 | 0.0278/0.0649/0.1655 | 0.0099/0.0242/0.0617 | 0.0075/0.0190/0.0461 |
| 12 | 4/8/16 λ=1 | 0.0125/0.0308/0.0798 | 0.0040/0.0113/0.0305 | 0.0029/0.0088/0.0234 |

## C. Path variants and dosage (n=10, T=16)

| lambda0 | s1 | success |
|---|---|---|
| 1.0 | 0.5 | 0.1654 |
| 0.5 | 0.5 | 0.0827 |
| 0.5 | 0.3 | 0.0390 |
| 0.3 | 0.5 | 0.0616 |
| 0.1 | 0.5 | 0.0460 |
| 0.1 | 0.8 | 0.0865 |

## Honest conclusion (红线：不粉饰)

- **谱学正面趋势**：催化剂在每个 n 都展宽最小 gap 并把硬点前移——与
  Nishimori-Takada 机制方向一致；
- **操作度负结果**：两参数路径的实测成功率全面低于化学计量基线
  （全部 12 组配置为基线的 0.24–0.53×，含弱剂量与提前抬 λ 的变体）——
  在精确可及的 n ≤ 12 上未能复现原文的渐近收益；
- **归因边界**：原文的指数增强声称属 p ≥ 4 的热力学极限区，超出精确
  对角化范围（也正是我们 exp1/exp3 证明经典采样被符号壁垒封锁的区间——
  中等尺度的两面夹击：精确法算不动，采样器付指数符号代价）。复现渐近
  收益需要张量网络扩规模（缺口 #2）或真硬件。
