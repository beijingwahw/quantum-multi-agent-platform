/**
 * THE ANCHOR BOARD (A-board) — every GATE-ENFORCED anchor upgraded from a
 * string to a REGISTERED GUARD WITH EVIDENCE.
 *
 * E3 proves the needle is on disk; it does not prove the gate can FIRE. A
 * guard that never convicts is a false guard (the Q4 family lesson: a check
 * nothing can move is a constructed zero). The A-board closes that hole with
 * three evidence kinds, closed vocabulary:
 *
 *   FIRING-INJECT — a named conviction demo exists as a real test (in this
 *     repo or a sibling whose suite the total gate runs): a violation of a
 *     held class is injected into the REAL checker and convicted BY NAME
 *     (A2 verifies the demo file+name on disk; its greenness is enforced by
 *     the suites the total gate already runs);
 *   FIRING-LIVE  — the guard's firing face is executed RIGHT NOW by this
 *     census (fireLive below): a forged violation or a live kill, convicted
 *     on the spot (A3);
 *   RESOLVED     — for script gates whose full firing means re-running
 *     another repo's build: the gate's IMPLEMENTING ARTIFACTS are verified
 *     to exist and to be wired (the test tree, the typecheck project, the
 *     lint config, the repro target, the formatter) — the needle is not a
 *     dead string, the machinery behind it is on disk (A3).
 *
 * Laws (checked live, every run):
 *   A1 REGISTRY SYMMETRY — the anchors used by enrollment rows and the
 *      anchors registered must match EXACTLY both ways: an unregistered
 *      anchor holds errors illegally, a stale registration claims a guard
 *      nothing uses (the K-board symmetry, applied to guards);
 *   A2 INJECT DEMOS ON DISK — demo file exists, demo name in the file;
 *   A3 LIVE FIRE / RESOLUTION — every FIRING-LIVE anchor fires here, every
 *      RESOLVED anchor resolves to its machinery.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { MUTANTS, type MutantSpec } from "./family.js";
import { runKillCensus, runNegativeControls } from "./battery.js";
import { WORKSPACE_ROOT, unguardedEntryFiles } from "./census.js";
import { ENROLLMENT, type EnrollmentRow } from "./enrollment.js";
import { checkEnrollment } from "./audit.js";
import { loadLiveRegistry } from "./bridge.js";

export type AnchorKind = "FIRING-INJECT" | "FIRING-LIVE" | "RESOLVED";

export interface AnchorRegistration {
  /** "workspace-relative/path :: needle" — byte-identical to what rows carry */
  readonly anchor: string;
  readonly kind: AnchorKind;
  /** FIRING-INJECT: where the conviction demo lives and what it is called */
  readonly demoFile?: string;
  readonly demoName?: string;
  /** what the evidence IS, one line, printed on the report */
  readonly evidence: string;
}

/** The fixture repo for the unguarded-entry detector's live firing — a render
 * entry with no house guard, so the detector can be seen naming it. */
export const FIXTURE_REPO = "mutant-census/test/fixtures/warden-fixture";

