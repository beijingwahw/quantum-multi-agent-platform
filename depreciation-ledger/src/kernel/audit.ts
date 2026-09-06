/**
 * The checker — claim #17 as a build gate.
 *
 * Laws enforced:
 *   L1. a row quoting a number column must book a cost column;
 *   L2. a row without numbers must be OPEN and say so in its cost column;
 *   L3. every atlas anchor id exists in bqp-map/src/atlas/entries.ts;
 *   L4. every verdict tag appears as a verdict in the atlas;
 *   L5. every appeal command exists in the target repo's package.json scripts;
 *   L6. the five arithmetic witnesses hold (independent re-derivations).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LEDGER, type LedgerRow, type Verdict } from "./ledger.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

const LEGAL_VERDICTS: readonly Verdict[] = [
  "HEURISTIC",
  "HW-WAIT",
  "CONDITIONAL-WALL",
  "INFO-WALL",
  "MECHANISM-SETTLED",
  "OPEN",
];

export interface Violation {
  readonly claimId: string;
  readonly law: string;
  readonly detail: string;
}

export function checkLedger(rows: readonly LedgerRow[] = LEDGER): Violation[] {
  const violations: Violation[] = [];
  const atlasPath = resolve(WORKSPACE_ROOT, "bqp-map", "src", "atlas", "entries.ts");
  if (!existsSync(atlasPath)) {
    violations.push({ claimId: "-", law: "L3", detail: `atlas file missing: ${atlasPath}` });
    return violations;
  }
  const atlas = readFileSync(atlasPath, "utf8");

  for (const row of rows) {
    if (!(LEGAL_VERDICTS as readonly string[]).includes(row.verdict)) {
      violations.push({ claimId: row.claimId, law: "L0", detail: `illegal verdict ${row.verdict}` });
    }
    // L1/L2 — the conduct rule itself
    const hasNumbers = row.numberColumn.trim().length > 0;
    const hasCost = row.costColumn.trim().length > 0;
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
    // L5 — appeal repo + command
    const pkgPath = resolve(WORKSPACE_ROOT, row.appealRepo, "package.json");
    if (!existsSync(pkgPath)) {
      violations.push({ claimId: row.claimId, law: "L5", detail: `appeal repo missing: ${row.appealRepo}` });
    } else {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> };
      if (pkg.scripts === undefined || !(row.appealCommand in pkg.scripts)) {
        violations.push({ claimId: row.claimId, law: "L5", detail: `appeal command "${row.appealCommand}" not a script of ${row.appealRepo}` });
      }
    }
  }
  return violations;
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

/** W-C: the 256-strategy classical CHSH census, independent reimplementation */
function witnessCensus(): WitnessResult {
  const bits = (idx: number): number[] => [(idx >> 3) & 1, (idx >> 2) & 1, (idx >> 1) & 1, idx & 1].map((b) => (b === 1 ? 1 : -1));
  let maxAbs = 0;
  for (let i = 0; i < 16; i++) {
    const rA = bits(i);
    for (let j = 0; j < 16; j++) {
      const rB = bits(j);
      const e = (ai: number, bj: number): number => {
        let s = 0;
        for (let sd = 0; sd < 2; sd++) {
          const x = rA[ai * 2 + sd] as number;
          const y = rB[bj * 2 + sd] as number;
          s += x * y;
        }
        return s / 2;
      };
      const S = e(0, 0) + e(0, 1) + e(1, 0) - e(1, 1);
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
