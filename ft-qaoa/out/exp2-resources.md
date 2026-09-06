# Experiment 2 — Fault-tolerance resource estimates for deep QAOA

Heuristic estimator; every constant lives in `FtAssumptions` and is swept here,
nothing is hidden. Regenerate with `npm run exp:resources`.

## Code selection (smallest-qubit feasible choice: surface d-search vs gross [[144,12,12]])

| L | p | code | d | blocks | total phys qubits | wall time | T gates | factory scenario | factories | eps_total | budget |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 12 | 8 | gross-bb-144-12-12 | 12 | 1 | 5,288 | 5.76 ms | 30,720 | optimistic-100ns | 1 | 6.99e-4 | OK |
| 12 | 8 | gross-bb-144-12-12 | 12 | 1 | 270,288 | 5.76 ms | 30,720 | moderate-10us | 54 | 6.99e-4 | OK |
| 12 | 8 | gross-bb-144-12-12 | 12 | 1 | 3,840,288 | 5.76 ms | 30,720 | conservative-60us | 320 | 6.99e-4 | OK |
| 12 | 100 | gross-bb-144-12-12 | 12 | 1 | 5,288 | 72.00 ms | 384,000 | optimistic-100ns | 1 | 0.009 | OK |
| 12 | 100 | gross-bb-144-12-12 | 12 | 1 | 270,288 | 72.00 ms | 384,000 | moderate-10us | 54 | 0.009 | OK |
| 12 | 100 | gross-bb-144-12-12 | 12 | 1 | 3,840,288 | 72.00 ms | 384,000 | conservative-60us | 320 | 0.009 | OK |
| 12 | 128 | surface-d15 | 15 | 12 | 10,388 | 115.20 ms | 491,520 | optimistic-100ns | 1 | 0.007 | OK |
| 12 | 128 | surface-d15 | 15 | 12 | 220,388 | 115.20 ms | 491,520 | moderate-10us | 43 | 0.007 | OK |
| 12 | 128 | surface-d15 | 15 | 12 | 3,077,388 | 115.20 ms | 491,520 | conservative-60us | 256 | 0.007 | OK |
| 12 | 256 | surface-d17 | 17 | 12 | 11,924 | 261.12 ms | 983,040 | optimistic-100ns | 1 | 0.003 | OK |
| 12 | 256 | surface-d17 | 17 | 12 | 196,924 | 261.12 ms | 983,040 | moderate-10us | 38 | 0.003 | OK |
| 12 | 256 | surface-d17 | 17 | 12 | 2,718,924 | 261.12 ms | 983,040 | conservative-60us | 226 | 0.003 | OK |
| 54 | 8 | gross-bb-144-12-12 | 12 | 5 | 6,440 | 25.92 ms | 138,240 | optimistic-100ns | 1 | 0.003 | OK |
| 54 | 8 | gross-bb-144-12-12 | 12 | 5 | 271,440 | 25.92 ms | 138,240 | moderate-10us | 54 | 0.003 | OK |
| 54 | 8 | gross-bb-144-12-12 | 12 | 5 | 3,841,440 | 25.92 ms | 138,240 | conservative-60us | 320 | 0.003 | OK |
| 54 | 100 | surface-d17 | 17 | 54 | 36,158 | 459.00 ms | 1,728,000 | optimistic-100ns | 1 | 0.005 | OK |
| 54 | 100 | surface-d17 | 17 | 54 | 221,158 | 459.00 ms | 1,728,000 | moderate-10us | 38 | 0.005 | OK |
| 54 | 100 | surface-d17 | 17 | 54 | 2,743,158 | 459.00 ms | 1,728,000 | conservative-60us | 226 | 0.005 | OK |
| 54 | 128 | surface-d17 | 17 | 54 | 36,158 | 587.52 ms | 2,211,840 | optimistic-100ns | 1 | 0.006 | OK |
| 54 | 128 | surface-d17 | 17 | 54 | 221,158 | 587.52 ms | 2,211,840 | moderate-10us | 38 | 0.006 | OK |
| 54 | 128 | surface-d17 | 17 | 54 | 2,743,158 | 587.52 ms | 2,211,840 | conservative-60us | 226 | 0.006 | OK |
| 54 | 256 | surface-d19 | 19 | 54 | 43,934 | 1.31 s | 4,423,680 | optimistic-100ns | 1 | 0.002 | OK |
| 54 | 256 | surface-d19 | 19 | 54 | 208,934 | 1.31 s | 4,423,680 | moderate-10us | 34 | 0.002 | OK |
| 54 | 256 | surface-d19 | 19 | 54 | 2,474,934 | 1.31 s | 4,423,680 | conservative-60us | 203 | 0.002 | OK |
| 80 | 8 | gross-bb-144-12-12 | 12 | 7 | 7,016 | 38.40 ms | 204,800 | optimistic-100ns | 1 | 0.005 | OK |
| 80 | 8 | gross-bb-144-12-12 | 12 | 7 | 272,016 | 38.40 ms | 204,800 | moderate-10us | 54 | 0.005 | OK |
| 80 | 8 | gross-bb-144-12-12 | 12 | 7 | 3,842,016 | 38.40 ms | 204,800 | conservative-60us | 320 | 0.005 | OK |
| 80 | 100 | surface-d17 | 17 | 80 | 51,160 | 680.00 ms | 2,560,000 | optimistic-100ns | 1 | 0.007 | OK |
| 80 | 100 | surface-d17 | 17 | 80 | 236,160 | 680.00 ms | 2,560,000 | moderate-10us | 38 | 0.007 | OK |
| 80 | 100 | surface-d17 | 17 | 80 | 2,758,160 | 680.00 ms | 2,560,000 | conservative-60us | 226 | 0.007 | OK |
| 80 | 128 | surface-d17 | 17 | 80 | 51,160 | 870.40 ms | 3,276,800 | optimistic-100ns | 1 | 0.009 | OK |
| 80 | 128 | surface-d17 | 17 | 80 | 236,160 | 870.40 ms | 3,276,800 | moderate-10us | 38 | 0.009 | OK |
| 80 | 128 | surface-d17 | 17 | 80 | 2,758,160 | 870.40 ms | 3,276,800 | conservative-60us | 226 | 0.009 | OK |
| 80 | 256 | surface-d19 | 19 | 80 | 62,680 | 1.95 s | 6,553,600 | optimistic-100ns | 1 | 0.003 | OK |
| 80 | 256 | surface-d19 | 19 | 80 | 227,680 | 1.95 s | 6,553,600 | moderate-10us | 34 | 0.003 | OK |
| 80 | 256 | surface-d19 | 19 | 80 | 2,493,680 | 1.95 s | 6,553,600 | conservative-60us | 203 | 0.003 | OK |
| 100 | 8 | gross-bb-144-12-12 | 12 | 9 | 7,592 | 48.00 ms | 256,000 | optimistic-100ns | 1 | 0.006 | OK |
| 100 | 8 | gross-bb-144-12-12 | 12 | 9 | 272,592 | 48.00 ms | 256,000 | moderate-10us | 54 | 0.006 | OK |
| 100 | 8 | gross-bb-144-12-12 | 12 | 9 | 3,842,592 | 48.00 ms | 256,000 | conservative-60us | 320 | 0.006 | OK |
| 100 | 100 | surface-d17 | 17 | 100 | 62,700 | 850.00 ms | 3,200,000 | optimistic-100ns | 1 | 0.008 | OK |
| 100 | 100 | surface-d17 | 17 | 100 | 247,700 | 850.00 ms | 3,200,000 | moderate-10us | 38 | 0.008 | OK |
| 100 | 100 | surface-d17 | 17 | 100 | 2,769,700 | 850.00 ms | 3,200,000 | conservative-60us | 226 | 0.008 | OK |
| 100 | 128 | surface-d19 | 19 | 100 | 77,100 | 1.22 s | 4,096,000 | optimistic-100ns | 1 | 0.002 | OK |
| 100 | 128 | surface-d19 | 19 | 100 | 242,100 | 1.22 s | 4,096,000 | moderate-10us | 34 | 0.002 | OK |
| 100 | 128 | surface-d19 | 19 | 100 | 2,508,100 | 1.22 s | 4,096,000 | conservative-60us | 203 | 0.002 | OK |
| 100 | 256 | surface-d19 | 19 | 100 | 77,100 | 2.43 s | 8,192,000 | optimistic-100ns | 1 | 0.004 | OK |
| 100 | 256 | surface-d19 | 19 | 100 | 242,100 | 2.43 s | 8,192,000 | moderate-10us | 34 | 0.004 | OK |
| 100 | 256 | surface-d19 | 19 | 100 | 2,508,100 | 2.43 s | 8,192,000 | conservative-60us | 203 | 0.004 | OK |

## Gross-code (fixed d=12) physical-error sensitivity, L=80, p=128

| p_phys | eps_total | budget |
|---|---|---|
| 1e-3 | 0.075 | FAIL |
| 3e-4 | 1.96e-5 | OK |
| 1e-4 | 3.28e-6 | OK |
