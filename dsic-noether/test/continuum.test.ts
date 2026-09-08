import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gcdBig,
  pAdd,
  pAssertZero,
  pConst,
  pDeriv,
  pEval,
  pIsZero,
  pMono,
  pMul,
  pScale,
  pSub,
  pSubst,
  pSubstAll,
  pSubstRat,
  pVar,
  pZero,
  rAdd,
  rCmp,
  rDiv,
  rMul,
  rStr,
  rSub,
  rat,
  type Rat,
} from "../src/continuum/poly.js";
import * as gl from "../src/continuum/green-laffont.js";
import { Rng } from "../src/core/rng.js";

describe("T0 the polynomial engine (continuum arithmetic)", () => {
  it("rational arithmetic normalizes: 6/4 -> 3/2, signs on the denominator, gcd(12,18)=6", () => {
    assert.equal(rStr(rat(6, 4)), "3/2");
    assert.equal(rStr(rat(1, -2)), "-1/2");
    assert.equal(gcdBig(12n, 18n), 6n);
    assert.equal(rStr(rAdd(rat(1, 3), rat(1, 6))), "1/2");
    assert.equal(rStr(rMul(rat(2, 3), rat(3, 4))), "1/2");
    assert.equal(rStr(rDiv(rat(1, 2), rat(3, 4))), "2/3");
  });

  it("derivative matches numeric differentiation on a bivariate polynomial", () => {
    const vars = ["x", "y"];
    const p = pAdd(
      pAdd(pScale(pMul(pVar(vars, 0), pVar(vars, 0)), rat(3)), pMul(pVar(vars, 0), pVar(vars, 1))),
      pConst(vars, rat(-5, 2)),
    );
    const dpx = pDeriv(p, 0);
    const at = [rat(3, 2), rat(-1, 3)];
    const eps = rat(1, 1000000);
    const numeric = rMul(rSub(pEval(p, [rAdd(at[0] as Rat, eps), at[1] as Rat]), pEval(p, [at[0] as Rat, at[1] as Rat])), rat(1000000));
    assert.ok(rCmp(rSub(pEval(dpx, at), numeric), rat(1, 100)) < 0);
  });

  it("REGRESSION pSubst carries the substituted variable to its own degree (s^2 -> t^2, not t)", () => {
    const vars = ["s", "y"];
    const p = pScale(pMul(pVar(vars, 0), pVar(vars, 0)), rat(-1, 4)); // -s^2/4
    const subbed = pSubst(p, 0, pVar(vars, 1));
    assert.ok(pIsZero(pSub(subbed, pScale(pMul(pVar(vars, 1), pVar(vars, 1)), rat(-1, 4)))));
  });

  it("REGRESSION pSubstAll is simultaneous: (x, y) -> (-y, x) maps x to -y even with y present", () => {
    const vars = ["x", "y"];
    const p = pVar(vars, 0); // x
    const negY = pScale(pVar(vars, 1), rat(-1));
    const subbed = pSubstAll(p, [0, 1], [negY, pVar(vars, 0)]);
    assert.ok(pIsZero(pSub(subbed, negY)));
    // and xy -> -xy
    const xy = pMul(pVar(vars, 0), pVar(vars, 1));
    const subbedXY = pSubstAll(xy, [0, 1], [negY, pVar(vars, 0)]);
    assert.ok(pIsZero(pAdd(subbedXY, pMul(pVar(vars, 0), pVar(vars, 1)))));
  });

  it("variable mismatch between operands THROWS (dimension accounting is the caller's)", () => {
    assert.throws(() => pAdd(pZero(["a"]), pZero(["b"])), /mismatch/);
  });
});

