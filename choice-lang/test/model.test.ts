import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkModel, runWitnesses } from "../src/kernel/audit.js";
import { MODEL, type ModelRow } from "../src/kernel/ledger.js";
import { runProgram, runOnRegister, conditionOnPattern, controlState, branchProduct, membershipExpectation, type Program } from "../src/kernel/lang.js";
import {
  concatProgram,
  registerPattern,
  node,
  leaf,
  termPaths,
  termIsometry,
  pathSlotPattern,
  conditionTermOnPath,
  type Term,
} from "../src/kernel/compose.js";
import { ChoiceLangError } from "../src/core/errors.js";
import { loopTrajectory, iteratedProgram } from "../src/kernel/iterate.js";
import { gameCensus, lockCensus, ADVERSARY_THETA } from "../src/kernel/game.js";
import { engineeredUnitary, randomBranchUnitary, worldState, worldProjector, DATA_DIM } from "../src/kernel/fixtures.js";
import { identity, isUnitary, mat, mDagger, mMul } from "../src/core/cmat.js";

function smuggle(mutate: (rows: ModelRow[]) => void): ModelRow[] {
  const copy = JSON.parse(JSON.stringify(MODEL)) as ModelRow[];
  mutate(copy);
  return copy;
}

/** A writable view of ModelRow — smuggling deliberately mutates what the model declares read-only. */
type WritableModelRow = { -readonly [K in keyof ModelRow]: ModelRow[K] };

function matDev(a: { re: Float64Array; im: Float64Array }, b: { re: Float64Array; im: Float64Array }): number {
  let d = 0;
  for (let k = 0; k < a.re.length; k++) {
    d = Math.max(d, Math.abs(a.re[k]! - b.re[k]!), Math.abs(a.im[k]! - b.im[k]!));
  }
  return d;
}

function perpendicularState() {
  const m = mat(4, 4);
  m.re[1 * 4 + 1] = 1;
  return m;
}

/** The rejection cross-examination: a named code, and a message that names the crime. */
function assertRejects(fn: () => unknown, code: string, needle: RegExp): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ChoiceLangError, `expected a ChoiceLangError, got ${String(err)}`);
    assert.equal(err.code, code);
    assert.match(err.message, needle);
    return true;
  });
}

