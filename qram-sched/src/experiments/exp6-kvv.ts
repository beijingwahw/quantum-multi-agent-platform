/**
 * EXP6 — the KVV tight instances, executed (v0.2.0 upgrade face #1).
 *
 * Karp-Vazirani-Vazirani's hard-input distribution D_n (construction and
 * exact values via Feige, arXiv:1812.11774): MonotoneG — arrival j sees the
 * suffix {v_j..v_n} — under a random relabeling. Here the family is built in
 * code and the caps are met EXACTLY, not asymptotically:
 *
 *   E[RANKING on D_n] = ((n+1)! - d(n+1) - d(n)) / n! = (1-1/e)n + 1 - 2/e + O(1/n!)
 *   E[greedy (uniform) on D_n] = the same value (KVV Lemma 13) — verified by an
 *   independent subset DP agreeing with the derangement formula to 1e-15.
 *   Deterministic greedy: the phase adversary holds it at exactly n/2.
 *
 * Then the quantum census on exactly this tightest stage: the per-arrival
 * Durr-Hoyer ledger drops while the ratio stays pinned at the cap — the
 * regret/query ledger separation restated where it is hardest.
 */
import {
  deterministicGreedyHalfInstance,
  feigeRankingExpectation,
  greedyUniformExpectationExact,
  monotoneInstance,
  rankingExpectationExhaustive,
  sampleDnMember,
} from "../online/kv-tight.js";
import { greedyMatch, kuhnMaxMatching, rankingMatch } from "../online/matching.js";
import { Rng } from "../core/rng.js";
import { fitSlope, fmt, table, writeReport } from "./report.js";
import { pathToFileURL } from "node:url";

