import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditComposition, claimFromComposition, composeStages } from "../src/kernel/compose.js";
import type { CompositionClaim } from "../src/kernel/compose.js";
import { buildStagePairs } from "../src/experiments/instances.js";
import { TOL } from "../src/kernel/tol.js";

function compositionPairs() {
  return buildStagePairs().filter((p) => p.name !== "starved-intersection");
}

describe("S6 — stacked ledgers: the composition laws, exact", () => {
  it("chain rule: P_AB = P_A * P_2 on two independent paths (max dev < 1e-12), every pair", () => {
    let maxDev = 0;
    for (const pair of compositionPairs()) {
      const run = composeStages(pair.n, pair.counts, pair.markedA, pair.markedB);
      maxDev = Math.max(maxDev, run.chainDev, run.p2Dev);
    }
    assert.ok(maxDev < TOL, `chain deviation ${maxDev}`);
  });

  it("posterior-of-posterior = posterior over funded(A∩B): fraction path and sequential-projection amplitude path", () => {
    let maxPost = 0;
    let maxSurv = 0;
    for (const pair of compositionPairs()) {
      const run = composeStages(pair.n, pair.counts, pair.markedA, pair.markedB);
      maxPost = Math.max(maxPost, run.posteriorComposeDev);
      maxSurv = Math.max(maxSurv, run.survivorComposeDev);
    }
    assert.ok(maxPost < TOL, `posterior composition deviation ${maxPost}`);
    assert.ok(maxSurv < TOL, `survivor composition deviation ${maxSurv}`);
  });

  it("kill registers compose: staged kills are disjoint items whose union is the direct A∩B register, totals 1-P_AB", () => {
    let maxReg = 0;
    let maxSum = 0;
    for (const pair of compositionPairs()) {
      const run = composeStages(pair.n, pair.counts, pair.markedA, pair.markedB);
      maxReg = Math.max(maxReg, run.registerComposeDev);
      maxSum = Math.max(maxSum, run.registerSumDev);
    }
    assert.ok(maxReg < TOL, `register composition deviation ${maxReg}`);
    assert.ok(maxSum < TOL, `register sum deviation ${maxSum}`);
  });

  it("the composed waiting price: E[T_AB] = 1/(P_A P_2) = 1/P_A + (1-P_2)/(P_A P_2), and the amortized odds ADD", () => {
    let maxChain = 0;
    let maxRenewal = 0;
    let maxOdds = 0;
    for (const pair of compositionPairs()) {
      const run = composeStages(pair.n, pair.counts, pair.markedA, pair.markedB);
      maxChain = Math.max(maxChain, run.waitingChainDev);
      maxRenewal = Math.max(maxRenewal, run.waitingRenewalDev);
      maxOdds = Math.max(maxOdds, run.oddsComposeDev);
    }
    assert.ok(maxChain < TOL, `waiting chain deviation ${maxChain}`);
    assert.ok(maxRenewal < TOL, `waiting renewal deviation ${maxRenewal}`);
    assert.ok(maxOdds < TOL, `odds additivity deviation ${maxOdds}`);
  });

  it("address filters commute: composing (A,B) and (B,A) yields the same posterior (order dev = 0)", () => {
    for (const pair of compositionPairs()) {
      const run = composeStages(pair.n, pair.counts, pair.markedA, pair.markedB);
      assert.ok(run.orderDev < TOL, `${pair.name}: order deviation ${run.orderDev}`);
    }
  });

  it("structural referees: the identity stage composes to stage A alone; a stage twice is the stage", () => {
    const pairs = buildStagePairs();
    const identity = pairs.find((p) => p.name === "identity-stage");
    assert.ok(identity);
    const idRun = composeStages(identity.n, identity.counts, identity.markedA, identity.markedB);
    assert.equal(idRun.killRegister2.length, 0);
    assert.ok(Math.abs(idRun.p2 - 1) < TOL);
    assert.ok(Math.abs(idRun.runAB.pKeep - idRun.runA.pKeep) < TOL);

    const idem = pairs.find((p) => p.name === "idempotent");
    assert.ok(idem);
    const idemRun = composeStages(idem.n, idem.counts, idem.markedA, idem.markedB);
    assert.equal(idemRun.killRegister2.length, 0);
    assert.ok(Math.abs(idemRun.p2 - 1) < TOL);
    assert.ok(Math.abs(idemRun.runAB.pKeep - idemRun.runA.pKeep) < TOL);
  });

  it("the starved intersection is the composed P=0: the kernel refuses (executable grammar failure)", () => {
    const starved = buildStagePairs().find((p) => p.name === "starved-intersection");
    assert.ok(starved);
    assert.throws(
      () => composeStages(starved.n, starved.counts, starved.markedA, starved.markedB),
      /undefined/,
    );
  });

  it("the honest stacked ledger audits clean under its own laws (C1-C5)", () => {
    for (const pair of compositionPairs()) {
      const run = composeStages(pair.n, pair.counts, pair.markedA, pair.markedB);
      const violations = auditComposition(claimFromComposition(run), TOL);
      assert.deepEqual(violations, [], pair.name);
    }
  });
});

