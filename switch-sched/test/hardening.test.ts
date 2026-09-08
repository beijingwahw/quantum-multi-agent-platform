import test from 'node:test';
import assert from 'node:assert/strict';
import { eigenvaluesHermitian, identity, kron, mat, matEq, mMul } from '../src/core/cmat.js';
import { applyKraus, marginalProbs, partialTrace } from '../src/core/channels.js';
import { complexGaussian, makeRng } from '../src/core/rng.js';
import {
  KET0,
  KET1,
  MINUS,
  PLUS,
  basisRho,
  randomStateVec,
  uniformOrthVec,
  vecToRho,
} from '../src/core/states.js';
import { holevo, traceDistance, traceReal } from '../src/core/measures.js';
import { depolarizingKraus } from '../src/switch/chanlib.js';
import { branchIsometry, krausToStinespring } from '../src/switch/isometry.js';
import { kronRho, productDeviation } from '../src/switch/witnesses.js';
import { cjMatrix, firstPartyProcess, processProbability, sharedStateProcess } from '../src/process/cj.js';
import { OCB_QUANTUM_VALUE, classicalCensus, verifyClassicalCensus } from '../src/process/gypi.js';
import { verifyClassicalCapRecord, witnessValue } from '../src/process/wocb.js';

// ---------------------------------------------------------------------------
// Single-source equivalence anchors (face C): every delegation introduced by
// the v0.3.0 quality pass must be BIT-equal to the closed form or to the
// duplicated body it replaced — not merely close.
// ---------------------------------------------------------------------------

test('kronRho is bit-identical to core kron on random density matrices', () => {
  const rng = makeRng(20260908);
  for (let t = 0; t < 8; t++) {
    const a = vecToRho(randomStateVec(rng, 2));
    const b = vecToRho(randomStateVec(rng, 3));
    const viaKronRho = kronRho(a, b);
    const viaKron = kron(a, b);
    for (let k = 0; k < viaKron.re.length; k++) {
      // Object.is: +0 === -0 would pass ===; the delegations must not even
      // flip zero signs
      assert.ok(Object.is(viaKronRho.re[k], viaKron.re[k]), `re[${k}] trial ${t}`);
      assert.ok(Object.is(viaKronRho.im[k], viaKron.im[k]), `im[${k}] trial ${t}`);
    }
  }
});

test('productDeviation equals the independent eigenvalue definition bit-for-bit', () => {
  const rng = makeRng(424242);
  for (let t = 0; t < 8; t++) {
    // product-ish states: kron of two random pure states, then a small
    // asymmetric perturbation on one block diagonal entry
    const a = vecToRho(randomStateVec(rng, 2));
    const b = vecToRho(randomStateVec(rng, 2));
    const rho = kronRho(a, b);
    rho.re[0] = rho.re[0]! + (t % 3) * 0.01;
    const viaDeviation = productDeviation(rho, 2, 2);
    const rhoA = partialTrace(rho, [2, 2], [1]);
    const rhoB = partialTrace(rho, [2, 2], [0]);
    // independent recomputation: ½ Σ|λ| of ρ − ρ_A⊗ρ_B, from the raw spectrum
    // (BOTH real and imaginary parts — the b13#3 lesson: a copy that drops
    // the imaginary part passes on real instances and lies on complex ones)
    const diff = mat(4, 4);
    const prod = kron(rhoA, rhoB);
    for (let k = 0; k < 16; k++) {
      diff.re[k] = rho.re[k]! - prod.re[k]!;
      diff.im[k] = rho.im[k]! - prod.im[k]!;
    }
    const eig = eigenvaluesHermitian(diff);
    let s = 0;
    for (const l of eig) s += Math.abs(l);
    assert.ok(Math.abs(viaDeviation - s / 2) < 1e-15, `trial ${t}: ${viaDeviation} vs ${s / 2}`);
    // the delegation path is the live traceDistance on identical bits
    assert.ok(Object.is(viaDeviation, traceDistance(rho, prod)), `delegation trial ${t}`);
  }
});

test('MINUS/PLUS are bit-exact ±1/√2: 1/Math.SQRT2, the value the pre-merge copies used', () => {
  // the pre-v0.3.0 local copies computed x / Math.SQRT2; states.ts computes
  // vNormalize → 1 * (1 / Math.sqrt(2)). These are the same double (SQRT2 is
  // correctly-rounded sqrt(2), and 1*x is exact), so the merge is proven
  // bit-safe and pinned here against regression.
  assert.ok(Object.is(Math.SQRT2, Math.sqrt(2)));
  const inv = 1 / Math.SQRT2;
  assert.ok(Object.is(PLUS.re[0], inv) && Object.is(PLUS.re[1], inv));
  assert.ok(Object.is(MINUS.re[0], inv) && Object.is(MINUS.re[1], -inv));
  assert.ok(Object.is(PLUS.im[0], 0) && Object.is(MINUS.im[1], 0));
  // and NOT the same double as Math.SQRT1_2 — the reason gypi's xp/xm stay local
  assert.ok(!Object.is(inv, Math.SQRT1_2));
});

