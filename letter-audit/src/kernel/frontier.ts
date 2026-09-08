/**
 * The frontier re-audit — the registry (depreciation-ledger's 17 verdict
 * rows) audited AGAINST THE WORKSPACE AS IT NOW STANDS.
 *
 * At letter-audit v0.1.0 the registry honestly held two OPEN rows: #10
 * (hardware) and #15 (physics-layer stability). Since then the workspace
 * shipped dtc-clock v0.19.0 (model-layer settlement + the decay-law arc)
 * and stable-world v0.5.0 + choice-lang v0.2.0 (both layers of #15) — the
 * registry's own rows have graduated to MECHANISM-SETTLED. This table is
 * the re-audit as DATA: every row carries its verdict now, its verdict at
 * v0.1.0, the boundary each graduation still carries, and pointers (file +
 * needle) into the sibling that settles or holds it. The pointers are
 * checked LIVE by law A6 — a pointer to a needle that does not exist in
 * the sibling's shipped report is contraband, named and rejected.
 *
 * Every needle below was verified against the sibling's rendered report on
 * disk on 2026-09-08; the checker re-verifies on every run.
 */

export type FrontierVerdict =
  | "MECHANISM-SETTLED"
  | "HEURISTIC"
  | "CONDITIONAL-WALL"
  | "HW-WAIT"
  | "INFO-WALL"
  | "OPEN";

export interface FrontierPointer {
  /** sibling repo, relative to the workspace root */
  readonly repo: string;
  /** report file inside the sibling, repo-relative, forward slashes */
  readonly file: string;
  /** substring that must be present in that file — the certificate's face */
  readonly needle: string;
}

export interface FrontierRow {
  readonly claimId: string;
  readonly claim: string;
  /** verdict as re-audited now */
  readonly verdict: FrontierVerdict;
  /** verdict as this audit held it at v0.1.0 */
  readonly priorVerdict: FrontierVerdict;
  /** the boundary the verdict carries — for graduations, the boundary that survives */
  readonly note: string;
  /** the repo whose shipped certificate settles this row; null unless graduated from OPEN */
  readonly settler: string | null;
  readonly pointers: readonly FrontierPointer[];
}

/** Fixed verdict order for the census strings: MS / HEU / CW / HW / OPEN / IW. */
export const CENSUS_ORDER: readonly FrontierVerdict[] = [
  "MECHANISM-SETTLED",
  "HEURISTIC",
  "CONDITIONAL-WALL",
  "HW-WAIT",
  "OPEN",
  "INFO-WALL",
];

export function censusString(rows: readonly FrontierRow[], key: "verdict" | "priorVerdict"): string {
  return CENSUS_ORDER.map((v) => rows.filter((r) => r[key] === v).length).join("/");
}

/** A row graduated from OPEN to MECHANISM-SETTLED — the re-audit's unit of motion. */
export function isGraduated(r: FrontierRow): boolean {
  return r.priorVerdict === "OPEN" && r.verdict === "MECHANISM-SETTLED";
}

