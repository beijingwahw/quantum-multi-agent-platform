import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RefusalError } from "../src/core/errors.js";
import {
  type Frac,
  F_HALF,
  F_ONE,
  F_ZERO,
  PATH_T,
  fAdd,
  fCmp,
  fDecimal,
  fDiv,
  fSub,
  fr,
  iOf,
} from "../src/kernel/rational.js";
import { certifyStrictlyDecreasing } from "../src/kernel/theorem.js";
import { certifyAdaptiveDescent } from "../src/kernel/globalwall.js";
import {
  K4_BLOCK_TRACES,
  K4_COEFFICIENTS,
  S4,
  S4_IRREPS,
  affineLawDev,
  blockTracesOk,
  branch4s,
  branchIsometryOk,
  buildJoint4,
  characterTableCert,
  coefficientsMatchDirect,
  eigenBrackets,
  isotypicTrace,
  k4Chi,
  k4FloatGrid,
  k4GridCertificate,
  k4WallCertificate,
  leftInvarianceDev,
  memberEntropySymmetryDev,
  spectralClassTable,
  tCross4,
  zeroCoherenceExact,
  QUOTED_K4_CHI0,
  QUOTED_K4_FLOAT_MIN_DD,
  QUOTED_K4_FLOAT_MIN_GAP,
  QUOTED_K4_MAX_CHI_WIDTH,
  QUOTED_K4_MIN_CONVEX_DD,
  QUOTED_K4_MIN_DESCENT_GAP,
} from "../src/kernel/kswitch4.js";

const frDec = (s: string): Frac => {
  const m = /^(\d+)\.(\d+)$/.exec(s);
  if (m === null) return fr(BigInt(s));
  return fr(BigInt(m[1]! + m[2]!), BigInt(10 ** m[2]!.length));
};

const num = (f: Frac): number => Number(f.n) / Number(f.d);

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

describe("K4 the group and its character table (the class structure, owned by the machine)", () => {
  it("24 permutations, five classes 1/6/3/8/6, character table passes orthogonality", () => {
    assert.equal(S4.length, 24);
    const cert = characterTableCert();
    assert.ok(cert.orthogonal, "the character rows must be orthonormal");
    assert.ok(
      cert.regularLaw,
      "sum_R dim(R) chi_R must be the regular character",
    );
    assert.equal(cert.sumDimSquared, 24);
    assert.ok(cert.classSizesMatch);
  });

  it("a forged character row is convicted by the orthogonality relations (negative control)", () => {
    // the forger replaces the sign row by a second trivial row: the two rows
    // are no longer orthogonal (inner product 24, not 0)
    const forged = S4_IRREPS.map((R) =>
      R.name === "sign"
        ? { ...R, chi: { "1^4": 1, "2.1^2": 1, "2^2": 1, "3.1": 1, "4": 1 } }
        : R,
    );
    const sizes: Record<string, number> = {
      "1^4": 1,
      "2.1^2": 6,
      "2^2": 3,
      "3.1": 8,
      "4": 6,
    };
    let ortho = true;
    for (let i = 0; i < forged.length; i++)
      for (let j = i + 1; j < forged.length; j++) {
        const s = Object.keys(sizes).reduce(
          (acc, c) => acc + sizes[c]! * forged[i]!.chi[c]! * forged[j]!.chi[c]!,
          0,
        );
        if (s !== 0) ortho = false;
      }
    assert.ok(!ortho, "the duplicated trivial row must break orthogonality");
    assert.ok(characterTableCert().orthogonal); // the honest table still passes
  });
});

