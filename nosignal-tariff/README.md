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

## The gap-free certificate (v0.4.0)

T6 certified net strictly increasing across the grid family's adjacent pairs; between grid points the curve carried no certificate. The new face closes the gaps — on all of [0,1), not just the lattice:

**Theorem (machine half, exact).** Substituting d = 1−2q = p in the T5/T8 series turns the withdrawal curve into an all-positive-coefficient power series, net(p) = Σ_{k≥1} p²ᵏ/(4·ln2·k(2k−1)), so for every rational pair 0 ≤ p₁ < p₂ < 1 the increment obeys the exact algebraic bound **net(p₂) − net(p₁) ≥ (p₂² − p₁²)/(4·ln2) > 0** — the k = 1 term plus a nonnegative remainder, pure BigInt rational algebra, no grid, no minimum-gap caveat, no calculus. The margin is certified at any scale the rationals name: the trial certifies the pair (0, 10⁻¹²) with margin ≈ 3.61e-25, far below anything a grid could resolve. Machine numbers from the tests: min cell margin 0.000901684400555 over the 19 cells partitioning [0,1); the (19/20 → 1) anchor pair gap 0.084330465748335 (closed path, net(1) = 1/2 exact); the power path re-derives T6's grid gaps independently (min 0.000902060478594) with widest enclosure 5.0e-22, overlapping both existing paths at every grid point and at off-grid samples.

**Citation half (consistency, not proof).** T7's net′(p) = log₂((1−q)/q)/4 is evaluated per subinterval with the kernel's own negLn/LN2/iDivPos interval machinery: a subinterval queue with adaptive bisection (bisect on a nonpositive bound, convict at depth exhaustion) certifies net′ > 0 on the 19 seeded cells — at depth 0 on the true curve, the left-endpoint bound sufficing on (0,1] — and every derivative bound × cell width stays under the enclosures' upper bound on the increment (the data gate). GIVEN net′ nondecreasing (T7's convexity citation face) the halves agree; the theorem half stands on the series identity alone.

**Smuggling trials (four gap-free faces).** A forged table (anchor-clean −1/25 dip at p = 1/2) is named by `certifyStrictlyIncreasing` at the pair (9/20 → 10/20); an inflated margin (claiming 0.05 where the cross-path enclosures cap the increment at ≈ 0.00271) dies at the data gate; a hidden derivative dip in (0.47, 0.53) is run down by the bisection and convicted at depth 4 with the seed named; a coarse-but-honest bound is rescued by refinement (8 leaves, depth 3) — the machinery convicts liars and terminates on honesty. Degenerate inputs (p ≥ 1, reversed pairs, empty seed queues, cells outside (0,1]) refuse with named `GLOBAL_*` codes.

**Honest boundary.** The power-series leg is the series path re-indexed in p (the substitution d = p is exact algebra; the tests verify agreement with the closed path as data — it is not a third independent derivation). Report enrollment (out/reports) and the tariff row (T9) are deliberately left to a dedicated visit — this section ships the theorem, the machinery, and the trials; nothing existing was re-rendered.

## The Welch exclusion certificate (v0.5.0)

T8 enrolled the tetrahedral SIC axes as the fifth payer but left the family's closure unstated. The new face (the T10 face, `src/kernel/welch.ts`) closes it: **the constant-overlap 1/3 family is complete**.

**Theorem (machine, exact).** No five unit vectors in C² have pairwise overlaps |⟨φᵢ|φⱼ⟩|² = 1/3 — and, sharper, not even ONE ray extends the tetrahedron at constant 1/3. The instrument is the Welch bound at d = 2, executed rather than quoted. The proof's one polynomial identity — for every 2×2 Hermitian M, **2 Tr M² − (Tr M)² = (A−D)² + 4(X²+Y²)**, a sum of real squares — is certified as a polynomial identity by exact BigInt rational evaluation on the full grid {−2..2}⁴ (625 points; per-variable degree 2 < grid side 5, so vanishing on the whole grid forces the zero polynomial). A hypothetical five-ray frame operator would need 2·(35/3) − 25 = **−5/3 < 0** while the identity says ≥ 0 — contradiction, with the falsifiable margin 35/3 < 25/2 (cross-multiplied 70 < 75; margin 5/6). The tetrahedron itself is the positive control: four explicit kets over Q(i,√3), pairwise overlaps exactly 1/3, frame operator exactly 2I (the tight-frame identity Σ|ψᵢ⟩⟨ψᵢ| = (n/d)I), Welch total 8 = 16/2 on two paths (Gram sum vs frame-operator trace), and both SOS squares individually zero — a qubit SIC is a saturated Welch case, which is exactly why it cannot grow.

