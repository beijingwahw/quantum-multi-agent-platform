import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { popcountShadow } from "../src/kernel/armor.js";

/**
 * Regression: popcountShadow(n odd, repair=true) produced NaN survival.
 * The repaired-branch survival read the tie row (n/2)*width — a fractional
 * index at odd n, so Float64Array reads returned undefined and
 * survival.push(Math.max(NaN, 0)) shipped NaN. At odd n the tie set is empty
 * and the majority decode maps every popcount strictly below n/2, so the
 * repaired survival must be exactly 1. The defect was latent (live callers
 * only ever repaired at even n; the odd-n render call reads fidelity only).
 */
describe("regression: the odd-n repaired shadow's survival is 1, not NaN", () => {
  it("n=5, repair on: every survival entry is exactly 1 (no fractional tie row)", () => {
    const dp = popcountShadow(5, 0.2, 8, undefined, true);
    assert.equal(dp.survival.length, 8);
    for (const s of dp.survival) {
      assert.ok(Number.isFinite(s), `survival must be finite, got ${String(s)}`);
      assert.ok(Math.abs(s - 1) <= 1e-15, `odd-n repaired survival ${s}`);
    }
  });

  it("n=7, sector repair and full repair (tie reset), long horizon: survival exactly 1", () => {
    for (const tieReset of [false, true]) {
      const dp = popcountShadow(7, 0.2, 64, undefined, true, tieReset);
      for (const s of dp.survival) {
        assert.ok(Number.isFinite(s), `tieReset=${String(tieReset)}: finite survival`);
        assert.ok(Math.abs(s - 1) <= 1e-15, `tieReset=${String(tieReset)}: survival ${s}`);
      }
    }
  });

  it("the even-n dead-zone face is unchanged: n=4 repaired survival sits below 1 under fire", () => {
    const dp = popcountShadow(4, 0.2, 8, undefined, true);
    assert.ok(dp.survival[7]! < 1 - 1e-3, `the tie dead zone must bite at n=4: ${dp.survival[7]}`);
    assert.ok(dp.survival[7]! >= 0);
  });

  it("the odd-n repaired fidelity agrees with the even-n case's finiteness law (all entries in [0, 1+eps])", () => {
    for (const [n, repair] of [
      [5, true],
      [6, true],
      [5, false],
    ] as const) {
      const dp = popcountShadow(n, 0.2, 8, undefined, repair);
      for (const f of dp.fidelity) {
        assert.ok(Number.isFinite(f) && f >= -1e-12 && f <= 1 + 1e-12, `n=${n} repair=${String(repair)}: fidelity ${f}`);
      }
    }
  });
});
