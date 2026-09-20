import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyNoise } from "../src/core/channels.js";
import {
  WEDGE_CLAIMS,
  type WedgeClaimRow,
  checkWedgeClaims,
  compareQsqrt2,
  dephaseOutputExact,
  fAdd,
  fCmp,
  fDiv,
  fEq,
  fMul,
  fSub,
  frac,
  fToNumber,
  g7WedgeCertificate,
  isRatSquare,
  pythagoreanFamily,
  ratSqrt,
  verifyRationalWedgeClaim,
  wedgeCensus,
  wedgeClosedForm,
  wedgeDense,
  wedgeExactFaces,
} from "../src/kernel/wedge.js";
import {
  blochOf,
  blochState,
  concealmentLoss,
  passProbability,
  pureState,
} from "../src/kernel/market.js";

describe("T-W1 the fraction field and the Q(sqrt 2) comparator", () => {
  it("Frac arithmetic is exact and reduced (spot identities in BigInt)", () => {
    assert.ok(fEq(fAdd(frac(1n, 6n), frac(1n, 3n)), frac(1n, 2n)));
    assert.ok(fEq(fSub(frac(1n, 3n), frac(1n, 6n)), frac(1n, 6n)));
    assert.ok(fEq(fMul(frac(2n, 3n), frac(3n, 4n)), frac(1n, 2n)));
    assert.ok(fEq(fDiv(frac(1n, 2n), frac(3n, 4n)), frac(2n, 3n)));
    assert.equal(fCmp(frac(2n, 3n), frac(3n, 5n)), 1);
    assert.equal(fCmp(frac(-2n, 3n), frac(-3n, 5n)), -1);
    assert.ok(fEq(fMul(frac(6n, 8n), frac(4n, 3n)), frac(1n, 1n)));
  });

  it("division by the zero rational and the zero denominator are refused by name", () => {
    assert.throws(() => fDiv(frac(1n), frac(0n)), /Q-ZERO-DENOMINATOR/);
    assert.throws(() => frac(1n, 0n), /Q-ZERO-DENOMINATOR/);
  });

  it("rational squares: 13 is not a square, 1/4 and 16/25 are; ratSqrt is exact", () => {
    assert.ok(!isRatSquare(frac(13n, 25n)));
    assert.ok(isRatSquare(frac(1n, 4n)));
    assert.ok(isRatSquare(frac(16n, 25n)));
    assert.ok(fEq(ratSqrt(frac(16n, 25n))!, frac(4n, 5n)));
    assert.equal(ratSqrt(frac(13n, 25n)), null);
  });

  it("compareQsqrt2 pins sqrt(2) between 1.414213 and 1.414214 by exact squaring", () => {
    // sqrt(2) = 0 + 1*sqrt(2)
    assert.equal(
      compareQsqrt2(frac(0n), frac(1n), frac(1414213n, 1000000n)),
      1,
    );
    assert.equal(
      compareQsqrt2(frac(0n), frac(1n), frac(1414214n, 1000000n)),
      -1,
    );
    // (sqrt 2 - 1)/4 vs its float digits — the two sign cases
    assert.equal(
      compareQsqrt2(frac(-1n, 4n), frac(1n, 4n), frac(103553n, 1000000n)),
      1,
    );
    assert.equal(
      compareQsqrt2(frac(-1n, 4n), frac(1n, 4n), frac(103554n, 1000000n)),
      -1,
    );
    // opposite-sign magnitude cases: -3 + 2*sqrt(2) is negative (3 > 2*sqrt 2)
    assert.equal(compareQsqrt2(frac(-3n), frac(2n), frac(0n)), -1);
    assert.equal(compareQsqrt2(frac(3n), frac(-2n), frac(0n)), 1);
    // pure rational fallback (q = 0)
    assert.equal(compareQsqrt2(frac(1n, 3n), frac(0n), frac(1n, 4n)), 1);
  });
});