describe("T5 the continuum forms: closedness is the Helmholtz face", () => {
  it("efficient two-good allocation: the Jacobian is symmetric (d alpha = 0)", () => {
    const { x1, x2 } = gl.twoGoodOwnAllocation(3);
    pAssertZero(gl.allocationClosednessResidual(x1, x2), "two-good closedness");
  });

  it("the skew family crosses the implementable locus exactly at c = 0", () => {
    for (const c of [rat(0), rat(1, 7), rat(-2, 9)]) {
      const skew = gl.skewRule(c);
      const res = gl.allocationClosednessResidual(skew.x1, skew.x2);
      pAssertZero(pSub(res, pConst(skew.x1.vars, rMul(rat(-2), c))), `skew c=${rStr(c)}`);
      const loop = gl.rectangleCycleIntegral(skew.x1, skew.x2, rat(2, 5), rat(2, 5), rat(1, 5), rat(1, 5), rat(1, 2), rat(1, 2));
      const expected = rMul(rMul(rMul(rat(-2), c), rat(1, 5)), rat(1, 5));
      assert.equal(rCmp(loop, expected), 0);
      // for c != 0 a POSITIVE cycle exists (reverse the orientation)
      if (c.n !== 0n) {
        const positive = loop.n < 0n ? rMul(loop, rat(-1)) : loop;
        assert.ok(positive.n > 0n, `positive cycle ${rStr(positive)}`);
      }
    }
  });

  it("the efficient rule's rectangle loop is exactly 0", () => {
    const eff = gl.twoGoodOwnAllocation(3);
    const loop = gl.rectangleCycleIntegral(eff.x1, eff.x2, rat(2, 5), rat(2, 5), rat(1, 5), rat(1, 5), rat(1, 2), rat(1, 2));
    assert.equal(rCmp(loop, rat(0)), 0, rStr(loop));
  });
});

describe("T8 the chain: [E]nvelope -> [I]ntegration -> [S]tationarity -> [G]roves", () => {
  for (const n of [2, 3]) {
    it(`every link is the zero polynomial, n = ${n}`, () => {
      const f = gl.makeFamily(n);
      pAssertZero(gl.envelopeResidual(f, gl.grovesPayment(f)), `[E] n=${n}`);
      pAssertZero(gl.welfareStationarityResidual(f), `[S] n=${n}`);
      const s0 = rat(2, 5);
      const readoff = gl.gaugeReadoff(f, gl.grovesPayment(f), s0);
      pAssertZero(pSub(readoff, pSubstRat(gl.grovesPayment(f), 0, s0)), `[I] readoff n=${n}`);
      const gres = gl.grovesFormResidual(f, gl.grovesPayment(f));
      pAssertZero(pSub(gres, gl.pivotH(f)), `[G] residual == pivot n=${n}`);
    });
  }

  it("the interior guard holds on the family's region (corners, exact)", () => {
    for (const n of [2, 3, 4]) {
      const g = gl.interiorGuard(n);
      assert.ok(g.ok, `n=${n}: x range [${rStr(g.lo)}, ${rStr(g.hi)}]`);
    }
  });
});

describe("T6 Noether I: the charge, its closed form, its orbit conservation", () => {
  it("the charge G = -(n-1)(s-t)^2/(2n) EXACTLY, and equals the welfare gap", () => {
    for (const n of [2, 3]) {
      pAssertZero(gl.chargeIdentityResidual(n), `charge closed form n=${n}`);
      const f = gl.makeFamily(n);
      pAssertZero(pSub(gl.deviationGain(f, gl.grovesPayment(f)), gl.welfareGapForm(f)), `charge == welfare gap n=${n}`);
    }
  });

  it("grid witness: <= 0 everywhere, = 0 only on the diagonal (exact rationals)", () => {
    const w = gl.chargeGridWitness(3, 8);
    assert.equal(rCmp(w.worst, rat(0)), 0, rStr(w.worst));
    assert.ok(rCmp(w.worstOffDiag, rat(0)) < 0, rStr(w.worstOffDiag));
  });

  it("gauge-orbit conservation: dG/deps = 0 for seeded random gauges", () => {
    const rng = new Rng(20260907);
    for (let trial = 0; trial < 3; trial++) {
      const fExt = gl.makeFamily(3, ["eps"]);
      const g = gl.randomGauge(fExt, rng, 5);
      // gauge purity: no own-report or true-type monomials
      for (const k of g.mono.keys()) {
        const e = k.split(",").map(Number);
        assert.equal(e[0], 0, "gauge leaked into the report coordinate");
        assert.equal(e[1], 0, "gauge leaked into the type coordinate");
      }
      pAssertZero(gl.gaugeOrbitDerivative(3, g), `orbit conservation trial ${trial}`);
    }
  });
});

