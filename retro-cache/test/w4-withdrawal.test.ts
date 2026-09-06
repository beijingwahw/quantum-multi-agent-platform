import test from "node:test";
import assert from "node:assert/strict";
import { wernerPair } from "../src/kernel/state.js";
import { h2, withdrawalRow } from "../src/kernel/tariff.js";

test("W4.A QBER two-path and the net-rate formula", () => {
  for (const p of [1, 0.9, 0.5, 0]) {
    const row = withdrawalRow(wernerPair(p), p);
    assert.ok(Math.abs(row.qberTable - row.qberClosed) < 1e-14, `p=${p}: QBER two-path`);
    assert.ok(Math.abs(row.netRate - 0.5 * (1 - h2(row.qberClosed))) < 1e-15, `p=${p}: net formula`);
    assert.equal(row.settingsTariff, 1);
  }
});

test("W4.B the ledger's honest zeros: p=1 noiseless nets 1/2; p=0 nets exactly 0", () => {
  const perfect = withdrawalRow(wernerPair(1), 1);
  assert.ok(Math.abs(perfect.netRate - 0.5) < 1e-15, `p=1 net (got ${perfect.netRate})`);
  const seed = withdrawalRow(wernerPair(0), 0);
  assert.ok(Math.abs(seed.qberClosed - 0.5) < 1e-15);
  assert.ok(Math.abs(seed.netRate - 0) < 1e-15, `p=0 net exactly 0 — the seed is the cache's floor`);
});

test("W4.C h2 anchors", () => {
  assert.ok(Math.abs(h2(0.5) - 1) < 1e-15);
  assert.ok(Math.abs(h2(0.11002786443715186) - 0.5) < 1e-9, "the h2 = 1/2 point");
  assert.equal(h2(0), 0);
  assert.equal(h2(1), 0);
});

test("W4.D monotone ledger: net rate decreases with QBER", () => {
  let prev = Number.POSITIVE_INFINITY;
  for (const p of [1, 0.95, 0.9, 0.8, 0.6, 0.4, 0.2, 0]) {
    const row = withdrawalRow(wernerPair(p), p);
    assert.ok(row.netRate <= prev + 1e-15, `p=${p}: net not monotone`);
    prev = row.netRate;
  }
});
