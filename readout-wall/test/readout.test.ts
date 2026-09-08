import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkExchange, runWitnesses, WITNESS_ROSTER } from "../src/kernel/audit.js";
import { EXCHANGE, type ExchangeRow } from "../src/kernel/ledger.js";
import { classicalMixture, dephase, partialDephase, readoutSlices } from "../src/kernel/collapse.js";
import { KET0, KET1, PAULI_Z, PLUS, vecToRho } from "../src/core/states.js";
import { fidelity, holevo, traceDistance } from "../src/core/measures.js";
import { RefusalError } from "../src/core/errors.js";
import { krausToStinespring, makeSwitchedChannel } from "../src/switch/isometry.js";
import { completelyDepolarizingKraus } from "../src/switch/chanlib.js";
import { switch3 } from "../src/kernel/kswitch3.js";
import { partialTrace } from "../src/core/channels.js";
import type { CMat } from "../src/core/cmat.js";
import {
  colFrom,
  eigHermitian,
  eigVecsFromValues,
  eigenvaluesHermitian,
  kron,
  mAdd,
  mMul,
  mScale,
  mat,
  vInner,
  vec,
} from "../src/core/cmat.js";
import {
  F_HALF,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDecimal,
  fDiv,
  fSub,
  fTerm,
  fToNumber,
  fr,
  iMid,
  iOf,
  negLn,
  PATH_A,
  PATH_T,
} from "../src/kernel/rational.js";
import {
  certifyAntichain,
  certifyConvexGrid,
  certifyStrictlyDecreasing,
  esc18Certificate,
  esc18Chi,
  familyOk,
  frontierCertificate,
  GRID_N,
  gridPoints,
  k3Certificate,
  replacerCertificate,
  type CensusPoint,
} from "../src/kernel/theorem.js";

/** deep-clone helper for the smuggling trials — contraband never touches the real ledger */
function smuggle(mutate: (rows: ExchangeRow[]) => void): ExchangeRow[] {
  const copy = JSON.parse(JSON.stringify(EXCHANGE)) as ExchangeRow[];
  mutate(copy);
  return copy;
}

/** Run `fn`, expect a RefusalError, return its code (message stays frozen prose).
 * Single source for every refusal trial — T7 and T8 share it. */
function refusalCode(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof RefusalError, `expected a RefusalError, got ${String(e)}`);
    assert.equal(e.name, "RefusalError");
    assert.ok(e.message.length > 0, "the frozen message surface must stay non-empty");
    return e.code;
  }
  assert.fail("expected a refusal, none was raised");
}

describe("T1 the exchange balances", () => {
  it("the checker passes on the real ledger", () => {
    assert.deepEqual(checkExchange(), []);
  });

  it("all six witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the collapse machinery", () => {
  const sc = makeSwitchedChannel(
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
  );
  const plus = vecToRho(PLUS);
  const rho: CMat = { rows: 2, cols: 2, re: Float64Array.from([1, 0, 0, 0]), im: new Float64Array(4) };

  it("full dephasing is idempotent and lambda=0/1 hit the endpoints", () => {
    const s = readoutSlices(sc, plus, rho);
    const d1 = dephase(s.full, [2, 2], 0);
    const d2 = dephase(d1, [2, 2], 0);
    assert.deepEqual(Array.from(d1.re), Array.from(d2.re));
    const p0 = partialDephase(s.full, [2, 2], 0, 0);
    const p1 = partialDephase(s.full, [2, 2], 0, 1);
    assert.deepEqual(Array.from(p0.re), Array.from(s.full.re));
    assert.deepEqual(Array.from(p1.re), Array.from(d1.re));
  });

  it("dephasing preserves the trace (a readout is a channel)", () => {
    const s = readoutSlices(sc, plus, rho);
    const d = dephase(s.full, [2, 2], 0);
    let tr = 0;
    for (let i = 0; i < d.rows; i++) tr += d.re[i * d.cols + i] as number;
    assert.ok(Math.abs(tr - 1) < 1e-12);
  });
});

describe("T3 smuggling trials — the exchange rejects contraband by name", () => {
  it("C1: a trade with only a GET column is named and rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { pay: string }).pay = "";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C1");
    assert.ok(hit, "expected a C1 violation");
    assert.equal(hit.row, "E1");
  });

  it("C2: an EXACT row citing a witness that does not exist is hearsay, rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { witness: string }).witness = "W-TRUST-ME";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C2");
    assert.ok(hit, "expected a C2 violation");
    assert.match(hit.detail, /W-TRUST-ME/);
  });

  it("C2: an illegal exactness tag is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { exactness: string }).exactness = "ROUGHLY";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C2");
    assert.ok(hit, "expected a C2 violation");
    assert.match(hit.detail, /ROUGHLY/);
  });

  it("C3: an anchor to a repo that is not on disk is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[4] as { anchors: readonly string[] }).anchors = ["ghost-repo"];
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C3");
    assert.ok(hit, "expected a C3 violation");
    assert.match(hit.detail, /ghost-repo/);
  });

  it("C5: a duplicated exchange id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[2] as { id: string }).id = "E1";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C5");
    assert.ok(hit, "expected a C5 violation");
  });
});

