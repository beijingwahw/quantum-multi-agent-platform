/**
 * W2 — the marginal tariff, stated correctly: the cache does not leak the
 * QUESTION (I(B answer; A question) = 0), and no local processing on either
 * side creates A-dependence in B's answer. The answer-answer bit (1, aligned
 * axes) is real — it lives in the joint column, priced by W4.
 */
import {
  cmatZero,
  hsDistance,
  jointTable,
  mutualInfoBits,
  reduceB,
  Rng,
  wernerPair,
} from "../kernel/state.js";
import { cptpOnB, randomUnitary2, unitaryOnA } from "../kernel/tariff.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

function bMarginal(rho: Parameters<typeof jointTable>[0], aSetting: readonly number[], bAxis: readonly number[]): number {
  const t = jointTable(rho, aSetting, bAxis);
  return (t[0][0]) + (t[1][0]);
}

function main(): void {
  const lines: string[] = [];
  lines.push("# W2 — the marginal tariff: the cache does not leak the question\n");
  const rho = wernerPair(1);
  const rng = new Rng(777);

  lines.push("## A. I(B answer; A question) = 0 — B's answer is uniform under every setting\n");
  const settings: number[][] = [];
  for (let i = 0; i < 24; i++) settings.push(rng.axis());
  let worst = 0;
  for (const a of settings) {
    for (const b of settings.slice(0, 4)) {
      worst = Math.max(worst, Math.abs(bMarginal(rho, a, b) - 0.5));
    }
  }
  lines.push(`- 24 A-settings x 4 B-axes: worst |P(y) - 1/2| = ${fmt(worst, 15)}`);
  lines.push("- B reduced state vs I/2: HS " + fmt(hsDistance(reduceB(rho), (() => { const m = cmatZero(2); m.re[0]![0] = 0.5; m.re[1]![1] = 0.5; return m; })()), 15));
  lines.push("\nThe question may be any of the 24 axes; the answer distribution never moves. This is GRW80 executed.\n");

  lines.push("## B. A-side operations do not reach B — the joint state does move\n");
  let worstMarginal = 0;
  let minJointMove = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 10; i++) {
    const u = randomUnitary2(rng);
    const mapped = unitaryOnA(rho, u);
    const a = rng.axis();
    const b = rng.axis();
    worstMarginal = Math.max(worstMarginal, Math.abs(bMarginal(mapped, a, b) - 0.5));
    minJointMove = Math.min(minJointMove, hsDistance(mapped, rho));
  }
  lines.push(`- 10 random A-unitaries: worst B-marginal dev ${fmt(worstMarginal, 15)}; smallest joint-state HS move ${fmt(minJointMove, 6)}`);
  lines.push("- (the A-side CPTP generality of this statement is the bqp-map exp6 B1 certificate — carried, not duplicated)");
  lines.push("\nA's whole laboratory changes the joint column and cannot touch B's row.\n");

  lines.push("## C. B-side local maps: bias your own coin, inject zero A-dependence\n");
  let worstBias = 0;
  let worstADependence = 0;
  for (let i = 0; i < 10; i++) {
    const mapped = cptpOnB(rho, rng);
    const b = rng.axis();
    const a1 = settings[i] as number[];
    const a2 = settings[i + 10] as number[];
    const p1 = bMarginal(mapped, a1, b);
    const p2 = bMarginal(mapped, a2, b);
    worstBias = Math.max(worstBias, Math.abs(p1 - 0.5));
    worstADependence = Math.max(worstADependence, Math.abs(p1 - p2));
  }
  lines.push(`- 10 structured CPTP maps on B: largest self-bias |P(y)-1/2| = ${fmt(worstBias, 6)} (B may tilt its own coin — non-unital maps)`);
  lines.push(`- same maps, A-dependence |P(y|a1) - P(y|a2)| = ${fmt(worstADependence, 15)} (exactly zero at every precision that matters)`);

  lines.push("\n## D. the bits, stated correctly\n");
  const z = [0, 0, 1];
  const tAligned = jointTable(rho, z, z);
  lines.push(`- I(B answer; A QUESTION) = 0 — verified above as the settings-grid invariance`);
  lines.push(`- I(B answer; A ANSWER), aligned axes, from the joint table: ${fmt(mutualInfoBits(tAligned), 15)} bit — the full bit is real, and it lives in the joint column`);
  lines.push("- access to that bit arrives only when A's half travels the classical channel — W4 prices that trip\n");

  const path = writeReport("w2-marginal.md", lines.join("\n"));
  console.log(`exp W2 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
