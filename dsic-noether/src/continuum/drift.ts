/**
 * T12 — the Groves drift QUADRATIC on the moduli space of affine rules
 * (single-fiber, quadratic utilities), executed symbolically.
 *
 * THE STAGE. n = 2, one divisible good (capacity 1), quasi-linear utilities
 * v = theta*a - a^2/2 (the v0.2.0 family with the other's type SYMBOLIC).
 * The moduli space of affine own-rules is THREE-dimensional — the intercept
 * is a function of the other's type:
 *     x(s, o) = a*s + b0 + b1*o,      x1 = 1 - x  (capacity 1).
 * (The efficient rule itself lives at a = 1/2, b0 = 1/2, b1 = -1/2 — its
 * intercept is exactly (1-o)/2 — so ANY moduli space with a constant
 * intercept cannot even host the efficient point. This is where the R18
 * sketch's parametrization slipped: see the record below.)
 *
 * THE CLAIM (machine-verified coefficient-wise over Q[s, a, b0, b1, o]):
 *   DR1  The [G] drift D = d/ds [ p + W_-i ] of the envelope-compatible
 *        payment is a QUADRATIC form on the moduli space — exactly
 *            D = (a - 2a^2) s  +  a(1 - 2b0)  -  a(1 + 2b1) o.
 *        (Verified two ways: the symbolic fiber-integral expansion, and the
 *        closed form — the zero polynomial on subtraction.)
 *   DR2  The GROVES LOCUS — where D is the zero polynomial in (s, o) — is
 *            { a = 0 }  U  { (a, b0, b1) = (1/2, 1/2, -1/2) }:
 *        the DEGENERATE slice (constant rules — the allocation ignores the
 *        report; every payment is trivially Groves) and the EFFICIENT POINT
 *        (the v0.2.0 efficient rule). On the implementable cone a > 0 the
 *        locus is that single point — Groves = efficient, the GL79 reading.
 *   DR3  The K2 kappa law is the single-parameter specialization a := k/2
 *        through the efficient intercept (b0, b1) = (1/2, -1/2): the drift
 *        collapses to exactly kappa(1-kappa)(n-1)s/n at n = 2 — cross-checked
 *        VALUE-BY-VALUE against the repo's own kappaGrovesDrift engine.
 *
 * SPEC-AS-HYPOTHESIS RECORD (the wave's ledger): the R18 design sketch
 * asserted (i) "the Groves orbit is the a = 1 slice (Q|_{a=1} = 0)" and
 * (ii) "Q is independent of b (translation invariance)". Both literal forms
 * are REFUTED by the machine: at the sketch's constant-intercept
 * parametrization the drift is D = (a-2a^2)s + a(1-o-2b) — a function of b
 * (the -2ab monomial; the kappa family hides it by pinning b = (1-o)/2),
 * and its a = 1 slice is -s + 1 - o - 2b, nonzero off one point. With the
 * intercept correctly affine in o the locus sharpens to DR2 above: a slice
 * claim survives only on the DEGENERATE a = 0. The delivered DR1-DR3 are
 * the machine truth; the smuggled "b-free" claim is CONVICTED by the
 * surviving cross-term in the tests.
 */

import { KernelError } from "../core/errors.js";
import {
  pAdd,
  pConst,
  pDeriv,
  pEval,
  pInteg,
  pIsZero,
  pMul,
  pScale,
  pSub,
  pSubstAll,
  pVar,
  pZero,
  rCmp,
  rStr,
  rSub,
  rat,
  type Poly,
  type Rat,
} from "./poly.js";

/** The moduli ring: s the own report, (a, b0, b1) the rule parameters
 * (intercept affine in the other's type), o the other's type (symbolic). */
export interface AffineFamily {
  readonly vars: readonly string[];
  readonly sIdx: 0;
  readonly aIdx: 1;
  readonly b0Idx: 2;
  readonly b1Idx: 3;
  readonly oIdx: 4;
}

export function makeAffineFamily(): AffineFamily {
  return {
    vars: ["s", "a", "b0", "b1", "o"],
    sIdx: 0,
    aIdx: 1,
    b0Idx: 2,
    b1Idx: 3,
    oIdx: 4,
  };
}

/** The affine own-rule x(s, o) = a s + b0 + b1 o. */
export function affineRule(f: AffineFamily): Poly {
  const o = pVar(f.vars, f.oIdx);
  return pAdd(
    pAdd(
      pMul(pVar(f.vars, f.aIdx), pVar(f.vars, f.sIdx)),
      pVar(f.vars, f.b0Idx),
    ),
    pMul(pVar(f.vars, f.b1Idx), o),
  );
}

