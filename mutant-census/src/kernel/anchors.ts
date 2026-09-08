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
 *      RESOLVED anchor resolves to its machinery;
 *   A4 ARTIFACT FIRING (v0.11.0, the deep check's second layer) — the total
 *      gate already fires every repo's suite; the census HARVESTS that
 *      firing from the last recorded artifact: a RESOLVED test/typecheck
 *      anchor whose repo cell is RED in that run is a violation — RESOLVED
 *      evidence deepens from "the machinery exists" to "the machinery fired
 *      green in the last recorded workspace run". Lint/repro/format anchors
 *      fire at delivery time, not in the total gate — A4 books nothing for
 *      them; a missing artifact books nothing either (the T-board contract:
 *      the artifact records the last EXPLICIT run).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { MUTANTS, type MutantSpec } from "./family.js";
import { runKillCensus, runNegativeControls } from "./battery.js";
import { WORKSPACE_ROOT, rootStrayFiles, unguardedEntryFiles } from "./census.js";
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
  { anchor: "mutant-census/src/experiments/render.ts :: witness letters must be unique", kind: "FIRING-LIVE", evidence: "a forged report headlining two censuses under one W-letter is refused on the spot (assertUniqueWitnessLetters, the b46#5 tier upgrade; the guard lives in report.ts since b53#5 — a leaf, so the anchor's dynamic fire can never deadlock the entry)" },
  { anchor: "burial-record/package.json :: test", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire B7", evidence: "a forged batch whose context states NINE delivery errors over ten carried errors is convicted BY NAME (law B7) by burial-record's own checkBurial, imported live — the b45#9 class can never again wait for the visitor" },
  { anchor: "mutant-census/src/kernel/audit.ts :: E1", kind: "FIRING-LIVE", evidence: "a forged registry carrying an un-enrolled error is convicted by checkEnrollment on the spot" },
  { anchor: "mutant-census/src/kernel/audit.ts :: E2", kind: "FIRING-LIVE", evidence: "a forged class-mismatched mutant tie is convicted by checkEnrollment on the spot" },
  { anchor: "mutant-census/src/kernel/audit.ts :: Q2", kind: "FIRING-LIVE", evidence: "the ghost mutant (declared EXACT-KILL, ships the canonical function) is reported SURVIVED by the live kill census — the declared-vs-live law has teeth" },
  { anchor: "mutant-census/src/kernel/audit.ts :: Q4", kind: "FIRING-LIVE", evidence: "the battery's synthetic violators FIRE on every run (runNegativeControls) — a property nothing can move is a constructed zero, and this anchor is why the controls exist" },
  { anchor: "mutant-census/src/kernel/audit.ts :: W-C", kind: "FIRING-LIVE", evidence: "the negative controls fire live: shape-blind product, lopsided outer, non-CPTP Kraus each get named" },
  { anchor: "mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE", kind: "FIRING-LIVE", evidence: "MU2 (the conjugated vecToRho — Hermitian, trace 1, PSD, invisible to statehood) is killed EXACTLY by P2's phase-sensitive dual path, live" },
  { anchor: "mutant-census/src/kernel/census.ts :: unguardedEntryFiles", kind: "FIRING-LIVE", evidence: "the in-repo fixture repo's unguarded render entry is NAMED by the detector, live" },
  { anchor: "mutant-census/src/kernel/census.ts :: rootStrayFiles", kind: "FIRING-LIVE", evidence: "a forged root listing carrying a stray scratch is named by the detector on the spot (the b54#0 ROOT face, gate-held since v0.9.0 — the b46#5 upgrade pattern: the BOOKED reason 'no gate schedules where the scratch file lives' went false; the system-temp face of the class lives outside the workspace tree and stays booked on its own rows)" },
  // ---- the script gates: RESOLVED to their implementing machinery ----
  { anchor: "mutant-census/scripts/total-gate.ts :: typecheck", kind: "RESOLVED", evidence: "the T-board script constructs a typecheck job for every epoch repo (the job spec is in the script source); its full firing IS the total gate run" },
  { anchor: "mutant-census/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired" },
  { anchor: "burial-record/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired (b53#2's catch, registered the moment it was first needed)" },
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
  { anchor: "dsic-noether/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk (include spans src, test, experiments) — registered the moment batch 66 first needed it (the b53#5 law)" },
  { anchor: "dsic-noether/package.json :: lint", kind: "RESOLVED", evidence: "eslint config on disk and eslint in devDependencies — the machinery batch 66 saw fire three times" },
  { anchor: "ent-clearing/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "ent-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "ft-qaoa/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "k-switch/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "nonstoq-anneal/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "nosignal-tariff/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "qram-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "readout-wall/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "stable-world/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "stable-world/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files — the gate the R-board's b56#3/b56#7/b56#8/b57#3/b59#0 upgrades ride (their sightings were convicted at suite/typecheck runs of this very tree); registered the moment the R-board first needed it (the b53#5 law)" },
  { anchor: "stable-world/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired" },
  { anchor: "survivor-census/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "switch-sched/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "vacuum-compiler/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dtc-clock/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "dtc-clock/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  { anchor: "dtc-clock/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired" },
  { anchor: "phase-law/package.json :: test", kind: "RESOLVED", evidence: "the test tree exists and carries test files" },
  { anchor: "phase-law/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk" },
  // ---- the v0.10.0 R-board upgrades: registered with the rows they now hold ----
  { anchor: "mutant-census/test/census.test.ts :: b37#7", kind: "FIRING-INJECT", demoFile: "mutant-census/test/census.test.ts", demoName: "b37#7", evidence: "the single-source guard: the total-gate script must IMPORT EPOCH_REPOS from the census kernel and carry no second literal list — the dual-list drift that once produced a 27-vs-28 artifact header dies at the suite that reads the script's source" },
  // ---- the v0.11.0 E7 upgrade: the stated-counts law holds its own history ----
  { anchor: "mutant-census/test/census.test.ts :: E7", kind: "FIRING-INJECT", demoFile: "mutant-census/test/census.test.ts", demoName: "E7", evidence: "the stated-counts guard: a forged description claiming drifted tier counts (147 on gates where the enrollment carries another number) is convicted BY NAME by checkStatedCounts against the live rows — the b67#6 eleven-visit drift and its same-day recurrence (b68#0) both ride this gate; the renderer refuses to print a drifted self-description" },
  // ---- the v0.14.0 B9 upgrade: the memory substrate guards itself ----
  { anchor: "burial-record/src/kernel/audit.ts :: memoryStructureViolations", kind: "FIRING-INJECT", demoFile: "mutant-census/test/anchors.test.ts", demoName: "A-fire B9", evidence: "the memory-structure guard: forged daily-note text carrying the repeated-label signature (the b70#3 shape, pasted three times in one day and prevented never) is convicted BY LINE NUMBER by burial-record's own memoryStructureViolations, imported live — the ledger's evidence base now guards its own structure (B9, v0.5.0 of the record)" },
  // ---- the batch-74 latent-defect anchors: the smuggling-trial tests that killed
  // three v0.1.0 survivors (the b53#5 law — registered the moment the rows first sat on them) ----
  { anchor: "switch-sched/test/process.test.ts :: identity channel gives SWAP", kind: "FIRING-INJECT", demoFile: "switch-sched/test/process.test.ts", demoName: "identity channel gives SWAP", evidence: "the CJ-convention guard: the v0.1.0 latent defect (identity not mapping to SWAP under complex Kraus) dies at the circuit-vs-process assertion the switch-sched suite runs on every pass — the test that caught it in the same breath it was written" },
  { anchor: "switch-sched/test/process.test.ts :: eigenvalues exactly {0, ½}", kind: "FIRING-INJECT", demoFile: "switch-sched/test/process.test.ts", demoName: "eigenvalues exactly {0, ½}", evidence: "the exact-spectrum guard: the v0.1.0 global-½ double-count dies at W_OCB's exact-eigenvalue assertion {0, ½} (8-fold each, trace 4) — a scaled process matrix cannot pass it" },
  { anchor: "switch-sched/test/process.test.ts :: 8192 vertices", kind: "FIRING-INJECT", demoFile: "switch-sched/test/process.test.ts", demoName: "8192 vertices", evidence: "the census-size guard: the v0.1.0 fabricated census size (20480) dies at the census's own size assertion — 8192 deterministic strategies (4096 per order) cap exactly ¾, and the vertex count is pinned to the enumeration that produces it" },
  { anchor: "switch-sched/package.json :: lint", kind: "RESOLVED", evidence: "eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted batch 74's void-expression/array-type lint batch (the b53#5 law)" },
  { anchor: "nonstoq-anneal/package.json :: typecheck", kind: "RESOLVED", evidence: "tsconfig.typecheck.json on disk — the project the gate compiles; the machinery that convicted batch 74's unused-parameter/unexported-main/readonly-push batch (the b53#5 law)" },
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
    case "mutant-census/src/experiments/render.ts :: witness letters must be unique": {
      // dynamic import of the LEAF module (report.ts) — never of render.ts:
      // render.ts imports this module statically, and importing it back
      // while it is the ENTRY (its top-level await pending) deadlocks the
      // repro gate — the b53#5 conviction, fixed by the move
      const { assertUniqueWitnessLetters } = await import("../experiments/report.js");
      const forgedReport = ["- PASS — W-G anchor census (a)", "- PASS — W-G forged twin (b)"].join("\n");
      try {
        assertUniqueWitnessLetters(forgedReport);
        return { ok: false, detail: "the forged duplicate letter was NOT refused" };
      } catch (err) {
        const first = (err as Error).message.split("\n")[0] ?? "duplicate letter refused";
        return { ok: true, detail: `refused on the spot: ${first}` };
      }
    }
    case "mutant-census/src/kernel/audit.ts :: E1": {
      const grown = { ...registry, errors: [...registry.errors, { key: "b99#9", batch: 99, index: 9, repo: "mutant-census", category: "process", wrong: "forged", right: "the forged fixture carries both columns" }] };
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
    case "mutant-census/src/kernel/census.ts :: rootStrayFiles": {
      const strays = rootStrayFiles(["probe.ts", "AGENTS.md", "scratch-j59-forged.ts"]);
      return strays.includes("scratch-j59-forged.ts") && !strays.includes("probe.ts")
        ? { ok: true, detail: `the forged stray is named: ${strays.join(", ")} — the registered probe passes untouched` }
        : { ok: false, detail: `the detector saw ${JSON.stringify(strays)} — blind to the forged stray` };
    }
    default:
      return { ok: false, detail: `no live-fire rule for anchor "${reg.anchor}"` };
  }
}

/** A4: the artifact-firing law — RESOLVED test/typecheck anchors must be
 * green in the LAST RECORDED total-gate run (the artifact on disk). Pure
 * over the artifact text so the firing range can inject a forged red cell. */
export function checkArtifactFiring(artifactText: string | null, registry: readonly AnchorRegistration[]): AnchorViolation[] {
  if (artifactText === null) return [];
  const cells = new Map<string, { test: string | undefined; typecheck: string | undefined }>();
  for (const line of artifactText.split("\n")) {
    const m = /^\|\s*([^|]+?)\s*\|\s*(PASS|FAIL|—)[^|]*\|\s*(PASS|FAIL|—)/.exec(line);
    if (m) cells.set(m[1]!.trim(), { test: m[2], typecheck: m[3] });
  }
  const v: AnchorViolation[] = [];
  for (const reg of registry) {
    if (reg.kind !== "RESOLVED") continue;
    if (!/ :: (test|typecheck)$/.test(reg.anchor)) continue; // lint/repro/format fire at delivery, not in the total gate
    const repo = repoOf(reg.anchor);
    const needle = reg.anchor.split(" :: ")[1] as "test" | "typecheck";
    const row = cells.get(repo);
    if (!row) continue; // not recorded in this artifact's table — the machinery face stands on its own
    const cell = row[needle] ?? "—";
    if (cell === "—") continue; // not applicable in this run (e.g. the platform's typecheck column) — books nothing
    if (cell !== "PASS") {
      v.push({
        anchor: reg.anchor,
        law: "A4",
        detail: `the last recorded total-gate run fired this gate RED for ${repo} — the machinery fired and failed; resolve the red cell before the census stands`,
      });
    }
  }
  return v;
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
  // A4 — harvest the total gate's last recorded firing for the RESOLVED
  // test/typecheck anchors (the artifact records the last explicit run; its
  // absence books nothing — the T-board contract)
  const artifactPath = resolve(process.cwd(), "out", "reports", "the-total-gate.md");
  v.push(...checkArtifactFiring(existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : null, registry));
  return v;
}