describe("T1 the model holds", () => {
  it("the checker passes on the real model", () => {
    assert.deepEqual(checkModel(), []);
  });

  it("all nine witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the language machinery", () => {
  it("branch unitaries are unitary (engineered and random families)", () => {
    for (const seed of [1, 2, 3]) {
      assert.ok(isUnitary(engineeredUnitary(seed), 1e-12));
      assert.ok(isUnitary(randomBranchUnitary(seed + 50), 1e-12));
    }
  });

  it("a single choose leaves the control marginal exactly the prepared state", () => {
    const rho0 = worldState();
    const theta = 0.9;
    const steps = [{ theta, u0: engineeredUnitary(61), u1: engineeredUnitary(62) }];
    const fin = runProgram(steps, rho0);
    // the control's cross-term is scaled by Tr[U0 rho U1dag] when the branches
    // act differently — that scaling is HOW a control can carry information
    // (the replacer pair's mechanism). The invariant is the DIAGONAL: the
    // outcome probabilities cos^2(th) / sin^2(th), untouched by routing.
    const prepared = controlState(theta);
    const diag = (c: number): number => {
      let s = 0;
      for (let j = 0; j < 4; j++) s += fin.re[(c * 4 + j) * 8 + (c * 4 + j)]!;
      return s;
    };
    assert.ok(Math.abs(diag(0) - prepared.re[0]!) < 1e-15);
    assert.ok(Math.abs(diag(1) - prepared.re[3]!) < 1e-15);
  });

  it("conditioning on all patterns reconstitutes the full state (partition of unity)", () => {
    const rho0 = worldState();
    const steps = [
      { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
      { theta: 1.0, u0: randomBranchUnitary(9), u1: randomBranchUnitary(10) },
    ];
    const fin = runProgram(steps, rho0);
    let psum = 0;
    for (const b0 of [0, 1] as const) {
      for (const b1 of [0, 1] as const) {
        const { p } = conditionOnPattern(fin, 2, [b0, b1], DATA_DIM);
        psum += p;
      }
    }
    assert.ok(Math.abs(psum - 1) < 1e-14);
  });
});

describe("T3 smuggling trials — the model rejects contraband by name", () => {
  it("P1: a claim without a program family is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { family: string }).family = "whatever";
    });
    const hit = checkModel(contraband).find((v) => v.law === "P1");
    assert.ok(hit, "expected a P1 violation");
    assert.equal(hit.row, "R2");
  });

  it("P2: an unwitnessed exactness is hearsay, rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { witness: string }).witness = "W-TRUST";
    });
    const hit = checkModel(contraband).find((v) => v.law === "P2");
    assert.ok(hit, "expected a P2 violation");
    assert.match(hit.detail, /W-TRUST/);
  });

  it("P2: physics-verdict words are not in this repo's vocabulary", () => {
    const contraband = smuggle((rows) => {
      (rows[5] as { exactness: string }).exactness = "MECHANISM-SETTLED";
    });
    const hit = checkModel(contraband).find((v) => v.law === "P2");
    assert.ok(hit, "expected a P2 violation");
    assert.match(hit.detail, /no physics-verdict words/);
  });

  it("P3: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[2] as WritableModelRow).anchors = ["ghost-repo"];
    });
    const hit = checkModel(contraband).find((v) => v.law === "P3");
    assert.ok(hit, "expected a P3 violation");
    assert.match(hit.detail, /ghost-repo/);
  });

  it("P4: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[4] as { id: string }).id = "R1";
    });
    const hit = checkModel(contraband).find((v) => v.law === "P4");
    assert.ok(hit, "expected a P4 violation");
  });
});