/** The envelope-compatible payment: the fiber integral of (s - x) x' (the
 * [E] face). The gauge C(o) is omitted — the drift below is gauge-invariant
 * (C(o) has no s-monomials; the tests verify). */
export function affineEnvelopePayment(f: AffineFamily): Poly {
  const x = affineRule(f);
  const integrand = pMul(pSub(pVar(f.vars, f.sIdx), x), pDeriv(x, f.sIdx));
  return pInteg(integrand, f.sIdx);
}

/** The others' welfare at the reported allocation: W = o x1 - x1^2/2. */
export function affineOthersWelfare(f: AffineFamily): Poly {
  const x1 = pSub(pConst(f.vars, rat(1)), affineRule(f));
  const o = pVar(f.vars, f.oIdx);
  return pSub(pMul(o, x1), pScale(pMul(x1, x1), rat(1, 2)));
}

/** DR1: the [G] drift D = d/ds [ p + W ], symbolic in (s, a, b0, b1, o). */
export function affineDrift(f: AffineFamily): Poly {
  return pDeriv(pAdd(affineEnvelopePayment(f), affineOthersWelfare(f)), f.sIdx);
}

/** DR1's closed form: D = (a - 2a^2) s + a(1 - 2b0) - a(1 + 2b1) o. */
export function affineDriftClosedForm(f: AffineFamily): Poly {
  const a = pVar(f.vars, f.aIdx);
  const b0 = pVar(f.vars, f.b0Idx);
  const b1 = pVar(f.vars, f.b1Idx);
  const o = pVar(f.vars, f.oIdx);
  const quad = pSub(a, pScale(pMul(a, a), rat(2)));
  const const0 = pMul(a, pSub(pConst(f.vars, rat(1)), pScale(b0, rat(2))));
  const const1 = pMul(a, pAdd(pConst(f.vars, rat(1)), pScale(b1, rat(2))));
  return pSub(pAdd(pMul(pVar(f.vars, f.sIdx), quad), const0), pMul(const1, o));
}

/** DR1's acceptance face: the symbolic expansion minus the closed form —
 * the zero polynomial iff the quadratic law is exact. */
export function affineDriftResidual(f: AffineFamily): Poly {
  return pSub(affineDrift(f), affineDriftClosedForm(f));
}

/** The drift's three coefficient polynomials (in the basis s, 1, o):
 * coefS = a - 2a^2 (responsiveness), coef0 = a(1 - 2b0), coef1 = a(1 + 2b1).
 * DR2's locus is their common zero set. */
export function affineDriftCoefficients(f: AffineFamily): {
  coefS: Poly;
  coef0: Poly;
  coef1: Poly;
} {
  const a = pVar(f.vars, f.aIdx);
  const b0 = pVar(f.vars, f.b0Idx);
  const b1 = pVar(f.vars, f.b1Idx);
  return {
    coefS: pSub(a, pScale(pMul(a, a), rat(2))),
    coef0: pMul(a, pSub(pConst(f.vars, rat(1)), pScale(b0, rat(2)))),
    coef1: pMul(a, pAdd(pConst(f.vars, rat(1)), pScale(b1, rat(2)))),
  };
}

/** DR2: is the drift identically zero at (a, b0, b1), with (s, o) SYMBOLIC? */
export function driftZeroAt(
  f: AffineFamily,
  a: Rat,
  b0: Rat,
  b1: Rat,
): boolean {
  const { coefS, coef0, coef1 } = affineDriftCoefficients(f);
  const subs = [pConst(f.vars, a), pConst(f.vars, b0), pConst(f.vars, b1)];
  const idxs = [f.aIdx, f.b0Idx, f.b1Idx];
  return (
    pIsZero(pSubstAll(coefS, idxs, subs)) &&
    pIsZero(pSubstAll(coef0, idxs, subs)) &&
    pIsZero(pSubstAll(coef1, idxs, subs))
  );
}

/** The Groves locus characterization as a grid census: over the (a, b0, b1)
 * grid, the drift vanishes identically exactly on {a = 0} U {(1/2, 1/2,
 * -1/2)}. Returns the census rows that violate the characterization (empty
 * iff DR2 holds on the grid). */
export function grovesLocusViolations(f: AffineFamily, steps: number): Rat[][] {
  if (!Number.isInteger(steps) || steps < 1) {
    // reuse of cert/d-range: a range guard on a census routine
    throw new KernelError(
      "cert/d-range",
      `grovesLocusViolations: steps >= 1 required, got ${steps}`,
    );
  }
  const bad: Rat[][] = [];
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      for (let k = 0; k <= steps; k++) {
        const aV = rat(i, steps);
        const b0V = rat(j, steps);
        // b1 ranges over the SIGNED half grid (the efficient intercept -1/2)
        const b1V = rSub(rat(k, steps * 2), rat(1));
        const zero = driftZeroAt(f, aV, b0V, b1V);
        const onLocus =
          rCmp(aV, rat(0)) === 0 ||
          (rCmp(aV, rat(1, 2)) === 0 &&
            rCmp(b0V, rat(1, 2)) === 0 &&
            rCmp(b1V, rat(-1, 2)) === 0);
        if (zero !== onLocus) bad.push([aV, b0V, b1V]);
      }
    }
  }
  return bad;
}

