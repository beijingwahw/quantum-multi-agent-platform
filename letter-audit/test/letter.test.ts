import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkLetter, checkFrontier, runWitnesses, type UntrustedFrontierRow } from "../src/kernel/audit.js";
import { LETTER, QUOTED_CENSUS_NOW, QUOTED_CENSUS_PRIOR, QUOTED_WALKER_STEPS, type AuditRow } from "../src/kernel/ledger.js";
import { FRONTIER, censusString, isGraduated, type FrontierRow } from "../src/kernel/frontier.js";
import { census, machines, simulate, rightWalker, decode, tetrate, compareTowers, lit, tet } from "../src/kernel/beaver.js";

function smuggle(mutate: (rows: AuditRow[]) => void): AuditRow[] {
  const copy = JSON.parse(JSON.stringify(LETTER)) as AuditRow[];
  mutate(copy);
  return copy;
}

function smuggleFrontier(mutate: (rows: FrontierRow[]) => void): readonly UntrustedFrontierRow[] {
  const copy = JSON.parse(JSON.stringify(FRONTIER)) as FrontierRow[];
  mutate(copy);
  return copy;
}

describe("T1 the audit upgrades every sentence two-sidedly", () => {
  it("the checker passes on the real audit", () => {
    assert.deepEqual(checkLetter(), []);
  });

  it("all seven witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the machine universe", () => {
  it("the immediate-halter family exists and halts at step 1", () => {
    // entry digit with next === n (HALT): d = write*span + moveIdx*(n+1) + n
    const n = 2;
    const span = 2 * (n + 1);
    const d = span + n; // write=1, move=-1... next must be n: d = 1*span + 0*(n+1) + n
    const entries = [d, 0, 0, 0];
    const r = simulate({ n, entries }, 100);
    assert.ok(r.halted && r.steps === 1);
  });

  it("the n=2 census stabilizes at BB=6 and the max-steps machine really runs 6 steps", () => {
    const c = census(2, 300);
    assert.equal(c.maxSteps, 6);
    // find the champion by re-simulation
    let champion = -1;
    for (let code = 0; code < machines(2); code++) {
      const r = simulate(decode(2, code), 300);
      if (r.halted && r.steps === 6) {
        champion = code;
        break;
      }
    }
    assert.ok(champion >= 0, "a 6-step halter must exist");
  });

  it("the walker's invariant holds at multiple horizons", () => {
    for (const bound of [10, 100, QUOTED_WALKER_STEPS]) {
      const r = simulate(rightWalker(2), bound);
      assert.ok(!r.halted && r.steps === bound && r.ones === bound);
    }
  });
});

describe("T3 smuggling trials — the audit rejects contraband by name", () => {
  it("A1: a precise form without a boundary is a one-sided upgrade, rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { boundary: string }).boundary = "";
    });
    const hit = checkLetter(contraband).find((v) => v.law === "A1");
    assert.ok(hit, "expected an A1 violation");
    assert.equal(hit.row, "O1");
  });

  it("A2: an unknown witness is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as { witness: string }).witness = "W-TRUST";
    });
    const hit = checkLetter(contraband).find((v) => v.law === "A2");
    assert.ok(hit, "expected an A2 violation");
  });

  it("A3: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[3] as { anchors: readonly string[] }).anchors = ["ghost-repo"];
    });
    const hit = checkLetter(contraband).find((v) => v.law === "A3");
    assert.ok(hit, "expected an A3 violation");
    assert.match(hit.detail, /ghost-repo/);
  });

  it("A4: an illegal tag is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[5] as { exactness: string }).exactness = "SETTLED";
    });
    const hit = checkLetter(contraband).find((v) => v.law === "A4");
    assert.ok(hit, "expected an A4 violation");
  });

  it("A5: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[6] as { id: string }).id = "O1";
    });
    const hit = checkLetter(contraband).find((v) => v.law === "A5");
    assert.ok(hit, "expected an A5 violation");
  });
});

