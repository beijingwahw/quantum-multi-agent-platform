# T4 — scheduling contact: when is postselection a free resource?

## A. the freeness table: active postselection vs heralded loss

Two ways the branch gets rejected. ACTIVE: the algorithm probes the flag itself — every attempt burns one oracle query. HERALDED: the environment already rejects the branch (loss channel, entanglement herald) — the accepted subensemble arrives at the same rate with zero query cost.

| q | rounds/answer exact (1/q) | active MC rounds | sigma | heralded MC rounds | sigma | active queries/answer | heralded queries/answer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.0625 | 16.0000 | 15.9958 | 0.12 | 15.9678 | 0.93 | 16.0000 | 0 (exact) |
| 0.1250 | 8.0000 | 7.9867 | 0.80 | 8.0077 | 0.46 | 8.0000 | 0 (exact) |
| 0.2500 | 4.0000 | 3.9805 | 2.52 | 3.9925 | 0.97 | 4.0000 | 0 (exact) |
| 0.5000 | 2.0000 | 1.9948 | 1.64 | 2.0002 | 0.07 | 2.0000 | 0 (exact) |

Both models wait under the SAME geometric law (identical round statistics, both within sigma of 1/q) — only the cost column differs: the query ledger 1/q is charged exactly when the algorithm must do the rejecting itself. Postselection is a free resource exactly when the hardware already heralds the same branches. This is the ent-sched regime: heralded swap/purification attempts are many-worlds sorters whose ledger is paid in wall-clock rounds, not oracle queries (cross-prototype pointer, parameters here illustrative).

## B. online depth-doubling: sorting when the marked count t is unknown

| N | t | E*(t) (oracle knows t) | doubling schedule | ratio |
| --- | --- | --- | --- | --- |
| 256 | 1 | 11.619 | 46.275 | 3.983 |
| 256 | 3 | 6.944 | 17.590 | 2.533 |
| 256 | 7 | 4.747 | 9.624 | 2.027 |
| 256 | 15 | 3.396 | 6.518 | 1.919 |
| 256 | 31 | 2.610 | 4.260 | 1.632 |
| 256 | 63 | 2.000 | 2.891 | 1.445 |
| 256 | 127 | 2.016 | 2.340 | 1.161 |

Without knowing t, cycling the doubling-depth schedule costs at most 3.983x the oracle-informed optimum on this grid — the LSZ robustness trade executed on the sorter's own success curve. The scheduler pays a constant-factor insurance premium instead of an instance-adaptive search.
