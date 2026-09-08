import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runPhaseCensus } from "../src/kernel/phasecensus.js";
import { randomCounts } from "../src/experiments/instances.js";

const TOL = 1e-12;

function quarterInstance(): { n: number; counts: number[]; marked: number[] } {
  const n = 4;
  const counts = randomCounts(n, 201);
  const marked: number[] = [];
  for (let x = 0; x < 2 ** n; x += 4) marked.push(x);
  return { n, counts, marked };
}

describe("S7 — the phase-encoding census: the ledger is phase-blind", () => {
  it("P, the itemized kill register, and E[T] are invariant across every encoding family — deviation exactly 0", () => {
    const { n, counts, marked } = quarterInstance();
    const census = runPhaseCensus(n, counts, marked);
    assert.ok(census.rows.length >= 7, "family census must be non-trivial");
    for (const row of census.rows) {
      assert.equal(row.pDev, 0, row.family);
      assert.equal(row.registerDev, 0, row.family);
      assert.equal(row.waitingDev, 0, row.family);
    }
    assert.equal(census.ledgerPhaseBlindnessDev, 0);
  });

  it("the dephased reading is the posterior under EVERY encoding (standard two-path float dev < 1e-12)", () => {
    const { n, counts, marked } = quarterInstance();
    const census = runPhaseCensus(n, counts, marked);
    assert.ok(census.dephasedReadingMaxDev < TOL, `${census.dephasedReadingMaxDev}`);
  });
});

describe("S7 — the state is phase-carrying: the coherence law", () => {
  it("every family's survivor is one pure state: self-overlap 1 (max dev < 1e-12)", () => {
    const { n, counts, marked } = quarterInstance();
    const census = runPhaseCensus(n, counts, marked);
    assert.ok(census.selfOverlapMaxDev < TOL, `${census.selfOverlapMaxDev}`);
  });

  it("equality case: a constant phase difference on the funded set gives |overlap| = 1 exactly", () => {
    const { n, counts, marked } = quarterInstance();
    const census = runPhaseCensus(n, counts, marked);
    assert.ok(census.equalityCaseDev < TOL, `${census.equalityCaseDev}`);
    // the sign-alternating encoding is constant on this all-even marked set —
    // the machine detects the accidental equality case per instance
    const signAlt = census.rows.find((r) => r.family === "sign-alt");
    assert.ok(signAlt);
    assert.ok(signAlt.constantDifferenceOnFunded);
    assert.ok(Math.abs(signAlt.visibilityFlat - 1) < TOL);
  });

  it("the Fourier ramp's overlap with flat matches the closed form (two-path)", () => {
    const { n, counts, marked } = quarterInstance();
    const census = runPhaseCensus(n, counts, marked);
    const b1 = census.rows.find((r) => r.family === "fourier-b1");
    assert.ok(b1);
    // overlapFlat is <family|flat> = sum w_x e^{-i phi_x} / P; on the funded
    // quarter the b=1 ramp phases are 1, i, -1, -i, so the sum is
    // (w0 - w8)/P + i(w12 - w4)/P
    const totalC = counts.reduce((a, b) => a + b, 0);
    const w0 = counts[marked[0] as number] as number;
    const w4 = counts[marked[1] as number] as number;
    const w8 = counts[marked[2] as number] as number;
    const w12 = counts[marked[3] as number] as number;
    const re = w0 / totalC / b1.pKeep - w8 / totalC / b1.pKeep;
    const im = w12 / totalC / b1.pKeep - w4 / totalC / b1.pKeep;
    const closedForm = Math.hypot(re, im);
    assert.ok(Math.abs(b1.visibilityFlat - closedForm) < TOL, `${b1.visibilityFlat} vs ${closedForm}`);
    assert.ok(Math.abs(b1.overlapFlat.re - re) < TOL, `re ${b1.overlapFlat.re} vs ${re}`);
    assert.ok(Math.abs(b1.overlapFlat.im - im) < TOL, `im ${b1.overlapFlat.im} vs ${im}`);
  });

  it("strictness: every non-constant family sits strictly below 1; the census law holds", () => {
    const { n, counts, marked } = quarterInstance();
    const census = runPhaseCensus(n, counts, marked);
    assert.ok(census.strictMargin > 1e-9, `strictness margin ${census.strictMargin}`);
    for (const row of census.rows) {
      if (row.family === "flat") continue;
      if (row.constantDifferenceOnFunded) continue;
      assert.ok(row.visibilityFlat < 1 - 1e-9, `${row.family}: ${row.visibilityFlat}`);
    }
    assert.ok(census.coherenceLawHolds);
  });
});