describe("T5 the frontier re-audit — the registry caught up with the workspace", () => {
  it("the frontier checker passes on the real re-audit (every pointer read live from the siblings)", () => {
    assert.deepEqual(checkFrontier(), []);
  });

  it("the census re-counts: 8/4/2/2/0/1 now, 6/4/2/2/2/1 at v0.1.0 — the two OPEN rows are gone", () => {
    assert.equal(censusString(FRONTIER, "verdict"), QUOTED_CENSUS_NOW);
    assert.equal(censusString(FRONTIER, "priorVerdict"), QUOTED_CENSUS_PRIOR);
    assert.equal(FRONTIER.length, 17);
  });

  it("exactly two graduations, each naming its settler, citing it by pointer, and carrying its surviving boundary", () => {
    const graduations = FRONTIER.filter(isGraduated);
    assert.deepEqual(graduations.map((r) => r.claimId), ["#10", "#15"]);
    for (const g of graduations) {
      assert.ok(g.settler !== null, `${g.claimId} must name its settler`);
      assert.ok(
        g.pointers.some((p) => p.repo === g.settler),
        `${g.claimId} must cite ${g.settler} by pointer`,
      );
      assert.match(g.note, /not claimed/i, `${g.claimId}'s graduation must carry its surviving boundary on the same line`);
    }
  });

  it("the sixth rung's arithmetic: 2↑↑4 = 65536, 2↑↑5 = 2^65536 (19,729 digits), champion tower strictly exceeds 2↑↑↑5", () => {
    assert.equal(tetrate(4), 65536n);
    assert.equal(tetrate(5), 2n ** 65536n);
    assert.equal(tetrate(5).toString().length, 19729);
    // the two cited June 2025 expressions are consistent: 2↑↑(2↑↑(2↑↑9)) > 2↑↑↑5 = 2↑↑(2↑↑65536)
    const champion = tet(tet(tet(lit(9n))));
    const p5 = tet(tet(lit(65536n))); // 2↑↑↑5
    const p4 = tet(lit(65536n)); // 2↑↑↑4 = 2↑↑65536
    assert.equal(compareTowers(champion, p5), 1);
    assert.equal(compareTowers(p5, p4), 1);
  });
});

describe("T6 frontier smuggling trials — the re-audit rejects contraband by name", () => {
  it("A6: a frontier pointer to a needle that does not exist in the sibling's report is rejected by name", () => {
    const contraband = smuggleFrontier((rows) => {
      const r10 = rows.find((r) => r.claimId === "#10");
      assert.ok(r10);
      (r10.pointers[1] as { needle: string }).needle = "kappa = 9.9999999999";
    });
    const hit = checkFrontier(contraband).find((v) => v.law === "A6");
    assert.ok(hit, "expected an A6 violation");
    assert.equal(hit.row, "#10");
    assert.match(hit.detail, /dtc-clock\/out\/reports\/the-dtc-clock\.md/);
    assert.match(hit.detail, /kappa = 9\.9999999999/);
  });

  it("A7: a graduated row without a settling pointer into its settler is rejected by name", () => {
    const contraband = smuggleFrontier((rows) => {
      const r10 = rows.find((r) => r.claimId === "#10");
      assert.ok(r10);
      (r10 as { pointers: FrontierRow["pointers"] }).pointers = r10.pointers.filter((p) => p.repo !== "dtc-clock");
    });
    const hit = checkFrontier(contraband).find((v) => v.law === "A7");
    assert.ok(hit, "expected an A7 violation");
    assert.equal(hit.row, "#10");
    assert.match(hit.detail, /dtc-clock/);
  });

  it("A6: a pointer to a sibling file that does not exist is rejected by name", () => {
    const contraband = smuggleFrontier((rows) => {
      const r1 = rows.find((r) => r.claimId === "#01");
      assert.ok(r1);
      (r1.pointers[0] as { file: string }).file = "out/reports/ghost.md";
    });
    const hit = checkFrontier(contraband).find((v) => v.law === "A6");
    assert.ok(hit, "expected an A6 violation");
    assert.match(hit.detail, /ghost\.md/);
  });

  it("A8: a verdict flipped behind the census's back is caught by the re-count", () => {
    const contraband = smuggleFrontier((rows) => {
      const r5 = rows.find((r) => r.claimId === "#05");
      assert.ok(r5);
      (r5 as { verdict: string }).verdict = "MECHANISM-SETTLED";
    });
    const hit = checkFrontier(contraband).find((v) => v.law === "A8");
    assert.ok(hit, "expected an A8 violation");
    assert.match(hit.detail, /9\/4\/2\/1\/0\/1/);
  });
});

describe("T4 the renderer refuses to print an illegal audit", () => {
  it("the smuggled audit fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as { precise: string }).precise = "";
    });
    const violations = checkLetter(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[A1\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    const p = resolve(process.cwd(), "out", "reports", "the-letter-audit.md");
    assert.ok(!existsSync(p) || Date.now() - statSync(p).mtimeMs >= 1000, "import must not write a fresh report");
  });
});
