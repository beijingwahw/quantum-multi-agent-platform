import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendThresholds,
  auditCascade,
  cascadeStages,
  claimFromCascade,
  mcCascade,
  waitingLedger,
} from "../src/kernel/cascade.js";
import type { CascadeClaim } from "../src/kernel/cascade.js";
import { CensusError } from "../src/kernel/errors.js";
import { Rng } from "../src/kernel/survivor.js";
import { extremeIndices, randomCounts } from "../src/experiments/instances.js";
import { TOL } from "../src/kernel/tol.js";

interface CascadeFamily {
  readonly name: string;
  readonly markedSets: ReadonlyArray<readonly number[]>;
}

function cascadeFamilies(): CascadeFamily[] {
  const n = 4;
  const base = randomCounts(n, 201);
  const quarter = [0, 4, 8, 12];
  const heavy = extremeIndices(base, 3, true);
  const all = Array.from({ length: 2 ** n }, (_, x) => x);
  return [
    { name: "shrink-3", markedSets: [quarter, [0, 4], [4]] },
    { name: "heavy-2", markedSets: [heavy, [heavy[0]!]] },
    { name: "trivial-tail", markedSets: [quarter, all] },
    { name: "single-level", markedSets: [[7]] },
  ];
}

describe("S8 — the cascade waiting ledger, exact", () => {
  it("level keeps compose by the k-fold chain rule on two paths (amplitude vs integer ratios), every cascade", () => {
    for (const fam of cascadeFamilies()) {
      const run = cascadeStages(4, randomCounts(4, 201), fam.markedSets);
      assert.ok(
        run.levelDev < TOL,
        `${fam.name}: level deviation ${run.levelDev}`,
      );
      assert.ok(
        run.chainDev < TOL,
        `${fam.name}: chain deviation ${run.chainDev}`,
      );
      // the trivial tail keeps P_2 = 1 exactly — the intersection is level 1 itself
      if (fam.name === "trivial-tail") {
        assert.ok(Math.abs((run.pLevels[1] as number) - 1) < TOL);
      }
      if (fam.name === "single-level") {
        assert.equal(run.pLevels.length, 1);
      }
    }
  });

  it("three architectures, two paths each: geometric sum vs renewal partials; suffix sum vs extension recursion; the Wald identity rounds x attempts-per-round", () => {
    const grids: ReadonlyArray<readonly number[]> = [
      [0.5],
      [0.25],
      [0.5, 0.5],
      [0.25, 0.5, 0.75],
      [0.9, 0.9],
      [0.4, 0.4, 0.4],
      [0.3, 1, 0.6],
    ];
    for (const ps of grids) {
      const l = waitingLedger(ps);
      assert.ok(
        l.seqDev < 1e-10,
        `ps=[${ps.join(",")}]: seq deviation ${l.seqDev}`,
      );
      assert.ok(
        l.fusedPartialDev < 1e-10,
        `ps=[${ps.join(",")}]: fused partial deviation ${l.fusedPartialDev}`,
      );
      assert.ok(
        l.restartDev < 1e-10,
        `ps=[${ps.join(",")}]: restart deviation ${l.restartDev}`,
      );
      assert.ok(
        l.waldDev < 1e-9 * Math.max(1, l.restartMeanSuffix),
        `ps=[${ps.join(",")}]: Wald identity deviation ${l.waldDev}`,
      );
      assert.ok(
        Math.abs(l.fusedMinusSeqScaled - (1 - l.boundarySum)) < 1e-9,
        `ps=[${ps.join(",")}]: boundary identity`,
      );
    }
  });

  it("S8.1/S8.2 universal orderings: restart >= fused and restart >= sequential at ANY difficulty; the boundary identity signs fused vs sequential", () => {
    for (const ps of [
      [0.5, 0.5],
      [0.25, 0.5, 0.75],
      [0.9, 0.9],
      [0.99, 0.2, 0.8],
      [0.4, 0.4, 0.4],
    ] as const) {
      const l = waitingLedger(ps);
      assert.ok(
        l.restartMeanSuffix >= l.fusedMean - TOL,
        `ps=[${ps.join(",")}]: restart >= fused`,
      );
      assert.ok(
        l.separationRestart >= 1 - TOL,
        `ps=[${ps.join(",")}]: restart >= sequential (memory never loses to re-running)`,
      );
      // the sign of fused - sequential is EXACTLY the sign of 1 - boundarySum
      assert.equal(
        l.fusedMean > l.seqMeanClosed + TOL,
        l.boundarySum < 1 - TOL,
        `ps=[${ps.join(",")}]: boundary sign`,
      );
    }
  });

  it("S8.3 the hard regime: fused >= sequential and the designed ratio >= 1; k=1 equality exact", () => {
    for (const ps of [
      [0.5, 0.5],
      [0.4, 0.4],
      [0.4, 0.4, 0.4],
      [0.3, 0.25, 0.5, 0.4],
      [0.5, 0.5, 0.5, 0.5],
    ] as const) {
      const l = waitingLedger(ps);
      assert.ok(l.hardRegime, `ps=[${ps.join(",")}] must classify as hard`);
      assert.ok(
        l.separationFused >= 1 - TOL,
        `ps=[${ps.join(",")}]: separation ${l.separationFused}`,
      );
    }
    const corner = waitingLedger([0.5, 0.5]); // the exact hard corner ties
    assert.ok(Math.abs(corner.separationFused - 1) < TOL);
    const single = waitingLedger([0.37]);
    assert.ok(
      Math.abs(single.separationFused - 1) < TOL &&
        Math.abs(single.separationRestart - 1) < TOL,
    );
    assert.ok(
      Math.abs(single.seqMeanClosed - single.fusedMean) < TOL &&
        Math.abs(single.fusedMean - single.restartMeanSuffix) < TOL,
    );
  });

  it("S8.4 depth thresholds: appending P' grows the ratio exactly when P' is below the threshold (hard appends grow, easy appends dilute)", () => {
    const base = [0.4, 0.4];
    const thr = appendThresholds(base);
    const r0 = waitingLedger(base);
    const grows = waitingLedger([0.4, 0.4, 0.4]);
    const dilutes = waitingLedger([0.4, 0.4, 0.99]);
    assert.ok(
      grows.separationFused > r0.separationFused + 1e-12,
      "hard append must grow fused/sequential",
    );
    assert.ok(
      dilutes.separationFused < r0.separationFused - 1e-12,
      "easy append must dilute fused/sequential",
    );
    assert.ok(
      grows.separationRestart > r0.separationRestart + 1e-12,
      "hard append must grow restart/sequential",
    );
    assert.ok(
      dilutes.separationRestart < r0.separationRestart - 1e-12,
      "easy append must dilute restart/sequential",
    );
    // the threshold predicts the sign EXACTLY over a sweep of appendage difficulties
    for (let i = 1; i <= 19; i++) {
      const p = i / 20;
      const after = waitingLedger([...base, p]);
      const grewFused = after.separationFused > r0.separationFused + 1e-12;
      const grewRestart =
        after.separationRestart > r0.separationRestart + 1e-12;
      assert.equal(grewFused, p < thr.growFused, `P'=${p} fused threshold`);
      assert.equal(
        grewRestart,
        p < thr.growRestart,
        `P'=${p} restart threshold`,
      );
    }
  });

  it("negative control: the easy pair (0.9, 0.9) — one joint attempt is CHEAPER than the stacked ledger; naive universal separation is convicted", () => {
    const l = waitingLedger([0.9, 0.9]);
    assert.ok(!l.hardRegime);
    assert.ok(l.boundarySum > 1 + TOL, `boundary ${l.boundarySum}`);
    assert.ok(l.separationFused < 1 - 1e-3, `separation ${l.separationFused}`);
    // memory vs RE-RUNNING still pays even here — the universal ordering holds
    assert.ok(
      l.separationRestart > 1 + 1e-3,
      `restart separation ${l.separationRestart}`,
    );
  });
});