describe("K4 the 24-branch switch and the exact coefficient table", () => {
  it("all 24 branch isometries satisfy W^dagger W = I_2", () => {
    assert.equal(branch4s().length, 24);
    assert.ok(branch4s().every(branchIsometryOk));
  });

  it("the table re-derives from the branch isometries: avg scalar a*I, member diag(x, 2a-x)", () => {
    for (let t = 0; t < 24; t++) {
      const avg = tCross4(t, 0, [0.5, 0, 0, 0.5]);
      const mem = tCross4(t, 0, [1, 0, 0, 0]);
      const k = K4_COEFFICIENTS[t]!;
      const a = num(k.a);
      const x = num(k.x);
      assert.ok(
        Math.abs(avg[0]! - a) < 1e-12 && Math.abs(avg[3]! - a) < 1e-12,
        `avg a mismatch at #${t}`,
      );
      assert.ok(
        Math.abs(avg[1]!) < 1e-12 && Math.abs(avg[2]!) < 1e-12,
        `avg offdiagonal at #${t}`,
      );
      assert.ok(Math.abs(mem[0]! - x) < 1e-12, `member x mismatch at #${t}`);
      assert.ok(
        Math.abs(mem[3]! - (2 * a - x)) < 1e-12,
        `member 2a-x mismatch at #${t}`,
      );
      assert.ok(Math.abs(mem[1]!) < 1e-12 && Math.abs(mem[2]!) < 1e-12);
    }
  });

  it("the table-built 48x48 operators equal the direct 576-pair builds, both families", () => {
    assert.ok(coefficientsMatchDirect());
    assert.ok(
      (() => {
        const a = buildJoint4("avg", 1, true);
        const b = buildJoint4("avg", 1, false);
        let dev = 0;
        for (let i = 0; i < 48 * 48; i++)
          dev = Math.max(dev, Math.abs(a.re[i]! - b.re[i]!));
        return dev < 1e-12;
      })(),
    );
  });

  it("a forged coefficient is convicted by the direct build (negative control)", () => {
    // the forger nudges the 4-cycle coefficient #9 by one dyadic step
    const forged = K4_COEFFICIENTS.map((k, i) =>
      i === 9 ? { a: fAdd(k.a, fr(1, 1024)), x: k.x } : k,
    );
    const opForged = buildJoint4("avg", 1, true, forged);
    const opDirect = buildJoint4("avg", 1, false);
    let dev = 0;
    for (let i = 0; i < 48 * 48; i++)
      dev = Math.max(dev, Math.abs(opForged.re[i]! - opDirect.re[i]!));
    assert.ok(dev > 1e-6, "the forged table must separate from the physics");
    assert.ok(coefficientsMatchDirect()); // the honest table still matches
  });

  it("tCross4 refuses out-of-range permutation indices by name", () => {
    assert.equal(
      codeOf(() => tCross4(24, 0, [0.5, 0, 0, 0.5])),
      "KSWITCH4_INDEX",
    );
    assert.equal(
      codeOf(() => tCross4(0, -1, [0.5, 0, 0, 0.5])),
      "KSWITCH4_INDEX",
    );
  });
});

describe("K4 the circulant law and the exact isotypic traces", () => {
  it("entrywise left-invariance: rho[(g pi),(g sigma)] = rho[(pi),(sigma)] exactly, all 24 g", () => {
    assert.equal(leftInvarianceDev("avg"), 0);
    assert.equal(leftInvarianceDev("member"), 0);
  });

  it("the block-trace table is exact for both families: {7/32, 0, 1/8, 3/8, 9/32}", () => {
    assert.ok(blockTracesOk());
    for (let i = 0; i < S4_IRREPS.length; i++)
      assert.equal(
        fCmp(isotypicTrace(S4_IRREPS[i]!), K4_BLOCK_TRACES[i]!),
        0,
        `${S4_IRREPS[i]!.name} trace`,
      );
    // the sign isotypic component carries exactly ZERO weight
    assert.equal(fCmp(K4_BLOCK_TRACES[1]!, F_ZERO), 0);
  });

  it("the trace face reads only the a-column: Tr_S(T_tau) = 2a on both faces", () => {
    // the exact degeneracy: avg traces 2a (Tr aI), member traces x + (2a - x)
    // = 2a — the SAME number — which is why the block-trace table is
    // family-independent. The machine pins all five values exactly.
    for (let i = 0; i < S4_IRREPS.length; i++)
      assert.equal(
        fCmp(isotypicTrace(S4_IRREPS[i]!), K4_BLOCK_TRACES[i]!),
        0,
        `${S4_IRREPS[i]!.name} = ${fDecimal(K4_BLOCK_TRACES[i]!, 6)}`,
      );
  });
});

