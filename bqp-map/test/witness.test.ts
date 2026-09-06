import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../src/core/rng.js";
import {
  classicalWitnessCheck,
  hoeffdingCoverage,
  quantumEnergyExact,
  quantumEnergySampled,
  soundness,
} from "../src/witness/verify.js";
import { buildNonStoqAnnealer, buildStoqAnnealer, isStoquastic, maxNonzeroOffDiagonal, maxOffDiagonal, stoqDichotomy } from "../src/witness/stoq.js";

describe("T4 witness verification", () => {
  const rng = new Rng(33);

  it("classical witness: deterministic, exact", () => {
    const nums = [4, 6, 10, 12];
    assert.equal(classicalWitnessCheck(nums, [1, -1, -1, 1], 16), true); // 16 vs 16
    assert.equal(classicalWitnessCheck(nums, [1, 1, 1, 1], 16), false); // 32 vs 0
  });

  it("sampled energy converges to the exact expectation (1/sqrt(m) law)", () => {
    const nums = Array.from({ length: 8 }, () => 3 + rng.int(15));
    const dim = 2 ** nums.length;
    const w = { amps: Array.from({ length: dim }, () => 1 / Math.sqrt(dim)) };
    const exact = quantumEnergyExact(nums, w);
    const med = (shots: number): number => {
      const errs = Array.from({ length: 200 }, () => Math.abs(quantumEnergySampled(nums, w, shots, rng) - exact));
      errs.sort((a, b) => a - b);
      return errs[100] as number;
    };
    const m100 = med(100);
    const m10000 = med(10000);
    assert.ok(m10000 < m100 / 5, `median errors should shrink ~10x: ${m100} -> ${m10000}`);
  });

  it("Hoeffding coverage law: empirical coverage >= 1 - delta", () => {
    const nums = Array.from({ length: 8 }, () => 3 + rng.int(15));
    const dim = 2 ** nums.length;
    const w = { amps: Array.from({ length: dim }, () => 1 / Math.sqrt(dim)) };
    const grid = [
      { eps: 3, delta: 0.1 },
      { eps: 1.5, delta: 0.1 },
      { eps: 1.5, delta: 0.05 },
    ];
    for (const c of hoeffdingCoverage(nums, w, grid, 500, 9901)) {
      assert.ok(c.holds, `coverage ${c.empiricalCoverage} < ${1 - c.delta}`);
    }
  });

  it("soundness: cheating states rejected at the promised rate", () => {
    const nums = Array.from({ length: 8 }, () => 3 + rng.int(15));
    const total = nums.reduce((a, b) => a + b, 0);
    const B = Math.ceil(total / 2) + 3;
    for (const s of soundness(nums, B, 2, 0.1, [1, 2], 500, 9902)) {
      assert.ok(s.holds, `rejection ${s.rejectionRate} < ${1 - s.delta}`);
    }
  });

  it("stoquastic dichotomy: exact anchors -Gamma and +kappa", () => {
    const n = 4;
    const instances = Array.from({ length: 6 }, () => {
      const J = Array.from({ length: 4 }, () => {
        const i = rng.int(3);
        return { i, j: i + 1, w: rng.bernoulli(0.5) ? 3 : -3 };
      });
      const h = Array.from({ length: n }, () => (rng.bernoulli(0.5) ? 2 : -2));
      const xx = [{ i: 0, j: 2 }];
      return { J, h, xx };
    });
    const v = stoqDichotomy(n, 1.5, 0.75, instances);
    assert.ok(v.dichotomyHolds, `stoq ${v.stoqMaxOffDiag}, nonstoq ${v.nonStoqMaxOffDiag}`);
  });

  it("stoq annealer is stoquastic for ALL coupler signs; one +kappa XX edge breaks it", () => {
    const n = 4;
    const J = [
      { i: 0, j: 1, w: +5 },
      { i: 1, j: 2, w: -5 },
      { i: 2, j: 3, w: +3 },
    ];
    const h = [2, -3, 1, -1];
    const Hs = buildStoqAnnealer(n, J, h, 1.2);
    assert.ok(isStoquastic(Hs));
    assert.ok(Math.abs(maxNonzeroOffDiagonal(Hs) + 1.2) < 1e-12); // nonzero off-diagonals are exactly -Gamma
    const Hn = buildNonStoqAnnealer(n, J, h, 1.2, 0.4, [{ i: 0, j: 1 }]);
    assert.ok(!isStoquastic(Hn));
    assert.ok(Math.abs(maxOffDiagonal(Hn) - 0.4) < 1e-12); // exactly +kappa
  });
});
