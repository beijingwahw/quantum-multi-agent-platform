/**
 * The checker — the audit laws, and the witnesses that re-derive every EXACT
 * number from the machine universe itself.
 *
 * Laws enforced:
 *   A1. every audited sentence carries BOTH a precise form and a boundary —
 *       the correspondence's founding discipline, now a build gate;
 *   A2. EXACT rows must cite a witness that exists; CITED rows must NOT be
 *       tagged EXACT (a cited number wearing an exactness tag is smuggling);
 *   A3. anchor repos exist on disk;
 *   A4. tag vocabulary is {EXACT, CITED, DATA};
 *   A5. ids unique;
 *   A6. frontier pointers resolve LIVE — the sibling's report file exists and
 *       contains the cited needle, read from disk at check time (a pointer to
 *       a needle that does not exist is contraband, named and rejected);
 *   A7. no frontier row without a pointer into the sibling that settles or
 *       holds it; a row graduated from OPEN must cite its settler BY POINTER —
 *       a graduation without a settling pointer does not ship;
 *   A8. the census strings quoted in the ledger equal the machine's re-count
 *       of the frontier table (quoted numbers cannot drift from the data).
 *
 * Witnesses:
 *   W-A the Busy-Beaver census (n = 1, 2: universes, halters, BB steps,
 *       stabilization at the BB step);
 *   W-B the universe counts on two paths (closed form vs iterative product);
 *   W-C the right-walker invariant (ones === steps, never halts);
 *   W-D the census bookkeeping (halted + pending = universe);
 *   W-E the five abilities' anchor census (5/5 price lists exist on disk);
 *   W-F the frontier re-audit (every pointer resolves live; census recounted);
 *   W-G the sixth rung's arithmetic (tower prefix exact BigInt, the two cited
 *       June 2025 expressions consistent by structural height comparison).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { census, machines, rightWalker, simulate, compareTowers, lit, tet, tetrate } from "./beaver.js";
import {
  LETTER,
  QUOTED_ABILITIES,
  QUOTED_BB1,
  QUOTED_BB2,
  QUOTED_CENSUS_NOW,
  QUOTED_CENSUS_PRIOR,
  QUOTED_FRONTIER_ROWS,
  QUOTED_GRADUATIONS,
  QUOTED_HALTED2,
  QUOTED_UNIVERSE2,
  QUOTED_WALKER_STEPS,
  type AuditRow,
} from "./ledger.js";
import { FRONTIER, censusString, isGraduated, type FrontierRow } from "./frontier.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-G"];

/**
 * An AuditRow as it crosses the untrusted boundary into the checker: the
 * compile-time `Exactness` union proves nothing at runtime (rows can arrive
 * parsed or mutated), so the tag is an unvalidated string until A4 has run.
 * `AuditRow` remains assignable (Exactness ⊂ string).
 */
export type UntrustedAuditRow = Omit<AuditRow, "exactness"> & { readonly exactness: string };

export function checkLetter(rows: readonly UntrustedAuditRow[] = LETTER): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "A5", detail: "duplicate audit row id" });
    seen.add(r.id);
    if (r.precise.trim().length === 0 || r.boundary.trim().length === 0) {
      violations.push({ row: r.id, law: "A1", detail: "an audited sentence must carry its precise form AND its boundary on the same line" });
    }
    if (r.exactness !== "EXACT" && r.exactness !== "CITED" && r.exactness !== "DATA") {
      violations.push({ row: r.id, law: "A4", detail: `illegal tag "${r.exactness}"` });
    }
    if (!WITNESS_IDS.includes(r.witness)) {
      violations.push({ row: r.id, law: "A2", detail: `cites unknown witness "${r.witness}"` });
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        violations.push({ row: r.id, law: "A3", detail: `anchor repo missing on disk: ${a}` });
      }
    }
  }
  return violations;
}

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

function witnessCensus(): WitnessResult {
  const c1 = census(1, 100);
  const c2 = census(2, 300);
  const stable1 = c1.censusAt[c1.maxSteps] === c1.censusAt[c1.censusAt.length - 1];
  const stable2 = c2.censusAt[c2.maxSteps] === c2.censusAt[c2.censusAt.length - 1];
  const ok =
    c1.maxSteps === QUOTED_BB1 &&
    c2.maxSteps === QUOTED_BB2 &&
    c2.halted === QUOTED_HALTED2 &&
    machines(2) === QUOTED_UNIVERSE2 &&
    stable1 &&
    stable2;
  return {
    name: "W-A Busy-Beaver census",
    pass: ok,
    detail: `n=1: BB=${c1.maxSteps}; n=2: universe ${machines(2)}, halted ${c2.halted}, BB=${c2.maxSteps}, census stable at BB: ${stable1 && stable2}`,
  };
}

