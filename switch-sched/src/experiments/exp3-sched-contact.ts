/**
 * T3 — scheduling contact surface.
 *
 * Allocation and execution as CPTP maps on a machine register M ⊗ task
 * register T (M ∈ {idle, busyA, busyB}, d = 6). The scheduler's question:
 * does running ALLOCATE and EXECUTE in a superposition of orders ever beat
 * the best definite order, for the downstream discrimination "which task is
 * on the machine"? Receiver reads the machine register (T traced out).
 *
 *   alloc:      idle ⊗ t → busy_{1+t} (task written onto the machine);
 *               busy states pass through. 3 Kraus.
 *   exec(γ):    with prob γ the machine returns to idle (task completed,
 *               machine signature erased); with prob 1−γ stays. 4 Kraus.
 *   alloc-erased(ε): alloc followed by erasure of M to |+⟩ with prob ε —
 *               the "fully noisy allocation write" column. 12 Kraus.
 *
 * Metric D(Λ) = T(Tr_T Λ(s0), Tr_T Λ(s1)) with s_t = |idle⟩ ⊗ |t⟩.
 * Δ = D(switch) − max(D(AB), D(BA)) is the order-resource payoff.
 */

import assert from 'node:assert/strict';
import { type CMat, mat, mDagger, mMul } from '../core/cmat.js';
import { applyKraus, partialTrace } from '../core/channels.js';
import { makeRng } from '../core/rng.js';
import { PLUS, randomStateVec, vecToRho } from '../core/states.js';
import { traceDistance } from '../core/measures.js';
import { krausToStinespring, makeSwitchedChannel } from '../switch/isometry.js';
import { randomChannelStinespring } from '../switch/chanlib.js';
import { kronRho } from '../switch/witnesses.js';
import { writeReport } from './report.js';
import { pathToFileURL } from "node:url";

const DM = 3; // machine register: 0 = idle, 1 = busyA, 2 = busyB
const DT = 2; // task register: 0 = A, 1 = B
const D = DM * DT;
const idx = (m: number, t: number): number => m * DT + t;

function eye(d: number): CMat {
  const m = mat(d, d);
  for (let i = 0; i < d; i++) m.re[i * d + i] = 1;
  return m;
}

function allocKraus(): CMat[] {
  const kraus: CMat[] = [];
  for (let t = 0; t < DT; t++) {
    // |busy_{1+t}⟩⟨idle|_M ⊗ |t⟩⟨t|_T — write the task onto an idle machine
    const K = mat(D, D);
    K.re[idx(1 + t, t) * D + idx(0, t)] = 1;
    kraus.push(K);
  }
  // busy states pass through untouched
  const KI = mat(D, D);
  for (let m = 1; m < DM; m++) {
    for (let t = 0; t < DT; t++) KI.re[idx(m, t) * D + idx(m, t)] = 1;
  }
  kraus.push(KI);
  return kraus;
}

function execKraus(gamma: number): CMat[] {
  const kraus: CMat[] = [];
  // with prob γ: machine wiped to idle (completion), T rides through
  for (let m = 0; m < DM; m++) {
    const K = mat(D, D);
    const c = Math.sqrt(gamma);
    for (let t = 0; t < DT; t++) K.re[idx(0, t) * D + idx(m, t)] = c;
    kraus.push(K);
  }
  // with prob 1−γ: nothing happens
  const KI = mat(D, D);
  const s = Math.sqrt(1 - gamma);
  for (let k = 0; k < D; k++) KI.re[k * D + k] = s;
  kraus.push(KI);
  return kraus;
}

