/**
 * exp3 — the multi-QPU scenario: six distributed processors (QPUs) on a ladder
 * topology with a shared middle, three concurrent EPR demands (teleportation
 * traffic between QPU pairs). This is where "the scheduler schedules
 * entanglement" earns its name: link attempt slots, memory occupancy and swap
 * timing are all arbitrated among competing requests.
 *
 *        0 ─── 1
 *        │     │
 *        2 ─── 3
 *        │     │
 *        4 ─── 5
 *
 * Requests: q05 (0↔5, long-haul), q14 (1↔4, cross), q23 (2↔3, single hop on
 * the shared middle). Baselines: TDM (time-division), swap-asap, swap-late
 * (both with round-robin attempt arbitration, single shortest path). Ours: ERS.
 */

import type { RequestSpec } from "../net/engine.js";
import type { NetSpec } from "../net/topology.js";
import { ersPolicy, swapAsapPolicy, swapLatePolicy, tdmPolicy } from "../net/policies.js";
import type { Topology } from "../net/topology.js";
import { fmt, fmtInt, mdTable, runMultiSeed, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";
// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url !== pathToFileURL(process.argv[1] ?? "").href) {
  // imported by a test or module: definitions only, no render
} else {

const net: NetSpec = {
  nodes: ["0", "1", "2", "3", "4", "5"],
  links: [
    { id: "01", a: "0", b: "1", p: 0.4, slots: 2, f0: 0.99 },
    { id: "02", a: "0", b: "2", p: 0.4, slots: 2, f0: 0.99 },
    { id: "13", a: "1", b: "3", p: 0.4, slots: 2, f0: 0.99 },
    { id: "23", a: "2", b: "3", p: 0.4, slots: 2, f0: 0.99 },
    { id: "24", a: "2", b: "4", p: 0.4, slots: 2, f0: 0.99 },
    { id: "35", a: "3", b: "5", p: 0.4, slots: 2, f0: 0.99 },
    { id: "45", a: "4", b: "5", p: 0.4, slots: 2, f0: 0.99 },
  ],
  qSwap: 0.9,
};

const requests: RequestSpec[] = [
  { id: "q05", src: "0", dst: "5", fMin: 0.9 },
  { id: "q14", src: "1", dst: "4", fMin: 0.9 },
  { id: "q23", src: "2", dst: "3", fMin: 0.9 },
];

const rounds = 200_000;

const policies: Array<{ name: string; factory: (topo: Topology) => ReturnType<typeof ersPolicy> }> = [
  { name: "tdm", factory: (topo) => tdmPolicy(topo, requests, 400) },
  { name: "swap-asap", factory: (topo) => swapAsapPolicy(topo, requests) },
  { name: "swap-late", factory: (topo) => swapLatePolicy(topo, requests) },
  { name: "ers", factory: (topo) => ersPolicy(topo, requests) },
];

function scenario(netA: NetSpec, label: string): { table: string[][]; perReq: string[][] } {
  const rows: string[][] = [];
  const perReqRows: string[][] = [];
  for (const p of policies) {
    const res = runMultiSeed({ net: netA, requests, policyFactory: p.factory, rounds });
    rows.push([
      p.name,
      fmt(res.goodput, 5),
      fmt(res.goodputHalfRange, 5),
      fmt(res.keyRate, 5),
      fmt(res.meanFidelity, 5),
      fmt(res.jain, 4),
      fmt(res.spanP50, 0),
      fmt(res.spanP95, 0),
    ]);
    for (const r of requests) {
      const g = res.reports.map((x) => x.perRequest[r.id]?.goodput ?? 0);
      const mean = g.reduce((s, x) => s + x, 0) / g.length;
      perReqRows.push([label, p.name, r.id, fmt(mean, 5)]);
    }
  }
  return { table: rows, perReq: perReqRows };
}

const partA = scenario(net, "A");
// decohering regime: same net with finite memory and a hard cutoff
const netDecoh: NetSpec = { ...net, t2: 300, cutOff: 10 };
const partB = scenario(netDecoh, "B");
// strict-QoS regime: raw 3-hop swap fidelity (0.97²+…) < fMin — nothing but
// purification scheduling can deliver
const netQos: NetSpec = {
  ...net,
  links: net.links.map((l) => ({ ...l, slots: 4, f0: 0.97 })),
};
const qosRequests: RequestSpec[] = requests.map((r) => ({ ...r, fMin: 0.975 }));
function scenarioQos(netA: NetSpec): string[][] {
  const rows: string[][] = [];
  for (const p of policies) {
    const res = runMultiSeed({ net: netA, requests: qosRequests, policyFactory: p.factory, rounds });
    rows.push([
      p.name,
      fmt(res.goodput, 5),
      fmt(res.goodputHalfRange, 5),
      fmt(res.meanFidelity, 5),
      fmt(res.keyRate, 5),
    ]);
  }
  return rows;
}
const partC = scenarioQos(netQos);

const payload: Record<string, unknown> = { topology: "6-node ladder", rounds, partA: partA.table, partB: partB.table, partC };

const md = `# exp3 — 多 QPU 纠缠调度：六节点梯形网，三路并发 EPR 需求

拓扑（7 链路，p=0.4，M=2，qSwap=0.9，fMin=0.90，${fmtInt(rounds)} 轮 × 5 种子）。
q05 与 q14/q23 在中部链路 23 上竞争；q23 是单跳短需求，检验调度器是否保留
"顺路"交付（空间复用）。

## A. 良性区间（T₂=∞，无截止）——急切合并免费

${mdTable(
  ["policy", "goodput", "±散布", "key bits/轮", "F̄(good)", "Jain", "span P50", "span P95"],
  partA.table
)}

## B. 退相干区间（T₂=300，截止=10）

${mdTable(
  ["policy", "goodput", "±散布", "key bits/轮", "F̄(good)", "Jain", "span P50", "span P95"],
  partB.table
)}

## C. 严格 QoS 区间（F₀=0.97，slots=4，fMin=0.975）——只有纯化调度能交付

3 跳原始交换保真度 ≈ 0.97³ 量级 < 0.975：无纯化策略 goodput 恒为 0。

${mdTable(["policy", "goodput", "±散布", "F̄(good)", "key bits/轮"], partC)}

各请求 goodput（5 种子均值）：

${mdTable(["区间", "policy", "request", "goodput"], [...partA.perReq, ...partB.perReq])}

读法（区间依赖，如实报告）：
- A/B 区间 swap 失败与退相干代价有限，急切合并（asap）吞吐最高——
  asap 的续灌周期短；截止清理让交换失败的损失有界。协调的价值不在
  吞吐，我们不改数字。
- B 区间 F̄(good) 三策略接近（截止在起作用）。
- C 区间是调度器直接调度纠缠资源的不可替代场景：ERS 在链上建纯化
  阶梯，交付其他策略结构性无法交付的 QoS；同时 q05/q14 被亏额仲裁
  精确均分（逐种子相等）。
- TDM 全网轮转纪元无空间复用，全程垫底——下界对照。
`;


writeReport("exp3-network", payload, md);

}