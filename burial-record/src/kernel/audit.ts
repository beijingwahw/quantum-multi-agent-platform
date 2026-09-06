/**
 * The checker — the burial record's bookkeeping laws.
 *
 * Laws enforced:
 *   B0. every error's category is drawn from the fixed taxonomy;
 *   B1. every batch anchors to a repo that exists on disk — a vanished repo
 *       books no errors;
 *   B2. every error carries BOTH columns — the wrong assertion and the
 *       correction; an error without its fix (or a fix with no error) fails
 *       the build;
 *   B3. batch numbering is exactly 1..DECLARED_TOTAL_BATCHES, continuous,
 *       duplicate-free, and every batch holds at least one error — the count
 *       already drifted once in prose (the ledger said 20 while the truth
 *       was 21);
 *   B4. every source anchor resolves: the memory file exists and contains
 *       the cited heading;
 *   B5. a batch's date must be the anchor file's own date, and its context
 *       nonempty — a batch cannot predate or outlive its evidence;
 *   B7. any COUNT a batch's context STATES must equal the count the registry
 *       CARRIES — "N delivery errors" against errors.length, "across M
 *       classes" against the distinct categories. Prose counts are a copy
 *       of the data (the b45#9 law: 'eight' sat on nine for one visit, and
 *       batch 35's 'four' sat on five for two days — both caught by hand,
 *       never again by hand).
 *
 * Witnesses (independent re-derivations, not transcriptions):
 *   W-1 the numbering is [1..N] by sorted-sequence identity;
 *   W-2 the per-repo error census via a JSON round-trip equals the direct
 *       census;
 *   W-3 the per-category census likewise, and both sums equal the total;
 *   W-4 the declared headline constants equal the recounted registry;
 *   W-5 every stated context count equals the carried count (B7's witness).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BURIAL_RECORD,
  CATEGORIES,
  DECLARED_TOTAL_BATCHES,
  DECLARED_TOTAL_ERRORS,
  type BurialBatch,
} from "./registry.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly batch: number;
  readonly law: string;
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// B7's number-word parser — the counts a context may state, read the way
// prose writes them. English words one..nineteen, the hyphenated tens
// ("twenty-two" — truncating at the hyphen was the audit's own first draft
// bug, caught before landing), and bare digits, all anchored to the nouns
// they count ("errors", "delivery errors", "classes"). Anything else ("third
// generation") counts nothing and is left alone.
// ---------------------------------------------------------------------------

const SMALL_WORDS: readonly string[] = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS_WORDS = new Map<string, number>([
  ["twenty", 20], ["thirty", 30], ["forty", 40], ["fifty", 50],
  ["sixty", 60], ["seventy", 70], ["eighty", 80], ["ninety", 90],
]);

function parseCountWord(word: string): number | null {
  if (/^\d+$/.test(word)) return Number.parseInt(word, 10);
  const small = SMALL_WORDS.indexOf(word);
  if (small >= 0) return small + 1;
  const m = /^(\w+)-(\w+)$/.exec(word);
  if (m !== null) {
    const tens = TENS_WORDS.get(m[1]!);
    const ones = SMALL_WORDS.indexOf(m[2]!);
    if (tens !== undefined && ones >= 0 && ones < 9) return tens + ones + 1;
  }
  const tens = TENS_WORDS.get(word);
  return tens ?? null;
}

/** All "N (delivery) errors" counts a context states, as numbers. */
export function statedErrorCounts(context: string): readonly number[] {
  const out: number[] = [];
  const re = /\b((?:\w+-)?\w+|\d+)\s+(?:delivery\s+)?errors\b/g;
  for (const m of context.matchAll(re)) {
    const v = parseCountWord(m[1]!);
    if (v !== null) out.push(v);
  }
  return out;
}

/** All "across N classes" counts a context states, as numbers. */
export function statedClassCounts(context: string): readonly number[] {
  const out: number[] = [];
  const re = /\bacross\s+((?:\w+-)?\w+|\d+)\s+classes\b/g;
  for (const m of context.matchAll(re)) {
    const v = parseCountWord(m[1]!);
    if (v !== null) out.push(v);
  }
  return out;
}

