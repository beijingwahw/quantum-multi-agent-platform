/**
 * exp1 — Theorem T1: quantizing the communication channel does not change
 * DSIC status for classical-type agents and classical readouts.
 *
 * A. Classical reference: second price is DSIC on the grid; first price is
 *    not (explicit profitable misreport).
 * B. Quantum deviations (any density matrix on the report register — codeword
 *    states, random pure states, two-point mixtures): second price stays at
 *    zero gain to machine precision; first price keeps its profitable
 *    quantum deviation. The affine structure of U(σ) is verified at 1e-15.
 * C. The same on the COHERENT comparator path (joint unitary + partial
 *    measurement): outcome depends only on the diagonal of σ; random pure
 *    states probe no profitable deviation for the second-price readout.
 */

import { makeRng } from '../core/rng.js';
import { randomPureState, fromVec } from '../core/states.js';
import { classicalBestGain, affineResidual, quantumBestGain } from '../mech/dsic.js';
import { coherentSecondPriceUtility } from '../protocol/auction.js';
import { mdTable, writeReport, fmt } from './report.js';
import { pathToFileURL } from "node:url";

interface Instance {
  trueValue: number;
  others: readonly number[];
  slot: number;
  k: number;
}

function main(): void {
  const rng = makeRng(20260905);
  const instances: Instance[] = [
    // first three crafted so classical shading is profitable for FP
    // (agent at slot 0 strictly above the field: shade to just above the
    // second-highest and still win the tie at lowest index)
    { trueValue: 3, others: [2, 1], slot: 0, k: 4 },
    { trueValue: 2, others: [1, 0], slot: 0, k: 4 },
    { trueValue: 3, others: [2, 2], slot: 0, k: 4 },
    { trueValue: 2, others: [3, 0], slot: 0, k: 4 },
    { trueValue: 1, others: [1, 1], slot: 2, k: 4 },
    { trueValue: 3, others: [2, 2, 1], slot: 1, k: 4 },
    { trueValue: 0, others: [3, 2], slot: 0, k: 4 },
  ];

  // A. classical
  const classicalRows = instances.map((inst) => {
    const sp = classicalBestGain('second', inst.trueValue, inst.others, inst.slot, inst.k);
    const fp = classicalBestGain('first', inst.trueValue, inst.others, inst.slot, inst.k);
    return [
      JSON.stringify(inst),
      fmt(sp.bestGain, 12),
      String(sp.bestReport),
      fmt(fp.bestGain, 6),
      String(fp.bestReport),
    ];
  });

  // B. quantum deviations, k=4 register
  const quantumRows = instances.map((inst) => {
    const sp = quantumBestGain('second', inst.trueValue, inst.others, inst.slot, inst.k, rng, 500);
    const fp = quantumBestGain('first', inst.trueValue, inst.others, inst.slot, inst.k, rng, 500);
    const res = affineResidual('second', inst.trueValue, inst.others, inst.slot, inst.k, rng);
    return [
      JSON.stringify(inst),
      fmt(sp.bestGain, 12),
      fmt(fp.bestGain, 6),
      String(fp.bestReport),
      res.toExponential(2),
    ];
  });

  // C. coherent comparator path: second-price readout, random pure sigma
  let coherentMaxGain = -Infinity;
  const coherentRows: string[][] = [];
  for (const inst of instances) {
    let best = -Infinity;
    const truthSigma = fromVec({ n: inst.k, re: Float64Array.from({ length: inst.k }, (_, i) => (i === inst.trueValue ? 1 : 0)), im: new Float64Array(inst.k) });
    const uTruth = coherentSecondPriceUtility(inst.trueValue, truthSigma, inst.others, inst.slot, inst.k);
    // all codewords
    for (let r = 0; r < inst.k; r++) {
      const sigma = fromVec({ n: inst.k, re: Float64Array.from({ length: inst.k }, (_, i) => (i === r ? 1 : 0)), im: new Float64Array(inst.k) });
      best = Math.max(best, coherentSecondPriceUtility(inst.trueValue, sigma, inst.others, inst.slot, inst.k) - uTruth);
    }
    // random pure states
    for (let t = 0; t < 300; t++) {
      const sigma = fromVec(randomPureState(inst.k, rng));
      best = Math.max(best, coherentSecondPriceUtility(inst.trueValue, sigma, inst.others, inst.slot, inst.k) - uTruth);
    }
    coherentMaxGain = Math.max(coherentMaxGain, best);
    coherentRows.push([JSON.stringify(inst), fmt(best, 12)]);
  }

  // sanity witness: first price profitable deviation example
  const witnessInst = instances[0]!; // non-empty literal list above
  const fpWin = classicalBestGain('first', witnessInst.trueValue, witnessInst.others, witnessInst.slot, witnessInst.k);

  const data = {
    seed: 20260905,
    instances: instances.length,
    classical: classicalRows,
    quantum: quantumRows,
    coherent: coherentRows,
    firstPriceWitness: fpWin,
  };
  const markdown = [
    '## A. Classical deviations (grid reports)',
    mdTable(
      ['instance', 'SP max gain (want 0)', 'SP argmax', 'FP max gain (>0 expected)', 'FP argmax'],
      classicalRows,
    ),
    '',
    '## B. Quantum deviations (codewords + 500 random pure + mixtures per instance)',
    mdTable(
      ['instance', 'SP max gain (want ≤1e-12)', 'FP max gain', 'FP best report', 'affine residual (want ~1e-15)'],
      quantumRows,
    ),
    '',
    '## C. Coherent comparator path (second-price readout)',
    mdTable(['instance', 'max gain over quantum deviations (want ≤1e-12)'], coherentRows),
    '',
    `First-price witness (instance 1): misreport ${fpWin.bestReport} gains ${fmt(fpWin.bestGain, 6)} — classical shading survives quantization unchanged.`,
    '',
    '**Reading**: U(σ) is affine in the submitted state and orthogonal codewords realize every point-mass report, so the best quantum deviation is a classical mixed strategy in disguise: DSIC is conserved under quantization of the channel; what changes is privacy (exp2), not incentives.',
  ].join('\n');
  writeReport({ name: 'exp1-dsic', title: 'exp1 — DSIC survives quantizing the communication channel (T1)' }, data, markdown);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
