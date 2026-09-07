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
 *       classes" against the distinct categories, in ENGLISH OR CHINESE
 *       (v0.4.0's unified engine: a count is a count in either tongue).
 *       Prose counts are a copy of the data (the b45#9 law: 'eight' sat on
 *       nine for one visit, and batch 35's 'four' sat on five for two days
 *       — both caught by hand, never again by hand);
 *   B8. the MEMORY side of the same law: the lesson heading's established
 *       phrase "交付期X处(Y类)" — or its English twin "N delivery errors
 *       (across M classes)" — must equal the batch the registry carries
 *       (b45#9 slipped through exactly here: the registry was reconciled,
 *       the memory prose was not); only the established phrases parse,
 *       free prose may count anything.
 *   B9. (v0.5.0) the memory substrate's STRUCTURE is law: every cited daily
 *       note is checked for (a) duplicated visit headings (the same visit
 *       number headlining two sections — the insertion-duplication family),
 *       (b) repeated-label signature lines ("- **X**：- **X**：" — a prefix
 *       pasted twice, enrolled three times in one day and prevented never),
 *       (c) orphaned heading tails (a line opening with "（访客令牌" — the
 *       surviving fragment of a heading swallowed by an insertion), and
 *       (d) duplicated lesson headings (关键经验（第N批 twice). B4 proves the
 *       cited heading EXISTS; B9 proves the file around it is STRUCTURALLY
 *       WHOLE — the ledger's evidence base guards itself.
 *
 * Witnesses (independent re-derivations, not transcriptions):
 *   W-1 the numbering is [1..N] by sorted-sequence identity;
 *   W-2 the per-repo error census via a JSON round-trip equals the direct
 *       census;
 *   W-3 the per-category census likewise, and both sums equal the total;
 *   W-4 the declared headline constants equal the recounted registry;
 *   W-5 every stated context count equals the carried count (B7's witness);
 *   W-6 every stated lesson-heading count equals the carried count (B8's).
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

function parseCountWord(word: string | undefined): number | null {
  if (word === undefined) return null;
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

/** All "N (delivery) errors" counts a context states, as numbers — English
 * or Chinese (v0.4.0: a count is a count in either tongue; the registry's
 * contexts are English today, the extension is law for the day they are
 * not). */
export function statedErrorCounts(context: string): readonly number[] {
  const out: number[] = [];
  const re = /\b((?:\w+-)?\w+|\d+)\s+(?:delivery\s+)?errors\b|([一二三四五六七八九十两]+|\d+)\s*处/g;
  for (const m of context.matchAll(re)) {
    const v = parseAnyCount(m[1] ?? m[2]!);
    if (v !== null) out.push(v);
  }
  return out;
}

/** All stated class counts — English "across M classes" or Chinese "M类". */
export function statedClassCounts(context: string): readonly number[] {
  const out: number[] = [];
  const re = /\bacross\s+((?:\w+-)?\w+|\d+)\s+classes\b|([一二三四五六七八九十两]+|\d+)\s*类/g;
  for (const m of context.matchAll(re)) {
    const v = parseAnyCount(m[1] ?? m[2]!);
    if (v !== null) out.push(v);
  }
  return out;
}

/** The unified count-word engine: digits, English words, Chinese numerals. */
export function parseAnyCount(word: string): number | null {
  return parseCountWord(word) ?? parseCnCount(word);
}

// ---------------------------------------------------------------------------
// B8's parser — the lesson heading's established count phrase, in Chinese
// numerals: 交付期X处 and the optional Y类. Digits, 一..九, and the 十
// compounds (十X, X十, X十Y) all parse; 两 counts as 2; anything else is
// left to the prose it lives in.
// ---------------------------------------------------------------------------

const CN_DIGITS = new Map<string, number>([
  ["一", 1], ["二", 2], ["两", 2], ["三", 3], ["四", 4],
  ["五", 5], ["六", 6], ["七", 7], ["八", 8], ["九", 9],
]);

export function parseCnCount(word: string | undefined): number | null {
  if (word === undefined) return null;
  if (/^\d+$/.test(word)) return Number.parseInt(word, 10);
  if (word === "十") return 10;
  if (word.startsWith("十")) {
    const ones = CN_DIGITS.get(word.slice(1));
    return ones === undefined ? null : 10 + ones;
  }
  if (word.endsWith("十")) {
    const tens = CN_DIGITS.get(word.slice(0, -1));
    return tens === undefined ? null : tens * 10;
  }
  const tenIdx = word.indexOf("十");
  if (tenIdx > 0 && tenIdx < word.length - 1) {
    const tens = CN_DIGITS.get(word.slice(0, tenIdx));
    const ones = CN_DIGITS.get(word.slice(tenIdx + 1));
    if (tens !== undefined && ones !== undefined) return tens * 10 + ones;
  }
  return CN_DIGITS.get(word) ?? null;
}

/** The heading line's stated delivery counts, in either language: the
 * Chinese established phrase 交付期X处(Y类), or the English "N delivery
 * errors (across M classes)"; null where not stated. */
export function statedDeliveryCounts(headingLine: string): { errors: number | null; classes: number | null } {
  const m = /交付期\s*([一二三四五六七八九十两\d]+)\s*处(?:\s*([一二三四五六七八九十两\d]+)\s*类)?/.exec(headingLine);
  if (m !== null) {
    // undefined groups parse to null — the params are widened so no assertion
    // and no condition is needed (tsc strict and the lint type-env agree)
    return { errors: parseCnCount(m[1]), classes: parseCnCount(m[2]) };
  }
  const en = /\b((?:\w+-)?\w+|\d+)\s+delivery\s+errors(?:\s+across\s+((?:\w+-)?\w+|\d+)\s+classes)?/.exec(headingLine);
  if (en !== null) {
    return { errors: parseCountWord(en[1]), classes: parseCountWord(en[2]) };
  }
  return { errors: null, classes: null };
}

function actualClassesOf(b: BurialBatch): number {
  return new Set(b.errors.map((e) => e.category)).size;
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
    // B4 — source anchor resolves; B8 — the lesson heading's stated counts
    const anchorPath = resolve(WORKSPACE_ROOT, b.source.file);
    if (!existsSync(anchorPath)) {
      violations.push({ batch: b.batch, law: "B4", detail: `source anchor file missing: ${b.source.file}` });
    } else {
      const anchorText = readFileSync(anchorPath, "utf8");
      const headingIdx = anchorText.indexOf(b.source.heading);
      if (headingIdx < 0) {
        violations.push({ batch: b.batch, law: "B4", detail: `heading "${b.source.heading}" not found in ${b.source.file}` });
      } else {
        // B8 — the memory-side count law: the lesson heading's established
        // phrase "交付期X处(Y类)" must equal the batch the registry carries
        // (b45#9 slipped through exactly here: the registry was fixed and
        // the memory prose was not). Only the established phrase is parsed —
        // free prose may count anything.
        const lineEnd = anchorText.indexOf("\n", headingIdx);
        const headingLine = anchorText.slice(headingIdx, lineEnd < 0 ? anchorText.length : lineEnd);
        const delivery = statedDeliveryCounts(headingLine);
        if (delivery.errors !== null && delivery.errors !== b.errors.length) {
          violations.push({
            batch: b.batch,
            law: "B8",
            detail: `the lesson heading states ${delivery.errors} 处, the registry carries ${b.errors.length} errors`,
          });
        }
        if (delivery.classes !== null && delivery.classes !== actualClassesOf(b)) {
          violations.push({
            batch: b.batch,
            law: "B8",
            detail: `the lesson heading states ${delivery.classes} 类, the batch carries ${actualClassesOf(b)} classes`,
          });
        }
      }
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

  // B9 — the memory substrate's structure (v0.5.0): every cited daily note,
  // read once, checked whole — duplicated visit headings, repeated-label
  // signatures, orphaned heading tails, duplicated lesson headings
  const citedFiles = new Set(batches.map((b) => b.source.file));
  for (const file of citedFiles) {
    const notePath = resolve(WORKSPACE_ROOT, file);
    if (!existsSync(notePath)) continue; // B4 already convicted the missing file
    for (const m of memoryStructureViolations(readFileSync(notePath, "utf8"))) {
      violations.push({ batch: 0, law: m.law, detail: `${file}: ${m.detail}` });
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
// B9's structure parser — pure over the note text so the firing range can
// inject forged structure and convict by name.
// ---------------------------------------------------------------------------

/** The structural invariants of a daily note (law B9). Pure: no filesystem.
 * Deliberately NARROW signatures: a visit may legitimately carry several
 * sections (双段 visits, addenda, name cards) — visit-number "uniqueness" is
 * NOT an invariant and its first draft false-convicted the historical
 * two-section visits; the laws below hold only what is true. */
export function memoryStructureViolations(text: string): Array<{ law: string; detail: string }> {
  const v: Array<{ law: string; detail: string }> = [];
  const lines = text.split("\n");
  const seenHeadings = new Map<string, number>();
  const seenLessons = new Map<string, number>();
  for (const [idx, line] of lines.entries()) {
    // (a) an EXACT-duplicate full heading line — the copy-paste double
    if (line.startsWith("## ") && line.trim().length > 3) {
      const first = seenHeadings.get(line);
      if (first !== undefined) {
        v.push({ law: "B9", detail: `the heading line appears VERBATIM twice (lines ${first} and ${idx + 1}) — a copy-paste double` });
      } else {
        seenHeadings.set(line, idx + 1);
      }
    }
    // (b) the repeated-label signature — "- **X**：- **X**："
    if (/^- \*\*[^*]+\*\*：- \*\*/.test(line)) {
      v.push({ law: "B9", detail: `line ${idx + 1} carries the repeated-label signature ("**：- **") — a prefix pasted twice` });
    }
    // (c) the orphaned heading tail — a paragraph line opening with the
    // visitor-token parenthesis is the surviving fragment of a swallowed
    // heading (healthy notes carry the phrase only inside ## or - lines)
    if (line.startsWith("（访客令牌")) {
      v.push({ law: "B9", detail: `line ${idx + 1} opens with an orphaned heading tail (（访客令牌…) — a heading was swallowed by an insertion` });
    }
    // (d) duplicated lesson headings — 关键经验（第N批
    const lesson = /关键经验（第([\d一两二三四五六七八九十]+)批/.exec(line);
    if (lesson) {
      const key = lesson[1]!;
      const first = seenLessons.get(key);
      if (first !== undefined) {
        v.push({ law: "B9", detail: `lesson heading 关键经验（第${key}批 appears twice (lines ${first} and ${idx + 1})` });
      } else {
        seenLessons.set(key, idx + 1);
      }
    }
  }
  return v;
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

function witnessHeadingCounts(): WitnessResult {
  let stated = 0;
  const problems: string[] = [];
  for (const b of BURIAL_RECORD) {
    const p = resolve(WORKSPACE_ROOT, b.source.file);
    if (!existsSync(p)) continue; // B4 owns the missing-file case
    const text = readFileSync(p, "utf8");
    const idx = text.indexOf(b.source.heading);
    if (idx < 0) continue; // B4 owns the missing-heading case
    const lineEnd = text.indexOf("\n", idx);
    const line = text.slice(idx, lineEnd < 0 ? text.length : lineEnd);
    const d = statedDeliveryCounts(line);
    if (d.errors === null) continue;
    stated++;
    if (d.errors !== b.errors.length) problems.push(`b${b.batch}: heading states ${d.errors} 处, carries ${b.errors.length}`);
    if (d.classes !== null && d.classes !== actualClassesOf(b)) {
      problems.push(`b${b.batch}: heading states ${d.classes} 类, carries ${actualClassesOf(b)}`);
    }
  }
  return {
    name: `W-6 stated lesson-heading counts equal carried counts (${stated} statements)`,
    pass: problems.length === 0,
    detail: problems.length === 0 ? "the memory side matches the registry side" : problems.join("; "),
  };
}

export function runWitnesses(): WitnessResult[] {
  return [witnessNumbering(), witnessRepoCensus(), witnessCategoryCensus(), witnessDeclaredTotals(), witnessStatedCounts(), witnessHeadingCounts()];
}

export function censusByRepo(): Map<string, number> {
  return countBy(BURIAL_RECORD, (b) => b.repo, (b) => b.errors.length);
}

export function censusByCategory(): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of BURIAL_RECORD) for (const e of b.errors) m.set(e.category, (m.get(e.category) ?? 0) + 1);
  return m;
}
