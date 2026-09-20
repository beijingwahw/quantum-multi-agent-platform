import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matEq, mMul } from "../src/core/cmat.js";
import { traceReal } from "../src/core/measures.js";
import { concurrence, eF, pureFidelity } from "../src/kernel/clearing.js";
import {
  ghzCoin,
  withdrawToAB,
  ghzPairwiseConcurrences,
  ghzCutNegativities,
} from "../src/kernel/ghz.js";
import {
  BETA_GRID,
  PHI_GRID,
  THETA_CLAIMS,
  THETA_GRID,
  WOOT_TOL,
  type ThetaClaimRow,
  basisCensus,
  basisKets,
  bellThetaKet,
  checkThetaClaims,
  ghzThetaCoin,
  purePairCoherence,
  thetaFaces,
  withdrawTheta,
} from "../src/kernel/ghztheta.js";

/** A writeable view of a theta claim — contraband is smuggled into a private copy. */
type MutableThetaClaim = {
  -readonly [K in keyof ThetaClaimRow]: ThetaClaimRow[K];
};

function smuggleTheta(
  mutate: (rows: MutableThetaClaim[]) => void,
): ReturnType<typeof checkThetaClaims> {
  const copy = JSON.parse(JSON.stringify(THETA_CLAIMS)) as MutableThetaClaim[];
  mutate(copy);
  return checkThetaClaims(copy);
}

function thetaRow(rows: MutableThetaClaim[], id: string): MutableThetaClaim {
  const row = rows.find((r) => r.id === id);
  if (row === undefined)
    throw new Error(`smuggle: THETA_CLAIMS has no row ${id}`);
  return row;
}

describe("T-TH1 the theta triple (the desk's theorem)", () => {
  it("TH1/TH2: pairwise concurrences 0 and cut negativities 1/2 at EVERY grid theta", () => {
    let worstC = 0;
    let worstN = 0;
    for (const theta of THETA_GRID) {
      const rho = ghzThetaCoin(theta);
      for (const c of ghzPairwiseConcurrences(rho))
        worstC = Math.max(worstC, c);
      for (const n of ghzCutNegativities(rho))
        worstN = Math.max(worstN, Math.abs(n - 0.5));
    }
    assert.ok(worstC <= 1e-12, `worst pairwise concurrence ${worstC}`);
    assert.ok(worstN <= 1e-12, `worst cut deviation ${worstN}`);
    assert.strictEqual(THETA_GRID.length, 24);
  });

  it("the phase cancellation is structural: the pairwise reduction's coherence cells are EXACTLY 0.0 at every theta", () => {
    for (const theta of THETA_GRID) {
      const f = thetaFaces(theta);
      assert.ok(
        f.abBlockExact,
        `the AB block carries a nonzero coherence at theta=${theta}`,
      );
    }
  });

  it("TH3: the withdrawal — p exactly 1/2, AB exactly |Phi_{+-theta}>, C exactly 1, E_F exactly 1, cost 1 cbit", () => {
    for (const theta of THETA_GRID) {
      const wd = withdrawTheta(theta);
      assert.ok(
        Math.abs(wd.pPlus - 0.5) <= 1e-12 && Math.abs(wd.pMinus - 0.5) <= 1e-12,
      );
      assert.ok(
        Math.abs(pureFidelity(wd.abPlus, bellThetaKet(theta, 1)) - 1) <= 1e-12,
      );
      assert.ok(
        Math.abs(pureFidelity(wd.abMinus, bellThetaKet(theta, -1)) - 1) <=
          1e-12,
      );
      // the exact linear route (2|rho_{00,11}|) and the Wootters solver path —
      // the solver carries its documented ~1e-8 on rank-deficient pure pairs
      assert.ok(
        Math.abs(purePairCoherence(wd.abPlus) - 1) <= 1e-12 &&
          Math.abs(purePairCoherence(wd.abMinus) - 1) <= 1e-12,
      );
      assert.ok(
        Math.abs(concurrence(wd.abPlus) - 1) <= WOOT_TOL &&
          Math.abs(concurrence(wd.abMinus) - 1) <= WOOT_TOL,
      );
      assert.ok(
        Math.abs(eF(wd.abPlus) - 1) <= WOOT_TOL &&
          Math.abs(eF(wd.abMinus) - 1) <= WOOT_TOL,
      );
      assert.strictEqual(wd.cbits, 1);
    }
  });

  it("TH3's coin phase really moves with theta (the sensitivity control: the sweep is not vacuously flat)", () => {
    for (const theta of [
      Math.PI / 6,
      Math.PI / 4,
      Math.PI / 3,
      Math.PI / 2,
      (2 * Math.PI) / 3,
    ]) {
      const wd = withdrawTheta(theta);
      const dPlus = Math.abs(
        Math.atan2(
          Math.sin(wd.coinPhasePlus - theta),
          Math.cos(wd.coinPhasePlus - theta),
        ),
      );
      const dMinus = Math.abs(
        Math.atan2(
          Math.sin(wd.coinPhaseMinus - theta - Math.PI),
          Math.cos(wd.coinPhaseMinus - theta - Math.PI),
        ),
      );
      assert.ok(
        dPlus <= 1e-9 && dMinus <= 1e-9,
        `coin phase lost theta=${theta}`,
      );
    }
  });

  it("TH4: the withdrawal conserves A|BC and B|AC exactly (1/2 -> 1/2) and drops AB|C exactly (1/2 -> 0), every theta", () => {
    for (const theta of THETA_GRID) {
      const wd = withdrawTheta(theta);
      for (const joint of [wd.jointPlus, wd.jointMinus]) {
        const cuts = ghzCutNegativities(joint);
        assert.ok(Math.abs(cuts[0]) <= 1e-12, "AB|C did not drop to 0");
        assert.ok(
          Math.abs(cuts[1] - 0.5) <= 1e-12 && Math.abs(cuts[2] - 0.5) <= 1e-12,
          "a conserved cut moved",
        );
      }
    }
  });
});

