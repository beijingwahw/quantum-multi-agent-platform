# EXP3 — The 4-switch, executed: the parity law survives k = 4

**A. promise instances at d = 4**: commuting rotations commutator 0.00e+0 (=0); anticommuting Majoranas commutator modulus 2.000000000000 (=2). S₄ splits 12/12.

**B. isometry certificate**: M†M = I to <1e-12 for both instances (96-dim: control 24 x system 4).

**C. THE ANSWER: yes.** <u|u_sgn> = 0.00e+0 EXACTLY (12 even − 12 odd = 0). On the commuting instance the control ends in |u⟩ (fidelity 1.000000000000); on the anticommuting instance in the sign-character state |u_sgn⟩ (fidelity 1.000000000000). The k = 3 law is the k = 4 law: same bubble-sort argument, same dimension-free status (binary promise, not ARA14's d ≥ N! full problem — still not claimed).

**C'. the sign law is exact per order**: product over order π = sgn(π)·P_id for all 24 orders, max deviation 0.00e+0.

**D. the 24-order readout table**: every single-order projector |π⟩⟨π| reads out 1/24 on BOTH promise classes (max deviation 2.08e-17) — the order basis carries nothing; the even/odd parity PROJECTION alone also carries nothing (0.500000000000 / 0.500000000000 — diagonals are uniform in both classes); the deterministic discriminator is the CONTROL STATE: ⟨u|ρ|u⟩ = 1.000000000000 vs 0.000000000000, ⟨u_sgn|ρ|u_sgn⟩ = 0.000000000000 vs 1.000000000000.

| order (first 8 of 24) | P(control = π | commuting) | P(control = π | anticommuting) |
| --- | --- | --- |
| 0123 | 1/24 | 1/24 |
| 0132 | 1/24 | 1/24 |
| 0213 | 1/24 | 1/24 |
| 0231 | 1/24 | 1/24 |
| 0312 | 1/24 | 1/24 |
| 0321 | 1/24 | 1/24 |
| 1023 | 1/24 | 1/24 |
| 1032 | 1/24 | 1/24 |
(first 8 of 24 rows shown; all 24 identical at 1/24 exact.)

**E. the Pauli census (blindness at k = 4, machine-decided)**: over the C(15,4) = 1365 quadruples of non-identity two-qubit Paulis — **0 pairwise-commuting** (the maximal abelian Pauli subgroup at d = 4 has only 3 non-identity elements: the k = 3 canonical commuting-Pauli family CANNOT extend to k = 4 inside the Pauli universe — the commuting promise class is necessarily non-Pauli here, e.g. rotations of one generator), **30 anticommuting** (each satisfies the sgn law exactly, max deviation 0.00e+0), 1335 mixed. Matched blindness pairs INSIDE the Pauli universe: **0** — the k = 3 canonical pair (−I vs iI, both Pauli) has no k = 4 analogue there. Constructed OUTSIDE (commuting rotations of the anticommuting product's own Pauli Z⊗Y): products Z⊗Y vs Z⊗Y share a ray, and all 24 plain orders are blind between the two classes — max trace distance 2.98e-8.

**F. interleaved probe** (sampling, 8 seeds, honest label): random unitaries interleaved between the four uses, same W's both classes: max distinguishability 0.999773 — interleaving a single use of each box DOES distinguish these canonical instances, exactly as at k = 3 (exp1 E); the structural blindness claim is for plain consecutive orders. The general fixed-order lower bound stays ARA14's / Bavaresco et al. 2024's theorem, cited.

| quantity | value | anchor |
| --- | --- | --- |
| commuting control fidelity (k=4) | 1.000000000000 | 1 |
| anticommuting control fidelity (k=4) | 1.000000000000 | 1 |
| <u|u_sgn> (k=4) | 0.00e+0 | 0 |
| sign law deviation (24 orders) | 0.00e+0 | 0 |
| single-order readout (24 basis states) | 1/24 each | 1/24 |
| commuting Pauli quadruples (census) | 0 | 0 |
| anticommuting Pauli quadruples (census) | 30 | 30 |
| matched Pauli blindness pairs | 0 | 0 |
| matched constructed pair max T (24 orders) | 2.98e-8 | 0 |

Anchors: TCA+21 (PRX Quantum 2, 010320) ran the N = 4 switch with a d = 2 target — the all-orders parity law at d = 4 above is this repo's own bounded face; see docs/theory.md §1–2.
