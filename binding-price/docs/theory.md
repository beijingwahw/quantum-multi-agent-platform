# Theory — one object, two prices, no market for the second

## The object

A commitment's reveal: the promisor announces a pure state |a⟩ (a basis member), the verifier measures their own register in that basis. The pass probability is

  Tr[|a⟩⟨a| ρ_V] = (1 + a·r)/2,

with r the Bloch vector of the verifier's marginal ρ_V. Everything in row #13's market follows from this one line.

## Why privacy and binding are one coin

Concealment demands ρ_V → I/2 (r → 0): nothing about the commitment may be readable from the verifier's side — which is precisely the no-signaling marginal (nosignal-tariff's T3 face). But the binding slack is (a·r)/2 — the same r. So:

  binding slack = concealment loss (one-to-one, linearly)

Buying privacy polarizes the marginal toward I/2 and thereby pins the reveal at exactly ½. They are not two goods at a steep exchange rate; they are one object with two price tags. The classical cheater's 0.853553 = ½(1+1/√2) is the frontier point r = 1/√2 — quantum-mech's BB84 constant re-derived as a coordinate on this line.

## Why the supply of binding is flat at zero

The promisor's HJW freedom — the choice of decomposition of I/2 into announced members — steers the verifier's *conditional* states (the correlations are real) but cannot move the *marginal* (the no-signaling law). Since the reveal statistic depends only on the marginal (through the identity above), no strategy in the entire convex space of decompositions changes the pass probability: random bases, the tetrahedral SIC, mixed-member ensembles — TV = 0 and deviation = 0, machine-witnessed. "Binding is not sold" is therefore not a high price; it is an absent market, and the absence is the same fact as the privacy guarantee. An asserted impossibility without this witness would be marketing (M2).

### v0.2.0 — the supply beyond enumeration

v0.1.0 witnessed the flatness over 26 enumerated families. The continuous upgrade states one family precisely and sweeps it exhaustively:

- **Pairs** {¼ ±u, ¼ ±v}: every equal-weight union of two antipodal Bloch pairs cancels identically, so the whole 4-parameter family consists of decompositions of I/2. Grids: 61 × 25 Fibonacci points. Parameter points include the degenerate basis pair (v = ±u) and the great square (u ⊥ v). The regular tetrahedron is *not* of this form (its six pairwise dots are all −1/3; a pair family realizes dots {±u·v}) and stays in the enumerated families.
- **Geodesic** {¼ ±u₀, ¼ ±v(α)}: v(α) sweeps the full great arc from +u₀ to −u₀, 91 points — one continuous parameter interpolating the family's extremal points (collapse → square → collapse).
- **Refinements** {w·I/2, (1−w)/2 ±a}: the convex-hull face of the HJW freedom (any decomposition refinable through the mixed state), 21 × 25.

2141 ensembles, every one machine-verified: worst marginal TV 8.3e−17, worst reveal deviation 1.1e−16 — floating floor. The general HJW theorem (every decomposition of I/2) remains cited through quantum-mech, not re-proven.

## v0.2.0 — the coin under noise (the exact census)

The commit channel E_γ (dephasing γ ∈ [0, ½] or damping γ ∈ [0, 1]) acts on the verifier's register. The census, all machine-measured:

