import test from "node:test";
import assert from "node:assert/strict";
import { activeNodes, BucketBrigadeQram, queryFailureProb, queryFailureProbEnumerated } from "../src/qram/bucket.js";
import { encodeUniformStream, streamMean } from "../src/qram/stream.js";
import { Rng } from "../src/core/rng.js";

test("qram: addressing is an exact unitary on random complex states", () => {
  const rng = new Rng(21);
  for (let n = 1; n <= 3; n++) {
    const qram = new BucketBrigadeQram(n);
    for (let a = 0; a < qram.numCells; a++) qram.write(a, rng.next());
    for (let trial = 0; trial < 20; trial++) {
      const re = new Float64Array(qram.dim);
      const im = new Float64Array(qram.dim);
      let norm0 = 0;
      for (let i = 0; i < qram.dim; i++) {
        re[i] = rng.next() - 0.5;
        im[i] = rng.next() - 0.5;
        norm0 += (re[i] as number) ** 2 + (im[i] as number) ** 2;
      }
      const s = 1 / Math.sqrt(norm0);
      for (let i = 0; i < qram.dim; i++) {
        re[i] = (re[i] as number) * s;
        im[i] = (im[i] as number) * s;
      }
      qram.applyQuery(re, im);
      let norm1 = 0;
      for (let i = 0; i < qram.dim; i++) norm1 += (re[i] as number) ** 2 + (im[i] as number) ** 2;
      assert.ok(Math.abs(norm1 - 1) < 1e-14, `n=${n} trial=${trial}: ${norm1}`);
    }
  }
});

test("qram: basis readout returns the stored cell value; classical bits are exact", () => {
  const rng = new Rng(22);
  const qram = new BucketBrigadeQram(4);
  for (let a = 0; a < qram.numCells; a++) qram.write(a, rng.next());
  for (let a = 0; a < qram.numCells; a++) {
    const re = new Float64Array(qram.dim);
    const im = new Float64Array(qram.dim);
    re[a * 2] = 1;
    const p = qram.busOneProbability(re, im);
    assert.ok(Math.abs(p - (qram.cells[a] as number)) < 1e-15);
    // address register untouched
    let addrMass = 0;
    for (let b = 0; b < 2; b++) addrMass += (re[a * 2 + b] as number) ** 2 + (im[a * 2 + b] as number) ** 2;
    assert.ok(Math.abs(addrMass - 1) < 1e-15);
  }
  // binary cells: exact classical read
  const bin = new BucketBrigadeQram(3);
  bin.write(5, 1);
  const re = new Float64Array(bin.dim);
  const im = new Float64Array(bin.dim);
  re[5 * 2] = 1;
  const p = bin.busOneProbability(re, im);
  assert.equal(p, 1);
});

test("qram: uniform superposition encodes the stream mean to machine precision", () => {
  for (let trial = 0; trial < 10; trial++) {
    const rng = new Rng(100 + trial);
    const qram = new BucketBrigadeQram(5);
    for (let a = 0; a < qram.numCells; a++) qram.write(a, rng.next());
    const st = encodeUniformStream(qram);
    let p = 0;
    for (let a = 0; a < qram.numCells; a++) p += (st.re[a * 2 + 1] as number) ** 2 + (st.im[a * 2 + 1] as number) ** 2;
    assert.ok(Math.abs(p - streamMean(qram)) < 1e-15);
  }
});

test("qram: online write updates the encoded stream (streaming semantics)", () => {
  const qram = new BucketBrigadeQram(4);
  for (let a = 0; a < qram.numCells; a++) qram.write(a, 0.1);
  const before = streamMean(qram);
  qram.write(9, 0.9);
  const st = encodeUniformStream(qram);
  let p = 0;
  for (let a = 0; a < qram.numCells; a++) p += (st.re[a * 2 + 1] as number) ** 2 + (st.im[a * 2 + 1] as number) ** 2;
  assert.ok(Math.abs(before - 0.1) < 1e-15);
  assert.ok(Math.abs(p - streamMean(qram)) < 1e-15);
  assert.ok(Math.abs((streamMean(qram)) - (0.1 * 15 + 0.9) / 16) < 1e-15);
});

test("qram: error exposure law matches exhaustive enumeration", () => {
  // tolerance: the enumeration sums up to 2^15 subset terms, so pure double
  // rounding accumulates to ~1e-12 on the largest case — not a logic gap.
  for (const p of [0.02, 0.07, 0.13]) {
    for (let n = 2; n <= 5; n++) {
      const f = queryFailureProb("bucket-brigade", n, p);
      const e = queryFailureProbEnumerated("bucket-brigade", n, p);
      assert.ok(Math.abs(f - e) < 1e-11, `bucket n=${n} p=${p}: ${f} vs ${e}`);
    }
    for (let n = 2; n <= 4; n++) {
      const f = queryFailureProb("fanout", n, p);
      const e = queryFailureProbEnumerated("fanout", n, p);
      assert.ok(Math.abs(f - e) < 1e-11, `fanout n=${n} p=${p}`);
    }
  }
});

test("qram: active nodes n vs 2^n - 1 (the log-vs-linear exposure)", () => {
  for (let n = 1; n <= 10; n++) {
    assert.equal(activeNodes("bucket-brigade", n), n);
    assert.equal(activeNodes("fanout", n), 2 ** n - 1);
  }
});
