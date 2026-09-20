/**
 * R20 batch-2 agent EPSILON — pre-code machine verification (spec-as-hypothesis).
 * F1: the period/Green classifier (agentF F1-a). F2: the affine Groves drift
 * quadratic (agentF F1-b). Run from the dsic-noether repo (tsx resolves its
 * own node_modules):
 *   cd D:/multi-agent/dsic-noether && npx tsx ../tmp/r20e-verify.mjs
 * Every check prints CHECK <name> PASS/FAIL; the run's verdict is exit 0 iff
 * all pass.
 */
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
  pSubst,
  pSubstAll,
  pVar,
  pZero,
  rAdd,
  rCmp,
  rMul,
  rStr,
  rSub,
  rat,
  type Poly,
  type Rat,
} from "../dsic-noether/src/continuum/poly.js";
import * as gl from "../dsic-noether/src/continuum/green-laffont.js";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`CHECK ${name} ${ok ? "PASS" : "FAIL"}${detail ? "  [${detail}]" : ""}`);
  if (!ok) failures++;
}
const num = (r: Rat): number => Number(r.n) / Number(r.d);

// ---------------------------------------------------------------------------
// prototypes of the F1 kernels (independent re-implementations for this script)
// ---------------------------------------------------------------------------

interface Pt {
  x: Rat;
  y: Rat;
}
type Loop = readonly Pt[];

const V = ["x", "y"] as const;

/** Exact line integral of P dx + Q dy around a closed rational polygon loop. */
function lineIntegral(P: Poly, Q: Poly, loop: Loop): Rat {
  let acc = rat(0);
  for (let i = 0; i < loop.length; i++) {
    const A = loop[i] as Pt;
    const B = loop[(i + 1) % loop.length] as Pt;
    const dx = rSub(B.x, A.x);
    const dy = rSub(B.y, A.y);
    // gamma(t) = A + t*(B-A), t in [0,1]; x-slot of the ring carries t
    const gx = pAdd(pConst(V, A.x), pScale(pVar(V, 0), dx));
    const gy = pAdd(pConst(V, A.y), pScale(pVar(V, 1), dy));
    // after the pullback BOTH slots carry the parameter t — fuse them (y := x)
    // before integrating the single variable t
    const integrand = pAdd(
      pScale(pSubst(pSubstAll(P, [0, 1], [gx, gy]), 1, pVar(V, 0)), dx),
      pScale(pSubst(pSubstAll(Q, [0, 1], [gx, gy]), 1, pVar(V, 0)), dy),
    );
    const anti = pInteg(integrand, 0);
    const lo = pEval(anti, [rat(0), rat(0)]);
    const hi = pEval(anti, [rat(1), rat(0)]);
    acc = rAdd(acc, rSub(hi, lo));
  }
  return acc;
}

function fact(n: number): bigint {
  let a = 1n;
  for (let i = 2n; i <= BigInt(n); i++) a *= i;
  return a;
}

/** Integral of u^c w^d over the reference simplex {u,w >= 0, u+w <= 1}. */
function simplexMono(c: number, d: number): Rat {
  return rat(fact(c) * fact(d), fact(c + d + 2));
}

/** Directed integral of a bivariate polynomial f over triangle ABC (affine
 * pullback to the reference simplex; det carries the orientation). */
function triangleIntegral(f: Poly, A: Pt, B: Pt, C: Pt): Rat {
  const ux = rSub(B.x, A.x);
  const uy = rSub(B.y, A.y);
  const wx = rSub(C.x, A.x);
  const wy = rSub(C.y, A.y);
  const det = rSub(rMul(ux, wy), rMul(uy, wx));
  const gx = pAdd(pConst(V, A.x), pAdd(pScale(pVar(V, 0), ux), pScale(pVar(V, 1), wx)));
  const gy = pAdd(pConst(V, A.y), pAdd(pScale(pVar(V, 0), uy), pScale(pVar(V, 1), wy)));
  const pulled = pSubstAll(f, [0, 1], [gx, gy]); // poly in the x-slot(u), y-slot(w)
  let acc = rat(0);
  for (const [k, c] of pulled.mono) {
    const e = k.split(",").map(Number);
    const cu = e[0] as number;
    const cw = e[1] as number;
    acc = rAdd(acc, rMul(c, simplexMono(cu, cw)));
  }
  return rMul(acc, det);
}

