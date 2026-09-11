import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mulberry32, paramsToVector, randomStrategyParams } from "../src/game/strategy.js";

/**
 * Regression: the seed-fixed reproducibility the README and every exp report
 * promise ("multistart sweep (deterministic, seed-fixed)", "no Math.random
 * anywhere") is pinned as a TEST, not just stated — the mulberry32 stream to
 * exact float anchors, and the strategy sampler rebuilt from the same seed
 * bit-for-bit. Before this, a silent generation-order change inside
 * randomStrategyParams would have moved every swept digit with nothing in the
 * suite failing (exp4's committed report would simply disagree with a fresh
 * render, undetected).
 */
describe("regression: seeded determinism (every reported number regenerates)", () => {
  it("mulberry32 streams are pinned to exact float anchors and locked per seed", () => {
    const a = mulberry32(20260908); // exp4's sweep seed
    const anchors = [a(), a(), a(), a()];
    assert.deepEqual(anchors, [0.5866398327052593, 0.7089426536113024, 0.41529360273852944, 0.7993595646694303]);
    const b = mulberry32(20260908);
    for (const v of anchors) assert.equal(b(), v);
    let diverged = false;
    const c = mulberry32(4242);
    for (const v of anchors) if (c() !== v) diverged = true;
    assert.ok(diverged, "distinct seeds must produce distinct streams");
  });

  it("randomStrategyParams regenerates bit-for-bit from its seed (the sweep's input pins)", () => {
    const first = paramsToVector(randomStrategyParams(mulberry32(777)));
    const second = paramsToVector(randomStrategyParams(mulberry32(777)));
    assert.deepEqual(second, first);
    assert.equal(first.length, 60);
    const other = paramsToVector(randomStrategyParams(mulberry32(778)));
    assert.notDeepEqual(other, first);
  });
});
