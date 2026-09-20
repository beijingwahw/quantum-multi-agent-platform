# route-price

Route and price for the two OPEN rows of the atlas — the debt the atlas's own discipline created when it forbade OPEN rows from quoting numbers.

> The visitor's letter, ninth contact: the quoted account of the seventeen claims, ending on the two OPEN rows — "route and price only", the letter's own words for what undemonstrated claims owe. This repo is that debt, paid.

## What ships

One dossier per OPEN row of `../bqp-map/src/atlas/entries.ts`:

- **D1 `dtc-clock`** — "time crystals as the clock wall, zero-energy eternal beat". The zero-energy half is closed by the equilibrium no-go (WO15); the driven route is real (WIL12 → MI22) and pays a power cord every period. Since v0.2.0, the two priced milestones are EXECUTED by `../dtc-clock` (M3 the beat-keyed clock register, M4 the energy certificate) — each carrying an execution record backed by this repo's own cross-check (W-D, W-E). The hardware power cord (D1-P3) stays unquoted with a sharpened boundary: every in-model face is metered; the drive's dissipated joules are an experiment's number.
- **D2 `choice-primitive`** — "'choice' as a language primitive, the desired world as a stable solution". The legal boundary is executed (coherent control steers, never broadcasts — no-cloning as a rephasing-covariance separation); stability is engineered invariance, not a syntax default; the certification toll is the epoch-3 postselection ledger re-invoiced. The Noether question is answered at the mechanism-design layer since `../dsic-noether` shipped the Groves gauge group and its welfare-gap charge (M4 executed, cross-check W-F) — the language-level charge remains unidentified and unpriced.

## The laws (src/kernel/audit.ts)

| law | content |
| --- | --- |
| R0 | the dossier must be a dossier at all — every column the deeper laws dereference arrives with the promised shape; an unreadable column or element is named and excused, because a crash is not a rejection |
| R1 | every milestone books a price; every price line carries an amount — numbers never travel without costs |
| R2 | the only expressible verdict is `OPEN-ROUTE` — **this repo cannot settle anything, by construction** |
| R3 | every milestone names its own falsifier — a route without a failure mode is marketing |
| R4 | every citation resolves in the verified bibliography; every local anchor exists on disk |
| R5 | the executable witnesses pass — quoted arithmetic is two-path, never transcribed |
| R6 | every dossier anchors to a row that exists in the atlas |
| R7 | every executed milestone pairs its sibling certificate with a PASSING cross-check witness of this repo — a price claimed without its own re-derivation is a counterfeit certificate, rejected by name |

The renderer refuses to print an illegal dossier — and since v0.2.1 the refusal itself is a named, coded error (`DossierRejectedError`, code `DOSSIER_REJECTED`) carrying the violations and witness failures structured, not just as prose. The tests include smuggling trials that inject an unpriced milestone, a falsifier-free milestone, a settled verdict, a dead citation, a counterfeit certificate citing a witness that does not exist, an execution hanging off a repo that is missing on disk, a dossier with no milestones column, a milestone whose price column is not a string, and a malformed execution record — each must be rejected by name (the last three under the shape law R0: the checker names what it cannot read instead of crashing on it).

## The witnesses (src/kernel/witnesses.ts)

