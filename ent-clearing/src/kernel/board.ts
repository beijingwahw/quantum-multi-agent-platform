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
  {
    id: "E7",
    trade: "net MIXED coins (BBPSSW bilateral round at bounded scale)",
    give: "n mixed coins (Werner F or depolarized p), n in {2,3,4} — the sacrifice pairs are measured away",
    get: "1 purified coin with the chain probability executed exactly; post-round concurrence and E_F machine-measured; the round matches its closed forms to 1e-12; the round's expected E_F never rises",
    coinFate: "upgraded but NEVER standard at bounded scale (F_out < 1 exactly); the depolarizing step (Clifford twirl) is load-bearing — without it the next raw round degrades the coin. The BBPS96 asymptotic hashing line stays quoted, with the gap reported as data",
    exactness: "EXACT",
    witness: "W-G",
    anchors: [],
  },
  {
    id: "E8",
    trade: "settle the ledger (the catalyst conservation census)",
    give: "the settlement ops themselves, replayed with instruments",
    get: "a conservation ledger: the catalyst's E_F conserved exactly (dense coding 1 -> 1), the fuel's burned exactly (teleportation delta -1), every netting and purification row never rises, the GHZ cuts conserved or settled exactly",
    coinFate: "the census itself: each row an exact identity, an exact counterexample, or an exact never-rises (the monotonicity is VIDAL00, cited)",
    exactness: "EXACT",
    witness: "W-H",
    anchors: [],
  },
  {
    id: "E9",
    trade: "the multi-party desk (a 3-party GHZ bank)",
    give: "1 GHZ coin held jointly by A, B, C (pairwise concurrences exactly 0; every 1-vs-2 cut exactly 1/2 negativity)",
    get: "any two parties withdraw: C measures X and sends 1 cbit — AB end with a KNOWN standard coin (both branches pure Bell, concurrence exactly 1); the A|BC and B|AC cuts conserved exactly, AB|C settled exactly",
    coinFate: "the mint wall survives per cut (local-channel census never raises any cut; the monotonicity is VW02, cited) and FAILS on the pairwise ledger (exact counterexample: C_AB 0 -> 1) — entanglement moves between ledgers, it is never printed",
    exactness: "DATA",
    witness: "W-I",
    anchors: ["quantum-mech"],
  },
];
