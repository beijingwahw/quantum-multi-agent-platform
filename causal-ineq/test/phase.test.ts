import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkValidity } from "../src/process/validity.js";
import { wBiased } from "../src/process/ocb12.js";
import { sweepDeterministic } from "../src/game/classical.js";
import { COS2_PI_8 } from "../src/game/quantum.js";
import {
  SILVER_RATIO,
  SILVER_RATIO_CONJUGATE,
  adjudicateConeClaim,
  classicalCapBiased,
  coneEndpointResiduals,
  lc25Face,
  phasePoint,
  sweepDeterministicBiased,
  wstarFace,
} from "../src/game/phase.js";

describe("E13 phase diagram — (a) the biased classical cap, exhausted", () => {
  it("the re-weighted 8,192-strategy sweep equals the piecewise-linear cap at cone-inside, cone-outside, and kink weights", () => {
    const samples: ReadonlyArray<readonly [number, number]> = [
      [1, 1],
      [0.5, 0.5],
      [2, 1],
      [1, 2], // inside the cone (r = 1, 0.5, 2)
      [1, 0.1],
      [1, 0.3],
      [0.1, 1],
      [3, 1],
      [10, 1], // outside (r well below √2−1, well above √2+1)
      [1, SILVER_RATIO * 0.999],
      [1, SILVER_RATIO_CONJUGATE * 1.001], // just inside the endpoints
      [1, SILVER_RATIO * 1.001],
      [1, SILVER_RATIO_CONJUGATE * 0.999], // just outside
    ];
    for (const [c1, c2] of samples) {
      const s = sweepDeterministicBiased(c1, c2);
      assert.equal(s.strategiesSwept, 8192);
      const cap = classicalCapBiased(c1, c2);
      assert.ok(
        Math.abs(s.maxPayoff - cap) < 1e-12,
        `weights (${c1},${c2}): sweep ${s.maxPayoff} vs cap ${cap}`,
      );
    }
  });

  it("uniform weights reproduce the T2 anchor 3/4 and both order maxima", () => {
    const r = sweepDeterministicBiased(0.5, 0.5);
    const ref = sweepDeterministic();
    assert.ok(Math.abs(r.maxPayoff - 0.75) < 1e-12);
    assert.ok(Math.abs(r.maxPayoff - ref.maxSuccess) < 1e-12);
    assert.ok(Math.abs(r.orders.aFirst - ref.orders.aFirst) < 1e-12);
    assert.ok(Math.abs(r.orders.bFirst - ref.orders.bFirst) < 1e-12);
  });

  it("a log-spaced ratio grid (19 ratios, 3 scalings) — sweep == cap everywhere", () => {
    for (const scale of [0.25, 1, 4]) {
      for (let i = 0; i <= 18; i++) {
        const r = Math.pow(10, -1 + (2 * i) / 18); // r ∈ [0.1, 10]
        const s = sweepDeterministicBiased(scale, scale * r);
        assert.ok(
          Math.abs(s.maxPayoff - classicalCapBiased(scale, scale * r)) < 1e-12,
          `r=${r}`,
        );
      }
    }
  });

  it("negative control: the fake 'uniform-scaled' cap (c1+c2)·3/4 is convicted by the exhaustive sweep", () => {
    // the fake equals the true cap only on the diagonal; off it the sweep's
    // maximum exceeds the fake (e.g. (1, 0.5): true cap 1.25 > fake 1.125)
    for (const [c1, c2] of [
      [1, 0.5],
      [0.5, 1],
      [2, 0.6],
    ] as const) {
      const fake = (c1 + c2) * 0.75;
      assert.ok(
        sweepDeterministicBiased(c1, c2).maxPayoff > fake + 1e-9,
        `weights (${c1},${c2})`,
      );
    }
  });
});

describe("E13 phase diagram — (b) W*'s silver-ratio violation cone", () => {
  it("the cone endpoints solve the quadratics exactly: both branch ties hold to float precision", () => {
    const res = coneEndpointResiduals();
    assert.ok(res.branchLowTie < 1e-15, `low tie ${res.branchLowTie}`);
    assert.ok(res.branchHighTie < 1e-15, `high tie ${res.branchHighTie}`);
    assert.ok(
      res.conjugateIdentity < 1e-15,
      `conjugate ${res.conjugateIdentity}`,
    );
    assert.ok(res.silverQuadratic < 1e-15, `quadratic ${res.silverQuadratic}`);
    assert.ok(Math.abs(SILVER_RATIO - (2 - Math.SQRT2) / Math.SQRT2) < 1e-15);
  });

  it("the executed W* margin flips sign across both endpoints; ties at them; executed == (c1+c2)cos²(π/8)", () => {
    for (const [rIn, rOut] of [
      [1, 0.1],
      [1, 0.3],
      [SILVER_RATIO * 1.0001, SILVER_RATIO * 0.9999],
      [SILVER_RATIO_CONJUGATE * 0.9999, SILVER_RATIO_CONJUGATE * 1.0001],
    ] as const) {
      assert.ok(wstarFace(1, rIn).marginVsCap > 1e-9, `inside r=${rIn}`);
      assert.ok(wstarFace(1, rOut).marginVsCap < -1e-9, `outside r=${rOut}`);
    }
    assert.ok(Math.abs(wstarFace(1, SILVER_RATIO).marginVsCap) < 1e-15);
    assert.ok(
      Math.abs(wstarFace(1, SILVER_RATIO_CONJUGATE).marginVsCap) < 1e-15,
    );
    for (const r of [0.2, 0.5, 1, 2, 5]) {
      assert.ok(wstarFace(1, r).deviation < 1e-12, `r=${r} deviation`);
    }
  });

  it("smuggling trial: outside-cone violation claims are NAMED and REJECTED; honest claims accepted; endpoints undecided", () => {
    for (const r of [0.1, 10]) {
      const v = adjudicateConeClaim(r, true);
      assert.ok(!v.accepted, `r=${r}`);
      assert.match(v.reasons.join(" | "), /REJECT\[claim-vs-execution\]/);
    }
    const clean = adjudicateConeClaim(0.1, false);
    assert.ok(clean.accepted);
    assert.deepEqual(clean.reasons, []);
    const inCone = adjudicateConeClaim(1, true);
    assert.ok(inCone.accepted);
    assert.deepEqual(inCone.reasons, []);
    for (const r of [SILVER_RATIO, SILVER_RATIO_CONJUGATE]) {
      const v = adjudicateConeClaim(r, true);
      assert.ok(!v.accepted);
      assert.match(v.reasons.join(" | "), /REJECT\[endpoint-undecided\]/);
    }
    const invalid = adjudicateConeClaim(-1, true);
    assert.ok(!invalid.accepted);
    assert.match(invalid.reasons.join(" | "), /REJECT\[invalid-ratio\]/);
  });
});

