import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  axisQuadraticNoPoleCertificate,
  classifyPeriod,
  curlOf,
  greenIdentity,
  loopSimpson,
  poleCensus,
  poleCensusByRationalGrid,
  poleCensusBySlices,
  polygonDoubleIntegral,
  polygonLineIntegral,
  polynomialForm,
  radialPotentialResidual,
  rationalCurlNumerator,
  simplexMonomialIntegral,
  sturmRootCount,
  translatedWindingForm,
  triangleIntegral,
  uDivMod,
  uSturmChain,
  type PolygonLoop,
  type Pt,
  type UPoly,
} from "../src/continuum/period.js";
import {
  pAdd,
  pAssertZero,
  pConst,
  pEval,
  pIsZero,
  pMul,
  pScale,
  pSub,
  pVar,
  rAdd,
  rCmp,
  rMul,
  rStr,
  rSub,
  rat,
  type Poly,
  type Rat,
} from "../src/continuum/poly.js";
import * as gl from "../src/continuum/green-laffont.js";
import { KernelError } from "../src/core/errors.js";

const V = ["x", "y"] as const;
const x = pVar(V, 0);
const y = pVar(V, 1);

const pt = (nx: number, ny: number): Pt => ({ x: rat(nx), y: rat(ny) });

/** The concave C (a 4x4 frame with the middle-right 3x2 notch removed) —
 * counter-clockwise, area exactly 10 by the shoelace formula, and NOT
 * star-shaped from v0 (the fan triangulation genuinely misprices it). */
const CONCAVE_C: PolygonLoop = [
  pt(0, 0),
  pt(4, 0),
  pt(4, 4),
  pt(0, 4),
  pt(0, 3),
  pt(3, 3),
  pt(3, 1),
  pt(0, 1),
];

/** The unit diamond — K3's loop, winding once around the origin. */
const DIAMOND: PolygonLoop = [pt(1, 0), pt(0, 1), pt(-1, 0), pt(0, -1)];

const DIAMOND_BOX = { xLo: rat(-1), xHi: rat(1), yLo: rat(-1), yHi: rat(1) };
const WIDE_BOX = { xLo: rat(-2), xHi: rat(2), yLo: rat(-2), yHi: rat(2) };

const D5 = pAdd(
  pMul(pSub(x, pConst(V, rat(5))), pSub(x, pConst(V, rat(5)))),
  pMul(y, y),
);

