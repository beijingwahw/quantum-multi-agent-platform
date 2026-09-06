/**
 * THE ENROLLMENT GENERATOR — emits src/kernel/enrollment.ts from the LIVE
 * registry plus this decision table. Maintainer tool, not a gate: the E-board's
 * live census (E1-E6) is the authority; this file exists so the table's
 * provenance (which category defaults where, which rows deviate and why) is
 * reviewable data rather than a diff.
 *
 * Refuses to emit unless EVERY row is decided and EVERY anchor is live.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MUTANTS } from "../src/kernel/family.js";

type Decision = { tier: "MUTANT-KILLED"; anchor: string; reason?: string } | { tier: "GATE-ENFORCED"; anchor: string; reason?: string } | { tier: "BOOKED-UNENFORCEABLE"; reason: string; anchor?: string };

const G = (path: string, needle: string): Decision => ({ tier: "GATE-ENFORCED", anchor: `${path} :: ${needle}` });
const M = (id: string): Decision => ({ tier: "MUTANT-KILLED", anchor: id });
const B = (reason: string): Decision => ({ tier: "BOOKED-UNENFORCEABLE", reason });

/** category defaults; toolchain and process have NONE — every row is decided by hand */
const DEFAULTS: Record<string, Decision | null> = {
  conjugation: M("MU1"),
  "dimension-slot": M("MU3"),
  "wrong-object": M("MU5"),
  statistics: M("MU8"),
  "anchor-blindspot": G("mutant-census/src/kernel/audit.ts", "W-C"),
  "citation-drift": G("burial-record/src/kernel/audit.ts", "B4"),
  "bogus-comparison": G("mutant-census/src/kernel/audit.ts", "Q4"),
  "machine-overruled": null, // decided per row: the gate that did the overruling
  toolchain: null,
  process: null,
};

