/**
 * T11 — the period/Green classifier: payment EXISTENCE as one decidable
 * criterion, closing the gap between the two layers the repo had kept apart.
 *
 * THE CLAIM (three faces, all machine-exact):
 *   (a) GREEN EXECUTED. For a polynomial 1-form alpha = P dx + Q dy and a
 *       rational-vertex polygon loop gamma, BOTH sides of Green's identity
 *       hold in exact rational arithmetic:
 *           line route  — oint_gamma alpha by per-edge FTC (pullback to the
 *                         edge parameter, exact polynomial integration);
 *           area route  — the double integral of curl alpha over the
 *                         interior, by an ORIGIN-CONE decomposition into
 *                         directed triangles (convexity NOT assumed) with
 *                         each triangle's monomials integrated by the
 *                         reference-simplex closed form c! d! / (c+d+2)!.
 *       The two routes are INDEPENDENT (no Stokes on either side); the
 *       identity is accepted only where they agree exactly, including on
 *       forms with NONZERO curl (so the check is not vacuous).
 *   (b) POLYNOMIAL CLOSED => EXACT, ON ANY REGION. A closed polynomial form
 *       has the GLOBAL polynomial potential (the radial Poincare pullback
 *       Phi = int_0^1 [x P(tx,ty) + y Q(tx,ty)] dt, monomial-wise c/(a+b+1)),
 *       with dPhi = alpha verified coefficient-wise; hence its period around
 *       EVERY polygon loop — including loops winding around the holes of a
 *       non-convex region — is EXACTLY ZERO. A polynomial curl has no poles,
 *       so Green may fill any loop's interior, hole included: no hole can
 *       break what finitely many reports could never break (T2's face).
 *   (c) THE OBSTRUCTION IS POLE-ONLY. A CLOSED RATIONAL form can fail to be
 *       exact on a holed region ONLY IF its denominator has a zero inside
 *       the hole — the pole census. Three channels, exact to BigInt:
 *       rational root HIT (a rational point where the denominator vanishes —
 *       a pole PROOF), slice STURM counts (sign-variation counting on
 *       rational slice lines of the box — a pole PROOF), and the
 *       axis-centered quadratic LOWER BOUND (den >= m > 0 on the box, a
 *       NO-pole certificate by ordered-field arithmetic). A denominator that
 *       passes none is reported UNDECIDED, never guessed (the bounded-depth
 *       honesty of the spec).
 *
 * THE MECHANISM READING (the T2/K3 unification): a payment exists on a type
 * region iff (closedness — a polynomial identity) AND (no pole inside the
 * region's holes — the root census). T2's "closed => exact on finitely many
 * reports" and K3's "closed yet not exact on the annulus" become the two
 * sides of ONE decidable test — the winding form sits on the pole side
 * (period exactly 2*pi around the unit diamond), and its pole-shifted
 * sibling with the root moved OUT of the hole flips to exact.
 *
 * NAMED-ERROR DISCIPLINE: this file adds NO error codes (the closed set in
 * core/errors.ts is frozen for this wave — the new-file-only law); its
 * guards REUSE the semantically nearest existing codes, each noted at the
 * site and recorded in the wave's ledger.
 */

import { KernelError } from "../core/errors.js";
import type { RatFun } from "./green-laffont.js";
import {
  pAdd,
  pAssertSame,
  pConst,
  pDeriv,
  pEval,
  pInteg,
  pIsZero,
  pMul,
  pScale,
  pSub,
  pSubst,
  pSubstAll,
  pVar,
  rAdd,
  rCmp,
  rIsZero,
  rMul,
  rStr,
  rSub,
  rat,
  type Poly,
  type Rat,
} from "./poly.js";

// ---------------------------------------------------------------------------
// rational polygons
// ---------------------------------------------------------------------------

export interface Pt {
  readonly x: Rat;
  readonly y: Rat;
}

export type PolygonLoop = readonly Pt[];

const V = ["x", "y"] as const;

/** A rational box [xLo, xHi] x [yLo, yHi] — the hole's census range. */
export interface RationalBox {
  readonly xLo: Rat;
  readonly xHi: Rat;
  readonly yLo: Rat;
  readonly yHi: Rat;
}

