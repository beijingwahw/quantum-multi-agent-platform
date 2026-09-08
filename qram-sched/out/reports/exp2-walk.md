# EXP2 — Szegedy walk search: quadratic detection on scheduling chains

Walk operator per step: C . S . R (column diffusion, flip-flop swap, oracle flip on edges touching marked). Classical referee: exact expected hitting time via the fundamental matrix (LU) on the same lazy chain from the same start law. Unitarity monitored every step (min norm must stay 1).

## A. Complete graph K_n (lazy), marked = vertex 0, start = uniform off marked

| n | classical HT (LU) | closed form 2(n-1) | quantum detection (0.25) | peak p | min norm | CT/QT |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | 30.0 | 30.0 | 4 | 0.337 | 1.000000000000 | 7.50 |
| 32 | 62.0 | 62.0 | 5 | 0.339 | 1.000000000000 | 12.40 |
| 64 | 126.0 | 126.0 | 7 | 0.271 | 1.000000000000 | 18.00 |
| 128 | 254.0 | 254.0 | 10 | 0.279 | 1.000000000000 | 25.40 |
| 256 | 510.0 | 510.0 | 14 | 0.299 | 0.999999999999 | 36.43 |

Exponent fits: log2 QT vs log2 n slope = 0.461 (theory 0.5); log2 CT vs log2 n slope = 1.021 (theory 1.0). LU reproduces the closed form exactly.

## B. Two-state family (lazy flip probability q), start at 0, marked = 1

| flip prob q | classical HT (LU) | quantum detection | QT * sqrt(q) | CT/QT |
| --- | --- | --- | --- | --- |
| 0.5000000 | 4.00 | 2 | 1.4142 | 2.0 |
| 0.1250000 | 16.00 | 2 | 0.7071 | 8.0 |
| 0.0312500 | 64.00 | 5 | 0.8839 | 12.8 |
| 0.0078125 | 256.00 | 10 | 0.8839 | 25.6 |
| 0.0019531 | 1024.00 | 19 | 0.8397 | 53.9 |

Exponent fit: log2 QT vs log2(1/q) slope = 0.441 (theory 0.5). QT * sqrt(q) converges to a constant: the detection time is on the sqrt(1/q) scale while classical HT = 2/q.

## C. Task-assignment lattice: t tasks x w workers, states = w^t assignments, moves = reassign one task

| t x w | states | |near-optimal| | OPT welfare | classical HT | quantum detection | CT/QT | CT/QT^2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4x3 | 81 | 1 | 3.2697 | 187.2 | 8 | 23.4 | 2.92 |
| 5x3 | 243 | 1 | 4.0155 | 556.1 | 14 | 39.7 | 2.84 |
| 6x3 | 729 | 1 | 4.7021 | 1637.4 | 25 | 65.5 | 2.62 |

Marked set = welfare within 0.5% of OPT (a single near-optimal assignment in these instances). log2 CT vs log2 QT slope = 1.903 (theory 2.0 for a quadratic law): the walk finds the near-optimal assignment schedule on the sqrt scale of the classical search time.

## D. Barbell bottleneck (two K_m cliques, one bridge): honest negative

| clique m | n | classical HT (stationary start) | early transient crossing (0.25) | envelope peak at step | peak p | min norm | CT/peak |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 8 | 16 | 98.0 | 2 | 729 | 0.7056 | 1.000000000000 | 49.00 |
| 16 | 32 | 329.5 | 5 | 3264 | 0.6358 | 1.000000000000 | 65.90 |
| 32 | 64 | 1177.2 | 8 | 9442 | 0.5634 | 1.000000000000 | 147.16 |

Two regimes, both reported: an early transient brushes the 0.25 threshold within a few steps (probabilities 0.26-0.50, not a reliable detection guarantee), while the detection ENVELOPE peaks at 729/3264/9442 — an order of magnitude LATER than the classical hitting times 98/330/1177. On bottleneck graphs this operator class loses outright: Szegedy's quadratic-detection guarantee is stated for the absorbing-chain quantization with MNRS phase schedules, and naive single-operator marked-flip walks are documented to forfeit speedups on bottlenecks. Reported as-is: walk speedups on scheduling chains are instance-structural, not universal — the honest scope of the EXP2-C claim. (Detection-time conventions matter: single-threshold first-crossing is transient-contaminated here; we report the envelope peak.)

## D'. Barbell family census: chains of k K_m cliques, k single bridges in series

| cliques k | clique m | n | classical HT (stationary start) | envelope peak at step | peak p | peak/HT |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 8 | 16 | 98.0 | 729 | 0.7056 | 7.4 |
| 3 | 8 | 24 | 261.3 | 1941 | 0.5398 | 7.4 |
| 4 | 8 | 32 | 501.9 | 1435 | 0.4564 | 2.9 |
| 3 | 16 | 48 | 953.6 | 2821 | 0.4802 | 3.0 |

Extending the bottleneck census (v0.2.0): with bridges added in series the negative HOLDS — the envelope peak stays beyond the classical hitting time at every chain length probed (peak/HT > 1 throughout). The naive marked-flip walk operator loses on the whole bottleneck family, not only the two-clique barbell. The priced deliverable was machine data either way; this side of it is negative, and it is reported as negative.

