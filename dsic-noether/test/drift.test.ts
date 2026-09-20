import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  affineDrift,
  affineDriftClosedForm,
  affineDriftCoefficients,
  affineDriftResidual,
  affineEnvelopePayment,
  affineOthersWelfare,
  affineRule,
  driftInterceptSensitivity,
  driftStr,
  driftValueAt,
  driftZeroAt,
  efficientPointDrift,
  grovesLocusViolations,
  kappaExpectedLaw,
  kappaSpecializationResidual,
  kappaSpecializedDrift,
  makeAffineFamily,
} from "../src/continuum/drift.js";
import {
  pAdd,
  pAssertZero,
  pDeriv,
  pEval,
  pIsZero,
  pMul,
  pScale,
  pSub,
  pVar,
  rCmp,
  rStr,
  rat,
  type Rat,
} from "../src/continuum/poly.js";
import * as gl from "../src/continuum/green-laffont.js";
import { KernelError } from "../src/core/errors.js";

const f = makeAffineFamily();

describe("T12 the Groves drift quadratic on the affine moduli space (v0.5.0)", () => {
  it("DR1: the symbolic fiber-integral drift equals the closed form (a-2a^2)s + a(1-2b0) - a(1+2b1)o exactly", () => {
    pAssertZero(affineDriftResidual(f), "the drift quadratic law");
    // the payment and welfare are machine-derived (never asserted): the
    // payment carries the s^2/s/constant faces, the drift seven monomials
    assert.ok(
      affineEnvelopePayment(f).mono.size >= 3,
      "the payment carries the s^2, s, and constant faces",
    );
    const d = affineDrift(f);
    assert.ok(
      d.mono.size === 6,
      `the drift expands to exactly six monomials (the quadratic's faces), got ${driftStr(d)}`,
    );
    // the rule itself is the three-term affine rule
    assert.equal(affineRule(f).mono.size, 3, "x = a s + b0 + b1 o");
    assert.ok(
      affineOthersWelfare(f).mono.size >= 4,
      "the welfare carries the full quadratic face",
    );
  });

  it("DR2: the Groves locus is {a = 0} U {(1/2, 1/2, -1/2)} — the grid census finds zero violations", () => {
    // steps = 4: the grid hits the efficient point (1/2, 1/2, -1/2) exactly
    const bad = grovesLocusViolations(f, 4);
    assert.deepEqual(
      bad.map((row) => row.map(rStr)),
      [],
      "no (a, b0, b1) grid point violates the characterization",
    );
    // the two faces of the locus, directly:
    assert.ok(
      driftZeroAt(f, rat(0), rat(7, 3), rat(-2, 5)),
      "a = 0 (any intercept): the degenerate constant-rule slice IS Groves",
    );
    assert.ok(
      driftZeroAt(f, rat(1, 2), rat(1, 2), rat(-1, 2)),
      "the efficient point IS Groves",
    );
    assert.ok(
      !driftZeroAt(f, rat(1, 2), rat(1, 2), rat(1, 2)),
      "a = 1/2 with a wrong b1 is NOT Groves",
    );
    assert.ok(
      !driftZeroAt(f, rat(1, 4), rat(1, 2), rat(-1, 2)),
      "a responsive non-efficient slope is NOT Groves",
    );
    // and the efficient point's drift is the ZERO POLYNOMIAL in (s, o)
    pAssertZero(efficientPointDrift(f), "the drift at the efficient point");
  });

  it("DR2 boundary: on the implementable cone a > 0 the Groves locus is the single efficient point", () => {
    const { coefS, coef0, coef1 } = affineDriftCoefficients(f);
    // the responsiveness face a - 2a^2 vanishes exactly at 0 and 1/2
    const coefSVal = (aNum: number, aDen: number): Rat =>
      pEval(coefS, [rat(0), rat(aNum, aDen), rat(0), rat(0), rat(0)]);
    assert.ok(
      rCmp(coefSVal(1, 1), rat(0)) < 0 && rCmp(coefSVal(2, 1), rat(0)) < 0,
    );
    assert.equal(rStr(coefSVal(0, 1)), "0");
    assert.equal(rStr(coefSVal(1, 2)), "0");
    // the intercept faces pin b0 = 1/2 and b1 = -1/2 whenever a != 0
    const zero0 = pEval(coef0, [
      rat(0),
      rat(1, 2),
      rat(1, 3),
      rat(-1, 2),
      rat(0),
    ]);
    const zero1 = pEval(coef1, [
      rat(0),
      rat(1, 2),
      rat(1, 2),
      rat(-1, 2),
      rat(0),
    ]);
    assert.notEqual(rStr(zero0), "0", "a(1-2b0) nonzero at b0 != 1/2");
    assert.equal(rStr(zero1), "0", "a(1+2b1) zero exactly at b1 = -1/2");
    // a finer cone census (steps = 5, a-grid misses 1/2 => NO Groves point at all)
    assert.equal(grovesLocusViolations(f, 5).length, 0);
    for (let i = 1; i <= 5; i++) {
      assert.ok(
        !driftZeroAt(f, rat(i, 5), rat(1, 2), rat(-1, 2)),
        `a=${i}/5 is off the locus`,
      );
    }
  });

  it("DR3: the kappa specialization collapses to kappa(1-kappa)s/2 and matches the repo engine value-by-value", () => {
    pAssertZero(
      kappaSpecializationResidual(f),
      "the kappa law kappa(1-kappa)(n-1)s/n at n = 2",
    );
    const specialized = kappaSpecializedDrift(f);
    pAssertZero(
      pSub(specialized, kappaExpectedLaw(f)),
      "specialized drift == the K2 law, coefficient-wise",
    );
    // value-level cross-check against the repo's own kappaGrovesDrift (n = 2)
    const family = gl.makeFamily(2);
    for (const kappa of [rat(1, 2), rat(3, 4), rat(2, 5), rat(2)]) {
      for (const sV of [rat(1, 2), rat(9, 20), rat(2, 5)]) {
        const oV = rat(7, 20);
        // the specialized ring is (s, kappa-axis, b0, b1, o): b0/b1 are gone
        const ours = pEval(specialized, [sV, kappa, rat(0), rat(0), oV]);
        const theirs = pEval(gl.kappaGrovesDrift(family, kappa, rat(2, 5)), [
          sV,
          sV,
          oV,
        ]);
        assert.equal(
          rStr(ours),
          rStr(theirs),
          `kappa=${rStr(kappa)} s=${rStr(sV)}`,
        );
      }
    }
  });

  it("SMUGGLING TRIAL: the forged 'drift is independent of the intercept' claim (the spec's literal) is convicted", () => {
    const sens = driftInterceptSensitivity(f);
    assert.ok(
      !pIsZero(sens),
      "D - D|_{b0=b1=0} is a nonzero polynomial — the drift DOES see the intercept",
    );
    // D - D|_0 = a(1 - 2b0) - a(1 + 2b1)o + [a(1) - a(1)] = -2ab0 - 2ab1 o
    // => exactly two surviving monomials: the a*b0 and a*b1 cross terms
    assert.equal(
      sens.mono.size,
      2,
      `two cross-terms survive, got ${driftStr(sens)}`,
    );
    const keys = [...sens.mono.keys()].sort();
    assert.equal(
      keys[0],
      "0,1,0,1,1",
      "the a*b1*o monomial survives with coefficient -2",
    );
    assert.equal(
      keys[1],
      "0,1,1,0,0",
      "the a*b0 monomial survives with coefficient -2",
    );
    assert.equal(rStr(sens.mono.get(keys[0]) as Rat), "-2");
    assert.equal(rStr(sens.mono.get(keys[1]) as Rat), "-2");
    // the REFUTED spec-literal slice: at the constant-intercept plane
    // (b1 = 0) the drift is (a-2a^2)s + a(1-o-2b0) — a function of b0 AND o;
    // its a = 1 slice is -s + 1 - o - 2b0, nonzero in (s, o, b0)
    const atA1 = driftValueAt(
      f,
      rat(3, 10),
      rat(1),
      rat(1, 5),
      rat(0),
      rat(2, 5),
    );
    assert.ok(
      rCmp(atA1, rat(0)) !== 0,
      "D|_{a=1} is nonzero — the 'a = 1 slice' claim is refuted",
    );
    // and the forged quadratic-in-b claim dies too: the drift is LINEAR in
    // both intercept parameters
    for (const k of affineDrift(f).mono.keys()) {
      const e = k.split(",").map(Number);
      assert.ok(
        (e[2] as number) <= 1 && (e[3] as number) <= 1,
        `no b0^2 / b1^2 term survives: key ${k}`,
      );
    }
  });

  it("the gauge invariance of the drift: adding C(o) to the payment changes the drift by the ZERO polynomial", () => {
    // gauge C(o) = 3o^2 - o/5: d/ds of (p + C + W) equals the drift of p + W
    const o = pVar(f.vars, 4);
    const gauge = pAdd(pScale(pMul(o, o), rat(3)), pScale(o, rat(-1, 5)));
    const driftWithGauge = pDeriv(
      pAdd(pAdd(affineEnvelopePayment(f), affineOthersWelfare(f)), gauge),
      f.sIdx,
    );
    pAssertZero(
      pSub(driftWithGauge, affineDrift(f)),
      "the gauge direction leaves the drift invariant",
    );
    // and the gauge carries no own-report monomials (the Noether-II face)
    for (const k of gauge.mono.keys()) {
      const e = k.split(",").map(Number);
      assert.equal(e[0], 0, "no s-monomials in the gauge");
    }
  });

  it("the drift's value channel is consistent at hand-derived points", () => {
    // spot: a = 1/4, b0 = 1/4, b1 = -1/4, o = 1/2, s = 1/2
    // D = (1/4-2/16)(1/2) + (1/4)(1-1/2) - (1/4)(1-1/2)(1/2) = 1/16 + 1/8 - 1/16 = 1/8
    assert.equal(
      rStr(
        driftValueAt(f, rat(1, 2), rat(1, 4), rat(1, 4), rat(-1, 4), rat(1, 2)),
      ),
      "1/8",
    );
    // at the efficient point it is exactly 0 for any (s, o)
    for (const sV of [rat(2, 5), rat(1, 2), rat(3, 5)]) {
      for (const oV of [rat(2, 5), rat(1, 2), rat(7, 13)]) {
        assert.equal(
          rStr(driftValueAt(f, sV, rat(1, 2), rat(1, 2), rat(-1, 2), oV)),
          "0",
        );
      }
    }
    // the closed form and the expansion agree at a random-ish off-grid point
    const pt = [rat(7, 20), rat(3, 8), rat(5, 16), rat(-3, 10), rat(11, 25)];
    assert.equal(
      rStr(pEval(affineDrift(f), pt)),
      rStr(pEval(affineDriftClosedForm(f), pt)),
    );
  });

  it("SMUGGLING TRIAL: illegal census ranges are refused with a NAMED (reused) error code", () => {
    const code = (e: unknown): string | undefined =>
      e instanceof KernelError ? e.code : undefined;
    assert.throws(
      () => grovesLocusViolations(f, 0),
      (e: unknown) => code(e) === "cert/d-range",
    );
    assert.throws(
      () => grovesLocusViolations(f, -1),
      (e: unknown) => code(e) === "cert/d-range",
    );
  });

  it("the verdicts are deterministic (rerun deep-equals)", () => {
    assert.deepEqual(
      grovesLocusViolations(f, 4).map((row) => row.map(rStr)),
      grovesLocusViolations(f, 4).map((row) => row.map(rStr)),
    );
    const d1 = affineDrift(f);
    const d2 = affineDrift(f);
    assert.equal(driftStr(d1), driftStr(d2));
    assert.ok(pIsZero(pSub(d1, d2)));
  });
});
