import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eigHermitian,
  eigenvaluesHermitian,
  isUnitary,
  kron,
  mMul,
  identity,
  reconstruct,
  basisVec,
} from '../src/core/cmat.js';
import {
  BELL_PHI_PLUS,
  HADAMARD,
  fromVec,
  ghz,
  maximallyMixed,
  randomPureState,
  w3,
  werner,
} from '../src/core/states.js';
import { makeRng } from '../src/core/rng.js';
import { traceDistance, fidelity, vonNeumannEntropy, holevo, type EnsembleItem } from '../src/core/measures.js';
import { depolarize, marginalProbs, partialTrace, applyKraus, applyUnitary } from '../src/core/channels.js';
import { comparatorUnitary } from '../src/protocol/auction.js';

test('Bell state spectrum is {0,0,0,1}', () => {
  const eig = eigenvaluesHermitian(fromVec(BELL_PHI_PLUS));
  assert.ok(Math.abs(eig[0]!) < 1e-12);
  assert.ok(Math.abs(eig[3]! - 1) < 1e-12);
});

test('von Neumann entropy anchors', () => {
  assert.ok(Math.abs(vonNeumannEntropy(fromVec(BELL_PHI_PLUS))) < 1e-12);
  assert.ok(Math.abs(vonNeumannEntropy(maximallyMixed(4)) - 2) < 1e-12);
});

test('spectral reconstruction referee on random complex states', () => {
  const rng = makeRng(5);
  for (const d of [2, 3, 4, 5]) {
    const psi = randomPureState(d, rng);
    const h = fromVec(psi);
    const { values, vectors } = eigHermitian(h);
    const r = reconstruct(h, values, vectors);
    let err = 0;
    for (let k = 0; k < d * d; k++) err += Math.abs(r.re[k]! - h.re[k]!) + Math.abs(r.im[k]! - h.im[k]!);
    assert.ok(err < 1e-10, `d=${d} err=${err}`);
  }
});

test('trace distance anchors', () => {
  const bell = fromVec(BELL_PHI_PLUS);
  assert.ok(Math.abs(traceDistance(bell, maximallyMixed(4)) - 0.75) < 1e-12);
  assert.ok(Math.abs(traceDistance(bell, bell)) < 1e-12);
  const ket0 = fromVec({ n: 2, re: Float64Array.of(1, 0), im: new Float64Array(2) });
  const plus = fromVec({ n: 2, re: Float64Array.of(Math.SQRT1_2, Math.SQRT1_2), im: new Float64Array(2) });
  assert.ok(Math.abs(traceDistance(ket0, plus) - Math.SQRT1_2) < 1e-12);
});

test('fidelity anchors (Uhlmann)', () => {
  const bell = fromVec(BELL_PHI_PLUS);
  assert.ok(Math.abs(fidelity(bell, bell) - 1) < 1e-12);
  for (const f of [0.5, 0.8, 0.95, 1]) {
    assert.ok(Math.abs(fidelity(werner(f), bell) - f) < 1e-9, `werner f=${f}`);
  }
  const dep = depolarize(bell, 1);
  assert.ok(Math.abs(fidelity(dep, bell) - 0.25) < 1e-9); // fully mixed 4-dim vs pure
});

test('holevo chi: orthogonal ensemble 1 bit, identical ensemble 0', () => {
  const orthogonal: EnsembleItem[] = [
    { key: 'a', state: fromVec({ n: 2, re: Float64Array.of(1, 0), im: new Float64Array(2) }), weight: 0.5 },
    { key: 'b', state: fromVec({ n: 2, re: Float64Array.of(0, 1), im: new Float64Array(2) }), weight: 0.5 },
  ];
  assert.ok(Math.abs(holevo(orthogonal) - 1) < 1e-12);
  const same: EnsembleItem[] = [orthogonal[0]!, { ...orthogonal[1]!, state: orthogonal[0]!.state }];
  assert.ok(Math.abs(holevo(same)) < 1e-12);
});

