/**
 * Core-guard regressions (R9-A): the canon's own basisVec and rng.int
 * boundaries. Both faces were the family's last unguarded copies of holes
 * the hardened siblings already refuse by (stable-world R4, ent-clearing
 * R7, dtc-clock; qverify/quantum-mech rng 2026-09-11) — each test pins the
 * refusal AND the exact legal output, so the guards can neither vanish nor
 * creep onto the legal path. R12 appended the mAdd shape refusal: adopted
 * rootward from binding-price (R12-F's conviction) so the byte-identical
 * family (canon / binding-price / quantum-mech / qverify) shares the bytes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { basisVec, mAdd, mat } from "../src/core/cmat.js";
import { KET0, KET1 } from "../src/core/states.js";
import { makeRng } from "../src/core/rng.js";

test("basisVec refuses out-of-range and fractional indices (the silent zero-vector hole)", () => {
  // an out-of-range/fractional index into the Float64Array was a silent
  // no-op write: the caller received the zero vector, a confident-looking
  // |0...0> — the exact hole stable-world (R4) and ent-clearing (R7) were
  // convicted of and refuse by name
  assert.throws(() => basisVec(3, 3), /basisVec: index 3 out of range for dimension 3/);
  assert.throws(() => basisVec(3, -1), /basisVec: index -1 out of range for dimension 3/);
  assert.throws(() => basisVec(3, 1.5), /basisVec: index 1.5 out of range for dimension 3/);
});

test("basisVec still builds the exact legal vector (and the module-load kets with it)", () => {
  const v = basisVec(3, 1);
  assert.deepEqual(Array.from(v.re), [0, 1, 0]);
  assert.deepEqual(Array.from(v.im), [0, 0, 0]);
  assert.equal(v.n, 3);
  // the states assembled from basisVec at module load are the same kets
  assert.deepEqual(Array.from(KET0.re), [1, 0]);
  assert.deepEqual(Array.from(KET1.re), [0, 1]);
});

test("rng.int refuses degenerate bounds before any draw (int(2.5) biased, int(0)/int(-2) impossible)", () => {
  const rng = makeRng(1);
  // maxExclusive < 1 has no legal value in [0, maxExclusive): the old
  // Math.floor(next() * maxExclusive) returned 0 or a biased floor — an
  // out-of-range index smuggled into every consumer
  assert.throws(() => rng.int(0), /rng\.int: maxExclusive must be an integer >= 1, got 0/);
  assert.throws(() => rng.int(-2), /rng\.int: maxExclusive must be an integer >= 1, got -2/);
  assert.throws(() => rng.int(2.5), /rng\.int: maxExclusive must be an integer >= 1, got 2\.5/);
});

test("rng.int keeps the legal seeded stream bit-identical (the battery's own draws)", () => {
  // the guard sits BEFORE the draw, so every legal stream is unchanged;
  // pin the battery's own makeRng(101) int(3) sequence to its pre-guard
  // values (R7-B verified these are the only int() shapes the census uses)
  const rng = makeRng(101);
  assert.deepEqual([rng.int(3), rng.int(3), rng.int(3), rng.int(3)], [0, 2, 1, 1]);
  // pick rides int(items.length) — still legal, still the same draw order:
  // pick consumes draw 1 (index 0 -> "a"); the stream continues 0, 4
  const picker = makeRng(7);
  assert.equal(picker.pick(["a", "b", "c", "d", "e"]), "a");
  assert.deepEqual([picker.int(5), picker.int(5)], [0, 4]);
});

test("mAdd refuses shape mismatches before any write (R12 rootward adoption, binding-price first)", () => {
  // a mismatched add read b's cells at a's offsets — a confident wrong
  // value (or NaN tail cells) where mMul/mTrace in this same file already
  // refuse; binding-price (R12-F) was convicted first, the canon adopted
  // the guard in the same breath so the byte-identical family needs no
  // census divergence row (the R9-A rng.int convergence precedent)
  assert.throws(() => mAdd(mat(2, 2), mat(4, 4)), /shape mismatch 2x2 \+ 4x4/);
  assert.throws(() => mAdd(mat(4, 4), mat(2, 2)), /shape mismatch 4x4 \+ 2x2/);
});

test("mAdd keeps the exact legal sum (the family's reference output)", () => {
  const a = mat(2, 2);
  a.re[0] = 1.5;
  a.im[3] = -0.5;
  const b = mat(2, 2);
  b.re[0] = 0.25;
  b.re[3] = 2;
  b.im[3] = 0.5;
  const s = mAdd(a, b);
  assert.deepEqual(Array.from(s.re), [1.75, 0, 0, 2]);
  assert.deepEqual(Array.from(s.im), [0, 0, 0, 0]);
});
