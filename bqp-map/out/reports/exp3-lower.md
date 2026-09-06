# EXP3 — Walls, executed

## A: exhaustive decision-tree enumeration (classical wall)

| N | q | trees enumerated (ALL) | max uniform success | q/N | max worst-case success |
| --- | --- | --- | --- | --- | --- |
| 2 | 2 | 8 | 1.000000 | 1.000000 | 1.000 |
| 3 | 3 | 2187 | 1.000000 | 1.000000 | 1.000 |
| 4 | 2 | 64 | 0.500000 | 0.500000 | 0.000 |
| 4 | 3 | 16384 | 0.750000 | 0.750000 | 0.000 |
| 6 | 3 | 279936 | 0.500000 | 0.500000 | 0.000 |
| 8 | 2 | 512 | 0.250000 | 0.250000 | 0.000 |
| 8 | 3 | 2097152 | 0.375000 | 0.375000 | 0.000 |
| 16 | 2 | 4096 | 0.125000 | 0.125000 | 0.000 |

Adaptive querying, re-querying, post-success continuation — every legal tree shape is inside the count. The cap q/N is exact, and worst-case certainty needs q >= N (the (3,3) row reaches it).

## B: random-tree spot checks at N=64 (20000 trees per q)

| q | cap q/N | observed max | verdict |
| --- | --- | --- | --- |
| 2 | 0.031250 | 0.031250 | OK |
| 4 | 0.062500 | 0.062500 | OK |
| 6 | 0.093750 | 0.093750 | OK |
| 8 | 0.125000 | 0.125000 | OK |

Yao's ingredient: every deterministic tree is capped, so every randomized mixture is too.

## C: BBBV hybrid argument on exact evolutions

| N | q | max dist | bound 2q/sqrt(N) | tightness | max success | cap (2q+1)^2/N |
| --- | --- | --- | --- | --- | --- | --- |
| 256 | 1 | 0.125000 | 0.125000 | 1.0000 | 3.479e-2 | 3.516e-2 |
| 256 | 2 | 0.249511 | 0.250000 | 0.9980 | 9.464e-2 | 9.766e-2 |
| 256 | 4 | 0.495124 | 0.500000 | 0.9902 | 2.847e-1 | 3.164e-1 |
| 256 | 6 | 0.733000 | 0.750000 | 0.9773 | 5.276e-1 | 6.602e-1 |
| 256 | 8 | 0.959423 | 1.000000 | 0.9594 | 7.637e-1 | 1.129e+0 |
| 256 | 12 | 1.363993 | 1.500000 | 0.9093 | 9.999e-1 | 2.441e+0 |
| 256 | 16 | 1.683646 | 2.000000 | 0.8418 | 7.760e-1 | 4.254e+0 |
| 1024 | 1 | 0.062500 | 0.062500 | 1.0000 | 8.766e-3 | 8.789e-3 |
| 1024 | 4 | 0.249390 | 0.250000 | 0.9976 | 7.706e-2 | 7.910e-2 |
| 1024 | 8 | 0.494887 | 0.500000 | 0.9898 | 2.567e-1 | 2.822e-1 |
| 1024 | 16 | 0.958994 | 1.000000 | 0.9590 | 7.362e-1 | 1.063e+0 |
| 1024 | 24 | 1.363456 | 1.500000 | 0.9090 | 9.985e-1 | 2.345e+0 |
| 1024 | 30 | 1.612343 | 1.875000 | 0.8599 | 8.914e-1 | 3.634e+0 |
| 4096 | 1 | 0.031250 | 0.031250 | 1.0000 | 2.196e-3 | 2.197e-3 |
| 4096 | 12 | 0.372822 | 0.375000 | 0.9942 | 1.450e-1 | 1.526e-1 |

The q=1 anchor is EXACT: max distance = 2/sqrt(N) to machine precision at N=256 and N=1024. Lemma and corollary hold for every x and every q probed.

## D: the wall on a scheduling instance (N = 2^10 assignment space)

A black-box algorithm probing the schedule-quality oracle:

- after 6 queries: certified success cap 0.1650 (actual Grover success at 6 queries: 0.1562)
- after 12 queries: cap 0.6104 (actual: 0.4960)
- Grover at k* = 25 queries: success 0.999461
- classical exhaustive: 1024 evaluations; classical at 25 queries: 0.024414

Same instance, non-black-box route: the pseudo-polynomial DP reads the processing times and returns the optimum in O(n * total) — the wall binds the oracle model, not the problem. This is the atlas's central honesty clause, with numbers.
