import { ok, throws } from "node:assert";
import { describe, it } from "node:test";

import { runSim } from "../src/net/engine.js";
import { twoLinkChain } from "../src/net/markov.js";
import { isCodedError, SchedError } from "../src/core/errors.js";
import {
  canonicalChain,
  idleShareProbe,
  jainFaceoff,
  parityStallChain,
  parityStallPolicy,
  renewalRate,
  workConservingCensus,
} from "../src/net/conservation.js";

/** Fire `fn`, demand a coded rejection, and return its machine code. */
function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    ok(
      isCodedError(err),
      `error must satisfy the CodedError contract: ${String(err)}`,
    );
    return err.code;
  }
  throw new Error("expected a named rejection, but the call returned silently");
}

const P1 = 0.25;
const P2 = 0.45;
const Q = 0.9;

describe("E8 work-conservation insensitivity (2-link, single request, M=1)", () => {
  it("the renewal closed form IS the 4-state DTMC value — two independent paths, exact", () => {
    for (const [p1, p2, q] of [
      [P1, P2, Q],
      [0.5, 0.5, 0.9],
      [0.3, 0.7, 0.6],
      [1, 1, 1],
      [0.25, 0.45, 0.5],
      [0.02, 0.9, 0.75],
    ] as const) {
      const dtmc = twoLinkChain({ p1, p2, qSwap: q, f01: 0.99, f02: 0.99 });
      const renew = renewalRate(p1, p2, q);
      ok(
        Math.abs(dtmc.deliveryRate - renew) < 1e-12,
        `p=(${p1},${p2}) q=${q}: DTMC ${dtmc.deliveryRate} vs renewal ${renew}`,
      );
    }
  });

  it("INVARIANCE: four structurally distinct work-conserving policies are bit-identical and sit on the DTMC/renewal value", () => {
    const face = canonicalChain(P1, P2, Q);
    const census = workConservingCensus(face, 150_000, 101);
    ok(
      census.bitIdentical,
      "same seed must give the same counter vector on every WC policy",
    );
    ok(census.rows.length === 4);
    const ref = twoLinkChain({
      p1: P1,
      p2: P2,
      qSwap: Q,
      f01: 0.99,
      f02: 0.99,
    });
    const renew = renewalRate(P1, P2, Q);
    for (const row of census.rows) {
      ok(
        Math.abs(row.rate - ref.deliveryRate) < 4 * row.rateSe,
        `${row.policy}: rate ${row.rate.toFixed(5)} vs DTMC ${ref.deliveryRate.toFixed(5)} at se ${row.rateSe.toExponential(2)}`,
      );
      ok(
        Math.abs(row.rate - renew) < 4 * row.rateSe,
        `${row.policy}: vs renewal ${renew.toFixed(5)}`,
      );
      ok(
        row.idleShare === 0,
        `${row.policy}: a work-conserving policy misses no attempt opportunity`,
      );
    }
  });

  it("INVARIANCE on the 49-state age chain: cutoff and T2 do not break the identity", () => {
    const t2 = 80;
    const cutOff = 5;
    const face = canonicalChain(P1, P2, Q);
    const net = { ...face.net, t2, cutOff };
    const aged = { net, request: face.request };
    const census = workConservingCensus(aged, 120_000, 103);
    ok(census.bitIdentical, "the age chain pins the same process");
    const ref = twoLinkChain({
      p1: P1,
      p2: P2,
      qSwap: Q,
      f01: 0.99,
      f02: 0.99,
      t2,
      cutOff,
    });
    ok(ref.stateCount === 49, `states ${ref.stateCount}`);
    for (const row of census.rows) {
      ok(
        Math.abs(row.rate - ref.deliveryRate) < 4 * row.rateSe,
        `${row.policy}: aged rate ${row.rate.toFixed(5)} vs DTMC ${ref.deliveryRate.toFixed(5)}`,
      );
    }
  });

  it("THE CONVICTION: the stalling policy idles nothing, loses real rate, and its loss is exactly the 8-state chain's", () => {
    const face = canonicalChain(P1, P2, Q);
    const probe = idleShareProbe(parityStallPolicy());
    const rounds = 150_000;
    const rep = runSim({
      net: face.net,
      requests: [face.request],
      policy: probe.policy,
      seed: 7,
      rounds,
    });
    const rate = (rep.counters.good + rep.counters.bad) / rounds;
    const se = Math.sqrt(Math.max(rate * (1 - rate), 1e-12) / rounds);
    ok(
      probe.idleShare() === 0,
      "the staller requests every free slot — its idle share is exactly 0",
    );
    const stall = parityStallChain(P1, P2, Q);
    ok(stall.stateCount === 8);
    ok(
      Math.abs(rate - stall.deliveryRate) < 4 * se,
      `engine ${rate.toFixed(6)} vs 8-state ${stall.deliveryRate.toFixed(6)}`,
    );
    const canonical = renewalRate(P1, P2, Q);
    const loss = 1 - stall.deliveryRate / canonical;
    ok(
      loss > 0.05,
      `loss ${loss.toFixed(4)} is order 10% — the identity 'loss = idleShare' dies beyond the WC class`,
    );
    // the exact numbers this theorem ships: the machine's own digits, printed
    ok(
      rep.counters.lastAttemptRound === rounds - 1,
      "the chain never freezes under either face",
    );
  });

  it("the multi-request DATA face: ERS deficit arbitration holds Jain over the round-robin pointer, seed by seed", () => {
    const rows = jainFaceoff([11, 12, 13, 14], 30_000);
    for (const row of rows) {
      ok(
        row.ersJain >= row.rrJain,
        `seed ${row.seed}: ers jain ${row.ersJain.toFixed(5)} vs round-robin ${row.rrJain.toFixed(5)}`,
      );
      // the honest price, disclosed: ERS buys fairness with aggregate goodput
      ok(
        row.ersGoodput < row.rrGoodput,
        `seed ${row.seed}: the goodput tradeoff must be reported, not hidden`,
      );
    }
  });

  it("named rejections at the conservation boundary", () => {
    ok(codeOf(() => renewalRate(-0.1, 0.5, 0.9)) === "CONSERVATION_PARAM");
    ok(codeOf(() => parityStallChain(0.5, 1.5, 0.9)) === "CONSERVATION_PARAM");
    ok(codeOf(() => canonicalChain(0.5, 0.5, 2)) === "CONSERVATION_PARAM");
    ok(
      codeOf(() => workConservingCensus(canonicalChain(P1, P2, Q), 0, 1)) ===
        "CONSERVATION_ROUNDS",
    );
    ok(codeOf(() => jainFaceoff([], 1000)) === "CONSERVATION_SEEDS");
    ok(codeOf(() => jainFaceoff([1], 0.5)) === "CONSERVATION_ROUNDS");
    throws(
      () => renewalRate(Number.NaN, 0.5, 0.9),
      (err: unknown) => err instanceof SchedError,
    );
  });
});
