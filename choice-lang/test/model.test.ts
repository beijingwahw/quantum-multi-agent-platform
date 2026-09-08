import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkModel, runWitnesses } from "../src/kernel/audit.js";
import { MODEL, type ModelRow } from "../src/kernel/ledger.js";
import { runProgram, conditionOnPattern, controlState, branchProduct, membershipExpectation, type Program } from "../src/kernel/lang.js";
import {
  concatProgram,
  registerPattern,
  node,
  leaf,
  termPaths,
  termIsometry,
  conditionTermOnPath,
  type Term,
} from "../src/kernel/compose.js";
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
