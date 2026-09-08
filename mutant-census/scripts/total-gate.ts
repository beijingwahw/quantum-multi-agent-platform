/**
 * THE TOTAL GATE (T-board) — one command, the whole workspace: every epoch
 * repo's test suite AND typecheck, plus the main platform repo's full suite,
 * machine-judged, stamped and rendered. "全量" as an executable object.
 *
 *   npm run total
 *
 * Concurrency 4; per-command timeout; any red cell fails the run and the
 * report says exactly which. The artifact lands at
 * out/reports/the-total-gate.md with a timestamp — it records the LAST run,
 * by design (the gate is run explicitly; the census test verifies the
 * command exists, the artifact records history).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// SINGLE-SOURCED since v0.10.0 (the b37#7 repair): the repo list lives in the
// census kernel and ONLY there — this script imports it, and the census test
// tree convicts any second literal copy by reading this file's source.
import { EPOCH_REPOS } from "../src/kernel/census.js";

interface Job {
  repo: string;
  kind: "test" | "typecheck" | "platform-test";
  cwd: string;
  cmd: string;
  args: string[];
  /** exclusive jobs run alone — no concurrent siblings (timing-sensitive suites) */
  exclusive?: boolean;
}

const jobs: Job[] = [];
for (const repo of [...EPOCH_REPOS, "mutant-census"]) {
  jobs.push({ repo, kind: "test", cwd: resolve(process.cwd(), "..", repo), cmd: "npm", args: ["test", "--silent"] });
  jobs.push({ repo, kind: "typecheck", cwd: resolve(process.cwd(), "..", repo), cmd: "npm", args: ["run", "typecheck", "--silent"] });
}
jobs.push({
  repo: "ds_extracted/ds",
  kind: "platform-test",
  cwd: resolve(process.cwd(), "..", "ds_extracted", "ds"),
  cmd: "npm",
  args: ["test", "--silent"],
  // batch-37 disposition of the 35th-visit flap, recorded candidate (a):
  // the platform job runs EXCLUSIVELY — no sibling jobs steal CPU during
  // its timing-sensitive test family (4ms busy-budget yields). The
  // QUANTUM_DISABLE_PARALLEL knob was tried first and REJECTED: it disables
  // the code under test (three parallel-evolution tests fail by design).
  exclusive: true,
});

interface JobResult extends Job {
  ok: boolean;
  ms: number;
  tail: string;
  /** the timeout tripped and the child was killed — disclosed, never silent */
  timedOut: boolean;
}

function runJob(job: Job, timeoutMs: number): Promise<JobResult> {
  return new Promise((resolveJob) => {
    const started = Date.now();
    const child = spawn(job.cmd, job.args, { cwd: job.cwd, shell: true });
    let tail = "";
    let timedOut = false;
    let settled = false;
    const settle = (ok: boolean): void => {
      if (settled) return; // a crashed spawn can fire BOTH error and close
      settled = true;
      clearTimeout(timer);
      resolveJob({ ...job, ok, ms: Date.now() - started, tail, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      tail = (tail + "\n[TOTAL GATE] job exceeded the timeout — killed").slice(-600);
      child.kill();
    }, timeoutMs);
    // default stdio pipes: stdout/stderr are always Readable here
    child.stdout.on("data", (d: Buffer) => {
      const s = d.toString();
      tail = (tail + s).slice(-600);
    });
    child.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      tail = (tail + s).slice(-600);
    });
    // a spawn that cannot start (error) may never fire close — the honest
    // minimum is a red cell naming the spawn error, never a hung gate
    child.on("error", (err: Error) => {
      tail = (tail + `\n[TOTAL GATE] spawn error: ${err.message}`).slice(-600);
      settle(false);
    });
    child.on("close", (code) => {
      settle(code === 0);
    });
  });
}

const TIMEOUT_MS = 420_000;
const CONCURRENCY = 4;

