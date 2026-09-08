# THE PRE-FLIGHT CARD — the genealogy, forward-facing

> DELIVERY PROTOCOL, STEP 0: `npm run preflight -- <repo>` before building in a repo — the rules below are the mistakes that repo already made. Coverage is law (G5): every family sighted in the last ten batches is on its repo's card; this run prints ONE repo, hot families (sighted within the last three batches) first.


## letter-audit

| family | sightings | latest | held by | the rule (the latest correction) |
| --- | --- | --- | --- | --- |
| cat:dimension-slot | 1 | b27#2 (b27) | GATE-ENFORCED | an off-by-one in index arithmetic, caught in self-review — substitute concrete numbers into index formulas the same way |
| cat:process | 1 | b27#0 (b27) | BOOKED-UNENFORCEABLE | the third draft defined the clean self-encoding (4(n+1) options per entry) on paper first — encodings are designed before they are typed |
| cat:statistics | 1 | b27#1 (b27) | GATE-ENFORCED | precedence: that is 4*((n+1)^(2n)) = 324, not (4(n+1))^(2n) = 20736 — the enumeration ran on a truncated universe and returned BB=3 against the expected 6. Hand-evaluate formulas on a concrete case before they enter code |

Reports freshness (the repro-no-op face, v0.22.0): 1 reports on disk; newest render 2026-09-08T09:25:21.217Z; src tree newest 2026-09-08T09:23:30.175Z — FRESH (the newest render postdates every source)