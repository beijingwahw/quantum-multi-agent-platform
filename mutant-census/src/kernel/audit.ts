/**
 * THE CHECKER — the census laws, and the witnesses that re-derive every
 * number live (kill margins from the matrices, hashes from the disks).
 *
 * Laws enforced:
 *   Q1. every mutant carries burial-batch provenance, "batch N (repo)" — a
 *       mutant without provenance is a toy;
 *   Q2. the declared expected kill must match the LIVE kill census; a mutant
 *       whose killer property still PASSES is a SURVIVOR — a blind spot that
 *       must be declared, never hidden;
 *   Q3. every property runs >= 60 seeded inputs and books its worst
 *       deviation; statistical properties are labeled DATA and judged at
 *       5 sigma — a property is not an example;
 *   Q4. every property names a tripper it can fail against — a mutant that
 *       kills it, or a synthetic negative control that fires; a "pass"
 *       nothing can move is a constructed zero;
 *   Q5. the kernel family's byte-identity is censused LIVE: an unregistered
 *       divergence fails the build (the batch-23 class), and so does a stale
 *       registration — the register must match reality exactly;
 *   Q6. closed vocabulary, unique ids, provenance repos on disk.
 *
 * E-board laws (the enrollment — every buried error wired to a guard):
 *   E1. exact coverage BOTH WAYS against the LIVE registry: every error the
 *       burial record carries has exactly one enrollment row, and no row
 *       enrolls an error the registry does not carry. An error without an
 *       enforcement anchor cannot be buried — the registry is closed;
 *   E2. a MUTANT-KILLED row must sit on a mutant that DECLARES the error's
 *       class (the classes field); the kill itself is certified live by W-A;
 *   E3. a GATE-ENFORCED anchor ("path :: needle") must resolve LIVE: file on
 *       disk, needle in the file. A guard that is not on disk guards nothing;
 *   E4. a BOOKED-UNENFORCEABLE row must carry a reason, and every booked row
 *       is printed on the report — the boundary is visible, not implied;
 *   E5. the two registries may not drift: the burial record's declared totals
 *       must equal what it carries;
 *   E6. closed tier vocabulary, unique keys, no category re-labeling;
 *   E7. (v0.11.0) the census's OWN stated counts are law: any tier count the
 *       package.json description states must equal the live enrollment
 *       arithmetic — the description is a copy of the data (the b67#6/b68#0
 *       class: counts drift the moment a batch lands), and copies answer to
 *       the same law as contexts and lesson headings.
 *
 * Witnesses:
 *   W-A the kill census (9 mutants, live margins);
 *   W-B the property battery (10 properties, worst deviations);
 *   W-C the negative controls (synthetic violators must FIRE);
 *   W-D the family census (live hashes vs the register);
 *   W-E the workspace census (26 repos, live);
 *   W-F the enrollment census (every buried error, live against the registry);
 *   [W-I — the per-error equivalence census, lives in equiv.ts: the J-board's
 *    witness; kept out of runWitnesses so it stays with its own laws J1-J3.]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MUTANTS, type MutantSpec } from "./family.js";
import { PROPERTY_IDS, runBattery, runKillCensus, runNegativeControls } from "./battery.js";
import {
  REGISTERED_DIVERGENCES,
  REGISTERED_ROOT_FILES,
  WORKSPACE_ROOT,
  liveRootStrayFiles,
  scanFamily,
  scanWorkspace,
  type FamilyScanRow,
  type WorkspaceScanRow,
} from "./census.js";
import { ENROLLMENT, TIERS, type EnrollmentRow } from "./enrollment.js";
import { loadLiveRegistry, type LiveRegistry } from "./bridge.js";

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

const LEGAL_EXPECTED: readonly string[] = ["EXACT-KILL", "CRASH-KILL", "DATA-KILL", "SURVIVED", "EXEMPT"];

function provenanceRepos(history: string): string[] {
  const out: string[] = [];
  // repo names are lowercase-with-hyphens; the paren may carry a trailing note
  const re = /batch \d+ \(([a-z0-9][a-z0-9-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(history)) !== null) out.push(m[1] as string);
  return out;
}

/** Static laws over the mutant register (the live laws live in the witnesses). */
export function checkCensus(mutants: readonly MutantSpec[] = MUTANTS): Violation[] {
  const v: Violation[] = [];
  const seen = new Set<string>();
  for (const mu of mutants) {
    if (seen.has(mu.id)) v.push({ row: mu.id, law: "Q6", detail: "duplicate mutant id" });
    seen.add(mu.id);
    if (provenanceRepos(mu.history).length === 0) {
      v.push({ row: mu.id, law: "Q1", detail: 'no burial-batch provenance "batch N (repo)" — a mutant without provenance is a toy' });
    }
    if (!(PROPERTY_IDS).includes(mu.killer)) {
      v.push({ row: mu.id, law: "Q2", detail: `unknown killer property "${mu.killer}"` });
    }
    if (!LEGAL_EXPECTED.includes(mu.expected)) {
      v.push({ row: mu.id, law: "Q6", detail: `illegal expected verdict "${mu.expected}"` });
    }
    if (mu.defect.trim() === "" || mu.corrupted.trim() === "") {
      v.push({ row: mu.id, law: "Q1", detail: "defect/corrupted column empty" });
    }
    for (const repo of provenanceRepos(mu.history)) {
      if (!existsSync(resolve(WORKSPACE_ROOT, repo, "package.json"))) {
        v.push({ row: mu.id, law: "Q6", detail: `provenance repo missing on disk: ${repo}` });
      }
    }
  }
  return v;
}