describe("T4 the interior theorem — exact certificates on the stated families", () => {
  it("F1/F2/F3 are certified strictly decreasing and convex on the grid, both ln paths", () => {
    for (const c of [esc18Certificate(), replacerCertificate(), k3Certificate()]) {
      assert.ok(familyOk(c), `${c.family} failed the certificate`);
      assert.equal(c.monotone.length, 2);
      assert.equal(c.convex.length, 2);
      assert.ok(c.minGap !== null && c.minDD !== null);
    }
  });

  it("the grid is exactly the 21 rational points i/20, endpoints 0 and 1 (v0.3.0 exact anchors)", () => {
    const pts = gridPoints();
    assert.equal(pts.length, GRID_N + 1);
    assert.equal(GRID_N, 20);
    assert.equal(fCmp(pts[0]!, F_ZERO), 0);
    assert.equal(fCmp(pts[GRID_N]!, F_ONE), 0);
    assert.equal(fCmp(pts[10]!, F_HALF), 0);
  });

  it("exact-value anchors of the rational kernel: iMid, endpoints of fTerm, fr sign normalization", () => {
    // the enclosure midpoint is the single-sourced quotation formula (v0.3.0's
    // C face: five former inline copies now all flow through iMid)
    assert.equal(fCmp(iMid(iOf(fr(1, 4))), fr(1, 4)), 0);
    assert.equal(fCmp(iMid({ lo: F_ZERO, hi: F_ONE }), F_HALF), 0);
    // the entropy endpoints contribute exactly nothing
    assert.equal(fCmp(fTerm(F_ZERO).lo, F_ZERO), 0);
    assert.equal(fCmp(fTerm(F_ONE, PATH_A).hi, F_ZERO), 0);
    // negative denominators normalize to the sign of the numerator
    assert.deepEqual(fr(1, -2), { n: -1n, d: 2n });
    // exact decimal long division, no rounding of the last digit
    assert.equal(fDecimal(fr(1, 8), 3), "0.125");
    // DEFECT ANCHOR (v0.3.0): a negative fraction terminating exactly at the
    // digit limit used to lose its minus ('0.125' was rendered) — the sign
    // now tracks the value
    assert.equal(fDecimal(fr(-1, 8), 3), "-0.125");
    assert.equal(fDecimal(fr(-1, 3), 3), "-0.333");
    assert.equal(fDecimal(fr(-3, 2), 4), "-1.5000");
  });

  it("the ln enclosures bracket the true log on both series paths", () => {
    // LN2_T and LN2_A must each contain ln 2
    const ln2 = Math.log(2);
    for (const ln2iv of [PATH_T.ln2, PATH_A.ln2]) {
      assert.ok(fToNumber(ln2iv.lo) <= ln2 && ln2 <= fToNumber(ln2iv.hi) + 1e-18);
    }
    for (const q of [fr(1, 3), fr(2, 3), fr(1, 48), fr(99, 320), fr(1, 1000)]) {
      // the float reference carries its own ulp-level error (Math.log of the
      // double nearest q, not of q) — the slack below is for the REFERENCE,
      // the enclosures themselves are exact and orders of magnitude tighter
      const target = -Math.log(fToNumber(q));
      const slack = 1e-15 * Math.max(1, Math.abs(target));
      const qtxt = `${fToNumber(q)}`;
      for (const iv of [negLn(q, PATH_T), negLn(q, PATH_A)]) {
        assert.ok(fToNumber(iv.lo) <= target + slack, `lo bracket failed at q=${qtxt}`);
        assert.ok(target <= fToNumber(iv.hi) + slack, `hi bracket failed at q=${qtxt}`);
      }
    }
  });
});

