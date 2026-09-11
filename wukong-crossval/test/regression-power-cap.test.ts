import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { minShots, powerAt } from "../src/kernel/power.js";

// Regression: minShots's doubling scan could overshoot the censoring cap to
// the next power of two and return an UNCENSORED minimum beyond the cap
// (measured: p0=0.2, p1=0.25, alpha=0.05, target=0.8, cap=257 shipped
// N=454 uncensored, violating "rows beyond the cap are censored and say so").
describe("regression: minShots censors at the cap, not at the next power of two", () => {
  it("a true minimum inside the doubling overshoot band (cap, 2^ceil(log2 cap)] is censored", () => {
    // true minimum 454; cap 257 sits between doublings 256 and 512
    const censored = minShots(0.2, 0.25, 0.05, 0.8, 257);
    assert.equal(censored.shots, null, "must censor when the minimum is beyond the cap");
    assert.equal(censored.power, null);
    assert.equal(censored.dips, null);
    assert.ok(Number.isFinite(censored.chernoff), "the Chernoff bound still ships on censored rows");
  });

  it("the same operating point ships uncensored when the cap allows it, with two-sided minimality", () => {
    const r = minShots(0.2, 0.25, 0.05, 0.8, 1000);
    assert.ok(r.shots !== null && r.power !== null);
    assert.ok(r.shots <= 1000);
    assert.ok(r.power >= 0.8, "power at N* meets target");
    assert.ok(powerAt(r.shots - 1, 0.2, 0.25, 0.05) < 0.8, "N*-1 fails: local minimality preserved");
  });

  it("the invariant shots === null || shots <= cap holds across a swept band of caps", () => {
    for (const [p0, p1] of [
      [0.03, 0.0375],
      [0.05, 0.06],
      [0.2, 0.25],
      [0.2, 0.15],
    ] as const) {
      for (const cap of [100, 513, 2049, 4097, 8193, 20000]) {
        const r = minShots(p0, p1, 0.05, 0.8, cap);
        assert.ok(r.shots === null || r.shots <= cap, `p0=${p0} p1=${p1} cap=${cap}: shots ${r.shots}`);
      }
    }
  });
});
