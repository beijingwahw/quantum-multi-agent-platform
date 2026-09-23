/**
 * R17-A 验收：位势流引擎 SPFA 化改造后的**单解墙钟平价** A/B
 * （MinCostFlowPotentials vs 原版 MinCostFlow，bench-kit 交错配对）。
 *
 * R14 交付的 SSP+Dijkstra+二叉堆引擎实测比原版 SPFA 慢 87–122%（r14a
 * 可选墙钟 A/B 留档：B 慢 122.1%，95% CI [2.044, 2.346]×）。R17 把求解
 * 循环换回与 min-cost-flow.ts 同款的 SPFA（原始费用、同形内环），位势改
 * 为每相位 O(V) 旁路累积——本文件钉「平价」验收：
 *
 * ① 算术认证：两引擎在同一基准族上 {flow,cost} 逐位一致（同内环同选路
 *    ⇒ 同一增广序列与同一浮点求和序——平价的对象在做同一计算）；
 * ② 140×160 WDP 实例族（R14 基准形状，λ∈{0.3,0.5,0.7} 三种边密度）：
 *    ≥11 轮交织配对，验收 = 95% CI 含 1.0，或上界 ≤1.05；
 * ③ 小实例族（{10×12,14×16,18×22}×λ∈{0.2,0.5,0.8}，每轮全族重复 20 遍
 *    ——单轮 ~20ms 摊平分配型 GC 尖峰后再过分辨率地板）：同上验收；
 * ④ 测量纪律（bench-harness ① 跨种子复现法则）：A/A 效度前置；敌对环境
 *    （漂移超限/分辨率不足）→ skip 不判；误判/未达标须跨 3 个独立种子
 *    复现才定性——单种子在敌对窗口的假差异不定罪（2026-09-09 windows
 *    runner 实测 17% 误判率，守卫对亚轮级漂移有盲区）；
 * ⑤ 共享 runner 分级（2026-09 加）：CI 共享 runner 的均匀 CPU/带宽争用
 *    会令 B 臂产生**与种子无关的系统性偏慢**（本机 8/20 核加压实测
 *    1.19–1.31×，CI 4 vCPU 含噪邻只高不低）——A/A 同臂对照对称、探测不到
 *    不对称偏斜，跨种子复现法则对它失明。本机保持全强度平价门禁；CI 上
 *    降级为 r14a 同款「判决只记录不预设」，仅对 R14 级粗回归（该族实测
 *    2.044–2.346×）以 1.8× 门槛硬失败——争用偏斜与真回归之间留 ~38%/
 *    ~12% 双侧余量。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinCostFlow } from '../src/core/min-cost-flow.js';
import { MinCostFlowPotentials } from '../src/core/min-cost-flow-potentials.js';
import { comparePaired } from './bench/bench-kit.js';
import type { BenchArm, PairedBenchReport } from './bench/bench-kit.js';

type FlowImpl = typeof MinCostFlow | typeof MinCostFlowPotentials;

/** R14 基准形状的 WDP 建图并单解（S→agents(容量2)→tasks(单位)→sink，费用=−score） */
function solveWdpOnce(
  Impl: FlowImpl,
  agents: number,
  tasks: number,
  lambda: number,
): { flow: number; cost: number } {
  const sink = 1 + agents + tasks;
  const f = new (Impl as new (n: number) => InstanceType<FlowImpl>)(2 + agents + tasks);
  for (let a = 0; a < agents; a++) f.addEdge(0, 1 + a, 2, 0);
  for (let a = 0; a < agents; a++) {
    for (let task = 0; task < tasks; task++) {
      if ((a * 7 + task * 13) % 3 === 0) continue; // 能力资格
      const v = 3 + (((a * 7 + task * 13) % 17) / 10) * 2;
      const b = 1 + (a % 5) / 2;
      const score = v - lambda - b;
      if (score <= 0) continue; // 免费处置
      f.addEdge(1 + a, 1 + agents + task, 1, -score);
    }
  }
  for (let task = 0; task < tasks; task++) f.addEdge(1 + agents + task, sink, 1, 0);
  return f.run(0, sink);
}

