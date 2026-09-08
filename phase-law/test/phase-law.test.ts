import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { makeRng } from "../src/core/rng.js";
import {
  anneal,
  coupledRegimeDeviation,
  enumerateAll,
  envelopeThreshold,
  greedy,
  hungarianMax,
  kPairAllRegimeOptimum,
  kPairMonotoneDeviation,
  kPairOptimum,
  landscapeStats,
  localSearch,
  lsThreshold2xn,
  makeInstance,
  makeKPairInstance,
  optimumOf,
  welfareOf,
} from "../src/kernel/law.js";
import { campaign, census, envelopeCheck, islandCampaign, thresholds } from "../src/kernel/census.js";
import {
  checkSaLog,
  densityCampaign,
  densityTableViolations,
  kPairAnneal,
  kPairGreedy,
  kPairLocalSearch,
  kPairWelfareOf,
  type DensityCell,
} from "../src/kernel/density.js";
import {
  makeNuInstance,
  nuAllKDeviation,
  nuAllKOptimum,
  nuEnvelopeDeviation,
  nuInAllKRegime,
  nuOptimum,
  nuRay,
  nuRayDescentCount,
  nuSubsetEnvelope,
} from "../src/kernel/nonuniform.js";
import {
  staircaseArgmaxMismatch,
  staircaseCell,
  staircaseCheck,
  staircaseFlipDeviation,
  type StaircaseCell,
} from "../src/kernel/staircase.js";
import { BOARD, type BoardRow } from "../src/kernel/board.js";
import { checkBoard, runWitnesses } from "../src/kernel/audit.js";

describe("the exact layer", () => {
  it("the envelope theorem: closed form === enumerated switch (negative control: a fake +0.1 offset must fail)", () => {
    const dev = envelopeCheck(3, 4, 700, [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5]).worstSwitchDeviation;
    assert.equal(dev, 0);
    // the closed form itself: recompute U, C by enumeration and compare
    const inst = makeInstance(3, 4, 700, 0);
    const { U, C } = envelopeThreshold(inst);
    let eu = -Infinity;
    let ec = -Infinity;
    for (const a of enumerateAll(inst)) {
      if (a.usesBoth) ec = Math.max(ec, a.w0);
      else eu = Math.max(eu, a.w0);
    }
    assert.equal(U, eu);
    assert.equal(C, ec);
  });

  it("welfare accounting: W_λ = W_0 + λ·I on every assignment (对拍 vs enumeration)", () => {
    for (const lambda of [0, 0.35, 1.5]) {
      const inst = makeInstance(3, 4, 900, lambda);
      const zero = makeInstance(3, 4, 900, 0);
      for (const a of enumerateAll(zero).slice(0, 12)) {
        const expected = a.welfare + (a.usesBoth ? lambda : 0);
        assert.ok(Math.abs(welfareOf(inst, a.assignment) - expected) < 1e-12);
      }
    }
  });

  it("greedy/LS/SA 对拍 vs the enumerated optimum on small instances; SA never loses to greedy", () => {
    for (let k = 1; k <= 4; k++) {
      const inst = makeInstance(3, 4, 300 * k, 0.5);
      const opt = optimumOf(inst).welfare;
      const g = welfareOf(inst, greedy(inst));
      const ls = welfareOf(inst, localSearch(inst, greedy(inst)));
      const sa = welfareOf(inst, anneal(inst, 42));
      assert.ok(ls >= g - 1e-12, "LS starts at greedy, never loses");
      assert.ok(sa >= g - 1e-12, "SA best-ever never loses to greedy");
      assert.ok(ls <= opt + 1e-12 && sa <= opt + 1e-12);
    }
  });

  it("determinism: same (size, seed, λ) → identical instance and identical SA output", () => {
    const a = makeInstance(3, 5, 1234, 0.4);
    const b = makeInstance(3, 5, 1234, 0.4);
    assert.deepEqual(a.weights, b.weights);
    assert.deepEqual(anneal(a, 7), anneal(b, 7));
    assert.notDeepEqual(makeRng(1)(), makeRng(2)());
  });
});