/** per-key overrides, deviations from the category default */
const O: Record<string, Decision> = {
  // -- conjugation: state-BUILD conjugations sit on MU2 (vecToRho), the rest on MU1 (vInner)
  "b10#7": M("MU2"), "b13#0": M("MU2"), "b15#2": M("MU2"), "b20#0": M("MU2"), "b30#0": M("MU2"),
  // -- dimension-slot: missing tensor-identity -> MU4; transposed/flat indices -> MU6
  "b24#0": M("MU4"), "b13#2": M("MU6"), "b24#1": M("MU6"), "b31#0": M("MU6"),
  // -- wrong-object: wrong limit/level object -> MU7
  "b6#2": M("MU7"), "b17#4": M("MU7"), "b31#3": M("MU7"),
  // -- statistics: denominator-class -> MU9
  "b5#0": M("MU9"), "b5#2": M("MU9"), "b5#4": M("MU9"), "b5#5": M("MU9"), "b11#4": M("MU9"), "b16#1": M("MU9"), "b19#3": M("MU9"), "b27#1": M("MU9"), "b30#3": M("MU9"),
  // -- anchor-blindspot: the phase-sensitive dual-path law is the live anti-blindness anchor for conjugation-adjacent blindness
  "b9#0": G("mutant-census/src/kernel/battery.ts", "PHASE-SENSITIVE"),
  "b17#0": G("mutant-census/src/kernel/battery.ts", "PHASE-SENSITIVE"),
  "b23#0": G("mutant-census/src/kernel/battery.ts", "PHASE-SENSITIVE"),
  "b32#5": G("mutant-census/src/kernel/census.ts", "unguardedEntryFiles"),
  "b33#1": G("mutant-census/scripts/total-gate.ts", "typecheck"),
  // -- citation-drift: module-map imports are resolved by the typechecker, not by anchor law
  "b23#2": G("readout-wall/package.json", "typecheck"),
  "b31#6": G("stable-world/package.json", "typecheck"),
  "b31#7": G("stable-world/package.json", "typecheck"),
  "b32#6": G("mutant-census/src/kernel/audit.ts", "provenanceRepos"),
  // -- bogus-comparison: headline-cost comparisons are re-derived by the ledger's own witnesses
  "b14#0": G("depreciation-ledger/src/kernel/audit.ts", "L6"),
  "b11#7": B("aggregation order (sum of per-seed ratios vs ratio of sums) — comparison design; no property pins aggregation semantics, booked"),
  "b29#4": B("displayed fractions must point at their true denominator; print-layer honesty — no gate formats the register"),
  "b30#1": B("toExponential(6) masks 1+2.1e-8 as 1.000000e+0; display precision is print-layer, the witness columns carry the true digits — the format itself is not gated"),
  // -- machine-overruled: b32#0 was convicted by the kill-census law itself
  "b32#0": G("mutant-census/src/kernel/audit.ts", "Q2"),
  // -- toolchain: gates where a live one exists
  "b1#0": G("ds_extracted/ds/package.json", "typecheck"),
  "b2#4": G("ds_extracted/ds/tsconfig.json", "exactOptionalPropertyTypes"),
  "b2#5": G("ds_extracted/ds/package.json", "format:check"),
  "b4#4": G("ds_extracted/ds/package.json", "format:check"),
  "b3#2": G("ft-qaoa/tsconfig.json", "exactOptionalPropertyTypes"),
  "b3#3": G("ft-qaoa/package.json", "test"),
  "b12#0": G("bqp-map/package.json", "test"),
  "b18#6": G("dsic-noether/package.json", "test"),
  "b21#2": G("mutant-census/src/kernel/census.ts", "unguardedEntryFiles"),
  "b24#5": G("mutant-census/scripts/total-gate.ts", "typecheck"),
  "b24#6": G("nosignal-tariff/package.json", "test"),
  "b29#3": G("survivor-census/package.json", "test"),
  "b32#12": G("mutant-census/package.json", "typecheck"),
  "b30#5": G("ent-clearing/package.json", "typecheck"),
  // -- toolchain: booked, with reasons
  "b2#6": B("host-interpreter assumption (python3 on this Windows box); no workspace gate commands the environment — environment lesson, process only"),
  "b2#7": B("push-failure diagnosis (network vs auth vs remote); operator judgment, no machine gate"),
  "b4#3": B("shell retry-loop exit-code semantics; the loop's honesty is the author's check — process"),
  "b10#8": B("heredoc truncation — banned house-wide by hard rule (Write tool, never heredoc); enforcement is process, nothing gates the author's tooling"),
  "b12#6": B("path-resolution discipline (one climb does not fit all files); no gate derives each file's depth generically"),
  "b13#6": B("heredoc-via-JSON patch pipeline — the banned heredoc class; process only"),
  "b14#4": B("tsx -e quirks under Git Bash; environment lesson, no gate"),
  "b22#2": B("probe placed outside the repo (system temp); the batch-33 rule (probes live in-repo) is process — no gate scans the author's scratch location"),
  "b25#6": B("heredoc truncation (render.ts) — the banned class; process only"),
  "b26#1": B("heredoc truncation (probe.ts) — the banned class; process only"),
  "b33#0": B("probe in /tmp again (resolves to D:\\Data\\Temp) — recurrence of b22#2; the rule is process, its enforcement is the daily memory"),
  "b33#2": B("tool invocation locale (npx resolves deps from the wrong root outside the repo it serves); the sanctioned path (each repo's own npm run) is documented, not machine-forced"),
  // -- process: gates where a live one exists
  "b1#1": G("ds_extracted/ds/package.json", "test"),
  "b1#2": G("ds_extracted/ds/package.json", "test"),
  "b1#3": G("ds_extracted/ds/package.json", "test"),
  "b1#4": G("depreciation-ledger/src/kernel/audit.ts", "L2"),
  "b2#1": G("ds_extracted/ds/package.json", "test"),
  "b3#1": G("ft-qaoa/package.json", "test"),
  "b6#5": G("depreciation-ledger/src/kernel/audit.ts", "L1"),
  "b12#4": G("bqp-map/package.json", "test"),
  "b24#7": G("mutant-census/src/kernel/audit.ts", "W-C"),
  "b32#10": G("mutant-census/package.json", "repro"),
  // -- process: booked, with reasons
  "b2#3": B("TS-Python parity lives in CI; the local workspace cannot gate GitHub Actions — booked until CI is reachable"),
  "b8#5": B("threshold policy is experiment design; what the engine schedules was corrected by hand — no gate chooses policy"),
  "b9#5": B("instance-set design (brute force vs 20k random search); methodological judgment, no gate"),
  "b9#6": B("instance-set strength claim; hard instances are design work, not a gate"),
  "b10#6": B("search-effort budgeting (the compass grind); abandoned by judgment, nothing to enforce"),
  "b10#9": B("the diagnostic script is never the trusted side; process rule, no gate"),
  "b12#7": B("witness-before-prose; the ledger law books costs on LEDGER rows, README rounding is author honesty — unenforceable line-by-line"),
  "b14#5": B("which rows weaken a table is editorial; the ledger's both-columns law does not judge row selection"),
  "b19#5": B("README worded by the expected limit; prose honesty, no machine gate"),
  "b21#3": B("hand-computed price column corrected by the witness (9977.87 -> 9977.19); witness-before-prose is process"),
  "b22#3": B("law-label sequence (B0-B4 then B6) caught in self-review; no linter sequences labels"),
  "b23#3": B("contract-reading on reuse (same idiom, different signature); practice, no gate compares idioms"),
  "b25#1": B("third-draft discipline; drafts that never reach the machine cannot be gated — the rule is process"),
  "b27#0": B("design-before-code (the TM encoding collapsed twice mid-write); process"),
  "b28#3": B("count-after-construction (21 built, 20 shipped); the instance census is author discipline"),
  "b29#5": B("draft residue reaching the machine; unused symbols are tsc-gated, live-code residue (`| \"\"`) is review"),
  "b30#4": B("audit.ts indirection residue rewritten before boarding; pre-flight review, process"),
  "b32#7": B("display heuristics (sigma vs raw units); the formatting law lives in prose, no gate parses intent"),
  "b32#9": B("edit residue in mutant construction; the kill census verifies KILLS, residue-free construction is authorship"),
  "b32#11": B("tree-walk style rewritten before boarding; never reached the machine — process"),
  "b33#3": B("scout pipelines that swallow every signal; 'verify the filter passes signal' is process"),
  // -- batch 34 (this repo, the v0.3.0 delivery) — the first batch born already-enrolled
  "b34#0": B("source surgery through bash-inline regex (escaping ate the pattern, zero replacements silently); the edit-tools-not-pipes rule is process — nothing gates the author's tooling"),
  "b34#1": G("mutant-census/src/kernel/audit.ts", "E2"),
  "b34#2": G("mutant-census/src/kernel/audit.ts", "E1"),
  "b34#3": B("phantom call in a render.ts edit caught by pre-flight self-review; the initial draft never reaches the machine, its errors still go to the record — process"),
  "b34#4": G("mutant-census/package.json", "typecheck"),
  "b34#5": G("mutant-census/package.json", "lint"),
  "b34#6": G("mutant-census/package.json", "lint"),
  // -- batch 35 (this repo, the v0.4.0 anchor board) — born enrolled
  "b35#1": G("mutant-census/test/anchors.test.ts", "A-fire L2"),
  "b35#2": G("mutant-census/package.json", "lint"),
  "b35#3": G("mutant-census/package.json", "lint"),
  // -- batch 36 (dtc-clock, the #10 settlement) — born enrolled
  // process rows, booked with reasons
  "b36#12": B("a metric folded under another claim's name is a labeling crime, but no gate parses field semantics — the separate field ships and the record carries the lesson"),
  "b36#13": B("tolerance calibration against a single run's number; the class-claim rule (tolerances state the category, not a snapshot) is author discipline — the witness gate checks the class, not the author's history"),
  "b36#14": B("channel applied through dense Kraus multiplies — performance is correctness debt, but no workspace gate commands complexity; the mixture form ships"),
  "b36#15": B("six-loop C^4 mis-estimated as C^3 — same class as b36#14; the block-mMul form ships, the estimate lesson is process"),
  "b36#16": B("board literals drifting from witness numbers (rng consumption order); run-then-write is process — the rendered report vs witness-line read caught both drifts, no gate diffs prose against numbers"),
  "b36#17": B("heredoc tangle, fourth offense (b10#8/b25#6/b26#1 family) — the Write-tool rule is now recorded in three batches; enforcement remains the author's habit"),
  // machine-overruled rows, pinned to the gate that overruled
  "b36#18": G("dtc-clock/package.json", "typecheck"),
  "b36#19": G("dtc-clock/package.json", "lint"),
  "b36#21": G("dtc-clock/package.json", "typecheck"),
  // toolchain row, pinned to the gate that refused
  "b36#20": G("dtc-clock/package.json", "test"),
  // -- batch 37 (ds_extracted/ds, the GENESIS bench delivery) — born enrolled
  "b37#0": G("ds_extracted/ds/package.json", "typecheck"),
  "b37#1": B("relative-root depth is author discipline (third offense of batch 29's class); no gate derives each file's own depth"),
  "b37#2": G("ds_extracted/ds/package.json", "test"),
  "b37#3": G("ds_extracted/ds/package.json", "test"),
  "b37#4": G("ds_extracted/ds/package.json", "format:check"),
  "b37#6": B("shell && chains and grep exit codes; operator discipline — no workspace gate commands the author's shell"),
  "b37#7": B("the dual EPOCH_REPOS lists (census + total-gate) are design debt; single-sourcing the repo list is booked future work, not a live gate"),
  // -- batch 38 (phase-law, the combinatorial phase law) — born enrolled
  "b38#0": B("draft residue caught by author re-read before any run; drafts that reach the disk go to the record — no gate reads the author's editor"),
  "b38#1": B("tsx -e under Git Bash is silent for TS-importing one-liners (b14 family, second recurrence); the scratch-file rule is the enforcement"),
  // -- batch 39 (phase-law v0.2.0, the scaling campaign) — born enrolled
  "b39#0": B("an edit anchored on a section header must restore it — splice, not eat; author re-read caught both, no gate diffs comment structure"),
  // -- batch 40 (phase-law v0.3.0, the hardness island) — born enrolled
  "b40#0": B("the header-swallow class, offenses three and four — the rule lives in the daily memory now; no gate diffs comment structure"),
  "b40#1": G("phase-law/package.json", "test"),
  // -- batch 41 (phase-law v0.4.0, the density axis) — born enrolled
  "b41#0": G("phase-law/package.json", "test"),
  "b41#1": G("phase-law/package.json", "typecheck"),
  "b41#2": G("phase-law/package.json", "test"),
  // -- batch 42 (dtc-clock v0.2.0, the lifetime law) — born enrolled
  "b42#0": G("dtc-clock/package.json", "typecheck"),
  "b42#1": B("assertion anchors must be read from current text; prettier owns layout — no gate diffs intent"),
  "b42#2": G("dtc-clock/package.json", "test"),
  // -- batch 43 (dtc-clock v0.3.0, the cliff line + self-sync clock) — born enrolled
  "b43#0": G("dtc-clock/package.json", "typecheck"),
  "b43#1": G("dtc-clock/package.json", "lint"),
  "b43#2": B("a MISS is a stop — anchor discipline on read text; no gate diffs intent"),
  // -- batch 44 (dtc-clock v0.4.0, the Pauli wall + Hamming armor) — born enrolled
  "b44#0": G("dtc-clock/package.json", "typecheck"),
  "b44#1": B("heredoc with template literals — the banned class, fourth family sighting; Write tool always"),
  "b44#2": G("dtc-clock/package.json", "test"),
};

