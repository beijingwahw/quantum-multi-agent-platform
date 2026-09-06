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

## The weak readout

Partial dephasing of strength λ interpolates χ(λ) between the coherent value and 0. The endpoints are exact; the interior is shipped as data with **no convexity or concavity theorem claimed** — the fixed-ensemble Holevo is concave in the output states, the capacity is a supremum over ensembles, and the honest object here (binary-ensemble χ at the ESC18 operating point) has no theorem we are willing to assert without a proof we do not have.

## The k=3 face

Three channels over the six permutations of S₃, uniform 6-dimensional control, same fixed-slot discipline. The depolarizing triple's coherent χ (0.098069743463625, machine-measured, no paper claim) doubles the pair's figure and dies to 0 under readout; the six-order mixture identity holds to 1e-15, **including complex random CPTP triples** — that clause exists because the branch builder tracks complex amplitudes end to end, and a real-only accumulator would pass every depolarizing check while corrupting every complex branch (the anchor-blindspot class, closed by construction and by witness).

## What χ means here

Binary-ensemble Holevo information at the operating points switch-sched certified — accessible-information lower bounds, not optimal capacities. The ESC18 capacity optimisation stays cited in switch-sched; this repo never quotes a capacity it did not measure.

## Citations

**None new.** The physics anchors to switch-sched's in-book verification of the switch construction (ESC18, machine-verified there) and k-switch's six-order superposition results. The appeal court for every row is the witness in this repo's `npm test`.
