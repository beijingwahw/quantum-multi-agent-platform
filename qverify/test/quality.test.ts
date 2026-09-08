/**
 * Wave-5 quality anchors (v0.3.0): the single-sourcing and error-surface
 * contracts. Three families:
 *  - SMUGGLING TRIALS: every public entry's illegal input is NAMED and
 *    rejected (QV_-coded refusals) — a wrong-silently answer is a conviction.
 *  - BIT-ISOMORPHISM: the v0.3.0 merges (kron/mulVec/mScale/depolarize onto
 *    the single sources) must reproduce the pre-merge duplicate bodies
 *    cell-for-cell — the reference bodies live HERE, independently, exactly
 *    like every other referee in this repo.
 *  - SINGLE-SOURCE IDENTITY: EIGHT_ANGLES and TRAP_ANGLES are one object.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type CMat, type CVec, identity, mat, kron, mScale } from '../src/core/cmat.js';
import { PAULIS, PAULI_X, PAULI_Y, PAULI_Z, fromVec, randomPureState } from '../src/core/states.js';
import { depolarize } from '../src/core/channels.js';
import { equatorialProjector, mulAll, mulVec, runCircuitVec, type RandomCircuit } from '../src/core/gates.js';
import { makeRng } from '../src/core/rng.js';
import { EIGHT_ANGLES, serverViewPure } from '../src/protocol/ubqc.js';
import { TRAP_ANGLES, xAttack } from '../src/protocol/traps.js';
import { amplitudeDampingKraus, phaseDampingKraus } from '../src/protocol/noise.js';
import { cramerRate, hoeffdingN, shadowWallRow, xebWallRow } from '../src/protocol/samplewall.js';
import { randomCircuit, circuitProbs } from '../src/core/gates.js';
import { routeVerification } from '../src/router.js';

// ---------------- smuggling trials: illegal inputs are named and rejected ----------------

test('smuggling: attack/channel constructors reject out-of-range probabilities by name', () => {
  assert.throws(() => xAttack(-0.1), /QV_PROBABILITY: xAttack/);
  assert.throws(() => xAttack(1.0001), /QV_PROBABILITY: xAttack/);
  assert.throws(() => amplitudeDampingKraus(1.5), /QV_PROBABILITY: amplitudeDampingKraus/);
  assert.throws(() => phaseDampingKraus(-1), /QV_PROBABILITY: phaseDampingKraus/);
  // the endpoints stay legal (no off-by-one at the boundary)
  assert.ok(Number.isFinite(xAttack(0)[0]!.re[0]!));
  assert.ok(Number.isFinite(phaseDampingKraus(1)[0]!.re[0]!));
});

test('smuggling: sample-wall arithmetic rejects degenerate parameters by name', () => {
  assert.throws(() => hoeffdingN(2, 0.01, 0), /QV_MARGIN/);
  assert.throws(() => hoeffdingN(2, 0, 0.5), /QV_DELTA/);
  assert.throws(() => hoeffdingN(2, 1, 0.5), /QV_DELTA/);
  assert.throws(() => hoeffdingN(0, 0.01, 0.5), /QV_RANGE/);
  assert.throws(() => hoeffdingN(-3, 0.01, 0.5), /QV_RANGE/);
  assert.throws(() => cramerRate([], [], 0.5), /QV_EMPTY_INPUT: cramerRate/);
  assert.throws(() => cramerRate([0, 1], [0.5], 0.5), /QV_LENGTH_MISMATCH/);
  // tau at the distribution mean: the rate is 0 up to the maximizer's numerics
  assert.ok(cramerRate([0, 1], [0.5, 0.5], 0.5) >= 0 && cramerRate([0, 1], [0.5, 0.5], 0.5) < 1e-12);
});

test('smuggling: wall rows reject impossible confidence/signal parameters by name', () => {
  const rng = makeRng(0x5a17);
  const probs = circuitProbs(randomCircuit(rng, 4, 4));
  assert.throws(() => xebWallRow(probs, 0, 0.01), /QV_SIGNAL/);
  assert.throws(() => xebWallRow(probs, 1.5, 0.01), /QV_SIGNAL/);
  assert.throws(() => xebWallRow(probs, 0.5, 1.5), /QV_DELTA/);
  assert.throws(() => xebWallRow(probs, 0.5, 0), /QV_DELTA/);
  assert.throws(() => shadowWallRow({ mean: 1, variance: 0, min: 1, max: 1 }, 0.05, 0.05), /QV_VARIANCE/);
  assert.throws(() => shadowWallRow({ mean: 1, variance: 1, min: 0, max: 2 }, 0, 0.05), /QV_MARGIN/);
  assert.throws(() => shadowWallRow({ mean: 1, variance: 1, min: 0, max: 2 }, 0.05, 1), /QV_DELTA/);
  // the legal grid still produces exact counts
  assert.ok(xebWallRow(probs, 0.5, 0.01).nChernoff >= 1);
});

test('smuggling: router, register algebra, and circuit runner reject nonsense by name', () => {
  assert.throws(() => routeVerification({ qubits: 0, twoQubitGates: 4, ubqcInterface: false, sampling: false }), /QV_QUBITS/);
  assert.throws(() => routeVerification({ qubits: -2, twoQubitGates: 4, ubqcInterface: true, sampling: false }), /QV_QUBITS/);
  assert.throws(() => serverViewPure([], []), /QV_EMPTY_INPUT: serverViewPure/);
  assert.throws(() => mulAll([]), /QV_EMPTY_PRODUCT/);
  const unguarded: RandomCircuit = { n: 1, layers: [[{ kind: 'u1', qubits: [0] }]], ops: [{ kind: 'u1', qubits: [0] }] };
  assert.throws(() => runCircuitVec(unguarded), /QV_OP_NO_UNITARY/);
  // positive control: the same circuit with the unitary present runs
  const guarded: RandomCircuit = { n: 1, layers: [[{ kind: 'u1', qubits: [0], u: identity(2) }]], ops: [{ kind: 'u1', qubits: [0], u: identity(2) }] };
  assert.ok(runCircuitVec(guarded).re[0] === 1);
});

// ---------------- bit-isomorphism: merged single sources vs the pre-merge bodies ----------------

/** The pre-merge duplicate kron body (no zero-skip) — kept HERE as the referee. */
function refKronNoSkip(a: CMat, b: CMat): CMat {
  const out = mat(a.rows * b.rows, a.cols * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const ar = a.re[i * a.cols + j]!;
      const ai = a.im[i * a.cols + j]!;
      for (let p = 0; p < b.rows; p++) {
        for (let q = 0; q < b.cols; q++) {
          const ri = i * b.rows + p;
          const ci = j * b.cols + q;
          out.re[ri * out.cols + ci] = out.re[ri * out.cols + ci]! + (ar * b.re[p * b.cols + q]! - ai * b.im[p * b.cols + q]!);
          out.im[ri * out.cols + ci] = out.im[ri * out.cols + ci]! + (ar * b.im[p * b.cols + q]! + ai * b.re[p * b.cols + q]!);
        }
      }
    }
  }
  return out;
}

