import test from "node:test";
import assert from "node:assert/strict";
import { ERROR_CODES, isKernelError, KernelError } from "../src/kernel/errors.js";
import { conditionalDm, feedforwardCheck, runPayload, runSorter } from "../src/kernel/sorter.js";
import { convexDecomposition, firstMarkDist, geometricDist, makeFastRenewal, payExpected, powerLawDist, renewalEarlyStop } from "../src/kernel/restart.js";
import { binomTailAtMost, powerLedgerRow, randomSat, repetitionsFor, type SatInstance } from "../src/kernel/ppledger.js";
import { halfBinomialSum, isqrt, lambdaStarRat, plateauCertificate, quoteDecision, racePoly, rat, isolateSmallestRoot } from "../src/kernel/tieface.js";

/** the smuggling-trial form for illegal inputs: every kernel refusal must be
 *  NAMED (a machine-checkable code), never prose, never a silent wrong
 *  answer, never a hang. */
function rejects(fn: () => unknown, code: string): void {
  assert.throws(fn, (e: unknown) => {
    assert.ok(isKernelError(e), `threw ${String(e)} — not a KernelError`);
    assert.ok(e instanceof Error);
    assert.equal(e.code, code);
    assert.ok(e.message.startsWith(`${code}: `), `message must lead with the code (got ${e.message})`);
    return true;
  });
}

test("ERR.00 the code registry is well-formed: every code unique, SCREAMING-KEBAB", () => {
  assert.ok(ERROR_CODES.length > 30);
  assert.equal(new Set(ERROR_CODES).size, ERROR_CODES.length, "no duplicate codes");
  for (const c of ERROR_CODES) assert.match(c, /^[A-Z0-9]+(-[A-Z0-9]+)*$/);
});

test("ERR.01 runSorter names every illegal input (qubit count, empty/oversized/out-of-range marked)", () => {
  rejects(() => runSorter(0, [1]), "BAD-QUBIT-COUNT");
  rejects(() => runSorter(2.5, [1]), "BAD-QUBIT-COUNT");
  rejects(() => runSorter(3, []), "EMPTY-MARKED-SET");
  rejects(() => runSorter(3, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), "MARKED-EXCEEDS-SPACE");
  // the silent-decoupling conviction: an out-of-range index never matches an
  // address cell, so pFlag (amplitudes) and pFlagClosedForm (t/N) would drift
  // apart without a word — named refusal since v0.3.0
  rejects(() => runSorter(3, [-1]), "MARKED-OUT-OF-RANGE");
  rejects(() => runSorter(3, [8]), "MARKED-OUT-OF-RANGE");
  rejects(() => runSorter(3, [1.5]), "MARKED-OUT-OF-RANGE");
  // negative control: the legal entry still runs
  const ok = runSorter(3, [5]);
  assert.equal(ok.t, 1);
});

test("ERR.02 runPayload names its three refusals", () => {
  rejects(() => runPayload(3, [1], [true, false]), "PAYLOAD-LENGTH");
  rejects(() => runPayload(3, [-1], [true, false, false, true, false, false, false, true]), "MARKED-OUT-OF-RANGE");
  rejects(() => runPayload(3, [], [true, false, false, true, false, false, false, true]), "EMPTY-MARKED-SET");
  const ok = runPayload(3, [1], [false, true, false, false, false, false, false, false]);
  assert.equal(ok.closedForm, 1);
});

test("ERR.03 branch faces: zero-weight conditioning and empty branch are named", () => {
  const zeros = [
    [0, 0],
    [0, 0],
  ];
  rejects(() => conditionalDm(zeros, [0, 0]), "ZERO-BRANCH-WEIGHT");
  // samples = 0 accepts nothing deterministically
  rejects(() => feedforwardCheck(4, [3], 12345, 0), "EMPTY-BRANCH");
  assert.ok(Number.isFinite(feedforwardCheck(4, [3], 12345, 20000).acceptSigma));
});