describe("the landscape", () => {
  it("at λ=0 the landscape has exactly ONE local optimum (the global, basin 100%)", () => {
    const s = landscapeStats(makeInstance(3, 4, 500, 0));
    assert.equal(s.localOptima, 1);
    assert.ok(s.globalIsLocalOptimum);
    assert.ok(Math.abs(s.globalBasinFraction - 1) < 1e-12);
  });

  it("by λ=1.5 the basin has collapsed while stability is kept (the reachability transition)", () => {
    const s = landscapeStats(makeInstance(3, 4, 500, 1.5));
    assert.ok(s.globalIsLocalOptimum);
    assert.ok(s.globalBasinFraction < 0.5);
    assert.ok(s.localOptima > 1);
  });
});

describe("the census", () => {
  it("compact two-face rerun: LS coupling-flat and matching-fragile; SA coupling-fragile", () => {
    const cells = thresholds(
      census(
        [
          [3, 5],
          [6, 8],
        ],
        [0, 1.5],
        10,
      ),
    );
    const lsSmall = cells.find((c) => c.m === 3 && c.solver === "local-search")!;
    const lsBig = cells.find((c) => c.m === 6 && c.solver === "local-search")!;
    const saBig = cells.find((c) => c.m === 6 && c.solver === "anneal")!;
    assert.ok(Math.abs(lsSmall.hitRateAtMax - lsSmall.hitRateAtZero) <= 0.2);
    assert.ok(lsBig.hitRateAtZero < lsSmall.hitRateAtZero);
    assert.ok(saBig.hitRateAtMax < saBig.hitRateAtZero);
  });
});

describe("v0.2.0 — the theorem and the campaign", () => {
  it("PL8: the 2×n closed-form LS threshold agrees with a fine sweep within one grid step", () => {
    let checked = 0;
    let worst = 0;
    for (let k = 1; k <= 6; k++) {
      const inst = makeInstance(2, 6, 700 * k, 0);
      const { lambdaStar } = lsThreshold2xn(inst);
      if (!Number.isFinite(lambdaStar)) continue;
      let sweep = Number.POSITIVE_INFINITY;
      for (let lambda = 0; lambda <= 3.0001; lambda += 0.001) {
        const probe = makeInstance(2, 6, 700 * k, lambda);
        const opt = optimumOf(probe).welfare;
        const lsW = welfareOf(probe, localSearch(probe, greedy(probe)));
        if (Math.abs(lsW - opt) > 1e-9) {
          sweep = lambda;
          break;
        }
      }
      worst = Math.max(worst, Math.abs(lambdaStar - sweep));
      checked++;
    }
    assert.ok(checked >= 2, "enough finite thresholds to check");
    assert.ok(worst <= 0.0011, `worst deviation ${worst}`);
  });

  it("PL8 negative control: the closed form is exact on the interval it names", () => {
    const inst = makeInstance(2, 6, 700, 0);
    const { lambdaStar } = lsThreshold2xn(inst);
    if (Number.isFinite(lambdaStar)) {
      const justBelow = makeInstance(2, 6, 700, Math.max(0, lambdaStar - 0.01));
      const justAbove = makeInstance(2, 6, 700, lambdaStar + 0.01);
      const optBelow = optimumOf(justBelow).welfare;
      const lsBelow = welfareOf(justBelow, localSearch(justBelow, greedy(justBelow)));
      const optAbove = optimumOf(justAbove).welfare;
      const lsAbove = welfareOf(justAbove, localSearch(justAbove, greedy(justAbove)));
      assert.ok(Math.abs(lsBelow - optBelow) < 1e-9, "LS still hits just below the threshold");
      assert.ok(Math.abs(lsAbove - optAbove) > 1e-9, "LS already misses just above the threshold — the boundary is sharp");
    }
  });

  it("PL9: compact campaign — SA crossing monotone in size at 20 seeds", () => {
    const cells = campaign(
      [
        [4, 6],
        [5, 7],
        [6, 8],
      ],
      [0, 0.5, 1.0, 1.5],
      20,
      ["anneal"],
    );
    const c = cells.map((x) => x.lambdaCross);
    assert.ok(c[0]! >= c[1]! && c[1]! >= c[2]!, `crossings ${c.join(" → ")} not monotone`);
  });
});

