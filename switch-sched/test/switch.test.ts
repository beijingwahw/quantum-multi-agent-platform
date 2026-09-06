import test from 'node:test';
import assert from 'node:assert/strict';
import { type CMat, identity, mat, matEq, mAdd, mDagger, mMul } from '../src/core/cmat.js';
import { applyKraus, partialTrace } from '../src/core/channels.js';
import { makeRng } from '../src/core/rng.js';
import {
  KET0,
  PLUS,
  PAULI_X,
  PAULI_Z,
  randomStateVec,
  uniformOrthVec,
  uniformVec,
  vecToRho,
  weyl,
} from '../src/core/states.js';
import { holevo, traceDistance, vonNeumannEntropy } from '../src/core/measures.js';
import {
  type Stinespring,
  branchIsometry,
  envUnitaryFreedom,
  krausToStinespring,
  makeSwitchedChannel,
  padDilation,
} from '../src/switch/isometry.js';
import {
  completelyDepolarizingKraus,
  depolarizingKraus,
  randomChannelStinespring,
  replacerKraus,
  stinespringToKraus,
  unitaryKraus,
} from '../src/switch/chanlib.js';
import { controlDisplacement, isProductAcross, kronRho, productDeviation } from '../src/switch/witnesses.js';
import {
  admissionMetrics,
  channelEnsembleChi,
  helstromTwo,
  switchedEnsembleChi,
  switchedSlices,
} from '../src/switch/capacity.js';

/** Kronecker product of two matrices, generic (used for d=4 gate construction). */
function kron2(a: CMat, b: CMat): CMat {
  const out = mat(a.rows * b.rows, a.cols * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      for (let p = 0; p < b.rows; p++) {
        for (let q = 0; q < b.cols; q++) {
          out.re[(i * b.rows + p) * out.cols + (j * b.cols + q)] =
            out.re[(i * b.rows + p) * out.cols + (j * b.cols + q)]! + a.re[i * a.cols + j]! * b.re[p * b.cols + q]!;
          out.im[(i * b.rows + p) * out.cols + (j * b.cols + q)] =
            out.im[(i * b.rows + p) * out.cols + (j * b.cols + q)]! + a.im[i * a.cols + j]! * b.re[p * b.cols + q]!;
        }
      }
    }
  }
  return out;
}

function basisRho(d: number, i: number): CMat {
  const m = mat(d, d);
  m.re[i * d + i] = 1;
  return m;
}

const MINUS = { n: 2, re: Float64Array.from([1, -1].map((x) => x / Math.SQRT2)), im: new Float64Array(2) };

test('partialTrace: Bell marginals are I/2 (stride regression guard)', () => {
  // |Φ⁺⟩ density: ½(|00⟩+|11⟩)(·)†
  const phi = mat(4, 4);
  phi.re[0] = 0.5; phi.re[3] = 0.5; phi.re[12] = 0.5; phi.re[15] = 0.5;
  const a = partialTrace(phi, [2, 2], [0]);
  const b = partialTrace(phi, [2, 2], [1]);
  const half = mat(2, 2);
  half.re[0] = 0.5; half.re[3] = 0.5;
  assert.ok(matEq(a, half, 1e-14));
  assert.ok(matEq(b, half, 1e-14));
});

test('krausToStinespring: replacer dilation sends |ψ⟩ to |v⟩ ⊗ |ψ⟩_E', () => {
  const st = krausToStinespring(replacerKraus(2));
  assert.equal(st.envDim, 2);
  const psi = { n: 2, re: Float64Array.from([0.6, 0.8]), im: new Float64Array(2) };
  const col = mat(2, 1);
  col.re[0] = psi.re[0]!; col.re[1] = psi.re[1]!;
  const applied = mMul(st.V, col);
  const want = mat(4, 1);
  for (let s = 0; s < 2; s++) {
    for (let m = 0; m < 2; m++) {
      want.re[s * 2 + m] = psi.re[m]! / Math.SQRT2;
    }
  }
  assert.ok(matEq(applied, want, 1e-14));
});

test('branchIsometry: unitary boxes compose to plain matrix product (env slots trivial)', () => {
  const ua = krausToStinespring(unitaryKraus(PAULI_X));
  const ub = krausToStinespring(unitaryKraus(PAULI_Z));
  assert.ok(matEq(branchIsometry(ua, ub, 'A'), mMul(PAULI_Z, PAULI_X), 1e-14));
  assert.ok(matEq(branchIsometry(ua, ub, 'B'), mMul(PAULI_X, PAULI_Z), 1e-14));
});