test("ERR.04 strategy faces: empty schedules, unprecomputed cutoffs, bad round probabilities", () => {
  const p = geometricDist(50, 0.1);
  rejects(() => renewalEarlyStop(p, { prefix: [] }), "EMPTY-PREFIX");
  rejects(() => convexDecomposition(p, { prefix: [] }), "EMPTY-PREFIX");
  const fast = makeFastRenewal(p, [1, 2]);
  rejects(() => fast.T({ prefix: [] }), "EMPTY-PREFIX");
  rejects(() => fast.T({ prefix: [7] }), "CUTOFF-NOT-PRECOMPUTED");
  rejects(() => payExpected([1, 2], [0.5, 0.5], []), "EMPTY-SCHEDULE");
  rejects(() => payExpected([1, 2], [0, 0.5], [0]), "BAD-ROUND-PROBABILITY");
  rejects(() => payExpected([1, 2], [0.5, 1.5], [1]), "BAD-ROUND-PROBABILITY");
  // a cycle whose cutoffs all have zero success mass: R never decays, the
  // 1e6-round guard fires — named, not an infinite loop
  const dead: readonly number[] = [0, 0, 0, 0];
  rejects(() => renewalEarlyStop(dead, { prefix: [1] }), "CYCLE-NEVER-SUCCEEDS");
  assert.ok(fast.T({ prefix: [1] }) > 0);
});

test("ERR.05 distribution generators refuse the all-NaN / all-zero tables", () => {
  rejects(() => geometricDist(50, 0), "BAD-RATE");
  rejects(() => geometricDist(50, 1), "BAD-RATE");
  rejects(() => geometricDist(0, 0.5), "BAD-HORIZON");
  rejects(() => geometricDist(7.5, 0.5), "BAD-HORIZON");
  rejects(() => powerLawDist(0, 2), "BAD-HORIZON");
  rejects(() => firstMarkDist(256, 0), "BAD-MARKED-COUNT");
  rejects(() => firstMarkDist(256, 257), "BAD-MARKED-COUNT");
  // negative controls: the generators still produce honest distributions
  let s = 0;
  for (const v of geometricDist(50, 0.1)) s += v;
  assert.ok(Math.abs(s - 1) < 1e-12);
  let s2 = 0;
  for (const v of firstMarkDist(256, 4)) s2 += v;
  assert.ok(Math.abs(s2 - 1) < 1e-12);
});

test("ERR.06 randomSat hang conviction: fewer than 3 available variables is NAMED, not spun", () => {
  // v0.3.0 latent-defect anchor: randomSat(2, ...) used to loop forever in
  // `while (vars.size < 3)` — this test completing at all is the regression proof
  rejects(() => randomSat(2, 5, 1), "INSUFFICIENT-VARIABLES");
  rejects(() => randomSat(3, 5, 1, 0), "INSUFFICIENT-VARIABLES");
  rejects(() => randomSat(2.5, 5, 1), "BAD-VAR-COUNT");
  rejects(() => randomSat(4, -1, 1), "BAD-CLAUSE-COUNT");
  // negative control: the minimal 3-var instance still builds
  const inst = randomSat(3, 5, 1);
  assert.equal(inst.clauses.length, 5);
});

test("ERR.07 the ledger refuses unsatisfiable instances by name", () => {
  const unsat: SatInstance = { n: 1, clauses: [[1, 1, 1], [-1, -1, -1]] };
  rejects(() => powerLedgerRow(unsat), "UNSATISFIABLE-INSTANCE");
  const ok = powerLedgerRow({ n: 1, clauses: [[1, 1, 1]] });
  assert.equal(ok.m, 1);
});

test("ERR.08 repetitionsFor conviction: delta outside (0,1] refused (was a NEGATIVE k)", () => {
  // v0.3.0 latent-defect anchor: repetitionsFor(0.1, 2) returned -33
  // (Math.ceil of a negative log, parity-bumped) — a silently negative schedule
  rejects(() => repetitionsFor(0.1, 2), "BAD-DELTA");
  rejects(() => repetitionsFor(0.1, 0), "BAD-DELTA");
  rejects(() => repetitionsFor(0.1, -0.5), "BAD-DELTA");
  rejects(() => repetitionsFor(-0.1, 0.1), "BAD-GAP");
  // negative controls: legal deltas give positive odd k; delta = 1 admits k = 1
  assert.equal(repetitionsFor(0.1, 0.1) % 2, 1);
  assert.ok(repetitionsFor(0.1, 0.1) >= 1);
  assert.equal(repetitionsFor(0.1, 1), 1);
  assert.equal(repetitionsFor(0, 0.1), Number.POSITIVE_INFINITY); // exact tie convention intact
});

