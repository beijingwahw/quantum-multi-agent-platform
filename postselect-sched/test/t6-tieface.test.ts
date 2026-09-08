import test from "node:test";
import assert from "node:assert/strict";
import {
  adjudicateDigits,
  adjudicatePlateau,
  adjudicateQuote,
  c1BracketFromSqrt2,
  c2BracketFromClosedForm,
  certifiedDigits,
  constraintPoly,
  groverTieScan,
  halfBinomialSum,
  halfTieTailFloat,
  isolateSmallestRoot,
  lambdaRat,
  lambdaStarRat,
  plateauCertificate,
  ppTieCensus,
  quoteDecision,
  racePoly,
  rat,
  ratCmp,
  ratToNumber,
  tableTotal,
  tieCensusFirstTwo,
  tiedMenuPlateau,
  type LedgerQuote,
} from "../src/kernel/tieface.js";
import { powerLedgerRow, randomSat, repetitionsFor, type PowerLedgerRow } from "../src/kernel/ppledger.js";
import { zeroOptimal } from "../src/kernel/restart.js";

test("T6.A the refusal is typed: declined on exact ties, quoted with odd k otherwise", () => {
  const tieRow = powerLedgerRow(randomSat(10, 24, 7, 0));
  const q = quoteDecision(tieRow, 0.1);
  assert.equal(q.status, "declined");
  if (q.status === "declined") {
    assert.equal(q.reason, "EXACT-TIE");
    assert.equal(q.gap, 0);
    assert.ok(q.detail.includes("no finite k"));
  }
  const okRow = powerLedgerRow(randomSat(10, 30, 1));
  for (const delta of [0.1, 0.01]) {
    const r = quoteDecision(okRow, delta);
    assert.equal(r.status, "quoted");
    if (r.status === "quoted") {
      assert.ok(r.k % 2 === 1, "odd k");
      assert.equal(r.k, repetitionsFor(okRow.gap, delta));
      assert.ok(Math.abs(r.queries - r.k * (okRow.N / okRow.m)) < 1e-9);
      assert.ok(r.tailExact <= delta + 1e-12, "quoted schedule meets delta");
    }
  }
});

test("T6.B the tie plateau: integer path half-sum = 2^(k-1) exactly, float tail = 1/2", () => {
  for (const k of [1, 3, 5, 21, 101, 999]) {
    const h = halfBinomialSum(k);
    assert.ok(h.sum === h.half, `k=${k}: half binomial sum equals 2^(k-1) exactly`);
    assert.ok(Math.abs(halfTieTailFloat(k) - 0.5) < 1e-11, `k=${k}: float tail is 1/2`);
  }
  assert.equal(repetitionsFor(0, 0.1), Number.POSITIVE_INFINITY);
});

test("T6.C the census: free variable ties ALWAYS (involution), random ties are exact-integer events", () => {
  const c = ppTieCensus(300, 10, 30, 0);
  assert.ok(c.freeVarTie, "free-variable family: model set closed under x_0 XOR 1, both = m/2");
  assert.ok(c.tieMs.every((m) => m % 2 === 0), "2*both = m forces even m");
  assert.ok(c.tiesAllEvenM);
  // every reported tie re-verifies through the full ledger row machinery
  for (let seed = 1, found = 0; seed <= 300 && found < c.tieCount; seed++) {
    const row = powerLedgerRow(randomSat(10, 30, seed));
    if (2 * row.both === row.m) {
      found++;
      assert.equal(row.decision, "tie");
      assert.equal(row.gap, 0);
    }
  }
});

test("T6.D the restart-menu census: exact tie iff d | a1^2, both directions, exact rationals", () => {
  const rc = tieCensusFirstTwo(64);
  assert.ok(rc.characterizationHolds, "every divisible pair ties exactly");
  assert.ok(rc.nonSolutionsDiffer, "no non-divisible pair ties for ANY integer second atom");
  assert.ok(rc.entries.length > 0);
  const first = rc.entries[0] as { d: number; a1: number; a2: number };
  assert.equal(first.d, 4);
  assert.equal(first.a1, 2);
  assert.equal(first.a2, 1);
  // the (4,2,1) census row ties exactly: lambda(1) = lambda(2) = 2
  const table = [0n, 2n, 1n, 1n]; // remainder atom at t=3, total d=4
  assert.equal(ratToNumber(lambdaRat(table, 1) as { num: bigint; den: bigint }), 2);
  assert.equal(ratCmp(lambdaRat(table, 1)!, lambdaRat(table, 2)!), 0);
});