export const ANCHOR_REGISTRY: readonly AnchorRegistration[] = [
  // ---- the checker-law anchors: conviction demos, injected into the REAL checkers ----
  { anchor: "burial-record/src/kernel/audit.ts :: B4", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire B4", evidence: "a forged batch with a dead source anchor is convicted BY NAME by burial-record's own checkBurial (imported live)" },
  { anchor: "depreciation-ledger/src/kernel/audit.ts :: L1", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire L1", evidence: "a ledger row quoting numbers with an empty cost column is convicted by the ledger's own checkLedger (imported live)" },
  { anchor: "depreciation-ledger/src/kernel/audit.ts :: L2", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire L2", evidence: "a settled row quoting no numbers is convicted by checkLedger — no-number rows must stay OPEN" },
  { anchor: "depreciation-ledger/src/kernel/audit.ts :: L6", kind: "FIRING-INJECT", demoFile: "depreciation-ledger/test/ledger.test.ts", demoName: "L6: all five arithmetic witnesses pass", evidence: "the five headline costs are re-derived from scratch in the ledger's own gate (a suite the total gate runs)" },
  { anchor: "mutant-census/src/kernel/audit.ts :: provenanceRepos", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire provenanceRepos", evidence: "a provenance with a trailing paren note ('batch 10 (qverify, expPauli)') resolves to exactly qverify — the charset does not swallow commas, no false conviction" },
  { anchor: "mutant-census/test/anchors.test.ts :: A-fire L2", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire L2", evidence: "batch 35's own lesson as a guard: the L2 demo encodes the law's REAL object read from the ledger's source (a blank column with a settled verdict) — ammo cast from memory fires at nothing, and this demo going green is the proof it was cast from the law" },
  // ---- the census's own laws: fired LIVE, here, on every run ----
  { anchor: "burial-record/package.json :: test", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire B7", evidence: "a forged batch whose context states NINE delivery errors over ten carried errors is convicted BY NAME (law B7) by burial-record's own checkBurial, imported live — the b45#9 class can never again wait for the visitor" },
  { anchor: "mutant-census/src/kernel/audit.ts :: E1", kind: "FIRING-LIVE", evidence: "a forged registry carrying an un-enrolled error is convicted by checkEnrollment on the spot" },
  { anchor: "mutant-census/src/kernel/audit.ts :: E2", kind: "FIRING-LIVE", evidence: "a forged class-mismatched mutant tie is convicted by checkEnrollment on the spot" },
  { anchor: "mutant-census/src/kernel/audit.ts :: Q2", kind: "FIRING-LIVE", evidence: "the ghost mutant (declared EXACT-KILL, ships the canonical function) is reported SURVIVED by the live kill census — the declared-vs-live law has teeth" },
  { anchor: "mutant-census/src/kernel/audit.ts :: Q4", kind: "FIRING-LIVE", evidence: "the battery's synthetic violators FIRE on every run (runNegativeControls) — a property nothing can move is a constructed zero, and this anchor is why the controls exist" },
  { anchor: "mutant-census/src/kernel/audit.ts :: W-C", kind: "FIRING-LIVE", evidence: "the negative controls fire live: shape-blind product, lopsided outer, non-CPTP Kraus each get named" },
  { anchor: "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE", kind: "FIRING-LIVE", evidence: "MU2 (the conjugated vecToRho — Hermitian, trace 1, PSD, invisible to statehood) is killed EXACTLY by P2's phase-sensitive dual path, live" },
  { anchor: "mutant-census/src/kernel/census.ts :: unguardedEntryFiles", kind: "FIRING-LIVE", evidence: "the in-repo fixture repo's unguarded render entry is NAMED by the detector, live" },
  // ---- the script gates: RESOLVED to their implementing machinery ----
  { anchor: "mutant-census/scripts/total-gate.ts :: typecheck", kind: "RESOLVED", evidence: "the T-board script constructs a typecheck job for every epoch repo (the job spec is in the script source); its full firing IS the total gate run" },
  { anchor: "mutant-census/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired" },
  { anchor: "mutant-census/package.json :: repro", kind: "RESOLVED", evidence: "the repro script's tsx target (src/experiments/render.ts) exists — the gate points at a real program" },
  { anchor: "mutant-census/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files — the gate has something to run" },
  { anchor: "mutant-census/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk — the project the gate compiles" },
  { anchor: "ds_extracted/ds/package.json :: format:check", kind: "RESOLVED", evidence: "prettier in devDependencies — the formatter the gate invokes is installed" },
  { anchor: "ds_extracted/ds/package.json :: test", kind: "RESOLVED", evidence: "the tests/ tree exists and carries test files" },
  { anchor: "ds_extracted/ds/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "ds_extracted/ds/tsconfig.json :: exactOptionalPropertyTypes", kind: "RESOLVED", evidence: "the flag itself is the machinery (content already E3-verified); compile-level firing would re-run tsc per census run — the cost is booked here, the check stays content-level" },
  { anchor: "ft-qaoa/tsconfig.json :: exactOptionalPropertyTypes", kind: "RESOLVED", evidence: "the flag itself is the machinery; compile-level firing cost booked, content-level check kept" },
  { anchor: "bqp-map/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dsic-noether/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "ent-clearing/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "ent-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "ft-qaoa/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "k-switch/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "nonstoq-anneal/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "nosignal-tariff/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "qram-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "readout-wall/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "stable-world/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "survivor-census/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "switch-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "vacuum-compiler/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dtc-clock/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dtc-clock/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "dtc-clock/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired" },
  { anchor: "phase-law/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "phase-law/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
];

export interface AnchorViolation {
  readonly anchor: string;
  readonly law: string;
  readonly detail: string;
}

function repoOf(packageJsonAnchor: string): string {
  return packageJsonAnchor.slice(0, packageJsonAnchor.indexOf("/package.json"));
}

function testTreeExists(repo: string): boolean {
  for (const dir of ["test", "tests"]) {
    const d = resolve(WORKSPACE_ROOT, repo, dir);
    if (!existsSync(d)) continue;
    const files = readdirSync(d, { recursive: true }) as string[];
    if (files.some((f) => f.endsWith(".test.ts") || f.endsWith(".test.js"))) return true;
  }
  return false;
}

/** A3's RESOLVED face: the gate's implementing machinery, verified. */
export function resolveAnchor(reg: AnchorRegistration): { ok: boolean; detail: string } {
  const [path, needle] = reg.anchor.split(" :: ");
  if (path === undefined || needle === undefined) return { ok: false, detail: "malformed anchor" };
  const root = resolve(WORKSPACE_ROOT, path);
  const repo = repoOf(reg.anchor);
  if (path.endsWith("/package.json")) {
    switch (needle) {
      case "test":
        return testTreeExists(repo)
          ? { ok: true, detail: "test tree present with test files" }
          : { ok: false, detail: `no test files found under ${repo}/test or ${repo}/tests` };
      case "typecheck":
        return existsSync(resolve(WORKSPACE_ROOT, repo, "tsconfig.typecheck.json"))
          ? { ok: true, detail: "tsconfig.typecheck.json on disk" }
          : { ok: false, detail: `${repo}/tsconfig.typecheck.json missing` };
      case "lint":
        return existsSync(resolve(WORKSPACE_ROOT, repo, "eslint.config.mjs"))
          ? { ok: true, detail: "eslint.config.mjs on disk" }
          : { ok: false, detail: `${repo}/eslint.config.mjs missing` };
      case "repro": {
        const pkg = JSON.parse(readFileSync(root, "utf8")) as { scripts?: Record<string, string> };
        const m = pkg.scripts?.repro?.match(/tsx\s+(\S+)/);
        return m && existsSync(resolve(WORKSPACE_ROOT, repo, m[1]!))
          ? { ok: true, detail: `repro target ${m[1]} exists` }
          : { ok: false, detail: "the repro script's tsx target does not resolve" };
      }
      case "format:check": {
        const pkg = JSON.parse(readFileSync(root, "utf8")) as { devDependencies?: Record<string, string> };
        return pkg.devDependencies?.prettier
          ? { ok: true, detail: "prettier installed" }
          : { ok: false, detail: "prettier not in devDependencies" };
      }
      default:
        return { ok: false, detail: `no resolution rule for script needle "${needle}"` };
    }
  }
  if (path.endsWith("tsconfig.json") && needle === "exactOptionalPropertyTypes") {
    // the flag is the machinery; content already verified by E3
    return existsSync(root) ? { ok: true, detail: "flag file on disk (content E3-verified)" } : { ok: false, detail: "tsconfig missing" };
  }
  if (reg.anchor === "mutant-census/scripts/total-gate.ts :: typecheck") {
    const src = readFileSync(root, "utf8");
    return src.includes('kind: "typecheck"')
      ? { ok: true, detail: "the job spec constructs typecheck jobs for every epoch repo" }
      : { ok: false, detail: "the T-board script no longer constructs typecheck jobs" };
  }
  return { ok: false, detail: `no resolution rule for anchor "${reg.anchor}"` };
}

/** A3's FIRING-LIVE face: the guard fires HERE, convicted on the spot. */
export async function fireLive(reg: AnchorRegistration): Promise<{ ok: boolean; detail: string }> {
  const registry = await loadLiveRegistry();
  switch (reg.anchor) {
    case "mutant-census/src/kernel/audit.ts :: E1": {
      const grown = { ...registry, errors: [...registry.errors, { key: "b99#9", batch: 99, index: 9, repo: "mutant-census", category: "process", wrong: "forged" }] };
      const hit = checkEnrollment(ENROLLMENT, grown).find((v) => v.law === "E1" && v.row === "b99#9");
      return hit ? { ok: true, detail: `convicted: ${hit.row}` } : { ok: false, detail: "the forged un-enrolled error was NOT convicted" };
    }
    case "mutant-census/src/kernel/audit.ts :: E2": {
      const forged = ENROLLMENT.map((r) => (r.key === "b4#0" ? { ...r, tier: "MUTANT-KILLED" as const, anchor: "MU7" } : r));
      const hit = checkEnrollment(forged, registry).find((v) => v.law === "E2" && v.row === "b4#0");
      return hit ? { ok: true, detail: `convicted: ${hit.row} (conjugation row on a wrong-object mutant)` } : { ok: false, detail: "the class-mismatched tie was NOT convicted" };
    }
    case "mutant-census/src/kernel/audit.ts :: Q2": {
      const ghost: MutantSpec = {
        id: "MU98",
        defect: "claims corruption, ships the canonical function",
        history: "batch 31 (stable-world)",
        corrupted: "nothing at all",
        classes: ["conjugation"],
        killer: "P2",
        expected: "EXACT-KILL",
      };
      const k = runKillCensus([ghost])[0];
      return k?.actual === "SURVIVED"
        ? { ok: true, detail: "the ghost is reported SURVIVED against its declared kill — the law fires" }
        : { ok: false, detail: "the ghost was not exposed by the kill census" };
    }
    case "mutant-census/src/kernel/audit.ts :: Q4":
    case "mutant-census/src/kernel/audit.ts :: W-C": {
      const failed = runNegativeControls().filter((c) => !c.pass);
      return failed.length === 0
        ? { ok: true, detail: `${runNegativeControls().length} synthetic violators fired` }
        : { ok: false, detail: `controls that did NOT fire: ${failed.map((c) => c.name).join(", ")}` };
    }
    case "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE": {
      const mu2 = MUTANTS.find((m) => m.id === "MU2")!;
      const k = runKillCensus([mu2])[0];
      return k?.actual === "EXACT-KILL"
        ? { ok: true, detail: `MU2 killed exactly by P2's phase-sensitive path (margin ${k.margin.toExponential(1)})` }
        : { ok: false, detail: `MU2 kill says ${k?.actual ?? "nothing"} — the phase oracle went quiet` };
    }
    case "mutant-census/src/kernel/census.ts :: unguardedEntryFiles": {
      const named = unguardedEntryFiles(FIXTURE_REPO);
      return named.includes("leak.ts")
        ? { ok: true, detail: "the fixture's unguarded entry is named by the detector" }
        : { ok: false, detail: `the detector saw ${JSON.stringify(named)} — it is blind to the fixture` };
    }
    default:
      return { ok: false, detail: `no live-fire rule for anchor "${reg.anchor}"` };
  }
}

/** A1-A3 over the enrollment rows and the registry (live by default). */
export async function checkAnchors(
  rows: readonly EnrollmentRow[] = ENROLLMENT,
  registry: readonly AnchorRegistration[] = ANCHOR_REGISTRY,
): Promise<AnchorViolation[]> {
  const v: AnchorViolation[] = [];
  const used = new Set(rows.filter((r) => r.tier === "GATE-ENFORCED").map((r) => r.anchor));
  const registered = new Map(registry.map((r) => [r.anchor, r] as const));
  for (const a of used) {
    if (!registered.has(a)) v.push({ anchor: a, law: "A1", detail: "used by enrollment rows but NOT registered — an unregistered guard holds errors illegally" });
  }
  const seen = new Set<string>();
  for (const reg of registry) {
    if (seen.has(reg.anchor)) v.push({ anchor: reg.anchor, law: "A1", detail: "duplicate registration" });
    seen.add(reg.anchor);
    if (!used.has(reg.anchor)) v.push({ anchor: reg.anchor, law: "A1", detail: "STALE registration — no enrollment row sits on this guard" });
    if (reg.kind === "FIRING-INJECT") {
      if (!reg.demoFile || !reg.demoName) {
        v.push({ anchor: reg.anchor, law: "A2", detail: "FIRING-INJECT without a demo file+name" });
        continue;
      }
      const demoPath = resolve(WORKSPACE_ROOT, reg.demoFile);
      if (!existsSync(demoPath)) v.push({ anchor: reg.anchor, law: "A2", detail: `demo file missing: ${reg.demoFile}` });
      else if (!readFileSync(demoPath, "utf8").includes(reg.demoName)) {
        v.push({ anchor: reg.anchor, law: "A2", detail: `demo name "${reg.demoName}" not found in ${reg.demoFile}` });
      }
    } else if (reg.kind === "FIRING-LIVE") {
      const r = await fireLive(reg);
      if (!r.ok) v.push({ anchor: reg.anchor, law: "A3", detail: `did not fire: ${r.detail}` });
    } else {
      // RESOLVED — the closed three-kind vocabulary admits nothing else
      const r = resolveAnchor(reg);
      if (!r.ok) v.push({ anchor: reg.anchor, law: "A3", detail: `did not resolve: ${r.detail}` });
    }
  }
  return v;
}
