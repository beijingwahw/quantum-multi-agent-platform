import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkExchange, runWitnesses } from "../src/kernel/audit.js";
import { EXCHANGE, type ExchangeRow } from "../src/kernel/ledger.js";
import { dephase, partialDephase, readoutSlices } from "../src/kernel/collapse.js";
import { PLUS, vecToRho } from "../src/core/states.js";
import { krausToStinespring, makeSwitchedChannel } from "../src/switch/isometry.js";
import { completelyDepolarizingKraus } from "../src/switch/chanlib.js";
import type { CMat } from "../src/core/cmat.js";

/** deep-clone helper for the smuggling trials — contraband never touches the real ledger */
function smuggle(mutate: (rows: ExchangeRow[]) => void): ExchangeRow[] {
  const copy = JSON.parse(JSON.stringify(EXCHANGE)) as ExchangeRow[];
  mutate(copy);
  return copy;
}

describe("T1 the exchange balances", () => {
  it("the checker passes on the real ledger", () => {
    assert.deepEqual(checkExchange(), []);
  });

  it("all five witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the collapse machinery", () => {
  const sc = makeSwitchedChannel(
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
  );
  const plus = vecToRho(PLUS);
  const rho: CMat = { rows: 2, cols: 2, re: Float64Array.from([1, 0, 0, 0]), im: new Float64Array(4) };

  it("full dephasing is idempotent and lambda=0/1 hit the endpoints", () => {
    const s = readoutSlices(sc, plus, rho);
    const d1 = dephase(s.full, [2, 2], 0);
    const d2 = dephase(d1, [2, 2], 0);
    assert.deepEqual(Array.from(d1.re), Array.from(d2.re));
    const p0 = partialDephase(s.full, [2, 2], 0, 0);
    const p1 = partialDephase(s.full, [2, 2], 0, 1);
    assert.deepEqual(Array.from(p0.re), Array.from(s.full.re));
    assert.deepEqual(Array.from(p1.re), Array.from(d1.re));
  });

  it("dephasing preserves the trace (a readout is a channel)", () => {
    const s = readoutSlices(sc, plus, rho);
    const d = dephase(s.full, [2, 2], 0);
    let tr = 0;
    for (let i = 0; i < d.rows; i++) tr += d.re[i * d.cols + i] as number;
    assert.ok(Math.abs(tr - 1) < 1e-12);
  });
});

describe("T3 smuggling trials — the exchange rejects contraband by name", () => {
  it("C1: a trade with only a GET column is named and rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { pay: string }).pay = "";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C1");
    assert.ok(hit, "expected a C1 violation");
    assert.equal(hit.row, "E1");
  });

  it("C2: an EXACT row citing a witness that does not exist is hearsay, rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { witness: string }).witness = "W-TRUST-ME";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C2");
    assert.ok(hit, "expected a C2 violation");
    assert.match(hit.detail, /W-TRUST-ME/);
  });

  it("C2: an illegal exactness tag is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { exactness: string }).exactness = "ROUGHLY";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C2");
    assert.ok(hit, "expected a C2 violation");
    assert.match(hit.detail, /ROUGHLY/);
  });

  it("C3: an anchor to a repo that is not on disk is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[4] as { anchors: readonly string[] }).anchors = ["ghost-repo"];
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C3");
    assert.ok(hit, "expected a C3 violation");
    assert.match(hit.detail, /ghost-repo/);
  });

  it("C5: a duplicated exchange id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[2] as { id: string }).id = "E1";
    });
    const hit = checkExchange(contraband).find((v) => v.law === "C5");
    assert.ok(hit, "expected a C5 violation");
  });
});

describe("T4 the renderer refuses to print an illegal ledger", () => {
  it("the smuggled ledger fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { pay: string }).pay = "";
    });
    const violations = checkExchange(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[C1\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-readout-wall.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});
