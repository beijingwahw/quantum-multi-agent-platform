import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkMarket, runWitnesses } from "../src/kernel/audit.js";
import { MARKET, type MarketRow } from "../src/kernel/ledger.js";
import { blochState, pureState, passProbability, marginal, revealStats, strategyFamilies, HALF_MIXED, blochOf } from "../src/kernel/market.js";
import { traceDistance } from "../src/core/measures.js";

function smuggle(mutate: (rows: MarketRow[]) => void): MarketRow[] {
  const copy = JSON.parse(JSON.stringify(MARKET)) as MarketRow[];
  mutate(copy);
  return copy;
}

describe("T1 the market clears", () => {
  it("the checker passes on the real market", () => {
    assert.deepEqual(checkMarket(), []);
  });

  it("all five witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the market machinery", () => {
  it("the identity is honest in the complex quadrant (batch 10's guard)", () => {
    // a complex-phase pair: announced at +y, marginal polarized at -y
    const a = pureState([0, 1, 0]);
    const rho = blochState([0, -0.6, 0]);
    const p = passProbability(a, rho);
    const av = blochOf(a);
    const rv = blochOf(rho);
    const dot = (av[1]) * (rv[1]);
    assert.ok(Math.abs(p - 0.5 - dot / 2) < 1e-15);
    assert.ok(p < 0.5); // anti-aligned announcement UNDERPASSES: the identity has a sign face too
  });

  it("a valid strategy's members average to I/2 (the HJW bookkeeping)", () => {
    for (const fam of strategyFamilies()) {
      const m = marginal(fam.members);
      const w = fam.members.reduce((s, x) => s + x.weight, 0);
      assert.ok(Math.abs(w - 1) < 1e-15);
      assert.ok(traceDistance(m, HALF_MIXED) < 1e-15);
    }
  });

  it("the reveal under a perfectly hiding strategy is a fair coin even in the WORST member", () => {
    for (const fam of strategyFamilies()) {
      const m = marginal(fam.members);
      const { worst } = revealStats(fam.members, m);
      assert.ok(Math.abs(worst - 0.5) < 1e-15);
    }
  });
});

describe("T3 smuggling trials — the market rejects contraband by name", () => {
  it("M1: an unpriced good is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M1");
    assert.ok(hit, "expected an M1 violation");
    assert.equal(hit.row, "G1");
  });

  it("M2: an asserted impossibility without a witness is marketing, rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { witness: string }).witness = "W-TRUST";
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M2");
    assert.ok(hit, "expected an M2 violation");
    assert.match(hit.detail, /marketing/);
  });

  it("M3: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[2] as { anchors: readonly string[] }).anchors = ["ghost-repo"];
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M3");
    assert.ok(hit, "expected an M3 violation");
    assert.match(hit.detail, /ghost-repo/);
  });

  it("M4: an illegal tag is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { exactness: string }).exactness = "SETTLED";
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M4");
    assert.ok(hit, "expected an M4 violation");
  });

  it("M5: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[4] as { id: string }).id = "G1";
    });
    const hit = checkMarket(contraband).find((v) => v.law === "M5");
    assert.ok(hit, "expected an M5 violation");
  });
});

describe("T4 the renderer refuses to print an illegal market", () => {
  it("the smuggled market fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { price: string }).price = "";
    });
    const violations = checkMarket(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[M1\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-binding-price.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});
