import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkXval, runWitnesses } from "../src/kernel/audit.js";
import { XVAL, type XvalRow } from "../src/kernel/ledger.js";
import { enumerateOptimum, instanceSet, makeRng, quboValue, runQaoa, uniformState, costTable, expectation, sampleWithReadoutNoise } from "../src/kernel/crossval.js";

function smuggle(mutate: (rows: XvalRow[]) => void): XvalRow[] {
  const copy = JSON.parse(JSON.stringify(XVAL)) as XvalRow[];
  mutate(copy);
  return copy;
}

describe("T1 the package is ready", () => {
  it("the checker passes on the real package", () => {
    assert.deepEqual(checkXval(), []);
  });

  it("all five witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the kernel machinery", () => {
  it("enumeration finds a planted optimum", () => {
    const base = { id: "planted", n: 6, kind: "coupled" as const, linear: [1, 2, 3, 4, 5, 6], coupling: [[1, 1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1], [1, 1], [1]] };
    const { optBits, optValue } = enumerateOptimum(base);
    assert.equal(optValue, quboValue({ ...base, optBits: 0, optValue: 0 }, 0b111111));
    assert.equal(optBits, 0b111111);
  });

  it("the uniform state is normalized and p=0 expectation equals the mean cost", () => {
    const inst = instanceSet().find((i) => i.id === "np-n8-0");
    assert.ok(inst);
    const psi = uniformState(inst.n);
    const dim = psi.length >> 1;
    let s = 0;
    for (let k = 0; k < dim; k++) s += psi[k]! * psi[k]!;
    assert.ok(Math.abs(s - 1) < 1e-12);
    const costs = costTable(inst);
    const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
    assert.ok(Math.abs(expectation(psi, costs) - mean) < 1e-12);
  });

  it("empty coupling rows cannot poison the value (the NaN guard)", () => {
    const inst = instanceSet().find((i) => i.kind === "linear");
    assert.ok(inst);
    for (let bits = 0; bits < 1 << inst.n; bits += 97) {
      assert.ok(Number.isFinite(quboValue(inst, bits)));
    }
  });

  it("zero-noise dry run reports observed === raw within MC error", () => {
    const inst = instanceSet().find((i) => i.id === "np-n8-0");
    assert.ok(inst);
    const psi = runQaoa(inst, { betas: [0.3], gammas: [0.7] });
    const r = sampleWithReadoutNoise(psi, inst.n, inst.optBits, 5000, 0, makeRng(3));
    assert.ok(Math.abs(r.rawHitRate - r.observedHitRate) < 0.02);
  });
});

describe("T3 smuggling trials — the package rejects contraband by name", () => {
  it("X1: an unpriced claim is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const hit = checkXval(contraband).find((v) => v.law === "X1");
    assert.ok(hit, "expected an X1 violation");
    assert.equal(hit.row, "X1");
  });

  it("X2: an unknown witness is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { witness: string }).witness = "W-TRUST";
    });
    const hit = checkXval(contraband).find((v) => v.law === "X2");
    assert.ok(hit, "expected an X2 violation");
  });

  it("X3: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[2] as { anchors: readonly string[] }).anchors = ["ghost-repo"];
    });
    const hit = checkXval(contraband).find((v) => v.law === "X3");
    assert.ok(hit, "expected an X3 violation");
  });

  it("X4: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { id: string }).id = "X1";
    });
    const hit = checkXval(contraband).find((v) => v.law === "X4");
    assert.ok(hit, "expected an X4 violation");
  });
});

describe("T4 the renderer refuses to print an illegal package", () => {
  it("the smuggled package fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const violations = checkXval(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[X1\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-xval-package.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});
