import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeRng } from "../src/core/rng.js";
import {
  bellWeights,
  bellDiagonal,
  bellTwirl,
  purifyRound,
} from "../src/kernel/purify.js";
import { concurrence, eF } from "../src/kernel/clearing.js";
import { computeLedger } from "../src/kernel/ledger.js";
import {
  RECYCLE_TABLE,
  RECYCLE_TOL,
  bellConcurrenceClosed,
  bellEfClosed,
  bellRoundFailClosedForm,
  checkRecycleTable,
  expectStepNeverRises,
  recycleDP,
  roundTransition,
  stopValue,
  twirlSpectrum,
  wernerSpectrum,
  type BellSpectrum,
  type RecycleRow,
} from "../src/kernel/recycle.js";

/** A writeable view of a census row — contraband is smuggled into a private copy. */
type MutableRecycleRow = {
  -readonly [K in keyof RecycleRow]: RecycleRow[K];
};

function smuggleRow(
  mutate: (
    rows: MutableRecycleRow[],
    pick: (id: string) => MutableRecycleRow,
  ) => void,
): ReturnType<typeof checkRecycleTable> {
  const copy = JSON.parse(JSON.stringify(RECYCLE_TABLE)) as MutableRecycleRow[];
  mutate(copy, (id) => {
    const row = copy.find((r) => r.id === id);
    if (row === undefined)
      throw new Error(`smuggle: RECYCLE_TABLE has no row ${id}`);
    return row;
  });
  return checkRecycleTable(copy);
}

function randomSpectrum(rng: () => number): BellSpectrum {
  let s = 0;
  const v = Array.from({ length: 4 }, () => {
    const x = rng();
    s += x;
    return x;
  });
  return [v[0]! / s, v[1]! / s, v[2]! / s, v[3]! / s] as BellSpectrum;
}

describe("R-A the executed transitions — kernel vs closed forms, both branches", () => {
  it("the fail branch matches its XOR closed form, and the residue really is Bell-diagonal", () => {
    const rng = makeRng(209);
    let worstP = 0;
    let worstW = 0;
    for (let t = 0; t < 10; t++) {
      const lam = randomSpectrum(rng);
      const mu = randomSpectrum(rng);
      const r = purifyRound(bellDiagonal(lam), bellDiagonal(mu));
      const ref = bellRoundFailClosedForm(lam, mu);
      worstP = Math.max(worstP, Math.abs(r.pFail - ref.pFail));
      const fw = bellWeights(r.failState);
      for (let k = 0; k < 4; k++)
        worstW = Math.max(worstW, Math.abs(fw[k]! - ref.out[k]!));
      // the residue is Bell-diagonal: rebuilding from its own weights reproduces it
      const back = bellDiagonal(fw);
      for (let k = 0; k < 16; k++) {
        worstW = Math.max(
          worstW,
          Math.abs(r.failState.re[k]! - back.re[k]!),
          Math.abs(r.failState.im[k]! - back.im[k]!),
        );
      }
    }
    assert.ok(
      worstP <= 1e-12,
      `worst |pFail - closed form| ${worstP.toExponential(3)}`,
    );
    assert.ok(
      worstW <= 1e-12,
      `worst spectrum/rebuild deviation ${worstW.toExponential(3)}`,
    );
  });

  it("roundTransition prices both branches with the kernel AND both closed forms (every call)", () => {
    const rng = makeRng(210);
    for (let t = 0; t < 8; t++) {
      const tr = roundTransition(randomSpectrum(rng), randomSpectrum(rng));
      assert.ok(Math.abs(tr.pSucc + tr.pFail - 1) <= 1e-12);
      assert.ok(tr.pSucc > 1e-12 && tr.pFail > 1e-12);
      assert.ok(Math.abs(tr.succ.reduce((a, b) => a + b, 0) - 1) <= 1e-12);
      assert.ok(Math.abs(tr.fail.reduce((a, b) => a + b, 0) - 1) <= 1e-12);
    }
  });

  it("the twirl closed form is the executed 24-element Clifford twirl", () => {
    const rng = makeRng(211);
    let worst = 0;
    for (let t = 0; t < 8; t++) {
      const lam = randomSpectrum(rng);
      const executed = bellTwirl(bellDiagonal(lam));
      const g = (1 - lam[0]) / 3;
      const want = bellDiagonal([lam[0], g, g, g]);
      for (let k = 0; k < 16; k++) {
        worst = Math.max(
          worst,
          Math.abs(executed.re[k]! - want.re[k]!),
          Math.abs(executed.im[k]! - want.im[k]!),
        );
      }
      const got = twirlSpectrum(lam);
      assert.ok(Math.abs(got[0] - lam[0]) <= 1e-15);
    }
    assert.ok(
      worst <= 1e-12,
      `worst twirl deviation ${worst.toExponential(3)}`,
    );
  });

  it("the Bell-diagonal concurrence closed form C = 2 max(0, l_max - 1/2) is the Wootters solver", () => {
    const rng = makeRng(212);
    let worstC = 0;
    let worstEf = 0;
    for (let t = 0; t < 12; t++) {
      const lam = randomSpectrum(rng);
      const rho = bellDiagonal(lam);
      worstC = Math.max(
        worstC,
        Math.abs(concurrence(rho) - bellConcurrenceClosed(lam)),
      );
      worstEf = Math.max(worstEf, Math.abs(eF(rho) - bellEfClosed(lam)));
    }
    assert.ok(
      worstC <= 1e-12,
      `worst concurrence deviation ${worstC.toExponential(3)}`,
    );
    assert.ok(
      worstEf <= 1e-12,
      `worst E_F deviation ${worstEf.toExponential(3)}`,
    );
  });
});

