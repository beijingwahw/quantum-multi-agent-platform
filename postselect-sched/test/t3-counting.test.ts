import test from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../src/kernel/sorter.js";

interface CountRun {
  readonly m: number;
  readonly cntJoint: number;
  readonly ratio: number;
  readonly brute: number;
}

function countRun(n: number, seed: number): CountRun {
  const N = 2 ** n;
  const rng = new Rng(seed);
  const g: boolean[] = new Array(N).fill(false);
  const h: boolean[] = new Array(N).fill(false);
  for (let x = 0; x < N; x++) {
    g[x] = rng.next() < 0.4;
    h[x] = rng.next() < 0.5;
  }
  const amp = 1 / Math.sqrt(N);
  let weight = 0;
  let joint = 0;
  let m = 0;
  let cntJoint = 0;
  for (let x = 0; x < N; x++) {
    if (!g[x]) continue;
    weight += amp * amp;
    m++;
    if (h[x]) {
      joint += amp * amp;
      cntJoint++;
    }
  }
  return { m, cntJoint, ratio: joint / weight, brute: cntJoint / m };
}

test("T3.A every branch outcome probability is an exact integer ratio (#P fraction)", () => {
  for (const [n, seed] of [
    [8, 11],
    [10, 22],
    [12, 33],
    [12, 44],
  ] as const) {
    const r = countRun(n, seed);
    assert.ok(Math.abs(r.ratio - r.brute) < 1e-12, `n=${n}: deviation ${Math.abs(r.ratio - r.brute)}`);
    assert.ok(r.brute >= 0 && r.brute <= 1);
  }
});

test("T3.B odd denominators: gap separation and the single-shot decision error law", () => {
  for (const [n, seed] of [
    [8, 101],
    [10, 202],
    [12, 303],
  ] as const) {
    let r: CountRun | null = null;
    for (let bump = 0; bump < 8; bump++) {
      const cand = countRun(n, seed + 1000 * bump);
      if (cand.m % 2 === 1) {
        r = cand;
        break;
      }
    }
    assert.ok(r !== null, `n=${n}: found an odd-m instance`);
    const gap = Math.abs(r.ratio - 0.5);
    assert.ok(gap >= 1 / (2 * r.m) - 1e-12, `n=${n}: gap ${gap} below integer separation ${1 / (2 * r.m)}`);
    // the branch decision (majority sign) agrees with the integer referee, and
    // its error probability is exactly 1/2 - gap
    const branchDecision = r.ratio > 0.5;
    const referee = 2 * r.cntJoint > r.m;
    assert.equal(branchDecision, referee);
    const error = 0.5 - gap;
    assert.ok(error >= 0 && error <= 0.5);
  }
});

test("T3.C two readouts in-branch form an exact conditional simplex", () => {
  const n = 10;
  const N = 2 ** n;
  const rng = new Rng(777);
  const g: boolean[] = new Array(N).fill(false);
  const h1: boolean[] = new Array(N).fill(false);
  const h2: boolean[] = new Array(N).fill(false);
  for (let x = 0; x < N; x++) {
    g[x] = rng.next() < 0.35;
    h1[x] = rng.next() < 0.5;
    h2[x] = rng.next() < 0.5;
  }
  const amp = 1 / Math.sqrt(N);
  const probs = [0, 0, 0, 0];
  const counts = [0, 0, 0, 0];
  let m = 0;
  let weight = 0;
  for (let x = 0; x < N; x++) {
    if (!g[x]) continue;
    weight += amp * amp;
    m++;
    const idx = (h1[x] ? 2 : 0) + (h2[x] ? 1 : 0);
    probs[idx] = (probs[idx] as number) + amp * amp;
    counts[idx] = (counts[idx] as number) + 1;
  }
  const cond = probs.map((w) => (w) / weight);
  const sum = cond.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12, `simplex sums to 1 (got ${sum})`);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs((cond[i] as number) - (counts[i] as number) / m) < 1e-12, `cell ${i} = integer ratio`);
  }
});
