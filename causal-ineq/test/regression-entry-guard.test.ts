import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Regression: all five experiment files used to end in a bare `run()` — any
 * import of the module executed the full experiment (exp4's sweep alone runs
 * ~20 s) and rendered a report as a side effect. The batch-33 house law
 * (imports never render; house form since batch 21, enforced across the
 * workspace in wave R2) is now retrofit: every file gates on
 * runIfMain(import.meta.url, process.argv[1], run).
 */
describe("regression: experiment entry guards (imports never render)", () => {
  const reports = [
    "exp1-validity.md",
    "exp2-classical.md",
    "exp3-quantum.md",
    "exp4-optimality.md",
    "exp5-equivalence.md",
  ] as const;

  const mtimeOrZero = (name: string): number => {
    const p = resolve(process.cwd(), "out", "reports", name);
    return existsSync(p) ? statSync(p).mtimeMs : 0;
  };

  it("importing every experiment module writes no report (and runs no sweep)", async () => {
    const before = new Map(reports.map((n) => [n, mtimeOrZero(n)] as const));
    await import("../experiments/exp1-validity.js");
    await import("../experiments/exp2-classical.js");
    await import("../experiments/exp3-quantum.js");
    await import("../experiments/exp4-optimality.js");
    await import("../experiments/exp5-equivalence.js");
    for (const n of reports) {
      assert.equal(mtimeOrZero(n), before.get(n), `importing must not render ${n}`);
    }
  });
});
