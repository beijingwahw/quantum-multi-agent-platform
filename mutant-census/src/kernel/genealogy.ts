/**
 * THE GENEALOGY BOARD (G-board) — v0.5.0, the mutation census's answer to
 * the second arrival of the 36th visit's token ("对所有错误进行世界性的优化创新"):
 * the E-board made every error answer for its enforcement; the A-board made
 * every guard prove it can fire; the G-board makes the ledger LEARN —
 *   (G1) every error joins a FAMILY (the named recurrence families plus the
 *        category defaults), so a repeat offender is visible AS a repeat;
 *   (G2) every family with >= 2 sightings carries a RESOLUTION row — what
 *        holds it at its LATEST sighting — and the row's tier must equal
 *        that sighting's enrollment tier: a stale resolution is a
 *        conviction (the A1 symmetry, applied to families);
 *   (G3) every error credits its CATCHER (gate / author / numbers /
 *        visitor), and the catch census prints the era trend — the
 *        optimization metric the token demands: the gate fraction must be
 *        able to rise, the visitor fraction must be able to fall to zero
 *        (b45#9 was caught by the visitor; B7 exists so that never recurs);
 *   (G4) the count-drift family — the visitor-caught class — is held by
 *        burial-record's B7 gate: GATE-ENFORCED on burial-record's own test
 *        gate, the anchor registered on the A-board, and the firing demo
 *        (A-fire B7) injects a wrong-count context into the REAL checkBurial
 *        and is convicted by name.
 *
 * The rules are regex over the LIVE wrong-text (first match wins) — data,
 * reviewable, and falsifiable by the smuggling trials.
 */
import type { LiveBurialError, LiveRegistry } from "./bridge.js";
import { loadLiveRegistry } from "./bridge.js";
import { ENROLLMENT, type EnrollmentRow } from "./enrollment.js";
import { ANCHOR_REGISTRY } from "./anchors.js";

export interface FamilyRule {
  readonly family: string;
  readonly pattern: RegExp;
}

/** The named recurrence families, first-match-wins over the live wrong-text. */
export const FAMILY_RULES: readonly FamilyRule[] = [
  { family: "shell-template-heredoc", pattern: /heredoc|template literal|python -c/i },
  {
    family: "count-drift",
    pattern:
      /the count prose|witness count|witness-count|dual-list drift|while the audit witness|row count|counting lag|stale EPOCH_REPOS|context states/i,
  },
  {
    family: "edit-anchor",
    pattern: /Edit (anchor|tool)|anchor (miss|was anchored)|memory as|anchored from memory|quoted from memory|the MISS printed/i,
  },
  { family: "runner-path", pattern: /PATH|command not found|tsx -e/i },
  { family: "non-null-assert", pattern: /! \+=|assertion is an expression/i },
  { family: "tautological-witness", pattern: /tautolog|恒真|formula times itself|formula-times-itself/i },
];

/** The closed family vocabulary: the named families plus the category defaults. */
export function familyVocabulary(categories: readonly string[]): readonly string[] {
  return [...FAMILY_RULES.map((r) => r.family), ...categories.map((c) => `cat:${c}`)];
}

export function familyOf(wrong: string, category: string): string {
  for (const rule of FAMILY_RULES) if (rule.pattern.test(wrong)) return rule.family;
  return `cat:${category}`;
}

// ---------------------------------------------------------------------------
// The catch ledger — who caught it. Closed vocabulary, rule-derived.
// ---------------------------------------------------------------------------

export type CatchAgent = "gate" | "author" | "numbers" | "visitor";

export function catchAgentOf(wrong: string, category: string): CatchAgent {
  if (/the visitor/i.test(wrong)) return "visitor";
  if (category === "machine-overruled" || /the numbers (said|overruled)|overruled it/i.test(wrong)) return "numbers";
  if (/tsc|TS\d{4}|typecheck|lint|the gate|E1 naming|total gate|convicted|command not found|AssertionError/i.test(wrong)) {
    return "gate";
  }
  return "author";
}

// ---------------------------------------------------------------------------
// The resolution ledger — curated, one row per recurring family, the tier
// copied from the family's LATEST sighting's enrollment (G2 convicts drift).
// ---------------------------------------------------------------------------

export interface FamilyResolution {
  readonly family: string;
  readonly holds: "MUTANT-KILLED" | "GATE-ENFORCED" | "BOOKED-UNENFORCEABLE";
  readonly note: string;
}