test("T6.E the degenerate plateau: tied optimum = full simplex, both cost models", () => {
  const table = [0n, 2n, 1n, 0n, 0n, 1n];
  assert.equal(tableTotal(table), 4n);
  const star = lambdaStarRat(table);
  assert.deepEqual([...star.optima], [1, 2], "exactly two optimal cutoffs");
  assert.equal(`${star.value.num}/${star.value.den}`, "2/1");
  const pc = plateauCertificate(table);
  assert.equal(pc.strategies, 14);
  assert.ok(pc.worstDev < 1e-12, "every cyclic schedule over the tied set attains lambda*");
  assert.ok(pc.mixingStrict, "mixing a cutoff outside the tied set strictly costs");
  // always-pay plateau: rounds (1,1/3), (2,2/3) — c/p tied at 3, alternation costs exactly 3
  const tm = tiedMenuPlateau(1, 2, rat(1n, 3n), rat(2n, 3n));
  assert.ok(tm.ratiosEqual);
  assert.equal(tm.L, "3/1");
  assert.equal(tm.texact, "3/1");
  assert.ok(tm.dev < 1e-12, "float renewal path agrees");
});

test("T6.F the Grover race never ties at integer points ((3N-4t)^2 = 2N^2 has no solutions)", () => {
  for (const N of [256, 1024, 4096]) {
    const g = groverTieScan(N);
    assert.equal(g.checked, N);
    assert.equal(g.ties, 0, `N=${N}: no t satisfies the tie equation`);
  }
});

test("T6.G the tie constants: exact polynomials, two certified paths for c_1 and c_2, monotone in k", () => {
  // P_k coefficients are the sin((2k+1)theta)/sin(theta) polynomials in s = sin^2(theta)
  assert.deepEqual([...racePoly(1)], [3n, -4n]);
  assert.deepEqual([...racePoly(2)], [5n, -20n, 16n]);
  assert.deepEqual([...racePoly(3)], [7n, -56n, 112n, -64n]);
  assert.deepEqual([...constraintPoly(1)], [7n, -24n, 16n]); // (3-4s)^2 - 2
  // c_1 on two independent exact paths, 40 certified digits
  const bisect1 = isolateSmallestRoot(constraintPoly(1));
  const isqrt1 = c1BracketFromSqrt2(50);
  const d1 = certifiedDigits(bisect1, 40);
  const d1b = certifiedDigits(isqrt1, 40);
  assert.ok(d1.length >= 39, `c_1 certified to >= 39 digits (got ${d1.length - 2})`);
  assert.equal(d1.slice(0, Math.min(d1.length, d1b.length)), d1b.slice(0, Math.min(d1.length, d1b.length)));
  assert.ok(d1.startsWith("0.3964466094067262"));
  // c_2 likewise: bisection of Q_2 vs nested isqrt closed form
  const bisect2 = isolateSmallestRoot(constraintPoly(2));
  const closed2 = c2BracketFromClosedForm(48);
  const d2 = certifiedDigits(bisect2, 40);
  const d2b = certifiedDigits(closed2, 40);
  assert.ok(d2.startsWith("0.1932846128"));
  assert.equal(d2.slice(0, Math.min(d2.length, d2b.length)), d2b.slice(0, Math.min(d2.length, d2b.length)));
  // monotone census on certified brackets: c_1 > c_2 > ... > c_6, so k=1 binds
  let prevHi = Number.POSITIVE_INFINITY;
  for (let k = 1; k <= 6; k++) {
    const br = isolateSmallestRoot(constraintPoly(k));
    assert.ok(ratCmp(br.lo, br.hi) < 0);
    const lo = ratToNumber(br.lo);
    assert.ok(lo < prevHi, `c_${k} below c_${k - 1} on certified brackets`);
    prevHi = ratToNumber(br.hi);
  }
  // finite-N thresholds stay above the certified c_1
  const c1Hi = ratToNumber(c1BracketFromSqrt2(50).hi);
  for (const N of [256, 1024]) {
    let lastFalse = 0;
    for (let t = 1; t <= N; t++) if (!zeroOptimal(N, t)) lastFalse = t;
    assert.ok((lastFalse + 1) / N > c1Hi, `N=${N}: threshold density above certified c_1`);
  }
});

