/**
 * The atlas type system: every scheduling problem class gets a verdict tag,
 * and every verdict tag must be backed by certificates of specific kinds.
 * Claims without certificates do not ship — check.ts enforces this at test
 * time and at repro time.
 */

export type Verdict =
  /** Already exactly polynomial (Johnson's rule, Hungarian, sorting): nothing left to accelerate. */
  | "P-EXACT"
  /** NP-hard: a polynomial-time exact quantum algorithm would imply NP ⊆ BQP (conditional wall). */
  | "CONDITIONAL-WALL"
  /** Black-box access is capped: success ≤ (2q+1)²/N after q queries (BBBV, machine-checked). */
  | "QUERY-WALL"
  /** A certified quantum speedup exists (typically quadratic); it awaits fault-tolerant hardware. */
  | "HW-WAIT"
  /** Online / information-theoretic wall: the adversary, not the search, binds — quantum search cannot move it. */
  | "INFO-WALL"
  /** The quantum side changes the witness structure (QMA / StoqMA), not the search speed. */
  | "VERIFICATION-GAP"
  /** Empirical performance only; no complexity-class movement claimed. */
  | "HEURISTIC"
  /** A mechanism-design property settled at theorem level by exact algebra in a workspace prototype (positive or no-go); no complexity-class content. */
  | "MECHANISM-SETTLED"
  /** Not settled here; annotated with the precise open question. */
  | "OPEN";

export type CertKind =
  /** Executable many-one reduction / exact-algorithm certificate (this repo's exp1 machinery). */
  | "machine-reduction"
  /** Executable (1+eps)-approximation-scheme certificate. */
  | "machine-fptas"
  /** Executable BBBV hybrid-argument certificate (exp3 machinery). */
  | "machine-bbbv"
  /** Executable Grover / Durr-Hoyer upper-bound certificate (exp2 machinery). */
  | "machine-grover"
  /** Executable classical enumeration certificate (decision-tree sweeps, exp3 machinery). */
  | "machine-classical"
  /** Executable stoquasticity dichotomy certificate (exp4 machinery). */
  | "machine-stoq"
  /** Executable witness-verification (Hoeffding law) certificate (exp4 machinery). */
  | "machine-witness"
  /** Executable postselection-depreciation ledger certificate (exp6 machinery). */
  | "machine-postselect"
  /** Executable no-signaling withdrawal-clause certificate (exp6 machinery). */
  | "machine-nosignal"
  /** A sibling prototype in this workspace carries the certificate (path-checked). */
  | "cross-prototype"
  /** Verified literature anchor; the id must resolve in docs/theory.md's bibliography. */
  | "citation";

export interface Certificate {
  kind: CertKind;
  /** For citations: bibliography id. For cross-prototype: workspace-relative path. For machine certs: module anchor. */
  ref: string;
  note: string;
}

export interface AtlasEntry {
  id: string;
  problem: string;
  family: string;
  classical: { cls: string; note: string };
  quantumUpper: string;
  quantumLower: string;
  verdict: Verdict;
  rationale: string;
  certs: readonly Certificate[];
}

/**
 * Discipline map: verdicts whose substance is OUR executable machinery must
 * cite it; literature-level statements must at least resolve to the verified
 * bibliography. Anything else fails check.ts.
 */
export const REQUIRED_CERTS: Readonly<Record<Verdict, readonly CertKind[]>> = {
  "P-EXACT": ["machine-reduction", "citation"],
  "CONDITIONAL-WALL": ["machine-reduction", "citation"],
  "QUERY-WALL": ["machine-bbbv"],
  "HW-WAIT": ["machine-grover", "citation"],
  "INFO-WALL": ["cross-prototype", "citation", "machine-nosignal"],
  "VERIFICATION-GAP": ["machine-stoq", "machine-witness"],
  HEURISTIC: ["cross-prototype"],
  "MECHANISM-SETTLED": ["cross-prototype"],
  OPEN: ["citation"],
};

export const VERDOC_ORDER: readonly Verdict[] = [
  "P-EXACT",
  "CONDITIONAL-WALL",
  "QUERY-WALL",
  "HW-WAIT",
  "INFO-WALL",
  "VERIFICATION-GAP",
  "HEURISTIC",
  "MECHANISM-SETTLED",
  "OPEN",
];