export const FAMILY_RESOLUTIONS: readonly FamilyResolution[] = [
  { family: "cat:wrong-object", holds: "GATE-ENFORCED", note: "the physics-object class — the tier follows the LATEST sighting: b88#9's malformed-appeal crash (depreciation-ledger's audit CRASHING on a malformed appeal package.json where the ledger's law demands a BOOKED violation — the error face answered a stack trace, held at the L5 error-face trial) is gate-held; the previous was b87#12's latent letter-audit simulate (a short entry table read undefined as a digit into NaN arithmetic and answered a fake {halted:false}, while an out-of-range write escaped {0,1} and silently corroded the ones count — held at the EA:MACHINE trials) is gate-held, as is the same batch's b87#4 (vacuum-compiler's embedTwoAdjacent off-register placement returning the SILENT IDENTITY — the gate vanished with the dimension still right, held at gate/placement-out-of-range); the previous was b85#30's latent ft-qaoa bruteForce (an EMPTY energy table answered with a fabricated optimum — a confident best-value where no row exists, the qram GROVER_EMPTY_SCORES twin, held at the ENERGY_TABLE_EMPTY trial) gate-held at the trial, as are the same wave's siblings (b85#15's short-pattern undefined read silently routing through u0 at PATTERN_ARITY — an out-of-domain read forging a branch price; and b85#9's NaN prose printer, same species, files under the runner-path family by the machine's first-match-wins on 'a latent corrosion path' in its text, the b73#8 precedent, gate-held at its EC_NON_FINITE needle all the same); the previous before that was b84#17's mental-arithmetic marginal (|Phi+>'s partialTrace predicted as |+><+| where the maximally entangled state's marginal is the MAXIMALLY MIXED I/2 — machine-overruled in the test draft before any wrong assertion shipped, both marginals pinned exact beside the joint's surviving off-diagonal) is gate-held at the exact-value anchor, as are the same wave's b84#11 (survivor's message-substring rejection chain, held at the code-discrimination starvation trial) and b84#14 (retro-cache's NaN printer at K.G); the previous before that was b83#16's latent qram OBM forged rank (held at the OBM_INSTANCE_SHAPE/OBM_RANK_SHAPE trials, with its wave's RNG_EMPTY_PICK and GROVER_EMPTY_SCORES siblings); the earlier previous was b82#18's latent postselect repetitionsFor domain (delta outside (0,1] silently shipping a negative k, -33 from Math.ceil over a negative log — convicted at the ERR.08 needle) is gate-held at the errors-suite needle, as are the same wave's b82#17 (the randomSat while-loop that could never terminate below three variables, held at ERR.06) and b82#10's brand discriminant (the first version's distinguishing attribute collapsed the Z&X intersection to never where the code needed the shared structure — typecheck caught it); the previous was b79#9's Schmidt-memory rank assumption (a fixed-table memory dimension where the law's trajectories carry the state's own eigen-rank) is gate-held where the rank is computed-where-asserted; the previous was b78#11's S2 conditioning-chain test first draft compared the wrong weight target and checked the leaf identity with a REPEATED object (the assertion verifying itself against itself) is gate-held at the weights-MULTIPLY needle (the chain's own weight against the second part's standalone weight, the composed weight against the exact product, the conditionals through the independent concat path); the same batch's b78#8 — the latent v0.1.0 depolarizeQubit with its same-qubit/cross-qubit branches interchanged and the mixing weights off — is held at the independent naive Pauli conjugation anchor that convicted it; b77#14's noise-census panel (e) applying the channel to the member instead of the verifier's marginal register (the memberwise (1 + gamma*m_z)/2 formula asserted against E_gamma(I/2)), b77#10 (the orthogonality check reading only the real part — 68 pseudo-Cliffords against the true 24), b77#4 (the hardcoded equality-case flag wrong for specific marked sets — computed per funded set now), b77#3 (the composition loop reading the already-killed population) and b77#0 (the replacer closed form's member entropies labeled to the wrong members — the sim cross-check convicted it) were the previous, as were b76#22's inverted inflection map, b76#2's degenerate on-grid point and b76#5's averageRhoDefect comparing against I instead of I/d, b75#12's projection-vs-discriminator conflation (the exact game matrix asserted cell by cell, all 144 entries 0) and b74#18/b74#16's referee deaths; the booked members stand in their own rows (b73#3's mismatched-scale frame, b72#0's false invariant, b57's domain/superset slips, b56's check-object slips, b66#8's readonly-Map mutation rides its own lint-held row)" },
  { family: "cat:process", holds: "BOOKED-UNENFORCEABLE", note: "the author-discipline class — the tier follows the LATEST sighting: b88#3's self-caught test cast (the depreciation-ledger delivery's own review deleting the extraneous cast its wave's lint discipline forbids, before any gate ran) is booked on the pre-machine face, as are the same batch's other act faces (b88#0's NINTH refused Edit-before-Read on the b48#2/b53#0/b67#4/b82#6/b83#20/b86#6 line — the refusal itself the guard — and b88#2's refused redundant Read, the discipline's inverse face); the previous was b87#33's outside-tree log placement (the wiring agent's own — the census lint re-run's log redirected to the system temp, outside the workspace tree where no scheduled gate scans; deleted one command later, which does not unmake the placement, the b80#3 face recurring) is booked on the outside-tree face, as is the same batch's b87#32 (the remembered-subtotal repair count — the total assembled as 252 against the board's 255, the census suite's own assertion convicting the drift on the spot; a hard figure is recomputed from the board it names, never from remembered subtotals — the b86#13 count face twice consecutive now); the same batch's gate-held members ride their own rows (b87#30's doc-code mismatch — wukong's applyRX comment claiming textbook RX while the implementation computes the conjugate e^{+i(θ/2)X}, hand-proven at θ=π with amp(|1>) = +i; numerically self-consistent, no sign flipped under the freeze discipline, the convention DISCLOSED at the hand anchor, theory.md's mixer-sign section and the X4 export contract; and b87#23 — switch-sched's chanlib comment claiming the isometry certificate was checked while assertStinespring stood unreached, the call now executing and the needle pinning it at the call site, the b76#17 fake-claims face), as do the wave's other booked members (b87#0's half-written placeholder guard caught by the next edit, b87#1's draft import, b87#2's reversed-edit orphan, b87#9's half-matched lock Edit, b87#11's draft failure-face TypeError, b87#16's read-only git status, b87#17's deleted self-certifying assertion, b87#20's two ineffective edits, b87#26's dropped imports — all pre-machine or act faces); the previous was b86#13's remembered hard count (the repair-state figure written 174 against the 175 the board carries, the census suite's own assertion convicting the drift on the spot; a hard figure is recomputed from the board it names, never remembered) booked on the count face, as were the same batch's booked faces (b86#12's stale-registration layout — two lockfile needles registered with no row sitting on them, A1 convicting both at the suite's first run, the b85#35 derivation class one batch later; b86#9's half-done deletion leaving private-plus-void suppression standing in for the removal, re-cut pure on self-review; b86#8's INVENTED outerAA replacement where the absorption law demands a pure delete — the law's first violation sighting, in the very wave executing it, subtraction dressed as addition and caught on the immediate reread; b86#5's false-positive dead-export survey filter defaming live exports; b86#6's refused cat-view edit — the b48#2/b53#0/b67#4/b83#20 line's eighth refusal, the refusal itself the guard; b86#2's placeholder residue rewritten before any gate ran); the previous before that was b85#35's half-derived G-board pass (the wiring agent's own — the resolution rows drafted from intended category filings before the machine's family classifier saw the new texts; four incidental phrase collisions filed rows under named families, and the census suite convicted the drifted runner-family resolution at its first run, the b84#21 class recurring one batch later — since batch 88 the derivation face is GATE-HELD, npm run derive deriving the row for the author before the pen) booked on the derivation face, as were the same wave's booked faces (b85#19's misplaced noisyRatio doc comment, b85#1's vacuous zero-matrix positive control, b85#5's extra closing bracket, b85#6's no-op assertion draft, b85#7's two-cut weyl residue, b85#8's bracket-blind survey pattern, b85#10's dead-alias import, b85#18's wrong-module import pass); the previous was b84#21's half-derived G2 row (the wiring agent's own — the family-tier computed from the intended category while the machine's familyOf rule filed the probe row under runner-path, the census suite convicting the drifted resolution at its first run) on the sequencing face, with that wave's booked faces (b84#20's forged-value enrollment row caught on the edit's own reread, b84#2's three-edit deletion residue, b84#3's inverted-intent write-back, b84#5's parallel-load duration README, b84#8's TOL alias, b84#16's meaningless-ternary draft, b84#18's misplaced import); the wave's needle-held members ride their own rows; the previous before that was b83#19's latent README headline drift (81 batches / 543 errors standing where the registry carried 82/565 — the wave-1 wiring's registry edit never re-synced the README face, caught reading the repo before touching it) with its batch's booked pre-machine faces (the mangled and swallowed import blocks, the single-sourcing alias residue, the used-before-import, the rejects()/floating-Promise draft fixes — b83#2's T8 null-floor anchor and b83#7's theory.md needle rode their own rows); the earlier previous was b82#21's companion-edit sequencing slip (the wiring agent's first census suite run red on W-D's predictable phase-law/rng.ts drift and S1/S2's stale artifact — the K-board registration and the re-render belonged in the same breath as the board edits) booked on the sequencing face, as are the same wave's booked act faces (b82#5's dead scaffolding rewritten whole, b82#6's refused Edit-before-Read on the patch-act face with b82#20's wiring-agent twin, b82#9's transient duplicate definition, b82#11's stray blank line, b82#15's comment-face residue) — the wave's needle-held members ride their own rows (b82#2's unwitnessed PL20 claim wired to the staircase witness, b82#14's recalled lcgMarked vector pinned as exact dyadic rationals); the previous was b81#3's lockfile-intent slip (a fresh range resolution where the replicated PR's lockfile pins the exact version — npm picked 26.5.0 against the PR's 26.4.1, reinstalled at the pin before anything shipped) booked on the author-side face no gate reads; the previous was b80#10's latent R-board verdict counts ('Nine/fifteen' against the live 11 UPGRADED and 33 SHARPENED — S2's first live run convicted all three drifted phrases, with b80#8's K-board 'Ten full members' against the live 7 and b80#9's 'four of five' share clause against the live 3 and 4 beside it) gate-held at the S2 tamper trial, as is the same batch's b80#4 (the S1/S2 trials' own first drafts pointing at the wrong conviction faces — the corrected ammunition reads the checker's output, gate-held at the permuted-board trial); the batch's booked members ride their own rows (b80#1's pre-test optimality assertion — the fake-number family's third attempt on the upstream-of-every-render face, b80#2's scratch-quoted X8 doc on the doc face, b80#3's outside-tree temp file on the placement face — now with its own wave-6 recurrence at b87#33); the earlier latest was b79#6's latent README '19/19' test count (47 at v0.2.0's close, 78 now — re-derived from the run in the same edit) booked on the doc face no law reads; the previous was b78#15's inherited orphan draft (an inverted field name, a wrong docstring, a mischaracterized citation — all closed at the successor's gates with the erratum pinned in citations.md) booked on the leaving-behind face, the b74#6 interruption class's second wave (b78#12's uncompilable stub convicted at the successor's typecheck is the same class one repo earlier in the batch); the wave's other booked acts — b78#9's read-only `git diff --stat` (third act on the b74#3/b77#8 line), b78#13's oldest-first doc comment (REPAID at its NEWEST-FIRST needle in batch 85, the row upgraded under R1), b78#1's 360k-shot MC hang (the b73#2 class) — ride their own rows; the machine-held members ride their own rows (b76#13's placeholder gf2Rank held at the rank-vs-brute-force anchor, b76#17's fake test claims held by the rewritten suite, b75#4's tampered 0.71 assertion convicted by the exact eta* = 1/√2 noise-threshold test, b74#7's fragile assertions convicted by the suite's own re-run, b73#0, b73#6, b73#9, b54#0, b54#2, b60#7, b61#1, b63#2, b67#1, b67#5, b67#6 on E7, b68#0, b68#1, b69#2, b70#1), as do the booked members (b76#23's display truncations on the b29#4/b30#1 print-honesty line, b76#3's dead scaffolding, b76#7's attempted prose-before-run, b76#8's docs-section destruction, b73#10's visit/batch resync, b73#1 scratch mechanics, b73#2 the O(K^2) hang, b71#0's detached duplicate gate launch, b70#3's memory prefix duplication, b70#2's never-fail assertion, b69#0's string residue, b69#1's memory anchor, b68#2's heading swallow, b65#1's cross-session stale read-state, b75#6's /tmp log placement on the outside-tree face)" },
  { family: "cat:machine-overruled", holds: "GATE-ENFORCED", note: "the overruled-expectation class — the tier follows the LATEST sighting: b84#1's -0-vs-0 conviction (Object.is distinguishing signed zero where the physics is one value — === with the comment saying why; the anchor's discriminant fixed, not the machine) is gate-held at the repo's suite; the previous was b82#8's nonstoq magnetization expectation, wrong TWICE in a row (first the bit index, then the sign of the band — the suite convicted both drafts consecutively; the anchor recomputed, not the machine doubted), with its wave's sibling expectation slips (b82#0's phase-law grid-midpoint anchor and b82#4's ent-sched ghost-endpoint code); the earlier previous was b80#0's wukong hand-computed test expectation (the kernel was right, the anchor wrong — fix the anchor, not the machine, the b13#7 face) is gate-held at the hand-checkable-at-n=2 anchor; the previous was b79#17 — the SEVERE conviction, zetaEM's spurious (1/2)N^-s tail term behind v0.19.0's 'Phi1 = -4.547e-4 SMALL BUT NONZERO' — is gate-held at the TC47 zero-inside-bracket needle (the sign fix certified by N=60/120/240 agreement at ~1e-10, Phi1 = +7.14e-8 inside |Phi1| <= 5.58e-7, kappa re-based to -0.306852819, the transfer confirmed to 5.8e-6 on the new incremental-binomial road); the same batch's b79#1 (across-kink direction) and b79#2 (the flux jump asserted flat) are gate-held at their exact-rational needles, as is b79#8's backwards triangle ladder; the previous was b78#3's decoherence-invisibility claim was asserted BACKWARDS and overruled twice in one row — phase damping on the Z-tier trap is PERFECTLY detected (acceptance exactly 1-gamma) and the guess-decay is the V-form |1-2gamma|, not a line — pinned at the census row asserting both machine-found laws at every grid point with the gamma=1 decoupling anchor; b77#9's sigma-tensor-sigma Pauli twirl was INERT on Bell-diagonal states (a permutation of the Bell basis, not an average — the depolarizing step silently did nothing) and the machine overruled it: the honest-negatives test asserts the raw nested round DEGRADES the coin without the twirl (0.884146 -> 0.812024), the load-bearing face the 24-element Clifford twirl carries; b75#9's matched blind-pair generator was rejected at T = 0.918 by the contract now asserted in-tree (max T < 1e-7 over all 24 plain orders), as was b75#8's assumed swap Pauli quadruple (the census holds ZERO commuting at d=4, 0/30/1335); every conviction pinned by a test that asserts the numbers' verdict (e.g. TC27's passive-beats-decoder)" },
  { family: "cat:dimension-slot", holds: "GATE-ENFORCED", note: "the dimension-accounting class — the tier follows the LATEST sighting: b87#28's latent wukong shell range (exactShellMass/depolShellMass reading shell indices past the mass vector into undefined→silent NaN, held at the XVAL_SHELL_RANGE trials) is gate-held, as are the same batch's siblings (b87#6's non-divisor clockStates reading past the state buffers at readout/clock-not-divisor, b87#8's wrong-dimension step matrix poisoning the propagation grid with NaN at hamiltonian/step-dim-mismatch — the causal-ineq NaN-grid sibling — and b87#22's firstPartyProcess indexing past a non-2×2 input into a NaN process at the input-state guard); the previous was b85#29's latent ft-qaoa decoder scheduler (degenerate scenario shapes flowing unguarded into division and indexing that answered garbage, held at the degenerate-scenario trial) is gate-held at the trial, as are the same wave's siblings (b85#22's 1<<n wraparound forging a one-entry statevector at QUBIT_COUNT_INVALID, b85#23's mis-sized energy tables at ENERGY_LENGTH_MISMATCH, b85#24's wrapped bit index at QUBIT_INDEX_INVALID, b85#17's short projector at PROJECTOR_SHAPE — and b85#3's first-cells market reader, same wave and same species, files under the runner-path family by the machine's first-match-wins on 'one-coin paths' in its text, the b73#8 precedent, gate-held at its QUBIT-FRAUD needle all the same) and the family's IN-COURT recurrence (b85#11 — choice-lang's own BRANCH_SHAPE guard first drafted asserting the WRONG dimension slot, branch = out.rows where the data dimension is out.rows / 2^controls, the b25#3 kron-shape line recurring inside the very guard written against it; the gate convicted it red the same session and the corrected guard is gate-held at its own trial); the previous was b84#15's latent retro-cache postprocessOutcome (the one public entry without a guard — a short row's [x]![y]! lanes mixing NaN into the outcome silently, held at K.H's smuggling trials) is gate-held at the trial, as is the same wave's b84#9 (survivor's silently dropped out-of-range markedB at SC/BAD-MARKED — the intersection filter ate the illegal address and computed on the remainder); the previous before that was b83#15's latent qram linalg NaN solutions (luSolve/hittingTime/jacobiEigenvalues answering dimension mismatch with silent NaN, held at LINALG_SHAPE, with its wave's NaN-grid, WALK_MU_SHAPE and WALK_NEIGHBOR_RANGE siblings); the earlier previous was b79#15's W-Z witness name colliding with an old trial's numbering (the suite caught the duplicate on the first run) is gate-held at the closed witness list's unknown-witness trial — identifier namespaces grepped before claimed; the previous was b78#6's constants-audit trials keyed by id in a map (two rows sharing an id silently overwrote each other and the duplicate vanished) is gate-held at the map-free duplicate-id rejection — BOTH rejections stay visible and the smuggling trial asserts the pair; b77#13's Schmidt companion indexed wrong (the 01/10 companion instead of the swap-flip — per-coin marginals at TV 0.5 from I/2 where the family demands exactly I/2 at every t) is gate-held at the per-coin-flat-at-every-Schmidt-coefficient assertion; b75#11's 8-dim split-layout NaN (control 4 ⊗ target 2, re at i / im at 8+i) is gate-held at Algorithm 1's exact-readout assertion (probability exactly 1 on every promising set), and b75#3's transcribed slot order dies at the elementwise W* ≡ OCB12 eq. (7) anchor; the class-level shape-blind face stays MUTANT-KILLED in its own lineage (the mAdd MU3 mutants)" },
  { family: "cat:statistics", holds: "BOOKED-UNENFORCEABLE", note: "the statistics class — the tier follows the LATEST sighting: b89#5's in-delivery count staling (the base platform's own first wave delivery — the doc agent's rebuilt file tree carrying per-file line counts that parallel siblings' in-flight edits staled within minutes, the count-drift family's own face inside a delivery act; withdrawn same-session to a structure-only tree with the closeout re-syncing the suite counts from the final full-suite run — counts are taken last, from the machine, once, after all parallel writers have landed) is booked on the act face — no scheduled gate audits a doc draft's freshness against its own writers; the previous was b87#25's over-strict quboValue guard (convicting the planted-optimum fixture red by demanding a strictness the trailing-blank-row ?? 0 convention never promised — the suite red-carded the draft and the domain was read from the format it serves, linear strict and coupling optional) is gate-held at the suite, as are the same batch's siblings (b87#21 — the wave's one TRUE NUMERICAL case: switch-sched's orthoPair double-draw, randomStateVec called twice with b.re and b.im from adjacent independent draws, every trial burning an extra rng draw and the seed stream WELDED to the bug — Table 3's retired −0.160158/36/40 were numbers welded to the defect, not properties of the fixed pipeline; the single draw restored, the statistics re-drawn from the same seed (−0.149905, 34/40, 0/40) and pinned by the seed-pinned regression anchor on every repro run, gate-held there; b87#19's bit-equality demand between x/nrm and x*(1/nrm), exposed at the run and rewritten to the arithmetic's tolerance structure; b87#5's geometricAttempts domain holes — the p=0 caller-side hang and the p>1 sub-unit mean — refused by name at ledger/probability-out-of-domain; b87#7's non-probability eps producing a meaningless census the auditor then faithfully re-verified, refused at BOTH doors at amplify/epsilon-out-of-domain); the previous was b86#1's two first-draft assertion errors (cramerRate's mean demanded EXACTLY zero where the value comes from a numerical maximizer — the honest claim at least zero and under 1e-12 — and the depolarize identity checked with Object.is where +0/-0 non-diagonal inertia legitimately diverges, recorded with ===) convicted red at qverify's suite first run is gate-held at the suite's own honest-bound anchors — an assertion is written from the arithmetic's own tolerance structure, never from the hope that the digits land exact; the previous before that was b85#28's latent ft-qaoa code catalog (blocksFor(0 logical qubits) answering a confident ZERO for every resource and distance 0 entering the tables, held at the CODE_DISTANCE_INVALID/LOGICAL_QUBITS_INVALID trials with d=2 and one logical qubit as the legal boundaries) is gate-held at the trials, as are the same wave's siblings (b85#25's negative-probability readout domain at READOUT_Q_INVALID, b85#26's epsilon-at-zero descending T-count at SYNTH_EPSILON_INVALID, b85#27's zero-depth infinite factory at QAOA_DEPTH_INVALID, b85#16's probability-zero conditioning that answered a silent zero matrix at ZERO_PROBABILITY); the previous was b84#10's latent survivor mcWaiting(p,0) divide-by-zero NaN (a wrong answer shipped as a number where runs=0 has no mean — the SC/MC-BAD-INPUTS guard names it and the trial fires on every suite run) is gate-held at the trial; the previous before that was b82#19's NaN binomTailAtMost (the latent v0.2.0 boundary where 0*log(0) poisoned the sum and the true tail was exactly 1 — the BAD-PROBABILITY guard names it at ERR.09 with the hand value 7/27 and the p=1 endpoint exact); the earlier previous was b79#10's 'half' rounding of the error-schedule saving (the data prices it at 49.5%, 0.1553 vs 0.3077) is gate-held at the exact-arithmetic bound, as is the same batch's b79#4 flat-dishonest grid witness (the wall-to-wall zeros COUNTED); the previous was b78#7's window-policy assertion wrong at W=4 (the first feasible realtime window is W=8 at 0.856 — W=4 still exceeds the ceiling at 1.03) is gate-held at both-margin assertion on both scenarios, as is the same batch's b78#5 hand-arithmetic slip (0.1-squared where the true expectation was 0.1*(1/6)^3 — asserted exactly to 1e-18); b77#12's twoCoinStrategies C1/C3 first-draft garbage expressions are gate-held at the per-coin marginal/reveal assertions of the two-coin census, as are the same batch's b77#1 atanh closure dropping its factor 2 (LN2_A enclosing ln2/2, hidden from the chi certificates by exact cancellation in fTerm's denominator — the ln-enclosure bracket test holds it) and b77#2's zero-slack bracket test that convicted the float reference's own ulp error (the reference-slack needle); b76#21's wide-rational NaN (fToNumber's naive Number(n)/Number(d) on limbs past 2^53, caught on the rendered report's face) is gate-held at the decimal-long-division fallback needle, as are b76#20's 2x-too-small LN2 tail enclosure (the cross-route overlap check caught it on the spot; the tight-enclosure test holds it) and b76#14/15/16's retro-cache algebra/sign/mixing-rate defects (crossing-exact, the honest-ledger zero-tap anchor, and the strictly-positive-tax mutation census); b76#1's BigInt→Number overflow NaN at n≥256 is held at the scaled-division needle; b75#15's census completion that broke the tie equation's denominator, b75#14's halved U_1 initialization and b75#2's 4x coefficient were the previous; b74#15's fabricated census size (20480 against the true 8192) and b74#14's global-½ double-count died at their anchors the same way (the fake-number family, closed at both faces — b76#7's attempted prose-before-run sighting stays booked in its own row); the arrangement members stand booked in their own rows (b73#4's beyond-noise-floor fit, b55#6's cancellation face), as do the census-level kills in earlier sightings' own rows (the MU8/MU9 lineage)" },
  { family: "cat:toolchain", holds: "GATE-ENFORCED", note: "the build/toolchain class — the tier follows the LATEST sighting: b89#7's convergence-orphaned dead assignment (the base platform's own first wave delivery — collapseSubspace's let-chosen initialization orphaned by the G3 greedy-fill twin merge, every branch assigning unconditionally after the convergence, named by the platform's lint gate on the run's first breath and fixed with a carrying comment) is gate-held at the platform's own lint gate, as does the same batch's b89#2 chain-shape face ride booked in its own row; the previous was b88#11's attempted display pipe (the terminal agent's own — the family's twenty-sixth attempt, one batch after the orchestrator's three PIPESTATUS variants b88#6/b88#7/b88#8 (attempts twenty-three through twenty-five, every one self-reported at the wave's end and re-issued pipeless): the derivation tests' first authentication piped through tail, re-issued pipeless in the same breath) is booked on the shell-act face, as do the same batch's gate-held members ride their own rows (b88#1's TS7053 at bqp-map's typecheck, b88#4's extraneous cast at route-price's lint, b88#5's five-error first lint run at burial-record's own gate); the previous was b87#31's attempted gate pipe (the wiring agent's own FIRST command of the visit — the census authentication issued through a tail pipe under a PIPESTATUS echo, the exit-code-masking family's twenty-second attempt; the shape is the banned one regardless of what the echo displayed, the no-pipe re-issue with the direct code the only verdict) is booked on the shell-act face, as is the same batch's b87#15 (the sanctioned-channel family's twenty-fourth sighting and its FIRST sed face — the exp1 code file edited through sed -i, grep-verified clean; clean does not absolve, and 'sed -i' matches no named family pattern so the machine files it HERE, the b85#20 precedent); the wave's gate-held members ride their own rows (b87#3's TS2304 amputation conviction at vacuum-compiler's typecheck, b87#27's TS2305 wrong-home import at wukong-crossval's typecheck); the previous was b86#10's TS2741 conviction (the dtc-clock rng.ts Object.assign refactor missing pick — the incomplete interface named by the typecheck gate at the draft's first breath, pick landing with the refactor in the same fix) flipping the family's row back to GATE-ENFORCED, with the same batch's booked act faces riding their own rows (b86#0 and b86#3 — the sanctioned-channel family's twenty-second and twenty-third node -e sightings, the second against the shared kernel's own lineage root — and b86#7's backslash grep -v query face, the b82#16 class); the previous before that was b85#31's attempted gate pipe (the wiring agent's own — the exit-code-masking family's twenty-first attempt and the FOURTH of a single wave: b85#0, b85#13 and b85#21 the delivery agents' three before it, every one caught with no verdict taken from the pipe) booked on the shell-act face, as is the same wave's b85#20 node -e version edit (its b85#12 twin files under edit-anchor — the machine's first-match-wins on 'Write/Edit tools' in its text — and b85#4's python heredoc rides the heredoc family's own row); that wave's gate-held members rode their own rows (b85#2's missing import at binding-price's typecheck, b85#14's two extraneous as-casts at choice-lang's lint); the previous was b84#13's lint conviction (the retro-cache delivery's no-unnecessary-condition reading shape, refactored to .at() reads the type system can see through — the tier flip itself was the G2 gate's own first-run conviction of that batch's wiring, the wiring agent having reasoned from the intended category while the machine's familyOf rule filed b84#19 under runner-path first-match-wins) with its sibling b84#12 (the TS2345 map-literal draft at the same repo's typecheck) and the wave's booked shell-act faces (the exit-code-masking attempts sixteen and seventeen, b84#4 and b84#7 one delivery apart — and b84#19's banned-shape probe under the runner-path family's own row); the earlier previous was b83#17's attempted gate pipe (the family's fifteenth, ONE ROW after the fourteenth, attempted by the wiring agent itself), with the same wave's fourteenth (b83#9), the deletion-channel founding note (b83#5) and the silent tsx -e double failure (b83#8, the runner-path row); the earlier previous was b82#16's regex-vs-literal grep (a pipe character in the pattern read as alternation, a false zero hit taken for a missing needle until grep -F re-ran it) booked on the query face, as are the same wave's booked shell-act faces (b82#3's piped gate — the exit-code-masking family's thirteenth sighting, an attempted one — and b82#7's node -e channel act, the sanctioned-channel family's eighteenth); the wave's gate-held members ride their own rows (b82#1's Buffer-union draft and b82#12/b82#13's TS2451/TS2552 residue at the typecheck gates); the previous was b81#4's heredoc act (the sanctioned-channel family's next sighting, a package.json edit — verified clean after, clean does not absolve) booked, as are the same batch's b81#1/b81#2 attempted gate pipes (the exit-code-masking family's eleventh and twelfth sightings, ONE VISIT after the tenth — a displayed 0 under a failed format:check, a displayed 0 under a CRASHED lint, both re-run for the direct code); b81#0's prettier-noncompliant edit rides its own gate-held row (the platform's format:check that flagged it on the spot); the previous was b80#6's attempted gate pipe (killed on sight, re-run for the direct exit code — the exit-code-masking family's tenth sighting) and the same batch's b80#5 repro-audit summary greps missing node:test's ℹ line prefix (the totals re-derived from the raw output) booked; the earlier latest was b79#14's attempted gate pipe (killed on sight, re-run for the direct exit code — the exit-code-masking family's ninth sighting) booked on the shell-act face, as are the same batch's b79#0 heredoc act (the channel's sixteenth canonical sighting, verified clean after — clean does not unmake the breach) and b79#13's failed bash template-string escape (no landing, nothing to gate); the wave's gate-held members ride their own rows (b79#12's render.ts backtick at the typecheck gate that convicted it, b79#5's four void-return lint convictions at the lint script); the previous gate-held latest was b78#16's five lint convictions in vacuum-compiler at the lint script every run closed in the same edit, and the same batch's b78#0 — the embedded '*/' closing a block comment early, the b12#0 twin — died at the typecheck gate the moment it landed; the earlier gate-held members ride their own rows (b77#6's lint conviction and b77#7's latent bare-pipe render defect, needle-held at the escaped ket; b76#25's latent switch-sched repro no-op at its run-all needle — the repro-no-op family went systemic across postselect/qram/retro/switch, all needle-held, with the batch-7 full-workspace audit still priced; b76#4/b76#19/b76#10/b75#18/b75#16/b75#17/b75#1/b75#5's lint/typecheck/repro rows); the booked shell-discipline members stand in their own rows (b78#10's attempted display pipe — the exit-code-masking family's eighth sighting; b78#14's heredoc act, the channel's fifteenth; b77#11's transient W-F miss on the transient face; b74#0/b74#2's exit-code masking, b74#9 and b76#0's pre-machine require(), b74#11's apostrophe, b75#13/b76#9/b76#24's heredoc acts), and the runner-path residue lives in the runner-path family's own row" },
  { family: "cat:conjugation", holds: "GATE-ENFORCED", note: "the convention class — the tier follows the LATEST sighting: b79#3's chargeOneSided sign clamp (the win-side limit flipped against the convention the losing side carries) is gate-held at the exact-rational one-sided limits with the SIGNED win-side face pinned; the previous was b78#2's phase-damping Kraus operators written in the reversed form in the first draft is gate-held at the Z-tier grid (phaseDampingKraus at every gamma in [0,1], trap acceptance exactly 1-gamma against the closed form — a reversed Kraus family dies at the first grid point); b77#15's latent blochOf y-flip (v0.1.0's form returned -y, masked a whole version because every caller dotted TWO blochOf outputs and the double flip cancelled; the noise census's raw-tuple-plus-one-blochOf asymmetry exposed it at deviation 6.6e-1) is gate-held at the one-at-a-time roundtrip regression test — a double flip can hide in pairs, a roundtrip cannot; b77#5's overlap closed-form sign slip (the conjugate's sign flipped in the test's two-path derivation) is gate-held at the componentwise overlap assertion the same suite runs; b76#6's traceProd sign bug (the im-im product entered with a minus where Tr[AB] for Hermitian a, b sums both products) is gate-held at the formula pinned in the kernel (Tr[AB] = Σ_ij a_ij conj(b_ij), real by construction); b75#10's Pauli-ray phase defect (rotationsOf landing off the generator's ray) is gate-held at the matched-pair contract's phase assertion (product phase-only off the generator, diagonal exactly 0); b74#13's latent CJ-convention defect (identity not mapping to SWAP under complex Kraus, alive since v0.1.0) and b66#4's sequential-substitution slip were the previous; the physics face (transpose/dagger) stays MUTANT-KILLED in its own lineage (MU1)" },
  { family: "cat:anchor-blindspot", holds: "GATE-ENFORCED", note: "the anchor-blindspot class — the tier follows the LATEST sighting: b87#18's independent-diff draft (the switch-sched delivery's bit-isomorphism anchor dropping the imaginary component — a verification blind to half the signal, the run exposing it; the diff now asserts re AND im so the anchor lives in the space that can actually fail) is gate-held at the repo's suite; the previous was b84#0's transposed dagger2 subscript (locking.ts wrote -u.im[2] against the Y-basis conjugation's -u.im[1], breaking Y-basis rotations) — the family's HEAVIEST evidence: ALL FIFTY-SIX tests stayed green (the argmax readouts masked the leak) and only the repro byte-comparison killed it (exp7's honest gamma=0 line moving 0.0000 -> 0.0473) — gate-held at the Y-basis U-dagger-U both-sides anchor (H alone is real symmetric and immune; the anchor lives in the space that can actually fail — the class's rows stood at 17 in-registry, grepped before enrolling); the previous before that was b79#7's frontier needle quoting the CHSH constant at 15 decimals against retro-cache's printed 12, gate-held at A6 (letter-audit's own live-pointer law — every needle read from the sibling's report on every suite run, so a needle that misquotes its target dies the moment it lands); the intent-diffing residue stays booked in its own rows, and the named subfamily edit-anchor carries its own row (b53#5 itself files under runner-path: the machine's regex, not the author's reading of the lesson)" },
  { family: "cat:bogus-comparison", holds: "GATE-ENFORCED", note: "the rigged-benchmark class — the tier follows the LATEST sighting: b87#13's unfounded tower order (letter-audit's compareTowers ordering non-positive literal heights it had no basis to order — 2↑↑0 claimed greater than a literal via the monotone-bound branch; EA:TOWER-SHAPE refuses the height at construction and EA:TOWER-DOMAIN refuses the hand-built smuggle at the comparison itself, defense in depth) is gate-held at the construction guard; held by the Q4 illegal-verdict check; the formula-times-itself species emigrated to its own family at batch 79 (tautological-witness, the founding sighting carrying the SEVERE conviction)" },
  { family: "tautological-witness", holds: "GATE-ENFORCED", note: "公式自乘恒真验证 (the formula-times-itself family) — founded at b79#16, the SEVERE conviction: TC13(ii)/TC18's echo-decay law |cos2d|^k was verified TAUTOLOGICALLY (the v0.2.0 witness certified the formula against itself) and the law was FALSE — the true isolated-echo law is m(k) = (-1)^k cos(2k*delta) exactly (8.3e-15), the geometric envelope missing by 0.82-0.99 with first crossings 6/3/2 against the claimed 35/9/4, re-founded by TC46 as exact-in-expectation under per-period sign noise (exhaustive over all 2^k sequences, 3.6e-15); route-price v0.2.0 credited as the discovering sibling; machine-convicted by the tautology smuggling trial — a formula-times-itself witness certifies the WRONG constant |cos 3*delta|^k just as happily, named and rejected on every run; the species' ancestors (batch 14's brute-force control evaluated as the same formula again, batch 25's self-composed rotation checked against itself) lived in cat:bogus-comparison before the family existed" },
  { family: "cat:citation-drift", holds: "BOOKED-UNENFORCEABLE", note: "the citation class — the tier follows the LATEST sighting: b89#11's sibling-prose drift (bqp-map's atlas notes carrying the platform's retired numbers — '5/5 vs 0/5', the half-ledger artifact the platform's own v1.11 erratum corrected, and '292/292 tests' — riding unenforced atlas prose no scheduled gate parses against the sibling's live state; found by the needle sweep the same batch's pin repair owed, corrected at the citing tree in bqp-map v0.2.1 with the volatile counts handed back to the platform's own machine audit, never quoted) is booked on the prose face — the sweep discipline (any conviction that rewrites a shared file's content owes a workspace sweep for needles and quotes INTO that file) is author-side; the previous was b89#10's cross-repo pin break (the base platform's own wave — the doc reconciliation's badge conviction rewrote the README's test badge 292->520 and broke letter-audit's #03 frontier certificate needle pinned to the OLD badge text; the total gate's red cell named it, the citing tree repaired in-wave at tests-520 with the frontier checker green on the repair) is gate-held at the frontier needle — the b80#7 version-pin cross-repo family's FOURTH firing, and the first whose broken pin was a PROSE badge rather than a version digit: a needle is a data copy of someone else's prose; the previous before that was b87#29's latent wukong-crossval lockfile residual (package-lock.json carrying 0.1.0 at BOTH version slots against package.json's 0.2.0 — the lockfile face surviving a whole version) is gate-held at its own E3 needle (both slots pinned 0.3.0), with the same batch's b87#14 (letter-audit, same shape and same drift) and b87#24 (switch-sched, same shape) riding their own needles — the lockfile face struck THREE repos in one wave, the family gone fully systemic exactly as the repro-no-op family did before it, the full-workspace sweep still priced; the previous was b86#11's latent dtc-clock lockfile residual (package-lock.json carrying 0.11.0 at BOTH version slots against package.json's 0.20.0 — NINE version bumps of drift, the family's widest yet) is gate-held at its own E3 needle (both slots pinned 0.21.0) with the delivery's own permanent books-agree regression beside it (package.json and BOTH lock slots asserted equal on every suite run), and the same batch's b86#4 (stable-world's 0.1.0 against the 0.6.0 manifest — five minor versions) rides its own needle at 0.7.0 with T11 'the books agree' holding it — the lockfile face repaired across THREE repos in one wave, dsic-noether's 0.4.0 the known family's repayment with no new row (the b85#32-34 shape); and the family's cross-repo founding RECURRED AND CLOSED IN THE SAME BREATH: vacuum-compiler's live two-ground audit re-broken by this very wave's dtc-clock 0.20.0->0.21.0 upgrade, all six citing-tree needles (test/docs/README/experiments) repaired on the spot with the sibling repo's four gates green on the repair — the b80#7 founding now a closed loop inside a quality wave; the previous was b85#34's latent burial-record lockfile residual (the 0.4.0 that survived the morning's own 0.5.0 bump, the third lock-face conviction of the wiring visit — ft-qaoa's 0.1.0 having survived two whole versions as b85#32 and the census's own 0.9.0 nineteen bumps as b85#33, a full-workspace sweep priced with fifteen siblings standing) is gate-held at the census's own E3 needle (both slots pinned 0.5.0, checked live on every run — the version-pin family's own-repo lockfile face gone systemic, exactly the repro-no-op family's booking shape; the census's own needle follows every bump since — 0.30.0 at batch 87); the previous was b84#6's latent quantum-mech lockfile residual (package-lock.json carrying 0.1.0 at BOTH version slots a whole version after the 0.2.0 bump — the wave's gates verified package.json and never the lockfile face) gate-held at the census's own E3 needle (both slots pinned 0.3.0 — the b80#7 cross-repo founding's own-repo twin); the booked cross-reference face stands in its own row (b83#18's registry citation slip — no scheduled gate parses registry prose's citation keys against the rows they name, the grep-before-enrolling discipline the guard); the needle-held members stand in their own rows (b80#7's founding sighting of the version-pin cross-repo family — vacuum-compiler's live audit citation pinning dtc-clock@0.19.0, broken by the same wave's 0.20.0 upgrade and convicted red in the total gate, six citations fixed — needle-held at the two-ground audit's fixed version needles in the citing tree, the needle following each same-wave upgrade since); the previous was b79#11's BCP14 preprint number written from memory as arXiv:1310.6190 (the true number 1311.0275, caught at the source — the identifier family's EIGHTH sighting after b55#3/b56#9/b74#5/b75#7/b76#11/b76#12/b78#4, grepped before enrolling) is needle-held at the corrected citations.md entry with the wrong first guess confessed on disk; the previous was b78#4's arXiv:2405.00789 author attribution recalled wrong and caught by the source check (the identifier family's SEVENTH sighting after b55#3/b56#9/b74#5/b75#7/b76#11/b76#12, grepped before enrolling) is needle-held at the corrected citations.md entry with the wrong first guess confessed on disk; b76#18's two unverified DOIs (one wrong and corrected, one stood but carried no verification record) are gate-held at the citations needle — both entries now pin the double-source verification record on disk; the AUTHOR-TABLE face went consecutive the same batch: b76#11's arXiv:2311.12444 attribution ('Wolitzky et al.' for Rubinstein & Zhou, the identifier family's fifth sighting after b55#3/b56#9/b74#5/b75#7, grepped before enrolling) and b76#12's DLW04 three-for-six author table (the sixth) are each needle-held at the corrected citations.md entries — the identifier family's first three needle-held sightings were b75#7's VDL23 article number before them; the booked members stand in their own rows (b74#5's deleted 'decision transformer', b56#9's Davies year, b55#3's arXiv digits — the double-source ritual stays author discipline for claims no needle can pin), as do the earlier machine-held members" },
  { family: "shell-template-heredoc", holds: "BOOKED-UNENFORCEABLE", note: "the banned heredoc/template family, nineteen canonical sightings since b10 — the nineteenth (b85#4's bash-fed python heredoc batch edit in the ent-clearing delivery, exit 49, redone through the Edit tool immediately — and the first sighting whose own channel said no: exit 49 where the family's usual mode is silent truncation) was grepped against the family's in-registry wrong-text heredoc mentions (23, plain /heredoc/i on the wrong column) before enrolling, after the eighteenth (b82#7's node -e fs.writeFileSync test-file repair in the nonstoq-anneal delivery, verified clean on the spot — clean does not absolve, the b79#10 judgment; the same wave-4 visit booked one more node -e version edit, b85#20, under cat:toolchain's own row (its b85#12 twin files under edit-anchor, the machine's first-match-wins on 'Write/Edit tools') — three channel acts in one wave, the family's densest) which was grepped against 22 before it, after the seventeenth (b81#4's package.json edit in the fix-all-errors visit, verified clean after the act, against 21 before it), after the sixteenth (b79#0's patch in the dsic-noether delivery, verified clean after the act — clean does not unmake the breach, against 19 unchanged), after the fifteenth (b78#14's append in the vacuum-compiler delivery, one truncated block restored by Edit and reworked, against 19 before that batch), the thirteenth and fourteenth (b76#9's append in the quantum-mech delivery and b76#24's deleted scratch in the nosignal-tariff delivery, both the same batch, against 17); the rule lives in the daily memory; Write tool always, no content-based exceptions; the line's next sighting took its FIRST sed face (b87#15 — the switch-sched delivery's sed -i on a code file, grep-verified clean, clean does not absolve; the machine files it under cat:toolchain, its row, because 'sed -i' matches no named pattern — the b85#20 precedent for a channel act riding its category default)" },
  { family: "runner-path", holds: "BOOKED-UNENFORCEABLE", note: "the runner-path family (tsx -e Git Bash, PATH, entry paths, import homes, domain paths) — the tier follows the LATEST sighting: b87#10's silent tsx -e probe (the letter-audit delivery's census freeze check — CJS eval does not resolve the relative ESM import and the act leaves no output and no artifact, the b14#4/b38#1/b46#1/b49#0/b83#8/b84#19 line's SEVENTH sighting; the in-repo scratch-script rule is the enforcement, executed) is booked on the environment face; the gate-held members ride their own rows (b85#9's latent ent-clearing NaN printer — text bearing 'a latent corrosion path', first-match-wins filing it HERE over cat:wrong-object, the b73#8 machine-classed precedent and the b84#21 law: the filing follows the rule, never the intent — gate-held at its EC_NON_FINITE trial, as is the same wave's b85#3 (binding-price's first-cells market reader — 'one-coin paths' in its text — gate-held at its QUBIT-FRAUD trial)); the previous booked sighting was b84#19's banned-shape baseline probe (the wiring agent's own family byte-identity check run as node --import tsx -e with a relative dynamic import — it succeeded with output verified present, and success does not change the shape) on the environment face — the act's failure mode is silence, the in-repo Write-tool probe or the suite's own W-D witness is the honest route; the booked members stand in their own rows (b84#19 above, b83#8's silent tsx -e double failure — the nosignal-tariff delivery's RNG freeze-anchor probe, two consecutive silent runs with a relative import; the in-repo Write-tool probe plus run-and-delete is the fix, executed on the third attempt); the earlier gate-held members stand in their own rows (b73#8's beyond-domain probe of the exact c3 path, held at the suite's n<=16 domain guard — G1 matched its 'path' text, the machine classed it), as do the repro-gate-held members and b60#3's import-grep residue" },
  { family: "edit-anchor", holds: "BOOKED-UNENFORCEABLE", note: "the Edit-anchor family, eight sightings since b22 — the eighth (b85#12's node -e package-lock version edit in the choice-lang delivery, filed HERE by the machine's first-match-wins: the wrong-text names the Write/Edit tools, the b84#21 law again — the tier follows the machine's familyOf verdict) is booked on the act face; the seventh (b83#20's census package.json edit refused off a Bash cat view, the wiring agent's own second package.json of the visit hours after the burial twin's Read-first edit had landed cleanly — a shell view is not a Read) left nothing behind; grep the disk before anchoring, Read before Edit; no gate diffs intent" },
  { family: "count-drift", holds: "GATE-ENFORCED", note: "the count-drift family (b36 board literals, b37 dual lists, b45#9 prose, the b35 'four' found by B7's own pre-flight) — held since v0.5.0 by burial-record's B7 gate: stated counts must equal carried counts; the tier follows the LATEST sighting b88#10 (switch-sched's exp3 prose carrying the retired 36/40 as literals after the double-draw fix re-drew the sample to 34/40 beneath it — filed here by the machine's first-match-wins on 'the count prose', gate-held at its E3 interpolation needle, the filing follows the rule, never the intent); the previous was b85#11 (choice-lang's BRANCH_SHAPE guard conviction, filed here by the machine's first-match-wins on 'row count' in its text — gate-held at its own trial)" },
  { family: "non-null-assert", holds: "GATE-ENFORCED", note: "the non-null-assertion-assignment family — tsc rejects it outright; the dtc-clock typecheck gate is the guard" },
];