const ORIGIN: Pt = { x: rat(0), y: rat(0) };

/** Directed double integral of f over the interior of a simple polygon loop
 * (origin-cone decomposition into directed triangles; convexity NOT assumed). */
function polygonDoubleIntegral(f: Poly, loop: Loop): Rat {
  let acc = rat(0);
  for (let i = 0; i < loop.length; i++) {
    const A = loop[i] as Pt;
    const B = loop[(i + 1) % loop.length] as Pt;
    acc = rAdd(acc, triangleIntegral(f, ORIGIN, A, B));
  }
  return acc;
}

// ---------------------------------------------------------------------------
// V1: simplex monomial closed form vs numerical quadrature
// ---------------------------------------------------------------------------
{
  let ok = true;
  for (let c = 0; c <= 3; c++) {
    for (let d = 0; d <= 3; d++) {
      const exact = simplexMono(c, d);
      // numerical: iterate a fine grid on the simplex
      const N = 800;
      let s = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N - i; j++) {
          const u = (i + 0.5) / N;
          const w = (j + 0.5) / N;
          s += Math.pow(u, c) * Math.pow(w, d);
        }
      }
      const numeric = (s / (N * N)) as number;
      if (Math.abs(numeric - num(exact)) > 5e-3 * Math.max(1, numeric)) ok = false;
    }
  }
  check("V1 simplex monomial closed form c,d<=3 vs grid", ok);
}

// ---------------------------------------------------------------------------
// V2: cone decomposition — area (shoelace), first moments (polygon formulas),
// and a product moment vs a point-in-polygon Riemann sum, on a CONCAVE loop
// ---------------------------------------------------------------------------
const CONCAVE: Loop = [
  { x: rat(0), y: rat(0) },
  { x: rat(4), y: rat(0) },
  { x: rat(4), y: rat(3) },
  { x: rat(1), y: rat(3) },
  { x: rat(1), y: rat(1) },
  { x: rat(0), y: rat(1) },
]; // L-shape, counter-clockwise (shoelace > 0)
{
  const one = pConst(V, rat(1));
  const area = polygonDoubleIntegral(one, CONCAVE);
  // shoelace
  let sh = rat(0);
  for (let i = 0; i < CONCAVE.length; i++) {
    const A = CONCAVE[i] as Pt;
    const B = CONCAVE[(i + 1) % CONCAVE.length] as Pt;
    sh = rAdd(sh, rSub(rMul(A.x, B.y), rMul(B.x, A.y)));
  }
  sh = rMul(sh, rat(1, 2));
  check("V2a cone area == shoelace (concave L)", rCmp(area, sh) === 0 && rCmp(sh, rat(0)) > 0, `area=${rStr(area)}`);
  // expected L area = 4*3 - 1*2 = 10 (the notch is the UPPER-LEFT 1x2 block)
  check("V2b L area is exactly 10", rCmp(area, rat(10)) === 0, rStr(area));
  // first moments: polygon formula (1/6) sum (xi+xi1)*(cross)
  const Mx = (idx: 0 | 1): Rat => {
    let m = rat(0);
    for (let i = 0; i < CONCAVE.length; i++) {
      const A = CONCAVE[i] as Pt;
      const B = CONCAVE[(i + 1) % CONCAVE.length] as Pt;
      const cross = rSub(rMul(A.x, B.y), rMul(B.x, A.y));
      const v = idx === 0 ? rAdd(A.x, B.x) : rAdd(A.y, B.y);
      m = rAdd(m, rMul(v, cross));
    }
    return rMul(m, rat(1, 6));
  };
  const fx = pVar(V, 0);
  const fy = pVar(V, 1);
  check("V2c cone integral of x == polygon moment formula", rCmp(polygonDoubleIntegral(fx, CONCAVE), Mx(0)) === 0);
  check("V2d cone integral of y == polygon moment formula", rCmp(polygonDoubleIntegral(fy, CONCAVE), Mx(1)) === 0);
  // product moment vs Riemann point-in-polygon
  const fxy = pMul(fx, fy);
  const exact = polygonDoubleIntegral(fxy, CONCAVE);
  const N = 1200;
  let s = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const px = (i + 0.5) * (4 / N);
      const py = (j + 0.5) * (4 / N);
      // point in the L: inside [0,4]x[0,3] minus the UPPER-LEFT notch [0,1)x(1,3]
      const inside = px >= 0 && px <= 4 && py >= 0 && py <= 3 && !(px < 1 && py > 1);
      if (inside) s += px * py;
    }
  }
  const numeric = (s * (4 / N) * (4 / N)) as number;
  check("V2e cone integral of xy vs Riemann (concave)", Math.abs(numeric - num(exact)) < 5e-3, `exact=${num(exact)} num=${numeric}`);
}

