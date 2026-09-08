/**
 * The checker — claim #17 as a build gate.
 *
 * Laws enforced:
 *   L0. every verdict tag is one of the legal vocabulary (ledger.ts, single-sourced);
 *   L1. a row quoting a number column must book a cost column;
 *   L2. a row without numbers must be OPEN and say so in its cost column;
 *   L3. every atlas anchor id exists in bqp-map/src/atlas/entries.ts;
 *   L4. every verdict tag appears as a verdict in the atlas;
 *   L5. every appeal command exists in the target repo's package.json scripts
 *       (a malformed or non-table scripts file is BOOKED here, never a crash);
 *   L6. the five arithmetic witnesses hold (independent re-derivations).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LEDGER, LEGAL_VERDICTS, type LedgerRow } from "./ledger.js";

const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly claimId: string;
  readonly law: string;
  readonly detail: string;
}

/** L1/L2's own reading of a column, single-sourced: a column that is only
 * whitespace quotes nothing and books nothing. The renderer counts numbered
 * rows through the SAME predicates (render.ts), so the census the reader
 * sees cannot diverge from the law the checker enforces. */
export function quotesNumbers(row: Pick<LedgerRow, "numberColumn">): boolean {
  return row.numberColumn.trim().length > 0;
}

/** The cost-column twin of quotesNumbers — L1's other operand. */
export function booksCost(row: Pick<LedgerRow, "costColumn">): boolean {
  return row.costColumn.trim().length > 0;
}

