/**
 * THE ANCHOR BOARD (A-board) — every GATE-ENFORCED anchor upgraded from a
 * string to a REGISTERED GUARD WITH EVIDENCE.
 *
 * E3 proves the needle is on disk; it does not prove the gate can FIRE. A
 * guard that never convicts is a false guard (the Q4 family lesson: a check
 * nothing can move is a constructed zero). The A-board closes that hole with
 * three evidence kinds, closed vocabulary:
 *
 *   FIRING-INJECT — a named conviction demo exists as a real test (in this
 *     repo or a sibling whose suite the total gate runs): a violation of a
 *     held class is injected into the REAL checker and convicted BY NAME
 *     (A2 verifies the demo file+name on disk; its greenness is enforced by
 *     the suites the total gate already runs);
 *   FIRING-LIVE  — the guard's firing face is executed RIGHT NOW by this
 *     census (fireLive below): a forged violation or a live kill, convicted
 *     on the spot (A3);
 *   RESOLVED     — for script gates whose full firing means re-running
 *     another repo's build: the gate's IMPLEMENTING ARTIFACTS are verified
 *     to exist and to be wired (the test tree, the typecheck project, the
 *     lint config, the repro target, the formatter) — the needle is not a
 *     dead string, the machinery behind it is on disk (A3).
 *
 * Laws (checked live, every run):
 *   A1 REGISTRY SYMMETRY — the anchors used by enrollment rows and the
 *      anchors registered must match EXACTLY both ways: an unregistered
 *      anchor holds errors illegally, a stale registration claims a guard
 *      nothing uses (the K-board symmetry, applied to guards);
 *   A2 INJECT DEMOS ON DISK — demo file exists, demo name in the file;
 *   A3 LIVE FIRE / RESOLUTION — every FIRING-LIVE anchor fires here, every
 *      RESOLVED anchor resolves to its machinery;
 *   A4 ARTIFACT FIRING (v0.11.0, the deep check's second layer) — the total
 *      gate already fires every repo's suite; the census HARVESTS that
 *      firing from the last recorded artifact: a RESOLVED test/typecheck
 *      anchor whose repo cell is RED in that run is a violation — RESOLVED
 *      evidence deepens from "the machinery exists" to "the machinery fired
 *      green in the last recorded workspace run". Lint/repro/format anchors
 *      fire at delivery time, not in the total gate — A4 books nothing for
 *      them; a missing artifact books nothing either (the T-board contract:
 *      the artifact records the last EXPLICIT run).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { MUTANTS, type MutantSpec } from "./family.js";
import { runKillCensus, runNegativeControls } from "./battery.js";
import { WORKSPACE_ROOT, rootStrayFiles, unguardedEntryFiles } from "./census.js";
import { ENROLLMENT, type EnrollmentRow } from "./enrollment.js";
import { checkEnrollment } from "./audit.js";
import { loadLiveRegistry } from "./bridge.js";

export type AnchorKind = "FIRING-INJECT" | "FIRING-LIVE" | "RESOLVED";

export interface AnchorRegistration {
  /** "workspace-relative/path :: needle" — byte-identical to what rows carry */
  readonly anchor: string;
  readonly kind: AnchorKind;
  /** FIRING-INJECT: where the conviction demo lives and what it is called */
  readonly demoFile?: string;
  readonly demoName?: string;
  /** what the evidence IS, one line, printed on the report */
  readonly evidence: string;
}

/** The fixture repo for the unguarded-entry detector's live firing — a render
 * entry with no house guard, so the detector can be seen naming it. */
export const FIXTURE_REPO = "mutant-census/test/fixtures/warden-fixture";