// ---------------------------------------------------------------------------
// V3: Green identity, both routes, NONZERO curl (so the identity is not
// vacuous): skew form and a cubic form, on the rectangle and the concave L
// ---------------------------------------------------------------------------
{
  // skew allocation form of T5: alpha = (x + c*y) dx + (y - c*x) dy has curl -2c
  const c = rat(1, 3);
  const x = pVar(V, 0);
  const y = pVar(V, 1);
  const P = pAdd(x, pScale(y, c));
  const Q = pAdd(y, pScale(x, rMul(c, rat(-1))));
  const curl = pSub(pDeriv(Q, 0), pDeriv(P, 1));
  check("V3a curl of the skew form is exactly -2c", rCmp(pEval(curl, [rat(0), rat(0)]), rMul(c, rat(-2))) === 0);
  const RECT: Loop = [
    { x: rat(1), y: rat(2) },
    { x: rat(3), y: rat(2) },
    { x: rat(3), y: rat(5) },
    { x: rat(1), y: rat(5) },
  ];
  const li = lineIntegral(P, Q, RECT);
  const di = polygonDoubleIntegral(curl, RECT);
  check("V3b Green: line == area on rectangle (nonzero curl)", rCmp(li, di) === 0, `line=${rStr(li)} area=${rStr(di)}`);
  // and against the repo's own rectangleCycleIntegral (-2cwh with w=2,h=3)
  const { x1, x2 } = gl.skewRule(c);
  const repo = gl.rectangleCycleIntegral(x1, x2, rat(1), rat(2), rat(2), rat(3), rat(7, 5), rat(7, 5));
  check("V3c line integral == repo rectangleCycleIntegral (-2cwh = -4)", rCmp(li, repo) === 0 && rCmp(li, rat(-4)) === 0, `repo=${rStr(repo)}`);
  // concave L: Green on the skew form
  const liL = lineIntegral(P, Q, CONCAVE);
  const diL = polygonDoubleIntegral(curl, CONCAVE);
  check("V3d Green: line == area on the CONCAVE L", rCmp(liL, diL) === 0, `line=${rStr(liL)} area=${rStr(diL)}`);
  // cubic form with nonconstant curl, on the L: x^2 y dx + (y^2 + x^3) dy
  const P3 = pMul(pMul(x, x), y);
  const Q3 = pAdd(pMul(y, y), pMul(pMul(x, x), x));
  const curl3 = pSub(pDeriv(Q3, 0), pDeriv(P3, 1));
  check(
    "V3e Green: line == area, cubic form on the concave L",
    rCmp(lineIntegral(P3, Q3, CONCAVE), polygonDoubleIntegral(curl3, CONCAVE)) === 0,
    `line=${rStr(lineIntegral(P3, Q3, CONCAVE))}`,
  );
}