function assertLoop(loop: PolygonLoop, what: string): void {
  // reuse of poly/arity (a shape-arity guard): the closed error set is
  // frozen for this wave — see the file header
  if (loop.length < 3) {
    throw new KernelError(
      "poly/arity",
      `${what}: a polygon loop needs >= 3 vertices, got ${loop.length}`,
    );
  }
}

// ---------------------------------------------------------------------------
// (a) the line route: per-edge FTC, exact
// ---------------------------------------------------------------------------

/** Exact integral of P dx + Q dy along ONE directed edge A -> B. */
function edgeIntegral(P: Poly, Q: Poly, A: Pt, B: Pt): Rat {
  const dx = rSub(B.x, A.x);
  const dy = rSub(B.y, A.y);
  // gamma(t) = A + t*(B-A); BOTH ring slots carry t after the pullback, so
  // they are FUSED (y := x) before integrating the single parameter — an
  // unfused integrand would leave t alive in the y slot and quietly drop it
  const gx = pAdd(pConst(V, A.x), pScale(pVar(V, 0), dx));
  const gy = pAdd(pConst(V, A.y), pScale(pVar(V, 1), dy));
  const fuse = (f: Poly): Poly =>
    pSubst(pSubstAll(f, [0, 1], [gx, gy]), 1, pVar(V, 0));
  const integrand = pAdd(pScale(fuse(P), dx), pScale(fuse(Q), dy));
  const anti = pInteg(integrand, 0);
  return rSub(pEval(anti, [rat(1), rat(0)]), pEval(anti, [rat(0), rat(0)]));
}

/** The line route: oint_gamma (P dx + Q dy), exact rational. */
export function polygonLineIntegral(P: Poly, Q: Poly, loop: PolygonLoop): Rat {
  assertLoop(loop, "polygonLineIntegral");
  pAssertSame(P, Q, "polygonLineIntegral");
  let acc = rat(0);
  for (let i = 0; i < loop.length; i++) {
    const A = loop[i] as Pt;
    const B = loop[(i + 1) % loop.length] as Pt;
    acc = rAdd(acc, edgeIntegral(P, Q, A, B));
  }
  return acc;
}

// ---------------------------------------------------------------------------
// (a) the area route: origin-cone directed triangles + simplex closed form
// ---------------------------------------------------------------------------

function factorial(n: number): bigint {
  let a = 1n;
  for (let i = 2n; i <= BigInt(n); i++) a *= i;
  return a;
}

/** int int over the reference simplex {u,w >= 0, u+w <= 1} of u^c w^d —
 * exactly c! d! / (c+d+2)! (the load-bearing closed form; verified against
 * independent grid quadrature and against the cone area == shoelace in the
 * tests). */
export function simplexMonomialIntegral(c: number, d: number): Rat {
  if (!Number.isInteger(c) || !Number.isInteger(d) || c < 0 || d < 0) {
    // reuse of poly/index-range: an exponent slot guard
    throw new KernelError(
      "poly/index-range",
      `simplexMonomialIntegral: exponents must be integers >= 0, got ${c},${d}`,
    );
  }
  return rat(factorial(c) * factorial(d), factorial(c + d + 2));
}

/** Directed integral of a bivariate polynomial f over the triangle ABC:
 * affine pullback onto the reference simplex; the determinant carries the
 * orientation (counterclockwise positive). */
export function triangleIntegral(f: Poly, A: Pt, B: Pt, C: Pt): Rat {
  const ux = rSub(B.x, A.x);
  const uy = rSub(B.y, A.y);
  const wx = rSub(C.x, A.x);
  const wy = rSub(C.y, A.y);
  const det = rSub(rMul(ux, wy), rMul(uy, wx));
  const gx = pAdd(
    pConst(V, A.x),
    pAdd(pScale(pVar(V, 0), ux), pScale(pVar(V, 1), wx)),
  );
  const gy = pAdd(
    pConst(V, A.y),
    pAdd(pScale(pVar(V, 0), uy), pScale(pVar(V, 1), wy)),
  );
  // here the two slots are INDEPENDENT simplex coordinates (u, w) — no fuse
  const pulled = pSubstAll(f, [0, 1], [gx, gy]);
  let acc = rat(0);
  for (const [k, c] of pulled.mono) {
    const e = k.split(",").map(Number);
    acc = rAdd(
      acc,
      rMul(c, simplexMonomialIntegral(e[0] as number, e[1] as number)),
    );
  }
  return rMul(acc, det);
}

