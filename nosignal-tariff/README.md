# nosignal-tariff

**The no-signaling tariff, itemized on one page.**

The letter's clause — "no-signaling 关税逐条记着" — was priced inside retro-cache at three operating points (0.5 / 0.094 / 0). This repo completes the itemization, because the tax has since accrued more payers than the cache:

- **T1 — the cache (singlet correlations).** B's marginal must not depend on A's axis — the object is the **setting**, never the outcome (batch 20's law, third recurrence in this workspace). TV ≤ 2.3e-16 over a 24-axis grid, plain / under random local unitaries / under Stinespring CPTP on B's side.
- **T2 — the order register (the switched pair).** The order bit the readout buys is input-blind: P(control | payload) constant to 1.7e-16 across depol / replacer / random CPTP pairs. A fair coin about the branch, never about the cargo.
- **T3 — the HJW ensembles (binding's root).** Bob's ensemble-averaged state is the same I/2 for every basis Alice commits to (pairwise TV = 0 across Z/X/Y) — the commitment is not readable before the reveal, while the conditional members differ (the correlations are real).
- **T4 — the withdrawal schedule.** The cache's key-extraction tariff as a full curve: gross ½ bit/sifted aligned pair; settings 1 bit/raw pair; reconciliation h₂(QBER); QBER = (1−p)/2; **net(p) = (1 − h₂((1−p)/2))/2** — anchors exact (0 at the seed floor p=0, 0.094360938 at p=0.5, 0.5 at p=1), interior shipped as data, strictly monotone on the grid.
- **T5 — the schedule's own arithmetic.** h₂ by closed form **and** by the Taylor series around the maximum (1 − Σ d²ᵏ/(2 ln2 · k(2k−1))): two independent paths agreeing to 1e-12 on the open grid q ∈ [0.05, 0.45]; endpoints by closed form — the series is quoted only where it converges at machine precision.

## The customs laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| N1 | every item carries a price — an item without a price does not ship |
| N2 | a zero or EXACT claim must cite an existing witness — **an unwitnessed zero is marketing** |
| N3 | anchor repos exist on disk (retro-cache, readout-wall, quantum-mech, switch-sched) |
| N4 | exactness tag is EXACT or DATA |
| N5 | ids unique |

The renderer refuses to print an illegal schedule; the tests include five smuggling trials (unpriced item, marketing zero, dead anchor, illegal tag, duplicate id), each named and rejected by law.

## Honest boundary

The zeros are theorems (no-signaling holds for ANY state — including biased resources; the distinguishing property of the singlet is its maximally mixed marginal, and the tests say so explicitly). The withdrawal schedule prices reconciliation and settings exactly as retro-cache scoped it: **no adversary privacy amplification** — the Shor-Preskill-grade security statement is not claimed. h₂ endpoints q=0 (and q=1) are closed forms; the series path is honest only on the open grid. No new citations: the physics anchors to retro-cache's, readout-wall's, and quantum-mech's in-book verifications.

## Reproduce

```bash
npm ci
npm test        # 11/11 — checker, five witnesses, correlator machinery, smuggling trials, entry guard
npm run repro   # renders out/reports/the-nosignal-tariff.md (seconds)
```
