/**
 * E7 tests — purification-ladder IFS phase boundary (src/physics/ladder.ts).
 *
 * Four-part acceptance: exact claims, machine evidence (engine cross-check
 * + negative controls), honest boundary, references in the module header.
 */
import { deepStrictEqual, ok, strictEqual, throws } from "node:assert";
import { describe, it } from "node:test";

import {
  EQUAL_ARM_FIXED_POINTS,
  balancedLadder,
  batchLeavesToReach,
  equalArmPolynomial,
  freshMixFixedPoint,
  freshMixFixedPointSim,
  freshMixQuadratic,
  minSlotsForFmin,
  phaseBoundary,
  saturationLadder,
  saturationLadderSim,
  wernerComposite,
} from "../src/physics/ladder.js";
import { purifyWerner } from "../src/physics/ops.js";
import { isCodedError } from "../src/core/errors.js";
import { runSim, type NetSpec, type RequestSpec } from "../src/net/engine.js";
import { ersPolicy } from "../src/net/policies.js";
import { Topology } from "../src/net/topology.js";

const F_GRID = [0.55, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99] as const;

describe("E7 L1: equal-arm fixed-point set of the Werner composite", () => {
  it("g(f,f) has exactly the fixed points {1/4, 1/2, 1} (polynomial road)", () => {
    deepStrictEqual([...EQUAL_ARM_FIXED_POINTS], [0.25, 0.5, 1]);
    for (const r of EQUAL_ARM_FIXED_POINTS)
      ok(Math.abs(equalArmPolynomial(r)) < 1e-15, `root ${r}`);
  });

  it("iteration road: F > 1/2 flows to 1, F < 1/2 flows to 1/4 (attractor basins)", () => {
    let up = 0.7;
    for (let i = 0; i < 400; i++) up = purifyWerner(up).fOut;
    ok(Math.abs(up - 1) < 1e-12, `high basin → 1, got ${up}`);
    let down = 0.45;
    for (let i = 0; i < 400; i++) down = purifyWerner(down).fOut;
    ok(Math.abs(down - 0.25) < 1e-12, `low basin → 1/4, got ${down}`);
  });

  it("improvement law: g(f,f) > f ⟺ f ∈ (1/2, 1)", () => {
    for (let f = 0.26; f < 0.999; f += 0.037) {
      const improved = purifyWerner(f).fOut > f;
      strictEqual(improved, f > 0.5, `f=${f.toFixed(3)}`);
    }
  });

  it("g is strictly increasing in both arms on (1/2, 1]", () => {
    for (const f1 of [0.6, 0.8, 0.95]) {
      for (const f2 of [0.6, 0.8, 0.95]) {
        ok(
          wernerComposite(f1 + 0.01, f2) > wernerComposite(f1, f2),
          `arm1 at ${f1},${f2}`,
        );
        ok(
          wernerComposite(f1, f2 + 0.01) > wernerComposite(f1, f2),
          `arm2 at ${f1},${f2}`,
        );
      }
    }
  });
});

describe("E7 L2: fresh-mix fixed point μ(F) as an explicit quadratic root", () => {
  it("closed form vs fixed-point iteration agree to 1e-12 on the grid", () => {
    for (const F of F_GRID) {
      const closed = freshMixFixedPoint(F);
      const sim = freshMixFixedPointSim(F);
      ok(Math.abs(closed - sim) < 1e-12, `F=${F}: closed=${closed} sim=${sim}`);
    }
  });

  it("quadratic residual vanishes at μ(F) and μ solves g(μ,F)=μ", () => {
    for (const F of F_GRID) {
      const { a, b, c } = freshMixQuadratic(F);
      const mu = freshMixFixedPoint(F);
      ok(Math.abs(a * mu * mu + b * mu + c) < 1e-12, `poly residual at F=${F}`);
      ok(Math.abs(wernerComposite(mu, F) - mu) < 1e-12, `g(mu,F)=mu at F=${F}`);
    }
  });

  it("μ(0.85) = 0.9093646522… — the exact value behind policies' ≈0.909 no-op wall", () => {
    ok(Math.abs(freshMixFixedPoint(0.85) - 0.909364652204) < 5e-12);
  });

  it("μ(F) > F ⟺ F > 1/2 and μ is increasing in F", () => {
    ok(
      Math.abs(freshMixFixedPoint(0.5 + 1e-9) - 0.5) < 1e-8,
      "separating fixed point at 1/2 (one-sided limit)",
    );
    for (const F of F_GRID) ok(freshMixFixedPoint(F) > F, `mu>F at ${F}`);
    for (let i = 1; i < F_GRID.length; i++) {
      ok(
        freshMixFixedPoint(F_GRID[i]!) > freshMixFixedPoint(F_GRID[i - 1]!),
        "monotone in F",
      );
    }
  });
});