- **W-A** — the Landauer floor, two-path: k exact (SI 2019), ln2 re-derived by midpoint quadrature of 1/x on [1,2]; the readout meter (T+1)·log2(T+1) priced at three depths, monotone unbounded.
- **W-B** — the choice toy: control-coherence numeric vs closed form; engineered invariance at machine zero vs seeded random programs near the Haar mean; the clone gap (CNOT-pair coherence is rephasing-covariant, a true clone's would not be — no-cloning executable); the certification toll (geometric mean vs 1/P); no leakage of the choice weights into the conditional world.
- **W-C** — the uniform-branch toll: 1/P = B exact on the powers-of-two grid, closed form vs seeded Monte Carlo.
- **W-D** — the beat-register cross-check (backs D1-M3): the driven echo F = e^{-iθΣX}·e^{-iH_zz} rebuilt with this repo's own linalg — F†Z_iF = −Z_i at machine precision for any couplings, trajectory m(k) = (−1)^k, exact register return every 2k periods, and an own TOFFOLI+CNOT 2×2-bit multiplier (11 gates, 13 wires): 16/16 integer-exact, full-cube bijection, bitwise self-reset, 5 garbage wires.
- **W-E** — the energy-certificate cross-check (backs D1-M4): orbit energy flat (zero net work on the ideal beat), the detuned first period's closed form W₀ = J(n−1)sin²2δ re-derived (0.256552), the isolated stroboscope's true coherent law |⟨Z⟩_k| = |cos 2kδ| (an honest correction of the geometric envelope), and the tariff table re-priced on this repo's own netlist: 0 < 5 < 9 < 43.02 kT·ln2 units.
- **W-F** — the welfare-gap charge cross-check (backs D2-M4), in exact BigInt rationals (`src/kernel/exact.ts`): the gap equals the closed-form charge −(n−1)(s−t)²/(2n) bitwise, zero exactly at truth, gauge-invariant along the Groves orbit, and the off-gauge payment's profitable deviation worth exactly ε²n/(2(n−1)) at s* = t − εn/(n−1). The tests carry the independent float path on binary-exact grids.

## The clone gap as a commutant certificate (v0.4.0)

W-B's numerical clone mark (the pair coherence is rephasing-invariant while a
clone's target rotates at twice the rate) is upgraded to an algebraic
certificate in `src/kernel/covariance.ts` (`test/covariance.test.ts`, nine
tests), all on this repo's own linalg:

- **CV1** — the triple equivalence: a qubit channel commutes with rephasing
  conjugation ⟺ its Choi matrix commutes with U_φ⊗Ū_φ for every φ ⟺ its
  Choi entries live on the integer band m−n = i−j. Checked on a table of
  eight channels (identity, dephasing, ZρZ, amplitude damping — covariant;
  XρX, YρY, two seeded random conjugations — not). The machine corrected the
  spec-era expectation twice, both corrections pinned in the test: ZρZ and
  amplitude damping ARE rephasing-covariant (diagonal Kraus structure).
- **CV2** — the CNOT pair channel is one-wire rephasing-covariant at machine
  zero, clones the diagonals bitwise, and is not a clone of |+⟩ — the
  covariant-but-not-cloning control that must pass.
- **CV3/CV4** — cloning four seed states (|0⟩, |1⟩, |+⟩, |+i⟩) pins a
  channel's basis images at exact dyadic-plus-i values (every entry a
  quarter of a Gaussian integer); the pinned images carry 16 nonzero entries
  off the one-wire band and 16 off the two-wire band, smallest magnitude ≥
  ¼. A cloner of all pure states would be pinned, covariant on pure states
  (each U_φ|ψ⟩ is pure again), hence fully covariant by the spanning bridge,
  hence banded — contradiction. No-cloning with the covariance commutant
  doing the convicting.
- **CV5/CV6** — the null-space census (one-wire band frees 24 of 64 Choi
  entry positions, two-wire frees 20) and the W-B tie: the clone's
  |00⟩⟨11| face rotates at exactly −2φ while any linear map's is a rate-1
  mix — the numerical gap is the band structure on one entry.
- **NC3** — the negative control: band-laundering the pinned images
  (deleting off-band entries) satisfies the band but breaks cloning — the
  covariant family and the clone-pinned family are jointly infeasible.

Malformed basis images are refused by name (`COVARIANCE_SHAPE`); the
certificate is deterministic. The W-B witness itself keeps running unchanged
— this table upgrades its reading, it does not replace the gate.

## Run

```
npm install
npm test        # laws + witnesses + smuggling trials + the clone-gap certificate
npm run repro   # renders out/reports/the-dossier.md (refuses illegal dossiers)
npm run typecheck
```

## Honest boundaries

- Nothing here is settled, and nothing here can be: the type system, the checker, and the renderer each independently refuse settledness. Two rows entered OPEN and leave OPEN — executions reprice milestones, they do not settle the rows.
- An executed milestone is only as good as its cross-check: R7 requires the sibling repo on disk, a named certificate, and a passing witness of THIS repo. No sibling code is imported — only published numbers are checked against independent re-derivations at toy scale.
- The power cord of D1-P3 remains deliberately unquoted: every in-model face is metered (zero net work; detuning pays W₀; readout and maintenance on their own meters), but the drive's dissipated joules belong to an experiment that survives its own falsifier, not to prose.
- The Noether charge of D2-M4 prices the mechanism-design layer only; the language-level charge that would guard `choose` semantics is unidentified, and no number is quoted for it.
- The witnesses run at toy scale (n ≤ 6 qubits, 13 wires, 2–3 agents). They witness laws, not performance — no complexity-class content is claimed anywhere in this repo.
