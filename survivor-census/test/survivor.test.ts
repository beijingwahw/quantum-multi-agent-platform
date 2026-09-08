import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { phaseOverlap, realizationCheck, runPriorSorter } from "../src/kernel/survivor.js";
import { buildInstances, p0Probe } from "../src/experiments/instances.js";
import { Rng } from "../src/kernel/survivor.js";
import { TOL } from "../src/kernel/tol.js";

describe("S1 — the survivor is the posterior", () => {
  it("posterior matches the integer-ratio path on every instance (max dev < 1e-12)", () => {
    let maxDev = 0;
    for (const inst of buildInstances()) {
      const run = runPriorSorter(inst.n, inst.counts, inst.marked);
      maxDev = Math.max(maxDev, run.posteriorDev);
    }
    assert.ok(maxDev < TOL, `posterior deviation ${maxDev}`);
  });

  it("zero amplitude outside the funded marked set — exactly, not approximately", () => {
    for (const inst of buildInstances()) {
      const run = runPriorSorter(inst.n, inst.counts, inst.marked);
      assert.equal(run.offMarkedLeak, 0, inst.name);
    }
  });

  it("t=1 degenerates to a point mass — the only honest 'the optimum' regime (T1 cross-anchor)", () => {
    const inst = buildInstances().find((i) => i.name === "t1-fund");
    assert.ok(inst);
    const run = runPriorSorter(inst.n, inst.counts, inst.marked);
    const x = inst.marked[0]!;
    assert.equal(run.tFunded, 1);
    assert.ok(Math.abs(run.posterior[x]! - 1) < TOL);
  });

  it("an unfunded optimum is marked but never comes back (posterior exactly 0 there)", () => {
    const inst = buildInstances().find((i) => i.name === "unfunded-optimum");
    assert.ok(inst);
    const run = runPriorSorter(inst.n, inst.counts, inst.marked);
    assert.equal(run.unfundedOptima.length, 1);
    assert.equal(run.tFunded, run.tRaw - 1);
    assert.equal(run.posterior[run.unfundedOptima[0]!], 0);
  });
});

describe("S2/S4 — the kill register and the grammar failures", () => {
  it("register sums to 1-P on the complement path (max dev < 1e-12); odds identity holds", () => {
    let maxKilled = 0;
    let maxOdds = 0;
    for (const inst of buildInstances()) {
      const run = runPriorSorter(inst.n, inst.counts, inst.marked);
      maxKilled = Math.max(maxKilled, run.killedDev);
      maxOdds = Math.max(maxOdds, Math.abs(run.oddsPerSurvivor - (1 / run.pKeep - 1)));
    }
    assert.ok(maxKilled < TOL, `killed deviation ${maxKilled}`);
    assert.ok(maxOdds < TOL, `odds deviation ${maxOdds}`);
  });

  it("uniform prior degenerates to postselect-sched's flat ground: 1/N per kill, ledger N/t", () => {
    const inst = buildInstances().find((i) => i.name === "uniform-prior");
    assert.ok(inst);
    const run = runPriorSorter(inst.n, inst.counts, inst.marked);
    for (const row of run.killRegister) assert.ok(Math.abs(row.mass - 1 / run.N) < TOL);
    assert.ok(Math.abs(run.pKeep - run.tFunded / run.N) < TOL);
    assert.ok(Math.abs(run.killedTotal - (run.N - run.tFunded) / run.N) < TOL);
  });

  it("P=0 refuses: zero-branch conditioning throws (the existence presupposition, executable)", () => {
    const probe = p0Probe();
    assert.throws(
      () => runPriorSorter(probe.n, probe.counts, probe.marked),
      /undefined/,
    );
  });

  it("P=1: the register is empty — nothing killed, nothing sorted", () => {
    const inst = buildInstances().find((i) => i.name === "full-funding");
    assert.ok(inst);
    const run = runPriorSorter(inst.n, inst.counts, inst.marked);
    assert.equal(run.killRegister.length, 0);
    assert.equal(run.killedTotal, 0);
    assert.ok(Math.abs(run.pKeep - 1) < TOL);
  });
});

describe("the coherence face — phases survive postselection", () => {
  it("survivor overlap under two phase assignments: amplitude path = closed form; self-overlap = 1", () => {
    const inst = buildInstances().find((i) => i.name === "quarter-funded");
    assert.ok(inst);
    const N = 2 ** inst.n;
    const rng = new Rng(307);
    const phiA = Array.from({ length: N }, () => 2 * Math.PI * rng.next());
    const phiB = phiA.map((p, x) => p + (x % 2 === 0 ? Math.PI / 5 : -Math.PI / 7));
    const ph = phaseOverlap(inst.n, inst.counts, inst.marked, phiA, phiB);
    assert.ok(ph.deviation < TOL, `overlap deviation ${ph.deviation}`);
    assert.ok(Math.abs(ph.selfOverlap - 1) < TOL);
    // a classical mixture over branches could not carry this interference:
    // the overlap is genuinely complex
    assert.notEqual(ph.overlapAmplitude.im, 0);
  });
});

describe("realization referee (DATA — never a theorem claim)", () => {
  it("physical draw-from-prior procedure lands inside 5 sigma for waiting and posterior", () => {
    const inst = buildInstances().find((i) => i.name === "quarter-funded");
    assert.ok(inst);
    const mc = realizationCheck(inst.n, inst.counts, inst.marked, 409, 40000);
    assert.ok(mc.waitingSigma < 5, `waiting ${mc.waitingSigma} sigma`);
    assert.ok(mc.worstSurvivorSigma < 5, `survivor ${mc.worstSurvivorSigma} sigma`);
  });
});