describe("R-B the melt-down theorem — what a failed round leaves", () => {
  it("an isothermal pair's residue is EXACTLY I/4 at every grade (the chain beheads itself)", () => {
    for (let i = 0; i <= 10; i++) {
      const F = 0.45 + 0.05 * i;
      const tr = roundTransition(wernerSpectrum(F), wernerSpectrum(F));
      for (let k = 0; k < 4; k++) {
        assert.ok(
          Math.abs(tr.fail[k]! - 0.25) <= 1e-12,
          `F=${F}: residue weight ${k} is ${tr.fail[k]}`,
        );
      }
      assert.ok(bellEfClosed(tr.fail) <= 1e-12);
    }
  });

  it("the melt-down is a WERNER-WERNER theorem: any two-grade pair's residue prices at 0, non-Werner leftovers do not", () => {
    // any Werner-Werner pair: every residue weight stays below 1/2, so the
    // failed branch's E_F book is exactly 0 at every two-grade combination
    for (const F1 of [0.55, 0.65, 0.75, 0.85, 0.95]) {
      for (const F2 of [0.55, 0.75, 0.95]) {
        const tr = roundTransition(wernerSpectrum(F1), wernerSpectrum(F2));
        for (const w of tr.fail) {
          assert.ok(
            w < 0.5 + 1e-12,
            `F1=${F1}, F2=${F2}: a residue weight reached ${w}`,
          );
        }
        assert.ok(
          bellEfClosed(tr.fail) <= 1e-12,
          `F1=${F1}, F2=${F2}: residue prices above 0`,
        );
      }
    }
    // the mixed-grade residue spectrum is NOT uniform — the coin is alive as a
    // state, dead on the books (an honest distinction the census keeps)
    const mixed = roundTransition(wernerSpectrum(0.85), wernerSpectrum(0.75));
    assert.ok(Math.abs(mixed.fail[0] - mixed.fail[2]) > 1e-6);
    // a NON-Werner leftover (the raw success branch) carries book value and
    // trades on the salvage market like any coin
    const succ = roundTransition(
      wernerSpectrum(0.85),
      wernerSpectrum(0.75),
    ).succ;
    assert.ok(bellEfClosed(succ) > 0);
    const dp = recycleDP([succ, [succ[0], succ[1], succ[2], succ[3]]]);
    assert.ok(dp.book > 0);
    assert.ok(
      dp.deliverOptimum > 0 && dp.deliverOptimum <= dp.book + RECYCLE_TOL,
    );
  });
});

