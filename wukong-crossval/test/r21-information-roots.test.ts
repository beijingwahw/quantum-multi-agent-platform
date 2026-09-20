import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkChernoffTable, checkRootCensus } from "../src/kernel/audit.js";
import { CHERNOFF_DELTA, chernoffInformation, chernoffRow, CHERNOFF_ZERO, MC_CHERNOFF_DEMO, mcChernoffDemo, minShotsInformation, readoutShellDist, depolShellDist } from "../src/kernel/chernoff.js";
import { fitRootCensus, powerToBernstein, readoutRatePoly, rootCensus, ROOT_WIDTH } from "../src/kernel/roots.js";
import { exactObservedHitRate } from "../src/kernel/robust.js";
import { exactProbe } from "../src/kernel/probe.js";
import { instanceSet, type Instance } from "../src/kernel/crossval.js";
import { DISC_PROBE_IDS } from "../src/kernel/discriminate.js";
import { XvalError } from "../src/kernel/error.js";

let probeMemo: Instance | undefined;
function probe8(): Instance {
  probeMemo ??= instanceSet().find((i) => i.id === "np-n8-0");
  assert.ok(probeMemo, "np-n8-0 exists");
  return probeMemo;
}
function evalPower(a: readonly number[], x: number): number {
  let v = 0;
  for (let k = a.length - 1; k >= 0; k--) v = v * x + a[k]!;
  return v;
}

describe("T12 the information bound (X9's arithmetic)", () => {
  it("the Chernoff information matches the hand value ln 2 and is symmetric, and a coincident pair carries none", () => {
    // hand: P = (1/2, 1/2) vs Q = (1, 0) gives sum_i p^s q^{1-s} = (1/2)^s,
    // minimized at s -> 1: C = -log(1/2) = ln 2 exactly
    const p = new Float64Array([0.5, 0.5]);
    const q = new Float64Array([1, 0]);
    const { info, sStar } = chernoffInformation(p, q);
    assert.ok(Math.abs(info - Math.LN2) < 1e-9, `C(P,Q) = ${String(info)} vs ln 2 = ${String(Math.LN2)}`);
    assert.ok(sStar > 0.99, "the minimizer sits at the s=1 end for this pair");
    // symmetry: C(P,Q) = C(Q,P) exactly (s -> 1-s)
    const rev = chernoffInformation(q, p);
    assert.ok(Math.abs(rev.info - info) < 1e-12, "Chernoff information is symmetric");
    // a coincident pair carries no information at all
    const self = chernoffInformation(p, p);
    assert.ok(self.info <= CHERNOFF_ZERO, "C(P,P) = 0");
  });

  it("minShotsInformation rejects a coincident pair by name and prices the floor exactly", () => {
    assert.throws(() => minShotsInformation(0, 0.05), (e: unknown) => e instanceof XvalError && e.code === "XVAL_CHERNOFF_DEGENERATE");
    assert.throws(() => minShotsInformation(1e-15, 0.05), (e: unknown) => e instanceof XvalError && e.code === "XVAL_CHERNOFF_DEGENERATE");
    assert.throws(() => minShotsInformation(0.1, 0), (e: unknown) => e instanceof XvalError && e.code === "XVAL_MINSHOTS_LEVEL");
    // hand: C = ln 2, delta = 0.05 -> N = ceil(ln 40 / ln 2) = ceil(5.32) = 6
    assert.equal(minShotsInformation(Math.LN2, 0.05), 6);
  });

  it("the X9 table is clean, a counterfeit Chernoff column is named, and the optimal discriminator sits at or above the floor", () => {
    const rows = [];
    for (const id of DISC_PROBE_IDS) {
      const inst = instanceSet().find((i) => i.id === id);
      assert.ok(inst);
      const masses = exactProbe(inst, 1).masses;
      const meta = { instanceId: inst.id, n: inst.n, depth: 1 };
      for (const flip of [0.01, 0.02, 0.05]) rows.push(chernoffRow(masses, meta, flip, CHERNOFF_DELTA));
    }
    assert.deepEqual(checkChernoffTable(rows), []);
    // the n=8 inflation point is sign-separated outright: no bound columns, as found
    const n8 = rows.find((r) => r.instanceId === "np-n8-0" && r.flip === 0.02);
    assert.ok(n8 && !n8.depolPhysical && n8.chernoff === null && n8.nInfo === null && n8.nTwoSigma === null && n8.efficiency === null);
    // every physical row carries finite bound columns and a positive efficiency
    for (const r of rows) {
      if (!r.depolPhysical) continue;
      assert.ok(r.chernoff !== null && r.chernoff > 0 && Number.isFinite(r.chernoff), "physical rows carry a positive Chernoff information");
      assert.ok(r.nInfo !== null && r.nInfo >= 1 && r.nTwoSigma !== null && r.nTwoSigma >= 1 && r.efficiency !== null && r.efficiency > 0);
    }
    // counterfeit trial: a doubled Chernoff column is named and rejected
    const counterfeit = rows.map((r) => (r.chernoff === null ? r : { ...r, chernoff: r.chernoff * 2 }));
    const hit = checkChernoffTable(counterfeit).find((v) => v.law === "X9" && v.detail.includes("counterfeit chernoff"));
    assert.ok(hit, "the counterfeit Chernoff column is named");
    // MC under either truth: the LIKELIHOOD-RATIO discriminator's empirical
    // error must sit at or above the floor (1/2)e^{-NC} within MC fluctuation
    const demo = MC_CHERNOFF_DEMO;
    const inst = instanceSet().find((i) => i.id === demo.probeId);
    assert.ok(inst);
    const masses = exactProbe(inst, demo.depth).masses;
    const row = chernoffRow(masses, { instanceId: inst.id, n: inst.n, depth: demo.depth }, demo.flip, CHERNOFF_DELTA);
    assert.ok(row.depolPhysical && row.fitFlip !== null, "the demo operating point is physical");
    const p = readoutShellDist(masses, row.fitFlip);
    const q = depolShellDist(masses, row.fitLambda);
    const mc = mcChernoffDemo(p, q, demo.shotsPerTrial, demo.trials, demo.seed);
    assert.ok(mc.empiricalError + 5 * mc.sigma >= mc.bound, `MC error ${String(mc.empiricalError)} fell below the floor ${String(mc.bound)} by more than 5 sigma — the theorem would be falsified`);
  });
});

