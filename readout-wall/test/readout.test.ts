import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkExchange, runWitnesses } from "../src/kernel/audit.js";
import { EXCHANGE, type ExchangeRow } from "../src/kernel/ledger.js";
import { dephase, partialDephase, readoutSlices } from "../src/kernel/collapse.js";
import { PLUS, vecToRho } from "../src/core/states.js";
import { krausToStinespring, makeSwitchedChannel } from "../src/switch/isometry.js";
import { completelyDepolarizingKraus } from "../src/switch/chanlib.js";
import type { CMat } from "../src/core/cmat.js";
import { fAdd, fSub, fToNumber, fr, iOf, negLn, PATH_A, PATH_T } from "../src/kernel/rational.js";
import {
  certifyAntichain,
  certifyConvexGrid,
  certifyStrictlyDecreasing,
  esc18Certificate,
  esc18Chi,
  familyOk,
  frontierCertificate,
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
