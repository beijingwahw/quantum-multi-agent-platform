import { deepStrictEqual, ok, throws } from "node:assert";
import { describe, it } from "node:test";

import { fromReal, mul, zeros } from "../src/core/cx.js";
import { isCodedError, SchedError } from "../src/core/errors.js";
import { Rng } from "../src/core/rng.js";
import { bellVec } from "../src/physics/bell.js";
import {
  purify2to1,
  purifyLadder,
  purifyWerner,
  wernerSwapChainF,
  wernerSwapChainVec,
} from "../src/physics/ops.js";
import { runSim, type EngineView, type NetSpec, type Policy, type RequestSpec } from "../src/net/engine.js";
import { twoLinkChain } from "../src/net/markov.js";
import { ersPolicy, projectedFidelity, swapAsapPolicy, tdmPolicy } from "../src/net/policies.js";
import { auditQosClaims, LinkF0Bank, SensorGuardError, triangularNoise } from "../src/net/sensors.js";
import { Topology, type LinkSpec } from "../src/net/topology.js";

/** Fire `fn`, demand a coded rejection, and return its machine code. */
function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    ok(isCodedError(err), `error must satisfy the CodedError contract: ${String(err)}`);
    return err.code;
  }
  throw new Error("expected a named rejection, but the call returned silently");
}

const link = (over: Partial<LinkSpec> = {}): LinkSpec => ({
  id: "l0",
  a: "n0",
  b: "n1",
  p: 0.5,
  slots: 1,
  f0: 0.99,
  ...over,
});

const net = (links: LinkSpec[], over: Partial<NetSpec> = {}): NetSpec => ({
  nodes: ["n0", "n1", "n2"],
  links,
  qSwap: 0.9,
  ...over,
});

const req: RequestSpec = { id: "r", src: "n0", dst: "n1", fMin: 0.9 };

describe("coded error contract (face B)", () => {
  it("every rejection carries a stable code and a message that opens with it", () => {
    ok(
      codeOf(() => {
        fromReal(2, [
          [1, 2, 3],
          [4, 5],
        ]);
      }) === "KERNEL_SHAPE_MISMATCH"
    );
    ok(
      codeOf(() => {
        mul(zeros(2), zeros(3));
      }) === "KERNEL_SIZE_MISMATCH"
    );
    const err = new SchedError("X_CODE", "detail text");
    ok(err instanceof Error && err instanceof SchedError);
    ok(err.message === "X_CODE: detail text");
    ok(isCodedError(err));
    ok(!isCodedError(new Error("no code")));
  });

  it("SensorGuardError satisfies the same contract (message format unchanged)", () => {
    const err = new SensorGuardError("ILLEGAL_SAMPLE_VALUE", "2.5 is not a fidelity reading");
    ok(err instanceof SensorGuardError && err.code === "ILLEGAL_SAMPLE_VALUE");
    ok(err.message === "ILLEGAL_SAMPLE_VALUE: 2.5 is not a fidelity reading");
    ok(isCodedError(err));
  });
});

describe("physics + topology smuggling trials (face B)", () => {
  it("TRIAL: purify2to1 fed unphysical vectors is NAMED and REJECTED", () => {
    // f1=-10, f2=10 drives the recurrence probability negative — no physical
    // Bell vector can produce this, and the guard names it instead of
    // returning a garbage Werner state
    ok(
      codeOf(() => {
        purify2to1(bellVec(-10, 4, 4, 2), bellVec(10, -3, -3, -4));
      }) === "PURIFY_ZERO_PROBABILITY"
    );
  });

  it("TRIAL: a link with an undeclared endpoint is NAMED and REJECTED (was silently dropped)", () => {
    throws(
      () => {
        new Topology(net([link({ b: "GHOST" })]));
      },
      (err: unknown) => err instanceof SchedError && isCodedError(err) && err.code === "TOPOLOGY_SPEC" && /'GHOST'/.test(err.message)
    );
  });

  it("TRIAL: duplicate link ids / bad probabilities / fractional slots are NAMED and REJECTED", () => {
    ok(
      codeOf(() => {
        new Topology(net([link(), link({ id: "l0", a: "n1", b: "n2" })]));
      }) === "TOPOLOGY_SPEC"
    );
    ok(
      codeOf(() => {
        new Topology(net([link({ p: 1.5 })]));
      }) === "TOPOLOGY_SPEC"
    );
    ok(
      codeOf(() => {
        new Topology(net([link({ f0: Number.NaN })]));
      }) === "TOPOLOGY_SPEC"
    );
    ok(
      codeOf(() => {
        new Topology(net([link({ slots: 0.5 })]));
      }) === "TOPOLOGY_SPEC"
    );
    ok(
      codeOf(() => {
        new Topology(net([link()], { qSwap: -0.1 }));
      }) === "TOPOLOGY_SPEC"
    );
    ok(
      codeOf(() => {
        new Topology(net([link()], { cutOff: 2.5 }));
      }) === "TOPOLOGY_SPEC"
    );
  });

  it("TRIAL: pathEt on an unknown link id is NAMED and REJECTED (was silently p=1)", () => {
    const topo = new Topology(net([link()]));
    ok(
      codeOf(() => {
        topo.pathEt(["nope"]);
      }) === "TOPOLOGY_UNKNOWN_LINK"
    );
  });

  it("negative control: degenerate-but-legal specs still construct", () => {
    // p=0, qSwap=0, f0=1, cutOff=0 are all inside [0,1]/≥0 — the validator
    // must not over-reject them
    const t = new Topology(net([link({ p: 0, f0: 1, slots: 1 })], { qSwap: 0, cutOff: 0 }));
    ok(t.linkById.size === 1);
    ok(t.pathEt(["l0"]) === Number.POSITIVE_INFINITY); // 1/p with p=0
  });
});