// ---------------------------------------------------------------------------
// The derivation skeleton (v0.31.0) — the b84#21/b85#35 guard, executed.
// Twice the G-board's resolution rows were drafted from the INTENDED
// category filing before the machine's familyOf rule saw the new texts
// (b84#21 the runner-path probe filed from intent; b85#35 four incidental
// phrase collisions filed rows under named families), and twice the suite
// convicted the drift at its first run. The suite convicts AFTER the pen;
// this skeleton is the pen's PRE-FLIGHT: the machine's own derivation of
// every family's row — which family each error files under (familyOf,
// first-match-wins, never the intent), which sighting is the latest, and
// the tier that row MUST hold. `npm run derive` prints it; a writer drafts
// FROM the table, never ahead of it.
// ---------------------------------------------------------------------------

/** One family's machine-derived resolution row: what the handwritten
 * FAMILY_RESOLUTIONS entry must say, and what it currently says. */
export interface SkeletonRow {
  readonly family: string;
  readonly sightings: number;
  readonly latestKey: string;
  /** the latest sighting's enrollment tier — the ONLY legal holds value */
  readonly derivedHolds: string;
  /** the current resolution row's holds, null when no row exists */
  readonly statedHolds: string | null;
  readonly status: "MATCH" | "TIER-DRIFT" | "ROW-MISSING" | "NO-ROW-NEEDED";
}