const ORIGIN: Pt = { x: rat(0), y: rat(0) };

/** The area route: the directed double integral of f over the interior of a
 * simple polygon loop, as the origin-cone sum of directed triangles. The
 * cone decomposition handles CONCAVE loops (the directed signs absorb the
 * notch) — a fan triangulation would not, and the tests convict one. */
export function polygonDoubleIntegral(f: Poly, loop: PolygonLoop): Rat {
  assertLoop(loop, "polygonDoubleIntegral");
  let acc = rat(0);
  for (let i = 0; i < loop.length; i++) {
    const A = loop[i] as Pt;
    const B = loop[(i + 1) % loop.length] as Pt;
    acc = rAdd(acc, triangleIntegral(f, ORIGIN, A, B));
  }
  return acc;
}

/** curl alpha = dQ/dx - dP/dy (computed, never asserted). */
export function curlOf(P: Poly, Q: Poly): Poly {
  return pSub(pDeriv(Q, 0), pDeriv(P, 1));
}

/** GREEN EXECUTED: both routes and their exact residual. `holds` is the
 * machine acceptance of the identity on this (form, loop) pair — the tests
 * demand it on nonzero-curl forms and on concave loops, so neither route can
 * degenerate into a rubber stamp. */
export function greenIdentity(
  P: Poly,
  Q: Poly,
  loop: PolygonLoop,
): { line: Rat; area: Rat; residual: Rat; holds: boolean } {
  const line = polygonLineIntegral(P, Q, loop);
  const area = polygonDoubleIntegral(curlOf(P, Q), loop);
  const residual = rSub(line, area);
  return { line, area, residual, holds: rCmp(residual, rat(0)) === 0 };
}

// ---------------------------------------------------------------------------
// (b) the radial Poincare potential: closed polynomial => global potential
// ---------------------------------------------------------------------------

/** Phi = int_0^1 [x P(tx,ty) + y Q(tx,ty)] dt, monomial-wise: a P-term
 * c x^a y^b contributes c/(a+b+1) x^(a+1) y^b, a Q-term c x^a y^b
 * contributes c/(a+b+1) x^a y^(b+1). The potential of a closed form, up to
 * the constant — canonical by construction. */
export function radialPotential(P: Poly, Q: Poly): Poly {
  pAssertSame(P, Q, "radialPotential");
  let phi = pZeroOfV();
  for (const [k, c] of P.mono) {
    const e = k.split(",").map(Number);
    const a = e[0] as number;
    const b = e[1] as number;
    const exps = [a + 1, b];
    if (!rIsZero(c)) {
      const mono = new Map<string, Rat>();
      mono.set(exps.join(","), rMul(c, rat(1, a + b + 1)));
      phi = pAdd(phi, { vars: [...V], mono });
    }
  }
  for (const [k, c] of Q.mono) {
    const e = k.split(",").map(Number);
    const a = e[0] as number;
    const b = e[1] as number;
    const exps = [a, b + 1];
    if (!rIsZero(c)) {
      const mono = new Map<string, Rat>();
      mono.set(exps.join(","), rMul(c, rat(1, a + b + 1)));
      phi = pAdd(phi, { vars: [...V], mono });
    }
  }
  return phi;
}

function pZeroOfV(): Poly {
  return { vars: [...V], mono: new Map<string, Rat>() };
}

/** The acceptance face of (b): dPhi/dx - P and dPhi/dy - Q. BOTH zero
 * polynomials iff the form admits the potential (which a CLOSED form always
 * does — the conviction the classifier fires on; a NON-closed form leaves a
 * nonzero residual — the tests convict the forged-closed smuggling there). */
export function radialPotentialResidual(
  P: Poly,
  Q: Poly,
): { dx: Poly; dy: Poly } {
  const phi = radialPotential(P, Q);
  return { dx: pSub(pDeriv(phi, 0), P), dy: pSub(pDeriv(phi, 1), Q) };
}