describe("T11 the period/Green classifier (v0.5.0)", () => {
  it("(a) the simplex closed form and the cone area: c!d!/(c+d+2)! spots, shoelace on the CONCAVE C", () => {
    assert.equal(rStr(simplexMonomialIntegral(0, 0)), "1/2");
    assert.equal(rStr(simplexMonomialIntegral(1, 1)), "1/24");
    assert.equal(rStr(simplexMonomialIntegral(2, 0)), "1/12");
    assert.equal(rStr(simplexMonomialIntegral(3, 2)), "1/420"); // 3!2!/7! = 12/5040
    // f = 1: the cone integral is the directed area == shoelace == exactly 10
    const area = polygonDoubleIntegral(pConst(V, rat(1)), CONCAVE_C);
    assert.equal(rStr(area), "10");
    // spot: f = xy over the reference-corner triangle is exactly 1/24, and
    // reversing the orientation flips the sign exactly
    const fxy = pMul(x, y);
    assert.equal(
      rStr(triangleIntegral(fxy, pt(0, 0), pt(1, 0), pt(0, 1))),
      "1/24",
    );
    assert.equal(
      rStr(triangleIntegral(fxy, pt(0, 0), pt(0, 1), pt(1, 0))),
      "-1/24",
    );
  });

  it("(a) GREEN EXECUTED on NONZERO curl, rectangle: line == area exactly, both matching the repo's -2cwh", () => {
    // the T5 skew form: alpha = (x + c y) dx + (y - c x) dy, curl exactly -2c
    const c = rat(1, 3);
    const P = pAdd(x, pScale(y, c));
    const Q = pSub(y, pScale(x, c));
    assert.equal(rStr(pEval(curlOf(P, Q), [rat(0), rat(0)])), "-2/3"); // nonzero: not vacuous
    const rect: PolygonLoop = [pt(1, 2), pt(3, 2), pt(3, 5), pt(1, 5)];
    const g = greenIdentity(P, Q, rect);
    assert.ok(g.holds, `line ${rStr(g.line)} vs area ${rStr(g.area)}`);
    assert.equal(rStr(g.line), "-4"); // -2cwh = -2*(1/3)*2*3
    // cross-check against the repo's own T5 engine (same rectangle, others 7/5)
    const { x1, x2 } = gl.skewRule(c);
    const repo = gl.rectangleCycleIntegral(
      x1,
      x2,
      rat(1),
      rat(2),
      rat(2),
      rat(3),
      rat(7, 5),
      rat(7, 5),
    );
    assert.equal(rStr(repo), "-4");
  });

  it("(a) GREEN EXECUTED on the CONCAVE C: the cone absorbs the notch; a FAN triangulation is convicted of mispricing it", () => {
    const c = rat(1, 3);
    const Pskew = pAdd(x, pScale(y, c));
    const Qskew = pSub(y, pScale(x, c));
    const g1 = greenIdentity(Pskew, Qskew, CONCAVE_C);
    assert.ok(
      g1.holds,
      `skew on C: line ${rStr(g1.line)} area ${rStr(g1.area)}`,
    );
    // a cubic form with NONCONSTANT curl 2x^2 — the load-bearing control: the
    // UNSIGNED fan (each triangle re-oriented counterclockwise — the naive
    // convex-world triangulation) ADDS the notch instead of subtracting it
    // and misprices the loop the directed cone prices exactly. (The SIGNED
    // fan is pointwise the winding-number decomposition — also exact; the
    // crime available to an implementation is dropping the sign.)
    const Pc = pMul(pMul(x, x), y);
    const Qc = pAdd(pMul(y, y), pMul(pMul(x, x), x));
    const g2 = greenIdentity(Pc, Qc, CONCAVE_C);
    assert.ok(
      g2.holds,
      `cubic on C: line ${rStr(g2.line)} area ${rStr(g2.area)}`,
    );
    const naive = unsignedFanDoubleIntegral(curlOf(Pc, Qc), CONCAVE_C);
    assert.ok(
      rCmp(naive, g2.area) !== 0,
      `unsigned fan ${rStr(naive)} must differ from the true flux ${rStr(g2.area)}`,
    );
    // and the unsigned fan is wrong on the AREA itself (f = 1): it counts the
    // notch as filled — exactly the convexity assumption the cone drops
    const naiveArea = unsignedFanDoubleIntegral(pConst(V, rat(1)), CONCAVE_C);
    assert.ok(
      rCmp(naiveArea, rat(10)) !== 0,
      `unsigned fan area ${rStr(naiveArea)} != the true shoelace area 10`,
    );
  });

  it("(b) the radial potential: a CLOSED polynomial form gets its global potential coefficient-wise, period exactly 0 around every loop", () => {
    // Phi0 = x^3 y + x y^3 + x^2 => P = 3x^2 y + y^3 + 2x, Q = x^3 + 3 x y^2
    const P = pAdd(
      pAdd(pScale(pMul(pMul(x, x), y), rat(3)), pMul(pMul(y, y), y)),
      pScale(x, rat(2)),
    );
    const Q = pAdd(pMul(pMul(x, x), x), pScale(pMul(x, pMul(y, y)), rat(3)));
    const res = radialPotentialResidual(P, Q);
    pAssertZero(res.dx, "dPhi/dx == P");
    pAssertZero(res.dy, "dPhi/dy == Q");
    const loops: PolygonLoop[] = [
      CONCAVE_C,
      DIAMOND,
      [pt(2, 2), pt(5, 2), pt(5, 6), pt(2, 6)],
      [pt(3, 3), pt(-2, 4), pt(-4, -1), pt(0, -5), pt(4, -2)], // a generic convex pentagon
    ];
    for (const loop of loops) {
      assert.equal(
        rStr(polygonLineIntegral(P, Q, loop)),
        "0",
        "closed polynomial => period exactly 0",
      );
    }
    const v = classifyPeriod(polynomialForm(P, Q), DIAMOND, DIAMOND_BOX);
    assert.ok(v.kind === "polynomial-exact");
    assert.equal(rStr(v.period), "0");
  });

  it("(b) SMUGGLING TRIAL I: the forged-CLOSED form is convicted at the potential identity (skew c = 1/3)", () => {
    const c = rat(1, 3);
    const P = pAdd(x, pScale(y, c));
    const Q = pSub(y, pScale(x, c));
    const res = radialPotentialResidual(P, Q);
    assert.ok(
      !pIsZero(res.dx) && !pIsZero(res.dy),
      "the non-closed form leaves nonzero residuals — convicted",
    );
    // the classifier hands back the honest not-closed verdict (both routes)
    const v = classifyPeriod(polynomialForm(P, Q), DIAMOND, DIAMOND_BOX);
    assert.ok(v.kind === "not-closed" && v.holds);
  });

  it("(b) SMUGGLING TRIAL II: the forged 'closed polynomial form with a NONZERO period around a hole' is convicted exactly", () => {
    // the smuggler takes the genuinely-closed polynomial form of (b) and
    // claims it still carries a winding obstruction (period 2*pi) around
    // the diamond — the hole-shaped lie: the machine integrates EXACTLY
    const P = pAdd(
      pAdd(pScale(pMul(pMul(x, x), y), rat(3)), pMul(pMul(y, y), y)),
      pScale(x, rat(2)),
    );
    const Q = pAdd(pMul(pMul(x, x), x), pScale(pMul(x, pMul(y, y)), rat(3)));
    const period = polygonLineIntegral(P, Q, DIAMOND);
    assert.equal(
      rStr(period),
      "0",
      "the closed polynomial form's period is exactly 0 — no hole can host one",
    );
    assert.notEqual(
      rStr(period),
      rStr(rat(6, 1)),
      "the forged 2*pi-scale claim is convicted",
    );
    const g = greenIdentity(P, Q, DIAMOND);
    assert.ok(
      g.holds && rStr(g.area) === "0",
      "curl exactly 0 — Green's area route agrees with 0",
    );
  });

  it("(c) the Sturm engine: exact root counts, including the none and the double", () => {
    const f: UPoly = [rat(-6), rat(11), rat(-6), rat(1)]; // (x-1)(x-2)(x-3)
    assert.equal(sturmRootCount(f, rat(0), rat(4)), 3);
    assert.equal(sturmRootCount(f, rat(3, 2), rat(4)), 2);
    assert.equal(sturmRootCount(f, rat(0), rat(3, 2)), 1);
    assert.equal(sturmRootCount(f, rat(7, 2), rat(10)), 0);
    assert.equal(sturmRootCount([rat(1), rat(0), rat(1)], rat(-5), rat(5)), 0); // x^2+1: none
    assert.equal(sturmRootCount([rat(0), rat(0), rat(1)], rat(-2), rat(2)), 1); // x^2: the double counts once
    const { q, r } = uDivMod([rat(-1), rat(0), rat(1)], [rat(-1), rat(1)]); // (x^2-1)/(x-1)
    assert.equal(rStr(q[1] as Rat), "1");
    assert.equal(uDegreeOf(r), -1);
    assert.ok(uSturmChain(f).length >= 3);
  });

  it("(c) the pole census: hit, slice, certificate, and the honest undecided", () => {
    const D0 = pAdd(pMul(x, x), pMul(y, y)); // x^2+y^2: the pole at (0,0)
    // hit: the grid finds the exact rational root (0,0) in the diamond box
    const hit = poleCensusByRationalGrid(D0, DIAMOND_BOX, 4);
    assert.ok(
      hit.hit !== null && rStr(hit.hit.x) === "0" && rStr(hit.hit.y) === "0",
    );
    // slice: some y-slice of D0 has a Sturm-counted root in (-1,1)
    assert.ok(poleCensusBySlices(D0, DIAMOND_BOX, 4).sliceRoots > 0);
    // certificate: D5 >= 9 > 0 on the wide box — the no-pole proof
    const cert = axisQuadraticNoPoleCertificate(D5, WIDE_BOX);
    assert.ok(cert !== null && rStr(cert.lowerBound) === "9");
    // the full census flips between the two denominators
    assert.equal(poleCensus(D0, WIDE_BOX).kind, "hit");
    assert.equal(poleCensus(D5, WIDE_BOX).kind, "no-pole-cert");
    // the honest undecided: x^2 y^2 + 1 has NO real zero anywhere, but it is
    // not an axis-centered quadratic and no channel can PROVE it — undecided
    const Dxxyy = pAdd(pMul(pMul(x, x), pMul(y, y)), pConst(V, rat(1)));
    assert.equal(poleCensus(Dxxyy, WIDE_BOX).kind, "undecided");
  });

  it("(c) THE FLIP (the spec's negative control): the pole moved out of the hole flips the verdict", () => {
    // a = 0: K3's form — closed, pole at the origin INSIDE the diamond
    const w0 = translatedWindingForm(rat(0));
    assert.ok(
      pIsZero(rationalCurlNumerator(w0)),
      "the winding form is closed (numerator identity)",
    );
    assert.ok(
      pIsZero(gl.windingCurlNumerator()),
      "the repo's own K3 numerator agrees",
    );
    const v0 = classifyPeriod(w0, DIAMOND, DIAMOND_BOX);
    assert.ok(v0.kind === "pole-inside");
    assert.ok(v0.census.kind === "hit");
    const witness = v0.census.witness;
    assert.ok(
      witness !== undefined &&
        rStr(witness.x) === "0" &&
        rStr(witness.y) === "0",
    );
    assert.ok(
      Math.abs(v0.simpson - 2 * Math.PI) < 1e-9,
      `2*pi corroboration, got ${v0.simpson}`,
    );
    // a = 5: the SAME closed family, the root moved OUT of the (widened)
    // hole box — the classifier MUST flip to exact, the period to ~ 0
    const w5 = translatedWindingForm(rat(5));
    assert.ok(
      pIsZero(rationalCurlNumerator(w5)),
      "the shifted family stays closed",
    );
    const v5 = classifyPeriod(w5, DIAMOND, WIDE_BOX);
    assert.ok(v5.kind === "no-pole-exact", `the flip: got ${v5.kind}`);
    assert.ok(
      v5.census.kind === "no-pole-cert" &&
        v5.census.lowerBound !== undefined &&
        rStr(v5.census.lowerBound) === "9",
    );
    assert.ok(Math.abs(v5.simpson) < 1e-6, `~0 period, got ${v5.simpson}`);
  });

  it("(c) SMUGGLING TRIAL III: the forged pole certificate is refused — D5 does not vanish at the smuggled root (0,0)", () => {
    const grid = poleCensusByRationalGrid(D5, WIDE_BOX, 4);
    assert.equal(grid.hit, null, "no rational grid root of D5 in the wide box");
    assert.equal(
      rStr(pEval(D5, [rat(0), rat(0)])),
      "25",
      "pEval(D5,(0,0)) = 25 != 0: the exact vanishing test fails",
    );
    assert.equal(
      poleCensusBySlices(D5, WIDE_BOX, 4).sliceRoots,
      0,
      "and no slice root — all proof channels refuse",
    );
    // REGRESSION (the certificate-forgery anchor): a denominator carrying an
    // x^2 y^2 term must NOT receive an axis-quadratic certificate — a
    // partial coefficient readout would claim 2 - x^2 y^2 >= 2, false at
    // (1,1) where it equals 1. The TOTAL readoff refuses it outright, and
    // the slice channel then PROVES the real zeros (y = 1 slice: 2 - x^2).
    const Dforged = pSub(pConst(V, rat(2)), pMul(pMul(x, x), pMul(y, y)));
    assert.equal(axisQuadraticNoPoleCertificate(Dforged, WIDE_BOX), null);
    assert.equal(
      poleCensus(Dforged, WIDE_BOX).kind,
      "slice",
      "no forged certificate; the slice channel proves the poles",
    );
  });

  it("the unified test: not-closed polynomial forms get the Green verdict (the curl's flux, both routes)", () => {
    const c = rat(1, 3);
    const P = pAdd(x, pScale(y, c));
    const Q = pSub(y, pScale(x, c));
    const v = classifyPeriod(polynomialForm(P, Q), CONCAVE_C, DIAMOND_BOX);
    assert.ok(v.kind === "not-closed" && v.holds);
    assert.equal(rStr(v.line), "-20/3"); // -2c * area(C) = -2*(1/3)*10
  });

  it("the no-pole face around a pole-free loop and the out-of-scope face are honest (never guessed)", () => {
    // K3's form around a loop that does NOT wind the pole (the pole sits
    // outside [4,6]^2): the census certifies no pole in the loop's interior
    // box and the period is ~ 0 — exact on that region
    const w0 = translatedWindingForm(rat(0));
    const farLoop: PolygonLoop = [pt(4, 4), pt(6, 4), pt(6, 6), pt(4, 6)];
    const vFar = classifyPeriod(w0, farLoop, {
      xLo: rat(4),
      xHi: rat(6),
      yLo: rat(4),
      yHi: rat(6),
    });
    assert.ok(
      vFar.kind === "no-pole-exact",
      `pole outside the loop: got ${vFar.kind}`,
    );
    assert.ok(vFar.census.kind === "no-pole-cert");
    assert.ok(Math.abs(vFar.simpson) < 1e-6, `got ${vFar.simpson}`);
    // a NON-closed rational form: the residue territory — named, not guessed
    const Dxxyy = pAdd(pMul(pMul(x, x), pMul(y, y)), pConst(V, rat(1)));
    const broken = {
      P: { num: y, den: pConst(V, rat(1)) },
      Q: { num: x, den: Dxxyy },
    };
    const vScope = classifyPeriod(broken, DIAMOND, WIDE_BOX);
    assert.ok(vScope.kind === "rational-not-closed");
  });

  it("SMUGGLING TRIAL: every new public entry's illegal input is rejected with a NAMED (reused) error code", () => {
    const code = (e: unknown): string | undefined =>
      e instanceof KernelError ? e.code : undefined;
    const loop2: PolygonLoop = [pt(0, 0), pt(1, 0)];
    assert.throws(
      () => polygonLineIntegral(x, y, loop2),
      (e: unknown) => code(e) === "poly/arity",
    );
    assert.throws(
      () => polygonDoubleIntegral(x, loop2),
      (e: unknown) => code(e) === "poly/arity",
    );
    assert.throws(
      () => simplexMonomialIntegral(-1, 0),
      (e: unknown) => code(e) === "poly/index-range",
    );
    assert.throws(
      () => sturmRootCount([rat(1), rat(1)], rat(1), rat(0)),
      (e: unknown) => code(e) === "cert/d-range",
    );
    // endpoints ON roots are a named refusal (the half-open convention guard)
    assert.throws(
      () => sturmRootCount([rat(-6), rat(11), rat(-6), rat(1)], rat(1), rat(4)),
      (e: unknown) => code(e) === "cert/degree-invalid",
    );
    assert.throws(
      () => uSturmChain([rat(1)]),
      (e: unknown) => code(e) === "cert/degree-invalid",
    );
    assert.throws(
      () => uDivMod([rat(1), rat(1)], []),
      (e: unknown) => code(e) === "rdiv/zero-divisor",
    );
    assert.throws(
      () => poleCensusByRationalGrid(x, DIAMOND_BOX, 0),
      (e: unknown) => code(e) === "cert/d-range",
    );
    assert.throws(
      () => poleCensusBySlices(x, DIAMOND_BOX, -1),
      (e: unknown) => code(e) === "cert/d-range",
    );
    assert.throws(
      () => loopSimpson(translatedWindingForm(rat(0)), DIAMOND, 3),
      (e: unknown) => code(e) === "diamond/simpson-n",
    );
    assert.throws(
      () => loopSimpson(translatedWindingForm(rat(0)), DIAMOND, 0),
      (e: unknown) => code(e) === "diamond/simpson-n",
    );
  });

  it("the periods are deterministic (a seeded rerun deep-equals the verdict table)", () => {
    const w0 = translatedWindingForm(rat(0));
    const again = classifyPeriod(w0, DIAMOND, DIAMOND_BOX);
    assert.ok(again.kind === "pole-inside");
    const s1 = loopSimpson(w0, DIAMOND, 200);
    const s2 = loopSimpson(w0, DIAMOND, 200);
    assert.equal(s1, s2);
  });
});

