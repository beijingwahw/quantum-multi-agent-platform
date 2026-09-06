import test from "node:test";
import assert from "node:assert/strict";
import {
  binomTailAtMost,
  depreciation,
  exchangeEntry,
  powerLedgerRow,
  randomSat,
  repetitionsFor,
  type PowerLedgerRow,
  type SatInstance,
} from "../src/kernel/ppledger.js";

function scan(seedFrom: number, seedTo: number, pred: (r: PowerLedgerRow) => boolean): { inst: SatInstance; row: PowerLedgerRow } {
  for (let seed = seedFrom; seed <= seedTo; seed++) {
    const inst = randomSat(10, 30, seed);
    const row = powerLedgerRow(inst);
    if (row.m > 0 && pred(row)) return { inst, row };
  }
  throw new Error("scan failed");
}

test("T5.A branch ratio = integer ratio on real 3-SAT; decision = integer referee", () => {
  for (const n of [10, 11, 12]) {
    const row = powerLedgerRow(randomSat(n, Math.floor(3.2 * n), 100 + n));
    assert.ok(row.deviation < 1e-12, `n=${n}: amplitude path = integer referee`);
    assert.ok(row.m > 0);
    if (row.decision === "h-majority") assert.ok(2 * row.both > row.m);
    else if (row.decision === "h-minority") assert.ok(2 * row.both < row.m);
    else assert.equal(2 * row.both, row.m);
    assert.ok(Math.abs(row.singleShotError - (0.5 - row.gap)) < 1e-15);
  }
});

test("T5.B the tie construction: free variable = exact 1/2, no price buys a decision", () => {
  const row = powerLedgerRow(randomSat(10, 24, 7, 0));
  assert.equal(row.decision, "tie");
  assert.equal(row.gap, 0);
  assert.equal(row.singleShotError, 0.5);
  assert.equal(repetitionsFor(0, 0.1), Number.POSITIVE_INFINITY);
  assert.equal(depreciation(row, 0.1), Number.POSITIVE_INFINITY);
});

test("T5.C the exchange law: exact binomial tail <= delta <= Hoeffding schedule", () => {
  const { row } = scan(1, 200, (r) => r.gap >= 0.05);
  let prevK = 0;
  for (const delta of [0.1, 0.01, 0.001]) {
    const e = exchangeEntry(row, delta);
    assert.ok(e.k % 2 === 1, "odd k (no vote ties)");
    assert.ok(e.k >= prevK, "k nondecreasing as delta shrinks");
    prevK = e.k;
    assert.ok(e.tailExact <= delta + 1e-12, `delta=${delta}: exact tail ${e.tailExact} exceeds delta`);
    assert.ok(e.tailExact <= e.hoeffding + 1e-15, `delta=${delta}: exact tail exceeds its own Hoeffding bound`);
    assert.ok(Math.abs(e.queries - e.k * (row.N / row.m)) < 1e-9, "depreciation identity k * N/m");
  }
});

test("T5.D the price spike at the integer-separation floor", () => {
  const near = scan(1, 200, (r) => r.gap > 0 && r.gap <= 1.25 / (2 * r.m));
  assert.ok(near.row.gap >= 1 / (2 * near.row.m) - 1e-12, "gap at the floor");
  const e = exchangeEntry(near.row, 0.1);
  assert.ok(e.tailExact <= 0.1 + 1e-12);
  assert.ok(e.queries > 1e4, "near-tie decisions are expensive");
  // exact binomial machinery sanity against a hand value: Bin(3, 2/3) <= 1 = 7/27
  assert.ok(Math.abs(binomTailAtMost(3, 2 / 3, 1) - 7 / 27) < 1e-15);
});