// ---------------------------------------------------------------------------
// the unary Sturm engine (BigInt-exact sign-variation root counting)
// ---------------------------------------------------------------------------

/** A univariate polynomial as a coefficient array indexed by degree. */
export type UPoly = readonly Rat[];

function uDegree(f: UPoly): number {
  for (let i = f.length - 1; i >= 0; i--) if ((f[i] as Rat).n !== 0n) return i;
  return -1;
}

function uTrim(f: UPoly): UPoly {
  const d = uDegree(f);
  return d < 0 ? [] : f.slice(0, d + 1);
}

function uNegate(f: UPoly): UPoly {
  return f.map((c) => (c.n === 0n ? c : { n: -c.n, d: c.d }));
}

function uSubtract(a: UPoly, b: UPoly): UPoly {
  const n = Math.max(a.length, b.length);
  const out: Rat[] = [];
  for (let i = 0; i < n; i++) {
    const bi = b[i];
    out.push(
      rAdd(
        a[i] ?? rat(0),
        bi === undefined || bi.n === 0n ? rat(0) : { n: -bi.n, d: bi.d },
      ),
    );
  }
  return uTrim(out);
}

/** Polynomial long division (exact rationals); divisor must be nonzero. */
export function uDivMod(a: UPoly, b: UPoly): { q: UPoly; r: UPoly } {
  const f = uTrim(a);
  const g = uTrim(b);
  const dg = uDegree(g);
  if (dg < 0)
    throw new KernelError(
      "rdiv/zero-divisor",
      "uDivMod: division by the zero polynomial",
    );
  const lead = g[dg] as Rat;
  const q: Rat[] = new Array<Rat>(Math.max(uDegree(f) - dg + 1, 0)).fill(
    rat(0),
  );
  let rem = f;
  while (uDegree(rem) >= dg) {
    const dr = uDegree(rem);
    const shift = dr - dg;
    const qc = rat((rem[dr] as Rat).n * lead.d, (rem[dr] as Rat).d * lead.n);
    q[shift] = qc;
    const sub: Rat[] = new Array<Rat>(rem.length).fill(rat(0));
    for (let i = 0; i <= dg; i++) sub[i + shift] = rMul(g[i] ?? rat(0), qc);
    rem = uSubtract(rem, sub);
  }
  return { q: uTrim(q), r: rem };
}

function uDerivative(f: UPoly): UPoly {
  const out: Rat[] = [];
  for (let i = 1; i < f.length; i++) out.push(rMul(f[i] as Rat, rat(i)));
  return uTrim(out);
}

function uEvalAt(f: UPoly, t: Rat): Rat {
  let acc = rat(0);
  for (let i = f.length - 1; i >= 0; i--)
    acc = rAdd(rMul(acc, t), f[i] ?? rat(0));
  return acc;
}

/** The Sturm chain (the standard remainder chain with negated remainders;
 * square-freeness is NOT required — the variation count below counts
 * DISTINCT roots). */
export function uSturmChain(f: UPoly): UPoly[] {
  if (uDegree(f) < 1) {
    // reuse of cert/degree-invalid: a certificate precondition on degree
    throw new KernelError(
      "cert/degree-invalid",
      `uSturmChain: need degree >= 1, got ${uDegree(f)}`,
    );
  }
  const chain: UPoly[] = [uTrim(f), uDerivative(f)];
  while (uDegree(chain[chain.length - 1] as UPoly) > 0) {
    const a = chain[chain.length - 2] as UPoly;
    const b = chain[chain.length - 1] as UPoly;
    const { r } = uDivMod(a, b);
    chain.push(uNegate(r));
  }
  return chain;
}

function signVariations(chain: UPoly[], t: Rat): number {
  let v = 0;
  let last = 0;
  for (const f of chain) {
    const s = uEvalAt(f, t);
    const sg = s.n === 0n ? 0 : s.n < 0n ? -1 : 1;
    if (sg === 0) continue;
    if (last !== 0 && sg !== last) v++;
    last = sg;
  }
  return v;
}

/** Exact count of the distinct roots of f in the half-open interval (lo, hi]
 * by Sturm sign variations. lo must be strictly below hi and NEITHER
 * endpoint may itself be a root (the convention guard, a named refusal —
 * the bounded-depth honesty of the spec). */
