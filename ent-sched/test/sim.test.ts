import { deepStrictEqual, ok } from "node:assert";
import { describe, it } from "node:test";

import { runSim, type NetSpec, type RequestSpec } from "../src/net/engine.js";
import { ersPolicy, swapAsapPolicy, swapLatePolicy, tdmPolicy } from "../src/net/policies.js";
import { Topology } from "../src/net/topology.js";

function chainNet(
  links: number,
  opts: {
    p?: number;
    slots?: number;
    f0?: number;
    t2?: number;
    cutOff?: number;
    qSwap?: number;
  } = {}
): NetSpec {
  const nodes = Array.from({ length: links + 1 }, (_, i) => `n${i}`);
  const ls = Array.from({ length: links }, (_, i) => ({
    id: `l${i}`,
    a: `n${i}`,
    b: `n${i + 1}`,
    p: opts.p ?? 0.5,
    slots: opts.slots ?? 1,
    f0: opts.f0 ?? 0.99,
  }));
  return {
    nodes,
    links: ls,
    qSwap: opts.qSwap ?? 0.9,
    ...(opts.t2 !== undefined ? { t2: opts.t2 } : {}),
    ...(opts.cutOff !== undefined ? { cutOff: opts.cutOff } : {}),
  };
}

function starNet(slots = 4): NetSpec {
  return {
    nodes: ["h", "u1", "u2", "u3"],
    links: [
      { id: "s1", a: "u1", b: "h", p: 0.5, slots, f0: 0.99 },
      { id: "s2", a: "u2", b: "h", p: 0.5, slots, f0: 0.99 },
      { id: "s3", a: "u3", b: "h", p: 0.5, slots, f0: 0.99 },
    ],
    qSwap: 0.9,
  };
}

const starRequests: RequestSpec[] = [
  { id: "r12", src: "u1", dst: "u2", fMin: 0.9 },
  { id: "r23", src: "u2", dst: "u3", fMin: 0.9 },
  { id: "r13", src: "u1", dst: "u3", fMin: 0.9 },
];

describe("engine bookkeeping", () => {
  it("deterministic single link p=1: exact generation/delivery counts", () => {
    const net = chainNet(1, { p: 1, slots: 2, f0: 0.9 });
    const rep = runSim({
      net,
      requests: [{ id: "r", src: "n0", dst: "n1", fMin: 0.8 }],
      policy: swapAsapPolicy(new Topology(net), [{ id: "r", src: "n0", dst: "n1", fMin: 0.8 }]),
      seed: 1,
      rounds: 100,
      warmupRounds: 0,
    });
    ok(rep.counters.attempts === 200, `attempts ${rep.counters.attempts}`);
    ok(rep.counters.generated === 200, `generated ${rep.counters.generated}`);
    ok(rep.counters.good === 200, `good ${rep.counters.good}`);
    ok(rep.counters.bad === 0);
    ok(Math.abs(rep.aggregate.goodput - 2) < 1e-12);
    ok(Math.abs(rep.aggregate.meanFidelity - 0.9) < 1e-12);
  });

  it("same seed → identical report; different seed → different", () => {
    const net = chainNet(3, { p: 0.4 });
    const reqs: RequestSpec[] = [{ id: "r", src: "n0", dst: "n3", fMin: 0.9 }];
    const mk = (seed: number) =>
      runSim({
        net,
        requests: reqs,
        policy: swapAsapPolicy(new Topology(net), reqs),
        seed,
        rounds: 5000,
      });
    deepStrictEqual(mk(42), mk(42));
    const a = mk(42);
    const b = mk(43);
    ok(a.counters.good !== b.counters.good || a.counters.attempts !== b.counters.attempts);
  });

  it("swap-asap and swap-late coincide exactly on a 2-link chain (M=1, single request)", () => {
    const net = chainNet(2, { p: 0.35, qSwap: 0.8 });
    const reqs: RequestSpec[] = [{ id: "r", src: "n0", dst: "n2", fMin: 0.9 }];
    const a = runSim({
      net,
      requests: reqs,
      policy: swapAsapPolicy(new Topology(net), reqs),
      seed: 9,
      rounds: 20000,
    });
    const b = runSim({
      net,
      requests: reqs,
      policy: swapLatePolicy(new Topology(net), reqs),
      seed: 9,
      rounds: 20000,
    });
    deepStrictEqual(a.counters, b.counters);
    deepStrictEqual(a.aggregate, b.aggregate);
  });
});

