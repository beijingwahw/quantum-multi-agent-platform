/**
 * THE SELF-REPORT LAWS (S1/S2) — v0.22.0, the HELD rows' priced refutation
 * targets EXECUTED: the census's own rendered report is law, not literature.
 *
 *   S1 板序检查器 (the board-order checker) — the report's section order is
 *       LEGISLATED (the README's board paragraph is the statute's prose face;
 *       BOARD_ORDER below is its executable form): M → P → negative controls
 *       → K → W → E → A → G → J → R → T → witnesses → boundaries → closing.
 *       The vocabulary is closed (an unknown ## section is a conviction, the
 *       E6/Q6 symmetry applied to the report's own shape), each section
 *       appears exactly once and in the legislated order, the M-board's rows
 *       ASCEND by id, and the A-board's kind blocks follow the evidence order
 *       (FIRING-INJECT before FIRING-LIVE before RESOLVED). A permuted or
 *       section-shuffled report is refused BY NAME — the b59#6 class (board
 *       rows out of order for a whole visit, unnoticed by every gate).
 *   S2 散文对账门禁 (the prose-reconciliation gate) — every numeric claim in
 *       the rendered prose is a COPY of the data, E7's principle extended
 *       from the package.json description to the report itself: the claim
 *       table re-derives each stated number from the live registry, the live
 *       enrollment, the live kill census, the live family scan and the audit
 *       tables, and drift refuses the build naming the field — the b36#16 /
 *       b57#5 class (board literals drifting from witness numbers; the law's
 *       first live run convicted three drifted phrases in the shipped prose:
 *       "Ten full members" against the live 7, "quantum-mech and qverify
 *       share four of five" against the live 3 and 4, and the R-board's
 *       "Nine reasons had gone false ... fifteen were coarse" against the
 *       live 11 and 33).
 *
 * Absent claims claim nothing (E7's parser principle): a phrase not present
 * states no number; a present phrase states exactly its live arithmetic.
 * The checker is PURE over text + a derived reconciliation, so the smuggling
 * trials inject forged TEXT and are convicted by name.
 */
import { runBattery, runKillCensus } from "./battery.js";
import { REGISTERED_DIVERGENCES, scanFamily, scanWorkspace, FAMILY_FILES, EPOCH_REPOS, type FamilyScanRow } from "./census.js";
import { MUTANTS } from "./family.js";
import { ENROLLMENT, type EnrollmentRow } from "./enrollment.js";
import { ANCHOR_REGISTRY } from "./anchors.js";
import { PER_ERROR } from "./equiv.js";
import { REPAIR_AUDIT } from "./repair.js";
import { loadLiveRegistry, type LiveRegistry } from "./bridge.js";
import { catchAgentOf, witnessGenealogy, type CatchCensus } from "./genealogy.js";

export interface SelfReportViolation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

/** S1's statute: the legislated section order of the rendered census. */
export const BOARD_ORDER: readonly string[] = [
  "M-board",
  "P-board",
  "Negative controls",
  "K-board",
  "W-board",
  "E-board",
  "A-board",
  "G-board",
  "J-board",
  "R-board",
  "T-board",
  "Witnesses",
  "Boundaries",
  "Closing",
];

/** The A-board's legislated evidence order (FIRING-INJECT, FIRING-LIVE, RESOLVED). */
export const ANCHOR_KIND_ORDER: readonly string[] = ["FIRING-INJECT", "FIRING-LIVE", "RESOLVED"];

