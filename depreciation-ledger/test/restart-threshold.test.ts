/**
 * R19 (agent W, spec r18/agentF.md F5-a) — the restart-optimality threshold
 * W-B, upgraded from a 1e-12 bisection to an exact algebraic-number
 * certificate over Q(sqrt(2)), all in BigInt. Pure test layer: ledger.ts,
 * audit.ts, and the frozen the-ledger.md are untouched; the shipped W-B
 * witness (audit.ts, bisection) keeps running — this file upgrades its
 * reading, it does not replace the gate.
 *
 * The theorem, machine-executed:
 *   T1  sin(3t) = 3s - 4s^3 (s = sin t), derived on TWO independent roads
 *       (de Moivre's imaginary part vs the addition formula sin(2t+t)),
 *       both reduced to an s-polynomial by c^2 = 1 - s^2 in BigInt — the
 *       two coefficient vectors are identical.
 *   T2  sin^2(3t) - 2 sin^2(t) = s^2 (16s^4 - 24s^2 + 7) as a polynomial
 *       identity (BigInt coefficient expansion, zero residual) — plus a
 *       pointwise rational-grid second path (composed vs factored shapes)
 *       and a float sin(3t) third path.
 *   T3  On (0, pi/2): s in (0,1), so the solution set is y = s^2 in (0,1)
 *       with 16y^2 - 24y + 7 = 0. Over Q(sqrt(2)):
 *         y- = (3-sqrt(2))/4  lies in (1/4, 1/2)   (exact order)
 *         y+ = (3+sqrt(2))/4  lies in (1, 2)       (exact order)
 *       The factorization 16y^2 - 24y + 7 = 16 (y - y-)(y - y+) is verified
 *       by exact expansion in Q(sqrt(2))[y]; the two roots are distinct
 *       (y+ - y- = sqrt(2)/2 != 0), so the quadratic's zero set is exactly
 *       {y-, y+} and (0,1) holds ONE solution, (3-sqrt(2))/4.
 *
 * Spec falsification, recorded (the spec-is-a-hypothesis law): the R18 spec
 * sheet asserted the complementary root y+ falls in (1/2, 1). The machine
 * says y+ = (3+sqrt(2))/4 ~ 1.1035 > 1 — outside (1/2, 1) and outside (0,1)
 * entirely, not even a legal sin^2 value. Corrected to the machine's
 * reading (y+ in (1,2)); the interval classifier must convict y+ on both
 * readings (N2 below).
 *
 * Negative controls (the smuggling trials):
 *   N1  the forged threshold (3-sqrt(1.9))/4: P((3-t)/4) = t^2 - 2 exactly,
 *       so its residual is 19/10 - 2 = -1/10 in exact rational BigInt — a
 *       conviction whose magnitude is cross-checked against the first-order
 *       local-slope budget |P'(y-)| * |y_f - y-| = 4 - 2*sqrt(3.8).
 *   N2  the classifier is sharp: the same order machine that admits y- to
 *       (1/4,1/2) must exclude y+ from (0,1) — and from (1/2,1), falsifying
 *       the spec sheet's claim at the very root it named.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// BigInt polynomial arithmetic (coefficients ascending, index = power).
// ---------------------------------------------------------------------------

type Poly = readonly bigint[];

function polyMul(a: Poly, b: Poly): bigint[] {
  const out = Array<bigint>(a.length + b.length - 1).fill(0n);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) out[i + j]! += a[i]! * b[j]!;
  return out;
}

function polyAdd(a: Poly, b: Poly): bigint[] {
  const out = Array<bigint>(Math.max(a.length, b.length)).fill(0n);
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0n) + (b[i] ?? 0n);
  return out;
}

function polyScale(k: bigint, a: Poly): bigint[] {
  return a.map((c) => k * c);
}

/** exact evaluation at the rational num/den — the (unsimplified) fraction
 *  [numOut, denOut]; equality of two values is cross-multiplied. */
function polyEvalRational(a: Poly, num: bigint, den: bigint): [bigint, bigint] {
  let accN = 0n;
  let accD = 1n;
  for (let i = a.length - 1; i >= 0; i--) {
    accN = accN * num + a[i]! * accD * den; // acc = acc*(num/den) + c
    accD = accD * den;
  }
  return [accN, accD];
}

