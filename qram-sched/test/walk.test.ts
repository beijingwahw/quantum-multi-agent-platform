import test from "node:test";
import assert from "node:assert/strict";
import { chainFromGraph, chainMatrix, lazyChain, SzegedyWalk, uniformAwayFrom, type Chain } from "../src/walk/szegedy.js";
import { hittingTime } from "../src/core/linalg.js";
import { Rng } from "../src/core/rng.js";

function completeGraph(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => j).filter((j) => j !== i));
}

test("walk: unitarity over long runs on random graphs", () => {
  const rng = new Rng(31);
  for (let trial = 0; trial < 10; trial++) {
    const n = 6;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) if (rng.next() < 0.6) {
        (adj[i] as number[]).push(j);
        (adj[j] as number[]).push(i);
      }
      if ((adj[i] as number[]).length === 0) {
        (adj[i] as number[]).push((i + 1) % n);
        (adj[(i + 1) % n] as number[]).push(i);
      }
    }
    const lazy = lazyChain(chainFromGraph(adj));
    const marked = [rng.int(n)];
    const walk = new SzegedyWalk(lazy, marked);
    const mu = uniformAwayFrom(n, new Set(marked));
    const { minNorm } = walk.detectionCurve(mu, 60);
    assert.ok(Math.abs(minNorm - 1) < 1e-12, `trial ${trial}: minNorm ${minNorm}`);
  }
});

test("walk: K_n quadratic detection beats the classical hitting time", () => {
  for (const n of [16, 32, 64]) {
    const lazy = lazyChain(chainFromGraph(completeGraph(n)));
    const mu = uniformAwayFrom(n, new Set([0]));
    const ct = hittingTime(n, chainMatrix(lazy), new Set([0]), mu);
    assert.ok(Math.abs(ct - 2 * (n - 1)) < 1e-9);
    const walk = new SzegedyWalk(lazy, [0]);
    const d = walk.detectionTime(mu, 0.25, 200);
    assert.ok(d.step > 0, `K_${n} not detected`);
    assert.ok(d.step < ct / 4, `K_${n}: quantum ${d.step} not quadratically ahead of ${ct}`);
  }
});

test("walk: two-state family — QT on the sqrt(1/q) scale, CT = 2/q", () => {
  for (const q of [0.25, 0.0625, 0.015625]) {
    const chain: Chain = { n: 2, neighbors: [[0, 1], [1, 0]], probs: [[1 - q, q], [q, 1 - q]] };
    const lazy = lazyChain(chain);
    const mu = new Float64Array([1, 0]);
    const ct = hittingTime(2, chainMatrix(lazy), new Set([1]), mu);
    assert.ok(Math.abs(ct - 2 / q) < 1e-9);
    const walk = new SzegedyWalk(lazy, [1]);
    const d = walk.detectionTime(mu, 0.25, Math.ceil(64 / Math.sqrt(q)));
    assert.ok(d.step > 0 && d.step * Math.sqrt(q) < 1.6, `q=${q}: QT ${d.step}`);
    assert.ok(d.step < ct / 3, `q=${q}: ${d.step} vs ${ct}`);
  }
});

test("walk: assignment lattice — near-optimal schedule found on the sqrt scale", () => {
  const t = 4;
  const w = 3;
  const rng = new Rng(42);
  const U = Array.from({ length: t }, () => Float64Array.from({ length: w }, () => rng.next()));
  const n = w ** t;
  const states: number[][] = [];
  for (let s = 0; s < n; s++) {
    const dig: number[] = [];
    let v = s;
    for (let i = 0; i < t; i++) {
      dig.push(v % w);
      v = Math.floor(v / w);
    }
    states.push(dig);
  }
  const wel = states.map((d) => d.reduce((a, ass, i) => a + (U[i]?.[ass] as number), 0));
  const opt = Math.max(...wel);
  const marked = new Set<number>();
  for (let s = 0; s < n; s++) if ((wel[s] as number) >= opt - 0.005 * Math.abs(opt)) marked.add(s);
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let s = 0; s < n; s++) {
    const d = states[s] as number[];
    for (let i = 0; i < t; i++) {
      for (let wj = 0; wj < w; wj++) if (wj !== (d[i] as number)) (adj[s] as number[]).push(s + (wj - (d[i] as number)) * w ** i);
    }
  }
  const lazy = lazyChain(chainFromGraph(adj));
  const mu = uniformAwayFrom(n, marked);
  const ct = hittingTime(n, chainMatrix(lazy), marked, mu);
  assert.ok(ct > 100 && ct < 300, String(ct));
  const walk = new SzegedyWalk(lazy, marked);
  const d = walk.detectionTime(mu, 0.25, 200);
  assert.ok(d.step > 0 && d.step <= 12, String(d.step));
  assert.ok(ct / d.step > 15, `${ct} / ${d.step}`);
});

