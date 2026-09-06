# causal-ineq — Theory Layer

Roadmap #9: the causal inequality, executed. Position and derivations, so
every machine check can be audited against its source idea.

## Position (prior work, honestly drawn)

The process matrix framework is OCB12's; the causal game and its cos²(π/8)
violation are theirs. Causal witnesses and the SDP methodology are ARA15's.
Photonic causal-nonseparability experiments exist (Goswami et al. 2018,
verified in ../switch-sched). What nobody had done, as of enrollment day
(searched: proof-assistant formalizations — none; executable certificate
layers — none; only floating-point SDP research code):

1. exhaust the classical causal strategies of the game (all 8,192
   deterministic strategies, cap exactly 3/4 — exp2);
2. execute the process Born rule with closed-form anchors (exp3);
3. make the validity constraints an executable checker with negative
   controls (exp1);
4. derive a violating process from the constraints themselves (W\*,
   machine-derived, value exactly cos²(π/8)).

## The validity rule, derived

For W on A1⊗A2⊗B1⊗B2 (dims 2): total probability Tr[W(T_A ⊗ T_B)] = 1 for all
TPCP instrument pairs. A TPCP total CJ satisfies Tr_{A_O}[T] = 1_{A_I};
perturbing by X with Tr_{A_O}[X] = 0 stays TPCP to first order (PSD interior).
In Pauli components, Tr_{A2}[X] = 0 ⟺ X has only components with a nontrivial
A2 operator. Hence W must be orthogonal to X ⊗ (anything spanning T_B) and
symmetrically for Bob, giving the three forbidden families:

- F1: A2-operator with B trivial (k≠0, l=m=0) — any j;
- F2: B2-operator with A trivial (m≠0, j=k=0) — any l;
- F3: A2 and B2 together (k≠0 and m≠0).

Seven nontrivial support signatures survive: A1, B1, A1B1, A2B1, A1A2B1,
A1B2, A1B1B2. Note what the rule *says physically*: a process may carry A's
output to B's input (A2B1) or B's to A's (A1B2), and may correlate inputs
(A1B1), but may NOT pre-correlate a lab's own input with its output (A1A2,
B1B2 forbidden) nor couple outputs to outputs (A2B2-type forbidden). This is
the machine face of OCB12's linear constraints; the derivation above stands
on its own and is the auditable artifact (README boundary 3).

## Why W\* works (the mechanism, in one paragraph)

W\*(c) = ¼[1 + c(Z^{A2}Z^{B1} + Z^{A1}X^{B1}Z^{B2})], c = 1/√2. The first
term (pattern A2B1) is a channel-like correlation: Bob's z-measurement of B1
reveals Alice's z-encoded a — the b′=1 branch. The second term (pattern
A1B1B2) is three-body: Bob's x-outcome t enters twice (his encoding b⊕t and
the correlation) and cancels, (−1)^{x+b+t+t}, so Alice's z-measurement of A1
reveals b regardless of t — the b′=0 branch. The two Pauli products
anticommute (they share B1 with Z vs X), each squaring to 1, so (T1+T2)/√2
has eigenvalues ±1 and W\* has eigenvalues exactly {0, ½}: PSD with
certificate precision, trace exactly 4. The c-window for PSD is c ≤ 1/√2 (at
which the value saturates cos²(π/8)) — the game value and the PSD window meet
at the same point, which is why the construction is tight.

## The causal bound, why exactly 3/4

exp2 enumerates: in A≺B, Bob can receive Alice's message and win b′=1
always, but Alice's guess for b′=0 is independent of b — half the game is a
blind guess; symmetrically for B≺A. Randomized/shared-randomness strategies
are convex mixtures of deterministic ones and inherit the cap by linearity.
The executed cap (max over all 8,192 strategies = 0.750000000000) is the
certificate; the OCB12 theorem extends it to quantum strategies on causally
separable processes (cited, boundary 2).

## Honest boundaries

As in the README: W\* is constructed not quoted (unitary equivalence to OCB12's
explicit W not claimed); the quantum-on-causal cap is cited not re-proven; the
pattern rule is derived not transcribed; no physical implementation claimed
(the switch does not violate causal inequalities — VDL23); the maximal
violation is open and our optimality is only within the rotated-measurement
family.

## Bibliography

See README — every id web-verified (OCB12 by full-text read; ARA15 via
Branciard's reference list fetched today; VDL23 verified in this workspace
earlier today, see ../switch-sched/docs/citations.md).
