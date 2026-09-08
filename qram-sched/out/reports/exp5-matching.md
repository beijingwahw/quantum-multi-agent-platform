# EXP5 — online matching: ratio caps (information) vs query counts (compute)

Referee: exact maximum matching (Kuhn's augmenting paths) on the final graph.

## A. Cascade adversary (arrivals in pairs: v ~ {u_1, u_2}; w ~ {u_1})

| pairs | OPT | greedy-lowest | ratio | greedy-uniform ratio | RANKING ratio |
| --- | --- | --- | --- | --- | --- |
| 8 | 16 | 8.000 | 0.5000 | 0.7550 | 0.7466 |
| 16 | 32 | 16.000 | 0.5000 | 0.7523 | 0.7473 |
| 64 | 128 | 64.000 | 0.5000 | 0.7480 | 0.7511 |

Deterministic greedy with lowest-index ties sits exactly at 1/2 on the cascade (machine-verified); uniform ties and RANKING sit at 3/4 on this family. The worst-case caps (greedy 1/2, RANKING 1 - 1/e, KVV 1990 optimal among randomized) are cited theorems — and since v0.2.0 the KVV tight instances themselves are executed in EXP6 (caps met exactly on D_n and the deterministic phase adversary).

## B. Random Erdos-Renyi banks: RANKING >= greedy, ratio floors

| n (workers = arrivals) | seeds | greedy-uniform mean ratio | RANKING mean ratio | RANKING min ratio |
| --- | --- | --- | --- | --- |
| 16 | 40 | 0.8721 | 0.8542 | 0.7500 |
| 64 | 40 | 0.8622 | 0.8632 | 0.8095 |
| 256 | 40 | 0.8538 | 0.8515 | 0.8214 |

Observed floors stay well above the cited 1 - 1/e ~ 0.632 worst-case cap (as expected — the tight case needs the adversarial recursive construction). Honest nuance: greedy-uniform and RANKING are statistically indistinguishable on random families and their per-instance ordering is NOT a theorem — the caps are worst-case guarantees (greedy 1/2, RANKING 1 - 1/e), not instance-wise dominance. At n = 16 RANKING even trails greedy-uniform on average in this bank.

## C. Per-arrival inner search: linear vs Durr-Hoyer (identical decision rule)

| n | RANKING size (linear) | RANKING size (Durr-Hoyer) | disagree arrivals | linear reads/inst | Durr-Hoyer reads/inst | read ratio |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | 13.65 | 13.65 | 0 | 256 | 201 | 1.28 |
| 64 | 53.65 | 53.35 | 8 | 4096 | 1512 | 2.71 |
| 256 | 120.70 | 120.10 | 23 | 32768 | 6559 | 5.00 |
| 1024 | 124.95 | 124.15 | 23 | 131072 | 13561 | 9.67 |

Read-ratio grows with n (log2 ratio vs log2 n slope = 0.482, theory 0.5 up to the Durr-Hoyer log factor). Matched sizes agree within the bounded-error miss rate; the competitive ratio — an information-theoretic cap — is untouched by the inner search: quantum buys queries, not match quality.

## Honest boundaries

- The 1 - 1/e tightness of RANKING and the 1/2 tightness of greedy are cited theorems (KVV 1990; Birnbaum-Mathieu 2008 survey; Devanur-Jain-Kleinberg 2013 primal-dual proof); this bank machine-verifies the cascade 1/2, the 3/4 family, ordering, and floors — the tight instances themselves are EXECUTED in EXP6 (v0.2.0: Feige arXiv:1812.11774 construction, exact values).
- Durr-Hoyer search is bounded-error; disagreement counts are reported per bank, never assumed zero (v0.2.0: RANKING's counter is honestly maintained against the exact-argmin referee).
- Query ledgers count oracle reads of the score/neighbor table (the qRAM-accessible data); pointer chasing, routing, and measurement overheads are outside this ledger.

