import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeRng } from "../src/core/rng.js";
import { randomClockCensus } from "../src/kernel/clock.js";
import { DEMO_CIRCUIT } from "../src/kernel/audit.js";

/**
 * Regression: the rng dead-member sweep (int/normal/pick removed, zero
 * callers workspace-wide; the books stayed at 0.21.0 through the sweep) must
 * not disturb the seeded stream — every
 * experiment's reproducibility hangs on it. The values were captured from
 * the pre-sweep mulberry32 (the algorithm is untouched, so the streams are
 * bit-identical); this anchor convicts any accidental change.
 */
describe("regression: the makeRng stream is bit-stable across the dead-member sweep", () => {
  it("makeRng(1) and makeRng(0xd7c10c) reproduce their captured first draws exactly", () => {
    const a = makeRng(1);
    assert.equal(a(), 0.6270739405881613);
    assert.equal(a(), 0.002735721180215478);
    assert.equal(a(), 0.5274470399599522);
    const b = makeRng(0xd7c10c);
    assert.equal(b(), 0.7303576073609293);
    assert.equal(b(), 0.879176402464509);
    assert.equal(b(), 0.7362047352362424);
  });

  it("same seed, same stream: two independent instances agree draw for draw", () => {
    const r1 = makeRng(20260906);
    const r2 = makeRng(20260906);
    for (let k = 0; k < 64; k++) assert.equal(r1(), r2());
  });

  it("same seed, same census: a seeded census re-runs byte-identically (the repro contract at the pipeline level)", () => {
    // the rng anchor above pins the stream primitive; this pins the WHOLE
    // seeded pipeline — the census every witness and render consumes must be
    // bit-identical across independent runs, not merely statistically close
    const runA = randomClockCensus(makeRng(31), 4, DEMO_CIRCUIT, 3, 3);
    const runB = randomClockCensus(makeRng(31), 4, DEMO_CIRCUIT, 3, 3);
    assert.equal(JSON.stringify(runA), JSON.stringify(runB));
    // the legal neighbor: a DIFFERENT seed must produce a different census —
    // the equality above is content, not a constant-returning stub
    const runC = randomClockCensus(makeRng(32), 4, DEMO_CIRCUIT, 3, 3);
    assert.notEqual(JSON.stringify(runA), JSON.stringify(runC));
  });
});
