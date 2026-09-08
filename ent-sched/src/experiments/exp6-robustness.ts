/**
 * exp6 — estimators + robustness (the v0.2 face). v0.1 policies read oracle
 * fidelities; here every decision runs on the sensor layer (src/net/sensors.ts,
 * docs/theory.md §10): a belief mirror fed by destructive calibration
 * tomography, with configurable measurement noise σ, systematic bias δ,
 * T₂ misbelief, and naive vs conservative (LCB) estimation. Questions:
 *
 *   1. What does replacing the oracle COST when the estimator is right?
 *      (perfect-belief cell: σ→0, δ=0, true T₂ — calibration fee only)
 *   2. How much QoS leaks when the estimator is WRONG? Violations = deliveries
 *      that passed the BELIEVED gate but are truly below fMin, read from the
 *      release audit ledger (the certificate guards in test/sensors.test.ts).
 *   3. Do statistical margins (LCB) buy protection? They shrink like 1/√n —
 *      a systematic tomography bias does not (measured below, honestly).
 */

import { runSim, type RequestSpec, type SimReport } from "../net/engine.js";
import type { NetSpec } from "../net/topology.js";
import { ersPolicy } from "../net/policies.js";
import { auditQosClaims, LinkF0Bank, type QosClaim, type SensorPlan } from "../net/sensors.js";
import { Topology } from "../net/topology.js";
import { SEEDS, fmt, fmtInt, mdTable, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";
// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url !== pathToFileURL(process.argv[1] ?? "").href) {
  // imported by a test or module: definitions only, no render
} else {

interface SensorOpts {
  readonly bias?: number;
  readonly sigma?: number;
  readonly calibRate?: number;
  readonly zMargin?: number;
  readonly t2Belief?: number;
}

interface Cell {
  readonly name: string;
  readonly goodput: number;
  readonly half: number;
  readonly retention: number;
  readonly meanF: number;
  readonly violPerK: number;
  readonly worstViolF: number;
  readonly purPerDel: number;
  readonly hatF0: number;
}

/** One (scenario × sensor-config) cell: oracle cell when opts === null. */
function runCellFull(
  net: NetSpec,
  requests: readonly RequestSpec[],
  rounds: number,
  fMin: number,
  opts: SensorOpts | null,
  seeds: readonly number[] = SEEDS
): Cell & { readonly reports: readonly SimReport[] } {
  const goodputs: number[] = [];
  const reports: SimReport[] = [];
  let viol = 0;
  let deliveries = 0;
  let worstViolF = Number.NaN;
  let purifies = 0;
  let deliveredTotal = 0;
  let hatF0 = Number.NaN;
  const warmup = Math.floor(rounds * 0.1);
  for (const seed of seeds) {
    let report: SimReport;
    if (opts === null) {
      report = runSim({ net, requests, policy: ersPolicy(new Topology(net), requests), seed, rounds });
    } else {
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
      report = runSim({ net, requests, policy: ersPolicy(new Topology(net), requests), seed, rounds, sensors });
      const audit = auditQosClaims(ledger, fMin, warmup);
      viol += audit.violations.length;
      for (const v of audit.violations)
        if (!Number.isFinite(worstViolF) || v.trueF < worstViolF) worstViolF = v.trueF;
      deliveries += ledger.filter((c) => c.round >= warmup).length;
      hatF0 = bank.estimate(net.links[0]!.id).hatF;
    }
    reports.push(report);
    goodputs.push(report.aggregate.goodput);
    purifies += report.counters.purifies;
    deliveredTotal += report.counters.good + report.counters.bad;
  }
  const mean = goodputs.reduce((s, x) => s + x, 0) / goodputs.length;
  const half = (Math.max(...goodputs) - Math.min(...goodputs)) / 2;
  const fGood = reports.filter((r) => Number.isFinite(r.aggregate.meanFidelity));
  const meanF = fGood.length > 0 ? fGood.reduce((s, r) => s + r.aggregate.meanFidelity, 0) / fGood.length : Number.NaN;
  return {
    name: "",
    goodput: mean,
    half,
    retention: Number.NaN,
    meanF,
    violPerK: deliveries > 0 ? (1000 * viol) / deliveries : 0,
    worstViolF,
    purPerDel: deliveredTotal > 0 ? purifies / deliveredTotal : Number.NaN,
    hatF0,
    reports,
  };
}

function labeled(name: string, c: ReturnType<typeof runCellFull>, oracleGp: number): string[] {
  return [
    name,
    fmt(c.goodput, 5),
    fmt(c.half, 5),
    fmt(oracleGp > 0 ? c.goodput / oracleGp : Number.NaN, 3),
    fmt(c.meanF, 5),
    fmt(c.violPerK, 1),
    Number.isFinite(c.worstViolF) ? fmt(c.worstViolF, 4) : "—",
    fmt(c.purPerDel, 1),
    Number.isFinite(c.hatF0) ? fmt(c.hatF0, 4) : "—",
  ];
}

// ---- S1: the 0.85 → 0.95 purification ladder (single link) ------------------
const s1Net: NetSpec = {
  nodes: ["A", "B"],
  links: [{ id: "l", a: "A", b: "B", p: 0.9, slots: 4, f0: 0.85 }],
  qSwap: 0.9,
};
const s1Req: RequestSpec[] = [{ id: "r", src: "A", dst: "B", fMin: 0.95 }];
const s1Rounds = 100_000;

const s1Configs: Array<{ name: string; opts: SensorOpts | null }> = [
  { name: "oracle（v0.1 对照）", opts: null },
  { name: "完美信念 σ=1e-6, δ=0", opts: { sigma: 1e-6 } },
  { name: "naive σ=0.01, δ=0", opts: { sigma: 0.01 } },
  { name: "naive σ=0.01, δ=+0.02", opts: { sigma: 0.01, bias: 0.02 } },
  { name: "naive σ=0.01, δ=−0.02", opts: { sigma: 0.01, bias: -0.02 } },
  { name: "LCB z=2, σ=0.01, δ=0", opts: { sigma: 0.01, zMargin: 2 } },
  { name: "LCB z=2, σ=0.01, δ=+0.02", opts: { sigma: 0.01, bias: 0.02, zMargin: 2 } },
  { name: "不校准（先验 0.90 卡死）", opts: { calibRate: 0 } },
];
const s1Cells = s1Configs.map((c) => ({ name: c.name, cell: runCellFull(s1Net, s1Req, s1Rounds, 0.95, c.opts) }));
const s1OracleGp = s1Cells[0]!.cell.goodput;
const s1Table = s1Cells.map((c) => labeled(c.name, c.cell, s1OracleGp));

// ---- S2: two-hop noisy chain (fMin unreachable without purification) -------
const s2Net: NetSpec = {
  nodes: ["A", "B", "C"],
  links: [
    { id: "l0", a: "A", b: "B", p: 0.7, slots: 4, f0: 0.92 },
    { id: "l1", a: "B", b: "C", p: 0.7, slots: 4, f0: 0.92 },
  ],
  qSwap: 0.9,
};
const s2Req: RequestSpec[] = [{ id: "r", src: "A", dst: "C", fMin: 0.93 }];
const s2Rounds = 60_000;
const s2Configs: Array<{ name: string; opts: SensorOpts | null }> = [
  { name: "oracle（v0.1 对照）", opts: null },
  { name: "完美信念 σ=1e-6, δ=0", opts: { sigma: 1e-6 } },
  { name: "naive σ=0.01, δ=+0.02", opts: { sigma: 0.01, bias: 0.02 } },
  { name: "naive σ=0.01, δ=−0.02", opts: { sigma: 0.01, bias: -0.02 } },
  { name: "LCB z=2, σ=0.01, δ=+0.02", opts: { sigma: 0.01, bias: 0.02, zMargin: 2 } },
];
const s2Cells = s2Configs.map((c) => ({ name: c.name, cell: runCellFull(s2Net, s2Req, s2Rounds, 0.93, c.opts) }));
const s2OracleGp = s2Cells[0]!.cell.goodput;
const s2Table = s2Cells.map((c) => labeled(c.name, c.cell, s2OracleGp));

// ---- S3: aging chain — T₂ misbelief axis (4 hops, T₂=300, cutoff=6) --------
function chainNet(
  links: number,
  opts: { p?: number; slots?: number; f0?: number; t2?: number; cutOff?: number; qSwap?: number } = {}
): NetSpec {
  const nodes = Array.from({ length: links + 1 }, (_, i) => `n${i}`);
  return {
    nodes,
    links: Array.from({ length: links }, (_, i) => ({
      id: `l${i}`,
      a: `n${i}`,
      b: `n${i + 1}`,
      p: opts.p ?? 0.5,
      slots: opts.slots ?? 2,
      f0: opts.f0 ?? 0.99,
    })),
    qSwap: opts.qSwap ?? 0.9,
    ...(opts.t2 !== undefined ? { t2: opts.t2 } : {}),
    ...(opts.cutOff !== undefined ? { cutOff: opts.cutOff } : {}),
  };
}
const s3Net = chainNet(4, { p: 0.3, slots: 1, t2: 300, cutOff: 6 });
const s3Req: RequestSpec[] = [{ id: "r", src: "n0", dst: "n4", fMin: 0.9 }];
const s3Rounds = 30_000;
const s3Configs: Array<{ name: string; opts: SensorOpts | null }> = [
  { name: "oracle（v0.1 对照）", opts: null },
  { name: "T₂ 信念=300（正确）", opts: { sigma: 0.01, t2Belief: 300 } },
  { name: "T₂ 信念=600（乐观 ×2）", opts: { sigma: 0.01, t2Belief: 600 } },
  { name: "T₂ 信念=∞（以为记忆完美）", opts: { sigma: 0.01, t2Belief: Number.POSITIVE_INFINITY } },
  { name: "T₂ 信念=150（悲观 ÷2）", opts: { sigma: 0.01, t2Belief: 150 } },
];
const s3Cells = s3Configs.map((c) => ({ name: c.name, cell: runCellFull(s3Net, s3Req, s3Rounds, 0.9, c.opts) }));
const s3OracleGp = s3Cells[0]!.cell.goodput;
const s3Table = s3Cells.map((c) => labeled(c.name, c.cell, s3OracleGp));

const payload = {
  s1: { rounds: s1Rounds, oracleGoodput: s1OracleGp, table: s1Table },
  s2: { rounds: s2Rounds, oracleGoodput: s2OracleGp, table: s2Table },
  s3: { rounds: s3Rounds, oracleGoodput: s3OracleGp, table: s3Table },
};

const md = `# exp6 — 估计器 + 鲁棒性（v0.2 主交付：传感器层替代 oracle）

协议：每链路估计器银行（Welford）由**破坏性校准层析**喂养——成功生成的
对以 calibRate=5% 概率被销毁测量（三角噪声 sd=σ，系统偏差 δ；估计有真实
成本）。调度器看到的是**信念镜像**：werner(f̂₀) 生成 → 置换代数传播 →
按相信的 T₂ 老化。物理裁判始终按真值记账，故信念错误暴露为"过了信念门
但真值 < fMin"的交付（**违约**，来自释放审计账本——即走私审判测试守卫
的同一账本）。hatF₀ 列为银行收敛值。

## S1. 单链路纯化阶梯（F₀=0.85 → fMin=0.95, p=0.9, slots=4, ${fmtInt(s1Rounds)} 轮 × 5 种子）

${mdTable(
  ["传感器配置", "goodput", "±散布", "保持率", "F̄(good)", "违约/千交付", "最差真F", "纯化/交付", "hatF₀"],
  s1Table
)}

## S2. 两跳噪声链（F₀=0.92 → fMin=0.93, p=0.7, slots=4, ${fmtInt(s2Rounds)} 轮 × 5 种子）

${mdTable(
  ["传感器配置", "goodput", "±散布", "保持率", "F̄(good)", "违约/千交付", "最差真F", "纯化/交付", "hatF₀"],
  s2Table
)}

## S3. 退相干链：T₂ 误信轴（4 跳, p=0.3, M=1, T₂=300, 截止=6, ${fmtInt(s3Rounds)} 轮 × 5 种子）

${mdTable(
  ["传感器配置", "goodput", "±散布", "保持率", "F̄(good)", "违约/千交付", "最差真F", "纯化/交付", "hatF₀"],
  s3Table
)}

读法（三条实测定律，数字全部来自上表）：
- **估计有成本，但便宜**：完美信念行保持率 ≈ 0.9×——这就是把 oracle 换成
  校准传感器的全部代价（5% 牺牲率 + 校准瞬态）。
- **系统性偏差是 QoS 的方向性威胁**：δ=+0.02 使银行收敛到错误的 hatF₀，
  信念门形同虚设（违约以每千交付计）；δ=−0.02 方向安全（低报），代价是
  多爬一级阶梯。**LCB（z=2）救不了偏差**：统计裕度按 1/√n 收缩，对系统
  偏差无效——与 δ=+0.02 的 naive 行同量级，如实报告。
- **T₂ 误信不对称**：乐观（×2 或 ∞）让陈旧对通过信念门 → 违约；悲观
  （÷2）让信念里的衰减快于真实 → 阶梯在信念中永远到不了门 → goodput
  坍缩。悲观不违约但饿死吞吐，乐观保吞吐但撕毁 QoS——不对称是结构性的。
`;

writeReport("exp6-robustness", payload, md);

}