describe("T-TH2 the basis census — which bases withdraw a standard coin, and where theta goes", () => {
  it("branch probabilities exactly 1/2 at EVERY tilt, phase, and theta; branch concurrence = |sin 2 beta|, theta-free (two paths)", () => {
    let worstP = 0;
    let worstCell = 0;
    let worstWoot = 0;
    for (const theta of THETA_GRID) {
      for (const row of basisCensus(theta)) {
        worstP = Math.max(
          worstP,
          Math.abs(row.pPlus - 0.5),
          Math.abs(row.pMinus - 0.5),
        );
        worstCell = Math.max(
          worstCell,
          Math.abs(row.cellPlus - row.predictedC),
          Math.abs(row.cellMinus - row.predictedC),
        );
        worstWoot = Math.max(
          worstWoot,
          Math.abs(row.cPlus - row.predictedC),
          Math.abs(row.cMinus - row.predictedC),
        );
      }
    }
    assert.ok(worstP <= 1e-12, `a branch probability left 1/2 (${worstP})`);
    assert.ok(
      worstCell <= 1e-12,
      `branch coherence missed |sin 2 beta| (${worstCell})`,
    );
    assert.ok(
      worstWoot <= WOOT_TOL,
      `solver path missed |sin 2 beta| (${worstWoot})`,
    );
    assert.strictEqual(BETA_GRID.length * PHI_GRID.length, 26);
  });

  it("the R18 draft's expectation is REFUTED: no basis folds theta into populations — Y folds its OWN phase into the coin as theta - pi/2", () => {
    const theta = Math.PI / 3;
    // Y basis: tilt pi/4, phase pi/2 — populations stay 1/2, the coin carries theta - pi/2
    const rows = basisCensus(theta, [Math.PI / 4], [Math.PI / 2]);
    const row = rows[0];
    if (row === undefined) throw new Error("census row missing");
    assert.ok(
      Math.abs(row.pPlus - 0.5) <= 1e-12 && Math.abs(row.pMinus - 0.5) <= 1e-12,
      "Y folded theta into populations",
    );
    const expected = Math.atan2(
      Math.sin(theta - Math.PI / 2),
      Math.cos(theta - Math.PI / 2),
    );
    const got = Math.atan2(
      Math.sin(row.phasePlus - row.phasePredicted),
      Math.cos(row.phasePlus - row.phasePredicted),
    );
    assert.ok(
      Math.abs(got) <= 1e-9 && Math.abs(row.phasePredicted - expected) <= 1e-12,
      "the coin phase missed theta - pi/2 under Y",
    );
  });

  it("the standard coin is withdrawn EXACTLY at equatorial bases and nowhere else on the grid", () => {
    for (const row of basisCensus(Math.PI / 5)) {
      const equatorial = Math.abs(Math.sin(2 * row.beta) - 1) <= 1e-12;
      const standard = Math.abs(row.cellPlus - 1) <= 1e-12;
      assert.strictEqual(
        standard,
        equatorial,
        `tilt ${row.beta.toFixed(4)} mismatched standardness`,
      );
    }
  });

  it("TH6: every numerical face reproduces its theta = 0 value — the angle lives only in the coin's phase", () => {
    const base = thetaFaces(0);
    const dev = (a: readonly number[], b: readonly number[]): number =>
      Math.max(...a.map((x, i) => Math.abs(x - b[i]!)));
    let worst = 0;
    for (const theta of THETA_GRID) {
      const f = thetaFaces(theta);
      worst = Math.max(
        worst,
        dev(f.pairwise, base.pairwise),
        dev(f.cuts, base.cuts),
        Math.abs(f.pPlus - base.pPlus),
        Math.abs(f.pMinus - base.pMinus),
        dev(f.populations, base.populations),
      );
    }
    assert.ok(
      worst <= 1e-12,
      `a numerical face reads theta (worst deviation ${worst})`,
    );
  });
});

