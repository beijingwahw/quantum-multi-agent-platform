# Experiment 1 — Sign-structure barrier of non-stoquastic drivers

Ground state of H(s) = s·C + (1−s)·H_D at s=0.5, imaginary-time projection.
P = Σψ/Σ|ψ|: 1 for every stoquastic ground state (Perron-Frobenius);
P < 1 certifies the sign structure that worldline samplers pay for exponentially.
Regenerate with `npm run exp:sign`.

| n | kappa | sign ratio P | <H(s)> | converged | steps |
|---|---|---|---|---|---|
| 6 | 0.0 | 1.000000 | -4.0385 | YES | 621 |
| 6 | 0.1 | 0.999933 | -3.7387 | YES | 559 |
| 6 | 0.3 | 0.543668 | -3.5330 | YES | 364 |
| 6 | 1.0 | 0.078400 | -3.8313 | YES | 521 |
| 8 | 0.0 | 1.000000 | -5.2485 | YES | 437 |
| 8 | 0.1 | 0.974148 | -4.8936 | YES | 371 |
| 8 | 0.3 | 0.411775 | -4.6631 | YES | 421 |
| 8 | 1.0 | 0.020413 | -5.2865 | YES | 614 |
| 10 | 0.0 | 1.000000 | -7.3471 | YES | 277 |
| 10 | 0.1 | 0.970388 | -6.9322 | YES | 324 |
| 10 | 0.3 | 0.352080 | -6.6098 | YES | 355 |
| 10 | 1.0 | 0.002293 | -7.8448 | YES | 424 |
| 12 | 0.0 | 1.000000 | -9.3944 | YES | 374 |
| 12 | 0.1 | 0.958395 | -9.0054 | YES | 337 |
| 12 | 0.3 | 0.239132 | -8.7782 | YES | 333 |
| 12 | 1.0 | 0.001026 | -10.5634 | YES | 645 |

**Stoquastic baseline (kappa=0): all P = 1 — CONFIRMED**
