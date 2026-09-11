import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, isHermitian } from '../src/core/cmat.js';
import { KET0, vecToRho } from '../src/core/states.js';
import { krausToStinespring } from '../src/switch/isometry.js';
import { replacerKraus } from '../src/switch/chanlib.js';
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
