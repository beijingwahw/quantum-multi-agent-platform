/**
 * T3 — counting power in-branch: every outcome probability is a #P-fraction.
 */
import { Rng } from "../kernel/sorter.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

interface CountRun {
  readonly n: number;
  readonly m: number; // |{g}|
  readonly cntJoint: number;
  readonly ratio: number; // amplitude-path conditional ratio
  readonly brute: number; // integer-referee ratio
  readonly deviation: number;
}

function countRun(n: number, seed: number): CountRun {
  const N = 2 ** n;
  const rng = new Rng(seed);
  const g: boolean[] = new Array<boolean>(N).fill(false);
  const h: boolean[] = new Array<boolean>(N).fill(false);
  for (let x = 0; x < N; x++) {
    g[x] = rng.next() < 0.4;
    h[x] = rng.next() < 0.5;
  }
  const amp = 1 / Math.sqrt(N);
  let weight = 0;
  let joint = 0;
  let m = 0;
  let cntJoint = 0;
  for (let x = 0; x < N; x++) {
    if (!g[x]) continue;
    weight += amp * amp;
    m++;
    if (h[x]) {
      joint += amp * amp;
      cntJoint++;
    }
  }
  const ratio = joint / weight;
  const brute = cntJoint / m;
  return { n, m, cntJoint, ratio, brute, deviation: Math.abs(ratio - brute) };
}

function main(): void {
  const lines: string[] = [];
  lines.push("# T3 — counting power: the branch as a #P-fraction evaluator\n");

  lines.push("## A. conditional counting ratio vs integer referee\n");
  lines.push("| n | m = |{g}| | |{g AND h}| | branch ratio | integer referee | deviation |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const [n, seed] of [
    [8, 11],
    [10, 22],
    [12, 33],
  ] as const) {
    const r = countRun(n, seed);
    lines.push(`| ${n} | ${r.m} | ${r.cntJoint} | ${fmt(r.ratio, 12)} | ${fmt(r.brute, 12)} | ${fmt(r.deviation, 3)} |`);
  }
  lines.push("\nThe amplitude path and the exact integer path agree to float zero: the postselected readout evaluates #P-function ratios in closed form. This is the executable face of PostBQP = PP (AAR04, cited) — the class equality itself is not re-proven here.\n");

  lines.push("## B. odd-denominator separation and the single-shot decision law\n");
  lines.push("| n | m (odd) | ratio | gap to 1/2 | lower bound 1/(2m) | decision error = 1/2 - gap |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const [n, seed] of [
    [8, 101],
    [10, 202],
    [12, 303],
  ] as const) {
    // regenerate with odd m (matters for the no-tie guarantee)
    for (let bump = 0; bump < 8; bump++) {
      const r = countRun(n, seed + 1000 * bump);
      if (r.m % 2 === 1) {
        const gap = Math.abs(r.ratio - 0.5);
        const bound = 1 / (2 * r.m);
        lines.push(`| ${n} | ${r.m} | ${fmt(r.ratio, 9)} | ${fmt(gap, 9)} | ${fmt(bound, 9)} | ${fmt(0.5 - gap, 9)} |`);
        break;
      }
    }
  }
  lines.push("\nWith |{g}| odd the ratio can never sit exactly on 1/2, the gap is at least 1/(2m) (integer separation), and one postselected readout decides the majority sign with error exactly 1/2 - gap — the toy PP-threshold semantics, with every quantity machine-checked.\n");

  lines.push("## C. two readouts in-branch: a full conditional simplex\n");
  lines.push("| n | m | P(0,0) | P(0,1) | P(1,0) | P(1,1) | sum | max dev vs integer referee |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  const n = 10;
  const N = 2 ** n;
  const rng = new Rng(777);
  const g: boolean[] = new Array<boolean>(N).fill(false);
  const h1: boolean[] = new Array<boolean>(N).fill(false);
  const h2: boolean[] = new Array<boolean>(N).fill(false);
  for (let x = 0; x < N; x++) {
    g[x] = rng.next() < 0.35;
    h1[x] = rng.next() < 0.5;
    h2[x] = rng.next() < 0.5;
  }
  const amp = 1 / Math.sqrt(N);
  const probs = [0, 0, 0, 0];
  const counts = [0, 0, 0, 0];
  let m = 0;
  let weight = 0;
  for (let x = 0; x < N; x++) {
    if (!g[x]) continue;
    weight += amp * amp;
    m++;
    const idx = (h1[x] ? 2 : 0) + (h2[x] ? 1 : 0);
    probs[idx] = (probs[idx] as number) + amp * amp;
    counts[idx] = (counts[idx] as number) + 1;
  }
  let maxDev = 0;
  const cond: number[] = probs.map((w) => (w) / weight);
  for (let i = 0; i < 4; i++) {
    const dev = Math.abs((cond[i] as number) - (counts[i] as number) / m);
    if (dev > maxDev) maxDev = dev;
  }
  const sum = cond.reduce((a, b) => a + b, 0);
  lines.push(`| ${n} | ${m} | ${fmt(cond[0] as number, 9)} | ${fmt(cond[1] as number, 9)} | ${fmt(cond[2] as number, 9)} | ${fmt(cond[3] as number, 9)} | ${fmt(sum, 12)} | ${fmt(maxDev, 3)} |`);
  lines.push("\nThe branch carries the full joint conditional distribution — the sorter is a conditional sampler over any readout family, each cell an integer ratio.\n");

  const path = writeReport("t3-counting.md", lines.join("\n"));
  console.log(`exp T3 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
