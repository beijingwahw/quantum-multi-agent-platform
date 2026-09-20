import test from "node:test";
import assert from "node:assert/strict";
import {
  amplifiedRoundMenu,
  menuIdentityRow,
  menuIdentityScan,
  kStarLadder,
  zeroThreshold,
  checkMenuQuoteClaim,
  checkKStarTableClaim,
  checkZeroThresholdClaim,
} from "../src/kernel/menu-law.js";
import {
  eStarGrover,
  zeroOptimal,
  ZERO_OPTIMAL_DENSITY_LIMIT,
} from "../src/kernel/restart.js";
import { isKernelError } from "../src/kernel/errors.js";

test("T7.A menu identity: payStarMenu over the full amplified menu equals eStarGrover, exhaustively (N <= 512, all (N,t))", () => {
  const scan = menuIdentityScan(512);
  assert.equal(scan.pairs, (512 * 513) / 2);
  assert.equal(
    scan.worstRelativeDeviation,
    0,
    `worst relative deviation ${scan.worstRelativeDeviation}`,
  );
  assert.equal(scan.argminMismatches, 0);
});

test("T7.A menu identity at the power-of-two grid N = 2^9..2^12, full t each", () => {
  for (const n of [512, 1024, 2048, 4096]) {
    let worst = 0;
    let mismatches = 0;
    for (let t = 1; t <= n; t++) {
      const row = menuIdentityRow(n, t);
      worst = Math.max(worst, row.relativeDeviation);
      if (!row.argminAgrees) mismatches++;
    }
    assert.equal(worst, 0, `N=${n} worst relative deviation ${worst}`);
    assert.equal(mismatches, 0, `N=${n} argmin mismatches ${mismatches}`);
  }
});

test("T7.A microscopic-probability rounds ride both paths identically (theta ~ pi/3)", () => {
  // N=4, t=3: theta = asin(sqrt(3)/2) ~= pi/3, so p_1 = sin^2(3 theta) is
  // ~1e-33 — NOT exactly zero in floating point, and the drop branch stays a
  // defensive face; the two paths treat the microscopic round identically
  // either way (its c/p ratio is astronomically large, never the argmin)
  const menu = amplifiedRoundMenu(4, 3);
  assert.ok(
    menu.probs.every((p) => p > 0),
    "floating point keeps the microscopic round positive",
  );
  const row = menuIdentityRow(4, 3);
  assert.equal(row.argminAgrees, true);
  assert.equal(row.relativeDeviation, 0);
  // t = N: theta = asin(1) = pi/2 exactly, every p_k = 1, k* = 0, menu = 1
  const full = menuIdentityRow(4, 4);
  assert.equal(full.engineK, 0);
  assert.equal(full.menuValue, 1);
  assert.equal(full.engineQueries, 1);
});

test("T7.B k* monotone law: the full-t ladder has ZERO up-steps at N = 2^8..2^14", () => {
  let steps = 0;
  for (const n of [256, 512, 1024, 2048, 4096, 8192, 16384]) {
    const ladder = kStarLadder(n);
    assert.equal(ladder.ks.length, n);
    assert.equal(
      ladder.violations.length,
      0,
      `N=${n} up-steps: ${JSON.stringify(ladder.violations.slice(0, 3))}`,
    );
    steps += n - 1;
  }
  assert.equal(steps, 32505);
  // the monotone bridge is theta: k* at t=1 is the ladder's max, k* at t=N is 0
  const ladder = kStarLadder(256);
  assert.equal(ladder.ks[0], eStarGrover(256, 1).k);
  assert.equal(ladder.ks[255], 0);
});

test("T7.B k* = 0 iff zeroOptimal — two definitions of the same boundary agree", () => {
  let sampled = 0;
  for (const n of [100, 1000, 4096, 16384]) {
    for (let t = 1; t <= n; t += Math.max(1, Math.floor(n / 97))) {
      sampled++;
      const viaArgmin = eStarGrover(n, t).k === 0;
      const viaScan = zeroOptimal(n, t);
      assert.equal(
        viaArgmin,
        viaScan,
        `N=${n} t=${t}: argmin face says ${viaArgmin}, scan face says ${viaScan}`,
      );
    }
  }
  assert.ok(sampled > 300, `sampled ${sampled}`);
});