export function sturmRootCount(f: UPoly, lo: Rat, hi: Rat): number {
  if (rCmp(lo, hi) >= 0) {
    // reuse of cert/d-range: a range guard on a certificate routine
    throw new KernelError(
      "cert/d-range",
      `sturmRootCount: need lo < hi, got ${rStr(lo)} >= ${rStr(hi)}`,
    );
  }
  const uni = uTrim(f);
  const fl = uEvalAt(uni, lo);
  const fh = uEvalAt(uni, hi);
  if (fl.n === 0n || fh.n === 0n) {
    // reuse of cert/degree-invalid: a certificate precondition broken
    throw new KernelError(
      "cert/degree-invalid",
      `sturmRootCount: endpoints must not be roots (f(${rStr(lo)})=${rStr(fl)}, f(${rStr(hi)})=${rStr(fh)})`,
    );
  }
  const chain = uSturmChain(uni);
  return signVariations(chain, lo) - signVariations(chain, hi);
}

// ---------------------------------------------------------------------------
// (c) the pole census — three exact channels
// ---------------------------------------------------------------------------

export interface PoleCensus {
  /** "hit" — a rational root of the denominator inside the box (pole PROOF);
   *  "slice" — a Sturm-counted slice root inside the box (pole PROOF);
   *  "no-pole-cert" — den >= m > 0 on the whole box by the axis-centered
   *  quadratic certificate (NO-pole, ordered-field arithmetic);
   *  "undecided" — no channel applied (reported, never guessed). */
  readonly kind: "hit" | "slice" | "no-pole-cert" | "undecided";
  readonly witness?: Pt;
  readonly lowerBound?: Rat;
  readonly sliceRoots?: number;
}

/** Channel 1: scan a rational grid in the box for an EXACT zero of den. */
export function poleCensusByRationalGrid(
  den: Poly,
  box: RationalBox,
  steps: number,
): { hit: Pt | null; tested: number } {
  if (!Number.isInteger(steps) || steps < 1) {
    // reuse of cert/d-range: a range guard on a certificate routine
    throw new KernelError(
      "cert/d-range",
      `poleCensusByRationalGrid: steps >= 1 required, got ${steps}`,
    );
  }
  let tested = 0;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const x = rAdd(box.xLo, rMul(rat(i, steps), rSub(box.xHi, box.xLo)));
      const y = rAdd(box.yLo, rMul(rat(j, steps), rSub(box.yHi, box.yLo)));
      tested++;
      if (rCmp(pEval(den, [x, y]), rat(0)) === 0)
        return { hit: { x, y }, tested };
    }
  }
  return { hit: null, tested };
}

/** Channel 3: the axis-centered quadratic no-pole certificate. If den is
 * exactly p(x-a)^2 + q(y-b)^2 + r (p, q >= 0 — any quadratic without an xy
 * term rewrites this way), then on the box den >= p*lb_x + q*lb_y + r where
 * lb_* is the squared distance from the axis center to the box interval
 * (0 if the center lies inside); if that bound is > 0, den has NO zero on
 * the box — ordered-field arithmetic, no estimates. The coefficient readoff
 * is TOTAL: a single monomial outside the six-basis {x^2, xy, y^2, x, y, 1}
 * (e.g. an x^2 y^2 term, whose sign the readoff could not carry) refuses
 * the certificate — a partial readoff would FORGE bounds. */
