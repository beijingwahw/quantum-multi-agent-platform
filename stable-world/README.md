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
  escape rate `r` in closed form; **the thermal reading ships** (AT8): with the authored
  Hamiltonian `H = ΔE·Π_perp` and a detailed-balance bath `r = γe^{−ΔE/kT}`, the
  stationary occupancy is the Boltzmann logistic `1/(1+e^{−βΔE})` exactly, and the design
  rule `βΔE ≥ ln(Kγ/δ)` holds escape ≤ δ over horizon K (5 GHz at 10 mK reads `1 − 3.8e−11`
  — exact SI arithmetic; every temperature decade costs exactly `ln 10` in `βΔE`);
- **The bath is DERIVED, not authored** (AT9) — resonant Gibbs bath qubits under the
  energy-conserving exchange `exp(−iθS)`: detailed balance `r~/g~ = e^{−βΔE}` emerges
  exactly for every angle and temperature, populations follow the two-rate chain per
  collision, the stationary register is Gibbs-world ⊗ cargo, **and the law itself is the
  T=0 member of its own bath family** (trace distance against `applyLaw` decaying as
  `e^{−βΔE}`); the sector-coherence factor is `cos θ` whatever the temperature — the bath
  thermalizes populations and never touches the coherence rate;
- **Paid for on both faces** — stabilization erases which-sector information: `h₂(q̄)` bits
  per run at `kT ln2` per bit on the settled #11 schedule (classical face, AT5); the
  **coherent face is priced** (AT7) on the authored diagonal Hamiltonian: dephasing
  preserves `⟨H⟩` exactly, so `F(ρ) − F(Δρ) = kT ln2 · C_rel(ρ)` with `C_rel` the
  relative entropy of sector coherence — pure straddlers pay the full bit, erasure is
  monotone (the law is an incoherent operation) and completes at exactly twice the
  classical rate; the value is **dissipated by the law, BANKED by the shortcut** (AT10):
  the same exchange at `θ = π/2` against a ground weight reaches the law's k→∞ state in
  ONE step, conserves full-basis `C_rel` exactly, and banks the straddler's full sector
  bit on the weight with free-energy excess exactly `kT ln2` — coherent protocols
  conserve what incoherent laws dissipate.

- **The continuum limit is EXECUTED** (AT11) — as a discrete convergence theorem: at
  every finite coupling the collision dynamics is exact and closed-form (populations
  `p' = p + sin²θ·(p_b − p)` with no higher corrections; block coherences by the 2×2
  mixing matrix with eigenvalues {1, 1−sin²θ}; sector coherence `cosⁿθ`), the limit
  `t = n·sin²θ` only replaces geometrics by exponentials with error `O(t·sin²θ)`
  (halving θ quarters it), and **the Davies coherence rate (γ↓+γ↑)/2 = ½ is restored
  exactly although every finite coupling is temperature-free** — the clock absorbs
  `p_b + q_b = 1`;
- **The burn is AUDITED** (AT12) — the shortcut's output satisfies the exact three-term
  ledger `C_total = C_register + C_weight + (I − J_c)` with every term ≥ 0, and the
  inverse permutation restores the input **bit-exactly**: dissipation is the law's
  choice, not a necessity of the physics;
- **The generator is IDENTIFIED** (AT13) — the extraction `(Φ_θ − id)/sin²θ` converges
  to the **Lindblad operator with the Davies rates** (jump-down `√p_b|1⟩⟨0|⊗I`,
  jump-up `√q_b|0⟩⟨1|⊗I`, interaction picture) at O(θ²) elementwise, and the
  composition convergence is **uniform over the state space** — the norm-continuity
  core of DAV74 witnessed where the functional analysis only asserts;
- **The QSI boundary is SPLIT** (AT14) — its one-shot core needs NO side information:
  an incoherent controlled-phase controller raises the banked weight coherence to the
  ℓ¹ optimum **exactly** (triangle inequality attained), recovering up to 72.7% on
  opposite-phase states; the residual correlation coherence stays priced-and-cited
  (WY16).

## Honest boundaries

The law is **authored** — the engineer writes the channel; nature instantiating it is not
claimed (same machine-layer boundary as vacuum-compiler). The continuum Green-Laffont
derivation stays excluded, exactly as ledger rows #14/#16 wrote it. The contents are
never chosen by the law — bring your own. The collision bath is repeated interactions
with **discrete** resonant qubits — the continuum weak-coupling (Davies) limit is cited
(DAV74), not executed. The shortcut needs a prepared coherent weight and control;
harvesting beyond straddlers splits between weight coherence and register-weight
entanglement (census 0.01–0.95 banked) — quantum side information territory.

## Run

```bash
npm test          # 41/41 (board laws, machinery closed forms, seven smuggling trials, render guard)
npm run typecheck # tsc --noEmit, zero errors
npm run repro     # renders out/reports/the-stable-world.md in seconds
```

Anchors: `choice-lang` (the language layer), `dsic-noether` (the Noether note),
`route-price` / `vacuum-compiler` (the tariff schedule), `depreciation-ledger` (the shared
h₂ anchor), `survivor-census` (the absorbing-class kinship). Citations in `citations.md`
(LYAP92, NAC00, BCP14, BIPM19, DAV74, WY16 — double-sourced).
