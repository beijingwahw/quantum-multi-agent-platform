import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Regression: the two scratch scripts ran their ENTIRE body at module level
 * — importing either executed the full witness sweep (minutes of compute,
 * console spam) as an import side effect. That is the exact defect class the
 * batch-21/33 house law retired for render.ts (and causal-ineq's experiment
 * files in wave R5); the scratch files escaped every walk because the
 * workspace census detector only catches report-writers. Retrofitted with
 * the package's own entry-guard shape; this file pins that an import of
 * either module executes nothing.
 */
describe("regression: the scratch scripts are entry-guarded (imports run nothing)", () => {
  it("importing scratch.ts and scratch-life.ts produces no console output and no side effects", async () => {
    const calls: unknown[][] = [];
    const saved = console.log;
    console.log = (...args: unknown[]) => {
      calls.push(args);
    };
    try {
      await import("../src/experiments/scratch.js");
      await import("../src/experiments/scratch-life.js");
    } finally {
      console.log = saved;
    }
    assert.deepEqual(
      calls,
      [],
      `the import must not run the scratch (got ${calls.length} console.log calls, first: ${JSON.stringify(calls[0])})`,
    );
  });
});
