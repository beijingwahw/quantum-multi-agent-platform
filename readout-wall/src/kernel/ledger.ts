/**
 * The exchange ledger — the readout wall as trades, both columns on one page.
 *
 * Every row is an exchange: what you GET (the definite order, the bit about
 * the branch) | what you PAY (the coherent advantage — the off-block terms
 * that carry it). Rows tagged EXACT have their numbers re-derived from scratch
 * by the mapped witness; rows tagged DATA ship as measured curves with no
 * theorem attached. This mirrors the depreciation ledger's founding law with
 * the object rotated: there, numbers never travel without costs; here,
 * knowledge never travels without its price.
 */

export type Exactness = "EXACT" | "DATA";

export interface ExchangeRow {
  readonly id: string;
  readonly face: string;
  readonly get: string;
  readonly pay: string;
  readonly exactness: Exactness;
  /** id of the witness in audit.ts that re-derives this row's numbers */
  readonly witness: string;
  /** workspace repos whose in-book verifications anchor this row's physics */
  readonly anchors: readonly string[];
}

/** Headline constants — the witnesses re-derive these from physics, never copy. */
export const QUOTED_ESC18_CHI = 0.048794940695399;
export const QUOTED_REPLACER_CHI_CONTROL_CLOSED = 0.311278; // H2(1/4) - 1/2
export const QUOTED_K3_CHI = 0.098069743463625;
/** interpolation curve chi(lambda) at lambda = 0.25, 0.5, 0.75 */
export const QUOTED_CURVE: readonly number[] = [0.026470287, 0.011482407, 0.002830695];

export const EXCHANGE: readonly ExchangeRow[] = [
  {
    id: "E1",
    face: "ESC18 exchange — two completely depolarizing boxes, joint receiver",
    get: "the order bit: P(control=0 | input) = 1/2 to 1e-15 for every input — a fair coin about the branch, never about the payload",
    pay: "chi_joint 0.048794940695399 -> 0.000000000000000: every bit of the switched advantage lives in the off-block coherences the readout demolishes",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["switch-sched"],
  },
  {
    id: "E2",
    face: "Collapse identity — what the readout leaves behind",
    get: "the definite branch: a classical mixture of the fixed-order channels, weighted by the control's diagonal (p_c * M_c)",
    pay: "the off-block terms, all of them: dephased switch = the mixture, machine-identity to 1e-15 across the showcase pairs, biased controls, and random CPTP pairs — the read-out switch is not a new process, it is the average of the orders you could have chosen",
    exactness: "EXACT",
    witness: "W-A",
    anchors: ["switch-sched"],
  },
  {
    id: "E3",
    face: "Complementarity face — replacer pair, information parked ON the control",
    get: "the order bit, again input-blind (P = 1/2)",
    pay: "control information T = 1/2 (chi_control = H2(1/4) - 1/2 = 0.311278 bits) -> z-readout T = 0.000000000000000: the information lives at x-coherence; the order basis sees nothing. Order-knowledge and order-advantage are complementary observables of the same register",
    exactness: "EXACT",
    witness: "W-C",
    anchors: ["switch-sched"],
  },
  {
    id: "E4",
    face: "Weak readout — partial dephasing of strength lambda",
    get: "lambda-strength order knowledge",
    pay: "chi(lambda): 0.048795 -> 0.026470 (@0.25) -> 0.011482 (@0.5) -> 0.002831 (@0.75) -> 0 (@1) — endpoints exact, curve shipped as data; no convexity or concavity theorem is claimed for the interior",
    exactness: "DATA",
    witness: "W-D",
    anchors: ["switch-sched"],
  },
  {
    id: "E5",
    face: "k=3 face — six orders, one register",
    get: "the order register over the six permutations of S3",
    pay: "chi_joint 0.098069743463625 -> 0.000000000000000 (machine-measured; no paper value claimed); the six-order mixture identity holds to 1e-15 — the wall scales with the order count it buries",
    exactness: "EXACT",
    witness: "W-E",
    anchors: ["k-switch", "switch-sched"],
  },
];