describe("E7 L3: nested saturation ladder S_{s+1} = μ(S_s) and the phase boundary", () => {
  it("closed-form recursion vs champion-against-supply simulation agree to 1e-12", () => {
    for (const slots of [2, 3, 4, 5]) {
      const closed = saturationLadder(0.85, slots);
      const sim = saturationLadderSim(0.85, slots);
      ok(
        Math.abs((closed[slots - 1] as number) - sim) < 1e-12,
        `slots=${slots}`,
      );
    }
  });

  it("S_s is strictly increasing in s and in F₀", () => {
    const sat = saturationLadder(0.85, 8);
    for (let s = 1; s < 8; s++)
      ok((sat[s] as number) > (sat[s - 1] as number), `s=${s}`);
    const wider = saturationLadder(0.9, 8);
    for (let s = 0; s < 8; s++)
      ok((wider[s] as number) > (sat[s] as number), `F0 lift at s=${s + 1}`);
  });

  it("exp4 special points: S_3(0.85)=0.949369 < 0.95 ≤ S_4(0.85)=0.973102 (slots floor 4)", () => {
    const sat = saturationLadder(0.85, 4);
    ok(Math.abs((sat[2] as number) - 0.949369369) < 5e-10, `S_3=${sat[2]}`);
    ok(Math.abs((sat[3] as number) - 0.973102126) < 5e-10, `S_4=${sat[3]}`);
    ok((sat[2] as number) < 0.95 && (sat[3] as number) >= 0.95);
    strictEqual(minSlotsForFmin(0.85, 0.95), 4);
  });

  it("exp4-D row F₀=0.8: S_2, S_3 < 0.95 ≤ S_4 (the grid's 下限 slots = 4 column)", () => {
    const sat = saturationLadder(0.8, 4);
    ok(
      (sat[1] as number) < 0.95 &&
        (sat[2] as number) < 0.95 &&
        (sat[3] as number) >= 0.95,
    );
    strictEqual(minSlotsForFmin(0.8, 0.95), 4);
  });

  it("phase boundary is bracketed with sign flip on both sides", () => {
    for (const slots of [2, 3, 4, 5]) {
      const { f0Star, below, above } = phaseBoundary(slots, 0.95, 1e-12);
      ok(below < 0, `below-side must miss fMin (slots=${slots})`);
      ok(above >= 0, `above-side must reach fMin (slots=${slots})`);
      const sat = saturationLadder(f0Star, slots);
      ok(
        Math.abs((sat[slots - 1] as number) - 0.95) < 1e-11,
        `S_${slots}(${f0Star})=0.95`,
      );
    }
  });

  it("boundary monotonicity: fMin ↑ ⇒ F₀* ↑ (the hardware-demand curve)", () => {
    const prev = phaseBoundary(4, 0.93).f0Star;
    for (const fMin of [0.94, 0.95, 0.96, 0.97]) {
      const next = phaseBoundary(4, fMin).f0Star;
      ok(next > prev, `fMin=${fMin}`);
    }
  });

  it("fMin = 1 is unreachable (μ(F) < 1 strictly) — named rejection", () => {
    throws(
      () => phaseBoundary(4, 1.0),
      (err: unknown) => isCodedError(err) && err.code === "LADDER_FMIN_RANGE",
    );
    throws(
      () => minSlotsForFmin(0.85, 0.95, 2), // S_2(0.85) = 0.9094 < 0.95 even at the cap
      (err: unknown) =>
        isCodedError(err) && err.code === "LADDER_FMIN_UNREACHABLE",
    );
  });

  it("domain guards reject by name", () => {
    throws(
      () => saturationLadder(0.5, 3),
      (err: unknown) => isCodedError(err) && err.code === "LADDER_F_RANGE",
    );
    throws(
      () => saturationLadder(0.85, 0),
      (err: unknown) => isCodedError(err) && err.code === "LADDER_SLOTS_RANGE",
    );
  });
});

