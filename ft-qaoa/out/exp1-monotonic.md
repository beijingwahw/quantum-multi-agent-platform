# Experiment 1 — Depth monotonicity of deep QAOA

Seeds fixed; regenerate with `npm run exp:monotonic`.

## A. Embedding identity F_{p+1}(theta|0,0) = F_p(theta) (engine-level, should be ~1e-15)

| p | gap | pass |
|---|---|---|
| 2 | 0.00e+0 | YES |
| 8 | 0.00e+0 | YES |
| 64 | 0.00e+0 | YES |
| 128 | 0.00e+0 | YES |

## B. Optimized value ladder, full coordinate descent (random-n10-s20260905, p=1..6)

| p | best <C> | ratio |
|---|---|---|
| 1 | 4.8235 | 0.486052 |
| 2 | 6.1616 | 0.620891 |
| 3 | 7.0174 | 0.707133 |
| 4 | 7.2980 | 0.735411 |
| 5 | 7.8748 | 0.793528 |
| 6 | 8.1609 | 0.822359 |

monotone (found values): YES

## C. Deep ladder to p=128 (ramp + INTERP transfer + time re-tune)

### random-n10-s20260905 (optimum 9.9238)

| p | ratio r_p |
|---|---|
| 8 | 0.834173 |
| 16 | 0.938213 |
| 32 | 0.991341 |
| 64 | 0.999404 |
| 96 | 0.999894 |
| 128 | 0.999911 |

monotone within 2e-3 tolerance: YES

### random-n10-s20260906 (optimum 10.9164)

| p | ratio r_p |
|---|---|
| 8 | 0.795631 |
| 16 | 0.913146 |
| 32 | 0.979322 |
| 64 | 0.997799 |
| 96 | 0.999685 |
| 128 | 0.999923 |

monotone within 2e-3 tolerance: YES

### random-n10-s20260907 (optimum 11.2683)

| p | ratio r_p |
|---|---|
| 8 | 0.797099 |
| 16 | 0.918774 |
| 32 | 0.981695 |
| 64 | 0.997530 |
| 96 | 0.999500 |
| 128 | 0.999901 |

monotone within 2e-3 tolerance: YES

### random-n10-s20260908 (optimum 14.0132)

| p | ratio r_p |
|---|---|
| 8 | 0.779649 |
| 16 | 0.881049 |
| 32 | 0.947725 |
| 64 | 0.979969 |
| 96 | 0.989377 |
| 128 | 0.994025 |

monotone within 2e-3 tolerance: YES

### random-n10-s20260909 (optimum 13.2438)

| p | ratio r_p |
|---|---|
| 8 | 0.792322 |
| 16 | 0.921580 |
| 32 | 0.982175 |
| 64 | 0.998497 |
| 96 | 0.999783 |
| 128 | 0.999910 |

monotone within 2e-3 tolerance: YES

### maxcut-n12-s20261005 (optimum 12.0000, maxcut 15)

| p | ratio r_p |
|---|---|
| 8 | 0.894917 |
| 16 | 0.948347 |
| 32 | 0.985514 |
| 64 | 0.998391 |
| 96 | 0.999787 |
| 128 | 0.999869 |

monotone within 2e-3 tolerance: YES

### random-n14-s20261105 (optimum 12.6652)

| p | ratio r_p |
|---|---|
| 8 | 0.797566 |
| 16 | 0.880381 |
| 32 | 0.927279 |
| 64 | 0.964310 |
| 96 | 0.982957 |
| 128 | 0.991166 |

monotone within 2e-3 tolerance: YES

**Worst-case r_128 across 7 instances: 0.991166**
