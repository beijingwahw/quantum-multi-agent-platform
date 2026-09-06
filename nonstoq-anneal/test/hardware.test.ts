import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  DEFAULT_NONSTOQ_PROFILE,
  fitsHardwareProfile,
  CALIBRATION_ANCHORS,
} from "../src/hardware/profile.js";

test("hardware: in-envelope driver fits; violations carry explicit reasons", () => {
  const okDriver = {
    gamma: 1,
    couplings: [
      { j: 0, k: 1, w: 0.8 },
      { j: 1, k: 2, w: -0.5 },
    ],
  };
  const r = fitsHardwareProfile(okDriver, DEFAULT_NONSTOQ_PROFILE);
  assert.ok(r.fits, r.violations.join("; "));

  const bad = {
    gamma: 1,
    couplings: [
      { j: 0, k: 1, w: 3.5 }, // 超范围
      { j: 0, k: 2, w: 0.1 },
      { j: 0, k: 3, w: 0.1 },
      { j: 0, k: 4, w: 0.1 },
      { j: 0, k: 5, w: 0.1 }, // 度 5 > 4
    ],
  };
  const r2 = fitsHardwareProfile(bad, DEFAULT_NONSTOQ_PROFILE);
  assert.ok(!r2.fits);
  assert.ok(r2.violations.some((v) => v.includes("outside")));
  assert.ok(r2.violations.some((v) => v.includes("degree")));
});

test("hardware: gamma range enforced; calibration anchors complete", () => {
  const r = fitsHardwareProfile({ gamma: 5, couplings: [] }, DEFAULT_NONSTOQ_PROFILE);
  assert.ok(!r.fits);
  assert.ok(r.violations[0]!.includes("gamma"));
  assert.equal(CALIBRATION_ANCHORS.length, 4);
  for (const a of CALIBRATION_ANCHORS) {
    assert.ok(a.derivesFrom.length > 0 && a.expectation.length > 0);
  }
});
