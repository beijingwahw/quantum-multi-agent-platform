/**
 * The tariff schedule — the no-signaling tax of this correspondence's
 * correlators, item by item on one page.
 *
 * Every row is an item: the resource, what the tax forbids, and the price.
 * Zeros are prices too — and by law they must be witnessed (N2): a zero
 * without a machine is marketing. The withdrawal schedule carries the cache's
 * full net-rate curve with exact anchors and a data-tagged interior.
 */

export type Exactness = "EXACT" | "DATA";

export interface TariffRow {
  readonly id: string;
  readonly resource: string;
  readonly item: string;
  readonly price: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

/** Headline constants — the witnesses re-derive these from physics, never copy. */
export const QUOTED_CACHE_LEAK = 2.3e-16; // rounding floor of the 24-axis zero
export const QUOTED_ORDER_BLIND = 1.7e-16;
export const QUOTED_HJW_TV = 0.0;
export const QUOTED_NET_P0 = 0.0;
export const QUOTED_NET_P05 = 0.094360938;
export const QUOTED_NET_P1 = 0.5;
/** net(p) at p = 0.1 .. 0.9 (the schedule's data-tagged interior) */
export const QUOTED_NET_GRID: readonly number[] = [
  0.003612773, 0.014524703, 0.032965972, 0.05935455, 0.094360938,
  0.139035953, 0.195079848, 0.265502203, 0.356801521,
];
export const QUOTED_H2_GRID_MAXDEV = 1e-12;

export const TARIFF: readonly TariffRow[] = [
  {
    id: "T1",
    resource: "the cache (singlet correlations)",
    item: "B's marginal must not depend on A's axis — the no-signaling object is the SETTING, never the outcome",
    price: "TV <= 2.3e-16 over the 24-axis grid, plain / under random local unitaries / under Stinespring CPTP on B's side — exact zero at the rounding floor",
    exactness: "EXACT",
    witness: "W-A",
    anchors: ["retro-cache"],
  },
  {
    id: "T2",
    resource: "the order register (the switched pair)",
    item: "the order bit the readout buys is input-blind — P(control | payload) constant",
    price: "max deviation 1.7e-16 across depol / replacer / random CPTP pairs and three payload inputs — a fair coin about the branch, never about the cargo",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["readout-wall", "switch-sched"],
  },
  {
    id: "T3",
    resource: "the HJW ensembles (binding's root)",
    item: "Bob's ensemble-averaged state is the same I/2 for every basis Alice commits to — the commitment is not readable before the reveal",
    price: "pairwise TV = 0.0 across Z/X/Y commitments (the conditional members differ — the correlations are real; the choice is not in the marginal)",
    exactness: "EXACT",
    witness: "W-C",
    anchors: ["quantum-mech"],
  },
  {
    id: "T4",
    resource: "the cache's withdrawal (key extraction)",
    item: "gross 1/2 bit per sifted aligned pair; settings announcement 1 bit per raw pair; reconciliation h2(QBER) per sifted bit; QBER = (1-p)/2",
    price: "net(p) = (1 - h2((1-p)/2))/2: 0 at p=0 (the seed floor), 0.094360938 at p=0.5, 0.5 at p=1 — anchors exact, interior shipped as data, monotone on the grid",
    exactness: "DATA",
    witness: "W-D",
    anchors: ["retro-cache"],
  },
  {
    id: "T5",
    resource: "the schedule's own arithmetic",
    item: "h2 by closed form vs the Taylor series around the maximum (1 - sum d^{2k}/(2 ln2 k(2k-1))) — two paths for every quoted rate",
    price: "max deviation <= 1e-12 on the open grid q in [0.05, 0.45] (400 terms); the endpoints q=0 and q=1/2 handled by closed forms — the series is honest only where it converges at machine precision",
    exactness: "EXACT",
    witness: "W-E",
    anchors: ["retro-cache"],
  },
];