export function axisQuadraticNoPoleCertificate(
  den: Poly,
  box: RationalBox,
): { lowerBound: Rat } | null {
  const coef = (exps: readonly number[]): Rat =>
    den.mono.get(exps.join(",")) ?? rat(0);
  // TOTAL readoff: every stored monomial must live in the six-basis
  const basis = new Set(["2,0", "1,1", "0,2", "1,0", "0,1", "0,0"]);
  for (const k of den.mono.keys()) {
    if (!basis.has(k)) return null;
  }
  const cxx = coef([2, 0]);
  const cxy = coef([1, 1]);
  const cyy = coef([0, 2]);
  const cx = coef([1, 0]);
  const cy = coef([0, 1]);
  const c0 = coef([0, 0]);
  if (rCmp(cxy, rat(0)) !== 0) return null;
  if (rCmp(cxx, rat(0)) < 0 || rCmp(cyy, rat(0)) < 0) return null;
  if (rCmp(cxx, rat(0)) === 0 && rCmp(cx, rat(0)) !== 0) return null;
  if (rCmp(cyy, rat(0)) === 0 && rCmp(cy, rat(0)) !== 0) return null;
  // complete the square per axis: p(x-a)^2 = p x^2 - 2pa x + p a^2, so the
  // center is a = -c / (2p); p = 0 => no square on that axis, and then the
  // linear coefficient c = 0 too, so the center contributes nothing there
  const center = (p: Rat, c: Rat): Rat =>
    rCmp(p, rat(0)) === 0 ? rat(0) : rDivExact(rNeg(c), rMul(rat(2), p));
  const ax = center(cxx, cx);
  const ay = center(cyy, cy);
  const rest = rSub(c0, rAdd(rMul(cxx, rMul(ax, ax)), rMul(cyy, rMul(ay, ay))));
  const sqLower = (a: Rat, lo: Rat, hi: Rat): Rat => {
    if (rCmp(a, lo) >= 0 && rCmp(a, hi) <= 0) return rat(0);
    const dl = rMul(rSub(lo, a), rSub(lo, a));
    const dh = rMul(rSub(hi, a), rSub(hi, a));
    return rCmp(dl, dh) < 0 ? dl : dh;
  };
  const lower = rAdd(
    rAdd(
      rMul(cxx, sqLower(ax, box.xLo, box.xHi)),
      rMul(cyy, sqLower(ay, box.yLo, box.yHi)),
    ),
    rest,
  );
  if (rCmp(lower, rat(0)) <= 0) return null;
  return { lowerBound: lower };
}

function rNeg(a: Rat): Rat {
  return { n: -a.n, d: a.d };
}

function rDivExact(a: Rat, b: Rat): Rat {
  if (b.n === 0n)
    throw new KernelError("rdiv/zero-divisor", "rDivExact: zero divisor");
  return rat(a.n * b.d, a.d * b.n);
}

/** Channel 2: horizontal slice lines at rational heights — each restriction
 * den(x, yk) is a UNARY polynomial in x whose roots the Sturm engine counts
 * exactly inside the box's x-range. Any counted root is a pole PROOF.
 * Slices landing endpoints-on-roots are skipped (named-refusal discipline,
 * counted as unusable). */
export function poleCensusBySlices(
  den: Poly,
  box: RationalBox,
  slices: number,
): { sliceRoots: number; usableSlices: number } {
  if (!Number.isInteger(slices) || slices < 1) {
    // reuse of cert/d-range: a range guard on a certificate routine
    throw new KernelError(
      "cert/d-range",
      `poleCensusBySlices: slices >= 1 required, got ${slices}`,
    );
  }
  let total = 0;
  let usable = 0;
  for (let j = 0; j <= slices; j++) {
    const yk = rAdd(box.yLo, rMul(rat(j, slices), rSub(box.yHi, box.yLo)));
    const restricted = pSubst(den, 1, pConst(V, yk)); // polynomial in x alone
    let deg = -1;
    const coeffs: Rat[] = [];
    for (const [k, c] of restricted.mono) {
      const e = k.split(",").map(Number);
      const ex = e[0] as number;
      if ((e[1] as number) !== 0) continue; // y cannot survive pSubst(y := const)
      coeffs[ex] = c;
      if (ex > deg) deg = ex;
    }
    for (let i = 0; i <= deg; i++) coeffs[i] ??= rat(0);
    const uni: UPoly = coeffs;
    if (uDegree(uni) < 1) continue;
    const fl = uEvalAt(uni, box.xLo);
    const fh = uEvalAt(uni, box.xHi);
    if (fl.n === 0n || fh.n === 0n) continue; // unusable slice, skipped honestly
    usable++;
    total += sturmRootCount(uni, box.xLo, box.xHi);
  }
  return { sliceRoots: total, usableSlices: usable };
}

/** The full census: proofs first (hit, then slice), then the no-pole
 * certificate, else UNDECIDED — the bounded-depth honesty of the spec. */
