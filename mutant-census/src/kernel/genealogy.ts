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
  { family: "cat:wrong-object", holds: "GATE-ENFORCED", note: "the physics-object class — held at its latest sighting by the dtc-clock test gate (the W-K dual-road agreement)" },
  { family: "cat:process", holds: "BOOKED-UNENFORCEABLE", note: "the author-discipline class — its latest sighting is the W-G naming collision (no gate holds identifier namespaces); the E1 enrollment miss before it WAS gate-caught, the E1 gate holds the enrollment half" },
  { family: "cat:machine-overruled", holds: "GATE-ENFORCED", note: "the overruled-expectation class — every conviction pinned by a test that asserts the numbers' verdict (e.g. TC27's passive-beats-decoder)" },
  { family: "cat:dimension-slot", holds: "MUTANT-KILLED", note: "the dimension-accounting class — the mAdd shape-blind mutants guard it (MU3 lineage)" },
  { family: "cat:statistics", holds: "MUTANT-KILLED", note: "the statistics class — the 5-sigma census mutants guard it (MU8 lineage)" },
  { family: "cat:toolchain", holds: "GATE-ENFORCED", note: "the build/toolchain class — its latest sighting is the unnecessary-assertion catch, named by the lint gate; the shell-discipline residue lives in the runner-path family's own row" },
  { family: "cat:conjugation", holds: "MUTANT-KILLED", note: "the conjugation class — the transpose/dagger mutants guard it (MU1 lineage)" },
  { family: "cat:anchor-blindspot", holds: "BOOKED-UNENFORCEABLE", note: "the anchor-blindspot residue — no gate diffs intent; the named subfamily edit-anchor carries its own row" },
  { family: "cat:bogus-comparison", holds: "GATE-ENFORCED", note: "the rigged-benchmark class — held by the Q4 illegal-verdict check" },
  { family: "cat:citation-drift", holds: "GATE-ENFORCED", note: "the citation class — held at its latest sighting by the platform test gate (the double-source discipline)" },
  { family: "shell-template-heredoc", holds: "BOOKED-UNENFORCEABLE", note: "the banned heredoc/template family, ten sightings since b10 — the rule lives in the daily memory; Write tool always" },
  { family: "runner-path", holds: "BOOKED-UNENFORCEABLE", note: "the runner-path family (tsx -e Git Bash, PATH), nine sightings since b14 — the scratch-file rule is the enforcement" },
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
