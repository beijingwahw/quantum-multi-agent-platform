/**
 * THE ENROLLMENT — every buried error wired to the guard that kills it NOW.
 *
 * Generated from the LIVE registry by scripts/gen-enrollment.ts (decision table
 * with category defaults and per-key overrides in there, reviewable as data);
 * hand-maintained from here on. The authority is NOT this file's provenance —
 * it is the E-board's live census (E1-E6 in audit.ts): every key must match a
 * live registry error, every GATE anchor must resolve on disk, every BOOKED
 * row must say why, and the tier census must account for every error the
 * registry carries. When a new batch is buried, this table must answer for
 * every new error or the build fails — an error without an enforcement
 * anchor cannot be buried.
 *
 * Tiers (closed vocabulary, E6):
 *   MUTANT-KILLED — the error's CLASS is replayed as a live mutant and killed
 *     by the battery (E2 ties the row to a mutant that declares this class;
 *     the kill itself is certified live by W-A). Class-level tie, honestly:
 *     one mutant guards its whole registered class, no per-error mutants.
 *   GATE-ENFORCED — recurrence now fails a real build gate; the anchor is
 *     "workspace-relative/path :: needle", both verified LIVE on every run
 *     (E3, the B4 shape).
 *   BOOKED-UNENFORCEABLE — no machine can hold this line; the reason is
 *     mandatory (E4) and every booked row is printed on the report.
 */
export const TIERS = ["MUTANT-KILLED", "GATE-ENFORCED", "BOOKED-UNENFORCEABLE"] as const;
export type Tier = (typeof TIERS)[number];

export interface EnrollmentRow {
  /** "bN#i" — the registry's own addressing (batch N, i-th error) */
  readonly key: string;
  /** must equal the live error's category — no re-labeling (E6) */
  readonly category: string;
  readonly tier: Tier;
  /** mutant id (MUTANT-KILLED) or "path :: needle" (GATE-ENFORCED); "" for BOOKED */
  readonly anchor: string;
  readonly reason: string;
}

