import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuction } from '../src/mech/auctions.js';
import { affineResidual, classicalBestGain, quantumBestGain } from '../src/mech/dsic.js';
import { makeRng } from '../src/core/rng.js';
import {
  exactAllocator,
  optimalAllocation,
  permutations,
  perturbedAllocator,
  searchDsicViolation,
  vcgPayments,
  vcgUtilities,
} from '../src/mech/vcg.js';

test('second price: winner pays second-highest; ties to lowest index', () => {
  const o = resolveAuction([3, 5, 5], 'second');
  assert.equal(o.winner, 1);
  assert.equal(o.price, 5);
  const p = resolveAuction([1, 2], 'second');
  assert.equal(p.winner, 1);
  assert.equal(p.price, 1);
});

test('first price pays own bid', () => {
  const o = resolveAuction([2, 7], 'first');
  assert.equal(o.winner, 1);
  assert.equal(o.price, 7);
});

test('classical DSIC: second price zero gain on grid; first price breaks', () => {
  const rng = makeRng(1);
  // shading-profitable instance: agent 0 value 3, others [2,1]
  const fp = classicalBestGain('first', 3, [2, 1], 0, 4);
  assert.ok(fp.bestGain > 0.5, `FP gain ${fp.bestGain}`);
  const sp = classicalBestGain('second', 3, [2, 1], 0, 4);
  assert.ok(Math.abs(sp.bestGain) < 1e-12);
  // sweep many profiles: SP never gains
  for (let t = 0; t < 200; t++) {
    const others = [rng.int(4), rng.int(4)];
    const v = rng.int(4);
    const g = classicalBestGain('second', v, others, rng.int(3) === 0 ? 0 : 1, 4);
    assert.ok(g.bestGain <= 1e-12, `SP gain ${g.bestGain} at ${JSON.stringify({ v, others })}`);
  }
});

test('quantum DSIC: SP immune to arbitrary density matrices; FP deviation survives', () => {
  const rng = makeRng(2);
  for (let t = 0; t < 50; t++) {
    const others = [rng.int(4), rng.int(4)];
    const v = rng.int(4);
    const slot = rng.int(2);
    const sp = quantumBestGain('second', v, others, slot, 4, rng, 120);
    assert.ok(sp.bestGain <= 1e-12, `quantum SP gain ${sp.bestGain}`);
  }
  const fp = quantumBestGain('first', 3, [2, 1], 0, 4, rng, 50);
  assert.ok(fp.bestGain > 0.5, `quantum FP gain ${fp.bestGain}`);
});

test('utility functional is affine in the submitted state (T1 core)', () => {
  const rng = makeRng(3);
  for (let t = 0; t < 100; t++) {
    const others = [rng.int(4), rng.int(4)];
    const v = rng.int(4);
    const res = affineResidual('second', v, others, rng.int(2), 4, rng);
    assert.ok(res < 1e-13, `affine residual ${res}`);
  }
});

test('permutations count', () => {
  assert.equal(permutations(1).length, 1);
  assert.equal(permutations(2).length, 2);
  assert.equal(permutations(3).length, 6);
  assert.equal(permutations(4).length, 24);
});

test('optimal allocation on a known 2x2', () => {
  const v = [
    [4, 1],
    [2, 3],
  ];
  const { alloc, value } = optimalAllocation(v);
  assert.equal(value, 7);
  assert.deepEqual(alloc, [0, 1]);
});

test('VCG payments on a known 2x2', () => {
  const v = [
    [4, 1],
    [2, 3],
  ];
  const { alloc } = optimalAllocation(v);
  const pay = vcgPayments(v, alloc);
  // agent 0: others' max without 0 = 3 (agent1 takes task1); pays 3 - 3 = 0... h_0 = 3, others at alloc = 3
  // agent 1: h_1 = 4 (agent0 takes task0); pays 4 - 4 = 0
  // both payments 0: the efficient allocation is also dominant here
  assert.equal(pay[0], 0);
  assert.equal(pay[1], 0);
  const utils = vcgUtilities(v, alloc);
  assert.deepEqual(utils, [4, 3]);
});

test('exact allocator: no DSIC violation across random instances (T5 control)', () => {
  const rng = makeRng(4);
  for (let t = 0; t < 30; t++) {
    const v = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(4)));
    const w = searchDsicViolation(v, exactAllocator, [0, 1, 2, 3]);
    assert.equal(w, null, `violation under exact allocator: ${JSON.stringify(w)}`);
  }
});

test('perturbed allocator: a CRAFTED instance with a profitable misreport', () => {
  // agent 0 is pivotal; a perturbed allocation that mis-assigns lets the
  // agent manipulate the Groves payment
  const v = [
    [3, 0, 0],
    [0, 3, 0],
    [0, 0, 3],
  ];
  const rng = makeRng(9);
  let found = false;
  for (let t = 0; t < 200 && !found; t++) {
    const alloc = perturbedAllocator(1, rng);
    const w = searchDsicViolation(v, alloc, [0, 1, 2, 3]);
    if (w !== null) found = true;
  }
  assert.ok(found, 'expected a DSIC violation under a perturbed allocator');
});
