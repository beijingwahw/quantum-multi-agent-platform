/**
 * THE LIVE CENSUSES — K and W boards. Both run against the REAL workspace on
 * every `npm test`: the kernel family's byte-identity across every repo
 * (an unregistered drift fails the build — the batch-23 class, silent
 * contract drift in a reused file), and the 28 epoch repos' engineering hygiene
 * (scripts, strict TS, entry guards). Registrations are data; reality is
 * computed. Where they disagree, the build says so.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

/** The five files of the shared kernel family (byte-copied lineage). */
export const FAMILY_FILES = ["cmat.ts", "states.ts", "channels.ts", "rng.ts", "measures.ts"] as const;

/** The 28 epoch repos of the workspace (the main platform lives elsewhere and
 * is not a family member). SINGLE-SOURCED since v0.10.0 (the b37#7 repair):
 * total-gate.ts imports this list — a second literal copy is a convicted
 * shape (the census.test.ts :: b37#7 guard reads the script's source). */
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
  // is the family's appeal court. THE APPEAL COURT'S PASS (batch 79's wiring
  // visit): twelve of the window's registrations went STALE — the delivery
  // waves re-converged nosignal-tariff/choice-lang/binding-price/letter-audit/
  // ent-clearing/quantum-mech cmat+measures and readout-wall measures to the
  // canon byte-for-byte — their debt entries are pruned here so the register
  // matches reality exactly (0 unregistered, 0 stale).
  { repo: "readout-wall", file: "cmat.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  { repo: "readout-wall", file: "channels.ts", reason: "2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call" },
  // -- the batch-77 wave appends (v0.2.0 faces onto the canon channels) ------
  { repo: "binding-price", file: "channels.ts", reason: "the v0.2.0 noisy-commit census appended its own noise face to the canon (dephaseKraus, ampDampKraus with the strength guard, noiseKraus, applyNoise — the quantum-mech channels.ts precedent one wave later), and the v0.3.0 quality sweep then DELETED four of the canon's own faces this member never called (applyUnitary, depolarize, marginalProbs, filterBasisDigit — the E face under a registered divergence, the nosignal-tariff b83 precedent); the canon's surviving faces are untouched between the append and the deletions; re-convergence is the appeal court's call" },
  { repo: "ent-clearing", file: "channels.ts", reason: "the v0.2.0 purification desk appended partialTranspose to the canon (the negativity/per-cut machinery) and the v0.3.0 quality sweep hardened the refusals with EC_-coded names (EC_DIMS, EC_INDEX, EC_DIMS_MISMATCH) with the dims-product check hoisted to a named guard; the canon's algorithmic faces are untouched between the append and the hardening; re-convergence is the appeal court's call" },
  { repo: "ent-clearing", file: "measures.ts", reason: "the 2026-09-06 strict-mode window's last live cmat-adjacent variant, further diverged at v0.3.0: the dead Uhlmann fidelity face deleted (zero references — pure references take <psi|rho|psi>, mixed-vs-mixed takes trace distance; the canon and quantum-mech/qverify carry the general path if the appeal court wants it back) and the negativity face appended against partialTranspose; re-convergence is the appeal court's call" },
  // -- long-standing registered lineages ----------------------------------------
  { repo: "quantum-mech", file: "states.ts", reason: "an independent states module, reconciled on 2026-09-06 onto the strict-mode canon with its original anchors (RPLUS, LPLUS, BELL_PHI_PLUS, bellState, ghz, w3, werner, HADAMARD, randomPureState, valueKet) appended; shares the other files where byte-identical" },
  { repo: "quantum-mech", file: "channels.ts", reason: "the v0.2.0 erasure-robustness census appended its own noise face to the canon (phaseFlipKraus, amplitudeDampKraus with the gamma guard, applyQubitChannel the register-wide applier; import line widened for identity/kronAll) — the canon's face is untouched above the append; re-convergence is the appeal court's call" },
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
  // -- the batch-82 wave append (the quality wave's dead-code purge) -----------
  // phase-law's v0.6.0 E face deleted the 994-line quantum-template leftovers
  // (src/core/{cmat,states,measures,channels}.ts gone wholesale — those files
  // read NOT-PRESENT, a legal status) and pared rng.ts's dead exports; the
  // surviving rng.ts bytes differ from the canon. Registered as debt, not
  // adjudicated: whether the member re-converges (or drops the file entirely)
  // is the appeal court's call.
  { repo: "phase-law", file: "rng.ts", reason: "the v0.6.0 dead-export purge removed this member's unused rng exports (the E face of the quality wave; the template-era cmat/states/measures/channels files were deleted outright and read NOT-PRESENT); re-convergence is the appeal court's call" },
  // -- the batch-83 wave append (the absorption law's first execution, the
  // v0.3.0 E face) ------------------------------------------------------------
  // nosignal-tariff's absorption sweep deleted the dead faces the canon still
  // carries: states.ts wholesale (reads NOT-PRESENT, a legal status — no row
  // needed, the phase-law precedent) and the unused exports of the four
  // surviving family files, so their bytes diverge from the canon. Registered
  // as debt, not adjudicated: whether the canon sheds its own dead faces (or
  // the member re-converges) is the appeal court's call.
  { repo: "nosignal-tariff", file: "cmat.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused cmat exports (21 dead faces, grep-verified zero-reference; states.ts was deleted outright and reads NOT-PRESENT); the canon's face is untouched above the deletions; re-convergence is the appeal court's call" },
  { repo: "nosignal-tariff", file: "channels.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused channels exports (4 dead faces, grep-verified zero-reference); the canon's face is untouched above the deletions; re-convergence is the appeal court's call" },
  { repo: "nosignal-tariff", file: "measures.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused measures exports (4 dead faces, grep-verified zero-reference); the canon's face is untouched above the deletions; re-convergence is the appeal court's call" },
  { repo: "nosignal-tariff", file: "rng.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused rng exports (4 dead faces, grep-verified zero-reference); the canon's face is untouched above the deletions; re-convergence is the appeal court's call" },
  // -- the batch-85 wave appends (the quality wave's fourth batch, the E faces
  // of binding-price/ent-clearing/choice-lang 0.3.0) --------------------------
  // ent-clearing's family copies were hardened-and-deleted past the canon in
  // three files (cmat/states/rng), choice-lang's absorption sweep pared two
  // (cmat/rng) and deleted states/channels/measures outright (NOT-PRESENT, a
  // legal status — the phase-law precedent, no row needed). Registered as
  // debt, not adjudicated: whether the canon sheds its own dead faces (or the
  // members re-converge) is the appeal court's call — priced, not settled
  // privately.
  { repo: "ent-clearing", file: "cmat.ts", reason: "the v0.3.0 quality sweep hardened this member's cmat copy (the refusals EC_-coded: EC_SHAPE on mMul, EC_KRON_EMPTY on kronAll; the dead mTrace/vecToMat/matToVec/isHermitian faces deleted; the at4() tuple-slot accessor and the degenerate-clusterIndices helper appended for the Bell-quartet and eigen work); the canon's algorithmic faces are untouched between the changes; re-convergence is the appeal court's call" },
  { repo: "ent-clearing", file: "states.ts", reason: "the v0.3.0 quality sweep deleted this member's dead states faces (uniformVec/uniformOrthVec/rotY/weyl gone — weyl survives in the canon and quantum-mech/qverify) and single-sourced rho on cmat.outer; the canon's surviving faces are untouched; re-convergence is the appeal court's call" },
  { repo: "ent-clearing", file: "rng.ts", reason: "the v0.3.0 quality sweep replaced the `as Rng` cast construction with an Object.assign shape (the bit stream byte-identical, the A face of the wave); the canon still casts; re-convergence is the appeal court's call" },
  { repo: "choice-lang", file: "cmat.ts", reason: "the v0.3.0 absorption sweep deleted this member's uncalled solver faces (the Jacobi and inverse-iteration eigensolvers, 601 -> 155 lines — the twin survives in qverify/src/core/cmat.ts and the canon); re-convergence is the appeal court's call" },
  { repo: "choice-lang", file: "rng.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused rng exports (int/normal/pick/fmt — the live consumers draw bare doubles, the bit stream byte-identical); re-convergence is the appeal court's call" },
  // -- the batch-86 wave appends (the quality wave's fifth batch, the E/A/D
  // faces of stable-world 0.7.0 and dtc-clock 0.21.0) ------------------------
  // BOTH former full members (byte-identical to the canon in all five family
  // files) pared their kernels in the same wave: stable-world — the lineage
  // ROOT the canon was byte-copied from — deleted its dead exports (states
  // 13, cmat 9, channels 2, measures 2, rng 3, the fidelity/Holevo faces
  // among them carrying silent clamping guards) and cleared its two casts
  // (rng's Object.assign shape, cmat's narrowed loop); dtc-clock deleted 23
  // dead exports across its tree (states 8, cmat 4, channels 2, rng 1, with
  // measures touched by the same quality faces). The full-member count drops
  // four -> two (letter-audit and switch-sched stand). Registered as debt,
  // not adjudicated: whether the canon sheds its own dead faces (or the
  // members re-converge — the ROOT divergence the first of its kind) is the
  // appeal court's call.
  { repo: "stable-world", file: "cmat.ts", reason: "the v0.7.0 quality sweep deleted this member's dead cmat exports (9 zero-reference faces) and narrowed the Float64Array cast loop (the A face); the canon's algorithmic faces are untouched between the deletions; re-convergence is the appeal court's call (the lineage root pared while the canon stands — the family's first rootward divergence)" },
  { repo: "stable-world", file: "states.ts", reason: "the v0.7.0 quality sweep deleted this member's dead states exports (13 zero-reference faces); the canon's surviving faces are untouched; re-convergence is the appeal court's call" },
  { repo: "stable-world", file: "channels.ts", reason: "the v0.7.0 quality sweep deleted this member's dead channels exports (2 zero-reference faces); the canon's surviving faces are untouched; re-convergence is the appeal court's call" },
  { repo: "stable-world", file: "measures.ts", reason: "the v0.7.0 quality sweep deleted this member's dead measures exports (2 zero-reference faces, fidelity/holeho among them with their silent clamping guards — the shared-family kernel absorbed their deletion as c-class, priced not settled); re-convergence is the appeal court's call" },
  { repo: "stable-world", file: "rng.ts", reason: "the v0.7.0 quality sweep deleted this member's unused rng exports (3 zero-reference faces) and replaced the `as Rng` cast with an Object.assign shape (the bit stream byte-identical, the A face); the canon still casts; re-convergence is the appeal court's call" },
  { repo: "dtc-clock", file: "cmat.ts", reason: "the v0.21.0 quality sweep deleted this member's dead cmat exports (4 zero-reference faces) and cleared its real casts (the A/D faces); the canon's algorithmic faces are untouched between the deletions; re-convergence is the appeal court's call" },
  { repo: "dtc-clock", file: "states.ts", reason: "the v0.21.0 quality sweep deleted this member's dead states exports (8 zero-reference faces); the canon's surviving faces are untouched; re-convergence is the appeal court's call" },
  { repo: "dtc-clock", file: "channels.ts", reason: "the v0.21.0 quality sweep deleted this member's dead channels exports (2 zero-reference faces); the canon's surviving faces are untouched; re-convergence is the appeal court's call" },
  { repo: "dtc-clock", file: "rng.ts", reason: "the v0.21.0 quality sweep deleted this member's unused rng export (1 zero-reference face) and refactored the construction to the Object.assign shape (the bit stream byte-identical); re-convergence is the appeal court's call" },
  { repo: "dtc-clock", file: "measures.ts", reason: "the v0.21.0 quality sweep's faces touched this member's measures copy (the dead-export and cast-clearance passes); the canon's algorithmic faces are untouched; re-convergence is the appeal court's call" },
  // -- the batch-87 wave append (the quality wave's sixth and FINAL batch, the
  // E faces of letter-audit 0.3.0 and switch-sched 0.3.0) ----------------------
  // The wave cleared BOTH remaining full members in one stroke: letter-audit
  // deleted its whole src/core directory (1,048 lines, zero references
  // workspace-wide) — all five family files read NOT-PRESENT there, a legal
  // status needing no row (the phase-law precedent) — and switch-sched's
  // absorption sweep pared four of its five copies (measures untouched,
  // still byte-identical to the canon). The full-member count drops to ZERO:
  // the canon now stands alone, every epoch member either diverged-registered
  // or not-present. Registered as debt, not adjudicated: whether the canon
  // sheds its own dead faces (or any member re-converges) is the appeal
  // court's call.
  { repo: "switch-sched", file: "cmat.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused cmat exports (vAdd/vKron/vecToMat/matToVec/fromSpectral, grep-verified zero-reference; the C face's kronRho callers moved to the canon's kron in the same wave); the canon's surviving faces are untouched between the deletions; re-convergence is the appeal court's call" },
  { repo: "switch-sched", file: "states.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused states exports (maximallyMixed/eye; the gypi z0/z1 callers moved to KET0/KET1 in the same wave); the canon's surviving faces are untouched; re-convergence is the appeal court's call" },
  { repo: "switch-sched", file: "channels.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused channels exports (depolarize and filterBasisDigit); the canon's algorithmic faces are untouched between the deletions; re-convergence is the appeal court's call" },
  { repo: "switch-sched", file: "rng.ts", reason: "the v0.3.0 absorption sweep deleted this member's unused rng export (fmt; the Box-Muller callers moved to the canon's complexGaussian in the same wave); the bit stream is untouched; re-convergence is the appeal court's call" },
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

/** The registered files that legitimately live at the WORKSPACE ROOT itself.
 * Everything else bearing a code extension at the root is a STRAY: the root
 * is not a scratch home (the b22#2/b33#0/b49#2/b54#0 placement class — this
 * detector holds the ROOT face, the one sighted at b54#0; the system-temp
 * face lives outside the workspace tree and stays booked on its own rows). */
export const REGISTERED_ROOT_FILES: readonly string[] = ["probe.ts"];

/** The root-stray detector, PURE over a name list — the forged-listing fire
 * demo injects here, so no witness ever mutates the filesystem. */
export function rootStrayFiles(names: readonly string[]): string[] {
  return names.filter((n) => /\.(ts|tsx|js|mjs|cjs)$/.test(n) && !REGISTERED_ROOT_FILES.includes(n));
}

/** The live face: the workspace root's own direct FILE children (directories
 * are not files; the repos own their trees). */
export function liveRootStrayFiles(root = WORKSPACE_ROOT): string[] {
  const names = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name);
  return rootStrayFiles(names);
}