describe("E13 phase diagram — (c) the LC25 face covers the whole quadrant", () => {
  it("executed ℐ_α on S_OCB,α equals the symmetric closed form; the gap identity holds; every probe process is valid", () => {
    for (const [c1, c2] of [
      [1, 0.05],
      [1, 0.25],
      [1, 0.5],
      [1, 1],
      [0.5, 1],
      [1, 4],
      [0.25, 1],
      [3, 3],
    ] as const) {
      const f = lc25Face(c1, c2);
      assert.ok(f.deviation < 1e-12, `(${c1},${c2}) deviation ${f.deviation}`);
      assert.ok(
        Math.abs(f.marginVsCap - f.gapFormula) < 1e-14,
        `gap identity (${c1},${c2})`,
      );
      assert.ok(f.marginVsCap > 1e-9, `must exceed the cap (${c1},${c2})`);
      assert.deepEqual(
        checkValidity(wBiased(f.alpha)).violations,
        [],
        `alpha=${f.alpha}`,
      );
    }
  });

  it("the unbiased point is where all three faces meet: LC25 = W* = cos²(π/8) in game units = (1+1/√2)/2; cap = 3/4", () => {
    const p = phasePoint(0.5, 0.5);
    assert.ok(Math.abs(p.lc25.closedForm - COS2_PI_8) < 1e-12);
    assert.ok(Math.abs(p.lc25.closedForm - (0.5 + Math.SQRT1_2 / 2)) < 1e-12);
    assert.ok(Math.abs(p.cap - 0.75) < 1e-12);
    assert.ok(Math.abs(p.wstar.payoffExecuted - p.lc25.closedForm) < 1e-12);
    // in LC25's α-units (weights (1,1)): sup = 1 + 1/√2 = 2cos²(π/8), the quoted bound
    const one = lc25Face(1, 1);
    assert.ok(Math.abs(one.closedForm - (1 + Math.SQRT1_2)) < 1e-12);
    assert.ok(Math.abs(one.closedForm - 2 * COS2_PI_8) < 1e-12);
  });

  it("asymptotic re-touch: the LC25 gap decays toward both axes while W*'s margin stays bounded away from 0", () => {
    const gaps = [0.01, 0.1, 1].map((r) => lc25Face(1, r).gapFormula);
    assert.ok(gaps[0]! < gaps[1]! && gaps[1]! < gaps[2]!);
    const gapsHigh = [100, 10, 2].map((r) => lc25Face(1, r).gapFormula);
    assert.ok(gapsHigh[0]! < gapsHigh[1]! && gapsHigh[1]! < gapsHigh[2]!);
    assert.ok(lc25Face(1, 1e-3).gapFormula < 3e-7);
    assert.ok(lc25Face(1e-3, 1).gapFormula < 3e-7);
    assert.ok(wstarFace(1, 1e-3).marginVsCap < -0.1);
    assert.ok(wstarFace(1e-3, 1).marginVsCap < -0.1);
  });

  it("layer comparison: outside the cone W* loses where LC25 still wins; inside both win with LC25 strictly above; r=1 they meet", () => {
    for (const r of [0.1, 0.3, 5, 10]) {
      assert.ok(wstarFace(1, r).marginVsCap < -1e-9, `W* must lose at r=${r}`);
      assert.ok(lc25Face(1, r).marginVsCap > 1e-9, `LC25 must win at r=${r}`);
    }
    for (const r of [0.5, 2]) {
      const w = wstarFace(1, r);
      const l = lc25Face(1, r);
      assert.ok(w.marginVsCap > 1e-9);
      assert.ok(
        l.marginVsCap > w.marginVsCap + 1e-9,
        `LC25 strictly above W* at r=${r}`,
      );
    }
    assert.ok(
      Math.abs(wstarFace(1, 1).payoffExecuted - lc25Face(1, 1).payoffExecuted) <
        1e-12,
    );
  });
});