describe("T-W2 the cosine law, two paths (channel-agnostic geometry)", () => {
  it("WC2: the closed form wedge = |r'|(1 - cos)/2 matches the dense pass/loss machinery on BOTH channels", () => {
    const c = wedgeCensus();
    assert.ok(
      c.worstClosedVsDense <= 1e-12,
      `closed-vs-dense deviation ${c.worstClosedVsDense}`,
    );
    assert.ok(
      c.worstInputAnchoredCos <= 1e-12,
      `input-anchored cos deviation ${c.worstInputAnchoredCos}`,
    );
    assert.ok(c.points > 2000, `census too thin (${c.points} points)`);
  });

  it("the R18 spec's factorization loss(INPUT) x (1 - cos) is machine-refuted at the G7 point (0.146446 != 0.103553)", () => {
    const q = Math.SQRT1_2;
    const r: [number, number, number] = [q, 0, q];
    const rhoOut = applyNoise(blochState(r), "dephase", 0.5);
    const rOut = blochOf(rhoOut);
    const machine = wedgeDense(r, r, "dephase", 0.5);
    const lossInput = concealmentLoss(blochState(r)); // |r|/2 = 1/2
    const cos = wedgeClosedForm(r, rOut).cos;
    const specFactorization = lossInput * (1 - cos);
    assert.ok(
      Math.abs(machine - 0.103553390593) < 1e-9,
      `machine wedge ${machine}`,
    );
    assert.ok(
      Math.abs(specFactorization - 0.146446609407) < 1e-9,
      `spec factorization ${specFactorization}`,
    );
    assert.ok(
      Math.abs(specFactorization - machine) > 0.04,
      "the spec's factorization accidentally matched",
    );
    // the machine-correct factorization: loss of the OUTPUT
    const lossOutput = concealmentLoss(rhoOut);
    assert.ok(Math.abs(lossOutput * (1 - cos) - machine) <= 1e-15);
  });

  it("WC3: aligned announcements meet slack = loss exactly; every misaligned grid point is strictly wedged", () => {
    const c = wedgeCensus();
    assert.ok(
      c.worstAlignedSlackEqLoss <= 1e-12,
      `aligned slack=loss deviation ${c.worstAlignedSlackEqLoss}`,
    );
    assert.ok(
      c.minMisalignedWedge > 1e-6,
      `smallest misaligned wedge ${c.minMisalignedWedge}`,
    );
  });

  it("WC1: the dephase output law is exact in BigInt and agrees with the dense channel to floating floor", () => {
    const c = wedgeCensus();
    assert.ok(
      c.worstOutputLaw <= 1e-15,
      `dense output-law deviation ${c.worstOutputLaw}`,
    );
    for (const r of pythagoreanFamily()) {
      for (const g of [frac(0n), frac(1n, 4n), frac(1n, 2n)]) {
        const out = dephaseOutputExact(r, g);
        const rf: [number, number, number] = [
          fToNumber(r[0]),
          fToNumber(r[1]),
          fToNumber(r[2]),
        ];
        const rfOut = blochOf(
          applyNoise(blochState(rf), "dephase", fToNumber(g)),
        );
        assert.ok(
          Math.abs(rfOut[0] - fToNumber(out[0])) <= 1e-15 &&
            Math.abs(rfOut[1] - fToNumber(out[1])) <= 1e-15 &&
            Math.abs(rfOut[2] - fToNumber(out[2])) <= 1e-15,
        );
      }
    }
  });
});

