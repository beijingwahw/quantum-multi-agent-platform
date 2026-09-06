import test from "node:test";
import assert from "node:assert/strict";
import {
  chshStandard,
  correlationFromTable,
  jointTable,
  phasePair,
  Rng,
  wernerCorrelation,
  wernerPair,
} from "../src/kernel/state.js";

test("W1.A Werner joint tables: matrix path = closed form across axes and visibilities", () => {
  const rng = new Rng(20260906);
  for (const p of [1, 0.9, 0.5, 0.25]) {
    const rho = wernerPair(p);
    for (let i = 0; i < 8; i++) {
      const a = rng.axis();
      const b = rng.axis();
      const e = correlationFromTable(jointTable(rho, a, b));
      const closed = wernerCorrelation(p, a, b);
      assert.ok(Math.abs(e - closed) < 1e-14, `p=${p}: E dev ${Math.abs(e - closed)}`);
      // marginal uniformity of every table
      const t = jointTable(rho, a, b);
      const py0 = (t[0][0]) + (t[1][0]);
      assert.ok(Math.abs(py0 - 0.5) < 1e-15, `p=${p}: B marginal`);
    }
  }
});

test("W1.B CHSH rides the Tsirelson line 2*sqrt(2)*p", () => {
  for (const p of [1, 0.9, 0.75, 0.5, 0.25]) {
    const s = Math.abs(chshStandard(wernerPair(p)));
    const closed = 2 * Math.SQRT2 * p;
    assert.ok(Math.abs(s - closed) < 1e-14, `p=${p}: S=${s} vs ${closed}`);
  }
});

test("W1.C complex-anchor family: full correlation tensor, conjugation-sensitive", () => {
  // E(a,b) = cos(th)(ax bx - ay by) + az bz + sin(th)(ax by + ay bx)
  // (T_zz = +1 — the diagonal the phase cannot touch; T_xy = T_yx = sin(th) —
  //  the off-diagonals that carry it. An earlier draft dropped both and the
  //  referee flagged the 0.1872 = az*bz residual at theta = 0.)
  const a = [0.6, 0.64, 0.48];
  const b = [-0.2, 0.9, 0.39];
  for (const theta of [0, Math.PI / 4, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3]) {
    const e = correlationFromTable(jointTable(phasePair(theta), a, b));
    const closed =
      Math.cos(theta) * (a[0]! * b[0]! - a[1]! * b[1]!) +
      a[2]! * b[2]! +
      Math.sin(theta) * (a[0]! * b[1]! + a[1]! * b[0]!);
    assert.ok(Math.abs(e - closed) < 1e-14, `theta=${theta}: E dev ${Math.abs(e - closed)}`);
  }
});
