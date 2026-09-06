import test from "node:test";
import assert from "node:assert/strict";
import { auditFilter, feedforwardCheck, runPayload, runSorter } from "../src/kernel/sorter.js";

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
  let seedState = 0x2468ace;
  const rand = (): number => {
    seedState ^= seedState << 13;
    seedState >>>= 0;
    seedState ^= seedState >>> 17;
    seedState ^= seedState << 5;
    seedState >>>= 0;
    return seedState / 4294967296;
  };
  for (const n of [8, 10, 12]) {
    const N = 2 ** n;
    const payload: boolean[] = new Array(N);
    for (let x = 0; x < N; x++) payload[x] = rand() < 0.5;
    const t = 37 % N;
    const marked = [...new Set(Array.from({ length: t }, () => Math.floor(rand() * N)))];
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
    const marked: number[] = [];
    let s = seed;
    for (let i = 0; i < t; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      marked.push(s % 2 ** n);
    }
    const chk = feedforwardCheck(n, marked, seed, samples);
    assert.ok(chk.acceptSigma < 5, `n=${n}: accept rate within 5 sigma (got ${chk.acceptSigma})`);
    assert.ok(chk.worstSigma < 5, `n=${n}: conditional cells within 5 sigma (got ${chk.worstSigma})`);
  }
});