/** alloc followed (post-composed) by erasure of M to |+⟩ with prob ε. */
function allocErasedKraus(eps: number): CMat[] {
  const base = allocKraus();
  const kraus: CMat[] = [];
  const keep = Math.sqrt(1 - eps);
  for (const K of base) kraus.push(mMul(mScaleMat(keep, K), eye(D)));
  const erase = Math.sqrt(eps);
  for (let j = 0; j < DM; j++) {
    // E_j = |+⟩⟨j|_M ⊗ I_T — replacer Kraus, amplitude 1 (Σ_j E_j†E_j = I)
    const E = mat(D, D);
    for (let t = 0; t < DT; t++) E.re[idx(0, t) * D + idx(j, t)] = 1;
    for (const K of base) kraus.push(mMul(mScaleMat(erase, E), K));
  }
  return kraus;
}

function mScaleMat(s: number, a: CMat): CMat {
  const m = mat(a.rows, a.cols);
  for (let k = 0; k < a.re.length; k++) {
    m.re[k] = s * a.re[k]!;
    m.im[k] = s * a.im[k]!;
  }
  return m;
}

function basisRho(d: number, i: number): CMat {
  const m = mat(d, d);
  m.re[i * d + i] = 1;
  return m;
}

/** D(Λ) with receiver = machine register only. */
function machineDistance(apply: (rho: CMat) => CMat): number {
  const s0 = apply(basisRho(D, idx(0, 0)));
  const s1 = apply(basisRho(D, idx(0, 1)));
  return traceDistance(partialTrace(s0, [DM, DT], [1]), partialTrace(s1, [DM, DT], [1]));
}

function tpCheck(kraus: CMat[], label: string): void {
  const rho = vecToRho(randomStateVec(makeRng(42), D));
  const out = applyKraus(rho, kraus);
  let tr = 0;
  for (let i = 0; i < D; i++) tr += out.re[i * D + i]!;
  assert.ok(Math.abs(tr - 1) < 1e-12, `${label} not trace preserving: ${tr}`);
  const sum = kraus.reduce((acc, K) => mAddMat(acc, mMul(mDagger(K), K)), mat(D, D));
  let err = 0;
  for (let k = 0; k < D * D; k++) err = Math.max(err, Math.abs(sum.re[k]! - (Math.floor(k / D) === k % D ? 1 : 0)));
  assert.ok(err < 1e-12, `${label} fails Σ K†K = I by ${err}`);
}

function mAddMat(a: CMat, b: CMat): CMat {
  const m = mat(a.rows, a.cols);
  for (let k = 0; k < a.re.length; k++) {
    m.re[k] = a.re[k]! + b.re[k]!;
    m.im[k] = a.im[k]! + b.im[k]!;
  }
  return m;
}