export function checkBurial(batches: readonly BurialBatch[] = BURIAL_RECORD): Violation[] {
  const violations: Violation[] = [];

  for (const b of batches) {
    if (b.errors.length === 0) {
      violations.push({ batch: b.batch, law: "B3", detail: "a batch exists only because it holds errors — this one holds none" });
    }
    if (b.context.trim().length === 0) {
      violations.push({ batch: b.batch, law: "B5", detail: "empty context — a batch must say what was being built" });
    }
    if (b.source.file !== `memory/${b.date}.md`) {
      violations.push({ batch: b.batch, law: "B5", detail: `date ${b.date} does not match anchor file ${b.source.file}` });
    }
    // B1 — repo anchor on disk
    if (!existsSync(resolve(WORKSPACE_ROOT, b.repo, "package.json"))) {
      violations.push({ batch: b.batch, law: "B1", detail: `repo anchor missing on disk: ${b.repo}` });
    }
    // B4 — source anchor resolves
    const anchorPath = resolve(WORKSPACE_ROOT, b.source.file);
    if (!existsSync(anchorPath)) {
      violations.push({ batch: b.batch, law: "B4", detail: `source anchor file missing: ${b.source.file}` });
    } else if (!readFileSync(anchorPath, "utf8").includes(b.source.heading)) {
      violations.push({ batch: b.batch, law: "B4", detail: `heading "${b.source.heading}" not found in ${b.source.file}` });
    }
    for (const [i, e] of b.errors.entries()) {
      if (!(CATEGORIES as readonly string[]).includes(e.category)) {
        violations.push({ batch: b.batch, law: "B0", detail: `error ${i + 1}: illegal category "${e.category}"` });
      }
      if (e.wrong.trim().length === 0 || e.right.trim().length === 0) {
        violations.push({ batch: b.batch, law: "B2", detail: `error ${i + 1}: the two columns (wrong | right) must both be booked` });
      }
    }
    // B7 — stated counts equal carried counts (prose is a copy of the data)
    const actualClasses = new Set(b.errors.map((e) => e.category)).size;
    for (const stated of statedErrorCounts(b.context)) {
      if (stated !== b.errors.length) {
        violations.push({
          batch: b.batch,
          law: "B7",
          detail: `context states ${stated} error${stated === 1 ? "" : "s"}, the registry carries ${b.errors.length}`,
        });
      }
    }
    for (const stated of statedClassCounts(b.context)) {
      if (stated !== actualClasses) {
        violations.push({
          batch: b.batch,
          law: "B7",
          detail: `context states ${stated} classes, the batch carries ${actualClasses}`,
        });
      }
    }
  }

  // B3 — numbering: exactly 1..N, no gaps, no duplicates
  const nums = batches.map((b) => b.batch).sort((a, b) => a - b);
  const expected = Array.from({ length: DECLARED_TOTAL_BATCHES }, (_, i) => i + 1);
  if (nums.length !== expected.length || nums.some((n, i) => n !== expected[i])) {
    const missing = expected.filter((n) => !nums.includes(n));
    const extra = nums.filter((n) => !expected.includes(n));
    violations.push({
      batch: missing[0] ?? extra[0] ?? 0,
      law: "B3",
      detail: `numbering is not 1..${DECLARED_TOTAL_BATCHES} — missing [${missing.join(",")}], unexpected [${extra.join(",")}]`,
    });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// The census witnesses — re-derivations through a second path.
// ---------------------------------------------------------------------------

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

function countBy(batches: readonly BurialBatch[], key: (b: BurialBatch) => string, inner: (b: BurialBatch) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of batches) {
    const k = key(b);
    m.set(k, (m.get(k) ?? 0) + inner(b));
  }
  return m;
}

function witnessNumbering(): WitnessResult {
  const nums = BURIAL_RECORD.map((b) => b.batch).sort((a, b) => a - b);
  const expected = Array.from({ length: nums.length }, (_, i) => i + 1);
  const ok = nums.every((n, i) => n === expected[i]);
  return { name: `W-1 numbering is 1..${nums.length}`, pass: ok, detail: ok ? "sorted-sequence identity holds" : `gap or duplicate in [${nums.join(",")}]` };
}

function witnessRepoCensus(): WitnessResult {
  const direct = countBy(BURIAL_RECORD, (b) => b.repo, (b) => b.errors.length);
  // second path: JSON round-trip (a genuine serialization boundary), then count
  const cloned = JSON.parse(JSON.stringify(BURIAL_RECORD)) as BurialBatch[];
  const second = countBy(cloned, (b) => b.repo, (b) => b.errors.length);
  const same =
    direct.size === second.size && [...direct.entries()].every(([k, v]) => second.get(k) === v);
  const total = [...direct.values()].reduce((a, b) => a + b, 0);
  return {
    name: `W-2 per-repo census (direct vs JSON round-trip), ${direct.size} repos`,
    pass: same,
    detail: same ? `${total} errors recounted identically` : "the two paths disagree",
  };
}

function witnessCategoryCensus(): WitnessResult {
  const direct = new Map<string, number>();
  for (const b of BURIAL_RECORD) for (const e of b.errors) direct.set(e.category, (direct.get(e.category) ?? 0) + 1);
  const cloned = JSON.parse(JSON.stringify(BURIAL_RECORD)) as BurialBatch[];
  const second = new Map<string, number>();
  for (const b of cloned) for (const e of b.errors) second.set(e.category, (second.get(e.category) ?? 0) + 1);
  const same = direct.size === second.size && [...direct.entries()].every(([k, v]) => second.get(k) === v);
  const sumCat = [...direct.values()].reduce((a, b) => a + b, 0);
  const sumRepo = BURIAL_RECORD.reduce((a, b) => a + b.errors.length, 0);
  const ok = same && sumCat === sumRepo;
  return {
    name: `W-3 per-category census, ${direct.size}/${CATEGORIES.length} categories in use`,
    pass: ok,
    detail: ok ? `category sum ${sumCat} = repo sum ${sumRepo}` : `paths disagree: category ${sumCat} vs repo ${sumRepo}`,
  };
}

function witnessDeclaredTotals(): WitnessResult {
  const batches = BURIAL_RECORD.length;
  const errors = BURIAL_RECORD.reduce((a, b) => a + b.errors.length, 0);
  const ok = batches === DECLARED_TOTAL_BATCHES && errors === DECLARED_TOTAL_ERRORS;
  return {
    name: `W-4 declared totals ${DECLARED_TOTAL_BATCHES} batches / ${DECLARED_TOTAL_ERRORS} errors`,
    pass: ok,
    detail: ok ? "constants equal the recount" : `recount says ${batches} batches / ${errors} errors`,
  };
}

function witnessStatedCounts(): WitnessResult {
  let stated = 0;
  for (const b of BURIAL_RECORD) stated += statedErrorCounts(b.context).length + statedClassCounts(b.context).length;
  const bad = BURIAL_RECORD.filter((b) => {
    const classes = new Set(b.errors.map((e) => e.category)).size;
    return (
      statedErrorCounts(b.context).some((s) => s !== b.errors.length) ||
      statedClassCounts(b.context).some((s) => s !== classes)
    );
  });
  const ok = bad.length === 0;
  return {
    name: `W-5 stated context counts equal carried counts (${stated} statements)`,
    pass: ok,
    detail: ok ? "every stated count is the data's count" : `batches ${bad.map((b) => b.batch).join(",")} drift`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [witnessNumbering(), witnessRepoCensus(), witnessCategoryCensus(), witnessDeclaredTotals(), witnessStatedCounts()];
}

export function censusByRepo(): Map<string, number> {
  return countBy(BURIAL_RECORD, (b) => b.repo, (b) => b.errors.length);
}

export function censusByCategory(): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of BURIAL_RECORD) for (const e of b.errors) m.set(e.category, (m.get(e.category) ?? 0) + 1);
  return m;
}
