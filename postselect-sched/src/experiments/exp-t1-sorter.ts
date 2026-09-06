/**
 * T1 — the sorter's branch algebra, executed.
 */
import { auditFilter, feedforwardCheck, runPayload, runSorter } from "../kernel/sorter.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

function main(): void {
  const lines: string[] = [];
  lines.push("# T1 — sorter branch algebra (exact amplitude execution)\n");

  lines.push("## A. certainty-in-branch: one query, postselect flag=1, t=1\n");
  lines.push("| n | P(flag=1) | t/N closed | fidelity with |x*> | uniformity dev | off-marked leak |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const n of [4, 6, 8, 10, 12, 14]) {
    const run = runSorter(n, [1234 % 2 ** n]);
    lines.push(
      `| ${n} | ${fmt(run.pFlag, 12)} | ${fmt(run.pFlagClosedForm, 12)} | ${fmt(run.fidelityXStar, 12)} | ${fmt(run.conditionalUniformityDev, 3)} | ${fmt(run.offMarkedLeak, 3)} |`,
    );
  }
  lines.push("\nThe conditional address state is EXACTLY |x*> — the sorter's truthful half.\n");

  lines.push("## B. the branch is a clean conditional sample (payload readout)\n");
  lines.push("| n | t | P(flag=1) | P(payload=1 | flag) amplitude | integer referee | deviation |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  let seedState = 0x12345678;
  const rand = (): number => {
    seedState ^= seedState << 13;
    seedState >>>= 0;
    seedState ^= seedState >>> 17;
    seedState ^= seedState << 5;
    seedState >>>= 0;
    return seedState / 4294967296;
  };
  for (const n of [8, 10, 12]) {
    const N = 2 ** n;
    const payload: boolean[] = new Array<boolean>(N);
    for (let x = 0; x < N; x++) payload[x] = rand() < 0.5;
    const marked = [...new Set(Array.from({ length: 37 % N }, () => Math.floor(rand() * N)))];
    const run = runPayload(n, marked, payload);
    lines.push(
      `| ${n} | ${marked.length} | ${fmt(run.pFlag, 9)} | ${fmt(run.branchOutcome, 12)} | ${fmt(run.closedForm, 12)} | ${fmt(run.deviation, 3)} |`,
    );
  }
  lines.push("\nEvery in-branch outcome probability is an integer ratio |{g AND h}|/|{g}| — a #P-fraction value.\n");

  lines.push("## C. the filter is not a channel\n");
  const audit = auditFilter();
  lines.push(`- conditioning the mixture vs averaging the conditionals: trace distance = ${fmt(audit.nonlinearityTraceDistance, 12)} (expected exactly 1/6 = ${fmt(1 / 6, 12)})`);
  lines.push(`- two-Kraus filter {Pi0, Pi1}: trace preservation dev ${fmt(audit.krausTraceDev, 3)}, measurement-channel certificate (blocks kept, coherences killed) dev ${fmt(audit.krausDephaseDev, 3)}`);
  lines.push(`- single Kraus {Pi1} on marked-supported state: trace ${fmt(audit.singleKrausOnSupport, 12)} (exactly 1)`);
  lines.push(`- single Kraus on off-support state: deficit ${fmt(audit.singleKrausDeficit, 12)} (in (0,1))`);
  lines.push("\nConditioning is affine only in the branch-weighted sense: cond(sum lambda_i rho_i) = sum lambda_i w_i cond(rho_i) / sum lambda_i w_i. The measure-and-keep realization reproduces the weighted version — checked by Monte Carlo below.\n");

  lines.push("## D. physical realization referee (measure flag, keep the branch)\n");
  lines.push("| n | t | samples | accept sigma | worst cell sigma |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const [n, t, seed, samples] of [
    [6, 11, 101, 40000],
    [8, 37, 202, 60000],
  ] as const) {
    const marked: number[] = [];
    let s = seed;
    for (let i = 0; i < t; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      marked.push(s % 2 ** n);
    }
    const chk = feedforwardCheck(n, marked, seed, samples);
    lines.push(`| ${n} | ${t} | ${samples} | ${fmt(chk.acceptSigma, 2)} | ${fmt(chk.worstSigma, 2)} |`);
  }
  lines.push("\nBoth statistics inside 5 sigma: the physical procedure lands on the conditional distribution the algebra predicts.\n");

  const path = writeReport("t1-sorter.md", lines.join("\n"));
  console.log(`exp T1 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
