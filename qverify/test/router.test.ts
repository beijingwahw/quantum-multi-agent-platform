/** Verification-tier router decisions. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeVerification, exactReplayAffordable } from '../src/router.js';

test('small circuits route to local-exact replay', () => {
  const d = routeVerification({ qubits: 12, twoQubitGates: 40, ubqcInterface: false, sampling: false });
  assert.equal(d.tier, 'local-exact');
});

test('sampling tasks never route to local-exact', () => {
  const d = routeVerification({ qubits: 8, twoQubitGates: 20, ubqcInterface: false, sampling: true });
  assert.equal(d.tier, 'statistical');
});

test('UBQC interface wins when available beyond exact replay', () => {
  const d = routeVerification({ qubits: 30, twoQubitGates: 100, ubqcInterface: true, sampling: false });
  assert.equal(d.tier, 'trap-ubqc');
  assert.ok((d.detectionPerRound ?? 0) > 0.99);
});

test('large opaque backend falls to statistical with spoof warning in rationale', () => {
  const d = routeVerification({ qubits: 40, twoQubitGates: 500, ubqcInterface: false, sampling: true });
  assert.equal(d.tier, 'statistical');
  assert.ok(d.rationale.includes('spoof'));
});

test('exact replay threshold at n=24', () => {
  assert.ok(exactReplayAffordable(24));
  assert.ok(!exactReplayAffordable(25));
});
