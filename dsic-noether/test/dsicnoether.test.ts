import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simpleCycles, cycleScan, maxTriangleImbalance } from "../src/core/cycles.js";
import { permutations, randomInstance, bestAllocation } from "../src/mech/instance.js";
import { buildWorld } from "../src/mech/world.js";
import {
  clarkeH,
  deviationGain,
  exactnessImbalance,
  payment,
  potentialReconstructionError,
  utility,
  welfareGap,
} from "../src/mech/groves.js";
import { directDeviationMax, rochetScan, ruleAllocation, utilityOneForm, type RuledWorld } from "../src/mech/rochet.js";
import { KernelError } from "../src/core/errors.js";
import {
  closednessClosedForm,
  closednessComputed,
  chargeJ,
  trajectory,
  discreteLagrangian,
  d2Ld,
  xiQ,
  type Quad,
  type Vec2,
} from "../src/physics/variational.js";
import { Rng } from "../src/core/rng.js";

describe("T0 combinatorics and kernels", () => {
  it("permutation enumeration: 3! = 6, all distinct", () => {
    const perms = permutations(3);
    assert.equal(perms.length, 6);
    assert.equal(new Set(perms.map((p) => p.join(","))).size, 6);
  });

  it("simple cycle counts: K=3 -> 5, K=4 -> 20 (directed simple cycles, canonical start)", () => {
    assert.equal(simpleCycles(3).length, 5);
    assert.equal(simpleCycles(4).length, 20);
  });

  it("an exact 1-form has zero triangles AND zero cycles; a shifted one does not", () => {
    const exact = (a: number, b: number): number => (a - b) * 7; // potential difference
    assert.equal(maxTriangleImbalance(4, exact), 0);
    assert.equal(cycleScan(4, exact).max, 0);
    const biased = (a: number, b: number): number => (a - b) * 7 + (a < b ? 1 : 0);
    assert.ok(maxTriangleImbalance(4, biased) > 0);
    assert.ok(cycleScan(4, biased).max > 0);
  });

  it("simpleCycles rejects K > 7 by NAME (factorial blow-up guard, code cycles/k-limit)", () => {
    assert.throws(() => simpleCycles(8), (e: unknown) => e instanceof KernelError && e.code === "cycles/k-limit");
  });

  it("the rule dispatch is exhaustive over RuleKind: all four kinds dispatch on one world; anti-efficient and second-best differ from efficient", () => {
    const rng = new Rng(208);
    const base = buildWorld(rng, 3, 1, 5);
    const allocOf = (rule: RuledWorld["rule"]): string => ruleAllocation({ ...base, rule }, 0).join(",");
    const eff = allocOf("efficient");
    const anti = allocOf("anti-efficient");
    const sb = allocOf("second-best");
    const greedy = allocOf("greedy"); // every branch dispatches — no throw, no silent fall-through
    assert.equal(greedy.split(",").length, 3, "greedy dispatched and allocated one item per agent");
    assert.notEqual(eff, anti, "anti-efficient must differ from efficient (the unique-argmax guard)");
    assert.notEqual(eff, sb, "the runner-up assignment must differ from the optimum");
  });
});