/** The machine's filing of every family in the census: the resolution rows
 * a G-board edit must land, derived live. G2's laws, stated forward: a
 * recurring family (>= 2 sightings) REQUIRES a row (ROW-MISSING without
 * one), any existing row must equal the latest sighting's tier
 * (TIER-DRIFT otherwise), and a singleton family needs none
 * (NO-ROW-NEEDED). The statuses and G2's live verdicts agree by
 * construction — the suite asserts it, so the tool cannot lie. */
export function resolutionSkeleton(
  census: GenealogyCensus,
  resolutions: readonly FamilyResolution[] = FAMILY_RESOLUTIONS,
): readonly SkeletonRow[] {
  return census.families.map((f) => {
    const stated = resolutions.find((r) => r.family === f.family)?.holds ?? null;
    const status: SkeletonRow["status"] =
      stated !== null
        ? stated === f.latestTier
          ? "MATCH"
          : "TIER-DRIFT"
        : f.sightings >= 2
          ? "ROW-MISSING"
          : "NO-ROW-NEEDED";
    return { family: f.family, sightings: f.sightings, latestKey: f.latestKey, derivedHolds: f.latestTier, statedHolds: stated, status };
  });
}

/** The rows a G-board edit must reconcile before the batch is declared
 * wired — exactly the families G2 convicts, named before the pen. */
