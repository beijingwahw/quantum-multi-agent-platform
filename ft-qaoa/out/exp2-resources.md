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

## Assumption-constants audit (provenance gate)

| id | value | kind | provenance (workIds) | bound to |
|---|---|---|---|---|
| gross-code-params | [[144,12,12]], 288 total qubits per block incl. 144 ancillas | citation-anchored | bravyi-2024-gross; ibm-blog-qldpc; ec-zoo-gross | grossCode.k = 12 |
| gross-code-distance | 12 | citation-anchored | bravyi-2024-gross; ec-zoo-gross | grossCode.d = 12 |
| gross-code-pseudo-threshold | 0.007 | citation-anchored | bravyi-2024-gross; ibm-blog-qldpc | grossCode.threshold = 0.007 |
| surface-threshold-default | 0.006 | engineering-assumption | fowler-2012-surface; ec-zoo-thresholds | surfaceCode.defaultThreshold = 0.006 |
| logical-error-prefactor | 0.1 | engineering-assumption | fowler-2012-surface | DEFAULT_FT_ASSUMPTIONS.logicalErrorModel.amplitude = 0.1 |
| physical-error-default | 0.001 | engineering-assumption | — | DEFAULT_FT_ASSUMPTIONS.pPhys = 0.001 |
| cycle-time-us | 1 | engineering-assumption | fowler-2012-surface | DEFAULT_FT_ASSUMPTIONS.cycleTimeUs = 1 |
| rounds-per-op-distance-factor | 1 | engineering-assumption | — | DEFAULT_FT_ASSUMPTIONS.roundsPerOpDistanceFactor = 1 |
| target-circuit-error | 0.01 | engineering-assumption | — | DEFAULT_FT_ASSUMPTIONS.targetCircuitError = 0.01 |
| synthesis-tcount-coefficient | 3 | citation-anchored | ross-selinger-2014; kmm-2013-synthesis | DEFAULT_FT_ASSUMPTIONS.synthesis.coefficient = 3 |
| synthesis-tcount-additive | 4 | engineering-assumption | ross-selinger-2014 | DEFAULT_FT_ASSUMPTIONS.synthesis.additiveConstant = 4 |
| synthesis-epsilon | 0.000001 | engineering-assumption | — | DEFAULT_FT_ASSUMPTIONS.synthesis.epsilon = 0.000001 |
| t-factory-scenarios | (100ns, 5k, 1e-12) / (10us, 5k, 1e-12) / (60us, 12k, 1e-12) | engineering-assumption | gidney-ekera-2021; gidney-2025-rsa | — |
| t-factory-eps-per-t | 1e-12 | engineering-assumption | gidney-ekera-2021 | DEFAULT_FT_ASSUMPTIONS.tFactory.epsilonPerT = 1e-12 |
| decoder-cpu-latency | 1000 | engineering-assumption | bascones-2025-bposd-hw; fpga-relay-bp-2025 | — |
| decoder-fpga-latency | 100 | engineering-assumption | google-2024-below-threshold; fpga-relay-bp-2025 | — |
| decoder-asic-latency | 1 | engineering-assumption | riverlane-realtime; bascones-2025-bposd-hw | — |
| logical-error-suppression-lambda | 2.14 | citation-anchored | google-2024-below-threshold; princeton-below-threshold | — |
| d7-logical-error-per-cycle | 0.00143 | citation-anchored | google-2024-below-threshold; princeton-below-threshold | — |
| qaoa-noise-finite-depth | finite optimal QAOA depth under per-layer depolarizing noise; ~2%/gate caps useful depth near 3 | citation-anchored | marshall-2020-qaoa-noise; pan-2022-depth-opt | — |

Gate: PASS — 20 rows, 7 citation-anchored (>= 2 independent works each), 13 labeled engineering assumptions.