describe("K4 the spectral class table (machine-enumerated)", () => {
  it("blocks reconstruct the full spectrum; every distinct multiplicity is a multiple of dim(R)", () => {
    for (const family of ["avg", "member"] as const) {
      const t = spectralClassTable(family);
      assert.ok(
        t.pooledReconstructionDev < 1e-12,
        `${family}: pooled reconstruction`,
      );
      assert.equal(t.blocks.length, 5);
      for (const b of t.blocks)
        assert.ok(
          b.multiplicityLawHolds,
          `${family}/${b.irrep}: multiplicity law`,
        );
      assert.ok(
        Math.abs(b_sum(t.baseSpectrum) - 1) < 1e-9,
        `${family}: trace 1`,
      );
    }
  });

  it("the average spectrum: 0 x2, 1/128 x10, 3/128 x10, 7/64 x2 exactly pinned; alpha+beta = 5/128", () => {
    const t = spectralClassTable("avg");
    const counts = new Map<string, number>();
    for (const v of t.baseSpectrum) {
      for (const [label, val] of [
        ["0", 0],
        ["1/128", 1 / 128],
        ["3/128", 3 / 128],
        ["7/64", 7 / 64],
      ] as const)
        if (Math.abs(v - val) < 1e-9)
          counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    assert.equal(counts.get("0"), 2);
    assert.equal(counts.get("1/128"), 10);
    assert.equal(counts.get("3/128"), 10);
    assert.equal(counts.get("7/64"), 2);
    // the standard block: {alpha, 3/128, beta} each x6 — so alpha + beta = 5/128 EXACTLY
    const std = t.blocks[3]!;
    const unpinned = std.distinct
      .filter((d) => d.pin === null)
      .map((d) => d.value);
    assert.equal(unpinned.length, 2);
    const pinMid = std.distinct.find((d) => d.pin !== null)!.value;
    const alphaBeta = std.eigenvalues.reduce((s, v) => s + v, 0) / 6 - pinMid; // alpha + beta
    assert.ok(
      Math.abs(alphaBeta - 5 / 128) < 1e-9,
      `alpha+beta = ${alphaBeta} vs 5/128`,
    );
    assert.ok(Math.abs(pinMid - 3 / 128) < 1e-9);
  });

  it("chi4 at full coherence matches the float entropy difference (0.153274518...)", () => {
    const t = spectralClassTable("avg");
    assert.ok(Math.abs(t.chiAtFullCoherence - 0.153274518) < 1e-8);
  });
});

describe("K4 the weak readout (affine law and the exact endpoints)", () => {
  it("eig(c) = c base + (1-c)/48 at c in {0.9, 0.5, 0.37} (data, deviation < 1e-15)", () => {
    for (const c of [0.9, 0.5, 0.37])
      assert.ok(affineLawDev(c) < 1e-15, `affine law at c=${c}`);
  });

  it("a wrong uniform (1-c)/24 is refuted by the same data (negative control)", () => {
    // the forger's law moves the flat floor to 1/24: the deviation explodes
    let dev = 0;
    for (const family of ["avg", "member"] as const) {
      const base = spectralClassTable(family).baseSpectrum;
      const c = 0.5;
      const got = buildJoint4eigs(family, c);
      for (let i = 0; i < 48; i++)
        dev = Math.max(dev, Math.abs(got[i]! - (c * base[i]! + (1 - c) / 24)));
    }
    assert.ok(dev > 1e-3, "the wrong uniform must separate loudly");
  });

  it("zero coherence is exactly diag(1/48) — chi4(1) = [0,0] exact", () => {
    assert.ok(zeroCoherenceExact());
    const chi1 = k4Chi(F_ONE, PATH_T);
    assert.equal(fCmp(chi1.lo, F_ZERO), 0);
    assert.equal(fCmp(chi1.hi, F_ZERO), 0);
  });

  it("S(rho_0) = S(rho_1) — bit-flip covariance, deviation zero", () => {
    assert.equal(memberEntropySymmetryDev(), 0);
  });
});

describe("K4 the eigenvalue brackets and the exact chi4 enclosures", () => {
  it("48 brackets per family inside [0, 1/3), lo-endpoints non-decreasing, containing the float spectrum", () => {
    for (const family of ["avg", "member"] as const) {
      const brackets = eigenBrackets(family);
      assert.equal(brackets.length, 48);
      let prevLo = F_ZERO;
      let prevSet = false;
      for (let i = 0; i < 48; i++) {
        const b = brackets[i]!;
        assert.ok(fCmp(b.lo, b.hi) <= 0, `${family}: bracket is an interval`);
        if (prevSet)
          assert.ok(
            fCmp(b.lo, prevLo) >= 0,
            `${family}: bracket lo-endpoints non-decreasing`,
          );
        assert.ok(
          fCmp(b.lo, F_ZERO) >= 0 && fCmp(b.hi, fr(1, 3)) < 0,
          `${family}: bracket in [0,1/3)`,
        );
        prevLo = b.lo;
        prevSet = true;
      }
      const spec = spectralClassTable(family).baseSpectrum;
      for (let i = 0; i < 48; i++) {
        const b = brackets[i]!;
        const eig = fr(BigInt(Math.round(spec[i]! * 2 ** 28)), BigInt(2 ** 28));
        assert.ok(
          fCmp(eig, b.lo) >= 0 && fCmp(eig, b.hi) <= 0,
          `${family}: float eigenvalue ${spec[i]} must lie in its bracket`,
        );
      }
    }
  });

  it("a shifted bracket no longer contains its eigenvalue (negative control)", () => {
    const brackets = eigenBrackets("avg");
    const spec = spectralClassTable("avg").baseSpectrum;
    const shifted = {
      lo: fAdd(brackets[10]!.lo, fr(1, 100)),
      hi: brackets[10]!.hi,
    };
    const eig = fr(BigInt(Math.round(spec[10]! * 2 ** 28)), BigInt(2 ** 28));
    assert.ok(
      fCmp(eig, shifted.lo) < 0,
      "the inflated lo must exclude the true eigenvalue",
    );
    assert.ok(fCmp(eig, brackets[10]!.lo) >= 0); // the honest bracket still contains it
  });

  it("chi4(0) is tightly enclosed above the quoted floor, both ln paths overlap", () => {
    const t0 = k4Chi(F_ZERO, PATH_T);
    assert.ok(
      fCmp(t0.lo, frDec(QUOTED_K4_CHI0)) > 0,
      `chi4(0).lo = ${fDecimal(t0.lo, 9)}`,
    );
    const width = fSub(t0.hi, t0.lo);
    assert.ok(fCmp(width, frDec(QUOTED_K4_MAX_CHI_WIDTH)) <= 0);
    assert.ok(fCmp(t0.lo, t0.hi) <= 0);
  });
});

describe("K4 the certificates (quarter grid + covering subdivision)", () => {
  it("the quarter-grid certificate: strictly decreasing and convex on both ln paths with quoted floors", () => {
    const cert = k4GridCertificate();
    assert.ok(cert.ok, "the quarter-grid certificate must be green");
    assert.ok(cert.descent.every((d) => d.ok));
    assert.ok(cert.convex.every((c) => c.ok));
    assert.ok(cert.crossOverlapAll);
    assert.ok(fCmp(cert.minGap!, frDec(QUOTED_K4_MIN_DESCENT_GAP)) >= 0);
    assert.ok(fCmp(cert.minDD!, frDec(QUOTED_K4_MIN_CONVEX_DD)) >= 0);
    assert.ok(fCmp(cert.maxWidth, frDec(QUOTED_K4_MAX_CHI_WIDTH)) <= 0);
  });

  it("the covering subdivision: 8 cells at resolution 1/8, no conviction, globalwall engine", () => {
    const wall = k4WallCertificate();
    assert.ok(wall.ok, "the covering certificate must be green");
    for (const d of wall.descent) {
      assert.ok(d.ok);
      assert.equal(d.cells.length, 4); // 2 seeds x floor 1
      assert.equal(d.maxDepthUsed, 1); // honest: every floor-1 cell certifies, the bisection stays armed
      assert.ok(d.convicted === null);
      assert.ok(fCmp(d.minGap!, frDec("0.008")) >= 0);
    }
    for (const c of wall.convex) {
      assert.ok(c.ok);
      assert.equal(c.cells.length, 4);
      assert.ok(fCmp(c.minGap!, frDec("0.0039")) >= 0);
    }
  });

  it("a dented chi4 table is named by the shared descent checker (negative control)", () => {
    // the forger dips the middle grid point by 1/25 — far below the 0.008
    // quarter-grid gaps; the checker names the pair that dies
    const pts = [F_ZERO, fr(1, 4), fDiv(F_ONE, fr(2)), fr(3, 4), F_ONE];
    const table = pts.map((p) => k4Chi(p, PATH_T));
    const dented = table.map((iv, i) =>
      i === 2 ? { lo: fSub(iv.lo, fr(1, 25)), hi: fSub(iv.hi, fr(1, 25)) } : iv,
    );
    const r = certifyStrictlyDecreasing(dented);
    assert.ok(!r.ok, "the dented table must be rejected");
    assert.equal(r.firstFailure, 2); // the pair (1/2 -> 3/4) dies: the dented point is the lower end
    assert.ok(r.minGap === null); // no margin is minted for contraband
  });

  it("a flat curve cannot certify a descent (negative control, cheap constant forgery)", () => {
    const constant = iOf(k4Chi(fDiv(F_ONE, fr(2)), PATH_T).lo);
    const r = certifyAdaptiveDescent(
      () => constant,
      [
        { a: F_ZERO, b: F_HALF },
        { a: F_HALF, b: F_ONE },
      ],
      0,
      4,
    );
    assert.ok(!r.ok, "a constant curve has no descent to certify");
    const cc = r.convicted;
    assert.ok(cc !== null, "the conviction must be named with its cell");
    assert.ok(cc.depth >= 1);
  });

  it("the fine-scale float grid: decreasing and convex on all 21 points (data)", () => {
    const fg = k4FloatGrid();
    assert.equal(fg.values.length, 21);
    assert.ok(fg.decreasing);
    assert.ok(fg.convex);
    assert.ok(
      fg.minGap >= parseFloat(QUOTED_K4_FLOAT_MIN_GAP),
      `min gap ${fg.minGap.toExponential(4)}`,
    );
    assert.ok(
      fg.minDD >= parseFloat(QUOTED_K4_FLOAT_MIN_DD),
      `min dd ${fg.minDD.toExponential(4)}`,
    );
    assert.ok(Math.abs(fg.values[0]! - 0.153274518) < 1e-8);
  });
});

function b_sum(vals: readonly number[]): number {
  return vals.reduce((a, b) => a + b, 0);
}

// a tiny helper for the wrong-uniform control: eigenvalues of the family at coherence c
import { eigenvaluesHermitian } from "../src/core/cmat.js";
function buildJoint4eigs(family: "avg" | "member", c: number): Float64Array {
  return Float64Array.from(
    eigenvaluesHermitian(buildJoint4(family, c, true)),
  ).sort((a, b) => a - b);
}