describe("T7 Noether II: the gauge identity and the classification", () => {
  it("the solver READS OFF the gauge from any DSIC payment (uniqueness, executed)", () => {
    const rng = new Rng(713);
    const f = gl.makeFamily(3);
    const s0 = rat(2, 5);
    for (let trial = 0; trial < 3; trial++) {
      const g = gl.randomGauge(f, rng, 4);
      const p = pAdd(gl.grovesPayment(f), g);
      const cls = gl.classifyPayment(f, p, s0);
      assert.equal(cls.kind, "gauge", `trial ${trial}`);
      if (cls.kind === "gauge") {
        pAssertZero(pSub(cls.h, pSubstRat(p, 0, s0)), `gauge recovered trial ${trial}`);
      }
    }
  });

  it("SMUGGLING TRIAL: a payment off the gauge orbit is CONVICTED on sight", () => {
    const f = gl.makeFamily(3);
    const crime = pAdd(gl.grovesPayment(f), pScale(pVar(f.vars, 0), rat(3, 7)));
    const cls = gl.classifyPayment(f, crime, rat(2, 5));
    assert.equal(cls.kind, "not-dsic");
    if (cls.kind === "not-dsic") assert.ok(cls.offending > 0);
  });

  it("SMUGGLING TRIAL: a forged zero-identity (planted coefficient) is convicted by pAssertZero", () => {
    const vars = ["s", "y"];
    const forged = pAdd(pVar(vars, 0), pMono(vars, [0, 1], rat(1, 7))); // s + y/7, claimed zero
    assert.throws(() => {
      pAssertZero(forged, "forged identity");
    }, /FAILED/);
  });

  it("CENSUS EXTENSION (v0.3.0): a two-parameter non-linear gauge is read off coefficient-exact; a hidden own-report term is convicted", () => {
    const f = gl.makeFamily(3);
    const s0 = rat(2, 5);
    const h = gl.nonlinearTwoParamGauge(f, rat(2, 7), rat(-3, 5));
    const p = pAdd(gl.grovesPayment(f), h);
    const cls = gl.classifyPayment(f, p, s0);
    assert.equal(cls.kind, "gauge", "the nonlinear gauge was wrongly convicted");
    if (cls.kind === "gauge") {
      pAssertZero(pSub(cls.h, pSubstRat(p, 0, s0)), "two-parameter gauge recovered exactly");
    }
    // the counterfeit: the same gauge with a hidden (1/11) s^2 term
    const crime = pAdd(p, pScale(pMul(pVar(f.vars, 0), pVar(f.vars, 0)), rat(1, 11)));
    const clsCrime = gl.classifyPayment(f, crime, s0);
    assert.equal(clsCrime.kind, "not-dsic", "the hidden own-report term slipped through");
    if (clsCrime.kind === "not-dsic") assert.ok(clsCrime.offending > 0);
  });
});

describe("K1 the off-gauge crime and its exact price", () => {
  it("p + eps*s breaks the envelope by EXACTLY -eps", () => {
    const res = gl.offGaugeEnvelopeResidual(3);
    assert.equal(rCmp(res.epsCoeff, rat(-1)), 0, rStr(res.epsCoeff));
    assert.equal(rCmp(res.constantTerm, rat(0)), 0);
  });

  it("the profitable deviation at s* = t - eps*n/(n-1) is worth exactly eps^2 n/(2(n-1))", () => {
    const eps = rat(1, 20);
    const crime = gl.offGaugeCrime(3, eps);
    pAssertZero(pDeriv(crime.substituted, crime.f.tIdx), "crime price constant in t");
    assert.equal(rCmp(crime.gainAt, crime.expected), 0, `${rStr(crime.gainAt)} vs ${rStr(crime.expected)}`);
    assert.ok(rCmp(crime.gainAt, rat(0)) > 0, "the deviation is profitable");
  });
});