describe("v0.3.0 — the island", () => {
  it("PL10: the decomposition equals enumeration above the hinge (and refuses below it)", () => {
    let worst = 0;
    for (const [m, n] of [
      [2, 3],
      [3, 5],
    ] as const) {
      for (let k = 1; k <= 3; k++) {
        const { lambdaStar } = envelopeThreshold(makeInstance(m, n, 600 * k, 0));
        const inst = makeInstance(m, n, 600 * k, lambdaStar + 0.25);
        worst = Math.max(worst, coupledRegimeDeviation(inst));
      }
    }
    assert.ok(worst < 1e-12, `worst ${worst}`);
    assert.throws(() => coupledRegimeDeviation(makeInstance(3, 5, 600, 0)), /COUPLED regime/);
  });

  it("PL11: hungarianMax === the λ=0 enumerated optimum (对拍, correct object)", () => {
    for (let k = 1; k <= 4; k++) {
      const zero = makeInstance(3, 5, 900 * k, 0);
      const assign = hungarianMax(zero.weights);
      let wH = 0;
      for (let t = 0; t < zero.m; t++) wH += zero.weights[t]![assign[t]!]!;
      assert.ok(Math.abs(wH - optimumOf(zero).welfare) < 1e-12, `k=${k}: ${wH} vs ${optimumOf(zero).welfare}`);
    }
  });

  it("PL12: no SA relief at λ=4 (compact island rerun)", () => {
    const cells = islandCampaign(
      [
        [5, 7],
        [6, 8],
      ],
      [0, 1, 2, 4],
      15,
    );
    for (const c of cells) {
      assert.ok(c.rateAtMax <= c.rateAtZero + 1e-12, `${c.m}x${c.n}: relief appeared`);
      assert.equal(c.upCross, -1);
    }
  });
});

describe("v0.4.0 — the density axis", () => {
  it("PL14: k=1 compatibility — the k-pair family IS the v0.1 family at k=1", () => {
    const a = makeInstance(3, 5, 500, 0.7);
    const b = makeKPairInstance(3, 5, 500, 0.7, 1);
    assert.deepEqual(a.weights, b.weights);
    assert.ok(Math.abs(kPairOptimum(b).welfare - optimumOf(a).welfare) < 1e-12);
  });

  it("PL14: the realized-pair count is monotone in λ and equals the envelope argmax", () => {
    for (let s = 1; s <= 2; s++) {
      const r = kPairMonotoneDeviation(4, 6, 800 * s, 2, [0, 0.5, 1, 2, 4, 8]);
      assert.equal(r.worstMonotoneStep, 0, `seed ${s}: staircase descended`);
      assert.equal(r.worstArgmaxMismatch, 0, `seed ${s}: argmax mismatch`);
    }
  });

  it("PL15: the all-k face decomposition is integer-exact; refuses m < 2k", () => {
    let cells = 0;
    for (let s = 1; s <= 2; s++) {
      const inst = makeKPairInstance(4, 6, 800 * s, 8, 2);
      const opt = kPairOptimum(inst);
      assert.equal(opt.pairs, 2, "λ=8 should be in the all-k regime here");
      assert.equal(Math.abs(kPairAllRegimeOptimum(inst) - opt.welfare), 0);
      cells++;
    }
    assert.ok(cells >= 1);
    assert.throws(() => kPairAllRegimeOptimum(makeKPairInstance(3, 6, 800, 8, 2)), /m >= 2k/);
  });
});