describe("S8 — smuggling trials (走私审判)", () => {
  const run = cascadeStages(4, randomCounts(4, 201), [
    [0, 4, 8, 12],
    [0, 4],
    [4],
  ]);

  it("the honest claim audits clean (W1-W5 empty)", () => {
    const verdict = auditCascade(claimFromCascade(run), TOL);
    assert.deepEqual(verdict, []);
  });

  it("the undercount: quoting the fused number as the restart price is NAMED and REJECTED", () => {
    const honest = claimFromCascade(run);
    const forged: CascadeClaim = {
      ...honest,
      declaredRestart: honest.declaredFused,
    };
    const verdict = auditCascade(forged, TOL);
    assert.ok(verdict.length > 0);
    assert.match(verdict.join(" | "), /W3/);
  });

  it("the memory narratives: inverted hard-regime claims and inverted easy-pair claims are both NAMED and REJECTED", () => {
    const honest = claimFromCascade(run);
    assert.ok(
      honest.declaredFusedBeatsSeq,
      "the shrink-3 cascade is hard — memory pays through fusion",
    );
    const slander: CascadeClaim = { ...honest, declaredFusedBeatsSeq: false };
    assert.match(auditCascade(slander, TOL).join(" | "), /W5/);
    // the easy pair, honestly priced, with the hard narrative bolted on
    const easyLedger = waitingLedger([0.9, 0.9]);
    const easyClaim: CascadeClaim = {
      label: "(0.9) then (0.9)",
      ps: [0.9, 0.9],
      declaredSeq: easyLedger.seqMeanClosed,
      declaredFused: easyLedger.fusedMean,
      declaredRestart: easyLedger.restartMeanSuffix,
      declaredFusedBeatsSeq: true,
    };
    assert.match(auditCascade(easyClaim, TOL).join(" | "), /W5/);
  });
});

