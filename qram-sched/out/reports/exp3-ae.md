# EXP3 — amplitude estimation: quadratic precision law on encoded task streams

QAE is simulated exactly: m phase qubits, controlled-G^{2^j} on the 2-plane Grover rotation, exact inverse QFT in complex arithmetic; measurement outcomes drawn from the exact distribution. Classical referee: Monte Carlo median error over 4000 seeded trials.

## A. Full-space Grover referee (N = 256, t = 16 marked)

| iterations k | full-space simulation | closed form sin^2((2k+1)theta) | |diff| |
| --- | --- | --- | --- |
| 0 | 0.062500000000 | 0.062500000000 | 0.00e+0 |
| 1 | 0.472656250000 | 0.472656250000 | 0.00e+0 |
| 2 | 0.908447265625 | 0.908447265625 | 0.00e+0 |
| 3 | 0.961318969727 | 0.961318969727 | 0.00e+0 |
| 4 | 0.581704139709 | 0.581704139709 | 2.22e-16 |
| 6 | 0.020380768925 | 0.020380768925 | 3.82e-17 |
| 8 | 0.836089174860 | 0.836089174860 | 0.00e+0 |
| 12 | 0.001143428793 | 0.001143428793 | 3.01e-17 |

Max deviation across the schedule: 2.22e-16 — the 2-plane reduction is exact.

## B. Precision law: QAE median error vs Monte Carlo median error

| true p | phase qubits m | oracle queries 2^m-1 | QAE median error | error x queries |
| --- | --- | --- | --- | --- |
| 0.10 | 3 | 7 | 4.645e-2 | 0.33 |
| 0.10 | 4 | 15 | 4.645e-2 | 0.70 |
| 0.10 | 5 | 31 | 1.573e-2 | 0.49 |
| 0.10 | 6 | 63 | 1.573e-2 | 0.99 |
| 0.10 | 7 | 127 | 1.604e-3 | 0.20 |
| 0.10 | 8 | 255 | 1.604e-3 | 0.41 |
| 0.10 | 9 | 511 | 1.604e-3 | 0.82 |
| 0.10 | 10 | 1023 | 2.314e-4 | 0.24 |
| 0.37 | 3 | 7 | 1.300e-1 | 0.91 |
| 0.37 | 4 | 15 | 6.134e-2 | 0.92 |
| 0.37 | 5 | 31 | 3.245e-2 | 1.01 |
| 0.37 | 6 | 63 | 1.514e-2 | 0.95 |
| 0.37 | 7 | 127 | 8.510e-3 | 1.08 |
| 0.37 | 8 | 255 | 3.356e-3 | 0.86 |
| 0.37 | 9 | 511 | 2.567e-3 | 1.31 |
| 0.37 | 10 | 1023 | 3.971e-4 | 0.41 |
| 0.70 | 3 | 7 | 2.000e-1 | 1.40 |
| 0.70 | 4 | 15 | 8.658e-3 | 0.13 |
| 0.70 | 5 | 31 | 8.658e-3 | 0.27 |
| 0.70 | 6 | 63 | 8.658e-3 | 0.55 |
| 0.70 | 7 | 127 | 8.658e-3 | 1.10 |
| 0.70 | 8 | 255 | 2.621e-3 | 0.67 |
| 0.70 | 9 | 511 | 3.004e-3 | 1.54 |
| 0.70 | 10 | 1023 | 1.879e-4 | 0.19 |

Slope of log2(error) vs log2(queries) for p = 0.37: -1.070 (theory -1).

| MC samples s | MC median error | error x sqrt(s) |
| --- | --- | --- |
| 16 | 6.750e-2 | 0.270 |
| 64 | 4.187e-2 | 0.335 |
| 256 | 2.063e-2 | 0.330 |
| 1024 | 9.883e-3 | 0.316 |
| 4096 | 5.244e-3 | 0.336 |
| 16384 | 2.507e-3 | 0.321 |

Slope of log2(error) vs log2(samples) for MC: -0.483 (theory -1/2).

## C. Queries at matched median accuracy (p = 0.37)

| target median error | QAE queries | MC samples | MC/QAE ratio |
| --- | --- | --- | --- |
| 0.050 | 31 | 64 | 2.1 |
| 0.020 | 63 | 512 | 8.1 |
| 0.010 | 127 | 1024 | 8.1 |
| 0.005 | 255 | 8192 | 32.1 |
| 0.002 | 1023 | 32768 | 32.0 |

The ratio grows like ~1/eps: at accuracy 0.2% the quantum estimator uses ~32x fewer oracle calls; the law is eps vs eps^2, the signature of amplitude estimation (Brassard-Hoyer-Mosca-Tapp).

## D. Stream mean from the amplitude-encoded task flow (N = 256 cells)

| estimator | result | queries | |error| |
| --- | --- | --- | --- |
| exact mean (referee) | 0.481070 | - | - |
| bus-one probability of encoded state | 0.481070 | 1 query + n Hadamards | 0.000000000000000 |
| Monte Carlo, 100 samples | 0.520000 | 100 | 0.038930 |
| Monte Carlo, 1600 samples | 0.490625 | 1600 | 0.009555 |
| QAE median error, m = 7 | - | 127 | 5.604e-3 |

The encoded stream's bus-one probability IS the mean to machine precision: one query exposes the statistic, and amplitude estimation reads it to eps with O(1/eps) queries instead of O(1/eps^2) samples. This is the quantum-query layer that EXP4's replay scheduler consumes.

