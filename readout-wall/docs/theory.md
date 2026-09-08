# Theory — the readout wall as an exchange-rate ledger

## The object

The quantum switch's advantage lives in the coherence of the order register (the control). switch-sched certified the ESC18 gain (χ = 0.048794940695399 bits for two completely depolarizing boxes, joint receiver) and quoted the measurement wall in passing; every repo since cites "readout collapses the order" as a cost-column clause. This repo executes the clause: **what exactly does reading the order buy, and what exactly does it cost.**

## The collapse identity

Reading the order register in its own basis, outcome forgotten, is the dephasing map Δ on the control. After Δ the joint output is block-diagonal with the fixed-order channels as blocks, weighted by the control's diagonal:

  Δ[ M (ρ_c ⊗ ρ) M† ] = Σ_c |c⟩⟨c| ⊗ p_c · ℳ_c(ρ),   p_c = (ρ_c)_cc.

The witness builds the right side **from the fixed-order channels themselves** (never by dephasing the switched output) — a genuine second path — and the identity holds to 1e-15 across the showcase pairs, biased controls, and random CPTP pairs. The interpretation is the wall's algebraic face: the read-out switch is exactly the classical mixture of the orders you could have chosen without a switch. Reading does not disturb the advantage *a little*; it deletes precisely the terms the advantage was made of.

## The ESC18 exchange and the blind bit

