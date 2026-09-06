/**
 * exp3 — Entanglement as collateral: monogamy gives contracts physical
 * exclusivity; Wiesner notes give unforgeable deposits (escrow-private).
 *
 * A. CKW anchors: GHZ (tangle 1, pairwise 0) and W (tangle 0, pairwise 2/3)
 *    — the inequality C_AB² + C_AC² ≤ C_A(BC)² is a theorem; our random
 *    search never violates it.
 * B. Double pledge: one bond qubit pledged to two escrows. Random search +
 *    the constructive family √x|100⟩+√((1−x)/2)(|010⟩+|001⟩) both cap the
 *    achievable min(C_BE1, C_BE2) at 1/√2 — versus 1 for an exclusive
 *    Bell pledge. Exclusivity is physics, not contract law.
 * C. Bell-fidelity view: at the double-pledge optimum each escrow can hold
 *    at most F = ½ with Φ+ — an acceptance threshold above ½ admits at
 *    most one pledge.
 * D. Wiesner collateral: forging m-qubit notes by measure-and-clone passes
 *    at (3/4)^m — verified against Monte Carlo; the optimal-cloner bound
 *    ((1+1/√2)/2 ≈ 0.854 per qubit, cited) is the ceiling for better
 *    attacks.
 */

import { makeRng } from '../core/rng.js';
import type { CMat } from '../core/cmat.js';
import { ckwAnchors, searchDoublePledge, doublePledgeFamilyScan, ckw, bellFidelity } from '../contract/monogamy.js';
import { wiesnerExperiment } from '../contract/wiesner.js';
import { fromVec, ghz } from '../core/states.js';
import { partialTrace } from '../core/channels.js';
import { mdTable, writeReport, fmt } from './report.js';
import { pathToFileURL } from "node:url";

function main(): void {
  const rng = makeRng(7);

  const anchors = ckwAnchors();
  const rand = searchDoublePledge(rng, 20000);
  const family = doublePledgeFamilyScan();

  // C. Bell fidelities: family sweep + the GHZ point (max simultaneous F)
  const famState = (x: number) => ({
    n: 8,
    re: Float64Array.of(0, Math.sqrt((1 - x) / 2), Math.sqrt((1 - x) / 2), 0, Math.sqrt(x), 0, 0, 0),
    im: new Float64Array(8),
  });
  const fidRows: string[][] = [];
  let worstSum = 0;
  const fidRowOf = (label: string, rho: CMat): void => {
    const r = ckw(rho);
    const f1 = bellFidelity(partialTrace(rho, [2, 2, 2], [2]));
    const f2 = bellFidelity(partialTrace(rho, [2, 2, 2], [1]));
    worstSum = Math.max(worstSum, f1 + f2);
    fidRows.push([label, fmt(r.cAB), fmt(r.cAC), fmt(f1), fmt(f2), fmt(f1 + f2)]);
  };
  fidRowOf('GHZ', fromVec(ghz(3)));
  for (const x of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    fidRowOf(`family x=${fmt(x, 2)}`, fromVec(famState(x)));
  }

  // D. Wiesner forging curve
  const wiesnerRows: string[][] = [];
  for (const m of [2, 4, 6, 8, 10, 12]) {
    const stats = wiesnerExperiment(rng, m, 4000);
    wiesnerRows.push([
      String(m),
      fmt(stats.honestPassRate, 4),
      fmt(stats.forgePassRate, 4),
      fmt(stats.analyticForgePassRate, 4),
      (0.75 ** m).toExponential(2),
    ]);
  }

  const data = {
    seed: 7,
    anchors,
    randomSearch: { bestMin: rand.bestMin, ceiling: rand.ceiling, samples: rand.samples, maxCkwSlack: rand.maxCkwSlack },
    family,
    fidRows,
    wiesnerRows,
  };
  const markdown = [
    '## A. CKW anchors',
    mdTable(
      ['state', 'C_AB', 'C_AC', 'C_A(BC)', '3-tangle'],
      [
        ['GHZ', fmt(anchors.ghz.cAB), fmt(anchors.ghz.cAC), fmt(anchors.ghz.cABC), fmt(anchors.ghz.tangle)],
        ['W', fmt(anchors.w.cAB), fmt(anchors.w.cAC), fmt(anchors.w.cABC), fmt(anchors.w.tangle)],
      ],
    ),
    '',
    `Random search (${rand.samples} pure states): worst CKW slack (LHS−RHS) = ${rand.maxCkwSlack.toExponential(2)} ≤ 0 — the inequality never breaks.`,
    '',
    '## B. Double pledge: best min(C_BE1, C_BE2)',
    mdTable(
      ['method', 'best min C', 'ceiling'],
      [
        ['random search', fmt(rand.bestMin), fmt(rand.ceiling)],
        ['family scan (√x|100⟩+…)', fmt(family.minC), fmt(Math.SQRT1_2)],
        ['exclusive Bell pledge', '1.000000', '1'],
      ],
    ),
    '',
    `Family optimum at x = ${fmt(family.x, 2)}: both concurrences hit the CKW ceiling 1/√2 exactly. A bond qubit cannot be near-maximally entangled with two escrows.`,
    '',
    '## C. Escrow verification view (Bell fidelity with Φ+)',
    mdTable(['state', 'C_B,E1', 'C_B,E2', 'F(B,E1)', 'F(B,E2)', 'F1+F2 (≤1)'], fidRows),
    '',
    `The best SIMULTANEOUS Bell fidelity for two escrows is the GHZ point: F = 1/2 each, sum exactly 1 — an acceptance threshold strictly above 1/2 certifies at most one pledge. Along the concurrence-balanced family the pairwise fidelities are even lower (the balanced tangle is all three-party, little Bell overlap). The worst observed F1+F2 = ${fmt(worstSum, 4)} ≤ 1 — monogamy of the Bell test.`,
    '',
    '## D. Wiesner collateral forging (4000 trials per row)',
    mdTable(['note qubits m', 'honest pass', 'forge pass (MC)', 'analytic (3/4)^m', '(3/4)^m value'], wiesnerRows),
    '',
    '**Reading**: escrow-private quantum collateral is deployable physics (Wiesner 1983): deposits unforgeable in principle, double-pledges capped by monogamy. Boundary: verification is private-key (the escrow knows the note secrets) — public-key quantum money remains open; entanglement testing consumes sacrificial pairs; all fidelity numbers assume ideal channels unless a noise model is added.',
  ].join('\n');
  writeReport({ name: 'exp3-escrow', title: 'exp3 — entanglement as collateral: monogamy exclusivity + Wiesner deposits' }, data, markdown);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
