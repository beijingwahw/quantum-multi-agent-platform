# THE TOTAL GATE — the whole workspace in one verdict

> Ran 2026-09-07T20:05:27.240Z: 59 jobs — 29 epoch repos x (test + typecheck) + the platform repo's full suite (exclusive slot + one disclosed retry, batch 37). 1 RED CELL(S). Wall-sum 900s at concurrency 4.


## Disclosed retries (both attempts recorded, verdict follows the last)

- ds_extracted/ds platform-test: attempt 1 FAIL (162.61s), attempt 2 FAIL (171.341s) — both recorded, verdict follows the last attempt
| repo | test | typecheck |
| --- | --- | --- |
| depreciation-ledger | PASS (1.1s) | PASS (1.9s) |
| bqp-map | PASS (2.1s) | PASS (2.5s) |
| route-price | PASS (1.3s) | PASS (2.1s) |
| readout-wall | PASS (1.7s) | PASS (2.3s) |
| burial-record | PASS (3.3s) | PASS (2.2s) |
| nosignal-tariff | PASS (1.5s) | PASS (2.2s) |
| binding-price | PASS (1.1s) | PASS (2.2s) |
| choice-lang | PASS (3.1s) | PASS (2.1s) |
| letter-audit | PASS (2.2s) | PASS (2.1s) |
| wukong-crossval | PASS (64.4s) | PASS (2.0s) |
| survivor-census | PASS (1.9s) | PASS (2.1s) |
| ent-clearing | PASS (1.6s) | PASS (2.4s) |
| postselect-sched | PASS (1.6s) | PASS (2.4s) |
| retro-cache | PASS (1.2s) | PASS (2.1s) |
| stable-world | PASS (7.8s) | PASS (2.5s) |
| qverify | PASS (2.4s) | PASS (2.6s) |
| qram-sched | PASS (10.5s) | PASS (2.5s) |
| nonstoq-anneal | PASS (45.7s) | PASS (2.9s) |
| quantum-mech | PASS (8.0s) | PASS (2.5s) |
| ent-sched | PASS (12.1s) | PASS (2.6s) |
| vacuum-compiler | PASS (1.3s) | PASS (2.3s) |
| dsic-noether | PASS (1.2s) | PASS (2.3s) |
| ft-qaoa | PASS (1.2s) | PASS (1.9s) |
| switch-sched | PASS (1.0s) | PASS (2.1s) |
| causal-ineq | PASS (1.1s) | PASS (1.8s) |
| k-switch | PASS (1.0s) | PASS (1.9s) |
| dtc-clock | PASS (381.7s) | PASS (2.8s) |
| phase-law | PASS (2.9s) | PASS (2.2s) |
| mutant-census | PASS (96.1s) | PASS (2.7s) |
| ds_extracted/ds | **FAIL (171.3s)** | — |

## Red cells

- ds_extracted/ds platform-test: …ernal/test_runner/test:1447:12) at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) { generatedMessage: true, code: 'ERR_ASSERTION', actual: '参考负载散布 1.63× 超限（1.5）——机器状态漂移，结果仅报告不判决', expected: /分辨率/, operator: 'match', diff: 'simple' } 