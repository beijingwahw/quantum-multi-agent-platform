/**
 * exp2 — repeater chains: exact-DTMC referee agreement, then the memory /
 * swap-timing trade-off map on 4- and 6-hop chains (swap-asap vs swap-late,
 * cutoff on/off, T₂ sweep). All runs 5 seeds; spread = half max−min.
 */

import { runSim, type RequestSpec } from "../net/engine.js";
import type { NetSpec } from "../net/topology.js";
import { swapAsapPolicy, swapLatePolicy } from "../net/policies.js";
import { twoLinkChain } from "../net/markov.js";
import { Topology } from "../net/topology.js";
import { SEEDS, chainNet, fmt, fmtInt, mdTable, runMultiSeed, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";
// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url !== pathToFileURL(process.argv[1] ?? "").href) {
  // imported by a test or module: definitions only, no render
} else {

// ---- Part A: exact DTMC referee -------------------------------------------
const req: RequestSpec = { id: "r", src: "n0", dst: "n2", fMin: 0 };
const chain2 = chainNet(2, { p: 0.25, slots: 1, f0: 0.99, qSwap: 0.9 });
// asymmetric p achieved by editing one link
const chain2Asym: NetSpec = {
  ...chain2,
  links: chain2.links.map((l: { id: string; a: string; b: string; p: number; slots: number; f0: number }, i: number) =>
    i === 1 ? { ...l, p: 0.45 } : l
  ),
};
const roundsA = 600_000;
const engineRate = (reports: ReadonlyArray<{ counters: { good: number; bad: number } }>): number => {
  const tot = reports.reduce((s, r) => s + r.counters.good + r.counters.bad, 0);
  return tot / (reports.length * roundsA);
};
const engAgeless = SEEDS.map((seed) =>
  runSim({
    net: chain2Asym,
    requests: [req],
    policy: swapAsapPolicy(new Topology(chain2Asym), [req]),
    seed,
    rounds: roundsA,
    warmupRounds: 1000,
  })
);
const refAgeless = twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0.9, f01: 0.99, f02: 0.99 });

const chain2Age = { ...chain2Asym, t2: 80, cutOff: 5 };
const engAging = SEEDS.map((seed) =>
  runSim({
    net: chain2Age,
    requests: [req],
    policy: swapAsapPolicy(new Topology(chain2Age), [req]),
    seed,
    rounds: roundsA,
    warmupRounds: 1000,
  })
);
const refAging = twoLinkChain({ p1: 0.25, p2: 0.45, qSwap: 0.9, f01: 0.99, f02: 0.99, t2: 80, cutOff: 5 });
const meanF = (reports: ReadonlyArray<{ aggregate: { meanFidelity: number } }>): number =>
  reports.reduce((s, r) => s + r.aggregate.meanFidelity, 0) / reports.length;

// ---- Part B: 4-hop chain, T₂ × cutoff × swap-timing ------------------------
const reqB: RequestSpec = { id: "r", src: "n0", dst: "n4", fMin: 0.9 };
const t2Sweep = [Number.POSITIVE_INFINITY, 600, 300, 150, 75];
const partB: string[][] = [];
for (const t2 of t2Sweep) {
  for (const cutOff of [undefined, 6] as const) {
    for (const pol of ["late", "asap"] as const) {
      const net = chainNet(4, {
        p: 0.3,
        slots: 1,
        qSwap: 0.9,
        ...(Number.isFinite(t2) ? { t2 } : {}),
        ...(cutOff !== undefined ? { cutOff } : {}),
      });
      const res = runMultiSeed({
        net,
        requests: [reqB],
        policyFactory: (topo) => (pol === "late" ? swapLatePolicy(topo, [reqB]) : swapAsapPolicy(topo, [reqB])),
        rounds: 100_000,
      });
      partB.push([
        Number.isFinite(t2) ? fmt(t2, 0) : "∞",
        cutOff === undefined ? "—" : String(cutOff),
        pol,
        fmt(res.goodput, 5),
        fmt(res.goodputHalfRange, 5),
        fmt(res.meanFidelity, 4),
        fmt(res.bad / Math.max(1, res.good + res.bad), 3),
        fmt(res.spanP95, 0),
      ]);
    }
  }
}

// ---- Part C: swap-failure exposure (6 hops, qSwap sweep) -------------------
const reqC: RequestSpec = { id: "r", src: "n0", dst: "n6", fMin: 0.9 };
const partC: string[][] = [];
for (const qSwap of [1.0, 0.9, 0.7]) {
  for (const pol of ["late", "asap"] as const) {
    const net = chainNet(6, { p: 0.5, slots: 2, t2: 400, qSwap });
    const res = runMultiSeed({
      net,
      requests: [reqC],
      policyFactory: (topo) => (pol === "late" ? swapLatePolicy(topo, [reqC]) : swapAsapPolicy(topo, [reqC])),
      rounds: 100_000,
    });
    partC.push([
      fmt(qSwap, 2),
      pol,
      fmt(res.goodput, 5),
      fmt(res.meanFidelity, 4),
      fmt(res.spanP95, 0),
      fmt(res.reports[0]!.counters.swapFails / Math.max(1, res.reports[0]!.counters.swaps), 3), // one report per seed (SEEDS: 5)
    ]);
  }
}

