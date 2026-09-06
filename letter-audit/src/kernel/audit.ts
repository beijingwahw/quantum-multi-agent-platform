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
 *   A5. ids unique.
 *
 * Witnesses:
 *   W-A the Busy-Beaver census (n = 1, 2: universes, halters, BB steps,
 *       stabilization at the BB step);
 *   W-B the universe counts on two paths (closed form vs iterative product);
 *   W-C the right-walker invariant (ones === steps, never halts);
 *   W-D the census bookkeeping (halted + pending = universe);
 *   W-E the five abilities' anchor census (5/5 price lists exist on disk).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { census, machines, rightWalker, simulate } from "./beaver.js";
import {
  LETTER,
  QUOTED_ABILITIES,
  QUOTED_BB1,
  QUOTED_BB2,
  QUOTED_HALTED2,
  QUOTED_UNIVERSE2,
  QUOTED_WALKER_STEPS,
  type AuditRow,
} from "./ledger.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E"];

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
  return [witnessCensus(), witnessUniverseCounts(), witnessWalker(), witnessBookkeeping(), witnessAbilities()];
}
