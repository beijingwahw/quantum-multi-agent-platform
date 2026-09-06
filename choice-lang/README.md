# choice-lang

**The first executable model of choice as a language primitive — the #15 milestone body that does not need hardware.**

The ledger's OPEN row said *"no executable model exists"*. This repo is one. A minimal language: a program is a sequence of `choose(theta, U0, U1)` steps, each preparing a fresh control qubit in cos θ|0⟩ + sin θ|1⟩ and coherently routing the data register through U0 or U1 — controlled unitaries, the legal boundary route-price priced (coherent control steers, never broadcasts). The **desired world** is a marked subspace W of data; programs are **engineered** when every branch block preserves W.

- **R1 — the denotation compiles**: conditioning the final state on a control pattern yields exactly the branch product's action on data (deviation ≤ 1.2e-16; pattern weights exact).
- **R2 — stability as compilation** (engineered): data-in-W stays in W over arbitrary lengths — drift at the rounding floor (8.882e-16 measured at the witness's seeds).
- **R3 — random programs do not preserve the world** (data): mean membership 0.4816 after six random steps, sinking toward the dimension ratio ½.
- **R4 — the certification toll**: verifying *which* world you are in costs its branch weight — E[attempts] = 1/P, the epoch-3 ledger reopened at the language layer (weights exact; MC within 2% at 200k samples).
- **R5 — no broadcast**: the register's coherence rotates at order 1 under rephasing; the CNOT clone preserves the term's value exactly while its two-copy phase rate doubles — read off real matrices, never composed from the expected answer.
- **R6 — the conserved charge**: under engineered programs the membership expectation is conserved for **every** input (in-W, in-W⊥, random superpositions; drift ≤ 1.5e-15) — invariance ⟹ conserved charge ⟹ stability, the same implication shape as the discrete Noether layer (noted, not claimed as new).

## What this does NOT settle

The epoch-5 question. Stability here is **compilation**, not physics — the desired world is a fixed point because we built the branches that way. The atlas row stays OPEN, now with the model attached: the question is about nature, no longer about whether the question can be asked.

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| P1 | every claim names its program family (engineered / random / both) — naked stability does not ship |
| P2 | tags are MODEL-EXACT or DATA only — **this repo's vocabulary has no physics-verdict words**; every row cites a witness |
| P3 | anchor repos exist on disk (route-price, postselect-sched, dsic-noether) |
| P4 | ids unique |

Renderer refuses illegal models; five smuggling trials; entry guard tested.

## Reproduce

```bash
npm ci
npm test        # 12/12
npm run repro   # renders out/reports/the-choice-model.md (seconds)
```
