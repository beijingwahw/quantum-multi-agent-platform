import test from "node:test";
import assert from "node:assert/strict";
import { Rng, auditFilter, feedforwardCheck, runPayload, runSorter } from "../src/kernel/sorter.js";
import { lcgMarked } from "../src/experiments/exp-t1-sorter.js";

test("T1.A certainty-in-branch: t=1 gives exactly |x*> after one query + postselection", () => {
  for (const n of [4, 6, 8, 10, 12, 14]) {
    const xStar = 1234 % 2 ** n;
    const run = runSorter(n, [xStar]);
    assert.ok(Math.abs(run.pFlag - run.pFlagClosedForm) < 1e-15, `n=${n}: P(flag)=t/N`);
    assert.ok(Math.abs(run.fidelityXStar - 1) < 1e-12, `n=${n}: fidelity 1 (got ${run.fidelityXStar})`);
    assert.ok(run.offMarkedLeak === 0, `n=${n}: no amplitude outside the marked set`);
    assert.ok(run.conditionalUniformityDev < 1e-12, `n=${n}: conditional amplitude exactly 1`);
  }
});

test("T1.B the branch is a clean conditional sample: payload readout = integer ratio", () => {
  // single-sourced xorshift32 (kernel Rng) — the known-vector anchor below
  // proves the stream is bit-identical to the pre-v0.3.0 inline copy
  const rand = new Rng(0x2468ace);
  for (const n of [8, 10, 12]) {
    const N = 2 ** n;
    const payload: boolean[] = new Array(N);
    for (let x = 0; x < N; x++) payload[x] = rand.next() < 0.5;
    const t = 37 % N;
    const marked = [...new Set(Array.from({ length: t }, () => Math.floor(rand.next() * N)))];
    const run = runPayload(n, marked, payload);
    assert.ok(run.deviation < 1e-12, `n=${n}: amplitude path = integer referee`);
    assert.ok(run.closedForm >= 0 && run.closedForm <= 1);
    assert.ok(Math.abs(run.pFlag - marked.length / N) < 1e-15);
  }
});

test("T1.C the filter is not a channel: conditioning is branch-weight affine", () => {
  const a = auditFilter();
  assert.ok(Math.abs(a.nonlinearityTraceDistance - 1 / 6) < 1e-12, `trace distance exactly 1/6 (got ${a.nonlinearityTraceDistance})`);
  assert.ok(a.krausTraceDev < 1e-15, "two-Kraus filter preserves the trace");
  assert.ok(a.krausDephaseDev < 1e-15, "two-Kraus filter is the measurement channel (blocks kept, coherences killed)");
  assert.ok(Math.abs(a.singleKrausOnSupport - 1) < 1e-15);
  assert.ok(a.singleKrausDeficit > 0 && a.singleKrausDeficit < 1);
});

test("T1.D physical realization: measure-and-keep reproduces the conditional statistics", () => {
  for (const [n, t, seed, samples] of [
    [6, 11, 101, 40000],
    [8, 37, 202, 60000],
  ] as const) {
    const marked = lcgMarked(n, t, seed);
    const chk = feedforwardCheck(n, marked, seed, samples);
    assert.ok(chk.acceptSigma < 5, `n=${n}: accept rate within 5 sigma (got ${chk.acceptSigma})`);
    assert.ok(chk.worstSigma < 5, `n=${n}: conditional cells within 5 sigma (got ${chk.worstSigma})`);
  }
});

test("T1.E single-source anchor: the kernel Rng IS the xorshift32 stream (v0.3.0 dedup regression)", () => {
  // known vectors of xorshift32 (13, 17, 5), asserted as state/2^32 (exact
  // dyadic rationals) — they match the inline closures this repo used to
  // carry verbatim in exp/test, so the single-sourcing swap is proven
  // bit-identical, not assumed
  const a = new Rng(0x12345678);
  assert.equal(a.next(), 2274908837 / 4294967296);
  assert.equal(a.next(), 358294691 / 4294967296);
  assert.equal(a.next(), 1210119364 / 4294967296);
  const b = new Rng(0x2468ace);
  assert.equal(b.next(), 2969258849 / 4294967296);
  assert.equal(b.next(), 3950506730 / 4294967296);
  assert.equal(b.next(), 2961029023 / 4294967296);
  // zero seed re-keys to the golden ratio constant, never a stuck stream
  const z = new Rng(0);
  assert.ok(z.next() > 0 && z.next() > 0);
  // the LCG marked-set helper: deterministic values at (n=6, t=3, seed=101)
  assert.deepEqual(lcgMarked(6, 3, 101), [58, 0, 0]);
});