describe("T13 the readout-fit root census (X8's boundary, fully mapped)", () => {
  it("the observed rate is an exact degree-<=n polynomial in lambda = 1-2f, anchored at both ends", () => {
    const inst = probe8();
    const masses = exactProbe(inst, 1).masses;
    const a = readoutRatePoly(masses);
    assert.ok(Math.abs(evalPower(a, 1) - (masses[0] as number)) < 1e-15, "poly(1) = |psi_opt|^2 (f = 0)");
    assert.ok(Math.abs(evalPower(a, 0) - 1 / 2 ** inst.n) < 1e-15, "poly(0) = 2^-n (f = 1/2)");
    // identity against the shell kernel's own convolution, on a dense grid
    for (let j = 0; j <= 64; j++) {
      const lam = j / 64;
      const viaPoly = evalPower(a, lam);
      const viaKernel = exactObservedHitRate(masses, (1 - lam) / 2);
      assert.ok(Math.abs(viaPoly - viaKernel) < 1e-14, `lambda=${String(lam)}: ${String(viaPoly)} vs ${String(viaKernel)}`);
    }
    // Bernstein endpoint interpolation: c_0 = poly(0), c_n = poly(1)
    const c = powerToBernstein(a);
    assert.ok(Math.abs(c[0]! - evalPower(a, 0)) < 1e-15 && Math.abs(c[c.length - 1]! - evalPower(a, 1)) < 1e-15);
  });

  it("the n=2 census is hand-checkable: masses [1,0,0], target 0.81 -> exactly f = 0.1", () => {
    // hand: r(lambda) = (1/4)(1+lambda)^2; 0.81 = (0.9)^2 -> 1+lambda = 1.8 -> lambda = 0.8 -> f = 0.1
    const masses = new Float64Array([1, 0, 0]);
    const c = rootCensus(masses, 0.81);
    assert.equal(c.roots.length, 1);
    assert.ok(Math.abs(c.roots[0]!.fMid - 0.1) < 1e-7, `root f* = ${String(c.roots[0]!.fMid)} vs hand value 0.1`);
    assert.ok(c.roots[0]!.width <= ROOT_WIDTH && c.roots[0]!.certified);
    assert.ok(c.twoPathsAgree && c.bernsteinTotal === 1 && c.signFlipTotal === 1);
    assert.deepEqual(c.hiddenRoots, []);
    assert.deepEqual(c.boundaryRoots, []);
  });

  it("the n=8 probe's global second root near 0.368 is theorem-predicted, and every root in (0,1/2) is enrolled", () => {
    const inst = probe8();
    const masses = exactProbe(inst, 1).masses;
    const row = fitRootCensus(masses, { instanceId: inst.id, n: inst.n, depth: 1 }, 0.02);
    assert.ok(row.statedRootEnrolled, "the stated operating point f=0.02 is itself an enrolled root");
    assert.ok(row.twoPathsAgree, "the two root-counting paths agree root for root");
    assert.ok(row.roots.length >= 2, `the fit equation has the stated root AND at least one more (found ${String(row.roots.length)})`);
    const second = row.roots.find((r) => Math.abs(r.fMid - 0.02) > 1e-3);
    assert.ok(second, "a root away from the stated operating point exists");
    assert.ok(second.fMid > 0.35 && second.fMid < 0.39, `the global second root sits near the disclosed 0.368 (found ${String(second.fMid)})`);
    for (const r of row.roots) {
      assert.ok(r.width <= ROOT_WIDTH, "every root isolated to width <= 1e-9");
      assert.ok(r.certified, "every enrolled root carries the one-sign-change Bernstein certificate");
      assert.ok(Math.abs(exactObservedHitRate(masses, r.fMid) - row.target) < 1e-9, "every enrolled root is a true root of its own equation");
      assert.ok(r.fLow > 0 && r.fHi < 0.5, "the census enrolls only the open interval (0, 1/2)");
    }
    assert.deepEqual(row.hiddenRoots, []);
  });

  it("a constant rate is rejected by name and an unreachable target ships an honest empty census", () => {
    // uniform-state masses: r is identically 1/4 — every f solves it, rejected by name
    assert.throws(
      () => rootCensus(new Float64Array([0.25, 0.5, 0.25]), 0.25),
      (e: unknown) => e instanceof XvalError && e.code === "XVAL_ROOTS_DEGENERATE",
    );
    // target 2 is above the whole rate range: zero roots, zero flips, and the two
    // vacuously-agreeing paths still agree — an honest empty census, not an error
    const empty = rootCensus(new Float64Array([1, 0, 0]), 2);
    assert.deepEqual(empty.roots, []);
    assert.equal(empty.signFlipTotal, 0);
    assert.ok(empty.twoPathsAgree);
  });

  it("the root-census table is clean and a displaced root is named and rejected", () => {
    const rows = [];
    for (const id of DISC_PROBE_IDS) {
      const inst = instanceSet().find((i) => i.id === id);
      assert.ok(inst);
      const masses = exactProbe(inst, 1).masses;
      const meta = { instanceId: inst.id, n: inst.n, depth: 1 };
      for (const flip of [0.01, 0.02, 0.05]) rows.push(fitRootCensus(masses, meta, flip));
    }
    assert.deepEqual(checkRootCensus(rows), []);
    assert.ok(rows.every((r) => r.twoPathsAgree), "every shipped census row's two paths agree");
    // counterfeit trials: a displaced root and an inflated count are both named
    const displaced = rows.map((r) => (r.roots.length === 0 ? r : { ...r, roots: r.roots.map((x, i) => (i === 0 ? { ...x, fMid: x.fMid + 0.01 } : x)) }));
    const hitRoot = checkRootCensus(displaced).find((v) => v.law === "X8" && v.detail.includes("counterfeit root:"));
    assert.ok(hitRoot, "the displaced root is named");
    const inflated = rows.map((r) => ({ ...r, rootCount: r.rootCount + 1 }));
    const hitCount = checkRootCensus(inflated).find((v) => v.law === "X8" && v.detail.includes("counterfeit root count"));
    assert.ok(hitCount, "the inflated count is named");
  });
});
