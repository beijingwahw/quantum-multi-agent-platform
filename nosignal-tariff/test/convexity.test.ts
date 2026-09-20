import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RefusalError } from "../src/core/errors.js";
import {
  F_HALF,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDecimal,
  fr,
  frDec,
  iAdd,
  iOf,
  iSub,
} from "../src/kernel/rational.js";
import {
  certifyConvexGrid,
  monoGridPoints,
  netClosedIvl,
} from "../src/kernel/theorem.js";
import {
  evenMonomialSecondDiff,
  certifyGlobalConvexity,
  netPrimeSeriesIvl,
  primeIncrMargin,
  primeMarginUnderData,
  secondDiffMargin,
  secondDiffMarginUnderData,
  QUOTED_MAX_PRIME_WIDTH,
  QUOTED_MIN_DD_MARGIN,
  QUOTED_MIN_PRIME_MARGIN,
} from "../src/kernel/convexity.js";

/** Run `fn`, demand a RefusalError, return its code — the conviction is by name. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(
      e instanceof RefusalError,
      `expected a RefusalError, got ${String(e)}`,
    );
    return e.code;
  }
  assert.fail("expected a refusal that never came");
}

describe("CV1 the derivative series (all-positive coefficients)", () => {
  it("net'(0) = [0,0] exact and p >= 1 is refused — the honest exclusion", () => {
    const z = netPrimeSeriesIvl(F_ZERO);
    assert.equal(fCmp(z.lo, F_ZERO), 0);
    assert.equal(fCmp(z.hi, F_ZERO), 0); // every series term is 0 — no limit trick needed
    assert.equal(
      codeOf(() => netPrimeSeriesIvl(F_ONE)),
      "CONVEXITY_PRIME_DOMAIN",
    ); // 1 - p^2 = 0
    assert.equal(
      codeOf(() => netPrimeSeriesIvl(fr(11, 10))),
      "CONVEXITY_PRIME_DOMAIN",
    );
    assert.equal(
      codeOf(() => netPrimeSeriesIvl(fr(-1, 10))),
      "CONVEXITY_PRIME_DOMAIN",
    );
  });

  it("the series is strictly positive on (0,1) — every coefficient is positive", () => {
    for (const p of [fr(1, 20), F_HALF, fr(19, 20), fr(1, 7)]) {
      const iv = netPrimeSeriesIvl(p);
      assert.ok(
        fCmp(iv.lo, F_ZERO) > 0,
        `net' must be strictly positive at p = ${fDecimal(p, 4)}`,
      );
    }
  });
});

describe("CV2 the prime margin (net' strictly increasing at any scale)", () => {
  it("all 19 cell margins positive with the quoted floor; close and tiny pairs certified", () => {
    const c = certifyGlobalConvexity();
    assert.equal(c.primeCells.length, 19);
    for (const cell of c.primeCells) {
      assert.ok(
        fCmp(cell.margin, F_ZERO) > 0,
        `prime margin must be positive on [${fDecimal(cell.p1, 4)}, ${fDecimal(cell.p2, 4)}]`,
      );
      assert.ok(
        cell.marginOk,
        `prime margin exceeded the data at [${fDecimal(cell.p1, 4)}, ${fDecimal(cell.p2, 4)}]`,
      );
    }
    assert.ok(fCmp(c.minPrimeMargin, frDec(QUOTED_MIN_PRIME_MARGIN)) >= 0);
    assert.ok(
      fCmp(c.closePairMargin, F_ZERO) > 0,
      "the (1/3, 1/3 + 1e-12) pair is separated by exact algebra",
    );
    assert.ok(
      fCmp(c.tinyTripleMargin, F_ZERO) > 0,
      "the (0, 1e-12) triple margin is strictly positive",
    );
  });

  it("the adversarial pair no grid could separate, quoted by exact algebra", () => {
    const p1 = fr(1, 3);
    const p2 = fAdd(p1, frDec("1e-12"));
    const m = primeIncrMargin(p1, p2);
    assert.ok(fCmp(m, F_ZERO) > 0);
    // (1e-12)/(2 ln2_hi) in (3.6e-13, 7.3e-13) — far below float sight of the increment itself
    assert.ok(fCmp(m, frDec("3.6e-13")) > 0 && fCmp(m, frDec("7.3e-13")) < 0);
    const tiny = primeIncrMargin(F_ZERO, frDec("1e-12"));
    assert.ok(
      fCmp(tiny, frDec("7.2e-13")) > 0 && fCmp(tiny, frDec("7.3e-13")) < 0,
    ); // the quoted scale
  });
});

describe("CV3 the second-difference margin (net strictly convex at any scale)", () => {
  it("all 18 interior grid triples carry the margin and the enclosures dominate it", () => {
    const c = certifyGlobalConvexity();
    assert.equal(c.ddTriples.length, 18); // interior only — the terminal triple touches p = 1 (power-path exclusion, disclosed)
    for (const t of c.ddTriples) {
      assert.ok(fCmp(t.margin, F_ZERO) > 0);
      assert.ok(
        t.marginOk,
        `dd margin exceeded the data on [${fDecimal(t.p1, 4)}, ${fDecimal(t.p2, 4)}]`,
      );
      assert.ok(
        t.dominatesEnclosure,
        `the enclosure second difference must dominate the theorem margin on [${fDecimal(t.p1, 4)}, ${fDecimal(t.p2, 4)}]`,
      );
    }
    assert.ok(fCmp(c.minDDMargin, frDec(QUOTED_MIN_DD_MARGIN)) >= 0);
  });

  it("off-grid and origin-adjacent triples are certified at any scale", () => {
    // a wide off-grid triple and the tiny triple at the origin
    const wide = secondDiffMargin(fr(1, 7), fr(6, 7));
    assert.ok(fCmp(wide, frDec("0.092")) > 0 && fCmp(wide, frDec("0.093")) < 0); // (5/7)^2/(8 ln2) ~ 0.09201
    assert.ok(secondDiffMarginUnderData(wide, fr(1, 7), fr(6, 7)));
    const tiny = secondDiffMargin(F_ZERO, frDec("1e-12"));
    assert.ok(fCmp(tiny, F_ZERO) > 0);
    assert.ok(
      fCmp(tiny, frDec("1.7e-25")) > 0 && fCmp(tiny, frDec("1.9e-25")) < 0,
    ); // (1e-12)^2/(8 ln2)
  });
});

describe("CV4 the binomial identity (the remainder's nonnegativity, exact)", () => {
  it("two independent BigInt evaluations agree and the floor 2h^{2k} holds", () => {
    for (const [mn, hn] of [
      [3n, 5n],
      [7n, 1n],
      [0n, 3n],
      [11n, 13n],
    ] as const) {
      for (let k = 1; k <= 8; k++) {
        const m = fr(mn, 17n);
        const h = fr(hn, 23n);
        const dd = evenMonomialSecondDiff(m, h, k);
        assert.ok(
          dd.identityHolds,
          `identity fails at (m=${mn}/17, h=${hn}/23, k=${k})`,
        );
        assert.ok(dd.atLeastFloor, `floor 2h^{2k} fails at k=${k}`);
      }
    }
  });

  it("a forged binomial value is caught by the direct evaluation (negative control)", () => {
    const dd = evenMonomialSecondDiff(fr(3, 17), fr(5, 23), 3);
    // the smuggler's closed form with one binomial coefficient doubled
    const forged = fAdd(dd.binomial, fr(1, 1000000));
    assert.notEqual(
      fCmp(forged, dd.direct),
      0,
      "the forged closed form must differ from the direct expansion",
    );
    assert.ok(dd.identityHolds); // the honest pair still holds
  });

  it("degenerate inputs are refused by name", () => {
    assert.equal(
      codeOf(() => evenMonomialSecondDiff(fr(1, 2), F_ZERO, 3)),
      "CONVEXITY_MONOMIAL_H",
    );
    assert.equal(
      codeOf(() => evenMonomialSecondDiff(fr(1, 2), fr(1, 3), 0)),
      "CONVEXITY_MONOMIAL_K",
    );
    assert.equal(
      codeOf(() => evenMonomialSecondDiff(fr(1, 2), fr(1, 3), 13)),
      "CONVEXITY_MONOMIAL_K",
    );
    assert.equal(
      codeOf(() => primeIncrMargin(F_HALF, F_HALF)),
      "CONVEXITY_PAIR_ORDER",
    );
    assert.equal(
      codeOf(() => primeIncrMargin(fr(3, 4), F_HALF)),
      "CONVEXITY_PAIR_ORDER",
    );
    assert.equal(
      codeOf(() => primeIncrMargin(F_ONE, fr(3, 2))),
      "CONVEXITY_PAIR_DOMAIN",
    );
    assert.equal(
      codeOf(() => secondDiffMargin(F_HALF, F_ONE)),
      "CONVEXITY_TRIPLE_DOMAIN",
    );
    assert.equal(
      codeOf(() => secondDiffMargin(fr(3, 4), F_HALF)),
      "CONVEXITY_TRIPLE_ORDER",
    );
  });
});

describe("CV5 the full convexity certificate", () => {
  it("green with the quoted floors and ceilings, both citation crosses green", () => {
    const c = certifyGlobalConvexity();
    assert.ok(c.ok, "the convexity certificate must be green");
    assert.ok(fCmp(c.minPrimeMargin, frDec(QUOTED_MIN_PRIME_MARGIN)) >= 0);
    assert.ok(fCmp(c.minDDMargin, frDec(QUOTED_MIN_DD_MARGIN)) >= 0);
    assert.ok(fCmp(c.maxPrimeWidth, frDec(QUOTED_MAX_PRIME_WIDTH)) <= 0); // the series is tight, not just correct
    assert.ok(
      c.primeCitationOverlap,
      "the derivative series must overlap the T7 citation formula",
    );
    assert.ok(
      c.secondSeriesOverlap,
      "the net'' series must overlap its closed form",
    );
    assert.ok(
      fCmp(c.minDDMargin, frDec("0.0018033")) > 0 &&
        fCmp(c.minDDMargin, frDec("0.0018035")) < 0,
    ); // the quoted scale
  });
});

describe("CV6 smuggling trials — the convexity face", () => {
  it("an inflated prime margin is convicted by the data gate", () => {
    const p1 = fr(1, 20);
    const p2 = fr(1, 10);
    // the true increment of net' over this cell is ~log2(11/9)/4 ~ 0.0689; the
    // forger claims 0.5 — the series enclosures cap the truth and name it
    assert.ok(
      !primeMarginUnderData(fr(1, 2), p1, p2),
      "the inflated prime margin must die at the data gate",
    );
    assert.ok(
      primeMarginUnderData(primeIncrMargin(p1, p2), p1, p2),
      "the true margin must pass",
    );
  });

  it("an inflated second-difference margin is convicted by the data gate", () => {
    const p1 = fr(1, 20);
    const p2 = fr(3, 20);
    assert.ok(
      !secondDiffMarginUnderData(fr(1, 10), p1, p2),
      "an inflated dd margin must die at the data gate",
    );
    assert.ok(
      secondDiffMarginUnderData(secondDiffMargin(p1, p2), p1, p2),
      "the true dd margin must pass",
    );
  });

  it("a concave dent in the closed-path table is named by the shared convexity checker", () => {
    // the forger pushes v[10] ABOVE the average of its neighbours by 1/25:
    // dd_10 = v9 + v11 - 2 v10' goes negative — the checker names cell 10
    const pts = monoGridPoints();
    const table = pts.map(netClosedIvl);
    const forged = table.map((iv, i) =>
      i === 10 ? iAdd(iv, iOf(fr(1, 25))) : iv,
    );
    const r = certifyConvexGrid(forged);
    assert.ok(!r.ok, "the dented table must be rejected");
    assert.equal(r.firstFailure, 10); // the checker NAMES the cell that carries the dent
    assert.ok(r.minDD === null); // no margin is minted for contraband
    // and the true table still passes — the trial is about the dent, not the checker
    assert.ok(certifyConvexGrid(table).ok);
  });

  it("the dent cannot borrow the theorem margin either (dominance face)", () => {
    // the theorem says the TRUE second difference dominates the margin; the
    // dented table's second difference at the dent is negative — the
    // dominance relation is the forgery's second, independent death
    const c = certifyGlobalConvexity();
    const t = c.ddTriples[9]!; // the triple (9/20, 10/20, 11/20) whose middle carries the dent
    const dentMid = iAdd(netClosedIvl(t.pm), iOf(fr(1, 25)));
    const ddForged = iSub(
      iAdd(netClosedIvl(t.p1), netClosedIvl(t.p2)),
      iAdd(dentMid, dentMid),
    );
    assert.ok(
      fCmp(ddForged.lo, t.margin) < 0,
      "the dented second difference no longer dominates the margin",
    );
    assert.ok(
      fCmp(
        iSub(
          iAdd(netClosedIvl(t.p1), netClosedIvl(t.p2)),
          iAdd(netClosedIvl(t.pm), netClosedIvl(t.pm)),
        ).lo,
        t.margin,
      ) >= 0,
      "the honest triple still dominates",
    );
  });
});
