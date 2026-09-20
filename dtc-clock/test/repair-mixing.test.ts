import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dobrushinCertificate,
  foldIndex,
  mixingRunFromRows,
  noiseRowFull,
  repairedKernelRows,
  repairedMixingRun,
  repairedStateCount,
  repairedStationaryDistribution,
  stochasticDeficit,
  unrepairedBlockRows,
} from "../src/kernel/repair-mixing.js";
import { DtcError } from "../src/core/errors.js";

const GRID_N = [4, 6, 8, 10, 12, 16, 5, 7, 9, 11] as const;
const GRID_P = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 0.95] as const;

describe("R21 — the repaired chain's Dobrushin certificate (mixing in the fold)", () => {
  it("DM1: the pairwise coefficient is a contraction with exact common-mass accounting — zero EXACTLY at p=1/2, the binomial tail road exact at odd n, the flip symmetry beta(p) = beta(1-p)", () => {
    for (const n of GRID_N) {
      for (const p of GRID_P) {
        const c = dobrushinCertificate(n, p);
        assert.ok(
          c.pairwise >= 0 && c.pairwise < 1,
          `n=${n} p=${p}: beta=${c.pairwise} must lie in [0,1)`,
        );
        assert.ok(
          c.minCommonMass > 0,
          `n=${n} p=${p}: the strict-contraction witness`,
        );
        assert.ok(
          Math.abs(1 - c.pairwise - c.minCommonMass) <= 1e-12,
          `n=${n} p=${p}: TV = 1 - sum min`,
        );
        assert.ok(
          c.pairwiseTail <= c.pairwise + 1e-12,
          `n=${n} p=${p}: the tail road never exceeds TV`,
        );
        if (n % 2 === 1) {
          assert.ok(
            Math.abs(c.pairwiseTail - c.pairwise) <= 1e-12,
            `n=${n} p=${p}: single-crossing at odd n`,
          );
        }
        if (p === 0.5) {
          assert.equal(
            c.pairwise,
            0,
            `n=${n}: instant mixing at the symmetric point`,
          );
        } else {
          assert.ok(
            c.pairwise > 0,
            `n=${n} p=${p}: strict positivity off the symmetric point`,
          );
        }
        assert.ok(
          Math.abs(c.pairwise - dobrushinCertificate(n, 1 - p).pairwise) <=
            1e-12,
          `n=${n} p=${p}: the flip symmetry`,
        );
        assert.ok(
          stochasticDeficit(repairedKernelRows(n, p)) <= 1e-12,
          `n=${n} p=${p}: repaired rows sum to 1`,
        );
      }
    }
  });

  it("DM2 (the spec conviction): the adjacent-pair form is REFUTED off the symmetric point — the fold is not monotone, the worst pair is the extreme pair (n>=6, p != 1/2)", () => {
    // at n=4 the chain has two states, so pairwise IS adjacent (the trivial case)
    const c4 = dobrushinCertificate(4, 0.1);
    assert.ok(
      Math.abs(c4.pairwise - 0.4096) <= 1e-12,
      `beta(4,0.1) = ${c4.pairwise}`,
    );
    assert.equal(c4.adjacent, c4.pairwise);
    for (const n of [6, 8, 10, 12, 16, 5, 7, 9, 11]) {
      for (const p of GRID_P) {
        const c = dobrushinCertificate(n, p);
        if (p === 0.5) {
          assert.equal(c.adjacent, 0);
          continue;
        }
        assert.ok(
          c.pairwise - c.adjacent > 1e-6,
          `n=${n} p=${p}: adjacent ${c.adjacent} < pairwise ${c.pairwise} — the R18 spec's max_w TV(K(w),K(w+1)) undercounts the coefficient`,
        );
      }
    }
    const c6 = dobrushinCertificate(6, 0.1);
    assert.ok(
      Math.abs(c6.pairwise - 0.5248) <= 1e-12,
      `beta(6,0.1) = ${c6.pairwise}`,
    );
    assert.deepEqual([...c6.worstPair], [0, 2]);
    assert.deepEqual([...dobrushinCertificate(12, 0.3).worstPair], [0, 5]);
  });

  it("DM3 (the named boundary): at even n >= 8 the tie fold breaks single-crossing at interior p; the break VANISHES at the symmetric point p = 1/2", () => {
    for (const n of [8, 10, 12, 14, 16]) {
      for (const p of [0.1, 0.2, 0.3]) {
        const c = dobrushinCertificate(n, p);
        assert.ok(
          c.pairwise - c.pairwiseTail > 1e-3,
          `n=${n} p=${p}: the binomial-tail closed form must be disclosed as a lower bound here (${c.pairwiseTail} < ${c.pairwise})`,
        );
      }
      const sym = dobrushinCertificate(n, 0.5);
      assert.ok(
        Math.abs(sym.pairwiseTail - sym.pairwise) <= 1e-12,
        `n=${n}: single-crossing restored at p=1/2`,
      );
    }
    // n=6 is the honest exception on the interior: its worst pair still
    // single-crosses at p in {0.1, 0.2} and breaks only from p=0.3 on
    assert.ok(
      dobrushinCertificate(6, 0.2).pairwise -
        dobrushinCertificate(6, 0.2).pairwiseTail <=
        1e-12,
      "n=6 p=0.2 still exact",
    );
    assert.ok(
      dobrushinCertificate(6, 0.3).pairwise -
        dobrushinCertificate(6, 0.3).pairwiseTail >
        1e-3,
      "n=6 p=0.3 breaks",
    );
    const c8 = dobrushinCertificate(8, 0.2);
    assert.ok(
      c8.pairwise - c8.pairwiseTail >= 0.08,
      `n=8 p=0.2 deficit ${c8.pairwise - c8.pairwiseTail}`,
    );
    const c16 = dobrushinCertificate(16, 0.2);
    assert.ok(
      c16.pairwise - c16.pairwiseTail >= 0.19,
      `n=16 p=0.2 deficit ${c16.pairwise - c16.pairwiseTail}`,
    );
  });

  it("DM7: INSTANT MIXING at p = 1/2 — every row IS the folded Bin(n,1/2) and the certificate lands in ONE step", () => {
    for (const n of GRID_N) {
      const rows = repairedKernelRows(n, 0.5);
      for (let x = 1; x < rows.length; x++) {
        for (let y = 0; y < rows.length; y++) {
          assert.ok(
            Math.abs(rows[x]![y]! - rows[0]![y]!) <= 1e-12,
            `n=${n}: all rows identical at p=1/2`,
          );
        }
      }
      const run = mixingRunFromRows(rows, 1e-6);
      assert.equal(run.beta, 0);
      assert.equal(run.boundSteps, 1);
      assert.ok(
        run.tvAtBound <= 1e-9,
        `n=${n}: one step lands on stationarity (${run.tvAtBound.toExponential(2)})`,
      );
    }
  });

  it("DM4: the mixing bound holds step by step — every DP TV <= beta^t, the bound's own step count lands inside eps, and the per-step ratio never exceeds beta", () => {
    for (const [n, p] of [
      [4, 0.1],
      [6, 0.2],
      [8, 0.1],
      [8, 0.2],
      [12, 0.3],
      [16, 0.05],
      [16, 0.1],
      [5, 0.1],
      [9, 0.3],
    ] as const) {
      const run = repairedMixingRun(n, p, 1e-6);
      for (let t = 1; t <= run.boundSteps; t++) {
        const tv = run.tvSeries[t - 1]!;
        assert.ok(
          tv <= run.beta ** t + 1e-12,
          `n=${n} p=${p} t=${t}: tv ${tv.toExponential(3)} > beta^t`,
        );
      }
      assert.ok(
        run.tvAtBound <= 1e-6 + 1e-12,
        `n=${n} p=${p}: the bound's step count must land inside eps`,
      );
      assert.ok(
        run.worstPerStepRatio <= run.beta + 1e-9,
        `n=${n} p=${p}: per-step ratio ${run.worstPerStepRatio} vs beta ${run.beta}`,
      );
      assert.ok(
        run.conservatism >= 1 - 1e-9,
        `n=${n} p=${p}: Dobrushin is never beaten`,
      );
    }
    const r62 = repairedMixingRun(6, 0.2, 1e-6);
    assert.ok(Math.abs(r62.beta - 0.2448) <= 1e-12);
    assert.equal(r62.boundSteps, 10);
    const r16 = repairedMixingRun(16, 0.05, 1e-6);
    assert.ok(
      r16.boundSteps >= 400,
      `beta near 1 at extreme noise mixes slowly (${r16.boundSteps} steps)`,
    );
  });

  it("DM5 negative control: the unrepaired absorbing block is substochastic — the certificate machinery REFUSES it by name", () => {
    const deficit = stochasticDeficit(unrepairedBlockRows(6, 0.2));
    assert.ok(
      deficit >= 0.43,
      `the strict armor's block leaks ${deficit} of its mass per period`,
    );
    assert.throws(
      () => mixingRunFromRows(unrepairedBlockRows(6, 0.2)),
      (e: unknown) =>
        e instanceof DtcError &&
        e.code === "E/DOMAIN" &&
        e.message.includes("substochastic"),
    );
    assert.throws(
      () => unrepairedBlockRows(5, 0.2),
      (e: unknown) => e instanceof DtcError && e.code === "E/DOMAIN",
    );
  });

  it("DM6: the fold's own faces and the domain guards", () => {
    assert.equal(foldIndex(6, 3), 0); // the tie resets
    assert.equal(foldIndex(6, 2), 2);
    assert.equal(foldIndex(5, 3), 2);
    assert.equal(foldIndex(5, 2), 2);
    assert.equal(repairedStateCount(5), 3);
    assert.equal(repairedStateCount(6), 3);
    let sum = 0;
    for (const v of noiseRowFull(6, 0.2, 2)) sum += v;
    assert.ok(Math.abs(sum - 1) <= 1e-12, "the noise row is a distribution");
    const pi = repairedStationaryDistribution(6, 0.2);
    let piSum = 0;
    for (const v of pi) piSum += v;
    assert.ok(
      Math.abs(piSum - 1) <= 1e-9 && Math.min(...pi) >= 0,
      "the stationary distribution is a distribution",
    );
    for (const thunk of [
      () => dobrushinCertificate(4, 0),
      () => dobrushinCertificate(4, 1),
      () => foldIndex(6, 7),
      () => repairedStateCount(1),
    ]) {
      assert.throws(
        thunk,
        (e: unknown) => e instanceof DtcError && e.code === "E/DOMAIN",
      );
    }
  });
});
