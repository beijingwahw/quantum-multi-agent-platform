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
  { family: "cat:wrong-object", holds: "GATE-ENFORCED", note: "the physics-object class — the tier follows the LATEST sighting: b79#9's Schmidt-memory rank assumption (a fixed-table memory dimension where the law's trajectories carry the state's own eigen-rank) is gate-held where the rank is computed-where-asserted; the previous was b78#11's S2 conditioning-chain test first draft compared the wrong weight target and checked the leaf identity with a REPEATED object (the assertion verifying itself against itself) is gate-held at the weights-MULTIPLY needle (the chain's own weight against the second part's standalone weight, the composed weight against the exact product, the conditionals through the independent concat path); the same batch's b78#8 — the latent v0.1.0 depolarizeQubit with its same-qubit/cross-qubit branches interchanged and the mixing weights off — is held at the independent naive Pauli conjugation anchor that convicted it; b77#14's noise-census panel (e) applying the channel to the member instead of the verifier's marginal register (the memberwise (1 + gamma*m_z)/2 formula asserted against E_gamma(I/2)), b77#10 (the orthogonality check reading only the real part — 68 pseudo-Cliffords against the true 24), b77#4 (the hardcoded equality-case flag wrong for specific marked sets — computed per funded set now), b77#3 (the composition loop reading the already-killed population) and b77#0 (the replacer closed form's member entropies labeled to the wrong members — the sim cross-check convicted it) were the previous, as were b76#22's inverted inflection map, b76#2's degenerate on-grid point and b76#5's averageRhoDefect comparing against I instead of I/d, b75#12's projection-vs-discriminator conflation (the exact game matrix asserted cell by cell, all 144 entries 0) and b74#18/b74#16's referee deaths; the booked members stand in their own rows (b73#3's mismatched-scale frame, b72#0's false invariant, b57's domain/superset slips, b56's check-object slips, b66#8's readonly-Map mutation rides its own lint-held row)" },
  { family: "cat:process", holds: "BOOKED-UNENFORCEABLE", note: "the author-discipline class — the tier follows the LATEST sighting: b79#6's latent README '19/19' test count (47 at v0.2.0's close, 78 now — re-derived from the run in the same edit) is booked on the doc face no law reads; the previous was b78#15's inherited orphan draft (an inverted field name, a wrong docstring, a mischaracterized citation — all closed at the successor's gates with the erratum pinned in citations.md) is booked on the leaving-behind face, the b74#6 interruption class's second wave (b78#12's uncompilable stub convicted at the successor's typecheck is the same class one repo earlier in the batch); the wave's other booked acts — b78#9's read-only `git diff --stat` (third act on the b74#3/b77#8 line), b78#13's oldest-first doc comment, b78#1's 360k-shot MC hang (the b73#2 class) — ride their own rows; the machine-held members ride their own rows (b76#13's placeholder gf2Rank held at the rank-vs-brute-force anchor, b76#17's fake test claims held by the rewritten suite, b75#4's tampered 0.71 assertion convicted by the exact eta* = 1/√2 noise-threshold test, b74#7's fragile assertions convicted by the suite's own re-run, b73#0, b73#6, b73#9, b54#0, b54#2, b60#7, b61#1, b63#2, b67#1, b67#5, b67#6 on E7, b68#0, b68#1, b69#2, b70#1), as do the booked members (b76#23's display truncations on the b29#4/b30#1 print-honesty line, b76#3's dead scaffolding, b76#7's attempted prose-before-run, b76#8's docs-section destruction, b73#10's visit/batch resync, b73#1 scratch mechanics, b73#2 the O(K^2) hang, b71#0's detached duplicate gate launch, b70#3's memory prefix duplication, b70#2's never-fail assertion, b69#0's string residue, b69#1's memory anchor, b68#2's heading swallow, b65#1's cross-session stale read-state, b75#6's /tmp log placement on the outside-tree face)" },
  { family: "cat:machine-overruled", holds: "GATE-ENFORCED", note: "the overruled-expectation class — the tier follows the LATEST sighting: b79#17 — the SEVERE conviction, zetaEM's spurious (1/2)N^-s tail term behind v0.19.0's 'Phi1 = -4.547e-4 SMALL BUT NONZERO' — is gate-held at the TC47 zero-inside-bracket needle (the sign fix certified by N=60/120/240 agreement at ~1e-10, Phi1 = +7.14e-8 inside |Phi1| <= 5.58e-7, kappa re-based to -0.306852819, the transfer confirmed to 5.8e-6 on the new incremental-binomial road); the same batch's b79#1 (across-kink direction) and b79#2 (the flux jump asserted flat) are gate-held at their exact-rational needles, as is b79#8's backwards triangle ladder; the previous was b78#3's decoherence-invisibility claim was asserted BACKWARDS and overruled twice in one row — phase damping on the Z-tier trap is PERFECTLY detected (acceptance exactly 1-gamma) and the guess-decay is the V-form |1-2gamma|, not a line — pinned at the census row asserting both machine-found laws at every grid point with the gamma=1 decoupling anchor; b77#9's sigma-tensor-sigma Pauli twirl was INERT on Bell-diagonal states (a permutation of the Bell basis, not an average — the depolarizing step silently did nothing) and the machine overruled it: the honest-negatives test asserts the raw nested round DEGRADES the coin without the twirl (0.884146 -> 0.812024), the load-bearing face the 24-element Clifford twirl carries; b75#9's matched blind-pair generator was rejected at T = 0.918 by the contract now asserted in-tree (max T < 1e-7 over all 24 plain orders), as was b75#8's assumed swap Pauli quadruple (the census holds ZERO commuting at d=4, 0/30/1335); every conviction pinned by a test that asserts the numbers' verdict (e.g. TC27's passive-beats-decoder)" },
  { family: "cat:dimension-slot", holds: "GATE-ENFORCED", note: "the dimension-accounting class — the tier follows the LATEST sighting: b79#15's W-Z witness name colliding with an old trial's numbering (the suite caught the duplicate on the first run) is gate-held at the closed witness list's unknown-witness trial — identifier namespaces grepped before claimed; the previous was b78#6's constants-audit trials keyed by id in a map (two rows sharing an id silently overwrote each other and the duplicate vanished) is gate-held at the map-free duplicate-id rejection — BOTH rejections stay visible and the smuggling trial asserts the pair; b77#13's Schmidt companion indexed wrong (the 01/10 companion instead of the swap-flip — per-coin marginals at TV 0.5 from I/2 where the family demands exactly I/2 at every t) is gate-held at the per-coin-flat-at-every-Schmidt-coefficient assertion; b75#11's 8-dim split-layout NaN (control 4 ⊗ target 2, re at i / im at 8+i) is gate-held at Algorithm 1's exact-readout assertion (probability exactly 1 on every promising set), and b75#3's transcribed slot order dies at the elementwise W* ≡ OCB12 eq. (7) anchor; the class-level shape-blind face stays MUTANT-KILLED in its own lineage (the mAdd MU3 mutants)" },
  { family: "cat:statistics", holds: "GATE-ENFORCED", note: "the statistics class — the tier follows the LATEST sighting: b79#10's 'half' rounding of the error-schedule saving (the data prices it at 49.5%, 0.1553 vs 0.3077) is gate-held at the exact-arithmetic bound, as is the same batch's b79#4 flat-dishonest grid witness (the wall-to-wall zeros COUNTED); the previous was b78#7's window-policy assertion wrong at W=4 (the first feasible realtime window is W=8 at 0.856 — W=4 still exceeds the ceiling at 1.03) is gate-held at both-margin assertion on both scenarios, as is the same batch's b78#5 hand-arithmetic slip (0.1-squared where the true expectation was 0.1*(1/6)^3 — asserted exactly to 1e-18); b77#12's twoCoinStrategies C1/C3 first-draft garbage expressions are gate-held at the per-coin marginal/reveal assertions of the two-coin census, as are the same batch's b77#1 atanh closure dropping its factor 2 (LN2_A enclosing ln2/2, hidden from the chi certificates by exact cancellation in fTerm's denominator — the ln-enclosure bracket test holds it) and b77#2's zero-slack bracket test that convicted the float reference's own ulp error (the reference-slack needle); b76#21's wide-rational NaN (fToNumber's naive Number(n)/Number(d) on limbs past 2^53, caught on the rendered report's face) is gate-held at the decimal-long-division fallback needle, as are b76#20's 2x-too-small LN2 tail enclosure (the cross-route overlap check caught it on the spot; the tight-enclosure test holds it) and b76#14/15/16's retro-cache algebra/sign/mixing-rate defects (crossing-exact, the honest-ledger zero-tap anchor, and the strictly-positive-tax mutation census); b76#1's BigInt→Number overflow NaN at n≥256 is held at the scaled-division needle; b75#15's census completion that broke the tie equation's denominator, b75#14's halved U_1 initialization and b75#2's 4x coefficient were the previous; b74#15's fabricated census size (20480 against the true 8192) and b74#14's global-½ double-count died at their anchors the same way (the fake-number family, closed at both faces — b76#7's attempted prose-before-run sighting stays booked in its own row); the arrangement members stand booked in their own rows (b73#4's beyond-noise-floor fit, b55#6's cancellation face), as do the census-level kills in earlier sightings' own rows (the MU8/MU9 lineage)" },
  { family: "cat:toolchain", holds: "BOOKED-UNENFORCEABLE", note: "the build/toolchain class — the tier follows the LATEST sighting: b79#14's attempted gate pipe (killed on sight, re-run for the direct exit code — the exit-code-masking family's ninth sighting) is booked on the shell-act face, as are the same batch's b79#0 heredoc act (the channel's sixteenth canonical sighting, verified clean after — clean does not unmake the breach) and b79#13's failed bash template-string escape (no landing, nothing to gate); the wave's gate-held members ride their own rows (b79#12's render.ts backtick at the typecheck gate that convicted it, b79#5's four void-return lint convictions at the lint script); the previous gate-held latest was b78#16's five lint convictions in vacuum-compiler at the lint script every run closed in the same edit, and the same batch's b78#0 — the embedded '*/' closing a block comment early, the b12#0 twin — died at the typecheck gate the moment it landed; the earlier gate-held members ride their own rows (b77#6's lint conviction and b77#7's latent bare-pipe render defect, needle-held at the escaped ket; b76#25's latent switch-sched repro no-op at its run-all needle — the repro-no-op family went systemic across postselect/qram/retro/switch, all needle-held, with the batch-7 full-workspace audit still priced; b76#4/b76#19/b76#10/b75#18/b75#16/b75#17/b75#1/b75#5's lint/typecheck/repro rows); the booked shell-discipline members stand in their own rows (b78#10's attempted display pipe — the exit-code-masking family's eighth sighting; b78#14's heredoc act, the channel's fifteenth; b77#11's transient W-F miss on the transient face; b74#0/b74#2's exit-code masking, b74#9 and b76#0's pre-machine require(), b74#11's apostrophe, b75#13/b76#9/b76#24's heredoc acts), and the runner-path residue lives in the runner-path family's own row" },
  { family: "cat:conjugation", holds: "GATE-ENFORCED", note: "the convention class — the tier follows the LATEST sighting: b79#3's chargeOneSided sign clamp (the win-side limit flipped against the convention the losing side carries) is gate-held at the exact-rational one-sided limits with the SIGNED win-side face pinned; the previous was b78#2's phase-damping Kraus operators written in the reversed form in the first draft is gate-held at the Z-tier grid (phaseDampingKraus at every gamma in [0,1], trap acceptance exactly 1-gamma against the closed form — a reversed Kraus family dies at the first grid point); b77#15's latent blochOf y-flip (v0.1.0's form returned -y, masked a whole version because every caller dotted TWO blochOf outputs and the double flip cancelled; the noise census's raw-tuple-plus-one-blochOf asymmetry exposed it at deviation 6.6e-1) is gate-held at the one-at-a-time roundtrip regression test — a double flip can hide in pairs, a roundtrip cannot; b77#5's overlap closed-form sign slip (the conjugate's sign flipped in the test's two-path derivation) is gate-held at the componentwise overlap assertion the same suite runs; b76#6's traceProd sign bug (the im-im product entered with a minus where Tr[AB] for Hermitian a, b sums both products) is gate-held at the formula pinned in the kernel (Tr[AB] = Σ_ij a_ij conj(b_ij), real by construction); b75#10's Pauli-ray phase defect (rotationsOf landing off the generator's ray) is gate-held at the matched-pair contract's phase assertion (product phase-only off the generator, diagonal exactly 0); b74#13's latent CJ-convention defect (identity not mapping to SWAP under complex Kraus, alive since v0.1.0) and b66#4's sequential-substitution slip were the previous; the physics face (transpose/dagger) stays MUTANT-KILLED in its own lineage (MU1)" },
  { family: "cat:anchor-blindspot", holds: "GATE-ENFORCED", note: "the anchor-blindspot class — the tier follows the LATEST sighting: b79#7's frontier needle quoting the CHSH constant at 15 decimals against retro-cache's printed 12 is gate-held at A6 (letter-audit's own live-pointer law — every needle read from the sibling's report on every suite run, so a needle that misquotes its target dies the moment it lands); the intent-diffing residue stays booked in its own rows, and the named subfamily edit-anchor carries its own row (b53#5 itself files under runner-path: the machine's regex, not the author's reading of the lesson)" },
  { family: "cat:bogus-comparison", holds: "GATE-ENFORCED", note: "the rigged-benchmark class — held by the Q4 illegal-verdict check; the formula-times-itself species emigrated to its own family at batch 79 (tautological-witness, the founding sighting carrying the SEVERE conviction)" },
  { family: "tautological-witness", holds: "GATE-ENFORCED", note: "公式自乘恒真验证 (the formula-times-itself family) — founded at b79#16, the SEVERE conviction: TC13(ii)/TC18's echo-decay law |cos2d|^k was verified TAUTOLOGICALLY (the v0.2.0 witness certified the formula against itself) and the law was FALSE — the true isolated-echo law is m(k) = (-1)^k cos(2k*delta) exactly (8.3e-15), the geometric envelope missing by 0.82-0.99 with first crossings 6/3/2 against the claimed 35/9/4, re-founded by TC46 as exact-in-expectation under per-period sign noise (exhaustive over all 2^k sequences, 3.6e-15); route-price v0.2.0 credited as the discovering sibling; machine-convicted by the tautology smuggling trial — a formula-times-itself witness certifies the WRONG constant |cos 3*delta|^k just as happily, named and rejected on every run; the species' ancestors (batch 14's brute-force control evaluated as the same formula again, batch 25's self-composed rotation checked against itself) lived in cat:bogus-comparison before the family existed" },
  { family: "cat:citation-drift", holds: "GATE-ENFORCED", note: "the citation class — the tier follows the LATEST sighting: b79#11's BCP14 preprint number written from memory as arXiv:1310.6190 (the true number 1311.0275, caught at the source — the identifier family's EIGHTH sighting after b55#3/b56#9/b74#5/b75#7/b76#11/b76#12/b78#4, grepped before enrolling) is needle-held at the corrected citations.md entry with the wrong first guess confessed on disk; the previous was b78#4's arXiv:2405.00789 author attribution recalled wrong and caught by the source check (the identifier family's SEVENTH sighting after b55#3/b56#9/b74#5/b75#7/b76#11/b76#12, grepped before enrolling) is needle-held at the corrected citations.md entry with the wrong first guess confessed on disk; b76#18's two unverified DOIs (one wrong and corrected, one stood but carried no verification record) are gate-held at the citations needle — both entries now pin the double-source verification record on disk; the AUTHOR-TABLE face went consecutive the same batch: b76#11's arXiv:2311.12444 attribution ('Wolitzky et al.' for Rubinstein & Zhou, the identifier family's fifth sighting after b55#3/b56#9/b74#5/b75#7, grepped before enrolling) and b76#12's DLW04 three-for-six author table (the sixth) are each needle-held at the corrected citations.md entries — the identifier family's first three needle-held sightings were b75#7's VDL23 article number before them; the booked members stand in their own rows (b74#5's deleted 'decision transformer', b56#9's Davies year, b55#3's arXiv digits — the double-source ritual stays author discipline for claims no needle can pin), as do the earlier machine-held members" },
  { family: "shell-template-heredoc", holds: "BOOKED-UNENFORCEABLE", note: "the banned heredoc/template family, sixteen canonical sightings since b10 — the sixteenth (b79#0's patch in the dsic-noether delivery, verified clean after the act — clean does not unmake the breach) was grepped against the family's in-registry wrong-text sightings (19, unchanged by the clean act) before enrolling, after the fifteenth (b78#14's append in the vacuum-compiler delivery, one truncated block restored by Edit and reworked, against 19 before that batch), the thirteenth and fourteenth (b76#9's append in the quantum-mech delivery and b76#24's deleted scratch in the nosignal-tariff delivery, both the same batch, against 17); the rule lives in the daily memory; Write tool always, no content-based exceptions" },
  { family: "runner-path", holds: "GATE-ENFORCED", note: "the runner-path family (tsx -e Git Bash, PATH, entry paths, import homes, domain paths) — the tier follows the LATEST MACHINE-CLASSIFIED sighting: b73#8's beyond-domain probe of the exact c3 path is gate-held (the n<=16 domain guard throws, asserted by the suite — G1 matched its 'path' text, the family follows the machine); the booked members stand in their own rows (b60#3's import-grep residue — the ESM refusal is instant but no gate reviews scratch imports), as do the repro-gate-held members" },
  { family: "edit-anchor", holds: "BOOKED-UNENFORCEABLE", note: "the Edit-anchor family, four sightings since b22 — grep the disk before anchoring; no gate diffs intent" },
  { family: "count-drift", holds: "GATE-ENFORCED", note: "the count-drift family (b36 board literals, b37 dual lists, b45#9 prose, the b35 'four' found by B7's own pre-flight) — held since v0.5.0 by burial-record's B7 gate: stated counts must equal carried counts" },
  { family: "non-null-assert", holds: "GATE-ENFORCED", note: "the non-null-assertion-assignment family — tsc rejects it outright; the dtc-clock typecheck gate is the guard" },
];

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