describe("sim-config smuggling trials (face B)", () => {
  const goodNet = net([link()]);

  it("TRIAL: zero rounds / warmup swallowing the run are NAMED and REJECTED", () => {
    ok(
      codeOf(() => {
        runSim({ net: goodNet, requests: [req], policy: swapAsapPolicy(new Topology(goodNet), [req]), seed: 1, rounds: 0 });
      }) === "SIM_CONFIG_ROUNDS"
    );
    ok(
      codeOf(() => {
        runSim({ net: goodNet, requests: [req], policy: swapAsapPolicy(new Topology(goodNet), [req]), seed: 1, rounds: 10, warmupRounds: 10 });
      }) === "SIM_CONFIG_WARMUP"
    );
  });

  it("TRIAL: duplicate request ids / ghost endpoints / out-of-range fMin are NAMED and REJECTED", () => {
    const dup: RequestSpec[] = [req, { ...req }];
    ok(
      codeOf(() => {
        runSim({ net: goodNet, requests: dup, policy: swapAsapPolicy(new Topology(goodNet), dup), seed: 1, rounds: 10 });
      }) === "SIM_CONFIG_REQUEST"
    );
    const ghost: RequestSpec = { id: "g", src: "n0", dst: "GHOST", fMin: 0.5 };
    ok(
      codeOf(() => {
        // policy built for the legal request; the smuggled one enters only
        // through the sim config, so SIM_CONFIG_REQUEST is what must fire
        runSim({ net: goodNet, requests: [ghost], policy: swapAsapPolicy(new Topology(goodNet), [req]), seed: 1, rounds: 10 });
      }) === "SIM_CONFIG_REQUEST"
    );
    const hiF: RequestSpec = { id: "h", src: "n0", dst: "n1", fMin: 1.2 };
    ok(
      codeOf(() => {
        runSim({ net: goodNet, requests: [hiF], policy: swapAsapPolicy(new Topology(goodNet), [hiF]), seed: 1, rounds: 10 });
      }) === "SIM_CONFIG_REQUEST"
    );
  });

  it("TRIAL: malformed policies and sensor plans are NAMED and REJECTED", () => {
    const brokenPolicy = { name: "broken", allocateAttempts: (): Map<string, string[]> => new Map() } as unknown as Policy;
    ok(
      codeOf(() => {
        runSim({ net: goodNet, requests: [req], policy: brokenPolicy, seed: 1, rounds: 10 });
      }) === "SIM_CONFIG_POLICY"
    );
    ok(
      codeOf(() => {
        runSim({
          net: goodNet,
          requests: [req],
          policy: swapAsapPolicy(new Topology(goodNet), [req]),
          seed: 1,
          rounds: 10,
          sensors: { bank: new LinkF0Bank(0), calibRate: 1.5, tomoSigma: 0.01 },
        });
      }) === "SIM_CONFIG_SENSORS"
    );
    ok(
      codeOf(() => {
        triangularNoise(new Rng(1), -0.01);
      }) === "SENSOR_BAD_SIGMA"
    );
    ok(
      codeOf(() => {
        auditQosClaims([], 1.5);
      }) === "QOS_AUDIT_BAD_FMIN"
    );
  });

  it("negative control: the validator lets a minimal legal run through, with exact counts", () => {
    const one = net([link({ p: 1, f0: 1 })], { qSwap: 0 });
    const rep = runSim({
      net: one,
      requests: [{ id: "r", src: "n0", dst: "n1", fMin: 0 }],
      policy: swapAsapPolicy(new Topology(one), [{ id: "r", src: "n0", dst: "n1", fMin: 0 }]),
      seed: 7,
      rounds: 1,
      warmupRounds: 0,
    });
    ok(rep.counters.attempts === 1, `attempts ${rep.counters.attempts}`);
    ok(rep.counters.generated === 1, `generated ${rep.counters.generated}`);
    ok(rep.counters.good === 1, `good ${rep.counters.good}`);
    ok(rep.aggregate.goodput === 1, `goodput ${rep.aggregate.goodput}`);
    ok(rep.aggregate.meanFidelity === 1);
  });
});