// ---------------------------------------------------------------------------
// local helpers (test-side only)
// ---------------------------------------------------------------------------

function uDegreeOf(f: UPoly): number {
  for (let i = f.length - 1; i >= 0; i--) if ((f[i] as Rat).n !== 0n) return i;
  return -1;
}

/** The UNSIGNED fan — the naive convex-world triangulation (fan from v0
 * with every triangle re-oriented counterclockwise). The negative control
 * for the directed origin cone: on a concave loop it fills the notch. */
function unsignedFanDoubleIntegral(f: Poly, loop: PolygonLoop): Rat {
  const v0 = loop[0] as Pt;
  let acc = rat(0);
  for (let i = 1; i < loop.length - 1; i++) {
    const A = loop[i] as Pt;
    const B = loop[i + 1] as Pt;
    const det = rSub(
      rMul(rSub(A.x, v0.x), rSub(B.y, v0.y)),
      rMul(rSub(A.y, v0.y), rSub(B.x, v0.x)),
    );
    // re-orient clockwise triangles — the naive implementation's crime
    const tri =
      rCmp(det, rat(0)) < 0
        ? triangleIntegral(f, v0, B, A)
        : triangleIntegral(f, v0, A, B);
    acc = rAdd(acc, tri);
  }
  return acc;
}