test("T7.C zero threshold DATA: |t_c/N - c*| <= 1/N on the sampled grid, correction bounded", () => {
  for (const n of [1024, 4096, 16384, 65536]) {
    const thr = zeroThreshold(n);
    assert.ok(zeroOptimal(n, thr.t), `t_c itself is k*=0`);
    assert.ok(
      !zeroOptimal(n, thr.t - 1),
      `t_c - 1 is still amplifying (the boundary is exact)`,
    );
    assert.ok(
      Math.abs(thr.correction) <= 1 / n,
      `N=${n}: |correction| ${Math.abs(thr.correction).toExponential(3)} > 1/N`,
    );
    assert.ok(
      thr.correctionTimesN < 1,
      `N=${n}: correction x N = ${thr.correctionTimesN} not bounded by 1`,
    );
  }
});

test("T7.C two-sided clamp: at c* - 0.01 the ladder is amplifying, at c* + 0.01 it is pure sorter", () => {
  const n = 65536;
  const tMinus = Math.floor((ZERO_OPTIMAL_DENSITY_LIMIT - 0.01) * n);
  const tPlus = Math.ceil((ZERO_OPTIMAL_DENSITY_LIMIT + 0.01) * n);
  assert.ok(
    eStarGrover(n, tMinus).k > 0,
    `k*(c* - 0.01) must be positive (got 0)`,
  );
  assert.ok(
    !zeroOptimal(n, tMinus),
    "the k*=0 predicate must be FALSE at c* - 0.01",
  );
  assert.equal(eStarGrover(n, tPlus).k, 0, `k*(c* + 0.01) must be 0`);
  assert.ok(
    zeroOptimal(n, tPlus),
    "the k*=0 predicate must be TRUE at c* + 0.01",
  );
});

test("T7.D SMUGGLING TRIAL: a quoted budget below the menu optimum is NAMED and rejected; an honest quote passes", () => {
  const row = menuIdentityRow(1024, 3);
  const cheat = checkMenuQuoteClaim({
    n: 1024,
    t: 3,
    claimedQueries: row.engineQueries * 0.95,
  });
  assert.equal(cheat.ok, false);
  assert.equal(cheat.name, "MENU-QUOTE-COUNTERFEIT");
  assert.match(cheat.detail, /no schedule beats the best round/);
  const honest = checkMenuQuoteClaim({
    n: 1024,
    t: 3,
    claimedQueries: Math.ceil(row.engineQueries),
  });
  assert.equal(honest.ok, true);
  assert.equal(honest.name, "clean");
});

test("T7.D SMUGGLING TRIAL: a forged k* table (an up-step planted) is NAMED at the planted row; the true ladder passes", () => {
  const n = 256;
  const ladder = kStarLadder(n);
  const forged = [...ladder.ks];
  forged[200] = (forged[200] as number) + 1; // an up-step in t
  const v = checkKStarTableClaim({ n, claimedKs: forged });
  assert.equal(v.ok, false);
  assert.equal(v.name, "KSTAR-TABLE-COUNTERFEIT");
  assert.match(v.detail, /t=201/);
  const wrongLength = checkKStarTableClaim({ n, claimedKs: [0, 1, 2] });
  assert.equal(wrongLength.ok, false);
  assert.equal(wrongLength.name, "KSTAR-TABLE-COUNTERFEIT");
  const good = checkKStarTableClaim({ n, claimedKs: ladder.ks });
  assert.equal(good.ok, true);
  assert.match(good.detail, /monotone nonincreasing/);
});

test("T7.D SMUGGLING TRIAL: a mis-stated zero threshold is recomputed and NAMED; the true density passes", () => {
  const thr = zeroThreshold(4096);
  const lie = checkZeroThresholdClaim({
    n: 4096,
    claimedDensity: ZERO_OPTIMAL_DENSITY_LIMIT,
  });
  assert.equal(lie.ok, false);
  assert.equal(lie.name, "ZERO-THRESHOLD-COUNTERFEIT");
  assert.match(lie.detail, /finite-N correction/);
  const honest = checkZeroThresholdClaim({
    n: 4096,
    claimedDensity: thr.density,
  });
  assert.equal(honest.ok, true);
});

test("T7.E guards: the menu inherits the restart domain refusals by name", () => {
  assert.throws(
    () => amplifiedRoundMenu(10, 0),
    (e: unknown) => isKernelError(e) && e.code === "BAD-MARKED-COUNT",
  );
  assert.throws(
    () => amplifiedRoundMenu(10, 11),
    (e: unknown) => isKernelError(e) && e.code === "BAD-MARKED-COUNT",
  );
  assert.throws(
    () => kStarLadder(0),
    (e: unknown) => isKernelError(e) && e.code === "BAD-MARKED-COUNT",
  );
  assert.throws(
    () => zeroThreshold(4),
    (e: unknown) => isKernelError(e) && e.code === "BAD-MARKED-COUNT",
  );
});
