/**
 * EXP2 — implementability as exactness (Rochet / Green-Laffont).
 *
 * A. the exactness identity: dp = -d(W_-i . x) on own-report moves — every
 *    pair sums to 0 BITWISE; the payment 1-form is exact
 * B. potential reconstruction from the base point reproduces every payment
 *    (bitwise) — the potential exists, which is what "Groves" means
 * C. the utility 1-form has no positive cycle (cyclical monotonicity),
 *    machine-scanned over ALL simple cycles
 * D. negative controls: the anti-efficient rule has a POSITIVE cycle (a chain
 *    of lies that pays — no payment can implement it, ROC87) and a positive
 *    direct deviation under any Groves-form payment; the greedy rule breaks
 *    exactness at a measured rate (the quantum-mech T5 lesson, restated)
 */
import { Rng } from "../src/core/rng.js";
import { buildWorld } from "../src/mech/world.js";
import { clarkeH, exactnessImbalance, potentialReconstructionError } from "../src/mech/groves.js";
import { directDeviationMax, rochetScan, utilityOneForm, type RuledWorld } from "../src/mech/rochet.js";
import { cycleScan } from "../src/core/cycles.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];
  const rng = new Rng(31415);

  // --- A + B: exactness and potential (30 worlds)
  let worstExact = 0;
  let worstPotential = 0;
  for (let trial = 0; trial < 30; trial++) {
    const w = buildWorld(rng, 3, 1, 5);
    const h = clarkeH(w);
    const K = w.reports.length;
    for (let a = 0; a < K; a++) {
      worstExact = Math.max(worstExact, Math.abs(exactnessImbalance(w, a, (a + 1) % K, h)));
      for (let b = 0; b < K; b++) worstExact = Math.max(worstExact, Math.abs(exactnessImbalance(w, a, b, h)));
    }
    for (let k = 0; k < K; k++) {
      worstPotential = Math.max(worstPotential, Math.abs(potentialReconstructionError(w, k, h)));
    }
  }
  if (worstExact !== 0) failures.push(`exactness imbalance ${worstExact} (must be bitwise 0)`);
  if (worstPotential !== 0) failures.push(`potential reconstruction error ${worstPotential} (must be bitwise 0)`);
  console.log(`A. payment 1-form exact: dp + d(W_-i . x) = 0 bitwise over all pairs (worst ${worstExact})`);
  console.log(`B. potential reconstruction bitwise exact (worst ${worstPotential})`);

  // --- C: utility 1-form cycles (Groves + efficient rule)
  let worstCycle = -Infinity;
  let cycleCount = 0;
  for (let trial = 0; trial < 30; trial++) {
    const w: RuledWorld = { ...buildWorld(rng, 3, 1, 5), rule: "efficient" };
    const h = clarkeH(w);
    const scan = cycleScan(w.reports.length, utilityOneForm(w, h));
    worstCycle = Math.max(worstCycle, scan.max);
    cycleCount = scan.count;
  }
  if (worstCycle > 0) failures.push(`positive utility cycle under Groves: ${worstCycle}`);
  console.log(`C. cyclical monotonicity holds: max utility cycle sum ${worstCycle} <= 0 over ${cycleCount} simple cycles/world`);

  // --- D: negative and positive controls
  const negRows: string[][] = [];
  {
    const w: RuledWorld = { ...buildWorld(rng, 3, 1, 5), rule: "anti-efficient" };
    const scan = rochetScan(w);
    const h = clarkeH(w);
    const dev = directDeviationMax(w, h);
    negRows.push(["anti-efficient", scan.maxCycle.toString(), scan.worstCycle.join("->"), dev.toFixed(0)]);
    if (!(scan.maxCycle > 0)) failures.push(`anti-efficient: no positive cycle found (${scan.maxCycle})`);
    if (!(dev > 0)) failures.push(`anti-efficient: no direct profitable deviation (${dev})`);
    console.log(`D1. anti-efficient: positive cycle ${scan.maxCycle} on ${scan.worstCycle.join("->")}; direct deviation gain ${dev}`);

    // second-best (one step from optimal): the approximate-solver villain
    let sbViolations = 0;
    const sbTrials = 40;
    let worstSb = 0;
    let sbWorstCycle: number[] = [];
    for (let t = 0; t < sbTrials; t++) {
      const sb: RuledWorld = { ...buildWorld(rng, 3, 1, 5), rule: "second-best" };
      const scanSb = rochetScan(sb);
      if (!scanSb.implementable) {
        sbViolations++;
        if (scanSb.maxCycle > worstSb) {
          worstSb = scanSb.maxCycle;
          sbWorstCycle = scanSb.worstCycle;
        }
      }
    }
    negRows.push(["second-best (runner-up)", `${sbViolations}/${sbTrials} not implementable`, sbWorstCycle.join("->") || "-", worstSb.toString()]);
    if (!(sbViolations > 0)) failures.push("second-best rule never violated cyclical monotonicity — expected the approximate-solver pathology");
    console.log(`D2. second-best rule: ${sbViolations}/${sbTrials} worlds have a positive cycle (worst ${worstSb} on ${sbWorstCycle.join("->")}) — one step from optimal breaks exactness, the quantum-mech T5 lesson restated`);

    // greedy serial dictatorship: a POSITIVE control the machine insisted on —
    // fixed-order SD is the classic strategyproof allocation (we initially
    // wrote it as a negative control; the machine refused to break it)
    let sdImplementable = 0;
    const sdTrials = 40;
    for (let t = 0; t < sdTrials; t++) {
      const g: RuledWorld = { ...buildWorld(rng, 3, 1, 5), rule: "greedy" };
      if (rochetScan(g).implementable) sdImplementable++;
    }
    negRows.push(["greedy serial dictatorship", `${sdImplementable}/${sdTrials} implementable (positive control)`, "-", "0"]);
    if (sdImplementable !== sdTrials) failures.push(`serial dictatorship implementable only ${sdImplementable}/${sdTrials} — expected all (classical fact)`);
    console.log(`D3. greedy serial dictatorship: implementable in ${sdImplementable}/${sdTrials} worlds — the machine's correction of our draft: SD is the classic strategyproof rule, not a villain`);
  }

  const body = [
    "# EXP2 — implementability as exactness",
    "",
    "## A/B. the payment 1-form is exact",
    "",
    "dp_i = -d(W_-i . x) on own-report moves: every pair imbalance is 0 BITWISE",
    `over 30 worlds (worst ${worstExact}); the reconstructed potential P(k) = p(0) +`,
    "W_-i(x(0)) - W_-i(x(k)) reproduces every Groves payment bitwise.",
    "",
    "## C. cyclical monotonicity (ROC87), machine-scanned",
    "",
    `Max utility cycle sum ${worstCycle} <= 0 over all ${cycleCount} simple cycles`,
    "per world — no chain of lies pays.",
    "",
    "## D. controls: one villain, one classic, one correction",
    "",
    table(["rule", "verdict", "worst cycle", "cycle sum / deviation"], negRows),
    "",
    "- anti-efficient: not implementable — a positive cycle exists and a direct",
    "  deviation pays under any Groves-form payment (ROC87 negative).",
    "- second-best: the approximate solver one step from optimal breaks",
    "  cyclical monotonicity at a measured rate — the mechanism-design face of",
    "  the quantum-mech T5 result ('approximate allocation + Groves payments =",
    "  incentive incompatible'). 'Provable optimal' is not a slogan; it is the",
    "  closedness of a 1-form.",
    "- greedy serial dictatorship: a POSITIVE control the machine insisted on —",
    "  we drafted it as a villain and the machine refused to break it: SD with",
    "  a fixed agent order is the classic strategyproof rule. Recorded as a",
    "  correction, not buried.",
    "",
  ].join("\n");
  const file = writeReport("exp2-rochet.md", body);

  if (failures.length > 0) {
    console.error("EXP2 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP2 OK — ${file}`);
  }
}

run();
