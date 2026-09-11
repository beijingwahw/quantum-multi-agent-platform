import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuditError } from "../src/kernel/errors.js";
import { census } from "../src/kernel/beaver.js";

/**
 * Regression: census(n, bound) never validated `bound` — a fractional bound
 * reached `new Array(bound + 1)` and escaped as a raw RangeError instead of
 * the kernel's named EA:MACHINE refusal (the same silent-crash class the
 * v0.3.0 boundary pass convicted for simulate). The guard now names it.
 */
describe("regression: census validates its step bound by name", () => {
  const codeOf = (fn: () => unknown): string => {
    try {
      fn();
    } catch (e) {
      assert.ok(e instanceof AuditError, `a refusal must be an AuditError, got ${String(e)}`);
      assert.ok(e.message.startsWith(`[${e.code}] `));
      return e.code;
    }
    throw new Error("the illegal bound was NOT refused — the guard is missing");
  };

  it("a fractional or negative bound dies as EA:MACHINE, never a raw RangeError", () => {
    assert.equal(codeOf(() => census(1, 2.5)), "EA:MACHINE");
    assert.equal(codeOf(() => census(1, -1)), "EA:MACHINE");
    assert.equal(codeOf(() => census(1, Number.NaN)), "EA:MACHINE");
  });

  it("an illegal state count is named at the census boundary too", () => {
    assert.equal(codeOf(() => census(0, 10)), "EA:MACHINE");
    assert.equal(codeOf(() => census(1.5, 10)), "EA:MACHINE");
  });

  it("the legal domain is unchanged: census(1, 10) still returns the pinned n=1 universe", () => {
    const c = census(1, 10);
    assert.equal(c.maxSteps, 1);
    assert.equal(c.halted, 32);
    assert.equal(c.censusAt.length, 4); // s = 0..maxSteps+2 inclusive: 0, 1, 2, 3
  });
});