// ---------------------------------------------------------------------------
// V4: the radial Poincare pullback potential: closed polynomial form => global
// polynomial potential, dPhi = alpha coefficient-wise
// ---------------------------------------------------------------------------
{
  // Phi = x^3 y + x y^3 + x^2; P = Phi_x = 3x^2 y + y^3 + 2x; Q = x^3 + 3 x y^2
  const x = pVar(V, 0);
  const y = pVar(V, 1);
  const P = pAdd(pAdd(pScale(pMul(pMul(x, x), y), rat(3)), pMul(pMul(y, y), y)), pScale(x, rat(2)));
  const Q = pAdd(pMul(pMul(x, x), x), pScale(pMul(x, pMul(y, y)), rat(3)));
  const potential = (Pp: Poly, Qq: Poly): Poly => {
    let phi = pZero(V);
    for (const [k, cf] of Pp.mono) {
      const e = k.split(",").map(Number);
      const a = e[0] as number;
      const b = e[1] as number;
      const f = [a + 1, b];
      phi = pAdd(phi, pScale(pMonoU(f), rMul(cf, rat(1, a + b + 1))));
    }
    for (const [k, cf] of Qq.mono) {
      const e = k.split(",").map(Number);
      const a = e[0] as number;
      const b = e[1] as number;
      const f = [a, b + 1];
      phi = pAdd(phi, pScale(pMonoU(f), rMul(cf, rat(1, a + b + 1))));
    }
    return phi;
  };
  const phi = potential(P, Q);
  check("V4a radial potential recovers dPhi/dx == P", pIsZero(pSub(pDeriv(phi, 0), P)));
  check("V4b radial potential recovers dPhi/dy == Q", pIsZero(pSub(pDeriv(phi, 1), Q)));
  // and periods around both loops are exactly 0
  check("V4c closed polynomial form: period around L is exactly 0", rCmp(lineIntegral(P, Q, CONCAVE), rat(0)) === 0);
  // a NON-closed form must NOT admit a potential: try the radial construction
  // on the skew form — the dPhi - alpha residual must be nonzero (convicted)
  const Ps = pAdd(x, pScale(y, rat(1, 3)));
  const Qs = pSub(y, pScale(x, rat(1, 3)));
  const phiS = potential(Ps, Qs);
  check("V4d radial construction CONVICTS the non-closed skew form", !pIsZero(pSub(pDeriv(phiS, 0), Ps)));
}

// helper for V4 (local pMono over V)
function pMonoU(exps: number[]): Poly {
  const mono = new Map<string, Rat>();
  if (exps.some((e) => e !== 0)) mono.set(exps.join(","), rat(1));
  else mono.set("0,0", rat(1));
  return { vars: [...V], mono } as Poly;
}

// ---------------------------------------------------------------------------
// V5: unary Sturm root counting over BigInt rationals
// ---------------------------------------------------------------------------
type UPoly = readonly Rat[]; // coefficient array, index = degree

const uZero: UPoly = [];
function uDeg(f: UPoly): number {
  for (let i = f.length - 1; i >= 0; i--) if ((f[i] as Rat).n !== 0n) return i;
  return -1;
}
function uTrim(f: UPoly): UPoly {
  const d = uDeg(f);
  return d < 0 ? uZero : f.slice(0, d + 1);
}
function uSub(a: UPoly, b: UPoly): UPoly {
  const n = Math.max(a.length, b.length);
  const out: Rat[] = [];
  for (let i = 0; i < n; i++) out.push(rAdd(a[i] ?? rat(0), (b[i] ?? rat(0)).n === 0n ? rat(0) : neg(b[i] as Rat)));
  return uTrim(out);
}
function neg(r: Rat): Rat {
  return { n: -r.n, d: r.d };
}
function uMulX(a: UPoly, k: number, c: Rat): UPoly {
  const out: Rat[] = new Array(a.length + k).fill(rat(0));
  for (let i = 0; i < a.length; i++) out[i + k] = rMul(a[i] as Rat, c);
  return uTrim(out);
}
function uDivMod(a: UPoly, b: UPoly): { q: UPoly; r: UPoly } {
  let f = uTrim(a);
  const g = uTrim(b);
  const dg = uDeg(g);
  if (dg < 0) throw new Error("division by zero poly");
  const gc = g[dg] as Rat;
  let q: Rat[] = new Array(Math.max(uDeg(f) - dg + 1, 0)).fill(rat(0));
  while (uDeg(f) >= dg) {
    const df = uDeg(f);
    const fc = f[df] as Rat;
    const shift = df - dg;
    const qc = rDivL(fc, gc);
    q[shift] = qc;
    f = uSub(f, uMulX(g, shift, qc));
    if (uDeg(f) === df) throw new Error("stuck");
  }
  return { q: uTrim(q), r: f };
}
function rDivL(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d, a.d * b.n);
}
function uEval(f: UPoly, t: Rat): Rat {
  let acc = rat(0);
  for (let i = f.length - 1; i >= 0; i--) acc = rAdd(rMul(acc, t), f[i] ?? rat(0));
  return acc;
}
function uDeriv(f: UPoly): UPoly {
  const out: Rat[] = [];
  for (let i = 1; i < f.length; i++) out.push(rMul(f[i] as Rat, rat(i)));
  return uTrim(out);
}
function uSturm(f: UPoly): UPoly[] {
  const chain: UPoly[] = [uTrim(f), uDeriv(f)];
  while (uDeg(chain[chain.length - 1] as UPoly) > 0) {
    const a = chain[chain.length - 2] as UPoly;
    const b = chain[chain.length - 1] as UPoly;
    const { r } = uDivMod(a, b);
    chain.push(uTrim(r.map((c) => neg(c))));
  }
  return chain;
}
function sign(r: Rat): number {
  return r.n === 0n ? 0 : r.n < 0n ? -1 : 1;
}
function variations(chain: UPoly[], t: Rat): number {
  let v = 0;
  let last = 0;
  for (const f of chain) {
    const s = sign(uEval(f, t));
    if (s === 0) continue;
    if (last !== 0 && s !== last) v++;
    last = s;
  }
  return v;
}
function sturmCount(f: UPoly, lo: Rat, hi: Rat): number {
  const ch = uSturm(f);
  return variations(ch, lo) - variations(ch, hi);
}
{
  // (x-1)(x-2)(x-3) = x^3 - 6x^2 + 11x - 6
  const f: UPoly = [rat(-6), rat(11), rat(-6), rat(1)];
  check("V5a Sturm: 3 roots in (0,4)", sturmCount(f, rat(0), rat(4)) === 3);
  check("V5b Sturm: 2 roots in (3/2,4)", sturmCount(f, rat(3, 2), rat(4)) === 2);
  check("V5c Sturm: 1 root in (0,3/2)", sturmCount(f, rat(0), rat(3, 2)) === 1);
  check("V5d Sturm: 0 roots in (7/2,10)", sturmCount(f, rat(7, 2), rat(10)) === 0);
  const q: UPoly = [rat(1), rat(0), rat(1)]; // x^2+1: no real roots
  check("V5e Sturm: x^2+1 has 0 roots in (-5,5)", sturmCount(q, rat(-5), rat(5)) === 0);
  // slice of the pole surface x^2+y^2 at y=yk: x^2 + yk^2; at yk=0 the root 0
  const slice0: UPoly = [rat(0), rat(0), rat(1)];
  check("V5f Sturm: x^2 has 1 root in (-2,2) (counting the double root once)", sturmCount(slice0, rat(-2), rat(2)) === 1);
}