function witnessUniverseCounts(): WitnessResult {
  let ok = true;
  for (const n of [1, 2, 3]) {
    let product = 1;
    for (let i = 0; i < 2 * n; i++) product *= 4 * (n + 1);
    if (product !== machines(n)) ok = false;
  }
  return { name: "W-B universe counts (two paths)", pass: ok, detail: `closed form vs iterative product for n=1..3: ${machines(1)} / ${machines(2)} / ${machines(3)}` };
}

function witnessWalker(): WitnessResult {
  const r = simulate(rightWalker(2), QUOTED_WALKER_STEPS);
  const ok = !r.halted && r.steps === QUOTED_WALKER_STEPS && r.ones === r.steps;
  return { name: "W-C right-walker invariant", pass: ok, detail: `${QUOTED_WALKER_STEPS} steps: halted=${r.halted}, ones=${r.ones} === steps` };
}

function witnessBookkeeping(): WitnessResult {
  const c2 = census(2, 300);
  const pending = machines(2) - c2.halted;
  const ok = pending > 0 && c2.halted + pending === machines(2);
  return { name: "W-D census bookkeeping", pass: ok, detail: `${c2.halted} halted + ${pending} pending-at-300 = ${machines(2)} machines` };
}

function witnessAbilities(): WitnessResult {
  const abilityAnchors: ReadonlyArray<readonly string[]> = [
    ["bqp-map"],
    ["bqp-map"],
    ["switch-sched", "nonstoq-anneal"],
    ["readout-wall", "nosignal-tariff", "choice-lang"],
    ["route-price"],
  ];
  let ok = abilityAnchors.length === QUOTED_ABILITIES;
  for (const anchors of abilityAnchors) {
    for (const a of anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) ok = false;
    }
  }
  return { name: "W-E five abilities priced", pass: ok, detail: `${QUOTED_ABILITIES}/5 abilities have on-disk price lists` };
}

export function runWitnesses(): WitnessResult[] {
  return [witnessCensus(), witnessUniverseCounts(), witnessWalker(), witnessBookkeeping(), witnessAbilities(), witnessFrontier(), witnessSixthRung()];
}

/**
 * A FrontierRow as it crosses the untrusted boundary into the checker: same
 * discipline as UntrustedAuditRow — the verdict unions prove nothing at
 * runtime, so they are unvalidated strings until the frontier laws have run.
 */
export type UntrustedFrontierRow = Omit<FrontierRow, "verdict" | "priorVerdict"> & {
  readonly verdict: string;
  readonly priorVerdict: string;
};

const FRONTIER_VERDICTS: readonly string[] = [
  "MECHANISM-SETTLED",
  "HEURISTIC",
  "CONDITIONAL-WALL",
  "HW-WAIT",
  "INFO-WALL",
  "OPEN",
];

/** Laws A6–A8 over the frontier re-audit table. Every pointer is read LIVE. */
export function checkFrontier(rows: readonly UntrustedFrontierRow[] = FRONTIER): Violation[] {
  const violations: Violation[] = [];
  for (const r of rows) {
    // verdict vocabulary (the A4 discipline, frontier edition)
    if (!FRONTIER_VERDICTS.includes(r.verdict)) {
      violations.push({ row: r.claimId, law: "A4", detail: `illegal frontier verdict "${r.verdict}"` });
    }
    if (!FRONTIER_VERDICTS.includes(r.priorVerdict)) {
      violations.push({ row: r.claimId, law: "A4", detail: `illegal prior verdict "${r.priorVerdict}"` });
    }
    // A7: no row without a pointer into the sibling that settles or holds it
    if (r.pointers.length === 0) {
      violations.push({
        row: r.claimId,
        law: "A7",
        detail: `frontier row cites no pointer into the sibling that settles or holds it`,
      });
    }
    const graduated = r.priorVerdict === "OPEN" && r.verdict === "MECHANISM-SETTLED";
    if (graduated) {
      if (r.settler === null || r.settler.length === 0) {
        violations.push({
          row: r.claimId,
          law: "A7",
          detail: `graduated from OPEN without naming its settler — a graduation is not self-certifying`,
        });
      } else if (!r.pointers.some((p) => p.repo === r.settler)) {
        violations.push({
          row: r.claimId,
          law: "A7",
          detail: `graduated from OPEN but carries no settling pointer into "${r.settler}" — the certificate is not cited`,
        });
      }
    } else if (r.settler !== null && r.settler.length > 0) {
      violations.push({
        row: r.claimId,
        law: "A7",
        detail: `settler "${r.settler}" named on a row that did not graduate from OPEN — settler names are for graduations`,
      });
    }
    // A6: every pointer resolves live — file exists AND contains the needle
    for (const p of r.pointers) {
      const path = resolve(WORKSPACE_ROOT, p.repo, ...p.file.split("/"));
      if (!existsSync(path)) {
        violations.push({
          row: r.claimId,
          law: "A6",
          detail: `pointer does not resolve: sibling file ${p.repo}/${p.file} missing on disk`,
        });
        continue;
      }
      if (!readFileSync(path, "utf8").includes(p.needle)) {
        violations.push({
          row: r.claimId,
          law: "A6",
          detail: `pointer does not resolve: needle "${p.needle}" not found in ${p.repo}/${p.file} — the certificate does not say what the row claims`,
        });
      }
    }
  }
  // A8: the census quoted in the ledger equals the machine's re-count
  // (censusString is generic over the row shape: no cast of untrusted rows)
  const now = censusString(rows, "verdict");
  const prior = censusString(rows, "priorVerdict");
  if (now !== QUOTED_CENSUS_NOW) {
    violations.push({
      row: "census",
      law: "A8",
      detail: `quoted census "${QUOTED_CENSUS_NOW}" != recounted "${now}" (MS/HEU/CW/HW/OPEN/IW)`,
    });
  }
  if (prior !== QUOTED_CENSUS_PRIOR) {
    violations.push({
      row: "census",
      law: "A8",
      detail: `quoted prior census "${QUOTED_CENSUS_PRIOR}" != recounted "${prior}" (MS/HEU/CW/HW/OPEN/IW)`,
    });
  }
  if (rows.length !== QUOTED_FRONTIER_ROWS) {
    violations.push({ row: "census", law: "A8", detail: `quoted ${QUOTED_FRONTIER_ROWS} frontier rows, table holds ${rows.length}` });
  }
  const graduations = rows.filter((r) => r.priorVerdict === "OPEN" && r.verdict === "MECHANISM-SETTLED").length;
  if (graduations !== QUOTED_GRADUATIONS) {
    violations.push({ row: "census", law: "A8", detail: `quoted ${QUOTED_GRADUATIONS} graduations, table holds ${graduations}` });
  }
  return violations;
}