The direct route: since M = 2I is machine-verified, every vector ϕ obeys Σᵢ|⟨ϕ|ψᵢ⟩|² = ⟨ϕ|2I|ϕ⟩ = 2‖ϕ‖² — executed exactly on rational and Q(√3) test vectors (individual terms may be irrational; the sum is exactly 2). A claimed fifth ray would force 4·(1/3) = 4/3 ≠ 2.

**Smuggling trials.** The antipode ray (Bloch −r₁) presents overlaps {0, 2/3, 2/3, 2/3} — it satisfies the Bessel identity (as every vector must) and dies at the constant-overlap gate (`WELCH_NOT_EQUIANGULAR`): the certificate adjudicates equiangular claims only. A non-equiangular five-family (tetrahedron + antipode) is honestly NOT certifiable — its measured Welch total is 13 > 25/2, no contradiction to hide behind. The certificate's sharp edge is pinned: c = 3/8 at n = 5 sits exactly on the bound (margin 0, not excluded). Domain refusals by name (`WELCH_N_RANGE`, `WELCH_C_RANGE`, `WELCH_TETRA_INDEX`, `WELCH_IRRATIONAL`, `WELCH_S3_INVERSE`).

**Honest boundary.** The SOS engine is 2×2 — general-d Welch stays a citation (Welch-1974, lower bounds on the maximum cross correlation of signals, double-source pending; the tetrahedral SIC's provenance: Renes-Blume-Kohout-Scott-Grassl-2004, symmetric informationally complete measurements, double-source pending — no arXiv id, DOI, or volume quoted from memory). Nonnegative squares in an ordered field is the one axiom-level fact cited. Nothing existing was re-rendered; the T9 report enrollment stays with its dedicated visit.

## Honest boundary

The zeros are theorems (no-signaling holds for ANY state — including biased resources; the distinguishing property of the singlet is its maximally mixed marginal, and the tests say so explicitly). The withdrawal schedule prices reconciliation and settings exactly as retro-cache scoped it: **no adversary privacy amplification** — the Shor-Preskill-grade security statement is not claimed. h₂ endpoints q=0 (and q=1) are closed forms; the series path is honest only on the open grid.

The interior theorem's precise scope: monotonicity and grid convexity are machine theorems **within stated hypotheses** — exact rational interval arithmetic on the grid family p = i/20, with ln enclosed by series whose partial sums are exact rationals and whose tails carry closed-form bounds. The derivative formulas net'(p) = log₂((1−q)/q)/4 and net''(p) = 1/(8 ln2 · q(1−q)) are classical citations, verified pointwise as data, never presented as machine output. Classical anchors verified from two independent sources before adoption (Lean Mathlib's `Real.binEntropy_strictMonoOn`/`strictConcave_binEntropy` and the standard references); the 2023–2026 no-signaling-tightness literature was surveyed (indefinite-causal-order Tsirelson bounds, no-signaling computation constraints) and deliberately **not** adopted — nothing there is reproducible in-repo beyond the classical anchors. No new citations: the physics anchors to retro-cache's, readout-wall's, and quantum-mech's in-book verifications.

## Reproduce

```bash
npm ci
npm test        # 57/57 — checker, eight witnesses, correlator machinery, interior theorem, gap-free certificate, Welch exclusion certificate, smuggling trials, coded refusals, entry guard, witness determinism
npm run repro   # renders out/reports/the-nosignal-tariff.md (seconds)
```