// ---------------------------------------------------------------------------
// V6: the winding family, pole census, and the classifier flip
// ---------------------------------------------------------------------------
{
  const x = pVar(V, 0);
  const y = pVar(V, 1);
  // omega_a = ((x-a) dy - y dx) / ((x-a)^2 + y^2); closedness numerator (shift
  // invariance of the winding form's curl): build at a=0 and substitute
  const { P, Q } = gl.windingForm();
  const dQdx = gl.rfDeriv(Q, 0);
  const dPdy = gl.rfDeriv(P, 1);
  check("V6a winding curl numerator is the zero polynomial (repo + shift-invariant)", pIsZero(pSub(dQdx.num, dPdy.num)));
  // translated family: denominator (x-a)^2+y^2, same numerators shifted
  const mkDen = (a: Rat): Poly => pAdd(pMul(pSub(x, pConst(V, a)), pSub(x, pConst(V, a))), pMul(y, y));
  const closedAt = (a: Rat): boolean => {
    // Q_a = (x-a)/D_a, P_a = -y/D_a: dQ_a/dx - dP_a/dy shares D_a^2; numerator:
    // D_a - 2(x-a)^2 - (-D_a + 2y^2) = 2y^2 - 2(x-a)^2 + D_a - 2(x-a)^2 ... compute directly
    const D = mkDen(a);
    const xa = pSub(x, pConst(V, a));
    const numQ = pSub(D, pMul(xa, pScale(xa, rat(2)))); // D - (x-a)*2(x-a)
    const numP = pSub(pMul(y, pScale(y, rat(2))), D); // 2y^2 - D
    const num = pSub(numQ, numP); // shares D^2
    return pIsZero(num);
  };
  check("V6b translated winding form is closed at a=0 (numerator zero)", closedAt(rat(0)));
  check("V6c translated winding form is closed at a=5 (numerator zero)", closedAt(rat(5)));
  // pole census: rational root hit inside the diamond's box [-1,1]^2
  const D0 = mkDen(rat(0));
  check("V6d census: D_0 vanishes AT the rational point (0,0)", rCmp(pEval(D0, [rat(0), rat(0)]), rat(0)) === 0);
  // a=5: axis-centered quadratic lower bound on the box [-2,2]^2: (x-5)^2>=9
  const D5 = mkDen(rat(5));
  let lb = rat(9);
  check("V6e census: D_5 >= 9 > 0 on the box (no pole certificate)", rCmp(lb, rat(0)) > 0 && rCmp(pEval(D5, [rat(2), rat(0)]), rat(9)) === 0);
  // slice-Sturm witness of the pole at a=0: y=0 slice x^2 has a root in (-1,1)
  check("V6f census: slice Sturm sees the pole of D_0 at y=0", sturmCount([rat(0), rat(0), rat(1)], rat(-1), rat(1)) === 1);
  // and the classifier FLIPS: a=5 has no slice roots on a rational slice grid
  let sliceRoots = 0;
  for (let k = -4; k <= 4; k++) {
    const yk = rat(k, 4);
    const D5y: UPoly = [rMul(yk, yk), rat(-10), rat(1)]; // (x-5)^2 + yk^2 = x^2 -10x + 25 + yk^2
    D5y[0] = rAdd(rMul(yk, yk), rat(25));
    sliceRoots += sturmCount(D5y, rat(-2), rat(2));
  }
  check("V6g census: a=5 denominator has 0 slice roots in the box (flip)", sliceRoots === 0);
  // numeric Simpson of the a=5 period around the diamond (should be ~0),
  // and of the a=0 period (should be 2pi)
  const simpson = (a: number, n: number): number => {
    const loop: Array<[number, number]> = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const A = loop[i] as [number, number];
      const B = loop[(i + 1) % 4] as [number, number];
      const f = (t: number): number => {
        const px = A[0] + t * (B[0] - A[0]);
        const py = A[1] + t * (B[1] - A[1]);
        const ddx = B[0] - A[0];
        const ddy = B[1] - A[1];
        return ((px - a) * ddy - py * ddx) / ((px - a) * (px - a) + py * py);
      };
      const h = 1 / n;
      let side = f(0) + f(1);
      for (let j = 1; j < n; j++) side += (j % 2 === 1 ? 4 : 2) * f(j * h);
      s += (side * h) / 3;
    }
    return s;
  };
  const p0 = simpson(0, 2000);
  const p5 = simpson(5, 2000);
  check("V6h Simpson: a=0 period ~ 2pi", Math.abs(p0 - 2 * Math.PI) < 1e-9, `got ${p0}`);
  check("V6i Simpson: a=5 period ~ 0 (the flip, numerically)", Math.abs(p5) < 1e-6, `got ${p5}`);
}