describe("R-C the step never-rises audit — VIDAL00 instantiated per action", () => {
  it("every audited action of every census bank holds: worstStepSlack >= -TOL", () => {
    let worst = Number.POSITIVE_INFINITY;
    let audits = 0;
    for (const row of RECYCLE_TABLE) {
      const dp = recycleDP(row.coins.map(wernerSpectrum));
      worst = Math.min(worst, dp.worstStepSlack);
      audits += dp.auditCount;
      assert.ok(
        dp.worstStepSlack >= -RECYCLE_TOL,
        `${row.id}: slack ${dp.worstStepSlack}`,
      );
    }
    assert.ok(audits > 100, `the census audited only ${audits} actions`);
    assert.ok(
      worst >= -RECYCLE_TOL,
      `worst step slack ${worst.toExponential(3)}`,
    );
  });

  it("expectStepNeverRises convicts a fabricated gain by name and passes an honest ledger", () => {
    const lam = wernerSpectrum(0.55);
    const mu = wernerSpectrum(0.55);
    const tr = roundTransition(lam, mu);
    const bank: readonly BellSpectrum[] = [lam, mu];
    // honest: the real transition's successor banks
    expectStepNeverRises(bank, {
      probabilities: [tr.pSucc, tr.pFail],
      nextBanks: [[tr.succ], [tr.fail]],
    });
    // contraband: the same probabilities, a forged successor worth nearly a
    // full standard coin (the real branches at this grade are worth ~0.035)
    assert.throws(() => {
      expectStepNeverRises(bank, {
        probabilities: [tr.pSucc, tr.pFail],
        nextBanks: [[wernerSpectrum(0.999)], [tr.fail]],
      });
    }, /EC_RECYCLE_MONOTONICITY/);
    assert.throws(() => {
      expectStepNeverRises(bank, { probabilities: [], nextBanks: [] });
    }, /EC_RECYCLE_LEDGER/);
  });
});

describe("R-D the three value-iteration series — the DP's own certificate", () => {
  it("HOLD pinned at book, EXACT non-increasing, DELIVER under the book, all converged", () => {
    for (const row of RECYCLE_TABLE) {
      const dp = recycleDP(row.coins.map(wernerSpectrum));
      for (const v of dp.holdSeries) {
        assert.ok(
          Math.abs(v - dp.book) <= RECYCLE_TOL,
          `${row.id}: HOLD left the book (${v} vs ${dp.book})`,
        );
      }
      for (let k = 1; k < dp.exactSeries.length; k++) {
        assert.ok(
          dp.exactSeries[k]! <= dp.exactSeries[k - 1]! + RECYCLE_TOL,
          `${row.id}: EXACT rose at depth ${k}`,
        );
      }
      for (const v of dp.deliverSeries) {
        assert.ok(
          v <= dp.book + RECYCLE_TOL,
          `${row.id}: DELIVER left the book (${v})`,
        );
      }
      assert.ok(
        dp.deliverOptimum <= dp.book + RECYCLE_TOL,
        `${row.id}: D* beat the book`,
      );
      assert.ok(
        dp.exactFloor <= dp.deliverOptimum + RECYCLE_TOL,
        `${row.id}: the forced floor beat the free optimum`,
      );
      assert.ok(
        dp.convergedAt <= row.coins.length,
        `${row.id}: convergedAt ${dp.convergedAt} exceeds bank depth`,
      );
      assert.strictEqual(dp.holdSeries.length, dp.convergedAt + 1);
      assert.ok(dp.bestFirstMoves.length >= 1);
    }
  });

  it("the DP is deterministic — two runs agree field by field", () => {
    const a = recycleDP([
      wernerSpectrum(0.85),
      wernerSpectrum(0.75),
      wernerSpectrum(0.65),
    ]);
    const b = recycleDP([
      wernerSpectrum(0.65),
      wernerSpectrum(0.85),
      wernerSpectrum(0.75),
    ]);
    assert.deepStrictEqual(a, b); // the bank is a multiset: order does not matter
  });
});

