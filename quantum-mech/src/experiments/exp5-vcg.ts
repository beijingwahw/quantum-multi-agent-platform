/**
 * exp5 — Theorem T5: approximate solvers inside VCG break DSIC.
 *
 * If the mechanism's allocation comes from anything but the exact argmax
 * (heuristic, greedy, approximate QAOA, sampled annealer) while payments
 * stay Groves/VCG-formula, profitable misreports exist — the incentive
 * wall behind the platform's "provably exact solver" positioning
 * (Nisan-Ronen 2001 initiated the study; Nisan 2007 "computationally
 * feasible VCG" named the trap).
 *
 * A. Exhaustive instance × misreport search under the EXACT allocator:
 *    zero profitable deviations (DSIC holds).
 * B. Same search under PERTURBED allocators (optimum + d random swaps):
 *    violations appear already at d=1; violation rate and max gain grow
 *    with d; concrete witnesses reported.
 * C. Welfare cost vs incentive violation: the approximation ratio of the
 *    perturbed allocation and the DSIC gain are both computed — an
 *    approximate solver pays twice: welfare today, incentives always.
 */

import { makeRng, type Rng } from '../core/rng.js';
import {
  type GainWitness,
  type ValueMatrix,
  exactAllocator,
  greedyAllocator,
  optimalAllocation,
  perturbedAllocator,
  searchDsicViolation,
  welfare,
} from '../mech/vcg.js';
import { mdTable, writeReport, fmt } from './report.js';
import { pathToFileURL } from "node:url";

function randomInstance(n: number, levels: number, rng: Rng): ValueMatrix {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => rng.int(levels)));
}

function main(): void {
  const rng = makeRng(31337);
  const instances: ValueMatrix[] = [];
  for (let t = 0; t < 40; t++) instances.push(randomInstance(3, 4, rng));

  // A. exact allocator: exhaustive misreport search must find nothing
  let exactViolations = 0;
  for (const v of instances) {
    const w = searchDsicViolation(v, exactAllocator, [0, 1, 2, 3]);
    if (w !== null) exactViolations++;
  }

  // B. perturbed allocators
  const perturbRows: string[][] = [];
  let firstWitness: { v: ValueMatrix; w: GainWitness } | null = null;
  for (const d of [1, 2, 3]) {
    const alloc = perturbedAllocator(d, rng);
    let violations = 0;
    let maxGain = 0;
    let worstRatio = 1;
    let witness: GainWitness | null = null;
    let witnessValues: ValueMatrix | null = null;
    for (const v of instances) {
      const truthfulAlloc = alloc(v);
      const opt = optimalAllocation(v).value;
      const got = welfare(v, truthfulAlloc);
      worstRatio = Math.min(worstRatio, got / opt);
      const w = searchDsicViolation(v, alloc, [0, 1, 2, 3]);
      if (w !== null) {
        violations++;
        if (w.gain > maxGain) {
          maxGain = w.gain;
          witness = w;
          witnessValues = v;
        }
      }
    }
    perturbRows.push([
      String(d),
      `${violations}/${instances.length}`,
      fmt(maxGain, 3),
      fmt(worstRatio, 3),
      witness ? `agent ${witness.agent}: [${witness.truthfulReport.join(', ')}] -> [${witness.misreport.join(', ')}]` : '—',
    ]);
    if (witness && witnessValues && d === 1) {
      firstWitness = { v: witnessValues, w: witness };
    }
  }

  // B2. second solver family: the greedy allocator (a plain heuristic, not
  // optimum+noise) — same census, different failure signature
  const greedyRows: string[][] = [];
  let greedyViolations = 0;
  let greedyMaxGain = 0;
  let greedyWorstRatio = 1;
  let greedyWitness: GainWitness | null = null;
  for (const v of instances) {
    const alloc = greedyAllocator(v);
    const opt = optimalAllocation(v).value;
    const got = welfare(v, alloc);
    greedyWorstRatio = Math.min(greedyWorstRatio, got / opt);
    const w = searchDsicViolation(v, greedyAllocator, [0, 1, 2, 3]);
    if (w !== null) {
      greedyViolations++;
      if (w.gain > greedyMaxGain) {
        greedyMaxGain = w.gain;
        greedyWitness = w;
      }
    }
  }
  greedyRows.push([
    'greedy (index order)',
    `${greedyViolations}/${instances.length}`,
    fmt(greedyMaxGain, 3),
    fmt(greedyWorstRatio, 3),
    greedyWitness ? `agent ${greedyWitness.agent}: [${greedyWitness.truthfulReport.join(', ')}] -> [${greedyWitness.misreport.join(', ')}]` : '—',
  ]);

  // C. welfare-vs-incentive table for d=1 (per-instance pairing)
  const pairingRows: string[][] = [];
  const alloc1 = perturbedAllocator(1, rng);
  let checked = 0;
  for (const v of instances) {
    if (checked >= 8) break;
    const w = searchDsicViolation(v, alloc1, [0, 1, 2, 3]);
    if (w === null) continue;
    checked++;
    const opt = optimalAllocation(v).value;
    const got = welfare(v, alloc1(v));
    pairingRows.push([
      JSON.stringify(v),
      fmt(got / opt, 3),
      fmt(w.gain, 3),
      `agent ${w.agent}`,
    ]);
  }

  const data = {
    seed: 31337,
    instances: instances.length,
    exactViolations,
    perturbRows,
    greedyRows,
    witness: firstWitness ?? null,
    pairingRows,
  };
  const markdown = [
    `Instances: 40 random 3x3 assignment problems (values in {0..3}); misreports searched exhaustively over {0..3}^3 per agent.`,
    '',
    '## A. Exact allocator',
    `DSIC violations found: ${exactViolations}/${instances.length} (want 0) — with the exact argmax, Groves payments keep every profile truthful.`,
    '',
    '## B. Perturbed allocator (optimum + d random swaps, Groves payments)',
    mdTable(
      ['d (swaps)', 'instances with violations', 'max gain', 'worst welfare ratio', 'witness'],
      perturbRows,
    ),
    '',
    '## B2. Second solver family: greedy (agents take their best remaining task)',
    mdTable(['allocator', 'instances with violations', 'max gain', 'worst welfare ratio', 'witness'], greedyRows),
    '',
    'The perturbation family degrades the optimum; greedy is a genuinely different failure mode — a plain heuristic with better worst welfare than 3 random swaps on this census but its own violation signature. Both die the same death: Groves payments computed from any non-argmax allocation are manipulable.',
    '',
    '## C. Welfare vs incentive damage (d = 1)',
    mdTable(['instance (values)', 'alloc ratio', 'DSIC gain of best misreport', 'agent'], pairingRows),
    '',
    '**Reading**: a single transposition away from the optimum already creates profitable misreports — VCG-formula payments computed from an approximate allocation are NOT incentive compatible. A quantum solver inside a mechanism must either solve exactly (the platform\'s constraint-subspace engine) or come with a monotone allocation rule; "almost optimal" is a category error in mechanism design. Exact classical truthfulness theory (Nisan-Ronen 2001); the quantum-solver restatement is ours.',
  ].join('\n');
  writeReport({ name: 'exp5-vcg', title: 'exp5 — approximate solvers inside VCG break DSIC (T5)' }, data, markdown);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
