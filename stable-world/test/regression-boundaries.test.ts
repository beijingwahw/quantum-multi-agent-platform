import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeRng } from "../src/core/rng.js";
import { randomStateVec, vecToRho } from "../src/core/states.js";
import { traceDistance } from "../src/core/measures.js";
import { basisVec } from "../src/core/cmat.js";
import { DomainError } from "../src/core/errors.js";
import {
  GAMMA,
  applyCollision,
  boltzmannOccupancy,
  extractedGenerator,
  h2,
  lindbladRhs,
  stationaryInWorld,
  thermalUpRate,
} from "../src/kernel/law.js";

describe("regression: named refusals on degenerate and out-of-domain input (no silent NaN/garbage)", () => {
  it("h2 refuses non-finite q by name instead of leaking a silent NaN into the witnesses", () => {
    // convicted: NaN fails both range comparisons and fell through to -NaN*log2(NaN)
    assert.throws(() => h2(Number.NaN), /h2: entropy argument must be finite/);
    assert.throws(() => h2(Number.POSITIVE_INFINITY), /h2: entropy argument must be finite/);
    // the legal endpoints and neighbors keep their exact pinned values
    assert.strictEqual(h2(0), 0);
    assert.strictEqual(h2(1), 0);
    assert.strictEqual(h2(0.5), 1);
    assert.ok(Math.abs(h2(0.025) - 0.168660931) <= 1e-9);
  });

  it("stationaryInWorld refuses NaN and negative rates by name, matching its sibling pricers", () => {
    // convicted: twoRateInWorld/escapeAtHorizon refuse these by name while
    // stationaryInWorld silently returned NaN (r=NaN) and Infinity (r=-gamma)
    assert.throws(() => stationaryInWorld(Number.NaN), /rate must be >= 0/);
    assert.throws(() => stationaryInWorld(-0.25), /rate must be >= 0/);
    // the guarded kernel still returns the exact same values on legal inputs:
    // the r=0 endpoint is exactly 1, and the detailed-balance identity holds
    assert.strictEqual(stationaryInWorld(0, GAMMA), 1);
    for (const beta of [0, 1, 3, 20]) {
      assert.ok(
        Math.abs(stationaryInWorld(thermalUpRate(beta, GAMMA), GAMMA) - boltzmannOccupancy(beta)) <= 1e-15,
        `beta=${beta}`,
      );
    }
  });

  it("extractedGenerator refuses the theta=0 degenerate coupling by name — never a NaN matrix", () => {
    // convicted: at theta=0 the collision is the identity (numerator exactly
    // 0) and 1/sin^2(0) = Infinity, so every entry scaled to 0*Infinity = NaN
    const rng = makeRng(1201);
    const rho = vecToRho(randomStateVec(rng, 4));
    assert.throws(() => extractedGenerator(rho, 0, 3), /sin\^2\(theta\) must be positive/);
    assert.throws(() => extractedGenerator(rho, Number.NaN, 3), /sin\^2\(theta\) must be positive/);
    // the boundary stays LEGAL on the collision family's own face: theta=0 is
    // the identity channel to the kron/partialTrace roundtrip's rounding
    // (the repo's quiet-on-world tolerance)
    assert.ok(traceDistance(applyCollision(rho, 0, 3), rho) <= 1e-15);
    // and theta=pi/2, the family's other endpoint, stays a finite reading
    const halfPi = extractedGenerator(rho, Math.PI / 2, 3);
    for (let k = 0; k < halfPi.re.length; k++) {
      assert.ok(Number.isFinite(halfPi.re[k]!), `re[${k}] finite`);
      assert.ok(Number.isFinite(halfPi.im[k]!), `im[${k}] finite`);
    }
    // the legal neighbor one grade above the boundary still meets the
    // documented O(theta^2) convergence to the Lindblad operator (W-M's bound)
    for (const beta of [0, 1, 3]) {
      const pB = 1 / (1 + Math.exp(-beta));
      const th = 0.05;
      const ext = extractedGenerator(rho, th, beta);
      const target = lindbladRhs(rho, pB, 1 - pB);
      let dev = 0;
      for (let i = 0; i < 16; i++) {
        dev = Math.max(dev, Math.abs(ext.re[i]! - target.re[i]!), Math.abs(ext.im[i]! - target.im[i]!));
      }
      assert.ok(dev <= 0.06 * th * th, `beta=${beta}: dev ${dev}`);
    }
  });

  it("basisVec refuses an out-of-range index by name instead of a silent zero vector", () => {
    // convicted: the out-of-bounds Float64Array write was silently ignored —
    // basisVec(2, 5) returned the zero vector, filterBasisDigit's twin hole
    assert.throws(() => basisVec(2, 5), /basisVec: index 5 out of range for dimension 2/);
    assert.throws(() => basisVec(2, -1), /basisVec: index -1 out of range for dimension 2/);
    assert.throws(() => basisVec(2, 0.5), /basisVec: index 0.5 out of range for dimension 2/);
    // legal neighbors are unchanged: the basis vectors themselves
    assert.deepEqual(Array.from(basisVec(2, 0).re), [1, 0]);
    assert.deepEqual(Array.from(basisVec(2, 1).re), [0, 1]);
  });

  it("every new refusal is a DomainError with a stable greppable code", () => {
    const cases: Array<{ fire: () => void; code: string }> = [
      { fire: () => h2(Number.NaN), code: "h2:q-range" },
      { fire: () => stationaryInWorld(-1), code: "stationaryInWorld:rate-range" },
      { fire: () => extractedGenerator(vecToRho(randomStateVec(makeRng(1202), 4)), 0, 3), code: "extractedGenerator:theta-degenerate" },
      { fire: () => basisVec(2, 7), code: "basisVec:index-range" },
    ];
    for (const { fire, code } of cases) {
      assert.throws(
        fire,
        (err: unknown) => err instanceof DomainError && err.code === code && err.name === "DomainError",
        `expected a DomainError with code ${code}`,
      );
    }
  });
});
