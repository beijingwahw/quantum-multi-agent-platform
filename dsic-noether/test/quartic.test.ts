import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pAdd,
  pAssertZero,
  pIsZero,
  pMono,
  pMul,
  pScale,
  pSub,
  pSubstRat,
  pVar,
  rCmp,
  rMul,
  rStr,
  rSub,
  rat,
} from "../src/continuum/poly.js";
import * as gl from "../src/continuum/green-laffont.js";
import * as q from "../src/continuum/quartic.js";
import { Rng } from "../src/core/rng.js";

describe("T9-A the chain closes on the uncoupled quartic family (v = tau^3 a - a^4/4)", () => {
  for (const n of [2, 3]) {
    it(`every link is the zero polynomial, n = ${n}`, () => {
      const f = gl.makeFamily(n);
      const p = q.qGrovesPayment(f);
      pAssertZero(q.qEnvelopeResidual(f, p), `[E] quartic n=${n}`);
      pAssertZero(q.qWelfareStationarityResidual(f), `[S] quartic n=${n}`);
      const s0 = rat(1, 2);
      const readoff = q.qGaugeReadoff(f, p, s0);
      pAssertZero(pSub(readoff, pSubstRat(p, 0, s0)), `[I] readoff n=${n}`);
      const cls = q.qClassifyPayment(f, p, s0);
      assert.equal(cls.kind, "gauge", `readoff carries own-report monomials, n=${n}`);
      pAssertZero(pSub(q.qGrovesFormResidual(f, p), q.qDefaultGaugeH(f)), `[G] residual == gauge n=${n}`);
    });
  }

  it("the charge is -(s-t)^2 (s^2+2st+3t^2)/4 exactly, equals the welfare gap, and the quadratic factor is a sum of squares", () => {
    for (const n of [2, 3]) {
      const f = gl.makeFamily(n);
      pAssertZero(q.qChargeIdentityResidual(n), `charge closed form n=${n}`);
      pAssertZero(pSub(q.qDeviationGain(f, q.qGrovesPayment(f)), q.qWelfareGapForm(f)), `charge == welfare gap n=${n}`);
      pAssertZero(q.qChargeSosResidual(f), `sum-of-squares identity n=${n}`);
    }
  });

  it("grid witness: <= 0 everywhere on the positive box, = 0 only on the diagonal", () => {
    const w = q.qChargeGridWitness(3, 8);
    assert.equal(rCmp(w.worst, rat(0)), 0, rStr(w.worst));
    assert.ok(rCmp(w.worstOffDiag, rat(0)) < 0, rStr(w.worstOffDiag));
  });

  it("Noether I: dG/deps = 0 along seeded random gauge orbits (gauge purity checked)", () => {
    const rng = new Rng(20260908);
    for (let trial = 0; trial < 3; trial++) {
      const fExt = gl.makeFamily(3, ["eps"]);
      const g = q.qRandomGauge(fExt, rng, 5);
      for (const k of g.mono.keys()) {
        const e = k.split(",").map(Number);
        assert.equal(e[0], 0, "gauge leaked into the report coordinate");
        assert.equal(e[1], 0, "gauge leaked into the type coordinate");
      }
      pAssertZero(q.qGaugeOrbitDerivative(3, g), `orbit conservation trial ${trial}`);
    }
  });

  it("Noether II: the classifier reads the gauge off and convicts off-orbit payments", () => {
    const f = gl.makeFamily(3);
    const s0 = rat(1, 2);
    const rng = new Rng(9102);
    for (let trial = 0; trial < 2; trial++) {
      const g = q.qRandomGauge(f, rng, 4);
      const withGauge = pAdd(q.qGrovesPayment(f), g);
      const cls = q.qClassifyPayment(f, withGauge, s0);
      assert.equal(cls.kind, "gauge", `trial ${trial}`);
      if (cls.kind === "gauge") {
        pAssertZero(pSub(cls.h, pSubstRat(withGauge, 0, s0)), `gauge recovered trial ${trial}`);
      }
    }
    const crime = pAdd(q.qGrovesPayment(f), pScale(pVar(f.vars, 0), rat(3, 7))); // p + (3/7)s
    const cls = q.qClassifyPayment(f, crime, s0);
    assert.equal(cls.kind, "not-dsic");
    if (cls.kind === "not-dsic") assert.ok(cls.offending > 0);
  });
});

