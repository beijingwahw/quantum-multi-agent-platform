import { deepStrictEqual, ok, throws } from "node:assert";
import { describe, it } from "node:test";

import { Rng } from "../src/core/rng.js";
import { runSim, type EngineView, type NetSpec, type Policy, type RequestSpec } from "../src/net/engine.js";
import { ersPolicy, swapAsapPolicy } from "../src/net/policies.js";
import {
  assertNoQosViolations,
  auditQosClaims,
  LinkF0Bank,
  PRIOR_F0,
  SensorGuardError,
  type QosClaim,
  type SensorPlan,
  triangularNoise,
} from "../src/net/sensors.js";
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
  return {
    nodes,
    links: Array.from({ length: links }, (_, i) => ({
      id: `l${i}`,
      a: `n${i}`,
      b: `n${i + 1}`,
      p: opts.p ?? 0.5,
      slots: opts.slots ?? 1,
      f0: opts.f0 ?? 0.99,
    })),
    qSwap: opts.qSwap ?? 0.9,
    ...(opts.t2 !== undefined ? { t2: opts.t2 } : {}),
    ...(opts.cutOff !== undefined ? { cutOff: opts.cutOff } : {}),
  };
}

/** exp4-A / exp6-S1 scenario: the 0.85 → 0.95 purification ladder. */
const ladderNet: NetSpec = {
  nodes: ["A", "B"],
  links: [{ id: "l", a: "A", b: "B", p: 0.9, slots: 4, f0: 0.85 }],
  qSwap: 0.9,
};
const ladderReq: RequestSpec = { id: "r", src: "A", dst: "B", fMin: 0.95 };

function sensorLadderRun(
  seed: number,
  opts: { bias?: number; sigma?: number; calibRate?: number; zMargin?: number; t2Belief?: number; rounds?: number } = {}
) {
  const bank = new LinkF0Bank(opts.zMargin ?? 0);
  const ledger: QosClaim[] = [];
  const sensors: SensorPlan = {
    bank,
    calibRate: opts.calibRate ?? 0.05,
    tomoSigma: opts.sigma ?? 0.01,
    ledger,
    ...(opts.bias !== undefined ? { tomoBias: opts.bias } : {}),
    ...(opts.t2Belief !== undefined ? { t2Belief: opts.t2Belief } : {}),
  };
  const rounds = opts.rounds ?? 30_000;
  const report = runSim({
    net: ladderNet,
    requests: [ladderReq],
    policy: ersPolicy(new Topology(ladderNet), [ladderReq]),
    seed,
    rounds,
    sensors,
  });
  const audit = auditQosClaims(ledger, ladderReq.fMin, Math.floor(rounds * 0.1));
  return { report, ledger, audit };
}

describe("estimator bank (LinkF0Bank)", () => {
  it("Welford mean/SE converge on a noisy stream; LCB margin lowers hatF; prior before samples", () => {
    const rng = new Rng(2024);
    const naive = new LinkF0Bank(0);
    const lcb = new LinkF0Bank(2);
    ok(naive.estimate("l").n === 0);
    ok(Math.abs(naive.estimate("l").hatF - PRIOR_F0) < 1e-12);
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const v = 0.85 + triangularNoise(rng, 0.01);
      const t = naive.freshToken();
      naive.recordSample(t, "l", i, v);
      lcb.recordSample(t, "l", i, v);
    }
    const e = naive.estimate("l");
    ok(e.n === n, `n ${e.n}`);
    ok(Math.abs(e.hatF - 0.85) < 4 * e.se, `hat ${e.hatF} se ${e.se}`);
    // se of the mean over n triangular(σ) samples ≈ σ/√n (within factor 2)
    ok(e.se > 0.5 * (0.01 / Math.sqrt(n)) && e.se < 2 * (0.01 / Math.sqrt(n)), `se ${e.se}`);
    const c = lcb.estimate("l");
    ok(Math.abs(c.hatF - (e.hatF - 2 * e.se)) < 1e-12, `lcb ${c.hatF}`);
  });

  it("triangularNoise is deterministic, bounded by σ√6, and ~zero-mean", () => {
    const a = new Rng(7);
    const b = new Rng(7);
    let sum = 0;
    for (let i = 0; i < 20_000; i++) {
      const x = triangularNoise(a, 0.01);
      deepStrictEqual(x, triangularNoise(b, 0.01));
      ok(Math.abs(x) <= 0.01 * Math.sqrt(6) + 1e-15, `|${x}|`);
      sum += x;
    }
    ok(Math.abs(sum / 20_000) < 0.01 / 20, `mean ${sum / 20_000}`);
  });
});