describe("T-W3 the exactness ladder (rationality is a certificate, not a blanket)", () => {
  it("WC4: cos^2 of the input-anchored wedge is an exact BigInt rational on the whole Pythagorean family (non-degenerate rows), crossed against the float geometry", () => {
    let worst = 0;
    let degenerate = 0;
    for (const r of pythagoreanFamily()) {
      for (const g of [frac(0n), frac(1n, 4n), frac(1n, 2n)]) {
        const faces = wedgeExactFaces(r, g);
        if (faces.degenerate) {
          // the boundary carries no angle; its wedge is exactly 0
          degenerate++;
          assert.ok(faces.wedge !== null && fEq(faces.wedge, frac(0n)));
          continue;
        }
        const rf: [number, number, number] = [
          fToNumber(r[0]),
          fToNumber(r[1]),
          fToNumber(r[2]),
        ];
        const rOut = blochOf(
          applyNoise(blochState(rf), "dephase", fToNumber(g)),
        );
        const cos = wedgeClosedForm(rf, rOut).cos;
        worst = Math.max(worst, Math.abs(cos * cos - fToNumber(faces.cosSq!)));
      }
    }
    assert.ok(worst <= 1e-14, `cos^2 cross-deviation ${worst}`);
    assert.equal(degenerate, 2); // the two equatorial family members at gamma = 1/2
    assert.equal(pythagoreanFamily().length, 15);
  });

  it("WC5: wedge is an exact rational on the WHOLE family at gamma in {0, 1/2}; cos too, except undefined on the degenerate boundary — spot: r=(3/5,0,4/5) at 1/2 gives cos = 4/5, wedge = 2/25", () => {
    const r: readonly [
      ReturnType<typeof frac>,
      ReturnType<typeof frac>,
      ReturnType<typeof frac>,
    ] = [frac(3n, 5n), frac(0n), frac(4n, 5n)];
    const faces = wedgeExactFaces(r, frac(1n, 2n));
    assert.ok(faces.cos !== null && fEq(faces.cos, frac(4n, 5n)));
    assert.ok(faces.wedge !== null && fEq(faces.wedge, frac(2n, 25n)));
    for (const rr of pythagoreanFamily()) {
      for (const g of [frac(0n), frac(1n, 2n)]) {
        const f = wedgeExactFaces(rr, g);
        assert.ok(
          f.wedge !== null,
          `gamma ${fToNumber(g)} left a null wedge on the family`,
        );
        if (!f.degenerate)
          assert.ok(
            f.cos !== null,
            `gamma ${fToNumber(g)} left a non-degenerate null cos`,
          );
      }
    }
  });

  it("WC6 (the spec's refutation): gamma = 1/4 at r = (4/5, 0, 3/5) — |r'|^2 = 13/25, cos = sqrt(13)/5 outside Q (13 not a square)", () => {
    const r: readonly [
      ReturnType<typeof frac>,
      ReturnType<typeof frac>,
      ReturnType<typeof frac>,
    ] = [frac(4n, 5n), frac(0n), frac(3n, 5n)];
    const faces = wedgeExactFaces(r, frac(1n, 4n));
    assert.ok(fEq(faces.nr2, frac(13n, 25n)));
    assert.equal(faces.cos, null);
    assert.equal(faces.wedge, null);
    assert.ok(!isRatSquare(frac(13n, 25n)));
    // and the neighboring x-axis point at 1/4 keeps its cos exactly rational
    // (dephase never rotates an axis: cos = 1, wedge = 0) — point-dependence,
    // not a blanket; the machine convicted this desk's own first draft (cos 1/2)
    const axial = wedgeExactFaces([frac(1n), frac(0n), frac(0n)], frac(1n, 4n));
    assert.ok(axial.cos !== null && fEq(axial.cos, frac(1n, 1n)));
    assert.ok(axial.wedge !== null && fEq(axial.wedge, frac(0n)));
  });

  it("WC7: the G7 float 0.103553 upgraded — exact bracket, cos^2 = 1/2, dense agreement", () => {
    const cert = g7WedgeCertificate();
    assert.ok(cert.aboveLo && cert.belowHi);
    assert.ok(fEq(cert.cosSq, frac(1n, 2n)));
    assert.ok(
      cert.floatDev <= 1e-15,
      `dense-vs-field deviation ${cert.floatDev}`,
    );
  });

  it("the G7 rational bracket is strict at both ends (the sensitivity control: equality claims die)", () => {
    const cert = g7WedgeCertificate();
    // (sqrt 2 - 1)/4 vs exactly 0.103553 — strictly greater, so the float's own digits do NOT pin the wedge
    assert.equal(compareQsqrt2(frac(-1n, 4n), frac(1n, 4n), cert.lo), 1);
    // 7-digit resolution: 0.1035533 < wedge < 0.1035534
    assert.equal(
      compareQsqrt2(frac(-1n, 4n), frac(1n, 4n), frac(1035533n, 10000000n)),
      1,
    );
    assert.equal(
      compareQsqrt2(frac(-1n, 4n), frac(1n, 4n), frac(1035534n, 10000000n)),
      -1,
    );
    assert.equal(compareQsqrt2(frac(-1n, 4n), frac(1n, 4n), cert.hi), -1);
  });
});

