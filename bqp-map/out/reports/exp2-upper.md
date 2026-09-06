# EXP2 — Quantum upper bounds (HW-WAIT certificates)

## A: Grover — three-way agreement (closed form / exact simulation / classical wall)

| N | k* | k*/sqrt(N) (-> pi/4 = 0.7854) | success at k* | classical best at k* queries (k*/N) | advantage factor |
| --- | --- | --- | --- | --- | --- |
| 64 | 6 | 0.7500 | 0.996586 | 9.375e-2 | 1.06e+1 |
| 256 | 12 | 0.7500 | 0.999947 | 4.688e-2 | 2.13e+1 |
| 1024 | 25 | 0.7813 | 0.999461 | 2.441e-2 | 4.09e+1 |
| 4096 | 50 | 0.7813 | 0.999945 | 1.221e-2 | 8.19e+1 |
| 16384 | 100 | 0.7813 | 1.000000 | 6.104e-3 | 1.64e+2 |

Closed form and exact state-vector evolution agree to 1e-12 at every size. The advantage factor is the ratio quantum:classical at the SAME query budget.

## B: Durr-Hoyer minimum finding (random valuations)

| N | optimal found | median queries | queries/sqrt(N) | classical exhaustive |
| --- | --- | --- | --- | --- |
| 256 | 16/16 | 209.5 | 13.09 | 256 |
| 1024 | 16/16 | 460 | 14.38 | 1024 |
| 4096 | 12/12 | 1031.5 | 16.12 | 4096 |

log-log slope of median queries vs N: 0.575 — the asymptotic law is 0.5; the excess is the level/ladder overhead of the implementation (queries/sqrt(N) creeps 13.1 -> 16.1 as N grows 256 -> 4096), reported as measured.

## C: DH on the assignment space of P2||Cmax instances

| n (jobs) | N = 2^n | DP optimum | DH attains optimum | median queries | queries/sqrt(N) |
| --- | --- | --- | --- | --- | --- |
| 8 | 256 | 75 | 10/10 | 194 | 12.13 |
| 10 | 1024 | 106 | 10/10 | 396.5 | 12.39 |
| 12 | 4096 | 120 | 10/10 | 824.5 | 12.88 |

Every DH run lands on the exact DP optimum: the quadratic query certificate applies to a real scheduling instance, not a synthetic array.