/** S1: the board-order checker — pure over the report text. */
export function checkBoardOrder(text: string): SelfReportViolation[] {
  const v: SelfReportViolation[] = [];
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]!);
  const keyOf = (heading: string): string | undefined => BOARD_ORDER.find((k) => heading.startsWith(k));
  const seen = new Map<string, number>();
  let lastKey = "";
  let lastRank = -1;
  for (const h of headings) {
    const key = keyOf(h);
    if (key === undefined) {
      v.push({
        row: h.slice(0, 40),
        law: "S1",
        detail: `unknown section "## ${h.slice(0, 40)}" — the section vocabulary is closed; a new board is legislated in BOARD_ORDER and the README, never smuggled in`,
      });
      continue;
    }
    if (seen.has(key)) {
      v.push({ row: key, law: "S1", detail: `the ${key} section appears ${seen.get(key)! + 1} times — each legislated section appears exactly once` });
    }
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const rank = BOARD_ORDER.indexOf(key);
    if (rank < lastRank) {
      v.push({
        row: key,
        law: "S1",
        detail: `the ${key} section appears after ${lastKey} — the board order is law (${BOARD_ORDER.map((k) => k.split(" ")[0]).join(" > ")}); a permuted report is a smuggled report`,
      });
    }
    lastRank = rank;
    lastKey = key;
  }
  for (const key of BOARD_ORDER) {
    if (!seen.has(key)) {
      v.push({ row: key, law: "S1", detail: `the ${key} section is MISSING — a section silently gone has no should-exist oracle unless the order itself is law` });
    }
  }
  // rows within boards: the M-board's register ascends by id (the b59#6 class)
  const muIds = [...text.matchAll(/^\| (MU\d+) \|/gm)].map((m) => m[1]!);
  for (let i = 1; i < muIds.length; i++) {
    const prev = Number.parseInt(muIds[i - 1]!.slice(2), 10);
    const cur = Number.parseInt(muIds[i]!.slice(2), 10);
    if (cur <= prev) {
      v.push({
        row: muIds[i]!,
        law: "S1",
        detail: `M-board row ${muIds[i]!} follows ${muIds[i - 1]!} — rows within boards are ordered by id (b59#6: order is part of the face)`,
      });
    }
  }
  // the A-board's kind blocks follow the evidence order
  const kinds = [...text.matchAll(/^- \*\*(FIRING-INJECT|FIRING-LIVE|RESOLVED)\*\*/gm)].map((m) => m[1]!);
  let lastKindRank = -1;
  for (const k of kinds) {
    const rank = ANCHOR_KIND_ORDER.indexOf(k);
    if (rank < lastKindRank) {
      v.push({ row: k, law: "S1", detail: `the A-board's ${k} block appears out of evidence order — ${ANCHOR_KIND_ORDER.join(" > ")} is the legislated kind sequence` });
    }
    lastKindRank = rank;
  }
  return v;
}

// ---------------------------------------------------------------------------
// S2 — the prose-reconciliation gate. One derivation feeds one pure checker.
// ---------------------------------------------------------------------------

export interface ProseClaimInputs {
  readonly registry: LiveRegistry;
  readonly enrollment: readonly EnrollmentRow[];
  readonly mutantCount: number;
  readonly batteryCount: number;
  /** kill census tally BY ACTUAL VERDICT (EXACT-KILL / CRASH-KILL / DATA-KILL / SURVIVED) */
  readonly killTally: Readonly<Record<string, number>>;
  readonly killCount: number;
  readonly familyRows: readonly FamilyScanRow[];
  readonly registeredDivergenceCount: number;
  readonly epochRepoCount: number;
  readonly unguardedTotal: number;
  readonly catchCensus: CatchCensus;
  readonly visitorKeys: readonly string[];
  readonly anchorKindTally: Readonly<Record<string, number>>;
  readonly anchorTotal: number;
  readonly repairTally: Readonly<Record<string, number>>;
  readonly perErrorTally: Readonly<Record<string, number>>;
}

interface FixedClaim {
  readonly field: string;
  readonly re: RegExp;
  readonly expected: number;
}

interface StringClaim {
  readonly field: string;
  readonly re: RegExp;
  readonly expected: string;
}

export interface ProseReconciliation {
  /** one-capture-group numeric claims; absent phrases claim nothing */
  readonly fixed: readonly FixedClaim[];
  readonly stringClaims: readonly StringClaim[];
  /** repo -> live (identical, present) for every "REPO shares N of M" phrase */
  readonly repoShares: ReadonlyMap<string, { identical: number; present: number }>;
  readonly fileCount: number;
  /** the live full-member names the K-board's list claim must carry, as a set */
  readonly fullMemberNames: readonly string[];
  /** category -> live (mutant, gate, booked) for the E-board's category table */
  readonly categoryCells: ReadonlyMap<string, { mutant: number; gate: number; booked: number }>;
}

