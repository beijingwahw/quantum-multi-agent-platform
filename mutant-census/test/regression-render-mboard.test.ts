/**
 * REGRESSION — the renderer prints the register it is HANDED. renderCensus's
 * `mutants` parameter must feed the M-board table, the kill map and the prose
 * counts from ONE list: the table once iterated the module-level MUTANTS
 * while runKillCensus ran the injected list — duplicated-state drift, the
 * exact shape this census exists to kill (an injected register silently
 * answering to the global one). The trial keeps ids, killers and
 * expectations identical (the kill census and every S2 prose count are
 * unchanged) and differs only one mutant's DEFECT prose — a text that can
 * reach the table only through the parameter.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MUTANTS, type MutantSpec } from "../src/kernel/family.js";

test("renderCensus prints the injected mutant register, not the module global (M-board parameterization)", async () => {
  const { renderCensus } = await import("../src/experiments/render.js");
  const MARKER = "REGRESSION-MARKER: the injected register is the one printed";
  const injected: readonly MutantSpec[] = MUTANTS.map((m) =>
    m.id === "MU9" ? { ...m, defect: `${m.defect} — ${MARKER}` } : m,
  );
  const text = await renderCensus(injected);
  const rows = [...text.matchAll(/^\| (MU\d+) \|/gm)].map((m) => m[1]!);
  assert.deepEqual(
    rows,
    MUTANTS.map((m) => m.id),
    "the M-board carries exactly the injected register, in id order",
  );
  assert.ok(
    text.includes(MARKER),
    "the injected defect text never reached the M-board row — the renderer printed the module global instead of its parameter",
  );
});
