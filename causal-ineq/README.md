# causal-ineq — The causal inequality, executed

Roadmap #9 (epoch-2 deepening): the theorem layer of the Oreshkov-Costa-Brukner
process matrix framework, machine-verified. The claim on trial: *there are
correlations with no causal order* — a "causal inequality" that every definite
order satisfies and a valid quantum process violates.

What exists in the literature: the framework and the causal game (OCB12),
SDP-based causal witnesses (ARA15), photonic causal-nonseparability
experiments. What did **not** exist — and what this repo delivers — is the
certificate layer:

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
  protocol on it delivers exactly cos²(π/8).

## The three layers

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
Noise blend is linear (Born rule), crossing 3/4 at exactly η = 1/√2; the
z-basis is grid-verified optimal within the rotated-measurement family
(closed form ½(1+cosθ/√2) anchored).

## Reproduce

```
npm install
npm test        # 9/9
npm run repro   # <1 s — rebuilds all three reports
```

## Honest boundaries

1. **W\* is constructed, not quoted.** The explicit W of OCB12 was not
   transcribed (their eq. 7); ours was derived from the allowed-pattern
   constraints and delivers their game value exactly. Unitary equivalence to
   their W is plausible but NOT claimed or checked.
2. **The classical cap for quantum strategies on causal processes** is cited
   (OCB12), not re-proven: we execute the classical exhaustive sweep and the
   OCB protocol on two constructed causal channels; the general statement that
   no quantum strategy on any causally separable W exceeds 3/4 rides on the
   citation. (SDP witnesses — ARA15 — are the general tool; out of scope, cited.)
3. **The pattern rule is derived, not transcribed** — it is the machine face
   of OCB12's linear constraints; if their Fig.-3 characterization and our
   F1–F3 disagree somewhere, the derivation in the validity.ts header is the
   auditable artifact.
4. **No physical implementation is claimed.** The quantum switch is causally
   nonseparable but does NOT violate causal inequalities (VDL23); W\* is a
   formalism-level object — the strongest statement here is about the
   formalism, not about any lab.
5. cos²(π/8) is not known to be the maximum (OCB12 leave the maximal
   violation open); our optimality claim is only within the
   rotated-measurement family, grid-verified.

## Related

- `../switch-sched` (#8 — the switch's theorem layer; its T3 found the
  scheduling contact surface this repo's game result completes: communication
  primitives YES (ESC), decision primitives YES (here), scheduling primitives
  gated (there))
- `../bqp-map` (the atlas: `order-as-resource` carries this repo as a
  cross-prototype certificate)

## Bibliography (web-verified)

- **OCB12** — Ø. Oreshkov, F. Costa, Č. Brukner, "Quantum correlations with
  no causal order", Nat. Commun. 3:1092 (2012). doi:10.1038/ncomms2076.
  arXiv:1105.4464. [Full text read at enrollment time.]
- **ARA15** — M. Araújo, A. Feix, F. Costa, Č. Brukner, "Witnessing causal
  nonseparability", New J. Phys. 17, 102001 (2015). arXiv:1506.03776.
- **VDL23** — J. van der Lugt et al., Nat. Commun. 14, 5807 (2023).
  [Isolated switches do not violate causal inequalities; verified in this
  workspace earlier today — see ../switch-sched/docs/citations.md.]

MIT. TypeScript strict mode, zero runtime dependencies, NodeNext, node:test.
