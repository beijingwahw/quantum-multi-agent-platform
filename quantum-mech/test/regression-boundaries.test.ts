/**
 * Boundary-condition regressions (post-v0.3.0 audit wave): every guard added
 * in this sweep is exercised from its ILLEGAL side (the errors.test.ts
 * tradition — a silent NaN / out-of-range index is a smuggled verdict), and
 * the legal boundary traffic next to each guard is pinned so the new checks
 * cannot over-reject.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { makeRng } from '../src/core/rng.js';
import { identity, mat } from '../src/core/cmat.js';
import { optimalAllocation, welfare } from '../src/mech/vcg.js';
import { bellFidelity, doublePledgeFamilyScan } from '../src/contract/monogamy.js';
import { accessibleBounds, averageRhoDefect, lockedRhos, makeBasisFamily } from '../src/protocol/datalock.js';
import { fromVec, BELL_PHI_PLUS } from '../src/core/states.js';
import { runIfMain } from '../src/experiments/report.js';

test('regression: optimalAllocation refuses non-square matrices (was: silent NaN or silently ignored tasks)', () => {
  // 3 agents, 1 task: permutations assign task indices 0..2, rows have length 1
  assert.throws(() => optimalAllocation([[1], [2], [3]]), /VCG02-nonsquare/);
  // 2 agents, 3 tasks: the permutation walk only ever sees tasks 0..1 and
  // silently misses the optimum [1,2] (welfare 9 vs the returned 4)
  assert.throws(() => optimalAllocation([[1, 4, 0], [0, 2, 5]]), /VCG02-nonsquare/);
  assert.throws(() => optimalAllocation([[1, 2], [3, 4], [5, 6]]), /VCG02-nonsquare/);
  // square stays canonical
  assert.deepEqual(optimalAllocation([[4, 1], [2, 3]]), { alloc: [0, 1], value: 7 });
  assert.equal(welfare([[4, 1], [2, 3]], [0, 1]), 7);
});

test('regression: bellFidelity refuses non-4x4 states (was: silent NaN)', () => {
  assert.throws(() => bellFidelity(identity(2)), /MONO02-bad-shape/);
  assert.throws(() => bellFidelity(mat(3, 3)), /MONO02-bad-shape/);
  // legal anchors: Bell state with itself 1, |00⟩ with Φ+ gives |⟨Φ+|00⟩|² = 1/2
  const bell = fromVec(BELL_PHI_PLUS);
  assert.ok(Math.abs(bellFidelity(bell) - 1) < 1e-12);
  const prod = mat(4, 4);
  prod.re[0] = 1; // |00⟩⟨00|
  assert.ok(Math.abs(bellFidelity(prod) - 0.5) < 1e-12);
});

test('regression: doublePledgeFamilyScan refuses steps < 2 (was: silent zero scan)', () => {
  assert.throws(() => doublePledgeFamilyScan(0), /MONO03-bad-steps/);
  assert.throws(() => doublePledgeFamilyScan(1.5), /MONO03-bad-steps/);
  // steps = 2 scans exactly x = 1/2 — the family optimum point
  const scan = doublePledgeFamilyScan(2);
  assert.equal(scan.x, 0.5);
  assert.ok(scan.minC > 0.69 && scan.minC <= Math.SQRT1_2 + 1e-9, `minC=${scan.minC}`);
});

test('regression: data-lock bounds refuse empty state lists (was: TypeError crash)', () => {
  assert.throws(() => accessibleBounds([]), /DL06-empty/);
  assert.throws(() => averageRhoDefect([]), /DL06-empty/);
  // legal traffic: the canonical tiny family round-trips
  const family = makeBasisFamily(4, 4, 41);
  const rhos = lockedRhos(family);
  assert.ok(averageRhoDefect(rhos) < 1e-12);
  const b = accessibleBounds(rhos);
  assert.ok(b.lower <= b.upper + 1e-12 && b.upper >= 0);
});

test('regression: rng.int refuses maxExclusive < 1 (was: silently 0) and keeps endpoints', () => {
  const rng = makeRng(9);
  assert.throws(() => rng.int(0), /rng\.int/);
  assert.throws(() => rng.int(-2), /rng\.int/);
  assert.throws(() => rng.int(2.5), /rng\.int/);
  assert.equal(rng.int(1), 0); // the degenerate-but-legal bound
  for (let i = 0; i < 50; i++) {
    const k = rng.int(8);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 8);
  }
});

test('regression: runIfMain fires only on an exact process.argv[1] hit', () => {
  let calls = 0;
  // any URL other than process.argv[1]'s must stay silent — the imported-
  // by-run-all case the entry-guard law protects
  runIfMain(pathToFileURL('/definitely/not/the/entry.ts').href, () => {
    calls++;
  });
  assert.equal(calls, 0);
  // an exact hit must invoke main exactly once (under node --test the test
  // file itself IS process.argv[1] of its runner process)
  runIfMain(pathToFileURL(process.argv[1] ?? '').href, () => {
    calls++;
  });
  assert.equal(calls, 1);
});
