/**
 * THE PRE-FLIGHT CARD — v0.6.0, the genealogy turned forward-facing: before
 * a delivery, what is this repo historically AT RISK for? Every family
 * sighted in the repo, ranked by recency then frequency, each with its
 * resolution hold and the LATEST member's correction (the rule, from the
 * registry's own right column). The ledger learned (G-board); the card
 * predicts (G5): every family with a sighting in the last ten batches MUST
 * appear on the card for its repo — the coverage is law, checked live.
 *
 * Entry guard (house law since batch 21): rendering fires only when this
 * file is the invoked program.
 */
import { pathToFileURL } from "node:url";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { loadLiveRegistry, type LiveBurialError } from "../kernel/bridge.js";
import { FAMILY_RESOLUTIONS, familyOf } from "../kernel/genealogy.js";
import { writeReport } from "./report.js";

export interface RiskRow {
  readonly family: string;
  readonly sightings: number;
  readonly latestBatch: number;
  readonly latestKey: string;
  readonly hold: string;
  readonly rule: string; // the latest member's correction, the practice to run
}

export interface PreflightCard {
  readonly repo: string;
  readonly rows: readonly RiskRow[];
}

/** The risk card for one repo: its families, recency-ranked. */
export function buildRiskCard(repo: string, errors: readonly LiveBurialError[]): PreflightCard {
  const byFamily = new Map<string, { sightings: number; latest: LiveBurialError }>();
  for (const e of errors) {
    if (e.repo !== repo) continue;
    const fam = familyOf(e.wrong, e.category);
    const cur = byFamily.get(fam);
    if (cur === undefined) {
      byFamily.set(fam, { sightings: 1, latest: e });
    } else {
      cur.sightings++;
      if (e.batch > cur.latest.batch || (e.batch === cur.latest.batch && e.index > cur.latest.index)) cur.latest = e;
    }
  }
  const rows: RiskRow[] = [...byFamily.entries()]
    .map(([family, v]) => ({
      family,
      sightings: v.sightings,
      latestBatch: v.latest.batch,
      latestKey: v.latest.key,
      hold: FAMILY_RESOLUTIONS.find((r) => r.family === family)?.holds ?? "UNRESOLVED",
      rule: v.latest.right,
    }))
    .sort((a, b) => b.latestBatch - a.latestBatch || b.sightings - a.sightings || a.family.localeCompare(b.family));
  return { repo, rows };
}

/** G5 — the coverage law: every family with a sighting in the last ten
 * batches must appear on its repo's card. A family the card forgot is a
 * conviction. */
export function checkPreflightCoverage(
  cards: readonly PreflightCard[],
  errors: readonly LiveBurialError[],
  totalBatches: number,
): string[] {
  const problems: string[] = [];
  const horizon = totalBatches - 9;
  for (const e of errors) {
    if (e.batch < horizon) continue;
    const fam = familyOf(e.wrong, e.category);
    const card = cards.find((c) => c.repo === e.repo);
    if (card === undefined) {
      problems.push(`${e.repo}: no card at all, but ${e.key} (${fam}) landed in the last ten batches`);
      continue;
    }
    if (!card.rows.some((r) => r.family === fam)) {
      problems.push(`${e.repo}: the card omits ${fam} — ${e.key} landed at b${e.batch}`);
    }
  }
  return problems;
}

/** The hot families on a card — sighted within the last three batches.
 * The delivery protocol's step 0: run the card for the repo you are about
 * to build in; the hot rows are the ones to read first. */
export function hotFamilies(rows: readonly RiskRow[], totalBatches: number): readonly RiskRow[] {
  return rows.filter((r) => r.latestBatch > totalBatches - 3);
}

// ---------------------------------------------------------------------------
// The reports-freshness signal (v0.22.0) — the repro-no-op risk family made
// visible on the card. This delivery wave convicted sibling repos of SILENT
// repro no-ops (reports not re-rendered after the sources moved); the signal
// is pure disk arithmetic: the newest src-tree mtime against the newest
// report mtime. It predicts, it does not gate — the census's own report face
// is the gated one (S2 re-derives the artifact on every suite run).
// ---------------------------------------------------------------------------

export type FreshnessVerdict = "FRESH" | "STALE" | "NO-REPORTS" | "NO-SRC";

/** Pure: the verdict of one repo's (newest src mtime, newest report mtime). */
export function freshnessVerdict(srcMs: number | null, reportMs: number | null): FreshnessVerdict {
  if (srcMs === null) return "NO-SRC";
  if (reportMs === null) return "NO-REPORTS";
  return srcMs > reportMs ? "STALE" : "FRESH";
}

export interface ReportsFreshness {
  readonly repo: string;
  readonly reportCount: number;
  readonly newestReportMs: number | null;
  readonly newestSrcMs: number | null;
  readonly verdict: FreshnessVerdict;
}

