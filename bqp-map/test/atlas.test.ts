import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkAtlas, runMachineCertificates, verdictGroups } from "../src/atlas/check.js";
import { ATLAS } from "../src/atlas/entries.js";
import { VERDOC_ORDER } from "../src/atlas/types.js";

describe("T5 atlas discipline", () => {
  it("every entry is certificate-backed per the discipline map", () => {
    const { violations } = checkAtlas();
    assert.deepEqual(violations, []);
  });

  it("atlas covers the verdict taxonomy broadly", () => {
    const groups = verdictGroups();
    const populated = VERDOC_ORDER.filter((v) => (groups.get(v) as unknown[]).length > 0);
    assert.ok(populated.length >= 7, `only ${populated.length} verdicts populated`);
    for (const must of ["P-EXACT", "CONDITIONAL-WALL", "QUERY-WALL", "HW-WAIT", "INFO-WALL", "VERIFICATION-GAP", "HEURISTIC", "MECHANISM-SETTLED"]) {
      assert.ok((groups.get(must) as unknown[]).length >= 1, `${must} missing`);
    }
  });

  it("ids are unique and cross-prototype certificates resolve to workspace prototypes", () => {
    const ids = new Set(ATLAS.map((e) => e.id));
    assert.equal(ids.size, ATLAS.length);
    for (const e of ATLAS) {
      for (const cert of e.certs) {
        if (cert.kind === "cross-prototype") {
          assert.match(cert.ref, /^(qram-sched|ft-qaoa|nonstoq-anneal|qverify|quantum-mech|ent-sched|switch-sched|causal-ineq|k-switch|vacuum-compiler|dsic-noether|postselect-sched|retro-cache|depreciation-ledger|route-price|burial-record|readout-wall|nosignal-tariff|choice-lang|binding-price|wukong-crossval|survivor-census|ent-clearing|stable-world|mutant-census|dtc-clock|letter-audit|ds_extracted\/ds)$/);
        }
      }
    }
  });

  it("every machine certificate re-runs green", () => {
    const checks = runMachineCertificates();
    for (const c of checks) {
      assert.ok(c.pass, `${c.id} FAILED: ${c.detail}`);
    }
  });
});
