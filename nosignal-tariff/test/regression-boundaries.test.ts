import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RefusalError } from "../src/core/errors.js";
import { mat, mAdd, matEq } from "../src/core/cmat.js";
import { partialTrace } from "../src/core/channels.js";
import { dephase } from "../src/kernel/collapse.js";
import { traceDistance } from "../src/core/measures.js";
import {
  F_ONE,
  F_ZERO,
  fCmp,
  fDecimal,
  fr,
  h2Closed,
  h2Series,
} from "../src/kernel/rational.js";
import {
  assertStinespring,
  krausToStinespring,
  switchIsometry,
} from "../src/switch/isometry.js";
import { replacerKraus } from "../src/switch/chanlib.js";

/** Run `fn`, demand a RefusalError, return its code — the conviction is by name. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof RefusalError, `expected a RefusalError, got ${String(e)}`);
    return e.code;
  }
  assert.fail("expected a refusal, got a return value");
}

describe("regression: named refusals on degenerate and out-of-domain input (no silent NaN/garbage)", () => {
  it("dephase refuses degenerate dims by name — [0,3] used to silently zero a trace-1 state (SUBSYSTEM_DIMS_INVALID / DEPHASE_DIMS_MISMATCH)", () => {
    const rho3 = mat(3, 3);
    rho3.re[0] = 1;
    // probe of the old behavior: dephase(rho3, [0, 3], 0) returned the 3x3
    // zero matrix — trace 0, no error, no NaN visible in the result
    assert.equal(codeOf(() => dephase(rho3, [0, 3], 0)), "SUBSYSTEM_DIMS_INVALID");
    assert.equal(codeOf(() => dephase(rho3, [1.5, 2], 0)), "SUBSYSTEM_DIMS_INVALID");
    assert.equal(codeOf(() => dephase(rho3, [2, 2], 0)), "DEPHASE_DIMS_MISMATCH");
    assert.equal(codeOf(() => dephase(mat(2, 3), [2, 2], 0)), "DEPHASE_DIMS_MISMATCH");
    // legal neighbor: the pinned 4x4 dephase output, entry-exact
    const rho4 = mat(4, 4);
    rho4.re.set([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, -0.1, -0.2, -0.3, -0.4, 0.25, 0.25, 0.25, 0.25]);
    const d = dephase(rho4, [2, 2], 0);
    assert.deepEqual(Array.from(d.re), [0.1, 0.2, 0, 0, 0.5, 0.6, 0, 0, 0, 0, -0.3, -0.4, 0, 0, 0.25, 0.25]);
    assert.equal(d.im.every((v) => v === 0), true);
  });

  it("partialTrace refuses a non-square matrix whose rows match the product — it used to hand back NaN entries (PARTIALTRACE_DIMS_MISMATCH)", () => {
    // probe of the old behavior: a 4x2 matrix against dims [2,2] passed the
    // 2*2 === 4 rows check and read offsets past the 8 stored cells
    const ns = mat(4, 2);
    ns.re[0] = 0.5;
    ns.re[5] = 0.5;
    assert.equal(codeOf(() => partialTrace(ns, [2, 2], [0])), "PARTIALTRACE_DIMS_MISMATCH");
    // legal neighbor: the pinned 4x4 partial trace, entry-exact
    const rho4 = mat(4, 4);
    rho4.re.set([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, -0.1, -0.2, -0.3, -0.4, 0.25, 0.25, 0.25, 0.25]);
    const pt = partialTrace(rho4, [2, 2], [0]);
    assert.deepEqual(Array.from(pt.re), [-0.19999999999999998, -0.2, 0.75, 0.85]);
  });

  it("mAdd (and traceDistance with it) refuses mismatched shapes by name — 2x2 vs 4x4 used to return 0.375, quietly (MADD_SHAPE_MISMATCH)", () => {
    const a = mat(2, 2);
    a.re[0] = 1;
    const b = mat(4, 4);
    b.re[0] = 0.25;
    b.re[5] = 0.25;
    b.re[10] = 0.25;
    b.re[15] = 0.25;
    assert.equal(codeOf(() => mAdd(a, b)), "MADD_SHAPE_MISMATCH");
    assert.equal(codeOf(() => traceDistance(a, b)), "MADD_SHAPE_MISMATCH");
    // legal neighbor: a same-shape TV, exactly the pre-guard value
    const z = mat(2, 2);
    z.re[0] = 0.9;
    z.re[3] = 0.1;
    const half = mat(2, 2);
    half.re[0] = 0.5;
    half.re[3] = 0.5;
    assert.equal(traceDistance(z, half), 0.4);
  });

  it("matEq convicts non-finite entries — the isometry certificate used to PASS a NaN dilation (STINESPRING_ISOMETRY_FAILED)", () => {
    // probe of the old behavior: |NaN - x| > tol is false, so matEq called
    // V†V "equal" to I and assertStinespring certified a NaN isometry
    const v = mat(2, 1);
    v.re[0] = Number.NaN;
    v.re[1] = 1;
    assert.equal(matEq(mat(1, 1), mat(1, 1)), true); // shape guard still passes equal matrices
    assert.equal(codeOf(() => { assertStinespring({ d: 1, envDim: 2, V: v }); }), "STINESPRING_ISOMETRY_FAILED");
    // legal neighbor: a real dilation still certifies, with its pinned entries
    const st = krausToStinespring(replacerKraus(2));
    assert.equal(st.d, 2);
    assert.equal(st.envDim, 2);
    assert.deepEqual(Array.from(st.V.re), [
      0.7071067811865475, 0, 0, 0.7071067811865475,
      0.7071067811865475, 0, 0, 0.7071067811865475,
    ]);
  });

  it("krausToStinespring refuses an empty Kraus set — a 0-dimensional dilation used to pass V†V = I vacuously (KRAUS_EMPTY)", () => {
    // probe of the old behavior: krausToStinespring([]) returned {d: 0,
    // envDim: 0} with the certificate holding on the empty product
    assert.equal(codeOf(() => krausToStinespring([])), "KRAUS_EMPTY");
  });

  it("switchIsometry refuses a dimension mismatch by the same code as branchIsometry — it used to throw a bare, uncoded Error (BRANCH_DIM_MISMATCH)", () => {
    const st2 = krausToStinespring(replacerKraus(2));
    const st3 = krausToStinespring(replacerKraus(3));
    assert.equal(codeOf(() => switchIsometry(st2, st3)), "BRANCH_DIM_MISMATCH");
    // legal neighbor: same dimension still builds and certifies
    const sw = switchIsometry(st2, krausToStinespring(replacerKraus(2)));
    assert.equal(sw.d, 2);
  });

  it("h2Closed carries BOTH limit-0 endpoints — q = 1 used to refuse while its sibling q = 0 returned exact 0", () => {
    // probe of the old asymmetry: h2Closed(0) = exact 0 but h2Closed(1)
    // refused H2CLOSED_DOMAIN, though the README quotes both as closed forms
    assert.equal(fCmp(h2Closed(F_ONE).lo, F_ZERO), 0);
    assert.equal(fCmp(h2Closed(F_ONE).hi, F_ZERO), 0);
    // the series path keeps its honest exclusion at BOTH endpoints (d = ±1 diverges)
    assert.equal(codeOf(() => h2Series(F_ONE)), "H2SERIES_DOMAIN");
    assert.equal(codeOf(() => h2Series(F_ZERO)), "H2SERIES_DOMAIN");
    // legal neighbors: the pinned interior enclosures, digit-exact
    assert.equal(fDecimal(h2Closed(fr(1, 4)).lo, 30), "0.811278124459132863909088674586");
    assert.equal(fDecimal(h2Closed(fr(1, 4)).hi, 30), "0.811278124459132863910666417636");
    assert.equal(fDecimal(h2Series(fr(1, 4)).lo, 30), "0.811278124459132863909472062047");
    assert.equal(fDecimal(h2Series(fr(1, 4)).hi, 30), "0.811278124459132863909699134109");
  });
});