export function skeletonDrift(rows: readonly SkeletonRow[]): readonly SkeletonRow[] {
  return rows.filter((r) => r.status === "TIER-DRIFT" || r.status === "ROW-MISSING");
}

// ---------------------------------------------------------------------------
// The census and the laws.
// ---------------------------------------------------------------------------

export interface FamilyRow {
  readonly family: string;
  readonly sightings: number;
  readonly firstBatch: number;
  readonly latestKey: string;
  readonly latestTier: string; // the enrollment tier of the latest sighting
  readonly members: readonly string[];
}

export interface CatchCensus {
  readonly gate: number;
  readonly author: number;
  readonly numbers: number;
  readonly visitor: number;
  readonly total: number;
  readonly earlyGateFraction: number; // batches 1..22
  readonly lateGateFraction: number; // batches 37..latest
}

export interface GenealogyCensus {
  readonly families: readonly FamilyRow[];
  readonly catch: CatchCensus;
}

export function genealogyCensus(
  errors: readonly LiveBurialError[],
  enrollment: readonly EnrollmentRow[],
): GenealogyCensus {
  const fams = new Map<string, { first: number; latest: LiveBurialError; members: string[] }>();
  for (const e of errors) {
    const f = familyOf(e.wrong, e.category);
    const cur = fams.get(f);
    if (cur === undefined) {
      fams.set(f, { first: e.batch, latest: e, members: [e.key] });
    } else {
      cur.members.push(e.key);
      if (e.batch > cur.latest.batch || (e.batch === cur.latest.batch && e.index > cur.latest.index)) cur.latest = e;
    }
  }
  const families: FamilyRow[] = [...fams.entries()]
    .map(([family, v]) => ({
      family,
      sightings: v.members.length,
      firstBatch: v.first,
      latestKey: v.latest.key,
      latestTier: enrollment.find((r) => r.key === v.latest.key)?.tier ?? "UNENROLLED",
      members: v.members,
    }))
    .sort((a, b) => b.sightings - a.sightings || a.family.localeCompare(b.family));

  const catchCensus = (lo: number, hi: number): { total: number; gate: number; visitor: number } => {
    let total = 0;
    let gate = 0;
    let visitor = 0;
    for (const e of errors) {
      if (e.batch < lo || e.batch > hi) continue;
      total++;
      const agent = catchAgentOf(e.wrong, e.category);
      if (agent === "gate") gate++;
      if (agent === "visitor") visitor++;
    }
    return { total, gate, visitor };
  };
  const all = catchCensus(0, Number.POSITIVE_INFINITY);
  const early = catchCensus(1, 22);
  const late = catchCensus(37, Number.POSITIVE_INFINITY);
  const cat: CatchCensus = {
    gate: all.gate,
    author:
      errors.length -
      all.gate -
      errors.filter((e) => catchAgentOf(e.wrong, e.category) === "numbers").length -
      errors.filter((e) => catchAgentOf(e.wrong, e.category) === "visitor").length,
    numbers: errors.filter((e) => catchAgentOf(e.wrong, e.category) === "numbers").length,
    visitor: all.visitor,
    total: errors.length,
    earlyGateFraction: early.total > 0 ? early.gate / early.total : 0,
    lateGateFraction: late.total > 0 ? late.gate / late.total : 0,
  };
  return { families, catch: cat };
}

