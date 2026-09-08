/**
 * exp4 — purification ladder economics. Two questions with policy-visible
 * answers:
 *   1. How many memory slots does a ladder need? (F0=0.85 → fMin=0.95 on one
 *      link: slots 2..6; the 2^4 ladder has a hard slot floor — below it the
 *      ladder saturates below target and delivers nothing.)
 *   2. Does purification pay when links are clean? (F0=0.99, fMin=0.95:
 *      ERS should spend ≈0 purifications — the ladder is adaptive, not
 *      ritual.)
 */

import type { RequestSpec } from "../net/engine.js";
import type { NetSpec } from "../net/topology.js";
import { ersPolicy, swapLatePolicy } from "../net/policies.js";
import { SEEDS, fmt, fmtInt, mdTable, runMultiSeed, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";
// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url !== pathToFileURL(process.argv[1] ?? "").href) {
  // imported by a test or module: definitions only, no render
} else {

const rounds = 100_000;

// ---- Part A: slot floor for the 0.85 → 0.95 ladder -------------------------
const partA: string[][] = [];
for (const slots of [2, 3, 4, 5, 6]) {
  const net: NetSpec = {
    nodes: ["A", "B"],
    links: [{ id: "l", a: "A", b: "B", p: 0.9, slots, f0: 0.85 }],
    qSwap: 0.9,
  };
  const reqs: RequestSpec[] = [{ id: "r", src: "A", dst: "B", fMin: 0.95 }];
  const res = runMultiSeed({ net, requests: reqs, policyFactory: (t) => ersPolicy(t, reqs), rounds });
  const purifies = res.reports.reduce((s, r) => s + r.counters.purifies, 0) / res.reports.length;
  const good = Math.max(1, res.good);
  partA.push([
    String(slots),
    fmt(res.goodput, 5),
    fmt(res.goodputHalfRange, 5),
    fmt(res.meanFidelity, 5),
    fmtInt(purifies),
    fmt(purifies / good, 1),
  ]);
}

// ---- Part B: clean links — the ladder stays holstered ----------------------
const partB: string[][] = [];
for (const f0 of [0.99, 0.95, 0.92, 0.85]) {
  const net: NetSpec = {
    nodes: ["A", "B"],
    links: [{ id: "l", a: "A", b: "B", p: 0.9, slots: 4, f0 }],
    qSwap: 0.9,
  };
  const reqs: RequestSpec[] = [{ id: "r", src: "A", dst: "B", fMin: 0.95 }];
  const late = runMultiSeed({ net, requests: reqs, policyFactory: (t) => swapLatePolicy(t, reqs), rounds });
  const ers = runMultiSeed({ net, requests: reqs, policyFactory: (t) => ersPolicy(t, reqs), rounds });
  const purifies = ers.reports.reduce((s, r) => s + r.counters.purifies, 0) / ers.reports.length;
  partB.push([
    fmt(f0, 2),
    fmt(late.goodput, 5),
    fmt(late.meanFidelity, 5),
    fmt(ers.goodput, 5),
    fmt(ers.meanFidelity, 5),
    fmtInt(purifies),
  ]);
}

// ---- Part C: 2-hop noisy chain, purification makes an impossible QoS possible
const partC: string[][] = [];
for (const f0 of [0.95, 0.92, 0.9]) {
  const net: NetSpec = {
    nodes: ["A", "B", "C"],
    links: [
      { id: "l0", a: "A", b: "B", p: 0.7, slots: 4, f0 },
      { id: "l1", a: "B", b: "C", p: 0.7, slots: 4, f0 },
    ],
    qSwap: 0.9,
  };
  const reqs: RequestSpec[] = [{ id: "r", src: "A", dst: "C", fMin: 0.93 }];
  const late = runMultiSeed({ net, requests: reqs, policyFactory: (t) => swapLatePolicy(t, reqs), rounds });
  const ers = runMultiSeed({ net, requests: reqs, policyFactory: (t) => ersPolicy(t, reqs), rounds });
  partC.push([
    fmt(f0, 2),
    fmt(late.goodput, 5),
    fmt(late.meanFidelity, 5),
    fmt(ers.goodput, 5),
    fmt(ers.meanFidelity, 5),
    fmt(ers.keyRate, 5),
  ]);
}

// ---- Part D (v0.2): slot-count × fidelity phase boundary -------------------
// Where is the deliverable wall of the mixed ladder as F₀ improves? Each cell
// is mean ERS goodput over 3 seeds; boundary = smallest slots with goodput
// > 1e-3/round (the mixed-ladder saturation below target delivers exactly 0).
const censusSeeds = SEEDS.slice(0, 3); // [11, 23, 37]
const dRounds = 30_000;
const f0Grid = [0.8, 0.82, 0.84, 0.86, 0.88, 0.9] as const;
const slotGrid = [2, 3, 4, 5] as const;
const goodputD = new Map<string, number>();
for (const f0 of f0Grid) {
  for (const slots of slotGrid) {
    const net: NetSpec = {
      nodes: ["A", "B"],
      links: [{ id: "l", a: "A", b: "B", p: 0.9, slots, f0 }],
      qSwap: 0.9,
    };
    const reqs: RequestSpec[] = [{ id: "r", src: "A", dst: "B", fMin: 0.95 }];
    const res = runMultiSeed({
      net,
      requests: reqs,
      policyFactory: (t) => ersPolicy(t, reqs),
      rounds: dRounds,
      seeds: censusSeeds,
    });
    goodputD.set(`${f0}|${slots}`, res.goodput);
  }
}
const partD: string[][] = f0Grid.map((f0) => {
  const cells = slotGrid.map((s) => goodputD.get(`${f0}|${s}`)!);
  const minSlots = slotGrid.find((_, i) => cells[i]! > 1e-3);
  return [
    fmt(f0, 2),
    ...cells.map((g) => (g > 1e-3 ? fmt(g, 5) : "0.00000")),
    minSlots === undefined ? ">5" : String(minSlots),
  ];
});

const payload = { partA, partB, partC, partD: { rounds: dRounds, seeds: censusSeeds, grid: [...goodputD.entries()] } };

const md = `# exp4 — 纯化阶梯经济学（${fmtInt(rounds)} 轮 × 5 种子）

## A. 存储槽下限：F₀=0.85 → fMin=0.95 的 2⁴ 阶梯（单链路 p=0.9）

${mdTable(["slots", "goodput", "±散布", "F̄(good)", "纯化次数", "纯化/交付"], partA)}

槽 < 4 时混合阶梯饱和在 ~0.9497 < 0.95：**交付为零**——这是原型发现的
硬性硬件需求（同档配对需要 冠军+2×工作槽），不是调度器可绕过的参数。

## B. 干净链路：阶梯收在鞘中（单链路 slots=4，fMin=0.95）

${mdTable(["F₀", "late goodput", "late F̄", "ERS goodput", "ERS F̄", "ERS 纯化次数"], partB)}

F₀ ≥ 0.95 时交换后即达标，ERS 纯化开销 ≈ 0（自适应，不搞仪式性纯化）；
F₀ = 0.85 时 late 全部坏交付（0.85 < fMin），只有 ERS 能交付。

## C. 两跳噪声链：把不可能的 QoS 变成可能（p=0.7, slots=4, fMin=0.93）

${mdTable(["F₀", "late goodput", "late F̄", "ERS goodput", "ERS F̄", "ERS key bits/轮"], partC)}

交换本身就把 F 压到 F₀²+(1−F₀)²/3 以下（F₀=0.92 → 0.849），无纯化时
fMin=0.93 不可达；ERS 在链上建阶梯后端到端达标。

## D. 槽位 × 保真度相位边界（v0.2，${fmtInt(dRounds)} 轮 × 3 种子）

0.9497 饱和墙的推广：F₀ → fMin=0.95 的混合阶梯在 (F₀, slots) 平面上的
可交付边界（"下限" = 最小可交付 slots；0.00000 = 饱和于目标之下、交付
恰好为零——不是噪声）。

${mdTable(["F₀", "slots=2", "slots=3", "slots=4", "slots=5", "下限 slots"], partD)}

（读法：BBPSSW 爬到 0.95 所需的阶梯级数随 F₀ 下降而上升，每多一级
要求冠军之外再多一份 2^k 原料库存——下限列即"硬件需求曲线"。）
`;

writeReport("exp4-purify", payload, md);

}