import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkModel, runWitnesses } from "../src/kernel/audit.js";
import { MODEL, type ModelRow } from "../src/kernel/ledger.js";
import { runProgram, conditionOnPattern, controlState } from "../src/kernel/lang.js";
import { engineeredUnitary, randomBranchUnitary, worldState, DATA_DIM } from "../src/kernel/fixtures.js";
import { isUnitary } from "../src/core/cmat.js";

function smuggle(mutate: (rows: ModelRow[]) => void): ModelRow[] {
  const copy = JSON.parse(JSON.stringify(MODEL)) as ModelRow[];
  mutate(copy);
  return copy;
}

/** A writable view of ModelRow — smuggling deliberately mutates what the model declares read-only. */
type WritableModelRow = { -readonly [K in keyof ModelRow]: ModelRow[K] };

describe("T1 the model holds", () => {
  it("the checker passes on the real model", () => {
    assert.deepEqual(checkModel(), []);
  });

  it("all five witnesses pass", () => {
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
