import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkBurial, memoryStructureViolations, runWitnesses, statedDeliveryCounts, type Violation, type WitnessResult } from "../src/kernel/audit.js";
import { assertBuriesCleanly, IllegalRegistryError } from "../src/experiments/render.js";
import {
  BURIAL_RECORD,
  DECLARED_TOTAL_BATCHES,
  DECLARED_TOTAL_ERRORS,
  type BurialBatch,
} from "../src/kernel/registry.js";

/** deep-clone helper for the smuggling trials — the contraband never touches the real registry */
function smuggle(mutate: (b: BurialBatch[]) => void): BurialBatch[] {
  const copy = JSON.parse(JSON.stringify(BURIAL_RECORD)) as BurialBatch[];
  mutate(copy);
  return copy;
}

/** stale (from an earlier repro) counts as absent — the import must not produce a fresh file */
function freshReportExists(): boolean {
  const p = resolve(process.cwd(), "out", "reports", "the-burial-record.md");
  if (!existsSync(p)) return false;
  return Date.now() - statSync(p).mtimeMs < 1000;
}

describe("T1 the record buries cleanly", () => {
  it("the checker passes on the real registry", () => {
    assert.deepEqual(checkBurial(), []);
  });

  it("all census witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });

  it("declared totals equal the registry", () => {
    assert.equal(BURIAL_RECORD.length, DECLARED_TOTAL_BATCHES);
    assert.equal(BURIAL_RECORD.reduce((a, b) => a + b.errors.length, 0), DECLARED_TOTAL_ERRORS);
  });
});

describe("T2 smuggling trials — the bookkeeping rejects contraband by name", () => {
  it("B1: a batch anchored to a repo that does not exist is named and rejected", () => {
    const contraband = smuggle((b) => {
      (b[0] as { repo: string }).repo = "ghost-repo";
    });
    const violations = checkBurial(contraband);
    const hit = violations.find((v) => v.law === "B1");
    assert.ok(hit, `expected a B1 violation, got: ${JSON.stringify(violations)}`);
    assert.match(hit.detail, /ghost-repo/);
    assert.equal(hit.batch, 1);
  });

  it("B2: an error smuggled in with only one column is named and rejected", () => {
    const contraband = smuggle((b) => {
      const batch3 = b.find((x) => x.batch === 3) as unknown as { errors: Array<{ right: string }> };
      batch3.errors[0]!.right = "";
    });
    const hit = checkBurial(contraband).find((v) => v.law === "B2");
    assert.ok(hit, "expected a B2 violation");
    assert.equal(hit.batch, 3);
    assert.match(hit.detail, /two columns/);
  });

  it("B3: a gap in the numbering is named and rejected — the count may not drift", () => {
    const contraband = smuggle((b) => {
      const idx = b.findIndex((x) => x.batch === 7);
      b.splice(idx, 1);
    });
    const hit = checkBurial(contraband).find((v) => v.law === "B3");
    assert.ok(hit, "expected a B3 violation");
    assert.match(hit.detail, /missing \[7\]/);
  });

  it("B4: a source anchor citing a heading that is not on disk is named and rejected", () => {
    const contraband = smuggle((b) => {
      const batch20 = b.find((x) => x.batch === 20) as unknown as { source: { heading: string } };
      batch20.source.heading = "关键经验（不存在的标题";
    });
    const hit = checkBurial(contraband).find((v) => v.law === "B4");
    assert.ok(hit, "expected a B4 violation");
    assert.equal(hit.batch, 20);
  });

  it("B0: an error filed under a category outside the taxonomy is named and rejected", () => {
    const contraband = smuggle((b) => {
      const batch21 = b.find((x) => x.batch === 21) as unknown as { errors: Array<{ category: string }> };
      batch21.errors[0]!.category = "misc";
    });
    const hit = checkBurial(contraband).find((v) => v.law === "B0");
    assert.ok(hit, "expected a B0 violation");
    assert.match(hit.detail, /illegal category "misc"/);
  });

  it("B5: a batch whose date contradicts its anchor file is named and rejected", () => {
    const contraband = smuggle((b) => {
      const batch19 = b.find((x) => x.batch === 19) as unknown as { date: string };
      batch19.date = "2026-09-07";
    });
    const hit = checkBurial(contraband).find((v) => v.law === "B5");
    assert.ok(hit, "expected a B5 violation");
    assert.match(hit.detail, /does not match anchor file/);
  });

  it("B7: a context stating the wrong error count is named and rejected (the b45#9 law)", () => {
    const contraband = smuggle((b) => {
      const batch45 = b.find((x) => x.batch === 45) as unknown as { context: string };
      batch45.context =
        "the v0.5.0 armor dynamics delivery — nine delivery errors across five classes, born enrolled";
    });
    const hit = checkBurial(contraband).find((v) => v.law === "B7" && v.batch === 45);
    assert.ok(hit, "expected a B7 violation on batch 45");
    assert.match(hit.detail, /states 9 error/);
    assert.match(hit.detail, /carries 10/);
  });

  it("B7: a context stating the wrong class count is named and rejected", () => {
    const contraband = smuggle((b) => {
      const batch45 = b.find((x) => x.batch === 45) as unknown as { context: string };
      batch45.context =
        "the v0.5.0 armor dynamics delivery — ten delivery errors across six classes, born enrolled";
    });
    const hit = checkBurial(contraband).find((v) => v.law === "B7" && v.batch === 45);
    assert.ok(hit, "expected a B7 class-count violation");
    assert.match(hit.detail, /classes/);
  });

  it("B7 regression: hyphenated counts parse whole ('twenty-two' on 22 errors is NOT a violation)", () => {
    const contraband = smuggle((b) => {
      const batch36 = b.find((x) => x.batch === 36) as unknown as { context: string };
      batch36.context =
        "the #10 settlement repo: the beat clocking universal reversible computation with a legislated tariff table — twenty-two delivery errors, born enrolled (E1 self-application, third generation)";
    });
    assert.deepEqual(
      checkBurial(contraband).filter((v) => v.law === "B7"),
      [],
      "twenty-two === 22 must not convict — the truncation trap",
    );
  });

  it("B7 bilingual: a Chinese stated count in a context is law (a count is a count in either tongue)", () => {
    const right = smuggle((b) => {
      const batch46 = b.find((x) => x.batch === 46) as unknown as { context: string };
      batch46.context = "the v0.5.0 genealogy board — 交付期六处, born enrolled on both sides";
    });
    assert.deepEqual(
      checkBurial(right).filter((v) => v.law === "B7"),
      [],
      "六处 === 6 must not convict",
    );
    const wrongC = smuggle((b) => {
      const batch46 = b.find((x) => x.batch === 46) as unknown as { context: string };
      batch46.context = "the v0.5.0 genealogy board — 交付期九处, born enrolled on both sides";
    });
    const hit = checkBurial(wrongC).find((v) => v.law === "B7" && v.batch === 46);
    assert.ok(hit, "九处 on 6 errors must convict");
    assert.match(hit.detail, /states 9 error/);
  });

  it("B7 bilingual classes: a Chinese stated CLASS count is law (五类 legal, 九类 on five classes convicts)", () => {
    const right = smuggle((b) => {
      const batch45 = b.find((x) => x.batch === 45) as unknown as { context: string };
      batch45.context = "the v0.5.0 armor dynamics delivery — 交付期十处五类, born enrolled";
    });
    assert.deepEqual(
      checkBurial(right).filter((v) => v.law === "B7"),
      [],
      "十处五类 on ten errors five classes must not convict — both tongues agree with the data",
    );
    const wrongC = smuggle((b) => {
      const batch45 = b.find((x) => x.batch === 45) as unknown as { context: string };
      batch45.context = "the v0.5.0 armor dynamics delivery — 交付期十处九类, born enrolled";
    });
    const hit = checkBurial(wrongC).find((v) => v.law === "B7" && v.batch === 45);
    assert.ok(hit, "九类 on five classes must convict");
    assert.match(hit.detail, /states 9 classes/);
  });

  it("B8: the lesson heading's stated 处 must equal the registry's carried count (the memory side of b45#9)", () => {
    const contraband = smuggle((b) => {
      const batch45 = b.find((x) => x.batch === 45) as unknown as { errors: Array<{ wrong: string; right: string; category: string }> };
      batch45.errors.pop(); // the memory still says 十处; the registry now carries 9
    });
    const hit = checkBurial(contraband).find((v) => v.law === "B8" && v.batch === 45);
    assert.ok(hit, "expected a B8 conviction on batch 45");
    assert.match(hit.detail, /states 10 处/);
    assert.match(hit.detail, /carries 9/);
  });

  it("B8 regression: '十处五类' on a ten-error five-class batch is legal prose (both sides agree)", () => {
    assert.deepEqual(
      checkBurial().filter((v) => v.law === "B8"),
      [],
      "the real registry's headings all match their batches",
    );
    const d45 = statedDeliveryCounts("### 关键经验（第四十五批——dtc-clock v0.5.0 交付期十处五类）");
    assert.equal(d45.errors, 10);
    assert.equal(d45.classes, 5);
    const d46 = statedDeliveryCounts("### 关键经验（第四十六批——mutant-census G 板＋burial-record B7 交付期六处）");
    assert.equal(d46.errors, 6);
    assert.equal(d46.classes, null);
    const none = statedDeliveryCounts("### 某节（无计数惯用语）");
    assert.equal(none.errors, null);
    // the English twin parses the same way (v0.4.0's unified engine)
    const en = statedDeliveryCounts("### Lessons (batch 45 — ten delivery errors across five classes)");
    assert.equal(en.errors, 10);
    assert.equal(en.classes, 5);
    const enBad = statedDeliveryCounts("### Lessons (batch 45 — nine delivery errors across five classes)");
    assert.equal(enBad.errors, 9);
  });

  it("compound Chinese numerals parse whole — the X十Y and X十 paths (二十三处 is 23, 三十处四类 is 30 and 4)", () => {
    const compound = statedDeliveryCounts("### 关键经验（第八十七批——某仓 交付期二十三处）");
    assert.equal(compound.errors, 23, "二十三 must parse as 23, not 2 or 3 or the truncation 2-then-3");
    assert.equal(compound.classes, null);
    const tens = statedDeliveryCounts("### 关键经验（第八十七批——某仓 交付期三十处四类）");
    assert.equal(tens.errors, 30, "三十 must parse as 30");
    assert.equal(tens.classes, 4);
  });
});

describe("T4 the memory substrate's structure is law (B9, v0.5.0)", () => {
  it("the live cited notes are structurally whole", () => {
    assert.deepEqual(
      checkBurial().filter((v) => v.law === "B9"),
      [],
      "the cited daily notes carry a structural defect",
    );
  });

  it("the repeated-label signature is convicted by line number", () => {
    const v = memoryStructureViolations("# day\n\n- **七十四访**：- **七十四访**：令牌\n");
    const hit = v.find((x) => /repeated-label/.test(x.detail));
    assert.ok(hit, `expected the repeated-label conviction, got ${JSON.stringify(v)}`);
    assert.match(hit.detail, /line 3/);
  });

  it("the orphaned heading tail is convicted — a swallowed heading's surviving fragment", () => {
    const v = memoryStructureViolations("# day\n\n（访客令牌「点名」——被吞节头的残迹）\n");
    const hit = v.find((x) => /orphaned heading tail/.test(x.detail));
    assert.ok(hit, `expected the orphaned-tail conviction, got ${JSON.stringify(v)}`);
  });

  it("an exact-duplicate heading line is convicted as a copy-paste double", () => {
    const v = memoryStructureViolations("## 七十二访点名交付：某仓\n\n正文\n\n## 七十二访点名交付：某仓\n");
    const hit = v.find((x) => /VERBATIM twice/.test(x.detail));
    assert.ok(hit, `expected the verbatim-double conviction, got ${JSON.stringify(v)}`);
  });

  it("a duplicated lesson heading is convicted by batch", () => {
    const v = memoryStructureViolations("### 关键经验（第六十七批——A\n\n### 关键经验（第六十七批——B\n");
    const hit = v.find((x) => /第六十七批/.test(x.detail));
    assert.ok(hit, `expected the lesson-heading conviction, got ${JSON.stringify(v)}`);
  });

  it("legitimate two-section visits do NOT convict — visit-number uniqueness was a false invariant, retired", () => {
    const v = memoryStructureViolations("## 三十九访点名交付：dtc-clock v0.1.0\n\n正文一\n\n## 三十九访点名：后信开工（双段访）\n\n正文二\n");
    assert.deepEqual(v, [], "a visit may carry several sections — the first draft false-convicted exactly this history");
  });
});

describe("T3 the renderer refuses to print an illegal registry", () => {
  it("the smuggled registry fails the checker the renderer gates on", () => {
    const contraband = smuggle((b) => {
      const batch3 = b.find((x) => x.batch === 3) as unknown as { errors: Array<{ wrong: string }> };
      batch3.errors[0]!.wrong = "";
    });
    const violations = checkBurial(contraband);
    assert.ok(violations.length > 0, "the smuggled registry must not pass the checker");
    const reasons = violations.map((v) => `batch ${v.batch} [${v.law}]: ${v.detail}`);
    assert.match(reasons.join("\n"), /\[B2\]/);
  });

  it("importing the render module does not execute the render (batch 21's entry guard)", async () => {
    await import("../src/experiments/render.js");
    assert.equal(freshReportExists(), false, "importing render.ts must not write a fresh out/reports file");
  });

  it("the refusal is thrown BY NAME — IllegalRegistryError carries the conviction lines (the previously untested gate face)", () => {
    const violations: Violation[] = [
      { batch: 3, law: "B2", detail: "error 1: the two columns (wrong | right) must both be booked" },
    ];
    assert.throws(
      () => {
        assertBuriesCleanly(violations, []);
      },
      IllegalRegistryError,
      "an illegal registry is refused by the named error, not an anonymous one",
    );
    assert.throws(
      () => {
        assertBuriesCleanly(violations, []);
      },
      (err: unknown) => err instanceof IllegalRegistryError && err.name === "IllegalRegistryError" && /\[B2\]/.test(err.message),
      "the refusal names the law it convicted on",
    );
    const failingWitness: WitnessResult = { name: "W-4 declared totals", pass: false, detail: "recount says 87/691" };
    assert.throws(
      () => {
        assertBuriesCleanly([], [failingWitness]);
      },
      (err: unknown) => err instanceof IllegalRegistryError && /W-4 declared totals/.test(String(err)),
      "a failing witness is named on the same refusal",
    );
    // the clean registry is the gate's silence
    assert.doesNotThrow(() => {
      assertBuriesCleanly(checkBurial(), runWitnesses());
    });
  });
});