test('partial trace: Bell -> I/2, GHZ -> I/2 (the stride-bug anchors)', () => {
  const bell = fromVec(BELL_PHI_PLUS);
  const r = partialTrace(bell, [2, 2], [1]);
  assert.ok(Math.abs(r.re[0]! - 0.5) < 1e-12 && Math.abs(r.re[3]! - 0.5) < 1e-12);
  assert.ok(Math.abs(r.re[1]!) < 1e-12 && Math.abs(r.re[2]!) < 1e-12);
  // W3 reduction has off-diagonal structure — wrong output strides break it
  const w = fromVec(w3());
  const wAB = partialTrace(w, [2, 2, 2], [2]);
  // rho_AB(W) = 1/3 |00><00| + 1/3 (|01>+|10>)(<01|+<10|)
  assert.ok(Math.abs(wAB.re[0]! - 1 / 3) < 1e-12);
  assert.ok(Math.abs(wAB.re[1 * 4 + 2]! - 1 / 3) < 1e-12);
  assert.ok(Math.abs(wAB.re[2 * 4 + 1]! - 1 / 3) < 1e-12);
  assert.ok(Math.abs(wAB.re[1 * 4 + 1]! - 1 / 3) < 1e-12);
  const g = fromVec(ghz(3));
  const gAB = partialTrace(g, [2, 2, 2], [1]);
  assert.ok(Math.abs(gAB.re[0]! - 0.5) < 1e-12 && Math.abs(gAB.re[15]! - 0.5) < 1e-12);
});

test('marginal readout of W3 qubit 0 is [2/3, 1/3]', () => {
  const probs = marginalProbs(fromVec(w3()), [2, 2, 2], [0]);
  assert.ok(Math.abs(probs.probs[0]! - 2 / 3) < 1e-12);
  assert.ok(Math.abs(probs.probs[1]! - 1 / 3) < 1e-12);
});

test('unitary checks: Hadamard and comparator', () => {
  assert.ok(isUnitary(HADAMARD));
  assert.ok(isUnitary(comparatorUnitary(2, 3)));
  assert.ok(isUnitary(comparatorUnitary(3, 2)));
});

test('applyKraus / applyUnitary basics', () => {
  const bell = fromVec(BELL_PHI_PLUS);
  const u = kron(HADAMARD, identity(2)); // H on qubit 0
  const rotated = applyUnitary(bell, u);
  assert.ok(Math.abs(traceDistance(rotated, bell) - 1) < 1e-12); // orthogonal rotation of a pure state
  const id = applyKraus(bell, [identity(4)]);
  let err = 0;
  for (let k = 0; k < 16; k++) err += Math.abs(id.re[k]! - bell.re[k]!);
  assert.ok(err < 1e-12);
});

test('depolarize keeps trace 1 and shrinks purity', () => {
  const rng = makeRng(11);
  const psi = randomPureState(4, rng);
  const rho = fromVec(psi);
  const noisy = depolarize(rho, 0.3);
  let tr = 0;
  for (let i = 0; i < 4; i++) tr += noisy.re[i * 4 + i]!;
  assert.ok(Math.abs(tr - 1) < 1e-12);
  // purity Tr(rho^2) decreases from 1
  const sq = mMul(noisy, noisy);
  let purity = 0;
  for (let i = 0; i < 4; i++) purity += sq.re[i * 4 + i]!;
  assert.ok(purity < 1 - 1e-9 && purity > 0.25);
});

test('basisVec refuses out-of-range and fractional indices (R9-A: was the silent zero vector)', () => {
  // an out-of-range/fractional index into the Float64Array was a silent
  // no-op write: the caller received a confident-looking |0...0> — the hole
  // the hardened siblings (stable-world R4, ent-clearing R7, dtc-clock)
  // already refuse by name
  assert.throws(() => basisVec(3, 3), /basisVec: index 3 out of range for dimension 3/);
  assert.throws(() => basisVec(3, -1), /basisVec: index -1 out of range for dimension 3/);
  assert.throws(() => basisVec(3, 1.5), /basisVec: index 1.5 out of range for dimension 3/);
});

test('basisVec still builds the exact legal vector (and the states built on it)', () => {
  const v = basisVec(3, 1);
  assert.deepEqual(Array.from(v.re), [0, 1, 0]);
  assert.deepEqual(Array.from(v.im), [0, 0, 0]);
  assert.equal(v.n, 3);
  // HJW/GHZ faces ride basisVec with legal indices — their exact cells
  // are pinned elsewhere; here pin the primitive itself
  assert.deepEqual(Array.from(basisVec(4, 3).re), [0, 0, 0, 1]);
});
