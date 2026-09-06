/**
 * THE LIVE CENSUSES — K and W boards. Both run against the REAL workspace on
 * every `npm test`: the kernel family's byte-identity across every repo
 * (an unregistered drift fails the build — the batch-23 class, silent
 * contract drift in a reused file), and the 26 repos' engineering hygiene
 * (scripts, strict TS, entry guards). Registrations are data; reality is
 * computed. Where they disagree, the build says so.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

/** The five files of the shared kernel family (byte-copied lineage). */
export const FAMILY_FILES = ["cmat.ts", "states.ts", "channels.ts", "rng.ts", "measures.ts"] as const;

/** The 26 epoch repos of the workspace (the main platform lives elsewhere and
 * is not a family member). */
export const EPOCH_REPOS: readonly string[] = [
  "bqp-map",
  "depreciation-ledger",
  "route-price",
  "burial-record",
  "readout-wall",
  "nosignal-tariff",
  "choice-lang",
  "binding-price",
  "letter-audit",
  "wukong-crossval",
  "survivor-census",
  "ent-clearing",
  "postselect-sched",
  "retro-cache",
  "stable-world",
  "qverify",
  "qram-sched",
  "nonstoq-anneal",
  "quantum-mech",
  "ent-sched",
  "vacuum-compiler",
  "dsic-noether",
  "ft-qaoa",
  "switch-sched",
  "causal-ineq",
  "k-switch",
  "dtc-clock",
  "phase-law",
];

export interface DivergenceRegistration {
  readonly repo: string;
  readonly file: string;
  readonly reason: string;
}

/**
 * Registered divergences from the canonical family — censused 2026-09-06 and
 * REGISTERED, not adjudicated: the census records that these bytes differ and
 * why they are allowed to; whether they SHOULD is each repo's appeal court.
 */
export const REGISTERED_DIVERGENCES: readonly DivergenceRegistration[] = [
  // -- the 2026-09-06 strict-mode upgrade window --------------------------------
  // Each family member's repair agent fixed its own copy under the three new
  // compiler switches; assertion placement differs repo-to-repo, so the bytes
  // drifted during the window. Registered as debt, not adjudicated: whether a
  // member re-converges to the census canon (or the canon adopts its variant)
  // is the family's appeal court.
  { repo: "readout-wall", file: "cmat.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "readout-wall", file: "channels.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "readout-wall", file: "measures.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "nosignal-tariff", file: "cmat.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "nosignal-tariff", file: "measures.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "choice-lang", file: "cmat.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "choice-lang", file: "measures.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "binding-price", file: "cmat.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "binding-price", file: "measures.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "letter-audit", file: "cmat.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "letter-audit", file: "measures.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "ent-clearing", file: "cmat.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "ent-clearing", file: "measures.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "quantum-mech", file: "cmat.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "quantum-mech", file: "measures.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  // -- long-standing registered lineages ----------------------------------------
  { repo: "quantum-mech", file: "states.ts", reason: "an independent states module, reconciled on 2026-09-06 onto the strict-mode canon with its original anchors (RPLUS, LPLUS, BELL_PHI_PLUS, bellState, ghz, w3, werner, HADAMARD, randomPureState, valueKet) appended; shares the other files where byte-identical" },
  { repo: "qverify", file: "states.ts", reason: "an independent states module (plus its own gates.ts), reconciled on 2026-09-06 onto the strict-mode canon with its original qverify extensions (fromVec, equatorial, equatorialRho, bellState, schmidtState, wernerFidelity, randomTwoQubitMixed, PAULIS, HADAMARD)" },
  { repo: "causal-ineq", file: "cmat.ts", reason: "a collateral cmat lineage, single-repo" },
  { repo: "k-switch", file: "cmat.ts", reason: "a collateral cmat lineage, single-repo" },
  { repo: "vacuum-compiler", file: "cmat.ts", reason: "a collateral cmat lineage, single-repo" },
  { repo: "bqp-map", file: "rng.ts", reason: "the atlas's own rng, predating the family canon" },
  { repo: "qram-sched", file: "rng.ts", reason: "the scheduler's own rng lineage" },
  { repo: "dsic-noether", file: "rng.ts", reason: "own rng lineage" },
  { repo: "ent-sched", file: "rng.ts", reason: "own rng lineage" },
  { repo: "ft-qaoa", file: "rng.ts", reason: "own rng lineage" },
  { repo: "nonstoq-anneal", file: "rng.ts", reason: "own rng lineage" },
];

export type FamilyStatus =
  | "IDENTICAL"
  | "REGISTERED-DIVERGENCE"
  | "UNREGISTERED-DIVERGENCE"
  | "STALE-REGISTRATION"
  | "NOT-PRESENT";

export interface FamilyScanRow {
  readonly repo: string;
  readonly file: string;
  readonly status: FamilyStatus;
  readonly hash: string;
}

function sha256Of(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

/** K-board: live scan of the family's byte-identity across the workspace. */
export function scanFamily(): { rows: readonly FamilyScanRow[]; canonical: Record<string, string> } {
  const canonical: Record<string, string> = {};
  for (const file of FAMILY_FILES) canonical[file] = sha256Of(resolve(process.cwd(), "src", "core", file));
  const rows: FamilyScanRow[] = [];
  for (const repo of EPOCH_REPOS) {
    for (const file of FAMILY_FILES) {
      const path = resolve(WORKSPACE_ROOT, repo, "src", "core", file);
      if (!existsSync(path)) {
        rows.push({ repo, file, status: "NOT-PRESENT", hash: "-" });
        continue;
      }
      const hash = sha256Of(path);
      const registered = REGISTERED_DIVERGENCES.some((d) => d.repo === repo && d.file === file);
      if (hash === canonical[file]) {
        rows.push({ repo, file, status: registered ? "STALE-REGISTRATION" : "IDENTICAL", hash });
      } else {
        rows.push({ repo, file, status: registered ? "REGISTERED-DIVERGENCE" : "UNREGISTERED-DIVERGENCE", hash });
      }
    }
  }
  return { rows, canonical };
}

export interface LegacyRegistration {
  readonly repo: string;
  readonly reason: string;
}

/**
 * The pre-batch-21 guard debt was PAID in full (batch 33): 42 experiment
 * entries across 11 repos retrofitted with the house entry guard, every
 * affected gate re-run green, repro verified on all three retrofit shapes.
 * The register stays EMPTY and the law is now absolute: an unguarded render
 * entry anywhere in the 26 epoch repos fails the build — there is no
 * exemption path left.
 */
export const LEGACY_REPOS: readonly LegacyRegistration[] = [];

/** The main platform repo — censused with a registered platform exemption:
 * test + typecheck are mandatory; `repro` is NOT required of it (its
 * reproducibility object is the GENESIS-A bench suite, a registered debt on
 * the ledger's #03 line, not a missing hygiene flag). */
export const PLATFORM_REPOS: ReadonlyArray<{ repo: string; note: string }> = [
  { repo: "ds_extracted/ds", note: "repro ≡ GENESIS target A (QuantumSched-Bench), registered debt; test+typecheck mandatory" },
];

export interface WorkspaceScanRow {
  readonly repo: string;
  readonly scriptsOk: boolean;
  readonly strictOk: boolean;
  readonly unguardedEntries: readonly string[];
  readonly guardRegistered: boolean;
  readonly reportCount: number;
  readonly isPlatform: boolean;
}

/** An UNGUARDED ENTRY: a source file that renders a report but neither carries
 * the entry guard nor is the shared writeReport library itself. */
export function unguardedEntryFiles(repo: string): string[] {
  const srcDir = resolve(WORKSPACE_ROOT, repo, "src");
  if (!existsSync(srcDir)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.name.endsWith(".ts")) continue;
      const content = readFileSync(full, "utf8");
      const renders = content.includes("writeReport(") || content.includes("writeFileSync(");
      const guarded = content.includes("import.meta.url");
      const isLibrary = content.includes("export function writeReport");
      if (renders && !guarded && !isLibrary) out.push(ent.name);
    }
  };
  walk(srcDir);
  return out;
}