export interface GenealogyViolation {
  readonly family: string;
  readonly law: string;
  readonly detail: string;
}

/** G1-G4 over the live registry (injectable for the smuggling trials). */
export function checkGenealogy(
  census: GenealogyCensus,
  resolutions: readonly FamilyResolution[] = FAMILY_RESOLUTIONS,
): GenealogyViolation[] {
  const out: GenealogyViolation[] = [];
  // G1 — closed vocabulary, one family per error (familyOf is total by
  // construction; the law bites when a resolution names an unknown family)
  const known = new Set(census.families.map((f) => f.family));
  for (const r of resolutions) {
    if (!known.has(r.family)) {
      out.push({ family: r.family, law: "G1", detail: "resolution names a family the registry does not carry — a stale row" });
    }
  }
  // G2 — every recurring family has a resolution row whose tier equals the
  // latest sighting's enrollment tier
  for (const f of census.families) {
    if (f.sightings < 2) continue;
    const row = resolutions.find((r) => r.family === f.family);
    if (row === undefined) {
      out.push({ family: f.family, law: "G2", detail: `${f.sightings} sightings and no resolution row — a repeat offender held by nothing` });
      continue;
    }
    if (row.holds !== f.latestTier) {
      out.push({
        family: f.family,
        law: "G2",
        detail: `resolution says ${row.holds}, the latest sighting ${f.latestKey} is enrolled ${f.latestTier} — the row drifted`,
      });
    }
  }
  // G4 — the count-drift family is held by burial-record's B7 gate
  const cd = census.families.find((f) => f.family === "count-drift");
  if (cd === undefined) {
    out.push({ family: "count-drift", law: "G4", detail: "the count-drift family is absent — the rules lost the visitor-caught class" });
  } else {
    const row = resolutions.find((r) => r.family === "count-drift");
    if (row?.holds !== "GATE-ENFORCED" || cd.latestTier !== "GATE-ENFORCED") {
      out.push({ family: "count-drift", law: "G4", detail: `the visitor-caught class must be held by a gate at its latest sighting (resolution ${row?.holds ?? "none"}, enrollment ${cd.latestTier})` });
    }
  }
  return out;
}