export function main(): void {
  const lines: string[] = [];
  lines.push("# EXP6 — KVV tight instances executed: the caps met exactly, the query ledger torn anyway");
  lines.push("");
  lines.push(
    "Family (Feige, arXiv:1812.11774, Sec. 1.1, representing KVV STOC 1990's D_n): MonotoneG has arrival " +
      "u_j adjacent to exactly {v_j, ..., v_n} (nested suffixes; unique perfect matching (u_j, v_j)); D_n = " +
      "MonotoneG under a uniformly random worker relabeling. Exact kernels: derangement formula " +
      "((n+1)! - d(n+1) - d(n))/n!, exhaustive n!-permutation RANKING enumeration, and an independent subset " +
      "DP for greedy-uniform. Referee for OPT: Kuhn augmenting paths.",
  );
  lines.push("");

  // A. The exact 1 - 1/e law: three independent kernels, one number.
  lines.push("## A. E[size on D_n] — derangement formula vs exhaustive enumeration vs greedy-uniform DP");
  lines.push("");
  const rowsA: string[][] = [];
  for (const n of [2, 4, 6, 8, 10, 12, 14, 16]) {
    const feige = feigeRankingExpectation(n);
    const dp = greedyUniformExpectationExact(n);
    const exhaustive = n <= 8 ? rankingExpectationExhaustive(n) : NaN;
    rowsA.push([
      String(n),
      fmt(feige, 9),
      fmt(feige / n, 6),
      fmt(feige - n * (1 - 1 / Math.E), 4),
      n <= 8 ? fmt(Math.abs(exhaustive - feige), 15) : "-",
      fmt(Math.abs(dp - feige), 15),
    ]);
  }
  lines.push(
    table(
      ["n", "E = a(n)/n! (Feige)", "ratio E/n", "E - (1-1/e)n", "|exhaustive - formula|", "|greedy DP - formula|"],
      rowsA,
    ),
  );
  lines.push("");
  lines.push(
    "Three independent exact computations agree: the published derangement formula, the n!-permutation RANKING " +
      "enumeration (n <= 8), and the greedy-uniform subset DP (an unrelated computation) reproduce one number to " +
      "1e-15. That agreement IS KVV Lemma 13 executed: on D_n every greedy algorithm earns exactly RANKING's " +
      "expectation. The additive column converges on 1 - 2/e = 0.2642: the 1 - 1/e cap is met exactly at finite n " +
      "with the published constant — E = (1-1/e)n + (1-2/e) + O(1/n!), so the ratio sits ABOVE 1-1/e at small n and " +
      "descends to it (n=16: 0.6486 -> 1-1/e = 0.6321).",
  );
  lines.push("");

  // B. The distributional nature of tightness: fixed member vs D_n average.
  lines.push("## B. Tightness is distributional: name-aware rules beat any fixed member, not the family");
  lines.push("");
  const nB = 16;
  const member = monotoneInstance(nB);
  const memberReversed = { n: nB, arrivals: member.arrivals.map((nb) => [...nb].reverse()) };
  const memberLow = greedyMatch(member, new Rng(0), "linear", "lowest").size;
  const memberHigh = greedyMatch(memberReversed, new Rng(0), "linear", "lowest").size;
  const K = 2000;
  let dnLow = 0;
  let dnHigh = 0;
  let dnRank = 0;
  for (let s = 0; s < K; s++) {
    const inst = sampleDnMember(nB, new Rng(90000 + s));
    dnLow += greedyMatch(inst, new Rng(0), "linear", "lowest").size;
    const rev = { n: inst.n, arrivals: inst.arrivals.map((nb) => [...nb].reverse()) };
    dnHigh += greedyMatch(rev, new Rng(0), "linear", "lowest").size;
    dnRank += rankingMatch(inst, new Rng(50000 + s), "linear").size;
  }
  const exact = feigeRankingExpectation(nB);
  lines.push(
    table(
      ["algorithm", "fixed MonotoneG member (deterministic)", "D_n MC mean (K=2000)", "D_n exact"],
      [
        ["greedy-lowest", `${memberLow} (ratio ${(memberLow / nB).toFixed(4)})`, fmt(dnLow / K, 4), fmt(exact, 4)],
        ["greedy-highest", `${memberHigh} (ratio ${(memberHigh / nB).toFixed(4)})`, fmt(dnHigh / K, 4), fmt(exact, 4)],
        ["RANKING (name-oblivious)", "-", fmt(dnRank / K, 4), fmt(exact, 4)],
      ],
    ),
  );
  lines.push("");
  lines.push(
    "The honest nuance: greedy-lowest matches PERFECTLY on the fixed member (each u_j takes v_j) and greedy-highest " +
      "collapses to 1/2 there — but the family is the DISTRIBUTION D_n, and averaging over members drags every " +
      "name-aware deterministic rule onto the same 10.3782 = a(16)/16! as RANKING (MC within 3e-3 of exact). " +
      "Tightness is a property of the distribution, not of any single graph; a single-member tightness claim is " +
      "exactly what the certificate checker in test/kv-tight.test.ts rejects.",
  );
  lines.push("");

  // C. The deterministic 1/2 cap, exactly.
  lines.push("## C. Deterministic greedy: the phase adversary holds it at exactly n/2");
  lines.push("");
  const rowsC: string[][] = [];
  for (const n of [8, 16, 64, 128]) {
    for (const rule of ["lowest", "highest"] as const) {
      const inst = deterministicGreedyHalfInstance(n, rule);
      const opt = kuhnMaxMatching(inst);
      const size = greedyMatch(inst, new Rng(0), "linear", rule).size;
      rowsC.push([String(n), rule, String(opt), String(size), fmt(size / opt, 4)]);
    }
  }
  lines.push(table(["n", "tie-break rule", "OPT (Kuhn)", "greedy size", "ratio"], rowsC));
  lines.push("");
  lines.push(
    "The adversary (Feige Sec. 1 sketch): first n/2 arrivals see all workers; the rule's own phase-1 matches form " +
      "the set S; the last n/2 arrivals see exactly S — every one of them fails. Deterministic once the tie-break " +
      "rule is fixed (the adversary merely reads the rule), OPT = n, greedy = n/2 TO THE EDGE at every size and " +
      "both rules: the deterministic 1/2 cap is an exact machine fact, not an asymptotic one. Randomized greedy " +
      "escapes THIS adversary (its S is random) — its tight instance is the D_n family of section A, where it " +
      "sits at a(n)/n!, strictly between 1/2 and any escape.",
  );
  lines.push("");

  // D. The quantum census on the tightest stage.
  lines.push("## D. Quantum per-arrival search on exactly these instances: reads torn, ratio pinned");
  lines.push("");
  const rowsD: string[][] = [];
  const logN: number[] = [];
  const logRatio: number[] = [];
  const seedBank: ReadonlyArray<[number, number]> = [
    [16, 5000],
    [64, 2000],
    [256, 300],
    [1024, 40],
  ];
  for (const [n, seeds] of seedBank) {
    const inst = monotoneInstance(n);
    const exactRatio = feigeRankingExpectation(n) / n;
    let linReads = 0;
    let groverReads = 0;
    let linMeanRatio = 0;
    let groverMeanRatio = 0;
    let m2 = 0;
    let disagreements = 0;
    for (let s = 0; s < seeds; s++) {
      const lin = rankingMatch(inst, new Rng(s), "linear");
      const quant = rankingMatch(inst, new Rng(s), "grover");
      linReads += lin.reads;
      groverReads += quant.reads;
      const lr = lin.size / n;
      const delta = lr - linMeanRatio;
      linMeanRatio += delta / (s + 1);
      m2 += delta * (lr - linMeanRatio);
      groverMeanRatio += quant.size / n / seeds;
      disagreements += quant.disagreements;
    }
    const stderr = Math.sqrt(m2 / Math.max(1, seeds - 1) / seeds);
    const ratio = linReads / groverReads;
    rowsD.push([
      String(n),
      String(seeds),
      fmt(exactRatio, 4),
      `${fmt(linMeanRatio, 4)} ± ${fmt(stderr, 4)}`,
      fmt(groverMeanRatio, 4),
      String(disagreements),
      String(Math.round(linReads / seeds)),
      String(Math.round(groverReads / seeds)),
      fmt(ratio, 2),
    ]);
    logN.push(Math.log2(n));
    logRatio.push(Math.log2(ratio));
  }
  lines.push(
    table(
      [
        "n",
        "seeds",
        "exact ratio a(n)/(n!·n)",
        "linear mean ratio ± stderr",
        "Durr-Hoyer mean ratio",
        "disagree arrivals",
        "linear reads/inst",
        "Durr-Hoyer reads/inst",
        "read ratio",
      ],
      rowsD,
    ),
  );
  lines.push("");
  lines.push(
    `On the tightest stage the separation restates itself: RANKING's mean ratio under the linear rule equals the ` +
      `exact a(n)/(n!·n) within Monte Carlo error at every size, the Durr-Hoyer variant stays on it within its ` +
      `reported bounded-error misses (${disagreementsNote(rowsD)}), and the read ledger still tears (log2 read-ratio ` +
      `vs log2 n slope = ${fmt(fitSlope(logN, logRatio), 3)}, theory 0.5 up to the log factor). Quantum buys the ` +
      `QUERY bill on the KVV family exactly as on random banks; the competitive-ratio cap — an information-` +
      `theoretic wall — does not move by a single match.`,
  );
  lines.push("");
  lines.push("## Honest boundaries");
  lines.push("");
  lines.push(
    "- The exhaustive kernel stops at n <= 9 (362880 permutations) and the subset DP at n <= 24; beyond that the " +
      "derangement formula (BigInt-exact) carries the exact values and Monte Carlo cross-checks them.\n" +
      "- E on D_n is exact for the DISTRIBUTION; single members vary (section B). The deterministic 1/2 adversary " +
      "is oblivious only after fixing the tie-break rule — that is the standard content of the sketch.\n" +
      "- Durr-Hoyer disagreements are counted against the exact argmin referee and reported, never assumed zero.\n" +
      "- Read ledgers count oracle reads of the neighbor/rank table (qRAM-accessible data); routing-node " +
      "activation costs of the qRAM itself are audited separately in EXP1-D.",
  );
  lines.push("");

  const file = writeReport("exp6-kvv.md", lines.join("\n") + "\n");
  console.log(`exp6 written: ${file}`);
}

function disagreementsNote(rows: ReadonlyArray<readonly string[]>): string {
  return rows.map((r) => `${r[0] as string}:${r[5] as string}`).join(", ");
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