describe("E7 L4: one-shot balanced batch ladder (the 2^k ladder)", () => {
  it("B_k recursion and the 2⁴-leaf requirement at F₀ = 0.84 (exp4-A's ladder)", () => {
    const b = balancedLadder(0.84, 5);
    ok((b[3] as number) < 0.95, `B_3=${b[3]} misses`);
    ok((b[4] as number) >= 0.95, `B_4=${b[4]} reaches`);
    strictEqual(batchLeavesToReach(0.84, 0.95), 16);
  });

  it("F₀ = 0.85 also needs the 2⁴ batch (16 leaves) for fMin = 0.95", () => {
    strictEqual(batchLeavesToReach(0.85, 0.95), 16);
  });
});

describe("E7 engine cross-check: deliverability follows the closed-form wall", () => {
  const FMIN = 0.95;
  const ROUNDS = 30_000;

  function run(
    F0: number,
    slots: number,
    seed: number,
  ): { good: number; meanFidelity: number } {
    const net: NetSpec = {
      nodes: ["A", "B"],
      links: [{ id: "l", a: "A", b: "B", p: 0.9, slots, f0: F0 }],
      qSwap: 0.9,
    };
    const reqs: RequestSpec[] = [{ id: "r", src: "A", dst: "B", fMin: FMIN }];
    const rep = runSim({
      net,
      requests: reqs,
      policy: ersPolicy(new Topology(net), reqs),
      seed,
      rounds: ROUNDS,
    });
    const r = rep.perRequest["r"]!; // request "r" is in every report by construction
    return { good: r.good, meanFidelity: r.meanFidelity };
  }

  it("cells with S_slots ≥ fMin deliver; cells with S_slots < fMin deliver exactly zero", () => {
    // (F₀, slots, expectDeliverable) — chosen off the ±0.005 ambiguity band of the wall
    const cells: Array<[number, number, boolean]> = [
      [0.85, 2, false], // S_2 = 0.9094 < 0.95
      [0.85, 4, true], // S_4 = 0.9731 ≥ 0.95
      [0.88, 2, false], // S_2 = 0.9242 < 0.95
      [0.88, 3, true], // S_3 = 0.9602 ≥ 0.95
    ];
    for (const [f0, slots, deliverable] of cells) {
      const sat = saturationLadder(f0, slots);
      const wall = sat[slots - 1] as number;
      let good = 0;
      let meanF = 0;
      for (const seed of [21, 22, 23]) {
        const res = run(f0, slots, seed);
        good += res.good;
        meanF = Math.max(meanF, res.meanFidelity);
      }
      if (deliverable) {
        ok(
          good > 0,
          `F₀=${f0} slots=${slots}: wall=${wall.toFixed(4)} ≥ fMin but engine delivered ${good}`,
        );
        ok(
          meanF >= 0.9,
          `delivered fidelity should clear fMin − margin, got ${meanF}`,
        );
      } else {
        strictEqual(
          good,
          0,
          `F₀=${f0} slots=${slots}: wall=${wall.toFixed(4)} < fMin but engine delivered ${good}`,
        );
      }
    }
  });

  it("NEGATIVE CONTROL (a): the s−1-slot bypass claim is convicted — S_3(0.85) < fMin and the engine delivers zero at slots=3", () => {
    const sat = saturationLadder(0.85, 4);
    ok(
      (sat[2] as number) < FMIN,
      "S_3(0.85) must sit below fMin for the conviction to bind",
    );
    let good = 0;
    for (const seed of [31, 32, 33]) good += run(0.85, 3, seed).good;
    strictEqual(good, 0, "scheduling cannot route around the hardware wall");
  });

  it("NEGATIVE CONTROL (b): a forged boundary value fails the sign-flip trial", () => {
    // claim: F₀* = 0.75 for (slots=4, fMin=0.95). The true boundary lies elsewhere;
    // a ±0.01 neighborhood of 0.75 stays on one side (no flip ⇒ not a boundary).
    const forged = 0.75;
    const low = saturationLadder(forged - 0.01, 4);
    const high = saturationLadder(forged + 0.01, 4);
    const dLow = (low[3] as number) - FMIN;
    const dHigh = (high[3] as number) - FMIN;
    ok(
      dLow < 0 && dHigh < 0,
      "no sign flip around the forged value — convicted",
    );
    const truth = phaseBoundary(4, FMIN).f0Star;
    ok(
      Math.abs(truth - forged) > 0.01,
      `true boundary ${truth.toFixed(6)} is far from the forged 0.75`,
    );
  });
});
