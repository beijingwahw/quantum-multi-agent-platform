import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  certifyUntilInSet,
  composedSetToll,
  crossExamineSetTollLaw,
  measuredPatternSetWeight,
  measuredTermLeafSetWeight,
  patternSetWeight,
  setToll,
  termLeafSetWeight,
  composedPatternSet,
  type Pattern,
} from "../src/kernel/toll.js";
import {
  conditionOnPattern,
  runProgram,
  type Program,
} from "../src/kernel/lang.js";
import { iteratedProgram } from "../src/kernel/iterate.js";
import {
  node,
  leaf,
  registerPattern,
  type Term,
} from "../src/kernel/compose.js";
import { ChoiceLangError } from "../src/core/errors.js";
import { engineeredUnitary, worldState } from "../src/kernel/fixtures.js";
import { mat } from "../src/core/cmat.js";

function perpendicularState() {
  const m = mat(4, 4);
  m.re[1 * 4 + 1] = 1;
  return m;
}

/** The rejection cross-examination: a named code, and a message that names the crime. */
function assertRejects(fn: () => unknown, code: string, needle: RegExp): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(
      err instanceof ChoiceLangError,
      `expected a ChoiceLangError, got ${String(err)}`,
    );
    assert.equal(err.code, code);
    assert.match(err.message, needle);
    return true;
  });
}