/** 大族：140×160 × λ∈{0.3,0.5,0.7}（一轮 = 全族建图+单解） */
const LARGE_FAMILY: ReadonlyArray<readonly [number, number, number]> = [
  [140, 160, 0.3],
  [140, 160, 0.5],
  [140, 160, 0.7],
];
/** 小族：{10×12,14×16,18×22} × λ∈{0.2,0.5,0.8}，每轮全族重复 20 遍 */
const SMALL_FAMILY: ReadonlyArray<readonly [number, number, number]> = [
  [10, 12, 0.2],
  [10, 12, 0.5],
  [10, 12, 0.8],
  [14, 16, 0.2],
  [14, 16, 0.5],
  [14, 16, 0.8],
  [18, 22, 0.2],
  [18, 22, 0.5],
  [18, 22, 0.8],
];
const SMALL_REPEATS_PER_ROUND = 20;

function armOf(Impl: FlowImpl, family: typeof LARGE_FAMILY, repeats = 1): BenchArm {
  return {
    name: Impl === MinCostFlow ? 'spfa-original' : 'potentials-spfa',
    run: () => {
      for (let r = 0; r < repeats; r++) {
        for (const [agents, tasks, lambda] of family) {
          solveWdpOnce(Impl, agents, tasks, lambda);
        }
      }
    },
  };
}

/**
 * 敌对环境纪律（bench-harness.test.ts ① 的跨种子复现法则，2026-09-09
 * windows runner 实测单种子 A/A 误判 17%——守卫对亚轮级漂移有盲区）：
 * 不可判 → skip；判差/未达标须跨独立种子复现才定性；有效且达标的
 * 首次测量即通过。种子逐次 +7919 与 bench-harness 同款。
 */
/** 平价验收：95% CI 含 1.0，或 CI 上界 ≤1.05（B=位势流，ratio=B/A） */
function parityHolds(report: PairedBenchReport): boolean {
  const ciContainsOne = report.ciLow <= 1 && report.ciHigh >= 1;
  return ciContainsOne || report.ciHigh <= 1.05;
}

/**
 * 共享 runner 判定：CI=true（GitHub Actions 等）即视为不可控测量环境。
 * R14 级粗回归门槛 1.8×：R14 引擎实测慢 2.044–2.346×（本文件头注留档），
 * 均匀争用偏斜实测 ≤1.31×（2026-09-21 本机 8 核加压实测，跨 3 独立种子
 * 复现——种子维度对环境维度失明的现场证据）。
 */
const SHARED_RUNNER = process.env.CI === 'true';
const GROSS_REGRESSION_RATIO = 1.8;

function logParity(report: PairedBenchReport, familyName: string): void {
  console.log(
    `[r17a ${familyName}] ratio(B/A)=${report.medianRatio.toFixed(3)} ` +
      `CI [${report.ciLow.toFixed(3)}, ${report.ciHigh.toFixed(3)}] verdict=${report.verdict} ` +
      `(rounds kept ${report.roundsKept}/${report.roundsTotal}, outliers ${report.excludedOutliers})`,
  );
}

/**
 * A/A 效度门（镜像 bench-harness ①）：同臂测出 no-difference 即效度成立；
 * 单种子误判（同臂判差）不定性、换种子复现 3/3 才硬失败（测量器系统性
 * 伪影）；不可判 → skip。返回 true 表示已 skip，调用方须紧随 return。
 */
function aaGateSkipped(
  t: { skip: (message: string) => void },
  arm: BenchArm,
  baseSeed: number,
  opts: { rounds: number; warmupRounds: number },
): boolean {
  const misjudged: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = baseSeed + attempt * 7919;
    const report = comparePaired(
      { name: 'pot-1', run: arm.run },
      { name: 'pot-2', run: arm.run },
      { ...opts, seed },
    );
    if (report.verdict === 'inconclusive') {
      t.skip(`A/A 控制遇敌对环境，本轮不判：${report.note}`);
      return true;
    }
    if (report.verdict === 'no-difference') return false;
    misjudged.push(`种子 ${seed} 判 ${report.verdict}：${report.note}`);
  }
  assert.fail(
    `A/A 误判跨 ${misjudged.length} 个独立种子复现——测量器携带系统性伪影：${misjudged.join('；')}`,
  );
}