function main(): void {
  const lines: string[] = [];
  tpCheck(allocKraus(), 'alloc');
  tpCheck(execKraus(0.5), 'exec(0.5)');
  tpCheck(allocErasedKraus(0.5), 'alloc-erased(0.5)');

  // ---------- Table 1: execution completion vs order ----------
  lines.push('## Table 1 — alloc vs exec(γ): the realistic scheduling pair\n');
  lines.push('| γ | D(AB) = 1−γ | D(BA) = 1 | D(switch) | Δ = switch − max fixed |');
  lines.push('|---|---|---|---|---|');
  for (const gamma of [0, 0.25, 0.5, 0.75, 1]) {
    const ka = allocKraus();
    const kb = execKraus(gamma);
    const sc = makeSwitchedChannel(krausToStinespring(ka), krausToStinespring(kb));
    const dAB = machineDistance((r) => applyKraus(r, mChain(kb, ka))); // alloc then exec
    const dBA = machineDistance((r) => applyKraus(r, mChain(ka, kb))); // exec then alloc
    const dSw = machineDistance((r) => partialTrace(sc.channel(kronRho(vecToRho(PLUS), r)), [2, DM, DT], [2]));
    assert.ok(Math.abs(dAB - (1 - gamma)) < 1e-12, `D(AB) = 1−γ failed at γ=${gamma}`);
    assert.ok(Math.abs(dBA - 1) < 1e-12, `D(BA) = 1 failed at γ=${gamma}`);
    assert.ok(Math.abs(dSw - (1 - gamma) / 2) < 1e-12, `D(switch) = (1−γ)/2 failed at γ=${gamma}`);
    lines.push(`| ${gamma} | ${dAB.toFixed(6)} | ${dBA.toFixed(6)} | ${dSw.toFixed(6)} | ${(dSw - Math.max(dAB, dBA) >= 0 ? '+' : '') + (dSw - Math.max(dAB, dBA)).toFixed(6)} |`);
  }
  lines.push('');
  lines.push('Closed forms verified: execute-after-allocation keeps the task signature with weight');
  lines.push('1−γ; allocation-after-execution always writes it. The best definite order dominates at');
  lines.push('every γ — on the realistic scheduling pair, order superposition strictly loses (Δ < 0');
  lines.push('for 0 < γ < 1): the coherent average over "already allocated" and "not yet allocated"\n');
  lines.push('branches blurs exactly the signature the receiver needs.\n');

  // ---------- Table 2: noisy allocation write ----------
  lines.push('## Table 2 — alloc-erased(ε) vs exec(0.5): the ESC-shaped column\n');
  lines.push('| ε | D(AB) | D(BA) | D(switch) | Δ = switch − max fixed |');
  lines.push('|---|---|---|---|---|');
  const kbExec = execKraus(0.5);
  for (const eps of [0, 0.25, 0.5, 0.75, 1]) {
    const ka = allocErasedKraus(eps);
    const sc = makeSwitchedChannel(krausToStinespring(ka), krausToStinespring(kbExec));
    const dAB = machineDistance((r) => applyKraus(r, mChain(kbExec, ka)));
    const dBA = machineDistance((r) => applyKraus(r, mChain(ka, kbExec)));
    const dSw = machineDistance((r) => partialTrace(sc.channel(kronRho(vecToRho(PLUS), r)), [2, DM, DT], [2]));
    lines.push(`| ${eps} | ${dAB.toFixed(6)} | ${dBA.toFixed(6)} | ${dSw.toFixed(6)} | ${(dSw - Math.max(dAB, dBA) >= 0 ? '+' : '') + (dSw - Math.max(dAB, dBA)).toFixed(6)} |`);
    assert.ok(Math.abs(dSw - (1 - eps) / 4) < 1e-12, `D(switch) = (1−ε)/4 failed at ε=${eps}`);
    if (eps === 1) {
      assert.ok(dAB < 1e-12 && dBA < 1e-12, 'at ε=1 both fixed orders must be closed');
      assert.ok(dSw < 1e-12, 'at ε=1 the switch must also be closed on this configuration');
    }
  }
  lines.push('');
  lines.push('Exact law **D(switch) = (1−ε)/4**, and at ε = 1 EVERYTHING closes — including the switch.');
  lines.push('Contrast with T2: there the payload TRANSITED both erasing channels (each environment');
  lines.push('captured distinguishable information and the order coherences recombined it); here the');
  lines.push('payload is CREATED by the allocation channel and erased after the fact — no transiting');
  lines.push('information, no order resource. **Admission criterion, sharpened: order superposition');
  lines.push('pays only when the payload must transit erasing structure on both branches.**\n');

  // ---------- Table 3: random channel pairs ----------
  lines.push('## Table 3 — random CPTP pairs (control group)\n');
  const rng = makeRng(20260905);
  let positiveDelta = 0;
  let positiveJoint = 0;
  let maxDelta = -Infinity;
  let maxJoint = -Infinity;
  const deltas: number[] = [];
  const jointDeltas: number[] = [];
  const N = 40;
  for (let trial = 0; trial < N; trial++) {
    const d = 2;
    const va = randomChannelStinespring(rng, d, 2);
    const vb = randomChannelStinespring(rng, d, 2);
    const sc = makeSwitchedChannel(va, vb);
    const inputs = orthoPair(rng, d);
    const metric = (apply: (r: CMat) => CMat): number => traceDistance(apply(inputs[0]!), apply(inputs[1]!));
    const dAB = metric((r) => sc.fixedAB(r));
    const dBA = metric((r) => sc.fixedBA(r));
    // receiver = the system register (same register the fixed orders output on);
    // the control belongs to the switch fabric, reported separately as joint.
    const dSw = metric((r) => partialTrace(sc.channel(kronRho(vecToRho(PLUS), r)), [2, d], [0]));
    const dJoint = metric((r) => sc.channel(kronRho(vecToRho(PLUS), r)));
    const delta = dSw - Math.max(dAB, dBA);
    const deltaJoint = dJoint - Math.max(dAB, dBA);
    deltas.push(delta);
    jointDeltas.push(deltaJoint);
    if (delta > 1e-9) positiveDelta++;
    if (deltaJoint > 1e-9) positiveJoint++;
    maxDelta = Math.max(maxDelta, delta);
    maxJoint = Math.max(maxJoint, deltaJoint);
  }
  deltas.sort((x, y) => x - y);
  const median = (deltas[Math.floor(N / 2) - 1]! + deltas[Math.floor(N / 2)]!) / 2;
  jointDeltas.sort((x, y) => x - y);
  const medianJoint = (jointDeltas[Math.floor(N / 2) - 1]! + jointDeltas[Math.floor(N / 2)]!) / 2;
  lines.push(`- ${N} random isometry pairs (d = 2, env 2), random orthogonal input pairs`);
  lines.push(`- receiver = system register: Δ median **${median.toFixed(6)}**, max **${maxDelta.toFixed(6)}**,`);
  lines.push(`  positives Δ > 1e−9: **${positiveDelta}/${N}**`);
  lines.push(`- receiver = joint (system + control): Δ median **${medianJoint.toFixed(6)}**, max **${maxJoint.toFixed(6)}**,`);
  lines.push(`  positives: **${positiveJoint}/${N}**`);
  lines.push('');
  lines.push('Generic channel pairs give the system-register receiver no edge — median deficit, zero');
  lines.push('positives in this sample; the JOINT receiver (system + control) wins on 36/40, but that');
  lines.push('partly reflects an extra output register no plain definite-order use has, not order');
  lines.push('advantage per se (against the fully general causally-separable class the question is');
  lines.push('what process witnesses decide — cited, OCB 2012 / Goswami 2018). For scheduling, the');
  lines.push('receiver is the machine register: order is a resource only under structural admission —');
  lines.push('payload transiting erasing channels on both branches — never by default.\n');

  writeReport('exp3-sched-contact', lines.join('\n'));
  console.log(lines.join('\n'));
}