describe("v0.5.0 — the density law", () => {
  it("PL18 对拍: at k=1 the density solvers ARE the v0.1 solvers (bit-identical tours)", () => {
    for (let s = 1; s <= 4; s++) {
      for (const lambda of [0, 0.7, 2.5]) {
        const a = makeInstance(5, 7, 500 * s, lambda);
        const b = makeKPairInstance(5, 7, 500 * s, lambda, 1);
        assert.deepEqual(a.weights, b.weights);
        assert.deepEqual(greedy(a), kPairGreedy(b));
        assert.deepEqual(localSearch(a, greedy(a)), kPairLocalSearch(b, kPairGreedy(b)));
        assert.deepEqual(anneal(a, 42), kPairAnneal(b, 42));
        assert.ok(Math.abs(welfareOf(a, anneal(a, 42)) - kPairWelfareOf(b, kPairAnneal(b, 42))) < 1e-12);
      }
    }
  });

  it("PL18: LS/SA never lose to greedy and never beat the enumerated optimum under the k-pair welfare", () => {
    for (const k of [1, 2, 3]) {
      const inst = makeKPairInstance(4, 6, 300, 0.9, k);
      const g = kPairWelfareOf(inst, kPairGreedy(inst));
      const ls = kPairWelfareOf(inst, kPairLocalSearch(inst, kPairGreedy(inst)));
      const sa = kPairWelfareOf(inst, kPairAnneal(inst, 42));
      const opt = kPairOptimum(inst).welfare;
      assert.ok(ls >= g - 1e-12, "LS starts at greedy, never loses");
      assert.ok(sa >= g - 1e-12, "SA best-ever never loses to greedy");
      assert.ok(ls <= opt + 1e-12 && sa <= opt + 1e-12);
    }
  });

  it("PL18: λ=0 columns identical across k; the 6×8 anneal floor collapses with k (compact census)", () => {
    const cells = densityCampaign([[6, 8]], [1, 2, 3], 10, [0, 1, 2, 4, 8]);
    for (const solver of ["anneal", "local-search"] as const) {
      const zeros = new Set(cells.filter((c) => c.solver === solver).map((c) => c.rateAtZero));
      assert.equal(zeros.size, 1, `${solver}: λ=0 hit rate must not depend on k (the matching face is untouched)`);
    }
    const floors = [1, 2, 3].map((k) => cells.find((c) => c.k === k && c.solver === "anneal")!.rateAtMax);
    assert.ok(floors[1]! < floors[0]! && floors[2]! < floors[0]!, `floor by k ${floors.join(" → ")} must collapse`);
    assert.equal(floors[2]!, 0, "SA is dead at λ=8 at k=3 (10 seeds)");
    // where the curve DOES cross down (k ≥ 2), it must never come back up
    for (const c of cells.filter((x) => x.solver === "anneal" && x.downCross >= 0)) {
      assert.equal(c.upCross, -1, `6×8 k=${c.k}: a re-entrant up-cross appeared on the unsaturated axis`);
    }
  });

  it("PL18: the saturated corner — 5×7 k=3 never falls below 0.5 (compact rerun)", () => {
    const cells = densityCampaign([[5, 7]], [3], 10, [0, 0.5, 0.9, 1.5, 4, 8], ["anneal"]);
    const c = cells[0]!;
    assert.ok(c.minRate >= 0.5, `saturated min ${c.minRate}`);
    assert.equal(c.downCross, -1);
  });

  it("PL19: the subset-envelope identity is exact; k=1 is the v0.1 family; the all-k face is exact and guarded", () => {
    let worst = 0;
    for (let s = 1; s <= 3; s++) {
      for (const lam of [
        [0.3, 0.9],
        [1.5, 0.2, 0.7],
      ]) {
        worst = Math.max(worst, nuEnvelopeDeviation(makeNuInstance(4, 6, 500 * s, lam)));
      }
    }
    assert.equal(worst, 0);
    const a = makeInstance(3, 5, 500, 0.7);
    const nu = makeNuInstance(3, 5, 500, [0.7]);
    assert.deepEqual(a.weights, nu.weights);
    assert.ok(Math.abs(nuOptimum(nu).welfare - optimumOf(a).welfare) < 1e-12);
    const allK = makeNuInstance(5, 7, 500, [6, 6]);
    assert.ok(nuInAllKRegime(allK));
    assert.equal(nuAllKDeviation(allK), 0);
    assert.throws(() => nuAllKDeviation(makeNuInstance(5, 7, 500, [0.01, 0.01])), /not in the all-k regime/);
    assert.throws(() => nuAllKOptimum(makeNuInstance(4, 6, 500, [1, 1, 1])), /m ≥ 2k/);
  });

  it("PL19: monotone count on non-uniform rays — k=2 finds ZERO descents; k=3 descends exactly at t* = 0.170", () => {
    const ts = Array.from({ length: 31 }, (_, i) => i * 0.1);
    assert.equal(nuRayDescentCount(4, 6, 2, [[2, 1], [3, 1]], 500, 510, ts), 0);
    const { d } = nuSubsetEnvelope(makeNuInstance(4, 6, 519, [0, 0, 0]));
    const tStar = (d[6]! - d[1]!) / (2.5 - 1.2);
    assert.ok(Math.abs(tStar - 0.17) < 1e-9, `t* ${tStar}`);
    const ray = nuRay(4, 6, 519, [2.5, 0.6, 0.6], [0, tStar - 1e-6, tStar + 1e-6, 8]);
    assert.equal(ray[0]!.count, 2);
    assert.equal(ray[1]!.count, 2);
    assert.equal(ray[2]!.count, 1, "the dominant pair takes over — the count DESCENDS");
    assert.equal(ray[3]!.count, 2, "and re-ascends on a different pair set");
  });

  it("PL20: exact rational breakpoints — flips sharp at ±1e-6, argmax === enumerated count, check clean", () => {
    let worstFlip = 0;
    let worstArgmax = 0;
    for (const [m, n, k] of [
      [4, 6, 2],
      [5, 7, 2],
      [6, 8, 3],
    ] as const) {
      const cell = staircaseCell(m, n, 500, k);
      assert.deepEqual(staircaseCheck(cell), []);
      for (const b of cell.breaks) assert.ok(b > 0 && Number.isFinite(b));
      worstFlip = Math.max(worstFlip, staircaseFlipDeviation(cell));
      worstArgmax = Math.max(
        worstArgmax,
        staircaseArgmaxMismatch(m, n, 500, k, [0, 0.001, 0.05, 0.1, 0.2, 0.5, 1, 2, 4, 8]).worst,
      );
    }
    assert.equal(worstFlip, 0);
    assert.equal(worstArgmax, 0);
  });

  it("PL20: exact ties are real on this family and the identity is tie-aware (seed 1500: C_1 === C_2)", () => {
    const cell = staircaseCell(5, 7, 1500, 2);
    assert.equal(cell.cThou[1], cell.cThou[2], "the known exact C-tie");
    const r = staircaseArgmaxMismatch(5, 7, 1500, 2, [0]);
    assert.ok(r.ties >= 1, "λ=0 must be scored as a tie");
    assert.equal(r.worst, 0, "and the enumerated count must lie in the tied set");
  });
});

