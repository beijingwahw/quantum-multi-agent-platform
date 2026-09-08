# exp5-process-witness

## 1. The game as a linear functional

S_game Hermitian: yes; Tr[S_game] = 2.000000;
witness S = (3/16)𝟙 − S_game spectrum: min -0.025888, max 0.150888.
S is NOT positive semidefinite — nonnegativity on causally separable processes is
NOT a PSD argument; it is the causal inequality itself (census: exact over classical
vertices; quantum definite-order: sampled battery below; general proof: OCB Eq. (2), cited).

## 2. Exhaustive classical census (both definite orders)

| family | vertices | cap | 3/4-achievers |
|---|---|---|---|
| B-first (Bob acts first) | 4096 | 0.750000000000 | 128 |
| A-first (Alice acts first) | 4096 | 0.750000000000 | 128 |
| **total (exhaustive)** | **8192** | **0.750000000000** | **256** |

Argmax vertex: B:h0,g1,f5 (both orders achieve 3/4 — the cap is an order-free
property of the game). Shared randomness cannot exceed the vertex cap: p_succ is linear
in the behavior, so the maximum over convex mixtures sits on a vertex. **Classical causal
cap = 3/4, machine-census-verified over all 8192 deterministic strategies.**
Shipped-record verification: PASS — verified: 8192 vertices, cap 0.750000.

## 3. Quantum causally separable battery (sampled, labeled as sample)

- 120 random definite-order processes (complex Kraus channels, both orders):
  min Tr[S W] = 3.325e-2 (worst case A-first #27) — no violation.
- shared Bell-state process ρ^{A1B1} ⊗ 𝟙^{A2} ⊗ 𝟙^{B2}: Tr[S W] = 0.125000 ≥ 0.
- scope: a sample over d=2 channels, not a classification of the separable set;
  the 3/4 bound over ALL causally separable processes is OCB's theorem (cited).

## 4. The OCB process matrix — validity and violation

- Hermitian: true; eigenvalues {0, 0.5} (each 8-fold) — PSD.
- Normalization |Tr[W(M_CPTP ⊗ M_CPTP)] − 1| ≤ 2.2e-16 over the identity pair + random CPTP battery.
- Term types: ∅:0.2500 A2B1:0.1768 A1B1B2:0.1768 — all in the OCB Fig. 3 set.
- A2B1-type (A⋠B direction) AND A1B1B2-type (B⋠A direction) coexist — the structural
  signature that no single definite order can generate this process.
- Game value via the linear functional: 0.853553390593
- Game value via the from-scratch Born-rule loop: 0.853553390593
- Both equal (2+√2)/4 = 0.853553390593; witness Tr[S W_OCB] = -0.103553390593 = −(√2−1)/4.
Shipped certificate verification: PASS — verified: recomputed Tr[S W] = -0.103553, structure valid.

## 5. Robustness: the isotropic family W(ν) = νW_OCB + (1−ν)𝟙/4

| ν | p_succ(ν) | Tr[S W(ν)] | min eigenvalue | verdict |
|---|---|---|---|---|
| 0.000000 | 0.500000000 | +0.250000000 | 2.50e-1 | causal |
| 0.250000 | 0.588388348 | +0.161611652 | 1.87e-1 | causal |
| 0.500000 | 0.676776695 | +0.073223305 | 1.25e-1 | causal |
| 0.700000 | 0.747487373 | +0.002512627 | 7.50e-2 | causal |
| 0.707107 | 0.750000000 | +0.000000000 | 7.32e-2 | causal |
| 0.750000 | 0.765165043 | -0.015165043 | 6.25e-2 | VIOLATES |
| 0.900000 | 0.818198052 | -0.068198052 | 2.50e-2 | VIOLATES |
| 1.000000 | 0.853553391 | -0.103553391 | 3.63e-17 | VIOLATES |

Bisection: ν* = 0.707106781187; closed form 1/√2 = 0.707106781187;
deviation 2.22e-16. The witness needs > 70.71% OCB
process in the mixture — the violation is noise-robust but not noise-free; validity (PSD,
normalization, term types) holds for EVERY ν ∈ [0,1] of the family (machine-checked per row).

## 6. The switch contrast — order indefiniteness ≠ causal violation

The T1 quantum switch (control |+⟩, target |0⟩), same game, canonical OCB instruments:
p_succ = 0.625000000000 — 0.125000 BELOW the classical causal cap 3/4.
The switch is causally nonseparable as an ORDER structure (T1's control-displacement
witness) yet does not even reach, let alone beat, the causal inequality on this game —
machine echo of van der Lugt et al., Nat. Commun. 14, 5811 (2023), doi:10.1038/s41467-023-40162-8: the isolated switch's
correlations do not violate causal inequalities. The OCB process and the switch are
different objects; only the former violates. Scope: canonical instruments, one target
preparation — a computed instance, not a claim over all switch strategies.

## Verdict

- Machine-checked, exact: census cap 3/4 over 8192 deterministic causal strategies;
  W_OCB valid (PSD, normalized, legal term types) with p_succ = (2+√2)/4 and witness
  −(√2−1)/4, both reproduced by two independent computations; critical visibility ν* = 1/√2.
- Sampled (labeled): 120 random definite-order processes + shared Bell — no witness violation.
- The stated-open face of v0.1.0 ("process witnesses, cited, not machine-checked") is now
  machine-checked at bounded dimension — d = 2 per wire, the OCB game, one witness.
- Still open, honestly: other causal inequalities; higher dimensions; the full quantum
  separable classification; device-independent variants (2023–2026 experimental line:
  Guo et al. arXiv:2506.20516 / Sci. Adv. aee2912; Richter et al. arXiv:2506.16949 —
  anchored, not reproduced.