async function main(): Promise<void> {
  const results: JobResult[] = [];
  const queue = jobs.filter((j) => !j.exclusive);
  const exclusiveJobs = jobs.filter((j) => j.exclusive);
  const workers: Array<Promise<void>> = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(
      (async () => {
        for (;;) {
          const job = queue.shift();
          if (!job) return;
          results.push(await runJob(job, TIMEOUT_MS));
          process.stdout.write(`.`);
        }
      })(),
    );
  }
  await Promise.all(workers);
  // exclusive jobs run ALONE, after the concurrent pool drains (batch 37);
  // a failing exclusive job gets ONE disclosed retry — the house's own
  // red-cell discipline (single-run re-verification before classification)
  // automated: an intermittent flap passes the retry, a real regression
  // fails twice, and BOTH attempts are printed in the artifact, in order.
  const retries: string[] = [];
  for (const job of exclusiveJobs) {
    let r = await runJob(job, TIMEOUT_MS);
    process.stdout.write(`.`);
    if (!r.ok) {
      const first = r;
      r = await runJob(job, TIMEOUT_MS);
      process.stdout.write(`.`);
      retries.push(
        `${job.repo} ${job.kind}: attempt 1 FAIL (${first.ms / 1000}s), attempt 2 ${r.ok ? "PASS" : "FAIL"} (${r.ms / 1000}s) — both recorded, verdict follows the last attempt`,
      );
    }
    results.push(r);
  }

  const failed = results.filter((r) => !r.ok);
  const totalMs = results.reduce((s, r) => s + r.ms, 0);
  const stamp = new Date().toISOString();

  const lines: string[] = [];
  lines.push(`# THE TOTAL GATE — the whole workspace in one verdict\n`);
  lines.push(`> Ran ${stamp}: ${results.length} jobs — ${EPOCH_REPOS.length + 1} epoch repos x (test + typecheck) + the platform repo's full suite (exclusive slot + one disclosed retry, batch 37). ${failed.length === 0 ? "ALL GREEN" : `${failed.length} RED CELL(S)`}. Wall-sum ${Math.round(totalMs / 1000)}s at concurrency ${CONCURRENCY}.\n`);
  if (retries.length > 0) {
    lines.push(`\n## Disclosed retries (both attempts recorded, verdict follows the last)\n`);
    for (const r of retries) lines.push(`- ${r}`);
  }
  lines.push(`| repo | test | typecheck |`);
  lines.push(`| --- | --- | --- |`);
  const byRepo = new Map<string, { test?: JobResult; typecheck?: JobResult }>();
  for (const r of results) {
    const entry = byRepo.get(r.repo) ?? {};
    if (r.kind === "typecheck") entry.typecheck = r;
    else entry.test = r;
    byRepo.set(r.repo, entry);
  }
  for (const [repo, entry] of byRepo) {
    const t = entry.test;
    const tc = entry.typecheck;
    const fmt = (r?: JobResult): string =>
      r ? (r.ok ? `PASS (${(r.ms / 1000).toFixed(1)}s)` : `**FAIL (${(r.ms / 1000).toFixed(1)}s${r.timedOut ? ", TIMEOUT" : ""})**`) : "—";
    lines.push(`| ${repo} | ${fmt(t)} | ${fmt(tc)} |`);
  }
  if (failed.length > 0) {
    lines.push(`\n## Red cells\n`);
    for (const f of failed)
      lines.push(
        `- ${f.repo} ${f.kind}${f.timedOut ? `: TIMEOUT after ${(TIMEOUT_MS / 1000).toFixed(0)}s — killed; the tail follows` : ""}: …${f.tail.replace(/\s+/g, " ").slice(-260)}`,
      );
  }
  const dir = resolve(process.cwd(), "out", "reports");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, "the-total-gate.md");
  writeFileSync(path, lines.join("\n"), "utf8");
  console.log(`\n${failed.length === 0 ? "TOTAL GATE: ALL GREEN" : `TOTAL GATE: ${failed.length} RED`}-> ${path}`);
  if (failed.length > 0) process.exitCode = 1;
}

void main();