describe("T-W4 smuggling trials — counterfeit exactness is named and refused (v0.5.0)", () => {
  it("rationality laundering: a TRUE cos^2 = 289/325 with a rationalized cos at the gamma = 1/4 point is NOT-RATIONAL-POINT", () => {
    const verdict = verifyRationalWedgeClaim({
      r: [frac(4n, 5n), frac(0n), frac(3n, 5n)],
      gamma: frac(1n, 4n),
      claimedCosSq: frac(289n, 325n), // the true rational cos^2 (dot = 17/25, |r'|^2 = 13/25)
      claimedCos: frac(17n, 25n), // the laundered value: the rational dot dressed as the cos
      claimedWedge: frac(6n, 25n),
    });
    assert.ok(!verdict.ok);
    if (!verdict.ok) {
      assert.equal(verdict.code, "NOT-RATIONAL-POINT");
      assert.match(verdict.detail, /OUTSIDE the rationals/);
    }
  });

  it("a forged cos on a genuinely rational point is FORGED-COS", () => {
    const verdict = verifyRationalWedgeClaim({
      r: [frac(3n, 5n), frac(0n), frac(4n, 5n)],
      gamma: frac(1n, 2n),
      claimedCosSq: frac(16n, 25n),
      claimedCos: frac(3n, 5n), // the x-component dressed as the cos
      claimedWedge: frac(2n, 25n),
    });
    assert.ok(!verdict.ok);
    if (!verdict.ok) assert.equal(verdict.code, "FORGED-COS");
  });

  it("a forged wedge with a correct cos is FORGED-WEDGE", () => {
    const verdict = verifyRationalWedgeClaim({
      r: [frac(3n, 5n), frac(0n), frac(4n, 5n)],
      gamma: frac(1n, 2n),
      claimedCosSq: frac(16n, 25n),
      claimedCos: frac(4n, 5n),
      claimedWedge: frac(3n, 25n),
    });
    assert.ok(!verdict.ok);
    if (!verdict.ok) assert.equal(verdict.code, "FORGED-WEDGE");
  });

  it("a forged cos^2 dies first, by the square-free certificate", () => {
    const verdict = verifyRationalWedgeClaim({
      r: [frac(3n, 5n), frac(0n), frac(4n, 5n)],
      gamma: frac(1n, 2n),
      claimedCosSq: frac(1n, 2n), // the true cos^2 is 16/25
      claimedCos: frac(4n, 5n),
      claimedWedge: frac(2n, 25n),
    });
    assert.ok(!verdict.ok);
    if (!verdict.ok) assert.equal(verdict.code, "FORGED-COS-SQUARE");
  });

  it("an angle claimed on the degenerate boundary (r' = 0) is DEGENERATE-OUTPUT; a nonzero wedge there is FORGED-WEDGE", () => {
    const meaninglessAngle = verifyRationalWedgeClaim({
      r: [frac(1n), frac(0n), frac(0n)], // equatorial at gamma = 1/2: r' = 0
      gamma: frac(1n, 2n),
      claimedCosSq: frac(1n),
      claimedCos: frac(1n),
      claimedWedge: frac(0n),
    });
    assert.ok(!meaninglessAngle.ok);
    if (!meaninglessAngle.ok)
      assert.equal(meaninglessAngle.code, "DEGENERATE-OUTPUT");
    const forgedWedge = verifyRationalWedgeClaim({
      r: [frac(0n), frac(1n), frac(0n)],
      gamma: frac(1n, 2n),
      claimedCosSq: frac(1n),
      claimedCos: frac(1n),
      claimedWedge: frac(1n, 8n), // nothing is wedged when nothing is left
    });
    assert.ok(!forgedWedge.ok);
    if (!forgedWedge.ok) assert.equal(forgedWedge.code, "FORGED-WEDGE");
  });

  it("a non-pure input and an out-of-range strength are refused by name", () => {
    const notPure = verifyRationalWedgeClaim({
      r: [frac(4n, 5n), frac(0n), frac(4n, 5n)], // |r|^2 = 32/25
      gamma: frac(1n, 4n),
      claimedCosSq: frac(1n),
      claimedCos: frac(1n),
      claimedWedge: frac(0n),
    });
    assert.ok(!notPure.ok);
    if (!notPure.ok) assert.equal(notPure.code, "NOT-PURE-INPUT");
    const badGamma = verifyRationalWedgeClaim({
      r: [frac(1n), frac(0n), frac(0n)],
      gamma: frac(3n, 4n),
      claimedCosSq: frac(1n),
      claimedCos: frac(1n),
      claimedWedge: frac(0n),
    });
    assert.ok(!badGamma.ok);
    if (!badGamma.ok) assert.equal(badGamma.code, "GAMMA-RANGE");
    assert.throws(
      () =>
        wedgeExactFaces([frac(4n, 5n), frac(0n), frac(4n, 5n)], frac(1n, 4n)),
      /NOT-PURE-INPUT/,
    );
    assert.throws(
      () => wedgeExactFaces([frac(1n), frac(0n), frac(0n)], frac(3n, 4n)),
      /GAMMA-RANGE/,
    );
  });

  it("an honest claim on a rational point is VERIFIED with its exact digits", () => {
    const verdict = verifyRationalWedgeClaim({
      r: [frac(3n, 5n), frac(0n), frac(4n, 5n)],
      gamma: frac(1n, 2n),
      claimedCosSq: frac(16n, 25n),
      claimedCos: frac(4n, 5n),
      claimedWedge: frac(2n, 25n),
    });
    assert.ok(verdict.ok);
    if (verdict.ok) assert.match(verdict.detail, /wedge = 2\/25/);
  });
});

