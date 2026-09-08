import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/core/rng.js';
import {
  accessibleBounds,
  averageRhoDefect,
  basisReferee,
  certificateFromRow,
  lockedRhos,
  lockingRow,
  makeBasisFamily,
  randomOrthonormalBasis,
  unlockExactness,
  verifyLockingCertificate,
  type LockingCertificate,
} from '../src/protocol/datalock.js';

test('random orthonormal bases: referee ≤ 1e-12, deterministic under seed', () => {
  const rng = makeRng(101);
  for (const d of [2, 3, 4, 8]) {
    const b = randomOrthonormalBasis(d, rng);
    assert.ok(basisReferee(b) <= 1e-12, `d=${d}`);
  }
  const a = makeBasisFamily(4, 8, 31337);
  const b = makeBasisFamily(4, 8, 31337);
  for (let k = 0; k < 8; k++) {
    for (let v = 0; v < 4; v++) {
      const x = a.basis[k]![v]!;
      const y = b.basis[k]![v]!;
      for (let i = 0; i < 4; i++) {
        assert.equal(x.re[i]!, y.re[i]!);
        assert.equal(x.im[i]!, y.im[i]!);
      }
    }
  }
});

test('locked ensembles: average is exactly I/d (complete-basis identity)', () => {
  for (const d of [2, 4, 8]) {
    const family = makeBasisFamily(d, 4 * d, 55);
    const rhos = lockedRhos(family);
    assert.ok(averageRhoDefect(rhos) <= 1e-12, `d=${d}`);
  }
});

test('accessible-information bracket is ordered: 0 ≤ lower ≤ upper ≤ n', () => {
  const family = makeBasisFamily(16, 64, 77);
  const b = accessibleBounds(lockedRhos(family));
  assert.ok(b.upper >= -1e-12);
  assert.ok(b.lower <= b.upper + 1e-12);
  assert.ok(b.upper <= 4 + 1e-12);
  assert.ok(b.pgm >= -1e-12 && b.compBasis >= -1e-12);
});

test('locking direction: accessible fraction shrinks as data grows at fixed key ratio', () => {
  const small = lockingRow(1, 4 * 2, 20260908);
  const large = lockingRow(4, 4 * 16, 20260908);
  // exact seeded values, not Monte Carlo — assert both the shrink and the gap
  assert.ok(small.chiUpper / small.n > large.chiUpper / large.n);
  assert.ok(large.chiUpper < 0.5, `χ at n=4 should be O(0.1) bits, got ${large.chiUpper}`);
  assert.ok(large.lower < large.chiUpper);
  // key sweep: more key, less leak (n = 4)
  const poor = lockingRow(4, 16, 20260908);
  const rich = lockingRow(4, 256, 20260908);
  assert.ok(rich.chiUpper < poor.chiUpper);
  // post-unlock is exact at both scales
  assert.ok(small.unlockWorstOverlap <= 1e-12);
  assert.ok(rich.unlockWorstOverlap <= 1e-12);
});

test('unlock exactness equals basis orthonormality (post-unlock readout is deterministic)', () => {
  const family = makeBasisFamily(8, 32, 99);
  assert.ok(unlockExactness(family) <= 1e-12);
  // with the key, every message is identified with probability 1: the worst
  // off-diagonal overlap IS the error probability of the key-holder's readout
  for (const basis of family.basis) {
    assert.ok(basisReferee(basis) <= 1e-12);
  }
});

test('smuggling trial: counterfeit locking certificates are rejected BY NAME', () => {
  const row = lockingRow(3, 32, 20260908);
  const honest = certificateFromRow(row, 20260908);

  // 1. honest certificate passes
  const pass = verifyLockingCertificate(honest);
  assert.equal(pass.ok, true, JSON.stringify(pass));

  // 2. fabricated pre-unlock accessible information (never measured)
  const fakeChi: LockingCertificate = { ...honest, chiPreUpper: 0.0005 };
  const r1 = verifyLockingCertificate(fakeChi);
  assert.ok(!r1.ok); // narrows the discriminated verdict for the named checks below
  assert.equal(r1.code, 'REF01-fabricated-chi');
  assert.match(r1.detail ?? '', /claimed pre-unlock χ = 0\.0005/);
  assert.match(r1.detail ?? '', /re-derived/);

  // 3. post-unlock claim that does not pay the key
  const noKey: LockingCertificate = { ...honest, keyBits: 0 };
  const r2 = verifyLockingCertificate(noKey);
  assert.ok(!r2.ok);
  assert.equal(r2.code, 'REF05-key-size-mismatch');

  // 4. fabricated hiding defect
  const fakeDefect: LockingCertificate = { ...honest, worstMixedDefect: 0.0001 };
  const r3 = verifyLockingCertificate(fakeDefect);
  assert.ok(!r3.ok);
  assert.equal(r3.code, 'REF02-fabricated-defect');

  // 5. fabricated unlock overlap (claims exact unlock on a broken family)
  const fakeUnlock: LockingCertificate = { ...honest, unlockWorstOverlap: 0.3 };
  const r4 = verifyLockingCertificate(fakeUnlock);
  assert.ok(!r4.ok);
  assert.equal(r4.code, 'REF03-fabricated-unlock');

  // 6. post-unlock bits inconsistent with n
  const fakePost: LockingCertificate = { ...honest, postBits: 100 };
  const r5 = verifyLockingCertificate(fakePost);
  assert.ok(!r5.ok);
  assert.equal(r5.code, 'REF04-post-unlock-mismatch');

  // 7. out-of-bounds scale
  const fakeScale: LockingCertificate = { ...honest, n: 9 };
  const r6 = verifyLockingCertificate(fakeScale);
  assert.ok(!r6.ok);
  assert.equal(r6.code, 'REF00-bounds');
});
