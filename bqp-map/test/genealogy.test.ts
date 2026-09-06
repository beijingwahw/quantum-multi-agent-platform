import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../src/core/rng.js";
import { postselectCount, postselectSearch } from "../src/genealogy/postselect.js";
import { reduced, singlet, singletAnchors, nosignalTrial } from "../src/genealogy/nosignal.js";
import { GENEALOGY_CLAIMS, orphanGenealogyRows, unresolvedRows } from "../src/genealogy/register.js";

describe("genealogy: postselection ledger", () => {
  it("P_success = t/N exactly and the conditional readout is deterministic at t=1", () => {
    const r = postselectSearch(8, [77, 200, 255]);
    assert.ok(Math.abs(r.pSuccess - 3 / 256) <= 1e-15);
    assert.ok(Math.abs(r.pSuccess - r.pSuccessClosedForm) <= 1e-15);
    const r1 = postselectSearch(10, [371]);
    assert.ok(Math.abs(r1.conditionalFidelity - 1) <= 1e-12, `fidelity ${r1.conditionalFidelity}`);
    assert.ok(Math.abs(r1.pSuccess - 1 / 1024) <= 1e-15);
  });

  it("the ledger never beats Grover-with-restart at the certain-answer standard", () => {
    for (const [n, t] of [
      [4, 1],
      [6, 3],
      [8, 1],
      [10, 7],
      [12, 1],
    ] as const) {
      const rng = new Rng(1000 + n);
      const N = 2 ** n;
      const marked: number[] = [];
      const seen = new Set<number>();
      while (marked.length < t) {
        const x = rng.int(N);
        if (!seen.has(x)) {
          seen.add(x);
          marked.push(x);
        }
      }
      const r = postselectSearch(n, marked);
      assert.ok(r.expectedRepetitions + 1e-9 >= r.groverRestartQueries, `n=${n} t=${t}: ledger < E*`);
      assert.ok(Math.abs(r.expectedRepetitions - N / t) <= 1e-9);
    }
  });

  it("postselected branch reads conditional counting ratios against an independent integer referee", () => {
    const rng = new Rng(42);
    const N = 256;
    const g: boolean[] = [];
    const h: boolean[] = [];
    for (let x = 0; x < N; x++) {
      g.push(rng.bernoulli(0.4));
      h.push(rng.bernoulli(0.5));
    }
    const r = postselectCount(8, g, h);
    let cntG = 0;
    let cntGH = 0;
    for (let x = 0; x < N; x++) {
      if (!g[x]) continue;
      cntG++;
      if (h[x]) cntGH++;
    }
    assert.ok(Math.abs(r.pSuccess - cntG / N) <= 1e-12);
    assert.ok(Math.abs(r.conditionalRatio - cntGH / cntG) <= 1e-12);
    assert.ok(r.deviation <= 1e-12);
  });
});

describe("genealogy: no-signaling withdrawal clause", () => {
  it("B marginals are invariant under arbitrary local unitary and CPTP maps", () => {
    const rng = new Rng(20260905);
    for (let t = 0; t < 6; t++) {
      const r = nosignalTrial(rng);
      assert.ok(r.marginalUnitary <= 1e-12, `trial ${t}: unitary marginal ${r.marginalUnitary}`);
      assert.ok(r.marginalCptp <= 1e-12, `trial ${t}: cptp marginal ${r.marginalCptp}`);
      assert.ok(r.jointUnitary > 0.05 && r.jointCptp > 0.05, `trial ${t}: vacuous (joint ${r.jointUnitary}/${r.jointCptp})`);
    }
  });

  it("singlet: marginals I/2 under projective measurement, correlations -a.b, CHSH 2sqrt(2)", () => {
    const rng = new Rng(7);
    const sa = singletAnchors(rng, 12);
    assert.ok(sa.marginalMaxDev <= 1e-15, `marginal ${sa.marginalMaxDev}`);
    assert.ok(sa.correlationMaxErr <= 1e-15, `correlation ${sa.correlationMaxErr}`);
    assert.ok(sa.chshErr <= 1e-12, `chsh err ${sa.chshErr}`);
  });

  it("reduced() stride regression guard: singlet B marginal is exactly I/2", () => {
    const rhoB = reduced(singlet(), 2, [1]);
    // 2e-16, not 1e-16: (1/sqrt(2))^2 rounds to 0.5000000000000001 — pin the
    // tolerance at the float boundary, not below it
    assert.ok(Math.abs((rhoB.re[0]![0] as number) - 0.5) <= 2e-16);
    assert.ok(Math.abs((rhoB.re[1]![1] as number) - 0.5) <= 2e-16);
    assert.ok(Math.abs((rhoB.re[0]![1] as number)) <= 2e-16);
    assert.ok(Math.abs((rhoB.re[1]![0] as number)) <= 2e-16);
  });
});

describe("genealogy: the letter's claim register", () => {
  it("every claim maps to an existing atlas row — no claim unenrolled", () => {
    assert.deepEqual(unresolvedRows(), []);
  });

  it("the letter decomposes into exactly 17 atomic claims with the auditable epoch split", () => {
    assert.equal(GENEALOGY_CLAIMS.length, 17);
    const byEpoch = new Map<string, number>();
    for (const c of GENEALOGY_CLAIMS) byEpoch.set(c.epoch, (byEpoch.get(c.epoch) ?? 0) + 1);
    assert.equal(byEpoch.get("1"), 4);
    assert.equal(byEpoch.get("2"), 2);
    assert.equal(byEpoch.get("3"), 2);
    assert.equal(byEpoch.get("4"), 5);
    assert.equal(byEpoch.get("5"), 3);
    assert.equal(byEpoch.get("conduct"), 1);
  });

  it("orphans are audit-added only — currently exactly quantum-binding, with cause", () => {
    const orphans = orphanGenealogyRows();
    assert.deepEqual(orphans, ["quantum-binding"]);
  });
});
