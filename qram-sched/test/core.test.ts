import test from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../src/core/rng.js";
import { hittingTime, jacobiEigenvalues, luSolve } from "../src/core/linalg.js";
import { chainFromGraph, chainMatrix, lazyChain } from "../src/walk/szegedy.js";

test("rng: same seed, same stream; different seed, different stream", () => {
  const a = new Rng(7);
  const b = new Rng(7);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const c = new Rng(8);
  assert.notEqual(new Rng(7).next(), c.next());
});

test("rng: shuffle is a permutation", () => {
  const rng = new Rng(3);
  const arr = Array.from({ length: 50 }, (_, i) => i);
  rng.shuffle(arr);
  assert.deepEqual([...arr].sort((x, y) => x - y), Array.from({ length: 50 }, (_, i) => i));
});

test("jacobi: exact eigenvalues on anchors", () => {
  let e = jacobiEigenvalues(3, Float64Array.from([2, 0, 0, 0, 1, 0, 0, 0, 0]));
  assert.deepEqual([...e], [0, 1, 2]);
  // rotation by 45 deg of diag(1, 3): eigen 1, 3
  const c = Math.SQRT1_2;
  e = jacobiEigenvalues(2, Float64Array.from([2, 1, 1, 2]));
  assert.ok(Math.abs((e[0] as number) - 1) < 1e-12 && Math.abs((e[1] as number) - 3) < 1e-12);
  assert.ok(Math.abs(c - c) === 0); // keep c used
});

test("luSolve: residual on random systems", () => {
  const rng = new Rng(11);
  for (const n of [2, 5, 20]) {
    const a = Float64Array.from({ length: n * n }, () => rng.next() - 0.5);
    for (let i = 0; i < n; i++) a[i * n + i] = a[i * n + i]! + n; // diagonally dominant
    const b = Float64Array.from({ length: n }, () => rng.next());
    const x = luSolve(n, Float64Array.from(a), Float64Array.from(b));
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let j = 0; j < n; j++) r += (a[i * n + j] as number) * (x[j] as number);
      assert.ok(Math.abs(r - (b[i] as number)) < 1e-10);
    }
  }
});

test("hittingTime: K_n lazy closed form 2(n-1), two-state 2/q", () => {
  for (const n of [4, 8, 16]) {
    const adj = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => j).filter((j) => j !== i));
    const lazy = lazyChain(chainFromGraph(adj));
    const mu = new Float64Array(n);
    for (let i = 1; i < n; i++) mu[i] = 1 / (n - 1);
    const ht = hittingTime(n, chainMatrix(lazy), new Set([0]), mu);
    assert.ok(Math.abs(ht - 2 * (n - 1)) < 1e-9, `K_${n}: ${ht}`);
  }
  const q = 0.125;
  const chain = { n: 2, neighbors: [[0, 1], [1, 0]], probs: [[1 - q, q], [q, 1 - q]] };
  const lazy = lazyChain(chain);
  const ht = hittingTime(2, chainMatrix(lazy), new Set([1]), new Float64Array([1, 0]));
  assert.ok(Math.abs(ht - 2 / q) < 1e-9);
});

test("hittingTime: multi-target set on a path", () => {
  // path 0-1-2-3-4, targets {0,4}, start at 2. Non-lazy: E2 = 2 + E2/2 => 4
  // (E1 = 1 + E2/2); the lazy chain doubles it to 8.
  const chain = chainFromGraph([[1], [0, 2], [1, 3], [2, 4], [3]]);
  const lazy = lazyChain(chain);
  const ht = hittingTime(5, chainMatrix(lazy), new Set([0, 4]), new Float64Array([0, 0, 1, 0, 0]));
  assert.ok(Math.abs(ht - 8) < 1e-9, String(ht));
});