describe("S8 — grammar failures, executable", () => {
  const isCode =
    (code: string) =>
    (e: unknown): boolean =>
      e instanceof CensusError && e.code === code;

  it("a starving depth refuses by name (SC/EMPTY-INTERSECTION); illegal ledgers refuse by name", () => {
    const base = randomCounts(4, 201);
    assert.throws(
      () => cascadeStages(4, base, [[0, 4, 8, 12], [1]]),
      isCode("SC/EMPTY-INTERSECTION"),
    );
    assert.throws(
      () =>
        cascadeStages(4, base, [
          [0, 4, 8, 12],
          [0, 99],
        ]),
      isCode("SC/BAD-MARKED"),
    );
    assert.throws(() => waitingLedger([0.5, 0]), isCode("SC/P-DOMAIN"));
    assert.throws(() => waitingLedger([]), isCode("SC/BAD-MARKED"));
    assert.throws(
      () => mcCascade([0.5], 0, () => 0.5),
      isCode("SC/MC-BAD-INPUTS"),
    );
  });
});

describe("S8 — realization referees (DATA, never theorem claims)", () => {
  it("MC: sequential, round count and attempts-per-round land inside 5 sigma; restart attempts match the suffix law loosely", () => {
    const ps = cascadeStages(4, randomCounts(4, 201), [
      [0, 4, 8, 12],
      [0, 4],
      [4],
    ]).ledger.ps;
    const rng = new Rng(20260920);
    const mc = mcCascade(ps, 60000, () => rng.next());
    assert.ok(mc.seqSigmaUnits < 5, `seq ${mc.seqSigmaUnits} sigma`);
    assert.ok(mc.roundsSigmaUnits < 5, `rounds ${mc.roundsSigmaUnits} sigma`);
    assert.ok(
      mc.trialsSigmaUnits < 5,
      `trials-per-round ${mc.trialsSigmaUnits} sigma`,
    );
    const theory = waitingLedger(ps).restartMeanSuffix;
    assert.ok(
      Math.abs(mc.restartAttemptsMean - theory) / theory < 0.05,
      `restart attempts ${mc.restartAttemptsMean} vs ${theory}`,
    );
  });
});