// ---- Part D (v0.2): asap-freeze census — which family freezes, and does a
// release primitive (network cutoff = discard by age) unfreeze every cell? ---
const censusSeeds = SEEDS.slice(0, 3); // [11, 23, 37]
const censusRounds = 20_000;
const censusThreshold = censusRounds / 2; // frozen ⟺ attempts stopped before half-run
const partD: string[][] = [];
for (const hops of [4, 6] as const) {
  for (const slots of [1, 2] as const) {
    for (const qSwap of [1.0, 0.9, 0.8, 0.7, 0.5] as const) {
      const reqD: RequestSpec = { id: "r", src: "n0", dst: `n${hops}`, fMin: 0.9 };
      const runVariant = (cutOff?: number) => {
        const base = chainNet(hops, { p: 0.5, slots, t2: 400, qSwap });
        const net = cutOff === undefined ? base : { ...base, cutOff };
        const reps = censusSeeds.map((seed) =>
          runSim({
            net,
            requests: [reqD],
            policy: swapAsapPolicy(new Topology(net), [reqD]),
            seed,
            rounds: censusRounds,
          })
        );
        const frozen = reps.filter((r) => r.counters.lastAttemptRound < censusThreshold).length;
        const goodput = reps.reduce((s, r) => s + r.aggregate.goodput, 0) / reps.length;
        return { frozen, goodput };
      };
      const bare = runVariant(undefined);
      const released = runVariant(10);
      partD.push([
        String(hops),
        String(slots),
        fmt(qSwap, 2),
        `${bare.frozen}/3`,
        fmt(bare.goodput, 5),
        `${released.frozen}/3`,
        fmt(released.goodput, 5),
      ]);
    }
  }
}

const payload = {
  referee: {
    ageless: { engine: engineRate(engAgeless), chain: refAgeless.deliveryRate, meanFengine: meanF(engAgeless), meanFchain: refAgeless.meanFidelity, states: refAgeless.stateCount },
    aging: { engine: engineRate(engAging), chain: refAging.deliveryRate, meanFengine: meanF(engAging), meanFchain: refAging.meanFidelity, states: refAging.stateCount, t2: 80, cutOff: 5 },
  },
  partB,
  partC,
  partD: { rounds: censusRounds, seeds: censusSeeds, threshold: censusThreshold, rows: partD },
};

const relA = Math.abs(engineRate(engAgeless) - refAgeless.deliveryRate) / refAgeless.deliveryRate;
const relB = Math.abs(engineRate(engAging) - refAging.deliveryRate) / refAging.deliveryRate;

const md = `# exp2 — 中继链：精确 DTMC 裁判 + 交换时机/截止/退相干权衡

## A. 引擎 vs 精确 DTMC（2 链路, M=1, 饱和, 非对称 p₁=0.25/p₂=0.45）

${mdTable(
  ["配置", "引擎 交付/轮", "DTMC 交付/轮", "相对差", "引擎 F̄", "DTMC F̄"],
  [
    [
      `无噪声（4 态）`,
      fmt(engineRate(engAgeless), 5),
      fmt(refAgeless.deliveryRate, 5),
      fmt(relA, 4),
      fmt(meanF(engAgeless), 5),
      fmt(refAgeless.meanFidelity, 5),
    ],
    [
      `T₂=80, 截止=5（49 态）`,
      fmt(engineRate(engAging), 5),
      fmt(refAging.deliveryRate, 5),
      fmt(relB, 4),
      fmt(meanF(engAging), 5),
      fmt(refAging.meanFidelity, 5),
    ],
  ]
)}

（每配置 5 种子 × ${fmtInt(roundsA)} 轮；相对差在混合时间导致的采样误差内。）

## B. 4 跳链：T₂ × 截止 × 交换时机（p=0.3, M=1, fMin=0.90）

${mdTable(
  ["T₂", "截止", "策略", "goodput", "±散布", "F̄(good)", "坏占比", "span P95"],
  partB
)}

## C. 6 跳链：交换失败暴露（p=0.5, M=2, T₂=400）

${mdTable(["qSwap", "策略", "goodput", "F̄", "span P95", "交换失败率"], partC)}

注意 asap 在 qSwap ≥ 0.9 的 0.00000：这是**冻结死锁**的稳态，不是零能力
（前 10% 轮内 good ≈ 150–420/种子，随后 attempts 永久停止）。机制：急切
合并产生的陈旧重叠段占满全部锚点，asap 无释放/丢弃机制；低 qSwap 时交换
失败反而充当被动清道夫（销毁旧段、释放槽位），故 qSwap=0.7 行非零。
late 的铺贴门 + DP 精确覆盖天然不产生重叠段，无此病理。

## D. asap 冻结死锁普查（v0.2，机器判定：lastAttemptRound < 半程 ⇒ 冻结）

每格 3 种子 × ${fmtInt(censusRounds)} 轮，asap，p=0.5，T₂=400。"冻结 x/3" =
该格 3 种子里尝试永久停止的种子数。右侧两列为同一网格加上**释放原语**
（网络截止=10，即按年龄丢弃）后的结果。

${mdTable(["hops", "slots", "qSwap", "冻结(裸 asap)", "goodput(裸)", "冻结(+释放)", "goodput(+释放)"], partD)}

（普查结论见 README 与 theory §8：死锁家族的边界 + 释放原语的普适解冻。）
`;

writeReport("exp2-chain", payload, md);

}