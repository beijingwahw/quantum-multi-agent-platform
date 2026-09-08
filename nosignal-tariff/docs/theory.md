# Theory — one tax, five payers, one checker

## The object

The no-signaling tax appears throughout this correspondence under different names: retro-cache's marginal tariff (the tax that makes the cache a correlator, not an oracle), readout-wall's blindness clause (the order bit never describes the payload), quantum-mech's HJW analysis (why binding cannot be bought). Each was verified in its home repo. This schedule puts the items on one page and runs them through one checker — v0.2.0 adds the withdrawal curve's interior theorem and the tetrahedral fifth payer to the same page.

## The correct object (a recurring lesson)

The no-signaling object is I(B; A's **setting**) = 0 — the receiver's marginal across the sender's *choices* — never a statement about outcomes (on the aligned axis the outcome mutual information is legitimately 1 bit; that IS the entanglement). This workspace has now hit this wrong-object trap three times (retro-cache's batch 20, readout-wall's order bit, and this repo's own first probe, which read joint elements instead of the control marginal — batch 24). The schedule exists partly so the object is written down once, correctly, at the top.

## Why the zeros are theorems, and what the resources add

Measurement on A cannot move B's marginal for *any* state — a biased product mixture also shows zero setting-leakage (the tests assert this explicitly). What distinguishes the correlator resources is what sits on top of the theorem: the singlet's marginal is exactly the maximally mixed state (nothing about the correlation leaks into either side alone), the order register's outcome is a fair coin, and Bob's HJW-averaged state is I/2 for every committed basis. The tax schedule prices the *use* of what survives: only the joint, off-block, or conditional structure — and every withdrawal line (T4) charges for exactly that.

## The withdrawal schedule

Per raw pair: alignment succeeds with probability ½ (double-basis sifting), yielding one correlated bit; the settings announcement costs 1 classical bit per raw pair (a cost line, not a key deduction); reconciliation leaks h₂(QBER) per sifted bit with QBER = (1−p)/2. Net key rate per raw pair: **(1 − h₂((1−p)/2))/2** — zero at p=0 (the seed floor: at zero visibility the cache is distributionally indistinguishable from shared randomness, retro-cache's W3), ½ at p=1. The interior VALUES ship as data (T4); the interior's monotonicity and convexity are v0.2.0's theorem rows (T6/T7).

## The interior theorem (v0.2.0)

v0.1.0's boundary read "monotone on grid only" — an honest description of sorted floats. The upgrade executes the theorem half: **net is strictly increasing on the grid family p = i/20, certified by exact rational interval arithmetic** (src/kernel/rational.ts, theorem.ts). Method: every h₂ enclosure comes from ln reduced to a mantissa series −ln(m) = Σ tᵏ/k (t = 1−m ≤ ½, partial sums exact rationals, tail ≤ t^{K+1}/((K+1)m)) plus an integer power of the ln2 enclosure (itself a rational series with a closed-form tail); the two h₂ paths (closed form and the Taylor series around the maximum with geometric tail d²^{K+1}/((K+1)(2K+1)(1−d²))) each yield a net enclosure; the certificate is upper(net(pᵢ)) < lower(net(pᵢ₊₁)) as an exact BigInt comparison, on both paths independently, with the paths' enclosures overlapping at every interior point. No float enters any certificate; no calculus is assumed anywhere in the theorem half.

The honest split, stated on every artifact: the closed-form derivative net'(p) = log₂((1−q)/q)/4 and second derivative net''(p) = 1/(8 ln2·q(1−q)) are **citations** (classical differentiation of −q ln q). The machine verifies them pointwise as **data** — sampled interval difference quotients (strictly positive with no Mean Value Theorem invoked) against formula intervals — and their positivity reduces to q < 1/2, pure rational algebra. What is theorem and what is citation is never blended.

Convexity face: every grid second difference is certified positive as exact data (min lower bound 0.001808652 over p = i/20) — the inflection map is empty. The citation candidate net'' > 0 on (0,1) predicts no interior inflection, and the pointwise data agrees; strictly convex throughout, so no inflection exists to hide.

An implementation lesson caught in the act: the first ln2 tail bound was 2× too small (t^{K+1}/(K+1) instead of (1/2)^K/(K+1)) — the error was ~9e−22 against enclosure widths of ~1e−21, and the CROSS-PATH OVERLAP CHECK caught it on the first full run. That is why the overlap gate exists: two honest enclosures of one number must intersect, and when they did not, the kernel — not the claim — was wrong.

## The fifth payer (the tetrahedral census)

The 24-axis census extends one symmetric family. The natural "beyond Pauli" candidate, mutually-unbiased bases, terminates for a qubit: the complete MUB set is exactly {X, Y, Z} (d+1 = 3) — there are no further MUB axes to add, and pretending otherwise would be marketing. The honest family is the tetrahedral SIC: four axes with pairwise nᵢ·nⱼ = −1/3 (|⟨ψᵢ|ψⱼ⟩|² = 1/3), the symmetric-informationally-complete structure of a qubit. The census verdict: A's choice among them cannot move B's marginal — same rounding floor (≤ 2.2e-16) as the 24-axis census, plain and under local unitaries and Stinespring CPTP.

## Two-path arithmetic

Every quoted rate is computed twice: the closed-form binary entropy and its Taylor series around the maximum, 1 − Σ_{k≥1} d²ᵏ/(2 ln 2 · k(2k−1)) with d = 1−2q. The series converges geometrically in d² — machine precision at 400 terms for q ∈ [0.05, 0.45] — but only as 1/(2N) at d=1, so the endpoints are closed forms and the series path is quoted only where it is honest. (The first draft of this series had the prefactor 4× too large and the power off by one — batch 24; the two-path discipline exists precisely to catch that class.)

## Citations

**None new.** GRW80/CHSH69/TSIR80/SHAN48 remain anchored in retro-cache's verified bibliography; the HJW structure in quantum-mech's; the order-register blindness in readout-wall's. The appeal court for every row is the witness in this repo's `npm test`.

Literature sweep before v0.2.0 (adopted: nothing; verified anchors: classical). The classical facts the interior theorem leans on — h₂ strictly increasing on [0, ½], strictly decreasing on [½, 1], strictly concave — were verified from two independent sources (Lean Mathlib's formalization `Real.binEntropy_strictMonoOn` / `Real.strictConcave_binEntropy`, and the standard textbook/encyclopedic references) before being cited. The 2023–2026 literature on no-signaling bounds tightness (indefinite-causal-order Tsirelson bounds, quantum-switch causal-inequality impossibility, no-signaling computation constraints) and on key-rate curves was surveyed; none of it is reproducible in this repo's zero-dependency scope beyond the classical anchors, so none was adopted — the boundary above stays honest.