/** W-board: live scan of the workspace's engineering hygiene — the 26 epoch
 * repos under the full law, the platform repo under its registered
 * exemption (test+typecheck mandatory, repro ≡ GENESIS-A debt). */
export function scanWorkspace(): readonly WorkspaceScanRow[] {
  const rows: WorkspaceScanRow[] = [];
  const scanOne = (repo: string, isPlatform: boolean): WorkspaceScanRow => {
    const root = resolve(WORKSPACE_ROOT, repo);
    let scriptsOk: boolean;
    let strictOk: boolean;
    try {
      const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
        scripts?: Record<string, string>;
      };
      // epoch repos: test+typecheck+repro; the platform: test+typecheck (repro is the GENESIS-A debt)
      scriptsOk = isPlatform
        ? Boolean(pkg.scripts?.test && pkg.scripts.typecheck)
        : Boolean(pkg.scripts?.test && pkg.scripts.typecheck && pkg.scripts.repro);
    } catch {
      scriptsOk = false;
    }
    try {
      const ts = readFileSync(resolve(root, "tsconfig.json"), "utf8");
      strictOk = /"strict"\s*:\s*true/.test(ts);
    } catch {
      strictOk = false;
    }
    const unguarded = unguardedEntryFiles(repo);
    const guardRegistered = LEGACY_REPOS.some((l) => l.repo === repo);
    let reportCount: number;
    try {
      reportCount = readdirSync(resolve(root, "out", "reports")).filter((f) => f.endsWith(".md")).length;
    } catch {
      reportCount = 0;
    }
    return { repo, scriptsOk, strictOk, unguardedEntries: unguarded, guardRegistered, reportCount, isPlatform };
  };
  for (const repo of EPOCH_REPOS) rows.push(scanOne(repo, false));
  for (const p of PLATFORM_REPOS) rows.push(scanOne(p.repo, true));
  return rows;
}