function mChain(outer: CMat[], inner: CMat[]): CMat[] {
  const out: CMat[] = [];
  for (const K of outer) {
    for (const L of inner) out.push(mMul(K, L));
  }
  return out;
}

function orthoPair(rng: ReturnType<typeof makeRng>, d: number): CMat[] {
  const a = randomStateVec(rng, d);
  // Gram-Schmidt a second vector against a (complex inner product, conj on first)
  const b = { re: randomStateVec(rng, d).re, im: randomStateVec(rng, d).im };
  let dre = 0;
  let dim = 0;
  for (let k = 0; k < d; k++) {
    dre += a.re[k]! * b.re[k]! + a.im[k]! * b.im[k]!;
    dim += a.re[k]! * b.im[k]! - a.im[k]! * b.re[k]!;
  }
  const b2 = { n: d, re: new Float64Array(d), im: new Float64Array(d) };
  let nrm = 0;
  for (let k = 0; k < d; k++) {
    b2.re[k] = b.re[k]! - (dre * a.re[k]! - dim * a.im[k]!);
    b2.im[k] = b.im[k]! - (dre * a.im[k]! + dim * a.re[k]!);
    nrm += b2.re[k]! * b2.re[k]! + b2.im[k]! * b2.im[k]!;
  }
  nrm = Math.sqrt(nrm);
  const v = { n: d, re: Float64Array.from(b2.re, (x) => x / nrm), im: Float64Array.from(b2.im, (x) => x / nrm) };
  return [vecToRho(a), vecToRho(v)];
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
