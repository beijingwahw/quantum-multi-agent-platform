/**
 * The market ledger — #13's goods, priced and unpriced, on one page.
 *
 * The letter's clause: privacy is bought, binding is not. The rows here make
 * that an equation (G1), a witnessed flat supply (G2), a priced goods list
 * (G3), and a one-parameter frontier (G4). The unpriced good carries its
 * invariance witness — an asserted impossibility without a witness is
 * marketing (M2).
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
    price: "entangled concealment T = 0 (the cheater is perfectly hidden — and thereby pinned at 1/2 by G1); tamper detection 1 - (3/4)^m, closed form vs recursive product for m = 1..12, both paths equal; the pad economy (chi = 0 with pad) stays anchored in quantum-mech's T2 — privacy is bought, and the price list is public",
    exactness: "MARKET-EXACT",
    witness: "W-D",
    anchors: ["quantum-mech"],
  },
  {
    id: "G4",
    good: "the classical frontier — one parameter, two prices",
    price: "for marginals polarized at r with aligned announcement: pass = 1/2 + r/2, concealment loss = r/2 — slack EQUALS loss at every point of the grid r in {0, 0.2, 0.5, 1/sqrt(2), 1}; the classical equatorial cheat sits exactly at 0.853553390593 = (2+sqrt(2))/4 = 1/2(1+1/sqrt(2)) — quantum-mech's T5 constant, re-derived on this frontier as just another point",
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
];
