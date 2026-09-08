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

v0.2.0 adds two faces with the same posture:

5. the optimality proof within all qubit-lab instruments (family F_q) by
   functional relaxation — executed, not sampled (exp4);
6. the machine-checked equivalence of the derived W\* with OCB12's
   transcribed eq. (7) and LC25's S_OCB,1, and of both payoff derivations
   (exp5).

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

exp2 enumerates: in A≺B, Bob can receive Alice's message and win b'=1
always, but Alice's guess for b'=0 is independent of b — half the game is a
blind guess; symmetrically for B≺A. Randomized/shared-randomness strategies
are convex mixtures of deterministic ones and inherit the cap by linearity.
The executed cap (max over all 8,192 strategies = 0.750000000000) is the
certificate; the OCB12 theorem extends it to quantum strategies on causally
separable processes (cited, boundary 2).

## The qubit-lab relaxation bound (T4, new in v0.2.0)

v0.1.0 knew cos²(π/8) only as the rotated-measurement optimum (grid). The
v0.2.0 claim is much larger — within family F_q = ALL binary-outcome TPCP
instruments on qubit in/out per lab (arbitrary local-input dependence,
entangled CJ elements allowed, shared ancillas reduced to PSD+TP elements by
the OCB12 instrument-ancilla argument), no strategy on W* beats cos²(π/8),
and the OCB z/x protocol attains it. Derivation (executed in
src/game/certificate.ts, every step sampled and checked):

Expand the Born rule with T1 = Z^{A2}Z^{B1}, T2 = Z^{A1}X^{B1}Z^{B2}:

    Tr[W(M^A ⊗ M^B)] = ¼[ m^A m^B + c1·α(M^A)γ(M^B) + c2·β(M^A)δ(M^B) ],
    m = Tr, α = Tr[(1⊗Z)·], β = Tr[(Z⊗1)·], γ = Tr[(Z⊗1)·], δ = Tr[(X⊗Z)·].

Marginalising the branch-irrelevant party kills the cross terms via the TP
zero-sums (Σx βx = Tr[(Z⊗1)Σx M_x] = Tr Z = 0, likewise Σy γy):

    b'=1: P(y=a|a,b) = ¼[ 2 m^B_{y=a} + c1·α^A(a)·γ^B_{y=a} ],
    b'=0: P(x=b|a,b) = ¼[ 2 m^A_{x=b} + c2·β^A_{x=b}·δ^B(b,0) ].

Every remaining quantity obeys PSD/TP lemmas and nothing else: |βx| ≤ m_x,
|γy| ≤ m_y (−1 ⪯ Z⊗1 ⪯ 1); Σx m_x = Σy m_y = 2; |α| ≤ 2 (α = Tr[Zσ], σ ⪰ 0,
Tr σ = 2); |δ| ≤ 2 (|Tr[(X⊗Z)M_tot]| ≤ Tr M_tot). With β1 = −β0 and
γ1 = −γ0 forced, chaining gives

    P_A ≤ ½(1+c2),   P_B ≤ ½(1+c1),

independently per branch — no instrument, however entangled its elements or
coupled across its inputs, escapes the chain, because every input to it is a
PSD/TP constraint on 4-dim elements. The OCB protocol makes both bounds
simultaneously tight (α = ±2 pure z-encodings; |βx| = |γy| = 1 sharp z; |δ| = 2
x-measurement with sign-matched encodings), so sup_{F_q} = ½(1+1/√2) =
cos²(π/8) EXACTLY. The certificate chain (Born rule == functional
decomposition == closed form, machine-checked to 1e-16 on random and
entangled-element instruments) is what the grid never was: a proof, in-repo.

The biased extension: on W(c1,c2) with ℐ_α = P_A + α·P_B the bound reads
½(1+c2) + α·½(1+c1), maximised over the PSD window c1²+c2² ≤ 1 at
(c1,c2) = (α,1)/√(1+α²) with value (1+α+√(1+α²))/2 — exactly LC25's
ICO bound for the biased OCB inequality, here derived by qubit-lab relaxation
and saturated by the same OCB instruments (exp4 table). The PSD window
(anticommuting T1,T2 ⟹ spectrum (1±√(c1²+c2²))/4) touches the game value
exactly where it saturates: the construction is tight on the boundary.

## The OCB12 equivalence, machine-checked (T5, new in v0.2.0)

v0.1.0 boundary 1 ("the explicit W of OCB12 was not transcribed; equivalence
not claimed") is retired. OCB12's Methods eq. (7) is now transcribed as an
independent code path (src/process/ocb12.ts) and compared elementwise with
the machine-derived W*: they are the SAME operator, term for term
(max deviation 2.8e-17, solver precision), and LC25's attaining S_OCB,1 is
the same operator a third time. The payoff functional is derived twice —
executed process Born rule vs their eq. (26) closed forms ½[1+(−1)^{x+b}/√2],
½[1+(−1)^{y+a}/√2] — with all 16 branch-table entries matching to 1.1e-16.
Tamper controls (σ_x→σ_y mistranscription; a 0.69 coefficient) are VALID
processes that only the comparison catches — the fake-equivalence smuggling
trial in executable form.

## Boundary 2 — why zero-dep exact SDP stays out of reach (documented reduction)

ARA15's causal-witness methodology decides W ∈ Sep = conv(W^{A≺B}, W^{B≺A})
by SDP; the OCB game value over separable processes is such an SDP. An exact
arithmetic version in-repo would need one of: (i) an interior-point solver
over 16×16 complex-Hermitian spectrahedra with rational certificates — but
each iteration brings matrix inverses and Cholesky square roots, algebraic
reals whose degree grows without bound under the separation hierarchy; or
(ii) exact facial/vertex enumeration of the separable spectrahedron — non-
polyhedral at dim 16, with no known exact vertex structure. What CAN be done
exactly, and is done here: the DIAGONAL (classical) sector of the separability
SDP, where PSD ⇔ entrywise nonnegativity, reduces to the causal polytope over
strategies — solved exactly by exp2's integer enumeration (8,192 vertices, cap
exactly 3/4, shared randomness by convexity). The witness-EVALUATION face
(Tr[S W] certificates at fixed S) shipped in ../switch-sched (its T5); and
LC25's theorem now bounds the game value over ALL processes from above,
subsuming the question the OCB witness SDP was asking at the game level
(cited, not re-proven). A zero-dependency exact SDP solver remains out of
scope; this paragraph is the honest reduction.

## Honest boundaries

As in the README: the OCB12 equivalence is machine-checked (elementwise,
v0.2.0); the quantum-on-causal cap is cited not re-proven, with the exact
classical sector executed (exp2) and the SDP reduction documented above; the
pattern rule is derived not transcribed; no physical implementation claimed
(the switch does not violate causal inequalities — VDL23); optimality within
F_q is proven in-repo, optimality over arbitrary dimensions is LC25's theorem
(cited).

## Honest boundaries

As in the README: W\* is constructed not quoted (unitary equivalence to OCB12's
explicit W not claimed); the quantum-on-causal cap is cited not re-proven; the
pattern rule is derived not transcribed; no physical implementation claimed
(the switch does not violate causal inequalities — VDL23); the maximal
violation is open and our optimality is only within the rotated-measurement
family.

## Bibliography

See README — every id web-verified from two independent sources (OCB12 by
full-text read of arXiv:1105.4464v3, eqs. (7)/(26) transcribed; ARA15 via
Branciard's reference list; VDL23 via PMC + Inspire; LC25 via arXiv +
nature.com).
