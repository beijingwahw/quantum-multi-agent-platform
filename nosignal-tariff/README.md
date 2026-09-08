# nosignal-tariff

**The no-signaling tariff, itemized on one page.**

The letter's clause — "no-signaling 关税逐条记着" — was priced inside retro-cache at three operating points (0.5 / 0.094 / 0). This repo completes the itemization, because the tax has since accrued more payers than the cache:

- **T1 — the cache (singlet correlations).** B's marginal must not depend on A's axis — the object is the **setting**, never the outcome (batch 20's law, third recurrence in this workspace). TV ≤ 2.3e-16 over a 24-axis grid, plain / under random local unitaries / under Stinespring CPTP on B's side.
- **T2 — the order register (the switched pair).** The order bit the readout buys is input-blind: P(control | payload) constant to 1.7e-16 across depol / replacer / random CPTP pairs. A fair coin about the branch, never about the cargo.
- **T3 — the HJW ensembles (binding's root).** Bob's ensemble-averaged state is the same I/2 for every basis Alice commits to (pairwise TV = 0 across Z/X/Y) — the commitment is not readable before the reveal, while the conditional members differ (the correlations are real).
- **T4 — the withdrawal schedule.** The cache's key-extraction tariff as a full curve: gross ½ bit/sifted aligned pair; settings 1 bit/raw pair; reconciliation h₂(QBER); QBER = (1−p)/2; **net(p) = (1 − h₂((1−p)/2))/2** — anchors exact (0 at the seed floor p=0, 0.094360938 at p=0.5, 0.5 at p=1); interior values shipped as data, with the interior's monotonicity and convexity carrying their own priced rows.
- **T5 — the schedule's own arithmetic.** h₂ by closed form **and** by the Taylor series around the maximum (1 − Σ d²ᵏ/(2 ln2 · k(2k−1))): two independent paths agreeing to 1e-12 on the open grid q ∈ [0.05, 0.45]; endpoints by closed form — the series is quoted only where it converges at machine precision.
- **T6 — the interior theorem (v0.2.0).** net(p) strictly increasing on the rational grid family p = i/20, **as an exact machine certificate**: upper(net(pᵢ)) < lower(net(pᵢ₊₁)) for every adjacent pair in exact BigInt rational interval arithmetic, h₂ enclosed on both independent paths (closed form and series, each with a rigorous tail bound — ln itself lives behind rational series), the two paths' enclosures overlapping at every interior point. Min gap 0.000902060478 (pair 0→1); widest enclosure 9e-22 — nineteen orders below the margin. No calculus assumed on the theorem half.
- **T7 — the convexity face (v0.2.0).** No interior inflection: every grid second difference certified positive as exact data (min lower bound 0.001808652). The analytic candidate net''(p) = 1/(8 ln2 · q(1−q)) > 0 is **named as a citation** (classical differentiation) and verified pointwise as data — sampled interval difference quotients strictly positive with no calculus assumed; formula agreement ≤ 2.5e-3 (first) and ≤ 0.049 (second) at h = 1/100. Theorem vs citation stated, never blended.
- **T8 — the fifth payer (v0.2.0).** The 24-axis census extended one symmetric family: the tetrahedral SIC axes (pairwise |⟨ψᵢ|ψⱼ⟩|² = 1/3 — the beyond-Pauli family; a qubit's complete MUB set is exactly {X,Y,Z}, so this is the honest choice). A's choice among them still cannot move B: TV ≤ 2.2e-16 plain / local unitary / Stinespring CPTP — the rounding floor unchanged.

## The customs laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| N1 | every item carries a price — an item without a price does not ship |
| N2 | a zero or EXACT claim must cite an existing witness — **an unwitnessed zero is marketing** |
| N3 | anchor repos exist on disk (retro-cache, readout-wall, quantum-mech, switch-sched) |
| N4 | exactness tag is EXACT or DATA |
| N5 | ids unique |

The renderer refuses to print an illegal schedule; the tests include eight smuggling trials (unpriced item, marketing zero, dead anchor, illegal tag, duplicate id — v0.1.0's five; plus v0.2.0's counterfeit monotonicity certificate on an anchor-preserving non-monotone perturbation, a fake inflection table that passes the monotonicity gate but is named by the convexity gate, and a counterfeit "twin path" shifted 1e-18 — beyond float sight, not exact sight), each named and rejected. Since v0.3.0 every kernel refusal carries a named error code (`RefusalError`, message text frozen), the seeded RNG stream is anchored bit-for-bit against frozen constants, and the source carries no unwitnessed dead exports — the core imports only what a witness or the renderer consumes.

## Honest boundary

The zeros are theorems (no-signaling holds for ANY state — including biased resources; the distinguishing property of the singlet is its maximally mixed marginal, and the tests say so explicitly). The withdrawal schedule prices reconciliation and settings exactly as retro-cache scoped it: **no adversary privacy amplification** — the Shor-Preskill-grade security statement is not claimed. h₂ endpoints q=0 (and q=1) are closed forms; the series path is honest only on the open grid.

The interior theorem's precise scope: monotonicity and grid convexity are machine theorems **within stated hypotheses** — exact rational interval arithmetic on the grid family p = i/20, with ln enclosed by series whose partial sums are exact rationals and whose tails carry closed-form bounds. The derivative formulas net'(p) = log₂((1−q)/q)/4 and net''(p) = 1/(8 ln2 · q(1−q)) are classical citations, verified pointwise as data, never presented as machine output. Classical anchors verified from two independent sources before adoption (Lean Mathlib's `Real.binEntropy_strictMonoOn`/`strictConcave_binEntropy` and the standard references); the 2023–2026 no-signaling-tightness literature was surveyed (indefinite-causal-order Tsirelson bounds, no-signaling computation constraints) and deliberately **not** adopted — nothing there is reproducible in-repo beyond the classical anchors. No new citations: the physics anchors to retro-cache's, readout-wall's, and quantum-mech's in-book verifications.

## Reproduce

```bash
npm ci
npm test        # 27/27 — checker, eight witnesses, correlator machinery, interior theorem, smuggling trials, coded refusals, entry guard
npm run repro   # renders out/reports/the-nosignal-tariff.md (seconds)
```
