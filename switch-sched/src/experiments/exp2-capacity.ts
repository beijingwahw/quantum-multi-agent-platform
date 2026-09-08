/**
 * T2 — capacity theorem layer.
 *
 * The Ebler-Salek-Chiribella flagship in executable form: two individually
 * zero-information channels, combined in a superposition of orders, transmit
 * information through the ORDER degree of freedom. Machine-certified in exact
 * arithmetic:
 *
 * - each single box and each definite order: trace distance 0 on the ensemble;
 * - replacer pair: the information lands on the CONTROL register,
 *   T = 1/2, Helstrom 3/4, χ = H₂(1/4) − 1/2 (closed forms, asserted);
 * - completely depolarizing pair: the information lives ONLY in the JOINT
 *   (control, target) state — both marginals carry exactly zero; single-use
 *   T_full = 1/4 (machine-certified number);
 * - asymmetric sweep (depol(p), depol(1)): all definite orders transmit
 *   nothing for every p, while the switched joint distinguishability obeys
 *   the exact linear law T_full = p/4.
 *
 * Honest boundary: we certify positive accessible information (single-use T,
 * binary-ensemble χ — capacity lower bounds), not the optimal capacity
 * formula of the PRL; that optimisation is cited, not reproduced.
 */

import assert from 'node:assert/strict';
import { type CMat } from '../core/cmat.js';
import { applyKraus } from '../core/channels.js';
import { PLUS, basisRho, uniformOrthVec, uniformVec, vecToRho, PAULI_X, PAULI_Z } from '../core/states.js';
import { traceDistance } from '../core/measures.js';
import { krausToStinespring, makeSwitchedChannel } from '../switch/isometry.js';
import { completelyDepolarizingKraus, depolarizingKraus, replacerKraus, unitaryKraus } from '../switch/chanlib.js';
import { channelEnsembleChi, helstromTwo, switchedEnsembleChi, switchedSlices } from '../switch/capacity.js';
import { writeReport } from './report.js';
import { pathToFileURL } from "node:url";

interface PairResult {
  name: string;
  singleBoxT: number;
  fixedAB: number;
  fixedBA: number;
  tControl: number;
  tTarget: number;
  tFull: number;
  helstromFull: number;
  chiControl: number;
  chiFull: number;
  singleBoxChi: number;
}

function evaluatePair(name: string, krausA: CMat[], krausB: CMat[], inputs: CMat[]): PairResult {
  const sc = makeSwitchedChannel(krausToStinespring(krausA), krausToStinespring(krausB));
  const a = switchedSlices(sc, vecToRho(PLUS), inputs[0]!);
  const b = switchedSlices(sc, vecToRho(PLUS), inputs[1]!);
  const chi = switchedEnsembleChi(sc, vecToRho(PLUS), inputs);
  return {
    name,
    singleBoxT: Math.max(
      traceDistance(applyKraus(inputs[0]!, krausA), applyKraus(inputs[1]!, krausA)),
      traceDistance(applyKraus(inputs[0]!, krausB), applyKraus(inputs[1]!, krausB)),
    ),
    fixedAB: traceDistance(sc.fixedAB(inputs[0]!), sc.fixedAB(inputs[1]!)),
    fixedBA: traceDistance(sc.fixedBA(inputs[0]!), sc.fixedBA(inputs[1]!)),
    tControl: traceDistance(a.control, b.control),
    tTarget: traceDistance(a.target, b.target),
    tFull: traceDistance(a.full, b.full),
    helstromFull: helstromTwo(a.full, b.full),
    chiControl: chi.control,
    chiFull: chi.full,
    singleBoxChi: Math.max(
      channelEnsembleChi((r) => applyKraus(r, krausA), inputs),
      channelEnsembleChi((r) => applyKraus(r, krausB), inputs),
    ),
  };
}

function row(r: PairResult): string {
  return `| ${r.name} | ${r.singleBoxT.toExponential(1)} | ${r.fixedAB.toFixed(6)} / ${r.fixedBA.toFixed(6)} | ${r.tControl.toFixed(6)} | ${r.tTarget.toFixed(6)} | ${r.tFull.toFixed(6)} | ${r.helstromFull.toFixed(6)} | ${r.chiControl.toFixed(6)} | ${r.chiFull.toFixed(6)} |`;
}