/** Random matrix with a controlled fraction of EXACT zeros (exercises the skip). */
function randomMatrixWithZeros(rng: ReturnType<typeof makeRng>, n: number, m: number, zeroProb: number): CMat {
  const a = mat(n, m);
  for (let k = 0; k < n * m; k++) {
    if (rng() < zeroProb) continue; // stays exactly 0
    a.re[k] = Math.round((rng() * 2 - 1) * 8) / 8;
    a.im[k] = Math.round((rng() * 2 - 1) * 8) / 8;
  }
  return a;
}

test('bit-isomorphism: cmat.kron (with zero-skip) === the pre-merge no-skip body, cell for cell', () => {
  const rng = makeRng(0xb17150);
  for (let t = 0; t < 50; t++) {
    const a = randomMatrixWithZeros(rng, 1 + rng.int(4), 1 + rng.int(4), 0.3);
    const b = randomMatrixWithZeros(rng, 1 + rng.int(4), 1 + rng.int(4), 0.3);
    const live = kron(a, b);
    const ref = refKronNoSkip(a, b);
    for (let k = 0; k < live.re.length; k++) {
      assert.ok(Object.is(live.re[k]!, ref.re[k]!), `re[${k}] ${live.re[k]} vs ${ref.re[k]} (t=${t})`);
      assert.ok(Object.is(live.im[k]!, ref.im[k]!), `im[${k}] ${live.im[k]} vs ${ref.im[k]} (t=${t})`);
    }
  }
});

test('bit-isomorphism: depolarize === the pre-merge local body ((1−q)ρ then diagonal += q/d)', () => {
  // Values must agree cell-for-cell; the ONE admissible difference is the SIGN
  // of a zero: the library adds p·0 = +0 to off-diagonal cells while the old
  // local bodies assigned (1−q)·x directly (−0 when x < 0 and q = 1) — signed
  // zeros are arithmetically inert under every consumer in this repo, so the
  // anchor uses === (which equates ±0), unlike the kron anchor's Object.is.
  const rng = makeRng(0xd3c0);
  for (const d of [2, 4, 8]) {
    const psi = randomPureState(d, rng);
    const rho = fromVec(psi);
    for (const q of [0, 0.25, 0.3, 1]) {
      const live = depolarize(rho, q);
      const out = mat(d, d);
      for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
          out.re[i * d + j] = (1 - q) * rho.re[i * d + j]!;
          out.im[i * d + j] = (1 - q) * rho.im[i * d + j]!;
        }
        out.re[i * d + i] = out.re[i * d + i]! + q / d;
      }
      for (let k = 0; k < d * d; k++) {
        assert.ok(live.re[k]! === out.re[k]!, `re[${k}] ${live.re[k]} vs ${out.re[k]} (d=${d} q=${q})`);
        assert.ok(live.im[k]! === out.im[k]!, `im[${k}] ${live.im[k]} vs ${out.im[k]} (d=${d} q=${q})`);
      }
    }
  }
});