describe("T-W5 the claims table clears, contraband tags are convicted, the desk's doors refuse by name", () => {
  it("checkWedgeClaims recomputes the whole table clean", () => {
    assert.deepEqual(checkWedgeClaims(), []);
    const refuted = WEDGE_CLAIMS.filter((c) => c.tag === "REFUTED").map(
      (c) => c.id,
    );
    assert.deepEqual(refuted, ["WC6"]);
  });

  it("a writeable-view smuggle: WC6 claimed HOLDS is convicted; an illegal tag is convicted; an unknown id is refused by name", () => {
    type MutableWedgeClaim = {
      -readonly [K in keyof WedgeClaimRow]: WedgeClaimRow[K];
    };
    const smuggle = (
      mutate: (rows: MutableWedgeClaim[]) => void,
    ): ReturnType<typeof checkWedgeClaims> => {
      const copy = JSON.parse(
        JSON.stringify(WEDGE_CLAIMS),
      ) as MutableWedgeClaim[];
      mutate(copy);
      return checkWedgeClaims(copy);
    };
    const hit = smuggle((rows) => {
      const row = rows.find((r) => r.id === "WC6");
      if (row) row.tag = "HOLDS";
    }).find((v) => v.row === "WC6");
    assert.ok(hit, "expected a WEDGE violation on WC6");
    assert.match(hit.detail, /claimed HOLDS but the machine says otherwise/);

    const tagHit = smuggle((rows) => {
      const row = rows.find((r) => r.id === "WC1");
      if (row) row.tag = "QUOTED" as MutableWedgeClaim["tag"];
    }).find((v) => v.row === "WC1");
    assert.ok(tagHit, "expected a WEDGE violation on WC1");
    assert.match(tagHit.detail, /illegal claim tag/);

    assert.throws(
      () =>
        checkWedgeClaims([{ id: "WC9", claim: "counterfeit", tag: "HOLDS" }]),
      /WEDGE-CLAIM/,
    );
  });

  it("the zero-geometry doors refuse by name (a zero announcement or a zero output has no angle)", () => {
    assert.throws(
      () => wedgeClosedForm([0, 0, 0], [1, 0, 0]),
      /ZERO-ANNOUNCEMENT/,
    );
    assert.throws(() => wedgeClosedForm([1, 0, 0], [0, 0, 0]), /ZERO-OUTPUT/);
  });

  it("the input-aligned G7 announcement reproduces the audit face's own wedge (cross-anchor with W-G's bend)", () => {
    // the same point W-G bends at: input-aligned announcement, gamma = 1/2
    const q = Math.SQRT1_2;
    const r: [number, number, number] = [q, 0, q];
    const rhoOut = applyNoise(blochState(r), "dephase", 0.5);
    const p = passProbability(pureState([q, 0, q]), rhoOut);
    const wedge = concealmentLoss(rhoOut) - (p - 0.5);
    const closed = wedgeClosedForm([q, 0, q], blochOf(rhoOut));
    assert.ok(Math.abs(wedge - closed.wedge) <= 1e-15);
    assert.ok(Math.abs(wedge - 0.103553) < 1e-6, `wedge ${wedge}`);
  });
});
