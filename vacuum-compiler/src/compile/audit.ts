/**
 * The smuggling trials' machinery: auditors that NAME and REJECT counterfeit
 * evidence. Two faces (v0.2.0):
 *
 * 1. Counterfeit amplification-decay tables — `auditDecayTable` recomputes
 *    every row in exact rational arithmetic and checks the census's honesty
 *    clauses (resolution floor, 5-sigma band). A table is accepted only if
 *    every row survives ALL checks; each violation is named with its row.
 *
 * 2. Fake graduated-boundary citations — `auditBoundaryCitation` verifies a
 *    claimed sibling certificate against TWO independent grounds: (a) the
 *    sibling's actually-shipped report and package.json (re-read read-only
 *    at audit time — the citation must point at something that exists), and
 *    (b) OUR OWN exact integer arithmetic (the quoted tariff figure must be
 *    the correct rounding of (T+1)·log2(T+1) at the claimed depth, and the
 *    claimed ordering must hold on our conventions). A citation that fails
 *    either ground is named and rejected — no amount of sibling vocabulary
 *    makes a wrong number true.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { exactRationalPower, rationalToFloat, type ExactRational } from "./amplify.js";
import { fkStaticCompare, fkStaticRoundsTo } from "./tariff.js";

// ---------------------------------------------------------------------------
// 1. The decay-table auditor
// ---------------------------------------------------------------------------

/** A submitted census row (data, not trusted — this is what smugglers edit). */
export interface SubmittedDecayRow {
  readonly k: number;
  readonly claimedExact: ExactRational;
  readonly claimedFloat: number;
  readonly claimedSurvival: ExactRational;
  readonly claimedMc: number;
  readonly claimedResolvable: boolean;
}

export interface DecayTableViolation {
  readonly k: number;
  readonly crime: string;
  readonly detail: string;
}

/** Audit a submitted epsilon^k decay table against exact recomputation.
 * Named crimes: wrong epsilon^k (exact and float), wrong survival (1-eps)^k,
 * resolution smuggling (resolvable flag inconsistent with the trials·eps^k
 * >= 10 floor), MC outside the 5-sigma band, and structural corruption
 * (gaps/duplicates in k). */
