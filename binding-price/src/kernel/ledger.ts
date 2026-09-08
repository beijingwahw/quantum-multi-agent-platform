/**
 * The market ledger — #13's goods, priced and unpriced, on one page.
 *
 * The letter's clause: privacy is bought, binding is not. The rows here make
 * that an equation (G1), a witnessed flat supply (G2), a priced goods list
 * (G3), and a one-parameter frontier (G4). The unpriced good carries its
 * invariance witness — an asserted impossibility without a witness is
 * marketing (M2). v0.2.0 deepens the market's own boundary: G6 exhausts a
 * precisely stated continuous family, G7 censuses the identity under noisy
 * commit channels (the survives/bends/breaks are all machine-measured), G8
 * bounds the two-coin question (per-coin flat, joint movable).
 */

export type Exactness = "MARKET-EXACT" | "DATA";

export interface MarketRow {
  readonly id: string;
  readonly good: string;
  readonly price: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

/** Headline constants — the witnesses re-derive these, never copy. */
export const QUOTED_IDENTITY_DEV = 1.3e-16;
export const QUOTED_FLAT_DEV = 0.0;
export const QUOTED_CHEAT_CONST = 0.853553390593; // (2+sqrt(2))/4 = (1+1/sqrt(2))/2
export const QUOTED_DETECTION_M = 12;
export const QUOTED_CHEAT_CONST_DEV = 1e-12;
// v0.2.0 — the continuous-family flat supply (W-F)
export const QUOTED_CONT_STRATEGIES = 61 * 25 + 91 + 21 * 25; // 2141, fixed by CONTINUOUS_GRID
export const QUOTED_CONT_FLAT_DEV = 1e-15;
// v0.2.0 — the noise census (W-G)
export const QUOTED_NOISE_IDENTITY_DEV = 1e-15;
export const QUOTED_CONFISCATION_DEV = 1e-15; // |output loss at r=0 minus gamma/2| under damping
// v0.2.0 — the two-coin bounded census (W-H)
export const QUOTED_JOINT_SPREAD_MIN = 0.2; // measured spread of the joint reveal across perfectly concealing strategies

export const MARKET: readonly MarketRow[] = [
  {
    id: "G1",
    good: "the one-coin identity: a reveal's binding slack IS its concealment loss",
    price: "Tr[|a><a| rho_V] = (1 + a.r)/2 exactly (deviation <= 1.3e-16 over a 200-point announced-state x marginal sweep) — pass minus 1/2 equals half the marginal's polarization along the announcement: every unit of binding bought is a unit of privacy sold, one-to-one, as an equation rather than a trade-off curve",
    exactness: "MARKET-EXACT",
    witness: "W-A",
    anchors: ["quantum-mech"],
  },
  {
    id: "G2",
    good: "binding — the unpriceable good, flat supply witnessed",
    price: "across the promisor's entire HJW strategy space (24 random bases, the tetrahedral decomposition, mixed-member ensembles) the verifier's marginal stays exactly I/2 (TV = 0.0) and the reveal stays exactly 1/2 (deviation = 0.0): no decomposition moves it at any offer — the supply curve is identically flat at zero because the SAME fact (the marginal) prices both goods",
    exactness: "MARKET-EXACT",
    witness: "W-B",
    anchors: ["quantum-mech", "nosignal-tariff"],
  },
  {
    id: "G3",
    good: "the sellable goods — concealment, detection, the pad",
    price: "entangled concealment T = 0 (the cheater is perfectly hidden — and thereby pinned at 1/2 by G1); tamper detection 1 - (3/4)^m, closed form vs recursive product for m = 1..12, both paths equal; the pad economy stays anchored in quantum-mech's quantum-OTP invariance (chi = 0 exactly; locked ensembles identical across payloads, machine-checked there) — privacy is bought, and the price list is public",
    exactness: "MARKET-EXACT",
    witness: "W-D",
    anchors: ["quantum-mech"],
  },
  {
    id: "G4",
    good: "the classical frontier — one parameter, two prices",
    price: "for marginals polarized at r with aligned announcement: pass = 1/2 + r/2, concealment loss = r/2 — slack EQUALS loss at every point of the grid r in {0, 0.2, 0.5, 1/sqrt(2), 1}; the classical equatorial cheat sits exactly at 0.853553390593 = (2+sqrt(2))/4 = 1/2(1+1/sqrt(2)) — quantum-mech's exp4 equiangular pass rate, re-derived on this frontier as just another point",
    exactness: "MARKET-EXACT",
    witness: "W-C",
    anchors: ["quantum-mech"],
  },
  {
    id: "G5",
    good: "the constants on two paths",
    price: "(2+sqrt(2))/4 computed symbolically vs numerically (<= 1e-12); every frontier pass probability recomputed by kernel matrix trace vs the closed form — the ledger's digits never travel alone",
    exactness: "MARKET-EXACT",
    witness: "W-E",
    anchors: ["quantum-mech"],
  },
  {
    id: "G6",
    good: "the flat supply beyond enumeration — exhaustive over a precisely stated CONTINUOUS family",
    price: "v0.1.0's 26 enumerated families upgraded: antipodal-pair products {1/4 +-u, 1/4 +-v} over Fibonacci grids (61 x 25 — every dihedral decomposition: the basis pair v = ±u and the great square u ⊥ v are parameter points, and the sweep covers every relative tilt between the pairs), geodesic interpolations between the family's extremal points (91 points: the second pair swept along the full geodesic from +u0 to -u0 around u0 = (1,1,1)/sqrt(3) — collapse to square to collapse), and convex refinements {w I/2, (1-w)/2 +-a} (21 x 25): 2141 parameterized ensembles, every one machine-verified — worst weight defect 1.11e-16, worst marginal TV 8.327e-17, worst reveal deviation 1.110e-16 to floating floor. The family is stated precisely and swept exhaustively: 'enumerated families' becomes 'exhaustive over the parameterized family' (the regular tetrahedron is not of antipodal-pair form — its six pairwise dots are all -1/3 — and stays covered by W-B's enumerated families)",
    exactness: "MARKET-EXACT",
    witness: "W-F",
    anchors: ["quantum-mech"],
  },
  {
    id: "G7",
    good: "the one-coin identity under a noisy commit channel — the exact census (survives / bends / breaks)",
    price: "dephasing (gamma in [0, 1/2]) and amplitude damping (gamma in [0, 1]) on the verifier's register: the identity as an equation of the OUTPUT marginal SURVIVES every channel and strength (maxdev 1.67e-16 over 10 settings x 256 announce-input pairs — it is algebra in one object, channel-agnostic); the flat supply SURVIVES as flatness by CPTP linearity (429 sampled strategies x 10 settings: every decomposition of I/2 lands on E_gamma(I/2), worst TV 1.25e-16) — under dephasing the level stays exactly 1/2 (2.22e-16, unital), but under damping the level leaves 1/2 memberwise as (1 + gamma m_z)/2 (maxdev 1.11e-16; certainty at gamma=1 for axial announcements); the input-to-output one-to-one BENDS: an oblique polarization dephased to gamma=1/2 leaves a wedge of 0.103553 between the input-aligned announcement's slack and the output loss (Cauchy-Schwarz strictness — the channel rotated the polarization away from the announcement); and it BREAKS under damping: a perfectly concealed input (loss 0) exits with loss gamma/2 exactly (maxdev 2.78e-17 — cross-anchored with quantum-mech v0.2.0's HJW-under-noise census, T = gamma/2), the channel minting a matching binding slack of gamma/2 (maxdev 0.0) along its own axis. The coin never stops being one coin; what noise breaks is the assumption that the pair you paid for at the input is the pair you hold at the output",
    exactness: "MARKET-EXACT",
    witness: "W-G",
    anchors: ["quantum-mech"],
  },
  {
    id: "G8",
    good: "two coins — the bounded census: per-coin flat, joint movable",
    price: "63 two-coin strategies (product decompositions {1/4 (±u ⊗ ±v)}, the four-Bell ensemble, locally rotated Bell ensembles, Schmidt interpolations {1/2 psi(t), 1/2 psi'(t)} swept over t in [0, pi/2]): the PER-COIN flat supply persists — every strategy, every coin, marginal exactly I/2 (worst TV 2.22e-16) and per-coin reveal exactly 1/2 (worst deviation 2.22e-16) at every Schmidt coefficient, entangled or not; the I/4-decompositions' joint product-announce reveal sits exactly at 1/4 (worst deviation 1.11e-16); but the JOINT reveal is MOVED by perfectly concealing strategies: at the fixed announcement (z,z) the pass spans 1/4 (I/4-decompositions) to 1/2 (the Schmidt family's classical correlations) — spread 1/4. The one-coin coin does not mint a two-coin coin: the joint statistic is priced by correlations, and correlations are steerable — the honest boundary of the flat supply",
    exactness: "MARKET-EXACT",
    witness: "W-H",
    anchors: ["quantum-mech"],
  },
];