/** W-A: the kill census — live, against the declared expectations. */
export function witnessKillCensus(mutants: readonly MutantSpec[] = MUTANTS): WitnessResult {
  const kills = runKillCensus(mutants);
  const byId = new Map(mutants.map((m) => [m.id, m] as const));
  const problems: string[] = [];
  for (const k of kills) {
    const spec = byId.get(k.id);
    if (!spec) continue;
    if (k.actual !== spec.expected) {
      problems.push(`${k.id}: declared ${spec.expected} but the census says ${k.actual}`);
    }
    if (k.actual === "SURVIVED") problems.push(`${k.id}: SURVIVED — blind spot must be booked, not shipped`);
  }
  const tally = { "EXACT-KILL": 0, "CRASH-KILL": 0, "DATA-KILL": 0, SURVIVED: 0 } as Record<string, number>;
  for (const k of kills) tally[k.actual] = (tally[k.actual] ?? 0) + 1;
  const margins = kills
    .filter((k) => Number.isFinite(k.margin))
    .map((k) => `${k.id}:${k.margin > 1000 ? k.margin.toFixed(0) : k.margin.toExponential(1)}`)
    .join(" ");
  return {
    name: "W-A kill census",
    pass: problems.length === 0 && kills.length === mutants.length,
    detail: problems.length > 0 ? problems.join("; ") : `${kills.length}/${mutants.length} killed as declared — EXACT ${tally["EXACT-KILL"]}, CRASH ${tally["CRASH-KILL"]}, DATA ${tally["DATA-KILL"]}, SURVIVED ${tally["SURVIVED"]}; margins ${margins}`,
  };
}

/** W-B: the property battery — canonical, every property green and >= 60 inputs. */
export function witnessBattery(): WitnessResult {
  const props = runBattery();
  const problems: string[] = [];
  for (const p of props) {
    if (!p.pass) problems.push(`${p.id} FAILS on the canonical family: ${p.detail}`);
    if (p.inputs < 60) problems.push(`${p.id} runs ${p.inputs} inputs — below the legal floor of 60 (Q3)`);
    if (p.tripper.trim() === "") problems.push(`${p.id} names no tripper (Q4)`);
  }
  const worsts = props.map((p) => `${p.id}=${p.worst > 1e6 ? p.worst.toFixed(0) : p.worst.toExponential(1)}`).join(" ");
  return {
    name: "W-B property battery",
    pass: problems.length === 0,
    detail: problems.length > 0 ? problems.join("; ") : `${props.length} properties green on the canonical family; worst deviations ${worsts}`,
  };
}

/** W-C: the negative controls — every synthetic violator must FIRE. */
export function witnessControls(): WitnessResult {
  const controls = runNegativeControls();
  const failed = controls.filter((c) => !c.pass);
  return {
    name: "W-C negative controls",
    pass: failed.length === 0 && controls.length >= 3,
    detail:
      failed.length > 0
        ? `controls that did NOT fire: ${failed.map((c) => c.name).join(", ")} — a property nothing can move is a constructed zero`
        : `${controls.length} synthetic violators fired (P1 shape-blind product, P3 lopsided outer, P4 non-CPTP Kraus); the mutant-trippers are proven by W-A itself`,
  };
}

