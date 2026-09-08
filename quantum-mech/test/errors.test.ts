/**
 * The error-surface smuggling trials (the v0.3.0 error-codes face): every
 * public entry that gained a named guard is exercised from its ILLEGAL side —
 * a silent-garbage return (NaN, empty auction, wrong-dimension matrix) is a
 * smuggled verdict and must die by its code, not limp through.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/core/rng.js';
import { HADAMARD, maximallyMixed } from '../src/core/states.js';
import { identity, matEq, mMul } from '../src/core/cmat.js';
import { basisUnitary, dagger2, lockValue, toBasis } from '../src/protocol/locking.js';
import {
  comparatorUnitary,
  outcomeDistribution,
  runSealedBidAuction,
  secondOf,
  winnerOf,
} from '../src/protocol/auction.js';
import { distributionFormulaError } from '../src/protocol/referee.js';
import { interceptExperiment, lockedHolevo, transcriptLeakage } from '../src/protocol/privacy.js';
import { certificateFromRow, lockingRow, makeBasisFamily, verifyLockingCertificate } from '../src/protocol/datalock.js';
import { noisyUnlockErrors } from '../src/protocol/robustness.js';
import { resolveAuction } from '../src/mech/auctions.js';
import { classicalBestGain } from '../src/mech/dsic.js';
import { optimalAllocation, searchDsicViolation } from '../src/mech/vcg.js';
import { concurrence } from '../src/contract/monogamy.js';
import { wiesnerExperiment } from '../src/contract/wiesner.js';
import { conjVec, PSI_Z1 } from '../src/contract/hjw.js';
import { fmt } from '../src/experiments/report.js';

test('smuggling trial: illegal inputs to the protocol layer are rejected BY NAME', () => {
  const rng = makeRng(41);
  // lockValue: payload outside [0, 2^m)
  assert.throws(() => lockValue(4, 2, rng, 3), /LOCK01-bad-value/);
  assert.throws(() => lockValue(-1, 2, rng, 3), /LOCK01-bad-value/);
  // lockValue: zero qubits
  assert.throws(() => lockValue(0, 0, rng, 3), /LOCK02-bad-m/);
  // toBasis: draw outside the family {0,1,2}
  assert.throws(() => toBasis(3), /LOCK03-bad-basis/);
  assert.throws(() => toBasis(-1), /LOCK03-bad-basis/);
  // coherent auction: empty / malformed profiles
  assert.throws(() => runSealedBidAuction([], 3, rng, 3), /COMP05-empty-bids/);
  assert.throws(() => runSealedBidAuction([1, 2], 1, rng, 3), /COMP06-bad-k/);
  assert.throws(() => runSealedBidAuction([1, 3], 3, rng, 3), /COMP07-bad-bid/);
  assert.throws(() => winnerOf([]), /COMP01-empty-bids/);
  assert.throws(() => secondOf([]), /COMP01-empty-bids/);
  // comparator: degenerate dimensions
  assert.throws(() => comparatorUnitary(0, 2), /COMP02-bad-shape/);
  assert.throws(() => comparatorUnitary(2, 1), /COMP03-bad-shape/);
  // outcome distribution: sigma not k×k
  assert.throws(() => outcomeDistribution(identity(2), [1], 0, 3), /COMP04-bad-sigma/);
  // privacy referees: degenerate census parameters
  assert.throws(() => lockedHolevo(0, 2), /PRIV05-bad-m/);
  assert.throws(() => transcriptLeakage(0, 2), /PRIV01-bad-n/);
  assert.throws(() => transcriptLeakage(2, 1), /PRIV02-bad-k/);
  assert.throws(() => interceptExperiment(0, 2, 3, rng), /PRIV03-bad-trials/);
  // robustness MC: zero-qubit register
  assert.throws(() => noisyUnlockErrors(0, 3, 'wiesner', 'dephase', 0.3, rng, false), /ROBUST01-bad-m/);
  // referee: agent slot outside the profile
  assert.throws(() => distributionFormulaError(identity(3), [1, 0], 5, 3), /REFEREE01-bad-agentslot/);
});

test('smuggling trial: illegal inputs to the mech/contract layer are rejected BY NAME', () => {
  // classical auction: empty profile previously resolved to winner 0 with a
  // price of undefined — silent garbage, now a named rejection
  assert.throws(() => resolveAuction([], 'second'), /AUCT01-empty-bids/);
  // VCG: empty / ragged value matrices
  assert.throws(() => optimalAllocation([]), /VCG01-empty-matrix/);
  assert.throws(() => optimalAllocation([[1, 2], [3]]), /VCG02-bad-shape/);
  assert.throws(
    () => searchDsicViolation([], () => [], [0, 1]),
    /VCG05-empty-matrix/,
  );
  // DSIC searchers: report register below two levels
  assert.throws(() => classicalBestGain('second', 1, [0], 0, 1), /DSIC01-bad-k/);
  // concurrence: not a 4×4 two-qubit state (previously returned NaN silently)
  assert.throws(() => concurrence(identity(2)), /MONO01-bad-shape/);
  // Wiesner collateral: zero trials (previously divided by zero into NaN)
  assert.throws(() => wiesnerExperiment(makeRng(1), 4, 0), /WIESNER02-bad-args/);
  assert.throws(() => wiesnerExperiment(makeRng(1), 0, 10), /WIESNER01-bad-args/);
  // data locking: key family / bounded-scale guards
  assert.throws(() => makeBasisFamily(4, 0, 1), /DL03-bad-K/);
  assert.throws(() => lockingRow(7, 4, 1), /DL04-bad-n/);
});

test('negative controls: the new guards do not reject legal traffic', () => {
  const rng = makeRng(42);
  // the guarded entries still resolve the same canonical answers
  assert.deepEqual(resolveAuction([3, 5, 5], 'second'), { winner: 1, price: 5 });
  const run = runSealedBidAuction([2, 0, 1], 3, rng, 3);
  assert.equal(run.checkErrors, 0);
  assert.equal(run.winner, 0);
  assert.equal(run.price, 1);
  assert.equal(toBasis(0), 0);
  assert.equal(toBasis(2), 2);
  assert.equal(lockValue(0, 1, rng, 2).m, 1);
  assert.equal(transcriptLeakage(2, 2).hiddenPairs, 1);
  assert.deepEqual(optimalAllocation([[4, 1], [2, 3]]), { alloc: [0, 1], value: 7 });
  // discriminated verdicts: rejection always carries its name
  const row = lockingRow(2, 8, 41);
  const fake = { ...certificateFromRow(row, 41), chiPreUpper: 0.123 };
  const verdict = verifyLockingCertificate(fake);
  assert.ok(!verdict.ok);
  assert.match(verdict.code, /^REF\d\d-/);
  assert.ok(verdict.detail.length > 0);
});

test('single-sourcing anchors: dagger2 / fmt / conjVec / maximallyMixed are the canonical one source', () => {
  // dagger2 (formerly triplicated locking/wiesner/robustness): for EVERY
  // basis family U†·U = I entry-exact — the Y basis (asymmetric imaginary
  // part) is the one that exposes a wrong-index conjugation; H alone is real
  // symmetric and immune (the anchor-blindspot lesson: anchor the space that
  // can actually fail)
  for (const b of [0, 1, 2] as const) {
    const u = basisUnitary(b);
    assert.ok(matEq(mMul(dagger2(u), u), identity(2), 1e-15), `dagger2 roundtrip basis ${b}`);
    assert.ok(matEq(mMul(u, dagger2(u)), identity(2), 1e-15), `dagger2 roundtrip basis ${b} (right)`);
  }
  // dagger2 of the Y-basis unitary rounds back to the identity in product
  const yBasis = dagger2(dagger2(HADAMARD));
  assert.ok(matEq(yBasis, HADAMARD, 0));
  // fmt (merged onto the guarded core/rng version): finite and non-finite
  // spellings are pinned — the two former copies never differed on any input
  assert.equal(fmt(1 / 3), '0.333333');
  assert.equal(fmt(2, 0), '2');
  assert.equal(fmt(NaN), 'NaN');
  assert.equal(fmt(Infinity), 'Infinity');
  assert.equal(fmt(-Infinity), '-Infinity');
  // conjVec (merged from hjw/robustness duplicates): conjugation mirrors im
  // (negating +0 yields -0 — the historical behavior of BOTH former copies,
  // so the merge is bit-preserving; === treats the two zeros as equal)
  const cj = conjVec(PSI_Z1);
  assert.equal(cj.n, 2);
  assert.ok(cj.im[0] === 0);
  assert.ok(cj.im[1] === 0);
  assert.equal(cj.re[1], 1);
  // maximallyMixed (the single source of I/d): exactly 0.5 on the qubit
  const ihalf = maximallyMixed(2);
  assert.equal(ihalf.re[0], 0.5);
  assert.equal(ihalf.re[3], 0.5);
  assert.equal(ihalf.im[0], 0);
});