export function poleCensus(den: Poly, box: RationalBox): PoleCensus {
  const grid = poleCensusByRationalGrid(den, box, 4);
  if (grid.hit !== null) return { kind: "hit", witness: grid.hit };
  const slices = poleCensusBySlices(den, box, 4);
  if (slices.sliceRoots > 0)
    return { kind: "slice", sliceRoots: slices.sliceRoots };
  const cert = axisQuadraticNoPoleCertificate(den, box);
  if (cert !== null)
    return { kind: "no-pole-cert", lowerBound: cert.lowerBound };
  return { kind: "undecided" };
}

// ---------------------------------------------------------------------------
// rational forms: closedness (numerator-wise) and the winding family
// ---------------------------------------------------------------------------

export interface Form1 {
  readonly P: RatFun;
  readonly Q: RatFun;
}

/** The polynomial form P dx + Q dy lifted to denominators 1. */
export function polynomialForm(P: Poly, Q: Poly): Form1 {
  pAssertSame(P, Q, "polynomialForm");
  return {
    P: { num: P, den: pConst(V, rat(1)) },
    Q: { num: Q, den: pConst(V, rat(1)) },
  };
}

/** The curl of a rational form, on the common positive-power denominator
 * (P.den * Q.den)^2: closedness is the ZERO NUMERATOR — a coefficient-wise
 * statement (dQ/dx = (Q'.Qden - Q.Qden')/Qden^2, dP/dy likewise; the two
 * quotients share the common denominator after cross-multiplication). */
export function rationalCurlNumerator(form: Form1): Poly {
  const dqdx = pSub(
    pMul(pDeriv(form.Q.num, 0), form.Q.den),
    pMul(form.Q.num, pDeriv(form.Q.den, 0)),
  );
  const dpdy = pSub(
    pMul(pDeriv(form.P.num, 1), form.P.den),
    pMul(form.P.num, pDeriv(form.P.den, 1)),
  );
  return pSub(
    pMul(dqdx, pMul(form.P.den, form.P.den)),
    pMul(dpdy, pMul(form.Q.den, form.Q.den)),
  );
}

/** The winding form d(theta) shifted to the pole (a, 0):
 * omega_a = ((x-a) dy - y dx) / ((x-a)^2 + y^2). a = 0 is K3's form; the
 * family is closed for every a (the shift is a variable translation — the
 * tests verify the numerator identity at several a). */
export function translatedWindingForm(a: Rat): Form1 {
  const x = pVar(V, 0);
  const y = pVar(V, 1);
  const xa = pSub(x, pConst(V, a));
  const den = pAdd(pMul(xa, xa), pMul(y, y));
  return { P: { num: pScale(y, rat(-1)), den }, Q: { num: xa, den } };
}

/** Composite Simpson of oint_gamma omega_a over a polygon loop — the NUMERIC
 * cross-check channel for rational periods (O(h^4), the K3 precedent:
 * exact claims live on the numerator identities; numerics corroborate). */
export function loopSimpson(form: Form1, loop: PolygonLoop, n: number): number {
  if (!Number.isInteger(n) || n < 2 || n % 2 !== 0) {
    // reuse of diamond/simpson-n: the K3 quadrature guard, same channel
    throw new KernelError(
      "diamond/simpson-n",
      `loopSimpson: n must be an even integer >= 2, got ${n}`,
    );
  }
  const fP = (x: number, y: number): number =>
    evalFloat(form.P.num, x, y) / evalFloat(form.P.den, x, y);
  const fQ = (x: number, y: number): number =>
    evalFloat(form.Q.num, x, y) / evalFloat(form.Q.den, x, y);
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const A = loop[i] as Pt;
    const B = loop[(i + 1) % loop.length] as Pt;
    const dx = ratToNum(B.x) - ratToNum(A.x);
    const dy = ratToNum(B.y) - ratToNum(A.y);
    const g = (t: number): number => {
      const px = ratToNum(A.x) + t * dx;
      const py = ratToNum(A.y) + t * dy;
      return fP(px, py) * dx + fQ(px, py) * dy;
    };
    const h = 1 / n;
    let side = g(0) + g(1);
    for (let j = 1; j < n; j++) side += (j % 2 === 1 ? 4 : 2) * g(j * h);
    s += (side * h) / 3;
  }
  return s;
}

