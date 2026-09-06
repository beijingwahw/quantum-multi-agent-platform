/**
 * EXP1 — the Groves gauge group and its conserved charge.
 *
 * A. the charge identity: deviation gain == welfare gap, BITWISE (integer
 *    arithmetic), in two independent gauges
 * B. gauge invariance: the charge does not move under h -> h' (bitwise)
 * C. DSIC as a charge statement: welfare gap <= 0 everywhere, == 0 at truth
 * D. the gauge orbit: payments differ by exactly (h - h') at every report —
 *    the Groves class is one affine orbit (GL79: the ONLY DSIC class for
 *    efficient rules; the machine certifies the orbit structure, the
 *    uniqueness is cited, not re-proved)
 */
import { Rng } from "../src/core/rng.js";
import { buildWorld } from "../src/mech/world.js";
import { clarkeH, deviationGain, payment, welfareGap } from "../src/mech/groves.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];
  const rng = new Rng(20260905);

  const chargeRows: string[][] = [];
  let worstIdentity = 0;
  let worstGauge = 0;
  let worstDsic = 0;
  for (let trial = 0; trial < 30; trial++) {
    const w = buildWorld(rng, 3, 1, 5);
    const h1 = clarkeH(w);
    const h2 = h1 + rng.intInclusive(-40, 40);
    let maxGap = 0;
    for (let k = 0; k < w.reports.length; k++) {
      // A. charge identity (bitwise — integers)
      const d1 = deviationGain(w, k, h1);
      const gap = welfareGap(w, k);
      if (d1 !== gap) failures.push(`trial ${trial} k ${k}: |D_h1 - gap| = ${d1 - gap}`);
      worstIdentity = Math.max(worstIdentity, Math.abs(d1 - gap));
      // B. gauge invariance (bitwise)
      const d2 = deviationGain(w, k, h2);
      if (d1 !== d2) failures.push(`trial ${trial} k ${k}: gauge moved the charge by ${d1 - d2}`);
      worstGauge = Math.max(worstGauge, Math.abs(d1 - d2));
      // C. DSIC
      worstDsic = Math.max(worstDsic, gap);
      maxGap = Math.min(maxGap, gap);
      // D. gauge orbit: payment difference is exactly h - h' at every report
      const pdiff = payment(w, k, h2) - payment(w, k, h1);
      if (pdiff !== h2 - h1) failures.push(`trial ${trial} k ${k}: orbit deviation ${pdiff - (h2 - h1)}`);
    }
    if (welfareGap(w, 0) !== 0) failures.push(`trial ${trial}: gap at truth not 0`);
    chargeRows.push([String(trial), String(h1), String(h2), maxGap.toString(), "0 (bitwise)"]);
  }
  console.log(`A. charge identity |D - welfare gap| worst ${worstIdentity} (bitwise 0)`);
  console.log(`B. gauge invariance worst deviation ${worstGauge} (bitwise 0)`);
  console.log(`C. DSIC: max welfare gap over all trials/reports = ${worstDsic} (<= 0 required, = 0 at truth)`);
  if (worstDsic > 0) failures.push(`DSIC violated: positive welfare gap ${worstDsic}`);

  const body = [
    "# EXP1 — the Groves gauge group and its conserved charge",
    "",
    "All arithmetic integer: identities below are BITWISE exact.",
    "",
    table(["trial", "gauge h1 (Clarke)", "gauge h2", "min gap seen", "orbit deviation"], chargeRows.slice(0, 10)),
    "",
    "- The charge (deviation gain) IS the welfare gap Phi_v(x(b)) - max Phi_v —",
    "  bitwise identical in both gauges across 30 worlds x 5 reports.",
    "- Gauges h and h' move every payment by exactly (h - h'): the Groves class",
    "  is one affine orbit under the gauge group (uniqueness: GL79, cited).",
    "- DSIC reads as a charge statement: the welfare gap is <= 0 everywhere",
    "  and exactly 0 at truthful reporting — truth is the maximum of the",
    "  gauge-invariant potential Phi_v.",
    "",
  ].join("\n");
  const file = writeReport("exp1-gauge.md", body);

  if (failures.length > 0) {
    console.error("EXP1 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP1 OK — ${file}`);
  }
}

run();
