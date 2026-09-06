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