export const ENROLLMENT: readonly EnrollmentRow[] = [
  // ---- batch 1 (ds_extracted/ds) ----
  { key: "b1#0", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: typecheck", reason: "" },
  { key: "b1#1", category: "process", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b1#2", category: "process", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b1#3", category: "process", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b1#4", category: "process", tier: "GATE-ENFORCED", anchor: "depreciation-ledger/src/kernel/audit.ts :: L2", reason: "" },
  // ---- batch 2 (ds_extracted/ds) ----
  { key: "b2#0", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: Q4", reason: "" },
  { key: "b2#1", category: "process", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b2#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b2#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "TS-Python parity lives in CI; the local workspace cannot gate GitHub Actions — booked until CI is reachable" },
  { key: "b2#4", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/tsconfig.json :: exactOptionalPropertyTypes", reason: "" },
  { key: "b2#5", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: format:check", reason: "" },
  { key: "b2#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "host-interpreter assumption (python3 on this Windows box); no workspace gate commands the environment — environment lesson, process only" },
  { key: "b2#7", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "push-failure diagnosis (network vs auth vs remote); operator judgment, no machine gate" },
  // ---- batch 3 (ft-qaoa) ----
  { key: "b3#0", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b3#1", category: "process", tier: "GATE-ENFORCED", anchor: "ft-qaoa/package.json :: test", reason: "" },
  { key: "b3#2", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ft-qaoa/tsconfig.json :: exactOptionalPropertyTypes", reason: "" },
  { key: "b3#3", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ft-qaoa/package.json :: test", reason: "" },
  { key: "b3#4", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  // ---- batch 4 (nonstoq-anneal) ----
  { key: "b4#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b4#1", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b4#2", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "nonstoq-anneal/package.json :: test", reason: "" },
  { key: "b4#3", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "shell retry-loop exit-code semantics; the loop's honesty is the author's check — process" },
  { key: "b4#4", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: format:check", reason: "" },
  // ---- batch 5 (nonstoq-anneal) ----
  { key: "b5#0", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  { key: "b5#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b5#2", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  { key: "b5#3", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b5#4", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  { key: "b5#5", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  // ---- batch 6 (nonstoq-anneal) ----
  { key: "b6#0", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "burial-record/src/kernel/audit.ts :: B4", reason: "" },
  { key: "b6#1", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b6#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU7", reason: "" },
  { key: "b6#3", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b6#4", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b6#5", category: "process", tier: "GATE-ENFORCED", anchor: "depreciation-ledger/src/kernel/audit.ts :: L1", reason: "" },
  // ---- batch 7 (nonstoq-anneal) ----
  { key: "b7#0", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b7#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b7#2", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b7#3", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b7#4", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "nonstoq-anneal/package.json :: test", reason: "" },
  // ---- batch 8 (ent-sched) ----
  { key: "b8#0", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b8#1", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "ent-sched/package.json :: test", reason: "" },
  { key: "b8#2", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b8#3", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "ent-sched/package.json :: test", reason: "" },
  { key: "b8#4", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b8#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "threshold policy is experiment design; what the engine schedules was corrected by hand — no gate chooses policy" },
  { key: "b8#6", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  // ---- batch 9 (quantum-mech) ----
  { key: "b9#0", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE", reason: "" },
  { key: "b9#1", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b9#2", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b9#3", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  { key: "b9#4", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b9#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "instance-set design (brute force vs 20k random search); methodological judgment, no gate" },
  { key: "b9#6", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "instance-set strength claim; hard instances are design work, not a gate" },
  { key: "b9#7", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  // ---- batch 10 (qverify) ----
  { key: "b10#0", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  { key: "b10#1", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  { key: "b10#2", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  { key: "b10#3", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  { key: "b10#4", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b10#5", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b10#6", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "search-effort budgeting (the compass grind); abandoned by judgment, nothing to enforce" },
  { key: "b10#7", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU2", reason: "" },
  { key: "b10#8", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc truncation — banned house-wide by hard rule (Write tool, never heredoc); enforcement is process, nothing gates the author's tooling" },
  { key: "b10#9", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the diagnostic script is never the trusted side; process rule, no gate" },
  // ---- batch 11 (qram-sched) ----
  { key: "b11#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b11#1", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b11#2", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "qram-sched/package.json :: test", reason: "" },
  { key: "b11#3", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b11#4", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  { key: "b11#5", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b11#6", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: Q4", reason: "" },
  { key: "b11#7", category: "bogus-comparison", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "aggregation order (sum of per-seed ratios vs ratio of sums) — comparison design; no property pins aggregation semantics, booked" },
  { key: "b11#8", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  // ---- batch 12 (bqp-map) ----
  { key: "b12#0", category: "toolchain", tier: "GATE-ENFORCED", anchor: "bqp-map/package.json :: test", reason: "" },
  { key: "b12#1", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b12#2", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b12#3", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b12#4", category: "process", tier: "GATE-ENFORCED", anchor: "bqp-map/package.json :: test", reason: "" },
  { key: "b12#5", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b12#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "path-resolution discipline (one climb does not fit all files); no gate derives each file's depth generically" },
  { key: "b12#7", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "witness-before-prose; the ledger law books costs on LEDGER rows, README rounding is author honesty — unenforceable line-by-line" },
  // ---- batch 13 (switch-sched) ----
  { key: "b13#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU2", reason: "" },
  { key: "b13#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b13#2", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU6", reason: "" },
  { key: "b13#3", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  { key: "b13#4", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b13#5", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b13#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc-via-JSON patch pipeline — the banned heredoc class; process only" },
  { key: "b13#7", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "switch-sched/package.json :: test", reason: "" },
  // ---- batch 14 (bqp-map) ----
  { key: "b14#0", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "depreciation-ledger/src/kernel/audit.ts :: L6", reason: "" },
  { key: "b14#1", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: Q4", reason: "" },
  { key: "b14#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b14#3", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b14#4", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "tsx -e quirks under Git Bash; environment lesson, no gate" },
  { key: "b14#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "which rows weaken a table is editorial; the ledger's both-columns law does not judge row selection" },
  // ---- batch 15 (causal-ineq) ----
  { key: "b15#0", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b15#1", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b15#2", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU2", reason: "" },
  { key: "b15#3", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b15#4", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b15#5", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "burial-record/src/kernel/audit.ts :: B4", reason: "" },
  // ---- batch 16 (k-switch) ----
  { key: "b16#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b16#1", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  { key: "b16#2", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b16#3", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "k-switch/package.json :: test", reason: "" },
  // ---- batch 17 (vacuum-compiler) ----
  { key: "b17#0", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE", reason: "" },
  { key: "b17#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b17#2", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  { key: "b17#3", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b17#4", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU7", reason: "" },
  { key: "b17#5", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b17#6", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "vacuum-compiler/package.json :: test", reason: "" },
  // ---- batch 18 (dsic-noether) ----
  { key: "b18#0", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b18#1", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: test", reason: "" },
  { key: "b18#2", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b18#3", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b18#4", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b18#5", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b18#6", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: test", reason: "" },
  // ---- batch 19 (postselect-sched) ----
  { key: "b19#0", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "burial-record/src/kernel/audit.ts :: B4", reason: "" },
  { key: "b19#1", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b19#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b19#3", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  { key: "b19#4", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b19#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "README worded by the expected limit; prose honesty, no machine gate" },
  // ---- batch 20 (retro-cache) ----
  { key: "b20#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU2", reason: "" },
  { key: "b20#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b20#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b20#3", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b20#4", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  // ---- batch 21 (route-price) ----
  { key: "b21#0", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b21#1", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b21#2", category: "toolchain", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/census.ts :: unguardedEntryFiles", reason: "" },
  { key: "b21#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "hand-computed price column corrected by the witness (9977.87 -> 9977.19); witness-before-prose is process" },
  // ---- batch 22 (burial-record) ----
  { key: "b22#0", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b22#1", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "burial-record/src/kernel/audit.ts :: B4", reason: "" },
  { key: "b22#2", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "probe placed outside the repo (system temp); the batch-33 rule (probes live in-repo) is process — no gate scans the author's scratch location" },
  { key: "b22#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "law-label sequence (B0-B4 then B6) caught in self-review; no linter sequences labels" },
  // ---- batch 23 (readout-wall) ----
  { key: "b23#0", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE", reason: "" },
  { key: "b23#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b23#2", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "readout-wall/package.json :: typecheck", reason: "" },
  { key: "b23#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "contract-reading on reuse (same idiom, different signature); practice, no gate compares idioms" },
  // ---- batch 24 (nosignal-tariff) ----
  { key: "b24#0", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU4", reason: "" },
  { key: "b24#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU6", reason: "" },
  { key: "b24#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b24#3", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "burial-record/src/kernel/audit.ts :: B4", reason: "" },
  { key: "b24#4", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b24#5", category: "toolchain", tier: "GATE-ENFORCED", anchor: "mutant-census/scripts/total-gate.ts :: typecheck", reason: "" },
  { key: "b24#6", category: "toolchain", tier: "GATE-ENFORCED", anchor: "nosignal-tariff/package.json :: test", reason: "" },
  { key: "b24#7", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  // ---- batch 25 (choice-lang) ----
  { key: "b25#0", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b25#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "third-draft discipline; drafts that never reach the machine cannot be gated — the rule is process" },
  { key: "b25#2", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: Q4", reason: "" },
  { key: "b25#3", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b25#4", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b25#5", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b25#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc truncation (render.ts) — the banned class; process only" },
  // ---- batch 26 (binding-price) ----
  { key: "b26#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b26#1", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc truncation (probe.ts) — the banned class; process only" },
  // ---- batch 27 (letter-audit) ----
  { key: "b27#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "design-before-code (the TM encoding collapsed twice mid-write); process" },
  { key: "b27#1", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  { key: "b27#2", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  // ---- batch 28 (wukong-crossval) ----
  { key: "b28#0", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b28#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b28#2", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b28#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "count-after-construction (21 built, 20 shipped); the instance census is author discipline" },
  // ---- batch 29 (survivor-census) ----
  { key: "b29#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b29#1", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b29#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b29#3", category: "toolchain", tier: "GATE-ENFORCED", anchor: "survivor-census/package.json :: test", reason: "" },
  { key: "b29#4", category: "bogus-comparison", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "displayed fractions must point at their true denominator; print-layer honesty — no gate formats the register" },
  { key: "b29#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "draft residue reaching the machine; unused symbols are tsc-gated, live-code residue (`| \"\"`) is review" },
  // ---- batch 30 (ent-clearing) ----
  { key: "b30#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU2", reason: "" },
  { key: "b30#1", category: "bogus-comparison", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "toExponential(6) masks 1+2.1e-8 as 1.000000e+0; display precision is print-layer, the witness columns carry the true digits — the format itself is not gated" },
  { key: "b30#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b30#3", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU9", reason: "" },
  { key: "b30#4", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "audit.ts indirection residue rewritten before boarding; pre-flight review, process" },
  { key: "b30#5", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ent-clearing/package.json :: typecheck", reason: "" },
  // ---- batch 31 (stable-world) ----
  { key: "b31#0", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU6", reason: "" },
  { key: "b31#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b31#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b31#3", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU7", reason: "" },
  { key: "b31#4", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b31#5", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b31#6", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: typecheck", reason: "" },
  { key: "b31#7", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: typecheck", reason: "" },
  // ---- batch 32 (mutant-census) ----
  { key: "b32#0", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: Q2", reason: "" },
  { key: "b32#1", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: Q4", reason: "" },
  { key: "b32#2", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b32#3", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b32#4", category: "statistics", tier: "MUTANT-KILLED", anchor: "MU8", reason: "" },
  { key: "b32#5", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/census.ts :: unguardedEntryFiles", reason: "" },
  { key: "b32#6", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: provenanceRepos", reason: "" },
  { key: "b32#7", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "display heuristics (sigma vs raw units); the formatting law lives in prose, no gate parses intent" },
  { key: "b32#8", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b32#9", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "edit residue in mutant construction; the kill census verifies KILLS, residue-free construction is authorship" },
  { key: "b32#10", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: repro", reason: "" },
  { key: "b32#11", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "tree-walk style rewritten before boarding; never reached the machine — process" },
  { key: "b32#12", category: "toolchain", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  // ---- batch 33 (mutant-census) ----
  { key: "b33#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "probe in /tmp again (resolves to D:\\Data\\Temp) — recurrence of b22#2; the rule is process, its enforcement is the daily memory" },
  { key: "b33#1", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/scripts/total-gate.ts :: typecheck", reason: "" },
  { key: "b33#2", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "tool invocation locale (npx resolves deps from the wrong root outside the repo it serves); the sanctioned path (each repo's own npm run) is documented, not machine-forced" },
  { key: "b33#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "scout pipelines that swallow every signal; 'verify the filter passes signal' is process" },
  // ---- batch 34 (mutant-census) ----
  { key: "b34#0", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "source surgery through bash-inline regex (escaping ate the pattern, zero replacements silently); the edit-tools-not-pipes rule is process — nothing gates the author's tooling" },
  { key: "b34#1", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: E2", reason: "" },
  { key: "b34#2", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: E1", reason: "" },
  { key: "b34#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "phantom call in a render.ts edit caught by pre-flight self-review; the initial draft never reaches the machine, its errors still go to the record — process" },
  { key: "b34#4", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  { key: "b34#5", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: lint", reason: "" },
  { key: "b34#6", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: lint", reason: "" },
  { key: "b34#7", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
  // ---- batch 35 (mutant-census) ----
  { key: "b35#0", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b35#1", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "mutant-census/test/anchors.test.ts :: A-fire L2", reason: "" },
  { key: "b35#2", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: lint", reason: "" },
  { key: "b35#3", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: lint", reason: "" },
  { key: "b35#4", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
  // ---- batch 36 (dtc-clock) ----
  { key: "b36#0", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b36#1", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b36#2", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b36#3", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b36#4", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b36#5", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b36#6", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b36#7", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b36#8", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: Q4", reason: "" },
  { key: "b36#9", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b36#10", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b36#11", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b36#12", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a metric folded under another claim's name is a labeling crime, but no gate parses field semantics — the separate field ships and the record carries the lesson" },
  { key: "b36#13", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "tolerance calibration against a single run's number; the class-claim rule (tolerances state the category, not a snapshot) is author discipline — the witness gate checks the class, not the author's history" },
  { key: "b36#14", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "channel applied through dense Kraus multiplies — performance is correctness debt, but no workspace gate commands complexity; the mixture form ships" },
  { key: "b36#15", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "six-loop C^4 mis-estimated as C^3 — same class as b36#14; the block-mMul form ships, the estimate lesson is process" },
  { key: "b36#16", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "board literals drifting from witness numbers (rng consumption order); run-then-write is process — the rendered report vs witness-line read caught both drifts, no gate diffs prose against numbers" },
  { key: "b36#17", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc tangle, fourth offense (b10#8/b25#6/b26#1 family) — the Write-tool rule is now recorded in three batches; enforcement remains the author's habit" },
  { key: "b36#18", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  { key: "b36#19", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: lint", reason: "" },
  { key: "b36#20", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b36#21", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  // ---- batch 37 (ds_extracted/ds) ----
  { key: "b37#0", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: typecheck", reason: "" },
  { key: "b37#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "relative-root depth is author discipline (third offense of batch 29's class); no gate derives each file's own depth" },
  { key: "b37#2", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b37#3", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b37#4", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: format:check", reason: "" },
  { key: "b37#5", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b37#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "shell && chains and grep exit codes; operator discipline — no workspace gate commands the author's shell" },
  { key: "b37#7", category: "anchor-blindspot", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the dual EPOCH_REPOS lists (census + total-gate) are design debt; single-sourcing the repo list is booked future work, not a live gate" },
  // ---- batch 38 (phase-law) ----
  { key: "b38#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "draft residue caught by author re-read before any run; drafts that reach the disk go to the record — no gate reads the author's editor" },
  { key: "b38#1", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "tsx -e under Git Bash is silent for TS-importing one-liners (b14 family, second recurrence); the scratch-file rule is the enforcement" },
  // ---- batch 39 (phase-law) ----
  { key: "b39#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "an edit anchored on a section header must restore it — splice, not eat; author re-read caught both, no gate diffs comment structure" },
  // ---- batch 40 (phase-law) ----
  { key: "b40#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the header-swallow class, offenses three and four — the rule lives in the daily memory now; no gate diffs comment structure" },
  { key: "b40#1", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "phase-law/package.json :: test", reason: "" },
  // ---- batch 41 (phase-law) ----
  { key: "b41#0", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "phase-law/package.json :: test", reason: "" },
  { key: "b41#1", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "phase-law/package.json :: typecheck", reason: "" },
  { key: "b41#2", category: "process", tier: "GATE-ENFORCED", anchor: "phase-law/package.json :: test", reason: "" },
  // ---- batch 42 (dtc-clock) ----
  { key: "b42#0", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  { key: "b42#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "assertion anchors must be read from current text; prettier owns layout — no gate diffs intent" },
  { key: "b42#2", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  // ---- batch 43 (dtc-clock) ----
  { key: "b43#0", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  { key: "b43#1", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: lint", reason: "" },
  { key: "b43#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a MISS is a stop — anchor discipline on read text; no gate diffs intent" },
  // ---- batch 44 (dtc-clock) ----
  { key: "b44#0", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  { key: "b44#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc with template literals — the banned class, fourth family sighting; Write tool always" },
  { key: "b44#2", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  // ---- batch 45 (dtc-clock v0.5.0 armor dynamics) ----
  { key: "b45#0", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  { key: "b45#1", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  { key: "b45#2", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b45#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "exhaustive-cost discipline on the render's columns is an author budget call; no gate times the repro cell by cell" },
  { key: "b45#4", category: "anchor-blindspot", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "grep the on-disk text before anchoring (a parenthesis is part of the anchor); no gate diffs intent" },
  { key: "b45#5", category: "anchor-blindspot", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "long JSON strings get patched structurally via python json round-trip; no gate diffs intent" },
  { key: "b45#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the runner binary is not on the author shell's PATH; npm scripts resolve locally — no gate commands the author's shell" },
  { key: "b45#7", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b45#8", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
  { key: "b45#9", category: "process", tier: "GATE-ENFORCED", anchor: "burial-record/package.json :: test", reason: "" },
  // ---- batch 46 (mutant-census v0.5.0 G-board + burial-record B7) — born enrolled, both sides ----
  { key: "b46#0", category: "process", tier: "GATE-ENFORCED", anchor: "burial-record/package.json :: test", reason: "" },
  { key: "b46#1", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "tsx -e multiline under Git Bash is silent, fifth family sighting; the scratch-file rule is the enforcement — no gate commands the author's shell" },
  { key: "b46#2", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  { key: "b46#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "non-ascii anchors never through heredoc; Read+Edit always — no gate diffs intent" },
  { key: "b46#4", category: "toolchain", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: lint", reason: "" },
  { key: "b46#5", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/src/experiments/render.ts :: witness letters must be unique", reason: "" },
  // ---- batch 47 (mutant-census v0.6.0: letter guard + pre-flight card + B8) — born enrolled ----
  { key: "b47#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "law scope is design work — the pre-flight validation harness (validate against the full history before landing) is the discipline; no gate diffs a rule's intended scope" },
  { key: "b47#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc with escaped TS strings — the banned class, fifth sighting; Edit tool always, and escapes restructured away (join) so quoting layers have nothing to eat" },
  { key: "b47#2", category: "toolchain", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  { key: "b47#3", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
];