const p2: Program = [
  { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
  { theta: 1.0, u0: engineeredUnitary(9), u1: engineeredUnitary(10) },
];
/** the XOR set — the two patterns that disagree */
const xorSet: Pattern[] = [
  [0, 1],
  [1, 0],
];
const triSet: Pattern[] = [
  [0, 0],
  [0, 1],
  [1, 0],
];

describe("C1 the set face of the certification toll", () => {
  it("the closed form and the measured run agree, on two states (state-independence)", () => {
    for (const set of [xorSet, triSet]) {
      const closed = patternSetWeight(p2, set);
      const measuredWorld = measuredPatternSetWeight(p2, set, worldState());
      const measuredPerp = measuredPatternSetWeight(
        p2,
        set,
        perpendicularState(),
      );
      assert.ok(
        Math.abs(closed - measuredWorld) < 1e-15,
        `closed ${closed} vs world ${measuredWorld}`,
      );
      assert.ok(
        Math.abs(closed - measuredPerp) < 1e-15,
        `closed ${closed} vs perp ${measuredPerp}`,
      );
    }
  });

  it("the attempt count is geometric: MC mean and variance hit 1/W and (1-W)/W^2", () => {
    const toll = setToll(p2, xorSet);
    const mc = certifyUntilInSet(p2, xorSet, 200_000, 4242);
    assert.ok(
      Math.abs(mc.mean - toll.meanAttempts) <= 0.02 * toll.meanAttempts,
      `mean ${mc.mean} vs ${toll.meanAttempts}`,
    );
    assert.ok(
      Math.abs(mc.variance - toll.variance) <= 0.04 * toll.variance,
      `variance ${mc.variance} vs ${toll.variance}`,
    );
    // the whole law, not just its first two moments: the pmf legs
    for (let k = 1; k <= 6; k++) {
      const closed = toll.w * (1 - toll.w) ** (k - 1);
      const legTol = Math.max(
        0.02 * closed,
        4 * Math.sqrt(Math.max(closed * (1 - closed), 1e-9) / mc.trials),
      );
      assert.ok(
        Math.abs(mc.pmf[k - 1]! - closed) <= legTol,
        `pmf[${k}] ${mc.pmf[k - 1]} vs ${closed}`,
      );
    }
  });

  it("SET-COMP: W_{P++Q}(A x B) = W_P(A)·W_Q(B), closed and measured", () => {
    const q2: Program = [
      { theta: 0.35, u0: engineeredUnitary(300), u1: engineeredUnitary(301) },
      { theta: 0.8, u0: engineeredUnitary(302), u1: engineeredUnitary(303) },
    ];
    const aP: Pattern[] = [
      [1, 0],
      [0, 1],
    ];
    const aQ: Pattern[] = [
      [0, 0],
      [1, 1],
    ];
    const { partP, partQ, composed } = composedSetToll(p2, q2, aP, aQ);
    assert.ok(Math.abs(composed - partP * partQ) < 1e-15);
    const measured = measuredPatternSetWeight(
      [...p2, ...q2],
      composedPatternSet(aP, aQ),
      worldState(),
    );
    assert.ok(
      Math.abs(measured - composed) < 1e-15,
      `measured ${measured} vs closed ${composed}`,
    );
  });

  it("the single-point specialization IS the existing law: T-MULT and L-TOLL as W({pt})", () => {
    // T-MULT (R9): the parts' weights multiply to the composed point weight
    const one: Program = [
      { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
    ];
    const two: Program = [
      { theta: 1.0, u0: engineeredUnitary(9), u1: engineeredUnitary(10) },
    ];
    const { partP, partQ, composed } = composedSetToll(
      one,
      two,
      [[0]] as Pattern[],
      [[1]] as Pattern[],
    );
    const directP = conditionOnPattern(
      runProgram(one, worldState()),
      1,
      registerPattern([0]),
      4,
    ).p;
    const directQ = conditionOnPattern(
      runProgram(two, worldState()),
      1,
      registerPattern([1]),
      4,
    ).p;
    assert.ok(
      Math.abs(partP - directP) < 1e-15 && Math.abs(partQ - directQ) < 1e-15,
    );
    assert.ok(
      Math.abs(composed - directP * directQ) < 1e-15,
      "the set law degenerates to T-MULT",
    );
    // L-TOLL (R11): the loop's set weight is the branch weight to the k-th power
    const body: Program = [
      { theta: 0.75, u0: engineeredUnitary(501), u1: engineeredUnitary(502) },
    ];
    const w = Math.sin(0.75) ** 2;
    const loopSet: Pattern[] = [Array.from({ length: 5 }, () => 1)];
    const loopToll = setToll(iteratedProgram(body, 5), loopSet);
    assert.ok(
      Math.abs(loopToll.w - w ** 5) < 1e-15,
      "W(body^k) = w^k — L-TOLL",
    );
    assert.ok(Math.abs(loopToll.meanAttempts - (1 / w) ** 5) < 1e-9);
  });

  it("SET-NEST: a leaf set's weight is its arrival probability, closed and measured", () => {
    const A = engineeredUnitary(401);
    const B = engineeredUnitary(402);
    const C = engineeredUnitary(403);
    const t: Term = node(0.7, node(1.1, leaf(A), leaf(B)), leaf(C));
    const keepB = (u: unknown) => u === B; // ONE object, reference identity
    const closed = termLeafSetWeight(t, keepB);
    const measured = measuredTermLeafSetWeight(t, worldState(), keepB);
    assert.ok(
      Math.abs(closed - measured) < 1e-15,
      `closed ${closed} vs measured ${measured}`,
    );
    // the closed form is the honest product: cos^2(0.7)·sin^2(1.1)·1 (B is a leaf)
    assert.ok(
      Math.abs(closed - Math.cos(0.7) ** 2 * Math.sin(1.1) ** 2) < 1e-15,
    );
    // partition of unity over the leaf SETS: keep + complement = 1 exactly
    const all = termLeafSetWeight(t, () => true);
    const none = termLeafSetWeight(t, () => false);
    assert.ok(Math.abs(all - 1) < 1e-15 && none === 0);
  });

  it("the smuggling trials: counterfeit set laws are named and convicted, the true law passes", () => {
    const one: Program = [
      { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
    ];
    const two: Program = [
      { theta: 1.0, u0: engineeredUnitary(9), u1: engineeredUnitary(10) },
    ];
    const args = [one, two, [[0]] as Pattern[], [[1]] as Pattern[]] as const;
    const additive = crossExamineSetTollLaw(
      { id: "T-SET-ADD", composedOf: (wp, wq) => wp + wq },
      ...args,
    );
    assert.ok(additive.convicted);
    assert.match(additive.detail, /MULTIPLICATIVE/);
    const maxLaw = crossExamineSetTollLaw(
      { id: "T-SET-MAX", composedOf: (wp, wq) => Math.max(wp, wq) },
      ...args,
    );
    assert.ok(maxLaw.convicted, "max is not the machine's composed law either");
    const varForgery = crossExamineSetTollLaw(
      {
        id: "T-SET-VAR",
        composedOf: (wp, wq) => wp * wq,
        varianceOf: (w) => (1 - w) / w,
      },
      ...args,
    );
    assert.ok(
      varForgery.convicted,
      "the variance forgery must be caught even when the weight law is true",
    );
    assert.match(varForgery.detail, /\(1-W\)\/W\^2/);
    const trueLaw = crossExamineSetTollLaw(
      {
        id: "T-SET-TRUE",
        composedOf: (wp, wq) => wp * wq,
        varianceOf: (w) => (1 - w) / (w * w),
      },
      ...args,
    );
    assert.ok(!trueLaw.convicted, "the true law must pass its own court");
  });

  it("named rejections: the set boundary refuses what it cannot certify", () => {
    assertRejects(() => patternSetWeight(p2, []), "TOLL_EMPTY_SET", /empty/);
    assertRejects(
      () => patternSetWeight(p2, [[0]]),
      "TOLL_SET_ARITY",
      /1 bits but the program has 2/,
    );
    assertRejects(
      () =>
        patternSetWeight(p2, [
          [0, 1],
          [0, 1],
        ]),
      "TOLL_SET_DUPLICATE",
      /appears twice/,
    );
    assertRejects(
      () => patternSetWeight(p2, [[0, 2]] as unknown as Pattern[]),
      "PATTERN_ARITY",
      /bit 2 is 2, not 0 or 1/,
    );
    assertRejects(
      () => certifyUntilInSet(p2, xorSet, 0, 1),
      "TOLL_TRIALS",
      /trials must be a whole number/,
    );
    assertRejects(
      () => certifyUntilInSet(p2, xorSet, 1.5, 1),
      "TOLL_TRIALS",
      /whole number/,
    );
    // a fully dead set: theta = 0 kills the 1-branch, so {[1]} never fires
    const dead: Program = [
      { theta: 0, u0: engineeredUnitary(1), u1: engineeredUnitary(2) },
    ];
    assertRejects(() => setToll(dead, [[1]]), "TOLL_DEAD_SET", /dead set/);
    // the measured path names a dead MEMBER even when the set total is live
    const halfDead: Program = [
      { theta: 0, u0: engineeredUnitary(1), u1: engineeredUnitary(2) },
      { theta: 0.9, u0: engineeredUnitary(3), u1: engineeredUnitary(4) },
    ];
    assertRejects(
      () =>
        measuredPatternSetWeight(
          halfDead,
          [
            [0, 1],
            [1, 0],
          ],
          worldState(),
        ),
      "TOLL_DEAD_PATTERN",
      /dead member/,
    );
  });
});