describe("smuggling trials (sensor guards)", () => {
  it("TRIAL: an oracle-peeking estimator is NAMED and REJECTED at the bank", () => {
    // counterfeit: wires the TRUE link f0 straight into the bank as a "sample"
    const trueF0 = 0.85;
    const smuggle = (kind: string): void => {
      const bank = new LinkF0Bank(0);
      const counterfeitToken = { kind, seq: 0 }; // not minted by freshToken()
      bank.recordSample(counterfeitToken, "l", 0, trueF0);
    };
    throws(
      () => {
        smuggle("oracle-fidelity");
      },
      (err: unknown) =>
        err instanceof SensorGuardError &&
        /ILLEGAL_SAMPLE_SOURCE.*'oracle-fidelity'/.test(err.message) &&
        /calibration-sacrifice/.test(err.message)
    );
    throws(
      () => {
        smuggle("heralded-sidelobe");
      },
      (err: unknown) => err instanceof SensorGuardError && /ILLEGAL_SAMPLE_SOURCE.*'heralded-sidelobe'/.test(err.message)
    );
    // the honest channel still works after the guard refused the smuggler
    const bank = new LinkF0Bank(0);
    bank.recordSample(bank.freshToken(), "l", 0, 0.851);
    ok(bank.estimate("l").n === 1);
  });

  it("TRIAL: a forged tomography reading outside physical range is NAMED and REJECTED", () => {
    const bank = new LinkF0Bank(0);
    // counterfeit instrument: reports NaN / 2.5 "fidelities" — no plausible
    // tomograph of a two-qubit state can emit these
    throws(
      () => {
        bank.recordSample(bank.freshToken(), "l", 0, Number.NaN);
      },
      (err: unknown) => err instanceof SensorGuardError && /ILLEGAL_SAMPLE_VALUE.*NaN/.test(err.message)
    );
    throws(
      () => {
        bank.recordSample(bank.freshToken(), "l", 0, 2.5);
      },
      (err: unknown) => err instanceof SensorGuardError && /ILLEGAL_SAMPLE_VALUE: 2\.5/.test(err.message)
    );
    // a legal (if noisy) reading still passes the same channel afterwards
    bank.recordSample(bank.freshToken(), "l", 0, 0.91);
    ok(bank.estimate("l").n === 1);
  });

  it("TRIAL: an illegal schedule claiming QoS it did not meet is NAMED and REJECTED by the audit", () => {
    const honest: QosClaim[] = [
      { owner: "r", round: 400, claimedF: 0.9571, trueF: 0.9569 },
      { owner: "r", round: 420, claimedF: 0.9580, trueF: 0.9575 },
      { owner: "r", round: 440, claimedF: 0.9400, trueF: 0.9390 }, // below-claim: legal
    ];
    const clean = auditQosClaims(honest, 0.95, 0);
    ok(clean.ok, clean.message);
    ok(/QOS_AUDIT_OK/.test(clean.message));
    assertNoQosViolations(honest, 0.95, 0); // strict form passes silently

    // forged certificate: claims good at 0.976 while the physics measured 0.948
    const forged: QosClaim[] = [
      ...honest,
      { owner: "r", round: 500, claimedF: 0.9760, trueF: 0.9480 },
    ];
    const audit = auditQosClaims(forged, 0.95, 0);
    ok(!audit.ok);
    ok(
      /QOS_CLAIM_VIOLATION: 1\/3.*owner r round 500 claimed F 0\.9760 vs true F 0\.9480/.test(audit.message),
      audit.message
    );
    throws(
      () => {
        assertNoQosViolations(forged, 0.95, 0);
      },
      (err: unknown) => err instanceof SensorGuardError && /QOS_CLAIM_VIOLATION/.test(err.message)
    );
  });
});

