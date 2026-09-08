/**
 * THE REPAIR AUDIT (R-board) — every BOOKED-UNENFORCEABLE row re-audited
 * against the machines that exist NOW.
 *
 * A BOOKED reason is a universal claim ("no machine can hold this line").
 * Such claims cannot be proved — they are REFUTED, one witness machine at a
 * time. Visit 70 (v0.9.0) audited one batch this way (b54: two reasons had
 * gone false, one boundary survived sharpened); this board makes the audit a
 * standing law over the WHOLE booked population, with a closed verdict
 * vocabulary and a decidable criterion per row:
 *
 *   UPGRADED   — the reason has gone false (or is made false by a gate built
 *                in the same edit): either the sighting itself was convicted
 *                by a scheduled gate, or a recurrence landing in the gated
 *                trees dies there. The row flips to GATE-ENFORCED and the
 *                basis MUST cite the falsifying anchor verbatim (R2).
 *   SHARPENED  — the reason survives but was coarse: the class has FACES,
 *                some already gate-held (the b54#1 dual-face precedent); the
 *                reason is rewritten to name which face is booked and which
 *                is held.
 *   HELD       — the reason is true as written; the basis states the ungated
 *                face (transient act, pre-machine draft, environment,
 *                external truth, prose intent) in one line.
 *
 * Laws (live, every run):
 *   R1 COVERAGE, BORN-AUDITED — the audit population equals the live booked
 *       population plus every row this board upgraded: a booked row without
 *       an audit verdict fails the build, a HELD/SHARPENED verdict on a row
 *       that is no longer booked fails the build (a later flip must edit the
 *       audit in the same act), and an UPGRADED verdict must sit on a row
 *       that really is GATE-ENFORCED now. From this board on, every new
 *       booked error is audited at birth or the build is red.
 *   R2 FALSIFICATION CITED — an UPGRADED basis must contain the row's live
 *       anchor string verbatim ("path :: needle"): the falsifying gate is
 *       named in the evidence, machine-checked (the anchor's own resolution
 *       is E3's jurisdiction, enforced on the same run).
 *   R3 CLOSED VOCABULARY — verdicts from the closed set, unique keys, every
 *       key addresses a live registry error, every basis non-empty.
 *   R4 FIRING EVIDENCE (v0.11.0, the deep check) — every UPGRADED row
 *       carries a needle-level witness IN the cited gate's own tree: the
 *       file on disk plus the exact assertion/include/import that fires on
 *       this row's defect class. E3 proves the anchor's needle; the A-board
 *       proves the gate's machinery; R4 proves the row's SPECIFIC defect
 *       class has live machinery — the deepest of the three, one needle per
 *       upgrade, verified every run.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WORKSPACE_ROOT } from "./census.js";
import type { EnrollmentRow } from "./enrollment.js";
import type { LiveRegistry } from "./bridge.js";
import type { WitnessResult } from "./audit.js";
import { ENROLLMENT } from "./enrollment.js";
import { loadLiveRegistry } from "./bridge.js";

export type RepairVerdict = "HELD" | "SHARPENED" | "UPGRADED";
export const REPAIR_VERDICTS: readonly RepairVerdict[] = ["HELD", "SHARPENED", "UPGRADED"];

export interface RepairRow {
  /** "bN#i" — must address a live registry error (R3) */
  readonly key: string;
  readonly verdict: RepairVerdict;
  readonly basis: string;
}

/**
 * The audit, row by row, in registry order. Written 2026-09-07 (v0.10.0)
 * against the 125-row booked population of the 66-batch / 380-error registry.
 */