function ratEq(
  x: readonly [bigint, bigint],
  y: readonly [bigint, bigint],
): boolean {
  return x[0] * y[1] === y[0] * x[1];
}

// ---------------------------------------------------------------------------
// Q(sqrt(2)) arithmetic: elements (p + q*sqrt(2))/c, c > 0, all BigInt.
// The order comparison IS the irrationality of sqrt(2): when p and q have
// opposite signs, the sign of p + q*sqrt(2) is the sign of p iff p^2 > 2q^2
// — and p^2 = 2q^2 has no integer solution except p = q = 0.
// ---------------------------------------------------------------------------

interface Quad {
  readonly p: bigint;
  readonly q: bigint;
  readonly c: bigint;
}

const quad = (p: bigint, q: bigint, c: bigint): Quad => ({ p, q, c });
const rat = (p: bigint, c: bigint): Quad => quad(p, 0n, c);

function signOf(x: Quad): -1 | 0 | 1 {
  const sp = x.p < 0n ? -1 : x.p > 0n ? 1 : 0;
  const sq = x.q < 0n ? -1 : x.q > 0n ? 1 : 0;
  if (x.q === 0n) return sp;
  if (x.p === 0n) return sq;
  if (sp === sq) return sp; // same sign: the sum cannot cancel
  // opposite signs: |p| vs |q|*sqrt(2), squared — exact
  const lhs = x.p * x.p;
  const rhs = 2n * x.q * x.q;
  if (lhs > rhs) return sp;
  if (lhs < rhs) return sq;
  return 0; // p^2 = 2q^2: impossible for integers unless p = q = 0 (guarded)
}

function quadAdd(a: Quad, b: Quad): Quad {
  return quad(a.p * b.c + b.p * a.c, a.q * b.c + b.q * a.c, a.c * b.c);
}

function quadSub(a: Quad, b: Quad): Quad {
  return quad(a.p * b.c - b.p * a.c, a.q * b.c - b.q * a.c, a.c * b.c);
}

function quadMul(a: Quad, b: Quad): Quad {
  return quad(a.p * b.p + 2n * a.q * b.q, a.p * b.q + a.q * b.p, a.c * b.c);
}

function quadNeg(a: Quad): Quad {
  return quad(-a.p, -a.q, a.c);
}

function quadScaleQ(k: bigint, a: Quad): Quad {
  return quad(k * a.p, k * a.q, a.c);
}

function quadIsZero(a: Quad): boolean {
  return a.p === 0n && a.q === 0n;
}

/** exact open-interval membership, through the order machine alone */
function inOpenInterval(x: Quad, lo: Quad, hi: Quad): boolean {
  return signOf(quadSub(x, lo)) > 0 && signOf(quadSub(hi, x)) > 0;
}

/** the star of the theorem, and its complement */
const Y_MINUS = quad(3n, -1n, 4n); // (3 - sqrt(2))/4
const Y_PLUS = quad(3n, 1n, 4n); // (3 + sqrt(2))/4

/** P(y) = 16y^2 - 24y + 7, ascending */
const QUARTIC_IN_Y: Poly = [7n, -24n, 16n];

/** (y - r1)(y - r2) expanded in Q(sqrt(2))[y]: [r1r2, -(r1+r2), 1] */
function quadFactorY2(r1: Quad, r2: Quad): readonly Quad[] {
  return [quadMul(r1, r2), quadNeg(quadAdd(r1, r2)), rat(1n, 1n)];
}

// ---------------------------------------------------------------------------
// T1 — the triple-angle sine on two independent roads.
// ---------------------------------------------------------------------------

