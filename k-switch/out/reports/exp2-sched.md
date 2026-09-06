# EXP2 — Six-order scheduling contact surface

Input |+><+| (sensitive to both writes); distinguish "exec always erases" (γ=1) vs "never" (γ=0).

| order | D (fixed) |
| --- | --- |
| X,Z,E | 0.707106781187 |
| Z,X,E | 0.707106781187 |
| X,E,Z | 0.707106781187 |
| E,X,Z | 0.707106781187 |
| Z,E,X | 0.707106781187 |
| E,Z,X | 0.707106781187 |
| **switch (6-order uniform)** | **0.500000000000** |

**The law, as found (and hand-verified)**: ALL six fixed orders carry D = 1/√2 exactly — γ=1 outputs |0><0| while γ=0 outputs the unitary-rotated state, and T(|0>, X·Z|+> = |->) = sqrt(1-1/2) closed-form. The six-order switch lands at exactly 1/2 = D(fixed)/√2 — the mixture dilutes by the SAME factor 1/√2. Verdict unchanged from the two-box case (../switch-sched exp3): order superposition does not beat ANY definite order on scheduling primitives — the write must survive to the end to be read.
