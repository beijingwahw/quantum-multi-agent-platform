/** Scratch witness run — numbers FIRST, board text AFTER (house law). */
import { census, envelopeCheck, thresholds } from "../kernel/census.js";
import { anneal, greedy, landscapeStats, localSearch, makeInstance, optimumOf, welfareOf } from "../kernel/law.js";

// P1 envelope checks
for (const [m, n] of [
  [2, 3],
  [3, 5],
  [6, 8],
] as const) {
  const r = envelopeCheck(m, n, 1500, [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.7, 1.0, 1.5]);
  console.log(`P1 envelope ${m}x${n}: worst switch deviation ${r.worstSwitchDeviation}`);
}

// P0 cross-check vs the bench at λ=0.35 (record track 6×8 seeds 500k)
{
  let g = 0;
  let ls = 0;
  let sa = 0;
  for (let k = 1; k <= 5; k++) {
    const inst = makeInstance(6, 8, 500 * k, 0.35);
    const opt = optimumOf(inst).welfare;
    if (Math.abs(welfareOf(inst, greedy(inst)) - opt) < 1e-9) g++;
    if (Math.abs(welfareOf(inst, localSearch(inst, greedy(inst))) - opt) < 1e-9) ls++;
    if (Math.abs(welfareOf(inst, anneal(inst, 42)) - opt) < 1e-9) sa++;
  }
  console.log(`P0 cross-check 6x8 λ=0.35: greedy ${g}/5, LS ${ls}/5, SA ${sa}/5 (bench: 2/5, 2/5, 3/5)`);
}

// P3 census + thresholds (20 seeds — the 5-seed pilot quantizes hit rates to 0.2)
const t0 = Date.now();
const points = census(undefined, undefined, 20);
console.log(`P3 census: ${points.length} points in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const cell of thresholds(points)) {
  console.log(
    `P3 ${cell.m}x${cell.n} ${cell.solver}: λ@0 ${cell.hitRateAtZero.toFixed(2)} → λ@1.5 ${cell.hitRateAtMax.toFixed(2)}, crossing ${cell.lambdaCross.toFixed(3)}`,
  );
}

// P4 landscape vs λ at 3x4 and 3x5 (seed 500)
for (const [m, n] of [
  [3, 4],
  [3, 5],
] as const) {
  for (const lambda of [0, 0.3, 0.7, 1.5]) {
    const s = landscapeStats(makeInstance(m, n, 500, lambda));
    console.log(
      `P4 ${m}x${n} λ=${lambda}: nodes ${s.nodes}, localOptima ${s.localOptima}, globalIsLocal ${s.globalIsLocalOptimum}, basin ${(s.globalBasinFraction * 100).toFixed(1)}%`,
    );
  }
}