export const FRONTIER: readonly FrontierRow[] = [
  {
    claimId: "#01",
    claim: "Fault-tolerant quantum computing is epoch-1 archive technology",
    verdict: "HEURISTIC",
    priorVerdict: "HEURISTIC",
    note: "held — heuristic complexity class, no speedup claim; the wall is real-time qLDPC decode",
    settler: null,
    pointers: [{ repo: "ft-qaoa", file: "out/exp1-monotonic.md", needle: "Worst-case r_128 across 7 instances: 0.991166" }],
  },
  {
    claimId: "#02",
    claim: "Quantum networking",
    verdict: "HEURISTIC",
    priorVerdict: "HEURISTIC",
    note: "held — delivery is real, the storage-slot price is the boundary",
    settler: null,
    pointers: [{ repo: "ent-sched", file: "out/exp3-network.md", needle: "0.66631" }],
  },
  {
    claimId: "#03",
    claim: "QAOA",
    verdict: "HEURISTIC",
    priorVerdict: "HEURISTIC",
    note: "held — class unmoved; physical verification awaiting granted hours only",
    settler: null,
    pointers: [{ repo: "ds_extracted/ds", file: "README.md", needle: "tests-292%2F292" }],
  },
  {
    claimId: "#04",
    claim: "The time capsule: effective 80 qubits, NP-hard 5/5",
    verdict: "HEURISTIC",
    priorVerdict: "HEURISTIC",
    note: "held — 'equivalent' stays subspace equivalence, never a physical 80-qubit machine",
    settler: null,
    pointers: [{ repo: "bqp-map", file: "out/reports/atlas.md", needle: "NP ⊆ BQP" }],
  },
  {
    claimId: "#05",
    claim: "The quantum switch liberates causal order",
    verdict: "HW-WAIT",
    priorVerdict: "HW-WAIT",
    note: "held — the capacity advantage is machine-witnessed; hardware does not ship switches at scale",
    settler: null,
    pointers: [{ repo: "switch-sched", file: "reports/exp2-capacity.md", needle: "χ_joint = 0.048795 bits" }],
  },
  {
    claimId: "#06",
    claim: "The scheduler no longer orders tasks",
    verdict: "HW-WAIT",
    priorVerdict: "HW-WAIT",
    note: "held — order is superposable, not abolishable (the measurement wall, executed)",
    settler: null,
    pointers: [{ repo: "k-switch", file: "out/reports/exp1-switch.md", needle: "the parity-orthogonality law, executed" }],
  },
  {
    claimId: "#07",
    claim: "Many-worlds sorter: postselection reads the optimum in O(1)",
    verdict: "CONDITIONAL-WALL",
    priorVerdict: "CONDITIONAL-WALL",
    note: "held — in-branch exactness is real; the unconditional price E[T]=1/P is the wall",
    settler: null,
    pointers: [{ repo: "postselect-sched", file: "out/reports/t1-sorter.md", needle: "1.000000000000" }],
  },
  {
    claimId: "#08",
    claim: "Retrocausal cache: answers before questions, hit rate 100%",
    verdict: "INFO-WALL",
    priorVerdict: "INFO-WALL",
    note: "held — correlations real to 15 decimals, the no-signaling tariff itemized",
    settler: null,
    pointers: [{ repo: "retro-cache", file: "out/reports/w1-correlations.md", needle: "CHSH rides Tsirelson's line 2*sqrt(2)*p" }],
  },
  {
    claimId: "#09",
    claim: "Vacuum compiler: programs written into the ground state",
    verdict: "MECHANISM-SETTLED",
    priorVerdict: "MECHANISM-SETTLED",
    note: "settled before this audit — the vacuum notarizes computation, never substitutes it",
    settler: null,
    pointers: [{ repo: "vacuum-compiler", file: "out/reports/exp1-compile.md", needle: "H_prop" }],
  },
  {
    claimId: "#10",
    claim: "Time crystals as the zero-energy clock wall",
    verdict: "MECHANISM-SETTLED",
    priorVerdict: "OPEN",
    note: "GRADUATED — settled at the model layer by dtc-clock (v0.1.0–v0.19.0): the beat is exact and clocks a universal reversible program at cargo fidelity 1, and the decay-law arc is assembled to theorem grade (kappa = -0.3068529590, TC44/TC45). The boundary that survives: hardware instantiation is NOT claimed — the HW-WAIT face persists inside the graduation (MI22 holds the hardware cells); amplitude reads and noise/error-correction remain the readout wall's face",
    settler: "dtc-clock",
    pointers: [
      { repo: "depreciation-ledger", file: "out/reports/the-ledger.md", needle: "| #10 | 4 | Time crystals as the zero-energy clock wall | MECHANISM-SETTLED" },
      { repo: "dtc-clock", file: "out/reports/the-dtc-clock.md", needle: "kappa = -0.3068529590" },
      { repo: "dtc-clock", file: "out/reports/the-dtc-clock.md", needle: "sigma1 = -0.4896664762" },
    ],
  },
  {
    claimId: "#11",
    claim: "The second law is a disclaimer clause, not a limit",
    verdict: "MECHANISM-SETTLED",
    priorVerdict: "MECHANISM-SETTLED",
    note: "settled before this audit — the clause has a tariff schedule",
    settler: null,
    pointers: [{ repo: "vacuum-compiler", file: "out/reports/exp3-ledger.md", needle: "0.143795" }],
  },
  {
    claimId: "#12",
    claim: "Bell pairs as money",
    verdict: "MECHANISM-SETTLED",
    priorVerdict: "MECHANISM-SETTLED",
    note: "settled before this audit — exclusivity is physics: no double spending, ever",
    settler: null,
    pointers: [{ repo: "quantum-mech", file: "out/exp3-escrow.md", needle: "sum exactly 1" }],
  },
  {
    claimId: "#13",
    claim: "No-cloning underwrites every contract for free",
    verdict: "MECHANISM-SETTLED",
    priorVerdict: "MECHANISM-SETTLED",
    note: "settled before this audit — privacy is bought, binding is not (the honest negative)",
    settler: null,
    pointers: [{ repo: "quantum-mech", file: "out/exp3-escrow.md", needle: "analytic (3/4)^m" }],
  },
  {
    claimId: "#14",
    claim: "Scheduling is a physical law, not computation",
    verdict: "MECHANISM-SETTLED",
    priorVerdict: "MECHANISM-SETTLED",
    note: "settled before this audit — the continuum chain assembles as the zero polynomial",
    settler: null,
    pointers: [{ repo: "dsic-noether", file: "out/reports/exp5-continuum.md", needle: "the ZERO POLYNOMIAL" }],
  },
  {
    claimId: "#15",
    claim: "'Choice' as a language primitive",
    verdict: "MECHANISM-SETTLED",
    priorVerdict: "OPEN",
    note: "GRADUATED — settled at BOTH layers: stable-world v0.5.0 executes stability as physics (the authored dissipative law with the marked world as its absorbing class, the bath derived microscopically, the Lindblad generator identified, the phase-alignment bank recovering up to 72.7% one-shot) and choice-lang v0.2.0 executes the language layer (composition laws, strategy-proof toll). The boundaries that survive: the law is AUTHORED — nature's instantiation not claimed; DAV74's general operator-norm theorem and WY16's QSI access stay cited, not executed",
    settler: "stable-world",
    pointers: [
      { repo: "depreciation-ledger", file: "out/reports/the-ledger.md", needle: "| #15 | 5 | 'Choice' as a language primitive | MECHANISM-SETTLED" },
      { repo: "stable-world", file: "out/reports/the-stable-world.md", needle: "72.7%" },
      { repo: "choice-lang", file: "out/reports/the-choice-model.md", needle: "strategy-proof" },
    ],
  },
  {
    claimId: "#16",
    claim: "DSIC is a special case of Noether symmetry",
    verdict: "MECHANISM-SETTLED",
    priorVerdict: "MECHANISM-SETTLED",
    note: "settled before this audit — both directions machine-verified, the kink locus is cited territory",
    settler: null,
    pointers: [{ repo: "dsic-noether", file: "out/reports/exp3-noether.md", needle: "the closedness identity has a closed form" }],
  },
  {
    claimId: "#17",
    claim: "The depreciation of the other universes must be booked",
    verdict: "CONDITIONAL-WALL",
    priorVerdict: "CONDITIONAL-WALL",
    note: "held — the registry stays conditional on its evidence; this re-audit is exactly that condition firing (the registry fell behind the workspace and was caught)",
    settler: null,
    pointers: [{ repo: "depreciation-ledger", file: "out/reports/the-ledger.md", needle: "CONDITIONAL-WALL" }],
  },
];