test('bit-isomorphism: mScale on 2×2 === the pre-merge scale closures (xAttack/shrink Kraus)', () => {
  const rng = makeRng(0x5ca1e);
  for (let t = 0; t < 20; t++) {
    const p = randomMatrixWithZeros(rng, 2, 2, 0.2);
    const s = Math.round(rng() * 16) / 16;
    const live = mScale(p, s);
    for (let k = 0; k < 4; k++) {
      assert.ok(Object.is(live.re[k]!, p.re[k]! * s));
      assert.ok(Object.is(live.im[k]!, p.im[k]! * s));
    }
  }
  // the anchored consumers still hit their exact constants
  assert.ok(Math.abs(xAttack(0.5)[0]!.re[0]! - Math.sqrt(0.5)) < 1e-15);
});

test('bit-isomorphism: PAULIS === the hand-written literals the tier anchors consume', () => {
  const litX: CMat = { rows: 2, cols: 2, re: Float64Array.from([0, 1, 1, 0]), im: new Float64Array(4) };
  const litY: CMat = { rows: 2, cols: 2, re: new Float64Array(4), im: Float64Array.from([0, -1, 1, 0]) };
  const litZ: CMat = { rows: 2, cols: 2, re: Float64Array.from([1, 0, 0, -1]), im: new Float64Array(4) };
  for (const [p, lit] of [[PAULI_X, litX], [PAULI_Y, litY], [PAULI_Z, litZ]] as Array<[CMat, CMat]>) {
    for (let k = 0; k < 4; k++) {
      assert.ok(Object.is(p.re[k]!, lit.re[k]!));
      assert.ok(Object.is(p.im[k]!, lit.im[k]!));
    }
  }
  assert.equal(PAULIS.length, 3);
});

test('properties: mulVec and equatorialProjector invariants on the single source', () => {
  // mulVec: identity acts trivially bit-exactly; (m1 m2) v = m1 (m2 v)
  const rng = makeRng(0xacc7);
  const m1 = randomMatrixWithZeros(rng, 3, 3, 0.15);
  const m2 = randomMatrixWithZeros(rng, 3, 3, 0.15);
  const v: CVec = { n: 3, re: Float64Array.from([0.3, -1.2, 2]), im: Float64Array.from([0.5, 0, -0.7]) };
  const eyeV = mulVec(identity(3), v);
  for (let k = 0; k < 3; k++) {
    assert.ok(Object.is(eyeV.re[k]!, v.re[k]!));
    assert.ok(Object.is(eyeV.im[k]!, v.im[k]!));
  }
  const comp = mat(3, 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let re = 0;
      let im = 0;
      for (let l = 0; l < 3; l++) {
        re += m1.re[i * 3 + l]! * m2.re[l * 3 + j]! - m1.im[i * 3 + l]! * m2.im[l * 3 + j]!;
        im += m1.re[i * 3 + l]! * m2.im[l * 3 + j]! + m1.im[i * 3 + l]! * m2.re[l * 3 + j]!;
      }
      comp.re[i * 3 + j] = re;
      comp.im[i * 3 + j] = im;
    }
  }
  const assoc = mulVec(m1, mulVec(m2, v));
  const compV = mulVec(comp, v);
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(assoc.re[k]! - compV.re[k]!) < 1e-12, `assoc re[${k}]`);
    assert.ok(Math.abs(assoc.im[k]! - compV.im[k]!) < 1e-12, `assoc im[${k}]`);
  }
  // equatorialProjector: {plus, minus} is a projective measurement — sums to I, each trace 1
  const { plus, minus } = equatorialProjector(0.7);
  for (let k = 0; k < 4; k++) {
    const sum = plus.re[k]! + minus.re[k]!;
    const want = k % 3 === 0 ? 1 : 0; // I has 1 on cells 0 and 3, 0 on 1 and 2
    assert.ok(Math.abs(sum - want) < 1e-15, `projector sum cell ${k}: ${sum}`);
    assert.ok(Math.abs(plus.im[k]! + minus.im[k]!) < 1e-15);
  }
  assert.ok(Math.abs(plus.re[0]! + plus.re[3]! - 1) < 1e-15);
  assert.ok(Math.abs(minus.re[0]! + minus.re[3]! - 1) < 1e-15);
});

// ---------------- single-source identity ----------------

test('single source: EIGHT_ANGLES and TRAP_ANGLES are one object (the 8-angle grid)', () => {
  assert.equal(EIGHT_ANGLES, TRAP_ANGLES); // same reference — the constant cannot re-split silently
  assert.equal(EIGHT_ANGLES.length, 8);
  for (let k = 0; k < 8; k++) {
    assert.ok(Object.is(EIGHT_ANGLES[k]!, (k * Math.PI) / 4)); // bit-exact kπ/4 grid
  }
});