describe("the board and the witnesses", () => {
  it("board legal (L1-L4)", () => {
    assert.deepEqual(checkBoard(), []);
  });

  it("all witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.ok, `${w.witness}: ${w.detail}`);
  });
});

describe("smuggling trials — every law bites", () => {
  const base = BOARD[0]!;
  const forged = (o: Partial<BoardRow>): BoardRow => ({ ...base, ...o });

  it("L1: unknown face rejected", () => {
    const v = checkBoard([forged({ id: "SM1", face: "poetry" as never })]);
    assert.ok(v.some((x) => x.law === "L1" && x.row === "SM1"));
  });

  it("L2: EXACT with unknown witness rejected", () => {
    const v = checkBoard([forged({ id: "SM2", witness: "W-Z" })]);
    assert.ok(v.some((x) => x.law === "L2" && x.row === "SM2"));
  });

  it("L2: DATA without horizon rejected", () => {
    const v = checkBoard([forged({ id: "SM3", exactness: "DATA", price: "numbers without scope" })]);
    assert.ok(v.some((x) => x.law === "L2" && x.row === "SM3"));
  });

  it("L2: QUOTED without anchor rejected", () => {
    const v = checkBoard([forged({ id: "SM4", exactness: "QUOTED", anchors: [] })]);
    assert.ok(v.some((x) => x.law === "L2" && x.row === "SM4"));
  });

  it("L3: dead anchor rejected by name", () => {
    const v = checkBoard([forged({ id: "SM5", anchors: ["atlantis"] })]);
    assert.ok(v.some((x) => x.law === "L3" && x.detail.includes("atlantis")));
  });

  it("L4: duplicate id rejected", () => {
    const v = checkBoard([forged({ id: "PL1" }), forged({ id: "PL1" })]);
    assert.ok(v.some((x) => x.law === "L4"));
  });

  it("the renderer refuses an illegal board, naming the law", async () => {
    const { renderBoard } = await import("../src/experiments/render.js");
    assert.throws(() => renderBoard([forged({ id: "SM9", face: "poetry" as never })]), /SM9 \[L1\]/);
  });

  it("v0.5.0 SM10: a forged breakpoint table is named and rejected by its own C-vector", () => {
    const real = staircaseCell(6, 8, 500, 3);
    assert.deepEqual(staircaseCheck(real), []);
    // counterfeit 1: nudge one breakpoint
    const nudged: StaircaseCell = {
      ...real,
      breaks: real.breaks.map((b, i) => (i === 0 ? b + 0.5 : b)),
    };
    const v1 = staircaseCheck(nudged);
    assert.ok(v1.some((x) => x.includes("counterfeit breakpoint") && x.includes("6×8") && x.includes("k=3")), v1.join("; "));
    // counterfeit 2: drop a level (hide a step of the staircase)
    const clipped: StaircaseCell = { ...real, levels: real.levels.slice(0, -1), breaks: real.breaks.slice(0, -1) };
    const v2 = staircaseCheck(clipped);
    assert.ok(v2.some((x) => x.includes("counterfeit levels")), v2.join("; "));
    // counterfeit 3: descending levels — a staircase that cannot exist (the
    // hull-consistency branch catches it first: an inverted list is never the
    // hull — either way it is named and rejected)
    const inverted: StaircaseCell = { ...real, levels: [...real.levels].reverse(), breaks: [...real.breaks].reverse() };
    const v3 = staircaseCheck(inverted);
    assert.ok(v3.length > 0 && v3.every((x) => x.includes("6×8") && x.includes("k=3")), v3.join("; "));
    assert.ok(v3.some((x) => x.includes("counterfeit levels") || x.includes("not strictly ascending")), v3.join("; "));
  });

  it("v0.5.0 SM11: an SA log claiming a tour it never validated is named and rejected", () => {
    const inst = makeKPairInstance(4, 6, 500, 0.9, 2);
    const honest = kPairAnneal(inst, 42);
    assert.equal(checkSaLog(inst, { tour: honest, claimedWelfare: kPairWelfareOf(inst, honest) }), null);
    // counterfeit 1: a tour that reuses an agent
    const reuse = [...honest];
    reuse[1] = reuse[0]!;
    const v1 = checkSaLog(inst, { tour: reuse, claimedWelfare: 99 });
    assert.ok(v1?.includes("counterfeit tour") && v1?.includes("reused"), String(v1));
    // counterfeit 2: an agent index outside the instance
    const invented = [...honest];
    invented[2] = 42;
    const v2 = checkSaLog(inst, { tour: invented, claimedWelfare: 99 });
    assert.ok(v2?.includes("out of range"), String(v2));
    // counterfeit 3: an honest tour with an INFLATED claimed welfare
    const v3 = checkSaLog(inst, { tour: honest, claimedWelfare: kPairWelfareOf(inst, honest) + 0.5 });
    assert.ok(v3?.includes("welfare inflation"), String(v3));
    // and the scorer itself refuses to score a counterfeit tour (naming the agent)
    assert.throws(() => kPairWelfareOf(inst, reuse), /counterfeit tour rejected: agent \d+ reused/);
  });

  it("v0.5.0 SM12: a counterfeit density census row is named and rejected against its own rates", () => {
    const honest = densityCampaign([[5, 7]], [1, 2], 6, [0, 1, 2, 4]);
    assert.deepEqual(densityTableViolations(honest, [0, 1, 2, 4]), []);
    const base = honest.find((c) => c.k === 2 && c.solver === "anneal")!;
    // counterfeit 1: claim an up-cross the rates never produce
    const fakeUp: DensityCell = { ...base, upCross: 3.0 };
    const v1 = densityTableViolations([fakeUp], [0, 1, 2, 4]);
    assert.ok(v1.some((x) => x.includes("5×7 k=2 anneal") && x.includes("up-cross")), v1.join("; "));
    // counterfeit 2: bury the minimum (claim the min is as good as λ=0 and
    // sits at the last column — the table disagrees wherever its true min is)
    const fakeMin: DensityCell = { ...base, minRate: 1, minLambda: 4 };
    const v2 = densityTableViolations([fakeMin], [0, 1, 2, 4]);
    assert.ok(v2.length > 0 && v2.every((x) => x.includes("5×7 k=2 anneal")), v2.join("; "));
    assert.ok(v2.some((x) => x.includes("claimed min") || x.includes("λ at min")), v2.join("; "));
    // counterfeit 3: a rate that no seed count could ever quantize to
    const fakeRate: DensityCell = { ...base, hitRates: [0.33, ...base.hitRates.slice(1)] };
    const v3 = densityTableViolations([fakeRate], [0, 1, 2, 4]);
    assert.ok(v3.some((x) => x.includes("not quantized")), v3.join("; "));
  });
});

describe("entry guard", () => {
  it("importing the renderer writes nothing", async () => {
    const dir = resolve(process.cwd(), "out", "reports");
    const before = existsSync(dir) ? readdirSync(dir).join(",") : "";
    await import("../src/experiments/render.js");
    const after = existsSync(dir) ? readdirSync(dir).join(",") : "";
    assert.equal(after, before);
  });
});