describe("S6 smuggling trials — counterfeit stacked ledgers are named and rejected", () => {
  // a concrete honest composition to forge from
  function honestClaim(): CompositionClaim {
    const pair = buildStagePairs().find((p) => p.name === "overlap-3of4");
    assert.ok(pair);
    const run = composeStages(pair.n, pair.counts, pair.markedA, pair.markedB);
    return claimFromComposition(run);
  }

  it("TRIAL 1 — the counterfeit kill register: masses that do NOT sum to 1-P_AB are named by C2", () => {
    const claim = honestClaim();
    // inflate every stage-1 mass by 5% — the staged total leaves the complement
    const forged: CompositionClaim = {
      ...claim,
      register1: claim.register1.map((r) => ({ ...r, mass: r.mass * 1.05 })),
      registerABTotal: claim.registerABTotal * 1.05,
    };
    const v = auditComposition(forged, TOL);
    assert.ok(v.some((x) => x.startsWith("C2:") && x.includes("do not compose")), JSON.stringify(v));
    assert.ok(v.some((x) => x.startsWith("C2:") && x.includes("not 1-P_AB")), JSON.stringify(v));
  });

  it("TRIAL 2 — the fake composition identity: probabilities that ADD instead of multiply are named by C1", () => {
    const claim = honestClaim();
    const forged: CompositionClaim = { ...claim, pAB: claim.p1 + claim.p2 };
    const v = auditComposition(forged, TOL);
    assert.ok(v.some((x) => x.startsWith("C1:") && x.includes("chain rule violated")), JSON.stringify(v));
    // and the fake register total the additive forger would file is caught too
    const forgedRegister: CompositionClaim = {
      ...claim,
      registerABTotal: 1 - (claim.p1 + claim.p2),
    };
    const v2 = auditComposition(forgedRegister, TOL);
    assert.ok(v2.some((x) => x.startsWith("C2:")), JSON.stringify(v2));
  });

  it("TRIAL 3 — the double-counted kill: a universe dying in BOTH stages is named by C3", () => {
    const claim = honestClaim();
    const firstStage2 = claim.register2[0];
    assert.ok(firstStage2);
    const forged: CompositionClaim = {
      ...claim,
      register1: [...claim.register1, firstStage2],
      registerABTotal: claim.registerABTotal + firstStage2.mass,
    };
    const v = auditComposition(forged, TOL);
    assert.ok(v.some((x) => x.startsWith("C3:") && x.includes("killed in BOTH stages")), JSON.stringify(v));
  });

  it("TRIAL 4 — the unamortized odds: odds1 + odds2 without the 1/P_A amortization is named by C5", () => {
    const claim = honestClaim();
    const naiveOdds = (1 - claim.p1) / claim.p1 + (1 - claim.p2) / claim.p2;
    const forged: CompositionClaim = { ...claim, oddsAB: naiveOdds };
    const v = auditComposition(forged, TOL);
    assert.ok(v.some((x) => x.startsWith("C5:") && x.includes("amortized by P_A")), JSON.stringify(v));
  });

  it("TRIAL 5 — the naive waiting sum 1/P_A + 1/P_2 - 1 is named by C4", () => {
    const claim = honestClaim();
    const forged: CompositionClaim = {
      ...claim,
      waitingRenewal: 1 / claim.p1 + 1 / claim.p2 - 1,
    };
    const v = auditComposition(forged, TOL);
    assert.ok(v.some((x) => x.startsWith("C4:") && x.includes("renewal identity violated")), JSON.stringify(v));
  });
});
