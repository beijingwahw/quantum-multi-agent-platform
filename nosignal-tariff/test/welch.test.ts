import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RefusalError } from "../src/core/errors.js";
import {
  type Frac,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fMul,
  fSub,
  fr,
} from "../src/kernel/rational.js";
import {
  ANTIPODE_RAW,
  type CS3,
  type RawKet,
  type S3,
  TETRAHEDRON_RAW,
  assertConstantOverlap,
  besselSum,
  h2SosParts,
  h2Trace,
  h2TrSq,
  h2WelchDefect,
  ketNormSq,
  ketOverlapSq,
  sicExclusionCertificate,
  s3Sign,
  sosGridCertificate,
  tetraFrameOperator,
  tetraGramSum,
  tetraOverlapSq,
  tetraOverlapsWith,
  welchExclusionQubit,
} from "../src/kernel/welch.js";

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

/** Local raw-ket builder for exact test vectors (the exported constructors stay internal). */
const s3l = (a: Frac, b: Frac = F_ZERO): S3 => ({ a, b });
const cs = (re: S3, im: S3 = s3l(F_ZERO)): CS3 => ({ re, im });
const rk = (c0: CS3, c1: CS3): RawKet => ({ c0, c1 });
const THIRD = fr(1, 3);

describe("T10.a the 2x2 Hermitian SOS identity is certified on the exact grid", () => {
  it("625 points: 2TrM^2 - (TrM)^2 = (A-D)^2 + 4(X^2+Y^2) with zero residual everywhere", () => {
    const cert = sosGridCertificate();
    assert.equal(cert.points, 625);
    assert.ok(
      cert.sosIdentityHolds,
      "the grid certificate must hold with zero residual on every point",
    );
  });

  it("off-grid spot check at an independently computed rational point (A,D,X,Y) = (3/2, -1/4, 1/7, -2/9)", () => {
    const A = fr(3, 2);
    const D = fr(-1, 4);
    const X = fr(1, 7);
    const Y = fr(-2, 9);
    const m = { aa: s3l(A), bb: cs(s3l(X), s3l(Y)), dd: s3l(D) };
    // the test's own expression for the defect — written independently of the module's path
    const expected = fSub(
      fMul(
        fr(2),
        fAdd(
          fAdd(fMul(A, A), fMul(D, D)),
          fMul(fr(2), fAdd(fMul(X, X), fMul(Y, Y))),
        ),
      ),
      fMul(fAdd(A, D), fAdd(A, D)),
    );
    const defect = h2WelchDefect(m);
    assert.equal(
      fCmp(defect.a, expected),
      0,
      "module defect != test-side defect at the spot point",
    );
    assert.equal(
      fCmp(defect.b, F_ZERO),
      0,
      "the spot point is rational — the sqrt3 limb must vanish",
    );
    const parts = h2SosParts(m);
    assert.equal(s3Sign(parts.diag), 1, "(A-D)^2 > 0 at the spot point");
    assert.equal(s3Sign(parts.off), 1, "4(X^2+Y^2) > 0 at the spot point");
  });
});

describe("T10.b the tetrahedron is the positive control: Welch saturation, exactly", () => {
  it("four raw kets over Q(i, sqrt3), norms 6 +/- 2*sqrt3, all twelve ordered pairwise overlaps exactly 1/3", () => {
    assert.equal(TETRAHEDRON_RAW.length, 4);
    const normB = [2, -2, -2, 2];
    for (let i = 0; i < 4; i++) {
      const n = ketNormSq(TETRAHEDRON_RAW[i]!);
      assert.equal(fCmp(n.a, fr(6)), 0, `norm rational limb of ray ${i}`);
      assert.equal(fCmp(n.b, fr(normB[i]!)), 0, `norm sqrt3 limb of ray ${i}`);
      assert.equal(
        fCmp(tetraOverlapSq(i, i), F_ONE),
        0,
        `self overlap of ray ${i}`,
      );
      for (let j = 0; j < 4; j++)
        if (j !== i)
          assert.equal(
            fCmp(tetraOverlapSq(i, j), THIRD),
            0,
            `overlap (${i},${j})`,
          );
    }
  });

  it("the frame operator is exactly 2I: trace 4, both trace paths give Tr M^2 = 8 = 16/2, defect 0 with both squares 0", () => {
    const m = tetraFrameOperator();
    assert.equal(fCmp(m.aa.a, fr(2)), 0);
    assert.equal(fCmp(m.aa.b, F_ZERO), 0);
    assert.equal(fCmp(m.dd.a, fr(2)), 0);
    assert.equal(fCmp(m.dd.b, F_ZERO), 0);
    assert.equal(s3Sign(m.bb.re), 0);
    assert.equal(s3Sign(m.bb.im), 0);
    assert.equal(fCmp(h2Trace(m).a, fr(4)), 0);
    // path 1: frame-operator arithmetic; path 2: the 16 pairwise overlaps
    assert.equal(fCmp(h2TrSq(m).a, fr(8)), 0);
    assert.equal(fCmp(h2TrSq(m).b, F_ZERO), 0);
    assert.equal(
      fCmp(tetraGramSum(), fr(8)),
      0,
      "the Gram path must also give 8",
    );
    assert.equal(
      s3Sign(h2WelchDefect(m)),
      0,
      "the Welch defect is exactly 0 at saturation",
    );
    const parts = h2SosParts(m);
    assert.equal(s3Sign(parts.diag), 0, "(A-D)^2 = 0");
    assert.equal(s3Sign(parts.off), 0, "4(X^2+Y^2) = 0");
  });
});

