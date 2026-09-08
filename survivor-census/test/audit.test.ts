import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditCensus } from "../src/kernel/audit.js";
import type { Census, CensusRow } from "../src/kernel/audit.js";
import { renderReport } from "../src/experiments/report.js";
import { buildCensus, runAll } from "../src/experiments/run-all.js";

const here = dirname(fileURLToPath(import.meta.url));
// test/ sits two levels below the workspace root (src/experiments/ is three —
// the depth depends on the file's location, batch 14 lesson)
const workspaceRoot = resolve(here, "..", "..");

function trueCensus(): Census {
  return buildCensus(runAll());
}

/** 补丁语义:显式 undefined 表示清除该键(exactOptionalPropertyTypes 下 Partial 不接受显式 undefined) */
type RowPatch = { [K in keyof CensusRow]?: CensusRow[K] | undefined };

function withRow(c: Census, id: string, patch: RowPatch): Census {
  return {
    rows: c.rows.map((r) => {
      if (r.id !== id) return r;
      // 显式 undefined 的键在合并后删除（"清除该键"语义）；删除完成后对象
      // 满足 CensusRow 不变量，故此断言成立——守卫就是紧随的 delete 循环
      const merged = { ...r, ...patch } as CensusRow;
      for (const k of Object.keys(patch) as Array<keyof CensusRow>) {
        if (patch[k] === undefined) delete merged[k];
      }
      return merged;
    }),
    witnesses: c.witnesses,
  };
}

describe("the true census passes its own laws", () => {
  it("G1-G5 all green on the real census", () => {
    const violations = auditCensus(trueCensus(), workspaceRoot);
    assert.deepEqual(violations, []);
  });

  it("every cited witness passed, and the report prints with all four tables", () => {
    const c = trueCensus();
    for (const w of c.witnesses) assert.ok(w.passed, `${w.id}: ${w.detail}`);
    const o = runAll();
    const text = renderReport(o, c, workspaceRoot);
    for (const marker of ["Table A", "Table B", "Table C", "Table D", "Table E", "Table F", "## Witnesses", "## The grammar failures"]) {
      assert.ok(text.includes(marker), marker);
    }
  });
});

describe("smuggling trials — each contraband is named and rejected", () => {
  it("G1: the letter's own 'O(1)' — a rate shipped as one face only — does not board", () => {
    const c = trueCensus();
    const patched = withRow(c, "R2", { unconditionalFace: "" });
    const v = auditCensus(patched, workspaceRoot);
    assert.ok(v.some((x) => x.startsWith("G1:") && x.includes("R2")), JSON.stringify(v));
  });

  it("G2: an EXACT row without a witness is rejected", () => {
    const c = trueCensus();
    const patched = withRow(c, "R3", { witnessId: undefined });
    const v = auditCensus(patched, workspaceRoot);
    assert.ok(v.some((x) => x.startsWith("G2:") && x.includes("R3")), JSON.stringify(v));
  });

  it("G2: citing a witness that did NOT pass is rejected", () => {
    const c = trueCensus();
    const witnesses = c.witnesses.map((w) => (w.id === "W-F" ? { ...w, passed: false } : w));
    const v = auditCensus({ rows: c.rows, witnesses }, workspaceRoot);
    assert.ok(v.some((x) => x.startsWith("G2:") && x.includes("W-F")), JSON.stringify(v));
  });

  it("G3: a QUOTED row anchored to a repo that is not on disk is rejected", () => {
    const c = trueCensus();
    const patched = withRow(c, "R5", { quote: { repo: "postselect-sched-annex", report: "out/reports/t1-sorter.md" } });
    const v = auditCensus(patched, workspaceRoot);
    assert.ok(v.some((x) => x.startsWith("G3:") && x.includes("R5") && x.includes("package.json")), JSON.stringify(v));
  });

  it("G4: an illegal label is rejected; an UNDEFINED row carrying a witness is rejected", () => {
    const c = trueCensus();
    const illegal = withRow(c, "R7", { label: "PROVEN" as unknown as CensusRow["label"] });
    let v = auditCensus(illegal, workspaceRoot);
    assert.ok(v.some((x) => x.startsWith("G4:") && x.includes("R7")), JSON.stringify(v));
    const undefinedWithWitness = withRow(c, "R8", { label: "UNDEFINED" });
    v = auditCensus(undefinedWithWitness, workspaceRoot);
    assert.ok(v.some((x) => x.startsWith("G4:") && x.includes("R8") && x.includes("no numbers")), JSON.stringify(v));
  });

  it("G5: a duplicated id is rejected", () => {
    const c = trueCensus();
    const rows = c.rows.map((r, i) => (i === 3 ? { ...r, id: c.rows[2]!.id } : r));
    const v = auditCensus({ rows, witnesses: c.witnesses }, workspaceRoot);
    assert.ok(v.some((x) => x.startsWith("G5:")), JSON.stringify(v));
  });

  it("the renderer refuses to print an illegal census — renderReport throws with the violation named", () => {
    const c = trueCensus();
    const patched = withRow(c, "R2", { unconditionalFace: "" });
    const o = runAll();
    assert.throws(() => renderReport(o, patched, workspaceRoot), /G1: row 'R2'/);
  });
});

describe("the repro entry point", () => {
  it("produces the report on disk (and the guarded import does not auto-run)", () => {
    const outFile = resolve(here, "..", "out", "reports", "the-survivor-census.md");
    execFileSync("node", ["--import", "tsx", join(here, "..", "src", "experiments", "render.ts")], {
      cwd: join(here, ".."),
      stdio: "pipe",
    });
    assert.ok(existsSync(outFile));
  });
});