describe("T9-A2 the kappa control on the quartic family", () => {
  it("kappa-rules are implementable for every kappa > 0; the Groves drift is exactly kappa(1-kappa^3) s^3, zero only on the kappa = 1 slice", () => {
    const f = gl.makeFamily(3);
    const s0 = rat(1, 2);
    for (const kappa of [rat(1, 2), rat(1), rat(2)]) {
      pAssertZero(q.qEnvelopeResidual(f, q.qKappaPayment(f, kappa, s0), q.qKappaRule(f, kappa)), `kappa=${rStr(kappa)} envelope`);
      const coef = rMul(kappa, rSub(rat(1), rMul(kappa, rMul(kappa, kappa))));
      const expected = pScale(pMono(f.vars, [3, 0, 0, 0], rat(1)), coef);
      pAssertZero(pSub(q.qKappaGrovesDrift(f, kappa, s0), expected), `kappa=${rStr(kappa)} drift`);
    }
    assert.ok(pIsZero(q.qKappaGrovesDrift(f, rat(1), s0)), "kappa = 1 slice is Groves");
    assert.ok(!pIsZero(q.qKappaGrovesDrift(f, rat(1, 2), s0)), "kappa = 1/2 drifts");
    assert.ok(!pIsZero(q.qKappaGrovesDrift(f, rat(2), s0)), "kappa = 2 drifts");
  });

  it("kappa < 0: the allocation 1-form has a positive 2-cycle -kappa(a-b)^2 (Rochet, not implementable)", () => {
    const cyc = q.qKappaTwoCycle(rat(3, 2), rat(1, 2), rat(-1, 5));
    assert.equal(rCmp(cyc, rat(1, 5)), 0, rStr(cyc));
    assert.ok(rCmp(cyc, rat(0)) > 0);
  });
});

describe("T9-B the no-polynomial certificate: the COUPLED quartic stage cannot host the chain", () => {
  it("the certificate's algebra: factor identity and sum-of-squares identity are zero polynomials", () => {
    pAssertZero(q.certFactorIdentity(), "(P-Q)(P^2+PQ+Q^2) == P^3 - Q^3");
    pAssertZero(q.certSosIdentity(), "A^2+AB+B^2 == (A+B/2)^2 + (3/4)B^2");
  });

  it("the t^(2d)-slice of Q^2+QP+P^2 at generic symbolic coefficients is exactly q_d^2+q_dp_d+p_d^2, nothing above 2d", () => {
    for (const d of [1, 2, 3]) {
      const w = q.certTopCoeffSlice(d);
      assert.ok(w.matches, `d=${d}: slice mismatch`);
      assert.ok(w.noOvershoot, `d=${d}: overshoot to ${w.maxExp}`);
    }
  });

  it("degree arithmetic: e + 2d = 1 with d = 0 => e = 0 has NO solution — refuted", () => {
    const v = q.certDegreeArithmetic(1);
    assert.equal(v.feasible.length, 0, JSON.stringify(v.feasible));
    assert.ok(v.refuted);
  });

  it("the assembled certificate refutes the coupled quartic FOC on the others-fixed line", () => {
    const cert = q.coupledQuarticCertificate(rat(1, 2));
    assert.equal(cert.rhsDegree, 1);
    assert.ok(cert.factorIdentityZero && cert.sosIdentityZero);
    assert.ok(cert.refuted);
  });

  it("CONTROL (the checker is sharp): at degree 3 no refutation, and X_1 = 1, X_2 = t solves it", () => {
    const c = q.certControlDegreeThree();
    assert.ok(!c.verdict.refuted);
    assert.equal(c.verdict.feasible.length, 1, "exactly (d, e) = (1, 1)");
    pAssertZero(c.solutionResidual, "(t-1)(t^2+t+1) == t^3 - 1");
  });

  it("CONTROL: the quadratic family's linear FOC is soluble — the certificate convicts the cubic shape only", () => {
    const c = q.certControlQuadratic();
    assert.ok(c.solutionExists);
    pAssertZero(c.focResidual, "restricted affine allocation satisfies x_2 - x_1 = theta_2 - theta_1");
  });

  it("SMUGGLING TRIAL: the quadratic charge -(n-1)(s-t)^2/2n counterfeited as the quartic charge is convicted with a NAMED residual", () => {
    const f = gl.makeFamily(3);
    const d = pSub(pVar(f.vars, f.sIdx), pVar(f.vars, f.tIdx));
    const fake = pScale(pMul(d, d), rat(-(f.n - 1), 2 * f.n));
    const residual = pSub(q.qDeviationGain(f, q.qGrovesPayment(f)), fake);
    assert.ok(!pIsZero(residual), "the counterfeit slipped through");
    assert.throws(() => {
      pAssertZero(residual, "forged quartic charge");
    }, /FAILED/);
  });

  it("SMUGGLING TRIAL: an affine allocation counterfeited as quartic-efficient is convicted by the FOC residual", () => {
    const residual = q.fakeAffineFOCResidual();
    assert.ok(!pIsZero(residual), "the counterfeit slipped through");
    assert.throws(() => {
      pAssertZero(residual, "forged coupled-quartic FOC");
    }, /FAILED/);
  });
});
