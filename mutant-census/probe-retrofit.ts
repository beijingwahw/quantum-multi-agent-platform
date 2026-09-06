/**
 * Batch-33 retrofit: pay the W-board's registered guard debt. Every unguarded
 * experiment entry across the legacy repos gets the house entry guard (the
 * batch-21 form): imports never render; direct invocation always does.
 *
 * Shapes:
 *   A — trailing `main();` / `run();` at column 0  -> wrap the call
 *   C — top-level execution, no exports (ent-sched) -> header+footer wrap
 *
 * Deterministic, self-verifying: refuses to touch an already-guarded file,
 * requires exactly one trailing call for shape A, zero exports for shape C.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GUARD_IMPORT = 'import { pathToFileURL } from "node:url";';
const RETRO_NOTE = "// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render";

interface Target {
  repo: string;
  file: string;
  shape: "call" | "wrap";
  call?: string;
}

const callTargets = (repo: string, files: string[], call: string): Target[] =>
  files.map((file) => ({ repo, file, shape: "call" as const, call }));

const TARGETS: Target[] = [
  ...callTargets("postselect-sched", ["exp-t1-sorter.ts", "exp-t2-restart.ts", "exp-t3-counting.ts", "exp-t4-contact.ts", "exp-t5-power-ledger.ts"], "main"),
  ...callTargets("retro-cache", ["exp-w1-correlations.ts", "exp-w2-marginal.ts", "exp-w3-equivalence.ts", "exp-w4-withdrawal.ts"], "main"),
  ...callTargets("qverify", ["exp1-blindness.ts", "exp2-traps.ts", "exp3-rigidity.ts", "exp4-sampling.ts", "exp5-attacks.ts"], "main"),
  ...callTargets("qram-sched", ["exp1-qram.ts", "exp2-walk.ts", "exp3-ae.ts", "exp4-regret.ts", "exp5-matching.ts"], "main"),
  ...callTargets("quantum-mech", ["exp1-dsic.ts", "exp2-privacy.ts", "exp3-escrow.ts", "exp4-nogo.ts", "exp5-vcg.ts"], "main"),
  ...callTargets("switch-sched", ["exp1-switch-algebra.ts", "exp2-capacity.ts", "exp3-sched-contact.ts", "exp4-mechanism.ts"], "main"),
  ...callTargets("depreciation-ledger", ["render.ts"], "main"),
  ...callTargets("nonstoq-anneal", ["run-all.ts"], "main"),
  ...callTargets("ft-qaoa", ["run-all.ts"], "main"),
  ...callTargets("bqp-map", ["exp1-reductions.ts", "exp2-upper.ts", "exp3-lower.ts", "exp4-witness.ts", "exp5-atlas.ts", "exp6-genealogy.ts"], "run"),
  ...(["exp1-physics.ts", "exp2-chain.ts", "exp3-network.ts", "exp4-purify.ts", "exp5-scaling.ts"].map((file) => ({
    repo: "ent-sched",
    file,
    shape: "wrap" as const,
  }))),
];

const WORKSPACE_ROOT = resolve(process.cwd(), "..");
let edited = 0;
let skipped = 0;
const problems: string[] = [];

for (const t of TARGETS) {
  const path = resolve(WORKSPACE_ROOT, t.repo, "src", "experiments", t.file);
  const src = readFileSync(path, "utf8");
  if (src.includes("import.meta.url")) {
    skipped++;
    continue;
  }
  const lines = src.split("\n");
  const importIdx: number[] = [];
  lines.forEach((l, i) => {
    if (/^import /.test(l)) importIdx.push(i);
  });
  if (importIdx.length === 0) {
    problems.push(`${t.repo}/${t.file}: no top-level imports found — refusing`);
    continue;
  }
  const insertAt = importIdx[importIdx.length - 1]! + 1;

  if (t.shape === "call") {
    const call = t.call as string;
    const callLine = `${call}();`;
    const hits = lines.map((l, i) => ({ l, i })).filter((x) => x.l.trim() === callLine);
    if (hits.length !== 1) {
      problems.push(`${t.repo}/${t.file}: expected exactly one "${callLine}", found ${hits.length} — refusing`);
      continue;
    }
    const at = hits[0]!.i;
    lines.splice(at, 1, RETRO_NOTE, `if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {`, `  ${callLine}`, `}`);
    lines.splice(insertAt, 0, GUARD_IMPORT);
  } else {
    if (/^export /.test(src)) {
      problems.push(`${t.repo}/${t.file}: shape-C wrap needs zero exports — refusing`);
      continue;
    }
    lines.splice(insertAt, 0, GUARD_IMPORT, RETRO_NOTE, "if (import.meta.url !== pathToFileURL(process.argv[1] ?? \"\").href) {", "  // imported by a test or module: definitions only, no render", "} else {");
    lines.push("}");
  }
  writeFileSync(path, lines.join("\n"), "utf8");
  edited++;
  console.log(`retrofitted ${t.repo}/src/experiments/${t.file} (${t.shape})`);
}

console.log(`\nedited=${edited} skipped(already guarded)=${skipped} targets=${TARGETS.length}`);
if (problems.length > 0) {
  console.error("PROBLEMS:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exitCode = 1;
}
