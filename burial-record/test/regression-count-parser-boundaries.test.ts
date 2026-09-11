import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statedDeliveryCounts } from "../src/kernel/audit.js";

/**
 * Regression: the B7/B8 count-word engine's English edges. The hyphenated
 * tens accept ones one..nine ("twenty-nine" the boundary case) and refuse
 * nonsense ("twenty-ten"); bare tens ("thirty") and bare digits parse; a
 * non-count word ("zero") states nothing — free prose is left alone. The
 * existing suite pins 'twenty-two'; these pin the edges it does not.
 */
describe("regression: count-word parser boundaries", () => {
  it("hyphenated tens parse whole up to -nine and refuse -ten", () => {
    assert.equal(statedDeliveryCounts("### Lessons (twenty-nine delivery errors)").errors, 29);
    assert.equal(statedDeliveryCounts("### Lessons (twenty-one delivery errors)").errors, 21);
    assert.equal(
      statedDeliveryCounts("### Lessons (twenty-ten delivery errors)").errors,
      null,
      "twenty-ten is not a count — the parser must state nothing, not guess",
    );
  });

  it("bare tens and bare digits parse; 'zero' is not a count word", () => {
    assert.equal(statedDeliveryCounts("### Lessons (thirty delivery errors)").errors, 30);
    assert.equal(statedDeliveryCounts("### Lessons (12 delivery errors)").errors, 12);
    assert.equal(
      statedDeliveryCounts("### Lessons (zero delivery errors)").errors,
      null,
      "'zero' is free prose today — it states nothing and convicts nothing",
    );
  });

  it("the classes slot parses beside the errors slot in English", () => {
    const d = statedDeliveryCounts("### Lessons (twenty-nine delivery errors across six classes)");
    assert.equal(d.errors, 29);
    assert.equal(d.classes, 6);
  });
});
