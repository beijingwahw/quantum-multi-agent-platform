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
- **The holder's bounded catalyst** (AT15) — the QSI face EXECUTED in its bounded
  form: a holder storing a Schmidt purification of the register (diagonal marginal,
  the weakest memory) rides the shortcut untouched; the harvest is a **nested
  triangle** — AT14's phase alignment is the first layer, the classical record from
  measuring the memory the second (unlock up to 0.172 beyond alignment on the law's
  own trajectory states; the record matters exactly once the law has mixed the
  register); the bit ladder rides C_rel convexity (record-unlocked up to 0.469 bits);
  the coherent excess is **capped by the catalyst's dimension** (C_rel ≤ log2 d_c,
  tight at d_c = 2 — the straddler's full bit on the 2-dim weight); the residual gap
  to kT ln2·C_rel priced as data (−0.251…0.851 bits over the census). Finite
  catalyst, authored law, NO general asymptotic claim (WY16/OH02 stay cited).
- **The second world** (AT16) — two marked worlds under ONE law (same damping on
  both world bits, register w1⊗w2⊗cargo): every single-world face keeps its exact
  geometric on ARBITRARY (entangled) starts with the same increment identity; the
  join world is the absorbing class, its leakage the exact
  **union-with-intersection** qA + qB − qAB with qAB(k) = (1−γ)^{2k}·c0 — never a
  single geometric outside the trivial case (the normalized join face drifts by
  0.347, k=1→10, on the correlated start); join-block programs conserve all three
  charges, one-bit-block programs only their own world's (the other's moves by up
  to 0.839) — two worlds, one law, two conserved symmetries. The checker demands a
  re-derivable join certificate (SW8 rejects the single-geometric counterfeit).
- **The accumulated law-error** (AT17) — time-dependent ε_t priced exactly:
  B_t = B_{t−1}(1−ε_t)(1−γ) + ε_t (constant-ε limit = AT4's bound to 8.33e−17;
  census with FRESH random channels every step never exceeds it); an error
  **schedule** beats the constant worst case — alternating ε_t = 0.1/0.002 prices
  at 0.1553 against 0.3077 (49.5% off the constant-worst bill).

## Honest boundaries

The law is **authored** — the engineer writes the channel; nature instantiating it is not
claimed (same machine-layer boundary as vacuum-compiler). The continuum Green-Laffont
derivation stays excluded, exactly as ledger rows #14/#16 wrote it. The contents are
never chosen by the law — bring your own. The collision bath is repeated interactions
with **discrete** resonant qubits — the continuum weak-coupling (Davies) limit is cited
(DAV74), not executed. The shortcut needs a prepared coherent weight and control. The
QSI boundary is **tripartite**: one-shot incoherent control (AT14) and the holder's
classical record (AT15, second triangle layer) are executed exactly, the finite
catalyst's coherent take is capped at log2 d_c and attained on straddlers — but the
general/asymptotic face (WY16 distillation rates, OH02 work-deficit asymptotics,
unbounded catalysis à la LB21) stays **priced-and-cited, never claimed**: finite
catalyst, authored law, residual measured as data. The two-world law is the same
product channel on two marked bits — no claim about worlds with different damping
rates or competing markings. The perturbation censuses (AT4, AT17) are DATA supporting
exact algebra bounds.

## Run

```bash
npm test          # 63/63 (board laws, machinery closed forms, eleven smuggling trials, render guard, kernel-boundary trials)
npm run typecheck # tsc --noEmit, zero errors
npm run repro     # renders out/reports/the-stable-world.md in seconds
```

Anchors: `choice-lang` (the language layer), `dsic-noether` (the Noether note),
`route-price` / `vacuum-compiler` (the tariff schedule), `depreciation-ledger` (the shared
h₂ anchor), `survivor-census` (the absorbing-class kinship). Citations in `citations.md`
(LYAP92, NAC00, BCP14, BIPM19, DAV74, WY16, OH02, LB21, CZJ24 — double-sourced).