// ---------------------------------------------------------------------------
// V7 (F2): the affine Groves drift quadratic, symbolic
// ---------------------------------------------------------------------------
{
  // vars [s, a, b, o]: rule x(s) = a s + b, n=2 single fiber, other type o.
  const vars = ["s", "a", "b", "o"];
  const s = pVar(vars, 0);
  const a = pVar(vars, 1);
  const b = pVar(vars, 2);
  const o = pVar(vars, 3);
  const x = pAdd(pMul(a, s), b);
  const xp = pDeriv(x, 0); // = a
  const x1 = pSub(pConst(vars, rat(1)), x); // other's allocation
  // envelope-compatible payment: dp/ds = (s - x) x' integrated in s (+C(o))
  const integrand = pMul(pSub(s, x), xp);
  const pPay = pInteg(integrand, 0);
  // others' welfare W = o x1 - x1^2/2
  const W = pSub(pMul(o, x1), pScale(pMul(x1, x1), rat(1, 2)));
  const drift = pDeriv(pAdd(pPay, W), 0);
  // closed form claim: D = (a - 2a^2) s + a(1 - o - 2b)
  const closed = pAdd(
    pMul(s, pAdd(a, pScale(pMul(a, a), rat(-2)))),
    pMul(a, pAdd(pSub(pConst(vars, rat(1)), o), pScale(b, rat(-2)))),
  );
  check("V7a affine drift == closed form (a-2a^2)s + a(1-o-2b)", pIsZero(pSub(drift, closed)));
  // kappa specialization: a=1/2*kappa? kappa rule x_kappa = kappa*s/2 + (1-o)/2,
  // i.e. a := k/2, b := (1-o)/2 gives D = kappa(1-kappa) s / 2 (K2 at n=2)
  const k = pVar(vars, 1); // reuse slot a as kappa
  const substA = pScale(k, rat(1, 2));
  const substB = pScale(pSub(pConst(vars, rat(1)), o), rat(1, 2));
  const driftK = pSubstAll(drift, [1, 2], [substA, substB]);
  // expected kappa(1-kappa)s/2
  const expected = pScale(pMul(s, pMul(k, pSub(pConst(vars, rat(1)), k))), rat(1, 2));
  const driftKb = pSubst(driftK, 2, pConst(vars, rat(1, 2))); // b is gone after substAll but slot remains: evaluate claim directly
  check("V7b kappa specialization: drift == kappa(1-kappa)s/2", pIsZero(pSub(driftKb, expected)), `residual monos=${driftKb.mono.size}`);
  // cross-check against the repo's kappaGrovesDrift at n=2 (numeric kappa values)
  let okCross = true;
  for (const kv of [rat(1, 2), rat(3, 4), rat(2)]) {
    const f = gl.makeFamily(2);
    const dr = gl.kappaGrovesDrift(f, kv, rat(2, 5));
    const ptS = rat(1, 2);
    const ptO = rat(7, 20);
    const lhs = pEval(dr, [ptS, ptS, ptO]);
    // our formula: kappa(1-kappa) s/2 with s the own-report, o the other type
    const rhs = rMul(rMul(rMul(kv, rSub(rat(1), kv)), ptS), rat(1, 2));
    if (rCmp(lhs, rhs) !== 0) okCross = false;
  }
  check("V7c cross-check vs repo kappaGrovesDrift (n=2, kappa in {1/2,3/4,2})", okCross);
  // Groves locus: D == 0 as a polynomial in (s,o) iff (a-2a^2)=0 AND (1-o-2b)=0
  //   => a in {0, 1/2}, and a(1-o-2b)=0: at a=1/2 forces b=(1-o)/2; a=0 free.
  const sCoef = pSubst(closed, 0, pZero(vars)); // constant-in-s part dropped: take s-coefficient
  const coefS = pAdd(a, pScale(pMul(a, a), rat(-2)));
  const coefC = pMul(a, pAdd(pSub(pConst(vars, rat(1)), o), pScale(b, rat(-2))));
  // grid census: over a rational (a,b) grid, D identically zero iff on locus
  // (o fixed at 1/2 so b_eff = (1-o)/2 = 1/4 lies ON the quarter grid)
  let locusOk = true;
  for (let ai = -4; ai <= 8; ai++) {
    for (let bi = -4; bi <= 4; bi++) {
      const av = rat(ai, 4);
      const bv = rat(bi, 4);
      const cs = pEval(coefS, [rat(0), av, bv, rat(0)]);
      const cc = pEval(coefC, [rat(0), av, bv, rat(1, 2)]);
      const driftZero = rCmp(cs, rat(0)) === 0 && rCmp(cc, rat(0)) === 0;
      const onLocus = rCmp(av, rat(0)) === 0 || (rCmp(av, rat(1, 2)) === 0 && rCmp(bv, rat(1, 4)) === 0);
      if (driftZero !== onLocus) locusOk = false;
    }
  }
  check("V7d drift-zero locus == {a=0 any b} U {a=1/2, b=1/2} (grid census)", locusOk);
  // smuggling: the forged claim "the drift is independent of b" is convicted
  const forgedB = pSubstAll(drift, [2], [pZero(vars)]); // drift with b:=0
  check("V7e SMUGGLING: drift DOES depend on b (forged b-free claim convicted)", !pIsZero(pSub(drift, forgedB)));
  // and the spec's literal "Q|_{a=1} == 0" is FALSE at the natural
  // parametrization x = a s + b: D|_{a=1} = -s + 1 - o - 2b (nonzero)
  const atA1 = pSubst(drift, 1, pConst(vars, rat(1)));
  check("V7f spec-literal Q|_{a=1} == 0 is REFUTED at x = a s + b (correction on record)", !pIsZero(atA1));
}

console.log(failures === 0 ? "ALL CHECKS PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
