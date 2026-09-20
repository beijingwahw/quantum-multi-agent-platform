# k-switch — Order superposition over k! topological sorts, executed

Roadmap #10 (epoch-2 frontier): the N-switch theorem layer, machine-verified
for k = 3 (v0.1.0) and now k = 4 (v0.2.0). Theory knows the quadratic query
separation (ARA14: O(n) with the N-switch vs O(n²) for fixed-order circuits);
nobody had executed any of it.

## The parity-orthogonality law (k = 3, and now k = 4)

On the promise "the boxes pairwise commute" vs "pairwise anticommute", with
one use of each box and the control prepared uniform:

- **commuting**: the control ends EXACTLY in the uniform state |u⟩ (fidelity
  1.000000000000) — the order carries no phase;
- **anticommuting**: every order's product is sgn(π)·P (at k = 4: exact for
  all 24 orders, deviation 0.00e+0), so the control ends EXACTLY in the
  permutation-parity state |u_par⟩ (|u_sgn⟩ at k = 4), fidelity 1;
- ⟨u|u_par⟩ = 0 **exactly** at both k = 3 (3 even − 3 odd) and k = 4
  (12 even − 12 odd) — deterministic readout. **The law survives k = 4.**

**Dimension-free**: ARA14's d ≥ N! target-dimension requirement belongs to
their strictly harder full problem (identifying every order's phase); the
binary promise needs no such bound — derived and executed here (k = 3 at
d = 4; k = 4 at d = 4 — four pairwise-anticommuting unitaries need d = 4).

## The k = 4 faces (v0.2.0)

- **The TCA+21 Hadamard promise at d = 2, executed** (their experiment's
  quartet Σ = {ABCD, BADC, CBDA, DACB}, Sylvester H₄): our census of ALL 256
  ordered {I,X,Y,Z}⁴ gate sets finds **136 promise-satisfying sets**
  (columns 52/36/24/24); Algorithm 1 reads the promise column with
  probability EXACTLY 1 on every one of them — one use of each gate, target
  a single qubit. TCA+21's Table 2 "30 Pauli sets" uses their own filtering,
  which we do not reproduce — our census is scoped to our domain.
- **The fixed-order supersequence bound, machine-decided**: the shortest
  string over {A,B,C,D} containing all four orders as subsequences has
  length **9** (104 minimal witnesses; their ACBADACDB verified) — a
  fixed-order supersequence simulation needs 9 uses to the switch's 4.
- **The exact distinguishability matrix**: for every order π ∈ S₄ (24) and
  every column pair (6): NO plain fixed order separates ANY column pair in
  the worst case — all 144 game-matrix entries are 0; matched set pairs with
  same-ray products exist everywhere. The switch readout separates all pairs
  deterministically. Interleaved circuits (random W's, sampling probe) DO
  distinguish the canonical binary instances — the structural blindness is
  for plain consecutive orders; general lower bounds stay cited.
- **The Pauli census at k = 4**: over the C(15,4) = 1365 two-qubit Pauli
  quadruples — **0 commuting** (impossible: maximal abelian Pauli subgroup
  at d = 4 has 3 non-identity elements — the k = 3 canonical commuting
  family cannot extend inside the Pauli universe; the commuting class must
  be non-Pauli, e.g. rotations of one generator), **30 anticommuting**
  (each satisfies the sgn law exactly). Matched blindness pairs inside the
  Pauli universe: **0** — an honest no-go. Constructed outside (rotations of
  the anticommuting product's own Pauli): all 24 plain orders blind between
  the classes, max trace distance 0.00e+0.
- **The scheduling contact law at k = 4, as data**: all 24 fixed orders
  carry D = 1/√2 exactly (survives); the 24-order switch lands at
  **√10/6 = 0.527046**, NOT 1/2 — the k = 3 halving law D(switch) =
  D(fixed)/√2 does NOT survive (dilution becomes √5/3 ≈ 0.7454). Still
  strictly below every definite order: order superposition does not beat
  ANY definite order on scheduling primitives.
- **The dilution family law D_k (v0.6.0, theorem enrolled — the source of
  √10/6)**: the single-erasure k-level chain (k−1 plane-preserving Pauli
  writes + one erase box, uniform mixture over all k! orders) has the
  CLOSED FORM D_k = √(¼ + (q_k − ½)²) with q_k = N₁/k! from the
  erasure-position sum N₁ = Σ_s s!(k−1−s)!·O(s), O(s) = Σ_{f odd}
  C(F,f)C(K,s−f) over the write census (F flippers X/Y, K keepers Z).
  Machine-discovered TRICHOTOMY (exact on the F=0..7 × K=0..6 grid): **F
  odd ⟹ q = ½ ⟹ D_k = ½ (the halving law, exact — suffix complementation
  pairs odd with even bits); F = 2m ⟹ q = m/(2m+1) ⟹ D_k =
  √((2m+1)²+1)/(2(2m+1))** (m=1: √10/6, the k=4 constant, now DERIVED;
  m=2: √26/10, the k=7 cycling row); **F = 0 ⟹ D_k = 1/√2 — the switch
  gains NOTHING** (all-keeper writes). K cancels identically. Every fixed
  order stays on the 1/√2 wall at every k (the plane law), so
  D(switch) < D(fixed) strictly whenever a flipper exists — order
  superposition never beats any definite order, whatever k. The cycling
  family k=2..9: halving at k=2,3,5,6,8,9; the m-law at k=4 (√10/6) and
  k=7 (√26/10) — the dilution is family-census-dependent, NOT monotone in
  k. Audits: the halving counterfeit at k=4, the swapped-mixture census,
  and an off-family Hadamard write (caught by the γ=0 dispersion
  structure) are each NAMED and rejected.
- **The k = 5 Majorana ladder (v0.5.0, theorem enrolled)**: γ₅ =
  γ₁γ₂γ₃γ₄ over the d = 4 anticommuting quadruple is the Pauli **Z⊗Y
  exactly** (deviation 0) — Cl(5) closes at dimension 4; the parity law
  survives its third step (all 120 orders multiply to sgn(π)·P, deviation
  0; ⟨u|u_sgn⟩ = (60−60)/120 = 0 exactly; |u_sgn⟩ readout fidelity 1);
  the Pauli pentad census over C(15,5) = 3003 finds **6 anticommuting
  quintuples, 0 commuting**, reconciled by the machine identity
  #quintuples×5 = Σ extensions = 30 with every anticommuting quadruple
  extending by exactly one Pauli (it spans F₂⁴ — the symplectic
  uniqueness); C(15,6) = 5005 sextuples contain **zero** anticommuting
  ones (2n+1 = 5 maximal); the dimension staircase d(k) = 2^⌈(k−1)/2⌉ is
  machine-witnessed at k = 1..5 with the d = 2 Bloch-orthogonality ceiling
  (3 pairwise-orthogonal unit vectors at most, the fourth forced to zero —
  det = ±1 on every sampled orthonormal triple).

## Reproduce

```
npm install
npm test        # 69/69
npm run repro   # 5 reports in out/reports/
```

## v0.6.0 — the dilution family law D_k (theorem enrolled)

New files `src/kswitch/dilution.ts` + `test/dilution.test.ts`, nothing
else touched (version/lockfile/README aside): the erasure-position
decomposition (γ=0 branches all land on ONE ray by exchanger parity; γ=1
branches take exactly the two diagonal states with the counted census),
the closed form D_k = √(¼ + (q_k−½)²), the flipper-census TRICHOTOMY
(halving when F odd, the m-law √((2m+1)²+1)/(2(2m+1)) when F = 2m —
√10/6 derived at m = 1 — and no gain at F = 0), the fixed-order wall at
every k, the cycling-family table k = 2..9, and four smuggling trials
(halving-law counterfeit, swapped census, off-family Hadamard write
caught by structure, named domain guards). Counts as the machine prints
them: 69/69 (56 old + 13 new).

## v0.5.0 — the k = 5 Majorana ladder (theorem enrolled)

New file `src/kswitch/k5.ts` + `test/k5.test.ts`, nothing else touched:
the derived fifth Majorana, the 120-order parity law at k = 5, the pentad
census with its reconciliation identity and sextuple maximality face, the
dimension staircase with the d = 2 ceiling, and three smuggling trials
(forged pentad, counterfeit census count, ladder lie) each NAMED and
rejected against the machine-recomputed truth. Counts as the machine
prints them: 56/56.

## v0.3.0 — the quality wave (math frozen, results bit-identical)

No new mathematics and no changed number: every report re-renders
byte-identical. Type hardening (the `as never` test casts and the one
`as unknown as` are gone; the census entry `kind` union no longer carries
the never-emitted `"mixed"`), a named error surface
(`src/kswitch/errors.ts` — every public throw carries a code; out-of-range
gate indices and sub-quartet supersequence limits are named and rejected,
with smuggling-trial tests), single-sourcing (sched3/sched4 and exp1 now
import the shared `cmatMul`/`cmatDagger`/experiment kernels instead of
carrying byte-identical private copies; the |+⟩⟨+| scheduling input is one
exported `plusPlus()`), and dead-code settlement (the zero-reference
collateral surplus in `cmat.ts`, three unused `Rng` methods, and
`randomQubit` are deleted; the census-registered cmat lineage file itself
stays).

## Honest boundaries

1. The interleaved/ancilla-assisted lower bound is ARA14's theorem, cited —
   we execute the plain-order blindness (exact, structural), a sampling
   probe, and at k = 4 the supersequence strategy's 9-use cost (bounded,
   strategy-specific). The general fixed-order lower bound is NOT re-proven;
   Bavaresco et al. 2024/2025 prove switch-simulation hardness — cited.
2. ARA14's full problem (all-order phase identification, d ≥ N!) is stronger
   and NOT claimed. The TCA+21 face executed here is the P = 4 quartet
   promise at d = 2 — also weaker than ARA14's full problem.
3. The scheduling chain is one toy family (unitary writes + probabilistic
   erasure); the k = 3 law was that family's law at that depth — the k = 4
   data (fixed 1/√2 survives, halving breaks at √10/6) shows the mixture
   constant is family-and-k-specific, honestly scoped. The v0.6.0 family
   law scopes this precisely: the trichotomy covers single-erasure chains
   of plane-preserving writes {X, Z, Y} at d = 2 only — general channels,
   multiple erasures, and d > 2 registers are out; the F = 2m branch is
   machine-established on the swept (F, K) grid (no closed-form proof
   shipped — an honest DATA law), while the F-odd halving branch is proven
   by the suffix-complementation involution; the executor is priced for
   k ≤ 6, the closed form carries any k.
4. TCA+21's Table 2 (30 sets) is their convention; our 256-set census is
   ours. The 30 anticommuting Pauli quadruples here are a d = 4 census
   object — numerically equal to their 30 by coincidence, not the same set.

## Related

- `../switch-sched` (#8, the 2-switch layer), `../causal-ineq` (#9, the
  causal inequality), `../bqp-map` (the atlas row `order-as-resource`).

## Bibliography (web-verified)

- **ARA14** — M. Araújo, F. Costa, Č. Brukner, "Computational advantage from
  quantum-controlled ordering of gates", PRL 113, 250402 (2014).
  arXiv:1401.8127.
- **CDP13** — Chiribella-D'Ariano-Perinotti-Valiron, PRA 88, 022318 (2013).
  arXiv:0912.0195. [Verified earlier in this workspace.]
- **TCA+21** — M. M. Taddei, J. Cariñe, D. Martínez, T. García, N. Guerrero,
  A. Abbott, M. Araújo, C. Branciard, E. Gómez, S. P. Walborn, L. Aolita,
  G. Lima, "Computational advantage from quantum superposition of multiple
  temporal orders of photonic gates", PRX Quantum 2, 010320 (2021).
  arXiv:2002.07817. [Verified 2026-09-08: arXiv abstract page + ar5iv full
  text; the N = 4 experiment — 4 gates, superposition of 4 orders, d = 2
  promise problem.]
- **BCK+24/25** — J. Bavaresco, H. Kristjánsson, M. Murao, T. Odake, et
  al., "Simulating the quantum switch with quantum circuits is computationally hard", arXiv:2409.18202; Nat. Commun. 16, 10216 (2025).
  [Verified 2026-09-08: arXiv + Nature/PubMed. Cited only.]
- **Deng+25** — Y. Deng, S. Liu, X. Chen, Z. Fu, J. Bao, Y. Zheng, Q. Gong,
  J.-W. Wang, "Generalized Indefinite Causal Orders in an Integrated
  Quantum Switch", PRL 135, 160202 (2025). [Verified 2026-09-08:
  link.aps.org + PubMed 41172194. Anchored — multi-order switch chip;
  nothing machine-checked against it.]

MIT. TypeScript strict, zero runtime dependencies, NodeNext, node:test.