/** The count-drift family's B7 anchor must be REGISTERED on the A-board. */
export function b7AnchorRegistered(): boolean {
  return ANCHOR_REGISTRY.some((a) => a.anchor === "burial-record/package.json :: test");
}

export interface WitnessOutcome {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** W-H — the genealogy census, live by default. */
export async function witnessGenealogy(
  registry?: LiveRegistry,
  enrollment: readonly EnrollmentRow[] = ENROLLMENT,
): Promise<{ result: WitnessOutcome; census: GenealogyCensus }> {
  const reg = registry ?? (await loadLiveRegistry());
  const census = genealogyCensus(reg.errors, enrollment);
  const violations = checkGenealogy(census);
  const recurring = census.families.filter((f) => f.sightings >= 2).length;
  const c = census.catch;
  const detail =
    violations.length > 0
      ? violations.map((v) => `${v.family} [${v.law}]: ${v.detail}`).join("; ")
      : `${census.families.length} families over ${c.total} errors (${recurring} recurring, all resolved); catch census gate ${c.gate} / author ${c.author} / numbers ${c.numbers} / visitor ${c.visitor} — the gate fraction rose from ${(c.earlyGateFraction * 100).toFixed(0)}% (b1-22) to ${(c.lateGateFraction * 100).toFixed(0)}% (b37+); count-drift held by B7: ${b7AnchorRegistered()}`;
  return {
    result: { name: "W-H genealogy census", pass: violations.length === 0 && b7AnchorRegistered(), detail },
    census,
  };
}