describe("K2 efficiency is load-bearing: kappa family + decreasing rule", () => {
  it("kappa-rules are implementable (own envelope exact) for every kappa, Groves ONLY at kappa = 1", () => {
    const f = gl.makeFamily(3);
    const s0 = rat(2, 5);
    for (const kappa of [rat(1, 2), rat(1), rat(2)]) {
      pAssertZero(gl.envelopeResidual(f, gl.kappaPayment(f, kappa, s0), gl.kappaRule(f, kappa)), `kappa=${rStr(kappa)} envelope`);
      const expected = pScale(pVar(f.vars, 0), rMul(rMul(kappa, rSub(rat(1), kappa)), rat(2, 3)));
      pAssertZero(pSub(gl.kappaGrovesDrift(f, kappa, s0), expected), `kappa=${rStr(kappa)} drift`);
    }
    // the kappa = 1 drift is the zero polynomial; kappa = 1/2 is not (the slice is sharp)
    assert.ok(pIsZero(gl.kappaGrovesDrift(f, rat(1), s0)));
    assert.ok(!pIsZero(gl.kappaGrovesDrift(f, rat(1, 2), s0)));
  });

  it("the decreasing rule has a positive 2-cycle c(a-b)^2 — not implementable at all", () => {
    const c = rat(1, 5);
    const cyc = gl.decreasingRuleCycle(rat(3, 5), rat(2, 5), c);
    assert.equal(rCmp(cyc, rat(1, 125)), 0, rStr(cyc));
    assert.ok(rCmp(cyc, rat(0)) > 0);
  });

  it("against EVERY affine payment an exactly profitable deviation exists", () => {
    const c = rat(1, 5);
    const d = rat(9, 10);
    for (const beta of [rat(-1), rat(0), rat(1)]) {
      const w = gl.decreasingProfitableDeviation(rat(1, 2), c, d, beta);
      assert.ok(rCmp(w.gain, rat(0)) > 0, `beta=${rStr(beta)}: ${rStr(w.gain)}`);
    }
  });
});

describe("K3 topology is load-bearing: closed does NOT imply exact on an annulus", () => {
  it("the winding form is CLOSED, coefficient-wise", () => {
    pAssertZero(gl.windingCurlNumerator(), "curl(omega)");
  });

  it("quarter-turn invariance (all four diamond sides integrate equally)", () => {
    const qt = gl.windingQuarterTurnCheck();
    pAssertZero(qt.pbPminusP, "dx-component");
    pAssertZero(qt.pbQminusQ, "dy-component");
  });

  it("the side pullback is exactly dt/(2t^2-2t+1) with the atan antiderivative identity", () => {
    const ds = gl.diamondSideIdentities();
    pAssertZero(pSub(ds.pullbackNumerator, pConst(ds.pullbackNumerator.vars, rat(1))), "pullback numerator == 1");
    pAssertZero(ds.antiderivativeCheck, "antiderivative identity");
  });

  it("the diamond loop is 2*pi to 11 digits — the SMUGGLED claim 'closed => exact everywhere' is convicted by this loop", () => {
    const side = gl.diamondSideSimpson(4000);
    assert.ok(Math.abs(side - Math.PI / 2) < 1e-11, String(side));
    const total = 4 * side;
    assert.ok(Math.abs(total - 2 * Math.PI) < 1e-10, String(total));
  });
});

describe("K4 smoothness is load-bearing: the second-price kink", () => {
  it("on both open regions the envelope holds bitwise on rational pairs", () => {
    const r1 = gl.secondPriceEnvelopePair(rat(3, 5), rat(11, 20), rat(1, 2));
    const r2 = gl.secondPriceEnvelopePair(rat(5, 8), rat(9, 16), rat(1, 2));
    assert.ok(r1.ok);
    assert.ok(r2.ok);
  });

  it("crossing the diagonal by any eps > 0 moves the allocation by exactly 1", () => {
    const jump = gl.secondPriceKinkJump(rat(1, 2), rat(1, 100));
    assert.equal(rCmp(jump, rat(1)), 0, rStr(jump));
  });
});
