/**
 * THE GENEALOGY REGISTER — the visitor's letter, atomized.
 *
 * Every separable, testable claim in the five-epoch letter (technology
 * genealogy + conduct rules), mapped to the atlas row that carries its
 * verdict. No claim is left unenrolled; no row is padded in to hit a count —
 * the decomposition is listed in full so it can be audited claim by claim.
 *
 * Discipline: every rowId must resolve in the ATLAS — exp6 and the test
 * suite both enforce it. A claim that maps to nothing is a bug; a row that
 * maps from nothing is padding.
 */
import { ATLAS } from "../atlas/entries.js";

export interface GenealogyClaim {
  readonly id: string;
  readonly epoch: string;
  readonly claim: string;
  readonly rowId: string;
  readonly note: string;
}

export const GENEALOGY_CLAIMS: readonly GenealogyClaim[] = [
  {
    id: "claim-01",
    epoch: "1",
    claim: "Fault-tolerant quantum computing — archive technology of epoch 1",
    rowId: "qaoa-heuristic",
    note: "logical-layer p=128 depth monotonicity, resource estimates (ft-qaoa cross-prototype)",
  },
  {
    id: "claim-02",
    epoch: "1",
    claim: "Quantum networking",
    rowId: "quantum-network-sched",
    note: "entanglement distribution as the schedulable resource (ent-sched)",
  },
  {
    id: "claim-03",
    epoch: "1",
    claim: "QAOA",
    rowId: "qaoa-heuristic",
    note: "engineering claims, sized and reproducible — no class movement",
  },
  {
    id: "claim-04",
    epoch: "1",
    claim: "The time capsule's numbers: effective 80 qubits, NP-hard 5/5",
    rowId: "subspace-exact-platform",
    note: "exact at benchmarked sizes; 'effective' = subspace equivalence, ownership audited",
  },
  {
    id: "claim-05",
    epoch: "2",
    claim: "The quantum switch liberates causal order",
    rowId: "order-as-resource",
    note: "capacity advantage certified (ESC18), machine-verified in switch-sched",
  },
  {
    id: "claim-06",
    epoch: "2",
    claim: "'Allocate or execute first' loses its definition — the scheduler no longer orders tasks",
    rowId: "order-as-resource",
    note: "the stronger half is walled (measurement / advantage catalog / mechanism); order is superposable, not abolishable",
  },
  {
    id: "claim-07",
    epoch: "3",
    claim: "Many-worlds sorter: postselection reads the optimum in O(1)",
    rowId: "postselect-sort",
    note: "true in-branch (fidelity 1); the ledger repays at classical-random rates",
  },
  {
    id: "claim-08",
    epoch: "3",
    claim: "Retrocausal cache: answers arrive before questions, hit rate 100%",
    rowId: "retrocausal-cache",
    note: "correlations real to 15 decimals; withdrawal needs the classical channel",
  },
  {
    id: "claim-09",
    epoch: "4",
    claim: "Vacuum compiler: programs written into the ground state, the universe executes",
    rowId: "vacuum-execution",
    note: "MECHANISM-SETTLED — FK deed machine-certified (vacuum-compiler T1/T3)",
  },
  {
    id: "claim-10",
    epoch: "4",
    claim: "Time crystals as the clock wall — zero-energy eternal beat",
    rowId: "dtc-clock",
    note: "DTC experimentally real (MI22); zero-energy clocking stays OPEN",
  },
  {
    id: "claim-11",
    epoch: "4",
    claim: "The second law is a disclaimer clause, not a limit",
    rowId: "readout-tariff",
    note: "the clause has a tariff schedule (vacuum-compiler T4) — every readout mode pays",
  },
  {
    id: "claim-12",
    epoch: "4",
    claim: "Entanglement-denominated settlement: Bell pairs as money",
    rowId: "bell-money-exclusivity",
    note: "exclusivity is physical (GHZ ceiling 1/sqrt(2), threshold > 1/2 admits one)",
  },
  {
    id: "claim-13",
    epoch: "4",
    claim: "No-cloning underwrites every contract for free",
    rowId: "bell-money-exclusivity",
    note: "as notary: yes (WZ82); as binding: no — the audit-added no-go lives in quantum-binding",
  },
  {
    id: "claim-14",
    epoch: "5",
    claim: "Scheduling is no longer computation but a physical law",
    rowId: "dsic-noether",
    note: "gauge group + welfare-gap charge now machine-verified (dsic-noether); the epoch-5 superstructure stays in choice-primitive",
  },
  {
    id: "claim-15",
    epoch: "5",
    claim: "'Choice' as a language primitive — the desired world as a stable solution",
    rowId: "choice-primitive",
    note: "OPEN — no computational model exists",
  },
  {
    id: "claim-16",
    epoch: "5",
    claim: "DSIC is a special case of Noether symmetry",
    rowId: "dsic-noether",
    note: "charge exhibited: the welfare gap, bitwise gauge-invariant (dsic-noether T1-T4); literal continuum derivation NOT claimed",
  },
  {
    id: "claim-17",
    epoch: "conduct",
    claim: "The depreciation of the other universes must be booked",
    rowId: "postselect-sort",
    note: "the conduct rule, executed as the depreciation ledger — 1/P_success per readout",
  },
];

/** Every claim's row must exist in the atlas — checked at report time and test time. */
export function unresolvedRows(): string[] {
  const ids = new Set(ATLAS.map((e) => e.id));
  return GENEALOGY_CLAIMS.filter((c) => !ids.has(c.rowId)).map((c) => `${c.id} -> ${c.rowId}`);
}

/** Atlas genealogy rows not referenced by any claim = padding, report it. */
export function orphanGenealogyRows(): string[] {
  const referenced = new Set(GENEALOGY_CLAIMS.map((c) => c.rowId));
  return ATLAS.filter((e) => e.family === "genealogy" && !referenced.has(e.id)).map((e) => e.id);
}