test('basisRho(d, i) is exactly |i⟩⟨i| and KET1 is exactly |1⟩', () => {
  for (const d of [2, 3, 4]) {
    for (let i = 0; i < d; i++) {
      const rho = basisRho(d, i);
      for (let k = 0; k < d * d; k++) {
        const want = Math.floor(k / d) === i && k % d === i ? 1 : 0;
        assert.ok(Object.is(rho.re[k], want), `d=${d} i=${i} k=${k}`);
      }
    }
  }
  assert.ok(Object.is(KET1.re[1], 1) && Object.is(KET0.re[0], 1));
});

test('complexGaussian: shared Box-Muller draws reproduce randomStateVec bit-for-bit', () => {
  // two independent streams: one through randomStateVec (which uses the
  // shared helper), one drawing the helper directly in the same order
  const rngA = makeRng(777);
  const rngB = makeRng(777);
  for (let t = 0; t < 4; t++) {
    const viaVec = randomStateVec(rngA, 3);
    const raw = { re: new Float64Array(3), im: new Float64Array(3) };
    let nrm = 0;
    for (let k = 0; k < 3; k++) {
      const g = complexGaussian(rngB);
      raw.re[k] = g.re;
      raw.im[k] = g.im;
    }
    for (let k = 0; k < 3; k++) nrm += raw.re[k]! * raw.re[k]! + raw.im[k]! * raw.im[k]!;
    nrm = Math.sqrt(nrm);
    // vNormalize multiplies by the RECIPROCAL (x * (1/nrm)), it does not
    // divide (x / nrm) — the two round differently; mirror the exact form
    const inv = 1 / nrm;
    for (let k = 0; k < 3; k++) {
      assert.ok(Object.is(viaVec.re[k], raw.re[k]! * inv), `re[${k}] trial ${t}`);
      assert.ok(Object.is(viaVec.im[k], raw.im[k]! * inv), `im[${k}] trial ${t}`);
    }
  }
});

test('sharedStateProcess is exactly ρ ⊗ 𝟙 ⊗ 𝟙 and the Bell anchor gives witness +0.125', () => {
  const rho = kronRho(basisRho(2, 0), basisRho(2, 1));
  const viaShared = sharedStateProcess(rho);
  const viaKron = kron(kron(rho, identity(2)), identity(2));
  assert.ok(matEq(viaShared, viaKron, 0), 'must be bit-equal, tolerance 0');
  const bell = mat(4, 4);
  bell.re[0] = 0.25; bell.re[3] = 0.25; bell.re[12] = 0.25; bell.re[15] = 0.25;
  assert.ok(Math.abs(witnessValue(sharedStateProcess(bell)) - 0.125) < 1e-12);
});

test('census counterfeit checkers share one core: cap-record and full-record agree on rejection', () => {
  const truth = classicalCensus();
  const inflated = { familySize: truth.length, maxPsucc: OCB_QUANTUM_VALUE };
  const capVerdict = verifyClassicalCapRecord(inflated);
  const censusVerdict = verifyClassicalCensus({ ...inflated, argmaxLabel: truth[0]!.label });
  assert.equal(capVerdict.ok, false);
  assert.equal(censusVerdict.ok, false);
  // one checker, one conviction message — no divergent copies
  assert.equal(capVerdict.reason, censusVerdict.reason);
  assert.match(capVerdict.reason, /CLASSICAL-CENSUS-COUNTERFEIT/);
});

// ---------------------------------------------------------------------------
// Smuggling trials for the public error surface (face B): every public entry
// point must NAME and REJECT illegal input — none of these were pinned before.
// ---------------------------------------------------------------------------

