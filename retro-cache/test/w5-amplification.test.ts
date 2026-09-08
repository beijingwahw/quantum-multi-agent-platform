import test from "node:test";
import assert from "node:assert/strict";
import { bscBlockInfo, collisionCensus, gfMul, inverseCensus, paMeasure, sparseAdversaryInfo } from "../src/kernel/amplify.js";
import { auditRateRow, auditUniformityClaim } from "../src/kernel/audit.js";
import { h2 } from "../src/kernel/tariff.js";

test("W5.A toy-field certificates and the exact universal-2 census", () => {
  assert.deepEqual(inverseCensus(4), { m: 4, nonzero: 15, invertible: 15 });
  assert.deepEqual(inverseCensus(8), { m: 8, nonzero: 255, invertible: 255 });
  assert.equal(gfMul(0x57, 0x83, 8), 0xc1, "GF(2^8) AES anchor 0x57*0x83=0xc1");
  // distributivity spot check: a (x) (b xor c) = a(x)b xor a(x)c
  const samples: Array<[number, number, number]> = [
    [0x53, 0xca, 0x11],
    [0x01, 0xff, 0x80],
    [0xd4, 0x27, 0x5b],
  ];
  for (const [a, b, c] of samples) {
    assert.equal(gfMul(a, b ^ c, 8), gfMul(a, b, 8) ^ gfMul(a, c, 8), `distributivity a=${a}`);
  }
  const c84 = collisionCensus(8, 4);
  assert.equal(c84.collisionsPerDelta, 15);
  assert.equal(c84.family, 255);
  assert.equal(c84.maxCollisionProb, 15 / 255);
  assert.ok(c84.maxCollisionProb < c84.uniform2Bound, "strictly better than 2^-k, never equal");
  assert.ok(c84.universal2);
  const c42 = collisionCensus(4, 2);
  assert.equal(c42.collisionsPerDelta, 3);
  assert.ok(c42.maxCollisionProb < 0.25);
});

test("W5.B before/after Eve information: two-path exact, bijection anchor, collapse", () => {
  const before = bscBlockInfo(8, 0.25);
  assert.ok(Math.abs(before.closed - before.table) < 1e-9, "before two-path (closed vs full 256x256 table)");
  assert.ok(Math.abs(before.closed - 8 * (1 - h2(0.25))) < 1e-12);
  const id = paMeasure(8, 8, 0.25);
  assert.ok(Math.abs(id.afterMean - before.table) < 1e-12, "k = m is a bijection: after = before");
  assert.ok(id.worstHkDev < 1e-12, "K uniform under every map: H(K) = k exactly");
  const k4 = paMeasure(8, 4, 0.25);
  const k2 = paMeasure(8, 2, 0.25);
  assert.ok(k4.afterMean < before.table / 5, `k=4 collapse (got ${k4.afterMean} vs ${before.table})`);
  assert.ok(k2.afterMean < k4.afterMean, "compressing further only helps the collapse");
  const clean = paMeasure(8, 4, 0.5);
  assert.equal(clean.beforeTable, 0);
  assert.equal(clean.afterMean, 0);
  assert.equal(clean.tvFamilyMixed, 0);
});

test("W5.C the sparse profile: rank formula matches brute force, finite-family leak is real", () => {
  for (const kb of [1, 2, 3, 4]) {
    const sp = sparseAdversaryInfo(8, 4, kb);
    assert.equal(sp.sampleCheckDev, 0, "brute-force enumeration = linear-algebra rank, exactly");
    assert.ok(sp.infoMean > 0, `known=${kb}: the finite family leaks (mean ${sp.infoMean})`);
  }
  const sp4 = sparseAdversaryInfo(8, 4, 4);
  assert.equal(sp4.infoMax, 4, "degenerate maps (identity with low half known) leak all k bits");
  assert.equal(sp4.infoMin, 0, "and good maps leak nothing");
  // monotone in known bits
  const sp2 = sparseAdversaryInfo(8, 4, 2);
  const sp3 = sparseAdversaryInfo(8, 4, 3);
  assert.ok(sp2.infoMean < sp3.infoMean && sp3.infoMean < sp4.infoMean);
});