describe("engine sensor mode (belief mirror)", () => {
  it("policies see the belief mirror, not physical truth (leak-proofing)", () => {
    // calibRate 0 → belief is exactly the prior werner(0.9); truth is werner(0.85)
    const seen: number[] = [];
    const spy: Policy = {
      name: "spy",
      allocateAttempts(st: EngineView): Map<string, string[]> {
        const out = new Map<string, string[]>();
        for (const l of st.net.links) out.set(l.id, Array.from({ length: st.freeSlots(l.id) }, () => "r"));
        return out;
      },
      decideOps(st: EngineView): { swaps: []; purifies: []; discards: [] } {
        for (const p of st.pairs) seen.push(st.currentVec(p, st.round)[0]!);
        return { swaps: [], purifies: [], discards: [] };
      },
    };
    const bank = new LinkF0Bank(0);
    const sensors: SensorPlan = { bank, calibRate: 0, tomoSigma: 0.01, ledger: [] };
    const rep = runSim({ net: ladderNet, requests: [ladderReq], policy: spy, seed: 1, rounds: 3, warmupRounds: 0, sensors });
    ok(seen.length > 0, "spy saw no pairs");
    ok(Math.abs(seen[0]! - PRIOR_F0) < 1e-12, `view vec[0] ${seen[0]!} must be the prior belief, not the true 0.85`);
    ok(seen.every((f) => Math.abs(f - PRIOR_F0) < 1e-12));
    // delivered-F accounting still uses truth: 0.85 < fMin 0.95 → all bad
    ok(rep.counters.good === 0, `good ${rep.counters.good}`);
    ok(rep.counters.bad > 0, "below-fMin releases counted bad on truth");
    deepStrictEqual(
      sensors.ledger!.map((c) => [c.claimedF, c.trueF]),
      sensors.ledger!.map(() => [PRIOR_F0, 0.85])
    );
  });

  it("perfect beliefs: ≈ oracle goodput and ZERO post-warmup QoS violations", () => {
    const seeds = [11, 23, 37];
    const rounds = 40_000;
    const goodputs: number[] = [];
    const oracleGps: number[] = [];
    let violations = 0;
    for (const seed of seeds) {
      const { report, audit } = sensorLadderRun(seed, { sigma: 1e-6, rounds });
      goodputs.push(report.aggregate.goodput);
      violations += audit.violations.length;
      oracleGps.push(
        runSim({
          net: ladderNet,
          requests: [ladderReq],
          policy: ersPolicy(new Topology(ladderNet), [ladderReq]),
          seed,
          rounds,
        }).aggregate.goodput
      );
    }
    const ratio =
      goodputs.reduce((s, x) => s + x, 0) / Math.max(1e-9, oracleGps.reduce((s, x) => s + x, 0));
    ok(violations === 0, `violations ${violations}`);
    ok(ratio > 0.75 && ratio < 1.25, `goodput ratio sensor/oracle ${ratio.toFixed(3)}`);
  });

  it("systematic tomography bias: +δ leaks QoS; −δ under-claims safely; both lose goodput vs perfect belief", () => {
    const perfect = sensorLadderRun(11, { sigma: 1e-6 });
    const up = sensorLadderRun(11, { bias: 0.02, sigma: 0.01 });
    ok(!up.audit.ok, "biased-high tomography must leak QoS");
    ok(up.audit.violations.length > 50, `violations ${up.audit.violations.length}`);
    const worst = up.audit.violations.reduce((w, c) => (c.trueF < w.trueF ? c : w));
    ok(worst.trueF < 0.94, `worst true F ${worst.trueF}`);
    const down = sensorLadderRun(11, { bias: -0.02, sigma: 0.01 });
    ok(down.audit.violations.length === 0, "biased-low tomography under-claims (safe)");
    // both directions cost goodput vs perfect belief (over-estimate: wasted
    // below-grade releases; under-estimate: one purification rung too many)
    ok(down.report.aggregate.goodput < 0.85 * perfect.report.aggregate.goodput, `down ${down.report.aggregate.goodput} vs perfect ${perfect.report.aggregate.goodput}`);
    ok(up.report.aggregate.goodput < 0.9 * perfect.report.aggregate.goodput, `up ${up.report.aggregate.goodput} vs perfect ${perfect.report.aggregate.goodput}`);
  });

  it("T₂ misbelief: optimistic memory belief admits stale pairs; pessimistic starves the ladder", () => {
    const net = chainNet(4, { p: 0.3, slots: 1, t2: 300, cutOff: 6 });
    const req: RequestSpec = { id: "r", src: "n0", dst: "n4", fMin: 0.9 };
    const rounds = 30_000;
    const run = (t2Belief: number, sensors: boolean) => {
      const bank = new LinkF0Bank(0);
      const ledger: QosClaim[] = [];
      const plan: SensorPlan = { bank, calibRate: 0.05, tomoSigma: 0.01, ledger, t2Belief };
      const report = runSim({
        net,
        requests: [req],
        policy: ersPolicy(new Topology(net), [req]),
        seed: 11,
        rounds,
        ...(sensors ? { sensors: plan } : {}),
      });
      return { report, audit: auditQosClaims(ledger, req.fMin, rounds / 10) };
    };
    const oracle = runSim({
      net,
      requests: [req],
      policy: ersPolicy(new Topology(net), [req]),
      seed: 11,
      rounds,
    });
    const opt = run(600, true);
    ok(opt.audit.violations.length > 50, `optimistic violations ${opt.audit.violations.length}`);
    const pes = run(150, true);
    ok(pes.audit.violations.length === 0, "pessimistic belief under-claims (safe)");
    ok(pes.report.aggregate.goodput < 0.25 * oracle.aggregate.goodput, `pessimistic gp ${pes.report.aggregate.goodput}`);
  });

  it("calibration sacrifice costs pairs: calibrated/generated ≈ calibRate, sacrificed never deliver", () => {
    const net = chainNet(1, { p: 1, slots: 1, f0: 0.85 });
    const reqs: RequestSpec[] = [{ id: "r", src: "n0", dst: "n1", fMin: 0.5 }];
    const bank = new LinkF0Bank(0);
    const sensors: SensorPlan = { bank, calibRate: 0.25, tomoSigma: 0.01 };
    const rep = runSim({ net, requests: reqs, policy: ersPolicy(new Topology(net), reqs), seed: 5, rounds: 5000, warmupRounds: 0, sensors });
    const frac = rep.counters.calibrated / rep.counters.generated;
    ok(rep.counters.generated === 5000, `generated ${rep.counters.generated}`);
    ok(frac > 0.2 && frac < 0.3, `sacrifice fraction ${frac}`);
    const delivered = rep.counters.good + rep.counters.bad;
    ok(delivered > 3400 && delivered < 4100, `delivered ${delivered} ≈ 0.75×5000`);
  });

  it("sensor runs are deterministic: same seed → identical report and ledger", () => {
    const a = sensorLadderRun(19, { bias: 0.01, rounds: 8000 });
    const b = sensorLadderRun(19, { bias: 0.01, rounds: 8000 });
    deepStrictEqual(a.report, b.report);
    deepStrictEqual(a.ledger, b.ledger);
  });
});

describe("freeze census detector (v0.2 counters)", () => {
  it("6-hop asap T₂=400 qSwap=0.9 freezes; adding a release primitive (cutoff) unfreezes it", () => {
    const req: RequestSpec = { id: "r", src: "n0", dst: "n6", fMin: 0.9 };
    const net = chainNet(6, { p: 0.5, slots: 2, t2: 400 });
    const a = runSim({ net, requests: [req], policy: swapAsapPolicy(new Topology(net), [req]), seed: 11, rounds: 20_000 });
    ok(a.counters.lastAttemptRound < 10_000, `lastAttempt ${a.counters.lastAttemptRound}`);
    const netCut: NetSpec = { ...net, cutOff: 10 };
    const b = runSim({ net: netCut, requests: [req], policy: swapAsapPolicy(new Topology(netCut), [req]), seed: 11, rounds: 20_000 });
    ok(b.counters.lastAttemptRound >= 19_990, `with release: lastAttempt ${b.counters.lastAttemptRound}`);
    ok(b.counters.good > 100, `with release good ${b.counters.good}`);
  });
});