describe("T4 the renderer refuses to print an illegal model", () => {
  it("the smuggled model fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { family: string }).family = "naked";
    });
    const violations = checkModel(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[P1\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-choice-model.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});

describe("T5 sequential composition — choose after choose", () => {
  const p: Program = [
    { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
    { theta: 1.0, u0: randomBranchUnitary(9), u1: randomBranchUnitary(10) },
  ];
  const q: Program = [
    { theta: 0.35, u0: engineeredUnitary(300), u1: randomBranchUnitary(301) },
    { theta: 0.8, u0: engineeredUnitary(302), u1: engineeredUnitary(303) },
  ];
  const pBits: ReadonlyArray<0 | 1> = [1, 0]; // step order — the register is NEWEST-first
  const qBits: ReadonlyArray<0 | 1> = [0, 1];

  it("S1: composed pattern weights are the product measure, state-independent", () => {
    const partP = conditionOnPattern(runProgram(p, worldState()), 2, registerPattern(pBits), DATA_DIM);
    const partQ = conditionOnPattern(runProgram(q, worldState()), 2, registerPattern(qBits), DATA_DIM);
    const composedPat: ReadonlyArray<0 | 1> = [...registerPattern(qBits), ...registerPattern(pBits)];
    const direct = conditionOnPattern(runProgram(concatProgram(p, q), worldState()), 4, composedPat, DATA_DIM);
    const directPerp = conditionOnPattern(runProgram(concatProgram(p, q), perpendicularState()), 4, composedPat, DATA_DIM);
    assert.ok(Math.abs(direct.p - partP.p * partQ.p) < 1e-15);
    assert.ok(Math.abs(directPerp.p - partP.p * partQ.p) < 1e-15);
  });

  it("S2: conditioning chains — condition P then run-and-condition Q equals conditioning P++Q", () => {
    const partP = conditionOnPattern(runProgram(p, worldState()), 2, registerPattern(pBits), DATA_DIM);
    const partQ = conditionOnPattern(runProgram(q, worldState()), 2, registerPattern(qBits), DATA_DIM);
    const direct = conditionOnPattern(
      runProgram(concatProgram(p, q), worldState()),
      4,
      [...registerPattern(qBits), ...registerPattern(pBits)],
      DATA_DIM,
    );
    const chained = conditionOnPattern(runProgram(q, partP.conditional), 2, registerPattern(qBits), DATA_DIM);
    // the chain's own weight is the second part's standalone weight (state-independent)...
    assert.ok(Math.abs(chained.p - partQ.p) < 1e-15);
    // ...and the chain's weights MULTIPLY to the composed weight
    assert.ok(Math.abs(chained.p * partP.p - direct.p) < 1e-15);
    assert.ok(matDev(chained.conditional, direct.conditional) < 1e-15);
  });

  it("S3: denotation products associate across parenthesizations at the floor", () => {
    const uP = branchProduct(p, pBits);
    const uQ = branchProduct(q, qBits);
    const flat = branchProduct(concatProgram(p, q), [...pBits, ...qBits]);
    assert.ok(matDev(mMul(uQ, uP), flat) <= 2e-16); // den(Q)*den(P) = the flat denotation
    assert.ok(matDev(mMul(mMul(uQ, identity(DATA_DIM)), uP), flat) <= 2e-16); // regrouped product
  });
});

describe("T6 nested composition — choose inside choose", () => {
  const theta1 = 0.7;
  const theta2 = 1.1;
  // ONE object per leaf, shared by both nestings — N2's "same leaves" is an
  // identity claim about the same unitaries, not a value coincidence
  const A = engineeredUnitary(401);
  const B = engineeredUnitary(402);
  const C = engineeredUnitary(403);
  const left: Term = node(theta1, node(theta2, leaf(A), leaf(B)), leaf(C));
  const right: Term = node(theta1, leaf(A), node(theta2, leaf(B), leaf(C)));
  const deep: Term = node(0.5, node(0.6, leaf(engineeredUnitary(601)), node(0.7, leaf(engineeredUnitary(602)), leaf(engineeredUnitary(603)))), leaf(engineeredUnitary(604)));

  it("the term's execution is an isometry for both nestings and a deeper tree", () => {
    for (const t of [left, right, deep]) {
      const v = termIsometry(t, DATA_DIM);
      assert.ok(matDev(mMul(mDagger(v), v), identity(DATA_DIM)) < 1e-15, "V-dagger V must be the identity");
      const proj = mMul(v, mDagger(v)); // V V-dagger is a projector of rank d
      assert.ok(matDev(mMul(proj, proj), proj) < 1e-12, "V V-dagger must be idempotent");
      let tr = 0;
      for (let i = 0; i < proj.rows; i++) tr += proj.re[i * proj.rows + i]!;
      assert.ok(Math.abs(tr - DATA_DIM) < 1e-12, "V V-dagger must have rank d");
    }
  });

  it("N1: every live path of both nestings conditions to its leaf unitary, weighted (context-freedom)", () => {
    const rho0 = worldState();
    let worst = 0;
    for (const t of [left, right, deep]) {
      for (const path of termPaths(t)) {
        const { p, conditional } = conditionTermOnPath(t, rho0, path.bits);
        const denoted = mMul(mMul(path.leafUnitary, rho0), mDagger(path.leafUnitary));
        worst = Math.max(worst, Math.abs(p - path.weight), matDev(conditional, denoted));
      }
    }
    assert.ok(worst < 1e-15);
    // the subtree's standalone numbers survive in context: the embedded/standalone
    // weight ratio is the SAME context factor on every path under the context
    const sub = node(theta2, leaf(engineeredUnitary(401)), leaf(engineeredUnitary(402)));
    const subA = conditionTermOnPath(sub, rho0, [0]);
    const leftA = conditionTermOnPath(left, rho0, [0, 0]);
    const leftB = conditionTermOnPath(left, rho0, [0, 1]);
    assert.ok(Math.abs(leftA.p / subA.p - Math.cos(theta1) ** 2) < 1e-15);
    assert.ok(Math.abs(leftB.p / (1 - subA.p) - Math.cos(theta1) ** 2) < 1e-15);
  });

  it("N2: the nestings denote the same products but price them differently (the honest negative)", () => {
    const lp = termPaths(left);
    const rp = termPaths(right);
    assert.equal(lp.length, rp.length);
    assert.ok(lp.every((path, i) => path.leafUnitary === rp[i]!.leafUnitary), "common leaves must carry the same unitaries");
    const gapA = Math.abs(lp[0]!.weight - rp[0]!.weight);
    assert.ok(Math.abs(gapA - Math.cos(theta1) ** 2 * Math.sin(theta2) ** 2) < 1e-15, "gap must equal the closed form");
    assert.ok(Math.abs(rp[0]!.weight - Math.cos(theta1) ** 2) < 1e-15, "right tree prices A at cos^2(t1) alone");
    assert.ok(gapA > 0.46 && gapA < 0.47, "the pricing gap is order 1/2, not a rounding artifact");
  });
});

describe("T7 the bounded loop — choose iterated", () => {
  const body: Program = [{ theta: 0.75, u0: engineeredUnitary(501), u1: engineeredUnitary(502) }];

  it("L-TELE: the charge ledger telescopes at the floor, and the layered runner IS the flat semantics", () => {
    const piW = worldProjector();
    const traj = loopTrajectory(body, worldState(), 5, piW);
    const maxDelta = Math.max(...traj.deltas.map(Math.abs));
    const total = Math.abs(traj.membership[5]! - traj.membership[0]!);
    assert.ok(maxDelta <= 3e-16, "per-iteration deltas must sit at the rounding floor");
    assert.ok(total <= 3e-16, "the total drift must not accumulate the floors");
    assert.ok(traj.telescopeResidual <= 1e-15, "the deltas must telescope to final-minus-initial");
    // the layered loop and the flat k-fold program are the same computation
    const flat = membershipExpectation(runProgram(iteratedProgram(body, 5), worldState()), piW, DATA_DIM);
    assert.ok(Math.abs(flat - traj.membership[5]!) < 1e-15);
  });

  it("the flat runner and the layered runner are ONE fold (wave 4's single-sourcing), bit-identical", () => {
    // before wave 4, runProgram (lang.ts) and runOnRegister's loop (compose.ts)
    // were line-identical twins; now the flat runner delegates to the one fold.
    // This anchor pins the unification at BIT level: identical Float64Arrays,
    // not just agreement at a tolerance.
    const twoStep: Program = [
      { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
      { theta: 1.0, u0: randomBranchUnitary(9), u1: randomBranchUnitary(10) },
    ];
    const layered = runOnRegister(twoStep, worldState(), 0);
    const viaFold = runProgram(twoStep, worldState());
    assert.equal(layered.controls, 2);
    assert.deepEqual(viaFold.re, layered.reg.re);
    assert.deepEqual(viaFold.im, layered.reg.im);
    // and mid-register (the loop/game entry): controls carried in front
    const mid = runOnRegister(twoStep.slice(0, 1), worldState(), 0).reg;
    const resumed = runOnRegister(twoStep.slice(1), mid, 1);
    const whole = runProgram(twoStep, worldState());
    assert.deepEqual(resumed.reg.re, whole.re);
    assert.deepEqual(resumed.reg.im, whole.im);
  });

  it("L-TOLL: the k-fold certification weight is w^k exactly", () => {
    const w = Math.sin(0.75) ** 2;
    const { p } = conditionOnPattern(runProgram(iteratedProgram(body, 5), worldState()), 5, Array<1>(5).fill(1), DATA_DIM);
    assert.ok(Math.abs(p - w ** 5) < 1e-15);
    assert.ok(Math.abs(1 / w ** 5 - (1 / w) ** 5) < 1e-9, "1/w^k and (1/w)^k are the same toll");
  });
});

describe("T8 two players — the bounded census", () => {
  const first: Program = [{ theta: 0.8, u0: engineeredUnitary(210), u1: engineeredUnitary(211) }];

  it("the toll is branch-blind in every cell; the engineered answer locks the charge", () => {
    const piW = worldProjector();
    const attack = gameCensus(first, [1], 1, worldState(), piW);
    assert.equal(attack.length, 24);
    const wTarget = Math.sin(0.8) ** 2 * Math.sin(ADVERSARY_THETA) ** 2;
    for (const cell of attack) {
      assert.ok(Math.abs(cell.patternWeight - wTarget) < 1e-15, "every strategy must face the same price");
    }
    assert.ok(Math.abs(attack[0]!.afterFirst - 1) < 1e-12, "the engineered first move conserves the charge");
    const fins = attack.map((c) => c.final);
    assert.ok(Math.min(...fins) < 0.3 && Math.max(...fins) > 0.6, "the attack census must spread the charge (data)");
    const locks = lockCensus(first, worldState(), piW);
    for (const r of locks) {
      assert.ok(Math.abs(r.final - r.afterAdversary) < 1e-15, "the engineered answer locks whatever the adversary left");
    }
  });
});

describe("T9 smuggling trials — composition contraband named and rejected", () => {
  it("P5: a counterfeit composition identity (associative pricing) is rejected by name", () => {
    const contraband = smuggle((rows) => {
      (rows[6] as WritableModelRow).cites = ["S1", "ASSOC-PRICE"];
    });
    const hit = checkModel(contraband).find((v) => v.law === "P5");
    assert.ok(hit, "expected a P5 violation");
    assert.equal(hit.row, "R7");
    assert.match(hit.detail, /ASSOC-PRICE/);
    assert.match(hit.detail, /N2/, "the rejection must name the true law's counterexample");
  });

  it("P5: a fake toll law (additive toll) is rejected, the multiplicative law named", () => {
    const contraband = smuggle((rows) => {
      (rows[8] as WritableModelRow).cites = ["T-MULT", "T-ADD"];
    });
    const hit = checkModel(contraband).find((v) => v.law === "P5");
    assert.ok(hit, "expected a P5 violation");
    assert.equal(hit.row, "R9");
    assert.match(hit.detail, /T-ADD/);
    assert.match(hit.detail, /MULTIPLICATIVE/);
  });

  it("P5: an unknown law id is rejected with the registry listed", () => {
    const contraband = smuggle((rows) => {
      (rows[7] as WritableModelRow).cites = ["S9"];
    });
    const hit = checkModel(contraband).find((v) => v.law === "P5");
    assert.ok(hit, "expected a P5 violation");
    assert.equal(hit.row, "R8");
    assert.match(hit.detail, /registry/);
    assert.match(hit.detail, /S1/, "the rejection must list the verified registry");
  });
});

describe("T10 smuggling trials — illegal inputs at the language boundary named and rejected", () => {
  const twoStep: Program = [
    { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
    { theta: 1.0, u0: randomBranchUnitary(9), u1: randomBranchUnitary(10) },
  ];

  it("a short pattern for branchProduct is rejected — the old code silently routed through u0", () => {
    // convicted hole (wave 4): pattern[i] beyond the pattern's length read
    // undefined, and `undefined === 1` is false, so every out-of-range bit
    // silently chose u0 — a denotation nobody asked for
    assertRejects(() => branchProduct(twoStep, [1]), "PATTERN_ARITY", /2-step program needs exactly 2 pattern bits, got 1/);
    assertRejects(() => branchProduct(twoStep, [1, 0, 1]), "PATTERN_ARITY", /got 3/);
    assertRejects(() => branchProduct([], [1]), "EMPTY_PROGRAM", /empty program has no denotation/);
  });

  it("conditionOnPattern rejects wrong-arity patterns — extra bits are not silently ignored", () => {
    const fin = runProgram(twoStep, worldState());
    assertRejects(() => conditionOnPattern(fin, 2, [1], DATA_DIM), "PATTERN_ARITY", /needs exactly 2 bits, got 1/);
    assertRejects(() => conditionOnPattern(fin, 2, [1, 0, 1], DATA_DIM), "PATTERN_ARITY", /got 3/);
  });

  it("conditioning on a probability-zero pattern is refused, not answered with silent zeros", () => {
    const zeroWeight: Program = [{ theta: 0, u0: engineeredUnitary(1), u1: engineeredUnitary(2) }];
    const fin = runProgram(zeroWeight, worldState()); // sin^2(0) = 0 for pattern [1]
    assertRejects(() => conditionOnPattern(fin, 1, [1], DATA_DIM), "ZERO_PROBABILITY", /probability 0/);
    // the legal boundary still conditions (cos^2(0) = 1 for pattern [0])
    const legal = conditionOnPattern(fin, 1, [0], DATA_DIM);
    assert.ok(Math.abs(legal.p - 1) < 1e-15);
  });

  it("branch unitaries of the wrong dimension are named at the step (the dimension-slot family)", () => {
    const small: Program = [{ theta: 0.5, u0: identity(2), u1: identity(2) }];
    assertRejects(() => runProgram(small, worldState()), "BRANCH_SHAPE", /branches are 2x2/);
    // mid-program slot: step 2 sees an 8-dim register over 1 prior control,
    // so the branches must carry the data dimension 4 — not the joint 8
    const badSecond: Program = [
      { theta: 0.5, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
      { theta: 0.5, u0: identity(2), u1: identity(2) },
    ];
    assertRejects(() => runProgram(badSecond, worldState()), "BRANCH_SHAPE", /step 2 branches are 2x2.*data dimension 4/);
    assertRejects(() => runProgram([{ theta: 0.5, u0: mat(2, 3), u1: identity(4) }], worldState()), "BRANCH_SHAPE", /must be square/);
  });

  it("a non-finite control angle is rejected before it routes NaN through every branch", () => {
    const nanTheta: Program = [{ theta: Number.NaN, u0: engineeredUnitary(1), u1: engineeredUnitary(2) }];
    assertRejects(() => runProgram(nanTheta, worldState()), "STEP_THETA", /non-finite control angle/);
  });

  it("a wrong-dimension term leaf is not an isometry of the data register — rejected", () => {
    assertRejects(() => termIsometry(leaf(identity(2)), DATA_DIM), "LEAF_SHAPE", /a leaf must be 4x4/);
    // path/tree mismatches are named too
    const left: Term = node(0.7, node(1.1, leaf(engineeredUnitary(401)), leaf(engineeredUnitary(402))), leaf(engineeredUnitary(403)));
    assertRejects(() => pathSlotPattern(left, [0, 0, 0]), "PATH_OVERRUN", /path longer than tree/);
    assertRejects(() => pathSlotPattern(left, [0]), "PATH_SHORT", /path ended at a choose node/);
  });

  it("loop bounds and register arities are named (LOOP_BOUND, REGISTER_ARITY)", () => {
    const body: Program = [{ theta: 0.75, u0: engineeredUnitary(501), u1: engineeredUnitary(502) }];
    assertRejects(() => loopTrajectory(body, worldState(), 0, worldProjector()), "LOOP_BOUND", /k must be >= 1, got 0/);
    assertRejects(() => iteratedProgram(body, 0), "LOOP_BOUND", /k must be >= 1, got 0/);
    assertRejects(() => runOnRegister(body, worldState(), -1), "REGISTER_ARITY", /non-negative integer, got -1/);
    // an 8x8 rho over 2 claimed controls of 4-dim data would be 16-dimensional
    const single = runProgram(twoStep.slice(0, 1), worldState()); // 8x8 = 1 control over 4-dim data
    assertRejects(() => conditionOnPattern(single, 2, [0, 0], DATA_DIM), "REGISTER_ARITY", /2-control register over 4-dim data is 16-dimensional, but rho is 8x8/);
  });

  it("a short world projector and core shape mismatches are named, not turned into silent NaN", () => {
    assertRejects(() => membershipExpectation(worldState(), mat(2, 2), DATA_DIM), "PROJECTOR_SHAPE", /projector must be 4x4, got 2x2/);
    assertRejects(() => membershipExpectation(mat(3, 4), worldProjector(), DATA_DIM), "DATA_SHAPE", /must be square/);
    assertRejects(() => mMul(mat(2, 3), mat(2, 2)), "MAT_SHAPE", /shape mismatch 2x3 \* 2x2/);
  });
});