test('switch of unitary boxes: commutation task readout deterministic (|−⟩ iff anticommute)', () => {
  // d=2 anticommuting involutions (X, Z): control |+⟩ → control |−⟩ exactly.
  const sc = makeSwitchedChannel(krausToStinespring(unitaryKraus(PAULI_X)), krausToStinespring(unitaryKraus(PAULI_Z)));
  const out = sc.channel(kronRho(vecToRho(PLUS), vecToRho(KET0)));
  const control = partialTrace(out, [2, 2], [1]);
  assert.ok(matEq(control, vecToRho(MINUS), 1e-12));

  // d=4 commuting involutions (X⊗I, I⊗X): control stays |+⟩.
  const xI = kron2(PAULI_X, identity(2));
  const Ix = kron2(identity(2), PAULI_X);
  const sc2 = makeSwitchedChannel(krausToStinespring(unitaryKraus(xI)), krausToStinespring(unitaryKraus(Ix)));
  const out2 = sc2.channel(kronRho(vecToRho(PLUS), basisRho(4, 0)));
  const control2 = partialTrace(out2, [2, 4], [1]);
  assert.ok(matEq(control2, vecToRho(PLUS), 1e-12));
});

test('switch of replacer pair: control formula ρ_c = ½I + (q/2)X, q = |⟨v|ψ⟩|²', () => {
  const sc = makeSwitchedChannel(krausToStinespring(replacerKraus(2)), krausToStinespring(replacerKraus(2)));
  const rng = makeRng(20260905);
  for (let trial = 0; trial < 8; trial++) {
    const psi = randomStateVec(rng, 2);
    const slices = switchedSlices(sc, vecToRho(PLUS), vecToRho(psi));
    const q = ((psi.re[0]! + psi.re[1]!) ** 2 + (psi.im[0]! + psi.im[1]!) ** 2) / 2;
    const want = mat(2, 2);
    want.re[0] = 0.5; want.re[3] = 0.5; want.re[1] = q / 2; want.re[2] = q / 2;
    assert.ok(matEq(slices.control, want, 1e-12));
    assert.ok(matEq(slices.target, vecToRho(uniformVec(2)), 1e-12));
    assert.ok(isProductAcross(slices.full, 2, 2, 1e-12));
  }
  // orthogonal pair {|v⟩, |v⊥⟩}: control states |+⟩⟨+| vs I/2 — distance exactly 1/2
  const m = admissionMetrics(sc, vecToRho(PLUS), vecToRho(uniformVec(2)), vecToRho(uniformOrthVec(2)));
  assert.ok(Math.abs(m.switchControl - 0.5) < 1e-12);
  assert.ok(Math.abs(m.switchTarget - 0) < 1e-12);
  // {|0⟩, |1⟩}: equal overlap with |v⟩ — control carries nothing
  const m0 = admissionMetrics(sc, vecToRho(PLUS), basisRho(2, 0), basisRho(2, 1));
  assert.ok(m0.switchControl < 1e-12);
});

test('ESC flagship (replacer pair): 0+0 → single-use T = 1/2, Helstrom 3/4, χ = H₂(1/4) − 1/2', () => {
  const sc = makeSwitchedChannel(krausToStinespring(replacerKraus(2)), krausToStinespring(replacerKraus(2)));
  const inputs = [vecToRho(uniformVec(2)), vecToRho(uniformOrthVec(2))];
  // each single box: replacer kills the ensemble — exactly zero χ
  assert.ok(channelEnsembleChi((r) => applyKraus(r, replacerKraus(2)), inputs) < 1e-12);
  // switched control states: q=1 → |+⟩⟨+| (pure), q=0 → I/2
  const chi = switchedEnsembleChi(sc, vecToRho(PLUS), inputs);
  const h2 = (x: number): number => (x <= 0 || x >= 1 ? 0 : -x * Math.log2(x) - (1 - x) * Math.log2(1 - x));
  assert.ok(Math.abs(chi.control - (h2(0.25) - 0.5)) < 1e-10);
  const a = switchedSlices(sc, vecToRho(PLUS), inputs[0]!);
  const b = switchedSlices(sc, vecToRho(PLUS), inputs[1]!);
  assert.ok(Math.abs(helstromTwo(a.control, b.control) - 0.75) < 1e-12);
});

