# causal-ineq — The causal inequality, executed

Roadmap #9 (epoch-2 deepening): the theorem layer of the Oreshkov-Costa-Brukner
process matrix framework, machine-verified. The claim on trial: *there are
correlations with no causal order* — a "causal inequality" that every definite
order satisfies and a valid quantum process violates.

What exists in the literature: the framework and the causal game (OCB12),
SDP-based causal witnesses (ARA15), the exact ICO bound of the OCB inequality
(LC25), photonic causal-nonseparability experiments. What did **not** exist —
and what this repo delivers — is the certificate layer:

- **nobody had exhausted the classical causal strategies of the game**
  (all 8,192 deterministic strategies in both orders swept here: the cap is
  exactly 3/4);
- **nobody had executed the process Born rule** P = Tr[W(M^A ⊗ M^B)] on exact
  complex algebra with closed-form anchors at every step;
- **nobody had made the validity constraints executable** (the allowed-pattern
  rule F1–F3 derived from TPCP invariance, PSD and normalization checked,
  negative controls failing for the right reasons);
- **the violation process is machine-derived**: W\* = ¼[1 + (1/√2)(Z^A2 Z^B1 +
  Z^A1 X^B1 Z^B2)] — every term on an allowed pattern, eigenvalues exactly
  {0, ½} (the two Pauli products anticommute), trace exactly 4, and the OCB
  protocol on it delivers exactly cos²(π/8);
- **nobody had proven the qubit-strategy optimality** (v0.2.0, exp4): within
  ALL qubit-lab instruments — general POVMs, entangled CJ elements, arbitrary
  input-dependence — nothing beats cos²(π/8) on W\*, by functional relaxation
  with every lemma PSD/TP-level (a proof, not a grid);
- **the literature equivalence is machine-checked** (v0.2.0, exp5): the
  derived W\* IS OCB12's published eq. (7) elementwise, and LC25's attaining
  S_OCB,1 besides; both payoff derivations (executed Born rule vs their
  closed forms) agree entry by entry.

## The three layers, then the two v0.2.0 faces

