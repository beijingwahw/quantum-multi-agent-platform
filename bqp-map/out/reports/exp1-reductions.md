# EXP1 — Executable reduction certificates

## A: Partition <-> P2||Cmax (random)

300/300 equivalences hold; 294 YES / 6 NO. NO instances exceed the target B by a minimum of 1 (integer gap, never a rounding artifact).

## B: exhaustive multiset sweep (n=5, values 1..8)

396 even-total multisets enumerated exhaustively; equivalence holds on all; 236 YES (59.6%). No instance shape is special.

## C: 3-Partition <-> P||Cmax (promise instances)

120 instances (m=3,4), referee = exhaustive 3-partition solver; equivalence holds on all; 59 YES / 61 NO. Mean B&B nodes per instance: 235 — the exponential meter behind "strong".

## D: optimal schedules decode into 3-partitions

50/50 generated-YES instances: the B&B optimum has exactly 3 jobs per machine and every machine sums to B — the <= direction is constructive, not just a decision coincidence.

## E: FPTAS for P2||Cmax and the strong-variant size gap

| eps | worst observed ratio | 1+eps bound | verdict |
| --- | --- | --- | --- |
| 0.02 | 1.00000 | 1.02 | OK |
| 0.05 | 1.00535 | 1.05 | OK |
| 0.10 | 1.01099 | 1.10 | OK |
| 0.20 | 1.02655 | 1.20 | OK |

Strong side (3-Partition at m=6, B=40): unary size 258 vs binary 74 — a pseudo-polynomial algorithm in the unary metric would be polynomial; that door is what "strongly NP-hard" closes (GJ78).

## F: Johnson's rule (F2||Cmax, the P island)

60/60 random instances (n=4..8): Johnson's O(n log n) order attains the all-permutation brute-force optimum. Exactness is machine-checked, not admired.

## G: Ising encoding parity

25 per-configuration identities Q(z) = (2*C(z) - total)^2 exact; 25/25 ground states match the exact DP optimum (sqrt(min Q) = 2*OPT - total in absolute value). The atlas's quantum rows consume exactly this encoding.
