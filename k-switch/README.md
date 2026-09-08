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

## Reproduce

```
npm install
npm test        # 29/29
npm run repro   # 5 reports in out/reports/
```

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
   constant is family-and-k-specific, honestly scoped.
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
