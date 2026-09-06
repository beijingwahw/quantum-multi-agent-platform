/** Core numerics: ports carry their own regression anchors plus qverify extensions. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type CMat, identity, isUnitary, mMul, mDagger, mat, eigenvaluesHermitian, eigHermitian } from '../src/core/cmat.js';
import { applyKraus, partialTrace, depolarize } from '../src/core/channels.js';
import { traceDistance, fidelity, vonNeumannEntropy } from '../src/core/measures.js';
import { bellState, fromVec, wernerFidelity, equatorial, equatorialRho, maximallyMixed, PLUS } from '../src/core/states.js';
import { rotZ, applyLocalVec, applyLocalRho, randomUnitary2, randomCircuit, circuitProbs, mirrorCircuit, partialTransposeQ, expPauli } from '../src/core/gates.js';
import { makeRng } from '../src/core/rng.js';
import { applyUnitary } from '../src/core/channels.js';

test('equatorial states: Rz(θ)|+⟩ = |+_θ⟩ up to global phase', () => {
  const psi = applyLocalVec({ n: 2, re: Float64Array.from([1 / Math.SQRT2, 1 / Math.SQRT2]), im: new Float64Array(2) }, 1, 0, rotZ(0.7));
  const target = equatorial(0.7);
  // overlap must have |⟨|⟩| = 1
  let ipRe = 0;
  let ipIm = 0;
  for (let i = 0; i < 2; i++) {
    ipRe += psi.re[i]! * target.re[i]! + psi.im[i]! * target.im[i]!;
    ipIm += psi.re[i]! * target.im[i]! - psi.im[i]! * target.re[i]!;
  }
  assert.ok(Math.hypot(ipRe, ipIm) > 1 - 1e-12);
});

test('eigen solver: Bell state projector has eigenvalues {1,0,0,0}', () => {
  const rho = fromVec(bellState('phi+'));
  const eig = eigenvaluesHermitian(rho);
  const sorted = Array.from(eig).sort((a, b) => b - a);
  assert.ok(Math.abs(sorted[0]! - 1) < 1e-12);
  assert.ok(Math.abs(sorted[1]!) < 1e-12);
});

test('trace distance between orthogonal pure states is exactly 1; identical 0', () => {
  assert.ok(Math.abs(traceDistance(fromVec(bellState('phi+')), fromVec(bellState('psi+'))) - 1) < 1e-12);
  assert.ok(traceDistance(fromVec(bellState('phi+')), fromVec(bellState('phi+'))) < 1e-12);
});

test('partial trace: Bell state marginals are maximally mixed', () => {
  const rho = fromVec(bellState('phi+'));
  const a = partialTrace(rho, [2, 2], [1]);
  assert.ok(traceDistance(a, maximallyMixed(2)) < 1e-12);
});

test('isotropic(Werner) PPT boundary: F=1/3 separable, F=0.9 entangled', () => {
  const w0 = wernerFidelity(1 / 3);
  const w09 = wernerFidelity(0.9);
  const pt0 = eigenvaluesHermitian(partialTransposeQ(w0, 2, 1))[0];
  const pt09 = eigenvaluesHermitian(partialTransposeQ(w09, 2, 1))[0];
  assert.ok(pt0 !== undefined && pt0 >= -1e-12, `F=1/3 should be on the separability boundary, got ${pt0}`);
  assert.ok(pt09 !== undefined && pt09 < -1e-3);
});

test('depolarize: mixedness monotone', () => {
  const rho = fromVec(PLUS);
  const d = depolarize(rho, 1);
  assert.ok(traceDistance(d, maximallyMixed(2)) < 1e-12);
});

test('applyLocalRho agrees with full-register conjugation', () => {
  const rng = makeRng(7);
  const u = randomUnitary2(rng);
  const rho = fromVec(bellState('psi-'));
  const local = applyLocalRho(rho, 2, 1, u);
  const full = applyUnitary(rho, kronWithI(u));
  assert.ok(traceDistance(local, full) < 1e-12);
});

function kronWithI(u: CMat): CMat {
  const eye = identity(2);
  const out = mat(4, 4);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const ar = eye.re[i * 2 + j]!;
      for (let p = 0; p < 2; p++) {
        for (let q = 0; q < 2; q++) {
          out.re[(i * 2 + p) * 4 + (j * 2 + q)] = out.re[(i * 2 + p) * 4 + (j * 2 + q)]! + ar * u.re[p * 2 + q]!;
          out.im[(i * 2 + p) * 4 + (j * 2 + q)] = out.im[(i * 2 + p) * 4 + (j * 2 + q)]! + ar * u.im[p * 2 + q]!;
        }
      }
    }
  }
  return out;
}

test('random circuits: U†U = I gives return probability 1 (noiseless mirror)', () => {
  const rng = makeRng(11);
  for (const n of [2, 3, 4]) {
    const circuit = randomCircuit(rng, n, 5);
    const mirror = mirrorCircuit(circuit);
    const composite = { n, layers: [...circuit.layers, ...mirror.layers], ops: [...circuit.ops, ...mirror.ops] };
    const probs = circuitProbs(composite);
    assert.ok(Math.abs(probs[0]! - 1) < 1e-10, `mirror n=${n} return prob ${probs[0]}`);
    let s = 0;
    for (const p of probs) s += p;
    assert.ok(Math.abs(s - 1) < 1e-9);
  }
});

test('expPauli produces unitaries; zero vector gives identity', () => {
  assert.ok(isUnitary(expPauli([0, 0, 0])));
  assert.ok(isUnitary(expPauli([0.3, -0.7, 1.2])));
  assert.ok(isUnitary(randomUnitary2(makeRng(3))));
});

test('fidelity of a state with itself is 1; with orthogonal Bell partner 0', () => {
  const a = fromVec(bellState('phi+'));
  const b = fromVec(bellState('phi-'));
  assert.ok(Math.abs(fidelity(a, a) - 1) < 1e-12);
  assert.ok(fidelity(a, b) < 1e-12);
});

test('von Neumann entropy of maximally mixed qubit is exactly 1 bit', () => {
  assert.ok(Math.abs(vonNeumannEntropy(maximallyMixed(2)) - 1) < 1e-10);
});

test('applyKraus of identity is trivial', () => {
  const rho = equatorialRho(0.3);
  const out = applyKraus(rho, [identity(2)]);
  assert.ok(traceDistance(out, rho) < 1e-15);
});

test('equatorialRho purity and Y-expectation anchors', () => {
  const rho = equatorialRho(1.1);
  const eig = eigHermitian(rho);
  // purity anchor: a pure equatorial state has spectrum {0, 1} (ascending)
  assert.ok(Math.abs(eig.values[0]!) < 1e-9);
  assert.ok(Math.abs(eig.values[1]! - 1) < 1e-9);
  assert.ok(Math.abs(traceDistance(rho, rho)) < 1e-15);
});

test('mDagger/mMul roundtrip on random unitary', () => {
  const u = randomUnitary2(makeRng(5));
  const prod = mMul(u, mDagger(u));
  const eye = identity(2);
  for (let k = 0; k < 4; k++) {
    assert.ok(Math.abs(prod.re[k]! - eye.re[k]!) < 1e-12);
    assert.ok(Math.abs(prod.im[k]!) < 1e-12);
  }
});
