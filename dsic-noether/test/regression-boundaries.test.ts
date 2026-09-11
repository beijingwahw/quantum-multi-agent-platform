import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simpleCycles, cycleScan } from "../src/core/cycles.js";
import { Rng } from "../src/core/rng.js";
import { KernelError } from "../src/core/errors.js";
import { bestAllocation } from "../src/mech/instance.js";
import { buildWorld } from "../src/mech/world.js";
import { allocationAt, welfareGap } from "../src/mech/groves.js";
import { ruleAllocation } from "../src/mech/rochet.js";
import * as gl from "../src/continuum/green-laffont.js";
import {
  chargeJ,
  closednessComputed,
  delStep,
  discreteLagrangian,
  trajectory,
  type Quad,
  type Vec2,
} from "../src/physics/variational.js";

/** Run `fn`, expect a KernelError, return its code — the conviction is by name. */
function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof KernelError, `expected a KernelError, got ${String(e)}`);
    return e.code;
  }
  assert.fail("expected a KernelError, got a return value");
}

describe("regression: named refusals on degenerate and out-of-domain input (no silent NaN/garbage)", () => {
  it("simpleCycles refuses K=0/negative/fractional by name — cycleScan(0) used to report max=-Infinity as 'exact'", () => {
    // probes of the old behavior: simpleCycles(0) silently returned [] (so
    // cycleScan read max = -Infinity <= 0, an "implementable" verdict on no
    // nodes at all), while simpleCycles(-3)/simpleCycles(1.5) crashed unnamed
    // inside Array — even though K = 8 is refused BY NAME
    assert.equal(code(() => simpleCycles(0)), "cycles/k-invalid");
    assert.equal(code(() => simpleCycles(-3)), "cycles/k-invalid");
    assert.equal(code(() => simpleCycles(1.5)), "cycles/k-invalid");
    // legal neighbors: the canonical counts and the exact-form scan unchanged
    assert.equal(simpleCycles(3).length, 5);
    assert.equal(simpleCycles(4).length, 20);
    assert.equal(cycleScan(4, (a, b) => (a - b) * 7).max, 0);
  });

  it("the variational integrator refuses h <= 0 / non-finite by name instead of returning NaN (variational/step-range)", () => {
    const q: Vec2 = { x: 1, y: 0 };
    const iso: Quad = { ax: 1, ay: 1 };
    // probes of the old behavior: discreteLagrangian(q, q, 0) returned 0/0 =
    // NaN and trajectory(h=0) returned a NaN cascade with the shape of a
    // certificate (residual NaN, points null)
    for (const h of [0, -0.05, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(code(() => discreteLagrangian(q, q, h, iso)), "variational/step-range", `h=${h}`);
      assert.equal(code(() => delStep(q, q, h, iso)), "variational/step-range", `h=${h}`);
      assert.equal(code(() => trajectory(q, q, 3, h, iso)), "variational/step-range", `h=${h}`);
      assert.equal(code(() => chargeJ(q, q, h, iso)), "variational/step-range", `h=${h}`);
      assert.equal(code(() => closednessComputed(q, q, h, iso)), "variational/step-range", `h=${h}`);
    }
    // legal neighbors: bit-identical to the pre-guard values at h = 0.05
    const q1: Vec2 = { x: Math.cos(0.05), y: Math.sin(0.05) };
    const stp = delStep(q, q1, 0.05, iso);
    assert.equal(stp.qPlus.x, 0.99500520471149423);
    assert.equal(stp.qPlus.y, 0.099833468661854663);
    assert.equal(stp.residual, 3.3349168893869769e-15);
    assert.equal(discreteLagrangian({ x: 0.3, y: -0.7 }, { x: -0.2, y: 0.5 }, 0.05, iso), 16.899687499999999);
    assert.equal(chargeJ(q, q1, 0.05, iso), -1.0002081250294501);
    assert.equal(closednessComputed(q, q1, 0.05, { ax: 1, ay: 4 }), -0.0037460954097783272);
    const t = trajectory(q, q1, 10, 0.05, iso);
    assert.equal(t.maxResidual, 3.4517810887050005e-15);
    assert.equal(t.maxJDrift, 1.1102230246251565e-15);
    assert.equal(t.j0, -1.0002081250294501);
  });

  it("Rng.int / intInclusive refuse empty and non-integer ranges by name; the seeded stream is untouched", () => {
    // probes of the old behavior: int(0) silently returned 0 (an impossible
    // draw from [0,0)), int(-2) returned -1, int(2.5) skewed the floor;
    // intInclusive(5, 3) returned values below lo
    assert.equal(code(() => new Rng(7).int(0)), "rng/int-range");
    assert.equal(code(() => new Rng(7).int(-2)), "rng/int-range");
    assert.equal(code(() => new Rng(7).int(2.5)), "rng/int-range");
    assert.equal(code(() => new Rng(7).intInclusive(5, 3)), "rng/int-inclusive-range");
    assert.equal(code(() => new Rng(7).intInclusive(0.5, 2)), "rng/int-inclusive-range");
    // legal neighbors: the frozen seed-101 stream, bit-for-bit, on all three
    // entry points (a refusal draws nothing, so legal draws never move)
    const r = new Rng(101);
    assert.deepEqual([r.next(), r.next(), r.next()], [0.1356478596571833, 0.764801949961111, 0.5406083094421774]);
    const ri = new Rng(101);
    assert.deepEqual([ri.int(7), ri.int(7), ri.int(7), ri.int(7), ri.int(7)], [0, 5, 3, 4, 2]);
    const rj = new Rng(101);
    assert.deepEqual([rj.intInclusive(1, 60), rj.intInclusive(1, 60), rj.intInclusive(1, 60), rj.intInclusive(1, 60), rj.intInclusive(1, 60)], [9, 46, 33, 39, 24]);
    assert.equal(new Rng(101).int(1), 0); // the one-element range [0,1) is legal
    assert.equal(new Rng(101).intInclusive(3, 3), 3); // the single-point range is legal
  });

  it("bestAllocation refuses degenerate shapes by name — more agents than items used to return welfare -Infinity silently", () => {
    // probes of the old behavior: 3 agents into 2 items enumerated nothing
    // and returned {alloc: [], welfare: -Infinity} looking like a result;
    // empty values and off-row agent indices crashed as opaque TypeErrors;
    // a ragged row accumulated NaN welfare
    assert.equal(code(() => bestAllocation([], [])), "instance/alloc-shape");
    assert.equal(code(() => bestAllocation([[7, 9]], [0, 1])), "instance/alloc-shape");
    assert.equal(code(() => bestAllocation([[7, 9], [4]], [0, 1])), "instance/alloc-shape");
    assert.equal(code(() => bestAllocation([[7, 9], [4, 6]], [0, 1, 2])), "instance/alloc-shape");
    // legal neighbor: the pinned 3x3 instance, exact
    const res = bestAllocation([[7, 9, 5], [4, 6, 8], [8, 3, 2]], [0, 1, 2]);
    assert.deepEqual([...res.alloc], [1, 2, 0]);
    assert.equal(res.welfare, 25);
    assert.equal(res.runnerUp, 19);
    assert.deepEqual([...res.allocRunnerUp], [2, 1, 0]);
  });

  it("allocationAt and ruleAllocation refuse out-of-range report indices by name (formerly opaque TypeErrors)", () => {
    const w = buildWorld(new Rng(208), 3, 1, 5);
    // probes of the old behavior: reports[99] is undefined and profileOf's
    // spread of undefined crashed as "undefined is not iterable" from deep
    // inside the kernel — on the greedy/anti-efficient paths too
    assert.equal(code(() => allocationAt(w, 99)), "groves/report-index-range");
    assert.equal(code(() => allocationAt(w, -1)), "groves/report-index-range");
    assert.equal(code(() => ruleAllocation({ ...w, rule: "greedy" }, 99)), "groves/report-index-range");
    assert.equal(code(() => ruleAllocation({ ...w, rule: "anti-efficient" }, 5)), "groves/report-index-range");
    // legal neighbors: the seeded world's pinned values, unchanged
    const a0 = allocationAt(w, 0);
    assert.deepEqual([...a0.alloc], [2, 1, 0]);
    assert.equal(a0.welfare, 140);
    assert.equal(welfareGap(w, 3), -47);
    assert.equal(ruleAllocation({ ...w, rule: "greedy" }, 2).join(","), "1,2,0");
  });

  it("diamondSideSimpson refuses n = 0/odd/fractional by name — n = 0 used to return Infinity, odd n the wrong quadrature", () => {
    // probes of the old behavior: n = 0 made h = Infinity (2*Infinity/3);
    // odd n silently applied the 4-2-4 weights to an unsymmetric panel
    assert.equal(code(() => gl.diamondSideSimpson(0)), "diamond/simpson-n");
    assert.equal(code(() => gl.diamondSideSimpson(1)), "diamond/simpson-n");
    assert.equal(code(() => gl.diamondSideSimpson(4000.5)), "diamond/simpson-n");
    // legal neighbors: the K3 numeric cross-check value, bit-identical
    assert.equal(gl.diamondSideSimpson(4000), 1.5707963267949043);
    assert.equal(gl.diamondSideSimpson(2), 5 / 3); // the honest 2-panel value
  });
});