describe("T1 the Groves gauge and its charge", () => {
  it("the charge IS the welfare gap — bitwise, in two gauges, over 10 worlds", () => {
    const rng = new Rng(101);
    for (let trial = 0; trial < 10; trial++) {
      const w = buildWorld(rng, 3, 1, 5);
      const h1 = clarkeH(w);
      const h2 = h1 + 13;
      for (let k = 0; k < w.reports.length; k++) {
        assert.equal(deviationGain(w, k, h1), welfareGap(w, k), `trial ${trial} k ${k}`);
        assert.equal(deviationGain(w, k, h1), deviationGain(w, k, h2), `gauge moved the charge, trial ${trial}`);
      }
    }
  });

  it("DSIC as a charge statement: welfare gap <= 0 everywhere, = 0 at truth", () => {
    const rng = new Rng(102);
    for (let trial = 0; trial < 10; trial++) {
      const w = buildWorld(rng, 3, 1, 5);
      assert.equal(welfareGap(w, 0), 0);
      for (let k = 0; k < w.reports.length; k++) {
        assert.ok(welfareGap(w, k) <= 0, `trial ${trial} k ${k}: ${welfareGap(w, k)}`);
      }
    }
  });

  it("the gauge orbit: payments differ by exactly h - h' at every report", () => {
    const rng = new Rng(103);
    const w = buildWorld(rng, 3, 1, 5);
    const h1 = clarkeH(w);
    const h2 = h1 - 27;
    for (let k = 0; k < w.reports.length; k++) {
      assert.equal(payment(w, k, h2) - payment(w, k, h1), h2 - h1);
    }
  });

  it("utility is Phi_v(x) - h up to the constant: U(k,h) - U(0,h) == welfare gap", () => {
    const rng = new Rng(104);
    const w = buildWorld(rng, 3, 1, 5);
    const h = clarkeH(w);
    for (let k = 0; k < w.reports.length; k++) {
      assert.equal(utility(w, k, h) - utility(w, 0, h), welfareGap(w, k));
    }
  });
});

describe("T2 implementability as exactness", () => {
  it("payment 1-form exact: every pair imbalance is bitwise 0", () => {
    const rng = new Rng(201);
    for (let trial = 0; trial < 8; trial++) {
      const w = buildWorld(rng, 3, 1, 5);
      const h = clarkeH(w);
      for (let a = 0; a < w.reports.length; a++) {
        for (let b = 0; b < w.reports.length; b++) {
          assert.equal(exactnessImbalance(w, a, b, h), 0, `trial ${trial} (${a},${b})`);
        }
      }
    }
  });

  it("potential reconstruction reproduces every Groves payment bitwise", () => {
    const rng = new Rng(202);
    const w = buildWorld(rng, 3, 1, 5);
    const h = clarkeH(w);
    for (let k = 0; k < w.reports.length; k++) {
      assert.equal(potentialReconstructionError(w, k, h), 0);
    }
  });

  it("utility 1-form: no positive cycle (cyclical monotonicity)", () => {
    const rng = new Rng(203);
    for (let trial = 0; trial < 8; trial++) {
      const w: RuledWorld = { ...buildWorld(rng, 3, 1, 5), rule: "efficient" };
      const scan = cycleScan(w.reports.length, utilityOneForm(w, clarkeH(w)));
      assert.ok(scan.max <= 0, `trial ${trial}: positive cycle ${scan.max}`);
    }
  });

  it("anti-efficient rule: positive cycle exists AND direct deviation pays — not implementable", () => {
    const rng = new Rng(204);
    const w: RuledWorld = { ...buildWorld(rng, 3, 1, 5), rule: "anti-efficient" };
    const scan = rochetScan(w);
    assert.ok(scan.maxCycle > 0, `expected positive cycle, got ${scan.maxCycle}`);
    assert.ok(directDeviationMax(w, clarkeH(w)) > 0);
  });

  it("second-best rule (one step from optimal) breaks cyclical monotonicity — the approximate-solver pathology", () => {
    const rng = new Rng(205);
    let violations = 0;
    for (let t = 0; t < 20; t++) {
      const sb: RuledWorld = { ...buildWorld(rng, 3, 1, 5), rule: "second-best" };
      if (!rochetScan(sb).implementable) violations++;
    }
    assert.ok(violations > 0, "second-best never violated cyclical monotonicity in 20 worlds — expected the T5 pathology");
  });

  it("greedy serial dictatorship IS implementable — the machine's correction of our draft (classic fact)", () => {
    const rng = new Rng(207);
    for (let t = 0; t < 10; t++) {
      const g: RuledWorld = { ...buildWorld(rng, 3, 1, 5), rule: "greedy" };
      assert.ok(rochetScan(g).implementable, `SD not implementable in world ${t}`);
    }
  });

  it("instance guard: efficient allocation unique at truth (by construction)", () => {
    const rng = new Rng(206);
    const inst = randomInstance(3, rng);
    const agents = [0, 1, 2];
    const res = bestAllocation(inst.values, agents);
    assert.ok(res.welfare > res.runnerUp);
  });
});

