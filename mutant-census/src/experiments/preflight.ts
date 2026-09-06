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

function cardText(cards: readonly PreflightCard[]): string {
  const out: string[] = [];
  out.push("# THE PRE-FLIGHT CARD — the genealogy, forward-facing\n");
  out.push(
    "> Before a delivery: what is this repo historically at risk for? Every family sighted in the repo, recency-ranked, each with its hold and the latest member's correction — the rule to run. Coverage is law (G5): every family sighted in the last ten batches is on its repo's card.\n",
  );
  for (const card of cards) {
    if (card.rows.length === 0) continue;
    out.push(`\n## ${card.repo}\n`);
    out.push("| family | sightings | latest | held by | the rule (the latest correction) |");
    out.push("| --- | --- | --- | --- | --- |");
    for (const r of card.rows) {
      out.push(`| ${r.family} | ${r.sightings} | ${r.latestKey} (b${r.latestBatch}) | ${r.hold} | ${r.rule} |`);
    }
  }
  return out.join("\n");
}

async function main(): Promise<void> {
  const registry = await loadLiveRegistry();
  const repos = [...new Set(registry.errors.map((e) => e.repo))];
  const cards = repos.map((r) => buildRiskCard(r, registry.errors));
  const problems = checkPreflightCoverage(cards, registry.errors, registry.batchCount);
  if (problems.length > 0) {
    throw new Error(`the pre-flight card is illegal — refusing to print it:\n${problems.map((p) => `- ${p}`).join("\n")}`);
  }
  const path = writeReport("the-preflight-card.md", cardText(cards));
  const watched = new Set(cards.flatMap((c) => c.rows.map((r) => r.family))).size;
  console.log(`rendered ${path} (${cards.length} repos, ${watched} families watched)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