describe("policy + markov smuggling trials (face B)", () => {
  it("TRIAL: policies asked for the impossible are NAMED and REJECTED", () => {
    ok(
      codeOf(() => {
        tdmPolicy(new Topology(net([link()])), []);
      }) === "TDM_NO_REQUESTS"
    );
    // n2 is a declared node but unreachable: zero links in the net
    const island = net([]);
    const unreachable: RequestSpec = { id: "u", src: "n0", dst: "n2", fMin: 0.5 };
    ok(
      codeOf(() => {
        swapAsapPolicy(new Topology(island), [unreachable]);
      }) === "POLICY_NO_PATH"
    );
    ok(
      codeOf(() => {
        ersPolicy(new Topology(island), [unreachable]);
      }) === "POLICY_NO_PATH"
    );
    ok(
      codeOf(() => {
        projectedFidelity({ round: 0 } as unknown as EngineView, []);
      }) === "PROJECTED_FIDELITY_EMPTY_TILING"
    );
  });

  it("TRIAL: the DTMC referee names its unrepresentable parameter sets", () => {
    ok(
      codeOf(() => {
        twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0.9, f01: 0.99, f02: 0.99, t2: 80 });
      }) === "MARKOV_INFINITE_STATE_SPACE"
    );
    ok(
      codeOf(() => {
        twoLinkChain({ p1: 1.2, p2: 0.45, qSwap: 0.9, f01: 0.99, f02: 0.99 });
      }) === "MARKOV_PARAM"
    );
    ok(
      codeOf(() => {
        twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0.9, f01: 0.99, f02: 0.99, t2: 80, cutOff: 2.5 });
      }) === "MARKOV_PARAM"
    );
    ok(
      codeOf(() => {
        twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0.9, f01: 0.99, f02: 0.99, t2: -1, cutOff: 5 });
      }) === "MARKOV_PARAM"
    );
    // negative control: qSwap=0 and p=1 stay legal (used by markov.test.ts)
    const zero = twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0, f01: 0.99, f02: 0.99 });
    ok(zero.stateCount === 4 && zero.deliveryRate === 0);
  });
});

describe("single-source anchors (face C)", () => {
  it("wernerSwapChainF and wernerSwapChainVec are the same ladder (closed form === composition)", () => {
    for (const f0 of [0.99, 0.9, 0.8]) {
      for (const hops of [1, 2, 4, 8]) {
        const closed = wernerSwapChainF(f0, hops);
        const composed = wernerSwapChainVec(f0, hops)[0]!;
        ok(Math.abs(closed - composed) < 1e-14, `f0=${f0} hops=${hops}: ${closed} vs ${composed}`);
      }
    }
  });

  it("purifyLadder is exactly purifyWerner iterated (no second recurrence copy)", () => {
    for (const f0 of [0.75, 0.85, 0.92]) {
      const manual: Array<{ f: number; p: number }> = [];
      let cur = f0;
      for (let k = 0; k < 6; k++) {
        const s = purifyWerner(cur);
        manual.push({ f: s.fOut, p: s.p });
        cur = s.fOut;
      }
      deepStrictEqual(purifyLadder(f0, 6), manual);
    }
  });
});

describe("idle requests do not smuggle phantom demand", () => {
  it("a src=dst request is structurally legal and never completes", () => {
    const n = net([link()]);
    const idle: RequestSpec = { id: "idle", src: "n2", dst: "n2", fMin: 0 };
    const rep = runSim({
      net: n,
      requests: [idle],
      policy: swapAsapPolicy(new Topology(n), [idle]),
      seed: 3,
      rounds: 50,
      warmupRounds: 0,
    });
    ok(rep.counters.attempts === 0, `attempts ${rep.counters.attempts}`);
    ok(rep.counters.good + rep.counters.bad === 0);
  });
});
