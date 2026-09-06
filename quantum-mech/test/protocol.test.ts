import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/core/rng.js';
import { fromVec, randomPureState } from '../src/core/states.js';
import { type LockMode, lockValue, unlockValue, lockedEnsemble, lockStateVector } from '../src/protocol/locking.js';
import { comparatorBasisError, comparatorUnitarityError, distributionFormulaError } from '../src/protocol/referee.js';
import { interceptExperiment, lockedHolevo, lockedTraceDistance, transcriptLeakage } from '../src/protocol/privacy.js';
import { coherentSecondPriceUtility, runSealedBidAuction, winnerOf, secondOf } from '../src/protocol/auction.js';

test('lock/unlock roundtrip: every value, both modes, both basis families', () => {
  const rng = makeRng(21);
  for (const mode of ['wiesner', 'otp'] as LockMode[]) {
    for (const nBases of [2, 3] as const) {
      for (const m of [1, 2, 3]) {
        for (let v = 0; v < 2 ** m; v++) {
          const lock = lockValue(v, m, rng, nBases, mode);
          assert.equal(unlockValue(lock), v, `${mode}/${nBases}/${m}/${v}`);
          // state vector of a lock is normalized
          const sv = lockStateVector(lock);
          let nrm = 0;
          for (let i = 0; i < sv.n; i++) nrm += sv.re[i]! ** 2 + sv.im[i]! ** 2;
          assert.ok(Math.abs(nrm - 1) < 1e-12);
        }
      }
    }
  }
});

test('wiesner lock leaks (honest residual); otp lock hides exactly', () => {
  // 2-basis wiesner: chi strictly between 0 and m
  const chi2 = lockedHolevo(1, 2, 'wiesner');
  assert.ok(chi2 > 0.05 && chi2 < 1, `chi2 = ${chi2}`);
  // 3-basis wiesner: still leaks
  const chi3 = lockedHolevo(1, 3, 'wiesner');
  assert.ok(chi3 > 0.05 && chi3 < 1, `chi3 = ${chi3}`);
  // otp: exactly zero
  assert.ok(Math.abs(lockedHolevo(2, 2, 'otp')) < 1e-12);
  assert.ok(Math.abs(lockedHolevo(2, 3, 'otp')) < 1e-12);
  // trace distance view
  assert.ok(lockedTraceDistance(1, 2, 'wiesner').worst > 0.1);
  assert.ok(lockedTraceDistance(1, 3, 'otp').worst < 1e-12);
});

test('locked ensembles equal across payloads in otp mode (matrix identity)', () => {
  const a = lockedEnsemble(0, 2, 3, 'otp');
  const b = lockedEnsemble(3, 2, 3, 'otp');
  let err = 0;
  for (let k = 0; k < 16; k++) err += Math.abs(a.re[k]! - b.re[k]!) + Math.abs(a.im[k]! - b.im[k]!);
  assert.ok(err < 1e-12, `ensemble mismatch ${err}`);
});

test('comparator: unitary, basis-correct, distribution formula exact', () => {
  assert.ok(comparatorUnitarityError(2, 3) < 1e-12);
  assert.ok(comparatorUnitarityError(3, 2) < 1e-12);
  assert.ok(comparatorBasisError(2, 3) < 1e-12);
  assert.ok(comparatorBasisError(2, 2) < 1e-12);
  const rng = makeRng(22);
  for (let t = 0; t < 10; t++) {
    const sigma = fromVec(randomPureState(3, rng));
    assert.ok(distributionFormulaError(sigma, [rng.int(3)], rng.int(2), 3) < 1e-12);
  }
});

test('winnerOf/secondOf classical functions', () => {
  assert.equal(winnerOf([1, 3, 2]), 1);
  assert.equal(secondOf([1, 3, 2]), 2);
  assert.equal(winnerOf([2, 2]), 0); // tie to lowest
  assert.equal(secondOf([2, 2]), 2);
  assert.equal(secondOf([5]), 0);
});

test('coherent second-price comparator is DSIC against quantum deviations', () => {
  const rng = makeRng(23);
  for (let t = 0; t < 60; t++) {
    const k = 4;
    const others = [rng.int(k), rng.int(k)];
    const slot = rng.int(3) === 0 ? 0 : 1;
    const v = rng.int(k);
    const truth = fromVec({
      n: k,
      re: Float64Array.from({ length: k }, (_, i) => (i === v ? 1 : 0)),
      im: new Float64Array(k),
    });
    const uTruth = coherentSecondPriceUtility(v, truth, others, slot, k);
    let best = -Infinity;
    for (let r = 0; r < k; r++) {
      const sigma = fromVec({
        n: k,
        re: Float64Array.from({ length: k }, (_, i) => (i === r ? 1 : 0)),
        im: new Float64Array(k),
      });
      best = Math.max(best, coherentSecondPriceUtility(v, sigma, others, slot, k) - uTruth);
    }
    for (let s = 0; s < 60; s++) {
      const sigma = fromVec(randomPureState(k, rng));
      best = Math.max(best, coherentSecondPriceUtility(v, sigma, others, slot, k) - uTruth);
    }
    assert.ok(best <= 1e-12, `coherent gain ${best}`);
  }
});

test('intercept-measure-resend: flip and detection rates match analytic', () => {
  const rng = makeRng(24);
  const stats = interceptExperiment(3000, 2, 3, rng);
  assert.ok(Math.abs(stats.flipRate - stats.analyticFlipRate) < 0.02, `flip ${stats.flipRate}`);
  assert.ok(Math.abs(stats.detectionRate - stats.analyticDetectionRate) < 0.03, `detect ${stats.detectionRate}`);
  const honest = runSealedBidAuction([2, 0, 1], 3, rng, 3);
  assert.equal(honest.checkErrors, 0);
  assert.equal(honest.winner, 0);
  assert.equal(honest.price, 1);
});

test('transcript: coherent readout hides strictly more than classical', () => {
  for (const [n, k] of [
    [2, 2],
    [3, 3],
    [3, 4],
  ] as const) {
    const t = transcriptLeakage(n, k);
    assert.equal(t.classicalDistinguishable, t.pairs);
    assert.ok(t.quantumDistinguishable < t.pairs);
    assert.ok(t.hiddenPairs > 0);
  }
  // exact spot check: n=2, k=2: pairs=6; (w,s) differs in 5, hidden 1
  // profiles (0,1) and (1,0) both yield winner=1, price=1... wait (0,1): w=1 s=0; (1,0): w=1 s=0 — hidden.
  const t = transcriptLeakage(2, 2);
  assert.equal(t.hiddenPairs, 1);
});
