/**
 * T2 — the amortization-rate theorem layer (LSZ93 executed).
 */
import {
  bimodalDist,
  convexDecomposition,
  eStarGrover,
  firstMarkDist,
  geometricDist,
  groverPClosed,
  groverPIterated,
  lambdaClosed,
  lambdaStar,
  lubyUniversal,
  makeFastRenewal,
  payExpected,
  payStarMenu,
  powerLawDist,
  renewalEarlyStop,
  zeroOptimal,
  ZERO_OPTIMAL_DENSITY_LIMIT,
  type Dist,
} from "../kernel/restart.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

export function main(): void {
  const lines: string[] = [];
  lines.push("# T2 — restart algebra: the depreciation ledger as a Las Vegas strategy\n");

  const dists: Array<[string, Dist]> = [
    ["geometric r=0.05 (H=200)", geometricDist(200, 0.05)],
    ["geometric r=0.01 (H=400)", geometricDist(400, 0.01)],
    ["power-law u^-2 (H=400)", powerLawDist(400, 2)],
    ["bimodal 0.8@1 + 0.2@100", bimodalDist()],
  ];

  lines.push("## A. two-path identity: closed lambda(t) vs renewal sum, fixed cutoffs\n");
  lines.push("| distribution | lambda* | t* | worst |renewal - closed| |");
  lines.push("| --- | --- | --- | --- |");
  for (const [name, p] of dists) {
    const star = lambdaStar(p);
    let worst = 0;
    for (let t = 1; t < p.length; t += Math.max(1, Math.floor(p.length / 40))) {
      const dev = Math.abs(renewalEarlyStop(p, { prefix: [t] }) - lambdaClosed(p, t));
      if (dev > worst) worst = dev;
    }
    lines.push(`| ${name} | ${fmt(star.value, 4)} | ${star.t} | ${fmt(worst, 12)} |`);
  }
  lines.push("\nThe fixed-cutoff expectation computed by closed form and by the renewal sum agree to float zero — the machinery is consistent before any claim is read off it.\n");

  lines.push("## B. no strategy beats the best fixed cutoff (LSZ93 Thm 3, exhaustive check)\n");
  lines.push("| distribution | strategies enumerated | min T(S) | lambda* (global) | best menu lambda | margin (lambda* - min T) |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const cutoffMenu = [1, 2, 3, 4, 5, 6, 10, 16];
  for (const [name, p] of dists) {
    const fast = makeFastRenewal(p, cutoffMenu);
    const star = lambdaStar(p);
    const menuLambda = Math.min(...cutoffMenu.map((t) => lambdaClosed(p, t)));
    let count = 0;
    let minT = Number.POSITIVE_INFINITY;
    for (let len = 1; len <= 3; len++) {
      const idxList: number[][] = [];
      const build = (prefix: number[]): void => {
        if (prefix.length === len) {
          idxList.push([...prefix]);
          return;
        }
        for (let c = 0; c < cutoffMenu.length; c++) build([...prefix, c]);
      };
      build([]);
      for (const idxs of idxList) {
        const s = { prefix: idxs.map((i) => cutoffMenu[i] as number) };
        const T = fast.T(s);
        count++;
        if (T < minT) minT = T;
      }
    }
    lines.push(`| ${name} | ${count} | ${fmt(minT, 6)} | ${fmt(star.value, 6)} | ${fmt(menuLambda, 6)} | ${fmt(star.value - minT, 9)} |`);
  }
  lines.push("\nEvery cyclic strategy over the cutoff menu lands at or above lambda*, and the enumeration minimum is exactly the best fixed cutoff IN the menu (the global optimum may use a cutoff outside it — reported side by side). The convex-combination identity below is the algebraic reason no schedule dips under lambda*.\n");

  lines.push("## C. the convex-combination identity, LSZ93 eq. (7)\n");
  lines.push("| distribution | strategy | T(S) | sum g_i | sum g_i lambda(t_i) | deviation |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const strategies = [
    { name: "(1,3,1,16) cycle", prefix: [1, 3, 1, 16] },
    { name: "(2,5) cycle", prefix: [2, 5] },
    { name: "(6,) fixed", prefix: [6] },
  ];
  for (const [name, p] of dists) {
    for (const s of strategies) {
      const c = convexDecomposition(p, s);
      lines.push(
        `| ${name} | ${s.name} | ${fmt(c.T, 6)} | ${fmt(c.gSum, 12)} | ${fmt(c.weightedLambdas, 6)} | ${fmt(c.deviation, 9)} |`,
      );
    }
  }
  lines.push("\nsum g_i telescopes to 1 and the g-weighted lambdas rebuild T(S) exactly: any strategy is a convex mix of fixed-cutoff expectations, so it cannot dip below the cheapest ingredient.\n");

  lines.push("## D. the universal doubling sequence (LSZ93 Thm 5, empirical)\n");
  lines.push("| distribution | lambda* | T(S_univ) | ratio | bound (19/2)lambda*(log2 lambda* + 5) |");
  lines.push("| --- | --- | --- | --- | --- |");
  const univ = lubyUniversal(5); // 31 terms (|S_k| = 2|S_{k-1}|+1 -> 31), cutoffs up to 16
  for (const [name, p] of dists) {
    const fast = makeFastRenewal(p, [1, 2, 4, 8, 16]);
    const star = lambdaStar(p);
    const T = fast.T({ prefix: univ });
    const bound = 9.5 * star.value * (Math.log2(star.value) + 5);
    lines.push(`| ${name} | ${fmt(star.value, 4)} | ${fmt(T, 4)} | ${fmt(T / star.value, 3)} | ${fmt(bound, 1)} |`);
  }
  lines.push("\nUnknown-distribution robustness is bought for a modest factor. Honest caveat: the executed strategy is the finite prefix of S_univ with cutoffs up to 16, cycled forever — LSZ93's theorem is about the infinite sequence; the check witnesses the bound's shape on this truncation, not the theorem verbatim.\n");

  lines.push("## E. the sorter's ledger vs amplified restarts (Grover curves, two-path)\n");
  lines.push("| N | t | E* = min_k (k+1)/p_k | k* | ledger N/t | ledger/E* | k=0 optimal? |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  let worstCurve = 0;
  for (const [N, t] of [
    [256, 1],
    [256, 7],
    [1024, 1],
    [1024, 37],
    [4096, 1],
  ] as const) {
    for (let k = 0; k <= 40; k++) {
      const dev = Math.abs(groverPClosed(N, t, k) - groverPIterated(N, t, k));
      if (dev > worstCurve) worstCurve = dev;
    }
    const e = eStarGrover(N, t);
    lines.push(`| ${N} | ${t} | ${fmt(e.queries, 3)} | ${e.k} | ${fmt(e.ledger, 1)} | ${fmt(e.ratio, 3)} | ${zeroOptimal(N, t) ? "yes" : "no"} |`);
  }
  lines.push(`\nClosed form sin^2((2k+1)theta) vs iterated 2x2 rotation agree to ${fmt(worstCurve, 15)} across the whole grid.\n`);

  lines.push("## F. the threshold law: when is the pure sorter restart-optimal?\n");
  lines.push("| N | last t where amplification still wins | threshold t | density t/N | limit (3-sqrt(2))/4 |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const N of [256, 1024, 4096, 16384] as const) {
    let lastFalse = 0;
    for (let t = 1; t <= N; t++) {
      if (!zeroOptimal(N, t)) lastFalse = t;
    }
    const thr = lastFalse + 1;
    lines.push(`| ${N} | ${lastFalse} | ${thr} | ${fmt(thr / N, 9)} | ${fmt(ZERO_OPTIMAL_DENSITY_LIMIT, 9)} |`);
  }
  lines.push(
    `\nThe binding constraint is k=1: p_1 = sin^2(3theta) exceeds 2 p_0 = 2 sin^2(theta) exactly when t/N < (3-sqrt(2))/4 = ${fmt(ZERO_OPTIMAL_DENSITY_LIMIT, 9)}. Above the measured threshold the visitor's sorter is, by the ledger's own standard, the optimal restart strategy; below it, amplify-then-postselect strictly dominates.\n`,
  );

  lines.push("## G. always-pay model: no-beating at the coherent-round standard\n");
  lines.push("| N | t | depths menu | strategies | min T | E* menu | margin |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const [N, t] of [
    [256, 1],
    [1024, 3],
  ] as const) {
    const depths = [0, 1, 2, 3, 5, 8, 12];
    const costs = depths.map((k) => k + 1);
    const probs = depths.map((k) => groverPClosed(N, t, k));
    const star = payStarMenu(costs, probs);
    let count = 0;
    let minT = Number.POSITIVE_INFINITY;
    for (let len = 1; len <= 3; len++) {
      const build = (prefix: number[], acc: number[][]): void => {
        if (prefix.length === len) {
          acc.push([...prefix]);
          return;
        }
        for (let i = 0; i < depths.length; i++) build([...prefix, i], acc);
      };
      const acc: number[][] = [];
      build([], acc);
      for (const idxs of acc) {
        const T = payExpected(costs, probs, idxs);
        count++;
        if (T < minT) minT = T;
      }
    }
    lines.push(`| ${N} | ${t} | ${depths.length} | ${count} | ${fmt(minT, 6)} | ${fmt(star.value, 6)} | ${fmt(star.value - minT, 9)} |`);
  }
  lines.push("\nMid-circuit rounds cannot be inspected without killing the amplification, so the full cutoff price is paid — and even then the cheapest single round type is unbeatable by any cyclic schedule (enumerated, matching LSZ's L-function argument).\n");

  lines.push("## H. side observation: the classical scanner under optimal restart\n");
  lines.push("| N | t | no-restart mean | lambda* |");
  lines.push("| --- | --- | --- | --- |");
  for (const [N, t] of [
    [256, 1],
    [1024, 4],
  ] as const) {
    const p = firstMarkDist(N, t);
    let mean = 0;
    for (let u = 1; u < p.length; u++) mean += u * (p[u] as number);
    const star = lambdaStar(p);
    lines.push(`| ${N} | ${t} | ${fmt(mean, 2)} | ${fmt(star.value, 2)} |`);
  }
  lines.push("\nFor the uniform first-mark law, restarting cannot beat running on (lambda* sits at the full-horizon cutoff): the restart machinery reports the honest no-gain.\n");

  const path = writeReport("t2-restart.md", lines.join("\n"));
  console.log(`exp T2 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