function evalFloat(p: Poly, x: number, y: number): number {
  let acc = 0;
  for (const [k, c] of p.mono) {
    const e = k.split(",").map(Number);
    acc +=
      (Number(c.n) / Number(c.d)) *
      Math.pow(x, e[0] as number) *
      Math.pow(y, e[1] as number);
  }
  return acc;
}

function ratToNum(r: Rat): number {
  return Number(r.n) / Number(r.d);
}

// ---------------------------------------------------------------------------
// the unified classifier
// ---------------------------------------------------------------------------

export type PeriodVerdict =
  /** a POLYNOMIAL form: closed (curl the zero polynomial) => the global
   * potential exists (dPhi = alpha coefficient-wise) and the period around
   * the loop is EXACTLY zero — on any region, holes included (T2's face,
   * promoted to every hole). */
  | { kind: "polynomial-exact"; potential: Poly; period: Rat }
  /** a POLYNOMIAL form that is not closed: the Green identity itself is the
   * deliverable (both routes exact; the period is the curl's flux — the
   * payment does not exist). */
  | { kind: "not-closed"; line: Rat; area: Rat; holds: boolean }
  /** a closed RATIONAL form with a census-proven pole in the hole box: the
   * Green fill is ILLEGAL (the form is not smooth inside the hole), the
   * period may be nonzero — K3's territory. Simpson is numeric
   * corroboration only, never the claim. */
  | { kind: "pole-inside"; census: PoleCensus; simpson: number }
  /** a closed rational form with a NO-pole certificate on the box: smooth
   * on the whole region, exact there — the period is zero (Simpson ~ 0). */
  | { kind: "no-pole-exact"; census: PoleCensus; simpson: number }
  /** the census could not decide (bounded depth) — reported, never guessed. */
  | { kind: "undecided"; census: PoleCensus }
  /** a NON-closed rational form: periods need residues — outside this
   * theorem's scope (the honest boundary; K3's atan side remains the
   * hand-executed special case). */
  | { kind: "rational-not-closed" };

/** THE UNIFIED TEST. Payment existence on the region bounded by the loop
 * (with the hole covered by `holeBox`): closedness (a polynomial identity)
 * AND no pole in the hole (the root census). The T2 layer (finitely many
 * reports: closed => exact ALWAYS) and the K3 layer (a continuum hole CAN
 * break it) are the two faces of this one function. */
export function classifyPeriod(
  form: Form1,
  loop: PolygonLoop,
  holeBox: RationalBox,
): PeriodVerdict {
  const one = pConst(V, rat(1));
  const polynomial =
    pIsZero(pSub(form.P.den, one)) && pIsZero(pSub(form.Q.den, one));
  const closed = pIsZero(rationalCurlNumerator(form));
  if (polynomial) {
    if (!closed) {
      const g = greenIdentity(form.P.num, form.Q.num, loop);
      return { kind: "not-closed", line: g.line, area: g.area, holds: g.holds };
    }
    const res = radialPotentialResidual(form.P.num, form.Q.num);
    // the conviction channel: a CLOSED form must admit the potential — a
    // nonzero residual here is a mathematical crime (poly/identity-failed),
    // not a validation failure
    if (!pIsZero(res.dx) || !pIsZero(res.dy)) {
      throw new KernelError(
        "poly/identity-failed",
        `classifyPeriod: closed polynomial form without a potential — dx residual ${[...res.dx.mono.keys()].join(",")}, dy residual ${[...res.dy.mono.keys()].join(",")}`,
      );
    }
    return {
      kind: "polynomial-exact",
      potential: radialPotential(form.P.num, form.Q.num),
      period: polygonLineIntegral(form.P.num, form.Q.num, loop),
    };
  }
  if (!closed) return { kind: "rational-not-closed" };
  const census = poleCensus(form.P.den, holeBox);
  const simpson = loopSimpson(form, loop, 400);
  if (census.kind === "hit" || census.kind === "slice")
    return { kind: "pole-inside", census, simpson };
  if (census.kind === "no-pole-cert")
    return { kind: "no-pole-exact", census, simpson };
  return { kind: "undecided", census };
}