describe("T-TH3 theta = 0 degenerates onto the existing bank (the G1-G4 cross-check)", () => {
  it("ghzThetaCoin(0) IS ghzCoin() and withdrawTheta(0) IS withdrawToAB()", () => {
    assert.ok(matEq(ghzThetaCoin(0), ghzCoin()));
    const mine = withdrawTheta(0);
    const bank = withdrawToAB();
    assert.ok(matEq(mine.abPlus, bank.abPlus));
    assert.ok(matEq(mine.abMinus, bank.abMinus));
    assert.ok(
      Math.abs(mine.pPlus - bank.pPlus) <= 1e-15 &&
        Math.abs(mine.pMinus - bank.pMinus) <= 1e-15,
    );
  });

  it("the bank's own machinery confirms the theta desk at a random pure bank phase (fidelity against an independently tilted coin)", () => {
    // a random theta, checked against bellTheta built the other way: |Phi_theta>
    // must be the X-branch of |GHZ_theta> — the same claim off the grid
    const theta = 1.234;
    const wd = withdrawTheta(theta);
    assert.ok(
      Math.abs(pureFidelity(wd.abPlus, bellThetaKet(theta, 1)) - 1) <= 1e-12,
    );
    assert.ok(Math.abs(purePairCoherence(wd.abMinus) - 1) <= 1e-12);
  });
});

describe("T-TH4 smuggling trials — contraband theta claims are rejected by name (the H8 discipline)", () => {
  it("TH7 claimed HOLDS (any basis withdraws a standard coin) is convicted by recomputation", () => {
    const hit = smuggleTheta((rows) => {
      thetaRow(rows, "TH7").tag = "HOLDS";
    }).find((v) => v.row === "TH7");
    assert.ok(hit, "expected an H8 violation on TH7");
    assert.match(hit.detail, /claimed HOLDS but the machine says otherwise/);
    assert.match(hit.detail, /not a standard coin/);
  });

  it("TH6 claimed HOLDS (theta readable off a numerical face) is convicted — no face recomputes a theta dependence", () => {
    const hit = smuggleTheta((rows) => {
      thetaRow(rows, "TH6").tag = "HOLDS";
    }).find((v) => v.row === "TH6");
    assert.ok(hit, "expected an H8 violation on TH6");
    assert.match(hit.detail, /claimed HOLDS but the machine says otherwise/);
  });

  it("an illegal tag is rejected by vocabulary", () => {
    const hit = smuggleTheta((rows) => {
      thetaRow(rows, "TH1").tag = "QUOTED" as MutableThetaClaim["tag"];
    }).find((v) => v.row === "TH1");
    assert.ok(hit, "expected an H8 violation on TH1");
    assert.match(hit.detail, /illegal claim tag/);
  });

  it("an unknown claim id is refused by name", () => {
    assert.throws(
      () =>
        checkThetaClaims([{ id: "TH9", claim: "counterfeit", tag: "HOLDS" }]),
      /EC_THETA_CLAIM/,
    );
  });
});

describe("T-TH5 the claims table clears and the named refusals fire", () => {
  it("checkThetaClaims recomputes the whole table clean", () => {
    assert.deepEqual(checkThetaClaims(), []);
    const refuted = THETA_CLAIMS.filter((c) => c.tag === "REFUTED").map(
      (c) => c.id,
    );
    assert.deepEqual(refuted, ["TH6", "TH7"]);
  });

  it("a non-finite angle is refused by name at every desk door", () => {
    assert.throws(() => ghzThetaCoin(Number.NaN), /EC_THETA_NON_FINITE/);
    assert.throws(
      () => withdrawTheta(Number.POSITIVE_INFINITY),
      /EC_THETA_NON_FINITE/,
    );
    assert.throws(() => basisKets(Number.NaN, 0), /EC_THETA_NON_FINITE/);
  });

  it("the two withdrawn branch coins have orthogonal supports at every theta (Tr rho+ rho- exactly 0) and unit trace", () => {
    for (const theta of THETA_GRID) {
      const wd = withdrawTheta(theta);
      const overlap = mMul(wd.abPlus, wd.abMinus);
      assert.ok(
        Math.abs(traceReal(overlap)) <= 1e-12,
        `branch coins overlap at theta=${theta}`,
      );
      assert.ok(
        Math.abs(traceReal(wd.abPlus) - 1) <= 1e-12 &&
          Math.abs(traceReal(wd.abMinus) - 1) <= 1e-12,
      );
    }
  });
});
