import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { yFlipReadCensus } from "../src/kernel/clock.js";
import { DEMO_CIRCUIT } from "../src/kernel/audit.js";
import { tombstoneCensus } from "../src/kernel/tombstone.js";

/**
 * Regression: two latent wrong-object defects and one renderer-discipline
 * defect, none of which could move a shipped digit — pinned so they stay
 * that way for the RIGHT reason.
 *
 *  1. yFlipReadCensus implemented (1-q) Z rho Z + q Y rho Y instead of the
 *     documented Y-flip channel (1-q) rho + q Y rho Y — the Z pass ran over
 *     the whole state, not just the q-branch, and the twin carried the same
 *     composition, so their comparison self-masked. Every census row agreed
 *     with the corrected channel only because the orbit trajectory is
 *     basis-diagonal, where Z rho Z = rho exactly. The corrected map is
 *     pinned at both anchors: q=0 is EXACTLY the noiseless orbit (the old
 *     form agreed there too — the defect was invisible on every instance the
 *     census can build; a coherent clock start is what would have exposed it).
 *  2. tombstoneCensus's eigenbasis path rotated complex rho~ by e^{+i(l_j -
 *     l_k)t} against the documented (and evolveRho's) minus sign — invisible
 *     because every caller passes a real eigenbasis matrix (cos is even, the
 *     odd sin parts cancel in the jk sum). The real-input outputs are frozen
 *     here digit for digit.
 *  3. The renderer's entry guard crashed AT IMPORT when argv[1] is undefined
 *     (`pathToFileURL(undefined!)` — a TypeError, the very side effect the
 *     guard exists to prevent). The R3 wave fixed this exact shape in
 *     phase-law; this file pins it here.
 */

describe("regression: the Y-flip wall is the documented channel", () => {
  it("q=0 is EXACTLY the noiseless orbit: fidelity 1, zero entropy, zero back-action", () => {
    const rows = yFlipReadCensus(4, 0, DEMO_CIRCUIT, 3);
    assert.ok(rows.length > 0);
    for (const r of rows) {
      assert.ok(Math.abs(r.advanceFidelity - 1) <= 1e-12, `beat ${r.beat}: ${r.advanceFidelity}`);
      assert.ok(r.clockEntropyBits <= 1e-12, `beat ${r.beat}: entropy ${r.clockEntropyBits}`);
      assert.ok(r.orderBackAction <= 1e-12, `beat ${r.beat}: back-action ${r.orderBackAction}`);
    }
  });

  it("q=1 (the pure-Y wall) keeps the token exactly on schedule — the Pauli wall absorbs Y", () => {
    const rows = yFlipReadCensus(4, 1, DEMO_CIRCUIT, 3);
    for (const r of rows) {
      assert.ok(Math.abs(r.advanceFidelity - 1) <= 1e-12, `beat ${r.beat}: ${r.advanceFidelity}`);
    }
  });

  it("the census twins agree with each other at every q (the twin must not mask the map again)", () => {
    // orderBackAction is |loaded - unloaded twin| under the SAME channel; a
    // future divergence between pauliY and twinY would surface here as a
    // nonzero back-action on the (diagonal) orbit, where the honest reading is 0
    for (const q of [0.1, 0.2, 0.5]) {
      const rows = yFlipReadCensus(4, q, DEMO_CIRCUIT, 3);
      for (const r of rows) {
        assert.ok(r.orderBackAction <= 1e-9, `q=${q} beat ${r.beat}: ${r.orderBackAction}`);
      }
    }
  });
});

describe("regression: the tombstone's eigenbasis road keeps its real-input digits", () => {
  it("tombstoneCensus(5, 1.0, 0.7, 7) reproduces its captured faces (the sign fix moves nothing real)", () => {
    const t = tombstoneCensus(5, 1.0, 0.7, 7);
    // captured from the corrected build; the ledger's own quoted faces are
    // the amplitude 0.6508 and the period error 1.4e-15 (row #10)
    assert.ok(Math.abs(t.gap - 0.18351113348239245) < 1e-12, `gap ${t.gap}`);
    assert.ok(t.groundWorst <= 1e-14);
    assert.ok(t.thermalWorst <= 1e-14);
    assert.ok(Math.abs(t.batteryAmplitude - 0.6508066956701467) < 1e-12, `amplitude ${t.batteryAmplitude}`);
    assert.ok(t.batteryPeriodError <= 1e-14);
    assert.ok(t.crossValidationError <= 1e-14);
    assert.ok(t.solverReconstruction <= 1e-12);
  });
});

describe("regression: the renderer's entry guard never crashes on import", () => {
  it("importing render.ts with argv[1] undefined writes nothing and throws nothing", async () => {
    const dir = resolve(process.cwd(), "out", "reports");
    const before = existsSync(dir) ? readdirSync(dir).join(",") : "";
    const saved = process.argv[1];
    // a caller with no invoked script (node -e, REPL, harness): the old guard
    // did `pathToFileURL(undefined!)` and threw a TypeError AT IMPORT
    process.argv[1] = undefined as unknown as string;
    try {
      await import("../src/experiments/render.js");
    } finally {
      process.argv[1] = saved as string;
    }
    const after = existsSync(dir) ? readdirSync(dir).join(",") : "";
    assert.equal(after, before, "the import must not render");
  });
});
