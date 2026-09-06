import test from "node:test";
import assert from "node:assert/strict";
import { groverFullSpace, groverSuccessClosedForm, mcMedianError, qaeDistribution, qaeEstimate, qaeMedianError, qaeQueries } from "../src/ae/ampest.js";
import { Rng } from "../src/core/rng.js";

test("grover: full-space simulation matches the 2-plane closed form exactly", () => {
  const N = 64;
  const marked = [3, 17, 40, 55];
  for (const k of [0, 1, 2, 3, 4, 6, 8]) {
    const full = groverFullSpace(6, marked, k);
    const closed = groverSuccessClosedForm(marked.length / N, k);
    assert.ok(Math.abs(full - closed) < 1e-14, `k=${k}: ${full} vs ${closed}`);
  }
});

test("grover: single marked item at the optimal iteration", () => {
  const N = 1024;
  const kOpt = Math.floor((Math.PI / 4) * Math.sqrt(N));
  const p = groverSuccessClosedForm(1 / N, kOpt);
  assert.ok(p > 0.99, String(p));
});

test("qae: distribution is normalized and symmetric anchors hold", () => {
  for (const p of [0.2, 0.5, 0.77]) {
    for (const m of [4, 6]) {
      const dist = qaeDistribution(p, m);
      let sum = 0;
      for (const v of dist) sum += v;
      assert.ok(Math.abs(sum - 1) < 1e-12, `p=${p} m=${m}: ${sum}`);
    }
  }
  // p = 0.5: theta = pi/4, phase 2 theta = pi/2 -> mode exactly at j = M/4, estimate exactly 0.5
  const dist = qaeDistribution(0.5, 4);
  let mode = 0;
  for (let j = 1; j < dist.length; j++) if ((dist[j] as number) > (dist[mode] as number)) mode = j;
  assert.equal(mode, 4);
  assert.ok(Math.abs(qaeEstimate(4, 4) - 0.5) < 1e-15);
});

test("qae: median error follows 1/2^m (slope near -1)", () => {
  const errs: number[] = [];
  const qs: number[] = [];
  for (let m = 3; m <= 10; m++) {
    errs.push(Math.log2(qaeMedianError(0.37, m)));
    qs.push(Math.log2(qaeQueries(m)));
  }
  // least squares slope
  const mx = qs.reduce((a, b) => a + b, 0) / qs.length;
  const my = errs.reduce((a, b) => a + b, 0) / errs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < qs.length; i++) {
    num += ((qs[i] as number) - mx) * ((errs[i] as number) - my);
    den += ((qs[i] as number) - mx) ** 2;
  }
  const slope = num / den;
  assert.ok(slope < -0.85 && slope > -1.15, String(slope));
});

test("mc: median error follows 1/sqrt(s) (slope near -1/2)", () => {
  const errs: number[] = [];
  const ss: number[] = [];
  for (const s of [16, 64, 256, 1024, 4096, 16384]) {
    errs.push(Math.log2(mcMedianError(0.37, s, 3000, 13)));
    ss.push(Math.log2(s));
  }
  const mx = ss.reduce((a, b) => a + b, 0) / ss.length;
  const my = errs.reduce((a, b) => a + b, 0) / errs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < ss.length; i++) {
    num += ((ss[i] as number) - mx) * ((errs[i] as number) - my);
    den += ((ss[i] as number) - mx) ** 2;
  }
  const slope = num / den;
  assert.ok(slope < -0.4 && slope > -0.6, String(slope));
});

test("qae: quadratic query advantage at matched median accuracy", () => {
  const target = 0.005;
  let mUsed = -1;
  for (let m = 2; m <= 14; m++) if (qaeMedianError(0.37, m) <= target) { mUsed = m; break; }
  let sUsed = -1;
  for (let e = 2; e <= 26; e++) if (mcMedianError(0.37, 2 ** e, 2000, 17) <= target) { sUsed = 2 ** e; break; }
  assert.ok(mUsed > 0 && sUsed > 0);
  assert.ok(sUsed / qaeQueries(mUsed) > 10, `MC ${sUsed} vs QAE ${qaeQueries(mUsed)}`);
});

test("qae: query ledger is exact", () => {
  assert.equal(qaeQueries(10), 1023);
  assert.equal(qaeQueries(3), 7);
});

test("sampling referee: empirical QAE outcomes match the exact distribution mean", () => {
  // draws from the exact distribution (as quantumReplayRun does) reproduce the
  // distribution's mean within statistical tolerance — guards the sampler wiring
  const p = 0.37;
  const m = 6;
  const dist = qaeDistribution(p, m);
  let mean = 0;
  for (let j = 0; j < dist.length; j++) mean += (dist[j] as number) * qaeEstimate(j, m);
  const rng = new Rng(99);
  let acc = 0;
  const draws = 20000;
  for (let i = 0; i < draws; i++) {
    const u = rng.next();
    let c = 0;
    let pick = dist.length - 1;
    for (let j = 0; j < dist.length; j++) {
      c += dist[j] as number;
      if (u < c) {
        pick = j;
        break;
      }
    }
    acc += qaeEstimate(pick, m);
  }
  assert.ok(Math.abs(acc / draws - mean) < 0.01, `${acc / draws} vs ${mean}`);
});
