/**
 * exp5 — scaling phase map: chain length × memory lifetime. Where does the
 * delivered secret-key rate collapse? The boundary separates the link-limited
 * regime (more slots / better p would help) from the memory-limited regime
 * (only longer T₂ or harder cutoffs help) — the operational phase diagram a
 * network designer actually needs.
 */

import type { RequestSpec } from "../net/engine.js";
import { swapLatePolicy } from "../net/policies.js";
import { chainNet, fmt, fmtInt, mdTable, runMultiSeed, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";
// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url !== pathToFileURL(process.argv[1] ?? "").href) {
  // imported by a test or module: definitions only, no render
} else {

const rounds = 80_000;
const hops = [2, 4, 6, 8];
const t2s = [Number.POSITIVE_INFINITY, 400, 200, 100, 50];

// keyRate[hops][T₂] — computed once, reused for both the grid and the ratio table
const keyRate: Record<number, Record<string, number>> = {};
const payload: Record<string, unknown> = {};
for (const n of hops) {
  const req: RequestSpec = { id: "r", src: "n0", dst: `n${n}`, fMin: 0.9 };
  const rowPayload: Record<string, number> = {};
  for (const t2 of t2s) {
    const net = chainNet(n, { p: 0.5, slots: 2, qSwap: 0.9, ...(Number.isFinite(t2) ? { t2 } : {}) });
    const res = runMultiSeed({
      net,
      requests: [req],
      policyFactory: (t) => swapLatePolicy(t, [req]),
      rounds,
    });
    rowPayload[String(t2)] = res.keyRate;
  }
  keyRate[n] = rowPayload;
  payload[`hops${n}`] = rowPayload;
}

// keyRate[n] was filled for every n in hops above, one entry per t2 in t2s
const grid: string[][] = hops.map((n) => [
  String(n),
  ...t2s.map((t2) => fmt(keyRate[n]![String(t2)]!, 5)),
]);

const finiteT2s = [400, 200, 100, 50];
const collapse: string[][] = hops.map((n) => {
  const row = keyRate[n]!;
  const inf = row[String(Number.POSITIVE_INFINITY)]!;
  return [
    String(n),
    ...finiteT2s.map((t2) => {
      const cur = row[String(t2)]!;
      return fmt(inf > 0 ? cur / inf : Number.NaN, 3);
    }),
  ];
});

const md = `# exp5 — 规模 × 存储寿命相位图（${fmtInt(rounds)} 轮 × 5 种子，swap-late，p=0.5，M=2，fMin=0.90）

密钥比特/轮（Werner 单向密钥分数 × 交付率；F < F*≈0.8108 的交付贡献 ≤ 0）：

${mdTable(["hops \\\\ T₂", "∞", "400", "200", "100", "50"], grid)}

相对 T₂=∞ 的保留率（<0.5 视为坍缩）：

${mdTable(["hops \\\\ T₂", "400", "200", "100", "50"], collapse)}

读法：T₂=∞ 列是纯交换衰减标度（每跳 F ← F·F₀ + (1−F)(1−F₀)/3 的乘性代价）；
向右移动，等待"全链路同时持有"的时间随跳数超线性增长，老对先退相干——
**存储受限相**在 n×(1/p) 与 T₂ 可比处接管，goodput/密钥率坍缩。
这与 exp2-B 的截止扫描一致：截止是存储受限相里唯一的止血阀。
`;

writeReport("exp5-scaling", payload, md);

}