test("T6.H smuggling trial — TIE-QUOTE: a fabricated quote at an exact tie is named and rejected", () => {
  const row = powerLedgerRow(randomSat(10, 24, 7, 0)); // the exact-tie row (m=92, both=46)
  assert.equal(2 * row.both, row.m);
  // the forgery: overprint the row as decidable and quote a plausible k at it
  const forged: LedgerQuote = { status: "quoted", delta: 0.1, k: 167, tailExact: 0.0149, hoeffding: 0.0983, queries: 14250.7 };
  const v = adjudicateQuote(row, forged);
  assert.equal(v.ok, false);
  assert.equal(v.law, "TIE-QUOTE");
  assert.ok(v.message.includes("exact tie"));
  // the honest ledger's own output on the same row adjudicates clean
  const honest = adjudicateQuote(row, quoteDecision(row, 0.1));
  assert.equal(honest.ok, true);
});

test("T6.I smuggling trial — PLATEAU-FORGE: a counterfeit exact-tie plateau claim is named and rejected", () => {
  // genuine: (2,1,0,0,1)/4 — cutoffs {1,2} tie exactly at lambda* = 2
  const genuine = [0n, 2n, 1n, 0n, 0n, 1n];
  assert.equal(adjudicatePlateau(genuine, [1, 2]).ok, true);
  // counterfeit 1: perturb the table — the lambdas separate (100/51 vs 197/75...)
  const counterfeit = [0n, 51n, 24n, 0n, 0n, 25n]; // total 100; lambda(1)=100/51, lambda(2)=197/75
  const v1 = adjudicatePlateau(counterfeit, [1, 2]);
  assert.equal(v1.ok, false);
  assert.equal(v1.law, "PLATEAU-FORGE");
  assert.ok(v1.message.includes("UNIQUE") || v1.message.includes("not"));
  // counterfeit 2: a table where cutoffs 1,2 DO tie but NOT at the optimum
  // (1/2, 1/4, 1/4): lambda(1)=lambda(2)=2 but lambda(3)=7/4 is strictly better
  const tiedButSub = [0n, 2n, 1n, 1n];
  const v2 = adjudicatePlateau(tiedButSub, [1, 2]);
  assert.equal(v2.ok, false);
  assert.equal(v2.law, "PLATEAU-FORGE");
  assert.ok(v2.message.includes("UNIQUE"), "the true optimum is unique at t=3 — the tie is sub-dominant");
});

test("T6.J smuggling trial — DIGITS-FORGE: fabricated c_1 digits are named and rejected", () => {
  const br = c1BracketFromSqrt2(50);
  const real = certifiedDigits(br, 40);
  const good = adjudicateDigits(real, br);
  assert.equal(good.ok, true);
  const forged = adjudicateDigits("0.39644660940672619876", br); // right start, fabricated tail
  assert.equal(forged.ok, false);
  assert.equal(forged.law, "DIGITS-FORGE");
  assert.ok(forged.message.includes("certified"));
  // a rounded truncation must ALSO be rejected — only the certified string passes
  const truncated = adjudicateDigits(real.slice(0, 10), br);
  assert.equal(truncated.ok, false);
  assert.equal(truncated.law, "DIGITS-FORGE");
});

test("T6.K the ledger's own quotes adjudicate clean across the instance scan", () => {
  for (const seed of [1, 2, 3, 111, 112]) {
    const row: PowerLedgerRow = powerLedgerRow(randomSat(10, 30, seed));
    for (const delta of [0.1, 0.01]) {
      const v = adjudicateQuote(row, quoteDecision(row, delta));
      assert.equal(v.ok, true, `seed=${seed}, delta=${delta}: ${v.message}`);
    }
  }
});
