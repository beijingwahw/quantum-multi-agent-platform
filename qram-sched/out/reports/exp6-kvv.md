# EXP6 — KVV tight instances executed: the caps met exactly, the query ledger torn anyway

Family (Feige, arXiv:1812.11774, Sec. 1.1, representing KVV STOC 1990's D_n): MonotoneG has arrival u_j adjacent to exactly {v_j, ..., v_n} (nested suffixes; unique perfect matching (u_j, v_j)); D_n = MonotoneG under a uniformly random worker relabeling. Exact kernels: derangement formula ((n+1)! - d(n+1) - d(n))/n!, exhaustive n!-permutation RANKING enumeration, and an independent subset DP for greedy-uniform. Referee for OPT: Kuhn augmenting paths.

## A. E[size on D_n] — derangement formula vs exhaustive enumeration vs greedy-uniform DP

| n | E = a(n)/n! (Feige) | ratio E/n | E - (1-1/e)n | |exhaustive - formula| | |greedy DP - formula| |
| --- | --- | --- | --- | --- | --- |
| 2 | 1.500000000 | 0.750000 | 0.2358 | 0.000000000000000 | 0.000000000000000 |
| 4 | 2.791666667 | 0.697917 | 0.2632 | 0.000000000000000 | 0.000000000000000 |
| 6 | 4.056944444 | 0.676157 | 0.2642 | 0.000000000000000 | 0.000000000000003 |
| 8 | 5.321205357 | 0.665151 | 0.2642 | 0.000000000000001 | 0.000000000000003 |
| 10 | 6.585446704 | 0.658545 | 0.2642 | - | 0.000000000000003 |
| 12 | 7.849687824 | 0.654141 | 0.2642 | - | 0.000000000000033 |
| 14 | 9.113928941 | 0.650995 | 0.2642 | - | 0.000000000000027 |
| 16 | 10.378170059 | 0.648636 | 0.2642 | - | 0.000000000000126 |

Three independent exact computations agree: the published derangement formula, the n!-permutation RANKING enumeration (n <= 8), and the greedy-uniform subset DP (an unrelated computation) reproduce one number to 1e-15. That agreement IS KVV Lemma 13 executed: on D_n every greedy algorithm earns exactly RANKING's expectation. The additive column converges on 1 - 2/e = 0.2642: the 1 - 1/e cap is met exactly at finite n with the published constant — E = (1-1/e)n + (1-2/e) + O(1/n!), so the ratio sits ABOVE 1-1/e at small n and descends to it (n=16: 0.6486 -> 1-1/e = 0.6321).

## B. Tightness is distributional: name-aware rules beat any fixed member, not the family

| algorithm | fixed MonotoneG member (deterministic) | D_n MC mean (K=2000) | D_n exact |
| --- | --- | --- | --- |
| greedy-lowest | 16 (ratio 1.0000) | 10.3755 | 10.3782 |
| greedy-highest | 8 (ratio 0.5000) | 10.3740 | 10.3782 |
| RANKING (name-oblivious) | - | 10.3905 | 10.3782 |

The honest nuance: greedy-lowest matches PERFECTLY on the fixed member (each u_j takes v_j) and greedy-highest collapses to 1/2 there — but the family is the DISTRIBUTION D_n, and averaging over members drags every name-aware deterministic rule onto the same 10.3782 = a(16)/16! as RANKING (MC within 3e-3 of exact). Tightness is a property of the distribution, not of any single graph; a single-member tightness claim is exactly what the certificate checker in test/kv-tight.test.ts rejects.

## C. Deterministic greedy: the phase adversary holds it at exactly n/2

| n | tie-break rule | OPT (Kuhn) | greedy size | ratio |
| --- | --- | --- | --- | --- |
| 8 | lowest | 8 | 4 | 0.5000 |
| 8 | highest | 8 | 4 | 0.5000 |
| 16 | lowest | 16 | 8 | 0.5000 |
| 16 | highest | 16 | 8 | 0.5000 |
| 64 | lowest | 64 | 32 | 0.5000 |
| 64 | highest | 64 | 32 | 0.5000 |
| 128 | lowest | 128 | 64 | 0.5000 |
| 128 | highest | 128 | 64 | 0.5000 |

The adversary (Feige Sec. 1 sketch): first n/2 arrivals see all workers; the rule's own phase-1 matches form the set S; the last n/2 arrivals see exactly S — every one of them fails. Deterministic once the tie-break rule is fixed (the adversary merely reads the rule), OPT = n, greedy = n/2 TO THE EDGE at every size and both rules: the deterministic 1/2 cap is an exact machine fact, not an asymptotic one. Randomized greedy escapes THIS adversary (its S is random) — its tight instance is the D_n family of section A, where it sits at a(n)/n!, strictly between 1/2 and any escape.

## D. Quantum per-arrival search on exactly these instances: reads torn, ratio pinned

| n | seeds | exact ratio a(n)/(n!·n) | linear mean ratio ± stderr | Durr-Hoyer mean ratio | disagree arrivals | linear reads/inst | Durr-Hoyer reads/inst | read ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 16 | 5000 | 0.6486 | 0.6487 ± 0.0007 | 0.6483 | 457 | 256 | 209 | 1.22 |
| 64 | 2000 | 0.6362 | 0.6372 ± 0.0005 | 0.6366 | 1067 | 4096 | 1919 | 2.13 |
| 256 | 300 | 0.6332 | 0.6326 ± 0.0007 | 0.6320 | 875 | 65536 | 18078 | 3.63 |
| 1024 | 40 | 0.6324 | 0.6334 ± 0.0010 | 0.6330 | 559 | 1048576 | 169166 | 6.20 |

On the tightest stage the separation restates itself: RANKING's mean ratio under the linear rule equals the exact a(n)/(n!·n) within Monte Carlo error at every size, the Durr-Hoyer variant stays on it within its reported bounded-error misses (16:457, 64:1067, 256:875, 1024:559), and the read ledger still tears (log2 read-ratio vs log2 n slope = 0.389, theory 0.5 up to the log factor). Quantum buys the QUERY bill on the KVV family exactly as on random banks; the competitive-ratio cap — an information-theoretic wall — does not move by a single match.

## Honest boundaries

- The exhaustive kernel stops at n <= 9 (362880 permutations) and the subset DP at n <= 24; beyond that the derangement formula (BigInt-exact) carries the exact values and Monte Carlo cross-checks them.
- E on D_n is exact for the DISTRIBUTION; single members vary (section B). The deterministic 1/2 adversary is oblivious only after fixing the tie-break rule — that is the standard content of the sketch.
- Durr-Hoyer disagreements are counted against the exact argmin referee and reported, never assumed zero.
- Read ledgers count oracle reads of the neighbor/rank table (qRAM-accessible data); routing-node activation costs of the qRAM itself are audited separately in EXP1-D.

