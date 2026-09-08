# Theory — a language whose primitive is choice

## The object

The atlas row asked: *define a computation model whose semantics make "the world I want" a stable solution — then ask what conservation law, if any, guards the stability.* This repo supplies the model: `choose` nodes, controlled-unitary semantics, a marked world W. Twelve facts survive machine audit (see the model ledger); the physics question stays open and is not claimed.

## Register discipline

Each choose step prepares a fresh control and routes data through its branch unitary, coherently. Each step PREPENDS its control, so the register reads newest-first — (c_k, ..., c_1, data) — and every step operator is a pure Kronecker expression (no per-step reshuffling exists). Conditioning patterns are named in register order; `registerPattern` reverses a step-order pattern per program part. The dimension account is unforgiving: k controls on d-dimensional data means a 2^k·d joint state — program length is bounded by memory, not by mathematics (the first probe hung at k=20 for exactly this reason; batch 25).

## Why the diagonal is the invariant

A single choose preserves the control's **diagonal** (outcome probabilities cos²θ / sin²θ) exactly — but NOT its cross-term, which is scaled by Tr[U0 ρ U1†]. That scaling is not a bug; it is how a control register can carry information at all (the replacer pair's mechanism in switch-sched/readout-wall). The tests assert the diagonal; the language's information economy lives in the cross-term's fate. The same untouchable diagonal is why composition weights form a product measure (S1) and why the toll is branch-blind even adversarially (G-TOLL): populations are fixed at preparation and no later branch can move them.

## Stability and its charge

Engineered programs are block-diagonal in W ⊕ W⊥, so W is an invariant subspace: membership fidelity 1 over any length (R2), and — the stronger statement — the membership expectation is conserved for **every** input, not just residents of W (R6). That is the conserved-charge face of invariance: ⟨Π_W⟩ is a constant of the engineered motion. Random programs violate both. The implication shape (invariance ⟹ conserved charge ⟹ stationarity) is the same one dsic-noether machine-verified at the mechanism-design layer; we note the echo and claim nothing new.

## Composition: choosing after and inside choosing (v0.2.0)

Sequential composition P ++ Q is a homomorphism (R7): weights are a product measure state-independent to 7e-18, conditioning chains to the floor (condition P, run-and-condition Q on the conditional — you get the composed conditioning), and the denotation products associate across parenthesizations at the rounding floor (floating point is not associative; the law is). Nested composition compiles a TERM tree — leaf(u) | node(θ, t0, t1) — to ONE isometry V with dead slots (|0…0⟩, never acted on) padding unreached subtrees, exactly the default-evolution move of Barsse-Péchoux-Perdrix: V†V = I to 4.4e-16. Every live path conditions to its leaf's unitary weighted by the path's branch-weight product (context-freedom, N1), and the embedded/standalone weight ratio is the same context factor on every path under a context. But the two nestings choose(choose(A,B),C) and choose(A,choose(B,C)) — which a purely denotational reading would identify — PRICE their common leaves differently (N2: a 0.464624 gap, exactly cos²θ₁sin²θ₂): associativity lives in the denotation, never in the syntax. The charge is conserved under both composition forms when every branch is engineered (Q-COMP), and the certification toll multiplies: E[attempts] = 1/(P·Q) = (1/P)(1/Q) (T-MULT) — the epoch-3 identity promoted to a composition law.

## The bounded loop

A loop body iterated k times is its k-fold self-composition; the layered runner and the flat program are the same fold (tested bit-for-bit at the membership level). The charge LEDGER across iterations telescopes: each engineered iteration's delta sits at the rounding floor (≤ 2.2e-16 at k=5) and the total drift does NOT accumulate (0.0 measured) — the bounded fixpoint of the charge is a constant of the iterated motion (L-TELE). The loop toll COMPOUNDS: certifying the world after k coherent iterations of one choose costs w^k exactly, E[attempts] = 1/w^k (L-TOLL) — the price of certainty grows exponentially in the loop bound. Random bodies decay (data, no theorem).

## Two players

Against an adversarial second chooser with a bounded strategy census (24 seeded random branch pairs), the composed pattern weight is w₁·w₂ in every cell to 1.1e-16 — the toll is strategy-proof because it is branch-blind; no strategy haggles the price down (G-TOLL). The charge is the attack surface: the adversary-last census drives final membership across [0.2439, 0.7345], while an engineered answering move LOCKS whatever charge the adversary left (final = after-adversary per cell, to the floor). Census outcomes are DATA; the branch-blindness and the lock identity are machine-exact.

## The toll and the broadcast wall

Branch conditioning is exact (the denotation compiles — R1), but *knowing which world you are in* requires measuring the controls, and the pattern has weight P: the epoch-3 ledger identity E[attempts] = 1/P reopens at the language layer (R4), multiplies under composition (R9), and compounds under iteration (R11). And the choice register cannot be broadcast: CNOT copies the coherence's **value** exactly, but the copy's pair term rotates at double phase rate under the two-copy rephasing (R5) — the covariance-order mark, read off real matrices.

## Literature anchors (adopted v0.2.0; identifiers verified from two independent sources each)

- arXiv:2506.23320 — Assolini & Di Pierro, *A Denotational Semantics for Quantum Loops* (2025; also WQS @ PLDI 2025): the quantum-loop denotational line our bounded-loop face echoes.
- arXiv:2511.22537 — Dave, Lemonnier, Péchoux, Zamdzhiev, *A programming language combining quantum and classical control* (2025; FoSSaCS 2025 version, DOI 10.1007/978-3-031-90897-2_8): mixed control paradigms, adequacy.
- arXiv:2507.10466 — Barsse, Péchoux, Perdrix, *Quantum Control and General Recursion beyond the Unitary Case* (2025): coherent control of arbitrary operations with a default evolution for unreached subprograms — the analogue of our dead slots.
- arXiv:2412.19463 — Ying, Zhou, Barthe, *Laws of Quantum Programming* (2024; TOSEM/TOPLAS 2025, DOI 10.1145/3765903): programming laws for quantum control flow — the tradition our S/N law table executably echoes at fixed dimensions.

Methods are NOT reproduced from these papers (their domain constructions are not this repo's dense exact kernels); the anchors mark where the questions live. We note the echoes and claim no novelty.

## Honest boundaries

Random-program decay rates, loop-decay rates, and all census outcomes are DATA (no theorem). The floor constants are rounding noise measured at fixed seeds — quoted with provenance, not as laws. The clone/pair analysis is at the model's fixed dimensions. The composition laws are MODEL-EXACT at these dimensions, not general theorems about all quantum conditionals. Anchor repos (route-price, postselect-sched, dsic-noether) hold the toll, route, and Noether-shape provenance; the paper anchors above are literature pointers only. The appeal court for every row is this repo's `npm test`.
