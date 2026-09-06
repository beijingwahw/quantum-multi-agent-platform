import test from "node:test";
import assert from "node:assert/strict";
import {
  bimodalDist,
  convexDecomposition,
  eStarGrover,
  firstMarkDist,
  geometricDist,
  groverPClosed,
  groverPIterated,
  lambdaClosed,
  lambdaStar,
  lubyUniversal,
  makeFastRenewal,
  payExpected,
  payStarMenu,
  powerLawDist,
  renewalEarlyStop,
  zeroOptimal,
  ZERO_OPTIMAL_DENSITY_LIMIT,
} from "../src/kernel/restart.js";

const DISTS = [
  ["geom r=0.05", geometricDist(200, 0.05)],
  ["geom r=0.01", geometricDist(400, 0.01)],
  ["powerlaw^-2", powerLawDist(400, 2)],
  ["bimodal", bimodalDist()],
] as const;

test("T2.A fixed-cutoff identity: renewal sum equals closed lambda(t) (two paths)", () => {
  for (const [, p] of DISTS) {
    for (const t of [1, 2, 3, 5, 8, 16, 40, 100, 200]) {
      if (t >= p.length) continue;
      const dev = Math.abs(renewalEarlyStop(p, { prefix: [t] }) - lambdaClosed(p, t));
      assert.ok(dev < 1e-9, `t=${t}: renewal vs closed dev ${dev}`);
    }
  }
});

test("T2.C convex decomposition: sum g = 1 and weighted lambdas rebuild T(S)", () => {
  for (const [, p] of DISTS) {
    for (const prefix of [[1, 3, 1, 16], [2, 5], [6]]) {
      const c = convexDecomposition(p, { prefix });
      assert.ok(Math.abs(c.gSum - 1) < 1e-12, `sum g = 1 (got ${c.gSum})`);
      assert.ok(c.deviation < 1e-9, `identity (7) deviation ${c.deviation}`);
    }
  }
});

test("T2.B no cyclic strategy beats the best fixed cutoff (exhaustive, early-stop model)", () => {
  const menu = [1, 2, 3, 4];
  for (const [name, p] of DISTS) {
    const fast = makeFastRenewal(p, menu);
    const star = lambdaStar(p);
    const menuLambda = Math.min(...menu.map((t) => lambdaClosed(p, t)));
    let minT = Number.POSITIVE_INFINITY;
    for (let len = 1; len <= 3; len++) {
      const build = (prefix: number[], acc: number[][]): void => {
        if (prefix.length === len) {
          acc.push([...prefix]);
          return;
        }
        for (let c = 0; c < menu.length; c++) build([...prefix, c], acc);
      };
      const acc: number[][] = [];
      build([], acc);
      for (const idxs of acc) {
        const T = fast.T({ prefix: idxs.map((i) => menu[i] as number) });
        if (T < minT) minT = T;
      }
    }
    assert.ok(minT >= star.value - 1e-9, `${name}: some strategy beat lambda* (${minT} < ${star.value})`);
    assert.ok(Math.abs(minT - menuLambda) < 1e-9, `${name}: best menu fixed cutoff attains the enumeration min`);
    // fast path agrees with the reference path
    const ref = renewalEarlyStop(p, { prefix: [menu[2] as number, menu[0] as number] });
    const fastv = fast.T({ prefix: [menu[2] as number, menu[0] as number] });
    assert.ok(Math.abs(ref - fastv) < 1e-12, "fast renewal = reference renewal");
  }
});

test("T2.D universal doubling within the LSZ93 theorem-5 bound", () => {
  const univ = lubyUniversal(5);
  for (const [name, p] of DISTS) {
    const fast = makeFastRenewal(p, [1, 2, 4, 8, 16]);
    const star = lambdaStar(p);
    const T = fast.T({ prefix: univ });
    const bound = 9.5 * star.value * (Math.log2(star.value) + 5);
    assert.ok(T <= bound + 1e-6, `${name}: T(S_univ)=${T} exceeds bound ${bound}`);
    assert.ok(T / star.value < 12, `${name}: empirical ratio ${fmt(T / star.value)}`);
  }
});

function fmt(x: number): string {
  return x.toFixed(3);
}

test("T2.E Grover success curves: closed form vs iterated 2x2 rotation", () => {
  let worst = 0;
  for (const [N, t] of [
    [256, 1],
    [256, 7],
    [1024, 1],
    [1024, 37],
  ] as const) {
    for (let k = 0; k <= 40; k++) {
      const dev = Math.abs(groverPClosed(N, t, k) - groverPIterated(N, t, k));
      if (dev > worst) worst = dev;
    }
  }
  assert.ok(worst < 1e-12, `two-path deviation ${worst}`);
});

test("T2.F threshold law: k=0 optimal iff density above the k=1 binding limit", () => {
  const N = 16384;
  assert.equal(zeroOptimal(N, Math.floor(0.3 * N)), false, "at density 0.3 amplification must win");
  assert.equal(zeroOptimal(N, Math.ceil(0.42 * N)), true, "at density 0.42 the pure sorter is optimal");
  // consistency: wherever zeroOptimal holds, E* is attained at k=0
  for (const [n2, t] of [
    [256, 200],
    [1024, 900],
  ] as const) {
    if (zeroOptimal(n2, t)) {
      assert.equal(eStarGrover(n2, t).k, 0);
    }
  }
  // the binding-constraint constant itself
  assert.ok(Math.abs(ZERO_OPTIMAL_DENSITY_LIMIT - 0.3964466094067263) < 1e-15);
});

test("T2.G always-pay model: no cyclic round schedule beats the cheapest round", () => {
  for (const [N, t] of [
    [256, 1],
    [1024, 3],
  ] as const) {
    const depths = [0, 1, 2, 3, 5];
    const costs = depths.map((k) => k + 1);
    const probs = depths.map((k) => groverPClosed(N, t, k));
    const star = payStarMenu(costs, probs);
    let count = 0;
    for (let len = 1; len <= 3; len++) {
      const build = (prefix: number[], acc: number[][]): void => {
        if (prefix.length === len) {
          acc.push([...prefix]);
          return;
        }
        for (let i = 0; i < depths.length; i++) build([...prefix, i], acc);
      };
      const acc: number[][] = [];
      build([], acc);
      for (const idxs of acc) {
        const T = payExpected(costs, probs, idxs);
        count++;
        assert.ok(T >= star.value - 1e-9, `N=${N} t=${t}: schedule ${idxs.join(",")} beat the menu optimum (${T} < ${star.value})`);
      }
    }
    assert.ok(count > 100, "enumeration actually covered the schedule space");
  }
});

test("T2.H classical first-mark law: sane distribution, restart gains nothing", () => {
  const N = 256;
  const t = 4;
  const p = firstMarkDist(N, t);
  let total = 0;
  let mean = 0;
  for (let u = 1; u < p.length; u++) {
    total += p[u] as number;
    mean += u * (p[u] as number);
  }
  assert.ok(Math.abs(total - 1) < 1e-12, "distribution sums to 1");
  assert.ok(Math.abs(mean - (N + 1) / (t + 1)) < 1e-9, `mean = (N+1)/(t+1) (got ${mean})`);
  const star = lambdaStar(p);
  assert.ok(star.value >= mean - 1e-9, "restarting cannot beat running on for the uniform first-mark law");
});