/**
 * 平价判决（跨种子复现法则）：任一种子的有效测量达平价 → 通过并留档；
 * 有效测量判未达 → 换独立种子复核，3 次全部未达才硬失败；全部不可判 →
 * skip（敌对环境，平价主张不判）。
 * 共享 runner 分级（头注 ⑤）：CI 上「判未达」若未越过粗回归门槛，只记录
 * 不定罪（r14a「判决只记录不预设」同款纪律）；越过 1.8× 的仍走跨种子
 * 复现硬失败——争用偏斜与真回归的分离面。
 */
function parityVerdictSkipped(
  t: { skip: (message: string) => void },
  a: BenchArm,
  b: BenchArm,
  baseSeed: number,
  opts: { rounds: number; warmupRounds: number },
  familyName: string,
): boolean {
  const failures: string[] = [];
  const recorded: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = baseSeed + attempt * 7919;
    const report = comparePaired(a, b, { ...opts, seed });
    if (report.verdict === 'inconclusive') {
      console.log(`[r17a ${familyName}] 种子 ${seed} 不可判（${report.note}）——换独立种子重测`);
      continue;
    }
    if (parityHolds(report)) {
      logParity(report, familyName);
      return false;
    }
    const detail =
      `种子 ${seed}：ratio=${report.medianRatio.toFixed(3)} ` +
      `CI [${report.ciLow.toFixed(3)}, ${report.ciHigh.toFixed(3)}]（${report.note}）`;
    if (SHARED_RUNNER && report.ciLow < GROSS_REGRESSION_RATIO) {
      recorded.push(detail);
      continue;
    }
    failures.push(detail);
  }
  if (failures.length === 0) {
    if (recorded.length > 0) {
      console.log(
        `[r17a ${familyName}] 共享 runner：平价主张只记录不判定` +
          `（粗回归门槛 ${GROSS_REGRESSION_RATIO}× 未越过——${recorded.join('；')}）`,
      );
      return false;
    }
    t.skip(`[r17a ${familyName}] 3 个独立种子全部不可判——敌对环境，平价本轮不判`);
    return true;
  }
  assert.fail(`${familyName} 平价未达跨 ${failures.length} 个独立种子复现：${failures.join('；')}`);
}

describe('R17-A · 位势流 SPFA 引擎墙钟平价（对原版 MinCostFlow）', () => {
  it('算术认证：两引擎在两个基准族上 {flow,cost} 逐位一致（同内环同选路）', () => {
    for (const [agents, tasks, lambda] of [...LARGE_FAMILY, ...SMALL_FAMILY]) {
      const a = solveWdpOnce(MinCostFlow, agents, tasks, lambda);
      const b = solveWdpOnce(MinCostFlowPotentials, agents, tasks, lambda);
      assert.deepEqual(
        b,
        a,
        `${agents}×${tasks} λ=${lambda}：位势引擎 ${JSON.stringify(b)} ≠ 原版 ${JSON.stringify(a)}`,
      );
    }
  });

  it('140×160 WDP 实例族：A/A 效度前置 + 交错 A/B 平价（12 轮交织）', (t) => {
    const potentialsArm = armOf(MinCostFlowPotentials, LARGE_FAMILY);
    if (aaGateSkipped(t, potentialsArm, 5151, { rounds: 12, warmupRounds: 4 })) return;

    parityVerdictSkipped(
      t,
      armOf(MinCostFlow, LARGE_FAMILY),
      potentialsArm,
      5252,
      { rounds: 12, warmupRounds: 4 },
      'large-wdp',
    );
  });

  it('小实例族（9 形状×20 重复/轮）：A/A 效度前置 + 交错 A/B 平价（25 轮交织）', (t) => {
    const potentialsArm = armOf(MinCostFlowPotentials, SMALL_FAMILY, SMALL_REPEATS_PER_ROUND);
    if (aaGateSkipped(t, potentialsArm, 6161, { rounds: 25, warmupRounds: 8 })) return;

    parityVerdictSkipped(
      t,
      armOf(MinCostFlow, SMALL_FAMILY, SMALL_REPEATS_PER_ROUND),
      potentialsArm,
      6262,
      { rounds: 25, warmupRounds: 8 },
      'small-wdp',
    );
  });
});
