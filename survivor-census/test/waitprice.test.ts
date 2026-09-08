import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mcWaiting, schedule, tailAt, waitingPrice } from "../src/kernel/waitprice.js";
import { Rng } from "../src/kernel/survivor.js";
import { TOL } from "../src/kernel/tol.js";

describe("S3 — the waiting price, exact", () => {
  it("E[T] = 1/P on two paths (closed form vs closed-form partial sum; loop referee at moderate P)", () => {
    for (const p of [0.5, 0.25, 0.1, 2 ** -10, 2 ** -20, 0.39645]) {
      const w = waitingPrice(p);
      assert.ok(w.meanDev < 1e-10, `p=${p} partial deviation ${w.meanDev}`);
      if (!Number.isNaN(w.meanLoop)) {
        assert.ok(Math.abs(w.meanLoop - w.meanClosedForm) < 1e-10, `p=${p} loop deviation ${Math.abs(w.meanLoop - w.meanClosedForm)}`);
      }
    }
  });

  it("the exact schedule is minimal: (1-P)^k <= delta < (1-P)^(k-1), and the bound never undercharges", () => {
    for (const p of [0.5, 0.1, 2 ** -10, 2 ** -20]) {
      for (const delta of [1e-3, 1e-6, 1e-12]) {
        const s = schedule(p, delta);
        assert.ok(s.minimal, `p=${p} delta=${delta} k=${s.kExact}`);
        assert.ok(s.overcharge >= 0);
        assert.ok(s.kBound >= s.kExact);
        // exp-log cross-path against Math.pow
        assert.ok(Math.abs(tailAt(p, s.kExact) - (1 - p) ** s.kExact) < TOL);
      }
    }
  });

  it("the concrete overcharge at P=1/2, delta=1e-6: bound 28 vs exact 20 (+40%)", () => {
    const s = schedule(0.5, 1e-6);
    assert.equal(s.kExact, 20);
    assert.equal(s.kBound, 28);
    assert.ok(Math.abs(s.overcharge - 0.4) < TOL);
  });

  it("MC referee for the geometric law lands inside 5 sigma (DATA)", () => {
    const rng = new Rng(419);
    const mc = mcWaiting(0.25, 200000, () => rng.next());
    assert.ok(mc.sigmaUnits < 5, `${mc.sigmaUnits} sigma`);
  });
});