function newestMtime(dir: string): number | null {
  if (!existsSync(dir)) return null;
  let newest: number | null = null;
  const walk = (d: string): void => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = resolve(d, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      const ms = statSync(full).mtimeMs;
      if (newest === null || ms > newest) newest = ms;
    }
  };
  walk(dir);
  return newest;
}

/** The live freshness of one repo's reports, gathered from disk. */
export function reportsFreshness(repo: string, root = resolve(process.cwd(), "..")): ReportsFreshness {
  let reportCount = 0;
  let newestReportMs: number | null = null;
  const reportDir = resolve(root, repo, "out", "reports");
  if (existsSync(reportDir)) {
    const names = readdirSync(reportDir).filter((f) => f.endsWith(".md"));
    reportCount = names.length;
    for (const n of names) {
      const ms = statSync(resolve(reportDir, n)).mtimeMs;
      if (newestReportMs === null || ms > newestReportMs) newestReportMs = ms;
    }
  }
  const newestSrcMs = newestMtime(resolve(root, repo, "src"));
  return { repo, reportCount, newestReportMs, newestSrcMs, verdict: freshnessVerdict(newestSrcMs, newestReportMs) };
}

function freshnessText(f: ReportsFreshness): string {
  const iso = (ms: number | null): string => (ms === null ? "-" : new Date(ms).toISOString());
  switch (f.verdict) {
    case "NO-SRC":
      return "no src tree on disk — nothing to render against";
    case "NO-REPORTS":
      return `${f.reportCount} reports on disk — no render exists to go stale (is repro a registered debt here?)`;
    case "STALE":
      return `${f.reportCount} reports on disk; newest render ${iso(f.newestReportMs)}; src tree newest ${iso(f.newestSrcMs)} — STALE: sources moved after the last render (the repro-no-op face; re-run repro before closing)`;
    default:
      return `${f.reportCount} reports on disk; newest render ${iso(f.newestReportMs)}; src tree newest ${iso(f.newestSrcMs)} — FRESH (the newest render postdates every source)`;
  }
}

function cardText(cards: readonly PreflightCard[], singleRepo = false, totalBatches = 0): string {
  const out: string[] = [];
  out.push("# THE PRE-FLIGHT CARD — the genealogy, forward-facing\n");
  out.push(
    "> DELIVERY PROTOCOL, STEP 0: `npm run preflight -- <repo>` before building in a repo — the rules below are the mistakes that repo already made. Coverage is law (G5): every family sighted in the last ten batches is on its repo's card" +
      (singleRepo ? "; this run prints ONE repo, hot families (sighted within the last three batches) first" : "") +
      ".\n",
  );
  for (const card of cards) {
    if (card.rows.length === 0) continue;
    out.push(`\n## ${card.repo}\n`);
    const hot = totalBatches > 0 ? hotFamilies(card.rows, totalBatches) : [];
    if (hot.length > 0) {
      out.push(
        `HOT (${hot.length} famil${hot.length === 1 ? "y" : "ies"} sighted within the last three batches): ${hot.map((r) => r.family).join(", ")}\n`,
      );
    }
    out.push("| family | sightings | latest | held by | the rule (the latest correction) |");
    out.push("| --- | --- | --- | --- | --- |");
    for (const r of card.rows) {
      out.push(`| ${r.family} | ${r.sightings} | ${r.latestKey} (b${r.latestBatch}) | ${r.hold} | ${r.rule} |`);
    }
    out.push(`\nReports freshness (the repro-no-op face, v0.22.0): ${freshnessText(reportsFreshness(card.repo))}`);
  }
  return out.join("\n");
}

async function main(): Promise<void> {
  const registry = await loadLiveRegistry();
  const repos = [...new Set(registry.errors.map((e) => e.repo))];
  const target = process.argv[2];
  // the coverage law runs over the FULL deck every time, whatever is printed
  const allCards = repos.map((r) => buildRiskCard(r, registry.errors));
  const problems = checkPreflightCoverage(allCards, registry.errors, registry.batchCount);
  if (problems.length > 0) {
    throw new Error(`the pre-flight card is illegal — refusing to print it:\n${problems.map((p) => `- ${p}`).join("\n")}`);
  }
  if (target !== undefined && !repos.includes(target)) {
    throw new Error(`no card for '${target}' — the registry carries no errors sighted there`);
  }
  const cards = target !== undefined ? [buildRiskCard(target, registry.errors)] : allCards;
  const path = writeReport(
    target !== undefined ? `the-preflight-card-${target.replace(/[/\\]/g, "-")}.md` : "the-preflight-card.md",
    cardText(cards, target !== undefined, registry.batchCount),
  );
  const watched = new Set(cards.flatMap((c) => c.rows.map((r) => r.family))).size;
  console.log(`rendered ${path} (${cards.length} repo(s), ${watched} families watched)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