export function checkLedger(rows: readonly LedgerRow[] = LEDGER, root: string = WORKSPACE_ROOT): Violation[] {
  const violations: Violation[] = [];
  const atlasPath = resolve(root, "bqp-map", "src", "atlas", "entries.ts");
  if (!existsSync(atlasPath)) {
    violations.push({ claimId: "-", law: "L3", detail: `atlas file missing: ${atlasPath}` });
    return violations;
  }
  const atlas = readFileSync(atlasPath, "utf8");

  for (const row of rows) {
    if (!LEGAL_VERDICTS.includes(row.verdict)) {
      violations.push({ claimId: row.claimId, law: "L0", detail: `illegal verdict ${row.verdict}` });
    }
    // L1/L2 — the conduct rule itself, through the single-sourced predicates
    const hasNumbers = quotesNumbers(row);
    const hasCost = booksCost(row);
    if (hasNumbers && !hasCost) {
      violations.push({ claimId: row.claimId, law: "L1", detail: "quotes numbers without booking a cost" });
    }
    if (!hasNumbers && row.verdict !== "OPEN") {
      violations.push({ claimId: row.claimId, law: "L2", detail: `no numbers but verdict ${row.verdict} (must be OPEN or carry numbers)` });
    }
    // L3 — atlas anchor
    if (!atlas.includes(`id: "${row.atlasRow}"`)) {
      violations.push({ claimId: row.claimId, law: "L3", detail: `atlas row id "${row.atlasRow}" not found` });
    }
    // L4 — verdict tag exists in the atlas
    if (!atlas.includes(`verdict: "${row.verdict}"`)) {
      violations.push({ claimId: row.claimId, law: "L4", detail: `verdict tag ${row.verdict} absent from atlas` });
    }
    // L5 — appeal repo + command (the file is VALIDATED, never trusted: a
    // malformed package.json or a non-table scripts member is booked as a
    // violation with the reason attached — the checker does not crash on
    // smuggled inputs)
    const pkgPath = resolve(root, row.appealRepo, "package.json");
    if (!existsSync(pkgPath)) {
      violations.push({ claimId: row.claimId, law: "L5", detail: `appeal repo missing: ${row.appealRepo}` });
    } else {
      const read = readPackageScripts(pkgPath);
      if (!read.ok) {
        violations.push({ claimId: row.claimId, law: "L5", detail: `appeal package.json of ${row.appealRepo} unusable: ${read.reason}` });
      } else if (!read.scripts.has(row.appealCommand)) {
        violations.push({ claimId: row.claimId, law: "L5", detail: `appeal command "${row.appealCommand}" not a script of ${row.appealRepo}` });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// The L5 read — the appeal repo's package.json, parsed without a cast.
// ---------------------------------------------------------------------------

export type ScriptsRead =
  | { readonly ok: true; readonly scripts: ReadonlyMap<string, string> }
  | { readonly ok: false; readonly reason: string };

/** Reads one appeal repo's scripts table without trusting the file: malformed
 * JSON, an unreadable file, or a non-object root/scripts member come back as
 * a named reason the caller books as an L5 violation — nothing throws past
 * this function. A scripts entry whose value is not a string is not a
 * callable script and does not count (npm itself rejects such manifests). */
export function readPackageScripts(pkgPath: string): ScriptsRead {
  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf8");
  } catch (err) {
    return { ok: false, reason: `unreadable (${errorMessage(err)})` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `malformed JSON (${errorMessage(err)})` };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: `root is ${parsed === null ? "null" : typeof parsed}, not an object` };
  }
  if (!("scripts" in parsed) || parsed.scripts === undefined) {
    return { ok: true, scripts: new Map<string, string>() };
  }
  if (typeof parsed.scripts !== "object" || parsed.scripts === null) {
    return { ok: false, reason: `scripts is ${typeof parsed.scripts}, not a table` };
  }
  const table = new Map<string, string>();
  for (const [name, value] of Object.entries(parsed.scripts)) {
    if (typeof value === "string") table.set(name, value);
  }
  return { ok: true, scripts: table };
}

/** The typed face of a caught unknown — its message, or its string form. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// L6 — the arithmetic witnesses: independent re-derivations, not transcriptions.
// ---------------------------------------------------------------------------

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** W-A: the ledger identity 1/P_success = N/t, exact rational arithmetic */
function witnessLedgerIdentity(): WitnessResult {
  for (const [N, t] of [
    [256, 1],
    [256, 7],
    [1024, 37],
  ] as const) {
    const p = t / N;
    if (Math.abs(1 / p - N / t) > 1e-12) {
      return { name: "W-A ledger identity", pass: false, detail: `N=${N} t=${t}: 1/P != N/t` };
    }
  }
  return { name: "W-A ledger identity 1/P = N/t", pass: true, detail: "exact on the grid" };
}

/** W-B: the restart-optimality threshold, solved by bisection on
 *  sin^2(3th) = 2 sin^2(th)  <=>  s^2 = (3-sqrt(2))/4 */
function witnessThreshold(): WitnessResult {
  const f = (c: number): number => Math.sin(3 * Math.asin(Math.sqrt(c))) ** 2 - 2 * c;
  let lo = 0.2;
  let hi = 0.5;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const solved = (lo + hi) / 2;
  const closed = (3 - Math.SQRT2) / 4;
  const ok = Math.abs(solved - closed) < 1e-12;
  return { name: "W-B threshold density (3-sqrt(2))/4", pass: ok, detail: `bisection ${solved.toFixed(12)} vs closed ${closed.toFixed(12)}` };
}

/** W-C: the 256-strategy classical CHSH census, independent reimplementation.
 * The strategy bit-strings are fixed-length tuples, so every access is
 * cast-free under noUncheckedIndexedAccess; the arithmetic is unchanged,
 * operation for operation. */
function witnessCensus(): WitnessResult {
  const bits = (idx: number): readonly [number, number, number, number] => {
    const s = (b: number): 1 | -1 => (b === 1 ? 1 : -1);
    return [s((idx >> 3) & 1), s((idx >> 2) & 1), s((idx >> 1) & 1), s(idx & 1)];
  };
  let maxAbs = 0;
  for (let i = 0; i < 16; i++) {
    const [a0, a1, a2, a3] = bits(i);
    for (let j = 0; j < 16; j++) {
      const [b0, b1, b2, b3] = bits(j);
      const e = (ax0: number, ax1: number, by0: number, by1: number): number => (ax0 * by0 + ax1 * by1) / 2;
      const S = e(a0, a1, b0, b1) + e(a0, a1, b2, b3) + e(a2, a3, b0, b1) - e(a2, a3, b2, b3);
      if (Math.abs(S) > maxAbs) maxAbs = Math.abs(S);
    }
  }
  const ok = Math.abs(maxAbs - 2) < 1e-12;
  return { name: "W-C classical census cap = 2", pass: ok, detail: `max |S| over 256 strategies = ${maxAbs.toFixed(12)}` };
}

/** W-D: Grover restart optimum E* = min_k (k+1)/sin^2((2k+1)th) at N=256, t=1 */
function witnessEStar(): WitnessResult {
  const N = 256;
  const t = 1;
  const th = Math.asin(Math.sqrt(t / N));
  let best = Number.POSITIVE_INFINITY;
  for (let k = 0; k <= 40; k++) {
    const p = Math.sin((2 * k + 1) * th) ** 2;
    if (p <= 0) continue;
    best = Math.min(best, (k + 1) / p);
  }
  const ok = Math.abs(best - 11.619) < 1e-2;
  return { name: "W-D Grover E* at (256,1) ~ 11.619", pass: ok, detail: `recomputed ${best.toFixed(4)}` };
}

/** W-E: the h2 reconciliation anchor at QBER = 0.025 (the p=0.95 row) */
function witnessH2(): WitnessResult {
  const q = 0.025;
  const h = -q * Math.log2(q) - (1 - q) * Math.log2(1 - q);
  const ok = Math.abs(h - 0.168660931) < 1e-6;
  return { name: "W-E h2(0.025) ~ 0.168661", pass: ok, detail: `recomputed ${h.toFixed(9)}` };
}

export function runWitnesses(): WitnessResult[] {
  return [witnessLedgerIdentity(), witnessThreshold(), witnessCensus(), witnessEStar(), witnessH2()];
}