test('REJECTION TRIALS: subsystem and dims guards name their refuse at the boundary', () => {
  const rho = kronRho(basisRho(2, 0), basisRho(2, 0));
  assert.throws(() => partialTrace(rho, [2, 2], [2]), /out of range for 2 subsystems/);
  assert.throws(() => partialTrace(rho, [2, 2], [-1]), /out of range for 2 subsystems/);
  assert.throws(() => partialTrace(rho, [2, 0], []), /dims must be positive integers, got 0/);
  assert.throws(() => partialTrace(rho, [2, 2, 2], []), /dims do not match rho/);
  assert.throws(() => marginalProbs(rho, [2, 2], [5]), /out of range for 2 subsystems/);
  assert.throws(() => depolarizingKraus(2, 5), /p must be in \[0,/);
  assert.throws(() => holevo([]), /empty ensemble/);
  assert.throws(
    () => holevo([
      { key: 'a', state: basisRho(2, 0), weight: 0.5 },
      { key: 'b', state: basisRho(3, 0), weight: 0.5 },
    ]),
    /share one dimension/,
  );
  assert.throws(
    () => holevo([{ key: 'a', state: basisRho(2, 0), weight: 0.7 }]),
    /weights must sum to 1/,
  );
});

test('REJECTION TRIALS: Kraus-shape guards name their refuse', () => {
  const a = basisRho(2, 0);
  const b = kronRho(basisRho(2, 0), basisRho(2, 0)); // 4x4
  assert.throws(() => mMul(a, b), /shape mismatch 2x2 \* 4x4/);
  assert.throws(() => krausToStinespring([a, b]), /kraus operators must be d×d/);
  // the dim mismatch must be the named refusal, so BOTH boxes have to be
  // VALID dilations (a non-unitary Kraus dies earlier at V†V = I)
  const u4 = kron(identity(2), identity(2));
  assert.throws(
    () => branchIsometry(krausToStinespring([identity(2)]), krausToStinespring([u4]), 'A'),
    /target dimensions must match/,
  );
  assert.throws(() => cjMatrix([]), /empty Kraus set/);
  // the shape guard fires on DISAGREEMENT between Kraus operators
  assert.throws(() => cjMatrix([identity(2), mat(4, 2)]), /Kraus shapes must agree/);
  assert.throws(() => processProbability(a, b, b), /shape mismatch/);
});

test('REJECTION TRIALS: definite-order process guard names a malformed input state', () => {
  // firstPartyProcess builds a 16x16 process from ρ on the first party's
  // wire — before v0.3.0 a non-2x2 ρ indexed past its rows and produced a
  // NaN process silently; the boundary now refuses it by name
  assert.throws(
    () => firstPartyProcess('A', mat(2, 1), [identity(2)]),
    /input state must be 2x2 .* got 2x1/,
  );
});

test('uniformOrthVec refuses d < 2 (would divide by nothing)', () => {
  assert.throws(() => uniformOrthVec(1), /needs d >= 2/);
});

// ---------------------------------------------------------------------------
// Behavioral anchors touched by the v0.3.0 deletions: the capabilities the
// dead exports duplicated are still covered by the live paths.
// ---------------------------------------------------------------------------

test('depolarizingKraus (the live depolarizing path) still implements (1−p)ρ + p·I/d exactly', () => {
  const rng = makeRng(5150);
  for (const p of [0, 0.3, 1]) {
    const rho = vecToRho(randomStateVec(rng, 2));
    const out = applyKraus(rho, depolarizingKraus(2, p));
    const want = mat(2, 2);
    for (let k = 0; k < 4; k++) {
      const i = Math.floor(k / 2);
      const j = k % 2;
      want.re[k] = (1 - p) * rho.re[k]!;
      want.im[k] = (1 - p) * rho.im[k]!;
      if (i === j) want.re[k] = want.re[k]! + p / 2;
    }
    assert.ok(matEq(out, want, 1e-12), `p=${p}`);
  }
});

test('traceReal pins the shared trace used by the report layer', () => {
  const rho = kronRho(vecToRho(PLUS), basisRho(2, 1));
  assert.ok(Math.abs(traceReal(rho) - 1) < 1e-12);
  const mixed = basisRho(2, 0);
  assert.ok(Math.abs(traceReal(mixed) - 1) < 1e-12);
});

test('rng: int/pick/normal surface still behaves after the Object.assign assembly', () => {
  const rng = makeRng(99);
  for (let k = 0; k < 8; k++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
  }
  const i = rng.int(5);
  assert.ok(Number.isInteger(i) && i >= 0 && i < 5);
  assert.throws(() => rng.pick([]), /empty collection/);
  assert.strictEqual(rng.pick([42]), 42);
  const gaussians = Array.from({ length: 1000 }, () => rng.normal());
  const mean = gaussians.reduce((s, x) => s + x, 0) / gaussians.length;
  assert.ok(Math.abs(mean) < 0.1, `standard normal mean too far from 0: ${mean}`);
});

test('makeRng reproducibility: same seed, same bitstream (the repro contract)', () => {
  const a = makeRng(20260905);
  const b = makeRng(20260905);
  for (let k = 0; k < 16; k++) assert.ok(Object.is(a(), b()));
  for (let k = 0; k < 16; k++) assert.ok(Object.is(a.normal(), b.normal()));
});
