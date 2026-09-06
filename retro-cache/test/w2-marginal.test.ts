import test from "node:test";
import assert from "node:assert/strict";
import { cmatZero, hsDistance, jointTable, mutualInfoBits, reduceB, Rng, wernerPair } from "../src/kernel/state.js";
import { cptpOnB, randomUnitary2, unitaryOnA } from "../src/kernel/tariff.js";

function bMarginal(rho: ReturnType<typeof wernerPair>, a: readonly number[], b: readonly number[]): number {
  const t = jointTable(rho, a, b);
  return (t[0][0]) + (t[1][0]);
}

test("W2.A I(B answer; A question) = 0: uniform under every setting, every visibility", () => {
  const rng = new Rng(777);
  for (const p of [1, 0.9, 0.5]) {
    const rho = wernerPair(p);
    for (let i = 0; i < 12; i++) {
      const a = rng.axis();
      const b = rng.axis();
      assert.ok(Math.abs(bMarginal(rho, a, b) - 0.5) < 1e-15, `p=${p}: settings-grid marginal`);
    }
  }
});

test("W2.B A-side unitaries leave B's row untouched while the joint moves", () => {
  const rho = wernerPair(1);
  const rng = new Rng(777);
  for (let i = 0; i < 6; i++) {
    const mapped = unitaryOnA(rho, randomUnitary2(rng));
    assert.ok(Math.abs(bMarginal(mapped, rng.axis(), rng.axis()) - 0.5) < 1e-14, "B marginal after A-unitary");
    assert.ok(hsDistance(mapped, rho) > 1e-3, "joint state visibly moves");
  }
  const half = (() => {
    const m = cmatZero(2);
    m.re[0]![0] = 0.5;
    m.re[1]![1] = 0.5;
    return m;
  })();
  assert.ok(hsDistance(wernerPair(1), wernerPair(1)) < 1e-15);
  const rb = hsDistance(reduceB(rho), half);
  assert.ok(rb < 1e-15, `B reduced = I/2 exactly (got ${rb})`);
});

test("W2.C B-side CPTP: self-bias allowed, A-dependence exactly zero", () => {
  const rho = wernerPair(1);
  const rng = new Rng(777);
  rng.axis(); // burn one draw to align with the experiment's stream
  for (let i = 0; i < 6; i++) {
    const mapped = cptpOnB(rho, rng);
    const b = rng.axis();
    const a1 = rng.axis();
    const a2 = rng.axis();
    const p1 = bMarginal(mapped, a1, b);
    const p2 = bMarginal(mapped, a2, b);
    assert.ok(Math.abs(p1 - p2) < 1e-14, "no A-dependence after B-side maps");
    assert.ok(p1 >= 0 && p1 <= 1);
  }
});

test("W2.D the bit is real and lives in the |a.b| alignment", () => {
  const rho = wernerPair(1);
  const z = [0, 0, 1];
  const t = jointTable(rho, z, z);
  assert.ok(Math.abs(mutualInfoBits(t) - 1) < 1e-14, `aligned MI = 1 bit (got ${mutualInfoBits(t)})`);
  const x = [1, 0, 0];
  const t2 = jointTable(rho, z, x);
  assert.ok(mutualInfoBits(t2) < 1e-14, "perpendicular axes: outcomes uncorrelated, MI = 0 — the bit lives in the alignment, never in B's row alone");
});