test("ERR.09 binomTailAtMost conviction: p = 0 refused (was NaN where the tail is exactly 1)", () => {
  // v0.3.0 latent-defect anchor: binomTailAtMost(3, 0, 1) returned NaN via
  // 0 * log(0), while P[Bin(3,0) <= 1] = 1 — a silent wrong answer
  rejects(() => binomTailAtMost(3, 0, 1), "BAD-PROBABILITY");
  rejects(() => binomTailAtMost(3, -0.1, 1), "BAD-PROBABILITY");
  rejects(() => binomTailAtMost(3, 1.5, 1), "BAD-PROBABILITY");
  rejects(() => binomTailAtMost(0, 0.5, 0), "BAD-TRIAL-COUNT");
  rejects(() => binomTailAtMost(3.5, 0.5, 1), "BAD-TRIAL-COUNT");
  rejects(() => binomTailAtMost(3, 0.5, 1.5), "BAD-TAIL-INDEX");
  // negative controls: the hand value and the p = 1 endpoint stay exact
  assert.ok(Math.abs(binomTailAtMost(3, 2 / 3, 1) - 7 / 27) < 1e-15);
  assert.equal(binomTailAtMost(3, 1, 1), 0);
});

test("ERR.10 exact-arithmetic faces: zero denominators, negative roots, even k, empty tables", () => {
  rejects(() => rat(1n, 0n), "ZERO-DENOMINATOR");
  rejects(() => isqrt(-1n), "NEGATIVE-SQRT");
  rejects(() => halfBinomialSum(2), "BAD-ODD-K");
  rejects(() => halfBinomialSum(0), "BAD-ODD-K");
  rejects(() => lambdaStarRat([0n]), "EMPTY-TABLE");
  rejects(() => racePoly(0), "BAD-RACE-ORDER");
  // negative controls
  assert.equal(rat(6n, 4n).den, 2n); // reduced
  assert.equal(isqrt(15n * 15n), 15n);
  assert.equal(halfBinomialSum(3).sum, 4n);
});

test("ERR.11 plateau/root faces: no-tie tables and rational roots are named, never forced", () => {
  rejects(() => plateauCertificate([0n, 3n, 1n]), "NO-EXACT-TIE"); // unique optimum at t=1
  rejects(() => isolateSmallestRoot([1n, -1n]), "ROOT-AT-ENDPOINT"); // s = 1 is a root
  rejects(() => isolateSmallestRoot([1n, 1n]), "NO-SIGN-CHANGE"); // never crosses zero
  rejects(() => isolateSmallestRoot([-1n, 2n]), "ROOT-ON-GRID"); // root exactly at 1/2, on the default grid
  // quoteDecision's invariant: a row whose gap contradicts its own integers
  const honest = powerLedgerRow(randomSat(10, 30, 1));
  const forgedGap = { ...honest, gap: 0 };
  rejects(() => quoteDecision(forgedGap, 0.1), "INCONSISTENT-ROW");
  // negative controls
  const tieTable = [0n, 2n, 1n, 0n, 0n, 1n];
  assert.equal(plateauCertificate(tieTable).strategies, 14);
  assert.ok(racePoly(1).length === 2);
});

test("ERR.12 the error shape itself: KernelError is an Error, guard is narrow", () => {
  const e = new KernelError("BAD-DELTA", "probe");
  assert.ok(e instanceof Error);
  assert.ok(isKernelError(e));
  assert.ok(!isKernelError(new Error("plain")));
  assert.ok(!isKernelError("string"));
  assert.ok(!isKernelError(null));
  assert.equal(e.message, "BAD-DELTA: probe");
  assert.equal(e.name, "KernelError");
});
