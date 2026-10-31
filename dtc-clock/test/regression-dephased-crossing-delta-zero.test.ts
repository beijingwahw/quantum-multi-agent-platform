import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DtcError } from "../src/core/errors.js";
import { dephasedLifetimeCrossing } from "../src/kernel/beat.js";
import { makeRng } from "../src/core/rng.js";

/**
 * Regression (2026-11-01): dephasedLifetimeCrossing with delta = 0 used to
 * fall through unguarded — isolatedEchoLifetime returns +Infinity when
 * |cos 2 delta| = 1, so the crossing probed k = tau* - 1 = Infinity and
 * dephasedEchoSample's k-loop would never terminate (the hang was latent:
 * every existing caller passes delta >= 0.2). The guard refuses by name.
 */
describe("regression: dephasedLifetimeCrossing refuses delta = 0 (E/DOMAIN)", () => {
  it("the guard fires before any sampling, with the named code", () => {
    let code: string | undefined;
    try {
      dephasedLifetimeCrossing(makeRng(1), 0, 0.5, 10);
    } catch (e) {
      assert.ok(e instanceof DtcError, `the refusal must be a DtcError, got ${String(e)}`);
      code = e.code;
    }
    assert.equal(code, "E/DOMAIN", "delta = 0 must be refused as E/DOMAIN, not hang or return");
  });

  it("a legal delta still crosses (the guard changed nothing else)", () => {
    const c = dephasedLifetimeCrossing(makeRng(0x5eed47), 0.2, 0.5, 40000);
    assert.ok(c.below > 0.5 && c.at < 0.5, `the crossing must persist: below ${c.below} at ${c.at}`);
  });
});