For the two-depolarizing pair, the input information survives **only** in the off-block terms (switch-sched's T2: control and target marginals exactly zero). Hence the sharp exchange: χ 0.048794940695399 → 0 under readout, while the readout outcome is input-blind (P = 1/2 to 1e-15 for every input, showcase and random pairs alike). The bit you buy is about the branch, never about the payload — the wall's no-signaling clause, in the same register as retro-cache's marginal tariffs.

## Complementarity, not prohibition

The replacer pair parks its information on the control register itself — at x-coherence (T = 1/2 between |+⟩⟨+| and I/2, χ_control = H₂(1/4) − 1/2). Reading the order basis (z) projects both to the same diagonal: T_after = 0 exactly. Order-knowledge (z) and order-advantage (x-coherence) are complementary observables of one register: you can have either, priced in the other. This is why the atlas verdict stays **HW-WAIT** rather than hardening to a wall against the switch itself — the wall prices the *reading*, and no hardware repeals complementarity; symmetrically, no hardware is needed to keep paying.

## The weak readout — v0.2.0's interior theorem

Partial dephasing of strength λ interpolates χ(λ) between the coherent value and 0. v0.1.0 shipped the interior as data with no theorem claimed. The honest reason was structural, not laziness: the fixed-ensemble Holevo is concave in the output states, the capacity is a supremum over ensembles, and neither fact decides monotonicity or convexity of χ(λ) itself. v0.2.0 settles it on the stated family by computation:

- **The family (stated precisely):** two completely depolarizing qubit boxes, control |+⟩, binary computational-basis ensemble, joint receiver. Under λ-partial dephasing every eigenvalue of the two output states is an affine dyadic function of λ — member spectrum {(3−λ)/8, (1+λ)/8, 1/4, 1/4}, average spectrum {(5−λ)/16 ×2, (3+λ)/16 ×2} — because dephasing scales exactly the off-blocks, and for this pair the off-block structure collapses to one entry (1−λ)/8. Hence the closed form

  χ(λ) = 2f((5−λ)/16) + 2f((3+λ)/16) − f((3−λ)/8) − f((1+λ)/8) − 2f(1/4),  f(q) = −q log₂ q.

- **The verification:** the simulation re-derives the closed form at every grid point λ = i/20 (agreement ≤ 1e-12, quoted as data) — the formula is never trusted on derivation alone.
- **The certificates (exact):** on that grid, χ is **strictly decreasing** (min gap ≈ 1.1e-4) and **strictly convex** (min second difference ≈ 2.3e-4), by exact rational interval arithmetic — BigInt fractions, ln enclosed by partial sums with rigorous tails on **two independent series** (the t-series Σtᵏ/k and the atanh-series 2Σw²ᵏ⁺¹/(2k+1), w = (1−m)/(1+m)), cross-checked for enclosure overlap at every point. No float enters any certificate; interval widths ≤ 1e-20.
- **The citation face (data, not certificate):** the classical-analysis candidate χ″(λ) = [1/(3−λ)+1/(1+λ)−1/(5−λ)−1/(3+λ)]/(8 ln 2) agrees with the sampled interval second-difference quotients to ~2.6e-6 at every interior grid point — quoted as agreement only.

The same discipline covers two more families, each with its own closed form, grid, and certificates: the **replacer control** family (member spectra {λ/2, 1−λ/2} and {1/2, 1/2}, average {(3−λ)/4, (1+λ)/4} — E3's register under the weak readout) and the **k=3 six-order** family (member spectrum {n/48 : n ∈ 1,2,2,2,2,4,4,4,4,5,7,11}, average {1/16 ×10, 3/16 ×2}, every eigenvalue affine in the coherence c = 1−λ). Both certify strictly decreasing and strictly convex on the same grid. **What is NOT claimed:** anything off the grid, for other channel pairs, or as a general theorem about Holevo quantities — the certificates are exactly as wide as the families they name.

## The exchange-rate frontier — E6

The tradeoff curve between order-information gain and capacity loss, machine-mapped as exact data. The GET column is derived, not decorated: the λ-readout modeled as the read-and-remember instrument (with probability λ, projectively read the order register and keep the record; otherwise do nothing) leaves exactly the weak-readout state, and the record satisfies I(record; order-bit) = λ bits (when read, the record equals any subsequent verification readout; when not, the verification is a fair coin). The PAY column is χ(0) − χ(λ) on each family. Three exact statements, all bounded to the census (the 21 measured grid points, never a global claim):

1. **Pareto certificate:** no census point dominates another (an antichain: you cannot find a measured point that gets ≥ order-knowledge for ≤ capacity loss) — checked pairwise in exact rational interval comparisons.
2. **First-touch dominance:** the marginal price of order knowledge is strictly decreasing — every next 1/20 of an order-bit costs strictly less capacity than the last. The first slice costs 0.005123 bits of joint χ (ESC18) / 0.065113 bits of control χ (replacer). The wall is steepest at first touch: a weak readout does the most damage per bit learned.
3. **Cross-family honesty:** the two PAY columns price different registers (joint-state χ vs control-register χ); no cross-family domination claim is made, and the ~7–13× ratio between the families' rates is quoted as data only.

## The k=3 face

Three channels over the six permutations of S₃, uniform 6-dimensional control, same fixed-slot discipline. The depolarizing triple's coherent χ (0.098069743463625, machine-measured, no paper claim) doubles the pair's figure and dies to 0 under readout; the six-order mixture identity holds to 1e-15, **including complex random CPTP triples** — that clause exists because the branch builder tracks complex amplitudes end to end, and a real-only accumulator would pass every depolarizing check while corrupting every complex branch (the anchor-blindspot class, closed by construction and by witness). v0.2.0 adds the k=3 weak-readout law: the closed form above (dyadic spectra, affine in the coherence) verified against the simulation at every grid point and certified monotone and convex exactly like the pair families.

## What χ means here

Binary-ensemble Holevo information at the operating points switch-sched certified — accessible-information lower bounds, not optimal capacities. The ESC18 capacity optimisation stays cited in switch-sched; this repo never quotes a capacity it did not measure.

## Citations

Physics anchors, verified in-book: switch-sched's verification of the switch construction (ESC18, machine-verified there) and k-switch's six-order superposition results. The v0.2.0 literature anchors (each identifier verified from two independent sources at delivery time):

- **arXiv:2510.08507** — Zhao, Zhao, Branciard, Chiribella, *The quantum communication power of indefinite causal order* (2025). The ICO communication-advantage line's current frontier: advantages in one-shot scenarios, limits under many uses. Anchor for why the χ register is the right currency; no methods adopted (our quantities are derived in-repo).
- **Phys. Rev. A 109, 062435 / arXiv:2312.12172** — Mothe, Branciard, Abbott, *Reassessing the advantage of indefinite causal orders for quantum metrology* (2024). The critical-reassessment line: claimed ICO advantages that live or die with the control's coherence. Anchor for the wall's framing (advantages priced by the readout); no methods adopted.

The appeal court for every row is the witness in this repo's `npm test`.
