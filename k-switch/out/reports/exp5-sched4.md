# EXP5 — The 24-order scheduling contact surface (k = 4)

Input |+⟩⟨+|; distinguish "exec always erases" (γ=1) vs "never" (γ=0) through each of the 24 fixed orders and the 24-order uniform switch (control traced out).

| receiver | D |
| --- | --- |
| every fixed order (24 of 24) | 0.707106781187 = 1/√2 |
| **switch (24-order uniform)** | **0.527046276695** |
| switch closed form | √10/6 = 0.527046276695 |
| dilution D(switch)/D(fixed) | 0.745355992500 = √5/3 |

**The machine's verdict**: D(fixed) = 1/√2 SURVIVES — all 24 orders exactly (any prefix of the X/Z/Y writes keeps |+⟩ in the |±⟩ plane, and unitary stages after the erasure cannot change the trace distance). D(switch) = D(fixed)/√2 DOES **NOT** SURVIVE: the 24-order mixture lands at √10/6 = 0.527046, NOT 1/2 — the dilution factor is √5/3 = 0.745356, not 1/√2. The k=3 "halving law" (../switch-sched exp3, exp2 here) was that family's law at k = 2 and k = 3, not a universal: at k = 4 the mixture is slightly BETTER than halving but still strictly below EVERY definite order (Δ = D_sw − max D_fix = -0.180061 < 0). Verdict unchanged where it matters: order superposition does not beat ANY definite order on scheduling primitives.

Hand-checkable: with exactly one erasure stage E and unitary writes, γ=1 branches ending in E give |0⟩⟨0|; branches with writes after E give the write-image of |0⟩⟨0| — the 24-order average is (2/3)|0⟩⟨0| + (1/3)|1⟩⟨1| (16 of 24 branches end |0⟩), while every γ=0 branch is |−⟩⟨−| (the single Y flips |+⟩ to |−⟩ wherever it sits; X/Z only phase). T(diag(2/3,1/3), |−⟩⟨−|) = √((1/6)² + (1/2)²) = √10/6 — matches the machine.