function witnessFrontier(): WitnessResult {
  const violations = checkFrontier();
  const pointerCount = FRONTIER.reduce((acc, r) => acc + r.pointers.length, 0);
  const graduations = FRONTIER.filter(isGraduated);
  const named = graduations.map((r) => `${r.claimId}→${r.settler}`).join(", ");
  return {
    name: "W-F frontier re-audit (live pointers)",
    pass: violations.length === 0,
    detail: `${FRONTIER.length} rows / ${pointerCount} pointers resolve live on disk; census ${censusString(FRONTIER, "verdict")} (prior ${censusString(FRONTIER, "priorVerdict")}); graduations: ${named}${violations.length > 0 ? `; REJECTED: ${violations.map((v) => `${v.row} [${v.law}]`).join("; ")}` : ""}`,
  };
}

function witnessSixthRung(): WitnessResult {
  // exact prefix: 2↑↑1..5, strictly increasing, 2↑↑5 = 2^65536 with 19729 digits
  const tower: bigint[] = [tetrate(1), tetrate(2), tetrate(3), tetrate(4), tetrate(5)];
  const prefixOk =
    tower[0] === 2n &&
    tower[1] === 4n &&
    tower[2] === 16n &&
    tower[3] === 65536n &&
    tower[4] === 2n ** 65536n &&
    tower.every((v, i) => i === 0 || v > (tower[i - 1] as bigint)) &&
    tower[4].toString().length === 19729;
  // pentation chain: 2↑↑↑3 = 65536 (exact); 2↑↑↑4 = 2↑↑65536; 2↑↑↑5 = 2↑↑(2↑↑65536)
  const p3 = tetrate(4);
  const p4 = tet(lit(65536n));
  const p5 = tet(p4);
  const chainOk = p3 === 65536n;
  // the two cited June 2025 expressions, consistent: champion 2↑↑(2↑↑(2↑↑9)) > 2↑↑↑5,
  // and pentation itself strictly increasing at this rung
  const champion = tet(tet(tet(lit(9n))));
  const cmpChampion = compareTowers(champion, p5);
  const cmpPentation = compareTowers(p5, p4);
  const ok = prefixOk && chainOk && cmpChampion === 1 && cmpPentation === 1;
  return {
    name: "W-G the sixth rung's arithmetic",
    pass: ok,
    detail: `2↑↑4 = 65536, 2↑↑5 = 2^65536 (${(tower[4] as bigint).toString().length} digits, monotone prefix); 2↑↑↑3 = 65536 exact; champion 2↑↑(2↑↑(2↑↑9)) vs 2↑↑↑5: ${cmpChampion === 1 ? "strictly greater (the sources agree, the champion is the stronger bound)" : `INCONSISTENT (${cmpChampion})`}; 2↑↑↑5 > 2↑↑↑4: ${cmpPentation === 1}`,
  };
}
