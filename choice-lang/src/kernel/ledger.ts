/**
 * The model ledger — what the language proves, with its program family named.
 *
 * The ledger's OPEN row said "no executable model exists". These rows are
 * that model's facts. Tags: MODEL-EXACT (machine-witnessed to the rounding
 * floor within the model) or DATA (measured, no theorem attached). No row
 * speaks for the epoch-5 physics question — stability as physics, not
 * compilation, stays OPEN by construction.
 *
 * v0.2.0 — the language's own faces: COMPOSITION (R7-R10: the laws of
 * choosing after choosing and choosing inside choosing), the bounded LOOP
 * (R11), and the two-player census (R12). Composition rows cite law ids
 * from LAW_REGISTRY; the checker (P5) rejects counterfeit citations.
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
  /** machine-verified composition/loop/game law ids this row asserts (P5) */
  readonly cites?: readonly string[];
}

/**
 * The composition-law registry — every id machine-verified by a witness.
 * A row may cite laws; P5 rejects citations outside this registry, so a
 * counterfeit identity (associative pricing) or a fake toll law (additive
 * toll) is named and refused at the checker, not smuggled into the ledger.
 */
export const LAW_REGISTRY: readonly string[] = [
  "S1", // composed pattern weights are the product measure, state-independent
  "S2", // conditioning chains: condition-P-then-Q equals conditioning P++Q
  "S3", // denotation products associate across parenthesizations (at the floor)
  "N1", // nested paths are context-free: leaf unitary and path weight survive
  "N2", // non-interchangeability: same denotations, different prices (counterexample)
  "T-MULT", // the certification toll multiplies: E[attempts] = 1/(P*Q)
  "Q-COMP", // the membership charge is conserved under composition (engineered)
  "L-TELE", // the loop charge ledger telescopes at the rounding floor
  "L-TOLL", // the loop toll compounds: E[attempts] = 1/w^k
  "G-TOLL", // the toll is strategy-proof in the two-player census (branch-blind)
];

/** Known counterfeits, by name, with the true law quoted in the rejection. */
export const KNOWN_COUNTERFEITS: Readonly<Record<string, string>> = {
  "ASSOC-PRICE":
    "pricing associativity is FALSE — N2's counterexample: w_left(A) = cos^2(t1)*cos^2(t2) = 0.4646 off w_right(A) = cos^2(t1); denotations compose, prices do not",
  "T-ADD":
    "the toll law is MULTIPLICATIVE (T-MULT): E[attempts] = 1/(P*Q) = (1/P)*(1/Q) (23.61 vs 23.66 at 200k samples), never 1/P + 1/Q",
};