describe("R-E the L9 squeeze — the ledger row is the DP's depth-1 face", () => {
  it("book = L9's before, D* = L9's after EXACTLY at the canonical grade; the squeeze holds", () => {
    const l9 = computeLedger().find((e) => e.id === "L9");
    if (l9 === undefined)
      throw new Error("the conservation ledger carries no L9 row");
    const dp = recycleDP([wernerSpectrum(0.85), wernerSpectrum(0.85)]);
    assert.ok(
      Math.abs(dp.book - l9.before) <= 1e-12,
      `book ${dp.book} vs L9 before ${l9.before}`,
    );
    assert.ok(
      Math.abs(dp.deliverOptimum - l9.after) <= 1e-12,
      `D* ${dp.deliverOptimum} vs L9 after ${l9.after}`,
    );
    const e1 = dp.exactSeries[1];
    if (e1 === undefined)
      throw new Error("the EXACT series has no depth-1 entry");
    assert.ok(
      l9.after <= e1 + RECYCLE_TOL,
      "the raw round already beats the best depth-1 face",
    );
    assert.ok(e1 <= dp.deliverOptimum + RECYCLE_TOL);
    assert.ok(dp.deliverOptimum <= dp.book + RECYCLE_TOL);
  });

  it("at every isothermal grade the optimum IS the raw single round (twirl is idempotent there)", () => {
    for (let i = 1; i <= 9; i++) {
      const F = 0.5 + 0.05 * i;
      const dp = recycleDP([wernerSpectrum(F), wernerSpectrum(F)]);
      const r = purifyRound(
        bellDiagonal(wernerSpectrum(F)),
        bellDiagonal(wernerSpectrum(F)),
      );
      const raw = r.pSucc * eF(r.successState) + r.pFail * eF(r.failState);
      assert.ok(
        Math.abs(dp.deliverOptimum - raw) <= 1e-12,
        `F=${F}: D* ${dp.deliverOptimum} vs raw ${raw}`,
      );
    }
  });
});

describe("R-F depth does not pay — the optimum is exactly one round", () => {
  it("D* = E_1 across the whole census: no second round ever beats stopping after the first", () => {
    for (const row of RECYCLE_TABLE) {
      const dp = recycleDP(row.coins.map(wernerSpectrum));
      assert.ok(
        Math.abs(dp.deliverOptimum - dp.deliverSeries[1]!) <= 1e-12,
        `${row.id}: D* ${dp.deliverOptimum} left its depth-1 value ${dp.deliverSeries[1]}`,
      );
      // the forced-first-move toll is paid once and never recovered
      for (let k = 1; k < dp.deliverSeries.length; k++) {
        assert.ok(
          dp.deliverSeries[k]! <= dp.deliverSeries[k - 1]! + RECYCLE_TOL,
          `${row.id}: DELIVER rose at depth ${k}`,
        );
      }
    }
  });

  it("forced depth is discounted, and deeper mixed markets recycle tighter (census structure)", () => {
    const three = RECYCLE_TABLE.find((r) => r.id === "R-M87565");
    const four = RECYCLE_TABLE.find((r) => r.id === "R-M8756555");
    assert.ok(three !== undefined && four !== undefined);
    assert.ok(
      three.exactFloor < three.deliver - 1e-6,
      "forced-to-the-bottom is not strictly worse",
    );
    assert.ok(
      four.gap < three.gap,
      `4-coin discount ${four.gap} vs 3-coin ${three.gap}`,
    );
    assert.ok(four.deliver > four.exactFloor + 1e-6);
  });
});