test("walk: barbell — the honest negative is a stable finding (envelope peak later than classical)", () => {
  for (const m of [8, 16]) {
    const n = 2 * m;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) (adj[i] as number[]).push(j);
    for (let i = m; i < n; i++) for (let j = m; j < n; j++) if (i !== j) (adj[i] as number[]).push(j);
    (adj[0] as number[]).push(m);
    (adj[m] as number[]).push(0);
    const lazy = lazyChain(chainFromGraph(adj));
    const muStat = new Float64Array(n).fill(1 / n);
    const ct = hittingTime(n, chainMatrix(lazy), new Set([n - 1]), muStat);
    const walk = new SzegedyWalk(lazy, [n - 1]);
    const { curve } = walk.detectionCurve(muStat, 300 * m);
    // Envelope peak time: argmax of the detection curve (the curve has early
    // transients; the reliable detection envelope is what scales).
    let peak = -1;
    let kp = 0;
    for (let k = 0; k < curve.length; k++) if ((curve[k] as number) > peak) { peak = curve[k] as number; kp = k + 1; }
    assert.ok(peak > 0.4, `m=${m}: peak ${peak}`);
    assert.ok(kp > ct, `m=${m}: envelope peak ${kp} not later than classical ${ct}`);
  }
});

test("walk: barbell CHAIN family — the negative persists with more bottlenecks in series", () => {
  // v0.2.0 census extension: k K_m cliques joined by single bridges; the
  // envelope-peak-later-than-classical negative must hold across chain lengths
  // (machine data either way was the deliverable; this is the negative side).
  const chainAdj = (k: number, m: number): number[][] => {
    const n = k * m;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let c = 0; c < k; c++) {
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) (adj[c * m + i] as number[]).push(c * m + j);
    }
    for (let c = 0; c + 1 < k; c++) {
      (adj[c * m] as number[]).push((c + 1) * m);
      (adj[(c + 1) * m] as number[]).push(c * m);
    }
    return adj;
  };
  for (const [k, m] of [
    [3, 8],
    [4, 8],
  ] as const) {
    const n = k * m;
    const lazy = lazyChain(chainFromGraph(chainAdj(k, m)));
    const muStat = new Float64Array(n).fill(1 / n);
    const ct = hittingTime(n, chainMatrix(lazy), new Set([n - 1]), muStat);
    const walk = new SzegedyWalk(lazy, [n - 1]);
    const { curve } = walk.detectionCurve(muStat, 300 * m);
    let peak = -1;
    let kp = 0;
    for (let t = 0; t < curve.length; t++) if ((curve[t] as number) > peak) { peak = curve[t] as number; kp = t + 1; }
    assert.ok(peak > 0.35, `k=${k}: peak ${peak}`);
    assert.ok(kp > ct, `k=${k}: envelope peak ${kp} not later than classical ${ct}`);
  }
});

test("walk: initial state norm and marked mass sanity", () => {
  const lazy = lazyChain(chainFromGraph(completeGraph(8)));
  const walk = new SzegedyWalk(lazy, [3]);
  const mu = new Float64Array(8).fill(1 / 8);
  const st = walk.initialState(mu);
  assert.ok(Math.abs(walk.norm(st.re, st.im) - 1) < 1e-15);
  // stationarity: initial marked mass equals the stationary mass of vertex 3
  assert.ok(Math.abs(walk.markedProbability(st.re, st.im) - 1 / 8) < 1e-15);
});
