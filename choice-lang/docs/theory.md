# Theory — a language whose primitive is choice

## The object

The atlas row asked: *define a computation model whose semantics make "the world I want" a stable solution — then ask what conservation law, if any, guards the stability.* This repo supplies the model: `choose` nodes, controlled-unitary semantics, a marked world W. Six facts survive machine audit (see the model ledger); the physics question stays open and is not claimed.

## Register discipline

Each choose step prepares a fresh control and routes data through its branch unitary, coherently. Controls accumulate oldest-first, so every step operator is a pure Kronecker expression and no per-step reshuffling exists. The dimension account is unforgiving: k controls on d-dimensional data means a 2^k·d joint state — program length is bounded by memory, not by mathematics (the first probe hung at k=20 for exactly this reason; batch 25).

## Why the diagonal is the invariant

A single choose preserves the control's **diagonal** (outcome probabilities cos²θ / sin²θ) exactly — but NOT its cross-term, which is scaled by Tr[U0 ρ U1†]. That scaling is not a bug; it is how a control register can carry information at all (the replacer pair's mechanism in switch-sched/readout-wall). The tests assert the diagonal; the language's information economy lives in the cross-term's fate.

## Stability and its charge

Engineered programs are block-diagonal in W ⊕ W⊥, so W is an invariant subspace: membership fidelity 1 over any length (R2), and — the stronger statement — the membership expectation is conserved for **every** input, not just residents of W (R6). That is the conserved-charge face of invariance: ⟨Π_W⟩ is a constant of the engineered motion. Random programs violate both. The implication shape (invariance ⟹ conserved charge ⟹ stationarity) is the same one dsic-noether machine-verified at the mechanism-design layer; we note the echo and claim nothing new.

## The toll and the broadcast wall

Branch conditioning is exact (the denotation compiles — R1), but *knowing which world you are in* requires measuring the controls, and the pattern has weight P: the epoch-3 ledger identity E[attempts] = 1/P reopens at the language layer (R4). And the choice register cannot be broadcast: CNOT copies the coherence's **value** exactly, but the copy's pair term rotates at double phase rate under the two-copy rephasing (R5) — the covariance-order mark, read off real matrices.

## Honest boundaries

Random-program decay rates are DATA (no theorem). The floor constants are rounding noise measured at fixed seeds — quoted with provenance, not as laws. The clone/pair analysis is at the model's fixed dimensions. No new citations: the toll anchors to postselect-sched's in-book ledger, the clone mark and route to route-price's dossier, the Noether-shape note to dsic-noether. The appeal court for every row is this repo's `npm test`.
