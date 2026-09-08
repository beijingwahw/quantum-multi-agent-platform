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
 *     one mutant guards its whole registered class — and the conjugation
 *     class's per-error refinement is now MEASURED by the J-board (equiv.ts,
 *     laws J1-J3): collapse / error-level kill / proven equivalent / unbuildable,
 *     one verdict per error, live.
 *   GATE-ENFORCED — recurrence now fails a real build gate; the anchor is
 *     "workspace-relative/path :: needle", both verified LIVE on every run
 *     (E3, the B4 shape).
 *   BOOKED-UNENFORCEABLE — no machine can hold this line; the reason is
 *     mandatory (E4) and every booked row is printed on the report.
 *
 * v0.10.0 — the R-board repair audit (repair.ts) audited the whole booked
 * population with a decidable criterion (does a recurrence die at a
 * scheduled gate?): nine rows upgraded where the machine had convicted the
 * sighting itself or the gated trees kill the recurrence, fifteen sharpened
 * to name their faces (the b54#1 dual-face precedent), the rest held. The
 * audit is standing law — every booked row carries its verdict at birth.
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
  { key: "b10#8", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc truncation — banned house-wide by hard rule (Write tool, never heredoc); dual-face since v0.10.0: the ACT is ungated (nothing sees the shell channel), the truncated-file face is a syntax death at typecheck the moment it lands; booked: the act face only" },
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
  { key: "b12#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "path-resolution discipline (one climb does not fit all files); dual-face since v0.10.0: a wrong root aimed at a missing file dies loudly at the gate that loads it (ENOENT), a wrong root landing on a different existing file is silent; booked: the silent face only" },
  { key: "b12#7", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "witness-before-prose; the ledger law books costs on LEDGER rows, README rounding is author honesty — unenforceable line-by-line" },
  // ---- batch 13 (switch-sched) ----
  { key: "b13#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU2", reason: "" },
  { key: "b13#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b13#2", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU6", reason: "" },
  { key: "b13#3", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/audit.ts :: W-C", reason: "" },
  { key: "b13#4", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b13#5", category: "wrong-object", tier: "MUTANT-KILLED", anchor: "MU5", reason: "" },
  { key: "b13#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc-via-JSON patch pipeline — the banned heredoc class; dual-face since v0.10.0: the act is transient, the damaged-file face dies at typecheck if it lands; booked: the act face only" },
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
  { key: "b22#2", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "probe placed outside the repo (system temp); dual-face since v0.9.0: the ROOT face of the placement class is gate-held (rootStrayFiles), the system-temp face lives outside the workspace tree no scheduled gate can scan; booked: the outside-tree face only" },
  { key: "b22#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "law-label sequence (B0-B4 then B6) caught in self-review; no linter sequences labels" },
  // ---- batch 23 (readout-wall) ----
  { key: "b23#0", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE", reason: "" },
  { key: "b23#1", category: "dimension-slot", tier: "MUTANT-KILLED", anchor: "MU3", reason: "" },
  { key: "b23#2", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "readout-wall/package.json :: typecheck", reason: "" },
  { key: "b23#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "contract-reading on reuse (same idiom, different signature); dual-face since v0.10.0: the FAMILY-file face of the batch-23 class is gate-held (W-D byte-identity censuses it live), the non-family idiom face (report.ts) is review; booked: the non-family face only" },
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
  { key: "b25#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc truncation (render.ts) — the banned class; dual-face since v0.10.0: the act is ungated, a truncated file cannot compile — typecheck dies on the spot; booked: the act face only" },
  // ---- batch 26 (binding-price) ----
  { key: "b26#0", category: "conjugation", tier: "MUTANT-KILLED", anchor: "MU1", reason: "" },
  { key: "b26#1", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc truncation (probe.ts) — the banned class; dual-face since v0.10.0: the act is ungated, the truncated file is a syntax death in the gated tree; booked: the act face only" },
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
  { key: "b30#4", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "audit.ts indirection residue rewritten before boarding; dual-face since v0.10.0: the in-tree faces (unused indirections, void branches) die at lint/typecheck, the live-code placeholder face is review; booked: the pre-machine draft and the live-code face" },
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
  { key: "b33#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "probe in /tmp again (resolves to D:\\Data\\Temp) — recurrence of b22#2; dual-face since v0.9.0: the ROOT face is gate-held (rootStrayFiles), the outside-tree face stays booked; booked: the outside-tree face only" },
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
  { key: "b36#13", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b36#14", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "channel applied through dense Kraus multiplies — performance is correctness debt, but no workspace gate commands complexity; the mixture form ships" },
  { key: "b36#15", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "six-loop C^4 mis-estimated as C^3 — same class as b36#14; the block-mMul form ships, the estimate lesson is process" },
  { key: "b36#16", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "board literals drifting from witness numbers (rng consumption order); run-then-write is process — the rendered report vs witness-line read caught both drifts, no gate diffs prose against numbers" },
  { key: "b36#17", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc tangle, fourth offense (b10#8/b25#6/b26#1 family) — the Write-tool rule is recorded in every batch of this family; dual-face since v0.10.0: the act is ungated, the damaged-file face dies at the loader/typecheck the moment it lands (b47#1 was convicted exactly there); booked: the act face only" },
  { key: "b36#18", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  { key: "b36#19", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: lint", reason: "" },
  { key: "b36#20", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b36#21", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  // ---- batch 37 (ds_extracted/ds) ----
  { key: "b37#0", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: typecheck", reason: "" },
  { key: "b37#1", category: "process", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b37#2", category: "bogus-comparison", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b37#3", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b37#4", category: "toolchain", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: format:check", reason: "" },
  { key: "b37#5", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "ds_extracted/ds/package.json :: test", reason: "" },
  { key: "b37#6", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "shell && chains and grep exit codes; operator discipline — no workspace gate commands the author's shell" },
  { key: "b37#7", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/test/census.test.ts :: b37#7", reason: "" },
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
  { key: "b44#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc with template literals — the banned class; Write tool always; dual-face since v0.10.0: the structure-collapse face (unused variables, dead branches) dies at lint in-tree, the act face is ungated; booked: the act face only" },
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
  { key: "b47#1", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  { key: "b47#2", category: "toolchain", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  { key: "b47#3", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
  // ---- batch 48 (dtc-clock v0.6.0 tie reset) — born enrolled ----
  { key: "b48#0", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b48#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "non-ascii anchors never through heredoc (sixth sighting, one visit after the rule was written from the fifth); Edit tool always — and the repro output is grepped for the section face before closing" },
  { key: "b48#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "reread after every programmatic write; the tool's refusal is the guard — no gate schedules the author's read/write interleaving" },
  // ---- batch 49 (dtc-clock v0.7.0 binomial shadow law) — born enrolled ----
  { key: "b49#0", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "tsx -e is never OK — the failure mode is silent, not always-fatal; the scratch-file rule is unconditional (seventh sighting)" },
  { key: "b49#1", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: typecheck", reason: "" },
  { key: "b49#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "scratch files live in the repo — temp-dir placement breaks relative resolution; dual-face since v0.9.0: the ROOT face is gate-held (rootStrayFiles); the system-temp face is outside the tree; booked: the outside-tree face only" },
  { key: "b49#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the Bash tool layer eats one escape level even past quoted heredocs (root cause named, live-probed) — backslash-bearing code never through the Bash channel; Edit/Write exclusively" },
  // ---- batch 50 (dtc-clock v0.8.0 spectral law) — born enrolled ----
  { key: "b50#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the backslash rule is a pre-flight checklist item, not knowledge — eighth sighting, minutes after the rule was written; Edit/Write by default" },
  { key: "b50#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "derivation conventions are verified by numeric probes in the scratch harness (reversibility, symmetry, orientation) — no gate reviews a derivation, the probes do" },
  { key: "b50#2", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  // ---- batch 51 (dtc-clock v0.10.0 Krawtchouk spectrum) — born enrolled ----
  { key: "b51#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "draft residue caught by the author's reread before any run — no gate reads drafts" },
  { key: "b51#1", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b51#2", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b51#3", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: lint", reason: "" },
  { key: "b51#4", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "nested quotes break in the Bash channel exactly as backslashes do — Edit tool for any code-bearing patch" },
  { key: "b51#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "numeric prose gets the same read-back as code — the verbatim-anchor match is what exposed the transposition" },
  { key: "b51#6", category: "process", tier: "GATE-ENFORCED", anchor: "burial-record/package.json :: test", reason: "" },
  { key: "b51#7", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heading edits scope by the full unique line, never the count phrase — no gate scopes a replace; B8 catches the aftermath" },
  // ---- batch 52 (dtc-clock v0.11.0 RS closed form) — born enrolled ----
  { key: "b52#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "probe points must exercise every branch — a lucky pass on an unfired path is not a proof; the scratch cross-check is the discipline" },
  { key: "b52#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "polynomial coefficients assemble from the whole expression factor by factor — the Richardson cross-check locates missing pieces by their exact signature" },
  { key: "b52#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the backslash rule is a pre-flight checklist item (patch contains a backslash = Edit tool) — repeat sightings prove knowledge alone does not execute" },
  // ---- batch 53 (dtc-clock v0.12.0 general-n law) — born enrolled ----
  { key: "b53#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the Edit-before-Read refusal class recurs (b48#2, twice this visit): a shell view is not a Read — the tool's read-state tracker decides; the refusal is the guard" },
  { key: "b53#1", category: "process", tier: "GATE-ENFORCED", anchor: "burial-record/package.json :: test", reason: "" },
  { key: "b53#2", category: "toolchain", tier: "GATE-ENFORCED", anchor: "burial-record/package.json :: lint", reason: "" },
  { key: "b53#3", category: "process", tier: "GATE-ENFORCED", anchor: "burial-record/package.json :: test", reason: "" },
  { key: "b53#4", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
  { key: "b53#5", category: "anchor-blindspot", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: repro", reason: "" },
  { key: "b53#6", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
  // ---- batch 54 (mutant-census v0.8.0 J-board) — repaired in v0.9.0: two tiers
  // upgraded where the BOOKED reason went false (the b46#5 pattern), one reason
  // made precise where the boundary honestly survives ----
  { key: "b54#0", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/src/kernel/census.ts :: rootStrayFiles", reason: "" },
  { key: "b54#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the import-home class has two faces: in any file under the typecheck trees the defect fails the gate on the spot (TS2305 — the b46#2 precedent already holds that face); the SCRATCH face is transient — no build gate reviews a file deleted before gates run, and Node's first-run refusal is instant but instant is not a gate. Booked: the scratch face only" },
  { key: "b54#2", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  // ---- batch 65 (mutant-census v0.9.0 b54 repair) — born enrolled ----
  { key: "b65#0", category: "process", tier: "GATE-ENFORCED", anchor: "burial-record/package.json :: test", reason: "" },
  { key: "b65#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "cross-session stale read-state — the Edit tool's read-state tracker is the line and it bit; no build gate sees another session's writes, the refusal is the guard (b48#2 class, cross-session variant)" },
  // ---- batch 55 (stable-world v0.2.0 coherent face priced + thermal reading shipped) — born enrolled ----
  { key: "b55#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "reread between Write and run is a fixed step of writing — residue rides every first draft (b54#2 class, three sightings in this one visit)" },
  { key: "b55#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a fix that adds text gets its own reread — the second residue lived in the replacement, minutes after enrolling the first" },
  { key: "b55#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "draft constructions are replaced whole, not patched around — a construction needing a dead branch to compile is the wrong construction" },
  { key: "b55#3", category: "citation-drift", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "identifier-grade bibliographic digits (arXiv numbers, DOIs, volume/page) are verified against the source before writing — memory holds the shape, never the digits" },
  { key: "b55#4", category: "toolchain", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: lint", reason: "" },
  { key: "b55#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "anchors and replacement text go through the disk — grep the needle before the patch, reread the replacement (b45 edit-anchor family)" },
  { key: "b55#6", category: "statistics", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "small probabilities in the cancellation-free arrangement, never 1-minus-a-near-one; a suspicious exact zero in witness output is a bug until proven a floor" },
  // ---- batch 56 (stable-world v0.3.0 microscopic bath + coherent shortcut) — born enrolled ----
  { key: "b56#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "residue is the default assumption for a first draft; reread is the factory inspection (fourth sighting of the b54#2 class)" },
  { key: "b56#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a construction that needs a dead branch to compile is the wrong construction — same class, second file, same visit" },
  { key: "b56#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "(b54#1 class) dual-face since v0.10.0: the SCRATCH face is booked (refused at first run, gone before gates), the product-tree twin face is TS2305 on the scheduled typecheck (the b46#2 precedent — b56#3 rides it)" },
  { key: "b56#3", category: "process", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: typecheck", reason: "" },
  { key: "b56#4", category: "wrong-object", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a check built on the wrong object convicts the innocent — the dephased matrix means diagonal-only; S(copy)-S(rho)=0 always" },
  { key: "b56#5", category: "wrong-object", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "phase-carrying objects get phase-invariant assertions (purity + coherence bits), never equality to a fixed reference state" },
  { key: "b56#6", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a failed patch is a stop, not a skip: multi-line patches through the Edit tool, and evidence files survive until the corrected run has produced its numbers" },
  { key: "b56#7", category: "process", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: test", reason: "" },
  { key: "b56#8", category: "process", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: test", reason: "" },
  { key: "b56#9", category: "citation-drift", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "citation YEARS are identifier-grade data: memory holds the shape, the sources hold the digits (Davies 1974, not 1976)" },
  // ---- batch 57 (stable-world v0.4.0 continuum limit + audit ledger) — born enrolled ----
  { key: "b57#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "'making the checker quiet' is not cleanup — unused imports are removed, never voided" },
  { key: "b57#1", category: "wrong-object", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a closed form ships with its domain: the T=0 block form fails at finite beta where dark-pair freezing turns the mixing 2x2" },
  { key: "b57#2", category: "wrong-object", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "tightness assertions compare the object being banked (the sector bit), not a convenient superset (the full-basis total)" },
  { key: "b57#3", category: "process", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: typecheck", reason: "" },
  { key: "b57#4", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "arithmetic residue inside a live expression is worse than dead code — expressions get reread as formulas, not just as syntax" },
  { key: "b57#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "board numbers are the WITNESS's numbers: every census interval on the board is re-derived from the witness output before it ships" },
  // ---- batch 58 (dtc-clock v0.13.0 third-order coefficient) — born enrolled ----
  { key: "b58#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "derivation conventions get their own numeric probes before assembly — the two-point eigenvalue arbiter convicted every draft (the b50 law, recurring)" },
  { key: "b58#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a printed ZERO is not a finding until the loop that printed it is nonempty — vacuous evidence is the empty-set twin of a lucky pass" },
  { key: "b58#2", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  // ---- batch 59 (stable-world v0.5.0 generator identified + phase-alignment bank; visit renumbered 63 -> 64 against the parallel session's batch 58) — born enrolled ----
  { key: "b59#0", category: "process", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: typecheck", reason: "" },
  { key: "b59#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a check's arithmetic gets a known-answer test case before it is trusted (the self-dividing sup ratio could never fail)" },
  { key: "b59#2", category: "wrong-object", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "conjugation/phase conventions are written down BEFORE the code — which side carries the conjugate decides the sign" },
  { key: "b59#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "'this time it was harmless' is exactly how the heredoc family survives — code files go through the Write tool, no content-based exceptions" },
  { key: "b59#4", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "residue is a per-draft constant and the reread is the factory gate that assumes it" },
  { key: "b59#5", category: "toolchain", tier: "GATE-ENFORCED", anchor: "stable-world/package.json :: typecheck", reason: "" },
  { key: "b59#6", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "insertion anchors place new rows after their predecessors, and a one-line grep of the id order follows every board insertion — order is part of the face" },
  { key: "b59#7", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "multi-line needles with escapes go through the Edit tool from the start — the channel has refused the same patch class three times" },
  // ---- batch 60 (dtc-clock v0.14.0 quotient-face law) — born enrolled ----
  { key: "b60#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "constructions are replaced whole, not patched around (the b55 class, replayed on a different constructor)" },
  { key: "b60#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "residue per draft, reread per file — seven sightings across four visits: a constant of the process, not a lapse" },
  { key: "b60#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the horizon is a PRE-RUN decision — a superlinear-cost face gets its census cap priced before the first run, not after a stall" },
  { key: "b60#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "(b54#1 class) dual-face since v0.10.0: the scratch face is booked; the product-tree face (importing a private member) is TS2305 on the scheduled typecheck — the b46#2 precedent" },
  { key: "b60#4", category: "statistics", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "BigInt quotients reach floats through scaled division — the overflow twin of the cancellation lesson (b55#6)" },
  { key: "b60#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "read the function's actual SHAPE before patching — shape is part of the anchor" },
  { key: "b60#6", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the channel's fourth refusal of the same patch class: prose sections go through the Edit tool, no exception clause" },
  { key: "b60#7", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  // ---- batch 61 (dtc-clock v0.15.0 coupling closed forms) — born enrolled ----
  { key: "b61#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the reconciliation anchor is pinned BEFORE the reconstruction — closed forms assembled by substitution, the machine does the arithmetic" },
  { key: "b61#1", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  // ---- batch 62 (dtc-clock v0.16.0 9/8 assembled) — born enrolled ----
  { key: "b62#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "when an assembly path NaNs, re-choose the deliverable shape — the machine-provable form outranks the hand-assembled expression" },
  { key: "b62#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the cleaning pass is practice now: unused imports removed, voids never shipped (eighth sighting, pre-caught)" },
  // ---- batch 63 (dtc-clock v0.17.0 arcsine law) — born enrolled ----
  { key: "b63#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a split condition is a definition of which side is which; dual-face since v0.10.0: the scratch-analysis face is booked, the in-tree guard-boolean face is suite-held (b61#1's inverted guard was convicted by the tests); read the orientation against one concrete k before trusting the zeros" },
  { key: "b63#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the identity chain goes up BEFORE the asymptotic analysis — global factors have nowhere to hide on a chain" },
  { key: "b63#2", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  // ---- batch 64 (dtc-clock v0.18.0 constant pinned) — born enrolled ----
  { key: "b64#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "'this time it was harmless' is the heredoc family's survival mode, tenth enrollment — scratch files go through the Write tool, no content-based exceptions" },
  { key: "b64#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a Bash command is itself a deliverable — read the whole line before sending, not just the new part" },
  // ---- batch 66 (dsic-noether v0.2.0 continuum derivation) — born enrolled ----
  { key: "b66#0", category: "conjugation", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: test", reason: "" },
  { key: "b66#1", category: "conjugation", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: test", reason: "" },
  { key: "b66#2", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: test", reason: "" },
  { key: "b66#3", category: "process", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: test", reason: "" },
  { key: "b66#4", category: "conjugation", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: test", reason: "" },
  { key: "b66#5", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the orientation logic lives in the renderer (exp5), which no scheduled gate runs; the SAME logic is gated in the test tree's skew case under :: test — the renderer face is unenforceable (the b54#1 dual-face precedent)" },
  { key: "b66#6", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: typecheck", reason: "" },
  { key: "b66#7", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: test", reason: "" },
  { key: "b66#8", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: lint", reason: "" },
  { key: "b66#9", category: "process", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: lint", reason: "" },
  { key: "b66#10", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dsic-noether/package.json :: lint", reason: "" },
  { key: "b66#11", category: "process", tier: "GATE-ENFORCED", anchor: "burial-record/package.json :: test", reason: "" },
  // ---- batch 67 (mutant-census v0.10.0 R-board repair audit) — born enrolled AND born audited ----
  { key: "b67#0", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the context-dump scratch was created through a bash heredoc — the banned channel, eleventh family sighting, committed while building the repair-audit board itself; dual-face per the family law: the act face is ungatable, the damaged-file face dies at the loader (the b47#1 twin); booked: the act face only" },
  { key: "b67#1", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: lint", reason: "" },
  { key: "b67#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a nonsense chained identity copy (slice+concat rebuilding the same array) in a test draft caught on reread — live-code construction residue compiles and passes; the class's unused-symbol faces die at lint (b67#1 rides that face), the live-code face is review; booked: the pre-machine face" },
  { key: "b67#3", category: "toolchain", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: lint", reason: "" },
  { key: "b67#4", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the b12#6 needle transcribed from memory with an added word — the Edit refused it; patch-act face, the refusal is the guard (b45#4 family); booked: the act face only" },
  { key: "b67#5", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
  // b67#6 flipped one visit later under R1's standing law: the priced
  // refutation target (a stated-counts gate) got its machine (E7, v0.11.0)
  // and the row upgraded in the same act — the audit row flipped with it.
  { key: "b67#6", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/test/census.test.ts :: E7", reason: "" },
  // ---- batch 68 (mutant-census v0.11.0 deep check + E7) — born enrolled ----
  { key: "b68#0", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/test/census.test.ts :: E7", reason: "" },
  { key: "b68#1", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  { key: "b68#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the daily-note insertion anchored on the visit-72 section heading and CONSUMED it (the b39#0/b40#0 class, recurrence); dual-face since v0.14.0: the AFTERMATH face (the orphaned tail line the swallow leaves, the repeated-label signature, verbatim heading doubles) is gate-held by B9 — the swallowed heading's ABSENCE has no should-exist oracle and stays booked; the section-face grep after every insertion remains the act-face discipline" },
  // ---- batch 69 (mutant-census v0.12.0 wrong-object per-error census) — born enrolled, born audited ----
  { key: "b69#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the W-I witness detail's first draft shipped a nonsense expression and a self-note ('wait, computed below') inside the template string — caught on the post-edit reread before any machine; pre-machine draft residue (the b55#0 class), the reread is the factory check" },
  { key: "b69#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the b36#7 Edit anchor was written from memory with prototype MU5 where the disk reads MU1 — the Edit refusal caught it (the b45#4 anchor-from-memory family); needles are copied from the disk, never recalled" },
  { key: "b69#2", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  // ---- batch 70 (mutant-census v0.13.0 four-class per-error census) — born enrolled, born audited ----
  { key: "b70#0", category: "toolchain", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: typecheck", reason: "" },
  { key: "b70#1", category: "process", tier: "GATE-ENFORCED", anchor: "mutant-census/package.json :: test", reason: "" },
  { key: "b70#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a no-op assertion (Number.isNaN(0) || true) drafted into the new machine-facts test — a check that can never fail is worse than no check; caught on reread before any run; booked: the pre-machine draft face (the b59#1 class)" },
  // b70#3 flipped one visit later under R1's standing law (the second priced
  // refutation target to get its machine): the memory-structure gate (B9,
  // v0.5.0 of the record) holds the duplication-signature face; the audit
  // row flipped with it in the same act.
  { key: "b70#3", category: "process", tier: "GATE-ENFORCED", anchor: "burial-record/src/kernel/audit.ts :: memoryStructureViolations", reason: "" },
  // ---- batch 71 (same-visit enrollment of the closing-stage slip) — born enrolled, born audited ----
  { key: "b71#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the closing verification command launched a SECOND total gate with a detached shell & — the whole line not read before sending (the b64#1 class); the stray raced the tracked instance (wall-sum 650s -> 924s), both green by luck; booked: the command-act face (no gate inspects the author's shell; read-the-whole-line is the discipline)" },
  // ---- batch 72 (burial-record v0.5.0 B9 + the v0.14.0 flip) — born enrolled, born audited ----
  { key: "b72#0", category: "wrong-object", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "B9's first draft held visit-number uniqueness as its invariant — FALSE: the history legitimately carries two-section visits (三十九访双段, 二十九访两节) and the loose parser also matched 纪元五访客/版图 headings; the live first run convicted four false positives before anything landed; booked: the law-design face (no scheduled gate reviews an invariant's truth — the live-first-run probe is the discipline)" },
  { key: "b72#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "an insertion Edit meant to add the A-fire B9 test instead dropped a structural newline (the old_string carried it, the new_string didn't) — the following line glued up; caught on the immediate reread; booked: the edit-act face (no gate diffs formatting intent; read-back after every structural insert)" },
  // ---- batch 73 (dtc-clock v0.19.0 the singular EM assembly) — born enrolled ----
  { key: "b73#0", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b73#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "scratch mechanical trio (undefined local, missing brace, Richardson divisor in the wrong space) — scratch dies before gates by design; the kernel's richardsonLimit handles arbitrary ratios and its outputs are gate-asserted" },
  { key: "b73#2", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the O(K^2) BigInt loop hang has no non-timeout gate — the incremental recurrence it became is spot-checked under :: test; the complexity-estimate discipline is the booking" },
  { key: "b73#3", category: "wrong-object", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the mismatched-scale comparison frame produced confident nonsense until scrapped — no scheduled gate audits the choice of comparison frame (the scale-first discipline is the booking)" },
  { key: "b73#4", category: "statistics", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the fit beyond the cancellation noise floor (b55#6's class at a new subtraction): the second-law value is asserted at k=8192 under :: test — the beyond-floor face is author discipline" },
  { key: "b73#5", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b73#6", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b73#7", category: "toolchain", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b73#8", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b73#9", category: "process", tier: "GATE-ENFORCED", anchor: "dtc-clock/package.json :: test", reason: "" },
  { key: "b73#10", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the visit/batch resync is pre-gate by construction — no scheduled gate numbers visits; the grep-the-registry-first discipline is the booking (the b65 law, executed pre-emptively here)" },
  // ---- batch 74 (the four-repo delivery wave's registry wiring) — born enrolled, born audited ----
  { key: "b74#0", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "shell-act face: the masking pipe lives in the author's shell, which no scheduled gate inspects; the conviction came from the CI runner — unreachable from this workspace (the b2#3 GENESIS-C boundary); the exit-code-masking family's sixth sighting (b4#3, b37#6, b43#2, b64#1, b71#0 the five before it)" },
  { key: "b74#1", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "dual-face placement class (b22#2/b33#0/b49#2 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the /tmp face resolves outside the workspace tree where no scheduled gate scans. Booked: the outside-tree face only" },
  { key: "b74#2", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "the same-day recurrence of b74#0's class (the family's seventh sighting): $? after a pipe is the tail's code — a shell-act face no scheduled gate reads; PIPESTATUS is the discipline" },
  { key: "b74#3", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "agent-discipline act face: the git ban is delivery protocol and no scheduled gate observes a delivery agent's commands — read-only grades the offense, it does not unmake the ban" },
  { key: "b74#4", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "pre-machine reread face (the b55#0 class): the no-op edit was caught on reread before any run — no gate reads the editor buffer" },
  { key: "b74#5", category: "citation-drift", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "external-truth face (the b55#3 class): a citation's claim text is verified against the publisher's record by the author's double-source ritual — no local gate reaches the source; deletion on the spot is the ritual executed" },
  { key: "b74#6", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "delivery-hygiene face: the in-tree residue died at the successors' gates (lint/typecheck/test convicted it until closure), but the leaving-behind act — stale README, missing report tables — is interruption process no gate diffs" },
  { key: "b74#7", category: "process", tier: "GATE-ENFORCED", anchor: "phase-law/package.json :: test", reason: "" },
  { key: "b74#8", category: "wrong-object", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "claim-object face (the b57#2 superset class): no gate parses which population a verdict's prose names — the 6×8-specific restatement is the fix; prose-vs-witness reconciliation is priced, not built" },
  { key: "b74#9", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "dual-face: the act face (rewritten on the spot, pre-machine) is booked; a require() landing in the ESM tree is a loader death the test/typecheck gates convict the moment it lands (the b47#1 precedent). Booked: the act face only" },
  { key: "b74#10", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "scratch-arbitration face (the b52#0 class): the bad unitary and the withdrawn 'transpose fix' lived in scratch and were refuted by variant enumeration — an author's probe, not a scheduled gate" },
  { key: "b74#11", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "pre-machine draft face: the apostrophe was caught before any run; the landing face is a parser death at typecheck. Booked: the act face only" },
  { key: "b74#12", category: "toolchain", tier: "GATE-ENFORCED", anchor: "switch-sched/package.json :: lint", reason: "" },
  { key: "b74#13", category: "conjugation", tier: "GATE-ENFORCED", anchor: "switch-sched/test/process.test.ts :: identity channel gives SWAP", reason: "" },
  { key: "b74#14", category: "statistics", tier: "GATE-ENFORCED", anchor: "switch-sched/test/process.test.ts :: eigenvalues exactly {0, ½}", reason: "" },
  { key: "b74#15", category: "statistics", tier: "GATE-ENFORCED", anchor: "switch-sched/test/process.test.ts :: 8192 vertices", reason: "" },
  { key: "b74#16", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "nonstoq-anneal/package.json :: test", reason: "" },
  { key: "b74#17", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "nonstoq-anneal/package.json :: test", reason: "" },
  { key: "b74#18", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "nonstoq-anneal/package.json :: test", reason: "" },
  { key: "b74#19", category: "toolchain", tier: "GATE-ENFORCED", anchor: "nonstoq-anneal/package.json :: typecheck", reason: "" },
  // ---- batch 75 (the second four-repo delivery wave's wiring) — born enrolled, born audited ----
  { key: "b75#0", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "route-price/test/dossier.test.ts :: R5: all executable witnesses pass", reason: "" },
  { key: "b75#1", category: "toolchain", tier: "GATE-ENFORCED", anchor: "route-price/package.json :: lint", reason: "" },
  { key: "b75#2", category: "statistics", tier: "GATE-ENFORCED", anchor: "causal-ineq/test/causal-ineq.test.ts :: W* eigenvalues exactly {0, 1/2}", reason: "" },
  { key: "b75#3", category: "dimension-slot", tier: "GATE-ENFORCED", anchor: "causal-ineq/test/causal-ineq.test.ts :: OCB12 eq. (7)", reason: "" },
  { key: "b75#4", category: "process", tier: "GATE-ENFORCED", anchor: "causal-ineq/test/causal-ineq.test.ts :: noise threshold exactly eta = 1/sqrt(2)", reason: "" },
  { key: "b75#5", category: "toolchain", tier: "GATE-ENFORCED", anchor: "causal-ineq/package.json :: lint", reason: "" },
  { key: "b75#6", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "dual-face placement class (b22#2/b33#0/b49#2/b74#1 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the /tmp face lives outside the workspace tree where no scheduled gate scans. Booked: the outside-tree face only" },
  { key: "b75#7", category: "citation-drift", tier: "GATE-ENFORCED", anchor: "switch-sched/docs/citations.md :: 10.1038/s41467-023-40162-8", reason: "" },
  { key: "b75#8", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "k-switch/test/k4.test.ts :: ZERO commuting Pauli quadruples exist at d=4", reason: "" },
  { key: "b75#9", category: "machine-overruled", tier: "GATE-ENFORCED", anchor: "k-switch/test/k4.test.ts :: constructed matched pair outside the Pauli universe", reason: "" },
  { key: "b75#10", category: "conjugation", tier: "GATE-ENFORCED", anchor: "k-switch/test/k4.test.ts :: the generator's Pauli ray", reason: "" },
  { key: "b75#11", category: "dimension-slot", tier: "GATE-ENFORCED", anchor: "k-switch/test/k4.test.ts :: Algorithm 1 reads the promise column with probability 1 exactly", reason: "" },
  { key: "b75#12", category: "wrong-object", tier: "GATE-ENFORCED", anchor: "k-switch/test/k4.test.ts :: NO plain order separates ANY column pair", reason: "" },
  { key: "b75#13", category: "toolchain", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "heredoc act face — the banned channel's twelfth canonical sighting (the family's wrong-text sightings grep to 16 in-registry, counted before enrolling); no machine sees the channel, the Write-tool rule is the guard, and the damaged-file face dies at the loader/typecheck the moment it lands (the b47#1 twin). Booked: the act face only" },
  { key: "b75#14", category: "statistics", tier: "GATE-ENFORCED", anchor: "postselect-sched/test/t5-power-ledger.test.ts :: branch ratio = integer ratio on real 3-SAT", reason: "" },
  { key: "b75#15", category: "statistics", tier: "GATE-ENFORCED", anchor: "postselect-sched/test/t6-tieface.test.ts :: exact tie iff d | a1^2", reason: "" },
  { key: "b75#16", category: "toolchain", tier: "GATE-ENFORCED", anchor: "postselect-sched/package.json :: typecheck", reason: "" },
  { key: "b75#17", category: "toolchain", tier: "GATE-ENFORCED", anchor: "postselect-sched/package.json :: lint", reason: "" },
  { key: "b75#18", category: "toolchain", tier: "GATE-ENFORCED", anchor: "postselect-sched/src/experiments/run-all.ts :: call the mains directly", reason: "" },
];
