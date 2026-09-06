import test from "node:test";
import assert from "node:assert/strict";
import { chshStandard, jointTable, tvDistance, wernerPair } from "../src/kernel/state.js";
import { classicalCensus } from "../src/kernel/tariff.js";

test("W3.A pre-arrival: quantum B-answer = uniform seed bit, TV = 0", () => {
  const rho = wernerPair(1);
  const axes: number[][] = [
    [0, 0, 1],
    [1, 0, 0],
    [0.6, 0.64, 0.48],
    [Math.SQRT1_2, Math.SQRT1_2, 0],
  ];
  let worst = 0;
  for (const a of axes)
    for (const b of axes) {
      const t = jointTable(rho, a, b);
      const py: number[] = [(t[0][0]) + (t[1][0]), (t[0][1]) + (t[1][1])];
      worst = Math.max(worst, tvDistance(py, [0.5, 0.5]));
    }
  assert.ok(worst < 1e-15, `TV ${worst}`);
});

test("W3.B the classical census: all 256 shared-randomness strategies cap at exactly 2", () => {
  const c = classicalCensus();
  assert.equal(c.strategies, 256);
  assert.ok(Math.abs(c.maxAbsS - 2) < 1e-12, `census max ${c.maxAbsS}`);
});

test("W3.C the singlet's surplus: 2*sqrt(2) > the entire classical census", () => {
  const s = Math.abs(chshStandard(wernerPair(1)));
  const c = classicalCensus();
  assert.ok(Math.abs(s - 2 * Math.SQRT2) < 1e-14);
  assert.ok(s > c.maxAbsS + 0.8, "surplus lives in the joint column");
});
