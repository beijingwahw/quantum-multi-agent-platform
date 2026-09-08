# choice-lang

**The first executable model of choice as a language primitive — the #15 milestone body that does not need hardware.**

The ledger's OPEN row said *"no executable model exists"*. This repo is one. A minimal language: a program is a sequence of `choose(theta, U0, U1)` steps, each preparing a fresh control qubit in cos θ|0⟩ + sin θ|1⟩ and coherently routing the data register through U0 or U1 — controlled unitaries, the legal boundary route-price priced (coherent control steers, never broadcasts). The **desired world** is a marked subspace W of data; programs are **engineered** when every branch block preserves W.

- **R1 — the denotation compiles**: conditioning the final state on a control pattern yields exactly the branch product's action on data (deviation ≤ 1.2e-16; pattern weights exact).
- **R2 — stability as compilation** (engineered): data-in-W stays in W over arbitrary lengths — drift at the rounding floor (8.882e-16 measured at the witness's seeds).
- **R3 — random programs do not preserve the world** (data): mean membership 0.4816 after six random steps, sinking toward the dimension ratio ½.
- **R4 — the certification toll**: verifying *which* world you are in costs its branch weight — E[attempts] = 1/P, the epoch-3 ledger reopened at the language layer (weights exact; MC within 2% at 200k samples).
- **R5 — no broadcast**: the register's coherence rotates at order 1 under rephasing; the CNOT clone preserves the term's value exactly while its two-copy phase rate doubles — read off real matrices, never composed from the expected answer.
- **R6 — the conserved charge**: under engineered programs the membership expectation is conserved for **every** input (in-W, in-W⊥, random superpositions; drift ≤ 1.5e-15) — invariance ⟹ conserved charge ⟹ stability, the same implication shape as the discrete Noether layer (noted, not claimed as new).

## v0.2.0 — the language's own faces: composition, the loop, two players

- **R7 — sequential composition is a homomorphism** (S1/S2/S3): choose-after-choose has product-measure weights (6.9e-18, state-independent), chaining the conditioning equals conditioning the composition (1.7e-16), and denotation products associate (1.1e-16).
- **R8 — nested composition: context-free, NOT interchangeable** (N1/N2): every live path of choose(choose(A,B),C) and choose(A,choose(B,C)) conditions to its leaf's unitary with the path's product weight (1.1e-16) — but the two nestings **price** their common leaves differently (w_left(A) = cos²θ₁cos²θ₂ vs w_right(A) = cos²θ₁; a 0.464624 gap, exactly the closed form). Associativity lives in the denotation, never in the syntax — exact identity AND exact counterexample.
- **R9 — the toll multiplies** (T-MULT): certifying the composed pattern costs E[attempts] = 1/(P·Q) = (1/P)(1/Q) — weights exact to 6.9e-18, MC 23.61 vs 23.66 at 200k samples, and the parts' own MC tolls multiply to the composed toll.
- **R10 — the charge is conserved under composition** (Q-COMP): engineered programs, composed sequentially or nested, still conserve ⟨Π_W⟩ for every input (4.4e-16 / 2.2e-16); a random composition moves it by 0.5567.
- **R11 — the bounded loop** (L-TELE/L-TOLL): k iterations of an engineered body telescope the charge ledger at the floor (per-iteration deltas ≤ 2.2e-16, total drift 0.0 — no accumulation), and certifying after k coherent iterations costs w^k exactly (E[attempts] 46.11 vs 1/w⁵ = 46.18); random bodies decay (mean 0.5221 after 5, data).
- **R12 — the two-player census** (G-TOLL): against a 24-strategy adversary, the composed toll is branch-blind — w₁·w₂ to 1.1e-16 in **every** cell — while the charge is the attack surface (attack census min 0.2439; an engineered answer LOCKS whatever charge the adversary left, to 1.1e-16 per cell).

## What this does NOT settle

The epoch-5 question. Stability here is **compilation**, not physics — the desired world is a fixed point because we built the branches that way. The atlas row stays OPEN, now with the model attached: the question is about nature, no longer about whether the question can be asked.

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| P1 | every claim names its program family (engineered / random / both) — naked stability does not ship |
| P2 | tags are MODEL-EXACT or DATA only — **this repo's vocabulary has no physics-verdict words**; every row cites a witness |
| P3 | anchor repos exist on disk (route-price, postselect-sched, dsic-noether) |
| P4 | ids unique |
| P5 | law citations (rows' `cites`) must be ids of the machine-verified registry — counterfeit composition identities ("ASSOC-PRICE") and fake toll laws ("T-ADD") are named and rejected with the true law quoted |

Renderer refuses illegal models; eight smuggling trials; entry guard tested.

## Reproduce

```bash
npm ci
npm test        # 24/24
npm run repro   # renders out/reports/the-choice-model.md (seconds)
```
