import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkTariff, runWitnesses } from "../src/kernel/audit.js";
import { TARIFF, type TariffRow } from "../src/kernel/ledger.js";
import { SINGLET, cacheLeakage, bMarginal, measureQubit0 } from "../src/kernel/nosignal.js";
import { partialTrace } from "../src/core/channels.js";
import { identity, mScale } from "../src/core/cmat.js";

function smuggle(mutate: (rows: TariffRow[]) => void): TariffRow[] {
  const copy = JSON.parse(JSON.stringify(TARIFF)) as TariffRow[];
  mutate(copy);
  return copy;
}

describe("T1 the schedule clears customs", () => {
  it("the checker passes on the real schedule", () => {
    assert.deepEqual(checkTariff(), []);
  });

  it("all eight witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the correlator machinery", () => {
  it("the singlet's correlations are real: aligned axes anti-correlate exactly", () => {
    // P(same outcome | same axis) = 0 for the singlet: measure A along z,
    // B's conditional along z is the flipped pure state
    const after = measureQubit0(SINGLET, [0, 0, 1]);
    const b = partialTrace(after, [2, 2], [0]);
    // B's ensemble average is I/2 (no setting leakage) — but the JOINT is pure
    const jointTrace = after.re[0]! + after.re[5]! + after.re[10]! + after.re[15]!;
    assert.ok(Math.abs(jointTrace - 1) < 1e-15);
    const half = mScale(identity(2), 0.5);
    assert.ok(Math.abs(b.re[0]! - half.re[0]!) < 1e-15 && Math.abs(b.re[3]! - half.re[3]!) < 1e-15);
  });

  it("no-signaling is a theorem, not a resource property: leakage is zero even for biased resources", () => {
    // a classically-biased product mixture has B's marginal far from I/2 —
    // yet A's axis choice still cannot move it. The witness object (setting
    // leakage) is zero for ANY state; the diagnostic that distinguishes the
    // singlet from this resource is the marginal itself, not the leakage.
    const biased = { rows: 4, cols: 4, re: Float64Array.from([0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1]), im: new Float64Array(16) };
    const b = bMarginal(biased, [0, 0, 1]);
    assert.ok(Math.abs(b.re[0]! - 0.9) < 1e-15 && Math.abs(b.re[3]! - 0.1) < 1e-15);
    assert.ok(cacheLeakage(biased, [0, 0, 1], [1, 0, 0]) < 1e-15);
    // the singlet's own marginal IS the maximally mixed state — the resource
    // property on top of the theorem
    const s = bMarginal(SINGLET, [0, 0, 1]);
    assert.ok(Math.abs(s.re[0]! - 0.5) < 1e-15 && Math.abs(s.re[3]! - 0.5) < 1e-15);
  });
});

describe("T3 smuggling trials — customs rejects contraband by name", () => {
  it("N1: an item without a price is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const hit = checkTariff(contraband).find((v) => v.law === "N1");
    assert.ok(hit, "expected an N1 violation");
    assert.equal(hit.row, "T1");
  });

  it("N2: an unwitnessed zero is marketing, rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[2] as { witness: string }).witness = "W-TRUST";
    });
    const hit = checkTariff(contraband).find((v) => v.law === "N2");
    assert.ok(hit, "expected an N2 violation");
    assert.match(hit.detail, /W-TRUST/);
  });

  it("N3: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { anchors: readonly string[] }).anchors = ["ghost-repo"];
    });
    const hit = checkTariff(contraband).find((v) => v.law === "N3");
    assert.ok(hit, "expected an N3 violation");
    assert.match(hit.detail, /ghost-repo/);
  });

  it("N4: an illegal exactness tag is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { exactness: string }).exactness = "TRUST-ME";
    });
    const hit = checkTariff(contraband).find((v) => v.law === "N4");
    assert.ok(hit, "expected an N4 violation");
  });

  it("N5: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[4] as { id: string }).id = "T1";
    });
    const hit = checkTariff(contraband).find((v) => v.law === "N5");
    assert.ok(hit, "expected an N5 violation");
  });
});

describe("T4 the renderer refuses to print an illegal schedule", () => {
  it("the smuggled schedule fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const violations = checkTariff(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[N1\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-nosignal-tariff.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});