describe("fairness under contention", () => {
  it("TDM splits a shared star into equal long-run shares", () => {
    const net = starNet();
    const rep = runSim({
      net,
      requests: starRequests,
      policy: tdmPolicy(new Topology(net), starRequests, 300),
      seed: 7,
      rounds: 120000,
    });
    const gs = Object.values(rep.perRequest).map((x) => x.goodput);
    const mx = Math.max(...gs);
    const mn = Math.min(...gs);
    ok(mn > mx * 0.85, `shares ${gs.map((g) => g.toFixed(5)).join(", ")}`);
    ok(rep.aggregate.jain > 0.98, `jain ${rep.aggregate.jain}`);
  });

  it("ERS keeps deficit-fair shares on the same star", () => {
    const net = starNet();
    const rep = runSim({
      net,
      requests: starRequests,
      policy: ersPolicy(new Topology(net), starRequests),
      seed: 7,
      rounds: 120000,
    });
    ok(rep.aggregate.jain > 0.9, `jain ${rep.aggregate.jain}`);
    ok(rep.aggregate.goodput > 0.5 * 3 * 1e-4 + 1e-9, "positive goodput");
  });
});

describe("purification ladder (ERS)", () => {
  it("noisy single link: ERS purifies 2→1 until fMin is met (needs ≥4 slots)", () => {
    const net: NetSpec = {
      nodes: ["A", "B"],
      links: [{ id: "l", a: "A", b: "B", p: 0.9, slots: 4, f0: 0.85 }],
      qSwap: 0.9,
    };
    const reqs: RequestSpec[] = [{ id: "r", src: "A", dst: "B", fMin: 0.95 }];
    const rep = runSim({
      net,
      requests: reqs,
      policy: ersPolicy(new Topology(net), reqs),
      seed: 21,
      rounds: 100000,
    });
    const r = rep.perRequest["r"]!; // request "r" is in every report by construction
    ok(r.good > 500, `good ${r.good}`);
    ok(r.meanFidelity >= 0.94, `meanF ${r.meanFidelity}`);
    ok(r.bad === 0, `bad ${r.bad} (strict QoS holds below threshold)`);
    ok(rep.counters.purifies > 5 * r.good, `purifies ${rep.counters.purifies} good ${r.good}`);
  });
});

describe("cutoff policy under decoherence", () => {
  it("cutoffs reduce below-threshold deliveries and raise good throughput", () => {
    const run = (cutOff?: number) => {
      const base = chainNet(4, { p: 0.3, slots: 1, t2: 300, qSwap: 0.9 });
      const eff: NetSpec = cutOff === undefined ? base : { ...base, cutOff };
      const reqs: RequestSpec[] = [{ id: "r", src: "n0", dst: "n4", fMin: 0.9 }];
      return runSim({
        net: eff,
        requests: reqs,
        policy: swapLatePolicy(new Topology(eff), reqs),
        seed: 33,
        rounds: 100000,
      });
    };
    const withCut = run(6);
    const noCut = run(undefined);
    const badRatio = (x: ReturnType<typeof run>) =>
      x.counters.bad / Math.max(1, x.counters.good + x.counters.bad);
    ok(
      badRatio(withCut) < badRatio(noCut) * 0.7,
      `bad ratios: cut=${badRatio(withCut).toFixed(3)} nocut=${badRatio(noCut).toFixed(3)}`
    );
    ok(
      withCut.counters.good > noCut.counters.good,
      `good: cut=${withCut.counters.good} nocut=${noCut.counters.good}`
    );
    ok(withCut.counters.cutoffs > 1000, `cutoffs ${withCut.counters.cutoffs}`);
  });
});

describe("topology utilities", () => {
  it("kShortestPaths enumerates and ranks simple paths", () => {
    const net: NetSpec = {
      nodes: ["A", "B", "C", "D"],
      links: [
        { id: "ab", a: "A", b: "B", p: 0.5, slots: 1, f0: 0.99 },
        { id: "bc", a: "B", b: "C", p: 0.5, slots: 1, f0: 0.99 },
        { id: "ad", a: "A", b: "D", p: 0.5, slots: 1, f0: 0.99 },
        { id: "dc", a: "D", b: "C", p: 0.5, slots: 1, f0: 0.99 },
      ],
      qSwap: 0.9,
    };
    const topo = new Topology(net);
    const paths = topo.kShortestPaths("A", "C", 3);
    ok(paths.length === 2, `paths ${paths.length}`);
    ok(paths.every((p) => p.links.length === 2));
    const sp = topo.shortestPath("A", "C");
    ok(sp !== null && sp.links.length === 2);
  });

  it("kShortestPaths ranks by hops before ET", () => {
    const net: NetSpec = {
      nodes: ["A", "B", "C"],
      links: [
        { id: "ab1", a: "A", b: "B", p: 0.9, slots: 1, f0: 0.99 },
        { id: "bc1", a: "B", b: "C", p: 0.9, slots: 1, f0: 0.99 },
        { id: "ac", a: "A", b: "C", p: 0.05, slots: 1, f0: 0.99 },
      ],
      qSwap: 0.9,
    };
    const paths = new Topology(net).kShortestPaths("A", "C", 2);
    // this graph has exactly two A→C simple paths: direct "ac" and A→B→C
    ok(paths[0]!.links.length === 1 && paths[0]!.links[0]! === "ac");
    ok(paths[1]!.links.length === 2);
  });
});