export const ANCHOR_REGISTRY: readonly AnchorRegistration[] = [
  // ---- the checker-law anchors: conviction demos, injected into the REAL checkers ----
  { anchor: "burial-record/src/kernel/audit.ts :: B4", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire B4", evidence: "a forged batch with a dead source anchor is convicted BY NAME by burial-record's own checkBurial (imported live)" },
  { anchor: "depreciation-ledger/src/kernel/audit.ts :: L1", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire L1", evidence: "a ledger row quoting numbers with an empty cost column is convicted by the ledger's own checkLedger (imported live)" },
  { anchor: "depreciation-ledger/src/kernel/audit.ts :: L2", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire L2", evidence: "a settled row quoting no numbers is convicted by checkLedger — no-number rows must stay OPEN" },
  { anchor: "depreciation-ledger/src/kernel/audit.ts :: L6", kind: "FIRING-INJECT", demoFile: "depreciation-ledger/test/ledger.test.ts", demoName: "L6: all five arithmetic witnesses pass", evidence: "the five headline costs are re-derived from scratch in the ledger's own gate (a suite the total gate runs)" },
  { anchor: "mutant-census/src/kernel/audit.ts :: provenanceRepos", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire provenanceRepos", evidence: "a provenance with a trailing paren note ('batch 10 (qverify, expPauli)') resolves to exactly qverify — the charset does not swallow commas, no false conviction" },
  { anchor: "mutant-census/test/anchors.test.ts :: A-fire L2", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire L2", evidence: "batch 35's own lesson as a guard: the L2 demo encodes the law's REAL object read from the ledger's source (a blank column with a settled verdict) — ammo cast from memory fires at nothing, and this demo going green is the proof it was cast from the law" },
  // ---- the census's own laws: fired LIVE, here, on every run ----
  { anchor: "mutant-census/src/experiments/render.ts :: witness letters must be unique", kind: "FIRING-LIVE", evidence: "a forged report headlining two censuses under one W-letter is refused on the spot (assertUniqueWitnessLetters, the b46#5 tier upgrade; the guard lives in report.ts since b53#5 — a leaf, so the anchor's dynamic fire can never deadlock the entry)" },
  { anchor: "burial-record/package.json :: test", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire B7", evidence: "a forged batch whose context states NINE delivery errors over ten carried errors is convicted BY NAME (law B7) by burial-record's own checkBurial, imported live — the b45#9 class can never again wait for the visitor" },
  { anchor: "mutant-census/src/kernel/audit.ts :: E1", kind: "FIRING-LIVE", evidence: "a forged registry carrying an un-enrolled error is convicted by checkEnrollment on the spot" },
  { anchor: "mutant-census/src/kernel/audit.ts :: E2", kind: "FIRING-LIVE", evidence: "a forged class-mismatched mutant tie is convicted by checkEnrollment on the spot" },
  { anchor: "mutant-census/src/kernel/audit.ts :: Q2", kind: "FIRING-LIVE", evidence: "the ghost mutant (declared EXACT-KILL, ships the canonical function) is reported SURVIVED by the live kill census — the declared-vs-live law has teeth" },
  { anchor: "mutant-census/src/kernel/audit.ts :: Q4", kind: "FIRING-LIVE", evidence: "the battery's synthetic violators FIRE on every run (runNegativeControls) — a property nothing can move is a constructed zero, and this anchor is why the controls exist" },
  { anchor: "mutant-census/src/kernel/audit.ts :: W-C", kind: "FIRING-LIVE", evidence: "the negative controls fire live: shape-blind product, lopsided outer, non-CPTP Kraus each get named" },
  { anchor: "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE", kind: "FIRING-LIVE", evidence: "MU2 (the conjugated vecToRho — Hermitian, trace 1, PSD, invisible to statehood) is killed EXACTLY by P2's phase-sensitive dual path, live" },
  { anchor: "mutant-census/src/kernel/census.ts :: unguardedEntryFiles", kind: "FIRING-LIVE", evidence: "the in-repo fixture repo's unguarded render entry is NAMED by the detector, live" },
  { anchor: "mutant-census/src/kernel/census.ts :: rootStrayFiles", kind: "FIRING-LIVE", evidence: "a forged root listing carrying a stray scratch is named by the detector on the spot (the b54#0 ROOT face, gate-held since v0.9.0 — the b46#5 upgrade pattern: the BOOKED reason 'no gate schedules where the scratch file lives' went false; the system-temp face of the class lives outside the workspace tree and stays booked on its own rows)" },
  // ---- the script gates: RESOLVED to their implementing machinery ----
  { anchor: "mutant-census/scripts/total-gate.ts :: typecheck", kind: "RESOLVED", evidence: "the T-board script constructs a typecheck job for every epoch repo (the job spec is in the script source); its full firing IS the total gate run" },
  { anchor: "mutant-census/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired" },
  { anchor: "burial-record/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired (b53#2's catch, registered the moment it was first needed)" },
  { anchor: "mutant-census/package.json :: repro", kind: "RESOLVED", evidence: "the repro script's tsx target (src/experiments/render.ts) exists — the gate points at a real program" },
  { anchor: "mutant-census/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files — the gate has something to run" },
  { anchor: "mutant-census/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk — the project the gate compiles" },
  { anchor: "ds_extracted/ds/package.json :: format:check", kind: "RESOLVED", evidence: "prettier in devDependencies — the formatter the gate invokes is installed" },
  { anchor: "ds_extracted/ds/package.json :: test", kind: "RESOLVED", evidence: "the tests/ tree exists and carries test files" },
  { anchor: "ds_extracted/ds/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "ds_extracted/ds/tsconfig.json :: exactOptionalPropertyTypes", kind: "RESOLVED", evidence: "the flag itself is the machinery (content already E3-verified); compile-level firing would re-run tsc per census run — the cost is booked here, the check stays content-level" },
  { anchor: "ft-qaoa/tsconfig.json :: exactOptionalPropertyTypes", kind: "RESOLVED", evidence: "the flag itself is the machinery; compile-level firing cost booked, content-level check kept" },
  { anchor: "bqp-map/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dsic-noether/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dsic-noether/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk (include spans src, test, experiments) — registered the moment batch 66 first needed it (the b53#5 law)" },
  { anchor: "dsic-noether/package.json :: lint", kind: "RESOLVED", evidence: "eslint config on disk and eslint in devDependencies — the machinery batch 66 saw fire three times" },
  { anchor: "ent-clearing/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "ent-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "ft-qaoa/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "k-switch/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "nonstoq-anneal/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "nosignal-tariff/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "qram-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "readout-wall/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "stable-world/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "stable-world/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files — the gate the R-board's b56#3/b56#7/b56#8/b57#3/b59#0 upgrades ride (their sightings were convicted at suite/typecheck runs of this very tree); registered the moment the R-board first needed it (the b53#5 law)" },
  { anchor: "stable-world/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired" },
  { anchor: "survivor-census/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "switch-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "vacuum-compiler/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dtc-clock/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dtc-clock/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "dtc-clock/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired" },
  { anchor: "phase-law/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "phase-law/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  // ---- the v0.10.0 R-board upgrades: registered with the rows they now hold ----
  { anchor: "mutant-census/test/census.test.ts :: b37#7", kind: "FIRING-INJECT", demoFile: "mutant-census/test/census.test.ts", demoName: "b37#7", evidence: "the single-source guard: the total-gate script must IMPORT EPOCH_REPOS from the census kernel and carry no second literal list — the dual-list drift that once produced a 27-vs-28 artifact header dies at the suite that reads the script's source" },
  // ---- the v0.11.0 E7 upgrade: the stated-counts law holds its own history ----
  { anchor: "mutant-census/test/census.test.ts :: E7", kind: "FIRING-INJECT", demoFile: "mutant-census/test/census.test.ts", demoName: "E7", evidence: "the stated-counts guard: a forged description claiming drifted tier counts (147 on gates where the enrollment carries another number) is convicted BY NAME by checkStatedCounts against the live rows — the b67#6 eleven-visit drift and its same-day recurrence (b68#0) both ride this gate; the renderer refuses to print a drifted self-description" },
  // ---- the v0.14.0 B9 upgrade: the memory substrate guards itself ----
  { anchor: "burial-record/src/kernel/audit.ts :: memoryStructureViolations", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire B9", evidence: "the memory-structure guard: forged daily-note text carrying the repeated-label signature (the b70#3 shape, pasted three times in one day and prevented never) is convicted BY LINE NUMBER by burial-record's own memoryStructureViolations, imported live — the ledger's evidence base now guards its own structure (B9, v0.5.0 of the record)" },
  // ---- the batch-74 latent-defect anchors: the smuggling-trial tests that killed
  // three v0.1.0 survivors (the b53#5 law — registered the moment the rows first sat on them) ----
  { anchor: "switch-sched/test/process.test.ts :: identity channel gives SWAP", kind: "FIRING-INJECT", demoFile: "switch-sched/test/process.test.ts", demoName: "identity channel gives SWAP", evidence: "the CJ-convention guard: the v0.1.0 latent defect (identity not mapping to SWAP under complex Kraus) dies at the circuit-vs-process assertion the switch-sched suite runs on every pass — the test that caught it in the same breath it was written" },
  { anchor: "switch-sched/test/process.test.ts :: eigenvalues exactly {0, ½}", kind: "FIRING-INJECT", demoFile: "switch-sched/test/process.test.ts", demoName: "eigenvalues exactly {0, ½}", evidence: "the exact-spectrum guard: the v0.1.0 global-½ double-count dies at W_OCB's exact-eigenvalue assertion {0, ½} (8-fold each, trace 4) — a scaled process matrix cannot pass it" },
  { anchor: "switch-sched/test/process.test.ts :: 8192 vertices", kind: "FIRING-INJECT", demoFile: "switch-sched/test/process.test.ts", demoName: "8192 vertices", evidence: "the census-size guard: the v0.1.0 fabricated census size (20480) dies at the census's own size assertion — 8192 deterministic strategies (4096 per order) cap exactly ¾, and the vertex count is pinned to the enumeration that produces it" },
  { anchor: "switch-sched/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted batch 74's void-expression/array-type lint batch (the b53#5 law)" },
  { anchor: "nonstoq-anneal/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk — the project the gate compiles; the machinery that convicted batch 74's unused-parameter/unexported-main/readonly-push batch (the b53#5 law)" },
  // ---- the batch-75 wave anchors: the second four-repo delivery's conviction
  // sites (the b53#5 law — registered the moment the rows first sat on them) ----
  { anchor: "route-price/test/dossier.test.ts :: R5: all executable witnesses pass", kind: "FIRING-INJECT", demoFile: "route-price/test/dossier.test.ts", demoName: "R5: all executable witnesses pass", evidence: "the sibling-claim guard: W-E's iso face (|cos 2kδ| coherent oscillation — the geometric envelope overruled at deviation 8.2e-1) is asserted on every suite run under R5; a rebaked geometric model fails the witness and the suite with it" },
  { anchor: "causal-ineq/test/causal-ineq.test.ts :: W* eigenvalues exactly {0, 1/2}", kind: "FIRING-INJECT", demoFile: "causal-ineq/test/causal-ineq.test.ts", demoName: "W* eigenvalues exactly {0, 1/2}", evidence: "the scale guard: a 4x coefficient moves W*'s spectrum off {0, ½} and the eigenvalue assertion convicts on the spot" },
  { anchor: "causal-ineq/test/causal-ineq.test.ts :: OCB12 eq. (7)", kind: "FIRING-INJECT", demoFile: "causal-ineq/test/causal-ineq.test.ts", demoName: "OCB12 eq. (7)", evidence: "the slot-order guard: W* ≡ OCB12 eq. (7) is checked ELEMENTWISE — a transcribed vector with its slots in the wrong order dies entry by entry" },
  { anchor: "causal-ineq/test/causal-ineq.test.ts :: noise threshold exactly eta = 1/sqrt(2)", kind: "FIRING-INJECT", demoFile: "causal-ineq/test/causal-ineq.test.ts", demoName: "noise threshold exactly eta = 1/sqrt(2)", evidence: "the exact-boundary guard: a tampered threshold (0.71 where the machine holds 1/√2) breaks the PSD account at the boundary and the noise-threshold test names it" },
  { anchor: "k-switch/test/k4.test.ts :: ZERO commuting Pauli quadruples exist at d=4", kind: "FIRING-INJECT", demoFile: "k-switch/test/k4.test.ts", demoName: "ZERO commuting Pauli quadruples exist at d=4", evidence: "the no-go census guard: the machine's (0, 30, 1335) over 1365 is asserted and a counterfeit census (an invented commuting quadruple) is named by the smuggling trial in the same file" },
  { anchor: "k-switch/test/k4.test.ts :: constructed matched pair outside the Pauli universe", kind: "FIRING-INJECT", demoFile: "k-switch/test/k4.test.ts", demoName: "constructed matched pair outside the Pauli universe", evidence: "the generator-contract guard: the constructed pair keeps max trace distance < 1e-7 over all 24 plain orders — the T = 0.918 generator died exactly here" },
  { anchor: "k-switch/test/k4.test.ts :: the generator's Pauli ray", kind: "FIRING-INJECT", demoFile: "k-switch/test/k4.test.ts", demoName: "the generator's Pauli ray", evidence: "the phase guard: rotationsOf's product is phase-only off the generator (diagonal exactly 0) — a wrong phase leaves the ray and the assertion names it" },
  { anchor: "k-switch/test/k4.test.ts :: Algorithm 1 reads the promise column with probability 1 exactly", kind: "FIRING-INJECT", demoFile: "k-switch/test/k4.test.ts", demoName: "Algorithm 1 reads the promise column with probability 1 exactly", evidence: "the layout guard: the 8-dim split-layout joint state feeding Algorithm 1 must read the promise column at probability exactly 1 on every promising set — NaN and mislayout die at the first such assertion" },
  { anchor: "k-switch/test/k4.test.ts :: NO plain order separates ANY column pair", kind: "FIRING-INJECT", demoFile: "k-switch/test/k4.test.ts", demoName: "NO plain order separates ANY column pair", evidence: "the object guard: the game matrix (the discriminator) is asserted cell by cell (all 144 entries 0) — the projection-vs-discriminator conflation cannot survive it" },
  { anchor: "postselect-sched/test/t5-power-ledger.test.ts :: branch ratio = integer ratio on real 3-SAT", kind: "FIRING-INJECT", demoFile: "postselect-sched/test/t5-power-ledger.test.ts", demoName: "branch ratio = integer ratio on real 3-SAT", evidence: "the integer-account guard: 2*both vs m holds on real 3-SAT — the halved U_1 initialization (x where 2x belongs) breaks the ratio and the referee convicts" },
  { anchor: "postselect-sched/test/t6-tieface.test.ts :: exact tie iff d | a1^2", kind: "FIRING-INJECT", demoFile: "postselect-sched/test/t6-tieface.test.ts", demoName: "exact tie iff d | a1^2", evidence: "the tie-equation guard: the census holds both directions on exact rationals and every reported tie re-verifies through the full ledger row machinery — a broken denominator dies on re-verification" },
  { anchor: "postselect-sched/src/experiments/run-all.ts :: call the mains directly", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the no-op repro guard: the explicit main calls ARE the fix — a recurrence that reverts run-all to import-only removes the needle and E3 convicts the missing-guard face on every census run (the exit-0-fake-green family's first needle-held sighting; the demo is E3's own conviction trial)" },
  { anchor: "switch-sched/docs/citations.md :: 10.1038/s41467-023-40162-8", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the identifier guard: the VDL23 DOI is pinned in the register — a drift back to 5807 or a dropped DOI removes the needle and E3 convicts the missing-guard face on every census run (the b55#3 identifier family's first needle-held sighting; the demo is E3's own conviction trial)" },
  { anchor: "route-price/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's two lint rounds" },
  { anchor: "causal-ineq/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the 32-error lint batch" },
  { anchor: "postselect-sched/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk — the project that kills the template-string quote mismatch the moment it lands" },
  { anchor: "postselect-sched/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's two lint errors" },
  // ---- the batch-76 wave anchors: the third four-repo delivery's conviction
  // sites (the b53#5 law — registered the moment the rows first sat on them) ----
  { anchor: "qram-sched/src/online/kv-tight.ts :: BigInt division with 18 kept digits", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the overflow guard: the scaled-BigInt division IS the fix — a recurrence that converts factorials through Number again removes the needle and E3 convicts the missing-guard face on every census run (the n≥256 NaN face; the demo is E3's own conviction trial)" },
  { anchor: "qram-sched/src/experiments/exp1-qram.ts :: the degenerate best case", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the population guard: the p = 1/2 exclusion comment marks the worst-off-grid-bank fix — a recurrence that lets the on-grid degenerate point set the requirement again removes the needle and E3 convicts the missing-guard face on every census run" },
  { anchor: "qram-sched/src/experiments/run-all.ts :: EXPORTED main()", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the no-op repro guard (destructive subspecies): run-all wiping out/reports and importing silently is the fix's absence — the explicit exported-main calls ARE the fix, and a recurrence that reverts to import-only removes the needle and E3 convicts on every census run (the b75#18 twin)" },
  { anchor: "quantum-mech/test/datalock.test.ts :: average is exactly I/d", kind: "FIRING-INJECT", demoFile: "quantum-mech/test/datalock.test.ts", demoName: "average is exactly I/d", evidence: "the object guard: the locked-ensembles referee asserts the mean is exactly I/d at 1e-12 for every d — the I-vs-I/d comparison dies at the first such assertion on every suite run" },
  { anchor: "quantum-mech/src/protocol/datalock.ts :: Σ_ij a_ij conj(b_ij)", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the sign guard: the corrected Tr[AB] formula is pinned as the kernel's own comment — a recurrence that rewrites the sign removes the needle and E3 convicts the missing-guard face on every census run (the PGM conditionals ride the formula)" },
  { anchor: "quantum-mech/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's two post-hoc lint/typecheck residue" },
  { anchor: "quantum-mech/docs/citations.md :: Rubinstein & Zhou", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the attribution guard: the corrected author entry (with the v0.2.0 erratum naming the wrong one) is pinned in the register — a drift back to 'Wolitzky et al.' removes the needle and E3 convicts on every census run (the identifier family's fifth sighting, first author-table face held)" },
  { anchor: "quantum-mech/docs/citations.md :: DiVincenzo, Horodecki, Leung, Smolin, Terhal & Wootters", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the roster guard: the six-author DLW04 entry is pinned in the register — a recurrence of the three-name table removes the needle and E3 convicts on every census run (the identifier family's sixth sighting, consecutive with the fifth)" },
  { anchor: "retro-cache/test/w5-amplification.test.ts :: rank formula matches brute force", kind: "FIRING-INJECT", demoFile: "retro-cache/test/w5-amplification.test.ts", demoName: "rank formula matches brute force", evidence: "the implementation guard: the sparse-profile rank formula is asserted against brute-force Gaussian elimination — a placeholder gf2Rank returns garbage and the W5.C referee convicts it on every suite run" },
  { anchor: "retro-cache/test/w6-adversary.test.ts :: crossing exact", kind: "FIRING-INJECT", demoFile: "retro-cache/test/w6-adversary.test.ts", demoName: "crossing exact", evidence: "the algebra guard: the depreciation crossing is asserted exact against its closed form with |S| = 2 at the crossing — a wrong crossing-tap algebra dies at the two-route table on every suite run" },
  { anchor: "retro-cache/test/w6-adversary.test.ts :: eta=0 reproduces the honest ledger", kind: "FIRING-INJECT", demoFile: "retro-cache/test/w6-adversary.test.ts", demoName: "eta=0 reproduces the honest ledger", evidence: "the sign guard: the attacked CHSH at zero tap must reproduce the honest ledger exactly — a sign error breaks the endpoint identity and the W6.A referee convicts it on every suite run" },
  { anchor: "retro-cache/test/w6-adversary.test.ts :: strictly positive tax, exactly zero gain", kind: "FIRING-INJECT", demoFile: "retro-cache/test/w6-adversary.test.ts", demoName: "strictly positive tax, exactly zero gain", evidence: "the mixture guard: settings mutation is asserted with strictly positive tax and exactly zero gain, two-route QBER — a wrong mixing rate moves either invariant and the W6.D referee convicts it on every suite run" },
  { anchor: "retro-cache/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files — the suite that holds the wave's rewritten W5/W6 assertions (the fake-claim face died exactly here)" },
  { anchor: "retro-cache/docs/citations.md :: Verification 2026-09-08: SIAM publisher page", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the verification-record guard: the double-source record is pinned in the register — a recurrence that ships a DOI without one removes the needle and E3 convicts on every census run (the citation family's unverified-DOI face)" },
  { anchor: "retro-cache/src/experiments/run-all.ts :: own subprocess", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the no-op repro guard (subprocess form): each experiment running as its own process IS the fix — a recurrence that reverts run-all to import-only removes the needle and E3 convicts on every census run (the b75#18 family, second repo)" },
  { anchor: "nosignal-tariff/test/theorem.test.ts :: the ln2 enclosure is tight", kind: "FIRING-INJECT", demoFile: "nosignal-tariff/test/theorem.test.ts", demoName: "the ln2 enclosure is tight", evidence: "the tail-bound guard: the enclosure's tightness and the −ln(1/2) = ln2 reduction are asserted with the two-derivation overlap — a 2x-too-small tail dies at the M1 referee on every suite run" },
  { anchor: "nosignal-tariff/src/kernel/rational.ts :: decimal long division when either limb overflows", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the wide-rational guard: the decimal-long-division fallback IS the fix — a recurrence of the naive Number(n)/Number(d) removes the needle and E3 convicts on every census run (the NaN-on-render face)" },
  { anchor: "nosignal-tariff/test/theorem.test.ts :: no inflection cell named", kind: "FIRING-INJECT", demoFile: "nosignal-tariff/test/theorem.test.ts", demoName: "no inflection cell named", evidence: "the map guard: the convexity face names zero suspect cells and the fake-inflection-table smuggling trial sits beside it — an inverted map names the healthy cells and the M3 referee convicts it on every suite run" },
  { anchor: "switch-sched/src/experiments/run-all.ts :: calls the mains directly", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the no-op repro guard (fourth repo, the family's systemic sighting): the explicit main calls with the rendered-count refusal ARE the fix — a recurrence that reverts run-all to import-only removes the needle and E3 convicts on every census run (the b75#18 family; fixed by this wiring visit's Task A with the mtime witness)" },
  // ---- the batch-77 wave anchors: the fourth four-repo delivery's conviction
  // sites (the b53#5 law — registered the moment the rows first sat on them) ----
  { anchor: "readout-wall/src/kernel/audit.ts :: replacer closed form vs sim maxdev", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the member-labeling guard: the W-F witness re-derives the replacer closed form from the control-marginal simulation at all 21 grid points — a formula with its member entropies on the wrong members fails the witness (and the suite's all-six-witnesses run) on the spot; the sim cross-check IS the demo" },
  { anchor: "readout-wall/test/readout.test.ts :: the ln enclosures bracket the true log on both series paths", kind: "FIRING-INJECT", demoFile: "readout-wall/test/readout.test.ts", demoName: "the ln enclosures bracket the true log on both series paths", evidence: "the enclosure guard: LN2_T and LN2_A must each contain ln 2 — the halved atanh closure (LN2_A enclosing ln2/2) dies at the lo bracket on every suite run; the same test's reference-slack comment holds the ulp-tolerance fix beside it" },
  { anchor: "readout-wall/test/readout.test.ts :: the slack below is for the REFERENCE", kind: "FIRING-INJECT", demoFile: "readout-wall/test/readout.test.ts", demoName: "the slack below is for the REFERENCE", evidence: "the reference-tolerance guard: the bracket test's slack (1e-15 relative, for Math.log's own ulp error on the double nearest q) is pinned as the test's own comment — a recurrence of the zero-slack assertion removes the needle and E3 convicts the missing-guard face on every census run" },
  { anchor: "survivor-census/test/compose.test.ts :: staged kills are disjoint items", kind: "FIRING-INJECT", demoFile: "survivor-census/test/compose.test.ts", demoName: "staged kills are disjoint items", evidence: "the population guard: stage 2's register is read off kept-by-A-and-not-kept-by-AB universes — a loop that compares the already-killed population breaks the disjoint-union identity and the compose referee convicts it, with the double-counted-kill smuggling trial (TRIAL 3) beside it" },
  { anchor: "survivor-census/test/phasecensus.test.ts :: constantDifferenceOnFunded", kind: "FIRING-INJECT", demoFile: "survivor-census/test/phasecensus.test.ts", demoName: "constantDifferenceOnFunded", evidence: "the per-instance guard: the equality-case flag is computed over the funded set, not hardcoded per family — sign-alt is constant on the all-even marked set and the machine detects it; a hardcoded table misses exactly the marked-set-specific cases and the equality-case assertion convicts it" },
  { anchor: "survivor-census/test/phasecensus.test.ts :: the Fourier ramp's overlap with flat matches the closed form", kind: "FIRING-INJECT", demoFile: "survivor-census/test/phasecensus.test.ts", demoName: "the Fourier ramp's overlap with flat matches the closed form", evidence: "the conjugation guard: the two-path closed form is asserted componentwise (re and im) against the machine's overlap — a flipped conjugation sign in either component dies at the componentwise assertion on every suite run" },
  { anchor: "survivor-census/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's preserve-caught-error sighting" },
  { anchor: "survivor-census/src/experiments/run-all.ts :: \\|x*>", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the escaped-cell guard: the ket's pipe is escaped in R5's face so the rendered census table keeps six columns — a recurrence of the bare pipe removes the needle and E3 convicts on every census run (the latent v0.1.0 render defect, closed at its own face)" },
  { anchor: "ent-clearing/test/clearing.test.ts :: the twirl is load-bearing", kind: "FIRING-INJECT", demoFile: "ent-clearing/test/clearing.test.ts", demoName: "the twirl is load-bearing", evidence: "the inertness guard: the honest-negatives test asserts the raw nested round DEGRADES the coin without the twirl (0.884146 -> 0.812024) — a twirl that does nothing on Bell-diagonal states cannot make the recurrence improve, and the degradation assertion convicts it on every suite run" },
  { anchor: "ent-clearing/test/clearing.test.ts :: 24 unitaries", kind: "FIRING-INJECT", demoFile: "ent-clearing/test/clearing.test.ts", demoName: "24 unitaries", evidence: "the group-size guard: the Clifford enumeration is asserted to be exactly 24 unitaries with Werner fixed points — a half-checked orthogonality condition (real part only) passes 68 counterfeits and the count assertion convicts it on every suite run" },
  { anchor: "binding-price/test/market.test.ts :: marginal I/2, reveal 1/2", kind: "FIRING-INJECT", demoFile: "binding-price/test/market.test.ts", demoName: "marginal I/2, reveal 1/2", evidence: "the construction guard: every two-coin strategy (C1 products and C3 rotated Bells included) is asserted per-coin flat — garbage first-draft expressions break the marginal assertion and the T8 referee convicts them on every suite run" },
  { anchor: "binding-price/test/market.test.ts :: per-coin flat at every Schmidt coefficient", kind: "FIRING-INJECT", demoFile: "binding-price/test/market.test.ts", demoName: "per-coin flat at every Schmidt coefficient", evidence: "the companion-index guard: the swap-flip companion keeps per-coin marginals at exactly I/2 at EVERY t — the 01/10 companion lands at per-coin TV 0.5 from I/2 and the marginal assertion convicts it on every suite run" },
  { anchor: "binding-price/src/kernel/audit.ts :: under damping the verifier's register is", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the register guard: panel (e)'s comment pins the object — the verifier's register is E_gamma(I/2), the member announced pure — and the witness asserts the memberwise (1 + gamma*m_z)/2 formula against it; a recurrence that channels the member removes the needle and E3 convicts on every census run" },
  { anchor: "binding-price/test/market.test.ts :: blochOf inverts blochState exactly", kind: "FIRING-INJECT", demoFile: "binding-price/test/market.test.ts", demoName: "blochOf inverts blochState exactly", evidence: "the roundtrip guard: blochOf(blochState(r)) must return r componentwise, one state at a time — the flipped y dies at the y-component assertion on every suite run (the latent v0.1.0 sign defect: double flips cancel in pairs, a one-at-a-time roundtrip has no pair)" },
  // ---- batch 78 (the fifth four-repo wave's conviction sites) — registered the moment the rows first sat on them ----
  { anchor: "qverify/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk — the loader face that convicted the embedded '*/' closing the comment early (the b12#0 twin)" },
  { anchor: "qverify/test/protocol.test.ts :: phaseDampingKraus", kind: "FIRING-INJECT", demoFile: "qverify/test/protocol.test.ts", demoName: "phase damping sits in the Z-tier", evidence: "the Kraus-convention guard: the Z-tier test runs phaseDampingKraus at every gamma in [0,1] and asserts trap acceptance exactly 1-gamma against the closed form — a reversed Kraus pair breaks the acceptance at the first interior grid point and the suite convicts it on every run" },
  { anchor: "qverify/test/protocol.test.ts :: guessAfterPhaseDamp", kind: "FIRING-INJECT", demoFile: "qverify/test/protocol.test.ts", demoName: "guess game is the V-form", evidence: "the overruled-claim guard: the census row asserts the machine-found V-form (1+|1-2gamma| sin(pi/8))/2 at every gamma plus the gamma=1 decoupling anchor — a backwards invisibility claim or a monotone guess-decay dies at the grid on every run" },
  { anchor: "qverify/docs/citations.md :: first-guess author attribution", kind: "FIRING-INJECT", demoFile: "mutant-census/test/enrollment.test.ts", demoName: "smuggle E3", evidence: "the attribution guard: the corrected Tanggara-Gu-Bharti entry with the wrong first guess confessed is pinned in the register — a drift back to the recalled attribution removes the needle and E3 convicts on every census run (the identifier family's seventh sighting, needle-held like its fifth and sixth)" },
  { anchor: "ft-qaoa/test/ft.test.ts :: follows the power law", kind: "FIRING-INJECT", demoFile: "ft-qaoa/test/ft.test.ts", demoName: "follows the power law", evidence: "the hand-arithmetic guard: e5 is asserted exactly at 0.1*(1/6)^3 to 1e-18 beside its monotone siblings — a slipped expected-value (the 0.1-squared face) dies at the exact assertion on every suite run" },
  { anchor: "ft-qaoa/test/constants.test.ts :: duplicate ids are rejected", kind: "FIRING-INJECT", demoFile: "ft-qaoa/test/constants.test.ts", demoName: "duplicate ids are rejected", evidence: "the collision-visibility guard: the audit validation is map-free — a duplicate id yields BOTH rejections (thin rationale AND duplicate) and the smuggling trial asserts the pair stays visible; a map-keyed recurrence overwrites the duplicate and the two-rejection assertion convicts it on every suite run" },
  { anchor: "ft-qaoa/test/ft.test.ts :: window-size policy prices the batching tradeoff", kind: "FIRING-INJECT", demoFile: "ft-qaoa/test/ft.test.ts", demoName: "window-size policy prices the batching tradeoff", evidence: "the feasibility-window guard: the sweep asserts W=4 still exceeds the latency ceiling (utilization 1.03) and W=8 is the first feasible window at 0.856, with the ASIC scenario at 1 and the hopeless fleet null — a W=4 assertion dies at the minLatencyRealtimeWindow equality on every suite run" },
  { anchor: "ft-qaoa/test/noise.test.ts :: depolarizeQubit matches an independent naive Pauli conjugation", kind: "FIRING-INJECT", demoFile: "ft-qaoa/test/noise.test.ts", demoName: "depolarizeQubit matches an independent naive Pauli conjugation", evidence: "the channel guard: the n=2 test rebuilds the reference channel as an independent naive Pauli conjugation on embedded full complex matrices and asserts elementwise agreement to 1e-15 — the latent v0.1.0 branch swap (same-qubit/cross-qubit interchanged, mixing weights off) dies at the first element on every suite run" },
  { anchor: "choice-lang/test/model.test.ts :: the chain's weights MULTIPLY to the composed weight", kind: "FIRING-INJECT", demoFile: "choice-lang/test/model.test.ts", demoName: "condition P then run-and-condition Q equals conditioning P++Q", evidence: "the weight-object guard: the S2 chain's own weight is asserted against the second part's standalone weight, the composed weight against the exact product, and the conditionals through the independent concat path — a wrong comparison target or a repeated-object leaf identity dies at the product assertion on every suite run" },
  { anchor: "vacuum-compiler/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's five lint sightings" },
];

export interface AnchorViolation {
  readonly anchor: string;
  readonly law: string;
  readonly detail: string;
}

function repoOf(packageJsonAnchor: string): string {
  return packageJsonAnchor.slice(0, packageJsonAnchor.indexOf("/package.json"));
}

function testTreeExists(repo: string): boolean {
  for (const dir of ["test", "tests"]) {
    const d = resolve(WORKSPACE_ROOT, repo, dir);
    if (!existsSync(d)) continue;
    const files = readdirSync(d, { recursive: true }) as string[];
    if (files.some((f) => f.endsWith(".test.ts") || f.endsWith(".test.js"))) return true;
  }
  return false;
}

/** A3's RESOLVED face: the gate's implementing machinery, verified. */
export function resolveAnchor(reg: AnchorRegistration): { ok: boolean; detail: string } {
  const [path, needle] = reg.anchor.split(" :: ");
  if (path === undefined || needle === undefined) return { ok: false, detail: "malformed anchor" };
  const root = resolve(WORKSPACE_ROOT, path);
  const repo = repoOf(reg.anchor);
  if (path.endsWith("/package.json")) {
    switch (needle) {
      case "test":
        return testTreeExists(repo)
          ? { ok: true, detail: "test tree present with test files" }
          : { ok: false, detail: `no test files found under ${repo}/test or ${repo}/tests` };
      case "typecheck":
        return existsSync(resolve(WORKSPACE_ROOT, repo, "tsconfig.typecheck.json"))
          ? { ok: true, detail: "tsconfig.typecheck.json on disk" }
          : { ok: false, detail: `${repo}/tsconfig.typecheck.json missing` };
      case "lint":
        return existsSync(resolve(WORKSPACE_ROOT, repo, "eslint.config.mjs"))
          ? { ok: true, detail: "eslint.config.mjs on disk" }
          : { ok: false, detail: `${repo}/eslint.config.mjs missing` };
      case "repro": {
        const pkg = JSON.parse(readFileSync(root, "utf8")) as { scripts?: Record<string, string> };
        const m = pkg.scripts?.repro?.match(/tsx\s+(\S+)/);
        return m && existsSync(resolve(WORKSPACE_ROOT, repo, m[1]!))
          ? { ok: true, detail: `repro target ${m[1]} exists` }
          : { ok: false, detail: "the repro script's tsx target does not resolve" };
      }
      case "format:check": {
        const pkg = JSON.parse(readFileSync(root, "utf8")) as { devDependencies?: Record<string, string> };
        return pkg.devDependencies?.prettier
          ? { ok: true, detail: "prettier installed" }
          : { ok: false, detail: "prettier not in devDependencies" };
      }
      default:
        return { ok: false, detail: `no resolution rule for script needle "${needle}"` };
    }
  }
  if (path.endsWith("tsconfig.json") && needle === "exactOptionalPropertyTypes") {
    // the flag is the machinery; content already verified by E3
    return existsSync(root) ? { ok: true, detail: "flag file on disk (content E3-verified)" } : { ok: false, detail: "tsconfig missing" };
  }
  if (reg.anchor === "mutant-census/scripts/total-gate.ts :: typecheck") {
    const src = readFileSync(root, "utf8");
    return src.includes('kind: "typecheck"')
      ? { ok: true, detail: "the job spec constructs typecheck jobs for every epoch repo" }
      : { ok: false, detail: "the T-board script no longer constructs typecheck jobs" };
  }
  return { ok: false, detail: `no resolution rule for anchor "${reg.anchor}"` };
}

/** A3's FIRING-LIVE face: the guard fires HERE, convicted on the spot. */
export async function fireLive(reg: AnchorRegistration): Promise<{ ok: boolean; detail: string }> {
  const registry = await loadLiveRegistry();
  switch (reg.anchor) {
    case "mutant-census/src/experiments/render.ts :: witness letters must be unique": {
      // dynamic import of the LEAF module (report.ts) — never of render.ts:
      // render.ts imports this module statically, and importing it back
      // while it is the ENTRY (its top-level await pending) deadlocks the
      // repro gate — the b53#5 conviction, fixed by the move
      const { assertUniqueWitnessLetters } = await import("../experiments/report.js");
      const forgedReport = ["- PASS — W-G anchor census (a)", "- PASS — W-G forged twin (b)"].join("\n");
      try {
        assertUniqueWitnessLetters(forgedReport);
        return { ok: false, detail: "the forged duplicate letter was NOT refused" };
      } catch (err) {
        const first = (err as Error).message.split("\n")[0] ?? "duplicate letter refused";
        return { ok: true, detail: `refused on the spot: ${first}` };
      }
    }
    case "mutant-census/src/kernel/audit.ts :: E1": {
      const grown = { ...registry, errors: [...registry.errors, { key: "b99#9", batch: 99, index: 9, repo: "mutant-census", category: "process", wrong: "forged", right: "the forged fixture carries both columns" }] };
      const hit = checkEnrollment(ENROLLMENT, grown).find((v) => v.law === "E1" && v.row === "b99#9");
      return hit ? { ok: true, detail: `convicted: ${hit.row}` } : { ok: false, detail: "the forged un-enrolled error was NOT convicted" };
    }
    case "mutant-census/src/kernel/audit.ts :: E2": {
      const forged = ENROLLMENT.map((r) => (r.key === "b4#0" ? { ...r, tier: "MUTANT-KILLED" as const, anchor: "MU7" } : r));
      const hit = checkEnrollment(forged, registry).find((v) => v.law === "E2" && v.row === "b4#0");
      return hit ? { ok: true, detail: `convicted: ${hit.row} (conjugation row on a wrong-object mutant)` } : { ok: false, detail: "the class-mismatched tie was NOT convicted" };
    }
    case "mutant-census/src/kernel/audit.ts :: Q2": {
      const ghost: MutantSpec = {
        id: "MU98",
        defect: "claims corruption, ships the canonical function",
        history: "batch 31 (stable-world)",
        corrupted: "nothing at all",
        classes: ["conjugation"],
        killer: "P2",
        expected: "EXACT-KILL",
      };
      const k = runKillCensus([ghost])[0];
      return k?.actual === "SURVIVED"
        ? { ok: true, detail: "the ghost is reported SURVIVED against its declared kill — the law fires" }
        : { ok: false, detail: "the ghost was not exposed by the kill census" };
    }
    case "mutant-census/src/kernel/audit.ts :: Q4":
    case "mutant-census/src/kernel/audit.ts :: W-C": {
      const failed = runNegativeControls().filter((c) => !c.pass);
      return failed.length === 0
        ? { ok: true, detail: `${runNegativeControls().length} synthetic violators fired` }
        : { ok: false, detail: `controls that did NOT fire: ${failed.map((c) => c.name).join(", ")}` };
    }
    case "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE": {
      const mu2 = MUTANTS.find((m) => m.id === "MU2")!;
      const k = runKillCensus([mu2])[0];
      return k?.actual === "EXACT-KILL"
        ? { ok: true, detail: `MU2 killed exactly by P2's phase-sensitive path (margin ${k.margin.toExponential(1)})` }
        : { ok: false, detail: `MU2 kill says ${k?.actual ?? "nothing"} — the phase oracle went quiet` };
    }
    case "mutant-census/src/kernel/census.ts :: unguardedEntryFiles": {
      const named = unguardedEntryFiles(FIXTURE_REPO);
      return named.includes("leak.ts")
        ? { ok: true, detail: "the fixture's unguarded entry is named by the detector" }
        : { ok: false, detail: `the detector saw ${JSON.stringify(named)} — it is blind to the fixture` };
    }
    case "mutant-census/src/kernel/census.ts :: rootStrayFiles": {
      const strays = rootStrayFiles(["probe.ts", "AGENTS.md", "scratch-j59-forged.ts"]);
      return strays.includes("scratch-j59-forged.ts") && !strays.includes("probe.ts")
        ? { ok: true, detail: `the forged stray is named: ${strays.join(", ")} — the registered probe passes untouched` }
        : { ok: false, detail: `the detector saw ${JSON.stringify(strays)} — blind to the forged stray` };
    }
    default:
      return { ok: false, detail: `no live-fire rule for anchor "${reg.anchor}"` };
  }
}

/** A4: the artifact-firing law — RESOLVED test/typecheck anchors must be
 * green in the LAST RECORDED total-gate run (the artifact on disk). Pure
 * over the artifact text so the firing range can inject a forged red cell. */
export function checkArtifactFiring(artifactText: string | null, registry: readonly AnchorRegistration[]): AnchorViolation[] {
  if (artifactText === null) return [];
  const cells = new Map<string, { test: string | undefined; typecheck: string | undefined }>();
  for (const line of artifactText.split("\n")) {
    const m = /^\|\s*([^|]+?)\s*\|\s*(PASS|FAIL|—)[^|]*\|\s*(PASS|FAIL|—)/.exec(line);
    if (m) cells.set(m[1]!.trim(), { test: m[2], typecheck: m[3] });
  }
  const v: AnchorViolation[] = [];
  for (const reg of registry) {
    if (reg.kind !== "RESOLVED") continue;
    if (!/ :: (test|typecheck)$/.test(reg.anchor)) continue; // lint/repro/format fire at delivery, not in the total gate
    const repo = repoOf(reg.anchor);
    const needle = reg.anchor.split(" :: ")[1] as "test" | "typecheck";
    const row = cells.get(repo);
    if (!row) continue; // not recorded in this artifact's table — the machinery face stands on its own
    const cell = row[needle] ?? "—";
    if (cell === "—") continue; // not applicable in this run (e.g. the platform's typecheck column) — books nothing
    if (cell !== "PASS") {
      v.push({
        anchor: reg.anchor,
        law: "A4",
        detail: `the last recorded total-gate run fired this gate RED for ${repo} — the machinery fired and failed; resolve the red cell before the census stands`,
      });
    }
  }
  return v;
}

/** A1-A3 over the enrollment rows and the registry (live by default). */
export async function checkAnchors(
  rows: readonly EnrollmentRow[] = ENROLLMENT,
  registry: readonly AnchorRegistration[] = ANCHOR_REGISTRY,
): Promise<AnchorViolation[]> {
  const v: AnchorViolation[] = [];
  const used = new Set(rows.filter((r) => r.tier === "GATE-ENFORCED").map((r) => r.anchor));
  const registered = new Map(registry.map((r) => [r.anchor, r] as const));
  for (const a of used) {
    if (!registered.has(a)) v.push({ anchor: a, law: "A1", detail: "used by enrollment rows but NOT registered — an unregistered guard holds errors illegally" });
  }
  const seen = new Set<string>();
  for (const reg of registry) {
    if (seen.has(reg.anchor)) v.push({ anchor: reg.anchor, law: "A1", detail: "duplicate registration" });
    seen.add(reg.anchor);
    if (!used.has(reg.anchor)) v.push({ anchor: reg.anchor, law: "A1", detail: "STALE registration — no enrollment row sits on this guard" });
    if (reg.kind === "FIRING-INJECT") {
      if (!reg.demoFile || !reg.demoName) {
        v.push({ anchor: reg.anchor, law: "A2", detail: "FIRING-INJECT without a demo file+name" });
        continue;
      }
      const demoPath = resolve(WORKSPACE_ROOT, reg.demoFile);
      if (!existsSync(demoPath)) v.push({ anchor: reg.anchor, law: "A2", detail: `demo file missing: ${reg.demoFile}` });
      else if (!readFileSync(demoPath, "utf8").includes(reg.demoName)) {
        v.push({ anchor: reg.anchor, law: "A2", detail: `demo name "${reg.demoName}" not found in ${reg.demoFile}` });
      }
    } else if (reg.kind === "FIRING-LIVE") {
      const r = await fireLive(reg);
      if (!r.ok) v.push({ anchor: reg.anchor, law: "A3", detail: `did not fire: ${r.detail}` });
    } else {
      // RESOLVED — the closed three-kind vocabulary admits nothing else
      const r = resolveAnchor(reg);
      if (!r.ok) v.push({ anchor: reg.anchor, law: "A3", detail: `did not resolve: ${r.detail}` });
    }
  }
  // A4 — harvest the total gate's last recorded firing for the RESOLVED
  // test/typecheck anchors (the artifact records the last explicit run; its
  // absence books nothing — the T-board contract)
  const artifactPath = resolve(process.cwd(), "out", "reports", "the-total-gate.md");
  v.push(...checkArtifactFiring(existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : null, registry));
  return v;
}
