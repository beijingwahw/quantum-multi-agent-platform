import test from "node:test";
import assert from "node:assert/strict";
import { cmatZero, hsDistance, jointTable, mutualInfoBits, reduceB, Rng, wernerPair, type CMat } from "../src/kernel/state.js";
import { cptpOnB, postprocessOutcome, randomUnitary2, unitaryOnA } from "../src/kernel/tariff.js";

function bMarginal(rho: CMat, a: readonly number[], b: readonly number[]): number {
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

test("W2.E classical postprocessing on B's column: the tariff holds (the description's third map family, wired)", () => {
  // the package description prices the marginal tariff under "any local map
  // (random unitary, Stinespring CPTP, classical postprocessing)" — this leg
  // executes that third family on exact tables (it previously had no machine
  // behind it: postprocessOutcome was exported and never called).
  const rho = wernerPair(1);
  const rng = new Rng(4242);
  const tables: Array<[[number, number], [number, number]]> = [];
  for (let i = 0; i < 6; i++) tables.push(jointTable(rho, rng.axis(), rng.axis()));
  // (i) a doubly stochastic map keeps B's row exactly (1/2, 1/2)
  const flip: readonly [readonly number[], readonly number[]] = [[0, 1], [1, 0]];
  const identity: readonly [readonly number[], readonly number[]] = [[1, 0], [0, 1]];
  for (const t of tables)
    for (const m of [flip, identity]) {
      const out = postprocessOutcome(t, m);
      assert.ok(Math.abs(out[0]![0]! + out[1]![0]! - 0.5) < 1e-15, "doubly stochastic: B marginal exactly 1/2");
    }
  // (ii) a merely stochastic map may tilt B's own coin (the W2.C split), but
  // injects ZERO A-dependence: the y'-column is the same under every A-side
  // table that shares B's axis
  const tilted: readonly [readonly number[], readonly number[]] = [[1, 0], [0.5, 0.5]];
  const bFixed = [0.6, 0.64, 0.48]; // |b|^2 = 0.36+0.4096+0.2304 = 1 exactly
  const aVariants = [
    [0, 0, 1],
    [1, 0, 0],
    [Math.SQRT1_2, Math.SQRT1_2, 0],
    [Math.SQRT1_2, -Math.SQRT1_2, 0],
  ];
  // the OBJECT is B's y'-column marginal sum_x P(x, y') — the joint cells
  // carry A's correlation by design and must NOT be asserted flat
  const column = (t: ReadonlyArray<readonly number[]>): readonly number[] => [t[0]![0]! + t[1]![0]!, t[0]![1]! + t[1]![1]!];
  const ref = column(postprocessOutcome(jointTable(rho, aVariants[0]!, bFixed), tilted));
  for (const a of aVariants) {
    const out = column(postprocessOutcome(jointTable(rho, a, bFixed), tilted));
    assert.ok(Math.abs(out[0]! - ref[0]!) < 1e-14, "stochastic postprocess: no A-dependence in B's column");
    assert.ok(Math.abs(out[1]! - ref[1]!) < 1e-14, "stochastic postprocess: no A-dependence in B's column");
  }
  // (iii) data processing on the observed side cannot create information:
  // MI(A answer; postprocessed B) = 0 wherever the raw MI is 0
  const perp = postprocessOutcome(jointTable(rho, [0, 0, 1], [1, 0, 0]), tilted);
  assert.ok(mutualInfoBits(perp) < 1e-14, "postprocessing a zero-information column leaves zero information");
});
