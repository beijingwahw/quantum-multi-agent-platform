# stable-world

> Ledger row #15's cost column: *"What stays open is stability as PHYSICS, not as compilation."*
> This repo is that open core, executed.

The letter's epoch-5 sentence has two halves. The language half shipped as `choice-lang`:
`choose(θ, U0, U1)` compiles to controlled branching, and the desired world stays stable
**by construction** — engineered programs preserve it, the membership charge is conserved.
What the ledger kept open was the physics half: the world as a **stable solution of the law
itself**, not of anyone's program.

## The law

A fixed dissipative CPTP channel on (world qubit ⊗ cargo qubit): amplitude damping **into**
the world bit, identity on the cargo. Nothing else. Then, machine-witnessed:

- **Quiet on the world** — every in-world state is a fixed point (deviation exactly 0);
- **Globally attractive** — from any state, leakage decays as `(1−γ)^k (1−p₀)`, exact for
  every input; at k=200 the state is its into-world collapse to 1.6e−13. The cargo rides
  in intact: the law selects the **world**, never the **contents** (path-dependent);
- **Lyapunov-certified** — the membership charge (choice-lang R6's functional) satisfies
  `ΔV = γ(1−V)` exactly: strictly increasing off the world, conserved exactly under
  engineered branch programs. One functional, two regimes: symmetry's charge becomes
  dissipation's Lyapunov function;
- **Robust under law-error** — `Φ_ε = (1−ε)Φ + εN` keeps the world attractive with
  asymptotic leakage `≤ ε/(1−(1−ε)(1−γ))` (exact bound, 96-channel census under it);
- **Escape exactly impossible** — the charge never decreases; the world is the absorbing
  class, not a metastable state. The parametric two-rate chain prices an external
  escape rate `r` in closed form; the thermal reading is a stated boundary, not shipped;
- **Paid for** — stabilization erases which-sector information: `h₂(q̄)` bits per run at
  `kT ln2` per bit on the settled #11 schedule (classical face; coherent face
  model-dependent, deliberately unpriced).

## Honest boundaries

The law is **authored** — the engineer writes the channel; nature instantiating it is not
claimed (same machine-layer boundary as vacuum-compiler). The continuum Green-Laffont
derivation stays excluded, exactly as ledger rows #14/#16 wrote it. The contents are
never chosen by the law — bring your own.

## Run

```bash
npm test          # 21/21 (board laws, machinery closed forms, six smuggling trials, render guard)
npm run typecheck # tsc --noEmit, zero errors
npm run repro     # renders out/reports/the-stable-world.md in seconds
```

Anchors: `choice-lang` (the language layer), `dsic-noether` (the Noether note),
`route-price` / `vacuum-compiler` (the tariff schedule), `depreciation-ledger` (the shared
h₂ anchor), `survivor-census` (the absorbing-class kinship). Citations in `citations.md`
(LYAP92, NAC00 — double-sourced).