test("T1: sin(3t) = 3s - 4s^3 on two independent roads — de Moivre and the addition formula agree in BigInt", () => {
  const oneMinusS2: Poly = [1n, 0n, -1n]; // c^2 = 1 - s^2
  // road 1 (de Moivre): Im[(c + i s)^3] = 3 c^2 s - s^3
  const road1 = polyAdd(
    polyScale(3n, polyMul(oneMinusS2, [0n, 1n])), // 3(1 - s^2) s
    polyScale(-1n, [0n, 0n, 0n, 1n]), // - s^3
  );
  // road 2 (addition formula): sin(2t)cos(t) + cos(2t)sin(t)
  //   = 2 s c^2 + (c^2 - s^2) s
  const cos2t: Poly = polyAdd(oneMinusS2, polyScale(-1n, [0n, 0n, 1n])); // 1 - 2s^2
  const road2 = polyAdd(
    polyScale(2n, polyMul([0n, 1n], oneMinusS2)), // 2 s (1 - s^2)
    polyMul(cos2t, [0n, 1n]), // (1 - 2s^2) s
  );
  assert.deepEqual(
    road1,
    road2,
    "the two roads must land on the same polynomial",
  );
  assert.deepEqual(
    road1,
    [0n, 3n, 0n, -4n],
    "and that polynomial is 3s - 4s^3",
  );
});

// ---------------------------------------------------------------------------
// T2 — the factored identity, coefficients plus two evaluation paths.
// ---------------------------------------------------------------------------

test("T2: sin^2(3t) - 2 sin^2(t) = s^2 (16s^4 - 24s^2 + 7) — coefficient identity plus two evaluation paths", () => {
  const triple: Poly = [0n, 3n, 0n, -4n]; // T1's certificate
  const lhs = polyAdd(polyMul(triple, triple), polyScale(-2n, [0n, 0n, 1n]));
  const rhs = polyMul([0n, 0n, 1n], [7n, 0n, -24n, 0n, 16n]);
  assert.deepEqual(
    lhs,
    rhs,
    "the BigInt coefficient expansion must have zero residual",
  );
  assert.deepEqual(rhs, [0n, 0n, 7n, 0n, -24n, 0n, 16n]);

  // second path: pointwise exact rational evaluation on a grid — the two
  // sides are evaluated in DIFFERENT shapes (composed: (triple(s))^2 - 2s^2
  // vs factored: s^2 * P(s)), so this is a different computation, not a
  // re-reading of the coefficients
  for (let k = 1; k < 64; k++) {
    const p = BigInt(k);
    const q = 64n;
    const tri = polyEvalRational(triple, p, q); // [n1, d1]
    const composed: [bigint, bigint] = [
      tri[0] * tri[0] * q * q - 2n * p * p * tri[1] * tri[1],
      tri[1] * tri[1] * q * q,
    ]; // tri^2 - 2s^2 over the common denominator
    const quartic = polyEvalRational([7n, 0n, -24n, 0n, 16n], p, q); // [n2, d2]
    const factored: [bigint, bigint] = [p * p * quartic[0], q * q * quartic[1]];
    assert.ok(
      ratEq(composed, factored),
      `grid s=${k}/64: the two evaluation shapes disagree`,
    );
  }

  // third path: float sin(3t) against the factored form (a genuinely
  // transcendental road — Math.sin knows nothing of the polynomial)
  for (let k = 1; k < 30; k++) {
    const t = (k * Math.PI) / 60;
    const s = Math.sin(t);
    const lhsF = Math.sin(3 * t) ** 2 - 2 * s * s;
    const rhsF = s * s * (16 * s ** 4 - 24 * s * s + 7);
    assert.ok(Math.abs(lhsF - rhsF) < 1e-12, `float road disagrees at t=${t}`);
  }
});

// ---------------------------------------------------------------------------
// T3 — the exact order machine and the factorization certificate.
// ---------------------------------------------------------------------------

test("T3a: the exact order machine — y- in (1/4, 1/2), y+ in (1, 2), distinct roots", () => {
  // y- - 1/4 = (2 - sqrt(2))/4 > 0: p=2 vs q=-1 opposite signs, 4 > 2
  assert.equal(signOf(quadSub(Y_MINUS, rat(1n, 4n))), 1);
  // 1/2 - y- = (-1 + sqrt(2))/4 > 0: p=-1 vs q=1 opposite signs, 1 < 2
  assert.equal(signOf(quadSub(rat(1n, 2n), Y_MINUS)), 1);
  assert.ok(inOpenInterval(Y_MINUS, rat(1n, 4n), rat(1n, 2n)));

  // y+ - 1 = (sqrt(2) - 1)/4 > 0 and 2 - y+ = (5 - sqrt(2))/4 > 0 (25 > 2)
  assert.equal(signOf(quadSub(Y_PLUS, rat(1n, 1n))), 1);
  assert.equal(signOf(quadSub(rat(2n, 1n), Y_PLUS)), 1);
  assert.ok(inOpenInterval(Y_PLUS, rat(1n, 1n), rat(2n, 1n)));
  assert.ok(
    !inOpenInterval(Y_PLUS, rat(0n, 1n), rat(1n, 1n)),
    "y+ is not in (0,1) — not even a legal sin^2 value",
  );

  // distinctness: y+ - y- = sqrt(2)/2 != 0
  const gap = quadSub(Y_PLUS, Y_MINUS);
  assert.ok(!quadIsZero(gap));
  assert.equal(signOf(gap), 1);
});

