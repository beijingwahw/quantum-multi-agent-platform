/**
 * T4 — the scheduling contact surface: heralded freeness + online depth schedules.
 */
import { Rng } from "../kernel/sorter.js";
import { eStarGrover, groverPClosed, lubyUniversal, payExpected } from "../kernel/restart.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

/** simulate geometric rounds until success; returns rounds used */
function geometricRounds(rng: Rng, q: number): number {
  let rounds = 0;
  for (;;) {
    rounds++;
    if (rng.next() < q) return rounds;
  }
}

export function main(): void {
  const lines: string[] = [];
  lines.push("# T4 — scheduling contact: when is postselection a free resource?\n");

  lines.push("## A. the freeness table: active postselection vs heralded loss\n");
  lines.push(
    "Two ways the branch gets rejected. ACTIVE: the algorithm probes the flag itself — every attempt burns one oracle query. HERALDED: the environment already rejects the branch (loss channel, entanglement herald) — the accepted subensemble arrives at the same rate with zero query cost.\n",
  );
  lines.push("| q | rounds/answer exact (1/q) | active MC rounds | sigma | heralded MC rounds | sigma | active queries/answer | heralded queries/answer |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  const trials = 200000;
  for (const q of [1 / 16, 1 / 8, 1 / 4, 1 / 2]) {
    const rngA = new Rng(9001);
    const rngH = new Rng(1337);
    let sumA = 0;
    let sumH = 0;
    for (let i = 0; i < trials; i++) {
      sumA += geometricRounds(rngA, q);
      sumH += geometricRounds(rngH, q);
    }
    const meanA = sumA / trials;
    const meanH = sumH / trials;
    const sigma = Math.sqrt((1 - q) / (q * q * trials));
    lines.push(
      `| ${fmt(q, 4)} | ${fmt(1 / q, 4)} | ${fmt(meanA, 4)} | ${fmt(Math.abs(meanA - 1 / q) / sigma, 2)} | ${fmt(meanH, 4)} | ${fmt(Math.abs(meanH - 1 / q) / sigma, 2)} | ${fmt(1 / q, 4)} | 0 (exact) |`,
    );
  }
  lines.push(
    "\nBoth models wait under the SAME geometric law (identical round statistics, both within sigma of 1/q) — only the cost column differs: the query ledger 1/q is charged exactly when the algorithm must do the rejecting itself. Postselection is a free resource exactly when the hardware already heralds the same branches. This is the ent-sched regime: heralded swap/purification attempts are many-worlds sorters whose ledger is paid in wall-clock rounds, not oracle queries (cross-prototype pointer, parameters here illustrative).\n",
  );

  lines.push("## B. online depth-doubling: sorting when the marked count t is unknown\n");
  lines.push("| N | t | E*(t) (oracle knows t) | doubling schedule | ratio |");
  lines.push("| --- | --- | --- | --- | --- |");
  const N = 256;
  // universal query-cutoff sequence 1,1,2,1,1,2,4 mapped to amplification
  // depths k = c - 1 (c queries = k amplify + 1 verify)
  const cutoffs = lubyUniversal(3).slice(0, 7); // 1,1,2,1,1,2,4
  const depths = cutoffs.map((c) => c - 1);
  const costs = depths.map((k) => k + 1);
  let worstRatio = 0;
  for (const t of [1, 3, 7, 15, 31, 63, 127] as const) {
    const probs = depths.map((k) => groverPClosed(N, t, k));
    const T = payExpected(costs, probs, depths.map((_, i) => i));
    const e = eStarGrover(N, t);
    const ratio = T / e.queries;
    if (ratio > worstRatio) worstRatio = ratio;
    lines.push(`| ${N} | ${t} | ${fmt(e.queries, 3)} | ${fmt(T, 3)} | ${fmt(ratio, 3)} |`);
  }
  lines.push(
    `\nWithout knowing t, cycling the doubling-depth schedule costs at most ${fmt(worstRatio, 3)}x the oracle-informed optimum on this grid — the LSZ robustness trade executed on the sorter's own success curve. The scheduler pays a constant-factor insurance premium instead of an instance-adaptive search.\n`,
  );

  const path = writeReport("t4-contact.md", lines.join("\n"));
  console.log(`exp T4 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