/** Derive the reconciliation every numeric prose claim answers to. */
export function deriveProseReconciliation(i: ProseClaimInputs): ProseReconciliation {
  const tier = (t: string): number => i.enrollment.filter((r) => r.tier === t).length;
  const kill = (t: string): number => i.killTally[t] ?? 0;
  const repair = (t: string): number => i.repairTally[t] ?? 0;
  const perError = (t: string): number => i.perErrorTally[t] ?? 0;
  const fam = new Map<string, number>();
  for (const r of i.familyRows) {
    if (r.status === "NOT-PRESENT") continue;
    if (r.status === "IDENTICAL") fam.set(r.repo, (fam.get(r.repo) ?? 0) + 1);
    else fam.set(r.repo, fam.get(r.repo) ?? 0);
  }
  const present = new Map<string, number>();
  for (const r of i.familyRows) {
    if (r.status !== "NOT-PRESENT") present.set(r.repo, (present.get(r.repo) ?? 0) + 1);
  }
  const fullMemberNames = [...present.entries()]
    .filter(([repo, n]) => n === FAMILY_FILES.length && (fam.get(repo) ?? 0) === FAMILY_FILES.length)
    .map(([repo]) => repo)
    .sort();
  const repoShares = new Map<string, { identical: number; present: number }>();
  for (const [repo, n] of present.entries()) {
    if (n === FAMILY_FILES.length && (fam.get(repo) ?? 0) === FAMILY_FILES.length) continue;
    repoShares.set(repo, { identical: fam.get(repo) ?? 0, present: n });
  }
  const status = (s: string): number => i.familyRows.filter((r) => r.status === s).length;
  const categoryCells = new Map<string, { mutant: number; gate: number; booked: number }>();
  for (const c of [...new Set(i.registry.errors.map((e) => e.category))].sort()) {
    const rows = i.enrollment.filter((r) => r.category === c);
    categoryCells.set(c, {
      mutant: rows.filter((r) => r.tier === "MUTANT-KILLED").length,
      gate: rows.filter((r) => r.tier === "GATE-ENFORCED").length,
      booked: rows.filter((r) => r.tier === "BOOKED-UNENFORCEABLE").length,
    });
  }
  const survivors = kill("SURVIVED");
  const visitor = i.catchCensus.visitor === 1 && i.visitorKeys.length === 1 ? (i.visitorKeys[0] ?? "") : `(the live visitor census carries ${i.visitorKeys.length} — "the one visitor catch" is a stale phrase)`;
  const pct = (x: number): number => Number((x * 100).toFixed(0));
  const fixed: FixedClaim[] = [
    { field: "intro-epoch-repos", re: /the (\d+) epoch repos/, expected: i.epochRepoCount },
    { field: "m-prose-mutants", re: /(\d+) mutants, \d+ kills as declared/, expected: i.mutantCount },
    { field: "m-prose-kills", re: /\d+ mutants, (\d+) kills as declared/, expected: i.killCount - survivors },
    { field: "m-exact", re: /(\d+) exact kills/, expected: kill("EXACT-KILL") },
    { field: "m-crash", re: /(\d+) crash kill\b/, expected: kill("CRASH-KILL") },
    { field: "m-data", re: /(\d+) statistical kills/, expected: kill("DATA-KILL") },
    { field: "k-repo-file-pairs", re: /Across (\d+) repo-file pairs/, expected: i.familyRows.length },
    { field: "k-not-present", re: /(\d+) NOT-PRESENT/, expected: status("NOT-PRESENT") },
    { field: "k-registered", re: /(\d+) REGISTERED-DIVERGENCE/, expected: status("REGISTERED-DIVERGENCE") },
    { field: "k-identical", re: /(\d+) IDENTICAL\./, expected: status("IDENTICAL") },
    { field: "k-full-members", re: /(\d+) epoch members byte-identical/, expected: fullMemberNames.length },
    { field: "k-family-files", re: /byte-identical in all (\d+) files/, expected: FAMILY_FILES.length },
    { field: "w-epoch-numerator", re: /(\d+)\/\d+ epoch repos/, expected: i.epochRepoCount },
    { field: "w-epoch-denominator", re: /\d+\/(\d+) epoch repos/, expected: i.epochRepoCount },
    { field: "w-unguarded-total", re: /(\d+) unguarded entries TOTAL/, expected: i.unguardedTotal },
    { field: "e-registry-errors", re: /(\d+) errors across \d+ batches/, expected: i.registry.errors.length },
    { field: "e-registry-batches", re: /\d+ errors across (\d+) batches/, expected: i.registry.batchCount },
    { field: "tier-MUTANT-KILLED", re: /^\| MUTANT-KILLED \| (\d+) \|/m, expected: tier("MUTANT-KILLED") },
    { field: "tier-GATE-ENFORCED", re: /^\| GATE-ENFORCED \| (\d+) \|/m, expected: tier("GATE-ENFORCED") },
    { field: "tier-BOOKED-UNENFORCEABLE", re: /^\| BOOKED-UNENFORCEABLE \| (\d+) \|/m, expected: tier("BOOKED-UNENFORCEABLE") },
    { field: "a-guards-registered", re: /(\d+) guards registered/, expected: i.anchorTotal },
    { field: "a-firing-inject", re: /(\d+) firing-inject demos on disk/, expected: i.anchorKindTally["FIRING-INJECT"] ?? 0 },
    { field: "a-fired-live", re: /(\d+) fired live this run/, expected: i.anchorKindTally["FIRING-LIVE"] ?? 0 },
    { field: "a-resolved", re: /(\d+) resolved to machinery/, expected: i.anchorKindTally["RESOLVED"] ?? 0 },
    { field: "g-catch-gate", re: /catch census: gate (\d+) \//, expected: i.catchCensus.gate },
    { field: "g-catch-author", re: / \/ author (\d+) \//, expected: i.catchCensus.author },
    { field: "g-catch-numbers", re: / \/ numbers (\d+) \//, expected: i.catchCensus.numbers },
    { field: "g-catch-visitor", re: / \/ visitor (\d+) over /, expected: i.catchCensus.visitor },
    { field: "g-catch-total", re: /over (\d+) errors/, expected: i.catchCensus.total },
    { field: "g-early-gate-percent", re: /rose from (\d+)% \(batches 1-22\)/, expected: pct(i.catchCensus.earlyGateFraction) },
    { field: "g-late-gate-percent", re: /to (\d+)% \(batches 37\+\)/, expected: pct(i.catchCensus.lateGateFraction) },
    { field: "j-collapses", re: /(\d+) collapses/, expected: perError("COLLAPSES") },
    { field: "j-error-level", re: /(\d+) error-level kills/, expected: perError("ERROR-LEVEL") },
    { field: "j-equivalent", re: /(\d+) equivalent survivors/, expected: perError("EQUIVALENT") },
    { field: "j-unbuildable", re: /The unbuildable (\d+)/, expected: perError("UNBUILDABLE") },
    { field: "j-prototypes", re: /ALL (\d+) prototypes/, expected: perError("COLLAPSES") },
    { field: "j-collapse-for-collapse", re: /\((\d+) for \d+\)/, expected: perError("COLLAPSES") },
    { field: "j-collapse-for-collapse-2", re: /\(\d+ for (\d+)\)/, expected: perError("COLLAPSES") },
    { field: "p-properties-green", re: /(\d+) properties green on the canonical family/, expected: i.batteryCount },
    { field: "wa-killed", re: /(\d+)\/\d+ killed as declared/, expected: i.killCount - survivors },
    { field: "wa-population", re: /\d+\/(\d+) killed as declared/, expected: i.mutantCount },
    { field: "wa-exact", re: /EXACT (\d+), CRASH \d+, DATA \d+, SURVIVED \d+/, expected: kill("EXACT-KILL") },
    { field: "wa-crash", re: /EXACT \d+, CRASH (\d+), DATA \d+, SURVIVED \d+/, expected: kill("CRASH-KILL") },
    { field: "wa-data", re: /EXACT \d+, CRASH \d+, DATA (\d+), SURVIVED \d+/, expected: kill("DATA-KILL") },
    { field: "wa-survived", re: /EXACT \d+, CRASH \d+, DATA \d+, SURVIVED (\d+)/, expected: survivors },
    { field: "wd-identical", re: /(\d+) file-pairs byte-identical to the canon/, expected: status("IDENTICAL") },
    { field: "wd-registered-live", re: /(\d+) registered divergences live/, expected: status("REGISTERED-DIVERGENCE") },
    { field: "wd-registered-register", re: /\((\d+) registered\)/, expected: i.registeredDivergenceCount },
    { field: "wd-unregistered", re: /(\d+) unregistered, \d+ stale/, expected: status("UNREGISTERED-DIVERGENCE") },
    { field: "wd-stale", re: /\d+ unregistered, (\d+) stale/, expected: status("STALE-REGISTRATION") },
    { field: "r-upgraded-prose", re: /(\d+) reasons had gone false/, expected: repair("UPGRADED") },
    { field: "r-sharpened-prose", re: /(\d+) were coarse/, expected: repair("SHARPENED") },
    { field: "r-upgraded-table", re: /^\| UPGRADED \| (\d+) \|/m, expected: repair("UPGRADED") },
    { field: "r-sharpened-table", re: /^\| SHARPENED \| (\d+) \|/m, expected: repair("SHARPENED") },
    { field: "r-held-table", re: /^\| HELD \| (\d+) \|/m, expected: repair("HELD") },
  ];
  const stringClaims: StringClaim[] = [{ field: "g-visitor-key", re: /The one visitor catch is (b\d+#\d+)/, expected: visitor }];
  return { fixed, stringClaims, repoShares, fileCount: FAMILY_FILES.length, fullMemberNames, categoryCells };
}

/** S2: the prose-reconciliation checker — pure over the report text. */
export function checkProseCounts(text: string, r: ProseReconciliation): SelfReportViolation[] {
  const v: SelfReportViolation[] = [];
  for (const c of r.fixed) {
    const m = c.re.exec(text);
    if (!m) continue; // absent claims claim nothing (E7's parser principle)
    const stated = Number.parseInt(m[1]!, 10);
    if (stated !== c.expected) {
      v.push({
        row: c.field,
        law: "S2",
        detail: `the ${c.field} prose claims ${stated} but the live arithmetic carries ${c.expected} — a stated count is a copy of the data (b36#16/b57#5 class)`,
      });
    }
  }
  for (const c of r.stringClaims) {
    const m = c.re.exec(text);
    if (!m) continue;
    if (m[1]! !== c.expected) {
      v.push({
        row: c.field,
        law: "S2",
        detail: `the ${c.field} prose claims "${m[1]!}" but the live derivation says "${c.expected}" — a stated identity is a copy of the data`,
      });
    }
  }
  // the K-board's sharing clauses: every "REPO shares N of M" answers to the scan
  for (const m of text.matchAll(/([a-z][a-z0-9-]*) shares (\d+) of (\d+)/g)) {
    const repo = m[1]!;
    const live = r.repoShares.get(repo);
    if (live === undefined) {
      v.push({
        row: `k-shares-${repo}`,
        law: "S2",
        detail: `the prose says "${repo} shares ${m[2]!} of ${m[3]!}" but the live scan carries no partial-member clause for ${repo} — an invented share`,
      });
      continue;
    }
    if (Number.parseInt(m[2]!, 10) !== live.identical || Number.parseInt(m[3]!, 10) !== live.present) {
      v.push({
        row: `k-shares-${repo}`,
        law: "S2",
        detail: `the prose says "${repo} shares ${m[2]!} of ${m[3]!}" but the live scan says ${live.identical} of ${live.present} — a stated share is a copy of the data`,
      });
    }
  }
  // the K-board's full-member list: the parenthetical must carry exactly the live set
  const listMatch = /\(([^()]*plus this census[^()]*)\)/.exec(text);
  if (listMatch) {
    const named = listMatch[1]!.split("—")[0]!.split(",").map((s) => s.trim()).filter((s) => s !== "");
    const live = [...r.fullMemberNames].sort().join("\u0000");
    const got = [...named].sort().join("\u0000");
    if (got !== live) {
      v.push({
        row: "k-full-member-list",
        law: "S2",
        detail: `the full-member list claims [${named.join(", ")}] but the live scan carries [${r.fullMemberNames.join(", ")}] — a stated membership is a copy of the data`,
      });
    }
  }
  // the E-board's category table: every row's three cells answer to the enrollment
  for (const m of text.matchAll(/^\| ([a-z][a-z-]*) \| (\d+) \| (\d+) \| (\d+) \|/gm)) {
    const cat = m[1]!;
    const live = r.categoryCells.get(cat);
    if (live === undefined) {
      v.push({
        row: `e-category-${cat}`,
        law: "S2",
        detail: `the category table carries a "${cat}" row the live registry does not file — an invented category`,
      });
      continue;
    }
    const cells: Array<[string, number, number]> = [
      ["mutant", Number.parseInt(m[2]!, 10), live.mutant],
      ["gate", Number.parseInt(m[3]!, 10), live.gate],
      ["booked", Number.parseInt(m[4]!, 10), live.booked],
    ];
    for (const [label, stated, expected] of cells) {
      if (stated !== expected) {
        v.push({
          row: `e-category-${cat}`,
          law: "S2",
          detail: `the ${cat} row's ${label} cell claims ${stated} but the live enrollment carries ${expected} — a stated count is a copy of the data`,
        });
      }
    }
  }
  return v;
}

/** S1 + S2 in one call — the renderer's pre-print check and the suite's
 * artifact gate both run exactly this. */
export function checkSelfReport(text: string, r: ProseReconciliation): SelfReportViolation[] {
  return [...checkBoardOrder(text), ...checkProseCounts(text, r)];
}

/** The artifact face's derivation: every input re-gathered LIVE from the
 * kernel's own data — this is what a tampered or stale out/reports artifact
 * answers to on every suite run, independent of the renderer. */
export async function liveProseReconciliation(): Promise<ProseReconciliation> {
  const registry = await loadLiveRegistry();
  const kills = runKillCensus();
  const killTally: Record<string, number> = {};
  for (const k of kills) killTally[k.actual] = (killTally[k.actual] ?? 0) + 1;
  const ws = scanWorkspace();
  const wg = await witnessGenealogy(registry, ENROLLMENT);
  const anchorKindTally: Record<string, number> = {};
  for (const a of ANCHOR_REGISTRY) anchorKindTally[a.kind] = (anchorKindTally[a.kind] ?? 0) + 1;
  const repairTally: Record<string, number> = {};
  for (const row of REPAIR_AUDIT) repairTally[row.verdict] = (repairTally[row.verdict] ?? 0) + 1;
  const perErrorTally: Record<string, number> = {};
  for (const p of PER_ERROR) perErrorTally[p.verdict] = (perErrorTally[p.verdict] ?? 0) + 1;
  return deriveProseReconciliation({
    registry,
    enrollment: ENROLLMENT,
    mutantCount: MUTANTS.length,
    batteryCount: runBattery().length,
    killTally,
    killCount: kills.length,
    familyRows: scanFamily().rows,
    registeredDivergenceCount: REGISTERED_DIVERGENCES.length,
    epochRepoCount: EPOCH_REPOS.length,
    unguardedTotal: ws.reduce((s, r) => s + (r.isPlatform ? 0 : r.unguardedEntries.length), 0),
    catchCensus: wg.census.catch,
    visitorKeys: registry.errors.filter((e) => catchAgentOf(e.wrong, e.category) === "visitor").map((e) => e.key),
    anchorKindTally,
    anchorTotal: ANCHOR_REGISTRY.length,
    repairTally,
    perErrorTally,
  });
}

/** The claim census the W-S witness line reports (its own numbers are
 * generated, never stated). */
export function claimCensus(r: ProseReconciliation): { sections: number; claims: number } {
  return {
    sections: BOARD_ORDER.length,
    claims: r.fixed.length + r.stringClaims.length + r.repoShares.size + r.categoryCells.size + 1,
  };
}