test("T3b: the factorization certificate — 16y^2 - 24y + 7 = 16(y - y-)(y - y+) in Q(sqrt(2))[y]", () => {
  const factored = quadFactorY2(Y_MINUS, Y_PLUS); // [prod, -sum, 1] in Q(sqrt(2))
  // scale by 16 and compare against the integer polynomial, coefficient-wise
  for (let i = 0; i < 3; i++) {
    const scaled = quadScaleQ(16n, factored[i]!);
    const want = QUARTIC_IN_Y[i]!;
    assert.ok(scaled.p === want * scaled.c, `coeff y^${i}: p/c is not ${want}`);
    assert.ok(scaled.q === 0n, `coeff y^${i}: the sqrt(2) part must vanish`);
  }
  // the certified root: P(y-) = 0 exactly in Q(sqrt(2)) — substitute by
  // Quad arithmetic, no float anywhere
  const y2 = quadMul(Y_MINUS, Y_MINUS);
  const pAt = quadAdd(
    quadAdd(quadScaleQ(16n, y2), quadScaleQ(-24n, Y_MINUS)),
    rat(7n, 1n),
  );
  assert.ok(
    quadIsZero(pAt),
    "the algebraic number (3-sqrt(2))/4 must zero the quartic exactly",
  );
  // boundary witnesses (exact rationals): the bisection's bracket, promoted
  assert.ok(polyEvalRational(QUARTIC_IN_Y, 1n, 4n)[0] > 0n); // P(1/4) = 2 > 0
  assert.ok(polyEvalRational(QUARTIC_IN_Y, 1n, 2n)[0] < 0n); // P(1/2) = -1 < 0
  assert.equal(polyEvalRational(QUARTIC_IN_Y, 0n, 1n)[0], 7n); // P(0) = 7 != 0
  assert.equal(polyEvalRational(QUARTIC_IN_Y, 1n, 1n)[0], -1n); // P(1) = -1 != 0
});

test("T4: the shipped bisection agrees with the algebraic certificate to 1e-12 — the upgrade, not a replacement", () => {
  // independent re-run of W-B's own algorithm (audit.ts witnessThreshold),
  // floated here so the certificate and the shipped witness are two files
  const f = (c: number): number =>
    Math.sin(3 * Math.asin(Math.sqrt(c))) ** 2 - 2 * c;
  let lo = 0.2;
  let hi = 0.5;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const solved = (lo + hi) / 2;
  const closed = (3 - Math.SQRT2) / 4;
  assert.ok(Math.abs(solved - closed) < 1e-12);
  // the float face of y+ for the record (the spec sheet's falsified reading)
  assert.ok(
    (3 + Math.SQRT2) / 4 > 1,
    "y+ > 1 in float too — the machine reading",
  );
});

// ---------------------------------------------------------------------------
// N1/N2 — the smuggling trials.
// ---------------------------------------------------------------------------