/** Headline constants — the witnesses re-derive these, never copy. */
/** rounding floor measured at the witness's fixed seeds (8.882e-16); not a seed-stable number */
export const QUOTED_STABILITY_DRIFT = 9e-16;
export const QUOTED_RANDOM_MEAN = 0.4816;
export const QUOTED_RANDOM_MIN = 0.4161;
export const QUOTED_RANDOM_MAX = 0.5332;
export const QUOTED_DENOTATION_DEV = 1.2e-16;
export const QUOTED_TOLL_MC_TOL = 0.02; // relative, 200k samples ~ 10 sigma
export const QUOTED_CONSERVATION_DEV = 1.5e-15;
// ---- composition / loop / game (v0.2.0), floors measured at fixed seeds ----
/** worst of S1 (6.939e-18) and S2 (weight 5.551e-17, state 1.665e-16) */
export const QUOTED_SEQ_DEV = 2e-16;
export const QUOTED_ASSOC_DEV = 1.2e-16; // S3 parenthesization deviation (1.110e-16)
export const QUOTED_NESTED_DEV = 2e-16; // N1 path deviation (1.110e-16)
export const QUOTED_ISOMETRY_DEV = 5e-16; // V-dagger-V deviation (4.441e-16)
/** composed-charge drift, sequential (4.441e-16) and nested (2.220e-16) */
export const QUOTED_COMPOSED_CHARGE_DEV = 5e-16;
/** N2's pricing gap on leaf A: cos^2(t1)*sin^2(t2) at t1=0.7, t2=1.1 (measured) */
export const QUOTED_PRICE_GAP = 0.464623528412;
/** loop ledger: worst per-iteration delta and total drift (2.220e-16 at k=5) */
export const QUOTED_LOOP_FLOOR = 3e-16;
/** two-player census (DATA, seeded): attack min/max final, lock min final */
export const QUOTED_GAME_ATTACK_MIN = 0.2439;
export const QUOTED_GAME_ATTACK_MAX = 0.7345;
export const QUOTED_GAME_LOCK_MIN = 0.2336;
export const QUOTED_GAME_CENSUS_TOL = 0.02;

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
  {
    id: "R7",
    claim: "sequential composition is a homomorphism: pattern weights multiply (S1), conditioning chains (S2), denotation products associate (S3)",
    family: "both",
    price: "composed weight = w(P|p)*w(Q|q) to 6.9e-18 on two input states (the product measure is state-independent); chained conditioning equals direct to 1.7e-16; den(Q)*den(P) vs parenthesized vs flat agree to 1.1e-16 — the language composes the way its parts denote",
    exactness: "MODEL-EXACT",
    witness: "W-F",
    anchors: ["route-price"],
    cites: ["S1", "S2", "S3"],
  },
  {
    id: "R8",
    claim: "nested composition is context-free (N1) and NOT interchangeable (N2): choose(choose(A,B),C) and choose(A,choose(B,C)) denote the same products on their common leaves and price them differently",
    family: "both",
    price: "every live path of both nestings conditions to its leaf unitary weighted, to 1.1e-16, and the embedded/standalone weight ratio is cos^2(t1) exactly on every path under the context (context-freedom); but w_left(A) = 0.120360 vs w_right(A) = 0.584984 — a 0.464624 gap equal to the closed form cos^2(t1)*sin^2(t2): associativity lives in the denotation, never in the syntax (exact identity AND exact counterexample)",
    exactness: "MODEL-EXACT",
    witness: "W-G",
    anchors: ["route-price"],
    cites: ["N1", "N2"],
  },
  {
    id: "R9",
    claim: "the certification toll MULTIPLIES under composition: certifying the composed pattern costs E[attempts] = 1/(P*Q) = (1/P)*(1/Q) — the epoch-3 law, now a composition law",
    family: "both",
    price: "composed weight = product exactly (6.9e-18; P = 0.093072, Q = 0.454094, P*Q = 0.042264); Monte-Carlo E[attempts] 23.6092 vs 1/(PQ) = 23.6610 at 200k samples, and the product of the parts' own MC tolls 23.7053 matches the composed toll — verifying costs multiply, never add",
    exactness: "MODEL-EXACT",
    witness: "W-F",
    anchors: ["postselect-sched"],
    cites: ["T-MULT"],
  },
  {
    id: "R10",
    claim: "the membership charge is conserved under COMPOSITION: engineered programs composed sequentially or nested still conserve it for every input",
    family: "engineered",
    price: "sequential: <Pi_W> before = after to 4.4e-16 on in-W, in-W-perp, random-superposition inputs; nested (a choose inside a choose): 2.2e-16; a random composition moves the charge by 0.5567 — the conserved charge is closed under the language's own composition, exactly where the fixed point alone would not be",
    exactness: "MODEL-EXACT",
    witness: "W-F",
    anchors: ["dsic-noether"],
    cites: ["Q-COMP"],
  },
  {
    id: "R11",
    claim: "the bounded loop: the charge ledger TELESCOPES at the rounding floor over k iterations, and the loop toll COMPOUNDS as w^k",
    family: "engineered",
    price: "k=5 iterations of an engineered body: every per-iteration delta <= 2.2e-16, total drift 0.0 (the ledger does not accumulate rounding), telescoping residual 0.0; certifying 'the world we want' after k coherent iterations costs w^k exactly (3.5e-18) — E[attempts] 46.11 vs 1/w^5 = 46.18 at 200k samples; random bodies decay (mean 0.5221 after 5 iterations, data)",
    exactness: "MODEL-EXACT",
    witness: "W-H",
    anchors: ["dsic-noether", "postselect-sched"],
    cites: ["L-TELE", "L-TOLL"],
  },
  {
    id: "R12",
    claim: "the two-player census: the toll is STRATEGY-PROOF (branch-blind in every cell) and an engineered answering move LOCKS the charge wherever the adversary left it",
    family: "both",
    price: "24-strategy census: the composed pattern weight equals w1*w2 = 0.315759 to 1.1e-16 in every cell (E[attempts] 3.1643 vs 1/(w1w2) = 3.1669) — no strategy haggles the price; the attack (adversary LAST) drives the final charge to min 0.2439 / max 0.7345 over the census (data), while the engineered answer (adversary FIRST) leaves final = after-adversary to 1.1e-16 in every cell (lock min 0.2336, data) — the attack surface is the charge, never the toll",
    exactness: "MODEL-EXACT",
    witness: "W-I",
    anchors: ["postselect-sched"],
    cites: ["G-TOLL"],
  },
];
