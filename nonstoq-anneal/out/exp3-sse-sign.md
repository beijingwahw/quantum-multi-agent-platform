# Experiment 3 — Direct measurement of the QMC average sign ⟨sign⟩ via SSE

Worldline (SSE) sampler on the |W| ensemble; sign = (−1)^{N_xx} per configuration.
Exact identity: ⟨sign⟩ = Z(κ)/Z(−κ) (stoquastic shadow), refereed two independent
ways (full SSE enumeration; matrix-Trotter trace Z-ratio). Regenerate: `npm run exp:sign-sse`.

## A. Ground-truth referees vs MC

| n | referee | exact | MC | ± err | within 5σ |
|---|---|---|---|---|---|
| 2 | sse-enumeration | 0.996938 | 0.991150 | 5.8e-3 | YES |
| 3 | sse-enumeration | 0.994269 | 0.995125 | 2.4e-3 | YES |
| 6 | trotter-Z-ratio | 0.590036 | 0.534925 | 6.1e-2 | YES |

## B. beta sweep (n=8, kappa=1.0): MC tracks the exact Z-ratio; asymptote and the wall

ΔE0 = 10.8790 (imaginary-time projection); e^{−βΔE0} is the β→∞ asymptote —
it overshoots at small β (not ground-dominated); the exact ratio is the anchor.

| beta | MC ⟨sign⟩ | ± err | exact Z-ratio | e^{−βΔE0} | measurable (3σ) |
|---|---|---|---|---|---|
| 0.05 | 0.99918 | 1.7e-3 | 0.99837 | 0.58045 | YES |
| 0.10 | 0.99633 | 7.6e-3 | 0.98669 | 0.33692 | YES |
| 0.15 | 0.96773 | 3.1e-2 | 0.95400 | 0.19557 | YES |
| 0.20 | 0.96750 | 2.0e-2 | 0.88942 | 0.11352 | YES |
| 0.30 | 0.44273 | 9.4e-2 | 0.64812 | 0.03825 | YES |
| 0.40 | 0.35027 | 7.3e-2 | 0.34666 | 0.01289 | YES |
| 0.60 | 0.08231 | 5.0e-2 | 0.05209 | 0.00146 | BURIED |

## C. n sweep (beta=0.3): the sign wall grows with system size

| n | kappa | MC ⟨sign⟩ | ± err | exact (n≤8) | ΔE0 | P (exp1) | samples ~ 1/⟨sign⟩² |
|---|---|---|---|---|---|---|---|
| 4 | 0.3 | 0.99134 | 4.2e-3 | 0.98919 | 0.9413 | — | 1.0e+0 |
| 4 | 1.0 | 0.92034 | 5.4e-2 | 0.94409 | 2.7889 | 0.2630 | 1.0e+0 |
| 6 | 0.3 | 0.97310 | 1.1e-2 | 0.97144 | 2.2241 | — | 1.0e+0 |
| 6 | 1.0 | 0.79643 | 5.2e-2 | 0.80089 | 6.8889 | 0.0784 | 2.0e+0 |
| 8 | 0.3 | 0.96419 | 1.1e-2 | 0.95273 | 3.3639 | — | 1.0e+0 |
| 8 | 1.0 | 0.56662 | 7.3e-2 | 0.64812 | 10.8790 | 0.0204 | 3.0e+0 |
| 10 | 0.3 | 0.91892 | 3.1e-2 | — | 3.6470 | — | 1.0e+0 |
| 10 | 1.0 | 0.66196 | 6.7e-2 | — | 12.4052 | 0.0023 | 2.0e+0 |
| 12 | 0.3 | 0.93673 | 1.3e-2 | — | 3.8249 | — | 1.0e+0 |
| 12 | 1.0 | 0.63464 | 3.8e-2 | — | 13.8722 | 0.0010 | 2.0e+0 |

每点 3 个独立种子，误差 = max(散布/√3, 单跑自适应块误差)。散布捕捉超出
最大块宽的扇区自相关：κ=1 行的大误差棒正是符号问题在局部更新下的第二重
代价——它先于 1/⟨sign⟩² 地板出现（同一点不同种子曾给出互差 7σ 的点估计）。

## D. Driving our own sampler into the wall (n=10, kappa=1.0, beta=0.6)

- exact ⟨sign⟩ = 0.027647; our 100k-sweep run gives 0.103480 ± 4.4e-2
- the naive floor is N ≈ 1/⟨sign⟩² ≈ 1.3e+3 sweeps for a mere SNR ≈ 1,
- and the TRUE cost multiplies that floor by the sector-flip autocorrelation time, which itself
  grows as the sign gets rarer (the deviation above is that autocorrelation at work) —
  measured on our own sampler, not asserted from literature, while the stoquastic baseline
  (kappa=0) pays nothing (sign ≡ 1).
