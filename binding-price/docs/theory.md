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

## The sellable goods

Perfect concealment is genuinely purchasable (the entangled cheater hides at T = 0 — at the pinned reveal ½). Tamper detection 1 − (3/4)^m prices the Wiesner-pad economy, two arithmetic paths. The pad's χ = 0 stays anchored in quantum-mech's T2. The market's shelves are real; binding just is not on them.

## Implementation notes

All probabilities go through the kernel's matrix product and trace — the hand-expanded element arithmetic had a real-part sign slip in the complex quadrant (batch 26; batch 10's lesson recurring), caught by the identity sweep at 1.5e-1 and fixed by routing through mMul/mTrace. The complex-quadrant test keeps that guard: anti-aligned announcements underpass ½, the identity's sign face.

## Citations

**None new.** HJW93, WZ82, and the BB84 separations stay anchored in quantum-mech's verified bibliography; the no-signaling marginal in nosignal-tariff's. The appeal court for every row is this repo's `npm test`.
