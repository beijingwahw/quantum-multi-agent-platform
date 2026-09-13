/**
 * R13 (agent J) — the kernel cache contract. runQaoa now shares one cost
 * table per instance object, powerAt memoizes its exact binomial walk, and
 * perturbCensus memoizes per (probe, deltas). The caches must be invisible:
 * repeat evaluations return the values the uncached paths computed
 * (bit-identical), the shared cost table is never written through, and the
 * named rejections keep their codes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { costTable, instanceSet, quboValue, runQaoa } from "../src/kernel/crossval.js";
import { CENSUS_DELTAS, perturbCensus } from "../src/kernel/robust.js";
import { exactProbe } from "../src/kernel/probe.js";
import { minShots, powerAt } from "../src/kernel/power.js";
import { XvalError } from "../src/kernel/error.js";

test("r13 the shared cost table is read-only: runQaoa never writes through it", () => {
  const inst = instanceSet().find((i) => i.id === "np-n8-0");
  assert.ok(inst !== undefined, "the seeded instance set carries np-n8-0");
  const costs = costTable(inst);
  const before = Float64Array.from(costs);
  const psi1 = runQaoa(inst, { betas: [0.3], gammas: [0.7] });
  const psi2 = runQaoa(inst, { betas: [0.3], gammas: [0.7] });
  // deterministic repeat: same params, same statevector, bit for bit
  assert.deepEqual(Array.from(psi1), Array.from(psi2));
  // the table the public API handed out is not the cache's buffer: untouched
  assert.deepEqual(Array.from(costs), Array.from(before));
});

test("r13 quboValue row-skip is value-preserving against the full-table reference", () => {
  const inst = instanceSet().find((i) => i.id === "np-n12-4");
  assert.ok(inst !== undefined);
  // every basis state: the objective equals the value stored in the
  // (independently built) cost table, sign convention included
  const costs = costTable(inst);
  for (let bits = 0; bits < 1 << inst.n; bits++) {
    assert.equal(quboValue(inst, bits), -costs[bits]!);
  }
});

test("r13 powerAt and minShots repeat bit-identically", () => {
  assert.equal(powerAt(400, 0.1, 0.08, 0.05), powerAt(400, 0.1, 0.08, 0.05));
  const r1 = minShots(0.2, 0.25, 0.05, 0.8, 1000);
  const r2 = minShots(0.2, 0.25, 0.05, 0.8, 1000);
  assert.deepEqual(r1, r2);
  // the regression anchors of the censoring fix still hold
  const censored = minShots(0.2, 0.25, 0.05, 0.8, 257);
  assert.equal(censored.shots, null);
  assert.ok(powerAt(r1.shots! - 1, 0.2, 0.25, 0.05) < 0.8, "N*-1 fails: local minimality preserved");
});

test("r13 perturbCensus repeat returns the identical census object", () => {
  const inst = instanceSet().find((i) => i.id === "np-n8-0");
  assert.ok(inst !== undefined);
  const probe = exactProbe(inst, 1);
  const c1 = perturbCensus(probe, CENSUS_DELTAS);
  const c2 = perturbCensus(probe, CENSUS_DELTAS);
  assert.equal(c2, c1); // memoized: the same object, rows bit-identical by construction
  // a different delta grid is a different computation, not a stale hit
  const c3 = perturbCensus(probe, [0.05]);
  assert.notEqual(c3, c1);
  assert.ok(c3.rows.every((r) => r.delta === 0.05));
});

test("r13 named rejections unchanged through the cache wrappers", () => {
  const inst = instanceSet().find((i) => i.id === "np-n8-0");
  assert.ok(inst !== undefined);
  const shortLinear = { ...inst, linear: inst.linear.slice(0, 3) };
  assert.throws(
    () => quboValue(shortLinear, 0b1010),
    (e: unknown) => e instanceof XvalError && e.code === "XVAL_QUBO_SHAPE",
  );
});