describe("T5 smuggling trials — counterfeit certificates are named and rejected", () => {
  const realCurve = gridPoints().map((p) => esc18Chi(p, PATH_T));

  it("counterfeit monotonicity: an inverted pair in the curve is named by cell index", () => {
    const contraband = realCurve.slice();
    const tmp = contraband[6]!;
    contraband[6] = contraband[5]!;
    contraband[5] = tmp;
    const res = certifyStrictlyDecreasing(contraband);
    assert.equal(res.ok, false);
    assert.equal(res.firstFailure, 5); // the smuggled pair is named, not just rejected
  });

  it("a float-sorted curve with uncertifiable widths is NOT a certificate", () => {
    // v0.1.0's discipline: the floats came out sorted, so the curve "looked"
    // monotone. Widen every enclosure past the certificate's minimum margin
    // and customs must refuse to certify what it cannot compare.
    const w = fr(1, 1000); // 1e-3 >> minGap ~ 1.1e-4
    const contraband = realCurve.map((iv) => ({ lo: fSub(iv.lo, w), hi: fAdd(iv.hi, w) }));
    const res = certifyStrictlyDecreasing(contraband);
    assert.equal(res.ok, false);
    assert.ok(res.firstFailure !== null);
  });

  it("counterfeit convexity: a flattened cell is named by cell index", () => {
    const contraband = realCurve.slice();
    contraband[10] = iOf(realCurve[9]!.hi); // a flat kink where the theorem says strictly convex
    const res = certifyConvexGrid(contraband);
    assert.equal(res.ok, false);
    assert.equal(res.firstFailure, 10);
  });

  it("fake frontier table: a point that dominates the census is named as a pair", () => {
    const fw = frontierCertificate();
    const realPoints: CensusPoint[] = fw.esc18.points.map((p) => ({ get: p.get, pay: p.pay }));
    // the counterfeit: order knowledge for almost nothing — dominates every honest point
    const counterfeit: CensusPoint = { get: iOf(fr(99, 100)), pay: iOf(fr(1, 1000000)) };
    const res = certifyAntichain([...realPoints.slice(0, 5), counterfeit, ...realPoints.slice(5)]);
    assert.equal(res.ok, false);
    assert.equal(res.dominator, 5); // the fabricated point, named
    assert.ok(res.dominated !== null && res.dominated !== 5);
  });

  it("C5: a row outside the E1..E6 numbering discipline is rejected by name", () => {
    const contraband = smuggle((rows) => {
      (rows[5] as { id: string }).id = "E7";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C5" && v.detail.includes("E1..E6"));
    assert.ok(hit, "expected the numbering-discipline violation");
  });
});

describe("T6 the renderer refuses to print an illegal ledger", () => {
  it("the smuggled ledger fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { pay: string }).pay = "";
    });
    const violations = checkExchange(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[C1\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-readout-wall.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});

describe("T7 refusal trials — every public refusal carries a named code (v0.3.0)", () => {
  const sc = makeSwitchedChannel(
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
  );
  const rho2: CMat = mat(2, 2); // |0⟩⟨0| — trace 1
  rho2.re[0] = 1;

  it("the readout layer refuses out-of-range subsystems and lambdas by name", () => {
    assert.equal(refusalCode(() => dephase(rho2, [2, 2], 2)), "DEPHASE_SYS_RANGE");
    assert.equal(refusalCode(() => dephase(rho2, [2, 2], -1)), "DEPHASE_SYS_RANGE");
    assert.equal(refusalCode(() => partialDephase(rho2, [2, 2], 0, 1.5)), "PARTIAL_DEPHASE_LAMBDA");
    assert.equal(refusalCode(() => partialDephase(rho2, [2, 2], 0, -0.25)), "PARTIAL_DEPHASE_LAMBDA");
  });

  it("classicalMixture refuses a non-qubit order register by name (NaN weights stay impossible)", () => {
    const control4 = mat(4, 4);
    control4.re[0] = 0.5;
    control4.re[5] = 0.5;
    control4.re[10] = 0.5;
    control4.re[15] = 0.5;
    assert.equal(
      refusalCode(() => classicalMixture(sc, control4, rho2, (r) => sc.fixedAB(r), (r) => sc.fixedBA(r))),
      "CLASSICAL_MIXTURE_QUBIT",
    );
  });

  it("the rational kernel refuses zero denominators and domain violations by name", () => {
    assert.equal(refusalCode(() => fr(1, 0)), "FR_ZERO_DENOMINATOR");
    assert.equal(refusalCode(() => fDiv(fr(1), fr(0))), "FDIV_ZERO_DIVISOR");
    assert.equal(refusalCode(() => negLn(fr(0))), "NEGLN_DOMAIN");
    assert.equal(refusalCode(() => negLn(fr(2))), "NEGLN_DOMAIN");
    assert.equal(refusalCode(() => fTerm(fr(5, 4))), "FTERM_DOMAIN");
    assert.equal(refusalCode(() => fTerm(fr(-1, 4))), "FTERM_DOMAIN");
  });

  it("the switch builders refuse short channel lists and bad shapes by name", () => {
    const good = krausToStinespring(completelyDepolarizingKraus(2));
    assert.equal(refusalCode(() => switch3([good, good])), "SWITCH3_CHANNEL_COUNT");
    assert.equal(refusalCode(() => krausToStinespring([mat(2, 2), mat(3, 3)])), "KRAUS_SHAPE");
  });

  it("DEFECT ANCHOR (v0.3.0): degenerate curves and censuses refuse instead of vacuously certifying", () => {
    // before v0.3.0 these returned ok:true — an empty curve smuggled a PASS
    // (probe: certifyStrictlyDecreasing([]) === {ok:true}); the live pipeline
    // always feeds 21 points, so no quoted number moves
    assert.equal(refusalCode(() => certifyStrictlyDecreasing([])), "CERT_DEGENERATE_CURVE");
    assert.equal(refusalCode(() => certifyStrictlyDecreasing([iOf(fr(1))])), "CERT_DEGENERATE_CURVE");
    assert.equal(refusalCode(() => certifyConvexGrid([iOf(fr(1)), iOf(fr(1))])), "CERT_DEGENERATE_CURVE");
    assert.equal(refusalCode(() => certifyAntichain([{ get: iOf(fr(1)), pay: iOf(fr(1)) }])), "CERT_DEGENERATE_CENSUS");
  });

  it("the canon core boundary (frozen bytes) still names its refusals in prose", () => {
    // measures.ts is byte-identical to the family canon — its guards throw
    // plain Errors with stable messages; the trial pins the message surface
    assert.throws(() => holevo([{ key: "0", state: rho2, weight: 0.9 }]), /weights must sum to 1/);
    assert.throws(() => holevo([]), /empty ensemble/);
  });

  it("legal neighbors of every refused input still pass (the refusals bite only contraband)", () => {
    // sys in range, lambda at the endpoints, q at the fTerm endpoints, full k=3 list
    const slices = readoutSlices(sc, vecToRho(PLUS), rho2);
    assert.ok(mat0(dephase(slices.full, [2, 2], 1)));
    assert.ok(mat0(partialDephase(slices.full, [2, 2], 0, 0)));
    assert.equal(fCmp(fTerm(fr(1)).lo, F_ZERO), 0);
    const good = krausToStinespring(completelyDepolarizingKraus(2));
    const sw = switch3([good, good, good]);
    // d=2, envDim=4 each: branch rows 2*4*4*4 = 128, six of them
    assert.equal(sw.branches.length, 6);
    assert.equal(sw.d, 2);
    assert.equal(sw.M.rows, 768);
  });

  /** a tiny always-true helper asserting the operand is a defined matrix */
  function mat0(m: CMat | undefined): boolean {
    assert.ok(m !== undefined);
    return m.rows > 0;
  }
});

describe("T8 the core kernel under the quality wave (v0.4.0)", () => {
  const sc = makeSwitchedChannel(
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
  );
  const rho2: CMat = mat(2, 2); // |0><0|
  rho2.re[0] = 1;

  it("single-source anchor: partialDephase IS the weak readout, bit-identical to the retired inline composition at every grid point", () => {
    // the C face: the four inline (1-l)*rho + l*Delta compositions in the audit
    // were retired in favor of partialDephase — this trial proves the interchange
    // on the showcase fixture, entry for entry, on the full 21-point grid
    const s = readoutSlices(sc, vecToRho(PLUS), rho2);
    for (let i = 1; i < GRID_N; i++) {
      const l = i / GRID_N;
      const inline = mAdd(mScale(s.full, 1 - l), mScale(s.readout, l));
      const single = partialDephase(s.full, [2, 2], 0, l);
      assert.deepEqual(Array.from(single.re), Array.from(inline.re), `re mismatch at lambda=${l}`);
      assert.deepEqual(Array.from(single.im), Array.from(inline.im), `im mismatch at lambda=${l}`);
    }
    // endpoints: the retired ternaries returned the slices themselves
    const p0 = partialDephase(s.full, [2, 2], 0, 0);
    const p1 = partialDephase(s.full, [2, 2], 0, 1);
    assert.deepEqual(Array.from(p0.re), Array.from(s.full.re));
    assert.deepEqual(Array.from(p0.im), Array.from(s.full.im));
    assert.deepEqual(Array.from(p1.re), Array.from(s.readout.re));
    assert.deepEqual(Array.from(p1.im), Array.from(s.readout.im));
  });

  it("the core numeric kernel (channels + cmat) refuses by name — messages frozen prose (v0.4.0)", () => {
    assert.equal(refusalCode(() => partialTrace(rho2, [2, 0.5], [])), "DIMS_POSITIVE_INTEGER");
    assert.equal(refusalCode(() => partialTrace(mat(4, 4), [2, 2], [2])), "PARTIAL_TRACE_INDEX_RANGE");
    assert.equal(refusalCode(() => partialTrace(mat(4, 4), [2, 2, 2], [])), "PARTIAL_TRACE_DIMS_MISMATCH");
    assert.equal(refusalCode(() => vInner(vec(2), vec(3))), "VINNER_LENGTH_MISMATCH");
    assert.equal(refusalCode(() => mAdd(mat(2, 2), mat(2, 3))), "MADD_SHAPE_MISMATCH");
    assert.equal(refusalCode(() => mMul(mat(2, 3), mat(2, 2))), "MMUL_SHAPE_MISMATCH");
    assert.equal(refusalCode(() => eigenvaluesHermitian(mat(2, 3))), "EIGENVALUES_NOT_SQUARE");
    assert.equal(refusalCode(() => eigHermitian(mat(2, 3))), "EIG_NOT_SQUARE");
    assert.equal(refusalCode(() => colFrom([1, 2], [1])), "COLFROM_LENGTH_MISMATCH");
    assert.equal(refusalCode(() => eigVecsFromValues(new Float64Array(4), 2, new Float64Array(1), 1)), "EIGVECS_VALUE_COUNT");
    // legal neighbors of every refused shape still pass (the refusals bite only contraband)
    assert.equal(mAdd(mat(2, 2), mat(2, 2)).rows, 2);
    assert.equal(mMul(mat(2, 3), mat(3, 2)).rows, 2);
    assert.equal(partialTrace(mat(4, 4), [2, 2], [1]).rows, 2);
  });

  it("exact-value anchors of the core linear algebra: kron, partialTrace, eigensolver, trace distance, fidelity", () => {
    // kron: Z (x) Z = diag(1, -1, -1, 1) — exact products, no tolerance
    const zz = kron(PAULI_Z, PAULI_Z);
    const want = [1, -1, -1, 1];
    for (let k = 0; k < 4; k++) assert.equal(zz.re[k * 4 + k], want[k]);
    for (let k = 0; k < 16; k++) {
      if (k % 5 !== 0) assert.equal(zz.re[k], 0);
    }
    // partialTrace on the Bell state |Phi+>: BOTH marginals are exactly I/2 —
    // the 1/2 coherences live in the JOINT off-diagonal (00,11), which the
    // trace kills; the marginal never carries them (the wrong-object lesson
    // this workspace has booked three times — here it is pinned by machine)
    const bell: CMat = mat(4, 4);
    bell.re[0] = 0.5; // (0,0)
    bell.re[3] = 0.5; // (0,3)
    bell.re[12] = 0.5; // (3,0)
    bell.re[15] = 0.5; // (3,3)
    const margA = partialTrace(bell, [2, 2], [1]);
    const margB = partialTrace(bell, [2, 2], [0]);
    for (const m of [margA, margB]) {
      assert.deepEqual(Array.from(m.re), [0.5, 0, 0, 0.5]);
      assert.ok(m.im.every((v) => v === 0));
    }
    // the joint state itself keeps its off-diagonal — the coherence is real,
    // it just never survives into a marginal (E1's whole point)
    assert.equal(bell.re[3], 0.5);
    // eigensolver: a diagonal Hermitian comes back with its exact spectrum,
    // ascending, no arithmetic — and eigHermitian's internal reconstruction
    // check (1e-8) is itself on trial with every call
    const diag3: CMat = mat(3, 3);
    diag3.re[0] = 0.5;
    diag3.re[4] = 0.25;
    diag3.re[8] = 0.25;
    assert.deepEqual(Array.from(eigenvaluesHermitian(diag3)), [0.25, 0.25, 0.5]);
    assert.deepEqual(Array.from(eigHermitian(diag3).values), [0.25, 0.25, 0.5]);
    // trace distance and fidelity at orthogonal/known pairs
    assert.equal(traceDistance(vecToRho(KET0), vecToRho(KET1)), 1);
    assert.equal(traceDistance(vecToRho(KET0), vecToRho(KET0)), 0);
    assert.ok(Math.abs(fidelity(vecToRho(KET0), vecToRho(PLUS)) - 0.5) < 1e-12);
    assert.ok(Math.abs(fidelity(rho2, rho2) - 1) < 1e-12);
  });

  it("frontier census invariants and the witness roster: lengths structural, endpoints 0 and 1, no dead witness", () => {
    const fw = frontierCertificate();
    for (const census of [fw.esc18, fw.replacer]) {
      assert.equal(census.points.length, GRID_N + 1);
      assert.equal(census.marginal.length, GRID_N);
      assert.equal(fCmp(census.points[0]!.get.lo, F_ZERO), 0);
      assert.equal(fCmp(census.points[GRID_N]!.get.lo, F_ONE), 0);
    }
    // the render's trailing marginal dash is structural, not decorative: 21
    // points price exactly 20 adjacent pairs
    // no dead witness: every roster id is cited by at least one ledger row
    const cited = new Set(EXCHANGE.map((r) => r.witness));
    for (const w of WITNESS_ROSTER) {
      assert.ok(cited.has(w), `witness ${w} is in the roster but no ledger row cites it`);
    }
  });
});
