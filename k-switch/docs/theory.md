# Theory — derivations behind the certificates

All statements below are machine-checked in `test/` and `experiments/`; the
derivations are given so every closed form in the reports can be audited by
hand. Conventions: control basis |π⟩ indexed by permutations in listing
order (S3 in `switch.ts`, S4 in `k4.ts`); box seq[0] is applied first, so
the order product is U_{seq(k)}···U_{seq(0)}.

## 1. The switch isometry and the k = 3 parity law (v0.1.0, kept)

M = Σ_π |π⟩⟨π| ⊗ P_π is block-diagonal with unitary blocks, so M†M = I
(certificate: 24-dim at k = 3, 96-dim at k = 4, max deviation < 1e-12).
Pairwise-anticommuting boxes: reordering the product from the identity order
to π costs inv(π) adjacent transpositions of anticommuting factors, each
contributing −1, so P_π = (−1)^{inv(π)}·P_id = sgn(π)·P_id — exact at every
k, machine-checked for all 6 orders (k = 3) and all 24 (k = 4, deviation
0.00e+0 on the canonical instance and on all 30 census anticommuting
quadruples). With control |u⟩ = Σ_π |π⟩/√k!:

- commuting: every P_π identical → ρ_c = |u⟩⟨u| exactly;
- anticommuting: P_π = sgn(π)P → the branch states differ only by the real
  sign sgn(π), so ρ_c = |u_sgn⟩⟨u_sgn| with |u_sgn⟩ = Σ_π sgn(π)|π⟩/√k!.

S_k splits evenly (k! even / k! odd for k ≥ 2), so ⟨u|u_sgn⟩ = 0 exactly:
(3−3)/6 at k = 3, (12−12)/24 at k = 4. **The readout is deterministic at
both depths, dimension-free** — no d ≥ N! (that bound belongs to ARA14's
all-order phase identification, which we still do not claim).

Subtlety (machine-taught, exp3 D): the even/odd parity PROJECTION alone is
NOT the discriminator — both ρ_c have uniform diagonals (1/k! each), so
P(even) = 1/2 on both classes. The deterministic readout is the control-STATE
discrimination ⟨u|ρ|u⟩ vs ⟨u_sgn|ρ|u_sgn⟩ (1/0 vs 0/1, exact). The
single-order projector table: 1/24 for every π on both classes — the order
basis carries nothing.

## 2. The d = 4 necessity and the Pauli census no-go

Four pairwise-anticommuting unitaries need d = 4 (a qubit carries at most
X, Y, Z). At d = 4 the canonical anticommuting quadruple is
{X⊗I, Y⊗I, Z⊗X, Z⊗Z} (commutator modulus 2 on all six pairs), with
identity-order product ∝ Z⊗Y.

**No pairwise-commuting Pauli quadruple exists at d = 4**: a maximal abelian
subgroup of the 2-qubit Paulis has order 4 (2^n) of which 3 are non-identity.
Machine census over C(15,4) = 1365 quadruples: **0 commuting, 30
anticommuting, 1335 mixed** — the counts are certificate-checked
(`verifyQuadCensus`). Consequence: the k = 3 canonical blindness pair (both
classes Pauli, products −I vs iI) has NO k = 4 analogue inside the Pauli
universe — matched pairs (same product Pauli ray) inside it: 0. The
commuting promise class at k = 4 is necessarily non-Pauli; the canonical
instance is four rotations e^{iθG} of one involutory Pauli generator G with
θ ∈ {π/24, π/8, π/12, π/4} (Σθ = π/2), whose every-order product is
e^{iΣθ G} = i·G exactly. Constructed matched pair: rotate the anticommuting
product's OWN Pauli G = Z⊗Y — products i·G vs ±G share a ray, and all 24
plain orders are blind between the two classes (max trace distance 0.00e+0).
(Build lesson: the first construction rotated the wrong generator (Z⊗X) and
the machine rejected it at max T = 0.918 — the generator is now derived
from the anticommuting product, not assumed.)

## 3. The TCA+21 Hadamard promise face at d = 2 (exp4)