interface RegErr { category: string; wrong: string }
interface RegBatch { batch: number; repo: string; errors: RegErr[] }

async function main(): Promise<void> {
  const registryPath = resolve(process.cwd(), "..", "burial-record", "src", "kernel", "registry.ts");
  const mod = (await import(pathToFileURL(registryPath).href)) as unknown as { BURIAL_RECORD: RegBatch[] };
  const mutantClasses = new Map(MUTANTS.map((m) => [m.id, m.classes] as const));
  const root = resolve(process.cwd(), "..");
  const problems: string[] = [];
  const lines: string[] = [];

  // every override key must exist in the live registry — a stale override is a dead anchor
  const allKeys = new Set<string>();
  for (const b of mod.BURIAL_RECORD) b.errors.forEach((_, i) => allKeys.add(`b${b.batch}#${i}`));
  for (const k of Object.keys(O)) if (!allKeys.has(k)) problems.push(`override for non-existent error: ${k}`);

  let batchOpen = -1;
  const tally: Record<string, number> = { "MUTANT-KILLED": 0, "GATE-ENFORCED": 0, "BOOKED-UNENFORCEABLE": 0 };
  for (const b of mod.BURIAL_RECORD) {
    if (b.batch !== batchOpen) {
      lines.push(`  // ---- batch ${b.batch} (${b.repo}) ----`);
      batchOpen = b.batch;
    }
    b.errors.forEach((e, i) => {
      const key = `b${b.batch}#${i}`;
      const d = O[key] ?? (e.category === "machine-overruled" ? G(`${b.repo}/package.json`, "test") : DEFAULTS[e.category]);
      if (!d) {
        problems.push(`${key} [${e.category}] undecided — no default for this category and no override`);
        return;
      }
      if (d.tier === "MUTANT-KILLED") {
        const cls = mutantClasses.get(d.anchor);
        if (!cls) problems.push(`${key}: unknown mutant anchor ${d.anchor}`);
        else if (!cls.includes(e.category)) problems.push(`${key}: mutant ${d.anchor} does not replay category "${e.category}"`);
      }
      if (d.tier === "GATE-ENFORCED") {
        const [p, n] = d.anchor.split(" :: ");
        const full = resolve(root, p!);
        if (!existsSync(full)) problems.push(`${key}: anchor file missing: ${p}`);
        else if (!readFileSync(full, "utf8").includes(n!)) problems.push(`${key}: needle "${n}" not in ${p}`);
      }
      if (d.tier === "BOOKED-UNENFORCEABLE" && d.reason.trim() === "") problems.push(`${key}: booked without a reason`);
      tally[d.tier] = (tally[d.tier] ?? 0) + 1;
      const cat = e.category.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      if (d.tier === "BOOKED-UNENFORCEABLE") {
        lines.push(`  { key: "${key}", category: "${cat}", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "${d.reason.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" },`);
      } else {
        lines.push(`  { key: "${key}", category: "${cat}", tier: "${d.tier}", anchor: "${d.anchor}", reason: "" },`);
      }
    });
  }

  if (problems.length > 0) {
    console.error("REFUSED — the decision table does not stand:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  const total = Object.values(tally).reduce((s, n) => s + n, 0);
  const out = `/**
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
${lines.join("\n")}
];
`;
  writeFileSync(resolve(process.cwd(), "src", "kernel", "enrollment.ts"), out);
  console.log(`emitted src/kernel/enrollment.ts — ${total} rows: MUTANT-KILLED ${tally["MUTANT-KILLED"]}, GATE-ENFORCED ${tally["GATE-ENFORCED"]}, BOOKED ${tally["BOOKED-UNENFORCEABLE"]}`);
}

void main();
