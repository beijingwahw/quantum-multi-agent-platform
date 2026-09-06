/**
 * The model ledger — what the language proves, with its program family named.
 *
 * The ledger's OPEN row said "no executable model exists". These rows are
 * that model's facts. Tags: MODEL-EXACT (machine-witnessed to the rounding
 * floor within the model) or DATA (measured, no theorem attached). No row
 * speaks for the epoch-5 physics question — stability as physics, not
 * compilation, stays OPEN by construction.
 */

export type Exactness = "MODEL-EXACT" | "DATA";

export interface ModelRow {
  readonly id: string;
  readonly claim: string;
  readonly family: "engineered" | "random" | "both";
  readonly price: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

/** Headline constants — the witnesses re-derive these, never copy. */
/** rounding floor measured at the witness's fixed seeds (8.882e-16); not a seed-stable number */
export const QUOTED_STABILITY_DRIFT = 9e-16;
export const QUOTED_RANDOM_MEAN = 0.4816;
export const QUOTED_RANDOM_MIN = 0.4161;
export const QUOTED_RANDOM_MAX = 0.5332;
export const QUOTED_DENOTATION_DEV = 1.2e-16;
export const QUOTED_TOLL_MC_TOL = 0.02; // relative, 200k samples ~ 10 sigma
export const QUOTED_CONSERVATION_DEV = 1.5e-15;

export const MODEL: readonly ModelRow[] = [
  {
    id: "R1",
    claim: "the denotation compiles: conditioning the final state on a control pattern yields exactly the branch product's action on data",
    family: "both",
    price: "pattern probability = product of branch weights exactly (0.003673519813811 for the probe pattern); conditional data state vs U_pattern rho U_pattern-deviation <= 1.2e-16 — the semantics is the compilation",
    exactness: "MODEL-EXACT",
    witness: "W-B",
    anchors: ["route-price"],
  },
  {
    id: "R2",
    claim: "stability as compilation: engineered programs (W-preserving branch blocks) keep data-in-W in W over arbitrary lengths",
    family: "engineered",
    price: "membership drift <= 9e-16 (the rounding floor at the witness's fixed seeds, measured 8.882e-16) over program lengths 1..6 — the desired world is a fixed point of every engineered program",
    exactness: "MODEL-EXACT",
    witness: "W-A",
    anchors: ["route-price"],
  },
  {
    id: "R3",
    claim: "random programs do not preserve the world — stability is engineered, not generic",
    family: "random",
    price: "membership after 6 random steps: mean 0.4816, range [0.4161, 0.5332] over 12 trials — decaying toward the dimension ratio 1/2 (data only, no theorem claimed for the rate)",
    exactness: "DATA",
    witness: "W-A",
    anchors: ["route-price"],
  },
  {
    id: "R4",
    claim: "the certification toll: verifying 'the world we want' among the branches costs 1/P attempts — the epoch-3 ledger reopened at the language layer",
    family: "engineered",
    price: "pattern weights exact against the closed form; Monte-Carlo E[attempts] within 2% of 1/P at 200k samples (P = 0.152 / 0.614 / 0.869) — knowing WHICH world costs its branch weight, always",
    exactness: "MODEL-EXACT",
    witness: "W-C",
    anchors: ["postselect-sched"],
  },
  {
    id: "R5",
    claim: "the choice steers, never broadcasts: the register's coherence is order 1 under rephasing, a copied register's pair coherence is order 2",
    family: "engineered",
    price: "steer term ratio exactly e^{i phi} (magnitude 1 to 1e-12) for phi in {0.3, 0.7, 1.1}; the CNOT clone preserves the term's VALUE exactly while its two-copy phase rate doubles — one copy or two, never a broadcast",
    exactness: "MODEL-EXACT",
    witness: "W-D",
    anchors: ["route-price"],
  },
  {
    id: "R6",
    claim: "the conservation law that guards stability, exhibited in-model: invariance implies the membership charge is conserved for EVERY input, implies stability",
    family: "both",
    price: "engineered: <Pi_W> before = after to <= 1.5e-15 on in-W, in-W-perp, and random superposition inputs (a conserved charge, not just a fixed point); random programs violate it — the same implication shape as the discrete Noether layer (noted, not claimed as new)",
    exactness: "MODEL-EXACT",
    witness: "W-E",
    anchors: ["dsic-noether"],
  },
];