Order quartet Σ = {ABCD, BADC, CBDA, DACB} (the fiber experiment's), the
Sylvester H₄ (rows = outcomes, columns = order index). Promise for column
y: Π_x = m_{x,y}·Π_0 for all x ∈ Σ. Algorithm 1: control |0⟩ → H₄ →
quartet switch → H₄⁻¹ = H₄ᵀ = H₄ → measure. After the switch the control
amplitudes are (1/2)·m_{x,y}; the second H₄ maps them to
(1/2)Σ_x H₄[y′][x]·m_{x,y} = δ_{y′,y} — outcome y with probability 1, one
use of each gate, target a single qubit (TCA+21's theorem; executed here on
every census set: worst deviation 0.00e+0).

Census (ours, honest scoping): ALL 256 ordered sets {I,X,Y,Z}⁴ — 136
satisfy, per column 52/36/24/24, 120 fail. TCA+21's Table 2 "30 sets" is
their filtering (not fully specified in the text we fetched) — we do not
reproduce it and claim nothing about it beyond the shared quartet/H₄.

## 4. The supersequence query bound (bounded, strategy-specific)

A fixed-order circuit that simulates the quartet switch by applying each
promise instance as a supersequence must contain every order of Σ as a
subsequence. Exhaustive enumeration (4^len strings, len ≤ 9): the minimum
length is **9** — 104 minimal witnesses; TCA+21's ACBADACDB checks. So the
supersequence strategy costs 9 uses to the switch's 4. This is a bound for
ONE simulation strategy on ONE quartet — NOT the general fixed-order lower
bound (ARA14's quadratic theorem; Bavaresco et al. 2024/2025's exponential
switch-simulation hardness — both cited, neither re-proven).

## 5. The exact distinguishability matrix

For promise columns (y, y′) and a plain order π: products Π_π^{(set)} are
Pauli words, so two outputs through π are same-ray (max-input trace
distance 0) or distinct-ray (max-input distance 1, achieved by an input
superposition of the Pauli eigenstates) — entries are exact 0/1. Game
entry = 1 iff EVERY (set, set′) pair is distinct-ray through π. Machine
verdict: **all 144 entries 0** — for every π and pair, matched sets exist
with same-ray products (e.g. a single-gate set pins every order's product
to the same Pauli). No plain order decides the promise; the switch readout
does, deterministically. Interleaving probe (sampling, not proof): random
W's between the four uses DO distinguish the canonical binary instances
(max ≈ 1.0, same as k = 3) — the structural blindness claim covers plain
consecutive orders only.

## 6. The scheduling contact law, k = 3 → k = 4

Chain alloc₁(X)–alloc₂(Z)–alloc₃(Y)–exec(γ), input |+⟩, distinguish γ = 1
vs γ = 0; D = trace distance of the register.

Fixed orders: every prefix of the writes keeps |+⟩ in the |±⟩ plane (X, Z
fix both; Y exchanges them up to phase), so at the erasure the two
hypotheses hold T = T(|0⟩, |±⟩) = 1/√2, and unitary stages after it cannot
change trace distance → **D = 1/√2 for all 24 orders exactly** (survives
k = 3).

Switch mixture: γ = 0 branches all end in |−⟩⟨−| (the single Y flips |+⟩ to
|−⟩ wherever it sits; X/Z only phase). γ = 1 branches: E-last and E-first
orders end |0⟩⟨0| (6 + 6); for E in the middle the suffix writes move |0⟩
to |0⟩ or |1⟩ — counting the 24 orders gives 16 branches on |0⟩ and 8 on
|1⟩, i.e. σ₁ = (2/3)|0⟩⟨0| + (1/3)|1⟩⟨1|. Then

```
D(switch, k=4) = T(σ₁, |−⟩⟨−|) = √((1/6)² + (1/2)²) = √10/6 = 0.527046276695
```

machine-checked to 1e-12. **The k = 3 halving law D(switch) = D(fixed)/√2
does NOT survive**: the dilution at k = 4 is √5/3 ≈ 0.7454, not 1/√2 ≈
0.7071 — the mixture constant is family-and-k-specific (at k = 2 the
two-box layer reported 1/2). Where it matters the verdict is unchanged:
D(switch) < D(fixed) strictly, for every fixed order, at k = 2, 3, 4.

## 7. What would falsify / extend this layer

- A pairwise-anticommuting quadruple whose order products violate
  P_π = sgn(π)·P_id (would kill §1 at k = 4) — none: 30/30 census quadruples
  exact.
- A pairwise-commuting Pauli quadruple at d = 4 (would falsify the §2
  no-go) — none in the exhaustive 1365.
- A plain fixed order that separates some promise column pair in the worst
  case (would falsify §5) — none in the 144-cell game matrix.
- A supersequence of length ≤ 8 for Σ (would falsify §4) — none: all 4^8
  strings checked.
- Extending the parity law to k ≥ 5: control dimension 120, system d ≥ 8
  (five pairwise-anticommuting unitaries) — natural next layer, not
  executed here.
- The general fixed-order lower bound for the Hadamard promise (beyond the
  supersequence strategy) and TCA+21's SDP causal-separability witnesses —
  out of scope (no SDP solver under the zero-dependency law), cited.
- The k ≥ 5 scheduling mixture constant: predicted by the same
  counting argument (σ₁ = (a·|0⟩ + b·|1⟩)/24 for computable a, b) —
  machine-checkable when the k = 5 layer is built.
