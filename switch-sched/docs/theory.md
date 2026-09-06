# Theory — derivations behind the certificates

All statements below are machine-checked in `test/` and `src/experiments/`;
the derivations are given so every closed form in the reports can be audited
by hand. Conventions: big-endian digit decomposition everywhere (matches
`partialTrace`); the switch control is qubit 0-major in (c, S, E_A, E_B).

## 1. The switch as a controlled-routing isometry

A channel Λ with Kraus set {K_m} gets its Stinespring dilation
V = Σ_m K_m ⊗ |m⟩_E (an isometry H → H ⊗ H_E, certificate V†V = I). The
branch isometries, with FIXED environment slot semantics (slot a = A's env,
slot b = B's env, regardless of order), are

```
W_{A-first}[(s,a,b), i] = Σ_j V_B[(s,b), j] · V_A[(j,a), i]
W_{B-first}[(s,a,b), i] = Σ_j V_A[(s,a), j] · V_B[(j,b), i]
```

and the switch is M = |0⟩⟨0|_c ⊗ W_{A-first} + |1⟩⟨1|_c ⊗ W_{B-first}. M is
an isometry (M†M = I_{2d}); the ORDER SUPERPOSITION is not baked into M — it
arises when the input control is |+⟩. (Baking 1/√2 into M breaks the
isometry certificate; that was bug #1 of this build, caught by the
M†M = I check.)

The fixed-slot convention is load-bearing: if each branch permutes its
environment factors by who-acts-first, the cross-branch coherence
⟨branch0|branch1⟩ pairs the wrong environments and the control formula
below fails (bug #2, caught by the closed-form judge).

## 2. Replacer-pair switch — exact control formula

Replacer to the uniform |v⟩ = Σ_i |i⟩/√d on a qubit: Kraus K_i = |v⟩⟨i|,
dilation V|ψ⟩ = |v⟩ ⊗ |ψ⟩_E. Branches:

```
|Ψ_0⟩ = |v⟩_S |ψ⟩_{E_A} |v⟩_{E_B},   |Ψ_1⟩ = |v⟩_S |v⟩_{E_A} |ψ⟩_{E_B}
```

With input control |+⟩, tracing environments:

```
ρ_{cS} = |v⟩⟨v| ⊗ [ ½ I + ½ |⟨v|ψ⟩|² (|0⟩⟨1| + |1⟩⟨0|) ]
```

so the control marginal is ρ_c = ½I + (q/2)σ_x with q = |⟨v|ψ⟩|². For the
ensemble {|v⟩, |v⊥⟩}: control states |+⟩⟨+| (pure) and I/2, hence

- single-use trace distance T = ½, Helstrom success ¾;
- χ = S(¾|+⟩⟨+| + ¼|−⟩⟨−|) − ½(0 + 1) = H₂(¼) − ½ ≈ 0.311278 bits;
- each single box and each definite order: T = 0, χ = 0 (output independent
  of input).

This is the executable core of the ESC advantage (priority: PRL 120, 120502).

## 3. Completely depolarizing pair — joint-only information

With the d²-dim Weyl dilation, the switched pair's joint (c, S) state carries
single-use T = ¼ on {|0⟩, |1⟩} while BOTH marginals are exactly zero — the
receiver must measure jointly. The asymmetry sweep (depol(p), depol(1)) gives
the exact linear law T_joint = p/4 (asserted at 5 points): at p = 0 the two
branches act identically on the target and the order carries nothing; the
order channel opens linearly as the second box closes.

## 4. Commutation task and the fooling pairs

For involutive boxes, the switch state with control |+⟩ is

```
|Ψ⟩ = (|0⟩ U_B U_A + |1⟩ U_A U_B)|ψ⟩/√2 = |±⟩ ⊗ U_B U_A|ψ⟩
```

with − iff U_A U_B = −U_B U_A: one use of each box decides the promise with
zero error. Fixed-order classes:

- Plain fixed order, one use each, no ancilla: matched instances
  (X⊗I, Z⊗I) vs (X⊗I, I⊗Z) on Z-eigenbasis inputs — outputs identical up to
  an invisible global phase in both orders (T = 0, exhaustive over basis ×
  orders).
- Coherent control of gates (each box once, applied iff control = 1): global
  phase of the composed product becomes a RELATIVE phase (phase kickback),
  so the plain fooling pair fails here; the fooling pair for THIS class is
  matrix-equal products with different promise — (X, Z) [Z·X] vs (ZX, I)
  [I·(ZX)] — identical outputs always.
- The full 4-vs-2 query bound over ancilla-assisted fixed-order circuits is
  Chiribella et al.'s theorem (cited, not re-proven).

## 5. Dilation independence

For unitary env freedom V' = (I⊗U)V and for padding V' = V⊗|0⟩_fresh, the
switched (c, S) output is invariant: cross-branch terms pair ⟨Uψ|Uv⟩ = ⟨ψ|v⟩
by unitarity; the fresh factor contributes ⟨0|0⟩. Machine: ≤ 3.5e-18 over
three dilations. Note the invariance is on the channel supermap — the FULL
(c, S, E_A, E_B) states differ, as they must.

## 6. Scheduling contact — the three computed laws

Machine register M ∈ {idle, busyA, busyB}, task register T; receiver reads M.

- alloc∘exec(γ) keeps the task signature with weight 1−γ:
  **D(AB) = 1−γ**; exec∘alloc always writes it: **D(BA) = 1**.
- The switch: **D(switch) = (1−γ)/2** — the coherent average over
  "already/not-yet allocated" carries half the signature of even the worse
  definite order. Δ = D_sw − max(D_fix) < 0 for all γ > 0.
- With the allocation write post-erased with prob ε: **D(switch) = (1−ε)/4**,
  and at ε = 1 everything closes INCLUDING the switch. The contrast with §2/§3
  isolates the admission mechanism: in the ESC pairs the payload TRANSITS
  both channels (each environment captures distinguishable information);
  here the payload is CREATED by alloc and erased after the fact — nothing
  transits, nothing is recombined.
- Random isometry pairs (40 seeds, d = 2, env 2): system-register receiver
  0/40 positive, median Δ ≈ −0.16. Joint receiver 36/40 positive, median
  ≈ +0.14 — but the joint readout includes the control, an output register
  no plain definite-order use possesses; we report it as a caveat, not as
  order advantage (the right general comparison class is the causally
  separable strategies of the process-matrix framework, cited).

## 7. Mechanism toy — the halving law

Type |0⟩, deviation R_θ = R_y(θ); posted-price payoffs (2, 1); allocation A.
Definite order U_def(θ) = 1 + cos²(θ/2)·1 (max gain −1..0: DSIC). Switched:

```
U_sw(θ) = ½ (U_def(θ) + 2)
```

EXACTLY — for the measurement-style allocation because branch coherences
decohere in the payoff marginal, and (machine's verdict) ALSO exactly for
coherent CNOT allocation: the cross-branch coherences live on (c, B) and
cancel from the P marginal in this family. Deviation gains halve, never flip:
IC direction is order-free here; the landscape rescales. Scope: one toy, one
deviation family, exact arithmetic — a probe, not a theorem.

## 8. What would falsify / extend this layer

- A channel pair where the system-register receiver strictly beats the best
  definite order (would refute the admission criterion as stated — none found
  in the enumerated families, 0/40 random).
- A mechanism family where the halving law breaks with positive deviation
  gain (would reopen the mechanism wall; CNOT allocation here does not).
- Multi-box switches (n > 2) and the causally-separable comparison class:
  natural next layer, not covered.
