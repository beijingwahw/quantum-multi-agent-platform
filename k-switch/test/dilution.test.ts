import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cyclingFamilyTable,
  cyclingWrites,
  dilutionClosedForm,
  dilutionExecutor,
  trichotomyCell,
  trichotomyGrid,
  verifyDilutionClaim,
  verifyPlaneFamily,
  type PlaneWrite,
} from "../src/kswitch/dilution.js";
import { plusPlus, unitaryOnRho } from "../src/kswitch/sched3.js";
import { X2, Y2, Z2 } from "../src/kswitch/promise.js";

describe("T8 the dilution family law D_k (G6-b, v0.6.0)", () => {
  it("(DL-a) k=4 decomposition: gamma=0 branches all one ray, gamma=1 branches exactly the two diagonal states, census 16/8", () => {
    const ex = dilutionExecutor(["X", "Z", "Y"]);
    assert.ok(ex.gamma0Dispersion < 1e-12, `dispersion ${ex.gamma0Dispersion}`);
    assert.equal(ex.gamma1Distinct, 2);
    assert.deepEqual([...ex.counts], [16, 8]);
    const cf = dilutionClosedForm(["X", "Z", "Y"]);
    assert.equal(cf.N1, 8n);
    assert.equal(cf.kFact, 24n);
  });

  it("(DL-b) closed form == executor on every family k = 2..5 (1e-12)", () => {
    const families: ReadonlyArray<readonly PlaneWrite[]> = [
      ["X"],
      ["X", "Z"],
      ["X", "Z", "Y"],
      ["X", "Z", "Y", "X"],
      ["X", "Z", "Y", "Z"],
    ];
    for (const w of families) {
      const cf = dilutionClosedForm(w);
      const ex = dilutionExecutor(w);
      assert.ok(
        Math.abs(cf.dFloat - ex.switchD) < 1e-12,
        `[${w.join(",")}]: closed ${cf.dFloat} exec ${ex.switchD}`,
      );
      assert.equal(BigInt(ex.counts[1]), cf.N1, `[${w.join(",")}] census`);
    }
  });

  it("(DL-b) anchors: k=2 and k=3 give exactly 1/2; k=4 gives exactly sqrt(10)/6 (the v0.2.0 census value, derived)", () => {
    const d2 = dilutionClosedForm(["X"]);
    const d3 = dilutionClosedForm(["X", "Z"]);
    const d4 = dilutionClosedForm(["X", "Z", "Y"]);
    assert.equal(d2.dFloat, 0.5);
    assert.equal(d3.dFloat, 0.5);
    // D^2 = 10/36 exactly in BigInt: dSqNum/dSqDen reduces to 10/36
    assert.equal(d4.dSqNum * 36n, 10n * d4.dSqDen);
    assert.ok(Math.abs(d4.dFloat - Math.sqrt(10) / 6) < 1e-15);
    // the k=4 dilution ratio is sqrt(5)/3, the README's constant
    assert.ok(Math.abs(d4.dFloat * Math.SQRT2 - Math.sqrt(5) / 3) < 1e-15);
  });

  it("(DL-c) the trichotomy is exact on the swept F x K grid (K cancels, F decides)", () => {
    const rows = trichotomyGrid(7, 6);
    assert.equal(rows.length, 55);
    for (const r of rows) {
      assert.equal(
        r.agrees,
        true,
        `F=${r.F} K=${r.K}: sum ${r.qNum}/${r.qDen} vs law ${r.lawNum}/${r.lawDen}`,
      );
    }
    // spot identities: F=0 -> 0; F odd -> 1/2; F=2 -> 1/3; F=4 -> 2/5; F=6 -> 3/7
    assert.equal(trichotomyCell(0, 4).lawNum, 0n);
    assert.deepEqual(
      [trichotomyCell(1, 0).lawNum, trichotomyCell(5, 2).lawNum],
      [1n, 1n],
    );
    assert.deepEqual(
      [trichotomyCell(5, 2).lawNum, trichotomyCell(5, 2).lawDen],
      [1n, 2n],
    );
    assert.deepEqual(
      [trichotomyCell(2, 3).lawNum, trichotomyCell(2, 3).lawDen],
      [1n, 3n],
    );
    assert.deepEqual(
      [trichotomyCell(4, 1).lawNum, trichotomyCell(4, 1).lawDen],
      [2n, 5n],
    );
    assert.deepEqual(
      [trichotomyCell(6, 0).lawNum, trichotomyCell(6, 0).lawDen],
      [3n, 7n],
    );
  });

  it("(DL-c) F odd => q = 1/2 exactly: the halving law D = D_fixed/sqrt(2) holds for every odd-flipper family", () => {
    for (const w of [
      ["X"],
      ["X", "Z"],
      ["Y"],
      ["X", "Z", "Y", "X"],
      ["X", "X", "X"],
      ["Y", "Z", "Z"],
      ["X", "Y", "X", "Y", "X"],
    ] as const) {
      const cf = dilutionClosedForm(w);
      assert.equal(cf.law, "halving", `[${w.join(",")}]`);
      assert.equal(2n * cf.N1, cf.kFact, `[${w.join(",")}] N1 = k!/2`);
      assert.equal(cf.dFloat, 0.5);
    }
  });

  it("(DL-d) the fixed-order wall: every one of the k! orders carries D = 1/sqrt(2) exactly, k = 2..5", () => {
    for (const w of [
      ["X"],
      ["X", "Z"],
      ["X", "Z", "Y"],
      ["X", "Z", "Y", "X"],
      ["X", "Z", "Y", "Z"],
    ] as const) {
      const ex = dilutionExecutor(w);
      assert.equal(ex.fixedWallDev, 0, `[${w.join(",")}] max wall deviation`);
      // strict separation: D(switch) < D(fixed) whenever a flipper exists
      const cf = dilutionClosedForm(w);
      if (cf.F >= 1)
        assert.ok(
          ex.switchD < 1 / Math.SQRT2 - 1e-9,
          `[${w.join(",")}] switch must undercut the wall`,
        );
    }
  });

  it("(DL-c) F = 0 quantified: an all-keeper family pins q = 0 and the switch gains NOTHING (D = the wall 1/sqrt(2))", () => {
    const cf = dilutionClosedForm(["Z", "Z"]);
    assert.equal(cf.N1, 0n);
    assert.equal(cf.law, "no-flippers");
    assert.ok(Math.abs(cf.dFloat - 1 / Math.SQRT2) < 1e-15);
    const ex = dilutionExecutor(["Z", "Z"]);
    assert.ok(Math.abs(ex.switchD - 1 / Math.SQRT2) < 1e-12);
  });

  it("the cycling family table: k=2..9 closed form; k=5 returns to the halving law, k=7 breaks at sqrt(26)/10", () => {
    const table = cyclingFamilyTable(9);
    assert.deepEqual(cyclingWrites(5), ["X", "Z", "Y", "X"]);
    const byK = new Map(table.map((r) => [r.k, r]));
    assert.equal(byK.get(4)!.law, "even-flippers");
    assert.equal(byK.get(5)!.law, "halving");
    assert.equal(byK.get(7)!.law, "even-flippers");
    // m = 2 member: D = sqrt(26)/10 exactly
    const d7 = dilutionClosedForm(cyclingWrites(7));
    assert.equal(d7.dSqNum * 100n, 26n * d7.dSqDen);
    // the k=6 row: F=3 odd -> halving
    assert.equal(byK.get(6)!.law, "halving");
  });

  it("SMUGGLING TRIAL: the halving-law counterfeit at k=4 is NAMED (claims 1/2 where the machine says sqrt(10)/6)", () => {
    const verdict = verifyDilutionClaim({
      writes: ["X", "Z", "Y"],
      claimedD: 0.5,
    });
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /DILUTION-COUNTERFEIT/);
    assert.match(verdict.reason, /F = 2/);
    // the honest claim passes with the law named
    const honest = verifyDilutionClaim({
      writes: ["X", "Z", "Y"],
      claimedD: Math.sqrt(10) / 6,
    });
    assert.ok(honest.ok);
    assert.match(honest.reason, /even-flippers/);
  });

  it("SMUGGLING TRIAL: the swapped-mixture counterfeit (q = 2/3 at k=4) is NAMED", () => {
    // q = 2/3 would give D = sqrt(1/4 + 1/36) — same as sqrt(10)/6 by the
    // (q-1/2)^2 symmetry! The DIRECT kill is the census: N1 = 8, not 16.
    const cf = dilutionClosedForm(["X", "Z", "Y"]);
    assert.equal(cf.N1, 8n);
    assert.equal(cf.kFact - cf.N1, 16n);
    // a claimed D built from the swapped census: q=2/3 lands the same D, so
    // the counterfeit is convicted on the CENSUS, not the constant — asserted
    // by the family verifier below with a doctored execution
    const ex = dilutionExecutor(["X", "Z", "Y"]);
    const verdict = verifyPlaneFamily(
      { writes: ["X", "Z", "Y"], claim: "plane-family" },
      {
        ...ex,
        counts: [8, 16], // the smuggler's swap
      },
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /FAMILY-COUNTERFEIT/);
    assert.match(verdict.reason, /census/);
  });

  it("SMUGGLING TRIAL: an off-family write (Hadamard swapped into ONE box) is caught by the STRUCTURE — gamma=0 dispersion and wall break, NAMED", () => {
    const h = {
      dim: 2,
      re: [
        [Math.SQRT1_2, Math.SQRT1_2],
        [Math.SQRT1_2, -Math.SQRT1_2],
      ],
      im: [
        [0, 0],
        [0, 0],
      ],
    };
    // the replaceWrite hook swaps box 0 for H — the family premises (single
    // gamma=0 ray, fixed-order wall) must die by name. (Replacing EVERY write
    // would cancel itself — H.H = I — and hide the crime; one box suffices.)
    const ex = dilutionExecutor(["X", "Z"], { index: 0, matrix: h });
    assert.ok(
      ex.gamma0Dispersion > 1e-6,
      `the gamma=0 branches must disperse (got ${ex.gamma0Dispersion})`,
    );
    assert.ok(
      ex.fixedWallDev > 1e-6,
      `the fixed orders must leave the wall (got ${ex.fixedWallDev})`,
    );
    const verdict = verifyPlaneFamily(
      { writes: ["X", "Z"], claim: "plane-family" },
      ex,
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /FAMILY-COUNTERFEIT/);
    assert.match(verdict.reason, /plane/);
  });

  it("entry guards: k out of domain and off-family writes are NAMED (no silent values)", () => {
    assert.throws(() => cyclingWrites(1), /\[DILUTION-K-OUT-OF-DOMAIN\]/);
    assert.throws(() => cyclingWrites(13), /\[DILUTION-K-OUT-OF-DOMAIN\]/);
    assert.throws(
      () => dilutionExecutor(new Array(7).fill("X")),
      /\[DILUTION-K-OUT-OF-DOMAIN\]/,
    );
    assert.throws(() => dilutionClosedForm([]), /\[DILUTION-K-OUT-OF-DOMAIN\]/);
    assert.throws(
      () => trichotomyCell(-1, 2),
      /\[DILUTION-CENSUS-OUT-OF-DOMAIN\]/,
    );
  });

  it("the gamma=0 ray parity: k=4's single ray is |+> (two exchangers), recorded against the theory.md prose", () => {
    // exchangers {Z, Y} = 2 (even) -> |+><+|; the k=3 family has one (Z) -> |-><-|
    // (theory.md §6 narrates |-><-| at k=4 — a ray-convention slip: the
    // trace-distance value is identical either way, machine-checked here)
    let rho = plusPlus();
    for (const u of [X2, Z2, Y2]) rho = unitaryOnRho(u, rho);
    assert.ok(
      Math.abs(rho.re[0]![1]! - 0.5) < 1e-12,
      `off-diagonal ${rho.re[0]![1]} is +1/2: the ray is |+>`,
    );
  });
});
