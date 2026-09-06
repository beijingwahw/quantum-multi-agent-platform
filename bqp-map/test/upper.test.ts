import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../src/core/rng.js";
import { groverRun, groverSuccessClosedForm, groverSuccessExact, optimalK } from "../src/upper/grover.js";
import { arrayValuation, dhMin } from "../src/upper/dhmin.js";

describe("T2 quantum upper bounds", () => {
  const rng = new Rng(22);

  it("closed form == exact simulation across sizes and marked counts", () => {
    for (const n of [4, 6, 8, 10]) {
      const N = 2 ** n;
      for (const t of [1, 3, 7]) {
        const marked = Array.from({ length: t }, (_, i) => (i * 37 + 11) % N);
        for (const k of [0, 1, 3, optimalK(N, t)]) {
          const cf = groverSuccessClosedForm(N, t, k);
          const ex = groverSuccessExact(N, marked, k);
          assert.ok(Math.abs(cf - ex) <= 1e-12, `N=${N} t=${t} k=${k}: ${cf} vs ${ex}`);
        }
      }
    }
  });

  it("k=0 gives exactly 1/N (uniform start)", () => {
    for (const N of [16, 64, 256]) {
      assert.ok(Math.abs(groverSuccessExact(N, [5], 0) - 1 / N) <= 1e-15);
    }
  });

  it("groverRun: k*/sqrt(N) near pi/4, success >= 0.99, classical wall = k/N", () => {
    for (const n of [6, 8, 10, 12]) {
      const N = 2 ** n;
      const r = groverRun(N, [Math.floor(N / 3)]);
      assert.ok(Math.abs(r.k / Math.sqrt(N) - Math.PI / 4) < 0.15, `k*/sqrt(N)=${r.k / Math.sqrt(N)}`);
      assert.ok(r.successExact >= 0.99);
      assert.ok(Math.abs(r.classicalSameQueries - r.k / N) < 1e-15);
      // advantage factor = success / (k/N) grows like sqrt(N) — the quadratic law
      assert.ok(r.successExact / r.classicalSameQueries > Math.sqrt(N) / 4, `advantage ${r.successExact / r.classicalSameQueries}`);
    }
  });

  it("Durr-Hoyer finds the true minimum with sqrt-scaling queries", () => {
    for (const N of [128, 512, 2048]) {
      for (let s = 0; s < 5; s++) {
        const vals = randInts(N);
        const r = dhMin(arrayValuation(vals), rng);
        assert.equal(r.optimal, true);
        assert.ok(r.queries < 30 * Math.sqrt(N), `queries ${r.queries} vs sqrt(N) ${Math.sqrt(N)}`);
      }
    }
    function randInts(n: number): number[] {
      return Array.from({ length: n }, () => 1 + rng.int(10 ** 6));
    }
  });

  it("DH on unique-min valuations is search (reduction certificate)", () => {
    // value 0 at a single marked index, 1 elsewhere: minimum finding == search
    for (const N of [256, 1024]) {
      const marked = 123;
      const vals = Array.from({ length: N }, (_, i) => (i === marked ? 0 : 1));
      const r = dhMin(arrayValuation(vals), rng);
      assert.equal(r.value, 0);
      assert.equal(r.optimal, true);
      assert.ok(r.queries < 25 * Math.sqrt(N));
    }
  });
});