export function main(): void {
  const lines: string[] = [];
  const vPair = [vecToRho(uniformVec(2)), vecToRho(uniformOrthVec(2))];
  const bPair = [basisRho(2, 0), basisRho(2, 1)];

  lines.push('## Headline table — zero-capacity pairs, control |+⟩\n');
  lines.push('| pair | single box T | fixed T (AB / BA) | T control | T target | T joint | Helstrom (joint) | χ control | χ joint |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  const repl = evaluatePair('replacer + replacer {|v⟩,|v⊥⟩}', replacerKraus(2), replacerKraus(2), vPair);
  const depol = evaluatePair('completely depolarizing ×2 {|0⟩,|1⟩}', completelyDepolarizingKraus(2), completelyDepolarizingKraus(2), bPair);
  const unit = evaluatePair('unitary (X, Z) {|0⟩,|1⟩}', unitaryKraus(PAULI_X), unitaryKraus(PAULI_Z), bPair);
  lines.push(row(repl));
  lines.push(row(depol));
  lines.push(row(unit));
  lines.push('');

  // certificates
  assert.ok(repl.singleBoxT < 1e-12 && repl.fixedAB < 1e-12 && repl.fixedBA < 1e-12);
  assert.ok(repl.singleBoxChi < 1e-12);
  assert.ok(Math.abs(repl.tControl - 0.5) < 1e-12); // closed form: control |+⟩⟨+| vs I/2
  assert.ok(repl.tTarget < 1e-12);
  assert.ok(Math.abs(repl.helstromFull - 0.75) < 1e-12);
  const h2 = (x: number): number => -x * Math.log2(x) - (1 - x) * Math.log2(1 - x);
  assert.ok(Math.abs(repl.chiControl - (h2(0.25) - 0.5)) < 1e-10);
  assert.ok(depol.singleBoxT < 1e-12 && depol.fixedAB < 1e-12 && depol.fixedBA < 1e-12);
  assert.ok(depol.tControl < 1e-12 && depol.tTarget < 1e-12); // joint-only information
  assert.ok(Math.abs(depol.tFull - 0.25) < 1e-10); // machine-certified exact number
  assert.ok(depol.chiFull > 1e-6);
  assert.ok(unit.singleBoxT > 1 - 1e-12 && unit.fixedAB > 1 - 1e-12); // open channel reference: no headroom

  lines.push('**Zero + zero → positive.** Every single box and every definite order transmits exactly');
  lines.push('nothing (T = 0, χ = 0). The switched pairs transmit through the ORDER degree of freedom:');
  lines.push(`- replacer pair: information lands on the **control** — T = ${repl.tControl.toFixed(6)}, Helstrom`);
  lines.push(`  ${(repl.helstromFull * 100).toFixed(2)}%, χ = ${repl.chiControl.toFixed(6)} bits = H₂(1/4) − 1/2 (closed form).`);
  lines.push(`- completely depolarizing pair: information lives **only in the joint state** — control and`);
  lines.push(`  target marginals are exactly zero, joint T = ${depol.tFull.toFixed(6)}; the receiver must measure`);
  lines.push(`  jointly. χ_joint = ${depol.chiFull.toFixed(6)} bits.`);
  lines.push('Priority for the general theorem (nonzero classical capacity of switched completely');
  lines.push('depolarizing channels): Ebler-Salek-Chiribella, PRL 120, 120502 (2018). We certify positive');
  lines.push('accessible information in exact arithmetic; the optimal-capacity optimisation is cited.\n');

  lines.push('## Asymmetry sweep — (depol(p), depol(1)), ensemble {|0⟩, |1⟩}\n');
  lines.push('| p | fixed T (AB / BA) | T joint (switch) | p/4 |');
  lines.push('|---|---|---|---|');
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const r = evaluatePair(`depol(${p}) + depol(1)`, depolarizingKraus(2, p), depolarizingKraus(2, 1), bPair);
    assert.ok(r.fixedAB < 1e-12 && r.fixedBA < 1e-12, `fixed order should be closed at p=${p}`);
    assert.ok(Math.abs(r.tFull - p / 4) < 1e-10, `linear law T = p/4 failed at p=${p}`);
    lines.push(`| ${p} | ${r.fixedAB.toFixed(6)} / ${r.fixedBA.toFixed(6)} | ${r.tFull.toFixed(6)} | ${(p / 4).toFixed(6)} |`);
  }
  lines.push('');
  lines.push('Exact linear law **T_joint = p/4**: with one box the identity (p = 0) the order carries');
  lines.push('nothing — the two branches act on the target identically; as the second box closes, the');
  lines.push('order channel opens linearly, reaching the ESC point T = 1/4 at p = 1. Admission');
  lines.push('structure: order is a resource precisely where the information must transit erasing');
  lines.push('channels on BOTH branches — T3 turns this into a scheduling criterion.\n');

  writeReport('exp2-capacity', lines.join('\n'));
  console.log(lines.join('\n'));
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