test("W5.D the data-processing ceiling: identity ties it, the curve rides it down to the census zero", () => {
  for (const eps of [0.45, 0.3]) {
    const ceiling = h2(eps);
    for (const k of [8, 6, 4, 2]) {
      const pm = paMeasure(8, k, eps);
      assert.ok((k - pm.afterMean) / 8 <= ceiling + 1e-12, `eps=${eps} k=${k}: (k-I)/8 <= h2(eps)`);
      if (k === 8) assert.ok(Math.abs((k - pm.afterMean) / 8 - ceiling) < 1e-12, "identity attains the ceiling exactly");
    }
  }
  // the measured curve: r = identity anchor - leak, monotone in p, exactly 0 at p = 1/2
  let prev = Number.NEGATIVE_INFINITY;
  for (const p of [0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1]) {
    const eps = p / 2;
    const leak = h2((1 - p) / 2);
    const pm = paMeasure(8, 8, eps);
    const r = (8 - pm.afterMean) / 8 - leak;
    assert.ok(r >= prev - 1e-12, `p=${p}: rate not monotone`);
    prev = r;
    if (p === 0.5) assert.ok(Math.abs(r) < 1e-12, `p=1/2 census threshold: r = 0 (got ${r})`);
  }
});

test("W5.E the leftover-hash bound holds everywhere it is computed — and is vacuous where it is vacuous", () => {
  for (const eps of [0.5, 0.45, 0.3, 0.25]) {
    for (const k of [6, 4, 2]) {
      const pm = paMeasure(8, k, eps);
      assert.ok(pm.tvFamilyMixed <= pm.lhlBound + 1e-12, `eps=${eps} k=${k}: TV ${pm.tvFamilyMixed} <= LHL ${pm.lhlBound}`);
    }
  }
  const vacuous = paMeasure(8, 4, 0.25);
  assert.ok(vacuous.lhlBound > 0.5, "at n=8, k=4, eps=1/4 the bound certifies nothing — printed, not hidden");
});

test("W5.F smuggling trials: counterfeit rows are NAMED and REJECTED", () => {
  // the honest machine row for p = 0.9
  const q = 0.05;
  const line = 1 - h2(q);
  const machineR = 1 - h2(q) - (1 - h2(0.45)); // = identity anchor - leak
  // honest row passes
  const honest = auditRateRow({ p: 0.9, q, line, measured: machineR }, machineR);
  assert.ok(honest.ok, honest.detail);
  assert.equal(honest.offense, null);
  // trial 1a: measured column replaced by the theoretical line
  const t1a = auditRateRow({ p: 0.9, q, line, measured: line }, machineR);
  assert.ok(!t1a.ok);
  assert.equal(t1a.offense, "counterfeit key-rate row (value)");
  // trial 1b: the machine number itself tampered to sit on the line
  const t1b = auditRateRow({ p: 0.9, q, line, measured: line }, line);
  assert.ok(!t1b.ok);
  assert.equal(t1b.offense, "counterfeit key-rate row (no gap)");
  assert.match(t1b.detail, /data processing certifies/);
  // the p=1 noiseless anchor is allowed to sit on the line
  const endpoint = auditRateRow({ p: 1, q: 0, line: 1, measured: 1 }, 1);
  assert.ok(endpoint.ok, "p=1: r = line = 1 is the honest endpoint, not a forgery");
  // trial 2: fake hash-family uniformity claim
  const t2 = auditUniformityClaim({ m: 8, k: 4, claimedCollisionProb: 0.0625 });
  assert.ok(!t2.ok);
  assert.equal(t2.offense, "counterfeit uniformity claim (exactly 2^-k)");
  assert.match(t2.detail, /15\/255/);
  const honestClaim = auditUniformityClaim({ m: 8, k: 4, claimedCollisionProb: 15 / 255 });
  assert.ok(honestClaim.ok, honestClaim.detail);
});
