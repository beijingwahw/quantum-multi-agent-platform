/**
 * THE BOARD — the entanglement standard's quoted trades. Every row carries
 * both columns (what you give, what you get) and the coin's fate: the ledger
 * discipline of #12/#13 applied to settlement itself.
 *
 * Tags: EXACT (machine-witnessed closed form), DATA (census), QUOTED
 * (cited, anchored to in-book schedules — no machine numbers claimed).
 */
export type Exactness = "EXACT" | "DATA" | "QUOTED";

export interface BoardRow {
  readonly id: string;
  readonly trade: string;
  readonly give: string;
  readonly get: string;
  readonly coinFate: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

export const BOARD: readonly BoardRow[] = [
  {
    id: "E1",
    trade: "redeem an unknown qubit (teleportation)",
    give: "1 ebit (the coin) + 2 cbits (the settlement's classical leg)",
    get: "the payload itself, delivered — channel fidelity exactly 1 over pure and mixed payloads",
    coinFate: "BURNED — post-trade pairwise concurrence exactly 0; and the goods do not move until the classical leg settles (B's pre-bits marginal is exactly I/2)",
    exactness: "EXACT",
    witness: "W-A",
    anchors: ["quantum-mech", "nosignal-tariff"],
  },
  {
    id: "E2",
    trade: "buy classical capacity (dense coding)",
    give: "1 transmitted qubit (the coin is the key, not the payment)",
    get: "exactly 2 cbits — the four signals decode with probability exactly 1",
    coinFate: "RETURNED — post-decode state is a KNOWN Bell pair, concurrence exactly 1: fuel in E1, catalyst in E2",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["quantum-mech"],
  },
  {
    id: "E3",
    trade: "the no-coin floor (classical capacity without entanglement)",
    give: "1 transmitted qubit, zero ebits",
    get: "at most 1 cbit — the tetrahedron ensemble achieves chi exactly 1 (the ceiling is Holevo's, anchored in-book)",
    coinFate: "coinless — this is the floor the doubling in E2 is quoted against",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["switch-sched", "readout-wall"],
  },
  {
    id: "E4",
    trade: "net a weak coin to standard (Procrustean filter)",
    give: "1 weak coin, concurrence C = 2*sqrt(l0*l1)",
    get: "1 standard coin with probability exactly 2*l_min; the success branch is exactly |Phi+>",
    coinFate: "UPGRADED on success; on failure a worthless product state (concurrence 0). Mixed-coin netting stays multi-copy asymptotic (BBPS96, quoted — not claimed here)",
    exactness: "EXACT",
    witness: "W-C",
    anchors: [],
  },
  {
    id: "E5",
    trade: "mint new entanglement",
    give: "a global two-qubit interaction (one CNOT does it) — or nothing, if you only hold local operations",
    get: "locally: never — the census never raises E_F (the monotonicity is VIDAL00, cited); globally: concurrence 0 -> 1 in one gate",
    coinFate: "this row is the mint itself: the desk moves, spends, nets — it never prints",
    exactness: "DATA",
    witness: "W-D",
    anchors: ["ent-sched"],
  },
  {
    id: "E6",
    trade: "the classical leg's thermodynamic tariff",
    give: "the 2 cbits of E1, read out at temperature T",
    get: "kT ln 2 per bit — the already-settled #11 schedule, cross-anchored here, not re-executed",
    coinFate: "not a coin transaction: the price of the settlement's paperwork",
    exactness: "QUOTED",
    witness: "W-F",
    anchors: ["readout-wall", "vacuum-compiler"],
  },
];
