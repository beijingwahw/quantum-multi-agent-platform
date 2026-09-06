import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bbbvCheck, bbbvExactAnchor } from "../src/lower/bbbv.js";
import { exhaustiveDecisionTrees, randomTreeSpotCheck, sequentialScanSuccess } from "../src/lower/classical.js";
import { groverRun } from "../src/upper/grover.js";

describe("T3 walls", () => {
  it("full decision-tree enumeration: max uniform success = q/N exactly, cap universal", () => {
    for (const [N, q] of [
      [4, 1],
      [4, 2],
      [4, 3],
      [8, 2],
      [6, 3],
    ] as const) {
      const s = exhaustiveDecisionTrees(N, q);
      assert.ok(s.allWithinCap, `cap violated N=${N} q=${q}`);
      assert.ok(Math.abs(s.maxUniform - q / N) <= 1e-12, `max ${s.maxUniform} != ${q / N}`);
      assert.equal(s.worstCaseSuccess, 0); // q < N: no certainty
    }
  });

  it("at q = N the scan tree reaches worst-case certainty", () => {
    for (const [N, q] of [
      [2, 2],
      [3, 3],
    ] as const) {
      const s = exhaustiveDecisionTrees(N, q);
      assert.equal(s.worstCaseSuccess, 1);
      assert.ok(Math.abs(s.maxUniform - 1) <= 1e-12);
    }
    assert.equal(sequentialScanSuccess(64).worstCase, 1);
  });

  it("random deep trees never escape the cap (Yao ingredient)", () => {
    for (const q of [2, 4, 6]) {
      const spot = randomTreeSpotCheck(64, q, 4000, 7000 + q);
      assert.ok(spot.maxUniform <= spot.cap + 1e-12);
    }
  });

  it("BBBV hybrid lemma and corollary hold on exact evolutions", () => {
    for (const q of [1, 2, 4, 8, 12, 16]) {
      const c = bbbvCheck(128, q);
      assert.ok(c.lemmaHolds, `lemma N=128 q=${q}: ${c.maxDist} > ${c.hybridBound}`);
      assert.ok(c.corollaryHolds, `corollary N=128 q=${q}`);
      assert.ok(c.tightness <= 1 + 1e-9);
    }
  });

  it("q=1 anchor: max distance is EXACTLY 2/sqrt(N)", () => {
    for (const N of [64, 256, 1024]) {
      assert.ok(bbbvExactAnchor(N), `anchor failed at N=${N}`);
    }
  });

  it("q=0 tightness of the corollary: success = 1/N = (2*0+1)^2/N", () => {
    const c = bbbvCheck(256, 0);
    assert.ok(Math.abs(c.maxSuccess - 1 / 256) <= 1e-15);
  });

  it("Grover success at k* sits under the BBBV corollary cap (T2/T3 consistency)", () => {
    const N = 1024;
    const r = groverRun(N, [900]);
    const c = bbbvCheck(N, r.k);
    assert.ok(r.successExact <= c.corollaryBound + 1e-12);
  });

  it("the cap is quadratically far from what exhaustive classical needs", () => {
    // reaching success ~1 under the cap needs q ~ sqrt(N)/2, vs N classically
    const N = 1024;
    const c = bbbvCheck(N, 16);
    assert.ok(c.corollaryBound >= 0.95); // (2*16+1)^2/1024 = 1.084 -> capped by 1 in reality
    const r = groverRun(N, [7]);
    assert.ok(r.k < 0.8 * Math.sqrt(N));
  });
});