describe("T10.c the exclusion: five pairwise-c = 1/3 qubit rays cannot exist", () => {
  it("35/3 < 25/2 by exact cross-multiplication, margin 5/6, frame defect -5/3 < 0", () => {
    const v = sicExclusionCertificate();
    assert.ok(v.excluded);
    assert.equal(fCmp(v.sumSq, fr(35, 3)), 0);
    assert.equal(fCmp(v.bound, fr(25, 2)), 0);
    assert.equal(fCmp(v.margin, fr(5, 6)), 0);
    assert.equal(fCmp(v.frameDefect, fr(-5, 3)), 0);
    // the cross-multiplication the certificate prints: 70 < 75
    assert.ok(fCmp(fMul(v.sumSq, fr(6)), fMul(v.bound, fr(6))) < 0);
  });

  it("the boundary is sharp: n = 4 saturates (margin 0, not excluded) and c = 3/8 at n = 5 is exactly on the bound", () => {
    const tetra = welchExclusionQubit(4, THIRD);
    assert.equal(fCmp(tetra.sumSq, tetra.bound), 0);
    assert.equal(fCmp(tetra.margin, F_ZERO), 0);
    assert.ok(!tetra.excluded);
    const edge = welchExclusionQubit(5, fr(3, 8));
    assert.equal(fCmp(edge.margin, F_ZERO), 0);
    assert.ok(
      !edge.excluded,
      "c = 3/8 is the SIC boundary — the exclusion claims nothing there",
    );
  });
});

describe("T10.d the direct route: not even one ray extends the family at 1/3", () => {
  it("the Bessel identity sum_i |<v|psi_i>|^2 = 2 holds exactly on rational and Q(sqrt3) test vectors", () => {
    const e0 = rk(cs(s3l(F_ONE)), cs(s3l(F_ZERO)));
    const e1 = rk(cs(s3l(F_ZERO)), cs(s3l(F_ONE)));
    const uniform = rk(cs(s3l(F_ONE)), cs(s3l(F_ONE)));
    const surd = rk(
      cs(s3l(F_ZERO, F_ONE)),
      cs(s3l(F_ZERO), s3l(F_ZERO, F_ONE)),
    );
    for (const [label, v] of [
      ["e0", e0],
      ["e1", e1],
      ["(1,1)", uniform],
      ["(sqrt3, i*sqrt3)", surd],
      ["the antipode", ANTIPODE_RAW],
    ] as const)
      assert.equal(fCmp(besselSum(v), fr(2)), 0, `Bessel sum at ${label}`);
    // individual overlaps may be irrational — the Q(sqrt3) arithmetic is load-bearing
    assert.equal(
      codeOf(() => ketOverlapSq(e0, TETRAHEDRON_RAW[0]!)),
      "WELCH_IRRATIONAL",
    );
  });

  it("a claimed fifth ray would force the sum to 4/3 != 2 — the certificate's contradiction", () => {
    assert.notEqual(fCmp(fr(4, 3), fr(2)), 0);
  });
});

describe("T10.e smuggling trials and named refusals", () => {
  it("the antipode ray (overlaps 0, 2/3, 2/3, 2/3) is convicted by the constant-overlap gate", () => {
    const got = tetraOverlapsWith(ANTIPODE_RAW);
    assert.equal(got.length, 4);
    assert.equal(fCmp(got[0]!, F_ZERO), 0);
    for (let i = 1; i < 4; i++) assert.equal(fCmp(got[i]!, fr(2, 3)), 0);
    assert.equal(
      codeOf(() => {
        assertConstantOverlap(got, THIRD, "the antipode ray");
      }),
      "WELCH_NOT_EQUIANGULAR",
    );
  });

  it("a non-equiangular five-family (tetrahedron + antipode) passes Welch honestly and is refused certification", () => {
    const family = [...TETRAHEDRON_RAW, ANTIPODE_RAW];
    const overlaps: Frac[] = [];
    let total = F_ZERO;
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        const o =
          i < 4 && j < 4
            ? tetraOverlapSq(i, j)
            : ketOverlapSq(family[i]!, family[j]!);
        overlaps.push(o);
        total = fAdd(total, o);
      }
    assert.equal(
      codeOf(() => {
        assertConstantOverlap(overlaps, THIRD, "the five-family");
      }),
      "WELCH_NOT_EQUIANGULAR",
    );
    // its honest Welch total is 13 = 5 + 4 + 4, ABOVE the bound 25/2 — no contradiction, nothing to certify
    assert.equal(fCmp(total, fr(13)), 0);
    assert.ok(fCmp(total, fr(25, 2)) > 0);
  });

  it("domain refusals by name: n < 2, c outside [0,1], index out of range", () => {
    assert.equal(
      codeOf(() => welchExclusionQubit(1, THIRD)),
      "WELCH_N_RANGE",
    );
    assert.equal(
      codeOf(() => welchExclusionQubit(5, fr(7, 5))),
      "WELCH_C_RANGE",
    );
    assert.equal(
      codeOf(() => welchExclusionQubit(5, fr(-1, 5))),
      "WELCH_C_RANGE",
    );
    assert.equal(
      codeOf(() => tetraOverlapSq(4, 0)),
      "WELCH_TETRA_INDEX",
    );
  });
});
