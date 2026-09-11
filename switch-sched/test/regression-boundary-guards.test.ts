import test from 'node:test';
import assert from 'node:assert/strict';
import { basisVec, identity, isHermitian, mAdd, mScale } from '../src/core/cmat.js';
import { KET0, vecToRho } from '../src/core/states.js';
import { traceDistance } from '../src/core/measures.js';
import { krausToStinespring } from '../src/switch/isometry.js';
import { depolarizingKraus, replacerKraus } from '../src/switch/chanlib.js';
import { firstPartyProcess } from '../src/process/cj.js';

// ---------------------------------------------------------------------------
// Boundary-guard regressions: both paths below used to return silent garbage
// instead of refusing. Each test pins the named rejection AND the honest
// path staying open.
// ---------------------------------------------------------------------------

test('krausToStinespring rejects an empty Kraus set (was: silent d=0 degenerate dilation)', () => {
  // before the guard this returned {d: 0, envDim: 0, V: 0x0} and the
  // V†V = I certificate passed VACUOUSLY (a 0x0 matrix equals identity(0)),
  // releasing a degenerate dilation into makeSwitchedChannel unnoticed
  assert.throws(() => krausToStinespring([]), /empty Kraus set/);
  // the honest non-empty set still dilates and certificates
  const st = krausToStinespring(replacerKraus(2));
  assert.equal(st.d, 2);
  assert.equal(st.envDim, 2);
});

test('firstPartyProcess rejects a non-qubit channel (was: silently misindexed 16x16 process)', () => {
  // before the guard, identity(4) — a FOUR-dimensional channel — indexed the
  // 16x16 channel CJ with qubit strides and produced a Hermitian,
  // correctly-normalized, plausible-looking garbage process (probe:
  // normalization error 0) — the worst failure mode this repo knows
  const rho = vecToRho(KET0);
  assert.throws(() => firstPartyProcess('A', rho, [identity(4)]), /channel Kraus .*2x2.*got 4x4/);
  assert.throws(() => firstPartyProcess('B', rho, [identity(2), identity(4)]), /Kraus shapes must agree/);
  assert.throws(() => firstPartyProcess('A', rho, []), /empty channel Kraus set/);
  // the honest qubit channel still passes the guard and yields a 16x16
  // Hermitian process
  const w = firstPartyProcess('A', rho, replacerKraus(2));
  assert.equal(w.rows, 16);
  assert.ok(isHermitian(w));
});

test('mAdd rejects mismatched shapes; traceDistance inherits the refusal (was: plausible sums from the first cells)', () => {
  // before the guard, mAdd(2x2, 16x16) read past the shorter operand and
  // built a plausible number from its first cells — the exact class mMul
  // refuses by name and nosignal-tariff convicted at its own copy; the public
  // traceDistance flows through mAdd, so a mismatched pair used to ship a
  // confident distance instead of an error
  const two = vecToRho(KET0);
  const four = identity(16);
  assert.throws(() => mAdd(two, four), /shape mismatch 2x2 \+ 16x16/);
  assert.throws(() => traceDistance(two, four), /shape mismatch 2x2 \+ 16x16/);
  // the honest same-shape path stays the exact referee: rho + 0 = rho and
  // T(rho, rho) = 0
  assert.deepEqual(Array.from(mAdd(two, mScale(two, 0)).re), Array.from(two.re));
  assert.equal(traceDistance(two, two), 0);
});

test('basisVec refuses out-of-range and fractional indices (was: silent zero vector)', () => {
  // an out-of-range/fractional index into the Float64Array was a silently
  // ignored write: the caller received a confident-looking |0...0> — the
  // hole stable-world (R4), ent-clearing (R7) and dtc-clock refuse by name
  assert.throws(() => basisVec(3, 3), /basisVec: index 3 out of range for dimension 3/);
  assert.throws(() => basisVec(3, -1), /basisVec: index -1 out of range for dimension 3/);
  assert.throws(() => basisVec(3, 1.5), /basisVec: index 1.5 out of range for dimension 3/);
  // the honest index still builds the exact vector, and the module-load
  // kets riding it are untouched
  const v = basisVec(3, 1);
  assert.deepEqual(Array.from(v.re), [0, 1, 0]);
  assert.deepEqual(Array.from(v.im), [0, 0, 0]);
  assert.equal(v.n, 3);
  assert.deepEqual(Array.from(KET0.re), [1, 0]);
});

test('depolarizingKraus refuses NaN p (was: sqrt(NaN) weights shipped as a channel)', () => {
  // NaN slips both comparisons of the old guard (NaN < 0 and NaN > pMax are
  // both false), so a NaN p built a full Kraus set of NaN operators that
  // read as a plausible channel — the silent-NaN class this campaign convicts
  assert.throws(() => depolarizingKraus(2, NaN), /depolarizing p must be in \[0, 1\.333\], got NaN/);
  assert.throws(() => depolarizingKraus(2, Infinity), /depolarizing p must be in \[0, 1\.333\], got Infinity/);
  // the legal neighbours stay exactly open: p = 0 is the identity channel
  const identityChannel = depolarizingKraus(2, 0);
  assert.equal(identityChannel[0]!.re[0], 1);
  assert.equal(identityChannel[1]!.re[0], 0);
  // p = 1 for d = 2: c0 = sqrt(1 - 3/4) = 0.5 exact, and each Weyl Kraus is
  // 0.5 * W with W unitary — Frobenius norm^2 = cw^2 * d = 0.25 * 2 = 0.5
  const full = depolarizingKraus(2, 1);
  assert.equal(full[0]!.re[0], 0.5);
  assert.equal(full[0]!.im[0], 0);
  let frob2 = 0;
  for (let k = 0; k < 4; k++) frob2 += full[1]!.re[k]! ** 2 + full[1]!.im[k]! ** 2;
  assert.equal(frob2, 0.5);
  // the p = pMax boundary itself and the 1e-12 tolerance band above it stay
  // legal (c0 = sqrt(1 - p(d^2-1)/d^2) -> 0 up to float rounding at pMax)
  const pMax = (2 * 2) / (2 * 2 - 1);
  assert.ok(Math.abs(depolarizingKraus(2, pMax)[0]!.re[0]!) <= 1e-7);
  assert.equal(depolarizingKraus(2, pMax + 1e-13).length, 4);
});