**T1 — validity** (`src/process/validity.ts`, `exp1`): Hermitian, PSD
(real-symmetric Jacobi via doubling, anchored), trace 4, and the pattern rules
F1–F3 — derived in the source header from first principles: perturbing a TPCP
instrument by X with Tr_{A2}[X] = 0 must leave the total probability
unchanged, which kills (i) A2-operators with B trivial (own input-output
correlation — the process cannot pre-correlate a lab's input with its output),
(ii) B2-operators with A trivial, (iii) A2 and B2 together. Seven nontrivial
support signatures survive; the two channel signatures (A2B1, A1B2) are exactly
how ordered communication survives the constraint.

**T2 — the causal bound, exhausted** (`src/game/classical.ts`, `exp2`): all
4,096 + 4,096 deterministic strategies (both orders, all message/guess
functions) enumerated; the maximum is **exactly 3/4**. Shared randomness is a
convex mixture and cannot move a linear cap.

**T3 — the violation, executed** (`src/game/quantum.ts`, `exp3`): the OCB
protocol on the exact process Born rule:

| process | P(x=b) | P(y=a) | p_success | anchor |
| --- | --- | --- | --- | --- |
| mixed (¼)·1 | 0.5 | 0.5 | 0.5 | 0.5 |
| channel A≺B | 0.5 | **1.000000000000** | 0.75 | 3/4 |
| W\*(1/√2) | 0.8536 | 0.8536 | **0.853553390593** | cos²(π/8) |

The causal channel delivering *exactly* the classical cap is the punchline in
one row: Bob reads a off the identity channel, Alice stays blind. W\* breaks
the cap on **both** branches at once — that is what no definite order can do.
Noise blend is linear (Born rule), crossing 3/4 at exactly η = 1/√2.

**T4 — optimality beyond rotated measurements** (`src/game/strategy.ts`,
`src/game/certificate.ts`, `exp4`; new in v0.2.0): family F_q = all
binary-outcome TPCP instruments on qubit in/out per lab — general POVMs with
sharpness and axis per local input, general mixed-state encodings, entangled
CJ elements, shared ancillas reduced to PSD+TP elements. On W\*(1/√2) the
functional relaxation gives P_A ≤ ½(1+c2), P_B ≤ ½(1+c1) independently (every
lemma is a PSD/TP constraint), the OCB protocol attains both at once, hence
**sup over F_q = cos²(π/8) exactly** — with the certificate chain (Born rule
== functional decomposition == closed form, checked to 1e-16 including
entangled-element probes) replacing v0.1.0's rotated-family grid. A
deterministic 640-start line-search sweep never exceeds it. The biased
functional ℐ_α = P_A + α·P_B on the PSD-boundary family S_OCB,α saturates
LC25's exact ICO bound (1+α+√(1+α²))/2 at every α probed.

**T5 — the OCB12 equivalence, machine-checked** (`src/process/ocb12.ts`,
`exp5`; new in v0.2.0): OCB12's eq. (7) transcribed as an independent code
path is the SAME operator as the machine-derived W\* (max elementwise
deviation 2.8e-17); LC25's S_OCB,1 is the same operator a third time; and
the payoff functional derived twice — executed process Born rule vs their
eq. (26) closed forms — agrees on all 16 branch-table entries to 1.1e-16.
Tamper controls (a σ_x→σ_y mistranscription, a 0.69 coefficient) are VALID
processes that only the comparison rejects: the fake-equivalence smuggling
trial has teeth.

## Reproduce

```
npm install
npm test        # 19/19
npm run repro   # ~20 s — rebuilds all five reports (exp4's sweep dominates)
```

## Honest boundaries

1. **The OCB12 equivalence is machine-checked (v0.2.0; retired boundary).**
   v0.1.0 said "the explicit W of OCB12 was not transcribed; unitary
   equivalence plausible but not claimed". Their eq. (7) is now transcribed
   (src/process/ocb12.ts) and is elementwise the repo's machine-derived W\*;
   the payoff functional is derived twice (executed Born rule vs their eq. 26
   closed forms) and agrees entrywise. Residual convention risk — their CJ
   transpose convention matching ours — is exactly what the eq. (26) table
   check pins down.
2. **The classical cap for quantum strategies on causal processes** is cited
   (OCB12), not re-proven: we execute the classical exhaustive sweep (the
   exact diagonal sector of the ARA15 separability SDP) and the OCB protocol
   on two constructed causal channels; the general statement rides on the
   citation. A zero-dependency exact-arithmetic SDP solver for the full
   quantum separability problem is documented as out of reach in
   docs/theory.md (the reduction); the witness-evaluation face lives in
   ../switch-sched (its T5) and LC25's theorem now bounds the game value
   over all processes — both cited, not duplicated.
3. **The pattern rule is derived, not transcribed** — it is the machine face
   of OCB12's linear constraints; if their Fig.-3 characterization and our
   F1–F3 disagree somewhere, the derivation in the validity.ts header is the
   auditable artifact.
4. **No physical implementation is claimed.** The quantum switch is causally
   nonseparable but does NOT violate causal inequalities (VDL23); W\* is a
   formalism-level object — the strongest statement here is about the
   formalism, not about any lab.
5. **Optimality: proven within family F_q** (all qubit-lab instruments on the
   process W\*, exp4) — a proof with certificates, superseding v0.1.0's
   rotated-family grid. NOT claimed in-repo: optimality over
   higher-dimensional labs or other processes — that is LC25's theorem
   (exact ICO bound of the OCB inequality over arbitrary dimensions and
   operations), cited.

## Related

- `../switch-sched` (#8 — the switch's theorem layer; its T5 shipped the
  causal-witness evaluation face, this repo's T4/T5 keep to strategy-space
  optimality and literature equivalence — no overlap; its scheduling contact
  surface stands: communication YES (ESC), decision YES (here), scheduling
  gated (there))
- `../bqp-map` (the atlas: `order-as-resource` carries this repo as a
  cross-prototype certificate)

## Bibliography (web-verified, two independent sources each)

- **OCB12** — Ø. Oreshkov, F. Costa, Č. Brukner, "Quantum correlations with
  no causal order", Nat. Commun. 3:1092 (2012). doi:10.1038/ncomms2076.
  arXiv:1105.4464. [Full text read at enrollment time; eqs. (7) and (26)
  transcribed and machine-checked in v0.2.0 exp5.]
- **ARA15** — M. Araújo, A. Feix, F. Costa, Č. Brukner, "Witnessing causal
  nonseparability", New J. Phys. 17, 102001 (2015). arXiv:1506.03776.
- **LC25** — Z. Liu, G. Chiribella, "Tsirelson bounds for quantum
  correlations with indefinite causal order", Nat. Commun. 16, 3314 (2025).
  doi:10.1038/s41467-025-58508-9. arXiv:2403.02749. [Exact ICO bound of the
  OCB inequality 1+1/√2 over arbitrary processes and operations; the biased
  curve (1+α+√(1+α²))/2 and the attaining S_OCB,α are executed against exp4.
  Verified via arXiv + nature.com.]
- **VDL23** — T. van der Lugt, J. Barrett, G. Chiribella, "Device-independent
  certification of indefinite causal order in the quantum switch",
  Nat. Commun. 14, 5811 (2023). doi:10.1038/s41467-023-40162-8.
  arXiv:2208.00719. [Isolated switches do not violate causal inequalities.
  Article number corrected in v0.2.0 — v0.1.0 (and ../switch-sched's
  citations) say 5807, which does not identify this paper; verified via
  PMC + Inspire.]

MIT. TypeScript strict mode, zero runtime dependencies, NodeNext, node:test.