- **Survives — the equation.** The identity Tr[|a⟩⟨a| E_γ(ρ)] = (1 + a·r')/2 with r' the *output* Bloch vector holds exactly for every channel and strength (maxdev 1.7e−16): the identity is algebra in one object and is channel-agnostic.
- **Survives — the flatness.** By CPTP linearity E_γ(Σ wᵢρᵢ) = Σ wᵢ E_γ(ρᵢ): every decomposition of I/2 lands on the same E_γ(I/2) (worst TV 1.3e−16 across 429 sampled strategies × 10 channel settings). No strategy gains an edge from noise — the supply curve stays *flat*; what moves is its level.
- **The level.** Dephasing is unital: E_γ(I/2) = I/2, the reveal floor stays exactly ½ (2.2e−16). Damping is not: E_γ(I/2) is polarized at γ z, so each member's reveal becomes (1 + γ m_z)/2 (maxdev 1.1e−16) — up to certainty for axial announcements at γ = 1. The coin the market flips is no longer fair; it is the channel's coin.
- **Bends — the one-to-one, dephasing.** For oblique inputs (r between the dephasing axis and the equator) the output polarization rotates away from the input direction; an announcement aligned with the *input* underperforms by the wedge loss·(1 − cos θ_out) — 0.103553 at r = (1,0,1)/√2, γ = ½ (slack ¼ vs loss √½/2). Slack = loss survives only for announcements aligned with the *output* polarization.
- **Breaks — the one-to-one, damping.** Non-unital: a perfectly concealed input (loss 0, slack 0) exits with loss γ/2 *exactly* (maxdev 2.8e−17 — quantum-mech v0.2.0's HJW-under-noise census found T = γ/2 on the same footing), and announcing along the channel's axis yields the matching slack γ/2. The channel confiscates privacy the promisor never sold and mints binding they never bought — at the output, the minted pair still satisfies the identity (it is one coin); what broke is the input↔output correspondence.

## v0.2.0 — two coins (the honest boundary of the flat supply)

Bounded census over 63 two-coin strategies: product decompositions {¼(±u⊗±v)}, the four-Bell ensemble, locally rotated Bell ensembles, and Schmidt interpolations {½ψ(t), ½ψ'(t)} with ψ(t) = cos t|00⟩ + sin t|11⟩ against its swap-flip. Findings:

- **Per-coin flat persists**: every strategy, every coin, marginal exactly I/2 (2.2e−16) and per-coin reveal exactly ½ (2.2e−16), at every Schmidt coefficient — one-coin concealment does not degrade with entanglement structure.
- **The joint good is movable**: strategies whose coins are each perfectly concealed still differ in the joint product-announce pass — ¼ for the I/4-decompositions, ½ for the Schmidt family at the fixed (z,z) announcement. The joint statistic is priced by *correlations*, and correlations are steerable (the very HJW freedom the no-signaling marginal does not constrain). The one-coin coin does not mint a two-coin coin; this is the flat-supply theorem's boundary, reported as found.

## The sellable goods

Perfect concealment is genuinely purchasable (the entangled cheater hides at T = 0 — at the pinned reveal ½). Tamper detection 1 − (3/4)^m prices the Wiesner-pad economy, two arithmetic paths. The pad's χ = 0 stays anchored in quantum-mech's quantum-OTP invariance (locked ensembles identical across payloads — matrix identity, and noise-proof since any CPTP map preserves the equality). The market's shelves are real; binding just is not on them.

## Implementation notes

All probabilities go through the kernel's matrix product and trace — the hand-expanded element arithmetic had a real-part sign slip in the complex quadrant (batch 26; batch 10's lesson recurring), caught by the identity sweep at 1.5e−1 and fixed by routing through mMul/mTrace. The complex-quadrant test keeps that guard: anti-aligned announcements underpass ½, the identity's sign face.

v0.2.0 adds a second catch of the same species: `blochOf` returned the *flipped* y-polarization (read −2·Im[1][0] instead of +2·Im[1][0]). It was masked in v0.1.0 because every caller dotted TWO blochOf outputs and the double flip cancelled; the noise census mixes a raw direction tuple with a single blochOf and exposed it at first run (deviation 6.6e−1). Fixed, with a roundtrip regression test (blochOf∘blochState = id, one at a time). Lesson restated: closed forms go through the kernel, and utilities are only proven correct by the asymmetric use, never by the symmetric one.

## Citations

**Adopted as anchors (v0.2.0), verified from two independent sources each:** van Luijk et al., *Quantum steering is equivalent to state-preserving conditional expectations*, arXiv:2608.10783 (2026); Wang, Meng, Dahlsten, *Non-unique decompositions of mixed states and deterministic energy transfers*, arXiv:2509.04235 (2025), Phys. Rev. DOI 10.1103/12b6-hw2h. Nothing in this repo re-proves or depends on either; HJW93, WZ82, the Mayers–Lo–Chau no-go, and the BB84 separations stay anchored in quantum-mech's verified bibliography; the no-signaling marginal in nosignal-tariff's. The appeal court for every row is this repo's `npm test`.