export const REPAIR_AUDIT: readonly RepairRow[] = [
  // ---- batch 2 ----
  { key: "b2#3", verdict: "HELD", basis: "TS-Python parity needs both toolchains in CI; GitHub Actions is unreachable from this workspace (the GENESIS-C boundary) — no scheduled gate commands another machine's runner" },
  { key: "b2#6", verdict: "HELD", basis: "which interpreter answers to python3 on this Windows box is environment state; no workspace gate commands the host" },
  { key: "b2#7", verdict: "HELD", basis: "push-failure triage (network vs auth vs remote) is operator judgment over transient evidence; no gate sees the network" },
  // ---- batch 4 ----
  { key: "b4#3", verdict: "HELD", basis: "the retry loop's exit-code honesty is a shell act the gates never observe; the artifact it produces is checked, the loop itself is not" },
  // ---- batch 8 ----
  { key: "b8#5", verdict: "HELD", basis: "threshold policy is experiment design — what the engine schedules was corrected by hand; no gate chooses policy" },
  // ---- batch 9 ----
  { key: "b9#5", verdict: "HELD", basis: "search-effort allocation over 20k states is design work; a gate cannot price the author's stopping rule" },
  { key: "b9#6", verdict: "HELD", basis: "instance-set strength is a claim about construction intent; no machine parses 'tight' " },
  // ---- batch 10 ----
  { key: "b10#6", verdict: "HELD", basis: "the compass grind's abandonment was a judgment call mid-search; nothing scheduled observes a search in progress" },
  { key: "b10#8", verdict: "SHARPENED", basis: "dual-face, made explicit: the ACT (hand-writing templates through a python heredoc) is transient and ungated; the DAMAGE face cannot ship — a truncated markdown template breaks the render the repro gate runs. Booked: the act face only" },
  { key: "b10#9", verdict: "HELD", basis: "which side of a diagnosis is trusted is epistemics, not mechanics; no gate audits the author's trust" },
  // ---- batch 11 ----
  { key: "b11#7", verdict: "HELD", basis: "aggregation order (sum of ratios vs ratio of sums) is comparison semantics; no property pins intent — the comparison-design face is ungated" },
  // ---- batch 12 ----
  { key: "b12#6", verdict: "SHARPENED", basis: "dual-face: a wrong resolve root aimed at a missing file dies loudly at the gate that loads it (ENOENT — test/repro); the silent face is a wrong root that lands on a DIFFERENT existing file. Booked: the silent face only" },
  { key: "b12#7", verdict: "HELD", basis: "rounding a measured slope toward a theorem's constant is prose honesty — and the priced target got its machine at ONE face (v0.22.0): S2 reconciles the census's OWN rendered report's numeric claims against the live arithmetic on every suite run; this row's face (the ledger repo's README prose) is not that report and stays booked — no gate diffs a sibling repo's intent" },
  // ---- batch 13 ----
  { key: "b13#6", verdict: "SHARPENED", basis: "dual-face: the heredoc-via-JSON patch act is transient; a damaged file landing in the gated tree dies at typecheck (the loader convicted the b47#1 twin exactly there). Booked: the act face only" },
  { key: "b14#4", verdict: "HELD", basis: "tsx -e under Git Bash fails SILENTLY for TS-importing one-liners — the act leaves no artifact for any gate to see" },
  { key: "b14#5", verdict: "HELD", basis: "which rows weaken a table is editorial selection; no gate judges row choice" },
  // ---- batch 19 ----
  { key: "b19#5", verdict: "HELD", basis: "README wording by the expected limit is prose honesty; the reconciliation gate exists since v0.22.0 at the census's own report face (S2) — a sibling repo's README is not that report, unenforceable line-by-line" },
  // ---- batch 21 ----
  { key: "b21#3", verdict: "HELD", basis: "hand-computed price columns corrected by the witness — prose-number reconciliation got its machine at the census's own report face (S2, v0.22.0); this row's price columns live in a sibling repo's ledger and stay booked on that face" },
  // ---- batch 22 ----
  { key: "b22#2", verdict: "SHARPENED", basis: "dual-face placement class: the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the system-temp face lives outside the workspace tree no scheduled gate can scan. Booked: the outside-tree face only" },
  { key: "b22#3", verdict: "HELD", basis: "law-label sequencing (B0-B4 then B6) is authoring; no linter sequences another repo's law ids" },
  // ---- batch 23 ----
  { key: "b23#3", verdict: "SHARPENED", basis: "dual-face: the FAMILY-file face of the batch-23 class is gate-held — W-D byte-identity censuses every member live and its law cites this very class; the non-family idiom face (report.ts's contract) is review. Booked: the non-family face only" },
  // ---- batch 25 ----
  { key: "b25#1", verdict: "HELD", basis: "drafts one and two never reached a machine; the reread is the factory gate for pre-machine drafts — no scheduled gate compiles an editor buffer" },
  { key: "b25#6", verdict: "SHARPENED", basis: "dual-face: the heredoc act is transient; a truncated render.ts cannot compile — the typecheck face dies on the spot. Booked: the act face only" },
  // ---- batch 26 ----
  { key: "b26#1", verdict: "SHARPENED", basis: "dual-face (b25#6's twin): the act is ungated, the truncated probe file is a syntax death in the gated tree. Booked: the act face only" },
  // ---- batch 27 ----
  { key: "b27#0", verdict: "HELD", basis: "design-before-code is sequencing discipline; collapsed drafts never reached the machine" },
  // ---- batch 28 ----
  { key: "b28#3", verdict: "HELD", basis: "count-after-construction (21 built, 20 shipped) is census discipline at authoring time; the instance census verifies content, not completeness intent" },
  // ---- batch 29 ----
  { key: "b29#4", verdict: "HELD", basis: "displayed fractions vs their true denominator is print-layer honesty; no gate formats the register's intent" },
  { key: "b29#5", verdict: "HELD", basis: "already dual-face in its reason: unused symbols die at the gates, live-code residue (`| \"\"`) is review — the booked face is the live-code draft residue" },
  // ---- batch 30 ----
  { key: "b30#1", verdict: "HELD", basis: "toExponential(6) masking 1+2.1e-8 is a display-format choice; the witness columns carry the true digits, the format itself is not gated" },
  { key: "b30#4", verdict: "SHARPENED", basis: "dual-face: the in-tree faces of the residue class (unused indirections, void branches, mid-file imports) die at lint/typecheck; the live-code placeholder face (a rejects() line that compiles) is review. Booked: the pre-machine draft and the live-code face" },
  // ---- batch 32 ----
  { key: "b32#7", verdict: "HELD", basis: "the >1000-means-sigma formatting heuristic is semantic labeling; no gate parses what a unit label claims" },
  { key: "b32#9", verdict: "HELD", basis: "the kill census verifies KILLS; residue-free mutant construction is authorship — a sloppy mutant that still dies passes every gate" },
  { key: "b32#11", verdict: "HELD", basis: "the tree-walk rewrite never reached the machine; pre-machine drafts are reread territory" },
  // ---- batch 33 ----
  { key: "b33#0", verdict: "SHARPENED", basis: "dual-face placement class (b22#2's family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles); the /tmp face resolves outside the workspace (D:\\Data\\Temp) where no scheduled gate scans. Booked: the outside-tree face only" },
  { key: "b33#2", verdict: "HELD", basis: "npx resolving deps from the wrong root is invocation environment; the sanctioned path (each repo's own npm run) is documented, not machine-forced" },
  { key: "b33#3", verdict: "HELD", basis: "a scout pipeline that filters every line is a transient shell act; the numbers it would have produced are simply absent — nothing on disk to gate" },
  // ---- batch 34 ----
  { key: "b34#0", verdict: "HELD", basis: "the bash-inline regex surgery act is transient; its failure mode (zero replacements, silently) leaves the ORIGINAL file intact — no damaged artifact to catch" },
  { key: "b34#3", verdict: "HELD", basis: "the phantom call was caught in self-review before any run; drafts that never reach the machine cannot be gated" },
  // ---- batch 36 ----
  { key: "b36#12", verdict: "HELD", basis: "folding one metric under another claim's label is field semantics; no gate parses what a field name promises" },
  { key: "b36#13", verdict: "UPGRADED", basis: "the tolerance face is SELF-CATCHING: the gate refused its own witness at the sighting (a tolerance calibrated at one run's 1.3e-97 goes red the moment the class moves to n=5's 2.9e-79); recurrence dies at `dtc-clock/package.json :: test` — the machine convicted this very sighting" },
  { key: "b36#14", verdict: "HELD", basis: "8e9-flops Kraus multiplies are performance debt, not wrongness; no workspace gate times complexity" },
  { key: "b36#15", verdict: "HELD", basis: "the D^2 C^4 vs D^2 C^3 mis-estimate is analysis arithmetic at design time; no gate audits an estimate" },
  { key: "b36#16", verdict: "HELD", basis: "board literals drifting from witness numbers (rng consumption order) is the prose-number face; the board-vs-witness reconciliation gate EXISTS since v0.22.0 for the census's own rendered report (S2 — its first live run convicted three drifted phrases right there: 10-vs-7 full members, 4-vs-3 shares, 9/15-vs-11/33 audit counts); a sibling repo's board literals are not that report and stay booked" },
  { key: "b36#17", verdict: "SHARPENED", basis: "dual-face: the heredoc act is ungated (it even swallowed the lines that bury it); the damaged-file face dies at the loader/typecheck the moment it lands — b47#1 was convicted exactly there. Booked: the act face only" },
  // ---- batch 37 ----
  { key: "b37#1", verdict: "UPGRADED", basis: "the wrong-depth import is module-loader bait: the ds suite refused it with ERR_MODULE_NOT_FOUND at the sighting, and the same wrong depth is TS2307 on the scheduled typecheck of the same tree; recurrence dies at `ds_extracted/ds/package.json :: test` — the machine convicted this very sighting" },
  { key: "b37#6", verdict: "HELD", basis: "grep -c's exit-1-on-zero is shell semantics inside an author's && chain; no gate commands the author's shell" },
  { key: "b37#7", verdict: "UPGRADED", basis: "FALSIFIED AND REPAIRED IN THE SAME EDIT (v0.10.0): total-gate.ts now imports the one EPOCH_REPOS from the census kernel — the second literal list is gone — and the single-source test fires on every suite run; a recurrence (any second literal repo list) dies at `mutant-census/test/census.test.ts :: b37#7`" },
  // ---- batch 38 ----
  { key: "b38#0", verdict: "HELD", basis: "scratch residue caught by the reread seconds after the batch-36 lesson; pre-machine drafts" },
  { key: "b38#1", verdict: "HELD", basis: "the silent tsx -e family (b14's class): the act leaves no output and no artifact" },
  // ---- batch 39 ----
  { key: "b39#0", verdict: "HELD", basis: "the anchor-swallow is a patch act; the vanished header is caught only by eyes on the section face — no gate diffs comment structure" },
  // ---- batch 40 ----
  { key: "b40#0", verdict: "HELD", basis: "same anchor-swallow class, third and fourth sightings; the aftermath face is prose structure no gate parses" },
  // ---- batch 42 ----
  { key: "b42#1", verdict: "HELD", basis: "the python assert fired on prettier-reflowed text — a transient patch act; the assertion IS a guard, but it is the author's own, not scheduled" },
  // ---- batch 43 ----
  { key: "b43#2", verdict: "HELD", basis: "a MISS swallowed by an && chain is shell-act semantics; the stale-success face is process" },
  // ---- batch 44 ----
  { key: "b44#1", verdict: "SHARPENED", basis: "dual-face: the heredoc act is ungated; the structure-collapse face (three unused variables, a dead branch) dies at lint in the gated tree. Booked: the act face only" },
  // ---- batch 45 ----
  { key: "b45#3", verdict: "HELD", basis: "exhaustive-cost budgeting on render columns is a pre-run design call; no gate times a repro cell by cell" },
  { key: "b45#4", verdict: "HELD", basis: "anchoring from memory instead of the disk is a patch act; the Edit MISS is its own refusal — nothing damaged lands" },
  { key: "b45#5", verdict: "HELD", basis: "the 2 KB block anchor on invisible whitespace is a patch act, same face as b45#4" },
  { key: "b45#6", verdict: "HELD", basis: "the runner binary's PATH residency is the author shell's environment; npm scripts resolve locally by design" },
  // ---- batch 46 ----
  { key: "b46#1", verdict: "HELD", basis: "the silent tsx -e family, fifth sighting — the act is outputless" },
  { key: "b46#3", verdict: "HELD", basis: "the python heredoc anchor abort is a patch act that refused itself before any write — no artifact, no gate" },
  // ---- batch 47 ----
  { key: "b47#0", verdict: "HELD", basis: "the pre-flight validation harness exists and convicted the drafts — but it runs at delivery step 0, not on a scheduled gate; the rule-authoring face stays process" },
  { key: "b47#1", verdict: "UPGRADED", basis: "the damaged file landed in the gated tree and the loader convicted it on the spot (a real newline inside two string literals is a syntax death); recurrence dies at `mutant-census/package.json :: typecheck` — the machine convicted this very sighting" },
  // ---- batch 48 ----
  { key: "b48#1", verdict: "HELD", basis: "the anchor assert failed and the render edit silently never landed — a no-op act; the guard that catches it is greping the report face before closing, which is process" },
  { key: "b48#2", verdict: "HELD", basis: "the read-state refusal is the harness tool's own guard — a machine, but not a gate this workspace schedules; the refusal IS the enforcement" },
  // ---- batch 49 ----
  { key: "b49#0", verdict: "HELD", basis: "the -e family's survival mode is working-sometimes: silent failure is not always fatal, and an act with no artifact has no gate" },
  { key: "b49#2", verdict: "SHARPENED", basis: "dual-face placement class (b22#2/b33#0 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles); the system-temp face is outside the tree. Booked: the outside-tree face only" },
  { key: "b49#3", verdict: "HELD", basis: "the Bash channel's escape-eating is tool-layer physics; the channel is banned by rule, and rules about channels are process — no gate inspects how a patch was delivered" },
  // ---- batch 50 ----
  { key: "b50#0", verdict: "HELD", basis: "the backslash-through-channel class, eighth sighting — same transient act face as b49#3" },
  { key: "b50#1", verdict: "HELD", basis: "derivation conventions are verified by numeric probes in the scratch harness; no gate reviews a derivation — the probes do, and they are author's tools" },
  // ---- batch 51 ----
  { key: "b51#0", verdict: "HELD", basis: "product-function residue caught by reread before any run; the pre-machine face" },
  { key: "b51#4", verdict: "HELD", basis: "nested quotes die in the Bash channel exactly as backslashes do — the same transient act face" },
  { key: "b51#5", verdict: "HELD", basis: "the transposition typo lived in numeric prose; verbatim-anchor copying exposed it a visit later — prose-number reconciliation is built at the census's own report face (S2, v0.22.0); this row's prose was a scratch derivation's, that face stays booked" },
  { key: "b51#7", verdict: "HELD", basis: "replace-scoping is a patch act; B8 catches the aftermath on the memory side, the act itself is ungated" },
  // ---- batch 52 ----
  { key: "b52#0", verdict: "HELD", basis: "the false-green probe point lived in a scratch derivation; the Richardson cross-check that killed it is an author's tool, not a scheduled gate" },
  { key: "b52#1", verdict: "HELD", basis: "the missing (1-p)-expansion terms were scratch-derivation arithmetic; same face as b52#0" },
  { key: "b52#2", verdict: "HELD", basis: "the channel class again — the patch died at its own anchor assert; nothing landed" },
  // ---- batch 53 ----
  { key: "b53#0", verdict: "HELD", basis: "the Edit-before-Read refusals were the harness guard firing — enforcement happened, but by the tool, not a scheduled gate" },
  // ---- batch 54 ----
  { key: "b54#1", verdict: "HELD", basis: "already dual-faced by the v0.9.0 audit: the typecheck-tree face is GATE (TS2305, the b46#2 precedent), the scratch face is booked — re-audit confirms both faces as written" },
  // ---- batch 65 ----
  { key: "b65#1", verdict: "HELD", basis: "the cross-session stale read-state is the same harness-guard face as b48#2/b53#0 — the tool's refusal is the line, and it fired" },
  // ---- batch 55 ----
  { key: "b55#0", verdict: "HELD", basis: "first-draft residue under the wrong label caught by reread; pre-machine face" },
  { key: "b55#1", verdict: "HELD", basis: "residue in the REPLACEMENT draft, minutes after enrolling the first — pre-machine face, same as b55#0" },
  { key: "b55#2", verdict: "HELD", basis: "test-draft residue caught on reread before the suite; pre-machine face" },
  { key: "b55#3", verdict: "HELD", basis: "arXiv digits are external truth: memory holds the shape, the publisher holds the digits; no local gate can reach the source (double-sourcing is process)" },
  { key: "b55#5", verdict: "HELD", basis: "the needle-from-memory patch act; the assertion refused it — an author guard, not a scheduled gate" },
  { key: "b55#6", verdict: "HELD", basis: "the cancellation-prone arrangement compiles and runs; which arrangement was chosen is design semantics no machine holds — the discipline (and the suspicious-zero alarm) is process" },
  // ---- batch 56 ----
  { key: "b56#0", verdict: "HELD", basis: "collision-scratch residue caught on reread; pre-machine face" },
  { key: "b56#1", verdict: "HELD", basis: "dead placeholder block in a test draft caught on reread; pre-machine face" },
  { key: "b56#2", verdict: "SHARPENED", basis: "dual-face (the b54#1 shape): the SCRATCH face is booked — Node's first-run refusal is instant but instant is not a gate (the file dies before gates run); the PRODUCT-tree twin face is TS2305 on the scheduled typecheck (the b46#2 precedent — b56#3 rides it). Booked: the scratch face only" },
  { key: "b56#3", verdict: "UPGRADED", basis: "the missing-import face fired in PRODUCT code (audit.ts): two consecutive loader refusals at run, and the same defect is TS2305 on the scheduled typecheck of the same tree; recurrence dies at `stable-world/package.json :: typecheck`" },
  { key: "b56#4", verdict: "HELD", basis: "the wrong-object check (full matrix where dephased was meant) convicts nothing loudly — S(copy)-S(rho)=0 always; semantic object choice is ungated by any generic machine" },
  { key: "b56#5", verdict: "HELD", basis: "the phase-blind reference state is a wrong-object check in scratch; same ungated semantics face as b56#4" },
  { key: "b56#6", verdict: "HELD", basis: "the failed patch plus deleted evidence is an act-sequence face; the rule (evidence survives until the corrected run) is process" },
  { key: "b56#7", verdict: "UPGRADED", basis: "transcription errors into an exact-zero witness die at the tolerance: the commutator printed 3.30e+0 against an exact-zero claim and the suite went red at the sighting; recurrence dies at `stable-world/package.json :: test` — the machine convicted this very sighting" },
  { key: "b56#8", verdict: "UPGRADED", basis: "a NaN witness fails loudly (NaN <= tol is false): the coherence-factor probe failed the suite at the sighting; recurrence dies at `stable-world/package.json :: test` — the machine convicted this very sighting" },
  { key: "b56#9", verdict: "HELD", basis: "citation YEARS are external truth, same face as b55#3 — the publisher's record is the only source" },
  // ---- batch 57 ----
  { key: "b57#0", verdict: "HELD", basis: "void-suppressed imports caught on reread; the void idiom evades no-unused-vars by design, the pre-machine face is booked (removal-not-suppression is the rule)" },
  { key: "b57#1", verdict: "HELD", basis: "applying a T=0 closed form at finite beta is domain-semantics — the formula was correct on its own domain; no generic gate checks a formula's domain of application" },
  { key: "b57#2", verdict: "HELD", basis: "the tightness assertion compared a convenient superset — assertion-object choice is semantics, ungated generically (the scratch face)" },
  { key: "b57#3", verdict: "UPGRADED", basis: "an undefined name in a product loop is TS2304 on the scheduled typecheck — the b54#2 precedent verbatim (the sighting's ReferenceError at run is the same death one gate earlier); recurrence dies at `stable-world/package.json :: typecheck`" },
  { key: "b57#4", verdict: "HELD", basis: "the dead term inside a live expression was caught on reread; expressions-as-formulas review is pre-machine" },
  { key: "b57#5", verdict: "HELD", basis: "board numbers vs the witness's own census — the prose-number face again; the reconciliation gate holds the census's own report since v0.22.0 (S2), this row's board is a sibling repo's and stays booked" },
  // ---- batch 58 ----
  { key: "b58#0", verdict: "HELD", basis: "the four convention slips lived across two scratch drafts; the eigenvalue arbiter that killed them is an author's probe, not a scheduled gate" },
  { key: "b58#1", verdict: "HELD", basis: "the vacuous loop printed ZERO from an empty range — scratch-analysis face; the 'is the loop nonempty' check is author discipline" },
  // ---- batch 59 ----
  { key: "b59#0", verdict: "UPGRADED", basis: "a phantom import (applyUnitaryLocal) in product code is TS2305 on the scheduled typecheck; the sighting was caught at reread, but recurrence that reaches the tree dies there — the b54#2 shape (caught by review, gated on recurrence) at `stable-world/package.json :: typecheck`" },
  { key: "b59#1", verdict: "HELD", basis: "the self-dividing ratio was a check that could never fail — tautology detection needs the known-answer test case, which is authoring; no generic gate proves a check can fail" },
  { key: "b59#2", verdict: "HELD", basis: "the conjugation-sign convention is derivation semantics in scratch; conventions are written down by hand, no machine holds which side carries the conjugate" },
  { key: "b59#3", verdict: "HELD", basis: "the heredoc-created code file survived because its content was benign — 'this time it was harmless' is the family's survival mode; content-based exceptions are banned BY RULE precisely because no gate can audit the channel" },
  { key: "b59#4", verdict: "HELD", basis: "the dead helper was caught on reread; pre-machine face (fifth sighting of the class)" },
  { key: "b59#6", verdict: "HELD", basis: "board rows out of order for a whole visit, unnoticed by every gate — the id-order checker EXISTS since v0.22.0 for the census's own rendered report (S1 legislates the section order and convicts permuted sections, unordered rows and unknown sections BY NAME); no scheduled gate parses a sibling repo's board arrays, that face stays booked" },
  { key: "b59#7", verdict: "HELD", basis: "the escaped-needle python patch refused itself and landed on retry via Edit — transient act face" },
  // ---- batch 60 ----
  { key: "b60#0", verdict: "HELD", basis: "the nonsense && inside reduce was caught on reread before any run; pre-machine face" },
  { key: "b60#1", verdict: "HELD", basis: "trailing void for an unused import, caught in the same reread; pre-machine face" },
  { key: "b60#2", verdict: "HELD", basis: "the horizon is a PRE-RUN decision — budgeting is design; no gate prices a census cap before the first run" },
  { key: "b60#3", verdict: "SHARPENED", basis: "dual-face (b54#1/b56#2 family): the SCRATCH face is booked (refused at first run, gone before gates); the product-tree face (importing a private member) is TS2305 on the scheduled typecheck — the b46#2 precedent. Booked: the scratch face only" },
  { key: "b60#4", verdict: "HELD", basis: "the overflow NaN was an arrangement choice in scratch printing; scaled division is the discipline, no gate holds arrangements" },
  { key: "b60#5", verdict: "HELD", basis: "the insertion script asserted on a remembered function shape and wrote nothing — transient act face" },
  { key: "b60#6", verdict: "HELD", basis: "the channel's fourth refusal of the same patch class — transient act face, nothing landed" },
  // ---- batch 61 ----
  { key: "b61#0", verdict: "HELD", basis: "the hand-derivation factor slips lived in scratch; the reconciliation anchor that killed them is an author's probe" },
  // ---- batch 62 ----
  { key: "b62#0", verdict: "HELD", basis: "the NaN assembly was caught on the scratch output face; re-choosing the deliverable shape is design" },
  { key: "b62#1", verdict: "HELD", basis: "trailing void caught by the pre-run cleaning pass; pre-machine face" },
  // ---- batch 63 ----
  { key: "b63#0", verdict: "SHARPENED", basis: "dual-face: the scratch-analysis face is booked; the IN-TREE guard-boolean face is suite-held — b61#1's inverted guard was convicted by the tests on the spot. Booked: the scratch face only" },
  { key: "b63#1", verdict: "HELD", basis: "the dropped /4 lived in hand analysis; the exact chain identity corrected it — author's identity chain, not a gate" },
  // ---- batch 64 ----
  { key: "b64#0", verdict: "HELD", basis: "the heredoc-created scratch survived benign (tenth enrollment of the class) — the channel is ungatable by rule, not by machine; no content-based exceptions" },
  { key: "b64#1", verdict: "HELD", basis: "the copy-paste explosion was caught in self-review of the command line — the command channel is not a gate's territory" },
  // ---- batch 66 ----
  { key: "b66#5", verdict: "HELD", basis: "already dual-faced at enrollment (the v0.2.0 dsic-noether delivery): the renderer face is unenforceable (no scheduled gate runs exp5), the same logic is gated in the test tree's skew case — re-audit confirms as written" },
  // ---- batch 67 (born audited: the R-board's own visit, R1's first exercise) ----
  { key: "b67#0", verdict: "HELD", basis: "the act face — a heredoc-created scratch that survived by luck, eleventh sighting committed while the audit board itself was being written; no machine sees the channel, the Write-tool rule is the only guard, and the damaged-file face dies at the loader (the b47#1 twin)" },
  { key: "b67#2", verdict: "HELD", basis: "live-code construction residue in a test draft caught on reread — the pre-machine face; the class's unused-symbol faces die at lint in-tree (b67#1 rides that face), the live-code face is review-only" },
  { key: "b67#4", verdict: "HELD", basis: "patch-act face: the needle-from-memory Edit miss was refused by the tool's own guard — a machine, but not a scheduled gate (the b45#4 family; the refusal fired)" },
  { key: "b67#6", verdict: "UPGRADED", basis: "FLIPPED ONE VISIT LATER UNDER R1's STANDING LAW: the priced refutation target got its machine — E7 (v0.11.0) checks the description's stated tier counts against the live enrollment arithmetic on every suite run and the renderer refuses to print a drifted self-description; recurrence dies at `mutant-census/test/census.test.ts :: E7`" },
  { key: "b68#2", verdict: "SHARPENED", basis: "dual-face since v0.14.0: the swallow's AFTERMATH face (the orphaned tail line, the repeated-label signature, verbatim heading doubles) is gate-held by B9 — the repeated insertions of one day each left exactly these signatures; the ABSENCE face (a heading silently gone, no fragment left) has no should-exist oracle and stays booked with the section-face grep as its discipline" },
  { key: "b69#0", verdict: "HELD", basis: "pre-machine draft residue in a template string caught on the post-edit reread — the pre-machine face (the b55#0 class); the in-tree syntax-visible faces of residue die at typecheck, prose-in-string residue is review" },
  { key: "b69#1", verdict: "HELD", basis: "patch-act face: the anchor-from-memory Edit miss was refused by the tool's own guard (the b45#4 family) — a machine, but not a scheduled gate" },
  { key: "b70#2", verdict: "HELD", basis: "pre-machine draft face: the never-fail assertion was caught on reread before the suite ran — the b59#1 class (a check that cannot fail is constructed zero); no gate proves a check can fail generically" },
  { key: "b70#3", verdict: "UPGRADED", basis: "FLIPPED ONE VISIT LATER UNDER R1's STANDING LAW (the second priced target to get its machine, after E7): B9 (v0.5.0 of the record) checks every cited daily note's structure on every suite run — the repeated-label signature this error IS, the orphaned tails its family left, and verbatim heading doubles all convict by line number; recurrence dies at `burial-record/src/kernel/audit.ts :: memoryStructureViolations`" },
  { key: "b71#0", verdict: "HELD", basis: "command-act face: the detached duplicate launch raced its own gate — the cost was real (wall-sum inflated 42%) but the act lives in the author's shell, which no scheduled gate inspects; read-the-whole-line is the discipline (the b64#1 family)" },
  { key: "b72#0", verdict: "HELD", basis: "law-design face: the first invariant was false (visit-number uniqueness) and the live first run convicted legitimate history — no scheduled gate proves a law's invariant true; the run-before-landing probe is the discipline (the b50#1 numeric-probe family, applied to law design)" },
  { key: "b72#1", verdict: "HELD", basis: "edit-act face: the newline-dropping insert was caught on the post-edit reread — no scheduled gate diffs formatting intent; read-back after every structural insert" },
  // ---- batch 73 (dtc-clock v0.19.0) — born audited ----
  { key: "b73#1", verdict: "HELD", basis: "scratch-act face: the mechanical trio lived in a scratch file that dies before gates by design; the kernel's richardsonLimit handles arbitrary step ratios and its outputs are gate-asserted — the scratch face is author review" },
  { key: "b73#2", verdict: "HELD", basis: "budget face: the O(K^2) loop hang has no non-timeout gate; the incremental recurrence it became is spot-checked under the suite — complexity-estimation before a scale run is a stopping-rule judgment, not a machine" },
  { key: "b73#3", verdict: "HELD", basis: "frame face: no scheduled gate audits the choice of comparison frame — the mismatched-scale section was scrapped on the numbers it produced; scale-first is derivation discipline (the wrong-object class's ungated subspecies)" },
  { key: "b73#4", verdict: "HELD", basis: "noise-floor face (b55#6's class at a new subtraction): the fitted value beyond the cancellation floor was wrong but the second-law value is asserted at k=8192 under the suite — the beyond-floor fit domain is author arithmetic" },
  { key: "b73#10", verdict: "HELD", basis: "counter face: visit/batch numbering is pre-gate shared state by construction — no scheduled gate numbers visits; grep-the-registry-first is the discipline (the b65 law, executed pre-emptively here)" },
  // ---- batch 74 (the four-repo delivery wave's wiring) — born audited ----
  { key: "b74#0", verdict: "HELD", basis: "shell-act face: the masking pipe lives in the author's shell, which no scheduled gate inspects; the conviction came from the CI runner — unreachable from this workspace (the b2#3 GENESIS-C boundary); read-the-exit-code-directly (PIPESTATUS, or no pipe) is the discipline (the exit-code-masking family, sixth sighting)" },
  { key: "b74#1", verdict: "SHARPENED", basis: "dual-face placement class (b22#2/b33#0/b49#2 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the /tmp face resolves outside the workspace tree where no scheduled gate scans. Booked: the outside-tree face only" },
  { key: "b74#2", verdict: "HELD", basis: "shell-act face, the same-day recurrence of b74#0 (the family's seventh sighting): $? after a pipe is the tail's code — no scheduled gate reads another process's shell; PIPESTATUS[0] is the discipline" },
  { key: "b74#3", verdict: "HELD", basis: "agent-discipline act face: the git ban is delivery protocol — no scheduled gate observes a delivery agent's commands; the deliverable state is read from files, and read-only-ness grades the offense without unmaking the ban" },
  { key: "b74#4", verdict: "HELD", basis: "pre-machine reread face (the b55#0 class): the no-op edit never reached a machine — the reread is the factory check" },
  { key: "b74#5", verdict: "HELD", basis: "external-truth face (the b55#3 class): a citation's claim text answers to the publisher's record, which no local gate can reach — the double-source ritual is the guard, and deletion on the spot is its execution" },
  { key: "b74#6", verdict: "HELD", basis: "delivery-hygiene face: the in-tree residue faces died at the successors' gates (lint/typecheck/test convicted them until closure); the leaving-behind act itself — stale README, missing report tables — is interruption process no gate diffs" },
  { key: "b74#8", verdict: "HELD", basis: "claim-object face (the b57#2 superset class): no gate parses which population a verdict's prose names — the 6×8-specific restatement is the fix; prose-vs-witness reconciliation got its machine at the census's own report face (S2, v0.22.0), this verdict-population face stays ungated" },
  { key: "b74#9", verdict: "SHARPENED", basis: "dual-face: the act face (rewritten on the spot, pre-machine) is booked; the landing face — require() in the ESM tree — is a loader death the gates convict the moment it lands (the b47#1 precedent, the same death one gate earlier). Booked: the act face only" },
  { key: "b74#10", verdict: "HELD", basis: "scratch-arbitration face (the b52#0 class): the bad unitary and the withdrawn 'transpose fix' lived in scratch and were refuted by variant enumeration — an author's probe, not a scheduled gate" },
  { key: "b74#11", verdict: "SHARPENED", basis: "dual-face: the apostrophe was caught pre-machine (the act face is booked); the landing face is a parser death at typecheck. Booked: the act face only" },
  // ---- batch 75 (the second four-repo delivery wave's wiring) — born audited ----
  { key: "b75#6", verdict: "SHARPENED", basis: "dual-face placement class (b22#2/b33#0/b49#2/b74#1 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the /tmp face resolves outside the workspace tree where no scheduled gate scans — three gate logs landed there during the causal-ineq delivery. Booked: the outside-tree face only" },
  { key: "b75#13", verdict: "SHARPENED", basis: "dual-face: the heredoc act is ungated — the channel's twelfth canonical sighting (the family's wrong-text sightings grepped to 16 in-registry before enrolling), and 'not repeated' grades the offense without unmaking the ban; the damaged-file face dies at the loader/typecheck the moment it lands (the b47#1 twin). Booked: the act face only" },
  // ---- batch 76 (the third four-repo delivery wave's wiring) — born audited ----
  { key: "b76#0", verdict: "SHARPENED", basis: "dual-face (the b74#9 twin, one wave later): the act face — dummyRng's require() rewritten to an import on the spot, pre-machine — is booked; the landing face, a require() in the ESM tree, is a loader death the gates convict the moment it lands. Booked: the act face only" },
  { key: "b76#3", verdict: "HELD", basis: "dead-but-parseable scaffolding left by a failed edit: no unused-code gate is wired in this tree, the rewrite removed the residue — the reread is the factory check" },
  { key: "b76#7", verdict: "HELD", basis: "the fake-number family attempted and self-caught pre-ship — S2 (v0.22.0) now diffs the census's own rendered prose against the live arithmetic on every suite run; the attempt face (values written before ANY run, in a sibling repo's prose) is upstream of every render and stays booked (the b12#7/b21#3 line)" },
  { key: "b76#8", verdict: "HELD", basis: "docs-content destruction (theory.md's referee section) is outside every scheduled gate's sight — the backup restore was manual, the docs face is ungated" },
  { key: "b76#9", verdict: "SHARPENED", basis: "dual-face: the heredoc append act is ungated — the channel's thirteenth canonical sighting (wrong-text sightings grepped to 17 in-registry before enrolling); the damaged-file face dies at the loader/typecheck the moment it lands (the b47#1 twin). Booked: the act face only" },
  { key: "b76#23", verdict: "HELD", basis: "print-layer honesty: whether a display truncation hides the load-bearing digits is prose judgment (the b29#4/b30#1 display face) — the rewritten display is review, not machine" },
  { key: "b76#24", verdict: "SHARPENED", basis: "dual-face: the heredoc scratch act is ungated — the channel's fourteenth canonical sighting (the thirteenth is b76#9, same batch), and the deletion does not unmake the breach; the damaged-file face dies at the loader/typecheck the moment it lands. Booked: the act face only" },
  // ---- batch 77 (the fourth four-repo delivery wave's wiring) — born audited ----
  { key: "b77#8", verdict: "SHARPENED", basis: "dual-face (the b74#3 twin, one wave later): the act face — a read-only git status against the unconditional agent-git ban — is booked; no mutation occurred and no output shipped, the deliverable's state is read from the files. Booked: the act face only" },
  { key: "b77#11", verdict: "HELD", basis: "transient environment face: one W-F filesystem miss against an anchor on disk, re-run green, never reproduced — the witness itself fires on every suite run; there is no machine to build against a ghost, the re-run is the resolution" },
  // ---- batch 78 (the fifth four-repo delivery wave's wiring) — born audited ----
  { key: "b78#1", verdict: "HELD", basis: "a hung run is killed by hand and no non-timeout gate prices a workload before launch (the b73#2 line) — the load-reduced redesign's own cross-checks ride the delivered suite; the complexity-estimate discipline is the booking" },
  { key: "b78#9", verdict: "SHARPENED", basis: "dual-face (third act on the b74#3/b77#8 line, now the diff flavor): the act face — a read-only `git diff --stat` inside a compound command — is booked; no mutation, no output shipped. Booked: the act face only" },
  { key: "b78#10", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's eighth sighting, an attempted one): the shell-act face — a display pipe eating the suite's verdict — is booked, caught by self-review before any verdict was taken from it; the landing face never existed, the re-run's direct exit code is the resolution. Booked: the shell-act face only" },
  { key: "b78#12", verdict: "SHARPENED", basis: "dual-face (the b74#6 class): the in-tree residue — an uncompilable compose.ts stub plus a scratch-bench — died at the successor's typecheck exit 2 on arrival; the leaving-behind act is interruption process no gate diffs. Booked: the leaving-behind face only" },
  { key: "b78#13", verdict: "UPGRADED", basis: "the reason has gone false: the wave-4 quality delivery REWROTE the oldest-first header in place (the register discipline prose now says NEWEST-FIRST, repro bytes unchanged), so the doc face is paid at a needle — choice-lang/src/kernel/lang.ts :: NEWEST-FIRST pins the corrected header on disk and E3 convicts on every census run the day a contradiction returns (the causal-ineq theory.md single-boundaries precedent)" },
  { key: "b78#14", verdict: "SHARPENED", basis: "dual-face: the heredoc act is ungated — the channel's fifteenth canonical sighting (wrong-text sightings grepped to 19 in-registry before enrolling); the truncated block died at the loader the moment it landed and was restored by Edit. Booked: the act face only" },
  { key: "b78#15", verdict: "SHARPENED", basis: "dual-face (the b74#6 class, second row of the wave): the orphan draft's three defects died at the successor's gates and the JW25 mischaracterization is corrected with a logged erratum pinned in vacuum-compiler/docs/citations.md; the leaving-behind act is interruption process no gate diffs. Booked: the leaving-behind face only" },
  // ---- batch 79 (the sixth four-repo delivery wave's wiring) — born audited ----
  { key: "b79#0", verdict: "SHARPENED", basis: "dual-face: the heredoc act is ungated — the channel's sixteenth canonical sighting (wrong-text sightings grepped to 19 in-registry, unchanged by this clean act, counted before enrolling); the patch verified clean after the act, which does not unmake the breach, and the damaged-file face dies at the loader/typecheck the moment it lands. Booked: the act face only" },
  { key: "b79#6", verdict: "HELD", basis: "doc face: the README's '19/19' is prose on a surface no scheduled gate reads — E7 holds the census's own description, B7/B8 hold contexts and headings, and the README is neither; the count re-derived from the run (78/78) in the same edit is the discipline. Booked: the doc face" },
  { key: "b79#13", verdict: "SHARPENED", basis: "dual-face, no landing: the shell act (a bash template-string escape that failed and produced nothing) is booked — no machine sees the shell and the Write/Edit rule is the guard; the tree face never existed, nothing landed to gate. Booked: the act face only" },
  { key: "b79#14", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's ninth sighting, an attempted one): the shell-act face — a gate run through a pipe — is booked, caught by self-review, killed on sight, re-run for the direct exit code; the landing face never existed. Booked: the shell-act face only" },
  // ---- batch 80 (the FINAL wave batch's wiring) — born audited ----
  { key: "b80#1", verdict: "HELD", basis: "the fake-number family's third registered attempt and self-caught pre-ship — S2 (v0.22.0) diffs the census's own rendered prose against the live arithmetic on every suite run, but the attempt face (a claim asserted before ANY run, in a sibling repo's delivery note) is upstream of every render and stays booked (the b12#7/b21#3/b76#7 line)" },
  { key: "b80#2", verdict: "HELD", basis: "doc face: the X8 doc quoting scratch numbers where the renderer carries its own is prose on a surface no scheduled gate reads — E7 holds the census's description, B7/B8 hold contexts and headings, and a repo doc is neither; the re-sync to the rendered data in the same edit is the discipline (the b79#6 line). Booked: the doc face" },
  { key: "b80#3", verdict: "SHARPENED", basis: "dual-face placement class (b22#2/b33#0/b49#2/b74#1/b75#6 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the hash-verification temp file resolved outside the workspace tree where no scheduled gate scans — deleted after the act, which does not unmake the placement. Booked: the outside-tree face only" },
  { key: "b80#5", verdict: "HELD", basis: "a one-time audit's summary face: the two grep totals were re-derived from the raw output before any number was quoted and no scheduled gate re-runs an audit's greps — a grep is a tool with an output format and the format is part of the query, but the discipline is author-side. Booked: the summary face" },
  { key: "b80#6", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's tenth sighting, an attempted one): the shell-act face — a hygiene agent's gate run through a pipe — is booked, caught by self-review, killed on sight, re-run for the direct exit code; the landing face never existed, no verdict was taken from the pipe. Booked: the shell-act face only" },
  // ---- batch 81 (the fix-all-errors visit's wiring) — born audited ----
  { key: "b81#1", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's eleventh sighting, an attempted one): the shell-act face — the format:check verdict read through a tail pipe, tail's 0 displayed where prettier had failed — is booked; the landing face never existed (the warning text was acted on and the direct exit code was read after). Booked: the shell-act face only" },
  { key: "b81#2", verdict: "SHARPENED", basis: "dual-face (the family's twelfth sighting, one visit after the eleventh): the shell-act face — the TS7 scratch lint's verdict read through the same pipe shape, a displayed 0 under a crashed lint (true exit 2) — is booked; the landing face never existed (the guard's stack was read and the re-run took the direct code within the minute). Booked: the shell-act face only" },
  { key: "b81#3", verdict: "HELD", basis: "lockfile-intent face: no scheduled machine diffs a local node_modules resolution against an external PR's lockfile — the pin-is-the-intent rule is author-side, and the exact-pin reinstall preceded the commit (zero tree impact). Booked: the lockfile-intent face" },
  { key: "b81#4", verdict: "SHARPENED", basis: "dual-face (the sanctioned-channel family): the heredoc act is transient and ungated — nothing sees the shell channel; the damaged-file face cannot ship, a malformed package.json is a JSON-parse death at the very next npm invocation (verified clean this time; clean does not absolve, the b79#10 judgment). Booked: the act face only" },
  // ---- batch 82 (the seventh wave's first batch's wiring) — born audited ----
  { key: "b82#3", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's thirteenth sighting, an attempted one): the shell-act face — a gate piped through tail — is booked, caught by self-review in the same breath, killed on sight, re-run for the direct exit code; the landing face never existed, no verdict was taken from the pipe. Booked: the shell-act face only" },
  { key: "b82#5", verdict: "HELD", basis: "pre-machine face: the dead scaffolding was rewritten whole before any run — the reread is the factory check, no gate compiles an editor buffer" },
  { key: "b82#6", verdict: "HELD", basis: "patch-act face: the Edit-before-Read refusal fired — the tool's own guard is the enforcement, but it is not a scheduled gate; nothing damaged landed" },
  { key: "b82#7", verdict: "SHARPENED", basis: "dual-face (the sanctioned-channel family's eighteenth sighting): the node -e act is transient and ungated — nothing sees the shell channel; the damaged-file face cannot ship, a malformed test file is a parse death at the loader/typecheck the moment it lands (verified clean this time; clean does not absolve, the b79#10 judgment). Booked: the act face only" },
  { key: "b82#9", verdict: "HELD", basis: "pre-machine face: the transient duplicate died at the read-back — its landing face would be a duplicate-declaration death at typecheck, the reread closed it first" },
  { key: "b82#11", verdict: "HELD", basis: "pre-machine face: a stray blank line is cosmetic residue caught on the read-back; no gate diffs whitespace intent" },
  { key: "b82#15", verdict: "HELD", basis: "comment face: the bracket mismatch lived in prose no gate parses — the reread is the factory check (the b79#6 doc-face line)" },
  { key: "b82#16", verdict: "HELD", basis: "query face: a one-time verification's regex-vs-literal mistake re-run correctly within the minute — no scheduled gate re-runs an author's greps (the b80#5 class)" },
  { key: "b82#20", verdict: "HELD", basis: "patch-act face: the Edit-before-Read refusal fired for the wiring agent exactly as it fired for the delivery agent one batch-row earlier — the tool's guard is the enforcement, but it is not a scheduled gate; nothing damaged landed" },
  { key: "b82#21", verdict: "HELD", basis: "sequencing face: the K-board divergence registration and the artifact re-render are companion edits no gate can schedule — the suite convicted the incomplete state, which is the gate working on an act that should not have been sent half-done" },
  // ---- batch 83 (the quality wave's second batch's wiring) — born audited ----
  { key: "b83#0", verdict: "HELD", basis: "pre-machine face: the mangled import block was fixed on the immediate reread — its landing face is a typecheck death, the reread closed it first" },
  { key: "b83#1", verdict: "HELD", basis: "pre-machine face: the swallowed import block was restored from the reread in the same minute — the landing face would be a loader/typecheck death" },
  { key: "b83#3", verdict: "HELD", basis: "pre-machine face: the alias residue was found on the reread and removed — the landing face is a duplicate-constant death at typecheck" },
  { key: "b83#4", verdict: "SHARPENED", basis: "dual-face: the pre-machine act (imports landing after the code that uses them) is booked; the landing face — used-before-import — is a TS2552/TS2305 death at the repo's typecheck the moment it lands, and the gate never had to say it. Booked: the pre-machine face only" },
  { key: "b83#5", verdict: "HELD", basis: "deletion-channel face (founding note): trash is not installed in this Git Bash and no workspace gate commands the environment — the zero-reference grep before the rm is the discipline that makes the channel honest" },
  { key: "b83#8", verdict: "HELD", basis: "environment face: tsx -e with a relative import fails silently under Git Bash — the act leaves no output and no artifact (the b14#4/b38#1/b46#1 line); the in-repo scratch-file rule is the enforcement" },
  { key: "b83#9", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's fourteenth sighting, an attempted one): the shell-act face — the first gate authentication piped through tail — is booked, caught in self-review, killed on sight, re-run with NO pipe for the true code; the landing face never existed. Booked: the shell-act face only" },
  { key: "b83#10", verdict: "HELD", basis: "pre-machine face: both corrections (rejects() for the async trial, the awaited probe) landed on the draft's own reread before the suite ran — an unhandled rejection riding a green run is exactly what the reread is for" },
  { key: "b83#17", verdict: "SHARPENED", basis: "dual-face (the family's fifteenth sighting, ONE ROW after the fourteenth, attempted by the wiring agent itself): the shell-act face — tail printing the failures while EXIT echoed tail's own 0 — is booked; no verdict was taken from the pipe, the re-run's direct code (1, the expected pre-wiring red) is the only verdict. Booked: the shell-act face only" },
  { key: "b83#18", verdict: "HELD", basis: "cross-reference face: no scheduled gate parses registry prose's family-citation keys against the rows they name — the grep-before-enrolling discipline is the guard, and it is what caught this one (the citation corrected in the same edit)" },
  { key: "b83#19", verdict: "HELD", basis: "doc face: the README's headline count is prose on a surface no scheduled gate reads — B7/B8 hold contexts and headings, E7 holds the census's description, and the README is neither; the count re-derived from the registry in the same edit is the discipline (the b79#6 line)" },
  { key: "b83#20", verdict: "HELD", basis: "patch-act face: the Edit-before-Read refusal fired on the wiring agent's own second package.json of the visit — the tool's guard is the enforcement, but it is not a scheduled gate; nothing damaged landed (the b82#6/b82#20 twins, now three wiring-agent offenses on the same line)" },
  // ---- batch 84 (the quality wave's third batch's wiring) — born audited ----
  { key: "b84#2", verdict: "HELD", basis: "pre-machine face: the deletion's residue survived two of its three edits — the landing face is a dead-symbol death at typecheck/lint; the grep-then-delete pass closed it, no gate compiles an editor buffer mid-edit" },
  { key: "b84#3", verdict: "HELD", basis: "pre-machine face: the inverted-intent write-back was reversed on the immediate reread — no scheduled gate observes an edit's direction, the read-back is the factory check" },
  { key: "b84#4", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's sixteenth sighting, an attempted one): the shell-act face — a gate authentication piped for display — is booked, no verdict taken from the pipe, the re-run's DIRECT exit code the only verdict; the landing face never existed. Booked: the shell-act face only" },
  { key: "b84#5", verdict: "HELD", basis: "doc face: a performance claim measured under parallel load is prose on a surface no scheduled gate benchmarks — the honest duration replaced it in the same edit (the b79#6 line). Booked: the doc face" },
  { key: "b84#7", verdict: "SHARPENED", basis: "dual-face (the family's seventeenth sighting, one delivery after the sixteenth): the shell-act face — npm test through a tail pipe — is booked; the landing face never existed, the no-pipe re-run is the only verdict. Booked: the shell-act face only" },
  { key: "b84#8", verdict: "HELD", basis: "pre-machine face: the TOL_LOCAL_NEVER alias was cleared inside the same edit (the b83#3 twin) — its landing face is a duplicate-constant death at typecheck, the reread closed it first" },
  { key: "b84#16", verdict: "HELD", basis: "pre-machine face: the meaningless ternary was simplified in self-review before any run — no gate proves an expression computes the same value both ways, the reread is the factory check (the b82#5 face)" },
  { key: "b84#18", verdict: "HELD", basis: "pre-machine face: the misplaced import was caught on self-review and moved in the same minute — its landing face is an ordering death at lint/typecheck the gates never had to say" },
  { key: "b84#19", verdict: "HELD", basis: "environment face: the -e one-liner shape (node --import tsx -e with a relative dynamic import) leaves no artifact on failure — the b14#4/b38#1/b46#1/b49#0/b83#8 line's exact mode; the in-repo scratch probe or the suite's own W-D witness is the enforcement, neither is a scheduled gate" },
  { key: "b84#20", verdict: "HELD", basis: "pre-machine face (the wiring agent's own): the forged-value cast was replaced with the plain literal on the edit's own reread — E6 names the forged runtime string at the next run (the vocabulary is closed on the VALUE), so the landing face is gate-held; the drafting act itself no gate sees. Booked: the pre-machine face" },
  { key: "b84#21", verdict: "HELD", basis: "sequencing face (the wiring agent's own, the b82#21 class): the census suite convicted the drifted G2 resolution row at its first run — the aftermath is gate-held (W-H fires on every run), but the derivation itself (the tier computed from the machine's own familyOf assignment instead of the author's filing intent) is author-side arithmetic no scheduled gate performs for the author" },
  // ---- batch 85 (the quality wave's fourth batch — born-audited) ----
  { key: "b85#0", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's eighteenth sighting, an attempted one under a PIPESTATUS echo): the shell-act face — a piped gate authentication — is booked, no verdict was taken from the pipe, the final run read the DIRECT exit code; the landing face never existed. Booked: the shell-act face only" },
  { key: "b85#1", verdict: "HELD", basis: "pre-machine face: the vacuous zero-matrix control was rewritten to the direct kron in self-review — no gate proves a control exercises the machinery it names, the reread is the factory check" },
  { key: "b85#4", verdict: "SHARPENED", basis: "dual-face (the sanctioned-channel family's nineteenth sighting): the act — a bash-fed python heredoc batch edit, exit 49 — is booked; a mangled file landing in the gated tree is a syntax death at typecheck the moment it lands. Booked: the act face only" },
  { key: "b85#5", verdict: "HELD", basis: "pre-machine face: the extra closing bracket was caught on the edit's own reread — its landing face is a syntax death at typecheck, the reread closed it first" },
  { key: "b85#6", verdict: "HELD", basis: "pre-machine face: the no-op assertion draft was replaced with inline independent recomputation anchors in self-review — no scheduled gate proves an assertion recomputes what it certifies" },
  { key: "b85#7", verdict: "HELD", basis: "pre-machine face: the weyl residue survived the deletion's first cut — its landing face is a dead-symbol death at typecheck/lint, the grep-then-delete pass closed it" },
  { key: "b85#8", verdict: "HELD", basis: "survey-pattern face: the ]! bracket-index reads missed by the first sweep — no scheduled gate audits a survey's own regex, the re-take with the corrected pattern is the guard" },
  { key: "b85#10", verdict: "HELD", basis: "pre-machine face: the dead-alias import was removed on the self-review read-back — its landing face is an unused-symbol death at lint" },
  { key: "b85#12", verdict: "SHARPENED", basis: "dual-face (the sanctioned-channel family's twentieth sighting): the act — package-lock version fields through node -e fs.write — is booked, round-trip verified valid after; a malformed lock dies at the next npm invocation. Booked: the act face only" },
  { key: "b85#13", verdict: "SHARPENED", basis: "dual-face (the family's nineteenth sighting, the wave's second): the shell-act face — npm test through a tail pipe — is booked; the landing face never existed, the no-pipe re-run is the only verdict. Booked: the shell-act face only" },
  { key: "b85#18", verdict: "HELD", basis: "pre-machine face: the wrong-module imports and the forged Rng cast were rewritten whole on self-inspection — drafts do not reach the machine dirty, and no gate compiles an editor buffer" },
  { key: "b85#19", verdict: "HELD", basis: "pre-machine face: the misplaced doc comment was caught on the read-back and moved — placement is content for doc faces, the reread is the factory check" },
  { key: "b85#20", verdict: "SHARPENED", basis: "dual-face (the sanctioned-channel family's twenty-first sighting): the act — the version bump itself through node -e fs.write, verified complete after the fact — is booked; the Write/Edit-only rule has no version-field exception. Booked: the act face only" },
  { key: "b85#21", verdict: "SHARPENED", basis: "dual-face (the family's twentieth sighting, the wave's third): the shell-act face — a tail pipe with the code echoed from PIPESTATUS — is booked; a preserved status under a pipe is still a piped verdict in shape. Booked: the shell-act face only" },
  { key: "b85#31", verdict: "SHARPENED", basis: "dual-face (the family's twenty-first sighting, the wave's fourth — the wiring agent's own): the shell-act face — the visit's first census authentication piped under a PIPESTATUS echo — is booked; the shape is the banned one regardless of what the echo displayed, and the no-pipe re-issue in the next breath is the only authentication. Booked: the shell-act face only" },
  { key: "b85#35", verdict: "HELD", basis: "derivation face (the wiring agent's own, the b84#21 class recurring one batch later): the census suite convicted the drifted runner-family resolution at its first run — the aftermath is gate-held (W-H fires on every run), but the classifier-before-tier derivation is author-side arithmetic no scheduled gate performs for the author" },
  // ---- batch 86 (the quality wave's fifth batch: born-audited at burial) ----
  { key: "b86#0", verdict: "SHARPENED", basis: "dual-face (the sanctioned-channel family's twenty-second sighting): the act — the chsh.ts edit through node -e fs.writeFileSync, the regex mis-fire leaving a duplicate local kron — is booked; the landing face is a duplicate-definition death at typecheck the moment it stands (removed by the Edit tool before any gate ran). Booked: the act face only" },
  { key: "b86#2", verdict: "HELD", basis: "pre-machine face: the placeholder residue was rewritten whole before any gate ran — no scheduled gate proves a draft reached the machine finished" },
  { key: "b86#3", verdict: "SHARPENED", basis: "dual-face (the sanctioned-channel family's twenty-third sighting): the act — one edit truncating cmat.ts's tail through node -e fs.write — is booked; the landing face is a syntax death at typecheck the moment the truncation lands (the file verified complete before any gate needed to say so). Booked: the act face only" },
  { key: "b86#5", verdict: "HELD", basis: "survey face: the grep filter's false DEAD? positives (type-annotation uses excluded) — no scheduled gate audits a survey's own filter; the manual re-verification against each flagged symbol is the guard" },
  { key: "b86#6", verdict: "HELD", basis: "patch-act face: the edit issued off a Bash cat view was refused by the read-state tracker — the refusal is the guard and nothing damaged landed; read state is earned by the Read tool only" },
  { key: "b86#7", verdict: "HELD", basis: "query face: the backslash form surviving a grep -v exclusion — no scheduled gate audits a query's platform forms; the by-filename re-grep before the cut is the guard" },
  { key: "b86#8", verdict: "HELD", basis: "pre-machine face: the invented replacement (outerAA standing where the absorption law demands a pure delete) compiles clean — no scheduled gate proves a deletion had no successor; the immediate reread caught it, and the law's own execution faces are the discipline" },
  { key: "b86#9", verdict: "HELD", basis: "pre-machine face: the private-plus-void suppression standing in for the cut — a silenced residue is not a landing face any gate would name; the self-review re-cut it pure" },
  { key: "b86#12", verdict: "HELD", basis: "derivation face (the wiring agent's own, the b85#35 class one batch later): the stale-registration layout was convicted by A1 at the census suite's first run — the aftermath is gate-held, but the layout is author-side arithmetic no scheduled gate derives for the author" },
  { key: "b86#13", verdict: "HELD", basis: "count face (the wiring agent's own): the remembered hard count was convicted by the suite's own assertion at its run — a hard figure is recomputed from the board it names, never remembered" },
  // ---- batch 87 (the quality wave's sixth and FINAL batch — born audited at burial) ----
  { key: "b87#0", verdict: "HELD", basis: "pre-machine face: the broken placeholder guard was caught by the NEXT edit's read — no scheduled gate proves a landed patch was finished; the reread is the factory check" },
  { key: "b87#1", verdict: "HELD", basis: "pre-machine face: the draft import's landing face is an unused-symbol death at lint, the deletion closed it before any gate ran — no gate compiles an editor buffer" },
  { key: "b87#2", verdict: "HELD", basis: "pre-machine face: the orphaned import behind the reversed edit was removed on the follow-up read — an edit's direction is ungated, the read-back is the check" },
  { key: "b87#9", verdict: "HELD", basis: "patch-act face: no scheduled gate counts a patch's occurrences against its target — the grep-before-closing discipline is the guard that caught the half-done bump" },
  { key: "b87#10", verdict: "HELD", basis: "environment face (the silent tsx -e line's seventh sighting): the act leaves no output and no artifact — the in-repo scratch-script rule is the enforcement, no gate sees the channel" },
  { key: "b87#11", verdict: "HELD", basis: "pre-machine face: the draft died on its own failure face before the suite ran — describe2 and the both-direction REFUSED assertion shipped; no gate compiles a draft's error messages" },
  { key: "b87#15", verdict: "SHARPENED", basis: "dual-face (the sanctioned-channel family's twenty-fourth sighting, its first sed face): the act — sed -i on a code file — is transient and ungated; the damaged-file face dies at typecheck the moment a mangled edit lands (grep-verified clean this time; clean does not absolve, the b79#10 judgment). Booked: the act face only" },
  { key: "b87#16", verdict: "SHARPENED", basis: "dual-face (the git-ban line's fourth act, the b74#3/b77#8/b78#9 shape): the act — a read-only `git status` against the unconditional agent-git ban — is booked; no mutation occurred and no output shipped, the deliverable's state is read from files. Booked: the act face only" },
  { key: "b87#17", verdict: "HELD", basis: "pre-machine face: the dead self-certifying assertion was deleted on self-review before landing — the seed-pinned anchor that shipped answers to the machine's numbers; no gate proves a check can fail generically" },
  { key: "b87#20", verdict: "HELD", basis: "pre-machine face: the two ineffective edits were self-caught and restored in the same session — the read-back after every structural edit is the factory check" },
  { key: "b87#26", verdict: "HELD", basis: "pre-machine face: the dropped imports were restored on the self-check read-back — the landing face is a TS2305 death at typecheck, the reread closed it first" },
  { key: "b87#31", verdict: "SHARPENED", basis: "dual-face (the exit-code-masking family's twenty-second sighting, an attempted one — the wiring agent's own FIRST command of the visit): the shell-act face — the census authentication piped through tail under a PIPESTATUS echo — is booked; the shape is the banned one regardless of what the echo displayed, no verdict was taken from the pipe, and the no-pipe re-issue with the direct code is the only verdict. Booked: the shell-act face only" },
  { key: "b87#32", verdict: "HELD", basis: "count face (the wiring agent's own, the b86#13 class one batch later): the repair-state total was assembled from remembered subtotals (252) against the board's 255 — the suite's own assertion convicted the drift at its run; a hard figure is recomputed from the board it names, never from a remembered subtotal" },
  { key: "b87#33", verdict: "HELD", basis: "placement face (the wiring agent's own, the b80#3 class): the lint log resolved outside the workspace tree where no scheduled gate scans — deleted one command later, which does not unmake the placement; the in-repo scratch log is the route" },
];

export interface RepairViolation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

/** R4: needle-level firing evidence for every UPGRADED row — the file on
 * disk inside the cited gate's tree, plus the exact assertion, include
 * pattern, or import that fires on THIS row's defect class. Needles are
 * grepped from the live trees at enrollment time, never from memory. */
export interface FiringEvidence {
  /** an UPGRADED audit row's key */
  readonly key: string;
  /** workspace-relative path inside the row's cited gate's tree */
  readonly path: string;
  /** the assertion/include/import text that fires on the defect class */
  readonly needle: string;
}

export const FIRING_EVIDENCE: readonly FiringEvidence[] = [
  { key: "b36#13", path: "dtc-clock/test/dtc.test.ts", needle: "pairing odd zero / even identity" },
  { key: "b37#1", path: "ds_extracted/ds/tests/sched-bench/sched-bench.test.ts", needle: "../../src/bench/generator.js" },
  { key: "b37#7", path: "mutant-census/test/census.test.ts", needle: "b37#7" },
  { key: "b47#1", path: "mutant-census/tsconfig.typecheck.json", needle: "test/**/*" },
  { key: "b56#3", path: "stable-world/tsconfig.typecheck.json", needle: "src/**/*" },
  { key: "b56#7", path: "stable-world/test/stable.test.ts", needle: "[U, H_tot] norm" },
  { key: "b56#8", path: "stable-world/test/stable.test.ts", needle: "the coherence factor is temperature-free" },
  { key: "b57#3", path: "stable-world/tsconfig.typecheck.json", needle: "src/**/*" },
  { key: "b59#0", path: "stable-world/tsconfig.typecheck.json", needle: "src/**/*" },
  { key: "b67#6", path: "mutant-census/test/census.test.ts", needle: "E7" },
  { key: "b70#3", path: "burial-record/src/kernel/audit.ts", needle: "memoryStructureViolations" },
  { key: "b78#13", path: "choice-lang/src/kernel/lang.ts", needle: "NEWEST-FIRST" },
];

/** R1-R4 over the audit table against the live enrollment and registry. */
export function checkRepairAudit(
  audit: readonly RepairRow[],
  enrollment: readonly EnrollmentRow[],
  registry: LiveRegistry,
  evidence: readonly FiringEvidence[] = FIRING_EVIDENCE,
): RepairViolation[] {
  const v: RepairViolation[] = [];
  const enrolledByKey = new Map(enrollment.map((r) => [r.key, r] as const));
  const liveByKey = new Map(registry.errors.map((e) => [e.key, e] as const));
  const seen = new Set<string>();
  for (const r of audit) {
    if (!REPAIR_VERDICTS.includes(r.verdict)) {
      v.push({ row: r.key, law: "R3", detail: `illegal verdict "${r.verdict}" — the vocabulary is closed` });
      continue;
    }
    if (seen.has(r.key)) {
      v.push({ row: r.key, law: "R3", detail: "duplicate audit key" });
      continue;
    }
    seen.add(r.key);
    if (!liveByKey.has(r.key)) {
      v.push({ row: r.key, law: "R3", detail: "audits an error the registry does not carry — a dead key" });
      continue;
    }
    if (r.basis.trim() === "") {
      v.push({ row: r.key, law: "R3", detail: "empty basis — an audit verdict must say why, on the record" });
      continue;
    }
    const enrolled = enrolledByKey.get(r.key);
    if (!enrolled) {
      v.push({ row: r.key, law: "R1", detail: "the audited error is not enrolled — the audit cannot outrun the E-board" });
      continue;
    }
    if (r.verdict === "UPGRADED") {
      if (enrolled.tier !== "GATE-ENFORCED") {
        v.push({
          row: r.key,
          law: "R1",
          detail: `verdict UPGRADED but the live enrollment tier is ${enrolled.tier} — an upgrade must sit on a row that really is gate-held`,
        });
      } else if (!r.basis.includes(enrolled.anchor)) {
        v.push({
          row: r.key,
          law: "R2",
          detail: `the basis does not cite the falsifying anchor verbatim — expected "${enrolled.anchor}" inside the basis`,
        });
      }
    } else if (enrolled.tier !== "BOOKED-UNENFORCEABLE") {
      v.push({
        row: r.key,
        law: "R1",
        detail: `verdict ${r.verdict} but the live enrollment tier is ${enrolled.tier} — a later flip must edit this audit row in the same act`,
      });
    }
  }
  for (const row of enrollment) {
    if (row.tier === "BOOKED-UNENFORCEABLE" && !seen.has(row.key)) {
      v.push({
        row: row.key,
        law: "R1",
        detail: "booked without an audit verdict — born-audited is law: every new booked row carries its repair-audit verdict in the same edit",
      });
    }
  }
  // R4 — firing evidence: one needle-level witness per UPGRADED row, live
  const upgradedAuditKeys = new Set(audit.filter((r) => r.verdict === "UPGRADED").map((r) => r.key));
  const evidenceBykey = new Map<string, FiringEvidence[]>();
  for (const e of evidence) {
    const list = evidenceBykey.get(e.key) ?? [];
    list.push(e);
    evidenceBykey.set(e.key, list);
    if (!upgradedAuditKeys.has(e.key)) {
      v.push({ row: e.key, law: "R4", detail: "firing evidence carried for a row that is not UPGRADED — evidence follows verdicts" });
    }
  }
  for (const key of upgradedAuditKeys) {
    const rows = evidenceBykey.get(key) ?? [];
    if (rows.length === 0) {
      v.push({ row: key, law: "R4", detail: "UPGRADED without firing evidence — the deep check requires the needle-level witness in the cited gate's tree" });
      continue;
    }
    if (rows.length > 1) {
      v.push({ row: key, law: "R4", detail: `${rows.length} evidence rows — exactly one needle per upgrade` });
    }
    const e = rows[0]!;
    const full = resolve(WORKSPACE_ROOT, e.path);
    if (!existsSync(full)) {
      v.push({ row: key, law: "R4", detail: `evidence file missing: ${e.path}` });
    } else if (!readFileSync(full, "utf8").includes(e.needle)) {
      v.push({ row: key, law: "R4", detail: `evidence needle "${e.needle}" not found in ${e.path} — the firing witness is not on disk` });
    }
  }
  return v;
}

/** W-Y: the repair audit census — every verdict live against the enrollment. */
export async function witnessRepairAudit(
  audit: readonly RepairRow[] = REPAIR_AUDIT,
  enrollment: readonly EnrollmentRow[] = ENROLLMENT,
): Promise<WitnessResult> {
  const registry = await loadLiveRegistry();
  const v = checkRepairAudit(audit, enrollment, registry);
  const tally: Record<string, number> = {};
  for (const r of audit) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  return {
    name: "W-Y repair audit census",
    pass: v.length === 0,
    detail:
      v.length > 0
        ? `${v.length} violation(s): ${v.slice(0, 5).map((x) => `${x.row} [${x.law}]`).join("; ")}${v.length > 5 ? ", …" : ""}`
        : `${audit.length} booked-population rows audited LIVE (of the ${enrollment.filter((r) => r.tier === "BOOKED-UNENFORCEABLE").length} booked + ${tally["UPGRADED"] ?? 0} upgraded) — UPGRADED ${tally["UPGRADED"] ?? 0} on cited live anchors with needle-level firing evidence (R4, ${FIRING_EVIDENCE.length} needles in the cited gates' own trees), SHARPENED ${tally["SHARPENED"] ?? 0} to named faces, HELD ${tally["HELD"] ?? 0} with the ungated face stated; born-audited is law`,
  };
}
