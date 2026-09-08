# THE PRE-FLIGHT CARD — the genealogy, forward-facing

> DELIVERY PROTOCOL, STEP 0: `npm run preflight -- <repo>` before building in a repo — the rules below are the mistakes that repo already made. Coverage is law (G5): every family sighted in the last ten batches is on its repo's card; this run prints ONE repo, hot families (sighted within the last three batches) first.


## survivor-census

| family | sightings | latest | held by | the rule (the latest correction) |
| --- | --- | --- | --- | --- |
| cat:bogus-comparison | 1 | b29#4 (b29) | GATE-ENFORCED | the true denominator is totalC (60), not N (16) — '2/16 (0.1167)' is a fraction that lies about its own decimal. KillRow now carries count/totalC and the register prints the real integer ratio |
| cat:conjugation | 1 | b29#0 (b29) | GATE-ENFORCED | conj(A)B has Im = aRe*bIm - aIm*bRe — the test referee convicted it at deviation 1.176 = 2 sin(pi/5), exactly twice the imaginary part. Conjugation-side sign error, THIRD recurrence (batch 10 expPauli, batch 28 applyCost): write the conjugate expansion before typing the loop |
| cat:process | 1 | b29#5 (b29) | BOOKED-UNENFORCEABLE | tsc named all three before any test ran — drafts do not reach the machine dirty, and every draft's errors book |
| cat:statistics | 1 | b29#1 (b29) | GATE-ENFORCED | float drift 4.4e-5, far past the tolerance — the second path became the closed-form partial sum (1-(K+1)q^K+Kq^{K+1})/p with analytic tail < 1e-12 of the mean, and the loop referee stays only at moderate P where K is small. A second path must be independent AND numerically stable, not the same sum in another accent |
| cat:toolchain | 1 | b29#3 (b29) | BOOKED-UNENFORCEABLE | test/ sits TWO levels below the workspace — G3 misreported every live anchor as dead (postselect-sched, retro-cache all 'not on disk'). The climb depth belongs to the file's own position; count your own directories before copying a neighbor's relative root |
| cat:wrong-object | 1 | b29#2 (b29) | GATE-ENFORCED | the normalized weight sum is 1+2.2e-16 — degenerate assertions over float sums take tolerances; the same eps pushed waitingPrice's domain check to throw on p=1+eps |

Reports freshness (the repro-no-op face, v0.22.0): 1 reports on disk; newest render 2026-09-08T14:11:41.251Z; src tree newest 2026-09-08T02:42:46.214Z — FRESH (the newest render postdates every source)