/** The efficient point of the moduli space: (1/2, 1/2, -1/2) — the v0.2.0
 * efficient rule on the n = 2 fiber. */
export function efficientPointSubstitutions(f: AffineFamily): {
  aSub: Poly;
  b0Sub: Poly;
  b1Sub: Poly;
} {
  return {
    aSub: pConst(f.vars, rat(1, 2)),
    b0Sub: pConst(f.vars, rat(1, 2)),
    b1Sub: pConst(f.vars, rat(-1, 2)),
  };
}

/** The drift restricted to the efficient point — the zero polynomial (the
 * Groves verdict at the efficient rule). */
export function efficientPointDrift(f: AffineFamily): Poly {
  const { aSub, b0Sub, b1Sub } = efficientPointSubstitutions(f);
  return pSubstAll(
    affineDrift(f),
    [f.aIdx, f.b0Idx, f.b1Idx],
    [aSub, b0Sub, b1Sub],
  );
}

/** DR3: the kappa specialization — a := kappa/2 (the a-slot RE-USED as the
 * symbolic kappa axis) through the efficient intercept (1/2, -1/2). The
 * result is a polynomial in (s, kappa, o): exactly kappa(1-kappa)s/2. */
export function kappaSpecializedDrift(f: AffineFamily): Poly {
  const aSub = pScale(pVar(f.vars, f.aIdx), rat(1, 2));
  const b0Sub = pConst(f.vars, rat(1, 2));
  const b1Sub = pConst(f.vars, rat(-1, 2));
  return pSubstAll(
    affineDrift(f),
    [f.aIdx, f.b0Idx, f.b1Idx],
    [aSub, b0Sub, b1Sub],
  );
}

/** DR3's expected law: kappa(1-kappa)(n-1)s/n at n = 2, on the specialized
 * ring (the a-slot carrying kappa). */
export function kappaExpectedLaw(f: AffineFamily): Poly {
  const k = pVar(f.vars, f.aIdx);
  return pScale(
    pMul(pVar(f.vars, f.sIdx), pMul(k, pSub(pConst(f.vars, rat(1)), k))),
    rat(1, 2),
  );
}

/** The kappa-law acceptance face: specialized drift minus the law. */
export function kappaSpecializationResidual(f: AffineFamily): Poly {
  return pSub(kappaSpecializedDrift(f), kappaExpectedLaw(f));
}

/** A drift value at a concrete (s, a, b0, b1, o) point — the value-level
 * cross-check channel (used against the repo's kappaGrovesDrift). */
export function driftValueAt(
  f: AffineFamily,
  s: Rat,
  a: Rat,
  b0: Rat,
  b1: Rat,
  o: Rat,
): Rat {
  return pEval(affineDrift(f), [s, a, b0, b1, o]);
}

/** The intercept-sensitivity probe: D(a, b0, b1, o) - D(a, 0, 0, o) — a
 * nonzero polynomial iff the drift DOES see the intercept (the smuggled
 * "b-free" claim's refutation; the tests print the surviving cross-terms). */
export function driftInterceptSensitivity(f: AffineFamily): Poly {
  const zeroed = pSubstAll(
    affineDrift(f),
    [f.b0Idx, f.b1Idx],
    [pZero(f.vars), pZero(f.vars)],
  );
  return pSub(affineDrift(f), zeroed);
}

/** Ordered-field sign summary — the implementable-cone reading helper. */
export function signOf(v: Rat): string {
  return rCmp(v, rat(0)) < 0 ? "-" : rCmp(v, rat(0)) > 0 ? "+" : "0";
}

/** A compact human-readable rendering of a drift polynomial. */
export function driftStr(p: Poly): string {
  if (pIsZero(p)) return "0";
  const terms = [...p.mono.entries()].map(([k, c]) => {
    const exps = k.split(",").map(Number);
    const mono = exps
      .map((e, i) =>
        e === 0
          ? ""
          : e === 1
            ? (p.vars[i] as string)
            : `${p.vars[i] as string}^${e}`,
      )
      .filter((t) => t !== "")
      .join(" ");
    return `${rStr(c)}[${mono === "" ? "1" : mono}]`;
  });
  return terms.join(" + ");
}
