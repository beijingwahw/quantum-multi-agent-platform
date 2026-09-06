/**
 * Smoke gate for the platform-side copy of the QPU cross-validation kernel
 * (GENESIS 目标 B). Pins the interface: if the canonical implementation in
 * wukong-crossval drifts and the copy goes stale, this test names it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  exportCircuit,
  instanceSet,
  makeRng,
  optimizeOffline,
  runQaoa,
  sampleWithReadoutNoise,
} from '../experiments/qpu-cross-validation/kernel.js';

describe('qpu-cross-validation smoke (platform copy)', () => {
  it('X1: 20 seeded instances, 5 linear + 15 coupled, optima by enumeration', () => {
    const set = instanceSet();
    assert.equal(set.length, 20);
    assert.equal(set.filter((i) => i.kind === 'linear').length, 5);
    assert.equal(set.filter((i) => i.kind === 'coupled').length, 15);
    // determinism: same set twice, byte-equal optima
    const again = instanceSet();
    assert.deepEqual(
      set.map((i) => [i.id, i.optBits, i.optValue]),
      again.map((i) => [i.id, i.optBits, i.optValue]),
    );
  });

  it('X2+X3+X4: offline optimize a small instance, dry-run sample, export', () => {
    const inst = instanceSet()[0]!;
    const params = optimizeOffline(inst, 1);
    const psi = runQaoa(inst, params);
    const result = sampleWithReadoutNoise(psi, inst.n, inst.optBits, 512, 0.0, makeRng(123));
    assert.ok(result.rawHitRate >= 0 && result.rawHitRate <= 1);
    assert.ok(Math.abs(result.observedHitRate - result.rawHitRate) < 0.05); // zero noise: observed === raw
    const circuit = exportCircuit(inst, params, 512);
    assert.equal(circuit.shots, 512);
    assert.equal(circuit.layers.length, 1);
  });
});
