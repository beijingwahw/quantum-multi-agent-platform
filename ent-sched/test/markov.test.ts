import { ok } from "node:assert";
import { describe, it } from "node:test";

import { runSim, type NetSpec, type RequestSpec } from "../src/net/engine.js";
import { swapAsapPolicy } from "../src/net/policies.js";
import { twoLinkChain } from "../src/net/markov.js";
import { Topology } from "../src/net/topology.js";

const chain2 = (t2?: number, cutOff?: number): NetSpec => ({
  nodes: ["n0", "n1", "n2"],
  links: [
    { id: "l0", a: "n0", b: "n1", p: 0.25, slots: 1, f0: 0.99 },
    { id: "l1", a: "n1", b: "n2", p: 0.45, slots: 1, f0: 0.99 },
  ],
  qSwap: 0.9,
  ...(t2 !== undefined ? { t2 } : {}),
  ...(cutOff !== undefined ? { cutOff } : {}),
});

const req: RequestSpec = { id: "r", src: "n0", dst: "n2", fMin: 0 };

describe("exact DTMC referee vs engine (2-link, M=1, swap-asap)", () => {
  it("ageless chain: delivery rate matches the 4-state DTMC", () => {
    const net = chain2();
    const rounds = 1_000_000;
    const rep = runSim({
      net,
      requests: [req],
      policy: swapAsapPolicy(new Topology(net), [req]),
      seed: 101,
      rounds,
    });
    const eng = (rep.counters.good + rep.counters.bad) / rounds;
    const ref = twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0.9, f01: 0.99, f02: 0.99 });
    ok(ref.stateCount === 4, `states ${ref.stateCount}`);
    const tol = Math.max(1e-3, 0.03 * ref.deliveryRate);
    ok(
      Math.abs(eng - ref.deliveryRate) < tol,
      `engine ${eng.toFixed(5)} vs DTMC ${ref.deliveryRate.toFixed(5)} (tol ${tol.toExponential(2)})`
    );
  });

  it("ageless chain: mean delivered fidelity matches", () => {
    const net = chain2();
    const rounds = 400_000;
    const rep = runSim({
      net,
      requests: [req],
      policy: swapAsapPolicy(new Topology(net), [req]),
      seed: 102,
      rounds,
    });
    const ref = twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0.9, f01: 0.99, f02: 0.99 });
    ok(
      Math.abs(rep.aggregate.meanFidelity - ref.meanFidelity) < 5e-4,
      `engine ${rep.aggregate.meanFidelity.toFixed(6)} vs DTMC ${ref.meanFidelity.toFixed(6)}`
    );
  });

  it("aging chain with cutoff (49 states): rate and fidelity match the age DTMC", () => {
    const t2 = 80;
    const cutOff = 5;
    const net = chain2(t2, cutOff);
    const rounds = 600_000;
    const rep = runSim({
      net,
      requests: [req],
      policy: swapAsapPolicy(new Topology(net), [req]),
      seed: 103,
      rounds,
    });
    const ref = twoLinkChain({
      p1: 0.25,
      p2: 0.45,
      qSwap: 0.9,
      f01: 0.99,
      f02: 0.99,
      t2,
      cutOff,
    });
    ok(ref.stateCount === 49, `states ${ref.stateCount}`);
    const eng = (rep.counters.good + rep.counters.bad) / rounds;
    const tolRate = Math.max(1e-3, 0.03 * ref.deliveryRate);
    ok(
      Math.abs(eng - ref.deliveryRate) < tolRate,
      `rate: engine ${eng.toFixed(5)} vs DTMC ${ref.deliveryRate.toFixed(5)}`
    );
    ok(
      Math.abs(rep.aggregate.meanFidelity - ref.meanFidelity) < 1e-3,
      `F: engine ${rep.aggregate.meanFidelity.toFixed(6)} vs DTMC ${ref.meanFidelity.toFixed(6)}`
    );
  });

  it("DTMC sanity: rate = q·π(both full); q=0 → 0; p=1 → q/2 regime", () => {
    const zero = twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0, f01: 0.99, f02: 0.99 });
    ok(zero.deliveryRate === 0);
    const fast = twoLinkChain({ p1: 1, p2: 1, qSwap: 1, f01: 1, f02: 1 });
    // p=1, q=1: both links refill instantly; one delivery every round
    ok(Math.abs(fast.deliveryRate - 1) < 1e-12, `rate ${fast.deliveryRate}`);
    ok(Math.abs(fast.meanFidelity - 1) < 1e-12);
  });
});
