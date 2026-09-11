/**
 * Regression tests for boundary defects fixed in this upgrade:
 *
 *  1. ENGINE_UNKNOWN_OWNER — the engine used to accept attempt allocations
 *     carrying an owner id that is not a request id: the generated pair could
 *     never complete or deliver, and it silently occupied its memory slot
 *     forever (measured: attempts froze at round 0 of a 50-round p=1 run,
 *     zero deliveries, no error). Now a named rejection at consumption.
 *  2. PURIFY_ZERO_PROBABILITY also covers the p > 1 face — unphysical inputs
 *     (e.g. f₁ = 1.2) used to produce a "probability" > 1 that bernoulli
 *     clamped silently, shipping a garbage Werner state as a success.
 */
import { ok, throws } from "node:assert";
import { describe, it } from "node:test";

import { runSim, type NetSpec, type Policy, type RequestSpec } from "../src/net/engine.js";
import { purify2to1 } from "../src/physics/ops.js";
import { bellVec, werner } from "../src/physics/bell.js";
import { isCodedError } from "../src/core/errors.js";
import { Rng } from "../src/core/rng.js";

const net: NetSpec = {
  nodes: ["A", "B"],
  links: [{ id: "l", a: "A", b: "B", p: 1, slots: 1, f0: 0.99 }],
  qSwap: 0.9,
};
const reqs: RequestSpec[] = [{ id: "r", src: "A", dst: "B", fMin: 0.5 }];

describe("regression: ghost-owner allocations are named and rejected", () => {
  it("a policy allocating slots to a non-request owner throws ENGINE_UNKNOWN_OWNER (was silent slot poisoning)", () => {
    const ghost: Policy = {
      name: "ghost",
      allocateAttempts: () => new Map([["l", ["GHOST"]]]),
      decideOps: () => ({ swaps: [], purifies: [], discards: [] }),
    };
    throws(
      () => runSim({ net, requests: reqs, policy: ghost, seed: 1, rounds: 10, warmupRounds: 0 }),
      (err: unknown) => isCodedError(err) && err.code === "ENGINE_UNKNOWN_OWNER" && /'GHOST'/.test(err.message),
    );
  });

  it("legal owners still allocate: the guard does not over-reject", () => {
    const honest: Policy = {
      name: "honest",
      allocateAttempts: () => new Map([["l", ["r"]]]),
      decideOps: () => ({ swaps: [], purifies: [], discards: [] }),
    };
    const rep = runSim({ net, requests: reqs, policy: honest, seed: 1, rounds: 5, warmupRounds: 0 });
    ok(rep.counters.attempts === 5, `attempts ${rep.counters.attempts}`);
    ok(rep.counters.good === 5, `good ${rep.counters.good}`);
  });
});

describe("regression: purify2to1 rejects the p > 1 face of unphysical inputs", () => {
  it("f₁ = 1.2 (negative Werner weight) used to give p ≈ 1.30 clamped silently — now named", () => {
    const a = bellVec(1.2, -0.1, -0.1, -0.1);
    const b = bellVec(1.2, -0.1, -0.1, -0.1);
    // pre-fix arithmetic: p = (f+w)² + 4w² = 1.13…² + 4·0.0667² ≈ 1.302 > 1
    throws(
      () => purify2to1(a, b),
      (err: unknown) => isCodedError(err) && err.code === "PURIFY_ZERO_PROBABILITY",
    );
  });

  it("physical boundary inputs still pass: f = 1 gives p exactly 1 and identity output", () => {
    const { p, out } = purify2to1(werner(1), werner(1));
    ok(p === 1, `p ${p}`);
    ok(out[0] === 1, `out F ${out[0]}`);
  });
});

describe("regression: the rng twin carries the ft-qaoa guards (refuse before any draw)", () => {
  // convicted: this rng is the verbatim port of ft-qaoa's, but when wave R5
  // guarded the twin's range/int degenerate domains this copy was missed —
  // int(2.5) drew 0/1/2 at 40/40/20 and range(1, 0) silently drew descending
  // garbage. The guards sit BEFORE any draw, so legal streams are unchanged.
  it("int refuses non-integer / <1 / non-finite domains by name (RNG_INT_RANGE)", () => {
    for (const bad of [0, -1, 2.5, Number.POSITIVE_INFINITY, Number.NaN]) {
      throws(
        () => new Rng(9).int(bad),
        (err: unknown) => isCodedError(err) && err.code === "RNG_INT_RANGE" && err.message.includes(String(bad)),
      );
    }
  });

  it("range refuses reversed / non-finite bounds by name (RNG_RANGE)", () => {
    throws(
      () => new Rng(9).range(1, 0),
      (err: unknown) => isCodedError(err) && err.code === "RNG_RANGE",
    );
    throws(
      () => new Rng(9).range(Number.NaN, 1),
      (err: unknown) => isCodedError(err) && err.code === "RNG_RANGE",
    );
  });

  it("the refusals sit before any draw; legal draws are the unchanged stream", () => {
    const refused = new Rng(9);
    throws(() => refused.int(0), /RNG_INT_RANGE/);
    const fresh = new Rng(9);
    ok(refused.next() === fresh.next(), "a refused call must not consume a draw");
    // int(n) still floors the same stream a bare next() produces
    const r = new Rng(42);
    const draws = [r.next(), r.next(), r.next()];
    const r2 = new Rng(42);
    for (const u of draws) {
      const k = r2.int(1000);
      ok(k === Math.floor(u * 1000) && k >= 0 && k < 1000);
    }
    // range still interpolates the same stream
    const r3 = new Rng(7);
    const u0 = r3.next();
    const r4 = new Rng(7);
    ok(r4.range(0.3, 1) === 0.3 + 0.7 * u0);
  });
});