/** W-D: the family census — live hashes against the register. */
export function witnessFamily(): { result: WitnessResult; rows: readonly FamilyScanRow[]; canonical: Record<string, string> } {
  const { rows, canonical } = scanFamily();
  const unregistered = rows.filter((r) => r.status === "UNREGISTERED-DIVERGENCE");
  const stale = rows.filter((r) => r.status === "STALE-REGISTRATION");
  const identical = rows.filter((r) => r.status === "IDENTICAL").length;
  const registered = rows.filter((r) => r.status === "REGISTERED-DIVERGENCE").length;
  const problems: string[] = [];
  for (const r of unregistered) problems.push(`${r.repo}/${r.file} drifted from the family WITHOUT registration (${r.hash})`);
  for (const r of stale) problems.push(`${r.repo}/${r.file} registered as divergent but now byte-identical — stale registration`);
  return {
    result: {
      name: "W-D family census",
      pass: problems.length === 0,
      detail:
        problems.length > 0
          ? problems.join("; ")
          : `${identical} file-pairs byte-identical to the canon; ${registered} registered divergences live (${REGISTERED_DIVERGENCES.length} registered); 0 unregistered, 0 stale — the register matches reality exactly`,
    },
    rows,
    canonical,
  };
}

/** W-E: the workspace census — 28 epoch repos + the platform + the root, live. */
export function witnessWorkspace(): { result: WitnessResult; rows: readonly WorkspaceScanRow[] } {
  const rows = scanWorkspace();
  const problems: string[] = [];
  for (const r of rows) {
    if (!r.scriptsOk) problems.push(`${r.repo}: mandatory scripts incomplete`);
    if (!r.strictOk) problems.push(`${r.repo}: tsconfig not strict`);
    if (!r.isPlatform && r.unguardedEntries.length > 0) {
      problems.push(
        `${r.repo}: ${r.unguardedEntries.length} UNGUARDED render entries — the batch-33 ratchet tolerates ZERO and the legacy register is empty`,
      );
    }
  }
  const strays = liveRootStrayFiles();
  for (const s of strays) {
    problems.push(`workspace root stray: ${s} — the root is not a scratch home (registered: ${REGISTERED_ROOT_FILES.join(", ")})`);
  }
  const epochRows = rows.filter((r) => !r.isPlatform);
  const platformRows = rows.filter((r) => r.isPlatform);
  const unguardedTotal = epochRows.reduce((s, r) => s + r.unguardedEntries.length, 0);
  return {
    result: {
      name: "W-E workspace census",
      pass: problems.length === 0,
      detail:
        problems.length > 0
          ? problems.join("; ")
          : `${epochRows.length}/${epochRows.length} epoch repos: test+typecheck+repro and strict TS, ${unguardedTotal} unguarded entries TOTAL (the pre-batch-21 guard debt PAID in batch 33 — 42 entries retrofitted, every gate re-run green); platform censused: ${platformRows.map((r) => r.repo).join(", ")} (test+typecheck mandatory, repro = the GENESIS-A registered debt, not a missing flag); report artifacts on disk: ${rows.filter((r) => r.reportCount > 0).length}/${rows.length}; workspace root: ${strays.length} strays (registered: ${REGISTERED_ROOT_FILES.join(", ")}) — the root-stray gate, v0.9.0`,
    },
    rows,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [
    witnessKillCensus(),
    witnessBattery(),
    witnessControls(),
    witnessFamily().result,
    witnessWorkspace().result,
  ];
}

/** E1-E6 over an enrollment table against a registry snapshot (live by default
 * via witnessEnrollment). Static enough to be injected: the smuggling trials
 * call it with forged inputs. */
export function checkEnrollment(
  rows: readonly EnrollmentRow[],
  registry: LiveRegistry,
): Violation[] {
  const v: Violation[] = [];
  const liveByKey = new Map(registry.errors.map((e) => [e.key, e] as const));
  const classesById = new Map(MUTANTS.map((m) => [m.id, m.classes] as const));
  const seen = new Set<string>();
  for (const r of rows) {
    if (!TIERS.includes(r.tier)) {
      v.push({ row: r.key, law: "E6", detail: `illegal tier "${r.tier}" — the vocabulary is closed` });
      continue;
    }
    if (seen.has(r.key)) {
      v.push({ row: r.key, law: "E6", detail: "duplicate enrollment key" });
      continue;
    }
    seen.add(r.key);
    const err = liveByKey.get(r.key);
    if (!err) {
      v.push({ row: r.key, law: "E1", detail: "enrolls an error the registry does not carry — a dead anchor" });
      continue;
    }
    if (err.category !== r.category) {
      v.push({ row: r.key, law: "E6", detail: `category mislabeled "${r.category}" — the live error is filed "${err.category}"` });
    }
    if (r.tier === "MUTANT-KILLED") {
      const cls = classesById.get(r.anchor);
      if (!cls) v.push({ row: r.key, law: "E2", detail: `unknown mutant "${r.anchor}"` });
      else if (!cls.includes(err.category)) {
        v.push({ row: r.key, law: "E2", detail: `mutant ${r.anchor} does not replay the "${err.category}" class (declares: ${cls.join(", ")})` });
      }
    } else if (r.tier === "GATE-ENFORCED") {
      const [path, needle] = r.anchor.split(" :: ");
      if (needle === undefined || path === undefined || path === "" || needle === "") {
        v.push({ row: r.key, law: "E3", detail: `malformed anchor "${r.anchor}" — expected "path :: needle"` });
      } else {
        const full = resolve(WORKSPACE_ROOT, path);
        if (!existsSync(full)) v.push({ row: r.key, law: "E3", detail: `anchor file missing: ${path}` });
        else if (!readFileSync(full, "utf8").includes(needle)) {
          v.push({ row: r.key, law: "E3", detail: `needle "${needle}" not found in ${path} — the guard is not on disk` });
        }
      }
    } else if (r.reason.trim() === "") {
      v.push({ row: r.key, law: "E4", detail: "booked without a reason — an unenforceable line must say why, on the record" });
    }
  }
  for (const e of registry.errors) {
    if (!seen.has(e.key)) {
      v.push({
        row: e.key,
        law: "E1",
        detail: `${e.key} un-enrolled (${e.category}, batch ${e.batch}, ${e.repo}) — an error without an enforcement anchor cannot be buried`,
      });
    }
  }
  if (registry.declaredBatches !== registry.batchCount || registry.declaredErrors !== registry.errors.length) {
    v.push({
      row: "registry",
      law: "E5",
      detail: `the burial record declares ${registry.declaredBatches} batches / ${registry.declaredErrors} errors but carries ${registry.batchCount} / ${registry.errors.length} — the two registries may not drift`,
    });
  }
  return v;
}

/** E7: the census's own stated tier counts (package.json description) equal
 * the live enrollment arithmetic. Any stated count is checked; absent counts
 * claim nothing. The parser matches the description's established phrases. */
export function checkStatedCounts(description: string, rows: readonly EnrollmentRow[]): Violation[] {
  const v: Violation[] = [];
  const tally = (tier: string): number => rows.filter((r) => r.tier === tier).length;
  const claims: Array<{ re: RegExp; tier: string; label: string }> = [
    { re: /(\d+)\s+on live mutants/, tier: "MUTANT-KILLED", label: "on live mutants" },
    { re: /(\d+)\s+on build gates/, tier: "GATE-ENFORCED", label: "on build gates" },
    { re: /(\d+)\s+booked unenforceable/, tier: "BOOKED-UNENFORCEABLE", label: "booked unenforceable" },
  ];
  for (const c of claims) {
    const m = c.re.exec(description);
    if (!m) continue;
    const stated = Number.parseInt(m[1]!, 10);
    const live = tally(c.tier);
    if (stated !== live) {
      v.push({
        row: "description",
        law: "E7",
        detail: `states ${stated} ${c.label} but the live enrollment carries ${live} — a stated count is a copy of the data (b67#6/b68#0 class)`,
      });
    }
  }
  return v;
}

/** W-F: the enrollment census — every buried error, live against the registry. */
export async function witnessEnrollment(rows: readonly EnrollmentRow[] = ENROLLMENT): Promise<WitnessResult> {
  const registry = await loadLiveRegistry();
  const v = checkEnrollment(rows, registry);
  const tally: Record<string, number> = {};
  for (const r of rows) tally[r.tier] = (tally[r.tier] ?? 0) + 1;
  return {
    name: "W-F enrollment census",
    pass: v.length === 0,
    detail:
      v.length > 0
        ? `${v.length} violation(s): ${v.slice(0, 5).map((x) => `${x.row} [${x.law}]`).join("; ")}${v.length > 5 ? ", …" : ""}`
        : `${registry.errors.length} errors enrolled LIVE against a registry of ${registry.batchCount} batches (declares exactly what it carries) — MUTANT-KILLED ${tally["MUTANT-KILLED"] ?? 0}, GATE-ENFORCED ${tally["GATE-ENFORCED"] ?? 0}, BOOKED-UNENFORCEABLE ${tally["BOOKED-UNENFORCEABLE"] ?? 0}, every booked row printed on the report`,
  };
}