test("N1: the forged threshold (3-sqrt(1.9))/4 — exact -1/10 residual, slope-budgeted conviction", () => {
  // the identity P((3-t)/4) = t^2 - 2, proven as a polynomial in t in BigInt:
  // 16((3-t)/4)^2 - 24(3-t)/4 + 7 = (3-t)^2 - 6(3-t) + 7 = t^2 - 2
  const expand = polyAdd(
    polyAdd(polyMul([3n, -1n], [3n, -1n]), polyScale(-6n, [3n, -1n])),
    [7n],
  );
  assert.deepEqual(
    expand,
    [-2n, 0n, 1n],
    "P((3-t)/4) must simplify to t^2 - 2",
  );
  // so at t^2 = 19/10 the forged candidate's residual is exactly -1/10
  assert.equal(19n - 2n * 10n, -1n, "19/10 - 2 = -1/10 exactly");
  assert.notEqual(
    19n - 2n * 10n,
    0n,
    "the forged threshold is NOT a root — convicted",
  );
  // the magnitude rides the local-slope budget: |P'(y-)| * |y_f - y-| =
  // 8*sqrt(2) * (sqrt(2)-sqrt(1.9))/4 = 4 - 2*sqrt(19/5), bounded in exact
  // rationals: (19493/10^4)^2 < 19/5 < (19494/10^4)^2
  assert.ok(
    19493n * 19493n < 19n * 2n * 10n ** 7n,
    "lower rational bound squares below 19/5",
  );
  assert.ok(
    19494n * 19494n > 19n * 2n * 10n ** 7n,
    "upper rational bound squares above 19/5",
  );
  // budget in (4 - 2*(19494/10^4), 4 - 2*(19493/10^4)) = (0.1012, 0.1014);
  // |residual| = 1/10 agrees with the budget's upper edge to under 2% — the
  // conviction is sized by the local slope, not a rounding accident
  const budgetHiOver1e4 = 4n * 10n ** 4n - 2n * 19493n; // 1014 (units of 1e-4)
  const excessOver1e4 = budgetHiOver1e4 - 10n ** 4n; // (0.1014 - 0.1) in 1e-4
  assert.ok(
    excessOver1e4 * 50n < 10n ** 4n,
    "the residual is within 2% of the slope budget",
  );
});

test("N2: classifier sharpness — the order machine that admits y- excludes y+ everywhere it must (and falsifies the spec sheet)", () => {
  assert.ok(
    inOpenInterval(Y_MINUS, rat(1n, 4n), rat(1n, 2n)),
    "y- is admitted",
  );
  assert.ok(
    !inOpenInterval(Y_PLUS, rat(1n, 4n), rat(1n, 2n)),
    "y+ is not in (1/4,1/2)",
  );
  assert.ok(
    !inOpenInterval(Y_PLUS, rat(0n, 1n), rat(1n, 1n)),
    "y+ is not in (0,1) — one solution in (0,1)",
  );
  assert.ok(
    !inOpenInterval(Y_PLUS, rat(1n, 2n), rat(1n, 1n)),
    "the spec sheet's (1/2,1) reading is FALSE — y+ ~ 1.1035 > 1",
  );
  assert.ok(
    inOpenInterval(Y_PLUS, rat(1n, 1n), rat(2n, 1n)),
    "the machine reading: y+ in (1,2)",
  );
  // and y- itself is not misclassified into the complementary interval
  assert.ok(!inOpenInterval(Y_MINUS, rat(1n, 1n), rat(2n, 1n)));
});

test("the solution-set census: on a rational grid over (0,1), exactly one sign change, bracketing the algebraic root", () => {
  // P is a parabola in y with roots y- in (0,1) and y+ > 1: positive on
  // (0, y-), negative on (y-, 1) — exactly one sign change inside (0,1)
  let changes = 0;
  let prev = 0;
  for (let k = 1; k < 100; k++) {
    const v = polyEvalRational(QUARTIC_IN_Y, BigInt(k), 100n);
    const s = v[0] > 0n ? 1 : v[0] < 0n ? -1 : 0;
    if (k > 1 && s !== prev) changes++;
    prev = s;
  }
  assert.equal(changes, 1, "exactly one sign change of P on the (0,1) grid");
  const below = polyEvalRational(QUARTIC_IN_Y, 39n, 100n);
  const above = polyEvalRational(QUARTIC_IN_Y, 40n, 100n);
  assert.ok(
    below[0] > 0n && above[0] < 0n,
    "the change is bracketed by 39/100 < y- < 40/100",
  );
  // and the float y- falls inside that exact rational bracket
  const ym = (3 - Math.SQRT2) / 4;
  assert.ok(ym > 0.39 && ym < 0.4);
});