test('dilation independence of the switch (unitary freedom + padding)', () => {
  const rng = makeRng(7);
  const psi = randomStateVec(rng, 2);
  const rhoIn = kronRho(vecToRho(PLUS), vecToRho(psi));
  const ra = krausToStinespring(replacerKraus(2));
  const rot = mat(2, 2);
  const th = 0.7;
  rot.re[0] = Math.cos(th); rot.im[0] = Math.sin(th);
  rot.re[3] = Math.cos(th); rot.im[3] = -Math.sin(th);
  const rb = envUnitaryFreedom(ra, rot);
  const rc = padDilation(ra, 2);
  const outA = makeSwitchedChannel(ra, ra).channel(rhoIn);
  const outB = makeSwitchedChannel(rb, rb).channel(rhoIn);
  const outC = makeSwitchedChannel(rc, rc).channel(rhoIn);
  assert.ok(matEq(outA, outB, 1e-12));
  assert.ok(matEq(outA, outC, 1e-12));
});

test('completely depolarizing pair: switched distinguishability positive, single box zero', () => {
  const st = krausToStinespring(completelyDepolarizingKraus(2));
  const sc = makeSwitchedChannel(st, st);
  const inputs = [basisRho(2, 0), basisRho(2, 1)];
  const a = switchedSlices(sc, vecToRho(PLUS), inputs[0]!);
  const b = switchedSlices(sc, vecToRho(PLUS), inputs[1]!);
  const t = traceDistance(a.full, b.full);
  assert.ok(t > 1e-6, `expected positive distinguishability, got ${t}`);
  const single = applyKraus(inputs[0]!, completelyDepolarizingKraus(2));
  const single1 = applyKraus(inputs[1]!, completelyDepolarizingKraus(2));
  assert.ok(traceDistance(single, single1) < 1e-12);
});

test('depolarizingKraus implements (1−p)ρ + p·I/d; Weyl orbit Σ WρW† = d·I', () => {
  const rng = makeRng(99);
  for (const d of [2, 3]) {
    for (const p of [0, 0.25, 0.5, 1]) {
      const kraus = depolarizingKraus(d, p);
      const rho = vecToRho(randomStateVec(rng, d));
      const out = applyKraus(rho, kraus);
      const want = mat(d, d);
      for (let k = 0; k < d * d; k++) {
        const i = Math.floor(k / d);
        const j = k % d;
        want.re[k] = (1 - p) * rho.re[k]!;
        want.im[k] = (1 - p) * rho.im[k]!;
        if (i === j) want.re[k] = want.re[k]! + p / d;
      }
      assert.ok(matEq(out, want, 1e-12), `d=${d} p=${p}`);
    }
  }
  const d = 3;
  const rho = vecToRho(randomStateVec(makeRng(5), d));
  let sum = mat(d, d);
  for (let a = 0; a < d; a++) {
    for (let b = 0; b < d; b++) {
      const W = weyl(d, a, b);
      sum = mAdd(sum, mMul(mMul(W, rho), mDagger(W)));
    }
  }
  for (let i = 0; i < d; i++) assert.ok(Math.abs(sum.re[i * d + i]! - d) < 1e-10);
  for (let k = 0; k < d * d; k++) assert.ok(Math.abs(sum.im[k]!) < 1e-10);
});

test('randomChannelStinespring: V†V = I and the Kraus split is trace preserving', () => {
  const rng = makeRng(1234);
  for (let t = 0; t < 5; t++) {
    const st: Stinespring = randomChannelStinespring(rng, 2, 2 + (t % 3));
    assert.ok(matEq(mMul(mDagger(st.V), st.V), identity(2), 1e-12));
    const rho = vecToRho(randomStateVec(rng, 2));
    const out = applyKraus(rho, stinespringToKraus(st));
    let tr = 0;
    for (let i = 0; i < 2; i++) tr += out.re[i * 2 + i]!;
    assert.ok(Math.abs(tr - 1) < 1e-12);
  }
});

test('controlDisplacement: 1/2 for the replacer switch on |v⊥⟩, product deviation 0', () => {
  const ra = krausToStinespring(replacerKraus(2));
  const sc = makeSwitchedChannel(ra, ra);
  const out = sc.channel(kronRho(vecToRho(PLUS), vecToRho(uniformOrthVec(2))));
  const dsw = controlDisplacement(out, 2, vecToRho(PLUS));
  assert.ok(Math.abs(dsw - 0.5) < 1e-12);
  assert.ok(productDeviation(out, 2, 2) < 1e-12);
});

test('entropy / Holevo sanity anchors', () => {
  const mix = mAdd(basisRho(2, 0), basisRho(2, 1));
  for (let k = 0; k < mix.re.length; k++) mix.re[k] = mix.re[k]! * 0.5;
  assert.ok(Math.abs(vonNeumannEntropy(mix) - 1) < 1e-12);
  const items = [
    { key: 'a', state: basisRho(2, 0), weight: 0.5 },
    { key: 'b', state: basisRho(2, 1), weight: 0.5 },
  ];
  assert.ok(Math.abs(holevo(items) - 1) < 1e-12);
});