describe("R-G the salvage census — keyed numbers must recompute (law R6)", () => {
  it("the full table recomputes row by row", () => {
    const violations = checkRecycleTable();
    assert.deepStrictEqual(violations, []);
    assert.strictEqual(RECYCLE_TABLE.length, 17);
  });

  it("smuggling trials: an inflated deliverable, a negative discount, and a duplicate id are all convicted", () => {
    const inflated = smuggleRow((_rows, pick) => {
      pick("R-S85-2").deliver += 0.05;
    });
    assert.ok(
      inflated.some(
        (v) => v.row === "R-S85-2" && /do not recompute/.test(v.detail),
      ),
    );

    const negative = smuggleRow((_rows, pick) => {
      const r = pick("R-S85-2");
      r.deliver = r.book + 0.01;
      r.gap = r.book - r.deliver;
    });
    assert.ok(
      negative.some(
        (v) =>
          v.row === "R-S85-2" && /NEGATIVE recycling discount/.test(v.detail),
      ),
    );

    const dup = smuggleRow((rows) => {
      const first = rows[0];
      if (first === undefined)
        throw new Error("smuggle: the census table is empty");
      rows.push({ ...first });
    });
    assert.ok(
      dup.some((v) => /duplicate salvage census row id/.test(v.detail)),
    );
  });
});

describe("R-H the contraband refinery — free re-distillation, target cost omitted", () => {
  it("a failed residue 'recycled' against a fresh near-standard coin WITHOUT paying for it is convicted by name", () => {
    // the honest salvage market: this residue, alone
    const residue = roundTransition(
      wernerSpectrum(0.85),
      wernerSpectrum(0.75),
    ).fail;
    // the contraband action: twirl the residue, pair it with a FRESH coin near
    // the standard grade, keep the real kernel transition — but the ledger
    // charges only the residue's book (the fresh coin's E_F never enters)
    const fresh = wernerSpectrum(0.999);
    const tr = roundTransition(twirlSpectrum(residue), fresh);
    assert.throws(() => {
      expectStepNeverRises(
        [residue],
        {
          probabilities: [tr.pSucc, tr.pFail],
          nextBanks: [[tr.succ], [tr.fail]],
        },
        "the free refinery (branch re-distillation, target cost omitted)",
      );
    }, /EC_RECYCLE_MONOTONICITY/);
    // the same physical transition with the target HONESTLY on the books passes
    expectStepNeverRises(
      [residue, fresh],
      {
        probabilities: [tr.pSucc, tr.pFail],
        nextBanks: [[tr.succ], [tr.fail]],
      },
      "the paid refinery",
    );
  });
});

describe("R-I domain refusals — named, at the boundary", () => {
  it("bank size, spectra, and zero branches refuse by name", () => {
    const five = Array.from({ length: 5 }, () => wernerSpectrum(0.85));
    assert.throws(() => recycleDP(five), /EC_RECYCLE_BANK/);
    assert.throws(() => recycleDP([]), /EC_RECYCLE_BANK/);
    assert.throws(
      () => recycleDP([[0.5, 0.2, 0.2, 0.0]]),
      /EC_RECYCLE_SPECTRUM/,
    ); // weights sum to 0.9
    assert.throws(
      () => stopValue([[-0.1, 0.4, 0.4, 0.3]]),
      /EC_RECYCLE_SPECTRUM/,
    );
    assert.throws(
      () => stopValue([[0.3, 0.3, 0.3, 0.3]]),
      /EC_RECYCLE_SPECTRUM/,
    ); // weights sum to 1.2
    assert.throws(() => wernerSpectrum(0), /EC_F_RANGE/);
    assert.throws(() => wernerSpectrum(1), /EC_F_RANGE/);
    // a single-coin bank is a legal (if boring) market: the only policy is to hold
    const lone = recycleDP([wernerSpectrum(0.85)]);
    assert.strictEqual(lone.states, 1);
    assert.strictEqual(lone.auditCount, 0);
    assert.ok(Math.abs(lone.book - lone.deliverOptimum) <= 1e-15);
    // two identical PURE Bell coins hit the probability-zero keep branch — purify.ts's own guard
    const pure: BellSpectrum = [1, 0, 0, 0];
    assert.throws(() => roundTransition(pure, pure), /EC_ZERO_BRANCH/);
  });
});
