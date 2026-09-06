/**
 * exp2 — What quantization actually buys: bid privacy.
 *
 * A. Pre-deadline hiding of Wiesner locks: Holevo χ of the auctioneer's
 *    ensemble. 2-basis (BB84-style) leaves residual χ ≈ 0.4/qubit; 3-basis
 *    (6-state) ≈ 0.25/qubit; the padded 'otp' mode is exact (χ = 0).
 * B. Information-disturbance: intercept-measure-resend before the deadline
 *    flips payload bits at rate (1−1/nBases)/2; detection 1−(2/3)^Q for
 *    3 bases over Q payload qubits. Monte Carlo vs analytic.
 * C. Post-auction transcript: classical auctioneers must receive every bid;
 *    the coherent comparator's transcript is (winner, price) only — the
 *    fraction of profile pairs kept indistinguishable.
 */

import { makeRng } from '../core/rng.js';
import { lockedHolevo, lockedTraceDistance, interceptExperiment, transcriptLeakage } from '../protocol/privacy.js';
import { mdTable, writeReport, fmt } from './report.js';
import { pathToFileURL } from "node:url";

function main(): void {
  const rng = makeRng(42);

  // A. hiding quality
  const hidingRows: string[][] = [];
  for (const m of [1, 2, 3]) {
    for (const nBases of [2, 3] as const) {
      const chiW = lockedHolevo(m, nBases, 'wiesner');
      const tdW = lockedTraceDistance(m, nBases, 'wiesner').worst;
      hidingRows.push([
        String(m),
        `${nBases} (wiesner)`,
        fmt(chiW),
        fmt(chiW / m),
        fmt(tdW, 4),
      ]);
    }
    const chiO = lockedHolevo(m, 3, 'otp');
    const tdO = lockedTraceDistance(m, 3, 'otp').worst;
    hidingRows.push([String(m), '3 (otp)', chiO.toExponential(2), chiO.toExponential(2), tdO.toExponential(2)]);
  }

  // B. info-disturbance
  const disturbRows: string[][] = [];
  for (const m of [2, 3, 4]) {
    for (const nBases of [2, 3] as const) {
      const stats = interceptExperiment(4000, m, nBases, rng);
      disturbRows.push([
        String(m),
        String(nBases),
        fmt(stats.flipRate, 4),
        fmt(stats.analyticFlipRate, 4),
        fmt(stats.detectionRate, 4),
        fmt(stats.analyticDetectionRate, 4),
      ]);
    }
  }

  // C. transcript minimization
  const transcriptRows: string[][] = [];
  for (const [n, k] of [
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3],
    [3, 4],
    [4, 3],
  ] as const) {
    const t = transcriptLeakage(n, k);
    transcriptRows.push([
      `${n} bidders, k=${k}`,
      String(t.pairs),
      '100%',
      `${((t.quantumDistinguishable / t.pairs) * 100).toFixed(1)}%`,
      `${((t.hiddenPairs / t.pairs) * 100).toFixed(1)}%`,
    ]);
  }

  const data = { seed: 42, hidingRows, disturbRows, transcriptRows };
  const markdown = [
    '## A. Pre-deadline hiding (Holevo χ in bits; payload m bits)',
    mdTable(['m', 'key family', 'χ total', 'χ per qubit', 'worst trace distance'], hidingRows),
    '',
    'The unpadded Wiesner lock leaks — conjugate bases alone do NOT make the ensemble maximally mixed. The padded mode (key = basis + pad bit, 2 key bits/qubit) is the quantum one-time pad: χ = 0 exactly.',
    '',
    '## B. Intercept-measure-resend (4000 trials per cell)',
    mdTable(
      ['payload qubits m', 'bases', 'MC flip rate', 'analytic flip', 'MC detection', 'analytic detection'],
      disturbRows,
    ),
    '',
    'Peeking is detectable, not impossible: wrong-basis measurements disturb at rate (1−1/nBases)/2 per qubit, and every payload qubit doubles as a check (real deployments add sacrificial qubits with the same statistics). No-cloning closes the escape: an auctioneer cannot both pass the checks and keep a readable copy for after key release — any surviving copy IS the checked one.',
    '',
    '## C. Post-auction transcript (honest-but-curious auctioneer, junk erased)',
    mdTable(
      ['setting', 'profile pairs', 'classical distinguishable', 'quantum distinguishable', 'kept hidden'],
      transcriptRows,
    ),
    '',
    '**Reading**: a classical auctioneer must receive every bid (100% distinguishable); the coherent comparator measures only (winner, price) — with the retention schedule (bid registers returned/erased), the identity of every loser and all third-and-lower bid values never enter the transcript. The NUMBER of hidden profile pairs grows with the field (40 pairs at 3x3, 411 at 4x3) while the fraction stays O(1/k). Boundary: this holds against honest-but-curious auctioneers; a malicious one who refuses to erase keeps the junk registers — erasure is an auditable operational assumption, not a theorem.',
  ].join('\n');
  writeReport({ name: 'exp2-privacy', title: 'exp2 — no-cloning bid privacy: locking, disturbance, minimal transcripts' }, data, markdown);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
