import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkLetter, checkFrontier, runWitnesses, type UntrustedFrontierRow } from "../src/kernel/audit.js";
import { LETTER, QUOTED_BB1, QUOTED_BB2, QUOTED_CENSUS_NOW, QUOTED_CENSUS_PRIOR, QUOTED_HALTED2, QUOTED_UNIVERSE2, QUOTED_WALKER_STEPS, type AuditRow } from "../src/kernel/ledger.js";
import { FRONTIER, censusString, isGraduated, type FrontierRow } from "../src/kernel/frontier.js";
import { AuditError } from "../src/kernel/errors.js";
import { census, machines, simulate, rightWalker, decode, tetrate, compareTowers, lit, tet, type TMachine, type TowerExpr } from "../src/kernel/beaver.js";

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

  it("the universes are exact: 64 / 20,736 / 16,777,216 machines at n=1/2/3, closed form ≡ iterative product", () => {
    assert.equal(machines(1), 64);
    assert.equal(machines(2), QUOTED_UNIVERSE2);
    assert.equal(machines(2), 20736);
    assert.equal(machines(3), 16777216); // the number README quotes for the n=3 universe
    for (const n of [1, 2, 3]) {
      let product = 1;
      for (let i = 0; i < 2 * n; i++) product *= 4 * (n + 1);
      assert.equal(machines(n), product, `two-path count mismatch at n=${n}`);
    }
  });

  it("the census bookkeeping is exact: n=2 holds 9,784 halters with a monotone curve ending at the count; n=1 completes with 32 of 64 at step 1", () => {
    const c2 = census(2, 300);
    assert.equal(c2.halted, QUOTED_HALTED2);
    assert.equal(c2.maxSteps, QUOTED_BB2);
    for (let s = 1; s < c2.censusAt.length; s++) {
      assert.ok((c2.censusAt[s] as number) >= (c2.censusAt[s - 1] as number), "census curve must be monotone non-decreasing");
    }
    assert.equal(c2.censusAt[c2.censusAt.length - 1], c2.halted, "the curve's last value is the halted count");
    const c1 = census(1, 100);
    assert.equal(c1.maxSteps, QUOTED_BB1);
    assert.equal(c1.halted, 32);
    assert.equal(c1.censusAt[1], 32, "the whole n=1 halting mass lands at step 1");
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

/** Assert that `fn` throws an AuditError whose code and message-prefix both name `code`. */
function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (e) {
    if (!(e instanceof AuditError)) {
      assert.fail(`expected an AuditError with code ${code}, got: ${String(e)}`);
    }
    assert.equal(e.code, code);
    assert.ok(e.message.startsWith(`[${code}] `), `message must lead with the code, got: ${e.message}`);
    return;
  }
  assert.fail(`expected ${code} to throw — nothing did`);
}

describe("T7 machine smuggling trials — malformed machines die at the boundary by name", () => {
  it("EA:MACHINE: a short entry table is named and rejected (v0.3.0 conviction — it used to read undefined as a digit and return silent garbage)", () => {
    assert.throws(() => simulate({ n: 2, entries: [0, 0] }, 100), /EA:MACHINE.*needs exactly 4 entries, got 2/);
    expectCode(() => simulate({ n: 2, entries: [0, 0] }, 100), "EA:MACHINE");
  });

  it("EA:MACHINE: an out-of-range entry digit is named and rejected (it used to write symbols outside {0,1} and silently corrupt the ones count)", () => {
    assert.throws(() => simulate({ n: 2, entries: [0, 0, 0, 12] }, 100), /EA:MACHINE.*entry 3 must be an integer in 0\.\.11, got 12/);
    expectCode(() => simulate({ n: 2, entries: [0, 0, 0, 99] }, 100), "EA:MACHINE");
  });

  it("EA:MACHINE: non-integer and non-positive state counts are rejected (simulate and rightWalker)", () => {
    const illegal: TMachine[] = [
      { n: 1.5, entries: [0, 0, 0] },
      { n: 0, entries: [] },
      { n: -2, entries: [] },
    ];
    for (const m of illegal) expectCode(() => simulate(m, 10), "EA:MACHINE");
    expectCode(() => rightWalker(0), "EA:MACHINE");
  });

  it("EA:MACHINE: machine codes outside the universe are rejected — decode is a bijection onto the universe", () => {
    expectCode(() => decode(1, 64), "EA:MACHINE"); // universe is 0..63
    expectCode(() => decode(1, -1), "EA:MACHINE");
    assert.throws(() => decode(1, 64), /must be an integer in 0\.\.63, got 64/);
    for (let code = 0; code < machines(1); code++) {
      const m = decode(1, code);
      assert.equal(m.entries.length, 2);
      for (const d of m.entries) assert.ok(Number.isInteger(d) && d >= 0 && d < 8, `decode(${code}) produced entry ${d} outside 0..7`);
    }
  });

  it("EA:MACHINE: a negative or fractional step bound is rejected before the first step", () => {
    expectCode(() => simulate(rightWalker(1), -1), "EA:MACHINE");
    expectCode(() => simulate(rightWalker(1), 1.5), "EA:MACHINE");
  });
});

describe("T8 tower-domain trials — the ladder refuses to order what it cannot", () => {
  it("EA:TETRATE: heights outside 1..5 are named and rejected (0, 6, 1.5, NaN)", () => {
    expectCode(() => tetrate(0), "EA:TETRATE");
    expectCode(() => tetrate(6), "EA:TETRATE");
    expectCode(() => tetrate(1.5), "EA:TETRATE");
    expectCode(() => tetrate(Number.NaN), "EA:TETRATE");
  });

  it("EA:TOWER-SHAPE: a non-positive literal height is rejected at construction (v0.3.0 conviction — it used to reach compareTowers and be ordered by the monotone-bound branch)", () => {
    expectCode(() => tet(lit(0n)), "EA:TOWER-SHAPE");
    expectCode(() => tet(lit(-3n)), "EA:TOWER-SHAPE");
  });

  it("EA:TOWER-DOMAIN: a hand-built non-positive height is refused by the comparison itself — 2↑↑0 is never claimed greater than a literal (defense in depth)", () => {
    const smuggled: TowerExpr = { kind: "tet", height: { kind: "lit", n: 0n } };
    expectCode(() => compareTowers(smuggled, lit(5n)), "EA:TOWER-DOMAIN");
    expectCode(() => compareTowers(lit(5n), smuggled), "EA:TOWER-DOMAIN");
  });

  it("EA:TOWER-DOMAIN: a nested non-literal height against a bare literal is refused, not guessed", () => {
    const tall = tet(tet(lit(9n)));
    expectCode(() => compareTowers(tall, lit(5n)), "EA:TOWER-DOMAIN");
    expectCode(() => compareTowers(lit(5n), tall), "EA:TOWER-DOMAIN");
  });

  it("exact equality across kinds and the monotone bound: 2↑↑4 = 65536 = lit(65536); 2↑↑6 > 2↑↑5 structurally", () => {
    const t4 = tet(lit(4n));
    assert.equal(compareTowers(t4, lit(65536n)), 0);
    assert.equal(compareTowers(lit(65536n), t4), 0);
    assert.equal(compareTowers(tet(lit(6n)), tet(lit(5n))), 1);
    assert.equal(compareTowers(tet(lit(5n)), tet(lit(6n))), -1);
  });

  it("antisymmetry and symmetric refusal: ordered pairs antisymmetric, refused pairs refused in both directions", () => {
    const pool: TowerExpr[] = [
      lit(1n),
      lit(65536n),
      tet(lit(3n)), // 16
      tet(lit(4n)), // 65536
      tet(lit(5n)), // 2^65536 — last materializable
      tet(lit(6n)), // structural only
      tet(tet(lit(9n))), // the champion's shape
    ];
    const describe2 = (e: TowerExpr): string =>
      e.kind === "lit" ? `lit(${e.n})` : `tet(${describe2(e.height)})`;
    const order = (a: TowerExpr, b: TowerExpr): number | "REFUSED" => {
      try {
        return compareTowers(a, b);
      } catch (e) {
        if (e instanceof AuditError && e.code === "EA:TOWER-DOMAIN") return "REFUSED";
        throw e;
      }
    };
    for (const a of pool) {
      for (const b of pool) {
        const ab = order(a, b);
        const ba = order(b, a);
        if (ab === "REFUSED" || ba === "REFUSED") {
          assert.equal(ab, "REFUSED", `refusal must be symmetric: ${describe2(a)} vs ${describe2(b)}`);
          assert.equal(ba, "REFUSED");
        } else {
          assert.equal(ab, ba === 0 ? 0 : -ba, `antisymmetry broke for ${describe2(a)} vs ${describe2(b)}`);
        }
      }
    }
  });
});