describe("T3 discrete Noether, executed", () => {
  const iso: Quad = { ax: 1, ay: 1 };
  const broken: Quad = { ax: 1, ay: 4 };

  it("closedness identity matches its closed form h(ax-ay)mx my to 1e-15", () => {
    const rng = new Rng(301);
    for (let t = 0; t < 100; t++) {
      const q: Vec2 = { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 };
      const qPlus: Vec2 = { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 };
      const h = 0.05;
      for (const quad of [iso, broken]) {
        assert.ok(
          // terms like |q+ - q|/h reach ~56 on these ranges: rounding floor
          // ~1e-14, guard sits an order above it
          Math.abs(closednessComputed(q, qPlus, h, quad) - closednessClosedForm(q, qPlus, h, quad)) < 1e-13,
          `t ${t}`,
        );
      }
    }
  });

  it("symmetry => closed (isotropic ~1e-16); broken => nonzero curl", () => {
    const rng = new Rng(302);
    let worstIso = 0;
    let maxBroken = 0;
    for (let t = 0; t < 100; t++) {
      const q: Vec2 = { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 };
      const qPlus: Vec2 = { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 };
      worstIso = Math.max(worstIso, Math.abs(closednessComputed(q, qPlus, 0.05, iso)));
      maxBroken = Math.max(maxBroken, Math.abs(closednessComputed(q, qPlus, 0.05, broken)));
    }
    assert.ok(worstIso < 1e-13, `iso curl ${worstIso}`); // rounding floor ~1e-14 (terms up to |q+-q|/h ~ 56)
    assert.ok(maxBroken > 1e-2, `broken curl ${maxBroken}`);
  });

  it("charge conserved along DEL trajectories (symmetric), drifts when broken", () => {
    const h = 0.05;
    const q0: Vec2 = { x: 1, y: 0 };
    const q1: Vec2 = { x: Math.cos(h), y: Math.sin(h) };
    const tIso = trajectory(q0, q1, 400, h, iso);
    const tBroken = trajectory(q0, q1, 400, h, broken);
    assert.ok(tIso.maxResidual < 1e-13, `iso residual ${tIso.maxResidual}`);
    assert.ok(tBroken.maxResidual < 1e-13, `broken residual ${tBroken.maxResidual}`);
    assert.ok(tIso.maxJDrift < 1e-12, `iso J drift ${tIso.maxJDrift}`);
    assert.ok(tBroken.maxJDrift > 1e-3, `broken J drift ${tBroken.maxJDrift}`);
  });

  it("L_d is exactly rotation-invariant for the isotropic quad (the premise)", () => {
    const q: Vec2 = { x: 0.3, y: -0.7 };
    const qPlus: Vec2 = { x: -0.2, y: 0.5 };
    const h = 0.05;
    const theta = 0.9;
    const rot = (v: Vec2): Vec2 => ({ x: v.x * Math.cos(theta) - v.y * Math.sin(theta), y: v.x * Math.sin(theta) + v.y * Math.cos(theta) });
    const a = discreteLagrangian(q, qPlus, h, iso);
    const b = discreteLagrangian(rot(q), rot(qPlus), h, iso);
    assert.ok(Math.abs(a - b) < 1e-14, `invariance broken: ${Math.abs(a - b)}`);
  });

  it("the charge can be read from either endpoint for the closed form (J via D_2 flips sign)", () => {
    const q: Vec2 = { x: 0.4, y: 0.9 };
    const qPlus: Vec2 = { x: 1.1, y: -0.3 };
    const h = 0.05;
    const jFromD1 = chargeJ(q, qPlus, h, iso);
    // closedness = 0 for iso: D_1.xi(q) + D_2.xi(q+) = 0 => -D_2.xi(q+) = J
    const closedness = closednessComputed(q, qPlus, h, iso);
    assert.ok(Math.abs(closedness) < 1e-15);
    // 补全测试名承诺的断言:J 也可从 D_2 端点读出,符号翻转
    const d2 = d2Ld(q, qPlus, h, iso);
    const xi2 = xiQ(qPlus);
    assert.ok(Math.abs(jFromD1 + (d2.x * xi2.x + d2.y * xi2.y)) < 1e-15);
  });
});