export function auditDecayTable(eps: ExactRational, rows: readonly SubmittedDecayRow[], trials = 20000): readonly DecayTableViolation[] {
  const violations: DecayTableViolation[] = [];
  const seen = new Set<number>();
  for (const r of rows) {
    if (seen.has(r.k)) violations.push({ k: r.k, crime: "duplicate row", detail: `k=${r.k} appears twice` });
    seen.add(r.k);
    const exact = exactRationalPower(eps, r.k);
    const exactFloat = rationalToFloat(exact);
    if (r.claimedExact.num !== exact.num || r.claimedExact.den !== exact.den) {
      violations.push({
        k: r.k,
        crime: "counterfeit epsilon^k (exact)",
        detail: `claimed ${r.claimedExact.num}/${r.claimedExact.den}, exact ${exact.num}/${exact.den}`,
      });
    }
    if (Math.abs(r.claimedFloat - exactFloat) > 1e-15) {
      violations.push({ k: r.k, crime: "counterfeit epsilon^k (float)", detail: `claimed ${r.claimedFloat}, exact ${exactFloat}` });
    }
    const survival = exactRationalPower({ num: eps.den - eps.num, den: eps.den }, r.k);
    if (r.claimedSurvival.num !== survival.num || r.claimedSurvival.den !== survival.den) {
      violations.push({
        k: r.k,
        crime: "counterfeit survival (1-eps)^k",
        detail: `claimed ${r.claimedSurvival.num}/${r.claimedSurvival.den}, exact ${survival.num}/${survival.den}`,
      });
    }
    const expected = trials * exactFloat;
    const trueResolvable = expected >= 10;
    if (r.claimedResolvable !== trueResolvable) {
      violations.push({
        k: r.k,
        crime: "resolution smuggling",
        detail: `claimed resolvable=${r.claimedResolvable}, but trials·eps^k = ${expected.toFixed(2)} vs floor 10`,
      });
    }
    if (!trueResolvable && !Number.isNaN(r.claimedMc)) {
      violations.push({
        k: r.k,
        crime: "MC claimed below the resolution floor",
        detail: `row k=${r.k} cannot be resolved at ${trials} trials (expected passes ${expected.toFixed(2)} < 10), yet claims MC ${r.claimedMc}`,
      });
    }
    if (r.claimedResolvable && trueResolvable) {
      const sigma = Math.sqrt(Math.max(exactFloat * (1 - exactFloat), 0) / trials);
      if (Math.abs(r.claimedMc - exactFloat) > 5 * sigma) {
        violations.push({
          k: r.k,
          crime: "MC outside 5-sigma band",
          detail: `|mc − eps^k| = ${Math.abs(r.claimedMc - exactFloat).toExponential(2)} vs 5σ = ${(5 * sigma).toExponential(2)}`,
        });
      }
    }
  }
  for (let k = 1; k <= rows.length; k++) {
    if (!seen.has(k)) violations.push({ k, crime: "row gap", detail: `k=${k} missing from a 1..${rows.length} census` });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// 2. The graduated-boundary citation auditor
// ---------------------------------------------------------------------------

/** A citation to a sibling's shipped certificate (data, not trusted). */
export interface BoundaryCitation {
  readonly repo: string;
  /** the sibling version the citation was verified against */
  readonly version: string;
  /** the witness id in the sibling's shipped report (e.g. "TC14") */
  readonly witness: string;
  /** the quoted tariff figure on OUR side, in integer hundredths (4302 = 43.02) */
  readonly figureHundredths: number;
  /** the matched depth T at which our formula is claimed to produce it */
  readonly depth: number;
  /** the claimed semantic: the FK static entry is the most expensive row */
  readonly direction: "fk-most-expensive" | "fk-cheapest";
}

export interface CitationViolation {
  readonly crime: string;
  readonly detail: string;
}

interface SiblingRegistryEntry {
  /** shipped report file, read-only at audit time (relative to the workspace root) */
  readonly reportFile: string;
  readonly packageJson: string;
}

/** The enrolled cross-references (read-only; verified by actually reading
 * these files on 2026-09-08 — see docs/citations.md). */
const SIBLINGS: ReadonlyMap<string, SiblingRegistryEntry> = new Map([
  ["dtc-clock", { reportFile: "dtc-clock/out/reports/the-dtc-clock.md", packageJson: "dtc-clock/package.json" }],
  ["route-price", { reportFile: "route-price/docs/theory.md", packageJson: "route-price/package.json" }],
]);

const workspaceRoot = resolve(import.meta.dirname, "..", "..", "..");

/** Audit a graduated-boundary citation. Grounds: (a) the sibling's shipped
 * report must carry the witness id and the quoted figure, and its
 * package.json must carry the cited version; (b) OUR exact integer
 * arithmetic must confirm the figure as the correct rounding of
 * (T+1)·log2(T+1) at the claimed depth, and the claimed direction must hold
 * against the quoted sibling integer entries (5 and 9). */
export function auditBoundaryCitation(c: BoundaryCitation, rivalUnits: readonly number[] = [5, 9]): readonly CitationViolation[] {
  const violations: CitationViolation[] = [];
  const entry = SIBLINGS.get(c.repo);
  if (entry === undefined) {
    return [{ crime: "unknown sibling repo", detail: `"${c.repo}" is not an enrolled cross-reference` }];
  }
  let report = "";
  try {
    report = readFileSync(resolve(workspaceRoot, entry.reportFile), "utf8");
  } catch {
    violations.push({ crime: "sibling report unreadable", detail: `${entry.reportFile} cannot be re-read; the citation points at nothing` });
  }
  try {
    const text = readFileSync(resolve(workspaceRoot, entry.packageJson), "utf8");
    if (!text.includes(`"version": "${c.version}"`)) {
      violations.push({ crime: "version drift", detail: `cited version ${c.version} not found in ${entry.packageJson}` });
    }
  } catch {
    violations.push({ crime: "sibling package.json unreadable", detail: `${entry.packageJson} cannot be re-read` });
  }
  if (report !== "") {
    if (!report.includes(c.witness)) {
      violations.push({ crime: "witness id not in shipped report", detail: `"${c.witness}" does not appear in ${entry.reportFile} — the citation points at a claim that is not there` });
    }
    const figureString = (c.figureHundredths / 100).toFixed(2);
    if (!report.includes(figureString)) {
      violations.push({ crime: "quoted figure not in shipped report", detail: `"${figureString}" does not appear in ${entry.reportFile}` });
    }
  }
  if (!Number.isInteger(c.depth) || c.depth < 2) {
    violations.push({ crime: "depth out of domain", detail: `claimed depth ${c.depth}` });
    return violations;
  }
  if (!fkStaticRoundsTo(c.depth + 1, c.figureHundredths)) {
    violations.push({
      crime: "tariff figure not our conventions at claimed depth",
      detail: `${c.figureHundredths / 100} is not the correct 2-decimal rounding of ${(c.depth + 1)}·log2(${c.depth + 1}) at depth ${c.depth} (exact integer check)`,
    });
  }
  for (const r of rivalUnits) {
    const cmp = fkStaticCompare(c.depth + 1, r);
    const shouldExceed = c.direction === "fk-most-expensive";
    if (shouldExceed && cmp <= 0) {
      violations.push({
        crime: "direction contradicted by exact ordering",
        detail: `claimed FK-most-expensive but ${r} does not undercut our entry at depth ${c.depth} (compare = ${cmp})`,
      });
    }
    if (!shouldExceed && cmp >= 0) {
      violations.push({
        crime: "direction contradicted by exact ordering",
        detail: `claimed FK-cheapest but our entry does not undercut ${r} at depth ${c.depth} (compare = ${cmp})`,
      });
    }
  }
  return violations;
}
