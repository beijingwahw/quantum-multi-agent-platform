# EXP4 — The TCA+21 Hadamard promise at d = 2, executed (k = 4, P = 4)

Order quartet Σ = {ABCD, BADC, CBDA, DACB} (their experiment), Sylvester H₄; target = ONE QUBIT.

**A. the census** (machine analogue of their Table 2 — our domain is ALL 256 ordered {I,X,Y,Z}⁴ sets, no quotient): **136 sets satisfy the promise** for some column — per column y = 0..3: 52 / 36 / 24 / 24; 120 fail. Sample sets: y=0: IIII, IIIX, IIIY; y=1: IXYI, IXZI, IYXI; y=2: IXYX, IXZX, IYXY; y=3: IIXY, IIXZ, IIYX. TCA+21's Table 2 lists 30 Pauli-only sets under their own filtering — we do NOT reproduce that table's convention (their reduction is not fully specified in the paper text we fetched); our census is scoped to our domain and every number below is from it.

**B. Algorithm 1 executed on every promising set**: control |0⟩ → H₄ → quartet switch → H₄⁻¹ → measure. Outcome = the promise column y with probability 1 EXACTLY (worst deviation 0.00e+0, worst wrong-outcome leakage 0.00e+0), one use of each gate, d = 2 target — the machine echo of TCA+21's theorem for this bounded instance.

**C. the fixed-order query bound, machine-decided**: the shortest string over {A,B,C,D} containing all four quartet orders as subsequences has length **9** (104 minimal witnesses; machine's first: DABCBADCA; TCA+21's ACBADACDB verified by our kernel: true). So a fixed-order circuit that applies each promise instance's gates as a supersequence needs **9 gate uses** to the switch's 4 — the bounded, strategy-specific face of ARA14's quadratic separation. The GENERAL lower bound over all fixed-order simulations stays cited (ARA14; Bavaresco et al. 2024/2025 prove the switch cannot be simulated by any circuit with k = o(2ⁿ/√n) channel uses) — NOT re-proven here.

**D. the exact distinguishability matrix (which orders, which measurements)**: for every order π ∈ S₄ and every column pair (y,y'): does the PLAIN fixed order π distinguish the promise columns on the worst-case set pair? Entry = 1 iff every (set, set') pair has non-proportional products through π (then max-input trace distance = 1, exact — Pauli products are same-ray or orthogonal-ray). **Machine answer: ALL 144 ENTRIES ARE 0.** No plain fixed order separates ANY column pair in the worst case: for every π and every pair, matched sets exist whose products through π share a ray (e.g. single-gate sets pin every order's product to the same Pauli). The switch readout (Algorithm 1) separates ALL pairs deterministically — the contrast, in exact numbers.

| order π \ pair | (0,1) | (0,2) | (0,3) | (1,2) | (1,3) | (2,3) |
| --- | --- | --- | --- | --- | --- | --- |
| #0 0123 | 0 | 0 | 0 | 0 | 0 | 0 |
| #1 0132 | 0 | 0 | 0 | 0 | 0 | 0 |
| #2 0213 | 0 | 0 | 0 | 0 | 0 | 0 |
| #3 0231 | 0 | 0 | 0 | 0 | 0 | 0 |
| #4 0312 | 0 | 0 | 0 | 0 | 0 | 0 |
| #5 0321 | 0 | 0 | 0 | 0 | 0 | 0 |
(first 6 of 24 rows; all rows are zero — and the minimum average-case separation fraction over all 144 cells is 0.820513, i.e. matched same-ray pairs are everywhere).

| quantity | value | anchor |
| --- | --- | --- |
| promise-satisfying sets (of 256) | 136 | 52+36+24+24 |
| Algorithm 1 worst success deviation | 0.00e+0 | 0 |
| Algorithm 1 worst leakage | 0.00e+0 | 0 |
| supersequence minimum length | 9 | 9 (TCA+21 App.) |
| minimal supersequence witnesses | 104 | machine count |
| game-matrix nonzero entries (of 144) | 0 | 0 |

Honest scope: the Hadamard promise face is P = 4 orders at d = 2 — a WEAKER promise family than ARA14's all-order phase identification (d ≥ N!), which remains unclaimed; the 9-query bound is the supersequence simulation strategy's cost for this quartet, not the general fixed-order lower bound.
